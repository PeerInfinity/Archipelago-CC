/**
 * seedlingDemo — **PASS 2 HONOURS THE KILL GATE'S `demand`**, and the
 * `require:['hasSword']` directive's verdicts (PROCGEN ELEMENTS arc 3, slice 4d,
 * D3(ii) + D1).
 *
 * ⛓ The demand's GEOMETRY is gated in `procgenCore/elements/roomDoorBodyRegion
 * .test.js`, on hand-drawn floor sets. THIS file is the other half: the real
 * model, the real `refusalAt` chain, and the real seam — one law, two callers,
 * both with rows.
 *
 * ⛔ THE MEASUREMENT BEHIND IT, so a reader knows what these rows defend. Over
 * 224 (kind, arm, seed) cells, TEN kill gates placed and certified and every one
 * had its lock CLEARED — **eight by `sword` and TWO by `water`**: pass-2
 * furniture drowned the spinner and the gate opened for a reason the level did
 * not pose. With the demand it is 17 of 17 `sword`
 * (`scripts/procgen/census-seedling-killgate-clears.mjs`).
 */

import { describe, expect, it } from 'vitest';

import {
    POST_SWORD_ITEMS, POST_SWORD_PALETTE, PRE_SWORD_PALETTE,
} from './procgenPalette.js';
import { generateSeedlingLevel, seedlingSeam } from './procgenSeedling.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';

const instance = (name, overrides) => POST_SWORD_PALETTE.templates
    .find((t) => t.name === name).instantiate(null, overrides);

/** ⛓ Seed 2 on the open room is the arc's cheapest CERTIFIED kill gate — the
 *  demo search's own table names it, and the seam places it without a draw. */
const KILL_GATE_SEED = 2;

/**
 * ⛓ BUILT ONCE. The seam runs a real CERTIFICATION SOLVE (~9 s here), and three
 * rows asking the same question three times is 18 s of nothing.
 */
const SEAM = seedlingSeam({
    seed: KILL_GATE_SEED, items: POST_SWORD_ITEMS, elements: parseElementSpec('killgate'),
});

describe('the demand reaches pass 2 through the ONE refusal chain', () => {
    it('the seed places and CERTIFIES a kill gate, and the placement carries a `demand`', () => {
        const { model, certification } = SEAM;
        expect(certification.certified).toBe(true);
        expect(model.elements.ran).toBe(true);
        const placed = model.elements.placed[0];
        expect(placed.family).toBe('killgate');
        /**
         * ⛔ THE DEMAND IS NOT ON `placed`, and that is deliberate: the binding
         * copies `placed` onto `certification.geometry`, which the PAYLOAD
         * ships, and a cell list there would move every committed kill-gate row
         * for a number a reader can re-derive. It reaches `elementRefusalAt`
         * off the PLACEMENT instead. The rows below are what prove it arrived.
         */
        expect(placed.demand).toBeUndefined();
    });

    it('⛓⛓⛓ A WATER POOL ON A DEMANDED CELL IS REFUSED BY NAME, and the SAME pool one cell '
        + 'off is LEGAL', () => {
        const { model } = SEAM;
        const sk = model.skeleton();
        const pool = instance('water-pool', { w: 1, h: 1 });
        /**
         * ⛓ THE SUBJECT IS FOUND, NOT PICKED (trap 285). Walk the interior for
         * the first cell where a 1x1 pool is refused for the DEMAND and some
         * other interior cell where the same pool is legal — so the row is about
         * the demand and not about a cell that happened to be busy.
         */
        let demanded = null;
        let free = null;
        for (let ty = 1; ty < sk.height - 1 && (!demanded || !free); ty += 1) {
            for (let tx = 1; tx < sk.width - 1 && (!demanded || !free); tx += 1) {
                const why = model.refusalAt(sk, pool, tx, ty);
                if (why === null) free ??= { tx, ty };
                else if (/is DEMANDED/.test(why)) demanded ??= { tx, ty, why };
            }
        }
        expect(demanded, 'some interior cell is DEMANDED by the element').not.toBe(null);
        expect(free, 'some interior cell is free for the same pool').not.toBe(null);
        expect(demanded.why).toMatch(/is DEMANDED `floor` by the ELEMENT/);
        expect(demanded.why).toMatch(/DROWNS the body/);
        // ⛔ AND IT IS NOT THE OWNERSHIP SENTENCE — a demanded cell is not owned.
        expect(demanded.why).not.toMatch(/belongs to the ELEMENT/);
        expect(model.refusalAt(sk, pool, free.tx, free.ty)).toBeNull();
    });

    it('⛔ A DEMANDED `floor` CELL IS STILL FREE AS A CELL — the demand is about the TERRAIN '
        + 'that would be written, never about the cell', () => {
        const { model } = SEAM;
        const sk = model.skeleton();
        const pool = instance('water-pool', { w: 1, h: 1 });
        /**
         * ⛓ COUNTED, NOT ASSUMED. A cell can be refused for the demand AND be
         * unfree for one of `freeRefusal`'s own reasons (it is the start or the
         * goal, an earlier template painted it, it holds an entity) — so the
         * subject is a demanded cell that is otherwise free, and the row asserts
         * such a cell EXISTS before asserting anything about it.
         */
        const both = [];
        for (let ty = 1; ty < sk.height - 1; ty += 1) {
            for (let tx = 1; tx < sk.width - 1; tx += 1) {
                const why = model.refusalAt(sk, pool, tx, ty);
                if (why !== null && /is DEMANDED `floor`/.test(why)
                    && model.isFree(sk, tx, ty)) both.push({ tx, ty });
            }
        }
        expect(both.length, 'some DEMANDED cell is otherwise free').toBeGreaterThan(0);
        /**
         * ⛓ `isFree` ASKS ABOUT THE CELL AND ANSWERS `true` — which is right,
         * and is why `elementRefusalAt` grew an ARGUMENT rather than refusing
         * the cell outright. A page's click on a demanded cell is not illegal;
         * a water pool written there is.
         */
        for (const c of both) expect(model.isFree(sk, c.tx, c.ty)).toBe(true);
    });

    it('⛓ AT `--elements=none` THE DEMAND SET IS EMPTY and nothing is refused for it', () => {
        const { model } = seedlingSeam({
            seed: KILL_GATE_SEED, items: POST_SWORD_ITEMS, elements: parseElementSpec('none'),
        });
        const sk = model.skeleton();
        const pool = instance('water-pool', { w: 1, h: 1 });
        for (let ty = 1; ty < sk.height - 1; ty += 1) {
            for (let tx = 1; tx < sk.width - 1; tx += 1) {
                expect(model.refusalAt(sk, pool, tx, ty) ?? '').not.toMatch(/is DEMANDED/);
            }
        }
    });
});

describe('`summary.require` — omitted when untyped, and NAMED on every refusal', () => {
    /**
     * ⛓ A ONE-STEP LADDER, and it is a COST choice with a stated reason: these
     * rows are about `summary.require`, and the DIRECTIVE's verdict does not
     * depend on how many templates pass 2 kept — the certification is on the
     * SKELETON and the differential's two arms are both solves of whatever
     * level came out. At `DEFAULT_BOUNDS` (target 6, 8 tries) one row costs
     * ~30 s under vitest's parallel load and the file crossed the 60 s timeout.
     */
    const BOUNDS = Object.freeze({ obstacleTarget: 1, triesPerStep: 1, saturationK: 1,
        anchorTriesPerCandidate: 1 });
    const gen = (extra) => generateSeedlingLevel({
        seed: KILL_GATE_SEED, palette: POST_SWORD_PALETTE, bounds: BOUNDS, ...extra,
    });

    it('⛔ OMITTED ENTIRELY when nothing was asked — the byte-inertness the arc lives on', () => {
        const out = gen({});
        expect('require' in out.summary).toBe(false);
        expect(out.require).toBe(null);
    });

    /**
     * ⛔ 120 s ON THIS ROW ALONE, and the number is MEASURED rather than round.
     * It is the only row that runs the DIFFERENTIAL end to end, and the
     * expensive half is the WITHOUT arm: with no sword the press is a silent
     * no-op, so the solver walks the whole COMBAT LADDER against a body that
     * cannot die before refusing. Measured at **31.3 / 31.6 / 31.4 s** at
     * `maxTicksPerTarget` 150 / 200 / 250 — the cost is the ladder, not the
     * budget, so there is no cheaper bound to pick. The file's other nine rows
     * are inside the suite's own 60 s.
     */
    it('MET, with the grade and both arms, when the room can carry it', () => {
        const out = gen({ require: ['hasSword'] });
        const r = out.summary.require;
        expect(r.met).toBe(true);
        expect(r.asked).toEqual(['hasSword']);
        expect(r.element).toBe('killgate');
        expect(r.forced).toBe(true);
        expect(r.spec).toBe('killgate');
        expect(r.grade).toBe('STRONG');
        expect(r.with.verdict).toBe('SOLVED');
        expect(r.without.verdict).toBe('REFUSED');
        expect(r.refused).toBe(null);
    }, 120000);

    it('`the-biome-lacks-the-item` on the PRE-SWORD boot', () => {
        const out = generateSeedlingLevel({
            seed: KILL_GATE_SEED, palette: PRE_SWORD_PALETTE, bounds: BOUNDS,
            require: ['hasSword'],
        });
        expect(out.summary.require.met).toBe(false);
        expect(out.summary.require.refused.reason).toBe('the-biome-lacks-the-item');
    });

    it('`no-element-needs-this-item` for an item nothing is gated on', () => {
        const out = gen({ require: ['hasShield'] });
        expect(out.summary.require.refused.reason).toBe('no-element-needs-this-item');
    });

    it('`the-directive-and-the-spec-disagree` when an explicit spec omits the head', () => {
        const out = gen({ require: ['hasSword'], elements: parseElementSpec('guard;len=2') });
        expect(out.summary.require.refused.reason).toBe('the-directive-and-the-spec-disagree');
    });

    it('⛓⛓ `the-required-element-did-not-certify` — and NOT the was-refused name, because a '
        + 'DROPPED element FIT the room and the SOLVER is what could not walk it', () => {
        /**
         * ⛓ SUBJECT FOUND BY SCAN, not picked: the first seed in 1..12 whose
         * forced kill gate places and fails its certification solve. ⛔ The two
         * refusals are ordered by the PIPELINE (trap 357) and this row is what
         * holds that order — a placement check asked first reports every
         * uncertified gate as one the ROOM could not host.
         */
        let hit = null;
        for (let seed = 1; seed <= 12 && !hit; seed += 1) {
            let out;
            try {
                out = generateSeedlingLevel({
                    seed, palette: POST_SWORD_PALETTE, bounds: BOUNDS, require: ['hasSword'],
                });
            } catch { continue; }
            const r = out.summary.require;
            if (!r.met && /did-not-certify/.test(r.refused.reason)) hit = { seed, r };
        }
        expect(hit, 'some seed in 1..12 places a kill gate the solver cannot certify')
            .not.toBe(null);
        expect(hit.r.refused.reason).toMatch(/^the-required-element-did-not-certify: /);
        expect(hit.r.grade).toBe(null);
    });
});
