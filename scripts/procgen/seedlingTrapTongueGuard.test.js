/**
 * ⛓⛓ rules-lavatrap-neck — RULE T's pure half (`seedlingTrapTongueGuard.js`) on synthetic rooms, and the delivered L77 and
 * L78 through the producer. A route is "charged" when a 4-connected walk over the cells whose occupancy conditions the held
 * set covers fails without the charge and succeeds with it.
 *
 * MUTATIONS (each reds the named row):
 *   m1 `discsSeal` ignored (every disc stamped)             -> "a trap with a path outside its reach charges nothing"
 *   m2 the flood does not avoid live reaches                 -> "no cardinal spot reachable outside every disc: Suit only"
 *   m3 a killed trap stays live in the kill order            -> "discs killed in order (the L78 shape): both take the Spear"
 *   m4 `cardinalKillSpots` searches from k = 1 (inside the disc) -> "the Sword never qualifies (derived, not listed)"
 *   m5 `tongueKills` ignores the class table                 -> "a trap class that does not kill charges nothing"
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    TONGUE_ARMS, TONGUE_KILL_CLASSES, cardinalKillSpots, discsSeal, hitsToKill, stampTrapTongues, tongueCondition, tongueKills,
    trapKillArms,
} from './seedlingTrapTongueGuard.js';
import * as HP from './seedlingHolderParking.js';
import { PLAYTHROUGH_MAP, playthroughGridFor, playthroughTrapTongues, playthroughTrapKillArms } from './make-seedling-playthrough-rules.mjs';
import { collideLineSolid } from '../../frontend/modules/seedlingDemo/crusher.js';
import { playerBoxAt } from '../../frontend/modules/seedlingDemo/playerPhysicsV2.js';
import { rectsOverlap } from '../../frontend/modules/seedlingDemo/levelWorld.js';
import { LAVATRAP_PULL, KILL_ARM_CONDITION, lavaTrapPulls } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
import { ENEMY_CLASSES } from '../../frontend/modules/seedlingDemo/combat.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const key = (c) => JSON.stringify(c);
const SUIT = LAVATRAP_PULL.condition;
const SPEAR_GATE = tongueCondition(SUIT, ['hasSpear']);
const arm = (flag) => TONGUE_ARMS.find((a) => a.flag === flag);

/** A 4-connected walk over the cells whose conditions `held` (condition keys) covers. */
function walks(grid, [sx, sy], [gx, gy], held = []) {
    const { width, height, cells } = grid;
    const has = new Set(held.map(key));
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

/**
 * A synthetic room: '#' wall (a 16 px Solid), '.' floor, 'T' a trap on floor, 'S' a landing on floor. Returns the analyzer
 * grid, the pulls (`lavaTrapPulls` over the same tiles), and the `trapKillArms` room (pixel solids from the walls).
 */
function synth(rows, { tag = 'lavatrap' } = {}) {
    const height = rows.length, width = rows[0].length;
    const cells = [];
    const walls = [];
    const traps = [];
    const seeds = [];
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
        cells.push(ch === '#' ? { kind: 'wall', conditions: [] } : { kind: 'open', conditions: [] });
        if (ch === '#') walls.push({ x: x * 16, y: y * 16, right: x * 16 + 16, bottom: y * 16 + 16 });
        if (ch === 'T') traps.push([x, y]);
        if (ch === 'S') seeds.push([x, y]);
    }));
    const grid = { width, height, cells, origin: { x: 0, y: 0 } };
    const level = { level: 0, width, height, entities: traps.map(([x, y]) => ({ type: 'lavatrap', x: x * 16, y: y * 16 })) };
    const pulls = lavaTrapPulls(level, 16).map((p) => ({ ...p, tag }));
    const hb = ENEMY_CLASSES.lavatrap.hitbox;
    const room = {
        widthPx: width * 16,
        heightPx: height * 16,
        free: (x, y) => !walls.some((w) => rectsOverlap(playerBoxAt(x, y), w)),
        solidAt: (r) => walls.some((w) => rectsOverlap(r, w)),
        blockedLine: (x0, y0, x1, y1) => collideLineSolid(walls, x0, y0, x1, y1) !== null,
        enterable: (tx, ty) => cells[ty * width + tx]?.kind === 'open',
        traps: pulls.filter((p) => tongueKills(p.tag)).map((p) => {
            const c = [p.tile[0] * 16 + 8, p.tile[1] * 16 + 8];
            return { id: p.tile.join(','), tag: p.tag, centre: c, box: { x: c[0] - hb.ox, y: c[1] - hb.oy, right: c[0] - hb.ox + hb.w, bottom: c[1] - hb.oy + hb.h } };
        }),
        seeds: seeds.map(([tx, ty]) => {
            const points = [];
            for (let y = ty * 16; y < ty * 16 + 16; y += 1) for (let x = tx * 16; x < tx * 16 + 16; x += 1) points.push([x, y]);
            return { name: `${tx},${ty}`, points };
        }),
    };
    const anchors = seeds.map(([x, y]) => y * width + x);
    const passable = (i) => cells[i].kind === 'open';
    return { grid, pulls, room, anchors, passable, seeds };
}
const stamp = (s, killArms = new Map()) => stampTrapTongues({ grid: s.grid, pulls: s.pulls, killArms, anchors: s.anchors, passable: s.passable });

/**
 * The L77 shape: one corridor, the trap ON it (its disc is the only neck), a landing at each end. The corridor's axis
 * through the trap is floor on both sides, so the Spear has a spot from either landing.
 */
const NECK = [
    '###############',
    '###############',
    'S.....T.......S',
    '###############',
    '###############',
];
/** A trap ON a corridor, with a loop round that never comes within its reach (a way round). */
const WAY_ROUND = [
    '...............',
    '.#############.',
    '.#############.',
    '.#############.',
    '.#############.',
    '.#############.',
    'S......T......S',
    '###############',
];
/**
 * A trap whose four axis tiles (33..37 px out: tiles ±2) are WALLS, reached by a staircase that passes diagonally through
 * its disc: no cardinal spot exists, so the Dark Suit alone.
 */
const NO_SPOT = [
    '##########',
    '#S..######',
    '###.######',
    '###..#####',
    '####..####',
    '#####T####',
    '#####..###',
    '######.###',
    '######..S#',
    '##########',
];
/**
 * NO_SPOT with its south axis tile (5,7) opened: a Spear spot now EXISTS, but only on the far side of the disc from the
 * north landing (the south landing reaches it directly). An arm must kill from every landing that comes near: Suit only.
 */
const SPOT_BEYOND = NO_SPOT.map((r, y) => (y === 7 ? '#####..###' : r));
/**
 * Two traps on one corridor (the L78 shape): B (west) has its east spot reachable from the east landing only after A
 * (east) is dead, and A's spot is reachable from the east landing directly. The west landing reaches B first.
 */
const IN_ORDER = [
    '#####################',
    '#####################',
    'S....T....T.........S',
    '#####################',
    '#####################',
];

describe('rule T — which traps', () => {
    it('only the LavaTrap\'s tongue kills (the class table), and it carries the Dark Suit with the pulls\' own reach', () => {
        expect(Object.entries(TONGUE_KILL_CLASSES).filter(([, c]) => c.kills).map(([t]) => t)).toEqual(['lavatrap']);
        expect(TONGUE_KILL_CLASSES.lavatrap.condition).toEqual(LAVATRAP_PULL.condition);
        expect(TONGUE_KILL_CLASSES.lavatrap.chompRange).toBe(LAVATRAP_PULL.chompRange);
    });

    const SRC = resolve(REPO, 'vendor/seedling/src/Enemies');
    it.skipIf(!existsSync(SRC))('the class table re-derives from the AS3: only the classes whose body calls die() behind hasDarkSuit kill', () => {
        const kills = (cls) => {
            const t = readFileSync(resolve(SRC, `${cls}.as`), 'utf8');
            return /\.die\(\)/.test(t) && /hasDarkSuit/.test(t);
        };
        for (const row of Object.values(TONGUE_KILL_CLASSES)) expect(kills(row.as3), row.as3).toBe(row.kills);
    });

    it('a trap class that does not kill charges nothing (SandTrap on the neck)', () => {
        const s = synth(NECK, { tag: 'sandtrap' });
        const out = stamp(s);
        expect(out.traps).toEqual([]);
        expect(walks(out.grid, [0, 2], [14, 2])).toBe(true);
    });
});

describe('rule T — the charge', () => {
    it('the disc on the only neck charges the crossing, both ways', () => {
        const s = synth(NECK);
        const out = stamp(s);
        expect(out.sealed.length).toBeGreaterThan(0);
        expect(walks(out.grid, [0, 2], [14, 2])).toBe(false);
        expect(walks(out.grid, [14, 2], [0, 2])).toBe(false);
        expect(walks(out.grid, [0, 2], [14, 2], [SUIT])).toBe(true);
    });

    it('a trap with a path outside its reach charges nothing (the discs seal no anchor pair)', () => {
        const s = synth(WAY_ROUND);
        const out = stamp(s);
        expect(out.sealed).toEqual([]);
        expect(out.traps).toEqual([]);
        expect(out.grid).toBe(s.grid);
    });
});

describe('rule T — the arms (derived from the weapons\' own hit tests and Enemy.hit)', () => {
    it('a spearable trap: the Spear arm appears, from both landings, and the gate is Or(Dark Suit, Ghost Spear)', () => {
        const s = synth(NECK);
        const [row] = trapKillArms(s.room);
        expect(row.arms).toEqual(['hasSpear']);
        expect(row.perArm.hasSpear.killedFrom.sort()).toEqual(['0,2', '14,2']);
        expect(row.perArm.hasSpear.windows.W).toBe('33..37');
        const out = stamp(s, new Map([[row.id, row.arms]]));
        expect(walks(out.grid, [0, 2], [14, 2], [SPEAR_GATE])).toBe(true);
    });

    it('the Sword never qualifies (derived, not listed): its reach ends inside the disc, and so do the Ghost Sword and the Dark Shield', () => {
        const s = synth(NECK);
        const [row] = trapKillArms(s.room);
        for (const flag of ['hasSword', 'hasGhostSword', 'hasDarkShield']) {
            expect(Number.isFinite(row.perArm[flag].hits), flag).toBe(true);
            expect(row.perArm[flag].spots, flag).toBe(0);
            expect(row.arms).not.toContain(flag);
        }
        // the slash's own test: the farthest axis point it lands from is inside 33 px
        const trap = s.room.traps[0];
        const reach = cardinalKillSpots(trap, arm('hasSword'), s.room, { chompRange: 0 }).map((p) => p.k);
        expect(Math.max(...reach)).toBeLessThan(LAVATRAP_PULL.chompRange + 1);
    });

    it('Fire and the plain Shield never kill: Enemy.hit refuses the damage (hitByFire false), so no spot is ever asked', () => {
        expect(hitsToKill(arm('hasFire'))).toBe(Infinity);
        expect(hitsToKill(arm('hasShield'))).toBe(Infinity);
        expect(hitsToKill(arm('hasSpear'))).toBe(2);
        expect(hitsToKill(arm('hasWand'))).toBe(6);
        const [row] = trapKillArms(synth(NECK).room);
        expect(row.perArm.hasFire.granted).toBe(false);
        expect(row.perArm.hasFire.spots).toBe(0);
    });

    it('the Wand: the spot is computed, the arm is not granted (its kill time is the chase question, named)', () => {
        const [row] = trapKillArms(synth(NECK).room);
        expect(row.perArm.hasWand.spots).toBeGreaterThan(0);
        expect(row.perArm.hasWand.killedFrom.length).toBe(2);
        expect(row.perArm.hasWand.granted).toBe(false);
        expect(row.arms).not.toContain('hasWand');
    });

    it('no cardinal spot reachable outside every disc: Suit only', () => {
        const s = synth(NO_SPOT);
        const [row] = trapKillArms(s.room);
        expect(row.arms).toEqual([]);
        const out = stamp(s, new Map([[row.id, row.arms]]));
        expect(out.traps[0].condition).toEqual(SUIT);
        expect(walks(out.grid, [1, 1], [8, 8], [SPEAR_GATE])).toBe(false);
        expect(walks(out.grid, [1, 1], [8, 8], [SUIT])).toBe(true);
    });

    it('a spot reachable only through the disc (from one landing) does not qualify: Suit only', () => {
        const s = synth(SPOT_BEYOND);
        const [row] = trapKillArms(s.room);
        expect(row.perArm.hasSpear.spots).toBeGreaterThan(0);
        expect(row.perArm.hasSpear.killedFrom).toEqual(['8,8']);
        expect(row.perArm.hasSpear.approaches.sort()).toEqual(['1,1', '8,8']);
        expect(row.arms).toEqual([]);
    });

    it('discs killed in order (the L78 shape): both take the Spear, and the second dies only after the first', () => {
        const s = synth(IN_ORDER);
        const rows = trapKillArms(s.room);
        expect(rows.map((r) => r.arms)).toEqual([['hasSpear'], ['hasSpear']]);
        // from the east landing alone, the west trap's spot lies between the two traps: reached only once the east trap is dead
        const once = trapKillArms({ ...s.room, seeds: s.room.seeds.filter((x) => x.name === '20,2') }, { arms: [arm('hasSpear')] });
        expect(once.find((r) => r.id === '5,2').perArm.hasSpear.killedFrom).toEqual(['20,2']);
    });
});

describe('rule T — the delivered set (through the producer)', () => {
    const level = (n) => PLAYTHROUGH_MAP.levels.find((l) => l.level === n);

    it('L77: lavatrap@96,192\'s disc seals the north and south landings; the crossing costs Or(Dark Suit, Ghost Spear)', () => {
        const grid = playthroughGridFor(level(77));
        const t = playthroughTrapTongues.get(77);
        expect(t.sealed.length).toBeGreaterThan(0);
        expect(t.traps.map((r) => [r.trap, r.arms])).toEqual([[[6, 12], ['hasSpear']]]);
        // the north landing (1,2) to the south door's landing (6,18)
        expect(walks(grid, [1, 2], [6, 18])).toBe(false);
        // ⛓ rules-k-pursuit-speed: rule K's runner cut lies on this walk too; the Spear is one of its arms
        // (KILL_ARM_CONDITION), so the Spear alone pays both gates
        expect(walks(grid, [1, 2], [6, 18], [SPEAR_GATE, KILL_ARM_CONDITION])).toBe(true);
    });

    it('L78: every disc takes the Spear (9,6 then 6,5 from the L77 side), from both landings', () => {
        playthroughGridFor(level(78));
        const rows = playthroughTrapKillArms(level(78));
        expect(rows.map((r) => [r.id, r.arms])).toEqual([['9,3', ['hasSpear']], ['6,5', ['hasSpear']], ['9,6', ['hasSpear']]]);
        for (const r of rows) expect(r.perArm.hasSpear.killedFrom.sort()).toEqual(['16,1', '2,1']);
        expect(playthroughTrapTongues.get(78).sealed.length).toBeGreaterThan(0);
        // the discs overlap: a cell in two of them carries the gate once
        const grid = playthroughGridFor(level(78));
        for (const c of grid.cells) expect(new Set((c.conditions ?? []).map(key)).size).toBe((c.conditions ?? []).length);
    });

    it('L80 and L108: their discs seal nothing, so nothing is stamped', () => {
        for (const n of [80, 108]) {
            playthroughGridFor(level(n));
            const t = playthroughTrapTongues.get(n);
            expect(t.sealed, `L${n}`).toEqual([]);
            expect(t.traps, `L${n}`).toEqual([]);
        }
    });
});
