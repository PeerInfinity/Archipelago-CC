/**
 * Seedling fidelity F2, D1: the `apitem` strategy of `collect-placement`, and
 * the apitem's persistence response.
 *
 *   · D1a: a `collect-placement` at a delivered set's APItem resolves as
 *     strategy `apitem`, and its success is the game's contact rule
 *     (`apItemTakenOnTick`: the previous tick's player box ∩ the `apItem`
 *     box), pinned EQUAL to the JS page's own report, tick for tick.
 *   · D1c: the apitem goal SOLVES on every committed generated preset room
 *     the solver reaches, and the GAME (`fixtures/f2-apitem-oracle.json`,
 *     `probe-seedling-f2-apitem.mjs --record`) takes it on the predicted tick:
 *     a `hold` tape of `takenAt + 1` ticks clears the slot, `takenAt` does not.
 *   · D1b: a staging that clears the apitem's tag boots (it refused before),
 *     with no apitem, and the game's room holds none either.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { f2ApItemCase, f2Preset, f2StagingAt } from './fidelityF2.js';
import { apItemTakenOnTick, solveSegment } from './solverBot.js';
import { createRunForStaging } from './tapeRunner.js';
import { apItemsOf, createJsRuntime } from './jsRuntimeCore.js';
import { planLevelSetChunks } from './levelSetValidator.js';
import { PERSISTENCE_RESPONSE, persistenceClearsFor } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const ORACLE = readJson('frontend/modules/seedlingDemo/fixtures/f2-apitem-oracle.json');
const GAME_CONFIG = readJson('frontend/modules/flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties });
const PRESETS = ORACLE.rooms.map((r) => r.preset);
const CASES = Object.fromEntries(PRESETS.map((p) => [p, f2ApItemCase(ROOT, p)]));

describe('fidelity F2 — D1c: the apitem goal SOLVES, and the game takes it on the predicted tick', () => {
    it('the oracle covers the three generated presets the solver reaches', () => {
        expect(PRESETS).toEqual(['seedling_generated_room', 'seedling_generated_leaf', 'seedling_generated_host']);
    });
    it.each(PRESETS)('%s: strategy `apitem`, taken on the tick the GAME took it', (preset) => {
        const c = CASES[preset];
        const row = ORACLE.rooms.find((r) => r.preset === preset);
        const rec = c.out.records.at(-1);
        expect(rec).toMatchObject({ goal: 'collect-placement', strategy: 'apitem', arm: 'walk', level: 0 });
        expect(rec.apItem).toEqual({ id: row.apItem, tag: row.tag, x: c.apItem.x, y: c.apItem.y });
        expect(c.takenAt).toBe(row.takenAt);
        // The game's bracket: one more world update than the take's index clears the slot, none fewer.
        expect(row.take).toEqual({ ticks: c.takenAt + 1, cleared: true, error: '' });
        expect(row.before).toEqual({ ticks: c.takenAt, cleared: false, error: '' });
        expect(row.positions.worst).toBe(0);
        expect(row.positions.compared).toBe(c.takenAt + 2);
        expect(c.perTick).toHaveLength(row.solveTicks);
        // The trace names the selection and what it rejected.
        expect(c.out.trace.rows.some((r) => r.strategy.verb === 'apitem')).toBe(true);
    });
    it('the solve is pinned: (preset, takenAt, ticks)', () => {
        expect(PRESETS.map((p) => [p, CASES[p].takenAt, CASES[p].perTick.length])).toEqual([
            ['seedling_generated_room', 254, 266],
            ['seedling_generated_leaf', 127, 140],
            ['seedling_generated_host', 95, 106],
        ]);
    });
    it('the swim room\'s apitem (across water) refuses by name, as the J2 walker does', () => {
        const p = f2Preset(ROOT, 'seedling_generated_swim');
        const staging = f2StagingAt(p.set.start);
        const run = createRunForStaging(staging, p.levelSource, { scratchPersistence: true });
        const [a] = run.world.apItems;
        expect(() => solveSegment({ run, goals: [{ kind: 'collect-placement', placement: { x: a.x, y: a.y } }],
            name: 'f2-swim', boot: staging.boot })).toThrow(/no corridor for goal collect-placement toward \(40,56\)/);
    });
    it('a second goal at the same apitem is met in passing, with the first take\'s tick', () => {
        const c = CASES.seedling_generated_room;
        const run = createRunForStaging(c.staging, c.levelSource, { scratchPersistence: true });
        const goal = { kind: 'collect-placement', placement: { x: c.apItem.x, y: c.apItem.y } };
        const out = solveSegment({ run, goals: [goal, goal], name: 'f2-twice', boot: c.staging.boot });
        expect(out.records.filter((r) => r.strategy === 'apitem').map((r) => [r.arm, r.takenAt]))
            .toEqual([['walk', 254], ['collected-in-passing', 254]]);
        expect(out.perTick).toHaveLength(266);
    });
});

describe('fidelity F2 — D1a: ONE contact rule (the solver\'s and the JS page\'s, pinned equal)', () => {
    it.each(PRESETS)('%s: the page reports its check on the very tick the solver says, over the solver\'s own keys', (preset) => {
        const c = CASES[preset];
        const rt = createJsRuntime({});
        rt.game.configure(BRIDGE_CONFIG);
        for (const ch of planLevelSetChunks(c.set).chunks) rt.game.botLoadLevels(JSON.stringify(ch));
        const { level, x, y } = c.set.start;
        rt.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
        const checks = [];
        c.perTick.forEach((h, i) => {
            const n0 = rt.events.length;
            rt.tick(new Set(h));
            expect({ level: rt.run.level, x: rt.run.state.x, y: rt.run.state.y }).toEqual(c.expected[i + 1]);
            for (const e of rt.events.slice(n0)) if (e.type === 'check') checks.push([i, e.level, e.tag]);
        });
        expect(checks).toEqual([[c.takenAt, c.apItem.level, c.apItem.tag]]);
    });
    it.each(PRESETS)('%s: `world.apItems` carries the page\'s own boxes (`apItemsOf`)', (preset) => {
        const c = CASES[preset];
        const run = createRunForStaging(c.staging, c.levelSource, { scratchPersistence: true });
        const page = apItemsOf(c.records.get(c.set.start.level));
        expect(run.world.apItems.map((a) => ({ x: a.x, y: a.y, tag: a.tag, look: a.look, rect: a.rect })))
            .toEqual(page.map((a) => ({ x: a.x, y: a.y, tag: a.tag, look: a.look, rect: a.rect })));
    });
    describe('`apItemTakenOnTick`, row by row', () => {
        const { rect } = CASES.seedling_generated_room.apItem;
        const items = [{ id: 'a', rect }, { id: 'b', rect }];
        const on = { x: rect.x + 4, y: rect.y + 4 };
        const pre = { level: 0, ...on, inCeremony: false, deaths: 0, transitions: 0 };
        const post = { level: 0, deaths: 0, transitions: 0 };
        it('an overlap takes the FIRST apitem in order (one per tick, as the page)', () => {
            expect(apItemTakenOnTick(items, pre, post)?.id).toBe('a');
        });
        it.each([
            ['a ceremony began the tick', { ...pre, inCeremony: true }, post],
            ['the tick changed level', pre, { ...post, level: 1 }],
            ['the tick recorded a death', pre, { ...post, deaths: 1 }],
            ['the tick fired a transition', pre, { ...post, transitions: 1 }],
        ])('none when %s', (_w, a, b) => {
            expect(apItemTakenOnTick(items, a, b)).toBeNull();
        });
        it('strict: a box that only TOUCHES the edge takes nothing; one pixel in takes it', () => {
            // `playerBoxAt(x, y).right` is `x + playerBoxAt(0, 0).right`.
            const touching = { ...pre, x: rect.x - playerBoxAt(0, 0).right, y: rect.y + 4 };
            expect(playerBoxAt(touching.x, touching.y).right).toBe(rect.x);
            expect(apItemTakenOnTick(items, touching, post)).toBeNull();
            expect(apItemTakenOnTick(items, { ...touching, x: touching.x + 1 }, post)?.id).toBe('a');
        });
    });
});

describe('fidelity F2 — D1b: the apitem\'s persistence response', () => {
    it('is `despawn` (`APItem.check()`: a cleared tag removes it, `doActions = false`)', () => {
        expect(PERSISTENCE_RESPONSE.apitem).toBe('despawn');
    });
    it.each(PRESETS)('%s: a staging that clears its tag BOOTS, with no apitem; the game\'s room holds none', (preset) => {
        const c = CASES[preset];
        const row = ORACLE.rooms.find((r) => r.preset === preset);
        const staging = { ...c.staging, persistence: [{ level: c.apItem.level, tag: c.apItem.tag }] };
        const run = createRunForStaging(staging, c.levelSource, { scratchPersistence: true });
        expect(run.world.apItems).toEqual([]);
        expect(row.clearedRoom.apItems).toEqual([]);
        expect(row.clearedRoom.persistence_cleared).toEqual([{ tag: c.apItem.tag, level: c.apItem.level }]);
        // The control: with no clear, both the model and the game hold the one apitem.
        expect(createRunForStaging(c.staging, c.levelSource, { scratchPersistence: true }).world.apItems).toHaveLength(1);
        expect(row.room.apItems).toEqual([{ cls: 'Pickups::APItem', x: c.apItem.x + 8, y: c.apItem.y + 8 }]);
    });
    it('the derived clear offer neither refuses an apitem tag nor offers one (it removes nothing in the way)', () => {
        const c = CASES.seedling_generated_room;
        const { offered, refused } = persistenceClearsFor(c.records.get(0));
        expect(refused.filter((r) => /apitem/.test(r.why))).toEqual([]);
        expect(offered.filter((o) => o.removes.some((id) => id.startsWith('apitem')))).toEqual([]);
    });
});
