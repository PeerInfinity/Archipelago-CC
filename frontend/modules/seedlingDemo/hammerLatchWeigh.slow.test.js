/**
 * seedlingDemo/hammerLatchWeigh.slow.test — ⛓⛓ SEEDLING HAMMER-PHASE LWEIGH on L40LATCH's latch chain
 * (`fixtures/l40latch-witness/latch-boot.json`, Boss Key 2 from the held latch at (888,776)). Each solve is ~1–2 min.
 *   - OFF the chain plans `hold stance (wandlock@448,432)`: the player on `button@480,384`, inside
 *     `iceturret@472,400`'s range, because the corpse weigh is asked live and its first press's stance (488,440) is
 *     behind the latched south door. ON it plans the corpse weigh's stance instead; both walks west meet
 *     `bob@736,800` at t271.
 *   - ON with CPAIR's size-3 arm the chain gets past the bobs, and the weigh's steps are the MODEL's, replayed on a
 *     fresh run: the turret dies, its corpse slides (30,26) → (30,25) → (30,24), and `button@480,384` held by the
 *     corpse opens `wandlock@448,432`. The walk into the turret's range drew a volley (a blast at t917), so the switch
 *     refuses by name rather than ship the hit.
 * The rows where the reorder must not move anything (no turret, a turret out of range, no corpse route) are fast and
 * built in `hammerLatchWeigh.test.js`: on L40 every switch that removes the corpse route (`fireLiveTurretReach`,
 * `blockSweepBodies`, `corpseBumpWeigh`) refuses the whole chain at t0 on `button@816,400`, before the reorder is asked.
 */
import { describe, expect, it } from 'vitest';
import { withContactFidelity } from './contactFidelity.js';

import { l40LatchBoot, l40LatchSolve } from './fidelityL40Latch.js';
import {
    CHOOSER_PAIR, LATCH_WEIGH_FIRST_COUNTS, resetLatchWeighFirstCounts, withChooserPair, withLatchWeighFirst,
} from './solverBot.js';

const TURRET = 'iceturret@472,400';

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

/** Step `perTick` (with `equips`) on a fresh run of the latch boot: per tick the turret, the t2 lock and the hits. */
async function replayLatch(perTick, equips) {
    const { parseTape } = await import('./tapeFormat.js');
    const { buildTape } = await import('./botDriverV1.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const boot = await l40LatchBoot();
    const folded = buildTape(perTick.map((k) => new Set(k)), boot.boot, 'lweigh',
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = parseTape(JSON.stringify({ ...boot, name: 'lweigh', tick_count: perTick.length,
        inputs: folded.inputs, equips: [...(boot.equips ?? []), ...(equips ?? [])] }));
    let run = null;
    const rows = [];
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    for (let r = st.next(); !r.done; r = st.next()) {
        const t = run.entities('turrets').get(TURRET);
        rows.push({ t: r.value.observation.t, dead: t.dead, removed: t.removed,
            tile: { tx: Math.floor(t.x / 16), ty: Math.floor(t.y / 16) },
            open: run.entities('openActivators').has('wandlock@448,432') });
    }
    return { rows, hits: run.playerHits.map((h) => ({ t: h.t, source: h.source, id: h.id })) };
}

describe('hammer-phase LWEIGH on the latch chain (slow)', () => {
    it('OFF plans the hold stance; ON plans the corpse weigh, and both walks west meet bob@736,800 at t271', async () => {
        const boot = await l40LatchBoot();
        const off = await withLatchWeighFirst(false, () => l40LatchSolve(boot));
        resetLatchWeighFirstCounts();
        const on = await withLatchWeighFirst(true, () => l40LatchSolve(boot));
        expect(off.refusal.message).toMatch(/-> shove stance \(pushableblockfire@576,576\) -> hold stance \(wandlock@448,432\): the combat ladder is EXHAUSTED/);
        expect(on.refusal.message).toMatch(/-> shove stance \(pushableblockfire@576,576\) -> weigh stance \(wandlock@448,432\): the combat ladder is EXHAUSTED/);
        for (const r of [off, on]) {
            expect(r.refusal.perTick).toHaveLength(271);
            expect(r.refusal.obstacle).toMatchObject({ kind: 'danger', id: 'bob@736,800' });
        }
        expect(LATCH_WEIGH_FIRST_COUNTS.asked.length).toBeGreaterThan(0);
        expect(LATCH_WEIGH_FIRST_COUNTS.asked.every((a) => a.taken && a.turret === TURRET
            && a.inRange.includes(TURRET))).toBe(true);
    }, 900000);

    it('ON with CPAIR size 3: the turret dies, its corpse is pushed onto button@480,384, the lock opens — and the volley the approach drew refuses by name', async () => {
        // ⛓ hammer-2 signed (2026-10-30, W35): LWEIGH's row measures the uncertified stance walk into the t917 blast. Under
        // fidelity TURRETSNAP (`turretSnapPricing`, ON since W35) that walk refuses earlier, on the snapped hull's danger at
        // (472.0,441.8) — the more faithful refusal — so this row is LWEIGH's own control with the switch OFF.
        await withContactFidelity({ turretSnapPricing: false }, async () => {
            const boot = await l40LatchBoot();
            const r = await withPairSize(3, () => withChooserPair(true, () => withLatchWeighFirst(true,
                () => l40LatchSolve(boot))));
            expect(r.out).toBeNull();
            expect(r.refusal.message).toMatch(/-> weigh \(wandlock@448,432\): the reordered corpse weigh took a hit at t917 \(blast:iceturret@472,400#[0-9.]+\) on its way to iceturret@472,400's kill stance \(488,445\)/);
            expect(r.refusal.obstacle).toEqual({ kind: 'danger', id: TURRET });
            // the steps are the model's: the refused prefix on a fresh run
            const { rows, hits } = await replayLatch(r.refusal.perTick.map((k) => [...k]), r.refusal.equips);
            expect(hits).toEqual([{ t: 917, source: 'blast', id: expect.stringMatching(/^iceturret@472,400#/) }]);
            const death = rows.find((g) => g.dead);
            expect(death.tile).toEqual({ tx: 30, ty: 26 });
            expect(death.t).toBeGreaterThan(917);
            const tiles = [...new Set(rows.filter((g) => g.dead).map((g) => `${g.tile.tx},${g.tile.ty}`))];
            expect(tiles).toEqual(['30,26', '30,25', '30,24']);
            const opened = rows.find((g) => g.open);
            expect(opened.tile).toEqual({ tx: 30, ty: 24 });
            expect(rows.at(-1)).toMatchObject({ dead: true, removed: false, tile: { tx: 30, ty: 24 }, open: true });
        });
    }, 900000);
});
