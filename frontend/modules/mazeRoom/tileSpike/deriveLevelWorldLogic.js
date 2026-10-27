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
    regionItems, reachUnder, regionTargets, cutEvents, NOTHING_REACHED, reachedTarget, planToTarget, targetCell, reachKey, reachInputs,
    regionLevels, latticeAxis, latticePoints, fullPoint, pointCovers, inventoryOf, formatPoint, endsWalk,
} from './deriveTileLogic.js';
import { MAZE_TILE_LIB } from './tileStep.js';
import {
    createState, step, getExitAt, worldInputs, sharedWorldOwnerAt, standsInArmedLane, strikeTarget, USE_PREFIX, TURN_PREFIX,
    actionUsable, blockWithinReach,
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
                if (strikeTarget(w, faced, id) === null && !blockWithinReach(w, faced, id)) continue;
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
            for (const r of ropes) if (!cuts.has(r.key) && next.broken?.includes(r.key)) cuts.set(r.key, k);
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
 */
function cachedReach(cache, entered, reach) {
    if (!cache) return reach;
    return (set) => {
        const key = `${entered.entrance.x},${entered.entrance.y}|${set.join('\u0001')}`;
        if (!cache.has(key)) cache.set(key, reach(set));
        return cache.get(key);
    };
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

/**
 * Per-(from, to) minimal inventories over a shared level world.
 *
 * @returns {{ items: string[], pairs: Array<{from, to, minimal: string[][], witnesses: Array<{inventory,
 *   plan, cell}>, unreachable: boolean}>, searched: number, states: number }}
 */
export function deriveLevelWorldLogic(world, helpers, { tileLib = MAZE_TILE_LIB, maxItems = 12, native = false, cache = null } = {}) {
    const sw = world.sharedWorld;
    if (!sw) throw new Error('level-world logic: the world is not a shared level world');
    const items = regionItems(world);
    if (items.length > maxItems) {
        throw new Error(`level-world logic: ${items.length} items exceed the lattice cap ${maxItems}: ${items.join(', ')}`);
    }
    const owned = (cells, to) => {
        for (const cell of cells.keys()) {
            const [x, y] = cell.split(',').map(Number);
            if (sharedWorldOwnerAt(world, x, y) === to) return cell;
        }
        return null;
    };
    const levels = regionLevels(world);
    const axis = latticeAxis(items, levels);
    const pairs = [];
    let searched = 0;
    let states = 0;
    for (const from of sw.regions) {
        const entered = enteredAt(world, from);
        const reachOf = cachedReach(cache, entered, (set) => (native ? nativeReachUnder(entered, set)
            : reachUnder(entered, set, helpers, { pickups: 'ap', tileLib })));
        const full = reachOf(fullPoint(axis));
        searched += 1;
        states += full.states;
        const live = sw.regions.filter((to) => to !== from).map((to) => ({
            from, to, minimal: [], witnesses: [], unreachable: owned(full.cells, to) === null,
        }));
        pairs.push(...live);
        const open = live.filter((p) => !p.unreachable);
        const covered = (p, set) => p.minimal.some((m) => pointCovers(set, m));
        for (const set of latticePoints(axis)) {
            if (open.every((p) => covered(p, set))) continue;
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
    return { items, levels, pairs, searched, states };
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
 *   witnesses: Array<{inventory, plan}>, unreachable: boolean}>, searched: number, states: number }}
 */
export function deriveEntryLogic(world, region, helpers, {
    tileLib = MAZE_TILE_LIB, maxItems = 12, native = false, arrivalBlocked = null, cache = null, arriveFrom = null, arriveAt = null,
} = {}) {
    const shared = Boolean(world.sharedWorld);
    if (arriveFrom !== null && !shared) throw new Error(`entry logic: arriveFrom "${arriveFrom}" needs a shared level world`);
    if (arriveFrom !== null && arriveAt !== null) throw new Error('entry logic: arriveFrom and arriveAt are exclusive');
    const into = shared ? enteredAt(world, arriveFrom ?? region) : world;
    const entered = arriveAt !== null ? { ...into, entrance: { x: arriveAt.x, y: arriveAt.y } } : into;
    const items = [...new Set([...regionItems(world), ...(arrivalBlocked?.items ?? [])])].sort();
    if (items.length > maxItems) {
        throw new Error(`entry logic: ${items.length} items exceed the lattice cap ${maxItems}: ${items.join(', ')}`);
    }
    // ⛓ COUNTED ITEMS: this world's counts, and those of the landing obstacles the caller judges arrivals by.
    const levels = regionLevels(world);
    for (const [item, ns] of arrivalBlocked?.levels ?? []) {
        if (!levels.has(item)) levels.set(item, new Set([1]));
        for (const n of ns) levels.get(item).add(n);
    }
    const axis = latticeAxis(items, levels);
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
    const reachOf = cachedReach(cache, entered, (set) => (native ? nativeReachUnder(entered, set)
        : reachUnder(entered, set, helpers, { pickups: 'ap', tileLib })));
    const full = reachOf(top);
    let searched = 1;
    let states = full.states;
    for (const t of targets) {
        t.minimal = [];
        t.witnesses = [];
        t.unreachable = !taken(full, t, t.event ? top.filter((i) => i !== t.event) : top);
    }
    const live = targets.filter((t) => !t.unreachable);
    const covered = (t, set) => t.minimal.some((m) => pointCovers(set, m));
    for (const set of latticePoints(axis)) {
        if (live.every((t) => covered(t, set))) continue;
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
    return { items, levels, targets, searched, states };
}
