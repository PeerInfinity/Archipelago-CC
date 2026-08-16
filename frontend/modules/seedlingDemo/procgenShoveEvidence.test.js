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
 * walked into.
 * ⇒ §11.7's vacuity conclusion is SUPERSEDED. (`feedback_ledger_shape_limits_the_question`
 * one layer up: the shape of the LABEL decided which question could be asked.)
 *
 * ── ⛓⛓⛓ EVERY SUBJECT HERE WAS RE-MEASURED AT THE GENERATE-mode UI ARC's
 * ── SLICE 2, AND THE FAMILY CAME OUT STRONGER ────────────────────────
 *
 * Parameterizing the palette changed the draw sequence, so ⚖ ruling 5's
 * licensed expiry took every seed→anchor pair in this file. Re-scanned over
 * the same bound (pre-sword, seeds 1..40, target 6): `shove` is discharged in
 * the FINAL certified level of **thirteen seeds that keep no `weigh` template
 * at all** — 1, 4, 5, 6, 10, 15, 17, 23, 27, 28, 31, 32 and 38 — where slice
 * 4 measured four (10, 21, 27, 38). ⛔ REPLACED, NEVER RELAXED: not one
 * assertion below was loosened; the seeds moved because the draw did, and 27
 * and 38 SURVIVE their own re-measurement and are still the existence pair.
 *
 * ── AND THE FAR REFUSALS ARE STILL CORRECT — WITH ONE NEW CLASS ───────
 *
 * A FAR candidate re-placed ALONE at the same anchor into the bare skeleton
 * SOLVES and discharges its own `shove` in **24 of the 27 far rows the loop
 * produced**, so for those neither the template's legality nor the solver's
 * `shove` apply is at fault — the cause is INTERACTION with the obstacles
 * already placed.
 *
 * ⚠⚠ THE OTHER THREE ARE A CLASS SLICE 4's FOUR-ROW SAMPLE HAD NO EXAMPLE OF,
 * AND THEY ARE RECORDED RATHER THAN SMOOTHED: seed 26's `(ori=v,gap=1)@(7,1)`,
 * seed 36's `(ori=h,gap=6)@(1,5)` and seed 38's `(ori=h,gap=6)@(1,3)` REFUSE
 * **even alone in the empty room**. Slice 4's docblock said *"each FAR
 * candidate re-placed ALONE at the same anchor SOLVES"*, and at 27 rows that
 * is no longer true of all of them — a statement made about four rows,
 * re-asked of twenty-seven. None of the three is a subject below: the cases
 * pick rows whose ALONE arm solves, because that is the premise the ablation
 * rests on. Saying which rows were passed over, and why, is the difference
 * between a chosen subject and a filtered one.
 *
 * The ablation uses the SAME oracle rather than a second geometry: the first
 * cut of this proof hand-rolled a flood fill over the built world's tile
 * collections, got its seed backwards, and was thrown away. A retype of the
 * engine's own connectivity is exactly what this arc has refused six times.
 *
 * ⚠ THESE TESTS ARE GREEN AT THE PARENT, ON PURPOSE. Slice 4 changes no
 * behaviour here — the whole point of the diagnosis is that there was nothing
 * to fix. What they add is the EVIDENCE §11.7 showed was missing, so saying
 * "red at the parent" is not available and pretending otherwise would be the
 * empty-layer trap wearing a gate's clothes.
 */

import { describe, expect, it } from 'vitest';

import { PRE_SWORD_PALETTE, instantiateKept } from './procgenPalette.js';
import {
    SEEDLING_DEFAULTS, generateSeedlingLevel, seedlingModel, seedlingOracle,
} from './procgenSeedling.js';

/**
 * ⛓⛓ SLICE 2: EVERY TEMPLATE HERE IS AN INSTANCE, and it is rebuilt through
 * the arc's ONE reconstruction. A `{template, params}` row is what a kept list
 * and a trace row carry; the base it names has no geometry to ablate.
 */
const instanceFor = (row) => instantiateKept(PRE_SWORD_PALETTE, row);

/**
 * The door's own geometry, DERIVED from the instance rather than typed: which
 * axis the wall runs on, which offset its single gap sits at, and the block
 * standing in it.
 *
 * ⛓ `horizontal` READS `params.ori`. It used to read `name.endsWith('-h')` —
 * which after the collapse is FALSE for every row, so the whole file would
 * have gone on measuring the vertical axis of horizontal doors. A name-shaped
 * predicate outlives the name it was about.
 */
function doorOf(template) {
    const horizontal = template.params.ori === 'h';
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
    for (const k of keptRows) record = model.place(record, instanceFor(k), k.at);
    return { model, record };
}

const shoveRecords = (out) => (out.records ?? []).filter((r) => r.strategy === 'shove');

/**
 * ⛔ THE THREE FAR GEOMETRIES, and they are the generator's OWN — seed, anchor,
 * PARAMETERS and goal all come from the loop's own trace, so these are not
 * probe rooms of this slice's making.
 *
 * ⛓ RE-MEASURED AT THE GENERATE-mode UI ARC's SLICE 2. The three are picked
 * from the 27 far rows over seeds 1..40 under two stated conditions: the ALONE
 * arm SOLVES and discharges (the premise the second case asserts), and the
 * three between them cover BOTH orientations and both loop outcomes — seed 2 is
 * a REVERTED vertical door, seed 10 a KEPT horizontal one, seed 15 a REVERTED
 * horizontal one. ⛓ `params` is part of the subject now: the same base template
 * at the same anchor with a different `gap` is a different door.
 */
const FAR_CASES = Object.freeze([
    Object.freeze({ seed: 2, params: { ori: 'v', gap: 3 }, at: { tx: 2, ty: 1 } }),
    Object.freeze({ seed: 10, params: { ori: 'h', gap: 2 }, at: { tx: 1, ty: 5 } }),
    Object.freeze({ seed: 15, params: { ori: 'h', gap: 4 }, at: { tx: 1, ty: 2 } }),
]);

/** The concrete row a FAR case names — the ONE reconstruction, again. */
const doorFor = (c) => instanceFor({ template: 'wall-gap-block', params: c.params });

describe('⛓ THE TEMPLATE IS THE DOOR — the geometric half of non-vacuity', () => {
    for (const c of FAR_CASES) {
        it(`seed ${c.seed}: wall-gap-block(ori=${c.params.ori},gap=${c.params.gap})`
            + `@(${c.at.tx},${c.at.ty}) spans the interior, and the goal is STRICTLY `
            + 'BEYOND it', () => {
            const model = seedlingModel({ seed: c.seed });
            const template = doorFor(c);
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
            const template = doorFor(c);
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
     *   seed 2  — `noBlock` STILL REFUSES ⇒ the block was never the thing in
     *             the way; the candidate's WALL seals the room. A correct
     *             revert of a candidate that makes the room unsolvable.
     *   seed 15 — `noBlock` SOLVES ⇒ the block IS the door, and no resting
     *             cell leaves a corridor. A correct refusal of the VERB.
     */
    /**
     * ⛓ RE-MEASURED AT SLICE 2, and the two CLASSES survive the migration
     * unchanged — only the seeds moved. Both subjects are rows the loop itself
     * REVERTED, both SOLVE alone at the same anchor, and both have
     * `noWall === SOLVED` (the block alone is walked around), which is the
     * third arm's premise. ⚠ Some far rows in the same scan have
     * `noWall === REFUSED` — a class this pair deliberately does not cover,
     * named rather than filtered out.
     *
     * ⛓⛓ RE-MEASURED AGAIN AT PROCGEN ELEMENTS ARC 3 SLICE 1 (trap 285 — the
     * target and the counts are named). `arrow-lane` left the roster (⚖ design
     * ruling 9), which moved every draw and therefore every trace. SCANNED:
     * pre-sword `obstacleTarget: 6`, seeds 1..40, every REVERTED
     * `wall-gap-block` row whose goal is STRICTLY BEYOND its wall — **seven
     * such rows survive**, of which **three** meet the pair's premise
     * (`full != SOLVED` AND `noWall == SOLVED`) in the WALL class (seeds 9, 32,
     * 38) and **exactly one** in the BLOCK class (seed 27). ⛔ THE PAIR IS
     * THEREFORE 9 AND 27, and the BLOCK half is the only subject there is —
     * said out loud, because a class with one member is one bad draw from being
     * a class with none.
     *
     * ⚠ AND THE UNCOVERED CLASS IS STILL THERE, re-named: seed 28's row
     * (`ori=v,gap=0`@(3,1)) has `noWall === REFUSED`, and seed 31's two rows
     * have both ablations REFUSED.
     *
     * ⛓⛓⛓ **RE-MEASURED AGAIN AT ARC 3 SLICE 2 (the DOOR LAW), AND THE BLOCK
     * HALF MOVED — 27 → 21.** The law refuses every `wall-gap-block` anchor
     * whose wall is not a CUT, which changes which candidates the loop ever
     * tries and therefore which of them REVERT. Re-run of THIS FILE's own
     * documented scan (pre-sword `obstacleTarget: 6`, seeds 1..40, every
     * REVERTED `wall-gap-block` row whose goal is STRICTLY BEYOND its wall):
     * **12 such rows now survive, up from 7** — of which **six** meet the pair's
     * premise in the WALL class (seeds 9, 14, 31 twice, 32, 38) and **three** in
     * the BLOCK class (seeds 10, 14, 21).
     *
     * ⛓ **SEED 9 DID NOT HAVE TO MOVE** — same params, same anchor, same
     * ablation answer — so only the block half is re-picked, to **seed 21**
     * (`ori=v,gap=7`@(3,1)). ⛓ AND THE SCARCITY THE OLD DOCBLOCK WARNED ABOUT IS
     * GONE: *"a class with one member is one bad draw from being a class with
     * none"* was true at 1 member and is not at 3. ⚠ Worth naming for whoever
     * re-picks next: **seed 14 carries BOTH classes at ONE anchor** — (1,7),
     * `gap=0` is the block class and `gap=1` the wall class — which isolates the
     * ablation's answer to the gap alone and is the better pair the day this
     * needs re-measuring again.
     */
    const cases = [
        { seed: 9, params: { ori: 'v', gap: 3 }, at: { tx: 6, ty: 1 }, noBlockSolves: false },
        { seed: 21, params: { ori: 'v', gap: 7 }, at: { tx: 3, ty: 1 }, noBlockSolves: true },
    ];
    for (const c of cases) {
        it(`seed ${c.seed}: the candidate refuses in its own room, and the ablation says `
            + `${c.noBlockSolves ? 'the BLOCK' : 'the WALL'} is why`, () => {
            const gen = generateSeedlingLevel({
                seed: c.seed, palette: PRE_SWORD_PALETTE, bounds: { obstacleTarget: 6 },
            });
            const { model, record } = roomBefore(c.seed, gen.summary.kept);
            const template = doorFor(c);
            const oracle = seedlingOracle({ model, items: PRE_SWORD_PALETTE.items });
            const kept = gen.summary.kept.map((k) => instanceFor(k));
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
    /**
     * ⛓ RE-PICKED at arc 3 slice 1 (trap 285). SCANNED: seeds 1..40 at
     * `obstacleTarget: 6` for a level that keeps `shove`, keeps NO `weigh`,
     * SOLVES, certifies AND produces at least one `shove` record — **ten
     * qualify** (5, 9, 10, 15, 17, 22, 28, 31, 32, 38). Seed 38 is KEPT from
     * the original pair; seed 27 moved out because its final level now solves
     * with ZERO shove records (it is the ABLATION subject above instead), and
     * seed 5 takes its place.
     */
    for (const seed of [5, 38]) {
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
                templates: gen.summary.kept.map((k) => instanceFor(k)),
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
                const door = doorOf(instanceFor(k));
                return `${k.at.tx + (door.horizontal ? door.gaps[0] : door.block.dx)},`
                    + `${k.at.ty + (door.horizontal ? door.block.dy : door.gaps[0])}`;
            });
            expect(gapCells).toContain(`${shoves[0].from.tx},${shoves[0].from.ty}`);
        });
    }
});
