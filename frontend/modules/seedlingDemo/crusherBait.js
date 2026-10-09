/**
 * seedlingDemo/crusherBait — ⛓⛓⛓ SEEDLING FIDELITY CRUSHER: THE `bait` VERB AS A
 * SOLVER ROW, built from R5's machinery rather than re-derived.
 *
 * `OBSTACLE_STRATEGIES['solid:crusher']` has named `bait` since FRONTIER3, and
 * the route survey's step 85 (L42) refused on it: *"Strategy 'bait' is SELECTED
 * but not registered this slice"*. Everything the verb needs already existed,
 * in three places that had never met:
 *
 *   THE PROPOSER     `probe-seedling-r5-l42-solver.mjs` — a blind BFS over
 *                    `(parks, player component, hot)` whose player graph is the
 *                    SAFE cells (a cell a crusher can see is a charge, not a
 *                    floor) and whose goal is the ROUND TRIP (R5 slice 17: a park
 *                    that opens the reach and seals the way back is a FAILED
 *                    state). Ported here, generalised from "A and B" to the
 *                    room's own crusher list, and fed the run's live geometry.
 *   THE CHOREOGRAPHY `r5Totem.L42_SOLVE` — the three chains' `{approach, spans}`,
 *                    found by R5's beam searches (8-tick blocks, per-stage walls,
 *                    ~15 minutes each) and driven byte-exact on the game
 *                    (`r5-l42-part4`). A search that slow is not an in-solver
 *                    search, so a chain is LOOKED UP (`BAIT_CHOREOGRAPHIES`) by
 *                    what the proposer asks of it — crusher, start park, charge
 *                    directions, end park — and a chain with no row is a NAMED
 *                    refusal (the work order is that chain's beam search).
 *   THE VERB         `botDriverV2.runBait` — the positive control (awake after
 *                    the approach), the move, the park as a POSITION, and zero
 *                    contacts. Unchanged; it is the oracle for every chain.
 *
 * ⛔⛔ AND THE ONE NEW THING IS THE **ALIGNMENT**, MEASURED BEFORE IT WAS BUILT.
 * A choreography is a list of held spans searched from ONE start state (the
 * stance `synthesizeLegs`' walk ended at). Re-driven from a perturbed start
 * (tape prefix to the bait tick, then the player nudged): chain 1 survives
 * dy ∈ [-1, 1], chain 2 dy ∈ [-3, 0.5], chain 3 only |dx| ≤ 0.2, |dy| ≤ 0.4 —
 * and the solver's own walk to the stance is a different walk. So before each
 * chain the player is steered at rest to within `BAIT_ALIGN.tol` of the
 * choreography's start (a best-first search over tap-then-coast moves on the
 * run's own `previewStepper`, every previewed tick outside every live lane),
 * and only then is the chain driven.
 *
 * ⚖ BEHIND `CRUSHER_BAIT` — ON by default since the wave-9 harvest (user, 2026-10-09; its one mover: the ENEMY census's
 * synthetic `crusher` row's refusal TEXT). `SEEDLING_CRUSHER_BAIT=0` turns it off; with the flag off nothing in this
 * module is reached and the BEFORE model is byte-identical. The flag also turns on the sight-aware crusher danger
 * (`crusherSightDanger`), which the walks between chains need: `dangerMap`
 * prices all four lanes through walls, and a lane a crusher cannot SEE down is
 * not a trigger (`scanCrusher`'s early exit).
 */

import { plannerObstacleAt } from './botDriverV2.js';
// ⛓ the solver family's import door (`seedling-solver-surface.json`).
import {
    CRUSHER, DIRECTIONS, TILE_SIZE, crusherRect, playerBoxAt, scanCrusher,
} from './solverView.js';

export class CrusherBaitError extends Error {
    constructor(message) { super(message); this.name = 'CrusherBaitError'; }
}
const fail = (m) => { throw new CrusherBaitError(m); };

/**
 * ⚖ THE FLAG — `HAMMER_ESCAPE`'s shape. A mutable record so a test or a
 * measurement can flip it in-process (`withCrusherBait`); the env var is the
 * CLI/survey switch.
 */
export const CRUSHER_BAIT = { enabled: globalThis.process?.env?.SEEDLING_CRUSHER_BAIT !== '0' };

export function withCrusherBait(enabled, fn) {
    const prior = CRUSHER_BAIT.enabled;
    CRUSHER_BAIT.enabled = Boolean(enabled);
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            return out.finally(() => { CRUSHER_BAIT.enabled = prior; });
        }
        CRUSHER_BAIT.enabled = prior;
        return out;
    } catch (e) {
        CRUSHER_BAIT.enabled = prior;
        throw e;
    }
}

/**
 * The search's bounds, named. `lattice` is the probe's own 8 px; `maxStates`
 * bounds the BFS (L42's pessimistic answer expands a few hundred states).
 */
export const BAIT_SEARCH = Object.freeze({ lattice: 8, maxStates: 20000 });

/**
 * The alignment's bounds (`alignmentCandidates`): `maxTicks` is one move's
 * hold, `coast` the settle after it, `maxMoves` the moves per candidate, `beam`
 * how many of the nearest grow another move, `candidates` how many the
 * executor may try on a fork. POLICY bounds, each named in a refusal.
 */
export const BAIT_ALIGN = Object.freeze({ maxTicks: 6, coast: 40, maxMoves: 3, beam: 24, candidates: 48 });

const overlaps = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;

/**
 * ⛓ THE LIVE SCAN, for the danger probe — `scanCrusher` against the run's own
 * solid list, for every crusher at rest. A charging crusher is reported by its
 * BODY sweep elsewhere (`dangerMap`'s body arm); a crusher at rest is a danger
 * exactly where it would CHARGE, which is `scan.dir !== null` (sight first,
 * then the four inclusive lanes, last match wins).
 */
export function crusherSightDanger(run, box, point, solidsFor) {
    const out = [];
    const live = run.entities('crushers');
    if (!live) return out;
    // ⚠ `run.entities('crushers')` carries positions, not velocities: whether any
    // body is mid-charge is the run's own `crushersParked`, and while one is,
    // every stance is priced as danger (a plan against a moving body is unsound).
    const parked = run.entities('crushersParked');
    for (const [id, c] of live) {
        const body = crusherRect(c);
        if (overlaps(box, body)) {
            out.push({ kind: 'crusher', id, why: `the 32x32 body — damage 1000 (LIVE centre ${c.x},${c.y})` });
            continue;
        }
        if (!parked) {
            out.push({ kind: 'crusher', id, why: `a crusher in the room is CHARGING (this one's LIVE centre ${c.x},${c.y}) — a plan against a moving body is not sound` });
            continue;
        }
        const scan = scanCrusher({ x: c.x, y: c.y }, box, point, solidsFor(id));
        if (scan.dir !== null) {
            out.push({ kind: 'crusher', id, why: `trigger lane ${scan.dir} with a clear sight line (LIVE centre ${c.x},${c.y})` });
        }
    }
    return out;
}

/**
 * ⛓⛓⛓ THE ROOM, as the search sees it: the crusher ids, their live parks, and
 * every OTHER Solid (the run's own list with every crusher taken out, so a
 * hypothetical configuration adds its own bodies back).
 */
export function baitRoom(run, liveOpts) {
    const live = run.entities('crushers');
    if (!live || live.size === 0) return null;
    const ids = [...live.keys()].sort();
    const home = Object.fromEntries(ids.map((id) => [id, { x: live.get(id).x, y: live.get(id).y }]));
    const idSet = new Set(ids);
    const staticSolids = run.world.solidBoxesForMover(liveOpts, null)
        .filter((b) => !idSet.has(b.id));
    return { ids, home, staticSolids };
}

/**
 * ⛓⛓⛓ THE PROPOSER — `probe-seedling-r5-l42-solver.mjs`'s pessimistic BFS,
 * transcribed and generalised. The laws are the probe's, each named there:
 *
 *   · a STANCE is a free cell 4-adjacent to the player's safe component at
 *     which `scanCrusher` returns the intended direction for the intended
 *     crusher and null for every other one;
 *   · an ESCAPE is a cell outside the charge's swept volume, reached from the
 *     stance through cells free with the mover ABSENT and outside every OTHER
 *     crusher's lanes (their sight taken with the mover absent — the
 *     pessimistic reading, the only one a positive may ride on);
 *   · an escape the mover still sees is HOT — its only legal move is the bait
 *     that crusher is committed to (a chain);
 *   · the goal is the ROUND TRIP: the aim reachable AND `keep` (the cell the
 *     bait began from) still in the player's component.
 *
 * ⚠ The escape is not TIMED — the one optimism, declared. The check is the
 * drive: `runBait` against the run's own `stepCrusher`.
 *
 * @param {object} p
 * @param {object} p.run
 * @param {object} p.liveOpts      the run's live geometry bag (crushers overridden per config)
 * @param {object} p.inventory
 * @param {object} p.aimRect       a rect the player box must overlap (the pickup, the trigger)
 * @param {number|null} p.allowTeleporter  the teleporter index the aim enters, if any
 * @returns {{ordering, chains, stats} | {ordering: null, stats, why}}
 */
export function searchBaitOrdering({ run, liveOpts, inventory = null, aimRect,
    allowTeleporter = null, maxStates = BAIT_SEARCH.maxStates }) {
    const room = baitRoom(run, liveOpts);
    if (!room) return { ordering: null, stats: { expanded: 0 }, why: 'the room holds no crusher' };
    const { ids, home, staticSolids } = room;
    const world = run.world;
    const P = BAIT_SEARCH.lattice;
    const nx = Math.floor(world.world.width / P);
    const ny = Math.floor(world.world.height / P);
    const cellX = (n) => (n % nx) * P + P / 2;
    const cellY = (n) => Math.floor(n / nx) * P + P / 2;
    const nodeOf = (px, py) => Math.floor(py / P) * nx + Math.floor(px / P);
    const cfgKey = (cfg) => ids.map((id) => `${cfg[id].x},${cfg[id].y}`).join('|');
    const memo = new Map();
    const cacheFor = (cfg) => {
        const k = cfgKey(cfg);
        let c = memo.get(k);
        if (!c) {
            c = {
                cfg,
                line: Object.fromEntries(ids.map((self) => [self, [...staticSolids,
                    ...ids.filter((i) => i !== self && cfg[i].x > -500).map((i) => crusherRect(cfg[i]))]])),
                live: null,
                opts: null,
                free: new Map(),
                bare: new Map(),
                scan: Object.fromEntries(ids.map((i) => [i, new Map()])),
            };
            memo.set(k, c);
        }
        return c;
    };
    const liveMap = (cfg) => new Map(ids.filter((id) => cfg[id].x > -500).map((id) => [id, {
        id, rect: crusherRect(cfg[id]), x: cfg[id].x, y: cfg[id].y,
    }]));
    // ⚠ each takes the configuration's CACHE, not the configuration: a flood asks
    // thousands of cells of one configuration, and keying the memo per cell cost
    // two thirds of the search (measured: `cfgKey` + `cacheFor` 6.9 of 14.4 s).
    const freeIn = (c, n, tp = null) => {
        const k = tp === null ? n : `t${n}`;
        let v = c.free.get(k);
        if (v === undefined) {
            if (c.opts === null) {
                c.live = liveMap(c.cfg);
                c.opts = { ...liveOpts, avoidVolumes: false, ...(inventory ? { inventory } : {}), crushers: c.live };
            }
            v = plannerObstacleAt(world, cellX(n), cellY(n), tp, c.opts) === null;
            c.free.set(k, v);
        }
        return v;
    };
    const scanIn = (c, self, n) => {
        let v = c.scan[self].get(n);
        if (v === undefined) {
            v = scanCrusher(c.cfg[self], playerBoxAt(cellX(n), cellY(n)),
                { x: cellX(n), y: cellY(n) }, c.line[self]);
            c.scan[self].set(n, v);
        }
        return v;
    };
    const freeAt = (n, cfg, tp = null) => freeIn(cacheFor(cfg), n, tp);
    const scanAt = (self, n, cfg) => scanIn(cacheFor(cfg), self, n);
    const safeIn = (c, n) => freeIn(c, n) && ids.every((i) => scanIn(c, i, n).dir === null);
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
    const charge = (self, dir, cfg) => {
        const d = DIRECTIONS.find((x) => x.name === dir);
        const blockers = cacheFor(cfg).line[self];
        let { x, y } = cfg[self];
        for (let guard = 0; guard < 4096; guard += 1) {
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
                x: Math.min(from.x, to.x), y: Math.min(from.y, to.y),
                right: Math.max(from.right, to.right), bottom: Math.max(from.bottom, to.bottom),
            },
        };
    };
    const start = nodeOf(run.state.x, run.state.y);
    const componentOf = (seed, cfg) => { const c = cacheFor(cfg); return floodOver(seed, (n) => safeIn(c, n)); };
    const reachesAim = (seed, cfg) => {
        const c = cacheFor(cfg);
        const walk = floodOver(seed, (n) => (freeIn(c, n, allowTeleporter)
            && ids.every((i) => scanIn(c, i, n).dir === null)));
        return [...walk].some((n) => overlaps(playerBoxAt(cellX(n), cellY(n)), aimRect));
    };
    const stancesFor = (self, dir, cfg, state) => {
        const out = [];
        const others = ids.filter((i) => i !== self);
        if (state.hot) {
            if (state.hot !== self) return out;
            if (scanAt(self, state.seed, cfg).dir !== dir) return out;
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
                if (scanAt(self, m, cfg).dir !== dir) continue;
                if (others.some((o) => scanAt(o, m, cfg).dir !== null)) continue;
                out.push(m);
            }
        }
        return out;
    };
    const escapesFrom = (self, stance, cfg, next, swept) => {
        const others = ids.filter((i) => i !== self);
        const cfgNoSelf = { ...cfg, [self]: { x: -1000, y: -1000 } };
        const otherLine = Object.fromEntries(others.map((o) => [o, [...staticSolids,
            ...others.filter((i) => i !== o).map((i) => crusherRect(cfg[i]))]]));
        // ⚠ memoised on the configuration and the mover, as the probe's `bareScan` was
        const bareKey = `${cfgKey(cfg)}#${self}`;
        const memoC = cacheFor(cfg);
        let bare = memoC.bare.get(bareKey);
        if (!bare) { bare = new Map(); memoC.bare.set(bareKey, bare); }
        const cNoSelf = cacheFor(cfgNoSelf);
        const passable = (n) => {
            if (!freeIn(cNoSelf, n)) return false;
            let v = bare.get(n);
            if (v === undefined) {
                v = others.every((o) => scanCrusher(cfg[o], playerBoxAt(cellX(n), cellY(n)),
                    { x: cellX(n), y: cellY(n) }, otherLine[o]).dir === null);
                bare.set(n, v);
            }
            return v;
        };
        const reach = floodOver(stance, (n) => (n === stance ? true : passable(n)));
        const out = [];
        for (const n of reach) {
            if (overlaps(playerBoxAt(cellX(n), cellY(n)), swept)) continue;
            if (!freeAt(n, next)) continue;
            const sees = ids.filter((i) => scanAt(i, n, next).dir !== null);
            if (sees.length === 0) out.push({ n, hot: null });
            else if (sees.length === 1 && sees[0] === self) out.push({ n, hot: self });
        }
        return out;
    };
    const keyOf = (cfg, region, hot) => `${cfgKey(cfg)}|${hot ?? '-'}|${Math.min(...region)}`;
    const startComp = componentOf(start, home);
    if (startComp.size === 0) {
        return { ordering: null, stats: { expanded: 0 },
            why: `the player's own cell (${run.state.x.toFixed(2)},${run.state.y.toFixed(2)}) is not SAFE — a crusher can see it` };
    }
    const first = { cfg: home, region: startComp, seed: start, hot: null, path: [] };
    const seenStates = new Map([[keyOf(home, startComp, null), first]]);
    const queue = [first];
    let expanded = 0;
    let found = null;
    while (queue.length) {
        if (expanded >= maxStates) {
            return { ordering: null, stats: { expanded, distinct: seenStates.size, bound: true },
                why: `the ordering search hit BAIT_SEARCH.maxStates = ${maxStates}` };
        }
        const state = queue.shift();
        expanded += 1;
        if (!state.hot && state.path.length > 0 && state.region.has(start)
            && reachesAim(state.seed, state.cfg)) {
            found = state;
            break;
        }
        for (const self of ids) {
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
                        const k = keyOf(next, region, hot);
                        if (seenStates.has(k)) continue;
                        const node = {
                            cfg: next, region, seed: e, hot,
                            path: [...state.path, {
                                id: self, dir: d.name, from: { ...state.cfg[self] }, park, travel, hot,
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
    const stats = { expanded, distinct: seenStates.size, startSafeNodes: startComp.size };
    if (!found) {
        return { ordering: null, stats,
            why: 'no ordering of charges opens the aim AND keeps the cell the bait began from in reach '
                + '(the round trip) — the searched space is exhausted' };
    }
    return { ordering: found.path, chains: chainsOf(found.path), stats, parks: found.cfg };
}

/**
 * A chain is one crusher's consecutive charges whose every escape but the last
 * is HOT to it — one `bait` verb (§30.8's shape). The stance is the first
 * charge's.
 */
export function chainsOf(ordering) {
    const out = [];
    let cur = null;
    for (const step of ordering) {
        if (cur && cur.id === step.id && cur.open) {
            cur.charges.push(step.dir);
            cur.park = step.park;
            cur.open = step.hot === step.id;
            continue;
        }
        cur = { id: step.id, from: step.from, charges: [step.dir], park: step.park,
            stance: step.stance, open: step.hot === step.id };
        out.push(cur);
    }
    return out.map(({ open, ...c }) => c);
}

/**
 * ⛓⛓⛓ THE CHOREOGRAPHY LIBRARY — R5's three L42 chains, keyed by what the
 * proposer asks of a chain. `start` is the player's ENTITY position at rest on
 * the bait's first tick in `r5-l42-part4` (the state the beam searched from,
 * read off the committed tape), and `stance` is the tile the walk aims for.
 */
const libraryRow = (r) => Object.freeze({
    src: r.src,
    level: r.level,
    crusher: r.crusher,
    from: Object.freeze({ ...r.from }),
    charges: Object.freeze([...r.charges]),
    park: Object.freeze({ ...r.park }),
    stance: Object.freeze({ x: r.stanceTile.tx * TILE_SIZE + TILE_SIZE / 2, y: r.stanceTile.ty * TILE_SIZE + TILE_SIZE / 2 }),
    start: Object.freeze({ ...r.start }),
    approach: r.approach,
    spans: r.spans,
});
/**
 * ⚠ A SECOND SPELLING, HELD TO THE FIRST: the spans are `r5Totem.L42_SOLVE`'s
 * (`escape`, `chain2`, `chain3`), written out here because the solver family
 * imports only family files and the simulation door (`solverView.js`), and
 * `r5Totem.js` is neither. `fidelityCrusher.test.js` asserts every row equals
 * its `src` field for field.
 */
export const BAIT_CHOREOGRAPHIES = Object.freeze([
    libraryRow({
        src: 'L42_SOLVE.escape',
        level: 42,
        crusher: 'crusher@96,144',
        from: { x: 112, y: 160 },
        charges: ['W', 'S', 'E'],
        park: { x: 192, y: 224 },
        stanceTile: { tx: 4, ty: 11 },
        start: { x: 72.01589131258784, y: 184.18810535689406 },
        approach: Object.freeze([
            Object.freeze({ key: 'up', ticks: 7 }),
        ]),
        spans: Object.freeze([
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: 'down+right', ticks: 16 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: 'down+right', ticks: 8 }),
            Object.freeze({ key: null, ticks: 8 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: null, ticks: 8 }),
            Object.freeze({ key: 'right', ticks: 8 }),
            Object.freeze({ key: null, ticks: 16 }),
            Object.freeze({ key: 'right', ticks: 16 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: null, ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: null, ticks: 72 }),
        ]),
    }),
    libraryRow({
        src: 'L42_SOLVE.chain2',
        level: 42,
        crusher: 'crusher@128,144',
        from: { x: 144, y: 160 },
        charges: ['W', 'N', 'E'],
        park: { x: 240, y: 96 },
        stanceTile: { tx: 4, ty: 11 },
        start: { x: 72.68107686370016, y: 184.46294906251578 },
        approach: Object.freeze([
            Object.freeze({ key: 'up', ticks: 7 }),
        ]),
        spans: Object.freeze([
            Object.freeze({ key: 'up', ticks: 33 }),
            Object.freeze({ key: null, ticks: 24 }),
            Object.freeze({ key: 'up+right', ticks: 24 }),
            Object.freeze({ key: 'right', ticks: 8 }),
            Object.freeze({ key: 'left', ticks: 8 }),
            Object.freeze({ key: 'right', ticks: 8 }),
            Object.freeze({ key: 'left', ticks: 8 }),
            Object.freeze({ key: 'right', ticks: 8 }),
            Object.freeze({ key: 'up+left', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: 'up+left', ticks: 8 }),
            Object.freeze({ key: 'down+right', ticks: 8 }),
            Object.freeze({ key: 'left', ticks: 8 }),
            Object.freeze({ key: null, ticks: 24 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 16 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: null, ticks: 16 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'down', ticks: 16 }),
        ]),
    }),
    libraryRow({
        src: 'L42_SOLVE.chain3',
        level: 42,
        crusher: 'crusher@96,144',
        from: { x: 192, y: 224 },
        charges: ['W', 'N', 'E'],
        park: { x: 208, y: 96 },
        stanceTile: { tx: 5, ty: 13 },
        start: { x: 88.40350807352499, y: 216.36214585590002 },
        approach: Object.freeze([
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: 'down+right', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 3 }),
        ]),
        spans: Object.freeze([
            Object.freeze({ key: 'up+right', ticks: 5 }),
            Object.freeze({ key: 'down+left', ticks: 8 }),
            Object.freeze({ key: 'up+left', ticks: 24 }),
            Object.freeze({ key: 'up', ticks: 24 }),
            Object.freeze({ key: 'up+left', ticks: 8 }),
            Object.freeze({ key: 'right', ticks: 8 }),
            Object.freeze({ key: null, ticks: 16 }),
            Object.freeze({ key: 'left', ticks: 8 }),
            Object.freeze({ key: 'right', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 16 }),
            Object.freeze({ key: null, ticks: 80 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'down', ticks: 16 }),
            Object.freeze({ key: null, ticks: 104 }),
        ]),
    }),
]);

export function choreographyFor(level, chain) {
    return BAIT_CHOREOGRAPHIES.find((r) => r.level === level && r.crusher === chain.id
        && r.from.x === chain.from.x && r.from.y === chain.from.y
        && r.park.x === chain.park.x && r.park.y === chain.park.y
        && r.charges.join('') === chain.charges.join('')) ?? null;
}

const ALIGN_KEYS = Object.freeze([
    ['up'], ['down'], ['left'], ['right'],
    ['up', 'left'], ['up', 'right'], ['down', 'left'], ['down', 'right'],
]);

/**
 * ⛓⛓ THE ALIGNMENT CANDIDATES — rest states the player can reach from here in
 * at most `maxMoves` MOVES (hold one of eight key sets for 1..`maxTicks` ticks,
 * then nothing until at rest), on the run's own `previewStepper`, every
 * previewed tick checked by `safe(p)` (the caller's: outside every live lane).
 * Returned nearest-to-`target` first, the current state (zero moves) included.
 *
 * ⛔ WHY CANDIDATES AND NOT "ALIGN TO THE START". Measured: a rest state is
 * quantised — one tap moves 1.70 px, two to four 5.15, five or six 8.75 — so a
 * sub-pixel target is out of reach in any short sequence; and a choreography's
 * tolerance is NOT a box (chain 2 survives dy ∈ [-3, 0.5] at most x offsets
 * and fails at a periodic set of them: -2.75, -1.25, -0.25, 0.75, 1.75 …). So
 * the CHAIN ITSELF is the test: the executor drives each candidate's prefix and
 * the chain on a fork, and commits the first one the fork says survives.
 */
export function alignmentCandidates(run, target, safe, bounds = BAIT_ALIGN) {
    const step = run.previewStepper();
    const NONE = new Set();
    const off = (p) => Math.hypot(p.x - target.x, p.y - target.y);
    const settle = (p, ticks) => {
        let q = p;
        for (let i = 0; i < bounds.coast && (q.vx !== 0 || q.vy !== 0); i += 1) {
            q = step(q, NONE);
            ticks.push(NONE);
            if (!safe(q)) return null;
        }
        return (q.vx === 0 && q.vy === 0) ? q : null;
    };
    const t0 = [];
    const s0 = settle({ ...run.state }, t0);
    if (!s0) return [];
    const out = [{ ticks: t0, at: { x: s0.x, y: s0.y }, moves: 0 }];
    const seen = new Set([`${s0.x.toFixed(4)},${s0.y.toFixed(4)}`]);
    let frontier = [out[0]];
    for (let m = 1; m <= bounds.maxMoves; m += 1) {
        const next = [];
        for (const cur of frontier) {
            for (const keys of ALIGN_KEYS) {
                const held = new Set(keys);
                let p = { ...run.state, x: cur.at.x, y: cur.at.y, vx: 0, vy: 0 };
                const ticks = [...cur.ticks];
                for (let n = 1; n <= bounds.maxTicks; n += 1) {
                    p = step(p, held);
                    ticks.push(held);
                    if (!safe(p)) break;
                    const t2 = [...ticks];
                    const rest = settle(p, t2);
                    if (!rest) continue;
                    const k = `${rest.x.toFixed(4)},${rest.y.toFixed(4)}`;
                    if (seen.has(k)) continue;
                    seen.add(k);
                    const c = { ticks: t2, at: { x: rest.x, y: rest.y }, moves: m };
                    out.push(c);
                    next.push(c);
                }
            }
        }
        // keep the move tree bounded: only the nearest grow another move
        next.sort((a, b) => off(a.at) - off(b.at));
        frontier = next.slice(0, bounds.beam);
    }
    out.sort((a, b) => off(a.at) - off(b.at) || a.ticks.length - b.ticks.length);
    return out.slice(0, bounds.candidates);
}
