/**
 * seedlingDemo/procgenShoveEvidence — **THE `shove` FAMILY'S PROMOTION
 * EVIDENCE, RE-CUT TO THE NON-VACUITY STANDARD.**
 *
 * Seedling PROCGEN PoC arc, slice 4 (kickoff §4.4 scope 1; the finding it
 * answers is §11.9's first bullet).
 *
 * ── THE LINEAGE, IN ONE LINE ──────────────────────────────────────────
 *
 * Slice 3 promoted `wall-gap-block` on three dedicated probe geometries;
 * slice 3b re-cut slice 3's EVIDENCE STANDARD (§11.7: a KEPT row in a
 * generated room looks identical whether or not the obstacle was ever in the
 * way); this slice re-cuts slice 3b's INSTRUMENT.
 *
 * ── ⛔⛔⛔ WHAT WAS WRONG WITH THE INSTRUMENT ─────────────────────────
 *
 * §11.7 split kept/reverted rows by whether the goal lies beyond the
 * TEMPLATE'S OWN WALL from the start, and read `shove` 0 KEPT / 4 REVERTED on
 * the FAR side as *"`wall-gap-block` is KEPT in a generated room exactly when
 * it is IRRELEVANT"*. That label is computed from the template IN ISOLATION.
 * In a room that already holds five other obstacles it does not mean "the
 * door is on the route" — the route detours, and a NEAR door can be squarely
 * on it. So the label is a PROXY for relevance and it is the wrong one.
 *
 * **The non-vacuous instrument is the FINAL level's own solve**: a
 * `{strategy: 'shove'}` record naming the template's own block is the
 * obstacle being DISCHARGED, and it cannot be produced by an obstacle nobody
 * walked into. Asked that way over seeds 1..40, `shove` is discharged in
 * seeds 10, 21, 27 and 38 — and 27 and 38 keep no `weigh` template at all, so
 * the block is unambiguously `wall-gap-block`'s own.
 * ⇒ §11.7's vacuity conclusion is SUPERSEDED. (`feedback_ledger_shape_limits_the_question`
 * one layer up: the shape of the LABEL decided which question could be asked.)
 *
 * ── AND THE FOUR FAR REFUSALS WERE CORRECT ────────────────────────────
 *
 * Each FAR candidate re-placed ALONE at the same anchor into the bare
 * skeleton SOLVES (216/216/207/211 ticks), so neither the template's legality
 * nor the solver's `shove` apply is at fault — the cause is INTERACTION with
 * the obstacles already placed. The ablation below is what attributes it, and
 * it uses the SAME oracle rather than a second geometry: the first cut of
 * this proof hand-rolled a flood fill over the built world's tile
 * collections, got seed 15 backwards, and was thrown away. A retype of the
 * engine's own connectivity is exactly what this arc has refused six times.
 *
 * ⚠ THESE TESTS ARE GREEN AT THE PARENT, ON PURPOSE. Slice 4 changes no
 * behaviour here — the whole point of the diagnosis is that there was nothing
 * to fix. What they add is the EVIDENCE §11.7 showed was missing, so saying
 * "red at the parent" is not available and pretending otherwise would be the
 * empty-layer trap wearing a gate's clothes.
 */

import { describe, expect, it } from 'vitest';

import { PRE_SWORD_PALETTE } from './procgenPalette.js';
import {
    SEEDLING_DEFAULTS, generateSeedlingLevel, seedlingModel, seedlingOracle,
} from './procgenSeedling.js';

const templateNamed = (name) => {
    const t = PRE_SWORD_PALETTE.templates.find((x) => x.name === name);
    if (!t) throw new Error(`procgenShoveEvidence: no template "${name}" in the palette`);
    return t;
};

/**
 * The door's own geometry, DERIVED from the template rather than typed: which
 * axis the wall runs on, which offset its single gap sits at, and the block
 * standing in it.
 */
function doorOf(template) {
    const horizontal = template.name.endsWith('-h');
    const block = template.entities.find((e) => e.type === 'pushableblock');
    const along = (c) => (horizontal ? c.dx : c.dy);
    const painted = new Set(template.terrain.map(along));
    const gaps = template.footprint.map(along).filter((o) => !painted.has(o));
    return { horizontal, block, painted, gaps, span: template.footprint.length };
}

/**
 * ⛓ THE ABLATION, BUILT FROM THE TEMPLATE ITSELF — the template minus its
 * entities is the wall alone, minus its terrain is the block alone. Deriving
 * the two halves this way means the ablation cannot drift from the thing it
 * ablates.
 */
const wallOnly = (t) => ({ ...t, entities: [] });
const blockOnly = (t) => ({ ...t, terrain: [] });

/** The room the loop had at the moment it tried `at`, replayed from its own kept list. */
function roomBefore(seed, keptRows) {
    const model = seedlingModel({ seed });
    let record = model.skeleton();
    for (const k of keptRows) record = model.place(record, templateNamed(k.template), k.at);
    return { model, record };
}

const shoveRecords = (out) => (out.records ?? []).filter((r) => r.strategy === 'shove');

/**
 * ⛔ THE THREE FAR GEOMETRIES, and they are the generator's OWN — seed, anchor
 * and goal all come from `seedlingModel`, so these are not probe rooms of this
 * slice's making. §11.7 measured four rows; seed 9 supplies two of them at the
 * same anchor (the anchor scan is shuffle-then-first, so a re-try of one
 * template in an unchanged room draws the same cell), which makes three
 * distinct geometries.
 */
const FAR_CASES = Object.freeze([
    Object.freeze({ seed: 9, template: 'wall-gap-block-h', at: { tx: 1, ty: 3 } }),
    Object.freeze({ seed: 13, template: 'wall-gap-block-v', at: { tx: 4, ty: 1 } }),
    Object.freeze({ seed: 15, template: 'wall-gap-block-v', at: { tx: 4, ty: 1 } }),
]);

describe('⛓ THE TEMPLATE IS THE DOOR — the geometric half of non-vacuity', () => {
    for (const c of FAR_CASES) {
        it(`seed ${c.seed}: ${c.template}@(${c.at.tx},${c.at.ty}) spans the interior, `
            + 'and the goal is STRICTLY BEYOND it', () => {
            const model = seedlingModel({ seed: c.seed });
            const template = templateNamed(c.template);
            const door = doorOf(template);
            const record = model.skeleton();

            // The wall crosses the WHOLE interior: a shorter one is walked
            // around and the block obstructs nothing (traps 171/173).
            const interior = (door.horizontal ? record.width : record.height) - 2;
            expect(door.span).toBe(interior);
            // Exactly ONE gap, and the block is standing in it.
            expect(door.gaps).toHaveLength(1);
            expect(door.horizontal ? door.block.dx : door.block.dy).toBe(door.gaps[0]);

            // ⛔ STRICTLY BEYOND: the start and the goal are on OPPOSITE sides
            // of the wall's own line, and neither is ON it.
            const line = door.horizontal ? c.at.ty : c.at.tx;
            const coord = (cell) => (door.horizontal ? cell.ty : cell.tx);
            const startSide = Math.sign(coord(SEEDLING_DEFAULTS.start) - line);
            const goalSide = Math.sign(coord(model.goalCell) - line);
            expect(startSide).not.toBe(0);
            expect(goalSide).not.toBe(0);
            expect(goalSide).not.toBe(startSide);
        });

        it(`seed ${c.seed}: and the shove is DISCHARGED there — a record, not a keep`, () => {
            const model = seedlingModel({ seed: c.seed });
            const template = templateNamed(c.template);
            const oracle = seedlingOracle({ model, items: PRE_SWORD_PALETTE.items });
            const out = oracle.solve(model.place(model.skeleton(), template, c.at),
                { templates: [template] });

            expect(out.verdict).toBe('SOLVED');
            expect(out.certification.certified).toBe(true);
            const shoves = shoveRecords(out);
            expect(shoves).toHaveLength(1);
            // The block that moved is the TEMPLATE's own, at the gap cell.
            const door = doorOf(template);
            const gapCell = {
                tx: c.at.tx + (door.horizontal ? door.gaps[0] : door.block.dx),
                ty: c.at.ty + (door.horizontal ? door.block.dy : door.gaps[0]),
            };
            expect(shoves[0].from).toEqual(gapCell);
            expect(shoves[0].id).toBe(`pushableblock@${gapCell.tx * 16},${gapCell.ty * 16}`);
        });
    }
});

describe('⛔ THE FAR REVERTS WERE CORRECT — attributed by ABLATION, not by a flood fill', () => {
    /**
     * ⛓ TWO DISTINCT CLASSES, and the ablation is what separates them:
     *
     *   seed 9  — `noBlock` STILL REFUSES ⇒ the block was never the thing in
     *             the way; the candidate's WALL seals the room (the kept pit
     *             patch sits directly under the wall's only gap). A correct
     *             revert of a candidate that makes the room unsolvable.
     *   seed 15 — `noBlock` SOLVES ⇒ the block IS the door, and no resting
     *             cell leaves a corridor: k=1 walls the player into the gap
     *             and k=2 is a kept `wall-segment-v3`, which is Solid to the
     *             block, so the scan breaks. A correct refusal of the VERB.
     */
    const cases = [
        { seed: 9, template: 'wall-gap-block-h', at: { tx: 1, ty: 3 }, noBlockSolves: false },
        { seed: 15, template: 'wall-gap-block-v', at: { tx: 4, ty: 1 }, noBlockSolves: true },
    ];
    for (const c of cases) {
        it(`seed ${c.seed}: the candidate refuses in its own room, and the ablation says `
            + `${c.noBlockSolves ? 'the BLOCK' : 'the WALL'} is why`, () => {
            const gen = generateSeedlingLevel({
                seed: c.seed, palette: PRE_SWORD_PALETTE, bounds: { obstacleTarget: 6 },
            });
            const { model, record } = roomBefore(c.seed, gen.summary.kept);
            const template = templateNamed(c.template);
            const oracle = seedlingOracle({ model, items: PRE_SWORD_PALETTE.items });
            const kept = gen.summary.kept.map((k) => templateNamed(k.template));
            const solve = (rec) => oracle.solve(rec, { templates: [...kept, template] }).verdict;

            const full = solve(model.place(record, template, c.at));
            const noBlock = solve(model.place(record, wallOnly(template), c.at));
            const noWall = solve(model.place(record, blockOnly(template), c.at));

            // The candidate as the loop built it: refused, which is the row
            // §11.7 counted.
            expect(full).not.toBe('SOLVED');
            // ⛔ THE LOAD-BEARING HALF. With the block gone the shove is
            // unnecessary by construction, so this answers "was the block ever
            // the thing in the way" WITHOUT asking the verb anything.
            expect(noBlock === 'SOLVED').toBe(c.noBlockSolves);
            // And the wall really is what makes it a door: the block alone,
            // in an open room, is walked around.
            expect(noWall).toBe('SOLVED');
        });
    }
});

describe('⛔⛔ THE GENERATED-ROOM EXISTENCE CLAIM — §11.7\'s missing half', () => {
    /**
     * ⛓ SEEDS 27 AND 38 keep NO `weigh` template, and `weigh` shares
     * `runShove`'s implementation — so a `shove` record in a room that holds
     * one of each could in principle be argued about. In these two it cannot:
     * the only pushable in the room is `wall-gap-block`'s own.
     */
    for (const seed of [27, 38]) {
        it(`seed ${seed}: the FINAL certified level's own solve DISCHARGES \`shove\``, () => {
            const gen = generateSeedlingLevel({
                seed, palette: PRE_SWORD_PALETTE, bounds: { obstacleTarget: 6 },
            });
            const families = new Set(gen.summary.kept.map((k) => k.family));
            expect(families.has('shove')).toBe(true);
            expect(families.has('weigh')).toBe(false);

            const model = seedlingModel({ seed });
            const oracle = seedlingOracle({ model, items: PRE_SWORD_PALETTE.items });
            const out = oracle.solve(gen.record, {
                templates: gen.summary.kept.map((k) => templateNamed(k.template)),
            });
            expect(out.verdict).toBe('SOLVED');
            expect(out.certification.certified).toBe(true);

            const shoves = shoveRecords(out);
            expect(shoves.length).toBeGreaterThan(0);
            // ⛔ NOT A KEEP-COUNT: the record names the block, the direction it
            // went and the cells it went between. An obstacle nobody walked
            // into cannot produce one.
            expect(shoves[0].from).not.toEqual(shoves[0].to);
            expect(shoves[0].dir).toMatch(/^[NESW]$/);
            // And the block it moved is the one a kept `shove` template placed.
            const doors = gen.summary.kept.filter((k) => k.family === 'shove');
            const gapCells = doors.map((k) => {
                const door = doorOf(templateNamed(k.template));
                return `${k.at.tx + (door.horizontal ? door.gaps[0] : door.block.dx)},`
                    + `${k.at.ty + (door.horizontal ? door.block.dy : door.gaps[0])}`;
            });
            expect(gapCells).toContain(`${shoves[0].from.tx},${shoves[0].from.ty}`);
        });
    }
});
