/**
 * procgenCore/labProtocol — **THE VOCABULARY'S OWN GATE.**
 *
 * CONSTRUCTIVE-MODE arc, slice 4. ⛔ Every validator is driven twice: once with
 * the documented shape (it must PASS) and once per field with that field
 * REMOVED (it must refuse BY NAME). The by-name half is the point — a
 * validator that threw a generic "bad payload" would tell a reader that
 * something is wrong with a message and not which half of the boundary wrote
 * it, which on a postMessage seam is the difference between a fix and a hunt.
 *
 * ⛓ AND ONCE MORE WITH AN EXTRA FIELD. That is the shape a MISSPELLING takes
 * here (`iframeid` arrives as an unexpected extra beside a missing required
 * one), and a validator that only checked for absences would report the
 * symptom and hide the cause.
 */

import { describe, expect, it } from 'vitest';

import {
    ADDRESS_FIELDS, HOST_TO_PAGE, LAB_EVENTS, LAB_EVENT_PREFIX, LAB_PAYLOAD_FIELDS,
    LAB_VALIDATORS, LabProtocolError, PAGE_TO_HOST, SUBSTRATES, addressedTo, assertLabPayload,
    assertLevelChanged, assertLoad, assertNavigate, assertReady, assertRequestState,
    assertSelectTile, assertStateChanged,
} from './labProtocol.js';

/** ⛓ ONE GOOD PAYLOAD PER EVENT, spelled out — never derived from the field
 *  list, because a fixture built from the code under test is a fixed point. */
const GOOD = Object.freeze({
    [LAB_EVENTS.load]: {
        substrate: 'maze', iframeId: 'procgenLab-maze-1', payload: { seed: 3, level: {} },
    },
    [LAB_EVENTS.navigate]: {
        substrate: 'maze', iframeId: 'procgenLab-maze-1', search: 'seed=5&count=2',
    },
    [LAB_EVENTS.requestState]: {
        substrate: 'seedling', iframeId: 'procgenLab-seedling-1',
    },
    [LAB_EVENTS.ready]: {
        substrate: 'seedling', iframeId: 'procgenLab-seedling-1',
        url: 'http://x/frontend/modules/seedlingDemo/watch.html?source=generate',
    },
    [LAB_EVENTS.stateChanged]: {
        substrate: 'maze', iframeId: 'procgenLab-maze-1',
        url: 'http://x/frontend/modules/mazeRoom/lab.html?seed=3',
        source: 'generate', seed: 3, step: 4, identity: 'seed 3 · maze-v1 · 11x11',
        certified: true, edits: 0, directives: [],
    },
    [LAB_EVENTS.levelChanged]: {
        substrate: 'maze', iframeId: 'procgenLab-maze-1', payload: { level: { width: 11 } },
    },
    [LAB_EVENTS.selectTile]: {
        substrate: 'maze', iframeId: 'procgenLab-maze-1', tx: 3, ty: 7,
    },
});

const ALL_EVENTS = Object.values(LAB_EVENTS);

describe('labProtocol — the table itself', () => {
    it('names all seven events under the procgenLab: prefix, and nothing else', () => {
        expect(ALL_EVENTS).toHaveLength(7);
        for (const name of ALL_EVENTS) expect(name.startsWith(LAB_EVENT_PREFIX)).toBe(true);
        // ⛔ The two directions PARTITION the seven — an event in neither list
        // is one no `register()` declares, and one in both is a loop.
        expect([...HOST_TO_PAGE, ...PAGE_TO_HOST].sort()).toEqual([...ALL_EVENTS].sort());
        expect(HOST_TO_PAGE.filter((e) => PAGE_TO_HOST.includes(e))).toEqual([]);
    });

    it('gives every event a field list that starts with the ADDRESS', () => {
        for (const event of ALL_EVENTS) {
            const fields = LAB_PAYLOAD_FIELDS[event];
            expect(fields.slice(0, 2)).toEqual([...ADDRESS_FIELDS]);
        }
    });

    it('⛓ spells stateChanged with §3.5\'s ten fields, stated here independently', () => {
        expect([...LAB_PAYLOAD_FIELDS[LAB_EVENTS.stateChanged]]).toEqual([
            'substrate', 'iframeId', 'url', 'source', 'seed', 'step', 'identity',
            'certified', 'edits', 'directives',
        ]);
    });

    it('closes the substrate list at the two that have pages', () => {
        expect([...SUBSTRATES]).toEqual(['maze', 'seedling']);
    });
});

describe('labProtocol — every validator accepts its documented shape', () => {
    for (const event of ALL_EVENTS) {
        it(`${event} accepts the shape §3.5 documents`, () => {
            expect(() => LAB_VALIDATORS[event]({ ...GOOD[event] })).not.toThrow();
            expect(assertLabPayload(event, { ...GOOD[event] })).toEqual(GOOD[event]);
        });
    }
});

describe('labProtocol — every field REFUSES ITS ABSENCE, by name', () => {
    for (const event of ALL_EVENTS) {
        for (const field of LAB_PAYLOAD_FIELDS[event]) {
            it(`${event} without "${field}" refuses and names it`, () => {
                const payload = { ...GOOD[event] };
                delete payload[field];
                expect(() => LAB_VALIDATORS[event](payload))
                    .toThrow(new RegExp(`missing "${field}"`));
                expect(() => LAB_VALIDATORS[event](payload)).toThrow(LabProtocolError);
            });
        }
    }
});

describe('labProtocol — an EXTRA field refuses, because that is what a typo looks like', () => {
    for (const event of ALL_EVENTS) {
        it(`${event} with a misspelled iframeid refuses and names BOTH halves`, () => {
            const payload = { ...GOOD[event], iframeid: 'procgenLab-maze-1' };
            delete payload.iframeId;
            // ⛔ The MISSING one is reported first (it is the actionable half),
            // and the extra is caught on the corrected payload below — so both
            // arms of the check are driven rather than one masking the other.
            expect(() => LAB_VALIDATORS[event](payload)).toThrow(/missing "iframeId"/);
            expect(() => LAB_VALIDATORS[event]({ ...GOOD[event], iframeid: 'x' }))
                .toThrow(/unexpected field "iframeid"/);
        });
    }
});

describe('labProtocol — the ADDRESS is checked, not merely present', () => {
    it('refuses a substrate that has no page', () => {
        expect(() => assertLoad({ ...GOOD[LAB_EVENTS.load], substrate: 'bounce' }))
            .toThrow(/not one of \[maze, seedling\]/);
    });
    it('refuses an empty iframeId — an unaddressed payload reaches every frame', () => {
        expect(() => assertReady({ ...GOOD[LAB_EVENTS.ready], iframeId: '' }))
            .toThrow(/non-empty string/);
    });
    it('refuses a non-object payload before it looks at fields', () => {
        expect(() => assertLoad(null)).toThrow(/needs a payload object/);
        expect(() => assertLoad([])).toThrow(/needs a payload object/);
    });
    it('refuses an event name that is not one of the seven', () => {
        expect(() => assertLabPayload('procgenLab:teleport', {})).toThrow(/is not one of/);
    });
});

describe('labProtocol — the per-field types', () => {
    it('load.payload must be an object, and null is NOT a payload', () => {
        expect(() => assertLoad({ ...GOOD[LAB_EVENTS.load], payload: null }))
            .toThrow(/must be an object/);
        expect(() => assertLevelChanged({ ...GOOD[LAB_EVENTS.levelChanged], payload: '{}' }))
            .toThrow(/must be an object/);
    });

    it('navigate.search must be a string', () => {
        expect(() => assertNavigate({ ...GOOD[LAB_EVENTS.navigate], search: 5 }))
            .toThrow(/must be a string/);
    });

    it('⛓ stateChanged.certified accepts true, false AND null — three answers', () => {
        for (const certified of [true, false, null]) {
            expect(() => assertStateChanged({
                ...GOOD[LAB_EVENTS.stateChanged], certified,
            })).not.toThrow();
        }
        // ⛔ TRAP 262 AT THE BOUNDARY: `undefined` is not one of the three, and
        // accepting it would let a page that forgot the field look like a page
        // whose oracle refused.
        expect(() => assertStateChanged({
            ...GOOD[LAB_EVENTS.stateChanged], certified: undefined,
        })).toThrow(/certified must be true, false or null/);
        expect(() => assertStateChanged({
            ...GOOD[LAB_EVENTS.stateChanged], certified: 'yes',
        })).toThrow(/certified must be true, false or null/);
    });

    it('⛓ stateChanged.seed and .step accept null — an arm with no ladder', () => {
        expect(() => assertStateChanged({
            ...GOOD[LAB_EVENTS.stateChanged], seed: null, step: null,
        })).not.toThrow();
        expect(() => assertStateChanged({ ...GOOD[LAB_EVENTS.stateChanged], seed: 'three' }))
            .toThrow(/seed must be a finite number or null/);
    });

    it('stateChanged.edits is a NON-NEGATIVE integer', () => {
        expect(() => assertStateChanged({ ...GOOD[LAB_EVENTS.stateChanged], edits: -1 }))
            .toThrow(/non-negative integer/);
        expect(() => assertStateChanged({ ...GOOD[LAB_EVENTS.stateChanged], edits: 1.5 }))
            .toThrow(/non-negative integer/);
    });

    it('stateChanged.directives must be an array — empty is how "none" is spelled', () => {
        expect(() => assertStateChanged({ ...GOOD[LAB_EVENTS.stateChanged], directives: null }))
            .toThrow(/must be an array/);
    });

    it('selectTile coordinates are INTEGERS — a fractional one names no cell', () => {
        expect(() => assertSelectTile({ ...GOOD[LAB_EVENTS.selectTile], tx: 2.5 }))
            .toThrow(/must be an integer/);
        expect(() => assertSelectTile({ ...GOOD[LAB_EVENTS.selectTile], ty: '7' }))
            .toThrow(/must be an integer/);
    });

    it('requestState carries the address and nothing else', () => {
        expect(() => assertRequestState({ ...GOOD[LAB_EVENTS.requestState], why: 'because' }))
            .toThrow(/unexpected field "why"/);
    });
});

describe('labProtocol — addressedTo is the ONE routing predicate', () => {
    it('is true only for the matching iframeId', () => {
        expect(addressedTo({ iframeId: 'a' }, 'a')).toBe(true);
        expect(addressedTo({ iframeId: 'a' }, 'b')).toBe(false);
    });
    it('⛔ answers false — never throws — for mail with no address on it', () => {
        expect(addressedTo(null, 'a')).toBe(false);
        expect(addressedTo(undefined, 'a')).toBe(false);
        expect(addressedTo({}, 'a')).toBe(false);
    });
    it('⛓ two panels: a payload for one is not addressed to the other', () => {
        const forMaze = { ...GOOD[LAB_EVENTS.load] };
        expect(addressedTo(forMaze, 'procgenLab-seedling-1')).toBe(false);
        expect(addressedTo(forMaze, 'procgenLab-maze-1')).toBe(true);
    });
});
