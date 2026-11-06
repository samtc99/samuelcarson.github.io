#!/usr/bin/env python3
"""Create mobile WebP copies and grid thumbnails; leave originals untouched.

Install Pillow once: python3 -m pip install Pillow
Run from any directory: python3 photo/tools/make-previews.py
"""
from pathlib import Path
import re
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def main():
    files = re.findall(r'file:\s*"([^"\n]+)"', (ROOT / "photos.js").read_text())
    total = 0
    for folder in ("previews", "thumbs"):
        (ROOT / folder).mkdir(exist_ok=True)
    for filename in files:
        source = ROOT / "images" / filename
        if source.parent != ROOT / "images":
            raise ValueError(f"Expected a filename, not a path: {filename}")
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
            profile = opened.info.get("icc_profile", b"")
            for folder, width, quality in (("previews", 1080, 84), ("thumbs", 300, 76)):
                width = min(width, image.width)
                height = max(1, round(image.height * width / image.width))
                copy = image.resize((width, height), Image.Resampling.LANCZOS)
                destination = ROOT / folder / (Path(filename).stem + ".webp")
                copy.save(destination, "WEBP", quality=quality, method=6, icc_profile=profile)
                total += destination.stat().st_size
    print(f"Created {len(files)} mobile copies and {len(files)} thumbnails ({total / 1024 / 1024:.1f} MiB).")


if __name__ == "__main__":
    main()
