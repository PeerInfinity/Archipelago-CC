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
    BIOME_NAMES, GENERATE_BIOMES, agreementWithPayload, agreementWithTrace, describeState,
    displaySolve, generateStep, generationRows, keptTemplatesOf, ladderCost, paletteFor,
    readGenerateParams,
} from './watchGenerate.js';
import { DEFAULT_BOUNDS, STOP } from './levelGenerator.js';
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
        expect(p.bounds).toEqual({ obstacleTarget: 3, triesPerStep: 4, saturationK: 2 });
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

describe('the ladder cost — stated BEFORE it is spent', () => {
    it('is the sum over the rungs plus one display solve each', () => {
        const cost = ladderCost({ obstacleTarget: 3, triesPerStep: 8 }, 100);
        // (1+8) + (1+16) + (1+24) = 51 loop solves; 4 display solves.
        expect(cost.loopSolves).toBe(51);
        expect(cost.displaySolves).toBe(4);
        expect(cost.worstCaseTotalMs).toBe(5500);
        expect(cost.why).toMatch(/RUN-ALL to 3/);
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

describe('the pin union — the kept templates, by object', () => {
    it('resolves every kept name to its palette object', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 2 });
        expect(s.keptTemplates).toHaveLength(2);
        for (const t of s.keptTemplates) expect(PRE_SWORD_PALETTE.templates).toContain(t);
    });

    it('refuses a kept name the palette does not hold', () => {
        expect(() => keptTemplatesOf({ kept: [{ template: 'nope' }] }, PRE_SWORD_PALETTE))
            .toThrow(/which palette .* does not hold/);
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

    it('describeState names every bound that ran', () => {
        const s = generateStep({ seed: 9, biome: 'pre-sword', step: 1 });
        const line = describeState(s, displaySolve(s));
        expect(line).toMatch(/bounds: target=1 tries=8 k=3/);
        expect(line).toMatch(/POST-HOC/);
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
     * MEASUREMENT, not a taste: at these bounds seeds 4 and 7 of 1..10 reach
     * the target and the other eight saturate, so the seed is named rather
     * than assumed (seed 4 was the first draft's choice and it is one of the
     * two that does NOT saturate — caught by this case going green the wrong
     * way round).
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
