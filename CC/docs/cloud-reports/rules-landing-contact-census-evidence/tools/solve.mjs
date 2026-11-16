#!/usr/bin/env node
// rules-landing-contact-census: the SOLVER's plans for L73's two rock crossings on a room with the runner moved.
//   node solve.mjs <x>,<y>|vanilla|delivered [--arms=sword,fire] [--dir=north,south] [--out=<dir>]
// north: the L72 door's landing (32,128) -> the L74 door (64,0); south: the L74 door's landing (64,16) -> the L72
// door (32,144). The rows are FIREBREAK_RULES_REFUSED's `rules-l73-north`/`-south` (the same goals and rock), with
// the arm's item; the solver call is `fidelityFireBreak.fireBreakPlan`'s, on the PATCHED level source.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const { SEEDLING_SET_PATCHES, patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { FIREBREAK_RULES_REFUSED, FIREBREAK_SWITCHES, fireBreakStaging } = await M('fidelityFireBreak.js');
const { twoPassSolve } = await M('twoPassSolve.js');
const { createRunForStaging } = await M('tapeRunner.js');
const { withContactFidelity } = await M('contactFidelity.js');
const { buildStagedTape } = await M('botDriverV1.js');
const MAP = JSON.parse(readFileSync(join(R, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const spot = process.argv[2];
const { patchesFor } = await import('./author.mjs');
// 'delivered' = the committed table; 'vanilla' = without the L73 row (runner at 72,24); 'x,y' = the row moved there
export const patches = patchesFor(spot);
const levelSource = levelSourceFromAtlas(patchedMapDocument(MAP, patches));
const OUT = arg('out');
if (OUT) mkdirSync(OUT, { recursive: true });
const ITEM = { sword: 'hasSword', fire: 'hasFire' };
for (const dir of arg('dir', 'north,south').split(',')) for (const arm of arg('arms', 'sword').split(',')) {
    const base = FIREBREAK_RULES_REFUSED.find((r) => r.name === `rules-l73-${dir}`);
    const w = { ...base, name: `l73-${dir}-${arm}-${spot.replace(',', '-')}`, items: [ITEM[arm]] };
    const staging = await fireBreakStaging(w);
    const t0 = Date.now();
    try {
        const solved = await withContactFidelity(FIREBREAK_SWITCHES, () => twoPassSolve({
            makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
            goals: w.goals, name: w.name, boot: staging.boot, dashMode: 'all', persistence: staging.persistence ?? [], log: () => {},
        }));
        const tape = buildStagedTape({ staging: { ...staging, persistence: solved.persistence, equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
            perTick: [...solved.out.perTick, ...Array.from({ length: 8 }, () => new Set())], name: w.name });
        const breaks = solved.out.records.filter((r) => r.strategy === 'break' || r.verb === 'break').map((b) => `${b.target} ${b.weapon} t${b.pressedAt}`);
        if (OUT) writeFileSync(join(OUT, `${w.name}.tape.json`), JSON.stringify({ ...tape, description: `rules-landing-contact-census: the solver's ${dir} crossing of L73 with ${arm}, runner at ${spot}` }));
        console.log('SOLVE', JSON.stringify({ spot, dir, arm, verdict: 'PLANNED', ticks: solved.out.perTick.length, breaks, ms: Date.now() - t0 }));
    } catch (e) {
        console.log('SOLVE', JSON.stringify({ spot, dir, arm, verdict: 'REFUSED', refusal: String(e.message).split('\n')[0].slice(0, 1200), ms: Date.now() - t0 }));
    }
}
