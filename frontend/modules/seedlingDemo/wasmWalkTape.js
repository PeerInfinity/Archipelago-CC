/**
 * seedlingDemo/wasmWalkTape — **THE J2 WALKER AS A TAPE PRODUCER, FOR A
 * GENERATED ROOM ON THE WASM RUNTIME** (solver-walk WG).
 *
 * On wasm there is no live walker: the game only plays tapes, so every goal
 * must become a TAPE before the game moves. The solver has no goal kind for a
 * generated room's `apitem` (it is not in `world.pickups`; `collect-placement`
 * "resolves to NOTHING"), which is why S1 kept generated goals on the J2
 * walker. WG's W0 measured the two candidate producers (the as-built has the
 * table) and chose this one:
 *
 *   a FRESH JS run booted at the wasm arrival's staging
 *   (`wasmArrival.stagingFromWasmArrival` — the same envelope the solver
 *   path uses), driven by the SAME `jsRuntimeWalker` the JS page walks
 *   generated rooms with, the keys it held recorded tick by tick.
 *
 * The run IS the expected trajectory: `expected[i]` is the row BEFORE tick
 * `i` (`expected[solution.length]` = where the walk ended), the same shape
 * `jsRuntimeSolver.solveFromTape` returns — so the wasm engine ships it,
 * watches it (`wasmPlayback.firstDivergence`, 0 px) and recovers from it
 * (W3) exactly as it does a solver plan. No solver or model change.
 *
 * Two things the JS PAGE does around the walker are re-done here, and only
 * these two (`jsRuntimeCore.tickOnce`'s own lines):
 *
 *   · the APITEM CONTACT. `APItem` is in no role list (`levelWorld`'s
 *     `apitem` row: the page owns the report), so the run never takes it;
 *     the contact is the player box of the PREVIOUS tick against the apitem's
 *     `apItem` box (`Pickup.update` collides against the position the last
 *     tick left), on a tick with no transition and no ceremony. The tape
 *     ends ON that tick: the game's `APItem.removed()` clears the slot in the
 *     same frame, and the game reports the check itself.
 *   · the CROSSING handed to `walker.observe` — a door (`teleporter`) or a
 *     fall (`pit`, a transport at the same tick). The tape ends on the
 *     crossing tick.
 *
 * The ceremony cadence (a vanilla pickup in a generated room, e.g. a torch)
 * is the session's own (`createManualSession.heldFor`, auto-advance ON, the
 * page's default for a walker tick) and is RECORDED in the keys, as the
 * solver's plans record their X presses.
 *
 * ⛔ A walk that FAILS (the walker's refusal or its give-up), a run that
 * refuses, or a walk past `maxTicks` throws `WalkTapeRefusal` BY NAME — the
 * engine turns it into the goal's named failure, never a partial tape.
 *
 * ⛔ DOM-FREE and clock-free (the clock is injected for the timing rows).
 * It runs in the S2 worker (`jsRuntimeSolveWorker.js`, `producer: 'walker'`)
 * or in place.
 */

import { createManualSession } from './watchManual.js';
import { createRuntimeWalker, goalTiles, latchedOn, nearestTeleporterAt, WALK_GIVE_UP_TICKS, WALK_STATES } from './jsRuntimeWalker.js';
import { apItemsOf, recordOfRoom } from './jsRuntimeCore.js';
import { assembleLevelSetChunks, planLevelSetChunks } from './levelSetValidator.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { createInPlaceSolveService, liveOf, settleSolve, solveFromTape } from './jsRuntimeSolver.js';
import { STEP_OFF_PRODUCER } from './wasmArrival.js';
import { levelSourceFromAtlas } from './atlasSource.js';

/** The producer's name, as the plan and the engine's history carry it. */
export const WALK_TAPE_PRODUCER = 'walker';
/** A walk longer than this is refused (the walker's own give-up plus the ceremonies it does not count). */
export const WALK_TAPE_MAX_TICKS = WALK_GIVE_UP_TICKS + 600;

/** A goal the walker cannot turn into a tape — by name. */
export class WalkTapeRefusal extends Error {
    constructor(message) { super(message); this.name = 'WalkTapeRefusal'; }
}

const overlaps = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
const rowOf = (run) => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });

/**
 * Walk `goal` from `staging` and return the plan.
 *
 * @param {object} o
 * @param {object} o.staging      the arrival's staging (a fresh boot — no prefix)
 * @param {object} o.levelSource  the MOUNTED set's level source (`levelSourceFromAtlas(records)`)
 * @param {Map} o.records         level → record (the mounted set's, `recordOfRoom`)
 * @param {object} o.goal         `{kind:'location', level, tag}` | `{kind:'exit', level, tile|tiles}`
 *                                (`resolveSeedlingGoal`'s shape)
 * @param {boolean} [o.scratchPersistence]  the page's mode (S3: every room)
 * @param {number} [o.maxTicks]
 * @param {() => number} [o.clock]
 * @returns {{solution: Set[], expected: object[], equipsAt: Map, verbs: string[], producer: string,
 *   replayMs: number, solveMs: number, prefixLength: number, deaths: number, ceremonyTicks: number,
 *   walker: object, end: string}}
 */
export function walkTapeFromStaging({ staging, levelSource, records, goal, scratchPersistence = true,
    maxTicks = WALK_TAPE_MAX_TICKS, clock = () => Date.now() }) {
    const t0 = clock();
    if (!goal || !['location', 'exit'].includes(goal.kind)) {
        throw new WalkTapeRefusal(`the walker producer takes a location or an exit goal, not ${JSON.stringify(goal)}`);
    }
    if (goal.level !== staging?.boot?.level) {
        throw new WalkTapeRefusal(`the goal is in level ${goal.level}, the arrival in level ${staging?.boot?.level} — `
            + 'the bot plans ONE goal in ONE room (⚖ Q5)');
    }
    const apItems = new Map([...(records ?? new Map())].map(([level, rec]) => [level, apItemsOf(rec)]));
    if (goal.kind === 'location' && !(apItems.get(goal.level) ?? []).some((a) => a.tag === goal.tag)) {
        throw new WalkTapeRefusal(`level ${goal.level} of the mounted set has no apitem with tag ${goal.tag}`);
    }
    // ⛔ An apitem's clear is NOT the model's to boot with: the `apitem` class has no
    // PERSISTENCE_RESPONSE (it is in no role list — the page owns its report), so a run
    // declaring one refuses by name. It has no collider either, so the room the model
    // builds is the same with or without it: the clear is lifted out of the MODEL's
    // staging and kept as "already collected". The SHIPPED tape still declares it
    // (the engine ships the arrival's staging, not this one — the exact-declaration rule).
    const isApItemClear = (c) => (apItems.get(c.level) ?? []).some((a) => a.tag >= 0 && a.tag === c.tag);
    const apItemClears = (staging.persistence ?? []).filter(isApItemClear);
    const modelStaging = apItemClears.length === 0 ? staging
        : { ...staging, persistence: staging.persistence.filter((c) => !isApItemClear(c)) };
    let session;
    try {
        session = createManualSession({ levelSource, staging: modelStaging, name: `wasm-walk-${goal.kind}-${goal.level}`, scratchPersistence });
    } catch (err) {
        throw new WalkTapeRefusal(`the model refused to boot level ${goal.level} at the arrival: ${String(err.message).split('\n')[0]}`);
    }
    const run = session.run;
    const collected = new Set(apItemClears.map((c) => `${c.level}:${c.tag}`));
    let failure = null;
    const walker = createRuntimeWalker({
        apItemOf: (level, tag) => (apItems.get(level) ?? []).find((a) => a.tag === tag) ?? null,
        isCollected: (level, tag) => collected.has(`${level}:${tag}`),
        onEvent: (e) => { if (e.state === WALK_STATES.FAILED) failure = e.message ?? 'the walk failed'; },
    });
    walker.setGoal(goal);
    walker.play();
    const expected = [rowOf(run)];
    let ceremonyTicks = 0;
    let end = null;
    for (let i = 0; i < maxTicks && end === null; i += 1) {
        const level0 = run.level;
        const box0 = playerBoxAt(run.state.x, run.state.y);
        const n0 = run.transitions.length;
        const inCeremony0 = Boolean(run.inCeremony);
        const deaths0 = run.playerDeaths.length;
        const walkHeld = walker.heldFor(run);
        if (walker.state === WALK_STATES.FAILED) break;
        if (walker.state === WALK_STATES.DONE) { end = 'done'; break; }
        if (walkHeld === null) {
            throw new WalkTapeRefusal(`the walker drove nothing at tick ${i} (state ${walker.state}${walker.reason
                ? `: ${walker.reason}` : ''}) — no tape`);
        }
        const { held, auto } = session.heldFor(walkHeld, { autoAdvanceText: true });
        if (auto) ceremonyTicks += 1;
        try {
            session.step(held);
        } catch (err) {
            throw new WalkTapeRefusal(`the model refused at tick ${i} of the walk in level ${goal.level}: `
                + `${String(err.message).split('\n')[0]}`);
        }
        expected.push(rowOf(run));
        let crossing = null;
        if (run.playerDeaths.length > deaths0) {
            // The model restarted the room the game's way; the walk re-plans from the respawn.
        } else if (run.transitions.length > n0) {
            const tr = run.transitions[run.transitions.length - 1];
            const fall = run.transports.some((f) => f.t === tr.t && f.from_level === tr.from_level);
            crossing = { from: tr.from_level, to: tr.to_level, type: fall ? 'pit' : 'teleporter' };
        } else if (!inCeremony0 && run.level === level0) {
            for (const a of apItems.get(level0) ?? []) {
                if (a.tag < 0 || collected.has(`${level0}:${a.tag}`) || !overlaps(a.rect, box0)) continue;
                collected.add(`${level0}:${a.tag}`);
                break;
            }
        }
        const death = run.playerDeaths.length > deaths0 ? run.playerDeaths.at(-1).source ?? 'death' : null;
        walker.observe({ crossing, death });
        if (goal.kind === 'location' && collected.has(`${goal.level}:${goal.tag}`)) end = 'collected';
        else if (walker.state === WALK_STATES.DONE) end = 'crossed';
        else if (crossing) {
            throw new WalkTapeRefusal(`the walk left level ${goal.level} for ${crossing.to} at tick ${i} without `
                + `reaching ${goal.name ?? goal.kind} — no tape`);
        }
    }
    if (end === null) {
        const why = failure ?? walker.reason ?? `not reached within ${maxTicks} ticks`;
        throw new WalkTapeRefusal(`the walker did not reach ${goal.name ?? goal.kind} in level ${goal.level}: ${why}`);
    }
    const solution = session.perTick.map((h) => new Set(h));
    return {
        solution,
        expected,
        equipsAt: new Map(),
        verbs: ['walk'],
        producer: WALK_TAPE_PRODUCER,
        replayMs: 0,
        solveMs: clock() - t0,
        prefixLength: 0,
        deaths: run.playerDeaths.length,
        ceremonyTicks,
        walker: walker.stats,
        end,
        apItemClearsLifted: apItemClears.map((c) => ({ level: c.level, tag: c.tag })),
    };
}

/** ⛓ W4 — a step-off longer than this is refused (S5's rooms step off in 7–15 ticks). */
export const STEP_OFF_MAX_TICKS = 240;

const sameRow = (a, b) => a.level === b.level && a.x === b.x && a.y === b.y && a.deaths === b.deaths;

/**
 * ⛓ W4 — **THE LATCHED-DOOR COMPOSITE**: an arrival that stands latched ON
 * its goal door (S5: the teleporter fires only on an entry) becomes ONE plan
 * from the arrival, solved here, in the worker:
 *
 *   1. the J2 walker's S5 step-off (`stepOffPoint`, the page's walker
 *      unchanged) drives a FRESH run from the staging until the latch drops —
 *      those keys are `stepOff`, the run's rows `walkerRows`;
 *   2. `solveFromTape({perTick: stepOff})` (S0's `prefix` admission: the
 *      shadow replay of the step-off is asserted equal to the walker's run)
 *      solves the walk back onto the door;
 *   3. `solution = stepOff ++ plan`, `expected = walkerRows ++ planRows` (the
 *      join row is ONE row: the walker's last = the plan's first, asserted).
 *
 * Shipped as one tape from the arrival, nothing happens mid-room on the game:
 * the seam between the walker and the solver exists only in the model.
 *
 * ⛔ A step-off that fails (a closed pocket — `arrivalSolverGoal` refuses those
 * first), dies, crosses, or runs past `STEP_OFF_MAX_TICKS` throws
 * `WalkTapeRefusal` BY NAME; the solver's own refusal propagates unchanged.
 *
 * @param {object} o  the request (`wasmArrival.arrivalSolveRequest` with `stepOffGoal`):
 *   `staging`, `goal` (the AP exit goal), `solverGoal` (the door's `reach-exit`),
 *   `levelSource`, `name`, `scratchPersistence`
 */
export function stepOffSolveFromStaging({ staging, levelSource, goal, solverGoal, name = 'wasm-step-off',
    scratchPersistence = true, maxTicks = STEP_OFF_MAX_TICKS, clock = () => Date.now() }) {
    const t0 = clock();
    if (goal?.kind !== 'exit') throw new WalkTapeRefusal(`a step-off serves an exit goal, not ${JSON.stringify(goal)}`);
    let session;
    try {
        session = createManualSession({ levelSource, staging, name: `${name}-step-off`, scratchPersistence });
    } catch (err) {
        throw new WalkTapeRefusal(`the model refused to boot level ${goal.level} at the arrival: ${String(err.message).split('\n')[0]}`);
    }
    const run = session.run;
    const hit = nearestTeleporterAt(run.world, goalTiles(goal), run.state);
    if (!hit || !latchedOn(run, hit.index)) {
        throw new WalkTapeRefusal(`the arrival in level ${goal.level} is not latched on the goal door ${goal.name ?? ''} — `
            + 'no step-off to make (the request should have been a plain solve)');
    }
    let failure = null;
    const walker = createRuntimeWalker({
        apItemOf: () => null, isCollected: () => false,
        onEvent: (e) => { if (e.state === WALK_STATES.FAILED) failure = e.message ?? 'the walk failed'; },
    });
    walker.setGoal(goal);
    walker.play();
    const walkerRows = [rowOf(run)];
    for (let i = 0; latchedOn(run, hit.index); i += 1) {
        if (i >= maxTicks) {
            throw new WalkTapeRefusal(`the step-off in level ${goal.level} was still latched on the door after ${maxTicks} ticks`
                + `${walker.reason ? ` (${walker.reason})` : ''}`);
        }
        const walkHeld = walker.heldFor(run);
        if (walker.state === WALK_STATES.FAILED || walkHeld === null) {
            throw new WalkTapeRefusal(`the walker could not step off the door in level ${goal.level}: `
                + `${failure ?? walker.reason ?? `it drove nothing at tick ${i}`}`);
        }
        const deaths0 = run.playerDeaths.length;
        const n0 = run.transitions.length;
        const { held } = session.heldFor(walkHeld, { autoAdvanceText: true });
        try {
            session.step(held);
        } catch (err) {
            throw new WalkTapeRefusal(`the model refused at tick ${i} of the step-off in level ${goal.level}: `
                + `${String(err.message).split('\n')[0]}`);
        }
        walkerRows.push(rowOf(run));
        if (run.playerDeaths.length > deaths0) throw new WalkTapeRefusal(`the step-off in level ${goal.level} died at tick ${i}`);
        if (run.transitions.length > n0) throw new WalkTapeRefusal(`the step-off in level ${goal.level} left the room at tick ${i}`);
    }
    const stepOff = session.perTick.map((h) => new Set(h));
    const plan = solveFromTape({ staging, perTick: stepOff, live: liveOf(run), levelSource, solverGoal, name,
        scratchPersistence, equips: null, clock });
    if (!sameRow(walkerRows.at(-1), plan.expected[0])) {
        throw new WalkTapeRefusal(`the step-off's last row ${JSON.stringify(walkerRows.at(-1))} is not the solve's first `
            + `${JSON.stringify(plan.expected[0])} — the composite cannot be one trajectory`);
    }
    const n = stepOff.length;
    return {
        solution: [...stepOff.map((h) => new Set(h)), ...plan.solution],
        expected: [...walkerRows.slice(0, -1), ...plan.expected],
        equipsAt: new Map([...plan.equipsAt].map(([t, slot]) => [t + n, slot])),
        verbs: plan.verbs,
        producer: STEP_OFF_PRODUCER,
        stepOff: { ticks: n, index: hit.index, from: walkerRows[0], to: walkerRows.at(-1) },
        join: n,
        replayMs: plan.replayMs,
        solveMs: clock() - t0,
        prefixLength: 0,
    };
}

/**
 * The in-place twin of the worker's dispatch (node rows, and a page with no
 * Worker): a `producer: 'walker'` request walks here, a `'step-off'` one
 * (⛓ W4) builds the latched-door composite, anything else is
 * `jsRuntimeSolver.createInPlaceSolveService`'s. Settles synchronously.
 */
export function createInPlaceProduceService({ clock = () => Date.now() } = {}) {
    const solve = createInPlaceSolveService({ clock });
    return {
        kind: 'in-place',
        start(request) {
            if (request.producer !== WALK_TAPE_PRODUCER && request.producer !== STEP_OFF_PRODUCER) return solve.start(request);
            const records = request.source?.records ?? null;
            const levelSource = request.levelSource ?? levelSourceFromAtlas(records);
            const result = settleSolve(() => (request.producer === STEP_OFF_PRODUCER
                ? stepOffSolveFromStaging({ ...request, levelSource, clock })
                : walkTapeFromStaging({ ...request, levelSource, records, clock })));
            return { settled: true, started: true, result, cancel() {} };
        },
        warm() {},
        dispose() {},
    };
}

/**
 * The MOUNTED set's records, level → record, exactly as the game mounts them:
 * the set through the delivery's own chunk plan (`planLevelSetChunks` renders
 * a `record` room to the OEL the game's `LevelSet.as` reads) and back
 * (`assembleLevelSetChunks`), each room parsed by the JS page's own
 * `recordOfRoom` with the level id it is mounted under. One derivation for
 * the JS page (`jsRuntimeCore.botLoadLevels`) and the wasm engine.
 *
 * @param {object} set  the assembled generated set (`assembleGeneratedSeedlingSet(...).set`)
 * @returns {Map<number, object>}
 */
export function mountedRecordsOf(set) {
    if (!Array.isArray(set?.rooms) || set.rooms.length === 0) {
        throw new WalkTapeRefusal('no generated level set to stage from (the generated arm delivered none)');
    }
    const res = assembleLevelSetChunks(planLevelSetChunks(set).chunks);
    if (!res.ok) throw new WalkTapeRefusal(`the generated level set does not re-assemble: ${res.errors.join('; ')}`);
    return new Map(res.set.rooms.map((room) => [room.id, recordOfRoom(room)]));
}
