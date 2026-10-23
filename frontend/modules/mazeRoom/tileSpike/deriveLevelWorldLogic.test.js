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
import { nativeReachUnder, enteredAt } from './deriveLevelWorldLogic.js';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };
import { evaluateRuleAgainstInventory } from '../../shared/procgen/library.js';

const RULES = JSON.parse(readFileSync(
    new URL('../../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const ATLAS = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));
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

    // ⛓ The rope cut is an EVENT LOCATION (slice tile-primitives-arrow-rope, ⚖ 2026-10-22 "Both: this visit + event
    // item"), which restores what the named gap "the missing rope event location" (rules-rope-events) cut off: from
    // the start, holding every real item, L16's four rope-gated sub-regions, L17 and its placed Seal were
    // unreachable. Now everything is — and the gate is real: without Sword, Spear or Fire exactly that set stays cut
    // off. The completion condition is constant, so the goal is untouched.
    const RESTORED_REGIONS = ['level_16__r1c9', 'level_16__r3c7', 'level_16__r4c21', 'level_16__r6c8', 'level_17'];
    const reachFromStart = (items) => {
        const REGIONS = RULES.regions['1'];
        const inv = new Set(items);
        const holds = (rule) => evaluateRuleAgainstInventory(rule ?? { rule: 'True_' }, inv);
        const seen = new Set(['Menu']);
        const got = new Set();
        for (let grew = true; grew;) {
            grew = false;
            for (const from of [...seen]) {
                for (const e of REGIONS[from].exits) {
                    if (!seen.has(e.connected_region) && holds(e.access_rule)) { seen.add(e.connected_region); grew = true; }
                }
                for (const l of REGIONS[from].locations ?? []) {
                    if (got.has(l.name) || !holds(l.access_rule)) continue;
                    got.add(l.name);
                    if (l.event) { inv.add(l.item.name); grew = true; }
                }
            }
        }
        const allLocations = Object.values(REGIONS).flatMap((r) => (r.locations ?? []).map((l) => l.name));
        return {
            unreached: Object.keys(REGIONS).filter((r) => !seen.has(r)).sort(),
            unchecked: allLocations.filter((l) => !got.has(l)).sort(),
        };
    };
    it('the rope cut is an event location in r1c1 (Sword | Spear | Fire), and it restores L17 and its Seal', () => {
        const event = RULES.regions['1'].level_16__r1c1.locations.find((l) => l.name === ROPE);
        expect(event).toMatchObject({ event: true, locked: true, item: { name: ROPE } });
        expect(event.access_rule.children.map((c) => c.args.item_name).sort()).toEqual(['Fire', 'Ghost Spear', 'Progressive Sword']);
        // Every item the preset's rules ask for, but the rope's event (its location grants it), plus the pool.
        const ruleItems = (rule, out) => {
            if (rule?.rule === 'Has') out.add(rule.args.item_name);
            for (const c of rule?.children ?? []) ruleItems(c, out);
            return out;
        };
        const asked = new Set(Object.keys(RULES.itempool_counts['1']));
        for (const r of Object.values(RULES.regions['1'])) {
            for (const e of r.exits) ruleItems(e.access_rule, asked);
            for (const l of r.locations ?? []) ruleItems(l.access_rule, asked);
        }
        const REAL = [...asked].filter((i) => i !== ROPE);
        expect(reachFromStart(REAL)).toEqual({ unreached: [], unchecked: [] });
        expect(reachFromStart(REAL.filter((i) => !['Progressive Sword', 'Ghost Spear', 'Fire'].includes(i))))
            .toEqual({ unreached: RESTORED_REGIONS, unchecked: [ROPE, 'Level 017 - Chest'] });
        expect(RULES.game_info['1'].completion_condition).toEqual({ type: 'constant', value: true });
    });

    // ⚖ user 2026-10-21 (memory feedback_l16_arrowtrap_from_l17_refusal_is_correct): L16 from L17 with the arrow trap
    // ARMED must refuse — it is silenced only from the L15 side; logic never expects tanking a hit. Held by MECHANICS:
    // L17's stairs land in the lane (r3c7), so that arrival reaches nothing whatever the player carries but the cut,
    // while from r1c1 any of the three strikes cuts the rope and opens the lane.
    it('⚖ L16 from L17 refuses while the trap is armed; from the L15 side any strike opens it', () => {
        const EVERY = ['Progressive Sword', 'Ghost Spear', 'Fire', 'Progressive Swim'];
        expect(nativeReachUnder(enteredAt(l16(), 'level_16__r3c7'), EVERY).cells.size).toBe(0);
        expect(nativeReachUnder(enteredAt(l16(), 'level_16__r3c7'), [ROPE]).cells.size).toBeGreaterThan(0);
        // Fire, the action the rope added (Sword and Spear: the slow tier's full lattice, every witness replayed).
        const plan = crosses(l16(), 'level_16__r1c1', 'level_16__r3c7', ['Fire']);
        expect(plan).not.toBeNull();
        expect(plan).toContain('USE:fire');
        expect(crosses(l16(), 'level_16__r1c1', 'level_16__r3c7', ['Progressive Swim'])).toBeNull();
    });

    // ⚖ The same rule at the CROSSING (asked by seedling-js-planning-8): the certifier prices L17's stairs down as taken
    // only when the arrival in L16 is not a hit, so `level_17 -> level_16__r3c7` derives as exactly the cut — no walk
    // through the armed lane at any inventory of real items. Mutant: an AP rule of True_ there is caught as stricter.
    it('⚖ the L17 → L16 crossing derives as the cut alone; an AP rule that lets it through armed is caught', () => {
        const L17 = { native: true, regions: ['level_17'], atlas: ATLAS };
        const { problems, lines } = certifyPlaythroughMaze(RULES, HELPERS, L17);
        expect(problems).toEqual([]);
        expect(lines).toContain(`level_17->level_16__r3c7=${JSON.stringify([[ROPE]])}`);
        const loose = structuredClone(RULES);
        loose.regions['1'].level_17.exits.find((e) => e.connected_region === 'level_16__r3c7').access_rule = { rule: 'True_' };
        // ⛓ Two contexts (⚖ user 2026-10-23 "Both contexts", session tile-primitives-gated-tiles). In L13–L17 every AP
        // route into L17 needs the cut, so the ungated crossing is ACCEPTED by name (⚖ "Accept if implied")…
        const inPreset = certifyPlaythroughMaze(loose, HELPERS, L17);
        expect(inPreset.problems).toEqual([]);
        expect(inPreset.accepted).toEqual([{ label: 'level_17 → level_16__r3c7', source: 'level_17', by: ROPE }]);
        // …and once L17 has a way in without the cut (as L18 will give it), the same rule is the exact problem.
        loose.regions['1'].Menu.exits.push({ name: 'Menu -> level_17', connected_region: 'level_17', access_rule: { rule: 'True_' } });
        expect(certifyPlaythroughMaze(loose, HELPERS, L17).problems)
            .toEqual(['level_17 → level_16__r3c7 holding []: derived false, atlas true']);
    });

    it('every wired door is reached empty-handed from its region\'s arrival (the atlas: True_)', () => {
        const own = (name) => deserializeMazeWorld(RULES.preset_sidecars['1'][name].playable_payload);
        // One reach per region at a FIXED inventory (the full lattice over L16's five items is the slow tier's).
        const doorsAt = (world, region, inventory) => {
            const entered = world.sharedWorld ? enteredAt(world, region) : world;
            const reach = nativeReachUnder(entered, inventory);
            return [...world.exits.values()].filter((e) => e.targetRegion
                && (!world.sharedWorld || sharedWorldOwnerAt(world, e.x, e.y) === region))
                .map((e) => [e.exitName, reach.cells.has(`${e.x},${e.y}`), `${e.x},${e.y}`]);
        };
        const doors = [
            [own('level_13'), 'level_13'], [own('level_14'), 'level_14'],
            [l15(), R1C5], [l15(), R1C9], [l16(), 'level_16__r1c1'], [l16(), 'level_16__r1c9'],
            [own('level_17'), 'level_17'],
        ];
        const priced = doors.flatMap(([world, region]) => doorsAt(world, region, []));
        const pit = ([name]) => name.startsWith('level_16__r1c9 -> level_17');
        expect(priced.filter((d) => !pit(d)).map(([name, free]) => [name, free])).toEqual([
            ['level_13 -> level_14', true],
            ['level_14 -> level_15__r1c5', true],
            ['level_14 -> level_13', true],
            ['level_15__r1c5 -> level_14', true],
            ['level_15__r1c9 -> level_16__r1c1', true],
            ['level_16__r1c1 -> level_15__r1c9', true],
            ['level_17 -> level_16__r3c7', true],
        ]);
        // ⛓ L16's ways down to L17 (session tile-primitives-grow-levels): every one is free but the pit at (13,4),
        // which the other pits wall in — an exit tile ends a walk. The AP destination is one, and the certifier
        // prices it as the Or. Since rules-rope-events the rope lane splits L16: the seven pits are r1c9's, the
        // stairs (7,4) r3c7's, and L17's stairs land in r3c7.
        const pits = priced.filter(pit);
        expect(pits).toHaveLength(7);
        expect(pits.filter(([, free]) => !free).map(([, , at]) => at)).toEqual(['13,4']);
        // ⛓ The stairs stand in the lane (slice tile-primitives-arrow-rope): from r3c7's own arrival — L17's landing —
        // they are taken only with the cut (the lane's arrival reaches nothing while armed).
        expect(doorsAt(l16(), 'level_16__r3c7', []).map(([n, free]) => [n, free])).toEqual([['level_16__r3c7 -> level_17', false]]);
        expect(doorsAt(l16(), 'level_16__r3c7', [ROPE]).map(([n, free]) => [n, free])).toEqual([['level_16__r3c7 -> level_17', true]]);
    });
});
