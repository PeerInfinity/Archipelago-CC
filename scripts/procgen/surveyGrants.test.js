/**
 * ⛓⛓ SEEDLING SWIM U2, D3 — the staged grant's derivation (`surveyGrants.js`),
 * against the REAL `games/seedling.json` tables and the route's own five
 * pickups (steps 10, 20, 21, 27, 30 of `--through=2.2`).
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { deriveStagedGrant, stageGrantSave, tapeCoversVisit } from './surveyGrants.js';

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
            .toThrow(/hitsMax is not a boolean grant/);
        const g = deriveStagedGrant({ earlier, pickups: ROWS, game: GAME, latchItems: {},
            unpresentable: 'report' });
        expect(g.keys).toEqual([2]);
        // ⛓ RULES survey-save-arrays: the Seal is a save-array COUNT now, so only Health is unpresentable
        expect(g.unpresentable.map((u) => [u.step, u.item])).toEqual([[2, 'Health']]);
        expect(g.saveCounts).toEqual({ seal_parts: 1 });
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

// ⛓ RULES survey-save-arrays — the delivered Seals / Totem Shards are COUNTED off `items[].save_array` and staged
// into `save` through `saveArrayRules.mergeSaveArray` (keys union, totems count-fill, seals log-append).
describe('save arrays — counted by the grant, staged by saveArrayRules', () => {
    const SEALS = Array.from({ length: 16 }, (_, i) => ({ level: 100 + i, item: 'Seal', location: `seal ${i}` }));
    const TOTEMS = Array.from({ length: 5 }, (_, i) => ({ level: 200 + i, item: 'Totem Shard', location: `totem ${i}` }));
    const KEYS = [{ level: 40, item: 'Purple Key', location: 'Level 040 - Boss Key 2' }];
    const pickups = [...SEALS, ...TOTEMS, ...KEYS];
    const walkOf = (locations) => locations.map((location, i) => ({ step: i + 1, level: 0,
        goals: [{ kind: 'collect-placement', location }] }));
    const grantOf = (locations) => deriveStagedGrant({ earlier: walkOf(locations), pickups, game: GAME,
        latchItems: {}, unpresentable: 'report' });

    it('counts per copy, never unpresentable; a Totem Shard is counted BEFORE its progressive ladder', () => {
        const g = grantOf(['seal 0', 'seal 1', 'seal 2', 'totem 0', 'totem 1', 'Level 040 - Boss Key 2']);
        expect(g.saveCounts).toEqual({ seal_parts: 3, totem_parts: 2 });
        expect(g.unpresentable).toEqual([]);
        expect(g.keys).toEqual([2]);
        expect(g.items).toEqual([]);
        expect(g.from.filter((f) => f.item === 'Seal').map((f) => f.grants))
            .toEqual(['save.seal_parts ×1', 'save.seal_parts ×2', 'save.seal_parts ×3']);
    });

    it('seals LOG-APPEND: N seals → N filled slots, the missing ones the smallest identities not held', () => {
        const g = grantOf(SEALS.slice(0, 3).map((p) => p.location));
        expect(stageGrantSave(null, g).seal_parts).toEqual([0, 1, 2]);
        // a held log is the authority: its order is kept, slots appended with identities it does not hold
        expect(stageGrantSave({ seal_parts: [7, 1] }, g).seal_parts).toEqual([7, 1, 0]);
        // all sixteen: step 211's FinalDoor (hasAllSealParts = the last slot filled)
        expect(stageGrantSave(null, grantOf(SEALS.map((p) => p.location))).seal_parts)
            .toEqual(Array.from({ length: 16 }, (_, i) => i));
    });

    // ⛓ R4b (rules-boss-locations) — the seal log under `seals_required` (saveArrayRules.sealLogSlots).
    it('seals honour seals_required: the door slot waits for the Nth Seal; nothing past 16 slots', () => {
        const SIXTEEN = Array.from({ length: 16 }, (_, i) => i);
        const eight = grantOf(SEALS.slice(0, 8).map((p) => p.location));
        expect(stageGrantSave(null, eight, { sealsRequired: 8 }).seal_parts).toEqual(SIXTEEN);
        expect(stageGrantSave(null, eight, { sealsRequired: 9 }).seal_parts).toEqual(SIXTEEN.slice(0, 8));
        const all = grantOf(SEALS.map((p) => p.location));
        expect(stageGrantSave(null, all, { sealsRequired: 23 }).seal_parts).toEqual(SIXTEEN.slice(0, 15));
        expect(stageGrantSave(null, all).seal_parts).toEqual(SIXTEEN);
    });

    it('totems COUNT-FILL: at least N indices, the smallest not held, sorted', () => {
        const g = grantOf(['totem 0', 'totem 1', 'totem 2']);
        expect(stageGrantSave(null, g).totem_parts).toEqual([0, 1, 2]);
        expect(stageGrantSave({ totem_parts: [3] }, g).totem_parts).toEqual([0, 1, 3]);
    });

    it('keys stay a UNION, unchanged; `keys: false` leaves them as the save holds them', () => {
        const g = grantOf(['Level 040 - Boss Key 2', 'seal 0']);
        expect(stageGrantSave({ keys: [0] }, g).keys).toEqual([0, 2]);
        expect(stageGrantSave({ keys: [0] }, g, { keys: false }).keys).toEqual([0]);
        expect(stageGrantSave({ keys: [0] }, g, { keys: false }).seal_parts).toEqual([0]);
    });

    it('a committed tape\'s own arrays are NEVER shortened (SET_IF_MISSING), and no grant changes nothing', () => {
        const tape = { totem_parts: [1, 4], keys: [0, 3], seal_parts: [9, 5, 2, 11] };
        const g = grantOf(['seal 0', 'seal 1', 'totem 0']);
        expect(stageGrantSave(tape, g, { keys: false })).toEqual(tape);
        expect(stageGrantSave(tape, null)).toEqual(tape);
        expect(stageGrantSave(null, null)).toEqual({ totem_parts: [], keys: [], seal_parts: [] });
    });
});

// ⛓ the merge is the JS arc's module, IMPORTED — never a re-spelling (js-7 owns `saveArrayRules.js`)
it('surveyGrants stages through saveArrayRules.mergeSaveArray + sealLogSlots (an import, not a fork)', () => {
    const src = readFileSync(new URL('./surveyGrants.js', import.meta.url), 'utf8');
    expect(src).toMatch(/import \{ mergeSaveArray, sealLogSlots \} from '\.\.\/\.\.\/frontend\/modules\/seedlingDemo\/saveArrayRules\.js';/);
    expect(src).toMatch(/sealLogSlots\(/);
    expect(src.match(/mergeSaveArray\(/g)?.length).toBeGreaterThanOrEqual(2);
});
