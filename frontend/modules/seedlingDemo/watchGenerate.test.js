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
    readGenerateParams, stepFromParams, tileAtPoint, writeGenerateParams,
} from './watchGenerate.js';
import { atlasOf, terrainAt } from './procgenLevel.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { solveForPage } from './watchSolve.js';
import { ATTEMPT, DEFAULT_BOUNDS, KEEP_POLICY, KEPT_KIND, STOP } from './levelGenerator.js';
import { PRE_SWORD_PALETTE, POST_SWORD_PALETTE } from './procgenPalette.js';
import { generateSeedlingLevel, seedlingModel } from './procgenSeedling.js';

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
    it('is the bordered room with the goal and nothing else', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 0 });
        expect(s.trace).toEqual([]);
        expect(s.summary).toBeNull();
        expect(s.record.entities).toHaveLength(1);
        expect(s.record.entities[0].type).toBe('torchpickup');
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
            const s = generateStep({
                seed: 5,
                biome: 'pre-sword',
                step: 6,
                bounds: { anchorTriesPerCandidate: 3 },
            });
            const rows = generationRows(s.trace);
            const walked = rows.filter((r) => r.anchorsOffered > 1 && r.anchorTry > 1);
            expect(walked.length, 'seed 5 must WALK for this case to mean anything')
                .toBeGreaterThan(0);
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
     * every seed→level pair, ⚖ ruling 5). At these bounds over seeds 1..10 the
     * split is now **3, 6 and 9 REACH the target and the other seven
     * SATURATE** — it used to be 4 and 7 that reached. Seed 1 is still on the
     * saturating side (kept 3 of 6), so the subject SURVIVES its own
     * re-measurement rather than being kept on the old measurement's word.
     */
    it('a rung that keeps fewer than it asked for is SATURATED, and says which', () => {
        const s = generateStep({
            seed: 1,
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
        expect(readGenerateParams('?biome=pre-sword&families=weigh,water,weigh').roster)
            .toEqual({ axis: 'families', names: ['water', 'weigh'] });
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
        // ⚠ …and the SAME name is legal in the other biome, which is why this
        // is validated against the BIOME'S palette and not a global list.
        expect(readGenerateParams('?biome=post-sword&families=kill').roster)
            .toEqual({ axis: 'families', names: ['kill'] });
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
    const roster = { axis: 'families', names: ['water', 'weigh'] };

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
     * ⛓ THE SUBJECT, MEASURED (the same one `procgenPalette.test.js` drives
     * end to end): pre-sword seed 3 at target 2 keeps `pit-patch` and
     * `arrow-lane` unrestricted, and `water-pool` + `wall-gap-lock-weigh`
     * under `families:water,weigh`. ⛔ The two kept lists are DISJOINT, which
     * is what makes a restriction the loop ignored visible here rather than
     * only in a hash.
     */
    const ROSTER = { axis: 'families', names: ['water', 'weigh'] };
    const at = (roster) => generateStep({
        seed: 3, biome: 'pre-sword', step: 2, bounds: { obstacleTarget: 2 }, roster,
    });

    it('the state carries the roster and the DERIVED palette name', () => {
        const s = at(ROSTER);
        expect(s.roster).toEqual(ROSTER);
        expect(s.palette.name).toBe('pre-sword[families:water,weigh]');
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
        expect(describeState(at(ROSTER))).toMatch(/palette: pre-sword\[families:water,weigh\]/);
        expect(describeState(at(null))).toMatch(/palette: pre-sword \(the WHOLE roster/);
    });

    it('⛔ REFUSES an empty restriction before the loop ever sees it', () => {
        expect(() => at({ axis: 'families', names: [] })).toThrow(/EMPTY restriction/);
    });

    it('the SKELETON is the same room under a restriction — it holds no template', () => {
        const a = generateStep({ seed: 3, biome: 'pre-sword', step: 0, roster: ROSTER });
        const b = generateStep({ seed: 3, biome: 'pre-sword', step: 0 });
        expect(json(a.record)).toBe(json(b.record));
        // ⚠ …and it still SAYS which roster it would draw from, because the
        // next press is the one that spends it.
        expect(a.palette.name).toBe('pre-sword[families:water,weigh]');
    });
});

describe('agreementWithPayload — the roster is an IDENTITY field', () => {
    const ROSTER = { axis: 'families', names: ['water', 'weigh'] };
    const state = generateStep({
        seed: 3, biome: 'pre-sword', step: 2, bounds: { obstacleTarget: 2 }, roster: ROSTER,
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
            seed: 3, biome: 'pre-sword', step: 2, bounds: { obstacleTarget: 2 },
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
            seed: 3, biome: 'pre-sword', step: 2, bounds: { obstacleTarget: 2 },
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
 * §12): `wall-gap-block(ori=v,gap=1)` on the pre-sword SKELETON at seed 6
 * SOLVES at anchor 1 and DISCHARGES only at anchor 6 of 6.
 *
 * ⚠ IT DISCRIMINATES ON BOTH CLAIMS AT ONCE, which is why it is this one:
 *   · the POLICY claim — first-SOLVED keeps anchor 1, prefer-discharge keeps
 *     anchor 6, so a build that ignored discharge lands somewhere else;
 *   · the PARAMS claim — `ori=v,gap=1` differs from the base's DEFAULT
 *     instance (`ori=h,gap=4`) in BOTH parameters, so a URL that dropped its
 *     params rebuilds a visibly different instance. ⛔ Trap 235's shape: a
 *     subject that agreed with its own fallback could not fail.
 */
const SUBJECT = Object.freeze({ seed: 6, biome: 'pre-sword', step: 0 });
const DIRECTIVE = Object.freeze({
    template: 'wall-gap-block',
    params: Object.freeze({ ori: 'v', gap: 1 }),
    anchor: null,
    keepPolicy: KEEP_POLICY.PREFER_DISCHARGE,
    bound: DIRECTED_ANCHOR_TRIES,
});

describe('⛓⛓ `?directed=` — the grammar, and it is the instance label', () => {
    const palette = paletteFor('pre-sword');

    it('round-trips a directive through parse and format', () => {
        const text = 'wall-gap-block(ori=v,gap=1)@12d';
        const [d] = parseDirectives(text, palette);
        expect(d.template).toBe('wall-gap-block');
        expect(d.params).toEqual({ ori: 'v', gap: 1 });
        expect(d.keepPolicy).toBe(KEEP_POLICY.PREFER_DISCHARGE);
        expect(d.bound).toBe(12);
        expect(d.anchor).toBeNull();
        expect(formatDirectives([d], palette)).toBe(text);
    });

    it('⚠ TYPES COME FROM THE SCHEMA: `gap=1` is the NUMBER 1, `ori=v` a string', () => {
        const [d] = parseDirectives('wall-gap-block(ori=v,gap=1)@12d', palette);
        expect(d.params.gap).toBe(1);
        expect(d.params.gap).not.toBe('1');
        expect(d.params.ori).toBe('v');
    });

    it('a ZERO-parameter template has no clause at all — its label IS its name', () => {
        const [d] = parseDirectives('arrow-lane@12d', palette);
        expect(d.template).toBe('arrow-lane');
        expect(d.params).toEqual({});
        expect(formatDirectives([d], palette)).toBe('arrow-lane@12d');
    });

    it('carries several directives in ORDER', () => {
        const text = 'water-pool(w=1,h=3)@12d;arrow-lane@4s;wall-segment(ori=v,len=5)@12d';
        const ds = parseDirectives(text, palette);
        expect(ds.map((d) => d.template))
            .toEqual(['water-pool', 'arrow-lane', 'wall-segment']);
        expect(ds[1].keepPolicy).toBe(KEEP_POLICY.FIRST_SOLVED);
        expect(ds[1].bound).toBe(4);
        expect(formatDirectives(ds, palette)).toBe(text);
    });

    it('⛓ SLICE 6\'s ANCHOR SUFFIX already parses and round-trips', () => {
        const text = 'wall-segment(ori=h,len=2)@1s!4,6';
        const [d] = parseDirectives(text, palette);
        expect(d.anchor).toEqual({ tx: 4, ty: 6 });
        expect(formatDirectives([d], palette)).toBe(text);
    });

    it('⛓ THE CLAUSE IS WRITTEN IN SCHEMA ORDER, whatever order the values came in',
        () => {
            // ⛔ The fixed point depends on this: a value DRAWN by an "any"
            // choice and one typed into the form must spell identically, or the
            // second load of a copied link would rewrite the bar.
            const backwards = { ...DIRECTIVE, params: { gap: 1, ori: 'v' } };
            expect(formatDirectives([backwards], palette))
                .toBe('wall-gap-block(ori=v,gap=1)@12d');
        });

    describe('every refusal is BY NAME, and they are four different mistakes', () => {
        it('an unknown TEMPLATE names it and lists the roster', () => {
            expect(() => parseDirectives('wall-gap-blork(ori=v)@12d', palette))
                .toThrow(/names template "wall-gap-blork", which palette/);
        });
        it('an unknown PARAMETER names it and lists what the template declares', () => {
            expect(() => parseDirectives('wall-gap-block(orientation=v)@12d', palette))
                .toThrow(/has no parameter "orientation"/);
        });
        it('a value OUTSIDE the declared domain refuses BEFORE any solve', () => {
            expect(() => parseDirectives('wall-gap-block(ori=diagonal,gap=1)@12d', palette))
                .toThrow(/not in its declared domain \[h, v\]/);
            expect(() => parseDirectives('wall-gap-block(ori=v,gap=99)@12d', palette))
                .toThrow(/not in its declared domain \[0, 1, 2, 3, 4, 5, 6, 7\]/);
        });
        it('a MALFORMED directive quotes it and states the spelling', () => {
            for (const bad of ['wall-gap-block', 'wall-gap-block@12', 'wall-gap-block@12x',
                'wall-gap-block(ori=v@12d', '@12d']) {
                expect(() => parseDirectives(bad, palette)).toThrow(/is not a directive/);
            }
        });
        it('an EMPTY ?directed= refuses — absence is how "no directives" is spelled', () => {
            expect(() => parseDirectives('', palette)).toThrow(/names nothing/);
        });
        it('a duplicated parameter refuses — two values for one setting', () => {
            expect(() => parseDirectives('wall-gap-block(ori=v,ori=h)@12d', palette))
                .toThrow(/names parameter "ori" twice/);
        });
    });

    describe('⛔ THE WRITER REFUSES WHAT THE READER WOULD REFUSE (§8.6\'s law)', () => {
        it('a directive MISSING a parameter value REFUSES, never writes the default', () => {
            expect(() => formatDirectives([{ ...DIRECTIVE, params: { ori: 'v' } }], palette))
                .toThrow(/carries no value for "gap"/);
        });
        it('a value outside the domain refuses on the way OUT too', () => {
            expect(() => formatDirectives(
                [{ ...DIRECTIVE, params: { ori: 'v', gap: 42 } }], palette,
            )).toThrow(/outside its declared domain/);
        });
        it('an unknown template refuses on the way OUT too', () => {
            expect(() => formatDirectives([{ ...DIRECTIVE, template: 'nope' }], palette))
                .toThrow(/palette "pre-sword" does not hold it/);
        });
    });
});

describe('⛓⛓ `?directed=` in the ONE reader and the ONE writer', () => {
    it('the reader parses it against the BIOME\'s own palette', () => {
        const p = readGenerateParams(
            '?source=generate&seed=6&biome=pre-sword&directed=wall-gap-block(ori=v,gap=1)@12d',
        );
        expect(p.directed).toHaveLength(1);
        expect(p.directed[0].params).toEqual({ ori: 'v', gap: 1 });
    });

    it('⛔ a post-sword-only template REFUSES under pre-sword, by name', () => {
        expect(() => readGenerateParams(
            '?source=generate&biome=pre-sword&directed=wall-gap-spinner-killlock(ori=h)@12d',
        )).toThrow(/which palette "pre-sword" does not hold/);
        // …and is accepted under the biome that HAS it.
        expect(readGenerateParams(
            '?source=generate&biome=post-sword&directed=wall-gap-spinner-killlock(ori=h)@12d',
        ).directed).toHaveLength(1);
    });

    it('absent means NO directives, and the writer DELETES rather than writing empty', () => {
        expect(readGenerateParams('?source=generate&seed=1').directed).toBeNull();
        const q = writeGenerateParams('directed=wall-gap-block(ori=v,gap=1)@12d', {
            seed: 1, biome: 'pre-sword', bounds: DEFAULT_BOUNDS, step: 0, directives: [],
        });
        expect(new URLSearchParams(q).get('directed')).toBeNull();
    });

    it('⛓ THE FIXED POINT: loading what it wrote rewrites it to itself, character for character',
        () => {
            const first = writeGenerateParams('tickbudget=600', {
                seed: 6,
                biome: 'pre-sword',
                bounds: DEFAULT_BOUNDS,
                step: 2,
                directives: [DIRECTIVE, { ...DIRECTIVE, template: 'arrow-lane', params: {} }],
            });
            const read = readGenerateParams(`?${first}`);
            const second = writeGenerateParams(first, {
                seed: read.seed,
                biome: read.biome,
                bounds: read.bounds,
                step: 2,
                directives: read.directed,
            });
            expect(second).toBe(first);
            // …and the parameters it does not own still survive.
            expect(new URLSearchParams(second).get('tickbudget')).toBe('600');
        });
});

describe('⛓⛓⛓ VERB 2, APPLIED — the ruling\'s two clauses, driven', () => {
    it('⛓⛓ PREFERS a DISCHARGING anchor over the first that merely SOLVES', () => {
        const base = generateStep(SUBJECT);
        const preferred = applyDirective(base, DIRECTIVE, 0);
        const [d] = preferred.directives;
        expect(d.outcome).toBe(ATTEMPT.KEPT);
        expect(d.keptKind).toBe(KEPT_KIND.DISCHARGED);

        /**
         * ⛔ THE CONTROL, AND IT IS WHAT MAKES THIS A CLAIM ABOUT THE POLICY:
         * the SAME directive under the free loop's own rule keeps a DIFFERENT
         * anchor and reports a different kind of keep. Without this line the
         * case would pass on a build that always discharged by luck.
         */
        const firstSolved = applyDirective(
            base, { ...DIRECTIVE, keepPolicy: KEEP_POLICY.FIRST_SOLVED }, 0,
        );
        expect(firstSolved.directives[0].outcome).toBe(ATTEMPT.KEPT);
        expect(firstSolved.directives[0].at).not.toEqual(d.at);
        expect(firstSolved.directives[0].anchorsWalked)
            .toBeLessThan(d.anchorsWalked);
        // ⛓ …and the two really produce DIFFERENT LEVELS.
        expect(preferred.record).not.toEqual(firstSolved.record);
    });

    it('⛔ a template with NO VERB reports `solved-no-verb`, not `solved-only`', () => {
        const base = generateStep(SUBJECT);
        const out = applyDirective(base, {
            template: 'wall-segment',
            params: { ori: 'h', len: 2 },
            anchor: null,
            keepPolicy: KEEP_POLICY.PREFER_DISCHARGE,
            bound: DIRECTED_ANCHOR_TRIES,
        }, 0);
        expect(out.directives[0].outcome).toBe(ATTEMPT.KEPT);
        expect(out.directives[0].keptKind).toBe(KEPT_KIND.NO_VERB);
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
            keepPolicy: KEEP_POLICY.PREFER_DISCHARGE,
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
        const base = generateStep(SUBJECT);
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

describe('⛓⛓⛓ REPRODUCTION — a copied link rebuilds the whole construction', () => {
    it('the ladder plus its directives reproduces byte for byte, in one path', () => {
        const pressed = applyDirective(generateStep(SUBJECT), DIRECTIVE, 0);
        const replayed = generateWithDirectives({ ...SUBJECT, directed: [DIRECTIVE] });
        expect(replayed.record).toEqual(pressed.record);
        expect(replayed.trace).toEqual(pressed.trace);
        expect(replayed.directives).toEqual(pressed.directives);
    });

    it('⛓⛓ THROUGH THE URL: write it, read it back, regenerate — the same level', () => {
        const pressed = applyDirective(generateStep(SUBJECT), DIRECTIVE, 0);
        const search = writeGenerateParams('', {
            seed: pressed.seed,
            biome: pressed.biome,
            bounds: pressed.bounds,
            step: pressed.step,
            directives: pressed.directives,
        });
        const read = readGenerateParams(`?${search}`);
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
            directed: read.directed,
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
            ...DIRECTIVE, params: { ori: 'h', gap: 4 },
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
        // `gap` is left to be DRAWN; `ori` is named.
        const drawn = applyDirective(base, { ...DIRECTIVE, params: { ori: 'v' } }, 0);
        const rec = drawn.directives[0];
        expect(Object.keys(rec.params).sort()).toEqual(['gap', 'ori']);
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
            expect(DEFAULT_SKELETON.kind).toBe('empty-bordered');
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
        for (const text of ['wall-segment(ori=h,len=2)@1s!4,6',
            'wall-gap-block(ori=v,gap=1)@1d!7,1']) {
            const [d] = parseDirectives(text, palette);
            expect(d.anchor).toEqual({ tx: Number(text.split('!')[1].split(',')[0]),
                ty: Number(text.split('!')[1].split(',')[1]) });
            expect(d.bound).toBe(1);
            expect(formatDirectives([d], palette)).toBe(text);
        }
    });

    it('⛔ an explicit anchor beside a bound above 1 REFUSES — in the reader AND the writer',
        () => {
            expect(() => parseDirectives('wall-gap-block(ori=v,gap=1)@12d!7,1', palette))
                .toThrow(/explicit cell is a walk of ONE cell/);
            expect(() => formatDirectives(
                [{ ...DIRECTIVE, anchor: { tx: 7, ty: 1 }, bound: 12 }], palette,
            )).toThrow(/EXPLICIT anchor \(7,1\) and bound 12/);
        });

    it('⛓ the URL fixed point holds over a clicked directive too', () => {
        const clicked = { ...DIRECTIVE, anchor: { tx: 7, ty: 1 }, bound: 1 };
        const first = writeGenerateParams('tickbudget=600', {
            seed: 6, biome: 'pre-sword', bounds: DEFAULT_BOUNDS, step: 0, directives: [clicked],
        });
        const read = readGenerateParams(`?${first}`);
        expect(read.directed[0].anchor).toEqual({ tx: 7, ty: 1 });
        const second = writeGenerateParams(first, {
            seed: read.seed, biome: read.biome, bounds: read.bounds, step: 0,
            directives: read.directed,
        });
        expect(second).toBe(first);
        /**
         * ⛔⛔ AND THE FIXED POINT IS NOT THE GATE ON THE VALUE — slice 5's own
         * amendment to §8.6/§11.10 (trap 250). A writer that emitted a
         * CONSTANT wrong anchor would round-trip to itself perfectly, so the
         * VALUE is checked against a literal spelled out here.
         */
        expect(new URLSearchParams(first).get('directed'))
            .toBe('wall-gap-block(ori=v,gap=1)@1d!7,1');
    });
});

describe('⛓⛓⛓ VERB 2 AT A CLICKED CELL — the template lands THERE, or refuses by name', () => {
    /**
     * ⛓ THE SUBJECT IS MEASURED (see the slice-6 as-built): on pre-sword seed
     * 6's skeleton the plain vertical door is legal at exactly six cells —
     * (2,1) (4,1) (5,1) (6,1) (7,1) (8,1) — and a SEARCHED directive lands on
     * (2,1) after walking 5 of 6. ⛔ (7,1) is therefore neither the searched
     * answer, nor the start (1,1), nor the goal (3,1), nor the first interior
     * cell a naive implementation would produce: trap 235, at the anchor.
     */
    const CLICK = Object.freeze({ tx: 7, ty: 1 });
    const clicked = Object.freeze({ ...DIRECTIVE, anchor: CLICK, bound: 1 });

    it('⛓ the SUBJECT\'s own properties first — (7,1) is legal and is NOT where a search goes',
        () => {
            const base = generateStep(SUBJECT);
            const template = paletteFor(SUBJECT.biome).templates
                .find((t) => t.name === DIRECTIVE.template)
                .instantiate(null, DIRECTIVE.params);
            expect(base.model.refusalAt(base.record, template, CLICK.tx, CLICK.ty)).toBeNull();
            expect(base.model.goalCell).not.toEqual(CLICK);
            const searched = applyDirective(base, DIRECTIVE, 0).directives[0];
            expect(searched.at).not.toEqual(CLICK);
        });

    it('⛓⛓ lands at the CLICKED cell — the record, the directive and the FOOTPRINT agree',
        () => {
            const out = applyDirective(generateStep(SUBJECT), clicked, 0);
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
                .not.toBe(terrainAt(generateStep(SUBJECT).record, CLICK.tx, CLICK.ty));
        });

    it('⛔ an ILLEGAL cell refuses BY NAME, the record does NOT move, and no solve is spent',
        () => {
            const base = generateStep(SUBJECT);
            // (3,1) is seed 6's GOAL cell — measured, and asserted here so this
            // is the goal class rather than whatever else that cell might be.
            expect(base.model.goalCell).toEqual({ tx: 3, ty: 1 });
            const out = applyDirective(base, { ...clicked, anchor: { tx: 3, ty: 1 } }, 0);
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
            const template = paletteFor(SUBJECT.biome).templates
                .find((t) => t.name === DIRECTIVE.template)
                .instantiate(null, DIRECTIVE.params);
            const rows = out.trace.filter((r) => r.directive === 1);
            expect(rows).toHaveLength(1);
            expect(rows[0].reasonText)
                .toBe(base.model.refusalAt(base.record, template, 3, 1));
            expect(rows[0].reasonText).toMatch(/\(3,1\) is the GOAL cell/);
            expect(rows[0].verdict).toBeNull();
        });

    it('⛓⛓ a clicked construction REPRODUCES byte for byte through the URL', () => {
        const pressed = applyDirective(generateStep(SUBJECT), clicked, 0);
        const search = writeGenerateParams('', {
            seed: pressed.seed, biome: pressed.biome, bounds: pressed.bounds,
            step: pressed.step, directives: pressed.directives,
        });
        const read = readGenerateParams(`?${search}`);
        const rebuilt = generateWithDirectives({
            seed: read.seed, biome: read.biome, step: stepFromParams(read),
            bounds: read.bounds, budget: read.budget, roster: read.roster,
            directed: read.directed,
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
