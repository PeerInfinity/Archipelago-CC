/**
 * mazeRoom/drawOpRecorder — **THE ONE RECORDING 2D CONTEXT**, and the one hash
 * of its log.
 *
 * ⛓ Written for CONSTRUCTIVE-MODE slice 3's pixel gate and LIFTED here by
 * PROCGEN ELEMENTS arc 1 slice 3, when a SECOND draw (`mazeAreaOverlay`) needed
 * the same instrument. ⛔ ONE OF EVERYTHING: a second recorder would be a
 * second answer to *"what counts as a draw operation"*, and the answer is what
 * both gates rest on. It moved rather than being copied, and
 * `mazeRoomRender.test.js`'s seven captured hashes are unchanged across the
 * move — which is the check that it really was a move.
 *
 * ── ⛓ WHY THE LOG IS THE PIXELS ──────────────────────────────────────
 *
 * `vitest.config.js` runs `environment: 'node'` with no jsdom and no `canvas`
 * package, so nothing here can rasterise and `getImageData` is unavailable at
 * any price. This records every context CALL and every property ASSIGNMENT in
 * order — the state mutations as well as the geometry — so equal logs on
 * equal-sized canvases paint equal pixels: the log is a SUPERSET of what
 * determines the raster, and therefore a STRICTER gate than a pixel hash.
 *
 * ⛔ AND IT **THROWS ON A MEMBER IT DOES NOT MODEL**. A recorder that returned
 * `undefined` for an unmodelled method would drop that operation out of the
 * log, which is a hole in the very check that exists to find holes.
 *
 * ⚠ A TEST INSTRUMENT: no page imports it, and `check-maze-lab.mjs`'s module
 * walk over `lab.html` does not reach it.
 */

import { createHash } from 'node:crypto';

const PROPS = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font',
    'textAlign', 'textBaseline', 'lineCap', 'lineJoin'];
const METHODS = ['fillRect', 'strokeRect', 'save', 'restore', 'setLineDash', 'beginPath',
    'arc', 'fill', 'stroke', 'moveTo', 'lineTo', 'closePath', 'fillText', 'clearRect', 'rect'];

export function recordingContext() {
    const log = [];
    const target = { __log: log };
    for (const m of METHODS) {
        target[m] = (...args) => {
            log.push(`${m}(${args.map((a) => JSON.stringify(a)).join(',')})`);
        };
    }
    const store = {};
    return new Proxy(target, {
        get(t, key) {
            if (key === '__log') return log;
            if (typeof key === 'symbol') return undefined;
            if (key in t) return t[key];
            if (PROPS.includes(key)) return store[key];
            throw new Error(`recordingContext: unknown ctx member GET "${String(key)}" — an `
                + 'operation this recorder does not model would drop out of the log, which '
                + 'is a hole in the gate rather than a passing run.');
        },
        set(t, key, value) {
            if (!PROPS.includes(key)) {
                throw new Error(`recordingContext: unknown ctx member SET "${String(key)}".`);
            }
            store[key] = value;
            log.push(`${key}=${JSON.stringify(value)}`);
            return true;
        },
    });
}

/** The one hash of a log — 32 hex characters of its sha256. */
export const hashOf = (log) => createHash('sha256').update(log.join('\n')).digest('hex').slice(0, 32);
