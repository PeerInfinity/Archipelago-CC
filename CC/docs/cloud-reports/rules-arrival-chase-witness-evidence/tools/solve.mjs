#!/usr/bin/env node
// rules-arrival-chase-witness: the SOLVER from a door landing (the game's own arrival staging, `fidelityArrival`'s
// `arrivalStaging`) to one exit, on the DELIVERED (patched) level source, under FIREBREAK's contact switches.
//   node solve.mjs <level>:<x>:<y> <exitX>:<exitY> [--chest] [--items=hasSword,…] [--name=…] [--out=<dir>]
// --chest: the goal is `collect-placement` at (exitX, exitY), a chest's OEL coordinates
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const { SEEDLING_SET_PATCHES, patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { FIREBREAK_SWITCHES } = await M('fidelityFireBreak.js');
const { arrivalStaging } = await M('fidelityArrival.js');
const { twoPassSolve } = await M('twoPassSolve.js');
const { createRunForStaging } = await M('tapeRunner.js');
const { withContactFidelity } = await M('contactFidelity.js');
const { buildStagedTape } = await M('botDriverV1.js');
const MAP = JSON.parse(readFileSync(join(R, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const levelSource = levelSourceFromAtlas(patchedMapDocument(MAP, [...SEEDLING_SET_PATCHES]));
const [level, x, y] = process.argv[2].split(':').map(Number);
const [ex, ey] = process.argv[3].split(':').map(Number);
const items = (arg('items', '') || '').split(',').filter(Boolean);
const name = arg('name', `L${level}-${x}-${y}-to-${ex}-${ey}-${items.join('+') || 'none'}`);
const OUT = arg('out');
if (OUT) mkdirSync(OUT, { recursive: true });
const staging = arrivalStaging({ level, x, y }, { items });
const goals = [process.argv.includes('--chest') ? { kind: 'collect-placement', placement: { x: ex, y: ey } } : { kind: 'reach-exit', exit: { x: ex, y: ey } }];
const t0 = Date.now();
try {
    const solved = await withContactFidelity(FIREBREAK_SWITCHES, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals, name, boot: staging.boot, dashMode: 'all', persistence: staging.persistence ?? [], log: () => {},
    }));
    const tape = buildStagedTape({ staging: { ...staging, persistence: solved.persistence, equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
        perTick: [...solved.out.perTick, ...Array.from({ length: 8 }, () => new Set())], name });
    if (OUT) writeFileSync(join(OUT, `${name}.tape.json`), JSON.stringify({ ...tape, description: `rules-arrival-chase-witness: the solver's plan ${name}` }));
    console.log('SOLVE', JSON.stringify({ name, verdict: 'PLANNED', ticks: solved.out.perTick.length,
        verbs: (solved.out.records ?? []).map((r) => `${r.verb ?? r.strategy}${r.target ? ':' + r.target : ''}@${r.pressedAt ?? r.t ?? ''}`).slice(0, 30), ms: Date.now() - t0 }));
} catch (e) {
    console.log('SOLVE', JSON.stringify({ name, verdict: 'REFUSED', refusal: String(e.message).split('\n').slice(0, 3).join(' | ').slice(0, 1500), ms: Date.now() - t0 }));
}
