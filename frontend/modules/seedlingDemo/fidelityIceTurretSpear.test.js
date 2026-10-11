/**
 * ⛓⛓ SEEDLING HAMMER-PHASE C3 — L98's ice turret killed by the GHOST SPEAR through a wall, replayed against the game.
 *
 * `fixtures/iceturret-spear-witness/<arm>.json` holds a tape and the GAME's readings of it (p4f headless,
 * `scripts/procgen/probe-seedling-iceturret-spear.mjs --record`): the drained player stream and one `botMobiles()`
 * sample per game tick. The model reproduces the player at 0 px, the ice turret's `hits`/`hitsTimer` at every
 * sampled tick and its removal on the game's tick. `Player.spear()` has no `collideLine("Solid")` gate, so the
 * thrust from L98's west pocket reaches the turret through the wall (C3 D1), and with `ICE_TURRET_SPEAR_ARM` ON the
 * solver's own plan from sweep leg 745's arrival crosses to L99 on the game (C3 D2).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { classOf, gameBodyEvents, modelReadings } from './killLockWitness.js';
import { SPEAR_HIT_TICKS_UNMODELLED } from './presses.js';
import { ICE_TURRET_SPEAR_ARM, withIceTurretSpearArm } from './solverBot.js';
import { createTapeStepper } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import {
    armPlan, armTape, bodyDisagreements, ICETURRET_SPEAR_ARMS,
} from '../../../scripts/procgen/probe-seedling-iceturret-spear.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'fixtures', 'iceturret-spear-witness');
const ARMS = new Map(readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8'))).map((w) => [w.arm, w]));

describe('C3 D1 — the spear through the wall, on the game (c3-d1-l98-spear-west)', () => {
    const w = ARMS.get('c3-d1-l98-spear-west');
    const m = modelReadings(w.tape);

    it('the player\'s stream is the game\'s, observation for observation, at 0 px', () => {
        expect(w.game.ticks.length).toBe(m.ticks.length);
        w.game.ticks.forEach((o, i) => expect([o.level, o.x, o.y]).toEqual([m.ticks[i].level, m.ticks[i].x, m.ticks[i].y]));
        expect(gameBodyEvents(w.game.samples, m.ticks).calibrated).toBe(true);
    });

    it('the ice turret: two thrusts land (2 + 2 of hitsMax 3), "dead" on t36, its corpse drowns on t47 — tick for tick', () => {
        const { compared, bad } = bodyDisagreements(w.game.samples, m.bodies, classOf);
        expect(compared).toBeGreaterThan(100);
        expect(bad.filter((b) => b.cls === 'IceTurret')).toEqual([]);
        expect(m.died).toEqual({ 'iceturret@104,24': 36 });
        expect(m.gone).toEqual({ 'iceturret@104,24': 47 });
        const g = gameBodyEvents(w.game.samples, m.ticks).gone.IceTurret;
        expect(g).toEqual([{ lo: 47, hi: 47 }]);
        // the game's own turret rows at the landings: 2 at t4 (the t2 press), 4 at t35 (the t33 press)
        const at = (t) => w.game.samples.find((s) => s.t === t).rows.find((r) => r.cls === 'IceTurret');
        expect([at(4).hits, at(4).hitsTimer, at(35).hits, at(35).hitsTimer]).toEqual([2, 30, 4, 30]);
    });

    /**
     * ⛔ THE ONE DISAGREEMENT, NAMED FOR FIDELITY (C3's hand-over): `jellyfish@56,48` reaches the pocket, and the
     * second thrust's REPEAT hit lands on it in the game at t39 inside its i-frame (an earlier dark-shield bump latched
     * `hitByDarkStuff`). The model carries one landing a thrust (`SPEAR_HIT_TICKS_UNMODELLED`). A slice that models
     * the repeats turns this row red, by design.
     */
    it('the jellyfish rows disagree from t39 exactly as `SPEAR_HIT_TICKS_UNMODELLED` says (the game: hits 3, "die")', () => {
        expect(SPEAR_HIT_TICKS_UNMODELLED.ticks).toEqual([1, 3, 5]);
        const jelly = bodyDisagreements(w.game.samples, m.bodies, classOf).bad.filter((b) => b.cls === 'Jellyfish');
        expect(jelly[0]).toEqual({ t: 39, cls: 'Jellyfish', game: ['0/0', '0/0', '3/30'], model: ['0/0', '0/0', '1/19'] });
        const row = w.game.samples.find((s) => s.t === 39).rows.find((r) => r.cls === 'Jellyfish' && r.hits === 3);
        expect(row.anim).toBe('die');
    });
});

describe('C3 D2 — `ICE_TURRET_SPEAR_ARM` (OFF by default): the solver\'s ON plan crosses on the game (c3-l98-spear-l93)', () => {
    const w = ARMS.get('c3-l98-spear-l93');
    const m = modelReadings(w.tape);

    it('ships OFF (`SEEDLING_ICE_TURRET_SPEAR_ARM=1` opts in)', () => {
        expect(ICE_TURRET_SPEAR_ARM.enabled).toBe(globalThis.process?.env?.SEEDLING_ICE_TURRET_SPEAR_ARM === '1');
        expect(withIceTurretSpearArm(true, () => ICE_TURRET_SPEAR_ARM.enabled)).toBe(true);
        expect(withIceTurretSpearArm(false, () => ICE_TURRET_SPEAR_ARM.enabled)).toBe(false);
    });

    it('the game plays the plan: the player at 0 px, every body\'s rows and removal on the model\'s tick, L99, 0 hits', () => {
        expect(w.game.ticks.length).toBe(m.ticks.length);
        w.game.ticks.forEach((o, i) => expect([o.level, o.x, o.y]).toEqual([m.ticks[i].level, m.ticks[i].x, m.ticks[i].y]));
        const { compared, bad } = bodyDisagreements(w.game.samples, m.bodies, classOf);
        expect(compared).toBeGreaterThan(800);
        expect(bad).toEqual([]);
        expect(m.gone).toEqual({ 'jellyfish@72,104': 222, 'jellyfish@56,48': 278, 'jellyfish@176,72': 330,
            'iceturret@104,24': 501 });
        const ev = gameBodyEvents(w.game.samples, m.ticks);
        expect(ev.calibrated).toBe(true);
        expect(ev.gone.IceTurret).toEqual([{ lo: 501, hi: 501 }]);
        expect(w.game.ticks.at(-1).level).toBe(99);
        expect(w.game.status.hits).toBe(0);
        // the spear selected for the kill and the sword back after it (`equips`, the run clock)
        expect(w.tape.equips).toEqual([{ t: 454, slot: 3 }, { t: 501, slot: 0 }]);
    });

    it('the model\'s own replay ends in L99 with no player hit', () => {
        let run = null;
        const st = createTapeStepper(w.tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (!r.done) r = st.next();
        expect(run.ledger('playerHits')).toEqual([]);
        expect(run.level).toBe(99);
    });

    it('OFF the staging refuses with the sweep\'s words; ON it re-derives the committed tape byte for byte', { timeout: 600000 }, async () => {
        const arm = ICETURRET_SPEAR_ARMS.find((a) => a.name === 'c3-l98-spear-l93');
        const off = await armPlan(arm, false);
        expect(off.solved).toBe(null);
        expect(off.refusal.message).toMatch(arm.offRefusal);
        expect(JSON.stringify(await armTape(arm))).toBe(JSON.stringify(w.tape));
    });
});
