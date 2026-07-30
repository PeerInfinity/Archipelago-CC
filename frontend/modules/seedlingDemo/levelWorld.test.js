/**
 * levelWorld — the transcribed `loadlevel` subset.
 *
 * Two strata, deliberately:
 *
 * 1. **Census** — every tileset column and every entity tag the COMMITTED
 *    extract puts in a fixture level must be classified here. The source
 *    is out of repo, so drift cannot be caught by a diff; a silent gap has
 *    to be a red test instead. `seedlingSemantics.test.js` already does
 *    this for the tile tables across all 116 levels; this does it for the
 *    entity class table across the levels v2 actually loads.
 *
 * 2. **Footprints and geometry, hand-derived from the AS3** — values read
 *    out of the constructors, not produced by this module. Several of them
 *    are then cross-checked against what the real game DID in the slice-0
 *    oracle recordings, which is the strongest form available here: the
 *    rect maths and the recorded stop position have to agree.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    CLIFFSIDE_CLASS,
    ENTITY_CLASSES,
    LevelWorldError,
    MODELLED_TILE_TYPES,
    PLAYER_SOLID_TYPES,
    buildLevelWorld,
    entityRect,
    rectsOverlap,
} from './levelWorld.js';
import { loadExpectation } from './fixtures/index.js';
import { HITBOX } from './playerPhysicsV1.js';
import {
    TILE_COLUMN_TO_TYPE, TILE_TYPE_ENTITY_TYPES,
} from '../flashPanel/seedlingSemantics.js';

const MAP = JSON.parse(readFileSync(
    fileURLToPath(new URL('../flashPanel/atlases/seedling-map.json', import.meta.url)),
    'utf8',
));

const levelRecord = (id) => MAP.levels.find((l) => l.level === id);
/** The levels the v2 fixtures actually load. */
const FIXTURE_LEVELS = [0, 94];

const L0 = buildLevelWorld(levelRecord(0));
const L94 = buildLevelWorld(levelRecord(94));

/** The player's collision box, as `Entity.collideRect` would place it. */
const playerBox = (x, y) => ({
    x: x - HITBOX.originX,
    y: y - HITBOX.originY,
    right: x - HITBOX.originX + HITBOX.width,
    bottom: y - HITBOX.originY + HITBOX.height,
});

describe('census: every fixture level is fully classified', () => {
    it('classifies every entity tag in the fixture levels', () => {
        const unknown = new Set();
        for (const id of FIXTURE_LEVELS) {
            for (const e of levelRecord(id).entities) {
                if (!ENTITY_CLASSES[e.type]) unknown.add(`${id}:${e.type}`);
            }
        }
        expect([...unknown]).toEqual([]);
    });

    it('classifies every tileset column in the fixture levels', () => {
        const unknown = new Set();
        for (const id of FIXTURE_LEVELS) {
            for (const layer of levelRecord(id).layers) {
                if (layer.name !== 'tiles') continue;
                for (const [, , tx] of layer.tiles) {
                    const column = Math.floor(tx / 16);
                    if (TILE_COLUMN_TO_TYPE[column] === undefined) unknown.add(column);
                }
            }
        }
        expect([...unknown]).toEqual([]);
    });

    it('every class entry cites the source it was transcribed from', () => {
        // The provenance IS the review surface — the source is out of repo.
        for (const [tag, cls] of Object.entries(ENTITY_CLASSES)) {
            expect(cls.src, `${tag} has no src`).toBeTruthy();
            expect(['rect', 'pixelmask', 'trigger', 'none']).toContain(cls.collider);
            // A class that does not block must say WHY, so nobody later
            // reads the omission as an oversight and "fixes" it.
            if (cls.collider === 'none') expect(cls.why, `${tag} has no why`).toBeTruthy();
        }
        expect(CLIFFSIDE_CLASS.src).toBeTruthy();
    });

    it('an unclassified entity is a NAMED failure, not a silent non-collider', () => {
        expect(() => buildLevelWorld({
            level: 999, width: 2, height: 2, layers: [],
            entities: [{ type: 'tentaclebeast', x: 0, y: 0 }],
        })).toThrow(/tentaclebeast.*not in the transcribed class table/s);
    });

    it('an unknown layer is a NAMED failure', () => {
        expect(() => buildLevelWorld({
            level: 999, width: 2, height: 2, entities: [],
            layers: [{ name: 'decals', tiles: [] }],
        })).toThrow(/layer "decals" that loadlevel does not build/);
    });
});

describe('the player collides with Mobile.solids + LavaBoss', () => {
    it('is the base list plus the unconditional Player ctor push', () => {
        expect(PLAYER_SOLID_TYPES)
            .toEqual(['Solid', 'Tree', 'Rock', 'Rope', 'ShieldBoss', 'LavaBoss']);
    });
});

describe('footprints, hand-derived from the constructors', () => {
    it('Tree occupies a 2x2-TILE footprint anchored on its oel cell', () => {
        // super(_x + 16, _y + 16) with setHitbox(32, 32, 16, 16) — the two
        // cancel, so the rect starts exactly at the oel coordinates. This
        // is the canary for "one tag is one cell", which is wrong here.
        expect(entityRect(ENTITY_CLASSES.tree, 0, 96))
            .toMatchObject({ x: 0, y: 96, w: 32, h: 32, right: 32, bottom: 128 });
    });

    it('Pole and BrickPole reach the same rect by different routes', () => {
        // Pole centres itself then sets a centred origin; BrickPole does
        // neither. Transcribing one from the other would be luck.
        expect(entityRect(ENTITY_CLASSES.pole, 64, 112))
            .toMatchObject({ x: 64, y: 112, right: 80, bottom: 128 });
        expect(entityRect(ENTITY_CLASSES.brickpole, 64, 112))
            .toMatchObject({ x: 64, y: 112, right: 80, bottom: 128 });
    });

    it('Rekcahdam truncates its half-width origin, AS3-style', () => {
        // setHitbox(9, 10, 9/2, 10/2) with int params: 4.5 -> 4.
        expect(ENTITY_CLASSES.rekcahdam.originX).toBe(4);
        expect(ENTITY_CLASSES.rekcahdam.originY).toBe(5);
        expect(entityRect(ENTITY_CLASSES.rekcahdam, 168, 192))
            .toMatchObject({ x: 172, y: 195, right: 181, bottom: 205 });
    });

    it('the statue offsets DOWNWARD by a half tile, not upward', () => {
        // `_y - Tile.h/2 + Tile.h*int(_t==0)`: the statue2 tag passes _t=1,
        // so the second term is zero and the net offset is -8. Reading the
        // expression as "+8 for the usual half-tile" is wrong by 16px.
        expect(ENTITY_CLASSES.statue2.dy).toBe(-8);
        expect(entityRect(ENTITY_CLASSES.statue2, 184, 160))
            .toMatchObject({ x: 176, y: 152, right: 224, bottom: 176 });
    });

    it('NPCs are SOLID — nothing about the tag says so', () => {
        // NPC extends Mobile and sets type = "Solid" with a hitbox from
        // the sprite's frame size, centred (NPCs/NPC.as:48-59).
        expect(ENTITY_CLASSES.introchar.collider).toBe('rect');
        expect(ENTITY_CLASSES.introchar.type).toBe('Solid');
        expect(L0.solids.some((s) => s.tag === 'introchar')).toBe(true);
    });

    it('Watcher, Torch, Orb and Moonrock are present but do NOT block', () => {
        expect(L94.solids.some((s) => s.tag === 'watcher')).toBe(false);
        expect(L0.solids.some((s) => s.tag === 'torch')).toBe(false);
        expect(L94.solids.some((s) => s.tag === 'orb')).toBe(false);
        // Moonrock is the subtle one: it has a 48x48 hitbox and the type
        // "Solid" in a LATER branch, but is constructed type "" at
        // y = -1000 and only drops in once Game.moonrockSet.
        expect(L0.solids.some((s) => s.tag === 'moonrock')).toBe(false);
    });
});

describe('tiles', () => {
    it('places the entity at the cell CENTRE with a cell-sized hitbox', () => {
        // This is what nearestToPoint measures to, so it is load-bearing
        // for the terrain resolver, not just bookkeeping.
        const tile = L0.tiles.find((t) => t.tx === 5 && t.ty === 8);
        expect(tile).toMatchObject({ x: 88, y: 136, t: 3, entityType: 'Tile' });
        expect(tile.rect).toMatchObject({ x: 80, y: 128, right: 96, bottom: 144 });
    });

    it('level 0 has exactly three solid tiles, all cliff', () => {
        // Row 7 columns 14, 15 and 17 — level 0's ONLY solid terrain, and
        // it is wedged between waterfall tiles, which is why the v2
        // fixtures press against solid ENTITIES instead.
        const solidTiles = L0.tiles.filter((t) => t.entityType === 'Solid');
        expect(solidTiles.map((t) => [t.tx, t.ty, t.t]))
            .toEqual([[14, 7, 9], [15, 7, 9], [17, 7, 9]]);
    });

    it('the walkable/solid split matches Tile.types cell for cell', () => {
        // The independent check: recompute the partition straight from the
        // verbatim AS3 table rather than trusting the built lists.
        for (const world of [L0, L94]) {
            for (const tile of world.tiles) {
                const expected = TILE_TYPE_ENTITY_TYPES[tile.t];
                expect(tile.entityType).toBe(expected);
                expect(world.walkableTiles.includes(tile)).toBe(expected === 'Tile');
            }
        }
    });

    it('walkable candidates EXCLUDE solid tiles, per the type flip', () => {
        // A solid tile flips its type on its first update and leaves the
        // "Tile" list, so `state` can never become a wall type.
        expect(L0.walkableTiles.every((t) => t.entityType === 'Tile')).toBe(true);
        expect(L0.walkableTiles).toHaveLength(397);
        expect(L0.tiles).toHaveLength(400);
    });

    it('trusts the extract for loadlevel\'s out-of-bounds guard', () => {
        // 51 levels paint past their own rectangle; the game builds none
        // of those tiles and the extractor already drops them, recording
        // the count. Re-filtering here would be harmless; UN-filtering
        // would invent terrain outside the level.
        expect(levelRecord(0).tiles_outside_level).toBe(5);
        expect(L0.tiles).toHaveLength(levelRecord(0).width * levelRecord(0).height);
    });

    it('does not model bridge tiles at all — they rewrite their own type', () => {
        const bridgeColumn = TILE_COLUMN_TO_TYPE.indexOf(29);
        expect(() => buildLevelWorld({
            level: 999, width: 1, height: 1, entities: [],
            layers: [{ name: 'tiles', tiles: [[0, 0, bridgeColumn * 16, 0]] }],
        })).toThrow(/Tile\.types entry is "Unused"/);
    });

    it('modelled terrain excludes exactly the special-mechanics types', () => {
        // Stated as a COMPLEMENT, so the list cannot drift in either
        // direction: silently dropping a type would narrow v2's scope
        // without anyone noticing, and silently adding one of the six back
        // would let a fixture onto sound-coupled or input-stealing terrain.
        const excluded = [1, 6, 17, 22, 25, 29];
        const all = TILE_TYPE_ENTITY_TYPES.map((_, t) => t);
        expect([...MODELLED_TILE_TYPES].sort((a, b) => a - b))
            .toEqual(all.filter((t) => !excluded.includes(t)));
        for (const t of excluded) {
            expect(MODELLED_TILE_TYPES).not.toContain(t);
            expect(() => L0.assertModelledTerrain(t)).toThrow(LevelWorldError);
        }
        expect(L0.assertModelledTerrain(0)).toBe(0);
        expect(L0.assertModelledTerrain(10)).toBe(10);   // Cliff Stairs
        expect(L0.assertModelledTerrain(30)).toBe(30);   // Ghost Tile Step
    });
});

describe('teleporters, against the extract', () => {
    it('reproduces level 0\'s complete exit table', () => {
        expect(L0.teleporters
            .map((tp) => [tp.x, tp.y, tp.to, tp.arrival.x, tp.arrival.y, tp.isStairs])
            .sort((a, b) => (a[1] - b[1]) || (a[0] - b[0])))
            .toEqual([
                [240, 0, 89, 168, 296, false],
                [80, 96, 1, 72, 104, false],
                [0, 128, 94, 296, 168, false],
                [0, 144, 94, 296, 184, false],
                [304, 176, 12, 24, 88, false],
                [32, 192, 13, 72, 136, true],
                [160, 272, 86, 56, 56, false],
                [256, 272, 2, 56, 40, true],
            ]);
    });

    it('the trigger volume is 16x16 at the raw oel coordinates', () => {
        const west = L0.teleporters.find((tp) => tp.x === 0 && tp.y === 128);
        expect(west.rect).toMatchObject({ x: 0, y: 128, right: 16, bottom: 144 });
    });

    it('Stairs is the identical trigger with tag forced to -1', () => {
        const stairs = L0.teleporters.filter((tp) => tp.isStairs);
        expect(stairs).toHaveLength(2);
        expect(stairs.every((tp) => tp.tag === -1 && !tp.deactivated)).toBe(true);
    });

    it('level 0\'s teleporters are all tag=-1, so none is deactivated', () => {
        expect(L0.teleporters.every((tp) => tp.tag === -1)).toBe(true);
        expect(L0.teleporters.every((tp) => !tp.deactivated)).toBe(true);
    });

    it('a tagged, non-inverted teleporter IS deactivated on a fresh boot', () => {
        // `tag >= 0 && (!checkPersistence(tag) == invert)`. With every
        // persistence flag true (Main.as:319-330 on a runtime that never
        // persists), `!checkPersistence` is false — so invert=false makes
        // it deactivated. Counter-intuitive, and the reason the brief
        // tells fixtures to stay off tagged teleporters.
        const w = buildLevelWorld({
            level: 999, width: 2, height: 2, layers: [],
            entities: [{
                type: 'teleporter', x: 0, y: 0,
                attrs: { to: '5', playerx: '16', playery: '16', tag: '2', invert: '0' },
            }],
        });
        expect(w.teleporters[0].deactivated).toBe(true);
        expect(w.teleporterHit({ x: 0, y: 0, right: 8, bottom: 8 })).toEqual([]);
    });
});

describe('the queries the sweep will ask', () => {
    it('rectsOverlap is STRICT — touching edges do not collide', () => {
        const a = { x: 0, y: 0, right: 10, bottom: 10 };
        expect(rectsOverlap(a, { x: 10, y: 0, right: 20, bottom: 10 })).toBe(false);
        expect(rectsOverlap(a, { x: 9.999, y: 0, right: 20, bottom: 10 })).toBe(true);
    });

    it('nearestWalkableTile measures to tile CENTRES, not to hitboxes', () => {
        // nearestToPoint's default useHitboxes=false compares squared
        // distance to entity x/y (World.as:640-668), and a Tile's x/y is
        // its centre. Sampled just inside a cell's left edge, the nearest
        // centre is still that cell's.
        expect(L0.nearestWalkableTile(81, 137)).toMatchObject({ tx: 5, ty: 8 });
        expect(L0.nearestWalkableTile(88, 136)).toMatchObject({ tx: 5, ty: 8 });
    });

    it('nearestWalkableTile skips a solid cell for a further walkable one', () => {
        // Standing on the cliff at tile (15,7) — centre (248,120) — the
        // nearest "Tile" entity is a NEIGHBOUR, because the cliff left the
        // list. This is what makes the resolver's stickiness matter.
        const near = L0.nearestWalkableTile(248, 120);
        expect(near.entityType).toBe('Tile');
        expect([near.tx, near.ty]).not.toEqual([15, 7]);
    });

    it('collidesSolid finds the BreakableRock the oracle recording hit', () => {
        // The rock at oel (80,112) occupies [80,96) x [112,128).
        expect(L0.collidesSolid(playerBox(88, 129.5))).toMatchObject({ tag: 'breakablerock' });
        expect(L0.collidesSolid(playerBox(88, 130))).toBeNull();
    });

    it('and the rest position the REAL GAME recorded is free, by half a pixel', () => {
        // collide-up-rock pinned at y = 130.5 and crept to 130.05 once
        // friction shrank the step. Both must be free here and the next
        // 1px step must not be — that is the whole claim of the fixture,
        // restated in geometry the physics has not run yet.
        const { ticks } = loadExpectation('collide-up-rock').stream;
        const pinned = ticks[6].y;
        const crept = ticks[45].y;
        expect(pinned).toBe(130.5);
        expect(crept).toBe(130.05);
        expect(L0.collidesSolid(playerBox(88, pinned))).toBeNull();
        expect(L0.collidesSolid(playerBox(88, crept))).toBeNull();
        expect(L0.collidesSolid(playerBox(88, crept - 0.06))).toMatchObject({
            tag: 'breakablerock',
        });
    });

    it('teleporterHit fires exactly where the oracle recording crossed', () => {
        // transition-west-return's last level-0 observation is x=17.7,
        // y=136 — the first position overlapping the (0,128) trigger.
        const { ticks } = loadExpectation('transition-west-return').stream;
        const last = ticks[60];
        expect(last.level).toBe(0);
        const hit = L0.teleporterHit(playerBox(last.x, last.y));
        expect(hit).toHaveLength(1);
        expect(hit[0].to).toBe(94);
        expect(hit[0].arrival).toEqual({ x: ticks[61].x, y: ticks[61].y });
        // One tick earlier it had NOT yet reached the trigger.
        expect(L0.teleporterHit(playerBox(ticks[59].x, ticks[59].y))).toEqual([]);
    });

    it('the return trigger fires where the recording came back', () => {
        const { ticks } = loadExpectation('transition-west-return').stream;
        const last = ticks[108];
        expect(last.level).toBe(94);
        const hit = L94.teleporterHit(playerBox(last.x, last.y));
        expect(hit).toHaveLength(1);
        expect(hit[0].arrival).toEqual({ x: ticks[109].x, y: ticks[109].y });
    });

    it('neither arrival re-arms a trigger — the round trip is not a bounce', () => {
        // Why the anti-ping-pong latch never engaged in the recording.
        const { ticks } = loadExpectation('transition-west-return').stream;
        expect(L94.teleporterHit(playerBox(ticks[61].x, ticks[61].y))).toEqual([]);
        expect(L0.teleporterHit(playerBox(ticks[109].x, ticks[109].y))).toEqual([]);
    });
});

describe('the pixelmask seam', () => {
    it('level 0\'s two buildings are pixelmasks, not rect solids', () => {
        expect(L0.pixelmasks.map((p) => p.tag).sort()).toEqual(['building', 'building1']);
        expect(L0.solids.some((s) => s.tag?.startsWith('building'))).toBe(false);
    });

    it('CliffSide is a PIXELMASK — the brief called it a plain Solid', () => {
        // It IS type "Solid", but its collider is a Pixelmask and it never
        // calls setHitbox, so its Hitbox is 0x0. A model that read the
        // type and used the hitbox would give every cliffside a zero-size
        // rect and collide with none of them: silent, and exactly wrong.
        expect(CLIFFSIDE_CLASS.collider).toBe('pixelmask');
        expect(CLIFFSIDE_CLASS.type).toBe('Solid');
        expect(L94.pixelmasks.filter((p) => p.tag === 'cliffside')).toHaveLength(9);
        expect(L0.pixelmasks.filter((p) => p.tag === 'cliffside')).toHaveLength(0);
    });

    it('TreeLarge\'s ctor offset and mask offset cancel', () => {
        // Entity at (x+80, y+96), mask offset (-80,-96), mask 160x192 — so
        // the mask lands on the raw oel coordinates. Dropping either half
        // would move it by most of its own size.
        const tl = L94.pixelmasks.find((p) => p.tag === 'treelarge');
        expect(tl.rect).toMatchObject({ x: 80, y: 0, right: 240, bottom: 192 });
    });

    it('overlapping one THROWS, naming it and the source', () => {
        // The positive control for the seam: it must fire, not be
        // decorative. Level 0's building spans [64,128) x [64,112).
        expect(() => L0.collidesSolid(playerBox(96, 88)))
            .toThrow(/unmodeled pixelmask collider: Building \(building\)/);
    });

    it('throws even where a rect solid would ALSO have blocked', () => {
        // Deliberately unconditional. The bounding rect over-approximates
        // the mask, so this can only over-throw — and an over-throw is a
        // loud "move the fixture" while an under-throw is a divergence
        // nobody sees.
        const w = buildLevelWorld({
            level: 999, width: 4, height: 4, layers: [],
            entities: [
                { type: 'building', x: 0, y: 0 },
                { type: 'pole', x: 0, y: 0 },
            ],
        });
        expect(() => w.collidesSolid(playerBox(8, 8))).toThrow(/unmodeled pixelmask/);
    });

    it('BOTH slice-0 fixture routes stay clear of the seam', () => {
        // The claim the fixtures rest on, checked rather than asserted in
        // prose: replay every recorded position through the real query and
        // require that none of them throws.
        for (const name of ['collide-up-rock', 'transition-west-return']) {
            const { ticks } = loadExpectation(name).stream;
            for (const o of ticks) {
                const world = o.level === 0 ? L0 : L94;
                expect(() => world.collidesSolid(playerBox(o.x, o.y)),
                    `${name} tick ${o.t} at (${o.x},${o.y}) in level ${o.level}`).not.toThrow();
            }
        }
    });

    it('and never overlap a solid either — the recordings are legal states', () => {
        // A recorded position that already overlapped a solid would mean
        // the geometry here is wrong, since the real game never lets the
        // player stand inside one.
        for (const name of ['collide-up-rock', 'transition-west-return']) {
            const { ticks } = loadExpectation(name).stream;
            for (const o of ticks) {
                const world = o.level === 0 ? L0 : L94;
                expect(world.collidesSolid(playerBox(o.x, o.y)),
                    `${name} tick ${o.t} at (${o.x},${o.y})`).toBeNull();
            }
        }
    });
});
