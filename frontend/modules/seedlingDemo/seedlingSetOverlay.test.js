/**
 * seedlingDemo/seedlingSetOverlay — **THE AUTHORED HALF, AS DATA** (EDITOR v3
 * slice D1; plan §16.3, §20).
 *
 * ⛓⛓ THE CLAIM WORTH GATING is that the overlay is DATA and stays data: the
 * derivation wants a CLOSURE (`locationGuard`), a session's identity is JSON,
 * and the bridge between them is built on every derivation and stored never. A
 * mutant that stores the closure passes every functional row here and fails
 * `canonicalJson` equality — so that row is the one this file exists for.
 */

import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../procgenCore/editCore.js';
import {
    OVERLAY_SCHEMA_VERSION, SeedlingSetOverlayError, assertOverlay, emptyOverlay,
    exitRuleKey, exitRulesByRoom, locationRuleKey, overlayErrors, overlayLocationNames,
    overlayToDeriveInput, parseRuleTarget, renumberOverlay,
} from './seedlingSetOverlay.js';

const HAS_LIGHT = { rule: 'Has', args: { item: 'Light', count: 1 } };

const overlay = (rooms, rest = {}) => ({
    schema_version: OVERLAY_SCHEMA_VERSION, rooms, ...rest,
});

const row = (name, item = 'Light', entity = { type: 'torchpickup', x: 64, y: 48 }) => ({
    entity, name, vanilla_item: item,
});

describe('the rule-target key names ONE namespace, and a bare key is refused', () => {
    it('reads both prefixes', () => {
        expect(parseRuleTarget('exit:out_teleporter_32_32'))
            .toEqual({ kind: 'exit', id: 'out_teleporter_32_32' });
        expect(parseRuleTarget('loc:Seventh Torch')).toEqual({ kind: 'loc', id: 'Seventh Torch' });
        expect(exitRuleKey('in_L5_128_128')).toBe('exit:in_L5_128_128');
        expect(locationRuleKey('Chest')).toBe('loc:Chest');
    });

    /**
     * ⛔ THE REFUSAL IS THE POINT, and the reason is measurable rather than
     * stylistic: an exit id and a location name are BOTH free-form strings, so
     * a bare key that happens to look like an exit id is indistinguishable from
     * a location somebody named that. The prefix makes the collision impossible
     * instead of unlikely.
     */
    it('REFUSES a bare key, naming both prefixes', () => {
        expect(() => parseRuleTarget('out_teleporter_32_32'))
            .toThrow(/carries neither "exit:" nor "loc:"/);
        expect(() => parseRuleTarget('exit:')).toThrow(/prefix and nothing after it/);
        expect(() => parseRuleTarget('')).toThrow(/a rule target is a non-empty string/);
    });

    it('a location may be named exactly like an exit id and the two do not collide', () => {
        const doc = overlay({
            0: {
                locations: [row('out_teleporter_32_32')],
                rules: {
                    'loc:out_teleporter_32_32': HAS_LIGHT,
                    'exit:out_teleporter_32_32': { rule: 'True_' },
                },
            },
        });
        expect(overlayErrors(doc, { roomCount: 1 })).toEqual([]);
        expect(exitRulesByRoom(doc).get(0).get('out_teleporter_32_32')).toEqual({ rule: 'True_' });
        const guard = overlayToDeriveInput(doc).locationGuard('0:out_teleporter_32_32');
        expect(guard.condition).toEqual(HAS_LIGHT);
    });
});

describe('the shape check refuses BY NAME and never coerces', () => {
    it('an empty overlay is well formed', () => {
        expect(overlayErrors(emptyOverlay())).toEqual([]);
        expect(emptyOverlay().schema_version).toBe(OVERLAY_SCHEMA_VERSION);
    });

    /**
     * ⛔ AN UNKNOWN FIELD IS AN ERROR, not carried. D0b measured that a draft-07
     * object is OPEN by default and that declaring a field without closing the
     * object asserts nothing ([[feedback_header_warning_is_not_a_check]]); this
     * checker is hand-written precisely so the closure is not optional.
     */
    it('refuses an undeclared field at both levels', () => {
        expect(overlayErrors(overlay({}, { notes: 'hi' })))
            .toEqual([expect.stringContaining('overlay.notes is not a declared field')]);
        expect(overlayErrors(overlay({ 0: { colour: 'red' } })))
            .toEqual([expect.stringContaining('overlay.rooms[0].colour is not a declared field')]);
    });

    /**
     * ⛔ THE KEY IS A ROOM INDEX AND JSON MAKES IT A STRING. `"03"` and `"3.0"`
     * both `Number()` to 3, so a reader that coerced them would key an overlay
     * onto a room the author never named — and the two spellings would then
     * both be room 3 with only one of them surviving a re-key.
     */
    it('refuses a room key that is not a plain decimal index', () => {
        for (const key of ['03', '3.0', 'three', '-1', ' 3']) {
            expect(overlayErrors(overlay({ [key]: {} })), key)
                .toEqual([expect.stringContaining('must be a decimal room index')]);
        }
        expect(overlayErrors(overlay({ 0: {}, 12: {} }))).toEqual([]);
    });

    it('refuses a room index past the end when the room count is known', () => {
        expect(overlayErrors(overlay({ 7: {} }), { roomCount: 3 }))
            .toEqual([expect.stringContaining('room 7 does not exist (the set has 3)')]);
        expect(overlayErrors(overlay({ 2: {} }), { roomCount: 3 })).toEqual([]);
    });

    it('a location row needs an entity in PIXELS, a name and an item', () => {
        expect(overlayErrors(overlay({ 0: { locations: [{ name: 'a', vanilla_item: 'Light' }] } })))
            .toEqual([expect.stringContaining('.entity must be {type, x, y}')]);
        expect(overlayErrors(overlay({ 0: { locations: [row('a', '')] } })))
            .toEqual([expect.stringContaining('vanilla_item must be a non-empty string')]);
        // ⚠ a FLOAT is refused too: the OEL attribute is an integer and a
        //   near-miss would never match the element it is meant to address
        expect(overlayErrors(overlay({ 0: { locations: [row('a', 'Light', { type: 't', x: 1.5, y: 0 })] } })))
            .toEqual([expect.stringContaining('.entity must be {type, x, y}')]);
    });

    /**
     * ⛓⛓ GLOBAL, NOT PER ROOM. `regionAtlasCompiler` allocates AP location ids
     * from `loc.name` ALONE, so two locations sharing a name collapse to ONE id
     * and the second's item is lost — and the derivation prefixes the LEVEL,
     * which a `reorder` moves, so the uniqueness has to be asked of the
     * AUTHORED name that a reorder never touches.
     */
    it('refuses a duplicate location name ACROSS rooms', () => {
        const errors = overlayErrors(overlay({
            0: { locations: [row('Chest')] },
            4: { locations: [row('Chest')] },
        }));
        expect(errors).toEqual([expect.stringContaining('duplicates overlay.rooms[0]')]);
        // ⛔ and NOT vacuous: two DIFFERENT names in the same two rooms pass
        expect(overlayErrors(overlay({
            0: { locations: [row('Chest')] }, 4: { locations: [row('Other Chest')] },
        }))).toEqual([]);
    });

    it('refuses a region outside Message.as\'s CLOSED seven-title table', () => {
        expect(overlayErrors(overlay({}, { regions: [0, 7] }))).toEqual([]);
        expect(overlayErrors(overlay({}, { regions: [0, 8] })))
            .toEqual([expect.stringContaining('outside 0..7')]);
        expect(overlayErrors(overlay({}, { regions: [-1] })))
            .toEqual([expect.stringContaining('outside 0..7')]);
    });

    it('assertOverlay throws its own class, quoting every error', () => {
        expect(() => assertOverlay(overlay({}, { notes: 1 }))).toThrow(SeedlingSetOverlayError);
        expect(() => assertOverlay({ rooms: {} })).toThrow(/schema_version must be 1/);
    });
});

describe('⛓⛓⛓ the bridge BUILDS the closure and STORES it never', () => {
    const doc = overlay({
        2: { locations: [row('Torch'), row('Chest', 'Seal', { type: 'chest', x: 32, y: 32 })] },
        4: { locations: [row('Gated', 'Wand')], rules: { 'loc:Gated': HAS_LIGHT } },
    }, { neverEnter: [5] });

    it('the rows come out ENTITY-ADDRESSED, one per authored location', () => {
        const { locations } = overlayToDeriveInput(doc);
        expect(locations.map((l) => l.id)).toEqual(['2:Torch', '2:Chest', '4:Gated']);
        expect(locations.every((l) => l.kind === 'entity')).toBe(true);
        expect(locations[1]).toEqual({
            id: '2:Chest', kind: 'entity', level: 2,
            entity: { type: 'chest', x: 32, y: 32 }, label: 'Chest', vanilla_item: 'Seal',
        });
    });

    it('locationGuard answers for the gated row and null for the rest', () => {
        const { locationGuard } = overlayToDeriveInput(doc);
        expect(locationGuard('4:Gated').condition).toEqual(HAS_LIGHT);
        expect(locationGuard('2:Torch')).toBeNull();
        expect(locationGuard('nothing at all')).toBeNull();
    });

    /**
     * ⛔⛔⛔ **THE ROW THIS FILE EXISTS FOR, AND MEASURING IT SHARPENED THE
     * CLAIM.** The design note said a stored closure would be invisible to
     * `canonicalJson` because `JSON.stringify` of a function is `undefined`.
     * MEASURED: `editCore.canonicalJson` is `JSON.stringify(value) ?? 'null'`
     * for a non-object, so a function does not vanish — it renders as
     * **`"locationGuard":null`, KEY AND ALL**. Which is worse, and is exactly
     * the hazard: an overlay that STORED its guard would compare EQUAL to one
     * storing a completely different guard, so two sessions whose location
     * rules disagree would be "the same set", `foldEdits` would drop the
     * authoring op as a no-op, and the edit would never reach the payload.
     *
     * ⇒ the overlay holds DATA and the closure is built per derivation. The row
     * below is the discriminator: two guards that answer differently, identical
     * under the equality the session uses.
     */
    it('a STORED closure would be invisible to the session\'s own equality', () => {
        expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
        expect(canonicalJson(doc)).toBe(canonicalJson(JSON.parse(JSON.stringify(doc))));

        const bridged = overlayToDeriveInput(doc);
        expect(typeof bridged.locationGuard).toBe('function');
        expect(canonicalJson(bridged)).toContain('"locationGuard":null');

        // ⛔ TWO GUARDS THAT DISAGREE, INDISTINGUISHABLE UNDER canonicalJson
        const other = overlayToDeriveInput(overlay({
            2: { locations: [row('Torch'), row('Chest', 'Seal', { type: 'chest', x: 32, y: 32 })] },
            4: { locations: [row('Gated', 'Wand')], rules: { 'loc:Gated': { rule: 'True_' } } },
        }, { neverEnter: [5] }));
        expect(other.locationGuard('4:Gated').condition).not.toEqual(HAS_LIGHT);
        expect(canonicalJson({ locationGuard: bridged.locationGuard }))
            .toBe(canonicalJson({ locationGuard: other.locationGuard }));

        // …while the DATA the two were built from is plainly different
        expect(canonicalJson(doc)).not.toBe(canonicalJson(overlay({
            4: { rules: { 'loc:Gated': { rule: 'True_' } } },
        })));
    });

    it('neverEnter carries its levels and a cite for each', () => {
        const { neverEnter } = overlayToDeriveInput(doc);
        expect(neverEnter.levels).toEqual([5]);
        expect(neverEnter.cite[5]).toBe('authored in the set overlay');
        // absent when nothing is ruled, so the derivation's default applies
        expect(overlayToDeriveInput(emptyOverlay()).neverEnter).toBeUndefined();
    });

    it('exitRulesByRoom keeps EXIT rules and leaves location rules to the guard', () => {
        const mixed = overlay({
            1: { rules: { 'exit:out_teleporter_0_0': HAS_LIGHT, 'loc:Chest': HAS_LIGHT },
                locations: [row('Chest')] },
        });
        const byRoom = exitRulesByRoom(mixed);
        expect([...byRoom.keys()]).toEqual([1]);
        expect([...byRoom.get(1).keys()]).toEqual(['out_teleporter_0_0']);
    });

    it('overlayLocationNames maps every authored name to its room', () => {
        expect([...overlayLocationNames(doc)]).toEqual([['Torch', 2], ['Chest', 2], ['Gated', 4]]);
    });
});

describe('renumbering re-keys everything an index reaches', () => {
    const doc = overlay({
        0: { locations: [row('A')] },
        2: { locations: [row('B')], rules: { 'loc:B': HAS_LIGHT } },
    }, { neverEnter: [2], regions: [1, 0, 3] });

    it('a permutation moves the room keys, neverEnter and regions together', () => {
        const mapping = new Map([[0, 2], [1, 1], [2, 0]]);
        const { overlay: next, dropped } = renumberOverlay(doc, mapping);
        expect(dropped).toEqual([]);
        expect(Object.keys(next.rooms).sort()).toEqual(['0', '2']);
        expect(next.rooms['2'].locations[0].name).toBe('A');
        expect(next.rooms['0'].rules).toEqual({ 'loc:B': HAS_LIGHT });
        expect(next.neverEnter).toEqual([0]);
        expect(next.regions).toEqual([3, 0, 1]);
    });

    /**
     * ⛔ A DROPPED ROOM'S OVERLAY IS REPORTED, never silently lost. Losing an
     * authored location without saying so is the same class of quiet the
     * derivation's own lost-collectible throw exists to prevent.
     */
    it('a removed room\'s overlay is dropped AND named', () => {
        const mapping = new Map([[0, 0], [1, null], [2, 1]]);
        const { overlay: next, dropped } = renumberOverlay(doc, mapping);
        expect(dropped).toEqual([]);            // room 1 had no overlay
        expect(Object.keys(next.rooms).sort()).toEqual(['0', '1']);
        const withOne = overlay({ 1: { locations: [row('C')] } });
        expect(renumberOverlay(withOne, mapping).dropped).toEqual([1]);
        expect(renumberOverlay(withOne, mapping).overlay.rooms).toEqual({});
    });

    /**
     * ⛓ HOLES ARE WRITTEN OUT AS `0`, not left sparse: a sparse array becomes
     * `null`s in JSON and the document would then say something a reader has to
     * coerce rather than read.
     */
    it('a regions array with a hole comes back dense', () => {
        const mapping = new Map([[0, 0], [1, null], [2, 1]]);
        const { overlay: next } = renumberOverlay(overlay({}, { regions: [4, 5, 6] }), mapping);
        expect(next.regions).toEqual([4, 6]);
        const sparse = renumberOverlay(overlay({}, { regions: [4, 5, 6] }),
            new Map([[0, 2], [1, null], [2, 0]])).overlay.regions;
        expect(sparse).toEqual([6, 0, 4]);
        expect(JSON.parse(JSON.stringify(sparse))).toEqual(sparse);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR v3 E2a — THE LIFT IS BYTE-INERT ON BEHAVIOUR
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * §22.3: 10 of this module's 11 exported functions moved to
 * `procgenCore/setOverlay.js` and this file BINDS them. A lift is only worth
 * anything if the sentences did not move with it — an editor's refusal IS its
 * evidence channel, and a paraphrase introduced by a refactor is exactly the
 * kind of change no behavioural row would catch.
 *
 * ⛔⛔ **THE EXPECTATIONS BELOW WERE CAPTURED FROM THE MODULE AS IT STOOD AT
 * `0727d40df`, BEFORE THE LIFT** (a probe over the pre-lift file, diffed
 * against the post-lift one: 27 cases, byte-identical). They are therefore a
 * pin and not a fixed point — a row that asked the new module whether it
 * agreed with itself would pass for ever (trap 250).
 */
const CASES = [
  ['not an object', 5],
  ['bad version', { schema_version: 2, rooms: {} }],
  ['bad overlay_id', { schema_version: 1, overlay_id: '', rooms: {} }],
  ['undeclared field', { schema_version: 1, rooms: {}, nope: 1 }],
  ['rooms not object', { schema_version: 1, rooms: [] }],
  ['bad key', { schema_version: 1, rooms: { '03': {} } }],
  ['out of range', { schema_version: 1, rooms: { 5: {} } }],
  ['entry not object', { schema_version: 1, rooms: { 0: 7 } }],
  ['undeclared room field', { schema_version: 1, rooms: { 0: { notes: 'x' } } }],
  ['bad name', { schema_version: 1, rooms: { 0: { name: '' } } }],
  ['locations not array', { schema_version: 1, rooms: { 0: { locations: {} } } }],
  ['row not object', { schema_version: 1, rooms: { 0: { locations: [1] } } }],
  ['undeclared row field', { schema_version: 1, rooms: { 0: { locations: [{ name: 'a', vanilla_item: 'b', entity: { type: 't', x: 1, y: 2 }, extra: 1 }] } } }],
  ['row missing everything', { schema_version: 1, rooms: { 0: { locations: [{}] } } }],
  ['dup name', { schema_version: 1, rooms: { 0: { locations: [{ name: 'a', vanilla_item: 'i', entity: { type: 't', x: 0, y: 0 } }] }, 1: { locations: [{ name: 'a', vanilla_item: 'i', entity: { type: 't', x: 0, y: 0 } }] } } }],
  ['rules not object', { schema_version: 1, rooms: { 0: { rules: [] } } }],
  ['bare rule key', { schema_version: 1, rooms: { 0: { rules: { bare: { rule: 'True_' } } } } }],
  ['empty prefix', { schema_version: 1, rooms: { 0: { rules: { 'exit:': { rule: 'True_' } } } } }],
  ['bad rule node', { schema_version: 1, rooms: { 0: { rules: { 'exit:a': 3 } } } }],
  ['neverEnter bad', { schema_version: 1, rooms: {}, neverEnter: ['x'] }],
  ['neverEnter range', { schema_version: 1, rooms: {}, neverEnter: [9] }],
  ['regions bad', { schema_version: 1, rooms: {}, regions: ['x'] }],
  ['regions range', { schema_version: 1, rooms: {}, regions: [99] }],
];

describe('⛔⛔ every refusal SENTENCE survived the lift to procgenCore, verbatim', () => {
    const EXPECTED = new Map([
    ["not an object", [
        "overlay must be an object, got 5",
    ]],
    ["bad version", [
        "overlay.schema_version must be 1, got 2",
    ]],
    ["bad overlay_id", [
        "overlay.overlay_id must be a non-empty string when present",
    ]],
    ["undeclared field", [
        "overlay.nope is not a declared field — the overlay carries schema_version, overlay_id, rooms, neverEnter, regions and provenance",
    ]],
    ["rooms not object", [
        "overlay.rooms must be an object keyed by ROOM INDEX",
    ]],
    ["bad key", [
        "overlay.rooms[03]: the key must be a decimal room index with no leading zeros",
    ]],
    ["out of range", [
        "overlay.rooms[5]: room 5 does not exist (the set has 3)",
    ]],
    ["entry not object", [
        "overlay.rooms[0] must be an object",
    ]],
    ["undeclared room field", [
        "overlay.rooms[0].notes is not a declared field — a room overlay carries name, locations, rules",
    ]],
    ["bad name", [
        "overlay.rooms[0].name must be a non-empty string when present",
    ]],
    ["locations not array", [
        "overlay.rooms[0].locations must be an array",
    ]],
    ["row not object", [
        "overlay.rooms[0].locations[0] must be an object",
    ]],
    ["undeclared row field", [
        "overlay.rooms[0].locations[0].extra is not a declared field — a location row carries entity, name, vanilla_item",
    ]],
    ["row missing everything", [
        "overlay.rooms[0].locations[0].name must be a non-empty string",
        "overlay.rooms[0].locations[0].vanilla_item must be a non-empty string — an AP location with no item behind it is a location the fill cannot use",
        "overlay.rooms[0].locations[0].entity must be {type, x, y} with integer PIXEL coordinates — the same (x, y) the room's OEL element carries, so the row addresses one entity and not a class of them",
    ]],
    ["dup name", [
        "overlay.rooms[1].locations[0].name \"a\" duplicates overlay.rooms[0] — location names are unique across the SET",
    ]],
    ["rules not object", [
        "overlay.rooms[0].rules must be an object keyed by \"exit:<id>\" or \"loc:<name>\"",
    ]],
    ["bare rule key", [
        "overlay.rooms[0].rules: seedlingSetOverlay: rule target \"bare\" carries neither \"exit:\" nor \"loc:\". ⛔ REFUSED rather than guessed: an exit id and a location name are both free-form strings, so a bare key that happened to look like an exit id would silently author a rule on the wrong thing. The exit ids are the derivation's own (`out_<type>_<x>_<y>`, `in_L<from>_<x>_<y>`, `out_pit_<x>_<y>`, `in_pit_L<from>_<x>_<y>`); a location is named by the `mark-location` op's `name`, not by its AP name.",
    ]],
    ["empty prefix", [
        "overlay.rooms[0].rules: seedlingSetOverlay: rule target \"exit:\" carries the \"exit:\" prefix and nothing after it",
    ]],
    ["bad rule node", [
        "overlay.rooms[0].rules[\"exit:a\"] must be a Rule Builder node ({rule: \"<Kind>\", …})",
    ]],
    ["neverEnter bad", [
        "overlay.neverEnter must be an array of integer room indices",
    ]],
    ["neverEnter range", [
        "overlay.neverEnter names room 9, which does not exist",
    ]],
    ["regions bad", [
        "overlay.regions must be an array of integers, room index -> region",
    ]],
    ["regions range", [
        "overlay.regions[0] is 99, outside 0..7 — Message.as holds exactly seven titles and the table is CLOSED",
    ]],
    ]);

    it.each(CASES)('the messages for "%s" are unchanged', (label, doc) => {
        expect(overlayErrors(doc, { roomCount: 3 })).toEqual(EXPECTED.get(label));
    });

    it('⛓ the two THROWING doors kept their sentences too', () => {
        const thrown = (fn) => { try { fn(); return null; } catch (e) { return `${e.name}: ${e.message}`; } };
        const PINS = new Map([
    ["assert throw", "SeedlingSetOverlayError: seedlingSetOverlay: this overlay is not well formed — overlay.schema_version must be 1, got 2"],
    ["parse bare", "SeedlingSetOverlayError: seedlingSetOverlay: rule target \"bare\" carries neither \"exit:\" nor \"loc:\". ⛔ REFUSED rather than guessed: an exit id and a location name are both free-form strings, so a bare key that happened to look like an exit id would silently author a rule on the wrong thing. The exit ids are the derivation's own (`out_<type>_<x>_<y>`, `in_L<from>_<x>_<y>`, `out_pit_<x>_<y>`, `in_pit_L<from>_<x>_<y>`); a location is named by the `mark-location` op's `name`, not by its AP name."],
    ["parse empty", "SeedlingSetOverlayError: seedlingSetOverlay: a rule target is a non-empty string, got \"\""],
    ["parse null", "SeedlingSetOverlayError: seedlingSetOverlay: a rule target is a non-empty string, got null"],
        ]);
        expect(thrown(() => assertOverlay({ schema_version: 2, rooms: {} })))
            .toBe(PINS.get('assert throw'));
        expect(thrown(() => parseRuleTarget('bare'))).toBe(PINS.get('parse bare'));
        expect(thrown(() => parseRuleTarget(''))).toBe(PINS.get('parse empty'));
        expect(thrown(() => parseRuleTarget(null))).toBe(PINS.get('parse null'));
    });

    /**
     * ⛔ NON-VACUITY. Every case must actually produce at least one message, or
     * the pin would be 27 rows agreeing that nothing happened.
     */
    it('⛓ the pin is not vacuous — every case refuses something', () => {
        expect(CASES).toHaveLength(EXPECTED.size);
        for (const [label] of CASES) {
            expect(EXPECTED.get(label), label).toBeTruthy();
            expect(EXPECTED.get(label).length, label).toBeGreaterThan(0);
        }
    });

    /** ⛓ …and the refusal class is still SEEDLING's, not the core's default. */
    it('⛔ the ERROR CLASS is still this module\'s own', () => {
        let thrown = null;
        try { assertOverlay({ schema_version: 9, rooms: {} }); } catch (e) { thrown = e; }
        expect(thrown).toBeInstanceOf(SeedlingSetOverlayError);
        expect(thrown.name).toBe('SeedlingSetOverlayError');
    });
});
