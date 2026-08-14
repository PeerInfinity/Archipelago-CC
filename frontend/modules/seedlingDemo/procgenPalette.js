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
 * ⛓⛓⛓ THE PER-PLACEMENT GROUP SLOT — the one attribute a FROZEN template
 * cannot hold a value for, and the defect that made it necessary.
 *
 * ⚖ USER-REPORTED, 2026-08-13: *"when the generator generates two different
 * pairs of switches and switch-opened doors, both of the switches open both of
 * the doors."* Measured before anything was built — `--seed=1 --count=4`, the
 * DEFAULT seed, keeps `wall-gap-lock-weigh-h` twice and emits:
 *
 *     lock@(80,48)  {tset:'0', tag:'0'}     button@(96,32) {tset:'0'}
 *     lock@(80,80)  {tset:'0', tag:'0'}     button@(96,64) {tset:'0'}
 *
 * ⛔ THE GROUP IS THE WHOLE MECHANISM, and it was a LITERAL in the table.
 * `levelWorld.tSetOf` reads `intAttr(attrs, 'tset', 0)`, and a press publishes
 * to every `Activators` sharing that number (`activators.js`'s transcription of
 * the setter: `if (v[i] != this && v[i].t == t)`). Two placements of one
 * template therefore put all four entities in group 0 — so it is a property of
 * THIS TABLE, not of the placement loop, and no seed avoids it.
 *
 * ⛓ IT IS ALSO WRONG ON THE SOLVE SIDE, which is the half a play-test would
 * have missed: `solverBot.refineStrategy` binds a lock's openers with
 * `pressers.filter((p) => p.t === row.t)`, so with one shared group each lock
 * sees BOTH buttons. The solver was already asking the group question the
 * right way; only the palette was answering it wrongly.
 *
 * ── WHY A SENTINEL AND NOT A TEMPLATE FACTORY ─────────────────────────
 *
 * The obvious shape — make `entities` a function of the placement — dissolves
 * every invariant this file is built on: `assertPalette` walks static
 * footprints at module load, `POST_SWORD_TEMPLATES` is a superset of the
 * pre-sword roster BY CONSTRUCTION (a spread of frozen rows, which
 * `procgenPostSword.test.js` drives), and each row's measurements are attached
 * to a row a reader can see. It also buys power the defect does not need: a
 * factory may vary ANYTHING per placement.
 *
 * So the table stays frozen and the slot is DECLARED IN IT. A reader of the
 * row sees `tset: PLACEMENT_GROUP` and knows the value is per-placement; the
 * template declares `groups: 1`; and `procgenSeedling.place` — the ONE writer
 * that turns template entities into level entities — resolves it.
 *
 * ⚠ THE SENTINEL'S OWN FAILURE MODE IS THE DANGEROUS ONE, so it is guarded
 * rather than hoped about: an UNRESOLVED sentinel would reach `intAttr`, which
 * parses any non-numeric string as **0** — i.e. silently back into the exact
 * collision this exists to end. `place` throws by name on an unresolved slot
 * and `assertPalette` refuses the half-converted row below (a lock on the slot
 * beside a button on a literal), because both are the shape that would look
 * fixed and behave broken.
 */
export const PLACEMENT_GROUP = '@placement-group';

/**
 * ⛓⛓⛓ THE PER-PLACEMENT PERSISTENCE TAG — the group slot's sibling, and a
 * SEPARATE defect that the group fix measured but deliberately did not touch.
 *
 * ⛔ `tag` IS NOT `tset`. The group is the live broadcast; the tag is the
 * SAVE-FILE FLAG. `Lock.turnOff()` (`Puzzlements/Lock.as:90-96`) is
 *
 *     if (type == normType) { type = ""; alpha = 0; Game.setPersistence(tag, false); }
 *
 * with **no `tag >= 0` guard**, and `returnToNormal()` writes the same slot
 * back TRUE. So a lock writes its tag every time it opens AND every time it
 * closes.
 *
 * ⚖ AND `SEEDLING_DEFAULTS.goalTag` IS `'0'` — the tag the weigh templates
 * carried. ⇒ every parked and unparked block was toggling the GOAL's own
 * persistence flag. `TorchPickup.check()` is
 * `if (tag >= 0 && !checkPersistence(tag)) { doActions = false; remove(this) }`,
 * so a cleared tag 0 removes the goal AND makes collecting it grant nothing.
 * This is the collision `KILL_LOCK_TEMPLATES` discharges by construction under
 * its own stated law — *a clear is a FLAG, so a lock on the goal's own tag
 * removes the GOAL* — and the weigh rows were breaking it.
 *
 * ⛓ MEASURED, post-sword palette, seeds 1..24 at target 6: **12 of 24 levels
 * had a shared tag, and every one of them was the goal sharing tag 0 with one
 * to three weigh locks** (seed 10: `torchpickup@32,112` with locks at 96,80 /
 * 64,80 / 128,80).
 *
 * ⚠ WHY IT WAS LATENT rather than a reported bug: `check()` runs at BUILD, and
 * a generated level is solved in ONE visit — the goal is built before any lock
 * opens. It bites on a rebuild or a re-entry, which is what `applyClearNow`
 * does (`levelRun` drops the memoised world so the level is rebuilt with the
 * clear applied).
 *
 * ⛔⛔ AND `tag: '-1'` IS NOT THE FIX — it is a different bug. With no guard on
 * the write, `setPersistence(-1, …)` resolves through `i * 30 + j` to
 * `(level - 1) * 30 + 29`, **the PREVIOUS level's last slot** — the out-of-band
 * family `outOfBandLedger` exists to model. A lock needs a real, private,
 * in-range tag.
 *
 * ⇒ the same slot mechanism as `PLACEMENT_GROUP`, with a DIFFERENT allocator:
 * `tag` is bounded by `TAGS_PER_LEVEL` (30), so the group's anchor arithmetic
 * — which reaches ~89 in a 10x10 room — cannot serve it. See
 * `procgenSeedling.placementTagId`.
 */
export const PLACEMENT_TAG = '@placement-tag';

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
     *
     * ⛔ THE GROUP IS THE ONE FIELD THAT DOES NOT SURVIVE THE TRANSCRIPTION,
     * and the user's 2026-08-13 report is why: L15 holds ONE pair, so its
     * `tset: "0"` is a room's private group; a PALETTE row is placed many
     * times in one room, where the same literal is one shared group and every
     * button opens every lock. Both entities carry `PLACEMENT_GROUP` and
     * `groups: 1` declares the slot — see the sentinel's own docblock.
     *
     * ⚠ `tag: '0'` IS LEFT AS THE TRANSCRIPTION SAYS, and it is a SEPARATE
     * OPEN QUESTION rather than a field this slice cleared. It is the
     * PERSISTENCE flag, not the broadcast group: a plain `Lock` that fades
     * open writes `Game.setPersistence(tag, false)` (`activators.js`'s
     * transcription of `turnOff()`'s third line), and `SEEDLING_DEFAULTS`
     * `goalTag` is ALSO `'0'` — the very collision `KILL_LOCK_TEMPLATES`
     * discharges by construction with its `tag: '1'` ("a clear is a FLAG, so a
     * lock on the goal's own tag removes the GOAL"). ⛔ NOT FIXED HERE, and
     * NOT because it was judged harmless: the right value is not a literal
     * either (`'1'` is the kill-lock's, so two placements would collide there
     * instead), so it wants this same per-placement treatment on a field whose
     * blast radius — the goal, the scratch layer, `botDriverV1`'s v9 `at`
     * declarations — has not been measured. ⚖ Reported to the user with the
     * evidence, 2026-08-13; the slot mechanism above is field-agnostic and
     * will serve `tag` unchanged when that measurement exists.
     */
    Object.freeze({
        name: 'wall-gap-lock-weigh-h',
        family: 'weigh',
        groups: 1,
        tags: 1,
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
                dx: GAP_OFFSET,
                dy: 0,
                type: 'lock',
                attrs: Object.freeze({ tset: PLACEMENT_GROUP, tag: PLACEMENT_TAG }),
            }),
            Object.freeze({
                dx: BUTTON_OFFSET,
                dy: -1,
                type: 'button',
                attrs: Object.freeze({ tset: PLACEMENT_GROUP }),
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
        groups: 1,
        tags: 1,
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
                dx: 0,
                dy: GAP_OFFSET,
                type: 'lock',
                attrs: Object.freeze({ tset: PLACEMENT_GROUP, tag: PLACEMENT_TAG }),
            }),
            Object.freeze({
                dx: -1,
                dy: BUTTON_OFFSET,
                type: 'button',
                attrs: Object.freeze({ tset: PLACEMENT_GROUP }),
            }),
            Object.freeze({ dx: -1, dy: BLOCK_OFFSET, type: 'pushableblock' }),
        ]),
        pins: Object.freeze([]),
        why: 'the same locked door stood on end, with the lane running down the column '
            + 'beside it — a SOUTH lean rather than an EAST one, which is a different '
            + '`SHOVE_STEP` row and therefore a real second draw',
    }),
]);

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

export const PRE_SWORD_PALETTE = Object.freeze({
    name: 'pre-sword',
    items: PRE_SWORD_ITEMS,
    templates: PRE_SWORD_TEMPLATES,
    excluded: EXCLUDED_TEMPLATES,
});

/* ══════════════════════════════════════════════════════════════════════
 * THE POST-SWORD BIOME — PoC slice 4 (⚖ kickoff §0's second biome, §4.4)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ §0: *"TWO BIOMES: one for before the player has the sword, one for
 * after."* The biome is the BOOT, and here that is the whole of it.
 *
 * ── ⛓⛓⛓ SLICE 4e: THE BIOME NOW ADDS ONE, AND THE HEADLINE BELOW IS ITS
 * ── OWN HISTORY RATHER THAN THE CURRENT STATE ────────────────────────
 *
 * Kickoff §3.3 named three post-sword additions — chest in a corridor,
 * spinner+kill-lock, key+keylock. ⚖ §10.7 EXPIRED §9.8's advice to carry them
 * as inherited exclusions and required a re-probe from scratch. Slice 4 ran
 * that re-probe, plus a ⚖-ruled bounded sweep of a fourth candidate
 * (`solid:shieldboss → fight`), and NONE of the four could be offered — so
 * for slices 4, 4b and 4c the post-sword palette was the pre-sword ROSTER
 * under a different boot, and this docblock said so at length.
 *
 * ⛔ **SLICE 4e PROMOTED `spinner+kill-lock`** (`KILL_LOCK_TEMPLATES`), so
 * three of the four remain excluded and the biome finally has a family a
 * pre-sword boot cannot clear. The paragraphs below are KEPT rather than
 * rewritten, because the reasoning they record is what the promotion had to
 * discharge — and because the last of the three causes was a CONSERVATIVE
 * INGREDIENT (a 13 px all-phases hammer disc standing in for an exact line the
 * boot could have made countable all along), which is the arc's third arrival
 * of traps 171/173 and worth being able to re-read.
 *
 * ⚖ AND ONE OF THE FOUR WAS NEVER A CANDIDATE (user, 2026-08-12, mid-slice):
 * **a chest is a SOLVER CAPABILITY, not a palette family.** What was wanted
 * from `solid:chest → chest` is that the solver KNOWS it can clear a chest by
 * collecting it — which the row already provides — not that the generator
 * deliberately places chests as obstacles. Its row below is therefore
 * CAPABILITY DOCUMENTATION rather than a rejected candidate, and it is kept
 * for the same reason every other row is: the geometry it measures is what a
 * later slice would otherwise re-discover by building the thing.
 *
 * ⚠ SAYING THAT OUT LOUD IS THE POINT. A biome that quietly shipped the same
 * six families under a new name would read as a palette that grew; naming the
 * gap makes "the post-sword palette has no post-sword-EXCLUSIVE clearer" a
 * finding the next slice inherits rather than one it re-discovers
 * (`feedback_bounded_sweep_must_name_what_it_bounded`).
 *
 * ── ⛔⛔ AND THE TWO BIOMES CURRENTLY PRODUCE THE SAME LEVEL ───────────
 *
 * The roster is shared BY REFERENCE (below) — one array, so a template added
 * to the palette cannot reach one biome and miss the other. The only other
 * difference is `items`, and MEASURED, at this palette, it changes nothing the
 * generator can see: the same room solved under both boots gives the same
 * verdict and the same tick count in 12 of 12 seeds, and seed 9 at target 8
 * produces a BYTE-IDENTICAL level record and a byte-identical trace under both
 * — only the summary differs, because the summary is where `items` is
 * recorded.
 *
 * ⚠⚠ AN EARLIER DRAFT OF THIS DOCBLOCK CLAIMED THE OPPOSITE (113 ticks
 * pre-sword against 122 post-sword) and it was WRONG: those two numbers came
 * from rooms with different goal cells, so the comparison was never about the
 * sword. The claim is recorded here because a palette that asserts a
 * difference it does not have would be read as the biome doing work.
 *
 * ⇒ THE HONEST STATEMENT: with no post-sword-exclusive template, the sword is
 * an inventory flag no obstacle in this palette consults, so the biome split
 * is REAL IN THE BOOT and NIL IN THE OUTPUT. ⛓ This is a direct input to
 * slice 5's REQUIREMENTS REPORT (⚖ §1.10a): its with/without differential will
 * find NO required item at this palette, and *"rule not established"* is the
 * verdict that ruling already names for exactly this case. The report will be
 * right; what it reports is a fact about the palette, not about the report.
 */
export const POST_SWORD_ITEMS = Object.freeze({ hasSword: true, hasShield: false });

/**
 * ⛓⛓⛓ SLICE 4e — THE SPINNER OFFSET, AND IT IS MEASURED RATHER THAN CHOSEN.
 *
 * The spinner stands one cell back from the wall on the START side, and WHERE
 * along that lane decides how many anchors the family can certify at. Swept on
 * the dedicated door geometry, seeds 1..4, every legal anchor:
 *
 *   offset      1      2      3      5      6
 *   discharged  7      5      8      9     12
 *   refused    13     15     12     11      8
 *
 * Zero throws at every offset (the door rule below is what buys that), so the
 * offset is a YIELD parameter and not a safety one. Six is the far end of the
 * wall, the end away from the start corner — which is the room the strike
 * derivation needs, and the sweep is what says so.
 */
const SPINNER_OFFSET = 6;

/**
 * ⛓⛓⛓ SLICE 4e — THE POST-SWORD-EXCLUSIVE FAMILY, AND THE ARC'S FIRST ONE.
 *
 * A wall across the whole interior, a `tset:-1` KILL LOCK in its one gap, and a
 * `spinner` standing behind the wall on the start's side. The lock opens when
 * the room's enemy count reaches zero, so the only way past is to KILL — with
 * the sword, which is what makes this the first template in the arc that a
 * pre-sword boot cannot clear.
 *
 * ── WHAT HAD TO HAPPEN BEFORE THIS ROW COULD EXIST ────────────────────
 *
 * Three causes excluded it, and they were discharged one slice at a time:
 *
 *  1. **THE DECLARATION** (slice 4 §12.3.ii) — the durable clear was a v9 TAPE
 *     declaration a generated level has none of. Discharged by 4b's scratch
 *     persistence layer: the model is the one writer of a slot no tape owns.
 *  2. **THE TAG COLLISION** (4b §13.7.2) — *a clear is a FLAG*, so a lock on
 *     the goal's own tag removes the GOAL. Discharged BY CONSTRUCTION here: the
 *     lock's tag is `'1'` and `SEEDLING_DEFAULTS.goalTag` is `'0'`, and
 *     `procgenPostSword.test.js` asserts the two are different rather than
 *     trusting the literals.
 *  3. **THE THROW** (4b §13.7.iv) — the hammer-transit refusal ABORTED the run,
 *     and *a family the loop cannot REJECT is not one the palette can OFFER*.
 *     Discharged TWICE OVER at slice 4e: the countable clock retired 19 of the
 *     sweep's 26 transit throws (the 13 px all-phases disc was manufacturing
 *     them — traps 171/173, third arrival), and `procgenOracle` now classifies
 *     the seven that remain as REFUSALS.
 *
 * ⛔ AND A FOURTH THE PROMOTION ITSELF EXPOSED: with the goal on the START's
 * side of the wall, the walk collects the torch while the spinner is still
 * alive and `levelRun.assertDialogueFreeSpinnerRoom` kills the run by name.
 * That is why these two rows carry `door`, and the rule is in
 * `procgenSeedling.legalAt` beside `laneClear` — the model's own legality, not
 * a hope. Measured: three of twelve legal anchors before the rule, zero after.
 *
 * ── THE EVIDENCE, TO THE ARC'S OWN STANDARD (§12.1) ───────────────────
 *
 * ⚠ Slice 3 promoted on dedicated probes; 3b re-cut that evidence standard; 4
 * re-cut the instrument. So this row is certified by DISCHARGE EXISTENCE in the
 * FINAL level's own solve, never by keep-counts:
 *
 *  · DEDICATED, seeds 1..24, every legal anchor of both rows: **81 SOLVED and
 *    discharged, 41 REFUSED, ZERO THROWN.**
 *  · GENERATED, seed 3 at target 6: the loop KEEPS `-h` at (1,2), and the
 *    finished six-obstacle level re-solves in 378 ticks with a
 *    `{strategy:'kill'}` record AND
 *    `scratchClears [{tag:1, by:'spinner@112,16', lock:'lock@80,32'}]` — the
 *    template's OWN spinner and its OWN lock, which an obstacle nobody had to
 *    clear can produce neither of.
 *  · REACH, seeds 1..72 at target 6: **13 seeds keep one** (3, 27, 31, 36, 44,
 *    45, 49, 60, 61, 66, 69, 70, 71), so the family is not a probe curiosity.
 *
 * ── ⚠⚠ THE COST THIS ROW SHIPS WITH, MEASURED AND NOT SOFTENED ────────
 *
 * The same 72 seeds at target 6, like for like:
 *
 *   the committed nine-template roster    **1 of 72** runs ABORT (seed 66)
 *   this eleven-template roster           **6 of 72** (15, 20, 25, 54, 55, 57)
 *
 * Every one is a `PhysicsV2Error` — §9.3's own sentence, *the approach drive
 * clips lethal terrain the corridor planner routed around* — and the class is
 * PRE-EXISTING: it fires at the committed roster with no spinner anywhere in
 * the room. What this row changes is the FREQUENCY, and the honest statement of
 * that is: **direction consistent, not excluded, not proven** (n=72 a side,
 * p≈0.11). One of the aborting rooms (seed 15) provably held a kill template;
 * a hazard-driven step is a plausible mechanism and is not a demonstrated one.
 *
 * ⛔ THE CATCH IS NOT WIDENED TO IT, and that is deliberate: a `PhysicsV2Error`
 * is the ENGINE saying the route stepped where it must not, and classifying it
 * would hide a real defect behind "that candidate didn't work out"
 * (traps 171/173). ⚖ Endorsed by the orchestrator, 2026-08-12, and recorded as
 * a SOLVER question for R9 — the approach drive, now measured at three separate
 * moments (§9.3, the committed 1/72, this 6/72).
 *
 * ⛓ ⚖ AND SLICE 5's BATCH INHERITS AN OBLIGATION: an aborting seed is VISIBLE
 * (the CLI exits 3) and is simply not chosen — so the acceptance batch must
 * REPORT how many seeds it skipped and why. A batch that quietly picks five
 * clean levels out of thirteen carriers reads as "generation is abort-free"
 * when it is not (`feedback_bounded_sweep_must_name_what_it_bounded`).
 */
const KILL_LOCK_TEMPLATES = Object.freeze([
    Object.freeze({
        name: 'wall-gap-spinner-killlock-h',
        family: 'kill',
        door: 'h',
        footprint: Object.freeze([...rectCells(INTERIOR_SPAN, 1), cell(SPINNER_OFFSET, -1)]),
        clearance: Object.freeze([]),
        terrain: paint(rectCells(INTERIOR_SPAN, 1).filter((c) => c.dx !== GAP_OFFSET), 'wall'),
        entities: Object.freeze([
            Object.freeze({
                dx: GAP_OFFSET,
                dy: 0,
                type: 'lock',
                // ⛔ `tset: '-1'` IS THE KILL LOCK (L5/L18's own spelling), and
                // `tag: '1'` is the tag law: never the goal's.
                attrs: Object.freeze({ tset: '-1', tag: '1' }),
            }),
            Object.freeze({
                dx: SPINNER_OFFSET, dy: -1, type: 'spinner', attrs: Object.freeze({ tag: '-1' }),
            }),
        ]),
        pins: Object.freeze([]),
        why: 'a Stone wall across the whole interior with a KILL LOCK in its ONE gap and '
            + 'the spinner whose death opens it standing behind the wall — `refineStrategy` '
            + 'takes the `tset == -1` lock to `kill`, the press schedule strikes on '
            + '`KILL_PRESS_CADENCE`, and the durable clear is written by 4b\'s scratch '
            + 'layer on the tick the lock\'s own fade names. ⛓ THE ONLY TEMPLATE IN THE '
            + 'ARC A PRE-SWORD BOOT CANNOT CLEAR: `weaponForPress` returns null with no '
            + 'sword slot, so the press is a silent no-op and the lock never opens',
    }),
    Object.freeze({
        name: 'wall-gap-spinner-killlock-v',
        family: 'kill',
        door: 'v',
        footprint: Object.freeze([...rectCells(1, INTERIOR_SPAN), cell(-1, SPINNER_OFFSET)]),
        clearance: Object.freeze([]),
        terrain: paint(rectCells(1, INTERIOR_SPAN).filter((c) => c.dy !== GAP_OFFSET), 'wall'),
        entities: Object.freeze([
            Object.freeze({
                dx: 0, dy: GAP_OFFSET, type: 'lock', attrs: Object.freeze({ tset: '-1', tag: '1' }),
            }),
            Object.freeze({
                dx: -1, dy: SPINNER_OFFSET, type: 'spinner', attrs: Object.freeze({ tag: '-1' }),
            }),
        ]),
        pins: Object.freeze([]),
        why: 'the same killed door stood on end — the wall runs down a column and the '
            + 'spinner stands in the column beside it, which is a different approach '
            + 'geometry for `deriveStrike` and therefore a real second draw',
    }),
]);

/**
 * ⛔⛔ NO LONGER SHARED BY REFERENCE — SLICE 4e, and this is the roster split
 * §12.2 and §13.9 both predicted and neither could make.
 *
 * Seven families, eleven templates: the pre-sword nine, PLUS the kill-lock pair
 * above, which a pre-sword boot cannot clear. ⛓ Until this slice the two
 * biomes were one array on purpose — *"so a template added to the palette
 * cannot reach one biome and miss the other"* — and that was the honest shape
 * while no family was sword-gated. It is exactly the wrong shape now: the whole
 * point of this pair is that it reaches ONE biome.
 *
 * ⛓ The pre-sword roster is spread rather than referenced so the post-sword
 * array is a superset BY CONSTRUCTION; `procgenPostSword.test.js` asserts the
 * containment, which is the claim "shared by reference" used to buy.
 */
export const POST_SWORD_TEMPLATES = Object.freeze([
    ...PRE_SWORD_TEMPLATES, ...KILL_LOCK_TEMPLATES,
]);

/**
 * ⛔⛔⛔ THE POST-SWORD EXCLUSIONS — the re-probe ⚖ §10.7 demanded, from
 * scratch, and NOTHING here is inherited.
 *
 * All measured 2026-08-12 in slice 3's own corridor geometry (a 10x10 bordered
 * room, a Stone wall across the whole interior with ONE gap, the candidate in
 * the gap, `torchpickup` collect goal strictly beyond it, boot
 * `POST_SWORD_ITEMS`, `DEFAULT_BUDGET`) — the shape §11.7 requires, where the
 * template IS the door rather than a decoration a keep-count cannot tell apart.
 *
 * ⚠ THREE OF THE FOUR CAN **THROW** RATHER THAN REFUSE, and that is a stronger
 * reason to exclude than any of the refusals. `procgenOracle` classifies only
 * `SolverRefusal` and `BotDriverV2Error`; a `SolverBotError` or a bare
 * `levelRun` `Error` escapes it and `levelGenerator` turns that into
 * `GenerationAborted` — so one of these families in the palette would ABORT a
 * run, not reject a candidate. (⚠ Widening the oracle's catch is exactly what
 * traps 171/173 forbid doing casually; recorded, not done.)
 */
export const POST_SWORD_EXCLUDED_TEMPLATES = Object.freeze([
    Object.freeze({
        name: 'chest-in-the-gap',
        family: 'chest',
        cause: '⚖ NOT A PALETTE FAMILY (user, 2026-08-12) — a SOLVER CAPABILITY. The '
            + 'geometry below is CAPABILITY DOCUMENTATION, not a rejected candidate.',
        measured: '⚖ THE RULING FIRST: what `solid:chest → chest` is for is that the '
            + 'solver KNOWS a chest in its way can be cleared by COLLECTING it; the '
            + 'generator was never meant to place chests as deliberate obstacles. So '
            + 'nothing here is an exclusion — it is the bound on the capability, measured '
            + 'while the question was still open, and worth keeping because a later slice '
            + 'that reached for a chest DOOR would otherwise measure it again.\n'
            + '⛓ AND §2/§9.8\'s "chest is proven" DOES NOT TRANSFER — that was measured '
            + 'on L11\'s own one-tile shaft, and a measured CAPABILITY is as local as a '
            + 'measured limitation. `chestStanceBand` (`chest.js:167`) searches rows from '
            + '`py + box.h - 16` DOWNWARD and skips every row whose player box overlaps '
            + 'the chest\'s own solid, so the stance that fires the open-trigger line is '
            + 'strictly BELOW the chest — the game\'s own trigger geometry, not a solver '
            + 'choice. The room\'s start is its fixed NW corner (`SEEDLING_DEFAULTS.start` '
            + '= (1,1)), so every crossing a SINGLE template can make runs north→south or '
            + 'west→east ⇒ the opener\'s stance is on the side the player is trying to '
            + 'reach. Driven both ways: in a HORIZONTAL wall\'s gap the stance is beyond '
            + 'the wall, and in a VERTICAL wall\'s gap the cell below the chest is the '
            + 'wall itself. The verb IS selected in both — this is not slice 2\'s '
            + '"never reached" — and it is applied to `MAX_STRATEGIES_PER_GOAL` without a '
            + 'corridor ever appearing.',
        refusalText: 'solverBot(chest: h-gap, goal beyond) collect (112,128) stance '
            + '(ladder-routed: …) -> chest stance (chest@64,80) -> chest stance '
            + '(chest@64,80) -> chest stance (chest@64,80) -> chest stance (chest@64,80): '
            + 'applied 4 strategies for one goal [chest(chest@64,80), chest(chest@64,80), '
            + 'chest(chest@64,80), chest(chest@64,80)] and the corridor still does not '
            + 'plan. A policy that keeps clearing obstacles without a corridor appearing '
            + 'is not making progress.',
        wouldNeed: '⛔ NOTHING — ⚖ the user ruled the family out of scope, so there is no '
            + 'work owed here. Recorded for completeness only: a chest DOOR would need a '
            + 'room whose route DOUBLES BACK so the crossing runs south→north, which '
            + 'needs TWO cooperating templates (one to force the player south, one to be '
            + 'the door) — the depth-1 boundary ⚖ §1.6 draws on purpose (*templates '
            + 'remove the need for cooperative multi-step placement*). ⚠ THE GOAL-SIDE '
            + 'SHAPE IS ITS '
            + 'OWN RESIDUE: a chest whose rect CONTAINS the pickup makes the solve RETURN '
            + 'UNCERTIFIED rather than refuse — `procgenOracle` catches it as *"the solve '
            + 'returned but the goal list is not certified — no collect record for '
            + 'place:112,112. `solveSegment` is supposed to refuse rather than return '
            + 'short, so this is a seam defect, not a rejected candidate."* Recorded for '
            + 'a future engine slice; nothing in this arc touches it.',
    }),
    /**
     * ⛓⛓⛓ `spinner-killlock` WAS HERE, AND IT IS NOW A TEMPLATE.
     *
     * SLICE 4e PROMOTED IT (`KILL_LOCK_TEMPLATES`, above). The three causes
     * this row carried are all discharged and the promotion's docblock tells
     * the whole chain: the DECLARATION by 4b's scratch layer, the TAG COLLISION
     * by construction (lock tag 1, goal tag 0), and the THROW by the countable
     * clock plus the ONE named widening in `procgenOracle` — 26 of 32 transit
     * throws were the all-phases disc's doing, and 19 of them went away when
     * the boot declared `save.time`.
     *
     * ⚠ THE ROW IS GONE RATHER THAN KEPT-AND-MARKED because `assertPalette`'s
     * own invariant is that nothing excluded is also offered, and
     * `procgenPostSword.test.js` drives it. The measurement did not go with it.
     */
    Object.freeze({
        name: 'key-keylock-pair',
        family: 'keylock',
        cause: 'UNDIAGNOSED — the verb resolves and the corridor never opens',
        measured: '⚠⚠ THE DECIDING CAUSE IS NOT NAMED, AND THIS ROW SAYS SO — the '
            + '"applied 4 strategies and no corridor" line below is the SYMPTOM; the '
            + 'diagnosis is OPEN. Nobody should read this exclusion as understood. What '
            + 'IS established: `resolveKeylockStrategy` gates on the RUN\'s own key set '
            + '(`BossLock.update` reads `Player.hasKey(keyType)`, a save-file boolean and '
            + 'not one of the fourteen `botStatus.items` fields), and with no key the '
            + 'solve THROWS `SolverBotError` — *"the key is a SUB-ORDER — a '
            + '`collect-placement` goal the macro layer owes — and inventing a stance for '
            + 'an unkeyed lock would be a wait with no mechanism behind it."* BOTH cures '
            + 'were driven and BOTH fail identically: (a) the key GRANTED at boot '
            + '(`staging.save.keys = [0]`, the channel `levelRun.js:3137` reads), and (b) '
            + 'the key as a FIRST `collect-placement` in an ordered queue — where the key '
            + 'IS collected (verbs `walk`, `collect`, `keylock`) and the door still never '
            + 'opens. ⇒ holding the key is NOT the missing piece, which is what makes the '
            + 'symptom worth recording separately from the guess.',
        refusalText: 'solverBot(keylock: key granted, lock in h-gap) collect (112,128) '
            + 'stance (ladder-routed: …) -> keylock stance (bosslock@64,80) -> keylock '
            + 'stance (bosslock@64,80) -> keylock stance (bosslock@64,80) -> keylock '
            + 'stance (bosslock@64,80): applied 4 strategies for one goal '
            + '[keylock(bosslock@64,80), keylock(bosslock@64,80), keylock(bosslock@64,80), '
            + 'keylock(bosslock@64,80)] and the corridor still does not plan. A policy '
            + 'that keeps clearing obstacles without a corridor appearing is not making '
            + 'progress.',
        wouldNeed: 'FIRST a diagnosis — why the re-plan after a resolved `keylock` still '
            + 'prices the lock as a wall — because until that is named, any template built '
            + 'here would be built against a guess. ⚠ Note the SHARED SHAPE with '
            + '`chest-in-the-gap`: both are verbs that RESOLVE, get applied to '
            + '`MAX_STRATEGIES_PER_GOAL`, and never move the corridor, while `shove`, '
            + '`weigh` and `hold` all do. Two families with one symptom is a hint about '
            + 'the LADDER rather than about either family, and it is the first thing to '
            + 'ask. ⛔ Since design (b) works as far as collecting the key, the goal-QUEUE '
            + 'widening (⚖ §1.4) buys nothing here and is NOT proposed.',
    }),
    Object.freeze({
        name: 'shieldboss-door',
        family: 'fight',
        cause: 'INCOMPATIBLE WITH v1\'s ONLY GOAL',
        measured: '⚖ RULED A BOUNDED PROBE (orchestrator, 2026-08-12) after the three '
            + 'named families all failed: `solid:shieldboss → fight` is a registered '
            + 'executor, `KILL_ARM_POLICY.ShieldBoss` is `modelled`, and ⚖ §0\'s "before '
            + 'collecting the shield" is the shieldboss\'s own room — so it was the last '
            + 'candidate for a post-sword-EXCLUSIVE clearer. NINE geometries (h walls at '
            + 'ty 3/4/5/6 with a 3-wide gap, v walls at tx 3/4/5 with a 3-tall gap, a '
            + '1-wide gap, and an open room): ZERO solved, FIVE threw. The `fight` verb '
            + 'resolves in all of them; two REFUSE on the same '
            + '"applied 4 strategies … no corridor" line the chest and the keylock give, '
            + 'and one spends the per-target budget grazing the 48x48 body.',
        refusalText: 'levelRun: a torchpickup ceremony began in level 900 while the '
            + 'ShieldBoss shieldboss@64,64 is still in the world. `ShieldBoss.hitPlayer` '
            + 'is not freeze-gated — its 120-update stand-under counter advances through '
            + 'every frozen frame — and this model spends a ceremony\'s phase A as a LUMP '
            + 'in `frozenFramesOwed` rather than as steps. So the game would count 150 '
            + 'updates the model counts none of. Collect after the removal, or step the '
            + 'freeze.',
        wouldNeed: '⛔ NOTHING ABOUT THE FIGHT — the blocker is the GOAL. ⚖ §1.4 makes '
            + '`collect-placement` v1\'s only goal kind and slice 1 §8.2 makes '
            + '`torchpickup` the pickup, so EVERY generated level ends in a ceremony; a '
            + 'live ShieldBoss anywhere in the room refuses that ceremony by name. The '
            + 'cure the message itself offers — *"collect after the removal"* — is a '
            + 'template that guarantees the boss dies FIRST, which is an ORDER between a '
            + 'clearer and the goal that a depth-1 loop with one goal cannot express.',
    }),
]);

export const POST_SWORD_PALETTE = Object.freeze({
    name: 'post-sword',
    items: POST_SWORD_ITEMS,
    templates: POST_SWORD_TEMPLATES,
    excluded: POST_SWORD_EXCLUDED_TEMPLATES,
});

/**
 * ⛔⛔⛔ THE GROUP SLOT'S OWN INVARIANTS — three, and every one of them exists
 * because the shape it forbids would look FIXED AND BEHAVE BROKEN.
 *
 * 1. **NO HALF-CONVERTED ROW.** A template that declares `groups` may not also
 *    carry a LITERAL `tset` on any entity. Convert the lock and leave the
 *    button on `'0'` and the level is *worse* than before: the lock sits alone
 *    in a private group and the door never opens at all, while the table reads
 *    as parameterized.
 * 2. **NO SOLO GROUP.** Fewer than two entities on the slot is an entity that
 *    can neither publish to nor hear from anything — a group of one is not a
 *    group, and it is what a half-finished edit produces.
 * 3. **THE ANCHOR MUST BE CONSUMED**, which is what makes the id INJECTIVE.
 *    `procgenSeedling` derives the group from the anchor CELL, so two kept
 *    placements sharing an anchor would share a group and re-open the whole
 *    defect. They cannot: `isFree` refuses a cell whose terrain was painted or
 *    which holds an entity, so a template that WRITES its own `(0,0)` consumes
 *    the anchor for every later placement. ⛓ That is true of both weigh rows
 *    today by their geometry — this check is what keeps it true BY
 *    CONSTRUCTION rather than by a lucky reading, per the standing law that a
 *    derived property nobody asserts is a property that quietly stops holding.
 */
function assertGroupSlot(t, footprintKeys) {
    const onSlot = (t.entities ?? []).filter(
        (e) => Object.values(e.attrs ?? {}).includes(PLACEMENT_GROUP),
    );
    if (t.groups === undefined) {
        if (onSlot.length > 0) {
            fail(`procgenPalette: template "${t.name}" puts ${onSlot.length} entit`
                + `${onSlot.length === 1 ? 'y' : 'ies'} on the placement-group slot but `
                + 'declares no `groups`. `place` resolves the slot only for a template '
                + 'that declares it, so the sentinel would reach the level as a literal '
                + 'and `intAttr` parses any non-numeric string as 0 — silently back into '
                + 'the shared group this slot exists to end.');
        }
        return;
    }
    if (t.groups !== 1) {
        fail(`procgenPalette: template "${t.name}" declares groups=${t.groups}; the only `
            + 'supported count is 1. `procgenSeedling` derives ONE id from the anchor '
            + 'cell, and a second group would need a spacing rule that keeps the ids '
            + 'injective — which nobody has written.');
    }
    if (onSlot.length < 2) {
        fail(`procgenPalette: template "${t.name}" declares groups=1 but only `
            + `${onSlot.length} of its entities carry PLACEMENT_GROUP. A group of one `
            + 'publishes to nothing and hears from nothing — this is the half-converted '
            + 'row (the lock moved to a private group, the button left on a literal), '
            + 'which reads as parameterized and never opens.');
    }
    for (const e of t.entities ?? []) {
        if (e.attrs?.tset !== undefined && e.attrs.tset !== PLACEMENT_GROUP) {
            fail(`procgenPalette: template "${t.name}" declares groups=1 and its `
                + `"${e.type}" still carries the LITERAL tset "${e.attrs.tset}". One `
                + 'placement would then span two groups, which is not a mechanism '
                + 'anybody designed.');
        }
    }
    const writesAnchor = (t.terrain ?? []).some((w) => w.dx === 0 && w.dy === 0)
        || (t.entities ?? []).some((e) => e.dx === 0 && e.dy === 0);
    if (!footprintKeys.has('0,0') || !writesAnchor) {
        fail(`procgenPalette: template "${t.name}" declares groups=1 but does not `
            + 'occupy AND write its own anchor (0,0). The group id is derived from the '
            + 'anchor cell, so an unconsumed anchor lets a later placement anchor in the '
            + 'same cell and land in the SAME group — the defect, restored.');
    }
}

/**
 * ⛔⛔ THE TAG SLOT'S INVARIANTS — the group's, with ONE deliberate difference.
 *
 * A group of one is meaningless, so `assertGroupSlot` demands two entities on
 * the slot. **A TAG OF ONE IS THE NORMAL CASE** — a lock's private flag is its
 * own and nothing else's — so this demands at least one and never two.
 *
 * ⚠ AND A LITERAL `-1` IS ALLOWED BESIDE THE SLOT, unlike a literal `tset`.
 * `-1` is the game's own spelling of *untagged* (`tagOf` returns it for a
 * missing attribute) and `KILL_LOCK_TEMPLATES`'s spinner carries it
 * deliberately. A literal `>= 0` is refused: that is a REAL slot, and a
 * template holding one beside an allocated one would span two rows of the
 * persistence table for no reason anybody designed.
 */
function assertTagSlot(t) {
    const onSlot = (t.entities ?? []).filter(
        (e) => Object.values(e.attrs ?? {}).includes(PLACEMENT_TAG),
    );
    if (t.tags === undefined) {
        if (onSlot.length > 0) {
            fail(`procgenPalette: template "${t.name}" puts an entity on the `
                + 'placement-tag slot but declares no `tags`. `place` resolves the slot '
                + 'only for a template that declares it, so the sentinel would reach the '
                + 'level and be read as tag 0 — the GOAL\'s own flag.');
        }
        return;
    }
    if (t.tags !== 1) {
        fail(`procgenPalette: template "${t.name}" declares tags=${t.tags}; the only `
            + 'supported count is 1. `placementTagId` allocates ONE free slot per '
            + 'placement, and a second would need its own allocation nobody has written.');
    }
    if (onSlot.length < 1) {
        fail(`procgenPalette: template "${t.name}" declares tags=1 and no entity carries `
            + 'PLACEMENT_TAG. A declared slot nobody uses is a claim with nothing '
            + 'behind it.');
    }
    for (const e of t.entities ?? []) {
        const v = e.attrs?.tag;
        if (v === undefined || v === PLACEMENT_TAG) continue;
        if (Number.parseInt(v, 10) >= 0) {
            fail(`procgenPalette: template "${t.name}" declares tags=1 and its `
                + `"${e.type}" still carries the LITERAL tag "${v}". One placement would `
                + 'then write two rows of the persistence table. (A literal `-1` is '
                + 'allowed — that is the game\'s spelling of UNTAGGED, not a slot.)');
        }
    }
}

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
        // ⛔ SLICE 4e: a `door` typo would SILENTLY DISABLE the legality rule
        // that keeps the kill-lock family from aborting runs, and the template
        // would still place — the named-arm-nobody-built shape, one field over.
        if (t.door !== undefined && t.door !== 'h' && t.door !== 'v') {
            fail(`procgenPalette: template "${t.name}" has door "${t.door}"; the rule in `
                + '`procgenSeedling.legalAt` reads \'h\' or \'v\' and anything else would '
                + 'be silently ignored — a legality gate that does not gate.');
        }
        for (const e of t.entities ?? []) {
            if (typeof e.type !== 'string' || !seen.has(`${e.dx},${e.dy}`)) {
                fail(`procgenPalette: template "${t.name}" places entity `
                    + `"${e.type}" at (${e.dx},${e.dy}), which is not in its footprint.`);
            }
        }
        assertGroupSlot(t, seen);
        assertTagSlot(t);
    }
    return true;
}

assertPalette();
// ⛔ BOTH biomes, at load. They share a roster today, so this is cheap — and it
// is the check that would fire on the day they stop sharing one.
assertPalette(POST_SWORD_PALETTE);
