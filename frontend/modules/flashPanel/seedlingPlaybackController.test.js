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
import { assembleGeneratedSeedlingSet } from '../seedlingDemo/seedlingGeneratedSet.js';
import { planLevelSetChunks } from '../seedlingDemo/levelSetValidator.js';
import { CAPABILITY_STATEMENTS, CELL_KINDS } from '../procgenCore/substrateCapabilities.js';

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
        expect(SEEDLING_ATLAS_PLAYBACK_SCOPE).toBe(SEEDLING_PLAYBACK_SCOPE);
    });

    it('P2 reads ◐ "with the Flash Panel\'s JS runtime" for flash_seedling_gen AND flash_seedling', () => {
        const p2 = CAPABILITY_STATEMENTS.find((s) => s.id === 'P2');
        expect(p2.answer(genEntry)).toEqual({ kind: CELL_KINDS.PARTIAL, text: SEEDLING_PLAYBACK_SCOPE });
        expect(p2.answer(atlasEntry)).toEqual({ kind: CELL_KINDS.PARTIAL, text: SEEDLING_PLAYBACK_SCOPE });
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
            .toBe('"Somewhere - Sword" is an atlas location the atlas arm did NOT bind — the property path reports it too');
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
