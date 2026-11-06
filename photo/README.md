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

## Desktop previews

A single Shuffle icon beside Browse jumps to a random photograph outside the
current viewport when possible, centered below the sticky header. It avoids page-edge
targets that cannot be centered. It preserves the balanced order and existing
image nodes; the phone Shuffle control stays in the bottom navigation.

Masonry cards lift on mouse hover or keyboard focus while preserving their layout
coordinates and full opacity. In Browse, a brief hover over a thumbnail opens a
larger uncropped preview. That clickable preview sits inside the native dialog,
outside the contact sheet's clipping area, and stays below the header controls.

Clicking either a desktop thumbnail or its raised preview closes Browse and
centers and focuses the same photograph in the main feed. Touch/mobile thumbnail
taps retain their jump-to-deck behavior. Clicking a photograph in the main feed
still opens the original viewer.

The page declares a dark color scheme and matching theme color, with an explicit
root background for Safari's page surroundings. On mobile, the solid header and
bottom controls are sticky at their respective viewport edges so Safari can use
these surfaces for its browser tint. An early inline background avoids sampling
a white page before the stylesheet arrives. Safari controls toolbar rendering;
its translucent address and navigation controls cannot be fully restyled by a page.

Hover requests are canceled on exit, scroll, resize, blur, or viewer entry. A late
image decode cannot reopen an old card. Very short windows omit the raised
preview rather than covering controls. Reduced-motion settings disable the lift
animation; the image and its solid backing stay fully opaque throughout.

The raised card animates from its source thumbnail's real bounds using one
uniform scale and translation (480ms eased pull, 320ms return). A cached thumbnail
can start the pull before the larger image is decoded; that image swaps in
without replaying the animation. Reentering a returning card resumes from its
current visual position. Lifecycle changes cancel motion immediately. Browsers
without Web Animations keep the static preview fallback.

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
