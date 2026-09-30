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
