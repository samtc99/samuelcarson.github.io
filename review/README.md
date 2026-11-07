# Three-step card interaction — review before publishing

Desktop Browse:

1. Hover or focus: peek the card up 20px, preserving stack order and size.
2. Click: pull it fully out into an uncropped preview, using its thumbnail
   immediately and loading a sharper copy only after the click.
3. Click the expanded card: open the original photograph carousel.

Escape dismisses an expanded card without closing Browse. Closing the carousel
returns to the selected thumbnail. Scrolling, resizing, blur or selecting another
card cancels stale preview work. Reduced motion disables the pull transition.
Mobile retains native document scrolling and thumbnail-to-feed navigation.

Validation: 42 DOM/navigation checks, plus Chromium checks for hover geometry,
stack occlusion, no hover detail requests, the two-click expansion/carousel flow,
Escape, reduced motion and retained mobile navigation. Screenshot inspected.
Production remains unchanged until approval.

Rebuild:

```sh
python3 photo/tools/build-review.py --photo-base https://samtc.me/photo --renditions
```
