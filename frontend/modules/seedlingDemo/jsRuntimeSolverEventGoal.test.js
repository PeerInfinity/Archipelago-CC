/**
 * ⛓ EVENT GOALS — a saved-obstacle EVENT location (`flag:L<level>:<tag>`) becomes the solver's `clear-tag` goal
 * (fidelity CLEARTAG + CROSSROOM D3), or a refusal BY THE SOLVER'S REASON.
 *
 *   rules event  →  `seedlingPlaybackController.atlasEventGoal` (a `location` goal carrying `event`, in the room
 *   the rules reach it from)  →  `jsRuntimeSolver.solverGoalFor`  →  `{kind: 'clear-tag', tag, at, obstacle,
 *   presser?}` | `{walker, refusal: {kind: 'clear-tag', reason}}`.
 *
 * ⛔ THE FIXTURE IS THE SHIPPED RULES: every event of `seedling_playthrough` (`runtimeEventsOf`), its arrival
 * room read off the rules' own sidecar (`playable_payload.level` of the event's `side` region). Nothing is typed
 * but the expectations.
 *
 * ── THE MUTATION LIST (each predicted red by name) ──
 *   m1 the presser dropped (`atlasEventGoal` never passes `action.presser`)
 *        -> "L39 flag 8 → the presser case" reds (no `presser`; `solverGoalFor` answers `wrong-level`).
 *   m2 the tag's level and tag swapped
 *        -> "every event maps…" and the L39 row red on the exact goal.
 *   m3 the refusal blanket again (one text, no reason)
 *        -> the crusher / rocklock / wrong-level rows red on `refusal.reason` and the reason in the text.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { atlasEventGoal, runtimeEventsOf } from '../flashPanel/seedlingPlaybackController.js';
import { clearTagVerbOf, EVENT_CLEAR_TAG_REFUSAL, solverGoalFor } from './jsRuntimeSolver.js';
import { locationGoalServed } from './wasmPlayback.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { assertGoal, OBSTACLE_STRATEGIES, solveSegment, SolverRefusal, STRATEGY_EXECUTORS, WAND_VERB } from './solverBot.js';

const PT = JSON.parse(readFileSync(new URL('../../presets/seedling_playthrough/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const SIDECARS = PT.preset_sidecars['1'];
const { events: EVENTS } = runtimeEventsOf(PT);
const sideLevel = (e) => SIDECARS[e.side]?.playable_payload?.level ?? null;
const goalOf = (eventId) => {
    const e = EVENTS.find((x) => x.eventId === eventId);
    return atlasEventGoal(e, sideLevel(e));
};
/** `solverGoalFor` with a run standing in `level` (the arrival's room unless said otherwise). */
const mapIn = (goal, level = goal.level) => solverGoalFor(goal, { run: { level }, resolved: null });
const SRC = atlasLevelSource();
const refusalOf = (fn) => {
    try { fn(); } catch (e) { if (e instanceof SolverRefusal) return e; throw e; }
    return null;
};

describe('⛓ EVENT GOALS — the census: every playthrough event is a clear-tag goal', () => {
    it('every event maps to clear-tag {flag, at, obstacle} the solver admits, in its arrival room', () => {
        expect(EVENTS.length).toBeGreaterThan(0);
        for (const e of EVENTS) {
            const goal = atlasEventGoal(e, sideLevel(e));
            expect(goal).toMatchObject({ kind: 'location', level: sideLevel(e), tag: null, name: e.location });
            const mapped = mapIn(goal);
            if (mapped.refusal) continue; // the no-verb rows below
            expect(mapped.goal).toMatchObject({ kind: 'clear-tag', tag: { level: e.level, tag: e.tag },
                at: { x: e.obstacle.x, y: e.obstacle.y }, obstacle: `${e.obstacle.class}@${e.obstacle.x},${e.obstacle.y}` });
            expect(assertGoal({ ...mapped.goal }, 0)).toEqual(mapped.goal);
        }
    });

    it.each([
        ['flag:L0:1', 'break'],
        ['flag:L12:4', 'keylock'],
        ['flag:L24:0', 'burn'],
        ['flag:L71:2', 'touch'],
        ['flag:L12:7', WAND_VERB.enabled ? 'wand' : 'kill'],
    ])('a same-room event (%s) maps exactly, its verb %s registered', (eventId, verb) => {
        const e = EVENTS.find((x) => x.eventId === eventId);
        const { goal } = mapIn(goalOf(eventId));
        expect(goal).toEqual({ kind: 'clear-tag', tag: { level: e.level, tag: e.tag }, at: { x: e.obstacle.x, y: e.obstacle.y },
            obstacle: `${e.obstacle.class}@${e.obstacle.x},${e.obstacle.y}` });
        expect(clearTagVerbOf(`solid:${e.obstacle.class}`)).toEqual({ verb, registered: true });
    });

    it.each([
        ['pushableblock', 'shove'], ['pushableblockspear', 'shove'], ['lock', 'hold'], ['shieldlocknorm', 'touch'],
        ['shieldboss', 'fight'], ['chest', 'chest'], ['breakablerock', 'break'],
    ])('the rest of fidelity\'s families: solid:%s → %s, registered (read off the solver\'s tables)', (cls, verb) => {
        expect(clearTagVerbOf(`solid:${cls}`)).toEqual({ verb, registered: true });
    });

    it('L39 flag 8 → the presser case: arrival L38, presser = the rules\' action.presser (fidelity CROSSROOM\'s goal)', () => {
        const goal = goalOf('flag:L39:8');
        expect(goal.level).toBe(38);
        expect(mapIn(goal)).toEqual({ goal: {
            kind: 'clear-tag', tag: { level: 39, tag: 8 }, at: { x: 144, y: 592 }, obstacle: 'wandlock@144,592',
            presser: { level: 38, class: 'buttonroom', x: 32, y: 48 } } });
        expect(clearTagVerbOf('proximity-hazard:buttonroom')).toEqual({ verb: 'hold', registered: true });
    });

    it('L62 flag 0 / L63 flag 1 (rules darktrap-events) → the presser case: the pole\'s flag, pressed in L63 / L61 (fidelity DARKTRAPQ\'s ev62/ev63 goals)', () => {
        const l62 = goalOf('flag:L62:0');
        expect(l62.level).toBe(63);
        expect(mapIn(l62)).toEqual({ goal: {
            kind: 'clear-tag', tag: { level: 62, tag: 0 }, at: { x: 120, y: 200 }, obstacle: 'lightpole@120,200',
            presser: { level: 63, class: 'buttonroom', x: 32, y: 64 } } });
        const l63 = goalOf('flag:L63:1');
        expect(l63.level).toBe(61);
        expect(mapIn(l63)).toEqual({ goal: {
            kind: 'clear-tag', tag: { level: 63, tag: 1 }, at: { x: 64, y: 88 }, obstacle: 'lightpole@64,88',
            presser: { level: 61, class: 'buttonroom', x: 176, y: 40 } } });
    });

    it('a same-room event names NO presser (only a flag in another level than the arrival\'s carries one)', () => {
        for (const e of EVENTS.filter((x) => sideLevel(x) === x.level)) {
            expect(atlasEventGoal(e, sideLevel(e)).event.presser).toBeUndefined();
        }
        expect(EVENTS.filter((x) => sideLevel(x) !== x.level).map((x) => x.eventId)).toEqual(['flag:L39:8', 'flag:L63:1', 'flag:L62:0']);
    });
});

describe('⛓ EVENT GOALS — refusals BY THE SOLVER\'S REASON, never a blanket', () => {
    it('crusher: no-verb (`bait` selected, no clear-tag executor)', () => {
        const goal = { kind: 'location', level: 5, tag: null, name: 'a crusher event',
            event: { tag: { level: 5, tag: 3 }, at: { x: 64, y: 64 }, obstacle: 'crusher@64,64' } };
        const r = mapIn(goal);
        expect(r.goal).toBeUndefined();
        expect(r.refusal).toEqual({ kind: 'clear-tag', reason: 'no-verb', flag: { level: 5, tag: 3 }, id: 'crusher@64,64' });
        expect(r.walker).toBe(EVENT_CLEAR_TAG_REFUSAL(goal, 'no-verb',
            'solid:crusher selects \'bait\', which no clear-tag executor is registered for'));
    });

    it.each([['flag:L112:1', 'rocklock'], ['flag:L113:0', 'finaldoor']])('%s (%s): no-verb (no strategy row)', (id, cls) => {
        const r = mapIn(goalOf(id));
        expect(r.refusal.reason).toBe('no-verb');
        expect(r.walker).toContain(`no-verb: no strategy row exists for solid:${cls}`);
    });

    it('wrong-level without a presser: L39 flag 8 with its presser dropped, the run in L38', () => {
        const { presser, ...event } = goalOf('flag:L39:8').event;
        const r = mapIn({ ...goalOf('flag:L39:8'), event });
        expect(presser).toBeDefined();
        expect(r.refusal).toMatchObject({ kind: 'clear-tag', reason: 'wrong-level', flag: { level: 39, tag: 8 } });
        expect(r.walker).toMatch(/refuses it — wrong-level: the run stands in level 38; the flag is level 39's, and the event names no presser/);
    });

    it('wrong-level with a presser of ANOTHER level: L39 flag 8 asked from L37', () => {
        const r = mapIn(goalOf('flag:L39:8'), 37);
        expect(r.refusal.reason).toBe('wrong-level');
        expect(r.walker).toContain('its presser buttonroom@32,48 is in level 38');
    });
});

describe('⛓ EVENT GOALS — `clearTagVerbOf` agrees with the solver\'s own clear-tag', () => {
    it('the crusher row is the table\'s, and bait is not a clear-tag executor', () => {
        expect(clearTagVerbOf('solid:crusher')).toEqual({ verb: OBSTACLE_STRATEGIES['solid:crusher'], registered: false });
        expect(STRATEGY_EXECUTORS[OBSTACLE_STRATEGIES['solid:crusher']]).toBeUndefined();
    });

    it.each([
        ['flag:L112:1', { level: 112, x: 32, y: 208 }],
        ['flag:L113:0', { level: 113, x: 72, y: 128 }],
    ])('%s: the SOLVER refuses the mapped goal no-verb too (the pre-check is the solver\'s answer, not a guess)', (id, boot) => {
        const goal = goalOf(id);
        const clearTag = { kind: 'clear-tag', tag: goal.event.tag, at: goal.event.at, obstacle: goal.event.obstacle };
        const run = createRunForStaging(arrivalStaging(boot, {}), SRC);
        const e = refusalOf(() => solveSegment({ run, goals: [clearTag], name: `event-goal-${id}`, boot }));
        expect(e?.obstacle).toMatchObject({ kind: 'clear-tag', reason: 'no-verb' });
        expect(mapIn(goal, boot.level).refusal.reason).toBe('no-verb');
    });

    it('end to end: L0 flag 4 from L13\'s stairs with the Sword — the mapped goal SOLVES and the flag lands on the ledger', () => {
        const boot = { level: 0, x: 48, y: 192 };
        const run = createRunForStaging(arrivalStaging(boot, { items: ['hasSword'] }), SRC);
        const { goal } = solverGoalFor(goalOf('flag:L0:4'), { run, resolved: null });
        const out = solveSegment({ run, goals: [goal], name: 'event-goal-L0-4', boot });
        expect(out.records).toEqual([expect.objectContaining({ goal: 'clear-tag', strategy: 'break', flag: { level: 0, tag: 4 } })]);
        expect(run.ledger('earnedClears')).toContainEqual(expect.objectContaining({ level: 0, tag: 4 }));
    });
});

describe('⛓ EVENT GOALS — served by the GAME\'s flag (the event\'s own, not the arrival room\'s)', () => {
    it('L39 flag 8 (goal room L38) is served by {39,8} in persistence_cleared, never by {38,8}', () => {
        const goal = goalOf('flag:L39:8');
        expect(locationGoalServed(goal, { persistence_cleared: [{ level: 39, tag: 8 }] })).toBe(true);
        expect(locationGoalServed(goal, { persistence_cleared: [{ level: 38, tag: 8 }] })).toBe(false);
        expect(locationGoalServed(goal, { persistence_cleared: [] })).toBe(false);
    });
});
