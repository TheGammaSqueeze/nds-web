// Input: keyboard (DS button mapping) + pointer (touchscreen on bottom canvas).
// Emits high-level actions to the active scene.
export class Input {
  constructor() {
    this.listeners = [];
    this.held = new Set();
    this._bindKeys();
  }
  on(fn) { this.listeners.push(fn); }
  emit(action, data) { for (const fn of this.listeners) fn(action, data); }

  _bindKeys() {
    const map = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      x: 'A', z: 'B', s: 'X', a: 'Y',
      q: 'L', w: 'R',
      Enter: 'START', Backspace: 'SELECT', Shift: 'SELECT',
    };
    window.addEventListener('keydown', (e) => {
      const k = map[e.key];
      if (!k) return;
      e.preventDefault();
      if (!this.held.has(k)) { this.held.add(k); this.emit('press', k); }
    });
    window.addEventListener('keyup', (e) => {
      const k = map[e.key];
      if (!k) return;
      this.held.delete(k); this.emit('release', k);
    });
  }

  // bind pointer events on the bottom screen canvas; coords mapped to 0..255,0..191
  bindTouch(canvas) {
    const toLocal = (ev) => {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor((ev.clientX - r.left) / r.width * 256);
      const y = Math.floor((ev.clientY - r.top) / r.height * 192);
      return { x: Math.max(0, Math.min(255, x)), y: Math.max(0, Math.min(191, y)) };
    };
    let down = false;
    canvas.addEventListener('pointerdown', (e) => { down = true; canvas.setPointerCapture(e.pointerId); this.emit('touch', toLocal(e)); });
    canvas.addEventListener('pointermove', (e) => { if (down) this.emit('touchmove', toLocal(e)); });
    const up = (e) => { if (down) { down = false; this.emit('release-touch', toLocal(e)); } };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }
}
