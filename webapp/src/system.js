// System state for the status bar: volume and battery, modelled after the DSi.
// Volume drives the audio master gain and the speaker sprite (0 = mute, up to
// 3 waves). Battery reflects the host device via the Battery Status API and
// picks the matching sprite (normal / low / charging).
import { Assets } from './assets.js';

class SystemState {
  constructor() {
    this.maxVolume = 3;
    this.volume = 3;
    this.battery = { level: 1, charging: false };
    this._audio = null;
  }

  attachAudio(audio) { this._audio = audio; this._applyVolume(); }

  _applyVolume() {
    if (this._audio && this._audio.master) {
      // 0.8 is the app's reference master level at full volume
      this._audio.master.gain.value = (this.volume / this.maxVolume) * 0.8;
    }
  }
  setVolume(v) { this.volume = Math.max(0, Math.min(this.maxVolume, v | 0)); this._applyVolume(); return this.volume; }
  adjustVolume(d) { return this.setVolume(this.volume + d); }

  // prefix lets callers pick the sprite family: the launcher top screen uses
  // 'spr_batt_' (light-theme sprite), the Settings top bar uses its own
  // 'spr_settop_batt_' family (dark-theme, see tools/extract-settop-icons.js) -
  // same state logic, different decoded cells.
  batterySprite(prefix = 'spr_batt_') {
    const b = this.battery;
    // charging animation only while actually filling; full on AC shows the
    // normal battery (matches the melonDS reference, which is not charging)
    if (b.charging && b.level < 1) return Assets.img(prefix + 'charge') || Assets.img(prefix + 'full');
    if (b.level <= 0.15) return Assets.img(prefix + 'low') || Assets.img(prefix + 'full');
    return Assets.img(prefix + 'full');
  }

  async initBattery() {
    if (typeof navigator === 'undefined' || !navigator.getBattery) return;
    try {
      const bm = await navigator.getBattery();
      const update = () => { this.battery.level = bm.level; this.battery.charging = bm.charging; };
      update();
      bm.addEventListener('levelchange', update);
      bm.addEventListener('chargingchange', update);
    } catch {}
  }
}

export const System = new SystemState();
