/**
 * The maze's paths-and-obstacles extraction, held to the ENGINE (slice maze-logic-t1t2-fix).
 *
 * T2 (⚖ "All-routes minimal sets"): one path per MINIMAL obstacle set over all routes — a door
 * on the first-found route is no longer charged when another route avoids it.
 * T1 (⚖ "Engine search for block worlds"): a region with blocks or buttons is priced by a search
 * over the real `step` — a button's HELD token is never charged as an item, and a block's own
 * path is priced.
 *
 * ⛓ Two arbiters: the engine itself (exhaustive at every subset of the region's items: the
 * engine reaches a target ⇔ its compiled rule holds), and the tile-primitives Q3 search
 * (`tileSpike/deriveRegionLogic`) as an independent ORACLE on generated levels.
 */
import { describe, it, expect } from 'vitest';
import {
    createWorld, createState, step, setTile, setObstacle, setItem, getExitAt, mazeVisitedKey,
    extractPathsAndObstacles, worldInputs, TILE_WALL, BLOCK_WORLD_MAX_ITEMS, ROUTE_SETS_PER_CELL, isFloor,
} from './mazeRoomEngine.js';
import { generateMazeLevel, MAZE_PALETTE } from './procgenMaze.js';
import { parseAreaSpec } from '../procgenCore/areaSpec.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { DEFAULT_OBSTACLES, evaluateRuleAgainstInventory } from '../shared/procgen/library.js';
import { deriveRegionLogic, ruleFromMinimalSets } from './tileSpike/deriveTileLogic.js';
import { itemActionPicture, ACTION_GADGETS, SWORD } from './mazeItemActions.fixtures.js';
import HELPERS from './tileSpike/maze_tiles.helpers.json' with { type: 'json' };

const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const or = (...children) => ({ rule: 'Or', children });
const WEAPON_OR_SWIM = or(has('Progressive Swim'), has('Progressive Sword'));
const ROCK = { name: 'Rock', id: 'rock', clear_set_type: 'rule', clear_rule: or(has('Progressive Sword'), has('Progressive Swim')) };

/** '#' wall · '.' floor · 'P' entrance · 'X' exit · 'R' door_red · 'G' door_green. */
function picture(rows) {
    let entrance = { x: 0, y: 0 };
    let exit = null;
    rows.forEach((row, y) => [...row].forEach((c, x) => {
        if (c === 'P') entrance = { x, y };
        if (c === 'X') exit = { x, y };
    }));
    const w = createWorld(rows[0].length, rows.length, { entrance, exits: [{ exit_id: 'exit', ...exit }] });
    rows.forEach((row, y) => [...row].forEach((c, x) => {
        if (c === '#') setTile(w, x, y, TILE_WALL);
        if (c === 'R') setObstacle(w, x, y, 'door_red');
        if (c === 'G') setObstacle(w, x, y, 'door_green');
    }));
    return w;
}

function guardRoom({ seed = 2, rock = null } = {}) {
    const w = generateMazeLevel({
        seed, palette: MAZE_PALETTE, width: 15, height: 15,
        skeleton: parseSkeleton('rooms', { simulator: true, substrate: 'the extraction test' }),
        areas: parseAreaSpec('1'), elements: parseElementSpec('guard;len=2;turns=1'),
    }).record;
    if (rock) {
        w.obstacleLib = { ...w.obstacleLib, rock: ROCK };
        setObstacle(w, ...{ lane: [8, 4], button: [8, 3] }[rock], 'rock');
    }
    return w;
}

const compiled = (w) => compileRegion(extractPathsAndObstacles(w), { obstacleLib: w.obstacleLib ?? DEFAULT_OBSTACLES });
const ruleAt = (c, x, y) => c.locations.find((l) => l.position.x === x && l.position.y === y).rule;

/** The engine's own answer: BFS over the real `step` (every input the world takes) holding `inventory` (AP: pickups grant nothing). */
function engineCells(world, inventory) {
    const w = { ...world, items: new Map() };
    const start = createState(w);
    start.inventory = new Set(inventory);
    const seen = new Set([mazeVisitedKey(start)]);
    const cells = new Set([`${start.player_pos.x},${start.player_pos.y}`]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
        const s = queue[head];
        if (head > 0 && getExitAt(w, s.player_pos.x, s.player_pos.y) !== null) continue;
        for (const input of worldInputs(w)) {
            const n = step(w, s, input);
            if (n === null || seen.has(mazeVisitedKey(n))) continue;
            seen.add(mazeVisitedKey(n));
            cells.add(`${n.player_pos.x},${n.player_pos.y}`);
            queue.push(n);
        }
    }
    return cells;
}

const subsets = (items) => Array.from({ length: 1 << items.length }, (_, m) => items.filter((_, i) => m & (1 << i)));
const namesIn = (r, out = new Set()) => {
    if (r?.rule === 'Has') out.add(r.args.item_name);
    for (const c of r?.children ?? []) namesIn(c, out);
    return out;
};

/** Every (subset, target) where the compiled rule and the engine disagree. */
function engineDisagreements(world, items) {
    const c = compiled(world);
    const targets = [
        ...c.locations.map((l) => ({ id: l.id, ...l.position, rule: l.rule })),
        ...c.exits.map((e) => ({ id: e.id, ...world.exits.get(e.id), rule: e.rule })),
    ];
    const out = [];
    for (const set of subsets(items)) {
        const cells = engineCells(world, set);
        for (const t of targets) {
            const ruled = evaluateRuleAgainstInventory(t.rule, new Set(set));
            if (ruled !== cells.has(`${t.x},${t.y}`)) out.push(`${t.id}@${t.x},${t.y} under {${set}}: rule=${ruled}`);
        }
    }
    return out;
}

describe('T2 — every route, one path per minimal obstacle set', () => {
    // The ghost tree reaches X across R (4 steps) before the long way round (8): one path used to
    // charge door_red. The long way crosses nothing.
    const RING = ['P.R.X', '.###.', '.....'];

    it('a door the first-found route crosses is not charged when another route avoids it', () => {
        const w = picture(RING);
        expect(extractPathsAndObstacles(w).exits[0].paths).toEqual([{ path_id: 'p1', obstacles: [] }]);
        expect(compiled(w).exits[0].rule).toEqual({ rule: 'True_' });
        expect(engineCells(w, []).has('4,0')).toBe(true); // the witness: no key, the engine walks there
    });

    it('two routes behind two doors → Or of the two, the first-found route first', () => {
        const w = picture(['P.R.X', '.###.', '..G..']);
        expect(extractPathsAndObstacles(w).exits[0].paths).toEqual([
            { path_id: 'p1', obstacles: ['door_red'] },
            { path_id: 'p2', obstacles: ['door_green'] },
        ]);
        expect(compiled(w).exits[0].rule).toEqual(or(has('key_red'), has('key_green')));
        expect(engineDisagreements(w, ['key_green', 'key_red'])).toEqual([]);
    });

    it('a route that crosses a superset of another\'s doors is dropped', () => {
        const w = picture(['P.R.X', '.###.', '.RG..']);
        expect(extractPathsAndObstacles(w).exits[0].paths).toEqual([{ path_id: 'p1', obstacles: ['door_red'] }]);
        expect(engineDisagreements(w, ['key_green', 'key_red'])).toEqual([]);
    });

    it('encounter order is kept on every path (two doors in a row)', () => {
        const w = picture(['PGR.X', '.###.', '.R...']);
        expect(extractPathsAndObstacles(w).exits[0].paths).toEqual([{ path_id: 'p1', obstacles: ['door_red'] }]);
        const two = picture(['PGR.X', '.####', '.....']);
        expect(extractPathsAndObstacles(two).exits[0].paths).toEqual([{ path_id: 'p1', obstacles: ['door_green', 'door_red'] }]);
    });

    it('an exit tile is a dead end — no route passes through another exit', () => {
        const w = createWorld(5, 2, { entrance: { x: 0, y: 0 }, exits: [{ exit_id: 'a', x: 2, y: 0 }, { exit_id: 'b', x: 4, y: 0 }] });
        for (let x = 0; x < 5; x++) setTile(w, x, 1, TILE_WALL);
        const ex = extractPathsAndObstacles(w);
        expect(ex.exits.find((e) => e.id === 'b').paths).toEqual([]);
        expect(compiled(w).exits.find((e) => e.id === 'b').rule).toEqual({ rule: 'False_' });
    });
});

describe('T2 — the per-cell cap (a gate on every other tile)', () => {
    // A checkerboard of DISTINCT gates: every cell off the entrance's colour is a gate, so the
    // minimal sets multiply with distance — the shape of an Initialise-as-maze room with a logic
    // gate on each location tile (measured: ~3,700 sets per cell uncapped, never finishing).
    const board = (n) => {
        const w = createWorld(n, n, { entrance: { x: 0, y: 0 }, exits: [{ exit_id: 'exit', x: n - 1, y: n - 1 }] });
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x + y) % 2) setObstacle(w, x, y, `g_${x}_${y}`);
        return w;
    };
    /** Does a route crossing ONLY `ids` reach `target`? (positions BFS, other obstacles walled) */
    const reachesWith = (w, ids, target) => {
        const seen = new Set(['0,0']);
        const queue = [[0, 0]];
        while (queue.length) {
            const [x, y] = queue.shift();
            if (x === target.x && y === target.y) return true;
            if (getExitAt(w, x, y) !== null && !(x === 0 && y === 0)) continue;
            for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
                const k = `${x + dx},${y + dy}`;
                const id = w.obstacles.get(k);
                if (seen.has(k) || !isFloor(w, x + dx, y + dy) || (id && !ids.includes(id))) continue;
                seen.add(k);
                queue.push([x + dx, y + dy]);
            }
        }
        return false;
    };

    it('caps BY NAME, and every path it keeps is a real route — sound, never stricter than the ghost route', () => {
        const w = board(9);
        const t0 = performance.now();
        const ex = extractPathsAndObstacles(w);
        expect(performance.now() - t0).toBeLessThan(5000);
        expect(ex.route_sets_capped).toBe(ROUTE_SETS_PER_CELL);
        const exit = ex.exits[0];
        expect(exit.paths.length).toBeGreaterThan(1);
        for (const p of exit.paths) expect(reachesWith(w, p.obstacles, exit.position)).toBe(true);
        const ghost = exit.paths[0].obstacles; // p1 is the ghost route verbatim
        expect(exit.paths.every((p) => p.obstacles.length >= 1)).toBe(true);
        expect(exit.paths.some((p) => p.obstacles.every((id) => ghost.includes(id)))).toBe(true);
    });

    it('no cap on a room whose antichains stay small (the flag is absent, the output unchanged)', () => {
        expect(extractPathsAndObstacles(board(3)).route_sets_capped).toBeUndefined();
        expect(extractPathsAndObstacles(picture(['P.R.X', '.###.', '..G..'])).route_sets_capped).toBeUndefined();
    });
});

describe('T1 — a block world is priced by the engine', () => {
    it('the guard room: no held token is charged; the route-around key is free', () => {
        const w = guardRoom();
        const c = compiled(w);
        expect(ruleAt(c, 5, 3)).toEqual({ rule: 'True_' }); // flag_K0 — was And(key_red, sw_A0)
        expect(ruleAt(c, 7, 3)).toEqual({ rule: 'True_' }); // key_red@7,3 — was Has(key_red)
        expect([ruleAt(c, 5, 12), ruleAt(c, 8, 12), ruleAt(c, 0, 4)])
            .toEqual([{ rule: 'False_' }, { rule: 'False_' }, { rule: 'True_' }]);
        expect(c.exits[0].rule).toEqual(has('flag_K0'));
        const held = Object.values(w.buttonLib).map((b) => b.holds);
        for (const t of [...c.locations, ...c.exits]) for (const h of held) expect(namesIn(t.rule).has(h)).toBe(false);
    });

    it('a rock on the block\'s path is priced — on the lane AND on the button the player never enters (the L15 shape)', () => {
        for (const rock of ['lane', 'button']) {
            const c = compiled(guardRoom({ rock }));
            expect(ruleAt(c, 5, 3)).toEqual(WEAPON_OR_SWIM);
            expect(ruleAt(c, 7, 3)).toEqual(WEAPON_OR_SWIM);
        }
    });

    it('the engine agrees with every compiled rule at EVERY subset of the region\'s items', () => {
        const items = ['Progressive Swim', 'Progressive Sword', 'flag_K0', 'key_red'];
        for (const rock of [null, 'lane', 'button']) expect(engineDisagreements(guardRoom({ rock }), items)).toEqual([]);
    });

    it('refuses BY NAME what a set inventory cannot price', () => {
        const withRock = (rule) => {
            const w = guardRoom();
            w.obstacleLib = { ...w.obstacleLib, rock: { ...ROCK, clear_rule: rule } };
            setObstacle(w, 8, 4, 'rock');
            return w;
        };
        expect(() => extractPathsAndObstacles(withRock({ rule: 'Has', args: { item_name: 'Progressive Swim', count: 2 } })))
            .toThrow(/obstacle 'rock' needs 2× 'Progressive Swim'/);
        expect(() => extractPathsAndObstacles(withRock({ rule: 'HasAll', args: { items: ['a'] } })))
            .toThrow(/obstacle 'rock' clear_rule kind 'HasAll' is not one the block-world search can price/);
        const many = Array.from({ length: BLOCK_WORLD_MAX_ITEMS }, (_, i) => has(`item_${i}`));
        expect(() => extractPathsAndObstacles(withRock({ rule: 'And', children: many })))
            .toThrow(new RegExp(`item axis has ${BLOCK_WORLD_MAX_ITEMS + 2} items, over the cap ${BLOCK_WORLD_MAX_ITEMS}`));
    });
});

describe('T3 — an item-action world is priced by the engine (a strike-only rock)', () => {
    // The Q3 search's strike row (tileSpike/deriveTileLogic.test.js): `rock` only a strike opens
    // (clear_set []), `rock_swim` a strike OR Swim; the lower row is sealed off the location.
    const ROW = ['########', '#P..rLX#', '#..S...#', '########'];
    const world = (rockId) => {
        const w = itemActionPicture(ROW);
        w.obstacleLib.rock_swim = { kind: 'rock', clear_set: [['Progressive Swim']], struck_by: ['sword'] };
        setTile(w, 5, 2, TILE_WALL);
        setTile(w, 6, 2, TILE_WALL);
        if (rockId !== 'rock') setObstacle(w, 4, 1, rockId);
        return w;
    };
    const oracleAgrees = (w) => {
        const c = compiled(w);
        const derived = deriveRegionLogic(w, HELPERS);
        return derived.targets.filter((t) => {
            const mine = t.kind === 'exit' ? c.exits.find((e) => `exit:${e.id}` === t.id).rule : ruleAt(c, t.x, t.y);
            const oracle = ruleFromMinimalSets(t.minimal);
            return subsets([...new Set([...derived.items, ...namesIn(mine)])])
                .some((set) => evaluateRuleAgainstInventory(mine, new Set(set)) !== evaluateRuleAgainstInventory(oracle, new Set(set)));
        }).map((t) => t.id);
    };

    for (const [rockId, expected] of [['rock', has(SWORD)], ['rock_swim', or(has('Progressive Swim'), has(SWORD))]]) {
        it(`${rockId}: the location and the exit = ${JSON.stringify(expected)} (the path compiler priced a strike-only rock False_)`, () => {
            const w = world(rockId);
            const c = compiled(w);
            expect(ruleAt(c, 5, 1)).toEqual(expected);
            expect(c.exits[0].rule).toEqual(expected);
            expect(engineDisagreements(w, ['Progressive Swim', SWORD])).toEqual([]);
            expect(oracleAgrees(w)).toEqual([]);
        });
    }

    it('everything at once (rock + key door + block onto a button): the engine and the Q3 search agree', () => {
        const w = itemActionPicture(ACTION_GADGETS);
        expect(engineDisagreements(w, [SWORD, 'key_red'])).toEqual([]);
        expect(oracleAgrees(w)).toEqual([]);
    });
});

describe('the Q3 search agrees on generated levels (oracle)', () => {
    it('every target of every level: the compiled rule ≡ the derived rule (truth table)', () => {
        const disagreements = [];
        let levels = 0;
        for (const skeleton of ['empty', 'rooms']) for (const elements of ['none', 'guard', 'guard;len=2;turns=1']) {
            for (let seed = 1; seed <= 3; seed++) {
                const w = generateMazeLevel({
                    seed, palette: MAZE_PALETTE, width: 15, height: 15,
                    skeleton: parseSkeleton(skeleton, { simulator: true, substrate: 'the extraction test' }),
                    areas: parseAreaSpec('1'), elements: parseElementSpec(elements),
                }).record;
                levels += 1;
                const c = compiled(w);
                const derived = deriveRegionLogic(w, HELPERS);
                for (const t of derived.targets) {
                    const mine = t.kind === 'exit'
                        ? c.exits.find((e) => `exit:${e.id}` === t.id).rule
                        : ruleAt(c, t.x, t.y);
                    const items = [...new Set([...derived.items, ...namesIn(mine)])];
                    const oracle = ruleFromMinimalSets(t.minimal);
                    const differs = subsets(items).some((s) => evaluateRuleAgainstInventory(mine, new Set(s))
                        !== evaluateRuleAgainstInventory(oracle, new Set(s)));
                    if (differs) disagreements.push(`${skeleton}/${elements}/seed ${seed} ${t.id}`);
                }
            }
        }
        expect(levels).toBe(18);
        expect(disagreements).toEqual([]);
    });
});
