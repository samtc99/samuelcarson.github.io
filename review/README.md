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
