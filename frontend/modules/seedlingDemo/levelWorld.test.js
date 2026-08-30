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

import { SPINNER } from './spinner.js';
import {
    ACTIVATOR_RESPONDERS,
    CLIFFSIDE_CLASS,
    CLIFFSIDE_FRAME_MASKS,
    ENTITY_CLASSES,
    LIVE_GEOMETRY_KEYS,
    LevelWorldError,
    MODELLED_TILE_TYPES,
    PICKUP_CLEARS_OWN_TAG,
    PICKUP_WRITES_NO_TAG,
    PLAYER_SOLID_TYPES,
    PUSHABLE_FAMILIES,
    PRE_R5_ROLES,
    RELAXED_ROLES,
    ROLES,
    SPINNER_PRESS_BOX,
    STAIRS_TAGS,
    ADDED_TIME_REMOVAL,
    ADDED_TIME_PROPERTIES,
    addedTimeKey,
    buildLevelWorld,
    cliffSideClassFor,
    entityRect,
    hazardDisposition,
    isNormalizedLiveOpts,
    maskHitsBox,
    maskPlacement,
    normalizeLiveOpts,
    rect,
    rectsOverlap,
    ARROW_COVER_TYPES,
} from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { SEEDLING_PIXEL_MASKS } from './seedlingPixelMasks.js';
import { loadExpectation, loadTape } from './fixtures/index.js';
import { HITBOX } from './playerPhysicsV1.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import {
    TILE_COLUMN_TO_TYPE, TILE_TYPE_ENTITY_TYPES,
} from '../flashPanel/seedlingSemantics.js';

const MAP = JSON.parse(readFileSync(
    fileURLToPath(new URL('../flashPanel/atlases/seedling-map.json', import.meta.url)),
    'utf8',
));

/**
 * The committed R1 route — R2's blocking census is SCOPED to the levels it
 * enters, so the route is what says which levels the guard covers.
 */
const R1_ROUTE = JSON.parse(readFileSync(
    fileURLToPath(new URL('./fixtures/r1-route.json', import.meta.url)),
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

    it('classifies every TRIGGER tag in ALL 116 levels, not just the fixtures', () => {
        // Wider than the rest of the census on purpose. The other tags only
        // have to cover the levels v2 loads, but triggers define the LEVEL
        // GRAPH — slice 4 walks it, and a level graph with a whole tag
        // missing is not a loud throw somewhere useful, it is an exit that
        // silently does not exist until something tries to stand on it.
        // This is the guard that would have caught `stairsup`, which was
        // absent while `stairsdown` was present: same class, same trigger,
        // 26 placements, and one of the four arrivals that land on another
        // trigger.
        const triggerish = new Set();
        for (const L of MAP.levels) {
            for (const e of L.entities) {
                if (e.type === 'teleporter' || e.type.startsWith('stairs')) {
                    triggerish.add(e.type);
                }
            }
        }
        expect([...triggerish].sort()).toEqual(['stairsdown', 'stairsup', 'teleporter']);
        for (const tag of triggerish) {
            expect(ENTITY_CLASSES[tag]?.collider, `${tag} is not a classified trigger`)
                .toBe('trigger');
        }
    });

    it('both stair tags are the SAME class and the same trigger', () => {
        // Game.as:2167-2168 differ only in Stairs' third argument, and `_up`
        // picks a sprite frame, a sound index and a render flag — the
        // super(...) call is identical, so the geometry must be too.
        const { src: _up, ...up } = ENTITY_CLASSES.stairsup;
        const { src: _down, ...down } = ENTITY_CLASSES.stairsdown;
        expect(up).toEqual(down);
        expect(STAIRS_TAGS).toEqual(['stairsup', 'stairsdown']);
    });

    it('a stairsup gets Stairs\' forced tag = -1, like a stairsdown', () => {
        // `Stairs` passes tag = -1 and invert = false to super regardless of
        // direction, so neither stair tag can ever be `deactivated`.
        const w = buildLevelWorld({
            level: 999, width: 2, height: 2, layers: [],
            entities: [{
                type: 'stairsup', x: 0, y: 0,
                attrs: { flip: '0', to: '37', playerx: '576', playery: '144' },
            }],
        });
        expect(w.teleporters[0]).toMatchObject({
            isStairs: true, tag: -1, invert: false, deactivated: false, to: 37,
        });
        expect(w.teleporters[0].arrival).toEqual({ x: 584, y: 152 });
    });

    it('every class entry cites the source it was transcribed from', () => {
        // The provenance IS the review surface — the source is out of repo.
        for (const [tag, cls] of Object.entries(ENTITY_CLASSES)) {
            expect(cls.src, `${tag} has no src`).toBeTruthy();
            expect(Array.isArray(cls.roles), `${tag} has no roles`).toBe(true);
            expect(cls.roles.length, `${tag} is classified for nothing`).toBeGreaterThan(0);
            for (const role of cls.roles) expect(ROLES).toContain(role);
            if (cls.roles.includes('blocking')) {
                expect(['rect', 'pixelmask', 'trigger', 'rope', 'none'])
                    .toContain(cls.collider);
                // A class that does not block must say WHY, so nobody later
                // reads the omission as an oversight and "fixes" it.
                if (cls.collider === 'none') expect(cls.why, `${tag} has no why`).toBeTruthy();
            } else {
                // An entry that declines the blocking role must say what it
                // IS, or "unclassified for blocking" reads as an oversight.
                expect(cls.why, `${tag} has no why`).toBeTruthy();
                expect(cls.collider, `${tag} declines blocking but has a collider`)
                    .toBeUndefined();
            }
        }
        expect(CLIFFSIDE_CLASS.src).toBeTruthy();
    });

    it('every blocking answer AGREES with the game\'s own solids list', () => {
        // ⚠ The strongest check in this file, and it exists because "this
        // does not block" is exactly the kind of claim that survives being
        // wrong. Every entry declares the `type` its constructor assigns;
        // `PLAYER_SOLID_TYPES` is `Mobile.solids` plus the Player's own
        // push. The two must agree — a collider on a type that is not in the
        // list, or no collider on a type that IS, is a transcription error
        // the table can catch about itself.
        //
        // Four classes change `type` under a condition and are named here
        // rather than silently exempted.
        const CONDITIONAL = {
            // ⛔ CORRECTED AT R5 SLICE 20 AND THIS COPY ROTTED FOR THREE
            // SLICES. It said "Enemy at rest, Solid whenever the player is
            // outside its 128 px range" — the misread of which `if` the
            // else belongs to that `ENTITY_CLASSES` itself now records at
            // length. The else is `if (currentAnim != "dead")`, so only a
            // CORPSE is ever solid. [[feedback_retired_oracle_check_the_regen]]
            iceturret: '"Enemy" while alive; `type = "Solid"` is the else-arm of '
                + '`if (currentAnim != "dead")` (IceTurret.as:93-95), so only a corpse '
                + 'is a wall — and only from the first tick the player is off it',
            // ⛓⛓⛓ R5 SLICE 23: and the reverse of the turret's, which is
            // why the pair is worth reading together.
            bosstotem: '"Solid" until it wakes — `type = "Solid"` is the ELSE of '
                + '`if (activated)` (BossTotem.as:294-315) — and "Enemy" for ever '
                + 'after, so an UNWOKEN boss is the wall and the wake is what removes '
                + 'it. ONE instance (level 43), and nothing had ever been in the room',
            fallrock: '"" and parked off-map while its persistence holds, "Solid" '
                + 'once a clear arms it (FallRock.as:39-47)',
            fallrocklarge: 'as fallrock (FallRockLarge.as:45-53)',
        };
        for (const [tag, cls] of Object.entries(ENTITY_CLASSES)) {
            if (!cls.roles.includes('blocking')) continue;
            if (cls.collider === 'trigger' || cls.type === null) continue;
            if (tag in CONDITIONAL) continue;
            const blocks = cls.collider !== 'none';
            expect(PLAYER_SOLID_TYPES.includes(cls.type), `${tag} declares type `
                + `"${cls.type}" and collider "${cls.collider}"`).toBe(blocks);
        }
        // ...and the exemption list is not a place to hide: each named class
        // must really be classified, and really be one of the three.
        for (const tag of Object.keys(CONDITIONAL)) {
            expect(ENTITY_CLASSES[tag].roles, tag).toContain('blocking');
        }
    });

    it('a CLEARED tag despawns, shrinks, or is refused — never "removed by tag"', () => {
        // The three responses are genuinely different and collapsing them
        // would be wrong two ways out of three.
        //
        // DESPAWN: L71's chest (tag 1) and its tSet -1 lock (tag 0).
        const before = buildLevelWorld(levelRecord(71));
        expect(before.solids.some((r) => r.tag === 'chest')).toBe(true);
        const after = buildLevelWorld(levelRecord(71), { cleared: [0, 1] });
        expect(after.solids.some((r) => r.tag === 'chest')).toBe(false);
        expect(after.activators.filter((a) => a.tag === 'lock').map((a) => a.t))
            .toEqual([0]);   // the tSet -1 one is gone; group 0's remains

        // ⚠ NOT DESPAWNED: L71's `lock@112,160` is tset 0, and
        // `Lock.check()` needs tSet < 0. Its tag is 3.
        const withThree = buildLevelWorld(levelRecord(71), { cleared: [3] });
        expect(withThree.solids.filter((r) => r.tag === 'lock')).toHaveLength(2);

        // SHRINK: L39's rope keeps a one-cell solid at its start.
        const rope = buildLevelWorld(levelRecord(39), { roles: RELAXED_ROLES, cleared: [9] })
            .solids.find((r) => r.tag === 'rope');
        expect(rope.rect).toMatchObject({ x: 96, right: 112 });

        // ARM: clearing a FallRock tag is refused by name, because it would
        // ADD a live blocker rather than remove one.
        expect(() => buildLevelWorld(levelRecord(74), { cleared: [2] }))
            .toThrow(/BUILDS IT FALLEN/);
    });

    /**
     * ⛓⛓ R7 SLICE 6f — A SANDTRAP THE ROOM KILLS WRITES ITS OWN CLEAR, and
     * the clear is what the model is told.
     *
     * L8's puzzle is two sandtraps in one arrowtrap's lane, and nothing in
     * this tree models an Arrow killing an Enemy (§16.4, still refused). It
     * does not have to: `SandTrap.check()` removes a body whose tag is
     * cleared and `SandTrap.removed()` writes that clear, so the kill's
     * DURABLE consequence is a flag the game produces and a v9 `at`-clear
     * carries. Before this row the clear THREW by name — which is how the
     * row was found — so the pair here is the throw's positive control and
     * the despawn together.
     */
    it('a cleared SANDTRAP tag removes the body — L8 is two clears, not a fight', () => {
        const l8 = levelRecord(8);
        const roles = [...RELAXED_ROLES, 'combat'];
        const before = buildLevelWorld(l8, { roles });
        const traps = (w) => w.combat.enemies.filter((e) => e.tag === 'sandtrap')
            .map((e) => `${e.x},${e.y}`).sort();
        expect(traps(before)).toEqual(['96,128', '96,80']);

        // ⛔ ONE TAG, ONE BODY. `{8,0}` is `sandtrap@96,80` and `{8,1}` is
        // `sandtrap@96,128`, so a route that earns one clear may not walk
        // through the other's cell.
        const first = buildLevelWorld(l8, { roles, cleared: [0] });
        expect(traps(first)).toEqual(['96,128']);
        const both = buildLevelWorld(l8, { roles, cleared: [0, 1] });
        expect(traps(both)).toEqual([]);

        // ...and the body is gone from the SOLIDS-for-a-mover view too, not
        // just from the census — the L6 lesson (`Bob.solids` contains
        // "Enemy") means one body must never be gone for one list and
        // present for another.
        expect(before.combat.enemies.length - both.combat.enemies.length).toBe(2);
    });

    it('a clear can turn a TELEPORTER ON, and one nobody reads is a throw', () => {
        // `Teleporter.checkDeactivated` is
        // `tag >= 0 && (!checkPersistence(tag) == invert)`, so a tagged
        // non-inverted teleporter is dead on a fresh boot and live once its
        // tag clears. v2 hardcoded persistence true and could not express it.
        const tagged = MAP.levels
            .map((l) => ({ l, tp: (l.entities ?? []).find((e) => e.type === 'teleporter'
                && Number(e.attrs?.tag ?? -1) >= 0 && Number(e.attrs?.invert ?? 0) === 0) }))
            .find((r) => r.tp);
        expect(tagged, 'some level has a tagged non-inverted teleporter').toBeTruthy();
        const tag = Number(tagged.tp.attrs.tag);
        const shut = buildLevelWorld(tagged.l, { roles: RELAXED_ROLES });
        const open = buildLevelWorld(tagged.l, { roles: RELAXED_ROLES, cleared: [tag] });
        const at = (w) => w.teleporters.find((t) => t.x === tagged.tp.x && t.y === tagged.tp.y);
        expect(at(shut).deactivated).toBe(true);
        expect(at(open).deactivated).toBe(false);

        // ...and a clear no entity in the level responds to is a THROW.
        expect(() => buildLevelWorld(levelRecord(71), { cleared: [29] }))
            .toThrow(/which no entity in this level reads/);
    });

    it('a rope is sized from its NODE, not from a constant', () => {
        // Level 39's rope runs (96,384) -> (192,384), so its hitbox is
        // 192 - 96 + 16 = 112 wide: seven tiles, not one.
        const w39 = buildLevelWorld(levelRecord(39), { roles: RELAXED_ROLES });
        const rope = w39.solids.find((r) => r.tag === 'rope');
        expect(rope.span).toEqual({ xend: 192, w: 112 });
        expect(rope.rect).toMatchObject({ x: 96, y: 384, right: 208, bottom: 400 });
        expect(rope.cls.type).toBe('Rope');
        expect(PLAYER_SOLID_TYPES).toContain('Rope');
        // and a rope whose node the extract lost is a LOUD failure, not a stub
        expect(() => buildLevelWorld({
            level: 999, width: 20, height: 20, layers: [],
            entities: [{ type: 'rope', x: 0, y: 0, attrs: { tset: '0', tag: '0' } }],
        })).toThrow(/with no <node> child/);
    });

    it('an entity absent from the table is a NAMED failure, not a silent non-collider', () => {
        expect(() => buildLevelWorld({
            level: 999, width: 2, height: 2, layers: [],
            entities: [{ type: 'nosuchtag', x: 0, y: 0 }],
        })).toThrow(/nosuchtag.*not in the transcribed class table/s);
    });

    it('an unknown layer is a NAMED failure', () => {
        expect(() => buildLevelWorld({
            level: 999, width: 2, height: 2, entities: [],
            layers: [{ name: 'decals', tiles: [] }],
        })).toThrow(/layer "decals" that loadlevel does not build/);
    });
});

describe('plannerBlockerAt — the same geometry, reported instead of returned', () => {
    // `collidesSolid` is the PHYSICS query: it answers "did the sweep stop"
    // and returns the blocker. `plannerBlockerAt` is the PLANNING query and
    // is strictly WIDER — it also reports the things that do not stop the
    // player but end the run anyway (unmodelled terrain). The tests below
    // pin that the two agree wherever they overlap.
    //
    // ⚠ At v2 the difference was a THROW: a pixelmask was unmodelled, so the
    // physics died loudly and the planner reported. R2 models the masks, so
    // both faces now answer from the same `maskHitsBox` — and BOTH use the
    // real bitmap, not the bounding rect, because a doorway is route-critical
    // (kickoff §8.5).

    it('reports a pixelmask exactly where collidesSolid returns one', () => {
        const mask = L0.pixelmasks[0];
        const box = playerBox(mask.rect.x + 4, mask.rect.y + 4);
        expect(L0.collidesSolid(box)).toBe(mask);
        expect(L0.plannerBlockerAt(box)).toMatchObject({ kind: 'pixelmask', blocker: mask });
    });

    it('reports what collidesSolid returns', () => {
        const rock = L0.solids.find((s) => s.tag === 'breakablerock');
        const box = playerBox(rock.rect.x + 8, rock.rect.y + 8);
        expect(L0.collidesSolid(box)).toBe(rock);
        expect(L0.plannerBlockerAt(box)).toMatchObject({ kind: 'solid', blocker: rock });
    });

    it('⛓ R5 slice 4: the unmodelled-terrain arm is now VACUOUS, and water '
        + 'is refused one layer up instead', () => {
        // This arm used to be how a planner refused water: water was walkable
        // GEOMETRY — no solid, no mask — and standing on it ended the run
        // through `assertModelledTerrain`. Slice 4 modelled water (the swim
        // sound term became reproducible under the pin), so `MODELLED_TILE_SET`
        // now holds every type `TILE_COLUMN_TO_TYPE` produces and this loop
        // can never fire for a real tile.
        //
        // ⚠ THE THING TO CHECK BEFORE BELIEVING THAT IS SAFE is whether the
        // planner still refuses to route into a lake. It does, one layer up:
        // R4's `lethal-terrain` policy in `botDriverV2.plannerObstacleAt`
        // already listed water with a `canSwim` exemption — written for
        // exactly this moment. Refused as LETHAL instead of as UNMODELLED,
        // which is the more accurate reason and the same answer.
        const water = L0.tiles.find((t) => t.t === 1);
        const box = playerBox(water.x, water.y);
        const probe = { ...box, y: box.y + 1, bottom: box.bottom + 1 };
        expect(L0.collidesSolid(box)).toBeNull();
        expect(L0.plannerBlockerAt(box)).toBeNull();
        expect(L0.plannerBlockerAt(box, probe)).toBeNull();
        // ...and the tile is on the list the surviving policy reads.
        expect(L0.lethalTerrainTiles.some((t) => t.t === 1)).toBe(true);
    });

    it('the terrain arm needs the probe rect passed in, not derived here', () => {
        // `checkOffsetY` belongs to the PLAYER (`Player.as:416`), not to the
        // level, so this module does not own it and does not invent it.
        // Omitting the rect asks a pure geometry question instead.
        const water = L0.tiles.find((t) => t.t === 1);
        expect(L0.plannerBlockerAt(playerBox(water.x, water.y))).toBeNull();
    });

    it('is clear where the physics is clear', () => {
        expect(L0.plannerBlockerAt(playerBox(88, 136), playerBox(88, 137))).toBeNull();
        expect(L0.collidesSolid(playerBox(88, 136))).toBeNull();
    });
});

describe('R4: the pushable census, and the live rect the run owns', () => {
    // A pushable is the one solid on the map whose rect is a function of
    // what the player has DONE. The geometry stays here; the position lives
    // in the run (`pushables.js`), and both queries take it as an option
    // for exactly the reason they take `openActivators`.
    const withBlocks = () => buildLevelWorld({
        level: 999,
        width: 20,
        height: 20,
        layers: [],
        entities: [
            { type: 'pushableblockspear', x: 176, y: 128, attrs: {} },
            { type: 'pushableblock', x: 32, y: 32, attrs: {} },
            { type: 'rock3', x: 96, y: 96, attrs: {} },
        ],
    });

    it('records the FAMILY, because the class hierarchy disagrees with it', () => {
        // `PushableBlockSpear extends PushableBlockFire` and shares its
        // target-tile `input()`. Plain `PushableBlock` extends `Mobile`
        // directly with a walk-pushed one, and no arm of `genericHit` names
        // it at all — so the two are different mechanics under one name.
        expect(PUSHABLE_FAMILIES).toEqual({
            pushableblockspear: 'fire', pushableblockfire: 'fire', pushableblock: 'walk',
        });
        const w = withBlocks();
        expect(w.pushables.map((p) => [p.tag, p.family, p.x, p.y])).toEqual([
            ['pushableblockspear', 'fire', 176, 128],
            ['pushableblock', 'walk', 32, 32],
        ]);
        // ...and each is still an ordinary solid, with the id that joins
        // the two views.
        const solid = w.solids.find((s) => s.tag === 'pushableblockspear');
        expect(solid.pushableId).toBe('pushableblockspear@176,128');
        expect(w.solids.find((s) => s.tag === 'rock3').pushableId).toBeUndefined();
    });

    it('without the run\'s state it is the SPAWN rect — which is every frozen tape', () => {
        const w = withBlocks();
        expect(w.collidesSolid(playerBox(180, 132))).toMatchObject({ tag: 'pushableblockspear' });
        expect(w.collidesSolid(playerBox(160, 132))).toBeNull();
    });

    it('with it, both queries answer at the block\'s LIVE position', () => {
        const w = withBlocks();
        const live = new Map([['pushableblockspear@176,128', {
            rect: rect(160, 128, 16, 16), removed: false,
        }]]);
        // The vacated cell is clear...
        expect(w.collidesSolid(playerBox(180, 132), { pushables: live })).toBeNull();
        expect(w.plannerBlockerAt(playerBox(180, 132), null, { pushables: live })).toBeNull();
        // ...and the cell it moved into is not.
        expect(w.collidesSolid(playerBox(164, 132), { pushables: live }))
            .toMatchObject({ tag: 'pushableblockspear', live: true });
        expect(w.plannerBlockerAt(playerBox(164, 132), null, { pushables: live }))
            .toMatchObject({ kind: 'solid', blocker: { tag: 'pushableblockspear', live: true } });
    });

    it('a REMOVED block blocks nothing, in both queries', () => {
        const w = withBlocks();
        const live = new Map([['pushableblockspear@176,128', {
            rect: rect(160, 128, 16, 16), removed: true,
        }]]);
        expect(w.collidesSolid(playerBox(164, 132), { pushables: live })).toBeNull();
        expect(w.plannerBlockerAt(playerBox(164, 132), null, { pushables: live })).toBeNull();
    });

    it('the three R4 chain levels each hold exactly the block §11 pushes', () => {
        // §11.2's table, from the extract rather than from the plan: one
        // block each in L63, L65 and L67, and all three are the spear
        // variant (the only family a press can move).
        for (const level of [63, 65, 67]) {
            const w = buildLevelWorld(levelRecord(level), { roles: RELAXED_ROLES });
            expect(w.pushables.map((p) => p.family)).toEqual(['fire']);
            expect(w.pushables[0].tag).toBe('pushableblockspear');
        }
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

    it('the statue stacks TWO constructor offsets, and slice 1 applied one', () => {
        // ⚠ CORRECTED at v2 slice 4 — by the real game, not by re-reading.
        // `Statue` is the only class in the table that offsets on top of
        // NPC's:
        //     Statue  super(_x + Tile.w, _y - Tile.h/2 + Tile.h*int(_t==0))
        //             = (+16, -8), since the statue2 tag passes _t = 1 and
        //               the third term is therefore zero
        //     NPC     super(_x + Tile.w/2, _y + Tile.h/2, _g) = (+8, +8)
        // Slice 1 read the first and stopped, putting the rect 8 px up and
        // left of the truth, and nothing noticed until `thread-the-gap`
        // planned a route through it: the game pinned x at
        // 181.17065141119556 against a left edge of 184 that the model did
        // not have. See the entry's own comment for the full trail.
        expect(ENTITY_CLASSES.statue2.dx).toBe(24);
        expect(ENTITY_CLASSES.statue2.dy).toBe(0);
        expect(entityRect(ENTITY_CLASSES.statue2, 184, 160))
            .toMatchObject({ x: 184, y: 160, right: 232, bottom: 184 });
        // The stop the game recorded, to the pixel: one more step right
        // would put the player's box edge at 184.17 and inside the statue.
        expect(rectsOverlap(playerBoxAt(181.17065141119556, 183.31024524876432),
            entityRect(ENTITY_CLASSES.statue2, 184, 160))).toBe(false);
        expect(rectsOverlap(playerBoxAt(182.17065141119556, 183.31024524876432),
            entityRect(ENTITY_CLASSES.statue2, 184, 160))).toBe(true);
    });

    it('every other NPC passes its coordinates straight through to NPC', () => {
        // The counter-check that makes the correction above a one-class fix
        // rather than a guess: `IntroCharacter`, `AdnanCharacter`,
        // `Rekcahdam` and `Watcher` all call `super(_x, _y, spr, ...)`, so
        // NPC's half-tile IS their whole offset.
        for (const tag of ['introchar', 'adnanchar', 'rekcahdam']) {
            expect([tag, ENTITY_CLASSES[tag].dx, ENTITY_CLASSES[tag].dy])
                .toEqual([tag, 8, 8]);
        }
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

    it('builds a bridge tile as an OBJECT solid, not as terrain', () => {
        // v2 failed the whole level here. R1 reads the timer instead of the
        // table: `bridgeOpeningTimer` starts at 60 and the ONLY line in the
        // codebase that decrements it is Player.as:1098, under `t ==
        // "Spear"` — so on a run that never presses an attack key the bridge
        // is "Solid" every frame, deterministically. It is an OBJECT solid
        // because the type comes from render(), which the Engine drives
        // independently of the blackCover gate, so it is armed on tick 1
        // while an ordinary Stone is still typed "Tile".
        const bridgeColumn = TILE_COLUMN_TO_TYPE.indexOf(29);
        const w = buildLevelWorld({
            level: 999, width: 1, height: 1, entities: [],
            layers: [{ name: 'tiles', tiles: [[0, 0, bridgeColumn * 16, 0]] }],
        });
        expect(w.solids).toHaveLength(1);
        expect(w.objectSolids).toHaveLength(1);
        expect(w.solids[0].tag).toBe('tile:Bridge');
        // ...and it is not a getState candidate WHILE IT IS CLOSED, which
        // is what `walkableTiles` records. R4 opens it: the type is legal
        // terrain now, and the run's `openBridges` is what promotes the
        // tile into the candidate list for the ticks it is open.
        expect(w.walkableTiles).toHaveLength(0);
        expect(MODELLED_TILE_TYPES).toContain(29);
        expect(w.solids[0].bridgeId).toBe('0,0');
        expect(w.collidesSolid(playerBox(8, 8), { openBridges: new Set(['0,0']) })).toBeNull();
        expect(w.nearestWalkableTile(8, 8, { openBridges: new Set(['0,0']) }))
            .toMatchObject({ t: 29, tx: 0, ty: 0 });
        // The three route levels this unblocks — 61 and 63 stand between the
        // walk and both ghostspear and health.
        expect(() => buildLevelWorld(levelRecord(61), { roles: RELAXED_ROLES }))
            .not.toThrow();
        expect(() => buildLevelWorld(levelRecord(63), { roles: RELAXED_ROLES }))
            .not.toThrow();
    });

    it('⛓ R5 slice 4: EVERY tile type is modelled now, which makes the throw a '
        + 'BOUNDED VACUITY', () => {
        // Stated as a COMPLEMENT, so the list cannot drift in either
        // direction: silently dropping a type would narrow v2's scope
        // without anyone noticing, and silently adding one of the six back
        // would let a fixture onto sound-coupled or input-stealing terrain.
        // ⚠ R1 MOVED 6 (Pit) OUT of this list: it is modelled, as a
        // TRANSPORT rather than as a floor.
        //
        // ⚠ R4 MOVED 17 (Lava), 22 (Ice) AND 25 (Waterfall) OUT, which is
        // what lets a tape ARM them: `noHazards` decides whether the
        // resolver's answer is coerced, and this list decides whether an
        // uncoerced answer is legal terrain at all.
        //
        // ⚠ R4 MOVED 29 (Bridge) IN. It is a solid while it is CLOSED and
        // `type = "Tile"` from the render that opens it, so `state` really
        // can be 29 once a spear press has been thrown — see the
        // `openBridges` arm of `nearestWalkableTileWithTie`.
        //
        // ⛓⛓ AND R5 SLICE 4 MOVED **1 (Water)** IN, which empties the
        // complement. Water was never untranscribed — `checkDrowning`'s
        // water arm and the shared friction and speed all landed at R4 —
        // it was NOT REPRODUCIBLE, because `Player.as:530` adds
        // `0.25 * int(Music.soundPosition("Swim") < 0.1)` off the Web Audio
        // mixer's WALL CLOCK. Slice 2 ran one tape at 0.4 fps and 10.1 fps
        // and the streams parted four ticks after the water edge. The pin
        // is what changed, not the transcription.
        //
        // ⛔ SO THIS THROW IS NOW A BOUNDED VACUITY, AND THE BOUND IS
        // NAMED: `TILE_COLUMN_TO_TYPE` produces exactly types 0..37, every
        // one of which is modelled, so `assertModelledTerrain` can no
        // longer fire for any tile the extract can carry. What it still
        // catches is a RESOLVER returning a value that is not a tile type
        // at all — a different defect, and one worth keeping a guard for.
        //
        // ⚠ AND THE PLANNER IS UNAFFECTED, which is the thing to check
        // before believing any of this is safe. R4's `lethal-terrain`
        // policy in `botDriverV2.plannerObstacleAt` already listed water
        // with a `canSwim` exemption — written for exactly this moment —
        // so an armed water tile went from being refused as UNMODELLED to
        // being refused as LETHAL. It is still forbidden floor.
        const excluded = [];
        const all = TILE_TYPE_ENTITY_TYPES.map((_, t) => t);
        expect([...MODELLED_TILE_TYPES].sort((a, b) => a - b))
            .toEqual(all.filter((t) => !excluded.includes(t)));
        expect(excluded).toEqual([]);
        // The guard still fires — for a value no tile carries.
        expect(() => L0.assertModelledTerrain(999)).toThrow(LevelWorldError);
        expect(L0.assertModelledTerrain(1)).toBe(1);     // Water — R5 slice 4
        expect(L0.assertModelledTerrain(6)).toBe(6);     // Pit — R1 transport
        expect(L0.assertModelledTerrain(17)).toBe(17);   // Lava — R4
        expect(L0.assertModelledTerrain(22)).toBe(22);   // Ice — R4
        expect(L0.assertModelledTerrain(25)).toBe(25);   // Waterfall — R4
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
        // Probed one pixel off the cell centre ON PURPOSE. The centre
        // itself, (248,120), is an exact TIE between (15,6) Water and (16,7)
        // Waterfall — two DIFFERENT terrains 16 px away in opposite
        // directions — which the resolver now refuses rather than resolving
        // by FlashPunk's entity-list order. One pixel is enough to break it
        // and changes nothing about the claim being made here.
        const near = L0.nearestWalkableTile(247, 120);
        expect(near.entityType).toBe('Tile');
        expect([near.tx, near.ty]).not.toEqual([15, 7]);
    });

    it('REPORTS an exact nearestToPoint tie, without an opinion about it', () => {
        // Live in a committed level, not hypothetical: standing dead centre
        // on level 0's cliff at (248,120) leaves Water and Waterfall exactly
        // equidistant, 16 px away in opposite directions. The game picks by
        // entity-list order (addUpdate PREPENDS, so it is the reverse of the
        // extract's); this module does not transcribe that order, so it says
        // there IS a tie and lets the physics decide whether it matters —
        // which depends on the tape's relaxation, something geometry cannot
        // know. See playerPhysicsV2.resolveTerrainState.
        const tied = L0.nearestWalkableTileWithTie(248, 120);
        expect(tied.tie).not.toBeNull();
        expect([tied.tile.t, tied.tie.t].sort((a, b) => a - b)).toEqual([1, 25]);
        // Neither face throws: the report is data.
        expect(() => L0.nearestWalkableTile(248, 120)).not.toThrow();
        // A tie between tiles of the SAME type is not an ambiguity at all —
        // both resolve to the same state — and is not reported, or a full
        // tile grid would report one on nearly every probe.
        expect(L0.nearestWalkableTileWithTie(88, 128).tie).toBeNull();
    });

    it('beforeTypeFlip drops the TILE solids and keeps the object ones', () => {
        // A Tile is constructed `type = "Tile"` and only becomes "Solid" in
        // its own first update (Tile.as:117-122), while every object class
        // assigns its type in its CONSTRUCTOR — so on a world's first live
        // tick the object solids are the whole list. `World.addUpdate`
        // prepends and loadlevel adds the tiles before the Player, so the
        // Player really does read the lists in that state. The game's own
        // comment at that update says the ordering is deliberate.
        expect(L0.objectSolids.length).toBeGreaterThan(0);
        expect(L0.objectSolids.length).toBeLessThan(L0.solids.length);
        expect(L0.solids.length - L0.objectSolids.length)
            .toBe(L0.tiles.filter((t) => t.entityType === 'Solid').length);
        expect(L0.objectSolids.every((s) => s.cls !== null)).toBe(true);
    });

    it('beforeTypeFlip lets a solid TILE be walked through, but not an object', () => {
        // Level 0's only solid terrain is the cliff at tile (15,7).
        const onCliff = playerBox(248, 120);
        expect(L0.collidesSolid(onCliff)).toMatchObject({ tag: 'tile:Cliff' });
        expect(L0.collidesSolid(onCliff, { beforeTypeFlip: true })).toBeNull();
        // The BreakableRock is an object and blocks on tick 1 too — which
        // is why collide-up-rock is unaffected by any of this.
        expect(L0.collidesSolid(playerBox(88, 129.5), { beforeTypeFlip: true }))
            .toMatchObject({ tag: 'breakablerock' });
    });

    it('beforeTypeFlip widens nearestWalkableTile to every tile', () => {
        // Same fact from the terrain side: on tick 1 the "Tile" list still
        // holds the solid cells, so the nearest candidate over the cliff is
        // the cliff itself rather than a neighbour.
        expect(L0.nearestWalkableTile(248, 120, { beforeTypeFlip: true }))
            .toMatchObject({ tx: 15, ty: 7, entityType: 'Solid' });
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
        expect(L94.pixelmasks.filter((p) => p.tag.startsWith('cliffside'))).toHaveLength(9);
        expect(L0.pixelmasks.filter((p) => p.tag.startsWith('cliffside'))).toHaveLength(0);
    });

    it('TreeLarge\'s ctor offset and mask offset cancel', () => {
        // Entity at (x+80, y+96), mask offset (-80,-96), mask 160x192 — so
        // the mask lands on the raw oel coordinates. Dropping either half
        // would move it by most of its own size.
        const tl = L94.pixelmasks.find((p) => p.tag === 'treelarge');
        expect(tl.rect).toMatchObject({ x: 80, y: 0, right: 240, bottom: 192 });
    });

    it('overlapping one BLOCKS, and reports the entity that did it', () => {
        // The positive control: R2 replaced the throw with a model, and a
        // model that never returns a blocker is the same vacuity in a new
        // costume. Level 0's building mask spans [64,128) x [64,112) and is
        // solid in the middle.
        const hit = L0.collidesSolid(playerBox(96, 88));
        expect(hit).not.toBeNull();
        expect(hit.tag).toBe('building');
        expect(hit.cls.as3).toBe('Building');
    });

    it('a pixelmask entry with NO committed mask still throws, at BUILD time', () => {
        // The seam did not go away, it moved earlier and got more specific:
        // it now names the CLASS at construction rather than the fixture at
        // collision, so a mask nobody extracted cannot quietly degrade into
        // a bounding rect.
        expect(() => maskPlacement({ ...ENTITY_CLASSES.building, mask: 'NoSuchMask' }, 0, 0))
            .toThrow(/mask "NoSuchMask" is not in/);
        // ...and the same for an entry that declares the collider and no
        // mask at all, which is how a newly-classified class arrives.
        expect(() => maskPlacement({ as3: 'Whatever', collider: 'pixelmask' }, 0, 0))
            .toThrow(LevelWorldError);
    });

    it('BOTH slice-0 fixture routes stay clear of every mask', () => {
        // The claim the fixtures rest on, checked rather than asserted in
        // prose: replay every recorded position through the real query and
        // require that none of them reports a pixelmask. These recordings
        // predate the model, so this is also the proof that modelling the
        // masks did not move a single committed fixture.
        for (const name of ['collide-up-rock', 'transition-west-return']) {
            const { ticks } = loadExpectation(name).stream;
            for (const o of ticks) {
                const world = o.level === 0 ? L0 : L94;
                const hit = world.collidesSolid(playerBox(o.x, o.y));
                expect(hit?.mask, `${name} tick ${o.t} at (${o.x},${o.y}) in level ${o.level}`)
                    .toBeUndefined();
            }
        }
    });

    // ── R2 slice 1: the masks themselves ─────────────────────────────
    //
    // Stratum 1 is HAND-READ: values taken off the committed artifact by
    // eye, which is the whole reason that artifact is `#`/`.` rows rather
    // than hex. Stratum 2 is the arithmetic. Neither derives from the other.

    it('the committed masks are the eighteen the game embeds, at their real sizes', () => {
        // ⛔ SEVENTEEN BECAME EIGHTEEN AT R5. `TentacleBeastMask.png` was
        // skipped by the extractor's own docblock on the reading that
        // "TentacleBeast extends Enemy, so its type is Enemy, which is in no
        // solids list" — and `TentacleBeast.as:46` overwrites that type with
        // "Solid", exactly as `BombPusher.as:31` does. L57 could not be
        // built without it.
        expect(Object.keys(SEEDLING_PIXEL_MASKS)).toHaveLength(18);
        // Hand-read from the PNG headers, not from the extractor.
        expect(SEEDLING_PIXEL_MASKS.BuildingMask).toMatchObject({ w: 64, h: 48 });
        expect(SEEDLING_PIXEL_MASKS.OpenTreeMask).toMatchObject({ w: 32, h: 32 });
        expect(SEEDLING_PIXEL_MASKS.TreeLargeMask).toMatchObject({ w: 160, h: 192 });
        expect(SEEDLING_PIXEL_MASKS.TentacleBeastMask).toMatchObject({ w: 46, h: 44 });
        for (const name of CLIFFSIDE_FRAME_MASKS) {
            expect(SEEDLING_PIXEL_MASKS[name]).toMatchObject({ w: 16, h: 16 });
        }
        // Every row is exactly `w` wide and holds only `#` and `.` — the
        // artifact is generated, so this is guarding the GENERATOR.
        for (const [name, m] of Object.entries(SEEDLING_PIXEL_MASKS)) {
            expect(m.rows, name).toHaveLength(m.h);
            for (const row of m.rows) {
                expect(row.length, name).toBe(m.w);
                expect(/^[#.]+$/.test(row), `${name}: ${row}`).toBe(true);
            }
            expect(m.opaque, name)
                .toBe(m.rows.reduce((n, r) => n + [...r].filter((c) => c === '#').length, 0));
        }
    });

    it('OpenTreeMask has the DOORWAY the health route needs — hand-read', () => {
        // This is the row that decides an item. R2 kickoff §8.5: L65's exit
        // teleporter to the health room sits inside this opening, so a
        // bounding-rect approximation seals a corridor the game walks.
        const m = SEEDLING_PIXEL_MASKS.OpenTreeMask;
        expect(m.rows[19]).toBe('#'.repeat(32));                    // last solid row
        expect(m.rows[20]).toBe(`${'#'.repeat(11)}${'.'.repeat(10)}${'#'.repeat(11)}`);
        expect(m.rows[31]).toBe(m.rows[20]);                        // ...through the bottom
        // and the gap is exactly 10 wide by 12 tall, at x 11..20, y 20..31.
        expect(m.rows.filter((r) => r.includes('.'))).toHaveLength(12);
    });

    it('CliffSideMaskL is the left half, CliffSideMaskU the top — hand-read', () => {
        expect(SEEDLING_PIXEL_MASKS.CliffSideMaskL.rows[0]).toBe('########........');
        expect(SEEDLING_PIXEL_MASKS.CliffSideMaskL.rows[15]).toBe('########........');
        expect(SEEDLING_PIXEL_MASKS.CliffSideMaskU.rows[0]).toBe('################');
        expect(SEEDLING_PIXEL_MASKS.CliffSideMaskU.rows[8]).toBe('................');
    });

    it('the cliffside FRAME comes from the tileset column, and default is U', () => {
        // `Game.as:2013`: new CliffSide(x, y, floor(tx / 16)), and
        // `CliffSide.as:19-32` switches on it in exactly this order. v2
        // dropped the column, which was harmless only while every mask was
        // a 16x16 bounding rect.
        expect(cliffSideClassFor(0).mask).toBe('CliffSideMaskL');
        expect(cliffSideClassFor(16).mask).toBe('CliffSideMaskR');
        expect(cliffSideClassFor(32).mask).toBe('CliffSideMaskLU');
        expect(cliffSideClassFor(48).mask).toBe('CliffSideMaskRU');
        expect(cliffSideClassFor(64).mask).toBe('CliffSideMaskU');
        // The AS3 `default:` arm — anything not 0..3 — is the U mask.
        expect(cliffSideClassFor(80).mask).toBe('CliffSideMaskU');
        expect(cliffSideClassFor(-16).mask).toBe('CliffSideMaskU');
        // ...and a real level carries more than one frame, so the column is
        // load-bearing rather than constant in the committed data.
        expect(new Set(L94.pixelmasks.map((p) => p.cls.mask)).size).toBeGreaterThan(1);
    });

    it('maskHitsBox rounds NEGATIVE box coordinates toward zero, not down', () => {
        // ⚠ This case exists because the mutation "Math.trunc -> Math.floor"
        // did not bite anything else. Every committed mask sits at x,y >= 0
        // and the two agree for positive inputs, so the rule was
        // transcribed correctly and asserted nowhere — a check that cannot
        // fail. It IS reachable: a player at x = 0..1 has box.x = -2..-1,
        // and level 94's cliffsides start at column 0.
        //
        // The mask is hand-built rather than borrowed, because the rule is
        // arithmetic and needs a shape chosen to expose it: one solid pixel
        // at column 2, which lands inside trunc's window [0,3) and outside
        // floor's [0,2).
        const m = { w: 4, h: 1, rows: ['..#.'] };
        expect(maskHitsBox(m, 0, 0, rect(-1.5, 0, 4, 5))).toBe(true);
        // ...and the same box a pixel further left misses it either way, so
        // the assertion above is about the rounding and not about the mask.
        expect(maskHitsBox(m, 0, 0, rect(-2.5, 0, 4, 5))).toBe(false);
    });

    it('maskPlacement APPLIES the class offset — all seventeen happen to be zero', () => {
        // ⚠ Also a mutation-driven test: deleting `+ cls.dx` from
        // `maskPlacement` broke nothing, because in every class the ctor
        // offset and the mask offset CANCEL (TreeLarge's (+80,+96) against
        // (-80,-96), OpenTree's (+16,+16) against (-16,-16)), so every
        // committed `dx`/`dy` is 0. The arithmetic is still the class's, and
        // the next class classified may not cancel — so it is exercised
        // here directly rather than left as an expression nothing reads.
        const shifted = { ...ENTITY_CLASSES.treelarge, dx: 7, dy: -3 };
        expect(maskPlacement(shifted, 100, 100)).toMatchObject({ maskX: 107, maskY: 97 });
        // ⛔ AND THE "ALL SEVENTEEN ARE ZERO" FACT DIED AT R5, which is
        // exactly why it was pinned here rather than left implied.
        // `TentacleBeast` is the eighteenth mask and the first whose two
        // offsets do not cancel: the ctor puts the ENTITY at oel + (24, 24)
        // and the Pixelmask at (-23, -22) from there, so the mask's top-left
        // is oel + (1, 2). Named, so the next reader does not "fix" it back
        // to zero.
        const NON_ZERO_MASK_OFFSETS = { tentaclebeast: [1, 2] };
        for (const [tag, cls] of Object.entries(ENTITY_CLASSES)) {
            if (cls.collider !== 'pixelmask') continue;
            expect([cls.dx, cls.dy], tag).toEqual(NON_ZERO_MASK_OFFSETS[tag] ?? [0, 0]);
        }
    });

    it('maskHitsBox truncates the box TOWARD ZERO, as the C cast does', () => {
        // `bd_hit_test` casts the rect's x/y with `(int32_t)`, which is
        // truncation, not floor. A left-half mask at the origin, so column
        // 7 is solid and column 8 is not.
        const m = SEEDLING_PIXEL_MASKS.CliffSideMaskL;
        // box.x = 4.9 truncates to 4; columns 4..7 are scanned; 7 is solid.
        expect(maskHitsBox(m, 0, 0, rect(4.9, 4, 4, 5))).toBe(true);
        // box.x = 8.0 scans 8..11, all transparent.
        expect(maskHitsBox(m, 0, 0, rect(8, 4, 4, 5))).toBe(false);
        // ⚠ and 7.9 truncates DOWN to 7, so it still touches the solid half
        // — a floor would agree here, which is why the negative below is the
        // one that would catch a wrong rounding mode if x could go negative.
        expect(maskHitsBox(m, 0, 0, rect(7.9, 4, 4, 5))).toBe(true);
    });

    it('maskHitsBox misses through a gap a bounding rect would have blocked', () => {
        // The claim in one assertion: same mask, same box, opposite answers
        // from the two models. Without this the doorway test above is just a
        // fact about a PNG.
        const m = SEEDLING_PIXEL_MASKS.OpenTreeMask;
        const inDoorway = rect(192 - 2, 118 - 2, 4, 5);   // mask at (176,96)
        expect(maskHitsBox(m, 176, 96, inDoorway)).toBe(false);
        expect(rectsOverlap(inDoorway, rect(176, 96, 32, 32))).toBe(true);
    });

    it('the mask bounding box is clamped, so a box outside it cannot hit', () => {
        const m = SEEDLING_PIXEL_MASKS.CliffSideMaskU;
        expect(maskHitsBox(m, 100, 100, rect(90, 100, 4, 5))).toBe(false);
        expect(maskHitsBox(m, 100, 100, rect(100, 100, 4, 5))).toBe(true);
    });

    it('placement is the CLASS chain, and it is named apart from the entity', () => {
        // `maskPlacement` returns maskX/maskY rather than x/y precisely so a
        // caller can spread it beside the entity's own x/y. R1 spent an
        // afternoon on a spread that overwrote a node id with a level number.
        const p = maskPlacement(ENTITY_CLASSES.treelarge, 80, 0);
        expect(p).toMatchObject({ maskX: 80, maskY: 0 });
        expect(p.x).toBeUndefined();
        const tl = L94.pixelmasks.find((e) => e.tag === 'treelarge');
        expect(tl.x).toBe(80);
        expect(tl.maskX).toBe(80);
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

/**
 * R0: the ROLE census.
 *
 * v2's all-or-nothing throw was right while every caller ran collision. It
 * is the wrong shape for a `noclip` walk, which never asks whether a `bob`
 * blocks — and pricing 115 collider footprints to find that out is R2's
 * bill. So a tag is classified per role and the builder throws only for a
 * role the caller consults.
 *
 * The two guards that make this honest rather than merely permissive:
 * the CHEAP-role census is wider than the fixture levels (all 116, exactly
 * like the trigger census that `stairsup` taught), and a hazard whose avoid
 * volume nobody has transcribed is `'unpriced'` — a loud throw, not a
 * guessed rect.
 */
describe('roles: the census is per-role, and wider than the fixture levels', () => {
    const atlas = MAP;

    it('classifies EVERY tag in all 116 levels for the three cheap roles', () => {
        // The wide census. A missing trigger is an exit that silently does
        // not exist; a missing pickup or proximity hazard is worse — not a
        // loud throw anywhere useful, but a mid-walk deadlock, 150 frozen
        // frames, or a shifted global RNG stream, all of which surface as
        // "the physics diverged".
        const unclassified = new Map();
        for (const level of atlas.levels) {
            for (const e of level.entities ?? []) {
                const cls = ENTITY_CLASSES[e.type];
                const missing = cls
                    ? RELAXED_ROLES.filter((r) => !cls.roles.includes(r))
                    : [...RELAXED_ROLES];
                if (missing.length) unclassified.set(e.type, missing);
            }
        }
        expect([...unclassified.entries()]).toEqual([]);
    });

    it('has exactly one entry per tag the extract actually uses', () => {
        // Both directions. An entry for a tag no level carries is a
        // transcription of something that cannot be checked against
        // anything, and would rot silently.
        const used = new Set();
        for (const level of atlas.levels) {
            for (const e of level.entities ?? []) used.add(e.type);
        }
        expect([...used].sort()).toEqual(Object.keys(ENTITY_CLASSES).sort());
        expect(used.size).toBe(137);
    });

    it('lets a relaxed walk build levels the full census refuses', () => {
        // The number that says how far the census has got. v2 built 3 of
        // 116 with the full census; classifying the level FLAGS (lightalpha
        // alone appears in 98 levels), the fifteen pickups and the chest
        // lifted it to 11, and consulting only the cheap roles reached 82 at
        // R0. R1 priced ten of the twelve remaining proximity volumes and
        // took the RELAXED census to 115.
        //
        // R2 pays the blocking bill for the 69 tags on the R1 route, which
        // lifts the FULL census from 11 to 82 — the same 82 the cheap roles
        // reached at R0, and not a coincidence: what is left out is the 34
        // levels holding one of the tags no route has needed yet.
        //
        // R4's L67 probes priced `arrowtrap` for blocking (it is not — no
        // setHitbox, no type, in no solids list), which is the whole reason
        // 82 became 85: L67 and two other arrowtrap-only holdouts now build
        // under the full census.
        //
        // ⛔ R5 FINISHED IT: 85 -> 115, and the two numbers are now the SAME
        // number. The rung's route leaves the R2 census behind at its first
        // new room (L19's ShieldBoss, L39-L42's wand puzzle, L93's door into
        // Dungeon 8, L100-L109's ferry are all off every earlier route), so
        // the remaining 22 tags were classified in one sweep and the
        // eighteenth pixelmask was extracted.
        //
        // ⛓⛓⛓ R6 SLICE 6b FINISHED IT: 115 -> **116**, THE WHOLE MAP. The
        // last holdout was L112, and it was never a blocking question — the
        // `pod` was a proximity hazard whose avoid volume nobody had
        // transcribed and the `finalboss` was one whose trigger turned out
        // not to be proximity at all. Both are classified now, so every
        // level in the extract builds under BOTH censuses.
        //
        // ⚠ 116 is the whole map, so this number can no longer grow. What it
        // can still do is SHRINK, which is what it is here for.
        let full = 0;
        let relaxed = 0;
        for (const level of atlas.levels) {
            try { buildLevelWorld(level); full++; } catch { /* unclassified off-route */ }
            try { buildLevelWorld(level, { roles: RELAXED_ROLES }); relaxed++; } catch {
                /* an unpriced hazard or a Bridge tile */
            }
        }
        expect(full).toBe(116);
        expect(relaxed).toBe(116);
        expect(atlas.levels).toHaveLength(116);
    });

    it('the R2 route levels ALL build with the full census — that is the bill', () => {
        // The scoped guard the rung is measured by: `blocking` is required
        // for every level the walk enters, and a loud throw everywhere else.
        // A level that stopped building here is a tag someone removed or an
        // extract that changed, and it must be a red rather than a route
        // that quietly goes somewhere else.
        const routeLevels = [...new Set(R1_ROUTE.legs.map((l) => l.level))];
        expect(routeLevels).toHaveLength(47);
        for (const n of routeLevels) {
            expect(() => buildLevelWorld(levelRecord(n)), `level ${n}`).not.toThrow();
        }
    });

    it('builds every level on the R0 witness chain, and level 94', () => {
        // boot(0) -> 2 -> 3 -> 11 -> 10, the shortest live-trigger chain to
        // the sword's room. If this ever stops holding, the witness walk is
        // no longer synthesizable and the rung's fixture is the first thing
        // to notice.
        for (const n of [0, 2, 3, 11, 10, 94]) {
            expect(() => buildLevelWorld(levelRecord(n), { roles: RELAXED_ROLES }),
                `level ${n}`).not.toThrow();
        }
    });

    it('still throws loudly for geometry the census does not cover', () => {
        // The relaxation must not become "throws less". Until R5 this was
        // asserted against a real level: R2 classified the 69 tags on its
        // route and no further, so an off-route level refused `blocking` by
        // name — and the exemplar rotted twice (`arrowtrap` in L4, then
        // `sandtrap` in L108).
        //
        // ⛔ R5 CLASSIFIED THE LAST ONE, so no level in the extract can play
        // that part any more, and the ROLE-SCOPED arm of the census throw is
        // a bounded vacuity from here on: every tag answers for every role,
        // so `roles: RELAXED_ROLES` and the full set build the same 115
        // levels. Recorded rather than papered over — the witness that would
        // close it is the next tag the extract gains.
        //
        // What still has teeth, and is asserted here: the UNKNOWN-TAG arm.
        expect(() => buildLevelWorld({
            level: 900, class: 'Synthetic', width: 2, height: 2,
            layers: [{ name: 'tiles', set: 'tileset', tiles: [] }],
            entities: [{ type: 'notatag', x: 16, y: 16 }],
        })).toThrow(/"notatag".*not in the transcribed class table/s);
        // ⛔ R6 SLICE 6b: the unpriced-hazard arm USED to be asserted here on
        // L112's `pod`, and the pod is paid, so **L112 builds**. That is the
        // slice's headline for this file and it is stated as an assertion
        // rather than by the silence of a deleted line — the last refusing
        // level in the extract stopped refusing.
        expect(() => buildLevelWorld(levelRecord(112))).not.toThrow();
        expect(() => buildLevelWorld(levelRecord(112), { roles: RELAXED_ROLES }))
            .not.toThrow();
    });

    it('every tag in the extract now answers for the blocking role', () => {
        // R5's sweep, stated as the fact it is rather than inferred from a
        // count. The 22 tags it classified are the ones no earlier route
        // entered: ShieldBoss (whose 48x48 Solid body is the seal on
        // `shield`), the wand dungeon's crushers and beamtowers, the two
        // buildings, the NPC family, and `TentacleBeast` — whose mask the
        // extractor had skipped on the reading that its type is "Enemy",
        // which its own constructor overwrites with "Solid".
        for (const [tag, cls] of Object.entries(ENTITY_CLASSES)) {
            expect(cls.roles, tag).toContain('blocking');
        }
    });

    it('rejects an unknown role name rather than silently consulting nothing', () => {
        expect(() => buildLevelWorld(levelRecord(0), { roles: ['blockng'] }))
            .toThrow(/unknown role "blockng"/);
    });

    // ⚠ THIS TEST USED TO SAY "defaults to ALL roles", AND R5 MADE THAT
    // PHRASE WRONG RATHER THAN THIS TEST WRONG. `combat` is the fifth role
    // and it is OPT-IN: a walk with `noDamage: true` — every fixture R0
    // through R4 recorded — is not wrong to ignore combat, and defaulting it
    // on would throw on four committed route files to satisfy a table. The
    // invariant the test actually protects is "no caller from before R5
    // changed behaviour", so it is now stated against the set that names.
    it('defaults to the four PRE-R5 roles, so no existing caller changed behaviour', () => {
        expect(buildLevelWorld(levelRecord(0)).roles).toEqual(PRE_R5_ROLES);
        expect(ROLES).toEqual([...PRE_R5_ROLES, 'combat']);
    });
});

describe('roles: pickups and proximity hazards are AVOID VOLUMES', () => {
    const relaxed = (n) => buildLevelWorld(levelRecord(n), { roles: RELAXED_ROLES });

    it('places the sword pickup at the ctor half-tile plus its setHitbox', () => {
        // `Sword` is `super(_x + Tile.w/2, _y + Tile.h/2, ...)` then
        // `setHitbox(8, 8, 4, 4)`, so oel (48,48) -> [52,60) x [52,60).
        // Hand-derived; the same algebra as a blocking entry.
        const w = relaxed(10);
        expect(w.pickups).toHaveLength(1);
        expect(w.pickups[0]).toMatchObject({ tag: 'sword', special: true });
        expect(w.pickups[0].rect).toMatchObject({ x: 52, y: 52, right: 60, bottom: 60 });
    });

    it('gives the chest a volume that covers its OPEN LINE, not just its cell', () => {
        // `Chest.update` collides a 1-px line at `y - originY + height + 1`,
        // i.e. one pixel BELOW the cell. A volume that stopped at the cell
        // would let a route walk the row that opens it — which spawns a
        // special SealPiece and burns an unbounded number of Math.random()
        // draws for the seal index.
        const w = relaxed(11);
        expect(w.proximityHazards).toHaveLength(1);
        expect(w.proximityHazards[0]).toMatchObject({ tag: 'chest', kind: 'line-below' });
        expect(w.proximityHazards[0].rect)
            .toMatchObject({ x: 32, y: 48, right: 48, bottom: 66 });
    });

    it('bounds the watcher\'s 24 px talk CIRCLE by its square', () => {
        // `FP.distance(x, y, p.x, p.y) <= talkRange` from the NPC's own
        // centre (the ctor half-tile). Level 94's watcher is at oel
        // (152,128) -> centre (160,136) -> [136,184) x [112,160).
        const w = relaxed(94);
        expect(w.proximityHazards).toHaveLength(1);
        expect(w.proximityHazards[0]).toMatchObject({ tag: 'watcher', kind: 'auto-talk' });
        expect(w.proximityHazards[0].rect)
            .toMatchObject({ x: 136, y: 112, right: 184, bottom: 160 });
    });

    /**
     * ⛔⛔ R6 SLICE 6b — THIS TEST'S WITNESS WAS THE POD, AND THE POD IS PAID.
     *
     * It used to build a synthetic level holding a `pod` and assert the
     * PROXIMITY-HAZARD refusal, because `pod` and `finalboss` were the only
     * two `'unpriced'` rows in the table. Both are priced now, so the
     * `'unpriced'` disposition has **zero members** and the builder's
     * refusal arm is unreachable from the shipped table.
     *
     * A branch whose failing case has become unreachable from real data is
     * not a branch to delete — a later rung will add an unpriced row and
     * will need the refusal. So the witness moves one stratum down, onto
     * `hazardDisposition`, and the integration side keeps a POSITIVE witness
     * (L112's four pods really do produce four avoid volumes) in its place.
     */
    it('the four hazard dispositions, each witnessed — and `unpriced` is now EMPTY', () => {
        // The predicate, exercised on all four arms with synthetic rows, so
        // the refusal path stays checked with nothing in the table to feed it.
        expect(hazardDisposition(undefined)).toBe('none');
        expect(hazardDisposition('unpriced')).toBe('unpriced');
        expect(hazardDisposition({ entry: 'the doorway' })).toBe('entry');
        expect(hazardDisposition({ inert: 'it cannot fire on a fresh boot' })).toBe('inert');
        expect(hazardDisposition({ dx: 0, dy: 0, w: 16, h: 16, kind: 'k', effect: 'e' }))
            .toBe('volume');
        // ⚠ ORDER, asserted rather than assumed: a row carrying both `entry`
        // and `inert` reads as `entry`. The table test below forbids the
        // combination, so this pins the precedence a reader would otherwise
        // have to derive from source order.
        expect(hazardDisposition({ entry: 'e', inert: 'i' })).toBe('entry');

        // And the state change, named: no row is `'unpriced'` any more.
        const byDisposition = {};
        for (const [tag, cls] of Object.entries(ENTITY_CLASSES)) {
            if (!cls.hazard) continue;
            const d = hazardDisposition(cls.hazard);
            (byDisposition[d] ??= []).push(tag);
        }
        expect(byDisposition.unpriced ?? []).toEqual([]);
        expect(byDisposition.entry).toEqual(['finalboss']);
        expect(byDisposition.volume).toContain('pod');
    });

    it('...and L112 now yields FOUR pod volumes, the oel cells exactly', () => {
        // The positive witness that replaces the refusal. §14.3's claim 1,
        // driven: `super(_x + Tile.w/2, _y + Tile.h/2)` + `setHitbox(16, 16,
        // 8, 8)` means the box is the oel cell and NOT the entity cell — so
        // every offset in the row is 0 and a rect built from `dx: 8` would be
        // eight pixels south-east of the thing it is avoiding.
        const w = buildLevelWorld(levelRecord(112), { roles: RELAXED_ROLES });
        const pods = w.proximityHazards.filter((h) => h.tag === 'pod');
        expect(pods).toHaveLength(4);
        expect(pods.every((h) => h.kind === 'pod-pin')).toBe(true);
        expect(pods.map((h) => h.rect).sort((a, b) => a.x - b.x || a.y - b.y))
            .toMatchObject([
                { x: 40, y: 120, right: 56, bottom: 136 },
                { x: 112, y: 48, right: 128, bottom: 64 },
                { x: 112, y: 192, right: 128, bottom: 208 },
                { x: 184, y: 120, right: 200, bottom: 136 },
            ]);
        // ⛓ And the Owl is in the OTHER list — it has no volume at all, and
        // an empty `proximityHazards` entry for it would have read as "not a
        // hazard" rather than "not a PROXIMITY hazard".
        expect(w.proximityHazards.some((h) => h.tag === 'finalboss')).toBe(false);
        expect(w.entryHazards.map((h) => h.tag)).toEqual(['finalboss']);
        expect(w.entryHazards[0].entry).toMatch(/ROOM ENTRY, not proximity/);
    });

    it('reports overlaps through avoidVolumesAt, and nothing else does', () => {
        const w = relaxed(10);
        // The sword's own rect.
        expect(w.avoidVolumesAt({ x: 54, y: 54, right: 58, bottom: 59 }))
            .toMatchObject([{ kind: 'pickup' }]);
        // One pixel clear of it.
        expect(w.avoidVolumesAt({ x: 44, y: 54, right: 48, bottom: 59 })).toEqual([]);
        // ⚠ And the v2 PLANNER face must not have noticed: a pickup is not
        // a blocker, and if it became one the four v2 driver fixtures would
        // re-route — and those are oracle recordings, so a re-route is a
        // fixture rewrite rather than a test failure.
        expect(w.plannerBlockerAt({ x: 54, y: 54, right: 58, bottom: 59 })).toBeNull();
    });

    it('reports nothing for a role the world was not built with', () => {
        // Honest rather than empty: a world built without the pickup role
        // has no pickups to report, and says so through its own `roles`.
        const w = buildLevelWorld(levelRecord(10), { roles: ['trigger'] });
        expect(w.roles).toEqual(['trigger']);
        expect(w.pickups).toEqual([]);
        expect(w.avoidVolumesAt({ x: 54, y: 54, right: 58, bottom: 59 })).toEqual([]);
    });
});

describe('R1: the priced proximity volumes', () => {
    const R = (id) => buildLevelWorld(levelRecord(id), { roles: RELAXED_ROLES });

    it('⛔ every BUILT hazard has exactly one shape, in every buildable level', () => {
        // ⚠ THE CLASS-TABLE ASSERTION BELOW IS NOT THIS ONE, and R4 proved
        // it the hard way. That one checks `ENTITY_CLASSES` — the DECLARATION
        // — and it passed while `watchViewer`'s renderer crashed on the first
        // `BossLock` it met, because the renderer consumes the BUILT record
        // (`{rect, disc, line}`) and its `else` arm dereferenced `h.disc.x`
        // on an entry where both `rect` and `disc` are null. Level 12 holds
        // five of them; the animation loop died inside `requestAnimationFrame`
        // with no message at all.
        //
        // So the shape contract is asserted where the CONSUMERS read it. Any
        // future shape lands here first, in milliseconds, instead of in a
        // viewer nobody runs in CI.
        const seen = new Set();
        for (let level = 0; level < 116; level++) {
            let world;
            try { world = R(level); } catch { continue; }
            for (const h of world.proximityHazards) {
                const shapes = ['rect', 'disc', 'line'].filter((k) => h[k]);
                expect(shapes.length,
                    `L${level} ${h.tag}@${h.x},${h.y} (${h.kind}) has shapes `
                    + `[${shapes.join(',')}] — exactly one of rect/disc/line, or a `
                    + 'consumer that reads the wrong field throws').toBe(1);
                seen.add(shapes[0]);
            }
        }
        // ...and all three are really out there, so this is not vacuous.
        expect([...seen].sort()).toEqual(['disc', 'line', 'rect']);
    });

    it('every hazard is priced, INERT with evidence, or unpriced with evidence', () => {
        // Three states and no fourth. "Unpriced" and "inert" are both
        // affirmative classifications carrying their reason, so neither can
        // be read later as an oversight and quietly "fixed".
        for (const [tag, cls] of Object.entries(ENTITY_CLASSES)) {
            if (!cls.hazard) continue;
            const disposition = hazardDisposition(cls.hazard);
            if (disposition === 'unpriced') {
                expect(cls.why, `${tag} is unpriced with no evidence`).toBeTruthy();
            } else if (disposition === 'entry') {
                // ⛓ R6 SLICE 6b — THE FOURTH DISPOSITION. It carries no rect
                // BY CLAIM: the trigger is world entry, so there is nothing
                // to route around, and the row has to say what prices the
                // effects instead. A one-word `entry:` would be exactly the
                // omission the other three arms exist to prevent.
                expect(typeof cls.hazard.entry, `${tag} entry with no reason`).toBe('string');
                expect(cls.hazard.entry.length).toBeGreaterThan(80);
                expect(cls.hazard.entry, `${tag} entry names no pricer`)
                    .toMatch(/Priced by/);
                expect(cls.hazard.w, `${tag} is entry-triggered AND carries a rect`)
                    .toBeUndefined();
                expect(cls.hazard.inert, `${tag} is both entry and inert`).toBeUndefined();
            } else if (disposition === 'inert') {
                expect(typeof cls.hazard.inert, `${tag} inert with no reason`).toBe('string');
                expect(cls.hazard.inert.length).toBeGreaterThan(40);
            } else {
                expect(cls.hazard.effect, `${tag} has a volume but no effect`).toBeTruthy();
                expect(cls.hazard.kind, `${tag} has a volume but no kind`).toBeTruthy();
                // Exactly ONE shape, never two and never none.
                //
                // ⚠ THREE SHAPES NOW. R4 added `line`, because the game uses
                // three tests and not two: a rect hazard gates on
                // `collide("Player", ...)`, a point hazard on
                // `FP.distance(...) < r`, and a `BossLock` on
                // `collideLine`, which walks INTEGER points along a
                // one-pixel row and never tests its own end point. A rect
                // enclosing those ten pixels over-avoids by up to a pixel on
                // each side, which is not theoretical: it moved R3's
                // committed L12 route.
                const shapes = [
                    ['point', Boolean(cls.hazard.point)],
                    ['line', Boolean(cls.hazard.line)],
                    ['rect', cls.hazard.w !== undefined],
                ].filter(([, on]) => on).map(([n]) => n);
                expect(shapes.length,
                    `${tag} must be exactly one of point/line/rect, got `
                    + `[${shapes.join(',')}]`).toBe(1);
            }
        }
        // ⛓⛓ R6 SLICE 6b: the two that were unpriced were `pod` and
        // `finalboss`, both in L112, and both are paid. NONE is left — and
        // the count is asserted as EMPTY rather than deleted, so the next
        // rung that classifies a tag as unpriced has to come back here.
        const unpriced = Object.entries(ENTITY_CLASSES)
            .filter(([, c]) => hazardDisposition(c.hazard) === 'unpriced').map(([t]) => t);
        expect(unpriced).toEqual([]);
    });

    it('a lavatrap is a 33 px POINT disc, not a box overlap', () => {
        // `chompRange = 32` and `var d:int = FP.distance(...)`, so `d <= 32`
        // is `dist < 33` — and it measures to the PLAYER'S POSITION, not to
        // the player's box. Level 80's traps are at oel (32,224) and (80,96).
        const L80 = R(80);
        const traps = L80.proximityHazards.filter((h) => h.tag === 'lavatrap');
        expect(traps.map((t) => [t.disc.x, t.disc.y, t.disc.r]))
            .toEqual([[40, 232, 33], [88, 104, 33]]);
        expect(traps.every((t) => t.rect === null)).toBe(true);
        // Just inside and just outside, measured from the player position.
        const box = playerBoxAt(40, 200);
        expect(L80.avoidVolumesAt(box, { x: 40, y: 200 }).length).toBe(1);   // 32 away
        expect(L80.avoidVolumesAt(playerBoxAt(40, 199), { x: 40, y: 199 }).length).toBe(0);
    });

    it('an ice turret is a 129 px POINT disc — bigger than its own room', () => {
        // `attackRange = 128`, same int truncation. Outside it `shootTimer`
        // is reset every frame and no blast is ever constructed, so a route
        // that stays clear is provably safe — and level 98's is at (120,40)
        // in a 240x208 room, which is why Dungeon 8 is on R1's blocked list.
        const L98 = R(98);
        const turret = L98.proximityHazards.find((h) => h.tag === 'iceturret');
        expect([turret.disc.x, turret.disc.y, turret.disc.r]).toEqual([120, 40, 129]);
        // The only door out of level 98 is the stairs at tile (7,7) — 80 px
        // from the turret, and inside the disc. This is the blocked-list
        // claim, asserted rather than asserted-in-prose.
        const stairs = L98.teleporters.find((tp) => tp.to === 99);
        const c = { x: stairs.rect.x + 8, y: stairs.rect.y + 8 };
        expect(L98.avoidVolumesAt(playerBoxAt(c.x, c.y), c)
            .some((h) => h.blocker.tag === 'iceturret')).toBe(true);
    });

    it('the rect volumes match their constructor chains', () => {
        // pull: `super(_x, _y)` with NO half-tile offset, setHitbox(16,16)
        // and the default origin — one whole cell at the raw oel coords.
        const L12 = R(12);
        const pull = L12.proximityHazards.find((h) => h.tag === 'pull');
        expect(pull.rect).toMatchObject({ x: 576, y: 640, right: 592, bottom: 656 });
        // shieldlock: Lock's setHitbox(16,16,8,8) at (_x+8,_y+8), probed at
        // `collide("Player", x - 1, y)` — one cell, shifted a pixel LEFT.
        const lock = L12.proximityHazards.find((h) => h.tag === 'shieldlocknorm');
        expect(lock.rect).toMatchObject({ x: 287, y: 704, right: 303, bottom: 720 });
        // button/buttonroom: `super(_x+8,_y+8)` then setHitbox(8,6,4,3).
        const L20 = R(20);
        const room = L20.proximityHazards.find((h) => h.tag === 'buttonroom');
        expect(room.rect).toMatchObject({ x: 196, y: 21, right: 204, bottom: 27 });
        // whirlpool: `super(_x+16,_y+16)`, centerOO(), setHitbox(32,32,16,16).
        const L50 = R(50);
        const whirl = L50.proximityHazards.find((h) => h.tag === 'whirlpool');
        expect(whirl.rect).toMatchObject({ x: 16, y: 48, right: 48, bottom: 80 });
    });

    it('a tagged FallRock contributes NO volume, and says why', () => {
        // The evidenced inert. Level 74 is the darkshield room and holds one;
        // it never falls on a fresh boot, so the route walks straight past.
        const L74 = R(74);
        expect(levelRecord(74).entities.some((e) => e.type === 'fallrock')).toBe(true);
        expect(L74.proximityHazards.some((h) => h.tag === 'fallrock')).toBe(false);
        expect(ENTITY_CLASSES.fallrock.hazard.inert).toMatch(/levelPersistence/);
    });

    it('BossTotem is inert only BECAUSE the grant leaves the Wand in the world', () => {
        // Level 43 is the wand room and the boss sits in it. This is the one
        // inert whose reason is a decision rather than a fact about the map,
        // so it is pinned to the decision: R3 collects for real, the Wand
        // leaves the world, classCount(Wand) hits 0, and the boss wakes.
        const L43 = R(43);
        expect(L43.proximityHazards.some((h) => h.tag === 'bosstotem')).toBe(false);
        expect(ENTITY_CLASSES.bosstotem.hazard.inert).toMatch(/classCount\(Wand\)/);
        expect(ENTITY_CLASSES.bosstotem.hazard.inert).toMatch(/R3/);
    });
});

describe('⛓ R5: what a HELD ITEM does at level-BUILD time', () => {
    const L48 = (inventory) => buildLevelWorld(levelRecord(48), { roles: ROLES, inventory });

    it('L48 builds WITH the karlore plug from an empty inventory', () => {
        const w = L48(null);
        expect(w.solids.some((s) => s.tag === 'karlore')).toBe(true);
        expect(w.addedTimeRemoved).toEqual([]);
    });

    it('...and WITHOUT it when the run holds `fire`, naming what it removed', () => {
        // `Karlore.added()` is `if (Player.hasFire) FP.world.remove(this)`,
        // and `added()` runs inside `new Game(48, ...)` — so the level the
        // game builds is a function of the inventory at construction.
        const w = L48({ hasFire: true });
        expect(w.solids.some((s) => s.tag === 'karlore')).toBe(false);
        expect(w.addedTimeRemoved).toHaveLength(1);
        expect(w.addedTimeRemoved[0]).toMatchObject({
            tag: 'karlore', x: 112, y: 272, property: 'hasFire',
        });
        // Published, not silent: a world that differs from the extract has
        // to be able to say why.
        expect(w.addedTimeRemoved[0].cite).toMatch(/Karlore\.as/);
    });

    it('⚠ a FALSE property builds the plug — the test is `=== true`, not truthiness', () => {
        // An inventory mirror carries every boolean, so `hasFire: false` is
        // the ordinary reading and it must not remove anything. `undefined`
        // (a caller that passes a partial mirror) must not either.
        expect(L48({ hasFire: false }).addedTimeRemoved).toEqual([]);
        expect(L48({ hasSword: true }).addedTimeRemoved).toEqual([]);
        expect(L48({ hasFire: 1 }).addedTimeRemoved).toEqual([]);
    });

    it('⛔ BobBoss is NOT in the table, and the source is why — not the extract', () => {
        // `Enemies/BobBoss.as:35-43` has Karlore's two lines VERBATIM, in a
        // CONSTRUCTOR, and adding it here would be wrong twice over.
        //
        // 1. It is a NO-OP in the game. `Game.as:2120` is
        //    `add(new BobBoss(...))`: the ctor runs to completion before
        //    `add`, so `_world` is still null when it calls
        //    `FP.world.remove(this)`, and `World.remove` opens with
        //    `if (e._world !== this) return e`. Nothing is removed — the
        //    guard only `return`s out of the rest of the constructor,
        //    leaving a BobBoss with no bossType, no weapon and no boss
        //    music. Present, and differently broken.
        // 2. ⚠ AND NO LEVEL PLACES ONE, so the extract cannot even raise
        //    the question: `BobBoss` is spawned at RUNTIME by the encounter
        //    script, which is the same reason its reward is in no level's
        //    pickup list. A table entry for it would be untestable AND
        //    wrong, which is the worst pair.
        for (const k of Object.keys(ADDED_TIME_REMOVAL)) expect(k).not.toMatch(/bobboss/);
        expect(MAP.levels.some((L) => (L.entities ?? [])
            .some((e) => /bobboss/.test(e.type)))).toBe(false);
    });

    it('⛓ and the table is COMPLETE against the extract: only L48 builds differently', () => {
        // The claim the one-entry table needs, asked of the DATA rather than
        // of the table: hand every level every item and see which ones
        // change. A second `added()`-time reader added to the game — or
        // missed in the sweep of `src/` — shows up here as a level whose
        // build moved and whose class nobody declared.
        const everything = Object.fromEntries(
            ADDED_TIME_PROPERTIES.map((p) => [p, true]));
        const moved = [];
        const unbuildable = [];
        for (const L of MAP.levels) {
            let w;
            try {
                w = buildLevelWorld(L, { roles: RELAXED_ROLES, inventory: everything });
            } catch {
                unbuildable.push(L.level);
                continue;
            }
            if (w.addedTimeRemoved.length > 0) moved.push(L.level);
        }
        expect(moved).toEqual([48]);
        // ⚠ AND THE SKIPS ARE NAMED. A sweep that quietly dropped levels
        // would report the same green if it dropped 48 itself
        // (`feedback_bounded_sweep_must_name_what_it_bounded`). One level in
        // 116 refuses the RELAXED census; it is pinned by number, so a build
        // regression that widened the skip list is a red here rather than a
        // completeness claim over a shrinking map.
        // ⛓ R6 SLICE 6b: was `[112]`. The pod bill is paid, so the RELAXED
        // census refuses nothing at all — and the list stays asserted (as
        // EMPTY, not deleted) so a future skip has to be declared here.
        expect(unbuildable).toEqual([]);
        expect(MAP.levels).toHaveLength(116);
    });

    it('the table is a list of NAMES with real item properties and citations', () => {
        // `feedback_coincidental_predicate_rots`: the predicate that reads
        // naturally here — "an NPC whose added() reads an item" — is exactly
        // the one that sweeps in BobBoss.
        expect(Object.keys(ADDED_TIME_REMOVAL).length).toBeGreaterThan(0);
        for (const [tag, d] of Object.entries(ADDED_TIME_REMOVAL)) {
            expect(ENTITY_CLASSES[tag], `${tag} is not a transcribed class`).toBeDefined();
            expect(d.cite, tag).toMatch(/\.as:/);
            expect(d.why.length, tag).toBeGreaterThan(40);
            expect(ADDED_TIME_PROPERTIES, tag).toContain(d.property);
        }
    });

    it('⛓ `addedTimeKey` separates the two builds — a memo keyed on the level LIES', () => {
        // `new Game(n, ...)` re-runs every added() on every visit, so a
        // level first entered without `fire` and re-entered with it is built
        // twice and differently. This is what a memoising caller compares.
        expect(addedTimeKey({ hasFire: true })).not.toBe(addedTimeKey({ hasFire: false }));
        expect(addedTimeKey(null)).toBe(addedTimeKey({}));
        expect(L48({ hasFire: true }).addedTimeKey).toBe(addedTimeKey({ hasFire: true }));
        // ...and it ignores everything a build does NOT depend on, or every
        // pickup on a walk would drop every memoised world in the run.
        expect(addedTimeKey({ hasFire: true, hasSword: true }))
            .toBe(addedTimeKey({ hasFire: true }));
    });
});

describe('⛓ R5: the nearestToPoint TIE-BREAK, transcribed', () => {
    // `World.addType` PREPENDS (`World.as:1016-1029`) and `nearestToPoint`
    // keeps a candidate only on a STRICT `dist < nearDist`, so the entity
    // list is the reverse of the extract's and a tie is won by the tile
    // that appears LATER in it.
    const L47 = () => buildLevelWorld(levelRecord(47), { roles: ROLES });

    it('⛔ L47\'s own arrival from L46 lands on a tie — this is not routable around', () => {
        // The finding that forced the transcription. The teleporter drops
        // the player at (248,456); the probe is one pixel down
        // (`checkOffsetY`), i.e. (248,448) — exactly between tile (15,27)'s
        // centre at 440 and (15,28)'s at 456. A route has no say in where a
        // teleporter puts the player, so "move the fixture" stopped being
        // available advice.
        const arrival = buildLevelWorld(levelRecord(46), { roles: ROLES })
            .teleporters.find((t) => t.to === 47).arrival;
        expect(arrival).toEqual({ x: 248, y: 456 });
        const { tile, tie } = L47().nearestWalkableTileWithTie(248, 448, {});
        expect(tie, 'the arrival really is a tie').not.toBeNull();
        // ...and the two candidates behave DIFFERENTLY once ice is armed:
        // 21 (Snow) is plain 0.8 walk, 22 (Ice) is slidingSpeed 1 with
        // slidingFriction 0.025. Under R1-R3, which coerced ice, this pair
        // was indistinguishable and the old model got away with it.
        expect([tile.t, tie.t].sort((a, b) => a - b)).toEqual([21, 22]);
    });

    it('the LATER extract entry wins, which is the FlashPunk list order', () => {
        const w = L47();
        const { tile } = w.nearestWalkableTileWithTie(248, 448, {});
        const idx = (t) => w.walkableTiles.findIndex((x) => x.tx === t.tx && x.ty === t.ty);
        const { tie } = w.nearestWalkableTileWithTie(248, 448, {});
        expect(idx(tile)).toBeGreaterThan(idx(tie));
    });

    it('⚠ and the 59 committed recordings can NOT settle this — the D5 walk can', () => {
        // Stated as a test so nobody reads the green suite as corroboration
        // it is not (`feedback_same_rate_pair_cannot_answer`). Over every
        // committed stream there are 21 observations where the two orders
        // assign a different `state` — and at every one of them the two
        // types either share a speed or are coerced by that tape's own
        // `noHazards`, so both orders produce the same physics. The corpus
        // is a NEGATIVE CONTROL (nothing regressed), not a witness.
        //
        // `r5-d5-conch` is the witness: it stands on L47's tie with ice
        // ARMED, where snow and ice are 0.8-plain against 1.0-sliding, and
        // its 1,678 observations match the real game byte for byte.
        const { ticks } = loadExpectation('r5-d5-conch').stream;
        expect(ticks.length).toBe(1678);
        expect(loadTape('r5-d5-conch').noHazards).not.toContain('ice');
        expect(ticks.some((o) => o.level === 47)).toBe(true);
    });
});

describe('⛓ R7 slice 4: the normalised live-geometry bag, and its BRAND', () => {
    // The debt this pays is a per-QUERY allocation on the hottest loop in
    // the package (+9.7 % measured at R6 slice 2). The fix is a brand, so
    // the normalise happens once per TICK where the callers already hoist
    // the bag — and a brand is only as good as what it refuses to believe.
    const blockWorld = () => buildLevelWorld({
        level: 999,
        width: 20,
        height: 20,
        layers: [],
        entities: [
            { type: 'pushableblockspear', x: 176, y: 128, attrs: {} },
            { type: 'rock3', x: 96, y: 96, attrs: {} },
        ],
    });

    it('covers every LIVE_GEOMETRY_KEYS name, and claims nothing else but the tick fact', () => {
        // ⚠ THE ASSERTION §11.7 SAID ALREADY EXISTED, AND DID NOT. Nothing
        // in this tree compared the two lists before this test: the only
        // reader of `LIVE_GEOMETRY_KEYS` outside `playerPhysicsV2` was one
        // `toContain('finalDoors')`. Four families have been silently
        // dropped by a hand-written bag in this package's history, so the
        // coverage is asserted BOTH WAYS rather than counted once.
        const out = normalizeLiveOpts({});
        for (const k of LIVE_GEOMETRY_KEYS) {
            expect(Object.keys(out), `normalizeLiveOpts drops "${k}"`).toContain(k);
        }
        // `beforeTypeFlip` is a fact about the TICK, not about geometry —
        // it rides along so a normalised bag is a complete substitute for
        // the caller's own, and it is the ONLY such passenger.
        expect(Object.keys(out).filter((k) => !LIVE_GEOMETRY_KEYS.includes(k)))
            .toEqual(['beforeTypeFlip']);
    });

    it('an absent family reads null, never undefined — which is the whole point', () => {
        const out = normalizeLiveOpts({});
        for (const k of LIVE_GEOMETRY_KEYS) expect(out[k]).toBeNull();
        expect(out.beforeTypeFlip).toBe(false);
        // ...and a present one survives by identity, not by copy.
        const live = new Map([['x', { rect: rect(0, 0, 16, 16), removed: false }]]);
        expect(normalizeLiveOpts({ pushables: live }).pushables).toBe(live);
    });

    it('SKIPS a bag it already filled — by identity, which is the saving', () => {
        const once = normalizeLiveOpts({ beforeTypeFlip: true });
        expect(isNormalizedLiveOpts(once)).toBe(true);
        expect(normalizeLiveOpts(once)).toBe(once);
        expect(normalizeLiveOpts(normalizeLiveOpts(once))).toBe(once);
    });

    it('and does NOT skip a raw bag, however complete it looks', () => {
        const raw = {};
        for (const k of LIVE_GEOMETRY_KEYS) raw[k] = null;
        raw.beforeTypeFlip = false;
        expect(isNormalizedLiveOpts(raw)).toBe(false);
        expect(normalizeLiveOpts(raw)).not.toBe(raw);
    });

    it('⛓ THE SPREAD KEEPS THE BRAND — the hot caller\'s shape, asserted', () => {
        // `levelRun.pushableCtx` hands `{ ...base, pushables: withoutSelf }`
        // to `collidesSolid` for every 1 px probe of every block. That is a
        // FRESH object per probe, which is why an identity cache was
        // refuted; what survives it is the shape.
        const base = normalizeLiveOpts({ pushables: new Map() });
        const withoutSelf = new Map([['a', { rect: rect(0, 0, 16, 16), removed: true }]]);
        const probe = { ...base, pushables: withoutSelf };
        expect(isNormalizedLiveOpts(probe)).toBe(true);
        expect(normalizeLiveOpts(probe)).toBe(probe);
        expect(probe.pushables).toBe(withoutSelf);
        // The key ORDER is what makes it the same hidden class, and
        // `pushables` already being present is why the assignment overwrites
        // in place instead of appending.
        expect(Object.keys(probe)).toEqual(Object.keys(base));
    });

    it('⛔ A PARTIAL BAG CANNOT WEAR THE BRAND — §11.7\'s named hazard', () => {
        // The brand is a module-private Symbol precisely so that no caller
        // can mint one. A string brand would be typeable onto a bag missing
        // a family, and a skipped normalise on a partial bag reads
        // `undefined` where every consumer was promised `null`.
        const forged = { __liveNormalized: true, openActivators: null };
        expect(isNormalizedLiveOpts(forged)).toBe(false);
        expect(normalizeLiveOpts(forged)).not.toBe(forged);
        expect(normalizeLiveOpts(forged).turrets).toBeNull();
        // Nor can a Symbol of the same DESCRIPTION forge it.
        const lookalike = { [Symbol('levelWorld.normalizeLiveOpts')]: true };
        expect(isNormalizedLiveOpts(lookalike)).toBe(false);
        // And the brand is not reachable from the module's exports.
        expect(Object.getOwnPropertySymbols(normalizeLiveOpts).length).toBe(0);
    });

    it('the QUERIES answer identically whichever bag they are handed', () => {
        // The behavioural half: this change is supposed to be byte-inert,
        // so the same question through a raw bag and through a pre-branded
        // one must return the same answer — including through the spread
        // the hot caller does.
        const w = blockWorld();
        const live = new Map([['pushableblockspear@176,128', {
            rect: rect(160, 128, 16, 16), removed: false,
        }]]);
        const raw = { pushables: live };
        const branded = normalizeLiveOpts({ pushables: live });
        const spread = { ...normalizeLiveOpts({ pushables: new Map() }), pushables: live };
        for (const [x, y] of [[180, 132], [164, 132], [100, 100]]) {
            const box = playerBox(x, y);
            const a = w.collidesSolid(box, raw);
            const b = w.collidesSolid(box, branded);
            const c = w.collidesSolid(box, spread);
            expect(b).toEqual(a);
            expect(c).toEqual(a);
            expect(w.plannerBlockerAt(box, null, branded)).toEqual(w.plannerBlockerAt(box, null, raw));
        }
    });

    it('⚠ and a branded bag is a COMPLETE substitute — the two keys read off `opts` itself', () => {
        // `collidesSolid` destructures `fallenRocks` and `beforeTypeFlip`
        // from the options object ABOVE the loop that reads the normalised
        // thirteen. If the brand dropped them, a caller that normalised its
        // bag would walk the player through a rock the run had dropped.
        const rocks = new Map([['r', { id: 'r', rect: rect(96, 96, 16, 16) }]]);
        const branded = normalizeLiveOpts({ fallenRocks: rocks, beforeTypeFlip: true });
        expect(branded.fallenRocks).toBe(rocks);
        expect(branded.beforeTypeFlip).toBe(true);
        const w = blockWorld();
        expect(w.collidesSolid(playerBox(100, 100), branded))
            .toMatchObject({ fallen: true });
    });
});

/**
 * ⛓⛓ R7 slice 6 — R6 DEBT 2's TABLE, asserted against the class list rather
 * than typed twice.
 *
 * The debt was "`earnedClears` does not carry a PICKUP's own persistence
 * tag", and the reason it could not was here: no pickup row carried a
 * `persistTag` at all. The fix is a membership claim about SOURCE — fourteen
 * `Pickup` subclasses override `removed()` with `Game.setPersistence(tag,
 * false)` and three do not — so what this stratum can check is that the
 * claim is COMPLETE and DISJOINT over the classes the game actually places,
 * which is the half a source read cannot get wrong quietly.
 */
describe('a pickup\'s own persistence tag (R6 debt 2)', () => {
    const placedPickupTags = Object.entries(ENTITY_CLASSES)
        .filter(([, cls]) => cls.pickup).map(([tag]) => tag);

    it('PARTITIONS every placed pickup class — no member missing, none in both', () => {
        const clears = Object.keys(PICKUP_CLEARS_OWN_TAG);
        const writes = Object.keys(PICKUP_WRITES_NO_TAG);
        // ⛔ DERIVED FROM `ENTITY_CLASSES`, never a typed count. A class
        // added tomorrow lands in neither table and fails HERE, which is the
        // only way a new pickup can announce that its `removed()` needs
        // reading.
        //
        // ⚠ Two members are RUNTIME-spawned and have no `.oel` placement —
        // `fire` (BobBoss's drop) and `darksword` (the Witch's trade) — so
        // they are in the clears table and not in the class list. They are
        // named rather than filtered, because a member with no class entry
        // is otherwise indistinguishable from a typo.
        const runtimeOnly = ['fire', 'darksword'];
        for (const t of runtimeOnly) {
            expect(clears, `${t} is runtime-spawned`).toContain(t);
            expect(placedPickupTags, `${t} has no .oel placement`).not.toContain(t);
        }
        const placedClears = clears.filter((t) => !runtimeOnly.includes(t));
        expect([...placedClears, ...writes].sort()).toEqual([...placedPickupTags].sort());
        expect(placedClears.filter((t) => writes.includes(t))).toEqual([]);
    });

    it('every entry CITES a line, so the membership is checkable at source', () => {
        for (const [tag, cite] of Object.entries(PICKUP_CLEARS_OWN_TAG)) {
            expect(cite, tag).toMatch(/^Pickups\/\w+\.as:\d+/);
        }
        for (const [tag, why] of Object.entries(PICKUP_WRITES_NO_TAG)) {
            expect(why.length, tag).toBeGreaterThan(20);
        }
    });

    it('⛓ the pickup ROW carries the tag — and only for a class that writes it', () => {
        // L20 holds `shield {tag 2}` and L19 holds `bosskey {keyType 0}`,
        // which is the partition's two sides one level apart.
        const w20 = buildLevelWorld(atlasLevelSource()(20), { roles: ROLES });
        const shield = w20.pickups.find((p) => p.tag === 'shield');
        expect(shield.persistTag).toBe(2);

        const w19 = buildLevelWorld(atlasLevelSource()(19), { roles: ROLES });
        const key = w19.pickups.find((p) => p.tag === 'bosskey');
        // ⛔ ABSENT, not -1. `BossKey.removed()` writes `hasKeySet` and no
        // persistence at all, so a sentinel here would be a tag the ledger
        // could accidentally bank; `undefined` cannot be banked by mistake.
        expect(key.persistTag).toBeUndefined();
        expect('persistTag' in key).toBe(false);
    });
});

/**
 * ⛓⛓⛓ R7 SLICE 6b — THE ARROW TRAP ROSTER, and the reason it is a roster
 * rather than an `ACTIVATOR_RESPONDER`.
 */
describe('the arrow traps (R7 slice 6b)', () => {
    it('L5 carries four, with the entity point and the group', () => {
        const w = buildLevelWorld(atlasLevelSource()(5));
        expect(w.arrowTraps).toHaveLength(4);
        const t = w.arrowTraps.find((a) => a.id === 'arrowtrap@16,16');
        // ⛔ The ENTITY point is `(+8, +2)` — `Activators(_x:int, _y:int, …)`
        // truncates the sprite's 2.5, which is what `combat.js` now says.
        expect([t.ex, t.ey]).toEqual([24, 18]);
        expect(t.t).toBe(0);
        expect(t.shootDefault).toBe(false);
    });

    it('⚠ `shootDefault` is CARRIED — L16 and L67 fire until pressed', () => {
        // Four of the game's eleven traps are the inverted kind. A roster
        // without this field would model them backwards, and silently.
        const w16 = buildLevelWorld(atlasLevelSource()(16));
        expect(w16.arrowTraps).toHaveLength(3);
        expect(w16.arrowTraps.every((a) => a.shootDefault === true)).toBe(true);
        const w67 = buildLevelWorld(atlasLevelSource()(67));
        expect(w67.arrowTraps.every((a) => a.shootDefault === true)).toBe(true);
    });

    it('⛔ it is NOT an activator and NOT a solid — both, asserted', () => {
        const w = buildLevelWorld(atlasLevelSource()(5));
        // Not in the responder set: the entry would be unreachable code,
        // because the set is consulted inside the `collider === 'rect'`
        // branch and an `arrowtrap` is `notSolid`.
        expect(ACTIVATOR_RESPONDERS.has('arrowtrap')).toBe(false);
        expect(w.activators.map((a) => a.tag)).not.toContain('arrowtrap');
        // ...and nothing it places blocks the player.
        expect(ENTITY_CLASSES.arrowtrap.collider).toBe('none');
    });

    it('a level with none carries an EMPTY roster, never a missing one', () => {
        // An absent key and an empty array read the same at a call site that
        // uses `?? []`, and only one of them is a build that ran.
        const w = buildLevelWorld(atlasLevelSource()(20));
        expect(Array.isArray(w.arrowTraps)).toBe(true);
        expect(w.arrowTraps).toHaveLength(0);
    });
});

/**
 * ⛓⛓⛓ R8 SLICE 3 — THE ARROW'S COVER LIST IS A FOURTH MOVER.
 *
 * `Arrow.hitables` is `["Player","Enemy","Tree","Solid","Shield"]` and
 * `Arrow.solids` is EMPTY, so the hitables list is the only thing that stops
 * an arrow — and it stops on all five whether or not it damages them. Player
 * and Enemy are the run's business (it holds their positions); the other
 * three are geometry, and they are NOT the player's list.
 */
describe('R8 slice 3: `collidesArrowCover` — the arrow\'s own three types', () => {
    /**
     * ⛔ THE EQUALITY WITH THE BLAST'S LIST IS A COINCIDENCE OF TWO AS3
     * CLASSES, NOT A SHARED DERIVATION — asserted WITH that reason so the day
     * one of them changes, this row says which. Sharing the symbol is how a
     * list comes to mean nothing ([[feedback_two_cost_models_must_agree]]).
     */
    it('⛓ has the same three members as the blast\'s list today, by coincidence', () => {
        expect([...ARROW_COVER_TYPES].sort()).toEqual(['Shield', 'Solid', 'Tree']);
    });

    /**
     * ⛔ AND IT IS NARROWER THAN THE PLAYER'S. `Rock`, `Rope` and `ShieldBoss`
     * are in `Mobile.solids` and in no arrow's hitables — a model that reused
     * `collidesSolid` would stop arrows the game flies through, and cover is
     * what decides which body a ceiling can reach.
     */
    it('⛔ it does NOT carry Rock, Rope or ShieldBoss, which the player\'s list does', () => {
        for (const t of ['Rock', 'Rope', 'ShieldBoss', 'LavaBoss']) {
            expect(ARROW_COVER_TYPES.includes(t)).toBe(false);
        }
    });

    it('⛓ L5\'s torch stops an arrow, and the query answers with the entry', () => {
        const w = buildLevelWorld(atlasLevelSource()(5), { roles: RELAXED_ROLES });
        // Every `type: "Solid"` entry in the room is arrow cover; the query
        // returns the entry rather than a boolean, which is what lets a
        // ledger name WHICH body an arrow died on.
        const solid = w.solids.find((x) => x.cls && x.cls.type === 'Solid');
        expect(solid).toBeTruthy();
        const hit = w.collidesArrowCover(solid.rect, {});
        expect(hit).toBeTruthy();
    });
});

/**
 * ⛓⛓⛓ R8 SLICE 6 — THE PRESS BOX AND THE STEPPER'S BOX ARE ONE BOX.
 *
 * `SPINNER_PRESS_BOX` is TYPED in `levelWorld` rather than imported from
 * `spinner.js`, and the reason is a cycle: `spinner.js` imports
 * `SOLIDS_BY_MOVER` from here, so importing back would close a loop. A
 * duplicated literal is the lesser defect ONLY while something asserts the
 * two agree — which is this arc's own idiom for two tables that must be one
 * (`assertKillArmPolicyCovers`, `assertBridgeRosterMatchesScope`).
 */
describe('R8 slice 6: the Spinner press box is `spinner.SPINNER`\'s own hitbox', () => {
    it('agrees with the stepper\'s constants, field by field', () => {
        expect(SPINNER_PRESS_BOX.w).toBe(SPINNER.w);
        expect(SPINNER_PRESS_BOX.h).toBe(SPINNER.h);
        expect(SPINNER_PRESS_BOX.originX).toBe(SPINNER.originX);
        expect(SPINNER_PRESS_BOX.originY).toBe(SPINNER.originY);
        // The ctor's half tile — `super(_x + Tile.w/2, _y + Tile.h/2, …)`.
        expect(SPINNER_PRESS_BOX.dx).toBe(SPINNER.dx);
        expect(SPINNER_PRESS_BOX.dy).toBe(SPINNER.dy);
        expect(SPINNER_PRESS_BOX.src).toMatch(/Spinner\.as/);
    });

    /**
     * ⛔ AND THE CENSUS REALLY USES IT — the box is only worth asserting if
     * the press census is the thing that reads it. Without the override
     * `entityRect` REFUSES a `Spinner` by name (a class with no top-level
     * box), which is how this slice found the gap: the first L18 probe threw
     * before it reached the first tick.
     */
    it('⛔ makes L18\'s spinners real press RESPONDERS — they were in NO rect list', () => {
        const world = buildLevelWorld(atlasLevelSource()(18), { roles: ROLES });
        const spinners = world.pressResponders.filter((r) => r.as3 === 'Spinner');
        expect(spinners).toHaveLength(2);
        for (const r of spinners) {
            // A finite rect, because a rect with a null edge NEVER overlaps
            // and every query against it would answer "no", silently.
            expect(Number.isFinite(r.rect.x)).toBe(true);
            expect(Number.isFinite(r.rect.right)).toBe(true);
            expect(r.rect.right - r.rect.x).toBe(SPINNER.w);
            // ⛓ THE JOIN IS WHAT MAKES THE BOX A FALLBACK RATHER THAN AN
            // ANSWER: a spinner is never at its placement after tick 1.
            expect(r.spinnerId).toBe(`spinner@${r.x},${r.y}`);
        }
        // ⚠ AND THEY LEAVE `pressEnemies`, which is the roster for bodies
        // with NO rect. A body in both lists would be priced twice.
        expect((world.pressEnemies ?? []).some((e) => e.as3 === 'Spinner')).toBe(false);
    });
});
