// ⚖ Robert 2026-11-02 CI manual-only P1: TRAIN tier (was `fidelityL40Latch.slow.test.js`). Runs on js-land/** train pushes and
// on dispatch (`-f train=true`), NOT on a slice push — a solver change that moves this pin reds at the train,
// unless the slice dispatches the train tier first (js-16's packet rule). `npm run test:unit:train`.
/**
 * seedling-fidelity-l40latch (wave 32), the SLOW rows: the latch solves under each switch arm (~1 min each).
 * `holdWaitPriced` alone climbs the ladder and refuses with the chaser arm's stance scan (every still stance hit) and
 * the TIME rung's named refusal; both ON, the recorded witness `l40latch-orbit-chain` is the solver's own plan, input
 * for input and equip for equip.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { L40LATCH_WITNESS_DIR, l40LatchBoot, l40LatchOrbitShippedTape, l40LatchOrbitTape, l40LatchSolve } from './fidelityL40Latch.js';
import { withL40Flip } from './l40FlipSet.js';
import { withLatchWeighFirst } from './solverBot.js';

describe('L40LATCH D1 — the latch solve under each arm', () => {
    it('the pre-flip hammer defaults (withL40Flip(false)), holdWaitPriced alone: the hold\'s wait is a corridor hit; TIME refuses its tail; no still stance kills the BobSoldier', async () => {
        // ⛓ `chaserOrbitKill` named OFF since planning-14's wave-32 flip turned it ON (this row is the D1 arm alone).
        // ⛓ the L40 flip's chain refuses elsewhere (the iceturret approach staging): this row pins the pre-flip refusal.
        const { out, refusal } = await withL40Flip(false, async () => l40LatchSolve(await l40LatchBoot(), { holdWaitPriced: true, chaserOrbitKill: false }));
        expect(out).toBeNull();
        expect(refusal.message).toContain('hold stance (wandlock@480,560): the combat ladder is EXHAUSTED');
        expect(refusal.message).toContain('TIME certifies the mover TO the aim against the danger timeline');
        expect(refusal.message).toContain('the WAIT is dangerous at tick 93 — chaser:bobsoldier@880,832');
        expect(refusal.obstacle?.id).toBe('bobsoldier@880,832');
        expect(refusal.perTick.length).toBe(0);
    }, 900_000);

    it('the pre-flip hammer defaults (withL40Flip(false)), both ON: the solve\'s refused prefix is the recorded tape', async () => {
        // ⛓ the L40 flip's chain moves past this prefix: the witness pins the pre-flip plan, not the shipped defaults.
        const w = JSON.parse(readFileSync(join(L40LATCH_WITNESS_DIR, 'l40latch-orbit-chain.json'), 'utf8'));
        const tape = await withL40Flip(false, () => l40LatchOrbitTape());
        expect(tape.tick_count).toBe(w.tape.tick_count);
        expect(tape.inputs).toEqual(w.tape.inputs);
        expect(tape.equips).toEqual(w.tape.equips);
        expect(tape.refused).toBe(w.tape.refused);
    }, 900_000);

    // ⛓⛓ seedling-fidelity-afterrows (wave 41): the two rows above are BEFORE pins (`withL40Flip(false)`). At the
    // SHIPPED defaults (the L40 flip set ON): the D1a arm alone refuses BEFORE A TICK, at the flip's iceturret approach
    // staging (the latch's hold is never reached, so holdWaitPriced is inert: the text is byte-identical with it OFF),
    // while its chaser arm still finds no still stance that survives bobsoldier@880,832 (the WAIT hit at tick 93); and
    // both D1 switches ON now SOLVE Boss Key 2 from the latch — `l40latch-orbit-shipped`, played on p4g (0 px, 0 hits).
    it('AFTER (the shipped defaults), holdWaitPriced alone: refused before a tick at the iceturret approach staging; still no still stance kills the BobSoldier (the WAIT hit at tick 93); holdWaitPriced is inert there', async () => {
        const boot = await l40LatchBoot();
        const { out, refusal } = await l40LatchSolve(boot, { holdWaitPriced: true, chaserOrbitKill: false });
        expect(out).toBeNull();
        expect(refusal.message).toContain('-> shove stance (pushableblockfire@576,576) -> weigh -> iceturret@472,400 approach '
            + 'staging (488,579): the combat ladder is EXHAUSTED. The corridor passes through danger at (888.0,808.7) — '
            + 'chaser:bobsoldier@880,832');
        expect(refusal.message).toContain('16 of THOSE refused by the forecast [(888,776): the WAIT is dangerous at tick 93 '
            + '— chaser:bobsoldier@880,832');
        expect(refusal.obstacle?.id).toBe('bobsoldier@880,832');
        expect(refusal.perTick.length).toBe(0);
        const off = await l40LatchSolve(boot, { holdWaitPriced: false, chaserOrbitKill: false });
        expect(off.refusal.message).toBe(refusal.message);
    }, 900_000);

    it('AFTER (the shipped defaults), both ON: the latch solve SOLVES Boss Key 2, and its plan is the recorded tape `l40latch-orbit-shipped`', async () => {
        const w = JSON.parse(readFileSync(join(L40LATCH_WITNESS_DIR, 'l40latch-orbit-shipped.json'), 'utf8'));
        const tape = await l40LatchOrbitShippedTape();
        expect(tape.tick_count).toBe(4144);
        expect(tape.tick_count).toBe(w.tape.tick_count);
        expect(tape.inputs).toEqual(w.tape.inputs);
        expect(tape.equips).toEqual(w.tape.equips);
    }, 900_000);

    it('AFTER control: the shipped defaults MINUS `LATCH_WEIGH_FIRST` alone keep both BEFORE pins — D1a\'s EXHAUSTED hold with TIME\'s refusal, and the `l40latch-orbit-chain` prefix', () => withLatchWeighFirst(false, async () => {
        const { out, refusal } = await l40LatchSolve(await l40LatchBoot(), { holdWaitPriced: true, chaserOrbitKill: false });
        expect(out).toBeNull();
        expect(refusal.message).toContain('hold stance (wandlock@480,560): the combat ladder is EXHAUSTED');
        expect(refusal.message).toContain('TIME certifies the mover TO the aim against the danger timeline');
        expect(refusal.message).toContain('the WAIT is dangerous at tick 93 — chaser:bobsoldier@880,832');
        expect(refusal.obstacle?.id).toBe('bobsoldier@880,832');
        expect(refusal.perTick.length).toBe(0);
        const w = JSON.parse(readFileSync(join(L40LATCH_WITNESS_DIR, 'l40latch-orbit-chain.json'), 'utf8'));
        const tape = await l40LatchOrbitTape();
        expect(tape.tick_count).toBe(w.tape.tick_count);
        expect(tape.inputs).toEqual(w.tape.inputs);
        expect(tape.equips).toEqual(w.tape.equips);
        expect(tape.refused).toBe(w.tape.refused);
    }), 900_000);
});
