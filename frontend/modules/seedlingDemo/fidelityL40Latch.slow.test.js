/**
 * seedling-fidelity-l40latch (wave 32), the SLOW rows: the latch solves under each switch arm (~1 min each).
 * `holdWaitPriced` alone climbs the ladder and refuses with the chaser arm's stance scan (every still stance hit) and
 * the TIME rung's named refusal; both ON, the recorded witness `l40latch-orbit-chain` is the solver's own plan, input
 * for input and equip for equip.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { L40LATCH_WITNESS_DIR, l40LatchBoot, l40LatchOrbitTape, l40LatchSolve } from './fidelityL40Latch.js';

describe('L40LATCH D1 — the latch solve under each arm', () => {
    it('holdWaitPriced alone: the hold\'s wait is a corridor hit; TIME refuses its tail; no still stance kills the BobSoldier', async () => {
        // ⛓ `chaserOrbitKill` named OFF since planning-14's wave-32 flip turned it ON (this row is the D1 arm alone).
        const { out, refusal } = await l40LatchSolve(await l40LatchBoot(), { holdWaitPriced: true, chaserOrbitKill: false });
        expect(out).toBeNull();
        expect(refusal.message).toContain('hold stance (wandlock@480,560): the combat ladder is EXHAUSTED');
        expect(refusal.message).toContain('TIME certifies the mover TO the aim against the danger timeline');
        expect(refusal.message).toContain('the WAIT is dangerous at tick 93 — chaser:bobsoldier@880,832');
        expect(refusal.obstacle?.id).toBe('bobsoldier@880,832');
        expect(refusal.perTick.length).toBe(0);
    }, 900_000);

    it('both ON: the solve\'s refused prefix is the recorded tape', async () => {
        const w = JSON.parse(readFileSync(join(L40LATCH_WITNESS_DIR, 'l40latch-orbit-chain.json'), 'utf8'));
        const tape = await l40LatchOrbitTape();
        expect(tape.tick_count).toBe(w.tape.tick_count);
        expect(tape.inputs).toEqual(w.tape.inputs);
        expect(tape.equips).toEqual(w.tape.equips);
        expect(tape.refused).toBe(w.tape.refused);
    }, 900_000);
});
