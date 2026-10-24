/**
 * ⛓ RULES re-closing locks — a GROUPED lock that only a plain Button opens is
 * rebuilt CLOSED on every entry (`Lock.check()` reads persistence only while
 * `tSet < 0`), so it is entered only from a side that can work its button this
 * visit. These rows pin the three answers on real levels:
 *
 * - from its far side, where the player can ARRIVE, there is no crossing
 *   (L16's L18-side pocket);
 * - a far side nobody can arrive in is a pocket entered only through the held
 *   lock, so its way back is free (L41's totem-part pocket);
 * - a `tSet < 0` lock is untouched: persistent, no `enter` gates.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildSeedlingRegionGrid, conditionKey, flag } from './seedlingSemantics.js';
import {
    A_WEAPON,
    RECLOSING_LOCK,
    buildCrossLevelOpeners,
    buildGroupOpeners,
    overlayEntitySemantics,
    overlayTileSemantics,
} from './seedlingPlaythroughOverlay.js';

const MAP = JSON.parse(readFileSync(
    fileURLToPath(new URL('./atlases/seedling-map.json', import.meta.url)), 'utf8',
));
const levelById = (id) => MAP.levels.find((l) => l.level === id);
const GROUPS = buildGroupOpeners(MAP);
const CROSS = buildCrossLevelOpeners(MAP);

const gridOf = (id, options = {}) => {
    const level = levelById(id);
    return buildSeedlingRegionGrid({ x: 0, y: 0, w: level.width, h: level.height }, level, {
        tileOverride: overlayTileSemantics,
        entityOverride: (e, b) => overlayEntitySemantics(e, b, { level: id, crossLevelOpeners: CROSS, groupOpeners: GROUPS }),
        ...options,
    });
};
const cellAt = (grid, x, y) => grid.cells[y * grid.width + x];

describe('the group census — which grouped locks re-close', () => {
    it('a plain Button group HOLDS (L15 group 0: the button at (7,2), nothing latching)', () => {
        expect(GROUPS.get('15:0')).toEqual({ latching: false, holders: [[7, 2]] });
    });

    it('a ButtonRoom with room -1 LATCHES its group (L20 group 0), so its lock is not re-closing', () => {
        expect(GROUPS.get('20:0').latching).toBe(true);
        const l40 = levelById(40).entities.find((e) => e.type === 'wandlock' && e.x === 208 && e.y === 128);
        const ruled = overlayEntitySemantics(l40, null, { level: 40, crossLevelOpeners: CROSS, groupOpeners: GROUPS });
        expect(ruled.kind).toBe('open');
        expect(ruled.opensFrom).toBeUndefined();
    });

    it('the re-closing ruling carries its source and its holders', () => {
        const l15 = levelById(15).entities.find((e) => e.type === 'lock');
        const ruled = overlayEntitySemantics(l15, null, { level: 15, crossLevelOpeners: CROSS, groupOpeners: GROUPS });
        expect(ruled).toMatchObject({ kind: 'directional', opensFrom: [[7, 2]], cite: RECLOSING_LOCK.cite });
    });
});

describe('a re-closing lock under `directionalLocks`', () => {
    // L16: lock@320,112 = (20,7), group 1, button@272,48 = (17,3) on the WEST.
    // The east pocket (21..23, 4..7) is where L18's stairs land the player.
    const L18_LANDING = [22, 5];

    it('from its FAR side, where a player can arrive, there is no crossing', () => {
        const lock = cellAt(gridOf(16, { directionalLocks: true, arrivalTiles: [L18_LANDING] }), 20, 7);
        expect(lock.enter.W).toBeNull();
    });

    it('from its BUTTON side the crossing is free', () => {
        const lock = cellAt(gridOf(16, { directionalLocks: true, arrivalTiles: [L18_LANDING] }), 20, 7);
        expect(lock.enter.E).toBeUndefined();
    });

    it('without arrival tiles every far side is assumed reachable some other way, and walled', () => {
        expect(cellAt(gridOf(16, { directionalLocks: true }), 20, 7).enter.W).toBeNull();
    });

    it('a far side that reaches its button only through a gate pays that gate (L15: Swim round the water)', () => {
        const lock = cellAt(gridOf(15, { directionalLocks: true, arrivalTiles: [[9, 2]] }), 8, 3);
        expect(lock.enter.W.map(conditionKey)).toEqual([conditionKey(flag('canSwim'))]);
        expect(lock.enter.E).toBeUndefined();
    });

    it('a far side nobody can ARRIVE in is entered only through the held lock, so its way back is free (L41)', () => {
        // wandlock@240,96 = (15,6), group 1, button@176,176 = (11,11). The
        // pocket below it holds the totem part and no landing.
        const free = cellAt(gridOf(41, { directionalLocks: true, arrivalTiles: [[1, 10]] }), 15, 6);
        expect(free.enter.N).toBeUndefined();
        // The same pocket with a landing in it is walled.
        const walled = cellAt(gridOf(41, { directionalLocks: true, arrivalTiles: [[1, 10], [15, 9]] }), 15, 6);
        expect(walled.enter.N).toBeNull();
        // The north side reaches its button through breakable rocks: a weapon.
        expect(free.enter.S.map(conditionKey)).toEqual([conditionKey(A_WEAPON)]);
    });

    it('without `directionalLocks` the cell carries no `enter` gates', () => {
        expect(cellAt(gridOf(16, { arrivalTiles: [L18_LANDING] }), 20, 7).enter).toBeUndefined();
    });
});

describe('a tSet < 0 lock is PERSISTENT, and untouched', () => {
    it('L15-shaped kill-lock: a weapon gate with no `opensFrom`, and no `enter` gates on its cell', () => {
        const level = levelById(15);
        const killLock = {
            ...level,
            entities: level.entities.map((e) => (e.type === 'lock' ? { ...e, attrs: { ...e.attrs, tset: '-1' } } : e)),
        };
        const ruled = overlayEntitySemantics(killLock.entities.find((e) => e.type === 'lock'), null,
            { level: 15, crossLevelOpeners: CROSS, groupOpeners: GROUPS });
        expect(ruled.kind).toBe('gated');
        expect(ruled.opensFrom).toBeUndefined();
        const grid = buildSeedlingRegionGrid({ x: 0, y: 0, w: level.width, h: level.height }, killLock, {
            tileOverride: overlayTileSemantics,
            entityOverride: (e, b) => overlayEntitySemantics(e, b, { level: 15, crossLevelOpeners: CROSS, groupOpeners: GROUPS }),
            directionalLocks: true,
            arrivalTiles: [[9, 2]],
        });
        expect(cellAt(grid, 8, 3).enter).toBeUndefined();
    });
});
