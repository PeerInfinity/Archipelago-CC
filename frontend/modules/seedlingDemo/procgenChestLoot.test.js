/**
 * seedlingDemo — **LOOT CHESTS (B1) and GOAL CHESTS (B3) on Seedling** (seedling
 * gen content §2; ⚖ the user 2026-11-01, *"(e) Loot/goal chests"*, after the
 * oracle's chest-goal fix, `seedling-js-chest-goal-collect`).
 *
 * The loot chest's geometry is `procgenCore/elements/chestLoot.js` (its own rows
 * drive the placement rules and their mutants). This file drives:
 *  · B1 — the table row, the binding (`chest {tag}`, ONE tag), the `none` law at
 *    the on-connector commit, the CERTIFICATION (the chest is a second collect
 *    goal ahead of the room's own, so every certificate opens it), and the
 *    location carrier `summary.lootChests`;
 *  · B3 — `defaults.goalClass: 'chest'`: the goal is a chest, certified by the
 *    chest record; a carved room gets its stance pocket or REFUSES the goal chest
 *    by name and keeps the torch;
 *  · identity — a level asked for neither is unmoved (one goal, no new key).
 *
 * MUTANTS (measured, each reverted — the slice's as-built):
 *  (a) `lootChestGoals` returns `[]` ⇒ the "certificate opens the chest" rows red;
 *  (b) the composite's `none` branch dropped (falls to the door law) ⇒ every loot
 *      room refuses `the-elements-door-is-not-a-cut` and the B1 rows red;
 *  (c) js's chest arm dropped from `procgenOracle.certifyCollects` ⇒ every B3
 *      certify row reds (the goal chest has "no collect record"), and so do B1's.
 */

import { describe, expect, it } from 'vitest';

import {
    GOAL_CHEST_CLASS, GOAL_CHEST_REFUSALS, SEEDLING_AREA_REFUSALS, SEEDLING_DEFAULTS, carveLawRefusal,
    generateSeedlingLevel, lootChestLocationsOf, openLawRefusal,
} from './procgenSeedling.js';
import { compositeSeedlingOnConnector, seedlingOnConnectorEntities } from './procgenSeedlingElements.js';
import { POST_SWORD_PALETTE, PRE_SWORD_PALETTE } from './procgenPalette.js';
import { oelAtTile } from './procgenLevel.js';
import { tagOf } from './levelWorld.js';
import { ELEMENT_NAMES, ELEMENT_TABLE, headsNeeding, parseElementSpec } from '../procgenCore/elementSpec.js';
import { CHEST_LOOT, CHEST_LOOT_CHEST_ID } from '../procgenCore/elements/chestLoot.js';
import { LAW_NONE } from '../procgenCore/elements.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

const gen = (palette, { seed = 1, kind = 'empty', size = 10, elements = 'chestloot', goalClass } = {}) =>
    generateSeedlingLevel({
        seed, palette,
        defaults: { width: size, height: size, ...(goalClass ? { goalClass } : {}) },
        skeleton: parseSkeleton(kind, { substrate: 'seedling' }),
        elements: parseElementSpec(elements),
    });
const BIOMES = [['pre-sword', PRE_SWORD_PALETTE], ['post-sword', POST_SWORD_PALETTE]];
const chestsOf = (record) => record.entities.filter((e) => e.type === 'chest');

describe('⛓⛓⛓ B1 — the LOOT CHEST\'s table row and binding row', () => {
    it('the head is `chestloot`, LAST, needs no item, law `none`, opt-in, never a `require` head', () => {
        expect(ELEMENT_TABLE.chestloot.element).toBe(CHEST_LOOT);
        expect(ELEMENT_NAMES.at(-1)).toBe('chestloot');
        expect(ELEMENT_TABLE.chestloot.needs).toEqual([]);
        expect(ELEMENT_TABLE.chestloot.meetsRequire).toBe(false);
        expect(CHEST_LOOT.law).toBe(LAW_NONE);
        for (const flag of ['hasSword', 'hasShield', 'canSwim', 'hasFeather', 'hasFire']) {
            expect(headsNeeding(flag)).not.toContain('chestloot');
        }
    });

    it('the binding writes `chest {tag}` at the cell, ONE tag (the chest\'s check address)', () => {
        const placed = { entities: [{ role: 'obstacle', x: 4, y: 2, id: CHEST_LOOT_CHEST_ID }] };
        let n = 0;
        const out = seedlingOnConnectorEntities({ placed, tagFor: () => { n += 1; return 7; } });
        expect(out.entities).toEqual([{ type: 'chest', tx: 4, ty: 2, attrs: { tag: '7' } }]);
        expect(out.tags).toEqual({ chest: 7 });
        expect(n).toBe(1);
    });
});

describe('⛓⛓ B1 — the `none` law at the ON-CONNECTOR commit', () => {
    const W = 10;
    const H = 10;
    const START = { tx: 1, ty: 1 };
    const GOAL = { tx: 5, ty: 1 };
    /** a corridor (1..5,1), an alcove (3,2) below (3,1) whose stance (3,3) is reached round by (4,2)-(4,3) */
    const FLOOR = new Set(['1,1', '2,1', '3,1', '4,1', '5,1', '3,2', '3,3', '4,2', '4,3']);
    const groundAt = (x, y) => FLOOR.has(`${x},${y}`);
    const law = (o) => openLawRefusal({ width: W, height: H, walkableFor: o.paintedFor,
        start: { x: START.tx, y: START.ty }, goal: { x: GOAL.tx, y: GOAL.ty },
        doorKeys: o.doorKeys, clearerKeys: o.clearerKeys, name: 'the fixture' });
    const call = (placement, openLaw = law) => compositeSeedlingOnConnector({
        width: W, height: H, groundAt, skeletonWallAt: (x, y) => !groundAt(x, y), placement,
        start: START, goal: GOAL, law: LAW_NONE, openLaw,
        doorLaw: () => 'the door law must not be asked of a `none` element',
        carveLaw: ({ carved, walkableAfter, walkableBefore }) => carveLawRefusal({ width: W, height: H, carved,
            walkableAfter, walkableBefore, start: { x: START.tx, y: START.ty }, goal: { x: GOAL.tx, y: GOAL.ty },
            name: 'the fixture' }),
    });
    const at = (chest, stance) => ({
        tiles: [],
        entities: { blocks: [], buttons: [], obstacles: [{ ...chest, id: CHEST_LOOT_CHEST_ID }], items: [] },
        doorCells: [chest], clearer: [stance], demand: [], area: null,
        symbols: { holds: [], grants: [] }, cost: { wall: 0, carved: 0 },
    });

    it('a chest off the path whose stance the start reaches is COMMITTED (the door law is never asked)', () => {
        expect(call(at({ x: 3, y: 2 }, { x: 3, y: 3 })).refused).toBe(undefined);
    });
    it('`the-elements-open-cell-walls-off-the-room` — the chest cuts the room (on the path)', () => {
        expect(call(at({ x: 4, y: 1 }, { x: 4, y: 2 })).refused?.reason)
            .toBe('the-elements-open-cell-walls-off-the-room');
    });
    it('`the-elements-open-cell-walls-off-the-room` — its stance is behind it (a spur, no way round)', () => {
        const SPUR = new Set(['1,1', '2,1', '3,1', '4,1', '5,1', '3,2', '3,3']);
        const shut = openLawRefusal({ width: W, height: H, walkableFor: (walled) => (x, y) => SPUR.has(`${x},${y}`)
            && !(walled?.has(`${x},${y}`)), start: { x: 1, y: 1 }, goal: { x: 5, y: 1 },
        doorKeys: new Set(['3,2']), clearerKeys: ['3,3'], name: 'f' });
        expect(shut).toMatch(/CLEARER \(3,3\) is unreachable/);
    });
    it('`the-elements-open-law-is-not-offered` — a binding with no `openLaw`', () => {
        expect(call(at({ x: 3, y: 2 }, { x: 3, y: 3 }), null).refused?.reason)
            .toBe('the-elements-open-law-is-not-offered');
    });
});

describe('⛓⛓⛓ B1 — a generated room places the loot chest and CERTIFIES by opening it', () => {
    it.each(BIOMES)('%s, empty 10x10 seeds 1..3: placed, goals [chest, goal], collected [chest, goal]', (_b, palette) => {
        for (const seed of [1, 2, 3]) {
            const out = gen(palette, { seed });
            const el = out.model.elements;
            expect(el.ran, `seed ${seed}`).toBe(true);
            const { doorCell } = el.placed[0];
            const { x, y } = oelAtTile(doorCell.x, doorCell.y);
            expect(out.model.goals).toEqual([{ kind: 'collect-placement', placement: { x, y } },
                { kind: 'collect-placement', placement: out.model.goalOel }]);
            expect(out.certification.certified).toBe(true);
            expect(out.summary.finalCertification.certified).toBe(true);
            expect(out.summary.finalCertification.collected.map((c) => [c.tag, c.x, c.y, c.item])).toEqual([
                ['chest', x, y, 'sealpiece'], ['torchpickup', out.model.goalOel.x, out.model.goalOel.y, 'torch']]);
            expect(chestsOf(out.record)).toEqual([{ type: 'chest', x, y, attrs: { tag: '1' } }]);
        }
    }, 120_000);

    it('carved kinds: winding/bushy/loopy seed 2 place and certify with the chest opened first', () => {
        for (const kind of ['winding', 'bushy', 'loopy']) {
            const out = gen(PRE_SWORD_PALETTE, { seed: 2, kind });
            expect(out.model.elements.ran, kind).toBe(true);
            expect(out.summary.finalCertification.collected.map((c) => c.tag), kind).toEqual(['chest', 'torchpickup']);
        }
    }, 120_000);

    it('a carved room with no legal cell refuses BY NAME and stays an ordinary certified level', () => {
        const out = gen(PRE_SWORD_PALETTE, { seed: 3, kind: 'winding' });
        expect(out.model.elements.ran).toBe(false);
        expect(out.model.elements.refused.reason).toBe('the-stance-is-not-floor');
        expect(out.model.goals).toHaveLength(1);
        expect(chestsOf(out.record)).toEqual([]);
        expect('lootChests' in out.summary).toBe(false);
    }, 60_000);

    it('the location: `summary.lootChests` = the chest\'s cell and tag; the tag is the engine\'s own `tagOf`', () => {
        const out = gen(PRE_SWORD_PALETTE);
        const [loc] = out.summary.lootChests;
        expect(out.summary.lootChests).toHaveLength(1);
        expect(loc.kind).toBe('chest-loot');
        const [chest] = chestsOf(out.record);
        expect(loc.cell).toEqual({ tx: chest.x / 16, ty: chest.y / 16 });
        expect(loc.tag).toBe(tagOf(chest.type, chest.attrs));
        expect(lootChestLocationsOf(out.model, out.record)).toEqual(out.summary.lootChests);
    }, 60_000);

    it('⛔ identity: `none` and `chestdoor` levels carry no `lootChests` and keep their goal list', () => {
        const none = gen(PRE_SWORD_PALETTE, { elements: 'none' });
        expect('lootChests' in none.summary).toBe(false);
        expect(none.model.goals).toEqual([{ kind: 'collect-placement', placement: none.model.goalOel }]);
        const door = gen(PRE_SWORD_PALETTE, { elements: 'chestdoor' });
        expect('lootChests' in door.summary).toBe(false);
        expect(door.model.goals).toHaveLength(1);
    }, 60_000);
});

describe('⛓⛓⛓ B3 — `goalClass: \'chest\'`: the room\'s certified target is a CHEST', () => {
    it('the class constant and the refusal names (both in the module\'s census key)', () => {
        expect(GOAL_CHEST_CLASS).toBe('chest');
        expect(SEEDLING_DEFAULTS.goalClass).toBe('torchpickup');
        for (const r of GOAL_CHEST_REFUSALS) expect(SEEDLING_AREA_REFUSALS).toContain(r);
    });

    it.each(BIOMES)('%s, empty 10x10 seeds 1..3: the goal IS a chest, certified by its chest record', (_b, palette) => {
        for (const seed of [1, 2, 3]) {
            const out = gen(palette, { seed, elements: 'none', goalClass: 'chest' });
            const { goalOel, goalCell } = out.model;
            expect(out.summary.goalClass, `seed ${seed}`).toBe('chest');
            expect(goalCell.ty).toBeLessThanOrEqual(10 - 3);
            expect(chestsOf(out.record)).toEqual([{ type: 'chest', x: goalOel.x, y: goalOel.y, attrs: { tag: '0' } }]);
            expect(out.record.entities.some((e) => e.type === 'torchpickup')).toBe(false);
            expect(out.summary.finalCertification).toMatchObject({ certified: true, missing: [] });
            expect(out.summary.finalCertification.collected).toEqual([{ tag: 'chest', x: goalOel.x, y: goalOel.y,
                item: 'sealpiece', strategy: 'chest', id: `chest@${goalOel.x},${goalOel.y}` }]);
        }
    }, 120_000);

    it('a carved room whose stance is wall gets the POCKET (winding seed 3: 3 cells) and certifies', () => {
        const out = gen(PRE_SWORD_PALETTE, { seed: 3, kind: 'winding', elements: 'none', goalClass: 'chest' });
        expect(out.model.goalChest.placed).toBe(true);
        expect(out.model.goalChest.pocket).toHaveLength(3);
        expect(out.model.goalChest.pocket[0]).toEqual({ x: out.model.goalCell.tx, y: out.model.goalCell.ty + 1 });
        expect(out.summary.goalClass).toBe('chest');
        expect(out.summary.finalCertification.collected.map((c) => c.tag)).toEqual(['chest']);
    }, 60_000);

    it('a room that can give no stance REFUSES the goal chest BY NAME and keeps the torch (certified)', () => {
        const out = gen(PRE_SWORD_PALETTE, { seed: 3, kind: 'branchy', elements: 'none', goalClass: 'chest' });
        expect(out.model.goalChest).toMatchObject({ placed: false,
            refused: { reason: 'the-goal-chest-has-no-stance-pocket' } });
        expect(out.summary.goalClass).toBe('torchpickup');
        expect(out.summary.goalChestRefused).toBe('the-goal-chest-has-no-stance-pocket');
        expect(chestsOf(out.record)).toEqual([]);
        expect(out.summary.finalCertification.certified).toBe(true);
    }, 60_000);

    /**
     * ⚠ NAMED GAP (solver, not this slice's to fix): a loot chest in a goal-chest room is DROPPED. The walk to
     * one chest crosses the other's trigger line (a chest opens on the player's box crossing the line below
     * it) and `solverBot`'s chest leg refuses a leg that opened a chest it did not name ("A chest the leg did
     * not name is a wall somewhere else that the plan still believes is standing"). Measured 11/12 (empty and
     * winding, seeds 1–6). The level still certifies with its goal chest; the drop is graded, by name.
     */
    it('B1 + B3 together: the loot chest is DROPPED (graded), the goal chest certifies', () => {
        const out = gen(PRE_SWORD_PALETTE, { seed: 2, goalClass: 'chest' });
        expect(out.model.elements.ran).toBe(false);
        expect(out.model.elements.refused.reason).toBe('the-skeleton-does-not-solve-with-the-element');
        expect(out.certification.reasonText).toMatch(/A chest the leg did not name/);
        expect(out.summary.goalClass).toBe('chest');
        expect(out.summary.finalCertification.collected.map((c) => c.tag)).toEqual(['chest']);
    }, 60_000);

    it('⛔ identity: the default class builds no `goalChest`, no `goalChestRefused`, and a torch goal', () => {
        const out = gen(PRE_SWORD_PALETTE, { elements: 'none' });
        expect('goalChest' in out.model).toBe(false);
        expect('goalChestRefused' in out.summary).toBe(false);
        expect(out.summary.goalClass).toBe('torchpickup');
    }, 60_000);
});
