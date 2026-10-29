/**
 * seedlingDemo/hammerLatchWeigh.test — ⛓⛓ SEEDLING HAMMER-PHASE LWEIGH (`LATCH_WEIGH_FIRST`, OFF): a hold stance
 * inside a live ice turret's range asks the corpse weigh again under the stance hypothesis (`latchWeighFirst`).
 * The fast rows: the switch ships OFF; the weigh's fallback to the hold in a room with no turret (`procgenWeigh`'s
 * `C2-no-block` gadget) and L16's committed solve (a block weigh) are OFF's byte for byte; and ICEST's pocket boot (the
 * latch boot's persistence at (480,456)), whose corpse weigh binds live, is unchanged ON.
 * The latch chain's own rows (each solve ~1–2 min) are `hammerLatchWeigh.slow.test.js`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { l40LatchBoot, l40LatchSolve } from './fidelityL40Latch.js';
import { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } from './procgenLevel.js';
import { DEFAULT_BUDGET, bootStaging, collectGoal, solve } from './procgenOracle.js';
import { PRE_SWORD_ITEMS } from './procgenPalette.js';
import { SEEDLING_DEFAULTS } from './procgenSeedling.js';
import {
    LATCH_WEIGH_FIRST, LATCH_WEIGH_FIRST_COUNTS, LATCH_WEIGH_FIRST_DEFAULT, resetLatchWeighFirstCounts, solveSegment,
    withLatchWeighFirst,
} from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * `procgenWeigh.test.js`'s canonical gadget without its block (`C2-no-block`): a plain lock across the room, its button
 * on the near side and no pushable, so the weigh falls back to the hold. `turret` (a tile) adds a live `iceturret`; the
 * pre-sword inventory holds no Fire, so `deriveCorpseWeigh` has no route ("the inventory has no Fire slot").
 */
function solveNoBlockGadget(turret = null) {
    const START = SEEDLING_DEFAULTS.start;
    let record = emptyLevel({ level: SEEDLING_DEFAULTS.level });
    const walls = [];
    for (let tx = 1; tx <= 8; tx += 1) if (tx !== 4) walls.push({ tx, ty: 5, terrain: 'wall' });
    record = withTerrain(record, walls);
    record = withEntities(record, [
        { type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(7, 8), attrs: { tag: SEEDLING_DEFAULTS.goalTag } },
        { type: 'lock', ...oelAtTile(4, 5), attrs: { tset: '0', tag: '0' } },
        { type: 'button', ...oelAtTile(6, 3), attrs: { tset: '0' } },
        ...(turret ? [{ type: 'iceturret', ...oelAtTile(turret.tx, turret.ty) }] : []),
    ]);
    const staging = bootStaging({ boot: bootAtTile(record, START.tx, START.ty), items: PRE_SWORD_ITEMS,
        pins: ['dead_frames'] });
    return solve(record, staging, [collectGoal(7 * 16, 8 * 16)], DEFAULT_BUDGET, { name: 'C2-no-block' });
}

/** A solve's answer, comparable (timings and functions dropped). */
const strip = (o) => JSON.stringify(o, (k, v) => (k === 'ms' || typeof v === 'function' ? undefined : v));

/** The keys of a solve, comparable (`Set`s as arrays). */
const keysOf = (perTick) => perTick.map((k) => [...k].sort());

describe('hammer-phase LWEIGH: LATCH_WEIGH_FIRST', () => {
    it('ships OFF, and the env alone turns it on', () => {
        expect(LATCH_WEIGH_FIRST_DEFAULT).toBe(false);
        expect(LATCH_WEIGH_FIRST.enabled).toBe(globalThis.process?.env?.SEEDLING_LATCH_WEIGH_FIRST === '1');
        withLatchWeighFirst(true, () => expect(LATCH_WEIGH_FIRST.enabled).toBe(true));
        withLatchWeighFirst(false, () => expect(LATCH_WEIGH_FIRST.enabled).toBe(false));
    });

    it('the weigh falls back to the hold in a room with no turret (`C2-no-block`): ON = OFF, nothing asked', () => {
        const off = withLatchWeighFirst(false, () => solveNoBlockGadget());
        resetLatchWeighFirstCounts();
        const on = withLatchWeighFirst(true, () => solveNoBlockGadget());
        const hold = (off.trace?.rows ?? off.rows ?? []).find((r) => r.strategy?.verb === 'hold');
        expect(hold.rejected.find((r) => r.option === 'weigh').why).toMatch(/no pushable block at all/);
        expect(strip(on)).toBe(strip(off));
        expect(LATCH_WEIGH_FIRST_COUNTS.asked).toEqual([]);
    }, 120000);

    it('the hold stance inside a live turret\'s range, and no corpse route (no Fire): asked, not taken, ON = OFF', () => {
        const turret = { tx: 6, ty: 1 };
        const off = withLatchWeighFirst(false, () => solveNoBlockGadget(turret));
        resetLatchWeighFirstCounts();
        const on = withLatchWeighFirst(true, () => solveNoBlockGadget(turret));
        expect((off.trace?.rows ?? off.rows ?? []).some((r) => r.strategy?.verb === 'hold')).toBe(true);
        expect(strip(on)).toBe(strip(off));
        expect(LATCH_WEIGH_FIRST_COUNTS.asked).toEqual([{ id: 'lock@64,80', t: 0, taken: false, turret: null,
            inRange: ['iceturret@96,16'] }]);
    }, 120000);

    it('the hold stance outside every live turret\'s range: nothing asked, ON = OFF', () => {
        const turret = { tx: 17, ty: 12 };
        const off = withLatchWeighFirst(false, () => solveNoBlockGadget(turret));
        resetLatchWeighFirstCounts();
        const on = withLatchWeighFirst(true, () => solveNoBlockGadget(turret));
        expect((off.trace?.rows ?? off.rows ?? []).some((r) => r.strategy?.verb === 'hold')).toBe(true);
        expect(strip(on)).toBe(strip(off));
        expect(LATCH_WEIGH_FIRST_COUNTS.asked).toEqual([]);
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
        const solve = () => solveSegment({ run: createRunForStaging(staging, levelSource),
            goals: [{ kind: 'reach-exit', exit: { x: ex.x, y: ex.y } }], name: 'r9-solve-16', boot: staging.boot,
            dashMode: 'all' });
        const off = withLatchWeighFirst(false, solve);
        resetLatchWeighFirstCounts();
        const on = withLatchWeighFirst(true, solve);
        expect(off.records.some((r) => r.strategy === 'weigh')).toBe(true);
        expect(keysOf(on.perTick)).toEqual(keysOf(off.perTick));
        expect(on.records.map((r) => r.strategy)).toEqual(off.records.map((r) => r.strategy));
        expect(LATCH_WEIGH_FIRST_COUNTS.asked).toEqual([]);
    }, 120000);

    it('ICEST\'s pocket boot ((480,456), the latch persistence): ON = OFF, SOLVED through the live corpse weigh', async () => {
        const latch = await l40LatchBoot();
        const boot = { ...latch, boot: { ...latch.boot, x: 480, y: 456 } };
        const off = await withLatchWeighFirst(false, () => l40LatchSolve(boot));
        resetLatchWeighFirstCounts();
        const on = await withLatchWeighFirst(true, () => l40LatchSolve(boot));
        expect(off.refusal).toBeNull();
        expect(off.out.perTick).toHaveLength(4495);
        expect(off.out.records[0]).toMatchObject({ strategy: 'weigh', presser: { x: 480, y: 384 },
            corpse: { turret: 'iceturret@472,400' } });
        expect(keysOf(on.out.perTick)).toEqual(keysOf(off.out.perTick));
        expect(LATCH_WEIGH_FIRST_COUNTS.asked).toEqual([]);
    }, 180000);
});
