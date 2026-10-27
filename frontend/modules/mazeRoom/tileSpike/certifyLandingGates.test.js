/**
 * GATED TILES (session tile-primitives-gated-tiles): the playthrough's LANDING GATES reach the maze preset's AP
 * layer, and the certifier's STRICTER-BUT-IMPLIED rule — on the smallest compile that has both, L49 + L50.
 *
 * L49's Conch (the Swim) sits on land; its exit to L50 lies past water and lands in L50, which is all water. The
 * maze world gates that water; the rules producer gates the DEPARTURE on the Swim (`playthroughLandingGates`: an
 * item-less landing there drowns). The maze maker used to compile the atlas rows raw, so its AP layer said True_
 * where its own world (and the real `seedling_playthrough` preset) needs the Swim — whole game, 17 exits.
 * ⚖ user 2026-10-22: "Landing gates now" + "Accept if implied".
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlaythroughMaze, landingGatesFor } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const ATLAS = readJson('../../flashPanel/atlases/seedling-playthrough.json');
const PLAYTHROUGH = readJson('../../../presets/seedling_playthrough/AP_1/AP_1_rules.json').regions['1'];
const LEVELS = ['level_49', 'level_50'];
const SWIM = { rule: 'Has', args: { item_name: 'Progressive Swim' } };

const exitRule = (rules, from, to) => rules.regions['1'][from].exits.find((e) => e.connected_region === to)?.access_rule;
/** A copy with one AP exit (or location) rule replaced — the mutant controls. */
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

describe('landing gates in the maze preset (L49 + L50)', () => {
    const RULES = JSON.parse(buildPlaythroughMaze({ levels: LEVELS }).text);

    it('landingGatesFor keeps exactly the gates whose crossing is wired inside the levels', () => {
        expect(landingGatesFor(ATLAS, LEVELS)).toEqual([
            { region_id: 'level_49', exit_id: 'out_teleporter_32_128', rule: SWIM },
            { region_id: 'level_50', exit_id: 'out_teleporter_32_0', rule: SWIM },
        ]);
    });

    it('the AP layer carries them, equal to the real playthrough preset (two truths, never hand-coded)', () => {
        for (const [from, to] of [['level_49', 'level_50'], ['level_50', 'level_49']]) {
            expect(exitRule(RULES, from, to), `${from} -> ${to}`).toEqual(SWIM);
            expect(exitRule(RULES, from, to)).toEqual(exitRule({ regions: { 1: PLAYTHROUGH } }, from, to));
        }
    });

    it('certifies clean; without the gate the world is STRICTER than AP, and L49 (the start) does not imply the Swim', () => {
        const run = (rules) => certifyPlaythroughMaze(rules, HELPERS, { native: true, atlas: ATLAS });
        const clean = run(RULES);
        expect(clean.problems).toEqual([]);
        expect(clean.accepted).toEqual([]);
        expect(run(withExitRule(RULES, 'level_49', 'level_50', { rule: 'True_' })).problems)
            .toEqual(['level_49 → level_50 holding []: derived false, atlas true']);
    }, 120_000);

    it('a stricter row is ACCEPTED when every AP route into its source needs the missing item — and named', () => {
        // L50 → L49 ungated: the world still needs the Swim, but no AP state stands in L50 without it.
        const out = certifyPlaythroughMaze(withExitRule(RULES, 'level_50', 'level_49', { rule: 'True_' }), HELPERS, { native: true, atlas: ATLAS });
        expect(out.problems).toEqual([]);
        expect(out.accepted).toEqual([{ label: 'level_50 → level_49 (landing 2,1)', source: 'level_50', by: 'Progressive Swim' }]);
    }, 120_000);

    it('a LOOSER row is never accepted, even where the source needs the item', () => {
        // The Conch is free in the world; an AP rule asking the Swim for it is looser in the world's direction.
        const conch = withLocationRule(RULES, 'level_49', 'Level 049 - Conch', SWIM);
        expect(certifyPlaythroughMaze(conch, HELPERS, { native: true, atlas: ATLAS }).problems)
            .toEqual(['level_49 @ Level 049 - Conch holding []: derived true, atlas false']);
        // L50's exit asks the Swim AND a key the world never needs: looser at [Swim], in a source that needs the Swim.
        const key = { rule: 'And', children: [SWIM, { rule: 'Has', args: { item_name: 'Green Key' } }] };
        const out = certifyPlaythroughMaze(withExitRule(RULES, 'level_50', 'level_49', key), HELPERS, { native: true, atlas: ATLAS });
        expect(out.problems).toEqual(['level_50 → level_49 (landing 2,1) holding [Progressive Swim]: derived true, atlas false']);
    }, 120_000);
});
