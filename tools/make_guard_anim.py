#!/usr/bin/env python3
"""Build the knight's Guard sheet from pixels already in the pack.

The high guard, the raise into it, and the parry all reuse the sword and
hand cut out of Attack frame 0 (the windup, where the blade is fully
visible). Those pixels are rotated around the glove and stamped onto the
idle body, after the resting sword is cleared. Nothing here is redrawn
from a new palette: every color is one of the nine already in the idle
sheet.

Sheet layout, 8 frames of 120x80, facing right, feet on row 79:

  0 raise   sword leaving the shoulder
  1 raise   blade coming upright
  2 hold    high guard
  3 hold    blade settles up a pixel
  4 hold    blade settles back
  5 parry   blade kicks forward
  6 parry   recover
  7 settle  back in high guard

Run from the repo root: python3 tools/make_guard_anim.py
"""

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "cursor" / "120x80_PNGSheets"
OUTS = [
    ROOT / "cursor" / "120x80_PNGSheets" / "_Guard.png",
    ROOT / "gemini" / "120x80_PNGSheets" / "_Guard.png",
]

FW, FH = 120, 80

BLD = (199, 199, 176, 255)
OUT = (26, 14, 19, 255)
BRN = (105, 85, 42, 255)
GLD = (159, 128, 63, 255)
DBR = (54, 41, 23, 255)
ARM = (134, 130, 115, 255)
SHD = (58, 56, 54, 255)
TRANSPARENT = (0, 0, 0, 0)

# The glove stays planted. Only the blade angle changes, which is what a
# guard and a parry actually do. Bob is a one-pixel slide of that blade.
# Angles are PIL rotations of the windup sword: -75 is upright, more
# negative angles swing the tip forward (to the right).
# angle, hand x, hand y, idle frame, blade bob, spark
POSES = [
    (-132, 63, 56, 0, 0, False),
    (-102, 63, 55, 0, 0, False),
    (-75, 63, 55, 0, 0, False),
    (-75, 63, 55, 4, -1, False),
    (-75, 63, 55, 8, 1, False),
    (-124, 63, 55, 1, 0, True),
    (-98, 63, 55, 0, 0, False),
    (-75, 63, 55, 2, 0, False),
]


def attack_sword():
    """Sword, hilt, and glove from Attack frame 0, the clean windup blade."""
    fr = Image.open(SRC / "_Attack.png").convert("RGBA").crop((0, 0, FW, FH))
    px = fr.load()
    seen = set()
    best = []
    for y in range(FH):
        for x in range(FW):
            if (x, y) in seen or px[x, y] != BLD:
                continue
            q = deque([(x, y)])
            comp = []
            while q:
                cx, cy = q.popleft()
                if (cx, cy) in seen:
                    continue
                if not (0 <= cx < FW and 0 <= cy < FH) or px[cx, cy] != BLD:
                    continue
                seen.add((cx, cy))
                comp.append((cx, cy))
                q.extend(((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)))
            if len(comp) > len(best):
                best = comp
    blade = set(best)
    extra = set()
    frontier = set(blade)
    for _ in range(3):
        nxt = set()
        for x, y in frontier:
            for dy in range(-1, 2):
                for dx in range(-1, 2):
                    nx, ny = x + dx, y + dy
                    if (nx, ny) in blade or (nx, ny) in extra:
                        continue
                    if not (0 <= nx < FW and 0 <= ny < FH):
                        continue
                    c = px[nx, ny]
                    if c[3] < 10:
                        continue
                    if c == OUT or c in (BRN, GLD, DBR):
                        nxt.add((nx, ny))
        extra |= nxt
        frontier = nxt
    golds = {p for p in extra if px[p] == GLD}
    wrist = set()
    for x, y in golds:
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                nx, ny = x + dx, y + dy
                if (nx, ny) in blade or (nx, ny) in extra or (nx, ny) in wrist:
                    continue
                if 0 <= nx < FW and 0 <= ny < FH and px[nx, ny] in (ARM, SHD, OUT, DBR):
                    wrist.add((nx, ny))
    pts = blade | extra | wrist
    glist = [p for p in pts if px[p] == GLD]
    ax = sum(p[0] for p in glist) / len(glist)
    ay = sum(p[1] for p in glist) / len(glist)
    big = Image.new("RGBA", (180, 180), TRANSPARENT)
    bp = big.load()
    for x, y in pts:
        bp[int(round(x - ax + 90)), int(round(y - ay + 90))] = px[x, y]
    return big


def idle_body(frame):
    """Idle body with the resting sword and the low forward hand removed."""
    src = Image.open(SRC / "_Idle.png").convert("RGBA")
    body = src.crop((frame * FW, 0, frame * FW + FW, FH))
    ip = body.load()
    for y in range(57, 68):
        for x in range(40, 50):
            ip[x, y] = TRANSPARENT
    for y in range(56, 68):
        for x in range(60, 72):
            if ip[x, y] in (GLD, BRN, DBR, BLD):
                ip[x, y] = TRANSPARENT
    return body


def repaint_blade(out, body, blade_dy):
    """Throw out the rotated blade and paint a clean taper on its axis.

    Rotation breaks the sword into stepped, sometimes split pixels. The
    glove and crossguard (anything near the hand) are kept. Everything
    farther out is erased and replaced by a straight tapered blade aimed
    the same way, in the original steel and outline colors.
    """
    import math

    op = out.load()
    bp = body.load()
    added = [
        (x, y)
        for y in range(FH)
        for x in range(FW)
        if op[x, y][3] > 10 and bp[x, y] != op[x, y]
    ]
    golds = [(x, y) for x, y in added if op[x, y] == GLD]
    blade_pts = [(x, y) for x, y in added if op[x, y] == BLD]
    if len(golds) < 3 or len(blade_pts) < 8:
        return None
    hx = sum(p[0] for p in golds) / len(golds)
    hy = sum(p[1] for p in golds) / len(golds)
    mx = sum(p[0] for p in blade_pts) / len(blade_pts)
    my = sum(p[1] for p in blade_pts) / len(blade_pts)
    sxx = sum((x - mx) ** 2 for x, y in blade_pts)
    syy = sum((y - my) ** 2 for x, y in blade_pts)
    sxy = sum((x - mx) * (y - my) for x, y in blade_pts)
    ang = 0.5 * math.atan2(2 * sxy, sxx - syy)
    dx, dy = math.cos(ang), math.sin(ang)
    if (mx - hx) * dx + (my - hy) * dy < 0:
        dx, dy = -dx, -dy

    keep = 8.5
    for x, y in added:
        if (x - hx) ** 2 + (y - hy) ** 2 > keep * keep:
            op[x, y] = TRANSPARENT

    length = 31
    pxn, pyn = -dy, dx
    tip = None
    for i in range(2, length + 1):
        t = (i - 2) / (length - 2)
        x = hx + dx * i
        y = hy + dy * i + blade_dy
        radius = 1.7 * (1 - t) + 0.55
        n = int(math.ceil(radius))
        for k in range(-n, n + 1):
            if abs(k) > radius:
                continue
            sx = int(round(x + pxn * k))
            sy = int(round(y + pyn * k))
            if 0 <= sx < FW and 0 <= sy < FH and op[sx, sy][3] < 10:
                op[sx, sy] = BLD
                tip = (sx, sy)

    fresh = []
    for y in range(FH):
        for x in range(FW):
            if op[x, y] == BLD and bp[x, y][3] < 10:
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < FW and 0 <= ny < FH and op[nx, ny][3] < 10:
                        fresh.append((nx, ny))
    for x, y in fresh:
        if op[x, y][3] < 10:
            op[x, y] = OUT
    return tip


def add_spark(im, tip):
    """A small on-palette clash just past the parry blade."""
    if tip is None:
        return
    ip = im.load()
    tx, ty = tip
    for dx, dy, col in (
        (2, -1, BLD),
        (3, 1, GLD),
        (1, -3, BLD),
        (4, -2, OUT),
        (2, 2, GLD),
        (0, -2, BLD),
    ):
        x, y = tx + dx, ty + dy
        if 0 <= x < FW and 0 <= y < FH and ip[x, y][3] < 10:
            ip[x, y] = col


def compose(sword, angle, hx, hy, frame, blade_dy, spark):
    body = idle_body(frame)
    rot = sword.rotate(angle, resample=Image.NEAREST, center=(90, 90))
    out = body.copy()
    out.alpha_composite(rot, (hx - 90, hy - 90))
    tip = repaint_blade(out, body, blade_dy)
    if spark:
        add_spark(out, tip)
    return out


def build():
    sword = attack_sword()
    sheet = Image.new("RGBA", (FW * len(POSES), FH), TRANSPARENT)
    frames = []
    for i, (angle, hx, hy, frame, blade_dy, spark) in enumerate(POSES):
        fr = compose(sword, angle, hx, hy, frame, blade_dy, spark)
        frames.append(fr)
        sheet.alpha_composite(fr, (i * FW, 0))
    for dest in OUTS:
        sheet.save(dest)
        print("wrote", dest, sheet.size)
    return frames


def preview(frames):
    """Contact strip on a dark ground, scaled up, for visual checking."""
    scale = 4
    pad = 8
    cell_w = FW * scale
    cell_h = FH * scale
    sheet = Image.new("RGBA", (len(frames) * cell_w, cell_h + 18), (12, 10, 18, 255))
    draw = ImageDraw.Draw(sheet)
    labels = ["raise", "raise", "guard", "guard", "guard", "parry", "parry", "guard"]
    for i, fr in enumerate(frames):
        bg = Image.new("RGBA", (FW, FH), (22, 16, 32, 255))
        bg.alpha_composite(fr)
        # floor line where the feet sit
        floor = bg.load()
        for x in range(FW):
            floor[x, 79] = (80, 60, 48, 255) if floor[x, 79][3] < 10 else floor[x, 79]
        z = bg.resize((cell_w, cell_h), Image.NEAREST)
        sheet.alpha_composite(z, (i * cell_w, 16))
        draw.text((i * cell_w + 4, 1), f"{i} {labels[i]}", fill=(240, 220, 170, 255))
    out = Path("/tmp/knight/guard_strip.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print("preview", out, sheet.size)


if __name__ == "__main__":
    preview(build())
