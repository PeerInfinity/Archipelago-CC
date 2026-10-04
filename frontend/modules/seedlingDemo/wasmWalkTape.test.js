/**
 * wasmWalkTape — solver-walk WG: the J2 WALKER as the tape producer for a
 * GENERATED room on the wasm runtime (solver-walk WG).
 *
 *   · the mounted-set level source (`mountedRecordsOf`) IS the JS page's;
 *   · every committed generated preset room × every arrival × every goal:
 *     the producer's tape (keys + expected trajectory) PINNED, replayed
 *     exactly, ending on the apitem's contact or the door's crossing — or a
 *     named refusal (a new member fails until it is classified);
 *   · the producer's keys ARE the JS page's own walk, tick for tick;
 *   · the RECORDED wasm arrivals (`fixtures/wasm-arrival-gen-p4f.json`) stage
 *     and walk, the apitem clear lifted from the MODEL's staging only;
 *   · the refusals that remain, by name; (b)'s loss (the solver has no goal
 *     kind for an apitem); the real worker entry answers the in-place plan.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';

import { createInPlaceProduceService, mountedRecordsOf, walkTapeFromStaging, WalkTapeRefusal, WALK_TAPE_PRODUCER } from './wasmWalkTape.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';
import { planLevelSetChunks } from './levelSetValidator.js';
import { createJsRuntime, JS_RUNTIME_PINS } from './jsRuntimeCore.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { bootStaging } from './procgenOracle.js';
import { ITEM_PROPERTIES } from './tapeFormat.js';
import { buildLevelWorld } from './levelWorld.js';
import { createRunForStaging } from './tapeRunner.js';
import { liveOf, settleSolve, solveFromTape } from './jsRuntimeSolver.js';
import { stagingFromWasmArrival } from './wasmArrival.js';
import { exactDeclarationRefusal, shippedTape } from './wasmPlayback.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';
import { WALK_STATES } from './jsRuntimeWalker.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const GAME_CONFIG = readJson('frontend/modules/flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties });
const PRESETS = ['seedling_generated_room', 'seedling_generated_leaf', 'seedling_generated_host', 'seedling_generated_swim'];
const FLAGS = Object.fromEntries(Object.values(ITEM_PROPERTIES).map((s) => [s.property, s.kind === 'add' ? s.base : false]));
const RECORDED = readJson('frontend/modules/seedlingDemo/fixtures/wasm-arrival-gen-p4f.json').arrivals;

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
        for (const tp of buildLevelWorld(record).teleporters) {
            out.push({ level: tp.to, x: tp.arrival.x - 8, y: tp.arrival.y - 8, from: `L${level}` });
        }
    }
    return out;
}
const stagingAt = ({ level, x, y }) => bootStaging({ boot: { level, x, y }, items: { ...FLAGS }, pins: [...JS_RUNTIME_PINS] });
const digestOf = (plan) => createHash('sha1').update(JSON.stringify({
    keys: plan.solution.map((s) => [...s].sort()), expected: plan.expected,
})).digest('hex').slice(0, 12);

/**
 * ⛔ THE CLASSIFICATION — every (preset, arrival, goal) the committed presets
 * hold, derived above; a new member fails until it is classified here.
 * `[end, ticks, digest]` or `['refused', /why/]`.
 */
const TAPES = {
    'seedling_generated_room|start→L0(128,32)|region_0_0__key_blue_pickup': ['collected', 220, 'c13f5da91942'],
    'seedling_generated_room|start→L0(128,32)|region_0_0__exit_0': ['crossed', 7, 'd1e5f57652ea'],
    'seedling_generated_room|start→L0(128,32)|region_0_0__exit_1': ['crossed', 74, 'c43e30bb2e1f'],
    'seedling_generated_room|L0→L1(80,48)|region_0_1__exit_0': ['crossed', 7, 'dc21d4316dd8'],
    'seedling_generated_room|L0→L1(80,48)|region_0_1__exit_1': ['crossed', 7, 'a566235f2d89'],
    'seedling_generated_room|L1→L0(128,32)|region_0_0__key_blue_pickup': ['collected', 220, 'c13f5da91942'],
    'seedling_generated_room|L1→L0(128,32)|region_0_0__exit_0': ['crossed', 7, 'd1e5f57652ea'],
    'seedling_generated_room|L1→L0(128,32)|region_0_0__exit_1': ['crossed', 74, 'c43e30bb2e1f'],
    'seedling_generated_leaf|start→L0(16,48)|region_3_3__loc_0': ['collected', 95, '1201117759c0'],
    'seedling_generated_leaf|start→L0(16,48)|region_3_3__region_2_3': ['crossed', 6, '55da016b17a9'],
    'seedling_generated_host|start→L0(16,16)|region_2_2__loc_0': ['collected', 47, '814ccae9003f'],
    'seedling_generated_host|start→L0(16,16)|region_2_2__exit': ['crossed', 6, 'aab615027f10'],
    // The swim room's apitem sits across water the walker's planner does not cross (J2: the walker
    // is blind to what the solver certifies, and swimming is the swim arc's) — refused, by name.
    'seedling_generated_swim|start→L0(80,16)|region_3_2__loc_0': ['refused', /did not reach region_3_2__loc_0 in level 0: not reached within 1800 ticks/],
    'seedling_generated_swim|start→L0(80,16)|region_3_2__region_2_2': ['crossed', 7, '4e1540ca5e2c'],
};

const MEMBERS = PRESETS.flatMap((name) => arrivalsOf(PRESET[name])
    .filter((a) => PRESET[name].records.has(a.level))
    .flatMap((a) => goalsOf(PRESET[name], a.level).map((goal) => ({
        name, arrival: a, goal, key: `${name}|${a.from}→L${a.level}(${a.x},${a.y})|${goal.name}`,
    }))));

describe('wasmWalkTape — the mounted set is the level source', () => {
    it.each(PRESETS)('%s: mountedRecordsOf ≡ the JS page\'s records after the same delivery (the level ids as mounted)', (name) => {
        const rt = createJsRuntime({});
        rt.game.configure(BRIDGE_CONFIG);
        for (const c of planLevelSetChunks(PRESET[name].assembled.set).chunks) rt.game.botLoadLevels(JSON.stringify(c));
        expect([...PRESET[name].records.keys()]).toEqual([...rt.mounted.records.keys()]);
        for (const [level, record] of PRESET[name].records) expect(record).toEqual(rt.mounted.records.get(level));
    });
    it('refuses a set with no rooms, by name', () => {
        expect(() => mountedRecordsOf({ rooms: [] })).toThrow(/no generated level set to stage from/);
    });
});

describe('wasmWalkTape — the producer over every committed generated preset room', () => {
    it('classifies EVERY (preset, arrival, goal) member, and nothing else', () => {
        expect(MEMBERS.map((m) => m.key).sort()).toEqual(Object.keys(TAPES).sort());
    });
    it.each(MEMBERS.map((m) => [m.key, m]))('%s', (_key, m) => {
        const want = TAPES[m.key];
        const { levelSource, records } = PRESET[m.name];
        const staging = stagingAt(m.arrival);
        if (want[0] === 'refused') {
            expect(() => walkTapeFromStaging({ staging, levelSource, records, goal: m.goal })).toThrow(WalkTapeRefusal);
            expect(() => walkTapeFromStaging({ staging, levelSource, records, goal: m.goal })).toThrow(want[1]);
            return;
        }
        const plan = walkTapeFromStaging({ staging, levelSource, records, goal: m.goal });
        expect([plan.end, plan.solution.length, digestOf(plan)]).toEqual(want);
        expect(plan.producer).toBe(WALK_TAPE_PRODUCER);
        expect(plan.expected).toHaveLength(plan.solution.length + 1);
        expect(plan.deaths).toBe(0);
        // The expected trajectory is a REPLAY of the keys on a fresh run, row for row.
        const fresh = createRunForStaging(staging, levelSource, { scratchPersistence: true });
        plan.solution.forEach((held, i) => {
            fresh.advance(held);
            expect({ level: fresh.level, x: fresh.state.x, y: fresh.state.y }).toEqual(
                { level: plan.expected[i + 1].level, x: plan.expected[i + 1].x, y: plan.expected[i + 1].y });
        });
        if (m.goal.kind === 'exit') expect(plan.expected.at(-1).level).not.toBe(m.goal.level);
        else expect(plan.expected.at(-1).level).toBe(m.goal.level);
    });
});

describe('wasmWalkTape — the producer IS the JS page\'s own walk', () => {
    it('seedling_generated_room from the start: the page\'s walker holds the same keys and stands on the same rows, tick for tick', () => {
        const { assembled, levelSource, records } = PRESET.seedling_generated_room;
        const goal = { kind: 'location', level: 0, tag: 0 };
        const { x, y, level } = assembled.set.start;
        const plan = walkTapeFromStaging({ staging: stagingAt({ level, x, y }), levelSource, records, goal });
        const rt = createJsRuntime({});
        rt.game.configure(BRIDGE_CONFIG);
        for (const c of planLevelSetChunks(assembled.set).chunks) rt.game.botLoadLevels(JSON.stringify(c));
        // The page boots on the tick that drains the teleport and walks IN that tick (no empty boot tick first).
        rt.queueItems([{ class: 'game', property: 'menu', value: false }, { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
        expect(rt.playback.walkTo(goal)).toEqual({ ok: true });
        rt.playback.play();
        rt.tick(new Set());
        const rows = [rt.session.observations[0], ...rt.session.observations.slice(1)].map((o) => ({ level: o.level, x: o.x, y: o.y }));
        for (let t = 1; t < 3000 && rt.playback.state !== WALK_STATES.DONE; t += 1) {
            rt.tick(new Set());
            rows.push({ level: rt.run.level, x: rt.run.state.x, y: rt.run.state.y });
        }
        const page = rt.session.perTick.map((s) => [...s].sort());
        expect(page.slice(0, plan.solution.length)).toEqual(plan.solution.map((s) => [...s].sort()));
        expect(rows.slice(0, plan.expected.length)).toEqual(plan.expected.map(({ level: l, x: px, y: py }) => ({ level: l, x: px, y: py })));
    });
});

describe('wasmWalkTape — over the RECORDED wasm arrivals (p4e)', () => {
    const { records, levelSource } = PRESET.seedling_generated_room;
    const stage = (a) => stagingFromWasmArrival({ seam: a.seam, status: a.status, state: a.state, record: records.get(a.status.level) }).staging;
    const [A0, B0, C1] = RECORDED;
    it('the fixture is the three arrivals of the R witness (fresh; re-entered after the apitem; room 1 by the crossing)', () => {
        expect(RECORDED.map((a) => [a.status.level, a.status.persistence_cleared])).toEqual([
            [0, []], [0, [{ tag: 0, level: 0 }]], [1, [{ tag: 0, level: 0 }]]]);
    });
    it('A0: the apitem leg walks to its contact (the live run\'s 220 ticks)', () => {
        const plan = walkTapeFromStaging({ staging: stage(A0), levelSource, records, goal: { kind: 'location', level: 0, tag: 0 } });
        expect([plan.end, plan.solution.length, plan.apItemClearsLifted]).toEqual(['collected', 220, []]);
    });
    it('B0: the door leg after the apitem — its clear is LIFTED from the model\'s staging only; the shipped tape still declares it exactly', () => {
        const staging = stage(B0);
        expect(staging.persistence).toEqual([{ level: 0, tag: 0 }]);
        // Since F2 the model ACCEPTS an apitem clear (`PERSISTENCE_RESPONSE.apitem = 'despawn'`): the room boots with no apitem.
        // The producer still lifts it (WG's workaround, harmless: the apitem has no collider).
        expect(createRunForStaging(staging, levelSource, { scratchPersistence: true }).world.apItems).toEqual([]);
        const plan = walkTapeFromStaging({ staging, levelSource, records, goal: { kind: 'exit', level: 0, tile: [8, 1] } });
        expect([plan.end, plan.solution.length, plan.apItemClearsLifted]).toEqual(['crossed', 7, [{ level: 0, tag: 0 }]]);
        const tape = shippedTape({ staging, keys: plan.solution });
        expect(tape.persistence.map(({ level, tag }) => ({ level, tag }))).toEqual([{ level: 0, tag: 0 }]);
        expect(exactDeclarationRefusal(tape, B0.status)).toBeNull();
    });
    it('B0: the apitem goal itself, already cleared → a ZERO-tick plan (done, nothing to walk)', () => {
        const plan = walkTapeFromStaging({ staging: stage(B0), levelSource, records, goal: { kind: 'location', level: 0, tag: 0 } });
        expect([plan.end, plan.solution.length]).toEqual(['done', 0]);
    });
    it('C1: room 1 entered by the crossing (a clear in ANOTHER level) — the parking door walks', () => {
        const plan = walkTapeFromStaging({ staging: stage(C1), levelSource, records, goal: { kind: 'exit', level: 1, tile: [6, 3] } });
        expect([plan.end, plan.solution.length, plan.expected.at(-1).level]).toEqual(['crossed', 7, 2]);
    });
});

describe('wasmWalkTape — refusals, by name', () => {
    const { levelSource, records, assembled } = PRESET.seedling_generated_room;
    const staging = stagingAt(assembled.set.start);
    it.each([
        ['a tile goal', { kind: 'tile', level: 0, tile: [3, 3] }, /takes a location or an exit goal/],
        ['a goal in another room', { kind: 'exit', level: 1, tile: [4, 3] }, /the goal is in level 1, the arrival in level 0 .* ONE goal in ONE room/],
        ['an apitem the room does not hold', { kind: 'location', level: 0, tag: 7 }, /level 0 of the mounted set has no apitem with tag 7/],
    ])('%s', (_what, goal, why) => {
        expect(() => walkTapeFromStaging({ staging, levelSource, records, goal })).toThrow(why);
    });
    it('(b) found: since F2 `collect-placement` at an apitem resolves (strategy `apitem`) — the producer is still the walker', () => {
        const fresh = createRunForStaging(staging, levelSource, { scratchPersistence: true });
        const r = settleSolve(() => solveFromTape({ staging, perTick: [], live: liveOf(fresh), levelSource, scratchPersistence: true,
            solverGoal: { kind: 'collect-placement', placement: { x: 64, y: 16 } } }));
        expect(r.ok).toBe(true);
        expect(r.plan.verbs).toContain('apitem');
    });
    it('the in-place service settles a refusal as data (kind refusal, the message)', () => {
        const h = createInPlaceProduceService().start({ producer: WALK_TAPE_PRODUCER, staging, goal: { kind: 'location', level: 0, tag: 7 },
            source: { records } });
        expect(h.settled).toBe(true);
        expect(h.result).toMatchObject({ ok: false, kind: 'refusal' });
        expect(h.result.message).toMatch(/no apitem with tag 7/);
    });
});

describe('wasmWalkTape — the S2 WORKER (the real entry over worker_threads)', () => {
    it('answers `producer: walker` with the in-place plan, key for key and row for row', async () => {
        const ENTRY = new URL('./jsRuntimeSolveWorker.js', import.meta.url).href;
        const nodeWorker = () => {
            const w = new NodeWorker(`
                const { parentPort } = require('node:worker_threads');
                globalThis.self = {
                    postMessage: (m) => parentPort.postMessage(m),
                    set onmessage(fn) { parentPort.on('message', (data) => fn({ data })); },
                };
                import(${JSON.stringify(ENTRY)});
            `, { eval: true });
            const adapter = { onmessage: null, onerror: null, postMessage: (m) => w.postMessage(m), terminate: () => w.terminate() };
            w.on('message', (data) => adapter.onmessage?.({ data }));
            w.on('error', (err) => adapter.onerror?.({ message: err.message }));
            return adapter;
        };
        const { records, levelSource } = PRESET.seedling_generated_room;
        const service = createWorkerSolveService({ createWorker: nodeWorker });
        try {
            const staging = stagingFromWasmArrival({ seam: RECORDED[1].seam, status: RECORDED[1].status, state: RECORDED[1].state,
                record: records.get(0) }).staging;
            const request = { producer: WALK_TAPE_PRODUCER, staging, goal: { kind: 'exit', level: 0, tile: [8, 8] },
                scratchPersistence: true, levelSource, source: { records } };
            const local = createInPlaceProduceService().start(request).result;
            const handle = service.start(request);
            const t0 = Date.now();
            while (!handle.settled && Date.now() - t0 < 60000) {
                // eslint-disable-next-line no-await-in-loop
                await new Promise((r) => { setTimeout(r, 10); });
            }
            expect(local.ok).toBe(true);
            expect(handle.result.ok).toBe(true);
            const keys = (p) => p.solution.map((s) => [...s].sort());
            expect(keys(handle.result.plan)).toEqual(keys(local.plan));
            expect(handle.result.plan.expected).toEqual(local.plan.expected);
            expect(handle.result.plan.producer).toBe(WALK_TAPE_PRODUCER);
        } finally {
            service.dispose();
        }
    }, 90000);
});
