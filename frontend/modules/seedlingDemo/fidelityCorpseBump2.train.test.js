/**
 * seedlingDemo/fidelityCorpseBump2.slow.test — ⛓⛓ seedling-fidelity-corpsebump2 (wave 36) on L40LATCH's latch chain
 * (`fixtures/l40latch-witness/latch-boot.json`) under LWEIGH's hand-over arm: CPAIR size 3 + `LATCH_WEIGH_FIRST` ON,
 * `TURRET_APPROACH` OFF, `orbitFreeAim` + `strategyBoundDistinct` ON, `turretSnapPricing` OFF
 * (`fidelityL40Latch.corpseBump2Solve`). Each solve is ~1 min.
 *   - OFF (`corpseBumpRestRead`): the corpse weigh's bump 1 rests the corpse on (30,25); the walk to bump 2's stance
 *     is driven with Fire selected and presses X on its first tick, which bumps it on to (30,24); `runFire` then refuses
 *     *"ALREADY on (30,24)"* as a `BotDriverV2Error` with no `perTick`.
 *   - ON: the corpse is re-read at the stance, the walk's bump is counted and waited to rest, no second press is made,
 *     `wandlock@448,432` opens, and the chain runs on to the strategy bound at `pushableblock@576,560` (LWEIGH's item 3).
 *     Its first `CORPSEBUMP2_CUT` ticks are the committed game witness `corpsebump2-walk-press`.
 *   - ON costs an unmoved corpse nothing: hammer-2's solved arm (CPAIR size 3 + `LATCH_WEIGH_FIRST` +
 *     `TURRET_APPROACH`, every contact key at its default) also walks to bump 2 with Fire selected and presses X, but
 *     out of the corpse's reach, and ON its ticks equal OFF's key for key (4142, hitless).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { BotDriverV2Error } from './botDriverV2.js';
import { withContactFidelity } from './contactFidelity.js';
import { CHOOSER_PAIR, withChooserPair, withLatchWeighFirst, withTurretApproach } from './solverBot.js';
import { CORPSEBUMP2_CUT, L40LATCH_WITNESS_DIR, corpseBump2Solve, corpseBump2WalkPressTape, l40LatchBoot,
    l40LatchSolve } from './fidelityL40Latch.js';

describe('CORPSEBUMP2 on the latch chain (slow)', () => {
    it('OFF: the walk\'s Fire press carries the corpse to (30,24) and runFire refuses bump 2 with no perTick', async () => {
        const r = await corpseBump2Solve({ corpseBumpRestRead: false });
        expect(r.out).toBeNull();
        expect(r.refusal).toBeInstanceOf(BotDriverV2Error);
        expect(r.refusal.message).toMatch(/-> weigh \(corpse bump 2, iceturret@472,400\): iceturret@472,400 is ALREADY on \(30,24\)/);
        expect(r.refusal.perTick).toBeUndefined();
    }, 900000);

    it('ON: no second press; the lock opens and the chain refuses on the strategy bound at pushableblock@576,560', async () => {
        const r = await corpseBump2Solve();
        expect(r.out).toBeNull();
        expect(r.refusal.message).toMatch(/applied 4 strategies for one goal \[shove\(pushableblockfire@576,576\), weigh\(wandlock@448,432\), hold\(wandlock@480,560\), weigh\(wandlock@800,400\)\]/);
        expect(r.refusal.obstacle).toMatchObject({ kind: 'solid', id: 'pushableblock@576,560' });
        expect(r.refusal.perTick.length).toBeGreaterThan(CORPSEBUMP2_CUT);
        // the solver's ticks are the committed witness's tape, key for key
        const committed = JSON.parse(readFileSync(join(L40LATCH_WITNESS_DIR, 'corpsebump2-walk-press.json'), 'utf8'));
        const built = await corpseBump2WalkPressTape(r);
        expect(built.inputs).toEqual(committed.tape.inputs);
        expect(built.equips).toEqual(committed.tape.equips);
    }, 900000);

    it('ON costs an unmoved corpse nothing: the solved L+CP3+TA arm\'s ticks equal OFF\'s, key for key', async () => {
        const boot = await l40LatchBoot();
        const solve = async (on) => {
            const was = CHOOSER_PAIR.size;
            CHOOSER_PAIR.size = 3;
            try {
                return await withContactFidelity({ corpseBumpRestRead: on }, () => withChooserPair(true,
                    () => withLatchWeighFirst(true, () => withTurretApproach(true, () => l40LatchSolve(boot)))));
            } finally {
                CHOOSER_PAIR.size = was;
            }
        };
        const off = await solve(false);
        const on = await solve(true);
        expect(off.refusal).toBeNull();
        expect(off.out.perTick).toHaveLength(4144); // ⛓ VOLLEY FLIP (`TURRET_APPROACH_VOLLEY_ORDER` ON by default): the latch chain meets wait 31 (ascending: 30, 4142 t); both arms move together
        expect(on.out.perTick.map((k) => [...k])).toEqual(off.out.perTick.map((k) => [...k]));
        expect(on.out.equips).toEqual(off.out.equips);
    }, 900000);
});
