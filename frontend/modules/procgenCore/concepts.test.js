/**
 * procgenCore/concepts — **THE CONTRACT** (concept library T0, D1).
 *
 * ⛓ The subjects here are a FIXTURE table and a TEST DOUBLE entry (the brief's
 * own shape): no registry entry carries `conceptRealisations` yet, and T0 adds
 * none. The shipped table is pinned in `concepts.table.test.js`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { ELEMENT_LAWS, LAW_CUT, LAW_SHORTCUT } from './elements.js';
import { GRADES, GRADE_WORDS, REQUIRING_GRADES } from './differentialGrade.js';
import {
    CONCEPT_KINDS, ConceptContractError, EFFECTS, EFFECT_GRADES, EFFECT_LAW, EFFECT_WORDS, RELATIONS, TIERS,
    assertConcept, assertConceptTable, assertRealisation, assertRealisations, gradeCertifies, instancesOf,
    itemIdOfNeed, normaliseNeed,
    CONCEPTS, CONCEPT_ITEMS_FEATURE, conceptOfItem, conceptsRealisedBy, isConceptRow, itemRowsOf,
    itemTagsImpliedBy, markConceptRow, realisationsOf,
    blocksImplementedBy, normaliseDefence,
} from './concepts.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** A fresh fixture table each call, so a test may break one field of it. */
function table() {
    const colour = { key: 'colour', domain: ['red', 'blue'], default: 'red', why: 'two lock groups' };
    return {
        sword: { kind: 'item', item: { id: 'Progressive Sword', name: 'Progressive Sword', classification: 'progression' } },
        swim: { kind: 'item', item: { id: 'Progressive Swim', name: 'Progressive Swim', classification: 'progression' } },
        guardian: { kind: 'enemy', relations: { weakness: ['sword'] } },
        water: { kind: 'obstacle', relations: { crossedWith: ['swim'] } },
        key: {
            kind: 'item', params: [colour], idFor: ({ colour: c }) => `key_${c}`,
            item: { classification: 'progression', symbol: 'key' },
            presentation: { key_red: { name: 'Red Key' }, key_blue: { name: 'Blue Key' } },
        },
        door: {
            kind: 'obstacle', params: [colour], idFor: ({ colour: c }) => `door_${c}`,
            relations: { openedBy: ['key'] },
            presentation: { door_red: { name: 'Red Door' }, door_blue: { name: 'Blue Door' } },
        },
    };
}

/** ⛓ The brief's substrate half, as a TEST DOUBLE. */
function double() {
    return {
        id: 'double',
        conceptRealisations: {
            guardian: {
                tier: 'mechanic', art: null, placements: {
                    gate: { effect: 'requires', needs: ['sword'], mechanic: { element: 'killgate' } },
                    roaming: { effect: 'none', mechanic: { element: 'roam' } },
                },
            },
            water: {
                tier: 'mechanic', art: null, placements: {
                    gate: { effect: 'requires', needs: ['swim'], mechanic: { element: 'watergate' } },
                    shortcut: { effect: 'helps', needs: ['swim'], mechanic: { element: 'watershortcut' } },
                },
            },
            sword: { tier: 'mechanic', flag: 'hasSword' },
        },
    };
}

const throwsNaming = (fn, re) => {
    expect(fn).toThrow(ConceptContractError);
    expect(fn).toThrow(re);
};

describe('the vocabulary is imported, never spelled again', () => {
    it('kinds, effects and tiers are the declared words', () => {
        expect(CONCEPT_KINDS).toEqual(['item', 'obstacle', 'enemy', 'hazard']);
        expect(EFFECT_WORDS).toEqual(['requires', 'helps', 'none']);
        expect(TIERS).toEqual(['mechanic', 'skin']);
        expect(RELATIONS).toEqual(['weakness', 'crossedWith', 'openedBy']);
    });

    it('effect → law: requires is the cut law, helps the shortcut law, none has no law', () => {
        expect(EFFECT_LAW).toEqual({ requires: LAW_CUT, helps: LAW_SHORTCUT, none: null });
        for (const e of EFFECT_WORDS) {
            if (EFFECT_LAW[e] !== null) expect(ELEMENT_LAWS).toContain(EFFECT_LAW[e]);
        }
    });

    it('effect → grades: requires IS REQUIRING_GRADES (the same object), helps SHORTENS, none INERT', () => {
        expect(EFFECT_GRADES.requires).toBe(REQUIRING_GRADES);
        expect(EFFECT_GRADES.helps).toEqual([GRADES.SHORTENS]);
        expect(EFFECT_GRADES.none).toEqual([GRADES.INERT]);
        for (const e of EFFECT_WORDS) for (const g of EFFECT_GRADES[e]) expect(GRADE_WORDS).toContain(g);
    });

    it.each([
        ['requires', GRADES.STRONG, true], ['requires', GRADES.BOUND_DEPENDENT, true],
        ['requires', GRADES.SHORTENS, false], ['requires', GRADES.WEAK, false],
        ['helps', GRADES.SHORTENS, true], ['helps', GRADES.STRONG, false],
        ['none', GRADES.INERT, true], ['none', GRADES.SHORTENS, false], ['bogus', GRADES.STRONG, false],
    ])('gradeCertifies(%s, %s) = %s', (effect, grade, want) => {
        expect(gradeCertifies(effect, grade)).toBe(want);
    });
});

for (const r of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, r));
}

describe('⛔ browser-safe and nameless (the SOURCE, read)', () => {
    const ids = substrateRegistry.getAll().map((e) => e.id);
    it.each([
        ['frontend/modules/procgenCore/concepts.js'],
        ['frontend/modules/procgenCore/behaviourBlocks.js'],
        ['frontend/modules/procgenPipeline/conceptSelection.js'],
    ])('%s: no node: import, no registry import, no registered substrate id', (rel) => {
        const src = readFileSync(join(ROOT, rel), 'utf8');
        expect(ids.length).toBeGreaterThan(6);
        expect(src).not.toMatch(/from\s+['"]node:/);
        expect(src).not.toMatch(/substrateRegistry|reference\/registry|procgenDocs\/generated/);
        expect(src).not.toMatch(/from\s+['"][^'"]*seedlingDemo/);
        const named = ids.filter((id) => new RegExp(`(?<![A-Za-z0-9_])${id}(?![A-Za-z0-9_])`).test(src));
        expect(named).toEqual([]);
    });
});

describe('assertConcept / assertConceptTable — a malformed declaration THROWS', () => {
    it('the fixture table passes', () => {
        expect(assertConceptTable(table())).toBeTruthy();
    });

    it('instancesOf: one instance unparameterised, one per value in schema order otherwise', () => {
        const t = table();
        expect(instancesOf(t.sword)).toEqual([{ values: {}, id: 'Progressive Sword' }]);
        expect(instancesOf(t.water)).toEqual([{ values: {}, id: null }]);
        expect(instancesOf(t.door)).toEqual([
            { values: { colour: 'red' }, id: 'door_red' }, { values: { colour: 'blue' }, id: 'door_blue' },
        ]);
    });

    const bad = [
        ['an unknown kind', (t) => { t.water.kind = 'river'; }, /kind "river"/],
        ['an item with no row', (t) => { delete t.sword.item; }, /declares no `item` row/],
        ['an item row with no classification', (t) => { delete t.sword.item.classification; }, /classification/],
        ['an unparameterised item with no id', (t) => { delete t.sword.item.id; }, /non-empty `id`/],
        ['a non-item carrying an item row', (t) => { t.guardian.item = { id: 'x' }; }, /an enemy and carries an `item`/],
        ['params that are an object, not the schema array', (t) => { t.door.params = { colour: 'red' }; }, /SCHEMA ARRAY/],
        ['a default outside its domain (the ONE schema language)', (t) => { t.door.params[0] = { ...t.door.params[0], default: 'green' }; }, /not in its own domain/],
        ['a param with no why', (t) => { t.door.params[0] = { ...t.door.params[0], why: '' }; }, /no `why`/],
        ['params with no idFor', (t) => { delete t.door.idFor; }, /no `idFor/],
        ['idFor with no params', (t) => { t.water.idFor = () => 'w'; }, /instance of nothing/],
        ['idFor collapsing two instances', (t) => { t.door.idFor = () => 'door'; }, /one id/],
        ['a presentation missing an instance', (t) => { delete t.door.presentation.door_blue; }, /missing \[door_blue\]/],
        ['a presentation with an extra row', (t) => { t.door.presentation.door_green = { name: 'G' }; }, /extra \[door_green\]/],
        ['a presentation row with no name', (t) => { t.door.presentation.door_red = {}; }, /no `name`/],
        ['a parameterised item row carrying an id', (t) => { t.key.item.id = 'key'; }, /SHARED part/],
        ['an unknown relation', (t) => { t.water.relations = { drownedBy: ['swim'] }; }, /relation "drownedBy"/],
        ['an empty relation', (t) => { t.water.relations = { crossedWith: [] }; }, /non-empty list/],
        ['a relation naming no concept', (t) => { t.guardian.relations.weakness = ['axe']; }, /names "axe"/],
        ['a parameterised relation with no instance for a value', (t) => {
            t.door.params[0] = { ...t.door.params[0], domain: ['red', 'blue', 'green'] };
            t.door.presentation.door_green = { name: 'Green Door' };
        }, /no instance for its values \{"colour":"green"\}/],
        ['two items with one AP id', (t) => { t.swim.item.id = 'Progressive Sword'; }, /item id "Progressive Sword"/],
        ['two items with one name', (t) => { t.swim.item.name = 'Progressive Sword'; }, /item name "Progressive Sword"/],
        ['a key instance whose name another item carries', (t) => { t.key.presentation.key_red.name = 'Progressive Swim'; }, /item name "Progressive Swim"/],
    ];
    it.each(bad)('refuses %s', (_label, mutate, re) => {
        const t = table();
        mutate(t);
        throwsNaming(() => assertConceptTable(t), re);
    });

    it('assertConcept alone refuses an empty id and a non-object', () => {
        throwsNaming(() => assertConcept('', { kind: 'item' }), /non-empty id/);
        throwsNaming(() => assertConcept('x', null), /not an object/);
    });
});

describe('assertRealisation(s) — a substrate\'s half', () => {
    it('the brief\'s double passes; an entry with none is not an error (rule 4)', () => {
        const t = table();
        expect(() => assertRealisations(double(), t)).not.toThrow();
        expect(() => assertRealisations({ id: 'bare' }, t)).not.toThrow();
        expect(() => assertRealisations(undefined, t)).not.toThrow();
    });

    it('normaliseNeed / itemIdOfNeed', () => {
        expect(normaliseNeed('swim')).toEqual({ concept: 'swim', count: 1 });
        expect(normaliseNeed({ concept: 'swim', count: 2 })).toEqual({ concept: 'swim', count: 2 });
        expect(normaliseNeed(3)).toBeNull();
        const t = table();
        expect(itemIdOfNeed('swim', t)).toBe('Progressive Swim');
        expect(itemIdOfNeed('key', t)).toBeNull();
        expect(itemIdOfNeed('water', t)).toBeNull();
    });

    const bad = [
        ['a realisations value that is not an object', (e) => { e.conceptRealisations = []; }, /not an object keyed/],
        ['a concept no table holds', (e) => { e.conceptRealisations.lava = { tier: 'mechanic' }; }, /"lava" names a concept no table holds/],
        ['an unknown tier', (e) => { e.conceptRealisations.sword.tier = 'paint'; }, /tier "paint"/],
        ['a numeric art', (e) => { e.conceptRealisations.water.art = 3; }, /`art`/],
        ['an item with placements', (e) => { e.conceptRealisations.sword.placements = {}; }, /HELD/],
        ['an obstacle with no placements', (e) => { e.conceptRealisations.water.placements = {}; }, /no `placements`/],
        ['an unknown effect', (e) => { e.conceptRealisations.water.placements.gate.effect = 'blocks'; }, /effect "blocks"/],
        ['a free rule expression', (e) => { e.conceptRealisations.water.placements.gate.rule = { rule: 'True_' }; }, /PLANNER/],
        ['needs on a none placement', (e) => { e.conceptRealisations.guardian.placements.roaming.needs = ['sword']; }, /effect "none" and declares needs/],
        ['a requires placement needing nothing', (e) => { e.conceptRealisations.water.placements.gate.needs = []; }, /needs nothing/],
        ['a helps placement needing nothing', (e) => { delete e.conceptRealisations.water.placements.shortcut.needs; }, /help with/],
        ['a need that is not an item', (e) => { e.conceptRealisations.water.placements.gate.needs = ['guardian']; }, /not an unparameterised item/],
        ['a need of a parameterised item', (e) => { e.conceptRealisations.water.placements.gate.needs = ['key']; }, /not an unparameterised item/],
        ['a zero count', (e) => { e.conceptRealisations.water.placements.gate.needs = [{ concept: 'swim', count: 0 }]; }, /count 0/],
        ['a fractional count', (e) => { e.conceptRealisations.water.placements.gate.needs = [{ concept: 'swim', count: 1.5 }]; }, /count 1.5/],
        ['one need named twice', (e) => { e.conceptRealisations.water.placements.gate.needs = ['swim', { concept: 'swim', count: 2 }]; }, /twice/],
        ['a malformed need', (e) => { e.conceptRealisations.water.placements.gate.needs = [7]; }, /malformed need/],
        ['a non-object mechanic', (e) => { e.conceptRealisations.water.placements.gate.mechanic = 'watergate'; }, /`mechanic`/],
    ];
    it.each(bad)('refuses %s', (_label, mutate, re) => {
        const e = double();
        mutate(e);
        throwsNaming(() => assertRealisations(e, table()), re);
    });

    it('assertRealisation accepts the feather shape — a need with a count', () => {
        const t = table();
        expect(() => assertRealisation('water', {
            tier: 'skin', art: 'deep water', placements: { deep: { effect: 'requires', needs: [{ concept: 'swim', count: 2 }] } },
        }, t)).not.toThrow();
    });
});

/* ─────────────────── T0b — the contract's follow-ups ─────────────────── */

describe('T0b — sword and swim carry the concept-items feature', () => {
    it('both unparameterised item concepts carry CONCEPT_ITEMS_FEATURE, and their library rows carry it', () => {
        expect(CONCEPT_ITEMS_FEATURE).toBe('concept_items');
        for (const c of ['sword', 'swim']) {
            expect(CONCEPTS[c].feature, c).toBe(CONCEPT_ITEMS_FEATURE);
            expect(itemRowsOf(CONCEPTS[c])[0].feature, c).toBe(CONCEPT_ITEMS_FEATURE);
        }
    });
    it('the coloured key keeps its own shared feature', () => {
        expect(CONCEPTS.key.feature).toBe('colored_doors_and_keys');
    });
});

describe('T0b — conceptOfItem, the reverse of itemIdOfNeed', () => {
    it('round-trips every unparameterised item concept', () => {
        for (const [cid, c] of Object.entries(CONCEPTS)) {
            const id = itemIdOfNeed(cid, CONCEPTS);
            if (id === null) continue;
            expect(conceptOfItem(id, CONCEPTS), cid).toBe(cid);
        }
        expect(conceptOfItem('Progressive Sword', CONCEPTS)).toBe('sword');
        expect(conceptOfItem('Progressive Swim', CONCEPTS)).toBe('swim');
    });
    it('a parameterised instance, a non-item, an unknown name and a non-string answer null', () => {
        expect(conceptOfItem('key_red', CONCEPTS)).toBeNull();
        expect(conceptOfItem('door_red', CONCEPTS)).toBeNull();
        expect(conceptOfItem('Sword', CONCEPTS)).toBeNull();
        expect(conceptOfItem('', CONCEPTS)).toBeNull();
        expect(conceptOfItem(undefined, CONCEPTS)).toBeNull();
        expect(conceptOfItem('Progressive Sword', undefined)).toBeNull();
    });
});

describe('T0b — realisationsOf takes an entry OR the realisations object', () => {
    const reals = double().conceptRealisations;
    it('an entry → its field; a {conceptRealisations} view → the field; the object itself → itself', () => {
        const entry = double();
        expect(realisationsOf(entry)).toBe(entry.conceptRealisations);
        expect(realisationsOf({ id: 'x', conceptRealisations: reals })).toBe(reals);
        expect(realisationsOf({ conceptRealisations: reals })).toBe(reals);
        expect(realisationsOf(reals)).toBe(reals);
    });
    it('an entry that realises nothing, a null field, null and a non-object are {}', () => {
        expect(realisationsOf({ id: 'bare', supportedFeatures: ['logic_gate'] })).toEqual({});
        expect(realisationsOf({ id: 'x', conceptRealisations: null })).toEqual({});
        expect(realisationsOf({})).toEqual({});
        expect(realisationsOf(null)).toEqual({});
        expect(realisationsOf(undefined)).toEqual({});
        expect(realisationsOf('maze')).toEqual({});
    });
    it('conceptsRealisedBy and itemTagsImpliedBy answer the same for the entry and for its realisations', () => {
        expect(conceptsRealisedBy(reals, CONCEPTS)).toEqual(conceptsRealisedBy(double(), CONCEPTS));
        expect(itemTagsImpliedBy(reals, CONCEPTS)).toEqual(itemTagsImpliedBy(double(), CONCEPTS));
        expect(conceptsRealisedBy(reals, CONCEPTS).map((r) => r.concept)).toEqual(['guardian', 'water', 'sword']);
    });
});

describe('T0b — the concept-row marker', () => {
    it('markConceptRow adds `concept` last and changes nothing else; isConceptRow reads it', () => {
        const row = itemRowsOf(CONCEPTS.sword)[0];
        const marked = markConceptRow(row, 'sword');
        expect(marked).toEqual({ ...row, concept: 'sword' });
        expect(Object.keys(marked).at(-1)).toBe('concept');
        expect('concept' in row).toBe(false);
        expect(isConceptRow(marked)).toBe(true);
        expect(isConceptRow(row)).toBe(false);
        expect(isConceptRow(null)).toBe(false);
        expect(isConceptRow({ concept: '' })).toBe(false);
    });
});

/* ─────────────── behaviour parameters P2, D3 — the concept's behaviour fields ─────────────── */

/** The fixture table with every P2 field declared — a fresh copy each call. */
function behaviourTable() {
    const t = table();
    t.sword.weaponCategories = ['sword'];
    t.guardian.defence = { sword: 'damage' };
    t.guardian.traits = [
        { key: 'toughness', range: { min: 1, max: 5 }, default: 2, why: 'how much it takes' },
        { key: 'speed', range: { min: 0, max: 1 }, default: 0.5, why: 'a fraction of the player speed' },
    ];
    t.water.triggers = [{ kind: 'counter', count: 2 }];
    return t;
}

/** A TEST DOUBLE whose guardian realisation implements blocks. */
function blockDouble() {
    const e = double();
    e.conceptRealisations.guardian.blocks = {
        chase: { speed: { trait: 'speed' }, range: 6 },
        contact: { damage: 1 },
        hp: {},
    };
    return e;
}

describe('P2 D3 — traits, weaponCategories, defence, triggers (every one OPTIONAL)', () => {
    it('the behaviour fixture passes; the plain fixture (no P2 field) still passes', () => {
        expect(() => assertConceptTable(behaviourTable())).not.toThrow();
        expect(() => assertConceptTable(table())).not.toThrow();
    });

    it('a defence entry may carry its response\'s params, and normaliseDefence reads both spellings', () => {
        const t = behaviourTable();
        t.guardian.defence = { sword: { response: 'damage', factor: 2 } };
        expect(() => assertConceptTable(t)).not.toThrow();
        expect(normaliseDefence('damage')).toEqual({ response: 'damage', params: {} });
        expect(normaliseDefence({ response: 'breakIfLevel', level: 2 })).toEqual({ response: 'breakIfLevel', params: { level: 2 } });
        expect(normaliseDefence(3)).toBeNull();
    });

    const bad = [
        ['traits that are not the schema array', (t) => { t.guardian.traits = { speed: 1 }; }, /concept "guardian"'s traits:.*SCHEMA ARRAY/s],
        ['a trait with no why', (t) => { t.guardian.traits[0].why = ''; }, /traits: parameter "toughness" carries no/],
        ['weaponCategories on a non-item', (t) => { t.guardian.weaponCategories = ['sword']; }, /concept "guardian" is an enemy and declares `weaponCategories`/],
        ['an undeclared weapon category', (t) => { t.sword.weaponCategories = ['laser']; }, /weapon category "laser", which the "weaponCategories" registry does not declare/],
        ['an empty weaponCategories', (t) => { t.sword.weaponCategories = []; }, /non-empty list/],
        ['a category named twice', (t) => { t.sword.weaponCategories = ['sword', 'sword']; }, /twice/],
        ['defence on an item', (t) => { t.swim.defence = { sword: 'damage' }; }, /concept "swim" is an item and declares a `defence`/],
        ['a defence keyed by an undeclared category', (t) => { t.guardian.defence = { laser: 'damage' }; }, /category "laser", which the "weaponCategories" registry/],
        ['an undeclared response', (t) => { t.guardian.defence = { sword: 'explodeHarder' }; }, /response "explodeHarder", which the "defenceResponses" registry/],
        ['a response param it does not declare', (t) => { t.guardian.defence = { sword: { response: 'damage', level: 2 } }; }, /gives "level", which it does not declare — it declares \[factor\]/],
        ['a response param out of its range', (t) => { t.guardian.defence = { sword: { response: 'damage', factor: 9 } }; }, /gives "factor" the value 9, which is not in its domain \(the range 0..4/],
        ['a malformed defence entry', (t) => { t.guardian.defence = { sword: 7 }; }, /defence against "sword" is 7/],
        ['triggers on an item', (t) => { t.sword.triggers = [{ kind: 'counter' }]; }, /declares `triggers`/],
        ['triggers on an enemy', (t) => { t.guardian.triggers = [{ kind: 'counter' }]; }, /is an enemy and declares `triggers`/],
        ['an undeclared tile trigger', (t) => { t.water.triggers = [{ kind: 'moonphase' }]; }, /trigger 0 is the kind "moonphase"/],
        ['a trigger with no kind', (t) => { t.water.triggers = [{ count: 2 }]; }, /trigger 0 has no `kind`/],
        ['an itemCategory trigger naming an undeclared category', (t) => { t.water.triggers = [{ kind: 'itemCategory', category: 'laser' }]; }, /not an id the "weaponCategories" registry declares/],
        // ⛓ MUTANT (e): a defended category nothing in the table produces.
        ['(e) guardian defends against fire, and no item produces fire', (t) => { t.guardian.defence = { fire: 'damage' }; },
            /concept "guardian"'s defence names the category "fire", and no item concept produces it/],
    ];
    it.each(bad)('refuses %s', (_label, mutate, re) => {
        const t = behaviourTable();
        mutate(t);
        throwsNaming(() => assertConceptTable(t), re);
    });
});

describe('P2 D3 — a realisation\'s `blocks` (a TEST DOUBLE; no shipped realisation implements one)', () => {
    it('the block double passes, and blocksImplementedBy lists it in declared order', () => {
        const t = behaviourTable();
        expect(() => assertRealisations(blockDouble(), t)).not.toThrow();
        expect(blocksImplementedBy(blockDouble(), t)).toEqual([
            { concept: 'guardian', block: 'chase', family: 'movement' },
            { concept: 'guardian', block: 'contact', family: 'attack' },
            { concept: 'guardian', block: 'hp', family: 'defence' },
        ]);
        expect(blocksImplementedBy(blockDouble().conceptRealisations, t)).toEqual(blocksImplementedBy(blockDouble(), t));
        expect(blocksImplementedBy(double(), t)).toEqual([]);
        expect(blocksImplementedBy({ id: 'bare' }, t)).toEqual([]);
    });

    const bad = [
        ['blocks that are not an object', (e) => { e.conceptRealisations.guardian.blocks = ['chase']; }, /`blocks` is not an object keyed by block id/],
        ['an undeclared block', (e) => { e.conceptRealisations.guardian.blocks = { teleport: {} }; }, /implements the block "teleport", which the "blocks" registry does not declare/],
        ['a field the block does not declare', (e) => { e.conceptRealisations.guardian.blocks = { chase: { colour: 'red' } }; }, /block "chase" field "colour" — the block declares no such field; it declares \[speed, range\]/],
        // ⛓ MUTANT (f): a trait the concept does not declare.
        ['(f) a {trait} naming no declared trait', (e) => { e.conceptRealisations.guardian.blocks = { chase: { speed: { trait: 'nope' } } }; },
            /block "chase" field "speed" reads the trait "nope", which the concept does not declare — it declares \[toughness, speed\]/],
        // ⛓ MUTANT (g): a string into a range field.
        ['(g) a string into a range field', (e) => { e.conceptRealisations.guardian.blocks = { chase: { range: 'fast' } }; },
            /block "chase" field "range" was given "fast", which is not in its domain — the field is range \(the range 0..20 \(unstepped\)\)/],
        ['an open trait onto a range field', (e, t) => {
            t.guardian.traits.push({ key: 'kind', open: 'string', default: 'x', why: 'x' });
            e.conceptRealisations.guardian.blocks = { chase: { speed: { trait: 'kind' } } };
        }, /an open trait cannot feed a range field/],
        ['a range trait wider than its field', (e) => { e.conceptRealisations.guardian.blocks = { melee: { reach: { trait: 'toughness' } } }; },
            /the trait's the range 1..5 \(unstepped\) is not inside the field's the range 0..3/],
        ['an unstepped trait onto a stepped field', (e) => { e.conceptRealisations.guardian.blocks = { hp: { health: { trait: 'toughness' } } }; },
            /an unstepped trait cannot feed the stepped field the range 1..50 step 1/],
        ['an open-id field given an undeclared id', (e) => { e.conceptRealisations.guardian.blocks = { onHit: { category: 'laser' } }; },
            /field "category" was given "laser", which is not an id the "weaponCategories" registry declares/],
    ];
    it.each(bad)('refuses %s', (_label, mutate, re) => {
        const e = blockDouble();
        const t = behaviourTable();
        mutate(e, t);
        throwsNaming(() => assertRealisations(e, t), re);
    });

    it('a stepped trait onto a stepped field whose values it stays within passes', () => {
        const e = blockDouble();
        const t = behaviourTable();
        t.guardian.traits.push({ key: 'hits', range: { min: 1, max: 5, step: 1 }, default: 2, why: 'x' });
        e.conceptRealisations.guardian.blocks = { hp: { health: { trait: 'hits' } } };
        expect(() => assertRealisations(e, t)).not.toThrow();
    });
});
