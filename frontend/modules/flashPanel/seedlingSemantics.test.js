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

    it('treats a cliffsides placement as tile-granular solid', () => {
        const level = {
            width: 1,
            height: 1,
            layers: [{ name: 'cliffsides', tiles: [[0, 0, 999, 0]] }],
            entities: [],
        };
        const grid = buildSeedlingRegionGrid({ x: 0, y: 0, w: 1, h: 1 }, level);
        expect(grid.cells[0].kind).toBe('wall');
        expect(grid.unclassified).toEqual([]);
    });

    it('reports an unknown entity tag rather than skipping it', () => {
        const level = {
            width: 1, height: 1, layers: [], entities: [{ type: 'martian', x: 0, y: 0 }],
        };
        const grid = buildSeedlingRegionGrid({ x: 0, y: 0, w: 1, h: 1 }, level);
        expect(grid.unclassified).toEqual([{ tile: [0, 0], what: 'entity "martian"' }]);
    });
});
