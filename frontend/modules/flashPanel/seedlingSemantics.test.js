// Census guard for the Seedling semantics tables
// (CC/docs/plans/region-atlas-plan.md, Phase 5a, Deliverable 1).
//
// seedlingSemantics.js is a TRANSCRIPTION of source that lives outside this
// repo, so a diff cannot catch drift. This suite is the alarm instead: every
// tileset column and every entity tag the COMMITTED extract contains has to be
// classified, and the table sizes are pinned to what the source declares. A gap
// is a red test, never a silently skipped tile.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    SEEDLING_TILE_SIZE,
    TILE_TYPE_NAMES,
    TILE_TYPE_ENTITY_TYPES,
    TILE_COLUMN_TO_TYPE,
    TILE_COLUMN_VARIANTS,
    TILE_TYPE_SEMANTICS,
    SOLID_ENTITY_TYPES,
    ENTITY_SEMANTICS,
    LEVEL_PROPERTY_TAGS,
    CELL_KINDS,
    tileTypeForColumn,
    tileTypeForPlacement,
    tileSemantics,
    entitySemantics,
    entityFootprint,
    entityPixelRect,
    entitySealedTiles,
    entityStrandedTiles,
    cliffSideSemantics,
    isLevelPropertyTag,
    buildFlagItemRules,
    resolveCondition,
    conditionKey,
    buildSeedlingRegionGrid,
    flag,
    key,
    anyOf,
    allOf,
} from './seedlingSemantics.js';

const MAP = JSON.parse(readFileSync(
    fileURLToPath(new URL('./atlases/seedling-map.json', import.meta.url)), 'utf8',
));
const GAME_CONFIG = JSON.parse(readFileSync(
    fileURLToPath(new URL('./games/seedling.json', import.meta.url)), 'utf8',
));

const levelById = (id) => MAP.levels.find((l) => l.level === id);

describe('tile tables mirror the source', () => {
    it('has 38 tile types, 13 of them solid (Tile.as:23-26)', () => {
        expect(TILE_TYPE_NAMES).toHaveLength(38);
        expect(TILE_TYPE_ENTITY_TYPES).toHaveLength(38);
        expect(TILE_TYPE_ENTITY_TYPES.filter((t) => t === 'Solid')).toHaveLength(13);
        // Bridge is the one type whose table entry is not its real behaviour:
        // it rewrites `type` every frame from its opening timer.
        expect(TILE_TYPE_ENTITY_TYPES[29]).toBe('Unused');
        expect(TILE_TYPE_SEMANTICS[29].kind).toBe('gated');
    });

    it('has 45 tileset columns (the switch at Game.as:1909-2004)', () => {
        expect(TILE_COLUMN_TO_TYPE).toHaveLength(45);
        // Columns 27-32 all build a waterfall with different cosmetic flags.
        for (const col of [27, 28, 29, 30, 31, 32]) expect(TILE_COLUMN_TO_TYPE[col]).toBe(25);
        expect(Object.keys(TILE_COLUMN_VARIANTS).map(Number).sort((a, b) => a - b))
            .toEqual([0, 9, 27, 28, 29, 30, 31, 32]);
    });

    it('names every tile type a column can build', () => {
        for (const t of TILE_COLUMN_TO_TYPE) expect(typeof TILE_TYPE_NAMES[t]).toBe('string');
    });

    it('gives every tile type a known cell kind', () => {
        for (let t = 0; t < TILE_TYPE_NAMES.length; t += 1) {
            expect(CELL_KINDS).toContain(tileSemantics(t).kind);
        }
    });

    it('derives solidity from Mobile.solids, so enemies never block', () => {
        expect(SOLID_ENTITY_TYPES).toEqual(['Solid', 'Tree', 'Rock', 'Rope', 'ShieldBoss']);
        expect(SOLID_ENTITY_TYPES).not.toContain('Enemy');
        expect(tileSemantics(2).kind).toBe('wall'); // Stone
        expect(tileSemantics(0).kind).toBe('open'); // Ground
    });

    it('reads the column from tx alone, ignoring ty', () => {
        expect(tileTypeForColumn(2)).toBe(1); // water
        expect(tileTypeForPlacement([4, 5, 2 * SEEDLING_TILE_SIZE, 0])).toBe(1);
        expect(tileTypeForPlacement([4, 5, 2 * SEEDLING_TILE_SIZE, 7 * SEEDLING_TILE_SIZE])).toBe(1);
        expect(tileTypeForColumn(45)).toBeNull();
    });
});

describe('census: the committed extract is fully classified', () => {
    it('maps every tileset column that appears in seedling-map.json', () => {
        const columns = new Set();
        const tys = new Set();
        for (const level of MAP.levels) {
            for (const layer of level.layers) {
                if (layer.name === 'cliffsides') continue;
                for (const [, , tx, ty] of layer.tiles) {
                    columns.add(Math.floor(tx / SEEDLING_TILE_SIZE));
                    tys.add(ty);
                }
            }
        }
        expect(columns.size).toBeGreaterThan(40);
        const unmapped = [...columns].filter((c) => tileTypeForColumn(c) === null);
        expect(unmapped).toEqual([]);
        // Every placement has ty=0 today; if that ever changes the "only tx
        // matters" reading of Game.as deserves a fresh look.
        expect([...tys]).toEqual([0]);
    });

    it('classifies every entity tag in the extract census', () => {
        const tags = Object.keys(MAP.entity_types);
        expect(tags.length).toBe(137);
        const missing = tags.filter((t) => !ENTITY_SEMANTICS[t] && !isLevelPropertyTag(t));
        expect(missing).toEqual([]);
    });

    it('classifies every entity tag actually placed in a level', () => {
        const placed = new Set();
        for (const level of MAP.levels) for (const e of level.entities) placed.add(e.type);
        const missing = [...placed].filter((t) => !ENTITY_SEMANTICS[t] && !isLevelPropertyTag(t));
        expect(missing).toEqual([]);
    });

    it('keeps the level-property tags out of the entity table', () => {
        expect(LEVEL_PROPERTY_TAGS).toHaveLength(7);
        for (const tag of LEVEL_PROPERTY_TAGS) {
            expect(ENTITY_SEMANTICS[tag]).toBeUndefined();
            expect(isLevelPropertyTag(tag)).toBe(true);
        }
        // They really are in the data — this guard would pass vacuously if the
        // extract had stopped recording them.
        for (const tag of LEVEL_PROPERTY_TAGS) expect(MAP.entity_types[tag]).toBeGreaterThan(0);
    });

    it('gives every entity table row a known cell kind and a source class', () => {
        for (const [tag, semantics] of Object.entries(ENTITY_SEMANTICS)) {
            expect(CELL_KINDS, tag).toContain(semantics.kind);
            expect(typeof semantics.class, tag).toBe('string');
            if (semantics.kind === 'gated') {
                expect(semantics.condition ?? semantics.conditionFromAttr, tag).toBeTruthy();
            }
            if (semantics.kind === 'manual') expect(typeof semantics.reason, tag).toBe('string');
        }
    });
});

describe('entity gating', () => {
    it('breaks a plain rock with either weapon and a ghost rock only with the Ghost Sword', () => {
        expect(ENTITY_SEMANTICS.breakablerock.condition)
            .toEqual(anyOf(flag('hasSword'), flag('hasSpear')));
        expect(ENTITY_SEMANTICS.breakablerockghost.condition).toEqual(flag('hasGhostSword'));
    });

    it('opens a magical lock with either wand and a fire lock with only the Fire Wand', () => {
        expect(ENTITY_SEMANTICS.magicallock.condition)
            .toEqual(anyOf(flag('hasWand'), flag('hasFireWand')));
        expect(ENTITY_SEMANTICS.magicallockfire.condition).toEqual(flag('hasFireWand'));
    });

    it('reads a boss lock key index off the placement', () => {
        const s = entitySemantics({ type: 'bosslock', x: 0, y: 0, attrs: { keyType: '3' } });
        expect(s.kind).toBe('gated');
        expect(s.condition).toEqual(key(3));
    });

    it('falls back to hand authoring when a boss lock has no key index', () => {
        const s = entitySemantics({ type: 'bosslock', x: 0, y: 0 });
        expect(s.kind).toBe('manual');
    });

    it('returns null for a level property and for an unknown tag', () => {
        expect(entitySemantics({ type: 'daynight', x: 0, y: 0 })).toBeNull();
        expect(entitySemantics({ type: 'not_a_real_tag', x: 0, y: 0 })).toBeNull();
    });

    it('places a footprint at the Ogmo x/y, sized by the class hitbox', () => {
        expect(entityFootprint({ type: 'tree', x: 32, y: 48 }, ENTITY_SEMANTICS.tree))
            .toEqual({ x: 2, y: 3, w: 2, h: 2 });
        expect(entityFootprint({ type: 'rock', x: 16, y: 16 }, ENTITY_SEMANTICS.rock))
            .toEqual({ x: 1, y: 1, w: 1, h: 1 });
    });

    it('spans a rope from its start to its far end', () => {
        const e = { type: 'rope', x: 32, y: 16, attrs: { xend: '80' } };
        expect(entityFootprint(e, ENTITY_SEMANTICS.rope)).toEqual({ x: 2, y: 1, w: 4, h: 1 });
    });
});

describe('flag -> AP item rules', () => {
    const rules = buildFlagItemRules(GAME_CONFIG);

    it('resolves plain items straight to their AP name', () => {
        expect(rules.flags.hasWand).toEqual({ rule: 'Has', args: { item_name: 'Wand' } });
        expect(rules.flags.hasSpear).toEqual({ rule: 'Has', args: { item_name: 'Ghost Spear' } });
        expect(rules.flags.hasDarkSuit).toEqual({ rule: 'Has', args: { item_name: 'Dark Suit' } });
    });

    it('counts progressive chains', () => {
        expect(rules.flags.hasSword).toEqual({ rule: 'Has', args: { item_name: 'Progressive Sword' } });
        expect(rules.flags.hasDarkSword)
            .toEqual({ rule: 'Has', args: { item_name: 'Progressive Sword', count: 2 } });
        expect(rules.flags.canSwim).toEqual({ rule: 'Has', args: { item_name: 'Progressive Swim' } });
        expect(rules.flags.hasFeather)
            .toEqual({ rule: 'Has', args: { item_name: 'Progressive Swim', count: 2 } });
    });

    it('ANDs a fusion out of everything it needs', () => {
        expect(rules.flags.hasFireWand).toEqual({
            rule: 'And',
            children: [
                { rule: 'Has', args: { item_name: 'Fire Wand Fusion' } },
                { rule: 'Has', args: { item_name: 'Wand' } },
                { rule: 'Has', args: { item_name: 'Fire' } },
            ],
        });
        expect(rules.flags.hasGhostSword).toEqual({
            rule: 'And',
            children: [
                { rule: 'Has', args: { item_name: 'Ghost Sword Fusion' } },
                { rule: 'Has', args: { item_name: 'Ghost Spear' } },
                { rule: 'Has', args: { item_name: 'Progressive Sword' } },
            ],
        });
    });

    it('maps the five boss keys and leaves nothing unresolved', () => {
        expect(rules.keys[0]).toEqual({ rule: 'Has', args: { item_name: 'Red Key' } });
        expect(rules.keys[4]).toEqual({ rule: 'Has', args: { item_name: 'Yellow Key' } });
        expect(Object.keys(rules.keys)).toHaveLength(5);
        expect(rules.unresolved).toEqual([]);
    });

    it('does not treat the health counter as a flag', () => {
        expect(rules.flags.hitsMax).toBeUndefined();
    });

    it('resolves a disjunction into an Or, de-duplicating shared leaves', () => {
        expect(resolveCondition(anyOf(flag('hasWand'), flag('hasFireWand')), rules)).toEqual({
            rule: 'Or',
            children: [
                { rule: 'Has', args: { item_name: 'Wand' } },
                rules.flags.hasFireWand,
            ],
        });
        expect(resolveCondition(allOf(flag('hasWand'), flag('hasWand')), rules))
            .toEqual({ rule: 'Has', args: { item_name: 'Wand' } });
    });

    it('returns null when a leaf has no AP item behind it', () => {
        expect(resolveCondition(flag('hasNothing'), rules)).toBeNull();
        expect(resolveCondition(anyOf(flag('hasWand'), flag('hasNothing')), rules)).toBeNull();
        expect(resolveCondition(key(9), rules)).toBeNull();
    });

    it('gives equal conditions equal keys regardless of operand order', () => {
        expect(conditionKey(anyOf(flag('a'), flag('b'))))
            .toBe(conditionKey(anyOf(flag('b'), flag('a'))));
        expect(conditionKey(anyOf(flag('a'), flag('b'))))
            .not.toBe(conditionKey(allOf(flag('a'), flag('b'))));
    });
});

describe('grid construction over real levels', () => {
    // ⛓ SWIM T4 — `bosslock`'s `probe: 'S'` becomes `enter` gates ONLY under `directionalLocks`.
    it('a bosslock is one-sided under `directionalLocks` (entered only moving north), and untouched without it', () => {
        const level = levelById(30);
        const bounds = { x: 0, y: 0, w: level.width, h: level.height };
        const lockCell = (g) => g.cells[2 * g.width + 4]; // bosslock@64,32 = tile (4,2)
        const off = buildSeedlingRegionGrid(bounds, level);
        expect(ENTITY_SEMANTICS.bosslock.probe).toBe('S');
        expect(lockCell(off).kind).toBe('gated');
        expect(lockCell(off).enter).toBeUndefined();
        expect(off.cells.some((c) => c.enter)).toBe(false);
        const on = buildSeedlingRegionGrid(bounds, level, { directionalLocks: true });
        expect(lockCell(on).enter).toEqual({ E: null, S: null, W: null });
        expect(on.cells.filter((c) => c.enter)).toHaveLength(2); // L30's two locks
    });

    it('builds a fully classified grid for the starting house', () => {
        const level = levelById(86);
        const grid = buildSeedlingRegionGrid({ x: 0, y: 0, w: level.width, h: level.height }, level);
        expect(grid.width).toBe(level.width);
        expect(grid.cells).toHaveLength(level.width * level.height);
        expect(grid.unclassified).toEqual([]);
        for (const cell of grid.cells) expect(CELL_KINDS).toContain(cell.kind);
    });

    it('classifies every level in the extract without a gap', () => {
        const gaps = [];
        for (const level of MAP.levels) {
            const grid = buildSeedlingRegionGrid(
                { x: 0, y: 0, w: level.width, h: level.height }, level,
            );
            for (const u of grid.unclassified) gaps.push(`level ${level.level}: ${u.what}`);
        }
        expect(gaps).toEqual([]);
    });

    it('clips to the region bounds and translates to region-local cells', () => {
        const level = levelById(0);
        const bounds = { x: 4, y: 4, w: 3, h: 3 };
        const grid = buildSeedlingRegionGrid(bounds, level);
        expect(grid.width).toBe(3);
        expect(grid.cells).toHaveLength(9);
        expect(grid.origin).toEqual({ x: 4, y: 4 });
    });

    it('lets the strongest claim win a cell while keeping every condition', () => {
        const level = {
            width: 2,
            height: 1,
            layers: [{ name: 'tiles', tiles: [[0, 0, 2 * SEEDLING_TILE_SIZE, 0]] }],
            entities: [{ type: 'breakablerock', x: 0, y: 0 }],
        };
        const grid = buildSeedlingRegionGrid({ x: 0, y: 0, w: 2, h: 1 }, level);
        const cell = grid.cells[0];
        expect(cell.kind).toBe('gated');
        expect(cell.conditions).toEqual([
            flag('canSwim'),
            anyOf(flag('hasSword'), flag('hasSpear')),
        ]);
    });

    it('records a pit as a sink and ice as a review flag', () => {
        const level = {
            width: 2,
            height: 1,
            layers: [{
                name: 'tiles',
                tiles: [[0, 0, 7 * SEEDLING_TILE_SIZE, 0], [1, 0, 24 * SEEDLING_TILE_SIZE, 0]],
            }],
            entities: [],
        };
        const grid = buildSeedlingRegionGrid({ x: 0, y: 0, w: 2, h: 1 }, level);
        expect(grid.cells[0].kind).toBe('sink');
        expect(grid.sinks).toEqual([{ tile: [0, 0], label: 'pit' }]);
        expect(grid.cells[1].kind).toBe('open');
        expect(grid.review).toHaveLength(1);
        expect(grid.review[0].tile).toEqual([1, 0]);
    });

    it('walls the north face of a cave tile and gates a waterfall climb', () => {
        const level = {
            width: 1,
            height: 2,
            layers: [{
                name: 'tiles',
                tiles: [[0, 0, 15 * SEEDLING_TILE_SIZE, 0], [0, 1, 28 * SEEDLING_TILE_SIZE, 0]],
            }],
            entities: [],
        };
        const grid = buildSeedlingRegionGrid({ x: 0, y: 0, w: 1, h: 2 }, level);
        // The cave's gate is on its north FACE (paid crossing it either way);
        // the waterfall's is on the DIRECTION of travel (only the climb).
        expect(grid.cells[0].kind).toBe('directional');
        expect(grid.cells[0].faces).toEqual({ N: null });
        expect(grid.cells[0].dirs).toEqual({});
        expect(grid.cells[1].kind).toBe('directional');
        expect(grid.cells[1].faces).toEqual({});
        expect(grid.cells[1].dirs).toEqual({ N: [flag('hasFeather')] });
    });

    // ⛔ R7 slice 5: a cliffside is HALF a tile. It used to be read as a
    // whole-tile wall, which sealed L100 and with it Dungeon 8's tail.
    it('reads a cliffsides placement as a FACE gate, one face per solid half', () => {
        const cliff = (tx) => buildSeedlingRegionGrid({ x: 0, y: 0, w: 1, h: 1 }, {
            width: 1, height: 1, entities: [],
            layers: [{ name: 'cliffsides', tiles: [[0, 0, tx * 16, 0]] }],
        });
        // frame 0 = MaskL: the left half is solid, so only the WEST face blocks.
        expect(cliff(0).cells[0].kind).toBe('directional');
        expect(cliff(0).cells[0].faces).toEqual({ W: null });
        expect(cliff(1).cells[0].faces).toEqual({ E: null });
        expect(cliff(2).cells[0].faces).toEqual({ W: null, N: null });
        expect(cliff(3).cells[0].faces).toEqual({ E: null, N: null });
        // Anything past the four named frames is CliffSideMaskU (the default arm
        // of the switch at Scenery/CliffSide.as:20-30), the top half.
        expect(cliff(4).cells[0].faces).toEqual({ N: null });
        expect(cliff(999).cells[0].faces).toEqual({ N: null });
        expect(cliff(0).unclassified).toEqual([]);
        // The mutation that would restore the old reading has to go red.
        for (const tx of [0, 1, 2, 3, 4]) expect(cliff(tx).cells[0].kind).not.toBe('wall');
    });

    // ⛔ R7 slice 5: an entity claims only the tiles its hitbox COVERS. The 29
    // off-grid wall entities used to wall four tiles apiece; `planttorch@120,152`
    // did it in front of L62's north island and cost the Ghost Spear.
    it('claims only the tiles an entity hitbox fully covers', () => {
        const tiles = (x, y, semantics = { kind: 'wall' }) => entitySealedTiles({ type: 't', x, y }, semantics);
        expect(tiles(32, 48)).toEqual([[2, 3]]);                       // aligned 1x1: unchanged
        expect(tiles(120, 152)).toEqual([]);                           // half-offset 1x1: nothing
        expect(tiles(32, 48, { kind: 'wall', size: [2, 2] }))
            .toEqual([[2, 3], [3, 3], [2, 4], [3, 4]]);                 // aligned 2x2
        expect(tiles(40, 48, { kind: 'wall', size: [2, 2] }))
            .toEqual([[3, 3], [3, 4]]);                                 // offset in x: one column
    });

    it('reports a tile whose free remainder is thinner than the player box', () => {
        // 15 px of a 16 px tile covered in x while spanning it in y: 1 px left.
        expect(entityStrandedTiles({ type: 't', x: 1, y: 0 }, { kind: 'wall' }))
            .toContainEqual([0, 0]);
        // A clean half is 8 px, which the 4x5 player fits through.
        expect(entityStrandedTiles({ type: 't', x: 8, y: 8 }, { kind: 'wall' })).toEqual([]);
    });

    it('reports an unknown entity tag rather than skipping it', () => {
        const level = {
            width: 1, height: 1, layers: [], entities: [{ type: 'martian', x: 0, y: 0 }],
        };
        const grid = buildSeedlingRegionGrid({ x: 0, y: 0, w: 1, h: 1 }, level);
        expect(grid.unclassified).toEqual([{ tile: [0, 0], what: 'entity "martian"' }]);
    });
});

// ── Behaviour-parameters P1 (⚖ Q11): the tile types BY NAME ─────────────────
//
// `TILE_TYPE_IDS` is the one name ↔ int table. These rows hold it to the
// source's own numbering, hold the profile's `*State` keys to their names (one
// value, two places — the profile keys stay, the witness names them), and hold
// every tile-keyed table in the model to a named id.
const { TILE_TYPE_IDS } = await import('./seedlingSemantics.js');
const { PROFILE } = await import('../seedlingDemo/seedlingProfile.js');
const { MODELLED_TILE_TYPES } = await import('../seedlingDemo/levelWorld.js');
const { HAZARD_STATES } = await import('../seedlingDemo/tapeFormat.js');
const { DESTROYING_TILE_TYPES } = await import('../seedlingDemo/pushables.js');
const { ENEMY_TERRAIN_DESTROYS } = await import('../seedlingDemo/chasers.js');
const { ICE_TURRET } = await import('../seedlingDemo/iceTurret.js');
const { SPINNER } = await import('../seedlingDemo/spinner.js');
const { FINAL_BOSS } = await import('../seedlingDemo/finalBossFight.js');
const { ENEMY_CLASSES } = await import('../seedlingDemo/combat.js');
const NAME_OF = new Map(Object.entries(TILE_TYPE_IDS).map(([n, id]) => [id, n]));
const camel = (s) => s.replace(/[()]/g, '').split(/[\s-]+/).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w.toLowerCase())).join('');

describe('TILE_TYPE_IDS — the tile types by name', () => {

    it('ids unique, names unique, and each id is its name\'s index in TILE_TYPE_NAMES (Tile.as:32-69)', () => {
        const ids = Object.values(TILE_TYPE_IDS);
        expect(new Set(ids).size).toBe(ids.length);
        expect(Object.isFrozen(TILE_TYPE_IDS)).toBe(true);
        expect(ids).toEqual(TILE_TYPE_NAMES.map((_, i) => i));
        expect(Object.keys(TILE_TYPE_IDS)).toEqual(TILE_TYPE_NAMES.map(camel));
    });

    it('every id TILE_COLUMN_TO_TYPE builds and every id MODELLED_TILE_TYPES lists has a name', () => {
        for (const t of new Set([...TILE_COLUMN_TO_TYPE, ...MODELLED_TILE_TYPES])) expect(NAME_OF.has(t), String(t)).toBe(true);
    });

    it('the profile\'s *State keys ARE the named ids (one value, two places)', () => {
        expect(PROFILE.lavaState).toBe(TILE_TYPE_IDS.lava);
        expect(PROFILE.waterState).toBe(TILE_TYPE_IDS.water);
        expect(PROFILE.bridgeState).toBe(TILE_TYPE_IDS.bridge);
        expect(PROFILE.waterfallState).toBe(TILE_TYPE_IDS.waterfall);
        expect(PROFILE.iceState).toBe(TILE_TYPE_IDS.ice);
        expect(PROFILE.pitState).toBe(TILE_TYPE_IDS.pit);
        expect(PROFILE.enemyPitTile).toBe(TILE_TYPE_IDS.pit);
        expect(PROFILE.initialTerrainState).toBe(TILE_TYPE_IDS.ground);
        expect(PROFILE.coercedTerrainState).toBe(TILE_TYPE_IDS.ground);
        expect([PROFILE.noBounceStates0, PROFILE.noBounceStates1, PROFILE.noBounceStates2])
            .toEqual([TILE_TYPE_IDS.pit, TILE_TYPE_IDS.water, TILE_TYPE_IDS.lava]);
    });

    it('every tile-keyed table in the model names its ids by the table\'s own name', () => {
        for (const t of Object.keys(TILE_TYPE_SEMANTICS).map(Number)) expect(NAME_OF.has(t), String(t)).toBe(true);
        for (const [name, t] of Object.entries(HAZARD_STATES)) expect(TILE_TYPE_IDS[name], `HAZARD_STATES.${name}`).toBe(t);
        for (const [t, name] of Object.entries(DESTROYING_TILE_TYPES)) expect(TILE_TYPE_IDS[name], `DESTROYING_TILE_TYPES[${t}]`).toBe(Number(t));
        for (const [name, t] of Object.entries(ENEMY_TERRAIN_DESTROYS)) expect(TILE_TYPE_IDS[name], `ENEMY_TERRAIN_DESTROYS.${name}`).toBe(t);
        for (const [name, t] of Object.entries(ICE_TURRET.fatalTiles)) expect(TILE_TYPE_IDS[name], `ICE_TURRET.fatalTiles.${name}`).toBe(t);
        for (const [t, name] of Object.entries(SPINNER.terrain)) expect(TILE_TYPE_IDS[name], `SPINNER.terrain[${t}]`).toBe(Number(t));
        expect(FINAL_BOSS.lavaT).toBe(TILE_TYPE_IDS.lava);
        expect(ENEMY_CLASSES.bulb.navMeshEdit.becomes).toBe(TILE_TYPE_IDS.lava);
    });
});
