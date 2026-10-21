/**
 * The level-world CERTIFIER, in full, on Seedling L15 (⚖ "Certifier", user 2026-10-21; session
 * tile-primitives-stage2-l15). For EVERY ordered pair of L15's sub-regions, the rule derived by search over
 * the played shared world must AGREE with the preset's AP exit — the atlas row — at every subset of the
 * items (truth-table equality; the atlas spells r1c9 → r1c5 as Or(Swim, And(weapon, Swim)), the search
 * as Swim). Twice: the NATIVE engine (⚖ Q6 "native default") and the SCRIPTED tile definition (⚖ Q3 "one
 * def; logic by search" — `scriptedStep` + the helper bodies), which must agree with each other too.
 * Every witness is replayed on the real `step`.
 *
 * Slow tier: ~9 s native + ~33 s scripted on one core (measured 2026-10-21).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserializeMazeWorld, createState, step } from '../mazeRoomEngine.js';
import { evaluateRuleAgainstInventory } from '../../shared/procgen/library.js';
import { deriveLevelWorldLogic, enteredAt } from './deriveLevelWorldLogic.js';
import { ruleFromMinimalSets } from './deriveTileLogic.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const RULES = JSON.parse(readFileSync(
    new URL('../../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const REGIONS = RULES.regions['1'];
const l15 = () => deserializeMazeWorld(RULES.preset_sidecars['1']['level_15__r1c5'].playable_payload);

function* subsets(items) {
    for (let mask = 0; mask < 1 << items.length; mask++) yield items.filter((_, i) => mask & (1 << i));
}
const atlasRule = (from, to) => REGIONS[from].exits.find((e) => e.connected_region === to)?.access_rule ?? null;
const holds = (rule, inv) => evaluateRuleAgainstInventory(rule, new Set(inv));

function certify(native) {
    const world = l15();
    const out = deriveLevelWorldLogic(world, HELPERS, { native });
    expect(out.items).toEqual(['Ghost Spear', 'Progressive Swim', 'Progressive Sword']);
    expect(out.pairs).toHaveLength(6);
    for (const p of out.pairs) {
        const atlas = atlasRule(p.from, p.to);
        expect(atlas, `${p.from} → ${p.to} has an AP exit`).not.toBeNull();
        const derived = ruleFromMinimalSets(p.minimal);
        for (const inv of subsets(out.items)) {
            expect(holds(derived, inv), `${p.from} → ${p.to} holding [${inv}]`).toBe(holds(atlas, inv));
        }
        for (const w of p.witnesses) {
            const entered = { ...enteredAt(world, p.from), items: new Map() };
            let s = createState(entered);
            s.inventory = new Set(w.inventory);
            for (const input of w.plan) s = step(entered, s, input);
            expect(`${s.player_pos.x},${s.player_pos.y}`).toBe(w.cell);
        }
    }
    return out.pairs.map((p) => `${p.from}>${p.to}=${JSON.stringify(p.minimal)}`);
}

describe('L15 level world — certified against the atlas at every subset', () => {
    let native;
    it('native engine', () => { native = certify(true); }, 120_000);
    it('scripted tile definition — and it agrees with the native one', () => {
        expect(certify(false)).toEqual(native);
    }, 300_000);
});
