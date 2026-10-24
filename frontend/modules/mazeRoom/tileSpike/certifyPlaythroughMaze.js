/**
 * The level-world CERTIFIER over a compiled `seedling_playthrough_maze` rules document (⚖ "Certifier", user
 * 2026-10-21; session tile-primitives-stage2-l15 for L15, grown by tile-primitives-levels-gap3 to every region
 * and by tile-primitives-grow-levels to a REGION SAMPLE + per-target grouping). Two halves:
 *   - INSIDE a level world: for every ordered pair of its sub-regions, the rule derived by search over the
 *     played shared world (`deriveLevelWorldLogic`) must AGREE with the atlas's IN-WORLD CLOSURE — reach over
 *     the AP exits between that world's own sub-regions — at every subset of the items, both ways (truth-table
 *     equality; the atlas spells L15 r1c9 → r1c5 as Or(Swim, And(weapon, Swim)), the search as Swim). The
 *     search is transitive over the world's cells, so a direct row alone under-states a pair that passes
 *     through a third sub-region (L16 r1c1 → r4c21 = r1c1 → r1c9 → r4c21 once the rope lane splits the level;
 *     ⚖ user 2026-10-22 "Land with exact exemptions", session rules-rope-events);
 *   - OUT of every region (`deriveEntryLogic`): from its arrival, each owned location against its AP rule, and
 *     each TARGET REGION its outbound exits lead to against the Or of the AP exits to it (L16's seven pits to
 *     L17 are seven AP exits and one destination; the interior pit is walled in by the other six).
 *     Every AP exit's target and every location of the region must be priced.
 * Every witness is replayed on the real `step`. Returns the problems (an empty list certifies) and one line
 * per priced target, which two engines must produce identically.
 *
 * ⛓ AP EVENTS (slice tile-primitives-arrow-rope): the in-world closure GRANTS an event location's item once
 * its region is reached and its rule holds (L16's rope cut, in r1c1, is what opens the lane for r1c1 → r3c7),
 * and an event location is priced by CUTTING its rope (`deriveEntryLogic`), its witness replayed to the cut.
 * A crossing whose arrival stands in an armed lane is not taken (`arrivalBlocked`, ⚖ never tank a hit) — and an
 * inventory at which a region's OWN arrival stands in one cannot be in that region at all: it is skipped when a
 * region's way OUT is compared (L16 r3c7 → L17: the atlas's True_, the world's Has(cut)), but only after
 * checking that no AP exit INTO the region admits that inventory — else that entry is the problem.
 *
 * ⛓ THE GAME'S LANDING CELL (session tile-primitives-landing-cells, ⚖ 2026-10-23 "Certifier only" + "Any shut
 * obstacle"). The game lands a crossing on the atlas connection's to-end `entrance_tile`, an arrival-only `in_*` exit
 * the projection never emits. That is neither the maze runtime's landing (the reverse exit tile) nor the sub-region
 * entrance a region is priced from: whole game, 299 of 304 crossings land on a third cell. `arrivalBlocked` judges
 * the crossing there, from the ATLAS (`atlasLandings`): it is refused at an inventory for which that cell is shut,
 * whatever the obstacle (L56's pit drops into L57's Swim water; the world crossed free, LOOSER than its landing gate),
 * and a landing on a cell the maze world walls is a problem by name. The cell is judged on the target world's ARRIVAL
 * state (`effectiveInventory` at the landing, fresh): a derived token (a button's `holds`, a rope's `activates`) counts
 * only when that state produces it, and never joins the item axis. The trap-lane check reads the same cell. An exit
 * between two sub-regions of ONE level (the atlas's `internal_exits`, no connection) keeps `resolveMazeArrival`.
 *
 * ⛓ COUNTED ITEMS (session tile-primitives-counted-rules, ⚖ 2026-10-23 "Count map" + "Threshold levels"; this replaced
 * grow-levels' "Refuse counted rules"): the truth table runs over lattice POINTS, not sets — each item at {0} ∪ every
 * count the world's obstacles or the row's AP rules name (`allPoints`), so `Has(Shield, count 2)` is compared at 0, 1
 * and 2 Shields. A row's inventory prints counted (`Progressive Shield×2`).
 *
 * ⛓ STRICTER BUT IMPLIED (session tile-primitives-gated-tiles, ⚖ 2026-10-22 "Accept if implied"). A row where the
 * world needs MORE than its AP rule (derived false, atlas true) is accepted when the inventory lacks an item that
 * every AP route into the SOURCE region already needs (AP reach from the start with every rule item but that one
 * misses the source): no AP state holding that inventory stands in the source, so the looser AP rule admits nothing
 * the world refuses. L8 → L9 in the whole game is one (the dry corridor's block needs the Swim to get round; every
 * way into L8 needs it too). Accepted rows are returned by name (`accepted`); any other stricter row, and every
 * LOOSER row, stays a problem. The reach is optimistic (a counted Has asks for one; an unknown kind passes), so it
 * can only under-state what is necessary — never accept a row it should not.
 */
import {
    deserializeMazeWorld, createState, step, standsInArmedLane, getObstacle, isFloor, effectiveInventory,
} from '../mazeRoomEngine.js';
import { resolveMazeArrival } from '../mazeArrival.js';
import {
    ropeEvents, allPoints, latticeAxis, ruleLevels, inventoryOf, pointCounts, formatPoint,
} from './deriveTileLogic.js';
import { evaluateRuleAgainstInventory, isObstacleCleared } from '../../shared/procgen/library.js';
import { deriveLevelWorldLogic, deriveEntryLogic, enteredAt } from './deriveLevelWorldLogic.js';
import { ruleFromMinimalSets } from './deriveTileLogic.js';

const ruleItems = (rule, out = new Set()) => {
    if (rule?.rule === 'Has') out.add(rule.args.item_name);
    for (const c of rule?.children ?? []) ruleItems(c, out);
    return out;
};
/** `rule` at a lattice point (a list, see `inventoryOf`) or an inventory (Set / count Map). */
const holds = (rule, inv) => evaluateRuleAgainstInventory(rule, Array.isArray(inv) ? inventoryOf(inv) : inv);
/** Merge count maps (item → Set of counts): a world's `levels` and the counts rules name. */
const mergeLevels = (...maps) => {
    const out = new Map();
    for (const m of maps) for (const [item, ns] of m) {
        if (!out.has(item)) out.set(item, new Set());
        for (const n of ns) out.get(item).add(n);
    }
    return out;
};
const anyOf = (rules) => (rules.length === 1 ? rules[0] : { rule: 'Or', children: rules });

/** The AP regions reachable from the start holding `inv` (every item in it at any count). Optimistic, see above. */
function apReach(REGIONS, starts, inv) {
    const seen = new Set(starts);
    const ok = (rule) => {
        switch (rule?.rule) {
        case undefined: case 'True_': return true;
        case 'False_': return false;
        case 'Has': return inv.has(rule.args.item_name);
        case 'And': return rule.children.every(ok);
        case 'Or': return rule.children.some(ok);
        case 'CanReachRegion': return seen.has(rule.args.region_name);
        default: return true;
        }
    };
    for (let grew = true; grew;) {
        grew = false;
        for (const from of [...seen]) {
            for (const e of REGIONS[from]?.exits ?? []) {
                if (!seen.has(e.connected_region) && ok(e.access_rule)) { seen.add(e.connected_region); grew = true; }
            }
        }
    }
    return seen;
}

/** Does `rule` hold for the item set `inv`, OPTIMISTICALLY: a counted Has asks for one, an unknown kind passes. */
const optimistic = (rule, inv) => {
    switch (rule?.rule) {
    case undefined: case 'True_': return true;
    case 'False_': return false;
    case 'Has': return inv.has(rule.args.item_name);
    case 'And': return rule.children.every((c) => optimistic(c, inv));
    case 'Or': return rule.children.some((c) => optimistic(c, inv));
    default: return true;
    }
};

/**
 * The ITEMS that clear obstacle `id` of `world`: its `clear_rule`'s, or every item of its `clear_set` combinations
 * (a combo_list is an array of arrays), less the tokens the world DERIVES (a button's `holds`, an obstacle's
 * `activates`), as `blockWorldAccessRules` excludes them.
 */
const obstacleItems = (world, id) => {
    const lib = world.obstacleLib ?? {};
    const entry = lib[id] ?? {};
    const derived = new Set(Object.values(world.buttonLib ?? {}).map((b) => b.holds).filter(Boolean));
    for (const e of Object.values(lib)) if (e?.activates) derived.add(e.activates);
    const items = (entry.clear_set_type ?? 'combo_list') === 'rule' ? [...ruleItems(entry.clear_rule)]
        : (entry.clear_set ?? []).flat();
    return items.filter((i) => !derived.has(i));
};

/** The sidecar that carries `name`'s playable payload (a level world's first sub-region carries it for all). */
const carrierOf = (SIDECARS, name) => {
    const own = SIDECARS[name];
    return own.playable_payload ? own
        : Object.values(SIDECARS).find((s) => s.playable_payload && s.shared_world === own.shared_world);
};

/**
 * Where the GAME lands each crossing of a compiled maze document: AP exit name → the cell in the TARGET world's own
 * coordinates (the to-end exit's `entrance_tile` less the target payload's `origin`), read off the atlas's
 * `vanilla_layout.connections` (both legs of a two-way one). A crossing the atlas does not wire is absent.
 *
 * @param {object} atlas the region atlas the document was compiled from
 * @param {object} rules a compiled rules document (player '1')
 * @returns {Map<string, {x: number, y: number}>}
 */
export function atlasLandings(atlas, rules) {
    const SIDECARS = rules.preset_sidecars['1'];
    const toEnd = new Map();
    for (const c of atlas.vanilla_layout?.connections ?? []) {
        toEnd.set(`${c.from[0]}|${c.from[1]}`, c.to);
        if (c.one_way !== true) toEnd.set(`${c.to[0]}|${c.to[1]}`, c.from);
    }
    const regionOf = new Map(atlas.regions.map((r) => [r.region_id, r]));
    const out = new Map();
    for (const side of Object.values(SIDECARS)) {
        const payload = side.playable_payload;
        for (const exit of payload?.exits ?? []) {
            const to = exit.targetRegion && toEnd.get(`${payload.atlas_region}|${exit.atlas_exit_id}`);
            if (!to || !SIDECARS[exit.targetRegion]) continue;
            const target = carrierOf(SIDECARS, exit.targetRegion).playable_payload;
            const tile = regionOf.get(to[0])?.exits?.find((e) => e.exit_id === to[1])?.entrance_tile;
            if (target.atlas_region !== to[0] || !tile) {
                throw new Error(`landing cells: ${exit.exitName} lands on ${to.join('/')}, which the compiled ${exit.targetRegion} does not hold`);
            }
            out.set(exit.exitName ?? exit.exit_id, { x: tile[0] - (target.origin?.x ?? 0), y: tile[1] - (target.origin?.y ?? 0) });
        }
    }
    return out;
}

/**
 * @param {object} rules a compiled rules document (player '1')
 * @param {object} helpers the tile helpers (`maze_tiles.helpers.json`)
 * @param {{native: boolean, regions?: string[], atlas: object}} opts `regions` = the AP regions to certify (default:
 *   all); a level world's pairs are certified when any of its members is in the sample. `atlas` (required) = the region
 *   atlas the document was compiled from — where the game lands each crossing
 */
export function certifyPlaythroughMaze(rules, helpers, { native, regions, atlas } = {}) {
    if (!atlas) throw new Error('certifier: the atlas is required — a crossing is judged by the cell the game lands it on');
    const landings = atlasLandings(atlas, rules);
    const REGIONS = rules.regions['1'];
    const SIDECARS = rules.preset_sidecars['1'];
    const problems = [];
    const lines = [];
    const accepted = [];
    const starts = rules.start_regions?.['1']?.default ?? ['Menu'];
    const everyItem = new Set();
    for (const r of Object.values(REGIONS)) {
        for (const e of r.exits ?? []) ruleItems(e.access_rule, everyItem);
        for (const l of r.locations ?? []) ruleItems(l.access_rule, everyItem);
    }
    // ⛓ EVENTS AS LOCATIONS (⚖ 2026-10-23 "Carry + name"): an AP event no maze world binds (a cross-room press, a
    // talk, an obstacle the world does not lay) is carried in the AP layer all the same; its location and every row
    // whose rule needs it are problems that SAY so.
    const bound = new Set();
    const boundIn = new Map(); // a projection-bound event → the worlds that lay its obstacle
    for (const [name, sc] of Object.entries(SIDECARS)) {
        for (const entry of Object.values(sc.playable_payload?.obstacleLib ?? {})) {
            if (entry.event) bound.add(entry.event);
            for (const ev of entry.events ?? []) {
                bound.add(ev.name);
                if (!boundIn.has(ev.name)) boundIn.set(ev.name, new Set());
                for (const r of sc.playable_payload.shared_world?.regions ?? [name]) boundIn.get(ev.name).add(r);
            }
        }
    }
    const unproducible = new Map();
    for (const r of Object.values(REGIONS)) {
        for (const l of r.locations ?? []) {
            if (!l.event || bound.has(l.name) || !l.obstacle) continue;
            const why = l.action?.presser ? `a press in L${l.action.presser.level}, another level`
                : l.action?.verb === 'talk' ? 'a talk' : `its ${l.obstacle.class} is not in the maze world`;
            unproducible.set(l.item?.name ?? l.name, why);
        }
    }
    // ⛓ An inventory holding an EVENT whose location's own rule it fails is no AP state: the event was collected
    // when that rule held, and items only grow (the rule is read optimistically, so this skips no real state).
    // L24 → L12 r40c4 holding the tree's event without the Fire: the world walks through, AP says Fire — nobody does.
    const eventRule = new Map();
    for (const r of Object.values(REGIONS)) {
        for (const l of r.locations ?? []) if (l.event) eventRule.set(l.item?.name ?? l.name, l.access_rule ?? { rule: 'True_' });
    }
    const impossible = (inv) => {
        const held = new Set(inv);
        return inv.some((i) => eventRule.has(i) && !optimistic(eventRule.get(i), held));
    };
    const unproducibleIn = (rule) => [...ruleItems(rule)].filter((i) => unproducible.has(i));
    const explain = (rule) => unproducibleIn(rule).map((i) => ` — needs "${i}", which the maze world cannot produce (${unproducible.get(i)})`).join('');
    const reachWithout = new Map();
    /** Does every AP route into `region` need `item`? */
    const needs = (region, item) => {
        if (!reachWithout.has(item)) {
            reachWithout.set(item, apReach(REGIONS, starts, new Set([...everyItem].filter((i) => i !== item))));
        }
        return !reachWithout.get(item).has(region);
    };
    /**
     * Compare one row at every subset of `axis`: the first mismatch that is not stricter-and-implied (by entry into
     * `source`) is its problem; a row with none is accepted by every item that excused a mismatch.
     */
    const compareRow = (label, source, items, levels, derivedAt, atlasAt, notHere = null, why = '') => {
        const by = new Set();
        const axis = latticeAxis(items, levels);
        for (const inv of allPoints(axis)) {
            if (impossible(inv) || notHere?.(inv)) continue;
            const derived = derivedAt(inv);
            const atlas = atlasAt(inv);
            if (derived === atlas) continue;
            const held = new Set(inv);
            const excuse = derived ? null : items.find((i) => !held.has(i) && needs(source, i));
            if (!excuse) { problems.push(`${label} holding [${formatPoint(inv)}]: derived ${derived}, atlas ${atlas}${why}`); return; }
            by.add(excuse);
        }
        for (const item of by) accepted.push({ label, source, by: item });
    };
    const worldOf = (name) => deserializeMazeWorld(carrierOf(SIDECARS, name).playable_payload);
    /**
     * ⛓ A crossing out of `source` is refused when its arrival — the cell the GAME lands it on (`atlasLandings`; an
     * in-world exit's, `resolveMazeArrival`) — is SHUT for that inventory, or stands in an ARMED lane of the target world. The items those read (the landing
     * obstacle's own, the target's rope events — what silences a lane from afar) join the source's lattice axis.
     */
    const arrivalBlockedFrom = (source) => {
        const cache = new Map();
        const levelOf = (name) => carrierOf(SIDECARS, name).playable_payload.atlas_region;
        const arrivalOf = (exit) => {
            const name = exit.exitName ?? exit.exit_id;
            if (cache.has(name)) return cache.get(name);
            let found = null;
            if (SIDECARS[exit.targetRegion]) {
                const tw = worldOf(exit.targetRegion);
                const into = tw.sharedWorld ? enteredAt(tw, exit.targetRegion) : tw;
                const inWorld = levelOf(exit.targetRegion) === levelOf(source);
                let at = inWorld ? resolveMazeArrival(into, { source_region: source, exit_id: exit.targetExitId ?? null })
                    : landings.get(name) ?? null;
                if (!inWorld && !at) problems.push(`${name}: the atlas does not say where the game lands it`);
                else if (!inWorld && !isFloor(into, at.x, at.y)) {
                    problems.push(`${name}: the game lands on (${at.x},${at.y}) in ${exit.targetRegion}, which the maze world walls`);
                    at = null;
                }
                const ob = at && !inWorld ? getObstacle(into, at.x, at.y) : null;
                if (ob || tw.trapLanes) {
                    found = {
                        world: into, at: at ?? into.entrance, ob,
                        levels: ob && into.obstacleLib[ob].clear_rule ? ruleLevels(into.obstacleLib[ob].clear_rule) : new Map(),
                        items: [
                            ...(ob ? obstacleItems(into, ob) : []), ...(ob ? (into.obstacleLib[ob].events ?? []).map((e) => e.name) : []),
                            ...(tw.trapLanes ? ropeEvents(tw).map((r) => r.event) : []),
                        ],
                    };
                }
            }
            cache.set(name, found);
            return found;
        };
        const blocked = (exit, inv) => {
            const a = arrivalOf(exit);
            if (!a) return false;
            const s = createState(a.world);
            s.player_pos = { ...a.at };
            if (a.ob) {
                const eff = effectiveInventory(a.world, inventoryOf(inv), s.player_pos, s.blocks, s.broken);
                if (!isObstacleCleared(a.ob, eff, a.world.obstacleLib)) return true;
                // ⛓ EVENTS AS LOCATIONS: an obstacle bound to AP events is open to an ARRIVAL only once they are carried —
                // the game lands inside the solid, from where nothing opens it (the producer gates that departure on the
                // event, not on the item that opens it from beside: L12 → L24 lands in the tree).
                if ((a.world.obstacleLib[a.ob].events ?? []).some((e) => !eff.has(e.name))) return true;
            }
            if (!a.world.trapLanes) return false;
            return standsInArmedLane(a.world, s, inventoryOf(inv));
        };
        const exits = [...worldOf(source).exits.values()].filter((e) => e.targetRegion);
        blocked.items = [...new Set(exits.flatMap((e) => arrivalOf(e)?.items ?? []))];
        blocked.levels = mergeLevels(...exits.map((e) => arrivalOf(e)?.levels ?? new Map()));
        return blocked;
    };
    const agree = (label, source, atlas, minimal, out, { notHere = null, why = '' } = {}) => {
        const derived = ruleFromMinimalSets(minimal);
        compareRow(label, source, [...new Set([...out.items, ...ruleItems(atlas)])].sort(), mergeLevels(out.levels, ruleLevels(atlas)),
            (inv) => holds(derived, inv), (inv) => holds(atlas, inv), notHere, `${explain(atlas)}${why}`);
    };
    /** The atlas's reach over the AP exits BETWEEN `members` (one level world's sub-regions), per inventory. */
    const inWorldClosure = (members) => {
        const inWorld = new Set(members);
        const edges = members.flatMap((from) => REGIONS[from].exits.filter((e) => inWorld.has(e.connected_region))
            .map((e) => ({ from, to: e.connected_region, rule: e.access_rule ?? { rule: 'True_' } })));
        const events = members.flatMap((at) => (REGIONS[at].locations ?? []).filter((l) => l.event)
            .map((l) => ({ at, item: l.item?.name ?? l.name, rule: l.access_rule ?? { rule: 'True_' } })));
        const reaches = (from, to, start) => {
            const seen = new Set([from]);
            const inv = pointCounts(start);
            for (let grew = true; grew;) {
                grew = false;
                for (const e of edges) {
                    if (seen.has(e.from) && !seen.has(e.to) && holds(e.rule, inv)) { seen.add(e.to); grew = true; }
                }
                for (const ev of events) {
                    if (seen.has(ev.at) && !inv.has(ev.item) && holds(ev.rule, inv)) { inv.set(ev.item, 1); grew = true; }
                }
            }
            return seen.has(to);
        };
        return { edges: [...edges, ...events], reaches };
    };
    const agreeWithClosure = (label, closure, pair, out) => {
        const derived = ruleFromMinimalSets(pair.minimal);
        const asked = new Set(out.items);
        const levels = mergeLevels(out.levels);
        for (const e of closure.edges) { ruleItems(e.rule, asked); ruleLevels(e.rule, levels); }
        compareRow(label, pair.from, [...asked].sort(), levels,
            (inv) => holds(derived, inv), (inv) => closure.reaches(pair.from, pair.to, inv), null,
            [...new Set(closure.edges.map((e) => explain(e.rule)))].join(''));
    };
    const replay = (label, world, inventory, plan, cell, { cut = false } = {}) => {
        const w = { ...world, items: new Map() };
        let s = createState(w);
        s.inventory = inventoryOf(inventory);
        for (const input of plan) s = step(w, s, input);
        if (cut) {
            if (!s.broken?.includes(cell)) problems.push(`${label}: witness [${formatPoint(inventory)}] does not cut the rope at ${cell}`);
            return;
        }
        const at = `${s.player_pos.x},${s.player_pos.y}`;
        if (at !== cell) problems.push(`${label}: witness [${formatPoint(inventory)}] replays to ${at}, not ${cell}`);
    };

    const sample = new Set(regions ?? Object.keys(SIDECARS));
    // One reach cache per world (a shared world's key, else the region): pairs and entries share reaches.
    const caches = new Map();
    const cacheOf = (world, name) => {
        const key = world.sharedWorld?.key ?? name;
        if (!caches.has(key)) caches.set(key, new Map());
        return caches.get(key);
    };
    const sharedDone = new Set();
    for (const name of Object.keys(SIDECARS).filter((n) => sample.has(n))) {
        const world = worldOf(name);
        if (world.sharedWorld && !sharedDone.has(world.sharedWorld.key)) {
            sharedDone.add(world.sharedWorld.key);
            const out = deriveLevelWorldLogic(world, helpers, { native, cache: cacheOf(world, name) });
            const closure = inWorldClosure(world.sharedWorld.regions);
            for (const p of out.pairs) {
                agreeWithClosure(`${p.from} → ${p.to}`, closure, p, out);
                for (const w of p.witnesses) replay(`${p.from} → ${p.to}`, enteredAt(world, p.from), w.inventory, w.plan, w.cell);
                lines.push(`${p.from}>${p.to}=${JSON.stringify(p.minimal)}`);
            }
        }
        const out = deriveEntryLogic(world, name, helpers, {
            native, arrivalBlocked: arrivalBlockedFrom(name), cache: cacheOf(world, name),
        });
        const entered = world.sharedWorld ? enteredAt(world, name) : world;
        // ⛓ An inventory whose arrival here is a hit cannot be here — checked against every AP way in.
        const inbound = Object.entries(REGIONS).flatMap(([from, r]) => r.exits.filter((e) => e.connected_region === name)
            .map((e) => ({ from, rule: e.access_rule ?? { rule: 'True_' } })));
        const notHere = entered.trapLanes ? (inv) => {
            if (!standsInArmedLane(entered, createState(entered), inventoryOf(inv))) return false;
            for (const e of inbound) {
                if (holds(e.rule, inv)) problems.push(`${e.from} → ${name} holding [${formatPoint(inv)}]: AP enters, but the arrival stands in an armed lane`);
            }
            return true;
        } : null;
        const exitTo = new Map(REGIONS[name].exits.map((e) => [e.name, e.connected_region]));
        const byTarget = new Map();
        for (const t of out.targets) {
            const label = `${name} @ ${t.exitName ?? t.locationName}`;
            for (const w of t.witnesses) {
                replay(label, entered, w.inventory, w.plan, t.adjacent ? w.cell : `${t.x},${t.y}`, { cut: Boolean(t.event) && !t.adjacent });
            }
            if (t.kind === 'exit') {
                const to = exitTo.get(t.exitName);
                if (to === undefined) { problems.push(`${label}: no AP exit of that name`); continue; }
                if (!byTarget.has(to)) byTarget.set(to, []);
                byTarget.get(to).push(...t.minimal);
                continue;
            }
            const loc = (REGIONS[name].locations ?? []).find((l) => l.name === t.locationName);
            if (!loc) { problems.push(`${label}: no AP location of that name`); continue; }
            // Two events on ONE cell (L12's magical lock under its boss lock): the world opens it only with both items.
            const stacked = t.adjacent ? (entered.obstacleLib[entered.obstacles.get(t.cells[0])]?.events ?? []) : [];
            const why = stacked.length > 1 ? ` — its cell carries ${stacked.length} events, which the world opens only together` : '';
            agree(label, name, loc.access_rule ?? { rule: 'True_' }, t.minimal, out, { why });
            lines.push(`${name}@${t.locationName}=${JSON.stringify(t.minimal)}`);
        }
        const inWorld = new Set(world.sharedWorld?.regions ?? []);
        for (const to of new Set(REGIONS[name].exits.map((e) => e.connected_region))) {
            if (inWorld.has(to)) continue;
            if (!byTarget.has(to)) { problems.push(`${name}: its exit(s) to ${to} are not priced`); continue; }
            const atlas = anyOf(REGIONS[name].exits.filter((e) => e.connected_region === to).map((e) => e.access_rule ?? { rule: 'True_' }));
            agree(`${name} → ${to}`, name, atlas, byTarget.get(to), out, { notHere });
            lines.push(`${name}->${to}=${JSON.stringify(byTarget.get(to))}`);
        }
        const priced = new Set(out.targets.map((t) => t.locationName).filter(Boolean));
        for (const l of REGIONS[name].locations ?? []) {
            if (priced.has(l.name)) continue;
            const item = l.item?.name ?? l.name;
            const elsewhere = boundIn.get(item);
            const why = unproducible.has(item) ? ` — the maze world cannot produce it (${unproducible.get(item)})`
                : elsewhere && !elsewhere.has(name) ? ` — its obstacle is laid only in ${[...elsewhere].sort().join(', ')}, not in this region's world`
                    : '';
            problems.push(`${name}: location ${l.name} is not priced${why}`);
        }
    }
    return { problems, lines, accepted };
}
