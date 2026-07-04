// DSi Web BIOS - main orchestrator: asset loading, state machine, frame loop.
import { DSScreen, fitDevice } from './screen.js';
import { Assets } from './assets.js';
import { AudioManager } from './audio.js';
import { Input } from './input.js';
import { Fonts } from './font.js';
import { AppRegistry } from './apps.js';
import { Launcher, FAV_NAMES } from './launcher.js';
import { TopScreen } from './topscreen.js';
import { BootSequence } from './boot.js';
import { SettingsApp } from './settings.js';
import { System } from './system.js';
import { BOOT } from './config.js';

// boot -> menu hand-off timing, RE'd against out/wfa/carousel_entrance (2D grid
// search of hand-off frame + fade decay per screen, tools/_sweep4.mjs and
// tools/_sweep_top.mjs): the top screen clears the white earlier and slower
// than the bottom's icon cascade.
const TOP_HANDOFF = 52, TOP_DECAY = 28;

const top = new DSScreen('top');
const bottom = new DSScreen('bottom');
const audio = new AudioManager();
const input = new Input();
const reg = new AppRegistry();

let state = 'loading';
let boot, launcher, topscreen;
let startNow = false;

async function loadAssets() {
  // the svg manifest must be ready before any image loads so scale>1 only fetches real .svg files
  await Assets.loadSvgManifest();
  // decoded real launcher backgrounds
  await Promise.all([
    Assets.loadImage('bg_launcher_d', 'public/bg/launcher_D_BG01.png'),
    Assets.loadImage('bg_launcher_u', 'public/bg/launcher_U_BG00.png'),
    Assets.loadImage('bg_photo_u', 'public/bg/photo_U.png'),
    // boot fallback frames + static
    Assets.loadImage('boot_hs', 'public/boot/healthsafety.png'),
    Assets.loadImage('boot_hs_touch', 'public/boot/healthsafety_touch.png'),
    Assets.loadJSON('hs_triangle', 'public/boot/hs_triangle.json'),
    Assets.loadJSON('logo_parts', 'public/boot/logo_parts.json'),
    Assets.loadJSON('logo_anim', 'public/boot/logo_anim.json'),
    Assets.loadImage('boot_logo_final', 'public/boot/logo_final.png'),
  ]);
  // boot logo frames
  const fp = [];
  for (let i = 0; i < BOOT.logoFrames; i++) fp.push(Assets.loadImage('boot_top_' + i, `public/boot/top_${String(i).padStart(3, '0')}.png`));
  await Promise.all(fp);
  // sprites manifest (named cells)
  await loadSprites();
  await Fonts.load();
  await reg.loadDefault();
}

async function loadSprites() {
  // expects public/sprites/map.json: { name: "file.png", ... }
  const map = await Assets.loadJSON('spritemap', 'public/sprites/map.json').catch(() => null);
  if (map) await Promise.all(Object.entries(map).map(([name, file]) => Assets.loadImage('spr_' + name, 'public/sprites/' + file)));
  // launch/loading sparkle ring (real seq02 cells 53..88)
  const ring = [];
  for (let c = 53; c <= 88; c++) ring.push(Assets.loadImage('ring_' + c, `public/sprites/launcher_d/cell_${String(c).padStart(2, '0')}.png`));
  await Promise.all(ring);
  // real status-bar battery sprites (normal/low/charge; volume uses spr_volIcon
  // above via the map.json cell_10_base entry, and there is no "high" battery
  // state in the real firmware's status bar, only normal/low/charging)
  await Promise.all(
    ['full', 'low', 'charge'].map((s) => Assets.loadImage('spr_batt_' + s, `public/sprites/spr_batt_${s}.png`))
  );
  // carousel selection frame, one variant per favColor (RE'd msk_launcher_D.ncer
  // cell_00/cell_02 through each msk_launcher_D_UC0B.NCLR bank, see
  // tools/extract-launcher-selframe-colors.js)
  const selFrame = [];
  for (const name of FAV_NAMES) {
    selFrame.push(Assets.loadImage('spr_selFramePlain_' + name, `public/sprites/launcher_d/cell_00_${name}.png`));
    selFrame.push(Assets.loadImage('spr_selFrame_' + name, `public/sprites/launcher_d/cell_02_${name}.png`));
  }
  await Promise.all(selFrame);
}

function setupInput() {
  input.bindTouch(bottom.canvas);
  // Browser autoplay policy: the AudioContext starts suspended until a user gesture. Unlock it on
  // the very first interaction of ANY kind (not only a touch on the bottom canvas), so the boot
  // chime and BGM become audible even when the user's first action is a key press or a click
  // elsewhere. resume() replays anything deferred while the context was still locked.
  const unlockAudio = () => audio.resume();
  ['pointerdown', 'mousedown', 'touchstart', 'keydown'].forEach(ev =>
    window.addEventListener(ev, unlockAudio, { capture: true }));
  // volume keys (the DSi has physical volume buttons): - / [ lower, = / ] raise
  window.addEventListener('keydown', (e) => {
    if (e.key === '-' || e.key === '[') { audio.resume(); System.adjustVolume(-1); audio.play('nav', { gain: 0.8 }); }
    else if (e.key === '=' || e.key === '+' || e.key === ']') { audio.resume(); System.adjustVolume(1); audio.play('nav', { gain: 0.8 }); }
  });
  input.on((action, data) => {
    audio.resume();
    if (state === 'menu') {
      if (action === 'press') {
        // LEFT/RIGHT hold-repeat works in both normal and grab mode (holdNav routes
        // to move / moveGrabbed). In grab mode A OR DOWN drops/confirms (verified
        // out/rearr d_after: DOWN drops the tile and returns a settled row, same as A).
        // B does NOTHING in grab mode (verified out/rearr b_after: the tile stays lifted).
        if (data === 'left') launcher.holdNav(-1);
        else if (data === 'right') launcher.holdNav(1);
        else if (launcher.grabbing()) {
          if (data === 'A' || data === 'down') launcher.dropGrabbed();
        } else {
          if (data === 'up') launcher.grabIcon();
          else if (data === 'A' || data === 'START') launcher.launch();
        }
      } else if (action === 'release') {
        if (data === 'left') launcher.endNav(-1);
        else if (data === 'right') launcher.endNav(1);
      } else if (action === 'touch') { menuTouchDown(data); }
      else if (action === 'touchmove') { menuTouchMove(data); }
      else if (action === 'release-touch') { menuTouchUp(data); }
    } else if (state === 'boot') {
      if (action === 'press' || action === 'touch') boot.proceed();
    } else if (state === 'settings') {
      if (settingsExit) return;   // input locked during the exit whiteout
      if (action === 'press' || action === 'release') settingsApp.handle(action, data);
      else if (action === 'touch') settingsApp.touch(data);
    } else if (state === 'app') {
      if (action === 'press' && (data === 'B' || data === 'SELECT' || data === 'START')) returnToMenu();
    }
  });
}

// Carousel touch: L/R arrow taps, scrollbar tap/drag, and drag-scroll of the
// carousel, plus tap-a-slot to select / tap-centre to launch. Zones from the
// measured geometry: scrollbar band y170..191 (arrows x0..18 / x237..255,
// channel x19..236), carousel drag band y78..165, launch footprint y84..150.
let touchDrag = null;
function menuTouchDown({ x, y }) {
  const L = launcher;
  if (L.grabbing()) return;   // already in a rearrange grab; ignore new touch-downs
  if (y >= 170 && y <= 191) {
    if (x <= 18) { L.move(-1); L.pressArrow(-1); touchDrag = { mode: 'arrowL' }; return; }
    if (x >= 237) { L.move(1); L.pressArrow(1); touchDrag = { mode: 'arrowR' }; return; }
    // Pill left = clamp(19+5*camera) (max 208 so the 29px pill's right pixel lands x236).
    const thumbLeft = Math.max(19, Math.min(208, Math.round(19 + 5 * L.camera)));
    if (x >= thumbLeft && x < thumbLeft + 29) {
      // GRAB the pill: it tracks the finger 1:1 (centre-snap, RE'd scrollbar_thumb_drag).
      // centre = 33 + 5*camera, so camera = (x - 33)/5.
      L.scrub((x - 33) / 5);
      L.thumbHeld = true;   // pill turns pressed light-blue + hides the select frame
      touchDrag = { mode: 'thumb' };
      return;
    }
    // Pressing BLANK track (not the pill): the pill scrolls to that slot with the real
    // DS's FAST momentum (ease-out), not the slow nav slide. scrollTo does the fast glide.
    const slot = Math.max(0, Math.min(L.reg.totalSlots - 1, Math.round((x - 33) / 5)));
    L.scrollTo(slot);
    touchDrag = { mode: 'trackTap' };
    return;
  }
  if (y >= 78 && y <= 165) {
    // Touch-HOLD on the centred launchable icon begins a rearrange grab (drag-drop);
    // a quick tap launches, a drag scrolls. The hold->grab is checked in the frame loop
    // (maybeHoldGrab). melonDS headless cannot capture the touch-hold grab, so the hold
    // time is a UX value; the grab/move/drop animations themselves are the RE'd ones.
    const onCentre = (x >= 100 && x <= 156 && y >= 84 && y <= 150);
    touchDrag = { mode: 'carousel', downX: x, downCamera: L.camera, moved: false,
      grabCand: onCentre, downT: (typeof performance !== 'undefined' ? performance.now() : 0) };
  }
}
// Called each menu frame: promote a stationary hold on the centred icon into a grab.
function maybeHoldGrab() {
  const L = launcher;
  if (!touchDrag || touchDrag.mode !== 'carousel' || !touchDrag.grabCand || touchDrag.moved || L.grabbing()) return;
  const now = (typeof performance !== 'undefined' ? performance.now() : 0);
  if (now - touchDrag.downT > 400) {
    // grabbed: begin the free content-drag (the ROW then follows the finger 1:1, RE'd).
    if (L.grabIcon()) { L.beginGrabDrag(touchDrag.downX); touchDrag = { mode: 'grabDrag' }; }
    else touchDrag.grabCand = false;   // not grabbable (empty/not settled)
  }
}
function menuTouchMove({ x, y }) {
  if (!touchDrag) return;
  const L = launcher;
  if (touchDrag.mode === 'grabDrag') {
    // free drag: the row tracks the finger 1:1 (grabbed card stays pinned top-centre),
    // holding wherever the finger is; the drop target is the gap nearest centre (RE'd).
    L.dragGrabbed(x);
    return;
  }
  if (touchDrag.mode === 'carousel') {
    const dx = x - touchDrag.downX;
    // jitter tolerance: a small wobble during the hold still grabs (>8px = a real scroll).
    if (Math.abs(dx) > 8) { touchDrag.moved = true; touchDrag.grabCand = false; }
    const prev = L.camera;
    L.scrub(touchDrag.downCamera - dx / 65);
    touchDrag.vel = L.camera - prev; // camera units this move ~ per-frame velocity
  } else if (touchDrag.mode === 'thumb') {
    // keep the thumb centre under the finger (absolute 1:1 follow, RE'd model).
    L.scrub((x - 33) / 5);
  }
}
function menuTouchUp({ x, y }) {
  const L = launcher; L.pressArrow(0);
  const d = touchDrag; touchDrag = null;
  if (!d) return;
  // release: snap the row to the nearest gap (SOFT_SET) then fall + commit via update().
  if (d.mode === 'grabDrag') { L.releaseGrabDrag(); return; }
  if (d.mode === 'carousel') {
    if (d.moved) L.flingScrub(d.vel || 0);
    else {
      const slot = L.pixelToSlot(x);
      if (slot === L.selected && y >= 84 && y <= 150) L.launch();
      else L.selectAt(slot);
    }
  } else if (d.mode === 'thumb') {
    L.thumbHeld = false;   // released: pill returns to glossy white, frame can return
    L.snap();
  }
}

let launchedApp = null;
let enterFade = 0;      // white->content fade after a launch/boot (kills the hard cut)
let enterFadeRate = 6;  // per-second decay; ~10f for app launch, ~18f for boot->menu
// independent top-screen fade for the boot->menu hand-off only (see TOP_HANDOFF
// below): the real top and bottom screens clear the white on different frames,
// so a single shared enterFade cannot fit both. Stays null for every other
// transition (launch/settings-exit), which mirror enterFade on both screens.
let enterFadeTop = null, enterFadeRateTop = 0;
let settingsExit = null;   // settings -> carousel exit ramp (after "Yes")
// Begin the exit: hold, fade to dark, then whiteout, then re-enter the carousel.
// RE'd out/settings_trans/exit: after Yes the screen dims to the bare bg then
// MASTER_BRIGHTs to pure white, and the launcher replays its intro from white.
function beginSettingsExit() { if (!settingsExit) settingsExit = { t: 0 }; }
function returnToMenu() {
  audio.stopSettingsBgm();
  state = 'menu';
  launchedApp = null;
  settingsApp = null;
  enterFade = 1; enterFadeRate = 60 / 18;   // fade the carousel up from the exit white
  launcher.startIntro();
  audio.startAmbiance();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (typeof window !== 'undefined' && window.__pauseLoop) { requestAnimationFrame(frame); return; }

  if (state === 'boot') {
    boot.update(dt);
    boot.draw(top, bottom);
    // The real top screen clears the boot white ~9f before the bottom (RE'd
    // out/wfa/carousel_entrance: separate 2D grid searches per screen against
    // tools/_sweep4.mjs (bottom) and tools/_sweep_top.mjs (top) found bottom
    // hand-off=61f/decay=21f but top hand-off=52f/decay=28f). So while still in
    // the 'boot' state, once past the top's own hand-off frame, paint the real
    // top screen under its own decaying white overlay - overwriting boot.draw's
    // held-white top - while the bottom keeps showing the boot H&S screen until
    // its later hand-off below.
    if (boot.phase === 'entering' || boot.phase === 'done') {
      const n = boot.frame - boot.enterStart;
      if (n >= TOP_HANDOFF) {
        topscreen.draw(top);
        const aTop = Math.max(0, Math.min(1, 1 - (n - TOP_HANDOFF) / TOP_DECAY));
        if (aTop > 0) { top.c.fillStyle = `rgba(255,255,255,${aTop})`; top.c.fillRect(0, 0, 256, 192); }
      }
    }
    // boot ends on a white flash; fade the carousel up from that white so the
    // hand-off is a smooth cross-fade, not a hard cut. Decay rate RE'd against
    // out/wfa/carousel_entrance (see renderBootEnter's DECAY=21). enterFadeTop
    // picks up continuously from whatever alpha the top's own curve above had
    // reached at this exact hand-off frame.
    if (boot.done) {
      state = 'menu';
      const n = boot.frame - boot.enterStart;
      enterFade = 1; enterFadeRate = 60 / 21;
      enterFadeTop = Math.max(0, Math.min(1, 1 - (n - TOP_HANDOFF) / TOP_DECAY)); enterFadeRateTop = 60 / TOP_DECAY;
      launcher.startIntro(); audio.startAmbiance();
    }
  } else if (state === 'menu') {
    maybeHoldGrab();   // promote a stationary touch-hold on the centred icon into a grab
    const r = launcher.update(dt);
    if (r && r.launched) {
      // The launch animation finished THIS frame: launcher.update() already cleared
      // `launching`, so drawing the launcher now would paint the bare carousel with
      // no whiteout for one frame (a visible flash between scenes). Instead hold the
      // screen fully white (continuous with the completed whiteout) and hand off;
      // enterApp() arms enterFade so the destination fades up from this white.
      top.c.fillStyle = bottom.c.fillStyle = '#fff';
      top.c.fillRect(0, 0, 256, 192); bottom.c.fillRect(0, 0, 256, 192);
      enterApp(r.launched);
    } else {
      topscreen.draw(top);
      launcher.draw(bottom);
      // the launch whiteout covers BOTH screens; the top fade is applied here since
      // topscreen.draw does not know about the launch (RE'd: top brightens from f6).
      if (launcher.launching) launcher.drawLaunchWhite(top, true);
      applyEnterFade(dt);
    }
  } else if (state === 'settings') {
    settingsApp.update(dt);
    settingsApp.drawTop(top);
    settingsApp.drawBottom(bottom);
    if (settingsExit) {
      settingsExit.t += dt * 60;
      const t = settingsExit.t;
      const dark = Math.max(0, Math.min(0.55, (t - 30) / 22 * 0.55));   // fade to bare-bg dark
      const white = Math.max(0, Math.min(1, (t - 52) / 32));            // then MASTER_BRIGHT to white
      for (const sc of [top, bottom]) {
        if (dark > 0 && white < 1) { sc.c.fillStyle = `rgba(0,0,0,${dark * (1 - white)})`; sc.c.fillRect(0, 0, 256, 192); }
        if (white > 0) { sc.c.fillStyle = `rgba(255,255,255,${white})`; sc.c.fillRect(0, 0, 256, 192); }
      }
      if (t >= 86) { settingsExit = null; returnToMenu(); }
    } else {
      applyEnterFade(dt);
    }
  } else if (state === 'app') {
    drawAppShell();
    applyEnterFade(dt);
  }
  requestAnimationFrame(frame);
}

let settingsApp = null;
function enterApp(app) {
  launchedApp = app;
  audio.stopAmbiance();
  enterFade = 1; enterFadeRate = 6;   // fade in from the launch white flash (~10f)
  if (app.gamecode === 'HNBE' || /System Settings/i.test(app.name || '')) {
    settingsApp = new SettingsApp(audio, () => beginSettingsExit());
    state = 'settings';
    audio.startSettingsBgm();
    return;
  }
  if (app.onLaunch) { app.onLaunch({ top, bottom, returnToMenu }); }
  state = 'app';
}

// white cross-fade after a launch, so content fades up from the launch flash
// instead of a hard cut (kills the white->black/dark pop). Top and bottom
// normally mirror the same curve (enterFade); the boot->menu hand-off is the
// one exception, where enterFadeTop drives the top independently (see
// TOP_HANDOFF) because the real screens clear the white on different frames.
function applyEnterFade(dt) {
  if (enterFadeTop !== null) {
    if (enterFadeTop > 0) {
      top.c.fillStyle = `rgba(255,255,255,${Math.min(1, enterFadeTop)})`;
      top.c.fillRect(0, 0, 256, 192);
    }
    enterFadeTop -= dt * enterFadeRateTop;
    if (enterFadeTop <= 0) enterFadeTop = null;
  } else if (enterFade > 0) {
    top.c.fillStyle = `rgba(255,255,255,${Math.min(1, enterFade)})`;
    top.c.fillRect(0, 0, 256, 192);
  }
  if (enterFade > 0) {
    bottom.c.fillStyle = `rgba(255,255,255,${Math.min(1, enterFade)})`;
    bottom.c.fillRect(0, 0, 256, 192);
    enterFade -= dt * enterFadeRate;
  }
}

function drawAppShell() {
  // generic placeholder for launched apps (real sub-apps plug in via onLaunch)
  top.clear('#f6f6f6'); bottom.clear('#f6f6f6');
  const f = Fonts.m;
  if (launchedApp) {
    f.drawCentered(top.c, launchedApp.name || 'App', 128, 80, '#fff');
    f.drawCentered(bottom.c, 'Press B to return', 128, 90, '#888');
  }
}

async function main() {
  fitDevice();
  document.getElementById('hud').textContent = 'loading...';
  await audio.load().catch(() => {});
  System.attachAudio(audio);
  System.initBattery();
  await loadAssets();
  boot = new BootSequence(audio);
  // debug/verification hook only (?favColor=0..15), same pattern as screen.js's
  // ?scale=N: the real profile default is 11 (blue), the only colour melonDS
  // ground truth exists for on this NAND, until a shared profile object plumbs
  // in the user's actual chosen colour (see Launcher constructor comment).
  const favColor = (() => { const n = parseInt(new URLSearchParams(location.search).get('favColor'), 10); return Number.isInteger(n) && n >= 0 && n <= 15 ? n : 11; })();
  launcher = new Launcher(reg, audio, favColor);
  topscreen = new TopScreen({ username: 'User', favColor });
  setupInput();
  state = 'boot';
  document.getElementById('hud').textContent = '';
  // expose for verification harness + modular API
  window.DSi = { reg, launcher, audio, topscreen, get state() { return state; }, set state(s) { state = s; }, boot,
    skipBoot() { state = 'menu'; },
    seekBootFrame(n) { if (boot) { boot.frame = n; boot.phase = n >= BOOT.touchPromptAt + 30 ? 'wait' : 'boot'; } state = 'boot'; },
    setSlot(n) { launcher.selected = n; launcher.camera = n; launcher.targetCamera = n; launcher.tCursor = 1; launcher.sliding = false; launcher.slideFrom = n; launcher.cameraStart = undefined; launcher.snapNameFade(); },
    renderIntro(n) { window.__pauseLoop = true; launcher.intro = { frame: n }; topscreen.draw(top); launcher.draw(bottom); },
    // render a mid-slide frame: a nav slide from `from` toward `to` with the camera
    // parked at `cam` (fractional). Used to pixdiff the clone against real navR frames.
    // render a specific launch-animation frame t (frames since the A press) for
    // the default slot, to pixdiff the clone against real out/anim/launch frames.
    renderLaunch(t) {
      window.__pauseLoop = true; window.__freezeAnim = 0;
      launcher.intro = null;
      const sel = reg.defaultSlot;
      launcher.selected = sel; launcher.camera = sel; launcher.targetCamera = sel;
      launcher.sliding = false; launcher.slideFrom = sel;
      launcher.launching = { t, app: reg.get(sel), slot: sel };
      topscreen.draw(top); launcher.draw(bottom); launcher.drawLaunchWhite(top, true);
    },
    // render the boot 'touch to continue' -> carousel hand-off at n frames since
    // the touch (n=0 matches out/boot m_0000.bot.ppm). Mirrors the real per-screen
    // model in frame()/applyEnterFade: the bottom holds white through its own
    // hand-off (default 61f) then the icon cascade fades up over 21f; the top
    // clears earlier (default 52f) and fades up over 28f (both AE-minimized
    // against out/wfa/carousel_entrance, tools/_sweep4.mjs + _sweep_top.mjs).
    // Direct analytic parameter, same style as renderLaunch(t)/renderIntro(n),
    // for pixdiff vs the real captures.
    renderBootEnter(n, tune = {}) {
      window.__pauseLoop = true; window.__freezeAnim = 0;
      launcher.launching = null;
      // _drawHealth/_drawLogo key off the ABSOLUTE frame counter (touchPromptAt,
      // pulse phase), not the time since touch; BASE matches scripts/boot_capture.txt
      // (760f wait + tap's 3f touch-hold = the real frame the recording starts at,
      // out/boot m_0000.bot.ppm) so the prompt content/pulse phase lines up too.
      const BASE = 763;
      const HANDOFF = tune.handoff || 61;
      const DECAY = tune.decay || 21;
      const HANDOFF_TOP = tune.handoffTop || TOP_HANDOFF;
      const DECAY_TOP = tune.decayTop || TOP_DECAY;
      const aTopAt = (nn) => Math.max(0, Math.min(1, 1 - (nn - HANDOFF_TOP) / DECAY_TOP));
      if (n < HANDOFF) {
        boot.enterStart = BASE; boot.frame = BASE + n; boot.phase = 'entering'; boot.done = false;
        launcher.intro = null;
        boot.draw(top, bottom);
        if (n >= HANDOFF_TOP) {
          topscreen.draw(top);
          const aTop = aTopAt(n);
          if (aTop > 0) { top.c.fillStyle = `rgba(255,255,255,${aTop})`; top.c.fillRect(0, 0, 256, 192); }
        }
      } else {
        boot.phase = 'done'; boot.done = true;
        const k = n - HANDOFF;
        launcher.intro = { frame: k };
        topscreen.draw(top); launcher.draw(bottom);
        const aBot = Math.max(0, Math.min(1, 1 - k / DECAY));
        const aTop = aTopAt(n);
        if (aTop > 0) { top.c.fillStyle = `rgba(255,255,255,${aTop})`; top.c.fillRect(0, 0, 256, 192); }
        if (aBot > 0) { bottom.c.fillStyle = `rgba(255,255,255,${aBot})`; bottom.c.fillRect(0, 0, 256, 192); }
      }
    },
    renderCam(from, to, cam) {
      window.__pauseLoop = true; window.__freezeAnim = 0;
      launcher.intro = null; launcher.launching = null;
      launcher.slideFrom = from; launcher.selected = to;
      launcher.targetCamera = to; launcher.camera = cam;
      launcher.sliding = (cam !== to); launcher.tCursor = (cam === to) ? 1 : 0;
      launcher.snapNameFade();
      topscreen.draw(top); launcher.draw(bottom);
    },
    // frame-by-frame motion driver: seat at `slot` settled, then step the REAL
    // launcher.update()/draw() one frame per call so the slide/thumb motion is the
    // clone's true per-frame behaviour (for comparison vs melonDS recordings).
    seatAt(slot) {
      window.__pauseLoop = true; window.__freezeAnim = 0;
      launcher.intro = null; launcher.launching = null; launcher.grab = null; launcher.fling = null;
      launcher.selected = slot; launcher.camera = slot; launcher.targetCamera = slot;
      launcher.sliding = false; launcher.slideFrom = slot; launcher.scrubbing = false;
      launcher.snapNameFade();
      topscreen.draw(top); launcher.draw(bottom);
    },
    moveL() { launcher.move(-1); },
    moveR() { launcher.move(1); },
    stepFrame(dt = 1 / 60) { launcher.update(dt); topscreen.draw(top); launcher.draw(bottom); return launcher.camera; },
    // render the icon-rearrange (grab) mode settled, insertion cursor offset by `move`
    renderGrab(move = 0) {
      window.__pauseLoop = true; window.__freezeAnim = 0;
      launcher.intro = null; launcher.launching = null;
      const sel = reg.defaultSlot;
      launcher.selected = sel; launcher.camera = sel; launcher.targetCamera = sel;
      launcher.sliding = false; launcher.slideFrom = sel; launcher.grab = null;
      launcher.grabIcon();
      if (launcher.grab) { launcher.grab.liftT = 1; launcher.grab.insertPos += move; launcher.grab.rowCam = launcher.grab.insertPos; }
      topscreen.draw(top); launcher.draw(bottom);
    },
    renderGrabDrop(t) {
      window.__pauseLoop = true; window.__freezeAnim = 0;
      launcher.intro = null; launcher.launching = null;
      const sel = reg.defaultSlot;
      launcher.selected = sel; launcher.camera = sel; launcher.targetCamera = sel;
      launcher.sliding = false; launcher.slideFrom = sel; launcher.grab = null;
      launcher.grabIcon();
      if (launcher.grab) { launcher.grab.liftT = 1; launcher.grab.rowCam = launcher.grab.insertPos; launcher.grab.drop = { t }; }
      topscreen.draw(top); launcher.draw(bottom);
    },
    openSettings() { settingsApp = new SettingsApp(audio, () => beginSettingsExit()); state = 'settings'; audio.startSettingsBgm(); return settingsApp; },
    drawSettings() { window.__pauseLoop = true; settingsApp.drawTop(top); settingsApp.drawBottom(bottom); },
    get settings() { return settingsApp; },
    ready: true };
  requestAnimationFrame(frame);
}
window.__loaded = true;
console.log('main.js loaded');
main().catch(e => { window.__err = String(e && e.stack || e); console.error('main() failed:', e); });
