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
    EXIT_FIELDS, ITEM_FIELDS, META_FIELDS, RULES_OP_KINDS, SET_KEY_SCOPES,
    applyRulesDocOp, deleteItemOps, deleteRegionOps, exitsPointingAt, nextName,
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
            'set-meta': { op: 'set-meta', key: 'game_name', value: 'Other' },
            'set-start-region': { op: 'set-start-region', region: 'Vault' },
            'set-completion-condition': { op: 'set-completion-condition', condition: { type: 'constant', value: true } },
            'set-rule-tree': { op: 'set-rule-tree', path: { region: 'Hall', kind: 'exit', index: 0 }, tree: { rule: 'True_' } },
            'replace-region-sidecar': {
                op: 'replace-region-sidecar', region: 'Hall',
                payload: { width: 4, height: 4, tiles: 'bbbb' }, rules: hallRules(doc),
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
        for (const kind of ['set-item-field', 'set-meta', 'set-exit-field', 'set-rule-tree']) {
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
