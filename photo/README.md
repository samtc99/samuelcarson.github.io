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

The gallery reserves the full layout before downloading images and reveals each
image after decoding. Image downloads do not move other cards or reshuffle them.
The lightbox follows the same photo order.

When changing the gallery scripts or stylesheet, update their `?v=` values in
`index.html` together so browsers fetch the matching files.
