# Lightweight desktop card hover — review before publishing

Open the preview link in the draft pull request. On desktop, open Browse and
hover or keyboard-focus a thumbnail. It rises 12px out of the deck, keeping its
size, image and opacity. No detail photos are downloaded or decoded on hover.
Click to return to that photograph in the main feed; click the feed photo to
open the original viewer. Reduced motion disables the lift transition.

The native mobile scrolling and refined thumbnail borders are preserved.
Production remains unchanged until approval.

Rebuild the standalone preview:

```sh
python3 photo/tools/build-review.py --photo-base https://samtc.me/photo --renditions
```

Validation: 41 DOM/navigation checks, including no hover decodes and retained
thumbnail sources. The retired expanding-preview animation tests were removed
with that feature. Browser checks separately measure lift distance, stable
size/neighbors, no detail-image requests and mobile navigation.
