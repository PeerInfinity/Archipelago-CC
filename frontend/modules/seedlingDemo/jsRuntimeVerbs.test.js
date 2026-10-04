/**
 * jsRuntimeSolver — solver-walk S4: the solver's remaining verbs on the
 * committed atlas rooms (plan `seedling-js-solver-walk-plan.md` §3 "S4").
 *
 * W0 measured which goals of the committed atlas worlds map to which verb
 * (`seedling_atlas`, `_location`, `_host`, `seedling_playthrough`; the table
 * is in the S4 AS-BUILT). Every DOOR exit already reached the solver
 * (`reach-exit`, S1) and every bound location already mapped to
 * `collect-placement` (S1). What was missing was the PIT exit: the
 * playthrough's `out_pit_*` exits name a pit tile with no teleporter on it,
 * so the page refused them at `walkTo`. These rows witness:
 *
 *   · PIT EXITS → `reach-pit` — L48 and L84 (a walk), L30 with the kit (a
 *     `break` of the rock that stands on the pit; the J2 walker alone stalls
 *     there). The crossing is the FALL: the page writes no `pendingExit` (the
 *     game writes one only in `Teleporter.update()`), and the solved plan's
 *     tail is the transport coast, which the page then runs with no keys.
 *   · CHESTS and PICKUPS through `collect-placement` beyond S1's L86 chest —
 *     L17's chest (bare), L109's Firewand (`collect`, bare), L11's chest
 *     (kit); and L12's chest behind the shield lock DECLINES by name (bare:
 *     the `touch` needs the shield).
 *   · EQUIPS: none of these solves emits one — the solver's only `equip`
 *     site is the BobBoss encounter (`solverBot.js`, the burn), which is
 *     DEFERRED (⚖). The S1 path (`run.equipNow` at the plan's tick, re-made
 *     in the next shadow) is unchanged; a row pins that none was emitted.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 `solverGoalFor` ignores `resolved.pit` (a pit exit stays `reach-exit`)
 *        -> the mapping row and the three pit witnesses red
 *   m2 the core reports no crossing for a fall
 *        -> the three pit witnesses + the OFF row red (the walk never completes)
 *   m3 the walker completes ANY exit on ANY crossing (no door/pit match)
 *        -> 'a fall never completes a door exit …' red
 *   m4 `validateGoal` drops the pit arm
 *        -> 'walkTo accepts a pit exit …', the three pit witnesses + the OFF row red
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import { createRuntimeWalker, nearestPitAt, WALK_STATES } from './jsRuntimeWalker.js';
import { replayShadow, runDigest, solverGoalFor } from './jsRuntimeSolver.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const SRC = levelSourceFromAtlas(indexLevels(MAP));
const PLAYTHROUGH = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json').preset_sidecars['1'];
const GAME = readJson('frontend/modules/flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties });
const KIT = ['hasSword', 'hasShield', 'hasFire', 'hasWand', 'canSwim', 'hasSpear', 'hasFeather', 'hasTorch', 'hasDarkSuit'];
const SETTLED = [WALK_STATES.DONE, WALK_STATES.FAILED];
const row = (run) => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });

/** A live runtime in `region`, arrived at its payload's first entrance spawn (or `at`), every report captured. */
function arrive({ region, at = null, kit = false }) {
    const pl = PLAYTHROUGH[region].playable_payload;
    const spawn = at ?? pl.exits.find((e) => e.entrance_spawn).entrance_spawn;
    const reports = [];
    const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
    expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
    rt.setVanilla(MAP);
    if (kit) rt.queueItems(KIT.map((p) => ({ class: 'Main', property: p, value: true })));
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [pl.level, spawn.x, spawn.y] }]);
    rt.tick();
    return { rt, pl, reports };
}

/** The playthrough's own exit goal, as the host controller resolves it (`exit_tiles`). */
const exitGoal = (pl, exitId) => ({ kind: 'exit', level: pl.level, tiles: pl.exits.find((e) => e.exit_id === exitId).exit_tiles });

/** Walk `goal` with the J2 walker for `walkTicks` (mid-room: the run has ticked), then hand it to the solver mode. */
function midRoomThenSolver(rt, goal, walkTicks) {
    expect(rt.playback.walkTo(goal)).toEqual({ ok: true });
    rt.playback.play();
    for (let t = 0; t < walkTicks; t += 1) rt.tick();
    expect(rt.run.level).toBe(goal.level);
    expect(rt.run.ticksCompleted).toBeGreaterThan(walkTicks - 1);
    rt.playback.setSolverWalk(true);
}

function settle(rt, { maxTicks = 3000 } = {}) {
    const crossings = [];
    let t = 0;
    for (; t < maxTicks && !SETTLED.includes(rt.playback.state); t += 1) {
        const out = rt.tick();
        expect(out.halted ?? null).toBeNull();
        if (out.crossing) crossings.push(out.crossing);
    }
    return { ticks: t, crossings };
}

/**
 * The pit witness: solved once, played on the page clock, the walk DONE on
 * the fall, no pendingExit; the plan's unplayed tail is the transport coast,
 * which the page runs keyless — and then the live run is where the solved
 * shadow ended, and the page's own tape still reproduces it.
 */
function expectSolvedFall(rt, reports, { from, to, verbs }) {
    reports.length = 0;
    const before = rt.run;
    const { crossings } = settle(rt);
    const s = rt.playback.solverStats;
    expect(rt.playback.state).toBe(WALK_STATES.DONE);
    expect(s).toMatchObject({ solves: 1, refutations: 0, declines: 0 });
    expect(s.lastSolve.goal.kind).toBe('reach-pit');
    expect(s.lastSolve.verbs).toEqual(expect.arrayContaining(verbs));
    expect(crossings).toEqual([{ from, to, type: 'pit' }]);
    // A fall writes no pendingExit in the game (`Teleporter.as:107` is the only writer); the level move is the report.
    expect(reports.filter(([p, v]) => p === 'pendingExit' && v)).toEqual([]);
    expect(reports.filter(([p]) => p === 'level')).toEqual([['level', to]]);
    // The walk settled on the fall; the rest of the plan is the transport coast, played keyless by the page.
    const coast = s.lastSolve.keys - s.played;
    expect(coast).toBeGreaterThan(0);
    for (let t = 0; t < coast; t += 1) rt.tick();
    expect(rt.run.state.fall ?? null).toBeNull();
    expect(row(rt.run)).toEqual(s.lastSolve.end);
    expect(rt.run).toBe(before);
    expect(runDigest(replayShadow(rt.session, SRC))).toBe(runDigest(rt.run));
    expect(rt.halted).toBeNull();
    expect(rt.events.filter((e) => e.type === 'solver').map((e) => e.solver)).toEqual(['solved']);
}

describe('S4 — PIT exits: the goal mapping and the page', () => {
    it('a walker exit resolved to a PIT tile → reach-pit at the tile (its rect origin = tile · 16)', () => {
        const run = { world: { teleporters: [] } };
        expect(solverGoalFor({ kind: 'exit' }, { run, resolved: { allowTeleporter: null, pit: { tx: 11, ty: 3 } } }))
            .toEqual({ goal: { kind: 'reach-pit', pit: { tx: 11, ty: 3, x: 176, y: 48 } } });
        // A generated set still keeps the walker, pit or no pit.
        expect(solverGoalFor({ kind: 'exit' }, { run, resolved: { pit: { tx: 1, ty: 1 } }, generated: true }).walker)
            .toMatch(/generated level set keeps the J2 walker/);
    });

    it('nearestPitAt picks the LIVE pit among an exit\'s cells, nearest first; a cell that is no pit is skipped', () => {
        const world = { pitTiles: [{ tx: 1, ty: 1 }, { tx: 5, ty: 1 }] };
        expect(nearestPitAt(world, [[1, 1], [5, 1]], { x: 88, y: 24 })).toMatchObject({ tx: 5, ty: 1 });
        expect(nearestPitAt(world, [[1, 1], [5, 1]], { x: 8, y: 24 })).toMatchObject({ tx: 1, ty: 1 });
        expect(nearestPitAt(world, [[2, 2]], { x: 0, y: 0 })).toBeNull();
    });

    it('walkTo accepts a pit exit (it used to refuse: no teleporter on the tile); a cell that is neither still refuses', () => {
        const { rt, pl } = arrive({ region: 'level_48__r2c10' });
        expect(rt.playback.walkTo(exitGoal(pl, 'out_pit_2_2'))).toEqual({ ok: true });
        expect(rt.playback.walkTo({ kind: 'exit', level: 48, tiles: [[1, 1]] }))
            .toEqual({ ok: false, reason: 'level 48 has no teleporter or pit on tile (1, 1)' });
    });

    it('a fall never completes a DOOR exit, and a door crossing never completes a PIT exit', () => {
        const run = { level: 1, world: { teleporters: [{ x: 16, y: 16 }], pitTiles: [{ tx: 3, ty: 3 }] }, state: { x: 0, y: 0 } };
        const solver = { enabled: true, keysFor: () => ({ held: new Set() }), clear() {}, cancel() {} };
        const walk = (tiles, crossings) => {
            const w = createRuntimeWalker({ solver, apItemOf: () => null, isCollected: () => false });
            w.setGoal({ kind: 'exit', level: 1, tiles });
            w.play();
            expect(w.heldFor(run)).toBeInstanceOf(Set);
            return crossings.map((c) => { w.observe({ crossing: { from: 1, to: 2, ...c } }); return w.state; });
        };
        expect(walk([[3, 3]], [{ type: 'teleporter' }, { type: 'pit' }])).toEqual([WALK_STATES.WALKING, WALK_STATES.DONE]);
        expect(walk([[1, 1]], [{ type: 'pit' }, { type: 'teleporter' }])).toEqual([WALK_STATES.WALKING, WALK_STATES.DONE]);
    });
});

describe('S4 — PIT exits solved from a LIVE mid-room state, played, and FALLEN through', () => {
    it('L48 (bare): reach-pit by a walk → L49', () => {
        const { rt, pl, reports } = arrive({ region: 'level_48__r2c10' });
        midRoomThenSolver(rt, exitGoal(pl, 'out_pit_2_2'), 5);
        expectSolvedFall(rt, reports, { from: 48, to: 49, verbs: ['walk'] });
    });

    it('L84 (bare): reach-pit by a walk → L85', () => {
        const { rt, pl, reports } = arrive({ region: 'level_84__r3c0' });
        midRoomThenSolver(rt, exitGoal(pl, 'out_pit_2_5'), 5);
        expectSolvedFall(rt, reports, { from: 84, to: 85, verbs: ['walk'] });
    });

    it('L30 (kit): the solver BREAKS the rock standing on the pit and falls → L31; the J2 walker alone stalls at the rock', () => {
        const { rt, pl, reports } = arrive({ region: 'level_30__r2c10', kit: true });
        midRoomThenSolver(rt, exitGoal(pl, 'out_pit_3_34'), 10);
        expectSolvedFall(rt, reports, { from: 30, to: 31, verbs: ['break'] });

        const off = arrive({ region: 'level_30__r2c10', kit: true });
        expect(off.rt.playback.walkTo(exitGoal(off.pl, 'out_pit_3_34'))).toEqual({ ok: true });
        off.rt.playback.play();
        settle(off.rt);
        expect(off.rt.playback.state).toBe(WALK_STATES.FAILED);
        expect(off.rt.playback.reason).toMatch(/not reached within 1800 ticks .* solid breakablerock at \(48,224\)/);
        expect(off.rt.playback.solverStats.solves).toBe(0);
    });

    it('setting OFF: the J2 walker walks a plain pit exit itself (L48), the fall completes it, nothing asks the solver', () => {
        const { rt, pl, reports } = arrive({ region: 'level_48__r2c10' });
        expect(rt.playback.walkTo(exitGoal(pl, 'out_pit_2_2'))).toEqual({ ok: true });
        rt.playback.play();
        const { crossings } = settle(rt);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(crossings).toEqual([{ from: 48, to: 49, type: 'pit' }]);
        expect(reports.filter(([p, v]) => p === 'pendingExit' && v)).toEqual([]);
        expect(rt.playback.solverStats).toMatchObject({ solves: 0, declines: 0, played: 0 });
        expect(rt.events.filter((e) => e.type === 'solver')).toEqual([]);
    });
});

describe('S4 — chests and pickups through collect-placement (beyond S1\'s L86)', () => {
    /** A location goal solved from a live mid-room state: one solve, the check reported once, no equip emitted. */
    const expectCollected = ({ region, level, tag, entityType, kit = false, walkTicks = 5, verbs }) => {
        const { rt, reports } = arrive({ region, kit });
        const primary0 = rt.run.primary;
        midRoomThenSolver(rt, { kind: 'location', level, tag, entityType }, walkTicks);
        settle(rt);
        const s = rt.playback.solverStats;
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(s).toMatchObject({ solves: 1, refutations: 0, declines: 0 });
        expect(s.lastSolve.goal.kind).toBe('collect-placement');
        expect(s.lastSolve.verbs).toEqual(expect.arrayContaining(verbs));
        expect(rt.events.filter((e) => e.type === 'check').map((e) => [e.level, e.tag])).toEqual([[level, tag]]);
        expect(reports.filter(([p, v]) => p === 'pendingCheck' && v).map(([, v]) => v.split('|').slice(1).join('|')))
            .toEqual([`${level}|${tag}|0`]);
        // EQUIPS: no in-scope solve selects a slot (the solver's only equip site is the deferred BobBoss burn).
        expect(rt.run.primary).toBe(primary0);
        expect(runDigest(replayShadow(rt.session, SRC))).toBe(runDigest(rt.run));
        expect(rt.halted).toBeNull();
    };

    it('L17 chest (bare)', () => expectCollected({ region: 'level_17', level: 17, tag: 0, entityType: 'chest', verbs: ['chest'] }));
    it('L109 Firewand (bare) — a pickup, the `collect` verb', () => expectCollected({
        region: 'level_109', level: 109, tag: 0, entityType: 'firewand', verbs: ['collect'] }));
    it('L11 chest (kit)', () => expectCollected({ region: 'level_11', level: 11, tag: 0, entityType: 'chest', kit: true, verbs: ['chest'] }));

    it('L12 chest behind the SHIELD LOCK (bare): the solver declines naming the `touch` and the shield; the walker walks', () => {
        const { rt } = arrive({ region: 'level_12__r0c19', at: { x: 16, y: 80 } });
        midRoomThenSolver(rt, { kind: 'location', level: 12, tag: 9, entityType: 'chest' }, 3);
        for (let t = 0; t < 5 && rt.playback.solverStats.declines === 0; t += 1) rt.tick();
        expect(rt.playback.state).toBe(WALK_STATES.WALKING);
        expect(rt.playback.reason).toMatch(/^the solver declined — solverBot\(.*\) chest \(320,816\) stance -> touch: shieldlocknorm@288,704 needs `Player.hasShield`.*; walking instead$/);
        expect(rt.playback.solverStats).toMatchObject({ solves: 0, declines: 1, played: 0 });
    });
});
