/**
 * ⛓ SEEDLING FIDELITY L100LATTICE (wave 36) — the slow row: route survey step 172 (L12 → L83), a mover of
 * `fineStanceWalk`. `fineWandStance`'s stance (40,888) under `magicallock@32,864` was reached OFF by STANCE_REENTRY's
 * axis-aligned 8 px walk (1301 t, no dash asked); ON the walk to it is planned on the 8 px lattice first, a free
 * corridor whose whole-chain dash is certified (`spinnerDashWhole`), 1066 t. ~60 s of the solve is that certificate
 * (measured, `CC/docs/cloud-reports/seedling-fidelity-l100lattice.md`), hence this tier. The plan IS the p4g witness
 * `fixtures/l100lattice-witness/step172-on.json` (its 0 px replay row is in `fidelityL100Lattice.test.js`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { withContactFidelity } from './contactFidelity.js';
import { solveSegment } from './solverBot.js';
import { DEFAULT_DASH_MODE } from '../../../scripts/procgen/dashMode.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const W172 = JSON.parse(readFileSync(join(HERE, 'fixtures', 'l100lattice-witness', 'step172-on.json'), 'utf8'));
const runOf = (tape) => createRunForStaging(solveStaging(stagingFromTape(parseTape({ ...tape, inputs: [], tick_count: 0, equips: [] }))),
    atlasLevelSource());
const tapeKeys = (tape) => Array.from({ length: tape.tick_count }, (_, t) => (tape.inputs ?? [])
    .filter((i) => i.from <= t && t < i.to).map((i) => i.key).sort().join('+'));

describe('L100LATTICE — step 172 (L12 → L83): the wand stance walked on the 8 px lattice (fineStanceWalk)', () => {
    it('OFF: STANCE_REENTRY\'s axis-aligned fine walk, 1301 t; ON: the FINE_STANCE walk, 1066 t, key for key the witness', () => {
        const solve = (on) => withContactFidelity({ fineStanceWalk: on }, () => solveSegment({ run: runOf(W172.tape),
            goals: [{ kind: 'reach-exit', exit: { x: 32, y: 848 } }], name: 'l12', boot: W172.tape.boot,
            dashMode: DEFAULT_DASH_MODE }));
        const off = solve(false);
        expect(off.perTick).toHaveLength(1301);
        expect(off.fineLatticeWalks.map((w) => w.refused)).toEqual(['STANCE_REENTRY wand(magicallock@32,864)#0']);
        const on = solve(true);
        expect(on.perTick.map((k) => [...k].sort().join('+'))).toEqual(tapeKeys(W172.tape));
        expect(on.fineLatticeWalks.map((w) => [w.tick, w.aim.x, w.aim.y, w.refused.slice(0, 11)]))
            .toEqual([[0, 40, 888, 'FINE_STANCE']]);
    }, 300_000);
});
