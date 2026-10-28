/**
 * EVENTS AS LOCATIONS (session tile-primitives-events-as-locations): the playthrough's OBSTACLE, LOCK, BUTTON and TALK
 * events reach the maze preset's AP layer, sourced from the rules producer (`playthroughEventLayer`), and the maze
 * WORLD models the ones it can — one minimal compile per kind. The maze maker used to omit them, so a maze world's AP
 * layer was looser than the game wherever a crossing or a location depends on an event (whole game: 24 event
 * locations, 18 gated exits, 10 latched-lock returns).
 * ⚖ user 2026-10-23: "All AP; world rocks+locks", "Carry + name", "Extract one producer fn".
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlaythroughMaze, eventLayerFor } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const ATLAS = readJson('../../flashPanel/atlases/seedling-playthrough.json');
const PLAYTHROUGH = readJson('../../../presets/seedling_playthrough/AP_1/AP_1_rules.json').regions['1'];

const exitRule = (regions, from, to) => regions[from].exits.find((e) => e.connected_region === to)?.access_rule;
const location = (regions, region, name) => regions[region].locations.find((l) => l.name === name);
const withExitRule = (rules, from, to, rule) => {
    const copy = structuredClone(rules);
    copy.regions['1'][from].exits.find((e) => e.connected_region === to).access_rule = rule;
    return copy;
};
const withLocationRule = (rules, region, name, rule) => {
    const copy = structuredClone(rules);
    copy.regions['1'][region].locations.find((l) => l.name === name).access_rule = rule;
    return copy;
};
const certify = (rules, regions) => certifyPlaythroughMaze(rules, HELPERS, { native: true, atlas: ATLAS, regions });
const TRUE = { rule: 'True_' };
const has = (item) => ({ rule: 'Has', args: { item_name: item } });

describe('rock events: L0 breakablerock@80,112, gating L1 → L0 r6c5 (the house-door pocket the rock stands in)', () => {
    const LEVELS = ['level_0', 'level_1'];
    const E = 'L0 flag 4: breakablerock@80,112 cleared';
    const RULES = JSON.parse(buildPlaythroughMaze({ levels: LEVELS }).text);
    const REGIONS = RULES.regions['1'];

    it('the AP layer carries the producer\'s event and gate, equal to seedling_playthrough (never hand-coded)', () => {
        expect(eventLayerFor(ATLAS, LEVELS).exitGates).toContainEqual(
            { region_id: 'level_1', exit_id: 'out_teleporter_64_112', rule: has(E) });
        expect(exitRule(REGIONS, 'level_1', 'level_0__r6c5')).toEqual(has(E));
        expect(exitRule(REGIONS, 'level_1', 'level_0__r6c5')).toEqual(exitRule(PLAYTHROUGH, 'level_1', 'level_0__r6c5'));
        const own = location(REGIONS, 'level_0__r7c6', E);
        expect(own.access_rule).toEqual(location(PLAYTHROUGH, 'level_0__r7c6', E).access_rule);
    });

    it('the world\'s rock carries the event: carried, it is open (struck on an earlier visit)', () => {
        const payload = RULES.preset_sidecars['1'].level_0__r1c6.playable_payload;
        const id = payload.obstacles.find((o) => o.x === 5 && o.y === 7).id;
        expect(payload.obstacleLib[id]).toMatchObject({ kind: 'rock', clear_set: [[E]], events: [{ name: E, side: 'level_0__r7c6' }] });
    });

    it('certifies: L1 lands on the rock only once it is broken, and the event is priced by the strike', () => {
        const out = certify(RULES, ['level_1', 'level_0__r6c5', 'level_0__r7c6']);
        expect(out.problems.filter((p) => p.startsWith('level_1') || p.includes('breakablerock'))).toEqual([]);
        expect(out.lines.some((l) => l.startsWith(`level_0__r7c6@${E}=`))).toBe(true);
    });

    it('a mutant event rule (True_) is caught', () => {
        expect(certify(withLocationRule(RULES, 'level_0__r7c6', E, TRUE), ['level_0__r7c6']).problems
            .some((p) => p.startsWith(`level_0__r7c6 @ ${E}`))).toBe(true);
    });
});

describe('gated-cell events: L24\'s burnable tree, gating L12 r40c4 → L24', () => {
    const LEVELS = ['level_12', 'level_24', 'level_23'];
    const E = 'L24 flag 0: burnabletree@32,128 cleared';
    const RULES = JSON.parse(buildPlaythroughMaze({ levels: LEVELS }).text);
    const REGIONS = RULES.regions['1'];
    const SAMPLE = ['level_24', 'level_12__r40c4'];

    it('the AP layer equals seedling_playthrough on the gate and the event', () => {
        expect(exitRule(REGIONS, 'level_12__r40c4', 'level_24')).toEqual(has(E));
        expect(exitRule(REGIONS, 'level_12__r40c4', 'level_24')).toEqual(exitRule(PLAYTHROUGH, 'level_12__r40c4', 'level_24'));
        expect(location(REGIONS, 'level_24', E).access_rule).toEqual(location(PLAYTHROUGH, 'level_24', E).access_rule);
    });

    it('the tree\'s cells open on the Fire or the event', () => {
        const payload = RULES.preset_sidecars['1'].level_24.playable_payload;
        const id = payload.obstacles.find((o) => o.x === 2 && o.y === 8).id;
        expect(payload.obstacleLib[id].clear_rule).toEqual({ rule: 'Or', children: [has('Fire'), has(E)] });
    });

    it('certifies with no problem: the event priced from beside the tree, the landing in it only once burnt', () => {
        expect(certify(RULES, SAMPLE).problems).toEqual([]);
    });

    it('mutants are caught: the gate dropped (the game lands IN the tree), and the event made free', () => {
        expect(certify(withExitRule(RULES, 'level_12__r40c4', 'level_24', TRUE), SAMPLE).problems
            .some((p) => p.startsWith('level_12__r40c4 → level_24'))).toBe(true);
        expect(certify(withLocationRule(RULES, 'level_24', E, TRUE), SAMPLE).problems
            .some((p) => p.startsWith(`level_24 @ ${E}`))).toBe(true);
    });
});

describe('latched-lock events: L19\'s Red Key boss lock', () => {
    const LEVELS = ['level_19'];
    const E = 'L19 flag 1: bosslock@48,32 cleared';
    const RULES = JSON.parse(buildPlaythroughMaze({ levels: LEVELS }).text);
    const REGIONS = RULES.regions['1'];
    const SAMPLE = ['level_19__r1c1', 'level_19__r3c3'];

    it('the far side\'s return costs the event (internalExitRules), equal to seedling_playthrough', () => {
        expect(exitRule(REGIONS, 'level_19__r1c1', 'level_19__r3c3')).toEqual(exitRule(PLAYTHROUGH, 'level_19__r1c1', 'level_19__r3c3'));
        expect(exitRule(REGIONS, 'level_19__r1c1', 'level_19__r3c3')).toEqual({ rule: 'And', children: [has(E), has('Red Key')] });
        expect(location(REGIONS, 'level_19__r3c3', E).access_rule).toEqual(location(PLAYTHROUGH, 'level_19__r3c3', E).access_rule);
    });

    it('the world\'s crossing tile carries that rule, not the atlas row\'s CanReachRegion (which the search cannot price)', () => {
        expect(JSON.stringify(RULES.preset_sidecars)).not.toContain('CanReachRegion');
    });

    it('certifies: the return needs the event, the event is priced from beside the lock', () => {
        // On main this sample THREW (r1c1's crossing tile carried CanReachRegion). The one older row (r3c3's way to
        // the Shieldspire arena not priced: two crossings shared one tile) went with session tile-primitives-water-exits:
        // L19's colliding crossings make it a level world, whose latched lock's closed side costs the event.
        expect(certify(RULES, SAMPLE).problems).toEqual([]);
    });

    it('a mutant return without the event is caught', () => {
        expect(certify(withExitRule(RULES, 'level_19__r1c1', 'level_19__r3c3', has('Red Key')), SAMPLE).problems
            .some((p) => p.startsWith('level_19__r1c1'))).toBe(true);
    });
});

describe('L38\'s press opens L39: carried (⚖ "Carry + name"), produced on its button, its far side named', () => {
    const LEVELS = ['level_38', 'level_39'];
    const E = 'L39 flag 8: wandlock@144,592 cleared';
    const RULES = JSON.parse(buildPlaythroughMaze({ levels: LEVELS }).text);
    const REGIONS = RULES.regions['1'];

    it('the AP layer carries the event and both gates, equal to seedling_playthrough', () => {
        expect(location(REGIONS, 'level_38', E).access_rule).toEqual(location(PLAYTHROUGH, 'level_38', E).access_rule);
        for (const [from, to] of [['level_38', 'level_39__r25c9'], ['level_39__r25c9', 'level_38']]) {
            expect(exitRule(REGIONS, from, to), `${from} -> ${to}`).toEqual(has(E));
            expect(exitRule(REGIONS, from, to)).toEqual(exitRule(PLAYTHROUGH, from, to));
        }
    });

    // ⛓ session tile-primitives-sphere-order-5 (⚖ "Location on the cell"): L38's world produces the press on its button.
    // ⛓ session tile-primitives-sphere-order-6 (⚖ "Lock cell opened by event" + "Lay the producer's door gates"): L39's world
    // opens the wand lock by it, and both of the pocket's doors cost it, so every crossing that needs it certifies.
    it('the press is priced free in L38; L39\'s world opens its target by it, and both crossings cost it', () => {
        const out = certify(RULES, ['level_38', 'level_39__r25c9']);
        expect(out.lines).toContain(`level_38@${E}=[[]]`);
        expect(out.problems).toEqual([]);
        expect(out.lines).toContain(`level_38->level_39__r25c9=${JSON.stringify([[E]])}`);
        expect(out.lines).toContain(`level_39__r25c9->level_38=${JSON.stringify([[E]])}`);
    });

    it('a press NO world opens by is named on the rows that need it (its target and doors stripped from the worlds)', () => {
        const copy = structuredClone(RULES);
        for (const sc of Object.values(copy.preset_sidecars['1'])) {
            const p = sc.playable_payload;
            if (!p) continue;
            const names = new Set(Object.values(p.obstacleLib ?? {}).filter((x) => JSON.stringify(x.clear_rule ?? null).includes(E)).map((x) => x.id));
            p.obstacles = p.obstacles.filter((o) => !names.has(o.id));
            for (const id of names) delete p.obstacleLib[id].opened_by;
        }
        const rows = certify(copy, ['level_38', 'level_39__r25c9']).problems;
        expect(rows.filter((p) => p.endsWith(
            `needs "${E}", a press the maze world produces, but no world opens its target (wandlock@144,592 in L39) by it`)).length, JSON.stringify(rows)).toBe(2);
    });
});

describe('eventLayerFor', () => {
    it('refuses BY NAME a kept event that needs an event of a level not in the compile', () => {
        // L113's final door opens only after the Watcher's talk, in L114.
        expect(() => eventLayerFor(ATLAS, ['level_113', 'level_112'])).toThrow(/L113 flag 0: finaldoor.*needs L114 flag 0: watcher.*not in the levels/);
    });
});
