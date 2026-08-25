// scripts/procgen/loadJSZipNode.mjs
/**
 * ⛓⛓ **THE VENDORED JSZip, IN NODE — ONE IMPLEMENTATION, TWO ENVIRONMENTS.**
 *
 * EDITOR v3 slice E1c. `frontend/modules/presets/documentBundle.js` takes JSZip
 * as a PARAMETER; the page passes `presetUI.loadJSZip()` (a `<script>` tag), and
 * everything that runs under node — the vitest rows, `check-preset-bundle-load`,
 * `export-seedling-level-set --bundle` — passes this.
 *
 * ── ⛔ WHY NOT `createRequire` ─────────────────────────────────────────
 *
 * The brief called for `createRequire(import.meta.url)('…/jszip.min.js')`, and
 * it **DOES NOT WORK HERE** (measured):
 *
 *   Error: require() of ES Module …/frontend/libs/jszip/jszip.min.js …
 *   jszip.min.js is treated as an ES module file as it is a .js file whose
 *   nearest parent package.json contains "type": "module"
 *
 * The repo's root `package.json` is `"type": "module"`, so every `.js` in the
 * tree is an ES module to node's resolver — including a vendored UMD bundle
 * that is CommonJS. Renaming the vendored file to `.cjs` would break the page's
 * `<script src>` injection, and adding a `jszip` npm dependency would put a
 * SECOND copy of the same library in the tree.
 *
 * ⛓ So the UMD is evaluated the way a `<script>` tag evaluates it: given a
 * `module`/`exports` pair and run. That is not a second implementation of
 * anything — it is the same 97 KB of vendored bytes the browser runs.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The one vendored copy — the same file `presetUI.loadJSZip()` injects. */
export const JSZIP_PATH = join(HERE, '..', '..', 'frontend/libs/jszip/jszip.min.js');

let cached = null;

/**
 * @returns {Function} the JSZip constructor (`3.10.1`, vendored)
 */
export function loadJSZipNode() {
    if (cached) return cached;
    const source = readFileSync(JSZIP_PATH, 'utf8');
    const shim = { exports: {} };
    new Function('module', 'exports', source)(shim, shim.exports);
    const JSZip = shim.exports;
    if (typeof JSZip !== 'function' || typeof JSZip.loadAsync !== 'function') {
        throw new Error(`loadJSZipNode: ${JSZIP_PATH} did not evaluate to the JSZip `
            + 'constructor — the vendored UMD changed shape');
    }
    cached = JSZip;
    return JSZip;
}
