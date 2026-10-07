/**
 * ⛓ solver-walk §5.36 — GENERATED ROOMS ARE THE SOLVER'S (⚖ the user: "the
 * SOLVER for everything, not the walker"; 2026-10-06: "The next priority
 * after that would be solving generated levels").
 *
 * Before §5.36 a mounted GENERATED set kept the J2 walker for every goal (the
 * JS page's `solverGoalFor` generated arm; the wasm engine's `producer:
 * 'walker'`). Measured first (the as-built's table): the solver, asked through
 * the production request path, solves every committed generated leg the
 * walker did, plus the swim apitem the walker never reached; its only
 * refusals are named.
 *
 *   · THE CLASSIFICATION — every (committed preset, arrival, goal, kit) member
 *     the walker producer's own pin enumerates (`wasmWalkTape.test.js`), asked
 *     of the SOLVER exactly as the wasm engine asks at an arrival
 *     (`arrivalSolverGoal` → `arrivalSolveRequest` → `solveAnytime` at the
 *     shipped 640/80 fine units): `[verb, ticks, digest]` or a named refusal.
 *     A new member fails until it is classified here.
 *   · DETERMINISM — the same request twice → the same plan, byte for byte.
 *   · THE JS PAGE — `seedling_generated_room` mounted as the host delivers it:
 *     the apitem is SOLVED (F2 `apitem`), its check reported; the door SOLVED
 *     and crossed; the page's keys are the arrival solve's own plan.
 *   · ⛔ a DECLINE in a generated room is NAMED (the solver's reason in the
 *     walk status, "walking instead"), exactly as on real rooms — never a
 *     silent hand-over to the walker.
 *
 * Mutants this file kills (§5.36): the generated arm restored in
 * `solverGoalFor` (every page row); `mountedKindOf` forced GENERATED (the
 * kind row); a decline swallowed (the decline row).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mountedRecordsOf } from './wasmWalkTape.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';
import { planLevelSetChunks } from './levelSetValidator.js';
import { createJsRuntime, JS_RUNTIME_PINS, MOUNTED_KINDS } from './jsRuntimeCore.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { bootStaging } from './procgenOracle.js';
import { ITEM_PROPERTIES } from './tapeFormat.js';
import { buildLevelWorld } from './levelWorld.js';
import { solveAnytime, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK } from './jsRuntimeSolver.js';
import { arrivalSolveRequest, arrivalSolverGoal } from './wasmArrival.js';
import { WALK_STATES } from './jsRuntimeWalker.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const GAME_CONFIG = readJson('frontend/modules/flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties });
const PRESETS = ['seedling_generated_room', 'seedling_generated_leaf', 'seedling_generated_host', 'seedling_generated_swim'];
const FLAGS = Object.fromEntries(Object.values(ITEM_PROPERTIES).map((s) => [s.property, s.kind === 'add' ? s.base : false]));
/** The kits: bare, and the swim preset's AP item (Progressive Swim → the conch's `canSwim`). */
const KITS = { bare: {}, swim: { canSwim: true } };
const SETTLED = [WALK_STATES.DONE, WALK_STATES.FAILED];

function presetOf(name) {
    const rules = readJson(`frontend/presets/${name}/AP_1/AP_1_rules.json`);
    const assembled = assembleGeneratedSeedlingSet(rules, { selfPlayer: 1 });
    const records = mountedRecordsOf(assembled.set);
    return { assembled, records, levelSource: levelSourceFromAtlas(records) };
}
const PRESET = Object.fromEntries(PRESETS.map((n) => [n, presetOf(n)]));

/** The goals of a room in the controller's resolved shape (`resolveSeedlingGoal`). */
function goalsOf({ assembled }, level) {
    return [
        ...assembled.report.apitems.filter((a) => a.room === level)
            .map((a) => ({ kind: 'location', level, tag: a.tag, name: a.location })),
        ...assembled.report.doors.filter((d) => d.room === level)
            .map((d) => ({ kind: 'exit', level, tile: [d.cell.tx, d.cell.ty], name: `${d.region}__${d.exitName}` })),
    ];
}
/** Every arrival into a room: the set's start, and every door's (its `arrival` is the player CENTRE — ctor = −8). */
function arrivalsOf({ assembled, records }) {
    const out = [{ level: assembled.set.start.level, x: assembled.set.start.x, y: assembled.set.start.y, from: 'start' }];
    for (const [level, record] of records) {
        for (const tp of buildLevelWorld(record).teleporters) out.push({ level: tp.to, x: tp.arrival.x - 8, y: tp.arrival.y - 8, from: `L${level}` });
    }
    return out;
}
const stagingAt = ({ level, x, y }, kit = {}) => bootStaging({ boot: { level, x, y }, items: { ...FLAGS, ...kit }, pins: [...JS_RUNTIME_PINS] });
const digestOf = (plan) => createHash('sha1').update(JSON.stringify({
    keys: plan.solution.map((s) => [...s].sort()), expected: plan.expected,
})).digest('hex').slice(0, 12);

/** What the wasm engine asks at an arrival (§5.36: a generated room's too), at the shipped budget and window. */
function arrivalSolve(P, arrival, goal, kit) {
    const staging = stagingAt(arrival, kit);
    const mapped = arrivalSolverGoal(goal, { staging, levelSource: P.levelSource, record: P.records.get(arrival.level) });
    expect(mapped.goal, mapped.walker).toBeTruthy();
    const request = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: P.levelSource, records: P.records,
        name: `gen-${goal.name}`, scratchPersistence: true });
    return { mapped, answer: solveAnytime({ ...request, budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK }) };
}

/**
 * ⛔ THE CLASSIFICATION — `[verb, ticks, digest]` or `['refused', /why/]`. The exit digests are the
 * walker producer's own (`wasmWalkTape.test.js`): on a plain door both drive the same keys. The apitem
 * plans walk to the box CENTRE (F2: the take is mid-walk), so they are longer than the walker's
 * contact-ending tapes (220 → 266 on generated_room).
 */
const SOLVED = {
    'seedling_generated_room|start→L0(128,32)|region_0_0__key_blue_pickup|bare': ['apitem', 266, '0058e69de0ce'],
    'seedling_generated_room|start→L0(128,32)|region_0_0__exit_0|bare': ['walk', 7, 'd1e5f57652ea'],
    'seedling_generated_room|start→L0(128,32)|region_0_0__exit_1|bare': ['walk', 74, 'c43e30bb2e1f'],
    'seedling_generated_room|L0→L1(80,48)|region_0_1__exit_0|bare': ['walk', 7, 'dc21d4316dd8'],
    'seedling_generated_room|L0→L1(80,48)|region_0_1__exit_1|bare': ['walk', 7, 'a566235f2d89'],
    'seedling_generated_room|L1→L0(128,32)|region_0_0__key_blue_pickup|bare': ['apitem', 266, '0058e69de0ce'],
    'seedling_generated_room|L1→L0(128,32)|region_0_0__exit_0|bare': ['walk', 7, 'd1e5f57652ea'],
    'seedling_generated_room|L1→L0(128,32)|region_0_0__exit_1|bare': ['walk', 74, 'c43e30bb2e1f'],
    'seedling_generated_leaf|start→L0(16,48)|region_3_3__loc_0|bare': ['apitem', 140, 'e274d2a9bd04'],
    'seedling_generated_leaf|start→L0(16,48)|region_3_3__region_2_3|bare': ['walk', 6, '55da016b17a9'],
    'seedling_generated_host|start→L0(16,16)|region_2_2__loc_0|bare': ['apitem', 106, 'b9809bfafd23'],
    'seedling_generated_host|start→L0(16,16)|region_2_2__exit|bare': ['walk', 6, 'aab615027f10'],
    // The swim room's apitem across water: bare, the solver REFUSES by name (the rule needs Progressive Swim);
    // with the conch it SOLVES — a leg the walker producer never reached (it stalls at the water).
    'seedling_generated_swim|start→L0(80,16)|region_3_2__loc_0|bare': ['refused', /no corridor for goal collect-placement .* in level 0/],
    'seedling_generated_swim|start→L0(80,16)|region_3_2__loc_0|swim': ['apitem', 126, 'f4db55f99fbc'],
    'seedling_generated_swim|start→L0(80,16)|region_3_2__region_2_2|bare': ['walk', 7, '4e1540ca5e2c'],
    'seedling_generated_swim|start→L0(80,16)|region_3_2__region_2_2|swim': ['walk', 7, '4e1540ca5e2c'],
};

const MEMBERS = PRESETS.flatMap((name) => arrivalsOf(PRESET[name])
    .filter((a) => PRESET[name].records.has(a.level))
    .flatMap((a) => goalsOf(PRESET[name], a.level).flatMap((goal) => Object.keys(KITS)
        .filter((kit) => kit === 'bare' || name === 'seedling_generated_swim')
        .map((kit) => ({ name, arrival: a, goal, kit, key: `${name}|${a.from}→L${a.level}(${a.x},${a.y})|${goal.name}|${kit}` })))));

describe('§5.36 — every committed generated leg, asked of the SOLVER (the wasm arrival\'s request, 640/80 fine units)', () => {
    it('classifies EVERY (preset, arrival, goal, kit) member, and nothing else', () => {
        expect(MEMBERS.map((m) => m.key).sort()).toEqual(Object.keys(SOLVED).sort());
    });
    it.each(MEMBERS.map((m) => [m.key, m]))('%s', (_key, m) => {
        const want = SOLVED[m.key];
        const { answer, mapped } = arrivalSolve(PRESET[m.name], m.arrival, m.goal, KITS[m.kit]);
        expect(mapped.goal.kind).toBe(m.goal.kind === 'exit' ? 'reach-exit' : 'collect-placement');
        if (want[0] === 'refused') {
            expect(answer.ok).toBe(false);
            expect(answer.kind).toBe('refusal');
            expect(answer.message).toMatch(want[1]);
            return;
        }
        expect(answer.ok, answer.message).toBe(true);
        const { plan } = answer;
        expect([plan.verbs.join('+'), plan.solution.length, digestOf(plan)]).toEqual(want);
        // inside the budget by a wide margin, no sword → the full pass is skipped by name
        expect(plan.pass).toBe('dashless');
        expect(plan.passes.map((p) => [p.pass, p.kind])).toEqual([['dashless', null], ['full', 'skipped']]);
        expect(plan.passes[0].work).toBeLessThanOrEqual(SOLVER_BUDGET_WORK);
        const end = plan.expected.at(-1);
        if (m.goal.kind === 'exit') expect(end.level).not.toBe(m.goal.level);
        else expect(end.level).toBe(m.goal.level);
    });
    it('DETERMINISM — the same request twice is the same plan, byte for byte (an apitem and a door)', () => {
        for (const key of ['seedling_generated_room|start→L0(128,32)|region_0_0__key_blue_pickup|bare',
            'seedling_generated_swim|start→L0(80,16)|region_3_2__loc_0|swim', 'seedling_generated_room|start→L0(128,32)|region_0_0__exit_1|bare']) {
            const m = MEMBERS.find((x) => x.key === key);
            const a = arrivalSolve(PRESET[m.name], m.arrival, m.goal, KITS[m.kit]).answer;
            const b = arrivalSolve(PRESET[m.name], m.arrival, m.goal, KITS[m.kit]).answer;
            expect(JSON.stringify({ k: a.plan.solution.map((s) => [...s].sort()), e: a.plan.expected }))
                .toBe(JSON.stringify({ k: b.plan.solution.map((s) => [...s].sort()), e: b.plan.expected }));
        }
    });
});

/** `name` mounted on a fresh JS page as the host delivers it (chunks), the run booted at the set's start, the solver ON. */
function page(name, { kit = {} } = {}) {
    const { assembled } = PRESET[name];
    const rt = createJsRuntime({});
    rt.game.configure(BRIDGE_CONFIG);
    for (const c of planLevelSetChunks(assembled.set).chunks) rt.game.botLoadLevels(JSON.stringify(c));
    const { level, x, y } = assembled.set.start;
    rt.queueItems([{ class: 'game', property: 'menu', value: false },
        ...Object.entries(kit).map(([property, value]) => ({ class: 'Main', property, value })),
        { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    rt.tick(new Set());
    rt.playback.setSolverWalk(true);
    return rt;
}
function walk(rt, goal, { maxTicks = 3000 } = {}) {
    expect(rt.playback.walkTo(goal)).toEqual({ ok: true });
    rt.playback.play();
    const crossings = [];
    const keys = [];
    for (let t = 0; t < maxTicks && !SETTLED.includes(rt.playback.state); t += 1) {
        const before = rt.session.perTick.length;
        const out = rt.tick(new Set());
        expect(out.halted ?? null).toBeNull();
        if (rt.session.perTick.length > before) keys.push([...rt.session.perTick.at(-1)].sort());
        if (out.crossing) crossings.push(out.crossing);
    }
    return { crossings, keys };
}

describe('§5.36 — the JS page: a mounted GENERATED set is driven by the SOLVER', () => {
    it('seedling_generated_room: the apitem SOLVED (F2 `apitem`) and checked, then the door SOLVED and crossed — 0 declines', () => {
        const rt = page('seedling_generated_room');
        expect(rt.mounted.kind).toBe(MOUNTED_KINDS.GENERATED);
        expect(JSON.parse(rt.game.botLevelSet()).kind).toBe('generated');
        const loc = { kind: 'location', level: 0, tag: 0 };
        walk(rt, loc);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(rt.collected).toContain('0:0');
        expect(rt.playback.solverStats).toMatchObject({ solves: 1, declines: 0, refutations: 0 });
        expect(rt.playback.solverStats.lastSolve.goal).toEqual({ kind: 'collect-placement', placement: { x: 64, y: 16 } });
        const { crossings } = walk(rt, { kind: 'exit', level: 0, tile: [8, 1] });
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(crossings.map((c) => [c.from, c.to])).toEqual([[0, 1]]);
        expect(rt.playback.solverStats).toMatchObject({ solves: 2, declines: 0, refutations: 0 });
        expect(rt.playback.solverStats.lastSolve.goal.kind).toBe('reach-exit');
        expect(rt.deaths).toEqual([]);
    });

    it('the page plays the SAME keys the wasm arrival solve ships (the start room\'s apitem)', () => {
        const rt = page('seedling_generated_room');
        const P = PRESET.seedling_generated_room;
        const loc = { kind: 'location', level: 0, tag: 0, name: 'region_0_0__key_blue_pickup' };
        const { keys } = walk(rt, loc);
        const { answer } = arrivalSolve(P, { ...P.assembled.set.start }, loc, {});
        const plan = answer.plan.solution.map((s) => [...s].sort());
        // tick for tick the plan's keys, up to the TAKE (tick 255 of 266): the goal is done there, so the page's
        // last tick holds nothing, while the plan walks on to the box centre (F2: the take is mid-walk)
        expect([keys.length, plan.length]).toEqual([256, 266]);
        expect(keys.slice(0, -1)).toEqual(plan.slice(0, 255));
        expect(keys.at(-1)).toEqual([]);
    });

    it('seedling_generated_swim with the conch: the apitem across water is SOLVED and checked (the walker never reached it)', () => {
        const rt = page('seedling_generated_swim', { kit: { canSwim: true } });
        walk(rt, { kind: 'location', level: 0, tag: 0 });
        expect(rt.playback.state, rt.playback.reason).toBe(WALK_STATES.DONE);
        expect(rt.collected).toContain('0:0');
        expect(rt.playback.solverStats).toMatchObject({ declines: 0 });
        expect(rt.deaths).toEqual([]);
    });

    it('⛔ a DECLINE in a generated room is NAMED — the solver\'s reason in the status, "walking instead" — as on real rooms', () => {
        const rt = page('seedling_generated_swim');
        expect(rt.playback.walkTo({ kind: 'location', level: 0, tag: 0 })).toEqual({ ok: true });
        rt.playback.play();
        let seen = null;
        for (let t = 0; t < 40 && !seen; t += 1) {
            rt.tick(new Set());
            if (/the solver declined — .*no corridor for goal collect-placement.*; walking instead/.test(rt.playback.reason ?? '')) seen = rt.playback.reason;
        }
        expect(seen).toBeTruthy();
        expect(rt.playback.solverStats.declines).toBe(1);
        expect(rt.playback.solverStats.lastDecline).toMatch(/no corridor/);
        expect(rt.events.some((e) => e.type === 'solver' && /declined/.test(e.message ?? ''))).toBe(true);
    });
});
