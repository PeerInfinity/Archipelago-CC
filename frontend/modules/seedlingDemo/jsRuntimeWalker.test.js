/**
 * jsRuntimeWalker — the Playback Bot's closed-loop walk on the Seedling JS
 * runtime (Seedling JS J2). Every row drives the runtime through the calls
 * the page and the host make — `playback.walkTo`/`play`, then `tick()` with NO
 * keys, as the page does when nobody touches the keyboard — and reads only
 * what the host reads: the `pendingCheck` / `pendingExit` reports.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import { createRuntimeWalker, teleporterAtTile, WALK_STATES, ARRIVAL_INSIDE_SOLID, WALK_TOLERANCE, nextWaypoint } from './jsRuntimeWalker.js';
import { drive, driveStepHeld, livePerVisitOpts, planTilePath, planWaypoints } from './botDriverV2.js';
import { withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { hasArrived } from './botDriverV1.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';
import { planLevelSetChunks } from './levelSetValidator.js';
import { cellOf, routeWalker, tileRoute } from './jsRuntimeTestWalk.js';
import { parsePendingExit } from '../flashPanel/seedlingRegionBinding.js';
import { parsePendingCheck } from '../flashPanel/seedlingCheckBinding.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const GAME_CONFIG = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const RULES = JSON.parse(readFileSync(
    join(ROOT, 'frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json'), 'utf8'));
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties });

function started() {
    const assembled = assembleGeneratedSeedlingSet(RULES, { selfPlayer: 1 });
    const reports = [];
    const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
    rt.game.configure(BRIDGE_CONFIG);
    for (const c of planLevelSetChunks(assembled.set).chunks) rt.game.botLoadLevels(JSON.stringify(c));
    const { x, y, level } = assembled.set.start;
    rt.queueItems([{ class: 'game', property: 'menu', value: false },
        { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    rt.tick();
    reports.length = 0;
    return { rt, reports, assembled };
}

/** Tick with no keys (the page, nobody at the keyboard) until the walk settles. */
function settle(rt, maxTicks = 3000) {
    const outs = [];
    for (let t = 0; t < maxTicks; t += 1) {
        const out = rt.tick(new Set());
        if (out.crossing || out.death) outs.push(out);
        const s = rt.playback.state;
        if (s === WALK_STATES.DONE || s === WALK_STATES.FAILED) return { ticks: t + 1, outs };
    }
    return { ticks: maxTicks, outs, timedOut: true };
}

/** The test's own fingers, to put the run somewhere that is not a fresh boot. */
function fingersTo(rt, to, { maxTicks = 2000, until = () => false } = {}) {
    const walker = routeWalker(tileRoute(rt.mounted.records.get(rt.run.level), cellOf(rt.run.state.x, rt.run.state.y), to));
    for (let t = 0; t < maxTicks && !walker.done && !until(); t += 1) rt.tick(walker.next(rt.run.state.x, rt.run.state.y));
}

const AP_GOAL = { kind: 'location', level: 0, tag: 0 };
const DOOR_UP = { kind: 'exit', level: 0, tile: [8, 1] };     // region_0_0 exit_0 → room 1
const DOOR_PARK = { kind: 'exit', level: 0, tile: [8, 8] };   // region_0_0 exit_1 → the parking room
const ROOM1_BACK = { kind: 'exit', level: 1, tile: [4, 3] };  // region_0_1 exit_0 → room 0

describe('jsRuntimeWalker — walkTo on a live run (closed loop C)', () => {
    it('walks from the arrival to the apitem: exactly one check, reported as the host parses it', () => {
        const { rt, reports } = started();
        expect(rt.playback.walkTo(AP_GOAL)).toEqual({ ok: true });
        rt.playback.play();
        const r = settle(rt);
        expect(r.timedOut).toBeUndefined();
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        const checks = reports.filter(([p]) => p === 'pendingCheck').map(([, v]) => parsePendingCheck(v));
        expect(checks).toEqual([expect.objectContaining({ level: 0, tag: 0, cleared: true })]);
        expect(rt.deaths).toEqual([]);
    });

    it('walks to a door from a LIVE non-fresh state: the crossing fires and the walk is done', () => {
        const { rt, reports } = started();
        fingersTo(rt, { tx: 3, ty: 6 });
        expect(rt.ticks).toBeGreaterThan(30);
        rt.playback.walkTo(DOOR_UP);
        rt.playback.play();
        const r = settle(rt);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(r.outs.map((o) => o.crossing)).toEqual([{ from: 0, to: 1, x: 128, y: 16, type: 'teleporter' }]);
        const exit = parsePendingExit(reports.find(([p]) => p === 'pendingExit')[1]);
        expect(exit).toMatchObject({ fromLevel: 0, x: 128, y: 16, to: 1 });
        expect(rt.run.level).toBe(1);
    });

    it('location THEN door in sequence (the bot\'s order), and a door into the parking room', () => {
        const { rt, reports } = started();
        rt.playback.play();
        rt.playback.walkTo(AP_GOAL);
        settle(rt);
        rt.playback.walkTo(DOOR_PARK);
        const r = settle(rt);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(r.outs[0].crossing).toMatchObject({ from: 0, to: 2 });
        expect(reports.filter(([p]) => p === 'pendingCheck')).toHaveLength(1);
    });

    it('takes a goal MID-CEREMONY: the cadence pages the dialogue, then the walk reaches the door', () => {
        const { rt } = started();
        rt.playback.play();
        rt.playback.walkTo(DOOR_UP);
        settle(rt);
        expect(rt.run.level).toBe(1);
        // Room 1's goal cell holds a vanilla torch pickup: a 150-frame ceremony.
        fingersTo(rt, { tx: 8, ty: 5 }, { until: () => rt.run.inCeremony });
        expect(rt.run.inCeremony).toBe(true);
        for (let i = 0; i < 10; i += 1) rt.tick(new Set());
        expect(rt.run.inCeremony).toBe(true);
        rt.playback.walkTo(ROOM1_BACK);
        const r = settle(rt);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(r.outs.map((o) => o.crossing)).toEqual([{ from: 1, to: 0, x: 64, y: 48, type: 'teleporter' }]);
    });

    it('stop() hands the run back to the keyboard; step() drives exactly one tick', () => {
        const { rt } = started();
        rt.playback.walkTo(AP_GOAL);
        const at = () => ({ x: rt.run.state.x, y: rt.run.state.y });
        const before = at();
        for (let i = 0; i < 20; i += 1) rt.tick(new Set());
        expect(at()).toEqual(before); // never played: the walker does not drive
        rt.playback.step();
        rt.tick(new Set());
        const once = at();
        expect(once).not.toEqual(before);
        expect(rt.playback.stats.driven).toBe(1);
        rt.tick(new Set());
        expect(rt.playback.stats.driven).toBe(1);
    });

    it('refuses by name what the mounted set does not hold', () => {
        const { rt } = started();
        expect(rt.playback.walkTo({ kind: 'location', level: 0, tag: 7 }))
            .toEqual({ ok: false, reason: 'level 0 has no apitem with tag 7' });
        expect(rt.playback.walkTo({ kind: 'exit', level: 0, tile: [2, 2] }))
            .toEqual({ ok: false, reason: 'level 0 has no teleporter or pit on tile (2, 2)' });
        expect(rt.playback.walkTo({ kind: 'exit', level: 9, tile: [2, 2] }))
            .toEqual({ ok: false, reason: 'the mounted set has no level 9' });
        expect(createJsRuntime().playback.walkTo(AP_GOAL)).toEqual({ ok: false, reason: 'no level set is mounted' });
    });

    it('a goal in another level WAITS (does not drive), and walks once the run is there', () => {
        const { rt } = started();
        rt.playback.play();
        rt.playback.walkTo(ROOM1_BACK);
        for (let i = 0; i < 5; i += 1) rt.tick(new Set());
        expect(rt.playback.state).toBe(WALK_STATES.WAITING);
        expect(rt.playback.stats.driven).toBe(0);
        // The host's arrival teleport lands the run in room 1.
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [1, 80, 48] }]);
        const r = settle(rt);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(r.outs[0].crossing).toMatchObject({ from: 1, to: 0 });
    });
});

describe('jsRuntimeWalker — unit', () => {
    it('teleporterAtTile matches a teleporter by its .oel cell, and skips a deactivated one', () => {
        const world = { teleporters: [{ x: 128, y: 16 }, { x: 128, y: 128, deactivated: true }] };
        expect(teleporterAtTile(world, [8, 1])).toEqual({ index: 0, teleporter: world.teleporters[0] });
        expect(teleporterAtTile(world, [8, 8])).toBeNull();
    });

    it('gives up BY NAME after its tick budget', () => {
        const w = createRuntimeWalker({ apItemOf: () => ({ rect: { x: 64, y: 16, right: 72, bottom: 24 } }), isCollected: () => false },
            { giveUpTicks: 2 });
        const { rt } = started();
        w.setGoal(AP_GOAL);
        w.play();
        expect(w.heldFor(rt.run)).toBeInstanceOf(Set);
        expect(w.heldFor(rt.run)).toBeInstanceOf(Set);
        expect(w.heldFor(rt.run)).toBeNull();
        expect(w.state).toBe(WALK_STATES.FAILED);
        expect(w.reason).toMatch(/^not reached within 2 ticks — stalled at/);
    });
});

/**
 * ⛓ WAVE-6 CONSUMER — a decline whose obstacle is fidelity ARRIVAL's `arrival-inside-solid` FAILS the goal at
 * once, by name, with the obstacle (its `wayOut`) on the event: the box cannot move, so "walking instead" and its
 * retries would only stall to the give-up clock. Any other decline walks instead, as before.
 */
describe('jsRuntimeWalker — an arrival inside a solid', () => {
    const OBSTACLE = { kind: 'arrival-inside-solid', id: 'breakablerock@288,176', solids: ['breakablerock@288,176'],
        at: { level: 0, x: 296, y: 184 }, wayOut: [{ kind: 'restart', via: 'seedlingStartSpawn', why: '' }] };
    const stubSolver = (answer) => ({ enabled: true, budgetWork: 0, keysFor: () => answer, cancel() {}, clear() {} });
    const walkerWith = (answer, events) => createRuntimeWalker({
        apItemOf: () => ({ rect: { x: 64, y: 16, right: 72, bottom: 24 } }), isCollected: () => false,
        onEvent: (e) => events.push(e), solver: stubSolver(answer) });

    it('`arrival-inside-solid`: FAILED on that tick, the obstacle on the failed event, no walk-instead', () => {
        const events = [];
        const w = walkerWith({ declined: 'solverBot(x): arrival-inside-solid — …', obstacle: OBSTACLE }, events);
        const { rt } = started();
        w.setGoal(AP_GOAL);
        w.play();
        expect(w.heldFor(rt.run)).toBeNull();
        expect(w.state).toBe(WALK_STATES.FAILED);
        expect(w.reason).toBe('the solver declined — solverBot(x): arrival-inside-solid — …');
        const failed = events.filter((e) => e.state === WALK_STATES.FAILED);
        expect(failed).toHaveLength(1);
        expect(failed[0].obstacle).toEqual(OBSTACLE);
        expect(w.stats.driven).toBe(0);
        expect(ARRIVAL_INSIDE_SOLID).toBe(OBSTACLE.kind);
    });

    it('any other obstacle (or none): the walk walks instead, as before', () => {
        for (const answer of [{ declined: 'hazard', obstacle: { kind: 'hazard-floor', id: 'x' } }, { declined: 'plain' }]) {
            const events = [];
            const w = walkerWith(answer, events);
            const { rt } = started();
            w.setGoal(AP_GOAL);
            w.play();
            expect(w.heldFor(rt.run)).toBeInstanceOf(Set);
            expect(w.state).toBe(WALK_STATES.WALKING);
            expect(events.some((e) => 'obstacle' in e)).toBe(false);
        }
    });
});

/**
 * ⛓ TRAILING EQUIP — a goal already done whose solver plan still owes its trailing equip tick (`solveFromTape`'s idle
 * tick for a selection after the last one) plays that tick before settling DONE: the page ends on the planned slot.
 */
describe('jsRuntimeWalker — a done goal plays the plan\'s trailing equip tick first', () => {
    const IDLE = new Set();
    const solverOwing = (owes) => ({ enabled: true, budgetWork: 0, keysFor: () => ({ held: IDLE }), cancel() {}, clear() {},
        owesTrailingTick: () => owes.shift() ?? false });

    it('owed: the idle tick is played (DRIVEN by the solver), then the goal settles DONE', () => {
        const w = createRuntimeWalker({ apItemOf: () => ({ rect: { x: 64, y: 16, right: 72, bottom: 24 } }), isCollected: () => true,
            solver: solverOwing([true]) });
        const { rt } = started();
        w.setGoal(AP_GOAL);
        w.play();
        expect(w.heldFor(rt.run)).toBe(IDLE);
        expect(w.solverDriving).toBe(true);
        expect(w.heldFor(rt.run)).toBeNull();
        expect(w.state).toBe(WALK_STATES.DONE);
    });

    it('not owed (or no solver): a done goal settles DONE at once, as before', () => {
        for (const solver of [solverOwing([]), null]) {
            const w = createRuntimeWalker({ apItemOf: () => ({ rect: { x: 64, y: 16, right: 72, bottom: 24 } }), isCollected: () => true,
                solver });
            const { rt } = started();
            w.setGoal(AP_GOAL);
            w.play();
            expect(w.heldFor(rt.run)).toBeNull();
            expect(w.state).toBe(WALK_STATES.DONE);
        }
    });
});

describe('botDriverV2 — the two J2 lifts are inert for every existing caller', () => {
    it('driveStepHeld IS drive\'s choice: a hand loop over it emits drive\'s held sequence tick for tick', () => {
        const a = started().rt.run;
        const b = started().rt.run;
        const wps = planWaypoints(a.world, a.state, { x: 72, y: 24 });
        const viaDrive = [];
        for (const wp of wps) {
            drive(a, wp, viaDrive, { until: 'arrival', tolerance: 1, maxTicks: 400, what: 'row' });
        }
        const viaStep = [];
        for (const wp of wps) {
            for (let t = 0; t < 400 && !hasArrived(b.state, wp, 1); t += 1) {
                const held = driveStepHeld(b, wp, 1);
                viaStep.push(held);
                b.advance(held);
            }
        }
        expect(viaDrive.length).toBeGreaterThan(20);
        expect(viaStep.map((h) => [...h].sort().join('+'))).toEqual(viaDrive.map((h) => [...h].sort().join('+')));
        expect({ x: b.state.x, y: b.state.y }).toEqual({ x: a.state.x, y: a.state.y });
    });

    it('the START SNAP is opt-in: without it an unwalkable start cell refuses by name, with it the route starts beside it', () => {
        const { world } = started().rt.run;
        const inWall = { x: 8, y: 24 };   // tile (0,1): the room's west wall
        const goal = { x: 72, y: 24 };    // the apitem's cell, (4,1)
        expect(() => planTilePath(world, inWall, goal)).toThrow(/A\* start tile \(0,1\) in level 0 .* is not walkable/);
        const path = planTilePath(world, inWall, goal, null, { snapStart: true });
        expect(path[0]).toEqual({ tx: 1, ty: 1 });
        expect(path[path.length - 1]).toEqual({ tx: 4, ty: 1 });
        // A walkable start is untouched by the flag.
        const from = { x: 24, y: 24 };
        expect(planTilePath(world, from, goal, null, { snapStart: true })).toEqual(planTilePath(world, from, goal));
    });
});

/**
 * ⛓ fidelity wave 16 (`CONTACT_FIDELITY.waypointSlide`) — THE WALKER PASSES AN ICE WAYPOINT THE WAY THE SOLVER'S WALK
 * DOES. L45 from the SMALLGAPS D2 witness's own staging (`fidelityWaypointSlide.test.js`), rebooted on the ice east of
 * (120,72); the plan is the walker's own `planWaypoints` call — [(120,72), (120,40)] — held for the whole walk
 * (`replanEvery` = ∞) so the comparison is waypoint choice against waypoint choice, not two re-plan cadences.
 */
describe('jsRuntimeWalker — an intermediate waypoint on ice (wave 16 waypointSlide)', () => {
    const W = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/seedlingDemo/fixtures/chaser-witness/smallgaps-l45-62-slide.json'), 'utf8'));
    const SRC = atlasLevelSource();
    const l45 = (x, y) => createRunForStaging({ ...stagingFromTape(parseTape(JSON.stringify(W.tape))),
        boot: { level: 45, x, y } }, SRC);
    const TILE = [7, 2];
    const key = (h) => [...h].sort().join('+') || '-';
    /** The walker over a bare run, as `jsRuntimeCore.tick` asks it: `heldFor`, advance, `observe`. */
    const walk = (x, y) => {
        const run = l45(x, y);
        const w = createRuntimeWalker({ apItemOf: () => null, isCollected: () => false }, { replanEvery: Infinity });
        w.setGoal({ kind: 'tile', level: 45, tile: TILE });
        w.play();
        const seq = [];
        for (let h = w.heldFor(run); h; h = w.heldFor(run)) {
            seq.push(key(h));
            run.advance(h);
            w.observe({});
        }
        return { seq, state: w.state, end: run.state };
    };
    /** The solver's walk (`drive`, `intermediate: !last`) over the same plan from the same boot. */
    const solverWalk = (x, y) => {
        const run = l45(x, y);
        const wps = planWaypoints(run.world, run.state, { x: TILE[0] * 16 + 8, y: TILE[1] * 16 + 8 }, null,
            { ...livePerVisitOpts(run), snapStart: true });
        const perTick = [];
        let err = null;
        try {
            wps.forEach((wp, i) => drive(run, wp, perTick, { until: 'arrival', tolerance: WALK_TOLERANCE, maxTicks: 400,
                what: 'the slide row', avoidVolumes: false, intermediate: i < wps.length - 1 }));
        } catch (e) {
            err = e.message;
        }
        return { wps, seq: perTick.map(key), err };
    };
    /** Today's choice (the scan before wave 16), driven tick by tick for `n` ticks. */
    const legacy = (x, y, n) => {
        const run = l45(x, y);
        const wps = planWaypoints(run.world, run.state, { x: TILE[0] * 16 + 8, y: TILE[1] * 16 + 8 }, null,
            { ...livePerVisitOpts(run), snapStart: true });
        const seq = [];
        for (let t = 0; t < n && !hasArrived(run.state, wps[wps.length - 1], WALK_TOLERANCE); t += 1) {
            const h = driveStepHeld(run, wps.find((w) => !hasArrived(run.state, w, WALK_TOLERANCE)) ?? wps[wps.length - 1],
                WALK_TOLERANCE);
            seq.push(key(h));
            run.advance(h);
        }
        return seq;
    };

    it.each([[152, 80, 54], [168, 88, 65]])('ON from (%i,%i): the walker holds the solver walk\'s keys, tick for tick (%i t), and arrives',
        (x, y, n) => withContactFidelity({ waypointSlide: true }, () => {
            const s = solverWalk(x, y);
            expect(s.wps).toEqual([{ x: 120, y: 72 }, { x: 120, y: 40 }]);
            expect(s.err).toBeNull();
            const r = walk(x, y);
            expect(r.state).toBe(WALK_STATES.DONE);
            expect(r.seq.length).toBe(n);
            expect(r.seq).toEqual(s.seq);
        }));

    it('ON: the scan without the slide floor turns back to (120,72) at tick 26 — the floor is what keeps step', () => withContactFidelity({ waypointSlide: true }, () => {
        const s = solverWalk(152, 80);
        const run = l45(152, 80);
        const seq = [];
        for (let t = 0; t < s.seq.length; t += 1) {
            const h = driveStepHeld(run, nextWaypoint(run.state, s.wps).wp, WALK_TOLERANCE);
            seq.push(key(h));
            run.advance(h);
        }
        const parted = seq.findIndex((k, i) => k !== s.seq[i]);
        expect(parted).toBe(26);
    }));

    it.each([[152, 80], [168, 88]])('OFF from (%i,%i): the walker\'s keys are today\'s scan, byte for byte, to the give-up', (x, y) => withContactFidelity({ waypointSlide: false }, () => {
        const r = walk(x, y);
        expect(r.state).toBe(WALK_STATES.FAILED);
        expect(r.seq).toEqual(legacy(x, y, r.seq.length));
    }));
});
