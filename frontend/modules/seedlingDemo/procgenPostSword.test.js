/**
 * seedlingDemo/procgenPostSword.test — **THE SECOND BIOME: THE ONE FAMILY IT
 * EARNED, AND THE THREE MEASUREMENT KEPT OUT.**
 *
 * Seedling PROCGEN PoC arc, slice 4 (kickoff §4.4). ⚖ §0 splits the arc into
 * TWO BIOMES on one flag; ⚖ §10.7 expired §9.8's advice to carry the
 * post-sword clearer families across as inherited exclusions and required a
 * re-probe FROM SCRATCH. This file is that re-probe, driven.
 *
 * ── ⛓⛓⛓ SLICE 4e MOVED ONE ROW OUT OF THE TABLE AND INTO THE PALETTE ──
 *
 * `spinner-killlock` was excluded for three causes, discharged one slice at a
 * time (declaration 4b · tag law 4b · the transit throw 4e), plus a fourth the
 * promotion itself exposed (the dialogue ceremony, answered by the `door`
 * legality rule). Its two cases below now prove the DISCHARGE rather than the
 * exclusion — and **two assertions in this file were rewritten rather than
 * deleted**, each carrying the claim it used to make and why that claim was
 * right until it wasn't: the roster's by-reference identity, and the
 * byte-identical two-biome level. They were pre-declared as intended reds at
 * 4b's S9 and they went red exactly as declared.
 *
 * ── ⛔ THE EXCLUSION CASES ARE BUILT **FROM** THE EXCLUSION TABLE ──────
 *
 * Trap 199's structure, one layer over from `procgenPalette.test.js`: every
 * row of `POST_SWORD_EXCLUDED_TEMPLATES` must be answered by a case here that
 * actually drives its geometry, so a family excluded on a story rather than a
 * measurement arrives as a failing test. ⚠ The two heaviest rows (the spinner
 * sweep's 32 cells, the shieldboss's 9 geometries) are represented by ONE
 * geometry each — the sweeps themselves are in the as-built, and saying so
 * here is the bound this file names rather than implies.
 */

import { describe, expect, it } from 'vitest';

import {
    POST_SWORD_EXCLUDED_TEMPLATES, POST_SWORD_ITEMS, POST_SWORD_PALETTE,
    POST_SWORD_TEMPLATES, PRE_SWORD_ITEMS, PRE_SWORD_PALETTE, PRE_SWORD_TEMPLATES,
    assertPalette, enumerateInstantiations, enumerateValues, instantiateKept,
} from './procgenPalette.js';
import {
    bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain,
} from './procgenLevel.js';
import { DEFAULT_BUDGET, bootStaging, collectGoal, solve } from './procgenOracle.js';
/** ⛓ SLICE 4c: the sword gate moved from a ROSTER SPLIT to an element's `needs`. */
import { ELEMENT_TABLE } from '../procgenCore/elementSpec.js';
import {
    SEEDLING_DEFAULTS, generateSeedlingLevel, seedlingModel, seedlingOracle, seedlingSeam,
} from './procgenSeedling.js';

const START = SEEDLING_DEFAULTS.start;

/** A Stone wall across the whole interior at row `ty`, with `gapTx` left open. */
const wallAcross = (ty, gaps) => {
    const open = new Set([gaps].flat());
    const out = [];
    for (let tx = 1; tx <= 8; tx += 1) if (!open.has(tx)) out.push({ tx, ty });
    return out;
};

/**
 * ⛔ THE EXCLUSION GEOMETRY IS THE ONE §11.7 DEMANDS: the candidate stands in
 * the ONLY gap of a wall that crosses the whole interior, and the goal is
 * strictly beyond it. A candidate placed anywhere else would be kept or
 * refused for reasons that are not about the candidate.
 */
function doorRoom({ goal, gapTy = 5, gapTx = 4, entities = [] }) {
    let record = emptyLevel({ level: SEEDLING_DEFAULTS.level });
    record = withTerrain(record, wallAcross(gapTy, gapTx).map((c) => ({ ...c, terrain: 'wall' })));
    return withEntities(record, [
        {
            type: SEEDLING_DEFAULTS.goalClass,
            ...oelAtTile(goal.tx, goal.ty),
            attrs: { tag: SEEDLING_DEFAULTS.goalTag },
        },
        ...entities.map((e) => ({
            type: e.type, ...oelAtTile(e.tx, e.ty), ...(e.attrs ? { attrs: e.attrs } : {}),
        })),
    ]);
}

/** Solve one, returning the outcome AND the throw class if it did not refuse cleanly. */
function attempt(name, spec, items = POST_SWORD_ITEMS, save = null) {
    const record = doorRoom(spec);
    const staging = bootStaging({
        boot: bootAtTile(record, START.tx, START.ty),
        items,
        pins: ['dead_frames'],
        // ⛓ SLICE 4e: `time: null` is the PRE-4e boot — no `save.time`, so the
        // hammer is the all-phases disc. A spec that does not ask for it gets
        // the declared clock, which is what every generated solve now has.
        ...(spec.time === undefined ? {} : { time: spec.time }),
    });
    if (save) staging.save = { totem_parts: [], keys: [], seal_parts: [], ...save };
    try {
        const out = solve(record, staging,
            [collectGoal(spec.goal.tx * 16, spec.goal.ty * 16)], DEFAULT_BUDGET,
            // ⛔ THE CLOCK IS INJECTED — §13.8's flake: the wall-clock budget is
            // POST-HOC, so a loaded machine turns a verdict into a fact about
            // the machine.
            { name, now: () => 0 });
        const verbs = new Set();
        for (const r of out.rows ?? []) if (r.strategy?.verb) verbs.add(r.strategy.verb);
        for (const r of out.records ?? []) if (r.strategy) verbs.add(r.strategy);
        return {
            verdict: out.verdict,
            ticks: out.ticks,
            verbs,
            reasonText: out.reasonText,
            scratchClears: out.scratchClears ?? [],
        };
    } catch (e) {
        return {
            verdict: `THREW:${e.name}`,
            threw: e.name,
            reasonText: e.message,
            verbs: new Set(),
            scratchClears: [],
        };
    }
}

const excludedNamed = (name) => POST_SWORD_EXCLUDED_TEMPLATES.find((x) => x.name === name);

describe('the post-sword biome is a BOOT, and its roster is the pre-sword one', () => {
    it('declares the sword and withholds the shield — the arc\'s own boundary', () => {
        expect(POST_SWORD_ITEMS).toEqual({ hasSword: true, hasShield: false });
        // ⚖ §0: the arc is LIMITED to features from before the shield.
        expect(POST_SWORD_ITEMS.hasShield).toBe(false);
        expect(PRE_SWORD_ITEMS.hasSword).toBe(false);
    });

    /**
     * ⛓⛓⛓ REWRITTEN AT SLICE 4e, AND THE OLD ASSERTION IS QUOTED RATHER THAN
     * DELETED — it was PRE-DECLARED as an intended red (4b's S9).
     *
     * It read `expect(POST_SWORD_TEMPLATES).toBe(PRE_SWORD_TEMPLATES)`, and it
     * was the right claim for slices 4/4b/4c: with no sword-gated family, one
     * array was the guarantee that *a template cannot reach one biome and miss
     * the other*. Slice 4e promoted `spinner+kill-lock`, whose whole point is
     * that it reaches ONE biome — so the identity is now exactly the wrong
     * invariant, and what survives it is CONTAINMENT plus a named difference.
     */
    /**
     * ⛓⛓⛓ **AND THE EXTRA IS BACK TO NOTHING — ARC 3, SLICE 4c** (⚖ user,
     * 2026-08-17). `wall-gap-spinner-killlock` retired into the room-aware
     * `killgate` ELEMENT, so `KILL_LOCK_TEMPLATES` is EMPTY and the post-sword
     * array is a spread of the pre-sword one with nothing added.
     *
     * ⛔ THE OLD IDENTITY CLAIM IS **NOT** RESTORED, and that is deliberate.
     * `expect(POST_SWORD_TEMPLATES).toBe(PRE_SWORD_TEMPLATES)` would be true of
     * a build that DELETED the seam, and the seam is kept on purpose (arc 5's
     * arena is the next sword-gated family). What survives is CONTAINMENT plus
     * a named difference of ZERO — the two rosters hold the same frozen row
     * objects in the same order, and the biome is the BOOT.
     */
    it('is a superset of the pre-sword roster — and the extra is EMPTY since 4c', () => {
        expect(POST_SWORD_TEMPLATES).not.toBe(PRE_SWORD_TEMPLATES);
        // ⛓ SLICE 2: the containment is still BY CONSTRUCTION — the post-sword
        // array spreads the same frozen BASE objects — so identity holds and
        // this is the assertion that keeps it holding.
        for (const t of PRE_SWORD_TEMPLATES) expect(POST_SWORD_TEMPLATES).toContain(t);
        const extra = POST_SWORD_TEMPLATES.filter((t) => !PRE_SWORD_TEMPLATES.includes(t));
        expect(extra.map((t) => t.name)).toEqual([]);
        /**
         * ⛔ THE SWORD GATE MOVED RATHER THAN VANISHING, and this is where a
         * reader meets it: `ELEMENT_TABLE.killgate.needs` is `['hasSword']`, and
         * `seedlingSeam` refuses that element FOR FREE — before a solve — under a
         * boot that does not grant one. ⛓ Asserted here so an empty `extra`
         * cannot be read as *"the biome split is gone"*.
         */
        expect(ELEMENT_TABLE.killgate.needs).toEqual(['hasSword']);
        expect(ELEMENT_TABLE.guard.needs ?? null).toBeNull();
        expect(ELEMENT_TABLE.blockpocket.needs ?? null).toBeNull();
        expect(assertPalette(POST_SWORD_PALETTE)).toBe(true);
    });

    /**
     * ⛔⛔ THE TAG LAW, BY CONSTRUCTION (4b §13.7.2 — *a clear is a FLAG*).
     * Asserted as a RELATION between the two, never as two literals: a slice
     * that changed the goal tag would otherwise leave this passing.
     */
    /**
     * ⛓⛓ RE-POINTED AT THE ELEMENT AT SLICE 4c. The TEMPLATE this drove
     * retired, and its `expect(locks.length).toBeGreaterThan(0)` guard is what
     * says so — the row cannot be re-seeded, only re-aimed. ⛔ The LAW is
     * unchanged and is now the KILL GATE's: a `tset:'-1'` lock whose persistence
     * tag is not the goal's. It is asked of a real placement rather than of a
     * table, which is a stronger subject than the one it replaces.
     */
    it('every kill lock takes a tag the GOAL does not own — now the ELEMENT\'s', () => {
        const m = seedlingModel({ seed: 1, elements: { name: 'killgate' } });
        expect(m.elements.ran, 'the subject must PLACE for this row to mean anything')
            .toBe(true);
        const locks = m.skeleton().entities.filter((e) => e.type === 'lock');
        expect(locks.length).toBeGreaterThan(0);
        for (const l of locks) {
            expect(l.attrs.tset).toBe('-1');
            expect(l.attrs.tag).not.toBe(SEEDLING_DEFAULTS.goalTag);
        }
        // ⛔ AND NO SHIPPED TEMPLATE CARRIES ONE ANY MORE — the other half of
        // the same fact, said where it can fail.
        expect(enumerateInstantiations(POST_SWORD_PALETTE)
            .filter((t) => t.family === 'kill')).toEqual([]);
    });

    it('each biome carries its OWN exclusions, and they are different lists', () => {
        expect(PRE_SWORD_PALETTE.excluded).not.toBe(POST_SWORD_PALETTE.excluded);
        const post = POST_SWORD_EXCLUDED_TEMPLATES.map((x) => x.name);
        // ⛓ SLICE 4e: `spinner-killlock` LEFT THIS LIST — it is a template now.
        // The list is asserted whole rather than by length so a row that
        // vanished silently would still be a failure.
        // ⛓⛓ SLICE 4c: `wall-gap-spinner-killlock` came BACK to this list, and
        // its cause is a THIRD kind — SUPERSEDED by the room-aware `killgate`
        // ELEMENT, not un-adjudicable and not ruled out. It is on the POST-SWORD
        // list because that is the palette that held it.
        expect(post).toEqual([
            'chest-in-the-gap', 'key-keylock-pair', 'shieldboss-door',
            'wall-gap-spinner-killlock',
        ]);
        expect(post).not.toContain('spinner-killlock');
        for (const x of POST_SWORD_EXCLUDED_TEMPLATES) {
            for (const field of ['cause', 'measured', 'wouldNeed']) {
                expect(typeof x[field]).toBe('string');
                expect(x[field].length).toBeGreaterThan(0);
            }
            /**
             * ⛓⛓ `refusalText` IS THE ONE FIELD THAT MAY BE `null`, and slice 4c
             * is where that started mattering on THIS list. It is the VERBATIM
             * text of a probe refusal — the arc's evidence channel — and a row
             * excluded by SUPERSESSION never produced one. ⛔ A parenthetical
             * explaining that there is none would read, to `catalogueRows` and
             * to `procgenPalette.test.js`'s measured-row count, as a refusal
             * that happened; the explanation belongs in `measured`.
             */
            expect(x.refusalText === null || typeof x.refusalText === 'string').toBe(true);
            if (typeof x.refusalText === 'string') {
                expect(x.refusalText.length).toBeGreaterThan(0);
            }
            // ⛔ NOTHING excluded is also offered.
            expect(POST_SWORD_TEMPLATES.some((t) => t.name === x.name)).toBe(false);
        }
    });

    /**
     * ⛔⛔ THE HEADLINE, DRIVEN RATHER THAN CONFESSED IN A COMMENT. With no
     * post-sword-exclusive template, the sword is a flag no obstacle in this
     * palette consults — so the two biomes generate the SAME LEVEL and the
     * same trace, and only the summary (which records `items`) differs. ⚖ This
     * is what slice 5's requirements report will find, and it is a fact about
     * the palette rather than about the report.
     */
    /**
     * ⛓⛓⛓ REWRITTEN AT SLICE 4e — the SECOND pre-declared intended red (4b's
     * S9), and it is quoted rather than deleted for the same reason.
     *
     * It asserted that the two biomes generate a BYTE-IDENTICAL level and
     * trace, and that assertion WAS the slice-4 headline: *"the biome is REAL
     * IN THE BOOT and NIL IN THE OUTPUT"*. It is false now, and its falsity is
     * the whole content of this slice's promotion — so the case is inverted and
     * made to say WHY, rather than dropped for being inconvenient.
     *
     * ⛔ THE DIFFERENCE IS ASSERTED AT ITS SOURCE, not merely observed: the
     * post-sword run draws from a longer roster, so the records diverge — and
     * the pre-sword run must still contain NO kill template, which is the claim
     * that would actually be broken if the split leaked.
     */
    it('⛔ no longer generates the pre-sword level — the roster split is REAL', () => {
        const bounds = { obstacleTarget: 6 };
        const pre = generateSeedlingLevel({ seed: 9, palette: PRE_SWORD_PALETTE, bounds });
        const post = generateSeedlingLevel({ seed: 9, palette: POST_SWORD_PALETTE, bounds });
        expect(JSON.stringify(post.record)).not.toBe(JSON.stringify(pre.record));
        // ⛔ THE SWORD-GATED FAMILY CANNOT REACH THE PRE-SWORD BIOME. This is
        // the claim the old by-reference roster used to make structurally.
        const killNames = POST_SWORD_TEMPLATES
            .filter((t) => t.family === 'kill').map((t) => t.name);
        for (const k of pre.summary.kept) expect(killNames).not.toContain(k.template);
        for (const row of pre.trace) expect(killNames).not.toContain(row.template);
        // …and the inventory each was solved under is still recorded.
        expect(post.summary.items).toEqual(POST_SWORD_ITEMS);
        expect(pre.summary.items).toEqual(PRE_SWORD_ITEMS);
        expect(post.summary.palette).toBe('post-sword');
    });

    it('and the same room under both boots gives the same verdict and tick count', () => {
        const gen = generateSeedlingLevel({
            seed: 1, palette: PRE_SWORD_PALETTE, bounds: { obstacleTarget: 6 },
        });
        const model = seedlingModel({ seed: 1 });
        // ⛓ SLICE 2: the ONE reconstruction, not a private lookup.
        const templates = gen.summary.kept.map((k) => instantiateKept(POST_SWORD_PALETTE, k));
        const under = (items) => seedlingOracle({ model, items })
            .solve(gen.record, { templates });
        const pre = under(PRE_SWORD_ITEMS);
        const post = under(POST_SWORD_ITEMS);
        expect(post.verdict).toBe(pre.verdict);
        expect(post.ticks).toBe(pre.ticks);
    });
});

describe('⛔⛔ THE RE-PROBE — every excluded family, driven in the door geometry', () => {
    /**
     * ⛓ THE CHEST. `chestStanceBand` puts the opener's stance strictly BELOW
     * the chest, and the room's start is its NW corner, so a single template's
     * crossing always approaches from the wrong side. The verb IS selected —
     * this is not slice 2's "never reached" — and applied to
     * `MAX_STRATEGIES_PER_GOAL` without a corridor appearing.
     */
    it('chest-in-the-gap: the verb is SELECTED and the corridor never opens', () => {
        const out = attempt('chest-in-the-gap', {
            goal: { tx: 7, ty: 8 },
            entities: [{ type: 'chest', tx: 4, ty: 5, attrs: { tag: '0' } }],
        });
        expect(out.verdict).not.toBe('SOLVED');
        expect(out.verbs.has('chest')).toBe(true);
        expect(out.reasonText).toMatch(/applied 4 strategies for one goal/);
        expect(out.reasonText).toMatch(/the corridor still does not plan/);
        // The row's own text is this measurement, not a paraphrase of it.
        expect(excludedNamed('chest-in-the-gap').refusalText)
            .toMatch(/applied 4 strategies for one goal/);
    });

    /**
     * ⛓ THE KEY + KEYLOCK, both cures. Holding the key is NOT the missing
     * piece, and the row says the deciding cause is still unnamed.
     */
    it('key-keylock-pair: unkeyed it THROWS; keyed the corridor still never opens', () => {
        const spec = {
            goal: { tx: 7, ty: 8 },
            entities: [{ type: 'bosslock', tx: 4, ty: 5, attrs: { keyType: '0', tag: '1' } }],
        };
        const unkeyed = attempt('keylock-unkeyed', spec);
        expect(unkeyed.threw).toBe('SolverBotError');
        expect(unkeyed.reasonText).toMatch(/needs a key this run does not hold/);
        expect(unkeyed.reasonText).toMatch(/[Tt]he key is a SUB-ORDER/);

        const keyed = attempt('keylock-keyed', spec, POST_SWORD_ITEMS, { keys: [0] });
        expect(keyed.verdict).not.toBe('SOLVED');
        expect(keyed.verbs.has('keylock')).toBe(true);
        expect(keyed.reasonText).toMatch(/the corridor still does not plan/);
        // ⚠ The row must NOT read as understood.
        expect(excludedNamed('key-keylock-pair').cause).toMatch(/UNDIAGNOSED/);
        expect(excludedNamed('key-keylock-pair').measured)
            .toMatch(/THE DECIDING CAUSE IS NOT NAMED/);
    });

    /**
     * ⛓⛓⛓ THE SPINNER + KILL-LOCK — **PROMOTED AT SLICE 4e**, and the case
     * that used to pin its exclusion now pins its DISCHARGE.
     *
     * The row it drove asserted `out.threw === 'SolverBotError'` — that the
     * failure ESCAPED the oracle and killed the run rather than the candidate.
     * Three things changed that, and this case drives all three:
     *
     *  1. The BOOT declares `save.time`, so `dangerMap.spinnerDanger` prices
     *     the exact hammer line instead of the 13 px union over 45 phases. The
     *     committed sweep went 2 SOLVED / 26 THREW to 21 / 7.
     *  2. `procgenOracle` classifies the hammer-SAFETY refusals that remain, so
     *     the seven are REVERTS and not aborts.
     *  3. The template carries `door`, so the loop can never anchor it with the
     *     goal on the START's side — where the walk would collect the torch
     *     with the spinner alive and `assertDialogueFreeSpinnerRoom` would kill
     *     the run BY NAME. (3 of 12 legal anchors did exactly that before it.)
     *
     * ⚠ ONE GEOMETRY HERE, as ever; the sweep is
     * `scripts/procgen/sweep-seedling-killlock.mjs`, which now carries a
     * `--no-clock` flag so the pre-4e arm stays runnable rather than quoted.
     */
    it('spinner-killlock: SOLVES, and the clear is DISCHARGED in the records', () => {
        const out = attempt('spinner-killlock', {
            goal: { tx: 7, ty: 8 },
            entities: [
                { type: 'lock', tx: 4, ty: 5, attrs: { tset: '-1', tag: '1' } },
                { type: 'spinner', tx: 6, ty: 2, attrs: { tag: '-1' } },
            ],
        });
        expect(out.threw).toBeUndefined();
        expect(out.verdict).toBe('SOLVED');
        // ⛔ DISCHARGE EXISTENCE (§12.1): the kill RECORD and the scratch row
        // naming the lock. A keep-count could not tell this apart from an
        // obstacle nobody walked into.
        expect(out.verbs.has('kill')).toBe(true);
        expect(out.scratchClears.length).toBeGreaterThan(0);
        expect(out.scratchClears[0].lock).toMatch(/^lock@/);
        expect(out.scratchClears[0].cause).toBe('sword');
    });

    /**
     * ⛔ THE CONTROL FOR THE ROW ABOVE, and it is what makes the promotion a
     * measurement rather than a story: with the boot declaring NO `save.time`
     * — the state every generated solve was in until this slice — the same room
     * still THROWS the hammer-transit refusal past the oracle.
     */
    it('…and with the clock UNDECLARED the same room throws, as it always did', () => {
        const out = attempt('spinner-killlock-no-clock', {
            goal: { tx: 7, ty: 8 },
            entities: [
                { type: 'lock', tx: 4, ty: 5, attrs: { tset: '-1', tag: '1' } },
                { type: 'spinner', tx: 6, ty: 2, attrs: { tag: '-1' } },
            ],
            time: null,
        });
        expect(out.verdict).not.toBe('SOLVED');
        /**
         * ⛓⛓⛓ SLICE 2c — AND THIS IS THE ONE ARM WHERE THE UNION IS THE TRUTH.
         * With `time: null` the clock refuses, `clearOfHammersAt` falls back to
         * the 13 px rect over all 45 phases, and the refusal says so. Its twin
         * in `procgenCountableClock.test.js` asserts the LINE on the same
         * sentence with the clock declared — the two arms are one code path
         * with one argument different, which is what makes either assertion
         * mean anything.
         */
        expect(out.reasonText).toMatch(/13 px hammer's union over all 45 phases/);
        expect(out.reasonText).not.toMatch(/hammer line/);
    });

    /**
     * ⛓ THE SHIELDBOSS — ⚖ a ruled bounded probe, and the blocker is not the
     * fight at all: v1's ONLY goal is collecting a `torchpickup`, and a live
     * ShieldBoss refuses that ceremony BY NAME.
     */
    it('shieldboss-door: a live boss refuses the goal\'s own ceremony', () => {
        // ⛓ THE SWEEP'S TWO CLASSES, one case each. A 48x48 body needs a
        // 3-wide gap to stand in a door at all.
        const boss = (ty) => ({
            goal: { tx: 7, ty: 8 }, gapTy: ty, gapTx: [3, 4, 5],
            entities: [{ type: 'shieldboss', tx: 4, ty, attrs: { tag: '0' } }],
        });
        // (i) the corridor class — the `fight` resolves and never opens the way.
        const blocked = attempt('shieldboss-door-ty5', boss(5));
        expect(blocked.verdict).not.toBe('SOLVED');
        expect(blocked.verbs.has('fight')).toBe(true);
        expect(blocked.reasonText).toMatch(/the corridor still does not plan/);
        // (ii) ⛔ THE DECIDING CLASS, and it is not about the fight: v1's ONLY
        // goal is collecting a `torchpickup`, and a live ShieldBoss refuses
        // that ceremony BY NAME — so the family is incompatible with the goal
        // kind rather than with the room.
        const ceremony = attempt('shieldboss-door-ty4', boss(4));
        expect(ceremony.threw).toBe('Error');
        expect(ceremony.reasonText).toMatch(/ceremony began in level 900 while the ShieldBoss/);
        expect(excludedNamed('shieldboss-door').cause).toMatch(/INCOMPATIBLE WITH v1/);
        expect(excludedNamed('shieldboss-door').refusalText)
            .toMatch(/ceremony began in level 900 while the ShieldBoss/);
    });

    /**
     * Trap 199: a row added without a driven case is a FAILING test.
     *
     * ⛓⛓⛓ SLICE 4c ADDS ONE **NAMED EXEMPTION**, and it is exempt for a reason
     * this rule was never about. `wall-gap-spinner-killlock` came back to the
     * exclusions SUPERSEDED rather than un-adjudicable: it worked, and its own
     * measurements retired it. There is no probe geometry to drive here, because
     * the row's evidence is a COMPARISON against the element that replaced it —
     * the door census (§9.2), the `span` sweep (§9.5) and the element's own
     * placement census (§12), none of which is a refusal in a probe room.
     *
     * ⛔ SO THE EXEMPTION IS SPELLED, NOT ASSUMED: it must be exactly this row,
     * it must carry `refusalText: null` (there is no refusal to quote), and its
     * `measured` must name the element that superseded it. A second superseded
     * row arriving without a case would land here as a failure, which is what
     * the rule is for.
     */
    it('every excluded row above is one this file actually drove — or a NAMED supersession', () => {
        const driven = new Set([
            'chest-in-the-gap', 'key-keylock-pair', 'shieldboss-door',
        ]);
        const superseded = ['wall-gap-spinner-killlock'];
        for (const x of POST_SWORD_EXCLUDED_TEMPLATES) {
            if (superseded.includes(x.name)) {
                expect(x.cause).toMatch(/SUPERSEDED/);
                expect(x.refusalText).toBeNull();
                expect(x.measured + x.wouldNeed).toMatch(/killgate|`span`/);
            } else expect(driven.has(x.name)).toBe(true);
        }
        expect(driven.size + superseded.length).toBe(POST_SWORD_EXCLUDED_TEMPLATES.length);
    });
});

describe('⛓ THE DEMONSTRATION — a certified post-sword level with a DISCHARGED clearer', () => {
    /**
     * ⛓⛓⛓ RE-PINNED AT SLICE 4e, AND THE CLAIM GOT STRONGER RATHER THAN
     * WEAKER — the old case is quoted, not deleted.
     *
     * It was **seed 13**, and its claim was carefully hedged by the
     * orchestrator's slice-4 ruling: *"a discharged clearer IN a post-sword
     * level, NOT a post-sword-EXCLUSIVE one — there is no such family"*. The
     * verb was `weigh`, which a swordless boot clears just as well.
     *
     * The promotion made two things true at once. There IS such a family now,
     * so the hedge can go; and the roster it added is part of the draw stream,
     * so seed 13 no longer keeps its `weigh` door at all — the old case failed
     * on `expect(weighs).toHaveLength(1)`, which is exactly what a roster change
     * should do to a seed-pinned demonstration. **Seed 3 replaces it**, and its
     * discharged clearer is the sword-gated one.
     *
     * ⚠ The standard is unchanged and is the arc's own (§12.1): a RECORD in the
     * FINAL level's solve, never a keep-count.
     *
     * ⛓⛓⛓ RE-PINNED AGAIN AT THE GENERATE-mode UI ARC's SLICE 2, for the same
     * reason and by the same rule. The parameterized palette is part of the
     * draw stream, so seed 3 no longer keeps a kill template at all — which is
     * exactly what a roster change should do to a seed-pinned demonstration
     * (⚖ ruling 5 licensed the expiry). **Seed 13 replaces it**, chosen by
     * re-running the same scan: over post-sword seeds 1..40 at target 6 the
     * carriers are 12, 13, 14, 15 and 25; of those, 12 keeps TWO kill templates
     * (see `procgenPalette.test.js`'s tag-slot case — that is a FINDING, not a
     * subject), and 15 and 25 keep one whose verb the final walk does not
     * discharge. **13 and 14 both keep exactly one and DISCHARGE it**; 13 has
     * five families to 14's four, so it is the richer demonstration.
     *
     * ⛓⛓⛓ **RE-PINNED AGAIN AT ARC 3 SLICE 2, THIRD TIME, SAME RULE.** The DOOR
     * LAW and the kill family's new `span` domain are both in the draw stream,
     * so seed 13 no longer keeps a kill template. Same scan, same bounds, seeds
     * 1..40: **exactly ONE seed now satisfies the whole demonstration — seed
     * 35** (6 kept over 3 families, one kill template, one `kill` record, one
     * scratch clear, SOLVED and CERTIFIED). ⚠ Said out loud because a class with
     * one member is one draw from being a class with none — the SAME warning
     * `procgenShoveEvidence`'s pair carries, and the honest reading of a
     * three-time-re-pinned seed subject is that it is expensive to maintain.
     * ⇒ ⚖ residue: this demonstration wants a scan-and-pick helper rather than a
     * literal, or a wider seed range, the next time it expires.
     *
     * ⛓⛓⛓ **RE-PINNED A FOURTH TIME AT ARC 3 SLICE 4c, AND THE SWORD-GATED
     * THING IS NO LONGER A TEMPLATE.** ⚖ The user retired all three door
     * TEMPLATES; the kill mechanism is the room-aware `killgate` ELEMENT, which
     * the biome's DEFAULT SPEC draws (`guard;len=2+killgate+blockpocket`
     * post-sword) and which `seedlingSeam` refuses FOR FREE under a swordless
     * boot. So `kept.filter(family === 'kill')` can never be non-empty again and
     * the row is re-aimed rather than re-seeded.
     *
     * RE-SCANNED, post-sword seeds 1..40 at target 6 through the SHIPPED
     * DEFAULT, for a seed whose drawn head is `killgate` AND certifies AND whose
     * level keeps >= 5 over >= 3 families: **exactly ONE — seed 29** (6 kept
     * over all 3 families, certification SOLVED, one `kill` record, one scratch
     * clear). ⚠ Eleven of the forty draw `killgate` and certify FALSE; the
     * one-member class warning above stands, doubled.
     *
     * ⛔ AND ONE SEED IN THE FORTY **ABORTS** — post-sword seed 38, a
     * `PhysicsV2Error` ("the player DROWNED") escaping the oracle. It is the
     * pre-existing armed-hazard class, not this element's: `--elements=killgate`
     * alone at that seed does NOT abort, and the default does only because a `+`
     * list spends ONE EXTRA DRAW before instantiate and lands a different room.
     * Recorded in the arc-3 kickoff §13 with its command; NOT this slice's to
     * fix (traps 171/173 — no widening of the oracle's catch).
     */
    it('seed 29: >= 5 kept obstacles over >= 3 families, and the KILL GATE is DISCHARGED', () => {
        const gen = generateSeedlingLevel({
            seed: 29, palette: POST_SWORD_PALETTE, bounds: { obstacleTarget: 6 },
        });
        expect(gen.summary.stop).toBe('TARGET_REACHED');
        expect(gen.summary.keptCount).toBeGreaterThanOrEqual(5);
        const families = new Set(gen.summary.kept.map((k) => k.family));
        expect(families.size).toBeGreaterThanOrEqual(3);
        expect(gen.summary.items).toEqual(POST_SWORD_ITEMS);
        /**
         * ⛔ THE SWORD-GATED MECHANISM IS ACTUALLY IN THE LEVEL — and it is an
         * ELEMENT, so it is asked of the SEAM's certification rather than of the
         * kept list. ⛓ A CERTIFIED element is not dropped, which is what makes
         * the final solve below able to meet it at all.
         */
        expect(gen.model.elementHead.name).toBe('killgate');
        expect(gen.certification.certified).toBe(true);
        expect(gen.summary.kept.filter((k) => k.family === 'kill')).toEqual([]);

        // ⛔ THE SEAM's model, not a bare one: the element is in the skeleton.
        const { model } = seedlingSeam({ seed: 29, items: POST_SWORD_PALETTE.items });
        const out = seedlingOracle({ model, items: POST_SWORD_PALETTE.items }).solve(gen.record, {
            templates: gen.summary.kept.map((k) => instantiateKept(POST_SWORD_PALETTE, k)),
        });
        expect(out.verdict).toBe('SOLVED');
        expect(out.certification.certified).toBe(true);

        // ⛔ DISCHARGE EXISTENCE, BOTH HALVES. The kill RECORD says the walk
        // fought the body; the scratch row says the fight is what opened the
        // lock. An obstacle nobody had to clear produces neither.
        const kills = (out.records ?? []).filter((r) => r.strategy === 'kill');
        expect(kills).toHaveLength(1);
        expect(out.scratchClears).toHaveLength(1);
        /**
         * ⛔⛔ **THE CAUSE IS `water`, NOT `sword`, AND THAT IS A FINDING RATHER
         * THAN A FIXED EXPECTATION** (arc 3, slice 4c). At seed 29 the kill
         * gate's own spinner DROWNS in a kept `water-pool` instead of being cut
         * down. The lifted claim still holds — this gate's own body cleared this
         * gate's own lock, before the crossing — and the `kill` RECORD above is
         * the solver planning that clear; what does not hold is that the level
         * is post-sword-EXCLUSIVE, because a swordless boot would have cleared
         * that body too.
         *
         * ⛓ THAT IS SLICE 4's OLD HEDGE RETURNING AS A MEASUREMENT (*"a
         * discharged clearer IN a post-sword level, NOT a post-sword-EXCLUSIVE
         * one"*). ⛔ AND THE CAUSE IS A PROPERTY OF THE BOUNDS RATHER THAN OF
         * THE ELEMENT: at **target 1** this very seed clears with
         * `cause: 'sword'` in 403 ticks (so does post-sword 60, at 551; 38
         * clears by `pit`). It is only once pass 2 has put a water pool in the
         * room that the pool gets to the spinner first. ⇒ *a kill gate in a
         * FURNISHED room may be cleared by the furniture* — a finding about the
         * level, not about the gate.
         *
         * ⛔ Written as a two-value set so the row REDS the day a sword-caused
         * clear becomes reachable AT THESE BOUNDS, which is the outcome a reader
         * of this file actually wants to hear about.
         */
        expect(['sword', 'water']).toContain(out.scratchClears[0].cause);
        expect(out.scratchClears[0].cause).toBe('water');
        expect(out.scratchClears[0].by).toMatch(/^spinner@/);
        expect(out.scratchClears[0].lock).toMatch(/^lock@/);
        // ⛓ …and the flag it cleared is NOT the goal's (the tag law, driven in
        // a generated room rather than only on the template literal).
        expect(String(out.scratchClears[0].tag)).not.toBe(SEEDLING_DEFAULTS.goalTag);
    });
});
