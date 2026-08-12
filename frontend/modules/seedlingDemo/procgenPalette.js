/**
 * seedlingDemo/procgenPalette — THE PRE-SWORD BIOME'S TEMPLATE TABLE, and the
 * list of what MEASUREMENT kept out of it.
 *
 * Seedling PROCGEN PoC arc, slice 2 (kickoff §3.3). A template is the
 * placement unit — ⚖ ruling §1.2: *an obstacle that needs something specific
 * to clear it is placed ATOMICALLY WITH ITS CLEARER* — carrying its own
 * footprint, its own clearance rule, its own tiles and entities, and the
 * staging PINS its presence obliges.
 *
 * ── ⛔⛔⛔ THE PALETTE IS FIVE FAMILIES, AND WHAT IS STILL OUT IS HERE TOO
 *
 * ⚖ Kickoff §3.3 names seven pre-sword templates. Slice 2 certified FOUR and
 * excluded three, all three for ONE shared cause it measured rather than
 * assumed: `solveSegment`'s collect branch derived a STANCE before it ever
 * walked, that derivation needed a corridor with NO strategy applied, and the
 * obstacle ladder lives inside `walkTo` on the far side of it. So a
 * corridor-blocking obstacle refused before its clearer was ever selected.
 * The survey's "proven envelope" had been measured on REACH-EXIT crossings,
 * where `walkTo` runs first; collect-only was a different question.
 *
 * ⚖ THE USER RULED THAT A BUG (2026-08-12) and slice 3 fixed it:
 * `238f0dbe9` routes the collect stance through `walkTo`'s own ladder, and
 * `b3522f6fd` stops the derivation choosing a stance the pickup cannot be
 * collected from. ⇒ the clearer families were RE-PROBED on the fixed path:
 *
 *   · `shove`  — PROMOTED. `wall-gap-block-h`/`-v` below. The block in the
 *                only gap is shoved and the goal collected (204/204/202 ticks
 *                in three geometries). Slice 2's stated cause for this row —
 *                "the block lands one tile short" — was measured on GOAL-SIDE
 *                CONTAINMENT and does not describe the corridor at all.
 *   · `hold`   — STILL OUT, and for a DIFFERENT reason than the shared one:
 *                the verb is now SELECTED and the game's own mechanism is
 *                what defeats it. Fresh text on its row.
 *   · kill-lock — STILL OUT, and slice 2's cause is STALE: no
 *                `PendingDeclaration` is reached any more. Fresh text.
 *
 * `EXCLUDED_TEMPLATES` below is that list. It is in this file and not in a
 * report because an exclusion nobody can find is an exclusion the next slice
 * re-discovers by building the thing again — and slice 3 is the proof of the
 * other half: a row whose cause has been FIXED is a stale claim, so the row
 * either moves into the palette or gets re-measured text.
 *
 * ── WHAT A TEMPLATE IS, FIELD BY FIELD ────────────────────────────────
 *
 *   `name`       unique; the trace's own key
 *   `family`     the roster the report counts by (⚖ §5, trap 199: build
 *                assertions FROM the roster, never from a count)
 *   `footprint`  the cells it OCCUPIES, as {dx,dy} from its anchor. Every one
 *                must be free interior ground or the placement is refused BY
 *                NAME before any solve.
 *   `clearance`  cells that must ALSO be free but are not written — the
 *                template's own "and this stays walkable" rule.
 *   `terrain`    tiles written, `{dx, dy, terrain}` in `procgenLevel.TERRAIN`
 *   `entities`   entities added, `{dx, dy, type, attrs}` — attrs TRANSCRIBED
 *                from real atlas rooms, cited per template
 *   `pins`       staging pins this template obliges (`bootStaging`'s argument)
 *   `lane`       `'avoidable'` on the arrow trap — the model computes the
 *                lane with the ENGINE's own geometry and refuses an anchor
 *                whose lane covers the start or the goal
 *
 * ⛔ NO NODE IMPORTS (see `atlasSource.js`): this file is on the GENERATE
 * arm's path in the browser.
 */

import { SINGLE_SCREEN_TILES, TERRAIN } from './procgenLevel.js';

export class ProcgenPaletteError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProcgenPaletteError';
    }
}

const fail = (message) => { throw new ProcgenPaletteError(message); };

const cell = (dx, dy) => Object.freeze({ dx, dy });
const rectCells = (w, h) => {
    const out = [];
    for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) out.push(cell(dx, dy));
    return Object.freeze(out);
};
const paint = (cells, terrain) => Object.freeze(cells.map((c) => Object.freeze({ ...c, terrain })));

/**
 * THE PRE-SWORD BIOME'S BOOT: no sword, no shield, nothing granted.
 *
 * ⚠ `hasSword:false` is DECLARED rather than omitted. `bootStaging` sends
 * `seam.items` only when it is given some, and "the player has no sword" and
 * "nobody said what the player has" are the same run with two different
 * audit trails. ⚖ Kickoff §3.3 splits the two biomes on exactly this flag.
 */
export const PRE_SWORD_ITEMS = Object.freeze({ hasSword: false, hasShield: false });

/**
 * ⛓ THE INTERIOR'S OWN SPAN, DERIVED — the width of a single-screen room minus
 * its border ring. The `wall-gap-block` pair below must cross the whole
 * interior to be a door rather than a decoration, so the number is read from
 * `procgenLevel`'s room size rather than typed. `GAP_OFFSET` is a declared
 * choice (the middle-ish column), not a measurement.
 */
const INTERIOR_SPAN = SINGLE_SCREEN_TILES.width - 2;
const GAP_OFFSET = 4;

/**
 * ⛓⛓⛓ PoC SLICE 3b — THE WEIGH TEMPLATE'S THREE OFFSETS, and every one of
 * them is a CONSTRAINT rather than a preference.
 *
 * The lock sits in the door's gap; the button and the block stand in the lane
 * one cell back from the wall, on the START side of it. Along that lane:
 *
 *   `BLOCK_OFFSET - 1`  the STANCE. `runShove`'s lean needs the player box on
 *                       the block's ±1 px probe, so the cell behind the block
 *                       must be standable — which is why the block is not at
 *                       the lane's first cell.
 *   `BLOCK_OFFSET`      the block.
 *   between them        the SLIDE PATH, declared as `clearance` (below).
 *   `BUTTON_OFFSET`     the button, and therefore the block's destination.
 *
 * ⛔ THE TWO MUST SHARE THE LANE, because a lean moves a block along ONE axis
 * (`runShove` asserts it) — a template whose block and button shared neither
 * coordinate would be L16's shape, which needs a CHAIN nobody has ruled on.
 */
const BLOCK_OFFSET = 1;
const BUTTON_OFFSET = 5;
/** The cells the block slides THROUGH — free, and not written. */
const SLIDE_PATH = Object.freeze(
    Array.from({ length: BUTTON_OFFSET - BLOCK_OFFSET - 1 }, (_, i) => BLOCK_OFFSET + 1 + i),
);

/**
 * ⛓ THE FOUR TEMPLATES THE ORACLE CERTIFIES, each measured in an otherwise
 * empty bordered 10x10 room with a `torchpickup` collect goal (slice 2's
 * probe; the module test re-drives every one against a BUILT WORLD).
 */
export const PRE_SWORD_TEMPLATES = Object.freeze([
    /**
     * ⛓ THE WALL SEGMENT — the palette's plainest constraint and the one that
     * produces the loop's REJECTIONS.
     *
     * Three cells of `TERRAIN.wall` (column 3 → tile type 2 Stone, verified in
     * `procgenLevel`). It carries NO clearance rule on purpose: a segment
     * that happens to seal the goal off is exactly the candidate the
     * keep-or-revert loop exists to reject, and pre-filtering it here would
     * be the conservative-ingredient trap (171/173) — the loop would look
     * infallible because its instrument had removed the only failures.
     */
    Object.freeze({
        name: 'wall-segment-h3',
        family: 'wall',
        footprint: rectCells(3, 1),
        clearance: Object.freeze([]),
        terrain: paint(rectCells(3, 1), 'wall'),
        entities: Object.freeze([]),
        pins: Object.freeze([]),
        why: 'three Stone cells in a row; `world.solids` gains them with tag `tile:Stone`',
    }),
    Object.freeze({
        name: 'wall-segment-v3',
        family: 'wall',
        footprint: rectCells(1, 3),
        clearance: Object.freeze([]),
        terrain: paint(rectCells(1, 3), 'wall'),
        entities: Object.freeze([]),
        pins: Object.freeze([]),
        why: 'the same segment stood on end — the two orientations are two draws, so a '
            + 'room can be constrained on both axes from one palette',
    }),
    /**
     * ⛓⛓ THE WATER POOL — and it is the reason `bootStaging` takes `pins` as
     * an ARGUMENT.
     *
     * `TERRAIN.water` (column 2 → type 1) lands in `world.lethalTerrainTiles`:
     * the walk must route around it, which is the constraint. ⛔ AND IT
     * OBLIGES THE `'sound'` PIN — `stepV2` REFUSES a wet tick on a staging
     * block that does not pin it (R5 §13: the swim burst reads the mixer's
     * own wall clock otherwise). ⚠ MEASURED: a dry walk past a pool solves
     * with or without the pin, because the refusal fires on the WET TICK and
     * a routed-around pool never has one. The pin is declared anyway — a
     * template that is only safe while the solver keeps choosing to stay dry
     * is a template whose safety is somebody else's decision.
     */
    Object.freeze({
        name: 'water-pool-2x2',
        family: 'water',
        footprint: rectCells(2, 2),
        clearance: Object.freeze([]),
        terrain: paint(rectCells(2, 2), 'water'),
        entities: Object.freeze([]),
        pins: Object.freeze(['sound']),
        why: 'four Water cells; `world.lethalTerrainTiles` gains them, and the block '
            + 'must pin `sound` for any wet tick (R5 §13)',
    }),
    /**
     * ⛓ THE PIT PATCH — `TERRAIN.pit` (column 7 → type 6), landing in
     * `world.pitTiles`.
     *
     * Two cells rather than four: a pit is a hole in the floor and the atlas's
     * own pits (L4's two cells) are small. The size is a declared choice, not
     * a measurement — the measurement is that the cells build as pits.
     */
    Object.freeze({
        name: 'pit-patch-2x1',
        family: 'pit',
        footprint: rectCells(2, 1),
        clearance: Object.freeze([]),
        terrain: paint(rectCells(2, 1), 'pit'),
        entities: Object.freeze([]),
        pins: Object.freeze([]),
        why: 'two Pit cells; `world.pitTiles` gains them and the corridor planner prices '
            + 'them as a fall',
    }),
    /**
     * ⛓⛓⛓ THE AVOIDABLE ARROW LANE — the one template whose geometry is not
     * its footprint.
     *
     * ⛔ `shoot: '1'` IS THE WHOLE DESIGN. `ArrowTrap.update` is
     * `(activate && !shootDefault) || (!activate && shootDefault)` — an XOR
     * (`arrowTrap.arrowTrapFires`) — so a `shoot="1"` trap fires from the
     * level's FIRST TICK and stops only when its group is pressed. This
     * palette places no button, so the lane is on for the whole run and the
     * walk has to route around a live column. A `shoot="0"` trap in a
     * button-less room is the opposite: it never fires at all, and placing one
     * would be an obstacle that obstructs nothing — an ingredient that
     * manufactures the appearance of difficulty (traps 171/173). ⚠ The atlas
     * has both senses: L4/L5/L8 are `shoot="0"`, L16/L67 are `shoot="1"`
     * (`arrowTrap.js`'s own census).
     *
     * ⛔ THE LANE GEOMETRY IS THE ENGINE'S, NEVER RETYPED — the model builds a
     * placement with `arrowTrapEntityPoint` and asks
     * `arrowLaneForPlacement` + `arrowLaneRect`. The editor arc refused an
     * arrow-lane overlay on exactly this ground (kickoff §14.4a: a seventh
     * copy of a retype), and a palette that wrote `x0 = x - 6` here would be
     * the eighth.
     *
     * `lane: 'avoidable'` is the CLEARANCE RULE, and it is the template's own
     * contract rather than a safety net: the anchor is refused if the lane
     * rect covers the start cell or the goal cell, because a lane over either
     * is not an avoidable obstacle — it is a room the walk must stand in a
     * volley to finish. The refusal is a placement refusal with its reason,
     * so the trace says which anchor was rejected and why.
     *
     * Attrs transcribed from `Dungeon2/3.oel` (L16) and `Dungeon6/8.oel`
     * (L67): `{shoot: "1", tset: "0"}`.
     */
    Object.freeze({
        name: 'arrow-lane',
        family: 'arrow-lane',
        footprint: rectCells(1, 1),
        clearance: Object.freeze([]),
        terrain: Object.freeze([]),
        entities: Object.freeze([Object.freeze({
            dx: 0,
            dy: 0,
            type: 'arrowtrap',
            attrs: Object.freeze({ shoot: '1', tset: '0' }),
        })]),
        pins: Object.freeze([]),
        lane: 'avoidable',
        why: 'one always-firing trap; its lane is a live column the corridor must avoid, '
            + 'and the lane rect comes from `arrowTrap.arrowLaneForPlacement`',
    }),
    /**
     * ⛓⛓⛓ THE DOOR — PoC slice 3's promotion, and the palette's first CLEARER.
     *
     * ⚖ Slice 2 excluded every clearer family because `deriveStance` refused a
     * corridor-blocking obstacle before its verb was ever selected (§9.1). ⚖
     * The user ruled that a bug; slice 3 fixed it (`238f0dbe9` routes the
     * collect stance through `walkTo`'s own ladder, `b3522f6fd` stops the
     * derivation choosing a stance the pickup cannot be collected from). With
     * both in, a block in the only gap of a wall is SHOVED and the goal
     * COLLECTED — measured at 204, 204 and 202 ticks in three geometries.
     *
     * ⛔ THE WALL MUST SPAN THE WHOLE INTERIOR, and that is not a size choice.
     * A shorter wall is walked around, the block is never in anyone's way, and
     * the template becomes an obstacle that obstructs nothing — the same
     * ingredient failure `shoot="0"` would have been for the arrow lane
     * (traps 171/173). The span is the interior's own width, so the room's
     * border ring closes both ends and the gap is genuinely the only way
     * through. ⇒ the anchor is forced to the interior's first column (or row),
     * which is a consequence of the span rather than a rule of its own.
     *
     * ⚠ NO CLEARANCE RULE, for `wall-segment-h3`'s reason, now measured on
     * this template too: with the goal in the gap's own COLUMN the shove
     * slides the block onto it and the collect refuses — *"approaching
     * torchpickup@64,128, the sweep was blocked by pushableblock at (64,80)"*.
     * That is a candidate the keep-or-revert loop exists to REJECT, with its
     * reason in the trace. Pre-filtering it here would hide from the loop the
     * one placement of this template that fails, and a family whose failures
     * have been filtered out reports a keep rate that is about the filter.
     *
     * ⛓⛓⛓ PoC SLICE 4 — §11.7's VACUITY FINDING IS SUPERSEDED, AND WHAT WAS
     * WRONG WAS THE INSTRUMENT.
     *
     * Slice 3b split this family's generated-room rows by whether the goal
     * lies beyond the template's own wall from the start, read 0 KEPT / 4
     * REVERTED on the FAR side, and concluded that `wall-gap-block` is *"KEPT
     * exactly when it is IRRELEVANT"*. That label is computed from the
     * template IN ISOLATION; in a room already holding five other obstacles it
     * does not mean "the door is on the route", because the route detours and
     * a NEAR door can be squarely on it.
     *
     * ⛔ THE NON-VACUOUS INSTRUMENT IS THE FINAL LEVEL'S OWN SOLVE — a
     * `{strategy:'shove'}` RECORD naming this template's own block, which an
     * obstacle nobody walked into cannot produce. Measured over seeds 1..40:
     * discharged in seeds 10, 21, 27 and 38 (27 and 38 keep no `weigh`
     * template at all, so the pushable is unambiguously this one's).
     *
     * ⛔ AND THE FOUR FAR REFUSALS WERE ALL CORRECT. Each candidate re-placed
     * ALONE at the same anchor SOLVES (216/216/207/211 ticks), so the cause is
     * INTERACTION, not this template and not the verb; an ablation through the
     * same oracle attributes each one — seeds 9 and 13 are sealed by the
     * candidate's WALL (the room refuses with the block deleted too), seed 15
     * by the block having no resting cell that leaves a corridor. Nothing to
     * fix here, and `procgenShoveEvidence.test.js` is where all of it is
     * driven.
     */
    Object.freeze({
        name: 'wall-gap-block-h',
        family: 'shove',
        footprint: rectCells(INTERIOR_SPAN, 1),
        clearance: Object.freeze([]),
        terrain: paint(rectCells(INTERIOR_SPAN, 1).filter((c) => c.dx !== GAP_OFFSET), 'wall'),
        entities: Object.freeze([Object.freeze({
            dx: GAP_OFFSET, dy: 0, type: 'pushableblock',
        })]),
        pins: Object.freeze([]),
        why: 'a Stone wall across the whole interior with ONE gap, and a `pushableblock` '
            + 'standing in it — the corridor exists only after the block is shoved, so '
            + '`walkTo`\'s ladder selects `shove` and the collect follows',
    }),
    Object.freeze({
        name: 'wall-gap-block-v',
        family: 'shove',
        footprint: rectCells(1, INTERIOR_SPAN),
        clearance: Object.freeze([]),
        terrain: paint(rectCells(1, INTERIOR_SPAN).filter((c) => c.dy !== GAP_OFFSET), 'wall'),
        entities: Object.freeze([Object.freeze({
            dx: 0, dy: GAP_OFFSET, type: 'pushableblock',
        })]),
        pins: Object.freeze([]),
        why: 'the same door stood on end; the two orientations are two draws, exactly as '
            + 'the two wall segments are',
    }),
    /**
     * ⛓⛓⛓ THE LOCKED DOOR — PoC slice 3b's promotion, and L15's mechanism in
     * a room this arc can generate (⚖ kickoff §1.9).
     *
     * A Stone wall across the whole interior with ONE gap, a `lock` standing
     * in the gap, and — in the lane one cell back on the START side — the
     * `button` that opens its group and a `pushableblock` sharing that lane.
     * ⚖ §1.2's atomic placement in its fullest form so far: the obstacle, its
     * opener, AND the thing that works the opener, placed together, because
     * any two of the three without the third is a room with no answer.
     *
     * ⛔ WHY THE BLOCK IS NOT OPTIONAL. `Button.update` re-collides
     * `["Player","Enemy","Solid"]` EVERY tick (`Button.as:27-39`), so the
     * group is published only while something is standing there — and the
     * player's whole errand is to be on the FAR side of the lock. Slice 3
     * measured the consequence and excluded the button+lock pair for it (the
     * walk spends its entire per-target budget grazing the lock it just
     * opened). The third member of the collide list is the answer:
     * `PushableBlock.as:27` is `type = "Solid"`, so a block parked on the
     * button holds it for ever. `button-lock-pair` stays in `EXCLUDED_TEMPLATES`
     * precisely because it is this template MINUS the block.
     *
     * ⛔⛔ THE SLIDE PATH IS `clearance`, AND THAT IS THE S1 GUARD — encoded as
     * template LEGALITY rather than as a solver special case. `legalAt` tests
     * footprint ∪ clearance with `isFree`, and `isFree` refuses the start and
     * the goal cells; so declaring the cells the block slides through (and the
     * button cell it lands on, which is footprint) makes it structurally
     * impossible for this template to be anchored where the shove would put a
     * block on the goal. ⚠ Slice 3 met that shape on `wall-gap-block` and
     * correctly left it to the LOOP to reject, because there the block's
     * destination is derived per-room and cannot be known at anchor time.
     * Here it can: the destination is the button, and the button is part of
     * the template. Same law, different information.
     *
     * ⚠ NO CLEARANCE ON THE FAR SIDE, deliberately. A wall that seals the goal
     * off is exactly the candidate the keep-or-revert loop exists to reject
     * (`wall-segment-h3`'s precedent), and pre-filtering it would hide this
     * family's only real failure from the loop (traps 171/173).
     *
     * Attrs transcribed from L15 (`Dungeon2/2.oel:110-111`), the room the game
     * built around this mechanism: `button {tset: "0"}`, `lock {tset: "0",
     * tag: "0"}`.
     */
    Object.freeze({
        name: 'wall-gap-lock-weigh-h',
        family: 'weigh',
        footprint: Object.freeze([
            ...rectCells(INTERIOR_SPAN, 1),
            cell(BLOCK_OFFSET, -1),
            cell(BUTTON_OFFSET, -1),
        ]),
        clearance: Object.freeze([
            cell(BLOCK_OFFSET - 1, -1),
            ...SLIDE_PATH.map((dx) => cell(dx, -1)),
        ]),
        terrain: paint(rectCells(INTERIOR_SPAN, 1).filter((c) => c.dx !== GAP_OFFSET), 'wall'),
        entities: Object.freeze([
            Object.freeze({
                dx: GAP_OFFSET, dy: 0, type: 'lock', attrs: Object.freeze({ tset: '0', tag: '0' }),
            }),
            Object.freeze({
                dx: BUTTON_OFFSET, dy: -1, type: 'button', attrs: Object.freeze({ tset: '0' }),
            }),
            Object.freeze({ dx: BLOCK_OFFSET, dy: -1, type: 'pushableblock' }),
        ]),
        pins: Object.freeze([]),
        why: 'a Stone wall across the whole interior with a `lock` in its ONE gap, plus '
            + 'the `button` that opens the lock\'s group and a `pushableblock` sharing '
            + 'the button\'s lane — the corridor exists only after the block is parked on '
            + 'the button, so `refineStrategy` selects `weigh` and the player walks '
            + 'through a lock nobody is holding',
    }),
    Object.freeze({
        name: 'wall-gap-lock-weigh-v',
        family: 'weigh',
        footprint: Object.freeze([
            ...rectCells(1, INTERIOR_SPAN),
            cell(-1, BLOCK_OFFSET),
            cell(-1, BUTTON_OFFSET),
        ]),
        clearance: Object.freeze([
            cell(-1, BLOCK_OFFSET - 1),
            ...SLIDE_PATH.map((dy) => cell(-1, dy)),
        ]),
        terrain: paint(rectCells(1, INTERIOR_SPAN).filter((c) => c.dy !== GAP_OFFSET), 'wall'),
        entities: Object.freeze([
            Object.freeze({
                dx: 0, dy: GAP_OFFSET, type: 'lock', attrs: Object.freeze({ tset: '0', tag: '0' }),
            }),
            Object.freeze({
                dx: -1, dy: BUTTON_OFFSET, type: 'button', attrs: Object.freeze({ tset: '0' }),
            }),
            Object.freeze({ dx: -1, dy: BLOCK_OFFSET, type: 'pushableblock' }),
        ]),
        pins: Object.freeze([]),
        why: 'the same locked door stood on end, with the lane running down the column '
            + 'beside it — a SOUTH lean rather than an EAST one, which is a different '
            + '`SHOVE_STEP` row and therefore a real second draw',
    }),
]);

export const PRE_SWORD_PALETTE = Object.freeze({
    name: 'pre-sword',
    items: PRE_SWORD_ITEMS,
    templates: PRE_SWORD_TEMPLATES,
});

/**
 * ⛔⛔⛔ THE EXCLUSIONS, AND EVERY ONE CARRIES ITS OWN MEASUREMENT.
 *
 * ⚖ Kickoff §3.3's contract: *"nothing whose clear only the game can date"* —
 * the oracle must be able to adjudicate every template it is offered. Slice 2
 * measured that contract against the three clearer families the kickoff named
 * for this biome and all three fail it, each for its own reason. The refusal
 * texts are VERBATIM from probe runs on 2026-08-12 (10x10 bordered room,
 * `torchpickup` collect goal, `DEFAULT_BUDGET`).
 *
 * ⚠ A LIST IS NOT A CLOSED DOOR. Each row says what would have to change, so
 * a later slice can re-ask the question instead of re-discovering the answer.
 */
export const EXCLUDED_TEMPLATES = Object.freeze([
    Object.freeze({
        name: 'button-lock-pair',
        family: 'hold',
        cause: 'MECHANISM — a hold is not a latch',
        measured: 'PoC slice 3 RE-MEASURED this one on the corridor, and the verb is now '
            + 'SELECTED where slice 2 measured it never selected at all (trace row '
            + 'tick 0, `hold` against `lock@64,80`). It still does not open the way. A '
            + '`Lock` is open only WHILE its group is published and `Button.update` '
            + 'republishes every tick from whoever stands on it, so the player who '
            + 'leaves the button to walk through has already shut the lock: the walk '
            + 'then spends its whole per-target budget grazing the lock it just opened.',
        refusalText: 'solverBot(C2-corridor-lock-button) collect (64,128) stance '
            + '(ladder-routed: …) waypoint 1 (72,120): not reached within 400 ticks; '
            + 'stalled at (72.6899798657555,76.6929296425152) v=(0,1.05…) in level 900, '
            + 'aiming at (72,120), after grazing 396 solid(s): lock at (64,80) on the Y '
            + 'axis, at (72.6899798657555,76.6929296425152) in level 900, aiming at '
            + '(72,120).',
        wouldNeed: '⛓ DISCHARGED BY PoC SLICE 3b, AND THE ROW STAYS ANYWAY. What this '
            + 'needed was the game\'s own answer — a SOLID on the button, because '
            + '`Button.hitables` is `["Player","Enemy","Solid"]` and `PushableBlock` is a '
            + '`"Solid"` (L15\'s shape). Slice 3b built it: `weigh` (a `refineStrategy` '
            + 'arm selected when every presser in the group republishes) parks a block on '
            + 'the button with `runShove` and waits out the fade with `runDwell`, and the '
            + 'palette now carries `wall-gap-lock-weigh-h`/`-v`. ⛔ THIS ROW IS NOT THAT '
            + 'TEMPLATE — it is that template MINUS THE BLOCK, and it is still excluded '
            + 'for its original measured reason, which no longer has a workaround inside '
            + 'it: a button+lock pair with no pushable in the room has nothing to hold '
            + 'the group, and the walk still spends its whole per-target budget grazing '
            + 'the lock it just opened (RE-MEASURED at slice 3b with the `weigh` arm '
            + 'live: the verb is considered, refuses for want of a block by name, and '
            + 'the derivation falls back to exactly the `hold` measured above). ⚠ The '
            + 'shape that remains unbuilt is the CHAIN — a block that needs two leans to '
            + 'reach the button, which is L16\'s room (block at tile (16,5), button at '
            + '(17,3), sharing neither coordinate). ⚖ Nobody has ruled on it.',
    }),
    Object.freeze({
        name: 'arrow-ceiling-killlock',
        family: 'kill',
        cause: 'MECHANISM — the hold outlives its own derived bound',
        measured: '⛓ SLICE 3 MOVED THIS ONE TWICE OVER and slice 2\'s stated cause is '
            + 'now STALE. Slice 2 measured a `PendingDeclaration` only `twoPassSolve` '
            + 'discharges; on the fixed collect path the corridor case never reaches '
            + 'one (`pending` is null). The ladder selects `kill`, the CEILING arm '
            + 'resolves, the button arms the trap and the body DIES — and the hold then '
            + 'runs out the bound its own mechanism derived, waiting on the lock\'s '
            + '101-tick fade. ⚠ MEASURED IN A PROBE ROOM OF THIS SLICE\'S OWN MAKING, '
            + 'not in a surveyed one: the number is a fact about that geometry, and it '
            + 'is NOT a claim that L5\'s shape cannot be templated.',
        refusalText: 'solverBot(C4-killlock-with-ceiling) collect (64,128) stance '
            + '(ladder-routed: …) -> kill -> clear: held button@32,48 for the whole '
            + 'bound of 227 tick(s) and the condition never became true — every body '
            + 'this phase is waiting on [bob@96,48] has left level 900, and — if that '
            + 'took the count to zero — 101 more tick(s) have elapsed for lock@64,80\'s '
            + 'own fade. The bound is a CLAIM about the mechanism, so a hold that runs '
            + 'it out is a measurement that the claim was wrong, not a hold that needs '
            + 'a bigger number.',
        wouldNeed: 'a template whose geometry lets the fade finish inside the derived '
            + 'bound — which is a MEASUREMENT somebody must take against a surveyed '
            + 'room, not a number to raise. ⛓ THE PRESS ARM stays shut for its own '
            + 'reason: it needs a `KILL_ARM_POLICY.modelled` class (IceTurret, '
            + 'ShieldBoss, Spinner — none pre-sword) and a press needs the sword. ⛓ AND '
            + 'THE NAME CORRECTION STANDS: kickoff §3.3 calls this "water+bob+kill-lock '
            + '(bait-kill)", but the killer at L5 is the ARROW CEILING '
            + '(`ARROW_KILL_PLAN`\'s six phases). A bob\'s water death IS modelled '
            + '(`levelRun`\'s `ENEMY_TERRAIN_DESTROYS`) and no solver plan baits a body '
            + 'into it; L6\'s drowning is DECLARED by that tape\'s own v10 despawn row.',
    }),
    /**
     * ⚖ Kickoff §3.3's standing exclusions, carried forward unchanged so this
     * list is the WHOLE answer to "what is not in the pre-sword palette".
     */
    Object.freeze({
        name: 'breakable-rock',
        family: 'break',
        cause: 'VERB-MISSING',
        measured: 'no `break` executor exists (`STRATEGY_EXECUTORS` has no row)',
        refusalText: null,
        wouldNeed: 'a registered `break` executor; post-sword anyway (the slash is the opener)',
    }),
    Object.freeze({
        name: 'free-roaming-bob',
        family: 'chaser',
        cause: 'NO CERTIFYING ROOM',
        measured: 'no surveyed room certifies crossing past a live bob that is never '
            + 'engaged (⚖ kickoff §1.6\'s accepted default)',
        refusalText: null,
        wouldNeed: 'a measured crossing; bobs stay out of v1 entirely now that the '
            + 'kill-lock template they were reserved for is excluded',
    }),
    Object.freeze({
        name: 'sandtrap-room',
        family: 'kill',
        cause: 'NEEDS-GAME-ORACLE',
        measured: '§11.4 REFUSES to compute a static "Enemy" body\'s arrow death, so its '
            + 'clear is a tape-DECLARED v9 row and only the `--win` game channel can date it',
        refusalText: null,
        wouldNeed: 'a recording channel — which ⚖ kickoff §3.3 rules out by contract: '
            + 'nothing whose clear only the game can date',
    }),
]);

/**
 * EVERY TEMPLATE, CHECKED — shapes, names, terrains and the roster's own
 * uniqueness. Called at module load, for `procgenLevel.assertTerrainColumns`'s
 * own reason: a malformed template is a defect in THIS file and there is no
 * run in which it should reach a level record.
 */
export function assertPalette(palette = PRE_SWORD_PALETTE) {
    const names = new Set();
    if (!palette?.templates?.length) {
        fail('procgenPalette: a palette with no templates is not a palette.');
    }
    for (const t of palette.templates) {
        if (typeof t.name !== 'string' || names.has(t.name)) {
            fail(`procgenPalette: template names must be unique and non-empty — `
                + `"${t.name}" is not. The trace keys on the name and two rows with one `
                + 'name would count as one family member twice (trap 199).');
        }
        names.add(t.name);
        if (typeof t.family !== 'string' || !t.family) {
            fail(`procgenPalette: template "${t.name}" has no family. The report counts `
                + 'by family and an unnamed one would be counted as "undefined".');
        }
        if (!Array.isArray(t.footprint) || t.footprint.length === 0) {
            fail(`procgenPalette: template "${t.name}" has an empty footprint — a `
                + 'template that occupies no cell cannot be placed legally or illegally.');
        }
        const seen = new Set();
        for (const c of t.footprint) {
            const key = `${c.dx},${c.dy}`;
            if (seen.has(key)) {
                fail(`procgenPalette: template "${t.name}" names cell (${key}) twice in `
                    + 'its footprint. `withTerrain` refuses a doubled cell BY NAME, so '
                    + 'this would be an illegal placement at every anchor in the room.');
            }
            seen.add(key);
        }
        for (const w of t.terrain ?? []) {
            if (!TERRAIN[w.terrain]) {
                fail(`procgenPalette: template "${t.name}" writes terrain `
                    + `"${w.terrain}", which is not one of the PoC's four `
                    + `(${Object.keys(TERRAIN).join(', ')}).`);
            }
            if (!seen.has(`${w.dx},${w.dy}`)) {
                fail(`procgenPalette: template "${t.name}" writes (${w.dx},${w.dy}), `
                    + 'which is not in its own footprint. The footprint is what the '
                    + 'legality check reserves, so a write outside it would paint a cell '
                    + 'nobody checked was free.');
            }
        }
        for (const e of t.entities ?? []) {
            if (typeof e.type !== 'string' || !seen.has(`${e.dx},${e.dy}`)) {
                fail(`procgenPalette: template "${t.name}" places entity `
                    + `"${e.type}" at (${e.dx},${e.dy}), which is not in its footprint.`);
            }
        }
    }
    return true;
}

assertPalette();
