/**
 * A STRIKE THAT NEEDS SEVERAL ITEMS (session tile-primitives-sphere-order-1, ⚖ 2026-10-25 "action_lib `rule`").
 * Seedling's ghost rock (`breakablerockghost`, L3 and L101) breaks only to the Ghost Sword — `BreakableRock.hit(t)`
 * breaks when its rockType ≤ t, and only the Ghost Sword hits 1 (Player.as:917-923). hasGhostSword is a FUSION flag:
 * it resolves to And(Ghost Sword Fusion, Ghost Spear, Progressive Sword). An `action_lib` entry now carries that
 * `rule` in place of one `item`; every reader (native step + whyBlocked, the scripted step, the search's axis and
 * inputs, the queue's `requires`) asks `actionItems` / `actionUsable`.
 */
import { describe, it, expect } from 'vitest';
import {
    createState, step, whyBlocked, mazeVisitedKey, worldInputs, setObstacle, checkActionLib,
    actionItems, actionUsable, serializeMazeEntities, deserializeMazeWorld, useInput, turnInput, INPUT_E, INPUT_WAIT,
} from './mazeRoomEngine.js';
import { itemActionPicture, SWORD, SWORD_ACTION_LIB } from './mazeItemActions.fixtures.js';
import { regionItems, searchInputs } from './tileSpike/deriveTileLogic.js';
import { scriptedStep } from './tileSpike/tileStep.js';
import { deriveRequires } from './mazeQueueExecutor.js';
import { useEntry, turnEntry, moveEntry } from './mazeKeys.js';
import HELPERS from './tileSpike/maze_tiles.helpers.json' with { type: 'json' };
import { seedlingLevelEntities } from '../flashPanel/seedlingAtlasAnalysis.js';
import { PLAYTHROUGH_MAP, playthroughAnalyzerOptions, playthroughGridFor } from '../../../scripts/procgen/make-seedling-playthrough-rules.mjs';

const FUSION = 'Ghost Sword Fusion';
const SPEAR = 'Ghost Spear';
const GHOST_RULE = Object.freeze({
    rule: 'And',
    children: [FUSION, SPEAR, SWORD].map((item_name) => ({ rule: 'Has', args: { item_name } })),
});
const GHOST_LIB = Object.freeze({
    ...SWORD_ACTION_LIB,
    ghostsword: Object.freeze({ rule: GHOST_RULE, primitive: 'strike', condition: 'strikes', key: 'x' }),
});

/** The rock corridor, its rock a GHOST rock: struck only by the ghost sword. */
function ghostCorridor() {
    const w = itemActionPicture(['#######', '#P..gX#', '#.....#', '#######'].map((r) => r.replace('g', '.')),
        { actionLib: GHOST_LIB });
    w.obstacleLib = { ...w.obstacleLib, ghost: { kind: 'rock', clear_set: [], struck_by: ['ghostsword'], color: '#7a6a55' } };
    setObstacle(w, 4, 1, 'ghost');
    return w;
}

const walk = (world, state, inputs, inv) => inputs.reduce((s, i) => {
    const n = step(world, s, i, inv);
    if (n === null) throw new Error(`refused ${i}: ${whyBlocked(world, s, i, inv)}`);
    return n;
}, state);

describe('action_lib `rule` — checked, read by name', () => {
    it('a Has or an And of Has is accepted; actionItems names the needed set', () => {
        expect(checkActionLib(GHOST_LIB, 'test')).toEqual(GHOST_LIB);
        expect(actionItems(GHOST_LIB.ghostsword)).toEqual([FUSION, SPEAR, SWORD].sort());
        expect(actionItems(GHOST_LIB.sword)).toEqual([SWORD]);
        expect(actionItems({ primitive: 'strike' })).toEqual([]);
        expect(actionUsable(GHOST_LIB.ghostsword, new Set([FUSION, SPEAR]))).toBe(false);
        expect(actionUsable(GHOST_LIB.ghostsword, new Set([FUSION, SPEAR, SWORD]))).toBe(true);
    });

    it('an Or, a count, or item AND rule is refused by name', () => {
        const lib = (rule, extra = {}) => ({ g: { rule, primitive: 'strike', ...extra } });
        const or = { rule: 'Or', children: GHOST_RULE.children };
        expect(() => checkActionLib(lib(or), 't')).toThrow(/action_lib.g rule must be a Has or an And of Has/);
        expect(() => checkActionLib(lib({ rule: 'Has', args: { item_name: SPEAR, count: 2 } }), 't'))
            .toThrow(/action_lib.g rule must be a Has or an And of Has \(count 1\)/);
        expect(() => checkActionLib(lib(GHOST_RULE, { item: SWORD }), 't')).toThrow(/action_lib.g names both an item and a rule/);
    });

    it('serializeMazeEntities ⇄ deserializeMazeWorld carries the rule', () => {
        const w = ghostCorridor();
        const sidecar = { ...serializeMazeEntities(w), width: w.width, height: w.height, tiles: [...w.tiles],
            entrance: w.entrance, exits: [{ exit_id: 'exit', x: 5, y: 1 }] };
        expect(sidecar.action_lib.ghostsword.rule).toEqual(GHOST_RULE);
        expect(deserializeMazeWorld(sidecar).actionLib.ghostsword.rule).toEqual(GHOST_RULE);
    });
});

describe('the ghost rock breaks only to all three items', () => {
    it('two of three: the use is refused and whyBlocked names the set; all three: broken this visit', () => {
        const w = ghostCorridor();
        const two = new Set([FUSION, SPEAR]);
        const at = walk(w, createState(w), [INPUT_E, INPUT_E, turnInput('E')], two);
        expect(whyBlocked(w, at, INPUT_E, two)).toBe('ghost is shut — strike it (ghostsword)');
        expect(step(w, at, useInput('ghostsword'), two)).toBeNull();
        expect(whyBlocked(w, at, useInput('ghostsword'), two)).toBe(`use ghostsword needs ${[FUSION, SPEAR, SWORD].sort().join(' + ')}`);
        // the plain sword does not break a ghost rock (it is not struck_by sword)
        const swing = step(w, at, useInput('sword'), new Set([SWORD]));
        expect(swing.broken).toEqual([]);
        const all = new Set([FUSION, SPEAR, SWORD]);
        const broke = step(w, at, useInput('ghostsword'), all);
        expect(broke.broken).toEqual(['4,1']);
        expect(walk(w, broke, [INPUT_E, INPUT_E], all).player_pos).toEqual({ x: 5, y: 1 });
    });

    it('the search axis holds every item of the rule; its inputs drop the use until all are held', () => {
        const w = ghostCorridor();
        expect(regionItems(w)).toEqual([FUSION, SPEAR, SWORD].sort());
        expect(searchInputs(w, [FUSION, SPEAR], 'ap')).not.toContain(useInput('ghostsword'));
        expect(searchInputs(w, [FUSION, SPEAR, SWORD], 'ap')).toContain(useInput('ghostsword'));
    });

    it('a recorded walk through the ghost rock REQUIRES all three items', () => {
        const w = ghostCorridor();
        const s = createState(w);
        s.inventory = new Set([FUSION, SPEAR, SWORD]);
        const { requires } = deriveRequires(w, s,
            [moveEntry('E'), moveEntry('E'), turnEntry('E'), useEntry('ghostsword'), moveEntry('E'), moveEntry('E')]);
        expect(requires).toEqual([FUSION, SPEAR, SWORD].sort());
    });

    it('scripted step ≡ engine step over every reachable (state, input), at every subset of the three', () => {
        const items = [FUSION, SPEAR, SWORD];
        let compared = 0;
        let strikes = 0;
        for (let mask = 0; mask < 8; mask++) {
            const w = ghostCorridor();
            const start = createState(w);
            start.inventory = new Set(items.filter((_, i) => mask & (1 << i)));
            const seen = new Map([[mazeVisitedKey(start), start]]);
            const frontier = [start];
            while (frontier.length) {
                const s = frontier.pop();
                for (const input of worldInputs(w)) {
                    const n = step(w, s, input);
                    if (n === null || seen.has(mazeVisitedKey(n))) continue;
                    seen.set(mazeVisitedKey(n), n);
                    frontier.push(n);
                }
            }
            for (const s of seen.values()) {
                for (const input of [...worldInputs(w), INPUT_WAIT]) {
                    const oracle = step(w, s, input);
                    const { next } = scriptedStep(w, s, input, HELPERS);
                    compared += 1;
                    expect(next === null, `${input}@${mazeVisitedKey(s)} inv=${[...start.inventory]}`).toBe(oracle === null);
                    if (oracle) expect(mazeVisitedKey(next)).toBe(mazeVisitedKey(oracle));
                    if (oracle?.broken?.length > s.broken.length) strikes += 1;
                }
            }
        }
        expect(compared).toBeGreaterThan(100);
        expect(strikes).toBeGreaterThan(0);
    });
});

describe('Seedling: the ghost rocks bind a rule strike (they once refused the compile)', () => {
    const resolve = playthroughAnalyzerOptions.resolveCondition;
    for (const n of [3, 101]) {
        it(`L${n}: every breakablerockghost row strikes with And(Fusion, Spear, Sword)`, () => {
            const level = PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
            const rows = seedlingLevelEntities(level, resolve, { grid: playthroughGridFor(level) }).filter((r) => r.label.startsWith('breakablerockghost'));
            expect(rows.length).toBeGreaterThan(0);
            for (const r of rows) {
                expect(r.strike).toHaveLength(1);
                expect(r.strike[0].action).toBe('ghostsword');
                expect(actionItems(r.strike[0])).toEqual([FUSION, SPEAR, SWORD].sort());
            }
        });
    }
});
