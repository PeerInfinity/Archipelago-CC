/**
 * seedlingDemo — **THE HOLD GATE and THE WEIGH GATE on Seedling** (seedling gen
 * strategy-switch r3; ⚖ the user 2026-11-01, "(b) More strategy elements").
 *
 * The geometry is `procgenCore/elements/strategyGate.js` (its own rows drive
 * the placement rules and their mutants). This file drives the BINDING, the
 * CERTIFICATION and the GRADE:
 *  · the entity rows — `lock {tset g, tag}` plus `buttonroom {tset g, tag, flip 0,
 *    room -1}` (hold: TWO tags) or plain `button {tset g}` + `pushableblock`
 *    (weigh: ONE tag), `g` the presser cell's group;
 *  · a generated room places and CERTIFIES with its verb before the collect;
 *  · the strategy differential grades it STRONG (refused AT the disabled gate);
 *  · a MUTANT per gadget changes the grade: the hold gate's presser moved out of
 *    the start side's reach (behind the lock), the weigh gate's block dropped.
 *
 * ⛓ THE WITNESS, measured at this slice (`empty` 10x10 pre-sword, seeds 1..3):
 * hold certifies `[hold, collect]` and weigh `[weigh, collect]` on every seed,
 * and both grade STRONG on every seed (`strategySwitchGrade.slow` holds the CLI
 * rows).
 */

import { describe, expect, it } from 'vitest';

import { SEEDLING_DEFAULTS, defaultElementsFor, generateSeedlingLevel, seedlingOracle } from './procgenSeedling.js';
import { seedlingOnConnectorEntities } from './procgenSeedlingElements.js';
import { POST_FEATHER_ITEMS, PRE_SWORD_PALETTE } from './procgenPalette.js';
import { VERDICT } from './procgenOracle.js';
import { oelAtTile } from './procgenLevel.js';
import { gradeOf, requirementsFor } from './procgenRequirements.js';
import {
    ELEMENT_NAMES, ELEMENT_TABLE, headsNeeding, parseElementSpec,
} from '../procgenCore/elementSpec.js';
import {
    HOLD_GATE, HOLD_GATE_BUTTON_ID, HOLD_GATE_DOOR_ID, WEIGH_GATE, WEIGH_GATE_BUTTON_ID, WEIGH_GATE_DOOR_ID,
} from '../procgenCore/elements/strategyGate.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

const gen = (element, { seed = 1, kind = 'empty', size = 10, require } = {}) => generateSeedlingLevel({
    seed,
    palette: PRE_SWORD_PALETTE,
    defaults: { width: size, height: size },
    skeleton: parseSkeleton(kind, { substrate: 'seedling' }),
    elements: parseElementSpec(element),
    ...(require ? { require } : {}),
});

/** The strategy grade of `record` (the generated room, possibly mutated) through the ONE differential. */
function gradeRecord(out, record, verb) {
    const oracle = seedlingOracle({ model: out.model, items: PRE_SWORD_PALETTE.items });
    const withArm = oracle.solve(record);
    const report = requirementsFor({
        record, model: out.model, palette: PRE_SWORD_PALETTE, summary: out.summary, seed: 1,
        biome: PRE_SWORD_PALETTE.name,
    }, { verdict: withArm.verdict, ticks: withArm.ticks }, { strategies: [verb] });
    const row = report.rows.find((r) => r.flag === `strategy:${verb}`);
    return { withArm, row, grade: gradeOf(row) };
}

describe('⛓⛓⛓ the HOLD and WEIGH gates\' table rows and binding rows', () => {
    it('the heads are `holdgate` then `weighgate`, LAST, need no item, opt-in, and the `strategy:` heads', () => {
        expect(ELEMENT_NAMES.slice(-5)).toEqual(['holdgate', 'weighgate', 'chestloot', 'keygate', 'baitgate']); // ⛓ + B1, + keygate, + baitgate
        expect(ELEMENT_TABLE.holdgate.element).toBe(HOLD_GATE);
        expect(ELEMENT_TABLE.weighgate.element).toBe(WEIGH_GATE);
        for (const name of ['holdgate', 'weighgate']) {
            expect(ELEMENT_TABLE[name].needs).toEqual([]);
            /** OPT-IN: in no biome's default draw, not even the last biome's */
            expect(defaultElementsFor(POST_FEATHER_ITEMS).any.map((m) => m.name)).not.toContain(name);
            for (const flag of ['hasSword', 'hasShield', 'canSwim', 'hasFeather']) {
                expect(headsNeeding(flag)).not.toContain(name);
            }
        }
        expect(ELEMENT_TABLE.holdgate.needsStrategy).toEqual(['hold']);
        expect(ELEMENT_TABLE.weighgate.needsStrategy).toEqual(['weigh']);
        expect(headsNeeding('strategy:hold')).toEqual(['holdgate']);
        expect(headsNeeding('strategy:weigh')).toEqual(['weighgate']);
    });

    it('hold: `lock {tset g, tag}` + `buttonroom {tset g, tag, flip 0, room -1}` — TWO distinct tags, one group', () => {
        let next = 4;
        const out = seedlingOnConnectorEntities({
            placed: { entities: [
                { role: 'obstacle', x: 1, y: 5, id: HOLD_GATE_DOOR_ID },
                { role: 'obstacle', x: 2, y: 3, id: HOLD_GATE_BUTTON_ID }] },
            tagFor: (...taken) => { expect(taken).toEqual(next === 4 ? [] : [4]); return next++; },
            groupIdFor: ({ tx, ty }) => tx * 100 + ty,
        });
        expect(out.tags).toEqual({ lock: 4, presser: 5 });
        expect(out.entities).toEqual([
            { type: 'lock', tx: 1, ty: 5, attrs: { tset: '203', tag: '4' } },
            { type: 'buttonroom', tx: 2, ty: 3, attrs: { tset: '203', tag: '5', flip: '0', room: '-1' } },
        ]);
    });

    it('weigh: `pushableblock` + `lock {tset g, tag}` + `button {tset g}` — ONE tag', () => {
        const out = seedlingOnConnectorEntities({
            placed: { entities: [
                { role: 'block', x: 2, y: 3 },
                { role: 'obstacle', x: 1, y: 5, id: WEIGH_GATE_DOOR_ID },
                { role: 'obstacle', x: 3, y: 3, id: WEIGH_GATE_BUTTON_ID }] },
            tagFor: () => 7,
            groupIdFor: ({ tx, ty }) => tx * 100 + ty,
        });
        expect(out.tags).toEqual({ lock: 7 });
        expect(out.entities).toEqual([
            { type: 'pushableblock', tx: 2, ty: 3 },
            { type: 'lock', tx: 1, ty: 5, attrs: { tset: '303', tag: '7' } },
            { type: 'button', tx: 3, ty: 3, attrs: { tset: '303' } },
        ]);
    });

    it('a gate with no `groupIdFor` refuses BY NAME', () => {
        expect(() => seedlingOnConnectorEntities({
            placed: { entities: [{ role: 'obstacle', x: 2, y: 3, id: HOLD_GATE_BUTTON_ID }] },
            tagFor: () => 1,
        })).toThrow(/HOLD\/WEIGH GATE needs `groupIdFor`/);
    });
});

describe('⛓⛓⛓ on a generated Seedling level (empty 10x10, pre-sword)', () => {
    for (const [element, verb, presser] of [['holdgate', 'hold', 'buttonroom'], ['weighgate', 'weigh', 'button']]) {
        it(`${element}: places and CERTIFIES \`[${verb}, collect]\` on seeds 1..3, the presser in the lock\'s group`, () => {
            for (const seed of [1, 2, 3]) {
                const out = gen(element, { seed });
                const what = `${element} seed ${seed}`;
                expect(out.model.elements.ran, what).toBe(true);
                const placed = out.model.elements.placed[0];
                expect(placed.family, what).toBe(element);
                expect(out.certification.certified, what).toBe(true);
                expect(out.certification.strategies, what).toEqual([verb, 'collect']);
                const locks = out.record.entities.filter((e) => e.type === 'lock');
                const pressers = out.record.entities.filter((e) => e.type === presser);
                expect(locks, what).toHaveLength(1);
                expect(pressers, what).toHaveLength(1);
                expect(pressers[0].attrs.tset, what).toBe(locks[0].attrs.tset);
                expect(locks[0], what).toMatchObject(oelAtTile(placed.doorCell.x, placed.doorCell.y));
                expect(out.record.entities.filter((e) => e.type === 'pushableblock'), what)
                    .toHaveLength(element === 'weighgate' ? 1 : 0);
            }
        }, 240000);
    }
});

describe('⛓⛓⛓ THE GRADE: STRONG at the disabled gate, and a mutant per gadget moves it', () => {
    it('holdgate: `--require=strategy:hold` grades STRONG (seed 1)', () => {
        const out = gen('holdgate', { require: ['strategy:hold'] });
        expect(out.summary.require.met).toBe(true);
        expect(out.summary.require.grade).toBe('STRONG');
        expect(out.summary.require.without.verdict).toBe('REFUSED');
    }, 240000);

    it('weighgate: `--require=strategy:weigh` grades STRONG (seed 1)', () => {
        const out = gen('weighgate', { require: ['strategy:weigh'] });
        expect(out.summary.require.met).toBe(true);
        expect(out.summary.require.grade).toBe('STRONG');
        expect(out.summary.require.without.verdict).toBe('REFUSED');
    }, 240000);

    it('control: the generated rooms grade STRONG through the same helper the mutants use', () => {
        for (const [element, verb] of [['holdgate', 'hold'], ['weighgate', 'weigh']]) {
            const out = gen(element);
            const g = gradeRecord(out, out.record, verb);
            expect(g.withArm.verdict, element).toBe(VERDICT.SOLVED);
            expect(g.grade, element).toBe('STRONG');
            expect(Object.values(g.row.disabled.hits).reduce((a, b) => a + b, 0), element).toBeGreaterThan(0);
        }
    }, 240000);

    it('MUTANT (hold): the presser moved out of the start side\'s reach (behind the lock) — no longer STRONG', () => {
        const out = gen('holdgate');
        const goal = out.record.entities.find((e) => e.type === SEEDLING_DEFAULTS.goalClass);
        const mutated = { ...out.record, entities: out.record.entities.map((e) => (e.type === 'buttonroom'
            ? { ...e, x: goal.x - 16, y: goal.y } : e)) };
        const g = gradeRecord(out, mutated, 'hold');
        expect(g.withArm.verdict).not.toBe(VERDICT.SOLVED);
        expect(g.grade).not.toBe('STRONG');
    }, 240000);

    it('MUTANT (hold): the presser made MOMENTARY (a plain `button`) — the lock refines to `weigh`, no longer STRONG', () => {
        const out = gen('holdgate');
        const mutated = { ...out.record, entities: out.record.entities.map((e) => (e.type === 'buttonroom'
            ? { type: 'button', x: e.x, y: e.y, attrs: { tset: e.attrs.tset } } : e)) };
        const g = gradeRecord(out, mutated, 'hold');
        expect(g.withArm.verdict).not.toBe(VERDICT.SOLVED);
        expect(g.grade).not.toBe('STRONG');
    }, 240000);

    it('MUTANT (weigh): the block dropped — no longer STRONG', () => {
        const out = gen('weighgate');
        const mutated = { ...out.record, entities: out.record.entities.filter((e) => e.type !== 'pushableblock') };
        const g = gradeRecord(out, mutated, 'weigh');
        expect(g.withArm.verdict).not.toBe(VERDICT.SOLVED);
        expect(g.grade).not.toBe('STRONG');
    }, 240000);
});
