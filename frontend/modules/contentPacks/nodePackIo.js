/**
 * contentPacks/nodePackIo — **THE PACKS ON DISK, FOR NODE** (⛓ CONTENT SETS C3).
 *
 * `loadPackStack` takes `{ base, readJson }` from its caller. A browser passes
 * `fetch`; a headless script or a test passes this: `base` is the committed
 * `frontend/packs/` directory as a `file:` URL (`packsBaseUrl()` already
 * resolves to it outside a bundle), and `readJson` reads a `file:` URL from disk.
 *
 * ⛔ NODE ONLY (it imports `node:fs`). No browser module imports this file.
 */
import { readFileSync } from 'node:fs';

import { packsBaseUrl } from './contentPacks.js';

/** `{ base, readJson }` over the committed packs (or over `base`, a `file:` URL of another packs directory). */
export function nodePackIo({ base = packsBaseUrl() } = {}) {
    return {
        base,
        readJson: async (url) => JSON.parse(readFileSync(new URL(url), 'utf8')),
    };
}
