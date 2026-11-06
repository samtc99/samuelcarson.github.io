# Mobile deck — review only

This branch contains an interactive review page, not a production update.

Open `mobile-deck.html` through the preview link in the draft pull request, or
download that HTML file and open it in your browser. Use a phone or a narrow
window to see the deck. A wider window keeps the masonry layout.

The page includes the gallery styles, navigation code, and photo list. It loads
the existing original photographs directly from `https://samtc.me/photo/images/`.
No photographs, thumbnails, or new image copies are uploaded by this review
commit. The contact sheet may load more slowly because it uses the originals.

## Smoothness revision

- Cards reserve each photograph's actual height, capped for tall portraits;
  landscape photos no longer leave full-screen empty blocks below them.
- The deck uses natural momentum scrolling with a consistent 16px gap instead of
  mandatory snapping. Resize handling preserves the visible offset.
- Shuffle keeps the current photo and offset in place and moves existing image
  elements, preserving decoded images. The balanced order also survives reloads.
- Closing the same full-screen photo restores the previous partial scroll
  position. Advancing the viewer retains its decoded frame until the next loads.
- Tests now model mixed image heights and real scroll limits, including the last
  photo, aborted decodes, failure recovery, and repeated reshuffling (26 checks).

Review the deck scrolling, Shuffle, Browse, thumbnail jumps, full-screen viewer,
returning to your place, and phone rotation. The finished production build and
smaller image copies remain local until their upload is approved. Do not merge
this review-only pull request to publish the new layout; the production changes
will be submitted after review and approval.
