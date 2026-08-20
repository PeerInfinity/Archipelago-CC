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
import { DEFAULT_BUDGET } from './procgenOracle.js';
import { TILE_SIZE } from './levelWorld.js';
import { newSpinner, stepSpinner } from './spinner.js';
import { buildKillGate } from '../procgenCore/elements/killGate.js';
import {
    TILE_FLOOR, cellKey, inInterior, writesOf,
} from '../procgenCore/elements/roomDoor.js';

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


/**
 * ⛓⛓⛓ **THE STEPPED SET IS A FUNCTION OF A TICK BOUND** — PROCGEN ELEMENTS
 * arc 5, slice 2, and this row is what keeps §18.2 C4's refutation a CHECKED
 * claim rather than a paragraph.
 *
 * ⛔ THE CLAIM: the "exact" demand C4 asked for — the body's own stepped path
 * instead of `bodyRegion`'s flood — is exact only relative to how long the
 * body is stepped, and the 400 the measurement used is
 * `DEFAULT_BUDGET.maxTicksPerTarget`, which is the SOLVER's per-target budget
 * and says nothing about the spinner. Step it longer and the set GROWS INTO
 * THE FLOOD. ⇒ a demand built on the short walk forbids fewer cells than the
 * body really visits, which is unsound, and one built on a long walk is the
 * flood already, which buys nothing.
 *
 * ⛔ It steps the SAME function the game does (`spinner.stepSpinner`) over the
 * SAME construct-time room the element demanded on (`buildKillGate`'s own
 * candidate, its writes applied and the door shut) — not a re-spelling of
 * either (trap 417).
 */
describe('⛓⛓ the STEPPED demand C4 asked for is a function of the TICK BOUND', () => {
    const steppedCells = (solid, from, ticks) => {
        const collides = (r) => {
            for (let ty = Math.floor(r.y / TILE_SIZE);
                ty <= Math.floor((r.bottom - 1) / TILE_SIZE); ty += 1) {
                for (let tx = Math.floor(r.x / TILE_SIZE);
                    tx <= Math.floor((r.right - 1) / TILE_SIZE); tx += 1) {
                    if (solid(tx, ty)) return { tx, ty };
                }
            }
            return null;
        };
        let sp = newSpinner({ id: 'row', x: from.x * TILE_SIZE, y: from.y * TILE_SIZE });
        const seen = new Set();
        for (let t = 0; t < ticks; t += 1) {
            seen.add(cellKey(Math.floor(sp.x / TILE_SIZE), Math.floor(sp.y / TILE_SIZE)));
            sp = stepSpinner(sp, { collides: (rect) => collides(rect), noTerrain: true });
        }
        return seen;
    };

    it('⛔ 400 is the SOLVER\'s per-target budget, not a property of the body', () => {
        expect(DEFAULT_BUDGET.maxTicksPerTarget).toBe(400);
    });

    it('⛓⛓⛓ the stepped set GROWS with the bound and reaches the flood exactly — '
        + 'so the flood is its LIMIT, not an over-approximation', () => {
        const { model } = SEAM;
        const placed = model.elements.placed[0];
        const probe = model.roomProbe();
        const built = buildKillGate(probe);
        const door = placed.doorCell;
        const pocket = placed.clearer[0];
        const pick = (built.candidates ?? []).find((c) => c.cand.cell.x === door.x
            && c.cand.cell.y === door.y && c.pocket.cell.x === pocket.x
            && c.pocket.cell.y === pocket.y);
        expect(pick, 'the census matches the SHIPPED candidate or every number '
            + 'below is about a different placement').toBeTruthy();

        const writes = writesOf(pick.tiles);
        const solid = (x, y) => {
            if (!inInterior(probe, x, y)) return true;
            if (x === door.x && y === door.y) return true;
            const w = writes.get(cellKey(x, y));
            return w === undefined ? !probe.floorAt(x, y) : w !== TILE_FLOOR;
        };
        const region = pick.body.region;
        /**
         * ⛔⛔ **THE BOUNDS ARE 100/200/400 AND NOT 400/800/1600, BECAUSE ON
         * THIS SUBJECT 400 IS ALREADY ENOUGH** — its stepped set reaches the
         * flood's 16 cells exactly there. A row written at 400/800/1600 would
         * read `[16, 16, 16]`, assert monotonicity over a constant and END at
         * the flood by doing nothing: green, and blind to the mutation it
         * exists to catch (trap 296). The bounds below are the ones this gate
         * can DISCRIMINATE, and the first assertion is the non-vacuity.
         *
         * ⚠ THAT THE SHIPPED 400 IS ITSELF SHORT ON SOME GATES is a corpus
         * MEASUREMENT, not this row: `empty` post-sword seed 29 under the
         * biome default list is 25 of 40 at 400 and all 40 from 1600
         * (`census-seedling-killgate-clears.mjs`; arc 5 slice 2's as-built).
         * A unit row cannot hold a level that costs a certification solve.
         */
        const bounds = [100, 200, DEFAULT_BUDGET.maxTicksPerTarget];
        const sizes = bounds.map((t) => steppedCells(solid, pocket, t).size);
        expect(sizes[0], 'the shortest bound must be SHORT of the flood or this '
            + 'row asserts growth over a constant').toBeLessThan(region.size);
        // ⛔ MONOTONE, and it ENDS at the flood — the two claims that together
        // say the flood is where the body goes given time.
        for (let i = 1; i < sizes.length; i += 1) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
        expect(sizes[sizes.length - 1]).toBe(region.size);
        // and no step ever leaves the flood, at any bound
        for (const t of [100, 3200]) {
            for (const k of steppedCells(solid, pocket, t)) expect(region.has(k)).toBe(true);
        }
    });
});
