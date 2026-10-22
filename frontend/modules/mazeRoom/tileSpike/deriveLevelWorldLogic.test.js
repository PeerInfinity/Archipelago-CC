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
import { evaluateRuleAgainstInventory } from '../../shared/procgen/library.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const RULES = JSON.parse(readFileSync(
    new URL('../../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const R1C5 = 'level_15__r1c5';
const R1C9 = 'level_15__r1c9';
const l15 = () => deserializeMazeWorld(RULES.preset_sidecars['1'][R1C5].playable_payload);
const l16 = () => deserializeMazeWorld(RULES.preset_sidecars['1'].level_16__r1c1.playable_payload);
const ROPE = 'L16 flag 0: rope@32,16 cleared';

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
    // ⛓ rules-rope-events (⚖ user 2026-10-22 "Land with exact exemptions"): the L16 rope lane splits the level, so
    // the rocks crossing leaves from r1c9 (atlas row r1c9 → r4c21 = Or(Sword, Ghost Spear)) — still a weapon,
    // never Swim alone. r1c1 reaches r4c21 only THROUGH the rope-gated r1c9.
    it('L16 r1c9 → r4c21 is a weapon (its rocks), never Swim alone; witnesses replayed', () => {
        expect(crosses(l16(), 'level_16__r1c9', 'level_16__r4c21', [])).toBeNull();
        expect(crosses(l16(), 'level_16__r1c9', 'level_16__r4c21', ['Progressive Swim'])).toBeNull();
        expect(crosses(l16(), 'level_16__r1c9', 'level_16__r4c21', ['Progressive Sword'])).not.toBeNull();
        expect(crosses(l16(), 'level_16__r1c9', 'level_16__r4c21', ['Ghost Spear'])).not.toBeNull();
    });

    // ⛓ NAMED GAP "the missing rope event location" (maze.md § The preset): the projection emits no event location
    // for the atlas's game_state events, so nothing in this preset grants 'L16 flag 0: rope@32,16 cleared' and the
    // rope-gated sub-regions are unreachable from L16's arrival. Holding every real item still reaches none of
    // them. This FAILS once the arrow-lane slice emits the cut as an event location — delete it then.
    it('the missing rope event location: r1c9 / r3c7 / r6c8 are unreachable from r1c1 in the preset', () => {
        const REGIONS = RULES.regions['1'];
        const granted = new Set(Object.values(REGIONS).flatMap((r) => (r.locations ?? []).map((l) => l.name)));
        expect(granted.has(ROPE)).toBe(false);
        const real = new Set(['Progressive Sword', 'Ghost Spear', 'Progressive Swim', 'Fire']);
        const seen = new Set(['level_16__r1c1']);
        for (let grew = true; grew;) {
            grew = false;
            for (const from of [...seen]) {
                for (const e of REGIONS[from].exits) {
                    if (!seen.has(e.connected_region) && evaluateRuleAgainstInventory(e.access_rule ?? { rule: 'True_' }, real)) {
                        seen.add(e.connected_region);
                        grew = true;
                    }
                }
            }
        }
        for (const r of ['level_16__r1c9', 'level_16__r3c7', 'level_16__r6c8']) expect(seen.has(r), r).toBe(false);
        expect(seen.has('level_16__r1c1')).toBe(true);
    });

    it('every wired door is reached empty-handed from its region\'s arrival (the atlas: True_)', () => {
        const own = (name) => deserializeMazeWorld(RULES.preset_sidecars['1'][name].playable_payload);
        const doors = [
            [own('level_13'), 'level_13'], [own('level_14'), 'level_14'],
            [l15(), R1C5], [l15(), R1C9], [l16(), 'level_16__r1c1'], [l16(), 'level_16__r1c9'], [l16(), 'level_16__r3c7'],
            [own('level_17'), 'level_17'],
        ];
        const priced = doors.flatMap(([world, region]) => deriveEntryLogic(world, region, HELPERS, { native: true })
            .targets.filter((t) => t.kind === 'exit').map((t) => [t.exitName, t.minimal, `${t.x},${t.y}`]));
        const pit = ([name]) => name.startsWith('level_16__r1c9 -> level_17');
        expect(priced.filter((d) => !pit(d)).map(([name, minimal]) => [name, minimal])).toEqual([
            ['level_13 -> level_14', [[]]],
            ['level_14 -> level_15__r1c5', [[]]],
            ['level_14 -> level_13', [[]]],
            ['level_15__r1c5 -> level_14', [[]]],
            ['level_15__r1c9 -> level_16__r1c1', [[]]],
            ['level_16__r1c1 -> level_15__r1c9', [[]]],
            ['level_16__r3c7 -> level_17', [[]]],
            ['level_17 -> level_16__r3c7', [[]]],
        ]);
        // ⛓ L16's ways down to L17 (session tile-primitives-grow-levels): every one is free but the pit at (13,4),
        // which the other pits wall in — an exit tile ends a walk. The AP destination is one, and the certifier
        // prices it as the Or. Since rules-rope-events the rope lane splits L16: the seven pits are r1c9's, the
        // stairs (7,4) r3c7's, and L17's stairs land in r3c7.
        const pits = priced.filter(pit);
        expect(pits).toHaveLength(7);
        expect(pits.filter(([, minimal]) => minimal.length === 0).map(([, , at]) => at)).toEqual(['13,4']);
        for (const [, minimal, at] of pits) if (at !== '13,4') expect(minimal, at).toEqual([[]]);
    });
});
