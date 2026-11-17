/**
 * packStructure/actionNodesAssembly — **WHAT EXISTS + THE WORDS + THE NUMBERS → AN ActionNodes GRAPH DOCUMENT**
 * (⛓ CONTENT SETS PL-2; Z.5: "For ActionNodes the resolved document is the graph document of `actionnodes-design.md`
 * §1, and its compiler does not change").
 *
 * The mapping (the ActionNodes design's "Where each field comes from in a pack", plus the Z.2 additions the planner
 * ruled for PL-2):
 *
 *   node             a `task` entry; its id is the entry's slug. Its KIND is its tag: `start`, `check`, `use` or
 *                    `goal` (at most one), else `action`. Exactly one task is tagged `start`.
 *   name             the word that presents the entry (the words stack, latest wins); none → W1 (shown by its id)
 *   time             numbers `time`; none → T1 from another game's set over the same pack, else refused
 *   limit            numbers `limit`; none, or no `limit` in structure → L1 (a `use` task: L2);
 *                    `{ grows_with }` → AN-flat (one number), then L1 when the numbers state none
 *   requires         the first set (more → AN-flat); a stat's minimum: numbers `requires.<id>.min`, none → AN1;
 *                    a resource's: numbers `requires.<id>.min`, none → refused. `consume` → minus it in results
 *   results          a stat: numbers `results.<id>`, none → AN2. A resource: numbers `results.<id>`, signed;
 *                    the CLOCK resource (the tasks' `time`) → `results.mana`. `when` other than `each` → AN-flat
 *                    (`opens` keeps A16's last-performance meaning). A `boon` result → B1 (listed, dropped).
 *                    An `opens` result places the task(s) it opens after this one (below).
 *   after            the entry's sets, as node ids. None: no place → P1 (after the start); a place some task's
 *                    result opens → after those tasks; the start's own place → after the start; else refused
 *   stats/resources  every `stat` / `resource` entry (the clock excepted), named by the words
 *   boons            every `boon` entry: `count` and the amounts of its `results` from numbers; the clock result is
 *                    `gives.mana` (no value: ActionNodes' own per-item default applies)
 *   loop, settings,  the numbers set's `economy`: `loop_mana`, `settings`, `filler` (a boon id), `stat_rate` (AN2)
 *   filler
 *   graph_id, name   the `exists` pack ids joined by `+`; the word of the start task's place (none → W1)
 *   `modifies`       AN-flat: dropped, listed
 *
 * Every rule used is the substrate's (`fillRulesOf`): a rule the substrate does not apply is a refusal by name, not
 * a silent fill. Every fill and flattening is a row of the gap report.
 *
 * ⛔ PROVENANCE. The graph document must name its sources (`validateActionGraph`), and a world document carries no
 * per-entry provenance (Z.7): the resolved graph carries ONE `derived` source whose `from` is every structure entry
 * it was built from, so a reader looks each source up through the packs.
 *
 * Pure and DOM-free.
 */
import { ACTION_GRAPH_KIND, ACTION_GRAPH_SCHEMA_VERSION, assertActionGraph } from '../actionNodes/actionGraph.js';
import { RULE_HELPERS, fillRule, ruleTag } from '../procgenCore/fillRules.js';
import { ContentPackError } from '../contentPacks/contentPackError.js';
import { parseStructureId } from './packStructure.js';

/** The substrate this assembler builds for. */
export const ACTION_NODES_ID = 'action_nodes';
/** The tags that give a node its kind; a task with none is an `action`. */
export const KIND_TAGS = Object.freeze(['start', 'check', 'use', 'goal']);
/** The module a resolved graph's provenance names as its `by`. */
export const RESOLVER_PATH = 'frontend/modules/packStructure/packResolver.js';

const fail = (m) => { throw new ContentPackError(`resolve action_nodes: ${m}`); };

/**
 * Assemble the graph. `ctx` is `{ exists, structure, words, numbersOf, allSets, rules, report }`:
 * `numbersOf(packId)` the merged numbers set for this substrate over that pack (or null); `allSets` the numbers reader
 * over every loaded numbers layer (for T1); `rules` the substrate's rule ids; `report` the gap report to add rows to.
 */
export function assembleActionGraph(ctx) {
    const { exists, structure, rules, report } = ctx;
    const use = (id) => {
        if (!rules.includes(id)) fail(`rule ${id} is needed, and the substrate does not apply it (its rules: ${rules.join(', ')})`);
        return fillRule(id);
    };
    const nameOf = (key) => {
        const w = ctx.words.presenting(key);
        if (w) return w.name;
        use('W1');
        if (!report.unnamed.some((r) => r.entry === key)) report.unnamed.push({ entry: key, rule: ruleTag('W1') });
        return fillRule('W1').apply({ id: key });
    };

    // ── The economy: one numbers set per exists pack, merged in exists order.
    const economy = {};
    for (const pack of exists) Object.assign(economy, ctx.numbersOf(pack)?.economy ?? {});
    const loopMana = economy.loop_mana;
    if (!Number.isInteger(loopMana) || loopMana < 1) {
        fail(`no numbers set for ${ACTION_NODES_ID} over [${exists.join(', ')}] states economy.loop_mana (the loop's starting mana); no rule fills it`);
    }
    const valueOf = (key, path) => ctx.numbersOf(parseStructureId(key).pack)?.value(key, path);

    // ── Ids: a node / stat / resource / boon id is its entry's slug, unique across the stack.
    const slugOf = new Map();
    const taken = new Map();
    for (const key of structure.keys()) {
        const { kind, slug } = parseStructureId(key);
        const slot = `${kind}\0${slug}`;
        if (taken.has(slot)) fail(`the ${kind} slug "${slug}" is in "${taken.get(slot)}" and "${key}" (one graph id each)`);
        taken.set(slot, key);
        slugOf.set(key, slug);
    }
    const tasks = structure.ofKind('task').map((k) => structure.get(k));

    // ── The clock: the one resource the tasks' `time` names (ActionNodes pays every task in mana).
    const clocks = [...new Set(tasks.map((t) => t.time).filter(Boolean))];
    if (clocks.length > 1) fail(`the tasks name ${clocks.length} clocks (${clocks.join(', ')}); ActionNodes has one, its mana`);
    const clock = clocks[0] ?? null;

    // ── Kinds, and the start.
    const kindOf = new Map();
    for (const t of tasks) {
        const kinds = (t.tags ?? []).filter((tag) => KIND_TAGS.includes(tag));
        if (kinds.length > 1) fail(`task "${t.key}" carries ${kinds.join(' and ')} (a node has one kind)`);
        kindOf.set(t.key, kinds[0] ?? 'action');
    }
    const starts = tasks.filter((t) => kindOf.get(t.key) === 'start');
    if (starts.length !== 1) fail(`exactly one task is tagged "start" (found ${starts.length}${starts.length ? `: ${starts.map((t) => t.key).join(', ')}` : ''})`);
    const start = starts[0];

    // ── Openers: the tasks whose results open a place or a task.
    const openers = new Map();
    for (const t of tasks) {
        for (const r of t.results ?? []) if (r.opens) openers.set(r.opens, [...(openers.get(r.opens) ?? []), t.key]);
    }

    const flatten = (entry, part, from) => {
        use('AN-flat');
        report.flattened.push({ entry, part, rule: ruleTag('AN-flat'), from });
    };
    const filled = (entry, part, id, value) => {
        report.filled.push({ entry, part, rule: ruleTag(id), value });
        return value;
    };

    // ── after, for every task (needed by AN1 before the numbers).
    const afterOf = new Map();
    for (const t of tasks) {
        if (t === start) continue;
        if (t.after) { afterOf.set(t.key, t.after.map((set) => [...set])); continue; }
        const opening = [...(openers.get(t.key) ?? []), ...(t.place ? openers.get(t.place) ?? [] : [])];
        if (opening.length) { afterOf.set(t.key, opening.map((k) => [k])); continue; }
        if (!t.place) {
            afterOf.set(t.key, filled(t.key, 'after', 'P1', use('P1').apply({ startId: slugOf.get(start.key) })).map((s) => s.map((id) => taken.get(`task\0${id}`))));
            continue;
        }
        if (t.place === start.place) { afterOf.set(t.key, [[start.key]]); continue; }
        fail(`task "${t.key}" has no \`after\`, and nothing opens its place "${t.place}" (only the start's place is open from the start)`);
    }

    // ── time, per task (AN1 / AN2 / L1 read it).
    const timeOf = new Map();
    for (const t of tasks) {
        let time = valueOf(t.key, 'time');
        if (time === undefined) time = t1Time(t.key);
        timeOf.set(t.key, time);
    }
    function t1Time(key) {
        for (const { game, exists: over } of ctx.allSets.sets()) {
            if (game === ACTION_NODES_ID || over !== parseStructureId(key).pack) continue;
            const set = ctx.allSets.set(game, over);
            const cost = set.value(key, 'time');
            const sourceStart = set.economy.start_clock ?? set.economy.loop_mana;
            if (cost === undefined || sourceStart === undefined) continue;
            return filled(key, 'time', 'T1', use('T1').apply({ cost, sourceStart, receivingStart: loopMana }));
        }
        return fail(`task "${key}" has no time in any numbers set, and no other game's set over its pack prices it (T1)`);
    }

    // ── the limit, per task.
    const limitOf = new Map();
    for (const t of tasks) {
        let limit = valueOf(t.key, 'limit');
        if (t.limit && typeof t.limit === 'object') flatten(t.key, 'limit', 'grows_with');
        if (limit === undefined) {
            if (kindOf.get(t.key) === 'use') {
                const consumed = (t.requires?.[0] ?? []).filter((m) => m.resource && m.consume).map((m) => m.resource);
                // The number held at a loop's start: what the boons give of the consumed resource(s), copies included.
                let held = 0;
                for (const b of structure.ofKind('boon')) {
                    for (const r of structure.get(b).results ?? []) {
                        if (consumed.includes(r.resource) && r.sign === '+') held += (valueOf(b, 'count') ?? 0) * (valueOf(b, `results.${r.resource}`) ?? 0);
                    }
                }
                limit = filled(t.key, 'limit', 'L2', use('L2').apply({ held }));
            } else {
                limit = filled(t.key, 'limit', 'L1', use('L1').apply({ startClock: loopMana, time: timeOf.get(t.key) }));
            }
        }
        limitOf.set(t.key, limit);
    }

    // ── A stat result's amount: its number, else AN2 (filled once). AN1 reads these resolved gains, so a gain AN2
    //    supplied counts toward a later minimum.
    const statResults = new Map();
    const statResultOf = (key, stat) => {
        const slot = `${key}\0${stat}`;
        if (statResults.has(slot)) return statResults.get(slot);
        const path = `results.${stat}`;
        let v = valueOf(key, path);
        if (v === undefined) {
            const trained = (structure.get(key).results ?? []).filter((r) => r.stat).length;
            const share = RULE_HELPERS.t1Share({ cost: timeOf.get(key), sourceStart: loopMana });
            v = filled(key, path, 'AN2', use('AN2').apply({ weight: 1 / trained, rate: economy.stat_rate ?? 1, share }));
        }
        statResults.set(slot, v);
        return v;
    };
    for (const t of tasks) for (const r of t.results ?? []) if (r.stat) statResultOf(t.key, r.stat);

    // ── AN1: the gains of a stat over a task's `after` ancestors.
    const statGain = (key, stat) => ((structure.get(key).results ?? []).some((x) => x.stat === stat) ? statResultOf(key, stat) : 0);
    const ancestorsOf = (key) => {
        const seen = new Set();
        const walk = (k) => { for (const set of afterOf.get(k) ?? []) for (const a of set) if (!seen.has(a)) { seen.add(a); walk(a); } };
        walk(key);
        return [...seen];
    };

    // ── The nodes.
    const nodes = {};
    for (const t of tasks) {
        const node = { name: nameOf(t.key), kind: kindOf.get(t.key), time: timeOf.get(t.key), limit: limitOf.get(t.key) };
        const requires = { stats: {}, resources: {} };
        const results = { stats: {}, resources: {}, mana: 0 };
        let set = t.requires?.[0] ?? [];
        if ((t.requires?.length ?? 0) > 1) {
            flatten(t.key, 'requires', 'alternatives');
            set = use('AN-flat').apply({ form: 'alternative-requires', value: t.requires })[0];
        }
        for (const m of set) {
            if (m.stat) {
                let min = valueOf(t.key, `requires.${m.stat}.min`);
                if (min === undefined) {
                    const ancestors = ancestorsOf(t.key).map((a) => ({ gain: statGain(a, m.stat), limit: limitOf.get(a) ?? 1 }));
                    min = filled(t.key, `requires.${m.stat}.min`, 'AN1', use('AN1').apply({ ancestors }));
                }
                if (min > 0) requires.stats[slugOf.get(m.stat)] = min;
            } else {
                const min = valueOf(t.key, `requires.${m.resource}.min`);
                if (min === undefined) fail(`task "${t.key}" requires "${m.resource}" and no numbers set states its minimum (no rule fills a resource minimum)`);
                requires.resources[slugOf.get(m.resource)] = min;
                if (m.consume) results.resources[slugOf.get(m.resource)] = (results.resources[slugOf.get(m.resource)] ?? 0) - min;
            }
        }
        for (const r of t.results ?? []) {
            const path = `results.${r.stat ?? r.resource ?? r.boon ?? r.opens}`;
            if (r.opens) continue;                                   // A16: it opens after the last performance (`after`)
            if (r.when && r.when !== 'each') flatten(t.key, path, r.when);
            if (r.boon) {
                use('B1');
                report.unused.push({ entry: t.key, part: path, rule: ruleTag('B1'), why: 'a task result gives a boon: an ActionNodes boon is an Archipelago item, earned at a check' });
                continue;
            }
            if (r.stat) {
                results.stats[slugOf.get(r.stat)] = statResultOf(t.key, r.stat);
                continue;
            }
            const v = valueOf(t.key, path);
            if (v === undefined) fail(`task "${t.key}" has the result "${r.resource}" and no numbers set states its amount (no rule fills a resource amount)`);
            const signed = r.sign === '-' ? -v : v;
            if (r.resource === clock) results.mana += signed;
            else results.resources[slugOf.get(r.resource)] = (results.resources[slugOf.get(r.resource)] ?? 0) + signed;
        }
        const req = compact(requires);
        if (req) node.requires = req;
        const res = compact({ ...results, ...(results.mana ? {} : { mana: undefined }) });
        if (res) node.results = res;
        if (t !== start) node.after = afterOf.get(t.key).map((s) => s.map((k) => slugOf.get(k)));
        nodes[slugOf.get(t.key)] = node;
    }

    // ── modifies: AN-flat drops them (nothing folds them yet), each listed.
    for (const key of structure.keys()) {
        for (const m of structure.get(key).modifies ?? []) flatten(key, `modifies.${m.part}`, `modifies ${m.entry}`);
    }

    // ── Stats, resources, boons.
    const stats = Object.fromEntries(structure.ofKind('stat').map((k) => [slugOf.get(k), { name: nameOf(k) }]));
    const resources = Object.fromEntries(structure.ofKind('resource').filter((k) => k !== clock).map((k) => [slugOf.get(k), { name: nameOf(k) }]));
    const boons = {};
    for (const key of structure.ofKind('boon')) {
        const b = structure.get(key);
        const count = valueOf(key, 'count');
        if (count === undefined) fail(`boon "${key}" has no count in any numbers set (no rule fills an item-pool count)`);
        const gives = { stats: {}, resources: {} };
        let mana;
        for (const r of b.results ?? []) {
            const id = r.stat ?? r.resource;
            const v = valueOf(key, `results.${id}`);
            if (r.resource === clock) { mana = v; continue; }              // none → ActionNodes' per-item default
            if (v === undefined) fail(`boon "${key}" gives "${id}" and no numbers set states the amount`);
            const signed = r.sign === '-' ? -v : v;
            if (r.stat) gives.stats[slugOf.get(id)] = signed;
            else gives.resources[slugOf.get(id)] = signed;
        }
        boons[slugOf.get(key)] = { name: nameOf(key), count, gives: compact({ ...gives, mana }) ?? {} };
    }

    // ── The graph.
    const graph = {
        kind: ACTION_GRAPH_KIND,
        schema_version: ACTION_GRAPH_SCHEMA_VERSION,
        graph_id: exists.join('+'),
        name: start.place ? nameOf(start.place) : nameOf(start.key),
        provenance: {
            sources: { packs: { type: 'derived', from: structure.keys(), by: RESOLVER_PATH } },
            default: 'packs',
        },
        loop: { mana: loopMana },
        stats,
        resources,
        boons,
        ...(economy.filler !== undefined ? { filler: slugOf.get(economy.filler) ?? economy.filler } : {}),
        start: slugOf.get(start.key),
        ...(economy.settings ? { settings: structuredClone(economy.settings) } : {}),
        nodes,
    };
    // The graph's own validator: a pack that assembles to a graph ActionNodes refuses is refused here, by its names.
    return assertActionGraph(graph);
}

/** Drop empty groups and undefined values; null when nothing is left. */
function compact(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) continue;
        if (v && typeof v === 'object' && !Object.keys(v).length) continue;
        out[k] = v;
    }
    return Object.keys(out).length ? out : null;
}
