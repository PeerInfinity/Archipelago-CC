/**
 * apworldEditor/rulesDocOps — **THE RULES DOCUMENT'S OPS** (EDITOR INTEGRATION
 * slice B-c).
 *
 * ⛓ THE FIXTURE IS BUILT, NOT COPIED. `shared/rulesJsonBuilder.js`'s own
 * helpers assemble it, so a row here cannot be passing because some preset
 * happens to hold a shape, and no preset file is a dependency of this file.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createEditSession, foldEdits, group } from '../procgenCore/editCore.js';
import {
    makeExit, makeHasRule, makeLocation, makeRegion, makeRulesJsonScaffold,
} from '../shared/rulesJsonBuilder.js';
import { rulesEditAdapter } from './rulesEditAdapter.js';
import { validateRules } from './rulesUtils.js';
import {
    ADDITIVE_TYPE, EXIT_FIELDS, ITEM_FIELDS, ITEM_GROUPS_KEY, META_FIELDS,
    PLACEMENT_ISSUE_REASONS, PROGRESSION_ISSUE_REASONS, PROGRESSION_KINDS,
    PROGRESSION_MAPPING_KEY, REFUSAL_NAME_LIMIT, RULES_OP_KINDS, SET_KEY_SCOPES,
    SIDECAR_NOT_REDERIVED, applyRulesDocOp,
    canonicalPlacementIssues, canonicalPlacementIssuesByPlayer, deleteItemOps, deleteRegionOps,
    describePlacementIssue, describeProgressionIssue, exitsPointingAt, itemGroupRegistry,
    itemsCarryingGroup, locationsOfPlayer, nextName, progressionKindOf, progressionMappingIssues,
    progressionMappings, progressionMemberNames, unlistedItemGroups,
} from './rulesDocOps.js';

const P = '1';

/** ⛓ Two regions, a wired exit, a location whose rule names an item, two items,
 *  a pool count, a starting item and an `item_check` victory — the smallest
 *  document in which EVERY cascade site is non-empty. */
function fixture() {
    const doc = makeRulesJsonScaffold({
        gameName: 'Fixture', gameDirectory: 'fixture', worldClassName: 'FixtureWorld',
        startRegions: ['Hall'],
    });
    doc.regions[P] = {
        Hall: makeRegion('Hall', [makeExit('Hall → Vault', 'Vault')], [
            // ⛓ An `And` so BOTH item and region cascades have a nested site to reach.
            makeLocation('Hall Chest', 1, {
                rule: 'And',
                children: [makeHasRule('Key'), { rule: 'CanReachRegion', args: { region_name: 'Vault' } }],
            }),
        ]),
        Vault: makeRegion('Vault', [], [makeLocation('Vault Chest', 2)]),
    };
    doc.regions[P].Hall.exits[0].access_rule = {
        rule: 'CanReachLocation', args: { location_name: 'Hall Chest' },
    };
    doc.items[P] = {
        Key: { name: 'Key', id: 1, groups: [], classification: 'progression', type: null, max_count: 1 },
        Victory: { name: 'Victory', id: null, groups: [], classification: 'progression', type: null, event: true },
    };
    doc.itempool_counts[P] = { Key: 1 };
    doc.starting_items[P] = ['Key'];
    doc.game_info[P].completion_condition = { type: 'item_check', item: 'Victory' };
    /**
     * ⛓ H4b — A SIDECAR ON `Hall`, and only on `Hall`. `replace-region-sidecar`
     * refuses a region with no sidecar entry BY NAME, so the fixture needs both
     * kinds of region for that row to mean anything: `Hall` has a room and
     * `Vault` is a classic AP region that never had one.
     *
     * ⛔ The payload is DELIBERATELY not a real maze world. This op is pure and
     * treats a payload as opaque bytes — the substrate's own round-trip is what
     * knows a maze world from a bounce level, and it is tested where it lives.
     */
    doc.preset_sidecars = {
        [P]: {
            Hall: {
                substrate: 'maze',
                render_hint: 'maze',
                grid_cell: { gx: 0, gy: 0 },
                playable_payload: { width: 3, height: 3, tiles: 'aaa' },
            },
        },
    };
    return doc;
}

/** ⛓ The rules map `Hall`'s own exits and locations require — DERIVED from the
 *  fixture, so a row cannot pass by naming a thing the fixture stopped having. */
const hallRules = (doc, rule = { rule: 'True_' }) => ({
    exits: Object.fromEntries(doc.regions[P].Hall.exits.map((e) => [e.name, rule])),
    locations: Object.fromEntries(doc.regions[P].Hall.locations.map((l) => [l.name, rule])),
});

const apply = (doc, op) => applyRulesDocOp(doc, op);
const applied = (doc, op) => {
    const res = apply(doc, op);
    if (!res.ok) throw new Error(`unexpectedly refused: ${res.error}`);
    return res;
};
const bytes = (doc) => JSON.stringify(doc);

describe('the contract shape', () => {
    it('refuses a non-document and an unknown op, naming the vocabulary', () => {
        expect(apply(null, { op: 'clear' }).error).toMatch(/a rules document is an object/);
        const bad = apply(fixture(), { op: 'set-everything' });
        expect(bad.ok).toBe(false);
        expect(bad.error).toContain('unknown op "set-everything"');
        for (const kind of RULES_OP_KINDS) expect(bad.error).toContain(kind);
    });

    it('⛔ NEVER MUTATES the document it is handed — every kind, over one fixture', () => {
        const doc = fixture();
        // ⛓ `makeRulesJsonScaffold` writes an EMPTY registry, and the rename and
        //   delete samples below need an entry that exists and that nothing
        //   carries — which is what a slot looks like just after `add`.
        doc[ITEM_GROUPS_KEY][P] = ['Everything'];
        const before = bytes(doc);
        const samples = {
            'add-region': { op: 'add-region' },
            // ⚠ `Hall` and not `Vault`: `Vault` is the REFERENCED one and its
            //    atomic delete is refused by design — its own row is below.
            'delete-region': { op: 'delete-region', name: 'Hall' },
            'rename-region': { op: 'rename-region', from: 'Vault', to: 'Crypt' },
            'add-exit': { op: 'add-exit', region: 'Vault' },
            'delete-exit': { op: 'delete-exit', region: 'Hall', index: 0 },
            'set-exit-field': { op: 'set-exit-field', region: 'Hall', index: 0, field: 'name', value: 'x' },
            'add-location': { op: 'add-location', region: 'Vault' },
            'delete-location': { op: 'delete-location', region: 'Hall', index: 0 },
            'rename-location': { op: 'rename-location', region: 'Hall', index: 0, to: 'Chest A' },
            'add-item': { op: 'add-item' },
            'delete-item': { op: 'delete-item', name: 'Victory' },
            'rename-item': { op: 'rename-item', from: 'Key', to: 'Master Key' },
            'set-item-field': { op: 'set-item-field', item: 'Key', field: 'max_count', value: 3 },
            'set-starting-count': { op: 'set-starting-count', item: 'Key', count: 2 },
            'add-item-group': { op: 'add-item-group', name: 'Tools' },
            'rename-item-group': { op: 'rename-item-group', name: 'Everything', newName: 'All' },
            'delete-item-group': { op: 'delete-item-group', name: 'Everything' },
            'set-meta': { op: 'set-meta', key: 'game_name', value: 'Other' },
            'set-start-region': { op: 'set-start-region', region: 'Vault' },
            'set-completion-condition': { op: 'set-completion-condition', condition: { type: 'constant', value: true } },
            'set-rule-tree': { op: 'set-rule-tree', path: { region: 'Hall', kind: 'exit', index: 0 }, tree: { rule: 'True_' } },
            'replace-region-sidecar': {
                op: 'replace-region-sidecar', region: 'Hall',
                payload: { width: 4, height: 4, tiles: 'bbbb' }, rules: hallRules(doc),
            },
            'set-region-sidecar': {
                op: 'set-region-sidecar', region: 'Hall',
                entry: { substrate: 'maze', playable_payload: { width: 4, height: 4, tiles: 'bbbb' } },
            },
            'set-canonical-placement': {
                op: 'set-canonical-placement', location: 'Vault Chest', item: 'Key',
            },
            'set-progression-mapping': {
                op: 'set-progression-mapping', name: 'Progressive Key',
                mapping: { base_item: 'Progressive Key', items: [{ name: 'Key', level: 1 }] },
            },
            'set-key': { op: 'set-key', key: 'preset_label', value: 'a label' },
            'replace-document': { op: 'replace-document', document: { game_name: 'Replaced' } },
            clear: { op: 'clear' },
        };
        // ⛔ The sample table covers the WHOLE vocabulary — derived, so a new op
        //    kind cannot slip past this row by not being listed.
        expect(Object.keys(samples).sort()).toEqual([...RULES_OP_KINDS].sort());
        for (const [kind, op] of Object.entries(samples)) {
            const res = apply(doc, op);
            expect(res.ok, `${kind}: ${res.error}`).toBe(true);
            expect(bytes(doc), `${kind} mutated its input`).toBe(before);
        }
    });
});

describe('regions', () => {
    it('add-region derives its name from the RECORD and answers the region', () => {
        const doc = fixture();
        const res = applied(doc, { op: 'add-region' });
        expect(res.value).toEqual({ name: 'New Region', exits: [], locations: [] });
        const again = applied(res.doc, { op: 'add-region' });
        expect(again.value.name).toBe('New Region 2');
        expect(Object.keys(again.doc.regions[P])).toEqual(['Hall', 'Vault', 'New Region', 'New Region 2']);
    });

    it('add-region refuses a duplicate and a blank name', () => {
        expect(apply(fixture(), { op: 'add-region', name: 'Hall' }).error)
            .toBe('A region named "Hall" already exists.');
        expect(apply(fixture(), { op: 'add-region', name: '  ' }).ok).toBe(false);
    });

    /**
     * ⛓⛓⛓ **THE CASCADE ROW.** `delete-region` refuses while a surviving exit
     * points at it, and the sentence is `validateRules`' OWN — asserted by
     * running the validator over the would-be document and finding that exact
     * message in it, so a row that agreed with a re-spelled copy is impossible.
     */
    it('⛓⛓ delete-region REFUSES a referenced region, quoting the validator VERBATIM', () => {
        const doc = fixture();
        const res = apply(doc, { op: 'delete-region', name: 'Vault' });
        expect(res.ok).toBe(false);
        const broken = JSON.parse(JSON.stringify(doc));
        delete broken.regions[P].Vault;
        const validatorSaid = validateRules(broken, P)
            .filter((i) => i.severity === 'error').map((i) => i.message);
        expect(validatorSaid.some((m) => res.error.startsWith(m))).toBe(true);
        expect(res.error).toContain('deleteRegionOps(doc, name)');
    });

    it('⛓ the GROUP the builder makes is accepted, and one undo restores both', () => {
        const doc = fixture();
        expect(exitsPointingAt(doc, P, 'Vault')).toEqual([{ region: 'Hall', index: 0 }]);
        const ops = deleteRegionOps(doc, 'Vault', P);
        expect(ops.map((o) => o.op)).toEqual(['set-exit-field', 'delete-region']);
        const out = foldEdits(rulesEditAdapter, doc, [group('delete region Vault', ops)]);
        expect(Object.keys(out.record.regions[P])).toEqual(['Hall']);
        expect(out.record.regions[P].Hall.exits[0].connected_region).toBe('');
    });

    it('⛔ REVERSED the group refuses — the order is load-bearing', () => {
        const doc = fixture();
        const reversed = [...deleteRegionOps(doc, 'Vault', P)].reverse();
        expect(() => foldEdits(rulesEditAdapter, doc, [group('reversed', reversed)])).toThrow();
    });

    it('an UNREFERENCED region deletes with no cascade and no validation cost', () => {
        const doc = fixture();
        const solo = applied(doc, { op: 'add-region', name: 'Attic' }).doc;
        expect(deleteRegionOps(solo, 'Attic', P).map((o) => o.op)).toEqual(['delete-region']);
        expect(applied(solo, { op: 'delete-region', name: 'Attic' }).ok).toBe(true);
    });

    /**
     * ⛓⛓⛓ **THE FOLD MEASUREMENT (design row 4).** The rename is ONE op
     * carrying the cascade. This row builds the alternative — a `group` of
     * atomic ops, one per site — and asserts the two produce the SAME BYTES.
     * They do, which is what makes "one op" a choice about description length
     * rather than about behaviour: the group is 4 members that a caller must
     * first compute from the document, against one op of four fields.
     */
    it('⛓⛓⛓ rename-region: the ONE op and a hand-built GROUP of its four sites fold to the SAME BYTES', () => {
        const doc = fixture();
        const one = applied(doc, { op: 'rename-region', from: 'Vault', to: 'Crypt' }).doc;

        // The same four sites, spelled as atomic ops a caller would have to build.
        const asGroup = foldEdits(rulesEditAdapter, doc, [group('rename Vault → Crypt', [
            // (2) the exit destination
            { op: 'set-exit-field', region: 'Hall', index: 0, field: 'connected_region', value: 'Crypt' },
            // (3) the CanReachRegion reference nested in Hall's location rule
            {
                op: 'set-rule-tree',
                path: { region: 'Hall', kind: 'location', index: 0 },
                tree: {
                    rule: 'And',
                    children: [
                        makeHasRule('Key'),
                        { rule: 'CanReachRegion', args: { region_name: 'Crypt' } },
                    ],
                },
            },
        ])]).record;
        // (1) the ordered key + `name`, and (4) start_regions — NEITHER has an
        //     atomic op, and giving them one is the cost the group would add.
        const keyed = {};
        for (const [k, v] of Object.entries(asGroup.regions[P])) {
            if (k === 'Vault') keyed.Crypt = { ...v, name: 'Crypt' }; else keyed[k] = v;
        }
        asGroup.regions[P] = keyed;

        expect(bytes(one)).toBe(bytes(asGroup));
        // …and not vacuously: the rename really moved all four.
        expect(bytes(one)).not.toBe(bytes(doc));
    });

    it('rename-region carries every one of its four sites', () => {
        const doc = fixture();
        const start = applied(doc, { op: 'set-start-region', region: 'Vault' }).doc;
        const out = applied(start, { op: 'rename-region', from: 'Vault', to: 'Crypt' }).doc;
        expect(Object.keys(out.regions[P])).toEqual(['Hall', 'Crypt']);        // key order kept
        expect(out.regions[P].Crypt.name).toBe('Crypt');
        expect(out.regions[P].Hall.exits[0].connected_region).toBe('Crypt');
        expect(out.regions[P].Hall.locations[0].access_rule.children[1].args.region_name).toBe('Crypt');
        expect(out.start_regions[P].default).toEqual(['Crypt']);
        expect(validateRules(out, P).filter((i) => i.severity === 'error')).toEqual([]);
    });

    it('⛓ a rename cascade that MISSED a site is a validator ERROR — the mutant\'s row', () => {
        const doc = fixture();
        const halfDone = JSON.parse(JSON.stringify(doc));
        const { Vault, ...rest } = halfDone.regions[P];
        halfDone.regions[P] = { ...rest, Crypt: { ...Vault, name: 'Crypt' } };
        const errs = validateRules(halfDone, P).filter((i) => i.severity === 'error');
        expect(errs.map((e) => e.message).join('\n')).toContain('unknown region "Vault"');
    });

    it('rename-region refuses an unknown source, a blank target and a collision', () => {
        const doc = fixture();
        expect(apply(doc, { op: 'rename-region', from: 'Nope', to: 'x' }).error).toContain('no region "Nope"');
        expect(apply(doc, { op: 'rename-region', from: 'Hall', to: '  ' }).ok).toBe(false);
        expect(apply(doc, { op: 'rename-region', from: 'Hall', to: 'Vault' }).error)
            .toBe('A region named "Vault" already exists.');
    });
});

describe('exits and locations', () => {
    it('add-exit / add-location derive their names and answer the node', () => {
        const doc = fixture();
        const e = applied(doc, { op: 'add-exit', region: 'Vault' });
        expect(e.value.name).toBe('Vault → ?');
        expect(e.value.connected_region).toBe('');
        const l = applied(e.doc, { op: 'add-location', region: 'Vault' });
        expect(l.value.name).toBe('New Location');
        expect(l.doc.regions[P].Vault.locations.map((x) => x.name))
            .toEqual(['Vault Chest', 'New Location']);
    });

    it('delete-exit / delete-location refuse a bad index and an unknown region', () => {
        const doc = fixture();
        expect(apply(doc, { op: 'delete-exit', region: 'Hall', index: 7 }).error).toContain('no exit #7');
        expect(apply(doc, { op: 'delete-location', region: 'Nope', index: 0 }).error).toContain('no region "Nope"');
    });

    it('set-exit-field writes the two fields the row writes and REFUSES a third', () => {
        const doc = fixture();
        const named = applied(doc, { op: 'set-exit-field', region: 'Hall', index: 0, field: 'name', value: 'Door' });
        expect(named.doc.regions[P].Hall.exits[0].name).toBe('Door');
        expect(Object.keys(named.doc.regions[P].Hall.exits[0]))
            .toEqual(['name', 'connected_region', 'access_rule']);          // position kept
        const bad = apply(doc, { op: 'set-exit-field', region: 'Hall', index: 0, field: 'access_rule', value: {} });
        expect(bad.ok).toBe(false);
        expect(bad.error).toContain('set-rule-tree');
    });

    it('rename-location cascades into CanReachLocation and refuses a collision', () => {
        const doc = fixture();
        const out = applied(doc, { op: 'rename-location', region: 'Hall', index: 0, to: 'Chest A' }).doc;
        expect(out.regions[P].Hall.locations[0].name).toBe('Chest A');
        expect(out.regions[P].Hall.exits[0].access_rule.args.location_name).toBe('Chest A');
        const two = applied(doc, { op: 'add-location', region: 'Hall', name: 'Other' }).doc;
        expect(apply(two, { op: 'rename-location', region: 'Hall', index: 1, to: 'Hall Chest' }).ok).toBe(false);
    });
});

describe('items', () => {
    it('add-item writes the item AND its pool count of 1, and answers the item', () => {
        const doc = fixture();
        const res = applied(doc, { op: 'add-item' });
        expect(res.value.name).toBe('New Item');
        expect(res.doc.itempool_counts[P]).toEqual({ Key: 1, 'New Item': 1 });
    });

    it('⛓⛓ delete-item REFUSES while the pool or the starting list names it, quoting the validator', () => {
        const doc = fixture();
        const res = apply(doc, { op: 'delete-item', name: 'Key' });
        expect(res.ok).toBe(false);
        const broken = JSON.parse(JSON.stringify(doc));
        delete broken.items[P].Key;
        const validatorSaid = validateRules(broken, P)
            .filter((i) => i.severity === 'error').map((i) => i.message);
        expect(validatorSaid.some((m) => res.error.startsWith(m))).toBe(true);
        expect(res.error).toContain('deleteItemOps(doc, name)');
    });

    it('⛓ the builder\'s group clears both danglers first, and folds clean', () => {
        const doc = fixture();
        const ops = deleteItemOps(doc, 'Key', P);
        expect(ops.map((o) => o.op)).toEqual(['set-item-field', 'set-starting-count', 'delete-item']);
        const out = foldEdits(rulesEditAdapter, doc, [group('delete item Key', ops)]).record;
        expect(out.items[P].Key).toBeUndefined();
        expect(out.itempool_counts[P]).toEqual({});
        expect(out.starting_items[P]).toEqual([]);
    });

    it('an item with NEITHER a pool count nor a starting entry deletes alone', () => {
        const doc = fixture();
        expect(deleteItemOps(doc, 'Victory', P).map((o) => o.op)).toEqual(['delete-item']);
        expect(applied(doc, { op: 'delete-item', name: 'Victory' }).ok).toBe(true);
    });

    it('rename-item carries every one of its six sites', () => {
        const doc = fixture();
        const out = applied(doc, { op: 'rename-item', from: 'Key', to: 'Master Key' }).doc;
        expect(Object.keys(out.items[P])).toEqual(['Master Key', 'Victory']);   // key order kept
        expect(out.items[P]['Master Key'].name).toBe('Master Key');
        expect(out.itempool_counts[P]).toEqual({ 'Master Key': 1 });
        expect(out.starting_items[P]).toEqual(['Master Key']);
        expect(out.regions[P].Hall.locations[0].access_rule.children[0].args.item_name).toBe('Master Key');
        const win = applied(out, { op: 'rename-item', from: 'Victory', to: 'Win' }).doc;
        expect(win.game_info[P].completion_condition.item).toBe('Win');
        expect(validateRules(win, P).filter((i) => i.severity === 'error')).toEqual([]);
    });

    it('set-item-field writes each `where`, and an ABSENT value DELETES', () => {
        const doc = fixture();
        const a = applied(doc, { op: 'set-item-field', item: 'Key', field: 'max_count', value: 4 }).doc;
        expect(a.items[P].Key.max_count).toBe(4);
        const b = applied(a, { op: 'set-item-field', item: 'Key', field: 'max_count' }).doc;
        expect('max_count' in b.items[P].Key).toBe(false);
        const c = applied(doc, { op: 'set-item-field', item: 'Key', field: 'pool_count', value: 7 }).doc;
        expect(c.itempool_counts[P].Key).toBe(7);
        const d = applied(c, { op: 'set-item-field', item: 'Key', field: 'pool_count' }).doc;
        expect('Key' in d.itempool_counts[P]).toBe(false);
    });

    it('set-item-field refuses a field the TABLE does not hold, and an unknown item', () => {
        const doc = fixture();
        const bad = apply(doc, { op: 'set-item-field', item: 'Key', field: 'colour', value: 'red' });
        expect(bad.ok).toBe(false);
        expect(bad.error).toContain('ITEM_FIELDS');
        for (const f of Object.keys(ITEM_FIELDS)) expect(bad.error).toContain(f);
        expect(apply(doc, { op: 'set-item-field', item: 'Ghost', field: 'id', value: 1 }).ok).toBe(false);
    });

    it('set-starting-count rewrites the LIST, floors at 0 and rounds', () => {
        const doc = fixture();
        expect(applied(doc, { op: 'set-starting-count', item: 'Key', count: 3 }).doc.starting_items[P])
            .toEqual(['Key', 'Key', 'Key']);
        expect(applied(doc, { op: 'set-starting-count', item: 'Key', count: -2 }).doc.starting_items[P])
            .toEqual([]);
        expect(applied(doc, { op: 'set-starting-count', item: 'Key', count: 2.7 }).doc.starting_items[P])
            .toEqual(['Key', 'Key']);
        // ⛓ Other items' entries survive, in order.
        const two = applied(doc, { op: 'set-starting-count', item: 'Victory', count: 1 }).doc;
        expect(applied(two, { op: 'set-starting-count', item: 'Key', count: 1 }).doc.starting_items[P])
            .toEqual(['Victory', 'Key']);
    });
});

/**
 * ⛓⛓⛓ **THE ITEM-GROUP REGISTRY AND ITS MEMBERSHIP** (I1). ⚖ user, 2026-09-09:
 * *"I'll want to add proper editors for item_groups and progression_mapping, so
 * that we can support these features in procgen worlds"* and, on deleting a
 * group an item still carries, *"Let's go with refuse."*
 *
 * ⛓ The law these rows encode, measured over the 212 committed documents:
 * `item_groups[p]` is a LIST of names (all 224 slots) and membership lives on
 * `items[p][name].groups`. The two diverge in 155 slots, always in the same
 * direction — items carry a name the registry lacks — so an "unlisted" group is
 * a real state the editor SHOWS rather than one it silently repairs.
 */
describe('item groups — the registry and its membership (I1)', () => {
    /**
     * ⛓ A SECOND SLOT, and slot 3 rather than slot 2, so an op that reached for
     * "the other slot" by index would still be wrong (the placements rows'
     * rule). ⛓ Slot 3's `Lantern` carries `Tools` — the same NAME slot 1 uses —
     * so a per-slot row can tell "this slot's carriers" from "the document's".
     */
    function twoSlotGroups() {
        const doc = fixture();
        doc[ITEM_GROUPS_KEY] = { [P]: ['Tools', 'Trophies'], 3: ['Tools'] };
        doc.items[P].Key.groups = ['Tools'];
        doc.items[P].Victory.groups = ['Event'];        // ⛓ UNLISTED, as 154 slots have
        doc.items['3'] = {
            Lantern: {
                name: 'Lantern', id: 7, groups: ['Tools'], classification: 'progression',
                type: null, max_count: 1,
            },
        };
        return doc;
    }

    const add = (doc, op) => applyRulesDocOp(doc, { op: 'add-item-group', ...op });
    const rename = (doc, op) => applyRulesDocOp(doc, { op: 'rename-item-group', ...op });
    const remove = (doc, op) => applyRulesDocOp(doc, { op: 'delete-item-group', ...op });

    it('⛓ the three derivations read the document, and an UNLISTED group is reported, not added', () => {
        const doc = twoSlotGroups();
        expect(itemGroupRegistry(doc, P)).toEqual(['Tools', 'Trophies']);
        expect(itemsCarryingGroup(doc, 'Tools', P)).toEqual(['Key']);
        expect(itemsCarryingGroup(doc, 'Trophies', P)).toEqual([]);
        // ⛓ `Event` is on an item and NOT in the registry — the corpus's own shape.
        expect(unlistedItemGroups(doc, P)).toEqual(['Event']);
        expect(itemGroupRegistry(doc, P)).not.toContain('Event');
        // ⛓ …and slot 3 answers about slot 3.
        expect(itemsCarryingGroup(doc, 'Tools', '3')).toEqual(['Lantern']);
        expect(unlistedItemGroups(doc, '3')).toEqual([]);
        // ⛓ A document with no block at all answers empty rather than throwing.
        expect(itemGroupRegistry({}, P)).toEqual([]);
        expect(unlistedItemGroups({}, P)).toEqual([]);
    });

    it('⛓ add appends to the registry, CREATING the block when the document has none', () => {
        const doc = twoSlotGroups();
        const res = add(doc, { player: P, name: '  Keys  ' });
        expect(res.ok).toBe(true);
        expect(res.doc[ITEM_GROUPS_KEY][P]).toEqual(['Tools', 'Trophies', 'Keys']);
        // ⛓ The name is TRIMMED and the RECORD carries the trimmed one, so a
        //   re-fold of the edit list reproduces the same document.
        expect(res.op.name).toBe('Keys');
        expect(res.doc[ITEM_GROUPS_KEY]['3']).toBe(doc[ITEM_GROUPS_KEY]['3']);
        expect(res.doc.items).toBe(doc.items);
        const bare = fixture();
        delete bare[ITEM_GROUPS_KEY];
        expect(applied(bare, { op: 'add-item-group', name: 'First' })
            .doc[ITEM_GROUPS_KEY]).toEqual({ [P]: ['First'] });
        expect(bare[ITEM_GROUPS_KEY]).toBeUndefined();
    });

    it('⛓ add refuses an empty name and a duplicate, naming what the registry holds', () => {
        const doc = twoSlotGroups();
        for (const name of [undefined, '', '   ', 7]) {
            const res = add(doc, { player: P, name });
            expect(res.ok, JSON.stringify(name)).toBe(false);
            expect(res.error, JSON.stringify(name)).toContain('non-empty string');
        }
        const dup = add(doc, { player: P, name: 'Tools' });
        expect(dup.ok).toBe(false);
        expect(dup.error).toContain('already');
        expect(dup.error).toContain('Trophies');
        // ⛓⛓ …but an UNLISTED name is not a duplicate: adding it is the
        //    *"add to registry"* gesture the Groups section offers for one.
        const promoted = add(doc, { player: P, name: 'Event' });
        expect(promoted.ok).toBe(true);
        expect(promoted.doc[ITEM_GROUPS_KEY][P]).toEqual(['Tools', 'Trophies', 'Event']);
        expect(unlistedItemGroups(promoted.doc, P)).toEqual([]);
        // ⛔ and it did NOT touch the items it was already on.
        expect(promoted.doc.items).toBe(doc.items);
    });

    it('⛓⛓ rename moves the registry entry IN PLACE and every item\'s membership, as ONE op', () => {
        const doc = twoSlotGroups();
        const res = rename(doc, { player: P, name: 'Tools', newName: ' Gear ' });
        expect(res.ok).toBe(true);
        // ⛓ In place: the list's ORDER is content (`withKey`'s rule, one level up).
        expect(res.doc[ITEM_GROUPS_KEY][P]).toEqual(['Gear', 'Trophies']);
        expect(res.doc.items[P].Key.groups).toEqual(['Gear']);
        expect(res.doc.items[P].Victory.groups).toEqual(['Event']);   // ⛓ untouched
        expect(res.description).toContain('1 item');
        // ⛓ ONE op, so ONE undo puts BOTH sites back — the reason this is not
        //   two ops. Folded through the real adapter, then unfolded.
        const session = createEditSession(rulesEditAdapter, doc);
        session.apply({ op: 'rename-item-group', player: P, name: 'Tools', newName: 'Gear' });
        expect(session.ops().length).toBe(1);
        session.undo();
        expect(session.record()[ITEM_GROUPS_KEY][P]).toEqual(['Tools', 'Trophies']);
        expect(session.record().items[P].Key.groups).toEqual(['Tools']);
    });

    it('⛓ rename refuses an unknown group, an empty new name and a name the registry already holds', () => {
        const doc = twoSlotGroups();
        const unknown = rename(doc, { player: P, name: 'Ghosts', newName: 'Gear' });
        expect(unknown.ok).toBe(false);
        expect(unknown.error).toContain('Ghosts');
        expect(unknown.error).toContain('Trophies');
        // ⛓ An UNLISTED name is not in the registry either — renaming one is
        //   not a gesture the registry can make.
        expect(rename(doc, { player: P, name: 'Event', newName: 'Events' }).ok).toBe(false);
        for (const newName of [undefined, '', '  ']) {
            expect(rename(doc, { player: P, name: 'Tools', newName }).ok,
                JSON.stringify(newName)).toBe(false);
        }
        const taken = rename(doc, { player: P, name: 'Tools', newName: 'Trophies' });
        expect(taken.ok).toBe(false);
        expect(taken.error).toContain('already');
    });

    it('⛓ renaming onto a name an item already carries UNLISTED does not give that item two', () => {
        const doc = twoSlotGroups();
        doc.items[P].Key.groups = ['Tools', 'Event'];
        const res = rename(doc, { player: P, name: 'Tools', newName: 'Event' });
        expect(res.ok).toBe(true);
        expect(res.doc[ITEM_GROUPS_KEY][P]).toEqual(['Event', 'Trophies']);
        expect(res.doc.items[P].Key.groups).toEqual(['Event']);
    });

    /**
     * ⛓⛓⛓ **THE ⚖ RULING, SCORED AGAINST THE LAW RATHER THAN AGAINST THE
     * FIELD UNDER TEST.** The population is every name the slot knows —
     * registry entries AND unlisted ones — not "the names something carries":
     * a row whose population is selected by the predicate under test filters
     * its own mutant out (W0's mutant B, S1's, W3's §10.5 (C) — the same shape
     * three rungs running). So the claim is a BICONDITIONAL: a name with a
     * carrier is refused, a name without one is accepted, and nothing else.
     */
    it('⛓⛓⛓ ⚖ REFUSE: every group an item carries is a delete this op declines, and the reverse', () => {
        const doc = twoSlotGroups();
        const known = [...itemGroupRegistry(doc, P), ...unlistedItemGroups(doc, P)];
        expect(known).toEqual(['Tools', 'Trophies', 'Event']);
        for (const name of known) {
            const carriers = itemsCarryingGroup(doc, name, P);
            const res = remove(doc, { player: P, name });
            if (!itemGroupRegistry(doc, P).includes(name)) {
                // ⛓ An UNLISTED name is not in the registry, so there is
                //   nothing there to delete — refused for THAT reason, and the
                //   carriers are beside the point (`Event` has one).
                expect(res.ok, name).toBe(false);
                expect(res.error, name).toContain('no item group');
                expect(res.error, name).not.toContain('still carr');
            } else if (carriers.length) {
                expect(res.ok, `${name} is carried by ${carriers}`).toBe(false);
                expect(res.error, name).toContain('still carr');
                for (const item of carriers) expect(res.error, name).toContain(item);
            } else {
                expect(res.ok, `${name} is carried by nothing`).toBe(true);
                expect(res.doc[ITEM_GROUPS_KEY][P], name).not.toContain(name);
            }
        }
        // ⛓ …and the three branches were all REACHED, so a fixture that lost
        //   one of the cases cannot make this row vacuous.
        expect(known.map((n) => [
            itemGroupRegistry(doc, P).includes(n), itemsCarryingGroup(doc, n, P).length > 0,
        ])).toEqual([[true, true], [true, false], [false, true]]);
    });

    it('⛓ the refusal LISTS the carriers, and it is bounded by REFUSAL_NAME_LIMIT', () => {
        const doc = twoSlotGroups();
        const many = REFUSAL_NAME_LIMIT + 3;
        for (let i = 0; i < many; i += 1) {
            doc.items[P][`Thing ${i}`] = { name: `Thing ${i}`, id: 100 + i, groups: ['Trophies'] };
        }
        const res = remove(doc, { player: P, name: 'Trophies' });
        expect(res.ok).toBe(false);
        expect(res.error).toContain(String(many));
        expect(res.error).toContain('Thing 0');
        expect(res.error).toContain(`and ${many - REFUSAL_NAME_LIMIT} more`);
        // ⛔ The op does NOT offer to strip the group from them — ⚖ "refuse".
        expect(res.error).toContain('will not take it off them for you');
    });

    it('⛓ deleting a group nothing carries keeps the rest of the registry, in order', () => {
        const doc = twoSlotGroups();
        const res = remove(doc, { player: P, name: 'Trophies' });
        expect(res.ok).toBe(true);
        expect(res.doc[ITEM_GROUPS_KEY][P]).toEqual(['Tools']);
        expect(res.doc.items).toBe(doc.items);
        expect(remove(doc, { player: P, name: 'Ghosts' }).error).toContain('no item group');
    });

    it('⛓ every one of the three is PER-SLOT: slot 3 is untouched, and answers for itself', () => {
        const doc = twoSlotGroups();
        const before = JSON.stringify(doc[ITEM_GROUPS_KEY]['3']);
        const beforeItems = JSON.stringify(doc.items['3']);
        const added = applied(doc, { op: 'add-item-group', player: '3', name: 'Lamps' }).doc;
        expect(added[ITEM_GROUPS_KEY]['3']).toEqual(['Tools', 'Lamps']);
        expect(added[ITEM_GROUPS_KEY][P]).toEqual(['Tools', 'Trophies']);
        const renamed = applied(doc, { op: 'rename-item-group', player: '3', name: 'Tools', newName: 'Gear' }).doc;
        expect(renamed[ITEM_GROUPS_KEY]['3']).toEqual(['Gear']);
        expect(renamed[ITEM_GROUPS_KEY][P]).toEqual(['Tools', 'Trophies']);
        expect(renamed.items[P].Key.groups).toEqual(['Tools']);        // ⛓ slot 1's item unmoved
        expect(renamed.items['3'].Lantern.groups).toEqual(['Gear']);
        // ⛓ Slot 1's `Tools` is carried by `Key`, slot 3's by `Lantern` — so
        //   the SAME name deletes differently in the two slots.
        expect(remove(doc, { player: '3', name: 'Tools' }).error).toContain('Lantern');
        expect(remove(doc, { player: P, name: 'Tools' }).error).toContain('Key');
        expect(JSON.stringify(doc[ITEM_GROUPS_KEY]['3'])).toBe(before);
        expect(JSON.stringify(doc.items['3'])).toBe(beforeItems);
    });
});

describe('meta, the start region, the victory condition and rule trees', () => {
    it('set-meta writes each table entry at its PATH, and an absent value deletes', () => {
        const doc = fixture();
        for (const key of Object.keys(META_FIELDS)) {
            const out = applied(doc, { op: 'set-meta', key, value: 'X' }).doc;
            const path = META_FIELDS[key].path(P);
            let node = out;
            for (const step of path) node = node[step];
            expect(node, key).toBe('X');
        }
        const gone = applied(doc, { op: 'set-meta', key: 'schema_version' }).doc;
        expect('schema_version' in gone).toBe(false);
    });

    it('set-meta refuses a key the TABLE does not hold', () => {
        const bad = apply(fixture(), { op: 'set-meta', key: 'game_nam', value: 'x' });
        expect(bad.ok).toBe(false);
        expect(bad.error).toContain('META_FIELDS');
    });

    it('set-start-region writes a one-entry list and clears with an empty name', () => {
        const doc = fixture();
        expect(applied(doc, { op: 'set-start-region', region: 'Vault' }).doc.start_regions[P].default)
            .toEqual(['Vault']);
        expect(applied(doc, { op: 'set-start-region', region: '' }).doc.start_regions[P].default)
            .toEqual([]);
        // ⛓ `available` is untouched — the row edits `default` alone.
        expect(applied(doc, { op: 'set-start-region', region: 'Vault' }).doc.start_regions[P].available)
            .toEqual([]);
    });

    it('set-completion-condition carries the PARSED tree and refuses a non-object', () => {
        const doc = fixture();
        const out = applied(doc, {
            op: 'set-completion-condition', condition: { type: 'constant', value: true },
        }).doc;
        expect(out.game_info[P].completion_condition).toEqual({ type: 'constant', value: true });
        expect(apply(doc, { op: 'set-completion-condition', condition: '{"type":"x"}' }).ok).toBe(false);
    });

    it('set-rule-tree writes both kinds and refuses a third, a bad index and a non-node', () => {
        const doc = fixture();
        const onExit = applied(doc, {
            op: 'set-rule-tree', path: { region: 'Hall', kind: 'exit', index: 0 }, tree: { rule: 'True_' },
        }).doc;
        expect(onExit.regions[P].Hall.exits[0].access_rule).toEqual({ rule: 'True_' });
        const onLoc = applied(doc, {
            op: 'set-rule-tree', path: { region: 'Hall', kind: 'location', index: 0 }, tree: { rule: 'False_' },
        }).doc;
        expect(onLoc.regions[P].Hall.locations[0].access_rule).toEqual({ rule: 'False_' });
        expect(apply(doc, { op: 'set-rule-tree', path: { region: 'Hall', kind: 'item', index: 0 }, tree: { rule: 'True_' } }).ok).toBe(false);
        expect(apply(doc, { op: 'set-rule-tree', path: { region: 'Hall', kind: 'exit', index: 4 }, tree: { rule: 'True_' } }).ok).toBe(false);
        expect(apply(doc, { op: 'set-rule-tree', path: { region: 'Hall', kind: 'exit', index: 0 }, tree: { args: {} } }).ok).toBe(false);
    });

    /**
     * ⛓⛓⛓ **`set-rule-tree` CARRIES THE RESULT, NEVER THE GESTURE** — the
     * mutant's row. A re-fold of the same op is byte-identical BECAUSE the op
     * IS the tree; a recorded gesture would be re-run against whatever the tree
     * had become.
     */
    it('⛓⛓ a re-fold of the same set-rule-tree is byte-identical', () => {
        const doc = fixture();
        const op = {
            op: 'set-rule-tree', path: { region: 'Hall', kind: 'exit', index: 0 },
            tree: { rule: 'Has', args: { item_name: 'Key', count: 1 } },
        };
        const once = foldEdits(rulesEditAdapter, doc, [op]).record;
        const twice = foldEdits(rulesEditAdapter, doc, [op, op]).record;
        expect(bytes(twice)).toBe(bytes(once));
    });
});

/**
 * ⛓⛓⛓ **THE PAYLOAD IS COPIED IN, NEVER ALIASED** — the defect the FIRST
 * browser run found, turned into rows.
 *
 * ⛔ Three ops carry arbitrary JSON a caller built. Storing the reference makes
 * the record and the caller's object one object; the APWorld panel's rule
 * editor is a caller that goes on editing its own copy in place, so the next
 * keystroke wrote THROUGH the record, `equal` then compared a document with
 * itself, and the session reported a NO-OP for an edit that had already
 * happened invisibly — with nothing for undo to remove.
 */
describe('a carried payload is COPIED into the record', () => {
    const aliasRow = (op, read) => {
        const doc = fixture();
        const out = applied(doc, op).doc;
        const before = bytes(out);
        // The caller goes on editing the object it handed in — which is exactly
        // what the panel's detached rule-tree holder does.
        const payload = op.tree ?? op.condition ?? op.value;
        payload.__mutatedAfterApply = true;
        expect(bytes(out), 'the record moved when the caller touched its own payload').toBe(before);
        expect(read(out).__mutatedAfterApply).toBeUndefined();
    };

    it('⛓⛓ set-rule-tree', () => {
        aliasRow(
            {
                op: 'set-rule-tree', path: { region: 'Hall', kind: 'location', index: 0 },
                tree: { rule: 'Has', args: { item_name: 'Key' } },
            },
            (d) => d.regions[P].Hall.locations[0].access_rule,
        );
    });

    it('⛓ set-completion-condition', () => {
        aliasRow(
            { op: 'set-completion-condition', condition: { type: 'constant', value: true } },
            (d) => d.game_info[P].completion_condition,
        );
    });

    it('⛓ set-item-field with an object/array value', () => {
        aliasRow(
            { op: 'set-item-field', item: 'Key', field: 'groups', value: ['a', 'b'] },
            (d) => d.items[P].Key.groups,
        );
    });

    /**
     * ⛓⛓ **H1's `set-key` CARRIES ARBITRARY JSON, so it is in this family.** The
     * Document tab hands it a parsed block a person may go on editing; storing
     * the reference would put the caller's object in the record AND in the edit
     * list, which is the defect the first browser run of B-c measured on
     * `set-rule-tree`.
     */
    it('⛓⛓ set-key with a whole block', () => {
        aliasRow(
            { op: 'set-key', key: 'procgen_metadata', value: { driver: 'sphere', edits: [] } },
            (d) => d.procgen_metadata,
        );
    });

    /**
     * ⛓⛓⛓ **THE SESSION-SHAPED ROW** — the defect as the panel met it: apply,
     * then edit the handed-in object in place (a keystroke in the rule editor),
     * then apply again. The second apply must be a REAL edit, not the no-op an
     * aliased record reports.
     */
    it('⛓⛓⛓ an aliased record would report the SECOND edit as a no-op — it does not', () => {
        const doc = fixture();
        const s = createEditSession(rulesEditAdapter, doc, { base: { kind: 'rules' } });
        const holder = { rule: 'Has', args: { item_name: '' } };
        const path = { region: 'Hall', kind: 'location', index: 0 };
        expect(s.apply({ op: 'set-rule-tree', path, tree: holder }).applied).toBe(true);
        holder.args.item_name = 'Key';                       // the in-place field editor
        const second = s.apply({ op: 'set-rule-tree', path, tree: holder });
        expect(second.applied).toBe(true);
        expect(s.ops()).toHaveLength(2);
        expect(s.record().regions[P].Hall.locations[0].access_rule.args.item_name).toBe('Key');
        s.undo();
        expect(s.record().regions[P].Hall.locations[0].access_rule.args.item_name).toBe('');
    });

    /**
     * ⛓⛓ **AND THE EDIT LIST HOLDS THE COPY, NOT THE CALLER'S OBJECT.** Cloning
     * only on the way into the record left the op in `session.ops()` aliasing
     * the payload, so a re-fold reconstructed the LATER value — the undo above
     * came back holding `Key`.
     */
    it('⛓⛓ the recorded op is a private COPY — a re-fold cannot see a later mutation', () => {
        const doc = fixture();
        const tree = { rule: 'Has', args: { item_name: 'Key' } };
        const op = { op: 'set-rule-tree', path: { region: 'Hall', kind: 'location', index: 0 }, tree };
        const res = applied(doc, op);
        expect(res.op).not.toBe(op);
        expect(res.op.tree).not.toBe(tree);
        tree.args.item_name = 'MUTATED';
        expect(bytes(foldEdits(rulesEditAdapter, doc, [res.op]).record)).not.toContain('MUTATED');
    });

    /**
     * ⛓ THE RESOLVED OP SPENDS ITS DRAWN NAME (`editCore`'s contract for the op
     * `apply` returns), so a reader of `payload().edits` sees what was created.
     */
    it('⛓ an `add-…` op comes back with the derived name spent', () => {
        const doc = fixture();
        expect(applied(doc, { op: 'add-region' }).op).toMatchObject({ op: 'add-region', name: 'New Region' });
        expect(applied(doc, { op: 'add-item' }).op).toMatchObject({ op: 'add-item', name: 'New Item' });
        expect(applied(doc, { op: 'add-exit', region: 'Vault' }).op)
            .toMatchObject({ op: 'add-exit', region: 'Vault', name: 'Vault → ?' });
        expect(applied(doc, { op: 'add-location', region: 'Vault' }).op)
            .toMatchObject({ op: 'add-location', region: 'Vault', name: 'New Location' });
    });
});

describe('replace-region-sidecar — the room editor\'s one op back (H4b)', () => {
    const P2 = { width: 4, height: 4, tiles: 'bbbb' };

    it('writes the payload AND the rules, in one op, and NAMES the region', () => {
        const doc = fixture();
        const rules = hallRules(doc, { rule: 'Has', args: { item_name: 'Key' } });
        const res = applied(doc, { op: 'replace-region-sidecar', region: 'Hall', payload: P2, rules });
        expect(res.doc.preset_sidecars[P].Hall.playable_payload).toEqual(P2);
        for (const e of res.doc.regions[P].Hall.exits) {
            expect(e.access_rule).toEqual({ rule: 'Has', args: { item_name: 'Key' } });
        }
        for (const l of res.doc.regions[P].Hall.locations) {
            expect(l.access_rule).toEqual({ rule: 'Has', args: { item_name: 'Key' } });
        }
        expect(res.description).toContain('Hall');
        // ⛓ Everything ELSE the sidecar entry carries survives — the op replaces
        //   the PAYLOAD, not the entry.
        expect(res.doc.preset_sidecars[P].Hall.grid_cell).toEqual({ gx: 0, gy: 0 });
        expect(res.doc.preset_sidecars[P].Hall.substrate).toBe('maze');
        // ⛓ …and so do the region's own name, its exits' targets and its AP ids.
        expect(res.doc.regions[P].Hall.name).toBe('Hall');
        expect(res.doc.regions[P].Hall.exits[0].connected_region).toBe('Vault');
        expect(res.doc.regions[P].Hall.locations[0].id).toBe(1);
    });

    it('⛓⛓ AN UNCHANGED ROUND TRIP IS A NO-OP BY `equal` — editCore law (b)', () => {
        const doc = fixture();
        const same = doc.preset_sidecars[P].Hall.playable_payload;
        const rules = {
            exits: Object.fromEntries(doc.regions[P].Hall.exits.map((e) => [e.name, e.access_rule])),
            locations: Object.fromEntries(
                doc.regions[P].Hall.locations.map((l) => [l.name, l.access_rule]),
            ),
        };
        const session = createEditSession(rulesEditAdapter, doc);
        const res = session.apply({
            op: 'replace-region-sidecar', region: 'Hall', payload: same, rules, player: P,
        });
        expect(res.ok).toBe(true);
        expect(res.applied, 'an open-and-save-unchanged moved the document').toBe(false);
        expect(session.ops()).toHaveLength(0);
    });

    it('⛔ REFUSES a location the new geometry lost, and says what is ON it', () => {
        const doc = fixture();
        const rules = hallRules(doc);
        delete rules.locations['Hall Chest'];
        const res = apply(doc, { op: 'replace-region-sidecar', region: 'Hall', payload: P2, rules });
        expect(res.ok).toBe(false);
        expect(res.error).toContain('Hall Chest');
        expect(res.error).toContain('no longer has');
    });

    it('⛔ REFUSES an exit the new geometry lost, naming where it went', () => {
        const doc = fixture();
        const rules = hallRules(doc);
        delete rules.exits['Hall → Vault'];
        const res = apply(doc, { op: 'replace-region-sidecar', region: 'Hall', payload: P2, rules });
        expect(res.ok).toBe(false);
        expect(res.error).toContain('Hall → Vault');
        expect(res.error).toContain('Vault');
    });

    it('⛔ REFUSES a rule for a name the region does not hold', () => {
        const doc = fixture();
        const rules = hallRules(doc);
        rules.locations['Hall Chest 2'] = { rule: 'True_' };
        const res = apply(doc, { op: 'replace-region-sidecar', region: 'Hall', payload: P2, rules });
        expect(res.ok).toBe(false);
        expect(res.error).toContain('Hall Chest 2');
        expect(res.error).toContain('does not have');
    });

    it('⛔ REFUSES a region with no sidecar, and lists the ones this slot has', () => {
        const doc = fixture();
        const res = apply(doc, {
            op: 'replace-region-sidecar', region: 'Vault', payload: P2,
            rules: { exits: {}, locations: { 'Vault Chest': { rule: 'True_' } } },
        });
        expect(res.ok).toBe(false);
        expect(res.error).toContain('no sidecar for region "Vault"');
        expect(res.error).toContain('Hall');
    });

    it('⛔ REFUSES a missing region name, a non-object payload and a malformed rules map', () => {
        const doc = fixture();
        const base = { op: 'replace-region-sidecar', region: 'Hall', payload: P2 };
        expect(apply(doc, { ...base, region: '' }).error).toMatch(/needs a region NAME/);
        expect(apply(doc, { ...base, payload: [1, 2] }).error).toMatch(/a room payload is an object/);
        expect(apply(doc, { ...base, rules: { exits: {} } }).error).toMatch(/<exit name>/);
        expect(apply(doc, { ...base, rules: hallRules(doc) }).ok).toBe(true);
    });

    it('⛓⛓ THE PAYLOAD IS COPIED AT THE DOOR — the caller may keep editing it', () => {
        const doc = fixture();
        const payload = { width: 4, height: 4, tiles: 'bbbb' };
        const out = applied(doc, {
            op: 'replace-region-sidecar', region: 'Hall', payload, rules: hallRules(doc),
        }).doc;
        const before = bytes(out);
        payload.__mutatedAfterApply = true;
        payload.tiles = 'cccc';
        expect(bytes(out), 'the record moved when the caller touched its own payload').toBe(before);
        expect(out.preset_sidecars[P].Hall.playable_payload.__mutatedAfterApply).toBeUndefined();
    });

    it('⛓ ONE UNDO folds the whole sub-edit away — payload AND rules', () => {
        const doc = fixture();
        const session = createEditSession(rulesEditAdapter, doc);
        const before = bytes(session.record());
        session.apply({
            op: 'replace-region-sidecar', region: 'Hall', payload: P2, player: P,
            rules: hallRules(doc, { rule: 'Has', args: { item_name: 'Key' } }),
        });
        expect(bytes(session.record())).not.toBe(before);
        expect(session.ops()).toHaveLength(1);
        expect(session.undo()).toBe(true);
        expect(bytes(session.record()), 'undo left the payload or the rules behind').toBe(before);
    });

    it('⛓ THE SLOT IS THE OP\'S OWN FIELD, never inferred (H1\'s rule)', () => {
        const doc = fixture();
        doc.preset_sidecars['2'] = {
            Hall: { substrate: 'maze', playable_payload: { width: 1, height: 1, tiles: 'a' } },
        };
        doc.regions['2'] = { Hall: makeRegion('Hall', [], [makeLocation('Slot 2 Chest', 9)]) };
        const res = applied(doc, {
            op: 'replace-region-sidecar', region: 'Hall', payload: P2, player: '2',
            rules: { exits: {}, locations: { 'Slot 2 Chest': { rule: 'True_' } } },
        });
        expect(res.doc.preset_sidecars['2'].Hall.playable_payload).toEqual(P2);
        // ⛔ slot 1's Hall — same NAME, different slot — is untouched.
        expect(res.doc.preset_sidecars[P].Hall.playable_payload.tiles).toBe('aaa');
        expect(res.doc.regions[P].Hall.locations[0].access_rule)
            .toEqual(doc.regions[P].Hall.locations[0].access_rule);
    });
});

describe('set-region-sidecar — the raw entry save (PRESET SIDECARS S1)', () => {
    /**
     * ⛓ An entry that differs from the fixture's `Hall` in EVERY field it has,
     * DROPS one (`render_hint`) and ADDS one (`biome`), so "the whole entry was
     * written" and "the payload alone was written" / "the entry was merged" are
     * different documents.
     */
    const edited = () => ({
        substrate: 'text_adventure',
        grid_cell: { gx: 3, gy: 1 },
        biome: { id: 'cave' },
        playable_payload: { width: 5, height: 2, tiles: 'ccccc', exits: [{ side: 'N' }] },
    });

    /** ⛓ The document the op must produce — built by hand, and the WHOLE of it is compared. */
    const expectedAfter = (doc, slot, region, entry) => {
        const want = JSON.parse(bytes(doc));
        want.preset_sidecars[slot][region] = JSON.parse(JSON.stringify(entry));
        return bytes(want);
    };

    it('⛓⛓ writes EXACTLY the entry — the whole document AFTER, byte for byte (trap 1306)', () => {
        const doc = fixture();
        const regionBefore = bytes(doc.regions[P].Hall);
        const res = applied(doc, { op: 'set-region-sidecar', region: 'Hall', entry: edited() });
        expect(bytes(res.doc), 'the op wrote something other than the entry, or not all of it')
            .toBe(expectedAfter(doc, P, 'Hall', edited()));
        // ⛓ said separately because it is the ⚖: the region's rules are not touched.
        expect(bytes(res.doc.regions[P].Hall), 'the raw save moved the region').toBe(regionBefore);
        expect(res.doc.preset_sidecars[P].Hall.render_hint, 'the entry was MERGED, not replaced')
            .toBeUndefined();
    });

    it('⛓ the entry keeps its POSITION in the slot (a replace, not a delete-and-append)', () => {
        const doc = fixture();
        doc.preset_sidecars[P].Vault = { substrate: 'maze', playable_payload: {} };
        const res = applied(doc, { op: 'set-region-sidecar', region: 'Hall', entry: edited() });
        expect(Object.keys(res.doc.preset_sidecars[P])).toEqual(['Hall', 'Vault']);
    });

    it('⛓ THE SLOT IS THE OP\'S OWN FIELD — other slots\' sidecars are untouched', () => {
        const doc = fixture();
        doc.preset_sidecars['2'] = {
            Hall: { substrate: 'bounce', playable_payload: { gameId: 'bounce' } },
        };
        const slot1 = bytes(doc.preset_sidecars[P]);
        const res = applied(doc, { op: 'set-region-sidecar', region: 'Hall', entry: edited(), player: '2' });
        expect(bytes(res.doc)).toBe(expectedAfter(doc, '2', 'Hall', edited()));
        expect(bytes(res.doc.preset_sidecars[P]), 'slot 1\'s Hall — same NAME — moved').toBe(slot1);
    });

    it('⛓⛓ the description is a SENTENCE naming the region, the payload size and what was NOT re-derived', () => {
        const doc = fixture();
        const entry = edited();
        const n = Object.keys(entry.playable_payload).length;
        const res = applied(doc, { op: 'set-region-sidecar', region: 'Hall', entry });
        expect(res.description).toBe(
            `region Hall: sidecar entry replaced (${n} payload keys) — ${SIDECAR_NOT_REDERIVED}`);
        for (const w of ['access rules', 'location names', 'derived payload fields']) {
            expect(SIDECAR_NOT_REDERIVED).toContain(w);
        }
        // ⛔ never a dump of the entry: a 60 KB payload gets its key count.
        expect(res.description).not.toContain('ccccc');
        const bare = applied(doc, { op: 'set-region-sidecar', region: 'Hall', entry: { substrate: 'maze' } });
        expect(bare.description).toContain('(no payload)');
        expect(bare.doc.preset_sidecars[P].Hall).toEqual({ substrate: 'maze' });
    });

    it('⛔ REFUSES a region with no sidecar entry — it REPLACES, it never CREATES', () => {
        const doc = fixture();
        for (const region of ['Vault', 'Nowhere']) {
            const res = apply(doc, { op: 'set-region-sidecar', region, entry: edited() });
            expect(res.ok).toBe(false);
            expect(res.error).toContain(`no sidecar entry for region "${region}"`);
            expect(res.error).toContain('never CREATES');
            expect(res.error, 'the refusal lists the entries this slot HAS').toContain('[Hall]');
        }
        // ⛔ …and in a slot that has none at all.
        expect(apply(doc, { op: 'set-region-sidecar', region: 'Hall', entry: edited(), player: '7' })
            .error).toContain('[none]');
    });

    it('⛔ REFUSES each malformed input BY NAME', () => {
        const doc = fixture();
        const base = { op: 'set-region-sidecar', region: 'Hall' };
        expect(apply(doc, { ...base, region: '', entry: edited() }).error).toMatch(/needs a region NAME/);
        expect(apply(doc, { ...base, region: '  ', entry: edited() }).error).toMatch(/needs a region NAME/);
        for (const entry of [undefined, null, [edited()], 'maze', 7]) {
            expect(apply(doc, { ...base, entry }).error, JSON.stringify(entry))
                .toMatch(/a sidecar entry is an object/);
        }
        const { substrate: _s, ...noSubstrate } = edited();
        expect(apply(doc, { ...base, entry: noSubstrate }).error).toMatch(/needs `substrate` as a string/);
        expect(apply(doc, { ...base, entry: { ...edited(), substrate: 3 } }).error)
            .toMatch(/needs `substrate` as a string/);
        for (const payload of [null, [1, 2], 'tiles', 0]) {
            expect(apply(doc, { ...base, entry: { ...edited(), playable_payload: payload } }).error,
                JSON.stringify(payload)).toMatch(/`playable_payload` is the substrate's own serialized world/);
        }
    });

    it('⛓ the payload\'s INSIDE is not read — the reader owns the repair (⚖ round two, Q2)', () => {
        const doc = fixture();
        const nonsense = { substrate: 'maze', playable_payload: { width: 'wide', tiles: 42, bogus: [null] } };
        const res = applied(doc, { op: 'set-region-sidecar', region: 'Hall', entry: nonsense });
        expect(res.doc.preset_sidecars[P].Hall).toEqual(nonsense);
    });

    it('⛓⛓ THE ENTRY IS COPIED AT THE DOOR — the caller may keep editing what it parsed', () => {
        const doc = fixture();
        const entry = edited();
        const res = applied(doc, { op: 'set-region-sidecar', region: 'Hall', entry });
        const before = bytes(res.doc);
        const recorded = bytes(res.op);
        entry.substrate = 'MUTATED';
        entry.playable_payload.tiles = 'MUTATED';
        entry.__mutatedAfterApply = true;
        expect(bytes(res.doc), 'the record moved when the caller touched its own entry').toBe(before);
        expect(bytes(res.op), 'the recorded op aliases the caller\'s entry').toBe(recorded);
        expect(bytes(foldEdits(rulesEditAdapter, doc, [res.op]).record)).not.toContain('MUTATED');
    });

    it('⛓ ONE UNDO restores the entry; the entry it already holds is a NO-OP by `equal`', () => {
        const doc = fixture();
        const session = createEditSession(rulesEditAdapter, doc);
        const before = bytes(session.record());
        const same = session.apply({
            op: 'set-region-sidecar', region: 'Hall', player: P, entry: doc.preset_sidecars[P].Hall,
        });
        expect(same.ok).toBe(true);
        expect(same.applied, 'writing the entry back unchanged moved the document').toBe(false);
        expect(session.apply({ op: 'set-region-sidecar', region: 'Hall', player: P, entry: edited() })
            .applied).toBe(true);
        expect(session.ops()).toHaveLength(1);
        expect(session.undo()).toBe(true);
        expect(bytes(session.record())).toBe(before);
    });
});


describe('replace-document — the raw view\'s one op (H2)', () => {
    it('⛓ replaces the WHOLE record and says how many keys arrived', () => {
        const doc = fixture();
        const next = { game_name: 'Replaced', schema_version: 3 };
        const res = applied(doc, { op: 'replace-document', document: next });
        expect(res.doc).toEqual(next);
        expect(res.description).toBe('document replaced (2 top-level keys)');
        // ⛔ and the input is untouched, like every other op.
        expect(doc.game_name).toBe('Fixture');
    });

    it('⛓ singular/plural in the description, so a one-key document reads right', () => {
        expect(applied(fixture(), { op: 'replace-document', document: { a: 1 } }).description)
            .toBe('document replaced (1 top-level key)');
    });

    /**
     * ⛓⛓⛓ **THE ALIASING ROW — the discriminator for mutant (a).** The op
     * carries a whole document a CALLER built, and the raw view is a caller
     * that keeps its parsed object around. If `applyRulesDocOp` stored the
     * caller's reference instead of `carried(op)`'s copy, the record and the
     * caller's object would be the same object: the next thing the caller
     * touched would write THROUGH the record, and the fold would reconstruct a
     * document nobody typed.
     */
    it('⛔ COPIES the document at the door — the record and the caller share nothing', () => {
        const doc = fixture();
        const mine = { game_name: 'Mine', regions: { 1: { Hall: { name: 'Hall' } } } };
        const res = applied(doc, { op: 'replace-document', document: mine });

        // The caller keeps editing its own object, as the raw view does.
        mine.game_name = 'Mutated after the op';
        mine.regions[1].Hall.name = 'Mutated too';

        expect(res.doc.game_name).toBe('Mine');
        expect(res.doc.regions['1'].Hall.name).toBe('Hall');
        // ⛓ and the RECORDED op is a copy as well — the edit list is the identity.
        expect(res.op.document.game_name).toBe('Mine');
        expect(res.op.document).not.toBe(mine);
    });

    it('⛔ refuses anything that is not a JSON object, BY SHAPE', () => {
        for (const bad of [null, undefined, 42, 'a string', true]) {
            const res = apply(fixture(), { op: 'replace-document', document: bad });
            expect(res.ok, JSON.stringify(bad)).toBe(false);
            expect(res.error).toContain('needs a rules document');
        }
        // ⛔ An array passes `typeof === 'object'`; it is refused by name.
        const arr = apply(fixture(), { op: 'replace-document', document: [] });
        expect(arr.ok).toBe(false);
        expect(arr.error).toContain('an array');
    });

    /**
     * ⛓ The op is in the vocabulary the unknown-op refusal quotes, so a
     * mistyped `replace-doc` names the real one.
     */
    it('⛓ is part of the vocabulary an unknown op is refused against', () => {
        expect(RULES_OP_KINDS).toContain('replace-document');
        expect(apply(fixture(), { op: 'replace-doc' }).error).toContain('replace-document');
    });
});

describe('set-key — one top-level key of the document (H1)', () => {
    it('⛓ writes a DOCUMENT-scope key and keeps every other key in place', () => {
        const doc = fixture();
        const res = applied(doc, { op: 'set-key', key: 'preset_label', value: 'canth s4' });
        expect(res.doc.preset_label).toBe('canth s4');
        expect(res.description).toBe('preset_label = "canth s4"');
        // ⛔ key ORDER is content for this document (the adapter's `equal` reads
        //    it), so a new key APPENDS and an existing one keeps its position.
        expect(Object.keys(res.doc).slice(0, -1)).toEqual(Object.keys(doc));
        expect(Object.keys(res.doc).at(-1)).toBe('preset_label');
    });

    it('⛓ `scope: \'player\'` writes the SLOT\'s slice and leaves the other slots alone', () => {
        const doc = fixture();
        doc.regions['2'] = { Lobby: makeRegion('Lobby', [], []) };
        const res = applied(doc, {
            op: 'set-key', key: 'regions', scope: 'player', player: '2',
            value: { Foyer: makeRegion('Foyer', [], []) },
        });
        expect(Object.keys(res.doc.regions['2'])).toEqual(['Foyer']);
        expect(Object.keys(res.doc.regions[P])).toEqual(['Hall', 'Vault']);
        expect(res.description).toBe('regions[2] = {1 key}');
    });

    /**
     * ⛔⛔ **THE SCOPE IS RECORDED, NEVER INFERRED FROM `player`.** Every op in
     * this module carries `player` and the panel stamps it on all of them, so a
     * `set-key` that nested whenever a player was named would put a
     * document-level key under a slot the moment the Document tab grew its
     * selector — which is the tab this op exists for.
     */
    it('⛓⛓ a `player` alone does NOT nest — the default scope is the document', () => {
        const res = applied(fixture(), {
            op: 'set-key', key: 'preset_label', value: 'x', player: '3',
        });
        expect(res.doc.preset_label).toBe('x');
        expect(res.doc.preset_label).not.toEqual({ 3: 'x' });
    });

    it('⛓ an absent `value` DELETES the key, as set-meta does', () => {
        const doc = fixture();
        doc.preset_label = 'gone';
        const res = applied(doc, { op: 'set-key', key: 'preset_label' });
        expect('preset_label' in res.doc).toBe(false);
        expect(res.description).toBe('preset_label deleted');
    });

    it('⛓ refuses a blank key and an unknown scope, naming the vocabulary', () => {
        expect(apply(fixture(), { op: 'set-key', key: '', value: 1 }).error)
            .toContain('set-key needs a top-level key NAME');
        const bad = apply(fixture(), { op: 'set-key', key: 'x', scope: 'slot' });
        expect(bad.ok).toBe(false);
        for (const name of Object.keys(SET_KEY_SCOPES)) expect(bad.error).toContain(name);
    });

    it('⛓ the description SIZES a container rather than dumping it', () => {
        const big = Object.fromEntries([...Array(400).keys()].map((i) => [`k${i}`, i]));
        expect(applied(fixture(), { op: 'set-key', key: 'procgen_metadata', value: big }).description)
            .toBe('procgen_metadata = {400 keys}');
        expect(applied(fixture(), { op: 'set-key', key: 'sphere_log', value: [1, 2, 3] }).description)
            .toBe('sphere_log = [3 items]');
    });

    /** ⛓ It folds and undoes like every other op — the session-shaped row. */
    it('⛓⛓ one set-key is ONE undo, and the fold reproduces the document', () => {
        const doc = fixture();
        const s = createEditSession(rulesEditAdapter, doc, { base: { kind: 'rules' } });
        expect(s.apply({ op: 'set-key', key: 'preset_label', value: 'a' }).applied).toBe(true);
        expect(s.apply({ op: 'set-key', key: 'preset_label', value: 'b' }).applied).toBe(true);
        expect(bytes(s.record())).toBe(bytes(foldEdits(rulesEditAdapter, doc, s.ops()).record));
        s.undo();
        expect(s.record().preset_label).toBe('a');
        s.undo();
        expect('preset_label' in s.record()).toBe(false);
    });
});

/**
 * ⛓⛓⛓ **CANONICAL PLACEMENTS — the `--canonical-seed` INPUT** (W3).
 *
 * `canonical_placements[player]` is a flat `location → item` map that
 * `world_generator/extractors.py` reads as the placement source, so this op
 * writes what the NEXT `Generate.py` places. The schema cannot check it
 * (`additionalProperties: true` on the slot), which is why the op refuses by
 * NAME against the document's own regions and items.
 */
/**
 * ⛓⛓⛓ **PROGRESSION MAPPINGS (I2)** — `set-progression-mapping`, one op per
 * entry, and the two kinds the corpus actually holds.
 *
 * ⛓ Every expectation here is scored against the LAW the runtime enforces
 * (`inventoryManager` for the additive kind, `gameLogic/generic/genericLogic`
 * for the progressive one) rather than against the op's own tables: a row that
 * asked the validator what the validator thinks would agree with any mutant of
 * it.
 */
describe('progression mappings — the two kinds and their one op (I2)', () => {
    /**
     * ⛓ A slot with BOTH kinds and a second slot (slot 3 again, so an op
     * reaching for "the other slot" by index is still wrong), plus a member
     * naming an item the slot does NOT hold — the smz3 shape, which is the one
     * state 12 committed members are in and the reason the refusal differences.
     */
    function twoKinds() {
        const doc = fixture();
        doc.items[P].Blade = {
            name: 'Blade', id: 3, groups: [], classification: 'progression', type: null,
        };
        doc.items[P].Shard = {
            name: 'Shard', id: 4, groups: [], classification: 'filler', type: null,
        };
        doc[PROGRESSION_MAPPING_KEY] = {
            [P]: {
                'Progressive Blade': {
                    base_item: 'Progressive Blade',
                    items: [{ name: 'Blade', level: 1 }, { name: 'Retired Blade', level: 2 }],
                },
                Shards: { type: 'additive', base_item: 'Shards', items: { Shard: 5 } },
            },
            3: { 'Progressive Blade': { base_item: 'Progressive Blade', items: [{ name: 'Torch', level: 1 }] } },
        };
        doc.items['3'] = {
            Torch: { name: 'Torch', id: 9, groups: [], classification: 'progression', type: null },
        };
        return doc;
    }

    const HERE = dirname(fileURLToPath(import.meta.url));
    const set = (doc, op) => applyRulesDocOp(doc, { op: 'set-progression-mapping', ...op });
    const progressive = (base, items) => ({ base_item: base, items });
    const additive = (base, items) => ({ type: 'additive', base_item: base, items });

    /**
     * ⛓⛓ **THE KIND IS THE `type` TAG, ASKED THE WAY THE INVENTORY ASKS IT.**
     * ⛔ Scored against `inventoryManager`'s own source rather than against
     * `progressionKindOf`: the additive branch is selected by the literal
     * string `'additive'` in a `===`, and a kind function that agreed with
     * itself would pass under a mutant that changed the tag.
     */
    it('⛓⛓ the additive kind is the tag the inventory branches on, and nothing else is', () => {
        const runtime = readFileSync(
            join(HERE, '..', 'stateManager', 'core', 'inventoryManager.js'), 'utf8');
        expect(runtime).toContain(`mapping.type === '${ADDITIVE_TYPE}'`);
        expect(progressionKindOf({ type: ADDITIVE_TYPE })).toBe(PROGRESSION_KINDS.ADDITIVE);
        for (const notAdditive of [undefined, null, {}, { type: 'progressive' }, { type: '' }]) {
            expect(progressionKindOf(notAdditive), JSON.stringify(notAdditive))
                .toBe(PROGRESSION_KINDS.PROGRESSIVE);
        }
        // ⛓ …and the members come out of the container each kind actually uses.
        const doc = twoKinds();
        const slot = doc[PROGRESSION_MAPPING_KEY][P];
        expect(progressionMemberNames(slot['Progressive Blade']))
            .toEqual(['Blade', 'Retired Blade']);
        expect(progressionMemberNames(slot.Shards)).toEqual(['Shard']);
        expect(progressionMemberNames({})).toEqual([]);
    });

    /**
     * ⛓⛓⛓ **THE ⚖ LAW: every name the validator reports is a name this edit
     * would not ADD, and the reverse.** The two are driven against each other
     * over a document that already carries one stale member, because that is
     * the state the corpus is in and the state the difference exists for.
     */
    it('⛓⛓⛓ every reported name is one the op will not add, and the reverse', () => {
        const doc = twoKinds();
        const reported = progressionMappingIssues(doc, P);
        expect(reported.map(describeProgressionIssue))
            .toEqual(['Progressive Blade → Retired Blade — unknown item']);

        // ⛓ ADDING the reported name to the OTHER entry is refused, naming it.
        const addingIt = set(doc, {
            player: P, name: 'Shards', mapping: additive('Shards', { Shard: 5, 'Retired Blade': 1 }),
        });
        expect(addingIt.ok).toBe(false);
        expect(addingIt.error).toContain('Retired Blade');
        expect(addingIt.error).toContain(PROGRESSION_ISSUE_REASONS.UNKNOWN_ITEM);

        // ⛓ …and every name the validator does NOT report is one it accepts.
        for (const held of Object.keys(doc.items[P])) {
            const res = set(doc, {
                player: P, name: 'Trial', mapping: progressive('Trial', [{ name: held, level: 1 }]),
            });
            expect(res.ok, `${held} is an item this slot holds`).toBe(true);
        }
    });

    it('⛓⛓ a member the entry ALREADY had stays editable, and removing it is accepted', () => {
        const doc = twoKinds();
        // ⛓ The stale member kept, another level moved — the edit a person makes
        //   on a card that arrived with a dangling name.
        const kept = set(doc, {
            player: P,
            name: 'Progressive Blade',
            mapping: progressive('Progressive Blade',
                [{ name: 'Blade', level: 3 }, { name: 'Retired Blade', level: 4 }]),
        });
        expect(kept.ok).toBe(true);
        expect(kept.doc[PROGRESSION_MAPPING_KEY][P]['Progressive Blade'].items[0].level).toBe(3);
        expect(progressionMappingIssues(kept.doc, P)).toHaveLength(1);

        // ⛓ …and taking it OUT is accepted too, which is the gesture an
        //   absolute refusal would have removed.
        const dropped = set(doc, {
            player: P,
            name: 'Progressive Blade',
            mapping: progressive('Progressive Blade', [{ name: 'Blade', level: 1 }]),
        });
        expect(dropped.ok).toBe(true);
        expect(progressionMappingIssues(dropped.doc, P)).toEqual([]);
    });

    it('⛓ `base_item` names one of the SLOT\'S MAPPINGS, not an item', () => {
        const doc = twoKinds();
        // ⛓ Pooling into a sibling entry — alttp's `Progressive Bow (Alt)`.
        const pooled = set(doc, {
            player: P, name: 'Progressive Blade (Alt)',
            mapping: progressive('Progressive Blade', [{ name: 'Blade', level: 2 }]),
        });
        expect(pooled.ok).toBe(true);
        // ⛓ A base naming an ITEM the slot holds but no mapping is REFUSED —
        //   which is the direction the shape "base_item is an item" got wrong.
        const asItem = set(doc, {
            player: P, name: 'Trial', mapping: progressive('Blade', [{ name: 'Blade', level: 1 }]),
        });
        expect(asItem.ok).toBe(false);
        expect(asItem.error).toContain(PROGRESSION_ISSUE_REASONS.UNPOOLED_BASE);
        // ⛓ …and a base naming the entry ITSELF always resolves, on a document
        //   whose block does not exist yet.
        const fresh = set({ items: { [P]: { Blade: {} } } }, {
            player: P, name: 'Progressive Blade',
            mapping: progressive('Progressive Blade', [{ name: 'Blade', level: 1 }]),
        });
        expect(fresh.ok).toBe(true);
        expect(fresh.doc[PROGRESSION_MAPPING_KEY][P]['Progressive Blade'].items).toHaveLength(1);
    });

    it('⛓⛓ the SHAPE is refused outright, by kind, and each sentence says which rule', () => {
        const doc = twoKinds();
        const bad = (mapping) => set(doc, { player: P, name: 'Trial', mapping }).error;
        expect(bad('nope')).toContain('is an object');
        expect(bad({ items: [{ name: 'Blade', level: 1 }] })).toContain('base_item');
        expect(bad(progressive('Trial', []))).toContain('non-empty list');
        expect(bad(progressive('Trial', { Blade: 1 }))).toContain('non-empty list');
        expect(bad(progressive('Trial', [{ name: 'Blade' }]))).toContain('1 or greater');
        expect(bad(progressive('Trial', [{ name: 'Blade', level: 0 }]))).toContain('1 or greater');
        expect(bad(progressive('Trial', [{ name: 'Blade', level: 1.5 }]))).toContain('1 or greater');
        expect(bad(progressive('Trial', [{ level: 1 }]))).toContain('{name, level}');
        expect(bad(progressive('Trial',
            [{ name: 'Blade', level: 1 }, { name: 'Blade', level: 2 }]))).toContain('twice');
        expect(bad(additive('Trial', {}))).toContain('non-empty {item: value} map');
        expect(bad(additive('Trial', [{ name: 'Shard' }]))).toContain('non-empty {item: value} map');
        expect(bad(additive('Trial', { Shard: 'five' }))).toContain('whole number');
        // ⛓ The tag the runtime does not know is refused rather than silently
        //   treated as progressive.
        expect(bad({ type: 'cumulative', base_item: 'Trial', items: { Shard: 1 } }))
            .toContain(ADDITIVE_TYPE);
        expect(bad({ base_item: '', items: [{ name: 'Blade', level: 1 }] })).toContain('base_item');
        // ⛓ …and a nameless op is refused before any of it.
        expect(set(doc, { player: P, name: '   ' }).error).toContain('non-empty string');
    });

    it('⛓ an absent `mapping` DELETES, and a delete is NOT validated', () => {
        const doc = twoKinds();
        // ⛓ The stale-member entry comes out whole, without repairing it first.
        const gone = set(doc, { player: P, name: 'Progressive Blade' });
        expect(gone.ok).toBe(true);
        expect(Object.keys(gone.doc[PROGRESSION_MAPPING_KEY][P])).toEqual(['Shards']);
        // ⛓⛓ Deleting the HEAD of a pool leaves the sibling's base dangling —
        //   reported, never refused, because refusing it would make exactly the
        //   entries that pool the ones nobody can remove.
        const pooled = set(doc, {
            player: P, name: 'Progressive Blade (Alt)',
            mapping: progressive('Progressive Blade', [{ name: 'Blade', level: 2 }]),
        }).doc;
        const head = set(pooled, { player: P, name: 'Progressive Blade' });
        expect(head.ok).toBe(true);
        expect(progressionMappingIssues(head.doc, P).map((i) => i.reason))
            .toContain(PROGRESSION_ISSUE_REASONS.UNPOOLED_BASE);
        // ⛓ A name the slot does not carry is a NO-OP, not a refusal.
        const absent = set(doc, { player: P, name: 'Never Was' });
        expect(absent.ok).toBe(true);
        expect(absent.doc).toBe(doc);
    });

    it('⛓ the op writes ONE slot, and the other slot is untouched', () => {
        const doc = twoKinds();
        const res = set(doc, {
            player: '3', name: 'Progressive Torch',
            mapping: progressive('Progressive Torch', [{ name: 'Torch', level: 1 }]),
        });
        expect(res.ok).toBe(true);
        expect(Object.keys(res.doc[PROGRESSION_MAPPING_KEY]['3']))
            .toEqual(['Progressive Blade', 'Progressive Torch']);
        expect(res.doc[PROGRESSION_MAPPING_KEY][P]).toBe(doc[PROGRESSION_MAPPING_KEY][P]);
        // ⛓⛓ …and the SLOT is what the refusal reads: slot 3 holds `Torch` and
        //   not `Blade`, so the same edit that passes on slot 1 is refused here.
        const wrongSlot = set(doc, {
            player: '3', name: 'Trial', mapping: progressive('Trial', [{ name: 'Blade', level: 1 }]),
        });
        expect(wrongSlot.ok).toBe(false);
        expect(wrongSlot.error).toContain('slot 3');
        expect(progressionMappings(doc, '3')['Progressive Blade'].items[0].name).toBe('Torch');
        expect(progressionMappings(doc, '9')).toEqual({});
    });

    /**
     * ⛓⛓ **A MEMBER FIELD THIS EDITOR DOES NOT DRAW SURVIVES THE ROUND TRIP.**
     * `provides` is schema-declared (`$defs.progressiveItemLevel`) and carried
     * by 13 committed members, all smz3's — and an op that writes the WHOLE
     * entry is exactly the shape that can drop one silently.
     */
    it('⛓⛓ `provides` is carried through, because the op writes the whole entry', () => {
        const doc = twoKinds();
        const withProvides = progressive('Progressive Blade', [
            { name: 'Blade', level: 1, provides: ['Blade', 'SharpBlade'] },
        ]);
        const res = set(doc, { player: P, name: 'Progressive Blade', mapping: withProvides });
        expect(res.ok).toBe(true);
        expect(res.doc[PROGRESSION_MAPPING_KEY][P]['Progressive Blade'].items[0].provides)
            .toEqual(['Blade', 'SharpBlade']);
        // ⛓ …and the payload is COPIED, not aliased (the module's clone law).
        withProvides.items[0].provides.push('Mutated');
        expect(res.doc[PROGRESSION_MAPPING_KEY][P]['Progressive Blade'].items[0].provides)
            .toEqual(['Blade', 'SharpBlade']);
    });

    it('⛓ one edit is one op and one undo, through the session', () => {
        const doc = twoKinds();
        const session = createEditSession(rulesEditAdapter, doc);
        session.apply({
            op: 'set-progression-mapping', player: P, name: 'Progressive Blade',
            mapping: progressive('Progressive Blade', [{ name: 'Blade', level: 7 }]),
        });
        expect(session.ops()).toHaveLength(1);
        expect(session.record()[PROGRESSION_MAPPING_KEY][P]['Progressive Blade'].items)
            .toEqual([{ name: 'Blade', level: 7 }]);
        session.undo();
        expect(session.record()[PROGRESSION_MAPPING_KEY][P]['Progressive Blade'])
            .toEqual(doc[PROGRESSION_MAPPING_KEY][P]['Progressive Blade']);
    });
});

describe('canonical placements — the --canonical-seed input (W3)', () => {
    /**
     * ⛓ A SECOND SLOT, built the same way as the first, so the per-slot scope
     * row has a slot to leave alone. ⛔ Slot 3 rather than slot 2, so a handler
     * that reached for "the other slot" by index would still be wrong.
     */
    function twoSlots() {
        const doc = fixture();
        doc.regions['3'] = {
            Attic: makeRegion('Attic', [], [makeLocation('Attic Chest', 7)]),
        };
        doc.items['3'] = {
            Lantern: {
                name: 'Lantern', id: 7, groups: [], classification: 'progression',
                type: null, max_count: 1,
            },
        };
        doc.canonical_placements = {
            [P]: { 'Hall Chest': 'Key' },
            3: { 'Attic Chest': 'Lantern' },
        };
        return doc;
    }

    const place = (doc, op) => applyRulesDocOp(doc, { op: 'set-canonical-placement', ...op });

    /**
     * ⛓ **`makeRulesJsonScaffold` ALREADY WRITES `canonical_placements: {'1': {}}`**
     * — measured, not assumed (`shared/rulesJsonBuilder.js`). So the "creates
     * the block" claim needs a document that really lacks the key, which is what
     * a hand-built or pre-scaffold document looks like.
     */
    const noBlock = () => {
        const doc = fixture();
        delete doc.canonical_placements;
        return doc;
    };

    it('⛓ places an item at a location the slot holds, creating the block when absent', () => {
        const doc = noBlock();
        const res = place(doc, { player: P, location: 'Vault Chest', item: 'Key' });
        expect(res.ok).toBe(true);
        expect(res.doc.canonical_placements[P]).toEqual({ 'Vault Chest': 'Key' });
        expect(res.description).toContain('Vault Chest');
        // ⛓ COPY-ON-WRITE: the fixture is untouched and the regions are SHARED.
        expect(doc.canonical_placements).toBeUndefined();
        expect(res.doc.regions).toBe(doc.regions);
    });

    it('⛓ replaces an existing entry in place, leaving every other entry alone', () => {
        const doc = twoSlots();
        const res = place(doc, { player: P, location: 'Hall Chest', item: 'Victory' });
        expect(res.ok).toBe(true);
        expect(res.doc.canonical_placements[P]['Hall Chest']).toBe('Victory');
        expect(Object.keys(res.doc.canonical_placements[P]))
            .toEqual(Object.keys(doc.canonical_placements[P]));
    });

    /**
     * ⛓⛓ **AN ABSENT / EMPTY `item` DELETES.** `''` is what the tab's blank
     * "(unplaced)" option carries, exactly as it does in `set-start-region`.
     */
    it('⛓⛓ an absent or empty item DELETES the entry', () => {
        const doc = twoSlots();
        for (const item of [undefined, '', null]) {
            const res = place(doc, { player: P, location: 'Hall Chest', item });
            expect(res.ok, JSON.stringify(item)).toBe(true);
            expect(res.doc.canonical_placements[P], JSON.stringify(item)).toEqual({});
            expect(res.description, JSON.stringify(item)).toContain('unplaced');
        }
    });

    /**
     * ⛔⛔ **AND A DELETE IS NOT VALIDATED — which is the only thing that makes
     * a hand-edited file fixable.** A document can carry a placement naming a
     * location or an item it no longer holds; the tab SHOWS those and the only
     * gesture it can offer is removal, so refusing the delete would leave the
     * one entry a person needs to remove as the one entry they cannot. The
     * refusals below guard what is WRITTEN, never what is removed.
     */
    it('⛔ a STALE entry can be deleted even though its location is gone', () => {
        const doc = twoSlots();
        doc.canonical_placements[P]['Deleted Room Chest'] = 'Key';
        // The write is refused…
        expect(place(doc, { player: P, location: 'Deleted Room Chest', item: 'Key' }).ok)
            .toBe(false);
        // …and the delete is not.
        const res = place(doc, { player: P, location: 'Deleted Room Chest' });
        expect(res.ok).toBe(true);
        expect(res.doc.canonical_placements[P]).toEqual({ 'Hall Chest': 'Key' });
    });

    /**
     * ⛓ Deleting nothing returns the document UNCHANGED rather than refusing —
     * the session's `equal` calls that a no-op, and writing an empty block into
     * a document that never carried the key would be a byte change for a
     * gesture that removed nothing.
     */
    it('⛓ deleting an entry that is not there is a NO-OP, not a refusal or a new block', () => {
        const doc = noBlock();
        const res = place(doc, { player: P, location: 'Vault Chest' });
        expect(res.ok).toBe(true);
        expect(res.doc).toBe(doc);
        expect(res.doc.canonical_placements).toBeUndefined();
        // ⛓ …and with the block PRESENT but empty, the document is still the
        //   same object rather than a copy that merely agrees.
        const scaffolded = fixture();
        expect(place(scaffolded, { player: P, location: 'Vault Chest' }).doc).toBe(scaffolded);
    });

    it('⛓ refuses a location the slot does not hold, listing what it does', () => {
        const res = place(twoSlots(), { player: P, location: 'Attic Chest', item: 'Key' });
        expect(res.ok).toBe(false);
        expect(res.error).toContain('Attic Chest');
        // ⛓ `Attic Chest` is slot 3's location — held by the DOCUMENT, not by
        //   this slot, which is the discrimination the refusal is about.
        expect(res.error).toContain('Hall Chest');
        expect(res.error).toContain('Vault Chest');
    });

    it('⛓ refuses an item the slot does not hold, listing what it does', () => {
        const res = place(twoSlots(), { player: P, location: 'Hall Chest', item: 'Lantern' });
        expect(res.ok).toBe(false);
        expect(res.error).toContain('Lantern');
        expect(res.error).toContain('Key');
        expect(res.error).toContain('Victory');
    });

    /**
     * ⛓⛓ **THE REFUSAL IS A SENTENCE, NOT A DUMP.** Measured over the committed
     * corpus, one slot can hold 1,194 locations and 1,208 items, so the listing
     * is bounded by `REFUSAL_NAME_LIMIT` and says how many it did not name.
     */
    it('⛓⛓ a refusal names at most REFUSAL_NAME_LIMIT of them, and says how many it did not', () => {
        const doc = fixture();
        const many = Array.from({ length: REFUSAL_NAME_LIMIT + 5 },
            (_, i) => makeLocation(`Cell ${i}`, 100 + i));
        doc.regions[P].Vault.locations = many;
        const res = place(doc, { player: P, location: 'Nowhere', item: 'Key' });
        expect(res.ok).toBe(false);
        const named = many.filter((l) => res.error.includes(l.name)).length;
        expect(named).toBeLessThanOrEqual(REFUSAL_NAME_LIMIT);
        expect(res.error).toContain('more');
    });

    /**
     * ⛓⛓ **PER-SLOT SCOPE, AGAINST THE OTHER SLOT'S BYTES.** An op stamped with
     * one player may not touch another's block — the property the four-player
     * in-app row drives in the browser, asserted here on built bytes.
     */
    it('⛓⛓ a slot-1 op leaves slot 3\'s block byte-identical', () => {
        const doc = twoSlots();
        const before = JSON.stringify(doc.canonical_placements[3]);
        const res = place(doc, { player: P, location: 'Vault Chest', item: 'Key' });
        expect(res.ok).toBe(true);
        expect(JSON.stringify(res.doc.canonical_placements[3])).toBe(before);
        // ⛓ …and the untouched slot is the SAME OBJECT, not a copy that agrees.
        expect(res.doc.canonical_placements[3]).toBe(doc.canonical_placements[3]);
    });

    it('⛓ and a slot-3 op writes slot 3, leaving slot 1 alone', () => {
        const doc = twoSlots();
        const res = place(doc, { player: '3', location: 'Attic Chest', item: 'Lantern' });
        expect(res.ok).toBe(true);
        expect(res.doc.canonical_placements[3]).toEqual({ 'Attic Chest': 'Lantern' });
        expect(res.doc.canonical_placements[P]).toBe(doc.canonical_placements[P]);
    });

    it('⛓ refuses a location that is not a non-empty string, by name', () => {
        for (const location of [undefined, '', 42, null]) {
            const res = place(fixture(), { player: P, location, item: 'Key' });
            expect(res.ok, JSON.stringify(location)).toBe(false);
            expect(res.error).toContain('set-canonical-placement');
        }
    });

    /**
     * ⛓⛓ `locationsOfPlayer` is EXPORTED because the op and the Placements tab
     * must not disagree about what "a location this slot holds" means. Order is
     * the DOCUMENT's — region insertion order, then each region's own array.
     */
    it('⛓⛓ locationsOfPlayer is the slot\'s locations, in document order, with their regions', () => {
        const doc = twoSlots();
        expect(locationsOfPlayer(doc, P)).toEqual([
            { region: 'Hall', name: 'Hall Chest' },
            { region: 'Vault', name: 'Vault Chest' },
        ]);
        expect(locationsOfPlayer(doc, '3')).toEqual([{ region: 'Attic', name: 'Attic Chest' }]);
        expect(locationsOfPlayer(doc, '9')).toEqual([]);
    });

    /**
     * ⛓ THE FOLD: the op list is the identity, so a placement and its removal
     * re-fold to the document they produced the first time.
     */
    it('⛓ folds through the session and one undo takes it back out', () => {
        const doc = noBlock();
        const session = createEditSession(rulesEditAdapter, doc);
        session.apply({ op: 'set-canonical-placement', player: P, location: 'Vault Chest', item: 'Key' });
        expect(session.record().canonical_placements[P]).toEqual({ 'Vault Chest': 'Key' });
        session.undo();
        expect(session.record().canonical_placements).toBeUndefined();
        expect(session.ops()).toHaveLength(0);
    });

    /* ── P1: the shared validator ─────────────────────────────────────── */

    /**
     * ⛓⛓⛓ **THE VALIDATOR IS THE OP'S OWN PREDICATE, AND THIS IS THE ROW THAT
     * SAYS SO** (P1). For each of the three reasons: the entry is reported, and
     * a WRITE of that same entry is refused. ⛔ Scored against the LAW —
     * *"stale means the op would refuse it"* — rather than against the
     * validator's own output, because a row that only re-read the validator
     * would pass on any pair of functions that agreed with themselves.
     */
    it('⛓⛓⛓ every reason it reports is a write the op refuses, and the reverse', () => {
        const cases = [
            ['Deleted Room Chest', 'Key', PLACEMENT_ISSUE_REASONS.UNKNOWN_LOCATION],
            ['Hall Chest', 42, PLACEMENT_ISSUE_REASONS.NON_STRING_VALUE],
            ['Hall Chest', 'A Renamed Item', PLACEMENT_ISSUE_REASONS.UNKNOWN_ITEM],
        ];
        for (const [location, item, reason] of cases) {
            const doc = twoSlots();
            doc.canonical_placements[P] = { [location]: item };
            const issues = canonicalPlacementIssues(doc, P);
            expect(issues, `${location} / ${JSON.stringify(item)}`)
                .toEqual([{ location, item, reason }]);
            // …and the op refuses the very same write.
            expect(place(doc, { player: P, location, item }).ok,
                `${location} / ${JSON.stringify(item)}`).toBe(false);
        }
        // ⛓ The other half of the law: an entry the op WOULD write is no issue.
        const good = twoSlots();
        good.canonical_placements[P] = { 'Hall Chest': 'Key' };
        expect(canonicalPlacementIssues(good, P)).toEqual([]);
        expect(place(good, { player: P, location: 'Hall Chest', item: 'Key' }).ok).toBe(true);
    });

    /**
     * ⛔ **AN UNHELD LOCATION IS REPORTED AS ONE WHATEVER ITS VALUE IS** — the
     * ordering `placementIssueReason` fixes. An entry reported as a non-string
     * value would leave the tab's orphan block, which is the only list that can
     * offer it a delete.
     */
    it('⛔ an entry the slot does not hold reports its LOCATION, even with a junk value', () => {
        const doc = twoSlots();
        doc.canonical_placements[P] = { 'Deleted Room Chest': { not: 'a name' } };
        expect(canonicalPlacementIssues(doc, P).map((i) => i.reason))
            .toEqual([PLACEMENT_ISSUE_REASONS.UNKNOWN_LOCATION]);
    });

    it('⛓ reports the slot it was asked about and no other', () => {
        const doc = twoSlots();
        doc.canonical_placements[P]['Deleted Room Chest'] = 'Key';
        doc.canonical_placements[3]['Also Deleted'] = 'Lantern';
        expect(canonicalPlacementIssues(doc, P).map((i) => i.location))
            .toEqual(['Deleted Room Chest']);
        expect(canonicalPlacementIssues(doc, '3').map((i) => i.location)).toEqual(['Also Deleted']);
        // ⛓ …and a slot the block does not carry has nothing to report.
        expect(canonicalPlacementIssues(doc, '9')).toEqual([]);
    });

    it('⛓ a document with no block, and a slot that is not an object, report nothing', () => {
        expect(canonicalPlacementIssues(noBlock(), P)).toEqual([]);
        expect(canonicalPlacementIssues(undefined, P)).toEqual([]);
        const odd = twoSlots();
        odd.canonical_placements[P] = 'not an object';
        expect(canonicalPlacementIssues(odd, P)).toEqual([]);
    });

    /**
     * ⛓⛓ **THE WHOLE-DOCUMENT READER STAMPS THE PLAYER**, because the panel's
     * veto differences two documents and a finding that lost its slot could be
     * matched against the wrong one. ⛔ Its population is the slots the BLOCK
     * carries — a slot with regions but no block has no entry to be stale.
     */
    it('⛓⛓ byPlayer walks every slot the block carries, stamping each finding', () => {
        const doc = twoSlots();
        doc.canonical_placements[P]['Deleted Room Chest'] = 'Key';
        doc.canonical_placements[3]['Also Deleted'] = 'Lantern';
        expect(canonicalPlacementIssuesByPlayer(doc).map((i) => [i.player, i.location]))
            .toEqual([[P, 'Deleted Room Chest'], ['3', 'Also Deleted']]);
        expect(canonicalPlacementIssuesByPlayer(noBlock())).toEqual([]);
    });

    it('⛓ describePlacementIssue names the location, the value and the reason', () => {
        const doc = twoSlots();
        doc.canonical_placements[P] = { 'Deleted Room Chest': 'Key' };
        const [issue] = canonicalPlacementIssues(doc, P);
        const line = describePlacementIssue(issue);
        expect(line).toContain('Deleted Room Chest');
        expect(line).toContain('Key');
        expect(line).toContain(PLACEMENT_ISSUE_REASONS.UNKNOWN_LOCATION);
        // ⛓ A non-string value is SHOWN rather than coerced into a bare word.
        expect(describePlacementIssue({ location: 'X', item: 42, reason: 'r' })).toContain('42');
    });
});

describe('clear', () => {
    it('empties the four per-slot containers and KEEPS every other key', () => {
        const doc = fixture();
        doc.procgen_metadata = { sphere_tree: { a: 1 } };
        const out = applied(doc, { op: 'clear' }).doc;
        expect(out.regions[P]).toEqual({});
        expect(out.items[P]).toEqual({});
        expect(out.itempool_counts[P]).toEqual({});
        expect(out.starting_items[P]).toEqual([]);
        expect(out.procgen_metadata).toEqual({ sphere_tree: { a: 1 } });
        expect(Object.keys(out)).toEqual(Object.keys(doc));       // key ORDER kept
    });

    /**
     * ⛓⛓ **AND IT IS UNDOABLE, WHICH IS WHY IT IS AN OP.** A session boundary
     * would make Clear the one gesture in the panel that destroys work with no
     * way back.
     */
    it('⛓ one undo of a clear restores the document byte for byte', () => {
        const doc = fixture();
        const cleared = foldEdits(rulesEditAdapter, doc, [{ op: 'clear' }]).record;
        expect(bytes(cleared)).not.toBe(bytes(doc));
        expect(bytes(foldEdits(rulesEditAdapter, doc, []).record)).toBe(bytes(doc));
    });
});

describe('the per-op player slot', () => {
    it('`player` is an op FIELD with a default, not a module constant', () => {
        const doc = fixture();
        doc.regions['2'] = { Lobby: { name: 'Lobby', exits: [], locations: [] } };
        const out = applied(doc, { op: 'add-region', name: 'Annex', player: '2' }).doc;
        expect(Object.keys(out.regions['2'])).toEqual(['Lobby', 'Annex']);
        expect(Object.keys(out.regions[P])).toEqual(['Hall', 'Vault']);   // slot 1 untouched
    });
});

describe('nextName', () => {
    it('is the bare stem when free, then the first free numbered form', () => {
        expect(nextName('New Region', [])).toBe('New Region');
        expect(nextName('New Region', ['New Region'])).toBe('New Region 2');
        expect(nextName('New Region', ['New Region', 'New Region 2'])).toBe('New Region 3');
    });
});

/**
 * ⛓⛓⛓ **TRAP 823's CURE, AS A GATE.** An op that ENUMERATES its fields drops a
 * new one silently. These rows read the PANEL'S OWN SOURCE for the field
 * literals it hands to `set-item-field` / `set-meta` / `set-exit-field` and
 * assert the two sets are EQUAL in both directions — a field the panel writes
 * that the table does not hold is a refusal nobody predicted; a table entry no
 * row writes is a vocabulary entry with no caller.
 *
 * ⛔ IT IS NOT A FIXED POINT: it reads the SOURCE TEXT of a different file, not
 * anything this module or its table generated.
 */
describe('the panel and the ops read the SAME field tables', () => {
    const panelSource = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), 'apworldEditorUI.js'), 'utf8');

    /** Every distinct capture of `re` in the panel's source, as a sorted list. */
    const scan = (re) => [...new Set([...panelSource.matchAll(re)].map((m) => m[1]))].sort();

    /**
     * ⛓ The item row writes through ONE helper, `setField('<field>', …)`, plus
     * the classification editor's own `field: '<field>'` beside its op literal.
     */
    it('⛓ set-item-field: the panel writes EXACTLY the ITEM_FIELDS table', () => {
        const written = [...new Set([
            ...scan(/setField\('(\w+)'/g),
            ...scan(/op: 'set-item-field'[\s\S]{0,120}?field: '(\w+)'/g),
        ])].sort();
        expect(written).toEqual(Object.keys(ITEM_FIELDS).sort());
    });

    it('⛓ set-meta: the panel\'s eight rows name EXACTLY the META_FIELDS table', () => {
        expect(scan(/_makeMetaRow\(\s*\n?\s*'[^']*',\s*'(\w+)'/g))
            .toEqual(Object.keys(META_FIELDS).sort());
    });

    it('⛓ set-exit-field: the panel writes EXACTLY the EXIT_FIELDS list', () => {
        expect(scan(/setExitField\('(\w+)'/g)).toEqual([...EXIT_FIELDS].sort());
    });

    /**
     * ⛔ NON-VACUITY, both ways. The scan really finds literals in that file,
     * and a name NOT in a table is not sitting in it unnoticed.
     */
    it('the scan is not vacuous — it finds the panel\'s own op literals, and no stray field', () => {
        for (const kind of ['set-item-field', 'set-meta', 'set-exit-field', 'set-rule-tree',
            'set-canonical-placement']) {
            expect(panelSource, kind).toContain(`op: '${kind}'`);
        }
        expect(scan(/setField\('(\w+)'/g).length).toBeGreaterThan(0);
        expect(panelSource).not.toContain("setField('colour'");
    });

    /**
     * ⛓⛓ AND THE OTHER DIRECTION IS ENFORCED AT RUNTIME, NOT BY A SCAN: the
     * panel's three helpers THROW on a field their table does not hold, and the
     * op REFUSES one — so a row that learned to write a new field without a
     * table entry cannot reach the document by any path.
     */
    it('⛓ the panel guards each table by NAME, in code', () => {
        expect(panelSource).toContain('no ITEM_FIELDS entry');
        expect(panelSource).toContain('no META_FIELDS entry');
        expect(panelSource).toContain('no EXIT_FIELDS entry');
    });
});
