/**
 * jsRuntimeCore on REAL atlas rooms (`flash_seedling`) — Seedling JS runtime
 * slice J3. Every row drives the core through the calls the host makes
 * (`configure`, `queueItems`, the tick, `playback.walkTo`) over the VANILLA map
 * (`setVanilla`, what the page fetches), and hands what it reports to the
 * host's OWN parsers, bindings and check table — the same objects the wasm
 * page's reports reach (`seedlingRegionBinding.js`, `seedlingCheckBinding.js`,
 * `seedlingAtlasCheckTable.js`).
 *
 * The wasm side each report is matched against, field for field:
 *  · `Game.pendingCheck = "<seq>|<level>|<tag>|0"` — `Game.setPersistence`
 *    (`vendor/seedling/src/Game.as:1908`); the chest of the real starting
 *    house reports `"<seq>|86|<the chest's own @tag>|0"`
 *    (`scripts/procgen/check-seedling-atlas-location-play.mjs`, Phase K).
 *  · `Game.pendingExit = "<seq>|<from>|<exitType>|<int x>|<int y>|<to>"` —
 *    `Teleporter.update()` (`Teleporter.as:107`), `exitType` `teleporter` or a
 *    `Stairs`'s `stairsup`/`stairsdown` (`Stairs.as:25`), x/y the link's
 *    `.oel` position; the house door is Phase O's crossing.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime, exitTypeAt, liveClears, locationEntityOf, locationPointOf } from './jsRuntimeCore.js';
import { WALK_STATES } from './jsRuntimeWalker.js';
import { BUILD_SPAWN } from './tapeFormat.js';
import { tagOf } from './levelWorld.js';
import { ITEM_FOR_KEY, ITEM_FOR_TAG, VICTORY_ITEM } from './seedlingAtlasDerivation.js';
import { placementKey } from './apPlacementRewriter.js';
import { buildAtlasCheckTable, itemOfEntityFrom, propertyLocationOfFrom } from './seedlingAtlasCheckTable.js';
import { departureExitOf, outExitIdOf, parsePendingExit, SeedlingRegionBinding } from '../flashPanel/seedlingRegionBinding.js';
import { parsePendingCheck, SeedlingCheckBinding } from '../flashPanel/seedlingCheckBinding.js';
import { returnKey, returnSpawnTable } from '../flashPanel/seedlingReturnSpawns.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const ATLASES = 'frontend/modules/flashPanel/atlases/';
const MAP = readJson(`${ATLASES}seedling-map.json`);
const INDEX = readJson(`${ATLASES}atlas_files.json`);
const GAME = readJson('frontend/modules/flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties });
const RETURNS = returnSpawnTable(MAP);
const rulesOf = (id) => readJson(`frontend/presets/${id}/AP_1/AP_1_rules.json`);
const sidecarOf = (rules, region) => rules.preset_sidecars['1'][region].playable_payload;

const ATLAS_LOCATION = rulesOf('seedling_atlas_location');
const HOUSE = sidecarOf(ATLAS_LOCATION, 'region_2_2');   // the real starting_house, level 86
const HOUSE_DOOR = HOUSE.exits[0];
const HOME = RETURNS.get(returnKey(HOUSE.level, ...HOUSE_DOOR.exit_tiles[0]));
const CHEST = MAP.levels.find((l) => l.level === HOUSE.level).entities.find((e) => e.type === 'chest');

/** A configured runtime over the vanilla map, every report captured. */
function vanillaRuntime() {
    const reports = [];
    const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
    expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
    rt.setVanilla(MAP);
    reports.length = 0;
    return { rt, reports };
}
const teleport = (rt, { level, x, y }) => {
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    rt.tick();
};
/** Tick with the walker driving until it settles (or `stop()` says so). */
function settle(rt, { maxTicks = 3000, stop = () => false } = {}) {
    const outs = [];
    for (let t = 0; t < maxTicks; t += 1) {
        const out = rt.tick();
        outs.push(out);
        if (out.halted || stop(out)) break;
        if ([WALK_STATES.DONE, WALK_STATES.FAILED].includes(rt.playback.state)) break;
    }
    return outs;
}

/** The host's REAL atlas check table for a preset (the wiring's own construction). */
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

describe('jsRuntimeCore J3 — a real room boots on the JS page', () => {
    it('the vanilla map boots the game\'s own first frame (Main.as:51) — the binding\'s BASELINE level 0', () => {
        const reports = [];
        const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
        rt.game.configure(BRIDGE_CONFIG);
        expect(rt.run).toBeNull();
        expect(reports.find(([p]) => p === 'level')).toEqual(['level', -1]);
        reports.length = 0;
        rt.setVanilla(MAP);
        expect(rt.run.level).toBe(BUILD_SPAWN.level);
        expect(rt.run.worldCtor).toEqual({ x: BUILD_SPAWN.x, y: BUILD_SPAWN.y });
        // The report a wasm `new Game(0, 80, 128)` makes: position BEFORE level.
        const order = reports.map(([p]) => p);
        expect(order.indexOf('playerPositionX')).toBeLessThan(order.indexOf('level'));
        expect(reports.find(([p]) => p === 'level')).toEqual(['level', 0]);
        // …and the region binding reads it as its baseline, releasing a queued arrival.
        const b = new SeedlingRegionBinding();
        expect(b.onLoadRegion({ region_id: 'region_2_2', world: HOUSE }).some((e) => e.type === 'teleport')).toBe(false);
        const effects = reports.flatMap(([p, v]) => b.onStateReport(p, v));
        expect(effects).toEqual([{ type: 'teleport', level: HOUSE.level, x: HOUSE_DOOR.entrance_spawn.x,
            y: HOUSE_DOOR.entrance_spawn.y, region: 'region_2_2' }]);
    });

    it('a `new_instance Game(86, x, y)` teleport boots the REAL starting house at the ctor args', () => {
        const { rt, reports } = vanillaRuntime();
        teleport(rt, { level: HOUSE.level, ...HOME });
        expect(rt.run.level).toBe(86);
        expect(rt.run.worldCtor).toEqual({ x: HOME.x, y: HOME.y });
        expect(reports.filter(([p]) => ['playerPositionX', 'playerPositionY', 'level'].includes(p)))
            .toEqual([['playerPositionX', HOME.x], ['playerPositionY', HOME.y], ['level', 86]]);
        expect(rt.halted).toBeNull();
        expect(JSON.parse(rt.game.botLevelSet()).vanilla).toBe(MAP.levels.length);
    });

    it('a teleport that beats the map fetch is HELD and replayed by setVanilla (not dropped, no new-game boot)', () => {
        const rt = createJsRuntime();
        rt.game.configure(BRIDGE_CONFIG);
        teleport(rt, { level: HOUSE.level, ...HOME });
        expect(rt.run).toBeNull();
        expect(rt.events.some((e) => e.type === 'held')).toBe(true);
        rt.setVanilla(MAP);
        expect(rt.run.level).toBe(86);
        expect(rt.events.filter((e) => e.type === 'boot').map((e) => e.level)).toEqual([86]);
    });
});

describe('jsRuntimeCore J3 — the atlas check and the atlas crossing, field for field', () => {
    it('the chest, walked to by the Playback Bot\'s walker, reports pendingCheck "<seq>|86|<@tag>|0" '
        + '→ the atlas arm\'s check binding names "Starting House - Chest"', () => {
        const { rt, reports } = vanillaRuntime();
        teleport(rt, { level: HOUSE.level, ...HOME });
        const tag = Number(CHEST.attrs.tag);
        expect(locationEntityOf(rt.vanilla.records.get(86), tag, 'chest')).toEqual(CHEST);
        expect(rt.playback.walkTo({ kind: 'location', level: 86, tag, entityType: 'chest' })).toEqual({ ok: true });
        rt.playback.play();
        settle(rt);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        const checks = reports.filter(([p]) => p === 'pendingCheck').map(([, v]) => parsePendingCheck(v)).filter(Boolean);
        expect(checks.map(({ level, tag: t, cleared }) => ({ level, tag: t, cleared }))).toEqual([{ level: 86, tag, cleared: true }]);
        // The host's own table for this preset, built the way the wiring builds it.
        const { table, entries } = atlasTableOf(ATLAS_LOCATION);
        expect(entries.map((e) => e.location)).toEqual(['Starting House - Chest']);
        const binding = new SeedlingCheckBinding({ table, placementKey, selfPlayer: 1 });
        const out = reports.filter(([p]) => p === 'pendingCheck').flatMap(([p, v]) => binding.onStateReport(p, v) ?? []);
        expect(JSON.stringify(out)).toContain('Starting House - Chest');
        expect(rt.halted).toBeNull();
        // ⛔ A clear is reported ONCE: the ledger still holds it on every later tick.
        for (let i = 0; i < 30; i += 1) rt.tick();
        expect(reports.filter(([p]) => p === 'pendingCheck')).toHaveLength(1);
        expect(liveClears(rt.run)).toEqual([{ level: 86, tag }]);
    });

    it('the house door reports pendingExit "<seq>|86|teleporter|48|64|0" → the binding\'s departure is the '
        + 'atlas exit (external, to the maze child)', () => {
        const { rt, reports } = vanillaRuntime();
        const binding = new SeedlingRegionBinding();
        binding.onLoadRegion({ region_id: 'region_2_2', world: HOUSE });
        teleport(rt, { level: HOUSE.level, ...HOME });
        reports.forEach(([p, v]) => binding.onStateReport(p, v));
        reports.length = 0;
        expect(rt.playback.walkTo({ kind: 'exit', level: 86, tiles: HOUSE_DOOR.exit_tiles })).toEqual({ ok: true });
        rt.playback.play();
        const outs = settle(rt);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(outs.find((o) => o.crossing)?.crossing).toEqual({ from: 86, to: 0, x: 48, y: 64, type: 'teleporter' });
        const exits = reports.filter(([p]) => p === 'pendingExit').map(([, v]) => parsePendingExit(v));
        expect(exits.map(({ seq, ...rest }) => rest)).toEqual([{ fromLevel: 86, type: 'teleporter', x: 48, y: 64, to: 0 }]);
        // Reported BEFORE the level move, as games/seedling.json orders them.
        const order = reports.map(([p]) => p);
        expect(order.indexOf('pendingExit')).toBeLessThan(order.lastIndexOf('level'));
        expect(departureExitOf(HOUSE, exits[0])).toBe(HOUSE_DOOR);
        const effects = reports.flatMap(([p, v]) => binding.onStateReport(p, v));
        expect(effects.filter((e) => e.type === 'regionMove')).toEqual([expect.objectContaining({
            sourceRegion: 'region_2_2', targetRegion: HOUSE_DOOR.targetRegion, exitName: HOUSE_DOOR.exitName,
            external: true })]);
        expect(effects.some((e) => e.type === 'warn')).toBe(false);
    });

    it('a STAIRS reports its own exitType (`Stairs.as:25`) — the owl\'s nest stairs in level 0 are `stairsdown`, '
        + 'and the level move resolves the atlas crossing to owls_nest_entrance', () => {
        const atlas = rulesOf('seedling_atlas');
        const r8c0 = sidecarOf(atlas, 'overworld_start__r8c0');
        const stairs = r8c0.exits.find((e) => e.exit_id === 'owls_nest_stairs');
        expect(exitTypeAt(MAP.levels.find((l) => l.level === 0), 256, 272)).toBe('stairsdown');
        // The host's order: the region loads, THEN the game's first frame (the
        // baseline, level 0) releases the arrival — here the binding's own
        // teleport effect is applied as the glue applies it.
        const reports = [];
        const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
        rt.game.configure(BRIDGE_CONFIG);
        const binding = new SeedlingRegionBinding({ returnSpawns: null });
        binding.setReturnSpawns(RETURNS);
        binding.onLoadRegion({ region_id: 'overworld_start__r8c0', world: r8c0 });
        rt.setVanilla(MAP);
        const arrival = reports.flatMap(([p, v]) => binding.onStateReport(p, v)).find((e) => e.type === 'teleport');
        expect(arrival).toMatchObject({ level: 0 });
        reports.length = 0;
        teleport(rt, arrival);
        reports.forEach(([p, v]) => binding.onStateReport(p, v));
        reports.length = 0;
        expect(rt.playback.walkTo({ kind: 'exit', level: 0, tiles: stairs.exit_tiles })).toEqual({ ok: true });
        rt.playback.play();
        settle(rt);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        const [door] = reports.filter(([p]) => p === 'pendingExit').map(([, v]) => parsePendingExit(v));
        expect(door).toMatchObject({ fromLevel: 0, type: 'stairsdown', x: 256, y: 272, to: 2 });
        // ⛓ The derived-atlas id the binding would rebuild: `teleporter` (J1's
        // constant) would have spelled `out_teleporter_256_272` and missed.
        expect(outExitIdOf(door)).toBe('out_stairsdown_256_272');
        const effects = reports.flatMap(([p, v]) => binding.onStateReport(p, v));
        expect(effects.filter((e) => e.type === 'regionMove')).toEqual([expect.objectContaining({
            sourceRegion: 'overworld_start__r8c0', targetRegion: 'owls_nest_entrance', exitName: stairs.exitName })]);
    });
});

describe('jsRuntimeWalker J3 — a boundary-cell target', () => {
    it('an exit naming a SET of cells walks to the live teleporter among them', () => {
        const { rt } = vanillaRuntime();
        teleport(rt, { level: HOUSE.level, ...HOME });
        const tiles = [[1, 3], ...HOUSE_DOOR.exit_tiles];   // a floor cell, then the door
        expect(rt.playback.walkTo({ kind: 'exit', level: 86, tiles })).toEqual({ ok: true });
        rt.playback.play();
        const outs = settle(rt);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(outs.find((o) => o.crossing)?.crossing).toMatchObject({ from: 86, to: 0 });
    });

    it('a boundary with NO teleporter on any cell is refused by name (no sub-level crossing exists on either runtime)', () => {
        const { rt } = vanillaRuntime();
        teleport(rt, { level: HOUSE.level, ...HOME });
        expect(rt.playback.walkTo({ kind: 'exit', level: 86, tiles: [[1, 3], [2, 3]] }))
            .toEqual({ ok: false, reason: 'level 86 has no teleporter on any of the tiles [[1,3],[2,3]]' });
        expect(rt.playback.walkTo({ kind: 'location', level: 86, tag: 7 }))
            .toEqual({ ok: false, reason: 'level 86 has no entity with tag 7' });
    });

    it('a chest is taken from its two-pixel stance BELOW it, a pickup at its centre', () => {
        expect(locationPointOf(CHEST)).toEqual({ x: CHEST.x + 8, y: 34 });
        expect(locationPointOf({ type: 'sword', x: 48, y: 48 })).toEqual({ x: 56, y: 56 });
        expect(locationPointOf(null)).toBeNull();
    });
});

describe('jsRuntimeCore J3 — a real level the model cannot run HALTS BY NAME', () => {
    it('L40 refuses at BOOT (bridged chaser + IceTurret): halted, named, the page keeps reporting', () => {
        const { rt, reports } = vanillaRuntime();
        teleport(rt, { level: 40, x: 32, y: 32 });
        expect(rt.run).toBeNull();
        expect(rt.halted?.message).toMatch(/level 40 holds a bridged chaser AND \[IceTurret\]/);
        expect(JSON.parse(rt.game.botStatus()).halted).toMatch(/IceTurret/);
        expect(rt.events.find((e) => e.type === 'halt')?.message).toMatch(/refused to boot level 40/);
        expect(reports.find(([p]) => p === 'level')).toEqual(['level', -1]);
        // A later teleport to a room the model runs recovers the page.
        teleport(rt, { level: HOUSE.level, ...HOME });
        expect(rt.halted).toBeNull();
        expect(rt.run.level).toBe(86);
    });

    it('L112 refuses on its first tick (the Owl needs `rng.split`): the page halts by name, never silently', () => {
        const { rt } = vanillaRuntime();
        const arrival = MAP.levels.flatMap((l) => l.entities.filter((e) => Number(e.attrs?.to) === 112)
            .map((e) => ({ x: Number(e.attrs.playerx), y: Number(e.attrs.playery) })))[0];
        teleport(rt, { level: 112, ...arrival });
        // The teleport's own tick is the Owl room's first: it refuses there.
        expect(rt.run.level).toBe(112);
        expect(rt.halted?.message).toMatch(/the Owl fight in level 112 needs `rng: \{ split: true \}`/);
        expect(JSON.parse(rt.game.botStatus()).halted).toMatch(/Owl fight/);
        expect(rt.tick()).toEqual({ stepped: false });
    });
});
