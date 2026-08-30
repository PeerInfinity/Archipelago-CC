/**
 * The adapter's property path, and the ONE thing M1 changes about it: it
 * stands down on the AP locations the host's placement table owns (EDITOR
 * INTEGRATION M1, H6; plan §17.0.4).
 *
 * ⛓ THE CONFIG IS THE SHIPPED `games/seedling.json`, so the property → flash
 * name → AP name chain under test is the one the panel really builds. The
 * adapter itself imports nothing and guards on `typeof window`, so it
 * constructs in node with two stubs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it } from 'vitest';

import { FlashBridgeAdapter } from './flashBridgeAdapter.js';

const CONFIG = JSON.parse(readFileSync(
    fileURLToPath(new URL('./games/seedling.json', import.meta.url)), 'utf8'));

/** The first location whose property the game itself can flip. */
const SUBJECT = CONFIG.locations[0];

let published;
const adapterFor = () => {
    published = [];
    return new FlashBridgeAdapter({
        config: CONFIG,
        flashObjectId: `test-${Math.random()}`,
        stateManager: { getLatestStateSnapshot: () => ({ inventory: {} }) },
        dispatcher: { publish: (name, data, opts) => published.push({ name, data, opts }) },
        eventBus: { subscribe: () => () => {} },
        log: () => {},
    });
};

/** A player pickup is the SECOND report for a property (the first is baseline). */
const pickup = (a, property) => {
    a._onStateChanged(property, false);   // baseline
    a._onStateChanged(property, true);    // the player action
};

describe('the property path, unchanged when nobody claims a location', () => {
    let a;
    beforeEach(() => { a = adapterFor(); });

    it('dispatches the check and queues the undo', () => {
        pickup(a, SUBJECT.property);
        expect(published.map((p) => p.name)).toEqual(['user:locationCheck']);
        expect(published[0].data.locationName).toBe(SUBJECT.ap_name);
        expect(a.undoQueue).toEqual([{ class: 'main', property: SUBJECT.property, value: false }]);
    });

    it('starts with an EMPTY owned set — an adapter nobody told behaves as it always has', () => {
        expect(a.hostOwnedLocations.size).toBe(0);
    });
});

describe('and it STANDS DOWN on a location the host owns', () => {
    /**
     * ⛔⛔ WHY THIS IS NOT MERELY REDUNDANT. With an `APItem` in the room the
     * game grants nothing, so the only writer of this flag is the bridge, on
     * the AP server's `ReceivedItems`. An echo the suppression happens to miss
     * would then read as a player pickup — checking the location a SECOND time
     * AND queueing an undo that writes the granted item straight back to false.
     * The gate that catches it is *"the flag flips EXACTLY ONCE"*.
     */
    it('no second check and NO UNDO — the undo would revoke the granted item', () => {
        const a = adapterFor();
        a.setHostOwnedLocations(new Set([SUBJECT.ap_name]));
        pickup(a, SUBJECT.property);
        expect(published).toEqual([]);
        expect(a.undoQueue).toEqual([]);
    });

    it('and the mutant is the same run with the set EMPTY — it checks and undoes', () => {
        const a = adapterFor();
        a.setHostOwnedLocations(new Set());
        pickup(a, SUBJECT.property);
        expect(published.map((p) => p.name)).toEqual(['user:locationCheck']);
        expect(a.undoQueue).toHaveLength(1);
    });

    /**
     * ⛓ A SET, NOT A DELETE — this is the row that makes the difference
     * observable. The two ENCOUNTER locations (`fire@L32`, `darksword@L12`) are
     * boss/special grants with no pickup entity: they are never rewritten, no
     * `APItem` stands there, and they MUST keep this path.
     */
    it('a location NOT in the set is untouched by the stand-down', () => {
        const other = CONFIG.locations.find((l) => l.property !== SUBJECT.property);
        const a = adapterFor();
        a.setHostOwnedLocations(new Set([SUBJECT.ap_name]));
        pickup(a, other.property);
        expect(published.map((p) => p.name)).toEqual(['user:locationCheck']);
        expect(published[0].data.locationName).toBe(other.ap_name);
    });

    it('matches on the AP NAME, which is what would actually be dispatched', () => {
        // ⛔ NOT the flash name: `flashLocationToApName` is the mapping the
        // dispatch itself uses, and the placement table speaks AP names. A set
        // of flash names would silently never match.
        const a = adapterFor();
        a.setHostOwnedLocations(new Set([SUBJECT.flash_name]));
        pickup(a, SUBJECT.property);
        expect(published.map((p) => p.name)).toEqual(['user:locationCheck']);
    });

    it('accepts an array as well as a Set, and null clears', () => {
        const a = adapterFor();
        a.setHostOwnedLocations([SUBJECT.ap_name]);
        expect(a.hostOwnedLocations.has(SUBJECT.ap_name)).toBe(true);
        a.setHostOwnedLocations(null);
        expect(a.hostOwnedLocations.size).toBe(0);
    });
});

describe('the M1 declarations in games/seedling.json', () => {
    /**
     * ⛔ ORDER IS THE GUARANTEE. BridgeGeneric builds `_properties` in
     * declaration order and reports in it, so `pendingExit` must arrive before
     * `level` in the frame a door fires — otherwise the host sees the level
     * move first and can no longer say which door caused it.
     */
    it('declares the four M1 properties BEFORE `level`', () => {
        const names = CONFIG.state_properties.map((p) => p.property);
        const level = names.indexOf('level');
        expect(level).toBeGreaterThan(-1);
        for (const p of ['pendingExit', 'pendingCheck', 'keyMask', 'totemCount']) {
            expect(names.indexOf(p)).toBeGreaterThan(-1);
            expect(names.indexOf(p)).toBeLessThan(level);
        }
        // and playerPositionX/Y keep theirs, which the crossing tie-break needs
        for (const p of ['playerPositionX', 'playerPositionY']) {
            expect(names.indexOf(p)).toBeLessThan(level);
        }
    });

    /**
     * ⛔ EVERY ENTRY IS A PROPERTY. `doConfigure` pushes every array element
     * into `_properties` without inspecting it, so a `$comment` object would
     * become a property with an undefined class alias — which is why M1's note
     * is a TOP-LEVEL key instead.
     */
    it('carries no stray entries — BridgeGeneric pushes every one of them', () => {
        for (const p of CONFIG.state_properties) {
            expect(Object.keys(p).sort()).toEqual(['class', 'property', 'type']);
            expect(CONFIG.classes[p.class]).toBeTruthy();
        }
    });
});
