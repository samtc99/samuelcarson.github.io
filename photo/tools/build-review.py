#!/usr/bin/env python3
"""Package a self-contained review page using the current gallery source."""
import argparse
import html
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--photo-base", default="https://samtc.me/photo")
    parser.add_argument("--original-base", help="Optional separate base for the already-published originals")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--originals", dest="renditions", action="store_false", help="Reuse already-published originals (default)")
    mode.add_argument("--renditions", dest="renditions", action="store_true", help="Use a photo base that also hosts previews and thumbnails")
    parser.set_defaults(renditions=False)
    parser.add_argument("--document-scroll", action="store_true", help="Build the native-page mobile scrolling experiment")
    args = parser.parse_args()
    page = (ROOT / "index.html").read_text()
    page = page.replace('<html lang="en">', f'<html lang="en" data-photo-base="{html.escape(args.photo_base, quote=True)}">')
    if args.document_scroll:
        page = page.replace('<html lang="en" ', '<html lang="en" data-document-deck ', 1)
    if args.original_base:
        page = page.replace('data-photo-base=', f'data-original-photo-base="{html.escape(args.original_base, quote=True)}" data-photo-base=', 1)
    if not args.renditions:
        page = page.replace('data-photo-base=', 'data-use-originals="true" data-photo-base=', 1)
    page = page.replace('<title>Samuel Carson — Photography</title>', '<title>Preview — Samuel Carson Photography</title>\n  <meta name="robots" content="noindex,nofollow" />')
    page = page.replace('class="name" href="/"', 'class="name" href="https://samtc.me/"')
    page, count = re.subn(r'<link rel="stylesheet" href="\./styles\.css[^\"]*"\s*/?>', lambda _: '<style>\n' + (ROOT / "styles.css").read_text() + '\n</style>', page)
    if count != 1:
        raise ValueError("Expected one gallery stylesheet")
    for name in ("photos", "app"):
        script = (ROOT / f"{name}.js").read_text().replace("</script", "<\\/script")
        page, count = re.subn(r'<script src="\./' + name + r'\.js[^\"]*"></script>', lambda _: '<script>\n' + script + '\n</script>', page)
        if count != 1:
            raise ValueError(f"Expected one {name} script")
    destination = ROOT.parent / "review" / ("native-scroll.html" if args.document_scroll else "mobile-deck.html")
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(page)
    print(f"Built {destination.name}: {len(page.encode()):,} bytes; all styles and application scripts inline.")


if __name__ == "__main__":
    main()
