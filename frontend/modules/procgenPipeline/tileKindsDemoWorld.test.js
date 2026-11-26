/**
 * ⛓⛓ CONTENT SETS GEN-2 — **THE "RANDOMLY PLACED TILES" DEMO WORLD: KINDS PLACED, LOGIC UNMOVED.**
 *
 * `TILE_KINDS_DEMO_STATE` (top-down over the committed Adventure seed-1 preset, every region a 16×12 maze room, the
 * pack `furniture` under "what exists", the per-room mix scattered 2 : classic 1) is built headless through the
 * panel's own assembly (`prepareRunFromState` → `runPresetHeadless`, the packs read from disk) with the SOURCE its
 * recipe row names (`make-seedling-spiral-room-preset.mjs`'s `topDownContextOf`). Beside it, its control: the same
 * state built all-`classic` (no `mazeBiome`). It must:
 *   · compile the control's logic: `rules.json` minus `preset_sidecars` and the recorded maze settings is the
 *     control's, string for string;
 *   · hold the law in every furnished room, read off the FINAL rooms (not the generator's own bookkeeping): the floor
 *     reach is the control room's less the pillar cells, the walk length and the region's compiled rules are the
 *     control room's; a rug changes no tile, a pillar is a wall;
 *   · place both of the pack's kinds (so the equalities are not vacuous), and show both halves of the mix: each room's
 *     biome is the hash pick of (seed, region), and both biomes occur;
 *   · BE the committed `tile_kinds_demo` preset, byte for byte (the producer's `--check`, in the suite), registered
 *     as a dev preset that `?game=tile_kinds_demo&seed=1` resolves to;
 *   · draw from the pack: the composite map's art stack for its rooms is the maze's pack then `furniture`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { PRESETS, topDownContextOf } from '../../../scripts/procgen/make-seedling-spiral-room-preset.mjs';
import { TILE_KINDS_DEMO_STATE, SHIPPED_PRESETS } from './presetDefs.js';
import { prepareRunFromState, runPresetHeadless } from './presetRun.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { findRulesFileFromGameSeed } from '../../app/mode/modeDataLoader.js';
import { MAZE_BIOME_KEY, MAZE_BIOME_SEED_KEY, TILE_KINDS_KEY, normalizeMazeBiomeSetting, pickMazeBiome } from '../mazeRoom/mazeRegionBiomes.js';
import { deserializeMazeWorld, extractPathsAndObstacles, getTile, TILE_FLOOR, TILE_WALL } from '../mazeRoom/mazeRoomEngine.js';
import { computeLongestShortestPath } from '../mazeRoom/mazeGeometry.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { mazeCompositeStackOf } from '../mazeRoom/mazeCompositeMap.js';
import { substrateRegistryEntry } from '../mazeRoom/mazeRoomLibrary.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const ROW = Object.values(PRESETS).find((p) => p.stateExport === 'TILE_KINDS_DEMO_STATE');
const GAME = ROW.gameId;
const PRESET_FILE = `frontend/presets/${GAME}/AP_1/AP_1_rules.json`;
const [PACK] = TILE_KINDS_DEMO_STATE.params.exists;
const PACK_STRUCTURE = readJson(`frontend/packs/${PACK}/structure/manifest.json`).entries;
const PACK_CONCEPTS = readJson(`frontend/packs/${PACK}/concepts/manifest.json`).concepts;
const passOf = (kind) => PACK_STRUCTURE[PACK_CONCEPTS[kind].presents].pass;

const build = async (state) => runPresetHeadless(await prepareRunFromState(structuredClone(state),
    { io: nodePackIo(), ...topDownContextOf(ROW) }));
const control = () => {
    const { [MAZE_BIOME_KEY]: _mix, ...params } = TILE_KINDS_DEMO_STATE.params;
    return { ...structuredClone(TILE_KINDS_DEMO_STATE), params: structuredClone(params) };
};
const SETTING_KEYS = [MAZE_BIOME_KEY, MAZE_BIOME_SEED_KEY, TILE_KINDS_KEY];
const logicOf = (rj) => {
    const out = structuredClone(rj);
    delete out.preset_sidecars;
    for (const m of Object.values(out.procgen_metadata ?? {})) for (const k of SETTING_KEYS) delete m[k];
    return JSON.stringify(out);
};
const mazeRooms = (rj) => Object.entries(rj.preset_sidecars['1']).filter(([, s]) => s.substrate === 'maze');
const compiled = (w, region) => JSON.stringify(compileRegion(extractPathsAndObstacles(w, { regionId: region }), { obstacleLib: w.obstacleLib }));
function floorReach(w) {
    const seen = new Set([`${w.entrance.x},${w.entrance.y}`]);
    const queue = [[w.entrance.x, w.entrance.y]];
    while (queue.length) {
        const [x, y] = queue.pop();
        for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
            const nx = x + dx;
            const ny = y + dy;
            const k = `${nx},${ny}`;
            if (nx < 0 || ny < 0 || nx >= w.width || ny >= w.height || seen.has(k) || getTile(w, nx, ny) !== TILE_FLOOR) continue;
            seen.add(k);
            queue.push([nx, ny]);
        }
    }
    return seen;
}

const world = await build(TILE_KINDS_DEMO_STATE);
const ctrl = await build(control());

describe('GEN-2 — the demo world beside its all-classic control', () => {
    it('is the shipped preset tile-kinds-demo\'s state', () => {
        expect(SHIPPED_PRESETS.find((p) => p.id === 'shipped:tile-kinds-demo')?.state).toBe(TILE_KINDS_DEMO_STATE);
    });

    it('builds clean, every region a maze room, and records its settings', () => {
        expect(world.oracleErrors ?? []).toEqual([]);
        expect(mazeRooms(world.rulesJson).length).toBe(Object.keys(world.rulesJson.preset_sidecars['1']).length);
        const meta = world.rulesJson.procgen_metadata['1'];
        expect(meta.exists).toEqual([PACK]);
        expect(meta[MAZE_BIOME_KEY]).toEqual(TILE_KINDS_DEMO_STATE.params.mazeBiome);
        expect(meta[MAZE_BIOME_SEED_KEY]).toBe(TILE_KINDS_DEMO_STATE.params.seed);
        expect(ctrl.rulesJson.procgen_metadata['1'][MAZE_BIOME_KEY]).toBeUndefined();
    });

    it('THE LAW, world-wide: rules.json minus the sidecars and the maze settings is the control\'s, string for string', () => {
        expect(logicOf(world.rulesJson)).toBe(logicOf(ctrl.rulesJson));
    });

    it('THE LAW, room by room, on the final rooms: reach less the pillars, walk length and compiled rules unmoved', () => {
        const ctrlRooms = new Map(mazeRooms(ctrl.rulesJson));
        const placed = {};
        for (const [region, s] of mazeRooms(world.rulesJson)) {
            const c = ctrlRooms.get(region);
            const kinds = s.playable_payload.tileKinds ?? [];
            if (s.biome.id === 'classic') {
                expect(kinds, region).toEqual([]);
                expect(s.playable_payload, region).toEqual(c.playable_payload);
                continue;
            }
            const w = deserializeMazeWorld(s.playable_payload);
            const cw = deserializeMazeWorld(c.playable_payload);
            const blockedCells = new Set();
            for (const k of kinds) {
                expect(k.pass ?? 'walkable', `${region} ${k.kind}`).toBe(passOf(k.kind));
                placed[k.kind] = (placed[k.kind] ?? 0) + 1;
                expect(getTile(cw, k.x, k.y), `${region} ${k.kind} sits on control floor`).toBe(TILE_FLOOR);
                if (passOf(k.kind) === 'blocked') {
                    blockedCells.add(`${k.x},${k.y}`);
                    expect(getTile(w, k.x, k.y), `${region} ${k.kind} walls its cell`).toBe(TILE_WALL);
                } else {
                    expect(getTile(w, k.x, k.y), `${region} ${k.kind} changes no tile`).toBe(TILE_FLOOR);
                }
            }
            const want = [...floorReach(cw)].filter((cell) => !blockedCells.has(cell)).sort();
            expect([...floorReach(w)].sort(), `${region}: no floor cut off`).toEqual(want);
            expect(computeLongestShortestPath(w), `${region}: walk length`).toBe(computeLongestShortestPath(cw));
            expect(compiled(w, region), `${region}: compiled rules`).toBe(compiled(cw, region));
        }
        console.log(`tile_kinds_demo: placed ${JSON.stringify(placed)}`);
        // every kind the pack offers is placed somewhere (the equalities above are not vacuous)
        expect(Object.keys(placed).sort()).toEqual(Object.keys(PACK_CONCEPTS).sort());
    });

    it('THE MIX: each room\'s biome is the hash pick of (seed, region), and both biomes occur', () => {
        const setting = normalizeMazeBiomeSetting(TILE_KINDS_DEMO_STATE.params.mazeBiome);
        const ids = new Set();
        for (const [region, s] of mazeRooms(world.rulesJson)) {
            const want = pickMazeBiome(setting, TILE_KINDS_DEMO_STATE.params.seed, region)?.id ?? 'classic';
            expect(s.biome, region).toEqual({ id: want });
            ids.add(want);
        }
        expect([...ids].sort()).toEqual(['classic', 'scattered']);
    });
});

describe('GEN-2 — the committed tile_kinds_demo preset IS this world', () => {
    const text = readFileSync(join(ROOT, PRESET_FILE), 'utf8');

    it('byte for byte a fresh build of TILE_KINDS_DEMO_STATE (the producer\'s --check, in the suite)', () => {
        expect(text).toBe(JSON.stringify(world.rulesJson, null, 2));
    });

    it('is listed as a dev preset, and ?game=tile_kinds_demo&seed=1 resolves to its own rules, never the default', () => {
        const index = readJson('frontend/presets/preset_files.json');
        expect(index[GAME]?.folders?.AP_1?.files).toEqual(['AP_1_rules.json']);
        const preserved = readFileSync(join(ROOT, 'scripts/release/preserved-dev-presets.txt'), 'utf8')
            .split('\n').map((l) => l.trim().split(/\s+/)[0]);
        expect(preserved).toContain(GAME);
        const quiet = { warn() {}, info() {}, debug() {} };
        expect(findRulesFileFromGameSeed(index, GAME, '1', null, quiet)).toBe(`./presets/${GAME}/AP_1/AP_1_rules.json`);
    });

    it('carries its sphere log (the spoiler test and the bot read it)', () => {
        expect((world.rulesJson.sphere_log ?? []).length).toBeGreaterThan(0);
    });

    it('its rooms draw from the pack: the composite map\'s art stack is the maze pack then furniture', () => {
        const [[region, s]] = mazeRooms(world.rulesJson);
        expect(mazeCompositeStackOf({ ...s, id: region }, { rules: world.rulesJson, playerId: '1' }))
            .toEqual([substrateRegistryEntry.defaultContentPack, PACK]);
    });
});
