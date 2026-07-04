// AudioManager: plays the real captured DSi sounds (boot chime, ambiance loop,
// nav blip, launch, touch). Web Audio with a user-gesture unlock.
import { Assets } from './assets.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.ambianceSrc = null;
    this.enabled = false;
    this.master = null;
    this.musicDisabled = false;  // carousel music restored (user request 2026-07-04); the loop
                                 // is the real melonDS capture until the launcher SDAT is found
  }
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    // Best-effort autoplay: on repeat visits the browser's media-engagement score lets the
    // context start running without a gesture, so the boot chime plays in sync with the logo.
    // On a cold first visit it stays suspended and unlocks on the first interaction (resume()).
    this._tryResume();
  }
  _tryResume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().then(() => this._onRunning()).catch(() => {});
  }
  // Fired whenever the context becomes (or already is) running: play anything that was queued
  // while it was still suspended by the autoplay policy, so nothing is silently dropped.
  _onRunning() {
    if (this._pendingBoot) { this._pendingBoot = false; this.play('boot'); }
    if (this._wantAmbiance) this.startAmbiance();
    if (this._wantSettingsBgm) this.startSettingsBgm();
  }
  async load() {
    this.init();
    // small SFX (+ the menu-entry intro) load eagerly - startup waits only on these.
    const eager = {
      boot: 'public/audio/boot_chime.wav',
      enter: 'public/audio/menu_enter.wav',
      nav: 'public/audio/nav_blip.wav',
      launch: 'public/audio/app_launch.wav',
      touch: 'public/audio/touch_continue.wav',
      settingsNav: 'public/audio/settings_nav.wav',
      settingsEnter: 'public/audio/settings_enter.wav',
      settingsBack: 'public/audio/settings_back.wav',
    };
    await Promise.all(Object.entries(eager).map(([k, u]) => Assets.loadAudio(k, u, this.ctx)));
    this.enabled = true;
    // the big BGM loops (~16MB combined) load in the BACKGROUND so they never block startup;
    // if the app already wants one by the time it finishes decoding, start it retroactively.
    Assets.loadAudio('ambiance', 'public/audio/menu_ambiance.wav', this.ctx).then(() => { if (this._wantAmbiance) this.startAmbiance(); });
    Assets.loadAudio('settingsBgm', 'public/audio/settings_bgm.wav', this.ctx).then(() => { if (this._wantSettingsBgm) this.startSettingsBgm(); });
  }
  startAmbiance() {
    if (this.musicDisabled) return;   // BGM disabled by user preference; SFX still play
    if (!this.ctx || this.ambianceSrc) return;
    if (!Assets.audioBuffers.ambiance) { this._wantAmbiance = true; return; }  // start when it finishes loading
    this._wantAmbiance = false;
    const src = this.ctx.createBufferSource();
    src.buffer = Assets.audioBuffers.ambiance;
    src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0.7;
    src.connect(g); g.connect(this.master);
    // seamless boot->menu handoff: if the menu-entry BGM intro is still playing, schedule the
    // loop to begin exactly when it ends (they are the same music), so the intro is not cut off
    // by the loop starting over it. Otherwise (settings->menu etc.) start immediately.
    const now = this.ctx.currentTime;
    const at = (this._enterEndsAt && this._enterEndsAt > now) ? this._enterEndsAt : now;
    src.start(at);
    this.ambianceSrc = src;
  }
  stopAmbiance() { this._wantAmbiance = false; if (this.ambianceSrc) { try { this.ambianceSrc.stop(); } catch {} this.ambianceSrc = null; } }
  resume() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().then(() => this._onRunning()).catch(() => {});
    else this._onRunning();
  }
  // The boot chime is auto-triggered by the boot animation before any user gesture. If the
  // context is still suspended (cold visit, autoplay blocked) the sound is dropped, so defer it
  // and play it the instant the context unlocks on the first interaction. On repeat visits the
  // context is already running (see init) and the chime plays in sync with the logo.
  playBootChime() {
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') { this._pendingBoot = true; this._tryResume(); return; }
    this.play('boot');
  }
  play(key, { gain = 1, when = 0 } = {}) {
    if (!this.ctx || !Assets.audioBuffers[key]) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = Assets.audioBuffers[key];
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g); g.connect(this.master);
    const t = this.ctx.currentTime + when;
    src.start(t);
    // the menu-entry sound carries the BGM intro; remember when it ends so the ambiance loop
    // can hand off exactly there (no overlap, no gap) instead of starting on top of it.
    if (key === 'enter') this._enterEndsAt = t + src.buffer.duration;
    return src;
  }

  // Settings BGM: TWL_SETTING_BGM rendered from the firmware sequence data (tools/serender.js),
  // not a recording - so it plays regardless of musicDisabled (that flag covers the recorded
  // carousel ambiance). The wav holds two passes of the piece; the loop region [25.73, 51.20]
  // is the second pass, which carries the first pass's ringing tails for a seamless wrap.
  startSettingsBgm() {
    if (!this.ctx || this.settingsBgmSrc) return;
    if (!Assets.audioBuffers.settingsBgm) { this._wantSettingsBgm = true; return; }  // start when loaded
    this._wantSettingsBgm = false;
    const src = this.ctx.createBufferSource();
    src.buffer = Assets.audioBuffers.settingsBgm;
    src.loop = true; src.loopStart = 25.73; src.loopEnd = 51.20;
    const g = this.ctx.createGain(); g.gain.value = 1.0;
    src.connect(g); g.connect(this.master);
    src.start();
    this.settingsBgmSrc = src;
  }
  stopSettingsBgm() { this._wantSettingsBgm = false; if (this.settingsBgmSrc) { try { this.settingsBgmSrc.stop(); } catch {} this.settingsBgmSrc = null; } }
}
