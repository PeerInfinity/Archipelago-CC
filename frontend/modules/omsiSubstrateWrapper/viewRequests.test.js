/**
 * The pump's view-queue collapse (Instant-policy pass, slice 1).
 *
 * Two properties, and the second is the one that made this file necessary:
 * collapsing must not change what gets repainted, and it must actually
 * REMOVE the growth — a "dedupe" that quietly failed on the fork's real
 * target shapes would leave the pump quadratic while looking fixed.
 *
 * The shapes below are transcribed from the fork's own call sites, not
 * invented: `{name, index}` (town.js:151/190/244, views/main.view.js:70),
 * `{name, town}` (town.js:194), primitives (the majority), and the two
 * unmodelled object payloads (updateCloudSave's Drive responses,
 * updateMultiPart's Action objects).
 */
import { describe, it, expect } from 'vitest';
import { dedupeViewRequests } from './viewRequests.js';

/** The fork's requestUpdate, verbatim — reference equality and all. */
function requestUpdate(requests, category, target) {
    if (!requests[category]) requests[category] = [];
    if (!requests[category].includes(target)) requests[category].push(target);
}

describe('dedupeViewRequests', () => {
    it('collapses the fresh-object-literal targets the fork cannot', () => {
        const requests = {};
        // What `finishProgress` does once per progress tick, for 500 ticks.
        for (let i = 0; i < 500; i += 1) {
            requestUpdate(requests, 'updateRegular', { name: 'Wander', index: 0 });
            requestUpdate(requests, 'updateProgressAction', { name: 'Wander', town: { index: 0 } });
        }
        // The fork's own dedupe achieved nothing — this is the defect.
        expect(requests.updateRegular).toHaveLength(500);
        expect(requests.updateProgressAction).toHaveLength(500);

        const removed = dedupeViewRequests(requests);

        expect(removed).toBe(998);
        expect(requests.updateRegular).toEqual([{ name: 'Wander', index: 0 }]);
        expect(requests.updateProgressAction).toEqual([{ name: 'Wander', town: { index: 0 } }]);
    });

    it('keeps targets that only LOOK alike', () => {
        const requests = {};
        // Same var name in two different towns, and two vars in one town.
        requestUpdate(requests, 'updateRegular', { name: 'Wander', index: 0 });
        requestUpdate(requests, 'updateRegular', { name: 'Wander', index: 1 });
        requestUpdate(requests, 'updateRegular', { name: 'Smash Pots', index: 0 });
        requestUpdate(requests, 'updateProgressAction', { name: 'Wander', town: { index: 0 } });
        requestUpdate(requests, 'updateProgressAction', { name: 'Wander', town: { index: 2 } });

        dedupeViewRequests(requests);

        expect(requests.updateRegular).toHaveLength(3);
        expect(requests.updateProgressAction).toHaveLength(2);
    });

    it('preserves first-occurrence order', () => {
        // Any ordering the fork's categories rely on has to survive.
        const requests = { updateRegular: [] };
        for (const name of ['C', 'A', 'B', 'A', 'C', 'A']) {
            requests.updateRegular.push({ name, index: 0 });
        }
        dedupeViewRequests(requests);
        expect(requests.updateRegular.map((t) => t.name)).toEqual(['C', 'A', 'B']);
    });

    it('leaves primitive targets exactly as the fork already had them', () => {
        // These were never broken: `includes` deduped them correctly, so
        // collapsing must be a no-op on an already-collapsed list.
        const requests = {};
        for (const target of [null, 'Wander', 3, true, undefined]) {
            requestUpdate(requests, 'updateStat', target);
            requestUpdate(requests, 'updateStat', target);
        }
        const before = [...requests.updateStat];
        expect(dedupeViewRequests(requests)).toBe(0);
        expect(requests.updateStat).toEqual(before);
    });

    it('never collapses an object shape it does not model', () => {
        // updateCloudSave's Drive payloads and updateMultiPart's Action
        // objects. Two distinct objects that happen to share a `name` must
        // both survive — falling back to reference identity is exactly the
        // fork's existing behavior, so an unmodelled shape cannot be
        // collapsed wrongly.
        const requests = {};
        const a = { name: 'Heal The Sick', loops: 1 };
        const b = { name: 'Heal The Sick', loops: 2 };
        requestUpdate(requests, 'updateMultiPart', a);
        requestUpdate(requests, 'updateMultiPart', b);
        requestUpdate(requests, 'updateMultiPart', a);      // fork already deduped this one
        requestUpdate(requests, 'updateCloudSave', { id: 'x' });
        requestUpdate(requests, 'updateCloudSave', { id: 'y' });

        dedupeViewRequests(requests);

        expect(requests.updateMultiPart).toEqual([a, b]);
        expect(requests.updateCloudSave).toHaveLength(2);
    });

    it('mutates in place — the view holds the same array references', () => {
        const requests = { updateRegular: [] };
        const list = requests.updateRegular;
        for (let i = 0; i < 10; i += 1) list.push({ name: 'Wander', index: 0 });

        dedupeViewRequests(requests);

        expect(requests.updateRegular).toBe(list);
        expect(list).toHaveLength(1);
    });

    it('survives a missing or malformed bag', () => {
        expect(dedupeViewRequests(null)).toBe(0);
        expect(dedupeViewRequests(undefined)).toBe(0);
        expect(dedupeViewRequests({ updateRegular: null })).toBe(0);
        expect(dedupeViewRequests({ updateRegular: [] })).toBe(0);
    });

    it('removes the growth the pump would otherwise pay quadratically for', () => {
        // The non-vacuity check: assert the ASYMPTOTICS, not just the result.
        // Collapsing between batches is what keeps each batch's `includes`
        // scans bounded by the batch rather than by the whole run.
        const BATCHES = 40;
        const PER_BATCH = 100;
        const requests = {};
        let maxLengthSeen = 0;
        for (let batch = 0; batch < BATCHES; batch += 1) {
            for (let i = 0; i < PER_BATCH; i += 1) {
                requestUpdate(requests, 'updateProgressAction',
                    { name: 'Wander', town: { index: 0 } });
            }
            maxLengthSeen = Math.max(maxLengthSeen, requests.updateProgressAction.length);
            dedupeViewRequests(requests);
        }
        // Bounded by ONE batch + the survivor, not by the 4000 total pushes.
        expect(maxLengthSeen).toBeLessThanOrEqual(PER_BATCH + 1);
        expect(requests.updateProgressAction).toHaveLength(1);
    });
});
