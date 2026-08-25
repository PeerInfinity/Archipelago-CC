/**
 * procgenCore/setOverlay — **THE OVERLAY'S SHAPE, BOUND BY A SUBSTRATE THAT IS
 * NOT SEEDLING.**
 *
 * EDITOR v3 slice E2a. `seedlingSetOverlay.test.js` keeps every row it had (and
 * gained a 27-case pin that the LIFT changed no sentence); this file asks the
 * questions that only a SECOND binding can ask:
 *
 *   ·  does a substrate's own location ADDRESS reach the row check?
 *   ·  do its own top-level fields get checked AND re-keyed?
 *   ·  does the "not a declared field" sentence name THAT substrate's fields?
 *   ·  does a refusal carry THAT substrate's error class and module name?
 *
 * ⛔ The binding below is deliberately NOT imported from `mazeRoom/` — this
 * directory may not know which substrate it is on (`bindingContract.test.js`),
 * and a core test that reached for the maze's real binding would be asserting
 * the maze's decisions rather than the seam's.
 *
 * ⛓ EVERY CLAIM NAMES ITS MUTANT.
 */

import { describe, expect, it } from 'vitest';

import {
    BASE_LOCATION_FIELDS, OVERLAY_SCHEMA_VERSION, ROOM_OVERLAY_FIELDS, RULE_TARGET_PREFIXES,
    SetOverlayError, createSetOverlay, exitRuleKey, locationRuleKey,
} from './setOverlay.js';

class WidgetOverlayError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WidgetOverlayError';
    }
}

/**
 * ⛓ A substrate whose location is addressed by an INTEGER SLOT and which
 * carries one extra top-level field, `links`, whose entries name room indices —
 * so a renumbering has to reach INSIDE it, which no Seedling field does.
 */
const WIDGET = createSetOverlay({
    moduleName: 'widgetSetOverlay',
    ErrorClass: WidgetOverlayError,
    locationFields: ['slot', ...BASE_LOCATION_FIELDS],
    locationRowErrors: (row, label) => (Number.isInteger(row.slot) && row.slot >= 0
        ? [] : [`${label}.slot must be a non-negative integer slot index`]),
    exitIdHint: 'A widget exit id is `port_<n>`.',
    extraFields: {
        links: {
            errors: (value, { roomCount }) => {
                if (!Array.isArray(value)) return ['overlay.links must be an array'];
                return value.flatMap((l, i) => (
                    Number.isInteger(l?.from) && Number.isInteger(l?.to)
                        && (roomCount === null || (l.from < roomCount && l.to < roomCount))
                        ? [] : [`overlay.links[${i}] names a room that does not exist`]));
            },
            renumber: (value, mapping) => value
                .map((l) => ({ from: mapping.get(l.from), to: mapping.get(l.to) }))
                .filter((l) => l.from !== null && l.from !== undefined
                    && l.to !== null && l.to !== undefined),
        },
    },
});

const ok = (rooms, rest = {}) => ({
    schema_version: OVERLAY_SCHEMA_VERSION, rooms, ...rest,
});
const loc = (over = {}) => ({ slot: 0, name: 'prize', vanilla_item: 'Coin', ...over });

/* ══════════════════════════════════════════════════════════════════════
 * THE VOCABULARY IS THE TOOLKIT'S
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ the rule-target key is ONE spelling, built and never typed', () => {
    it('⛓ the two builders produce the two declared prefixes', () => {
        expect(exitRuleKey('port_1')).toBe(`${RULE_TARGET_PREFIXES[0]}port_1`);
        expect(locationRuleKey('prize')).toBe(`${RULE_TARGET_PREFIXES[1]}prize`);
        // ⛔ DERIVED: the prefix a reader strips is the builder's own empty key.
        expect(exitRuleKey('')).toBe(RULE_TARGET_PREFIXES[0]);
        expect(locationRuleKey('')).toBe(RULE_TARGET_PREFIXES[1]);
    });

    it('⛓ a prefixed key parses to its kind and its id', () => {
        expect(WIDGET.parseRuleTarget(exitRuleKey('port_1'))).toEqual({ kind: 'exit', id: 'port_1' });
        expect(WIDGET.parseRuleTarget(locationRuleKey('a:b'))).toEqual({ kind: 'loc', id: 'a:b' });
    });

    /**
     * ⛔⛔ MUTANT: a bare key is read as a location name. Nothing stops a person
     * naming a location `port_1`, so the rule would silently land on the wrong
     * thing and NOTHING downstream could tell.
     */
    it('⛔⛔ a BARE key refuses, in THIS substrate\'s module name and error class', () => {
        let thrown = null;
        try { WIDGET.parseRuleTarget('port_1'); } catch (e) { thrown = e; }
        expect(thrown).toBeInstanceOf(WidgetOverlayError);
        expect(thrown.message).toMatch(/^widgetSetOverlay: /);
        expect(thrown.message).toMatch(/carries neither "exit:" nor "loc:"/);
        // ⛓ …and the hint is the SUBSTRATE's, because the mistake it catches is
        //   a person typing THIS substrate's exit id.
        expect(thrown.message).toMatch(/A widget exit id is `port_<n>`\./);
        expect(thrown.message).not.toMatch(/out_pit_/);
    });

    it('⛔ a prefix with nothing after it refuses, and so does a non-string', () => {
        expect(() => WIDGET.parseRuleTarget('exit:')).toThrow(/prefix and nothing after it/);
        expect(() => WIDGET.parseRuleTarget(null)).toThrow(/a non-empty string/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE SHAPE CHECK
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ the shape check is the toolkit\'s, the ADDRESS is the substrate\'s', () => {
    it('⛓ a well-formed overlay produces no errors', () => {
        expect(WIDGET.overlayErrors(ok({
            0: { name: 'first', locations: [loc()], rules: { [exitRuleKey('port_0')]: { rule: 'True_' } } },
        }, { links: [{ from: 0, to: 1 }] }), { roomCount: 2 })).toEqual([]);
        expect(WIDGET.overlayErrors(WIDGET.emptyOverlay())).toEqual([]);
    });

    /**
     * ⛔⛔ MUTANT: the core keeps Seedling's `entity` check. Every maze location
     * row would then be refused for lacking a field the maze has no notion of,
     * and the editor would be unusable on the substrate the lift exists for.
     */
    it('⛔⛔ the location row\'s ADDRESS is checked by the SUBSTRATE\'s own function', () => {
        const errors = WIDGET.overlayErrors(ok({ 0: { locations: [loc({ slot: -1 })] } }));
        expect(errors).toEqual(['overlay.rooms[0].locations[0].slot must be a non-negative '
            + 'integer slot index']);
        // ⛓ …and a row carrying SEEDLING's address is refused as undeclared here.
        expect(WIDGET.overlayErrors(ok({ 0: { locations: [loc({ entity: { type: 't', x: 0, y: 0 } })] } })))
            .toEqual(['overlay.rooms[0].locations[0].entity is not a declared field — a location '
                + 'row carries slot, name, vanilla_item']);
    });

    it('⛓ `name` and `vanilla_item` are asked of EVERY substrate\'s row', () => {
        expect(WIDGET.overlayErrors(ok({ 0: { locations: [{ slot: 0 }] } }))).toEqual([
            'overlay.rooms[0].locations[0].name must be a non-empty string',
            'overlay.rooms[0].locations[0].vanilla_item must be a non-empty string — an AP '
                + 'location with no item behind it is a location the fill cannot use',
        ]);
    });

    it('⛓⛓ location names are unique across the SET, not per room', () => {
        const errors = WIDGET.overlayErrors(ok({
            0: { locations: [loc({ name: 'dup' })] },
            1: { locations: [loc({ name: 'dup' })] },
        }));
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/duplicates overlay\.rooms\[0\]/);
    });

    /**
     * ⛔⛔ MUTANT: the declared-field list is the core's four plus nothing. The
     * maze's `links` — the ONE place a region library is allowed to keep its
     * wiring — would be refused as undeclared by the module that must hold it.
     */
    it('⛔⛔ the declared top-level fields are the envelope PLUS this substrate\'s own, '
        + 'in reading order', () => {
        expect(WIDGET.DECLARED_FIELDS)
            .toEqual(['schema_version', 'overlay_id', 'rooms', 'links', 'provenance']);
        expect(WIDGET.overlayErrors(ok({}, { nope: 1 }))).toEqual([
            'overlay.nope is not a declared field — the overlay carries schema_version, '
                + 'overlay_id, rooms, links and provenance',
        ]);
        // ⛓ …and `links` itself is NOT refused, which is the other half.
        expect(WIDGET.overlayErrors(ok({}, { links: [] }))).toEqual([]);
    });

    it('⛓ an extra field\'s OWN check runs, and sees the room count', () => {
        expect(WIDGET.overlayErrors(ok({}, { links: 'no' }))).toEqual(['overlay.links must be an array']);
        expect(WIDGET.overlayErrors(ok({}, { links: [{ from: 0, to: 9 }] }), { roomCount: 2 }))
            .toEqual(['overlay.links[0] names a room that does not exist']);
    });

    it('⛓ the room key must be a decimal index, and must name a room that exists', () => {
        expect(WIDGET.overlayErrors(ok({ '03': {} }))[0]).toMatch(/decimal room index/);
        expect(WIDGET.overlayErrors(ok({ 5: {} }), { roomCount: 2 })[0])
            .toMatch(/room 5 does not exist \(the set has 2\)/);
    });

    it('⛓ a room overlay carries exactly three fields, and a rule must be a Rule Builder node', () => {
        expect(WIDGET.overlayErrors(ok({ 0: { notes: 'x' } }))[0])
            .toMatch(new RegExp(`a room overlay carries ${ROOM_OVERLAY_FIELDS.join(', ')}`));
        expect(WIDGET.overlayErrors(ok({ 0: { rules: { [exitRuleKey('p')]: 3 } } }))[0])
            .toMatch(/must be a Rule Builder node/);
        expect(WIDGET.overlayErrors(ok({ 0: { rules: { bare: { rule: 'True_' } } } }))[0])
            .toMatch(/overlay\.rooms\[0\]\.rules: widgetSetOverlay: rule target "bare"/);
    });

    it('⛔ `assertOverlay` throws THIS substrate\'s class and quotes every error', () => {
        let thrown = null;
        try {
            WIDGET.assertOverlay(ok({ 0: { locations: [{ slot: -1 }] } }));
        } catch (e) { thrown = e; }
        expect(thrown).toBeInstanceOf(WidgetOverlayError);
        expect(thrown.message).toMatch(/^widgetSetOverlay: this overlay is not well formed — /);
        expect(thrown.message.split(' · ')).toHaveLength(3);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * RENUMBERING
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ a renumbering re-keys the rooms AND every substrate field', () => {
    const OVERLAY = ok(
        { 0: { name: 'a' }, 1: { name: 'b' }, 2: { name: 'c' } },
        { links: [{ from: 0, to: 2 }, { from: 1, to: 2 }] },
    );
    const MAPPING = new Map([[0, 2], [1, null], [2, 0]]);

    it('⛓ a room whose index moved is re-keyed; one that is gone is DROPPED and counted', () => {
        const { overlay, dropped } = WIDGET.renumberOverlay(OVERLAY, MAPPING);
        expect(overlay.rooms).toEqual({ 0: { name: 'c' }, 2: { name: 'a' } });
        expect(dropped).toEqual([1]);
    });

    /**
     * ⛔⛔ MUTANT: the extra fields are carried through the spread UNTOUCHED.
     * The maze's links would then point at whatever room happened to land on
     * the old index — the reorder would silently rewire the world, which is the
     * one thing a reorder must not do.
     */
    it('⛔⛔ the substrate\'s own field is re-keyed by ITS OWN `renumber`, not spread through', () => {
        const { overlay } = WIDGET.renumberOverlay(OVERLAY, MAPPING);
        expect(overlay.links).toEqual([{ from: 2, to: 0 }]);
        // ⛓ …the link that touched the DEAD room is gone, not left dangling.
        expect(overlay.links.some((l) => l.from === null || l.to === null)).toBe(false);
    });

    it('⛓ a field the overlay does not carry is not invented', () => {
        const { overlay } = WIDGET.renumberOverlay(ok({ 0: {} }), new Map([[0, 0]]));
        expect(Object.hasOwn(overlay, 'links')).toBe(false);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE READERS
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ the three readers', () => {
    const OVERLAY = ok({
        2: {
            locations: [loc({ name: 'gem' })],
            rules: { [exitRuleKey('port_0')]: { rule: 'A' }, [locationRuleKey('gem')]: { rule: 'B' } },
        },
        0: { locations: [loc({ name: 'coin' })] },
    });

    it('⛓⛓ `exitRulesByRoom` keeps the EXIT rules and leaves the location rules alone — a '
        + 'location\'s rule is attached while the location is being built', () => {
        const byRoom = WIDGET.exitRulesByRoom(OVERLAY);
        expect([...byRoom.keys()]).toEqual([2]);
        expect([...byRoom.get(2)]).toEqual([['port_0', { rule: 'A' }]]);
    });

    it('⛓ the room indices come back as NUMBERS, ascending', () => {
        expect(WIDGET.overlayRoomIndices(OVERLAY)).toEqual([0, 2]);
        expect(WIDGET.overlayRoomIndices({})).toEqual([]);
    });

    /**
     * ⛓⛓ ⚠ THE ORDER IS THE ENGINE'S, NOT THE DOCUMENT'S. `overlay.rooms` is
     * keyed by a decimal index, and JS iterates integer-like own keys in
     * ASCENDING NUMERIC order whatever order the JSON wrote them in — so this
     * asserts the SET plus the fact that it is index-ordered, and never the
     * order the fixture happens to be typed in
     * ([[feedback_grouping_reorders_so_assert_the_set]]).
     */
    it('⛓ every authored location name, with the room it sits in', () => {
        const names = WIDGET.overlayLocationNames(OVERLAY);
        expect(Object.fromEntries(names)).toEqual({ gem: 2, coin: 0 });
        expect([...names.values()]).toEqual([0, 2]);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE BINDING'S OWN REFUSALS
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛔ `createSetOverlay` refuses a binding that cannot work', () => {
    it('⛔ a binding with no `moduleName` refuses — a refusal must name a file to open', () => {
        expect(() => createSetOverlay({ locationFields: ['name', 'vanilla_item'] }))
            .toThrow(SetOverlayError);
        expect(() => createSetOverlay({ locationFields: ['name', 'vanilla_item'] }))
            .toThrow(/needs a `moduleName`/);
    });

    /**
     * ⛔⛔ MUTANT: `locationFields` defaults to Seedling's three. The next
     * substrate would then silently inherit an address it does not have, and
     * the refusal it produced would name a field nobody could supply.
     */
    it('⛔⛔ there is NO default location address — the substrate must declare one', () => {
        expect(() => createSetOverlay({ moduleName: 'x' })).toThrow(/must declare `locationFields`/);
        expect(() => createSetOverlay({ moduleName: 'x', locationFields: [] }))
            .toThrow(/must declare `locationFields`/);
    });

    it('⛔ …but the two fields EVERY row carries are still required of it', () => {
        for (const missing of BASE_LOCATION_FIELDS) {
            const fields = BASE_LOCATION_FIELDS.filter((f) => f !== missing);
            expect(() => createSetOverlay({ moduleName: 'x', locationFields: fields }), missing)
                .toThrow(new RegExp(`omits "${missing}"`));
        }
    });

    it('⛓ a binding that declares no extra fields gets the bare envelope', () => {
        const bare = createSetOverlay({ moduleName: 'bare', locationFields: [...BASE_LOCATION_FIELDS] });
        expect(bare.DECLARED_FIELDS)
            .toEqual(['schema_version', 'overlay_id', 'rooms', 'provenance']);
        expect(bare.overlayErrors(ok({}, { links: [] }))[0]).toMatch(/links is not a declared field/);
    });
});
