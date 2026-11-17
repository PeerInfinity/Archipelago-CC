/**
 * ⛓⛓ rules-chaser-arrival-killarm — RULE K (a fast contact chaser's leash cut costs its kill arm) and RULE T (a LavaTrap's
 * clear-line disc costs the Dark Suit), the pure halves (`seedlingArrivalGuards.js`), on synthetic rooms and on the
 * delivered L72, L77 and L80. A route is "charged" when a 4-connected walk from its start to its goal over the cells whose
 * occupancy conditions the held set covers fails without the charge and succeeds with it.
 *
 * MUTATIONS (each reds the named row):
 *   m1 term (b) uses >= instead of >                    -> "a slow body (at or under dMS) guards nothing"
 *   m2 the cut ignores whether the body can follow      -> "a fast homer whose leash an alternative path avoids charges nothing"
 *   m3 the line test is dropped                         -> "a disc cell behind a wall is not charged"
 *   m4 stampOccupancy replaces instead of ANDing        -> "a K gate and a T gate on one cell compose to And(Dark Suit, kill arm)"
 *   m5 contactHitsOf ignores CHASERS.contactHits        -> "a body that does not hit on contact (the Flyer) guards nothing"
 */
import { describe, expect, it } from 'vitest';

import {
    chaserGuardCells, contactHitsOf, killArmOf, lineClear, stampArrivalGuards, stampOccupancy, trapTongueCells,
} from './seedlingArrivalGuards.js';
import { guardClassOf } from './seedlingFireChaserGuard.js';
import * as HP from './seedlingHolderParking.js';
import { PLAYTHROUGH_MAP, playthroughGridFor, playthroughAnalyzerOptions } from './make-seedling-playthrough-rules.mjs';
import { combatCensusOf } from '../../frontend/modules/seedlingDemo/levelWorld.js';
import { ENEMY_CLASSES } from '../../frontend/modules/seedlingDemo/combat.js';
import { simplifyRule } from '../../frontend/modules/procgenPipeline/regionAtlasAnalyzer.js';
import {
    KILL_ARM_CONDITION, LAVATRAP_PULL, lavaTrapPulls,
} from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';

const key = (c) => JSON.stringify(c);
const ARM = key(KILL_ARM_CONDITION);
const SUIT = key(LAVATRAP_PULL.condition);

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

// ── synthetic rooms: '.' floor, '#' wall; a homer's class is synthesised through `classOf` ───────────────────────────
function room(rows) {
    const height = rows.length, width = rows[0].length;
    const cells = [];
    for (const r of rows) for (const ch of r) cells.push(ch === '#' ? { kind: 'wall', conditions: [] } : { kind: 'open', conditions: [] });
    return { width, height, cells, origin: { x: 0, y: 0 } };
}
const synthClass = (speed, { runRange = 80, kind = 'chase' } = {}) => () => ({
    ...guardClassOf('lavarunner'), homing: kind === 'chase', aggroKind: kind, runRange, speedOn: () => speed,
});
// the census body shape (`combatCensusOf`): the class row, the spawn and its centre (`contactRect` reads `row.hitbox`, `cx`, `cy`)
const body = (tx, ty) => ({ tag: 'lavarunner', row: ENEMY_CLASSES.lavarunner, x: tx * 16, y: ty * 16, cx: tx * 16 + 8, cy: ty * 16 + 8 });
const centre = (b) => [b.x + 8, b.y + 8];
const arm = () => ({ arm: KILL_ARM_CONDITION });

/**
 * A long 1-wide corridor (y = 2) from x = 0 to x = 29, the body on it at x = 3: the landing (x = 1) is inside the
 * 80 px leash and the far end (x = 28) is outside it — the L72 shape (the runner on the only neck).
 */
const NECK = room([
    '##############################',
    '##############################',
    '..............................',
    '##############################',
]);

describe('rule K — a fast homer on a neck charges the route that leaves its leash', () => {
    it('charges the walk from a landing inside the leash to a goal outside it; the return door is not charged', () => {
        const b = body(3, 2);
        const exempt = new Set([2 * 30 + 0, 2 * 30 + 1]); // the door (0,2) and its landing (1,2)
        const out = stampArrivalGuards({ grid: NECK, tileTypes: new Map(), bodies: [b], centreOf: centre, exempt },
            { classOf: synthClass(1.5), armOf: arm });
        expect(out.guards).toHaveLength(1);
        expect(walks(out.grid, [1, 2], [28, 2])).toBe(false);
        expect(walks(out.grid, [1, 2], [28, 2], [ARM])).toBe(true);
        expect(walks(out.grid, [1, 2], [0, 2])).toBe(true);
    });

    it('a slow body (at or under dMS) guards nothing', () => {
        for (const speed of [0.8, 0.65]) {
            const v = chaserGuardCells(body(3, 2), { grid: NECK, tileTypes: new Map(), centre: centre(body(3, 2)), classOf: synthClass(speed) });
            expect(v.terms.b, String(speed)).toBe(false);
            expect(v.cut.size).toBe(0);
        }
    });

    it('a body that does not hit on contact (the Flyer) guards nothing', () => {
        expect(contactHitsOf('flyer')).toBe(false);
        expect(contactHitsOf('lavarunner')).toBe(true);
        const v = chaserGuardCells({ tag: 'flyer', x: 48, y: 32 }, { grid: NECK, tileTypes: new Map(), centre: [56, 40] });
        expect(v.guards).toBe(false);
        expect(v.cut.size).toBe(0);
    });

    it('a fast homer whose leash an alternative path avoids charges nothing', () => {
        // the body sits in a pocket (x 3..5, y 2) one wall row below the route row y = 0: the route is inside its 80 px
        // leash, but its flood is the pocket, so it cannot follow the player there and nothing on the route is cut
        const g = room([
            '..............................',
            '##############################',
            '###...########################',
        ]);
        const b = body(4, 2);
        const out = stampArrivalGuards({ grid: g, tileTypes: new Map(), bodies: [b], centreOf: centre },
            { classOf: synthClass(1.5), armOf: arm });
        expect(walks(out.grid, [0, 0], [29, 0])).toBe(true);
        // and a second, longer route around a body's leash: two rows joined at both ends, the body beside the top row
        const loop = room([
            '..............................',
            '.############################.',
            '.############################.',
            '.############################.',
            '.############################.',
            '.############################.',
            '.############################.',
            '..............................',
        ]);
        const out2 = stampArrivalGuards({ grid: loop, tileTypes: new Map(), bodies: [body(15, 0)], centreOf: centre },
            { classOf: synthClass(1.5), armOf: arm });
        expect(out2.guards).toHaveLength(1);
        expect(walks(out2.grid, [0, 3], [29, 3])).toBe(true);
    });

    it('the arm is the kill-lock census\'s: a lavarunner and a drill take KILL_ARM_CONDITION; a self-remover is free; an unkillable class refuses', () => {
        expect(key(killArmOf('lavarunner').arm)).toBe(ARM);
        expect(key(killArmOf('drill').arm)).toBe(ARM);
        expect(killArmOf('grenade')).toEqual({ free: true });
        expect(killArmOf('darktrap').refuse).toMatch(/derives a kill arm/);
    });
});

// ── rule T ───────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('rule T — a lava trap whose clear-line disc covers every path costs the Dark Suit', () => {
    const level = (rows, traps) => ({ level: 0, width: rows[0].length, height: rows.length, entities: traps.map(([x, y]) => ({ type: LAVATRAP_PULL.tag, x: x * 16, y: y * 16 })) });

    it('a trap on a 1-wide corridor charges the walk through it', () => {
        const rows = ['..........', '##########'];
        const g = room(rows);
        const pulls = lavaTrapPulls(level(rows, [[5, 0]]), 16);
        const out = stampArrivalGuards({ grid: g, tileTypes: new Map(), bodies: [], centreOf: centre, pulls });
        expect(out.traps).toHaveLength(1);
        expect(walks(out.grid, [0, 0], [9, 0])).toBe(false);
        expect(walks(out.grid, [0, 0], [9, 0], [SUIT])).toBe(true);
    });

    it('a trap with a path outside its reach charges nothing on that route', () => {
        const rows = ['..........', '#########.', '#########.', '#########.', '..........'];
        const g = room(rows);
        const pulls = lavaTrapPulls(level(rows, [[2, 0]]), 16);
        const out = stampArrivalGuards({ grid: g, tileTypes: new Map(), bodies: [], centreOf: centre, pulls });
        expect(out.traps).toHaveLength(1);
        // from the bottom row's west end to the top row's east end: up the east column, never within 32 px of (2, 0)
        expect(walks(out.grid, [0, 4], [9, 0])).toBe(true);
    });

    it('a disc cell behind a wall is not charged (the launch\'s collideLine("Solid"))', () => {
        const rows = ['.....', '..#..', '.....'];
        const g = room(rows);
        const [pull] = lavaTrapPulls(level(rows, [[2, 0]]), 16);
        const disc = trapTongueCells(pull, { grid: g });
        // (2, 2) is 32 px straight below the trap, through the wall at (2, 1)
        expect(pull.from.some(([x, y]) => x === 2 && y === 2)).toBe(true);
        expect(disc.has(2 * 5 + 2)).toBe(false);
        expect(lineClear(2 * 5 + 2, 0 * 5 + 2, 5, (i) => g.cells[i].kind === 'wall')).toBe(false);
        // and the trap's own tile is left as it is (the pull lands there)
        expect(disc.has(2)).toBe(false);
    });

    it('a trap class that does not kill (SandTrap, DarkTrap, IceTrap) charges nothing', () => {
        for (const tag of ['sandtrap', 'darktrap', 'icetrap']) {
            const lv = { level: 0, width: 10, height: 1, entities: [{ type: tag, x: 80, y: 0 }] };
            expect(lavaTrapPulls(lv, 16), tag).toEqual([]);
            // nor is it a K guard: static, no chase
            const v = chaserGuardCells({ tag, x: 80, y: 0 }, { grid: room(['..........']), tileTypes: new Map(), centre: [88, 8] });
            expect(v.guards, tag).toBe(false);
        }
    });
});

// ── the composition (designer amendment 6) ───────────────────────────────────────────────────────────────────────────
describe('a K gate and a T gate on one cell compose', () => {
    it('to And(Dark Suit, kill arm), resolved by the producer\'s resolver', () => {
        const g = stampOccupancy(stampOccupancy(room(['...']), new Set([1]), KILL_ARM_CONDITION), new Set([1]), LAVATRAP_PULL.condition);
        expect(g.cells[1].kind).toBe('gated');
        expect(g.cells[1].conditions.map(key)).toEqual([ARM, SUIT]);
        const resolve = playthroughAnalyzerOptions.resolveCondition;
        const rule = simplifyRule({ rule: 'And', children: g.cells[1].conditions.map(resolve) });
        const want = simplifyRule({ rule: 'And', children: [resolve(LAVATRAP_PULL.condition), resolve(KILL_ARM_CONDITION)] });
        expect(rule.rule).toBe('And');
        expect(new Set(rule.children.map(key))).toEqual(new Set(want.children.map(key)));
        // a second stamp of the same condition is a no-op
        expect(stampOccupancy(g, new Set([1]), LAVATRAP_PULL.condition).cells[1].conditions).toHaveLength(2);
    });
});

// ── the delivered rooms ──────────────────────────────────────────────────────────────────────────────────────────────
const levelOf = (n) => PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
/** Every door tile of a level and every tile a door elsewhere lands the player on in it. */
function doorsAndLandings(n) {
    const out = new Set();
    const t = (x, y) => [Math.floor(Number(x) / 16), Math.floor(Number(y) / 16)];
    for (const l of PLAYTHROUGH_MAP.levels) {
        for (const e of l.entities ?? []) {
            if (e.attrs?.to === undefined) continue;
            if (l.level === n) out.add(t(e.x, e.y).join(','));
            if (Number(e.attrs.to) === n && e.attrs.playerx !== undefined) out.add(t(e.attrs.playerx, e.attrs.playery).join(','));
        }
    }
    return out;
}
function realStamp(n) {
    const level = levelOf(n);
    const grid = playthroughGridFor(level);
    const exempt = new Set([...doorsAndLandings(n)].map((k) => { const [x, y] = k.split(',').map(Number); return y * grid.width + x; }));
    const pulls = lavaTrapPulls(level, 16);
    for (const p of pulls) exempt.add(p.tile[1] * grid.width + p.tile[0]);
    const centreOf = (b) => [b.x + ENEMY_CLASSES[b.tag].ctor.dx, b.y + ENEMY_CLASSES[b.tag].ctor.dy];
    return stampArrivalGuards({ grid, tileTypes: HP.tileTypesOf(level, grid.width), bodies: combatCensusOf(level).enemies, centreOf, exempt, pulls });
}
const SWIM = key({ flag: 'hasDarkSuit' });

describe('the delivered rooms (rules-arrival-chase-witness\'s rows)', () => {
    it('L72: the L71 landing (1,16) reaches the L73 door (11,0) only with the kill arm (game: item-less hit t35; Sword t556, 0 hits)', () => {
        const { grid } = realStamp(72);
        expect(walks(grid, [1, 16], [11, 0])).toBe(false);
        expect(walks(grid, [1, 16], [11, 0], [ARM])).toBe(true);
        expect(walks(grid, [1, 16], [0, 16])).toBe(true);
    });

    it('L77: the L78 landing (6,18) reaches the L76 door (0,2) only with the kill arm AND the Dark Suit; the return is free', () => {
        const { grid, traps } = realStamp(77);
        expect(traps).toHaveLength(1);
        expect(walks(grid, [6, 18], [0, 2], [SWIM])).toBe(false);
        expect(walks(grid, [6, 18], [0, 2], [ARM])).toBe(false);
        expect(walks(grid, [6, 18], [0, 2], [ARM, SWIM])).toBe(true);
        expect(walks(grid, [6, 18], [6, 19])).toBe(true);
    });

    it('L80: the L71 landing (2,1) reaches r6c4\'s trap approach (5,5) with the Dark Suit alone (game: t75, 0 hits)', () => {
        const { grid } = realStamp(80);
        // (5,5) is a disc cell (T: the suit) and on runner@0,96's cut (K): the trap tile (5,6) itself is where r6c4 begins
        expect(walks(grid, [2, 1], [5, 6], [SWIM])).toBe(true);
    });
});
