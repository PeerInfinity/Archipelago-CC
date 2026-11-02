/**
 * seedling-fidelity-corpsebump2 (wave 36) — A BUMPED CORPSE IS READ WHERE IT IS PRESSED (`corpseBumpRestRead`, OFF).
 *
 * ⛓ W0 (LWEIGH's hand-over): on L40LATCH's latch chain with CPAIR size 3, `LATCH_WEIGH_FIRST`, `orbitFreeAim` and
 * `strategyBoundDistinct` ON and `turretSnapPricing` OFF, `execCorpseWeigh`'s bump 2 was refused inside `runFire`:
 * *"iceturret@472,400 is ALREADY on (30,24)"*. The two reads are ONE rule (the corpse's ENTITY tile, `floor(x/16)`);
 * the corpse moved between them. Bump 1 rests it on (30,25) at y 408 (a true rest: the two-cycle 408 ↔ 407.5), and
 * the walk to bump 2's stance is driven with Fire still selected, so its strike/dash policy's X press on the walk's
 * first tick is a Fire press: the corpse glides on to (30,24) during the walk. The game does the same (p4g, 0 px):
 * `corpsebump2-walk-press` is the solver's own first 1400 ticks with the key ON (`probe-seedling-l40latch.mjs`).
 * ⛓ D1: ON, the corpse is re-read at the stance; the bump the walk made is waited to rest and not made again.
 * The solves (OFF's refusal, ON's chain) are `fidelityCorpseBump2.slow.test.js`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { compareCorpseBumpWitness } from './fidelityCorpseBump.js';
import { CORPSEBUMP2_CUT, CORPSEBUMP2_SWITCHES, L40LATCH_WITNESS_DIR, L40LATCH_WITNESSES, corpseBump2Checks,
    l40LatchModelSamples, unpackL40LatchSample } from './fidelityL40Latch.js';

const TURRET = 'iceturret@472,400';
const w = JSON.parse(readFileSync(join(L40LATCH_WITNESS_DIR, 'corpsebump2-walk-press.json'), 'utf8'));
const game = w.samples.map(unpackL40LatchSample);

describe('CORPSEBUMP2 — the switch', () => {
    // ⛓ shipped OFF (wave 36); ⚖ (user, 2026-11-02, "Flip all four") ON since the W36 flip.
    it('ships ON', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.corpseBumpRestRead).toBe(true);
        if (!process.env.SEEDLING_CORPSE_BUMP_REST_READ) expect(CONTACT_FIDELITY.corpseBumpRestRead).toBe(true);
    });

    it('the witness is registered with the probe, under its arm\'s contact keys', () => {
        expect(L40LATCH_WITNESSES['corpsebump2-walk-press'].switches).toBe(CORPSEBUMP2_SWITCHES);
        expect(CORPSEBUMP2_SWITCHES).toEqual({ turretSnapPricing: false, orbitFreeAim: true,
            strategyBoundDistinct: true, corpseBumpRestRead: true });
    });
});

describe('CORPSEBUMP2 — the walk\'s Fire press, on the game (`corpsebump2-walk-press`)', () => {
    it('the recording: never hit; the corpse rests (30,26) → (30,25) → (30,24) and stays', () => {
        expect(w.tape.tick_count).toBe(CORPSEBUMP2_CUT);
        expect(game).toHaveLength(CORPSEBUMP2_CUT);
        const checks = corpseBump2Checks(game);
        expect(checks.map((c) => [c.name, c.ok])).toEqual(checks.map((c) => [c.name, true]));
    });

    it('the model reproduces it at 0 px with the arm\'s keys ON, and OFF (all four are solver-only)', async () => {
        const off = Object.fromEntries(Object.keys(CORPSEBUMP2_SWITCHES).map((k) => [k, false]));
        for (const over of [CORPSEBUMP2_SWITCHES, off]) {
            const model = await l40LatchModelSamples(w.tape, over);
            expect(model.error).toBeNull();
            expect(compareCorpseBumpWitness(game, model.samples)).toEqual([]);
            expect(model.hits).toEqual([]);
        }
    });

    it('the model: two Fire presses move the corpse — bump 1, then the walk\'s own press — and the t2 lock opens', async () => {
        const { createTapeStepper } = await import('./tapeRunner.js');
        let run = null;
        const st = withContactFidelity(CORPSEBUMP2_SWITCHES, () => createTapeStepper(parseTape(JSON.stringify(w.tape)),
            { levelSource: atlasLevelSource(), onTick: (tt, s, h, rn) => { run = rn; } }));
        const firePresses = [];
        const tiles = [];
        let openAt = null;
        let prevHeld = new Set();
        for (let r = st.next(); !r.done; r = st.next()) {
            const t = r.value.observation.t;
            const held = new Set(r.value.held ?? []);
            const c = run.entities('turrets').get(TURRET);
            const tile = `${Math.floor(c.x / 16)},${Math.floor(c.y / 16)}`;
            if (c.dead && tiles.at(-1)?.tile !== tile) tiles.push({ t, tile });
            // the slot the tape has selected at t (its equips), Fire = the boot inventory's slot 1
            const slot = [...w.tape.equips].filter((e) => e.t <= t).at(-1)?.slot ?? 0;
            if (t < 1301 && held.has('primary') && !prevHeld.has('primary') && slot === 1) {
                firePresses.push({ t, x: Math.round(run.state.x), y: Math.round(run.state.y) });
            }
            prevHeld = held;
            if (openAt === null && run.entities('openActivators').has('wandlock@448,432')) openAt = t;
        }
        expect(tiles).toEqual([{ t: 1006, tile: '30,26' }, { t: 1089, tile: '30,25' }, { t: 1207, tile: '30,24' }]);
        expect(firePresses).toEqual(FIRE_PRESSES);
        expect(openAt).toBe(1301);
    });
});

/** The tape's Fire presses before the lock opens (measured): bump 1 from its stance (488,440), then the walk's own. */
const FIRE_PRESSES = [{ t: 1068, x: 488, y: 440 }, { t: 1182, x: 488, y: 440 }];
