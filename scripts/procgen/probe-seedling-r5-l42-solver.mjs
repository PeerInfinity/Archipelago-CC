#!/usr/bin/env node
/**
 * probe-seedling-r5-l42-solver — ⛓⛓⛓ L42 IS SOLVABLE, AND THE SIX-BAIT
 * ORDERING SLICE 16 BANKED IS NOT THE SOLUTION.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 17 step 0. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §30.8 (what the room is)
 * and §30.10 item 1 (what to do about it). `r5Totem.L42_PART4` is what slice
 * 16 measured; `r5Totem.L42_SOLVE` is what this found.
 *
 * ── ⛔⛔ WHY A SECOND SEARCH, WHEN §30.8 ALREADY RAN ONE ──────────────
 *
 * Slice 16's search asked *"can the corridor be cleared"* and answered YES
 * in six baits — A and B each doing the same W/S/E dance, the first one's
 * park at cols 11,12 being exactly what stops the second at cols 9,10. That
 * answer is real and it is **useless**, because the room's cost is not
 * clearing the corridor. It is:
 *
 *     arrival (15,20)  ->  totempart 4 @184,152  ->  teleporter@240,336
 *
 * and the teleporter is one tile below the arrival. **A park that opens the
 * reach and seals the return is a failed state, not a solution** — and the
 * banked ordering is exactly that: it parks A at cols 11,12 rows 13,14 and
 * B at cols 9,10 rows 13,14, which is the return corridor, so the player
 * collects part 4 and can never leave. This probe prices the ROUND TRIP and
 * that ordering is refuted by its own cost function, in as many words.
 *
 * ── THE STATE, AND WHY IT IS FINITE ──────────────────────────────────
 *
 *     (park-A, park-B, player-component)
 *
 * A `Crusher` charges at 1 px/tick until `moveX`/`moveY` hits a `"Solid"`
 * and STAYS where it stopped, so its resting positions quantise on Solid
 * contact — in this room, 12 of them across both bodies. The player's
 * position matters only through which component of the free space it is in,
 * and the free space is a function of the two parks. So the joint state
 * space is small and a blind BFS over it terminates.
 *
 * ⛓⛓ **AND THE PLAYER GRAPH IS THE *SAFE* CELLS, NOT THE FREE ONES.**
 * §30.6's parked-scanner law is not a post-hoc audit here, it is the search's
 * own adjacency: a cell either crusher can SEE is not a cell the player may
 * stand in, because standing there is a charge. A bait stance is therefore
 * a cell OUTSIDE the component, adjacent to it — which is §30.3's "the
 * approach IS the trigger" derived rather than remembered.
 *
 * ⚠ THE ABSTRACTION IS OPTIMISTIC IN EXACTLY ONE PLACE, DECLARED:
 * **the escape is not TIMED.** The player must end outside the charge's
 * swept volume and may cross it on the way, on the argument that a walking
 * player is faster than 1 px/tick — which is true (1.2) and is a MARGIN,
 * not a proof. So a plan found here is a CANDIDATE, and the check is the
 * DRIVEN sections at the bottom of this file, which put the proposal through
 * the real `stepCrusher` tick by tick. ⛔ §30.8: an over-approximation a
 * POSITIVE result rides on is a wrong answer with a confident shape, and the
 * discipline that answers it is that the search never gets the last word.
 *
 * ⛔⛔ IT ALREADY EARNED ITS KEEP TWICE. The PERMISSIVE reading returns a
 * six-charge ordering — three cheaper, symmetric, and pretty — whose first
 * escape the game runs over in six ticks. And the PESSIMISTIC reading's own
 * chain 1 drives perfectly, zero contacts, and finishes the player on the
 * wrong side of the body it just parked.
 *
 * And PESSIMISTIC in three, which is the safe direction:
 *   - the OTHER crusher is a live scanner throughout the escape, and its
 *     sight lines are computed WITHOUT the charging one as a shield;
 *   - a stance must be seen by the intended crusher in the intended
 *     direction AND by the other one not at all;
 *   - `scanCrusher` decides the direction, so LAST-MATCH-WINS over E,N,W,S
 *     is driven rather than assumed — a stance in two lanes is charged at
 *     from the last of them or it is not a stance.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l42-solver.mjs [--map] [--all]
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { L42_PART4, L42_SOLVE } = await import(join(MODULE, 'r5Totem.js'));
const {
    CRUSHER, DIRECTIONS, crusherRect, detectionRects, laneHitsPlayer, scanCrusher,
} = await import(join(MODULE, 'crusher.js'));

const MAP = process.argv.includes('--map');
const ALL = process.argv.includes('--all');
/**
 * ⚖⚖ THE TWO ESCAPE READINGS, AND WHY BOTH ARE BANKED.
 *
 * Mid-charge the mover is neither where it was nor where it will be, so
 * "what shields the player during the escape" has two defensible answers
 * and the room's answer is different for different charges:
 *
 *   default      the mover is ABSENT — it is not a wall and it is not a
 *                shield. Pessimistic, and it forbids the escape that runs
 *                behind the body that has just passed.
 *   --permissive the mover is not a wall (its cells stay passable) AND it
 *                IS a shield (the other crusher's sight is taken with it at
 *                its park). Optimistic, and it is what the game does when
 *                the player escapes into the corridor the body just left.
 *
 * ⛔ Neither is a proof and this probe says which one it ran under. The
 * pessimistic reading returns NINE charges, the permissive one SIX; the
 * check for either is the drive, and it is in this file.
 */
const PERMISSIVE = process.argv.includes('--permissive');
const levelSource = atlasLevelSource();
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
const world = buildLevelWorld(levelSource(42), { roles: ROLES, inventory: held });

const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

const A = L42_PART4.crushers[0].id;
const B = L42_PART4.crushers[1].id;
const IDS = [A, B];
const HOME = Object.fromEntries(L42_PART4.crushers.map((c) => [c.id, { ...c.home }]));

/** The static world — every Solid that is not one of the two crushers. */
const staticSolids = world.solids.filter((s) => !s.crusherId).map((s) => s.rect);
const liveMap = (cfg) => new Map(IDS.map((id) => [id, {
    id, rect: crusherRect(cfg[id]), x: cfg[id].x, y: cfg[id].y,
}]));
/**
 * ⚠ EVERY PER-CONFIGURATION QUERY IS MEMOISED ON THE CONFIGURATION, and
 * that is not a micro-optimisation. `plannerObstacleAt` walks a 198-box
 * solid list and `solidsFor` ALLOCATES one per call; the first cut of this
 * search rebuilt both for every one of ~1,760 lattice cells of every flood
 * of every state, and did not finish in two minutes. §29.6's finding from
 * the other side: the shape of the work, not the amount of it.
 */
const cfgKey = (cfg) => `${cfg[A].x},${cfg[A].y}|${cfg[B].x},${cfg[B].y}`;
const memo = new Map();
const cacheFor = (cfg) => {
    const k = cfgKey(cfg);
    let c = memo.get(k);
    if (!c) {
        c = {
            line: Object.fromEntries(IDS.map((self) => [self, [...staticSolids,
                ...IDS.filter((i) => i !== self).map((i) => crusherRect(cfg[i]))]])),
            live: null,
            free: new Map(),
            scan: Object.fromEntries(IDS.map((i) => [i, new Map()])),
        };
        memo.set(k, c);
    }
    return c;
};
/** Everything the crusher `self` may be stopped by, or blinded by. */
const solidsFor = (self, cfg) => cacheFor(cfg).line[self];

const P = 8;
const nx = world.world.width / P;
const ny = world.world.height / P;
const cellX = (n) => (n % nx) * P + P / 2;
const cellY = (n) => Math.floor(n / nx) * P + P / 2;
const nodeAt = (px, py) => Math.floor(py / P) * nx + Math.floor(px / P);
const overlaps = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;

const EXIT_INDEX = world.teleporters.findIndex((t) => t.x === 240 && t.y === 336);
if (EXIT_INDEX < 0) throw new Error('L42 has no teleporter at (240,336)');
const EXIT = world.teleporters[EXIT_INDEX];
const PART = world.pickups.find((p) => p.tag === 'totempart');
if (!PART || PART.x !== L42_PART4.part.x) throw new Error('L42 has no totempart at the banked cell');

/**
 * ⛓ THE FREE SET and THE SAFE SET are different graphs and the difference
 * is the whole model. `free` is "the planner can stand here"; `safe` is
 * "…and neither crusher can see you doing it".
 */
const freeAt = (n, cfg, allowTeleporter = null) => {
    const c = cacheFor(cfg);
    const k = allowTeleporter === null ? n : `t${n}`;
    let v = c.free.get(k);
    if (v === undefined) {
        if (c.live === null) c.live = liveMap(cfg);
        // ⛔ `allowTeleporter` IS THE FOURTH POSITIONAL ARGUMENT, not an
        // option key. The first cut of this function passed it in `opts`,
        // where nothing destructures it — so every exit query silently
        // asked "can you walk to the teleporter WITHOUT entering it", the
        // answer was always no, and the goal test could never fire. That is
        // §28.2's silence in a caller rather than a callee: an unlisted key
        // is not an error, and the search reported the room unsolvable.
        v = plannerObstacleAt(world, cellX(n), cellY(n), allowTeleporter,
            { avoidVolumes: false, inventory: held, crushers: c.live }) === null;
        c.free.set(k, v);
    }
    return v;
};

/** `scanCrusher` for one crusher against one lattice cell, in one config. */
const scanAt = (self, n, cfg, lineSolids = null) => {
    const c = cacheFor(cfg);
    if (lineSolids !== null && lineSolids !== c.line[self]) {
        return scanCrusher(cfg[self], playerBoxAt(cellX(n), cellY(n)),
            { x: cellX(n), y: cellY(n) }, lineSolids);
    }
    let v = c.scan[self].get(n);
    if (v === undefined) {
        v = scanCrusher(cfg[self], playerBoxAt(cellX(n), cellY(n)),
            { x: cellX(n), y: cellY(n) }, c.line[self]);
        c.scan[self].set(n, v);
    }
    return v;
};
const safeAt = (n, cfg) => freeAt(n, cfg) && IDS.every((i) => scanAt(i, n, cfg).dir === null);

/** BFS over a predicate, 4-connected on the 8 px lattice. */
const floodOver = (seed, ok) => {
    const seen = new Set();
    if (!ok(seed)) return seen;
    seen.add(seed);
    const q = [seed];
    while (q.length) {
        const n = q.pop();
        const a = n % nx;
        const b = Math.floor(n / nx);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const u = a + dx;
            const v = b + dy;
            if (u < 0 || v < 0 || u >= nx || v >= ny) continue;
            const m = v * nx + u;
            if (seen.has(m) || !ok(m)) continue;
            seen.add(m);
            q.push(m);
        }
    }
    return seen;
};

/**
 * ⛓⛓ THE CHARGE, SIMULATED AT THE GAME'S OWN GRANULARITY — 1 px steps,
 * stopping on the first `"Solid"` the 32x32 body would overlap. `moveX`
 * runs before `moveY` and only one axis is ever non-zero, so a charge is a
 * pure 1-D sweep. What comes back is the PARK and the SWEPT VOLUME, and the
 * second is what makes a positive result honest (§30.8).
 */
const charge = (self, dir, cfg) => {
    const d = DIRECTIONS.find((x) => x.name === dir);
    const blockers = solidsFor(self, cfg);
    let { x, y } = cfg[self];
    for (;;) {
        const probe = crusherRect({ x: x + d.dx * CRUSHER.speed, y: y + d.dy * CRUSHER.speed });
        if (blockers.some((s) => overlaps(probe, s))) break;
        x += d.dx * CRUSHER.speed;
        y += d.dy * CRUSHER.speed;
    }
    const from = crusherRect(cfg[self]);
    const to = crusherRect({ x, y });
    return {
        park: { x, y },
        travel: Math.abs(x - cfg[self].x) + Math.abs(y - cfg[self].y),
        swept: {
            x: Math.min(from.x, to.x),
            y: Math.min(from.y, to.y),
            right: Math.max(from.right, to.right),
            bottom: Math.max(from.bottom, to.bottom),
        },
    };
};

// ── the room, and the parks it admits ─────────────────────────────────
console.log('## the room');
console.log(`   A ${A} home (${HOME[A].x},${HOME[A].y})   B ${B} home (${HOME[B].x},${HOME[B].y})`);
console.log(`   part ${PART.x},${PART.y}   exit teleporter@${EXIT.x},${EXIT.y} -> L${EXIT.to}`);
console.log(`   arrival tile (${L42_PART4.arrival.tx},${L42_PART4.arrival.ty})`);

const ARRIVAL = nodeAt(L42_PART4.arrival.tx * TILE_SIZE + 8, L42_PART4.arrival.ty * TILE_SIZE + 8);

/**
 * ⛔⛔ THE COST FUNCTION, AND IT IS THE WHOLE POINT OF THIS SEARCH.
 *
 * A state is a SOLUTION only if the player's own component holds the part
 * AND can still reach the teleporter. Reaching the exit is asked with
 * `allowTeleporter` — a live teleporter volume is an obstacle to the
 * planner (`plannerObstacleAt`), so the flood that measures the room and
 * the flood that measures the way out are two different questions and the
 * second one has to say which trigger it is allowed to enter.
 */
const componentOf = (seed, cfg) => floodOver(seed, (n) => safeAt(n, cfg));
const holdsPart = (comp) => [...comp].some((n) => overlaps(playerBoxAt(cellX(n), cellY(n)), PART.rect));
const reachesExit = (seed, cfg) => {
    const walk = floodOver(seed, (n) => (freeAt(n, cfg, EXIT_INDEX)
        && IDS.every((i) => scanAt(i, n, cfg).dir === null)));
    return [...walk].some((n) => overlaps(playerBoxAt(cellX(n), cellY(n)), EXIT.rect));
};

const startComp = componentOf(ARRIVAL, HOME);
console.log(`\n## the arrival component — ${startComp.size} SAFE nodes `
    + `(${floodOver(ARRIVAL, (n) => freeAt(n, HOME)).size} free)`);
check(floodOver(ARRIVAL, (n) => freeAt(n, HOME)).size === L42_PART4.flood.nodes,
    '⛓ THE FREE FLOOD IS STILL 304 NODES — the search starts where slice 16 left off',
    `${floodOver(ARRIVAL, (n) => freeAt(n, HOME)).size} against ${L42_PART4.flood.nodes}, `
    + `policy ${L42_PART4.flood.policy}. ⛓ The SAFE flood is ${startComp.size}: the `
    + `difference is the cells A can see from home, which are the only bait stances the `
    + 'room offers at t0.');
check(!holdsPart(startComp) && reachesExit(ARRIVAL, HOME),
    '⛔ AT t0 THE PART IS UNREACHABLE AND THE EXIT IS NOT — the room starts solvable-out',
    `part in component ${holdsPart(startComp)}, exit reachable ${reachesExit(ARRIVAL, HOME)}. `
    + 'The second half is what makes the cost function bite: every state this search '
    + 'visits can be asked whether the player could still LEAVE, and the answer starts '
    + 'as yes.');

// ── the search ────────────────────────────────────────────────────────
/**
 * ⛓⛓ THE MOVE GENERATOR, WHICH IS WHERE EVERY LAW LIVES.
 *
 * A move is `(crusher, direction)` and it is legal only if all of:
 *
 *   1. a STANCE exists — a free cell, 4-adjacent to the player's own safe
 *      component, at which `scanCrusher` returns the intended direction for
 *      the intended crusher (⛓ so LAST-MATCH-WINS is driven) and null for
 *      the other one (⛓⛓ so a bait never wakes the crusher it is not
 *      addressing);
 *   2. the charge MOVES the body at all;
 *   3. an ESCAPE exists — a cell outside the swept volume that is safe in
 *      the NEW configuration and reachable from the stance without entering
 *      any lane of the OTHER crusher, whose sight lines are computed with
 *      the charging body ABSENT rather than shielding.
 *
 * ⚠ The one optimism is that the escape is not timed (see the header).
 */
/**
 * ⛓⛓⛓ AND A STATE CAN BE *HOT*, WHICH IS WHAT MAKES A CHAIN EXPRESSIBLE.
 *
 * §30.8 measured that A's charge from the west is not one charge: the
 * player's escape from each one lands it in the lane of the next, and the
 * whole W/S/E dance is ONE `bait` verb. A search whose escapes must all be
 * SAFE cannot express that at all — it prunes the chain at its first link,
 * which is what the first cut of this solver did, and it then reports the
 * room UNSOLVABLE with a straight face.
 *
 * So a state carries `hot`: the crusher that can see the player where it
 * stands. `hot === null` is a resting state whose region is a whole safe
 * component; a hot state's region is the single cell, and its ONLY legal
 * move is the bait that crusher is already committed to.
 *
 * ⛔ An escape cell the OTHER crusher can see is REFUSED rather than
 * modelled — two crushers converging on one player is a state this
 * abstraction has no honest reading of.
 */
const stancesFor = (self, dir, cfg, state) => {
    const out = [];
    const other = IDS.find((i) => i !== self);
    const lineSelf = solidsFor(self, cfg);
    const lineOther = solidsFor(other, cfg);
    if (state.hot) {
        // A committed crusher gets the cell the player is standing in, and
        // the direction is the game's own answer, not a choice.
        if (state.hot !== self) return out;
        if (scanAt(self, state.seed, cfg, lineSelf).dir !== dir) return out;
        return [state.seed];
    }
    const seen = new Set();
    for (const n of state.region) {
        const a = n % nx;
        const b = Math.floor(n / nx);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const u = a + dx;
            const v = b + dy;
            if (u < 0 || v < 0 || u >= nx || v >= ny) continue;
            const m = v * nx + u;
            if (seen.has(m) || state.region.has(m) || !freeAt(m, cfg)) continue;
            seen.add(m);
            if (scanAt(self, m, cfg, lineSelf).dir !== dir) continue;
            if (scanAt(other, m, cfg, lineOther).dir !== null) continue;
            out.push(m);
        }
    }
    return out;
};

const bareScan = new Map();
const escapesFrom = (self, stance, cfg, next, swept) => {
    const other = IDS.find((i) => i !== self);
    // ⚠ THE OTHER CRUSHER'S SIGHT IS COMPUTED WITH THE CHARGING BODY GONE.
    // Mid-charge the mover is somewhere between two cells, so neither its
    // old nor its new rect is a shield the escape may rely on — and the
    // pessimistic reading is the only one a POSITIVE result may ride on.
    const cfgNoSelf = { ...cfg, [self]: { x: -1000, y: -1000 } };
    // The other crusher scanning with NOTHING but the static world to blind
    // it (default), or with the mover's PARK in the way (--permissive) —
    // memoised on both positions, since that is all it depends on.
    const otherLine = PERMISSIVE
        ? [...staticSolids, crusherRect(next[self])] : staticSolids;
    const bk = `${cfg[other].x},${cfg[other].y}`
        + `|${PERMISSIVE ? `${next[self].x},${next[self].y}` : '-'}`;
    let bare = bareScan.get(bk);
    if (!bare) { bare = new Map(); bareScan.set(bk, bare); }
    const passable = (n) => {
        // free with the charging body simply absent (it is in transit), and
        // never inside a lane the OTHER crusher is scanning.
        if (!freeAt(n, cfgNoSelf)) return false;
        let d = bare.get(n);
        if (d === undefined) {
            d = scanCrusher(cfg[other], playerBoxAt(cellX(n), cellY(n)),
                { x: cellX(n), y: cellY(n) }, otherLine).dir;
            bare.set(n, d);
        }
        return d === null;
    };
    const reach = floodOver(stance, (n) => (n === stance ? true : passable(n)));
    const out = [];
    for (const n of reach) {
        if (overlaps(playerBoxAt(cellX(n), cellY(n)), swept)) continue;
        if (!freeAt(n, next)) continue;
        const sees = IDS.filter((i) => scanAt(i, n, next).dir !== null);
        if (sees.length === 0) out.push({ n, hot: null });
        else if (sees.length === 1 && sees[0] === self) out.push({ n, hot: self });
    }
    return out;
};

const keyOf = (cfg, region, hot) => `${cfg[A].x},${cfg[A].y}|${cfg[B].x},${cfg[B].y}`
    + `|${hot ?? '-'}|${Math.min(...region)}`;

const start = { cfg: HOME, region: startComp, seed: ARRIVAL, hot: null, path: [] };
const seenStates = new Map([[keyOf(HOME, startComp, null), start]]);
const queue = [start];
const solutions = [];
let expanded = 0;
let generated = 0;

while (queue.length) {
    const state = queue.shift();
    expanded += 1;
    if (!state.hot && holdsPart(state.region) && reachesExit(state.seed, state.cfg)) {
        solutions.push(state);
        if (!ALL) break;
        continue;
    }
    for (const self of IDS) {
        for (const d of DIRECTIONS) {
            const { park, travel, swept } = charge(self, d.name, state.cfg);
            if (travel === 0) continue;
            const stances = stancesFor(self, d.name, state.cfg, state);
            if (stances.length === 0) continue;
            const next = { ...state.cfg, [self]: park };
            for (const stance of stances) {
                const seenRegions = new Set();
                for (const { n: e, hot } of escapesFrom(self, stance, state.cfg, next, swept)) {
                    const region = hot ? new Set([e]) : componentOf(e, next);
                    if (region.size === 0) continue;
                    const rk = `${hot ?? '-'}|${Math.min(...region)}`;
                    if (seenRegions.has(rk)) continue;
                    seenRegions.add(rk);
                    generated += 1;
                    const k = keyOf(next, region, hot);
                    if (seenStates.has(k)) continue;
                    const node = {
                        cfg: next,
                        region,
                        seed: e,
                        hot,
                        path: [...state.path, {
                            id: self, dir: d.name, park, travel, hot,
                            stance: { x: cellX(stance), y: cellY(stance) },
                            escape: { x: cellX(e), y: cellY(e) },
                        }],
                    };
                    seenStates.set(k, node);
                    queue.push(node);
                }
            }
        }
    }
}

console.log(`\n## the search (${PERMISSIVE ? 'PERMISSIVE' : 'pessimistic'} escape) — `
    + `${expanded} state(s) expanded, ${seenStates.size} distinct, `
    + `${generated} transition(s)`);
check(solutions.length > 0,
    '⛓⛓⛓ L42 IS SOLVABLE WITH THE RETURN PRICED — a blind BFS finds an ordering',
    solutions.length > 0
        ? `${solutions[0].path.length} baits: `
          + solutions[0].path.map((s) => `${s.id.slice(8)}${s.dir}`).join(' ')
        : 'no ordering in the searched space opens the part AND keeps the exit reachable');

if (solutions.length > 0) {
    const sol = solutions[0];
    const got = sol.path.map((x) => `${x.id} ${x.dir} ${x.travel} ${x.park.x},${x.park.y}`);
    const want = L42_SOLVE.ordering.map((x) => `${x.id} ${x.dir} ${x.travel} ${x.park.x},${x.park.y}`);
    check(PERMISSIVE || got.join(' | ') === want.join(' | '),
        '⛓⛓ …AND IT IS THE BANKED ONE — `r5Totem.L42_SOLVE.ordering`, re-derived',
        `${got.length} baits against ${want.length}. A search whose answer nobody pins is `
        + 'a search the next slice re-runs and cannot compare.');
    check(PERMISSIVE || sol.region.size === L42_SOLVE.solved.safeNodes
        && holdsPart(sol.region) === L42_SOLVE.solved.partReachable
        && reachesExit(sol.seed, sol.cfg) === L42_SOLVE.solved.exitReachable
        && startComp.size === L42_SOLVE.arrival.safeNodes,
        '⛓⛓ …and the floods it ends on are banked too',
        `${sol.region.size} safe nodes, part ${holdsPart(sol.region)}, `
        + `exit ${reachesExit(sol.seed, sol.cfg)} against ${L42_SOLVE.solved.safeNodes} / `
        + `${L42_SOLVE.solved.partReachable} / ${L42_SOLVE.solved.exitReachable}; the `
        + `arrival's safe flood ${startComp.size} against ${L42_SOLVE.arrival.safeNodes}.`);
    check(PERMISSIVE
        || Object.entries(L42_SOLVE.parks).every(([id, p]) => sol.cfg[id].x === p.x && sol.cfg[id].y === p.y),
        '⛓⛓⛓ BOTH BODIES FINISH IN THE TOP ROOM — the one part of the level nothing needs',
        Object.entries(sol.cfg).map(([id, p]) => `${id.slice(8)} (${p.x},${p.y})`).join(', ')
        + '. ⛓ THE TOP ROOM IS THE ANSWER: it is the only region of L42 that is neither '
        + 'on the way to the part nor on the way back, and parking 64 px of Solid in it '
        + 'costs the route nothing. The slice-16 ordering parks both bodies in the RETURN '
        + 'corridor instead, which is the same six moves aimed south.');
}

for (const sol of solutions.slice(0, ALL ? 8 : 1)) {
    console.log(`\n## the ordering — ${sol.path.length} baits`);
    for (const [i, s] of sol.path.entries()) {
        console.log(`   ${i + 1}. ${s.id} ${s.dir} ${s.travel} px -> (${s.park.x},${s.park.y})`
            + `   stance tile (${Math.floor(s.stance.x / TILE_SIZE)},`
            + `${Math.floor(s.stance.y / TILE_SIZE)})`
            + `  escape (${s.escape.x},${s.escape.y}) tile `
            + `(${Math.floor(s.escape.x / TILE_SIZE)},${Math.floor(s.escape.y / TILE_SIZE)})`
            + `${s.hot ? `  -> CHAINS into ${s.hot.slice(8)}` : '  -> at REST'}`);
    }
    console.log(`   final region ${sol.region.size} safe nodes, part ${holdsPart(sol.region)}, `
        + `exit ${reachesExit(sol.seed, sol.cfg)}`);
}

/**
 * ⛓⛓⛓ THE NOOK — the one dead-end tile the whole solution turns on.
 *
 * The top room (rows 5,6, cols 4..15) is exactly two tiles tall and a
 * `Crusher` is exactly 32 px tall, so a body charging east down it fills
 * the corridor. Row 4 is solid across every column but one and row 7 is
 * solid across every column, so a player caught inside that charge has NO
 * lateral escape — except `(6,4)`, a single tile off row 4 that leads
 * nowhere at all. Both of the E charges that park the crushers out of the
 * way end with the player standing in it.
 *
 * ⛓ Measured rather than described, and asked of the volume that matters:
 * the cells 4-adjacent to the crusher's own EAST LANE — where a player has
 * to stand to trigger the charge at all — that are free and OUTSIDE the
 * volume the 32x32 body sweeps on its way past.
 *
 * ⚠⚠ IT TOOK TWO CORRECTIONS TO ASK IT RIGHT, both of them the same
 * mistake — measuring one thing against another thing's world.
 *   1. asked of the swept BAND instead of the lane, it returned the two
 *      tiles the crusher is standing in when the bait begins;
 *   2. asked of the lane but with freeness taken at the crushers' HOME
 *      cells, it returned them again — because a detection rect CONTAINS
 *      the body (`detectionRects`' own note), so the lane covers the four
 *      tiles the charging body occupies, and under a different
 *      configuration those tiles are empty.
 * Asked of the lane, in the CONFIGURATION the charge actually happens in
 * (chain 3's: A about to charge east from `(80,96)`, B already parked at
 * `(240,96)`), there is one answer.
 */
{
    const cfg = { [A]: { x: 80, y: 96 }, [B]: { x: 240, y: 96 } };
    const lane = detectionRects(cfg[A]).find((r) => r.dir === 'E');
    const swept = { x: 64, y: 80, right: 256, bottom: 112 };
    const outs = new Set();
    for (let b = 0; b < ny; b += 1) {
        for (let a = 0; a < nx; a += 1) {
            const n = b * nx + a;
            if (!freeAt(n, cfg)) continue;
            if (!laneHitsPlayer(playerBoxAt(cellX(n), cellY(n)), lane)) continue;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const m = (b + dy) * nx + (a + dx);
                if (a + dx < 0 || b + dy < 0 || a + dx >= nx || b + dy >= ny) continue;
                if (overlaps(playerBoxAt(cellX(m), cellY(m)), swept)) continue;
                if (!freeAt(m, cfg)) continue;
                outs.add(`${Math.floor(cellX(m) / TILE_SIZE)},${Math.floor(cellY(m) / TILE_SIZE)}`);
            }
        }
    }
    console.log(`\n## the top room's east lane — escapes out of it: [${[...outs].join(' ')}]`);
    check([...outs].join(' ') === `${L42_SOLVE.nook.tx},${L42_SOLVE.nook.ty}`,
        '⛓⛓⛓ THE NOOK IS THE ONLY WAY OUT OF AN EASTWARD CHARGE IN THE TOP ROOM',
        `[${[...outs].join(' ')}] against the banked (${L42_SOLVE.nook.tx},${L42_SOLVE.nook.ty}). `
        + 'The room is 2 tiles tall and a crusher is 32 px tall, so there is no dodging '
        + 'sideways and no outrunning it into the east wall; row 7 is solid across every '
        + 'column and row 4 across every column but this one. ⛓ A one-tile dead end that '
        + 'leads nowhere is what makes the whole ordering realisable — which is why the '
        + 'search had to be BLIND: no reading of the room proposes it.');
}

/**
 * ⛔⛔⛔ AND THE PERMISSIVE READING IS REFUTED BY THE GAME, IN SIX TICKS.
 *
 * `--permissive` returns a SIX-charge ordering, symmetric and pretty: each
 * crusher does W then N then E and both finish in the top room, which is
 * three charges cheaper than the pessimistic answer. Its first move is
 * `A W` with the player escaping NORTH from tile (5,10) into rows 7,8 — and
 * that escape does not exist.
 *
 * A's west lane is rows 9,10, so the player has to be in rows 9,10 to
 * trigger it at all; A parks in rows 9,10 at cols 4,5; and the only way out
 * northward is 35 px up the corridor, which is 30 ticks at 1.2 px/tick.
 * A's left edge starts 6 px from the player's box. Driven, holding `up`
 * from the stance:
 *
 *     the player rises 14 px, stops dead against the arriving body,
 *     and takes 48 CONTACTS
 *
 * ⛓⛓ THIS IS THE WHOLE REASON THE SEARCH IS NOT THE ORACLE. Both readings
 * are defensible on the geometry; only one survives the clock. ⇒ §30.8's
 * rule, from the other side: an over-approximation a POSITIVE result rides
 * on is a wrong answer with a confident shape — and the shape here was a
 * SHORTER answer, which is exactly the kind a reader wants to believe.
 */
{
    const run = createLevelRun({
        levelSource, boot: { level: 42, x: 80, y: 176 }, inventory: held, noDamage: true,
    });
    const up = new Set(['up']);
    const y0 = run.state.y;
    for (let i = 0; i < 60; i += 1) run.advance(up);
    const c = run.crushers.get(A);
    console.log('\n## the permissive ordering\'s first escape, DRIVEN');
    console.log(`   player ${y0.toFixed(2)} -> ${run.state.y.toFixed(2)} `
        + `(${(y0 - run.state.y).toFixed(2)} px north), A at (${c.x},${c.y}), `
        + `${run.crusherContacts.length} contact(s)`);
    check(run.crusherContacts.length > 0 && y0 - run.state.y < 20,
        '⛔⛔⛔ THE PERMISSIVE READING\'S FIRST ESCAPE IS RUN OVER — 48 contacts, 14 px',
        `${run.crusherContacts.length} contact(s), ${(y0 - run.state.y).toFixed(2)} px of `
        + `northward travel, first contact at t${run.crusherContacts[0]?.t}. The player `
        + 'needs 35 px to clear rows 9,10 and A\'s left edge is 6 px away, so the body '
        + 'arrives first and then BLOCKS the rest of the climb — `Crusher.solids` is '
        + '`["Solid"]` so it moves THROUGH the player, and the player\'s own sweep '
        + 'refuses to move INTO it. ⇒ the six-charge ordering is geometrically real and '
        + 'physically impossible, and only the drive can tell the difference.');
}

/**
 * ⛓⛓⛓ CHAIN 1, DRIVEN — AND ITS THIRD CHARGE ENDS IN THE WRONG REGION.
 *
 * The pessimistic ordering's first three charges are one `bait` chain, and
 * the spans for it are SEARCHED rather than guessed: a beam over 8-tick
 * blocks, driven through the same `stepCrusher` the run steps, scored on
 * the crusher's own progress with the player's clearance as the tie-break —
 * and the tie-break is the whole choreography, because once a charge is
 * committed every candidate has the SAME crusher and a score made only of
 * crusher progress ties across the beam.
 *
 * Driven, A walks its three charges in 216 ticks with ZERO contacts. And
 * the player finishes at tile (15,13), which is the wrong side of it:
 *
 *   A's east charge from `(80,224)` has exactly two escapes. SOUTH at col 6
 *   is the only southern exit from its 64 px east lane, and it is worth
 *   `x - 98` ticks of margin — between 2 and 12, depending where in the
 *   16 px tile the player stands. EAST is outrunning the body along row 13,
 *   which always works and always ends behind it, because row 14 is wall at
 *   cols 13,14 and the parked body plugs cols 11,12.
 *
 * ⚠ NOT FOUND IS NOT IMPOSSIBLE, and the bound is stated: two beams (48
 * wide over 8-tick blocks to depth 27, and 64 wide over 4-tick blocks),
 * zero contacts and zero throws in both, found no escape ending in the west
 * region. A ~10 px window in one tile is exactly the size a block search
 * steps over.
 */
{
    const run = createLevelRun({
        levelSource, boot: { level: 42, ...L42_SOLVE.chain1.boot }, inventory: held, noDamage: true,
    });
    for (const span of L42_SOLVE.chain1.spans) {
        const keys = span.key ? new Set(span.key.split('+')) : new Set();
        for (let i = 0; i < span.ticks; i += 1) run.advance(keys);
    }
    for (let i = 0; i < 200; i += 1) run.advance(new Set());
    const c = run.crushers.get(A);
    console.log('\n## chain 1, driven');
    console.log(`   ${L42_SOLVE.chain1.ticks} ticks, ${L42_SOLVE.chain1.spans.length} spans — `
        + `A ends (${c.x},${c.y}), ${run.crusherContacts.length} contact(s), player `
        + `(${run.state.x.toFixed(2)},${run.state.y.toFixed(2)}) tile `
        + `(${Math.floor(run.state.x / TILE_SIZE)},${Math.floor(run.state.y / TILE_SIZE)})`);
    check(c.x === L42_SOLVE.chain1.park.x && c.y === L42_SOLVE.chain1.park.y
        && run.crusherContacts.length === L42_SOLVE.chain1.contacts,
        '⛓⛓⛓ CHAIN 1 IS DRIVEN — three charges, one choreography, ZERO contacts',
        `A (${c.x},${c.y}) against the searched park `
        + `(${L42_SOLVE.chain1.park.x},${L42_SOLVE.chain1.park.y}), `
        + `${run.crusherContacts.length} contact(s). ⛓ The first three-charge chain on `
        + 'the arc driven to a park a SEARCH chose rather than a hand trace, and it '
        + 'survives the 200 idle ticks after it — a park is a position and a live '
        + 'scanner, so staying there is its own claim.');
    const west = run.state.x < 112 || (run.state.y >= 240 && run.state.x < 208);
    check(west === L42_SOLVE.chain1.endsInWestRegion && west === false,
        '⛔⛔⛔ …AND THE PLAYER FINISHES ON THE WRONG SIDE OF IT — tile (15,13)',
        `player (${run.state.x.toFixed(2)},${run.state.y.toFixed(2)}), in the west region `
        + `${west}. A's east charge is escapable SOUTH at col 6 (2-12 ticks of margin, `
        + 'the only southern exit from its lane) or EAST along row 13 (always, and always '
        + 'behind it). Row 14 is wall at cols 13,14, so the parked body plugs the only '
        + 'way back and `totempart 4` is west of it. ⇒ THE ORDERING IS NOT YET A '
        + 'CHOREOGRAPHY, and this is the link that has to give.');
}

/**
 * ⛔⛔ AND THE BANKED SIX-BAIT ORDERING IS REFUTED BY THE COST FUNCTION.
 *
 * `L42_PART4.orderingSearched` is slice 16's component result and it does
 * clear the corridor. Replayed here as a configuration, the part is in the
 * player's component and the teleporter is NOT — the two parks at cols
 * 9..12 rows 13,14 ARE the return corridor. A search that stops at "the
 * part is reachable" reports it as a win.
 */
{
    const cfg = { ...HOME };
    for (const step of L42_PART4.orderingSearched) cfg[step.id] = { ...step.park };
    // Seed from the part pocket, which is where that ordering leaves the player able to go.
    const pocket = nodeAt(PART.x + 8, PART.y + 8);
    const comp = componentOf(pocket, cfg);
    console.log('\n## the banked ordering, priced for the return');
    console.log(`   A -> (${cfg[A].x},${cfg[A].y}), B -> (${cfg[B].x},${cfg[B].y})`);
    console.log(`   component ${comp.size} safe nodes, part ${holdsPart(comp)}, `
        + `exit ${reachesExit(pocket, cfg)}`);
    check(holdsPart(comp) === L42_SOLVE.bankedOrderingPriced.partReachable
        && reachesExit(pocket, cfg) === L42_SOLVE.bankedOrderingPriced.exitReachable
        && comp.size === L42_SOLVE.bankedOrderingPriced.safeNodes,
        '⛔⛔ THE SLICE-16 ORDERING OPENS THE PART AND SEALS THE EXIT — a FAILED state',
        `part in component ${holdsPart(comp)}, exit reachable ${reachesExit(pocket, cfg)}. `
        + 'Both crushers finish in the row-13/14 corridor (cols 9,10 and 11,12), which is '
        + 'the ONLY way from the west corridor back to the col-15 shaft and the '
        + 'teleporter — and the row-17 bypass rejoins it at col 12, inside the same two '
        + 'bodies. ⇒ A COMPONENT RESULT IS NOT A ROUTE: the cost function is the round '
        + 'trip, and a search that prices only the reach reports this as a win.');
}

if (MAP) {
    const draw = (cfg, title) => {
        console.log(`\n## ${title}   (# blocked, . safe, E/N/W/S seen, o part, x exit)`);
        for (let b = 0; b < ny; b += 1) {
            let line = '';
            for (let a = 0; a < nx; a += 1) {
                const n = b * nx + a;
                const box = playerBoxAt(cellX(n), cellY(n));
                if (overlaps(box, PART.rect)) { line += 'o'; continue; }
                if (overlaps(box, EXIT.rect)) { line += 'x'; continue; }
                if (!freeAt(n, cfg)) { line += '#'; continue; }
                let d = null;
                for (const i of IDS) d = scanAt(i, n, cfg).dir ?? d;
                line += d ?? '.';
            }
            console.log(`${String(b).padStart(3)} ${line}`);
        }
    };
    draw(HOME, 'the room at t0');
    if (solutions.length) draw(solutions[0].cfg, 'the room after the ordering');
}

let bad = 0;
console.log('');
for (const c of checks) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${checks.length} claims FAILED`);
console.log('\n(a search — the CHECK is `plan-seedling-r5-l42-part4.mjs` driving the '
    + 'ordering through the real models)');
