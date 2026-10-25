/**
 * ⛓ L12→L21 STALL (slice `seedling-js-l12-l21-stall`) — a solver plan LONGER than the walker's give-up clock plays to
 * its end. The walk-order probe's J stop (§5.141, all three plain orders): exit `level_12__r0c37 -> level_21`, "not
 * reached within 1800 ticks — stalled at (405.57, 264.40)", after one "solving…" and NO decline. The leg starts at
 * r0c19's door (16, 80): `level_12__r0c19 -> level_12__r0c37` is a logical link (the Red Key), so the bot credits it and
 * walks the pit from where it stands. The solver SOLVED it (`reach-pit`, a plan of ~2400–2600 ticks through the red lock,
 * its expected end in level 21), and the walker's clock — which counted the plan's own ticks — cut it at 1800.
 *
 * ⛔ THE FIXTURE IS THE SHIPPED RULES: the exit is `seedling_playthrough`'s `level_12__r0c37` sidecar exit, the arrival
 * the r0c19 door the probe's run boots at, the kit the probe's at that leg (Sword, Shield, the Red Key from L19's Boss
 * Key 0). The solve runs in the REAL worker entry over `worker_threads`, at the page's own work budget.
 *
 * ── THE MUTATION LIST (each predicted red by name) ──
 *   m1 the give-up clock counts the solver's ticks again (`walked >= giveUpTicks` → `driven >= giveUpTicks`)
 *        -> "the pit leg …" reds: FAILED "not reached within 1800 ticks" in level 12, never the crossing to L21;
 *           and the unit row reds (FAILED at tick 3 of a 5-tick plan).
 *   m2 the walker's own steps stop counting (`walked += 1` dropped)
 *        -> "the walker's OWN walking still gives up …" reds: never FAILED.
 */
import { readFileSync } from 'node:fs';
import { Worker as NodeWorker } from 'node:worker_threads';

import { afterEach, describe, expect, it } from 'vitest';

import { createJsRuntime } from './jsRuntimeCore.js';
import { createRuntimeWalker, WALK_STATES } from './jsRuntimeWalker.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';

const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const MAP = readJson('../flashPanel/atlases/seedling-map.json');
const PT = readJson('../../presets/seedling_playthrough/AP_1/AP_1_rules.json');
const EXIT_NAME = 'level_12__r0c37 -> level_21';
const R0C37 = PT.preset_sidecars['1'].level_12__r0c37.playable_payload;
const EXIT = R0C37.exits.find((x) => x.exitName === EXIT_NAME);
const R0C19_DOOR = PT.preset_sidecars['1'].level_12__r0c19.playable_payload.exits
    .find((x) => x.exitName === 'level_12__r0c19 -> level_0__r11c19').entrance_spawn;
const ENTRY = new URL('./jsRuntimeSolveWorker.js', import.meta.url).href;
const SETTLED = [WALK_STATES.DONE, WALK_STATES.FAILED];

/** A browser-Worker-shaped adapter over `worker_threads`, running the real entry (as `jsRuntimeSolveService.test.js`). */
function nodeWorker() {
    const w = new NodeWorker(`
        const { parentPort } = require('node:worker_threads');
        globalThis.self = {
            postMessage: (m) => parentPort.postMessage(m),
            set onmessage(fn) { parentPort.on('message', (data) => fn({ data })); },
        };
        import(${JSON.stringify(ENTRY)});
    `, { eval: true });
    const adapter = {
        onmessage: null, onerror: null, terminated: false,
        postMessage: (m) => w.postMessage(m),
        terminate: () => { adapter.terminated = true; w.terminate(); },
    };
    w.on('message', (data) => adapter.onmessage?.({ data }));
    w.on('error', (err) => adapter.onerror?.({ message: err.message }));
    return adapter;
}
const services = [];
afterEach(() => { while (services.length) services.pop().dispose(); });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

describe('⛓ L12→L21 STALL — a solver plan longer than the give-up clock plays to its end', () => {
    it('the fixture: the exit is a PIT of r0c37, the leg is walked from r0c19\'s door across the Red Key link', () => {
        expect(EXIT).toMatchObject({ exit_id: 'out_pit_5_5', exit_tiles: [[36, 43]] });
        expect(R0C19_DOOR).toEqual({ x: 16, y: 80 });
        const link = PT.regions['1'].level_12__r0c19.exits.find((x) => x.name === 'level_12__r0c19 -> level_12__r0c37');
        expect(link.access_rule).toEqual({ rule: 'Has', args: { item_name: 'Red Key' } });
    });

    it('the pit leg from r0c19\'s door (Sword, Shield, Red Key): one solve, a plan past 1800 ticks, crossed to L21', async () => {
        const service = createWorkerSolveService({ createWorker: () => nodeWorker() });
        services.push(service);
        const rt = createJsRuntime({ solveService: service });
        rt.setVanilla(MAP);
        rt.queueItems(['hasSword', 'hasShield'].map((p) => ({ class: 'Main', property: p, value: true })));
        rt.queueItems([{ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasKeySet', args: [0, true] }]);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [12, R0C19_DOOR.x, R0C19_DOOR.y] }]);
        rt.tick();
        expect(rt.run.level).toBe(12);
        rt.playback.setSolverWalk(true);
        expect(rt.playback.walkTo({ kind: 'exit', level: 12, tiles: EXIT.exit_tiles, name: EXIT_NAME })).toEqual({ ok: true });
        rt.playback.play();
        const crossings = [];
        for (let t = 0; t < 6000 && !SETTLED.includes(rt.playback.state); t += 1) {
            const n0 = rt.run.transitions.length;
            rt.tick();
            crossings.push(...rt.run.transitions.slice(n0));
            // eslint-disable-next-line no-await-in-loop
            if (rt.playback.solving) await sleep(20);
        }
        expect(rt.playback.reason).toBeNull();
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(rt.run.level).toBe(21);
        expect(crossings.at(-1)).toMatchObject({ from_level: 12, to_level: 21 });
        const s = rt.playback.solverStats;
        expect(`${s.solves}/${s.declines}/${s.refutations}`).toBe('1/0/0');
        expect(s.lastSolve.goal.kind).toBe('reach-pit');
        expect(s.lastSolve.where).toBe('worker');
        // The point of the row: the plan is longer than the clock, and every tick of the walk was the plan's.
        expect(s.lastSolve.keys).toBeGreaterThan(1800);
        expect(rt.playback.stats.walked).toBe(0);
        expect(rt.playback.stats.driven).toBe(s.played);
    }, 300_000);
});

describe('⛓ L12→L21 STALL — the walker\'s give-up clock counts only the ticks it drove', () => {
    const AP = { rect: { x: 64, y: 16, right: 72, bottom: 24 } };
    const GOAL = { kind: 'location', level: 0, tag: 3 };

    function walkerStanding({ solver, giveUpTicks }) {
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [86, 48, 48] }]);
        rt.tick();
        const w = createRuntimeWalker({ apItemOf: () => AP, isCollected: () => false, solver }, { giveUpTicks });
        w.setGoal({ ...GOAL, level: rt.run.level });
        w.play();
        return { rt, w };
    }

    it('a solver plan of 5 ticks under a 2-tick clock is played whole (the walk is still WALKING after it)', () => {
        let played = 0;
        const solver = { enabled: true, budgetWork: 0, cancel() {}, clear() {}, stats: {},
            keysFor: () => (played < 5 ? (played += 1, { held: new Set() }) : null) };
        const { rt, w } = walkerStanding({ solver, giveUpTicks: 2 });
        for (let i = 0; i < 5; i += 1) expect(w.heldFor(rt.run)).toBeInstanceOf(Set);
        expect(w.state).toBe(WALK_STATES.WALKING);
        expect(w.stats).toMatchObject({ driven: 5, walked: 0 });
    });

    it('the walker\'s OWN walking still gives up at the clock, and names the solver\'s share before it', () => {
        let played = 0;
        const solver = { enabled: true, budgetWork: 0, cancel() {}, clear() {},
            stats: { lastSolve: { keys: 3, pass: 'dashless', expired: true } },
            keysFor: () => (played < 3 ? (played += 1, { held: new Set() }) : null) };
        const { rt, w } = walkerStanding({ solver, giveUpTicks: 2 });
        for (let i = 0; i < 5; i += 1) expect(w.heldFor(rt.run)).toBeInstanceOf(Set);
        expect(w.heldFor(rt.run)).toBeNull();
        expect(w.state).toBe(WALK_STATES.FAILED);
        expect(w.reason).toMatch(/^not reached within 2 ticks — stalled at \(/);
        expect(w.reason).toContain("; the solver's plan(s) drove 3 tick(s) before it ");
        expect(w.reason).toContain('(last solve: 3 tick(s), pass dashless, a later pass cut at its work budget)');
        expect(w.stats).toMatchObject({ driven: 5, walked: 2 });
    });
});

/**
 * ⛓ L12→L21 STALL — the bound that replaces the clock for the solver's ticks: a plan is finite, each tick is checked
 * against its expected row, a played-out plan with the goal not done is refuted, and the `MAX_REFUTATIONS`th refutation
 * FAILS the goal by name. So a plan that never reaches its goal (or loops off its rows) terminates within
 * `MAX_REFUTATIONS` × its length — the stub service below answers every solve with the same plan.
 *   m3 the "played out" refutation dropped (`plan.i >= plan.solution.length` re-solved silently / kept)
 *        -> "a plan that never reaches its goal …" reds: not FAILED within the bound.
 */
describe('⛓ L12→L21 STALL — a solver plan that never reaches its goal still FAILS by name, bounded', () => {
    const PLAN_TICKS = 700; // 3 × 700 = 2100 solver ticks, past the walker's 1800: the clock is not what stops it
    /** A settled solve service: every solve answers `PLAN_TICKS` idle ticks whose rows are `rowAt(live, i)`. */
    const stubService = (rowAt) => {
        const asked = [];
        return {
            asked, kind: 'stub', warm() {}, dispose() {},
            start(request) {
                asked.push(request);
                const expected = Array.from({ length: PLAN_TICKS + 1 }, (_, i) => rowAt(request.live.row, i));
                const plan = { solution: Array.from({ length: PLAN_TICKS }, () => []), expected, equipsAt: new Map(),
                    verbs: ['walk'], replayMs: 0, solveMs: 0, prefixLength: request.perTick.length };
                return { settled: true, started: true, result: { ok: true, plan }, cancel() {} };
            },
        };
    };
    function standingAt86(service) {
        const rt = createJsRuntime({ solveService: service });
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [86, 48, 48] }]);
        rt.tick();
        rt.playback.setSolverWalk(true);
        // the Starting House's door (tile [3, 4]): an idle plan never crosses it
        expect(rt.playback.walkTo({ kind: 'exit', level: 86, tiles: [[3, 4]], name: 'stub door' })).toEqual({ ok: true });
        rt.playback.play();
        let t = 0;
        for (; t < 10_000 && !SETTLED.includes(rt.playback.state); t += 1) rt.tick();
        return { rt, t };
    }

    it('a plan that plays out without the goal: refuted 3×, then FAILED by the refutation cap, within 3 × its length', () => {
        const service = stubService((row) => ({ ...row }));
        const { rt, t } = standingAt86(service);
        expect(rt.playback.state).toBe(WALK_STATES.FAILED);
        expect(rt.playback.reason).toBe("the solver's plan was refuted 3 time(s) — last: the plan played out and the goal is not complete");
        expect(service.asked).toHaveLength(3);
        expect(rt.playback.stats).toMatchObject({ driven: 3 * PLAN_TICKS, walked: 0 });
        expect(t).toBeLessThanOrEqual(3 * PLAN_TICKS + 3);
        expect(rt.run.level).toBe(86);
    });

    it('a plan off its rows (a loop the run does not follow): refuted at its first wrong row, FAILED by the cap at once', () => {
        const service = stubService((row, i) => (i === 0 ? { ...row } : { ...row, x: row.x + 1000 }));
        const { rt, t } = standingAt86(service);
        expect(rt.playback.state).toBe(WALK_STATES.FAILED);
        expect(rt.playback.reason).toMatch(/^the solver's plan was refuted 3 time\(s\) — last: tick 1 of the plan: live /);
        expect(rt.playback.stats.driven).toBe(3);
        expect(t).toBeLessThanOrEqual(6);
    });
});
