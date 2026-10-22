/**
 * The level-world CERTIFIER, in full, on EVERY region of the committed `seedling_playthrough_maze` preset (⚖
 * "Certifier", user 2026-10-21; session tile-primitives-stage2-l15 for L15, grown by session
 * tile-primitives-levels-gap3 to the whole preset). Two halves:
 *   - INSIDE a level world: for every ordered pair of its sub-regions, the rule derived by search over the
 *     played shared world (`deriveLevelWorldLogic`) must AGREE with the preset's AP exit — the atlas row,
 *     False_ where the atlas has none — at every subset of the items (truth-table equality; the atlas spells
 *     L15 r1c9 → r1c5 as Or(Swim, And(weapon, Swim)), the search as Swim);
 *   - OUT of every region (`deriveEntryLogic`): from its arrival, each outbound boundary exit and each
 *     location it owns, against that exit's / location's AP rule; and every AP exit and location of the
 *     region must be such a target (nothing the AP graph has goes unpriced).
 * Twice: the NATIVE engine (⚖ Q6 "native default") and the SCRIPTED tile definition (⚖ Q3 "one def; logic
 * by search" — `scriptedStep` + the helper bodies), which must agree with each other too. Every witness is
 * replayed on the real `step`.
 *
 * Slow tier: ~17 s native + ~91 s scripted on one core (measured 2026-10-21, L14–L16: 35 searches, 672,742
 * states each).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserializeMazeWorld, createState, step } from '../mazeRoomEngine.js';
import { evaluateRuleAgainstInventory } from '../../shared/procgen/library.js';
import { deriveLevelWorldLogic, deriveEntryLogic, enteredAt } from './deriveLevelWorldLogic.js';
import { ruleFromMinimalSets } from './deriveTileLogic.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const RULES = JSON.parse(readFileSync(
    new URL('../../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const REGIONS = RULES.regions['1'];
const SIDECARS = RULES.preset_sidecars['1'];

/** The world a region plays in: its own payload, or its shared world's carrier's. */
const worldOf = (name) => {
    const own = SIDECARS[name];
    const carrier = own.playable_payload ? own
        : Object.values(SIDECARS).find((s) => s.playable_payload && s.shared_world === own.shared_world);
    return deserializeMazeWorld(carrier.playable_payload);
};
function* subsets(items) {
    for (let mask = 0; mask < 1 << items.length; mask++) yield items.filter((_, i) => mask & (1 << i));
}
const ruleItems = (rule, out = new Set()) => {
    if (rule?.rule === 'Has') out.add(rule.args.item_name);
    for (const c of rule?.children ?? []) ruleItems(c, out);
    return out;
};
const holds = (rule, inv) => evaluateRuleAgainstInventory(rule, new Set(inv));

/** Truth-table equality over the search's items ∪ the AP rule's (an item the world never gates still counts). */
function agree(label, atlas, minimal, items) {
    const derived = ruleFromMinimalSets(minimal);
    for (const inv of subsets([...new Set([...items, ...ruleItems(atlas)])].sort())) {
        expect(holds(derived, inv), `${label} holding [${inv}]`).toBe(holds(atlas, inv));
    }
}
function replay(world, inventory, plan, cell) {
    const w = { ...world, items: new Map() };
    let s = createState(w);
    s.inventory = new Set(inventory);
    for (const input of plan) s = step(w, s, input);
    expect(`${s.player_pos.x},${s.player_pos.y}`).toBe(cell);
}

function certify(native) {
    const lines = [];
    const sharedDone = new Set();
    for (const name of Object.keys(SIDECARS)) {
        const world = worldOf(name);
        if (world.sharedWorld && !sharedDone.has(world.sharedWorld.key)) {
            sharedDone.add(world.sharedWorld.key);
            const out = deriveLevelWorldLogic(world, HELPERS, { native });
            for (const p of out.pairs) {
                const atlas = REGIONS[p.from].exits.find((e) => e.connected_region === p.to)?.access_rule ?? { rule: 'False_' };
                agree(`${p.from} → ${p.to}`, atlas, p.minimal, out.items);
                for (const w of p.witnesses) replay(enteredAt(world, p.from), w.inventory, w.plan, w.cell);
                lines.push(`${p.from}>${p.to}=${JSON.stringify(p.minimal)}`);
            }
        }
        const out = deriveEntryLogic(world, name, HELPERS, { native });
        const entered = world.sharedWorld ? enteredAt(world, name) : world;
        const priced = new Set();
        for (const t of out.targets) {
            const atlas = t.kind === 'exit'
                ? REGIONS[name].exits.find((e) => e.name === t.exitName)?.access_rule
                : (REGIONS[name].locations ?? []).find((l) => l.name === t.locationName)?.access_rule ?? { rule: 'True_' };
            expect(atlas, `${name}: ${t.kind} ${t.exitName ?? t.locationName} has an AP row`).toBeDefined();
            agree(`${name} @ ${t.exitName ?? t.locationName}`, atlas, t.minimal, out.items);
            for (const w of t.witnesses) replay(entered, w.inventory, w.plan, `${t.x},${t.y}`);
            priced.add(t.exitName ?? t.locationName);
            lines.push(`${name}@${t.exitName ?? t.locationName}=${JSON.stringify(t.minimal)}`);
        }
        const inWorld = new Set(world.sharedWorld?.regions ?? []);
        for (const e of REGIONS[name].exits) {
            if (!inWorld.has(e.connected_region)) expect(priced.has(e.name), `${name}: exit ${e.name} priced`).toBe(true);
        }
        for (const l of REGIONS[name].locations ?? []) expect(priced.has(l.name), `${name}: ${l.name} priced`).toBe(true);
    }
    return lines;
}

describe('seedling_playthrough_maze — every region certified against the atlas at every subset', () => {
    let native;
    it('native engine', () => {
        native = certify(true);
        expect(native.length).toBeGreaterThan(0);
    }, 180_000);
    it('scripted tile definition — and it agrees with the native one', () => {
        expect(certify(false)).toEqual(native);
    }, 600_000);
});
