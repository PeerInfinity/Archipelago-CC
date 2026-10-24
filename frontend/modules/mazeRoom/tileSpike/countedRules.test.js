/**
 * COUNTED ITEMS (session tile-primitives-counted-rules). A counted rule — `Has(item, count ≥ 2)`: two Progressive
 * Shields, two Progressive Swims, sixteen Seals — cannot be answered by a SET inventory. Grow-levels found the defect
 * (L18: the scripted step crossed with ONE Shield where the atlas needs two; the native one could never cross) and
 * refused counted rules by name; this slice models them end to end. ⚖ user 2026-10-23:
 *   - "Count map": the search, `step` and the certifier carry a `Map<item, count>`; a Set still means count 1;
 *   - "Threshold levels": an item's lattice axis is {0} ∪ the counts the rules name, by increasing rank, dominance pruned;
 *   - "state.count": a combo is `[item, n]` pairs and the `cleared` helper asks `state.count(item, player) >= n`;
 *   - "Has count ≥2 only": a derived rule writes `count` only when it is ≥ 2.
 */
import { describe, it, expect } from 'vitest';
import {
    createState, step, getExitAt, mazeVisitedKey, setObstacle, worldInputs, deserializeMazeWorld,
} from '../mazeRoomEngine.js';
import { generateMazeLevel, MAZE_PALETTE } from '../procgenMaze.js';
import { parseAreaSpec } from '../../procgenCore/areaSpec.js';
import { parseElementSpec } from '../../procgenCore/elementSpec.js';
import { parseSkeleton } from '../../procgenCore/skeletonKinds.js';
import { evaluateRuleAgainstInventory } from '../../shared/procgen/library.js';
import {
    deriveRegionLogic, regionItems, regionLevels, ruleFromMinimalSets, latticeAxis, latticePoints, allPoints, inventoryOf,
} from './deriveTileLogic.js';
import { deriveEntryLogic } from './deriveLevelWorldLogic.js';
import { scriptedStep, ruleToClearSet } from './tileStep.js';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import { buildPlaythroughMaze } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import { readFileSync } from 'node:fs';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };
import { itemActionPicture, SWORD } from '../mazeItemActions.fixtures.js';

const SHIELD = 'Progressive Shield';
const has = (item, count) => ({ rule: 'Has', args: count ? { item_name: item, count } : { item_name: item } });
const ATLAS = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));

/** The tile-logic suite's generated guard room (seed 2), with obstacle `id` = `rule` on the block lane (8,4). */
function guardRoomWith(rule) {
    const w = generateMazeLevel({
        seed: 2, palette: MAZE_PALETTE, width: 15, height: 15,
        skeleton: parseSkeleton('rooms', { simulator: true, substrate: 'the counted-rules test' }),
        areas: parseAreaSpec('1'), elements: parseElementSpec('guard;len=2;turns=1'),
    }).record;
    w.obstacleLib = { ...w.obstacleLib, gate: { id: 'gate', clear_set_type: 'rule', clear_rule: rule } };
    setObstacle(w, 8, 4, 'gate');
    return w;
}

/** The engine's own reach holding the lattice point `point` ('ap' mode: no pickups); exits are dead ends. */
function engineCells(world, point) {
    const w = { ...world, items: new Map() };
    const start = createState(w);
    start.inventory = inventoryOf(point);
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

/** Every (point, target) where the derived rule and the engine disagree — at EVERY count level of the axis. */
function engineDisagreements(world, derived) {
    const out = [];
    for (const point of allPoints(latticeAxis(derived.items, derived.levels))) {
        const cells = engineCells(world, point);
        for (const t of derived.targets) {
            const ruled = evaluateRuleAgainstInventory(ruleFromMinimalSets(t.minimal), inventoryOf(point));
            if (ruled !== cells.has(`${t.x},${t.y}`)) out.push(`${t.id} under {${point}}: rule=${ruled} engine=${cells.has(`${t.x},${t.y}`)}`);
        }
    }
    return out;
}

describe('the count model: inventory, clearance, lattice, emission', () => {
    it('a lattice point is a Set when nothing repeats and a count Map otherwise; the visited key spells a count', () => {
        expect(inventoryOf(['A', 'B'])).toEqual(new Set(['A', 'B']));
        expect(inventoryOf([SHIELD, SHIELD, 'Wand'])).toEqual(new Map([[SHIELD, 2], ['Wand', 1]]));
        const s = { player_pos: { x: 1, y: 2 }, turn: 0, inventory: new Map([[SHIELD, 2], ['Wand', 1]]) };
        expect(mazeVisitedKey(s)).toBe(`1,2|${SHIELD}×2,Wand`);
        expect(mazeVisitedKey({ ...s, inventory: new Set(['Wand', SHIELD]) })).toBe(`1,2|${SHIELD},Wand`);
    });

    it('threshold levels: {0, 1} ∪ the named counts; an all-binary axis enumerates exactly the old subsets, in order', () => {
        const binary = latticeAxis(['a', 'b', 'c']);
        const old = [];
        for (let k = 0; k <= 3; k++) {
            for (let i = 0; i < 3; i++) for (let j = i; j < 3; j++) for (let l = j; l < 3; l++) {
                const pick = [...new Set([i, j, l].slice(0, k))];
                if (pick.length === k && (k < 2 || pick[0] < pick[1]) && (k < 3 || pick[1] < pick[2])) old.push(pick.map((x) => 'abc'[x]));
            }
        }
        expect([...latticePoints(binary)]).toEqual([...new Map(old.map((p) => [p.join(), p])).values()]);
        const counted = latticeAxis(['Seal', SHIELD], new Map([[SHIELD, new Set([1, 2])], ['Seal', new Set([16])]]));
        // ⛓ Every item keeps level 1 (designer-2 review): an implicit "at least one" (a strike, a combo, a scripted
        // `state.has`) names no count, so the axis must test 1 even when the only NAMED count is 16.
        expect(counted).toEqual([{ item: SHIELD, levels: [1, 2] }, { item: 'Seal', levels: [1, 16] }]);
        const points = [...latticePoints(counted)].map((p) => inventoryOf(p));
        expect(points).toHaveLength(3 * 3); // Shield 0/1/2 × Seal 0/1/16 — not 3 × 17
        expect(points[0]).toEqual(new Set());
        expect(points.at(-1)).toEqual(new Map([[SHIELD, 2], ['Seal', 16]]));
    });

    it('a counted Has clears only at its count — natively and scripted (the L18 defect: one Shield crossed)', () => {
        expect(ruleToClearSet(has(SHIELD, 2))).toEqual([[[SHIELD, 2]]]);
        expect(ruleToClearSet({ rule: 'And', children: [has(SHIELD), has(SHIELD, 2), has('Wand')] })).toEqual([[[SHIELD, 2], ['Wand', 1]]]);
        const w = guardRoomWith(has(SHIELD, 2));
        // From (8,5), the player steps N onto the gate at (8,4).
        const at = (inventory) => ({ ...createState(w), player_pos: { x: 8, y: 5 }, inventory });
        for (const [inventory, open] of [[new Set([SHIELD]), false], [new Map([[SHIELD, 1]]), false], [new Map([[SHIELD, 2]]), true]]) {
            expect(step(w, at(inventory), 'N') !== null, `native ${[...inventory]}`).toBe(open);
            expect(scriptedStep(w, at(inventory), 'N', HELPERS).next !== null, `scripted ${[...inventory]}`).toBe(open);
        }
    });

    it('the lattice prices a counted gate: minimal = two Shields, held to the engine at 0, 1 and 2', () => {
        const w = guardRoomWith(has(SHIELD, 2));
        expect(regionItems(w)).toContain(SHIELD);
        expect(regionLevels(w)).toEqual(new Map([[SHIELD, new Set([2])]]));
        for (const native of [false, true]) {
            const derived = native ? deriveEntryLogic(w, null, HELPERS, { native: true }) : deriveRegionLogic(w, HELPERS);
            const flag = derived.targets.find((t) => t.x === 5 && t.y === 3);
            expect(flag.minimal).toEqual([[SHIELD, SHIELD]]);
            if (!native) expect(engineDisagreements(w, derived)).toEqual([]);
        }
    });

    it('mixed levels: Or(two Shields, Wand) beside a one-Shield gate — the minimal points and the emitted rule', () => {
        const w = guardRoomWith({ rule: 'Or', children: [has(SHIELD, 2), has('Wand')] });
        w.obstacleLib.one = { id: 'one', clear_set_type: 'rule', clear_rule: has(SHIELD) };
        setObstacle(w, 6, 3, 'one'); // replaces the guard door: the flag needs a Shield AND the lane
        const derived = deriveRegionLogic(w, HELPERS);
        expect(latticeAxis(derived.items, derived.levels).find((a) => a.item === SHIELD).levels).toEqual([1, 2]);
        expect(derived.targets.find((t) => t.x === 5 && t.y === 3).minimal).toEqual([[SHIELD, 'Wand'], [SHIELD, SHIELD]]);
        expect(engineDisagreements(w, derived)).toEqual([]);
        expect(ruleFromMinimalSets([[SHIELD, SHIELD], [SHIELD, 'Wand']])).toEqual({
            rule: 'Or', children: [has(SHIELD, 2), { rule: 'And', children: [has(SHIELD), has('Wand')] }],
        });
        // ⚖ "Has count ≥2 only": an uncounted rule is spelled as before.
        expect(ruleFromMinimalSets([['Wand']])).toEqual(has('Wand'));
    });
});

/**
 * ⛔ SOUNDNESS (designer-2 review of 970fb3c827): an item's axis came only from the counts rules NAME, so an item
 * whose one named count is n ≥ 2 had levels {0, n} — count 1, the level every implicit use (a strike's item, a
 * combo, a scripted `state.has`) clears at, was never tested.
 */
describe('count 1 is always a level', () => {
    it('search: a sword-struck rock costs ONE sword even when another gate names Has(Sword, 2)', () => {
        const w = itemActionPicture(['########', '#P..rLgX', '#......#', '########']);
        setObstacle(w, 4, 2, 'rock'); // the way round is struck too
        w.obstacleLib.gate = { id: 'gate', clear_set_type: 'rule', clear_rule: has(SWORD, 2) };
        setObstacle(w, 6, 1, 'gate');
        const out = deriveRegionLogic(w, HELPERS);
        expect(out.targets.find((t) => t.x === 5 && t.y === 1).minimal).toEqual([[SWORD]]);
        expect(out.targets.find((t) => t.kind === 'exit').minimal).toEqual([[SWORD, SWORD]]);
        expect(engineDisagreements(w, out)).toEqual([]);
    });

    it('certifier: an AP Has(Wand, 2) against a world gate one Wand opens is a LOOSER-world problem at 1 Wand', () => {
        const RULES = JSON.parse(buildPlaythroughMaze({ levels: ['level_18'] }).text);
        const exit = RULES.regions['1'].level_18__r1c1.exits.find((e) => e.connected_region === 'level_18__r7c10');
        exit.access_rule = { rule: 'Or', children: [has(SHIELD, 2), has('Ghost Spear'), has('Progressive Sword'), has('Wand', 2)] };
        const { problems } = certifyPlaythroughMaze(RULES, HELPERS, { native: true, atlas: ATLAS, regions: ['level_18__r1c1'] });
        expect(problems).toContain('level_18__r1c1 → level_18__r7c10 holding [Wand]: derived true, atlas false');
    });

    // ⛓ …which exposed L71's shieldlock: its gated cell opens on Or(Shield×2, event), and the event's own location
    // rule is Has(Shield, 2). Holding the event with ONE Shield is no AP state (counts only grow), so the certifier's
    // `impossible` must read the event's rule with its count — it read "a counted Has asks for one".
    it('certifier: an event whose own rule counts is never held below that count (L71 shieldlock)', () => {
        const RULES = JSON.parse(buildPlaythroughMaze({ levels: ['level_71'] }).text);
        const { problems } = certifyPlaythroughMaze(RULES, HELPERS, { native: true, atlas: ATLAS });
        const E = 'L71 flag 2: shieldlock@288,256 cleared';
        expect(problems.filter((p) => p.includes(`${E},${SHIELD}]`)), JSON.stringify(problems)).toEqual([]);
        expect(RULES.regions['1'].level_71__r0c6.locations.find((l) => l.name === E).access_rule).toEqual(has(SHIELD, 2));
    });
});

describe('L18: Or(two Shields, Ghost Spear, Sword, Wand) between r1c1 and r7c10', () => {
    const RULES = JSON.parse(buildPlaythroughMaze({ levels: ['level_18'] }).text);
    const SIDECARS = RULES.preset_sidecars['1'];

    it('the compiled gate is the counted one this test was written against', () => {
        const w = deserializeMazeWorld(SIDECARS.level_18__r1c1.playable_payload);
        expect(w.obstacleLib[w.obstacles.get('9,7')].clear_rule.children[0]).toEqual(has(SHIELD, 2));
    });

    it('one Shield is refused and two pass, natively and scripted; the derived rule counts', () => {
        const w = deserializeMazeWorld(SIDECARS.level_18__r1c1.playable_payload);
        const lines = [false, true].map((native) => {
            const out = deriveEntryLogic(w, 'level_18__r1c1', HELPERS, { native });
            const exit = out.targets.find((t) => t.kind === 'exit' && t.exitName && RULES.regions['1'].level_18__r1c1.exits
                .find((e) => e.name === t.exitName)?.connected_region === 'level_18__r7c10');
            expect(exit, 'the exit to r7c10').toBeDefined();
            expect(exit.minimal).toContainEqual([SHIELD, SHIELD]);
            expect(exit.minimal).not.toContainEqual([SHIELD]);
            return JSON.stringify(exit.minimal);
        });
        expect(lines[0]).toBe(lines[1]);
    });

    it('the certifier prices L18 at 0, 1 and 2 Shields — no throw, no problem', () => {
        const { problems, lines } = certifyPlaythroughMaze(RULES, HELPERS, { native: true, atlas: ATLAS });
        expect(problems).toEqual([]);
        expect(lines.some((l) => l.includes(`"${SHIELD}","${SHIELD}"`))).toBe(true);
    });

    it('…and still catches an AP rule that asks for ONE Shield where the world needs two', () => {
        const copy = structuredClone(RULES);
        const exit = copy.regions['1'].level_18__r1c1.exits.find((e) => e.connected_region === 'level_18__r7c10');
        exit.access_rule = { rule: 'Or', children: [has(SHIELD), has('Ghost Spear'), has('Progressive Sword'), has('Wand')] };
        const { problems } = certifyPlaythroughMaze(copy, HELPERS, { native: true, atlas: ATLAS, regions: ['level_18__r1c1'] });
        expect(problems).toContain(`level_18__r1c1 → level_18__r7c10 holding [${SHIELD}]: derived false, atlas true`);
    });
});
