/**
 * seedlingDemo/hammerPocketBurn.slow.test — ⛓⛓ SEEDLING HAMMER-PHASE POCKET-BURN (`STANCE_BURN`, OFF), Boss Key 2's
 * chain on L40LATCH's latch boot re-booted at (488,579) (APPROACH's staging point on the arrival legs), under the arm
 * SOUTHDOOR's chain needs: CPAIR size 3 (the default) + `LATCH_WEIGH_FIRST` + `TURRET_APPROACH` + `APPROACH_DOOR` +
 * `FIFTH_ORDER`.
 *   - POCKET SHUT (the boot's banked `burnabletree@872,784` un-banked — the arrival legs' wall):
 *     - OFF: the latch hold's stance derivation refuses (*"no REACHABLE stance inside buttonroom@880,768"*), its
 *       prerequisite list naming no burn — the arrivals' refusal (legs 864/865 on this slice's base).
 *     - ON: the burn is raised as the hold's prerequisite and the solve walks to the burn's stance; the refusal moves
 *       PAST the pocket, to that walk's combat ladder on `bobsoldier@880,832` (the next wall — the same one the
 *       defaults meet on the arrivals; not this slice's). ⚠ Not a solve: the chain from a shut pocket is SIX distinct
 *       orders (the burn + the five below), and `FIFTH_ORDER` admits five (POCKET-BURN report §4).
 *   - POCKET OPEN (the boot as committed): ON = SOUTHDOOR's solve, Boss Key 2 hitless at t4810 on a FRESH run (⚖ 30(c)).
 */
import { describe, expect, it } from 'vitest';

import { l40LatchBoot, l40LatchSolve } from './fidelityL40Latch.js';
import {
    CHOOSER_PAIR, withApproachDoor, withFifthOrder, withLatchWeighFirst, withStanceBurn, withTurretApproach,
} from './solverBot.js';

const TREE = 'burnabletree@872,784';

/** The latch boot at (488,579), the tree standing (`shut`) or banked. */
async function southBoot(shut) {
    const base = await l40LatchBoot();
    return { ...base, boot: { ...base.boot, x: 480, y: 571 },
        persistence: shut ? base.persistence.filter((p) => !(p.level === 40 && p.tag === 0)) : base.persistence };
}

/** Boss Key 2 from `boot` under LWF + TA + APPROACH_DOOR + FIFTH_ORDER (CPAIR-3 the default), `STANCE_BURN` at `on`. */
function arm(boot, on) {
    return withLatchWeighFirst(true, () => withTurretApproach(true, () => withApproachDoor(true,
        () => withFifthOrder(true, () => withStanceBurn(on, () => l40LatchSolve(boot))))));
}

/** Step `perTick` (with `equips`) on a FRESH run of `boot`: hits, deaths, takes, the tree's burn. */
async function replay(boot, perTick, equips) {
    const { parseTape } = await import('./tapeFormat.js');
    const { buildTape } = await import('./botDriverV1.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const folded = buildTape(perTick.map((k) => new Set(k)), boot.boot, 'pocketburn',
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = parseTape(JSON.stringify({ ...boot, name: 'pocketburn', tick_count: perTick.length,
        inputs: folded.inputs, equips: [...(boot.equips ?? []), ...(equips ?? [])] }));
    let run = null;
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    for (let r = st.next(); !r.done; r = st.next());
    return { hits: run.playerHits.map((h) => ({ t: h.t, source: h.source, id: h.id })), deaths: run.playerDeaths.length,
        collected: run.ledger('collected').map((c) => ({ t: c.t, keyType: c.keyType ?? c.tag ?? null })) };
}

describe('hammer-phase POCKET-BURN on the latch boot, south of the door (slow)', () => {
    const PAIR_SIZE = 3;
    it(`the arm: CPAIR at size ${PAIR_SIZE} is the default this file leans on`, () => {
        expect(CHOOSER_PAIR.enabled).toBe(true);
        expect(CHOOSER_PAIR.size).toBe(PAIR_SIZE);
    });

    it('pocket shut, OFF: the latch hold\'s stance refuses on the tree, and its prerequisite list names no burn', async () => {
        const r = await arm(await southBoot(true), false);
        expect(r.out).toBeNull();
        expect(r.refusal.message).toMatch(/^solverBot: no REACHABLE stance inside buttonroom@880,768 in level 40 — /);
        expect(r.refusal.message).toContain('none of them plans a corridor from (488,579)');
        expect(r.refusal.message).not.toContain(TREE);
    }, 900000);

    it('pocket shut, ON: the burn is raised for the hold\'s stance, and the refusal moves past the pocket to the burn '
        + 'walk\'s combat (bobsoldier@880,832)', async () => {
        const r = await arm(await southBoot(true), true);
        expect(r.out).toBeNull();
        expect(r.refusal.message).not.toContain('no REACHABLE stance inside buttonroom@880,768');
        expect(r.refusal.message).toContain(`-> burn stance (${TREE}): the combat ladder is EXHAUSTED. The corridor `
            + 'passes through danger at');
        expect(r.refusal.obstacle).toEqual({ kind: 'danger', id: 'bobsoldier@880,832',
            sources: ['chaser:bobsoldier@880,832'] });
    }, 900000);

    it('pocket open, ON: SOUTHDOOR\'s solve unchanged — Boss Key 2 hitless at t4810 on a fresh run', async () => {
        const boot = await southBoot(false);
        const r = await arm(boot, true);
        expect(r.refusal).toBeNull();
        expect(r.out.perTick).toHaveLength(4810);
        expect(r.out.records.some((x) => x.strategy === 'burn')).toBe(false);
        // ⚖ 30(c): the plan's keys on a FRESH run of the model
        const seen = await replay(boot, r.out.perTick.map((k) => [...k]), r.out.equips);
        expect(seen.hits).toEqual([]);
        expect(seen.deaths).toBe(0);
        expect(seen.collected).toEqual([{ t: 4810, keyType: 2 }]);
    }, 1200000);
});
