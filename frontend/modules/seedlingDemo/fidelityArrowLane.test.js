/**
 * SEEDLING FIDELITY ARROWLANE — ⚖ the user, 2026-10-16: "arrows aren't supposed to be dodgeable". An ARMED trap's
 * lane is crossed the way the game crosses it: the arrows that reach the walk are BILLED (`arrowLaneCrossing.js`,
 * behind `CONTACT_FIDELITY.arrowLaneCrossing`, OFF).
 *
 * D1 — the game witness (p4f headless, `probe-seedling-chaser-mobiles.mjs --class=Bob --player-hits --record`): L16's
 * arrival from L17 stands IN `arrowtrap@112,32`'s lane at (120,56). Standing, the game bills the volley at t6
 * (`hits` 1, i-frame 19, knocked to (120,51.25)); walking right it bills it at t6 too (knocked to (130.84,53.34));
 * walking down it takes the stairs to L17 at t6 with no hit. The model reproduces all three at 0 px, and its Bobs.
 * D2 — the arm: the walk that STARTS in a lane is certified on a fork and billed; OFF it is refused at the gate.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS } from './contactFidelity.js';
import { ARROW_LANE_CROSSING, LaneCrossingExcept, admitLaneCrossing, isLaneArrowHit, laneCrossingExcept,
    withArrowLaneCrossing } from './arrowLaneCrossing.js';
import { KNOWN_STRATEGY_VERBS } from './decisionTrace.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { arrivalSolverGoal, arrivalSolveRequest } from './wasmArrival.js';
import { createInPlaceProduceService } from './wasmWalkTape.js';
import { ANYTIME_PASSES } from './jsRuntimeSolver.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `${n}.json`), 'utf8'));
const levelSource = atlasLevelSource();
const MAP = JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
const RECS = new Map(indexLevels(MAP));
const SRC = levelSourceFromAtlas(RECS);
const ENV_SET = !!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_ARROW_LANE_CROSSING;

/** Sphere 0's items (the divergence sweep's row for every L16 leg): no sword, no shield. */
const ITEMS_0 = {
    hitsMax: 3, hasTorch: false, hasDarkSuit: false, hasSpear: false, hasFeather: false, canSwim: false,
    hasFireWand: false, hasWand: false, hasFire: false, hasDarkShield: false, hasShield: false, hasGhostSword: false,
    hasDarkSword: false, hasSword: false,
};

/** A sweep leg at L16's arrival from L17 (112,48), solved in node as the bare pass does. */
function solveL16FromL17(tile, name) {
    const rt = createJsRuntime();
    rt.setVanilla(RECS);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [16, 112, 48] }]);
    rt.tick();
    const s = rt.session.staging;
    const staging = { ...s, inventory_slots: [], seam: { ...s.seam, items: { ...s.seam.items, ...ITEMS_0 } } };
    const goal = { kind: 'exit', level: 16, tiles: [tile], name };
    const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(16) });
    const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS,
        scratchPersistence: true }), passes: ANYTIME_PASSES };
    return createInPlaceProduceService().start(req).result;
}

describe('ARROWLANE — the switch and its pieces', () => {
    it.skipIf(ENV_SET)('ships OFF, and `withArrowLaneCrossing` restores it', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.arrowLaneCrossing).toBe(false);
        expect(ARROW_LANE_CROSSING.enabled).toBe(false);
        expect(withArrowLaneCrossing(true, () => ARROW_LANE_CROSSING.enabled)).toBe(true);
        expect(ARROW_LANE_CROSSING.enabled).toBe(false);
    });
    it('is a contact switch added right after SEALDOOR\'s (a row added, none reordered) and `arrow-lane` is a known verb', () => {
        // ⛓ wave-18 harvest: AXETIMING's two switches land after it, so "the LAST" became "right after sealDoorApproach".
        expect(CONTACT_FIDELITY_KEYS.indexOf('arrowLaneCrossing'))
            .toBe(CONTACT_FIDELITY_KEYS.indexOf('sealDoorApproach') + 1);
        expect(KNOWN_STRATEGY_VERBS).toContain('arrow-lane');
        expect(KNOWN_STRATEGY_VERBS.at(-1)).toBe('pace');
    });
    it('the exclusion answers for the lane AND its arrows, and keeps the walk\'s own', () => {
        const ex = laneCrossingExcept(new Set(['bob@1,2']), ['arrowtrap@112,32']);
        expect(ex).toBeInstanceOf(LaneCrossingExcept);
        expect(ex.has('bob@1,2')).toBe(true);
        expect(ex.has('arrowtrap@112,32')).toBe(true);
        expect(ex.has('arrowtrap@112,32#0.1')).toBe(true);
        expect(ex.has('arrowtrap@96,32#0.1')).toBe(false);
        expect(ex.has('arrowtrap@96,32')).toBe(false);
        expect(isLaneArrowHit({ source: 'arrow', id: 'arrowtrap@112,32#3.2' }, ['arrowtrap@112,32'])).toBe(true);
        expect(isLaneArrowHit({ source: 'chaser', id: 'arrowtrap@112,32#3.2' }, ['arrowtrap@112,32'])).toBe(false);
    });
    it('the admission: never a death, only the engaged lanes\' arrows, the forced-hit budget', () => {
        const base = { laneIds: ['arrowtrap@112,32'], hitsMax: 3, hitsNow: 0, budgetLeft: 2, maxHitsPerCrossing: 1,
            margin: 1 };
        const arrow = { t: 6, source: 'arrow', id: 'arrowtrap@112,32#0.1' };
        expect(admitLaneCrossing({ ...base, billed: [arrow], died: 0 }).ok).toBe(true);
        expect(admitLaneCrossing({ ...base, billed: [], died: 0 }).ok).toBe(true);
        expect(admitLaneCrossing({ ...base, billed: [arrow], died: 1 }).why).toMatch(/dies/);
        expect(admitLaneCrossing({ ...base, billed: [{ t: 7, source: 'chaser', id: 'bob@48,96' }], died: 0 }).why)
            .toMatch(/not an engaged lane's arrow/);
        expect(admitLaneCrossing({ ...base, billed: [arrow, { ...arrow, t: 30 }], died: 0 }).why)
            .toMatch(/takes 2 arrow hit\(s\), over the budget's 1/);
        expect(admitLaneCrossing({ ...base, hitsNow: 1, billed: [arrow], died: 0 }).ok).toBe(false);
    });
});

describe('ARROWLANE D1 — L16\'s arrival lane on the GAME: the volley, the knockback and the stairs, at 0 px', () => {
    const replay = (w) => {
        let run = null;
        const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), { levelSource,
            onTick: (t, x, h, rn) => { run = rn; } });
        const game = new Map(w.samples.map((g) => [g.t, g]));
        const bad = [];
        let compared = 0;
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            const g = game.get(o.t);
            if (g) {
                compared += 1;
                const d = run ? run.damage : { hits: 0, hitsTimer: 0 };
                if (o.x !== g.player.x || o.y !== g.player.y) {
                    bad.push(`t ${o.t}: player game (${g.player.x}, ${g.player.y}) model (${o.x}, ${o.y})`);
                }
                if (d.hits !== g.player.hits || d.hitsTimer !== g.player.hits_timer) {
                    bad.push(`t ${o.t}: hits game ${g.player.hits}/${g.player.hits_timer} model ${d.hits}/${d.hitsTimer}`);
                }
                const live = run ? (run.entities('chasers') ?? []).filter((c) => c.tag === 'bob') : [];
                for (const gb of g.bodies) {
                    if (!live.some((c) => c.x === gb.x && c.y === gb.y && c.vx === gb.vx && c.vy === gb.vy)) {
                        bad.push(`t ${o.t}: game bob (${gb.x}, ${gb.y}) has no model body`);
                    }
                }
            }
            r = st.next();
        }
        return { run, bad, compared };
    };
    it('standing: the volley lands at t6 from `arrowtrap@112,32` (hits 1, i-frame 19, knocked to y 51.25)', () => {
        const w = witness('arrowlane-l16-arrival-stand');
        const { run, bad, compared } = replay(w);
        expect(bad).toEqual([]);
        expect(compared).toBe(8);
        expect(w.samples.find((g) => g.t === 6).player).toEqual({ x: 120, y: 51.25, hits: 1, hits_timer: 19 });
        expect(run.ledger('playerHits').map((h) => [h.t, h.source, h.id])).toEqual([[6, 'arrow', 'arrowtrap@112,32#0.1']]);
    });
    it('walking right: the same volley at t6, the knockback carried right and up', () => {
        const w = witness('arrowlane-l16-arrival-right');
        const { run, bad, compared } = replay(w);
        expect(bad).toEqual([]);
        expect(compared).toBe(8);
        expect(w.samples.find((g) => g.t === 6).player.hits).toBe(1);
        expect(run.ledger('playerHits').map((h) => [h.t, h.id])).toEqual([[6, 'arrowtrap@112,32#0.2']]);
    });
    it('walking down: the stairs to L17 at t6, before the volley — no hit', () => {
        const w = witness('arrowlane-l16-arrival-down');
        const { run, bad, compared } = replay(w);
        expect(bad).toEqual([]);
        expect(compared).toBe(7);
        expect(w.samples.at(-1).player).toEqual({ x: 56, y: 56, hits: 0, hits_timer: 0 });
        expect(run.ledger('playerHits')).toEqual([]);
    });
});

describe('ARROWLANE D2 — a walk that starts in an armed lane (sweep legs at L16 from L17)', () => {
    it.skipIf(ENV_SET)('OFF: leg 210 (back down the stairs) is refused at the gate, before any rung', () => {
        const res = solveL16FromL17([7, 4], 'level_16__r1c1 -> level_17');
        expect(res.ok).toBe(false);
        expect(String(res.message)).toMatch(/the danger map forbids \(120,56\) — arrowLane:arrowtrap@112,32/);
    });
    it('ON: leg 210 solves — `down` ×6 takes the stairs at t6 with no hit (the game\'s own answer, D1)', () => {
        const res = withArrowLaneCrossing(true, () => solveL16FromL17([7, 4], 'level_16__r1c1 -> level_17'));
        expect(res.ok).toBe(true);
        expect(res.plan.solution.map((k) => [...k].sort())).toEqual(Array(6).fill(['down']));
        expect(res.plan.forcedHits ?? null).toBe(null);
    });
    it('ON: leg 211 (to pit 12,3) is refused BY NAME — the billed hit leaves a Bob inside the camera band', () => {
        const res = withArrowLaneCrossing(true, () => solveL16FromL17([12, 3], 'level_16__r1c1 -> level_17 #2'));
        expect(res.ok).toBe(false);
        expect(String(res.message)).toMatch(/ARROWLANE — the corridor crosses an ARMED lane \(start: arrowtrap@112,32/);
        expect(String(res.message)).toMatch(/is on screen at tick \d+ depends on where inside `Game.shake`'s jiggle/);
    });
});
