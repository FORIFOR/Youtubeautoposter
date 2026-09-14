#!/usr/bin/env python3
"""Create a reviewed red-ball atlas from the existing picture-book artwork.

The source artwork is not overwritten. The atlas keeps the existing bear and
garden style while adding a simple, readable two-choice board for episode 06.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "production/assets/poco-shape-game-atlas-v2.png"
OUT = ROOT / "production/assets/poco-red-ball-atlas-v1.png"


def ball(size: int, rgb: tuple[int, int, int]) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = canvas.load()
    cx = cy = size / 2
    radius = size * 0.46
    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            d = math.sqrt(dx * dx + dy * dy)
            if d > radius:
                continue
            nx, ny = dx / radius, dy / radius
            light = max(0.0, 0.85 * (-0.38 * nx - 0.52 * ny) + 0.2)
            shade = max(0.0, 1 - d / radius)
            factor = 0.72 + light * 0.55 + shade * 0.10
            px[x, y] = (*[min(255, int(c * factor)) for c in rgb], 255)
    draw = ImageDraw.Draw(canvas)
    draw.ellipse((size * .28, size * .18, size * .43, size * .32), fill=(255, 247, 235, 180))
    return canvas


def panel(source: Image.Image, highlighted: bool, ending: bool) -> Image.Image:
    # Shape atlas is already a 2×2 set of the same bear and garden. Cover the
    # old shape cards and draw two large, high-contrast balls.
    out = source.convert("RGBA").resize((1024, 1024), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(out)
    card = (62, 510, 962, 980)
    draw.rounded_rectangle(card, radius=48, fill=(255, 250, 241, 255), outline=(241, 226, 202, 255), width=4)
    red = ball(250, (224, 58, 55))
    blue = ball(250, (55, 116, 220))
    out.alpha_composite(red, (150 if not ending else 370, 635))
    out.alpha_composite(blue, (625 if not ending else 650, 635))
    if highlighted:
        draw.ellipse((130 if not ending else 350, 615, 420 if not ending else 640, 905), outline=(255, 255, 249, 255), width=16)
    font = ImageFont.truetype("/System/Library/Fonts/ヒラギノ丸ゴ ProN W4.ttc", 42)
    draw.text((280, 560), "あかい ボール", font=font, fill=(95, 72, 52, 255))
    return out


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    if src.width != src.height or src.width % 2:
        raise ValueError(f"unexpected atlas size: {src.size}")
    atlas = Image.new("RGBA", (2048, 2048), (255, 255, 255, 0))
    source_panel = src.width // 2
    for idx in range(4):
        x, y = (idx % 2) * 1024, (idx // 2) * 1024
        sx, sy = (idx % 2) * source_panel, (idx // 2) * source_panel
        original = src.crop((sx, sy, sx + source_panel, sy + source_panel))
        made = panel(original, highlighted=idx in (1, 3), ending=idx == 3)
        atlas.alpha_composite(made, (x, y))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
