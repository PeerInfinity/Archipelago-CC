/**
 * ⛓⛓ rules-k-pursuit-speed — RULE K with TERM (b) (`seedlingChaserPursuitGuard.js`): unit rows on synthetic rooms (the real
 * classes, the speeds MEASURED here off the ports, never typed) and on the delivered set through the producer.
 *
 * Every (b) row runs the real verdict AND a mutant of term (b), and asserts the mutant's verdict differs (each mutant reds
 * its row):
 *   flip   — the comparison flipped (`<=` for `>`)
 *   dms    — the player's speed typed as `Player.as:73` dMS (0.8, the census's nominal) instead of measured off the port
 *   walk   — the player's swim speed taken as its walk speed (the terrain ignored)
 *   room   — the body's terrains taken from the whole room instead of its own flood
 */
import { describe, expect, it } from 'vitest';

import {
    chaserGuardCells, killArmOf, measureChaser, measureHopper, measurePlayer, playerSpeedOn, bodySpeedOn, playerTerrain,
    pursuitFaster, stampChaserGuards, SWIM_TILES,
} from './seedlingChaserPursuitGuard.js';
import { stampOccupancy } from './seedlingTrapTongueGuard.js';
import * as HP from './seedlingHolderParking.js';
import { PLAYTHROUGH_MAP, playthroughGridFor, playthroughChaserGuards } from './make-seedling-playthrough-rules.mjs';
import { ENEMY_CLASSES } from '../../frontend/modules/seedlingDemo/combat.js';
import { CHASERS } from '../../frontend/modules/seedlingDemo/chasers.js';
import * as PP from '../../frontend/modules/seedlingDemo/playerPhysicsV1.js';
import { KILL_ARM_CONDITION, KILL_LOCK_BODY_CLASSES } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';

const key = (c) => JSON.stringify(c);
const ARM = key(KILL_ARM_CONDITION);
const FLOOR = null; // a floor cell carries no tile type in `tileTypesOf` (only water, pit and lava do)
const LAVA = HP.TERRAIN_TILE.lava;

/** A 4-connected walk over the cells whose conditions `held` (condition keys) covers. */
function walks(grid, [sx, sy], [gx, gy], held = []) {
    const { width, height, cells } = grid;
    const has = new Set(held);
    const ok = (i) => !HP.BLOCKING.has(cells[i].kind) && (cells[i].conditions ?? []).every((c) => has.has(key(c)));
    const start = sy * width + sx;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
        const i = stack.pop();
        if (i === gy * width + gx) return true;
        const x = i % width, y = (i - x) / width;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const n = ny * width + nx;
            if (seen.has(n) || !ok(n)) continue;
            seen.add(n);
            stack.push(n);
        }
    }
    return false;
}

// '.' floor, '~' lava (an open cell on tile type 17, as the grid holds a swim cell), '#' wall
function room(rows) {
    const height = rows.length, width = rows[0].length;
    const cells = [];
    const tileTypes = new Map();
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
        cells.push(ch === '#' ? { kind: 'wall', conditions: [] } : { kind: 'open', conditions: [] });
        if (ch === '~') tileTypes.set(y * width + x, LAVA);
    }));
    return { grid: { width, height, cells, origin: { x: 0, y: 0 } }, tileTypes };
}
// the census body shape (`combatCensusOf`): the class row, the spawn and its centre (`contactRect` reads `row.hitbox`, `cx`, `cy`)
const centreOf = (b) => [b.x + ENEMY_CLASSES[b.tag].ctor.dx, b.y + ENEMY_CLASSES[b.tag].ctor.dy];
const body = (tag, tx, ty) => {
    const b = { tag, row: ENEMY_CLASSES[tag], x: tx * 16, y: ty * 16 };
    const [cx, cy] = centreOf(b);
    return { ...b, cx, cy };
};

// The L72 shape: a long 1-wide neck, the body on it near the landing (x = 1), the goal (x = 28) outside its leash.
const neck = (ch) => room(['##############################', `${ch.repeat(30)}`, '##############################']);
const EXEMPT = new Set([1 * 30 + 0, 1 * 30 + 1]); // the door (0,1) and its landing (1,1)

/** Term (b) mutants (the header). Each is a `pursuit` for `chaserGuardCells`. */
const MUTANTS = {
    flip: (tag, ts) => ts.filter((t) => bodySpeedOn(tag, t) <= playerSpeedOn(t)),
    dms: (tag, ts) => ts.filter((t) => bodySpeedOn(tag, t) > PP.WALK_SPEED),
    walk: (tag, ts) => ts.filter((t) => bodySpeedOn(tag, t) > playerSpeedOn(FLOOR)),
};
const verdict = (r, b, pursuit) => chaserGuardCells(b, { grid: r.grid, tileTypes: r.tileTypes, centre: centreOf(b), exempt: EXEMPT, ...(pursuit ? { pursuit } : {}) });

describe('term (b): the speeds are measured off the ports', () => {
    it('player walk > dMS (the saw-tooth), swim < walk; a lavarunner outruns it on both; a puncher and a drill on neither', () => {
        const walk = measurePlayer(playerTerrain(FLOOR));
        const swim = measurePlayer(playerTerrain(LAVA));
        expect(walk).toBeGreaterThan(PP.WALK_SPEED); // ≈ 1.1746, not dMS 0.8
        expect(swim).toBeLessThan(walk); // ≈ 0.45
        const lr = CHASERS.lavarunner.speedByTerrain;
        expect(lr.swimTiles).toContain(LAVA);
        expect(measureChaser('lavarunner', lr.walk)).toBeGreaterThan(walk); // ≈ 1.25
        expect(measureChaser('lavarunner', lr.swim)).toBeGreaterThan(swim); // ≈ 0.75
        expect(measureChaser('puncher', ENEMY_CLASSES.puncher.speed)).toBeLessThan(walk); // ≈ 0.75
        expect(measureHopper()).toBeLessThan(walk); // ≈ 1.0667 (16 px per 15-tick cycle)
        expect(SWIM_TILES).toContain(LAVA);
    });
});

describe('rule K with term (b) — the five rows', () => {
    it('a lavarunner on floor: charged (the crossing out of its leash costs the kill arm)', () => {
        const r = neck('.');
        const b = body('lavarunner', 3, 1);
        expect(bodySpeedOn('lavarunner', FLOOR)).toBeGreaterThan(playerSpeedOn(FLOOR));
        const v = verdict(r, b);
        expect(v.faster).toEqual([FLOOR]);
        expect(v.guards).toBe(true);
        const out = stampChaserGuards({ ...r, bodies: [b], centreOf, exempt: EXEMPT });
        expect(out.guards).toHaveLength(1);
        expect(walks(out.grid, [1, 1], [28, 1])).toBe(false);
        expect(walks(out.grid, [1, 1], [28, 1], [ARM])).toBe(true);
        expect(walks(out.grid, [1, 1], [0, 1])).toBe(true); // back through the door: never charged
        // mutant: flip reds it
        expect(verdict(r, b, MUTANTS.flip).guards).toBe(false);
    });

    it('a lavarunner in lava against a swimming player: charged (0.75 > 0.45, though 0.75 < the player\'s walk)', () => {
        const r = neck('~');
        const b = body('lavarunner', 3, 1);
        expect(bodySpeedOn('lavarunner', LAVA)).toBeGreaterThan(playerSpeedOn(LAVA));
        expect(bodySpeedOn('lavarunner', LAVA)).toBeLessThan(playerSpeedOn(FLOOR));
        const v = verdict(r, b);
        expect(v.terrainTypes).toEqual([LAVA]);
        expect(v.faster).toEqual([LAVA]);
        expect(v.guards).toBe(true);
        // mutants: the player's swim taken as its walk, or the player typed at dMS... the walk mutant reds it
        expect(verdict(r, b, MUTANTS.walk).guards).toBe(false);
        expect(verdict(r, b, MUTANTS.flip).guards).toBe(false);
    });

    it('a puncher: dropped (0.75 < the player\'s walk), though K as built charged it (census speed 1 > dMS)', () => {
        const r = neck('.');
        const b = body('puncher', 3, 1);
        const v = verdict(r, b);
        expect(v.terms.nominal && v.terms.c && v.terms.contact).toBe(true); // K's own terms hold
        expect(v.kCut.size).toBeGreaterThan(0);
        expect(v.faster).toEqual([]);
        expect(v.guards).toBe(false);
        expect(v.bCut.size).toBe(0);
        const out = stampChaserGuards({ ...r, bodies: [b], centreOf, exempt: EXEMPT });
        expect(out.guards).toEqual([]);
        expect(out.dropped.map((d) => d.body)).toEqual(['puncher@48,16']);
        expect(walks(out.grid, [1, 1], [28, 1])).toBe(true);
        // mutant: the comparison flipped reds it (the dMS mutant does not: 0.75 < 0.8 too)
        expect(verdict(r, b, MUTANTS.flip).guards).toBe(true);
            });

    it('a drill: dropped (16 px per 15-tick hop cycle ≈ 1.0667 < the player\'s walk)', () => {
        const r = neck('.');
        const b = body('drill', 3, 1);
        const v = verdict(r, b);
        expect(v.kCut.size).toBeGreaterThan(0); // K as built charged it (census speed 16 px > dMS)
        expect(v.faster).toEqual([]);
        expect(v.guards).toBe(false);
        // mutant: the player typed at dMS — the drill then "outruns" it: reds the row
        expect(verdict(r, b, MUTANTS.dms).guards).toBe(true);
    });

    it('a body whose flood holds no tile where it outruns the player: dropped (the drill beside lava it dies in)', () => {
        // the drill would outrun a SWIMMING player (1.0667 > 0.45), but lava is its lethal tile, so its flood is floor only
        const r = room(['##############################', '..............................', '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', '##############################']);
        const b = body('drill', 3, 1);
        expect(bodySpeedOn('drill', LAVA)).toBeGreaterThan(playerSpeedOn(LAVA));
        const v = verdict(r, b);
        expect(v.terrainTypes).toEqual([FLOOR]);
        expect(v.faster).toEqual([]);
        expect(v.guards).toBe(false);
        // mutant: the terrains read off the whole room instead of the flood — lava then qualifies: reds the row
        const roomTypes = [...new Set([...r.grid.cells.keys()].map((i) => r.tileTypes.get(i) ?? null))];
        const roomMutant = (tag) => pursuitFaster(tag, roomTypes);
        expect(verdict(r, b, roomMutant).guards).toBe(true);
    });
});

describe('the arm and the composition', () => {
    it('the arm is the kill-lock census\'s, by class (lavarunner: KILL_LOCK_BODY_CLASSES; a class only ENEMY_CLASSES.kill holds; refusals)', () => {
        expect(KILL_LOCK_BODY_CLASSES.lavarunner).toBeDefined();
        expect(killArmOf('lavarunner').arm).toEqual(KILL_ARM_CONDITION);
        expect(killArmOf('lavarunner').src).toMatch(/LavaRunner\.as/);
        expect(killArmOf('grenade')).toEqual({ free: true });
        expect(killArmOf('iceturret').refuse).toMatch(/corpse/);
        expect(killArmOf('nosuchclass').refuse).toMatch(/derives a kill arm/);
    });

    it('K on a T cell composes (And), and a cell holding the arm or a disjunct of it is left alone', () => {
        // a 2-wide neck: the leash's cut is two cells wide, so one holds T's gate and the other a disjunct of the arm
        const r = room(['##############################', '..............................', '..............................', '##############################']);
        const b = body('lavarunner', 3, 1);
        const plain = stampChaserGuards({ ...r, bodies: [b], centreOf, exempt: EXEMPT });
        const [c1, c2] = plain.charged.map(([x, y]) => y * 30 + x);
        expect(c2).toBeDefined();
        const t = { any: [{ flag: 'hasDarkSuit' }, { flag: 'hasSpear' }] };
        const pre = stampOccupancy(stampOccupancy(r.grid, new Set([c1]), t), new Set([c2]), KILL_ARM_CONDITION.any[0]);
        const out = stampChaserGuards({ grid: r.grid, onto: pre, tileTypes: r.tileTypes, bodies: [b], centreOf, exempt: EXEMPT });
        expect(out.grid.cells[c1].conditions.map(key)).toEqual([key(t), ARM]);
        expect(out.grid.cells[c1].kind).toBe('gated');
        expect(out.grid.cells[c2].conditions.map(key)).toEqual([key(KILL_ARM_CONDITION.any[0])]);
    });
});

describe('the delivered set (through the producer)', () => {
    const level = (n) => PLAYTHROUGH_MAP.levels.find((l) => l.level === n);

    it('the guarding bodies are lavarunners only; every puncher and drill K would charge is dropped by (b)', () => {
        for (const l of PLAYTHROUGH_MAP.levels) playthroughGridFor(l);
        const guards = [...playthroughChaserGuards.values()].flatMap((g) => g.guards.map((r) => r.body.split('@')[0]));
        const dropped = [...playthroughChaserGuards.values()].flatMap((g) => g.dropped.map((r) => r.body.split('@')[0]));
        expect(new Set(guards)).toEqual(new Set(['lavarunner']));
        expect(dropped.length).toBeGreaterThan(0);
        expect(new Set(dropped)).toEqual(new Set(['puncher', 'drill']));
    });

    it('L72: the item-less crossing L71 → L73 is charged (GAME NO, hit at t35)', () => {
        const g = playthroughChaserGuards.get(72) ?? (playthroughGridFor(level(72)), playthroughChaserGuards.get(72));
        expect(g.guards.map((r) => r.body).sort()).toEqual(['lavarunner@136,88', 'lavarunner@216,240', 'lavarunner@80,216']);
        // the north landing to L73's door is not walkable item-less, and is with the arm
        const grid = playthroughGridFor(level(72));
        const charged = new Set(g.guards.flatMap((r) => r.cut.map(([x, y]) => `${x},${y}`)));
        expect(charged.size).toBeGreaterThan(0);
        for (const k of charged) {
            const [x, y] = k.split(',').map(Number);
            expect(grid.cells[y * grid.width + x].conditions.map(key)).toContain(ARM);
        }
    });
});
