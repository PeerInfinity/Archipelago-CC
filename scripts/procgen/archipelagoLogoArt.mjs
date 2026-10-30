// The Archipelago logo at 64×64 for the `archipelago` art pack (⚖ R17, the Cloudberry plan):
// Archipelago's application icon `data/icon.png` (512×512, MIT — this repository's root
// LICENSE) reduced by an 8×8 box filter, alpha-weighted so the transparent surround does not
// darken the edge. Drawn about 1:1 by the Cloudberry page's check coins at its 1280 buffer, where
// the Seedling fork's 16×16 copy reads as a blob. The 16×16 key stays as it is (Seedling draws it).
//
// An AUTHORED row of `extract-seedling-art-packs.mjs` (whose `--check` gates it): the bytes are
// computed here, not copied. PNG decoding is exact (inflate), the reduction is integer arithmetic
// and the encoder writes STORED deflate blocks (`rgbaPngBytes`), so the bytes depend on
// `data/icon.png` alone — no zlib version, no platform.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodePng } from './extract-seedling-masks.mjs';
import { rgbaPngBytes } from './make-seedling-font.mjs';
import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const LOGO_SOURCE = 'data/icon.png';
export const LOGO64_FILE = 'ArchipelagoLogo64.png';
export const LOGO64_SIZE = 64;

/** The 64×64 RGBA pixels (straight alpha) from the icon's bytes. */
export function logo64Pixels(iconBytes = readFileSync(join(REPO_ROOT, LOGO_SOURCE))) {
    const { width, height, rgba } = decodePng(iconBytes, LOGO_SOURCE);
    const n = LOGO64_SIZE;
    if (width !== height || width % n !== 0) throw new Error(`${LOGO_SOURCE}: ${width}x${height} is not a square multiple of ${n}`);
    const f = width / n;
    const px = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            let r = 0; let g = 0; let b = 0; let a = 0;
            for (let dy = 0; dy < f; dy++) {
                for (let dx = 0; dx < f; dx++) {
                    const i = ((y * f + dy) * width + (x * f + dx)) * 4;
                    const al = rgba[i + 3];
                    r += rgba[i] * al; g += rgba[i + 1] * al; b += rgba[i + 2] * al; a += al;
                }
            }
            const o = (y * n + x) * 4;
            if (a > 0) {
                px[o] = Math.floor((r + a / 2) / a);
                px[o + 1] = Math.floor((g + a / 2) / a);
                px[o + 2] = Math.floor((b + a / 2) / a);
            }
            px[o + 3] = Math.floor((a + (f * f) / 2) / (f * f));
        }
    }
    return { w: n, h: n, px };
}

export function logo64Bytes() {
    const { w, h, px } = logo64Pixels();
    return rgbaPngBytes(w, h, px);
}

/** The pack row (`authored`: built by `logo64Bytes()`, not copied from a checkout). */
export const LOGO64_ART_ROW = Object.freeze({
    pack: 'archipelago', key: 'archipelago:pickup/item-64', file: LOGO64_FILE, origin: [32, 32],
    authored: `scripts/procgen/archipelagoLogoArt.mjs — ${LOGO_SOURCE} (512x512, MIT) by an 8x8 box filter`,
    sheetBytes: logo64Bytes,
    as3: 'not drawn by Seedling (it draws archipelago:pickup/item); the Cloudberry page\'s check coins (check-look.js)',
});
