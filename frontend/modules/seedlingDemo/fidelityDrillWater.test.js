/**
 * Seedling fidelity DRILLWATER (wave 37e): a drill runs `Enemy.update`'s terrain switch (`CONTACT_FIDELITY.
 * drillTerrainSwitch`, OFF) — water and lava set `destroy`, a pit latches the fall (centring pull, `alpha -= 0.05`,
 * `destroy` + `fell`); `fallSpinSpeed` is cosmetic RNG and never modelled.
 *
 *   · W0: of the four shipped drills only L91's `drill@64,80` has a fatal tile in its hop reach (water (40,120), 4 hops)
 *     — L28's two and L88's reach none, so no lava or pit game witness exists (the pit/lava arms are pinned on the
 *     unit below, against `Enemy.as` line by line).
 *   · D1 (the game): `fixtures/drillwater-witness/` (`probe-seedling-drill-water.mjs --record`, p4g), replayed here with
 *     the key ON at 0 px: the player, the drill's position, anim and `destroy`, and its removal tick. `drown`: hop onto
 *     the water at t16, `destroy` t17, removed t27, hitless. `floor` (the control): two hops onto plain floor, the
 *     drill stays, hits t17 / t37.
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore) ──
 *   m1 the switch reads nothing (`tileTypeAt` never asked)
 *        -> `drillwater-l91-drown` reds at t17: the game's `destroy` true, the model's false.
 *   m2 the switch runs AFTER the hop, on the same tick (the cell it lands on, read at once)
 *        -> `drillwater-l91-drown` reds at t16: the model's `destroy` a tick early.
 *   m3 a destroyed drill still bills its contact (the `!destroy` gate dropped from `hitPlayer`)
 *        -> no witness reds (the drown is hitless: the player is never inside the box) — the unit below reds.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { DRILL, DRILL_TERRAIN, newDrill, stepDrill } from './drill.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { DRILL_WATER_SWITCHES, DRILL_WATER_WITNESS_DIR, DRILL_WATER_WITNESSES, compareDrillWaterWitness,
    drillWaterModelSamples } from './fidelityDrillWater.js';

const load = (name) => JSON.parse(readFileSync(join(DRILL_WATER_WITNESS_DIR, `${name}.json`), 'utf8'));

describe('fidelity DRILLWATER — the key', () => {
    it.skipIf(!!process.env.SEEDLING_DRILL_TERRAIN_SWITCH || !!process.env.SEEDLING_CONTACT_FIDELITY)(
        'ships ON (⚖ user 2026-11-08, the DRILLWATER flip), last in the defaults, with its env name in the worker table', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.drillTerrainSwitch).toBe(true);
            expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).at(-1)).toBe('drillTerrainSwitch');
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_DRILL_TERRAIN_SWITCH');
        });
});

describe('fidelity DRILLWATER — D1: the game witnesses at 0 px (key ON)', () => {
    it.each(DRILL_WATER_WITNESSES.map((w) => w.name))('%s', async (name) => {
        const rec = load(name);
        expect(rec.page).toBe('seedling_bot_ap_p4g');
        const model = await drillWaterModelSamples(rec.tape);
        expect(model.error).toBeNull();
        expect(compareDrillWaterWitness(rec.samples, model.samples)).toEqual([]);
    });

    it('drown: the game\'s drill drowns at t17 and is gone at t27, and the player is never hit', () => {
        const rec = load('drillwater-l91-drown');
        const at = (t) => rec.samples.find((s) => s.t === t);
        expect(at(16).drills).toMatchObject([{ x: 40, y: 120, destroy: false }]);
        expect(at(17).drills).toMatchObject([{ x: 40, y: 120, destroy: true }]);
        expect(at(26).drills).toHaveLength(1);
        expect(at(27).drills).toHaveLength(0);
        expect(rec.samples.every((s) => s.hits === 0)).toBe(true);
    });

    it('floor (the control): the drill stays where it hopped and keeps its contact', () => {
        const rec = load('drillwater-l91-floor');
        expect(rec.samples.every((s) => s.drills.length === 1 && s.drills[0].destroy === false)).toBe(true);
        expect(rec.samples.at(-1).hits).toBeGreaterThan(0);
    });

    it('OFF: the drown tape is refused by name (the DRILL D2 refusal), not walked on', async () => {
        const model = await drillWaterModelSamples(load('drillwater-l91-drown').tape,
            { ...DRILL_WATER_SWITCHES, drillTerrainSwitch: false });
        expect(model.error).toMatch(/hops onto tile type 1 at \(40,120\) on tick 16; `Enemy\.update`'s terrain switch/);
    });
});

/** One on-screen `Drill.update` of a body standing on tile `t`, the player far away. */
function stepOn(d, t, extra = {}) {
    return stepDrill(d, {
        frozen: false, onScreen: () => true, playerBox: null, player: null, lineBlocked: () => true,
        collides: () => false, hitPlayer: (b) => b, tileTypeAt: () => t, ...extra,
    }).d;
}

describe('fidelity DRILLWATER — the switch, against `Enemy.as:62-112`', () => {
    const on = (fn) => withContactFidelity({ drillTerrainSwitch: true }, fn);
    const base = newDrill({ id: 'drill@0,0', x: 64, y: 80 });

    it('water and lava: `destroy`, the 0.1 `Mobile.death` fade the same tick, removed at alpha <= 0', () => on(() => {
        for (const t of [DRILL_TERRAIN.water, DRILL_TERRAIN.lava]) {
            let d = stepOn(base, t);
            expect(d.destroy).toBe(true);
            expect(d.terrainDeath).toBe(t === DRILL_TERRAIN.water ? 'water' : 'lava');
            expect(d.alpha).toBeCloseTo(0.9, 12);
            let n = 1;
            while (!d.removed) { d = stepOn(d, t); n += 1; }
            expect(n).toBe(11); // 1 - 0.1 x 10 is 1.4e-16 > 0 in doubles: the eleventh fade removes
        }
    }));

    it('a destroyed drill bills no contact', () => on(() => {
        let called = 0;
        const box = { x: 0, y: 0, right: 1000, bottom: 1000 };
        stepOn(base, DRILL_TERRAIN.water, { playerBox: box, hitPlayer: (b) => { called += 1; return b; } });
        expect(called).toBe(0);
        stepOn(base, 0, { playerBox: box, hitPlayer: (b) => { called += 1; return b; } });
        expect(called).toBe(1);
    }));

    it('pit: the latch, the centring pull /10, alpha -0.05 a tick, `destroy` + `fell` at 0, removed next tick', () => on(() => {
        let d = stepOn({ ...base, x: 70, y: 90 }, DRILL_TERRAIN.pit);
        expect(d.fallInPit).toBe(true);
        expect(d.destroy).toBe(false);
        expect(d.x).toBeCloseTo(70 + (72 - 70) / 10, 12);
        expect(d.y).toBeCloseTo(90 + (88 - 90) / 10, 12);
        expect(d.alpha).toBeCloseTo(0.95, 12);
        let n = 1;
        while (!d.destroy) { d = stepOn(d, 0); n += 1; } // the latch holds off the pit cell too
        expect(n).toBe(20);
        expect(d.fell).toBe(true);
        expect(d.removed).toBe(false);
        d = stepOn(d, DRILL_TERRAIN.pit);
        expect(d.removed).toBe(true);
    }));

    it('a falling drill bills no contact (the descent replaces `super.update()`)', () => on(() => {
        let called = 0;
        stepOn(base, DRILL_TERRAIN.pit, { playerBox: { x: 0, y: 0, right: 1000, bottom: 1000 },
            hitPlayer: (b) => { called += 1; return b; } });
        expect(called).toBe(0);
    }));

    it('off screen the switch does not run (`Enemy.update`\'s first return)', () => on(() => {
        const d = stepOn(base, DRILL_TERRAIN.water, { onScreen: () => false });
        expect(d.destroy).toBe(false);
    }));

    it('OFF: the switch is absent (no field is written)', () => {
        withContactFidelity({ drillTerrainSwitch: false }, () => {
            const d = stepOn(base, DRILL_TERRAIN.water);
            expect(d).toEqual({ ...base });
        });
        expect(DRILL.alphaFade).toBe(0.1);
    });
});
