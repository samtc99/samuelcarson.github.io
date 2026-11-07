# Gallery performance review

Compared the prior review build (c76a0a8) with this draft using local Chromium,
a cold browser context, fonts blocked, and 4x CPU throttling. Desktop viewport:
1440 × 1000 at DPR 1. Mobile viewport: 390 × 844. These are local development
measurements, not iPhone Safari or production network/frame-rate measurements.

| Check | Before | After |
| --- | ---: | ---: |
| Initial desktop feed image bytes | 12,402,345 | 2,018,192 |
| Initial desktop original-image requests | 13 | 0 |
| Card-position reads during 100 mobile scroll steps | 10,494 | 0 |

Desktop feed image payload fell 83.7% in this run. The browser now
selects the sharp 1080px optimized image when sufficient for the rendered size
and pixel density, and retains original candidates for larger displays. Separate
source checks confirm optimized copies at 1440px/DPR 1 and 2, originals at
2560px/DPR 2, and optimized copies on mobile at 390px/DPR 3. The full-size viewer
still uses originals. All overview deck cards retain their higher-resolution
optimized source from initial render.

Mobile positions are read once after real layout changes and searched from the
cache during scrolling. Unchanged desktop ResizeObserver notifications no longer
rewrite the masonry layout. Native scrolling, counter, session restoration,
shuffle, spacing and all card animations remain covered.

Timing samples were noisy: the lower script work did not produce a consistent
reduction in total task time during image-heavy scrolling. No FPS or universal
load-time improvement is claimed from these runs.

Validation: 51 DOM/navigation checks; Chromium card extraction and reverse,
continuous shadow, higher-resolution sources, stack order, reduced motion,
mobile navigation and compact header checks. A delayed-image test checks all
106 overview card positions and sizes remain stable through decoding.
