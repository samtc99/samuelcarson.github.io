# Gallery review — ready for final approval

Open the preview link in draft PR #5. Desktop Browse uses the existing stacked
cards, with these interactions:

1. Hover/focus peeks the top up 20px without changing stack order.
2. First click slides the card 80px upward within the stack.
3. Second click visibly pulls the same card out, preserving its dimensions and
   border. The shadow follows its visible surface throughout the motion.
4. Once settled, drag it with mouse/trackpad or move it with arrow keys. Shift +
   arrows moves faster. The card stays inside the viewport below the header.
   Release leaves it where you put it; a drag release does not return it.
5. Click or press Enter to glide back and reverse both animations into its exact
   slot. Escape starts the same return; a second Escape closes Browse.

All cards start with sharp optimized previews. Activating one prioritizes its
image; decoded images, including original fallbacks, are reused. No separate
zoomed preview or carousel is introduced by these card interactions.

Browse remembers its last selected card and scroll position, with current
selection indicated in the deck. Changing the feed photo resets that selection;
a new viewport width recenters the remembered card. The selection outline/dot is
hidden while extracted so it cannot float above the reveal mask. Accurate
accessible labels and tooltip describe the desktop and mobile actions.

The header matches the feed's 68px height with safe-area padding and a full close
target. Mobile keeps native document scrolling, Shuffle and thumbnail-to-feed
navigation. Reduced motion disables transitions. Pointer cancellation, resizing,
blur and selection changes clean up capture, queued frames and stale completions.

Performance improvements remain: responsive desktop feed image candidates,
cached mobile card positions and skipped unchanged desktop layouts. See
[performance.md](performance.md) for the local measurements and their limits.

Validation: 63 passing DOM/navigation checks. Chromium checks cover extraction,
reverse/lowering, moving shadow, sharp sources, captured dragging at all page
edges, click/drag separation, stable geometry, keyboard movement without scroll,
Escape behavior, remembered position/feed-change reset, image priority, reduced
motion and mobile navigation. Screenshots inspected. Native iPhone Safari has
not been independently tested by the agent.

Production is unchanged until publishing is approved. Rebuild the review with:

```sh
python3 photo/tools/build-review.py --photo-base https://samtc.me/photo --renditions
```
