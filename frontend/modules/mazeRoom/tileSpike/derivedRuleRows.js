/**
 * ⛓ THE DERIVED-RULES TABLE (session tile-rules-automation-r-a1, ⚖ Robert 2026-11-02: "Route A, R-A1 first (Recommended)").
 * The certifier's returned rows (`certifyPlaythroughMaze(…, {rows: true})`) become one ELEMENT ROW per AP element per
 * arrival — an AP exit, a location, or an in-world pair — each carrying its derived rule, today's rule and ONE label:
 *
 *   - `problem`           the certifier reports the row it sits in (the maze and the rules disagree; a named open row);
 *   - `echoed`            today's rule is COPIED into the maze payload (the sentinel method, `seedlingEchoSentinels.js`):
 *                         the derivation reads it back, so agreement there holds by construction and is no evidence;
 *   - `arrival-dependent` the element's derived rule differs between the cells it is priced from (L91 → L89 r1c10 lands
 *                         free at (1,8) and needs Swim at (15,4)): no one region rule is exact;
 *   - `path-vs-edge`      the derived rule is not today's rule, yet the certifier agrees: the derivation prices the whole
 *                         PATH from an arrival, the rules the EDGE (L15's chest = Swim, the edge into r6c8 carries it);
 *   - `derived`           the derived rule equals today's, truth table for truth table, independently of the rule.
 *
 * ⛓ An EXPLAINED problem (`explained`): a certifier problem whose cause a census has named is labelled by that cause, not
 * `problem`, and keeps `verdict: 'problem'` and the reason (`explainedBy`). OPEN_L63 (r6c9 → r0c1) is the one: a
 * partition-granularity row under block state — r0c1's foothold groups (6,6), which the Spear reaches, with (5,5), which
 * needs L63 flag 1 once the spear block is parked on (5,6) (rules-4's Q4 DarkTrap census, session rules-l63-darktrap-census;
 * designer tile-primitives-design-2, 2026-11-02: "Label it path-vs-edge (block-state framing)"). Matched by the certifier's
 * row label, exactly.
 *
 * The labels are exclusive and taken in that order, so an echo is never counted as agreement and a problem is never
 * hidden behind an echo. The facts behind them (`echoed`, `arrivalDependent`, `compare`, `overridable`, `verdict`) ride
 * along on every row (`partial`: the row skipped points, so its verdict covers only `counts.compared` of them; an
 * element with a partial row is never `overridable`), for rules-4's per-approach charge (Q2) and the override (R-A3) to filter on. Pure: no I/O.
 */

/** The labels, in precedence order. */
export const DERIVED_ROW_LABELS = Object.freeze(['problem', 'echoed', 'arrival-dependent', 'path-vs-edge', 'derived']);

const FALSE = { rule: 'False_' };

const itemLevels = (rule, out = new Map()) => {
    if (rule?.rule === 'Has') {
        const i = rule.args.item_name;
        if (!out.has(i)) out.set(i, new Set([0]));
        out.get(i).add(rule.args.count ?? 1);
    }
    for (const c of rule?.children ?? []) itemLevels(c, out);
    return out;
};

const holds = (rule, inv) => {
    switch (rule?.rule) {
    case undefined: case 'True_': return true;
    case 'False_': return false;
    case 'Has': return (inv.get(rule.args.item_name) ?? 0) >= (rule.args.count ?? 1);
    case 'And': return rule.children.every((c) => holds(c, inv));
    case 'Or': return rule.children.some((c) => holds(c, inv));
    default: throw new Error(`derived rows: rule kind ${rule.rule} is not one a derived or atlas row carries`);
    }
};

/**
 * `a` against `b` over every count point either names: 'equal', 'stricter' (a refuses a point b admits, never the other
 * way), 'looser', or 'incomparable'.
 */
export function compareRules(a, b) {
    const levels = itemLevels(b, itemLevels(a));
    let points = [new Map()];
    for (const [item, counts] of levels) points = points.flatMap((p) => [...counts].map((n) => new Map([...p, [item, n]])));
    let looser = false;
    let stricter = false;
    for (const p of points) {
        const x = holds(a, p);
        const y = holds(b, p);
        if (x && !y) looser = true;
        if (!x && y) stricter = true;
    }
    if (looser && stricter) return 'incomparable';
    return looser ? 'looser' : stricter ? 'stricter' : 'equal';
}

const same = (a, b) => compareRules(a, b) === 'equal';

/** The element key of an AP exit / a location / an in-world pair — what `findEchoes` returns for exits and locations. */
export const exitKey = (region, exit) => `${region}|${exit}`;
export const locationKey = (region, location) => `${region}|@${location}`;
export const pairKey = (from, to) => `${from}|>${to}`;

/** The members of `region`'s shared world in a compiled maze document, or null for a plain world. */
function sharedMembersOf(rules) {
    const SIDECARS = rules.preset_sidecars['1'];
    const out = new Map();
    for (const [name, sc] of Object.entries(SIDECARS)) {
        const own = sc.playable_payload ?? Object.values(SIDECARS).find((s) => s.playable_payload && s.shared_world === sc.shared_world)?.playable_payload;
        out.set(name, own?.shared_world?.regions ?? null);
    }
    return out;
}

/**
 * Label the certifier's rows.
 *
 * @param {object[]} rows `certifyPlaythroughMaze(…, {rows: true}).rows`
 * @param {{rules: object, echoes: Set<string>, explained?: {label: string, as: string, why: string}[]}} opts `rules` = the
 *   compiled maze document the rows came from (its AP regions and shared worlds); `echoes` = the AP element keys whose rule
 *   the maze payload copies (`findEchoes`); `explained` = the named problems (above), by certifier row label
 * @returns {{elements: object[], regions: Map<string, object>}} one row per element per arrival, and per region its
 *   arrivals and its Route A class ('overridable', 'internal-only', 'several arrivals', 'walk-in from another member')
 */
export function labelDerivedRows(rows, { rules, echoes, explained = [], lockEvents = new Set() }) {
    for (const x of explained) {
        if (!DERIVED_ROW_LABELS.includes(x.as) || x.as === 'problem') throw new Error(`derived rows: an explained problem's label must be one of the others, got ${x.as}`);
    }
    const why = new Map(explained.map((x) => [x.label, x]));
    const REGIONS = rules.regions['1'];
    const members = sharedMembersOf(rules);
    const elements = [];
    for (const row of rows) {
        const skippedPoints = (row.counts?.unadmitted ?? 0) + (row.counts?.ownEvent ?? 0);
        const base = { arrival: row.arrival, verdict: row.verdict, by: row.by, problem: row.problem, certifierLabel: row.label,
            counts: row.counts, partial: skippedPoints > 0 };
        if (row.kind === 'location') {
            elements.push({ ...base, kind: 'location', key: locationKey(row.region, row.name), region: row.region, name: row.name,
                event: row.event, derived: row.derived, ap: row.ap, echoed: echoes.has(locationKey(row.region, row.name)) });
        } else if (row.kind === 'exit') {
            for (const x of row.exits) {
                elements.push({ ...base, kind: 'exit', key: exitKey(row.region, x.name), region: row.region, name: x.name, target: row.name,
                    derived: x.derived, ap: x.ap, echoed: echoes.has(exitKey(row.region, x.name)) });
            }
        } else if (row.kind === 'pair') {
            elements.push({ ...base, kind: 'pair', key: pairKey(row.region, row.name), region: row.region, name: row.name, target: row.name,
                derived: row.derived, ap: row.ap, direct: row.exits.map((x) => x.name),
                echoed: row.exits.some((x) => echoes.has(exitKey(row.region, x.name))) });
        } else {
            throw new Error(`derived rows: unknown row kind ${row.kind}`);
        }
    }
    // ARRIVAL DEPENDENCE: an element priced from 2+ arrivals whose derived rules differ.
    const byKey = new Map();
    for (const e of elements) {
        if (!byKey.has(e.key)) byKey.set(e.key, []);
        byKey.get(e.key).push(e);
    }
    for (const group of byKey.values()) {
        const dependent = group.some((e) => !same(e.derived, group[0].derived));
        const partial = group.some((e) => e.partial);
        for (const e of group) { e.arrivalDependent = dependent; e.elementPartial = partial; }
    }
    // ROUTE A's class per region (the sizing's `overridable` test): ONE arrival, rooted (not priced from another member),
    // and never walked into from another member of its shared world.
    const regions = new Map();
    for (const e of elements) {
        if (e.kind === 'pair') continue;
        if (!regions.has(e.region)) regions.set(e.region, { arrivals: new Set(), elements: new Set() });
        regions.get(e.region).arrivals.add(e.arrival);
        regions.get(e.region).elements.add(e.key);
    }
    for (const [name, r] of regions) {
        const shared = members.get(name);
        const walkIn = Boolean(shared) && shared.some((o) => o !== name && (REGIONS[o]?.exits ?? []).some((x) => x.connected_region === name));
        r.class = [...r.arrivals].some((a) => a.startsWith('from ')) ? 'internal-only'
            : r.arrivals.size > 1 ? 'several arrivals' : walkIn ? 'walk-in from another member' : 'overridable';
        r.dependent = elements.some((e) => e.region === name && e.kind !== 'pair' && e.arrivalDependent);
    }
    for (const e of elements) {
        e.compare = compareRules(e.derived, e.ap ?? FALSE);
        // ⛓ PARTIAL (designer review, R-A1): an element any of whose rows skipped points (an unadmitted landing, its own
        // event) was never compared there, so an override would rest on inventories the certifier did not look at.
        e.overridable = e.kind !== 'pair' && regions.get(e.region)?.class === 'overridable' && !e.elementPartial;
        const named = e.verdict === 'problem' ? why.get(e.certifierLabel) : undefined;
        if (named) e.explainedBy = named.why;
        e.label = named ? named.as : e.verdict === 'problem' ? 'problem' : e.echoed ? 'echoed' : e.arrivalDependent ? 'arrival-dependent'
            : e.compare === 'equal' ? 'derived' : 'path-vs-edge';
    }
    // ⛓ SHARED BINDING (session tile-rules-automation-r-a2, rules-4's review): a derived rule that names a LOCK's event was
    // walked through a lock the maze laid from the rules producer's own event layer (`playthroughLockEvents`: which entity,
    // which event). Its price is derived, but the lock ↔ event BINDING is shared, so a wrong binding would agree on both
    // sides. A fact, so R-A3 never overrides on such a row without a game witness (the lock censuses check the binding).
    for (const e of elements) {
        const named = [...ruleItemNames(e.derived)].filter((n) => lockEvents.has(n)).sort();
        if (named.length > 0) e.sharedBinding = { by: 'playthroughLockEvents', events: named };
    }
    // ⛓ UNPRICED (designer's condition 1, R-A2): an AP exit between two members of one shared level world that no row
    // prices — its source is internal-only, priced only as paths from inbound members — has no verdict of its own. It is
    // no echo, and it is no evidence either; counted, never folded into a label.
    const pairs = new Set(elements.filter((e) => e.kind === 'pair').map((e) => e.key));
    const unpriced = [];
    for (const [name, others] of members) {
        for (const x of REGIONS[name]?.exits ?? []) {
            if (others && x.connected_region !== name && others.includes(x.connected_region) && !pairs.has(pairKey(name, x.connected_region))) {
                unpriced.push(exitKey(name, x.name));
            }
        }
    }
    return { elements, regions, unpriced: [...new Set(unpriced)].sort() };
}

const ruleItemNames = (rule, out = new Set()) => {
    if (!rule || typeof rule !== 'object') return out;
    if (typeof rule.args?.item_name === 'string') out.add(rule.args.item_name);
    for (const c of rule.children ?? []) ruleItemNames(c, out);
    return out;
};

const tally = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

/**
 * The table's counts, in the W0 sizing's own terms as well as the labels (so a run can be held against W0's numbers):
 *   - `labels` per element row, by kind;
 *   - `w0` per ELEMENT (arrivals collapsed): an exit or location is 'arrival-dependent' when its rows differ, else its
 *     derived rule's comparison with today's ('equal' / 'stricter' / 'looser' / 'incomparable');
 *   - `arrivals`: regions priced, arrival nodes, regions per arrival count, regions with an arrival-dependent element;
 *   - `routeA`: regions per class, and the overridable regions' elements split echoed / echo-free, and the echo-free ones
 *     split partial (a row skipped points) / EXACT (the override candidates).
 */
export function summarizeDerivedRows({ elements, regions, unpriced = [] }) {
    const labels = {};
    for (const e of elements) {
        if (!labels[e.kind]) labels[e.kind] = {};
        tally(labels[e.kind], e.label);
    }
    const w0 = { exit: {}, location: {} };
    const seen = new Set();
    for (const e of elements) {
        if (e.kind === 'pair' || seen.has(e.key)) continue;
        seen.add(e.key);
        tally(w0[e.kind], e.arrivalDependent ? 'arrival-dependent' : e.compare);
    }
    const hist = {};
    let nodes = 0;
    for (const r of regions.values()) { tally(hist, r.arrivals.size); nodes += r.arrivals.size; }
    const routeA = {
        classes: {}, overridableElements: 0, overridableEchoed: 0, overridableEchoFree: 0, regionsWithAnEchoFreeOverride: 0,
        overridablePartial: 0, overridableExact: 0, regionsWithAnExactOverride: 0,
    };
    const echoedKey = new Set(elements.filter((e) => e.echoed).map((e) => e.key));
    const partialKey = new Set(elements.filter((e) => e.elementPartial).map((e) => e.key));
    for (const r of regions.values()) {
        tally(routeA.classes, r.class);
        if (r.class !== 'overridable') continue;
        const echoed = [...r.elements].filter((k) => echoedKey.has(k)).length;
        routeA.overridableElements += r.elements.size;
        routeA.overridableEchoed += echoed;
        routeA.overridableEchoFree += r.elements.size - echoed;
        if (r.elements.size > echoed) routeA.regionsWithAnEchoFreeOverride += 1;
        const exact = [...r.elements].filter((k) => !echoedKey.has(k) && !partialKey.has(k)).length;
        routeA.overridablePartial += [...r.elements].filter((k) => !echoedKey.has(k) && partialKey.has(k)).length;
        routeA.overridableExact += exact;
        if (exact > 0) routeA.regionsWithAnExactOverride += 1;
    }
    const keys = [...seen];
    return {
        labels,
        w0,
        elements: keys.length,
        echoedElements: keys.filter((k) => echoedKey.has(k)).length,
        unpriced: unpriced.length,
        sharedBinding: new Set(elements.filter((e) => e.sharedBinding).map((e) => e.key)).size,
        arrivals: {
            regionsPriced: regions.size, arrivalNodes: nodes, regionsPerArrivalCount: hist,
            regionsArrivalDependent: [...regions.values()].filter((r) => r.dependent).length,
        },
        routeA,
    };
}
