/**
 * seedlingDemo — **THE BAIT GATE on Seedling** (seedling gen baitgate; ⚖ the
 * user 2026-11-04, "(1) Bait gadget").
 *
 * The geometry is `procgenCore/elements/baitGate.js` (its own rows drive the
 * placement rules and their mutants). This file drives the BINDING, the
 * CERTIFICATION and the GRADE:
 *  · the entity rows — `bob` on the door cell (no attributes, NO tag) and the
 *    lure as TERRAIN (one `water` cell, no entity);
 *  · a generated room places and CERTIFIES `[bait, collect]`;
 *  · the strategy differential grades it STRONG (refused AT the disabled gate);
 *  · a MUTANT per part changes the grade: the lure removed (the with-arm
 *    refuses), the body removed (INERT), and the lure moved LEVEL with the
 *    door's approach — the measured reason `LURE_OFFSETS` skips that row: with
 *    `bait` off the ladder's DETOUR drowns the body (⚖ hammer-2: a legitimate
 *    different solution), so the room solves without `bait`.
 *
 * ⛓ THE WITNESS, measured at this slice (`empty` 10x10 pre-sword): seeds 1 and 2
 * grade STRONG; seed 3 grades NOT-ESTABLISHED (its start side is three cells
 * wide and the detour drags the body across the lure) — `strategySwitchGrade.slow`
 * holds the CLI rows.
 */

import { describe, expect, it } from 'vitest';

import { defaultElementsFor, generateSeedlingLevel, seedlingOracle } from './procgenSeedling.js';
import { PART_TERRAIN, seedlingOnConnectorEntities } from './procgenSeedlingElements.js';
import { POST_FEATHER_ITEMS, PRE_SWORD_PALETTE } from './procgenPalette.js';
import { VERDICT } from './procgenOracle.js';
import { TERRAIN, oelAtTile } from './procgenLevel.js';
import { gradeOf, requirementsFor } from './procgenRequirements.js';
import { ELEMENT_NAMES, ELEMENT_TABLE, headsNeeding, parseElementSpec } from '../procgenCore/elementSpec.js';
import { BAIT_GATE, BAIT_GATE_BODY_ID, BAIT_GATE_LURE_ID } from '../procgenCore/elements/baitGate.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

const gen = ({ seed = 1, require } = {}) => generateSeedlingLevel({
    seed,
    palette: PRE_SWORD_PALETTE,
    defaults: { width: 10, height: 10 },
    skeleton: parseSkeleton('empty', { substrate: 'seedling' }),
    elements: parseElementSpec('baitgate'),
    ...(require ? { require } : {}),
});

/** The strategy grade of `record` (the generated room, possibly mutated) through the ONE differential. */
function gradeRecord(out, record) {
    const oracle = seedlingOracle({ model: out.model, items: PRE_SWORD_PALETTE.items });
    const withArm = oracle.solve(record);
    const report = requirementsFor({
        record, model: out.model, palette: PRE_SWORD_PALETTE, summary: out.summary, seed: 1,
        biome: PRE_SWORD_PALETTE.name,
    }, { verdict: withArm.verdict, ticks: withArm.ticks }, { strategies: ['bait'] });
    const row = report.rows.find((r) => r.flag === 'strategy:bait');
    return { withArm, row, grade: gradeOf(row) };
}

/** `record` with each `[x, y, terrain]` cell repainted. */
const paint = (record, cells) => ({
    ...record,
    layers: record.layers.map((l) => (!Array.isArray(l.tiles) ? l : {
        ...l,
        tiles: l.tiles.map((t) => {
            const c = cells.find(([x, y]) => x === t[0] && y === t[1]);
            return c ? [t[0], t[1], TERRAIN[c[2]].column * 16, 0, ...t.slice(4)] : t;
        }),
    })),
});

const terrainAt = (record, x, y) => {
    for (const l of record.layers) {
        if (!Array.isArray(l.tiles)) continue;
        const t = l.tiles.find((u) => u[0] === x && u[1] === y);
        if (t) return t[2] / 16;
    }
    return null;
};

describe('⛓⛓⛓ the BAIT GATE\'s table row and binding rows', () => {
    it('the head is `baitgate`, LAST, needs no item, opt-in, and the `strategy:bait` head', () => {
        expect(ELEMENT_NAMES.at(-1)).toBe('baitgate');
        expect(ELEMENT_TABLE.baitgate.element).toBe(BAIT_GATE);
        expect(ELEMENT_TABLE.baitgate.needs).toEqual([]);
        expect(ELEMENT_TABLE.baitgate.needsStrategy).toEqual(['bait']);
        /** OPT-IN: in no biome's default draw, not even the last biome's */
        expect(defaultElementsFor(POST_FEATHER_ITEMS).any.map((m) => m.name)).not.toContain('baitgate');
        for (const flag of ['hasSword', 'hasShield', 'canSwim', 'hasFeather']) {
            expect(headsNeeding(flag)).not.toContain('baitgate');
        }
        expect(headsNeeding('strategy:bait')).toEqual(['baitgate']);
    });

    it('the body is a `bob` (the vanilla spelling, no attributes) and spends NO tag; the lure is terrain', () => {
        let tags = 0;
        const out = seedlingOnConnectorEntities({
            placed: { entities: [
                { role: 'obstacle', x: 4, y: 5, id: BAIT_GATE_BODY_ID },
                { role: 'obstacle', x: 2, y: 3, id: BAIT_GATE_LURE_ID }] },
            tagFor: () => { tags += 1; return 7; },
        });
        expect(out.entities).toEqual([{ type: 'bob', tx: 4, ty: 5, attrs: {} }]);
        expect(out.tags).toEqual({});
        expect(tags).toBe(0);
        expect(PART_TERRAIN).toEqual({ [BAIT_GATE_LURE_ID]: 'water' });
    });
});

describe('⛓⛓⛓ on a generated Seedling level (empty 10x10, pre-sword)', () => {
    it('places and CERTIFIES `[bait, collect]` on seeds 1..3: one bob on the door cell, the lure painted water', () => {
        for (const seed of [1, 2, 3]) {
            const out = gen({ seed });
            const what = `baitgate seed ${seed}`;
            const placed = out.model.elements.placed[0];
            expect(placed.family, what).toBe('baitgate');
            expect(out.certification.certified, what).toBe(true);
            expect(out.certification.strategies, what).toEqual(['bait', 'collect']);
            const bobs = out.record.entities.filter((e) => e.type === 'bob');
            expect(bobs, what).toHaveLength(1);
            expect(bobs[0], what).toMatchObject(oelAtTile(placed.doorCell.x, placed.doorCell.y));
            const lure = placed.entities.find((e) => e.id === BAIT_GATE_LURE_ID);
            expect(terrainAt(out.record, lure.x, lure.y), what).toBe(TERRAIN.water.column);
        }
    }, 240000);
});

describe('⛓⛓⛓ THE GRADE: STRONG at the disabled gate, and a mutant per part moves it', () => {
    it('`--require=strategy:bait` grades STRONG (seed 1)', () => {
        const out = gen({ require: ['strategy:bait'] });
        expect(out.summary.require.met).toBe(true);
        expect(out.summary.require.grade).toBe('STRONG');
        expect(out.summary.require.without.verdict).toBe('REFUSED');
    }, 240000);

    it('control: the generated room grades STRONG through the same helper the mutants use', () => {
        const out = gen();
        const g = gradeRecord(out, out.record);
        expect(g.withArm.verdict).toBe(VERDICT.SOLVED);
        expect(g.grade).toBe('STRONG');
        expect(g.row.disabled.hits['rung:bait']).toBeGreaterThan(0);
    }, 240000);

    it('MUTANT: the lure removed (painted ground) — the body cannot be baited, the with-arm refuses', () => {
        const out = gen();
        const lure = out.model.elements.placed[0].entities.find((e) => e.id === BAIT_GATE_LURE_ID);
        const g = gradeRecord(out, paint(out.record, [[lure.x, lure.y, 'ground']]));
        expect(g.withArm.verdict).not.toBe(VERDICT.SOLVED);
        expect(g.grade).not.toBe('STRONG');
    }, 240000);

    it('MUTANT: the body removed — nothing to bait, the room solves without it (INERT)', () => {
        const out = gen();
        const g = gradeRecord(out, { ...out.record, entities: out.record.entities.filter((e) => e.type !== 'bob') });
        expect(g.withArm.verdict).toBe(VERDICT.SOLVED);
        expect(g.grade).toBe('INERT');
    }, 240000);

    it('⛔ PIN: the lure moved LEVEL with the door\'s approach — bait OFF solves by DETOUR, so not STRONG', () => {
        /** ⛓ seed 1: door (1,5), approach from (1,4); the generated lure is (2,3); level with the approach is (2,4) */
        const out = gen();
        const placed = out.model.elements.placed[0];
        const lure = placed.entities.find((e) => e.id === BAIT_GATE_LURE_ID);
        const B = placed.clearer[0];
        expect([placed.doorCell, B, { x: lure.x, y: lure.y }]).toEqual([{ x: 1, y: 5 }, { x: 1, y: 4 }, { x: 2, y: 3 }]);
        const g = gradeRecord(out, paint(out.record, [[lure.x, lure.y, 'ground'], [2, 4, 'water']]));
        expect(g.withArm.verdict).toBe(VERDICT.SOLVED);
        expect(g.row.withoutVerdict).toBe(VERDICT.SOLVED);
        expect(g.grade).not.toBe('STRONG');
    }, 240000);
});
