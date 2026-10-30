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
// and its rope stands on a cliff plateau neither side of the lock walks to. A
// faller carrying its rope's cut EVENT (`event`, RULES rope-events: the cut is
// saved and the rock rebuilt fallen on every later visit) is down under any
// condition set holding that event; a faller with no event, that no rope cut
// from the entry drops, is still refused `faller-cross-visit`.
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
    const holderSet = new Set(holders.filter(([x, y]) => inside(x, y)).map(([x, y]) => y * width + x));
    // ⛓ RULES rope-events — a rock on a holder is down, on THIS visit, once its
    // rope's cut event is held, whichever visit cut it (`FallRock.as:42-47`).
    const fallerEventKeys = fallers.map((f) => (f.event && holderSet.has(f.ty * width + f.tx) ? keysOf([f.event])[0] : null));
    for (const k of fallerEventKeys) if (k) universe.add(k);
    const keys = [...universe].sort();
    const lockAdjacent = new Set();
    for (const li of lockCells) {
        const x = li % width;
        const y = (li - x) / width;
        for (const [, dx, dy] of STEPS) if (inside(x + dx, y + dy) && !lockCells.has((y + dy) * width + x + dx)) lockAdjacent.add((y + dy) * width + x + dx);
    }
    const refused = keys.length > BLOCK_SEARCH_MAX_KEYS
        ? `${keys.length} distinct conditions in the room (bound ${BLOCK_SEARCH_MAX_KEYS})` : null;

    const solveUnder = (held, start, goal = lockAdjacent) => {
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
            const cut = (fallerEventKeys[fi] && held.has(fallerEventKeys[fi]))
                || f.triggers.some((t, ti) => has(fallerKeys[fi][ti]) && t.tiles.some(([x, y]) => STEPS.some(([, dx, dy]) => {
                    if (!inside(x + dx, y + dy)) return false;
                    return here.has((y + dy) * width + x + dx);
                })));
            if (!cut) continue;
            const after = reach(start, new Set([...startBlocks, landing]));
            if ([...after].some((i) => goal.has(i))) return { ok: true, states: 1 };
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
            if (pos.some((p) => holderSet.has(p)) && [...region].some((i) => goal.has(i))) return { ok: true, states };
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

    // `goal`: the cells the player must still reach with a block on a holder —
    // beside THIS lock by default; a lock RUN passes its outer cell (rules-l39).
    const entries = (start, goal = lockAdjacent) => {
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
                const r = solveUnder(new Set(set), start, goal);
                if (r.overflow) overflow = `over ${BLOCK_SEARCH_MAX_STATES} states under {${set.join(', ')}}`;
                if (r.ok) found.push(set);
            }
        }
        // ⛔ A rock on a holder that no rope cut from HERE drops is still the
        // room's designed holder: its rope may be cut on another visit (the
        // rock persists fallen). With the cut's EVENT (RULES rope-events) the
        // search prices that itself; without one it is UNDECIDED, not closed.
        const fallerElsewhere = found.length === 0
            && fallers.some((f, fi) => holderSet.has(f.ty * width + f.tx) && !fallerEventKeys[fi]);
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
 *   - `pulser-arm` — a fire block STARTS within a Pulser's reach, so the
 *                    pulser moves it with no item (`Pulser.as:100`); its pulses
 *                    are not placed by this model. ⛓ RULES rules-l39: the reach
 *                    is the 8 tiles round the pulser — a pulse hits what lies
 *                    within `radiusHit` 22 px of its centre (`Pulser.as:23,92-99`),
 *                    which takes in every neighbour (a diagonal one is 11.3 px
 *                    away) and nothing two tiles out (24 px). A fire block moves
 *                    only on a "Fire" or "Pulse" hit (`PushableBlockFire.as:280`),
 *                    so where none STARTS in reach every pulse follows a Fire
 *                    push, the pulser adds no item-free move, and the search
 *                    decides the room (L39). L40, where one does start beside
 *                    its pulser, stays undecided;
 *   - `refused`    — the search's bounds.
 *
 * @returns {{ decided: boolean, why: string|null, search: {entries:(i:number)=>{sets:string[][]}, byKey:Map}|null }}
 */
export function blockHolderVerdict(grid, { heldBy, holders, lockCells, closedCells, tileTypes, keyOf }) {
    if (!heldBy || (heldBy.blocks.length === 0 && (heldBy.fallers ?? []).length === 0)) {
        return { decided: true, why: 'no-block', search: { entries: () => ({ sets: [], refused: null }), byKey: new Map() } };
    }
    const inPulserReach = (b) => (heldBy.pulsers ?? []).some((p) => Math.abs(p.tx - b.tx) <= 1 && Math.abs(p.ty - b.ty) <= 1);
    if (heldBy.pulser && heldBy.blocks.some((b) => b.kind === 'pushableblockfire' && (!heldBy.pulsers || inPulserReach(b)))) {
        return { decided: false, why: 'pulser-arm', search: null };
    }
    const search = blockHolderSearch(grid, {
        blocks: heldBy.blocks, fallers: heldBy.fallers ?? [], holders, lockCells, closedCells, tileTypes, keyOf,
    });
    if (search.refused) return { decided: false, why: `refused: ${search.refused}`, search: null };
    return { decided: true, why: null, search };
}

/**
 * ⛓ RULES l63-pole-crossings — WHAT CROSSING A PUSHABLE BLOCK'S OWN CELL COSTS, read off the push geometry.
 *
 * The transcription claims a fire/spear block's start cell as a crossing gated on its push item (`seedlingSemantics`
 * `pushableblockspear: G(flag('hasSpear'))`): "the item moves it, so the cell is passable". That holds only when the
 * pushed block can get OUT OF THE WAY. A block stops at Enemy as at any solid (`PushableBlockFire.as:31`,
 * `solids.push("Enemy", "Player")`), so a body that never moves and cannot be killed by a hit — a DarkTrap
 * (`aggro.kind` static, `speed` 0, `kill` null in the model's combat rows) — is a wall to the block until something
 * else removes it: the light of a pole that kills it (`poleKillsOf`), an AP event. Game-witnessed on L63
 * (`probe-seedling-l63-spear-block.mjs`): from the east, pushed W the block halts on [5,6] against darktrap@64,96 and
 * seals the far side; with `{63,1}` (the pole lit) it goes on into the pit [3,6] and the far side opens.
 *
 * THE MODEL (Sokoban on the analyzer's grid, as `blockHolderSearch`): the player walks four-connected through cells
 * whose conditions `held` covers (less the block's own claim on its start cell), never through the block; the block
 * moves one tile per push in the push FACING, from any stance the caller's `stances` names for that facing (the
 * weapon's footprint: a Spear thrust collects the block from two cells back, over any cell between, so L63's block is
 * pushed W across the pit [8,6] from [9,6]); it is DESTROYED on Water, Pit and Lava (`BLOCK_FATAL_TILES`), stops at a
 * wall/manual/sink cell, an item-gated cell `held` does not cover, a face/direction/entry-gated cell, and a STOPPER cell
 * none of whose `keys` is held.
 *
 * THE GOAL: the player stands on every cell of `goal` (the far sub-region, the analyzer's own component) that no block
 * occupies. A block parked so that it cuts the far side in two has not been crossed (L63: the block on [5,6] leaves
 * the pole's stance [5,5] and everything west of the trap out of reach).
 *
 * The answer: the Pareto-minimal sets of STOPPER keys under which the crossing succeeds ([] = free beyond `held`).
 * Pure, headless-safe, no imports.
 *
 * ⛓ RULES rules-block-stoppers — the KILLABLE and MOBILE Enemy bodies are not stoppers here, by measurement:
 * `census-seedling-block-stoppers.mjs` parks each one on the cells the block takes and finds no crossing whose price a
 * static one changes, and one mobile one that can stand on a critical cell (L65's Bob, killable by the push item the
 * crossing holds); `probe-seedling-l65-bob-block.mjs` crosses on the game with that Bob alive and with it dead.
 *
 * @param {{width:number,height:number,cells:object[]}} grid the analyzer's cells
 * @param {object} opts
 * @param {{tx:number,ty:number,condition?:object}} opts.block the pushable (its `condition` = its claim on its cell)
 * @param {Record<'N'|'E'|'S'|'W', number[][]>} opts.stances per push facing, the player-to-block offsets a push
 *   comes from (`[[-dx,-dy]]` for a walk-in block; a weapon's footprint for a struck one)
 * @param {Array<{tx:number,ty:number,keys:string[],label:string}>} [opts.stoppers] the bodies a block stops at
 * @param {Map<number,number>} opts.tileTypes cell index -> tile type
 * @param {(c:object)=>string} opts.keyOf
 * @param {string[]} opts.held the condition keys the crossing already pays (the push item)
 * @param {number} start the cell the player starts on (the near side)
 * @param {Set<number>} goal the far side's cells
 * @returns {{sets: string[][], states: number, refused: string|null}}
 */
export function blockCrossingCost(grid, { block, stances, stoppers = [], tileTypes, keyOf, held = [] }, start, goal) {
    const keys = [...new Set(stoppers.flatMap((s) => s.keys))].sort();
    if (keys.length > BLOCK_SEARCH_MAX_KEYS) return { sets: [], states: 0, refused: `${keys.length} stopper keys (bound ${BLOCK_SEARCH_MAX_KEYS})` };
    let states = 0;
    const crosses = (extra) => {
        const r = blockPushSearch(grid, { block, stances, stoppers, tileTypes, keyOf, held: [...held, ...extra] }, start, goal);
        states += r.states;
        return r.ok;
    };
    const sets = [];
    for (let size = 0; size <= keys.length; size += 1) {
        const combos = [];
        const pick = (from, acc) => {
            if (acc.length === size) { combos.push(acc); return; }
            for (let i = from; i < keys.length; i += 1) pick(i + 1, [...acc, keys[i]]);
        };
        pick(0, []);
        for (const set of combos) {
            if (sets.some((f) => f.every((k) => set.includes(k)))) continue;
            if (crosses(set)) sets.push(set);
        }
    }
    return { sets, states, refused: null };
}

/**
 * ⛓ RULES rules-block-stoppers — `blockCrossingCost`'s ONE search under ONE held set, exported so a census reads the
 * same push model (no third physics). `goal` null searches every state (nothing is ever "crossed"); the answer is
 * whether the goal was met, the states searched, and `cells` — every cell the block stood on in a searched state
 * (its start included; a block destroyed on a fatal tile is not a cell) — and `fatal`, the fatal tiles it was pushed
 * onto.
 *
 * @returns {{ok:boolean, states:number, cells:Set<number>, fatal:Set<number>}}
 */
export function blockPushSearch(grid, { block, stances, stoppers = [], tileTypes, keyOf, held = [] }, start, goal = null) {
    const { width, height, cells } = grid;
    const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
    const blockAt = block.ty * width + block.tx;
    const own = block.condition ? keyOf(block.condition) : null;
    const cellKeys = cells.map((cell, i) => {
        const ks = (cell.conditions ?? []).map(keyOf);
        return i === blockAt && own !== null ? ks.filter((k) => k !== own) : ks;
    });
    const stopperAt = new Map(stoppers.map((s) => [s.ty * width + s.tx, s]));
    const gateKeys = (list) => (list === null ? null : (list ?? []).map(keyOf));
    const has = new Set(held);
    const covered = (ks) => ks.every((k) => has.has(k));
    const standable = (i) => !BLOCKING.has(cells[i].kind) && covered(cellKeys[i]);
    const stepOk = (i, n, dir) => [cells[i].faces?.[dir], cells[n].faces?.[OPP[dir]], cells[i].dirs?.[dir], cells[n].enter?.[dir]]
        .map(gateKeys).every((g) => g !== null && covered(g));
    const stopped = (i) => {
        const s = stopperAt.get(i);
        return s !== undefined && !s.keys.some((k) => has.has(k));
    };
    const blockOk = (i) => standable(i) && !stopped(i)
        && !['faces', 'dirs', 'enter'].some((k) => Object.keys(cells[i][k] ?? {}).length > 0);
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
                if (seen.has(n) || n === occupied || !standable(n) || !stepOk(i, n, dir)) continue;
                seen.add(n);
                stack.push(n);
            }
        }
        return seen;
    };
    const blockCells = new Set();
    const fatal = new Set();
    let states = 0;
    if (!standable(start)) return { ok: false, states, cells: blockCells, fatal };
    const seenStates = new Set();
    const queue = [[blockAt, start]];
    while (queue.length) {
        const [pos, from] = queue.shift();
        if (pos === from) continue;
        const region = reach(from, pos);
        const sk = `${pos}|${Math.min(...region)}`;
        if (seenStates.has(sk)) continue;
        seenStates.add(sk);
        states += 1;
        if (states > BLOCK_SEARCH_MAX_STATES) throw new Error(`block crossing: over ${BLOCK_SEARCH_MAX_STATES} states`);
        if (pos >= 0) blockCells.add(pos);
        if (goal && [...goal].every((i) => i === pos || region.has(i))) return { ok: true, states, cells: blockCells, fatal };
        if (pos < 0) continue;
        const x = pos % width;
        const y = (pos - x) / width;
        for (const [dir, dx, dy] of STEPS) {
            const tx = x + dx;
            const ty = y + dy;
            if (!inside(tx, ty)) continue;
            // The player stays on the stance it pushed from (a thrust's stance can be two cells back, over a pit).
            const stance = (stances[dir] ?? []).map(([ox, oy]) => (inside(x - ox, y - oy) ? (y - oy) * width + x - ox : -1))
                .find((s) => s >= 0 && region.has(s));
            if (stance === undefined) continue;
            const target = ty * width + tx;
            if (BLOCK_FATAL_TILES.includes(tileTypes.get(target)) && !stopped(target)) {
                fatal.add(target);
                queue.push([-1, stance]);
            } else if (blockOk(target) && stepOk(pos, target, dir)) {
                queue.push([target, stance]);
            }
        }
    }
    return { ok: false, states, cells: blockCells, fatal };
}
