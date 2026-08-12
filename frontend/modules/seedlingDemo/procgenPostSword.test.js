/**
 * seedlingDemo/procgenPostSword.test — **THE SECOND BIOME, AND THE FOUR
 * FAMILIES MEASUREMENT KEPT OUT OF IT.**
 *
 * Seedling PROCGEN PoC arc, slice 4 (kickoff §4.4). ⚖ §0 splits the arc into
 * TWO BIOMES on one flag; ⚖ §10.7 expired §9.8's advice to carry the
 * post-sword clearer families across as inherited exclusions and required a
 * re-probe FROM SCRATCH. This file is that re-probe, driven.
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
    assertPalette,
} from './procgenPalette.js';
import {
    bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain,
} from './procgenLevel.js';
import { DEFAULT_BUDGET, bootStaging, collectGoal, solve } from './procgenOracle.js';
import {
    SEEDLING_DEFAULTS, generateSeedlingLevel, seedlingModel, seedlingOracle,
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
        boot: bootAtTile(record, START.tx, START.ty), items, pins: ['dead_frames'],
    });
    if (save) staging.save = { totem_parts: [], keys: [], seal_parts: [], ...save };
    try {
        const out = solve(record, staging,
            [collectGoal(spec.goal.tx * 16, spec.goal.ty * 16)], DEFAULT_BUDGET, { name });
        const verbs = new Set();
        for (const r of out.rows ?? []) if (r.strategy?.verb) verbs.add(r.strategy.verb);
        for (const r of out.records ?? []) if (r.strategy) verbs.add(r.strategy);
        return { verdict: out.verdict, ticks: out.ticks, verbs, reasonText: out.reasonText };
    } catch (e) {
        return { verdict: `THREW:${e.name}`, threw: e.name, reasonText: e.message, verbs: new Set() };
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

    it('shares the roster BY REFERENCE, so a template cannot reach one biome only', () => {
        expect(POST_SWORD_TEMPLATES).toBe(PRE_SWORD_TEMPLATES);
        expect(assertPalette(POST_SWORD_PALETTE)).toBe(true);
    });

    it('each biome carries its OWN exclusions, and they are different lists', () => {
        expect(PRE_SWORD_PALETTE.excluded).not.toBe(POST_SWORD_PALETTE.excluded);
        const post = POST_SWORD_EXCLUDED_TEMPLATES.map((x) => x.name);
        expect(post).toEqual([
            'chest-in-the-gap', 'spinner-killlock', 'key-keylock-pair', 'shieldboss-door',
        ]);
        for (const x of POST_SWORD_EXCLUDED_TEMPLATES) {
            for (const field of ['cause', 'measured', 'refusalText', 'wouldNeed']) {
                expect(typeof x[field]).toBe('string');
                expect(x[field].length).toBeGreaterThan(0);
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
    it('⛔ generates a BYTE-IDENTICAL level and trace to the pre-sword biome', () => {
        const bounds = { obstacleTarget: 6 };
        const pre = generateSeedlingLevel({ seed: 9, palette: PRE_SWORD_PALETTE, bounds });
        const post = generateSeedlingLevel({ seed: 9, palette: POST_SWORD_PALETTE, bounds });
        expect(JSON.stringify(post.record)).toBe(JSON.stringify(pre.record));
        expect(JSON.stringify(post.trace)).toBe(JSON.stringify(pre.trace));
        // …and the ONE thing that does differ is the inventory it was solved under.
        expect(post.summary.items).toEqual(POST_SWORD_ITEMS);
        expect(pre.summary.items).toEqual(PRE_SWORD_ITEMS);
        expect(post.summary.palette).toBe('post-sword');
    });

    it('and the same room under both boots gives the same verdict and tick count', () => {
        const gen = generateSeedlingLevel({
            seed: 1, palette: PRE_SWORD_PALETTE, bounds: { obstacleTarget: 6 },
        });
        const model = seedlingModel({ seed: 1 });
        const templates = gen.summary.kept
            .map((k) => POST_SWORD_TEMPLATES.find((t) => t.name === k.template));
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
     * ⛓ THE SPINNER + KILL-LOCK. ⚠ ONE cell of the 32-cell sweep — the sweep
     * is in the as-built. What this pins is the CLASS of the failure, because
     * a throw is what makes the family unfit for the palette: `procgenOracle`
     * classifies only `SolverRefusal` and `BotDriverV2Error`, so anything else
     * reaches `levelGenerator` as `GenerationAborted` and kills the RUN rather
     * than the candidate.
     */
    it('spinner-killlock: the failure ESCAPES the oracle — an abort, not a revert', () => {
        const out = attempt('spinner-killlock', {
            goal: { tx: 7, ty: 8 },
            entities: [
                { type: 'lock', tx: 4, ty: 5, attrs: { tset: '-1', tag: '0' } },
                { type: 'spinner', tx: 6, ty: 2, attrs: { tag: '-1' } },
            ],
        });
        expect(out.verdict).not.toBe('SOLVED');
        expect(out.threw).toBeTruthy();
        expect(['SolverBotError', 'Error']).toContain(out.threw);
        // The row's decisive text is the DECLARATION one, and it names the channel.
        expect(excludedNamed('spinner-killlock').refusalText)
            .toMatch(/The tape DECLARES no clear for them/);
        expect(excludedNamed('spinner-killlock').refusalText)
            .toMatch(/declared v9 `at` channel/);
        expect(excludedNamed('spinner-killlock').wouldNeed).toMatch(/TWO-PASS DEBT/);
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

    /** Trap 199: a row added without a driven case is a FAILING test. */
    it('every excluded row above is one this file actually drove', () => {
        const driven = new Set([
            'chest-in-the-gap', 'key-keylock-pair', 'spinner-killlock', 'shieldboss-door',
        ]);
        for (const x of POST_SWORD_EXCLUDED_TEMPLATES) expect(driven.has(x.name)).toBe(true);
        expect(driven.size).toBe(POST_SWORD_EXCLUDED_TEMPLATES.length);
    });
});

describe('⛓ THE DEMONSTRATION — a certified post-sword level with a DISCHARGED clearer', () => {
    /**
     * ⚖ Kickoff §4.4 scope 3, restated honestly under the orchestrator's
     * ruling: the discharged clearer is `weigh` IN A POST-SWORD LEVEL, and it
     * is NOT a post-sword-exclusive one — there is no such family (see the
     * exclusions above). The claim is the §11.7 standard: a RECORD, never a
     * keep-count.
     */
    it('seed 13: >= 5 kept obstacles over >= 3 families, and `weigh` is DISCHARGED', () => {
        const gen = generateSeedlingLevel({
            seed: 13, palette: POST_SWORD_PALETTE, bounds: { obstacleTarget: 6 },
        });
        expect(gen.summary.stop).toBe('TARGET_REACHED');
        expect(gen.summary.keptCount).toBeGreaterThanOrEqual(5);
        const families = new Set(gen.summary.kept.map((k) => k.family));
        expect(families.size).toBeGreaterThanOrEqual(3);
        expect(gen.summary.items).toEqual(POST_SWORD_ITEMS);

        const model = seedlingModel({ seed: 13 });
        const out = seedlingOracle({ model, items: POST_SWORD_PALETTE.items }).solve(gen.record, {
            templates: gen.summary.kept
                .map((k) => POST_SWORD_TEMPLATES.find((t) => t.name === k.template)),
        });
        expect(out.verdict).toBe('SOLVED');
        expect(out.certification.certified).toBe(true);

        const weighs = (out.records ?? []).filter((r) => r.strategy === 'weigh');
        expect(weighs).toHaveLength(1);
        // ⛔ THE DWELL IS THE PROOF (§11.6): a dwell that ended on the group's
        // own observable is a lock that opened with NOBODY on the presser — a
        // `hold` cannot produce that record, and neither can an obstacle the
        // walk never met.
        expect(weighs[0].dwell?.until).toMatch(/is open/);
        expect(weighs[0].shove?.from).not.toEqual(weighs[0].shove?.to);
    });
});
