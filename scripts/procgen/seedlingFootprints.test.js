/**
 * ⛓ RULES footprints — EVERY semantics row's footprint is the model's collider.
 *
 * `seedlingSemantics.ENTITY_SEMANTICS` decides which tiles each blocker seals; the physics model
 * (`levelWorld.ENTITY_CLASSES`) carries the game's own hitbox. The burnable-trees census compared the two for the
 * GATED rows only, so the walls and the overlay-promoted rows drifted unseen: BeamTower sat 8 px low (L103–L108),
 * the BossTotem 3 columns right and a row high (L43), the Totem 2 tiles high (L37), the Statues 2 tiles narrow (L0,
 * L87), the sub-tile NPCs a whole tile wide. The footprints are now DERIVED (`seedlingEntityColliders.js`, generated
 * from the model), and these rows hold that over the full class list — every tag, every placement.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import { modelColliders, renderColliders, COLLIDERS_MODULE } from './make-seedling-entity-colliders.mjs';
import {
    ENTITY_SEMANTICS, entityPixelRect, entitySealedTiles, entitySemantics, isLevelPropertyTag,
    buildSeedlingRegionGrid, entityMaskTiles,
} from '../../frontend/modules/flashPanel/seedlingSemantics.js';
import { ENTITY_COLLIDERS } from '../../frontend/modules/flashPanel/seedlingEntityColliders.js';
import { SEEDLING_PIXEL_MASKS } from '../../frontend/modules/seedlingDemo/seedlingPixelMasks.js';
import { overlayEntitySemantics } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
import { ENTITY_CLASSES, entityRect, TILE_SIZE, buildLevelWorld, ROLES } from '../../frontend/modules/seedlingDemo/levelWorld.js';

const REPO = join(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', '..');
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const ATLAS = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8'));

/**
 * The non-open rows the model has NO box for, each with its reason. A row leaves this list the moment the model
 * gives its class a box (the census below then derives it); a row joins it only with a reason.
 */
const NO_MODEL_BOX = {
    fallrock: 'not present at boot: it drops on a trigger (`collider: none`)',
    fallrocklarge: 'not present at boot: it drops on a trigger (`collider: none`)',
    moonrock: 'constructed at y = -1000 and only drops in on the beam event (`collider: none`)',
    finalboss: 'an encounter script with no rect (`collider: none`, R6 slice 6b)',
    rope: 'its width is per placement (`spanAttr`), as the model\'s `rope` collider',
    building3: 'no room places it and the model has no row',
};

const box = (r) => ({ x: r.x, y: r.y, w: r.w, h: r.h });
const contains = (outer, inner) => outer.x <= inner.x && outer.y <= inner.y
    && outer.x + outer.w >= inner.x + inner.w && outer.y + outer.h >= inner.y + inner.h;

describe('the generated collider table IS the model\'s', () => {
    it('seedlingEntityColliders.js is byte-equal to a fresh render of levelWorld.ENTITY_CLASSES', () => {
        expect(readFileSync(COLLIDERS_MODULE, 'utf8')).toBe(renderColliders(modelColliders(ENTITY_CLASSES)));
    });
});

describe('every semantics row claims the footprint the game collides with', () => {
    it('each non-open row\'s rect equals the model\'s (a Building\'s sprite rect CONTAINS its mask\'s box)', () => {
        const mismatched = [];
        const noBox = [];
        for (const [tag, row] of Object.entries(ENTITY_SEMANTICS)) {
            if (row.kind === 'open') continue;
            const cls = ENTITY_CLASSES[tag];
            if (!cls || !['rect', 'pixelmask', 'trigger'].includes(cls.collider)) { noBox.push(tag); continue; }
            const model = box(entityRect(cls, 0, 0));
            const ours = box(entityPixelRect({ x: 0, y: 0, attrs: {} }, row));
            const ok = row.pixelMask ? contains(ours, model) : JSON.stringify(ours) === JSON.stringify(model);
            if (!ok) mismatched.push(`${tag}: ${JSON.stringify(ours)} vs the model's ${cls.collider} ${JSON.stringify(model)}`);
        }
        expect(mismatched).toEqual([]);
        expect(noBox.sort()).toEqual(Object.keys(NO_MODEL_BOX).sort());
    });

    it('every placed blocker, overlay applied, seals exactly the tiles the model\'s rect fully covers', () => {
        // The tile-level census the rules arc ran by hand (rules-model-coverage b.5): it caught what a per-row
        // check misses when the overlay replaces a row. Pixel masks are the model's question (`manual`), not a rect.
        const T = TILE_SIZE;
        const full = (r) => {
            const out = [];
            for (let ty = Math.floor(r.y / T); ty * T < r.y + r.h; ty += 1) {
                for (let tx = Math.floor(r.x / T); tx * T < r.x + r.w; tx += 1) {
                    if (tx * T >= r.x && ty * T >= r.y && (tx + 1) * T <= r.x + r.w && (ty + 1) * T <= r.y + r.h) out.push(`${tx},${ty}`);
                }
            }
            return out.sort();
        };
        const mismatched = [];
        let compared = 0;
        for (const level of MAP.levels) {
            for (const entity of level.entities ?? []) {
                if (isLevelPropertyTag(entity.type)) continue;
                const base = entitySemantics(entity);
                const sem = overlayEntitySemantics(entity, base, { level: level.level }) ?? base;
                if (!sem || sem.kind === 'open') continue;
                const cls = ENTITY_CLASSES[entity.type];
                if (cls?.collider !== 'rect') continue;
                compared += 1;
                const model = full(entityRect(cls, entity.x, entity.y));
                const ours = entitySealedTiles(entity, sem).map(([x, y]) => `${x},${y}`).sort();
                if (JSON.stringify(model) !== JSON.stringify(ours)) {
                    mismatched.push(`L${level.level} ${entity.type}@${entity.x},${entity.y}: ours [${ours}] model [${model}]`);
                }
            }
        }
        expect(compared).toBeGreaterThan(1000);
        expect(mismatched).toEqual([]);
    });
});

describe('the derived footprints, where they move the rules', () => {
    const region = (id) => ATLAS.regions.find((r) => r.region_id === id);
    const subOf = (r, exitId) => r.exits.find((e) => e.exit_id === exitId).sub_region;

    it('L43: the BossTotem walls the arena\'s north half off — the way north costs the kill', () => {
        // `bosstotem@152,168`: an 80x32 box at (-40, +12) = [112,192) x [180,212), the arena's columns 7..11 on
        // row 12. The rules used to seal row 11 columns 10..13 (a 5x2 box at the ogmo x/y), which left the arena whole.
        const l43 = region('level_43');
        const south = subOf(l43, 'out_stairsup_176_464');
        expect(l43.locations.find((l) => l.name === 'Level 043 - Wand').sub_region).toBe(south);
        expect(subOf(l43, 'out_teleporter_144_64')).not.toBe(south);
        const way = l43.subgraph.internal_exits.find((e) => e.from === south || e.to === south);
        expect(JSON.stringify(way.access_rule)).toContain('"Totem Shard"');
    });
});

/**
 * ⛓ PIXELMASK FOOTPRINTS (session tile-primitives-pixelmask-l86, ⚖ 2026-10-25 "3-way by coverage", "Playthrough only").
 * A Building collides through its Pixelmask, and the grid used to claim its whole SPRITE rect as `manual`: L0's
 * building1 is a 48x40 sprite over a 48x32 mask, so the free tile (10,18) under it — where the game lands the player
 * back from L86 — was material. With `pixelMaskFootprints` each tile takes the mask's coverage: every pixel opaque
 * -> wall, none -> no claim, partly -> `manual` (the physics model decides), the `entitySealedTiles` rounding.
 */
describe('a Building\'s footprint is its Pixelmask, tile by tile', () => {
    const levelOf = (n) => MAP.levels.find((l) => l.level === n);
    const BUILDINGS = Object.entries(ENTITY_SEMANTICS).filter(([, row]) => row.pixelMask).map(([tag]) => tag);
    const gridOf = (n, options) => {
        const level = levelOf(n);
        return buildSeedlingRegionGrid({ x: 0, y: 0, w: level.width, h: level.height }, level, options);
    };
    const kindAt = (grid, x, y) => grid.cells[y * grid.width + x].kind;

    it('every Building the model places names its bitmap in the collider table', () => {
        const modelled = BUILDINGS.filter((tag) => ENTITY_CLASSES[tag]?.collider === 'pixelmask');
        expect(modelled.length).toBeGreaterThan(5);
        for (const tag of modelled) {
            expect(ENTITY_COLLIDERS[tag].mask, tag).toBe(ENTITY_CLASSES[tag].mask);
            expect(SEEDLING_PIXEL_MASKS[ENTITY_COLLIDERS[tag].mask], tag).toBeTruthy();
        }
    });

    it('the coverage of every placed Building\'s tiles equals the physics model\'s bitmap where the model places it', () => {
        let tiles = 0;
        const wrong = [];
        for (const level of MAP.levels) {
            if (!(level.entities ?? []).some((e) => BUILDINGS.includes(e.type))) continue;
            for (const p of buildLevelWorld(level, { roles: ROLES }).pixelmasks.filter((q) => BUILDINGS.includes(q.tag))) {
                for (const { tile: [tx, ty], cover } of entityMaskTiles({ type: p.tag, x: p.x, y: p.y })) {
                    let n = 0;
                    for (let py = ty * TILE_SIZE; py < (ty + 1) * TILE_SIZE; py += 1) {
                        for (let px = tx * TILE_SIZE; px < (tx + 1) * TILE_SIZE; px += 1) {
                            if (p.mask.rows[py - p.maskY]?.[px - p.maskX] === '#') n += 1;
                        }
                    }
                    const model = n === TILE_SIZE * TILE_SIZE ? 'full' : (n === 0 ? 'none' : 'partial');
                    tiles += 1;
                    if (model !== cover) wrong.push(`L${level.level} ${p.tag} (${tx},${ty}): ${cover} vs the model's ${model}`);
                }
            }
        }
        expect(tiles).toBeGreaterThan(150);
        expect(wrong).toEqual([]);
    });

    it('L0 building1: rows 16-17 are wall, its door (10,17) and the landing (10,18) are not claimed', () => {
        const grid = gridOf(0, { pixelMaskFootprints: true });
        for (const [x, y] of [[9, 16], [10, 16], [11, 16], [9, 17], [11, 17]]) expect(kindAt(grid, x, y), `(${x},${y})`).toBe('wall');
        for (const x of [9, 10, 11]) expect(kindAt(grid, x, 18), `(${x},18)`).toBe('open');
        expect(grid.cells[17 * grid.width + 10].manual).toEqual([]);
    });

    it('without the option the grid is unchanged: the sprite rect is manual, (10,18) included', () => {
        const grid = gridOf(0);
        for (const [x, y] of [[10, 16], [10, 17], [10, 18]]) expect(kindAt(grid, x, y), `(${x},${y})`).toBe('manual');
    });

    it('L66 building8: the half-covered door notch stays manual, so the Yellow-Key lock still stamps it', () => {
        const grid = gridOf(66, { pixelMaskFootprints: true });
        for (const [x, y] of [[4, 4], [5, 4]]) expect(kindAt(grid, x, y), `(${x},${y})`).toBe('manual');
        expect(kindAt(grid, 4, 1)).toBe('wall');
        expect(grid.cells[1 * grid.width + 3].manual).toEqual([]); // 0 mask px: the building claims nothing (the tile is water)
    });

    it('the playthrough generator runs with it: L0 (10,18) is open in its grid', async () => {
        const { playthroughGridFor, PLAYTHROUGH_MAP } = await import('./make-seedling-playthrough-rules.mjs');
        const grid = playthroughGridFor(PLAYTHROUGH_MAP.levels.find((l) => l.level === 0));
        expect(kindAt(grid, 10, 18)).toBe('open');
        expect(kindAt(grid, 10, 16)).toBe('wall');
    });
});

/**
 * ⛓ PIXELMASK FOOTPRINTS — the one rule the footprint TIGHTENS: L93's door into L98 (`out_teleporter_112_80`, [7,5])
 * stands atop a waterfall pool, so from r10c7 it costs the Feather. Witnessed on the game by
 * `probe-seedling-l93-door.mjs` (Conch only stalls on the fall; Conch + Feather reaches L98; the landing swims down).
 */
describe('L93: building7\'s door is its own sub-region, up the waterfall', () => {
    const RULES = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
    const exitRule = (from, to) => RULES.regions['1'][from].exits.find((e) => e.connected_region === to)?.access_rule;
    const l93 = ATLAS.regions.find((r) => r.region_id === 'level_93');
    const exitOf = (id) => l93.exits.find((e) => e.exit_id === id);

    it('the door and the L98 landing stand in r5c7; r10c7 reaches it with Swim x2, and back with Swim', () => {
        expect(exitOf('out_teleporter_112_80').sub_region).toBe('r5c7');
        expect(exitOf('in_L98_112_192').sub_region).toBe('r5c7');
        expect(exitRule('level_93__r10c7', 'level_93__r5c7')).toEqual({ rule: 'Has', args: { item_name: 'Progressive Swim', count: 2 } });
        expect(exitRule('level_93__r5c7', 'level_93__r10c7')).toEqual({ rule: 'Has', args: { item_name: 'Progressive Swim' } });
        expect(exitRule('level_93__r5c7', 'level_98')).toEqual({ rule: 'True_' });
        expect(exitRule('level_93__r10c7', 'level_98')).toBeUndefined();
    });

    it('the probe boots on the cells the atlas names: r10c7 for the pool, the L98 landing for the reverse', async () => {
        const { l93Tapes, expectL93, R10_Y } = await import('./probe-seedling-l93-door.mjs');
        const tapes = l93Tapes();
        const tileOf = (b) => [b.x / TILE_SIZE, b.y / TILE_SIZE];
        expect(tileOf(tapes['pool-swim'].boot)).toEqual([7, 10]);
        expect(tileOf(tapes['landing-swim'].boot)).toEqual(exitOf('in_L98_112_192').entrance_tile);
        expect(tapes['pool-swim'].grants[0].items).toEqual(['conch']);
        expect(tapes['pool-feather'].grants[0].items).toEqual(['conch', 'feather']);
        expect(R10_Y).toEqual([160, 176]);
        expect(expectL93('pool-swim', { reachedDoor: false })).toBe(true);
        expect(expectL93('pool-feather', { reachedDoor: false })).toBe(false);
        expect(expectL93('landing-swim', { reachedDoor: false, levels: [93], final: { y: 181 } })).toBe(false);
        expect(expectL93('landing-swim', { reachedDoor: false, levels: [93], final: { y: 170 } })).toBe(true);
    });
});
