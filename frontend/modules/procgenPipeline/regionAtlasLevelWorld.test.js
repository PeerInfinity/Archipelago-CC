/**
 * The shared LEVEL WORLD projection (tile-primitives Stage 2, session tile-primitives-stage2-l15): Seedling
 * L15 from the playthrough atlas — its entity rows read off the semantics tables, its ownership off the
 * atlas's persisted partition — and the committed `seedling_playthrough_maze` preset still IS its compile.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    projectRegionToMaze, projectLevelWorld, levelHasInteraction, MAZE_TILE_FLOOR, SHARED_WORLD_ALPHABET,
} from './regionAtlasMazeProjection.js';
import { seedlingMazeProjectionDeps, seedlingLevelEntities } from '../flashPanel/seedlingAtlasAnalysis.js';
import {
    buildPlaythroughMaze, OUT_FILE, LEVELS, restrictAtlas,
} from '../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import {
    PLAYTHROUGH_MAP, playthroughGridFor, playthroughAnalyzerOptions,
} from '../../../scripts/procgen/make-seedling-playthrough-rules.mjs';
import { compileRegionAtlas } from './regionAtlasCompiler.js';
import { deserializeMazeWorld } from '../mazeRoom/mazeRoomEngine.js';
import { nativeReachUnder } from '../mazeRoom/tileSpike/deriveLevelWorldLogic.js';
import { regionItems } from '../mazeRoom/tileSpike/deriveTileLogic.js';

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

/**
 * ⚖ "Atlas's own grid" (user, 2026-10-21; session tile-primitives-levels-gap3). The playthrough atlas was
 * analysed on its generator's OVERLAY grid over the DELIVERED rooms; the projection recomputes on exactly
 * that, so its stale check is a real one (measured at the slice: 45 regions refused on the raw transcription).
 */
describe('the atlas\'s own grid — every playthrough region, compiled alone', () => {
    const ownGrid = {
        gridForLevel: (level) => playthroughGridFor(level),
        conditionKey: playthroughAnalyzerOptions.conditionKey,
        resolveCondition: playthroughAnalyzerOptions.resolveCondition,
    };
    const deps = seedlingMazeProjectionDeps({
        mapDoc: PLAYTHROUGH_MAP, gameConfig: CONFIG, levelWorlds: { partition: PARTITION }, analysis: ownGrid,
    });
    const compileAlone = (id) => compileRegionAtlas(restrictAtlas(ATLAS, [id]), {
        mapDoc: MAP, embedSphereLog: true, sidecarFlavor: 'maze', mazeProjection: deps,
    });

    it('every region projects but the ghost rocks, which refuse by name (an And has no single strike item)', () => {
        const refused = {};
        for (const r of ATLAS.regions) {
            try { compileAlone(r.region_id); } catch (e) { refused[r.region_id] = e.message; }
        }
        expect(Object.keys(refused)).toEqual(['level_3', 'level_101']);
        for (const m of Object.values(refused)) expect(m).toMatch(/hasGhostSword.*not one Has — a strike needs exactly one item/);
    }, 120_000);

    // ⛓ RULES l55-waterfall: L50 and L52 are FLOORED by their entry gate now (Swim, charged at every door), so the
    // all-water level this row reads is L57 — its bindings stand on mixed gates (the tentacle beast), so no floor.
    it('an ALL-WATER level the entry gate does not floor (L57) is one level world, its water Swim', () => {
        const { rules } = compileAlone('level_57');
        const sc = rules.preset_sidecars['1'].level_57;
        expect(sc.shared_world).toBe('level_57');
        const p = sc.playable_payload;
        expect(p.shared_world.regions).toEqual(['level_57']);
        const floor = p.tiles.filter((t) => t === MAZE_TILE_FLOOR).length;
        expect(floor).toBeGreaterThan(0);
        const rules_ = new Set(p.obstacles.map((o) => JSON.stringify(p.obstacleLib[o.id].clear_rule ?? p.obstacleLib[o.id].clear_set)));
        expect([...rules_].some((r) => r.includes('Progressive Swim'))).toBe(true);
    });

    it('an all-water level FLOORED by its entry gate projects as plain regions: L50 one, L52 its three pools', () => {
        const fifty = compileAlone('level_50').rules.preset_sidecars['1'].level_50;
        expect(fifty.shared_world).toBeUndefined();
        expect(fifty.playable_payload.obstacles).toEqual([]);
        const pools = compileAlone('level_52').rules.preset_sidecars['1'];
        expect(Object.keys(pools).sort()).toEqual(['level_52__r0c7', 'level_52__r2c2', 'level_52__r5c10']);
        // The top pool climbs nothing; the middle and bottom pools climb a waterfall: the Feather.
        const climbs = (id) => [...new Set(pools[id].playable_payload.obstacles
            .map((o) => JSON.stringify(pools[id].playable_payload.obstacleLib[o.id].clear_rule)))];
        expect(climbs('level_52__r0c7')).toEqual([]);
        for (const id of ['level_52__r2c2', 'level_52__r5c10']) {
            expect(climbs(id)).toEqual([JSON.stringify({ rule: 'Has', args: { item_name: 'Progressive Swim', count: 2 } })]);
        }
    });

    it('a level world emits no ARRIVAL-ONLY exit: a landing spot is not a trigger (it would end a walk)', () => {
        const { rules, report } = compileRegionAtlas(restrictAtlas(ATLAS, ['level_15', 'level_16']), {
            mapDoc: MAP, embedSphereLog: true, sidecarFlavor: 'maze', mazeProjection: deps,
        });
        const p = rules.preset_sidecars['1'].level_15__r1c5.playable_payload;
        expect(p.exits.map((e) => e.atlas_exit_id)).toEqual(['out_stairsdown_144_16']);
        expect(p.exits.every((e) => e.exit_id && e.targetRegion)).toBe(true);
        expect(JSON.stringify(report)).toMatch(/arrival_only_not_emitted/);
    });

    /**
     * …nor does a PER-SUB-REGION world (session tile-primitives-grow-levels). L10 is no level world, and its
     * arrival from L9 (`in_L9_16_0`, (3,5)) sits in the only corridor to the Sword chest and the stairs back
     * to L9: emitted as an exit tile it was a dead end, and with L9 wired the engine's walk never passed it —
     * measured on the whole playthrough, 5 such seals (L1, L6, L9, L10, L11), here the Sword location too.
     */
    it('a per-sub-region world emits no ARRIVAL-ONLY exit either: L10\'s landing from L9 sealed the Sword', () => {
        const { rules, report } = compileRegionAtlas(restrictAtlas(ATLAS, ['level_9', 'level_10', 'level_11']), {
            mapDoc: MAP, embedSphereLog: true, sidecarFlavor: 'maze', mazeProjection: deps,
        });
        const p = rules.preset_sidecars['1'].level_10.playable_payload;
        expect(p.shared_world).toBeUndefined();
        expect(p.exits.every((e) => e.exit_id && e.targetRegion)).toBe(true);
        expect(report.maze_notes.filter((n) => n.region_id === 'level_10' && n.kind === 'arrival_only_not_emitted')
            .map((n) => n.tile)).toEqual([[3, 5], [3, 2]]);
        const world = deserializeMazeWorld(p);
        const reach = nativeReachUnder(world, regionItems(world));
        const sword = p.items.find((i) => i.locationName === 'Level 010 - Sword');
        const back = p.exits.find((e) => e.targetRegion === 'level_9');
        expect(reach.cells.has(`${sword.x},${sword.y}`)).toBe(true);
        expect(reach.cells.has(`${back.x},${back.y}`)).toBe(true);
    });

    /**
     * ⚖ "Own opened exit cells" (session tile-primitives-grow-levels). L16's seven pits to L17 stand on sink
     * cells the atlas's partition does not own; opened as exits they had NO owner, so no AP region held the
     * crossing (the certifier priced 1 of 8). Each now belongs to the sub-region the atlas binds it to.
     */
    it('a level-world exit on a cell the partition does not own belongs to its bound sub-region (L16\'s pits)', () => {
        const { rules } = compileRegionAtlas(restrictAtlas(ATLAS, ['level_16', 'level_17']), {
            mapDoc: MAP, embedSphereLog: true, sidecarFlavor: 'maze', mazeProjection: deps,
        });
        const p = rules.preset_sidecars['1'].level_16__r1c1.playable_payload;
        const pits = p.exits.filter((e) => e.atlas_exit_id.startsWith('out_pit_'));
        expect(pits).toHaveLength(7);
        // ⛓ rules-rope-events: the L16 rope lane splits the level, and the atlas binds the pits to r1c9 (past the lane).
        const r1c9 = SHARED_WORLD_ALPHABET[p.shared_world.regions.indexOf('level_16__r1c9')];
        for (const e of pits) expect(p.shared_world.rows[e.y][e.x], `pit ${e.atlas_exit_id}`).toBe(r1c9);
    });

    it('CONTROL: the raw transcription is refused where the overlay moves a tile (L12\'s chest), by the partition check', () => {
        const raw = seedlingMazeProjectionDeps({ mapDoc: MAP, gameConfig: CONFIG, levelWorlds: { partition: PARTITION } });
        const l12 = ATLAS.regions.find((r) => r.region_id === 'level_12');
        expect(() => projectRegionToMaze(l12, raw.gridFor(l12), ctxFor(raw)))
            .toThrow(/"r42c29" computes 226 tile\(s\) but the persisted partition holds 227/);
        expect(() => projectRegionToMaze(l12, deps.gridFor(l12), ctxFor(deps))).not.toThrow();
    });
});

/**
 * ⛓⛓ ARROW TRAPS + ROPES (session tile-primitives-arrow-rope, ⚖ 2026-10-22 "New `traps` primitive", "Strike the
 * facing rope"). The rows come from the game's own tables and lane function; the projected lane must be the
 * atlas's — every cell the atlas charged with the rope's event, plus only the door tiles the analyzer leaves open.
 */
describe('arrow traps and ropes — the game\'s rows, the atlas\'s lane', () => {
    const ROPE = 'L16 flag 0: rope@32,16 cleared';
    const levelOf = (n) => PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
    const rowsOf = (n) => seedlingLevelEntities(levelOf(n), playthroughAnalyzerOptions.resolveCondition,
        { grid: playthroughGridFor(levelOf(n)) });

    it('L16: the minted rope (sword | spear | fire, its event) and three shoot=1 traps silenced by it', () => {
        const rows = rowsOf(16);
        const rope = rows.find((r) => r.kind === 'rope');
        expect(rope).toMatchObject({ tiles: [[2, 1]], group: '0', event: ROPE, label: 'rope@32,16' });
        expect(rope.strike.map((s) => s.item)).toEqual(['Progressive Sword', 'Ghost Spear', 'Fire']);
        const traps = rows.filter((r) => r.kind === 'trap');
        expect(traps.map((t) => [t.label, t.fires, t.group])).toEqual([
            ['arrowtrap@96,32', 'unless_active', '0'], ['arrowtrap@112,32', 'unless_active', '0'], ['arrowtrap@128,32', 'unless_active', '0'],
        ]);
        for (const t of traps) expect(t.charges).toEqual([{ event: ROPE }]);
    });

    it('the CLASS beyond the preset: shoot=0 traps arm while pressed (L4), L67\'s shoot=1 trap has no rope, L39\'s refused rope is no row', () => {
        expect(rowsOf(4).filter((r) => r.kind === 'trap').map((t) => [t.fires, t.charges])).toEqual([['while_active', []], ['while_active', []]]);
        expect(rowsOf(67).filter((r) => r.kind === 'trap').map((t) => [t.fires, t.charges])).toEqual([['unless_active', []]]);
        expect(rowsOf(39).some((r) => r.kind === 'rope')).toBe(false);
    });

    it('the projected L16 lane = the cells the atlas charged with the rope\'s event + the door tiles it leaves open', () => {
        const p = buildPlaythroughMaze({ levels: ['level_15', 'level_16', 'level_17'] }).text;
        const payload = JSON.parse(p).preset_sidecars['1'].level_16__r1c1.playable_payload;
        const lane = new Set(payload.traps.flatMap((t) => t.lane.map((c) => `${c.x},${c.y}`)));
        const grid = playthroughGridFor(levelOf(16));
        const charged = new Set();
        grid.cells.forEach((c, i) => {
            if ((c.conditions ?? []).some((k) => k?.event === ROPE)) charged.add(`${i % grid.width},${Math.floor(i / grid.width)}`);
        });
        expect(charged.size).toBeGreaterThan(0);
        for (const k of charged) expect(lane.has(k), k).toBe(true);
        const doors = new Set(ATLAS.regions.find((r) => r.region_id === 'level_16').exits.map((e) => `${e.entrance_tile[0]},${e.entrance_tile[1]}`));
        const extra = [...lane].filter((k) => !charged.has(k));
        expect(extra.length).toBeGreaterThan(0);
        for (const k of extra) expect(doors.has(k), `${k} is in the lane but neither charged nor a door`).toBe(true);
        // The trap MODELS the charge: no obstacle of the world names the rope's event; the rope is struck.
        for (const o of payload.obstacles) expect(JSON.stringify(payload.obstacleLib[o.id].clear_rule ?? null)).not.toContain(ROPE);
        expect(payload.obstacleLib.rope_2_1).toMatchObject({ kind: 'rope', struck_by: ['sword', 'spear', 'fire'], activates: 'sw_0', event: ROPE });
        expect(payload.action_lib.fire).toMatchObject({ item: 'Fire', primitive: 'strike', key: 'c' });
        // …and the rope's cell is r1c1's, the one sub-region it borders (the rules' PLACE rule).
        expect(payload.shared_world.rows[1][2]).toBe(SHARED_WORLD_ALPHABET[payload.shared_world.regions.indexOf('level_16__r1c1')]);
    }, 120_000);
});

describe('the committed seedling_playthrough_maze preset', () => {
    it('is byte-identical to its compile (make-seedling-playthrough-maze.mjs --check)', () => {
        expect(LEVELS).toContain('level_15');
        expect(readFileSync(OUT_FILE, 'utf8')).toBe(buildPlaythroughMaze().text);
    }, 60_000);
});
