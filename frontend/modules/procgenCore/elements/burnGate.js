/**
 * procgenCore/elements/burnGate — **THE BURN GATE: a BURNABLE TREE on a
 * main-path cut, opened only by FIRE** (strategy switch r2, the design's D3;
 * ⚖ Robert 2026-11-01, "(a) Burn gate").
 *
 * The rock gate's search (`soloDoor.buildSoloDoor`'s cut law over
 * `roomDoor.doorCandidates`, the wall grown by `roomDoor.growWall`, ONE draw)
 * with one geometric difference the game forces: **the obstacle is 2x2.**
 *
 * ── ⛓⛓ WHY THE DOOR IS FOUR CELLS ─────────────────────────────────────
 *
 * `BurnableTree` extends `Tree`, whose ctor is `super(_x + 16, _y + 16)` with a
 * 32x32 hitbox centred on that point (`Scenery/Tree.as:20-26`;
 * `levelWorld.ENTITY_CLASSES.burnabletree` `dx/dy 16, w/h 32, originX/Y 16`).
 * So a tree written at OEL `(tx*16, ty*16)` is solid over tiles
 * `tx..tx+1 x ty..ty+1`. A one-cell door would be a tree standing over three
 * cells nobody asked about. ⇒ THE FOOTPRINT is
 *
 *     F = { C, C+d, C+p, C+d+p }
 *
 * where `C` is the path cell the door law cuts, `d = C - before` (away from the
 * opener, so the stance is never under the tree) and `p` is one of the two
 * perpendiculars (both are offered as candidates). The tree's anchor is F's
 * top-left cell.
 *
 *  · ⛔ ALL FOUR CELLS OF F MUST BE SKELETON FLOOR, and they are the
 *    `doorCells`. MEASURED, not assumed: the first cut let F overlap the grown
 *    wall, and the certification solve burned the tree and then REFUSED —
 *    *"burnabletree@16,80 reports burned and its cell (32,96) is STILL BLOCKED
 *    by solid … something else shares the cell"*. The solver's gone-check
 *    probes the tree's centre, a tile CORNER, so a wall under any quarter of
 *    the tree reads as the tree still standing. Vanilla's trees stand on four
 *    floor cells; so do these. ⛔ No solver edit: the element meets the game's
 *    own shape.
 *  · THE WALL is the row `growWall` grows through `C`, with F's own cells
 *    left out of it: the tree, not a wall, fills the gap, so the cut is the
 *    row with the tree in it.
 *  · ⛔ The entity entry stands on `C` (the contract wants every entity on
 *    floor) and carries `anchor`, the tree's OEL cell, which the binding
 *    writes. A burned tree leaves four floor cells open.
 *
 * ── ⛓ WHY FIRE, AND WHY THE BOOT FLAG IS `hasFire` ─────────────────────
 *
 * `BurnableTree.hit(t)` is `if (t == "Fire" && !burn)`, and only
 * `Player.fire()` passes `"Fire"` — a sword, spear or wand reaches the tree and
 * does nothing (`solverBot.resolveBurnStrategy`'s no-Fire refusal says so).
 * `hasFire` is already a SEAM boot flag (`tapeFormat.SEAM_BOOT_SPEC`
 * `items.hasFire` → `save.hasFire`) and already in biomes-1's `post-fire`
 * boot, and the solver's burn reads `run.progress('inventory').hasFire`, so
 * the element `needs: ['hasFire']` and nothing new is staged.
 *
 * ── THE RULES, EACH ONE A NAMED REFUSAL ───────────────────────────────
 *
 *  1. `C` is an interior main-path cell at least `DOOR_GOAL_MIN` from the
 *     goal — else `goal-too-close`.
 *  2. F lies in the room's interior, is all skeleton floor, and holds neither
 *     the start nor the goal — else `the-tree-does-not-fit`.
 *  3. The door law over F, the clearer `before` — else
 *     `wall-does-not-seal`.
 *  4. ONE DRAW: `rng.pick` over every (cell, side) that passed, in path order.
 */

import { LAW_CUT, defineElement } from '../elements.js';
import {
    DOOR_GOAL_MIN, cellKey, doorCandidates, growWall, inInterior, tilesFor,
} from './roomDoor.js';

/** The id the BINDING looks up (`procgenSeedlingElements`: a `burnabletree`). */
export const BURN_GATE_DOOR_ID = 'burngate_tree';

/** The obstacle's side, in tiles (`BurnableTree`'s 32 px hitbox). */
export const BURN_TREE_SPAN = 2;

/** ⛓ EVERY REFUSAL THIS FILE CAN PRODUCE, BY NAME — the census key. */
export const BURN_GATE_REFUSALS = Object.freeze([
    'no-cut-cell', 'goal-too-close', 'the-tree-does-not-fit', 'wall-does-not-seal',
]);

/** The deepest stage a run of candidates reached, in the order they RUN (trap 357). */
const STAGES = Object.freeze(['goal-too-close', 'the-tree-does-not-fit', 'wall-does-not-seal']);

/** F for a candidate and a perpendicular `p`, plus its anchor (top-left). */
export function treeFootprint(cand, p) {
    const d = { x: cand.cell.x - cand.before.x, y: cand.cell.y - cand.before.y };
    const c = cand.cell;
    const cells = [c, { x: c.x + d.x, y: c.y + d.y }, { x: c.x + p.x, y: c.y + p.y },
        { x: c.x + d.x + p.x, y: c.y + d.y + p.y }].map((q) => Object.freeze({ x: q.x, y: q.y }));
    const anchor = Object.freeze({
        x: Math.min(...cells.map((q) => q.x)), y: Math.min(...cells.map((q) => q.y)),
    });
    return Object.freeze({ cells: Object.freeze(cells), anchor });
}

/** The two perpendiculars to the approach, in a fixed order (+, then -). */
const sidesOf = (cand) => (cand.cell.x === cand.before.x
    ? [{ x: 1, y: 0 }, { x: -1, y: 0 }]
    : [{ x: 0, y: 1 }, { x: 0, y: -1 }]);

/**
 * The shared search, exported so the geometry is testable without a stream.
 *
 * @param {object} room the `elements.assertRoomProbe` probe
 * @returns {{candidates}|{refused:{reason, detail}}}
 */
export function buildBurnGate(room) {
    const seen = new Set();
    const ok = [];
    const isEndpoint = (q) => (q.x === room.start.x && q.y === room.start.y)
        || (q.x === room.goal.x && q.y === room.goal.y);
    const cands = doorCandidates(room);
    for (const cand of cands) {
        if (cand.goalDistance < DOOR_GOAL_MIN) { seen.add('goal-too-close'); continue; }
        const grown = growWall(room, cand.cell, cand.wallAxis);
        for (const p of sidesOf(cand)) {
            const fp = treeFootprint(cand, p);
            if (fp.cells.some((q) => !inInterior(room, q.x, q.y) || isEndpoint(q)
                || !room.floorAt(q.x, q.y))) {
                seen.add('the-tree-does-not-fit');
                continue;
            }
            /** The grown row with the tree's own cells left open: the tree, not a wall, stands there. */
            const under = new Set(fp.cells.map((q) => cellKey(q.x, q.y)));
            const wall = grown.filter((c) => !under.has(cellKey(c.x, c.y)));
            const tiles = tilesFor(wall);
            const doorCells = fp.cells;
            const why = room.doorLaw({ paint: tiles, doorCells, clearer: [cand.before] });
            if (why) { seen.add('wall-does-not-seal'); continue; }
            ok.push(Object.freeze({ cand, side: Object.freeze(p), fp, wall: Object.freeze(wall),
                tiles, doorCells: Object.freeze(doorCells) }));
        }
    }
    if (ok.length === 0) {
        const reason = STAGES.filter((s) => seen.has(s)).pop() ?? 'no-cut-cell';
        return { refused: { reason,
            detail: `no cell of the ${room.mainPath.length}-cell main path can carry a BURN GATE: `
                + `${cands.length} interior path cell(s) tried, the deepest stage any reached was `
                + `"${reason}". ⛓ A burnable tree is 2x2 tiles (\`Tree\`'s 32 px hitbox), so the `
                + 'door is the path cell, the cell beyond it and one side\'s two — all FLOOR inside the '
                + 'room, neither endpoint under it, and the four together a CUT.' } };
    }
    return { candidates: Object.freeze(ok) };
}

/** One chosen candidate → the contract's placement. Absolute cells throughout. */
function placementOf(pick, count) {
    const { cand, fp } = pick;
    return {
        tiles: pick.tiles,
        entities: {
            blocks: [],
            buttons: [],
            obstacles: [{ x: cand.cell.x, y: cand.cell.y, id: BURN_GATE_DOOR_ID,
                anchor: { x: fp.anchor.x, y: fp.anchor.y } }],
            items: [],
        },
        doorCells: pick.doorCells.map((c) => ({ x: c.x, y: c.y })),
        clearer: [{ x: cand.before.x, y: cand.before.y }],
        /** ⛔ EMPTY: no body, and the opener's cell is OWNED by the binding. */
        demand: Object.freeze([]),
        area: null,
        symbols: { holds: [], grants: [] },
        cost: { wall: pick.wall.length, candidates: count, goalDistance: cand.goalDistance },
    };
}

/** ONE tree obstacle on `C`, its anchor the top-left of the 2x2 that is exactly the door cells; the clearer next to `C`. */
export function assertBurnGatePlacement(placement, { fail }) {
    const { obstacles } = placement.entities;
    if (obstacles.length !== 1 || obstacles[0].id !== BURN_GATE_DOOR_ID) {
        fail(`burnGate: the door is exactly ONE obstacle with id ${BURN_GATE_DOOR_ID} — got `
            + `${JSON.stringify(obstacles.map((o) => o.id))}.`);
    }
    const [tree] = obstacles;
    const a = tree.anchor;
    const under = (q) => a && q.x >= a.x && q.x < a.x + BURN_TREE_SPAN
        && q.y >= a.y && q.y < a.y + BURN_TREE_SPAN;
    if (!a || !Number.isInteger(a.x) || !Number.isInteger(a.y) || !under(tree)) {
        fail(`burnGate: the tree's \`anchor\` ${JSON.stringify(a)} must be the top-left of a `
            + `${BURN_TREE_SPAN}x${BURN_TREE_SPAN} span that holds its entry cell (${tree.x},${tree.y}).`);
    }
    const keys = new Set(placement.doorCells.map((q) => `${q.x},${q.y}`));
    if (placement.doorCells.length !== BURN_TREE_SPAN ** 2 || keys.size !== BURN_TREE_SPAN ** 2
        || !keys.has(`${tree.x},${tree.y}`) || placement.doorCells.some((q) => !under(q))) {
        fail('burnGate: `doorCells` must be exactly the FOUR cells under the tree (its entry cell '
            + 'among them) — a wall under any quarter of the tree reads to the solver as the tree.');
    }
    for (const t of placement.tiles) {
        if (under(t)) fail(`burnGate: the element writes (${t.x},${t.y}), which is UNDER the tree.`);
    }
    if (placement.clearer.length !== 1) {
        fail('burnGate: `clearer` must be exactly ONE cell — where the player stands to burn the tree.');
    }
    const [c] = placement.clearer;
    if (Math.abs(c.x - tree.x) + Math.abs(c.y - tree.y) !== 1 || under(c)) {
        fail(`burnGate: the \`clearer\` (${c.x},${c.y}) must be 4-adjacent to the door cell `
            + `(${tree.x},${tree.y}) and NOT under the tree.`);
    }
    if ((placement.demand ?? []).length !== 0) {
        fail('burnGate: a one-obstacle GATE declares NO `demand` — it has no body.');
    }
}

export const BURN_GATE = defineElement({
    name: 'burn-gate',
    family: 'burngate',
    phase: 'on-connector',
    why: 'ONE burnable TREE (2x2 tiles) on a main-path CUT, its wall grown to seal the room, '
        + 'burned by FIRE from its start side — on Seedling a `burnabletree`, which only '
        + '`Player.fire()` hits (the solver\'s `burn`). No body, no pocket, no tag.',
    params: [],
    construct: (values, site, rng) => {
        const out = buildBurnGate(site.room);
        if (out.refused) return out;
        /** ⛓ THE ONE DRAW — every candidate already passed every rule. */
        return placementOf(rng.pick(out.candidates), out.candidates.length);
    },
    assertPlacement: assertBurnGatePlacement,
});
