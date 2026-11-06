# Desktop card preview — review before publishing

Open the interactive preview link in the draft pull request on a desktop browser.
It uses the existing live photographs, mobile copies and thumbnails from
`https://samtc.me/photo/`; no new image files are uploaded with this change.

- Use the Shuffle icon beside the grid button to jump to another photograph,
  centered in the usable viewport below the header.
- The main masonry cards lift slightly on hover without changing their positions.
- Open Browse and hover a thumbnail for a larger, fully opaque, uncropped preview.
- Click a thumbnail or raised preview to close Browse and return to the same
  photograph, centered and focused in the main feed.
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

The page also requests a dark browser color scheme with its existing matching
theme color and an explicit root background. Review on samtc.me in iPhone Safari
after approval: the preview host can have different browser tint treatment.
Safari controls its translucent browser bars; the page cannot force their color.
