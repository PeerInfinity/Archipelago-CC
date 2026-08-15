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
 *   `anchorsFor(...)` up to `limit` LEGAL anchors for a template, in one
 *                     seeded shuffle's order, or `[]` when the room has no
 *                     room for that shape. ⛔ The legality test lives HERE and
 *                     not in the loop, because "legal" is a fact about
 *                     Seedling's floor. ⛓ It returns a LIST since slice 3 of
 *                     the GENERATE-mode UI arc — the loop walks it until one
 *                     anchor SOLVES, bounded by `anchorTriesPerCandidate`.
 *   `refusalAt(...)`  ⛓ slice 6 of the GENERATE-mode UI arc: WHY one named
 *                     cell is refused, in the model's own words, or `null`.
 *                     `legalAt` is DERIVED from it, so the loop's silent
 *                     boolean and the page's sentence are one adjudication.
 *   `place(...)`      tiles and entities written TOGETHER (⚖ §1.2's atomic
 *                     placement), returning a NEW frozen record
 *
 * ── ⛓ THE ANCHOR SCAN IS SHUFFLE-THEN-FIRST, NOT REJECTION SAMPLING ───
 *
 * A rejection sampler ("draw a cell, test it, draw again") spends an
 * unbounded number of draws on a full room and makes the number of draws
 * depend on how full the room is — so two runs of one seed would agree only
 * as long as they agreed about everything before. The anchor is instead ONE
 * shuffle of the room's own cell list and the first legal cells in it:
 * exactly ONE shuffle per attempt, whatever the room looks like and whatever
 * `anchorTriesPerCandidate` is, and an EMPTY list when the whole interior is
 * illegal. Determinism by construction rather than by luck — and the bound
 * only decides how far down an order the stream has already fixed the loop is
 * allowed to walk, which is why raising it moves no earlier draw.
 *
 * ⛔ NO NODE IMPORTS (see `atlasSource.js`) — this module is on the GENERATE
 * arm's path in the browser.
 */

import { arrowLaneForPlacement, arrowLaneRect, arrowTrapEntityPoint } from './arrowTrap.js';
import { TILE_SIZE, tagOf } from './levelWorld.js';
import {
    ProcgenLevelError, SINGLE_SCREEN_TILES, bootAtTile, emptyLevel, oelAtTile,
    terrainAt, withEntities, withTerrain,
} from './procgenLevel.js';
import {
    DEFAULT_BUDGET, VERDICT, assertBudget, bootStaging, collectGoal, solve,
} from './procgenOracle.js';
import {
    PLACEMENT_GROUP, PLACEMENT_TAG, PRE_SWORD_PALETTE, instantiateKept,
} from './procgenPalette.js';
import { TAGS_PER_LEVEL } from './breakableRocks.js';
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

/**
 * ⛓⛓⛓ THE PLACEMENT'S OWN ACTIVATOR GROUP, DERIVED FROM ITS ANCHOR.
 *
 * ⚖ USER-REPORTED DEFECT, 2026-08-13 (`procgenPalette.PLACEMENT_GROUP` carries
 * the measurement): two placements of a switch/door template shared the group
 * literal in the table, so every button opened every lock. The group has to
 * become a per-PLACEMENT value, and WHICH per-placement value is a claim about
 * determinism rather than a detail — so it is declared here rather than left to
 * be read off a diff.
 *
 * ── ⛔ THE ALLOCATOR IS THE ANCHOR, NOT A COUNTER, AND THAT IS THE POINT
 *
 * Three shapes were on the table and two of them make the level a function of
 * something other than its own geometry:
 *
 *  · **a counter bumped in `place`** — ⛔ `levelGenerator` calls `place` on
 *    EVERY candidate, including the ones the oracle then rejects (:330, above
 *    the `keep` at :380). So the kept groups would come out sparse (3, 7, …)
 *    and the id would encode the REJECTION HISTORY: still deterministic, but a
 *    different function of the seed, and one that moves the moment a bound or
 *    an oracle verdict changes. It also makes `place` impure — two calls with
 *    the same arguments would stop returning the same record.
 *  · **a counter bumped at KEEP** — contiguous ids, but the value is not in the
 *    record `place` built, so the level would need a second pass. ⛔ That
 *    breaks ⚖ §1.2's ATOMIC placement, which exists so no record ever holds an
 *    obstacle without its clearer.
 *  · **the anchor** — what this is. `place` STAYS PURE, and the id is a
 *    function of the level's own geometry: the same template kept at the same
 *    cell is the same group whatever the loop tried and threw away first.
 *
 * ⇒ ⚖ DECLARED: **same seed, same level** is preserved, and the stronger
 * property is preserved with it — a placement's group depends on WHERE IT
 * LANDED and on nothing else.
 *
 * ── WHY THE ARITHMETIC IS SAFE, FIELD BY FIELD ────────────────────────
 *
 * ⛓ **INJECTIVE**: `tx * height + ty` is the standard column-major index and
 * `ty <= height - 2` inside the interior, so no two cells share an id. Two kept
 * placements cannot share an anchor anyway — `assertGroupSlot` requires a
 * group-bearing template to WRITE its own `(0,0)`, and `isFree` refuses a
 * painted or occupied cell — so the two guarantees are belt and braces on
 * purpose: the arithmetic holds even if the loop ever placed at a repeated
 * anchor, and the palette check holds even if the arithmetic changed.
 *
 * ⛔ **STRICTLY POSITIVE**, via the `+ 1`, and that is a HARD requirement
 * rather than tidiness. The engine's group vocabulary is signed and the
 * negatives are CLAIMED: `levelWorld.FORCED_TSET` holds −1 (`bosslock`) and −2
 * (`shieldlock`), and `levelWorld` reads `tSetOf(...) < 0` as *lock-despawn*
 * in two places. Group **0** is claimed too — it is what `intAttr` returns for
 * a MISSING `tset`, i.e. the group every unmarked activator in the room is
 * already in. Ids from 1 up are the only unclaimed range.
 *
 * ⚠ **NOT BOUNDED ABOVE**, and it does not need to be: the group is matched by
 * EQUALITY, never used as an index (`activators.js`'s transcription of the
 * setter — `if (v[i] != this && v[i].t == t)` — and `solverBot`'s
 * `pressers.filter((p) => p.t === row.t)`). The atlas's habit of small integers
 * is a fact about hand-built rooms, not a ceiling this has to respect.
 */
export function placementGroupId(at, height) {
    return at.tx * height + at.ty + 1;
}

/**
 * ⛓⛓⛓ THE PLACEMENT'S OWN PERSISTENCE TAG — the LOWEST FREE SLOT IN THE
 * RECORD, and the allocator is a different shape from the group's on purpose.
 *
 * See `procgenPalette.PLACEMENT_TAG` for the defect (every weigh lock was
 * writing the GOAL's flag) and for why `-1` is not the fix.
 *
 * ⛔ THE GROUP'S ANCHOR ARITHMETIC CANNOT SERVE THIS. `placementGroupId` is
 * `tx * height + ty + 1`, which reaches ~89 in a 10x10 room, and a tag is
 * bounded by `TAGS_PER_LEVEL` — `Game.tagsPerLevel = 30` (`Game.as:525`),
 * imported rather than retyped. ⚠ AND OVERFLOW DOES NOT ERROR: the game's
 * table is one flat array indexed `level * 30 + tag` with no bounds check, so
 * a tag of 30 writes the NEXT LEVEL'S first slot. A modulo would have been
 * worse than useless — it would collide two placements silently, which is the
 * exact defect being fixed.
 *
 * ── ⚖ WHAT THIS IS A FUNCTION OF, DECLARED
 *
 * **The RECORD, and nothing else.** The tag is the lowest non-negative integer
 * below `TAGS_PER_LEVEL` that no entity in the record already uses and that is
 * not reserved. That buys the same three properties the group has, by a
 * different route:
 *
 *  · **PURE** — `place` stays a function of `(record, template, at)`. Two calls
 *    with the same arguments return the same record.
 *  · **NO REJECTION HISTORY** — `levelGenerator` calls `place` on candidates it
 *    then throws away, but a rejected candidate never enters the record, so
 *    nothing it did can shift a later tag. A COUNTER would have failed exactly
 *    here.
 *  · **CONTIGUOUS AND SMALL** — tags come out 1, 2, 3… which is what a
 *    30-slot budget wants, and what an anchor-derived id could never give.
 *
 * ⛓ THE USED SET IS READ WITH THE ENGINE'S OWN `tagOf`, never by re-reading
 * `attrs.tag`: a missing attribute is -1 (untagged) and `FORCED_TAG` decides
 * the value for four classes outright. A second reading of that rule here
 * would be a second cost model.
 *
 * @param {object} record    the level so far — the goal pickup is already in it
 * @param {number[]} reserved tags no placement may take, whatever the record says
 */
export function placementTagId(record, reserved = []) {
    const used = new Set(reserved.filter((t) => Number.isInteger(t) && t >= 0));
    for (const e of record.entities ?? []) {
        const t = tagOf(e.type, e.attrs);
        if (t >= 0) used.add(t);
    }
    for (let t = 0; t < TAGS_PER_LEVEL; t += 1) if (!used.has(t)) return t;
    /**
     * ⛔ REFUSED BY NAME, never wrapped. ⚠ The vanilla game's own busiest room
     * (`Dungeon4/2.oel`) uses 23 distinct tags of the 30, so this ceiling is
     * real rather than theoretical — and the failure it prevents is silent
     * corruption of the NEXT level's row.
     */
    fail(`procgenSeedling: this level already uses all ${TAGS_PER_LEVEL} persistence `
        + `tags (${[...used].sort((a, b) => a - b).join(', ')}), so there is no private `
        + 'slot left for another one. `Game.tagsPerLevel` is 30 and the game indexes '
        + 'one flat array as `level * 30 + tag` with NO bounds check, so allocating a '
        + '31st would write the NEXT level\'s first slot. Refusing is the only honest '
        + 'answer; a level this dense needs fewer tagged templates.');
    return -1;
}

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
     * ⚠ "FREE" IS FOUR CLAIMS AND THEY ARE ASKED SEPARATELY: the cell is
     * inside the interior rectangle, it still holds untouched `ground`
     * (`terrainAt` reads the record, so a cell an earlier template painted is
     * no longer free), it holds no entity, and it is neither the start nor the
     * goal. The last one is not derivable from the others — a pickup does not
     * change the terrain under it, and a wall dropped on the goal builds a room
     * whose refusal would be about geometry rather than about the template.
     *
     * ⛓⛓⛓ **SLICE 6: IT NAMES THE CLAIM THAT FAILED, AND `isFree` IS DERIVED
     * FROM IT.** Until a cell could be CLICKED, "why not?" had no reader: every
     * anchor the loop ever saw came out of `anchorsFor`, which only ever offers
     * cells this already accepted. A clicked cell is the first one a person
     * chose, and *"nothing happened"* is the one answer they cannot act on.
     *
     * ⛔ ONE ADJUDICATION, TWO READERS — the boolean is `freeRefusal(…) ===
     * null` rather than a second conjunction beside it. Two spellings of one
     * legality rule is this repo's recorded failure mode, and it would be a
     * particularly bad one here: the pair would agree for as long as nobody
     * edited either, and the day they disagreed the loop would place a template
     * the page said was illegal (or refuse a click the loop would have taken).
     *
     * ⚠ THE STRING IS BUILT ONLY ON THE BRANCH THAT RETURNS IT, so the hot path
     * (`anchorsFor` walking the interior) allocates one string per REFUSED cell
     * and none per accepted one — and a large footprint fails on its first cell.
     * Measured on six ladders to step 6: 7.2 s before, 7.1 s after.
     */
    const freeRefusal = (record, tx, ty) => {
        if (!(tx > 0 && ty > 0 && tx < record.width - 1 && ty < record.height - 1)) {
            return `(${tx},${ty}) is not in the room's INTERIOR — the border ring is wall, so `
                + `the placeable cells are (1,1) to (${record.width - 2},${record.height - 2}).`;
        }
        if (reserved.has(`${tx},${ty}`)) {
            const which = tx === d.start.tx && ty === d.start.ty ? 'START' : 'GOAL';
            return `(${tx},${ty}) is the ${which} cell. A pickup does not change the terrain `
                + 'under it, so this is not the terrain check saying no — a template dropped '
                + 'here would build a room whose refusal is about GEOMETRY rather than about '
                + 'the template.';
        }
        const terrain = terrainAt(record, tx, ty);
        if (terrain !== 'ground') {
            return `(${tx},${ty}) already holds ${JSON.stringify(terrain)} and not untouched `
                + '`ground` — an earlier template painted it.';
        }
        const held = record.entities.find((e) => Math.floor(e.x / TILE_SIZE) === tx
            && Math.floor(e.y / TILE_SIZE) === ty);
        if (held) {
            return `(${tx},${ty}) already holds the entity ${held.type} at (${held.x},${held.y}).`;
        }
        return null;
    };
    const isFree = (record, tx, ty) => freeRefusal(record, tx, ty) === null;

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

    /**
     * ⛓⛓⛓ THE DOOR RULE — SLICE 4e, and it is a LEGALITY rule for the same
     * reason `laneClear` is: the model knows the answer at anchor time.
     *
     * A `door: 'h'|'v'` template spans the interior and its clearer is the only
     * way past it. If the GOAL is on the start's side of that wall, the wall is
     * decoration — and for the kill-lock family that is not merely uninformative,
     * it is a **RUN ABORT**: the walk collects the torch with the spinner still
     * alive, and `levelRun.assertDialogueFreeSpinnerRoom` refuses by name
     * (*"level 900 holds live spinners AND a DIALOGUED ceremony (torch) is
     * running"*) as a bare `Error` that no oracle classifies. Measured at three
     * of twelve legal anchors before this rule existed.
     *
     * ⛔ THE RULE IS THE MECHANISM'S OWN, not a heuristic: with the goal strictly
     * beyond the wall, no route reaches it until the lock opens, the lock opens
     * only on the body's death, so the body is dead before the ceremony can
     * start. The abort is not made less likely — it is made UNREACHABLE.
     *
     * ⚠ "BEYOND" IS `>` BECAUSE THE START IS THE FIXED NW CORNER
     * (`SEEDLING_DEFAULTS.start`), so a larger row or column is the far side.
     * A template that ever wants a start somewhere else must re-derive this,
     * and the assertion below is what will tell it.
     */
    const doorClear = (template, tx, ty) => {
        if (d.start.tx > tx || d.start.ty > ty) {
            fail(`procgenSeedling: the door rule assumes the start (${d.start.tx},`
                + `${d.start.ty}) is north-west of every anchor, and this one is `
                + `(${tx},${ty}). "Beyond" would no longer mean "greater".`);
        }
        return template.door === 'h' ? goalCell.ty > ty : goalCell.tx > tx;
    };

    /**
     * ⛓⛓⛓ **WHY THIS ANCHOR IS REFUSED — `null` when it is not** (slice 6).
     *
     * The three rules in the order `legalAt` has always asked them, each
     * answering in the MODEL'S OWN WORDS. ⛔ THE ORDER IS PART OF THE ANSWER
     * and is deliberately unchanged: `doorClear` REFUSES BY THROWING for an
     * anchor north-west of the start, so the footprint walk — which rejects
     * every cell outside the interior — has to run first or a click on the
     * border ring would meet an assertion instead of a sentence.
     *
     * ⚠ IT NAMES THE OFFENDING CELL AND WHICH PART OF THE TEMPLATE WANTED IT.
     * A footprint cell and a `clearance` cell are refused for the same reason
     * and mean different things: the first is the obstacle, the second is the
     * room its clearer needs (the S1 guard), and a reader who moved the anchor
     * one cell has to know which they were fighting.
     */
    const refusalAt = (record, template, tx, ty) => {
        for (const [part, cells] of [['FOOTPRINT', template.footprint],
            ['CLEARANCE', template.clearance ?? []]]) {
            for (const c of cells) {
                const why = freeRefusal(record, tx + c.dx, ty + c.dy);
                if (why) {
                    return `"${template.instance ?? template.name}" anchored at (${tx},${ty}) `
                        + `needs ${part} cell ${why}`;
                }
            }
        }
        if (template.lane === 'avoidable') {
            const lane = laneClear(record, tx, ty);
            if (!lane.ok) {
                return `"${template.instance ?? template.name}" at (${tx},${ty}): its ARROW `
                    + `LANE covers ${lane.over}. A lane that covers the start or the goal is `
                    + 'not an AVOIDABLE obstacle — it is a hazard the walk cannot route '
                    + 'around — so the anchor is refused before any solve.';
            }
        }
        if (template.door && !doorClear(template, tx, ty)) {
            return `"${template.instance ?? template.name}" at (${tx},${ty}) declares `
                + `door '${template.door}', and the GOAL (${goalCell.tx},${goalCell.ty}) is on `
                + 'the START\'s side of that wall — so the wall would be DECORATION rather '
                + 'than a door, and for the kill-lock family it is a RUN ABORT (the walk '
                + 'collects the torch with the spinner still alive). The rule is the '
                + 'mechanism\'s own, not a heuristic.';
        }
        return null;
    };
    /**
     * ⛔ DERIVED, NOT RE-DERIVED — see `freeRefusal`. The conjunction and its
     * short-circuit order are `refusalAt`'s, so `anchorsFor` offers exactly the
     * cells it offered before slice 6 and the free ladder's levels cannot move.
     */
    const legalAt = (record, template, tx, ty) => refusalAt(record, template, tx, ty) === null;

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
        doorClear,
        /**
         * ⛓ EXPOSED SO THE DOMAIN SWEEP CAN ENUMERATE LEGAL ANCHORS WITHOUT
         * RETYPING THE RULE (slice 2). `isFree`, `laneClear` and `doorClear`
         * were already on this surface for the same reason; `legalAt` is the
         * conjunction of all three plus the footprint walk, and a sweep that
         * re-derived it would be the seventh copy of a retype this arc has
         * refused. ⛔ It is the SAME function `anchorsFor` calls — not an
         * agreeing one.
         */
        legalAt,
        /**
         * ⛓⛓⛓ SLICE 6's OWN MEMBER — the one a CLICKED cell is adjudicated by.
         * `legalAt` answers the loop's question (*may I put it here?*); this
         * answers the person's (*why not?*), and they are the same function
         * asked two ways. `directedAttempt` requires it whenever a directive
         * names an explicit anchor.
         */
        refusalAt,
        skeleton,
        /**
         * ⛓⛓⛓ ONE SHUFFLE, THEN THE FIRST `limit` LEGAL CELLS — the whole of
         * GENERATE-mode UI slice 3's TRACK B on this side of the seam.
         *
         * ⛔ THERE IS NO `anchorFor` ANY MORE, and its deletion is the point.
         * The loop used to take ONE anchor per candidate and revert on the
         * oracle's answer about it, so a template that would have solved three
         * cells further down the shuffle was reported unviable — measured, and
         * the measurement is in `wall-gap-block`'s own docblock (⚖ slice 2
         * §9.3: at one anchor the vertical door discharges 1–2 of 12; at every
         * legal anchor, 18–21. *The vertical door is not worse — the FIRST
         * anchor the shuffle hands it is.*) Keeping a one-anchor spelling
         * beside the bounded one would be two ways to ask the same question.
         *
         * ⛔⛔ THE DRAW COUNT DOES NOT DEPEND ON `limit`, AND THAT IS WHAT MAKES
         * DEFAULT 1 BYTE-INERT. The rng is touched exactly once — the single
         * `shuffle` of the room's interior, whose cost is the interior's size
         * and nothing else. `limit` only decides how far down THAT ALREADY-DRAWN
         * ORDER the caller is allowed to walk. So `anchorsFor(…, 1)[0]` is the
         * cell the old `anchorFor` returned, from the same stream position, and
         * the ladder's levels do not move when the bound is left at its default.
         * (The shuffle-then-first shape was chosen for this same reason in
         * slice 2 of the PoC arc — see the file docblock: a rejection sampler
         * would have made the draw count depend on how full the room is.)
         *
         * @returns {Array<{tx,ty}>} up to `limit` legal anchors IN SHUFFLE
         *   ORDER; `[]` when the whole interior refuses.
         */
        anchorsFor(record, template, rng, limit = 1) {
            if (!Number.isInteger(limit) || limit <= 0) {
                fail(`procgenSeedling: anchorsFor needs a positive integer limit, got `
                    + `${JSON.stringify(limit)}. The bound is what the trace names `
                    + '(`anchorTriesPerCandidate`), so there is no value meaning "all".');
            }
            const out = [];
            for (const c of rng.shuffle(interiorCells(record))) {
                if (!legalAt(record, template, c.tx, c.ty)) continue;
                out.push({ tx: c.tx, ty: c.ty });
                if (out.length >= limit) break;
            }
            return out;
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
                /**
                 * ⛓ THE GROUP SLOT, RESOLVED — see `placementGroupId` for why
                 * the anchor is the allocator, and `procgenPalette`'s
                 * `PLACEMENT_GROUP` for the defect that made the slot exist.
                 *
                 * ⛔ THE THROW IS THE WHOLE GUARD, because the failure it
                 * catches is SILENT: an unresolved sentinel reaches
                 * `levelWorld.tSetOf`, which is `intAttr(attrs, 'tset', 0)`,
                 * and `int("@placement-group")` is **0** — the shared group
                 * this slot exists to end, restored without a symptom. A
                 * template that declares no `groups` and carries the sentinel
                 * anyway is refused by `assertPalette` at module load; this is
                 * the same claim at the one place that writes the value.
                 */
                const group = template.groups ? placementGroupId(at, d.height) : null;
                /**
                 * ⛓ THE TAG IS ALLOCATED FROM THE RECORD AS IT STANDS — which
                 * already holds the goal pickup, so the goal's own tag is
                 * taken before any template can ask. `d.goalTag` is passed as
                 * `reserved` anyway: the record is the live answer and the
                 * reserved list is the DECLARED one, and a day when the goal
                 * is not in the record at this moment should not silently
                 * hand a lock the goal's flag.
                 */
                const tag = template.tags
                    ? placementTagId(next, [Number.parseInt(d.goalTag, 10)])
                    : null;
                const resolveAttrs = (attrs) => Object.fromEntries(
                    Object.entries(attrs).map(([k, v]) => {
                        if (v === PLACEMENT_GROUP) {
                            if (group === null) {
                                fail(`procgenSeedling: template "${template.name}" `
                                    + `carries the placement-group slot on "${k}" but `
                                    + 'declares no `groups`, so there is no id to '
                                    + 'resolve it to. An unresolved slot parses as '
                                    + 'group 0 — every unmarked activator in the room '
                                    + '— which is exactly the collision the slot '
                                    + 'exists to end.');
                            }
                            return [k, String(group)];
                        }
                        if (v === PLACEMENT_TAG) {
                            if (tag === null) {
                                fail(`procgenSeedling: template "${template.name}" `
                                    + `carries the placement-tag slot on "${k}" but `
                                    + 'declares no `tags`, so there is no slot to '
                                    + 'resolve it to. An unresolved tag parses as 0 — '
                                    + 'the GOAL\'s own flag — and a lock writes its tag '
                                    + 'on every open AND every close.');
                            }
                            return [k, String(tag)];
                        }
                        return [k, v];
                    }),
                );
                next = withEntities(next, template.entities.map((e) => ({
                    type: e.type,
                    ...oelAtTile(at.tx + e.dx, at.ty + e.dy),
                    ...(e.attrs ? { attrs: resolveAttrs(e.attrs) } : {}),
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
            /**
             * ⛓⛓ ONE OF THE TWO PIN-UNION LOOKUPS (the other is
             * `watchGenerate.keptTemplatesOf`), and since slice 2 both go
             * through `procgenPalette.instantiateKept`. A name lookup used to
             * be enough because a row WAS its geometry; under parameterization
             * the name resolves to a BASE with no `pins` at all, and two
             * private reconstructions of one instance is the second-cost-model
             * shape this arc keeps meeting.
             */
            pins: oracle.pinsFor(
                out.summary.kept.map((k) => instantiateKept(palette, k)),
            ),
        }),
    };
}

export { VERDICT };
