# Desktop card preview — review before publishing

Open the interactive preview link in the draft pull request on a desktop browser.
It uses the existing live photographs, mobile copies and thumbnails from
`https://samtc.me/photo/`; no new image files are uploaded with this change.

- Use the Shuffle icon beside the grid button to jump to another photograph,
  centered in the usable viewport below the header.
- The main masonry cards lift slightly on hover without changing their positions.
- Open Browse and hover a thumbnail for a larger, fully opaque, uncropped preview.
- Move onto the raised preview and click it, or click the original thumbnail, to
  open the full-size viewer. Closing returns to your overview selection and scroll
  position. Mouse hover and keyboard focus both support the preview.
- Quick pointer exits, scrolling and resizing dismiss the preview; late image
  loads cannot reopen old cards. Header controls remain accessible.
- Mobile thumbnail taps keep their existing jump-to-deck behavior.

The pull now starts at the thumbnail's actual position and grows with a uniform
scale and a gentle easing curve. Moving away returns it toward the source;
reentering reverses that return smoothly. The photo stays opaque throughout,
and loading a sharper image does not restart the movement.

Fifty-three DOM/navigation/animation-state checks cover these interactions and the previous mobile
features. They do not measure actual browser frame timing or replace visual pointer review. This
branch has not been published to the production website.
