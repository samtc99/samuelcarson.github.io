# Photography gallery

Photos are mixed into a stable order using `shoot` and optional `look` groups in
`photos.js`. A large shoot is spread throughout the gallery, and its outfits or
poses are mixed separately. Reloading the page keeps the same order.

To add a photo:

1. Put the image in `photo/images/`.
2. Add an entry to `PHOTO_COLLECTION` in `photo/photos.js`:

   ```js
   { file: "new-photo.jpg", width: 2000, height: 3000, shoot: "new-session", look: "outdoors" },
   ```

3. Use the image's actual pixel dimensions. Reuse the same `shoot` name for
   photos from one session. `look` is optional and separates outfits or poses
   within a shoot. Optional `title`, `alt`, `meta`, and `tag` fields customize
   captions, descriptions, and filtering.

4. Generate the smaller mobile copies and contact-sheet thumbnails:

   ```sh
   python3 -m pip install Pillow
   python3 photo/tools/make-previews.py
   ```

   Include `photo/previews/` and `photo/thumbs/` in the commit. Originals are
   preserved. If a small copy is missing, the gallery falls back to the original.

On phones the gallery becomes a vertical deck with native momentum scrolling, an
active-photo counter, Shuffle, and a full-screen contact sheet. Thumbnails jump
directly to the corresponding photo. Tapping a photo opens the original in a
native modal viewer; closing it returns to the photo being viewed. Portrait and
landscape originals retain their proportions and use their actual height, with a
consistent gap between photos. Desktop keeps the masonry layout.

Shuffle jumps immediately to a randomly selected, different photograph. It keeps
the balanced deck order and existing image elements intact. The deck's order and
current photo are saved in session storage for this tab.
Storage failures do not block navigation. Phone landscape uses the deck on touch
devices; larger tablets and desktops use masonry. Reduced-motion preferences are
respected. Keyboard users can use arrow keys in the deck, thumbnail browser, and
full-screen viewer; native dialogs handle Escape and focus containment.

The gallery reserves card positions before decoding images. Downloads do not move
other cards or reshuffle the collection. The viewer follows the same photo order.

## Desktop card hover

A single Shuffle icon beside Browse jumps to a random photograph outside the
current viewport when possible, centered below the sticky header.

Browse thumbnails lift 20px on mouse hover or keyboard focus, without resizing
or moving neighboring cards. The existing cached thumbnail stays visible and
opaque; hovering starts no detail-image downloads or decodes. Cards keep their
border and original isolated stacking order, so cards in front continue to cover
the lifted card. Only its top edge peeks farther out.
Reduced-motion preferences disable the transition.

On desktop, the first click slides the existing thumbnail card 80px upward within
the stack, preserving size and stack order. The second click animates that same
card up and out, progressively revealing it as it clears the deck. It keeps its
border and dimensions; no zoom, separate preview or carousel is introduced.
The second click requests the optimized higher-resolution detail copy at high priority and
keeps the thumbnail visible until decoding succeeds. The swap never restarts
motion; late results are ignored after return or selection changes. A failed
request leaves the thumbnail usable. Hover and first click load no detail. A matching hidden slot preserves the deck layout.
The reveal mask lives on an inner card surface, while a stable outer drop shadow
follows that surface throughout the pull. Transform and mask animations share a
start time; the shadow is not clipped away during motion.
A third click reverses the live extraction and reveal animations, then lowers
the card from its 80px-raised pose back into the stack in one sequence. Clicking
while the outward pull is still running reverses from that exact progress.
Repeated return clicks do not restart the animation. Outside clicks, Escape,
scroll, resize and blur still restore immediately to keep navigation responsive. Reduced motion skips extraction animation.
The main feed's original photograph viewer remains available from feed photos.
Mobile keeps its native document scrolling and thumbnail-to-feed navigation.

## Review without publishing

`review/mobile-deck.html` is an interactive, single-file review page using the same
CSS, photo collection, and application code as `photo/`. By default it loads the
already-published original photographs. Download and open it in a browser, or open the review link in
the pull request. It does not change the production website. To rebuild it:

```sh
python3 photo/tools/build-review.py
```

## Checks

```sh
cd photo/tests
npm ci
npm test
```

These checks exercise the DOM and navigation state using jsdom, with controlled
image decoding and viewport measurements. They do not emulate native touch
scrolling or browser painting. Before approving, review both the mouse hover
behavior on desktop and the mobile scrolling, spacing, orientation, and dialogs.

When changing the gallery scripts or stylesheet, update their `?v=` values in
`index.html` together so browsers fetch the matching files.

## Mobile page scrolling

The mobile gallery uses native document scrolling (`data-document-deck` on the
entry page), with a sticky header and fixed bottom controls. Shuffle, Browse
jumps, current-photo tracking and viewer return use document coordinates.
Card heights stay stable across browser-bar height changes; width changes
remeasure the layout. Dynamic viewport units fill the available space.

The user confirmed this version allows Safari's bars to retract on iOS 27.2.
The locked-root contained scroller remains covered by regression tests but is
not enabled in the gallery entry page. The approved fine dark photo edge and
raised-card shadow are included.

## Overview image quality

All overview cards use the optimized higher-resolution preview from their first
render, rather than the small contact-sheet thumbnail. Lazy loading and async
decoding are retained. The card geometry and overlapping layout remain unchanged.
Extraction reuses an already decoded image; it only retries decoding if needed.
Missing previews retain the existing fallback to the original photograph.
