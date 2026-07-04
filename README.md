# DSi Web BIOS

A pixel-exact web reimplementation of the Nintendo DSi System Menu (the launcher
carousel) and its System Settings, built from the real decompiled firmware and
verified against a headless build of melonDS.

**Live:** https://thegammasqueeze.github.io/nds-web/

At native scale the render is byte-identical to melonDS; add `?scale=2/3/4` (or `?4x`) for a
crisp, resolution-independent render that swaps the low-res bitmap UI for redrawn vector (SVG)
assets. The hosted page defaults to 4x. Touch/click the bottom screen to interact (arrow keys
and A/B also work); audio starts on first interaction.

## What is here

- `webapp/` - the app. `index.html` loads `src/main.js` (an ES module). `src/launcher.js`
  is the carousel, `src/settings.js` is the System Settings app, `src/boot.js` the boot
  animation, `src/topscreen.js` the top screen. `public/` holds the decoded fonts,
  sprites, icons and audio.
- `tools/` - the Node decoders and the verification harness (asset decoders, `pixdiff.js`,
  the Playwright capture scripts, the animation measurement tools).
- `scripts/` - melonDS headless scripts used to capture reference frames and RAM dumps.

## What is not here

The DSi BIOS, firmware and NAND image are copyrighted Nintendo system files and are not
committed (`bin/`). The melonDS build, the raw extracted firmware assets and the large
reference captures are excluded too (see `.gitignore`); the web app ships with the decoded
assets it needs under `webapp/public/`.

## Run it

    ./start.sh          # serves on port 8080
    ./start.sh 9000     # or a port of your choice

Then open the printed URL in a browser.

## Approach

Every element (asset, geometry, animation timing, transition) is sourced from the real
firmware, not from screenshots. The loop is: read the real code or asset first, capture
ground truth from melonDS, then compare with `tools/pixdiff.js`. Animation curves are
reverse-engineered by dumping melonDS MainRAM frame by frame (for example the carousel
scroll accumulator) rather than eyeballing the framebuffer.
