/**
 * ⛓ THE ECHO TEST (session tile-rules-automation-r-a1; the method is the rules-automation W0's `circularity` scratch).
 * Which seedling_playthrough access rules does the maze compile COPY into its played payloads? Where it copies one, the
 * maze derivation reads the rule back and agrees with it by construction, so that agreement is no evidence (W0 at main
 * 31ce3077a1: all 11 location rules, all 21 boundary exit rules, 45 of 282 internal rows — every one in a plain world).
 *
 * The method: compile the maze with a SENTINEL item planted in every rule the atlas and the event layer carry
 * (`buildPlaythroughMaze({plant: plantEchoSentinels})`), then look for the sentinels in each payload. A sentinel that
 * surfaces in a payload is a rule the maze world gates on verbatim. Nothing is listed by hand: a rule a later compile
 * starts copying shows up here on its own.
 */

const OPEN = '⟦echo|';
const CLOSE = '⟧';

/** The sentinel item for one rule: `⟦echo|<kind>|<id>⟧`. */
export const sentinelItem = (kind, id) => `${OPEN}${kind}|${id}${CLOSE}`;
const sentinel = (kind, id) => ({ rule: 'Has', args: { item_name: sentinelItem(kind, id) } });

/** The rule kinds planted, and what each id names. */
export const ECHO_KINDS = Object.freeze({
    loc: '<level>/<location>: an atlas location rule',
    ex: '<level>/<exit_id>: an atlas exit rule (a crossing to another region)',
    ix: '<level>/<from>-><to>: an atlas internal-exit row (between two sub-regions of one level)',
    evt: '<event>: an event location rule (the event layer)',
    gate: '<level>/<exit_id>: an exit gate (the event layer)',
    ixr: '<level>/<from>-><to>: an internal exit rule the event layer writes (a latched lock\'s return)',
    ixg: '<level>/<from>-><to>: an internal exit gate the event layer writes',
    rope: '<event>: a rope event location rule',
    ropegate: '<level>/<exit_id>: a rope exit gate',
});

/**
 * `buildPlaythroughMaze`'s `plant` hook: replace every rule in place with its sentinel. Returns the count planted per
 * kind. An internal-exit row the event layer rewrites (`internalExitRules`) is planted as `ixr`, not `ix`: the layer's
 * rule is the one the compile reads there.
 */
export function plantEchoSentinels({ atlas, layer, ropes, hand = null }) {
    const n = Object.fromEntries(Object.keys(ECHO_KINDS).map((k) => [k, 0]));
    // ⛓ THE HAND INPUTS (session tile-rules-automation-r-a2): since the input/output split the maze worlds copy only the
    // overlay's hand terms (`handInputsFor`), never the atlas's rules — so a sentinel goes there too, under the same kind and
    // id as the atlas rule it stands beside (`ex`/`loc`), or every hand rule would read as derived. Counted apart (`hand`).
    n.hand = 0;
    for (const k of [...(hand?.exits?.keys() ?? [])]) { hand.exits.set(k, sentinel('ex', k)); n.hand += 1; }
    for (const k of [...(hand?.locations?.keys() ?? [])]) { hand.locations.set(k, sentinel('loc', k)); n.hand += 1; }
    const overridden = new Set(layer.internalExitRules.map((q) => `${q.region_id}/${q.from}->${q.to}`));
    for (const r of atlas.regions) {
        for (const l of r.locations ?? []) if (l.access_rule) { l.access_rule = sentinel('loc', `${r.region_id}/${l.name}`); n.loc += 1; }
        for (const e of r.exits ?? []) if (e.access_rule) { e.access_rule = sentinel('ex', `${r.region_id}/${e.exit_id}`); n.ex += 1; }
        for (const x of r.subgraph?.internal_exits ?? []) {
            const id = `${r.region_id}/${x.from}->${x.to}`;
            if (x.access_rule && !overridden.has(id)) { x.access_rule = sentinel('ix', id); n.ix += 1; }
        }
    }
    for (const e of layer.events) if (e.access_rule) { e.access_rule = sentinel('evt', e.name); n.evt += 1; }
    for (const g of layer.exitGates) if (g.rule) { g.rule = sentinel('gate', `${g.region_id}/${g.exit_id}`); n.gate += 1; }
    for (const q of layer.internalExitRules) if (q.rule) { q.rule = sentinel('ixr', `${q.region_id}/${q.from}->${q.to}`); n.ixr += 1; }
    for (const g of layer.internalExitGates ?? []) if (g.rule) { g.rule = sentinel('ixg', `${g.region_id}/${g.from}->${g.to}`); n.ixg += 1; }
    for (const e of ropes.events) if (e.access_rule) { e.access_rule = sentinel('rope', e.name); n.rope += 1; }
    for (const g of ropes.exitGates) if (g.rule) { g.rule = sentinel('ropegate', `${g.region_id}/${g.exit_id}`); n.ropegate += 1; }
    return n;
}

/** Every sentinel in `text`, as `[kind, id]`. */
function sentinelsIn(text) {
    const out = [];
    for (let at = text.indexOf(OPEN); at !== -1; at = text.indexOf(OPEN, at + 1)) {
        const end = text.indexOf(CLOSE, at);
        if (end === -1) throw new Error('echo sentinels: an unterminated sentinel in a payload');
        const [kind, ...id] = text.slice(at + OPEN.length, end).split('|');
        out.push([kind, id.join('|')]);
    }
    return out;
}

/**
 * The sentinels a sentinel compile's payloads carry, and the AP ELEMENTS they stand for (`<region>|<exit name>` and
 * `<region>|@<location>`, the keys `derivedRuleRows.js` uses), named in `rules` — a compile of the TRUE atlas over the
 * same levels (the names are the same; only rules differ).
 *
 * @param {object} planted the sentinel compile (`buildPlaythroughMaze({plant: plantEchoSentinels, …})`, parsed)
 * @param {object} rules the true compile (its AP regions name the elements)
 * @returns {{byKind: Record<string, string[]>, inShared: Record<string, number>, elements: string[], unmapped: string[]}}
 */
export function findEchoes(planted, rules) {
    const found = new Map(Object.keys(ECHO_KINDS).map((k) => [k, new Map()]));
    for (const sc of Object.values(planted.preset_sidecars['1'])) {
        const p = sc.playable_payload;
        if (!p) continue;
        for (const [kind, id] of sentinelsIn(JSON.stringify(p))) {
            if (!found.has(kind)) throw new Error(`echo sentinels: unknown kind ${kind}`);
            if (!found.get(kind).has(id)) found.get(kind).set(id, Boolean(p.shared_world));
        }
    }
    const REGIONS = rules.regions['1'];
    const levelOf = (name) => name.split('__')[0];
    const exitByAtlasId = new Map();
    for (const sc of Object.values(rules.preset_sidecars['1'])) {
        const p = sc.playable_payload;
        for (const e of p?.exits ?? []) if (e.targetRegion && e.atlas_exit_id) exitByAtlasId.set(`${p.atlas_region}/${e.atlas_exit_id}`, e.exitName ?? e.exit_id);
    }
    const sourceOf = new Map();
    for (const [name, r] of Object.entries(REGIONS)) for (const e of r.exits ?? []) sourceOf.set(e.name, name);
    /** The AP element keys one planted rule stands for. */
    const elementsOf = (what, id) => {
        if (what === 'exit') {
            const exit = exitByAtlasId.get(id);
            return exit && sourceOf.has(exit) ? [`${sourceOf.get(exit)}|${exit}`] : [];
        }
        if (what === 'internal') {
            const m = id.match(/^(level_\d+)\/(.+)->(.+)$/);
            const from = m && `${m[1]}__${m[2]}`;
            const to = m && `${m[1]}__${m[3]}`;
            return (REGIONS[from]?.exits ?? []).filter((e) => e.connected_region === to).map((e) => `${from}|${e.name}`);
        }
        const owners = [];
        for (const [n, r] of Object.entries(REGIONS)) {
            for (const l of r.locations ?? []) {
                const hit = what === 'event' ? l.event && (l.item?.name ?? l.name) === id
                    : levelOf(n) === id.split('/')[0] && l.name === id.split('/').slice(1).join('/');
                if (hit) owners.push(`${n}|@${l.name}`);
            }
        }
        return owners;
    };
    const elements = new Set();
    const unmapped = [];
    const kindOf = { ex: 'exit', gate: 'exit', ropegate: 'exit', ix: 'internal', ixr: 'internal', ixg: 'internal', loc: 'location', evt: 'event', rope: 'event' };
    for (const [kind, ids] of found) {
        for (const id of ids.keys()) {
            const keys = elementsOf(kindOf[kind], id);
            if (keys.length === 0) unmapped.push(`${kind} ${id}`);
            for (const k of keys) elements.add(k);
        }
    }
    const byKind = Object.fromEntries([...found].map(([k, m]) => [k, [...m.keys()].sort()]));
    const inShared = Object.fromEntries([...found].map(([k, m]) => [k, [...m.values()].filter(Boolean).length]));
    return { byKind, inShared, elements: [...elements].sort(), unmapped: unmapped.sort() };
}
