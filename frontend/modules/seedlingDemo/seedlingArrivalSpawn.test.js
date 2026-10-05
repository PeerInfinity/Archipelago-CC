/**
 * seedlingArrivalSpawn — WHERE AN ARRIVAL MAY STAND (RULES arrival-spawns).
 *
 * solver-walk S5's census found the region binding's `entrance_spawn` FALLBACK
 * landing the player where the game never does: inside L34's magical lock,
 * over L43's and L100's pits, on L58's dead door. The spawn is the atlas
 * exit's `entrance_tile`, and for a DEPARTURE door that is the door tile. The
 * playthrough generator now hands the compiler `seedlingArrivalSpawn`: a
 * connection's LANDING keeps the game's own point; a door keeps its tile when
 * the model can stand there, else the game's landing beside it (the reverse
 * link), else its approach cell, else a named refusal.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 `arrivalStandRefusal` drops the PIT check
 *        -> 3 red: 'a door over a pit', 'takes its approach cell' (L43 keeps
 *           its pit tile) and 'a pit field's INNER pit'. The committed sweep
 *           stays green under it — it reads the COMMITTED spawns through the
 *           mutated predicate, which then refuses nothing — so the pit rows
 *           are the catchers, not the sweep.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    APPROACH_RING_LIMIT, arrivalStandRefusal, seedlingArrivalSpawn,
} from './seedlingModelOracles.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const ATLAS = readJson('frontend/modules/flashPanel/atlases/seedling-playthrough.json');
const RULES = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
const levelOf = (n) => MAP.levels.find((l) => l.level === n);
const exitOf = (level, exitId) => ATLAS.regions.find((r) => r.map_ref === level)
    .exits.find((e) => e.exit_id === exitId);
const px = ([tx, ty]) => ({ x: tx * MAP.tile_size, y: ty * MAP.tile_size });

describe('arrivalStandRefusal — the model\'s three refusals', () => {
    it('a lock over the door: inside a solid (L34 (128,0), the S5 lock artefact)', () => {
        expect(arrivalStandRefusal(levelOf(34), 128, 0)).toBe('inside a solid (MagicalLock)');
    });
    it('a door over a pit: every boot falls (L43 (144,64), L100 (288,96), L58 (80,16))', () => {
        expect(arrivalStandRefusal(levelOf(43), 144, 64)).toBe('over a pit at tile (9, 4)');
        expect(arrivalStandRefusal(levelOf(100), 288, 96)).toBe('over a pit at tile (18, 6)');
        expect(arrivalStandRefusal(levelOf(58), 80, 16)).toBe('over a pit at tile (5, 1)');
    });
    it('a door that is not live (a tagged, non-inverted teleporter at boot)', () => {
        // L101's (104,24) door is live (tag -1); the same room with that door tagged is not.
        const live = levelOf(101);
        expect(arrivalStandRefusal(live, 96, 16)).toBeNull();
        const dead = structuredClone(live);
        dead.entities.find((e) => e.type === 'teleporter' && e.x === 104 && e.y === 24).attrs.tag = '1';
        expect(arrivalStandRefusal(dead, 96, 16)).toBe('on a door that is not live (the teleporter at (104, 24), tag 1)');
    });
    it('a LIVE door is standable — the walker steps off it (S5\'s crossing rooms)', () => {
        for (const [level, x, y] of [[101, 96, 16], [106, 64, 48], [109, 160, 48]]) {
            expect(arrivalStandRefusal(levelOf(level), x, y), `L${level}`).toBeNull();
        }
    });
});

describe('seedlingArrivalSpawn — landing, entrance, return link, approach, refusal', () => {
    it('a LANDING keeps the game\'s own point, even inside a model solid (L12 from L83: the lock\'s far side)', () => {
        const exit = exitOf(12, 'in_L83_32_64');
        expect(arrivalStandRefusal(levelOf(12), 32, 864)).toBe('inside a solid (MagicalLock)');
        expect(seedlingArrivalSpawn(levelOf(12), exit, px(exit.entrance_tile), { landing: true }))
            .toEqual({ x: 32, y: 864, via: 'landing' });
    });
    it('a door the model can stand on keeps its tile (L101: S5\'s crossing room is unchanged)', () => {
        const exit = exitOf(101, 'out_teleporter_104_24');
        expect(seedlingArrivalSpawn(levelOf(101), exit, px(exit.entrance_tile)))
            .toEqual({ x: 96, y: 16, via: 'entrance' });
    });
    it('a door in a solid with the game\'s landing beside it takes that landing (L3\'s rock door)', () => {
        const exit = exitOf(3, 'out_teleporter_0_64');
        expect(seedlingArrivalSpawn(levelOf(3), exit, px(exit.entrance_tile), { returnSpawn: { x: 16, y: 64 } }))
            .toEqual({ x: 16, y: 64, via: 'return-link', why: 'inside a solid (BreakableRock)' });
    });
    it('a door with no landing beside it takes its approach cell (L34 lock, L43 pit)', () => {
        const lock = exitOf(34, 'out_teleporter_128_0');
        expect(seedlingArrivalSpawn(levelOf(34), lock, px(lock.entrance_tile)))
            .toEqual({ x: 128, y: 16, via: 'approach', why: 'inside a solid (MagicalLock)' });
        const pit = exitOf(43, 'out_teleporter_144_64');
        expect(seedlingArrivalSpawn(levelOf(43), pit, px(pit.entrance_tile)))
            .toEqual({ x: 144, y: 48, via: 'approach', why: 'over a pit at tile (9, 4)' });
    });
    it('a pit field\'s INNER pit reaches past its ring of pits (L16 (8,3), within the ring limit)', () => {
        const exit = exitOf(16, 'out_pit_8_3');
        const s = seedlingArrivalSpawn(levelOf(16), exit, px(exit.entrance_tile));
        expect(s.via).toBe('approach');
        expect(arrivalStandRefusal(levelOf(16), s.x, s.y)).toBeNull();
        const [ex, ey] = exit.entrance_tile;
        expect(Math.abs(s.x / 16 - ex) + Math.abs(s.y / 16 - ey)).toBeLessThanOrEqual(APPROACH_RING_LIMIT);
    });
    it('the approach stays in the exit\'s own component; none → REFUSED by name', () => {
        const exit = exitOf(34, 'out_teleporter_128_0');
        expect(() => seedlingArrivalSpawn(levelOf(34), exit, px(exit.entrance_tile), { inComponent: () => false }))
            .toThrow('level 34: exit "out_teleporter_128_0" has no arrival spawn the game could put the player on '
                + '— its entrance (128, 0) is inside a solid (MagicalLock), no reverse link lands beside it, and no '
                + `cell within ${APPROACH_RING_LIMIT} tiles of it is standable in its own component`);
    });
});

describe('the committed playthrough sidecars (derived over every exit)', () => {
    const exits = Object.values(RULES.preset_sidecars['1'])
        .map((s) => s.playable_payload)
        .flatMap((pl) => pl.exits.map((e) => ({ level: pl.level, e })));

    it('every DEPARTURE door\'s spawn is one the model can stand on', () => {
        // A landing is the arrival end of a one-way connection: no AP exit name.
        const doors = exits.filter(({ e }) => e.exitName !== null);
        expect(doors.length).toBeGreaterThan(300);
        const bad = doors.map(({ level, e }) => [level, e.exit_id, arrivalStandRefusal(levelOf(level), e.entrance_spawn.x, e.entrance_spawn.y)])
            .filter(([, , why]) => why !== null);
        expect(bad).toEqual([]);
    });
    it('every LANDING keeps its entrance tile (the game\'s own point)', () => {
        const landings = exits.filter(({ e }) => e.exitName === null);
        expect(landings.length).toBeGreaterThan(300);
        for (const { e } of landings) expect(e.entrance_spawn, e.exit_id).toEqual(px(e.entrance_tile));
    });
});

describe('compileRegionAtlas — the `arrivalSpawn` hook', () => {
    const tiny = {
        schema_version: 1, atlas_id: 'arrival-hook', game: 'seedling', tile_space: { tile_size: 16 },
        regions: [
            { region_id: 'a', bounds: { x: 0, y: 0, w: 4, h: 4 }, map_ref: 0,
                exits: [{ exit_id: 'out', kind: 'teleporter', exit_tiles: [[1, 1]], entrance_tile: [1, 1] }] },
            { region_id: 'b', bounds: { x: 0, y: 0, w: 4, h: 4 }, map_ref: 1,
                exits: [{ exit_id: 'in', kind: 'teleporter', exit_tiles: [[2, 2]], entrance_tile: [2, 2] }] },
        ],
        vanilla_layout: { start_region: 'a', connections: [{ from: ['a', 'out'], to: ['b', 'in'], one_way: true }] },
    };
    const spawns = (rules) => Object.fromEntries(Object.values(rules.preset_sidecars['1'])
        .flatMap((s) => s.playable_payload.exits.map((e) => [e.exit_id, e.entrance_spawn])));

    it('without it, the entrance tile in pixels (the default is unchanged)', () => {
        expect(spawns(compileRegionAtlas(tiny, { allowInvalid: true }).rules))
            .toEqual({ out: { x: 16, y: 16 }, in: { x: 32, y: 32 } });
    });
    it('with it, the hook\'s answer, told which exit is a landing', () => {
        const seen = [];
        const { rules } = compileRegionAtlas(tiny, {
            allowInvalid: true,
            arrivalSpawn: (region, exit, ctx) => {
                seen.push([region.region_id, exit.exit_id, ctx.landing, ctx.entranceSpawn]);
                return ctx.landing ? ctx.entranceSpawn : { x: 0, y: 0 };
            },
        });
        expect(spawns(rules)).toEqual({ out: { x: 0, y: 0 }, in: { x: 32, y: 32 } });
        expect(seen).toEqual([['a', 'out', false, { x: 16, y: 16 }], ['b', 'in', true, { x: 32, y: 32 }]]);
    });
    it('a hook that answers no position is refused by name', () => {
        expect(() => compileRegionAtlas(tiny, { allowInvalid: true, arrivalSpawn: () => null }))
            .toThrow('options.arrivalSpawn returned no {x, y} for a/out');
    });
});
