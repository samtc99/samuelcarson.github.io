# Physical card extraction — review before publishing

Desktop Browse:

1. Hover: peek the top up 20px within the existing stack.
2. First click: slide the card up 80px total, still behind cards in front.
3. Second click: visibly pull the same card up and out over 780ms, with no zoom,
   separate preview or carousel. Keep its dimensions and border.

The pull starts from the real card position; a progressive mask reveals its
lower portion during the lift, then it settles nearby with a slight tilt.
A hidden matching slot preserves the deck's geometry. Clicking the extracted card
or outside it, Escape, scroll, resize or blur restores the original slot.
Reduced motion skips animation. Mobile navigation remains unchanged.

Validation: DOM/navigation checks plus Chromium checks for intermediate animation
frames, constant dimensions, no extra detail downloads, same-node restoration,
hover/selection geometry, keyboard dismissal and mobile navigation. Motion
screenshots inspected. Production remains unchanged pending approval.

## Detail and shadow refinement

Second click now requests the optimized higher-resolution photo. The existing
thumbnail stays visible until the detail image decodes, then swaps without
changing geometry or restarting movement. Late or failed results cannot disrupt
returned cards or another selection. No detail loading occurs on hover or first
click.

The reveal mask animates on an inner surface while the outer card owns a stable
drop shadow, so that shadow follows the visible card throughout the animation.
Transform and mask animations use a shared timeline start. Both layers are
prepared for animation; reduced-motion behavior is preserved.

Validation: 45 DOM/navigation checks plus Chromium checks of intermediate shadow,
mask/transform frames, high-resolution source decoding, stable dimensions,
second-click-only detail loading, hover/first-click stack behavior, return and
mobile navigation. In-motion screenshot inspected.

## Animated third-click return

A third click reverses the active pull and surface mask from their current
progress, retaining the moving shadow and sharp image. Once the card rejoins
its original slot at the raised pose, its existing slide transition lowers it
back into the deck. One click reverses both stages; repeated clicks cannot
restart the return. Reduced motion restores immediately. Scroll, resize, blur,
Escape and changing selection cancel safely without stale completion callbacks.

Validation: 47 DOM/navigation checks plus Chromium intermediate-frame checks for
the reversed pull, moving shadow and final lowering transition. The final slot,
card count, dimensions, image and mobile behavior remain intact.

## Compact Browse header

The overview now matches the main feed's 68px header height, with the title at
20px, a compact count line and a full 44px close target. Remove the repeated
Samuel Carson eyebrow and excess spacing. On narrow screens the helper text
truncates rather than making the header taller. Safe-area padding is retained.
Chromium measured equal feed/Browse heights at 1440px, 390px and 320px widths;
card extraction/return, reduced motion and mobile navigation checks also passed.

## Sharp cards before extraction

Every card now starts with its optimized higher-resolution preview, including
cards sitting in the deck. Lazy loading and async decoding remain enabled.
Extraction reuses the loaded image instead of requesting it again. Card sizing,
stack order and all three click animations remain unchanged.

## Performance refinement

Keep the approved high-resolution deck and animation behavior while reducing
background work. The desktop feed selects an optimized or original candidate
based on display size and pixel density. Mobile scrolling uses cached card
positions; desktop layout skips unchanged resize observations. See
[performance.md](performance.md) for measured image bytes, scroll reads and scope.

## Desktop drag experiment

After the second-click pull has fully settled, grab the card and drag it around.
It keeps its dimensions, image, angle and shadow. Release to leave it there;
click afterward to animate back to the extraction path and reverse into the deck.
The card is constrained below the header and within the viewport. A grab/grabbing
cursor and tooltip explain the interaction. A movement threshold prevents small
click jitter from turning into a drag, and release does not count as a return click.

Pointer movement uses capture and one transform update per animation frame,
without image requests or per-move geometry reads. Native image dragging is
suppressed for extracted cards. Pointer cancellation, resize, blur, Escape and
selection changes clean up capture, queued frames and pending return animations.
Mobile thumbnail navigation stays unchanged.

Validation: DOM checks for drag/click separation, release suppression, bounds,
capture cleanup, cancellation and stale return completions. Chromium checks cover
real pointer drags to all page edges, unchanged size and neighboring cards, no
new image requests, held/released cursors, click-to-return, small movement and
reduced motion. Held-card screenshot inspected.
