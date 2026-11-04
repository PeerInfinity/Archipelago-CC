/**
 * procgenCore/entranceRandomizer — THE SHUFFLE CORE of entrance randomization
 * (ER arc, step E3): a pure-JS port of Archipelago's generic entrance
 * randomizer (`entrance_rando.py`, repo root — ⛔ never edit it), with the
 * reachability evaluator and the rng INJECTED.
 *
 * ⚖ What this file is, and is not:
 *   - It KEEPS GER's contract: the dead-end / non-dead-end target split
 *     (`canExpandGraph`), the four placement stages, `findPairing`'s
 *     `deadEnd`/`requireNewExits`, the speculative sweep before a placement that
 *     could cap the graph, coupled pairs, and the group filter.
 *   - It does NOT reproduce GER's draws (different RNG). Parity is BEHAVIOURAL:
 *     the same guarantees, proved by `entranceRandomizer.test.js`'s property suite.
 *   - ⚖ Coupled is the only v1 MODE (Q2), but the core implements both
 *     `coupled: true` and `false`, as GER does. The mode restricts it, not this file.
 *   - ⚖ Group-generic (Q1): which doorways are "stairs" is a classifier decision
 *     (E4). The core takes a `targetGroupLookup` and nothing else about groups.
 *   - No reachability engine of its own: `reach(connections)` is a callback.
 *     `makePlainGraphReach` below is the ONE adapter (a tiny item-gated evaluator
 *     over a plain graph) and exists for the tests; E4 binds the production one.
 *
 * ⛔ THE LAW OF THIS DIRECTORY: this file imports nothing (see README.md).
 *
 * ── PYTHON → JS NAME MAP (`entrance_rando.py` line numbers) ─────────────
 *
 *   Python (entrance_rando.py)                 line   JS (this file)
 *   ─────────────────────────────────────────  ────   ─────────────────────────────
 *   EntranceRandomizationError                   13   EntranceRandomizationError (carries `details`)
 *   EntranceLookup                               17   EntranceLookup
 *   EntranceLookup.GroupLookup                   18   GroupLookup
 *   EntranceLookup._can_expand_graph             65   EntranceLookup.canExpandGraph
 *   EntranceLookup.add / remove             112/116   EntranceLookup.add / remove
 *   EntranceLookup.get_targets                  120   EntranceLookup.getTargets
 *   EntranceLookup.find_target                  144   EntranceLookup.findTarget
 *   EntranceLookup.__len__                      165   EntranceLookup.size
 *   ERPlacementState                            169   ERPlacementState
 *   ERPlacementState.placed_regions             204   ERPlacementState.placedRegions
 *   ERPlacementState.find_placeable_exits       207   ERPlacementState.findPlaceableExits
 *   ERPlacementState._connect_one_way           220   ERPlacementState.connectOneWay
 *   ERPlacementState.test_speculative_connection 231  ERPlacementState.testSpeculativeConnection
 *   ERPlacementState.connect                    259   ERPlacementState.connect
 *   bake_target_group_lookup                    302   bakeTargetGroupLookup
 *   disconnect_entrance_for_randomization       316   disconnectForRandomization (PURE: returns a new graph)
 *   randomize_entrances                         352   randomizeEntrances
 *     └ do_placement                            412     doPlacement
 *     └ needs_speculative_sweep                 423     needsSpeculativeSweep
 *     └ find_pairing                            451     findPairing
 *     └ stages 1 / 2 / 3a / 3b              519-535     the four `while` loops at the end
 *   BaseClasses.Entrance.is_valid_source_transition (BaseClasses.py 1226)  defaultIsValidSourceTransition
 *   BaseClasses.Entrance.can_connect_to             (BaseClasses.py 1237)  defaultCanConnectTo
 *   CollectionState.update_reachable_regions +
 *     sweep_for_advancements                                                the injected `reach(connections)`
 *
 * ── THE DATA (plain objects; E4 binds rules.json to it) ────────────────
 *
 *   exit    {name, region, type: 'two_way'|'one_way', group}   a shufflable exit
 *           (GER: an Entrance with a parent region and NO connected region)
 *   target  {name, region, type, group}                         an ER target
 *           (GER: an Entrance with a connected region and NO parent region)
 *   fixedEdges   [{from, to}]   the non-shuffled exits, STRUCTURALLY (rules
 *           ignored) — `canExpandGraph` walks them, as `_can_expand_graph` does.
 *   progressionRegions  iterable of region names that hold an advancement
 *           location OR are named by an indirect condition (GER's two
 *           "region itself is progression" checks, L84-93).
 *
 * ── THE INJECTED REACHABILITY CONTRACT ─────────────────────────────────
 *
 *   reach(connections) → { regions: Iterable<region>, exits: Iterable<exitName> }
 *
 *   `connections` is every placement so far as `[{exit, from, to}]` (from = the
 *   exit's region, to = the target's region). The callback returns the fixed
 *   point of GER's `update_reachable_regions` + `sweep_for_advancements` with
 *   those connections added: the reachable regions, and the names of the
 *   exits that are TRAVERSABLE (parent reachable AND access rule satisfied —
 *   GER's `blocked_connections` ∩ `can_reach`). Only shufflable exit names are
 *   read from `exits`; extra names are ignored. It must be a pure function of
 *   its argument (it is called speculatively with a connection that is not
 *   kept). The inventory it starts from is the caller's (GER uses a
 *   single-player all-state, L193-200 — E4 decides what the mode's is).
 *
 * ── THE RESULT ─────────────────────────────────────────────────────────
 *
 *   placements: [{exit, target}] — ⚖ COUPLED PAIRS ARE BOTH LISTED: the forward
 *   placement, then its reverse immediately after it (GER's `pairings`, L228).
 *   `couplings` names each pair as `[forwardExit, reverseExit]`. The field names
 *   `exit`/`target` are rules.json `entrance_randomization[p].placements`' (E2).
 *
 * ── FAILURE ───────────────────────────────────────────────────────────
 *
 *   ⛔ REFUSED BY NAME, NEVER RETRIED HERE: an `EntranceRandomizationError`
 *   whose `details` names the stage, the stranded (unplaced) exits with their
 *   groups, the unplaced targets, the partial placements and `rng.draws`. A
 *   caller retries with the next draw and counts attempts (the mode's job, E4).
 *
 * ── GUARDS (for the mutant tests) ──────────────────────────────────────
 *
 *   `guards: {validityCheck, coupling, groupFilter, speculativeSweep,
 *   deadEndPreference}` — all default `true`. Setting one `false` disables that
 *   GER guard so the property suite can show it catches the loss. Production
 *   callers never pass `guards`.
 */

export const ENTRANCE_TYPE = Object.freeze({ ONE_WAY: 'one_way', TWO_WAY: 'two_way' });

const DEFAULT_GUARDS = Object.freeze({
    validityCheck: true,
    coupling: true,
    groupFilter: true,
    speculativeSweep: true,
    deadEndPreference: true,
});

/** GER L13. `details` is the machine-readable half a caller retries from. */
export class EntranceRandomizationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'EntranceRandomizationError';
        this.details = details;
    }
}

const fail = (message, details) => { throw new EntranceRandomizationError(message, details); };

/** Groups are compared as strings, so `{1: [2]}` (an object's keys) and `group: 2` agree. */
const groupKey = (g) => String(g ?? 0);

const describe = (records) => records.map((r) => `${r.name} [group ${groupKey(r.group)}, ${r.region}]`).join(', ') || '(none)';

/** GER L18. Targets bucketed by group, in insertion order. */
export class GroupLookup {
    constructor() { this._lookup = new Map(); }
    get size() { let n = 0; for (const v of this._lookup.values()) n += v.length; return n; }
    get nonEmpty() { return this._lookup.size > 0; }
    get(group) { return this._lookup.get(groupKey(group)) ?? []; }
    set(group, list) { this._lookup.set(groupKey(group), list); }
    * [Symbol.iterator]() { for (const v of this._lookup.values()) yield* v; }
    add(target) {
        const k = groupKey(target.group);
        if (!this._lookup.has(k)) this._lookup.set(k, []);
        this._lookup.get(k).push(target);
    }
    remove(target) {
        const k = groupKey(target.group);
        const list = this._lookup.get(k);
        const i = list ? list.indexOf(target) : -1;
        if (i < 0) fail(`GroupLookup.remove: target ${target.name} is not in group ${k}.`, { target: target.name, group: k });
        list.splice(i, 1);
        if (list.length === 0) this._lookup.delete(k);
    }
}

/** GER L17: every unconnected ER target, split into dead ends and others. */
export class EntranceLookup {
    /**
     * @param {object} o.rng            `{shuffle(array) → new array}` (procgenRng's)
     * @param {boolean} o.coupled
     * @param {Set<string>} o.usableExitNames  GER's `usable_exits`
     * @param {object} o.structure      `{fixedOut: Map<region, region[]>, exitsByRegion: Map<region, exit[]>, progressionRegions: Set}`
     * @param {boolean} o.deadEndPreference  ⛔ mutant guard — false files every target as "others"
     */
    constructor({ rng, coupled, usableExitNames, structure, targets, deadEndPreference = true }) {
        this.deadEnds = new GroupLookup();
        this.others = new GroupLookup();
        this._rng = rng;
        this._coupled = coupled;
        this._usable = usableExitNames;
        this._structure = structure;
        this._cache = new Map();
        this._deadEndPreference = deadEndPreference;
        for (const t of targets) this.add(t);
    }

    /**
     * GER L65 `_can_expand_graph`: can entering through `target` reach a
     * randomizable exit (other than the target's own reverse, when coupled) or
     * a progression region? Walks fixed edges only; cached per target, so it is
     * judged on the graph as it was when the lookup was built — as in GER.
     */
    canExpandGraph(target) {
        if (this._cache.has(target.name)) return this._cache.get(target.name);
        const { fixedOut, exitsByRegion, progressionRegions } = this._structure;
        const seen = new Set([target.region]);
        const queue = [target.region];
        let result = false;
        outer: while (queue.length) {
            const region = queue.shift();
            if (progressionRegions.has(region)) { result = true; break; }
            for (const ex of exitsByRegion.get(region) ?? []) {
                if ((!this._coupled || ex.name !== target.name) && this._usable.has(ex.name)) {
                    result = true;
                    break outer;
                }
            }
            for (const next of fixedOut.get(region) ?? []) {
                if (!seen.has(next)) { seen.add(next); queue.push(next); }
            }
        }
        if (!this._deadEndPreference) result = true;
        this._cache.set(target.name, result);
        return result;
    }

    _bucket(target) { return this.canExpandGraph(target) ? this.others : this.deadEnds; }
    add(target) { this._bucket(target).add(target); }
    remove(target) { this._bucket(target).remove(target); }
    get size() { return this.deadEnds.size + this.others.size; }

    /** GER L120. ⚠ With `preserveGroupOrder` each group's list is reshuffled IN THE LOOKUP, as GER's in-place shuffle does. */
    getTargets(groups, deadEnd, preserveGroupOrder) {
        const lookup = deadEnd ? this.deadEnds : this.others;
        if (preserveGroupOrder) {
            const out = [];
            for (const g of groups) {
                const list = lookup.get(g);
                if (list.length === 0) continue;
                const shuffled = this._rng.shuffle(list);
                lookup.set(g, shuffled);
                out.push(...shuffled);
            }
            return out;
        }
        const all = [];
        for (const g of groups) all.push(...lookup.get(g));
        return this._rng.shuffle(all);
    }

    /** GER L144. */
    findTarget(name, group = null, deadEnd = null) {
        if (deadEnd === null) return this.findTarget(name, group, true) ?? this.findTarget(name, group, false);
        const lookup = deadEnd ? this.deadEnds : this.others;
        const pool = group === null ? lookup : lookup.get(group);
        for (const t of pool) if (t.name === name) return t;
        return null;
    }
}

/** BaseClasses.py L1226: by default, a reachability check. */
export function defaultIsValidSourceTransition(exit, state) {
    return state.reachableExits.has(exit.name);
}

/** BaseClasses.py L1237: same type, and no self-loop in coupled mode. */
export function defaultCanConnectTo(exit, target, _deadEnd, state) {
    return exit.type === target.type && (!state.coupled || exit.name !== target.name);
}

/** GER L169: the state of an ongoing or completed randomization. */
export class ERPlacementState {
    constructor({ reach, lookup, coupled, rng, structure, exitByName, targetsByRegion, guards, isValidSourceTransition }) {
        this.placements = [];
        this.couplings = [];
        this.coupled = coupled;
        this.entranceLookup = lookup;
        this._reach = reach;
        this._rng = rng;
        this._structure = structure;
        this._exitByName = exitByName;
        this._targetsByRegion = targetsByRegion;
        this._guards = guards;
        this._isValidSourceTransition = isValidSourceTransition;
        this.connectedExits = new Map(); // exit name → target name
        this.usedTargets = new Set();
        this._connections = [];
        this.refresh();
    }

    /** GER `update_reachable_regions` + `sweep_for_advancements`, via the injected callback. */
    refresh() {
        const r = this._evaluate(this._connections);
        this.reachableRegions = r.regions;
        this.reachableExits = r.exits;
    }

    _evaluate(connections) {
        const r = this._reach(connections.map((c) => ({ ...c })));
        if (!r || r.regions == null || r.exits == null) {
            fail('reach(connections) must return {regions, exits} (iterables of names).', {});
        }
        return { regions: new Set(r.regions), exits: new Set(r.exits) };
    }

    /** GER L204. */
    get placedRegions() { return this.reachableRegions; }

    /** GER L207. */
    findPlaceableExits(checkValidity, usableExits) {
        const open = usableExits.filter((ex) => !this.connectedExits.has(ex.name));
        const placeable = checkValidity
            ? open.filter((ex) => this.reachableExits.has(ex.name) && this._isValidSourceTransition(ex, this))
            : open;
        return this._rng.shuffle(placeable);
    }

    /** GER L220. */
    connectOneWay(exit, target) {
        this.connectedExits.set(exit.name, target.name);
        this.usedTargets.add(target.name);
        this._connections.push({ exit: exit.name, from: exit.region, to: target.region });
        this.placements.push({ exit: exit.name, target: target.name });
        this.entranceLookup.remove(target);
    }

    /** GER L231: would placing exit→target open a NEW, actually reachable usable exit? */
    testSpeculativeConnection(exit, target, usableExitNames) {
        const r = this._evaluate([...this._connections, { exit: exit.name, from: exit.region, to: target.region }]);
        for (const name of r.exits) {
            if (!usableExitNames.has(name)) continue;
            if (this.connectedExits.has(name)) continue;
            if (name === exit.name || (this.coupled && name === target.name)) continue;
            return true;
        }
        return false;
    }

    /** GER L259: connect, and in coupled mode connect the reverse too. */
    connect(exit, target) {
        this.connectOneWay(exit, target);
        if (this.coupled && this._guards.coupling && exit.type === ENTRANCE_TYPE.TWO_WAY) {
            const pair = `${exit.name} -> ${target.name}`;
            const reverseEntrance = (this._targetsByRegion.get(exit.region) ?? []).find((t) => t.name === exit.name);
            if (!reverseEntrance) {
                fail(`Two way exit ${exit.name} had no corresponding entrance in ${exit.region}.`,
                    { stage: 'coupling', exits: [exit.name], groups: [groupKey(exit.group)] });
            }
            if (this.usedTargets.has(reverseEntrance.name)) {
                fail(`Could not perform coupling on ${pair} because the reverse entrance is already placed.`,
                    { stage: 'coupling', exits: [exit.name], groups: [groupKey(exit.group)] });
            }
            const reverseExit = this._exitByName.get(target.name);
            if (!reverseExit || reverseExit.region !== target.region) {
                fail(`Two way entrance ${target.name} had no corresponding exit in ${target.region}.`,
                    { stage: 'coupling', exits: [exit.name], groups: [groupKey(exit.group)] });
            }
            if (this.connectedExits.has(reverseExit.name)) {
                fail(`Could not perform coupling on ${pair} because the reverse exit is already connected.`,
                    { stage: 'coupling', exits: [exit.name, reverseExit.name], groups: [groupKey(exit.group)] });
            }
            this.connectOneWay(reverseExit, reverseEntrance);
            this.couplings.push([exit.name, reverseExit.name]);
            return { placedExits: [exit, reverseExit], pairedTargets: [target, reverseEntrance] };
        }
        return { placedExits: [exit], pairedTargets: [target] };
    }
}

/**
 * GER L302: `{group: getTargetGroups(group)}` over every group a shufflable
 * exit carries. Returns a Map keyed by the group as a string.
 */
export function bakeTargetGroupLookup(exits, getTargetGroups) {
    const out = new Map();
    for (const ex of exits) {
        const k = groupKey(ex.group);
        if (!out.has(k)) out.set(k, getTargetGroups(ex.group));
    }
    return out;
}

/**
 * GER L316 as a PURE transform over a plain graph (the `makePlainGraphReach`
 * shape: `{exits:[{name, from, to, requires?, type?, group?}], …}`). Each
 * named exit becomes shufflable: its `to` is cleared and an ER target is
 * created —
 *   two-way: a target NAMED LIKE THE EXIT, in the exit's OWN region (so the
 *            reverse direction's exit, disconnected too, finds it — GER's
 *            coupled naming contract, L338-341);
 *   one-way: a target in the CHILD region named `oneWayTargetName(exit)`
 *            (required, as GER requires it, L345).
 * `targetGroup(exit)` overrides the target's group (GER's `target_group`).
 *
 * Returns `{graph, exits, targets, fixedEdges}`: the disconnected graph (input
 * untouched), the shufflable exit records, the targets and the remaining fixed
 * edges — exactly what `randomizeEntrances` takes, plus the graph its
 * `reach` adapter is built from.
 */
export function disconnectForRandomization(graph, exitNames, { targetGroup = null, oneWayTargetName = null } = {}) {
    const names = new Set(exitNames);
    const exits = [];
    const targets = [];
    const fixedEdges = [];
    const newExits = graph.exits.map((ex) => {
        if (!names.has(ex.name)) {
            if (ex.to != null) fixedEdges.push({ from: ex.from, to: ex.to });
            return { ...ex };
        }
        if (ex.to == null) fail(`disconnectForRandomization: exit ${ex.name} is already disconnected.`, { exits: [ex.name] });
        const type = ex.type ?? ENTRANCE_TYPE.TWO_WAY;
        const group = ex.group ?? 0;
        exits.push({ name: ex.name, region: ex.from, type, group });
        let target;
        if (type === ENTRANCE_TYPE.TWO_WAY) {
            target = { name: ex.name, region: ex.from };
        } else {
            const tn = oneWayTargetName ? oneWayTargetName(ex) : null;
            if (!tn) fail(`disconnectForRandomization: one-way exit ${ex.name} needs a target name (GER L345).`, { exits: [ex.name] });
            target = { name: tn, region: ex.to };
        }
        targets.push({ ...target, type, group: targetGroup ? targetGroup(ex) ?? group : group });
        return { ...ex, to: null };
    });
    names.forEach((n) => {
        if (!graph.exits.some((ex) => ex.name === n)) fail(`disconnectForRandomization: no exit named ${n}.`, { exits: [n] });
    });
    return { graph: { ...graph, exits: newExits }, exits, targets, fixedEdges };
}

function lookupGroups(targetGroupLookup, group) {
    if (targetGroupLookup instanceof Map) return targetGroupLookup.get(groupKey(group)) ?? targetGroupLookup.get(group);
    return targetGroupLookup?.[groupKey(group)];
}

function uniqueByName(records, kind) {
    const byName = new Map();
    for (const r of records) {
        if (byName.has(r.name)) fail(`randomizeEntrances: two ${kind}s are named ${r.name}. Names are identities here, as in GER's pairings.`, { [kind + 's']: [r.name] });
        if (r.type !== ENTRANCE_TYPE.ONE_WAY && r.type !== ENTRANCE_TYPE.TWO_WAY) {
            fail(`randomizeEntrances: ${kind} ${r.name} has type ${JSON.stringify(r.type)}; expected 'one_way' or 'two_way'.`, { [kind + 's']: [r.name] });
        }
        byName.set(r.name, r);
    }
    return byName;
}

/**
 * GER L352. Randomizes the shufflable exits onto the targets.
 *
 * @param {object} o
 * @param {Array} o.exits    shufflable exits, in a DETERMINISTIC order
 * @param {Array} o.targets  ER targets, in a deterministic order
 * @param {Array} [o.fixedEdges=[]]           `[{from, to}]`
 * @param {Iterable} [o.progressionRegions=[]]
 * @param {Function} o.reach                  see the file docblock
 * @param {object} o.rng                      `{shuffle(array) → new array}`; procgenRng's `ProcgenRng`
 * @param {boolean} o.coupled
 * @param {Map|object} o.targetGroupLookup    group → groups it may connect to; every exit group must be present
 * @param {boolean} [o.preserveGroupOrder=false]
 * @param {Function} [o.onConnect]            (state, placedExits, pairedTargets) → true when it changed the graph
 * @param {Function} [o.minimalAccessibilityBypass]  (state) → true lets a deadlocked run drop validity checks (GER L486-502)
 * @param {Function} [o.canConnectTo]         override of `defaultCanConnectTo`
 * @param {Function} [o.isValidSourceTransition] override of `defaultIsValidSourceTransition`
 * @param {object} [o.guards]                 mutant switches — see the file docblock
 * @returns {{placements, couplings, reachableRegions: string[], draws}}
 */
export function randomizeEntrances({
    exits,
    targets,
    fixedEdges = [],
    progressionRegions = [],
    reach,
    rng,
    coupled,
    targetGroupLookup,
    preserveGroupOrder = false,
    onConnect = null,
    minimalAccessibilityBypass = null,
    canConnectTo = defaultCanConnectTo,
    isValidSourceTransition = defaultIsValidSourceTransition,
    guards: guardOverrides = {},
} = {}) {
    const guards = { ...DEFAULT_GUARDS, ...guardOverrides };
    if (typeof reach !== 'function') fail('randomizeEntrances: `reach(connections)` is required — the core has no reachability engine.', {});
    if (typeof rng?.shuffle !== 'function') fail('randomizeEntrances: `rng` must offer shuffle(array) → new array (procgenRng\'s ProcgenRng).', {});
    if (typeof coupled !== 'boolean') fail('randomizeEntrances: `coupled` must be true or false.', {});
    if (!Array.isArray(exits) || !Array.isArray(targets)) fail('randomizeEntrances: `exits` and `targets` must be arrays.', {});
    if (exits.length !== targets.length) {
        fail(`Unable to randomize entrances due to a mismatched count of entrances (${targets.length}) and exits (${exits.length}).`,
            { stage: 'precondition', exits: exits.map((e) => e.name), targets: targets.map((t) => t.name) });
    }
    const exitByName = uniqueByName(exits, 'exit');
    uniqueByName(targets, 'target');
    for (const ex of exits) {
        const groups = lookupGroups(targetGroupLookup, ex.group);
        if (!Array.isArray(groups) || groups.length === 0) {
            fail(`randomizeEntrances: targetGroupLookup has no target groups for group ${groupKey(ex.group)} (exit ${ex.name}). Every exit group must map to at least one group.`,
                { stage: 'precondition', exits: [ex.name], groups: [groupKey(ex.group)] });
        }
    }
    const allGroups = [...new Set(targets.map((t) => groupKey(t.group)))];

    const fixedOut = new Map();
    for (const e of fixedEdges) {
        if (!fixedOut.has(e.from)) fixedOut.set(e.from, []);
        fixedOut.get(e.from).push(e.to);
    }
    const exitsByRegion = new Map();
    for (const ex of exits) {
        if (!exitsByRegion.has(ex.region)) exitsByRegion.set(ex.region, []);
        exitsByRegion.get(ex.region).push(ex);
    }
    const targetsByRegion = new Map();
    for (const t of targets) {
        if (!targetsByRegion.has(t.region)) targetsByRegion.set(t.region, []);
        targetsByRegion.get(t.region).push(t);
    }
    const structure = { fixedOut, exitsByRegion, progressionRegions: new Set(progressionRegions) };
    const usableExitNames = new Set(exitByName.keys());

    let performValidityCheck = guards.validityCheck;

    const lookup = new EntranceLookup({
        rng, coupled, usableExitNames, structure, targets, deadEndPreference: guards.deadEndPreference,
    });
    const state = new ERPlacementState({
        reach, lookup, coupled, rng, structure, exitByName, targetsByRegion, guards, isValidSourceTransition,
    });

    const failureDetails = (extra) => ({
        ...extra,
        unplacedExits: exits.filter((e) => !state.connectedExits.has(e.name)).map((e) => e.name),
        unplacedTargets: targets.filter((t) => !state.usedTargets.has(t.name)).map((t) => t.name),
        placements: state.placements.map((p) => ({ ...p })),
        draws: rng.draws ?? null,
    });

    // GER L412
    const doPlacement = (exit, target) => {
        const { placedExits, pairedTargets } = state.connect(exit, target);
        state.refresh();
        if (onConnect && onConnect(state, placedExits, pairedTargets)) state.refresh();
    };

    // GER L423
    const needsSpeculativeSweep = (deadEnd, requireNewExits, placeable) => {
        if (!guards.speculativeSweep) return false;
        if (placeable.length > 1) return false;
        if (deadEnd || !requireNewExits || !performValidityCheck) return false;
        let isLastPlacement;
        if (!coupled) {
            isLastPlacement = state.entranceLookup.size === 1;
        } else {
            const desired = placeable[0].type === ENTRANCE_TYPE.TWO_WAY ? 2 : 1;
            isLastPlacement = state.entranceLookup.size === desired;
        }
        return !isLastPlacement;
    };

    // GER L451
    const findPairing = (deadEnd, requireNewExits, stage) => {
        const placeable = state.findPlaceableExits(performValidityCheck, exits);
        for (const exit of placeable) {
            const groups = guards.groupFilter ? lookupGroups(targetGroupLookup, exit.group) : allGroups;
            for (const target of state.entranceLookup.getTargets(groups, deadEnd, preserveGroupOrder)) {
                const exitRequirementSatisfied = !performValidityCheck || !requireNewExits
                    || !state.placedRegions.has(target.region);
                if (exitRequirementSatisfied && canConnectTo(exit, target, deadEnd, state)) {
                    if (needsSpeculativeSweep(deadEnd, requireNewExits, placeable)
                        && !state.testSpeculativeConnection(exit, target, usableExitNames)) {
                        continue;
                    }
                    doPlacement(exit, target);
                    return true;
                }
            }
        }
        // No source exit had a valid target: this stage is deadlocked (GER L471).
        const pool = deadEnd ? state.entranceLookup.deadEnds : state.entranceLookup.others;
        if (requireNewExits) {
            let allPlaced = true;
            for (const t of pool) if (!state.placedRegions.has(t.region)) { allPlaced = false; break; }
            if (allPlaced) return false; // the stage succeeded (GER L479-481)
        }
        if (performValidityCheck && minimalAccessibilityBypass && minimalAccessibilityBypass(state)) {
            performValidityCheck = false; // GER L486-502: retry the stage without validity
            return true;
        }
        const poolTargets = [...pool];
        const stranded = exits.filter((e) => !state.connectedExits.has(e.name));
        const groups = [...new Set([...placeable, ...stranded].map((e) => groupKey(e.group)))];
        fail(
            'None of the available entrances are valid targets for the available exits.\n'
            + `Randomization stage ${stage} is placing ${deadEnd ? 'dead ends' : 'non-dead ends'} and `
            + `${requireNewExits ? 'requires' : 'does not require'} new region/exit access by default\n`
            + `Placeable entrances: ${describe(poolTargets)}\n`
            + `Placeable exits: ${describe(placeable)}\n`
            + `Stranded (unplaced) exits: ${describe(stranded)}\n`
            + `Groups: ${groups.join(', ')}`,
            failureDetails({
                stage, deadEnd, requireNewExits,
                placeableExits: placeable.map((e) => e.name),
                placeableTargets: poolTargets.map((t) => t.name),
                strandedExits: stranded.map((e) => ({ name: e.name, group: groupKey(e.group), region: e.region })),
                groups,
            }),
        );
        return false; // unreachable
    };

    // GER L519-535. Each loop either places (shrinking the lookup), returns
    // false (stages 1/2 only), or throws — so none can spin.
    while (state.entranceLookup.others.nonEmpty) {
        if (!findPairing(false, true, '1 (non-dead ends, new regions)')) break;
    }
    while (state.entranceLookup.deadEnds.nonEmpty) {
        if (!findPairing(true, true, '2 (dead ends, new regions)')) break;
    }
    while (state.entranceLookup.deadEnds.nonEmpty) findPairing(true, false, '3a (remaining dead ends)');
    while (state.entranceLookup.others.nonEmpty) findPairing(false, false, '3b (remaining loose ends)');

    return {
        placements: state.placements.map((p) => ({ ...p })),
        couplings: state.couplings.map((c) => [...c]),
        reachableRegions: [...state.reachableRegions].sort(),
        draws: rng.draws ?? null,
    };
}

/**
 * THE TEST ADAPTER: a tiny evaluator over a plain graph —
 *
 *   { start: [region], exits: [{name, from, to|null, requires?: [item]}],
 *     locations: [{name, region, requires?: [item], item?: string|null}],
 *     startItems?: [item] }
 *
 * `requires` is a conjunction of item names. Returns a `reach(connections)`
 * that fills each connection's exit `to`, then iterates regions ⇄ items to the
 * fixed point (GER's update_reachable_regions + sweep_for_advancements). The
 * result also carries `locations` and `items`, which the core ignores and the
 * property suite reads.
 *
 * ⛔ Not the production evaluator. E4 binds `shared/procgen/forwardSimulator.js`
 * (the one `generateSphereLog` walks) instead.
 */
export function makePlainGraphReach(graph) {
    const start = graph.start ?? [];
    return function reach(connections = []) {
        const to = new Map();
        for (const c of connections) to.set(c.exit, c.to);
        const items = new Set(graph.startItems ?? []);
        const regions = new Set(start);
        const has = (req) => (req ?? []).every((i) => items.has(i));
        let changed = true;
        while (changed) {
            changed = false;
            for (const ex of graph.exits) {
                if (!regions.has(ex.from)) continue;
                const dest = ex.to ?? to.get(ex.name);
                if (dest == null || regions.has(dest) || !has(ex.requires)) continue;
                regions.add(dest);
                changed = true;
            }
            for (const loc of graph.locations ?? []) {
                if (loc.item == null || items.has(loc.item) || !regions.has(loc.region) || !has(loc.requires)) continue;
                items.add(loc.item);
                changed = true;
            }
        }
        const exits = graph.exits.filter((ex) => regions.has(ex.from) && has(ex.requires)).map((ex) => ex.name);
        const locations = (graph.locations ?? []).filter((l) => regions.has(l.region) && has(l.requires)).map((l) => l.name);
        return { regions, exits, locations, items };
    };
}

/** The progression regions of a plain graph: those holding an item-bearing location (GER L89-93). */
export function plainGraphProgressionRegions(graph) {
    return [...new Set((graph.locations ?? []).filter((l) => l.item != null).map((l) => l.region))];
}
