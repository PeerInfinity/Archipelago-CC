/**
 * ⛓⛓ procgen-region-authored-rules — **A ROOM'S OWN MARKED RULE SURVIVES THE DRIVER'S OVERRIDE** (⚖ the user
 * 2026-11-03, *"A: Fix, marked rules only"*).
 *
 * The engine REPLACES an extracted location/exit rule with the pipeline's own (sphere growth: the spec's rule or
 * `True_`; top-down: the source's rule; the sphere library tile branch: the driver's gate), so path-walk pollution
 * never leaks. A rule the substrate MARKS (`procgenCore/authoredRule.js`) is ANDed on instead. The first consumer
 * is the generated Seedling room's key gate: its goal cell's `Has(<key>)` (`seedlingGenRoom.extractGenRules`).
 *
 *   1. the marker itself: non-enumerable and symbol-keyed — invisible to JSON, `structuredClone`, spreads and
 *      `toEqual`, so no serialised byte can move;
 *   2. SPHERE GROWTH, one key-gate room (`SEEDLING_GENERATED_LEAF_STATE` + `keygate`): the goal's rules.json rule
 *      IS `Has(Red Key)` (the sphere default `True_` is no rule, so the authored rule stands alone);
 *   3. TOP-DOWN over the committed Adventure preset, seed 1, mix {maze 1, flash_seedling_gen 1}: the key-gate room
 *      `YellowCastle`'s goal `Inside Yellow Castle` carries `Has(Red Key)`; with the SOURCE's rule for it set to
 *      `Has(Yellow Key)`, the world's rule is the AND of both.
 *
 * MUTANTS (measured, each reverted — the slice's as-built):
 *  a1  `authoredRuleOf` returns null (the marker dropped) ⇒ every build here refuses at serialize,
 *      `keygate-rule-not-carried` (rows 2 and 3 red; also sphere maxItems 3 + filler 2, top-down Adventure seeds 3/4
 *      and the leaf-as-source seed 2, measured the same);
 *  a2  `extractGenRules` marks nothing ⇒ the same.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_LEAF_STATE } from '../procgenPipeline/presetDefs.js';
import { AUTHORED_RULE, authoredRuleOf, markAuthoredRule } from '../procgenCore/authoredRule.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const ADVENTURE = JSON.parse(readFileSync(join(ROOT,
    'frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json'), 'utf8'));

const HAS = (item) => ({ rule: 'Has', args: { item_name: item } });
const build = async (state, ctx) => (await runPresetHeadless(buildRunFromState(structuredClone(state), ctx))).rulesJson;

/** Every generated room holding a key gate → its goal location's rules.json rule. */
function keyGoalRules(rulesJson) {
    const out = {};
    for (const [rid, side] of Object.entries(rulesJson.preset_sidecars['1'])) {
        if (side.substrate !== 'flash_seedling_gen') continue;
        const p = side.playable_payload;
        if (!p.locations.some((l) => l.kind === 'boss-key')) continue;
        const goal = p.locations.find((l) => l.cell.tx === p.goal_cell.tx && l.cell.ty === p.goal_cell.ty);
        out[rid] = { goal: goal.name,
            rule: rulesJson.regions['1'][rid].locations.find((l) => l.name === goal.name).access_rule };
    }
    return out;
}

describe('1 — the marker: a non-enumerable symbol, invisible to every copy and comparison', () => {
    it('reads back, and nothing else sees it', () => {
        const entry = markAuthoredRule({ id: 'loc_0', access_rule: HAS('Red Key') }, HAS('Red Key'));
        expect(authoredRuleOf(entry)).toEqual(HAS('Red Key'));
        expect(entry[AUTHORED_RULE]).toEqual(HAS('Red Key'));
        expect(JSON.stringify(entry)).toBe('{"id":"loc_0","access_rule":{"rule":"Has","args":{"item_name":"Red Key"}}}');
        expect(Object.keys(entry)).toEqual(['id', 'access_rule']);
        expect(authoredRuleOf(structuredClone(entry))).toBe(null);
        expect(authoredRuleOf({ ...entry })).toBe(null);
        expect(entry).toEqual({ id: 'loc_0', access_rule: HAS('Red Key') });
        expect(authoredRuleOf(markAuthoredRule({ id: 'x' }, null))).toBe(null);
        expect(authoredRuleOf(null)).toBe(null);
    });
});

describe('2 — sphere growth: a one-key-gate world\'s goal requires the key', () => {
    it('SEEDLING_GENERATED_LEAF_STATE + keygate: region_3_3\'s goal is `Has(Red Key)`', async () => {
        const rulesJson = await build({ ...SEEDLING_GENERATED_LEAF_STATE,
            params: { ...SEEDLING_GENERATED_LEAF_STATE.params, seedlingGenElements: 'keygate' } });
        expect(keyGoalRules(rulesJson)).toEqual({ region_3_3: { goal: 'region_3_3__loc_0', rule: HAS('Red Key') } });
    }, 120_000);
});

describe('3 — top-down: the key ANDs onto the source\'s own rule', () => {
    const state = { mode: 'topDown', params: { seed: 1, regionWidth: 10, regionHeight: 10, seedlingGenElements: 'keygate' },
        scenario: { items: {}, obstacles: {} }, substrateQuotas: {},
        substrateMix: { maze: 1, flash_seedling_gen: 1 }, substrateMode: 'mix' };

    it('Adventure seed 1: YellowCastle\'s goal (source rule `True_`) is `Has(Red Key)`', async () => {
        const rulesJson = await build(state, { topDownSource: ADVENTURE, sphereLog: null });
        expect(keyGoalRules(rulesJson)).toEqual({ YellowCastle: { goal: 'Inside Yellow Castle', rule: HAS('Red Key') } });
    }, 120_000);

    it('with the source rule `Has(Yellow Key)`: the world\'s rule is `And(Has(Yellow Key), Has(Red Key))`', async () => {
        const source = structuredClone(ADVENTURE);
        const loc = Object.values(source.regions['1']).flatMap((r) => r.locations ?? [])
            .find((l) => l.name === 'Inside Yellow Castle');
        loc.access_rule = HAS('Yellow Key');
        const rulesJson = await build(state, { topDownSource: source, sphereLog: null });
        expect(keyGoalRules(rulesJson)).toEqual({ YellowCastle: { goal: 'Inside Yellow Castle',
            rule: { rule: 'And', children: [HAS('Yellow Key'), HAS('Red Key')] } } });
    }, 120_000);
});
