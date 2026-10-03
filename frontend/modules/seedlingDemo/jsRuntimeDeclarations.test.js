/**
 * jsRuntime — DECLARATIONS on the Seedling JS runtime (solver-walk S3; plan
 * `seedling-js-solver-walk-plan.md` §3 S3, ⚖ Q4).
 *
 * ⚖ Q4 (the user, 2026-10-02): vanilla rooms on the page boot with SCRATCH
 * persistence, so the page self-declares a kill lock's clear (the solver's own
 * setting) instead of halting by name (J3's decision 1, reversed). What that
 * has to mean, row by row:
 *
 *  · L5 (kill → lock opens → crossed): the solver's `kill` solves from a live
 *    mid-room state, the page plays it on its clock, the lock opens on the
 *    LIVE run at the tick the shadow opened it, and the page crosses — end
 *    digest identical to the shadow's.
 *  · The clear is REPORTED as the game reports it — `Lock.turnOff()` →
 *    `Game.setPersistence(tag, false)` (`Lock.as:96`) → `pendingCheck
 *    "<seq>|5|0|0"` — once, and the host's own check binding over its real
 *    tables turns it into NO location check (a kill lock is no location).
 *  · The clear is CARRIED: a re-boot in the room (an item flag) and a later
 *    visit find the lock gone, as the game's persistence array does.
 *  · With no solver at all (the walker, or nobody at the keys) the same room no
 *    longer HALTS: the census's terrain-death throw is the run's own clear now.
 *  · L8: the sandtrap under the arrowtrap is a GAME-sourced declaration (§11.4)
 *    — the JS page has no game oracle, so the solver DECLINES by name and the
 *    walker walks. (The plan's "L8 played" witness is overturned: S3 as-built.)
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 vanilla boots back on `scratchPersistence: !!mounted` (J3)
 *        -> 5 of 6 red (L5 declines "OPENS 1 kill lock"; the no-solver row HALTS)
 *   m2 the shadow replays without scratch (`scratchPersistence: false`)
 *        -> 3 red: the L5 solve, report and carry rows (the shadow diverges)
 *   m3 `liveClears` without `scratchClears`
 *        -> 3 red: the report, carry and no-solver rows (no pendingCheck for {5,0})
 *   m4 `bankClears` without `scratchClears`
 *        -> the carry row (the lock stands again on the next boot)
 *   m5 a game-sourced declaration declines with the raw solver message
 *        -> the L8 row and the unit row
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime, liveClears } from './jsRuntimeCore.js';
import { WALK_STATES } from './jsRuntimeWalker.js';
import { declarationRefusal, replayShadow, runDigest, settleSolve } from './jsRuntimeSolver.js';
import { PendingDeclaration } from './solverBot.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { tagOf } from './levelWorld.js';
import { ITEM_FOR_KEY, ITEM_FOR_TAG, VICTORY_ITEM } from './seedlingAtlasDerivation.js';
import { placementKey } from './apPlacementRewriter.js';
import { buildAtlasCheckTable, itemOfEntityFrom, propertyLocationOfFrom } from './seedlingAtlasCheckTable.js';
import { parsePendingCheck, SeedlingCheckBinding } from '../flashPanel/seedlingCheckBinding.js';
import { returnKey, returnSpawnTable } from '../flashPanel/seedlingReturnSpawns.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const ATLASES = 'frontend/modules/flashPanel/atlases/';
const MAP = readJson(`${ATLASES}seedling-map.json`);
const INDEX = readJson(`${ATLASES}atlas_files.json`);
const GAME = readJson('frontend/modules/flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties });
const SRC = levelSourceFromAtlas(indexLevels(MAP));
const RETURNS = returnSpawnTable(MAP);
const rulesOf = (id) => readJson(`frontend/presets/${id}/AP_1/AP_1_rules.json`);
const PLAYTHROUGH = rulesOf('seedling_playthrough');

const SETTLED = [WALK_STATES.DONE, WALK_STATES.FAILED];
const row = (run) => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
/** L5's kill lock: `lock@48,112`, slot {5,0} (the census's and the solver's own name). */
const KILL_LOCK = { level: 5, tag: 0 };
const lockStands = (run) => (run.world.activators ?? []).some((a) => a.id === 'lock@48,112');

/** A configured runtime over the vanilla map, every report captured. */
function vanillaRuntime() {
    const reports = [];
    const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
    expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
    rt.setVanilla(MAP);
    rt.tick();
    return { rt, reports };
}

/** Teleport into `region` arrived through `fromId`, walker goal `toId`, `walkTicks` walked. */
function midRoom({ region, fromId, toId, walkTicks }) {
    const pl = PLAYTHROUGH.preset_sidecars['1'][region].playable_payload;
    const from = pl.exits.find((e) => e.exit_id === fromId);
    const spawn = RETURNS.get(returnKey(pl.level, ...from.exit_tiles[0])) ?? from.entrance_spawn;
    const to = pl.exits.find((e) => e.exit_id === toId);
    const { rt, reports } = vanillaRuntime();
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [pl.level, spawn.x, spawn.y] }]);
    rt.tick();
    expect(rt.run.scratchPersistence).toBe(true);
    const goal = { kind: 'exit', level: pl.level, tiles: to.exit_tiles };
    expect(rt.playback.walkTo(goal)).toEqual({ ok: true });
    rt.playback.play();
    for (let t = 0; t < walkTicks; t += 1) rt.tick();
    expect(rt.run.level).toBe(pl.level);
    return { rt, reports, goal, spawn, level: pl.level };
}

function settle(rt, { maxTicks = 3000, each = () => {} } = {}) {
    const crossings = [];
    let t = 0;
    for (; t < maxTicks && !SETTLED.includes(rt.playback.state); t += 1) {
        const out = rt.tick();
        if (out.crossing) crossings.push(out.crossing);
        if (out.halted) break;
        each(t, out);
    }
    return { ticks: t, crossings };
}

const checksOf = (reports) => reports.filter(([p]) => p === 'pendingCheck')
    .map(([, v]) => parsePendingCheck(v)).filter(Boolean)
    .map(({ level, tag, cleared }) => ({ level, tag, cleared }));

/** The host's REAL atlas check table for a preset (the wiring's own construction, as J3's rows build it). */
function atlasTableOf(rules) {
    const atlasDoc = readJson(ATLASES + INDEX.atlases.find((a) => a.atlas_id === rules.region_atlas.atlas_id).file);
    const byName = new Map();
    for (const r of Object.values(rules.regions['1'])) for (const l of r.locations ?? []) byName.set(l.name, l.item);
    return buildAtlasCheckTable({
        rules, atlasDoc, mapDoc: MAP, selfPlayer: 1, placementKey, tagOf,
        locationItemOf: (n) => { const it = byName.get(n); return it ? { name: it.name, player: it.player } : null; },
        itemOfEntity: itemOfEntityFrom({ itemForTag: ITEM_FOR_TAG, itemForKey: ITEM_FOR_KEY, victoryItem: VICTORY_ITEM }),
        propertyLocationOf: propertyLocationOfFrom(GAME, ITEM_FOR_TAG),
    });
}

/** L5 from its north door, the solver on, 40 walker ticks in (bobs awake). Shared by the rows below. */
function l5Solved() {
    const m = midRoom({ region: 'level_5__r1c5', fromId: 'in_L4_64_16', toId: 'out_teleporter_48_112', walkTicks: 40 });
    const { rt } = m;
    expect(lockStands(rt.run)).toBe(true);
    rt.playback.setSolverWalk(true);
    const before = rt.run;
    let openedAt = null;
    const out = settle(rt, { each: () => { if (openedAt === null && rt.run === before && !lockStands(rt.run)) openedAt = rt.run.ticksCompleted; } });
    return { ...m, before, openedAt, ...out };
}

describe('jsRuntime S3 — scratch persistence on vanilla rooms (⚖ Q4)', () => {
    it('L5: the solver KILLS from a live mid-room state, the lock opens on the LIVE run, the page crosses — '
        + 'end digest identical to the shadow', () => {
        const { rt, before, openedAt, crossings } = l5Solved();
        const s = rt.playback.solverStats;
        expect(rt.halted).toBeNull();
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(s.solves).toBe(1);
        expect(s.refutations).toBe(0);
        // Fidelity F1/F1b/F1c (game-exact bodies, arrows newest-first): the first attempt's kill-lock DWELL for
        // bob@48,80 never sees the body enter arrowtrap@64,48's lane inside its 100-tick bound → ONE decline; the S2
        // retry solves and crosses, and the lock opens at the body's REMOVAL (F1b's ledger).
        expect(s.declines).toBe(1);
        expect(s.lastSolve.verbs).toEqual(expect.arrayContaining(['kill']));
        expect(s.played).toBe(s.lastSolve.keys);
        expect(crossings).toEqual([expect.objectContaining({ from: 5, to: 6 })]);
        // The clear landed on the live run (the model's own write, the scratch ledger)…
        expect(openedAt).not.toBeNull();
        const scratch = before.scratchClears;
        expect(scratch.map(({ level, tag }) => ({ level, tag }))).toEqual([KILL_LOCK]);
        // …on the tick the scratch row names (the pending row fires as `ticksCompleted + 1 >= at`).
        expect(openedAt).toBe(scratch[0].at);
        // End digest: the live run is where the solved shadow ended, and the page's
        // own tape (scratch, like the live run) replays to it.
        expect(row(rt.run)).toEqual(s.lastSolve.end);
        expect(rt.run).toBe(before);
        const shadow = replayShadow(rt.session, SRC);
        expect(shadow.scratchPersistence).toBe(true);
        expect(runDigest(shadow)).toBe(runDigest(rt.run));
        expect(shadow.scratchClears).toEqual(scratch);
    });

    it('the clear is reported ONCE as the game reports it ("<seq>|5|0|0"), and the host\'s check binding over '
        + 'its real tables makes NO location check of it', () => {
        const { rt, reports } = l5Solved();
        expect(liveClears(rt.run)).toEqual(expect.arrayContaining([KILL_LOCK]));
        const checks = checksOf(reports);
        expect(checks).toEqual([{ ...KILL_LOCK, cleared: true }]);
        for (const id of ['seedling_atlas', 'seedling_atlas_location', 'seedling_playthrough']) {
            const { table } = atlasTableOf(rulesOf(id));
            const binding = new SeedlingCheckBinding({ table, placementKey, selfPlayer: 1 });
            const out = reports.filter(([p]) => p === 'pendingCheck').flatMap(([p, v]) => binding.onStateReport(p, v) ?? []);
            expect({ id, out }).toEqual({ id, out: [] });
        }
        for (let i = 0; i < 30; i += 1) rt.tick();
        expect(checksOf(reports)).toHaveLength(1);
    });

    it('the clear is CARRIED: a re-boot in the room and a later visit find the lock gone, nothing re-reported', () => {
        // Kill, then stop in L5 (not cross): walk the solver plan until the lock opens.
        const m = midRoom({ region: 'level_5__r1c5', fromId: 'in_L4_64_16', toId: 'out_teleporter_48_112', walkTicks: 40 });
        const { rt, reports } = m;
        rt.playback.setSolverWalk(true);
        settle(rt, { maxTicks: 3000, each: () => {} });
        expect(rt.run.level).toBe(6);
        // Back into L5 through the same door: the next boot carries {5,0}.
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [5, m.spawn.x, m.spawn.y] }]);
        rt.tick();
        expect(rt.run.level).toBe(5);
        expect(rt.session.staging.persistence).toEqual(expect.arrayContaining([expect.objectContaining(KILL_LOCK)]));
        expect(lockStands(rt.run)).toBe(false);
        // An item flag re-boots the run in place: still gone.
        const runBefore = rt.run;
        rt.queueItems([{ class: 'Main', property: 'hasSword', value: true }]);
        rt.tick();
        rt.tick();
        expect(rt.run).not.toBe(runBefore);
        expect(lockStands(rt.run)).toBe(false);
        for (let i = 0; i < 20; i += 1) rt.tick();
        expect(checksOf(reports)).toEqual([{ ...KILL_LOCK, cleared: true }]);
        expect(rt.halted).toBeNull();
    });

    it('with NO solver, the census\'s L5 throw is gone: a bob\'s terrain death opens the lock, the page does not HALT', () => {
        // The census's own arrival (the playthrough's top-left `target_spawn` into level 5)
        // and nobody at the keys — at bff2f9241e it threw at tick 196 (R2: the removal tick).
        const spawn = { x: 16, y: 16 };
        const { rt, reports } = vanillaRuntime();
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [5, spawn.x, spawn.y] }]);
        rt.tick();
        let opened = false;
        for (let t = 0; t < 600 && !rt.halted; t += 1) {
            rt.tick();
            if (!lockStands(rt.run)) { opened = true; break; }
        }
        expect(rt.halted).toBeNull();
        expect(opened).toBe(true);
        expect(rt.run.scratchClears.map((c) => c.cause)).toEqual(['a terrain death']);
        rt.tick();
        expect(checksOf(reports)).toEqual([{ ...KILL_LOCK, cleared: true }]);
    });
});

describe('jsRuntime S3 — a GAME-sourced declaration declines by name (L8\'s sandtrap)', () => {
    it('L8: the solver\'s PendingDeclaration (source game) → declined NAMING the missing oracle; the walker walks', () => {
        const { rt } = midRoom({ region: 'level_8', fromId: 'in_L7_192_32', toId: 'out_teleporter_96_192', walkTicks: 0 });
        rt.playback.setSolverWalk(true);
        for (let t = 0; t < 30 && rt.playback.solverStats.declines === 0; t += 1) rt.tick();
        const s = rt.playback.solverStats;
        expect(s.declines).toBe(1);
        expect(s.lastDecline).toMatch(/GAME-sourced declaration \{8,\d+\} \(sandtrap@96,80\)/);
        expect(s.lastDecline).toMatch(/no game oracle/);
        expect(rt.playback.reason).toMatch(/the solver declined — the goal waits on a GAME-sourced declaration/);
        expect(rt.playback.state).toBe(WALK_STATES.WALKING);
        expect(rt.halted).toBeNull();
    });

    it('declarationRefusal / settleSolve: game → the oracle named; model → named as the scratch defect it is', () => {
        const game = new PendingDeclaration('x', { pending: { level: 8, tag: 3, source: 'game', body: 'sandtrap@96,80' } });
        const r = settleSolve(() => { throw game; });
        expect(r).toMatchObject({ ok: false, kind: 'refusal', declaration: { level: 8, tag: 3, source: 'game' } });
        expect(r.message).toBe(declarationRefusal(game.pending));
        expect(r.message).toMatch(/^the goal waits on a GAME-sourced declaration \{8,3\} \(sandtrap@96,80\)/);
        const model = new PendingDeclaration('kill lock arming\nmore', { pending: { level: 5, tag: 0, source: 'model', lock: 'lock@48,112' } });
        expect(settleSolve(() => { throw model; }).message)
            .toMatch(/model-sourced declaration \{5,0\} \(lock@48,112\) on a scratch run, which should have written that clear itself — kill lock arming$/);
    });
});
