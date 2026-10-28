/**
 * ⛓⛓⛓ fidelity LIGHTPOLE D2 (wave 34, `CONTACT_FIDELITY.inRoomPoleThrust`) — an IN-ROOM pole's clear-tag is ONE Spear
 * thrust from its own room (`resolvePoleThrustStrategy` / `execPoleThrust`).
 *
 * ⛔ THE FIXTURE IS THE SHIPPED RULES: the four in-room pole events of `seedling_playthrough` (`kind: 'in-room-pole'`,
 * `seedlingObstacleEvents.deriveInRoomPoleEvents`) mapped by the JS side (`atlasEventGoal` → `solverGoalFor`), solved
 * from the sweep legs' arrivals (sweep 10's four unserved edges). Nothing about a stance is typed: the expectations are
 * the facts the rules-4 probes witnessed on p4g (L101's thrust is THROUGH the wall [8,4], facing E, the player flush
 * against the wall above at y 66; one thrust; the pole then `activate`).
 *
 * ── THE MUTATION LIST (each predicted red by name) ──
 *   m1 the row unconditional (`'solid:lightpole': 'pole'` with the switch OFF)
 *        -> "OFF: no row" reds (verb 'pole', not null) and the OFF solve stops refusing `no-verb`.
 *   m2 the flush points dropped (offsets 4..12 only)
 *        -> the L101 geometry rows and BOTH witness rows (measured: the ghost stance x 126 is the flush column too —
 *           only the FACING axis drops flush points).
 *   m3 a SECOND primary press after the first
 *        -> every "ONE thrust" row and both witness rows (two `primary` ticks).
 *   m4 the boot-active check dropped
 *        -> "already active at the build" reds: the verb thrusts and the run's pole ends inactive.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { atlasEventGoal, runtimeEventsOf } from '../flashPanel/seedlingPlaybackController.js';
import { clearTagVerbOf, solverGoalFor } from './jsRuntimeSolver.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { arrivalStaging } from './fidelityArrival.js';
import { CONTACT_FIDELITY, withContactFidelity } from './contactFidelity.js';
import { OBSTACLE_STRATEGIES, solveSegment, SolverRefusal, STRATEGY_EXECUTORS } from './solverBot.js';
import { RIGHT, UP } from './presses.js';
import { DEFAULT_DASH_MODE } from '../../../scripts/procgen/dashMode.js';

const PT = JSON.parse(readFileSync(new URL('../../presets/seedling_playthrough/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const SIDECARS = PT.preset_sidecars['1'];
const { events: EVENTS } = runtimeEventsOf(PT);
const sideLevel = (e) => SIDECARS[e.side]?.playable_payload?.level ?? null;
const goalOf = (eventId) => {
    const e = EVENTS.find((x) => x.eventId === eventId);
    return atlasEventGoal(e, sideLevel(e));
};
const SRC = atlasLevelSource();
const BAG = ['hasSword', 'hasShield', 'hasFire', 'canSwim', 'hasSpear'];
const refusalOf = (fn) => {
    try { fn(); } catch (e) { if (e instanceof SolverRefusal) return e; throw e; }
    return null;
};
/** The sweep legs' arrivals (keys at caa42ea5df: 558, 569, 740, 742). */
const LEGS = [
    ['flag:L63:6', { level: 63, x: 16, y: 208 }],
    ['flag:L65:0', { level: 65, x: 128, y: 16 }],
    ['flag:L101:0', { level: 101, x: 288, y: 240 }],
    ['flag:L101:0', { level: 101, x: 32, y: 96 }],
];
/** The first describe's clear-tag records, by leg, reused by the geometry rows (one 12 s solve, not two). */
const SOLVED = new Map();
const solveOn = (id, boot, { items = BAG, cleared = [] } = {}) => {
    const run = createRunForStaging(arrivalStaging(boot, { items, cleared }), SRC);
    const { goal } = solverGoalFor(goalOf(id), { run, resolved: null });
    const before = run.ticksCompleted;
    const out = solveSegment({ run, goals: [goal], name: `lightpole-${id}`, boot });
    return { run, goal, out, before };
};

describe('fidelity LIGHTPOLE — the switch', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY.inRoomPoleThrust).toBe(false);
    });

    it('OFF: no row (both tables read as before), and the JS side and the solver both refuse no-verb', () => {
        withContactFidelity({ inRoomPoleThrust: false }, () => {
            expect(OBSTACLE_STRATEGIES['solid:lightpole']).toBeUndefined();
            expect(STRATEGY_EXECUTORS.pole).toBeUndefined();
            expect(Object.keys(OBSTACLE_STRATEGIES)).not.toContain('solid:lightpole');
            expect(Object.keys(STRATEGY_EXECUTORS)).not.toContain('pole');
            expect(clearTagVerbOf('solid:lightpole')).toEqual({ verb: null, registered: false });
            const boot = { level: 65, x: 128, y: 16 };
            const run = createRunForStaging(arrivalStaging(boot, { items: BAG }), SRC);
            const mapped = solverGoalFor(goalOf('flag:L65:0'), { run, resolved: null });
            expect(mapped.refusal).toMatchObject({ kind: 'clear-tag', reason: 'no-verb' });
        });
    });

    it('ON: `solid:lightpole` selects `pole`, which is a registered clear-tag verb', () => {
        withContactFidelity({ inRoomPoleThrust: true }, () => {
            expect(OBSTACLE_STRATEGIES['solid:lightpole']).toBe('pole');
            expect(typeof STRATEGY_EXECUTORS.pole).toBe('function');
            expect(clearTagVerbOf('solid:lightpole')).toEqual({ verb: 'pole', registered: true });
        });
    });
});

describe('fidelity LIGHTPOLE — the four unserved edges of sweep 10, solved in the model', () => {
    it.each(LEGS)('%s from (%o): ONE thrust, the pole activate, the flag on the ledger', (id, boot) => {
        withContactFidelity({ inRoomPoleThrust: true }, () => {
            const { run, goal, out } = solveOn(id, boot);
            const rec = out.records.find((r) => r.goal === 'clear-tag');
            SOLVED.set(`${id}@${boot.x},${boot.y}`, rec);
            expect(rec).toMatchObject({ arm: 'verb', strategy: 'pole', flag: goal.tag, obstacle: goal.obstacle });
            expect(rec.hitsTimer).toBe(25);
            // one `primary` tick between the verb's start and its end: the thrust, never a second toggle
            const span = out.perTick.slice(rec.from, rec.from + rec.ticks);
            expect(span.filter((k) => k.has('primary'))).toHaveLength(1);
            expect(rec.pressTick - rec.from).toBe(span.findIndex((k) => k.has('primary')));
            expect(run.lightPolesNow.find((p) => p.id === goal.obstacle)).toMatchObject({ activate: true, lit: true });
            expect(run.ledger('earnedClears')).toContainEqual(expect.objectContaining({ ...goal.tag, by: 'lightpole' }));
        });
    });

    it.each(LEGS.slice(2))('L101 from (%o): the thrust goes THROUGH the wall [8,4] from [7,4], facing E, flush against the wall above (the rules-4 witness)', (id, boot) => {
        withContactFidelity({ inRoomPoleThrust: true }, () => {
            const rec = SOLVED.get(`${id}@${boot.x},${boot.y}`) ?? solveOn(id, boot).out.records.find((r) => r.goal === 'clear-tag');
            expect(rec.dir).toBe(RIGHT);
            expect(Math.floor(rec.stance.x / 16)).toBe(7);
            expect(rec.stance.y).toBe(66);
            expect(Math.floor(rec.at.x / 16)).toBe(7);
            expect(rec.at.y).toBeLessThan(68);
        });
    });
});

describe('fidelity LIGHTPOLE — refusals and the build\'s own state', () => {
    it('no Spear: `cannot-act`, by name, nothing walked', () => {
        withContactFidelity({ inRoomPoleThrust: true }, () => {
            const e = refusalOf(() => solveOn('flag:L65:0', { level: 65, x: 128, y: 16 },
                { items: BAG.filter((i) => i !== 'hasSpear') }));
            expect(e?.obstacle).toMatchObject({ kind: 'clear-tag', reason: 'cannot-act' });
            expect(e.message).toMatch(/NO SPEAR/);
        });
    });

    it('the pole already active at the build (its tag cleared): `already-clear`, no thrust — a thrust would put it out', () => {
        withContactFidelity({ inRoomPoleThrust: true }, () => {
            const { run, out, before } = solveOn('flag:L65:0', { level: 65, x: 128, y: 16 }, { cleared: [0] });
            expect(out.records).toEqual([expect.objectContaining({ goal: 'clear-tag', arm: 'already-clear' })]);
            expect(run.ticksCompleted).toBe(before);
            expect(run.lightPolesNow.find((p) => p.id === 'lightpole@128,168')).toMatchObject({ activate: true });
        });
    });
});

/**
 * The committed game witnesses (`plan-seedling-lightpole-witness.mjs`, p4g, model = game at 0 px over every
 * observation — `tapeRunner.test.js`'s fixture differential): the survey's step-226 staging, each tape IS the solver's
 * own plan with the switch ON (the Spear tape adds one idle tick, its trailing re-equip's).
 */
describe('fidelity LIGHTPOLE — the game witnesses are the solver\'s own plans', () => {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const tapeOf = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
    const keysOf = (t) => {
        const out = [];
        for (let i = 0; i < t.tick_count; i += 1) out.push([...(t.inputs ?? [])
            .filter((x) => x.from <= i && i < x.to).map((x) => x.key)].sort().join('+'));
        return out;
    };
    it.each([
        ['lightpole-l101-ghost', 'ghostsword', UP, 0],
        ['lightpole-l101-spear', 'spear', RIGHT, 1],
    ])('%s: the %s arm, facing %i, from [7,4]; the plan is the tape key for key', (name, weapon, dir, idle) => {
        const t = tapeOf(name);
        const staging = solveStaging(stagingFromTape({ ...t, inputs: [], tick_count: 0 }));
        staging.equips = [];
        const out = withContactFidelity({ inRoomPoleThrust: true }, () => {
            const run = createRunForStaging(staging, SRC);
            return solveSegment({ run, goals: [{ kind: 'clear-tag', tag: { level: 101, tag: 0 }, at: { x: 144, y: 64 },
                obstacle: 'lightpole@144,64' }], name, boot: staging.boot, dashMode: DEFAULT_DASH_MODE });
        });
        const rec = out.records.find((r) => r.goal === 'clear-tag');
        expect(rec).toMatchObject({ strategy: 'pole', weapon, dir });
        expect([Math.floor(rec.at.x / 16), Math.floor(rec.at.y / 16)]).toEqual([7, 4]);
        expect(out.perTick.length + idle).toBe(t.tick_count);
        expect(out.perTick.map((k) => [...k].sort().join('+'))).toEqual(keysOf(t).slice(0, out.perTick.length));
    }, 120_000);

    it('the ghost tape\'s bag has no Spear slot (the Ghost Sword fused it) — the arm is the bag\'s, not a choice', () => {
        const t = tapeOf('lightpole-l101-ghost');
        const run = createRunForStaging(solveStaging(stagingFromTape({ ...t, inputs: [], tick_count: 0 })), SRC);
        expect(run.progress('inventory')).toMatchObject({ hasGhostSword: true, hasSpear: true });
        expect(run.progress('inventorySlots')).not.toContain(3);
    });
});
