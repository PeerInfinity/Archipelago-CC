/**
 * seedling-p4h-capability-plumbing — THE PAGE'S RUNNING BUILD REACHES EVERY MODEL THE WASM PAGE BUILDS.
 *
 * `modelBuild.js` (fidelity's p4h port) made the model ask its build (`createLevelRun({capabilities})`, null = the
 * default build's answer). This slice only PASSES the value: the panel's reading of the running build's manifest row →
 * the wasm playback engine → every shadow, goal-mapping run, delivery model and solve request it makes → the worker's
 * shadow and forks (`solveFromTape`). These rows pin the plumbing, not the model:
 *
 *   1. REACH — every `createRunForStaging` the page path makes receives the caller's capabilities, untouched (a spy on
 *      the one construction): null in → null everywhere, p4g's → p4g's, p4h's → p4h's.
 *   2. p4g ≡ null — a run built for p4g's capabilities is the run built for none, tick for tick, on a seeded sample
 *      that includes both bosses' rooms (L112's Owl tapes, L57's Tentacled Beast witness), and the page path's plans
 *      are the same plans.
 *   3. THE REQUEST — `arrivalSolveRequest` / `continuationSolveRequest` carry `capabilities` only when given (a copy),
 *      and a request without the field (every capture made before this slice) solves exactly as a null one.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const seen = vi.hoisted(() => ({ caps: [] }));
vi.mock('./tapeRunner.js', async (importOriginal) => {
    const m = await importOriginal();
    return {
        ...m,
        createRunForStaging: (staging, levelSource, opts) => {
            seen.caps.push(opts?.capabilities ?? null);
            return m.createRunForStaging(staging, levelSource, opts);
        },
    };
});

/**
 * ⛓ THE FORKS — `solveSegment` builds a fork (`forkRun`) only for a crusher bait or a rewind, which the house never
 * needs, so a fork that dropped the build would pass unseen. The wrapper asks for ONE fork per segment before
 * delegating (the fork is discarded): its construction lands in `seen.caps` like every other.
 */
vi.mock('./solverBot.js', async (importOriginal) => {
    const m = await importOriginal();
    return { ...m, solveSegment: (args) => { args.forkRun?.(); return m.solveSegment(args); } };
});

import { arrivalSolveRequest, arrivalSolverGoal, capabilitiesField, continuationSolveRequest, stagingFromWasmArrival } from './wasmArrival.js';
import { deliveryRefusal } from './wasmDelivery.js';
import { continuationHoldSeam } from './wasmHoldSeam.js';
import { replayTape, runDigest, solveAnytime } from './jsRuntimeSolver.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { atlasLevelSource } from './levelSource.js';
import { withContactFidelity } from './contactFidelity.js';
import { declaresBossDraws, P4G_CAPABILITIES } from './modelBuild.js';
import { captureRequest, restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const RECORDED = readJson('frontend/modules/seedlingDemo/fixtures/wasm-arrival-p4g.json').arrivals;
const RECORDS = indexLevels(readJson('frontend/modules/flashPanel/atlases/seedling-map.json'));
const SOURCE = levelSourceFromAtlas(RECORDS);
const MANIFEST = readJson('frontend/modules/flashPanel/wasm/builds.json');
const HOUSE = 86;
const A = RECORDED.find((a) => a.label.startsWith('A ') && a.status.level === HOUSE);
const CHEST = { kind: 'location', level: HOUSE, tag: 0, entityType: 'chest', name: 'Starting House - Chest' };
const DOOR = { kind: 'exit', level: HOUSE, tiles: [[3, 4]], name: 'exit_S' };
/** The p4h candidate's manifest row, as the panel reads it (`capabilitiesOf`). */
const P4H = MANIFEST.builds.find((b) => b.name === 'seedling_bot_ap_p4h').capabilities;
const reads = (a) => ({ seam: structuredClone(a.seam), status: structuredClone(a.status), state: structuredClone(a.state) });

/** A plan, as plain data: the keys and the rows it expects. */
const planOf = (answer) => (answer.ok
    ? { ok: true, solution: answer.plan.solution.map((k) => [...k].sort()), expected: answer.plan.expected, verbs: answer.plan.verbs }
    : { ok: false, kind: answer.kind ?? null, message: answer.message ?? null });

/**
 * The wasm page's path at the house, for one build: map the chest on the arrival, request it, solve it (the worker's
 * own call, in place), then the door as a continuation from the chest's held end, its hold seam, and a delivery's
 * model. Every construction the path makes is recorded (`seen.caps`).
 */
function pagePath(capabilities) {
    seen.caps = [];
    const { staging } = stagingFromWasmArrival({ ...reads(A), record: RECORDS.get(HOUSE) });
    const mapped = arrivalSolverGoal(CHEST, { staging, levelSource: SOURCE, record: RECORDS.get(HOUSE), capabilities });
    const request = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SOURCE, records: RECORDS,
        name: 'wasm-location-86', scratchPersistence: true, capabilities });
    const chest = solveAnytime({ ...request, clock: () => 0 });
    const shipped = chest.plan.solution.map((k) => [...k]);
    const seam = continuationHoldSeam({ staging, shipped, levelSource: SOURCE, status: A.status, capabilities });
    const c = continuationSolveRequest({ staging, shipped, goal: DOOR, levelSource: SOURCE, records: RECORDS,
        record: RECORDS.get(HOUSE), name: 'wasm-continue-exit-86', holds: seam.holds, capabilities });
    const door = solveAnytime({ ...c.request, clock: () => 0 });
    const delivery = deliveryRefusal({ staging, shipped, items: { ...A.status.items, hasShield: true }, status: A.status,
        levelSource: SOURCE, capabilities });
    return { request, cont: c.request, chest: planOf(chest), door: planOf(door), delivery, caps: [...seen.caps] };
}

describe('the p4h candidate row the panel reads (the fixture for this file)', () => {
    it('declares bossdraws; the default p4g row equals P4G_CAPABILITIES and does not', () => {
        expect(declaresBossDraws(P4H)).toBe(true);
        const def = MANIFEST.builds.find((b) => b.role === 'default');
        expect(def.capabilities).toEqual([...P4G_CAPABILITIES]);
        expect(declaresBossDraws(def.capabilities)).toBe(false);
        expect(declaresBossDraws(null)).toBe(false);
    });
});

describe('REACH — every model the page path builds is built for the caller\'s capabilities', () => {
    const paths = {};
    beforeAll(() => {
        paths.none = pagePath(null);
        paths.p4g = pagePath([...P4G_CAPABILITIES]);
        paths.p4h = pagePath([...P4H]);
    });

    it.each(['none', 'p4g', 'p4h'])('%s: every construction (map, live, shadow, forks, continuation, seam, delivery) received it', (k) => {
        const want = { none: null, p4g: [...P4G_CAPABILITIES], p4h: [...P4H] }[k];
        const p = paths[k];
        expect(p.chest.ok).toBe(true);
        expect(p.door.ok).toBe(true);
        // the path builds runs at every step: a handful of shadows plus the solver's forks
        expect(p.caps.length).toBeGreaterThan(6);
        expect(new Set(p.caps.map((c) => JSON.stringify(c)))).toEqual(new Set([JSON.stringify(want)]));
    });

    it('the requests carry the field only when a build was named, as a copy', () => {
        expect('capabilities' in paths.none.request).toBe(false);
        expect('capabilities' in paths.none.cont).toBe(false);
        expect(paths.p4g.request.capabilities).toEqual([...P4G_CAPABILITIES]);
        expect(paths.p4h.cont.capabilities).toEqual([...P4H]);
        expect(capabilitiesField(P4H).capabilities).not.toBe(P4H);
        expect(capabilitiesField(null)).toEqual({});
        expect(capabilitiesField(undefined)).toEqual({});
    });

    it('p4g ≡ null: the same plans, the same delivery verdict, the same number of constructions', () => {
        const strip = ({ request, cont, caps, ...rest }) => ({ ...rest, constructions: caps.length });
        expect(strip(paths.p4g)).toEqual(strip(paths.none));
    });

    it('outside L57/L112 p4h plans the house as p4g does (bossdraws touches nothing here)', () => {
        expect([paths.p4h.chest, paths.p4h.door]).toEqual([paths.p4g.chest, paths.p4g.door]);
    });
});

describe('p4g ≡ null on a seeded sample of committed tapes (both boss rooms included)', () => {
    const TAPES = join(HERE, 'fixtures/tapes');
    const tapeAt = (file) => parseTape(readFileSync(file, 'utf8'));
    const digests = (tape, capabilities) => {
        const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource(), { capabilities });
        const out = [runDigest(run)];
        for (let t = 0; t < tape.tick_count; t += 1) { run.advance(heldKeysAt(tape, t)); out.push(runDigest(run)); }
        return out;
    };
    it.each(['r6-owl-control.json', 'r6-owl-kill.json', 'r9-l6-sword-dash-hit.json'])('%s: tick for tick', (name) => {
        const tape = tapeAt(join(TAPES, name));
        expect(digests(tape, [...P4G_CAPABILITIES])).toEqual(digests(tape, null));
    });
    it('L57: the Tentacled Beast door witness (fight on), tick for tick', () => {
        const tape = parseTape(JSON.stringify(readJson('frontend/modules/seedlingDemo/fixtures/tentaclebeast-witness/tb-hitless-door.json').tape));
        const run = (caps) => withContactFidelity({ tentacleBeastFight: true }, () => digests(tape, caps));
        expect(tape.boot.level).toBe(57);
        expect(run([...P4G_CAPABILITIES])).toEqual(run(null));
    });
    it('replayTape (the page\'s shadow) answers the same for p4g and null', () => {
        const tape = tapeAt(join(TAPES, 'r6-owl-kill.json'));
        const perTick = Array.from({ length: tape.tick_count }, (_, t) => heldKeysAt(tape, t));
        const a = replayTape({ staging: stagingFromTape(tape), perTick, levelSource: atlasLevelSource(), capabilities: [...P4G_CAPABILITIES] });
        const b = replayTape({ staging: stagingFromTape(tape), perTick, levelSource: atlasLevelSource() });
        expect(runDigest(a)).toBe(runDigest(b));
    });
});

describe('THE CODEC — a request\'s capabilities round-trip; a capture without them solves as p4g', () => {
    let request;
    beforeAll(() => {
        const { staging } = stagingFromWasmArrival({ ...reads(A), record: RECORDS.get(HOUSE) });
        const mapped = arrivalSolverGoal(DOOR, { staging, levelSource: SOURCE, record: RECORDS.get(HOUSE) });
        request = (capabilities) => arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SOURCE, records: RECORDS,
            scratchPersistence: true, capabilities });
    });
    it.each([['p4g', [...P4G_CAPABILITIES]], ['p4h', null]])('%s: captureRequest → JSON → restoreRequest keeps the list', (k, caps) => {
        const list = caps ?? [...P4H];
        const back = restoreRequest(JSON.parse(JSON.stringify(captureRequest(request(list)))));
        expect(back.capabilities).toEqual(list);
        expect(declaresBossDraws(back.capabilities)).toBe(k === 'p4h');
    });
    it('an OLD capture (no field) restores without one, and solves exactly as a p4g-stamped request', () => {
        const old = restoreRequest(JSON.parse(JSON.stringify(captureRequest(request(null)))));
        expect('capabilities' in old).toBe(false);
        const solve = (r) => planOf(solveAnytime({ ...r, levelSource: SOURCE, clock: () => 0 }));
        const p4g = restoreRequest(JSON.parse(JSON.stringify(captureRequest(request([...P4G_CAPABILITIES])))));
        expect(solve(p4g)).toEqual(solve(old));
    });
});
