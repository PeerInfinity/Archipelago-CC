#!/usr/bin/env node
/**
 * probe-seedling-l14-swordless — ⛓ SEEDLING FIDELITY L14 D1: IS A 0-HIT
 * SWORDLESS CROSSING OF L14 POSSIBLE AT ALL? Measured on the model before any
 * rung was built.
 *
 * From the captured swordless arrival (`plan-seedling-l14-swordless.mjs`'s
 * `L14_ARRIVAL_STAGING`, L14 at (160,64)), it plays HAND-AUTHORED key spans
 * through `createRunForStaging` — no solver — and reports, per route: the hits,
 * the tick it crosses to L15, and the tightest box gap to any bob on the way
 * (player box 4x5 from (x-2,y-2); bob box 8x8 centred; gap < 0 is contact).
 *
 *   top-wall   up 45, left 125, down 45, right   — over the pack, down the west wall
 *   straight   left                              — the planner's own line (control)
 *   bottom-wall down 50, left 130, up 45, right  — under the pack, up the west wall
 *
 * Run: node scripts/procgen/probe-seedling-l14-swordless.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = join(HERE, '..', '..', 'frontend', 'modules', 'seedlingDemo');

export const ROUTES = Object.freeze({
    'top-wall': [['up', 45], ['left', 125], ['down', 45], ['right', 60]],
    straight: [['left', 300]],
    'bottom-wall': [['down', 50], ['left', 130], ['up', 45], ['right', 60]],
});

/** The Chebyshev gap between the player's 4x5 box and a bob's 8x8 box. */
export function boxGap(px, py, bx, by) {
    const gx = Math.max(bx - 4 - (px + 2), px - 2 - (bx + 4));
    const gy = Math.max(by - 4 - (py + 3), py - 2 - (by + 4));
    return Math.max(gx, gy);
}

async function main() {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { L14_ARRIVAL_STAGING } = await import('./plan-seedling-l14-swordless.mjs');
    const levelSource = atlasLevelSource();
    for (const [name, spans] of Object.entries(ROUTES)) {
        const run = createRunForStaging(JSON.parse(JSON.stringify(L14_ARRIVAL_STAGING)), levelSource,
            { scratchPersistence: true });
        let t = 0;
        let tight = { gap: Infinity };
        let crossed = null;
        outer: for (const [key, n] of spans) {
            for (let i = 0; i < n; i += 1) {
                const { x, y } = run.state;
                for (const c of run.chasers) {
                    const gap = boxGap(x, y, c.x, c.y);
                    if (gap < tight.gap) tight = { gap, t, id: c.id, at: [x, y], body: [c.x, c.y] };
                }
                run.advance(new Set([key]));
                t += 1;
                if (run.playerHits.length > 0) break outer;
                if (run.level !== 14) { crossed = { t, level: run.level }; break outer; }
            }
        }
        const hit = run.playerHits[0] ?? null;
        console.log(`${name.padEnd(11)} ${hit ? `HIT t${hit.t} by ${hit.id}` : 'no hit'}; `
            + `${crossed ? `crosses to L${crossed.level} on t${crossed.t}` : `still in L14 at t${t}`}; `
            + `tightest gap ${tight.gap.toFixed(2)} px (t${tight.t}, ${tight.id}, player `
            + `(${tight.at?.map((v) => v.toFixed(1))}) body (${tight.body?.map((v) => v.toFixed(1))}))`);
    }
}

if (isEntryPoint(import.meta.url)) await main();
