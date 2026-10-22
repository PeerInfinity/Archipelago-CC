/**
 * The level-world CERTIFIER over a compiled `seedling_playthrough_maze` rules document (⚖ "Certifier", user
 * 2026-10-21; session tile-primitives-stage2-l15 for L15, grown by tile-primitives-levels-gap3 to every region
 * and by tile-primitives-grow-levels to a REGION SAMPLE + per-target grouping). Two halves:
 *   - INSIDE a level world: for every ordered pair of its sub-regions, the rule derived by search over the
 *     played shared world (`deriveLevelWorldLogic`) must AGREE with the preset's AP exit — the atlas row,
 *     False_ where the atlas has none — at every subset of the items (truth-table equality; the atlas spells
 *     L15 r1c9 → r1c5 as Or(Swim, And(weapon, Swim)), the search as Swim);
 *   - OUT of every region (`deriveEntryLogic`): from its arrival, each owned location against its AP rule, and
 *     each TARGET REGION its outbound exits lead to against the Or of the AP exits to it (L16's seven pits to
 *     L17 are seven AP exits and one destination; the interior pit is walled in by the other six).
 *     Every AP exit's target and every location of the region must be priced.
 * Every witness is replayed on the real `step`. Returns the problems (an empty list certifies) and one line
 * per priced target, which two engines must produce identically.
 *
 * ⛔ A counted Has (count ≥ 2) in an AP rule is a PROBLEM by name: the truth table enumerates SETS, which
 * cannot hold two of anything, so it would certify the rule vacuously (⚖ "Refuse counted rules").
 */
import { deserializeMazeWorld, createState, step } from '../mazeRoomEngine.js';
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
    const worldOf = (name) => {
        const own = SIDECARS[name];
        const carrier = own.playable_payload ? own
            : Object.values(SIDECARS).find((s) => s.playable_payload && s.shared_world === own.shared_world);
        return deserializeMazeWorld(carrier.playable_payload);
    };
    const agree = (label, atlas, minimal, items) => {
        if (counted(atlas)) { problems.push(`${label}: the AP rule counts an item — a set truth table cannot certify it`); return; }
        const derived = ruleFromMinimalSets(minimal);
        for (const inv of subsets([...new Set([...items, ...ruleItems(atlas)])].sort())) {
            if (holds(derived, inv) !== holds(atlas, inv)) {
                problems.push(`${label} holding [${inv}]: derived ${holds(derived, inv)}, atlas ${holds(atlas, inv)}`);
                return;
            }
        }
    };
    const replay = (label, world, inventory, plan, cell) => {
        const w = { ...world, items: new Map() };
        let s = createState(w);
        s.inventory = new Set(inventory);
        for (const input of plan) s = step(w, s, input);
        const at = `${s.player_pos.x},${s.player_pos.y}`;
        if (at !== cell) problems.push(`${label}: witness [${inventory}] replays to ${at}, not ${cell}`);
    };

    const sample = new Set(regions ?? Object.keys(SIDECARS));
    const sharedDone = new Set();
    for (const name of Object.keys(SIDECARS).filter((n) => sample.has(n))) {
        const world = worldOf(name);
        if (world.sharedWorld && !sharedDone.has(world.sharedWorld.key)) {
            sharedDone.add(world.sharedWorld.key);
            const out = deriveLevelWorldLogic(world, helpers, { native });
            for (const p of out.pairs) {
                const atlas = REGIONS[p.from].exits.find((e) => e.connected_region === p.to)?.access_rule ?? { rule: 'False_' };
                agree(`${p.from} → ${p.to}`, atlas, p.minimal, out.items);
                for (const w of p.witnesses) replay(`${p.from} → ${p.to}`, enteredAt(world, p.from), w.inventory, w.plan, w.cell);
                lines.push(`${p.from}>${p.to}=${JSON.stringify(p.minimal)}`);
            }
        }
        const out = deriveEntryLogic(world, name, helpers, { native });
        const entered = world.sharedWorld ? enteredAt(world, name) : world;
        const exitTo = new Map(REGIONS[name].exits.map((e) => [e.name, e.connected_region]));
        const byTarget = new Map();
        for (const t of out.targets) {
            const label = `${name} @ ${t.exitName ?? t.locationName}`;
            for (const w of t.witnesses) replay(label, entered, w.inventory, w.plan, `${t.x},${t.y}`);
            if (t.kind === 'exit') {
                const to = exitTo.get(t.exitName);
                if (to === undefined) { problems.push(`${label}: no AP exit of that name`); continue; }
                if (!byTarget.has(to)) byTarget.set(to, []);
                byTarget.get(to).push(...t.minimal);
                continue;
            }
            const loc = (REGIONS[name].locations ?? []).find((l) => l.name === t.locationName);
            if (!loc) { problems.push(`${label}: no AP location of that name`); continue; }
            agree(label, loc.access_rule ?? { rule: 'True_' }, t.minimal, out.items);
            lines.push(`${name}@${t.locationName}=${JSON.stringify(t.minimal)}`);
        }
        const inWorld = new Set(world.sharedWorld?.regions ?? []);
        for (const to of new Set(REGIONS[name].exits.map((e) => e.connected_region))) {
            if (inWorld.has(to)) continue;
            if (!byTarget.has(to)) { problems.push(`${name}: its exit(s) to ${to} are not priced`); continue; }
            const atlas = anyOf(REGIONS[name].exits.filter((e) => e.connected_region === to).map((e) => e.access_rule ?? { rule: 'True_' }));
            agree(`${name} → ${to}`, atlas, byTarget.get(to), out.items);
            lines.push(`${name}->${to}=${JSON.stringify(byTarget.get(to))}`);
        }
        const priced = new Set(out.targets.map((t) => t.locationName).filter(Boolean));
        for (const l of REGIONS[name].locations ?? []) {
            if (!priced.has(l.name)) problems.push(`${name}: location ${l.name} is not priced`);
        }
    }
    return { problems, lines };
}
