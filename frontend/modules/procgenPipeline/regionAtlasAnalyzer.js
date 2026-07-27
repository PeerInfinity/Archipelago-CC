// Region-atlas analyzer — computes a region's sub-region split and the rules
// that cross between the pieces (CC/docs/plans/region-atlas-plan.md, Phase 5a,
// Deliverable 2; the algorithm is plan decision 1's).
//
// Plan decision 1 says the split is mechanical: partition a region's tiles into
// the components you can walk with NO items, and label the edges between
// components with what opens them. This module is that, in three parts:
//
//   1. components  4-connected flood over the freely-walkable cells. Everything
//                  else — a gate, a one-way drop, a hazard — is not a place, it
//                  is crossing MATERIAL, and never joins a component.
//   2. crossings   a directed search THROUGH that material from one component to
//                  another, accumulating the conditions the cells declare. Every
//                  Pareto-minimal condition set that gets you across is a way
//                  across, and the ways OR together — which is why this is a
//                  direct gate-vocabulary analysis and not a leave-one-out
//                  ability diff (Phase 5a, ruling 1: Seedling's magical lock
//                  opens with the Wand OR the Fire Wand, and a diff that removed
//                  either one at a time would call the crossing free).
//   3. merge       apply the split to the atlas region, reassigning exits and
//                  locations by geometry and preserving hand-authored internal
//                  exits byte-exact (ruling 2).
//
// GAME-AGNOSTIC. The grid comes from the game's own semantics module (Seedling's
// is flashPanel/seedlingSemantics.js) and is read through a small contract:
//
//   cell.kind        'open' | 'wall' | 'gated' | 'directional' | 'sink' | 'manual'
//   cell.conditions  conditions to OCCUPY the cell, ANDed
//   cell.faces[dir]  gate on a geometric face, paid crossing it either way;
//                    null blocks
//   cell.dirs[dir]   gate on MOVING that way while on the cell; null blocks
//   cell.manual[]    why a blocker has no derivable rule
//
// plus two helpers the caller supplies, because condition VALUES are the game's:
// `conditionKey` (equal conditions get equal keys) and `resolveCondition`
// (condition -> Rule Builder tree, or null when no item backs it).
//
// Deterministic: components are named for their own geometry and everything is
// emitted in sorted order, so re-running on unchanged input reproduces the
// document byte for byte (the CLI's `--check` gate).
//
// Headless-safe: no top-level await, no literal node: imports — this module is
// in the bundled browser graph (the marking tool's Analyze action runs it).

import {
    validateRegionAtlas,
    stampAtlasIdentity,
    derivedRulesSource,
    internalExitSource,
    DEFAULT_EXIT_SOURCE,
} from './regionAtlasValidator.js';

const DIRS = Object.freeze({ N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] });
const OPPOSITE = Object.freeze({ N: 'S', S: 'N', E: 'W', W: 'E' });
const DIR_NAMES = Object.freeze(['N', 'E', 'S', 'W']);

/**
 * How many distinct conditions one region's crossing material may carry before
 * the subset search is abandoned. Real Seedling rooms use one or two; the cap
 * exists so a pathological region degrades LOUDLY (the crossing becomes a
 * hand-authoring row) instead of hanging the panel.
 */
export const MAX_DISTINCT_CONDITIONS = 20;

/**
 * A component's id is its own geometry: the minimum (y, x) tile it contains, in
 * ATLAS coordinates. Two properties follow, and both are load-bearing:
 * re-analysing unchanged terrain reproduces the same ids (so `--check` is
 * exact), and the ids do not depend on iteration order, region order or how
 * many components there happen to be.
 *
 * `__` is the AP compound separator and is forbidden in a sub-region id, which
 * this shape cannot produce.
 */
export const componentId = (x, y) => `r${y}c${x}`;

// --- part 1: components ------------------------------------------------------

const isOpen = (cell) => cell?.kind === 'open';

/**
 * 4-connected flood over the freely-walkable cells.
 *
 * @returns {{ components, indexOf }} components sorted by their (y, x) anchor;
 *   `indexOf` is a Int32Array mapping cell index -> component index, or -1.
 */
export function findComponents(grid) {
    const { width, height, cells } = grid;
    const indexOf = new Int32Array(width * height).fill(-1);
    const found = [];

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const start = y * width + x;
            if (indexOf[start] !== -1 || !isOpen(cells[start])) continue;
            const tiles = [];
            const queue = [start];
            indexOf[start] = found.length;
            while (queue.length > 0) {
                const i = queue.pop();
                const cx = i % width;
                const cy = (i - cx) / width;
                tiles.push([cx, cy]);
                for (const dir of DIR_NAMES) {
                    const [dx, dy] = DIRS[dir];
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    const n = ny * width + nx;
                    if (indexOf[n] !== -1 || !isOpen(cells[n])) continue;
                    indexOf[n] = found.length;
                    queue.push(n);
                }
            }
            // Row-major flood order already puts the anchor first, but sorting
            // makes that a property of the output rather than of the traversal.
            tiles.sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
            found.push({ tiles });
        }
    }

    const ox = grid.origin?.x ?? 0;
    const oy = grid.origin?.y ?? 0;
    const components = found.map((c, i) => ({
        index: i,
        id: componentId(c.tiles[0][0] + ox, c.tiles[0][1] + oy),
        anchor: [c.tiles[0][0] + ox, c.tiles[0][1] + oy],
        tiles: c.tiles,
        size: c.tiles.length,
    }));
    return { components, indexOf };
}

// --- part 2: crossings -------------------------------------------------------

/**
 * The cost of stepping from cell `ui` to the adjacent cell `vi` in direction
 * `dir`, or null when that step is impossible.
 *
 * The face gate is read from BOTH sides — a face is shared, and either cell may
 * be the one that declares it. The direction gate is read from both cells too,
 * because a two-tile-tall waterfall gates the climb at every tile of it.
 */
function stepCost(grid, ui, vi, dir) {
    const u = grid.cells[ui];
    const v = grid.cells[vi];
    if (u.kind === 'wall' || v.kind === 'wall') return null;
    // A sink is enterable from anywhere and leavable from nowhere: falling in a
    // pit hands you to another level entirely.
    if (u.kind === 'sink') return null;

    const conditions = [];
    const gates = [
        u.faces?.[dir], v.faces?.[OPPOSITE[dir]],
        u.dirs?.[dir], v.dirs?.[dir],
    ];
    for (const gate of gates) {
        if (gate === null) return null;
        if (Array.isArray(gate)) conditions.push(...gate);
        else if (gate !== undefined) conditions.push(gate);
    }
    conditions.push(...(v.conditions ?? []));
    return {
        conditions,
        manual: u.kind === 'manual' || v.kind === 'manual',
        manualReasons: [...(u.kind === 'manual' ? u.manual ?? [] : []), ...(v.kind === 'manual' ? v.manual ?? [] : [])],
    };
}

const isSubset = (a, b) => (a & b) === a;

/**
 * Keep only the ways across that nothing cheaper subsumes: a condition set that
 * is a superset of another asks for strictly more than a route you already
 * have. Sorted by mask so the surviving order does not depend on scan order.
 */
function paretoMinimal(ways) {
    const byMask = new Map();
    for (const w of ways) if (!byMask.has(w.mask)) byMask.set(w.mask, w);
    const masks = [...byMask.keys()];
    return masks
        .filter((m) => !masks.some((other) => other !== m && isSubset(other, m)))
        .sort((a, b) => a - b)
        .map((m) => byMask.get(m));
}

/**
 * Search from every component, through the crossing material, to every other
 * component — collecting the minimal condition sets that get you there.
 *
 * The state is (cell, condition-set); a cell is worth revisiting only with a
 * condition set no earlier visit already dominated. That is what makes two
 * parallel crossings with different requirements come out as two ways across
 * rather than one conjunction of both.
 */
export function findCrossings(grid, componentsResult, options = {}) {
    const { conditionKey } = options;
    if (typeof conditionKey !== 'function') {
        throw new Error('findCrossings needs a conditionKey(condition) helper — condition identity is the game\'s, not the analyzer\'s');
    }
    const { width, height, cells } = grid;
    const { components, indexOf } = componentsResult;
    const ox = grid.origin?.x ?? 0;
    const oy = grid.origin?.y ?? 0;

    // Condition vocabulary of this region's crossing material, as a bit index
    // per distinct condition.
    const bitOf = new Map();
    const conditionOf = [];
    const bitFor = (condition) => {
        const k = conditionKey(condition);
        if (!bitOf.has(k)) {
            bitOf.set(k, bitOf.size);
            conditionOf.push(condition);
        }
        return bitOf.get(k);
    };

    const sinks = [];
    const results = new Map(); // "from>to" -> { from, to, ways: [] }
    const overflow = [];

    for (const source of components) {
        // best[cell] = list of masks reached; `manual` paths are tracked
        // separately because a manual crossing carries no rule at all.
        const best = new Map();
        const queue = [];
        const push = (cellIndex, mask, manual, reasons, tiles) => {
            const key = `${cellIndex}|${manual ? 1 : 0}`;
            const seen = best.get(key);
            if (seen) {
                if (seen.some((m) => isSubset(m, mask))) return;
                best.set(key, [...seen.filter((m) => !isSubset(mask, m)), mask]);
            } else {
                best.set(key, [mask]);
            }
            queue.push({ cellIndex, mask, manual, reasons, tiles });
        };

        const record = (targetIndex, state) => {
            const target = components[targetIndex];
            const k = `${source.id}>${target.id}`;
            if (!results.has(k)) results.set(k, { from: source.id, to: target.id, ways: [] });
            results.get(k).ways.push({
                mask: state.mask,
                manual: state.manual,
                reasons: [...new Set(state.reasons)],
                tiles: state.tiles.map(([x, y]) => [x + ox, y + oy]),
            });
        };

        // Seed: every step OUT of this component. Two adjacent walkable cells
        // are always in the SAME component (that is what the flood did), so a
        // seed step either enters crossing material or leaves the grid.
        for (const [tx, ty] of source.tiles) {
            const ui = ty * width + tx;
            for (const dir of DIR_NAMES) {
                const [dx, dy] = DIRS[dir];
                const nx = tx + dx;
                const ny = ty + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                const vi = ny * width + nx;
                if (indexOf[vi] === source.index) continue;
                const cost = stepCost(grid, ui, vi, dir);
                if (!cost) continue;
                let mask = 0;
                let overflowed = false;
                for (const c of cost.conditions) {
                    const bit = bitFor(c);
                    if (bit >= MAX_DISTINCT_CONDITIONS) { overflowed = true; break; }
                    mask |= 1 << bit;
                }
                if (overflowed) {
                    overflow.push([nx + ox, ny + oy]);
                    continue;
                }
                const state = {
                    cellIndex: vi, mask, manual: cost.manual, reasons: cost.manualReasons, tiles: [[nx, ny]],
                };
                if (indexOf[vi] >= 0) { record(indexOf[vi], state); continue; }
                if (cells[vi].kind === 'sink') {
                    sinks.push({ from: source.id, tile: [nx + ox, ny + oy], labels: cells[vi].labels ?? [] });
                    continue;
                }
                push(vi, state.mask, state.manual, state.reasons, state.tiles);
            }
        }

        while (queue.length > 0) {
            const state = queue.shift();
            const cx = state.cellIndex % width;
            const cy = (state.cellIndex - cx) / width;
            for (const dir of DIR_NAMES) {
                const [dx, dy] = DIRS[dir];
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                const vi = ny * width + nx;
                if (indexOf[vi] === source.index) continue; // back where we started
                const cost = stepCost(grid, state.cellIndex, vi, dir);
                if (!cost) continue;
                let mask = state.mask;
                let overflowed = false;
                for (const c of cost.conditions) {
                    const bit = bitFor(c);
                    if (bit >= MAX_DISTINCT_CONDITIONS) { overflowed = true; break; }
                    mask |= 1 << bit;
                }
                if (overflowed) { overflow.push([nx + ox, ny + oy]); continue; }
                const next = {
                    cellIndex: vi,
                    mask,
                    manual: state.manual || cost.manual,
                    reasons: [...state.reasons, ...cost.manualReasons],
                    tiles: [...state.tiles, [nx, ny]],
                };
                if (indexOf[vi] >= 0) { record(indexOf[vi], next); continue; }
                if (cells[vi].kind === 'sink') {
                    sinks.push({ from: source.id, tile: [nx + ox, ny + oy], labels: cells[vi].labels ?? [] });
                    continue;
                }
                push(vi, next.mask, next.manual, next.reasons, next.tiles);
            }
        }
    }

    // Reduce each pair to its Pareto-minimal ways. A manual way and a labelled
    // way between the same pair both survive: the labelled one is the rule, the
    // manual one is a second crossing someone still has to look at.
    const crossings = [];
    for (const entry of [...results.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))) {
        const labelled = paretoMinimal(entry.ways.filter((w) => !w.manual));
        const manual = entry.ways.filter((w) => w.manual);
        // A crossing that is free by some route needs no rule at all, and the
        // manual routes beside it are then irrelevant — you can already walk it.
        const free = labelled.some((w) => w.mask === 0);
        crossings.push({
            from: entry.from,
            to: entry.to,
            free,
            conditionSets: free ? [] : labelled.map((w) => ({
                conditions: conditionOf.filter((_, bit) => (w.mask >> bit) & 1),
                tiles: w.tiles,
            })),
            manual: !free && labelled.length === 0 && manual.length > 0,
            manualReasons: free || labelled.length > 0 ? [] : [...new Set(manual.flatMap((w) => w.reasons))],
            tiles: (free ? labelled.find((w) => w.mask === 0) : (labelled[0] ?? manual[0]))?.tiles ?? [],
        });
    }

    return {
        crossings,
        sinks: dedupeSinks(sinks),
        conditionVocabulary: conditionOf,
        overflow: [...new Set(overflow.map(String))].map((s) => s.split(',').map(Number)),
    };
}

function dedupeSinks(sinks) {
    const seen = new Map();
    for (const s of sinks) {
        const k = `${s.from}|${s.tile}`;
        if (!seen.has(k)) seen.set(k, s);
    }
    return [...seen.values()].sort((a, b) => a.from.localeCompare(b.from) || a.tile[1] - b.tile[1] || a.tile[0] - b.tile[0]);
}

/**
 * Fuse components that a FREE crossing joins in both directions.
 *
 * The flood in part 1 only walks cells that are walkable outright, so a piece of
 * crossing material that costs nothing in the direction it is used — the east
 * and west sides of a cave mouth, whose gate is on its north face — leaves two
 * components either side of one continuous walk. "Zero-item component" means
 * mutually free-reachable, so those are one sub-region, and splitting them would
 * put a free internal exit between two halves of the same place.
 *
 * @returns a rebuilt componentsResult, or null when nothing merged
 */
function mergeFreeBidirectional(grid, componentsResult, crossings) {
    const { components, indexOf } = componentsResult;
    const parent = components.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const byId = new Map(components.map((c) => [c.id, c.index]));

    const free = new Set(crossings.filter((c) => c.free).map((c) => `${c.from}>${c.to}`));
    let merged = false;
    for (const c of crossings) {
        if (!c.free || !free.has(`${c.to}>${c.from}`)) continue;
        const a = find(byId.get(c.from));
        const b = find(byId.get(c.to));
        if (a === b) continue;
        parent[Math.max(a, b)] = Math.min(a, b);
        merged = true;
    }
    if (!merged) return null;

    const groups = new Map();
    for (let i = 0; i < components.length; i += 1) {
        const root = find(i);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(...components[i].tiles);
    }
    const ox = grid.origin?.x ?? 0;
    const oy = grid.origin?.y ?? 0;
    const rebuilt = [...groups.values()]
        .map((tiles) => {
            tiles.sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
            return tiles;
        })
        .sort((a, b) => (a[0][1] - b[0][1]) || (a[0][0] - b[0][0]))
        .map((tiles, index) => ({
            index,
            id: componentId(tiles[0][0] + ox, tiles[0][1] + oy),
            anchor: [tiles[0][0] + ox, tiles[0][1] + oy],
            tiles,
            size: tiles.length,
        }));

    const nextIndexOf = new Int32Array(indexOf.length).fill(-1);
    for (const c of rebuilt) {
        for (const [x, y] of c.tiles) nextIndexOf[y * grid.width + x] = c.index;
    }
    return { components: rebuilt, indexOf: nextIndexOf };
}

// --- rule tidying ------------------------------------------------------------
//
// Composing conditions in series and in parallel produces rules that are
// correct but say the same thing twice — a swim across followed by a waterfall
// climb comes out as `Has(Progressive Swim) AND Has(Progressive Swim, 2)`. This
// is not game knowledge: `Has` is a Rule Builder built-in and n copies imply
// n-1, so the collapse is sound for any game.

const hasKeyOf = (node) => (
    node?.rule === 'Has'
    && node.children === undefined
    && typeof node.args?.item_name === 'string'
    && (node.args.count === undefined || Number.isInteger(node.args.count))
    && Object.keys(node.args).every((k) => k === 'item_name' || k === 'count')
        ? node.args.item_name
        : null
);

/** Flatten nested And/Or, drop duplicates, and collapse Has counts. */
export function simplifyRule(node) {
    if (!node || typeof node !== 'object' || !Array.isArray(node.children)) return node;
    const op = node.rule;
    if (op !== 'And' && op !== 'Or') return node;

    const flat = [];
    for (const raw of node.children) {
        const child = simplifyRule(raw);
        if (child?.rule === op && Array.isArray(child.children)) flat.push(...child.children);
        else flat.push(child);
    }

    // An AND wants the STRONGEST count of each item (it subsumes the weaker
    // ones); an OR wants the weakest (the cheapest way in).
    const strongest = op === 'And';
    const counts = new Map();
    for (const child of flat) {
        const name = hasKeyOf(child);
        if (name === null) continue;
        const count = child.args.count ?? 1;
        const seen = counts.get(name);
        if (seen === undefined || (strongest ? count > seen : count < seen)) counts.set(name, count);
    }

    const kept = [];
    const emitted = new Set();
    for (const child of flat) {
        const name = hasKeyOf(child);
        if (name !== null) {
            if (emitted.has(name)) continue;
            emitted.add(name);
            const count = counts.get(name);
            kept.push(count > 1
                ? { rule: 'Has', args: { item_name: name, count } }
                : { rule: 'Has', args: { item_name: name } });
            continue;
        }
        const k = JSON.stringify(child);
        if (emitted.has(k)) continue;
        emitted.add(k);
        kept.push(child);
    }

    if (kept.length === 0) return node;
    if (kept.length === 1) return kept[0];
    return { ...node, children: kept };
}

// --- part 2b: crossings -> internal exits ------------------------------------

/**
 * Fold the crossings into `internal_exits` rows.
 *
 * Both directions of a pair are computed independently (a waterfall is free
 * down and gated up), so they are compared and collapsed into ONE bidirectional
 * row only when they came out identical. `bidirectional` is always written
 * explicitly — the format forbids a default.
 */
export function buildInternalExits(crossings, options = {}) {
    const { resolveCondition } = options;
    if (typeof resolveCondition !== 'function') {
        throw new Error('buildInternalExits needs a resolveCondition(condition, ...) helper');
    }

    const ruleFor = (crossing) => {
        if (crossing.free) return { rule: null, unresolved: [] };
        if (crossing.manual || crossing.conditionSets.length === 0) return { rule: null, unresolved: [] };
        const alternatives = [];
        const unresolved = [];
        for (const set of crossing.conditionSets) {
            const parts = [];
            let ok = true;
            for (const condition of set.conditions) {
                const resolved = resolveCondition(condition);
                if (!resolved) { ok = false; unresolved.push(condition); break; }
                parts.push(resolved);
            }
            if (!ok) continue;
            alternatives.push(simplifyRule(parts.length === 1 ? parts[0] : { rule: 'And', children: parts }));
        }
        // A single unresolvable way among several is not a free pass: dropping
        // it would claim the crossing is HARDER than it is, which is the safe
        // direction, but claiming it when nothing resolved would invent a rule.
        if (alternatives.length === 0) return { rule: null, unresolved };
        const rule = simplifyRule(alternatives.length === 1 ? alternatives[0] : { rule: 'Or', children: alternatives });
        return { rule, unresolved };
    };

    const byPair = new Map();
    for (const c of crossings) {
        const key = [c.from, c.to].sort().join(' ');
        if (!byPair.has(key)) byPair.set(key, {});
        byPair.get(key)[`${c.from}>${c.to}`] = c;
    }

    const rows = [];
    const needsAuthoring = [];
    const unresolvedConditions = [];
    for (const c of crossings) {
        const key = [c.from, c.to].sort().join(' ');
        const pair = byPair.get(key);
        const reverse = pair[`${c.to}>${c.from}`];
        const forward = ruleFor(c);
        unresolvedConditions.push(...forward.unresolved);
        const manual = c.manual || (!c.free && forward.rule === null);
        const row = {
            from: c.from,
            to: c.to,
            bidirectional: false,
            source: manual ? DEFAULT_EXIT_SOURCE : 'analyzer',
        };
        if (forward.rule) row.access_rule = forward.rule;

        if (reverse) {
            const back = ruleFor(reverse);
            const backManual = reverse.manual || (!reverse.free && back.rule === null);
            const same = manual === backManual
                && JSON.stringify(forward.rule ?? null) === JSON.stringify(back.rule ?? null);
            if (same) {
                // Emit the pair once, from the lexicographically first endpoint,
                // so the output does not depend on which side was scanned first.
                if (c.from > c.to) continue;
                row.bidirectional = true;
            }
        }
        if (manual) {
            needsAuthoring.push({
                from: row.from,
                to: row.to,
                bidirectional: row.bidirectional,
                reasons: c.manualReasons,
                tiles: c.tiles,
            });
        }
        rows.push(row);
    }

    rows.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    return { rows, needsAuthoring, unresolvedConditions };
}

// --- part 3: the merge -------------------------------------------------------

/**
 * Which component an atlas tile belongs to — or, when it does not sit on a
 * walkable cell at all (a door drawn on a wall tile is the normal case), the
 * nearest one reachable through the crossing material.
 *
 * The fallback is reported rather than silent: an exit assigned by proximity is
 * a guess a reviewer should be able to see.
 */
export function componentForTile(grid, componentsResult, tile) {
    const { width, height } = grid;
    const ox = grid.origin?.x ?? 0;
    const oy = grid.origin?.y ?? 0;
    const x = tile[0] - ox;
    const y = tile[1] - oy;
    if (x < 0 || y < 0 || x >= width || y >= height) return { component: null, exact: false, reason: 'outside the analyzed grid' };
    const { components, indexOf } = componentsResult;
    const direct = indexOf[y * width + x];
    if (direct >= 0) return { component: components[direct], exact: true };

    // Breadth-first through non-walkable cells until a component is touched.
    // Ties are broken by component id so the assignment is deterministic.
    const seen = new Uint8Array(width * height);
    let frontier = [y * width + x];
    seen[y * width + x] = 1;
    for (let depth = 0; depth < width + height && frontier.length > 0; depth += 1) {
        const hits = new Set();
        const next = [];
        for (const i of frontier) {
            const cx = i % width;
            const cy = (i - cx) / width;
            for (const dir of DIR_NAMES) {
                const [dx, dy] = DIRS[dir];
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                const n = ny * width + nx;
                if (seen[n]) continue;
                seen[n] = 1;
                if (indexOf[n] >= 0) hits.add(indexOf[n]);
                else if (grid.cells[n].kind !== 'wall') next.push(n);
            }
        }
        if (hits.size > 0) {
            const chosen = [...hits].map((i) => components[i]).sort((a, b) => a.id.localeCompare(b.id))[0];
            return {
                component: chosen,
                exact: false,
                reason: `tile is not walkable; assigned to the nearest component (${hits.size} candidate${hits.size === 1 ? '' : 's'} at distance ${depth + 1})`,
            };
        }
        frontier = next;
    }
    return { component: null, exact: false, reason: 'no walkable component is reachable from this tile' };
}

/**
 * Analyze one atlas region against its grid.
 *
 * Pure: it computes a PROPOSAL and touches nothing. `applyRegionAnalysis`
 * commits it.
 */
export function analyzeRegion(region, grid, options = {}) {
    let componentsResult = findComponents(grid);
    let crossingsResult = findCrossings(grid, componentsResult, options);
    // Fusing a free bidirectional pair can only ever remove crossings, so this
    // settles; the bound is a backstop, not an expectation.
    for (let pass = 0; pass < 16; pass += 1) {
        const fused = mergeFreeBidirectional(grid, componentsResult, crossingsResult.crossings);
        if (!fused) break;
        componentsResult = fused;
        crossingsResult = findCrossings(grid, componentsResult, options);
    }
    const { components } = componentsResult;
    const { crossings, sinks, overflow } = crossingsResult;
    const { rows, needsAuthoring, unresolvedConditions } = buildInternalExits(crossings, options);

    const bindings = [];
    for (const exit of region.exits ?? []) {
        const hit = componentForTile(grid, componentsResult, exit.entrance_tile);
        bindings.push({
            kind: 'exit', id: exit.exit_id, tile: exit.entrance_tile, ...hit,
        });
    }
    for (const loc of region.locations ?? []) {
        const hit = componentForTile(grid, componentsResult, loc.tile);
        bindings.push({ kind: 'location', id: loc.name, tile: loc.tile, ...hit });
    }

    // A pit that drops out of this region is a real exit the atlas does not
    // have yet. It is reported, never dropped: a silent drop reads as a
    // complete map.
    const boundaryCandidates = sinks.map((s) => ({
        sub_region: s.from,
        tile: s.tile,
        labels: s.labels,
        note: 'one-way drop out of this region — a boundary exit candidate, not an internal crossing',
    }));

    return {
        region_id: region.region_id,
        components,
        crossings,
        internal_exits: rows,
        bindings,
        needs_authoring: needsAuthoring,
        boundary_candidates: boundaryCandidates,
        unresolved_conditions: unresolvedConditions,
        unclassified: grid.unclassified ?? [],
        review: grid.review ?? [],
        overflow,
        // The shape the atlas will take. A single component carries NO subgraph:
        // a region with no traversal obstacle carries no boilerplate, and a
        // one-entry subgraph is exactly what the validator warns about.
        split: components.length > 1,
        componentsResult,
    };
}

/**
 * Commit an analysis onto an atlas region, in place.
 *
 * Ruling 2 in one function: the analyzer owns its own rows and nothing else.
 * Hand-authored internal exits survive with their endpoints REMAPPED — a
 * sub-region has no tiles of its own, so the map from old id to new is read off
 * the exits and locations that were bound to it, and a sub-region that bound
 * nothing cannot be remapped and is reported instead of being guessed at.
 */
export function applyRegionAnalysis(atlas, analysis, options = {}) {
    const region = (atlas.regions ?? []).find((r) => r.region_id === analysis.region_id);
    if (!region) throw new Error(`atlas has no region "${analysis.region_id}"`);

    const previous = region.subgraph?.internal_exits ?? [];
    const preserved = previous.filter((e) => internalExitSource(e) !== 'analyzer');
    const newIdOf = new Map(); // old sub_region -> new sub_region

    const bindingFor = (kind, id) => analysis.bindings.find((b) => b.kind === kind && b.id === id);
    const problems = [];

    // Old -> new, learned from what each old sub-region actually held.
    const votes = new Map();
    const vote = (oldSub, newSub) => {
        if (!oldSub || !newSub) return;
        if (!votes.has(oldSub)) votes.set(oldSub, new Map());
        const m = votes.get(oldSub);
        m.set(newSub, (m.get(newSub) ?? 0) + 1);
    };
    for (const exit of region.exits ?? []) vote(exit.sub_region, bindingFor('exit', exit.exit_id)?.component?.id);
    for (const loc of region.locations ?? []) vote(loc.sub_region, bindingFor('location', loc.name)?.component?.id);
    for (const [oldSub, tally] of votes) {
        const winner = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
        if (winner) newIdOf.set(oldSub, winner[0]);
    }

    const subRegions = analysis.components.map((c) => c.id);

    if (!analysis.split) {
        // One component: the region has no traversal obstacle. Drop the
        // subgraph entirely rather than emitting a degenerate one-entry one.
        for (const e of preserved) {
            problems.push({
                kind: 'dropped_manual_exit',
                message: `hand-authored internal exit ${e.from} -> ${e.to} was dropped: the analyzer finds no split in this region`,
                edge: e,
            });
        }
        delete region.subgraph;
        for (const exit of region.exits ?? []) delete exit.sub_region;
        for (const loc of region.locations ?? []) delete loc.sub_region;
        if (atlas.vanilla_layout?.start_region === region.region_id) delete atlas.vanilla_layout.start_sub_region;
        if (region.annotations?.rules_source === 'analyzer' || region.annotations?.rules_source === 'mixed') {
            region.annotations.rules_source = DEFAULT_EXIT_SOURCE;
        }
        finishStamp(atlas, options);
        return { region, problems, sub_regions: [], internal_exits: [] };
    }

    // Remap the preserved rows; a row whose endpoint cannot be placed is
    // reported and dropped rather than silently rewired to the wrong piece.
    const remapped = [];
    for (const e of preserved) {
        const from = newIdOf.get(e.from) ?? (subRegions.includes(e.from) ? e.from : null);
        const to = newIdOf.get(e.to) ?? (subRegions.includes(e.to) ? e.to : null);
        if (!from || !to || from === to) {
            problems.push({
                kind: 'unmappable_manual_exit',
                message: `hand-authored internal exit ${e.from} -> ${e.to} could not be remapped onto the new split`
                    + `${from === to && from ? ` (both endpoints land in "${from}")` : ''} — re-author it`,
                edge: e,
            });
            continue;
        }
        remapped.push({ ...e, from, to, source: internalExitSource(e) });
    }

    region.subgraph = {
        sub_regions: subRegions,
        internal_exits: [...analysis.internal_exits, ...remapped],
    };

    const assign = (target, label) => {
        const binding = analysis.bindings.find((b) => b.kind === label.kind && b.id === label.id);
        if (!binding?.component) {
            problems.push({
                kind: 'unplaced',
                message: `${label.kind} "${label.id}" could not be placed in any component (${binding?.reason ?? 'no binding'})`,
            });
            // Keep a valid document: an unplaceable member goes to the first
            // sub-region, and the problem list says so.
            target.sub_region = subRegions[0];
            return;
        }
        target.sub_region = binding.component.id;
        if (!binding.exact) {
            problems.push({
                kind: 'inexact',
                message: `${label.kind} "${label.id}" at [${label.tile}] ${binding.reason}`,
            });
        }
    };
    for (const exit of region.exits ?? []) assign(exit, { kind: 'exit', id: exit.exit_id, tile: exit.entrance_tile });
    for (const loc of region.locations ?? []) assign(loc, { kind: 'location', id: loc.name, tile: loc.tile });

    if (atlas.vanilla_layout?.start_region === region.region_id) {
        const old = atlas.vanilla_layout.start_sub_region;
        const mapped = (old && newIdOf.get(old)) ?? (subRegions.includes(old) ? old : null);
        atlas.vanilla_layout.start_sub_region = mapped ?? (region.exits?.[0]?.sub_region ?? subRegions[0]);
    }

    if (region.annotations == null || typeof region.annotations !== 'object') region.annotations = {};
    region.annotations.rules_source = derivedRulesSource(region) ?? DEFAULT_EXIT_SOURCE;

    finishStamp(atlas, options);
    return { region, problems, sub_regions: subRegions, internal_exits: region.subgraph.internal_exits };
}

/**
 * Restamp the atlas identity. Always through stampAtlasIdentity — the hash is
 * never reimplemented, and an edited atlas that kept its id would leave every
 * downstream projection looking fresh.
 */
function finishStamp(atlas, options) {
    if (options.stamp === false) return;
    const prior = atlas.provenance?.content_hash;
    const base = typeof prior === 'string' && typeof atlas.atlas_id === 'string' && atlas.atlas_id.endsWith(`-${prior}`)
        ? atlas.atlas_id.slice(0, -(prior.length + 1))
        : atlas.atlas_id;
    stampAtlasIdentity(atlas, base);
}

// --- reporting ---------------------------------------------------------------

/** One-line-per-item human summary, for the CLI and the panel status line. */
export function formatAnalysisReport(analysis) {
    const lines = [];
    const parts = [`${analysis.components.length} component(s)`];
    if (analysis.components.length > 1) parts.push(`${analysis.internal_exits.length} internal exit(s)`);
    lines.push(`region ${analysis.region_id}: ${parts.join(', ')}`
        + (analysis.split ? '' : ' — no split (the region is one walkable piece; its subgraph is omitted)'));

    for (const row of analysis.internal_exits) {
        const arrow = row.bidirectional ? '<->' : '->';
        const rule = row.access_rule ? describeRule(row.access_rule) : (row.source === 'analyzer' ? 'free' : 'NEEDS A RULE');
        lines.push(`  ${row.from} ${arrow} ${row.to}  [${row.source}] ${rule}`);
    }
    if (analysis.needs_authoring.length > 0) {
        lines.push(`${analysis.needs_authoring.length} crossing(s) NEED HAND AUTHORING:`);
        for (const n of analysis.needs_authoring) {
            lines.push(`  ${n.from} -> ${n.to}: ${n.reasons.length > 0 ? n.reasons.join('; ') : 'no derivable rule'}`);
        }
    }
    if (analysis.boundary_candidates.length > 0) {
        lines.push(`${analysis.boundary_candidates.length} one-way drop(s) leave the region — boundary exit candidates:`);
        for (const b of analysis.boundary_candidates) lines.push(`  from ${b.sub_region} at [${b.tile}] (${b.labels.join(', ') || 'sink'})`);
    }
    for (const u of analysis.unclassified) lines.push(`UNCLASSIFIED at [${u.tile}]: ${u.what}`);
    for (const r of analysis.review) lines.push(`REVIEW at [${r.tile}]: ${r.reason}`);
    for (const o of analysis.overflow) lines.push(`condition vocabulary overflow at [${o}] — crossing left unlabelled`);
    return lines;
}

/** Compact human rendering of a Rule Builder tree, for reports only. */
export function describeRule(rule) {
    if (!rule || typeof rule !== 'object') return String(rule);
    if (Array.isArray(rule.children)) {
        const join = rule.rule === 'Or' ? ' OR ' : ' AND ';
        return `(${rule.children.map(describeRule).join(join)})`;
    }
    if (rule.rule === 'Has') {
        const count = rule.args?.count;
        return `${rule.args?.item_name}${count && count > 1 ? ` x${count}` : ''}`;
    }
    return rule.rule;
}

/** Validate an atlas after an apply, so a bad merge cannot be committed quietly. */
export function validateAfterApply(atlas, options = {}) {
    return validateRegionAtlas(atlas, options);
}
