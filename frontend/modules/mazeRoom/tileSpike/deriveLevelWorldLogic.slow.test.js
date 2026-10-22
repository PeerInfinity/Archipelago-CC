/**
 * The level-world CERTIFIER (`certifyPlaythroughMaze.js`) on the committed `seedling_playthrough_maze` preset
 * (⚖ "Certifier", user 2026-10-21). ⚖ Tier split (user, 2026-10-21, session tile-primitives-grow-levels:
 * "Native all + scripted sample"): here, EVERY region on the NATIVE engine (⚖ Q6 "native default"), and the
 * SCRIPTED tile definition (⚖ Q3 "one def; logic by search" — `scriptedStep` + the helper bodies) on a fixed
 * SAMPLE, which must agree with the native lines for the same regions. The full scripted pass over every
 * region is the calib tier's (`deriveLevelWorldLogic.calib.test.js`): measured over the whole game it is
 * 346 s scripted against 50 s native.
 *
 * The sample: both shared level worlds the parity was built on (L15, L16) and one per-sub-region level (L14).
 *
 * Slow tier: ~35 s native (every region, then the sample again for its lines) + ~86 s scripted sample on one
 * core (measured 2026-10-21, L13–L17).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const RULES = JSON.parse(readFileSync(
    new URL('../../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const SAMPLE = ['level_14', 'level_15__r1c5', 'level_15__r1c9', 'level_15__r6c8', 'level_16__r1c1', 'level_16__r4c21'];

/**
 * ⛓ NAMED GAP "the arrow lane is not modelled in the maze (rope lane rocks)" (⚖ user 2026-10-22 "Land with exact
 * exemptions"; session rules-rope-events; maze.md § The preset). The atlas charges every L16 rope-lane cell with
 * the rope's event, rocks included (a lane rock costs weapon AND the cut); the projection makes the lane's rocks
 * (6,4), (6,5), (7,5) plain sword/spear rocks, so from r1c1 a weapon alone breaks (6,4) onto the lane's stairs.
 * The maze is LOOSER than the atlas there, and nowhere else. This is the exact problem list; it FAILS once the
 * arrow-lane slice models the lane as a hazard and the cut as an in-world action — delete it then.
 */
const ARROW_LANE_NOT_MODELLED = [
    'level_16__r1c1 → level_16__r3c7 holding [Ghost Spear]: derived true, atlas false',
];
/** A copy of the preset with one AP exit's rule replaced — the closure comparison's mutant controls. */
const withExitRule = (from, to, rule) => {
    const copy = structuredClone(RULES);
    const exit = copy.regions['1'][from].exits.find((e) => e.connected_region === to);
    expect(exit, `${from} -> ${to}`).toBeDefined();
    exit.access_rule = rule;
    return copy;
};

describe('seedling_playthrough_maze — every region certified against the atlas at every subset', () => {
    let sampleLines;
    it('native engine, every region', () => {
        const { problems, lines } = certifyPlaythroughMaze(RULES, HELPERS, { native: true });
        expect(problems).toEqual(ARROW_LANE_NOT_MODELLED);
        expect(lines.length).toBeGreaterThan(0);
        sampleLines = certifyPlaythroughMaze(RULES, HELPERS, { native: true, regions: SAMPLE }).lines;
    }, 300_000);
    it('scripted tile definition on the sample — and it agrees with the native one', () => {
        for (const r of SAMPLE) expect(Object.keys(RULES.preset_sidecars['1'])).toContain(r);
        const { problems, lines } = certifyPlaythroughMaze(RULES, HELPERS, { native: false, regions: SAMPLE });
        expect(problems).toEqual(ARROW_LANE_NOT_MODELLED);
        expect(lines).toEqual(sampleLines);
    }, 600_000);
    // ⛓ The in-world CLOSURE comparison is two-sided: a mutated in-world AP row that makes the atlas stricter than
    // the world (the world LOOSER), or looser than it, is still caught (rules-rope-events; asked by
    // tile-primitives-design). L15 alone: its world is certified when any member is in the sample.
    it('the closure comparison still catches an in-world row the world disagrees with, both ways', () => {
        const L15 = { native: true, regions: ['level_15__r1c5'] };
        expect(certifyPlaythroughMaze(RULES, HELPERS, L15).problems).toEqual([]);
        const looser = certifyPlaythroughMaze(withExitRule('level_15__r1c5', 'level_15__r1c9',
            { rule: 'Has', args: { item_name: 'Progressive Swim' } }), HELPERS, L15).problems;
        expect(looser.some((p) => p.startsWith('level_15__r1c5 → level_15__r1c9 holding') && p.endsWith('derived true, atlas false')),
            JSON.stringify(looser)).toBe(true);
        const stricter = certifyPlaythroughMaze(withExitRule('level_15__r1c5', 'level_15__r1c9', { rule: 'True_' }),
            HELPERS, L15).problems;
        expect(stricter.some((p) => p.startsWith('level_15__r1c5 → level_15__r1c9 holding') && p.endsWith('derived false, atlas true')),
            JSON.stringify(stricter)).toBe(true);
    }, 300_000);
});
