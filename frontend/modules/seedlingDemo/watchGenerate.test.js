/**
 * seedlingDemo/watchGenerate.test — the GENERATE arm's pure half, driven.
 *
 * Seedling PROCGEN PoC arc, slice 5 (kickoff §3.5, ⚖ ruling §1.3). The arm's
 * whole content is a claim about the LOOP that has to be measured rather than
 * argued:
 *
 *  1. **THE PREFIX PROPERTY** — a run to target k is a run to target k+1
 *     truncated. This is what makes STEP possible without a second loop and
 *     without a resumable generator core, and it is exactly the kind of
 *     argument that stays true until somebody adds a bound that reads the
 *     target. So it is asserted over both biomes, on real generations.
 *  2. **ONE MODEL** — step 0's `seedlingModel({seed})` and the loop's own are
 *     the same room with the same goal cell. A page that showed a skeleton
 *     with a different goal than the level it grows into would be showing two
 *     rooms and calling them one.
 *  3. **THE DISPLAY SOLVE AGREES WITH THE TRACE** — same record, same
 *     staging, same goals, same budget. The comparison exists because the
 *     answer should always be yes.
 *  4. **THE BOUNDS ARE NAMED** — the refusals, the cost model, the biome map.
 *
 * ⚠ TARGETS ARE SMALL ON PURPOSE. The ladder is O(N²) solves BY DESIGN (the
 * arm's own docblock states the price), so a test that generated to six would
 * be paying twenty-eight solves to assert a prefix that two steps already
 * prove. The batch script is where full-size levels are generated.
 */

import { describe, expect, it } from 'vitest';

import {
    BIOME_NAMES, DEFAULT_SKELETON, DIRECTED_ANCHOR_TRIES, GENERATE_BIOMES, agreementWithPayload,
    agreementWithTrace, applyDirective, describeKeptKind, describeState, directedCost,
    displaySolve, displayStaging, formatDirectives, generateStep, generateWithDirectives,
    generationRows, keptTemplatesOf, ladderCost, paletteFor, parseDirective, parseDirectives,
    readGenerateParams, skeletonCatalogue, stepFromParams, tileAtPoint, writeGenerateParams,
} from './watchGenerate.js';
import { atlasOf, terrainAt } from './procgenLevel.js';
// ⛓ CONSTRUCTIVE SLICE 11 — the ONE edit fold, driven from this file too.
import { editStates } from './watchEdit.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { solveForPage } from './watchSolve.js';
import { ATTEMPT, DEFAULT_BOUNDS, KEEP_POLICY, KEPT_KIND, STOP } from '../procgenCore/levelGenerator.js';
import { PRE_SWORD_PALETTE, POST_SWORD_PALETTE } from './procgenPalette.js';
/** ⛓ SLICE 5a (D1) — the ANCHOR for the `?elements=` VALUE claim is the SEAM's
 *  own answer for the same arguments, never a literal cell this file invents. */
import { seedlingSeam } from './procgenSeedling.js';
import { generateSeedlingLevel, interiorCells, seedlingModel } from './procgenSeedling.js';
import { defineTemplate } from '../procgenCore/templateContract.js';
/** ⛓ SLICE 4c: the ONE policy a Seedling directive runs under, now a constant. */
import { DIRECTIVE_KEEP_POLICY } from '../procgenCore/urlParams.js';

const json = (v) => JSON.stringify(v);

describe('the biome map — ONE map, two readers', () => {
    it('holds exactly the two biomes the arc ships, by identity', () => {
        expect(BIOME_NAMES).toEqual(['pre-sword', 'post-sword']);
        expect(paletteFor('pre-sword')).toBe(PRE_SWORD_PALETTE);
        expect(paletteFor('post-sword')).toBe(POST_SWORD_PALETTE);
    });

    /**
     * ⛔ THE REFUSAL IS THE POINT. A biome that fell through to the other one
     * would boot the room under the wrong inventory, and every certification
     * of that level would be about a run nobody asked for.
     */
    it('refuses an unknown biome BY NAME rather than falling through', () => {
        expect(() => paletteFor('post-shield')).toThrow(/not one of \[pre-sword, post-sword\]/);
        expect(() => paletteFor(undefined)).toThrow(/watchGenerate: biome/);
    });

    it('and the CLI reads THIS map — the two biome names are the CLI\'s own', () => {
        expect(Object.keys(GENERATE_BIOMES)).toEqual(BIOME_NAMES);
    });
});

describe('the URL parameters — every bound named, nothing guessed', () => {
    it('defaults to the loop\'s own bounds and the oracle\'s own budget', () => {
        const p = readGenerateParams('?source=generate');
        expect(p.isGenerate).toBe(true);
        expect(p.seed).toBe(1);
        expect(p.biome).toBe('pre-sword');
        expect(p.bounds).toEqual({ ...DEFAULT_BOUNDS });
        expect(p.budget.maxTicksPerTarget).toBe(400);
    });

    it('reads every bound, and ?gen= selects the arm on its own', () => {
        const p = readGenerateParams('?gen=/x.json&seed=13&biome=post-sword&count=3&tries=4&k=2');
        expect(p.isGenerate).toBe(true);
        expect(p.gen).toBe('/x.json');
        expect(p.seed).toBe(13);
        expect(p.biome).toBe('post-sword');
        expect(p.bounds).toEqual({
            obstacleTarget: 3, triesPerStep: 4, saturationK: 2, anchorTriesPerCandidate: 1,
        });
        // ⛓ SLICE 3: and the anchor bound reads back too, when the URL names it
        expect(readGenerateParams('?source=generate&anchortries=5').bounds
            .anchorTriesPerCandidate).toBe(5);
        expect(() => readGenerateParams('?source=generate&anchortries=1.5'))
            .toThrow(/\?anchortries="1.5" is not an integer/);
    });

    /**
     * ⚠ `?seed=` ALONE DOES NOT SELECT THIS ARM. An arm that spends seconds
     * of synchronous solve per press must be asked for by name — MANUAL's own
     * rule, for the same reason.
     */
    it('does NOT infer the arm from ?seed= alone', () => {
        expect(readGenerateParams('?seed=9').isGenerate).toBe(false);
        expect(readGenerateParams('?tape=x.json').isGenerate).toBe(false);
    });

    it('refuses a non-integer bound rather than rounding it', () => {
        expect(() => readGenerateParams('?source=generate&count=2.5'))
            .toThrow(/\?count="2.5" is not an integer/);
    });
});

/**
 * ── ⛓⛓⛓ THE URL ROUND TRIP (GENERATE-mode UI arc, slice 1) ────────────
 *
 * The defect these drive: the generate form edited LOCAL VARIABLES and
 * nothing else, so seed 3 → 9 + RUN-ALL left `?seed=3` in the address bar —
 * the link named a level the page was not showing, on a page whose only
 * persistence IS the URL.
 *
 * ⛓ THE CLAIM WORTH ASSERTING IS NOT "IT WRITES THE PARAMS" — it is that the
 * WRITER AND THE READER ARE INVERSES, and that what comes back out generates
 * the same level byte for byte. Two spellings of one setting agree until one
 * of them moves; only a round trip catches the move.
 */
describe('writeGenerateParams — the write back, and the reader is its inverse', () => {
    /**
     * ⚠ NOT ONE OF THESE IS ITS DEFAULT (trap 235). `DEFAULT_BOUNDS` is
     * target 6 / tries 8 / k 3 / anchorTries 1, so a writeback this test
     * DROPPED would read back as a DIFFERENT number rather than coinciding
     * with the right one — which is the only way the round trip can fail.
     */
    const bounds = {
        obstacleTarget: 3, triesPerStep: 5, saturationK: 2, anchorTriesPerCandidate: 4,
    };

    it('writes every control the form holds, and the reader reads them back', () => {
        const search = writeGenerateParams('?source=generate', {
            seed: 9, biome: 'post-sword', bounds, step: 3,
        });
        const p = readGenerateParams(`?${search}`);
        expect(p.isGenerate).toBe(true);
        expect(p.seed).toBe(9);
        expect(p.biome).toBe('post-sword');
        expect(p.bounds).toEqual(bounds);
        expect(p.run).toBe(true);
    });

    /**
     * ⛓ `count` IS the target of the call that made the record: at step k it
     * is k, so a copied link re-issues the SAME `generateSeedlingLevel` call.
     * The form's unfinished target does not survive, and that is the design —
     * after the reload the page's state IS step k.
     */
    it('names the STEP SHOWN as ?count=, not the target the form was aiming at', () => {
        const search = writeGenerateParams('?source=generate&count=9', {
            seed: 1, biome: 'pre-sword', bounds: { ...bounds, obstacleTarget: 1 }, step: 1,
        });
        expect(readGenerateParams(`?${search}`).bounds.obstacleTarget).toBe(1);
    });

    /**
     * ⚠ DELETED, not spelt `run=0`. Step 0 is the SKELETON, which is what a
     * load with no `?run=` already shows — a second way to say the same
     * absence is a second spelling.
     */
    it('deletes ?run= at the skeleton and sets it for a run', () => {
        const skeleton = writeGenerateParams('?source=generate&run=1', {
            seed: 1, biome: 'pre-sword', bounds, step: 0,
        });
        expect(skeleton).not.toMatch(/run=/);
        expect(readGenerateParams(`?${skeleton}`).run).toBe(false);
        expect(readGenerateParams(`?${writeGenerateParams('?source=generate', {
            seed: 1, biome: 'pre-sword', bounds, step: 1,
        })}`).run).toBe(true);
    });

    /**
     * ⛔ THE PARAMETERS THIS DOES NOT OWN ARE COPIED, NOT REBUILT.
     * `?tickbudget=` is the one that bites: it has NO control on the form, so
     * a rewrite that dropped it would silently move the budget the level on
     * screen was certified under.
     */
    it('preserves every parameter it does not own — ?tickbudget= above all', () => {
        const search = writeGenerateParams(
            '?source=generate&tickbudget=1200&layers=path&side=js&tape=x.json&goals=place:3',
            { seed: 2, biome: 'pre-sword', bounds, step: 2 },
        );
        const q = new URLSearchParams(search);
        expect(q.get('tickbudget')).toBe('1200');
        expect(q.get('layers')).toBe('path');
        expect(q.get('side')).toBe('js');
        expect(q.get('tape')).toBe('x.json');
        expect(q.get('goals')).toBe('place:3');
        expect(readGenerateParams(`?${search}`).budget.maxTicksPerTarget).toBe(1200);
    });

    /**
     * ⛔ `?gen=` IS AN IDENTITY. While the payload owns the page nothing else
     * is written beside it — two spellings of one run in one address bar is
     * the whole defect — and it is left exactly as it was found.
     */
    it('writes NOTHING while the payload owns the URL', () => {
        const before = '?gen=/x.json&layers=path';
        expect(writeGenerateParams(before, {
            seed: 99, biome: 'post-sword', bounds, step: 4, payloadOwned: true,
        })).toBe(new URLSearchParams(before).toString());
    });

    /**
     * ⚠ AND `source=generate` GOES IN WITH THE DROP. `?gen=` was also what
     * SELECTED this arm, so dropping it silently would hand back a link that
     * opens a different arm.
     */
    it('drops ?gen= once the page owns the run, and says ?source= so the link still lands here',
        () => {
            const search = writeGenerateParams('?gen=/x.json', {
                seed: 7, biome: 'pre-sword', bounds, step: 2,
            });
            expect(search).not.toMatch(/gen=/);
            const p = readGenerateParams(`?${search}`);
            expect(p.gen).toBe(null);
            expect(p.isGenerate).toBe(true);
            expect(p.seed).toBe(7);
        });

    it('refuses to write a value the reader would refuse to read back', () => {
        expect(() => writeGenerateParams('', {
            seed: 1.5, biome: 'pre-sword', bounds, step: 1,
        })).toThrow(/cannot write \?seed=1.5/);
        expect(() => writeGenerateParams('', {
            seed: 1, biome: 'pre-sword', bounds: { ...bounds, triesPerStep: NaN }, step: 1,
        })).toThrow(/cannot write \?tries=/);
    });

    /**
     * ⛓⛓ THE ROUND TRIP THAT MATTERS: the URL a step writes, read back and
     * REGENERATED, is that step's own level byte for byte. Everything above
     * is about strings; this is about the level the link actually opens.
     */
    it('⛓ a step\'s own URL regenerates that step\'s level, byte for byte', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 2 });
        const search = writeGenerateParams('?source=generate&seed=3&count=99', {
            seed: s.seed, biome: s.biome, bounds: s.bounds, step: s.step,
        });
        const p = readGenerateParams(`?${search}`);
        const again = generateStep({
            seed: p.seed, biome: p.biome, step: p.bounds.obstacleTarget, bounds: p.bounds,
        });
        expect(json(again.record)).toBe(json(s.record));
        expect(json(again.trace)).toBe(json(s.trace));
    });
});

describe('the ladder cost — stated BEFORE it is spent', () => {
    it('is the sum over the rungs plus one display solve each', () => {
        const cost = ladderCost({ obstacleTarget: 3, triesPerStep: 8 }, 100);
        // (1+8) + (1+16) + (1+24) = 51 loop solves; 4 display solves.
        expect(cost.loopSolves).toBe(51);
        expect(cost.displaySolves).toBe(4);
        expect(cost.worstCaseTotalMs).toBe(5500);
        expect(cost.why).toMatch(/RUN-ALL to 3/);
    });

    /**
     * ⛓ SLICE 3: THE ANCHOR SEARCH MULTIPLIES THE CEILING, and the whole point
     * of printing it before the press is that a caller who raises the bound
     * sees the price first. ⛔ The `1 +` per rung is the DISPLAY-free skeleton
     * solve and does NOT multiply — a factor applied to the wrong term would
     * still grow and would still look right.
     */
    it('multiplies by anchorTriesPerCandidate — and only the CANDIDATE solves', () => {
        const one = ladderCost({ obstacleTarget: 3, triesPerStep: 8 }, 100);
        const four = ladderCost(
            { obstacleTarget: 3, triesPerStep: 8, anchorTriesPerCandidate: 4 }, 100,
        );
        // (1+8x4) + (1+16x4) + (1+24x4) = 195
        expect(four.loopSolves).toBe(195);
        expect(four.loopSolves - 3).toBe((one.loopSolves - 3) * 4);
        expect(four.displaySolves).toBe(one.displaySolves);
        expect(four.why).toMatch(/anchorTriesPerCandidate\(4\)/);
    });

    it('names the ladder as the reason it is more than one run', () => {
        expect(ladderCost(DEFAULT_BOUNDS, 139).loopSolves)
            .toBeGreaterThan(1 + DEFAULT_BOUNDS.obstacleTarget * DEFAULT_BOUNDS.triesPerStep);
    });
});

describe('step 0 — the SKELETON, and it is the LOOP\'s own room', () => {
    /**
     * ⛓⛓⛓ **"AND NOTHING ELSE" STOPPED BEING TRUE AT ARC-3 SLICE 4c**, and the
     * row is re-stated rather than relaxed. Step 0 is `seedlingSeam(…).model` —
     * the room the LOOP checks — and the biome's DEFAULT ELEMENT SPEC puts an
     * element in that room (`procgenSeedling.defaultElementsFor`). ⛔ It is
     * still *the bordered room BEFORE ANY TEMPLATE*, which is what the row is
     * for: no trace, no summary, and nothing pass 2 drew.
     *
     * ⛓ THE GOAL IS ASSERTED AS PRESENT-AND-UNIQUE rather than as the only
     * entity, and the element's own entities are asserted to be the seam's —
     * so a step-0 branch that DREW an element and never dropped it (the exact
     * defect the seam-vs-model change fixes) still reds here.
     */
    it('is the bordered room with the goal, before any TEMPLATE', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 0 });
        expect(s.trace).toEqual([]);
        expect(s.summary).toBeNull();
        expect(s.record.entities.filter((e) => e.type === 'torchpickup')).toHaveLength(1);
        /**
         * ⛔ EVERY OTHER ENTITY IS THE ELEMENT'S, asserted by DIFFERENCE against
         * the same room built with `--elements=none` — which is the only claim
         * that can distinguish *the seam placed an element* from *pass 2 drew
         * something*, and is what this row exists for.
         */
        const bare = seedlingModel({ seed: 9, elements: { name: 'none' } }).skeleton();
        expect(bare.entities.map((e) => e.type)).toEqual(['torchpickup']);
        expect(s.model.elements.ran).toBe(true);
        expect(s.record.entities.length).toBeGreaterThan(bare.entities.length);
    });

    /**
     * ⛔ THE SAME MODEL, NOT AN AGREEING ONE. `generateStep(0)` builds
     * `seedlingModel({seed})` and the loop builds the same call, so the goal
     * cell is identical BY CONSTRUCTION. Driven because "by construction" is
     * a claim about two call sites and this is the cheap way to keep it true.
     */
    it('has the goal cell the generated level has', () => {
        const zero = generateStep({ seed: 9, biome: 'pre-sword', step: 0 });
        const one = generateStep({ seed: 9, biome: 'pre-sword', step: 1 });
        expect(zero.model.goalCell).toEqual(one.model.goalCell);
        expect(zero.model.goalOel).toEqual(seedlingModel({ seed: 9 }).goalOel);
        // ...and the level record's own goal entity is at that cell.
        expect(json(zero.record.entities[0]))
            .toBe(json(one.record.entities.find((e) => e.type === 'torchpickup')));
    });

    it('refuses a negative or fractional step by name', () => {
        expect(() => generateStep({ seed: 1, biome: 'pre-sword', step: -1 }))
            .toThrow(/step must be a non-negative integer/);
        expect(() => generateStep({ seed: 1, biome: 'pre-sword', step: 1.5 }))
            .toThrow(/step must be a non-negative integer/);
    });
});

describe('⛔⛔⛔ THE PREFIX PROPERTY — what makes STEP possible at all', () => {
    /**
     * The claim: a run to target k is a run to target k+1 TRUNCATED. If it
     * ever stops being true the STEP button starts showing rooms that are not
     * on the way to the room RUN-ALL produces — which is a display that lies
     * about the loop rather than a slow one.
     */
    it('pre-sword: step 1 and step 2 are prefixes of step 3', () => {
        const three = generateStep({ seed: 9, biome: 'pre-sword', step: 3 });
        for (const k of [1, 2]) {
            const rung = generateStep({ seed: 9, biome: 'pre-sword', step: k });
            expect(json(rung.trace)).toBe(json(three.trace.slice(0, rung.trace.length)));
            expect(rung.summary.keptCount).toBe(k);
        }
    });

    it('post-sword too — the roster with the sword-gated family is no exception', () => {
        const two = generateStep({ seed: 3, biome: 'post-sword', step: 2 });
        const one = generateStep({ seed: 3, biome: 'post-sword', step: 1 });
        expect(json(one.trace)).toBe(json(two.trace.slice(0, one.trace.length)));
    });

    /**
     * ⛓ AND THE LAST RUNG IS THE CLI'S OWN OUTPUT. The whole reason to pay
     * the ladder's O(N²) is that no page-side reconstruction stands between
     * the loop and the picture — so the final record IS what
     * `generate-seedling-level.mjs --count=N` emits.
     */
    it('the final rung is byte-identical to a single generateSeedlingLevel call', () => {
        const rung = generateStep({ seed: 9, biome: 'pre-sword', step: 3 });
        const direct = generateSeedlingLevel({
            seed: 9, palette: PRE_SWORD_PALETTE, bounds: { obstacleTarget: 3 },
        });
        expect(json(rung.record)).toBe(json(direct.record));
        expect(json(rung.trace)).toBe(json(direct.trace));
    });
});

describe('the display solve — the loop\'s own oracle, and it agrees', () => {
    it('solves the current record and carries the tape the scrub needs', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 2 });
        const solved = displaySolve(s);
        expect(solved.verdict).toBe('SOLVED');
        expect(solved.tape).toBeTruthy();
        expect(solved.certification.certified).toBe(true);
    });

    it('and its walk equals the trace row that ACCEPTED this record', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 2 });
        const agreement = agreementWithTrace(s, displaySolve(s));
        expect(agreement.compared).toBe(true);
        expect(agreement.agrees).toBe(true);
        expect(agreement.displayTicks).toBe(agreement.traceTicks);
    });

    /**
     * ⚠ THE DISAGREEMENT PATH IS DRIVEN TOO, because a comparison whose
     * unhappy branch nobody has run is a comparison nobody can trust.
     */
    it('reports a disagreement rather than drawing the one it holds', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 1 });
        const bogus = { verdict: 'SOLVED', ticks: 1 };
        const agreement = agreementWithTrace(s, bogus);
        expect(agreement.agrees).toBe(false);
        expect(agreement.why).toMatch(/DISAGREEMENT/);
    });

    it('has nothing to compare at step 0 and SAYS so', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 0 });
        expect(agreementWithTrace(s, { ticks: 113 }).compared).toBe(false);
    });
});

describe('the pin union — the kept templates, RECONSTRUCTED', () => {
    /**
     * ⛓⛓ SLICE 2 CHANGED WHAT THIS IS. It used to be a name→object LOOKUP and
     * the assertion was set membership; under parameterization a kept row names
     * a BASE (no footprint, no pins) plus the VALUES it was drawn with, so this
     * is a reconstruction and the assertion is that it rebuilds the RIGHT
     * INSTANCE — the one whose geometry is in the record.
     *
     * ⛔ THE SET-MEMBERSHIP CHECK WOULD HAVE BEEN THE EASY REPLACEMENT AND IT
     * IS THE WRONG ONE: a reconstruction that dropped `params` and rebuilt the
     * DEFAULT instance would still return an object of the right family with
     * the right pins, and pins are static per template in v1 — so nothing about
     * the PIN UNION can see that defect. Comparing the rebuilt geometry against
     * the record is the only instrument that can.
     */
    it('rebuilds the exact instance each kept row names, geometry included', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 2 });
        expect(s.keptTemplates).toHaveLength(2);
        for (const [i, t] of s.keptTemplates.entries()) {
            const k = s.summary.kept[i];
            expect(t.name).toBe(k.template);
            expect(t.params).toEqual(k.params);
            expect(t.instance).toBe(k.instance);
            /**
             * ⛔ THE GEOMETRY IS IN THE RECORD: every cell this instance claims
             * to paint really is painted, at this row's own anchor.
             *
             * ⚠ AND THIS WALK IS A **SUBSET** TEST, WHICH IS THE HALF IT CAN
             * SEE — measured in this slice's own mutant run. A reconstruction
             * that returned a SMALLER default instance (a 2x2 pool where the
             * record holds 3x2) paints only cells that really are painted, so
             * this loop stays green on it; the `params`/`instance` equality
             * above is what caught that mutant. The walk catches an OVERSHOOT
             * (a bigger instance claiming a cell nobody painted); the equality
             * catches an UNDERSHOOT. Both lines are here because neither is the
             * whole claim.
             */
            for (const w of t.terrain ?? []) {
                expect(terrainAt(s.record, k.at.tx + w.dx, k.at.ty + w.dy),
                    `${t.instance} at (${k.at.tx + w.dx},${k.at.ty + w.dy})`).toBe(w.terrain);
            }
        }
    });

    it('refuses a kept name the palette does not hold', () => {
        expect(() => keptTemplatesOf({ kept: [{ template: 'nope' }] }, PRE_SWORD_PALETTE))
            .toThrow(/which palette .* does not hold/);
    });

    /**
     * ⛔ AND IT REFUSES A ROW WITH NO `params` RATHER THAN DEFAULTING — the
     * mutant this arc names by hand (a reconstruction that drops `params` and
     * rebuilds the default instance) cannot be silent.
     */
    it('⛔ refuses a kept row whose params are missing — never the default instance', () => {
        expect(() => keptTemplatesOf(
            { kept: [{ template: 'wall-segment', at: { tx: 1, ty: 1 } }] }, PRE_SWORD_PALETTE,
        )).toThrow(/needs a DRAW for "ori"/);
    });
});

describe('the pane rows — verbatim, and the bounds beside them', () => {
    it('carries every attempt with its verdict class and VERBATIM reason', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 3 });
        const rows = generationRows(s.trace);
        expect(rows).toHaveLength(s.trace.length);
        expect(rows[0].label).toBe('(skeleton)');
        for (const [i, r] of rows.entries()) {
            expect(r.outcome).toBe(s.trace[i].outcome);
            expect(r.reasonText).toBe(s.trace[i].reasonText ?? null);
            expect(r.classifiedBy).toBe(s.trace[i].classifiedBy ?? null);
        }
        // ⛔ The evidence channel is not summarised anywhere on the way here.
        const vetoed = rows.filter((r) => r.outcome !== 'KEPT' && r.reasonText);
        for (const r of vetoed) {
            expect(s.trace.some((t) => t.reasonText === r.reasonText)).toBe(true);
        }
    });

    /**
     * ⛓⛓⛓ SLICE 3: THE PANE SHOWS THE SEARCH, NOT ONE COLLAPSED VERDICT.
     *
     * Rows of one candidate now share `step.try`, so the label carries the
     * anchor ordinal — `6.1a1`, `6.1a2` — and `anchorsOffered` rides beside it.
     * ⛔ A pane that printed `6.1` twice would be showing a search as an
     * attempt repeated, which is the one reading a viewer cannot act on.
     *
     * ⚠ THE SUBJECT IS THE MEASURED RESCUE (seed 5 at `anchorTriesPerCandidate:
     * 3` keeps a candidate at its second anchor). At the DEFAULT bound every
     * row is `aN=1` and the case would be about a search nobody ran.
     */
    it('the label carries the ANCHOR ordinal, so one candidate\'s rows are distinguishable',
        () => {
            /**
             * ⛓ RE-PICKED TWICE, SAME SCAN (trap 285). Arc 3 slice 1:
             * `arrow-lane` leaving moved every draw and seed 9 was taken because
             * it walked THREE rows. ⛓⛓ ARC 3 SLICE 4c: the retirement and the
             * goal draw moved them again and seed 9 walks NONE.
             *
             * RE-SCANNED: pre-sword, step 6, `anchorTriesPerCandidate: 3`, seeds
             * 1..30 — **FIVE walk (2, 18, 21, 24, 30)** and **seed 21 walks
             * TWO**, the most of any; the other four walk one each. ⚠ Thinner
             * than the old roster's seven-with-a-three, which is the same
             * shadow the rescue row records: three decoration families revert
             * less, so there is less for a wider anchor walk to rescue.
             */
            const s = generateStep({
                seed: 21,
                biome: 'pre-sword',
                step: 6,
                bounds: { anchorTriesPerCandidate: 3 },
            });
            const rows = generationRows(s.trace);
            const walked = rows.filter((r) => r.anchorsOffered > 1 && r.anchorTry > 1);
            expect(walked.length, 'the subject must WALK for this case to mean anything')
                .toBe(2);
            for (const r of walked) {
                expect(r.label).toBe(`${r.step}.${r.try}a${r.anchorTry}`);
                const siblings = rows.filter((x) => x.step === r.step && x.try === r.try);
                expect(new Set(siblings.map((x) => x.label)).size).toBe(siblings.length);
            }
            expect(rows[0].label).toBe('(skeleton)');
        });

    it('describeState names every bound that ran', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 1 });
        const line = describeState(s, displaySolve(s));
        expect(line).toMatch(/bounds: target=1 tries=8 k=3 anchortries=1/);
        // ⛓ TICKS, not ms — the readout used to say POST-HOC because the budget
        // was a stopwatch. It is not one any more (2026-08-14), and a pane that
        // still advertised a wall clock would be describing a bound nobody runs.
        expect(line).toMatch(/budget: \d+ ticks per target/);
        // ⚠ The negative is on a QUANTITY in milliseconds, not on the letters
        // "ms" — the row's own "(⛓ TICKS, not ms)" reassurance contains them,
        // and a gate that fired on that would be testing its own wording.
        expect(line).not.toMatch(/POST-HOC/);
        expect(line).not.toMatch(/\d+\s*ms\b/);
        expect(line).toMatch(/solve: SOLVED/);
    });
});

describe('?gen= — REPRODUCE the payload, then compare', () => {
    it('agrees with a payload this seed really produced', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 2 });
        const payload = {
            seed: 9, biome: 'pre-sword', level: s.record, trace: s.trace,
        };
        const a = agreementWithPayload(payload, s);
        expect(a.checked).toBe(true);
        expect(a.agrees).toBe(true);
        expect(a.differences).toEqual([]);
    });

    /**
     * ⛔ A MISMATCH IS RETURNED, NOT THROWN — the page draws what it
     * GENERATED and says the payload disagreed. A silent redraw of the
     * payload would be a vacuous success.
     */
    it('names WHICH parts differ instead of throwing', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 1 });
        const a = agreementWithPayload({ seed: 9, biome: 'pre-sword', level: {}, trace: [] }, s);
        expect(a.agrees).toBe(false);
        expect(a.differences).toEqual(['level', 'trace']);
        expect(a.why).toMatch(/determinism finding across the two runtimes/);
    });

    it('refuses a payload that is not an object, without a stack trace', () => {
        const a = agreementWithPayload(null, {});
        expect(a.checked).toBe(false);
        expect(a.agrees).toBe(false);
    });
});

describe('saturation — ⚖ §7.5\'s other case, reported and never silent', () => {
    /**
     * ⛓ THE BOUND IS THE SUBJECT, NOT THE ROOM. `triesPerStep: 1` with
     * `saturationK: 1` makes ONE rejected draw end the run, which is the
     * cheapest honest way to reach the SATURATED branch. ⚠ The seed is a
     * MEASUREMENT, not a taste, and it was named rather than assumed because
     * the first draft picked one that does NOT saturate — caught by this case
     * going green the wrong way round.
     *
     * ⛓⛓ RE-MEASURED AT SLICE 2 (the parameterized-template migration expired
     * every seed→level pair, ⚖ ruling 5): the split became 3/6/9 REACHING and
     * the other seven SATURATING, and seed 1 survived on the saturating side.
     *
     * ⛓⛓⛓ RE-MEASURED AGAIN AT SLICE 4c, AND THE SPLIT **INVERTED**. Over seeds
     * 1..12 at these bounds only **2 and 3 SATURATE** (kept 3 of 6); the other
     * ten REACH the target, seed 1 among them. ⇒ **seed 2 is the subject.**
     * ⚠ THE INVERSION IS ITSELF THE RETIREMENT'S SHADOW and is worth the
     * sentence: a roster of three DECORATION families reverts far less than one
     * holding three door families, so a room saturates far less often. A slice
     * that read this row's re-pick as noise would be missing a real change in
     * what the default generator does.
     */
    it('a rung that keeps fewer than it asked for is SATURATED, and says which', () => {
        const s = generateStep({
            seed: 2,
            biome: 'pre-sword',
            step: 6,
            bounds: { triesPerStep: 1, saturationK: 1 },
        });
        expect(s.summary.keptCount).toBeLessThan(6);
        expect(s.saturated).toBe(true);
        expect(s.stop).toBe(STOP.SATURATED);
        expect(describeState(s)).toMatch(/stop: SATURATED/);
    });
});

// ── the bridge's staging block (switch slice 4) ──────────────────────────

describe('displayStaging — the block the bridge hands to SOLVE and MANUAL', () => {
    /**
     * ⛔ THE CLAIM IS THAT IT IS THE **SAME SOLVE**, and it is asserted rather
     * than asserted-about. `seedlingOracle` builds its staging internally, so
     * `displayStaging` RECONSTRUCTS the block from the same three inputs; a
     * reconstruction nobody compares is a second cost model waiting to drift.
     * Solving the record both ways and comparing the walk is the comparison
     * that would catch a dropped pin, a dropped item flag or a moved boot.
     */
    it('⛓⛓ solves the record to the SAME walk the display solve does', () => {
        const state = generateStep({ seed: 1, biome: 'pre-sword', step: 2 });
        const shown = displaySolve(state);
        expect(shown.verdict).toBe('SOLVED');

        const viaBridge = solveForPage({
            levelSource: levelSourceFromAtlas(atlasOf(state.record)),
            staging: displayStaging(state),
            goals: state.model.goals,
            name: 'bridge',
            maxTicksPerTarget: state.budget.maxTicksPerTarget,
            // The fork the page turns on for exactly this level — see
            // `watchViewer.isHeldLevel`.
            scratchPersistence: true,
        });
        expect(viaBridge.out.perTick.length).toBe(shown.ticks);
    });

    it('carries the PIN UNION over the kept templates, not just the boot', () => {
        // ⚖ §9.4: a water template obliges `'sound'` BY ARGUMENT. A block
        // built without the pins would solve the same room under fewer of
        // them than the loop did.
        const state = generateStep({ seed: 1, biome: 'pre-sword', step: 2 });
        const pins = new Set(state.keptTemplates.flatMap((t) => t.pins ?? []));
        for (const p of pins) expect(displayStaging(state).pins).toContain(p);
        expect(displayStaging(state).pins).toContain('dead_frames');
    });

    it('declares the biome\'s own boot inventory', () => {
        const pre = generateStep({ seed: 1, biome: 'pre-sword', step: 1 });
        const post = generateStep({ seed: 36, biome: 'post-sword', step: 1 });
        expect(displayStaging(pre).seam.items.hasSword).toBe(false);
        expect(displayStaging(post).seam.items.hasSword).toBe(true);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ VERB 1 — RESTRICT: the URL half, and the arm's own state (slice 4)
 * ══════════════════════════════════════════════════════════════════════ */

describe('?families= / ?templates= — the sub-roster, in the ONE reader', () => {
    it('absent means THE WHOLE ROSTER, spelled by absence', () => {
        expect(readGenerateParams('?source=generate&seed=1').roster).toBe(null);
    });

    it('reads either spelling and NORMALIZES it — sorted, deduped', () => {
        expect(readGenerateParams('?biome=pre-sword&families=pit,water,pit').roster)
            .toEqual({ axis: 'families', names: ['pit', 'water'] });
        expect(readGenerateParams('?biome=pre-sword&templates= water-pool , pit-patch ').roster)
            .toEqual({ axis: 'templates', names: ['pit-patch', 'water-pool'] });
    });

    /**
     * ⛔ THE COMPOSITION RULE, AND IT IS "REFUSE". Two parameters that each
     * name a sub-roster are two spellings of one setting, which is this
     * repo's recorded failure mode — the whole reason slice 1 exists. A
     * defined intersection would still have to be printed somewhere for a
     * reader to know what ran, so the cheaper contract is: say it one way.
     */
    it('⛔ REFUSES both spellings at once, naming both values', () => {
        expect(() => readGenerateParams('?biome=pre-sword&families=water&templates=pit-patch'))
            .toThrow(/BOTH present.*two spellings of one setting/s);
    });

    it('⛔ REFUSES an unknown name BY NAME, listing the roster', () => {
        expect(() => readGenerateParams('?biome=pre-sword&families=kill'))
            .toThrow(/names "kill".*does not offer/s);
        expect(() => readGenerateParams('?biome=pre-sword&templates=wall-segement'))
            .toThrow(/names "wall-segement"/);
        /**
         * ⛓⛓⛓ **THE SECOND HALF LOST ITS SUBJECT AT SLICE 4c, AND IS REPLACED
         * RATHER THAN DELETED** (trap 312). It read *"…and the SAME name is
         * legal in the other biome, which is why this is validated against the
         * BIOME'S palette and not a global list"* — driven with `kill`, a family
         * only `POST_SWORD_TEMPLATES` held. The retirement emptied
         * `KILL_LOCK_TEMPLATES`, so **no name is in one roster and not the
         * other**: the biome is the BOOT ITEMS plus the elements' `needs`.
         *
         * ⛔ WHAT SURVIVES IS THE MECHANISM, and it is still worth a gate: the
         * validation takes the BIOME'S OWN palette, so a name is adjudicated
         * against the roster the run will actually draw from. Driven by asking
         * both biomes about a RETIRED name and getting each palette's own
         * sentence — which a global list could not produce.
         */
        expect(() => readGenerateParams('?biome=post-sword&families=kill'))
            .toThrow(/names "kill".*post-sword.*does not offer/s);
        expect(() => readGenerateParams('?biome=pre-sword&families=kill'))
            .toThrow(/names "kill".*pre-sword.*does not offer/s);
        // ⛓ …and a name BOTH hold is accepted by both, which is the other side
        // of the same claim now that the two rosters agree.
        for (const biome of ['pre-sword', 'post-sword']) {
            expect(readGenerateParams(`?biome=${biome}&families=pit`).roster)
                .toEqual({ axis: 'families', names: ['pit'] });
        }
    });

    it('⛔ REFUSES an EMPTY value rather than reading it as absent', () => {
        expect(() => readGenerateParams('?biome=pre-sword&families=')).toThrow(/names nothing/);
        expect(() => readGenerateParams('?biome=pre-sword&templates=,,')).toThrow(/names nothing/);
    });
});

describe('writeGenerateParams — the sub-roster travels, and refuses what the reader would', () => {
    const bounds = {
        obstacleTarget: 2, triesPerStep: 5, saturationK: 2, anchorTriesPerCandidate: 4,
    };
    const roster = { axis: 'families', names: ['pit', 'water'] };

    it('writes the axis it was given and the reader reads it back', () => {
        const search = writeGenerateParams('?source=generate', {
            seed: 3, biome: 'pre-sword', bounds, step: 2, roster,
        });
        expect(readGenerateParams(`?${search}`).roster).toEqual(roster);
    });

    it('⛓ is a FIXED POINT — writing what it wrote changes nothing', () => {
        const once = writeGenerateParams('?source=generate&layers=path', {
            seed: 3, biome: 'pre-sword', bounds, step: 2, roster,
        });
        const back = readGenerateParams(`?${once}`);
        const twice = writeGenerateParams(`?${once}`, {
            seed: back.seed, biome: back.biome, bounds: back.bounds, step: 2, roster: back.roster,
        });
        // ⛔ MEASURED, and it caught a defect: a `delete` followed by a `set`
        // of the same key APPENDS it, so blanket-deleting both spellings first
        // moved `families=` behind `run=` on the second load. The string
        // differed while the run did not.
        expect(twice).toBe(once);
    });

    it('DELETES both spellings when there is no restriction — absence is the spelling', () => {
        const search = writeGenerateParams('?source=generate&families=water&templates=pit-patch', {
            seed: 3, biome: 'pre-sword', bounds, step: 2, roster: null,
        });
        expect(search).not.toMatch(/families=/);
        expect(search).not.toMatch(/templates=/);
        expect(readGenerateParams(`?${search}`).roster).toBe(null);
    });

    it('⛔ DELETES THE OTHER AXIS — the reader refuses a bar holding both', () => {
        const search = writeGenerateParams('?source=generate&families=water', {
            seed: 3, biome: 'pre-sword', bounds, step: 2,
            roster: { axis: 'templates', names: ['pit-patch'] },
        });
        expect(search).not.toMatch(/families=/);
        expect(readGenerateParams(`?${search}`).roster)
            .toEqual({ axis: 'templates', names: ['pit-patch'] });
    });

    /**
     * ⛔ §8.6's STANDING LAW, and this is the arc's first NON-INTEGER
     * parameter: the integer guard cannot see an unknown family name, so the
     * roster needs its own refusal here. A URL this page cannot reload is not
     * a link to the run it is showing.
     */
    it('⛔ REFUSES a roster the reader would refuse', () => {
        expect(() => writeGenerateParams('', {
            seed: 1, biome: 'pre-sword', bounds, step: 1,
            roster: { axis: 'families', names: ['kill'] },
        })).toThrow(/names "kill"/);
        expect(() => writeGenerateParams('', {
            seed: 1, biome: 'pre-sword', bounds, step: 1, roster: { axis: 'families', names: [] },
        })).toThrow(/EMPTY restriction/);
    });
});

describe('generateStep under a restriction — the SAME loop, a smaller roster', () => {
    /**
     * ⛓ THE SUBJECT, MEASURED. ⛓⛓ RE-MEASURED AT ARC 3 SLICE 4c: `weigh` left
     * the roster with its template, so the restriction is `families:pit,water`
     * now, and seed 3 stopped discriminating (restricted and unrestricted both
     * keep two water pools — the same level, so "kept ⊆ restriction" would pass
     * vacuously).
     *
     * RE-SCANNED over seeds 1..12 at target 2: eight discriminate and
     * **seed 8's two kept lists are FULLY DISJOINT — `water-pool`+`water-pool`
     * restricted against `wall-segment`+`wall-segment` whole** — which is the
     * strongest form of the property this block wants and the reason it is
     * taken. ⛔ Disjoint is what makes a restriction the loop ignored visible
     * here rather than only in a hash.
     */
    const ROSTER = { axis: 'families', names: ['pit', 'water'] };
    const at = (roster) => generateStep({
        seed: 8, biome: 'pre-sword', step: 2, bounds: { obstacleTarget: 2 }, roster,
    });

    it('the state carries the roster and the DERIVED palette name', () => {
        const s = at(ROSTER);
        expect(s.roster).toEqual(ROSTER);
        expect(s.palette.name).toBe('pre-sword[families:pit,water]');
        expect(s.summary.palette).toBe(s.palette.name);
        expect(at(null).roster).toBe(null);
        expect(at(null).palette.name).toBe('pre-sword');
    });

    it('⛔ the LEVEL is the restricted one — kept ⊆ the restriction, and it differs', () => {
        const restricted = at(ROSTER);
        const whole = at(null);
        const allowed = restricted.palette.templates.map((t) => t.name);
        for (const k of restricted.summary.kept) expect(allowed).toContain(k.template);
        expect(whole.summary.kept.some((k) => !allowed.includes(k.template))).toBe(true);
        expect(json(restricted.record)).not.toBe(json(whole.record));
    });

    it('the kept templates RECONSTRUCT against the restricted palette', () => {
        const s = at(ROSTER);
        const rows = keptTemplatesOf(s.summary, s.palette);
        expect(rows).toHaveLength(s.summary.keptCount);
        expect(rows.map((r) => r.instance)).toEqual(s.summary.kept.map((k) => k.instance));
    });

    it('`describeState` NAMES the roster the run drew from', () => {
        expect(describeState(at(ROSTER))).toMatch(/palette: pre-sword\[families:pit,water\]/);
        expect(describeState(at(null))).toMatch(/palette: pre-sword \(the WHOLE roster/);
    });

    it('⛔ REFUSES an empty restriction before the loop ever sees it', () => {
        expect(() => at({ axis: 'families', names: [] })).toThrow(/EMPTY restriction/);
    });

    it('the SKELETON is the same room under a restriction — it holds no template', () => {
        const a = generateStep({ seed: 8, biome: 'pre-sword', step: 0, roster: ROSTER });
        const b = generateStep({ seed: 8, biome: 'pre-sword', step: 0 });
        expect(json(a.record)).toBe(json(b.record));
        // ⚠ …and it still SAYS which roster it would draw from, because the
        // next press is the one that spends it.
        expect(a.palette.name).toBe('pre-sword[families:pit,water]');
    });
});

describe('agreementWithPayload — the roster is an IDENTITY field', () => {
    // ⛓ SLICE 4c: seed 3 -> 8, the same re-pick as the block above and for the
    // same reason — at seed 3 the restricted and whole runs now produce the
    // SAME level, so `level` could not appear as a difference.
    const ROSTER = { axis: 'families', names: ['pit', 'water'] };
    const state = generateStep({
        seed: 8, biome: 'pre-sword', step: 2, bounds: { obstacleTarget: 2 }, roster: ROSTER,
    });
    const payloadOf = (s) => ({
        seed: s.seed, biome: s.biome, roster: s.roster, level: s.record, trace: s.trace,
    });

    it('agrees with a payload made under the SAME restriction', () => {
        expect(agreementWithPayload(payloadOf(state), state).agrees).toBe(true);
    });

    /**
     * ⛔ THE FALSE DIVERGENCE THIS PREVENTS: a payload generated under a
     * restriction and reproduced under the WHOLE roster differs in the level,
     * and the honest report names the roster as a difference too — otherwise
     * a reader chases a determinism finding whose cause is the question.
     */
    it('names `roster` when the page regenerated under a different one', () => {
        const whole = generateStep({
            seed: 8, biome: 'pre-sword', step: 2, bounds: { obstacleTarget: 2 },
        });
        const out = agreementWithPayload(payloadOf(state), whole);
        expect(out.agrees).toBe(false);
        expect(out.differences).toContain('roster');
        expect(out.differences).toContain('level');
    });

    /**
     * ⚠ AN OLD PAYLOAD DOES NOT FALSELY DIVERGE. Payloads written before this
     * field existed name no roster, and "no roster" is exactly what an
     * unrestricted run has.
     */
    it('an OLD payload with no `roster` field agrees with an unrestricted run', () => {
        const whole = generateStep({
            seed: 8, biome: 'pre-sword', step: 2, bounds: { obstacleTarget: 2 },
        });
        const old = payloadOf(whole);
        delete old.roster;
        expect(agreementWithPayload(old, whole).agrees).toBe(true);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ VERB 2 — THE DIRECTED ATTEMPT'S IDENTITY (slice 5)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛓ THE SUBJECT IS CHOSEN BY MEASUREMENT, not by taste
 * (`sweep-seedling-directed-bound.mjs`, and the probe recorded in kickoff
 * §12): `wall-segment(ori=v,len=4)` on the pre-sword SKELETON at seed 6
 * SOLVES at anchor 1 and DISCHARGES only at anchor 6 of 6.
 *
 * ⚠ IT DISCRIMINATES ON BOTH CLAIMS AT ONCE, which is why it is this one:
 *   · the POLICY claim — first-SOLVED keeps anchor 1, prefer-discharge keeps
 *     anchor 6, so a build that ignored discharge lands somewhere else;
 *   · the PARAMS claim — `ori=v,len=4` differs from the base's DEFAULT
 *     instance (`ori=h,len=3`) in BOTH parameters, so a URL that dropped its
 *     params rebuilds a visibly different instance. ⛔ Trap 235's shape: a
 *     subject that agreed with its own fallback could not fail.
 */
const SUBJECT = Object.freeze({ seed: 6, biome: 'pre-sword', step: 0 });
const DIRECTIVE = Object.freeze({
    template: 'wall-segment',
    params: Object.freeze({ ori: 'v', len: 4 }),
    anchor: null,
    keepPolicy: DIRECTIVE_KEEP_POLICY,
    bound: DIRECTED_ANCHOR_TRIES,
});

describe('⛓⛓ `?directed=` — the grammar, and it is the instance label', () => {
    const palette = paletteFor('pre-sword');

    it('round-trips a directive through parse and format', () => {
        const text = 'wall-segment(ori=v,len=4)@12';
        const [d] = parseDirectives(text, palette);
        expect(d.template).toBe('wall-segment');
        expect(d.params).toEqual({ ori: 'v', len: 4 });
        expect(d.keepPolicy).toBe(DIRECTIVE_KEEP_POLICY);
        expect(d.bound).toBe(12);
        expect(d.anchor).toBeNull();
        expect(formatDirectives([d], palette)).toBe(text);
    });

    it('⚠ TYPES COME FROM THE SCHEMA: `len=4` is the NUMBER 4, `ori=v` a string', () => {
        const [d] = parseDirectives('wall-segment(ori=v,len=4)@12', palette);
        expect(d.params.len).toBe(4);
        expect(d.params.len).not.toBe('4');
        expect(d.params.ori).toBe('v');
    });

    it('a ZERO-parameter template has no clause at all — its label IS its name', () => {
        /**
         * ⛓ ARC 3 SLICE 1: this row used to be driven on `arrow-lane`, the
         * palette's one zero-parameter template, and ⚖ design ruling 9 took it
         * out of the generator. The GRAMMAR still has the case, so the subject
         * is a SYNTHETIC palette rather than a deleted row (trap 312: retiring
         * a row makes a claim vacuous, and the answer is the sentence that
         * still has content). ⛔ `parseDirectives` takes the palette it is
         * given, which is exactly what makes this substitution honest.
         */
        const soloPalette = {
            name: 'grammar-fixture',
            templates: [defineTemplate({
                name: 'bare',
                family: 'bare',
                params: [],
                why: 'a fixture: no parameters, so the label IS the name',
                build: () => ({ footprint: [{ dx: 0, dy: 0 }], terrain: [], entities: [] }),
            })],
        };
        const [d] = parseDirectives('bare@12', soloPalette);
        expect(d.template).toBe('bare');
        expect(d.params).toEqual({});
        expect(formatDirectives([d], soloPalette)).toBe('bare@12');
        // ⛔ and the SHIPPED roster no longer holds one, which is why the
        // fixture is here rather than a palette row.
        expect(palette.templates.some((t) => t.params.length === 0)).toBe(false);
    });

    it('carries several directives in ORDER', () => {
        // ⛓ ARC 3 SLICE 1: the middle member was `arrow-lane@4`; it left with
        // ⚖ design ruling 9, so a shipped template with a parameter clause
        // takes its place. The claim — ORDER survives a round trip — is
        // unchanged, and `@4` still rides on the middle one.
        const text = 'water-pool(w=1,h=3)@12;pit-patch(w=2,h=1)@4;wall-segment(ori=v,len=5)@12';
        const ds = parseDirectives(text, palette);
        expect(ds.map((d) => d.template))
            .toEqual(['water-pool', 'pit-patch', 'wall-segment']);
        expect(ds[1].keepPolicy).toBe(KEEP_POLICY.FIRST_SOLVED);
        expect(ds[1].bound).toBe(4);
        expect(formatDirectives(ds, palette)).toBe(text);
    });

    it('⛓ SLICE 6\'s ANCHOR SUFFIX already parses and round-trips', () => {
        const text = 'wall-segment(ori=h,len=2)@1!4,6';
        const [d] = parseDirectives(text, palette);
        expect(d.anchor).toEqual({ tx: 4, ty: 6 });
        expect(formatDirectives([d], palette)).toBe(text);
    });

    it('⛓ THE CLAUSE IS WRITTEN IN SCHEMA ORDER, whatever order the values came in',
        () => {
            // ⛔ The fixed point depends on this: a value DRAWN by an "any"
            // choice and one typed into the form must spell identically, or the
            // second load of a copied link would rewrite the bar.
            const backwards = { ...DIRECTIVE, params: { len: 4, ori: 'v' } };
            expect(formatDirectives([backwards], palette))
                .toBe('wall-segment(ori=v,len=4)@12');
        });

    describe('every refusal is BY NAME, and they are four different mistakes', () => {
        it('an unknown TEMPLATE names it and lists the roster', () => {
            // ⛓ SLICE 4c: the RETIRED `wall-gap-block` is the realistic unknown
            // now — somebody's saved link — and it exercises the same refusal.
            expect(() => parseDirectives('wall-gap-block(ori=v,gap=1)@12', palette))
                .toThrow(/names template "wall-gap-block", which palette/);
        });
        it('an unknown PARAMETER names it and lists what the template declares', () => {
            expect(() => parseDirectives('wall-segment(orientation=v)@12', palette))
                .toThrow(/has no parameter "orientation"/);
        });
        it('a value OUTSIDE the declared domain refuses BEFORE any solve', () => {
            expect(() => parseDirectives('wall-segment(ori=diagonal,len=4)@12', palette))
                .toThrow(/not in its declared domain \[h, v\]/);
            expect(() => parseDirectives('wall-segment(ori=v,len=99)@12', palette))
                .toThrow(/not in its declared domain \[2, 3, 4, 5\]/);
        });
        it('a MALFORMED directive quotes it and states the spelling', () => {
            for (const bad of ['wall-segment', 'wall-segment@12x', 'wall-segment@',
                'wall-segment(ori=v@12', '@12']) {
                expect(() => parseDirectives(bad, palette)).toThrow(/is not a directive/);
            }
        });
        it('an EMPTY ?directed= refuses — absence is how "no directives" is spelled', () => {
            expect(() => parseDirectives('', palette)).toThrow(/names nothing/);
        });
        it('a duplicated parameter refuses — two values for one setting', () => {
            expect(() => parseDirectives('wall-segment(ori=v,ori=h)@12', palette))
                .toThrow(/names parameter "ori" twice/);
        });
    });

    describe('⛔ THE WRITER REFUSES WHAT THE READER WOULD REFUSE (§8.6\'s law)', () => {
        it('a directive MISSING a parameter value REFUSES, never writes the default', () => {
            expect(() => formatDirectives([{ ...DIRECTIVE, params: { ori: 'v' } }], palette))
                .toThrow(/carries no value for "len"/);
        });
        it('a value outside the domain refuses on the way OUT too', () => {
            expect(() => formatDirectives(
                [{ ...DIRECTIVE, params: { ori: 'v', len: 42 } }], palette,
            )).toThrow(/outside its declared domain/);
        });
        it('an unknown template refuses on the way OUT too', () => {
            expect(() => formatDirectives([{ ...DIRECTIVE, template: 'nope' }], palette))
                .toThrow(/palette "pre-sword" does not hold it/);
        });
    });
});

describe('⛓⛓⛓ SLICE 12 — `?directed=` LEFT THE URL (⚖ §3.9)', () => {
    /**
     * ⛔ REPLACE, NEVER RELAX (trap 62/199). Slice 5's three rows here drove the
     * reader parsing `?directed=` against the biome's palette, the post-sword
     * refusal, and the writer's delete-when-empty. The GRAMMAR half of each
     * still runs — one describe up, over `parseDirectives`/`formatDirectives`,
     * which the CLI's `--directed=` and the payload's labels still speak. What
     * these rows assert now is that the ADDRESS BAR is not one of the channels.
     */
    it('⛔ the reader REFUSES ?directed= by name, and names the way in', () => {
        expect(() => readGenerateParams(
            '?source=generate&seed=6&biome=pre-sword&directed=wall-segment(ori=v,len=4)@12',
        )).toThrow(/no longer a URL parameter/);
        expect(() => readGenerateParams('?source=generate&directed=x@1'))
            .toThrow(/directives ride the PAYLOAD/);
        expect(() => readGenerateParams('?source=generate&directed=x@1'))
            .toThrow(/the Seedling page/);
    });

    it('⚠ …however malformed, and however empty — PRESENCE is the whole test', () => {
        // ⛓ A value slice 5's parser would have REFUSED for its own reason now
        // refuses for THIS one, so an old link never gets a grammar lecture
        // about a parameter that no longer exists.
        expect(() => readGenerateParams('?source=generate&directed=nope@nope'))
            .toThrow(/no longer a URL parameter/);
        expect(() => readGenerateParams('?source=generate&directed='))
            .toThrow(/no longer a URL parameter/);
        // ⛔ and it refuses BEFORE any other parameter is adjudicated: a link
        // carrying both a stale directive and a bad skeleton says THIS first.
        expect(() => readGenerateParams('?source=generate&directed=x@1&skeleton=corridor'))
            .toThrow(/no longer a URL parameter/);
    });

    it('⛔ the WRITER never emits it, and DROPS one it inherited', () => {
        const q = writeGenerateParams('directed=wall-segment(ori=v,len=4)@12', {
            seed: 1, biome: 'pre-sword', bounds: DEFAULT_BOUNDS, step: 0,
        });
        expect(new URLSearchParams(q).get('directed')).toBeNull();
        /**
         * ⛔⛔ AND A CALLER THAT STILL PASSES `directives` GETS NOTHING FOR IT.
         * ⛓ This row exists because the mutant table needed it: a build whose
         * writer took the option back would leave every other row here green
         * (none of them passes one), and the defect would only be visible from
         * a browser. A fixture that cannot DISTINGUISH two builds does not gate
         * the change.
         */
        const withOption = writeGenerateParams('', {
            seed: 6, biome: 'pre-sword', bounds: DEFAULT_BOUNDS, step: 0,
            directives: [DIRECTIVE],
        });
        expect(new URLSearchParams(withOption).get('directed')).toBeNull();
        expect(withOption).not.toMatch(/directed/);
        // ⛓⛓ AND WHAT IT WROTE IS READABLE — the pair, which is the one case
        // where a fixed point is the right gate: a writer that emitted the key
        // again would produce a bar its OWN reader refuses.
        expect(() => readGenerateParams(`?${q}`)).not.toThrow();
    });

    it('⛓ a DIRECTED state writes the LADDER\'s URL, byte for byte the plain one\'s', () => {
        const base = generateStep(SUBJECT);
        const directed = applyDirective(base, DIRECTIVE, 0);
        const args = (st) => ({
            seed: st.seed, biome: st.biome, bounds: st.bounds, step: st.step,
            roster: st.roster, skeleton: st.skeleton,
        });
        expect(directed.directives).toHaveLength(1);
        expect(writeGenerateParams('', args(directed))).toBe(writeGenerateParams('', args(base)));
        expect(writeGenerateParams('', args(directed))).not.toMatch(/directed/);
    });

    it('⛓⛓ …and the IDENTITY LINE says so, so the bar is never read as complete', () => {
        const base = generateStep(SUBJECT);
        const directed = applyDirective(base, DIRECTIVE, 0);
        expect(describeState(base)).not.toMatch(/NOT a reproduction/);
        expect(describeState(directed))
            .toMatch(/the URL is NOT a reproduction of this construction/);
        expect(describeState(directed)).toMatch(/names the LADDER alone/);
    });
});

describe('⛓⛓⛓ VERB 2, APPLIED — the ruling\'s two clauses, driven', () => {
    /**
     * ⛓⛓⛓ **A ROW STOOD HERE AND ITS POLICY RETIRED** — *"every KEPT door
     * DISCHARGES — the merely-SOLVES class is empty under the cut law"* (arc 3,
     * slice 4c; ⚖ user, 2026-08-17).
     *
     * THE LINEAGE, because it is the arc's argument twice over. The row was
     * originally *"`PREFER_DISCHARGE` walks PAST an anchor that merely SOLVES to
     * reach one that DISCHARGES"*. Arc-3 slice 2's DOOR LAW emptied that class
     * for a door family and MEASURED it — over seeds 1..12 x every
     * instantiation of the two weigh/shove doors x EVERY legal anchor, placed
     * alone and solved: **338 SOLVED-and-DISCHARGED, 0 SOLVED-without-
     * discharging, 80 refused, 0 threw** — because an anchor where a door SOLVED
     * without discharging was a door the walk went ROUND, which is ⚖ ruling 17's
     * DECORATION and is refused before any solve. The row was rewritten to
     * assert the two facts that survived: the directive discharges, and the
     * control AGREES.
     *
     * ⛔ SLICE 4c EMPTIES IT A SECOND TIME AND STRUCTURALLY. The three families
     * with a VERB (`shove`, `weigh`, `kill`) retired into ELEMENTS, so
     * `dischargesVerb` answers `null` — `NO_VERB` — for EVERY row either roster
     * holds. There is no directive that can discharge anything, and
     * `PREFER_DISCHARGE` is gone from Seedling entirely: `applyDirective` runs
     * every directive under `first-solved` and REFUSES a spec that names a
     * policy. A row that drove the preference now would be driving a value the
     * codec cannot spell.
     *
     * ⛓ WHAT SURVIVES IT IS THE ROW DIRECTLY BELOW — `NO_VERB` is reported as
     * `solved-no-verb` rather than as `solved-only` — which was always the
     * sharper half of the pair, and is now the whole of it.
     */

    /**
     * ⛓⛓⛓ **RE-STATED AT SLICE 4c, AND THE NEW SENTENCE IS THE HONEST ONE**
     * (trap 312). The row asserted `keptKind === NO_VERB` — the walk's answer
     * *"this family has no verb, so first-SOLVED is its whole criterion"*. That
     * value is produced only under `PREFER_DISCHARGE`, which Seedling retired:
     * under `FIRST_SOLVED` `walkAnchors` never asks the predicate and
     * `keptKind` is **`null`**, which `levelGenerator`'s own docblock calls the
     * answer rather than a missing one — *the walk never asked*.
     *
     * ⛔ SO THE CLAIM MOVES TO THE READOUT, where it can still fail: a `null`
     * `keptKind` must read as *"the keep policy was first-SOLVED, so nothing
     * asked"* and must NOT read as `solved-only` (a shortfall nobody looked
     * for) or as `solved-no-verb` (a claim about a family). `describeKeptKind`
     * is the ONE spelling both pages and both CLIs share, so this is asked of
     * it directly.
     */
    it('⛔ a KEPT directive reports that NOTHING ASKED — not `solved-only`, not '
        + '`solved-no-verb`', () => {
        const base = generateStep(SUBJECT);
        const out = applyDirective(base, {
            template: 'wall-segment',
            params: { ori: 'h', len: 2 },
            anchor: null,
            bound: DIRECTED_ANCHOR_TRIES,
        }, 0);
        const [d] = out.directives;
        expect(d.outcome).toBe(ATTEMPT.KEPT);
        expect(d.keptKind).toBeNull();
        expect(describeKeptKind(d)).toMatch(/the keep policy was first-SOLVED/);
        expect(describeKeptKind(d)).not.toMatch(/solved-only/);
        expect(describeKeptKind(d)).not.toMatch(/NO verb to discharge/);
        // ⛔ …and a spec that NAMES a policy is refused rather than ignored.
        expect(() => applyDirective(base, {
            template: 'wall-segment',
            params: { ori: 'h', len: 2 },
            anchor: null,
            keepPolicy: KEEP_POLICY.PREFER_DISCHARGE,
            bound: DIRECTED_ANCHOR_TRIES,
        }, 0)).toThrow(/Seedling runs every directive under/);
    });

    it('⛓ the KEPT instance joins `keptTemplates`, so the PIN UNION sees it', () => {
        /**
         * ⛔ LOAD-BEARING, not bookkeeping: a water pool obliges `'sound'` BY
         * ARGUMENT. A directive that placed geometry without joining this list
         * would certify the room under fewer pins than it contains — slice 3
         * track A's own defect, one entry over.
         */
        const base = generateStep(SUBJECT);
        const out = applyDirective(base, {
            template: 'water-pool',
            params: { w: 1, h: 1 },
            anchor: null,
            keepPolicy: DIRECTIVE_KEEP_POLICY,
            bound: DIRECTED_ANCHOR_TRIES,
        }, 0);
        expect(out.directives[0].outcome).toBe(ATTEMPT.KEPT);
        expect(out.keptTemplates).toHaveLength(base.keptTemplates.length + 1);
        expect(displayStaging(out).pins).toContain('sound');
        // ⛔ and the pins were NOT there before the directive.
        expect(displayStaging(base).pins).not.toContain('sound');
    });

    it('⛔ `summary` STAYS THE LADDER\'S — a directive is not a rung', () => {
        const base = generateStep({ ...SUBJECT, step: 2 });
        const out = applyDirective(base, DIRECTIVE, 0);
        expect(out.summary).toBe(base.summary);
        expect(out.summary.keptCount).toBe(2);
        expect(out.directives).toHaveLength(1);
    });

    it('the directive\'s rows are labelled d<n>a<k> and carry the pane\'s row shape', () => {
        /**
         * ⛓⛓ ARC 3 SLICE 2 — THIS ROW NEEDS A SUBJECT THAT WALKS MORE THAN ONE
         * ANCHOR, and seed 6 stopped being one under the DOOR LAW. Seed 9 at
         * step 0 took over.
         *
         * ⛓⛓⛓ **ARC 3 SLICE 4c — AND NO STEP-0 SUBJECT EXISTS ANY MORE.**
         * RE-SCANNED exhaustively: EVERY instantiation of EVERY remaining
         * pre-sword template x seeds 1..20, directed onto the bare skeleton —
         * **not one walk is longer than a single anchor.** That is the
         * retirement's own consequence and the same finding
         * `procgenPalette.test.js` records where its unit-level anchor row used
         * to be: the three families that could SEAL a bare room were the door
         * templates, and `wall-segment`/`water-pool`/`pit-patch` are decoration
         * — a bare 10x10 room solves around all three at every anchor.
         *
         * ⛔ SO THE SUBJECT MOVES TO A ROOM THAT ALREADY HOLDS OBSTACLES, which
         * is where the bound was ever spent for real. RE-SCANNED at step 3 and
         * step 5 over the same grid: **step 3, `wall-segment(ori=v,len=4)`,
         * seed 2 walks THREE rows — `d1a1` REVERTED, `d1a2` REVERTED, `d1a3`
         * KEPT** — the richest of the five hits and the only one that ends in a
         * KEEP, which this row needs for its "exactly ONE says KEPT" assertion.
         */
        const base = generateStep({
            seed: 2, biome: 'pre-sword', step: 3, bounds: { obstacleTarget: 3 },
        });
        const out = applyDirective(base, DIRECTIVE, 0);
        const rows = generationRows(out.trace).filter((r) => r.directive === 1);
        expect(rows.length).toBeGreaterThan(1);
        expect(rows[0].label).toBe('d1a1');
        expect(rows.map((r) => r.anchorTry)).toEqual(rows.map((_, i) => i + 1));
        // ⛔ exactly ONE of them says KEPT.
        expect(rows.filter((r) => r.outcome === 'KEPT')).toHaveLength(1);
        /**
         * ⛓ AND A LADDER ROW IS UNTOUCHED BY THE NEW LABEL BRANCH. ⚠ Read off a
         * state that HAS ladder rows: a step-0 state's trace is empty, so
         * asserting about `[0]` there would have been a claim about nothing.
         */
        const ladder = generationRows(generateStep({ ...SUBJECT, step: 1 }).trace);
        expect(ladder[0].label).toBe('(skeleton)');
        expect(ladder[0].directive).toBeNull();
        expect(ladder.some((r) => /^\d+\.\d+a\d+$/.test(r.label))).toBe(true);
    });

    it('⛓ the IDENTITY LINE says ladder-to-step-k plus N directed attempts', () => {
        const base = generateStep({ ...SUBJECT, step: 1 });
        expect(describeState(base)).not.toMatch(/directed attempt/);
        const out = applyDirective(base, DIRECTIVE, 0);
        expect(describeState(out)).toMatch(/step 1, then 1 directed attempt\(s\)/);
    });

    it('states its COST before the press, and the ceiling is the bound plus the display solve',
        () => {
            const cost = directedCost(DIRECTED_ANCHOR_TRIES, 139);
            expect(cost.solves).toBe(DIRECTED_ANCHOR_TRIES + 1);
            expect(cost.worstCaseTotalMs).toBe((DIRECTED_ANCHOR_TRIES + 1) * 139);
            expect(cost.why).toMatch(/CEILING/);
        });
});

describe('⛓⛓⛓ REPRODUCTION — a copied identity rebuilds the whole construction', () => {
    /**
     * ⛓ THE PAYLOAD'S DIRECTIVE LIST, THROUGH JSON — a payload is a FILE, so
     * the list the page replays has been serialised and parsed. Doing that here
     * is not ceremony: it is what proves a RECORDED directive (frozen, with its
     * resolved `params`) survives the trip the channel actually makes.
     */
    const payloadDirectivesOf = (st) => JSON.parse(JSON.stringify(st.directives));

    it('the ladder plus its directives reproduces byte for byte, in one path', () => {
        const pressed = applyDirective(generateStep(SUBJECT), DIRECTIVE, 0);
        const replayed = generateWithDirectives({ ...SUBJECT, directed: [DIRECTIVE] });
        expect(replayed.record).toEqual(pressed.record);
        expect(replayed.trace).toEqual(pressed.trace);
        expect(replayed.directives).toEqual(pressed.directives);
    });

    /**
     * ⛓⛓⛓ SLICE 12 RE-CUT THIS ROW FROM THE URL TO THE **PAYLOAD** (⚖ §3.9),
     * which is the channel `?gen=` and `procgenLab:load` now use. ⛔ Replaced,
     * not relaxed: the claim is still *"a copied identity rebuilds the whole
     * construction byte for byte"*, and both halves of the identity — the
     * LAUNCH parameters through the bar, the DIRECTIVES through the payload —
     * are driven, because splitting them is exactly what this slice did.
     */
    it('⛓⛓ THROUGH THE PAYLOAD: the bar launches the ladder, the payload replays '
        + 'the directives — the same level', () => {
        const pressed = applyDirective(generateStep(SUBJECT), DIRECTIVE, 0);
        const search = writeGenerateParams('', {
            seed: pressed.seed,
            biome: pressed.biome,
            bounds: pressed.bounds,
            step: pressed.step,
        });
        // ⛔ THE BAR NAMES NO DIRECTIVE, and the reader would refuse one.
        expect(new URLSearchParams(search).get('directed')).toBeNull();
        const read = readGenerateParams(`?${search}`);
        // ⛓ The payload's OWN list, at its OWN indices — `payload.directives`
        // is what the page hands the replay, so it is what is handed here.
        const payloadDirectives = payloadDirectivesOf(pressed);
        const rebuilt = generateWithDirectives({
            seed: read.seed,
            biome: read.biome,
            // ⛓ THE ONE READER of the `run` + `count` encoding — see
            // `stepFromParams`. Re-deriving it here is what reddened this case
            // the first time, by reproducing a step-6 ladder from a skeleton.
            step: stepFromParams(read),
            bounds: read.bounds,
            budget: read.budget,
            roster: read.roster,
            directed: payloadDirectives,
        });
        expect(rebuilt.record).toEqual(pressed.record);
        expect(rebuilt.directives.map((d) => d.at)).toEqual(pressed.directives.map((d) => d.at));
    });

    it('⛔ A URL THAT DROPPED THE PARAMS BUILDS A DIFFERENT LEVEL — which is why '
        + 'the reconstruction REFUSES instead of defaulting', () => {
        /**
         * ⛓ The structural-refusal law carried from slice 2 §9.5, now at the
         * directive: `formatDirectives` refuses a directive missing a value,
         * and the level the DEFAULT instance would have produced is measurably
         * different — so this case proves the refusal is worth having rather
         * than merely present.
         */
        const pressed = applyDirective(generateStep(SUBJECT), DIRECTIVE, 0);
        const defaulted = applyDirective(generateStep(SUBJECT), {
            ...DIRECTIVE, params: { ori: 'h', len: 3 },
        }, 0);
        expect(defaulted.record).not.toEqual(pressed.record);
    });

    it('⛓⛓ TWO STREAMS: a DRAWN parameter replays identically from its recorded value', () => {
        /**
         * ⛔ THE DEFECT THIS PREVENTS, and it is the reason the parameter draw
         * and the anchor walk are separate streams. A directive may leave a
         * parameter to be DRAWN and then RECORDS the drawn value; the replay
         * passes that value as an override and spends NO draw where the
         * original spent one. With ONE stream the anchor shuffle would start
         * from a different position and the replay would walk a DIFFERENT
         * anchor list — a copied link reproducing a different level with
         * nothing on the page able to say why.
         */
        const base = generateStep(SUBJECT);
        // `len` is left to be DRAWN; `ori` is named.
        const drawn = applyDirective(base, { ...DIRECTIVE, params: { ori: 'v' } }, 0);
        const rec = drawn.directives[0];
        expect(Object.keys(rec.params).sort()).toEqual(['len', 'ori']);
        // …and replaying the RECORDED values reproduces it byte for byte.
        const replayed = applyDirective(base, { ...DIRECTIVE, params: rec.params }, 0);
        expect(replayed.record).toEqual(drawn.record);
        expect(replayed.directives[0].at).toEqual(rec.at);
        expect(replayed.trace).toEqual(drawn.trace);
    });

    it('⚠ two IDENTICAL directives are two different questions (the index is in the mix)',
        () => {
            const base = generateStep(SUBJECT);
            const one = applyDirective(base, DIRECTIVE, 0);
            const two = applyDirective(one, DIRECTIVE, 1);
            expect(two.directives).toHaveLength(2);
            // ⛔ The second walks its OWN anchor order, so it does not simply
            // meet the first's placement and give up.
            expect(two.directives[1].at).not.toEqual(two.directives[0].at);
        });
});

describe('⛓ the payload carries the construction, and an OLD one does not falsely diverge',
    () => {
        const stateFor = () => applyDirective(generateStep(SUBJECT), DIRECTIVE, 0);

        it('`directives` is compared like the other identity fields', () => {
            const s = stateFor();
            const payload = {
                seed: s.seed, biome: s.biome, roster: s.roster, directives: s.directives,
                skeleton: s.skeleton, level: s.record, trace: s.trace,
            };
            expect(agreementWithPayload(payload, s).agrees).toBe(true);
            const without = { ...payload, directives: [] };
            const check = agreementWithPayload(without, s);
            expect(check.agrees).toBe(false);
            expect(check.differences).toContain('directives');
        });

        it('⚠ an OLD payload — no `directives`, no `skeleton` — still agrees on a ladder run',
            () => {
                const ladder = generateStep({ ...SUBJECT, step: 1 });
                const old = {
                    seed: ladder.seed, biome: ladder.biome, roster: ladder.roster,
                    level: ladder.record, trace: ladder.trace,
                };
                const check = agreementWithPayload(old, ladder);
                expect(check.differences).not.toContain('directives');
                expect(check.differences).not.toContain('skeleton');
                expect(check.agrees).toBe(true);
            });

        it('⚖ ruling 9(b): the SKELETON block is reserved, named, and compared', () => {
            const s = stateFor();
            expect(s.skeleton).toEqual(DEFAULT_SKELETON);
            /**
             * ⛓⛓ SLICE 5 RENAMED IT: `empty-bordered` -> `empty`, ⚖ ruling 2's
             * one vocabulary. ⛔ The value is asserted as a LITERAL rather than
             * against the constant it came from — a rename that missed one of
             * its two spellings would still satisfy `toEqual(DEFAULT_SKELETON)`.
             */
            expect(DEFAULT_SKELETON.kind).toBe('empty');
            const other = {
                seed: s.seed, biome: s.biome, roster: s.roster, directives: s.directives,
                skeleton: { kind: 'all-wall-carved' }, level: s.record, trace: s.trace,
            };
            expect(agreementWithPayload(other, s).differences).toContain('skeleton');
        });
    });

/**
 * ── ⛓⛓⛓ SLICE 6 — CLICK-TO-ANCHOR ────────────────────────────────────
 *
 * ⚖ Ruling 6's manual half: the unit is still the TEMPLATE, the anchor is a
 * CLICKED cell, and `legalAt` adjudicates it before any solve.
 */
describe('⛓⛓⛓ `tileAtPoint` — the ONE pixel-to-tile conversion, at its BOUNDARIES', () => {
    /**
     * ⛔ THE EXPECTATIONS ARE LITERALS, not the formula re-run. A check that
     * recomputed `floor(x * cols / width)` would agree with any implementation
     * of that expression, including a wrong one — trap 249's shape, in the
     * smallest place it can happen. A 320 px canvas over a 10-tile room is 32
     * px a tile, and every number below is that arithmetic done by hand.
     */
    const box = { width: 320, height: 320, cols: 10, rows: 10 };

    it('⛔ THE LAST PIXEL OF A TILE IS THAT TILE, and the FIRST of the next is the next', () => {
        // tile 3 spans x 96..127; tile 4 begins at 128.
        expect(tileAtPoint({ ...box, x: 96, y: 0 }).tx).toBe(3);
        expect(tileAtPoint({ ...box, x: 127, y: 0 }).tx).toBe(3);
        expect(tileAtPoint({ ...box, x: 128, y: 0 }).tx).toBe(4);
        // and the same on the other axis, because two axes is two chances
        expect(tileAtPoint({ ...box, x: 0, y: 127 }).ty).toBe(3);
        expect(tileAtPoint({ ...box, x: 0, y: 128 }).ty).toBe(4);
    });

    it('the first and last cells of the room are reachable', () => {
        expect(tileAtPoint({ ...box, x: 0, y: 0 })).toEqual({ tx: 0, ty: 0 });
        expect(tileAtPoint({ ...box, x: 319, y: 319 })).toEqual({ tx: 9, ty: 9 });
    });

    it('⛓ it uses the ROOM\'s dimensions and the ELEMENT\'s size, so any CSS scale works', () => {
        // the same click on a canvas presented at HALF size names the same tile
        expect(tileAtPoint({ width: 160, height: 160, cols: 10, rows: 10, x: 63, y: 63 }))
            .toEqual({ tx: 3, ty: 3 });
        expect(tileAtPoint({ width: 160, height: 160, cols: 10, rows: 10, x: 64, y: 64 }))
            .toEqual({ tx: 4, ty: 4 });
    });

    it('⛔ a point past the edge REFUSES rather than clamping to the last cell', () => {
        expect(() => tileAtPoint({ ...box, x: 320, y: 0 })).toThrow(/outside a 10x10 room/);
        expect(() => tileAtPoint({ ...box, x: -1, y: 0 })).toThrow(/outside a 10x10 room/);
        expect(() => tileAtPoint({ ...box, x: 0, y: 999 })).toThrow(/outside a 10x10 room/);
    });

    it('refuses a zero-sized canvas and a non-integer room by name', () => {
        expect(() => tileAtPoint({ ...box, width: 0, x: 1, y: 1 }))
            .toThrow(/positive canvas width/);
        expect(() => tileAtPoint({ ...box, cols: 0, x: 1, y: 1 }))
            .toThrow(/positive integer cols/);
        expect(() => tileAtPoint({ ...box, x: NaN, y: 1 })).toThrow(/finite point/);
    });
});

describe('⛓⛓⛓ `?directed=`\'s `!tx,ty` — the CLICKED cell, and its bound is 1', () => {
    const palette = paletteFor('pre-sword');

    it('round-trips the anchor at bound 1 under BOTH policies', () => {
        for (const text of ['wall-segment(ori=h,len=2)@1!4,6',
            'wall-segment(ori=v,len=4)@1!7,1']) {
            const [d] = parseDirectives(text, palette);
            expect(d.anchor).toEqual({ tx: Number(text.split('!')[1].split(',')[0]),
                ty: Number(text.split('!')[1].split(',')[1]) });
            expect(d.bound).toBe(1);
            expect(formatDirectives([d], palette)).toBe(text);
        }
    });

    it('⛔ an explicit anchor beside a bound above 1 REFUSES — in the reader AND the writer',
        () => {
            expect(() => parseDirectives('wall-segment(ori=v,len=4)@12!7,1', palette))
                .toThrow(/explicit cell is a walk of ONE cell/);
            expect(() => formatDirectives(
                [{ ...DIRECTIVE, anchor: { tx: 7, ty: 1 }, bound: 12 }], palette,
            )).toThrow(/EXPLICIT anchor \(7,1\) and bound 12/);
        });

    /**
     * ⛓⛓⛓ SLICE 12 RE-CUT THIS FROM A URL FIXED POINT TO A **GRAMMAR** ROUND
     * TRIP. `!tx,ty` still exists — it is a DIRECTIVE OBJECT's field and the
     * CLI's `--directed=` still spells it — so what was tested through the bar
     * is tested through the codec that bar used to call, and the VALUE claim
     * (trap 250: a fixed point never gates a value) is the same literal.
     */
    it('⛓ the clicked spelling round-trips through the GRAMMAR, and the BAR carries none',
        () => {
            const clicked = { ...DIRECTIVE, anchor: { tx: 7, ty: 1 }, bound: 1 };
            const text = formatDirectives([clicked], palette);
            expect(text).toBe('wall-segment(ori=v,len=4)@1!7,1');
            expect(parseDirectives(text, palette)[0].anchor).toEqual({ tx: 7, ty: 1 });
            // ⛔ AND THE URL IS NOT A CHANNEL FOR IT — the writer emits nothing
            // and the reader refuses the key.
            const bar = writeGenerateParams('tickbudget=600', {
                seed: 6, biome: 'pre-sword', bounds: DEFAULT_BOUNDS, step: 0,
            });
            expect(new URLSearchParams(bar).get('directed')).toBeNull();
            expect(() => readGenerateParams(`?${bar}&directed=${text}`))
                .toThrow(/no longer a URL parameter/);
        });
});

describe('⛓⛓⛓ VERB 2 AT A CLICKED CELL — the template lands THERE, or refuses by name', () => {
    /**
     * ⛓⛓ THE SUBJECT IS MEASURED, AND IT MOVED AT ARC 3 SLICE 2 — BY THE SAME
     * SCAN THAT PICKED IT (trap 285: the target is named).
     *
     * Slice 6 measured pre-sword **seed 6**: the plain vertical door legal at
     * six cells — (2,1) (4,1) (5,1) (6,1) (7,1) (8,1) — with (7,1) neither the
     * searched answer nor the start nor the goal. The DOOR LAW leaves seed 6
     * with exactly **ONE** legal anchor, (2,1): its goal is at (3,1), so every
     * column east of 2 is a wall the walk goes ROUND (⚖ ruling 17). A one-anchor
     * subject cannot carry this block at all — the clicked cell would BE the
     * searched cell, and trap 235's whole point is that it must not be.
     *
     * ⛓⛓ RE-SCANNED AT SLICE 4c, and the block keeps SEED 9 while every number
     * in it moves. The directive is `wall-segment(ori=v,len=4)` now (the door
     * template it used retired), and a wall segment has no DOOR LAW narrowing
     * its legal set — so seed 9 offers **13 legal anchors**, not six.
     *
     * MEASURED, all 13 clicked: **(1,5) REVERTS** — the oracle refuses that
     * room, which is a working loop and not a bad cell, but it is not a subject
     * a row asserting `KEPT` can use — and the other twelve KEEP. A SEARCHED
     * directive lands on **(3,5)**. ⛔ The CLICK is **(8,4)**: it keeps, it is
     * not where the search goes, it is not the start (1,1) and it is not the
     * goal — seed 9's goal is **(2,6)** under the new draw.
     *
     * ⚠ THE BLOCK KEEPS ITS OWN SUBJECT rather than moving the file's `SUBJECT`:
     * seed 6 is what a dozen unrelated rows in this file are measured against,
     * and moving it would re-pick every one of them to fix two.
     */
    const CLICK_SUBJECT = Object.freeze({ seed: 9, biome: 'pre-sword', step: 0 });
    const CLICK = Object.freeze({ tx: 8, ty: 4 });
    const clicked = Object.freeze({ ...DIRECTIVE, anchor: CLICK, bound: 1 });

    it('⛓ the SUBJECT\'s own properties first — (8,4) is legal and is NOT where a search goes',
        () => {
            const base = generateStep(CLICK_SUBJECT);
            const template = paletteFor(CLICK_SUBJECT.biome).templates
                .find((t) => t.name === DIRECTIVE.template)
                .instantiate(null, DIRECTIVE.params);
            expect(base.model.refusalAt(base.record, template, CLICK.tx, CLICK.ty)).toBeNull();
            expect(base.model.goalCell).not.toEqual(CLICK);
            // ⛓ ARC 3 SLICE 2 — the property the re-pick was FOR, asserted so a
            // future law that narrows the legal set again reds HERE rather than
            // three rows down: the clicked cell is one of SEVERAL, not the only.
            // ⛓ ARC 3 SLICE 2 -> 4c: 6 -> 13. The subject is a `wall-segment`
            // now and no DOOR LAW narrows its legal set; the property the
            // assertion is FOR is unchanged — the clicked cell is one of
            // SEVERAL, not the only one — so a future law that narrows the set
            // again still reds HERE rather than three rows down.
            expect(base.model.interiorCells(base.record)
                .filter((c) => base.model.legalAt(base.record, template, c.tx, c.ty)))
                .toHaveLength(13);
            const searched = applyDirective(base, DIRECTIVE, 0).directives[0];
            expect(searched.at).not.toEqual(CLICK);
        });

    it('⛓⛓ lands at the CLICKED cell — the record, the directive and the FOOTPRINT agree',
        () => {
            const out = applyDirective(generateStep(CLICK_SUBJECT), clicked, 0);
            const [d] = out.directives;
            expect(d.outcome).toBe(ATTEMPT.KEPT);
            // `anchor` is what was ASKED FOR, `at` is where it LANDED — two
            // fields because a slice-6 directive has to be able to say whether
            // its cell was honoured.
            expect(d.anchor).toEqual(CLICK);
            expect(d.at).toEqual(CLICK);
            expect(d.anchorsOffered).toBe(1);
            expect(d.anchorsWalked).toBe(1);
            /**
             * ⛔ AND THE GEOMETRY REALLY MOVED. The vertical door's footprint
             * starts AT the anchor, so the terrain the record now holds at
             * (7,1) is the template's own — a directive that recorded the cell
             * and placed elsewhere passes every field check above.
             */
            expect(terrainAt(out.record, CLICK.tx, CLICK.ty))
                .not.toBe(terrainAt(generateStep(CLICK_SUBJECT).record, CLICK.tx, CLICK.ty));
        });

    it('⛔ an ILLEGAL cell refuses BY NAME, the record does NOT move, and no solve is spent',
        () => {
            const base = generateStep(CLICK_SUBJECT);
            // ⛓ (2,6) is seed 9's GOAL cell — measured, and asserted here so
            // this is the goal class rather than whatever else that cell might
            // be. (Was (3,1) on seed 6 and (8,5) before slice 4c's goal draw;
            // the CLASS the row grades is unchanged.)
            expect(base.model.goalCell).toEqual({ tx: 2, ty: 6 });
            const out = applyDirective(base, { ...clicked, anchor: { tx: 2, ty: 6 } }, 0);
            const [d] = out.directives;
            expect(d.outcome).toBe(ATTEMPT.ILLEGAL_PLACEMENT);
            expect(d.at).toBeNull();
            expect(out.record).toEqual(base.record);
            /**
             * ⛔ VERBATIM — the MODEL's own sentence, character for character,
             * not the page's paraphrase of it. Asked of the model directly here
             * so a row that summarised the refusal would red rather than pass a
             * substring match.
             */
            const template = paletteFor(CLICK_SUBJECT.biome).templates
                .find((t) => t.name === DIRECTIVE.template)
                .instantiate(null, DIRECTIVE.params);
            const rows = out.trace.filter((r) => r.directive === 1);
            expect(rows).toHaveLength(1);
            expect(rows[0].reasonText)
                .toBe(base.model.refusalAt(base.record, template, 2, 6));
            expect(rows[0].reasonText).toMatch(/\(2,6\) is the GOAL cell/);
            expect(rows[0].verdict).toBeNull();
        });

    it('⛓⛓ a clicked construction REPRODUCES byte for byte through the PAYLOAD', () => {
        const pressed = applyDirective(generateStep(CLICK_SUBJECT), clicked, 0);
        const search = writeGenerateParams('', {
            seed: pressed.seed, biome: pressed.biome, bounds: pressed.bounds,
            step: pressed.step,
        });
        const read = readGenerateParams(`?${search}`);
        const rebuilt = generateWithDirectives({
            seed: read.seed, biome: read.biome, step: stepFromParams(read),
            bounds: read.bounds, budget: read.budget, roster: read.roster,
            // ⛓ SLICE 12: the payload's list, not the bar's — and its `anchor`
            // is what carries the clicked cell across.
            directed: JSON.parse(JSON.stringify(pressed.directives)),
        });
        expect(rebuilt.record).toEqual(pressed.record);
        expect(rebuilt.trace).toEqual(pressed.trace);
        expect(rebuilt.directives).toEqual(pressed.directives);
        /**
         * ⛔ …AND IT IS A DIFFERENT LEVEL FROM THE SEARCHED ONE. Without this
         * the reproduction claim would hold over a build that ignored the
         * clicked cell entirely and searched — both sides would ignore it.
         */
        expect(rebuilt.record).not.toEqual(applyDirective(generateStep(SUBJECT), DIRECTIVE, 0)
            .record);
    });

    /**
     * ⚖ THE PREFERENCE IS MOOT AT ONE ANCHOR, AND THE READOUT SAYS SO BY NAME
     * rather than printing "no anchor within the bound" about a walk of one.
     */
    it('⛓ `describeKeptKind` names the MOOT preference on a clicked solved-only keep', () => {
        const searched = { outcome: 'KEPT', keptKind: KEPT_KIND.SOLVED_ONLY, anchor: null };
        const click = { outcome: 'KEPT', keptKind: KEPT_KIND.SOLVED_ONLY, anchor: CLICK };
        expect(describeKeptKind(searched)).toMatch(/no anchor within the bound/);
        expect(describeKeptKind(click)).toMatch(/discharge preference is MOOT/);
        expect(describeKeptKind(click)).not.toMatch(/no anchor within the bound/);
        // ⛔ the other two kinds read correctly at either bound and are unchanged
        expect(describeKeptKind({ outcome: 'KEPT', keptKind: KEPT_KIND.DISCHARGED, anchor: CLICK }))
            .toMatch(/kept:discharged/);
        expect(describeKeptKind({ outcome: 'KEPT', keptKind: KEPT_KIND.NO_VERB, anchor: CLICK }))
            .toMatch(/NO verb to discharge/);
    });

    it('⛔ a FIRST_SOLVED keep says nothing was ASKED — not that the family has no verb', () => {
        const out = describeKeptKind({ outcome: 'KEPT', keptKind: null, anchor: null });
        expect(out).toMatch(/nothing asked whether this solve DISCHARGES/);
        expect(out).not.toMatch(/NO verb to discharge/);
    });
});

describe('⛓ `stepFromParams` — ONE reader of the `run` + `count` encoding', () => {
    it('a skeleton link names step 0 even though `count` carries the form\'s target', () => {
        const search = writeGenerateParams('', {
            seed: 6, biome: 'pre-sword', bounds: DEFAULT_BOUNDS, step: 0,
        });
        const read = readGenerateParams(`?${search}`);
        expect(read.bounds.obstacleTarget).toBe(DEFAULT_BOUNDS.obstacleTarget);
        expect(read.run).toBe(false);
        // ⛔ …and the step it names is 0, NOT the target.
        expect(stepFromParams(read)).toBe(0);
    });

    it('a run link names the step it reached', () => {
        const search = writeGenerateParams('', {
            seed: 6, biome: 'pre-sword',
            bounds: { ...DEFAULT_BOUNDS, obstacleTarget: 2 }, step: 2,
        });
        expect(stepFromParams(readGenerateParams(`?${search}`))).toBe(2);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ `?skeleton=` ON THE SEEDLING PAGE — CONSTRUCTIVE-MODE SLICE 5
 * ══════════════════════════════════════════════════════════════════════ */

describe('watchGenerate — the skeleton kind', () => {
    const args = (over = {}) => ({
        seed: 3, biome: 'pre-sword', step: 0, bounds: DEFAULT_BOUNDS, ...over,
    });

    it('carries the kind onto every state, and defaults to the open room', () => {
        expect(generateStep(args()).skeleton).toEqual({ kind: 'empty' });
        /**
         * ⛓⛓ ARC 3, SLICE 4b — **THE STATE CARRIES THE EFFECTIVE ROOM, AND ON
         * A CARVED TREE KIND THAT NOW INCLUDES `chambers: 1`** (D6, ⚖ user
         * 2026-08-17). The page's own `?skeleton=` READER is unchanged; what
         * changed is what an OMITTED `chambers` resolves to on this substrate.
         * ⛔ The state's block is the CANONICAL spelling (default by absence),
         * so `chambers: 1` appears precisely because 1 is not the codec's
         * default — which is the same rule `minRoom=2` already followed.
         */
        expect(generateStep(args({ skeleton: { kind: 'winding' } })).skeleton)
            .toEqual({ kind: 'winding', params: { chambers: 1 } });
        /**
         * ⛔⛔ AND A TYPED 0 SURVIVES **ONTO THE STATE** — arc 3, slice 5a (D2).
         * ⛓ THIS ROW MOVED BECAUSE THE FEATURE SHIPPED (trap 356), and the
         * claim got STRONGER rather than looser: until 5a the state carried the
         * CANONICAL spelling, in which a typed 0 is spelled BY ABSENCE and is
         * therefore indistinguishable from an omitted `chambers` — the very
         * collision that made `?skeleton=winding;chambers=0` unspellable in a
         * link (4d §15.2). The state now carries the EFFECTIVE spec, so the two
         * are different objects and the row below says so.
         */
        expect(generateStep(args({ skeleton: { kind: 'winding', params: { chambers: 0 } } }))
            .skeleton).toEqual({ kind: 'winding', params: { chambers: 0 } });
        /**
         * ⚠ AT THE SMALLEST BOUNDS THE LOOP TAKES, and the reason is Probe 2's
         * measurement: a candidate that SEALS a corridor makes the planner run
         * to its cap before refusing, so a default-bounds rung on a `winding`
         * room costs ~10 s. The claim here is that the kind REACHES the loop,
         * which one try answers as well as eight; the yield table (slice 6) is
         * where the cost itself gets measured.
         */
        expect(generateStep(args({
            step: 1,
            skeleton: { kind: 'winding' },
            bounds: { ...DEFAULT_BOUNDS, triesPerStep: 1, saturationK: 1 },
        })).skeleton).toEqual({ kind: 'winding', params: { chambers: 1 } });
    });

    it('REFUSES a kind Seedling cannot build, by name, before any solve', () => {
        expect(() => generateStep(args({ skeleton: { kind: 'corridor' } })))
            .toThrow(/needs the maze simulator.*the Seedling binding offers/s);
    });

    /**
     * ⛔ THE VALUE IS CHECKED AGAINST A LITERAL THIS FILE STATES. A round trip
     * tests self-consistency and never correctness — a reader and a writer that
     * both said `windy` would agree forever.
     */
    it('reads and writes ?skeleton= — the literal value, and ABSENCE at the default', () => {
        expect(readGenerateParams('?source=generate&seed=3').skeleton).toEqual({ kind: 'empty' });
        /**
         * ⛓⛓⛓ SLICE 5a (D2) — THE READER RESOLVES SEEDLING'S OWN DEFAULT, so
         * an omitted `chambers` comes back as the 1 the room is actually carved
         * at, and a TYPED 0 comes back as 0. ⛔ Both literals are stated here;
         * the fixed point below is asserted only after them (trap 250).
         */
        expect(readGenerateParams('?source=generate&skeleton=winding').skeleton)
            .toEqual({ kind: 'winding', params: { chambers: 1 } });
        expect(readGenerateParams('?source=generate&skeleton=winding;chambers=0').skeleton)
            .toEqual({ kind: 'winding', params: { chambers: 0 } });
        const written = writeGenerateParams('', {
            seed: 3, biome: 'pre-sword', bounds: DEFAULT_BOUNDS, step: 0,
            skeleton: { kind: 'winding', params: { chambers: 1 } },
        });
        expect(written).toContain('skeleton=winding%3Bchambers%3D1');
        /** ⛔ THE TYPED 0 IS SPELLED, which is the whole of D2: before it, this
         *  writer emitted a bare `winding` and the reader gave back 1. */
        expect(writeGenerateParams('', {
            seed: 3, biome: 'pre-sword', bounds: DEFAULT_BOUNDS, step: 0,
            skeleton: { kind: 'winding', params: { chambers: 0 } },
        })).toContain('skeleton=winding%3Bchambers%3D0');
        expect(writeGenerateParams('', {
            seed: 3, biome: 'pre-sword', bounds: DEFAULT_BOUNDS, step: 0,
        })).not.toContain('skeleton');
    });

    it('a ?skeleton= the page cannot build REFUSES at READ time, with the offer list', () => {
        expect(() => readGenerateParams('?source=generate&skeleton=classic'))
            .toThrow(/\?skeleton="classic".*the Seedling page offers/s);
        expect(() => readGenerateParams('?source=generate&skeleton=spiral'))
            .toThrow(/is not a skeleton kind/);
    });

    /** ⛓ The fixed point, AFTER the independent value check above. */
    it('round-trips: what the writer wrote, the reader reads back', () => {
        const url = writeGenerateParams('', {
            seed: 7, biome: 'post-sword', bounds: DEFAULT_BOUNDS, step: 2,
            skeleton: { kind: 'rooms' },
        });
        expect(readGenerateParams(`?${url}`).skeleton).toEqual({ kind: 'rooms' });
    });

    /**
     * ⚖ GENERATE-UI §13.3 item 12's expected behaviour, arriving: an OLD
     * payload spelling `empty-bordered` names a skeleton this page does not
     * build, and the check says WHICH FIELD disagreed rather than reporting an
     * unexplained level difference.
     */
    it('an old `empty-bordered` payload DIVERGES BY NAME rather than silently', () => {
        const s = generateStep(args({ step: 1 }));
        const old = {
            seed: s.seed, biome: s.biome, roster: s.roster, directives: s.directives,
            skeleton: { kind: 'empty-bordered' }, level: s.record, trace: s.trace,
        };
        const check = agreementWithPayload(old, s);
        expect(check.differences).toContain('skeleton');
        expect(check.agrees).toBe(false);
    });

    /**
     * ⛔ THE IDENTITY LINE NAMES THE KIND ONLY WHEN IT IS NOT THE OPEN ROOM. A
     * clause on every level trains a reader to skip it.
     */
    it('names the kind in the identity line — and only when it is carved', () => {
        expect(describeState(generateStep(args()))).not.toMatch(/skeleton: /);
        /** ⛓ SLICE 4b — the line prints the EFFECTIVE spec, which on a carved
         *  tree kind carries Seedling's own `chambers` default. */
        const line = describeState(generateStep(args({ skeleton: { kind: 'winding' } })));
        expect(line).toMatch(/skeleton: winding;chambers=1 \(CARVED, not the open room\)/);
        expect(line).toMatch(/the SKELETON — a winding;chambers=1 CARVE and its goal/);
        /**
         * ⛓⛓ SLICE 5a (D2) — the line spells the typed 0 too, because the page
         * prints what the BAR says and the bar now carries it. ⛔ A line that
         * said `winding` beside a link saying `winding;chambers=0` would be two
         * answers to *which room is this*.
         */
        const zero = describeState(generateStep(args({
            skeleton: { kind: 'winding', params: { chambers: 0 } } })));
        expect(zero).toMatch(/skeleton: winding;chambers=0 \(CARVED, not the open room\)/);
    });

    it('offers the catalogue with the two simulator-bound kinds GREYED and reasoned', () => {
        const rows = skeletonCatalogue({ simulator: false });
        expect(rows.find((r) => r.kind === 'corridor').offered).toBe(false);
        expect(rows.find((r) => r.kind === 'corridor').why).toMatch(/maze simulator/);
        expect(rows.find((r) => r.kind === 'empty').isDefault).toBe(true);
        expect(rows.filter((r) => r.offered).map((r) => r.kind))
            .toEqual(['empty', 'branchy', 'bushy', 'loopy', 'open', 'rooms', 'winding']);
    });

    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ SLICE 7 — THE KIND PARAMETERS ON THIS PAGE
     * ══════════════════════════════════════════════════════════════════ */

    it('READS a `;` clause to the expected OBJECT and WRITES the expected STRING', () => {
        expect(readGenerateParams('?source=generate&skeleton=rooms;minRoom=2').skeleton)
            .toEqual({ kind: 'rooms', params: { minRoom: 2 } });
        expect(readGenerateParams('?source=generate&skeleton=winding;chambers=2').skeleton)
            .toEqual({ kind: 'winding', params: { chambers: 2 } });
        const written = writeGenerateParams('', {
            seed: 3, biome: 'pre-sword', bounds: DEFAULT_BOUNDS, step: 0,
            skeleton: { kind: 'rooms', params: { minRoom: 2, chambers: 1 } },
        });
        expect(new URLSearchParams(written).get('skeleton'))
            .toBe('rooms;minRoom=2;chambers=1');
        // ⛔ a value AT its default is not written
        expect(new URLSearchParams(writeGenerateParams('', {
            seed: 3, biome: 'pre-sword', bounds: DEFAULT_BOUNDS, step: 0,
            skeleton: { kind: 'rooms', params: { minRoom: 3 } },
        })).get('skeleton')).toBe('rooms');
        // ⛓ the fixed point, AFTER the two literals
        expect(readGenerateParams(`?source=generate&${written}`).skeleton)
            .toEqual({ kind: 'rooms', params: { minRoom: 2, chambers: 1 } });
    });

    /**
     * ⛓⛓ A VALUE CLAIM, NOT AN ECHO (trap 269) — the parameter must change the
     * ROOM. The subject is the count of `ground` cells in step 0's record,
     * counted here.
     */
    it('`chambers=2` opens more GROUND than `chambers=0`; and OMITTED is `chambers=1` '
        + 'on this substrate', () => {
        const ground = (st) => interiorCells(st.record)
            .filter((c) => terrainAt(st.record, c.tx, c.ty) === 'ground').length;
        /**
         * ⛔⛔ ARC 3, SLICE 4b — **THE BASELINE OF THIS VALUE CLAIM MOVED, AND
         * IT IS THE CLAIM'S SUBJECT THAT MOVED RATHER THAN ITS TRUTH.** The row
         * asked "does `chambers` change the ROOM", against a bare `{kind}` that
         * used to mean `chambers = 0`. Seedling now resolves an OMITTED
         * `chambers` to 1, so the un-stamped room is `{chambers: 0}` and that
         * is what a monotone claim has to compare against. ⛓ The claim is
         * strictly STRONGER now: it names three points on the ladder, not two.
         */
        const at = (seed, params) => ground(generateStep(args({ seed,
            skeleton: { kind: 'winding', ...(params ? { params } : {}) } })));
        /**
         * ⚠ MONOTONE OVER THE LADDER, STRICT SOMEWHERE — and the weaker
         * quantifier is MEASURED, not defensive. `chambers` stamps k squares at
         * drawn centres; a second stamp can land where the first already opened
         * ground, so `k = 2` is not strictly wider than `k = 1` at every seed
         * (seed 3 is exactly that cell: 23 ground cells at both). The claim the
         * knob supports is a ladder that never goes DOWN and does go UP.
         */
        let strictlyWider = 0;
        for (let seed = 1; seed <= 8; seed += 1) {
            expect(at(seed, { chambers: 0 }), `seed ${seed}`)
                .toBeLessThanOrEqual(at(seed, undefined));
            expect(at(seed, undefined)).toBeLessThanOrEqual(at(seed, { chambers: 2 }));
            if (at(seed, { chambers: 2 }) > at(seed, undefined)) strictlyWider += 1;
        }
        expect(strictlyWider).toBeGreaterThan(0);
        expect(at(3, undefined)).toBeGreaterThan(at(3, { chambers: 0 }));
        const omitted = generateStep(args({ skeleton: { kind: 'winding' } }));
        /** ⛔ AND OMITTED IS EXACTLY `chambers: 1` — byte for byte, not merely
         *  "more ground". That is the D6 default's own value claim. */
        expect(JSON.stringify(omitted.record)).toBe(JSON.stringify(generateStep(args({
            skeleton: { kind: 'winding', params: { chambers: 1 } },
        })).record));
    });

    it('names the non-default PARAMETERS in the identity line, and only those', () => {
        const line = describeState(generateStep(args({
            skeleton: { kind: 'rooms', params: { minRoom: 2, chambers: 1 } },
        })));
        expect(line).toMatch(/skeleton: rooms;minRoom=2;chambers=1 \(CARVED/);
        expect(describeState(generateStep(args({
            skeleton: { kind: 'rooms', params: { minRoom: 3 } },
        })))).toMatch(/skeleton: rooms \(CARVED/);
    });

    it('the state carries the NORMALIZED block, so a defaults-spelling payload agrees', () => {
        const st = generateStep(args({
            step: 1, skeleton: { kind: 'rooms', params: { minRoom: 3 } },
        }));
        expect(st.skeleton).toEqual({ kind: 'rooms' });
        const check = agreementWithPayload({
            seed: st.seed, biome: st.biome, bounds: st.bounds, budget: st.budget,
            roster: st.roster ?? null, directives: st.directives ?? [],
            skeleton: { kind: 'rooms', params: { minRoom: 3, chambers: 0 } },
            level: st.record, trace: st.trace,
        }, st);
        expect(check.differences).not.toContain('skeleton');
    });

    it('REFUSES an undeclared key and an out-of-domain value at READ time', () => {
        expect(() => readGenerateParams('?source=generate&skeleton=winding;minRoom=2'))
            .toThrow(/"winding" has no parameter "minRoom"/);
        expect(() => readGenerateParams('?source=generate&skeleton=rooms;minRoom=9'))
            .toThrow(/declared domain \[2, 3, 4\]/);
    });

    it('the CATALOGUE carries each kind\'s schema, for this page\'s form', () => {
        const rows = skeletonCatalogue({ simulator: false });
        expect(rows.find((r) => r.kind === 'rooms').params.map((p) => p.key))
            .toEqual(['minRoom', 'chambers']);
        expect(rows.find((r) => r.kind === 'bushy').params.map((p) => p.key))
            .toEqual(['prune', 'chambers']);
        expect(rows.find((r) => r.kind === 'empty').params).toEqual([]);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ CONSTRUCTIVE-MODE SLICE 11 — FREE EDITING'S HALF OF THIS FILE
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ the EDIT LIST is on every state, like the directives', () => {
    it('the skeleton and a ladder rung both carry an EMPTY list, never absent', () => {
        for (const step of [0, 1]) {
            const st = generateStep({ seed: 3, biome: 'pre-sword', step });
            expect(st.edits).toEqual([]);
            expect(Object.isFrozen(st.edits)).toBe(true);
        }
    });

    /**
     * ⛔ ⚖ RULING 9, AS A BYTE COMPARISON. The URL writer must not learn about
     * edits — so the bar a page writes for an edited level is CHARACTER FOR
     * CHARACTER the bar it writes for the recipe. A writer that quietly gained
     * an `?edits=` would redden here rather than in a prose review.
     */
    it('⛔⛔ the URL writer produces the SAME STRING with edits and without', () => {
        const st = generateStep({ seed: 3, biome: 'pre-sword', step: 1 });
        const edited = editStates(st, [{ op: 'paint', tx: 5, ty: 5, terrain: 'wall' }]);
        const args = (s) => ({
            seed: s.seed, biome: s.biome, bounds: s.bounds, skeleton: s.skeleton,
            roster: s.roster, directives: s.directives, step: s.step,
        });
        expect(writeGenerateParams('', args(edited))).toBe(writeGenerateParams('', args(st)));
        expect(writeGenerateParams('', args(edited))).not.toMatch(/edit/i);
    });
});

describe('⛓⛓⛓ describeState — the identity\'s THIRD LEG, and the URL clause', () => {
    const st = () => generateStep({ seed: 3, biome: 'pre-sword', step: 1 });

    it('says nothing about edits when there are none', () => {
        const line = describeState(st());
        expect(line).not.toMatch(/manual edit/);
        expect(line).not.toMatch(/NOT a reproduction/);
    });

    it('⛓ names the count, in order, AFTER the directed attempts', () => {
        const line = describeState(editStates(st(), [
            { op: 'paint', tx: 5, ty: 5, terrain: 'wall' },
            { op: 'paint', tx: 6, ty: 5, terrain: 'wall' },
        ]));
        expect(line).toMatch(/step 1, then 2 manual edit\(s\)/);
    });

    it('⛔ …and SAYS the URL has stopped being a reproduction', () => {
        const line = describeState(editStates(st(),
            [{ op: 'paint', tx: 5, ty: 5, terrain: 'wall' }]));
        // ⛓ SLICE 12 widened the CONDITION (a directive triggers it too) and
        // dropped "after edits" from the wording, because either leg can now be
        // the one the bar is missing.
        expect(line).toMatch(
            /the URL is NOT a reproduction of this construction — it names the LADDER alone/);
    });
});

describe('⛓⛓⛓ agreementWithPayload — the EDITS are an identity field', () => {
    const OPS = [
        { op: 'paint', tx: 5, ty: 5, terrain: 'wall' },
        { op: 'place', tx: 4, ty: 6, type: 'pushableblock', attrs: {} },
    ];
    const edited = () => generateWithDirectives(
        { seed: 3, biome: 'pre-sword', step: 1, edits: OPS });
    const payloadOf = (s) => ({
        seed: s.seed, biome: s.biome, bounds: s.bounds, budget: s.budget,
        roster: s.roster ?? null, directives: s.directives ?? [], edits: s.edits ?? [],
        skeleton: s.skeleton, level: s.record, trace: s.trace,
    });

    it('an EDITED payload reproduced WITH its edits agrees byte for byte', () => {
        const st = edited();
        const check = agreementWithPayload(payloadOf(st), st);
        expect(check.agrees).toBe(true);
        expect(check.differences).toEqual([]);
    });

    /**
     * ⛓⛓⛓ THE MUTANT-VISIBLE ROW. A page that fetched an edited payload and
     * did NOT replay its edits reproduces the RECIPE, so the check must report
     * BOTH `edits` (which list) and `level` (which room) — a level divergence
     * alone would leave a reader hunting a 100-tile grid for a difference the
     * page already knew the cause of.
     */
    it('⛔ …and one reproduced WITHOUT them reports `edits` AND `level`, by name', () => {
        const st = edited();
        const unedited = generateStep({ seed: 3, biome: 'pre-sword', step: 1 });
        const check = agreementWithPayload(payloadOf(st), unedited);
        expect(check.agrees).toBe(false);
        expect(check.differences).toContain('edits');
        expect(check.differences).toContain('level');
    });

    it('⚠ an OLD payload naming no edits does not falsely diverge', () => {
        const st = generateStep({ seed: 3, biome: 'pre-sword', step: 1 });
        const old = payloadOf(st);
        delete old.edits;
        expect(agreementWithPayload(old, st).differences).not.toContain('edits');
    });

    /**
     * ⚠ CERTIFICATION IS NOT IDENTITY. A payload's own `certified: true` is
     * somebody else's assertion about a room this page has not solved, so the
     * comparison must not read it — the maze row's claim 7, one substrate over.
     */
    it('⛔ `certified` is NOT compared — a loaded level is uncertified either way', () => {
        const st = edited();
        const check = agreementWithPayload({ ...payloadOf(st), certified: true }, st);
        expect(check.agrees).toBe(true);
    });
});

describe('⛓⛓⛓ THE ORDERING RULE — edits come AFTER all directives', () => {
    /**
     * ⛔ THE STRUCTURAL BACKSTOP, not the page's friendlier note. The payload
     * carries `directives` and `edits` as two flat lists, which mean exactly
     * one construction only because the order is fixed — so a directive onto an
     * edited state has to refuse HERE, where the CLI, the tests and the page
     * all pass through.
     */
    it('applyDirective REFUSES on an edited state, and names the way out', () => {
        const st = editStates(generateStep({ seed: 6, biome: 'pre-sword', step: 0 }),
            [{ op: 'paint', tx: 5, ty: 5, terrain: 'wall' }]);
        expect(() => applyDirective(st, { template: 'wall-segment', params: {} }, 0))
            .toThrow(/UNDO the edits, or download the payload first/);
        expect(() => applyDirective(st, { template: 'wall-segment', params: {} }, 0))
            .toThrow(/ladder → directives → edits/);
    });

    it('…and the same directive on the UNEDITED state is fine', () => {
        const st = generateStep({ seed: 6, biome: 'pre-sword', step: 0 });
        expect(() => applyDirective(st, { template: 'wall-segment', params: {} }, 0))
            .not.toThrow();
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ PROCGEN ELEMENTS ARC 3, SLICE 5a (D1) — `?elements=`, `?areas=`,
 * `?require=` ON THE SEEDLING PAGE
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛔ EVERY VALUE BELOW IS A LITERAL THIS FILE STATES, and the two round-trip
 * rows come AFTER them (trap 250: a fixed point tests self-consistency and
 * never correctness).
 */
describe('watchGenerate — the three parameters (arc 3, slice 5a)', () => {
    const read = (search) => readGenerateParams(`?source=generate&seed=1&${search}`);

    /**
     * ⛓⛓⛓ THE ONE DISTINCTION THE WHOLE FEATURE RESTS ON. `seedlingSeam` reads
     * `elements === undefined` as *nobody said* and applies the BIOME DEFAULT
     * (4c §13.3); an explicit `{name:'none'}` is a CHOICE it honours. A reader
     * that collapsed the two would turn the default off on every load.
     */
    it('⛔ ABSENT `?elements=` is `undefined` — NOT `{name:"none"}`', () => {
        expect(read('').elements).toBe(undefined);
        expect(read('elements=none').elements).toEqual({ name: 'none' });
        expect(read('elements=killgate').elements).toEqual({ name: 'killgate' });
    });

    /**
     * ⚠ A NAMED PARAMETER AT ITS DEFAULT IS KEPT — arc-2 §11.5's law: a named
     * parameter is an override that spends NO draw and an omitted one is DRAWN,
     * so `guard` and `guard;len=2` are different runs even when `len` resolves
     * to 2 in both.
     */
    it('⛓ a NAMED parameter at its default survives the read — it is not tidied', () => {
        expect(read('elements=guard').elements).toEqual({ name: 'guard' });
        expect(read('elements=guard;len=2').elements).toEqual({ name: 'guard', params: { len: 2 } });
    });

    it('⛓ `?areas=` and `?require=` — absence, and the EMPTY directive refuses', () => {
        expect(read('').areas).toEqual({ keys: 0 });
        expect(read('areas=1').areas).toEqual({ keys: 1 });
        expect(read('').require).toBe(null);
        expect(read('require=hasSword').require).toEqual(['hasSword']);
        /** ⛔ A directive somebody EMPTIED is not the same as no directive. */
        expect(() => read('require=')).toThrow(/an EMPTY `require` list/);
    });

    /**
     * ⛓⛓⛓ **THE VALUE CLAIM** (trap 269) — the parameter reaches the MODEL, not
     * just the state: `?elements=killgate` on a post-sword biome puts a kill
     * gate at the very cell `generate-seedling-level.mjs` puts it at, and the
     * bare default at the same seed does not.
     */
    /**
     * ⚠ THE SUBJECT IS SCANNED, NOT PICKED: `killgate` must actually be PLACED
     * (not dropped by its certification) for the door cell to exist. Scanned,
     * post-sword, step 0, seeds 1..5 — **only seed 2 places**; the other four
     * come back `the-skeleton-does-not-solve-with-the-element`, which is the
     * arc's published rate and not this row's business.
     */
    it('⛔ `?elements=killgate` reaches the MODEL — the door cell, not an echo', () => {
        const p = read('biome=post-sword&elements=killgate');
        const st = generateStep({ seed: 2, biome: 'post-sword', step: 0, elements: p.elements });
        expect(st.elements.spec).toEqual({ name: 'killgate' });
        expect(st.elements.ran).toBe(true);
        expect(st.elements.placed[0].phase).toBe('on-connector');
        /** ⛓ THE ANCHOR IS THE SEAM'S OWN ANSWER FOR THE SAME ARGUMENTS — two
         *  callers of one resolver, never a literal cell this file invents. */
        const cli = seedlingSeam({
            seed: 2, items: paletteFor('post-sword').items, elements: { name: 'killgate' },
        });
        expect(st.elements.placed[0].doorCell).toEqual(cli.model.elements.placed[0].doorCell);
        /** ⛔ AND THE BARE DEFAULT AT THE SAME SEED IS A DIFFERENT RUN — a page
         *  that echoed the parameter without passing it would pass every row
         *  above and fail this one. */
        const bare = generateStep({ seed: 2, biome: 'post-sword', step: 0 });
        expect(bare.elements.spec).not.toEqual({ name: 'killgate' });
    });

    it('⛓ `?require=hasSword` reaches the seam — it FORCES the head, by name', () => {
        const st = generateStep({
            seed: 1, biome: 'post-sword', step: 0, require: read('require=hasSword').require,
        });
        expect(st.require.asked).toEqual(['hasSword']);
        expect(st.require.forced).toBe(true);
        expect(st.elements.spec).toEqual({ name: 'killgate' });
        /** ⛔ AND A BIOME THAT CANNOT GRANT IT REFUSES **BY NAME**, with the
         *  level still built (arc-1's law, and the CLI's exit 6). */
        const pre = generateStep({ seed: 1, biome: 'pre-sword', step: 0, require: ['hasSword'] });
        expect(pre.require.refused.reason).toBe('the-biome-lacks-the-item');
        expect(pre.record).toBeTruthy();
    });

    it('⛔ the three blocks are `null` when nobody asked — never `{}`', () => {
        const st = generateStep({ seed: 1, biome: 'pre-sword', step: 0, elements: { name: 'none' } });
        expect(st.elements).toBe(null);
        expect(st.areas).toBe(null);
        expect(st.require).toBe(null);
    });

    /**
     * ⛔ THE WRITER — and the one asymmetry that is Seedling's own: `none` is
     * WRITTEN here, where the maze deletes it, because absence means the BIOME
     * DEFAULT on this substrate and `none` means *turn it off*.
     */
    it('⛓⛓ the writer spells all three — and `none` is a VALUE, not an absence', () => {
        const write = (o) => new URLSearchParams(writeGenerateParams('', {
            seed: 1, biome: 'pre-sword', bounds: DEFAULT_BOUNDS, step: 0, ...o,
        }));
        expect(write({}).get('elements')).toBe(null);
        expect(write({ elements: { name: 'none' } }).get('elements')).toBe('none');
        expect(write({ elements: { name: 'guard', params: { len: 3 } } }).get('elements'))
            .toBe('guard;len=3');
        expect(write({}).get('areas')).toBe(null);
        expect(write({ areas: { keys: 2 } }).get('areas')).toBe('2');
        expect(write({}).get('require')).toBe(null);
        expect(write({ require: ['hasSword'] }).get('require')).toBe('hasSword');
    });

    /** ⛓ THE FIXED POINT, AFTER the literals above. */
    it('⛓ round-trips: what the writer wrote, the reader reads back', () => {
        for (const asked of [{}, { elements: { name: 'none' } },
            { elements: { name: 'guard', params: { len: 2 } } },
            { elements: { name: 'killgate' }, areas: { keys: 1 } },
            { require: ['hasSword'], areas: { keys: 2 } }]) {
            const url = writeGenerateParams('', {
                seed: 1, biome: 'post-sword', bounds: DEFAULT_BOUNDS, step: 0, ...asked,
            });
            const back = readGenerateParams(`?${url}`);
            expect(back.elements).toEqual(asked.elements);
            expect(back.areas).toEqual(asked.areas ?? { keys: 0 });
            expect(back.require).toEqual(asked.require ?? null);
            /** ⛔ AND IT IS A FIXED POINT OF THE WRITER TOO — a delete-then-set
             *  that appended a key would round-trip once and move the bar on
             *  the next load (trap 245). */
            expect(writeGenerateParams(`?${url}`, {
                seed: 1, biome: 'post-sword', bounds: DEFAULT_BOUNDS, step: 0, ...asked,
            })).toBe(url);
        }
    });

    /**
     * ⛓⛓ `?gen=` — the three are IDENTITY fields, each in ITS OWN SPELLING.
     * ⛔ `elements.spec` is the normalized OBJECT and `areas.spec` is ALREADY A
     * STRING (arc-2 §11.5's *"a REPORT, not a SPEC"*, which this slice reads
     * rather than fixes because unifying them would move every payload).
     */
    it('⛓⛓ agreementWithPayload compares the three, in the shapes the payload carries', () => {
        const st = generateStep({
            seed: 1, biome: 'post-sword', step: 1, elements: { name: 'killgate' },
        });
        const good = {
            seed: st.seed, biome: st.biome, roster: st.roster, directives: st.directives,
            skeleton: st.skeleton, level: st.record, trace: st.trace,
            summary: { elements: { spec: st.elements.spec } },
        };
        expect(agreementWithPayload(good, st).differences).not.toContain('elements');
        const wrong = { ...good, summary: { elements: { spec: { name: 'blockpocket' } } } };
        expect(agreementWithPayload(wrong, st).differences).toContain('elements');
        /** ⛓ THE AREA SPEC IS COMPARED AS THE STRING IT IS REPORTED AS. */
        const withAreas = generateStep({
            seed: 1, biome: 'post-sword', step: 1, elements: { name: 'killgate' },
            areas: { keys: 1 },
        });
        expect(withAreas.areas.spec).toBe('1');
        const areaPayload = {
            seed: withAreas.seed, biome: withAreas.biome, roster: withAreas.roster,
            directives: withAreas.directives, skeleton: withAreas.skeleton,
            level: withAreas.record, trace: withAreas.trace,
            summary: { elements: { spec: withAreas.elements.spec }, areas: { spec: '1' } },
        };
        expect(agreementWithPayload(areaPayload, withAreas).differences).not.toContain('areas');
        expect(agreementWithPayload({ ...areaPayload,
            summary: { ...areaPayload.summary, areas: { spec: '2' } } }, withAreas)
            .differences).toContain('areas');
    });

    /**
     * ⚠ A PAYLOAD WITH NO `summary` AT ALL MAKES NO CLAIM — that is a hand-built
     * or step-0 file, not a run in which the element did not happen. A payload
     * that HAS a summary and no `elements` block is the second case, and it is
     * named.
     */
    it('⚠ an OLD payload does not falsely diverge — and a pre-4c one is NAMED', () => {
        const st = generateStep({ seed: 1, biome: 'pre-sword', step: 1 });
        const bare = {
            seed: st.seed, biome: st.biome, roster: st.roster, directives: st.directives,
            skeleton: st.skeleton, level: st.record, trace: st.trace,
        };
        expect(agreementWithPayload(bare, st).differences).toEqual([]);
        const pre4c = { ...bare, summary: { keptCount: 1 } };
        expect(agreementWithPayload(pre4c, st).differences.join(' '))
            .toMatch(/elements \(the payload predates the biome DEFAULT element spec/);
    });
});
