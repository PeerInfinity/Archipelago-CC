/**
 * The level-world CERTIFIER on Seedling L15 (⚖ "Certifier", user 2026-10-21; session
 * tile-primitives-stage2-l15) — the default tier's cut: the oracle's crossing r1c5 → r1c9 at the four
 * inventories that decide it, from the NATIVE engine (`nativeReachUnder`), every witness replayed on the
 * real `step`. The full certification (every sub-region pair, the whole lattice, the scripted tile
 * definition too) is `deriveLevelWorldLogic.slow.test.js`.
 *
 * The oracle (rules-block-path, `flashPanel/seedlingBlockPaths.js`): r1c5 → r1c9 = Or(weapon, Swim),
 * weapon = Progressive Sword | Ghost Spear — the atlas row the preset compiles.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserializeMazeWorld, createState, step, sharedWorldOwnerAt } from '../mazeRoomEngine.js';
import { nativeReachUnder, enteredAt, deriveEntryLogic } from './deriveLevelWorldLogic.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const RULES = JSON.parse(readFileSync(
    new URL('../../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const R1C5 = 'level_15__r1c5';
const R1C9 = 'level_15__r1c9';
const l15 = () => deserializeMazeWorld(RULES.preset_sidecars['1'][R1C5].playable_payload);
const l16 = () => deserializeMazeWorld(RULES.preset_sidecars['1'].level_16__r1c1.playable_payload);

/** A cell `to` owns, reached under `inventory` from `from`'s arrival — and its witness replayed on `step`. */
function crosses(world, from, to, inventory) {
    const entered = enteredAt(world, from);
    const reach = nativeReachUnder(entered, inventory);
    const cell = [...reach.cells.keys()].find((c) => {
        const [x, y] = c.split(',').map(Number);
        return sharedWorldOwnerAt(world, x, y) === to;
    });
    if (!cell) return null;
    const plan = reach.planTo(cell);
    const w = { ...entered, items: new Map() };
    let s = createState(w);
    s.inventory = new Set(inventory);
    for (const input of plan) {
        s = step(w, s, input);
        expect(s, `witness step ${input} refused`).not.toBeNull();
    }
    expect(`${s.player_pos.x},${s.player_pos.y}`).toBe(cell);
    return plan;
}

describe('L15 level world — the oracle crossing r1c5 → r1c9', () => {
    it.each([
        [[], false],
        [['Progressive Sword'], true],
        [['Ghost Spear'], true],
        [['Progressive Swim'], true],
    ])('holding %j: crosses = %s (every witness replayed on the engine)', (inventory, expected) => {
        expect(crosses(l15(), R1C5, R1C9, inventory) !== null).toBe(expected);
    });

    it('the weapon witness strikes BOTH rocks and pushes the block onto the button', () => {
        const plan = crosses(l15(), R1C5, R1C9, ['Progressive Sword']);
        expect(plan.filter((i) => i === 'USE:sword')).toHaveLength(2);
    });

    it('the way BACK r1c9 → r1c5 is Swim only: the lock re-closes for a fresh arrival (atlas row = Swim)', () => {
        expect(crosses(l15(), R1C9, R1C5, ['Progressive Sword', 'Ghost Spear'])).toBeNull();
        expect(crosses(l15(), R1C9, R1C5, ['Progressive Swim'])).not.toBeNull();
    });
});

/**
 * The preset's growth (⚖ "L14 + L16", user 2026-10-21; session tile-primitives-levels-gap3) — the default
 * tier's cut. The whole preset at every subset is the slow file.
 */
describe('L13–L17 — the doors and the second level world', () => {
    it('L16 r1c1 → r4c21 is a weapon (its rocks), never Swim alone; witnesses replayed', () => {
        expect(crosses(l16(), 'level_16__r1c1', 'level_16__r4c21', [])).toBeNull();
        expect(crosses(l16(), 'level_16__r1c1', 'level_16__r4c21', ['Progressive Swim'])).toBeNull();
        expect(crosses(l16(), 'level_16__r1c1', 'level_16__r4c21', ['Progressive Sword'])).not.toBeNull();
        expect(crosses(l16(), 'level_16__r1c1', 'level_16__r4c21', ['Ghost Spear'])).not.toBeNull();
    });

    it('every wired door is reached empty-handed from its region\'s arrival (the atlas: True_)', () => {
        const own = (name) => deserializeMazeWorld(RULES.preset_sidecars['1'][name].playable_payload);
        const doors = [
            [own('level_13'), 'level_13'], [own('level_14'), 'level_14'],
            [l15(), R1C5], [l15(), R1C9], [l16(), 'level_16__r1c1'], [own('level_17'), 'level_17'],
        ];
        const priced = doors.flatMap(([world, region]) => deriveEntryLogic(world, region, HELPERS, { native: true })
            .targets.filter((t) => t.kind === 'exit').map((t) => [t.exitName, t.minimal, `${t.x},${t.y}`]));
        const pit = ([name]) => name.startsWith('level_16__r1c1 -> level_17');
        expect(priced.filter((d) => !pit(d)).map(([name, minimal]) => [name, minimal])).toEqual([
            ['level_13 -> level_14', [[]]],
            ['level_14 -> level_15__r1c5', [[]]],
            ['level_14 -> level_13', [[]]],
            ['level_15__r1c5 -> level_14', [[]]],
            ['level_15__r1c9 -> level_16__r1c1', [[]]],
            ['level_16__r1c1 -> level_15__r1c9', [[]]],
            ['level_17 -> level_16__r1c1', [[]]],
        ]);
        // ⛓ L16's eight ways down to L17 (the stairs + seven pit cells; session tile-primitives-grow-levels): every
        // one is free but the pit at (13,4), which the other pits wall in — an exit tile ends a walk. The AP
        // destination is one, and the certifier prices it as the Or of the eight.
        const pits = priced.filter(pit);
        expect(pits).toHaveLength(8);
        expect(pits.filter(([, minimal]) => minimal.length === 0).map(([, , at]) => at)).toEqual(['13,4']);
        for (const [, minimal, at] of pits) if (at !== '13,4') expect(minimal, at).toEqual([[]]);
    });
});
