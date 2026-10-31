/**
 * seedlingDemo — **THE ROPE GATE on Seedling: an armed arrow trap whose lane is
 * a cut, and the rope that silences it** (seedling gen content A1, the L16
 * pattern; ⚖ the user 2026-10-28/30).
 *
 * The element's geometry is `procgenCore/elements/ropeGate.js` (its own rows
 * drive the three placement rules). This file drives the BINDING and the
 * ORACLE:
 *  · the entity rows — `arrowtrap {tset g, shoot 1}` and `rope {tset g, tag}`
 *    with its `<node>`, one group, ONE tag from the 30;
 *  · a generated room places, certifies with `pull` before the collect, and
 *    the certificate takes NO arrow hit;
 *  · the sword differential grades `hasSword` REQUIRED (STRONG — pre-sword the
 *    solver REFUSES);
 *  · ⚖ L16 — the oracle REFUSES a certificate that tanks an arrow: a hand-built
 *    room whose only route is a tanked crossing (`ARROW_LANE_CROSSING` on, which
 *    the generator never grades with) solves in the solver and is refused here.
 *
 * ⛓ THE WITNESS, measured at this slice (`generate-seedling-level.mjs
 * --biome=post-sword --elements=ropegate --skeleton=empty`, 10x10): seeds 1..3
 * place and certify, verbs `[pull, collect]`.
 *
 * MUTANTS (predicted, then measured — the slice's as-built):
 *  (a) the oracle's no-tank branch removed ⇒ the tanked room SOLVES and the
 *      no-tank row reds;
 *  (b) the rope's `tset` taken from a different cell than the trap's ⇒ the
 *      certification refuses (the PULL rung finds no presser of the lane's
 *      group) and the certify row reds;
 *  (c) `ELEMENT_TABLE.ropegate.needs` dropped ⇒ the pre-sword row reds (the seam
 *      no longer refuses by name; the solve refuses instead).
 */

import { describe, expect, it } from 'vitest';

import { generateSeedlingLevel, placementGroupId } from './procgenSeedling.js';
import { seedlingOnConnectorEntities } from './procgenSeedlingElements.js';
import { PRE_SWORD_ITEMS, POST_SWORD_ITEMS, POST_SWORD_PALETTE, PRE_SWORD_PALETTE } from './procgenPalette.js';
import { gradeOf, requirementsFor } from './procgenRequirements.js';
import {
    DEFAULT_BUDGET, arrowHitsOf, bootStaging, collectGoal, solve,
} from './procgenOracle.js';
import { bootAtTile, emptyLevel, oelAtTile, withEntities } from './procgenLevel.js';
import { withArrowLaneCrossing } from './arrowLaneCrossing.js';
import { ELEMENT_NAMES, ELEMENT_TABLE, headsNeeding, parseElementSpec } from '../procgenCore/elementSpec.js';
import { ROPE_GATE, ROPE_GATE_ROPE_ID, ROPE_GATE_TRAP_ID } from '../procgenCore/elements/ropeGate.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

const WITNESS = Object.freeze({ seed: 1, kind: 'empty', width: 10, height: 10 });

const gen = (palette, { seed = WITNESS.seed } = {}) => generateSeedlingLevel({
    seed, palette,
    defaults: { width: WITNESS.width, height: WITNESS.height },
    skeleton: parseSkeleton(WITNESS.kind, { substrate: 'seedling' }),
    elements: parseElementSpec('ropegate'),
});

const TRAP = { role: 'obstacle', x: 4, y: 1, id: ROPE_GATE_TRAP_ID };
const ROPE = { role: 'obstacle', x: 2, y: 5, id: ROPE_GATE_ROPE_ID, node: { x: 2, y: 5 } };

describe('⛓⛓⛓ the ROPE GATE\'s table row and binding rows (seedling gen A1)', () => {
    it('the head is `ropegate`, last but chestdoor, sword-gated, opt-in and not a `require` head', () => {
        expect(ELEMENT_TABLE.ropegate.element).toBe(ROPE_GATE);
        expect(ELEMENT_TABLE.ropegate.needs).toEqual(['hasSword']);
        /** ⛓ seedling gen B2 appended `chestdoor` after it; nothing before it moved. */
        expect(ELEMENT_NAMES.slice(-2)).toEqual(['ropegate', 'chestdoor']);
        /** ⛔ joining `require:['hasSword']`'s `+` list would move every such room */
        expect(headsNeeding('hasSword')).not.toContain('ropegate');
    });

    it('trap → `arrowtrap {tset g, shoot 1}`, rope → `rope {tset g, tag}` + its node; ONE group, '
        + 'the trap cell\'s', () => {
        const asked = [];
        const out = seedlingOnConnectorEntities({
            placed: { entities: [TRAP, ROPE] },
            tagFor: () => 3,
            groupIdFor: (at) => { asked.push(at); return placementGroupId(at, 10); },
        });
        const g = String(placementGroupId({ tx: 4, ty: 1 }, 10));
        expect(asked).toEqual([{ tx: 4, ty: 1 }]);
        expect(out.entities).toEqual([
            { type: 'arrowtrap', tx: 4, ty: 1, attrs: { tset: g, shoot: '1' } },
            { type: 'rope', tx: 2, ty: 5, attrs: { tset: g, tag: '3' }, nodes: [{ tx: 2, ty: 5 }] },
        ]);
    });

    it('the TAG BUDGET: one tag from the 30 (the rope\'s), none for the trap', () => {
        let tags = 0;
        const out = seedlingOnConnectorEntities({
            placed: { entities: [TRAP, ROPE] },
            tagFor: () => { tags += 1; return 7; },
            groupIdFor: () => 41,
        });
        expect(tags).toBe(1);
        expect(out.tags).toEqual({ rope: 7 });
        expect(out.entities[0].attrs.tag).toBeUndefined();
    });

    it('⛔ a rope gate without `groupIdFor` refuses by name', () => {
        expect(() => seedlingOnConnectorEntities({ placed: { entities: [TRAP, ROPE] },
            tagFor: () => 1 })).toThrow(/needs `groupIdFor`/);
    });
});

describe('⛓⛓⛓ the ROPE GATE on a generated Seedling level', () => {
    it('post-sword: places, CERTIFIES with `pull` before the collect, and takes no arrow', () => {
        const out = gen(POST_SWORD_PALETTE);
        expect(out.model.elements.ran).toBe(true);
        const placed = out.model.elements.placed[0];
        expect(placed.family).toBe('ropegate');
        expect(Object.keys(placed.tags)).toEqual(['rope']);
        expect(out.certification.certified).toBe(true);
        const verbs = out.certification.strategies;
        expect(verbs).toContain('pull');
        expect(verbs.indexOf('pull')).toBeLessThan(verbs.indexOf('collect'));
        /** the record: one trap, one rope, the same group, the rope's node in OEL pixels */
        const trap = out.record.entities.filter((e) => e.type === 'arrowtrap');
        const rope = out.record.entities.filter((e) => e.type === 'rope');
        expect(trap).toHaveLength(1);
        expect(rope).toHaveLength(1);
        expect(trap[0].attrs).toEqual({ tset: rope[0].attrs.tset, shoot: '1' });
        expect(rope[0].nodes).toEqual([{ x: rope[0].x, y: rope[0].y }]);
        expect(trap[0]).toMatchObject(oelAtTile(placed.doorCell.x, placed.doorCell.y));
        /** distinct persistence tags, inside the 30 */
        const tags = out.record.entities.map((e) => Number(e.attrs?.tag)).filter((t) => t >= 0);
        expect(new Set(tags).size).toBe(tags.length);
        expect(Math.max(...tags)).toBeLessThan(30);
    }, 120000);

    it('the differential: `hasSword` is REQUIRED — STRONG (pre-sword the solver REFUSES)', () => {
        const out = gen(POST_SWORD_PALETTE);
        const rep = requirementsFor({
            record: out.record, model: out.model, palette: POST_SWORD_PALETTE,
            summary: out.summary, seed: WITNESS.seed, biome: 'post-sword',
        }, { verdict: 'SOLVED', ticks: out.summary.finalTicks }, { budget: DEFAULT_BUDGET });
        const row = rep.rows.find((r) => r.flag === 'hasSword');
        expect(row.verdict).toBe('REQUIRED');
        expect(row.withoutVerdict).toBe('REFUSED');
        expect(gradeOf(row)).toBe('STRONG');
    }, 120000);

    it('pre-sword: REFUSED BY NAME with no solve — the boot grants no sword', () => {
        const out = gen(PRE_SWORD_PALETTE);
        expect(out.certification.gap).toBe('the-element-needs-an-item-this-biome-does-not-grant');
        expect(out.certification.needs).toEqual(['hasSword']);
        expect(out.model.elements.ran).toBe(false);
    }, 120000);
});

/**
 * ⚖ L16 — NO TANKING. The design probe's 20x15 room: a bare armed trap at
 * (4,1) whose lane splits the room, nothing disarms it, the goal on the far
 * side. With `ARROW_LANE_CROSSING` ON the solver crosses by billing one arrow
 * (measured: `arrowtrap@64,16#3.2` at t46) — the only route there is.
 */
describe('⚖ L16 — the oracle refuses a certificate that tanks an arrow', () => {
    const room = (withRope) => {
        const base = emptyLevel({ level: 900, width: 20, height: 15 });
        const at = (type, tx, ty, attrs) => ({ type, ...oelAtTile(tx, ty), ...(attrs ? { attrs } : {}) });
        const goal = { tx: 18, ty: 13 };
        const entities = [at('torchpickup', goal.tx, goal.ty, { tag: '0' }),
            at('arrowtrap', 4, 1, { tset: '0', shoot: '1' })];
        if (withRope) {
            entities.push({ ...at('rope', 1, 12, { tset: '0', tag: '1' }), nodes: [oelAtTile(2, 12)] });
        }
        return { record: withEntities(base, entities), goals: [collectGoal(goal.tx * 16, goal.ty * 16)] };
    };
    const solveIn = (withRope, items, crossing) => {
        const { record, goals } = room(withRope);
        const staging = bootStaging({ boot: bootAtTile(record, 1, 1), items });
        return withArrowLaneCrossing(crossing, () => solve(record, staging, goals, DEFAULT_BUDGET,
            { name: 'ropegate-no-tank' }));
    };

    it('a tanked crossing as the ONLY route is REFUSED, by the no-tank rule, naming the arrow', () => {
        const out = solveIn(false, POST_SWORD_ITEMS, true);
        expect(out.verdict).toBe('REFUSED');
        expect(out.obstacle).toMatchObject({ kind: 'arrow-hit', hits: 1 });
        expect(out.obstacle.id).toMatch(/^arrowtrap@64,16#/);
        expect(out.reasonText).toMatch(/TANKING 1 arrow hit/);
    }, 120000);

    it('the control: the same room WITH its rope solves by `pull`, no arrow taken', () => {
        const out = solveIn(true, POST_SWORD_ITEMS, false);
        expect(out.verdict).toBe('SOLVED');
        expect(out.records.map((r) => r.strategy)).toContain('pull');
    }, 120000);

    it('pre-sword, crossing OFF (the grading default): the rope room REFUSES', () => {
        expect(solveIn(true, PRE_SWORD_ITEMS, false).verdict).toBe('REFUSED');
    }, 120000);

    it('`arrowHitsOf` reads the run\'s own `playerHits` rows, arrows only', () => {
        expect(arrowHitsOf(null)).toEqual([]);
        expect(arrowHitsOf({ playerHits: [{ source: 'body', t: 3, id: 'spinner@1,1' },
            { source: 'arrow', t: 9, id: 'arrowtrap@64,16#1.0' }] }))
            .toEqual([{ t: 9, id: 'arrowtrap@64,16#1.0' }]);
    });
});
