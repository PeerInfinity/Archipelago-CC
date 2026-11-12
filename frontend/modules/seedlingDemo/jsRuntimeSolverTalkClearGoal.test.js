/**
 * ⛓⛓ SEEDLING HAMMER-PHASE YETI-TALK — the page's goal MAPPER passes a talk-cleared event to the solver's talk arm
 * (`TALK_CLEAR_GOAL`, `SEEDLING_TALK_CLEAR_GOAL=1`; ships OFF).
 *
 *   rules event → `atlasEventGoal` → `jsRuntimeSolver.solverGoalFor` → `clearTagVerbOf('solid:<class>')`
 *   OFF: the strategy tables only → no `solid:yeti` row → `no-verb` (the whole-game walk's L58 stop, byte-identical).
 *   ON:  the solver's own clear-tag arm (`solverBot.clearTagTalkArmOf`) → `talk` → the goal reaches `solveSegment`.
 *
 * ⛔ THE FIXTURE IS THE SHIPPED RULES (`seedling_playthrough`'s events); the witness is the L58 event's own leg (the
 * divergence leg list's `level_58__r3c3 <- in_tentacle_beast_mouth_L57_56_96 …` arrival, (48,96) in water, so the
 * route's Swim). Nothing about the Yeti is typed here but the witness's expectations.
 *
 * ── THE MUTATION LIST (each predicted red by name) ──
 *   m1 the mapper row ignores the switch            -> "OFF: no-verb, today's text" reds.
 *   m2 the mapper row types `yeti` instead of asking the arm -> "yetiTalk OFF: no arm, no-verb ON too" reds.
 *   m3 the mapper row passes every Solid            -> "a Solid with no talk arm still refuses" reds.
 *   m4 the page-side read ignores the URL           -> the `pageSolverEnvSwitchOn` rows red.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { atlasEventGoal, runtimeEventsOf } from '../flashPanel/seedlingPlaybackController.js';
import {
    clearTagVerbOf, EVENT_CLEAR_TAG_REFUSAL, solverGoalFor, TALK_CLEAR_GOAL, TALK_CLEAR_GOAL_DEFAULT, withTalkClearGoal,
} from './jsRuntimeSolver.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { withContactFidelity } from './contactFidelity.js';
import { assertGoal, clearTagTalkArmOf, solveSegment } from './solverBot.js';
import { pageSolverEnvSwitchOn, SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const PT = JSON.parse(readFileSync(new URL('../../presets/seedling_playthrough/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const SIDECARS = PT.preset_sidecars['1'];
const { events: EVENTS } = runtimeEventsOf(PT);
const sideLevel = (e) => SIDECARS[e.side]?.playable_payload?.level ?? null;
const goalOf = (e) => atlasEventGoal(e, sideLevel(e));
const mapIn = (goal, run = { level: goal.level }) => solverGoalFor(goal, { run, resolved: null });
/** The events whose obstacle the solver's clear-tag arm TALKS (read off the arm, not typed). */
const TALKED = () => EVENTS.filter((e) => clearTagTalkArmOf(e.obstacle?.class) === 'talk');
const SRC = atlasLevelSource();

describe('YETI-TALK — the switch', () => {
    it('ships OFF (`SEEDLING_TALK_CLEAR_GOAL=1` turns it on in node; the page channel knows the name)', () => {
        expect(TALK_CLEAR_GOAL_DEFAULT).toBe(false);
        expect(TALK_CLEAR_GOAL.enabled).toBe(process.env.SEEDLING_TALK_CLEAR_GOAL === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_TALK_CLEAR_GOAL');
        withTalkClearGoal(true, () => expect(TALK_CLEAR_GOAL.enabled).toBe(true));
        expect(TALK_CLEAR_GOAL.enabled).toBe(process.env.SEEDLING_TALK_CLEAR_GOAL === '1');
    });

    it.each([
        ['?seedlingSolverEnv=SEEDLING_TALK_CLEAR_GOAL=1', true],
        ['?x=1&seedlingSolverEnv=SEEDLING_KILLLOCK_CHASER_REWIND%3D1%3BSEEDLING_TALK_CLEAR_GOAL%3D1', true],
        ['?seedlingSolverEnv=SEEDLING_TALK_CLEAR_GOAL=0', false],
        ['?seedlingSolverEnv=SEEDLING_KILLLOCK_CHASER_REWIND=1', false],
        ['?seedlingSolverEnv=SEEDLING_NOT_A_SWITCH=1', false], // malformed → OFF here; the worker refuses it by name
        ['', false],
    ])('the page-side read: %s → %s', (search, on) => {
        expect(pageSolverEnvSwitchOn('SEEDLING_TALK_CLEAR_GOAL', { location: { search } })).toBe(on);
    });

    it('no `location` (node) reads OFF', () => {
        expect(pageSolverEnvSwitchOn('SEEDLING_TALK_CLEAR_GOAL', {})).toBe(false);
    });
});

describe('YETI-TALK — the mapper, OFF and ON', () => {
    it('the shipped rules hold a talked event (the arm\'s witness exists)', () => {
        expect(TALKED().map((e) => e.eventId)).toEqual(['flag:L58:1']);
    });

    it('OFF: no-verb, today\'s text, byte for byte (the walk\'s L58 stop)', () => withTalkClearGoal(false, () => {
        for (const e of TALKED()) {
            const goal = goalOf(e);
            const key = `solid:${e.obstacle.class}`;
            expect(clearTagVerbOf(key)).toEqual({ verb: null, registered: false });
            expect(mapIn(goal)).toEqual({
                walker: EVENT_CLEAR_TAG_REFUSAL(goal, 'no-verb',
                    `no strategy row exists for ${key} — the catalogue names no verb that clears it`),
                refusal: { kind: 'clear-tag', reason: 'no-verb', flag: { level: e.level, tag: e.tag },
                    id: `${e.obstacle.class}@${e.obstacle.x},${e.obstacle.y}` } });
        }
    }));

    it('ON: the exact clear-tag goal the solver admits, its verb `talk`, registered', () => withTalkClearGoal(true, () => {
        for (const e of TALKED()) {
            expect(clearTagVerbOf(`solid:${e.obstacle.class}`)).toEqual({ verb: 'talk', registered: true });
            const mapped = mapIn(goalOf(e));
            expect(mapped).toEqual({ goal: { kind: 'clear-tag', tag: { level: e.level, tag: e.tag },
                at: { x: e.obstacle.x, y: e.obstacle.y }, obstacle: `${e.obstacle.class}@${e.obstacle.x},${e.obstacle.y}` } });
            expect(assertGoal({ ...mapped.goal }, 0)).toEqual(mapped.goal);
        }
    }));

    it('ON with the arm OFF (`yetiTalk` OFF): no arm, so no-verb ON too', () => withTalkClearGoal(true, () => {
        withContactFidelity({ yetiTalk: false }, () => {
            expect(TALKED()).toEqual([]);
            const e = EVENTS.find((x) => x.eventId === 'flag:L58:1');
            expect(mapIn(goalOf(e)).refusal?.reason).toBe('no-verb');
        });
    }));

    it.each(['rocklock', 'witch', 'watcher', 'crusher'])('ON: a Solid with no talk arm still refuses (solid:%s)', (cls) => {
        const off = withTalkClearGoal(false, () => clearTagVerbOf(`solid:${cls}`));
        withTalkClearGoal(true, () => expect(clearTagVerbOf(`solid:${cls}`)).toEqual(off));
        const goal = { kind: 'location', level: 5, tag: null, name: `a ${cls} event`,
            event: { tag: { level: 5, tag: 3 }, at: { x: 64, y: 64 }, obstacle: `${cls}@64,64` } };
        withTalkClearGoal(true, () => {
            if (!off.registered) expect(mapIn(goal).refusal?.reason).toBe('no-verb');
        });
    });

    it('ON: every playthrough event maps exactly as OFF but the talked ones', () => {
        const talked = new Set(TALKED().map((e) => e.eventId));
        for (const e of EVENTS) {
            const off = withTalkClearGoal(false, () => mapIn(goalOf(e)));
            const on = withTalkClearGoal(true, () => mapIn(goalOf(e)));
            if (talked.has(e.eventId)) expect(on).not.toEqual(off);
            else expect(on).toEqual(off);
        }
    });
});

describe('YETI-TALK — ON, the mapped goal SOLVES on the solver\'s talk arm (the L58 leg\'s arrival)', () => {
    // The divergence leg list's L58 event leg: arrival (48,96) through the beast's mouth, in water (the route holds Swim).
    const boot = { level: 58, x: 48, y: 96 };
    it('flag:L58:1 → talk, hitless, both of `doneTalking()`\'s flags on the ledger', () => withTalkClearGoal(true, () => {
        const e = EVENTS.find((x) => x.eventId === 'flag:L58:1');
        const run = createRunForStaging(arrivalStaging(boot, { items: ['hasSword', 'canSwim'] }), SRC);
        const { goal } = solverGoalFor(goalOf(e), { run, resolved: null });
        expect(goal).toBeDefined();
        const out = solveSegment({ run, goals: [goal], name: 'yeti-talk-L58', boot });
        expect(out.records).toEqual([expect.objectContaining({ goal: 'clear-tag', arm: 'verb', strategy: 'talk',
            flag: { level: 58, tag: 1 }, target: 'yeti@56,56', cause: 'done' })]);
        expect(run.damage.hits).toBe(0);
        const earned = run.ledger('earnedClears').filter((c) => c.level === 58).map((c) => c.tag).sort();
        expect(earned).toEqual([0, 1]);
        expect(out.perTick.length).toBeGreaterThan(0);
    }));
});
