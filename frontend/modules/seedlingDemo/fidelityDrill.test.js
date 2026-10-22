/**
 * Seedling fidelity DRILL (wave 24): every drill of a MIXED room is stepped, behind `CONTACT_FIDELITY.drillMixedRooms`
 * (OFF), and ROPESTANCE's drill interim retires behind the same key.
 *
 *   · W0: the atlas holds three drill rooms — L88 (the drill alone, stepped since TERRAIN W3), L28 (`drill@80,96`,
 *     `drill@128,96`, `bobsoldier@264,168`) and L91 (`drill@64,80` with three bobs). `Drill.solids` is `Mobile.solids`
 *     plus "Enemy" (`Drill.as:35`), so a hop is stopped by another drill or a chaser's box.
 *   · D1 (the game): `fixtures/drill-witness/` (`probe-seedling-drill-mixed.mjs --record`, p4g), replayed here against
 *     the model with the key ON at 0 px — the player, both drills (position and anim) and the bobsoldier, every tick.
 *   · D2 (the model): `levelRun.drillStateFor` admits every drill of a room; `stepDrillsNow` walks them in the game's
 *     update order and their hop reads the other "Enemy" bodies live; the drill's sight line samples the pixelmasks;
 *     the spear's T+3 / T+5 tests and its exact rect (`int` origin, inclusive `collideRect`) reach a drill.
 *   · D3: `solverBot.unsteppedDrills` returns none, `ropeStanceAdmit` is `pullStanceAdmit`, and a rope cut that fails
 *     after a drill's contact refuses naming that drill.
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore) ──
 *   m1 `drillEnemyBodiesTest` skips the other drills
 *        -> `drill-l28-pair` reds: `drill@128,96`'s t16 x-hop lands on `drill@80,96`'s cell.
 *   m2 `stepDrillsNow` walks the drills in placement order (no reverse)
 *        -> `drill-l28-pair` reds (the first updater reads the other where the previous tick left it).
 *   m3 the drill's line samples no pixelmask (`{ masks: false }`)
 *        -> `drill-l28-cliffside` reds: `drill@128,96` hops at t65.
 *   m4 `drillSpearRepeatsNow` returns at once (no T+3 / T+5 test)
 *        -> `drill-l28-spear-l25` reds: the game's `drill@80,96` reads "hit" at t73, the model's "drill".
 *   m5 `spearTouchesDrill` uses the untruncated origin
 *        -> `drill-l28-spear-l25` reds at t73, as m4.
 *   m6 `drillEnemyBodiesTest` skips the chasers
 *        -> `drill-l91-bob` reds: `drill@64,80`'s x-hop lands on `bob@128,64`.
 *   m7 `drillWallsNow` returns [] (a bob walks through a live drill)
 *        -> `drill-l91-bob-wall` reds at t41 (the first run of m7, before that witness existed, stayed green: the term
 *           was unwitnessed, and a search of L91 boots with m7 against the key found the case).
 * Measured: all red as predicted (m1 also reds `drill-l28-spear-l25`, m2 also the refusal row — the first drill to ask
 * its hop test is the other one).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { combatCensusOf } from './levelWorld.js';
import { solveSegment, SolverRefusal } from './solverBot.js';
import { staticEnemyDanger } from './dangerMap.js';
import { DRILL_WITNESS_DIR, DRILL_WITNESSES, compareDrillWitness, drillModelSamples } from './fidelityDrill.js';

const SRC = atlasLevelSource();
const ON = (fn) => withContactFidelity({ drillMixedRooms: true }, fn);
const OFF = (fn) => withContactFidelity({ drillMixedRooms: false }, fn);
const load = (name) => JSON.parse(readFileSync(join(DRILL_WITNESS_DIR, `${name}.json`), 'utf8'));
const L28_CUT = Object.freeze({ kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 },
    obstacle: 'rope@160,64' });
const FROM_L25 = Object.freeze({ level: 28, x: 96, y: 16 });

describe('fidelity DRILL — W0: the drill rooms', () => {
    it('the atlas holds three drill rooms, and two are mixed', () => {
        const rooms = [];
        for (let n = 0; n < 116; n += 1) {
            let rec;
            try { rec = SRC(n); } catch { continue; }
            if (!(rec.entities ?? []).some((e) => e.type === 'drill')) continue;
            rooms.push([n, combatCensusOf(rec).enemies.map((e) => `${e.tag}@${e.x},${e.y}`)]);
        }
        expect(rooms).toEqual([
            [28, ['drill@80,96', 'drill@128,96', 'bobsoldier@264,168']],
            [88, ['drill@128,160']],
            [91, ['bob@128,64', 'bob@160,96', 'bob@192,80', 'drill@64,80']],
        ]);
    });
});

describe('fidelity DRILL — the switch', () => {
    it('is OFF by default', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.drillMixedRooms).toBe(false);
        expect(CONTACT_FIDELITY.drillMixedRooms).toBe(false);
    });
    it.each([[28, { x: 96, y: 64 }, ['drill@80,96', 'drill@128,96']], [91, { x: 64, y: 48 }, ['drill@64,80']]])(
        'L%i: OFF no drill is stepped; ON every drill is', (level, at, ids) => {
            // ⚠ the roster is built on its first ask, so it is read INSIDE the switch
            const ask = (fn) => fn(() => createRunForStaging(arrivalStaging({ level, ...at }, { items: ['hasSpear'] }), SRC)
                .drills.bodies.map((d) => d.id));
            expect(ask(OFF)).toEqual([]);
            expect(ask(ON)).toEqual(ids);
        });
    it('L88 (the lone drill) is the same body either way', () => {
        const mk = () => createRunForStaging(arrivalStaging({ level: 88, x: 120, y: 120 }, { items: ['hasSpear'] }), SRC)
            .drills.bodies;
        expect(ON(mk)).toEqual(OFF(mk));
        expect(ON(mk).map((d) => d.id)).toEqual(['drill@128,160']);
    });
    it('a moving "Enemy" body the run does not step is refused by name when a hop asks for it', () => {
        // the bobsoldier unbridged (`bobSoldierLive` OFF): its position is unknown to the drill's hop test
        const err = withContactFidelity({ drillMixedRooms: true, bobSoldierLive: false }, () => {
            const run = createRunForStaging(arrivalStaging({ level: 28, x: 96, y: 64 }, { items: ['hasSpear'] }), SRC);
            try { run.advance(new Set()); } catch (e) { return e; }
            return null;
        });
        expect(err?.message).toMatch(/drill@128,96 in level 28 asks its hop test/);
        expect(err?.message).toMatch(/\[bobsoldier@264,168\]/);
    });
});

describe('fidelity DRILL — D2: the danger map prices a stepped drill where it stands', () => {
    // L28, the player at (104,72): on t1 `drill@128,96` hops (136,104) -> (120,88), `drill@80,96` (88,104) -> (104,88)
    const box = (cx, cy) => ({ x: cx - 4, y: cy - 4, right: cx + 4, bottom: cy + 4 });
    const after1 = (fn) => fn(() => {
        const run = createRunForStaging(arrivalStaging({ level: 28, x: 96, y: 64 }, { items: ['hasSpear'] }), SRC);
        run.advance(new Set());
        return { atPlacement: staticEnemyDanger(run, box(136, 104)).map((d) => d.id),
            atLive: staticEnemyDanger(run, box(120, 88)).map((d) => d.id) };
    });
    it('OFF: at its placement (byte-identical)', () => {
        expect(after1(OFF)).toEqual({ atPlacement: ['drill@128,96'], atLive: [] });
    });
    it('ON: at its live box, and no longer at the placement it left', () => {
        expect(after1(ON)).toEqual({ atPlacement: [], atLive: ['drill@128,96'] });
    });
});

const RECORDED = readdirSync(DRILL_WITNESS_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();

describe('fidelity DRILL — D1: the game witnesses, replayed against the model (the key ON) at 0 px', () => {
    it('every witness is recorded', () => {
        expect(RECORDED).toEqual(DRILL_WITNESSES.map((w) => w.name).sort());
    });
    it.each(RECORDED)('%s', async (name) => {
        const w = load(name);
        const model = await drillModelSamples(w.tape);
        expect(model.error).toBeNull();
        expect(w.samples.length).toBeGreaterThan(50);
        expect(compareDrillWitness(w.samples, model.samples, w.tape.boot.level)).toEqual([]);
    });
    it('the controls: OFF, the model does not reproduce them (the witnesses discriminate)', async () => {
        const off = { drillMixedRooms: false };
        for (const name of RECORDED) {
            const w = load(name);
            const model = await drillModelSamples(w.tape, off);
            expect(compareDrillWitness(w.samples, model.samples, w.tape.boot.level).length, name).toBeGreaterThan(0);
        }
    });
    it('drill-l28-spear-l25: the game\'s hit at t59, at the model\'s point', () => {
        const w = load('drill-l28-spear-l25');
        const t59 = w.samples.find((s) => s.t === 59);
        expect(t59).toMatchObject({ x: 129.34416718774472, y: 72.01906775986716, hits: 1 });
        expect(w.samples.find((s) => s.t === 58).hits).toBe(0);
    });
});

describe('fidelity DRILL — D3: ROPESTANCE\'s interim retires behind the key', () => {
    const solve = (items) => {
        const run = createRunForStaging(arrivalStaging(FROM_L25, { items }), SRC);
        try {
            return { run, out: solveSegment({ run, goals: [{ ...L28_CUT }], name: 'drill-d3', boot: FROM_L25 }),
                refusal: null };
        } catch (e) {
            if (!(e instanceof SolverRefusal)) throw e;
            return { run, out: null, refusal: e };
        }
    };
    const both = (on, fn) => withContactFidelity({ ropeCutAnyWeapon: true, drillMixedRooms: on }, fn);
    it('OFF: the L28 spear from the L25 arrival refuses on the interim (byte-identical)', () => both(false, () => {
        const { refusal } = solve(['hasSpear']);
        expect(refusal.message).toMatch(/UNSTEPPED drill \(\[drill@80,96, drill@128,96\]/);
    }));
    it('ON: the stance (136,72) is walked, and the cut refuses naming drill@128,96 at t59 (the game\'s tick)', () => both(true, () => {
        const { refusal } = solve(['hasSpear']);
        expect(refusal).not.toBeNull();
        expect(refusal.obstacle).toMatchObject({ kind: 'solid', id: 'rope@160,64', drill: 'drill@128,96' });
        expect(refusal.message).toMatch(/the stepped drill@128,96 hopped onto the player at run tick 59/);
        expect(refusal.message).not.toMatch(/UNSTEPPED/);
    }), 120000);
    it.each([['Fire', ['hasFire'], 89], ['the Sword', ['hasSword'], 52]])(
        'ON: %s from the L25 arrival plans what OFF plans', (_, items, ticks) => {
            const off = both(false, () => solve(items));
            const on = both(true, () => solve(items));
            expect(on.out.perTick.length).toBe(ticks);
            expect(on.out.perTick.map((h) => [...h].join('+'))).toEqual(off.out.perTick.map((h) => [...h].join('+')));
        }, 120000);
});
