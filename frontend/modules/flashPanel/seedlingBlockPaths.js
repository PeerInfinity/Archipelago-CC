// ⛓ RULES block-path — WHAT HOLDING A MOMENTARY BUTTON COSTS, read off the
// push geometry rather than assumed to be choreography.
//
// A grouped lock that only plain `Button`s open (the re-closing locks,
// `seedlingPlaythroughOverlay.buildGroupOpeners`) is open only while a body
// sits on a button THIS visit, and the player cannot be that body while
// crossing:
//   - `Button.update` presses on any `Player`/`Enemy`/`Solid` overlapping its
//     8x6 hitbox centred in its tile (`Puzzlements/Button.as:16,22,27-40`);
//   - `Lock.activationStep` fades for 100 ticks while held, and the tick the
//     button is released it is Solid again unless something overlaps it
//     (`Puzzlements/Lock.as:64-88`, `returnToNormal`);
//   - the player box is 4x5 (`SEEDLING_PLAYER_BOX`), so it cannot overlap a
//     button's hitbox and a different tile's 16x16 lock at once (the gaps are
//     4 px across and 5 px down, and the box needs MORE than the gap) —
//     EXCEPT in the one tick it steps from the button into the lock: the
//     button releases, the lock is already `type ""`, and `returnToNormal`
//     cannot fire with the player inside it. Game-witnessed on L71
//     (`l71-button-lock`, `l71-hold-101-shut` / `l71-hold-102-open`: held
//     101 ticks on the button south of the lock, then walked straight in).
//     That step crosses the gap only where the button's tile is ORTHOGONALLY
//     beside the lock (`selfHoldTiles`): a diagonal button leaves at least 5 px
//     to cross past the corner tile in ONE tick, and the walk is 0.8 px a
//     tick (`Player.as:73`, `dMS`; the velocity never reaches twice that).
// Everywhere else the holder is another body, and the bodies this module
// reads are the PUSHABLE BLOCKS, which are Solid (`PushableBlock.as:27`) and
// therefore press. An item that a block's ONLY path needs (a rock it must pass, a rock
// the player must break to stand behind it) is the lock's item.
//
// THE MODEL (Sokoban on the analyzer's own tile grid):
//   - a block is one tile (`setHitbox(16, 16)`, `PushableBlock.as:26`) and
//     moves one tile per push (`tile.x = cTile.x ± 1`, `:39-58`);
//   - a plain block moves AWAY from a player walking into it from the opposite
//     side (`collide("Player", x - 1, y)` with `v.x > 0` → east, `:39-58`);
//     the fire and spear blocks move on a HIT (`PushableBlockFire.as:76-123`,
//     `Player.as:1121-1127`), priced here as the same stance plus their item;
//   - it stops at `Mobile.solids` + Enemy + Player (`PushableBlock.as:28`,
//     `Mobile.as:17`): a wall/manual/sink cell, a closed lock, another block,
//     an item-gated cell whose item is not held;
//   - it is DESTROYED on Water, Pit and Lava (`PushableBlock.as:76-85`), so
//     those tiles end its path;
//   - a cell with any face/direction/entry gate (cliffside, cave mouth,
//     waterfall, a one-sided lock) is not entered by a block — the half-tile
//     masks there are not modelled for a 16x16 body (stricter, named).
// The player walks the same grid four-connected (the analyzer's own walk),
// through any cell whose gates the condition set holds, never through a
// block or a closed lock.
//
// A FALLING ROCK is the other body: a `FallRock` is parked off-map with no
// type until its group fires, then lands at its own Ogmo tile as a Solid, and
// is rebuilt there, fallen, on every later entry (`Scenery/FallRock.as:31-38`,
// `checkPersistence(tag)`). One whose tile is a holder holds it for good. Its
// price is the player reaching a cell beside one of its group's ROPES with the
// rope's own condition held (`RopeStart.as:40-46`: a hit cuts it and publishes
// the group). Only a rope-opened rock is read (`fallers`); L28's is the one,
// and its rope stands on a cliff plateau neither side of the lock walks to: an
// entry no rope cut from there decides is refused `faller-cross-visit`.
//
// The answer, per entry into the lock: the Pareto-minimal condition SETS
// under which the player, starting there, can put a block on a holder tile and
// then stand beside the lock. The caller ORs the ANDs.
//
// Pure, headless-safe, no imports: the caller hands in `keyOf`.

/** Tile types a block is destroyed on (`PushableBlock.as:81`: Water 1, Pit 6, Lava 17). */
export const BLOCK_FATAL_TILES = Object.freeze([1, 6, 17]);

/**
 * The pushable kinds and the item a push needs. `null` = a walk-in push.
 * `PushableBlockFire.moveTypes = ["Fire", "Pulse"]` (`:23`) and
 * `PushableBlockSpear.moveTypes = ["Spear"]` (`PushableBlockSpear.as:14`).
 */
export const PUSHABLE_KINDS = Object.freeze({
    pushableblock: Object.freeze({ push: null, cite: 'Puzzlements/PushableBlock.as:35-58 (walked into)' }),
    pushableblockfire: Object.freeze({
        push: 'hasFire', cite: 'Puzzlements/PushableBlockFire.as:23,76-123 (hit by Fire/Pulse) + Player.as:1125-1127',
    }),
    pushableblockspear: Object.freeze({
        push: 'hasSpear', cite: 'Puzzlements/PushableBlockSpear.as:14 (hit by Spear) + Player.as:1121-1123',
    }),
});

/**
 * The holder tiles the PLAYER can hold and still step into the lock: a button
 * whose tile is orthogonally beside a lock cell (see the header). Returns cell
 * indices; an entry from one of them is the player's own hold.
 */
export function selfHoldTiles(holders, lockCells, width) {
    const out = new Set();
    for (const [x, y] of holders) {
        const i = y * width + x;
        for (const [, dx, dy] of STEPS) {
            if (x + dx < 0 || x + dx >= width) continue;
            if (lockCells.has((y + dy) * width + x + dx)) out.add(i);
        }
    }
    return out;
}

/** The search's state bound; a room past it is refused by name, never guessed. */
export const BLOCK_SEARCH_MAX_STATES = 200000;
/** The condition universe bound (subsets are enumerated). */
export const BLOCK_SEARCH_MAX_KEYS = 12;

const STEPS = [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]];
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const BLOCKING = new Set(['wall', 'sink', 'manual']);

/**
 * @param {{width:number,height:number,cells:object[]}} grid `buildSeedlingRegionGrid`'s cells (pre-entry-pricing)
 * @param {object} opts
 * @param {Array<{tx:number,ty:number,kind:string,condition?:object}>} opts.blocks the level's pushables
 *   (`condition` = the block's own claim on its start cell, removed there)
 * @param {Array<[number,number]>} opts.holders the button tiles
 * @param {Set<number>} opts.lockCells this lock's cells
 * @param {Set<number>} [opts.closedCells] every re-closing lock cell in the level (closed while searching)
 * @param {Map<number,number>} opts.tileTypes cell index -> tile type
 * @param {(c:object)=>string} opts.keyOf
 * @param {object} [opts.flagCondition] `name -> condition` for a block kind's push flag
 * @returns {{ universe: string[], byKey: Map<string,object>, refused: string|null,
 *   entries: (startIndex:number) => string[][] }}
 */
export function blockHolderSearch(grid, {
    blocks, holders, lockCells, closedCells = lockCells, tileTypes, keyOf, flagCondition = (f) => ({ flag: f }),
    fallers = [],
}) {
    const { width, height, cells } = grid;
    const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
    const byKey = new Map();
    const keysOf = (conds) => conds.map((c) => {
        const k = keyOf(c);
        byKey.set(k, c);
        return k;
    });
    const blockStart = new Map(blocks.map((b) => [b.ty * width + b.tx, b]));
    // The conditions a cell asks of whoever stands in it, less a block's own claim on its start cell.
    const cellKeys = cells.map((cell, i) => {
        let conds = cell.conditions ?? [];
        const b = blockStart.get(i);
        if (b?.condition) {
            const own = keyOf(b.condition);
            const at = conds.findIndex((c) => keyOf(c) === own);
            if (at >= 0) conds = [...conds.slice(0, at), ...conds.slice(at + 1)];
        }
        return [...new Set(keysOf(conds))];
    });
    const gateKeys = (list) => (list === null ? null : [...new Set(keysOf(list ?? []))]);
    const pushKey = (b) => (PUSHABLE_KINDS[b.kind]?.push ? keysOf([flagCondition(PUSHABLE_KINDS[b.kind].push)])[0] : null);
    const universe = new Set();
    for (let i = 0; i < cells.length; i += 1) {
        if (lockCells.has(i)) continue;
        for (const k of cellKeys[i]) universe.add(k);
        for (const key of ['faces', 'dirs', 'enter']) {
            for (const g of Object.values(cells[i][key] ?? {})) for (const k of gateKeys(g) ?? []) universe.add(k);
        }
    }
    for (const b of blocks) { const k = pushKey(b); if (k) universe.add(k); }
    const fallerKeys = fallers.map((f) => f.triggers.map((t) => [...new Set(keysOf(t.condition ? [t.condition] : []))]));
    for (const ks of fallerKeys) for (const k of ks.flat()) universe.add(k);
    const keys = [...universe].sort();
    const holderSet = new Set(holders.filter(([x, y]) => inside(x, y)).map(([x, y]) => y * width + x));
    const lockAdjacent = new Set();
    for (const li of lockCells) {
        const x = li % width;
        const y = (li - x) / width;
        for (const [, dx, dy] of STEPS) if (inside(x + dx, y + dy) && !lockCells.has((y + dy) * width + x + dx)) lockAdjacent.add((y + dy) * width + x + dx);
    }
    const refused = keys.length > BLOCK_SEARCH_MAX_KEYS
        ? `${keys.length} distinct conditions in the room (bound ${BLOCK_SEARCH_MAX_KEYS})` : null;

    const solveUnder = (held, start) => {
        const has = (ks) => ks.every((k) => held.has(k));
        const standable = (i) => !BLOCKING.has(cells[i].kind) && !closedCells.has(i) && has(cellKeys[i]);
        const blockOk = (i) => {
            const c = cells[i];
            if (!standable(i)) return false;
            if (BLOCK_FATAL_TILES.includes(tileTypes.get(i))) return false;
            const gated = ['faces', 'dirs', 'enter'].some((k) => Object.keys(c[k] ?? {}).length > 0);
            return !gated;
        };
        const stepOk = (i, n, dir) => {
            const f1 = gateKeys(cells[i].faces?.[dir]);
            const f2 = gateKeys(cells[n].faces?.[OPP[dir]]);
            const d = gateKeys(cells[i].dirs?.[dir]);
            const e = gateKeys(cells[n].enter?.[dir]);
            return [f1, f2, d, e].every((g) => g !== null && has(g));
        };
        const movable = blocks.map((b) => !pushKey(b) || held.has(pushKey(b)));
        const reach = (from, occupied) => {
            const seen = new Set([from]);
            const stack = [from];
            while (stack.length) {
                const i = stack.pop();
                const x = i % width;
                const y = (i - x) / width;
                for (const [dir, dx, dy] of STEPS) {
                    if (!inside(x + dx, y + dy)) continue;
                    const n = (y + dy) * width + x + dx;
                    if (seen.has(n) || occupied.has(n) || !standable(n) || !stepOk(i, n, dir)) continue;
                    seen.add(n);
                    stack.push(n);
                }
            }
            return seen;
        };
        if (!standable(start)) return { ok: false, states: 0 };
        // A rope-opened rock on a holder: cut a rope from here, and the rock
        // lands for good; then the player must still stand beside the lock.
        const startBlocks = blocks.map((b) => b.ty * width + b.tx);
        const here = reach(start, new Set(startBlocks));
        for (const [fi, f] of fallers.entries()) {
            const landing = f.ty * width + f.tx;
            if (!holderSet.has(landing)) continue;
            const cut = f.triggers.some((t, ti) => has(fallerKeys[fi][ti]) && t.tiles.some(([x, y]) => STEPS.some(([, dx, dy]) => {
                if (!inside(x + dx, y + dy)) return false;
                return here.has((y + dy) * width + x + dx);
            })));
            if (!cut) continue;
            const after = reach(start, new Set([...startBlocks, landing]));
            if ([...after].some((i) => lockAdjacent.has(i))) return { ok: true, states: 1 };
        }
        const seenStates = new Set();
        const queue = [[startBlocks, start]];
        let states = 0;
        while (queue.length) {
            const [pos, from] = queue.shift();
            const occupied = new Set(pos);
            if (occupied.has(from)) continue;
            const region = reach(from, occupied);
            const canon = Math.min(...region);
            const sk = `${pos.join(',')}|${canon}`;
            if (seenStates.has(sk)) continue;
            seenStates.add(sk);
            states += 1;
            if (states > BLOCK_SEARCH_MAX_STATES) return { ok: false, states, overflow: true };
            if (pos.some((p) => holderSet.has(p)) && [...region].some((i) => lockAdjacent.has(i))) return { ok: true, states };
            pos.forEach((p, bi) => {
                if (!movable[bi]) return;
                const x = p % width;
                const y = (p - x) / width;
                for (const [dir, dx, dy] of STEPS) {
                    const sx = x - dx;
                    const sy = y - dy;
                    const tx = x + dx;
                    const ty = y + dy;
                    if (!inside(sx, sy) || !inside(tx, ty)) continue;
                    const stance = sy * width + sx;
                    const target = ty * width + tx;
                    if (!region.has(stance) || occupied.has(target) || !blockOk(target) || !stepOk(p, target, dir)) continue;
                    const next = pos.slice();
                    next[bi] = target;
                    queue.push([next, p]);
                }
            });
        }
        return { ok: false, states };
    };

    const entries = (start) => {
        if (refused) return { sets: [], refused };
        const found = [];
        let overflow = null;
        // Subsets by size; a superset of a found set is never minimal.
        for (let size = 0; size <= keys.length; size += 1) {
            const combos = [];
            const pick = (from, acc) => {
                if (acc.length === size) { combos.push(acc); return; }
                for (let i = from; i < keys.length; i += 1) pick(i + 1, [...acc, keys[i]]);
            };
            pick(0, []);
            for (const set of combos) {
                if (found.some((f) => f.every((k) => set.includes(k)))) continue;
                const r = solveUnder(new Set(set), start);
                if (r.overflow) overflow = `over ${BLOCK_SEARCH_MAX_STATES} states under {${set.join(', ')}}`;
                if (r.ok) found.push(set);
            }
        }
        // ⛔ A rock on a holder that no rope cut from HERE drops is still the
        // room's designed holder: its rope may be cut on another visit (the
        // rock persists fallen). That is a cross-visit event this search does
        // not price, so the entry is UNDECIDED rather than closed.
        const fallerElsewhere = found.length === 0 && fallers.some((f) => holderSet.has(f.ty * width + f.tx));
        return { sets: found, refused: overflow ?? (fallerElsewhere ? 'faller-cross-visit' : null) };
    };
    return { universe: keys, byKey, refused, entries };
}

/**
 * WHEN THE BLOCK PATHS DECIDE A LOCK — and, by name, when they do not.
 *
 * ⚖ ENEMIES ARE NOT HOLDERS (the user, 2026-10-20: "Enemies don't count"):
 * an enemy that can wander onto a button is nothing the player can rely on,
 * so the holders are the room's pushables and its rope-opened falling rocks. A
 * room with neither has NO holder: every entry is priced as "no button reachable",
 * which the caller turns into a wall (or a free way back out of a pocket only
 * the held lock enters). Undecided, and the player-reach price kept:
 *   - `pulser-arm` — a fire block shares the room with a Pulser, which moves
 *                    it with no item (`Pulser.as:100`); its pulses are not
 *                    placed by this model;
 *   - `refused`    — the search's bounds.
 *
 * @returns {{ decided: boolean, why: string|null, search: {entries:(i:number)=>{sets:string[][]}, byKey:Map}|null }}
 */
export function blockHolderVerdict(grid, { heldBy, holders, lockCells, closedCells, tileTypes, keyOf }) {
    if (!heldBy || (heldBy.blocks.length === 0 && (heldBy.fallers ?? []).length === 0)) {
        return { decided: true, why: 'no-block', search: { entries: () => ({ sets: [], refused: null }), byKey: new Map() } };
    }
    if (heldBy.pulser && heldBy.blocks.some((b) => b.kind === 'pushableblockfire')) {
        return { decided: false, why: 'pulser-arm', search: null };
    }
    const search = blockHolderSearch(grid, {
        blocks: heldBy.blocks, fallers: heldBy.fallers ?? [], holders, lockCells, closedCells, tileTypes, keyOf,
    });
    if (search.refused) return { decided: false, why: `refused: ${search.refused}`, search: null };
    return { decided: true, why: null, search };
}
