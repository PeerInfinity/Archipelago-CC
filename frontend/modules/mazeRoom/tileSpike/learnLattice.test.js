/**
 * THE LEARNING LATTICE WALK and the HYBRID (session tile-l12-one-world, ⚖ Robert 2026-11-04 "A: Build after R-A3 (Recommended)";
 * measured by tile-l12-level-world). Default tier, gadget-sized:
 *   - learning walk ≡ rank walk, minimal sets AND witnesses (plan, cell) and `unreachable`, byte for byte, on the gadget rooms
 *     (a latch: its own event on the axis), native and scripted;
 *   - each MUTANT of `LEARN_WALK.mutant` is shown RED here (stop-early, no-exclude; no-grow through the query-count pin);
 *   - the static monotone census (`assertMonotoneWorld`) refuses BY NAME, and the learner itself does NOT detect a violation;
 *   - the HYBRID's switch (`walkFor`, `RANK_WALK_MAX_POINTS`) and the refusal bound (`LEVEL_WORLD_MAX_POINTS`), and today's
 *     census of the preset's world axes against them.
 * L40 laid, a rope world and a block world (learner ≡ rank) are the train tier's (`learnLattice.train.test.js`).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { deserializeMazeWorld } from '../mazeRoomEngine.js';
import {
    deriveLevelWorldLogic, deriveEntryLogic, walkFor, latticeSize, levelWorldFits, RANK_WALK_MAX_POINTS, LEVEL_WORLD_MAX_POINTS,
    LEVEL_WORLD_LATTICE_CAP,
} from './deriveLevelWorldLogic.js';
import { LEARN_WALK, LEARN_MAX_POINTS, learnMinimal, assertMonotoneWorld } from './learnLattice.js';
import { latticeAxis, regionItems, regionLevels } from './deriveTileLogic.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };
import { RULES } from './deriveLevelWorldLogic.fixture.js';

afterEach(() => { LEARN_WALK.mutant = null; });

const EV = 'Latch L pressed';
function room(rows, lib = {}) {
    const at = (ch) => { const out = []; rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === ch) out.push({ x, y }); })); return out; };
    return {
        width: rows[0].length, height: rows.length, tiles: rows.flatMap((r) => [...r].map((c) => (c === '#' ? 1 : 0))), entrance: at('P')[0],
        obstacles: [...at('D').map((c) => ({ ...c, id: 'door' })), ...at('a').map((c) => ({ ...c, id: 'door_a' })),
            ...at('b').map((c) => ({ ...c, id: 'door_b' })), ...at('c').map((c) => ({ ...c, id: 'door_c' }))],
        items: [...at('G').map((c) => ({ ...c, id: 'goal' })), ...at('H').map((c) => ({ ...c, id: 'goal2' }))],
        obstacleLib: {
            door: { id: 'door', name: 'door', clear_set: [['sw_L']] },
            door_a: { id: 'door_a', name: 'door a', clear_set: [['A']] },
            door_b: { id: 'door_b', name: 'door b', clear_set: [['B']] },
            door_c: { id: 'door_c', name: 'door c', clear_set: [['C'], ['A', 'B']] },
            ...lib,
        },
        buttons: at('L').map((c) => ({ ...c, id: 'button_L' })),
        buttonLib: { button_L: { kind: 'button', holds: 'sw_L', latch: { event: EV } } },
    };
}
const GADGETS = {
    series: ['##########', '#P.L.ab.G#', '###D######', '###.######', '##########'],
    gated: ['#########', '#P.L.D.G#', '##a######', '##.######', '#########'],
    sealed: ['########', '#P..DG##', '######L#', '########'],
    pressOnly: ['#######', '#P.a.L#', '#####D#', '#######'],
    orAnd: ['##########', '#P.c.a.G.#', '#.######b#', '#.H#######', '##########'],
};

const strip = (r) => JSON.parse(JSON.stringify({ pairs: r.pairs, targets: r.targets }));
const entry = (rows, native, walk) => strip(deriveEntryLogic(deserializeMazeWorld(room(rows)), null, HELPERS, { native, cache: new Map(), walk }));

/** A corridor of `n` doors in a row, each on its own item, a goal behind each: n binary items, 2^n lattice points. */
function corridor(n) {
    const ids = [...Array(n).keys()].map((i) => `d${i}`);
    const w = 2 * n + 3;
    const top = '#'.repeat(w);
    const row = ['#', 'P', ...ids.flatMap(() => ['.', '.']), '#'].join('').padEnd(w, '#');
    const below = ['#', '#', ...ids.flatMap(() => ['.', '#']), '#'].join('').padEnd(w, '#');
    const goals = ['#', '#', ...ids.flatMap(() => ['.', '#']), '#'].join('').padEnd(w, '#');
    const rows = [top, row, below, goals, top];
    return {
        width: w, height: rows.length, tiles: rows.flatMap((r) => [...r].map((c) => (c === '#' ? 1 : 0))), entrance: { x: 1, y: 1 },
        obstacles: ids.map((id, i) => ({ x: 2 + 2 * i, y: 2, id })),
        items: ids.map((id, i) => ({ x: 2 + 2 * i, y: 3, id: `goal_${id}` })),
        obstacleLib: Object.fromEntries(ids.map((id) => [id, { id, name: id, clear_set: [[`K${id}`]] }])),
    };
}

describe('learning walk ≡ rank walk on the gadget rooms (minimal sets + witnesses, byte for byte)', () => {
    for (const [name, rows] of Object.entries(GADGETS)) {
        for (const native of [true, false]) {
            it(`gadget ${name} (${native ? 'native' : 'scripted'})`, () => {
                const rank = entry(rows, native, 'rank');
                expect(entry(rows, native, 'learn')).toEqual(rank);
                expect(rank.targets.some((t) => t.minimal.length > 0)).toBe(true);
            });
        }
    }
    it('MUTANT stop-early (stop after a target\'s first minimal point, before the dual check covers the lattice) goes RED on orAnd', () => {
        const rank = entry(GADGETS.orAnd, true, 'rank');
        LEARN_WALK.mutant = 'stop-early';
        expect(entry(GADGETS.orAnd, true, 'learn')).not.toEqual(rank);
    });
});

describe('the learner on a bare predicate: query count, own event, and what it cannot see', () => {
    const tenItems = () => {
        const axis = latticeAxis(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
        const t = { id: 'x' };
        // taken ⇔ holds j, or both a and b: Min = {j}, {a,b}.
        return { axis, t, run: () => learnMinimal(axis, [t], { query: (p) => p, taken: (p) => p.includes('j') || (p.includes('a') && p.includes('b')) }) };
    };
    it('a 10-item predicate learns in ≤ 60 queries (the rank walk: 1,024 points), minimal points in rank order', () => {
        const { t, run } = tenItems();
        const { learned, queries } = run();
        expect(learned.get(t).map((m) => m.point)).toEqual([['j'], ['a', 'b']]);
        expect(queries).toBeLessThanOrEqual(60);
    });
    it('MUTANT no-grow (a negative decides only itself): the answer survives — grow is economy — and the query count goes RED', () => {
        const { t, run } = tenItems();
        LEARN_WALK.mutant = 'no-grow';
        const { learned, queries } = run();
        expect(learned.get(t).map((m) => m.point)).toEqual([['j'], ['a', 'b']]);
        expect(queries).toBeGreaterThan(60);
    });
    const ownEvent = () => {
        const axis = latticeAxis(['ev', 'z']);
        const t = { id: 'press', event: 'ev' };
        // taken ⇔ holds z and NOT ev — non-monotone in ev only (`reachedTarget`: never taken holding its own event).
        return { t, run: () => learnMinimal(axis, [t], { query: (p) => p, taken: (p) => p.includes('z') && !p.includes('ev'), exclude: (x) => x.event }) };
    };
    it('the own event: points holding it are decided not taken up front; the target is learned on the axis without it', () => {
        const { t, run } = ownEvent();
        expect(run().learned.get(t).map((m) => m.point)).toEqual([['z']]);
    });
    it('MUTANT no-exclude (the own event learned across like any item) goes RED on the own-event pin', () => {
        const { t, run } = ownEvent();
        LEARN_WALK.mutant = 'no-exclude';
        let got;
        try { got = run().learned.get(t).map((m) => m.point); } catch (e) { got = String(e.message); }
        expect(got).not.toEqual([['z']]);
    });
    it('⚠ the learner does NOT detect a non-monotone predicate itself — so the static census is the guard', () => {
        // taken ⇔ b and not a: the rank walk finds [b]; the learner grows [] → [a] → [a,b] and decides [b] not taken, silently.
        // (tile-l12-level-world MEASURED all 236 non-monotone predicates over 3 items: 0 refused.)
        const axis = latticeAxis(['a', 'b']);
        const t = { id: 'x' };
        const { learned } = learnMinimal(axis, [t], { query: (p) => p, taken: (p) => p.includes('b') && !p.includes('a') });
        expect(learned.get(t).map((m) => m.point)).toEqual([]);
    });
});

describe('the monotone census on the learner\'s path: refused BY NAME', () => {
    it('a rule node other than Has/And/Or (True_/False_: constants) is refused, naming the kind and the path', () => {
        const w = deserializeMazeWorld(room(GADGETS.series, {
            door_a: { id: 'door_a', name: 'door a', clear_set_type: 'rule', clear_rule: { rule: 'Not', children: [{ rule: 'Has', args: { item_name: 'A' } }] } },
        }));
        expect(() => assertMonotoneWorld(w, ['A', 'B'])).toThrow(/rule node 'Not' at world\.obstacleLib\.door_a\.clear_rule is not known monotone/);
        // ⚠ The derive refuses a Not gate even earlier, at the axis (`regionItems` prices Has/And/Or/True_/False_ only): the census is
        // the second line, for a node kind a later slice admits to the axis.
        expect(() => deriveEntryLogic(w, null, HELPERS, { native: true })).toThrow(/door_a/);
    });
    it('a trap armed by an axis item is refused (holding it may SHRINK reach), and one on a non-axis token is not', () => {
        const w = deserializeMazeWorld(room(GADGETS.series));
        expect(() => assertMonotoneWorld({ ...w, trapLib: { t1: { active: 'A', fires: 'while_active' } } }, ['A', 'B']))
            .toThrow(/trap t1 is while_active on axis item 'A'/);
        expect(() => assertMonotoneWorld({ ...w, trapLib: { t1: { active: 'sw_L', fires: 'while_active' } } }, ['A', 'B'])).not.toThrow();
    });
    it('the derive runs the census before the learner\'s first search (a trap armed by an axis item, through deriveEntryLogic)', () => {
        const w = deserializeMazeWorld(corridor(13));
        const armed = { ...w, trapLib: { t1: { active: 'Kd0', fires: 'while_active' } } };
        expect(() => deriveEntryLogic(armed, null, HELPERS, { native: true })).toThrow(/learning walk: trap t1 .* axis item 'Kd0'/);
    });
});

describe('the HYBRID: rank walk ≤ RANK_WALK_MAX_POINTS < learning walk ≤ LEVEL_WORLD_MAX_POINTS', () => {
    it('the switch is in lattice POINTS: 2^LEVEL_WORLD_LATTICE_CAP (4,096); counted levels count as points', () => {
        expect(LEVEL_WORLD_LATTICE_CAP).toBe(12);
        expect(RANK_WALK_MAX_POINTS).toBe(4096);
        const binary = (n) => latticeAxis([...Array(n).keys()].map((i) => `i${String(i).padStart(2, '0')}`));
        expect(walkFor(binary(12))).toBe('rank');
        expect(walkFor(binary(13))).toBe('learn');
        // 11 binary items + one counted ×2 (3 levels): 2^11 · 3 = 6,144 points — the learner, though only 12 items.
        const counted = latticeAxis(binary(12).map((a) => a.item), new Map([['i00', new Set([1, 2])]]));
        expect(latticeSize(counted)).toBe(6144);
        expect(walkFor(counted)).toBe('learn');
    });
    it('through the derive: a 12-door corridor walks rank (no learner call), a 13-door one learns — same answer shape', () => {
        for (const [n, walk] of [[12, 'rank'], [13, 'learn']]) {
            const w = deserializeMazeWorld(corridor(n));
            const before = LEARN_WALK.calls;
            const out = deriveEntryLogic(w, null, HELPERS, { native: true });
            expect(LEARN_WALK.calls - before, `${n} doors`).toBe(walk === 'learn' ? 1 : 0);
            expect(out.targets.filter((t) => t.kind !== 'exit').map((t) => t.minimal)).toEqual(
                [...Array(n).keys()].map((i) => [[`Kd${i}`]]));
        }
    });
    it('the refusal: one bound for the derives and the compile, the learner\'s memory (`LEARN_MAX_POINTS`), refused BY NAME', () => {
        expect(LEVEL_WORLD_MAX_POINTS).toBe(LEARN_MAX_POINTS);
        expect(LEVEL_WORLD_MAX_POINTS).toBe(2 ** 22);
        const w = deserializeMazeWorld(corridor(13));
        expect(levelWorldFits(w)).toBe(true);
        expect(levelWorldFits(w, { maxPoints: 4096 })).toMatch(/its item axis \(13 items\) has 8192 lattice points, over the bound 4096/);
        expect(() => deriveEntryLogic(w, null, HELPERS, { native: true, maxPoints: 4096 })).toThrow(/entry logic: 13 items, 8192 lattice points exceed the bound 4096/);
    });
    it('today\'s census of the preset\'s world axes: L12 one world is the ONE learner world; every other ≤ 768 points', () => {
        // ⛓ A level that grows toward the switch shows up here. Measured at main 0885fec4b3 over all 399 derive calls of the whole
        // game (entries widened by `arrivalBlocked` included): max 4,096 = L12 r0c19's per-sub-region ENTRY (11 world items + 1
        // landing event), then 768 (L63). Since this slice L12 is one world (15 items: 32,768; its entries 17: 131,072).
        const sizes = Object.entries(RULES.preset_sidecars['1']).filter(([, sc]) => sc.playable_payload).map(([name, sc]) => {
            const w = deserializeMazeWorld(sc.playable_payload);
            return [name, latticeSize(latticeAxis(regionItems(w), regionLevels(w)))];
        });
        const over = sizes.filter(([, n]) => n > RANK_WALK_MAX_POINTS);
        expect(over).toEqual([['level_12__r0c19', 32768]]);
        const rest = sizes.filter(([, n]) => n <= RANK_WALK_MAX_POINTS).map(([, n]) => n);
        expect(Math.max(...rest)).toBe(768);
    });
});

describe('the pass over a shared world takes the same switch', () => {
    it('deriveLevelWorldLogic: a forced learn ≡ rank on the preset\'s smallest shared world over a multi-item axis', () => {
        const axisOf = (w) => latticeAxis(regionItems(w), regionLevels(w));
        const [name] = Object.entries(RULES.preset_sidecars['1']).map(([n, sc]) => [n, sc.playable_payload])
            .filter(([, p]) => p?.shared_world).map(([n, p]) => [n, deserializeMazeWorld(p)])
            .filter(([, w]) => regionItems(w).length > 1).sort(([, a], [, b]) => latticeSize(axisOf(a)) - latticeSize(axisOf(b)))[0];
        const sw = deserializeMazeWorld(RULES.preset_sidecars['1'][name].playable_payload);
        const rank = strip(deriveLevelWorldLogic(sw, HELPERS, { native: true, walk: 'rank' }));
        expect(rank.pairs.some((p) => p.minimal.length > 0)).toBe(true);
        expect(strip(deriveLevelWorldLogic(sw, HELPERS, { native: true, walk: 'learn' }))).toEqual(rank);
    });
});
