/**
 * procgenCore/elements/reversePullBlock — THE FIRST ELEMENT: a single block
 * that must be pushed onto its button, the button HOLDS a door, and the door is
 * the only way out. ⚖ design rulings 2 and 4, §4.2.2; arc-2 kickoff §3.2.1.
 *
 * ── WHY IT IS BUILT BACKWARDS ─────────────────────────────────────────
 *
 * ⚖ the user's own words (design ruling 2): *"generate the block, the switch it
 * needs to be pushed onto, and the path that it needs to be pushed along all in
 * one step, along with the extra space that the player needs to get behind the
 * block when changing directions. We would need to construct that first, and
 * then build the rest of the level around it."*
 *
 * So: put the block ON the button and PULL it backwards. A pull in direction
 * `r` moves the block from `p` to `p+r` and the player from `p+r` to `p+2r`
 * (both move by `r`; the block ends where the player was). Reverse the whole
 * sequence and it is a legal PUSH sequence — the level is **solvable by
 * construction**, with no solver in the loop. The BFS certifies it anyway
 * (`mazeRoom/reversePullBlock.certify.test.js`), because "solvable by
 * construction" is an argument and the oracle is a measurement.
 *
 * ── ⛓⛓⛓ THE THREE THINGS §3.2.1 DID NOT SAY, WHICH THE GEOMETRY FORCED
 *
 * 1. **THE CORNER CELL.** §3.2.1 carves "the block's cell and the stance cell".
 *    That is not enough at a TURN. After the push that ends step `i` the player
 *    stands at `p_i + r_i` with the block at `p_i`; the next push needs them at
 *    `p_i + r_{i+1}`, and the block is standing between the two. The cell that
 *    joins them is the diagonal `p_i + r_i + r_{i+1}` — TWO orthogonal moves
 *    around the block. Without it a bent gadget is unsolvable, and the BFS
 *    finds that out rather than being told. Carved for every turn.
 *
 * 2. **THE BYPASS CELL.** The block ends ON the button, so the button cell is
 *    OCCUPIED for the rest of the level — and the exit corridor leaves the
 *    button. A player who has just completed the last push stands at `p_1` and
 *    can only reach the corridor THROUGH the block. One cell fixes it: the
 *    corner `button + e + r_1`, which turns `p_1 → corridor` into two moves
 *    around the button. ⇒ the first pull direction `r_1` is required to be
 *    PERPENDICULAR to the exit direction `e`; with `r_1 = -e` the bypass cell
 *    IS the button and no such cell exists.
 *
 * 3. **THE DOOR MUST BE THE CUT, AND THAT IS FLOODED, NOT ASSUMED.** A walk
 *    that happens to run alongside the corridor beyond the door would hand the
 *    player the exit without the block. Every candidate is checked with
 *    `gridFlood.connected` twice — entry→exit reachable, and entry→exit NOT
 *    reachable with the door treated as wall. The second flood is the gadget's
 *    whole point stated as a property (⚖ design ruling 17, "a door is a CUT").
 *
 * ⛓ AND ONE LAW INHERITED FROM SLICE 1 (§8.5, §3.1-AS-BUILT, trap 302): the
 * PLAYER presses the button too, and clearance reads the stance BEFORE the
 * move — so a door ORTHOGONALLY ADJACENT to its own button is opened by the
 * player walking onto the button, and the block is decorative. The door sits at
 * `button + 2e`, `DOOR_GAP` cells away, and `assertPlacement` refuses anything
 * closer.
 *
 * ── ⛔⛔ THE DECLARED DRAW ORDER ──────────────────────────────────────
 *
 *   1. `len`      ⎫ the parameters, in schema order, by `defineElement`'s
 *   2. `turns`    ⎭ (= `defineTemplate`'s) machinery. An override spends none.
 *   then, per ATTEMPT (the geometry, from the SAME stream, at `construct`):
 *   3. `e`        the exit direction        — `pick(PORT_DIRS)`
 *   4. `button`   the button cell           — `pick(candidates)`, row-major
 *   5. `r_1`      the first pull direction  — `pick(PERP[e])`
 *   6. the TURN POSITIONS — `shuffle([2..len])`, `len-2` draws, spent whatever
 *      `turns` is, so the draw count is a function of `len` alone
 *   7. one `pick(PERP[r_{i-1}])` per turn, in increasing `i`
 *
 * ⚠ **AN OVERRIDE OF BOTH PARAMETERS STILL LEAVES THE WALK DRAWING.** `len` and
 * `turns` are the DECLARED domain; the walk is seeded detail beneath it. Two
 * runs of the same (len, turns) on different streams are different gadgets, and
 * that is the point — the sweep is over the parameters, the variety is under
 * them. ⇒ a record of this element is `{params, seed}` (elements.js says so).
 *
 * ── REFUSALS, BY NAME ─────────────────────────────────────────────────
 *   TURNS_EXCEED_LEN  `turns > len - 1` — a walk of `len` steps has `len-1`
 *                     places to change direction. Deterministic, spends NO draw.
 *   SITE_TOO_SMALL    the rectangle cannot hold the exit corridor and one pull.
 *                     Deterministic, spends NO draw.
 *   WALK_NOT_FOUND    MAX_WALK_ATTEMPTS independent draws all failed a
 *                     constraint. This is the honest one: the site is big
 *                     enough in principle and the rng did not find a fit.
 *
 * ⛔ IMPORTS NOTHING SUBSTRATE-SIDE. `gridTiles.js` is the ONE grid vocabulary;
 * everything else is `procgenCore/`. Asserted in `bindingContract.test.js`.
 */

import { TILE_FLOOR, TILE_WALL } from '../../shared/procgen/mazeAlgorithms/gridTiles.js';
import { DIR_DELTA, PORT_DIRS, defineElement } from '../elements.js';
import { connected } from '../gridFlood.js';

/** The ids this element NAMES. ⚠ It does not invent library entries — the
 *  binding realises `sw_A` as a `buttonLib` `holds` and a `door_A` clear_set
 *  (slice 1 §8.12.5). v1 uses one fixed suffix; per-instance ids are slice 3's,
 *  because it is the binding that knows how many gadgets a level has. */
export const BUTTON_ID = 'button_A';
export const DOOR_ID = 'door_A';
export const HOLD_ID = 'sw_A';

/** ⛓ trap 302 / §3.1-AS-BUILT: the player's own press opens an ADJACENT door. */
export const DOOR_GAP = 2;
/** button+e, the door at button+2e, and at least one cell beyond it. */
export const EXIT_RUN = 3;
/** Below this the corridor and one pull cannot both fit on any axis. */
export const MIN_SITE = 4;
/** ⛓ The pull axis costs `len + 1` block cells plus the last stance — the
 *  `+2` the SNUG FOOTPRINT below is built from, named rather than retyped. */
export const SITE_MARGIN_PULL = 2;
/** ⛔ NAMED, and the refusal says it. A retry loop with no bound is the shape
 *  ⚖ ruling 6 forbids everywhere else in this arc. */
export const MAX_WALK_ATTEMPTS = 40;

const OPPOSITE = Object.freeze({ N: 'S', S: 'N', E: 'W', W: 'E' });

/** The two orthogonals that are neither `d` nor its reverse, in PORT_DIRS
 *  order — ⛔ this IS a draw order, so it is derived from the one vocabulary
 *  and frozen rather than spelled out twice. */
const PERP = Object.freeze(Object.fromEntries(PORT_DIRS.map(
    (d) => [d, Object.freeze(PORT_DIRS.filter((o) => o !== d && o !== OPPOSITE[d]))],
)));

const key = (c) => `${c.x},${c.y}`;
const stepTo = (c, d) => ({ x: c.x + DIR_DELTA[d].dx, y: c.y + DIR_DELTA[d].dy });
const inSite = (site, c) => c.x >= site.x && c.x < site.x + site.w
    && c.y >= site.y && c.y < site.y + site.h;
const rowMajor = (a, b) => (a.y - b.y) || (a.x - b.x);

/** How many steps from `c` in `d` stay inside the site. */
function runToEdge(c, d, site) {
    let k = 0;
    let cur = c;
    for (;;) {
        const next = stepTo(cur, d);
        if (!inSite(site, next)) return k;
        cur = next;
        k += 1;
    }
}

/**
 * ONE candidate walk, drawn and validated. Returns the walk record or `null`
 * (the caller redraws). ⛔ Every `return null` is a constraint the geometry
 * failed, and each is commented — a silent retry loop is a loop nobody can
 * diagnose when the yield drops.
 */
function drawWalk(values, site, rng) {
    const { len, turns } = values;

    // 3. the exit direction.
    const e = rng.pick(PORT_DIRS);

    // 4. the button cell — every cell with room for the whole exit corridor,
    //    row-major so the candidate list is a function of the site and nothing
    //    else.
    const candidates = [];
    for (let y = site.y; y < site.y + site.h; y += 1) {
        for (let x = site.x; x < site.x + site.w; x += 1) {
            if (runToEdge({ x, y }, e, site) >= EXIT_RUN) candidates.push({ x, y });
        }
    }
    if (candidates.length === 0) return null;   // this exit direction has no room
    const button = rng.pick(candidates);

    // 5. the first pull direction — PERPENDICULAR to `e`, for the bypass cell
    //    (docblock 2).
    const r1 = rng.pick(PERP[e]);

    // 6. + 7. where the direction changes, and to what.
    const positions = [];
    for (let i = 2; i <= len; i += 1) positions.push(i);
    const turnAt = new Set(rng.shuffle(positions).slice(0, turns));
    const dirs = [null, r1];
    for (let i = 2; i <= len; i += 1) {
        dirs[i] = turnAt.has(i) ? rng.pick(PERP[dirs[i - 1]]) : dirs[i - 1];
    }

    // ── the geometry the directions imply ────────────────────────────
    const path = [button];
    for (let i = 1; i <= len; i += 1) path[i] = stepTo(path[i - 1], dirs[i]);
    const stances = [null];
    for (let i = 1; i <= len; i += 1) stances[i] = stepTo(path[i], dirs[i]);
    const corners = [];
    for (let i = 1; i < len; i += 1) {
        if (dirs[i + 1] !== dirs[i]) corners.push(stepTo(stances[i], dirs[i + 1]));
    }

    const pathKeys = new Set();
    for (const c of path) {
        if (!inSite(site, c)) return null;               // the lane left the site
        if (pathKeys.has(key(c))) return null;           // the block crossed its own path
        pathKeys.add(key(c));
    }
    for (let i = 1; i <= len; i += 1) if (!inSite(site, stances[i])) return null;
    for (const c of corners) if (!inSite(site, c)) return null;

    // ── the exit corridor: button+e … the site edge, door at button+2e ──
    const runE = runToEdge(button, e, site);
    const exitCells = [];
    let cur = button;
    for (let k = 1; k <= runE; k += 1) { cur = stepTo(cur, e); exitCells.push(cur); }
    const door = exitCells[DOOR_GAP - 1];
    const exitPort = exitCells[exitCells.length - 1];
    const exitKeys = new Set(exitCells.map(key));

    // ── the bypass cell (docblock 2) ─────────────────────────────────
    const bypass = stepTo(exitCells[0], r1);   // = path[1] + e, the corner round the button
    if (!inSite(site, bypass)) return null;              // no room to walk round the block

    const walkKeys = new Set();
    for (const c of [...path, ...stances.slice(1), ...corners]) walkKeys.add(key(c));
    for (const k of walkKeys) {
        if (k !== key(button) && exitKeys.has(k)) return null;   // the lane ate the corridor
    }

    // ── the entry corridor: the last stance, straight out to the edge ──
    const entryDir = dirs[len];
    const entry0 = stances[len];
    if (key(entry0) === key(button) || key(entry0) === key(bypass)
        || exitKeys.has(key(entry0))) return null;       // the mouth landed on the machinery
    const entryCells = [entry0];
    let c2 = entry0;
    for (let k = 1; k <= runToEdge(entry0, entryDir, site); k += 1) {
        c2 = stepTo(c2, entryDir);
        entryCells.push(c2);
    }
    const entryPort = entryCells[entryCells.length - 1];
    for (let i = 1; i < entryCells.length; i += 1) {
        const k = key(entryCells[i]);
        if (walkKeys.has(k) || exitKeys.has(k) || k === key(bypass)) return null;
    }

    // ── the carved set ───────────────────────────────────────────────
    const carved = new Map();
    for (const c of [...path, ...stances.slice(1), ...corners, bypass,
        ...exitCells, ...entryCells]) carved.set(key(c), c);

    // ── ⛓ THE DOOR IS THE CUT — flooded, both ways (docblock 3) ──────
    const local = (c) => ({ x: c.x - site.x, y: c.y - site.y });
    const walkable = (x, y) => carved.has(`${x + site.x},${y + site.y}`);
    const doorless = (x, y) => walkable(x, y)
        && !(x + site.x === door.x && y + site.y === door.y);
    if (!connected(site.w, site.h, walkable, local(entryPort), local(exitPort))) return null;
    if (connected(site.w, site.h, doorless, local(entryPort), local(exitPort))) return null;

    return { len, turns, e, button, dirs: dirs.slice(1), path, stances: stances.slice(1),
        corners, bypass, door, exitCells, entryCells, entryPort, entryDir, exitPort, carved };
}

/** The walk record → the contract's placement. Absolute cells throughout. */
function placementOf(walk, site) {
    const tiles = [];
    for (let y = site.y; y < site.y + site.h; y += 1) {
        for (let x = site.x; x < site.x + site.w; x += 1) {
            tiles.push({ x, y, tile: walk.carved.has(`${x},${y}`) ? TILE_FLOOR : TILE_WALL });
        }
    }
    // ⛔ The ring OUTSIDE the site must stay wall, except where the two ports
    // face: those two cells are exactly where a connector attaches, and
    // demanding anything of them would be demanding the connector not come.
    // Everything else is what stops a carve opening a SECOND way in — which
    // would put the player past the door without the block.
    const mouths = new Set([
        key(stepTo(walk.entryPort, walk.entryDir)),
        key(stepTo(walk.exitPort, walk.e)),
    ]);
    const demand = [];
    for (let y = site.y - 1; y <= site.y + site.h; y += 1) {
        for (let x = site.x - 1; x <= site.x + site.w; x += 1) {
            if (inSite(site, { x, y })) continue;
            if (mouths.has(`${x},${y}`)) continue;
            demand.push({ x, y, must: 'wall' });
        }
    }
    const cells = [...walk.carved.values()].sort(rowMajor);
    return {
        tiles,
        entities: {
            // ⚠ The block's INITIAL cell is the FAR END of the reverse walk —
            // the pulls ran from the button outwards, so forward play starts
            // where they stopped.
            blocks: [{ x: walk.path[walk.len].x, y: walk.path[walk.len].y }],
            buttons: [{ x: walk.button.x, y: walk.button.y, id: BUTTON_ID }],
            obstacles: [{ x: walk.door.x, y: walk.door.y, id: DOOR_ID }],
            items: [],
        },
        ports: [
            { x: walk.entryPort.x, y: walk.entryPort.y, dir: walk.entryDir, role: 'entry' },
            { x: walk.exitPort.x, y: walk.exitPort.y, dir: walk.e, role: 'exit' },
        ],
        demand,
        area: { cells, kind: 'element' },
        symbols: { holds: [HOLD_ID], grants: [] },
        // ⚠ `pushes` is `len` BY CONSTRUCTION and is therefore not recorded
        // twice under a second name; what the plan actually spends is measured
        // by the certification test and belongs to the BINDING's cost record
        // (§3.3), not to the geometry.
        cost: { len: walk.len, turns: walk.turns, cells: cells.length },
    };
}

/**
 * The element's internals, exported so the walk itself is testable.
 *
 * ⚠ The PLACEMENT deliberately does not carry the walk: `tiles`, `ports`,
 * `demand`, `area`, `symbols` and `cost` are the contract's fields and an
 * element does not get to add a seventh (⚑ the shape is the design session's).
 * The properties that are about the WALK — exactly `turns` direction changes,
 * no reversal, the stance cells — are asked of this return value instead.
 *
 * @returns {{walk, placement}|{refused:{reason, detail}}}
 */
export function buildReversePull(values, site, rng) {
    const { len, turns } = values;
    if (turns > len - 1) {
        return { refused: { reason: 'TURNS_EXCEED_LEN',
            detail: `turns=${turns} on a walk of len=${len}: a ${len}-step walk has `
                + `${len - 1} places where the direction can change.` } };
    }
    if (site.w < MIN_SITE || site.h < MIN_SITE) {
        return { refused: { reason: 'SITE_TOO_SMALL',
            detail: `${site.w}x${site.h} is under ${MIN_SITE} on an axis; the exit corridor `
                + `alone needs ${EXIT_RUN} cells and one pull needs ${EXIT_RUN} more across.` } };
    }
    for (let attempt = 0; attempt < MAX_WALK_ATTEMPTS; attempt += 1) {
        const walk = drawWalk(values, site, rng);
        if (walk) return { walk, placement: placementOf(walk, site) };
    }
    return { refused: { reason: 'WALK_NOT_FOUND',
        detail: `${MAX_WALK_ATTEMPTS} independent draws of a len=${len} turns=${turns} walk `
            + `all failed a constraint on ${site.w}x${site.h}.` } };
}

/** The invariants only THIS element can state — asked on every construct. */
function assertReversePullPlacement(placement, { values, fail }) {
    const { blocks, buttons, obstacles, items } = placement.entities;
    if (blocks.length !== 1 || buttons.length !== 1 || obstacles.length !== 1
        || items.length !== 0) {
        fail(`reversePullBlock: v1 is ONE block, ONE button, ONE door and no item (the flag `
            + 'the guard protects is the BINDING\'s, §3.3) — got '
            + `${blocks.length}/${buttons.length}/${obstacles.length}/${items.length}.`);
    }
    if (buttons[0].id !== BUTTON_ID || obstacles[0].id !== DOOR_ID) {
        fail(`reversePullBlock: the button/door ids must be ${BUTTON_ID}/${DOOR_ID}.`);
    }
    if (blocks[0].x === buttons[0].x && blocks[0].y === buttons[0].y) {
        fail('reversePullBlock: the block STARTS on the button. The reverse walk pulled it '
            + `${values.len} steps off; a gadget whose block is already home is solved.`);
    }
    const gap = Math.abs(obstacles[0].x - buttons[0].x) + Math.abs(obstacles[0].y - buttons[0].y);
    if (gap < DOOR_GAP) {
        fail(`reversePullBlock: door_A is ${gap} cell(s) from button_A. ⛓ §3.1-AS-BUILT / `
            + 'trap 302: the PLAYER presses the button too and clearance reads the stance '
            + 'BEFORE the move, so a door orthogonally adjacent to its own button opens '
            + `for a player standing there and the block is decorative. The law is ${DOOR_GAP}.`);
    }
    if (obstacles[0].x !== buttons[0].x && obstacles[0].y !== buttons[0].y) {
        fail('reversePullBlock: door_A is not on an axis through button_A — the exit '
            + 'corridor is straight by construction.');
    }
    const roles = placement.ports.map((p) => p.role).sort();
    if (roles.length !== 2 || roles[0] !== 'entry' || roles[1] !== 'exit') {
        fail(`reversePullBlock: exactly one entry port and one exit port; got [${roles}].`);
    }
    if (placement.cost.cells !== placement.area.cells.length) {
        fail('reversePullBlock: cost.cells must be the size of the declared area — the '
            + 'carved cells ARE the area (a 1-wide lane has no all-floor 2×2 square, so '
            + 'the maze\'s blob rule would never find it).');
    }
}

/**
 * ⛓⛓⛓ **THE SNUG FOOTPRINT — READ OFF THE GEOMETRY ABOVE, NOT GUESSED**
 * (PROCGEN ELEMENTS arc 5, slice 2; `elements.assertFootprints` states the
 * contract this answers).
 *
 * At `turns = 0` the walk is a straight lane and the two axes are DIFFERENT
 * lengths, which is the whole finding:
 *
 *   along the PULL axis   `path[0..len]` is `len + 1` cells and the last
 *                         stance is one more ⇒ **`len + 2`**. The entry
 *                         corridor runs OUT from that stance, so it costs
 *                         nothing further inside the site.
 *   across it             the button plus `EXIT_RUN` cells of exit corridor
 *                         ⇒ **`EXIT_RUN + 1 = 4`**. The bypass cell sits one
 *                         step along each axis and is already inside both.
 *
 * ⛔ The BINDING used to size a `len + 2` SQUARE on both axes, which is the
 * pull-axis number applied to an axis that never needed it: at `len = 4` that
 * is 6x6 where 6x4 would do, and on a 10x10 room's 8x8 interior the difference
 * is 9 positions against 15-and-15. Arc-3 §18.2 C1 is the measurement that
 * asked for this.
 *
 * ⛔ **AT `len = 2` THE TWO ORIENTATIONS ARE THE SAME RECTANGLE** (`len + 2`
 * is already 4), and the contract refuses a list that names one rectangle
 * twice — so this returns ONE entry there, named `square` because that is what
 * it is.
 *
 * ⛔ **AND AT `turns > 0` IT ANSWERS `null`.** A bent walk's bounding box is a
 * function of WHICH steps turn, and that is drawn inside `construct` — there
 * is no rectangle to declare before the draw. The maze, which is where bent
 * gadgets live, never asks (it sizes its own `len + SITE_MARGIN` square), so
 * `null` costs nothing and a made-up number would have cost the truth.
 */
export function reversePullFootprint({ len, turns }) {
    if (turns !== 0) return null;
    const along = len + SITE_MARGIN_PULL;
    const across = EXIT_RUN + 1;
    if (along === across) return [{ w: along, h: across, orient: 'square' }];
    return [
        { w: along, h: across, orient: 'wide' },
        { w: across, h: along, orient: 'tall' },
    ];
}

export const REVERSE_PULL_BLOCK = defineElement({
    name: 'reverse-pull-block',
    family: 'guard',
    why: 'The first element (⚖ design rulings 2 and 4): a block pulled backwards off its '
        + 'button is a push puzzle that is solvable by construction, and the door it holds '
        + 'is what makes it a GUARD rather than a toy — the flag beyond it is the area '
        + 'graph\'s key.',
    params: [
        { key: 'len', domain: [2, 3, 4, 5, 6], default: 3,
            why: 'How many pulls, i.e. how many pushes the player owes. 2 is the shortest '
                + 'walk that can still turn; 6 is where the lane stops fitting a room the '
                + 'maze can search with a block in it (slice 1 §8.1 — ONE block per room).' },
        { key: 'turns', domain: [0, 1, 2, 3], default: 1,
            why: '0 is a straight lane — Seedling\'s `weigh` today (⚠ bent pushes there are '
                + 'the CHAIN, arc 4). Each turn costs a corner cell and is what "the extra '
                + 'space the player needs to get behind the block" buys. 3 is the most a '
                + 'len=4 walk can carry, which is where the domain stops being cheap.' },
    ],
    construct(values, site, rng) {
        const out = buildReversePull(values, site, rng);
        return out.refused ? out : out.placement;
    },
    footprint: reversePullFootprint,
    assertPlacement: assertReversePullPlacement,
});
