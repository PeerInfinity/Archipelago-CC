/**
 * Seedling fidelity MISCRES (wave 29): the small residues.
 *
 * D1 — REMBODY's residue, two switches (both OFF):
 *   `forecastCorpseFade`     `chaserForecastNow` steps a cloned corpse's fade (and a cloned "die" anim to `destroy`), so
 *                            a corpse stops being a sibling wall where the live run (the game) removes it. WITNESSED on p4g
 *                            by SKINSWING's `skinswing-l71-resite` (the forecast seeded at t58, the tape's presses mirrored
 *                            through the forecast's own `hit`).
 *   `nonChaserRemovalBlocks` a drill, wallflyer or ice turret removed this tick stays an "Enemy" wall to the movers stepped
 *                            after it this tick (`World.remove` queues). NO game witness reaches it (no AP_1 recording has
 *                            such a removal beside a later "Enemy" mover); the DRILLKILL p4g recordings, whose drills fade
 *                            out, are the byte-inertia rows: ON = OFF = the game.
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore; `evidence/mutants.txt`) ──
 *   m1 the forecast's destroy branch never fades (`c.alpha -= …` dropped)
 *        predicted: the t58 row reds.  MEASURED: 2 red — the t58 row and the t50..t62 seeds row.
 *   m2 the forecast never steps the clone's "die" anim to `destroy`
 *        predicted: nothing reds.  MEASURED: 1 red — the t50 seed clones bodies still in "die", so the anim arm IS
 *        witnessed (my prediction read only the t58 seed, where every corpse is already `destroy`).
 *   m3 `removedThisTickStillBlocks` ignores the tick (a removed body is a wall forever)
 *        predicted: the drill rows red.  MEASURED: 0 red — no recording has a drill hop (or a chaser sweep) into a dead
 *        drill's box, so `nonChaserRemovalBlocks` has NO discriminating row: it is the game's rule transcribed, unwitnessed.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SKINSWING_WITNESS_DIR, compareSkinSwing, skinSwingModelSamples } from './fidelitySkinSwing.js';
import { DRILLKILL_WITNESS_DIR, DRILLKILL_WITNESSES, DRILLKILL_SWITCHES, compareDrillKillWitness, drillKillModelSamples }
    from './fidelityDrillKill.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';

const loadSkin = (name) => JSON.parse(readFileSync(join(SKINSWING_WITNESS_DIR, `${name}.json`), 'utf8'));
const loadDrill = (name) => JSON.parse(readFileSync(join(DRILLKILL_WITNESS_DIR, `${name}.json`), 'utf8'));

/**
 * The chaser forecast taken at tick `from` of `skinswing-l71-resite`, stepped beside the live run (the game at 0 px
 * with `removedBodyBlocks` ON) for `n` ticks. The tape presses the sword; a live body whose `hits` rose this tick takes
 * the same press in the forecast (`hit(id, playerPos)`, the strike policy's own call, from the start-of-tick player).
 * @returns {Array<{t, live, proj, worst}>} per tick: live bodies (not removed, not destroyed), projected, the worst px
 */
function forecastBesideLive(over, from, n) {
    const rec = loadSkin('skinswing-l71-resite');
    return withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(parseTape(JSON.stringify(rec.tape)),
            { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (r.value.observation.t < from) r = st.next();
        const fc = run.chaserForecast();
        const rows = [];
        for (let t = from + 1; t <= from + n; t += 1) {
            const before = { ...run.state };
            const hitsBefore = new Map(run.chasers.map((c) => [c.id, c.hits]));
            const proj = fc.step(before);
            r = st.next();
            for (const c of run.chasers) {
                if (!c.removed && c.hits > (hitsBefore.get(c.id) ?? c.hits)) fc.hit(c.id, before);
            }
            const live = run.chasers.filter((c) => !c.removed && !c.destroy);
            let worst = 0;
            for (const c of live) {
                const f = proj.find((p) => p.id === c.id);
                worst = Math.max(worst, f ? Math.max(Math.abs(f.x - c.x), Math.abs(f.y - c.y)) : Infinity);
            }
            rows.push({ t, live: live.length, proj: proj.length, worst });
        }
        return rows;
    });
}
const firstOff = (rows) => rows.find((r) => r.worst > 1e-9) ?? null;

describe('fidelity MISCRES D1 — the switches', () => {
    it('both ship OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.forecastCorpseFade).toBe(false);
        expect(CONTACT_FIDELITY_DEFAULTS.nonChaserRemovalBlocks).toBe(false);
    });
});

describe('fidelity MISCRES D1 — `forecastCorpseFade`: the L71 resite witness (p4g), forecast against live', () => {
    // t58: three corpses fading (removed on t63, the game's frame); t95 the room restarts (the player died) — no forecast
    // follows a restart, so the window ends at t94.
    it('seeded at t58: ON the forecast equals the live run (= the game) through t94; OFF it leaves at t64', () => {
        const on = forecastBesideLive({ removedBodyBlocks: true, forecastCorpseFade: true }, 58, 36);
        expect(firstOff(on)).toBeNull();
        const off = forecastBesideLive({ removedBodyBlocks: true, forecastCorpseFade: false }, 58, 36);
        const o = firstOff(off);
        expect(o.t).toBe(64);
        expect(o.worst).toBeCloseTo(1.164, 3);
        expect(Math.max(...off.map((r) => r.worst))).toBeGreaterThan(8);
    });
    it('seeded at t50..t62 (the corpses cloned while fading): ON holds 0 px to t94 from every seed', () => {
        for (const from of [50, 55, 60, 62]) {
            const on = forecastBesideLive({ removedBodyBlocks: true, forecastCorpseFade: true }, from, 94 - from);
            expect([from, firstOff(on)]).toEqual([from, null]);
        }
    });
    it('the live run is untouched by the switch: ON the model is the game for all 300 ticks', async () => {
        const rec = loadSkin('skinswing-l71-resite');
        const on = await skinSwingModelSamples(rec.tape, { removedBodyBlocks: true, forecastCorpseFade: true });
        expect(on.error).toBeNull();
        expect(compareSkinSwing(rec.samples, on.samples)).toEqual([]);
    });
});

describe('fidelity MISCRES D1 — `nonChaserRemovalBlocks`: the DRILLKILL recordings (p4g), byte-inert where no mover meets the corpse', () => {
    const ONK = { ...DRILLKILL_SWITCHES, nonChaserRemovalBlocks: true };
    it.each(DRILLKILL_WITNESSES.map((w) => [w.name]))('%s: ON the model is still the game on every sampled tick', async (name) => {
        const rec = loadDrill(name);
        const model = await drillKillModelSamples(rec.tape, ONK);
        expect(model.error).toBeNull();
        expect(compareDrillKillWitness(rec.samples, model.samples, rec.tape.boot.level)).toEqual([]);
    }, 120000);
    it('a drill\'s removal is stamped with its tick ON (and read on that tick only); OFF no stamp is written', () => {
        const w = DRILLKILL_WITNESSES.find((x) => x.boot.x === 16 && x.script.goals);
        const rec = loadDrill(w.name);
        const stamps = (over) => withContactFidelity(over, () => {
            let run = null;
            const st = createTapeStepper(parseTape(JSON.stringify(rec.tape)),
                { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
            const out = [];
            let r = st.next();
            const seen = new Set();
            while (!r.done) {
                for (const d of run?.drills.bodies ?? []) {
                    if (d.removed && !seen.has(d.id)) { seen.add(d.id); out.push({ id: d.id, t: r.value.observation.t, stamp: d.removedTick ?? null }); }
                }
                r = st.next();
            }
            return out;
        });
        const on = stamps(ONK);
        expect(on.length).toBe(2);
        for (const s of on) expect(s.stamp).toBe(s.t);
        expect(stamps(DRILLKILL_SWITCHES).map((s) => s.stamp)).toEqual([null, null]);
    }, 120000);
});
