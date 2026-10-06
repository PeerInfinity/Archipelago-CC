/**
 * ⛓⛓ SEEDLING SWIM U2, D3 — the staged grant's derivation (`surveyGrants.js`),
 * against the REAL `games/seedling.json` tables and the route's own five
 * pickups (steps 10, 20, 21, 27, 30 of `--through=2.2`).
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { deriveStagedGrant, tapeCoversVisit } from './surveyGrants.js';

const GAME = JSON.parse(readFileSync(
    new URL('../../frontend/modules/flashPanel/games/seedling.json', import.meta.url), 'utf8'));
const PICKUPS = [
    { level: 10, item: 'Progressive Sword' },
    { level: 19, item: 'Red Key' },
    { level: 20, item: 'Progressive Shield' },
    { level: 29, item: 'Green Key' },
    { level: 32, item: 'Fire' },
];
const collect = (step, level) => ({ step, level, goals: [{ kind: 'collect-placement' }] });
const walk = (step, level) => ({ step, level, goals: [{ kind: 'reach-exit' }] });
const ROUTE = [collect(10, 10), walk(11, 11), walk(19, 18), collect(20, 19), collect(21, 20),
    walk(22, 13), walk(26, 22), collect(27, 29), walk(28, 31), walk(29, 30), collect(30, 32)];
const LATCH = { hasSword: true, hasShield: false, hasFire: false };
const before = (n) => ROUTE.filter((s) => s.step < n);

describe('deriveStagedGrant — the route\'s own pickups', () => {
    it('before any pickup: nothing', () => {
        expect(deriveStagedGrant({ earlier: [], pickups: PICKUPS, game: GAME, latchItems: LATCH }))
            .toBeNull();
    });

    it('after the Sword only (steps 12-19): the Sword is LATCHED, nothing is written', () => {
        expect(deriveStagedGrant({ earlier: before(12), pickups: PICKUPS, game: GAME, latchItems: LATCH }))
            .toEqual({ keys: [], items: [], latched: ['hasSword'],
                from: [{ step: 10, item: 'Progressive Sword', grants: 'latched hasSword' }] });
    });

    it('after the Red Key and the Shield (steps 22-27): key 0 and hasShield', () => {
        expect(deriveStagedGrant({ earlier: before(24), pickups: PICKUPS, game: GAME, latchItems: LATCH }))
            .toEqual({ keys: [0], items: ['hasShield'], latched: ['hasSword'], from: [
                { step: 10, item: 'Progressive Sword', grants: 'latched hasSword' },
                { step: 20, item: 'Red Key', grants: 'save.keys[0]' },
                { step: 21, item: 'Progressive Shield', grants: 'seam.items.hasShield' },
            ] });
    });

    it('after the Green Key (steps 28-30): keys 0 and 1; Fire (step 30) is its own step\'s, not granted', () => {
        const g = deriveStagedGrant({ earlier: before(30), pickups: PICKUPS, game: GAME, latchItems: LATCH });
        expect(g.keys).toEqual([0, 1]);
        expect(g.items).toEqual(['hasShield']);
        expect(g.from.map((f) => f.step)).toEqual([10, 20, 21, 27]);
    });

    it('a second copy of a progressive item takes the ladder\'s next rung', () => {
        const g = deriveStagedGrant({
            earlier: [collect(1, 20), collect(2, 20)], pickups: PICKUPS, game: GAME, latchItems: {},
        });
        expect(g.items).toEqual(['hasDarkShield', 'hasShield']);
    });

    it('refuses BY NAME: a non-boolean item, and a collect no pickup names', () => {
        expect(() => deriveStagedGrant({ earlier: [collect(1, 7)], pickups: [{ level: 7, item: 'Health' }],
            game: GAME, latchItems: {} })).toThrow(/hitsMax is not a boolean grant/);
        expect(() => deriveStagedGrant({ earlier: [collect(1, 99)], pickups: PICKUPS, game: GAME,
            latchItems: {} })).toThrow(/no route pickup names/);
    });

    // ⛓ `rules-route-survey`: the whole order (`--through=end`).
    const at = (step, level, location, kind = 'collect-placement') => ({ step, level,
        goals: [kind === 'encounter' ? { kind, location, drop: {} } : { kind, location }] });
    const ROWS = [
        { level: 40, item: 'Seal', location: 'Level 040 - Chest' },
        { level: 40, item: 'Purple Key', location: 'Level 040 - Boss Key 2' },
        { level: 32, item: 'Fire', location: 'Level 032 - Bob Boss' },
        { level: 68, item: 'Health', location: 'Level 068 - Health' },
    ];

    it('a goal carrying its LOCATION is matched by it (L40 holds four pickups); an encounter with one grants its drop', () => {
        const g = deriveStagedGrant({ earlier: [at(1, 40, 'Level 040 - Boss Key 2'),
            at(2, 32, 'Level 032 - Bob Boss', 'encounter')], pickups: ROWS, game: GAME, latchItems: {} });
        expect(g.from).toEqual([
            { step: 1, item: 'Purple Key', grants: 'save.keys[2]' },
            { step: 2, item: 'Fire', grants: 'seam.items.hasFire' },
        ]);
    });

    it('unpresentable: \'report\' NAMES what a boot cannot present instead of throwing', () => {
        const earlier = [at(1, 40, 'Level 040 - Chest'), at(2, 68, 'Level 068 - Health'),
            at(3, 40, 'Level 040 - Boss Key 2')];
        expect(() => deriveStagedGrant({ earlier, pickups: ROWS, game: GAME, latchItems: {} }))
            .toThrow(/'!seal' copy 1 has no rung/);
        const g = deriveStagedGrant({ earlier, pickups: ROWS, game: GAME, latchItems: {},
            unpresentable: 'report' });
        expect(g.keys).toEqual([2]);
        expect(g.unpresentable.map((u) => [u.step, u.item])).toEqual([[1, 'Seal'], [2, 'Health']]);
    });

    // ⛓ RULES survey-staging: a FUSION is the recipe's result, read off `fusion_items` — never a ladder.
    const FUSE = [
        { level: 10, item: 'Progressive Sword', location: 'L10 sword' },
        { level: 50, item: 'Ghost Spear', location: 'L50 spear' },
        { level: 60, item: 'Ghost Sword Fusion', location: 'L60 fusion' },
        { level: 70, item: 'Wand', location: 'L70 wand' },
        { level: 80, item: 'Fire Wand Fusion', location: 'L80 fusion' },
        { level: 32, item: 'Fire', location: 'L32 fire' },
    ];
    const got = (locations, latchItems = {}) => deriveStagedGrant({ earlier: locations.map((l, i) => at(i + 1, 0, l)),
        pickups: FUSE, game: GAME, latchItems, unpresentable: 'report' });

    it('a fusion whose recipe holds grants its RESULT (hasGhostSword / hasFireWand), and is never unpresentable', () => {
        const g = got(['L10 sword', 'L50 spear', 'L60 fusion', 'L70 wand', 'L32 fire', 'L80 fusion']);
        expect(g.items).toEqual(['hasFire', 'hasFireWand', 'hasGhostSword', 'hasSpear', 'hasSword', 'hasWand']);
        expect(g.unpresentable).toEqual([]);
        expect(g.from.filter((f) => /Fusion/.test(f.item))).toEqual([
            { step: 3, item: 'Ghost Sword Fusion', grants: 'seam.items.hasGhostSword' },
            { step: 6, item: 'Fire Wand Fusion', grants: 'seam.items.hasFireWand' },
        ]);
        // the latch's Sword counts as held, the route's copy as the progressive requirement
        expect(got(['L10 sword', 'L50 spear', 'L60 fusion'], { hasSword: true }).items).toEqual(['hasGhostSword', 'hasSpear']);
    });

    it('a fusion whose recipe does NOT hold grants nothing and is named pending', () => {
        const g = got(['L10 sword', 'L60 fusion', 'L70 wand', 'L80 fusion']);
        expect(g.items).toEqual(['hasSword', 'hasWand']);
        expect(g.pendingFusions.map((p) => [p.result, p.missing])).toEqual([
            ['ghostsword', ['spear']], ['firewand', ['fire']],
        ]);
        expect(got(['L50 spear', 'L60 fusion']).pendingFusions[0].missing).toEqual(['!sword×1']);
    });

    it('tapeCoversVisit: a committed tape boots a visit only while it presents everything the walk holds', () => {
        expect(tapeCoversVisit(null)).toEqual({ covers: true, beyond: [] });
        // the tape's own visit: the Sword latched in the tape, its own Boss Key in its save
        expect(tapeCoversVisit({ keys: [0], items: [], latched: ['hasSword'], from: [], unpresentable: [{}] }, [0]))
            .toEqual({ covers: true, beyond: [] });
        // a LATE visit: the walk holds what the tape's early block does not
        expect(tapeCoversVisit({ keys: [0, 1], items: ['hasShield', 'hasSword'], latched: [], from: [] }, [0]))
            .toEqual({ covers: false, beyond: ['hasShield', 'hasSword', 'save.keys[1]'] });
        // a Boss Key alone is enough (step 39: L19's second visit, after its Red Key)
        expect(tapeCoversVisit({ keys: [0], items: [], latched: ['hasSword'], from: [] }, []))
            .toEqual({ covers: false, beyond: ['save.keys[0]'] });
    });
});
