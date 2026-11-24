/**
 * ⛓⛓ rules-fire-arm-chaser-guard — THE FIRE ARM DOES NOT COUNT WHERE A BODY FIRE CANNOT STOP GUARDS THE CROSSING.
 * ⚖ Robert 2026-11-16: "Build the general fix (Recommended)". The guard's three terms (`seedlingFireChaserGuard`), on the
 * delivered rooms' real bodies and on synthetic ones, its composition with the holder narrowing, and the producer's map.
 *
 * MUTATIONS (each reds the named row):
 *   m1 term (a) drops the lethal-border test          -> "a fast homer that dies in lava on its approach does not block"
 *   m2 term (b) uses >= instead of >                   -> "exact equality at dMS does not block"
 *   m3 term (c) ignores the leash                      -> "a fast homer whose leash misses the corridor does not block"
 *   m4 the pass reads the narrowed map, not the raw   -> "the guard and the holder fold commute"
 *   m5 `narrowRockFireByChasers` returns `sides` as is -> "the producer narrows exactly the rocks the guard names"
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    PLAYTHROUGH_MAP, playthroughGridFor, playthroughRockFireSides, rockFireChaserGuards, rockFireNarrowings,
} from './make-seedling-playthrough-rules.mjs';
import * as HP from './seedlingHolderParking.js';
import {
    PLAYER_GUARD_PROFILE, chaserGuardVerdict, foldRockFire, guardClassOf, narrowRockFireByChasers, rockCorridor,
} from './seedlingFireChaserGuard.js';
import { combatCensusOf } from '../../frontend/modules/seedlingDemo/levelWorld.js';
import { ENEMY_CLASSES } from '../../frontend/modules/seedlingDemo/combat.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));
const SIDES = playthroughRockFireSides();
const levelOf = (n) => PLAYTHROUGH_MAP.levels.find((l) => l.level === n);

/** A real room's rock and bodies, the rock read off the producer's map (keys are `L<level>:breakablerock@x,y`). */
function realRoom(key) {
    const rock = SIDES.get(key);
    const level = levelOf(rock.level);
    const grid = playthroughGridFor(level);
    const tileTypes = HP.tileTypesOf(level, grid.width);
    const bodies = combatCensusOf(level).enemies;
    return { rock, level, grid, tileTypes, bodies };
}
/**
 * The verdict of one real body on a rock as the producer's map holds it. A guarded rock's stances are already folded away
 * there, so its corridor is the rock and its sides only: a lower bound on the raw corridor the producer decided from.
 */
function realVerdict(key, bodyLabel) {
    const room = realRoom(key);
    const body = room.bodies.find((b) => `${b.tag}@${b.x},${b.y}` === bodyLabel);
    expect(body, bodyLabel).toBeTruthy();
    return chaserGuardVerdict(body, room.rock, { grid: room.grid, tileTypes: room.tileTypes });
}

// ── a synthetic room: 12 x 5, open floor, a wall column at x = 6 with a rock at (6, 2); lava at (9, 0) ───────────────────
const W = 12, H = 5, LAVA = 17;
function synthRoom({ lavaAt = [] } = {}) {
    const cells = [];
    for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
            if (x === 6 && y !== 2) cells.push({ kind: 'wall', conditions: [] });
            else if (x === 6 && y === 2) cells.push({ kind: 'gated', conditions: [{ any: [{ flag: 'hasSword' }, { flag: 'hasFire' }] }] });
            else if (lavaAt.some(([lx, ly]) => lx === x && ly === y)) cells.push({ kind: 'gated', conditions: [{ flag: 'hasDarkSuit' }] });
            else cells.push({ kind: 'open', conditions: [] });
        }
    }
    const tileTypes = new Map(lavaAt.map(([x, y]) => [y * W + x, LAVA]));
    const rock = { level: -1, id: 'breakablerock@96,32', tiles: [[6, 2]], stances: [{ x: 80, y: 32, tx: 5, ty: 2 }], fireDirs: ['W'], swingDirs: ['E', 'N', 'S'] };
    // the corridor here is the whole open floor, so a leash test needs a body walled off from it: a closed pocket at x 0..1
    return { grid: { width: W, height: H, cells }, tileTypes, rock };
}
const synthRow = (over = {}) => ({
    ...ENEMY_CLASSES.lavarunner, terrain: { water: 'dies', lava: 'survives', pit: 'falls' }, ...over,
});
const synthBody = (tx, ty, row) => ({ tag: 'synth', x: tx * 16, y: ty * 16, cx: tx * 16 + 8, cy: ty * 16 + 8, row });
const classFor = (row, extra = {}) => (tag) => guardClassOf(tag, { row, chaser: null, ...extra });

describe('the three terms on the delivered rooms\' bodies', () => {
    it('the L73 lavarunner blocks: unstoppable, 1.5/1 vs dMS 0.8, its leash covers the gap', () => {
        const v = realVerdict('L73:breakablerock@64,48', 'lavarunner@32,24');
        expect(v.terms).toEqual({ a: true, b: true, c: true });
        expect(v.blocks).toBe(true);
        expect(v.speed).toBe(1.5);
        expect(v.runRange).toBe(80);
        expect(v.distance).toBe(0);
    });

    it('the L73 bulb does not block: slower (0.65), and it borders the lava it dies in', () => {
        const v = realVerdict('L73:breakablerock@64,48', 'bulb@80,80');
        expect(v.blocks).toBe(false);
        expect(v.terms.b).toBe(false);
        // the dies-in-lava term alone would also stop it: the term is real on this body, not only the speed
        expect(v.terms.a).toBe(false);
        expect(v.lethalBorder.length > 0).toBe(true);
    });

    it('a bob does not block: slower (0.5)', () => {
        const v = realVerdict('L92:breakablerock@256,112', 'bob@224,112');
        expect(v.speed).toBe(0.5);
        expect(v.terms.b).toBe(false);
        expect(v.blocks).toBe(false);
    });

    it('a jellyfish in water does not block: 0.8 is not faster than dMS 0.8', () => {
        const v = realVerdict('L92:breakablerock@176,48', 'jellyfish@120,64');
        expect(v.speed).toBe(PLAYER_GUARD_PROFILE.walkSpeed);
        expect(v.terms.a).toBe(true);
        expect(v.terms.c).toBe(true);
        expect(v.terms.b).toBe(false);
        expect(v.blocks).toBe(false);
    });

    it('the L53 puncher does not block: the water past the broken rock stops it (faster, homing, in leash)', () => {
        const v = realVerdict('L53:breakablerock@112,128', 'puncher@136,96');
        expect(v.terms.b).toBe(true);
        expect(v.terms.c).toBe(true);
        expect(v.terms.a).toBe(false);
        expect(v.blocks).toBe(false);
    });
});

describe('the three terms on synthetic bodies', () => {
    it('a fast homer whose leash covers the corridor blocks', () => {
        const { grid, tileTypes, rock } = synthRoom();
        const row = synthRow();
        const v = chaserGuardVerdict(synthBody(9, 2, row), rock, { grid, tileTypes, classOf: classFor(row) });
        expect(v.terms).toEqual({ a: true, b: true, c: true });
        expect(v.blocks).toBe(true);
    });

    it('a fast homer whose leash misses the corridor does not block', () => {
        const { grid, tileTypes, rock } = synthRoom();
        const row = synthRow({ aggro: { kind: 'chase', range: 8 } });
        // a pocket walled off from the corridor: close x = 10 and wall the body in at x = 11
        const cells = grid.cells.map((c, i) => ((i % W) === 10 ? { kind: 'wall', conditions: [] } : c));
        const room = { ...grid, cells };
        const corridor = rockCorridor(rock, room);
        const v = chaserGuardVerdict(synthBody(11, 2, row), rock, { grid: room, tileTypes, corridor, classOf: classFor(row) });
        expect(v.distance > 8).toBe(true);
        expect(v.terms.c).toBe(false);
        expect(v.blocks).toBe(false);
        // the same body with an 80 px leash reaches it: the leash is the term that decided
        const row80 = synthRow();
        expect(chaserGuardVerdict(synthBody(11, 2, row80), rock, { grid: room, tileTypes, corridor, classOf: classFor(row80) }).blocks).toBe(true);
    });

    it('a fast homer that dies in lava on its approach does not block', () => {
        const { grid, tileTypes, rock } = synthRoom({ lavaAt: [[9, 0]] });
        const dies = synthRow({ terrain: { water: 'dies', lava: 'dies', pit: 'falls' } });
        const v = chaserGuardVerdict(synthBody(9, 2, dies), rock, { grid, tileTypes, classOf: classFor(dies) });
        expect(v.terms.b && v.terms.c).toBe(true);
        expect(v.terms.a).toBe(false);
        expect(v.blocks).toBe(false);
        // the same room, a class that survives lava: it blocks
        const survives = synthRow();
        expect(chaserGuardVerdict(synthBody(9, 2, survives), rock, { grid, tileTypes, classOf: classFor(survives) }).blocks).toBe(true);
    });

    it('a fast homer that takes Fire damage does not block (hitByFire with fireDamage > 0)', () => {
        const { grid, tileTypes, rock } = synthRoom();
        const row = synthRow();
        const profile = { ...PLAYER_GUARD_PROFILE, fireDamage: 1 };
        const v = chaserGuardVerdict(synthBody(9, 2, row), rock, { grid, tileTypes, profile, classOf: classFor(row, { hitByFire: true }) });
        expect(v.takesFire).toBe(true);
        expect(v.blocks).toBe(false);
        // hitByFire with the game's fireDamage 0 (`Player.as:178`) still does nothing: it blocks
        const v0 = chaserGuardVerdict(synthBody(9, 2, row), rock, { grid, tileTypes, classOf: classFor(row, { hitByFire: true }) });
        expect(PLAYER_GUARD_PROFILE.fireDamage).toBe(0);
        expect(v0.blocks).toBe(true);
    });

    it('exact equality at dMS does not block; a hair above it does', () => {
        const { grid, tileTypes, rock } = synthRoom();
        const eq = synthRow({ speed: PLAYER_GUARD_PROFILE.walkSpeed });
        const veq = chaserGuardVerdict(synthBody(9, 2, eq), rock, { grid, tileTypes, classOf: classFor(eq) });
        expect(veq.terms.b).toBe(false);
        expect(veq.blocks).toBe(false);
        const up = synthRow({ speed: PLAYER_GUARD_PROFILE.walkSpeed + 0.01 });
        expect(chaserGuardVerdict(synthBody(9, 2, up), rock, { grid, tileTypes, classOf: classFor(up) }).blocks).toBe(true);
    });
});

describe('the guard is one pass over the shared map, and it commutes with the holder fold', () => {
    it('the guard and the holder fold commute; a rock narrowed by both carries both reasons', () => {
        const { grid, tileTypes, rock } = synthRoom();
        const row = synthRow();
        const key = 'L-1:breakablerock@96,32';
        const raw = new Map([[key, rock]]);
        const roomOf = () => ({ grid, tileTypes, bodies: [synthBody(9, 2, row)] });
        const holder = { entry: 'lock@0,0 from 0,0', body: 'bob@0,0', block: 'pushableblock@0,0' };
        const holderPass = (m) => new Map([...m].map(([k, r]) => [k, foldRockFire(r, 'narrowed', holder)]));
        const guardPass = (m) => narrowRockFireByChasers(m, raw, { roomOf, classOf: classFor(row) }).sides;
        const a = guardPass(holderPass(raw)).get(key);
        const b = holderPass(guardPass(raw)).get(key);
        expect(a).toEqual(b);
        expect(a.stances).toEqual([]);
        expect(a.fireDirs).toEqual([]);
        expect(a.swingDirs).toEqual(['E', 'N', 'S', 'W']);
        expect(a.narrowed).toEqual(holder);
        expect(a.guarded.map((g) => g.body)).toEqual(['synth@144,32']);
    });
});

describe('the producer\'s map', () => {
    it('the producer narrows exactly the rocks the guard names, each with its body and spawn', () => {
        expect(rockFireChaserGuards.map((n) => n.rock).sort()).toEqual(['L100:breakablerock@128,144', 'L73:breakablerock@64,48']);
        for (const n of rockFireChaserGuards) {
            const entry = SIDES.get(n.rock);
            expect(entry.stances, n.rock).toEqual([]);
            expect(entry.fireDirs, n.rock).toEqual([]);
            expect(entry.guarded.length > 0, n.rock).toBe(true);
            for (const g of entry.guarded) expect(Number.isFinite(g.spawn.x) && Number.isFinite(g.spawn.y), n.rock).toBe(true);
        }
        expect(SIDES.get('L73:breakablerock@64,48').guarded.map((g) => g.body)).toEqual(['lavarunner@32,24']);
        expect(SIDES.get('L100:breakablerock@128,144').guarded.map((g) => g.body)).toEqual(['flyer@224,96']);
        // the holder narrowing is untouched: its one rock, its record, and no guard on it
        expect(rockFireNarrowings.map((n) => n.rock)).toEqual(['L16:breakablerock@304,64']);
        expect(SIDES.get('L16:breakablerock@304,64').narrowed.body).toBe('bob@160,112');
        expect(SIDES.get('L16:breakablerock@304,64').guarded).toBeUndefined();
        // every other rock with a flame stance keeps it (L92's two among them)
        expect(SIDES.get('L92:breakablerock@176,48').stances.length > 0).toBe(true);
        expect(SIDES.get('L92:breakablerock@256,112').stances.length > 0).toBe(true);
    });

    it('rules and maze drop Fire together on the guarded rocks, and keep it on L92', () => {
        const ruleOf = (rules, from, to) => JSON.stringify(rules.regions['1'][from].exits.find((e) => e.connected_region === to)?.access_rule);
        for (const preset of ['seedling_playthrough', 'seedling_er', 'seedling_playthrough_maze']) {
            const rules = read(`frontend/presets/${preset}/AP_1/AP_1_rules.json`);
            // ⛓ rules-k-pursuit-resume: rule K cuts L73 at its lavarunners' leashes, so the rock's far side is the new member r4c4 (was r3c7);
            //   the rock row keeps its rule, Or(Dark Suit, Sword, Spear), Fire-free.
            expect(ruleOf(rules, 'level_73__r4c4', 'level_73__r0c4'), preset).not.toContain('"Fire"');
            expect(ruleOf(rules, 'level_73__r0c4', 'level_73__r4c4'), preset).not.toContain('"Fire"');
            expect(ruleOf(rules, 'level_73__r0c4', 'level_73__r4c4'), preset).toContain('"Dark Suit"');
            expect(ruleOf(rules, 'level_100__r4c10', 'level_100__r2c3'), preset).not.toContain('"Fire"');
            expect(ruleOf(rules, 'level_92__r1c7', 'level_92__r3c12'), preset).toContain('"Fire"');
            expect(ruleOf(rules, 'level_92__r3c12', 'level_92__r7c17'), preset).toContain('"Fire"');
        }
        const maze = read('frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json').preset_sidecars['1'];
        for (const n of rockFireChaserGuards) {
            const [x, y] = SIDES.get(n.rock).tiles[0];
            const payload = Object.values(maze).find((sc) => sc.playable_payload?.atlas_region === `level_${n.level}`)?.playable_payload;
            const id = payload.obstacles.find((o) => o.x === x && o.y === y)?.id;
            expect(payload.obstacleLib[id]?.kind, n.rock).toBe('rock');
            expect(payload.obstacleLib[id].struck_by, n.rock).not.toContain('fire');
            expect(payload.obstacleLib[id].struck_from, n.rock).toBeUndefined();
        }
    });
});
