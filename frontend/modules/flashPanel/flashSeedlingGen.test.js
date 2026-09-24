/**
 * ⛓⛓⛓ SEEDLING GENERATED LEVELS G1 — **`flash_seedling_gen`: THE ROOM AND THE
 * ENTRY**, headless (`seedlingDemo/seedlingGenRoom.js` through the entry's
 * install seam; plan §2.2 item 1, ⚖ Q1–Q7).
 *
 * Each law below is a row, and the mutant that breaks it was driven against it
 * (G1 as-built, plan §5): the k-th exit takes the k-th door, the arrival lands on
 * the approach cell, location 0 stands on the goal cell, tags are the one
 * writer's and distinct, the record IS the CLI's at the same seed and knobs, and
 * the round trip closes.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, vi } from 'vitest';

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createRng } from '../shared/rng.js';
import {
    FLASH_SEEDLING_GEN_SUBSTRATE_ID, substrateRegistryEntry as ENTRY, FLASH_SEEDLING_GEN_NOT_INSTALLED,
    SEEDLING_GEN_ROOM_EXPORTS, SEEDLING_GEN_ROOM_MODULE_PATH, installSeedlingGenRoom,
    buildSeedlingGenRegionParams, seedlingGenProcgenParamsFromPayload, DEFAULT_SEEDLING_GEN_PROCGEN_PARAMS,
} from './flashSeedlingGenLibrary.js';
import * as GEN_LIBRARY from './flashSeedlingGenLibrary.js';
// the headless BUILD door: registers the entry and installs the generator
import './flashSeedlingGenBuild.js';
import {
    substrateRegistryEntry as FLASH_SEEDLING_ENTRY, FLASH_SEEDLING_LOAD_REGION_EVENT, seedlingFlashPanelBlock,
} from './flashSeedlingLibrary.js';
import * as ROOM from '../seedlingDemo/seedlingGenRoom.js';
import {
    GEN_ROOM_DEFAULTS, GEN_ROOM_REFUSALS, GEN_ROOM_TILE_SIZE, genDoorId, deserializeGenRoom, genRoomRefusal,
} from '../seedlingDemo/seedlingGenRoom.js';
import { pickDoorCells, walkableCellsFrom } from '../seedlingDemo/levelSetExits.js';
import { placementTagId } from '../seedlingDemo/procgenSeedling.js';
import { TILE_SIZE } from '../seedlingDemo/levelWorld.js';
import { sidecarFieldsOf, sidecarPayloadErrors, validateSidecarFields } from '../procgenCore/sidecarFields.js';
import { REGION_GEOMETRY, geometryOf } from '../procgenCore/regionGeometry.js';
import { SIDES } from '../shared/procgen/spatialPrimitives.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** An rng whose first draw yields exactly `seed` under the room's `(next()*0x7fffffff | 0) || 1`. */
const seededRng = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
const key = (c) => `${c.tx},${c.ty}`;
const EXITS = [
    { exit_id: 'a', side: 'N', targetRegion: 'x' },
    { exit_id: 'b', side: 'E', targetRegion: 'y' },
    { exit_id: 'c', side: 'S', targetRegion: 'z' },
];
const build = (exits = EXITS, { seed = 3, size = { width: 10, height: 10 }, params = {} } = {}) => ENTRY.generateRegionCore({
    region_id: 'gen_probe', size, entrances: [], exits, rng: seededRng(seed), params,
});

describe('the entry — registered, light, and in the family', () => {
    it('is registered under its constant, plays in the flash panel on flash_seedling\'s load event', () => {
        expect(substrateRegistry.get(FLASH_SEEDLING_GEN_SUBSTRATE_ID)).toBe(ENTRY);
        expect(ENTRY.panelComponentType).toBe(FLASH_SEEDLING_ENTRY.panelComponentType);
        expect(ENTRY.loadRegionEvent).toBe(FLASH_SEEDLING_LOAD_REGION_EVENT);
        expect(ENTRY.roomEditor).toEqual(FLASH_SEEDLING_ENTRY.roomEditor);
        expect('iframeId' in ENTRY).toBe(false);
        // ⛔ the editor round trip is NOT declared in G1 (the hub reports "not checked")
        expect('regionRoundTrip' in ENTRY).toBe(false);
    });

    it('is PROCEDURAL (it shadows no zone hook) in the SIDES shape, and a LEAF', () => {
        for (const hook of ['generateRegionCore', 'placeFromItems', 'placeFromRules', 'extractPathsAndObstacles',
            'serializeWorld', 'deserializeWorld']) expect(typeof ENTRY[hook], hook).toBe('function');
        expect(ENTRY.generateZoneForSpecs).toBeUndefined();
        expect(ENTRY.zoneCount).toBeUndefined();
        expect(geometryOf(ENTRY)).toBe(REGION_GEOMETRY.SIDES);
        expect(ENTRY.canHostExitGates()).toBe(false);
        expect(ENTRY.backPortalGated()).toBe(false);
    });

    it('writes `flash_panel` ONLY — flash_seedling\'s own block, read off the installed compile', () => {
        const blocks = ENTRY.rulesJsonBlocks();
        expect(Object.keys(blocks)).toEqual(['flash_panel']);
        expect(blocks.flash_panel).toEqual(FLASH_SEEDLING_ENTRY.rulesJsonBlocks().flash_panel);
        expect(blocks.flash_panel).toEqual(seedlingFlashPanelBlock());
        // a copy: mutating it moves nothing
        blocks.flash_panel.config = 'mutated';
        expect(ENTRY.rulesJsonBlocks().flash_panel.config).not.toBe('mutated');
    });

    it('its sidecarFields declaration is well formed', () => {
        expect(validateSidecarFields(ENTRY.sidecarFields)).toEqual([]);
    });

    it('the tile size the payload is written in is the engine\'s', () => {
        expect(GEN_ROOM_TILE_SIZE).toBe(TILE_SIZE);
    });

    /**
     * ⛔ THE CLOSURE, DERIVED (the F6 walker of `seedlingRegionBinding.test.js`).
     * The panel's static closure reaches the light entry and NOT the generator —
     * the whole reason the seam exists (G1 W0: +94 files / +4.96 MB).
     */
    it('flashPanel/index.js reaches the light entry statically, and never the generator', () => {
        const SPEC = /^\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm;
        const walk = (entry) => {
            const seen = new Set();
            const stack = [entry];
            while (stack.length) {
                const file = stack.pop();
                if (seen.has(file)) continue;
                seen.add(file);
                let src;
                try { src = readFileSync(file, 'utf8'); } catch { continue; }
                for (const m of src.matchAll(SPEC)) {
                    const spec = m[1] ?? m[2];
                    if (spec?.startsWith('.')) stack.push(join(dirname(file), spec));
                }
            }
            return [...seen];
        };
        const closure = walk(fileURLToPath(new URL('./index.js', import.meta.url)));
        expect(closure.some((f) => f.endsWith('/flashSeedlingGenLibrary.js'))).toBe(true);
        expect(closure.some((f) => f.endsWith('/seedlingGenRoomPayload.js'))).toBe(true);
        for (const heavy of ['/procgenSeedling.js', '/seedlingGenRoom.js', '/levelSetExits.js', '/flashSeedlingGenBuild.js']) {
            expect(closure.filter((f) => f.endsWith(heavy)), heavy).toEqual([]);
        }
        // …and the room module the live app installs is the one the seam names
        expect(SEEDLING_GEN_ROOM_MODULE_PATH).toBe('modules/seedlingDemo/seedlingGenRoom.js');
        expect(readdirSync(join(ROOT, 'frontend', dirname(SEEDLING_GEN_ROOM_MODULE_PATH))))
            .toContain('seedlingGenRoom.js');
    });
});

describe('the install seam', () => {
    it('a fresh library instance REFUSES every build hook by name until a room is installed', async () => {
        vi.resetModules();
        const fresh = await import('./flashSeedlingGenLibrary.js');
        expect(fresh.seedlingGenRoomInstalled()).toBe(false);
        const e = fresh.substrateRegistryEntry;
        expect(() => e.generateRegionCore({ region_id: 'r', exits: [], rng: createRng(1) }))
            .toThrow(FLASH_SEEDLING_GEN_NOT_INSTALLED('generateRegionCore'));
        expect(() => e.serializeWorld({}, {})).toThrow(/serializeWorld needs the Seedling generator/);
        expect(FLASH_SEEDLING_GEN_NOT_INSTALLED('x')).toMatch(/reload the page/);
        // play time needs nothing installed
        expect(typeof e.deserializeWorld).toBe('function');
        // installing a module that is not the room is refused, naming what it lacks
        expect(() => fresh.installSeedlingGenRoom({ generateGenRoom: () => 0 }))
            .toThrow(/lacks `placeGenItems`, `placeGenRules`, `extractGenRules`, `serializeGenRoom`/);
        fresh.installSeedlingGenRoom(ROOM);
        expect(fresh.seedlingGenRoomInstalled()).toBe(true);
        vi.resetModules();
    });

    it('the room module exports every function the seam names', () => {
        for (const k of SEEDLING_GEN_ROOM_EXPORTS) expect(typeof ROOM[k], k).toBe('function');
        expect(installSeedlingGenRoom(ROOM)).toBe(ROOM);
        expect(GEN_LIBRARY.seedlingGenRoomInstalled()).toBe(true);
    });

    it('the live app\'s loader installs the room from a COMPUTED url, and says why when it cannot', async () => {
        vi.resetModules();
        const index = await import('./index.js');
        const lib = await import('./flashSeedlingGenLibrary.js');
        expect(lib.seedlingGenRoomInstalled()).toBe(false);
        // no document (headless) → nothing to load
        expect(await index.loadSeedlingGenerator({ baseURI: undefined })).toBe(false);
        // a failed load is LOGGED with what to do, returns false, and may be retried
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(await index.loadSeedlingGenerator({
            baseURI: 'http://localhost:8300/frontend/index.html',
            importer: () => Promise.reject(new Error('404')),
        })).toBe(false);
        expect(errors.mock.calls.flat().join(' ')).toMatch(/did not load — generated Seedling rooms cannot be built until the page is reloaded: 404/);
        expect(lib.seedlingGenRoomInstalled()).toBe(false);
        // the URL is the document-relative module path, and the module is installed into THIS instance
        const seen = [];
        expect(await index.loadSeedlingGenerator({
            baseURI: 'http://localhost:8300/frontend/index.html',
            importer: async (url) => { seen.push(url); return ROOM; },
        })).toBe(true);
        expect(seen).toEqual([`http://localhost:8300/frontend/${SEEDLING_GEN_ROOM_MODULE_PATH}`]);
        expect(lib.seedlingGenRoomInstalled()).toBe(true);
        // once installed, no second load
        expect(await index.loadSeedlingGenerator({ baseURI: 'http://x/', importer: () => { throw new Error('no'); } })).toBe(true);
        errors.mockRestore();
        vi.resetModules();
    });
});

describe('generateRegionCore — the room and its doors', () => {
    it('the registry\'s drive shape (8x6, sided exits `a`/`b`, createRng(1), params {}) builds a room', () => {
        const core = ENTRY.generateRegionCore({
            region_id: 'probe', size: { width: 8, height: 6 }, entrances: [],
            exits: [{ exit_id: 'a', side: 'N', targetRegion: 'x' }, { exit_id: 'b', side: 'E', targetRegion: 'y' }],
            rng: createRng(1), params: {},
        });
        expect(core.exits_placed).toEqual([{ exit_id: 'a', side: 'N' }, { exit_id: 'b', side: 'E' }]);
        expect(core.world.record.width).toBe(8);
        expect(core.world.record.height).toBe(6);
        expect([...core.world.exits.keys()]).toEqual(['a', 'b']);
    });

    // ⛓ G2: the linker's picker WITH `keepReachable` (no door seals an approach or the goal).
    it('⛓ the k-th exit takes the k-th door the LINKER\'s picker mints (keepReachable); an explicit exit_id is kept', () => {
        const { world, exits_placed: placed } = build();
        const doors = pickDoorCells(world.record, world.start, EXITS.length, {
            exclude: new Set([[0, -1], [-1, 0], [1, 0], [0, 1]]
                .map(([dx, dy]) => key({ tx: world.goalCell.tx + dx, ty: world.goalCell.ty + dy }))),
            keepReachable: { cells: [world.goalCell] },
        }).doors;
        expect(placed.map((p) => p.exit_id)).toEqual(['a', 'b', 'c']);
        [...world.exits.values()].forEach((e, k) => {
            expect(e.exit_id).toBe(EXITS[k].exit_id);
            expect(e.exit_tiles).toEqual([[doors[k].tx, doors[k].ty]]);
            expect(e.door_id).toBe(`out_teleporter_${doors[k].tx * 16}_${doors[k].ty * 16}`);
            expect(e.door_id).toBe(genDoorId(doors[k]));
        });
    });

    it('⛓ an arrival lands on the door\'s APPROACH cell (the flood predecessor), never the door tile', () => {
        const { world } = build();
        const flood = walkableCellsFrom(world.record, world.start);
        for (const e of world.exits.values()) {
            const [tx, ty] = e.exit_tiles[0];
            const from = flood.get(`${tx},${ty}`).from;
            expect(e.entrance_spawn).toEqual({ x: from.tx * 16, y: from.ty * 16 });
            expect(e.entrance_spawn).not.toEqual({ x: tx * 16, y: ty * 16 });
            expect(e.entrance_tile).toEqual([tx, ty]);
        }
    });

    it('side-less exits take the free sides first, then cycle — a seven-door room is legal', () => {
        const seven = Array.from({ length: 7 }, () => ({}));
        const { world, exits_placed: placed } = build(seven, { seed: 5 });
        expect(placed.map((p) => p.exit_id)).toEqual(['exit_0', 'exit_1', 'exit_2', 'exit_3', 'exit_4', 'exit_5', 'exit_6']);
        // the free sides in SIDES order, then the cycle
        expect(placed.map((p) => p.side)).toEqual([...SIDES, ...SIDES.slice(0, 3)]);
        expect(new Set([...world.exits.values()].map((e) => e.door_id)).size).toBe(7);
        const one = build([{}]);
        expect(one.exits_placed[0].exit_id).toBe('exit');
    });

    it('draws ONE rng value; the seed is never 0', () => {
        let draws = 0;
        const rng = { next: () => { draws += 1; return 0; } };
        const core = ENTRY.generateRegionCore({ region_id: 'z', exits: [{ side: 'N' }], rng, params: {} });
        expect(draws).toBe(1);
        expect(core.world.seed).toBe(1);
    });

    it('refusals are sentences: a duplicated exit, a bad knob, a room the generator refuses', () => {
        expect(() => build([{ exit_id: 'a' }, { exit_id: 'a' }])).toThrow(GEN_ROOM_REFUSALS.duplicateExit('gen_probe', 'a'));
        expect(() => build(EXITS, { params: { seedlingGen: { biome: 'lava' } } }))
            .toThrow(/knob `biome` = "lava" is not usable — the biomes are \[pre-sword, post-sword\]/);
        expect(() => build(EXITS, { params: { seedlingGen: { skeleton: 'nope' } } }))
            .toThrow(/knob `skeleton` = "nope" is not usable/);
        expect(() => build(EXITS, { size: { width: 2, height: 2 } }))
            .toThrow(/generated Seedling room 'gen_probe' \(seed 3, 2x2\): the Seedling generator refused this room/);
    });
});

describe('the record IS the generator\'s — byte-equal to the CLI at the same seed and knobs', () => {
    it('seed 3, 10x10, the default knobs = `export-seedling-level-set.mjs --seeds=3 --exits=none`', () => {
        const dir = mkdtempSync(join(tmpdir(), 'seedling-gen-'));
        try {
            execFileSync(process.execPath, [join(ROOT, 'scripts/procgen/export-seedling-level-set.mjs'),
                '--seeds=3', '--exits=none', `--out-dir=${dir}`], { stdio: 'ignore' });
            const file = readdirSync(dir).find((f) => f.endsWith('.json') && !f.includes('.chunks.') && !f.includes('.ap-invalidation.'));
            const set = JSON.parse(readFileSync(join(dir, file), 'utf8'));
            const { world } = build();
            expect(world.seed).toBe(3);
            expect(JSON.stringify(world.record)).toBe(JSON.stringify(set.rooms[0].source.record));
            expect(set.provenance.bounds).toEqual({
                obstacleTarget: GEN_ROOM_DEFAULTS.obstacleTarget, triesPerStep: GEN_ROOM_DEFAULTS.triesPerStep,
                saturationK: GEN_ROOM_DEFAULTS.saturationK,
            });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 60_000);

    it('a knob reaches the generator: obstacleTarget 1 builds a different room', () => {
        const a = build(EXITS).world.record;
        const b = build(EXITS, { params: { seedlingGen: { obstacleTarget: 1 } } }).world.record;
        expect(JSON.stringify(b)).not.toBe(JSON.stringify(a));
    });
});

describe('locations — location 0 on the goal cell, the rest on free flood cells', () => {
    const placed = (n, seed = 3) => {
        const core = build(EXITS, { seed });
        ENTRY.placeFromRules(core.world, {
            exit_rules: {}, location_rules: {},
            item_placements: Array.from({ length: n }, (_, i) => ({ item_id: `item_${i}`, location_id: `L${i}` })),
            rng: createRng(1),
        });
        return core.world;
    };

    it('⛓ location 0 stands on the certified goal cell', () => {
        const world = placed(3);
        expect(world.locations[0].cell).toEqual(world.goalCell);
        // the goal cell is where the generator's goal pickup is
        const goal = world.record.entities.find((e) => e.type === 'torchpickup');
        expect({ tx: goal.x / TILE_SIZE, ty: goal.y / TILE_SIZE }).toEqual(world.goalCell);
    });

    it('the rest: reachable, off the start, off every door and its neighbours, nearest the start first', () => {
        const world = placed(3);
        const flood = walkableCellsFrom(world.record, world.start);
        const doorZone = new Set();
        for (const e of world.exits.values()) {
            const [tx, ty] = e.exit_tiles[0];
            for (const [dx, dy] of [[0, 0], [0, -1], [-1, 0], [1, 0], [0, 1]]) doorZone.add(key({ tx: tx + dx, ty: ty + dy }));
        }
        const rest = world.locations.slice(1);
        for (const l of rest) {
            expect(flood.has(key(l.cell)), key(l.cell)).toBe(true);
            expect(doorZone.has(key(l.cell)), key(l.cell)).toBe(false);
            expect(key(l.cell)).not.toBe(key(world.start));
        }
        const dist = rest.map((l) => flood.get(key(l.cell)).dist);
        expect([...dist].sort((p, q) => p - q)).toEqual(dist);
    });

    it('⛓ tags come from placementTagId against the room WITHOUT its goal pickup, and are distinct', () => {
        const world = placed(3);
        const bare = { ...world.record, entities: world.record.entities.filter((e) => e.type !== 'torchpickup') };
        const expected = [];
        for (let k = 0; k < 3; k += 1) expected.push(placementTagId(bare, expected));
        expect(world.locations.map((l) => l.tag)).toEqual(expected);
        expect(new Set(expected).size).toBe(3);
    });

    it('placeFromRules reports every location by id, with no position; a rule is RECORDED', () => {
        const core = build(EXITS);
        const out = ENTRY.placeFromRules(core.world, {
            exit_rules: { a: { rule: 'Has', value: 'key_blue' }, b: { rule: 'True_' } },
            location_rules: { L0: { rule: 'Has', value: 'key_red' } },
            item_placements: [{ item_id: 'victory', location_id: 'L1' }],
        });
        expect(out.placed_locations).toEqual([{ location_id: 'L0' }, { location_id: 'L1' }]);
        expect(out.placed_items).toEqual([{ item_id: 'victory', location_id: 'L1' }]);
        expect(core.world.exits.get('a').access_rule).toEqual({ rule: 'Has', value: 'key_blue' });
        expect('access_rule' in core.world.exits.get('b')).toBe(false);
        const ex = ENTRY.extractPathsAndObstacles(core.world, { regionId: 'gen_probe' });
        expect(ex.exits.map((e) => [e.id, e.access_rule.rule])).toEqual([['a', 'Has'], ['b', 'True_'], ['c', 'True_']]);
        expect(ex.locations.map((l) => [l.id, l.access_rule.rule])).toEqual([['L0', 'Has'], ['L1', 'True_']]);
        expect(() => ENTRY.placeFromRules(core.world, { exit_rules: { nope: { rule: 'True_' } } }))
            .toThrow(GEN_ROOM_REFUSALS.unknownExit('gen_probe', 'nope'));
    });

    it('placeFromItems names the maze\'s way and places NO obstacle (reported unplaced by omission)', () => {
        const core = build(EXITS);
        const out = ENTRY.placeFromItems(core.world, { items_to_place: ['key_blue', 'key_blue'], obstacles_to_place: ['door_blue'] });
        expect(out.placed_items.map((p) => p.location_id)).toEqual(['key_blue_pickup', 'key_blue_pickup_2']);
        expect(out.placed_obstacles).toEqual([]);
    });

    it('⛔ a room that cannot hold N locations REFUSES, naming its free cells and what to lower', () => {
        expect(() => placed(60)).toThrow(/must hold 60 AP location\(s\), and only \d+ cell\(s\) are free for them \[\(/);
        expect(() => placed(60)).toThrow(/Lower maxItemsPerRegion, lower the flash_seedling_gen quota/);
    });
});

describe('serializeWorld ⇄ deserializeWorld', () => {
    const payloadOf = () => {
        const core = build(EXITS);
        ENTRY.placeFromRules(core.world, {
            exit_rules: { a: { rule: 'Has', value: 'key_blue' } }, location_rules: {},
            item_placements: [{ item_id: 'victory', location_id: 'L0' }, { item_id: 'key_red', location_id: 'L1' }],
        });
        // the engine adds a back exit AFTER the core (sphere growth's insertBackExit): no door yet
        core.world.exits.set('parent', {
            exit_id: 'parent', side: 'W', exitName: 'parent', targetRegion: 'p', targetExitId: 'exit_0',
            isBackExit: true, isTeleporter: true,
        });
        const ex = ENTRY.extractPathsAndObstacles(core.world, { regionId: 'gen_probe' });
        const payload = ENTRY.serializeWorld(core.world, ex, null, null, {
            substrateOfRegion: (r) => ({ p: 'maze', x: 'maze' })[r] ?? null,
            ordinalOfRegion: (r) => (r === 'gen_probe' ? 2 : null),
        });
        return { core, payload };
    };

    it('the payload: the DOOR as exit_id, the AP name as exitName, external, target_substrate, level = the ordinal', () => {
        const { core, payload } = payloadOf();
        expect(payload.gameId).toBe('seedling');
        expect(payload.generated).toBe(true);
        expect(payload.level).toBe(2);
        expect(payload.tile_size).toBe(16);
        expect(payload.record).toEqual(core.world.record);
        expect(payload.exits.map((e) => e.exitName)).toEqual(['a', 'b', 'c', 'parent']);
        for (const e of payload.exits) {
            expect(e.exit_id).toMatch(/^out_teleporter_\d+_\d+$/);
            expect(e.exit_id).toBe(`out_teleporter_${e.exit_tiles[0][0] * 16}_${e.exit_tiles[0][1] * 16}`);
            expect(e).toMatchObject({ kind: 'teleporter', external: true, target_level: null, target_spawn: null });
        }
        expect(payload.exits.map((e) => e.target_substrate)).toEqual(['maze', null, null, 'maze']);
        expect(payload.exitGates).toEqual({ a: { rule: 'Has', value: 'key_blue' } });
        expect(payload.locations.map((l) => l.name)).toEqual(['gen_probe__L0', 'gen_probe__L1']);
        expect(ENTRY.apLocationNamesOf(payload)).toEqual(['gen_probe__L0', 'gen_probe__L1']);
    });

    it('an ENGINE-added exit gets a door clear of the bound doors, the locations and the goal; the core\'s doors keep theirs', () => {
        const { core, payload } = payloadOf();
        const coreDoors = [...core.world.exits.values()].filter((e) => e.door_id).map((e) => e.door_id);
        expect(payload.exits.slice(0, 3).map((e) => e.exit_id)).toEqual(coreDoors);
        const back = payload.exits[3];
        const [bx, by] = back.exit_tiles[0];
        const near = (c) => Math.abs(c.tx - bx) + Math.abs(c.ty - by) <= 1;
        for (const e of payload.exits.slice(0, 3)) expect(near({ tx: e.exit_tiles[0][0], ty: e.exit_tiles[0][1] })).toBe(false);
        for (const l of payload.locations) expect(near(l.cell)).toBe(false);
        expect(near(payload.goal_cell)).toBe(false);
    });

    it('the payload is exactly what the declaration says (the engine\'s fogEnabled stamped as it would be)', () => {
        const { payload } = payloadOf();
        const fields = sidecarFieldsOf(ENTRY);
        expect(sidecarPayloadErrors(fields, { ...payload, fogEnabled: true })).toEqual([]);
    });

    it('⛓ the round trip closes: serialize(deserialize(p)) = p, and the world is a clone', () => {
        const { payload } = payloadOf();
        const world = ENTRY.deserializeWorld(payload);
        expect(world.exits).toBeInstanceOf(Map);
        expect([...world.exits.keys()]).toEqual(['a', 'b', 'c', 'parent']);
        // the binding reads the DOOR off `exit_id`
        expect(world.exits.get('a').exit_id).toBe(payload.exits[0].exit_id);
        expect(world.level).toBe(2);
        const again = ENTRY.serializeWorld({ ...world, region_id: 'gen_probe' },
            ENTRY.extractPathsAndObstacles(world, { regionId: 'gen_probe' }), null, null, {});
        expect(again).toEqual(payload);
        world.record.entities.push({ type: 'x' });
        expect(payload.record.entities.some((e) => e.type === 'x')).toBe(false);
    });

    it('manaEnabled rides onto the world (the G2a-fix law); a non-room is refused by name', () => {
        const { payload } = payloadOf();
        expect(ENTRY.deserializeWorld({ ...payload, manaEnabled: true, fogEnabled: true }).manaEnabled).toBe(true);
        expect('manaEnabled' in ENTRY.deserializeWorld(payload)).toBe(false);
        expect(() => deserializeGenRoom({ tiles: [], exits: [] })).toThrow(/not a generated Seedling room — it lacks `gameId`/);
        expect(genRoomRefusal({ ...payload, tiles: [] })).toMatch(/it carries `tiles`, which a room does not have/);
        expect(genRoomRefusal([])).toMatch(/not an object/);
    });
});

describe('the per-region generation knobs', () => {
    it('the bag\'s defaults are the room\'s, and buildRegionParams hands them over under `seedlingGen`', () => {
        expect(ENTRY.defaultProcgenParams).toBe(DEFAULT_SEEDLING_GEN_PROCGEN_PARAMS);
        expect(buildSeedlingGenRegionParams({ params: {} })).toEqual({ seedlingGen: { ...GEN_ROOM_DEFAULTS, saturationK: undefined } });
        const p = buildSeedlingGenRegionParams({ params: { seedlingGenObstacleTarget: 2, seedlingGenFill: 'shell' } });
        expect(p.seedlingGen).toMatchObject({ obstacleTarget: 2, fill: 'shell', biome: 'pre-sword' });
    });

    it('procgenParamsFromPayload reads the payload\'s `generation` back into the bag', () => {
        const core = build(EXITS, { params: buildSeedlingGenRegionParams({ params: { seedlingGenObstacleTarget: 4 } }) });
        const payload = ENTRY.serializeWorld(core.world, ENTRY.extractPathsAndObstacles(core.world, {}), null, null, {});
        expect(seedlingGenProcgenParamsFromPayload(payload)).toMatchObject({ seedlingGenObstacleTarget: 4, seedlingGenBiome: 'pre-sword' });
        expect(seedlingGenProcgenParamsFromPayload({})).toEqual({});
    });
});
