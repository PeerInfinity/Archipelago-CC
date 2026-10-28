/**
 * seedlingDemo/hammerIceTurretStatic.slow.test — ⛓⛓ SEEDLING HAMMER-PHASE ICEST on L40LATCH's latch chain
 * (`fixtures/l40latch-witness/latch-boot.json`, Boss Key 2 from the held latch; `holdWaitPriced` + `chaserOrbitKill`
 * at their defaults, ON). Each solve is ~1–2 min, so these rows are the slow tier.
 *   - ON alone the walk back west refuses at t271 on `bob@736,800`, OFF's words byte for byte: the smallest set whose
 *     removal admits a corridor there is `bob@736,800` + `bob@736,752` + `iceturret@472,400`, and no single removal does.
 *   - ON with CPAIR's size-3 arm, the triple with the turret admits: the chaser arm kills `bob@736,800` (t577) and the
 *     walk meets `iceturret@472,400` as the hit's only source. The ice-turret arm is handed it and refuses by name with
 *     no hit: from the staging point below it no fork's try is hitless (the turret's body on the approach, a blast while
 *     circling). The chain's next gap is that approach (the report's §2).
 */
import { describe, expect, it } from 'vitest';

import { l40LatchBoot, l40LatchSolve } from './fidelityL40Latch.js';
import {
    CHOOSER_PAIR, ICETURRET_STATIC_KILL_COUNTS, resetChooserPairCounts, resetIceTurretStaticKillCounts, withChooserPair,
    withIceTurretStaticKill,
} from './solverBot.js';

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

describe('hammer-phase ICEST on the latch chain (slow)', () => {
    it('ON alone: the walk back refuses at t271 on bob@736,800, OFF\'s refusal byte for byte', async () => {
        const boot = await l40LatchBoot();
        const off = await withIceTurretStaticKill(false, () => l40LatchSolve(boot));
        resetIceTurretStaticKillCounts();
        const on = await withIceTurretStaticKill(true, () => l40LatchSolve(boot));
        expect(off.refusal.perTick).toHaveLength(271);
        expect(on.refusal.message).toBe(off.refusal.message);
        expect(on.refusal.perTick.map((k) => [...k])).toEqual(off.refusal.perTick.map((k) => [...k]));
        expect(ICETURRET_STATIC_KILL_COUNTS.handed).toEqual([]);
    }, 900000);

    it('ON with CPAIR size 3: the turret is handed at t577 and the arm refuses by name, no hit', async () => {
        const boot = await l40LatchBoot();
        resetIceTurretStaticKillCounts();
        resetChooserPairCounts();
        const r = await withPairSize(3, () => withChooserPair(true, () => withIceTurretStaticKill(true, () => l40LatchSolve(boot))));
        expect(r.out).toBeNull();
        expect(ICETURRET_STATIC_KILL_COUNTS.handed).toEqual([{ id: 'iceturret@472,400', t: 577, via: 'hit' }]);
        expect(ICETURRET_STATIC_KILL_COUNTS.kills[0]).toMatchObject({ id: 'iceturret@472,400', t: 577, dead: false });
        expect(r.refusal.message).toMatch(/-> kill \(iceturret@472,400\): no side of iceturret@472,400 gives a hitless kill — up: no try is hitless/);
        expect(r.refusal.message).not.toMatch(/HIT during the ice-turret arm/);
    }, 600000);
});
