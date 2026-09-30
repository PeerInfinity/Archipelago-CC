/**
 * procgenCore/concepts — **THE SHIPPED TABLE, PINNED TO WHAT ALREADY SHIPS**
 * (concept library T0, D2).
 *
 * ⛓ The pins that prove the later migration is possible WITHOUT touching the
 * shared library: the six `door` instances render to exactly the shared
 * library's six doors, and the six `key` instances to its six keys — deep-equal
 * AND key order. The expectations are read off the shared library and off
 * `seedlingDemo/itemLabels.js`, never off this module's own output.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { ITEM_LABELS, itemLabelOf } from '../seedlingDemo/itemLabels.js';
import { CAPABILITY_STATEMENTS, itemTagFeatures } from './substrateCapabilities.js';
import { MAZE_CONCEPT_REALISATIONS } from '../mazeRoom/mazeConcepts.js';
import { TEXT_ADVENTURE_CONCEPT_REALISATIONS } from '../textAdventureSubstrateWrapper/textAdventureConceptRealisations.js';
import { DEFENCE_RESPONSES, WEAPON_CATEGORIES } from './behaviourBlocks.js';
import { domainKind } from './templateContract.js';
import {
    CONCEPTS, CONCEPT_ITEMS_FEATURE, assertConceptTable, assertRealisations, blocksImplementedBy, conceptsRealisedBy,
    instancesOf, itemRowsOf, itemTagsImpliedBy, normaliseDefence, obstacleRowsOf,
} from './concepts.js';

const FEATURE = 'colored_doors_and_keys';
const SHIPPED_DOORS = Object.values(DEFAULT_OBSTACLES).filter((o) => o.feature === FEATURE);
const SHIPPED_KEYS = Object.values(DEFAULT_ITEMS).filter((i) => i.feature === FEATURE);
const DOOR_ROWS = obstacleRowsOf(CONCEPTS.door, CONCEPTS);
const KEY_ROWS = itemRowsOf(CONCEPTS.key);

describe('the table', () => {
    it('holds the six trial concepts, frozen, and checks clean', () => {
        expect(Object.keys(CONCEPTS)).toEqual(['sword', 'swim', 'guardian', 'water', 'key', 'door']);
        expect(Object.isFrozen(CONCEPTS)).toBe(true);
        for (const c of Object.values(CONCEPTS)) expect(Object.isFrozen(c)).toBe(true);
        expect(() => assertConceptTable(CONCEPTS)).not.toThrow();
    });

    it('the shared library holds the coloured doors and keys the pins read, by id', () => {
        expect(SHIPPED_DOORS.map((d) => d.id)).toEqual(
            ['door_red', 'door_green', 'door_blue', 'door_yellow', 'door_purple', 'door_orange']);
        expect(SHIPPED_KEYS.map((k) => k.id)).toEqual(
            ['key_red', 'key_green', 'key_blue', 'key_yellow', 'key_purple', 'key_orange']);
    });

    it('key and door have six instances each, in the shared colour order', () => {
        expect(instancesOf(CONCEPTS.door).map((i) => i.id)).toEqual(SHIPPED_DOORS.map((d) => d.id));
        expect(instancesOf(CONCEPTS.key).map((i) => i.id)).toEqual(SHIPPED_KEYS.map((k) => k.id));
    });
});

describe('⛓ door ⇔ DEFAULT_OBSTACLES, key ⇔ DEFAULT_ITEMS (deep-equal, key order included)', () => {
    it.each(SHIPPED_DOORS.map((d) => [d.id]))('%s', (id) => {
        const want = DEFAULT_OBSTACLES[id];
        const got = DOOR_ROWS.find((r) => r.id === id);
        expect(got, `${id} rendered`).toEqual(want);
        expect(JSON.stringify(got), `${id} key order`).toBe(JSON.stringify(want));
    });

    it.each(SHIPPED_KEYS.map((k) => [k.id]))('%s', (id) => {
        const want = DEFAULT_ITEMS[id];
        const got = KEY_ROWS.find((r) => r.id === id);
        expect(got, `${id} rendered`).toEqual(want);
        expect(JSON.stringify(got), `${id} key order`).toBe(JSON.stringify(want));
    });

    it('the whole lists, in order', () => {
        expect(JSON.stringify(DOOR_ROWS)).toBe(JSON.stringify(SHIPPED_DOORS));
        expect(JSON.stringify(KEY_ROWS)).toBe(JSON.stringify(SHIPPED_KEYS));
    });
});

describe('⛓ sword and swim carry the names ITEM_LABELS carries', () => {
    it('hasSword → sword, canSwim → swim, hasFeather → swim ×2', () => {
        expect(itemLabelOf('hasSword')).toEqual({ item: CONCEPTS.sword.item.id, count: 1 });
        expect(itemLabelOf('canSwim')).toEqual({ item: CONCEPTS.swim.item.id, count: 1 });
        expect(itemLabelOf('hasFeather')).toEqual({ item: CONCEPTS.swim.item.id, count: 2 });
        expect(CONCEPTS.sword.item.name).toBe(ITEM_LABELS.hasSword);
        expect(CONCEPTS.swim.item.name).toBe(ITEM_LABELS.canSwim);
    });

    it('their id is their name (the AP name a rule\'s Has carries)', () => {
        for (const c of [CONCEPTS.sword, CONCEPTS.swim]) expect(c.item.id).toBe(c.item.name);
    });

    it('the relations say what the trial says: guardian ⇐ sword, water ⇐ swim, door ⇐ key', () => {
        expect(CONCEPTS.guardian.relations).toEqual({ weakness: ['sword'] });
        expect(CONCEPTS.water.relations).toEqual({ crossedWith: ['swim'] });
        expect(CONCEPTS.door.relations).toEqual({ openedBy: ['key'] });
    });
});

/* ─────────────────────── D4 — the chart's input ─────────────────────── */

/** The brief's substrate half, plus a coloured key/door pair, as a TEST DOUBLE. */
const DOUBLE = Object.freeze({
    id: 'double',
    conceptRealisations: {
        guardian: {
            tier: 'mechanic', art: null, placements: {
                gate: { effect: 'requires', needs: ['sword'], mechanic: { element: 'killgate' } },
                roaming: { effect: 'none', mechanic: { element: 'roam' } },
            },
        },
        water: {
            tier: 'skin', art: 'water tiles', placements: {
                gate: { effect: 'requires', needs: ['swim'] },
                shortcut: { effect: 'helps', needs: ['swim'] },
            },
        },
        sword: { tier: 'mechanic', flag: 'hasSword' },
        key: { tier: 'mechanic' },
        door: { tier: 'mechanic', placements: { gate: { effect: 'requires', needs: ['sword'] } } },
    },
});

describe('D4 — conceptsRealisedBy / itemTagsImpliedBy (the chart\'s INPUT, not a chart row)', () => {
    it('the double is well-formed', () => {
        expect(() => assertRealisations(DOUBLE, CONCEPTS)).not.toThrow();
    });

    it('conceptsRealisedBy: one row per realised concept, declared order, placements as {key, effect}', () => {
        expect(conceptsRealisedBy(DOUBLE, CONCEPTS)).toEqual([
            { concept: 'guardian', kind: 'enemy', tier: 'mechanic',
                placements: [{ key: 'gate', effect: 'requires' }, { key: 'roaming', effect: 'none' }] },
            { concept: 'water', kind: 'obstacle', tier: 'skin',
                placements: [{ key: 'gate', effect: 'requires' }, { key: 'shortcut', effect: 'helps' }] },
            { concept: 'sword', kind: 'item', tier: 'mechanic', placements: [] },
            { concept: 'key', kind: 'item', tier: 'mechanic', placements: [] },
            { concept: 'door', kind: 'obstacle', tier: 'mechanic', placements: [{ key: 'gate', effect: 'requires' }] },
        ]);
    });

    it('an entry that declares none realises nothing', () => {
        expect(conceptsRealisedBy({ id: 'bare' }, CONCEPTS)).toEqual([]);
        expect(itemTagsImpliedBy({ id: 'bare' }, CONCEPTS)).toEqual([]);
    });

    it('itemTagsImpliedBy: the feature of every realised or needed item concept — the SAME law itemTagFeatures reads', () => {
        // ⛓ T0b: sword/swim carry CONCEPT_ITEMS_FEATURE (guardian's need names it first).
        expect(itemTagsImpliedBy(DOUBLE, CONCEPTS)).toEqual([CONCEPT_ITEMS_FEATURE, FEATURE]);
        /* ⛓ the chart's own law, asked of an entry whose library items ARE the realised item concepts' rows */
        const libraryItems = Object.fromEntries(['sword', 'key']
            .flatMap((c) => itemRowsOf(CONCEPTS[c])).map((r) => [r.id, r]));
        expect(itemTagFeatures({ libraryItems, supportedFeatures: [] }, {})).toEqual(itemTagsImpliedBy(DOUBLE, CONCEPTS));
    });

    it('⛓ exactly one chart statement reads `conceptRealisations`: P6 (T0b, ⚖ the user 2026-09-29)', () => {
        expect(CAPABILITY_STATEMENTS.filter((s) => s.fields.some((f) => f.startsWith('conceptRealisations')))
            .map((s) => s.id)).toEqual(['P6']);
    });
});

/* ─────────────── behaviour parameters P2, D4 — the table's behaviour ─────────────── */

describe('P2 D4 — the behaviour the shipped table declares (on the EXISTING concepts, and nothing else)', () => {
    it('sword hits with the `sword` category; guardian answers it with `damage` (the default factor)', () => {
        expect(CONCEPTS.sword.weaponCategories).toEqual(['sword']);
        expect(WEAPON_CATEGORIES.has('sword')).toBe(true);
        expect(CONCEPTS.guardian.defence).toEqual({ sword: 'damage' });
        expect(normaliseDefence(CONCEPTS.guardian.defence.sword)).toEqual({ response: 'damage', params: {} });
        expect(DEFENCE_RESPONSES.get('damage').params[0]).toMatchObject({ key: 'factor', default: 1 });
    });

    it('guardian declares two range traits — toughness 1..5, speed 0..1 (a fraction of player speed) — each with a why', () => {
        expect(CONCEPTS.guardian.traits.map((t) => [t.key, domainKind(t), t.range])).toEqual([
            ['toughness', 'range', { min: 1, max: 5 }],
            ['speed', 'range', { min: 0, max: 1 }],
        ]);
        for (const t of CONCEPTS.guardian.traits) expect(t.why.length).toBeGreaterThan(20);
    });

    it('no other concept declares a P2 field; no concept declares `triggers` (water does not fit itemCategory — swim is not a weapon)', () => {
        const fields = ['traits', 'weaponCategories', 'defence', 'triggers'];
        const declared = Object.entries(CONCEPTS).flatMap(([id, c]) => fields.filter((f) => c[f] !== undefined).map((f) => `${id}.${f}`));
        expect(declared).toEqual(['sword.weaponCategories', 'guardian.traits', 'guardian.defence']);
        expect(WEAPON_CATEGORIES.has('swim')).toBe(false);
    });

    it('⛔ the two real realisations implement NO block — a skin implements no behaviour, and that absence is a correct value', () => {
        expect(blocksImplementedBy(MAZE_CONCEPT_REALISATIONS, CONCEPTS)).toEqual([]);
        expect(blocksImplementedBy(TEXT_ADVENTURE_CONCEPT_REALISATIONS, CONCEPTS)).toEqual([]);
        expect(() => assertRealisations({ conceptRealisations: MAZE_CONCEPT_REALISATIONS }, CONCEPTS)).not.toThrow();
        expect(() => assertRealisations({ conceptRealisations: TEXT_ADVENTURE_CONCEPT_REALISATIONS }, CONCEPTS)).not.toThrow();
    });

    /**
     * ⛓ MEASURED, NOT DERIVED: could `relations.weakness` be derived from
     * `defence`? A defended category whose response HARMS (not `ignore`, not
     * `knockOnly`) names the item concepts that produce it. On the shipped
     * table that derivation equals every declared weakness — ONE concept, so
     * it is a measurement, not a proof; P2 derives nothing.
     */
    it('weakness ⇐ defence, measured on the shipped table', () => {
        const harmless = new Set(['ignore', 'knockOnly']);
        const derived = (c) => {
            const cats = Object.entries(c.defence ?? {})
                .filter(([, raw]) => !harmless.has(normaliseDefence(raw).response)).map(([cat]) => cat);
            return Object.entries(CONCEPTS)
                .filter(([, i]) => i.kind === 'item' && (i.weaponCategories ?? []).some((x) => cats.includes(x)))
                .map(([id]) => id);
        };
        const withDefence = Object.entries(CONCEPTS).filter(([, c]) => c.defence);
        expect(withDefence.map(([id]) => id)).toEqual(['guardian']);
        for (const [id, c] of withDefence) expect(derived(c), id).toEqual([...(c.relations?.weakness ?? [])]);
    });

    it('the table still checks clean and stays frozen, the new fields included', () => {
        expect(() => assertConceptTable(CONCEPTS)).not.toThrow();
        expect(Object.isFrozen(CONCEPTS.guardian.traits)).toBe(true);
        expect(Object.isFrozen(CONCEPTS.guardian.defence)).toBe(true);
        expect(Object.isFrozen(CONCEPTS.sword.weaponCategories)).toBe(true);
    });
});
