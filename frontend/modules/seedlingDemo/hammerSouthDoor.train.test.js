// ⚖ Robert 2026-11-02 CI manual-only P1: TRAIN tier (was `hammerSouthDoor.slow.test.js`). Runs on js-land/** train pushes and
// on dispatch (`-f train=true`), NOT on a slice push — a solver change that moves this pin reds at the train,
// unless the slice dispatches the train tier first (js-16's packet rule). `npm run test:unit:train`.
/**
 * seedlingDemo/hammerSouthDoor.train.test — ⛓⛓ SEEDLING HAMMER-PHASE SOUTHDOOR (`APPROACH_DOOR`, OFF) on L40LATCH's
 * latch boot (`fixtures/l40latch-witness/latch-boot.json`), under the smallest arm that reaches the approach: CPAIR's
 * size-3 arm + `LATCH_WEIGH_FIRST` + `TURRET_APPROACH`.
 *   - SOUTH of the latched door: the boot re-booted at (488,579), APPROACH's staging point on L40 legs 860/861, with the
 *     latch NOT held (the chest and the tree are banked by the boot's persistence, so the latch pocket is open — on the
 *     arrival legs it is not, which is their next wall, not this file's).
 *     - OFF: APPROACH's refusal on the arrivals, word for word — 12 forks, all `no-plan`, from (488,579).
 *     - ON (+ `FIFTH_ORDER`): the door is discharged first on the live run (the ladder's `hold(wandlock@480,560)` at
 *       `buttonroom@880,768`, the walk ending in the open doorway), the approach kills `iceturret@472,400` hitless from
 *       there, and Boss Key 2 is collected at t4810 on a FRESH run of the model with no hit and no death.
 *   - The latch staging (888,776): the door is open (the latch fades it at t101) before the approach is asked, so a side
 *     plans and nothing is asked — SOLVED 4142, APPROACH's, unchanged ON.
 *   - ICEST's pocket boot (480,456): the corpse weigh binds live (no approach), keys identical ON.
 */
import { describe, expect, it } from 'vitest';

import { l40LatchBoot, l40LatchSolve } from './fidelityL40Latch.js';
import {
    APPROACH_DOOR_COUNTS, CHOOSER_PAIR, TURRET_APPROACH_COUNTS, resetApproachDoorCounts, resetTurretApproachCounts,
    withApproachDoor, withChooserPair, withFifthOrder, withLatchWeighFirst, withTurretApproach,
} from './solverBot.js';

const TURRET = 'iceturret@472,400';
const DOOR = 'wandlock@480,560';

/** Run `fn` with `CHOOSER_PAIR`'s largest set at `size` (CPAIR's measurement arm), restoring it. */
async function withPairSize(size, fn) {
    const was = CHOOSER_PAIR.size;
    CHOOSER_PAIR.size = size;
    try {
        return await fn();
    } finally {
        CHOOSER_PAIR.size = was;
    }
}

/** The latch boot with the player at (x, y) (the header is 8 px off the state); null = the latch staging itself. */
async function bootAt(at) {
    const base = await l40LatchBoot();
    return at ? { ...base, boot: { ...base.boot, x: at.x - 8, y: at.y - 8 } } : base;
}

/** Boss Key 2 from `boot` under CPAIR size 3 + LWF + `TURRET_APPROACH`, `APPROACH_DOOR` at `door`, `FIFTH_ORDER` at `fifth`. */
function arm(boot, door, fifth = false) {
    return withPairSize(3, () => withChooserPair(true, () => withLatchWeighFirst(true, () => withTurretApproach(true,
        () => withApproachDoor(door, () => withFifthOrder(fifth, () => l40LatchSolve(boot)))))));
}

/** Step `perTick` (with `equips`) on a FRESH run of `boot`: hits, deaths, takes, and the door's opening tick. */
async function replay(boot, perTick, equips) {
    const { parseTape } = await import('./tapeFormat.js');
    const { buildTape } = await import('./botDriverV1.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const folded = buildTape(perTick.map((k) => new Set(k)), boot.boot, 'southdoor',
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = parseTape(JSON.stringify({ ...boot, name: 'southdoor', tick_count: perTick.length,
        inputs: folded.inputs, equips: [...(boot.equips ?? []), ...(equips ?? [])] }));
    let run = null;
    let doorAt = null;
    let deadAt = null;
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    for (let r = st.next(); !r.done; r = st.next()) {
        const t = r.value.observation.t;
        if (doorAt === null && run.entities('openActivators').has(DOOR)) doorAt = t;
        if (deadAt === null && run.entities('turrets').get(TURRET).dead) deadAt = t;
    }
    return { hits: run.playerHits.map((h) => ({ t: h.t, source: h.source, id: h.id })), deaths: run.playerDeaths.length,
        collected: run.ledger('collected').map((c) => ({ t: c.t, keyType: c.keyType ?? c.tag ?? null })), doorAt, deadAt };
}

const SOUTH = { x: 488, y: 579 };

describe('hammer-phase SOUTHDOOR on the latch boot (slow)', () => {
    it('OFF, south of the latched door: APPROACH\'s refusal on the arrival legs — 12 forks, all no-plan, from (488,579)', async () => {
        resetApproachDoorCounts();
        const r = await arm(await bootAt(SOUTH), false);
        expect(r.out).toBeNull();
        expect(r.refusal.message).toContain(`-> weigh: no approach to ${TURRET} from the staging point (488,579) is `
            + 'hitless — 12 fork(s), {"no-plan":12}: up corridor, wait 0: no corridor to (488,445)');
        expect(APPROACH_DOOR_COUNTS.doors).toEqual([]);
    }, 900000);

    it('ON, south of the latched door: the door\'s hold first, the approach from the doorway, Boss Key 2 hitless at t4810 on a fresh run', async () => {
        resetApproachDoorCounts();
        resetTurretApproachCounts();
        const boot = await bootAt(SOUTH);
        const r = await arm(boot, true, true);
        expect(r.refusal).toBeNull();
        expect(r.out.perTick).toHaveLength(4810);
        // the door: asked at t0 from the staging point, discharged by the ladder's hold, the walk ending in the doorway
        expect(APPROACH_DOOR_COUNTS.doors).toEqual([{ door: DOOR, side: 'up', cell: { x: 488, y: 568 }, turret: TURRET,
            t: 0, ticks: 1368, open: true }]);
        const hold = r.out.records.find((x) => x.strategy === 'hold');
        expect(hold.presser).toEqual({ tag: 'buttonroom', x: 880, y: 768, t: 3 });
        expect(hold.opened).toEqual([DOOR]);
        // the approach: one, after the door, from the doorway
        expect(TURRET_APPROACH_COUNTS.approaches).toEqual([expect.objectContaining({ turret: TURRET, t: 1632,
            side: 'right' })]);
        // ⚖ 30(c): the plan's keys on a FRESH run of the model
        const seen = await replay(boot, r.out.perTick.map((k) => [...k]), r.out.equips);
        expect(seen.hits).toEqual([]);
        expect(seen.deaths).toBe(0);
        expect(seen.collected).toEqual([{ t: 4810, keyType: 2 }]);
        expect(seen.doorAt).toBeLessThan(1368);
        expect(seen.deadAt).toBeGreaterThan(1368);
    }, 1200000);

    it('the latch staging (the near side once the latch has faded the door): SOLVED 4142 ON, nothing asked', async () => {
        resetApproachDoorCounts();
        resetTurretApproachCounts();
        const r = await arm(await bootAt(null), true);
        expect(r.refusal).toBeNull();
        expect(r.out.perTick).toHaveLength(4142);
        expect(APPROACH_DOOR_COUNTS.doors).toEqual([]);
        expect(TURRET_APPROACH_COUNTS.approaches).toEqual([{ turret: TURRET, t: expect.any(Number), side: 'right',
            via: null, wait: 30, forks: expect.any(Number) }]);
    }, 900000);

    it('ICEST\'s pocket boot (480,456): ON keys identical to OFF, nothing asked', async () => {
        const boot = await bootAt({ x: 488, y: 464 });
        const off = await arm(boot, false);
        resetApproachDoorCounts();
        const on = await arm(boot, true);
        expect(off.out.perTick).toHaveLength(4495);
        expect(on.out.perTick.map((k) => [...k].sort())).toEqual(off.out.perTick.map((k) => [...k].sort()));
        expect(APPROACH_DOOR_COUNTS.doors).toEqual([]);
    }, 900000);
});
