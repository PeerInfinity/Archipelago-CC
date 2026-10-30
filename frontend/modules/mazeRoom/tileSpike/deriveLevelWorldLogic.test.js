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
describe('L0 + L13–L20 — the doors and the second level world', () => {
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
    // off. The completion condition is constant, so the goal is untouched. L18 (session tile-primitives-grow-l18) is
    // entered only from r4c21, so it joins that set.
    const RESTORED_REGIONS = ['level_16__r1c9', 'level_16__r3c7', 'level_16__r4c21', 'level_16__r6c8', 'level_17',
        'level_18__r1c1', 'level_18__r7c10'];
    // ⛓ Each item held at the HIGHEST count the preset's rules name (a count Map; a Set holds one of each): L0's
    // islands r1c6 / r2c13 / r4c16 are reached only by the waterfall climb, Has(Progressive Swim, 2) (session
    // tile-primitives-grow-ring2 — the preset's first counted rule that alone opens a region).
    const maxCount = new Map();
    const countsIn = (rule) => {
        if (rule?.rule === 'Has') {
            const n = rule.args.count ?? 1;
            maxCount.set(rule.args.item_name, Math.max(maxCount.get(rule.args.item_name) ?? 1, n));
        }
        for (const c of rule?.children ?? []) countsIn(c);
    };
    for (const r of Object.values(RULES.regions['1'])) {
        for (const e of r.exits) countsIn(e.access_rule);
        for (const l of r.locations ?? []) countsIn(l.access_rule);
    }
    const reachFromStart = (items) => {
        const REGIONS = RULES.regions['1'];
        const inv = new Map(items.map((i) => [i, maxCount.get(i) ?? 1]));
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
                    if (l.event) { inv.set(l.item.name, 1); grew = true; }
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
        // ⛓ tile-primitives-sphere-order-9 (sphere 8.5 joined): regions no AP exit of the preset enters — L84's r0c0 and r3c0 have no
        // AP entrance in the `seedling_playthrough` rules either (L85's landings there are arrival-only). L80's r16c1 (and r12c3 / r8c4
        // past it) were entered only from L79 until sphere 9.10 joined (session tile-primitives-sphere-order-10).
        const UNENTERED = ['level_84__r0c0', 'level_84__r3c0'];
        expect(reachFromStart(REAL)).toEqual({ unreached: UNENTERED, unchecked: [] });
        // Ring 2 (session tile-primitives-grow-ring2) brings weapon gates of its own: L0's rocks (Sword | Spear) close
        // r11c19 and, past it, r1c6 (and their two rock events); L19's crossings into r1c5 / r5c5 are the Sword (and its
        // Boss Key and Shieldspire with them). Without the three weapons that set is cut off beside the rope's.
        // ⛓ tile-primitives-pixelmask-l86: + level_0__r6c5, the house-door pocket the L0 door rock stands in (the house's
        // Pixelmask leaves the door tile clear, so the door is its own sub-region behind the rock).
        // ⛓ tile-primitives-sphere-order-2 (sphere 0.1 joined): r11c19 is reached now — through L12 r0c19, whose way back
        // costs the rock's EVENT, which this inventory holds as an item; L1 (behind r6c5's rock), L67's key room (the spear
        // block) and L92's four sub-regions (Sword | Spear crossings) are the weapon-gated set's new members.
        // ⛓ tile-primitives-sphere-order-3 (sphere 2.2 joined): no region joins the set, but two events do — L24's burnable tree
        // (Fire) and L28's rope (Sword | Spear | Fire, the cut that drops its fallrock on the grass lock's button).
        // ⛓ tile-primitives-sphere-order-4 (L34 + L32 joined): no region joins the set; L32's two boss locations do (the
        // fight's Or(Sword, Ghost Spear)).
        // ⛓ tile-primitives-sphere-order-5 (sphere 4.5 joined): L48's four sub-regions and L49 (past L48) join the set, with L48's
        // Chest and boss lock and L49's Conch.
        // ⛓ tile-primitives-sphere-order-6 (sphere 5.3 joined): L39 past r25c9 (its Fire and weapon crossings), all of L40 and L43
        // (reached only through L39 r0c9: L43's stairs to L37 are one way) join the set, with every location in them and L40's boss lock.
        // ⛓ tile-primitives-sphere-order-7 (sphere 5.6 joined): L50–L56 hang off L49, so they join the set with L55's Boss Key; so do
        // L61 r13c12 and L63 past r0c1 (Ghost Spear crossings; L63's Chest) and L93 below r14c7. L92 r1c7 / r4c2 / r7c8 LEAVE it: L91
        // (from L89 r1c10, by the Swim) enters L92 r4c2 free.
        // ⛓ tile-primitives-lightpoles (sphere 6.1 + every pole): no region joins the set (L62's trap opens by L63's press, free), but
        // L63's two in-room pole events do — each is a Ghost Spear thrust from one of its stances.
        // ⛓ tile-primitives-sphere-order-8 (spheres 6.5/6.10/7.8 joined): every new region hangs off a member of the set — L41/L42 off L40,
        // L57/L58 off L56 (and L46), L65/L66/L68 off L63's pockets — so all join it, with their locations and the Yeti / L65 pole / L68 lock events.
        // ⛓ rules-collider-mismatch: level_65__r4c13 -> r4c11 (the open tree's doorway [11,4] is floor; a pixel-mask wall seals its mask).
        // ⛓ tile-primitives-sphere-order-9 (sphere 8.5 joined): L69–L75 and L80's rooted half hang off L66 (in the set), so they join it with
        // their locations and L71's shield lock; L83, L84 r2c4, L85 and L71 r13c7 hang off L12 r42c28's events and stay out of it.
        // ⛓ tile-primitives-sphere-order-10 (sphere 9.10 joined): L76–L79 hang off L71 r16c19 (in the set), so they join it with L79's
        // Dark Suit, and so does the half of L80 entered from L79 (r16c1, and r12c3 / r8c4 past it), no longer unentered.
        const RING2_WEAPON_GATED = ['level_0__r1c6', 'level_0__r6c5', 'level_19__r1c5', 'level_19__r5c5'];
        const SPHERE01_WEAPON_GATED = ['level_1', 'level_67__r3c2', 'level_92__r3c12'];
        const SPHERE45_WEAPON_GATED = ['level_48__r11c9', 'level_48__r2c10', 'level_48__r4c3', 'level_48__r7c0', 'level_49'];
        const SPHERE53_WEAPON_GATED = ['level_39__r0c9', 'level_39__r2c11', 'level_40__r0c53', 'level_40__r23c29', 'level_40__r32c36',
            'level_40__r36c35', 'level_40__r48c54', 'level_43__r13c7', 'level_43__r3c8', 'level_43__r8c7'];
        const SPHERE56_WEAPON_GATED = ['level_50', 'level_51__r14c6', 'level_51__r2c6', 'level_51__r3c10', 'level_51__r3c4', 'level_52__r0c7',
            'level_52__r2c2', 'level_52__r5c10', 'level_53__r14c9', 'level_53__r2c2', 'level_53__r9c10', 'level_54__r10c5', 'level_54__r13c9',
            'level_54__r16c8', 'level_54__r18c15', 'level_54__r18c19', 'level_54__r19c13', 'level_54__r1c8', 'level_54__r27c8', 'level_54__r8c11',
            'level_55', 'level_56', 'level_61__r13c12', 'level_63__r10c2', 'level_63__r5c14', 'level_63__r6c15', 'level_63__r6c9',
            'level_93__r10c7', 'level_93__r5c7'];
        const SPHERE8_WEAPON_GATED = ['level_41__r4c15', 'level_41__r4c3', 'level_41__r7c15', 'level_42', 'level_57', 'level_58__r1c2',
            'level_58__r1c4', 'level_58__r2c1', 'level_58__r2c5', 'level_58__r3c3', 'level_58__r4c1', 'level_58__r6c5', 'level_65__r0c2',
            'level_65__r0c8', 'level_65__r4c11', 'level_66__r5c4', 'level_66__r9c8', 'level_68__r1c1', 'level_68__r3c1'];
        const SPHERE85_WEAPON_GATED = ['level_69', 'level_70', 'level_71__r0c6', 'level_71__r11c7', 'level_71__r14c12', 'level_71__r16c19',
            'level_72', 'level_73__r0c4', 'level_73__r3c7', 'level_74', 'level_75', 'level_80__r0c2', 'level_80__r6c4', 'level_80__r8c1'];
        const SPHERE910_WEAPON_GATED = ['level_76', 'level_77', 'level_78__r0c16', 'level_78__r0c2', 'level_79__r0c4', 'level_79__r8c4',
            'level_80__r12c3', 'level_80__r16c1', 'level_80__r8c4'];
        expect(reachFromStart(REAL.filter((i) => !['Progressive Sword', 'Ghost Spear', 'Fire'].includes(i))))
            .toEqual({
                unreached: [...RESTORED_REGIONS, ...RING2_WEAPON_GATED, ...SPHERE01_WEAPON_GATED, ...SPHERE45_WEAPON_GATED,
                    ...SPHERE53_WEAPON_GATED, ...SPHERE56_WEAPON_GATED, ...SPHERE8_WEAPON_GATED, ...SPHERE85_WEAPON_GATED,
                    ...SPHERE910_WEAPON_GATED, ...UNENTERED].sort(),
                unchecked: ['L0 flag 1: breakablerock@288,176 cleared', 'L0 flag 4: breakablerock@80,112 cleared', ROPE,
                    'L24 flag 0: burnabletree@32,128 cleared', 'L28 flag 0: rope@160,64 cleared', 'L40 flag 8: bosslock@480,352 cleared',
                    'L48 flag 1: bosslock@48,144 cleared', 'L58 flag 1: yeti@56,56 cleared', 'L63 flag 6: lightpole@48,272 cleared',
                    'L63 flag 7: lightpole@112,272 cleared', 'L65 flag 0: lightpole@128,168 cleared', 'L68 flag 0: bosslock@16,32 cleared', 'L71 flag 2: shieldlock@288,256 cleared',
                    'Level 017 - Chest', 'Level 019 - Boss Key 0', 'Level 019 - Shieldspire',
                    'Level 032 - Bob Boss', 'Level 032 - Times', 'Level 039 - Totem Part 72,40', 'Level 040 - Boss Key 2', 'Level 040 - Chest',
                    'Level 040 - Totem Part 160,640', 'Level 040 - Totem Part 64,144', 'Level 041 - Totem Part 240,144',
                    'Level 042 - Totem Part 184,152', 'Level 043 - Totem of Lacste', 'Level 043 - Wand',
                    'Level 048 - Chest', 'Level 049 - Conch', 'Level 055 - Boss Key 3', 'Level 057 - Tentacled Beast', 'Level 063 - Chest',
                    'Level 067 - Boss Key 4', 'Level 068 - Health', 'Level 069 - Lights', 'Level 071 - Chest', 'Level 074 - Darkshield',
                    'Level 079 - Darksuit', 'Level 080 - Chest'],
            });
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
        // Priced from where the game lands L17 (session tile-primitives-pit-sinks-landings: landing-rooted arrivals).
        expect(lines).toContain(`level_17->level_16__r3c7<@3,3=${JSON.stringify([[ROPE]])}`);
        const loose = structuredClone(RULES);
        loose.regions['1'].level_17.exits.find((e) => e.connected_region === 'level_16__r3c7').access_rule = { rule: 'True_' };
        // ⛓ Two contexts (⚖ user 2026-10-23 "Both contexts", session tile-primitives-gated-tiles). In L13–L17 every AP
        // route into L17 needs the cut, so the ungated crossing is ACCEPTED by name (⚖ "Accept if implied")…
        const inPreset = certifyPlaythroughMaze(loose, HELPERS, L17);
        expect(inPreset.problems).toEqual([]);
        expect(inPreset.accepted).toEqual([{ label: 'level_17 → level_16__r3c7 (landing 3,3)', source: 'level_17', by: ROPE }]);
        // …and once L17 has a way in without the cut (as L18 will give it), the same rule is the exact problem.
        loose.regions['1'].Menu.exits.push({ name: 'Menu -> level_17', connected_region: 'level_17', access_rule: { rule: 'True_' } });
        // (A start edge makes L17's entrance an arrival again; the landing (3,3) reaches it both ways, so one search.)
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
            ['level_13 -> level_0__r7c6', true],
            ['level_13 -> level_20__r3c1', true],
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
