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
 * ⛔ A counted Has (count ≥ 2) in an AP rule is a PROBLEM by name: the truth table enumerates SETS, which
 * cannot hold two of anything, so it would certify the rule vacuously (⚖ "Refuse counted rules").
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
import { deserializeMazeWorld, createState, step, standsInArmedLane } from '../mazeRoomEngine.js';
import { resolveMazeArrival } from '../mazeArrival.js';
import { ropeEvents } from './deriveTileLogic.js';
import { evaluateRuleAgainstInventory } from '../../shared/procgen/library.js';
import { deriveLevelWorldLogic, deriveEntryLogic, enteredAt } from './deriveLevelWorldLogic.js';
import { ruleFromMinimalSets } from './deriveTileLogic.js';

function* subsets(items) {
    for (let mask = 0; mask < 1 << items.length; mask++) yield items.filter((_, i) => mask & (1 << i));
}
const ruleItems = (rule, out = new Set()) => {
    if (rule?.rule === 'Has') out.add(rule.args.item_name);
    for (const c of rule?.children ?? []) ruleItems(c, out);
    return out;
};
const counted = (rule) => (rule?.rule === 'Has' && (rule.args.count ?? 1) > 1)
    || (rule?.children ?? []).some(counted);
const holds = (rule, inv) => evaluateRuleAgainstInventory(rule, new Set(inv));
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

/**
 * @param {object} rules a compiled rules document (player '1')
 * @param {object} helpers the tile helpers (`maze_tiles.helpers.json`)
 * @param {{native: boolean, regions?: string[]}} opts `regions` = the AP regions to certify (default: all);
 *   a level world's pairs are certified when any of its members is in the sample
 */
export function certifyPlaythroughMaze(rules, helpers, { native, regions } = {}) {
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
    const compareRow = (label, source, axis, derivedAt, atlasAt, notHere = null) => {
        const by = new Set();
        for (const inv of subsets(axis)) {
            if (notHere?.(inv)) continue;
            const derived = derivedAt(inv);
            const atlas = atlasAt(inv);
            if (derived === atlas) continue;
            const held = new Set(inv);
            const excuse = derived ? null : axis.find((i) => !held.has(i) && needs(source, i));
            if (!excuse) { problems.push(`${label} holding [${inv}]: derived ${derived}, atlas ${atlas}`); return; }
            by.add(excuse);
        }
        for (const item of by) accepted.push({ label, source, by: item });
    };
    const worldOf = (name) => {
        const own = SIDECARS[name];
        const carrier = own.playable_payload ? own
            : Object.values(SIDECARS).find((s) => s.playable_payload && s.shared_world === own.shared_world);
        return deserializeMazeWorld(carrier.playable_payload);
    };
    /**
     * ⛓ A crossing out of `source` is a HIT when its arrival (`resolveMazeArrival` by source region, else the
     * target's own entrance) stands in an ARMED lane of the target world for that inventory. The items it
     * reads (the target's rope events — what silences a lane from afar) join the source's lattice axis.
     */
    const arrivalBlockedFrom = (source) => {
        const cache = new Map();
        const arrivalOf = (exit) => {
            if (cache.has(exit.targetRegion)) return cache.get(exit.targetRegion);
            let found = null;
            if (SIDECARS[exit.targetRegion]) {
                const tw = worldOf(exit.targetRegion);
                if (tw.trapLanes) {
                    const into = tw.sharedWorld ? enteredAt(tw, exit.targetRegion) : tw;
                    const at = resolveMazeArrival(into, { source_region: source, exit_id: exit.targetExitId ?? null });
                    found = { world: into, at: at ? { x: at.x, y: at.y } : into.entrance, items: ropeEvents(tw).map((r) => r.event) };
                }
            }
            cache.set(exit.targetRegion, found);
            return found;
        };
        const blocked = (exit, inv) => {
            const a = arrivalOf(exit);
            if (!a) return false;
            const s = createState(a.world);
            s.player_pos = { ...a.at };
            return standsInArmedLane(a.world, s, new Set(inv));
        };
        const exits = [...worldOf(source).exits.values()].filter((e) => e.targetRegion);
        blocked.items = [...new Set(exits.flatMap((e) => arrivalOf(e)?.items ?? []))];
        return blocked;
    };
    const agree = (label, source, atlas, minimal, items, { notHere = null } = {}) => {
        if (counted(atlas)) { problems.push(`${label}: the AP rule counts an item — a set truth table cannot certify it`); return; }
        const derived = ruleFromMinimalSets(minimal);
        compareRow(label, source, [...new Set([...items, ...ruleItems(atlas)])].sort(),
            (inv) => holds(derived, inv), (inv) => holds(atlas, inv), notHere);
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
            const inv = new Set(start);
            for (let grew = true; grew;) {
                grew = false;
                for (const e of edges) {
                    if (seen.has(e.from) && !seen.has(e.to) && holds(e.rule, inv)) { seen.add(e.to); grew = true; }
                }
                for (const ev of events) {
                    if (seen.has(ev.at) && !inv.has(ev.item) && holds(ev.rule, inv)) { inv.add(ev.item); grew = true; }
                }
            }
            return seen.has(to);
        };
        return { edges: [...edges, ...events], reaches };
    };
    const agreeWithClosure = (label, closure, pair, items) => {
        if (closure.edges.some((e) => counted(e.rule))) { problems.push(`${label}: an in-world AP rule counts an item — a set truth table cannot certify it`); return; }
        const derived = ruleFromMinimalSets(pair.minimal);
        const asked = new Set(items);
        for (const e of closure.edges) ruleItems(e.rule, asked);
        compareRow(label, pair.from, [...asked].sort(),
            (inv) => holds(derived, inv), (inv) => closure.reaches(pair.from, pair.to, inv));
    };
    const replay = (label, world, inventory, plan, cell, { cut = false } = {}) => {
        const w = { ...world, items: new Map() };
        let s = createState(w);
        s.inventory = new Set(inventory);
        for (const input of plan) s = step(w, s, input);
        if (cut) {
            if (!s.broken?.includes(cell)) problems.push(`${label}: witness [${inventory}] does not cut the rope at ${cell}`);
            return;
        }
        const at = `${s.player_pos.x},${s.player_pos.y}`;
        if (at !== cell) problems.push(`${label}: witness [${inventory}] replays to ${at}, not ${cell}`);
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
                agreeWithClosure(`${p.from} → ${p.to}`, closure, p, out.items);
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
            if (!standsInArmedLane(entered, createState(entered), new Set(inv))) return false;
            for (const e of inbound) {
                if (holds(e.rule, inv)) problems.push(`${e.from} → ${name} holding [${inv}]: AP enters, but the arrival stands in an armed lane`);
            }
            return true;
        } : null;
        const exitTo = new Map(REGIONS[name].exits.map((e) => [e.name, e.connected_region]));
        const byTarget = new Map();
        for (const t of out.targets) {
            const label = `${name} @ ${t.exitName ?? t.locationName}`;
            for (const w of t.witnesses) replay(label, entered, w.inventory, w.plan, `${t.x},${t.y}`, { cut: Boolean(t.event) });
            if (t.kind === 'exit') {
                const to = exitTo.get(t.exitName);
                if (to === undefined) { problems.push(`${label}: no AP exit of that name`); continue; }
                if (!byTarget.has(to)) byTarget.set(to, []);
                byTarget.get(to).push(...t.minimal);
                continue;
            }
            const loc = (REGIONS[name].locations ?? []).find((l) => l.name === t.locationName);
            if (!loc) { problems.push(`${label}: no AP location of that name`); continue; }
            agree(label, name, loc.access_rule ?? { rule: 'True_' }, t.minimal, out.items);
            lines.push(`${name}@${t.locationName}=${JSON.stringify(t.minimal)}`);
        }
        const inWorld = new Set(world.sharedWorld?.regions ?? []);
        for (const to of new Set(REGIONS[name].exits.map((e) => e.connected_region))) {
            if (inWorld.has(to)) continue;
            if (!byTarget.has(to)) { problems.push(`${name}: its exit(s) to ${to} are not priced`); continue; }
            const atlas = anyOf(REGIONS[name].exits.filter((e) => e.connected_region === to).map((e) => e.access_rule ?? { rule: 'True_' }));
            agree(`${name} → ${to}`, name, atlas, byTarget.get(to), out.items, { notHere });
            lines.push(`${name}->${to}=${JSON.stringify(byTarget.get(to))}`);
        }
        const priced = new Set(out.targets.map((t) => t.locationName).filter(Boolean));
        for (const l of REGIONS[name].locations ?? []) {
            if (!priced.has(l.name)) problems.push(`${name}: location ${l.name} is not priced`);
        }
    }
    return { problems, lines, accepted };
}
