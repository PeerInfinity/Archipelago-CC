/**
 * seedlingPlaybackController — the Playback Bot's controller for generated
 * Seedling rooms (Seedling JS J2): name → cell maps off the assembly report,
 * the runtime refusal, the held goal, and a walk end to end in node through a
 * real JS runtime core.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    notJsRuntimeRefusal, PENDING_GIVE_UP_MS, resolveSeedlingAtlasGoal, resolveSeedlingGoal,
    SEEDLING_ATLAS_PLAYBACK_SUBSTRATE, SeedlingPlaybackController,
} from './seedlingPlaybackController.js';
import { substrateRegistryEntry as genEntry, SEEDLING_PLAYBACK_SCOPE } from './flashSeedlingGenLibrary.js';
import { substrateRegistryEntry as atlasEntry, SEEDLING_ATLAS_PLAYBACK_SCOPE } from './flashSeedlingLibrary.js';
import { parsePendingCheck } from './seedlingCheckBinding.js';
import { parsePendingExit } from './seedlingRegionBinding.js';
import { createJsRuntime } from '../seedlingDemo/jsRuntimeCore.js';
import { createInPlaceSolveService, SOLVER_BUDGET_WORK } from '../seedlingDemo/jsRuntimeSolver.js';
import { assembleGeneratedSeedlingSet } from '../seedlingDemo/seedlingGeneratedSet.js';
import { planLevelSetChunks } from '../seedlingDemo/levelSetValidator.js';
import { CAPABILITY_STATEMENTS, CELL_KINDS } from '../procgenCore/substrateCapabilities.js';

/** ⛓ DETERMINISTIC BUDGET — the walker's status while a solve is in flight names the WORK budget. */
const SOLVING_NOTE = `solving… (budget ${SOLVER_BUDGET_WORK} work units)`;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const GAME_CONFIG = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const RULES = JSON.parse(readFileSync(
    join(ROOT, 'frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json'), 'utf8'));
const { report, set } = assembleGeneratedSeedlingSet(RULES, { selfPlayer: 1 });

function liveRuntime() {
    const reports = [];
    const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
    rt.game.configure(JSON.stringify({ classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties }));
    for (const c of planLevelSetChunks(set).chunks) rt.game.botLoadLevels(JSON.stringify(c));
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [set.start.level, set.start.x, set.start.y] }]);
    rt.tick();
    reports.length = 0;
    return { rt, reports };
}

function fakeTimers() {
    let fn = null;
    let t = 0;
    return {
        timers: { setInterval: (f) => { fn = f; return 1; }, clearInterval: () => { fn = null; } },
        now: () => t,
        fire: (advanceMs = 250) => { t += advanceMs; fn?.(); },
        get armed() { return fn !== null; },
    };
}

describe('resolveSeedlingGoal — AP names → the generated set\'s cells', () => {
    it('a location resolves to its room and apitem tag', () => {
        expect(resolveSeedlingGoal({ kind: 'location', name: 'region_0_0__key_blue_pickup' }, report))
            .toEqual({ goal: { kind: 'location', level: 0, tag: 0, name: 'region_0_0__key_blue_pickup' } });
    });

    it('an exit resolves in BOTH spellings: prefixed anywhere, bare against the live room (or the region)', () => {
        const want = { kind: 'exit', level: 1, tile: [6, 3] };
        expect(resolveSeedlingGoal({ kind: 'exit', name: 'region_0_1__exit_1' }, report).goal).toMatchObject(want);
        expect(resolveSeedlingGoal({ kind: 'exit', name: 'exit_1' }, report, { liveLevel: 1 }).goal).toMatchObject(want);
        expect(resolveSeedlingGoal({ kind: 'exit', name: 'exit_1' }, report, { region: 'region_0_1' }).goal).toMatchObject(want);
        // ⛔ The bare name is ambiguous across rooms: the LIVE level decides it.
        expect(resolveSeedlingGoal({ kind: 'exit', name: 'exit_1' }, report, { liveLevel: 0 }).goal)
            .toMatchObject({ level: 0, tile: [8, 8] });
    });

    it('refuses by name what the report does not hold', () => {
        expect(resolveSeedlingGoal({ kind: 'location', name: 'Nowhere' }, report))
            .toEqual({ refused: '"Nowhere" is not an AP location of the generated Seedling rooms' });
        expect(resolveSeedlingGoal({ kind: 'exit', name: 'exit_9' }, report, { liveLevel: 0 }).refused)
            .toBe('"exit_9" is not an exit of the generated room the player is in (level 0)');
    });
});

describe('SeedlingPlaybackController — the contract', () => {
    it('⛔ under the wasm runtime walkTo is FALSE and names why (never a silent wait)', () => {
        const c = new SeedlingPlaybackController({ getSurface: () => ({ transport: 'wasm', setting: 'auto', report, jsRuntime: null }) });
        expect(c.walkTo({ kind: 'location', name: 'region_0_0__key_blue_pickup' })).toBe(false);
        expect(c.lastRefusal).toBe(notJsRuntimeRefusal('wasm', 'auto'));
        expect(c.lastRefusal).toMatch(/only on the Seedling JS runtime — the Flash Panel is running the wasm runtime/);
    });

    it('a name the rooms do not hold is FALSE, with the resolver\'s reason', () => {
        const { rt } = liveRuntime();
        const c = new SeedlingPlaybackController({ getSurface: () => ({ transport: 'js', report, jsRuntime: rt }) });
        expect(c.walkTo({ kind: 'location', name: 'Nowhere' })).toBe(false);
        expect(c.lastRefusal).toMatch(/is not an AP location of the generated Seedling rooms/);
    });

    it('a target that outruns the page is HELD, then handed over once the page and the report are up', () => {
        const { rt } = liveRuntime();
        let surface = null;
        const ft = fakeTimers();
        const c = new SeedlingPlaybackController({ getSurface: () => surface, timers: ft.timers, now: ft.now });
        expect(c.walkTo({ kind: 'location', name: 'region_0_0__key_blue_pickup' })).toBe(true);
        c.play();
        expect(ft.armed).toBe(true);
        ft.fire();
        expect(ft.armed).toBe(true);
        surface = { transport: 'js', report: null, jsRuntime: rt };   // page up, AP load not done
        ft.fire();
        expect(rt.playback.goal).toBeNull();
        surface = { transport: 'js', report, jsRuntime: rt };
        ft.fire();
        expect(ft.armed).toBe(false);
        expect(rt.playback.goal).toMatchObject({ kind: 'location', level: 0, tag: 0 });
        expect(rt.playback.playing).toBe(true);
    });

    it('⛔ a held target that fails LATER is not silent: onWalkFailed names it (never handed over / wasm / bad name)', () => {
        const failed = [];
        const target = { kind: 'location', name: 'region_0_0__key_blue_pickup' };
        let surface = null;
        const ft = fakeTimers();
        const c = new SeedlingPlaybackController({
            getSurface: () => surface, timers: ft.timers, now: ft.now, onWalkFailed: (e) => failed.push(e),
        });
        c.walkTo(target);
        ft.fire(PENDING_GIVE_UP_MS + 1);
        expect(ft.armed).toBe(false);
        expect(failed).toEqual([{ substrate: 'flash_seedling_gen', target,
            reason: 'the walkTo was never handed to the JS runtime — no flash panel within 60 s' }]);

        c.walkTo(target);
        surface = { transport: 'wasm', setting: 'wasm', report, jsRuntime: null };
        ft.fire();
        expect(failed[1]).toEqual({ substrate: 'flash_seedling_gen', target, reason: notJsRuntimeRefusal('wasm', 'wasm') });

        const { rt } = liveRuntime();
        surface = null;
        c.walkTo({ kind: 'location', name: 'Nowhere' });
        surface = { transport: 'js', report, jsRuntime: rt };
        ft.fire();
        expect(failed[2].reason).toMatch(/"Nowhere" is not an AP location/);
    });

    it('a live walk the PAGE gives up on is relayed through onWalkFailed', () => {
        const failed = [];
        const { rt } = liveRuntime();
        const c = new SeedlingPlaybackController({
            getSurface: () => ({ transport: 'js', report, jsRuntime: rt }), onWalkFailed: (e) => failed.push(e),
        });
        expect(c.walkTo({ kind: 'location', name: 'region_0_0__key_blue_pickup' })).toBe(true);
        // The apitem vanishes from the mounted set under the walker (a stand-in for any live refusal).
        rt.mounted.apItems.set(0, []);
        c.play();
        rt.tick(new Set());
        expect(failed).toHaveLength(1);
        expect(failed[0].reason).toMatch(/^the JS runtime's walk failed: level 0 has no apitem with tag 0/);
    });

    it('walks end to end in node: the check, then the door, as the host reads them', () => {
        const { rt, reports } = liveRuntime();
        const c = new SeedlingPlaybackController({ getSurface: () => ({ transport: 'js', report, jsRuntime: rt }) });
        const tickUntil = (pred, max = 3000) => { for (let i = 0; i < max && !pred(); i += 1) rt.tick(new Set()); };
        expect(c.walkTo({ kind: 'location', name: 'region_0_0__key_blue_pickup' })).toBe(true);
        c.play();
        tickUntil(() => reports.some(([p]) => p === 'pendingCheck'));
        expect(parsePendingCheck(reports.find(([p]) => p === 'pendingCheck')[1])).toMatchObject({ level: 0, tag: 0 });
        expect(c.walkTo({ kind: 'exit', name: 'region_0_0__exit_0' })).toBe(true);
        tickUntil(() => reports.some(([p]) => p === 'pendingExit'));
        expect(parsePendingExit(reports.find(([p]) => p === 'pendingExit')[1])).toMatchObject({ fromLevel: 0, to: 1 });
        expect(c.status()).toMatchObject({ state: 'done' });
        c.stop();
        expect(rt.playback.playing).toBe(false);
    });
});

describe('the registry entry and the chart', () => {
    it('both Seedling entries declare the controller and the SAME scope (J2 generated, J3 atlas)', () => {
        expect(typeof genEntry.getPlaybackController).toBe('function');
        expect(genEntry.playbackScope).toBe(SEEDLING_PLAYBACK_SCOPE);
        expect(typeof atlasEntry.getPlaybackController).toBe('function');
        expect(atlasEntry.playbackScope).toBe(SEEDLING_ATLAS_PLAYBACK_SCOPE);
        // ⛓ W2 — the atlas rooms also walk on wasm; ⛓ WG — and so do the generated rooms.
        expect(SEEDLING_PLAYBACK_SCOPE).toBe("with the Flash Panel's JS runtime, or its wasm runtime");
        expect(SEEDLING_ATLAS_PLAYBACK_SCOPE).toBe("with the Flash Panel's JS runtime, or its wasm runtime");
    });

    it('P2 reads ◐ — "JS runtime, or its wasm runtime" for flash_seedling (W2) and flash_seedling_gen (WG)', () => {
        const p2 = CAPABILITY_STATEMENTS.find((s) => s.id === 'P2');
        expect(p2.answer(genEntry)).toEqual({ kind: CELL_KINDS.PARTIAL, text: SEEDLING_PLAYBACK_SCOPE });
        expect(p2.answer(atlasEntry)).toEqual({ kind: CELL_KINDS.PARTIAL, text: SEEDLING_ATLAS_PLAYBACK_SCOPE });
        expect(p2.answer({ getPlaybackController: () => null }).kind).toBe(CELL_KINDS.YES);
    });
});

// ── Seedling JS J3: the atlas rooms (`flash_seedling`) ───────────────────────

const ATLAS_RULES = JSON.parse(readFileSync(
    join(ROOT, 'frontend/presets/seedling_atlas_location/AP_1/AP_1_rules.json'), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const HOUSE = ATLAS_RULES.preset_sidecars['1'].region_2_2.playable_payload;
/** The panel's `surface.atlas` for this preset: the bound entry the atlas arm builds, and the sidecars. */
const ATLAS_MAP = {
    entries: [{ location: 'Starting House - Chest', level: 86, tag: 0, entityType: 'chest' }],
    refused: [{ location: 'Somewhere - Sword', region: 'r', why: 'the property path reports it too' }],
    regions: new Map([['region_2_2', HOUSE]]),
};

describe('SeedlingPlaybackController — the atlas rooms (J3)', () => {
    it('resolves a bound location to its (level, tag, entity) and an exit to its exit_tiles', () => {
        expect(resolveSeedlingAtlasGoal({ kind: 'location', name: 'Starting House - Chest' }, ATLAS_MAP)).toEqual({
            goal: { kind: 'location', level: 86, tag: 0, entityType: 'chest', name: 'Starting House - Chest' } });
        expect(resolveSeedlingAtlasGoal({ kind: 'exit', name: 'exit_S' }, ATLAS_MAP, { region: 'region_2_2' })).toEqual({
            goal: { kind: 'exit', level: 86, tiles: [[3, 4]], name: 'exit_S' } });
        expect(resolveSeedlingAtlasGoal({ kind: 'exit', name: 'door' }, ATLAS_MAP).goal?.tiles).toEqual([[3, 4]]);
    });

    it('refuses BY NAME: a location the atlas arm refused (with its reason), an unknown one, an unknown exit', () => {
        expect(resolveSeedlingAtlasGoal({ kind: 'location', name: 'Somewhere - Sword' }, ATLAS_MAP).refused)
            .toBe("\"Somewhere - Sword\" is a location the atlas arm's map did NOT bind — the property path reports it too");
        expect(resolveSeedlingAtlasGoal({ kind: 'location', name: 'nope' }, ATLAS_MAP).refused)
            .toBe('"nope" is not a bound AP location of the atlas rooms');
        expect(resolveSeedlingAtlasGoal({ kind: 'exit', name: 'nope' }, ATLAS_MAP).refused)
            .toBe('"nope" is not an exit of the atlas rooms');
    });

    it('under wasm the atlas controller refuses by name, naming ITS substrate and rooms', () => {
        const c = new SeedlingPlaybackController({ getSurface: () => ({ transport: 'wasm', setting: 'auto' }),
            substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE, resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas });
        expect(c.walkTo({ kind: 'location', name: 'Starting House - Chest' })).toBe(false);
        expect(c.lastRefusal).toBe(notJsRuntimeRefusal('wasm', 'auto', 'flash_seedling'));
        expect(c.lastRefusal).toMatch(/^flash_seedling regions are walked only on the Seedling JS runtime .* walk atlas rooms$/);
    });

    it('walks end to end in node on the vanilla map: the chest check, then the house door, as the host reads them', () => {
        const reports = [];
        const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
        rt.game.configure(JSON.stringify({ classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties }));
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [86, 48, 48] }]);
        rt.tick();
        reports.length = 0;
        const c = new SeedlingPlaybackController({
            getSurface: () => ({ transport: 'js', atlas: ATLAS_MAP, jsRuntime: rt, region: 'region_2_2' }),
            substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE, resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas,
        });
        const tickUntil = (pred, max = 3000) => { for (let i = 0; i < max && !pred(); i += 1) rt.tick(new Set()); };
        expect(c.walkTo({ kind: 'location', name: 'Starting House - Chest' })).toBe(true);
        c.play();
        tickUntil(() => reports.some(([p]) => p === 'pendingCheck'));
        expect(parsePendingCheck(reports.find(([p]) => p === 'pendingCheck')[1])).toMatchObject({ level: 86, tag: 0, cleared: true });
        tickUntil(() => c.status().state === 'done');
        expect(c.walkTo({ kind: 'exit', name: 'exit_S' })).toBe(true);
        tickUntil(() => reports.some(([p]) => p === 'pendingExit'));
        expect(parsePendingExit(reports.find(([p]) => p === 'pendingExit')[1]))
            .toMatchObject({ fromLevel: 86, type: 'teleporter', x: 48, y: 64, to: 0 });
        expect(c.status()).toMatchObject({ state: 'done' });
    });
});

describe('SeedlingPlaybackController — the solver mode (solver-walk S1)', () => {
    const vanillaAt86 = () => {
        const reports = [];
        const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
        rt.game.configure(JSON.stringify({ classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties }));
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [86, 48, 48] }]);
        rt.tick();
        reports.length = 0;
        return { rt, reports };
    };
    const controllerOn = (rt, surface) => new SeedlingPlaybackController({
        getSurface: () => ({ transport: 'js', atlas: ATLAS_MAP, jsRuntime: rt, region: 'region_2_2', ...surface() }),
        substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE, resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas,
    });

    it('the surface\'s solverWalk travels with every goal: on → the page solves; off (or absent) → the page walks', () => {
        const { rt } = vanillaAt86();
        let solverWalk = true;
        const c = controllerOn(rt, () => ({ solverWalk }));
        expect(c.walkTo({ kind: 'location', name: 'Starting House - Chest' })).toBe(true);
        expect(rt.playback.solverWalk).toBe(true);
        solverWalk = false;
        expect(c.walkTo({ kind: 'location', name: 'Starting House - Chest' })).toBe(true);
        expect(rt.playback.solverWalk).toBe(false);
        const absent = new SeedlingPlaybackController({
            getSurface: () => ({ transport: 'js', atlas: ATLAS_MAP, jsRuntime: rt, region: 'region_2_2' }),
            substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE, resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas,
        });
        rt.playback.setSolverWalk(true);
        expect(absent.walkTo({ kind: 'location', name: 'Starting House - Chest' })).toBe(true);
        expect(rt.playback.solverWalk).toBe(false);
    });

    it('end to end with the solver: the chest check, then the house door by `instant` — one page tick plays the plan', () => {
        const { rt, reports } = vanillaAt86();
        const c = controllerOn(rt, () => ({ solverWalk: true }));
        const tickUntil = (pred, max = 3000) => { for (let i = 0; i < max && !pred(); i += 1) rt.tick(new Set()); };
        expect(c.walkTo({ kind: 'location', name: 'Starting House - Chest' })).toBe(true);
        c.play();
        tickUntil(() => c.status().state === 'done');
        expect(parsePendingCheck(reports.find(([p]) => p === 'pendingCheck')[1])).toMatchObject({ level: 86, tag: 0, cleared: true });
        expect(rt.playback.solverStats.lastSolve.verbs).toContain('chest');
        tickUntil(() => !rt.run.inCeremony);
        c.instant();
        expect(c.walkTo({ kind: 'exit', name: 'exit_S' })).toBe(true);
        const out = rt.tick(new Set());
        expect(out.burst).toBeGreaterThan(0);
        expect(parsePendingExit(reports.find(([p]) => p === 'pendingExit')[1]))
            .toMatchObject({ fromLevel: 86, type: 'teleporter', x: 48, y: 64, to: 0 });
        expect(c.status()).toMatchObject({ state: 'done' });
        expect(rt.playback.solverStats).toMatchObject({ solves: 2, refutations: 0, declines: 0 });
    });

    it('⛓ S2 — a solve in flight: the page HOLDS, "solving…" reaches onWalkNote, and the note clears when the plan plays', () => {
        const { rt } = vanillaAt86();
        // A solve service that answers only when told (the worker's shape, in place).
        const inPlace = createInPlaceSolveService();
        let release = null;
        rt.playback.setSolveService({
            kind: 'deferred', warm() {}, dispose() {},
            start(request) {
                const h = { settled: false, started: true, result: null, cancel() {} };
                release = () => { const done = inPlace.start(request); h.result = done.result; h.settled = true; };
                return h;
            },
        });
        const notes = [];
        const c = new SeedlingPlaybackController({
            getSurface: () => ({ transport: 'js', atlas: ATLAS_MAP, jsRuntime: rt, region: 'region_2_2', solverWalk: true }),
            substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE, resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas,
            onWalkNote: (e) => notes.push(e),
        });
        expect(c.walkTo({ kind: 'location', name: 'Starting House - Chest' })).toBe(true);
        c.play();
        const ticks = rt.run.ticksCompleted;
        expect(rt.tick(new Set())).toEqual({ stepped: false, solving: true });
        expect(rt.tick(new Set())).toEqual({ stepped: false, solving: true });
        expect(rt.run.ticksCompleted).toBe(ticks);
        expect(notes).toEqual([{ substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE, target: { kind: 'location', name: 'Starting House - Chest' },
            note: SOLVING_NOTE }]);
        expect(c.lastNote).toBe(SOLVING_NOTE);
        release();
        expect(rt.tick(new Set()).stepped).toBe(true);
        expect(rt.run.ticksCompleted).toBe(ticks + 1);
        expect(notes.map((n) => n.note)).toEqual([SOLVING_NOTE, null]);
        expect(c.lastNote).toBeNull();
    });
});

describe('⛓ W2 — the atlas instance walks under the WASM runtime (the engine is injected)', () => {
    const fakeEngine = () => {
        const e = { goals: [], stops: 0, live: HOUSE, answer: { ok: true, action: 'force-re-arrival' } };
        return Object.assign(e, {
            walkTo(g) { e.goals.push(g); return e.answer; },
            stop() { e.stops += 1; },
            liveLevel() { return e.live; },
            status() { return { phase: 'idle', goal: null }; },
            dispose() {},
        });
    };
    const game = { botStatus() {} };
    const wasmSurface = (extra = {}) => ({ transport: 'wasm', setting: 'auto', atlas: ATLAS_MAP, region: 'region_2_2',
        wasm: { getGame: () => game, getWin: () => null, teleport: () => true, mapPath: 'm.json' }, ...extra });
    const flush = () => new Promise((r) => { setTimeout(r, 0); });

    it('a wasm walkTo is HELD while the engine loads, then handed to it with the resolved goal', async () => {
        const ft = fakeTimers();
        const engine = fakeEngine();
        const loads = [];
        const c = new SeedlingPlaybackController({ getSurface: () => wasmSurface(), substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE,
            resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas, wasm: true, timers: ft.timers, now: ft.now,
            loadWasmEngine: async (deps) => { loads.push(deps); return engine; } });
        expect(c.walkTo({ kind: 'location', name: 'Starting House - Chest' })).toBe(true);
        expect(c.lastRefusal).toBeNull();
        expect(engine.goals).toEqual([]);
        await flush();
        expect(loads).toHaveLength(1);
        expect(loads[0].mapPath).toBe('m.json');
        ft.fire();
        expect(engine.goals).toEqual([{ kind: 'location', level: 86, tag: 0, entityType: 'chest', name: 'Starting House - Chest' }]);
        expect(ft.armed).toBe(false);
        // A second goal goes straight to the same engine.
        expect(c.walkTo({ kind: 'exit', name: 'exit_S' })).toBe(true);
        expect(engine.goals.at(-1)).toEqual({ kind: 'exit', level: 86, tiles: [[3, 4]], name: 'exit_S' });
        c.stop();
        expect(engine.stops).toBe(1);
    });

    it('the engine\'s synchronous refusal is FALSE with its reason; its late failure and notes are relayed', async () => {
        const engine = fakeEngine();
        const failed = [];
        const notes = [];
        let deps = null;
        const c = new SeedlingPlaybackController({ getSurface: () => wasmSurface(), substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE,
            resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas, wasm: true, timers: fakeTimers().timers,
            onWalkFailed: (e) => failed.push(e), onWalkNote: (e) => notes.push(e.note),
            loadWasmEngine: async (d) => { deps = d; return engine; } });
        c.walkTo({ kind: 'location', name: 'Starting House - Chest' });
        await flush();
        engine.answer = { ok: false, reason: 'level 86 holds a moonrock' };
        expect(c.walkTo({ kind: 'location', name: 'Starting House - Chest' })).toBe(false);
        expect(c.lastRefusal).toMatch(/the wasm runtime refused .* level 86 holds a moonrock/);
        deps.onNote('solving… (budget 5 s)');
        deps.onFailed('the solver declined');
        expect(notes).toEqual(['solving… (budget 5 s)']);
        expect(failed.at(-1).reason).toBe('the wasm playback failed: the solver declined');
    });

    it('a failed engine load reaches the bot as a named failure, never a silent wait', async () => {
        const ft = fakeTimers();
        const failed = [];
        const c = new SeedlingPlaybackController({ getSurface: () => wasmSurface(), substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE,
            resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas, wasm: true, timers: ft.timers, now: ft.now,
            onWalkFailed: (e) => failed.push(e), loadWasmEngine: async () => { throw new Error('404 m.json'); } });
        expect(c.walkTo({ kind: 'location', name: 'Starting House - Chest' })).toBe(true);
        await flush();
        ft.fire();
        expect(failed[0].reason).toBe('the wasm playback engine did not load: 404 m.json');
    });

    it('an instance built WITHOUT `wasm` keeps its refusal under wasm (the J2 default)', () => {
        const gen = new SeedlingPlaybackController({ getSurface: () => wasmSurface({ report }),
            loadWasmEngine: async () => { throw new Error('never'); } });
        expect(gen.walkTo({ kind: 'exit', name: 'exit_0' })).toBe(false);
        expect(gen.lastRefusal).toBe(notJsRuntimeRefusal('wasm', 'auto'));
    });
});

describe('⛓ WG — the GENERATED instance walks under the WASM runtime (the mounted set; the engine is injected)', () => {
    const fakeEngine = () => {
        const e = { goals: [], stops: 0, disposed: 0, live: 0, answer: { ok: true, action: 'force-re-arrival' } };
        return Object.assign(e, {
            walkTo(g) { e.goals.push(g); return e.answer; },
            stop() { e.stops += 1; },
            liveLevel() { return e.live; },
            status() { return { phase: 'idle', goal: null }; },
            dispose() { e.disposed += 1; },
        });
    };
    const game = { botStatus() {} };
    const surface = (levelSet, extra = {}) => ({ transport: 'wasm', setting: 'wasm', report, region: 'region_0_0',
        wasm: { getGame: () => game, getWin: () => null, teleport: () => true, mapPath: null, levelSet }, ...extra });
    const flush = () => new Promise((r) => { setTimeout(r, 0); });
    const genController = (getSurface, more = {}) => new SeedlingPlaybackController({ getSurface, wasm: true,
        wasmLevelSetOf: (s) => s?.wasm?.levelSet ?? null, ...more });

    it('a location goal is HELD while the engine loads FROM THE DELIVERED SET, then handed over resolved', async () => {
        const ft = fakeTimers();
        const engine = fakeEngine();
        const loads = [];
        const c = genController(() => surface(set), { timers: ft.timers, now: ft.now,
            loadWasmEngine: async (deps) => { loads.push(deps); return engine; } });
        expect(c.walkTo({ kind: 'location', name: 'region_0_0__key_blue_pickup' })).toBe(true);
        await flush();
        expect(loads).toHaveLength(1);
        expect(loads[0].levelSet).toBe(set);
        ft.fire();
        expect(engine.goals).toEqual([{ kind: 'location', level: 0, tag: 0, name: 'region_0_0__key_blue_pickup' }]);
        expect(c.walkTo({ kind: 'exit', name: 'exit_0' })).toBe(true);
        expect(engine.goals.at(-1)).toEqual({ kind: 'exit', level: 0, tile: [8, 1], name: 'exit_0' });
    });

    it('no delivered set yet (the AP load) → HELD, and no engine is loaded until it arrives', async () => {
        const ft = fakeTimers();
        let current = null;
        const loads = [];
        const c = genController(() => surface(current), { timers: ft.timers, now: ft.now,
            loadWasmEngine: async (deps) => { loads.push(deps); return fakeEngine(); } });
        expect(c.walkTo({ kind: 'location', name: 'region_0_0__key_blue_pickup' })).toBe(true);
        await flush();
        ft.fire();
        expect(loads).toEqual([]);
        current = set;
        ft.fire();
        await flush();
        expect(loads).toHaveLength(1);
    });

    it('a TILE target is refused synchronously, by name, before anything loads (no producer serves it)', () => {
        const loads = [];
        const c = genController(() => surface(set), { loadWasmEngine: async (d) => { loads.push(d); return fakeEngine(); } });
        expect(c.walkTo({ kind: 'tile', x: 3, y: 3 })).toBe(false);
        expect(c.lastRefusal).toBe('a tile target is not walked in the generated rooms on the wasm runtime — their tapes '
            + 'come from the walker producer, which serves a location or an exit');
        expect(loads).toEqual([]);
    });

    it('a NEW delivered set (a new object) is a new engine; the old one is disposed', async () => {
        const ft = fakeTimers();
        const engines = [];
        let current = set;
        const c = genController(() => surface(current), { timers: ft.timers, now: ft.now,
            loadWasmEngine: async () => { const e = fakeEngine(); engines.push(e); return e; } });
        c.walkTo({ kind: 'location', name: 'region_0_0__key_blue_pickup' });
        await flush();
        ft.fire();
        current = { ...set };
        c.walkTo({ kind: 'location', name: 'region_0_0__key_blue_pickup' });
        await flush();
        ft.fire();
        expect(engines).toHaveLength(2);
        expect(engines[0].disposed).toBe(1);
        expect(engines[1].goals).toHaveLength(1);
    });

    it('under a runtime it does not walk (flash), the refusal names BOTH runtimes it does', () => {
        const c = genController(() => surface(set, { transport: 'flash', setting: 'flash' }));
        expect(c.walkTo({ kind: 'location', name: 'region_0_0__key_blue_pickup' })).toBe(false);
        expect(c.lastRefusal).toBe(notJsRuntimeRefusal('flash', 'flash', 'flash_seedling_gen', true));
        expect(c.lastRefusal).toMatch(/only on the Seedling JS or wasm runtime .* set Flash Panel → Runtime to 'js' or 'wasm'/);
    });
});

/**
 * ⛓ WAVE-6 CONSUMER — a failure that carries the solver's `obstacle` (wasm: the engine's `onFailed` extra; JS: the
 * page walker's FAILED event) reaches the bot WITH it, and an `arrival-inside-solid` also with its `escape` (the
 * `wayOut` in AP terms, read off this instance's map `regions`). A failure without one is unchanged.
 */
describe('⛓ WAVE-6 CONSUMER — an arrival inside a solid reaches the bot with its way out', () => {
    // a level-2 region whose stairs@48,16 lands in level 0 (the playthrough's `out_stairsup_48_16`)
    const L2 = { level: 2, exits: [{ exit_id: 'out_stairsup_48_16', exitName: 'level_2 -> level_0__r8c0',
        targetRegion: 'level_0__r8c0', target_level: 0 }] };
    const MAP = { ...ATLAS_MAP, regions: new Map([['region_2_2', HOUSE], ['level_2', L2]]) };
    const OBSTACLE = { kind: 'arrival-inside-solid', id: 'breakablerock@288,176', solids: ['breakablerock@288,176'],
        at: { level: 0, x: 296, y: 184 }, wayOut: [{ kind: 'restart', via: 'seedlingStartSpawn', why: 'w' },
            { kind: 'another-route', level: 0, arrivals: [{ from: 2, door: 'stairs@48,16', at: { x: 264, y: 264 } },
                { from: 77, door: 'teleporter@1,1', at: { x: 1, y: 1 } }] }] };
    const ESCAPE = { kind: 'arrival-inside-solid', solids: ['breakablerock@288,176'], at: { level: 0, x: 296, y: 184 },
        restart: true, arrivals: [{ region: 'level_2', exit: 'level_2 -> level_0__r8c0', landing: 'level_0__r8c0', from: 2,
            door: 'stairs@48,16' }], unmapped: ['L77 teleporter@1,1'] };
    const flush = () => new Promise((r) => { setTimeout(r, 0); });

    it('wasm: the engine\'s failure extra → `obstacle` + `escape` on onWalkFailed (and `lastObstacle`)', async () => {
        const failed = [];
        let deps = null;
        const game = { botStatus() {} };
        const surface = { transport: 'wasm', setting: 'auto', atlas: MAP, region: 'region_2_2',
            wasm: { getGame: () => game, getWin: () => null, teleport: () => true, mapPath: 'm.json' } };
        const engine = { walkTo: () => ({ ok: true }), stop() {}, liveLevel: () => 86, status: () => ({ phase: 'idle' }), dispose() {} };
        const c = new SeedlingPlaybackController({ getSurface: () => surface, substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE,
            resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas, wasm: true, timers: fakeTimers().timers,
            onWalkFailed: (e) => failed.push(e), loadWasmEngine: async (d) => { deps = d; return engine; } });
        c.walkTo({ kind: 'location', name: 'Starting House - Chest' });
        await flush();
        deps.onFailed('the solver declined x (refusal): arrival-inside-solid', { obstacle: OBSTACLE });
        expect(failed.at(-1)).toMatchObject({ reason: 'the wasm playback failed: the solver declined x (refusal): arrival-inside-solid',
            obstacle: OBSTACLE, escape: ESCAPE });
        expect(c.lastObstacle).toEqual(OBSTACLE);
        deps.onFailed('the solver declined y');
        expect(failed.at(-1)).not.toHaveProperty('obstacle');
        expect(failed.at(-1)).not.toHaveProperty('escape');
        expect(c.lastObstacle).toBeNull();
        // another obstacle kind rides along, with no escape
        deps.onFailed('z', { obstacle: { kind: 'hazard-floor', id: 'f' } });
        expect(failed.at(-1).obstacle).toEqual({ kind: 'hazard-floor', id: 'f' });
        expect(failed.at(-1)).not.toHaveProperty('escape');
    });

    it('JS: the page walker\'s FAILED event carries the obstacle → the same payload', () => {
        const failed = [];
        let listener = null;
        const page = { walkTo: () => ({ ok: true }), setSolverWalk() {}, play() {}, stop() {}, onWalk(fn) { listener = fn; return () => {}; },
            state: 'walking', reason: null };
        const surface = { transport: 'js', atlas: MAP, region: 'region_2_2', jsRuntime: { playback: page, run: { level: 86 } } };
        const c = new SeedlingPlaybackController({ getSurface: () => surface, substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE,
            resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas, onWalkFailed: (e) => failed.push(e) });
        expect(c.walkTo({ kind: 'location', name: 'Starting House - Chest' })).toBe(true);
        listener({ type: 'failed', state: 'failed', message: 'the solver declined — arrival-inside-solid …', obstacle: OBSTACLE });
        expect(failed).toHaveLength(1);
        expect(failed[0]).toMatchObject({ reason: 'the JS runtime\'s walk failed: the solver declined — arrival-inside-solid …',
            obstacle: OBSTACLE, escape: ESCAPE, target: { kind: 'location', name: 'Starting House - Chest' } });
    });
});
