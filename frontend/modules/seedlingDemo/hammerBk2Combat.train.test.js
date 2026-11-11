/**
 * seedlingDemo/hammerBk2Combat.slow.test — ⛓⛓ SEEDLING HAMMER-PHASE BK2COMBAT (`CHASER_STAGED_HUNT`, OFF), the burn
 * walk's combat in Boss Key 2's chain, on L40LATCH's latch boot re-booted at (488,579) (APPROACH's staging point on the
 * arrival legs) under POCKET-BURN's arm: CPAIR size 3 (the default) + `LATCH_WEIGH_FIRST` + `TURRET_APPROACH` +
 * `APPROACH_DOOR` + `FIFTH_ORDER` + `STANCE_BURN`.
 *   - POCKET SHUT (the boot's banked `burnabletree@872,784` un-banked — the arrival legs' shape), with
 *     `OPPORTUNISTIC_STRIKE` ON (it removes `bob@736,800` inside the spinner press, the first of the walk's two fights):
 *     - OFF: the burn walk's combat ladder is EXHAUSTED on `bobsoldier@880,832` (no chaser stance prices from the
 *       x 744 shaft; the orbit arm is hit or pinned).
 *     - ON: the chaser arm stages at (856,856) — a cell it refused only because the body never came — waits 15 still
 *       ticks, and kills the BobSoldier from (888,856). The refusal moves PAST the combat: the tree burns, the latched
 *       door opens, and the next wall is the ice turret's approach from the door (*"no approach to iceturret@472,400
 *       from the staging point … is hitless"*). The combat is replayed on a FRESH run (⚖ 30(c)): no hit, no death.
 *   - POCKET OPEN (the boot as committed), the arm without OPP: ON = SOUTHDOOR's solve, Boss Key 2 hitless at t4810,
 *     the staged hunt never asked.
 */
import { describe, expect, it } from 'vitest';

import { l40LatchBoot, l40LatchSolve } from './fidelityL40Latch.js';
import { withOpportunisticStrike } from './pressKillCost.js';
import {
    CHASER_STAGED_HUNT_COUNTS, CHOOSER_PAIR, resetChaserStagedHuntCounts, withApproachDoor, withChaserStagedHunt,
    withFifthOrder, withLatchWeighFirst, withStanceBurn, withTurretApproach,
} from './solverBot.js';

const SOLDIER = 'bobsoldier@880,832';
const TURRET = 'iceturret@472,400';
/** The burn's Fire select is at t912 on the ON run; the combat is over by t883, so the prefix needs no slot select. */
const COMBAT_PREFIX = 900;

/** The latch boot at (488,579), the tree standing (`shut`) or banked. */
async function southBoot(shut) {
    const base = await l40LatchBoot();
    return { ...base, boot: { ...base.boot, x: 480, y: 571 },
        persistence: shut ? base.persistence.filter((p) => !(p.level === 40 && p.tag === 0)) : base.persistence };
}

/** Boss Key 2 from `boot` under POCKET-BURN's arm, `OPPORTUNISTIC_STRIKE` at `opp`, the switch at `on`. */
function arm(boot, { opp, on }) {
    resetChaserStagedHuntCounts();
    return withLatchWeighFirst(true, () => withTurretApproach(true, () => withApproachDoor(true,
        () => withFifthOrder(true, () => withStanceBurn(true, () => withOpportunisticStrike(opp,
            () => withChaserStagedHunt(on, () => l40LatchSolve(boot))))))));
}

/** Step `perTick` (with `equips`) on a FRESH run of `boot`: hits, deaths, the walk's three bodies, takes. */
async function replay(boot, perTick, equips) {
    const { parseTape } = await import('./tapeFormat.js');
    const { buildTape } = await import('./botDriverV1.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const folded = buildTape(perTick.map((k) => new Set(k)), boot.boot, 'bk2combat',
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = parseTape(JSON.stringify({ ...boot, name: 'bk2combat', tick_count: perTick.length,
        inputs: folded.inputs, equips: [...(boot.equips ?? []), ...(equips ?? [])] }));
    let run = null;
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    for (let r = st.next(); !r.done; r = st.next());
    return { hits: run.playerHits.map((h) => ({ t: h.t, source: h.source, id: h.id })), deaths: run.playerDeaths.length,
        walkBodies: run.entities('chasers').map((c) => c.id ?? c)
            .filter((id) => /^(bob@736,752|bob@736,800|bobsoldier@880,832)$/.test(id)),
        collected: run.ledger('collected').map((c) => ({ t: c.t, keyType: c.keyType ?? c.tag ?? null })) };
}

describe('hammer-phase BK2COMBAT on the latch boot, south of the door (slow)', () => {
    const PAIR_SIZE = 3;
    it(`the arm: CPAIR at size ${PAIR_SIZE} is the default this file leans on`, () => {
        expect(CHOOSER_PAIR.enabled).toBe(true);
        expect(CHOOSER_PAIR.size).toBe(PAIR_SIZE);
    });

    it('pocket shut, OPP, OFF: the burn walk\'s combat ladder is EXHAUSTED on the BobSoldier in its notch', async () => {
        const r = await arm(await southBoot(true), { opp: true, on: false });
        expect(r.out).toBeNull();
        expect(r.refusal.message).toContain('-> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED. '
            + 'The corridor passes through danger at');
        expect(r.refusal.message).toContain(`chaser arm: no stance derives for ${SOLDIER} on level 40`);
        expect(r.refusal.message).not.toContain('STAGED HUNT');
        expect(r.refusal.obstacle).toEqual({ kind: 'danger', id: SOLDIER, sources: [`chaser:${SOLDIER}`] });
        expect(r.refusal.perTick).toHaveLength(680);
        expect(CHASER_STAGED_HUNT_COUNTS.asks).toEqual([]);
    }, 900000);

    it('pocket shut, OPP, ON: staged at (856,856) after 15 still ticks, the BobSoldier dies hitless and the refusal '
        + 'moves past the combat to the ice turret\'s approach from the door', async () => {
        const boot = await southBoot(true);
        const r = await arm(boot, { opp: true, on: true });
        expect(r.out).toBeNull();
        expect(CHASER_STAGED_HUNT_COUNTS.asks).toEqual([
            { id: SOLDIER, t: 680, cell: { x: 856, y: 856 }, wait: 15, verdict: 'staged' }]);
        expect(r.refusal.message).not.toContain('the combat ladder is EXHAUSTED');
        expect(r.refusal.message).toContain(`-> weigh: no approach to ${TURRET} from the staging point (`);
        expect(r.refusal.obstacle).toEqual({ kind: 'danger', id: TURRET });
        expect(r.refusal.perTick.length).toBeGreaterThan(COMBAT_PREFIX);
        // ⚖ 30(c): the combat as spent, on a fresh run — every body of the walk gone, no hit, no death
        const fresh = await replay(boot, r.refusal.perTick.slice(0, COMBAT_PREFIX).map((k) => [...k]), []);
        expect(fresh.hits).toEqual([]);
        expect(fresh.deaths).toBe(0);
        expect(fresh.walkBodies).toEqual([]);
    }, 1800000);

    it('pocket open, no OPP, ON: SOUTHDOOR\'s solve unchanged — Boss Key 2 hitless at t4812, the staged hunt never '
        + 'asked', async () => {
        const boot = await southBoot(false);
        const r = await arm(boot, { opp: false, on: true });
        expect(r.refusal ?? null).toBeNull();
        expect(r.out.perTick).toHaveLength(4812); // ⛓ VOLLEY FLIP (`TURRET_APPROACH_VOLLEY_ORDER` ON by default): 4810 → 4812
        expect(CHASER_STAGED_HUNT_COUNTS.asks).toEqual([]);
        const fresh = await replay(boot, r.out.perTick.map((k) => [...k]), r.out.equips ?? []);
        expect(fresh.hits).toEqual([]);
        expect(fresh.deaths).toBe(0);
        expect(fresh.collected).toContainEqual({ t: 4812, keyType: 2 });
    }, 1800000);
});
