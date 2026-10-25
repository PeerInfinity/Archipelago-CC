/**
 * seedling-fidelity-l40bk2 (wave 31), the SLOW row: the recorded witness `l40bk2-pocket-chain` is the solver's own plan
 * — the pocket solve (D1's switch ON) is re-run and its refused prefix must be the recording's tape, input for input
 * and equip for equip. ~3.5 min of solver (the chain's last ladder is the long part), hence the slow tier.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { L40BK2_WITNESS_DIR, l40Bk2PocketTape } from './fidelityL40Bk2.js';

describe('L40BK2 D1 — the pocket chain witness is the solver\'s plan', () => {
    it('the solve from the pocket boot (D1 ON) refuses where it did, and its spent ticks are the recorded tape', async () => {
        const w = JSON.parse(readFileSync(join(L40BK2_WITNESS_DIR, 'l40bk2-pocket-chain.json'), 'utf8'));
        const tape = await l40Bk2PocketTape();
        expect(tape.tick_count).toBe(w.tape.tick_count);
        expect(tape.inputs).toEqual(w.tape.inputs);
        expect(tape.equips).toEqual(w.tape.equips);
        expect(tape.refused).toBe(w.tape.refused);
    }, 900_000);
});
