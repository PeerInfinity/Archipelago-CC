/**
 * The shared LEVEL WORLD projection (tile-primitives Stage 2, session tile-primitives-stage2-l15): Seedling
 * L15 from the playthrough atlas — its entity rows read off the semantics tables, its ownership off the
 * atlas's persisted partition — and the committed `seedling_playthrough_maze` preset still IS its compile.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { projectRegionToMaze, projectLevelWorld, levelHasInteraction, MAZE_TILE_FLOOR } from './regionAtlasMazeProjection.js';
import { seedlingMazeProjectionDeps, seedlingLevelEntities } from '../flashPanel/seedlingAtlasAnalysis.js';
import { buildPlaythroughMaze, OUT_FILE, LEVELS } from '../../../scripts/procgen/make-seedling-playthrough-maze.mjs';

const J = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const ATLAS = J('../flashPanel/atlases/seedling-playthrough.json');
const MAP = J('../flashPanel/atlases/seedling-map.json');
const CONFIG = J('../flashPanel/games/seedling.json');
const PARTITION = J('../flashPanel/atlases/seedling-subregion-partition.json').atlases[ATLAS.atlas_id];
const L15 = ATLAS.regions.find((r) => r.region_id === 'level_15');
const LEVEL15 = MAP.levels.find((l) => l.level === 15);

const ctxFor = (deps) => ({
    ...deps,
    wiredExit: () => undefined,
    internalExitName: (r, f, t) => `${r}__${f} -> ${r}__${t}`,
    tileSize: 16,
});

describe('Seedling level-world entity rows — from the semantics tables', () => {
    it('L15: one block, one button and one lock of group 0, two rocks struck by sword or spear', () => {
        const deps = seedlingMazeProjectionDeps({ mapDoc: MAP, gameConfig: CONFIG });
        const rows = seedlingLevelEntities(LEVEL15, deps.resolveCondition);
        expect(rows.map(({ label, ...r }) => r)).toEqual([
            { kind: 'block', tiles: [[4, 4]] },
            { kind: 'rock', tiles: [[6, 5]], strike: [{ action: 'sword', item: 'Progressive Sword' }, { action: 'spear', item: 'Ghost Spear' }] },
            { kind: 'rock', tiles: [[6, 1]], strike: [{ action: 'sword', item: 'Progressive Sword' }, { action: 'spear', item: 'Ghost Spear' }] },
            { kind: 'button', tiles: [[7, 2]], group: '0' },
            { kind: 'lock', tiles: [[8, 3]], group: '0' },
        ]);
        expect(levelHasInteraction(rows)).toBe(true);
        expect(levelHasInteraction(rows.filter((r) => r.kind === 'lock'))).toBe(false);
        expect(levelHasInteraction(null)).toBe(false);
    });

    it('level worlds are OPT-IN: deps built without `levelWorlds` never ask for entity rows', () => {
        const plain = seedlingMazeProjectionDeps({ mapDoc: MAP, gameConfig: CONFIG });
        expect('levelEntitiesFor' in plain).toBe(false);
        expect('partitionFor' in plain).toBe(false);
    });
});

describe('projectLevelWorld — L15', () => {
    const deps = seedlingMazeProjectionDeps({ mapDoc: MAP, gameConfig: CONFIG, levelWorlds: { partition: PARTITION } });
    const grid = deps.gridFor(L15);
    const out = projectRegionToMaze(L15, grid, ctxFor(deps));
    const payload = out.sidecars.level_15__r1c5.playable_payload;
    const at = (x, y) => payload.tiles[y * payload.width + x];

    it('one carrier + two aliases, every AP region name kept', () => {
        expect(out.sharedWorld).toBe('level_15');
        expect(Object.keys(out.sidecars)).toEqual(['level_15__r1c5', 'level_15__r1c9', 'level_15__r6c8']);
        expect(out.sidecars.level_15__r1c9).toEqual({ substrate: 'maze', shared_world: 'level_15' });
    });

    it('every gated terrain cell is floor carrying its own rule; water = Has(Progressive Swim)', () => {
        const lib = payload.obstacleLib;
        const gated = [];
        for (let y = 0; y < grid.height; y += 1) {
            for (let x = 0; x < grid.width; x += 1) {
                if (grid.cells[y * grid.width + x].labels?.includes('water')) gated.push([x, y]);
            }
        }
        expect(gated.length).toBeGreaterThan(0);
        for (const [x, y] of gated) {
            expect(at(x, y)).toBe(MAZE_TILE_FLOOR);
            const o = payload.obstacles.find((p) => p.x === x && p.y === y);
            expect(lib[o.id].clear_rule).toEqual({ rule: 'Has', args: { item_name: 'Progressive Swim' } });
        }
    });

    it('the rocks are strike obstacles and the lock is held by the button\'s token', () => {
        const idAt = (x, y) => payload.obstacles.find((p) => p.x === x && p.y === y)?.id;
        expect(payload.obstacleLib[idAt(6, 5)]).toMatchObject({ clear_set: [], struck_by: ['sword', 'spear'] });
        expect(idAt(6, 1)).toBe(idAt(6, 5));
        expect(payload.obstacleLib[idAt(8, 3)].clear_set).toEqual([['sw_0']]);
        expect(payload.buttonLib).toEqual({ button_0: { kind: 'button', holds: 'sw_0' } });
        expect(payload.action_lib.sword).toEqual({ item: 'Progressive Sword', primitive: 'strike', condition: 'strikes', key: 'z' });
        expect(payload.action_lib.spear.key).toBe('x');
    });

    it('ownership = the partition on every floor cell, "no news" elsewhere', () => {
        const part = PARTITION.regions.level_15;
        for (let y = 0; y < payload.height; y += 1) {
            for (let x = 0; x < payload.width; x += 1) {
                const want = at(x, y) === MAZE_TILE_FLOOR ? part.rows[y][x] : '.';
                expect(payload.shared_world.rows[y][x], `(${x},${y})`).toBe(want);
            }
        }
        expect(payload.shared_world.entrances).toEqual({
            level_15__r1c5: { x: 3, y: 4 }, level_15__r1c9: { x: 9, y: 1 }, level_15__r6c8: { x: 8, y: 6 },
        });
    });

    it('refuses by name: no partition, a stale partition, a rock nothing strikes', () => {
        const ctx = ctxFor(deps);
        const rows = seedlingLevelEntities(LEVEL15, deps.resolveCondition);
        expect(() => projectLevelWorld(L15, grid, { ...ctx, partitionFor: () => null }, rows))
            .toThrow(/no persisted partition/);
        expect(() => projectLevelWorld(L15, grid, {
            ...ctx, partitionFor: () => ({ ...PARTITION.regions.level_15, sub_regions: ['r1c5', 'r1c9', 'r3c1', 'r6c8'] }),
        }, rows)).toThrow(/partition holds \[r1c5, r1c9, r3c1, r6c8\].*stale/);
        expect(() => projectLevelWorld(L15, grid, ctx, [{ kind: 'rock', tiles: [[6, 5]], strike: [], label: 'r' }]))
            .toThrow(/names no item that strikes it/);
    });
});

describe('the committed seedling_playthrough_maze preset', () => {
    it('is byte-identical to its compile (make-seedling-playthrough-maze.mjs --check)', () => {
        expect(LEVELS).toContain('level_15');
        expect(readFileSync(OUT_FILE, 'utf8')).toBe(buildPlaythroughMaze().text);
    }, 60_000);
});
