/**
 * seedlingDemo/hammerTurretApproach.slow.test — ⛓⛓ SEEDLING HAMMER-PHASE APPROACH (`TURRET_APPROACH`, OFF) on
 * L40LATCH's latch chain (`fixtures/l40latch-witness/latch-boot.json`, Boss Key 2 from the held latch at (888,776)),
 * with CPAIR's size-3 arm and `LATCH_WEIGH_FIRST` (the smallest arm that reaches the corpse weigh, L40C § 6).
 *   - OFF: LWEIGH's refusal — the stance walk into `iceturret@472,400`'s range is not certified, and a blast lands at
 *     t917 on `execCorpseWeigh`'s snap tick.
 *   - ON: the approach and the kill are one fork certificate — a staging point past the range, a wait at the covered
 *     first waypoint (488,504) that times the walk to the turret's volley clock, the kill from the west stance — and
 *     Boss Key 2 is collected at t4142 on a FRESH run of the model with no hit and no death; the chain applies four
 *     orders, so the strategy bound is not met.
 *   - ICEST's pocket boot (480,456): its corpse weigh binds live (no reorder), unchanged ON.
 */
import { describe, expect, it } from 'vitest';

import { CONTACT_FIDELITY_KEYS, withContactFidelity } from './contactFidelity.js';
import { l40LatchBoot, l40LatchSolve } from './fidelityL40Latch.js';
import {
    CHOOSER_PAIR, TURRET_APPROACH_COUNTS, resetTurretApproachCounts, withChooserPair, withLatchWeighFirst,
    withTurretApproach,
} from './solverBot.js';

const TURRET = 'iceturret@472,400';

/**
 * ⛓ The OFF control measures LWEIGH's uncertified stance walk into the t917 blast. Under fidelity's
 * `turretSnapPricing` that walk refuses earlier, on the snapped hull's danger, so the control runs with the key OFF
 * wherever it exists (the approach's ON row is measured to solve both ways).
 */
const SNAP_OFF = CONTACT_FIDELITY_KEYS.includes('turretSnapPricing') ? { turretSnapPricing: false } : {};

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

/** The latch chain under CPAIR size 3 + `LATCH_WEIGH_FIRST`, with `TURRET_APPROACH` at `approach`. */
async function latchChain(approach) {
    const boot = await l40LatchBoot();
    return withPairSize(3, () => withChooserPair(true, () => withLatchWeighFirst(true,
        () => withTurretApproach(approach, () => l40LatchSolve(boot)))));
}

/** Step `perTick` (with `equips`) on a FRESH run of the latch boot: the turret per tick, the hits, deaths, takes. */
async function replayLatch(perTick, equips) {
    const { parseTape } = await import('./tapeFormat.js');
    const { buildTape } = await import('./botDriverV1.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const boot = await l40LatchBoot();
    const folded = buildTape(perTick.map((k) => new Set(k)), boot.boot, 'approach',
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = parseTape(JSON.stringify({ ...boot, name: 'approach', tick_count: perTick.length,
        inputs: folded.inputs, equips: [...(boot.equips ?? []), ...(equips ?? [])] }));
    let run = null;
    const rows = [];
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    for (let r = st.next(); !r.done; r = st.next()) {
        const t = run.entities('turrets').get(TURRET);
        rows.push({ t: r.value.observation.t, dead: t.dead, tile: { tx: Math.floor(t.x / 16), ty: Math.floor(t.y / 16) },
            open: run.entities('openActivators').has('wandlock@448,432') });
    }
    return { rows, hits: run.playerHits.map((h) => ({ t: h.t, source: h.source, id: h.id })),
        deaths: run.playerDeaths.length,
        collected: run.ledger('collected').map((c) => ({ t: c.t, keyType: c.keyType ?? c.tag ?? null })) };
}

describe('hammer-phase APPROACH on the latch chain (slow)', () => {
    it('OFF: the stance walk into the range is not certified — LWEIGH\'s refusal on the t917 blast', async () => {
        const r = await withContactFidelity(SNAP_OFF, () => latchChain(false));
        expect(r.out).toBeNull();
        expect(r.refusal.message).toMatch(/-> weigh \(wandlock@448,432\): the reordered corpse weigh took a hit at t917 \(blast:iceturret@472,400#[0-9.]+\) on its way to iceturret@472,400's kill stance \(488,445\)/);
        expect(r.refusal.perTick).toHaveLength(1245);
    }, 900000);

    it('ON: the approach is timed on the turret\'s clock from cover, the kill is hitless, and Boss Key 2 is collected at t4142 on a fresh run', async () => {
        resetTurretApproachCounts();
        const r = await latchChain(true);
        expect(r.refusal).toBeNull();
        expect(r.out.perTick).toHaveLength(4142);
        // the approach: the west stance off the snapped box, the planned corridor, a 30-tick wait at the cover
        expect(TURRET_APPROACH_COUNTS.approaches).toEqual([{ turret: TURRET, t: expect.any(Number), side: 'right',
            via: null, wait: 30, forks: expect.any(Number) }]);
        const weigh = r.out.records.find((x) => x.strategy === 'weigh' && x.corpse);
        expect(weigh.corpse.kill).toBeNull();
        // ⚖ 30(c): the plan's keys on a FRESH run of the model — no hit, no death, the key taken, the corpse pushed
        const { rows, hits, deaths, collected } = await replayLatch(r.out.perTick.map((k) => [...k]), r.out.equips);
        expect(hits).toEqual([]);
        expect(deaths).toBe(0);
        expect(collected).toEqual([{ t: 4142, keyType: 2 }]);
        const death = rows.find((g) => g.dead);
        expect(death.tile).toEqual({ tx: 30, ty: 26 });
        const tiles = [...new Set(rows.filter((g) => g.dead).map((g) => `${g.tile.tx},${g.tile.ty}`))];
        expect(tiles).toEqual(['30,26', '30,25', '30,24']);
        expect(rows.find((g) => g.open).tile).toEqual({ tx: 30, ty: 24 });
    }, 900000);

    it('ICEST\'s pocket boot (480,456): SOLVED 4495 through the corpse weigh, ON keys identical, nothing approached', async () => {
        const base = await l40LatchBoot();
        const boot = { ...base, boot: { ...base.boot, x: 480, y: 456 } };
        const off = await withTurretApproach(false, () => l40LatchSolve(boot));
        resetTurretApproachCounts();
        const on = await withTurretApproach(true, () => l40LatchSolve(boot));
        expect(off.out.perTick).toHaveLength(4495);
        expect(on.out.perTick.map((k) => [...k].sort())).toEqual(off.out.perTick.map((k) => [...k].sort()));
        expect(TURRET_APPROACH_COUNTS.approaches).toEqual([]);
    }, 300000);
});
