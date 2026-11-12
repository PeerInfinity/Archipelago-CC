/**
 * ⛓⛓ SEEDLING HAMMER-PHASE ROCKLOCK-MAPPER — the page's goal MAPPER reads the worker's `solid:rocklock` row when the
 * page URL turns NEW-LOCKS' `SEEDLING_ROCKLOCK_KILL` on (no new switch: the same name, read page-side).
 *
 *   rules event → `atlasEventGoal` → `jsRuntimeSolver.solverGoalFor` → `clearTagVerbOf('solid:rocklock')`
 *   the page's MAIN thread: `solverBot.ROCKLOCK_KILL` keeps its default (the channel sets the WORKER's env), so OFF and
 *     — before this slice — ON alike the table has no row → `no-verb` before any worker is asked.
 *   ON (`?seedlingSolverEnv=SEEDLING_ROCKLOCK_KILL=1` on the page): the row the worker will read (`hold`) → the goal.
 *
 * ⛔ THE MAIN THREAD IS SIMULATED EXACTLY: `ROCKLOCK_KILL` is held OFF (`withRockLockKill(false, …)`, as the page's
 * module copy has it) and the page URL is `globalThis.location`, restored after every row. The witnesses are NEW-LOCKS'
 * captured L26 legs (keys `level_26__r2c4 <- in_L25_0_96 -> location:L26 flag 0: rocklock@112,208 cleared` and
 * `… <- in_L27_32_0 -> …`), mapped from the shipped rules' event and solved as the worker does.
 *
 * ── THE MUTATION LIST (each predicted red by name) ──
 *   m1 the mapper ignores the page switch            -> "ON: the mapper hands … the goal" and the solve rows red.
 *   m2 the mapper reads the switch but not the URL   -> the page-side read rows red.
 *   m3 the row is read for every Solid (typed verb)  -> "a non-rocklock clear-tag is unchanged" reds.
 *   m4 the row is read with no param                 -> "OFF: today's refusal" reds.
 */
import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { atlasEventGoal, runtimeEventsOf } from '../flashPanel/seedlingPlaybackController.js';
import {
    clearTagVerbOf, EVENT_CLEAR_TAG_REFUSAL, replayTape, solveAnytime, solverGoalFor,
} from './jsRuntimeSolver.js';
import {
    OBSTACLE_STRATEGIES, ROCKLOCK_KILL, ROCKLOCK_KILL_DEFAULT, withKillLockClearWrite, withRockLockKill,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { LEG_286, LEG_289, staged } from './hammerNewLocksLegs.js';

const PT = JSON.parse(readFileSync(new URL('../../presets/seedling_playthrough/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const SIDECARS = PT.preset_sidecars['1'];
const { events: EVENTS } = runtimeEventsOf(PT);
const sideLevel = (e) => SIDECARS[e.side]?.playable_payload?.level ?? null;
const goalOf = (e) => atlasEventGoal(e, sideLevel(e));
/** The rocklock events, read off the rules (not typed). */
const ROCKLOCK_EVENTS = EVENTS.filter((e) => e.obstacle?.class === 'rocklock');

const HAD_LOCATION = Object.prototype.hasOwnProperty.call(globalThis, 'location');
const WAS = globalThis.location;
afterEach(() => { if (HAD_LOCATION) globalThis.location = WAS; else delete globalThis.location; });

/** Run `fn` as the page's MAIN thread: the module switch at its default (OFF), the page URL's query = `search`. */
function onPage(search, fn) {
    globalThis.location = { search };
    try { return withRockLockKill(false, fn); } finally {
        if (HAD_LOCATION) globalThis.location = WAS; else delete globalThis.location;
    }
}
const ON = '?seedlingSolverEnv=SEEDLING_ROCKLOCK_KILL=1';
const ON_WITH_WRITE = `?seedlingSolverEnv=${encodeURIComponent('SEEDLING_KILLLOCK_CLEAR_WRITE=1;SEEDLING_ROCKLOCK_KILL=1')}`;

/** A captured L26 leg: its event goal mapped on the page's main thread (`search`), as the page calls the mapper. */
function mapLeg(leg, search) {
    const { tape, levelSource } = staged(leg);
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence });
    const e = EVENTS.find((x) => x.obstacle?.class === 'rocklock' && sideLevel(x) === run.level);
    return { tape, mapped: onPage(search, () => solverGoalFor(goalOf(e), { run, resolved: null, levelSource })), e };
}

describe('ROCKLOCK-MAPPER — the switch (no new name)', () => {
    it('`SEEDLING_ROCKLOCK_KILL` ships OFF and the page channel already knows it', () => {
        expect(ROCKLOCK_KILL_DEFAULT).toBe(false);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_ROCKLOCK_KILL');
        expect(ROCKLOCK_EVENTS.map((e) => e.eventId)).toEqual(expect.arrayContaining(['flag:L26:0']));
    });

    it.each([
        [ON, true],
        [ON_WITH_WRITE, true],
        ['?seedlingSolverEnv=SEEDLING_ROCKLOCK_KILL=0', false],
        ['?seedlingSolverEnv=SEEDLING_KILLLOCK_CLEAR_WRITE=1', false],
        ['?seedlingSolverEnv=SEEDLING_NOT_A_SWITCH=1', false], // malformed → OFF here; the worker refuses it by name
        ['', false],
    ])('the page-side read: %s → %s', (search, on) => {
        expect(onPage(search, () => clearTagVerbOf('solid:rocklock')))
            .toEqual(on ? { verb: 'hold', registered: true } : { verb: null, registered: false });
    });

    it('no `location` (a node process): OFF unless the module switch itself is on', () => {
        delete globalThis.location;
        expect(withRockLockKill(false, () => clearTagVerbOf('solid:rocklock'))).toEqual({ verb: null, registered: false });
        expect(withRockLockKill(true, () => clearTagVerbOf('solid:rocklock'))).toEqual({ verb: 'hold', registered: true });
    });

    it('the mapper never leaves the module switch on, and the row stays non-enumerable', () => {
        onPage(ON, () => clearTagVerbOf('solid:rocklock'));
        expect(ROCKLOCK_KILL.enabled).toBe(process.env.SEEDLING_ROCKLOCK_KILL === '1');
        expect(Object.keys(OBSTACLE_STRATEGIES)).not.toContain('solid:rocklock');
    });
});

describe('ROCKLOCK-MAPPER — the L26 legs, mapped as the page\'s main thread maps them', () => {
    it.each([[LEG_286], [LEG_289]])('OFF: today\'s refusal, byte for byte (%#)', (leg) => {
        const { mapped, e } = mapLeg(leg, '');
        expect(mapped.goal).toBeUndefined();
        expect(mapped.refusal).toEqual({ kind: 'clear-tag', reason: 'no-verb', flag: { level: 26, tag: 0 }, id: 'rocklock@112,208' });
        expect(mapped.walker).toBe(EVENT_CLEAR_TAG_REFUSAL(goalOf(e), 'no-verb',
            'no strategy row exists for solid:rocklock — the catalogue names no verb that clears it'));
    });

    it.each([[LEG_286], [LEG_289]])('ON: the mapper hands the worker the goal its captured request carries (%#)', (leg) => {
        const { mapped, tape } = mapLeg(leg, ON);
        expect(mapped.goal).toEqual({ kind: 'clear-tag', tag: { level: 26, tag: 0 }, at: { x: 112, y: 208 }, obstacle: 'rocklock@112,208' });
        expect(mapped.goal).toEqual(tape.solverGoal);
    });

    it.each([
        [LEG_286, 629, ['kill', 'walk']],
        [LEG_289, 315, ['kill']],
    ])('ON: the mapped goal SOLVES in the worker (with KILLLOCK_CLEAR_WRITE), 0 hits, {26,0} written (%#)', (leg, ticks, verbs) => {
        const { mapped } = mapLeg(leg, ON_WITH_WRITE);
        const { passes, source, tape, levelSource } = staged(leg);
        const answer = withRockLockKill(true, () => withKillLockClearWrite(true,
            () => solveAnytime({ ...tape, solverGoal: mapped.goal, source, levelSource }, { passes })));
        expect(answer.ok).toBe(true);
        expect(answer.plan.solution.length).toBe(ticks);
        expect(answer.plan.verbs).toEqual(verbs);
        const fresh = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution], levelSource,
            scratchPersistence: tape.scratchPersistence });
        expect(fresh.ledger('playerHits')).toHaveLength(0);
        expect(fresh.scratchClears.map(({ level, tag }) => `${level}:${tag}`)).toEqual(['26:0']);
    });
});

describe('ROCKLOCK-MAPPER — everything else is unchanged', () => {
    it('ON maps every non-rocklock playthrough event exactly as OFF does', () => {
        const others = EVENTS.filter((e) => e.obstacle?.class !== 'rocklock');
        expect(others.length).toBeGreaterThan(10);
        for (const e of others) {
            const run = { level: sideLevel(e) };
            const off = onPage('', () => solverGoalFor(goalOf(e), { run, resolved: null }));
            const on = onPage(ON, () => solverGoalFor(goalOf(e), { run, resolved: null }));
            expect(on).toEqual(off);
        }
    });

    it.each(['solid:crusher', 'solid:witch', 'solid:watcher', 'solid:yeti', 'solid:finaldoor', 'solid:lock', 'solid:breakablerock'])(
        'a non-rocklock clear-tag key is unchanged ON: %s', (key) => {
            expect(onPage(ON, () => clearTagVerbOf(key))).toEqual(onPage('', () => clearTagVerbOf(key)));
        });
});
