/**
 * ⛓ RULES rules-l63-darktrap-census — the PURE half of `census-seedling-darktrap-gates.mjs`: what the sub-region
 * partition would be if a live DarkTrap body were an analyzer GATE on the flag of the pole whose light kills it
 * (option (b) for the L63 r6c9 → r0c1 framing row, ⚖ user 2026-11-02). Report-only: nothing here is read by a producer.
 *
 * THE GAME (vendor/seedling/src):
 *   - `Enemies/DarkTrap.as:27-54` — each tick a DarkTrap looks for a `Light` that is not a `PlayerLight`, not a
 *     `darkLight`, within the light's `radiusMin`; the first such tick sets `startDying` and skips `super.update()`
 *     from then on (the trap stops biting). `:56-59` — `hit()` is empty: no weapon kills it. `:72-78` — after the
 *     `die1` animation it removes itself, and `Enemies/SandTrap.as:82-86` (`removed()`) writes its own tag then, so
 *     the trap is gone for good on later visits.
 *   - `Scenery/LightPole.as:41` — the pole's `Light` has `radiusMin` 28; `:50` — the pole is built lit from its own
 *     persistence tag; `:77-84` — `hit()` TOGGLES it (a Spear thrust, or a Ghost Sword swing that hits as "Spear");
 *     `:94-97` — the setter writes the tag at once. So the pole's tag (its AP event) carries the kill to the next
 *     visit even when the player leaves before the trap's own removal writes its tag.
 * So a trap's body is a barrier exactly until a pole that reaches it is lit, and lighting persists: an AP event.
 *
 * Nothing here knows Seedling's levels: the caller (the census script) supplies the producer's own grid, analyzer
 * options and analyses; this module patches a grid, wraps the options, compares two analyses, and sweeps spheres.
 */

/** The synthetic condition a gated DarkTrap cell carries: Or over the clearing events, Or the side's arm (if any). */
export function trapGateCondition(events, arm = null) {
    return { darktrapGate: [...events].sort(), ...(arm ? { arm } : {}) };
}

const isTrapGate = (c) => Array.isArray(c?.darktrapGate);

/** The rule a trap gate resolves to: `Or(Has(event)…, arm)`, flattened to one child when there is one. */
export function trapGateRule(c) {
    const ways = [...c.darktrapGate.map((n) => ({ rule: 'Has', args: { item_name: n } })), ...(c.arm ? [c.arm] : [])];
    return ways.length === 1 ? ways[0] : { rule: 'Or', children: ways };
}

/** The analyzer options with the trap gate in the vocabulary (`conditionKey` / `resolveCondition`); else the base's. */
export function trapGateOptions(base) {
    return {
        ...base,
        conditionKey: (c) => (isTrapGate(c) ? `darktrap:${c.darktrapGate.join('|')}${c.arm ? `|${JSON.stringify(c.arm)}` : ''}` : base.conditionKey(c)),
        resolveCondition: (c) => (isTrapGate(c) ? trapGateRule(c) : base.resolveCondition(c)),
    };
}

const DIRS = Object.freeze({ N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] });

/**
 * The grid with every trap's body tiles gated. `traps`: `[{tiles: [[x,y]…], events: [name…], armFrom?}]`.
 * Without `armFrom` (option (b) as specified) the cell's own conditions take `trapGateCondition(events)`: every step
 * onto it costs a clearing event. With `armFrom(neighbourTile)` → arm rule | null (the scoped variant), the cell is
 * gated on ENTRY per direction (`cell.enter`, read from the entered cell only): entering from a neighbour costs the
 * event OR the arm a stance on that neighbour's side gives. A tile outside the grid, or a wall, is left alone.
 */
export function trapGatedGrid(grid, traps) {
    const cells = grid.cells.slice();
    const ox = grid.origin?.x ?? 0;
    const oy = grid.origin?.y ?? 0;
    for (const t of traps) {
        for (const [tx, ty] of t.tiles) {
            const x = tx - ox;
            const y = ty - oy;
            if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
            const cell = cells[y * grid.width + x];
            if (cell.kind === 'wall') continue;
            if (!t.armFrom) {
                cells[y * grid.width + x] = { ...cell, kind: 'gated', conditions: [...(cell.conditions ?? []), trapGateCondition(t.events)] };
                continue;
            }
            const enter = { ...(cell.enter ?? {}) };
            for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
                // Entering moving `dir` comes FROM the neighbour opposite it.
                const from = [tx - dx, ty - dy];
                const own = enter[dir];
                if (own === null) continue;
                const gate = trapGateCondition(t.events, t.armFrom(from));
                enter[dir] = own === undefined ? gate : [...(Array.isArray(own) ? own : [own]), gate];
            }
            cells[y * grid.width + x] = { ...cell, kind: 'gated', enter };
        }
    }
    return { ...grid, cells };
}

/**
 * The producer's pocket pruning (`pruneUnreachableSubRegions`), on an analysis: the components an exit binds or a row
 * reaches from one (rules ignored), plus those holding a location. Returns the kept ids, sorted as the analysis sorts.
 */
export function keptComponents(analysis, { start = null } = {}) {
    const entries = new Set(analysis.bindings.filter((b) => b.kind === 'exit' && b.component).map((b) => b.component.id));
    if (start) entries.add(start);
    const out = new Map();
    const link = (a, b) => { if (!out.has(a)) out.set(a, []); out.get(a).push(b); };
    for (const r of analysis.internal_exits) {
        link(r.from, r.to);
        if (r.bidirectional === true) link(r.to, r.from);
    }
    const reach = new Set(entries);
    const queue = [...entries];
    while (queue.length) for (const n of out.get(queue.pop()) ?? []) if (!reach.has(n)) { reach.add(n); queue.push(n); }
    for (const b of analysis.bindings) if (b.kind === 'location' && b.component) reach.add(b.component.id);
    return analysis.components.map((c) => c.id).filter((id) => reach.has(id));
}

/**
 * Compare a baseline analysis with a gated one over the same region. `baseSubs` / `gatedSubs`: each analysis's kept
 * components (`keptComponents`). Returns, per baseline sub-region, the gated kept components that cover its tiles
 * (`pieces`, largest first), the gated rows that are new (no baseline row between the same ids with the same rule),
 * the baseline rows that are gone, the bindings that moved component, and how many baseline cells fell out of every
 * kept component.
 */
export function comparePartitions(base, gated, { baseSubs, gatedSubs }) {
    const owner = (analysis, keep, i) => {
        const c = analysis.componentsResult.indexOf[i];
        if (c < 0) return null;
        const id = analysis.componentsResult.components[c].id;
        return keep.includes(id) ? id : null;
    };
    const pieces = new Map(baseSubs.map((s) => [s, new Map()]));
    let lostCells = 0;
    for (let i = 0; i < base.componentsResult.indexOf.length; i += 1) {
        const b = owner(base, baseSubs, i);
        if (!b) continue;
        const g = owner(gated, gatedSubs, i);
        if (g) pieces.get(b).set(g, (pieces.get(b).get(g) ?? 0) + 1);
        else lostCells += 1;
    }
    const rowKey = (r) => `${r.from}|${r.to}|${r.bidirectional === true}|${JSON.stringify(r.access_rule)}`;
    const kept = (subs) => (r) => subs.includes(r.from) && subs.includes(r.to);
    const baseRows = base.internal_exits.filter(kept(baseSubs));
    const gatedRows = gated.internal_exits.filter(kept(gatedSubs));
    const baseKeys = new Set(baseRows.map(rowKey));
    const gatedKeys = new Set(gatedRows.map(rowKey));
    const gb = new Map(gated.bindings.map((b) => [`${b.kind}|${b.id}`, b]));
    const moved = [];
    for (const b of base.bindings) {
        const was = b.component && baseSubs.includes(b.component.id) ? b.component.id : null;
        const g = gb.get(`${b.kind}|${b.id}`);
        const now = g?.component && gatedSubs.includes(g.component.id) ? g.component.id : null;
        if (was !== now) moved.push({ kind: b.kind, id: b.id, tile: b.tile, from: was, to: now });
    }
    return {
        pieces: [...pieces].map(([sub, m]) => ({ sub, pieces: [...m].map(([id, size]) => ({ id, size })).sort((a, b) => (b.size - a.size) || a.id.localeCompare(b.id)) })),
        newRows: gatedRows.filter((r) => !baseKeys.has(rowKey(r))),
        goneRows: baseRows.filter((r) => !gatedKeys.has(rowKey(r))),
        moved,
        lostCells,
    };
}

/**
 * Classify one trap's gating, from its `comparePartitions` result and the undecided reasons the caller found:
 *   (iv) can't be decided (`undecided` non-empty: why);
 *   (iii) an exit or a location moves sub-region (its access now crosses the gate);
 *   (ii) a sub-region splits, nothing bound moves (an empty piece splits off: a new internal crossing);
 *   (i) no change.
 */
export function classifyTrapGate(cmp, undecided = []) {
    if (undecided.length > 0) return 'iv';
    if (cmp.moved.length > 0) return 'iii';
    if (cmp.pieces.some((p) => p.pieces.length > 1) || cmp.newRows.length > 0 || cmp.lostCells > 0) return 'ii';
    return 'i';
}

// ── a rule evaluator and an AP sphere sweep over a compiled rules graph ───────

/** Evaluate a Rule Builder / exporter rule tree against an inventory (`Map name → count`). */
export function evalRule(rule, inv) {
    if (!rule) return true;
    const has = (n, k = 1) => (inv.get(n) ?? 0) >= k;
    switch (rule.rule) {
        case 'True_': return true;
        case 'False_': return false;
        case 'Has': return has(rule.args.item_name, rule.args.count ?? 1);
        case 'HasAll': return rule.args.item_names.every((n) => has(n));
        case 'HasAny': return rule.args.item_names.some((n) => has(n));
        case 'HasAllCounts': return Object.entries(rule.args.item_counts).every(([n, k]) => has(n, k));
        case 'HasAnyCount': return Object.entries(rule.args.item_counts).some(([n, k]) => has(n, k));
        case 'And': return rule.children.every((c) => evalRule(c, inv));
        case 'Or': return rule.children.some((c) => evalRule(c, inv));
        default: throw new Error(`evalRule: unknown rule "${rule.rule}"`);
    }
}

/**
 * AP's sphere sweep (`MultiWorld.get_spheres`): sphere k holds every location reachable with the items of the spheres
 * before it, events included as locations. `regions`: `Map name → {exits: [{to, rule}]}`; `locations`:
 * `[{name, item, sources: [{region, rule}]}]` (a location with several sources is reachable from any of them).
 * Returns `Map location → sphere` and `Map region → first sphere it is reachable in`.
 */
export function sphereSweep({ regions, start, locations }) {
    const inv = new Map();
    const sphereOf = new Map();
    const regionSphere = new Map();
    for (let k = 0; k < 10_000; k += 1) {
        const reach = new Set([start]);
        const queue = [start];
        while (queue.length) {
            const r = queue.pop();
            for (const e of regions.get(r)?.exits ?? []) {
                if (reach.has(e.to) || !evalRule(e.rule, inv)) continue;
                reach.add(e.to);
                queue.push(e.to);
            }
        }
        for (const r of reach) if (!regionSphere.has(r)) regionSphere.set(r, k);
        const fresh = locations.filter((l) => !sphereOf.has(l.name) && l.sources.some((s) => reach.has(s.region) && evalRule(s.rule, inv)));
        if (fresh.length === 0) break;
        for (const l of fresh) {
            sphereOf.set(l.name, k);
            if (l.item) inv.set(l.item, (inv.get(l.item) ?? 0) + 1);
        }
    }
    return { sphereOf, regionSphere };
}

/** The locations whose sphere differs between two sweeps (absent = unreachable), sorted by name. */
export function sphereMoves(a, b) {
    const names = [...new Set([...a.sphereOf.keys(), ...b.sphereOf.keys()])].sort();
    return names.filter((n) => a.sphereOf.get(n) !== b.sphereOf.get(n))
        .map((n) => ({ location: n, before: a.sphereOf.get(n) ?? null, after: b.sphereOf.get(n) ?? null }));
}

/** Remove one conjunct (by structure) from a rule: the rule itself → True_, a child of an And → dropped. */
export function withoutConjunct(rule, conjunct) {
    const key = JSON.stringify(conjunct);
    if (JSON.stringify(rule) === key) return { rule: 'True_' };
    if (rule?.rule !== 'And') return rule;
    const kept = rule.children.filter((c) => JSON.stringify(c) !== key);
    if (kept.length === rule.children.length) return rule;
    return kept.length === 0 ? { rule: 'True_' } : kept.length === 1 ? kept[0] : { rule: 'And', children: kept };
}
