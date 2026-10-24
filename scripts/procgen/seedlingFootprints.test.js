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
} from '../../frontend/modules/flashPanel/seedlingSemantics.js';
import { overlayEntitySemantics } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
import { ENTITY_CLASSES, entityRect, TILE_SIZE } from '../../frontend/modules/seedlingDemo/levelWorld.js';

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
