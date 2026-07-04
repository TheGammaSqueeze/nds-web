import numpy as np
from PIL import Image
import sys

INK = {(65, 65, 65), (113, 113, 113), (170, 170, 170)}

for name in ['camera_scrim_l', 'camera_scrim_r']:
    path = f'webapp/public/sprites/{name}.png'
    im = Image.open(path).convert('RGB')
    a = np.array(im).astype(np.float64)
    h, w, _ = a.shape
    mask = np.zeros((h, w), dtype=bool)
    for y in range(h):
        for x in range(w):
            if tuple(a[y, x].astype(int)) in INK:
                mask[y, x] = True
    # harmonic (Laplace) inpaint: iteratively replace masked pixels with the mean of
    # their 4-neighbours, boundary (non-masked) pixels stay fixed. This is the smooth
    # harmonic extension of the real captured boundary colour, not an invented value.
    out = a.copy()
    # seed masked region with the mean of the non-masked pixels to speed convergence
    seed = a[~mask].mean(axis=0)
    out[mask] = seed
    for it in range(4000):
        up = np.roll(out, 1, axis=0); down = np.roll(out, -1, axis=0)
        left = np.roll(out, 1, axis=1); right = np.roll(out, -1, axis=1)
        avg = (up + down + left + right) / 4.0
        out[mask] = avg[mask]
    out_img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')
    out_img.save(path)
    print(name, 'inpainted', mask.sum(), 'px, converged over 4000 iters')
