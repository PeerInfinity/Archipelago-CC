#!/usr/bin/env node
/**
 * probe-seedling-r5-shaft-solver — ⛓⛓ THE SHAFT IS SOLVABLE, and §18.5's
 * reading of WHY it is hard was wrong in the direction that matters.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 6 step 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §18.5-18.6 (the seal) and
 * §18.9 item 4 ("only then L39's six presses as a plan").
 *
 * ── ⛔⛔ WHAT §18.5 GOT WRONG ─────────────────────────────────────────
 *
 * §18.5 read the room as "six presses, three of them simultaneous, one
 * player" and concluded that the three `PushableBlockFire`s must be the
 * three simultaneous holds. The first half of that is right and the second
 * half hides the mechanism, because it never opened `Cover.as`:
 *
 * ```
 *   else                                        // activate == false
 *   {
 *       collideTypesInto(["Solid", "Player"], x, y, v);
 *       if (v.length > 0) { for each (c in v) if (c is Chest) reset(); }
 *       else reset();
 *   }
 * ```
 *
 * ⛓ **A COVER LATCHES ITSELF OPEN UNDER ANYTHING SOLID.** So a block that
 * arrives on a cover cell keeps that cover open after the button that
 * opened it is released — and the cover cell IS the lock-button cell, so
 * the same block does both jobs at once and frees its opener to move on.
 * The room is not three simultaneous holds by three blocks; it is three
 * blocks each latching a door behind itself, in an ORDER, with the player
 * and the earlier blocks holding the covers open for the later ones.
 *
 * ⚠ That is a claim about which SEQUENCES exist, which is a search, which
 * is what this probe is. It reports the shortest one it finds, so the plan
 * is measured rather than argued.
 *
 * ── THE ABSTRACTION, AND WHAT IT IS ALLOWED TO GET WRONG ──────────────
 *
 * The search is at TILE granularity with time abstracted away: waiting is
 * free (so a 101-tick lock fade and an 11-tick cover fade both collapse to
 * "held long enough"), a push is instantaneous (the real block glides 32
 * ticks), and the player moves one tile at a time with the activator state
 * recomputed after every step — which is exact for the thing that matters,
 * because `Button.update` republishes `activate` EVERY tick and a cover or
 * lock re-solidifies the moment its group goes quiet and nothing overlaps
 * it.
 *
 * ⚠ THE ABSTRACTION IS OPTIMISTIC IN EXACTLY TWO PLACES, both named:
 *
 * 1. **Waiting is free.** A found plan is therefore a plan whose TICKS are
 *    still unpriced. It is a lower bound on the choreography, not a tape.
 * 2. **A push is instant.** In the game the block is `type = "Solid"` at a
 *    position that is neither cell for 32 ticks, and the player standing
 *    where the block is going is a wedge. The plan's stances are all
 *    BEHIND the block, so no stance is in the destination — asserted below
 *    rather than assumed.
 *
 * ⚠⚠ AND IT IS BOUNDED IN TWO PLACES, DECLARED RATHER THAN IMPLIED.
 * The joint state is (player tile) x (three block tiles) x (door mask), and
 * over the whole 19x40 level that does not terminate. So:
 *
 *   `PLAYER_REGION` — rows 0..17. The player enters this room from below
 *      through the rope's shaft; `START_TILE` is where that shaft meets the
 *      region and the walk below it is R5's ordinary routing, already
 *      measured by `probe-seedling-r5-totem-entrance`.
 *   `BLOCK_REGION` — rows 4..12, columns 2..16. Every block STARTS inside
 *      it and every cover/lock-button is inside it; a push that would take
 *      a block out is REFUSED by the search, not by the game.
 *
 * A plan found inside those bounds is a real plan. A FAILURE inside them is
 * not a proof of unsolvability, and this probe says so in as many words
 * rather than printing "no plan" and letting a reader hear "impossible".
 *
 * And PESSIMISTIC in one, which is the safe direction: a DIAGONAL stance is
 * offered (it is inside the corner cut, at 10.0 px) but only when exactly
 * one of the two axes `bothRange` sets is free — the off-axis component
 * eaten by a wall. A press whose both axes are free is a real diagonal
 * glide and is REFUSED rather than approximated.
 *
 * ── ⛔⛔ AND THE FIRST CUT OF THIS PROBE WAS WRONG IN A THIRD PLACE ────
 *
 * R5 slice 7, pricing the plan for the tape, found the abstraction
 * optimistic in one more way — undeclared, unlike the two above, because
 * nobody had noticed it:
 *
 * 3. **A PRESS MOVED EXACTLY THE BLOCK IT AIMED AT.** `Player.fire()` has
 *    no aim. It is a 32x32 area around the player and `genericHit` runs on
 *    EVERYTHING inside it, so a press with two blocks in range moves BOTH,
 *    each `atan2`-directed away from the player. The old `pressOutcome`
 *    took a `blockKey` argument, which encoded an aim the weapon does not
 *    have.
 *
 * ⇒ §19.8's eighteen presses are NOT a plan the game makes. Its press 17
 * (stance (9,9), block 2 (10,9)->(11,9)) also shoves block 1 off `button
 * t1` into a `cover t0` that is still solid, and its press 18 (stance
 * (8,9), the diagonal) also shoves block 3 WEST off `cover t2`, closing
 * the lock it was holding. `PLAN_AIMED` below is that plan, kept and
 * replayed so the failure is a printed one rather than a claim.
 *
 * ⛓⛓ AND THE CORRECTED ROOM IS BETTER, NOT WORSE. The collateral is the
 * mechanism: with block 3 parked on `button t0` — which is one tile from
 * its own destination — a single press from (9,9) moves all THREE blocks
 * onto all three lock-buttons at once, each in a pure axis. `PLAN` is
 * that, and it needs no diagonal at all.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-shaft-solver.mjs
 *   node scripts/procgen/probe-seedling-r5-shaft-solver.mjs --plan-only
 *
 * `--plan-only` runs the NAMED choreography and skips the existence search.
 * The search is minutes; the plan is milliseconds, and it is the half a
 * route author reads.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, rectsOverlap } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { RESPONDERS } = await import(join(MODULE, 'activators.js'));
const { hitPushableFromPoint, newPushable } = await import(join(MODULE, 'pushables.js'));
const { fireHits, FIRE_RADIUS } = await import(join(MODULE, 'fireVerb.js'));
const { TOTEM_SHAFT } = await import(join(MODULE, 'r5Totem.js'));

const TILE = 16;
/** Everything R5 holds by the time it reaches the totem path. */
const INVENTORY = Object.freeze({
    hasSword: true, canSwim: true, hasFeather: true, hasFire: true,
});

let failures = 0;
const claim = (ok, what, detail) => {
    if (!ok) failures += 1;
    console.log(`   ${ok ? '✓' : '⛔'} ${what}`);
    if (detail) console.log(`      ${detail}`);
};

const world = buildLevelWorld(atlasLevelSource()(39), { roles: ROLES, inventory: INVENTORY });
const W = world.width;
const H = world.height;
const key = (tx, ty) => `${tx},${ty}`;
const tileOf = (r) => ({ tx: Math.floor(r.x / TILE), ty: Math.floor(r.y / TILE) });

// ── the static map ────────────────────────────────────────────────────
// Everything solid that neither MOVES nor OPENS. The rope is excluded: it
// is the declared arm (§18.7) and the route pulls it before it is here.
const dynamicIds = new Set([
    ...world.activators.map((a) => a.id),
    ...world.pushables.map((p) => p.id),
]);
const staticBlocked = new Set();
for (const s of world.solids) {
    if (s.activatorId && dynamicIds.has(s.activatorId)) continue;
    if (s.pushableId && dynamicIds.has(s.pushableId)) continue;
    if (s.tag === 'rope') continue;
    for (let y = Math.floor(s.rect.y / TILE); y < Math.ceil(s.rect.bottom / TILE); y += 1) {
        for (let x = Math.floor(s.rect.x / TILE); x < Math.ceil(s.rect.right / TILE); x += 1) {
            staticBlocked.add(key(x, y));
        }
    }
}

// ── the activators, as one-tile doors ─────────────────────────────────
// `wandlock@144,592` is the PLUG the L38 ButtonRoom deletes at build time
// (§18.4), so it is not a door in this room — it is already gone.
const doors = world.activators
    .filter((a) => a.id !== 'wandlock@144,592')
    .map((a, i) => {
        const t = tileOf(a.rect);
        if (a.rect.w !== TILE || a.rect.h !== TILE) {
            throw new Error(`${a.id} is not one tile — the abstraction assumes it is`);
        }
        return { i, id: a.id, t: a.t, tag: a.tag, tx: t.tx, ty: t.ty, key: key(t.tx, t.ty) };
    });
const doorAt = new Map(doors.map((d) => [d.key, d]));
const OPEN_ALL = (1 << doors.length) - 1;

// ── the buttons ───────────────────────────────────────────────────────
// A button is pressed by an overlap, and every presser in this room sits in
// the middle of its own tile, so "the tile that contains it" is exact. The
// overlap is re-derived from the rects anyway, so an off-centre presser
// elsewhere would be caught rather than silently rounded.
const buttons = world.pressers.map((p) => {
    const t = tileOf(p.rect);
    const boxOfTile = {
        x: t.tx * TILE, y: t.ty * TILE, w: TILE, h: TILE,
        right: t.tx * TILE + TILE, bottom: t.ty * TILE + TILE,
    };
    if (!rectsOverlap(boxOfTile, p.rect)) throw new Error(`presser t${p.t} is not in its tile`);
    return { t: p.t, tx: t.tx, ty: t.ty, key: key(t.tx, t.ty) };
});
const buttonsAt = new Map();
for (const b of buttons) {
    if (!buttonsAt.has(b.key)) buttonsAt.set(b.key, []);
    buttonsAt.get(b.key).push(b.t);
}

/** ⚠ THE DECLARED BOUNDS — see the header. Not the game's; the search's. */
const PLAYER_REGION = Object.freeze({ y0: 0, y1: 17, x0: 0, x1: 18 });
const BLOCK_REGION = Object.freeze({ y0: 4, y1: 12, x0: 2, x1: 16 });
const STATE_CAP = 60_000_000;
const inRegion = (tx, ty, r) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;

const startBlocks = world.pushables
    .map((p) => key(Math.floor(p.x / TILE), Math.floor(p.y / TILE)))
    .sort();
/**
 * Where the search starts: the tile at which the rope's shaft meets
 * `PLAYER_REGION`. The walk from the L38 arrival at (9,38) up to here is
 * ordinary routing and is not part of this puzzle.
 */
const START = key(9, 17);
/** The tile below `teleporter@144,0 -> L40`; standing here is the errand. */
const GOAL = key(9, 1);

// ── the state machine ─────────────────────────────────────────────────
/**
 * `Button.update` -> `activateAll` -> `Lock.activationStep` /
 * `Cover.update`, with the fades collapsed.
 *
 * A door is OPEN after this tick iff its group is held (by the player or a
 * block standing on any button of that group) OR it was already open and
 * something is standing in it. That second clause is the occupancy latch —
 * `returnToNormal`'s `if (!collideTypes(...))` and `Cover`'s
 * `if (v.length > 0)`, which are the same guard written twice.
 */
function settle(playerKey, blockKeys, wasOpen) {
    const held = new Set();
    for (const k of [playerKey, ...blockKeys]) {
        for (const t of buttonsAt.get(k) ?? []) held.add(t);
    }
    let open = 0;
    for (const d of doors) {
        const occupied = playerKey === d.key || blockKeys.includes(d.key);
        if (held.has(d.t) || (((wasOpen >> d.i) & 1) === 1 && occupied)) open |= 1 << d.i;
    }
    return open;
}

const passable = (k, blockKeys, open) => {
    if (staticBlocked.has(k)) return false;
    if (blockKeys.includes(k)) return false;
    const d = doorAt.get(k);
    if (d && ((open >> d.i) & 1) === 0) return false;
    return true;
};

const DIRS = [{ dx: 1, dy: 0, n: 'E' }, { dx: -1, dy: 0, n: 'W' },
    { dx: 0, dy: 1, n: 'S' }, { dx: 0, dy: -1, n: 'N' }];
/**
 * Where the player may stand to fire at a block: the four orthogonal
 * neighbours and the four DIAGONAL ones. Both are inside the 16 px cut —
 * a diagonal tile-centre stance measures 10.0 px by `Player.as:1026`'s own
 * distance — and `fireHits` re-checks every one of them anyway.
 */
const STANCES = [...DIRS,
    { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }];

/**
 * ⚠ THE SEARCH IS TWO NESTED ONES, and the split is what makes it finish.
 *
 * A BFS whose move is "walk one tile" needs a depth of several hundred and
 * a branching factor of five; over this room it does not finish. But the
 * only moves that change the PUZZLE are the fire presses, and there are a
 * handful of them. So:
 *
 *   INNER — for a fixed block layout, flood the pairs `(player tile, door
 *     mask)` the player can walk to. ⚠ THE MASK IS PART OF THE NODE:
 *     stepping onto a button opens a group and stepping off closes it, so
 *     "which tiles are reachable" is not a function of the tile alone. This
 *     is also where the occupancy latch shows up — as a mask that does NOT
 *     close behind the player, because a block is standing in the door.
 *   OUTER — BFS over block layouts, one press per level.
 *
 * The plan is therefore shortest IN PRESSES, which is the number the
 * choreography is priced in.
 */
function reachable(playerKey, blockKeys, open) {
    const startId = `${playerKey}|${open}`;
    const seen = new Map([[startId, null]]);
    const queue = [{ p: playerKey, open }];
    while (queue.length) {
        const cur = queue.shift();
        const [px, py] = cur.p.split(',').map(Number);
        for (const d of DIRS) {
            const nx = px + d.dx;
            const ny = py + d.dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            if (!inRegion(nx, ny, PLAYER_REGION)) continue;
            const nk = key(nx, ny);
            if (!passable(nk, blockKeys, cur.open)) continue;
            const nOpen = settle(nk, blockKeys, cur.open);
            const id = `${nk}|${nOpen}`;
            if (seen.has(id)) continue;
            seen.set(id, { from: `${cur.p}|${cur.open}`, how: `${d.n}->${nk}` });
            queue.push({ p: nk, open: nOpen });
        }
    }
    return seen;
}

/**
 * ⛓ THE PRESS, DRIVEN THROUGH THE REAL MODELS RATHER THAN RE-DERIVED.
 *
 * The stance's reach goes through `fireVerb.fireHits` (the 32x32 rect, the
 * inclusive candidate test and the 16 px corner cut with `Player.as:1026`'s
 * own wrong `originY`) and the destination through
 * `pushables.hitPushableFromPoint` (the `moveTypes` gate and the `atan2`
 * pick). A probe that recomputed either would be a second cost model
 * agreeing with the first by construction.
 *
 * ⚠ THE DIAGONAL BAND IS OFFERED AND BOUNDED. A diagonally-adjacent stance
 * lands inside `bothRange`, so the game sets BOTH target axes and the block
 * takes whichever survives `moveX`/`moveY`. This search admits the case
 * where exactly ONE of the two is free — the off-axis component eaten by a
 * wall, which is a clean one-tile move — and REFUSES the case where both
 * are free, because that is a genuine diagonal glide whose 32 ticks this
 * abstraction cannot price. Refused, not silently taken.
 */
/**
 * ⛔⛔ THE WHOLE PRESS, not one aimed block — see the header's third point.
 *
 * `fireHits` is given EVERY block, because `Player.fire()`'s rect is given
 * every entity. Each block the rect and the radius admit is then routed
 * through `hitPushableFromPoint` on its own, since `atan2` is computed per
 * target, and the ones whose destination is blocked simply do not move
 * (`moveX`/`moveY` return true and `tile` is reset to the current cell —
 * `PushableBlockFire.update`).
 *
 * @returns {?object} `{blocks, moves}` — the new layout and one row per
 *   block that MOVED, or `null` if the press is refused (no block moved at
 *   all, or one of them wanted a free diagonal glide this abstraction
 *   cannot price).
 */
function pressOutcomes(stanceKey, blockKeys, mask) {
    const [stx, sty] = stanceKey.split(',').map(Number);
    const player = { x: stx * TILE + TILE / 2, y: sty * TILE + TILE / 2 };
    const targets = blockKeys.map((k) => {
        const [tx, ty] = k.split(',').map(Number);
        return {
            id: k, type: 'Solid', x: tx * TILE, y: ty * TILE,
            originX: 0, originY: 0, w: TILE, h: TILE,
        };
    });
    const hits = fireHits(player, targets);
    if (hits.length === 0) return null;
    const moves = [];
    // ⚠ THE LAYOUT THE DESTINATION TEST READS is the one the press STARTED
    // with, for every block. In the game all of them are set in the same
    // `fire()` call and glide together, so a block does not see where
    // another one is going — only where it currently is. Two blocks aimed
    // at the same cell would be a wedge, and it is checked below rather
    // than resolved by iteration order.
    for (const h of hits) {
        const [btx, bty] = h.id.split(',').map(Number);
        const block = newPushable({
            id: h.id, as3: 'PushableBlockFire', tag: 'pushableblockfire',
            x: btx * TILE, y: bty * TILE,
        });
        const r = hitPushableFromPoint(block, player);
        if (!r.moved) continue;
        const dx = { W: -1, E: 1 }[r.axes.find((a) => a === 'W' || a === 'E')] ?? 0;
        const dy = { N: -1, S: 1 }[r.axes.find((a) => a === 'N' || a === 'S')] ?? 0;
        if (dx === 0 && dy === 0) continue;
        const others = blockKeys.filter((k) => k !== h.id);
        const free = (ax, ay) => {
            if (!inRegion(btx + ax, bty + ay, BLOCK_REGION)) return false;
            return passable(key(btx + ax, bty + ay), others, mask);
        };
        if (dx !== 0 && dy !== 0) {
            const fx = free(dx, 0);
            const fy = free(0, dy);
            // Both free -> a real diagonal glide. Refused; see the header.
            if (fx && fy) return null;
            if (fx) moves.push({ id: h.id, to: key(btx + dx, bty), band: true });
            else if (fy) moves.push({ id: h.id, to: key(btx, bty + dy), band: true });
            continue;                                  // both walled: it stays
        }
        if (!free(dx, dy)) continue;                   // walled: it stays
        moves.push({ id: h.id, to: key(btx + dx, bty + dy), band: false });
    }
    if (moves.length === 0) return null;
    const dests = moves.map((m) => m.to);
    if (new Set(dests).size !== dests.length) return null;   // two into one cell
    const blocks = blockKeys
        .map((k) => moves.find((m) => m.id === k)?.to ?? k)
        .sort();
    return { blocks, moves };
}

/**
 * The presses available from a `(tile, mask)` node the walk can reach.
 *
 * ⚠ ONE OUTCOME PER STANCE, not one per (stance, block) pair. A press has
 * no aim, so the eight neighbouring cells are eight candidate STANCES and
 * what each one does is decided by the rect.
 */
function pressesFrom(node, blockKeys) {
    const [pk, openStr] = node.split('|');
    const mask = Number(openStr);
    const [px, py] = pk.split(',').map(Number);
    // ⚠ ONE PRESS PER NODE. A press is decided entirely by where the player
    // is standing, so there is nothing to enumerate — the eight neighbours
    // are only a cheap pre-filter for "can this stance reach any block at
    // all", since the rect is 32x32 and the radius 16.
    if (!STANCES.some((s) => blockKeys.includes(key(px + s.dx, py + s.dy)))) return [];
    const outcome = pressOutcomes(pk, blockKeys, mask);
    if (!outcome) return [];
    return [{
        p: pk, b: outcome.blocks, open: settle(pk, outcome.blocks, mask), from: node,
        how: `FIRE standing at ${pk}: `
            + outcome.moves.map((m) => `${m.id} -> ${m.to}`
                + (m.band ? ' [bothRange band, off-axis walled]' : '')).join(', '),
    }];
}

const stateId = (s) => `${s.p}|${s.b.join(';')}|${s.open}`;

function search() {
    const start = {
        p: START, b: [...startBlocks], open: settle(START, startBlocks, 0),
        prev: null, how: null,
    };
    const seen = new Set([stateId(start)]);
    /**
     * ⛓ THE DEDUP THAT MAKES IT FINISH, and it is not on the state.
     *
     * Two states with the same block layout whose player tiles are mutually
     * reachable produce the SAME flood, so expanding both is pure waste —
     * and after a press the stance is often one of a dozen equivalent tiles.
     * The canonical key is the layout plus the lexicographically smallest
     * `(tile, mask)` the flood contains, which is a fingerprint of the flood
     * rather than of where the player happens to be standing in it.
     */
    const expanded = new Set();
    /**
     * Every `(layout, tile, mask)` any flood has already covered. Exact,
     * and it skips a duplicate BEFORE paying for its flood: if a node was
     * in a previous flood under the same layout, the flood from it is that
     * same component.
     */
    const covered = new Set();
    let frontier = [start];
    let presses = 0;
    let walkNodes = 0;
    let merged = 0;
    while (frontier.length && presses < 24 && walkNodes < STATE_CAP) {
        const next = [];
        for (const s of frontier) {
            const layout = s.b.join(';');
            if (covered.has(`${layout}|${s.p}|${s.open}`)) { merged += 1; continue; }
            const walk = reachable(s.p, s.b, s.open);
            for (const node of walk.keys()) covered.add(`${layout}|${node}`);
            expanded.add(`${layout}|${[...walk.keys()].sort()[0]}`);
            walkNodes += walk.size;
            for (const node of walk.keys()) {
                // The errand is a WALK, not a press: the player standing
                // below `teleporter@144,0 -> L40` with the shaft open.
                if (node.split('|')[0] === GOAL) {
                    return { found: { ...s, walk, node }, presses, walkNodes };
                }
            }
            for (const node of walk.keys()) {
                for (const m of pressesFrom(node, s.b)) {
                    const st = { ...m, prev: s, walkOfPrev: walk };
                    if (seen.has(stateId(st))) continue;
                    seen.add(stateId(st));
                    next.push(st);
                }
            }
        }
        frontier = next;
        presses += 1;
        console.log(`   ... after ${presses} press(es): ${next.length} states, `
            + `${expanded.size.toLocaleString()} floods (${merged.toLocaleString()} merged), `
            + `${walkNodes.toLocaleString()} walk nodes`);
    }
    return {
        found: null, presses, walkNodes,
        exhausted: frontier.length === 0 && walkNodes < STATE_CAP,
    };
}

/** Walk the `prev` chain back to the start and read the presses off it. */
function pressChain(end) {
    const out = [];
    for (let s = end; s && s.how; s = s.prev) out.push(s.how);
    return out.reverse();
}

/**
 * ⛓⛓ THE NAMED CHOREOGRAPHY, derived by hand from the room's forced
 * approaches and REPLAYED here through the same state machine and the same
 * two models the search uses.
 *
 * It is here as well as the search because the two answer different
 * questions. The search answers *does a plan exist inside the bounds*; this
 * answers *is THIS plan the game's*, step by step, with the reason each
 * step is possible printed beside it. A search that has not finished is not
 * an argument, and a plan nobody checked is not either.
 *
 * The shape, and why it is forced:
 *
 *  - The three approach cells are FORCED by walls: (9,7) from (9,8),
 *    (11,9) from (12,9), (7,9) from (6,9).
 *  - No cover-button is adjacent to its own cover, so a stance can never
 *    both hold a cover open and reach the block going under it. Every final
 *    push therefore needs its cover held by SOMETHING ELSE.
 *  - ⛓ Block 1 parked on `button t1` at (9,8) is that something for BOTH
 *    group-1 responders at once: `cover t1` at (11,9), which lets block 2
 *    in, and `wandlock@48,160` at (3,10), which lets block 3 OUT.
 *  - ⛓ Block 2 makes a DETOUR to (10,9) — `button t2` — to hold `cover t2`
 *    open for block 3, then comes back. That is the one non-monotone leg,
 *    and it is what makes three blocks cover four holds.
 *  - ⛔ The last push has no block to spare, so the PLAYER holds
 *    `button t0` at (8,9) and fires DIAGONALLY at the block on (9,8). That
 *    press lands inside `bothRange`, setting both target axes — and the
 *    east one is eaten by the wall at (10,8), so the block goes north. **The
 *    room's solution requires the diagonal band.**
 */
const PLAN = [
    // 1. Block 1 up the middle to `button t1`, which opens group 1.
    //    ⚠ (9,8) IS A ONE-WAY STREET: (8,8) and (10,8) are wall, and the
    //    only stance that pushes a block SOUTH out of it is (9,7), which is
    //    `cover t0` and cannot be stood on until it opens. So a block that
    //    parks here has exactly one future — north, onto `button t4`.
    { stance: '9,12', dest: { '9,11': '9,10' }, why: 'block 1 leaves its spawn' },
    { stance: '9,11', dest: { '9,10': '9,9' }, why: 'up the cross' },
    { stance: '9,10', dest: { '9,9': '9,8' }, why: 'onto button t1 -> cover t1 + wandlock@48,160' },
    // 2. Block 2 down column 12 and west onto `button t2`, two tiles past
    //    `cover t1` — it holds `cover t2` open for block 3's whole crossing.
    { stance: '14,5', dest: { '13,5': '12,5' }, why: 'block 2 leaves its spawn' },
    { stance: '12,4', dest: { '12,5': '12,6' }, why: 'down column 12' },
    { stance: '12,5', dest: { '12,6': '12,7' }, why: 'down column 12' },
    { stance: '12,6', dest: { '12,7': '12,8' }, why: 'down column 12' },
    { stance: '12,7', dest: { '12,8': '12,9' }, why: 'down column 12' },
    { stance: '13,9', dest: { '12,9': '11,9' }, why: 'across cover t1 — open because block 1 holds t1' },
    { stance: '12,9', dest: { '11,9': '10,9' }, why: 'onto button t2 -> cover t2 opens for block 3' },
    // 3. Block 3 out through wandlock@48,160, east along row 9, THROUGH the
    //    open `cover t2` and onto `button t0` — one tile PAST its own
    //    destination, which is the whole trick.
    { stance: '3,12', dest: { '3,11': '3,10' }, why: 'through the wandlock group 1 opened' },
    { stance: '3,11', dest: { '3,10': '3,9' }, why: 'out of the pocket' },
    { stance: '2,9', dest: { '3,9': '4,9' }, why: 'east along row 9' },
    { stance: '3,9', dest: { '4,9': '5,9' }, why: 'east along row 9' },
    { stance: '4,9', dest: { '5,9': '6,9' }, why: 'east along row 9' },
    { stance: '5,9', dest: { '6,9': '7,9' }, why: 'across cover t2 — open because block 2 sits on t2' },
    { stance: '6,9', dest: { '7,9': '8,9' }, why: '⛓ ONE TILE PAST: onto button t0 -> cover t0 opens' },
    // 4. ⛓⛓ ONE PRESS, THREE BLOCKS, THREE HOLDS. The player stands in the
    //    middle of the cross and every block is an orthogonal neighbour, so
    //    all three are inside the 32x32 rect at a pure axis each.
    {
        stance: '9,9',
        dest: { '9,8': '9,7', '10,9': '11,9', '8,9': '7,9' },
        why: '⛓⛓ THE WHOLE ROOM IN ONE PRESS — block 1 north onto button t4, block 2 east '
            + 'onto button t5, block 3 west onto button t3. Each cover is open because '
            + 'ANOTHER of the three is standing on its button, and each is then latched by '
            + 'the block gliding into it (the glide overlaps the cover cell on tick 1 and '
            + 'the button it is leaving for another 22-24)',
    },
];

/**
 * ⛔ §19.8's PLAN, kept and replayed so its failure is printed.
 *
 * Every step is the same as the shipped one; the difference is entirely in
 * `pressOutcomes`, which no longer takes an aim. Steps 1-16 survive. Step
 * 17 also shoves block 1 north into a `cover t0` nothing is holding open,
 * and step 18 also shoves block 3 west off `cover t2` — closing
 * `wandlock@144,64` behind it.
 */
const PLAN_AIMED = [
    { stance: '9,12' }, { stance: '9,11' }, { stance: '9,10' },
    { stance: '14,5' }, { stance: '12,4' }, { stance: '12,5' }, { stance: '12,6' },
    { stance: '12,7' }, { stance: '13,9' }, { stance: '12,9' },
    { stance: '3,12' }, { stance: '3,11' }, { stance: '2,9' }, { stance: '3,9' },
    { stance: '4,9' }, { stance: '5,9' },
    { stance: '9,9' }, { stance: '8,9' },
];

/**
 * Replay a named choreography through the state machine and both models.
 *
 * `dest` is a MAP from a block's current cell to where the press should
 * leave it, and it is checked as an EXACT SET against what the press
 * actually moves — which is the whole point after the collateral finding:
 * a step that moves a block the author did not list is a step the author
 * did not understand, and it must fail here rather than in the tape.
 */
function verifyPlan(plan, { label, expectDest = true } = {}) {
    console.log(`\n${label}\n`);
    let blocks = [...startBlocks];
    let open = settle(START, blocks, 0);
    let player = START;
    let bad = 0;
    plan.forEach((step, i) => {
        const n = String(i + 1).padStart(2);
        // The player has to be able to WALK to the stance from where the
        // last step left them, under the CURRENT configuration.
        const walk = reachable(player, blocks, open);
        const arrivals = [...walk.keys()].filter((k) => k.split('|')[0] === step.stance);
        if (arrivals.length === 0) {
            console.log(`   ⛔ ${n}. cannot WALK to ${step.stance}`);
            bad += 1;
            return;
        }
        // Of the masks the walk can arrive in, take the one the press needs.
        let done = false;
        let seen = null;
        for (const node of arrivals) {
            const mask = Number(node.split('|')[1]);
            const out = pressOutcomes(step.stance, blocks, mask);
            if (!out) continue;
            // ⚠ CANONICAL, not `JSON.stringify` of two objects. The moves
            // come out in rect order and the declaration is written in the
            // order that reads well, so a raw stringify compares KEY ORDER
            // — which is how a set that matches prints as one that does not.
            const canon = (o) => Object.entries(o).map(([k, v]) => `${k}->${v}`).sort().join(' ');
            const got = Object.fromEntries(out.moves.map((m) => [m.id, m.to]));
            seen = got;
            if (expectDest && canon(got) !== canon(step.dest)) continue;
            blocks = out.blocks;
            player = step.stance;
            open = settle(player, blocks, mask);
            console.log(`   ✓ ${n}. fire from ${step.stance}: `
                + out.moves.map((m) => `${m.id} -> ${m.to}`
                    + (m.band ? ' [bothRange, off-axis walled]' : '')).join(', '));
            if (step.why) console.log(`         ${step.why}`);
            done = true;
            break;
        }
        if (!done) {
            console.log(`   ⛔ ${n}. the press from ${step.stance} moves `
                + `${seen === null ? 'NOTHING' : JSON.stringify(seen)} and the plan `
                + `declares ${JSON.stringify(step.dest ?? '(unstated)')}`);
            bad += 1;
        }
    });
    const lockButtons = [key(9, 7), key(11, 9), key(7, 9)];
    const held = lockButtons.filter((k) => blocks.includes(k));
    const finalWalk = reachable(player, blocks, open);
    const reachedGoal = [...finalWalk.keys()].some((k) => k.split('|')[0] === GOAL);
    return {
        blocks, open, player, bad, held, reachedGoal,
        ok: bad === 0 && held.length === 3 && reachedGoal,
    };
}

console.log('\n⛔⛔ L39 — THE SHAFT, SOLVED (or not)\n');
console.log(`   ${doors.length} doors, ${buttons.length} buttons, ${startBlocks.length} blocks`);
console.log(`   blocks start at ${startBlocks.join(' ')}`);
console.log(`   player starts at ${START}, goal ${GOAL} (below teleporter -> L40)`);
console.log(`   ⚠ bounds: player rows ${PLAYER_REGION.y0}..${PLAYER_REGION.y1}, `
    + `blocks rows ${BLOCK_REGION.y0}..${BLOCK_REGION.y1} cols `
    + `${BLOCK_REGION.x0}..${BLOCK_REGION.x1}; `
    + `8 stances, radius ${FIRE_RADIUS}, free diagonal glides refused\n`);

// ── ⛔ THE REFUTATION, FIRST ──────────────────────────────────────────
// §19.8's plan, replayed with the aim taken away. It is here ahead of the
// corrected one because a probe that only ever prints the plan that works
// is a probe nobody can tell from one whose model never changed.
{
    const refuted = verifyPlan(PLAN_AIMED, {
        expectDest: false,
        label: '⛔ §19.8\'s EIGHTEEN, replayed with the collateral modelled',
    });
    claim(!refuted.ok,
        '⛔ §19.8\'s plan does NOT solve the room once a press moves everything it reaches',
        `it ends with blocks at ${refuted.blocks.join(' ')} and ${refuted.held.length} of 3 `
        + `lock-buttons held. The presses themselves all "work" — every one of them moves `
        + `something — which is why this was invisible to a model with an aim.`);
}

const planned = verifyPlan(PLAN, {
    label: '⛓⛓ THE CORRECTED CHOREOGRAPHY, replayed through the models',
});
claim(planned.bad === 0, `every one of the ${PLAN.length} presses is one the models make`);
claim(planned.held.length === 3, 'all three lock-buttons end under a block',
    `held [${planned.held.join(' ')}] of [${[key(9, 7), key(11, 9), key(7, 9)].join(' ')}]`);
claim(planned.reachedGoal,
    `⛓⛓ THE SHAFT OPENS: the player walks from ${planned.player} to ${GOAL}`,
    `blocks end at ${planned.blocks.join(' ')}`);
claim(PLAN.every((s) => Object.keys(s.dest).length === 1 || s === PLAN[PLAN.length - 1]),
    'exactly one press is a multi-block press, and it is the last one',
    `${PLAN.filter((s) => Object.keys(s.dest).length > 1).length} multi-block press(es)`);
claim(!PLAN.some((s) => s.stance === '8,9'),
    '⛓ AND THE bothRange DIAGONAL IS NOT NEEDED ANY MORE — every push is a pure axis',
    '§19.8\'s last press was a diagonal from (8,9) precisely because it had no third '
    + 'block to spare; the corrected plan parks block 3 on `button t0` instead, which '
    + 'is one tile from where it has to end up');

if (process.argv.includes('--plan-only')) {
    console.log(`\n${failures === 0 ? '✓ all claims hold' : `⛔ ${failures} claim(s) failed`}`);
    console.log('   ⚠ --plan-only: the existence SEARCH did not run, so "no shorter plan '
        + 'exists" is not among the claims above.\n');
    process.exit(failures === 0 ? 0 : 1);
}

console.log('\n── AND THE SEARCH, independently ──\n');
const t0 = Date.now();
const res = search();
console.log(`\n   ${res.walkNodes.toLocaleString()} walk nodes in ${Date.now() - t0} ms\n`);

if (!res.found) {
    claim(false, 'the shaft is solvable with the modelled fire pushes',
        `no plan in ${res.presses} presses. ${res.exhausted
            ? '⚠ THE BOUNDED SPACE IS EXHAUSTED — a proof about PLAYER_REGION x '
              + 'BLOCK_REGION x the eight stances, NOT about the game.'
            : '⚠ THE SEARCH HIT ITS CAP and is NOT a negative result at all.'}`);
} else {
    const chain = pressChain(res.found);
    claim(true, 'THE SHAFT IS SOLVABLE — by an ORDER, not by three simultaneous holds',
        `${chain.length} fire presses, ${res.presses} search levels`);
    console.log('\n   ── THE CHOREOGRAPHY ──');
    chain.forEach((c, i) => console.log(`      ${i + 1}. ${c}`));
    const finalBlocks = res.found.b;
    console.log(`\n      then walk to ${GOAL}; blocks end at ${finalBlocks.join(' ')}`);
    // ⚠ THE STANCE CHECK the abstraction owes: the player is never in the
    // cell the block is gliding into, so the 32 ticks this search skipped
    // cannot be a wedge. Re-derived from the printed plan, not trusted.
    // ⚠ ONE PRESS CAN NOW MOVE SEVERAL BLOCKS, so the check is over every
    // destination in the line rather than over a single capture. A parser
    // that silently matched nothing would report zero wedges for a plan it
    // never read — so a line with no destinations at all counts as one.
    let wedges = 0;
    for (const c of chain) {
        const stance = /standing at (\d+,\d+):/.exec(c)?.[1];
        const dests = [...c.matchAll(/-> (\d+,\d+)/g)].map((m) => m[1]);
        if (!stance || dests.length === 0 || dests.includes(stance)) wedges += 1;
    }
    claim(wedges === 0,
        'no press stance is the destination cell — the 32-tick glide has nowhere to wedge');
    // And the three lock-buttons really are held at the end.
    const lockButtons = [key(9, 7), key(11, 9), key(7, 9)];
    const heldAtEnd = lockButtons.filter((k) => finalBlocks.includes(k));
    claim(heldAtEnd.length === 3,
        'all three lock-buttons end under a block',
        `held: [${heldAtEnd.join(' ')}] of [${lockButtons.join(' ')}]`);
}

// ── the findings this probe exists to record ──────────────────────────
console.log('\n⛓ THE MECHANISM §18.5 MISSED\n');
claim(RESPONDERS.cover.guard === 'occupancy-unless-chest',
    'the COVER is occupancy-guarded, so a block latches it open under itself',
    `Cover.as:37-73 — ${RESPONDERS.cover.guard}`);
claim(RESPONDERS.wandlock.guard === 'occupancy',
    'and so is the LOCK, which is why a lock cannot close on what stands in it');
claim(TOTEM_SHAFT.pairs.length === 3 && TOTEM_SHAFT.blocks.length === 3,
    'three cover/lock pairs, three blocks — the count §18.5 got right');

console.log(`\n${failures === 0 ? '✓ all claims hold' : `⛔ ${failures} claim(s) failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
