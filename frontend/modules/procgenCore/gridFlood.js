/**
 * procgenCore/gridFlood — **ONE 4-NEIGHBOUR FLOOD, FOR BOTH SUBSTRATES.**
 *
 * CONSTRUCTIVE-MODE arc, slice 6 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.6 item 2). The connectivity pre-check is a MODEL-side legality
 * rule in each binding's `refusalAt`, and the two bindings disagree about
 * everything except the question: *is there still a walkable path from the
 * start to the goal once this candidate's terrain writes are painted?* Seedling
 * asks it of four TERRAIN names on a bordered 10x10 room; the maze asks it of an
 * `Int8Array` of `TILE_FLOOR`/`TILE_WALL` on a ring-less grid.
 *
 * ⛔ SO THE FLOOD IS ONE FUNCTION AND THE PREDICATE IS THE BINDING'S. ⚖ Kickoff
 * §5's one-of-everything law: two floods would agree until somebody fixed a
 * diagonal, a bounds check or an endpoint case in one of them, and the day they
 * disagreed one substrate would refuse a candidate the other kept while both
 * claimed to run "the connectivity pre-check".
 *
 * ── ⛔⛔ 4-NEIGHBOUR, AND THAT IS A CLAIM ABOUT BOTH GAMES ─────────────
 *
 * Neither substrate lets a mover cross a corner diagonally: the maze's `step`
 * takes `up/down/left/right` and Seedling's walk is a corridor planner over
 * orthogonal legs. An 8-neighbour flood would report a room CONNECTED that
 * neither engine can cross — a pre-check that under-refuses, which is the
 * failure direction that matters here (it would let a sealing candidate through
 * to the oracle, i.e. change nothing, rather than reject a good one).
 *
 * ── ⛓ WHAT THIS IS SOUND FOR, AND WHAT IT IS DELIBERATELY BLIND TO ────
 *
 * **FULL-TILE TERRAIN ONLY.** The caller's `isWalkable` sees the grid, and the
 * grid is what the flood knows:
 *
 *  · ⚠ ENTITIES ARE NOT TERRAIN and this cannot see them. A maze door, a
 *    Seedling pushable block, a lock — those are the ORACLE's business, and a
 *    flood that treated a door as a wall would refuse every door-key the maze
 *    happily keeps (measured: the maze keeps every `door-key` on a corridor,
 *    §12.10).
 *  · ⚠ AND IT IS A TILE FLOOD, so trap 136's law binds it: *a tile flood
 *    UNDER-approximates a player smaller than a tile*, and trap 139's: *the
 *    grid rounds a sub-tile obstacle*. Both are about things narrower than a
 *    cell; a terrain WRITE fills its cell exactly, so neither applies to what
 *    this is asked. A caller who ever hands it a sub-tile obstacle is outside
 *    the envelope and the docblock of the rule that calls it must say so.
 *
 * ⇒ the pre-check built on this is a NECESSARY condition, never a sufficient
 * one: `connected` false ⇒ certainly unsolvable ⇒ refuse; `connected` true ⇒
 * nothing is claimed, and the oracle still decides. That asymmetry is what makes
 * it safe to run BEFORE a solve.
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: both lab pages load this in a browser.
 */

export class GridFloodError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GridFloodError';
    }
}

const fail = (message) => { throw new GridFloodError(message); };

const assertCell = (p, what, width, height) => {
    if (!p || !Number.isInteger(p.x) || !Number.isInteger(p.y)) {
        fail(`gridFlood: ${what} must be \`{x, y}\` with integer cells, got `
            + `${JSON.stringify(p)}. ⛔ It is a CELL, not a pixel and not a \`{tx, ty}\` — the `
            + 'BINDING converts at its own boundary, because a grid is the one vocabulary the '
            + 'two substrates already share.');
    }
    if (!(p.x >= 0 && p.y >= 0 && p.x < width && p.y < height)) {
        fail(`gridFlood: ${what} is (${p.x},${p.y}), which is off the ${width}x${height} grid. `
            + '⛔ An off-grid endpoint is a CALLER defect and not a connectivity fact, so it '
            + 'refuses by name rather than answering "not connected" — a flood that returned '
            + 'false here would report a coordinate bug as a sealed room.');
    }
};

/**
 * ⛓ IS THERE A 4-NEIGHBOUR WALKABLE PATH FROM `from` TO `to`?
 *
 * ⚠ **A NON-WALKABLE ENDPOINT ANSWERS `false`, AND THAT IS THE ANSWER RATHER
 * THAN A SWALLOWED ERROR.** "Is there a walkable path to a cell nothing can
 * stand on?" has one honest answer, and a caller whose candidate paints the goal
 * wants a REFUSAL, not a throw. (Neither binding can reach that case today —
 * both refuse a footprint cell on the start or the goal before this runs — but
 * the function is written for the question, not for its current callers.)
 *
 * ⛔ BREADTH-FIRST WITH AN EXPLICIT QUEUE, NOT RECURSION: a 121-cell grid is
 * nothing, but the same function is what a chambers-sized room (slice 7) will
 * call, and a recursive flood's bound is the JS stack — a bound nobody chose.
 *
 * @param {number} width
 * @param {number} height
 * @param {(x:number, y:number) => boolean} isWalkable the BINDING's own
 *   predicate over the CANDIDATE grid (its writes already applied). ⛔ It is
 *   called at most once per cell.
 * @param {{x:number, y:number}} from
 * @param {{x:number, y:number}} to
 * @returns {boolean}
 */
/**
 * ⛓⛓⛓ THE REACHABLE **SET** FROM ONE CELL — PROCGEN ELEMENTS arc 1, slice 2.
 *
 * `connected` answers a yes/no about a PAIR. The area binding asks three
 * questions that a pair predicate cannot answer, and all three are the same
 * flood:
 *
 *  1. **the area partition** — the maximal blob of "wide" cells a chamber is;
 *  2. **the corridor components** — the maximal blob of non-area floor cells an
 *     EDGE is (the areas it touches are what makes them adjacent);
 *  3. **the level-n verification** (⚖ arc kickoff §3.2) — with every door above
 *     level n treated as WALL, the set the entrance reaches must be EXACTLY the
 *     areas of level ≤ n plus their corridors. That is a SET EQUALITY, and a
 *     pair predicate can only ever sample it.
 *
 * ⛔ SO IT LIVES HERE RATHER THAN IN THE BINDING. ⚖ Arc ruling 5 / the
 * one-of-everything law: a second BFS in `procgenMaze.js` would be a second
 * spelling of reachability, and the day one of them grew a diagonal or a bounds
 * fix the partition and the pre-check would disagree while both claimed to be
 * "the flood". `connected` is NOT re-implemented on top of this (it can stop
 * early at the target and this one cannot), but they share the traversal shape
 * and this file's test drives the two against each other.
 *
 * ⚠ THE START CELL IS INCLUDED WHEN IT IS WALKABLE, AND THE SET IS EMPTY WHEN IT
 * IS NOT. "Which cells can I reach from a cell I cannot stand on?" has one
 * honest answer, and it is not a throw (`connected`'s own rule for a
 * non-walkable endpoint, carried whole).
 *
 * @param {number} width
 * @param {number} height
 * @param {(x:number, y:number) => boolean} isWalkable the CALLER's predicate.
 *   ⛔ Called at most once per cell.
 * @param {{x:number, y:number}} from
 * @returns {Set<string>} `"x,y"` keys — the spelling both substrates' overlays
 *   already use, so a caller can test membership against a `Map` key without a
 *   second conversion.
 */
export function reachableFrom(width, height, isWalkable, from) {
    for (const [n, v] of [['width', width], ['height', height]]) {
        if (!Number.isInteger(v) || v <= 0) {
            fail(`gridFlood: ${n} must be a positive integer, got ${JSON.stringify(v)}.`);
        }
    }
    if (typeof isWalkable !== 'function') {
        fail('gridFlood: `isWalkable(x, y)` must be a function — the PREDICATE is the '
            + 'caller\'s and the flood is shared.');
    }
    assertCell(from, '`from`', width, height);
    const out = new Set();
    if (!isWalkable(from.x, from.y)) return out;
    const seen = new Uint8Array(width * height);
    const queue = [from.x + from.y * width];
    seen[queue[0]] = 1;
    out.add(`${from.x},${from.y}`);
    for (let head = 0; head < queue.length; head += 1) {
        const i = queue[head];
        const x = i % width;
        const y = (i - x) / width;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const ni = nx + ny * width;
            if (seen[ni]) continue;
            seen[ni] = 1;
            if (!isWalkable(nx, ny)) continue;
            out.add(`${nx},${ny}`);
            queue.push(ni);
        }
    }
    return out;
}

export function connected(width, height, isWalkable, from, to) {
    for (const [n, v] of [['width', width], ['height', height]]) {
        if (!Number.isInteger(v) || v <= 0) {
            fail(`gridFlood: ${n} must be a positive integer, got ${JSON.stringify(v)}.`);
        }
    }
    if (typeof isWalkable !== 'function') {
        fail('gridFlood: `isWalkable(x, y)` must be a function — the PREDICATE is the '
            + 'binding\'s and the flood is shared. A default ("floor is walkable") would be '
            + 'one substrate\'s vocabulary imported into the other.');
    }
    assertCell(from, '`from`', width, height);
    assertCell(to, '`to`', width, height);
    if (!isWalkable(from.x, from.y) || !isWalkable(to.x, to.y)) return false;
    if (from.x === to.x && from.y === to.y) return true;

    const seen = new Uint8Array(width * height);
    const queue = [from.x + from.y * width];
    seen[queue[0]] = 1;
    for (let head = 0; head < queue.length; head += 1) {
        const i = queue[head];
        const x = i % width;
        const y = (i - x) / width;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const ni = nx + ny * width;
            if (seen[ni]) continue;
            /**
             * ⛓ THE ARRIVAL TEST COMES **BEFORE** THE PREDICATE CALL, and that
             * ordering is what makes "at most one call per cell" true rather
             * than nearly true: `to`'s walkability was settled by the endpoint
             * check above, so asking again here would be the one cell the flood
             * probed twice. (Found by this file's own test, which asserted the
             * property the docblock claimed.)
             */
            if (nx === to.x && ny === to.y) return true;
            if (!isWalkable(nx, ny)) { seen[ni] = 1; continue; }
            seen[ni] = 1;
            queue.push(ni);
        }
    }
    return false;
}
/**
 * ⛓⛓⛓ **ONE SHORTEST PATH, NOT JUST ITS EXISTENCE** — PROCGEN ELEMENTS arc 3,
 * slice 1 (kickoff §3.1).
 *
 * `connected` answers *is there a way?* and `reachableFrom` answers *where can
 * I get to?*. The SITE vocabulary asks a third question neither can answer:
 * *which cells are ON the way?* — the MAIN PATH is what a bend, a branch stub
 * and (arc 3 slice 2) a door's cut are all defined against.
 *
 * ⛔ SO IT LIVES HERE, WITH THE OTHER TWO. ⚖ The one-of-everything law: a
 * private BFS in a binding would be a third spelling of 4-connectivity, and the
 * day one of them grew a diagonal or a bounds fix the main path and the
 * connectivity pre-check would disagree while both claimed to be "the flood".
 * The traversal shape below is `connected`'s, with a parent array added.
 *
 * ── ⚠ "ONE SHORTEST PATH" IS A CHOICE, AND IT IS A CANONICAL ONE ──────
 *
 * A grid usually has many shortest paths. This returns the one BFS finds under
 * `connected`'s own neighbour order (N, S, W, E) — deterministic for a given
 * grid, which is all the site vocabulary needs, and it is NOT a claim that the
 * cells returned are the only cells at that distance. ⛔ A caller who needs
 * "every cell on some shortest path" is asking a different question and must
 * say so rather than reading this list as if it answered it.
 *
 * ⚠ AND THE LENGTH IS WHAT SLICE 2's NO-SHORTCUT RULE COMPARES, so the path is
 * returned INCLUSIVE of both endpoints: `path.length - 1` is the step count.
 *
 * @param {number} width
 * @param {number} height
 * @param {(x:number, y:number) => boolean} isWalkable ⛔ called at most once
 *   per cell, `connected`'s own property.
 * @param {{x:number, y:number}} from
 * @param {{x:number, y:number}} to
 * @returns {Array<{x:number, y:number}>|null} the path from `from` to `to`
 *   inclusive, or `null` when there is none — ⛔ `null` and not `[]`, because
 *   an empty array is what a caller would get for "the path from a cell to
 *   itself" if this ever grew that case, and the two must not read alike.
 */
export function shortestPath(width, height, isWalkable, from, to) {
    for (const [n, v] of [['width', width], ['height', height]]) {
        if (!Number.isInteger(v) || v <= 0) {
            fail(`gridFlood: ${n} must be a positive integer, got ${JSON.stringify(v)}.`);
        }
    }
    if (typeof isWalkable !== 'function') {
        fail('gridFlood: `isWalkable(x, y)` must be a function — the PREDICATE is the '
            + 'caller\'s and the flood is shared.');
    }
    assertCell(from, '`from`', width, height);
    assertCell(to, '`to`', width, height);
    if (!isWalkable(from.x, from.y) || !isWalkable(to.x, to.y)) return null;
    const start = from.x + from.y * width;
    const target = to.x + to.y * width;
    if (start === target) return [Object.freeze({ x: from.x, y: from.y })];

    const seen = new Uint8Array(width * height);
    const prev = new Int32Array(width * height).fill(-1);
    const queue = [start];
    seen[start] = 1;
    let found = false;
    for (let head = 0; head < queue.length && !found; head += 1) {
        const i = queue[head];
        const x = i % width;
        const y = (i - x) / width;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const ni = nx + ny * width;
            if (seen[ni]) continue;
            // ⛓ `connected`'s ordering, carried whole: the arrival test comes
            // BEFORE the predicate call, so `to` — whose walkability the
            // endpoint check already settled — is never probed twice.
            if (ni === target) { prev[ni] = i; seen[ni] = 1; found = true; break; }
            if (!isWalkable(nx, ny)) { seen[ni] = 1; continue; }
            seen[ni] = 1;
            prev[ni] = i;
            queue.push(ni);
        }
    }
    if (!found) return null;
    const out = [];
    for (let i = target; i !== -1; i = prev[i]) {
        const x = i % width;
        out.push(Object.freeze({ x, y: (i - x) / width }));
    }
    return out.reverse();
}

/**
 * ⛓⛓⛓ **HOW FAR EVERY REACHABLE CELL IS** — the same 4-neighbour walk
 * `reachableFrom` makes, keeping the DISTANCE it already computed.
 *
 * PROCGEN ELEMENTS arc 5, slice 5. ⛔ A FOURTH member of this family and not a
 * fourth FLOOD: `reachableFrom`'s answer is exactly this Map's key set, and
 * `shortestPath`'s answer is one walk back along it. It exists because arc 5's
 * shortcut binding has to ask *"which free cell makes the shortest route
 * THROUGH it"* of every candidate cell at once, and asking `shortestPath` once
 * per cell is |cells| walks where one answers.
 *
 * ⚠ IT IS KEPT SEPARATE FROM `reachableFrom` RATHER THAN REPLACING ITS BODY.
 * That function's contract includes *"calls the predicate at most ONCE per
 * cell"*, which its own row drives; re-expressing it over this Map would make
 * every caller allocate a distance nobody asked for, on the hot path both
 * bindings' legality rules run.
 *
 * @returns {Map<string, number>} `"x,y" -> steps from `from``, including `from`
 *   itself at 0. A cell absent from the Map is unreachable.
 */
export function distancesFrom(width, height, isWalkable, from) {
    for (const [n, v] of [['width', width], ['height', height]]) {
        if (!Number.isInteger(v) || v <= 0) {
            fail(`gridFlood: ${n} must be a positive integer, got ${JSON.stringify(v)}.`);
        }
    }
    if (typeof isWalkable !== 'function') {
        fail('gridFlood: `isWalkable(x, y)` must be a function — the PREDICATE is the '
            + 'caller\'s and the flood is shared.');
    }
    assertCell(from, '`from`', width, height);
    const out = new Map();
    if (!isWalkable(from.x, from.y)) return out;
    const seen = new Uint8Array(width * height);
    const start = from.x + from.y * width;
    seen[start] = 1;
    out.set(`${from.x},${from.y}`, 0);
    let frontier = [start];
    let steps = 0;
    while (frontier.length > 0) {
        steps += 1;
        const next = [];
        for (const i of frontier) {
            const x = i % width;
            const y = (i - x) / width;
            for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                const ni = nx + ny * width;
                if (seen[ni]) continue;
                seen[ni] = 1;
                if (!isWalkable(nx, ny)) continue;
                out.set(`${nx},${ny}`, steps);
                next.push(ni);
            }
        }
        frontier = next;
    }
    return out;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE SHORTCUT LAW — PROCGEN ELEMENTS arc 5, slice 5 (D1)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ THE FOUR CLAUSES `shortcutLawRefusal` can refuse on, in the order it asks
 * them.
 *
 * ⛔⛔ **THIS IS NOT A REFUSAL-CENSUS KEY, AND THE DIFFERENCE MATTERS.** The law
 * returns TEXT and never a `reason:` name — it is a rule, not a binding — so
 * each CALLER files the answer under its own census name: the Seedling element
 * says `the-shortcut-is-a-cut` / `the-shortcut-does-not-shorten`
 * (`SHORTCUT_REFUSALS`), the Seedling composite says
 * `the-elements-shortcut-is-not-a-shortcut`, and the maze says
 * `no-cell-can-carry-a-shortcut`. Declaring these four as a census key would
 * put four names in the reference's refusal table that no source raises, which
 * is the failure `refusalCensus.test.js` exists to catch in the other
 * direction. ⇒ they are the CLAUSE vocabulary, exported so a caller's mapping
 * can be read against them.
 */
export const SHORTCUT_LAW_CLAUSES = Object.freeze([
    'seals-the-room', 'is-a-cut', 'does-not-shorten', 'opener-behind-the-door',
]);

/**
 * ⛓⛓⛓ **THE SHORTCUT LAW — THE DOOR LAW'S CLAUSE 1, INVERTED, AND IT IS
 * SPELLED BESIDE THE DOOR LAW RATHER THAN INSTEAD OF IT.**
 *
 * PROCGEN ELEMENTS arc 5, slice 5 (D1). Arc-3 §9's DOOR LAW says a door is a
 * CUT: *with the door cell(s) walled the GOAL is UNREACHABLE from the START.*
 * ⛔ **THAT LAW IS UNCHANGED AND STILL BINDS EVERY DOOR.** A SHORTCUT is the
 * other thing a lockable cell can be, and it needs its own rule because the
 * door law would refuse it by name (`… is NOT A CUT … the wall is DECORATION`)
 * — which is the RIGHT answer about a door and the WRONG one about a shortcut.
 *
 * Four clauses, and the middle two are the law:
 *
 *  0. **OPEN HALF** — with the shortcut's cell(s) WALKABLE the goal is
 *     reachable from the start. The door law's `askOpenHalf`, carried over
 *     verbatim: a shortcut whose own terrain seals the room is not a shortcut.
 *  1. **STILL CONNECTED** — with them WALLED the goal REMAINS reachable. This
 *     is the door law's clause 1 with the quantifier flipped, and it is what
 *     makes the level solvable WITHOUT the opener: *the long arc the level
 *     already provides.*
 *  2. **STRICTLY SHORTER** — the shortest start→goal path with the cell(s) open
 *     is STRICTLY SHORTER than with them walled. ⛔ Without this clause a
 *     "shortcut" that changes no route at all would pass, and the differential
 *     would grade the item INERT on a level that shipped a lock for it — the
 *     mechanism would exist and the grade would say nothing reached it.
 *  3. **START-SIDE** — with them walled, every opener cell is reachable from
 *     the start. ⛓ Carried over from the door law UNCHANGED, and it is not
 *     free here even though clause 1 keeps the room connected: the opener could
 *     sit inside a pocket whose ONLY mouth is the shortcut cell itself, and
 *     then the thing that opens the shortcut is behind the shortcut.
 *
 * ⛔⛔ **CLAUSE 2 IS WHY THIS TAKES `shortestPath` AND THE DOOR LAW DOES NOT.**
 * A cut law only ever needs *is there a way*; a shortcut law needs *how long is
 * the way*, twice. That is two full BFS walks per candidate against the door
 * law's one early-exit `connected`, and it is the price the fifth grade costs.
 * Named rather than hidden: an element that asks this of every main-path cell
 * pays 2·|path| walks, which is why `buildShortcut` asks the CHEAP clauses (1
 * before 2) first and lets most candidates die on connectivity.
 *
 * ⛓ **AND THE COMPARISON IS ON STEPS, NOT ON CELLS.** `shortestPath` returns
 * the path inclusive of both endpoints, so `path.length - 1` is the step count
 * — the same reading slice 2's NO-SHORTCUT carve clause makes, which is the
 * rule this one is the deliberate inverse of. ⛔ Two rules that compare path
 * lengths in different units would disagree the day a one-cell room appeared.
 *
 * ⚠ **WHAT THIS IS BLIND TO, AND IT IS `gridFlood`'s STANDING BLINDNESS**: it
 * is a TILE flood over the caller's `isWalkable`, so entities are not terrain
 * (the file docblock). The claim it makes is about the ROOM's geometry — *with
 * this cell solid the walk is longer* — and never about what a solver does with
 * the lock standing in it. The DIFFERENTIAL is what says that, and the two are
 * different measurements on purpose.
 *
 * @param {object} o
 * @param {number} o.width
 * @param {number} o.height
 * @param {(walledKeys: Set<string>|null) => ((x:number, y:number) => boolean)}
 *   o.walkableFor the caller's own painted-terrain predicate with a key set
 *   forced solid — ⛔ the SAME argument shape `doorLawRefusal` takes, so the
 *   two laws are asked in one vocabulary and a caller cannot hand one of them a
 *   picture of the room the other never saw.
 * @param {{x:number, y:number}} o.start
 * @param {{x:number, y:number}} o.goal
 * @param {Set<string>} o.doorKeys the shortcut's own cell(s), as `"x,y"`.
 * @param {string[]} o.clearerKeys the opener's cell(s), as `"x,y"`.
 * @param {string} o.name what the refusal calls the caller.
 * @param {object|null} [o.lengths] ⛓ an OPTIONAL out-parameter, filled with
 *   `{open, walled}` step counts when the law ACCEPTS — the two numbers it
 *   already computed, so a caller that wants to record what the shortcut saves
 *   does not walk the grid a third time. ⛔ A sink, never a second return
 *   value: every caller reads the TEXT and must keep reading exactly that.
 * @returns {string|null} the refusal TEXT, or `null` when the law accepts.
 */
export function shortcutLawRefusal({
    width, height, walkableFor, start, goal, doorKeys, clearerKeys = [], name,
    lengths = null,
}) {
    const doorList = [...doorKeys].map((k) => `(${k})`).join(' ');
    const open = shortestPath(width, height, walkableFor(null), start, goal);
    if (open === null) {
        return `${name} declares a shortcut at ${doorList}, and its own TERRAIN SEALS the `
            + `room: with the shortcut cell(s) WALKABLE the GOAL (${goal.x},${goal.y}) is `
            + `already unreachable from the START (${start.x},${start.y}). ⛔ A shortcut `
            + 'whose open state is a sealed room is not a shortcut — this is the door law\'s '
            + 'own open half, and a shortcut pays for it exactly as an element door does.';
    }
    const walled = walkableFor(doorKeys);
    const round = shortestPath(width, height, walled, start, goal);
    if (round === null) {
        return `${name} declares a shortcut at ${doorList}, and it IS A CUT: with those `
            + `cell(s) walled the GOAL (${goal.x},${goal.y}) is UNREACHABLE from the START `
            + `(${start.x},${start.y}), so the level has no long arc and the lock standing `
            + 'there is a REQUIREMENT rather than a saving. ⛔ That is a DOOR, and the door '
            + 'law (`doorLawRefusal`) is the rule that adjudicates one — a shortcut whose '
            + 'without-arm cannot solve grades STRONG, never SHORTENS, and a level that '
            + 'shipped it under this name would be mis-described by its own payload.';
    }
    if (round.length - 1 <= open.length - 1) {
        return `${name} declares a shortcut at ${doorList}, and it DOES NOT SHORTEN: the `
            + `shortest way from the START (${start.x},${start.y}) to the GOAL `
            + `(${goal.x},${goal.y}) is ${open.length - 1} step(s) with those cell(s) open `
            + `and ${round.length - 1} with them walled. ⛔ A lock that changes no route is `
            + 'DECORATION with a key in front of it: the differential would grade the item '
            + 'INERT, and INERT on a level built to carry a shortcut is the mechanism '
            + 'reporting that nothing reached it. ⚖ The fifth grade is *fewer ticks WITH the '
            + 'item*, so the geometry has to be strictly shorter before the solver is asked.';
    }
    const reach = reachableFrom(width, height, walled, start);
    for (const key of clearerKeys) {
        if (!reach.has(key)) {
            return `${name} declares a shortcut at ${doorList}, and its OPENER cell (${key}) `
                + `is unreachable from the START (${start.x},${start.y}) once those cell(s) `
                + 'are walled — the thing that OPENS the shortcut is BEHIND the shortcut. ⛓ '
                + 'The room stays connected (clause 1 passed), so this is not the door law\'s '
                + 'sealed-pocket case: it is an opener in a pocket whose only mouth is the '
                + 'shortcut itself, and the player would have to take the short way to earn '
                + 'the right to take the short way.';
        }
    }
    if (lengths) {
        lengths.open = open.length - 1;
        lengths.walled = round.length - 1;
    }
    return null;
}
