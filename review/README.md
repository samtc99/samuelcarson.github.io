# Physical card extraction — review before publishing

Desktop Browse:

1. Hover: peek the top up 20px within the existing stack.
2. First click: slide the card up 80px total, still behind cards in front.
3. Second click: visibly pull the same card up and out over 780ms, with no zoom,
   image replacement, separate preview or carousel. Keep its dimensions and border.

The pull starts from the real card position; a progressive mask reveals its
lower portion during the lift, then it settles nearby with a slight tilt.
A hidden matching slot preserves the deck's geometry. Clicking the extracted card
or outside it, Escape, scroll, resize or blur restores the original slot.
Reduced motion skips animation. Mobile navigation remains unchanged.

Validation: DOM/navigation checks plus Chromium checks for intermediate animation
frames, constant dimensions, no extra detail downloads, same-node restoration,
hover/selection geometry, keyboard dismissal and mobile navigation. Motion
screenshots inspected. Production remains unchanged pending approval.
