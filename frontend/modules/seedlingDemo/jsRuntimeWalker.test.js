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
import { createRuntimeWalker, teleporterAtTile, WALK_STATES } from './jsRuntimeWalker.js';
import { drive, driveStepHeld, planTilePath, planWaypoints } from './botDriverV2.js';
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
            .toEqual({ ok: false, reason: 'level 0 has no teleporter on tile (2, 2)' });
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
