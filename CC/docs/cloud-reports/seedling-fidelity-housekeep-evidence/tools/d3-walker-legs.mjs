#!/usr/bin/env node
// HOUSEKEEP D3 — the WALKER (`jsRuntimeWalker.createRuntimeWalker`, the producer:walker loop: `planWaypoints` over
// `livePerVisitOpts` every 8 ticks + `driveStepHeld`) driven in node on the MODEL, for every divergence-sweep leg whose
// room holds a BeamTower, `CONTACT_FIDELITY.walkerBeamTowers` OFF vs ON. Model only: the game is the sweep's
// (`producer=walker` dispatch, named in the report). Rows: per leg and arm, the outcome, ticks, the tape's md5, and
// the first tick the two arms' held keys differ.
// Usage: node d3-walker-legs.mjs <rows.jsonl> [--out=<file.json>]
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { createRunForStaging } from '../../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { arrivalStaging } from '../../../../../frontend/modules/seedlingDemo/fidelityArrival.js';
import { patchedMapDocument } from '../../../../../frontend/modules/seedlingDemo/seedlingSetPatches.js';
import { createRuntimeWalker } from '../../../../../frontend/modules/seedlingDemo/jsRuntimeWalker.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';

const rowsPath = process.argv[2];
const out = process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? null;
const ATLAS = patchedMapDocument(loadAtlas());
const SRC = levelSourceFromAtlas(ATLAS);
const towers = new Set(ATLAS.levels.filter((r) => r.entities.some((e) => e.type === 'beamtower')).map((r) => r.level));
const legs = readFileSync(rowsPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    .filter((r) => towers.has(r.level) && /exit:out_teleporter_(\d+)_(\d+)$/.test(r.key));

const walk = (leg, on) => withContactFidelity({ walkerBeamTowers: on }, () => {
    const [, ex, ey] = /exit:out_teleporter_(\d+)_(\d+)$/.exec(leg.key).map(Number);
    const items = [...new Set([...(leg.items ?? []), ...(leg.holding ?? [])].filter((s) => typeof s === 'string'))];
    const run = createRunForStaging(arrivalStaging({ level: leg.level, x: leg.arrive[0], y: leg.arrive[1] }, { items }), SRC);
    const w = createRuntimeWalker({ apItemOf: () => null, isCollected: () => false });
    w.setGoal({ kind: 'exit', level: leg.level, tiles: [[Math.floor(ex / 16), Math.floor(ey / 16)]] });
    w.play();
    const tape = [];
    let end = null;
    for (let t = 0; t < 2400; t += 1) {
        const held = w.heldFor(run);
        if (held === null) { end = `${w.state}${w.reason ? `: ${w.reason}` : ''}`; break; }
        tape.push([...held].sort().join('+'));
        const { transition } = run.advance(held);
        if (transition) { w.observe({ crossing: transition }); end = `crossed to L${transition.to_level ?? transition.to}`; break; }
    }
    return { end: end ?? 'bound', ticks: tape.length, md5: createHash('md5').update(tape.join('\n')).digest('hex').slice(0, 8),
        tape, stats: w.stats };
});

const rows = [];
for (const leg of legs) {
    const a = walk(leg, false);
    const b = walk(leg, true);
    let first = null;
    for (let i = 0; i < Math.max(a.tape.length, b.tape.length); i += 1) if (a.tape[i] !== b.tape[i]) { first = i; break; }
    const row = { id: leg.id, key: leg.key, level: leg.level, off: { end: a.end, ticks: a.ticks, md5: a.md5, plans: a.stats.plans },
        on: { end: b.end, ticks: b.ticks, md5: b.md5, plans: b.stats.plans }, moved: a.md5 !== b.md5, firstDiff: first };
    rows.push(row);
    console.log(JSON.stringify(row));
}
console.log(`SUMMARY: ${rows.length} beam-tower-room legs, ${rows.filter((r) => r.moved).length} moved`);
if (out) writeFileSync(out, JSON.stringify(rows, null, 1));
