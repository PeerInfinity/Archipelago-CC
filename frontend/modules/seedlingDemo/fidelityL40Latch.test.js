/**
 * seedling-fidelity-l40latch (wave 32) — L40 Boss Key 2's S-door latch (`buttonroom@880,768`) held under
 * `bobsoldier@880,832`. Both switches ship OFF.
 *
 * ⛓ W0 (`l40latch-stand`, p4g): from the latch staging (step 67's boot on the latch, the chest, the tree and
 * `spinner@880,848` banked) a still holder is hit by the BobSoldier's blade at t93 and t113 and dies at t133; the
 * model agrees at 0 px, hits and death included. OFF the solver stands there: *"hold tick 93 of 131 MOVED"*.
 *
 * ⛓ D1a (`holdWaitPriced`): the hold stance walk carries the hold as its tail, so that wait is a corridor hit and the
 * ladder climbs; the TIME rung refuses a hold's tail by name (it would certify a 0-tick walk and loop). ⛓ D1b
 * (`chaserOrbitKill`): no still stance kills a BobSoldier hitless, and the kill rung's orbit arm does, on forks
 * (`orbitKillChaser`). Both ON, the solver kills the BobSoldier behind its blade and `spinner@816,848` by press while
 * `wandlock@480,560` fades open, never hit, and refuses next in the x≈744 corridor (`bob@736,800`, D2's hand-over):
 * `l40latch-orbit-chain` is those 271 ticks on p4g at 0 px.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { ORBIT_KILL, ORBIT_KILL_CANDIDATES, orbitKillPolicy, strikePolicyFor } from './solverBot.js';
import { compareCorpseBumpWitness } from './fidelityCorpseBump.js';
import { L40LATCH_D1_SWITCHES, L40LATCH_WITNESS_DIR, l40LatchBoot, l40LatchModelSamples, l40LatchOrbitChecks,
    l40LatchSolve, l40LatchStandChecks, unpackL40LatchSample } from './fidelityL40Latch.js';

const witness = (name) => JSON.parse(readFileSync(join(L40LATCH_WITNESS_DIR, `${name}.json`), 'utf8'));

describe('L40LATCH — the switches', () => {
    it('both ship OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.holdWaitPriced).toBe(false);
        expect(CONTACT_FIDELITY_DEFAULTS.chaserOrbitKill).toBe(false);
    });

    it('the staging banks the chest {40,13}, the tree {40,0} and spinner@880,848 {40,16}, and boots on the latch', async () => {
        const boot = await l40LatchBoot();
        expect(boot.boot).toEqual({ level: 40, x: 880, y: 768 });
        const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(boot)))), atlasLevelSource());
        expect(run.world.chests.some((c) => c.id === 'chest@880,816')).toBe(false);
        expect(run.world.burnableTrees.some((t) => t.id === 'burnabletree@872,784')).toBe(false);
        expect(run.entities('spinnerBodies').map((b) => b.id)).not.toContain('spinner@880,848');
        expect(run.entities('chasers').map((c) => c.id)).toContain('bobsoldier@880,832');
    });
});

describe('L40LATCH W0 — the still holder, on the game (`l40latch-stand`)', () => {
    const w = witness('l40latch-stand');
    const game = w.samples.map(unpackL40LatchSample);

    it('the recording: the BobSoldier walks up the pocket and its blade hits the holder (t93), who dies', () => {
        const checks = l40LatchStandChecks(game);
        expect(checks.map((c) => [c.name, c.ok])).toEqual(checks.map((c) => [c.name, true]));
        expect(game.find((g) => g.hits > 0)?.t).toBe(93);
    });

    it('the model reproduces it at 0 px, hits and the death included (t93, t113, t133 died)', async () => {
        const model = await l40LatchModelSamples(w.tape, {});
        expect(model.error).toBeNull();
        expect(compareCorpseBumpWitness(game, model.samples)).toEqual([]);
        expect(game.filter((g) => model.samples[g.t].hits !== g.hits)).toEqual([]);
        expect(model.hits.map((h) => [h.t, h.source, h.id, h.died])).toEqual([
            [93, 'sword', 'bobsoldier@880,832', false],
            [113, 'sword', 'bobsoldier@880,832', false],
            [133, 'sword', 'bobsoldier@880,832', true],
        ]);
    });

    it('OFF the solver stands on the latch for the fade and is moved at hold tick 93 (the brief\'s refusal)', async () => {
        const { out, refusal } = await l40LatchSolve(await l40LatchBoot(), {});
        expect(out).toBeNull();
        expect(refusal.message).toContain('hold: hold tick 93 of 131 MOVED, from (888,776)');
    }, 120_000);
});

describe('L40LATCH D1b — the orbit kill', () => {
    it(`the candidates: ${ORBIT_KILL.radii.length} radii × 2 directions × ${ORBIT_KILL.farSides.length} far-side arcs`, () => {
        expect(ORBIT_KILL_CANDIDATES.length).toBe(ORBIT_KILL.radii.length * 2 * ORBIT_KILL.farSides.length);
        expect(ORBIT_KILL_CANDIDATES.length).toBe(20);
        expect(ORBIT_KILL_CANDIDATES[0]).toEqual({ r: 22, dir: 1, safe: 110 * Math.PI / 180 });
    });

    // ⚠ MEASURED: 8 of the 20 candidates are hitless from this boot; the first (r 22 ccw, far 110°) is hit at t194,
    // and the solver's fork tries play the second (r 22 ccw, far 90°), as `l40latch-orbit-chain` records.
    it('candidate 1, driven from the latch boot in the model, kills bobsoldier@880,832 by t184 and is never hit', async () => {
        const boot = await l40LatchBoot();
        const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(boot)))), atlasLevelSource());
        const strike = strikePolicyFor(run, { dashMode: 'all' });
        let t = 0;
        for (; t < 420; t += 1) {
            const held = orbitKillPolicy(run, 'bobsoldier@880,832', ORBIT_KILL_CANDIDATES[1], strike);
            if (held === null) break;
            run.advance(held);
        }
        expect(t).toBe(184);
        expect(run.ledger('playerHits')).toEqual([]);
    });
});

describe('L40LATCH D1 — the solver\'s chain from the latch, on the game (`l40latch-orbit-chain`)', () => {
    const w = witness('l40latch-orbit-chain');
    const game = w.samples.map(unpackL40LatchSample);

    it('the recording: never hit, and the BobSoldier is gone from t184', () => {
        const checks = l40LatchOrbitChecks(game);
        expect(checks.map((c) => [c.name, c.ok])).toEqual(checks.map((c) => [c.name, true]));
        expect(w.tape.tick_count).toBe(271);
        expect(w.tape.refused).toContain('chaser:bob@736,800');
    });

    it('the model (D1 ON, and OFF: D1 is solver-only) reproduces it at 0 px', async () => {
        for (const over of [L40LATCH_D1_SWITCHES, { holdWaitPriced: false, chaserOrbitKill: false }]) {
            const model = await l40LatchModelSamples(w.tape, over);
            expect(model.error).toBeNull();
            expect(compareCorpseBumpWitness(game, model.samples)).toEqual([]);
            expect(model.hits).toEqual([]);
        }
    });

    it('the model: the latch publishes {t 3} on tick 1 and wandlock@480,560 is open from t101, during the fight', async () => {
        const { createTapeStepper } = await import('./tapeRunner.js');
        let run = null;
        const st = withContactFidelity(L40LATCH_D1_SWITCHES, () => createTapeStepper(parseTape(JSON.stringify(w.tape)),
            { levelSource: atlasLevelSource(), onTick: (tt, s, h, rn) => { run = rn; } }));
        let latchedAt = null;
        let openAt = null;
        for (let r = st.next(); !r.done; r = st.next()) {
            const t = r.value.observation.t;
            if (latchedAt === null && run && (run.entities('latchedGroups') ?? new Set()).has(3)) latchedAt = t;
            if (openAt === null && run && run.entities('openActivators').has('wandlock@480,560')) openAt = t;
        }
        expect(latchedAt).toBe(1);
        expect(openAt).toBe(101);
    });
});
