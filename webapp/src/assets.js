// Asset loader: images (icons, sprites, bg, font atlases), audio, and JSON data.
import { RENDER_SCALE } from './screen.js';

export const Assets = {
  images: {},
  data: {},
  audioBuffers: {},
  svgManifest: null,     // Set of png urls that have an .svg sibling (public/svg_manifest.json)
  _audioCtx: null,

  // Load the SVG manifest once so the scale>1 loader only requests .svg for assets that
  // actually have one - instead of trying (and 404ing) a .svg for every PNG, which added
  // hundreds of failed requests and seconds of load time at scale>1.
  async loadSvgManifest() {
    if (this.svgManifest || RENDER_SCALE === 1) return;
    try { const r = await fetch('public/svg_manifest.json'); this.svgManifest = new Set(await r.json()); }
    catch { this.svgManifest = new Set(); }
  },

  // At RENDER_SCALE>1, prefer a lossless SVG re-encode of static UI chrome (crisp at
  // any scale) when one exists next to the PNG; native scale=1 always uses the exact
  // PNG so the melonDS-verified byte-identical pipeline never changes. Only assets listed
  // in the manifest get the .svg request (no 404 fallback churn for the rest).
  loadImage(key, url) {
    const svgUrl = (RENDER_SCALE > 1 && /\.png$/i.test(url) && this.svgManifest && this.svgManifest.has(url))
      ? url.replace(/\.png$/i, '.svg') : null;
    return new Promise((resolve) => {
      const img = new Image();
      const loadPng = () => {
        img.onload = () => { this.images[key] = img; resolve(img); };
        img.onerror = () => { console.warn('missing image', url); resolve(null); };
        img.src = url;
      };
      if (svgUrl) {
        img.onload = () => { this.images[key] = img; resolve(img); };
        img.onerror = loadPng;
        img.src = svgUrl;
      } else loadPng();
    });
  },

  async loadJSON(key, url) {
    try { const r = await fetch(url); this.data[key] = await r.json(); }
    catch (e) { console.warn('missing json', url, e); this.data[key] = null; }
    return this.data[key];
  },

  async loadAudio(key, url, ctx) {
    try {
      const r = await fetch(url);
      const buf = await r.arrayBuffer();
      this.audioBuffers[key] = await ctx.decodeAudioData(buf);
    } catch (e) { console.warn('missing audio', url, e); }
  },

  img(key) { return this.images[key] || null; },
};
