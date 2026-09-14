#!/usr/bin/env python3
"""Create a simple hidden-bear board from the existing picture-book scenes."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "production/assets/poco-02-scarf.png"
OUT = ROOT / "production/assets/poco-hide-atlas-v1.png"


def resize_panel(src: Image.Image, idx: int) -> Image.Image:
    size = src.width // 2
    x, y = (idx % 2) * size, (idx // 2) * size
    return src.crop((x, y, x + size, y + size)).resize((1024, 1024), Image.Resampling.LANCZOS).convert("RGBA")


def covered_scene(src: Image.Image, question_mark: bool = False) -> Image.Image:
    out = src.copy()
    draw = ImageDraw.Draw(out)
    # A large warm cardboard box hides the bear; two ears remain visible above it.
    box = [(90, 310), (735, 310), (805, 430), (805, 1024), (90, 1024)]
    draw.polygon(box, fill=(183, 126, 76, 255))
    draw.line([(90, 310), (735, 310), (805, 430), (805, 1024)], fill=(124, 83, 53, 255), width=7)
    draw.line([(90, 420), (90, 1024)], fill=(124, 83, 53, 255), width=7)
    draw.line([(410, 320), (410, 1024)], fill=(145, 96, 59, 255), width=5)
    draw.line([(90, 430), (805, 430)], fill=(145, 96, 59, 255), width=5)
    # Ears peeking out make the hiding place solvable without revealing the face.
    draw.ellipse((280, 220, 385, 340), fill=(135, 81, 53, 255), outline=(90, 55, 42, 255), width=5)
    draw.ellipse((475, 220, 580, 340), fill=(135, 81, 53, 255), outline=(90, 55, 42, 255), width=5)
    draw.ellipse((307, 245, 358, 305), fill=(235, 157, 139, 255))
    draw.ellipse((502, 245, 553, 305), fill=(235, 157, 139, 255))
    if question_mark:
        draw.text((640, 610), "?", fill=(255, 250, 240, 255))
    return out


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    atlas = Image.new("RGBA", (2048, 2048), (255, 255, 255, 0))
    # Two question panels hide the bear; the latter two reveal it.
    panels = [covered_scene(resize_panel(src, 0), True), covered_scene(resize_panel(src, 1), False), resize_panel(src, 2), resize_panel(src, 3)]
    for idx, p in enumerate(panels):
        atlas.alpha_composite(p, ((idx % 2) * 1024, (idx // 2) * 1024))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
