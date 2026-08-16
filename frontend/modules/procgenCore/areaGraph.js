/**
 * procgenCore/areaGraph — **THE LOCK-AND-KEY LAYER, SUBSTRATE-FREE.** A JS
 * re-implementation of MetaZelda's dungeon logic over an ABSTRACT space.
 *
 * PROCGEN ELEMENTS arc 1, slice 1 (`NewDocs/plans/procgen-elements-arc1-
 * kickoff.md` §3.1; design `procgen-elements-design.md` §3.2, §4.1). Areas and
 * their adjacency come IN; a tree of key levels, locked edges, keys, intensity
 * and `graphify`'s extra edges come OUT, as plain JSON. It knows nothing about
 * grids, tiles, corridors, doors, items or either substrate: the maze binding
 * (slice 2) is what turns a symbol into a `door_K` obstacle, and Seedling's
 * binding (arc 3) turns the same symbol into something else entirely.
 *
 * ── ATTRIBUTION ───────────────────────────────────────────────────────
 *
 * **MetaZelda** — Tom Coxon, BSD-3-clause, cloned to `~/CC/metazelda` (⚖ design
 * ruling 14: re-implement, do not depend on — it is Java + Eclipse + the
 * author's `gameutil`, and we need our seeded rng, JSON out, and ~6 functions).
 * The logic below is a port of `src/net/bytten/metazelda/generators/
 * DungeonGenerator.java` (+ `Condition.java`, `Symbol.java`), function by
 * function:
 *
 * | MetaZelda | here | note |
 * |---|---|---|
 * | `Condition` (keyLevel + switchState) | `condOf`/`condAnd*`/`condImplies`/`singleSymbolDifference` | ported whole, incl. the "one symbol difference" arithmetic |
 * | `Symbol` values | `SYM` + `symbolName` | `K0`,`K1`… / `START` `GOAL` `SW` `ON` `OFF`; ⛔ no `BOSS` |
 * | `initEntranceRoom` | — | ⚠ DEVIATION: the entrance is GIVEN, so its draw is not spent |
 * | `chooseRoomWithFreeEdge` | `chooseAreaWithFreeEdge` | shuffle, then the first with an unassigned neighbour |
 * | `chooseFreeEdge` | `chooseFreeEdge` | shuffle-then-pick-then-remove, verbatim (see its comment) |
 * | `shouldAddNewLock` | `shouldAddNewLock` | `numAreas >= areasPerLock && keyLevel < maxKeys` |
 * | `placeRooms` | `placeAreas` | grows over the GIVEN adjacency |
 * | `placeBossGoalRooms` | — | ⛔ NOT PORTED (⚖ arc ruling 2); see DEVIATIONS |
 * | `placeSwitches` / `switchLockChildRooms` / `removeDescendantsFromList` / `addPrecond` | same names | ported; INERT at `maxSwitches: 0` (⚖ arc ruling 1) |
 * | `getSolutionPath` | `solutionPathOf` | ⚠ returned entrance-first, not goal-first |
 * | `computeIntensity` / `applyIntensity` / `normalizeIntensity` | same names | jitter constants kept (0.1 / 0.2) |
 * | `placeKeys` | `placeKeys` | shuffle, then a STABLE sort by intensity |
 * | `graphify` | `graphify` | the one-symbol law, VERBATIM |
 * | `checkAcceptable` | `checkAcceptable` | ⚠ ours is ⚖ ruling 2's goal-at-top-level |
 * | `generate()`'s retry | `buildAreaGraph`'s attempt loop | ⛔ BOUNDED and REFUSING, never a throw — see below |
 *
 * ── ⛔ WHAT IS **NOT** PORTED, AND WHY ────────────────────────────────
 *
 * 1. **`generate()`'s unbounded retry.** MetaZelda loops until `checkAcceptable`
 *    passes and throws `GenerationFailureException` past `maxRetries`; worse,
 *    its inner loop halves `roomsPerLock` on `OutOfRoomsException` and retries
 *    again. ⚖ Arc ruling 4: *every bound is NAMED and the failure is a REFUSED
 *    run.* So `maxRetries` is a declared bound, the attempts are
 *    `maxRetries + 1`, and past it this returns `{refused: {reason, …}}` with
 *    the draws it spent — a legitimate "no acceptable graph here" is DATA, not
 *    an exception. (Malformed INPUT still throws `AreaGraphError`: an unknown
 *    area id is a caller defect, not a fact about lock-and-key graphs.)
 * 2. **`SpaceMap` / `ColorMap` / `IDungeonConstraints`' geometry.** ⚖ Design
 *    ruling 15 + §4.1: the SPACE IS THE CALLER'S. `getAdjacentRooms(id,
 *    keyLevel)` becomes the caller's `adjacency`, key-level-INDEPENDENT (which
 *    also removes MetaZelda's `OutOfRoomsException`, whose whole cause was
 *    adjacency that appears only above some key level — "a river bisects the
 *    map"); `getCoords` has no analogue (an area has no coordinates here);
 *    `edgeGraphifyProbability(a, b)` becomes the constant
 *    `bounds.graphifyProbability`, exactly as MetaZelda's own
 *    `CountConstraints` returns 0.2 for every pair; `roomCanFitItem` becomes
 *    the caller's per-area `capacity`.
 * 3. **The BOSS room.** MetaZelda reserves the last key for a boss and bumps
 *    the goal's key level to create it. We have no boss (⚖ design §5 row 20:
 *    bosses are out of scope for generated rooms), so `usableKeys` is `maxKeys`
 *    rather than `maxKeys - 1`, GROWTH makes `maxKeys + 1` levels rather than
 *    `maxKeys`, and `areasPerLock` divides by `maxKeys + 1` (see its comment —
 *    keeping MetaZelda's divisor MEASURED as a lockless graph accepted at every
 *    seed). `levels.keyCount()-1 != getMaxKeys() → retry` IS ported, because
 *    what it checks — the caller's key budget was actually spent — is still
 *    true here even though the last key is no longer the boss's.
 *
 * ── ⚠ DEVIATIONS FROM MetaZelda, EACH WITH ITS FORCING LINE ───────────
 *
 * · **THE GOAL IS GIVEN** (⚖ arc ruling 2 — the maze's goal cell keeps today's
 *   draw, the ROOM stream's first). MetaZelda PICKS the goal after growing
 *   (`placeBossGoalRooms` walks the leaves), which would MOVE it. So instead:
 *   the caller names `goal`, and `checkAcceptable` requires it to sit at the
 *   HIGHEST key level present — otherwise the keys past its level are
 *   decoration and the run RETRIES, then refuses by name.
 * · **THE ENTRANCE IS GIVEN** too (`initEntranceRoom`'s draw over
 *   `initialRooms()` is not spent). Both are marked with MetaZelda's own
 *   `START`/`GOAL` items, which is what excludes them from holding a key or the
 *   switch — the same mechanism, and it matches the maze's engine fact that an
 *   item on the entrance tile is never collected (constructive §3.10).
 * · **`checkAcceptable` RUNS EARLY**, right after the tree exists, where
 *   MetaZelda runs it last. Ours is a property of the TREE alone, so a doomed
 *   attempt is dropped before it spends intensity/key/graphify draws. (The
 *   declared draw order below is unaffected: the check draws nothing.)
 * · **`allowGoalShortcut` (default `true`)** — MetaZelda's `graphify` SKIPS the
 *   goal and boss rooms outright; ⚖ design ruling 16 asks for exactly the edge
 *   that skip forbids: *"once the player solves the puzzle that makes an exit
 *   accessible for the first time, that also unlocks a more direct path between
 *   the entrance and the exit that the player can freely travel in either
 *   direction."* That is a `graphify` edge into the GOAL's area, legal under the
 *   one-symbol rule and bidirectional by construction. Rather than silently
 *   picking a side: the port keeps MetaZelda's skip available (`false`) and
 *   DEFAULTS to ruling 16 (`true`). Nothing else about `graphify` changes — the
 *   one-symbol law still decides, so at `maxKeys: 0` the shortcut is a free
 *   edge and at `maxKeys: 1` it is locked by `K0`.
 * · **`getSolutionPath` is returned entrance-first.** MetaZelda returns
 *   goal→…→start (it only ever iterates it). Ours is consumed by a binding that
 *   walks it forward.
 * · **`computeIntensity` does not override the goal's (or a boss's)
 *   intensity.** MetaZelda pins boss = 1.0 and goal = 0.0, which encodes "the
 *   goal room is the calm reward chamber after the boss". We have no boss and
 *   our goal is the level's end; pinning it to 0.0 would import a semantics we
 *   do not have. (It is placement-inert either way — the goal holds `GOAL` and
 *   can never hold a key.)
 * · **`normalizeIntensity` guards a zero maximum.** MetaZelda divides by
 *   `maxIntensity` unguarded, which is NaN for a one-room dungeon; ⚖ design
 *   §4.1 makes the DEGENERATE ONE-AREA GRAPH first-class ("today's level"), so
 *   a zero maximum leaves the intensities alone instead of producing NaN.
 * · **Intensity is rounded to 6 decimals at the output boundary.** It is a
 *   placement preference, not a claim (design §4.2.1); the raw doubles order
 *   the sort inside, and the rounding keeps the JSON a reader (and a fixture)
 *   can hold.
 *
 * ── ⛓⛓⛓ THE DRAW ORDER IS DECLARED, AND IT **IS** THE IDENTITY ───────
 *
 * (Kickoff §3.1; constructive §3.4's law.) Every draw this module spends, in
 * order, from the ONE `ProcgenRng` the caller hands it:
 *
 *   1. `placeAreas`, per new area: `nextInt(10)` (whether to grow within the
 *      current key level) — spent ONLY when no new lock was started this step;
 *      then `shuffle` of the candidate parents, then `shuffle` of the parent's
 *      neighbours and one `pick` per rejected neighbour + one for the taken one.
 *   2. `placeSwitches` — ⚖ arc ruling 1 runs at `maxSwitches: 0`, where it
 *      returns before its first draw, so in arc 1 this phase is exactly zero
 *      draws and the order below is the kickoff's verbatim.
 *   3. intensity jitter — exactly ONE `next()` per area (`applyIntensity`
 *      visits each area once).
 *   4. `placeKeys` — per key level: one `shuffle` of that level's areas, then a
 *      STABLE sort by descending intensity (no draws).
 *   5. `graphify` — one `next()` per candidate edge that the one-symbol law
 *      admits (see its comment: a pair is offered TWICE, once from each side,
 *      and a pair the law refuses spends nothing).
 *   6. A RETRY repeats 1–5 **from the same stream** — the draws already spent
 *      are spent. `draws` and `drawsByPhase` in the output are the trace.
 *
 * ⛔ NO IMPORTS AT ALL (the rule `levelGenerator.js` and `procgenRng.js` state
 * for the same reason): both lab pages load `procgenCore/` in a browser, and an
 * import from either substrate would drag that substrate's graph into the
 * other's page. In particular this file does NOT call
 * `procgenCore/gridFlood.connected` — that is the ONE flood over grid CELLS
 * (⚖ arc ruling 5), and an area graph has no cells. The reachability check
 * below is a five-line BFS over the caller's adjacency, and it exists only to
 * refuse a malformed space by name.
 */

export class AreaGraphError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AreaGraphError';
    }
}

const fail = (message) => { throw new AreaGraphError(message); };

/**
 * MetaZelda's `Symbol` values. A key symbol is its own index (`K0` is 0);
 * the specials are negative, and there is no `BOSS`.
 */
const SYM = Object.freeze({
    START: -1,
    GOAL: -2,
    SWITCH_ON: -4,
    SWITCH_OFF: -5,
    SWITCH: -6,
});

const SPECIAL_NAMES = Object.freeze({
    [SYM.START]: 'START',
    [SYM.GOAL]: 'GOAL',
    [SYM.SWITCH_ON]: 'ON',
    [SYM.SWITCH_OFF]: 'OFF',
    [SYM.SWITCH]: 'SW',
});

/** `null` stays `null`; a key becomes `K<n>`; a special becomes its name. */
const symbolName = (value) => {
    if (value === null || value === undefined) return null;
    return value >= 0 ? `K${value}` : SPECIAL_NAMES[value];
};

const isSwitchState = (value) => value === SYM.SWITCH_ON || value === SYM.SWITCH_OFF;

/* ── Condition (MetaZelda's `Condition.java`, ported whole) ───────────── */

const EITHER = 'EITHER';
const ON = 'ON';
const OFF = 'OFF';

const condOf = (keyLevel, switchState) => ({ keyLevel, switchState });
const COND_TRUE = Object.freeze(condOf(0, EITHER));

const stateToSymbol = (state) => (state === ON ? SYM.SWITCH_ON
    : state === OFF ? SYM.SWITCH_OFF : null);
const invertState = (state) => (state === ON ? OFF : state === OFF ? ON : state);

/** `Condition.and(Symbol)`. */
const condAndSymbol = (cond, symbolValue) => {
    if (symbolValue === SYM.SWITCH_OFF) return condOf(cond.keyLevel, OFF);
    if (symbolValue === SYM.SWITCH_ON) return condOf(cond.keyLevel, ON);
    return condOf(Math.max(cond.keyLevel, symbolValue + 1), cond.switchState);
};

/** `Condition.and(Condition)`. */
const condAndCond = (cond, other) => {
    if (!other) return cond;
    const switchState = cond.switchState === EITHER ? other.switchState : cond.switchState;
    return condOf(Math.max(cond.keyLevel, other.keyLevel), switchState);
};

/** `Condition.implies(Condition)` — "y is satisfied whenever x is". */
const condImplies = (cond, other) => cond.keyLevel >= other.keyLevel
    && (cond.switchState === other.switchState || other.switchState === EITHER);

const condEquals = (a, b) => a.keyLevel === b.keyLevel && a.switchState === b.switchState;

/**
 * `Condition.singleSymbolDifference` — THE ONE-SYMBOL LAW's arithmetic, and
 * the reason `graphify`'s extra edges never trivialise the puzzle. Returns the
 * symbol value that would make the two conditions identical, or `null` when no
 * single symbol does (or when they are already identical).
 */
const singleSymbolDifference = (cond, other) => {
    if (condEquals(cond, other)) return null;
    if (cond.switchState === other.switchState) {
        return Math.max(cond.keyLevel, other.keyLevel) - 1;
    }
    if (cond.keyLevel !== other.keyLevel) return null;
    if (cond.switchState !== EITHER && other.switchState !== EITHER) return null;
    const nonEither = cond.switchState !== EITHER ? cond.switchState : other.switchState;
    return nonEither === ON ? SYM.SWITCH_ON : SYM.SWITCH_OFF;
};

/** `{K_0..K_{n-1}}` plus the switch state when one is required — the output spelling. */
const precondSymbols = (cond) => {
    const out = [];
    for (let i = 0; i < cond.keyLevel; i += 1) out.push(`K${i}`);
    if (cond.switchState !== EITHER) out.push(cond.switchState);
    return out;
};

/* ── Bounds ───────────────────────────────────────────────────────────── */

/**
 * ⛔ ONE frozen table of defaults, each with its provenance:
 *
 * · `maxKeys: 1` — the smallest NON-degenerate lock-and-key level, and the
 *   shape ⚖ ruling 16's post-solve shortcut needs (goal level 1 ⇒ the direct
 *   entrance↔goal edge is `K0`-locked). `0` is legal and means "no locks".
 * · `maxRetries: 20` — MetaZelda's own default (`DungeonGenerator.maxRetries`).
 * · `graphifyProbability: 0.2` — MetaZelda's `CountConstraints.
 *   edgeGraphifyProbability`, which returns 0.2 for every pair.
 * · `maxSwitches: 0` — ⚖ arc ruling 1: the switch waits for arc 2 (the
 *   block-on-button gadget is its realisation), so `placeSwitches` is ported
 *   and unit-tested but INERT here.
 * · `allowGoalShortcut: true` — ⚖ design ruling 16 (see DEVIATIONS above).
 */
export const DEFAULT_AREA_BOUNDS = Object.freeze({
    maxKeys: 1,
    maxRetries: 20,
    graphifyProbability: 0.2,
    maxSwitches: 0,
    allowGoalShortcut: true,
});

function assertBounds(bounds) {
    const b = { ...DEFAULT_AREA_BOUNDS, ...(bounds ?? {}) };
    for (const key of Object.keys(b)) {
        if (!(key in DEFAULT_AREA_BOUNDS)) {
            fail(`areaGraph: unknown bound \`${key}\`. The bounds this module runs under are `
                + `${Object.keys(DEFAULT_AREA_BOUNDS).join(', ')} — a bound it does not know `
                + 'is either a typo or a knob somebody expected to exist, and both are worth '
                + 'a refusal rather than a silent no-op.');
        }
    }
    for (const key of ['maxKeys', 'maxRetries', 'maxSwitches']) {
        if (!Number.isInteger(b[key]) || b[key] < 0) {
            fail(`areaGraph: bounds.${key} must be a non-negative integer, got `
                + `${JSON.stringify(b[key])}. ⚖ Arc ruling 4: every bound is NAMED in the `
                + 'trace, so there is no value here that means "unbounded".');
        }
    }
    if (typeof b.graphifyProbability !== 'number' || !Number.isFinite(b.graphifyProbability)
        || b.graphifyProbability < 0 || b.graphifyProbability > 1) {
        fail('areaGraph: bounds.graphifyProbability must be a number in [0, 1], got '
            + `${JSON.stringify(b.graphifyProbability)}. It is compared against one \`next()\` `
            + 'draw per candidate edge; a value outside the unit interval would make that '
            + 'comparison a constant nobody chose.');
    }
    if (typeof b.allowGoalShortcut !== 'boolean') {
        fail('areaGraph: bounds.allowGoalShortcut must be a boolean, got '
            + `${JSON.stringify(b.allowGoalShortcut)}. It selects between MetaZelda's own `
            + 'behaviour (`false`: `graphify` skips the goal) and ⚖ design ruling 16 '
            + '(`true`: the post-solve entrance↔goal shortcut is legal under the one-symbol '
            + 'rule) — a deviation that names itself rather than being picked silently.');
    }
    return Object.freeze(b);
}

/* ── The caller's space, checked by name ──────────────────────────────── */

/**
 * ⛔ EVERY REFUSAL HERE IS A CALLER DEFECT AND THROWS. A space whose goal is
 * unreachable is not "a graph that could not be made acceptable" — it is a
 * partition that does not describe a level, and answering `{refused}` would let
 * a binding's broken partition read as an unlucky seed.
 */
function assertSpace({ areas, adjacency, entrance, goal }) {
    if (!Array.isArray(areas) || areas.length === 0) {
        fail('areaGraph: `areas` must be a non-empty array of `{id, capacity}`. An empty '
            + 'space is a finding about the PARTITION (slice 2\'s area census), not a graph '
            + 'this module can grow.');
    }
    const byId = new Map();
    const order = [];
    for (const area of areas) {
        const id = area?.id;
        if (!(typeof id === 'string' || Number.isInteger(id))) {
            fail(`areaGraph: every area needs an \`id\` that is a string or an integer, got `
                + `${JSON.stringify(area)}.`);
        }
        if (byId.has(id)) {
            fail(`areaGraph: duplicate area id ${JSON.stringify(id)}. Ids are the identity `
                + 'of an area in every edge, every key and the solution path.');
        }
        const capacity = area.capacity ?? {};
        for (const k of ['item', 'switch']) {
            if (capacity[k] !== undefined && typeof capacity[k] !== 'boolean') {
                fail(`areaGraph: area ${JSON.stringify(id)} has capacity.${k} = `
                    + `${JSON.stringify(capacity[k])}; it must be a boolean (MetaZelda's `
                    + '`roomCanFitItem`). Default is `true`.');
            }
        }
        byId.set(id, {
            id,
            canHoldItem: capacity.item ?? true,
            canHoldSwitch: capacity.switch ?? true,
        });
        order.push(id);
    }
    if (!Array.isArray(adjacency)) {
        fail(`areaGraph: \`adjacency\` must be an array of [idA, idB] pairs, got `
            + `${JSON.stringify(adjacency)}.`);
    }
    const neighbours = new Map(order.map((id) => [id, []]));
    const seenPairs = new Set();
    for (const pair of adjacency) {
        if (!Array.isArray(pair) || pair.length !== 2) {
            fail(`areaGraph: adjacency entries are [idA, idB] pairs, got `
                + `${JSON.stringify(pair)}. The relation is UNDIRECTED — one entry per pair.`);
        }
        const [a, bId] = pair;
        for (const id of [a, bId]) {
            if (!byId.has(id)) {
                fail(`areaGraph: adjacency names unknown area ${JSON.stringify(id)}. `
                    + 'Every id in the adjacency must be one of `areas`.');
            }
        }
        if (a === bId) {
            fail(`areaGraph: adjacency has the self-loop [${JSON.stringify(a)}, `
                + `${JSON.stringify(bId)}]. An area is not adjacent to itself.`);
        }
        const key = JSON.stringify([a, bId].map(String).sort());
        if (seenPairs.has(key)) {
            fail(`areaGraph: adjacency lists the pair ${JSON.stringify(a)}–`
                + `${JSON.stringify(bId)} more than once (either order). The relation is a `
                + 'SET, and a duplicate would change the draw order without changing the '
                + 'space.');
        }
        seenPairs.add(key);
        neighbours.get(a).push(bId);
        neighbours.get(bId).push(a);
    }
    for (const [what, id] of [['entrance', entrance], ['goal', goal]]) {
        if (!byId.has(id)) {
            fail(`areaGraph: \`${what}\` is ${JSON.stringify(id)}, which is not one of the `
                + 'given areas.');
        }
    }
    if (entrance === goal) {
        fail(`areaGraph: entrance and goal are both ${JSON.stringify(entrance)}. A level `
            + 'whose exit is its entrance has no lock-and-key graph to grow — the caller '
            + 'wants the degenerate ONE-AREA level, which is a level with no area graph at '
            + 'all, not this function.');
    }
    /**
     * ⛓ A BFS over the caller's adjacency — NOT `gridFlood.connected`, which
     * floods CELLS. Growth can only reach areas connected to the entrance, so an
     * unreachable area would silently never be assigned and the tree would come
     * out short; the goal is called out by name because ⚖ ruling 2 makes it the
     * acceptability criterion.
     */
    const seen = new Set([entrance]);
    const queue = [entrance];
    for (let head = 0; head < queue.length; head += 1) {
        for (const n of neighbours.get(queue[head])) {
            if (!seen.has(n)) { seen.add(n); queue.push(n); }
        }
    }
    if (!seen.has(goal)) {
        fail(`areaGraph: the goal area ${JSON.stringify(goal)} is not reachable from the `
            + `entrance ${JSON.stringify(entrance)} over the given adjacency. ⛔ That is a `
            + 'PARTITION defect, not an unlucky seed: no lock-and-key graph over this space '
            + 'can be solved, at any seed and any bounds.');
    }
    const stranded = order.filter((id) => !seen.has(id));
    if (stranded.length) {
        fail(`areaGraph: ${stranded.length} area(s) are not reachable from the entrance `
            + `${JSON.stringify(entrance)}: ${JSON.stringify(stranded)}. The tree grows `
            + 'outward from the entrance, so a stranded area would never be assigned a key '
            + 'level and would vanish from the output without a word.');
    }
    return { byId, order, neighbours };
}

/* ── One attempt ──────────────────────────────────────────────────────── */

const REASONS = Object.freeze({
    KEY_BUDGET_UNSPENT: 'the-space-grew-fewer-key-levels-than-maxKeys',
    GOAL_NOT_TOP: 'goal-area-is-not-at-the-highest-key-level',
    NO_ROOM_FOR_KEY: 'no-area-at-that-key-level-can-hold-its-key',
    NO_SWITCH_PLACEMENT: 'no-acceptable-switch-placement',
});

/**
 * Grows ONE candidate graph. Returns `{ok: true, state}` or `{ok: false,
 * reason, detail}` — a retryable failure, in MetaZelda's terms a
 * `RetryException`.
 */
function attemptGraph(rng, space, b, entrance, goal, phase) {
    const { byId, order, neighbours } = space;
    const state = new Map();
    for (const id of order) {
        state.set(id, {
            id,
            canHoldItem: byId.get(id).canHoldItem,
            canHoldSwitch: byId.get(id).canHoldSwitch,
            keyLevel: 0,
            cond: COND_TRUE,
            parent: null,
            children: [],
            item: null,
            intensity: 0,
            edges: new Map(),
        });
    }
    /** Every link ever made, in creation order — the output's edge list. */
    const edges = [];
    const link = (aId, bId, symbolValue, kind) => {
        const a = state.get(aId);
        const bb = state.get(bId);
        const existing = a.edges.get(bId);
        if (existing) {
            existing.lock = symbolValue;
            bb.edges.get(aId).lock = symbolValue;
            return;
        }
        const record = { a: aId, b: bId, lock: symbolValue, kind };
        edges.push(record);
        a.edges.set(bId, record);
        bb.edges.set(aId, record);
    };

    const assigned = new Set([entrance]);
    const creationOrder = [entrance];
    const levels = [[state.get(entrance)]];
    const levelRooms = (n) => {
        while (levels.length <= n) levels.push([]);
        return levels[n];
    };
    state.get(entrance).item = SYM.START;

    /** MetaZelda's `chooseRoomWithFreeEdge`: shuffle, first with a free edge. */
    const chooseAreaWithFreeEdge = (candidates) => {
        for (const room of rng.shuffle(candidates)) {
            if (neighbours.get(room.id).some((n) => !assigned.has(n))) return room;
        }
        return null;
    };

    /**
     * MetaZelda's `chooseFreeEdge`, verbatim — including the shuffle BEFORE the
     * pick, which is redundant (a uniform pick over a shuffled list is a uniform
     * pick) and is kept because it is part of the port's draw structure, not
     * because it does work. `RandUtil.choice` is the author's `gameutil` and is
     * not in the clone; it is read as "a uniform pick from the list", which is
     * what our `rng.pick` is.
     */
    const chooseFreeEdge = (room) => {
        let candidates = rng.shuffle(neighbours.get(room.id));
        while (candidates.length) {
            const choice = rng.pick(candidates);
            if (!assigned.has(choice)) return choice;
            candidates = candidates.filter((x) => x !== choice);
        }
        fail(`areaGraph: internal invariant — area ${JSON.stringify(room.id)} was chosen for `
            + 'having a free edge and then had none. This is a defect in this file, not in '
            + 'the caller\'s space.');
        return null;
    };

    const shouldAddNewLock = (keyLevel, numAreas, areasPerLock) => numAreas >= areasPerLock
        && keyLevel < b.maxKeys;

    /* ── 1. placeAreas (MetaZelda `placeRooms`) ───────────────────────── */
    /**
     * ⚠⚠ **MetaZelda DIVIDES BY `maxKeys`; WE DIVIDE BY `maxKeys + 1`, AND THE
     * DIFFERENCE IS THE BOSS ROOM WE DO NOT HAVE.** There, `usableKeys =
     * maxKeys - 1` during growth (the last key is reserved) and
     * `placeBossGoalRooms` spends the reserved key afterwards, so `placeRooms`
     * grows exactly `maxKeys` levels and `maxRooms / maxKeys` is one level's
     * target. Here growth is the ONLY thing that makes levels, so it makes
     * `maxKeys + 1` of them (0…maxKeys) and the target divides by that.
     *
     * ⛓ MEASURED, not reasoned: with MetaZelda's divisor a 5-area path at
     * `maxKeys: 1` accepted at 200/200 seeds with ZERO locks — level 0 filled to
     * the target only once every area was already assigned, and
     * `checkAcceptable` passed because the goal did sit at the highest level
     * present (0). A lock-and-key module that quietly returns a graph with no
     * locks is the vacuous accept this arc exists to avoid.
     */
    const areasPerLock = Math.floor(order.length / (b.maxKeys + 1));
    let keyLevel = 0;
    let latestKey = null;
    let cond = COND_TRUE;
    const drawsAtPlace = rng.draws;
    while (assigned.size < order.length) {
        let doLock = false;
        if (shouldAddNewLock(keyLevel, levelRooms(keyLevel).length, areasPerLock)) {
            latestKey = keyLevel;
            keyLevel += 1;
            cond = condAndSymbol(cond, latestKey);
            doLock = true;
        }
        let parent = null;
        if (!doLock && rng.nextInt(10) > 0) {
            parent = chooseAreaWithFreeEdge(levelRooms(keyLevel));
        }
        if (parent === null) {
            parent = chooseAreaWithFreeEdge(creationOrder.map((id) => state.get(id)));
            doLock = true;
        }
        if (parent === null) {
            /**
             * ⛔ MetaZelda's `OutOfRoomsException`. Unreachable here — the space
             * is verified connected before any draw, so an unassigned area is
             * always adjacent to an assigned one — and it refuses by name rather
             * than looping, because the alternative (MetaZelda's halve-
             * `roomsPerLock`-and-retry) is the unbounded search ⚖ ruling 4 bans.
             */
            fail('areaGraph: internal invariant — no area has a free edge while areas remain '
                + 'unassigned, on a space this module already verified is connected.');
        }
        const nextId = chooseFreeEdge(parent);
        const room = state.get(nextId);
        room.parent = parent.id;
        room.cond = cond;
        room.keyLevel = cond.keyLevel;
        parent.children.push(nextId);
        assigned.add(nextId);
        creationOrder.push(nextId);
        link(parent.id, nextId, doLock ? latestKey : null, 'tree');
        levelRooms(keyLevel).push(room);
    }
    phase.placeAreas += rng.draws - drawsAtPlace;

    /* ── 2. checkAcceptable — ⚖ arc ruling 2, and it draws NOTHING ────── */
    state.get(goal).item = SYM.GOAL;
    const topLevel = levels.length - 1;
    /**
     * ⛓ MetaZelda's own `levels.keyCount()-1 != getMaxKeys() → retry`, kept for
     * the reason it exists there: `maxKeys` is what the caller ASKED FOR, and a
     * graph that grew fewer levels is a graph with fewer locks than the run
     * declares. ⚠ On a space too small to hold `maxKeys + 1` levels this refuses
     * at every seed, BY NAME — which is the honest answer ("this partition
     * admits N key levels"), and is what slice 2's area census exists to measure
     * before it chooses `maxKeys`.
     */
    if (topLevel !== b.maxKeys) {
        return {
            ok: false,
            reason: REASONS.KEY_BUDGET_UNSPENT,
            detail: `the graph grew ${topLevel + 1} key level(s) over ${order.length} area(s) `
                + `but bounds.maxKeys is ${b.maxKeys}, so ${b.maxKeys - topLevel} key(s) `
                + 'would exist in the bounds and nowhere in the level',
        };
    }
    if (state.get(goal).keyLevel !== topLevel) {
        return {
            ok: false,
            reason: REASONS.GOAL_NOT_TOP,
            detail: `the goal area ${JSON.stringify(goal)} grew at key level `
                + `${state.get(goal).keyLevel}, but the graph reached key level ${topLevel}; `
                + 'the keys above the goal would be decoration',
        };
    }

    /* ── 3. placeSwitches (INERT at maxSwitches 0 — ⚖ arc ruling 1) ───── */
    const drawsAtSwitch = rng.draws;
    const switchResult = placeSwitches(rng, state, b, goal, link);
    phase.placeSwitches += rng.draws - drawsAtSwitch;
    if (!switchResult.ok) return switchResult;

    /* ── 4. intensity ─────────────────────────────────────────────────── */
    const drawsAtIntensity = rng.draws;
    computeIntensity(rng, state, levels);
    phase.intensity += rng.draws - drawsAtIntensity;

    /* ── 5. placeKeys ─────────────────────────────────────────────────── */
    const drawsAtKeys = rng.draws;
    const keysResult = placeKeys(rng, levels);
    phase.placeKeys += rng.draws - drawsAtKeys;
    if (!keysResult.ok) return keysResult;

    /* ── 6. graphify ──────────────────────────────────────────────────── */
    const drawsAtGraphify = rng.draws;
    graphify(rng, state, order, neighbours, b, goal, link);
    phase.graphify += rng.draws - drawsAtGraphify;

    return {
        ok: true,
        state,
        edges,
        levels,
        keyCount: levels.length,
        switchPlaced: switchResult.placed,
    };
}

/* ── placeSwitches, ported (⚖ arc ruling 1: exercised only by its test) ── */

function removeDescendantsFromList(rooms, room, state) {
    const index = rooms.indexOf(room);
    if (index >= 0) rooms.splice(index, 1);
    for (const childId of room.children) {
        removeDescendantsFromList(rooms, state.get(childId), state);
    }
}

function addPrecond(room, cond, state) {
    room.cond = condAndCond(room.cond, cond);
    room.keyLevel = room.cond.keyLevel;
    for (const childId of room.children) addPrecond(state.get(childId), cond, state);
}

/**
 * MetaZelda's `switchLockChildRooms`: lock some of a room's CHILD edges behind
 * a switch state, alternating the state when the caller asked for EITHER, and
 * recursing into the children whose edges it did not lock.
 */
function switchLockChildRooms(rng, room, givenState, state, link) {
    let anyLocks = false;
    let switchState = givenState !== EITHER
        ? givenState
        : (rng.nextInt(2) === 0 ? ON : OFF);
    for (const record of [...room.edges.values()]) {
        const neighborId = record.a === room.id ? record.b : record.a;
        if (!room.children.includes(neighborId)) continue;
        const nextRoom = state.get(neighborId);
        if (record.lock === null && rng.nextInt(4) !== 0) {
            link(room.id, neighborId, stateToSymbol(switchState), 'tree');
            addPrecond(nextRoom, condOf(0, switchState), state);
            anyLocks = true;
        } else {
            anyLocks = switchLockChildRooms(rng, nextRoom, switchState, state, link) || anyLocks;
        }
        if (givenState === EITHER) switchState = invertState(switchState);
    }
    return anyLocks;
}

function solutionPathOf(state, goal) {
    const path = [];
    let room = state.get(goal);
    while (room) {
        path.push(room.id);
        room = room.parent === null ? null : state.get(room.parent);
    }
    /** ⚠ MetaZelda returns this goal-first; a binding walks it forward. */
    return path.reverse();
}

function placeSwitches(rng, state, b, goal, link) {
    if (b.maxSwitches <= 0) return { ok: true, placed: false };
    const solution = solutionPathOf(state, goal).map((id) => state.get(id));

    for (let attempt = 0; attempt < 10; attempt += 1) {
        const rooms = rng.shuffle([...state.values()]);
        const shuffledSolution = rng.shuffle(solution);

        /**
         * ⛓ The base room comes from the SOLUTION PATH and must have more than
         * one child — that is what makes the player meet the switch lock on the
         * way to the goal rather than in an optional pocket.
         */
        let baseRoom = null;
        for (const room of shuffledSolution) {
            if (room.children.length > 1 && room.parent !== null) { baseRoom = room; break; }
        }
        if (baseRoom === null) {
            return {
                ok: false,
                reason: REASONS.NO_SWITCH_PLACEMENT,
                detail: 'no area on the solution path has a parent and more than one child, '
                    + 'so a switch lock could not be met on the way to the goal',
            };
        }
        const baseRoomCond = baseRoom.cond;
        removeDescendantsFromList(rooms, baseRoom, state);

        let switchRoom = null;
        for (const room of rooms) {
            if (room.item === null && condImplies(baseRoomCond, room.cond) && room.canHoldSwitch) {
                switchRoom = room;
                break;
            }
        }
        if (switchRoom === null) continue;

        if (switchLockChildRooms(rng, baseRoom, EITHER, state, link)) {
            switchRoom.item = SYM.SWITCH;
            return { ok: true, placed: true };
        }
    }
    return {
        ok: false,
        reason: REASONS.NO_SWITCH_PLACEMENT,
        detail: 'ten attempts found no area that could hold the switch below the base area\'s '
            + 'precondition, or none of them locked any child edge',
    };
}

/* ── intensity, ported ────────────────────────────────────────────────── */

const INTENSITY_GROWTH_JITTER = 0.1;
const INTENSITY_EASE_OFF = 0.2;

function applyIntensity(rng, room, intensity, state) {
    const jittered = intensity * (1.0 - INTENSITY_GROWTH_JITTER / 2.0
        + INTENSITY_GROWTH_JITTER * rng.next());
    room.intensity = jittered;
    let maxIntensity = jittered;
    for (const childId of room.children) {
        const child = state.get(childId);
        if (condImplies(room.cond, child.cond)) {
            maxIntensity = Math.max(maxIntensity,
                applyIntensity(rng, child, jittered + 1.0, state));
        }
    }
    return maxIntensity;
}

function normalizeIntensity(state) {
    let maxIntensity = 0.0;
    for (const room of state.values()) maxIntensity = Math.max(maxIntensity, room.intensity);
    /**
     * ⚠ MetaZelda divides unguarded, which is NaN for a dungeon whose whole
     * intensity is zero (a one-room dungeon — the DEGENERATE ONE-AREA GRAPH
     * design §4.1 makes first-class here).
     */
    if (maxIntensity === 0) return;
    for (const room of state.values()) {
        room.intensity = (room.intensity * 0.99) / maxIntensity;
    }
}

function computeIntensity(rng, state, levels) {
    let nextLevelBaseIntensity = 0.0;
    for (let level = 0; level < levels.length; level += 1) {
        const intensity = nextLevelBaseIntensity * (1.0 - INTENSITY_EASE_OFF);
        for (const room of levels[level]) {
            const parent = room.parent === null ? null : state.get(room.parent);
            if (parent === null || !condImplies(parent.cond, room.cond)) {
                nextLevelBaseIntensity = Math.max(nextLevelBaseIntensity,
                    applyIntensity(rng, room, intensity, state));
            }
        }
    }
    normalizeIntensity(state);
}

/* ── placeKeys, ported ────────────────────────────────────────────────── */

function placeKeys(rng, levels) {
    for (let key = 0; key < levels.length - 1; key += 1) {
        /**
         * ⛓⛓ SHUFFLE, THEN A **STABLE** SORT BY DESCENDING INTENSITY — and the
         * stability is the point, in MetaZelda's own words: *"Collections.sort
         * is stable: it doesn't reorder 'equal' elements, which means the
         * shuffling we just did is still useful."* Ties in intensity are broken
         * by the shuffle, so a level whose areas all sit at one intensity still
         * places its key somewhere different at every seed. `Array.prototype.
         * sort` is required to be stable since ES2019, so this holds here too.
         */
        const rooms = rng.shuffle(levels[key])
            .sort((x, y) => (x.intensity > y.intensity ? -1 : x.intensity < y.intensity ? 1 : 0));

        let placed = false;
        for (const room of rooms) {
            if (room.item === null && room.canHoldItem) {
                room.item = key;
                placed = true;
                break;
            }
        }
        if (!placed) {
            return {
                ok: false,
                reason: REASONS.NO_ROOM_FOR_KEY,
                detail: `key K${key} needs an area at key level ${key} that holds no item and `
                    + `whose capacity admits one; the ${levels[key].length} area(s) at that `
                    + 'level are all taken (the entrance holds START, the goal holds GOAL) or '
                    + 'refuse items',
            };
        }
    }
    return { ok: true };
}

/* ── graphify, ported VERBATIM ────────────────────────────────────────── */

/**
 * THE ONE-SYMBOL LAW. An extra edge between two ADJACENT areas is legal in
 * exactly two cases and no others:
 *
 *  · their preconditions IMPLY EACH OTHER (same key level, same switch state) —
 *    a FREE edge, taken with `graphifyProbability`;
 *  · they differ by EXACTLY ONE symbol — an edge LOCKED by that symbol.
 *
 * Anything else is skipped, which is what keeps a loop from trivialising the
 * puzzle: an edge that skipped two locks would hand the player the second key's
 * region without the first key.
 *
 * ⚠ **A PAIR IS OFFERED TWICE, ONCE FROM EACH SIDE**, and that is MetaZelda's
 * behaviour rather than an accident of the port: a pair that loses its draw
 * from `a`'s side gets a second draw from `b`'s side, so the effective
 * probability of a free edge is `1 - (1 - p)²` (0.36 at the default 0.2). A
 * pair that WINS is skipped the second time (the edge now exists). ⛓ A pair the
 * one-symbol law refuses spends NO draw at all — the short-circuit is
 * MetaZelda's `difference == null || (…)` and it is why `drawsByPhase.graphify`
 * is not simply "one per adjacent pair".
 */
function graphify(rng, state, order, neighbours, b, goal, link) {
    for (const id of order) {
        const room = state.get(id);
        if (room.item === SYM.GOAL && !b.allowGoalShortcut) continue;
        for (const nextId of neighbours.get(id)) {
            if (room.edges.has(nextId)) continue;
            const nextRoom = state.get(nextId);
            if (nextRoom.item === SYM.GOAL && !b.allowGoalShortcut) continue;

            const forwardImplies = condImplies(room.cond, nextRoom.cond);
            const backwardImplies = condImplies(nextRoom.cond, room.cond);
            if (forwardImplies && backwardImplies) {
                if (rng.next() >= b.graphifyProbability) continue;
                link(id, nextId, null, 'graphify');
            } else {
                const difference = singleSymbolDifference(room.cond, nextRoom.cond);
                if (difference === null
                    || (!isSwitchState(difference) && rng.next() >= b.graphifyProbability)) {
                    continue;
                }
                link(id, nextId, difference, 'graphify');
            }
        }
    }
}

/* ── The entry point ──────────────────────────────────────────────────── */

const round6 = (value) => Number(value.toFixed(6));

/**
 * ⛓ GROW A LOCK-AND-KEY GRAPH OVER THE CALLER'S SPACE.
 *
 * @param {object} o
 * @param {{next: Function, nextInt: Function, pick: Function, shuffle: Function, draws: number}}
 *   o.rng a `procgenCore/procgenRng` — the ONE stream, whose position after
 *   this call has advanced by the returned `draws`.
 * @param {Array<{id: string|number, capacity?: {item?: boolean, switch?: boolean}}>} o.areas
 *   the space's areas, in the order that IS the iteration order of every phase.
 * @param {Array<[string|number, string|number]>} o.adjacency undirected pairs.
 * @param {string|number} o.entrance ⚖ GIVEN (arc ruling 2).
 * @param {string|number} o.goal ⚖ GIVEN (arc ruling 2) — and required to end at
 *   the HIGHEST key level, or the attempt is retried.
 * @param {object} [o.bounds] see `DEFAULT_AREA_BOUNDS`.
 * @returns {{areas: object, edges: Array, symbols: string[], solutionPath: Array,
 *   bounds: object, draws: number, drawsByPhase: object, attempts: number,
 *   refused: null | {reason: string, detail: string, attempts: number}}}
 */
export function buildAreaGraph({ rng, areas, adjacency, entrance, goal, bounds } = {}) {
    if (!rng || typeof rng.next !== 'function' || typeof rng.nextInt !== 'function'
        || typeof rng.pick !== 'function' || typeof rng.shuffle !== 'function'
        || !Number.isInteger(rng.draws)) {
        fail('areaGraph: the rng must carry `next`, `nextInt`, `pick`, `shuffle` and a '
            + '`draws` counter (procgenCore/procgenRng). ⛔ There is no default: the SOURCE '
            + 'is the substrate binding\'s (procgenRng\'s own rule), and the draw count is '
            + 'part of this module\'s output.');
    }
    const b = assertBounds(bounds);
    const space = assertSpace({ areas, adjacency, entrance, goal });

    const drawsAtStart = rng.draws;
    const phase = {
        placeAreas: 0, placeSwitches: 0, intensity: 0, placeKeys: 0, graphify: 0,
    };
    /**
     * ⛔ `maxRetries + 1` ATTEMPTS, ALL FROM THE SAME STREAM. ⚖ Arc ruling 4:
     * the bound is named and the failure is a REFUSED run carrying the draws it
     * spent — never MetaZelda's `GenerationFailureException`, and never a loop
     * that reduces a parameter until something works.
     */
    let last = null;
    let attempts = 0;
    for (let attempt = 0; attempt <= b.maxRetries; attempt += 1) {
        attempts += 1;
        last = attemptGraph(rng, space, b, entrance, goal, phase);
        if (last.ok) break;
    }
    const draws = rng.draws - drawsAtStart;
    const drawsByPhase = Object.freeze({ ...phase });

    if (!last.ok) {
        return {
            areas: {},
            edges: [],
            symbols: [],
            solutionPath: [],
            bounds: b,
            draws,
            drawsByPhase,
            attempts,
            refused: { reason: last.reason, detail: last.detail, attempts },
        };
    }

    const outAreas = {};
    for (const id of space.order) {
        const room = last.state.get(id);
        outAreas[id] = {
            keyLevel: room.keyLevel,
            precond: precondSymbols(room.cond),
            intensity: round6(room.intensity),
            item: symbolName(room.item),
            parent: room.parent,
        };
    }
    const symbols = [];
    for (let i = 0; i < last.keyCount - 1; i += 1) symbols.push(`K${i}`);
    if (last.switchPlaced) symbols.push('SW');

    return {
        areas: outAreas,
        edges: last.edges.map((e) => ({
            a: e.a, b: e.b, lock: symbolName(e.lock), kind: e.kind,
        })),
        symbols,
        solutionPath: solutionPathOf(last.state, goal),
        bounds: b,
        draws,
        drawsByPhase,
        attempts,
        refused: null,
    };
}
