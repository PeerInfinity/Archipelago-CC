/**
 * seedlingDemo/procgenSeedling — THE SEEDLING BINDINGS: the one place the
 * substrate-agnostic loop meets this game.
 *
 * Seedling PROCGEN PoC arc, slice 2. `levelGenerator.js` imports nothing;
 * this file imports everything it needs and hands the loop the three injected
 * pieces kickoff §3.2 names — LEVEL MODEL, ORACLE, PALETTE. ⚖ §1.7's
 * provision, in full: one seam, one implementation, no framework. When a
 * second substrate exists and can argue about the interface, the core moves
 * and this file stays.
 *
 * ── WHAT THE MODEL OWES THE LOOP ──────────────────────────────────────
 *
 *   `skeleton()`      the bordered room + the goal pickup — the control that
 *                     must solve before any template is drawn
 *   `anchorFor(...)`  a LEGAL anchor for a template, drawn from the seeded
 *                     stream, or `null` when the room has no room for that
 *                     shape. ⛔ The legality test lives HERE and not in the
 *                     loop, because "legal" is a fact about Seedling's floor.
 *   `place(...)`      tiles and entities written TOGETHER (⚖ §1.2's atomic
 *                     placement), returning a NEW frozen record
 *
 * ── ⛓ THE ANCHOR SCAN IS SHUFFLE-THEN-FIRST, NOT REJECTION SAMPLING ───
 *
 * A rejection sampler ("draw a cell, test it, draw again") spends an
 * unbounded number of draws on a full room and makes the number of draws
 * depend on how full the room is — so two runs of one seed would agree only
 * as long as they agreed about everything before. The anchor is instead ONE
 * shuffle of the room's own cell list and the first legal cell in it: exactly
 * one shuffle per attempt, whatever the room looks like, and `null` when the
 * whole list is illegal. Determinism by construction rather than by luck.
 *
 * ⛔ NO NODE IMPORTS (see `atlasSource.js`) — this module is on the GENERATE
 * arm's path in the browser.
 */

import { arrowLaneForPlacement, arrowLaneRect, arrowTrapEntityPoint } from './arrowTrap.js';
import { TILE_SIZE } from './levelWorld.js';
import {
    ProcgenLevelError, SINGLE_SCREEN_TILES, bootAtTile, emptyLevel, oelAtTile,
    terrainAt, withEntities, withTerrain,
} from './procgenLevel.js';
import {
    DEFAULT_BUDGET, VERDICT, assertBudget, bootStaging, collectGoal, solve,
} from './procgenOracle.js';
import { PRE_SWORD_PALETTE } from './procgenPalette.js';
import { generateLevel } from './levelGenerator.js';
import { rngFor } from './procgenRng.js';

export class ProcgenSeedlingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProcgenSeedlingError';
    }
}

const fail = (message) => { throw new ProcgenSeedlingError(message); };

/**
 * ⚖ SLICE 1's CHOICES, INHERITED RATHER THAN RE-DECIDED.
 *
 * `torchpickup` is the goal class (§8.2: it clears its own tag, its volume is
 * the full 8x8 on the OEL point, and `hasTorch` couples to nothing the
 * palette depends on). The level id and the start cell are the proof
 * script's. Written as one frozen object so the CLI, the tests and any later
 * page arm cannot each pick their own and call the difference a finding.
 */
export const SEEDLING_DEFAULTS = Object.freeze({
    level: 900,
    width: SINGLE_SCREEN_TILES.width,
    height: SINGLE_SCREEN_TILES.height,
    goalClass: 'torchpickup',
    goalTag: '0',
    start: Object.freeze({ tx: 1, ty: 1 }),
});

/** The interior cells of a room — everything the wall ring does not hold. */
export function interiorCells(record) {
    const out = [];
    for (let ty = 1; ty < record.height - 1; ty += 1) {
        for (let tx = 1; tx < record.width - 1; tx += 1) out.push({ tx, ty });
    }
    return out;
}

/**
 * THE SEEDLING LEVEL MODEL — kickoff §3.2's first injection.
 *
 * @param {object} o
 * @param {number} o.seed        the level's identity; the goal cell is its
 *                               first consequence
 * @param {object} [o.defaults]  see `SEEDLING_DEFAULTS`
 */
export function seedlingModel({ seed, defaults = SEEDLING_DEFAULTS } = {}) {
    const d = { ...SEEDLING_DEFAULTS, ...defaults };
    /**
     * ⛔ THE GOAL CELL IS DRAWN FROM ITS OWN STREAM, not from the loop's.
     *
     * The room is built before the loop starts and its goal must not depend
     * on how many templates were drawn afterwards — otherwise the same seed
     * would place the goal differently the moment a bound changed, and "same
     * seed, same level" would be true only for one set of bounds. So the
     * model owns a stream seeded from the level's seed and the LOOP owns
     * another (`generateSeedlingLevel` below), which is why the two never
     * interleave.
     */
    const roomRng = rngFor(seed);
    const blank = emptyLevel({ level: d.level, width: d.width, height: d.height });
    const goalCandidates = interiorCells(blank)
        .filter((c) => !(c.tx === d.start.tx && c.ty === d.start.ty));
    const goalCell = roomRng.pick(goalCandidates);
    const goalOel = oelAtTile(goalCell.tx, goalCell.ty);
    const reserved = new Set([
        `${d.start.tx},${d.start.ty}`,
        `${goalCell.tx},${goalCell.ty}`,
    ]);

    const skeleton = () => withEntities(blank, [{
        type: d.goalClass, ...goalOel, attrs: { tag: d.goalTag },
    }]);

    /**
     * ⚠ "FREE" IS THREE CLAIMS AND THEY ARE ASKED SEPARATELY: the cell is
     * inside the interior rectangle, it still holds untouched `ground`
     * (`terrainAt` reads the record, so a cell an earlier template painted is
     * no longer free), and it is neither the start nor the goal. The last one
     * is not derivable from the first two — a pickup does not change the
     * terrain under it, and a wall dropped on the goal builds a room whose
     * refusal would be about geometry rather than about the template.
     */
    const isFree = (record, tx, ty) => tx > 0 && ty > 0
        && tx < record.width - 1 && ty < record.height - 1
        && !reserved.has(`${tx},${ty}`)
        && terrainAt(record, tx, ty) === 'ground'
        && !record.entities.some((e) => {
            const cx = Math.floor(e.x / TILE_SIZE);
            const cy = Math.floor(e.y / TILE_SIZE);
            return cx === tx && cy === ty;
        });

    /**
     * ⛓⛓ THE LANE RULE — the ENGINE's geometry, asked before the level exists.
     *
     * `arrowLaneForPlacement` takes a world PLACEMENT and there is no world
     * yet, so the placement is built the way `levelWorld` builds one: the
     * entity point is `arrowTrapEntityPoint(oelX, oelY)` — the ctor's own
     * `(+8, +2)`, truncated by `Activators(_x:int, _y:int)` — and the lane
     * follows from that. ⛔ Not one number of this is retyped here; if the
     * ctor offset changes, this rule changes with it.
     *
     * The rule itself: a lane that covers the START or the GOAL cell is not
     * an avoidable obstacle, so the anchor is refused. `arrowLaneRect` needs
     * the level's height IN PIXELS (its five call sites each supply their own
     * — the function owns the shape, not the lookup).
     */
    const laneClear = (record, tx, ty) => {
        const oel = oelAtTile(tx, ty);
        const point = arrowTrapEntityPoint(oel.x, oel.y);
        const lane = arrowLaneForPlacement({ id: `arrowtrap@${oel.x},${oel.y}`, t: 0, ex: point.x, ey: point.y });
        const laneRect = arrowLaneRect(lane, record.height * TILE_SIZE);
        for (const c of [d.start, goalCell]) {
            const box = {
                x: c.tx * TILE_SIZE,
                y: c.ty * TILE_SIZE,
                right: (c.tx + 1) * TILE_SIZE,
                bottom: (c.ty + 1) * TILE_SIZE,
            };
            // `rectsOverlap`'s own half-open test, on the two rects this rule
            // is about. (The engine's helper takes its own rect shape; the
            // comparison is the same four inequalities.)
            if (box.x < laneRect.x + laneRect.w && box.right > laneRect.x
                && box.y < laneRect.y + laneRect.h && box.bottom > laneRect.y) {
                return { ok: false, over: c === d.start ? 'the start cell' : 'the goal cell' };
            }
        }
        return { ok: true, lane, laneRect };
    };

    const legalAt = (record, template, tx, ty) => {
        for (const c of [...template.footprint, ...(template.clearance ?? [])]) {
            if (!isFree(record, tx + c.dx, ty + c.dy)) return false;
        }
        if (template.lane === 'avoidable' && !laneClear(record, tx, ty).ok) return false;
        return true;
    };

    return {
        placementError: ProcgenLevelError,
        defaults: Object.freeze(d),
        goalCell: Object.freeze({ ...goalCell }),
        goalOel: Object.freeze({ ...goalOel }),
        goals: Object.freeze([Object.freeze(collectGoal(goalOel.x, goalOel.y))]),
        boot: () => bootAtTile(blank, d.start.tx, d.start.ty),
        interiorCells,
        isFree,
        laneClear,
        skeleton,
        /**
         * One shuffle, then the first legal cell — see the docblock. The
         * shuffle is over the room's interior in a FIXED order (the empty
         * room's own scan order), so the draw depends on the seed and the
         * template and nothing else.
         */
        anchorFor(record, template, rng) {
            const cells = rng.shuffle(interiorCells(record));
            for (const c of cells) {
                if (legalAt(record, template, c.tx, c.ty)) return { tx: c.tx, ty: c.ty };
            }
            return null;
        },
        /**
         * ⚖ §1.2's ATOMIC PLACEMENT — tiles and entities in ONE step, so a
         * record never exists in which the obstacle is placed and its clearer
         * is not. Both halves are `procgenLevel`'s pure writers, so REVERT is
         * "keep the old record" and there is nothing to undo.
         */
        place(record, template, at) {
            let next = record;
            if ((template.terrain ?? []).length > 0) {
                next = withTerrain(next, template.terrain.map((w) => ({
                    tx: at.tx + w.dx, ty: at.ty + w.dy, terrain: w.terrain,
                })));
            }
            if ((template.entities ?? []).length > 0) {
                next = withEntities(next, template.entities.map((e) => ({
                    type: e.type,
                    ...oelAtTile(at.tx + e.dx, at.ty + e.dy),
                    ...(e.attrs ? { attrs: { ...e.attrs } } : {}),
                })));
            }
            if (next === record) {
                fail(`procgenSeedling: template "${template.name}" wrote NOTHING — no `
                    + 'tiles and no entities. A template that changes no record is an '
                    + 'obstacle that obstructs nothing, and the loop would KEEP it '
                    + '(the room still solves) and report it as a placed obstacle.');
            }
            return next;
        },
    };
}

/**
 * THE SEEDLING ORACLE — kickoff §3.2's second injection, over `procgenOracle`.
 *
 * ⛓⛓ THE PINS ARE COMPUTED FROM THE KEPT TEMPLATES, WHICH IS WHY THE LOOP
 * PASSES THEM. `bootStaging` takes `pins` as an argument precisely so a water
 * template can add `'sound'` by ARGUMENT rather than by editing the boot
 * (slice 1 §8.7), and the union is taken over the templates a candidate
 * actually contains — including the one being tried, because the solve is of
 * the room WITH it.
 *
 * ⚠ THE STAGING IS REBUILT PER SOLVE and that is the point: ⚖ kickoff §3.1
 * step 3 says *"re-solve from scratch from the biome's boot"*. A staging
 * object reused across solves would carry whatever the last run left on it.
 */
export function seedlingOracle({ model, items = null, budget = DEFAULT_BUDGET } = {}) {
    const b = assertBudget(budget);
    const boot = model.boot();
    return {
        budget: b,
        pinsFor: (templates) => {
            const pins = new Set(['dead_frames']);
            for (const t of templates ?? []) for (const p of t.pins ?? []) pins.add(p);
            return [...pins];
        },
        solve(record, { templates = [] } = {}) {
            const pins = this.pinsFor(templates);
            const staging = bootStaging({ boot, items, pins });
            return solve(record, staging, model.goals, b,
                { name: `procgen-l${record.level}` });
        },
    };
}

/**
 * GENERATE ONE SEEDLING LEVEL — the whole seam, wired.
 *
 * ⛔ TWO STREAMS, TWO SEEDS FROM ONE. The model's room stream and the loop's
 * template stream are separate `ProcgenRng`s built from the SAME seed, so the
 * level's identity is one number and neither stream can shift the other by
 * spending a draw. (They therefore produce the same sequence — which is
 * harmless, because they are consumed for different things.)
 */
export function generateSeedlingLevel({
    seed, palette = PRE_SWORD_PALETTE, bounds, budget = DEFAULT_BUDGET, defaults,
} = {}) {
    const model = seedlingModel({ seed, defaults });
    const oracle = seedlingOracle({ model, items: palette.items ?? null, budget });
    const out = generateLevel({ rng: rngFor(seed), model, oracle, palette, bounds });
    return {
        ...out,
        model,
        summary: Object.freeze({
            ...out.summary,
            goalCell: model.goalCell,
            goalOel: model.goalOel,
            goalClass: model.defaults.goalClass,
            startCell: model.defaults.start,
            items: palette.items ?? null,
            pins: oracle.pinsFor(out.summary.kept.map((k) => palette.templates
                .find((t) => t.name === k.template))),
        }),
    };
}

export { VERDICT };
