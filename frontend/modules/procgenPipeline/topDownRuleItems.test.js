// APWORLD SUBSTRATE CHANGE B1 — THE COMPILE DEFINES EVERY ITEM ITS RULES NAME.
//
// `compileRegionGraph` defines (and pools, and places) only the items some placed
// location holds; the rules ride in verbatim. `buildRulesJson` now walks every
// rule of the compiled document (every region's exits and locations, the Menu's
// included, and the completion condition) and, for each name `items[p]` lacks,
// copies the source's def VERBATIM from `sourceItems` — no pool count, no
// placement (the item is referenced, not placed). A name the source lacks too
// stays undefined and is named in the compile's `ruleItemWarnings`.
//
// Measured before (plan §30.0): see the sweep; sm64ex's `Basement Key` /
// `Second Floor Key` (its Menu's two key-gated exits + their return exits) were
// the Menu-attributed case M1 and M3 recorded (§26.8 #1, §28.6 #3).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import '../mazeRoom/mazeRoomLibrary.js';
import { backfillItemDefs, buildRulesJson, ruleItemWarnings } from './procgenPipelineEngine.js';
import { buildTopDownEnvelope, runTopDownToStep } from './topDownSteps.js';
import { validateRules } from '../apworldEditor/rulesUtils.js';
import { itemNamesInRule } from '../procgenCore/ruleItemNames.js';
import { namespaceNamed } from '../procgenCore/apIdNamespaces.js';

const ITEM_ID_BASE = namespaceNamed('procgen-pipeline').itemBase;

const preset = (game, id = 'AP_14089154938208861744') => JSON.parse(readFileSync(new URL(
    `../../presets/${game}/${id}/${id}_rules.json`, import.meta.url,
), 'utf8'));

async function compiled(source, side) {
    const env = buildTopDownEnvelope({
        source, seed: 1, gridDims: { width: side, height: side },
        regionSizeBase: { width: 8, height: 6 }, substrateMix: { maze: 1 },
    });
    await runTopDownToStep(env, 'compile');
    return env;
}

/** ④'s own buildRulesJson call, re-issued over ③'s output, no simulator log. */
function recompile(env, extra = {}) {
    const c = env.compileIn;
    return buildRulesJson(env.finalize.grid, {
        startCell: env.finalize.startCell, seed: c.seed, embedSphereLog: false,
        assumeBidirectional: c.assumeBidirectional, startingItems: c.startingItems,
        sourceItems: c.sourceItemDefs, menuRegion: env.finalize.menuRegion, ...extra,
    });
}

const unknownItems = (doc) => [...new Set(validateRules(doc, '1')
    .map((i) => i.message.match(/unknown item "(.*)"\.?$/)?.[1]).filter(Boolean))];

/** A pure-hub Menu (stripped; its targets become roots with NO back-exit), so
 *  `Menu -> B`'s `Key` is named by the Menu's exit ONLY; `Lamp` by B's location
 *  only; `Ghost` (gating `Menu -> C`) is in no `items` at all. None is placed. */
function hubSource() {
    const T = { rule: 'True_' };
    const has = (item_name) => ({ rule: 'Has', args: { item_name } });
    const reg = (name, exits = [], locations = []) => ({ name, exits, locations });
    const ex = (name, to, rule = T) => ({ name, connected_region: to, access_rule: rule });
    return {
        game_name: 'Hub',
        start_regions: { 1: { default: ['Menu'] } },
        regions: {
            1: {
                Menu: reg('Menu', [ex('Menu -> A', 'A'), ex('Menu -> B', 'B', has('Key')),
                    ex('Menu -> C', 'C', has('Ghost'))]),
                A: reg('A', [], [{ name: 'A1', access_rule: T, item: { name: 'k1' } }]),
                B: reg('B', [], [{ name: 'B1', access_rule: has('Lamp'), item: { name: 'k2' } }]),
                C: reg('C', [], [{ name: 'C1', access_rule: T, item: { name: 'Victory' } }]),
            },
        },
        items: {
            1: {
                // ⛓ extra fields, so VERBATIM is visible (the def is not re-minted);
                // Key's id sits INSIDE the compiled pool's own range (ITEM_ID_BASE…),
                // so it collides; Lamp's does not.
                Key: { name: 'Key', id: ITEM_ID_BASE + 1, groups: ['Keys'], advancement: true, classification: 'progression' },
                // Lamp's id is the first one the pool (k1, k2, Victory) leaves free — the
                // id a moved Key would take if Lamp's verbatim id were not reserved first
                Lamp: { name: 'Lamp', id: ITEM_ID_BASE + 3, groups: [], classification: 'useful' },
                k1: { name: 'k1', id: 7 },
                Trophy: { name: 'Trophy', id: 99, classification: 'progression' },
            },
        },
    };
}

describe('B1 — a rule-named item nothing placed is DEFINED, not placed', () => {
    it('Key (a Menu exit\'s rule) and Lamp (a location\'s rule) get the source\'s defs verbatim, first-reference order, after the compiled keys', async () => {
        const source = hubSource();
        const env = await compiled(source, 3);
        const doc = env.compile.rulesJson;
        // the fixture's premises: the Menu was stripped, all three roots placed
        expect(env.layout.menuName).toBe('Menu');
        expect(doc.regions['1'].Menu.exits.map((e) => e.connected_region)).toEqual(['A', 'B', 'C']);
        const items = doc.items['1'];
        const { id: _keyId, ...keyRest } = source.items['1'].Key;
        expect(items.Key).toMatchObject(keyRest);
        expect(Object.keys(items.Key)).toEqual(Object.keys(source.items['1'].Key));
        expect(items.Lamp).toEqual(source.items['1'].Lamp);
        // the compiled pool's keys first, unchanged; then the referenced, in document order
        const bare = recompile(env, { sourceItems: null }).items['1'];
        expect(Object.keys(items)).toEqual([...Object.keys(bare), 'Key', 'Lamp']);
        for (const k of Object.keys(bare)) expect(items[k]).toEqual(bare[k]);
        // an item nobody's rule names is not copied (Trophy), a placed one keeps its compiled def (k1)
        expect(items.Trophy).toBeUndefined();
        expect(items.k1).toEqual(bare.k1);
        expect(items.k1).not.toEqual(source.items['1'].k1);
    });

    it('⛓ an id the compiled pool already holds MOVES to the lowest free id ≥ ITEM_ID_BASE; a free one is kept; every id unique', async () => {
        const source = hubSource();
        const env = await compiled(source, 3);
        const items = env.compile.rulesJson.items['1'];
        const bare = recompile(env, { sourceItems: null }).items['1'];
        const bareIds = Object.values(bare).map((d) => d.id);
        expect(bareIds).toHaveLength(3);
        expect(bareIds).not.toContain(source.items['1'].Lamp.id);
        // the premise: Key's source id is a compiled item's
        expect(bareIds).toContain(source.items['1'].Key.id);
        const taken = new Set([...bareIds, source.items['1'].Lamp.id]);
        let free = ITEM_ID_BASE;
        while (taken.has(free)) free += 1;
        expect(items.Key.id).toBe(free);
        expect(items.Lamp.id).toBe(source.items['1'].Lamp.id);
        const ids = Object.values(items).map((d) => d.id).filter((id) => id != null);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('⛓ no pool count and no placement — the backfill touches items[p] only', async () => {
        const env = await compiled(hubSource(), 3);
        const doc = env.compile.rulesJson;
        const bare = recompile(env, { sourceItems: null });
        const withDefs = recompile(env);
        expect(doc.itempool_counts['1']).toEqual(bare.itempool_counts['1']);
        expect(doc.canonical_placements['1']).toEqual(bare.canonical_placements['1']);
        for (const name of ['Key', 'Lamp']) {
            expect(Object.hasOwn(doc.itempool_counts['1'], name)).toBe(false);
            expect(Object.values(doc.canonical_placements['1'])).not.toContain(name);
        }
        const placedNames = Object.values(doc.regions['1']).flatMap((r) => r.locations ?? [])
            .map((l) => l.item?.name).filter(Boolean);
        expect(placedNames).not.toContain('Key');
        expect(placedNames).not.toContain('Lamp');
        // every OTHER key of the document is what it was without the backfill
        const { items: _a, ...rest } = withDefs;
        const { items: _b, ...restBare } = bare;
        expect(JSON.stringify(rest)).toBe(JSON.stringify(restBare));
    });

    it('a name the source lacks too is NOT invented — it stays unknown and is warned once, naming its first reference', async () => {
        const env = await compiled(hubSource(), 3);
        const doc = env.compile.rulesJson;
        expect(Object.hasOwn(doc.items['1'], 'Ghost')).toBe(false);
        expect(unknownItems(doc)).toEqual(['Ghost']);
        expect(env.compile.ruleItemWarnings).toEqual([
            'Rule item "Ghost" (named by exit "Menu -> C" in "Menu") is defined nowhere: '
            + 'no placed location holds it and the source does not define it',
        ]);
        expect(ruleItemWarnings(doc, '1')).toEqual(env.compile.ruleItemWarnings);
    });

    it('the completion condition is walked too: an item_check on an unplaced item is defined from the source', async () => {
        const env = await compiled(hubSource(), 3);
        const doc = recompile(env, { completionConditionItem: 'Trophy' });
        expect(doc.game_info['1'].completion_condition).toEqual({ type: 'item_check', item: 'Trophy' });
        expect(doc.items['1'].Trophy).toEqual(hubSource().items['1'].Trophy);
        expect(Object.hasOwn(doc.itempool_counts['1'], 'Trophy')).toBe(false);
        expect(unknownItems(doc)).toEqual(['Ghost']);
        // and one the source lacks is warned as the completion condition's
        const lacking = recompile(env, { completionConditionItem: 'Nowhere' });
        expect(ruleItemWarnings(lacking, '1').at(-1)).toBe('Rule item "Nowhere" (named by the completion '
            + 'condition) is defined nowhere: no placed location holds it and the source does not define it');
    });

    it('no sourceItems (grid growth, sphere growth, the byte-identity dump) → nothing is backfilled', async () => {
        const env = await compiled(hubSource(), 3);
        const bare = recompile(env, { sourceItems: null });
        expect(Object.hasOwn(bare.items['1'], 'Key')).toBe(false);
        expect(ruleItemWarnings(bare, '1').map((w) => w.match(/"(.*?)"/)[1])).toEqual(['Key', 'Ghost', 'Lamp']);
    });
});

describe('B1 — backfillItemDefs, the ONE backfill (rule items AND starting items)', () => {
    it('verbatim when free; a held id moves to the lowest id ≥ ITEM_ID_BASE nobody holds or keeps; null stays null; once per name; nothing without sourceItems', () => {
        const items = { a: { name: 'a', id: ITEM_ID_BASE }, b: { name: 'b', id: ITEM_ID_BASE + 2 } };
        const src = {
            x: { name: 'x', id: ITEM_ID_BASE, extra: 1 },      // held by a → moves
            y: { name: 'y', id: ITEM_ID_BASE + 1 },            // free → kept, and reserved
            ev: { name: 'ev', id: null },                      // an event
            a: { name: 'a', id: 999 },                         // already defined → untouched
        };
        backfillItemDefs(items, ['x', 'x', 'y', 'ev', 'a', 'nowhere'], src);
        expect(Object.keys(items)).toEqual(['a', 'b', 'x', 'y', 'ev']);
        expect(items.x).toEqual({ name: 'x', id: ITEM_ID_BASE + 3, extra: 1 });
        expect(items.y).toBe(src.y);
        expect(items.ev).toBe(src.ev);
        expect(items.a).toEqual({ name: 'a', id: ITEM_ID_BASE });
        const before = JSON.stringify(items);
        backfillItemDefs(items, ['zz'], null);
        expect(JSON.stringify(items)).toBe(before);
    });

    it('a STARTING item whose verbatim id the pool holds moves too; the starting list keeps its multiset', async () => {
        const source = hubSource();
        const env = await compiled(source, 3);
        const doc = recompile(env, {
            startingItems: ['Trophy', 'Trophy'],
            sourceItems: { Trophy: { ...source.items['1'].Trophy, id: ITEM_ID_BASE } },
        });
        const bareIds = Object.values(recompile(env, { sourceItems: null }).items['1']).map((d) => d.id);
        expect(bareIds).toContain(ITEM_ID_BASE);
        expect(doc.starting_items['1']).toEqual(['Trophy', 'Trophy']);
        expect(bareIds).not.toContain(doc.items['1'].Trophy.id);
        expect(doc.items['1'].Trophy.id).toBeGreaterThanOrEqual(ITEM_ID_BASE);
        const ids = Object.values(doc.items['1']).map((d) => d.id).filter((id) => id != null);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('B1 — the committed source M1 and M3 recorded', () => {
    it('sm64ex: the Menu\'s key-gated exits (and their return exits) name keys no placed location holds — defined verbatim, 0 unknown, pool untouched', async () => {
        const source = preset('sm64ex');
        const env = await compiled(source, 12);
        const doc = env.compile.rulesJson;
        const bare = recompile(env, { sourceItems: null });
        const named = unknownItems(bare);
        // the premise, derived: the bare compile leaves these undefined, and the source defines each
        expect(named.length).toBeGreaterThan(0);
        for (const n of named) expect(source.items['1'][n], n).toBeTruthy();
        // a Menu exit names one of them
        const menuNames = doc.regions['1'].Menu.exits.flatMap((e) => itemNamesInRule(e.access_rule));
        expect(named.some((n) => menuNames.includes(n))).toBe(true);
        expect(unknownItems(doc)).toEqual([]);
        expect(env.compile.ruleItemWarnings).toEqual([]);
        for (const n of named) {
            expect(doc.items['1'][n]).toEqual(source.items['1'][n]);
            expect(Object.hasOwn(doc.itempool_counts['1'], n)).toBe(false);
        }
        expect(doc.itempool_counts['1']).toEqual(bare.itempool_counts['1']);
        expect(doc.canonical_placements['1']).toEqual(bare.canonical_placements['1']);
    });
});
