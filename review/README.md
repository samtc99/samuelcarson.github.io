# Mobile deck — review only

This branch contains an interactive review page, not a production update.

Open `mobile-deck.html` through the preview link in the draft pull request, or
download that HTML file and open it in your browser. Use a phone or a narrow
window to see the deck. A wider window keeps the masonry layout.

The page includes the gallery styles, navigation code, and photo list. The review
branch now includes 106 optimized mobile WebP copies and 106 small thumbnails,
uploaded with the owner's explicit approval for this public review branch.
The preview uses those copies for the mobile deck and overview; the full-screen
viewer uses existing originals from `https://samtc.me/photo/images/`.

## Loading and random-jump revision

- Shuffle now jumps to a different random photo, including when used repeatedly.
  It does not reorder the balanced deck or rebuild loaded image elements.
- Reopening Browse reuses its thumbnail elements and cached images. Thumbnails
  load lazily at low priority; the selected deck photo gets high priority.
- Neighbor warming is limited and respects the browser's data-saving preference.
- The 106 thumbnails total 1,630,004 bytes versus 101,500,960 bytes for originals
  (about 62x smaller). Mobile display copies total 16,712,216 bytes (about 6x smaller).

## Smoothness revision

- Cards reserve each photograph's actual height, capped for tall portraits;
  landscape photos no longer leave full-screen empty blocks below them.
- The deck uses natural momentum scrolling with a consistent 16px gap instead of
  mandatory snapping. Resize handling preserves the visible offset.
- Random navigation keeps the balanced order and image nodes intact; the chosen
  photo and deck order survive reloads.
- Closing the same full-screen photo restores the previous partial scroll
  position. Advancing the viewer retains its decoded frame until the next loads.
- Tests now model mixed image heights and real scroll limits, including the last
  photo, aborted decodes, failure recovery, random-jump boundaries, and cache reuse
  (30 checks).

Review the deck scrolling, Shuffle, Browse, thumbnail jumps, full-screen viewer,
returning to your place, and phone rotation. This draft does not change the
production gallery. Do not merge this review-only pull request to publish the
new layout; production changes will be submitted after review and approval.
