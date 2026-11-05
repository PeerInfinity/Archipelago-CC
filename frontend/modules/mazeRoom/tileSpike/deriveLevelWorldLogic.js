/**
 * The Q3 search over a SHARED LEVEL WORLD (tile-primitives Stage 2, session tile-primitives-stage2-l15):
 * AP logic per OWNING sub-region, as a CERTIFIER (⚖ user, 2026-10-21: "Certifier" — the preset's rules
 * stay the atlas's; this derives them from the played world and the tests hold the two equal).
 *
 * A level world carries every sub-region of one level in one maze world (`world.sharedWorld`: which AP
 * region owns which cell). The rule for the AP exit `from → to` is the set of inventories with which a
 * player who ARRIVES in `from` (its `shared_world.entrances` cell, the level freshly entered: blocks
 * home, nothing broken) can stand on ANY cell `to` owns. Searched exactly like `deriveRegionLogic`: the
 * item axis is `regionItems` (rule items + the items of actions that strike an obstacle), enumerated as a
 * lattice by increasing size with superset pruning; each inventory a BFS over `scriptedStep` in `'ap'`
 * mode (`native: true` walks the engine's own `step` instead — the same answer, ~10× faster). Boundary
 * exit tiles stay dead ends.
 */

import {
    regionItems, reachUnder, regionTargets, cutEvents, noteCuts, NOTHING_REACHED, reachedTarget, planToTarget, targetCell, reachKey, reachInputs,
    regionLevels, latticeAxis, latticePoints, fullPoint, pointCovers, inventoryOf, formatPoint, endsWalk, latchEvents,
} from './deriveTileLogic.js';
import { MAZE_TILE_LIB } from './tileStep.js';
import { LEARN_MAX_POINTS, learnMinimal, assertMonotoneWorld } from './learnLattice.js';
import {
    createState, step, getExitAt, worldInputs, sharedWorldOwnerAt, standsInArmedLane, strikeTargets, USE_PREFIX, TURN_PREFIX,
    actionUsable, blockWithinReach, latchCells,
} from '../mazeRoomEngine.js';

/**
 * `reachUnder`'s answer from the NATIVE engine `step` (⚖ Q6 "native default"; the item-actions parity
 * suite holds the scripted step ≡ the native one). `'ap'` mode: the inventory is fixed and a location tile
 * grants nothing, so the walk runs on the world without its item overlay.
 */
export function nativeReachUnder(world, inventory, { cap = 400000 } = {}) {
    const w = { ...world, items: new Map() };
    const start = createState(w);
    start.inventory = inventoryOf(inventory);
    // ⚖ never expect tanking a hit: an arrival in an armed lane reaches nothing.
    if (standsInArmedLane(w, start)) return NOTHING_REACHED;
    const ropes = cutEvents(w);
    const cuts = new Map();
    const have = start.inventory;
    const inputs = reachInputs(worldInputs(w).filter((input) => {
        if (!input.startsWith(USE_PREFIX)) return true;
        return actionUsable(w.actionLib[input.slice(USE_PREFIX.length)], have);
    }));
    const seen = new Map([[reachKey(start), null]]);
    const cells = new Map([[`${start.player_pos.x},${start.player_pos.y}`, reachKey(start)]]);
    noteCuts(w, ropes, cuts, start, reachKey(start)); // a latch the arrival stands on is pressed from the start
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
        const s = queue[head];
        if (s.walkedOn) continue;
        const from = reachKey(s);
        for (const macro of inputs) {
            // A use that strikes nothing (and moves no block) only turns the player — the same facing-free state: skip it.
            if (macro.length === 2) {
                const faced = { ...s, facing: macro[0].slice(TURN_PREFIX.length) };
                const id = macro[1].slice(USE_PREFIX.length);
                if (strikeTargets(w, faced, id).length === 0 && !blockWithinReach(w, faced, id)) continue;
            }
            let next = s;
            for (const input of macro) {
                next = step(w, next, input);
                if (next === null) break;
            }
            if (next === null) continue;
            const k = reachKey(next);
            if (seen.has(k)) continue;
            seen.set(k, { from, input: macro });
            queue.push(endsWalk(w, s, next));
            const cell = `${next.player_pos.x},${next.player_pos.y}`;
            if (!cells.has(cell)) cells.set(cell, k);
            noteCuts(w, ropes, cuts, next, k);
        }
        if (seen.size > cap) throw new Error(`level-world logic: native search over ${formatPoint(inventory)} exceeded ${cap} states`);
    }
    const planFrom = (k) => {
        if (k === undefined) return null;
        const plan = [];
        for (let link = seen.get(k); link !== null; link = seen.get(k)) { plan.push(link.input); k = link.from; }
        return plan.reverse().flat();
    };
    return {
        cells, cuts, states: seen.size, planTo: (cell) => planFrom(cells.get(cell)), planToCut: (key) => planFrom(cuts.get(key)),
        reached: (state) => seen.has(reachKey(state)),
    };
}

/**
 * `reach(set)` through an optional CACHE (a Map the caller owns, one per world and engine): the pairs and
 * the entry pricing of one region ask the same (arrival, inventory) reach — the certifier shares it.
 * ⛓ `memo`: memoise even with no cache passed (the LATCH SANDWICH's probes are lattice points the walk may ask again —
 * without the memo L40 laid re-searches them: 5,871 searches, more than with no prune). `count` sees each REAL search.
 */
function cachedReach(cache, entered, reach, { memo = false, count = null } = {}) {
    const run = count ? (set) => { const r = reach(set); count(r); return r; } : reach;
    if (!cache && !memo) return run;
    const store = cache ?? new Map();
    return (set) => {
        const key = `${entered.entrance.x},${entered.entrance.y}|${set.join('\u0001')}`;
        if (!store.has(key)) {
            // ⛓ The MISS returns the FULL value (its caller may take witnesses from it at once); the store keeps the COMPACT one.
            // The lazy re-search calls `reach`, not `run`: it is no new search of the lattice, so `count` does not see it.
            const full = run(set);
            COMPACT_REACH.misses += 1;
            store.set(key, COMPACT_REACH.on ? compactReach(full, (mutant) => reach(mutant ? mutant(set) : set)) : full);
            return full;
        }
        return store.get(key);
    };
}

/**
 * The compact cache's counters (`misses`: real searches stored; `replans`: lazy re-searches for a plan) and its TEST-ONLY hooks:
 * `on: false` stores the full values (the on ≡ off pin), `mutant(set)` makes the lazy re-search use ANOTHER inventory (the
 * lazy-plan pin's mutant, shown red). Every caller leaves both alone.
 */
export const COMPACT_REACH = { on: true, mutant: null, replans: 0, misses: 0 };

/**
 * ⛓ COMPACT REACH (session tile-l12-one-world; measured by tile-l12-level-world; ⚖ Robert 2026-11-04 "A: Build after R-A3
 * (Recommended)"): what the walk reads from a reach after it returns — `cells.has`,
 * `cells.keys()` IN INSERTION ORDER (`owned()` takes the FIRST owned cell: the witness cell), `cells.size`, `cuts.has` /
 * `cuts.keys()`, `states` — kept without the search's `seen`. Cells pack to (x<<8)|y in a Uint16Array when every
 * coordinate is in 0..255 (else Int32 of x*65536+y); `has` is a bitset over the reached bounding box. `planTo`,
 * `planToCut` and `reached` RE-SEARCH the same (arrival, inventory) once (`again`), deterministic BFS, so the plan is
 * the original's. Independent of what a state holds beyond its cell: a latch/block/rope world keeps the same cell order.
 * Measured: the derived-rules probe's heaviest shard 2.38 GB → 0.40–0.53 GB of heap; the whole game's rows byte-identical (CI).
 * A cached reach holds ≈ 8.5 KB (L12 one world, rank walk), where the full value held its whole `seen` Map (0.4–1.3 MB).
 */
export function compactReach(full, again) {
    if (full === NOTHING_REACHED || !full?.cells) return full;
    const keys = [...full.cells.keys()];
    const xy = keys.map((k) => k.split(',').map(Number));
    const small = xy.every(([x, y]) => x >= 0 && y >= 0 && x < 256 && y < 256);
    const order = small ? Uint16Array.from(xy, ([x, y]) => (x << 8) | y) : Int32Array.from(xy, ([x, y]) => x * 65536 + y);
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const [x, y] of xy) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const bw = xy.length ? x1 - x0 + 1 : 0;
    const bits = new Uint8Array(xy.length ? Math.ceil((bw * (y1 - y0 + 1)) / 8) : 0);
    for (const [x, y] of xy) { const i = (y - y0) * bw + (x - x0); bits[i >> 3] |= 1 << (i & 7); }
    const decode = small ? (v) => `${v >> 8},${v & 255}` : (v) => `${Math.floor(v / 65536)},${v % 65536}`;
    const cells = {
        size: order.length,
        has(cell) {
            if (typeof cell !== 'string') return false;
            const [x, y] = cell.split(',').map(Number);
            if (!(x >= x0 && x <= x1 && y >= y0 && y <= y1)) return false;
            const i = (y - y0) * bw + (x - x0);
            return (bits[i >> 3] & (1 << (i & 7))) !== 0;
        },
        * keys() { for (const v of order) yield decode(v); },
        [Symbol.iterator]() { throw new Error('compact reach: cells holds no state keys (iterate keys())'); },
    };
    const cutKeys = [...full.cuts.keys()];
    const cutSet = new Set(cutKeys);
    const cuts = { size: cutKeys.length, has: (k) => cutSet.has(k), keys: () => cutKeys[Symbol.iterator]() };
    // One re-search per plan asked, used once and dropped. `COMPACT_REACH.mutant(set)` (pin only) re-searches ANOTHER inventory.
    const redo = () => { COMPACT_REACH.replans += 1; return again(COMPACT_REACH.mutant); };
    return {
        cells, cuts, states: full.states, compact: true,
        planTo: (cell) => redo().planTo(cell),
        planToCut: (key) => redo().planToCut(key),
        ...(full.reached ? { reached: (state) => redo().reached(state) } : {}),
    };
}

/**
 * ⛓ LATCH SANDWICH (session tile-latch-prune; ⚖ Robert 2026-11-03 "B: Prune, then lay"; measured by session
 * tile-l40-latch-slowness): a lattice point is skipped when a HIGHER point already proves it takes nothing new.
 * The walk already rests on MONOTONICITY — reach only grows with the inventory — when it drops, for good, a target the
 * TOP point does not reach. The sandwich makes the same inference from a lower top: point Q's upper probe is
 * U = Q ∪ E (E = the world's latch events). A target U does not take, Q cannot take either; so if no target still
 * uncovered is taken at U, Q is skipped. A latch's OWN event target is never taken holding its event (`reachedTarget`),
 * so its probe is U \ {its event}. The probes are lattice points, memoised in the same reach cache. Witnesses are
 * unchanged: a skipped point is never minimal, and every minimal point is still searched. L40 with its three latches
 * laid: 2,045 → 283 searches (native derive pass). No latch → `null`: a provable no-op on every other world.
 * ⛔ REFUSED BY NAME: a latch whose held token arms a trap. Holding its event then ARMS something, and reach can shrink
 * with the inventory — the premise is unproven there. (A latch on a pulser's token is refused by `checkButtonLib`.)
 * `reachOf(set)` = the memoised reach; returns `(set, target, takenAt) → true when Q certainly takes nothing for target`.
 * ⛓ The OWN-event branch is LIVE through `deriveEntryLogic` (session tile-lay-l40-latches): a latch's event target is priced
 * from top \ {its event}, so it is a live target, and this branch decides it; `judge.ownEvent` counts its decisions
 * (`engine.ownEvent`). Pinned directly (`latchSandwich.test.js`) and through the derive on L40 (slow tier).
 */
export function latchSandwich(world, reachOf) {
    const E = [...new Set(latchEvents(world).map((l) => l.event))].sort();
    if (E.length === 0) return null;
    for (const { id, entry } of latchCells(world)) {
        if (!entry.latch.event) continue;
        const trap = Object.entries(world.trapLib ?? {}).find(([, t]) => t?.active === entry.holds);
        if (trap) {
            throw new Error(`latch sandwich: ${id} latches the token (${entry.holds}) that arms trap ${trap[0]} — `
                + 'reach may shrink holding its event (not proven monotone; not modelled)');
        }
    }
    const probeOf = (set, minus) => [...new Set([...set, ...E])].filter((i) => i !== minus).sort();
    const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const judge = (set, target, takenAt) => {
        const own = target?.event && E.includes(target.event) ? target.event : null;
        if (own && set.includes(own)) { judge.ownEvent += 1; return true; } // never taken holding its own event
        const u = probeOf(set, own);
        if (same(u, [...set].sort())) return false; // the probe IS Q: nothing to save
        const skip = !takenAt(reachOf(u), u);
        if (skip && own) judge.ownEvent += 1;
        return skip;
    };
    // How many target judgements the OWN-event branch decided (session tile-lay-l40-latches: live through the derive now).
    judge.ownEvent = 0;
    return judge;
}

/**
 * ⛓ LANDING-ROOTED ARRIVALS (session tile-primitives-pit-sinks-landings): the arrivals of one region worth a search.
 * `entered` = the world entered at the region's entrance; `arrivals` = cells (`null` = that entrance). An arrival is
 * dropped when an earlier kept one reaches its FRESH arrival state holding nothing, and it reaches that one's back —
 * reach only grows with the inventory, so from both every inventory reaches the same states and prices the same.
 * The match is on `reachKey` — position, blocks, broken cells — so a cell reached only after a block moved is NOT
 * the same arrival (its fresh state has the block at home). An arrival in an armed lane reaches nothing: it stays.
 * ⛓ The dedupe rests on reach GROWING with the inventory. A trap armed WHILE a token on the item axis is held
 * (`fires: 'while_active'` on a `regionItems` token) breaks that — holding the item shrinks reach — so such a world is
 * never deduped (designer-2's guard, 2026-10-26; no Seedling world has one today).
 */
export function distinctArrivals(entered, arrivals) {
    if (arrivals.length < 2) return arrivals;
    const axis = new Set(regionItems(entered));
    if (Object.values(entered.trapLib ?? {}).some((t) => t?.fires === 'while_active' && axis.has(t.active))) return arrivals;
    const at = (a) => (a ? { ...entered, entrance: { x: a.x, y: a.y } } : entered);
    const reach = new Map();
    const reachOf = (a) => {
        const key = a ? `${a.x},${a.y}` : '';
        if (!reach.has(key)) reach.set(key, nativeReachUnder(at(a), []));
        return reach.get(key);
    };
    const kept = [];
    for (const a of arrivals) {
        const same = kept.some((k) => Boolean(reachOf(k).reached?.(createState(at(a)))) && Boolean(reachOf(a).reached?.(createState(at(k)))));
        if (!same) kept.push(a);
    }
    return kept;
}

/** The same world, entered at `region`'s arrival cell. */
export function enteredAt(world, region) {
    const at = world.sharedWorld?.entrances?.[region];
    if (!at) throw new Error(`level-world logic: no entrance for "${region}" in this shared world`);
    return { ...world, entrance: { x: at.x, y: at.y } };
}

/** The number of points of a lattice axis: Π (levels + 1) — 2^n for an all-binary axis. */
export function latticeSize(axis) {
    return axis.reduce((p, { levels }) => p * (levels.length + 1), 1);
}

/**
 * ⛓ THE RANK WALK'S BOUND, now the HYBRID'S SWITCH (session tile-l12-one-world, ⚖ design-3 GO "the MEMORY form"): the
 * rank walk (+ the latch sandwich) enumerates every point of the lattice by rank; it runs where the lattice has at most
 * 2^LEVEL_WORLD_LATTICE_CAP points (4,096), and the LEARNING walk (`learnLattice.js`) above. Why there: it is the boundary of
 * what the rank walk ran before the learner existed — MEASURED, every derive call of the whole game at main 0885fec4b3 had
 * ≤ 4,096 points (the largest exactly 4,096: L12 r0c19's per-sub-region entry, 11 world items + 1 landing event; then 768,
 * L63) — so every such call is byte-identical to before; and below it the learner is MEASURED SLOWER (one search answers
 * every target of the rank walk, the learner asks per target: +10–15 s on the push slow tier, ≈ ×1.7 on the train
 * scripted sample, research tile-l12-level-world). It is no longer a refusal: `LEVEL_WORLD_MAX_POINTS` is.
 */
export const LEVEL_WORLD_LATTICE_CAP = 12;
export const RANK_WALK_MAX_POINTS = 2 ** LEVEL_WORLD_LATTICE_CAP;

/** Which walk a lattice gets: `'rank'` at or under `RANK_WALK_MAX_POINTS`, else `'learn'`. */
export function walkFor(axis) {
    return latticeSize(axis) <= RANK_WALK_MAX_POINTS ? 'rank' : 'learn';
}

/**
 * ⛓ THE REFUSAL (session tile-l12-one-world, ⚖ design-3 GO "the MEMORY form"): a lattice over `LEVEL_WORLD_MAX_POINTS`
 * points is refused BY NAME, by the derives and — through `levelWorldFits`, the same function — by the maze compile's
 * plain-level test. The bound is the LEARNER'S MEMORY (`LEARN_MAX_POINTS`: per point n + 8 bytes shared and 2 bytes per
 * target), not any level's number. ⚠ Time still grows with the points (the certifier's `compareRow` walks every point per
 * row; L12's 131,072-point rows cost ≈ +8 s of CERT on CI), so a world far past L12 shows up on the slow tier's clock first.
 * ⛓ ONE CROSS-WORLD GAP, named: the compile tests a world's OWN axis (`regionItems` + `regionLevels`), but the certifier's
 * entry pricing WIDENS it with `arrivalBlocked`'s items — the landing obstacles of OTHER worlds its exits land in (L12: its
 * 15 items + `L0 flag 1: breakablerock` + `L24 flag 0: burnabletree` = 17). The compile cannot see those, so a widened axis
 * past the bound is a LOUD refusal of the derive (a throw naming the items), never a silent per-sub-region fallback.
 */
export const LEVEL_WORLD_MAX_POINTS = LEARN_MAX_POINTS;

/**
 * Whether a world's own item axis fits one level world: `true`, or why not. The maze compile's plain-level test and the
 * derives' refusal read this one function.
 */
export function levelWorldFits(world, { maxPoints = LEVEL_WORLD_MAX_POINTS } = {}) {
    const items = regionItems(world);
    const n = latticeSize(latticeAxis(items, regionLevels(world)));
    return n <= maxPoints ? true : `its item axis (${items.length} items) has ${n} lattice points, over the bound ${maxPoints}`;
}

function refuseLattice(what, items, axis, maxPoints) {
    const n = latticeSize(axis);
    if (n > maxPoints) throw new Error(`${what}: ${items.length} items, ${n} lattice points exceed the bound ${maxPoints}: ${items.join(', ')}`);
}

/**
 * Per-(from, to) minimal inventories over a shared level world.
 *
 * `latchSandwich: false` turns the LATCH SANDWICH off — a TEST-ONLY switch (the on ≡ off pins); every caller keeps it on.
 * `walk: 'rank' | 'learn'` forces one walk of the HYBRID (`walkFor`) — TEST-ONLY too (the learner ≡ rank pins).
 * `engine` = the work this call really did: `searches`/`states` of the engine searches it ran (cache misses, the
 * sandwich's probes included) and the lattice points the sandwich `skipped`.
 *
 * @returns {{ items: string[], pairs: Array<{from, to, minimal: string[][], witnesses: Array<{inventory,
 *   plan, cell}>, unreachable: boolean}>, searched: number, states: number,
 *   engine: {searches: number, states: number, skipped: number} }}
 */
export function deriveLevelWorldLogic(world, helpers, {
    tileLib = MAZE_TILE_LIB, maxPoints = LEVEL_WORLD_MAX_POINTS, native = false, cache = null, latchSandwich: sandwiching = true, walk: forcedWalk = null,
} = {}) {
    const sw = world.sharedWorld;
    if (!sw) throw new Error('level-world logic: the world is not a shared level world');
    const items = regionItems(world);
    const owned = (cells, to) => {
        for (const cell of cells.keys()) {
            const [x, y] = cell.split(',').map(Number);
            if (sharedWorldOwnerAt(world, x, y) === to) return cell;
        }
        return null;
    };
    const levels = regionLevels(world);
    const axis = latticeAxis(items, levels);
    refuseLattice('level-world logic', items, axis, maxPoints);
    const learning = (forcedWalk ?? walkFor(axis)) === 'learn';
    if (learning) assertMonotoneWorld(world, items);
    const pairs = [];
    let searched = 0;
    let states = 0;
    const engine = { searches: 0, states: 0, skipped: 0 };
    const count = (r) => { engine.searches += 1; engine.states += r.states; };
    const latched = sandwiching && latchEvents(world).length > 0;
    for (const from of sw.regions) {
        const entered = enteredAt(world, from);
        const reachOf = cachedReach(cache, entered, (set) => (native ? nativeReachUnder(entered, set)
            : reachUnder(entered, set, helpers, { pickups: 'ap', tileLib })), { memo: latched || learning, count });
        const full = reachOf(fullPoint(axis));
        searched += 1;
        states += full.states;
        const live = sw.regions.filter((to) => to !== from).map((to) => ({
            from, to, minimal: [], witnesses: [], unreachable: owned(full.cells, to) === null,
        }));
        pairs.push(...live);
        const open = live.filter((p) => !p.unreachable);
        const covered = (p, set) => p.minimal.some((m) => pointCovers(set, m));
        if (learning) {
            // ⛓ THE LEARNING WALK above `RANK_WALK_MAX_POINTS` (`learnLattice.js`): the same minimal sets and witnesses as the rank
            // walk, by membership queries through the same memoised reach. The monotone census ran above, before any search.
            const { learned, queries } = learnMinimal(axis, open, { query: reachOf, taken: (r, p) => owned(r.cells, p.to) !== null });
            for (const p of open) {
                for (const { point, reach } of learned.get(p)) {
                    const cell = owned(reach.cells, p.to);
                    p.minimal.push(point);
                    p.witnesses.push({ inventory: point, plan: reach.planTo(cell), cell });
                }
            }
            searched += queries;
            continue;
        }
        const sandwich = latched ? latchSandwich(entered, reachOf) : null;
        for (const set of latticePoints(axis)) {
            if (open.every((p) => covered(p, set))) continue;
            if (sandwich && open.every((p) => covered(p, set) || sandwich(set, null, (r) => owned(r.cells, p.to) !== null))) {
                engine.skipped += 1;
                continue;
            }
            const reach = reachOf(set);
            searched += 1;
            states += reach.states;
            for (const p of open) {
                if (covered(p, set)) continue;
                const cell = owned(reach.cells, p.to);
                if (cell === null) continue;
                p.minimal.push(set);
                p.witnesses.push({ inventory: set, plan: reach.planTo(cell), cell });
            }
        }
    }
    return { items, levels, pairs, searched, states, engine };
}

/**
 * Per-TARGET minimal inventories for one AP region of a maze world (session tile-primitives-levels-gap3):
 * from the region's arrival (its `shared_world.entrances` cell in a level world, else the world's own
 * entrance), the inventories with which the player can stand on each location tile and each OUTBOUND
 * boundary exit (`targetRegion` set — an arrival-only exit has no AP rule) the region owns. The certifier's
 * second half: `deriveLevelWorldLogic` prices the crossings INSIDE a level world, this prices what leaves
 * one (and a plain world's whole logic). Same lattice, same reach, the same `native` switch.
 *
 * ⛓ `arrivalBlocked(exit, inventory)` (slice tile-primitives-arrow-rope): a boundary exit is TAKEN only
 * when the caller says its ARRIVAL is not a hit — the arrival cell, in the target world, standing in an
 * armed arrow lane (⚖ user 2026-10-21: L16 from L17 with the trap armed must refuse; never tank a hit).
 * The search over this world cannot see the target's lanes, so the certifier answers from the target's.
 *
 * ⛓ `arriveFrom` (session tile-primitives-sphere-order-2, ⚖ "Price from inbound"): search from ANOTHER member's
 * arrival while pricing `region`'s targets — an internal-only member is entered only by walking in from one, so the
 * search from that member's arrival covers every state the walk can enter it in (blocks, cuts, facing).
 *
 * ⛓ `arriveAt` (session tile-primitives-pit-sinks-landings): search from this CELL — where the game lands a crossing
 * into `region` (the certifier's `atlasLandings`) — instead of the region's entrance cell.
 *
 * @returns {{ items: string[], targets: Array<{id, kind, x, y, exitName?, locationName?, minimal: string[][],
 *   witnesses: Array<{inventory, plan}>, unreachable: boolean}>, searched: number, states: number,
 *   engine: {searches: number, states: number, skipped: number} }} — `latchSandwich` and `engine` as `deriveLevelWorldLogic`'s.
 */
export function deriveEntryLogic(world, region, helpers, {
    tileLib = MAZE_TILE_LIB, maxPoints = LEVEL_WORLD_MAX_POINTS, native = false, arrivalBlocked = null, cache = null, arriveFrom = null, arriveAt = null,
    latchSandwich: sandwiching = true, walk: forcedWalk = null,
} = {}) {
    const shared = Boolean(world.sharedWorld);
    if (arriveFrom !== null && !shared) throw new Error(`entry logic: arriveFrom "${arriveFrom}" needs a shared level world`);
    if (arriveFrom !== null && arriveAt !== null) throw new Error('entry logic: arriveFrom and arriveAt are exclusive');
    const into = shared ? enteredAt(world, arriveFrom ?? region) : world;
    const entered = arriveAt !== null ? { ...into, entrance: { x: arriveAt.x, y: arriveAt.y } } : into;
    const items = [...new Set([...regionItems(world), ...(arrivalBlocked?.items ?? [])])].sort();
    // ⛓ COUNTED ITEMS: this world's counts, and those of the landing obstacles the caller judges arrivals by.
    const levels = regionLevels(world);
    for (const [item, ns] of arrivalBlocked?.levels ?? []) {
        if (!levels.has(item)) levels.set(item, new Set([1]));
        for (const n of ns) levels.get(item).add(n);
    }
    const axis = latticeAxis(items, levels);
    refuseLattice('entry logic', items, axis, maxPoints);
    const learning = (forcedWalk ?? walkFor(axis)) === 'learn';
    if (learning) assertMonotoneWorld(entered, items);
    const top = fullPoint(axis);
    const taken = (reach, t, set) => reachedTarget(reach, t, set, entered) && !(t.exit && arrivalBlocked?.(t.exit, set));
    const owns = (x, y) => !shared || sharedWorldOwnerAt(world, x, y) === region;
    // ⛓ An event bound by the projection names the AP region whose location it is (`side`); a rope's goes by its cell.
    const ownsTarget = (t) => (t.side ? t.side === region : owns(t.x, t.y));
    const exitAt = new Map([...world.exits.values()].map((e) => [`${e.x},${e.y}`, e]));
    const targets = regionTargets(world).filter(ownsTarget).flatMap((t) => {
        if (t.kind === 'exit') {
            const exit = exitAt.get(`${t.x},${t.y}`);
            return exit?.targetRegion ? [{ ...t, exitName: exit.exitName ?? exit.exit_id, exit }] : [];
        }
        return [{ ...t, locationName: t.locationName ?? world.itemLocationNames?.get?.(`${t.x},${t.y}`) ?? null }];
    });
    const engine = { searches: 0, states: 0, skipped: 0 };
    const latched = sandwiching && latchEvents(entered).length > 0;
    const reachOf = cachedReach(cache, entered, (set) => (native ? nativeReachUnder(entered, set)
        : reachUnder(entered, set, helpers, { pickups: 'ap', tileLib })), {
        memo: latched || learning, count: (r) => { engine.searches += 1; engine.states += r.states; },
    });
    const full = reachOf(top);
    let searched = 1;
    let states = full.states;
    const priced = new Map(); // event → the reach of top \ {event}
    for (const t of targets) {
        t.minimal = [];
        t.witnesses = [];
        // ⛓ AN EVENT TARGET IS PRICED WITHOUT ITS EVENT (session tile-lay-l40-latches; the in-world event class, half (a)).
        // The top point HOLDS every event, and a latch held is pre-latched, so its press is never recorded there: judged
        // on `full`, every latch's own target read unreachable. When `full` does not take it, it is judged again on the
        // search of top \ {its event} (memoised: one search per such event). Nothing else can move — no point holding the
        // event takes it, and every point without it lies under top \ {event}.
        const own = t.event ? top.filter((i) => i !== t.event) : top;
        if (taken(full, t, own) || !t.event || own.length === top.length) { t.unreachable = !taken(full, t, own); continue; }
        const fresh = !priced.has(t.event);
        if (fresh) priced.set(t.event, reachOf(own));
        if (fresh) { searched += 1; states += priced.get(t.event).states; }
        t.unreachable = !taken(priced.get(t.event), t, own);
    }
    const live = targets.filter((t) => !t.unreachable);
    const covered = (t, set) => t.minimal.some((m) => pointCovers(set, m));
    if (learning) {
        // ⛓ THE LEARNING WALK (above `RANK_WALK_MAX_POINTS`). An event target is learned on the axis WITHOUT its own event (never
        // taken holding it, `reachedTarget`): every point holding it is decided not taken up front, shrink/grow never touch it.
        const { learned, queries } = learnMinimal(axis, live, {
            query: reachOf, taken: (r, t, set) => taken(r, t, set), exclude: (t) => (t.event && items.includes(t.event) ? t.event : null),
        });
        for (const t of live) {
            for (const { point, reach } of learned.get(t)) {
                t.minimal.push(point);
                t.witnesses.push({ inventory: point, plan: planToTarget(reach, t, point, entered), cell: targetCell(reach, t, point, entered) });
            }
        }
        searched += queries;
        for (const t of targets) delete t.exit;
        return { items, levels, targets, searched, states, engine };
    }
    const sandwich = latched ? latchSandwich(entered, reachOf) : null;
    for (const set of latticePoints(axis)) {
        if (live.every((t) => covered(t, set))) continue;
        if (sandwich && live.every((t) => covered(t, set) || sandwich(set, t, (r, u) => taken(r, t, u)))) {
            engine.skipped += 1;
            continue;
        }
        const reach = reachOf(set);
        searched += 1;
        states += reach.states;
        for (const t of live) {
            if (covered(t, set) || !taken(reach, t, set)) continue;
            t.minimal.push(set);
            t.witnesses.push({ inventory: set, plan: planToTarget(reach, t, set, entered), cell: targetCell(reach, t, set, entered) });
        }
    }
    for (const t of targets) delete t.exit;
    if (sandwich) engine.ownEvent = sandwich.ownEvent;
    return { items, levels, targets, searched, states, engine };
}
