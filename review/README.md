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

Safari tint refinement: mobile header and bottom controls now use sticky edge
positioning with opaque site backgrounds; the root background is also supplied
before the external stylesheet loads. Based on WebKit's edge tint behavior:
https://bugs.webkit.org/show_bug.cgi?id=301756

The preview pull now lasts 480ms with a gentler initial acceleration and a 320ms
return, preserving the existing current-position reversal and reduced motion.
Native iPhone Safari tint and rendered animation still need visual review.

## Card finish study and Safari isolation

`card-finishes.html` compares Current, A (thin dark edge), B (stronger shadow),
and C (edge + shadow) using the real gallery, images and hover animation.
Regenerate after building the main review page:

```sh
python3 photo/tools/build-card-study.py
```

These are review-only treatments; production CSS is unchanged. C is the proposed
balance for pale photographs: a fine dark edge inside the image plus a grounded
shadow for the raised card.

`safari-tint.html` isolates normal document scrolling versus contained scrolling,
with fixed opaque dark edge surfaces. It displays local browser information and
computed colors without transmitting it. The user reports iOS 27.2 and confirms
having tested the latest preview. Safari 27.2 availability is confirmed at:
https://webkit.org/blog/18515/webkit-features-for-safari-27-2/
No physical iPhone or iOS simulator was available to reproduce the white chrome.
The cause remains unconfirmed until these isolation modes are compared on-device.
