/**
 * seedlingDemo/hammerVolleyApproach.test — ⛓⛓ SEEDLING HAMMER-PHASE VOLLEY-APPROACH (`VOLLEY_APPROACH`, OFF): LWEIGH's
 * reordered corpse weigh, where its approach into the turret's range is hit by the turret's volley, is rewound to the
 * range's edge and tried again with APPROACH's fork search (`volleyApproachRetry`).
 * The fast rows: the switch ships OFF (and its env name is on the page channel); the retry's nested kill sits under the
 * strategy switch's `kill` gate, before any rewind or fork; a weigh that is not the reordered corpse weigh (a block
 * weigh, the hold fallback with no turret, ICEST's live corpse weigh) is OFF's byte for byte, and nothing is asked.
 * Leg 860 (A5) and the latch chain are `hammerVolleyApproach.train.test.js` (each solve ~2–4 min).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { l40LatchBoot, l40LatchSolve } from './fidelityL40Latch.js';
import { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } from './procgenLevel.js';
import { DEFAULT_BUDGET, bootStaging, collectGoal, solve } from './procgenOracle.js';
import { PRE_SWORD_ITEMS } from './procgenPalette.js';
import { SEEDLING_DEFAULTS } from './procgenSeedling.js';
import {
    VOLLEY_APPROACH, VOLLEY_APPROACH_COUNTS, VOLLEY_APPROACH_DEFAULT, resetVolleyApproachCounts, solveSegment,
    withLatchWeighFirst, withVolleyApproach,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, 'solverBot.js'), 'utf8');

/** `hammerLatchWeigh.test.js`'s `C2-no-block` gadget: a lock, its button, no block (the weigh's hold fallback). */
function solveNoBlockGadget() {
    const START = SEEDLING_DEFAULTS.start;
    let record = emptyLevel({ level: SEEDLING_DEFAULTS.level });
    const walls = [];
    for (let tx = 1; tx <= 8; tx += 1) if (tx !== 4) walls.push({ tx, ty: 5, terrain: 'wall' });
    record = withTerrain(record, walls);
    record = withEntities(record, [
        { type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(7, 8), attrs: { tag: SEEDLING_DEFAULTS.goalTag } },
        { type: 'lock', ...oelAtTile(4, 5), attrs: { tset: '0', tag: '0' } },
        { type: 'button', ...oelAtTile(6, 3), attrs: { tset: '0' } },
    ]);
    const staging = bootStaging({ boot: bootAtTile(record, START.tx, START.ty), items: PRE_SWORD_ITEMS,
        pins: ['dead_frames'] });
    return solve(record, staging, [collectGoal(7 * 16, 8 * 16)], DEFAULT_BUDGET, { name: 'C2-no-block' });
}

/** A solve's answer, comparable (timings and functions dropped). */
const strip = (o) => JSON.stringify(o, (k, v) => (k === 'ms' || typeof v === 'function' ? undefined : v));
const keysOf = (perTick) => perTick.map((k) => [...k].sort().join('+'));

describe('hammer-phase VOLLEY-APPROACH: VOLLEY_APPROACH', () => {
    it('ships OFF, the env alone turns it on, and its env name is on the page\'s switch channel', () => {
        expect(VOLLEY_APPROACH_DEFAULT).toBe(false);
        expect(VOLLEY_APPROACH.enabled).toBe(globalThis.process?.env?.SEEDLING_VOLLEY_APPROACH === '1');
        withVolleyApproach(true, () => expect(VOLLEY_APPROACH.enabled).toBe(true));
        withVolleyApproach(false, () => expect(VOLLEY_APPROACH.enabled).toBe(false));
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_VOLLEY_APPROACH');
    });

    it('the retry\'s nested kill is gated by the strategy switch (`kill`) before any rewind or fork', () => {
        const at = SRC.indexOf('function volleyApproachRetry(');
        expect(at).toBeGreaterThan(0);
        const body = SRC.slice(at, SRC.indexOf('\n}\n', at));
        const gate = body.indexOf("requireVerb('kill', 'weigh:volleyApproachRetry', id);");
        expect(gate).toBeGreaterThan(0);
        expect(body.indexOf('ctx.rewind.to(')).toBeGreaterThan(gate);
        expect(body.indexOf('approachForkTries(')).toBeGreaterThan(gate);
        // asked only where LWEIGH's guard would refuse, and only when APPROACH did not replace the walk
        expect(SRC).toMatch(/const volleyFrom = VOLLEY_APPROACH\.enabled && hitsBeforeStance !== null && approached === null\n\s*&& plan\.resolved\.corpse \? perTick\.length : null;/);
        expect(SRC).toMatch(/if \(volleyFrom !== null && run\.ledger\('playerHits'\)\.length > hitsBeforeStance\) \{\n\s*const retried = volleyApproachRetry\(/);
    });

    it('the weigh\'s hold fallback in a room with no turret (`C2-no-block`): ON = OFF, nothing asked', () => {
        const off = withLatchWeighFirst(true, () => withVolleyApproach(false, solveNoBlockGadget));
        resetVolleyApproachCounts();
        const on = withLatchWeighFirst(true, () => withVolleyApproach(true, solveNoBlockGadget));
        expect(strip(on)).toBe(strip(off));
        expect(VOLLEY_APPROACH_COUNTS.retries).toEqual([]);
    }, 120000);

    it('a block weigh (L16, `r9-solve-16`): ON = OFF, and nothing is asked', async () => {
        const { parseTape } = await import('./tapeFormat.js');
        const { createRunForStaging, solveStaging, stagingFromTape } = await import('./tapeRunner.js');
        const { atlasLevelSource } = await import('./levelSource.js');
        const raw = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'r9-solve-16.json'), 'utf8'));
        const levelSource = atlasLevelSource();
        const ex = levelSource(16).entities.filter((x) => ['stairsup', 'stairsdown', 'teleporter'].includes(x.type)
            && Number(x.attrs?.to) === 18)[0];
        const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(raw))));
        const run = () => solveSegment({ run: createRunForStaging(staging, levelSource),
            goals: [{ kind: 'reach-exit', exit: { x: ex.x, y: ex.y } }], name: 'r9-solve-16', boot: staging.boot,
            dashMode: 'all', forkRun: () => createRunForStaging(staging, levelSource) });
        const off = withLatchWeighFirst(true, () => withVolleyApproach(false, run));
        resetVolleyApproachCounts();
        const on = withLatchWeighFirst(true, () => withVolleyApproach(true, run));
        expect(off.records.some((r) => r.strategy === 'weigh')).toBe(true);
        expect(keysOf(on.perTick)).toEqual(keysOf(off.perTick));
        expect(on.records.map((r) => r.strategy)).toEqual(off.records.map((r) => r.strategy));
        expect(VOLLEY_APPROACH_COUNTS.retries).toEqual([]);
    }, 120000);

    it('ICEST\'s pocket boot ((480,456)): the LIVE corpse weigh (not the reorder) is OFF\'s, SOLVED 4495, nothing asked', async () => {
        const latch = await l40LatchBoot();
        const boot = { ...latch, boot: { ...latch.boot, x: 480, y: 456 } };
        const off = await withLatchWeighFirst(true, () => withVolleyApproach(false, () => l40LatchSolve(boot)));
        resetVolleyApproachCounts();
        const on = await withLatchWeighFirst(true, () => withVolleyApproach(true, () => l40LatchSolve(boot)));
        expect(off.refusal).toBeNull();
        expect(off.out.perTick).toHaveLength(4495);
        expect(keysOf(on.out.perTick)).toEqual(keysOf(off.out.perTick));
        expect(VOLLEY_APPROACH_COUNTS.retries).toEqual([]);
    }, 180000);
});
