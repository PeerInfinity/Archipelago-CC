/**
 * Q3 search prototype — derived logic on a GENERATED gadget room, held to the ENGINE.
 *
 * The room: `generateMazeLevel` seed 2, 15×15, `skeleton=rooms`, `areas=1`, `guard;len=2;turns=1`
 * (the reverse-pull gadget guards the area flag `flag_K0`). Two variants add a rule obstacle
 * Or(Progressive Sword, Progressive Swim) — the L15 shape, where a block's path to its button
 * crosses an item-gated rock: `lane` on (8,4), which the block is pushed through AND the player
 * must step on to push it north; `button` on the button (8,3) itself, the one cell only the BLOCK
 * enters — a pure block-path gate.
 *
 * ⛓ The soundness check is EXHAUSTIVE on the real `step`: for every subset of the region's items,
 * the engine reaches a target ⇔ the derived rule holds (⚖ user: never an invalid solution; every
 * requirement replayable on the engine). Each witness plan is replayed through `step` too.
 */
import { describe, it, expect } from 'vitest';
import { createState, step, getExitAt, mazeVisitedKey, setObstacle, extractPathsAndObstacles, worldInputs } from '../mazeRoomEngine.js';
import { generateMazeLevel, MAZE_PALETTE } from '../procgenMaze.js';
import { parseAreaSpec } from '../../procgenCore/areaSpec.js';
import { parseElementSpec } from '../../procgenCore/elementSpec.js';
import { parseSkeleton } from '../../procgenCore/skeletonKinds.js';
import { compileRegion } from '../../shared/procgen/pathsAndObstaclesCompiler.js';
import { evaluateRuleAgainstInventory } from '../../shared/procgen/library.js';
import { deriveRegionLogic, regionItems, ruleFromMinimalSets, reachUnder } from './deriveTileLogic.js';
import { deriveEntryLogic, nativeReachUnder } from './deriveLevelWorldLogic.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };
import { setTile, TILE_WALL, useInput } from '../mazeRoomEngine.js';
import {
    itemActionPicture, SWORD, arrowTrapPicture, ARROW_ROPE, ROPE_EVENT,
} from '../mazeItemActions.fixtures.js';

const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const WEAPON_OR_SWIM = { rule: 'Or', children: [has('Progressive Swim'), has('Progressive Sword')] };
const ROCK = {
    name: 'Rock', id: 'rock', clear_set_type: 'rule',
    clear_rule: { rule: 'Or', children: [has('Progressive Sword'), has('Progressive Swim')] },
};

const ROCK_AT = { lane: [8, 4], button: [8, 3] };

function guardRoom({ rock = null } = {}) {
    const out = generateMazeLevel({
        seed: 2, palette: MAZE_PALETTE, width: 15, height: 15,
        skeleton: parseSkeleton('rooms', { simulator: true, substrate: 'the tile-logic test' }),
        areas: parseAreaSpec('1'), elements: parseElementSpec('guard;len=2;turns=1'),
    });
    const w = out.record;
    if (rock) {
        w.obstacleLib = { ...w.obstacleLib, rock: ROCK };
        setObstacle(w, ...ROCK_AT[rock], 'rock');
    }
    return w;
}

/** The engine's own answer: BFS over the REAL `step` holding `inventory`; exits are dead ends. */
function engineCells(world, inventory, pickups) {
    const w = pickups === 'ap' ? { ...world, items: new Map() } : world;
    const start = createState(w);
    start.inventory = new Set(inventory);
    const seen = new Set([mazeVisitedKey(start)]);
    const cells = new Set([`${start.player_pos.x},${start.player_pos.y}`]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
        const s = queue[head];
        if (head > 0 && getExitAt(w, s.player_pos.x, s.player_pos.y) !== null) continue;
        for (const input of worldInputs(w)) {
            const n = step(w, s, input);
            if (n === null || seen.has(mazeVisitedKey(n))) continue;
            seen.add(mazeVisitedKey(n));
            cells.add(`${n.player_pos.x},${n.player_pos.y}`);
            queue.push(n);
        }
    }
    return cells;
}

function allSubsets(items) {
    return Array.from({ length: 1 << items.length }, (_, m) => items.filter((_, i) => m & (1 << i)));
}

/** Every (subset, target) where the derived rule and the engine disagree. */
function engineDisagreements(world, derived, pickups) {
    const out = [];
    for (const set of allSubsets(derived.items)) {
        const cells = engineCells(world, set, pickups);
        for (const t of derived.targets) {
            const rule = ruleFromMinimalSets(t.minimal);
            const ruled = evaluateRuleAgainstInventory(rule, new Set(set));
            const engine = cells.has(`${t.x},${t.y}`);
            if (ruled !== engine) out.push(`${t.id} under {${set}}: rule=${ruled} engine=${engine}`);
        }
    }
    return out;
}

const rulesById = (derived) => Object.fromEntries(derived.targets.map((t) => [t.id, ruleFromMinimalSets(t.minimal)]));

describe('Q3 search — the generated guard room', () => {
    it('is the room this test was written against (block, button, guard door, flag)', () => {
        const w = guardRoom();
        expect([...w.blocks.keys()]).toEqual(['9,4']);
        expect([...w.buttons]).toEqual([['8,3', 'button_A0']]);
        expect(w.obstacles.get('6,3')).toBe('door_A0');
        expect(w.items.get('5,3')).toBe('flag_K0');
        expect(regionItems(guardRoom({ rock: 'lane' })))
            .toEqual(['Progressive Swim', 'Progressive Sword', 'flag_K0', 'key_red']);
    });

    it('derives the AP rules (plain room; a rock on the block\'s path = the L15 shape)', () => {
        const plain = rulesById(deriveRegionLogic(guardRoom(), HELPERS));
        const lane = rulesById(deriveRegionLogic(guardRoom({ rock: 'lane' }), HELPERS));
        const button = rulesById(deriveRegionLogic(guardRoom({ rock: 'button' }), HELPERS));
        const common = {
            'key_red@5,12': { rule: 'False_' }, 'key_red@8,12': { rule: 'False_' },
            'key_red@0,4': { rule: 'True_' }, 'exit:goal': has('flag_K0'),
        };
        expect(plain).toEqual({ ...common, 'flag_K0@5,3': { rule: 'True_' }, 'key_red@7,3': { rule: 'True_' } });
        expect(lane).toEqual({ ...common, 'flag_K0@5,3': WEAPON_OR_SWIM, 'key_red@7,3': WEAPON_OR_SWIM });
        // A BLOCK-ONLY gate still gates a PLAYER location: with the button shut the block has nowhere
        // to go but (8,4), the corridor to key_red@7,3 — so the key pays for a rock the player never
        // touches. (First written expecting True_; the engine check below said otherwise.)
        expect(button).toEqual({ ...common, 'flag_K0@5,3': WEAPON_OR_SWIM, 'key_red@7,3': WEAPON_OR_SWIM });
    });

    /**
     * The path-extracted logic (`extractPathsAndObstacles` → `compileRegion`) used to differ at two
     * targets, both DEFECTS of that logic (the engine checks below arbitrated): (T1) flag_K0 needed
     * the HELD token `sw_A0`, never an AP item; (T2) flag_K0 and key_red@7,3 needed `key_red` — the
     * ONE ghost path crossed door_red (7,1) though another route avoids it. Fixed by slice
     * maze-logic-t1t2-fix (all-routes minimal sets; a block world priced by the engine), which
     * uses THIS search as its oracle: on all three variants the two now agree target for target.
     */
    it('the path-extracted logic agrees with the derived logic (T1/T2 fixed)', () => {
        for (const rock of [null, 'lane', 'button']) {
            const w = guardRoom({ rock });
            const extracted = compileRegion(extractPathsAndObstacles(w), { obstacleLib: w.obstacleLib });
            const derived = rulesById(deriveRegionLogic(w, HELPERS));
            const byId = {
                ...Object.fromEntries(extracted.locations.map((l) => [`${l.item}@${l.position.x},${l.position.y}`, l.rule])),
                ...Object.fromEntries(extracted.exits.map((e) => [`exit:${e.id}`, e.rule])),
            };
            expect(byId).toEqual(derived);
        }
    });

    for (const pickups of ['ap', 'in-room']) {
        for (const rock of [null, 'lane', 'button']) {
            it(`${pickups}${rock ? ` + rock on the ${rock}` : ''}: the engine agrees with the derived rule at EVERY subset`, () => {
                const w = guardRoom({ rock });
                const derived = deriveRegionLogic(w, HELPERS, { pickups });
                expect(engineDisagreements(w, derived, pickups)).toEqual([]);
                expect(derived.skipped).toBeGreaterThan(0); // the lattice pruned something
            });
        }
    }

    it('every witness plan replays through the real `step` from its minimal inventory to its target', () => {
        const w = guardRoom({ rock: 'button' });
        const noItems = { ...w, items: new Map() };
        const derived = deriveRegionLogic(w, HELPERS);
        let replayed = 0;
        for (const t of derived.targets) {
            for (const { inventory, plan } of t.witnesses) {
                let s = createState(noItems);
                s.inventory = new Set(inventory);
                for (const input of plan) s = s && step(noItems, s, input);
                expect(s?.player_pos, `${t.id} via {${inventory}}`).toEqual({ x: t.x, y: t.y });
                replayed += 1;
            }
        }
        // flag_K0 has two witnesses (Swim, Sword), each pushing the block onto the rock-gated button.
        expect(derived.targets.find((t) => t.id === 'flag_K0@5,3').witnesses.map((x) => x.inventory))
            .toEqual([['Progressive Swim'], ['Progressive Sword']]);
        expect(replayed).toBeGreaterThanOrEqual(6);
    });
});

describe('Q3 search — the checks DETECT a wrong tile definition (mutant)', () => {
    it('a block_may_enter that ignores obstacles derives flag_K0 = True_, and the engine refuses it', () => {
        const attr = (a) => ({ type: 'attribute', object: { type: 'name', name: 'tile' }, attr: a });
        const mutant = { ...HELPERS, block_may_enter: { ...HELPERS.block_may_enter,
            body: { type: 'and', conditions: [attr('floor'), { type: 'not', condition: attr('block') }] } } };
        const w = guardRoom({ rock: 'button' });
        const derived = deriveRegionLogic(w, mutant);
        expect(rulesById(derived)['flag_K0@5,3']).toEqual({ rule: 'True_' });
        expect(engineDisagreements(w, derived, 'ap')).toContain('flag_K0@5,3 under {}: rule=true engine=false');
    });
});

describe('Q3 search — refusals are BY NAME', () => {
    it('an obstacle rule kind the tile logic does not model', () => {
        const w = guardRoom();
        w.obstacleLib = { ...w.obstacleLib, odd: { id: 'odd', clear_set_type: 'rule', clear_rule: { rule: 'CountItem' } } };
        setObstacle(w, 8, 4, 'odd');
        expect(() => deriveRegionLogic(w, HELPERS)).toThrow(/odd's clear_rule kind CountItem is not modelled/);
    });

    /**
     * ⛔ A COUNTED Has (session tile-primitives-grow-levels; ⚖ "Refuse counted rules"). The search holds a SET
     * inventory: the scripted step read `Has(Shield, count 2)` as one Shield (L18 crossed with 1 where the atlas
     * needs 2), and a set can never hold two, so a truth table over sets certified it vacuously.
     */
    it('a counted Has (count ≥ 2): a set inventory cannot price it', () => {
        const w = guardRoom();
        w.obstacleLib = { ...w.obstacleLib, two: { id: 'two', clear_set_type: 'rule', clear_rule: { rule: 'Has', args: { item_name: 'Progressive Shield', count: 2 } } } };
        setObstacle(w, 8, 4, 'two');
        expect(() => deriveRegionLogic(w, HELPERS)).toThrow(/two's clear_rule needs 2× 'Progressive Shield' — the search holds a SET inventory and cannot price a count/);
    });

    it('a region whose item axis exceeds the lattice cap', () => {
        expect(() => deriveRegionLogic(guardRoom({ rock: 'lane' }), HELPERS, { maxItems: 3 }))
            .toThrow(/4 region items exceed the lattice cap 3/);
    });
});

/* ── ITEM ACTIONS (slice tile-primitives-item-actions): a STRIKE-gated location ─────────────── */

describe('Q3 search — a strike-gated location', () => {
    // Two rocks of one row: `rock` only a strike opens (clear_set []); `rock_swim` a strike OR Swim
    // opens — the L15 rock's shape with the sword as an ACTION rather than a passive clearance.
    const ROW = ['########', '#P..rLX#', '#..S...#', '########'];
    const world = (rockId) => {
        const w = itemActionPicture(ROW);
        w.obstacleLib.rock_swim = { kind: 'rock', clear_set: [['Progressive Swim']], struck_by: ['sword'] };
        // seal the lower row's way round to the location and the exit
        setTile(w, 5, 2, TILE_WALL);
        setTile(w, 6, 2, TILE_WALL);
        if (rockId !== 'rock') setObstacle(w, 4, 1, rockId);
        return w;
    };

    it('the search\'s item axis names the sword (its action strikes a region obstacle)', () => {
        expect(regionItems(world('rock'))).toEqual(['Progressive Sword']);
        expect(regionItems(world('rock_swim'))).toEqual(['Progressive Swim', 'Progressive Sword']);
    });

    for (const [rockId, expected] of [
        ['rock', has(SWORD)],
        ['rock_swim', { rule: 'Or', children: [has('Progressive Swim'), has(SWORD)] }],
    ]) {
        for (const pickups of ['ap', 'in-room']) {
            it(`${rockId} (${pickups}): derived = ${JSON.stringify(expected)}; the engine agrees at every subset; `
                + 'every witness replays on the engine', () => {
                const w = world(rockId);
                const derived = deriveRegionLogic(w, HELPERS, { pickups });
                const rules = rulesById(derived);
                if (pickups === 'ap') {
                    expect(rules['flag_B@5,1']).toEqual(expected);
                    expect(rules['exit:exit']).toEqual(expected);
                } else {
                    // the sword lies in the room: in-room play fetches it, so only the swim half matters
                    expect(rules['flag_B@5,1']).toEqual({ rule: 'True_' });
                }
                expect(engineDisagreements(w, derived, pickups)).toEqual([]);
                const replayWorld = pickups === 'ap' ? { ...w, items: new Map() } : w;
                for (const t of derived.targets) {
                    for (const { inventory, plan } of t.witnesses) {
                        let s = createState(replayWorld);
                        s.inventory = new Set(inventory);
                        for (const input of plan) {
                            s = step(replayWorld, s, input);
                            expect(s).not.toBeNull();
                        }
                        expect(s.player_pos).toEqual({ x: t.x, y: t.y });
                    }
                }
                if (pickups === 'ap' && rockId === 'rock') {
                    const witness = derived.targets.find((t) => t.id === 'flag_B@5,1').witnesses[0];
                    expect(witness.plan).toContain(useInput('sword'));
                }
            });
        }
    }

    it('a world WITHOUT item actions prices the strike-only rock False_ (nothing opens it)', () => {
        const w = world('rock');
        w.actionLib = {};
        const rules = rulesById(deriveRegionLogic(w, HELPERS, { pickups: 'ap' }));
        expect(rules['flag_B@5,1']).toEqual({ rule: 'False_' });
    });
});

// ⛓⛓ ARROW TRAPS + ROPES (slice tile-primitives-arrow-rope): the ROPE GATE is DERIVED from the mechanics —
// nothing in the fixture names the event on a cell, the lane refuses while armed and the cut silences it.
describe('the rope gate is derived from the lane + the cut (native ≡ scripted)', () => {
    const world = arrowTrapPicture(ARROW_ROPE);
    const exitRule = (out) => ruleFromMinimalSets(out.targets.find((t) => t.kind === 'exit').minimal);

    for (const native of [false, true]) {
        it(`${native ? 'native' : 'scripted'}: exit = Or(event, Sword); the event = Sword (by the cut)`, () => {
            // deriveEntryLogic prices an exit with a target region (an AP exit), so give the fixture's one.
            const priced = { ...world, exits: new Map([...world.exits].map(([k, e]) => [k, { ...e, targetRegion: 'beyond' }])) };
            const out = native ? deriveEntryLogic(priced, null, HELPERS, { native: true })
                : deriveRegionLogic(world, HELPERS);
            expect(out.items).toEqual([SWORD, ROPE_EVENT].sort());
            expect(exitRule(out)).toEqual({ rule: 'Or', children: [has(SWORD), has(ROPE_EVENT)] });
            const ev = out.targets.find((t) => t.event === ROPE_EVENT);
            expect(ev.locationName).toBe(ROPE_EVENT);
            expect(ev.minimal).toEqual([[SWORD]]);
            // The cut's witness really cuts it on the engine.
            let s = createState(world);
            s.inventory = new Set(ev.witnesses[0].inventory);
            for (const input of ev.witnesses[0].plan) s = step(world, s, input);
            expect(s.broken).toContain('1,1');
        });
    }

    it('an ARRIVAL in the armed lane reaches nothing; with the event it walks (⚖ never tank a hit)', () => {
        const inLane = { ...world, entrance: { x: 3, y: 2 } };
        expect(nativeReachUnder(inLane, []).cells.size).toBe(0);
        expect(reachUnder(inLane, [], HELPERS).cells.size).toBe(0);
        expect(nativeReachUnder(inLane, [ROPE_EVENT]).cells.has('6,2')).toBe(true);
        expect(reachUnder(inLane, [ROPE_EVENT], HELPERS).cells.has('6,2')).toBe(true);
    });

    it('(control) without the trap the exit is free — the gate is the lane, not the fixture', () => {
        const open = { ...world, traps: undefined, trapLib: undefined, trapLanes: undefined };
        expect(exitRule(deriveRegionLogic(open, HELPERS))).toEqual({ rule: 'True_' });
    });
});
