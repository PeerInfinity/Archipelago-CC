/**
 * jsRuntimeSolver — the Playback Bot's SOLVER MODE on the Seedling JS runtime
 * (solver-walk S1; plan `seedling-js-solver-walk-plan.md` §2.2 steps 1–7).
 *
 * Every witness drives the runtime the way the page and the host do: a
 * `new_instance Game` teleport into a real room, the J2 walker for W ticks
 * (enemies awake — the run is mid-room and not fresh), then the solver mode
 * switched on (`playback.setSolverWalk(true)`, the `flashPanel.seedlingSolverWalk`
 * setting's path) and `tick()` with NO keys until the walk settles. The rows
 * read what the page shows: the walk state, its reason, the runtime's events.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 drop the per-tick row check (play the plan blind)
 *        -> 'a live tick that leaves the expected trajectory …' reds (the
 *           re-boot row still passes: a new run is refuted by identity)
 *   m2 `autoAdvanceText` left on while the solver drives
 *        -> 'while the solver drives, … NO ceremony auto-advance' reds
 *   m3 a decline returns null (silent walker fallback)
 *        -> 'a refusal falls back … WITH the reason' reds
 *   m4 the shadow replays without the played equips
 *        -> 'an equip the play made is re-made in the next shadow' reds
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import { WALK_STATES } from './jsRuntimeWalker.js';
import {
    createRuntimeSolver, MAX_REFUTATIONS, replayShadow, runDigest, ShadowDivergence, solverGoalFor, passNote, budgetCut,
} from './jsRuntimeSolver.js';
import { DEADLINE_SITES } from './solverBot.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { returnKey, returnSpawnTable } from '../flashPanel/seedlingReturnSpawns.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const SRC = levelSourceFromAtlas(indexLevels(MAP));
const PLAYTHROUGH = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json').preset_sidecars['1'];
const ATLAS_LOCATION = readJson('frontend/presets/seedling_atlas_location/AP_1/AP_1_rules.json').preset_sidecars['1'];
const KIT = ['hasSword', 'hasShield', 'hasFire', 'hasWand', 'canSwim', 'hasSpear', 'hasFeather', 'hasTorch', 'hasDarkSuit'];
const RETURNS = returnSpawnTable(MAP);

const SETTLED = [WALK_STATES.DONE, WALK_STATES.FAILED];
const row = (run) => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });

/**
 * A live runtime in `region`, arrived through `fromId`, walking to `toId`
 * with the J2 walker for `walkTicks` ticks. Returns the runtime and the goal.
 */
function midRoom({ region, fromId, toId, walkTicks, kit = false }) {
    const pl = PLAYTHROUGH[region].playable_payload;
    const from = pl.exits.find((e) => e.exit_id === fromId);
    const spawn = RETURNS.get(returnKey(pl.level, ...from.exit_tiles[0])) ?? from.entrance_spawn;
    const to = pl.exits.find((e) => e.exit_id === toId);
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    if (kit) rt.queueItems(KIT.map((p) => ({ class: 'Main', property: p, value: true })));
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [pl.level, spawn.x, spawn.y] }]);
    rt.tick();
    const goal = { kind: 'exit', level: pl.level, tiles: to.exit_tiles };
    expect(rt.playback.walkTo(goal)).toEqual({ ok: true });
    rt.playback.play();
    for (let t = 0; t < walkTicks; t += 1) rt.tick();
    expect(rt.run.level).toBe(pl.level);
    expect(rt.run.ticksCompleted).toBeGreaterThan(0);
    return { rt, goal, level: pl.level };
}

/** Tick with no keys (the page, nobody at the keyboard) until the walk settles. */
function settle(rt, { maxTicks = 3000, each = () => {} } = {}) {
    const crossings = [];
    let t = 0;
    for (; t < maxTicks && !SETTLED.includes(rt.playback.state); t += 1) {
        const out = rt.tick();
        if (out.crossing) crossings.push(out.crossing);
        each(t, out);
    }
    return { ticks: t, crossings };
}

/** The solver-mode witness: solved → played → crossed, the end where the solved shadow ended. */
function expectSolvedCrossing(rt, { from, to, verbs }) {
    const before = rt.run;
    const { crossings } = settle(rt);
    const s = rt.playback.solverStats;
    expect(rt.playback.state).toBe(WALK_STATES.DONE);
    expect(s.solves).toBe(1);
    expect(s.refutations).toBe(0);
    expect(s.declines).toBe(0);
    expect(s.lastSolve.verbs).toEqual(expect.arrayContaining(verbs));
    // Every planned key played on the page's clock, one per tick.
    expect(s.played).toBe(s.lastSolve.keys);
    expect(crossings).toEqual([expect.objectContaining({ from, to })]);
    // End digest identical: the live run is where the solved shadow ended…
    expect(row(rt.run)).toEqual(s.lastSolve.end);
    expect(rt.run).toBe(before);
    // …and the page's own tape still reproduces it (the shadow assertion holds at the end).
    expect(runDigest(replayShadow(rt.session, SRC))).toBe(runDigest(rt.run));
    expect(rt.halted).toBeNull();
    expect(rt.events.filter((e) => e.type === 'solver').map((e) => e.solver)).toEqual(['solved']);
}

describe('jsRuntimeSolver — step 1, the goal mapping', () => {
    const run = { world: { teleporters: [{ x: 224, y: 32 }] } };
    it('an exit → reach-exit at the resolved teleporter\'s OEL x, y; a vanilla location → collect-placement', () => {
        expect(solverGoalFor({ kind: 'exit' }, { run, resolved: { allowTeleporter: 0 } }))
            .toEqual({ goal: { kind: 'reach-exit', exit: { x: 224, y: 32 } } });
        expect(solverGoalFor({ kind: 'location' }, { run, resolved: {}, placement: { x: 48, y: 16, type: 'chest' } }))
            .toEqual({ goal: { kind: 'collect-placement', placement: { x: 48, y: 16 } } });
    });
    it('only a tile goal keeps the J2 walker — ⛓ §5.36: a GENERATED set\'s exit and location are the solver\'s (no kind is asked)', () => {
        expect(solverGoalFor({ kind: 'tile' }, { run, resolved: {} }).walker).toMatch(/no solver goal kind/);
        // the old `generated` argument is no longer read: it maps exactly as without it
        for (const ctx of [{}, { generated: true }]) {
            expect(solverGoalFor({ kind: 'exit' }, { run, resolved: { allowTeleporter: 0 }, ...ctx }))
                .toEqual({ goal: { kind: 'reach-exit', exit: { x: 224, y: 32 } } });
            expect(solverGoalFor({ kind: 'location' }, { run, resolved: {}, placement: { x: 64, y: 16, type: 'apitem' }, ...ctx }))
                .toEqual({ goal: { kind: 'collect-placement', placement: { x: 64, y: 16 } } });
        }
    });
});

describe('jsRuntimeSolver — a LIVE mid-room state is solved, played on the page clock, and crosses', () => {
    it('L6 bare: BAIT past the bobs (ENEMIES) from 150 walker ticks in → L7', () => {
        const { rt } = midRoom({ region: 'level_6', fromId: 'in_L5_48_112', toId: 'out_stairsup_224_32', walkTicks: 150 });
        rt.playback.setSolverWalk(true);
        expectSolvedCrossing(rt, { from: 6, to: 7, verbs: ['bait'] });
    });

    it('L4 kit: SHOVE + HOLD from 40 walker ticks in → L5', () => {
        const { rt } = midRoom({
            region: 'level_4', fromId: 'in_L3_128_48', toId: 'out_stairsdown_64_16', walkTicks: 40, kit: true,
        });
        rt.playback.setSolverWalk(true);
        expectSolvedCrossing(rt, { from: 4, to: 5, verbs: ['hold', 'shove'] });
    });

    it('L12: a WALK the J2 walker cannot do (120 walker ticks in) → L36', () => {
        const { rt } = midRoom({
            region: 'level_12__r0c19', fromId: 'out_teleporter_304_0', toId: 'out_teleporter_168_368', walkTicks: 120,
        });
        rt.playback.setSolverWalk(true);
        expectSolvedCrossing(rt, { from: 12, to: 36, verbs: ['walk'] });
    });

    it('L86: the chest through collect-placement — the plan presses the ceremony X itself (no auto-advance)', () => {
        const house = ATLAS_LOCATION.region_2_2.playable_payload;
        const home = RETURNS.get(returnKey(house.level, ...house.exits[0].exit_tiles[0]));
        const chest = MAP.levels.find((l) => l.level === house.level).entities.find((e) => e.type === 'chest');
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [house.level, home.x, home.y] }]);
        rt.tick();
        for (let i = 0; i < 10; i += 1) rt.tick(new Set(['left']));
        rt.playback.setSolverWalk(true);
        rt.playback.walkTo({ kind: 'location', level: house.level, tag: Number(chest.attrs.tag), entityType: 'chest' });
        rt.playback.play();
        settle(rt);
        const s = rt.playback.solverStats;
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(s.lastSolve.verbs).toEqual(expect.arrayContaining(['chest']));
        expect(s.refutations).toBe(0);
        // While the solver drove, the page added no X of its own.
        expect(rt.session.autoText.ticks).toBe(0);
        expect(rt.events.filter((e) => e.type === 'check').map((e) => e.tag)).toEqual([Number(chest.attrs.tag)]);
    });
});

describe('jsRuntimeSolver — refusal, refutation, instant, and OFF', () => {
    it('a refusal falls back to the J2 walker WITH the solver\'s reason in the status (never silently)', () => {
        // From this state the solver declines (the danger map forbids its corridor).
        // ⛓ W=71, not §1.6's W=60: swim R4's i-frame preview fix made W=60 SOLVE;
        // the R4 sweep (W 0–240) leaves W=71 as the danger-map decline.
        const { rt } = midRoom({ region: 'level_6', fromId: 'in_L5_48_112', toId: 'out_stairsup_224_32', walkTicks: 71 });
        rt.playback.setSolverWalk(true);
        // ⛓ S2 — read the status AT the decline: the retry policy asks again after
        // a death (the decline-retry rows), and from W=71 the walker meets a bob
        // within a few ticks, so a later read would see the retry's solve.
        for (let t = 0; t < 20 && rt.playback.solverStats.declines === 0; t += 1) rt.tick();
        expect(rt.playback.state).toBe(WALK_STATES.WALKING);
        expect(rt.playback.reason).toMatch(/^the solver declined — solverBot\(.*\) reach-exit \(224,32\)->L7: .*; walking instead$/);
        expect(rt.playback.describe()).toContain('the solver declined');
        expect(rt.playback.solverStats).toMatchObject({ solves: 0, declines: 1, played: 0 });
        expect(rt.playback.stats.declined).toBe(rt.playback.solverStats.lastDecline);
        // The walker is walking: its own planner ran after the decline.
        expect(rt.playback.stats.plans).toBeGreaterThan(0);
        expect(rt.events.filter((e) => e.type === 'solver').map((e) => e.solver)).toEqual(['declined']);
    });

    it('a forced mismatch (an item re-boot mid-plan) refutes the plan and RE-SOLVES from the live state to the crossing', () => {
        const { rt } = midRoom({ region: 'level_6', fromId: 'in_L5_48_112', toId: 'out_stairsup_224_32', walkTicks: 150 });
        rt.playback.setSolverWalk(true);
        const firstRun = rt.run;
        const { crossings } = settle(rt, {
            each: (t) => { if (t === 40) rt.queueItems([{ class: 'Main', property: 'hasFeather', value: true }]); },
        });
        expect(rt.run).not.toBe(firstRun);
        const s = rt.playback.solverStats;
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(s.solves).toBe(2);
        expect(s.refutations).toBe(1);
        expect(s.lastRefutation).toMatch(/re-booted/);
        expect(crossings).toEqual([expect.objectContaining({ from: 6, to: 7 })]);
        expect(rt.events.filter((e) => e.type === 'solver').map((e) => e.solver)).toEqual(['solved', 'refuted', 'solved']);
        expect(row(rt.run)).toEqual(s.lastSolve.end);
    });

    it('a live tick that leaves the expected trajectory (same run) is refuted by the per-tick check and re-solved', () => {
        const { rt } = midRoom({ region: 'level_6', fromId: 'in_L5_48_112', toId: 'out_stairsup_224_32', walkTicks: 150 });
        rt.playback.reset();
        const events = [];
        const solver = createRuntimeSolver({
            getSession: () => rt.session, getLevelSource: () => SRC, onEvent: (e) => events.push(e),
        });
        solver.enabled = true;
        const goal = { kind: 'exit', level: 6, tiles: [[14, 2]] };
        const resolved = { allowTeleporter: rt.run.world.teleporters.findIndex((tp) => tp.x === 224 && tp.y === 32) };
        for (let t = 0; t < 10; t += 1) rt.session.step(solver.keysFor(rt.run, goal, resolved).held);
        expect(solver.stats.refutations).toBe(0);
        // Model nondeterminism, simulated: the tick the page runs is not the plan's.
        const planned = solver.keysFor(rt.run, goal, resolved).held;
        rt.session.step(new Set(planned.has('left') ? ['right'] : ['left']));
        const next = solver.keysFor(rt.run, goal, resolved);
        expect(next.held).toBeInstanceOf(Set);
        expect(solver.stats.refutations).toBe(1);
        expect(solver.stats.lastRefutation).toMatch(/^tick 11 of the plan: live level 6 \(.*\) deaths \d+, expected level 6 \(.*\) deaths \d+$/);
        expect(solver.stats.solves).toBe(2);
        expect(events.map((e) => e.type)).toEqual(['solved', 'refuted', 'solved']);
    });

    it('while the solver drives, the page asks the session for NO ceremony auto-advance', () => {
        const { rt } = midRoom({ region: 'level_6', fromId: 'in_L5_48_112', toId: 'out_stairsup_224_32', walkTicks: 150 });
        rt.playback.setSolverWalk(true);
        const session = rt.session;
        const real = session.heldFor;
        const asked = [];
        session.heldFor = (held, opts) => { asked.push(opts?.autoAdvanceText); return real(held, opts); };
        settle(rt);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        // Every tick but the crossing's last observation was the solver's: auto-advance OFF on each.
        expect(asked.length).toBe(rt.playback.solverStats.played);
        expect(new Set(asked)).toEqual(new Set([false]));
    });

    it(`the ${MAX_REFUTATIONS}rd refutation of one goal FAILS it by name`, () => {
        const { rt } = midRoom({ region: 'level_4', fromId: 'in_L3_128_48', toId: 'out_stairsdown_64_16', walkTicks: 40, kit: true });
        rt.playback.setSolverWalk(true);
        let flip = false;
        // Re-boot the room every 5 ticks: every plan is refuted.
        settle(rt, { each: (t) => { if (t % 5 === 4) { flip = !flip; rt.queueItems([{ class: 'Main', property: 'hasTorch', value: flip }]); } } });
        expect(rt.playback.state).toBe(WALK_STATES.FAILED);
        expect(rt.playback.reason).toMatch(new RegExp(`refuted ${MAX_REFUTATIONS} time\\(s\\) — last: the run was re-booted`));
        expect(rt.playback.solverStats.refutations).toBe(MAX_REFUTATIONS);
    });

    it('instant: one page tick plays the solved plan in a burst, and crosses', () => {
        const { rt } = midRoom({
            region: 'level_4', fromId: 'in_L3_128_48', toId: 'out_stairsdown_64_16', walkTicks: 40, kit: true,
        });
        rt.playback.setSolverWalk(true);
        rt.playback.instant();
        const out = rt.tick();
        expect(out.burst).toBeGreaterThan(100);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(rt.run.level).toBe(5);
        expect(rt.playback.solverStats.played).toBe(rt.playback.solverStats.lastSolve.keys);
        // play() leaves instant: the J2 clock rule again.
        rt.playback.play();
        expect(rt.tick().burst).toBeUndefined();
    });

    it('OFF ≡ the J2/J3 walk exactly: the same keys, states and events tick for tick (and the switch is inert)', () => {
        const trace = (prep) => {
            const { rt } = midRoom({ region: 'level_6', fromId: 'in_L5_48_112', toId: 'out_stairsup_224_32', walkTicks: 0 });
            prep(rt);
            const out = [];
            for (let t = 0; t < 400; t += 1) { rt.tick(); out.push(runDigest(rt.run), rt.playback.state, rt.playback.reason); }
            return { out, perTick: rt.session.perTick.map((h) => [...h].sort()), events: rt.events.map((e) => e.message) };
        };
        const never = trace(() => {});
        const toggled = trace((rt) => { rt.playback.setSolverWalk(true); rt.playback.setSolverWalk(false); });
        expect(toggled).toEqual(never);
        // `instant` with the mode off is `play` (the J2 rule): no burst.
        const { rt } = midRoom({ region: 'level_6', fromId: 'in_L5_48_112', toId: 'out_stairsup_224_32', walkTicks: 0 });
        rt.playback.instant();
        expect(rt.tick().burst).toBeUndefined();
        expect(rt.playback.solverWalk).toBe(false);
    });

    it('an equip the play made is re-made in the next shadow (the session\'s keys do not carry it)', () => {
        const { rt } = midRoom({ region: 'level_4', fromId: 'in_L3_128_48', toId: 'out_stairsdown_64_16', walkTicks: 5, kit: true });
        rt.playback.reset();
        const at = rt.session.perTick.length;
        expect(rt.run.primary).not.toBe(1);
        rt.run.equipNow(1);
        for (let t = 0; t < 5; t += 1) rt.tick();
        expect(rt.run.primary).toBe(1);
        expect(() => replayShadow(rt.session, SRC)).toThrow(ShadowDivergence);
        expect(() => replayShadow(rt.session, SRC)).toThrow(/a page bug, not a solver verdict/);
        expect(runDigest(replayShadow(rt.session, SRC, { equips: new Map([[at, 1]]) }))).toBe(runDigest(rt.run));
    });
});

/**
 * ⛓ WAVE-6 CONSUMER — the JS page at fidelity ARRIVAL's L12 → L0 landing (288,176), the rock unbroken (the
 * out-of-order arrival): the solver declines with `arrival-inside-solid`, the decline carries its `obstacle`
 * (`solverStats.lastDeclineObstacle` too), and the walk FAILS at once, by name, with the obstacle on its event —
 * never "walking instead" from inside a solid to the give-up clock.
 */
describe('jsRuntimeSolver — an arrival inside a solid (wave 6) fails the walk at once, with the obstacle', () => {
    it('L0 (288,176) bare, the back door to L12: declined `arrival-inside-solid`, FAILED on the first ticks', () => {
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [0, 288, 176] }]);
        rt.tick();
        const failed = [];
        rt.playback.onWalk((e) => { if (e.state === WALK_STATES.FAILED) failed.push(e); });
        rt.playback.setSolverWalk(true);
        // the back door, `teleporter@304,176` (L0's own exit to L12)
        expect(rt.playback.walkTo({ kind: 'exit', level: 0, tiles: [[19, 11]] })).toEqual({ ok: true });
        rt.playback.play();
        const { ticks } = settle(rt, { maxTicks: 60 });
        expect(rt.playback.state).toBe(WALK_STATES.FAILED);
        expect(ticks).toBeLessThan(5);
        expect(failed).toHaveLength(1);
        expect(failed[0].message).toMatch(/^the solver declined — .*arrival-inside-solid — the run's box at \(296,184\) in level 0 is INSIDE breakablerock@288,176/);
        expect(failed[0].obstacle).toMatchObject({ kind: 'arrival-inside-solid', id: 'breakablerock@288,176',
            flags: [{ level: 0, tag: 1 }], at: { level: 0, x: 296, y: 184 } });
        expect(failed[0].obstacle.wayOut.map((w) => w.kind)).toEqual(['restart', 'another-route']);
        expect(rt.playback.solverStats.lastDeclineObstacle).toEqual(failed[0].obstacle);
        expect(rt.run.state).toMatchObject({ x: 296, y: 184 });   // nothing walked
    });
});

describe('jsRuntimeSolver — wave 6\'s new deadline site passes through the notes', () => {
    it('`axe-dodge` (fidelity AXE): a pass stopped there is named in the note; it is no budget cut', () => {
        expect(DEADLINE_SITES).toContain('axe-dodge');
        const plan = { pass: 'dashless', passes: [{ pass: 'dashless', ok: true }, { pass: 'full', ok: false, deadline: 'axe-dodge', limit: 'window' }] };
        expect(passNote(plan)).toBe('pass dashless, full stopped at its deadline (axe-dodge)');
        expect(budgetCut(plan)).toBe(false);
    });
});
