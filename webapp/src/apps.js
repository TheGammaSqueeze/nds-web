// Modular app registry. Seeds from the real NAND-derived layout (data/apps.json)
// but is fully data-driven so custom apps can be defined and placed in any slot.
import { Assets } from './assets.js';

export class AppRegistry {
  constructor() {
    this.slots = [];          // index -> slot descriptor (or null = empty)
    this.totalSlots = 39;
    this.defaultSlot = 17;
  }

  async loadDefault() {
    const data = await Assets.loadJSON('apps', 'data/apps.json');
    this.totalSlots = data.totalSlots;
    this.defaultSlot = data.defaultSlot;
    this.slots = new Array(this.totalSlots).fill(null);
    for (const s of data.slots) {
      if (s.type === 'empty') { this.slots[s.slot] = null; continue; }
      this.slots[s.slot] = this._mk(s);
    }
    // preload icon images + animation sheets
    await Promise.all(this.slots.filter(Boolean).map(async (s) => {
      if (s.icon) s.iconImg = await Assets.loadImage('icon_' + s.id, 'public/' + s.icon);
      if (s.anim) s.animImg = await Assets.loadImage('anim_' + s.id, 'public/' + s.anim);
    }));
  }

  _mk(s) {
    return {
      type: s.type, id: s.id, gamecode: s.gamecode,
      name: s.name || '', publisher: s.publisher || '', lines: s.lines || [s.name],
      icon: s.icon, anim: s.anim, animFrames: s.animFrames || 0, frameDurations: s.frameDurations || [],
      launchable: s.launchable !== false && s.type === 'app',
      // built-in launcher channels (System Settings) render a 48px tile-filling icon
      fillTile: s.fillTile === true || s.gamecode === 'HNBE',
      iconImg: null, animImg: null,
      onLaunch: null,
    };
  }

  // ---- modular API: define your own carousel apps ----
  // spec: { slot, name, publisher, iconUrl, animUrl?, animFrames?, frameDurations?, onLaunch? }
  async define(spec) {
    const s = this._mk({
      type: 'app', id: spec.id || ('custom_' + spec.slot), name: spec.name, publisher: spec.publisher,
      lines: spec.lines || [spec.name, spec.publisher].filter(Boolean),
      icon: null, anim: null, animFrames: spec.animFrames || 0, frameDurations: spec.frameDurations || [],
      launchable: true,
    });
    if (spec.iconUrl) s.iconImg = await Assets.loadImage('icon_' + s.id, spec.iconUrl);
    if (spec.animUrl) { s.animImg = await Assets.loadImage('anim_' + s.id, spec.animUrl); s.animFrames = spec.animFrames; }
    s.onLaunch = spec.onLaunch || null;
    this.slots[spec.slot] = s;
    return s;
  }

  get(i) { return (i >= 0 && i < this.totalSlots) ? this.slots[i] : null; }
  isEmpty(i) { return !this.get(i); }

  // The rearrange gesture pulls the icon at `from` out of the sequence of
  // occupied slots and reinserts it before the icon currently at `to`. Empty
  // trailing slots are left as-is; the reorder acts on the packed icon list and
  // writes it back so indices stay contiguous from 0.
  reorder(from, to) {
    const items = this.slots.filter(Boolean);
    const app = this.slots[from];
    if (!app) return from;
    const fromIdx = items.indexOf(app);
    let toIdx = Math.max(0, Math.min(items.length - 1, to));
    items.splice(fromIdx, 1);
    items.splice(toIdx, 0, app);
    for (let i = 0; i < this.slots.length; i++) this.slots[i] = i < items.length ? items[i] : null;
    return toIdx;
  }
}
