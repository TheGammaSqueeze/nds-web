// Top-screen camera scrim panels (L/Camera bottom-left, Camera/R bottom-right).
// Confirmed by exhaustive search (tools/_camtest2.mjs) against the melonDS reference
// (assets/reference/idle.top.ppm, y171..191): the "L Camera"/"Camera R" ink is not
// baked art, it is the real Fonts.m bitmap glyphs for the plain word "Camera" (an
// icon-codepoint prefix/suffix was tried and lost the search; plain text won outright),
// rendered as the DSi's fixed opaque 2bpp anti-alias ramp. Search found an
// exact pixel match (0 extra, 0 missed, every ink pixel's level correct) for:
//   L: ' Camera' at local (4,3), levels {1:170,2:113,3:65} (grays)
//   R: 'Camera ' at local (5,3), same levels
// The panel itself (translucent grey gradient with the background line texture
// showing through) is the real captured pixels with the text ink harmonically
// inpainted back out (tools/camscrim_build.mjs + tools/camscrim_inpaint.py), stored
// as webapp/public/sprites/camera_scrim_l.png / _r.png, so scale=1 draws the same
// bytes as before (image blit + opaque glyph replace) and scale>1 gets a crisp
// vector-font "Camera" (via font.js's pickFont) over a lossless SVG panel.
export const CAM_TEXT_L = { str: ' Camera', x: 4, y: 3 };
export const CAM_TEXT_R = { str: 'Camera ', x: 5, y: 3 };
export const CAM_LEVELS = { 1: [170, 170, 170], 2: [113, 113, 113], 3: [65, 65, 65] };
