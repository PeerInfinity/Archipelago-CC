/**
 * wasmArrival — solver-walk W1: a wasm room ARRIVAL → a JS staging → a solve
 * request (plan `NewDocs/plans/seedling-js-solver-walk-plan.md` §5.3 W1).
 *
 * The fixture is a RECORDING, not a hand-written latch:
 * `fixtures/wasm-arrival-p4e.json` holds the raw reads of four real arrivals
 * on the live flashPanel page (`seedling_atlas_location`, default build p4e,
 * headless logic-only), taken by `scripts/procgen/probe-seedling-wasm-arrival-solve.mjs
 * --record=…` — `botSeam()` at the arrival, the ONE `botStatus` read in the
 * same JS turn, and the bridge's `readState`:
 *   A  a host jump to the Starting House (86) at its spawn;
 *   B  the locked house door (no key): the game's own door to level 0, then
 *      the glue's bounce back to 86;
 *   C  a host jump after the chest was opened for real (a cleared row, a seal).
 * ⛓ W5 re-recorded it with `beam`/`rockSet` declared in games/seedling.json, so
 * every `state` carries the moonrock's two statics and B0 (level 0) stages.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';

import {
    ARRIVAL_FIELD_SOURCES, UNREAD_FIELDS, UNREAD_MODELLED_READERS, arrivalLatch, arrivalSolveRequest, arrivalSolverGoal,
    arrivalStagingWitness, assertArrivalCoverage, isArrival, stagingFromWasmArrival,
} from './wasmArrival.js';
import { SEAM_SIGNATURE } from './r7Acceptance.js';
import { createInPlaceSolveService } from './jsRuntimeSolver.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { buildStagedTape } from './botDriverV1.js';
import { parseTape } from './tapeFormat.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const RECORDED = readJson('frontend/modules/seedlingDemo/fixtures/wasm-arrival-p4e.json').arrivals;
const RECORDS = indexLevels(readJson('frontend/modules/flashPanel/atlases/seedling-map.json'));
const SOURCE = levelSourceFromAtlas(RECORDS);
const GAME_CONFIG = readJson('frontend/modules/flashPanel/games/seedling.json');
const HOUSE = 86;
const CHEST = { kind: 'location', level: HOUSE, tag: 0, entityType: 'chest', name: 'Starting House - Chest' };
const DOOR = { kind: 'exit', level: HOUSE, tiles: [[3, 4]], name: 'exit_S' };

const byLabel = (prefix, level) => RECORDED.find((a) => a.label.startsWith(prefix) && a.status.level === level);
const A = byLabel('A ', HOUSE);
const B0 = byLabel('B ', 0);
const B86 = byLabel('B ', HOUSE);
const C = byLabel('C ', HOUSE);
const reads = (a) => ({ seam: structuredClone(a.seam), status: structuredClone(a.status), state: structuredClone(a.state) });
const stage = (a, extra = {}) => stagingFromWasmArrival({ ...reads(a), record: RECORDS.get(a.status.level), ...extra });

describe('the recorded fixture is what it claims', () => {
    it('the arrivals A, B0, B86, C — and nothing else — each read before a stepped tick (Main.time = the begin record\'s)', () => {
        expect(RECORDED.map((a) => `${a.label[0]}${a.status.level}`)).toEqual(['A86', 'B0', 'B86', 'C86']);
        for (const a of RECORDED) {
            expect(a.seam.beginEntry['begin.level']).toBe(a.status.level);
            expect(a.status.game_time).toBe(a.seam.beginEntry['save.time']);
            expect(a.status.armed).toBe(false);
        }
        expect(C.status.persistence_cleared).toEqual([{ level: HOUSE, tag: 0 }]);
        expect(C.status.save.seal_parts.filter((v) => v !== -1)).toHaveLength(1);
    });
});

describe('the field classification covers SEAM_SIGNATURE', () => {
    it('every signature row has a source and nothing else is classified', () => {
        expect(assertArrivalCoverage()).toBe(true);
        expect(Object.keys(ARRIVAL_FIELD_SOURCES).sort()).toEqual(SEAM_SIGNATURE.map((r) => r.field).sort());
    });
    it('what no read-only verb carries, by name (§5.1: grassCut, firstUse/extended, the music pair)', () => {
        expect(UNREAD_FIELDS).toEqual(['save.firstUse', 'save.extended', 'save.grassCut',
            'static.Music.currentSet', 'static.Music.currentIndex']);
    });
    it('⛓ W5 — the moonrock\'s beam/rockSet are READ off readState (games/seedling.json declares them); no modelled field is left unread', () => {
        expect(ARRIVAL_FIELD_SOURCES['save.beam'].from).toBe('state');
        expect(ARRIVAL_FIELD_SOURCES['save.rockSet'].from).toBe('state');
        expect(UNREAD_MODELLED_READERS).toEqual({});
        const declared = GAME_CONFIG.state_properties.map((p) => p.property);
        expect(declared).toEqual(expect.arrayContaining(['beam', 'rockSet']));
        // Every recorded arrival's readState carries them — the fresh game's real values.
        for (const a of RECORDED) expect([a.state.beam, a.state.rockSet]).toEqual([false, false]);
    });
});

describe('isArrival — the beginEntry CHANGE, never the level report', () => {
    it('null → a record is an arrival; the same record is not; a new one is', () => {
        const be = A.seam.beginEntry;
        expect(isArrival(null, { beginEntry: be })).toBe(true);
        expect(isArrival(be, { beginEntry: { ...be } })).toBe(false);
        expect(isArrival(be, { beginEntry: { ...be, 'begin.tick': be['begin.tick'] + 1 } })).toBe(true);
        expect(isArrival(be, { beginEntry: null })).toBe(false);
    });
});

describe('stagingFromWasmArrival on the recorded arrivals', () => {
    for (const [name, a] of Object.entries({ A, B86, C })) {
        it(`${name}: the staging diffs clean against its own reads, field for field`, () => {
            const { staging, undeclared } = stage(a);
            const rows = arrivalStagingWitness(staging, reads(a));
            expect(rows.filter((r) => !r.ok)).toEqual([]);
            expect(rows.length).toBeGreaterThan(25);
            expect(undeclared).toEqual(['first_use', 'extended', 'grass_cut', 'music.set', 'music.index']);
            expect([staging.seam.beam, staging.seam.rock_set]).toEqual([a.state.beam, a.state.rockSet]);
        });
        it(`${name}: the staging round-trips the tape format, and the staged JS run stands where the game's player does`, () => {
            const { staging } = stage(a);
            const back = stagingFromTape(parseTape(buildStagedTape({ staging, perTick: [], name: `w1-${name}` })));
            back.persistence = back.persistence.map(({ level, tag }) => ({ level, tag }));
            expect(back).toEqual(staging);
            const run = createRunForStaging(staging, SOURCE);
            expect([run.level, run.state.x, run.state.y]).toEqual([a.status.level, a.status.x, a.status.y]);
        });
    }
    it('C: the earned clear and the non-empty seal log are declared exactly (W0 ii.5/ii.6)', () => {
        const { staging } = stage(C);
        expect(staging.persistence).toEqual([{ level: HOUSE, tag: 0 }]);
        expect(staging.save.seal_parts).toEqual(C.status.save.seal_parts.filter((v) => v !== -1));
        expect(staging.save.keys).toEqual([]);
        expect(staging.save.totem_parts).toEqual([]);
        // parseTape accepts a non-empty seal_parts (no W0 tape declared one).
        expect(parseTape(buildStagedTape({ staging, perTick: [], name: 'w1-C' })).save.seal_parts)
            .toEqual(staging.save.seal_parts);
    });
    it('the pins are the HOST tape\'s (sound + dead_frames), not the live game\'s (none)', () => {
        const out = stage(A);
        expect(out.staging.pins).toEqual(['sound', 'dead_frames']);
        expect(out.gamePins).toEqual([]);
        expect(() => stage(A, { pins: ['nope'] })).toThrow(/no such pin/);
    });
});

describe('refusals — by name, never rounded', () => {
    it('⛓ W5 — B0: level 0 holds a moonrock and STAGES (W1 refused it), beam/rock_set DECLARED from readState', () => {
        const { staging, undeclared } = stage(B0);
        expect(staging.boot.level).toBe(0);
        expect([staging.seam.beam, staging.seam.rock_set]).toEqual([false, false]);
        expect(undeclared).not.toContain('beam');
        expect(arrivalStagingWitness(staging, reads(B0)).filter((r) => !r.ok)).toEqual([]);
        // and a beam the game reports TRUE (after the shield) is declared true, not guessed
        const r = reads(B0);
        r.state = { ...r.state, beam: true };
        expect(stagingFromWasmArrival({ ...r, record: RECORDS.get(0) }).staging.seam.beam).toBe(true);
    });
    it('⛓ W5 — a build whose readState lacks beam is REFUSED by name (never guessed)', () => {
        const r = reads(A);
        const { beam, ...rest } = r.state;
        r.state = rest;
        expect(() => stagingFromWasmArrival(r)).toThrow(/`save\.beam` reads undefined from the bridge readState/);
    });
    it('no beginEntry (a botLoadTape cleared it) → refused', () => {
        const r = reads(A);
        r.seam.beginEntry = null;
        expect(() => stagingFromWasmArrival(r)).toThrow(/no `beginEntry`.*read botSeam FIRST/);
    });
    it('a level report AHEAD of the begin record (a pending swap, W0 i.12) → refused', () => {
        const r = reads(A);
        r.status.level = 0;
        expect(() => stagingFromWasmArrival(r)).toThrow(/a world swap is still pending/);
    });
    it('a readout the build lacks → refused, naming the field', () => {
        const r = reads(A);
        delete r.status.cutscene;
        expect(() => stagingFromWasmArrival(r)).toThrow(/static\.Game\.cutscene` reads undefined from botStatus/);
    });
    it('a non-compact seal log → segmentBootFromLatch\'s refusal, carried', () => {
        const r = reads(C);
        r.status.save.seal_parts = [-1, 6, ...r.status.save.seal_parts.slice(2)];
        expect(() => stagingFromWasmArrival(r)).toThrow(/cannot be authored as a boot — .*NOT COMPACT/);
    });
});

describe('the witness catches the two W0 hazards', () => {
    it('a FAKE clear (one the game did not report) reds the persistence row', () => {
        const { staging } = stage(A);
        staging.persistence = [{ level: HOUSE, tag: 0 }];
        const bad = arrivalStagingWitness(staging, reads(A)).filter((r) => !r.ok).map((r) => r.name);
        expect(bad).toEqual(['persistence = botStatus.persistence_cleared EXACTLY']);
    });
    it('an omitted save array (wiped by botStart) reds its rows', () => {
        const { staging } = stage(C);
        delete staging.save.seal_parts;
        const bad = arrivalStagingWitness(staging, reads(C)).filter((r) => !r.ok).map((r) => r.name);
        expect(bad).toEqual(['save.seal_parts = botStatus.save.seal_parts (the slot VALUES, up to the first -1)',
            'all THREE save arrays declared']);
    });
    it('an unread field declared anyway reds the unread row', () => {
        const { staging } = stage(A);
        staging.seam.grass_cut = 0;
        const bad = arrivalStagingWitness(staging, reads(A)).filter((r) => !r.ok).map((r) => r.name);
        expect(bad).toEqual(['no UNREAD field is declared']);
    });
});

describe('the solve — a fresh boot at the arrival, no prefix, no play', () => {
    const solve = (a, goal) => {
        const { staging } = stage(a);
        const mapped = arrivalSolverGoal(goal, { staging, levelSource: SOURCE, record: RECORDS.get(HOUSE) });
        expect(mapped.goal).toBeTruthy();
        const request = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SOURCE, records: RECORDS });
        expect(request.perTick).toEqual([]);
        return { staging, request, result: createInPlaceSolveService().start(request).result };
    };
    it('A: the chest — keys + the expected trajectory from the spawn, the chest verb', () => {
        const { result } = solve(A, CHEST);
        expect(result.ok).toBe(true);
        const p = result.plan;
        expect(p.prefixLength).toBe(0);
        expect(p.verbs).toContain('chest');
        expect(p.expected).toHaveLength(p.solution.length + 1);
        expect(p.expected[0]).toEqual({ level: HOUSE, x: A.status.x, y: A.status.y, deaths: 0 });
        expect(p.expected.every((r) => r.level === HOUSE && r.deaths === 0)).toBe(true);
    });
    it('A: the door — out of the house (the vanilla teleporter\'s level 0)', () => {
        const { result } = solve(A, DOOR);
        expect(result.ok).toBe(true);
        expect(result.plan.expected.at(-1).level).toBe(0);
        expect(result.plan.expected[0]).toEqual({ level: HOUSE, x: A.status.x, y: A.status.y, deaths: 0 });
    });
    it('C: the chest already open → the solver\'s own named refusal', () => {
        const { result } = solve(C, CHEST);
        expect(result).toMatchObject({ ok: false, kind: 'refusal' });
        expect(result.message).toMatch(/resolves to NOTHING in level 86/);
    });
    it('a goal in another room → the walker, named (one goal, one room)', () => {
        const { staging } = stage(A);
        expect(arrivalSolverGoal({ ...DOOR, level: 0 }, { staging, levelSource: SOURCE, record: RECORDS.get(0) }).walker)
            .toMatch(/the goal is in level 0, the arrival in level 86/);
    });
    it('⛓ S5/W3 → W4: an arrival LATCHED ON the goal door → the door\'s reach-exit WITH a step-off (W3 refused it); one tile off it → a plain solve', () => {
        const { staging } = stage(A);
        const at = (y) => arrivalSolverGoal(DOOR, { staging: { ...staging, boot: { ...staging.boot, y } }, levelSource: SOURCE,
            record: RECORDS.get(HOUSE) });
        for (const y of [64, 56]) {
            expect(at(y)).toMatchObject({ goal: { kind: 'reach-exit', exit: { x: 48, y: 64 } }, stepOff: { index: 0 } });
        }
        expect(at(48)).toEqual({ goal: { kind: 'reach-exit', exit: { x: 48, y: 64 } } });
    });
    it('B86: the S2 WORKER (the real entry over worker_threads) answers the in-place plan, key for key', async () => {
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
            const adapter = {
                onmessage: null, onerror: null,
                postMessage: (m) => w.postMessage(m),
                terminate: () => w.terminate(),
            };
            w.on('message', (data) => adapter.onmessage?.({ data }));
            w.on('error', (err) => adapter.onerror?.({ message: err.message }));
            return adapter;
        };
        const service = createWorkerSolveService({ createWorker: nodeWorker });
        try {
            for (const goal of [DOOR, CHEST]) {
                const { request, result: local } = solve(B86, goal);
                const handle = service.start(request);
                const t0 = Date.now();
                while (!handle.settled && Date.now() - t0 < 60000) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => { setTimeout(r, 10); });
                }
                expect(handle.result.ok).toBe(true);
                const keys = (p) => p.solution.map((s) => [...s].sort());
                expect(keys(handle.result.plan)).toEqual(keys(local.plan));
                expect(handle.result.plan.expected).toEqual(local.plan.expected);
            }
        } finally {
            service.dispose();
        }
    }, 90000);
});

describe('arrivalLatch', () => {
    it('carries every read field and leaves the unread ones OUT (never a placeholder)', () => {
        const { envelope, unread } = arrivalLatch(reads(A));
        expect(unread).toEqual(UNREAD_FIELDS);
        for (const f of UNREAD_FIELDS) expect(envelope.seam).not.toHaveProperty([f]);
        expect(envelope.seam['save.levelPersistence']).toEqual([]);
        expect(envelope.seam.playerPositionX).toBe(A.state.playerPositionX);
    });
});
