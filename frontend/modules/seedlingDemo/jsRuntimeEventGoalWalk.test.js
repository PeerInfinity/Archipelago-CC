/**
 * ⛓ EVENT GOALS ON THE JS PAGE (slice `seedling-js-event-goals`) — a saved-obstacle EVENT location is walked on the JS
 * runtime as the solver's `clear-tag`, and completes the wasm runtime's way: when the game's OWN persistence flag
 * `goal.event.tag` turns set (`wasmPlayback.locationGoalServed` over `botStatus().persistence_cleared`), never on the
 * plan finishing. The clear reaches the host as the same `pendingCheck` the event collector reads on both runtimes.
 *
 * ⛔ THE FIXTURE IS THE SHIPPED RULES: the event record is `seedling_playthrough`'s (`runtimeEventsOf`), the goal the
 * playback controller's (`atlasEventGoal`), the arrival its `side` region's own payload. Nothing is typed but the
 * expectations.
 *
 * ── THE MUTATION LIST (each predicted red by name) ──
 *   m1 the blanket "walked on the wasm runtime" refusal re-instated in `validateGoal`
 *        -> "L16's rope …" reds on `walkTo` (ok false) and every later row of it.
 *   m2 `locationServed` dropped (the walker's `isCollected(goal.level, goal.tag)` with tag null)
 *        -> "L16's rope …" reds: the walk never settles DONE (it plays the plan, then re-asks the solver).
 *   m3 the event decline walks instead (the `goal.event` decline arm removed)
 *        -> "no weapon …" reds: the walk is WALKING, not FAILED.
 *   m4 an event's solver refusal walks silently (`keysFor`'s `goal.event` refusal arm removed)
 *        -> "no-verb / wrong-level …" red: the walk is WALKING (or moved), not FAILED by no-verb.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createJsRuntime } from './jsRuntimeCore.js';
import { createRuntimeWalker, WALK_STATES } from './jsRuntimeWalker.js';
import { atlasEventGoal, runtimeEventsOf } from '../flashPanel/seedlingPlaybackController.js';

const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const MAP = readJson('../flashPanel/atlases/seedling-map.json');
const PT = readJson('../../presets/seedling_playthrough/AP_1/AP_1_rules.json');
const SIDECARS = PT.preset_sidecars['1'];
const EVENTS = runtimeEventsOf(PT).events;
const SETTLED = [WALK_STATES.DONE, WALK_STATES.FAILED];

const ROPE = EVENTS.find((e) => e.eventId === 'flag:L16:0');
const ROPE_ROOM = SIDECARS[ROPE.side].playable_payload;
const ROPE_SPAWN = ROPE_ROOM.exits.find((x) => x.entrance_spawn).entrance_spawn;
const ROPE_GOAL = atlasEventGoal(ROPE, ROPE_ROOM.level);
const cleared = (rt) => JSON.parse(rt.game.botStatus()).persistence_cleared;
const hasFlag = (rt, { level, tag }) => cleared(rt).some((c) => c.level === level && c.tag === tag);

/** A JS page on the vanilla map, `items` set, teleported to the rope's arrival; the solver mode `solver`. */
function ropeRoom({ items = [], solver = true } = {}) {
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    rt.game.configure({ state_properties: [{ class: 'Game', property: 'pendingCheck' }] });
    rt.queueItems(items.map((p) => ({ class: 'Main', property: p, value: true })));
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [ROPE_ROOM.level, ROPE_SPAWN.x, ROPE_SPAWN.y] }]);
    rt.tick();
    rt.playback.setSolverWalk(solver);
    return rt;
}

describe('⛓ EVENT GOALS — the JS page walks a saved-obstacle event to its flag', () => {
    it('the fixture: L16\'s rope is a same-room event of the shipped rules, arrived at from its side region', () => {
        expect(ROPE_GOAL).toMatchObject({ kind: 'location', level: 16, tag: null,
            event: { tag: { level: 16, tag: 0 }, obstacle: 'rope@32,16' } });
        expect(ROPE_GOAL.event.presser).toBeUndefined();
    });

    it('L16\'s rope (the sword held): accepted, solved as clear-tag, DONE exactly when the game\'s flag {16,0} is set', () => {
        const rt = ropeRoom({ items: ['hasSword'] });
        expect(rt.run.level).toBe(16);
        expect(hasFlag(rt, ROPE_GOAL.event.tag)).toBe(false);
        expect(rt.playback.walkTo(ROPE_GOAL)).toEqual({ ok: true });
        rt.playback.play();
        // The completion is the FLAG: DONE lands on the first tick that finds it set, never before.
        let flagAtDone = null;
        let firstFlagTick = null;
        let t = 0;
        for (; t < 4000 && !SETTLED.includes(rt.playback.state); t += 1) {
            rt.tick();
            if (firstFlagTick === null && hasFlag(rt, ROPE_GOAL.event.tag)) firstFlagTick = t;
            if (rt.playback.state === WALK_STATES.DONE) flagAtDone = hasFlag(rt, ROPE_GOAL.event.tag);
        }
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(flagAtDone).toBe(true);
        // (the walker reads `done` at the top of the NEXT tick's keys: one tick after the clear)
        expect(t - 1 - firstFlagTick).toBeLessThanOrEqual(1);
        expect(rt.halted).toBeNull();
        const s = rt.playback.solverStats;
        expect(s.lastSolve.goal).toMatchObject({ kind: 'clear-tag', tag: { level: 16, tag: 0 }, obstacle: 'rope@32,16' });
        expect(`${s.solves}/${s.declines}/${s.refutations}`).toBe('1/0/0');
        // The host heard it as the collector reads it on both runtimes: one `pendingCheck` clear of {16,0}.
        const checks = rt.events.filter((e) => e.type === 'check' && e.clear).map((e) => `${e.level}:${e.tag}`);
        expect(checks.filter((k) => k === '16:0')).toEqual(['16:0']);
        expect(rt.playback.describe()).toContain('L16 flag 0: rope@32,16 cleared');
    }, 120000);

    it('no weapon: the solver declines by name and the goal FAILS with that reason (no "walking instead")', () => {
        const rt = ropeRoom();
        expect(rt.playback.walkTo(ROPE_GOAL)).toEqual({ ok: true });
        rt.playback.play();
        for (let t = 0; t < 200 && !SETTLED.includes(rt.playback.state); t += 1) rt.tick();
        expect(rt.playback.state).toBe(WALK_STATES.FAILED);
        expect(rt.playback.reason).toMatch(/^the solver declined — solverBot\(.*\) clear-tag \{16,0\} rope@32,16: 'rope' cannot act/);
        expect(rt.run.level).toBe(16);
        expect(hasFlag(rt, ROPE_GOAL.event.tag)).toBe(false);
    }, 120000);

    it('the solver mode OFF: refused by name (nothing else here can set a flag on purpose)', () => {
        const rt = ropeRoom({ solver: false });
        const answer = rt.playback.walkTo(ROPE_GOAL);
        expect(answer.ok).toBe(false);
        expect(answer.reason).toMatch(/saved-obstacle EVENT \(clear-tag \{16,0\} rope@32,16\): it is walked by the solver's clear-tag, and the solver mode is off/);
    });

    it('an event that names no integer flag is refused by name', () => {
        const rt = ropeRoom();
        const answer = rt.playback.walkTo({ ...ROPE_GOAL, event: { ...ROPE_GOAL.event, tag: { level: 16, tag: null } } });
        expect(answer).toEqual({ ok: false, reason: `"${ROPE_GOAL.name}" is a saved-obstacle EVENT that names no flag {level, tag}` });
    });
});

describe('⛓ EVENT GOALS — the walker completes a location by `locationServed` when given one', () => {
    const walkerWith = (served) => {
        const calls = [];
        const w = createRuntimeWalker({
            apItemOf: () => null, locationPointOf: () => ({ x: 40, y: 40 }),
            isCollected: () => { throw new Error('isCollected must not be asked when locationServed is given'); },
            locationServed: (goal) => { calls.push(goal.event?.tag ?? null); return served.value; },
        });
        return { w, calls };
    };
    const run = { level: 16, state: { x: 40, y: 40 }, world: { teleporters: [] } };

    it('served = the flag set → DONE; unset → not DONE; asked with the goal\'s own flag', () => {
        const served = { value: true };
        const { w, calls } = walkerWith(served);
        w.setGoal(ROPE_GOAL);
        w.play();
        expect(w.heldFor(run)).toBeNull();
        expect(w.state).toBe(WALK_STATES.DONE);
        expect(calls[0]).toEqual({ level: 16, tag: 0 });
        served.value = false;
        w.setGoal(ROPE_GOAL);
        try { w.heldFor(run); } catch { /* the stub run cannot be walked: only the state is read */ }
        expect(w.state).not.toBe(WALK_STATES.DONE);
    });
});

describe('⛓ EVENT GOALS — a solver refusal BY NAME fails the walk with that name (never a silent walk)', () => {
    // ⚠ The shipped no-verb events (L112's rocklock, L58's yeti) cannot be stood in here: the JS model refuses to
    // build L112 (the Owl fight needs the split RNG) and L58's side region names no arrival spawn. So the rope room
    // carries the refusals: the obstacle swapped for one the solver's tables refuse (`crusher` selects `bait`, which
    // no clear-tag executor runs), and a flag of another level with no presser (`wrong-level`).
    it.each([
        ['no-verb', { obstacle: 'crusher@32,16' }, /refuses it — no-verb: solid:crusher selects 'bait'/],
        ['wrong-level', { tag: { level: 17, tag: 0 } }, /refuses it — wrong-level: the run stands in level 16; the flag is level 17's/],
    ])('%s: accepted by the page, FAILED with the solver\'s reason, the run not moved', (_, patch, why) => {
        const rt = ropeRoom({ items: ['hasSword'] });
        expect(rt.playback.walkTo({ ...ROPE_GOAL, event: { ...ROPE_GOAL.event, ...patch } })).toEqual({ ok: true });
        rt.playback.play();
        const at = { x: rt.run.state.x, y: rt.run.state.y };
        for (let t = 0; t < 50 && !SETTLED.includes(rt.playback.state); t += 1) rt.tick();
        expect(rt.playback.state).toBe(WALK_STATES.FAILED);
        expect(rt.playback.reason).toMatch(why);
        expect({ level: rt.run.level, x: rt.run.state.x, y: rt.run.state.y }).toEqual({ level: 16, ...at });
    });
});
