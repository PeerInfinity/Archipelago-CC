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
import { connected, reachableFrom, shortestPath } from '../procgenCore/gridFlood.js';
import { generateLevel } from '../procgenCore/levelGenerator.js';
/**
 * ⛓⛓⛓ PROCGEN ELEMENTS arc 3, slice 4b — **THE ONE PARTITION AND THE ONE
 * LEVEL-n FLOOD**, lifted out of `mazeRoom/procgenMaze.js` by this slice so
 * that both bindings run the SAME rule (`procgenCore/areaPartition.js`'s own
 * docblock carries the rule and the two callers' differences). ⛔ The Seedling
 * side hands in `terrainAt === 'ground'` — wall, water AND pit all block, which
 * is the pre-check's own vocabulary and not a second reading of it.
 */
import { partitionAreas, verifyAreaLevels } from '../procgenCore/areaPartition.js';
import { buildAreaGraph } from '../procgenCore/areaGraph.js';
import {
    DEFAULT_AREAS, formatAreaSpec, normalizeAreaSpec, resolveAreaSpec,
} from '../procgenCore/areaSpec.js';
/**
 * ⛓ PROCGEN ELEMENTS arc 3, slice 1 — the SITE vocabulary, in `procgenCore/`
 * because it is stated in grid vocabulary and the maze will bind it next. ⛔ A
 * site is a fact about the SEARCH, never about legality; see that file's law.
 */
import { deriveSites, siteCells, siteSummaryOf } from '../procgenCore/sites.js';
/**
 * ⛓⛓⛓ PROCGEN ELEMENTS arc 3, slice 5a (D3) — **THE GENERATION LEDGER**, ⚖ the
 * user's own requirement on the 2026-08-17 generation review (§4 item 6). ⛔ It
 * is BYTE-INERT: nothing here is handed an rng, no row reaches `summary` (and
 * therefore no payload), and every appender call sits AFTER its phase's own
 * work. See `procgenLedger.js`'s docblock for the three claims and the spy.
 */
import { makeLedger, paintable, phaseRow } from './procgenLedger.js';
/**
 * ⛓⛓ PROCGEN ELEMENTS arc 3, slice 3 — THE ELEMENT SPEC's ONE CODEC (shared
 * with the maze CLI, the sweep and slice 5's `?elements=`) and the Seedling
 * BINDING of the reverse-pull gadget. ⛔ The element itself is
 * `procgenCore/elements/reversePullBlock.js` — the SAME one the maze binds; the
 * binding maps its tiles and symbols onto Seedling's parts and nothing more.
 */
import {
    DEFAULT_ELEMENTS, ELEMENT_TABLE, NONE as ELEMENTS_NONE, drawElementHead, formatElementSpec,
    isElementList, namedParams, normalizeElementSpec, resolveElementSpec,
    resolveRequireDirective,
} from '../procgenCore/elementSpec.js';
/**
 * ⛓ THE REQUIREMENTS DIFFERENTIAL — arc 3, slice 4d. ⛔ ONE implementation,
 * lifted out of `batch-seedling-acceptance.mjs` (whose stdout md5 proved the
 * move); this file is its SECOND caller and the batch is still its first.
 */
import { REQUIRING_GRADES, gradeOf, requirementsFor } from './procgenRequirements.js';
import {
    SITE_MARGIN_STRAIGHT, certificationRouteCells, compositeSeedlingElement,
    compositeSeedlingOnConnector, elementSummaryOf, liftedClaimFor, reservedRect,
    seedlingElementEntities, seedlingElementSiteCandidates, seedlingOnConnectorEntities,
    vestibuleCellsAround,
} from './procgenSeedlingElements.js';
import {
    PHASE_ON_CONNECTOR, PHASE_PRE_CARVE, guardIdsFor,
} from '../procgenCore/elements.js';
/**
 * ⛓⛓ PROCGEN ELEMENTS arc 3, slice 5b (D3) — **THE OFFERED CANDIDATE SET, FROM
 * THE FUNCTION THE ELEMENTS THEMSELVES CALL.** `doorCandidates(room)` is a WALK
 * OF `room.mainPath`, which the probe has already computed and frozen — it
 * floods nothing, so asking it at the ledger site is free. ⛔ Spelling the rule
 * a second time here (*"the interior cells of the main path"*) would be trap
 * 357's shape one function down: the list and the rule would drift.
 *
 * ⚠ §16.5 priced this item as *"one `isCut` FLOOD PER MAIN-PATH CELL"*. That
 * price is `buildKillGate`/`buildBlockPocket`'s, not `doorCandidates`'; the
 * OFFERED set alone costs nothing, and the LEGAL subset is carried out of the
 * construct's own law calls rather than re-derived. Corrected here, in the file.
 */
import { doorCandidates } from '../procgenCore/elements/roomDoor.js';
import {
    DEFAULT_SKELETON, DEFAULT_SKELETON_KIND, assertKind, carveSkeleton, formatSkeleton,
    kindsOffered, normalizeSkeleton, paramSchemaFor, parseSkeleton,
} from '../procgenCore/skeletonKinds.js';
import {
    TILE_FLOOR, TILE_WALL, getTile, setTile,
} from '../shared/procgen/mazeAlgorithms/gridTiles.js';
/**
 * ⚠ REGISTER-ON-IMPORT (⚖ kickoff §5), and the BINDING owns it. Backends
 * register themselves into the shared registry when their files are imported;
 * the maze gets its six through `mazeRoomEngine`, and this is where Seedling
 * gets the three PORTABLE ones. ⛔ They are NOT imported from
 * `skeletonKinds.js` itself, even though that is the file that dispatches to
 * them: doing so made them register before `mazeRoom/mazeAlgorithms/index.js`'s
 * own three and moved `listBackends()`' order, which
 * `dump-maze-byteidentity.mjs` prints as a canary and `mazeAlgorithms/index.js`
 * says must not change. Measured, then moved here.
 *
 * ⛔ The maze-only three (`random_walls`, `corridor_only`, `empty`) are NOT
 * imported: they need the maze simulator, this binding refuses those kinds BY
 * NAME (`assertKind`), and importing them would drag the maze engine onto the
 * Seedling page's graph for kinds it will never run.
 */
import '../shared/procgen/mazeAlgorithms/kruskals.js';
import '../shared/procgen/mazeAlgorithms/recursiveBacktracker.js';
import '../shared/procgen/mazeAlgorithms/recursiveDivision.js';
import { rngFor } from './procgenRng.js';

export class ProcgenSeedlingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProcgenSeedlingError';
    }
}

const fail = (message) => { throw new ProcgenSeedlingError(message); };

/**
 * ⛓⛓⛓ **HOW FAR THE GOAL IS DRAWN FROM THE START, IN MANHATTAN CELLS** —
 * arc 3, slice 4c (⚖ user, 2026-08-17). See `seedlingModel`'s goal-draw block
 * for the proof that 3 is the smallest value that carries the claim, and
 * `procgenGoalDraw.test.js` for the rows that drive it. ⛔ It is EXPORTED
 * because the census and the browser rows read it rather than retyping a 3.
 */
export const GOAL_MIN_FROM_START = 3;

/**
 * ⛓⛓⛓ **SEEDLING'S OWN DEFAULT FOR `chambers`** — arc 3, slice 4b (D6;
 * ⚖ user, 2026-08-17).
 *
 * ⛔ **IT IS NOT IN `CHAMBERS_PARAM`.** That schema row is SHARED BY REFERENCE
 * across six kinds AND ACROSS BOTH BINDINGS (`procgenCore/skeletonKinds.js`
 * says so in its own docblock), so moving its `default` would move the MAZE —
 * whose byte-identity md5 is a gate for this very slice. The default a
 * SUBSTRATE wants is a fact about that substrate's rooms, and it lives here.
 *
 * ── ⛓⛓ WHY A NON-ZERO DEFAULT AT ALL, AND IT IS A MEASUREMENT ─────────
 *
 * 4c §13.11.1's reader-facing sentence: *on the bare tree kinds the default
 * level is the skeleton plus one certified ELEMENT plus NO pass-2 decoration —
 * pass 2 has no AREA to decorate.* That is ⚖ ruling 24 (**area is pass 1's**)
 * meeting slice 1's site vocabulary: `wall-segment`/`water-pool`/`pit-patch`
 * are all `site: 'chamber'`, and a 10x10 room carved by a bare tree kind has NO
 * all-ground 2x2 square on 10 of 12 seeds (§8.3). ⚖ The user ruled the remedy
 * is a non-zero default here — *a bare corridor plus one element is the OTHER
 * extreme of ruling 12 ("not all levels are dense mazes"), not its intent* —
 * and §8.4b measured 17-24 kept where pass 1 stamps a chamber against 1-2 bare.
 *
 * ── ⛔ THE FIVE KINDS, AND WHY NOT THE OTHER TWO ──────────────────────
 *
 * `winding`, `branchy`, `bushy`, `loopy` and `open` are the CARVED TREE kinds:
 * they leave 1-wide corridor almost everywhere. `empty` declares no parameters
 * at all (it carves nothing — the open bordered room IS one big chamber), and
 * `rooms` declares `chambers` but does not want it: `recursive_division`
 * already makes rooms and the census measures 1.7-2.0 real chambers there
 * against 0.1-0.2 on a bare tree kind. A default that stamped into `rooms`
 * would be adding area to the one kind that has some.
 */
/**
 * ── ⛓⛓⛓ **k = 1, AND THE PICK RULE WAS STATED BEFORE THE RUN** ────────
 *
 * *k = 1 if its summed kept over the five kinds recovers >= 3/4 of k = 2's;
 * else k = 2.* Yield table, five carved tree kinds x seeds 1..8, count 3 /
 * tries 4 / k 3 / anchortries 1 / cellbudget 120, DEFAULT elements, both
 * biomes, three arms:
 *
 *   arm         pre-sword KEPT/120   post-sword KEPT/120   saturated/40   threw
 *   chambers=0            4                    4            40 / 38         0
 *   chambers=1          102                  105            11 /  8         0
 *   chambers=2          113                  103             4 /  3         1
 *
 * 102/113 = **90%** pre-sword and 105/103 = **102%** post-sword, both far past
 * the 3/4 bar. ⇒ **k = 1**, the smaller that recovers most, in the user's own
 * words. ⛓ AND TWO NUMBERS BEYOND THE RULE POINT THE SAME WAY: `chambers=2`
 * THREW once post-sword where `chambers=1` threw zero in both biomes, and the
 * control arm reproduces 4c §13.11.1's reader-facing sentence exactly — **4
 * kept of 120, 40 of 40 cells SATURATED** on the bare kinds.
 */
export const SEEDLING_CHAMBERS_KINDS = Object.freeze([
    'winding', 'branchy', 'bushy', 'loopy', 'open',
]);
export const SEEDLING_PARAM_DEFAULTS = Object.freeze({ chambers: 1 });

/**
 * ⛔⛔ **THE KEYS A SPEC STRING ACTUALLY NAMED** — and this is TWO STREAMS, not
 * one (`feedback_two_streams_for_drawn_or_typed`, from the other side).
 *
 * `normalizeSkeleton` spells a value AT ITS DEFAULT BY ABSENCE, so
 * `winding;chambers=0` and a bare `winding` normalize to the SAME object — and
 * a default applied after normalisation cannot tell "nobody said" from "the
 * caller typed the shared default". ⇒ the default is resolved BEFORE
 * normalisation, and what it needs is the set of keys the caller named.
 *
 * ⛔ THE SPLIT IS NOT A SECOND GRAMMAR. `parseSkeleton` has already VALIDATED
 * the string (every clause is `key=value`, every key is declared, every value is
 * in its domain, no key twice) and thrown by name if it was not; this reads the
 * key names out of a string that is known to be well formed. A second parser
 * here would be a second answer to what a clause means.
 */
const namedSkeletonKeys = (value) => new Set(String(value ?? '').split(';').slice(1)
    .map((c) => c.slice(0, c.indexOf('=')).trim())
    .filter(Boolean));

/**
 * ⛓⛓⛓ **THE ONE PLACE A SEEDLING SKELETON SPEC IS RESOLVED** — every Seedling
 * caller passes through it: `seedlingModel`, the CLI, the sweep, the kind-pairs
 * dump, the censuses and `watchGenerate`'s reader. ⛔ NOT the maze, which has
 * its own defaults and whose md5 is this slice's gate.
 *
 * Takes a STRING (`'winding;chambers=2'`) or an OBJECT (`{kind, params}`) as the
 * CALLER TYPED IT, and returns `{kind, params}` with `chambers` ALWAYS EXPLICIT
 * on the five kinds above — which is what makes it IDEMPOTENT: feeding its own
 * output back names `chambers`, so the default is not re-applied over a
 * deliberate 0.
 *
 * ⚠ **ITS OUTPUT IS AN INPUT, AND `model.skeletonSpec` IS NOT.** The model
 * keeps the CANONICAL spelling (`normalizeSkeleton`'s, default-by-absence) for
 * the payload and the identity line, because that is the ONE spelling a link
 * and a payload compare by. Feeding THAT back in would lose a typed 0 exactly
 * as feeding a bare `parseSkeleton` result would.
 *
 * ⛓ An explicit `chambers: 0` is BYTE-INERT by `carveSkeleton`'s own law (`if
 * (v === p.default) continue` — the post-processor is not appended), so the
 * always-explicit shape costs no draw and moves no tile.
 */
export function seedlingSkeletonSpec(input) {
    const spec = typeof input === 'string'
        ? parseSkeleton(input, { simulator: false, substrate: 'the Seedling binding' })
        : normalizeSkeleton(input ?? DEFAULT_SKELETON);
    const named = typeof input === 'string'
        ? namedSkeletonKeys(input) : new Set(Object.keys(input?.params ?? {}));
    if (!SEEDLING_CHAMBERS_KINDS.includes(spec.kind)) return spec;
    const params = { ...(spec.params ?? {}) };
    if (!named.has('chambers')) params.chambers = SEEDLING_PARAM_DEFAULTS.chambers;
    else if (params.chambers === undefined) {
        /** ⛓ the caller TYPED the shared default and `normalizeSkeleton` spelled
         *  it by absence; putting it back is what keeps this idempotent. */
        params.chambers = paramSchemaFor(spec.kind)
            .find((p) => p.key === 'chambers').default;
    }
    return Object.freeze({ kind: spec.kind, params: Object.freeze(params) });
}

/**
 * ⛓⛓⛓ **THE KEYS SEEDLING SPELLS EXPLICITLY IN A LINK** — PROCGEN ELEMENTS arc
 * 3, slice 5a (D2). ⚖ Ruled by the orchestrating session on 2026-08-18: a typed
 * `;chambers=0` must be SPELLABLE, and the way it becomes spellable is that the
 * page's writer names the key even at the CODEC's default.
 *
 * ⛔ **IT IS DERIVED FROM THE RESOLVER, NEVER A SECOND COPY OF THE RULE.**
 * `seedlingSkeletonSpec({kind})` — the resolver, asked with no parameters — is
 * exactly *"which keys does this binding force"*, so a sixth kind joining
 * `SEEDLING_CHAMBERS_KINDS` (or a second forced key) reaches the URL writer
 * without anybody editing this function. A hand-written `['chambers']` would be
 * trap 367's shape: a constant that agrees with the rule until the day it does
 * not.
 *
 * ⚠ `rooms` DECLARES `chambers` and is NOT in `SEEDLING_CHAMBERS_KINDS`, so it
 * gets an EMPTY list and its URL spelling is unmoved — which is the difference
 * between *the codec declares this knob* and *this binding overrides its
 * default*.
 */
export function seedlingExplicitSkeletonParams(kind) {
    if (!kind || !SEEDLING_CHAMBERS_KINDS.includes(kind)) return Object.freeze([]);
    return Object.freeze(Object.keys(seedlingSkeletonSpec({ kind }).params ?? {}));
}

/**
 * ⛓⛓⛓ **HOW FAR AN AREA LOCK MUST STAY FROM THE GOAL, IN GRAPH STEPS** —
 * arc 3, slice 4b. ⛔ It is §10.6(c)'s rule restated for a set of cells rather
 * than for one: *a lock 4-ADJACENT to the goal breaks the COLLECT ceremony's
 * approach sweep* (trap 348, measured — "approaching torchpickup@128,128, the
 * sweep was blocked by lock at (128,112)"), so a lock cell must be at graph
 * distance >= 2 from the goal. A lock at distance exactly 2 is FINE, which is
 * what makes the vestibule below the right size.
 */
export const LOCK_MIN_FROM_GOAL = 2;

/**
 * ⛓⛓⛓ **THE GOAL'S VESTIBULE RADIUS** — arc 3, slice 4b, and it is
 * `LOCK_MIN_FROM_GOAL` rather than a second number, because the vestibule
 * exists for exactly one reason: to put the goal area's BOUNDARY cells one step
 * beyond the forbidden ring. A ball of radius `r` has its boundary at distance
 * `r`, so `r = LOCK_MIN_FROM_GOAL` is the smallest that carries the claim.
 */
export const GOAL_VESTIBULE_RADIUS = LOCK_MIN_FROM_GOAL;

/**
 * ⛓ **A FLOOD KEY BACK INTO A CELL** — arc 3, slice 5b. `gridFlood` answers in
 * `"x,y"` strings and a PAINTABLE takes `{x,y}`, so the translation is stated
 * once here rather than inline at each of the six sites that carry a flood.
 */
const cellOfKey = (k) => {
    const [x, y] = String(k).split(',').map(Number);
    return Object.freeze({ x, y });
};

/** ⛓ The id the goal's grown area carries, so a reader can tell it from a
 *  discovered chamber (`A{n}`) and from an element's (`E{n}`). */
export const GOAL_AREA_ID = 'GOAL';

/**
 * ⛓⛓⛓ **THE DOOR LAW — A DOOR IS A CUT** (PROCGEN ELEMENTS arc 3, slice 2;
 * ⚖ design ruling 17, taken whole). ONE flood-based law, every kind, every door
 * family — it REPLACES `doorClear` and re-expresses `INTERIOR_SPAN`'s *"must
 * cross the whole interior to be a door"* as *"must be a CUT"*.
 *
 * A row that declares `door` names its DOOR CELLS (`doorCells` — the gap
 * cell(s) that hold the clearer, and which write no wall) and its CLEARER
 * CELLS (`clearer` — the spinner; the weigh lane's block/button/stance/slide;
 * EMPTY for `wall-gap-block`, whose block stands IN the door cell).
 *
 *  1. **CUT** — with this candidate's terrain painted AND the door cells
 *     treated as WALL, the GOAL is unreachable from the START; with them
 *     walkable, it is reachable.
 *  2. **START-SIDE** — with the door cells walled, every clearer cell is
 *     reachable from the START.
 *
 * ── ⛓⛓⛓ **TWO CALLERS, ONE LAW** (arc 3, slice 4a) ────────────────────
 *
 * It moved out of `seedlingModel`'s closure when the `on-connector` element
 * phase arrived: a room-aware DOOR ELEMENT is adjudicated by the law a door
 * TEMPLATE is adjudicated by, or the two would drift and one door family would
 * place where the other refused. The callers differ in exactly two ways, both
 * arguments rather than branches: a template's cells are OFFSETS resolved
 * against an anchor and an element's are ABSOLUTE, and —
 *
 * ⛔ **`askOpenHalf` — WHO HAS ALREADY ASKED CLAUSE 1's OTHER HALF.** *With the
 * door cells WALKABLE the goal is reachable* is `sealRefusal`'s own answer, and
 * for a TEMPLATE `sealRefusal` is the rule asked immediately before, so a
 * candidate that reaches this line has passed it — one flood, not two. ⚖ The
 * one-of-everything law read the right way round: the second flood would not be
 * a second SPELLING, it would be a second ASKING. An ELEMENT has no `sealRefusal`
 * ahead of it (it is not an anchor the loop offered — it is constructed), so it
 * passes `askOpenHalf: true` and the law asks. ⇒ the parameter names WHICH
 * CALLER HAS ALREADY PAID, and is not a second policy.
 *
 * ── ⛓⛓ WHY CLAUSE 2 EXISTS, and why `doorClear` could not see it ──────
 *
 * Clause 2 is `doorClear`'s mechanism GENERALISED. On the open room the clearer
 * sits at across `-1` — north or west of a full-span wall, i.e. the start's
 * side by the room's fixed NW corner — so "the goal is strictly beyond" IMPLIED
 * it and the old rule needed one comparison. On a CORRIDOR it implies nothing: a
 * span-1 door's nub can be carved on the GOAL side, where the spinner is a body
 * nobody can reach until the lock it guards opens. That room is not merely
 * low-yield, it is unsolvable, and the flood is what says so at anchor time.
 *
 * ⛔ AND THE OFF-DOMAIN **THROW** WENT WITH `doorClear`. That assertion ("the
 * start must be north-west of every anchor") existed because the old rule read
 * the COMPASS; this one reads the flood, so a start anywhere in the room is a
 * room this law simply answers. ⚠ Trap 255's ordering claim survives it
 * unchanged for a different reason: the footprint walk still runs first, because
 * a flood handed writes outside the rectangle would read `terrainAt` past the
 * room.
 *
 * @param {Function} o.walkableFor `(walledKeys|null) => (x,y) => boolean` — the
 *   caller's own painted-terrain predicate with a key set forced solid. ⛔ ONE
 *   builder per caller, so "what blocks" is still stated once.
 *
 * @param {object|null} [o.sets] ⛓⛓⛓ PROCGEN ELEMENTS arc 3, slice 5b (D1) — **AN
 *   OPTIONAL OUT-PARAMETER, AND THE RETURN VALUE IS UNTOUCHED.** When present it
 *   is filled with `{walled, startSide, goalSide}` — the door cell(s), and the
 *   two components the cut makes — so a phase can PAINT the law's own answer
 *   without asking a second question. ⛔ It is a sink rather than a second
 *   return value because every existing caller reads the TEXT and must keep
 *   reading exactly that; a caller that passes nothing runs the identical code.
 *
 *   ⚠ **THE PRICE, NAMED: the start-side flood is walked TWICE on the sink
 *   path.** The not-a-cut test below is `connected`, an EARLY-EXIT BFS, and
 *   swapping it for a full `reachableFrom` would make every candidate the
 *   elements try pay for a set nobody asked for. One repeated flood, at the one
 *   call site that passes a sink, is the cheaper of the two.
 */
export function doorLawRefusal({
    width, height, walkableFor, start, goal, doorKeys, clearerKeys, name, askOpenHalf = false,
    sets = null,
}) {
    const doorList = [...doorKeys].map((k) => `(${k})`).join(' ');
    if (askOpenHalf && !connected(width, height, walkableFor(null), start, goal)) {
        return `${name} declares a door at ${doorList}, and its own TERRAIN SEALS the room: `
            + `with the door cell(s) WALKABLE the GOAL (${goal.x},${goal.y}) is already `
            + `unreachable from the START (${start.x},${start.y}). ⛔ A door whose open state `
            + 'is a sealed room is not a door — clause 1 has two halves and this is the one a '
            + 'template gets for free from `sealRefusal`.';
    }
    const walled = walkableFor(doorKeys);
    /**
     * ⛓ THE SINK PATH SPENDS **TWO** FLOODS, NOT FOUR. The start-side set it
     * fills is the same one clause 2 asks below, and `connected(start, goal)` is
     * `goal ∈ reachableFrom(start)` — so when a sink is passed both are read off
     * the one walk. ⛔ When it is NOT passed nothing here runs and the law keeps
     * its early-exit `connected`, which is what every candidate the elements try
     * pays for.
     */
    const startReach = sets ? reachableFrom(width, height, walled, start) : null;
    if (sets) {
        sets.walled = Object.freeze([...doorKeys].map(cellOfKey));
        sets.startSide = Object.freeze([...startReach].map(cellOfKey));
        sets.goalSide = Object.freeze(
            [...reachableFrom(width, height, walled, goal)].map(cellOfKey));
    }
    if (startReach ? startReach.has(`${goal.x},${goal.y}`)
        : connected(width, height, walled, start, goal)) {
        return `${name} declares a door, and it is NOT A CUT: with its door cell(s) `
            + `${doorList} walled, the GOAL (${goal.x},${goal.y}) is STILL `
            + `reachable from the START (${start.x},${start.y}) — so the wall is `
            + 'DECORATION rather than a door. ⛔ Nothing is gated by the clearer: the '
            + 'walk goes round, and for a KILL GATE that is a RUN ABORT (the walk '
            + 'collects the torch with the spinner still alive). ⚖ Ruling 17\'s own '
            + 'words — a non-cut is decoration. The law reads the FLOOD, not the compass.';
    }
    const reach = startReach ?? reachableFrom(width, height, walled, start);
    for (const key of clearerKeys) {
        if (!reach.has(key)) {
            return `${name} declares a door at ${doorList}, and its CLEARER cell (${key}) `
                + `is on the GOAL side of it — unreachable from the START `
                + `(${start.x},${start.y}) once the door cell(s) are walled. The `
                + 'thing that OPENS the door would be a body nobody can reach until the '
                + 'door it guards is already open, so the room has no answer. ⛓ On the '
                + 'open room this could not happen (the lane sits one cell back on the '
                + 'start\'s side of a full-span wall); on a corridor it is the ordinary '
                + 'case, which is why the law asks rather than assumes.';
        }
    }
    return null;
}

/**
 * ⛓⛓⛓ **THE CARVE RULE — ONE RULE, TWO CLAUSES** (arc 3, slice 2, D3), at
 * module scope for the same reason the door law is: arc-3 slice 4a's
 * `on-connector` elements CARVE (the kill gate's pocket, the block pocket's
 * bend) and a second spelling of "is this carve legal" is the defect this arc
 * keeps paying for.
 *
 * The cells a placement writes `ground` ONTO SKELETON WALL are its CARVE. (A
 * `ground` write onto skeleton ground is a no-op: the cell was already floor,
 * so the placement is putting itself in a side corridor the carve made and the
 * ORACLE decides whether that room works.) A carve is legal iff:
 *
 *  (a) **DEAD END** — the carved cells form ONE 4-connected blob, and the blob
 *      has EXACTLY ONE 4-neighbour outside itself that is walkable once the
 *      placement's terrain is painted. One mouth, one edge: a leaf hanging off
 *      the room.
 *  (b) **NO SHORTCUT** — `shortestPath(start, goal)` is no shorter after the
 *      placement than before.
 *
 * ⛓ (b) IS IMPLIED BY (a) AND IS ASSERTED ANYWAY, because the two are different
 * claims and the design names both: a one-mouth blob is off every path by
 * construction (a route entering it must leave by the cell it came in), so (b)
 * can only fire if (a) ever stopped holding. ⚠ And (a) is the clause that
 * carries the weight: a tunnel joining two corridors does not shorten
 * start→goal at all when it joins a side corridor, so a build with (a) dropped
 * passes (b) and carves shortcuts nobody asked for. That asymmetry is the
 * mutant table's row (b).
 *
 * ⚠ WHEN THE PLACEMENT SEALS THE ROOM the "after" path is `null`, and this rule
 * says NOTHING: sealing is `sealRefusal`'s sentence and it is the next rule
 * asked. A rule that answered here would give the reader the wrong fact about
 * the wrong cell.
 */
export function carveLawRefusal({
    width, height, carved, walkableAfter, walkableBefore, start, goal, name, sets = null,
}) {
    if (carved.length === 0) return null;
    /** ⛓ SLICE 5b (D1) — the sink, filled with what THIS rule computes and
     *  nothing else: a carve with no cells never reaches here, and a carve that
     *  fails clause (a) never reaches clause (b)'s two paths. */
    if (sets) sets.blob = Object.freeze(carved.map((c) => Object.freeze({ x: c.x, y: c.y })));
    const inBlob = new Set(carved.map((c) => `${c.x},${c.y}`));
    // (a1) ONE blob — a flood over the carved set alone.
    const seen = new Set([`${carved[0].x},${carved[0].y}`]);
    const queue = [carved[0]];
    for (let head = 0; head < queue.length; head += 1) {
        const { x, y } = queue[head];
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const k = `${x + dx},${y + dy}`;
            if (inBlob.has(k) && !seen.has(k)) {
                seen.add(k);
                queue.push({ x: x + dx, y: y + dy });
            }
        }
    }
    const list = carved.map((c) => `(${c.x},${c.y})`).join(' ');
    if (seen.size !== carved.length) {
        return `${name}: its CARVE writes ${carved.length} cell(s) of skeleton wall as `
            + `ground (${list}) in `
            + `${carved.length - seen.size + 1} separate blobs. A pocket is ONE `
            + '4-connected blob with ONE mouth; two disconnected pockets are two '
            + 'carves, and only one of them can be adjudicated by one rule.';
    }
    // (a2) EXACTLY ONE MOUTH.
    const mouths = new Set();
    for (const c of carved) {
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const nx = c.x + dx;
            const ny = c.y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const k = `${nx},${ny}`;
            if (inBlob.has(k)) continue;
            if (walkableAfter(nx, ny)) mouths.add(k);
        }
    }
    if (sets) sets.mouths = Object.freeze([...mouths].map(cellOfKey));
    if (mouths.size !== 1) {
        return `${name}: its CARVE (${list}) has `
            + `${mouths.size} MOUTH(S)${mouths.size ? ` — ${[...mouths]
                .map((k) => `(${k})`).join(' ')}` : ''}, and a template may carve only a `
            + 'DEAD END: exactly ONE 4-neighbour of the whole blob is walkable ground '
            + `once this placement is painted. ${mouths.size === 0
                ? 'A pocket with no mouth is floor nothing can walk to.'
                : 'A pocket with two mouths is a TUNNEL — it joins two parts of the room '
                    + 'that the skeleton kept apart, which is a change to the room\'s '
                    + 'connectivity rather than a place to stand.'}`;
    }
    // (b) NO SHORTCUT.
    const before = shortestPath(width, height, walkableBefore, start, goal);
    const after = shortestPath(width, height, walkableAfter, start, goal);
    if (sets) {
        sets.pathBefore = Object.freeze((before ?? []).map((c) => Object.freeze({ x: c.x, y: c.y })));
        sets.pathAfter = Object.freeze((after ?? []).map((c) => Object.freeze({ x: c.x, y: c.y })));
    }
    if (before && after && after.length < before.length) {
        return `${name}: its CARVE would SHORTEN the start→goal path from `
            + `${before.length - 1} steps to ${after.length - 1}. A pocket is somewhere `
            + 'to stand, never a route: a carve that shortens the way to the goal has '
            + 'rebuilt the skeleton pass 1 committed to.';
    }
    return null;
}

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

/**
 * ⛓ THE KINDS THIS BINDING OFFERS — every PORTABLE one. `classic` and
 * `corridor` need the maze simulator and are refused by name (`assertKind`).
 * Derived rather than listed so a kind added to the table arrives here without
 * a second edit.
 */
export const SEEDLING_SKELETON_KINDS = Object.freeze(kindsOffered({ simulator: false }));

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
 * @param {object} [o.skeleton]  `{kind}` — ⛓ CONSTRUCTIVE-MODE slice 5. The
 *   default is the OPEN bordered room this binding has always built; any other
 *   kind CARVES the interior with the grid backend the kind names. ⛔ Seedling
 *   offers the PORTABLE kinds only — `classic` and `corridor` need the maze
 *   simulator and are refused by name. See `procgenCore/skeletonKinds.js`.
 * @param {object} [o.elements]  `{name[, params]}` — ⛓ PROCGEN ELEMENTS arc 3,
 *   slice 3, through the ONE codec (`procgenCore/elementSpec.js`). ⛔ The
 *   default is `'none'` and at `none` **the element stream is not consulted at
 *   all**: no site is drawn, nothing is constructed, no draw is spent, and every
 *   Seedling md5 is byte-identical by a code path that never executes (⚖ arc-2
 *   ruling 5, applied one substrate over). ⚠ `turns > 0` REFUSES BY NAME — that
 *   is the CHAIN (arc 4, ask-first; ⚖ arc-3 ruling 1).
 * @param {boolean} [o.dropElement]  ⛓ THE CERTIFICATION'S OWN ARM. Spends every
 *   element draw exactly as usual and then does NOT commit the composite, so a
 *   gadget the solver cannot certify leaves a room that is the plain carve plus
 *   the draws the element spent (arc-2 §10.3: *a refused element moves the
 *   stream by exactly the draws it spent*). ⛔ Used by `generateSeedlingLevel`
 *   and by nothing else; it is not a caller-facing knob.
 */
export function seedlingModel({
    seed, defaults = SEEDLING_DEFAULTS, skeleton: skeletonSpec = DEFAULT_SKELETON,
    elements: elementSpec = DEFAULT_ELEMENTS, areas: areaSpec = DEFAULT_AREAS,
    dropElement = false, ledger: recordLedger = true,
} = {}) {
    const d = { ...SEEDLING_DEFAULTS, ...defaults };
    /**
     * ⛓⛓⛓ **THE LEDGER** (slice 5a, D3) — one row per PHASE, appended BY the
     * phase as it runs. ⛔ Never assembled afterwards from a list of names
     * (trap 357: a "deepest stage" list is a second spelling of the pipeline's
     * order, and the two drift). A phase that is never REACHED writes no row,
     * which is the honest report and is what makes the omission visible.
     *
     * ⛔ `ledger: false` IS THE SPY'S ARM AND THE COST LEVER, not a knob:
     * nothing in the shipped callers passes it, and it exists so a test can
     * prove that a model with recording OFF emits a byte-identical `--json`.
     */
    const ledger = makeLedger({ width: d.width, height: d.height, enabled: recordLedger });
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
    /**
     * ⛓⛓⛓ **THE GOAL IS A PASS-1 DECISION NOW** (⚖ user, 2026-08-17, the
     * generation review §3 row 2 / §4 item 2) — arc 3, slice 4c.
     *
     * ⛔ THE RULE: the goal is drawn from the interior cells at MANHATTAN
     * DISTANCE ≥ `GOAL_MIN_FROM_START` (3) from the start. Still ONE `pick`,
     * still the room stream's FIRST draw, still before the carve — only the
     * CANDIDATE LIST is narrower.
     *
     * ── ⛓⛓ WHY 3, AND IT IS A PROOF RATHER THAN A MARGIN ──────────────
     *
     * Slice 4a measured that **4 of 12 seeds refused every door element on
     * every kind** (§12.5): seeds 8 and 11 put the goal ADJACENT to the start
     * (`no-cut-cell` — the main path is two cells, so there is no interior cell
     * to stand a door on at all) and seeds 5 and 6 put it two away
     * (`goal-too-close` — the one interior cell is 1 from the goal, and a lock
     * on the goal's doorstep breaks the COLLECT ceremony's approach sweep,
     * trap 348). The goal draw knew nothing of either rule.
     *
     * At Manhattan `m` the shortest path is at least `m + 1` cells, so `m ≥ 3`
     * gives a path of at least four: `start, p1, p2, goal`. `p1`'s graph
     * distance to the goal is then ≥ 2, and on a grid Manhattan and graph
     * distance share a PARITY and Manhattan ≤ graph distance — so
     * `manhattan(p1, goal)` is exactly 2 when the distance is 2, and more when
     * it is more. ⇒ **at m ≥ 3 at least one door candidate survives
     * `goal-too-close` on every kind and every carve.** At m = 2 the single
     * interior cell is 1 from the goal and none does; at m = 1 there is no
     * candidate. The constant is the smallest that carries the claim, and the
     * claim is the whole of it: *a door element is never refused for the goal's
     * position alone.*
     *
     * ⛔ **MANHATTAN, NOT BFS, AND THAT IS FORCED.** The goal is the room
     * stream's FIRST draw and the carve has not run — there is no room to flood
     * through yet. ⚖ The brief's alternative (draw the goal AFTER the connector,
     * as a site) would move the carve's own position in the stream and the
     * design's declared draw order; it is not needed, because Manhattan
     * recovers all four seeds (§13.2's census).
     *
     * ⚠ **IT MOVES EVERY COMMITTED PAIR**, and that is the point of bundling it
     * with the retirement: one re-record, not two (⚖ review §4 item 2).
     */
    const goalCandidates = interiorCells(blank)
        .filter((c) => !(c.tx === d.start.tx && c.ty === d.start.ty))
        .filter((c) => Math.abs(c.tx - d.start.tx) + Math.abs(c.ty - d.start.ty)
            >= GOAL_MIN_FROM_START);
    if (goalCandidates.length === 0) {
        fail(`procgenSeedling: no interior cell of this ${d.width}x${d.height} room is `
            + `${GOAL_MIN_FROM_START} or more cells (Manhattan) from the START `
            + `(${d.start.tx},${d.start.ty}), so there is nowhere to put a goal that a door `
            + 'element could ever stand in front of. ⛔ Refused rather than falling back to '
            + 'the whole interior: a fallback would put the arc back where slice 4a found it '
            + 'and would do it silently, on exactly the rooms where it matters most.');
    }
    const goalCell = roomRng.pick(goalCandidates);
    const goalOel = oelAtTile(goalCell.tx, goalCell.ty);
    const reserved = new Set([
        `${d.start.tx},${d.start.ty}`,
        `${goalCell.tx},${goalCell.ty}`,
    ]);
    /** ⛓ THE GOAL ENTITY, built once — the row below records it as the level's
     *  first entity and `skeleton()` writes the identical object. */
    const goalEntity = { type: d.goalClass, ...goalOel, attrs: { tag: d.goalTag } };
    ledger.phase('goal', {
        sentence: `the GOAL is (${goalCell.tx},${goalCell.ty}), ONE \`pick\` over the `
            + `${goalCandidates.length} interior cell(s) at Manhattan >= `
            + `${GOAL_MIN_FROM_START} from the START (${d.start.tx},${d.start.ty}) — the room `
            + 'stream\'s FIRST draw, and it happens BEFORE the carve',
        draws: roomRng.draws,
        record: blank,
        entities: [goalEntity],
        data: { candidates: goalCandidates.length, minFromStart: GOAL_MIN_FROM_START,
            pick: { x: goalCell.tx, y: goalCell.ty },
            start: { x: d.start.tx, y: d.start.ty } },
        facts: [paintable({
            id: 'goal-candidates',
            label: `${goalCandidates.length} goal candidate(s) — the interior minus the start, `
                + `minus everything within ${GOAL_MIN_FROM_START} of it`,
            kind: 'cells',
            cells: goalCandidates,
            pick: goalCell,
        })],
    });

    /**
     * ── ⛓⛓⛓ SLICE 5: THE CARVE. ONE PASS, AT MODEL CONSTRUCTION ────────
     *
     * ⛔ IT HAPPENS HERE AND NOT INSIDE `skeleton()` BECAUSE IT SPENDS DRAWS,
     * and `skeleton()` is called more than once (the loop calls it, and
     * `watchGenerate.generateStep(0)` calls it for the page). A carve per call
     * would hand out a different room each time from one seed.
     *
     * ⛓ THE DRAW ORDER **IS** THE IDENTITY (⚖ kickoff §3.4): `goalCell` is
     * `roomRng`'s FIRST draw, above; the backend's draws come next; the
     * post-processors' last. So the goal of seed s under kind K is the goal of
     * seed s under `empty`, and the constructive kinds do not expire the
     * empty-room seed→level pairs (`procgenSeedling.test.js` drives it).
     *
     * ⛔ AT THE DEFAULT KIND NOTHING BELOW RUNS. `empty` is not "the `empty`
     * backend" — it is the open bordered room this file has always built — so
     * the byte-identity gate is a code path that never executes rather than a
     * comparison that happens to pass.
     *
     * ── THE GRID, AND THE THREE FACTS ABOUT IT WORTH STATING ──────────
     *
     * The carvers speak the `gridTiles.js` contract: `{width, height, tiles:
     * Int8Array, entrance:{x,y}, exits: Map of {x,y}}`. Seedling anchors are
     * `{tx,ty}` and grid points are `{x,y}` — converted at this boundary and
     * nowhere else (§9.2's rule).
     *
     *  1. ⚠ **THE RING IS HANDED IN ALREADY WALLED, AND THAT IS LOAD-BEARING.**
     *     The two tree backends would wall it themselves (`fillBackgroundWalls`
     *     walls every non-fixed tile), but `recursive_division` starts from the
     *     ALL-FLOOR grid `createWorld` gives it and only ADDS walls — so on a
     *     bare grid it would return a room whose border is floor, and
     *     `emptyLevel`'s own docblock says why that is not a room (*"nothing
     *     stops a player from walking off a floor that ends"*). Pre-walling
     *     costs nothing for the tree kinds (they overwrite it) and is invisible
     *     to `braid` (a ring wall has no floor beyond it) and to
     *     `pruneDeadEnds` (which only fills). ⛓ And it is CHECKED below, not
     *     assumed.
     *  2. ⚠ **THE LATTICE IS 4x4 CELLS AND THE ROOM IS 10x10**, so the
     *     tree backends use columns/rows 1,3,5,7 and leave row 8 and column 8
     *     as a strip no cell occupies — 7x7 effective. A goal drawn into that
     *     strip is not stranded: `connectFixedTiles` L-carves every off-lattice
     *     fixed tile to its nearest cell. The start (1,1) is exactly ON a cell,
     *     so it is part of the spanning tree by construction.
     *  3. ⛔ **`repairConnectivity` IS NOT CALLED FROM HERE** for any kind: the
     *     tree backends are connected by construction, and `recursive_division`
     *     calls it inside its own `run`. The honest net for a skeleton that
     *     does not solve is the LOOP's — `generateLevel` refuses to start and
     *     says so with the oracle's own text.
     */
    const skeletonKind = assertKind(skeletonSpec?.kind ?? DEFAULT_SKELETON_KIND,
        { simulator: false, substrate: 'the Seedling binding' });
    /**
     * ⛓⛓ SLICE 7 — THE KIND'S DECLARED PARAMETERS, normalized ONCE here. A key
     * this kind does not declare, or a value outside its domain, refuses BY
     * NAME (`resolveSkeletonParams` inside `normalizeSkeleton`) — before any
     * grid exists, because a link that names a room nobody can build should not
     * reach the carver at all.
     */
    /**
     * ⛓⛓⛓ **SEEDLING'S OWN `chambers` DEFAULT IS APPLIED HERE, AND HERE IS THE
     * ONE PLACE** (arc 3, slice 4b, D6) — `seedlingSkeletonSpec` is idempotent,
     * so a caller that already resolved (the CLI, the sweep, the dump, the
     * page's reader) is unmoved and a caller that did not gets the default.
     * ⛔ `skeletonEffective` carries `chambers` EXPLICITLY (an explicit 0 is
     * byte-inert by `carveSkeleton`'s own law) and is what the CARVE receives;
     * `skeletonSpecNorm` is the CANONICAL spelling — default by absence — and is
     * what the payload, the identity line and `agreementWithPayload` compare by.
     */
    const skeletonEffective = seedlingSkeletonSpec({
        kind: skeletonKind, params: skeletonSpec?.params ?? {},
    });
    const skeletonSpecNorm = normalizeSkeleton(skeletonEffective);

    const carveRoom = () => {
        const gw = { width: d.width, height: d.height };
        const grid = {
            width: gw.width,
            height: gw.height,
            tiles: new Int8Array(gw.width * gw.height),
            entrance: { x: d.start.tx, y: d.start.ty },
            exits: new Map([['goal', { exit_id: 'goal', x: goalCell.tx, y: goalCell.ty }]]),
        };
        // (1) the ring, walled before the backend sees the grid.
        for (let y = 0; y < gw.height; y += 1) {
            for (let x = 0; x < gw.width; x += 1) {
                const ring = x === 0 || y === 0 || x === gw.width - 1 || y === gw.height - 1;
                if (ring) setTile(grid, x, y, TILE_WALL);
            }
        }
        /**
         * ⛓⛓ SLICE 7 — `margin: 1`, AND IT IS THE RING'S OWN NUMBER. The
         * Seedling room's border must stay wall (fact 1 above), so a carver
         * that STAMPS — `chambers` is the first — may never write into the
         * outermost cell. ⛔ Passed rather than defaulted: the maze has no ring
         * and passes 0, and a post-processor that guessed would be wrong in one
         * of the two substrates. The border check below is what proves it.
         */
        const carve = carveSkeleton(skeletonKind, grid, roomRng, {
            params: skeletonEffective.params ?? {}, margin: 1,
        });
        const ground = [];
        for (let ty = 0; ty < gw.height; ty += 1) {
            for (let tx = 0; tx < gw.width; tx += 1) {
                if (getTile(grid, tx, ty) !== TILE_FLOOR) continue;
                if (tx === 0 || ty === 0 || tx === gw.width - 1 || ty === gw.height - 1) {
                    fail(`procgenSeedling: the ${JSON.stringify(skeletonKind)} carve left the `
                        + `BORDER cell (${tx},${ty}) as floor. The ring is what makes the room `
                        + 'a room — `loadlevel` drops out-of-rectangle tiles and nothing stops '
                        + 'a player walking off a floor that ends — so a carve that opens it '
                        + 'is refused rather than painted over.');
                }
                ground.push({ tx, ty, terrain: 'ground' });
            }
        }
        /**
         * ⛔ THE CARVE BASE IS `emptyLevel({floor:'wall'})` — a room that is
         * wall everywhere — and only the carved cells are painted back to
         * `ground`. The alternative (paint all 100 cells, floor AND wall)
         * writes the same record and hides the fact that the un-carved room IS
         * the wall; ⚖ ruling 1's *"a map filled with walls"* is a starting
         * state, not a paint order.
         */
        const walled = emptyLevel({
            level: d.level, width: d.width, height: d.height, floor: 'wall',
        });
        return { record: withTerrain(walled, ground), carve };
    };

    /**
     * ⛓⛓⛓ **THE RECORD'S GROUND MASK, CACHED ON THE RECORD OBJECT** — PROCGEN
     * ELEMENTS arc 3, slice 2, and it is a COST fix with no semantic content.
     *
     * ⛔ `procgenLevel.terrainAt` is a LINEAR SCAN of the tiles layer (`tiles
     * .find` plus an `Object.values(TERRAIN).find`) and costs **5.8 µs a call** —
     * slice 1 measured it and paid 72× for asking it per cell (§8.6). This slice
     * adds THREE more floods to `refusalAt` (the cut, the start-side reach, the
     * two shortest paths a carve compares), and `anchorsFor` runs `refusalAt`
     * once per interior cell, so asking `terrainAt` inside each flood's
     * predicate would be ~64 × 100 scans per anchor walk.
     *
     * ⛓ THE CACHE KEY IS THE RECORD OBJECT ITSELF, which is sound because
     * `procgenLevel`'s writers are PURE — `withTerrain`/`withEntities` return a
     * NEW frozen record — so a record that is `===` the cached one has the same
     * tiles by construction. One 100-cell scan per `anchorsFor` call rather
     * than per candidate cell.
     *
     * ⛔ AND IT IS THE **ONE** READING OF "WHICH CELLS ARE GROUND": `sealRefusal`
     * and the door law below both take their predicate from here, so the
     * pre-check and the cut can never disagree about what a wall is.
     */
    let maskRecord = null;
    let maskBits = null;
    const groundMask = (record) => {
        if (maskRecord === record) return maskBits;
        const bits = new Uint8Array(record.width * record.height);
        for (let ty = 0; ty < record.height; ty += 1) {
            for (let tx = 0; tx < record.width; tx += 1) {
                if (terrainAt(record, tx, ty) === 'ground') bits[tx + ty * record.width] = 1;
            }
        }
        maskRecord = record;
        maskBits = bits;
        return bits;
    };

    /** The cells one candidate placement would PAINT, keyed `"x,y"`. */
    const paintedOf = (template, tx, ty) => new Map((template.terrain ?? [])
        .map((w) => [`${tx + w.dx},${ty + w.dy}`, w.terrain]));

    /**
     * The walkability the room would have with this candidate's TERRAIN painted,
     * and with `walled` (a key set) forced solid. ⛔ ONE builder for every flood
     * this file runs, so "what blocks" is stated once (`sealRefusal`'s own
     * docblock: `wall`, `water` and `pit` all block; `ground` is the whole
     * walkable vocabulary).
     */
    const walkableWith = (record, painted, walled = null) => {
        const bits = groundMask(record);
        const w = record.width;
        return (x, y) => {
            const key = `${x},${y}`;
            if (walled && walled.has(key)) return false;
            const p = painted.get(key);
            return p === undefined ? bits[x + y * w] === 1 : p === 'ground';
        };
    };

    /**
     * ── ⛓⛓⛓ PROCGEN ELEMENTS ARC 3, SLICE 3: **THE ELEMENT, CONSTRUCTED
     *    BEFORE THE CARVE** (⚖ design ruling 2; the maze's arc-2 §10.3 order,
     *    one substrate over) ─────────────────────────────────────────────
     *
     * ⛓ **THE DRAW ORDER, DECLARED** (the order IS the identity):
     *   1 the goal cell     — `roomRng`'s FIRST draw, ⛔ UNCHANGED
     *   2 `instantiate`     — the element's own parameters in SCHEMA order. A
     *                         parameter the spec NAMED is an override and spends
     *                         no draw; one it omitted is drawn. ⚠ `turns` is
     *                         ALWAYS an override here (see below), so on
     *                         Seedling the only drawable element parameter is
     *                         `len`.
     *   3 the SITE          — ONE `pick` over the legal snug rectangles
     *   4 `construct(site)` — the gadget's geometry, from the SAME stream
     *   5 the carve         — the backend + its post-processors, ⛔ UNCHANGED
     *                         code at a stream position 2-4 have moved
     *   6 the composite     — spends NO draw (it writes tiles)
     *
     * ⛔ **`len` IS DRAWN BEFORE THE SITE**, because the site must be SNUG and
     * snug means `len + SITE_MARGIN_STRAIGHT`: the size is not known until the
     * parameter is. Same delta the maze recorded against its own §3.3.
     *
     * ⛔ **AT `none` NONE OF 2-4 OR 6 HAPPENS.** Not "runs and returns early" —
     * the branch is not entered, no element is instantiated, `construct` is
     * never called and the rng is not touched, so every Seedling pair, the
     * acceptance batch, the battery and the generated set are unchanged by a
     * code path that does not execute. `procgenSeedlingElements.test.js` drives
     * that with a COUNTING SPY rather than by comparing tiles (arc-1 §9's rule).
     *
     * ⛔ **`turns > 0` IS REFUSED BY NAME** (⚖ arc-3 ruling 1: the straight lane
     * only; a bent push is the CHAIN, arc 4, ask-first). A spec that NAMES a
     * non-zero `turns` refuses; a spec that omits it gets `turns: 0` as an
     * OVERRIDE rather than a draw — so the domain a Seedling sweep certifies is
     * `len` alone, and the element's own `turns` domain stays the maze's.
     *
     * ── ⛓⛓⛓ SLICE 4a — **THE SECOND PHASE, AND WHERE IT SITS IN THE ORDER** ──
     *
     *   0 the LIST draw       — ONE `pick` over a `+` spec's members, and ONLY
     *                           when the spec IS a list. A bare head spends
     *                           nothing, so every existing run is unmoved.
     *   1 the goal cell       ⛔ UNCHANGED, still `roomRng`'s first draw at
     *                           `--elements=none` and at every bare head.
     *   2 `instantiate`       — the head's parameters. ⛓ The two room-aware
     *                           doors declare NONE, so this spends nothing for
     *                           them.
     *   3-4 site + construct  — `pre-carve` ONLY.
     *   5 the CARVE           ⛔ UNCHANGED code.
     *   6 `construct(interior + the room probe)` — `on-connector` ONLY, and its
     *                           whole geometry is a function of the room: the
     *                           single draw it spends is ONE `pick` among door
     *                           cells the room offers equally.
     *   7 the composite       — spends NO draw.
     *
     * ⛔ THE TWO PHASES NEVER BOTH RUN: one spec names one head, and the head
     * names one element with one phase. What moved for `pre-carve` is nothing at
     * all — its branch is the same code at the same stream position, which is
     * why `--elements=guard;len=2`'s determinism gate reproduces S1's.
     */
    const elementSpecNorm = normalizeElementSpec(elementSpec ?? DEFAULT_ELEMENTS);
    /**
     * ⛓ THE LIST DRAW IS FIRST AND IT IS THE ONLY THING BEFORE `instantiate`.
     * `drawElementHead` returns a bare spec UNCHANGED and spends no draw, so
     * this line is inert for every spec written before slice 4a.
     */
    const elementHead = drawElementHead(elementSpecNorm, roomRng);
    const elementValues = resolveElementSpec(elementHead);
    const elementPhase = elementValues.name === ELEMENTS_NONE ? null
        : ELEMENT_TABLE[elementValues.name].element.phase;
    if (elementValues.name !== ELEMENTS_NONE) {
        /** ⛓ THE LIST DRAW — ONE `pick` over a `+` spec's members, and NOTHING
         *  at all for a bare head. The row exists either way so a reader can
         *  see that the head was not drawn. */
        ledger.phase('element-head', {
            sentence: isElementList(elementSpecNorm)
                ? `the spec is the \`+\` LIST \`${formatElementSpec(elementSpecNorm)}\` and `
                    + `the stream DREW \`${formatElementSpec(elementHead)}\` — ONE \`pick\`, `
                    + 'which is a CHOICE and not a conjunction (one block per level)'
                : `the head is \`${formatElementSpec(elementHead)}\` — a BARE head, which `
                    + 'spends no draw',
            draws: roomRng.draws,
            data: {
                asked: formatElementSpec(elementSpecNorm),
                drew: formatElementSpec(elementHead),
                isList: isElementList(elementSpecNorm),
                members: elementSpecNorm.any?.map((m2) => formatElementSpec(m2)) ?? null,
                phase: elementPhase,
            },
        });
    }
    let elementPlan = null;
    let elementRefusal = null;
    /** ⛓ HOISTED SO THE `pre-carve` ROW CAN BE WRITTEN BY THE PHASE at the end
     *  of its own branch — the site candidates and the `len` live in the inner
     *  scopes that computed them. */
    let preCarveRow = null;
    if (elementPhase === PHASE_PRE_CARVE) {
        const named = namedParams(elementHead, { elementOnly: true });
        if (named.turns !== undefined && named.turns !== 0) {
            elementRefusal = { reason: 'the-chain-is-arc-4',
                detail: `the spec names turns=${named.turns}. ⚖ Arc-3 ruling 1: Seedling gets `
                    + 'the STRAIGHT LANE only — `turns = 0`, which `weigh` certifies today. A '
                    + 'bent push path is the CHAIN, which is arc 4 and ASK-FIRST (design '
                    + 'ruling 17): it needs a solver that can plan a push around a corner, '
                    + 'and no template-side trick substitutes for one.' };
        } else {
            const entry = ELEMENT_TABLE[elementValues.name];
            const drawsBefore = roomRng.draws;
            const concrete = entry.element.instantiate(roomRng, { ...named, turns: 0 });
            const size = concrete.params.len + SITE_MARGIN_STRAIGHT;
            const sites = seedlingElementSiteCandidates({
                width: d.width, height: d.height, start: d.start, goal: goalCell, size,
            });
            preCarveRow = {
                len: concrete.params.len,
                size,
                candidates: sites.length,
                sites,
                drawsBefore,
            };
            if (sites.length === 0) {
                elementRefusal = { reason: 'no-site-fits-this-room',
                    detail: `a len=${concrete.params.len} straight gadget needs a ${size}x${size} `
                        + 'site with a one-cell ring around it, and no such rectangle fits '
                        + `inside the ${d.width}x${d.height} room's interior while leaving the `
                        + `START (${d.start.tx},${d.start.ty}) and the GOAL (${goalCell.tx},`
                        + `${goalCell.ty}) outside the ring. ⛔ ⚖ Arc-3 ruling 7: the room does `
                        + 'NOT grow — the honest answer is a shorter gadget or a different '
                        + 'goal, and D1(b)\'s census publishes how often each `len` fits.' };
            } else {
                const site = roomRng.pick(sites);
                preCarveRow.site = site;
                /**
                 * ⛓ THE STREAM POSITION AT `construct` IS ITS OWN FIELD (arc-2
                 * §10.5.1, measured there rather than reasoned): the SITE PICK
                 * sits BETWEEN `instantiate` and `construct`, both of which draw
                 * from this stream, so a rebuild that replays the two back to
                 * back lands ONE DRAW EARLY and builds a different gadget. ⇒ a
                 * record is `{params, site, drawsAtConstruct}` plus the seed.
                 */
                const drawsAtConstruct = roomRng.draws;
                const placement = concrete.construct(site);
                if (placement.refused) {
                    elementRefusal = { reason: placement.refused.reason,
                        detail: `${placement.refused.detail} (site ${site.w}x${site.h} at `
                            + `(${site.x},${site.y}))` };
                } else {
                    elementPlan = { concrete, site, placement, drawsBefore, drawsAtConstruct,
                        params: concrete.params, ids: guardIdsFor(0) };
                }
            }
        }
        /**
         * ⛓ THE `pre-carve` ROW, WRITTEN BY THE PHASE at the end of its own
         * branch — with the facts it already computed for its own purposes.
         * ⛔ Nothing is re-derived here; `sites` is the very list the `pick`
         * chose from.
         */
        ledger.phase('pre-carve', {
            sentence: elementRefusal
                ? `the PRE-CARVE element REFUSED: ${elementRefusal.reason} — `
                    + `${elementRefusal.detail}`
                : `\`${elementPlan.concrete.instance}\` drew len=${preCarveRow.len}, picked a `
                    + `${preCarveRow.size}x${preCarveRow.size} SITE at `
                    + `(${preCarveRow.site.x},${preCarveRow.site.y}) out of `
                    + `${preCarveRow.candidates} snug candidate(s), and CONSTRUCTED it — the `
                    + `site pick sits BETWEEN \`instantiate\` and \`construct\`, both of `
                    + 'which draw',
            draws: roomRng.draws,
            refusal: elementRefusal,
            data: {
                len: preCarveRow?.len ?? null,
                size: preCarveRow?.size ?? null,
                candidates: preCarveRow?.candidates ?? 0,
                site: preCarveRow?.site ?? null,
                drawsAtConstruct: elementPlan?.drawsAtConstruct ?? null,
            },
            facts: [
                preCarveRow && preCarveRow.candidates > 0 && paintable({
                    id: 'site-candidates',
                    label: `${preCarveRow.candidates} snug SITE candidate(s) — their top-left `
                        + `corners, for a ${preCarveRow.size}x${preCarveRow.size} rectangle `
                        + 'with a one-cell ring',
                    kind: 'cells',
                    cells: preCarveRow.sites.map((c) => ({ x: c.x, y: c.y })),
                    pick: preCarveRow.site ?? null,
                }),
                preCarveRow?.site && paintable({
                    id: 'site-picked',
                    label: `the SITE this run took — ${preCarveRow.site.w}x`
                        + `${preCarveRow.site.h} at (${preCarveRow.site.x},`
                        + `${preCarveRow.site.y})`,
                    kind: 'outline',
                    cells: (() => {
                        const out = [];
                        const r = preCarveRow.site;
                        for (let y = r.y; y < r.y + r.h; y += 1) {
                            for (let x = r.x; x < r.x + r.w; x += 1) out.push({ x, y });
                        }
                        return out;
                    })(),
                }),
            ],
        });
    }

    const carved = skeletonKind === DEFAULT_SKELETON_KIND ? null : carveRoom();
    let base = carved ? carved.record : blank;
    /**
     * ⛓ THE CARVE ROW. ⛔ Written for `empty` TOO, and the sentence says what
     * happened: `empty` is not "the `empty` backend", it is the open bordered
     * room this file has always built, and a ledger that skipped the row would
     * make the reader wonder which phase ate the carve.
     */
    ledger.phase('carve', {
        sentence: carved
            ? `the CONNECTOR carved the interior — kind \`${formatSkeleton(skeletonEffective,
                { explicit: Object.keys(skeletonEffective.params ?? {}) })}\`, leaving `
                + `${carved.record.entities?.length ?? 0} entit(y|ies) and the ring walled`
            : 'no carve — `empty` is the OPEN BORDERED ROOM this binding has always built, '
                + 'and the backend is not called at all',
        draws: roomRng.draws,
        record: base,
        entities: [goalEntity],
        data: {
            kind: skeletonKind,
            params: skeletonEffective.params ?? {},
            carved: Boolean(carved),
        },
    });
    /** ⛓ THE SKELETON, FROZEN BEFORE ANY ELEMENT WRITE — what "untouched
     *  skeleton terrain" means for the `on-connector` carve rule, and what the
     *  `room` probe reads. `base` itself is reassigned by both composites. */
    const skeletonBase = base;

    /**
     * ⛓⛓⛓ **THE ROOM PROBE (D1)** — the READ-ONLY view an `on-connector`
     * element gets of the room it is standing in, built ONCE over the finished
     * skeleton.
     *
     * ⛔ IT IS BUILT LAZILY AND ONLY WHEN AN `on-connector` ELEMENT ASKS. At
     * `--elements=none` and at `--elements=guard` nothing here executes: the
     * probe costs a ground-mask read and two floods, which is nothing beside a
     * solve and everything beside the byte-identity gate's requirement that the
     * default path not change.
     *
     * ⛔ AND THE THREE FLOOD MEMBERS ARE THE MODEL'S OWN. `connectedWith` and
     * `isCut` build their predicate from `walkableWith`, the ONE reading of
     * "which cells are ground" that `sealRefusal` and the door law already
     * share; `doorLaw` IS `doorLawRefusal`, the function a door TEMPLATE is
     * adjudicated by. An element does not re-derive a law — it asks it.
     */
    let probeMemo = null;
    /**
     * ⛓⛓⛓ SLICE 5b (D3) — **THE DOOR LAW'S CANDIDATE STASH.** `null` except for
     * the span of the ON-CONNECTOR construct, so nothing else that asks the law
     * (`elementRefusalAt`, the composite's commit) writes into it. ⛔ IT ADDS NO
     * FLOOD: each entry is the door cell the element ASKED about and the law's
     * OWN verdict, which is exactly `buildKillGate`/`buildBlockPocket`'s accept
     * test (`ok.push` happens iff that call returned falsy). ⇒ the legal subset
     * is CARRIED out of the construct rather than re-derived by a second search.
     */
    let doorLawStash = null;
    const roomProbeFor = () => {
        const mainPath = shortestPath(d.width, d.height,
            (x, y) => terrainAt(skeletonBase, x, y) === 'ground',
            { x: d.start.tx, y: d.start.ty }, { x: goalCell.tx, y: goalCell.ty }) ?? [];
        const paintMap = (paint) => new Map((paint ?? []).map((t) => [`${t.x},${t.y}`,
            t.tile === TILE_FLOOR ? 'ground' : 'wall']));
        const connectedWith = ({ paint = [], walled = [] } = {}) => connected(
            d.width, d.height,
            walkableWith(skeletonBase, paintMap(paint), new Set(walled.map((c) => `${c.x},${c.y}`))),
            { x: d.start.tx, y: d.start.ty }, { x: goalCell.tx, y: goalCell.ty },
        );
        return Object.freeze({
            width: d.width,
            height: d.height,
            start: Object.freeze({ x: d.start.tx, y: d.start.ty }),
            goal: Object.freeze({ x: goalCell.tx, y: goalCell.ty }),
            mainPath: Object.freeze(mainPath.map((c) => Object.freeze({ x: c.x, y: c.y }))),
            floorAt: (x, y) => x >= 0 && y >= 0 && x < d.width && y < d.height
                && terrainAt(skeletonBase, x, y) === 'ground',
            connectedWith,
            /** ⛓ SLICE 2's CLAUSE 1 AS A FUNCTION — the one-cell special case of
             *  the flood above, spelled once. */
            isCut: (cell) => !connectedWith({ walled: [cell] }),
            doorLaw: ({ paint = [], doorCells = [], clearer = [] } = {}) => {
                const painted = paintMap(paint);
                return doorLawRefusal({
                    width: d.width,
                    height: d.height,
                    walkableFor: (walled) => walkableWith(skeletonBase, painted, walled),
                    start: { x: d.start.tx, y: d.start.ty },
                    goal: { x: goalCell.tx, y: goalCell.ty },
                    doorKeys: new Set(doorCells.map((c) => `${c.x},${c.y}`)),
                    clearerKeys: clearer.map((c) => `${c.x},${c.y}`),
                    name: 'the element\'s door',
                    /** ⛔ AN ELEMENT HAS NO `sealRefusal` AHEAD OF IT — it is
                     *  constructed, not offered as an anchor — so it pays for
                     *  clause 1's other half itself. */
                    askOpenHalf: true,
                });
            },
        });
    };
    /** ⛓ SLICE 5b (D3) — the stash's own wrapper, so `roomProbeFor` above stays
     *  the ONE spelling of the law's arguments. */
    const probeWithStash = () => {
        const probe = roomProbeFor();
        return Object.freeze({
            ...probe,
            doorLaw: (o) => {
                const text = probe.doorLaw(o);
                if (doorLawStash) {
                    doorLawStash.push(Object.freeze({
                        cells: Object.freeze((o?.doorCells ?? [])
                            .map((c) => Object.freeze({ x: c.x, y: c.y }))),
                        legal: text === null,
                    }));
                }
                return text;
            },
        });
    };

    /**
     * ⛓ THE `on-connector` CONSTRUCT — after the carve, on the room's INTERIOR,
     * with the probe. It spends the element's ONE declared draw and nothing
     * else; the composite below spends none.
     */
    let onConnectorPlan = null;
    if (elementPhase === PHASE_ON_CONNECTOR) {
        const entry = ELEMENT_TABLE[elementValues.name];
        const drawsBefore = roomRng.draws;
        const concrete = entry.element.instantiate(roomRng,
            namedParams(elementHead, { elementOnly: true }));
        const drawsAtConstruct = roomRng.draws;
        const site = { x: 1, y: 1, w: d.width - 2, h: d.height - 2, room: probeWithStash() };
        doorLawStash = recordLedger ? [] : null;
        const placement = concrete.construct(site);
        const lawTried = doorLawStash ?? [];
        doorLawStash = null;
        if (placement.refused) {
            elementRefusal = { reason: placement.refused.reason,
                detail: placement.refused.detail };
        } else {
            onConnectorPlan = { concrete, placement, drawsBefore, drawsAtConstruct,
                params: concrete.params };
        }
        /**
         * ⛓ THE `on-connector` ROW — the element's own numbers, which its
         * `cost` block already carries: how many door cells the room OFFERED
         * (whether the one draw was a choice or a formality), how much wall it
         * grew and whether the pocket was a CARVE.
         */
        const probe = roomProbeFor();
        const pl = onConnectorPlan?.placement ?? null;
        /** ⛓ SLICE 5b (D3) — the OFFERED set, from the elements' own function. */
        const offered = recordLedger
            ? doorCandidates(probe).map((c) => c.cell) : [];
        ledger.phase('on-connector', {
            sentence: elementRefusal
                ? `the ON-CONNECTOR element REFUSED: ${elementRefusal.reason} — `
                    + `${elementRefusal.detail}`
                : `\`${concrete.instance}\` took the door cell `
                    + `(${pl.doorCells[0].x},${pl.doorCells[0].y}) — ONE \`pick\` among the `
                    + `${pl.cost.candidates} cut cell(s) the room offered equally — grew `
                    + `${pl.cost.wall} cell(s) of wall and carved ${pl.cost.carved}`,
            draws: roomRng.draws,
            refusal: elementRefusal,
            data: {
                candidates: pl?.cost?.candidates ?? null,
                wall: pl?.cost?.wall ?? null,
                carved: pl?.cost?.carved ?? null,
                goalDistance: pl?.cost?.goalDistance ?? null,
                push: pl?.cost?.push ?? null,
                doorCell: pl?.doorCells?.[0] ?? null,
                demandCells: pl?.demand?.length ?? 0,
            },
            facts: [
                paintable({
                    id: 'main-path',
                    label: `the MAIN PATH the door must cut — ${probe.mainPath.length} cell(s), `
                        + 'start to goal',
                    kind: 'path',
                    cells: probe.mainPath,
                }),
                pl && paintable({
                    id: 'door-cell',
                    label: `the DOOR cell — chosen from ${pl.cost.candidates} equal candidate(s)`,
                    kind: 'outline',
                    cells: pl.doorCells,
                    pick: pl.doorCells[0],
                }),
                pl && (pl.clearer?.length ?? 0) > 0 && paintable({
                    id: 'clearer',
                    label: `${pl.clearer.length} CLEARER cell(s) — what opens the door`,
                    kind: 'outline',
                    cells: pl.clearer,
                }),
                /**
                 * ⛓⛓ **THE TILES THE ELEMENT DECLARES IT WILL WRITE** — its
                 * grown wall and its carved pocket, together, in the CONTRACT's
                 * own field. ⛔ NOT `placement.wall`: the raw placement has no
                 * such field — `wall` and `carved` are the COMPOSITE's, split
                 * out when it adjudicates — so a paintable reading it here
                 * would be a guard clause that never fires under a label that
                 * claims otherwise. The composite's own row carries `owned`.
                 */
                pl && (pl.tiles?.length ?? 0) > 0 && paintable({
                    id: 'tiles-declared',
                    label: `${pl.tiles.length} cell(s) the element DECLARES it will write — `
                        + 'what makes the door a CUT rather than a decoration',
                    kind: 'cells',
                    cells: pl.tiles,
                }),
                pl && (pl.demand?.length ?? 0) > 0 && paintable({
                    id: 'demand-region',
                    label: `the DEMAND — ${pl.demand.length} cell(s) the element's BODY moves `
                        + 'in, plus the walls that keep it there (arc 3, slice 4d)',
                    kind: 'flood',
                    cells: pl.demand,
                }),
                /**
                 * ⛓⛓⛓ SLICE 5b (D3) — **THE FUNNEL, IN THREE LINES.** What the
                 * ROOM offered, what actually reached the DOOR LAW, and what the
                 * law PASSED — which is the set the element's one draw picked
                 * from. ⛔ Every one of them is carried: the first is a walk of a
                 * path already computed, the other two are the construct's own
                 * calls. `cost.candidates` carries only the last one's COUNT,
                 * which cannot say whether a candidate was never tried or tried
                 * and refused.
                 */
                offered.length > 0 && paintable({
                    id: 'door-candidates-offered',
                    label: `${offered.length} interior MAIN-PATH cell(s) the room OFFERED — `
                        + 'every cell of the path but its two endpoints',
                    kind: 'cells',
                    cells: offered,
                }),
                lawTried.length > 0 && paintable({
                    id: 'door-candidates-tried',
                    label: `${lawTried.length} of them reached the DOOR LAW — the rest were cut `
                        + 'earlier (too near the goal, or no legal pocket)',
                    kind: 'cells',
                    cells: lawTried.flatMap((t) => t.cells),
                }),
                lawTried.some((t) => t.legal) && paintable({
                    id: 'door-candidates-legal',
                    label: `${lawTried.filter((t) => t.legal).length} PASSED it — the set the `
                        + 'ONE draw chose among',
                    kind: 'cells',
                    cells: lawTried.filter((t) => t.legal).flatMap((t) => t.cells),
                    pick: pl?.doorCells?.[0] ?? null,
                }),
            ],
        });
    }

    /**
     * ⛓⛓⛓ **THE COMPOSITE** — the carve ran over the WHOLE grid exactly as it
     * does today and its answer inside the reserved rectangle is now DISCARDED;
     * the element's tiles are written over it, the ring is walled except the
     * entry mouth, the mouth is joined by the shortest tunnel and every check is
     * asked on the way out. ⛔ It spends NO draw, and on a refusal the room is
     * left exactly as the carve left it (arc 1's commit-on-success rule, one
     * layer out) — so a seed whose gadget cannot be joined produces a perfectly
     * ordinary Seedling level with `elements.refused` set.
     *
     * ⛓ THE ELEMENT'S ENTITIES ARE THE **SKELETON'S**, not a template's: the
     * gadget is part of the room the loop is handed, so `skeleton()` carries the
     * block, the two buttons and the two locks beside the goal pickup, and the
     * loop's own step-0 solve is the certification (D4).
     */
    let elementInfo = Object.freeze({
        spec: elementSpecNorm, ran: false, placed: Object.freeze([]),
        refused: elementRefusal ? Object.freeze(elementRefusal) : null,
    });
    let elementEntities = Object.freeze([]);
    let elementCells = new Set();
    /** ⛓ arc 3, slice 4d — `"x,y" -> 'floor'|'wall'`, EMPTY unless a placed
     *  element declared a `demand`. At `--elements=none` and for every element
     *  that declares none it stays empty, which is what keeps `elementRefusalAt`
     *  a function that returns on its first line. */
    const elementDemand = new Map();
    if (elementPlan) {
        const out = compositeSeedlingElement({
            width: d.width, height: d.height,
            groundAt: (x, y) => terrainAt(base, x, y) === 'ground',
            site: elementPlan.site, placement: elementPlan.placement,
            start: d.start, goal: goalCell,
        });
        if (out.refused) {
            elementInfo = Object.freeze({
                spec: elementSpecNorm, ran: false, placed: Object.freeze([]),
                refused: Object.freeze(out.refused),
            });
        } else if (dropElement) {
            /**
             * ⛔ THE GEOMETRY SUCCEEDED AND IS DELIBERATELY NOT COMMITTED — see
             * the `dropElement` parameter. The draws are spent either way, which
             * is why this arm produces a level and not an error.
             */
            elementInfo = Object.freeze({
                spec: elementSpecNorm, ran: false, placed: Object.freeze([]),
                refused: Object.freeze({
                    reason: 'the-skeleton-does-not-solve-with-the-element',
                    detail: 'the gadget FITS this room and the solver cannot certify it, so '
                        + 'the level was generated WITHOUT it. ⛓ The refusal is the arc\'s own '
                        + 'dependency, published: `procgenSeedlingElements.js`\'s docblock and '
                        + 'the arc-3 as-built §10 carry the three solver gaps and the S1 work '
                        + 'order. ⛔ Nothing here solves around it.',
                }),
            });
        } else {
            const p = out.placed;
            base = withTerrain(base, p.painted);
            const withGoal = withEntities(base, [{
                type: d.goalClass, ...goalOel, attrs: { tag: d.goalTag },
            }]);
            const taken = [Number.parseInt(d.goalTag, 10)];
            const realised = seedlingElementEntities({
                placed: p,
                groupIdFor: (at) => placementGroupId(at, d.height),
                tagFor: (...more) => placementTagId(withGoal, [...taken, ...more]),
                ids: elementPlan.ids,
            });
            elementEntities = Object.freeze(realised.entities.map((e) => Object.freeze({
                type: e.type, ...oelAtTile(e.tx, e.ty),
                ...(e.attrs ? { attrs: Object.freeze({ ...e.attrs }) } : {}),
            })));
            /**
             * ⛔ EVERY CELL OF THE RESERVED RECTANGLE AND OF THE TUNNEL IS OFF
             * LIMITS TO PASS 2, and it is a REFUSAL BY NAME rather than a hope.
             * `freeRefusal` alone would let a template wall the push lane (it is
             * untouched `ground` with no entity on it) and `carveCellRefusal`
             * alone would let one CARVE through the ring (in `base` the ring is
             * wall, so the untouched-skeleton test passes) — either would break
             * a gadget the level was built around, and the loop would only find
             * out from a solve it then reverted.
             */
            const rr = reservedRect(p.site);
            for (let y = rr.y; y < rr.y + rr.h; y += 1) {
                for (let x = rr.x; x < rr.x + rr.w; x += 1) elementCells.add(`${x},${y}`);
            }
            for (const c of p.tunnel) elementCells.add(`${c.x},${c.y}`);
            elementInfo = Object.freeze({
                spec: elementSpecNorm,
                ran: true,
                placed: Object.freeze([Object.freeze({
                    element: elementPlan.concrete.name,
                    family: elementPlan.concrete.family,
                    instance: elementPlan.concrete.instance,
                    index: 0,
                    /** ⛓ A RECORD IS `{params, site, drawsAtConstruct}` + the
                     *  level's SEED (arc-2 §9.1/§10.5.1). `drawsBefore` is kept
                     *  beside it because it says where the element's whole draw
                     *  span began. */
                    params: Object.freeze({ ...elementPlan.params }),
                    drawsBefore: elementPlan.drawsBefore,
                    drawsAtConstruct: elementPlan.drawsAtConstruct,
                    groups: realised.groups,
                    tags: realised.tags,
                    ids: elementPlan.ids,
                    ...p,
                })]),
                refused: null,
            });
        }
        /**
         * ⛓ THE COMPOSITE ROW — the ring re-walled, the entry mouth JOINED by
         * the shortest tunnel, the exit mouth SEALED, and the flag's LOCK put
         * on a main-path cut. ⛔ It spends NO draw, which the row states rather
         * than leaves to be inferred from two equal numbers.
         */
        const cp = elementInfo.ran ? elementInfo.placed[0] : null;
        /**
         * ⛓⛓⛓ SLICE 5b (D1) — **THE FLAG LOCK'S CUT, AND IT IS THE ONE PAINTABLE
         * IN THIS SLICE THAT IS COMPUTED RATHER THAN CARRIED.** ⛔ Said plainly
         * because the slice's own law is *carry what the phase had in hand*:
         * `flagLockCellFor` adjudicates its cut with `connected`, an EARLY-EXIT
         * BFS that never builds a set, so there is nothing to carry — a sink
         * there would have had to change the decision code's flood, which is a
         * behaviour change for a picture. ⇒ the two floods are taken HERE, at
         * the ledger site, only when recording, only for the cell that WON, and
         * they spend no draw. The alternative (no picture for the guard's own
         * cut, which is what the whole element exists to make) is worse.
         */
        const flagLockSets = (recordLedger && cp) ? (() => {
            const walkable = (x, y) => terrainAt(base, x, y) === 'ground'
                && !(x === cp.flagLockCell.x && y === cp.flagLockCell.y);
            return {
                startSide: [...reachableFrom(d.width, d.height, walkable,
                    { x: d.start.tx, y: d.start.ty })].map(cellOfKey),
                goalSide: [...reachableFrom(d.width, d.height, walkable,
                    { x: goalCell.tx, y: goalCell.ty })].map(cellOfKey),
            };
        })() : null;
        ledger.phase('composite', {
            sentence: cp
                ? `the COMPOSITE committed \`${cp.instance}\`: the reserved rectangle was `
                    + `re-walled, a ${cp.tunnel.length}-cell TUNNEL joined the entry mouth at `
                    + `(${cp.entryMouth.x},${cp.entryMouth.y}), the exit mouth was SEALED, the `
                    + `FLAG sits at (${cp.flagCell.x},${cp.flagCell.y}) and its LOCK on the `
                    + `main-path cut (${cp.flagLockCell.x},${cp.flagLockCell.y}). The carve `
                    + `had written ${cp.carveOverwrote} of these cells differently. ⛔ NO draw.`
                : `the COMPOSITE REFUSED: ${elementInfo.refused?.reason} — `
                    + `${elementInfo.refused?.detail}`,
            draws: roomRng.draws,
            record: base,
            entities: [goalEntity, ...elementEntities],
            refusal: elementInfo.ran ? null : elementInfo.refused,
            data: {
                tunnel: cp?.tunnel.length ?? null,
                carveOverwrote: cp?.carveOverwrote ?? null,
                entities: elementEntities.length,
                dropped: dropElement,
            },
            facts: cp ? [
                paintable({ id: 'tunnel', label: `the ${cp.tunnel.length}-cell entry TUNNEL`,
                    kind: 'cells', cells: cp.tunnel }),
                paintable({ id: 'reserved-rect',
                    label: `the RESERVED rectangle — ${cp.site.w + 2}x${cp.site.h + 2} at `
                        + `(${cp.site.x - 1},${cp.site.y - 1}); pass 2 may not touch any of it`,
                    kind: 'outline',
                    cells: (() => {
                        const out = [];
                        for (let y = cp.site.y - 1; y < cp.site.y + cp.site.h + 1; y += 1) {
                            for (let x = cp.site.x - 1; x < cp.site.x + cp.site.w + 1; x += 1) {
                                out.push({ x, y });
                            }
                        }
                        return out;
                    })() }),
                paintable({ id: 'flag-and-lock',
                    label: 'the FLAG (buttonroom) and its LOCK on the main-path cut',
                    kind: 'outline',
                    cells: [cp.flagCell, cp.flagLockCell],
                    pick: cp.flagCell }),
                flagLockSets?.startSide?.length && paintable({
                    id: 'flag-lock-flood-start',
                    label: `the START side of the flag LOCK's cut — `
                        + `${flagLockSets.startSide.length} cell(s) reachable with `
                        + `(${cp.flagLockCell.x},${cp.flagLockCell.y}) walled`,
                    kind: 'flood',
                    cells: flagLockSets.startSide,
                    note: 'the FLAG has to be on this side, or the lock guards nothing',
                }),
                flagLockSets?.goalSide?.length && paintable({
                    id: 'flag-lock-flood-goal',
                    label: `the GOAL side of the same cut — `
                        + `${flagLockSets.goalSide.length} cell(s)`,
                    kind: 'flood',
                    cells: flagLockSets.goalSide,
                }),
            ] : [],
        });
    }

    /**
     * ⛓⛓⛓ **THE `on-connector` COMMIT** — the same three steps the pre-carve
     * composite takes (adjudicate, paint, realise), against a room that already
     * exists. ⛔ `dropElement` behaves identically here: the draws are spent,
     * the geometry is measured, and the level ships WITHOUT the element — which
     * is what makes a refused certification a graded refusal rather than a
     * throw.
     */
    if (onConnectorPlan) {
        /**
         * ⛓⛓⛓ SLICE 5b (D1) — **THE SINKS, AND THEY ARE THE COMMIT'S OWN CALL.**
         * The door law and the carve law are each asked exactly ONCE here, on
         * the placement that is about to be committed, so the sets they compute
         * describe the room that ships. ⛔ `null` when recording is off, which
         * is what keeps the spy's arm free of the goal-side flood.
         */
        const doorSets = recordLedger ? {} : null;
        const carveSets = recordLedger ? {} : null;
        const out = compositeSeedlingOnConnector({
            width: d.width,
            height: d.height,
            groundAt: (x, y) => terrainAt(skeletonBase, x, y) === 'ground',
            skeletonWallAt: (x, y) => terrainAt(skeletonBase, x, y) === 'wall',
            placement: onConnectorPlan.placement,
            start: d.start,
            goal: goalCell,
            doorLaw: ({ paintedFor, doorKeys, clearerKeys }) => doorLawRefusal({
                width: d.width,
                height: d.height,
                walkableFor: paintedFor,
                start: { x: d.start.tx, y: d.start.ty },
                goal: { x: goalCell.tx, y: goalCell.ty },
                doorKeys,
                clearerKeys,
                name: `the element "${onConnectorPlan.concrete.instance}"`,
                askOpenHalf: true,
                sets: doorSets,
            }),
            carveLaw: ({ carved: cells, walkableAfter, walkableBefore }) => carveLawRefusal({
                width: d.width,
                height: d.height,
                carved: cells,
                walkableAfter,
                walkableBefore,
                start: { x: d.start.tx, y: d.start.ty },
                goal: { x: goalCell.tx, y: goalCell.ty },
                name: `the element "${onConnectorPlan.concrete.instance}"`,
                sets: carveSets,
            }),
        });
        if (out.refused) {
            elementInfo = Object.freeze({
                spec: elementSpecNorm, ran: false, placed: Object.freeze([]),
                refused: Object.freeze(out.refused),
            });
        } else if (dropElement) {
            elementInfo = Object.freeze({
                spec: elementSpecNorm, ran: false, placed: Object.freeze([]),
                refused: Object.freeze({
                    reason: 'the-skeleton-does-not-solve-with-the-element',
                    detail: 'the door FITS this room and the solver cannot certify it, so the '
                        + 'level was generated WITHOUT it. ⛓ The refusal carries the solve\'s '
                        + 'own words on `summary.elements.certification`.',
                }),
            });
        } else {
            const p = out.placed;
            base = withTerrain(base, p.painted);
            const withGoal = withEntities(base, [{
                type: d.goalClass, ...goalOel, attrs: { tag: d.goalTag },
            }]);
            const taken = [Number.parseInt(d.goalTag, 10)];
            const realised = seedlingOnConnectorEntities({
                placed: p,
                tagFor: (...more) => placementTagId(withGoal, [...taken, ...more]),
            });
            elementEntities = Object.freeze(realised.entities.map((e) => Object.freeze({
                type: e.type, ...oelAtTile(e.tx, e.ty),
                ...(e.attrs ? { attrs: Object.freeze({ ...e.attrs }) } : {}),
            })));
            /** ⛔ THE OWNED CELLS ARE THE DOOR, ITS CLEARER, THE WALL AND THE
             *  CARVE — not a rectangle. This element has none, and reserving one
             *  would take a corridor's worth of room away from pass 2 for a door
             *  that occupies two cells. */
            for (const c of p.owned) elementCells.add(`${c.x},${c.y}`);
            /** ⛓ THE DEMAND, INDEXED (arc 3, slice 4d) — `elementRefusalAt`'s
             *  second question. ⛔ A cell can be DEMANDED without being OWNED,
             *  which is the whole difference: pass 2 may stand on it, it may
             *  even carve it to ground, but it may not make it something the
             *  element's body cannot survive. */
            for (const dm of onConnectorPlan.placement.demand ?? []) {
                elementDemand.set(`${dm.x},${dm.y}`, dm.must);
            }
            elementInfo = Object.freeze({
                spec: elementSpecNorm,
                ran: true,
                placed: Object.freeze([Object.freeze({
                    element: onConnectorPlan.concrete.name,
                    family: onConnectorPlan.concrete.family,
                    phase: PHASE_ON_CONNECTOR,
                    instance: onConnectorPlan.concrete.instance,
                    index: 0,
                    params: Object.freeze({ ...onConnectorPlan.params }),
                    drawsBefore: onConnectorPlan.drawsBefore,
                    drawsAtConstruct: onConnectorPlan.drawsAtConstruct,
                    tags: realised.tags,
                    ...p,
                })]),
                refused: null,
            });
        }
        /** ⛓ THE `on-connector` COMPOSITE ROW — the same three steps
         *  (adjudicate, paint, realise) against a room that already exists. */
        const op = elementInfo.ran ? elementInfo.placed[0] : null;
        ledger.phase('composite', {
            sentence: op
                ? `the COMPOSITE committed \`${op.instance}\`: the door law and the carve law `
                    + `were both asked and both held; it OWNS ${op.owned.length} cell(s) — the `
                    + `door (${op.doorCell.x},${op.doorCell.y}), ${op.clearer.length} `
                    + `clearer cell(s), ${op.wall.length} of grown wall and ${op.carved.length} `
                    + `it CARVED — and DEMANDS ${elementDemand.size} more. ⛔ NO draw.`
                : `the COMPOSITE REFUSED: ${elementInfo.refused?.reason} — `
                    + `${elementInfo.refused?.detail}`,
            draws: roomRng.draws,
            record: base,
            entities: [goalEntity, ...elementEntities],
            refusal: elementInfo.ran ? null : elementInfo.refused,
            data: {
                owned: op?.owned.length ?? null,
                demanded: elementDemand.size,
                entities: elementEntities.length,
                dropped: dropElement,
            },
            facts: op ? [
                paintable({ id: 'owned', label: `${op.owned.length} cell(s) the element OWNS — `
                    + 'pass 2 may not paint, carve or occupy any of them',
                kind: 'cells', cells: op.owned }),
                paintable({ id: 'pocket', label: `${op.carved.length} cell(s) CARVED for the `
                    + 'pocket', kind: 'cells', cells: op.carved }),
                elementDemand.size > 0 && paintable({
                    id: 'demand-region',
                    label: `the DEMAND — ${elementDemand.size} cell(s) the body moves in plus `
                        + 'the walls that keep it there',
                    kind: 'flood',
                    cells: [...elementDemand.keys()].map(cellOfKey) }),
                /**
                 * ⛓⛓⛓ SLICE 5b (D1) — **THE DOOR LAW'S OWN TWO FLOODS**, carried
                 * out of the commit's single call. ⛔ This is what "the door is a
                 * CUT" MEANS as a picture: with the door cell(s) walled the room
                 * is two components, the START's and the GOAL's, and the clearer
                 * has to be in the first one.
                 */
                doorSets?.startSide?.length && paintable({
                    id: 'door-flood-start',
                    label: `the START side of the cut — ${doorSets.startSide.length} cell(s) `
                        + 'reachable from the start with the door cell(s) WALLED',
                    kind: 'flood',
                    cells: doorSets.startSide,
                    note: 'clause 2 of the door law asks that every CLEARER cell be in here',
                }),
                doorSets?.goalSide?.length && paintable({
                    id: 'door-flood-goal',
                    label: `the GOAL side of the cut — ${doorSets.goalSide.length} cell(s) `
                        + 'reachable from the goal with the same cell(s) walled',
                    kind: 'flood',
                    cells: doorSets.goalSide,
                    note: 'the two sides are DISJOINT, and that disjointness IS clause 1',
                }),
                carveSets?.mouths?.length && paintable({
                    id: 'carve-mouth',
                    label: `the carve's ${carveSets.mouths.length} MOUTH(S) — clause (a) of the `
                        + 'carve law admits exactly one',
                    kind: 'outline',
                    cells: carveSets.mouths,
                }),
            ] : [],
        });
    }


    /**
     * ── ⛓⛓⛓ PROCGEN ELEMENTS ARC 3, SLICE 4b: **THE AREA BINDING**, HERE
     *    AND IN THIS ORDER ──────────────────────────────────────────────
     *
     * ⛓ **THE DRAW ORDER, DECLARED** (the order IS the identity):
     *   0-7  as above — the list draw, the goal, the element, the CARVE, the
     *        on-connector construct, the composites
     *   8  the PARTITION      — spends NO draw (it reads tiles)
     *   9  `buildAreaGraph`   — its own declared five phases (arc-1 §8.2)
     *  10  the REALISATION    — one `pick` per UNFORCED flag cell. The LOCKS
     *                           draw nothing (every boundary cell of a locked
     *                           area takes one) and nothing is carved, so
     *                           `graphify` spends no realisation draw either.
     *
     * ⛔ **IT IS LAST, AND THAT IS FORCED.** The partition reads the room the
     * COMPOSITES left: an `on-connector` element grows wall and carves a pocket,
     * and a partition taken before it would find chambers the finished room does
     * not have. The guard's own area is DECLARED into the partition for the
     * opposite reason — its push lane is 1 wide, so the blob rule would shred it.
     *
     * ⛔ **AND AT `keys: 0` NONE OF 8-10 HAPPENS.** Not "runs and returns early":
     * the branch is not entered, no partition is computed, the module is not
     * called and the rng is not touched — so every committed Seedling md5 is
     * unchanged by a code path that does not execute (⚖ arc-1 ruling 3, one
     * substrate over). `procgenSeedlingAreas.test.js` drives it with a COUNTING
     * SPY rather than by comparing tiles.
     *
     * ⛔ **EVERY FAILURE IS A GRADED REFUSAL BY NAME**, never a throw: the room
     * keeps its carved skeleton and its element, `areas.refused` names the
     * reason, and the CLI and the page can print it. ⚖ Arc 1's own words — *a
     * refused GRAPH still ships its carved level.*
     */
    const areaSpecNorm = normalizeAreaSpec(areaSpec ?? DEFAULT_AREAS);
    const areaValues = resolveAreaSpec(areaSpecNorm);
    const areaGround = (x, y) => x >= 0 && y >= 0 && x < d.width && y < d.height
        && terrainAt(base, x, y) === 'ground';
    /**
     * ⛓⛓ THE ELEMENT'S AREA IS **DECLARED** INTO THE PARTITION (arc-2 §9.9.5),
     * with the id `E{index}`. ⛔ Only the PRE-CARVE guard has one: an
     * `on-connector` element owns a door, a clearer, some wall and a carved cell
     * — cells, not an AREA — and declaring a two-cell door as an area would give
     * the graph somewhere to put a key that is not a place.
     */
    const declaredAreas = elementInfo.ran && elementInfo.placed[0].areaCells
        ? [{ id: `E${elementInfo.placed[0].index}`,
            cells: elementInfo.placed[0].areaCells.map((c) => ({ x: c.x, y: c.y })) }]
        : [];
    /**
     * ⛓⛓⛓ **THE GOAL'S VESTIBULE — TRAP 348 ON THE LOCK CELLS, AND IT IS A
     * SEEDLING RULE THE MAZE DOES NOT NEED.**
     *
     * A corridor goal gets a SYNTHETIC ONE-CELL area, whose only boundary cell
     * IS THE GOAL — so `door on every boundary cell` would put a `lock` on the
     * torch. On the maze that is merely odd; on Seedling it is trap 348: a lock
     * within 2 cells of the goal breaks the COLLECT ceremony's approach sweep
     * (§10.6(c), measured — *"approaching torchpickup@128,128, the sweep was
     * blocked by lock at (128,112)"*), and the level is unsolvable for a reason
     * no reader would attribute to the area graph.
     *
     * ⇒ when the goal is not already inside a real area, the binding DECLARES a
     * VESTIBULE — the goal plus every live ground cell within GRAPH DISTANCE
     * `GOAL_VESTIBULE_RADIUS` (2) of it — so the area's boundary cells sit at
     * distance exactly 2 and the locks land where §10.6(c) allows them.
     *
     * ⛓ **THE ARITHMETIC THAT SAYS THE VESTIBULE ALWAYS HAS A BOUNDARY.**
     * `GOAL_MIN_FROM_START = 3` puts the start at MANHATTAN >= 3 from the goal,
     * and Manhattan <= graph distance on a grid, so the START is at graph
     * distance >= 3 — outside the ball. A ball that reached every live cell
     * would mean the room's whole walkable set lies within 2 of the goal, which
     * cannot contain a start 3 away. ⇒ some live cell is at distance >= 3, the
     * ball has a frontier, and the frontier's inside is the boundary.
     *
     * ⚠ **AND A LOCK ADJACENT TO THE *START* IS LEGAL** — the start is not a
     * pickup and has no approach sweep. The entrance's own area is level 0 and
     * is never locked; what a level->=1 lock beside it means is "the first step
     * out of the room is gated", which is a level, not a defect.
     */
    const goalVestibule = () => vestibuleCellsAround({
        width: d.width, height: d.height, walkable: areaGround,
        goal: { x: goalCell.tx, y: goalCell.ty }, radius: GOAL_VESTIBULE_RADIUS,
        exclude: declaredAreas.flatMap((a) => a.cells),
    });
    let partitionMemo = null;
    /** ⛓ SLICE 5b (D2) — the VESTIBULE's cells, STASHED where they are computed.
     *  `goalVestibule()` is a bounded neighbourhood walk and calling it a second
     *  time for a picture would be a second answer to the same question. */
    let goalVestibuleCells = null;
    /**
     * ⛓ ONE PARTITION PER MODEL, MEMOIZED — the census, the binding below and
     * (slice 5a) the page all read this one answer. ⛔ It spends NO draw, so
     * asking it does not move a level; it is a GETTER for `sites`' own reason
     * (a model nobody asks pays nothing).
     */
    const areaPartitionOf = () => {
        if (partitionMemo) return partitionMemo;
        const bare = partitionAreas({
            width: d.width, height: d.height, isFloor: areaGround,
            entrance: { x: d.start.tx, y: d.start.ty }, goal: { x: goalCell.tx, y: goalCell.ty },
            declared: declaredAreas,
        });
        const goalArea = bare.areas.find((a) => a.id === bare.goalArea) ?? null;
        if (goalArea === null || !goalArea.synthetic) { partitionMemo = bare; return bare; }
        const cells = goalVestibule();
        goalVestibuleCells = cells;
        partitionMemo = partitionAreas({
            width: d.width, height: d.height, isFloor: areaGround,
            entrance: { x: d.start.tx, y: d.start.ty }, goal: { x: goalCell.tx, y: goalCell.ty },
            declared: [...declaredAreas, { id: GOAL_AREA_ID, cells, kind: 'goal' }],
        });
        return partitionMemo;
    };

    let areaInfo = Object.freeze({
        spec: areaSpecNorm, ran: false, calledModule: false, partition: null, graph: null,
        locks: Object.freeze([]), flags: Object.freeze([]), refused: null,
    });
    let areaEntities = Object.freeze([]);
    if (areaValues.keys > 0) {
        const partition = areaPartitionOf();
        const summary = Object.freeze({
            areaCount: partition.areas.length,
            syntheticCount: partition.areas.filter((a) => a.synthetic).length,
            elementCount: partition.areas.filter((a) => a.kind === 'element').length,
            adjacencyCount: partition.adjacency.length,
            corridorComponents: partition.corridorComponents.length,
            entranceArea: partition.entranceArea,
            goalArea: partition.goalArea,
            deadFloorCells: partition.deadFloorCells,
        });
        /**
         * ⛓ THE PARTITION ROW — no draw, and it reads the room the COMPOSITES
         * left (a partition taken before them would find chambers the finished
         * room does not have).
         */
        ledger.phase('partition', {
            sentence: `the PARTITION found ${summary.areaCount} area(s) `
                + `(${summary.syntheticCount} synthetic, ${summary.elementCount} declared by an `
                + `element), ${summary.adjacencyCount} adjacency pair(s) over `
                + `${summary.corridorComponents} corridor component(s); entrance in `
                + `${summary.entranceArea}, goal in ${summary.goalArea}, `
                + `${summary.deadFloorCells} dead floor cell(s). ⛔ NO draw — it reads tiles.`,
            draws: roomRng.draws,
            data: { ...summary },
            facts: [
                ...partition.areas.map((area, i) => paintable({
                    id: `area-${area.id}`,
                    label: `area ${area.id} — ${area.cells.length} cell(s), `
                        + `${area.boundary.length} on its boundary`
                        + `${area.synthetic ? ' (SYNTHETIC — grown, not a chamber)' : ''}`,
                    kind: area.synthetic ? 'outline' : 'cells',
                    cells: area.cells,
                    note: i === 0 ? 'the boundary cells are where this area\'s locks go' : null,
                })),
                partition.deadFloorCells > 0 && paintable({
                    id: 'dead-floor',
                    label: `${partition.deadFloorCells} DEAD floor cell(s) — ground the `
                        + 'entrance cannot reach',
                    kind: 'cells',
                    cells: [],
                    note: 'the partition counts them; it does not list them',
                }),
            ],
        });
        const refuseArea = (reason, detail, extra = {}) => Object.freeze({
            spec: areaSpecNorm, ran: false, calledModule: false, partitionSummary: summary,
            partition, graph: null, locks: Object.freeze([]), flags: Object.freeze([]),
            ...extra, refused: Object.freeze({ reason, detail }),
        });
        const isEnd = (c) => (c.x === d.start.tx && c.y === d.start.ty)
            || (c.x === goalCell.tx && c.y === goalCell.ty);
        const freeCellsOf = (area) => {
            const b = new Set(area.boundary.map((c) => `${c.x},${c.y}`));
            return area.cells.filter((c) => !b.has(`${c.x},${c.y}`) && !isEnd(c));
        };
        if (partition.areas.length <= 1) {
            areaInfo = refuseArea('the-partition-yields-one-area-or-fewer',
                `the ${skeletonKind} room partitions into ${partition.areas.length} area(s), and `
                + 'a lock-and-key graph needs at least two. ⛓ The AREA CENSUS measured this: on '
                + 'a BARE TREE KIND a 10x10 Seedling room has no all-ground 2x2 square at all '
                + 'on most seeds (§8.3), so the two areas are the entrance\'s and the goal\'s '
                + 'and there is nothing between them to lock. ⛔ Area is PASS 1\'s (⚖ ruling '
                + '24): `chambers=k`, `rooms`, or an element is what provides it.');
        } else if (partition.entranceArea === partition.goalArea) {
            areaInfo = refuseArea('the-entrance-and-the-goal-share-one-area',
                `both the START (${d.start.tx},${d.start.ty}) and the GOAL (${goalCell.tx},`
                + `${goalCell.ty}) fall in area ${partition.entranceArea}. ⛔ `
                + '`buildAreaGraph` refuses `entrance === goal` by name, so the binding does '
                + 'not call it — the goal is drawn by pass 1 (⚖ arc-1 ruling 2) and moving it '
                + 'to a second area is exactly what that ruling forbids.');
        } else {
            const graph = buildAreaGraph({
                rng: roomRng,
                areas: partition.areas.map((a) => ({
                    id: a.id,
                    capacity: {
                        /**
                         * ⛓⛓⛓ **`binds=item` — THE GADGET'S AREA IS THE ONLY
                         * ONE THAT MAY HOLD A SYMBOL** (arc-2 §10.4's law,
                         * carried whole). ⚖ Ruling 22 says the gadget GUARDS the
                         * flag switch; whether it does is decided by
                         * `placeKeys`, and the maze measured that when it
                         * competes freely it wins about one accepted run in
                         * seven. `capacity` is the module's own lever for
                         * exactly this, so the run declares it — and the
                         * acceptance it costs is PUBLISHED (the census's two
                         * `binds` arms), never bought back by widening a bound.
                         */
                        item: (elementInfo.ran && declaredAreas.length > 0
                            && elementValues.binds === 'item' ? a.kind === 'element' : true)
                            && freeCellsOf(a).length > 0,
                        switch: false,
                    },
                })),
                adjacency: partition.adjacency.map((e) => [e.a, e.b]),
                entrance: partition.entranceArea,
                goal: partition.goalArea,
                bounds: {
                    maxKeys: areaValues.keys,
                    graphifyProbability: areaValues.graphify,
                    allowGoalShortcut: areaValues.goalShortcut === 1,
                    maxSwitches: 0,
                },
            });
            ledger.phase('graph', {
                sentence: graph.refused
                    ? `the AREA GRAPH REFUSED: ${graph.refused.reason} — `
                        + `${graph.refused.detail} (${graph.refused.attempts} attempt(s))`
                    : `the AREA GRAPH placed ${graph.symbols.length} symbol(s) `
                        + `[${graph.symbols.join(', ')}] over ${partition.areas.length} area(s) `
                        + `in ${graph.attempts} attempt(s), spending ${graph.draws} draw(s); `
                        + `${graph.edges.filter((e2) => e2.kind === 'graphify').length} `
                        + 'graphify edge(s) RECORDED, none carved',
                draws: roomRng.draws,
                refusal: graph.refused ? { reason: graph.refused.reason,
                    detail: graph.refused.detail } : null,
                data: {
                    symbols: graph.symbols ? [...graph.symbols] : [],
                    attempts: graph.attempts,
                    draws: graph.draws,
                    maxKeys: areaValues.keys,
                },
            });
            if (graph.refused) {
                areaInfo = Object.freeze({
                    spec: areaSpecNorm, ran: false, calledModule: true, partitionSummary: summary,
                    partition, graph, locks: Object.freeze([]), flags: Object.freeze([]),
                    refused: Object.freeze({
                        reason: graph.refused.reason,
                        detail: `${graph.refused.detail} (${graph.refused.attempts} attempt(s) `
                            + `over ${partition.areas.length} area(s) at maxKeys `
                            + `${areaValues.keys}) — ⛓ \`maxKeys\` is a TARGET, not a ceiling: `
                            + 'a space that grows fewer key levels REFUSES rather than settling '
                            + 'for fewer keys (arc-1 slice 1 deviation 10).',
                    }),
                });
            } else {
                /**
                 * ⛓⛓⛓ **THE REALISATION — THE LOCK IS A PROPERTY OF THE AREA**
                 * (arc-1 §9.3's law, one substrate over, and the two grid facts
                 * that forced it there force it here too: a corridor component
                 * can touch three areas, and the adjacency graph has cycles the
                 * tree did not take).
                 *
                 *   for every area X at key level L >= 1, `lock {tset: K{L-1}}`
                 *   goes on EVERY BOUNDARY CELL of X — the AREA-side cell, never
                 *   the corridor mouth (a mouth can be adjacent to two areas at
                 *   once and one cell holds one entity).
                 *
                 * ⛓⛓⛓ **AND THIS IS WHERE `wall-does-not-seal` STOPS BEING A
                 * REFUSAL** (4c §13.13 residue ii): 27 of the door census's
                 * refusals carry that name, every one on a `loopy`/`open` kind —
                 * *a room with two routes is not cut by one line.* A lock on
                 * EVERY boundary cell is more than one line, which is exactly
                 * what those kinds need, and it is this slice's own mechanism.
                 */
                const symbolGroup = new Map();
                const symbolFlagTag = new Map();
                const symbolLockTag = new Map();
                const flags = [];
                let supersededFlagLock = null;
                /**
                 * ⛓ THE TAG LEDGER. The record already holds the goal pickup and
                 * the element's entities, so `placementTagId` sees their tags;
                 * `taken` carries the ones this loop has just handed out and the
                 * goal's DECLARED slot (§'s own rule: the record is the live
                 * answer, the reserved list is the declared one).
                 */
                const recordSoFar = withEntities(base, [{
                    type: d.goalClass, ...goalOel, attrs: { tag: d.goalTag },
                }, ...elementEntities]);
                const taken = [Number.parseInt(d.goalTag, 10)];
                const takeTag = () => {
                    const t = placementTagId(recordSoFar, [...taken]);
                    taken.push(t);
                    return t;
                };
                /**
                 * ⛔⛔ **THE TAG BUDGET IS COUNTED BEFORE IT IS SPENT** (D5).
                 * `placementTagId` REFUSES BY THROWING when all 30 slots are
                 * taken, and a throw here would read as a broken room builder;
                 * the honest answer is a graded refusal that says how many were
                 * wanted and how many were left. ⛓ THE COST MODEL, in one
                 * sentence: **one tag per KEY GROUP — one for the `buttonroom`
                 * that latches it and ONE SHARED BY ALL OF THAT GROUP'S LOCKS —
                 * plus the guard's three when one is placed, plus the goal's 0.**
                 * (Why the locks may share: `ButtonRoom`'s local publish LATCHES
                 * the group — the author's own *"Can't be reset to false!!"* —
                 * so every lock of one group transitions ONCE, together, and
                 * each writes `Game.setPersistence(tag, false)` idempotently;
                 * `returnToNormal`'s TRUE write is unreachable for a latched
                 * group. Why they may not go UNTAGGED: `tagOf` answers -1 for a
                 * missing attribute and `Lock.turnOff()` writes its tag
                 * unconditionally, so an untagged lock clears `(level-1, 29)` —
                 * an out-of-band write into the PREVIOUS level's last slot.)
                 */
                const guardBound = (sym) => (elementInfo.ran && declaredAreas.length > 0
                    && graph.areas[declaredAreas[0].id]?.item === sym);
                const wanted = graph.symbols.reduce((n, sym) => n + (guardBound(sym) ? 0 : 2), 0);
                const usedNow = new Set(taken);
                for (const e of recordSoFar.entities ?? []) {
                    const t = tagOf(e.type, e.attrs);
                    if (t >= 0) usedNow.add(t);
                }
                if (usedNow.size + wanted > TAGS_PER_LEVEL) {
                    areaInfo = refuseArea('the-tag-budget-is-exceeded',
                        `this level already uses ${usedNow.size} of ${TAGS_PER_LEVEL} `
                        + `persistence tags and the area graph wants ${wanted} more (one `
                        + `\`buttonroom\` and one shared lock slot per key group, over `
                        + `${graph.symbols.length} symbol(s)). ⛔ Refused by NAME rather than `
                        + 'wrapped: `Game.tagsPerLevel` is 30 and the game indexes one flat '
                        + 'array as `level * 30 + tag` with NO bounds check, so a 31st tag '
                        + 'writes the NEXT level\'s first slot — and a modulo would collide '
                        + 'two placements silently, which is the defect the allocator exists '
                        + 'to end.');
                } else {
                    let refusal = null;
                    for (const sym of graph.symbols) {
                        const areaId = Object.keys(graph.areas)
                            .find((id) => graph.areas[id].item === sym);
                        if (areaId === undefined) {
                            refusal = { reason: 'no-area-holds-this-symbol',
                                detail: `the graph declares ${sym} but no area carries it.` };
                            break;
                        }
                        const area = partition.areas.find((a) => a.id === areaId);
                        /**
                         * ⛓⛓⛓ **D4 — THE GUARD'S `buttonroom` IS THE FLAG, AND
                         * SLICE 3's `flagLockCellFor` PLACEHOLDER IS SUPERSEDED.**
                         *
                         * At `binds=item` the gadget's area is the only one with
                         * `capacity.item`, so the graph puts K0 there — and the
                         * gadget ALREADY holds a `buttonroom` at a cell chosen by
                         * the rule that matters (one step BEYOND the guard door,
                         * never drawn, arc-2 §10.4). ⇒ the binding does not add a
                         * second flag; it ADOPTS the guard's, group and tag.
                         *
                         * ⛔ AND THE FLAG'S LOCK **MOVES** RATHER THAN
                         * DISAPPEARING: slice 3 put ONE `lock {tset:B}` on a
                         * main-path cut cell chosen by `flagLockCellFor` (its own
                         * docblock calls itself *"the placeholder that made the
                         * flag testable before the area graph exists"*, and ⚖
                         * hands WHICH CELL to this slice). The same group and the
                         * same tag now sit on EVERY BOUNDARY CELL of the area the
                         * flag really opens. One mechanism, one group, one tag —
                         * a cut the room's own shape defines instead of a single
                         * line across the main path.
                         */
                        if (guardBound(sym)) {
                            const p = elementInfo.placed[0];
                            symbolGroup.set(sym, p.groups.B);
                            symbolFlagTag.set(sym, p.tags.flag);
                            symbolLockTag.set(sym, p.tags.lockB);
                            supersededFlagLock = { x: p.flagLockCell.x, y: p.flagLockCell.y };
                            flags.push(Object.freeze({ symbol: sym, area: areaId,
                                x: p.flagCell.x, y: p.flagCell.y, guarded: true }));
                            continue;
                        }
                        const free = freeCellsOf(area);
                        if (free.length === 0) {
                            refusal = { reason: 'the-flag-area-has-no-cell-that-can-hold-it',
                                detail: `${sym} belongs in area ${areaId}, whose `
                                    + `${area.cells.length} cell(s) are all boundary cells `
                                    + '(where its own locks go), the START or the GOAL. A flag '
                                    + 'under its own lock is a flag nobody can reach.' };
                            break;
                        }
                        const at = roomRng.pick(free);
                        symbolGroup.set(sym, placementGroupId({ tx: at.x, ty: at.y }, d.height));
                        symbolFlagTag.set(sym, takeTag());
                        symbolLockTag.set(sym, takeTag());
                        flags.push(Object.freeze({ symbol: sym, area: areaId,
                            x: at.x, y: at.y, guarded: false }));
                    }
                    if (refusal) {
                        areaInfo = refuseArea(refusal.reason, refusal.detail);
                    } else {
                    const locks = [];
                    for (const area of partition.areas) {
                        const level = graph.areas[area.id]?.keyLevel ?? 0;
                        if (level < 1) continue;
                        const sym = `K${level - 1}`;
                        if (!symbolGroup.has(sym)) continue;
                        for (const c of area.boundary) {
                            locks.push(Object.freeze({ symbol: sym, area: area.id,
                                x: c.x, y: c.y, level }));
                        }
                    }
                    /**
                     * ⛔⛔ **TRAP 348 ON THE LOCK CELLS — A REFUSAL BY NAME, AND
                     * NEVER A SKIPPED CELL.** A lock at graph distance < 2 from
                     * the goal breaks the COLLECT ceremony's approach sweep
                     * (§10.6(c)'s measured sentence). ⛔ The wrong fix is to drop
                     * that boundary cell: a skipped boundary cell is a HOLE IN
                     * THE CUT, and the level-n flood two paragraphs down would
                     * then report it — correctly — as the graph lying about where
                     * the ways in are. So the whole graph refuses, and the level
                     * ships carved.
                     *
                     * ⚠ It can only fire for a REAL area whose boundary reaches
                     * the goal's doorstep; the SYNTHETIC goal area is grown into
                     * a VESTIBULE of radius 2 above precisely so that it cannot.
                     */
                    const near = vestibuleCellsAround({ width: d.width, height: d.height,
                        walkable: areaGround, goal: { x: goalCell.tx, y: goalCell.ty },
                        radius: LOCK_MIN_FROM_GOAL - 1, exclude: [] });
                    const nearKeys = new Set(near.map((c) => `${c.x},${c.y}`));
                    const doorstep = locks.find((l) => nearKeys.has(`${l.x},${l.y}`));

                    /**
                     * ⛓⛓⛓ SLICE 5b (D2) — **THE REALISATION'S PAINTABLES, BUILT
                     * ONCE AND EMITTED ON EVERY EXIT.** ⛔ A refused realisation
                     * used to write NO ROW at all, so the one picture a reader
                     * most wants — *which level-n flood disagreed, and where* —
                     * did not exist. Trap 386's shape: WHICH phase refuses is a
                     * finding, and a phase that refuses silently cannot report
                     * one. The row now exists on all three exits and carries the
                     * refusal by name.
                     */
                    const realisationFacts = (levelSets = null) => [
                        locks.length > 0 && paintable({
                            id: 'area-locks',
                            label: `${locks.length} LOCK(s) — every boundary cell of every `
                                + 'locked area',
                            kind: 'outline',
                            cells: locks,
                        }),
                        flags.length > 0 && paintable({
                            id: 'area-flags',
                            label: `${flags.length} FLAG(s) — what opens them`,
                            kind: 'outline',
                            cells: flags,
                        }),
                        goalVestibuleCells?.length && paintable({
                            id: 'goal-vestibule',
                            label: `the GOAL's VESTIBULE — ${goalVestibuleCells.length} cell(s) `
                                + `within ${GOAL_VESTIBULE_RADIUS} step(s) of the goal, grown `
                                + 'into a SYNTHETIC area so that no lock can land on the '
                                + 'goal\'s doorstep (trap 348)',
                            kind: 'outline',
                            cells: goalVestibuleCells,
                        }),
                        ...(levelSets?.levels ?? []).map((lv) => paintable({
                            id: `level-${lv.level}-reach`,
                            label: `at key level ${lv.level} the entrance reaches `
                                + `${lv.reached.length} floor cell(s); the partition says it `
                                + `should reach ${lv.expected.length}`,
                            kind: 'flood',
                            cells: lv.reached.map(cellOfKey),
                            note: lv.reached.length === lv.expected.length ? null
                                : 'these two numbers DISAGREE — this level is the refusal',
                        })),
                    ];

                    if (doorstep) {
                        ledger.phase('realisation', {
                            sentence: 'the REALISATION REFUSED: a lock landed on the GOAL\'s '
                                + `doorstep — area ${doorstep.area}'s boundary cell `
                                + `(${doorstep.x},${doorstep.y}) is within `
                                + `${LOCK_MIN_FROM_GOAL} cell(s) of the goal`,
                            draws: roomRng.draws,
                            refusal: { reason: 'a-lock-on-the-goals-doorstep',
                                detail: `(${doorstep.x},${doorstep.y}), area ${doorstep.area}, `
                                    + `key level ${doorstep.level}` },
                            data: { locks: locks.length, flags: flags.length },
                            facts: [
                                ...realisationFacts(),
                                paintable({
                                    id: 'goal-doorstep',
                                    label: `the ${near.length} cell(s) NO lock may stand on — `
                                        + `within ${LOCK_MIN_FROM_GOAL - 1} step(s) of the goal`,
                                    kind: 'outline',
                                    cells: near,
                                    pick: { x: doorstep.x, y: doorstep.y },
                                }),
                            ],
                        });
                        areaInfo = refuseArea('a-lock-on-the-goals-doorstep',
                            `area ${doorstep.area} is at key level ${doorstep.level}, so every `
                            + `one of its ${partition.areas.find((a) => a.id === doorstep.area)
                                .boundary.length} boundary cell(s) takes a lock — and `
                            + `(${doorstep.x},${doorstep.y}) is within `
                            + `${LOCK_MIN_FROM_GOAL} cell(s) of the GOAL (${goalCell.tx},`
                            + `${goalCell.ty}). ⛔ Trap 348: a lock on the goal's doorstep `
                            + 'breaks the COLLECT ceremony\'s approach sweep — *"approaching '
                            + 'torchpickup, the sweep was blocked by lock"* — and the level '
                            + 'would be unsolvable for a reason nobody would attribute to the '
                            + 'area graph. ⛔ The cell is NOT skipped: a skipped boundary cell '
                            + 'is a hole in the cut.');
                    } else {
                        /**
                         * ⛓⛓ **THE DOOR LAW, ASKED ON THE WHOLE SET, ONCE PER
                         * SYMBOL** — slice 2's `doorLawRefusal`, which is the
                         * Seedling voice of arc-1's *"sealed at the boundary"*.
                         * ⛔ Grouped by SYMBOL and not by AREA: two areas at one
                         * key level are opened by ONE flag, and walling only one
                         * of them would ask whether half a cut is a cut.
                         */
                        const bySymbol = new Map();
                        for (const l of locks) {
                            if (!bySymbol.has(l.symbol)) bySymbol.set(l.symbol, []);
                            bySymbol.get(l.symbol).push(l);
                        }
                        let lawRefusal = null;
                        for (const [sym, ls] of bySymbol) {
                            const flag = flags.find((f) => f.symbol === sym);
                            const text = doorLawRefusal({
                                width: d.width,
                                height: d.height,
                                walkableFor: (walled) => walkableWith(base, new Map(), walled),
                                start: { x: d.start.tx, y: d.start.ty },
                                goal: { x: goalCell.tx, y: goalCell.ty },
                                doorKeys: new Set(ls.map((l) => `${l.x},${l.y}`)),
                                clearerKeys: flag ? [`${flag.x},${flag.y}`] : [],
                                name: `the area lock ${sym}`,
                                askOpenHalf: true,
                            });
                            if (text) {
                                lawRefusal = { reason: 'the-area-locks-do-not-cut-the-level',
                                    detail: text };
                                break;
                            }
                        }
                        /**
                         * ⛓⛓⛓ **THE LEVEL-n FLOOD** (arc-1 §9.4, lifted with the
                         * partition): with every lock of level > n treated as
                         * wall, the entrance reaches EXACTLY the areas of level
                         * <= n plus their corridors. ⚠ A claim about TERRAIN AND
                         * LOCKS at an assumed inventory — whether the flags can
                         * be pressed IN ORDER is the ORACLE's question, and the
                         * certification solve is what asks it.
                         */
                        const levelAt = new Map(locks.map((l) => [`${l.x},${l.y}`, l.level]));
                        /** ⛓ SLICE 5b (D2) — the sink; `null` off the recording arm. */
                        const levelSets = recordLedger ? {} : null;
                        const mismatch = lawRefusal ? null : verifyAreaLevels({
                            width: d.width,
                            height: d.height,
                            isFloor: areaGround,
                            entrance: { x: d.start.tx, y: d.start.ty },
                            partition,
                            levelOfArea: (id) => graph.areas[id]?.keyLevel ?? 0,
                            doorLevelAt: (x, y) => levelAt.get(`${x},${y}`) ?? null,
                            sets: levelSets,
                        });
                        if (lawRefusal || mismatch) {
                            ledger.phase('realisation', {
                                sentence: `the REALISATION REFUSED after putting `
                                    + `${locks.length} LOCK(s) and ${flags.length} FLAG(s): `
                                    + (lawRefusal ? lawRefusal.detail : mismatch.detail),
                                draws: roomRng.draws,
                                refusal: lawRefusal
                                    ? { reason: lawRefusal.reason, detail: lawRefusal.detail }
                                    : { reason: 'the-level-flood-disagrees-with-the-partition',
                                        detail: mismatch.detail },
                                data: { locks: locks.length,
                                    flags: flags.length,
                                    level: mismatch?.level ?? null },
                                facts: realisationFacts(levelSets),
                            });
                            areaInfo = refuseArea(
                                lawRefusal ? lawRefusal.reason
                                    : 'the-level-flood-disagrees-with-the-partition',
                                lawRefusal ? lawRefusal.detail : mismatch.detail,
                                lawRefusal ? {} : { level: mismatch.level,
                                    missing: mismatch.missing, extra: mismatch.extra });
                        } else {
                            areaEntities = Object.freeze([
                                ...flags.filter((f) => !f.guarded).map((f) => Object.freeze({
                                    type: 'buttonroom', ...oelAtTile(f.x, f.y),
                                    attrs: Object.freeze({ tset: String(symbolGroup.get(f.symbol)),
                                        tag: String(symbolFlagTag.get(f.symbol)),
                                        flip: '0', room: '-1' }),
                                })),
                                ...locks.map((l) => Object.freeze({
                                    type: 'lock', ...oelAtTile(l.x, l.y),
                                    attrs: Object.freeze({ tset: String(symbolGroup.get(l.symbol)),
                                        tag: String(symbolLockTag.get(l.symbol)) }),
                                })),
                            ]);
                            if (supersededFlagLock) {
                                elementEntities = Object.freeze(elementEntities.filter(
                                    (e) => !(e.type === 'lock'
                                        && Math.floor(e.x / TILE_SIZE) === supersededFlagLock.x
                                        && Math.floor(e.y / TILE_SIZE) === supersededFlagLock.y),
                                ));
                            }
                            ledger.phase('realisation', {
                                sentence: `the REALISATION put ${locks.length} LOCK(s) on `
                                    + 'every boundary cell of every area at key level >= 1, and '
                                    + `${flags.length} FLAG(s) `
                                    + `${flags.map((f) => `${f.symbol}@(${f.x},${f.y})`
                                        + `${f.guarded ? ' GUARDED by the element' : ''}`)
                                        .join(' ')}`
                                    + (supersededFlagLock
                                        ? `; the element's own flag-lock at `
                                            + `(${supersededFlagLock.x},`
                                            + `${supersededFlagLock.y}) was SUPERSEDED`
                                        : ''),
                                draws: roomRng.draws,
                                record: base,
                                entities: [goalEntity, ...elementEntities, ...areaEntities],
                                data: {
                                    locks: locks.length,
                                    flags: flags.length,
                                    supersededFlagLock,
                                },
                                facts: realisationFacts(levelSets),
                            });
                            areaInfo = Object.freeze({
                                spec: areaSpecNorm,
                                ran: true,
                                calledModule: true,
                                partitionSummary: summary,
                                partition,
                                graph,
                                locks: Object.freeze(locks),
                                flags: Object.freeze(flags),
                                groups: Object.freeze(Object.fromEntries(symbolGroup)),
                                tags: Object.freeze(Object.fromEntries(
                                    [...symbolFlagTag].map(([s, t]) => [s,
                                        { flag: t, lock: symbolLockTag.get(s) }]))),
                                supersededFlagLock: supersededFlagLock
                                    ? Object.freeze({ ...supersededFlagLock }) : null,
                                refused: null,
                            });
                        }
                    }
                    }
                }
            }
        }
    }

    const skeleton = () => withEntities(base, [{
        type: d.goalClass, ...goalOel, attrs: { tag: d.goalTag },
    }, ...elementEntities, ...areaEntities]);

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
    /**
     * ⛓⛓ **A CELL THE ELEMENT OWNS IS NOT PASS 2's** — PROCGEN ELEMENTS arc 3,
     * slice 3. The reserved rectangle (site + its ring) and the connector tunnel
     * are the geometry the gadget's own certification is about, and a template
     * that painted any of it would break a puzzle the level was BUILT AROUND
     * (⚖ design ruling 2: elements first, connectors and decorators after).
     *
     * ⛔ IT IS ASKED IN BOTH LEGALITY RULES, because neither alone covers it:
     * `freeRefusal`'s untouched-`ground` test would let a wall segment land in
     * the push lane, and `carveCellRefusal`'s untouched-SKELETON test would let a
     * pocket be CARVED out of the ring (in `base` the ring IS wall, so the
     * comparison passes). ⛓ AND AT `--elements=none` THE SET IS EMPTY, so this
     * is a code path that returns `null` on its first line rather than a
     * comparison that happens to pass — which is what keeps every committed pair
     * byte-identical.
     */
    const elementRefusalAt = (tx, ty, writing = null) => {
        if (!elementCells.has(`${tx},${ty}`)) {
            /**
             * ⛓⛓⛓ **THE ELEMENT'S `demand` — arc 3, slice 4d (D3), AND IT IS
             * THE SECOND QUESTION THIS FUNCTION ASKS.**
             *
             * A demanded cell is NOT owned: pass 2 may put an entity on it and
             * may carve it to ground. What it may not do is write a terrain the
             * element's claim forbids — for the kill gate, anything that is not
             * `floor` inside the BODY'S REGION (water and a pit KILL the
             * spinner; a wall would change where it goes), and anything that is
             * not `wall` on the walls that keep the body in that region (a
             * CARVE there would let it out of the set the demand was computed
             * on).
             *
             * ⛔ THE PROBLEM IS MEASURED, NOT SUPPOSED. Over 224 cells, ten kill
             * gates certified and all ten had their lock cleared — **two of them
             * by `water`**, i.e. a gate that opened because pass-2 furniture
             * DROWNED its spinner rather than because anybody swung a sword. The
             * predictor was exact: lethal terrain inside the body's own stepped
             * path ⟺ `cause:'water'`, 2 for 2 both ways.
             *
             * ⛔ IT NEEDS THE INTENDED TERRAIN, which is why this function grew
             * an argument. `freeRefusal` and `carveCellRefusal` are asked about
             * a CELL; a demand is about what would be WRITTEN there. A caller
             * that does not know (the page's click, `isFree`) passes nothing and
             * gets `null` — correctly: the cell really is free for an entity or
             * for a ground write.
             */
            const must = elementDemand.get(`${tx},${ty}`);
            if (!must || writing === null || writing === must) return null;
            const p = elementInfo.placed[0];
            return `(${tx},${ty}) is DEMANDED \`${must}\` by the ELEMENT ${p.instance} and `
                + `this writes \`${writing}\`. ⛔ It is not the element's cell — pass 2 may `
                + 'stand on it — but it is inside the region the element\'s BODY moves in, '
                + 'or one of the walls that keeps the body there. A pool or a pit in that '
                + 'region '
                + 'DROWNS the body, and a kill lock whose enemy drowned opens for a reason the '
                + 'level did not pose — measured at 2 of 10 certified kill gates before this '
                + 'demand existed. A carve on the boundary would let the body out of the '
                + 'region the demand was computed on.';
        }
        const p = elementInfo.placed[0];
        /**
         * ⛓ AN `on-connector` ELEMENT OWNS CELLS, NOT A RECTANGLE — the door,
         * its clearer, the wall it grew and the cell it carved. The sentence
         * names those rather than a site it does not have.
         */
        if (p.phase === PHASE_ON_CONNECTOR) {
            return `(${tx},${ty}) belongs to the ELEMENT ${p.instance} — its door cell `
                + `(${p.doorCell.x},${p.doorCell.y}), its ${p.clearer.length} clearer cell(s), `
                + `the ${p.wall.length} cell(s) of wall it GREW and the ${p.carved.length} it `
                + 'CARVED. ⛔ An element is placed FIRST and the level is built AROUND it '
                + '(⚖ design ruling 2), so pass 2 may not paint, carve or occupy any of it: '
                + 'the door is a CUT of this room, and a template that walled the clearer or '
                + 'opened a way round the door would break the puzzle the level exists to pose.';
        }
        return `(${tx},${ty}) belongs to the ELEMENT ${p.instance} — its reserved rectangle `
            + `(${p.site.w + 2}x${p.site.h + 2} at (${p.site.x - 1},${p.site.y - 1})) or the `
            + `${p.tunnel.length}-cell tunnel that joins its entry mouth. ⛔ An element is `
            + 'placed FIRST and the level is built AROUND it (⚖ design ruling 2), so pass 2 '
            + 'may not paint, carve or occupy any of it: the gadget\'s door is a CUT of this '
            + 'room, and a template that opened the ring or walled the push lane would break '
            + 'the puzzle the level exists to pose.';
    };

    const freeRefusal = (record, tx, ty, writing = null) => {
        if (!(tx > 0 && ty > 0 && tx < record.width - 1 && ty < record.height - 1)) {
            return `(${tx},${ty}) is not in the room's INTERIOR — the border ring is wall, so `
                + `the placeable cells are (1,1) to (${record.width - 2},${record.height - 2}).`;
        }
        const claimed = elementRefusalAt(tx, ty, writing);
        if (claimed) return claimed;
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
     * ⛓⛓⛓ **THE SITES — PROCGEN ELEMENTS arc 3, slice 1, DERIVED ONCE, BESIDE
     * THE CARVE.**
     *
     * ⛔ HERE AND NOT IN `skeleton()`, for the carve's own reason one line up:
     * `skeleton()` is called more than once and this is a property of the room
     * the carve built, not of each call. ⛓ AND IT SPENDS NO DRAW — every class
     * is read off the tiles — so adding it moves no level from any seed. The
     * gate for that claim is the `empty` pairs md5, not this sentence.
     *
     * ⛔ IT IS DERIVED FROM THE **SKELETON**, NOT FROM THE RECORD PASS 2 IS
     * BUILDING. A template placed at step 4 has painted walls the skeleton did
     * not have, and re-deriving per step would make the class a function of the
     * rejection history — the shape `placementGroupId`'s docblock rejects three
     * times over. Legality is what accounts for a cell an earlier template
     * took; the site says what kind of place the ROOM offers.
     *
     * ⛓ THE CONVERSION HAPPENS HERE AND NOWHERE ELSE (§9.2's rule, carried
     * whole): `procgenCore/` speaks `{x,y}` because a grid is the vocabulary
     * both substrates share, and Seedling anchors are `{tx,ty}`.
     *
     * ── ⛔⛔ DERIVED ON FIRST USE, MEMOIZED — **AND THAT IS A COST FIX, NOT A
     *    SEMANTIC ONE** ────────────────────────────────────────────────
     *
     * ⛓ MEASURED, and the first draft was wrong: deriving eagerly here made
     * `seedlingModel` construction **0.039 ms → 2.819 ms on `empty`, 72x**,
     * because `procgenLevel.terrainAt` is a linear scan of the tiles layer
     * (5.8 µs a call) and this model is constructed by nearly every test in the
     * suite. `deriveSites` now reads the predicate exactly once per cell, and
     * this closure defers the whole thing until somebody ASKS.
     *
     * ⛔ LAZINESS CANNOT CHANGE THE ANSWER, and that is why it is safe: the
     * closure captures `base` — the SKELETON, which is finished before this
     * line runs and is never mutated (`withTerrain`/`withEntities` are pure) —
     * so the derivation reads the same tiles whenever it happens, and it still
     * spends NO DRAW. ⚠ It is emphatically NOT derived from the record pass 2
     * is building; see `anchorsFor`.
     */
    const toTiles = (cells) => Object.freeze(cells.map((c) => Object.freeze({
        tx: c.x, ty: c.y,
    })));
    let sitesMemo = null;
    const sitesOf = () => {
        if (sitesMemo) return sitesMemo;
        const g = deriveSites(d.width, d.height,
            (x, y) => terrainAt(base, x, y) === 'ground',
            { from: { x: d.start.tx, y: d.start.ty }, to: { x: goalCell.tx, y: goalCell.ty } });
        sitesMemo = Object.freeze({
            main: toTiles(g.main),
            bend: toTiles(g.bend),
            branch: Object.freeze(g.branch.map((b) => Object.freeze({
                mouth: Object.freeze({ tx: b.mouth.x, ty: b.mouth.y }),
                dir: b.dir,
                length: b.length,
                cells: toTiles(b.cells),
            }))),
            tip: toTiles(g.tip),
            chamber: toTiles(g.chamber),
            chambers: Object.freeze(g.chambers.map((c) => Object.freeze({
                cells: toTiles(c.cells),
            }))),
            corridor: toTiles(g.corridor),
        });
        return sitesMemo;
    };

    /**
     * ⛓⛓⛓ **WHY THIS ANCHOR IS REFUSED — `null` when it is not** (slice 6).
     *
     * The rules in the order `legalAt` has always asked them, each answering in
     * the MODEL'S OWN WORDS. ⛔ THE ORDER IS PART OF THE ANSWER, and arc 3 slice
     * 2 states it in full: **footprint/clearance → CARVE legality → SEAL → the
     * DOOR LAW (cut, then start-side)**.
     *
     * ⚠ The footprint walk stays FIRST, and its reason SURVIVED the rule that
     * used to need it. `doorClear` refused BY THROWING for an anchor north-west
     * of the start, so the walk had to reject off-interior cells before it ran;
     * the door law reads the flood and has no such domain. The walk is still
     * first because a FLOOD handed writes outside the rectangle would read
     * `terrainAt` past the room (trap 255's own claim, restated on its real
     * cause), and `procgenSeedlingPrecheck.test.js` drives it on a border cell.
     *
     * ⛓ THE CARVE SITS SECOND — between the per-cell walk and the floods —
     * because it is the rule about the cells the walk just accepted, and a
     * reader who wrote a two-mouth pocket wants to hear about the pocket rather
     * than about the room's connectivity.
     *
     * ⚠ IT NAMES THE OFFENDING CELL AND WHICH PART OF THE TEMPLATE WANTED IT.
     * A footprint cell and a `clearance` cell are refused for the same reason
     * and mean different things: the first is the obstacle, the second is the
     * room its clearer needs (the S1 guard), and a reader who moved the anchor
     * one cell has to know which they were fighting.
     */
    /**
     * ⛓⛓⛓ **THE CONNECTIVITY PRE-CHECK** — CONSTRUCTIVE-MODE slice 6, §3.6
     * item 2, and the Seedling half of a rule both bindings run over ONE flood
     * (`procgenCore/gridFlood.js`; the maze's half is `procgenMaze.sealRefusal`).
     *
     * *A candidate whose TERRAIN writes disconnect the start from the goal is
     * refused BY NAME, before any solve.*
     *
     * ── ⛓⛓ THE MEASUREMENT THAT BOUGHT IT (the BEFORE yield table) ────
     *
     * ⚖ Kickoff §5: *measure before you build.* `sweep-yield-table.mjs` over
     * the seven kinds this binding offers, seeds 1..8 at count 3 / tries 4,
     * counted **64 REVERTED candidates on the CARVED kinds whose refusal was
     * one sentence** — `solverBot(procgen-l900): no corridor for goal
     * collect-placement…`, i.e. the walk could not reach the torch at all. The
     * pre-check turns exactly those into an instant, named refusal; the anchor
     * is never offered, so no solve is spent on it. Measured AFTER: **64 → 0**,
     * and the sweep's total solve count fell 297 → 235.
     *
     * ⚠⚠ AND IT DID **NOT** BUY THE HEADLINE COST BACK, WHICH IS THE FINDING
     * SLICE 6 CARRIED FORWARD. The worst single solve in that sweep — 77.8 s on
     * `bushy` seed 5 — was an **`arrow-lane`** refusal (*"the combat ladder is
     * E…"*), and an arrow lane writes NO TERRAIN AT ALL. Probe 2 (§2.4)
     * attributed the corridor's cost to sealing candidates; at those bounds the
     * dominant cost was an ENTITY template this rule cannot touch and must not.
     *
     * ⛓⛓ **DISCHARGED BY REMOVAL, NOT BY A FIX** (PROCGEN ELEMENTS arc 3, slice
     * 1; ⚖ design ruling 9). `arrow-lane` LEFT THE PALETTE — it was a
     * pre-sword-puzzle element and the generator has no use for one — and the
     * tail went with it: the same sweep in the same tree measured **MAX single
     * solve 70,784 ms before and 850 ms after — 83x** (and total generation
     * wall time 116.4 s → 32.8 s). ⛔ Nothing about this rule changed; the
     * cost was never connectivity's to buy, which is what slice 6 said and what
     * the removal confirms from the other side.
     *
     * ── ⛔ WHAT BLOCKS, AND WHY IT IS `ground` AND NOTHING ELSE ────────
     *
     * `wall`, `water` and `pit` ALL block. Wall is `world.solids`; water lands
     * in `world.lethalTerrainTiles` and pit in `world.pitTiles`
     * (`procgenLevel.TERRAIN`'s own docblock names both tables) — lethal
     * terrain the corridor planner prices as impassable, so a ROUTE cannot
     * cross either. ⛔ `ground` is therefore the whole walkable vocabulary, and
     * a flood that let a pit through would report a sealed room as open (the
     * mutant this rule is gated against).
     *
     * ── ⛔ WHAT IT IS SOUND FOR: **FULL-TILE TERRAIN ONLY** ────────────
     *
     * ⚠ ENTITIES ARE IGNORED — a block, a lock, a spinner, an arrow trap. Those
     * are the ORACLE's business: whether a pushable block can be moved out of a
     * corridor is a fact about the SEARCH, not about the grid. ⚠ And traps
     * 136/139 bound it from the other side: *a tile flood under-approximates a
     * player smaller than a tile* and *the grid rounds a sub-tile obstacle*.
     * Neither applies to a TERRAIN write, which fills its cell exactly — which
     * is precisely why the rule is scoped to terrain and refuses to grow.
     *
     * ⇒ NECESSARY, never sufficient: sealed ⇒ certainly unsolvable ⇒ refuse;
     * not sealed ⇒ nothing is claimed and the oracle still decides.
     *
     * ── ⚖ EVERY KIND, `empty` INCLUDED — THE SCOPE IS GONE (slice 6b) ─
     *
     * Slice 6 shipped this rule KIND-SCOPED (§6.2's named default: OFF at
     * `empty`, where every committed seed→level pair lives) and MEASURED what
     * widening would cost — **22 of the 80 `empty` seed→level pairs** (seeds
     * 1..40 × both palettes at count 3). ⚖ **THE USER RULED, 2026-08-15**, in
     * the PROCGEN ELEMENTS design session: widen it to EVERY kind. GENERATE-UI
     * ruling 5 licenses exactly that expiry (*"it's not a problem if the seed
     * level pairs expire"*). Slice 6b dropped the scope and re-recorded the 22
     * rows; ⛔ the soundness argument above is UNCHANGED and now global — it
     * never mentioned the skeleton, because a sealed room is unsolvable however
     * its walls got there.
     *
     * ⛔ WHY AN OPEN ROOM CAN SEAL AT ALL — the thing slice 6's own fixture got
     * wrong. **Never from a FRESH skeleton**: no single wave-1 row spans the
     * 8×8 interior of this 10×10 room, which is why *"the `empty` room never
     * seals"* stayed green against the very mutant that drops this scope (§13.6
     * B — `feedback_fixture_must_discriminate_two_builds` in one measurement).
     * The seal appears once pass 2 has **ACCUMULATED** terrain: a pool and a
     * segment later, one more segment closes the last route. That is the whole
     * reason 22 pairs move and 58 do not, and it is why the fixture for this
     * rule at `empty` is an ACCUMULATED record and not a skeleton.
     */
    const sealRefusal = (record, template, tx, ty) => {
        const painted = paintedOf(template, tx, ty);
        const blocking = [...painted.values()].filter((t) => t !== 'ground').length;
        // ⛔ A candidate that paints no blocking terrain cannot seal anything —
        // painting `ground` only ever ADDS walkable cells.
        if (blocking === 0) return null;
        const walkable = walkableWith(record, painted);
        if (connected(record.width, record.height, walkable,
            { x: d.start.tx, y: d.start.ty },
            { x: goalCell.tx, y: goalCell.ty })) return null;
        return `"${template.instance ?? template.name}" at (${tx},${ty}): its TERRAIN would `
            + `SEAL the room — no ground path from the START (${d.start.tx},${d.start.ty}) to `
            + `the GOAL (${goalCell.tx},${goalCell.ty}) once the ${blocking} `
            + 'wall/water/pit cell(s) it writes are painted. ⛔ The flood reads TERRAIN only; '
            + 'entities are the ORACLE\'s question, so a block or a lock is never a wall '
            + 'here. Refused before any solve, at EVERY skeleton kind — this room is '
            + `"${skeletonKind}", and ⚖ slice 6b dropped the carved-only scope slice 6 `
            + 'shipped (22 of the 80 committed `empty` pairs re-recorded).';
    };

    /**
     * ⛓⛓⛓ **A CELL A TEMPLATE WRITES AS `ground` — THE CARVE'S OWN FREEDOM
     * TEST** (PROCGEN ELEMENTS arc 3, slice 2; ⚖ design ruling 17, *"templates
     * may CARVE"*).
     *
     * `freeRefusal` demands untouched **`ground`**, which is exactly right for a
     * cell a template covers with a wall, a pool, a pit or an entity: the thing
     * it must not do is paint over another template's answer. A cell a template
     * writes as `ground` is the OTHER case — it is asking for room where the
     * skeleton left none — and the honest test is one word wider:
     *
     *   **UNTOUCHED SKELETON TERRAIN** — `terrainAt(record) === terrainAt(base)`.
     *
     * ⛔ `base` IS THE MODEL'S OWN SKELETON, the record the carve built, frozen
     * before this closure existed and never mutated. ⚖ THAT IS WHY THERE IS NO
     * `skeletonMask` (kickoff §3.3 proposed one): a second structure recording
     * "which cells the carve wrote" would be a second spelling of a fact the
     * skeleton record already IS, and the two would agree until the day one of
     * them was updated.
     *
     * The three claims the comparison makes, in one line each:
     *  · terrain the CARVE left, wall or ground — `===` holds;
     *  · a cell an earlier template painted (wall, water, pit) — `!==`, refused;
     *  · a cell an earlier template CARVED (base wall, record ground) — `!==`,
     *    refused, which is the case a "is it wall?" test would have let through.
     *
     * The ring, the start and the goal are refused ahead of it, by the same two
     * claims `freeRefusal` opens with — a carve into the border ring would open
     * the room, and neither endpoint is terrain a template may re-decide.
     */
    const carveCellRefusal = (record, tx, ty) => {
        /** ⛓ A CARVE WRITES `ground`, always — which is why this caller names
         *  the terrain as a constant rather than taking it. A demanded `floor`
         *  cell is therefore never refused by a carve, and a demanded `wall` one
         *  always is: that is the boundary clause doing its job. */
        if (!(tx > 0 && ty > 0 && tx < record.width - 1 && ty < record.height - 1)) {
            return `(${tx},${ty}) is not in the room's INTERIOR — the border ring is wall, so `
                + `the placeable cells are (1,1) to (${record.width - 2},${record.height - 2}). `
                + '⛔ A CARVE may not open the ring: the ring is what makes the room a room.';
        }
        const claimed = elementRefusalAt(tx, ty, 'floor');
        if (claimed) return claimed;
        if (reserved.has(`${tx},${ty}`)) {
            const which = tx === d.start.tx && ty === d.start.ty ? 'START' : 'GOAL';
            return `(${tx},${ty}) is the ${which} cell, whose terrain is not a template's to `
                + 're-decide — a carve there would build a room whose refusal is about '
                + 'GEOMETRY rather than about the template.';
        }
        const here = terrainAt(record, tx, ty);
        const skel = terrainAt(base, tx, ty);
        if (here !== skel) {
            return `(${tx},${ty}) holds ${JSON.stringify(here)} where the SKELETON left `
                + `${JSON.stringify(skel)} — an earlier template already wrote it, and a `
                + 'carve is legal only on UNTOUCHED SKELETON TERRAIN (wall or ground, '
                + 'whichever the carve left). ⛔ Including another template\'s CARVE: a '
                + '"is it wall?" test would have let that one through.';
        }
        const held = record.entities.find((e) => Math.floor(e.x / TILE_SIZE) === tx
            && Math.floor(e.y / TILE_SIZE) === ty);
        if (held) {
            return `(${tx},${ty}) already holds the entity ${held.type} at (${held.x},${held.y}).`;
        }
        return null;
    };

    /**
     * ⛓ THE TEMPLATE HALF OF THE CARVE RULE — which of this candidate's writes
     * are a CARVE (a `ground` write onto SKELETON WALL), resolved against an
     * anchor and handed to `carveLawRefusal`, which is the rule itself and lives
     * at module scope because arc-3 slice 4a gave it a SECOND caller: the
     * `on-connector` elements carve too.
     */
    const carveRefusal = (record, template, tx, ty) => {
        const carved = [];
        for (const w of template.terrain ?? []) {
            if (w.terrain !== 'ground') continue;
            const x = tx + w.dx;
            const y = ty + w.dy;
            if (terrainAt(base, x, y) === 'wall') carved.push({ x, y });
        }
        const painted = paintedOf(template, tx, ty);
        return carveLawRefusal({
            width: record.width,
            height: record.height,
            carved,
            walkableAfter: walkableWith(record, painted),
            walkableBefore: walkableWith(record, new Map()),
            start: { x: d.start.tx, y: d.start.ty },
            goal: { x: goalCell.tx, y: goalCell.ty },
            name: `"${template.instance ?? template.name}" at (${tx},${ty})`,
        });
    };

    /**
     * ⛓ THE TEMPLATE HALF OF THE DOOR LAW — the offsets resolved against an
     * anchor and handed to `doorLawRefusal`, which is the law itself and lives
     * at module scope because arc-3 slice 4a gave it a SECOND caller (the
     * `on-connector` element composite, whose cells are absolute). ⛔ Read the
     * law's own docblock for what it claims; this closure only says WHERE the
     * cells came from.
     */
    const doorRefusal = (record, template, tx, ty) => {
        if (!template.door) return null;
        const painted = paintedOf(template, tx, ty);
        return doorLawRefusal({
            width: record.width,
            height: record.height,
            walkableFor: (walled) => walkableWith(record, painted, walled),
            start: { x: d.start.tx, y: d.start.ty },
            goal: { x: goalCell.tx, y: goalCell.ty },
            doorKeys: new Set((template.doorCells ?? [])
                .map((c) => `${tx + c.dx},${ty + c.dy}`)),
            clearerKeys: (template.clearer ?? []).map((c) => `${tx + c.dx},${ty + c.dy}`),
            name: `"${template.instance ?? template.name}" at (${tx},${ty})`,
            /** ⛔ `sealRefusal` IS THE RULE ASKED IMMEDIATELY ABOVE, so the open
             *  half is already answered for a template and this caller does not
             *  ask it twice. See the law's own docblock. */
            askOpenHalf: false,
        });
    };

    const refusalAt = (record, template, tx, ty) => {
        /**
         * ⛓ ARC 3 SLICE 2 — a FOOTPRINT cell the template writes as `ground` is
         * adjudicated by the CARVE's freedom test rather than by `freeRefusal`.
         * ⛔ FOOTPRINT ONLY: `clearance` is the room a CLEARER needs (the S1
         * guard), which must already be walkable, so it keeps the untouched-
         * `ground` demand whatever the template writes.
         */
        const groundWrites = new Set((template.terrain ?? [])
            .filter((w) => w.terrain === 'ground').map((w) => `${w.dx},${w.dy}`));
        /**
         * ⛓ WHAT THIS CANDIDATE WOULD WRITE AT EACH OFFSET (arc 3, slice 4d) —
         * the element's `demand` is about the TERRAIN, not about the cell, so
         * the adjudicator has to be told. ⛔ A footprint cell with no terrain
         * write holds an ENTITY and leaves the terrain alone; it is passed as
         * `'floor'`, because that is what the cell will still be.
         */
        const writeAt = new Map((template.terrain ?? [])
            .map((w) => [`${w.dx},${w.dy}`, w.terrain === 'ground' ? 'floor' : w.terrain]));
        for (const [part, cells] of [['FOOTPRINT', template.footprint],
            ['CLEARANCE', template.clearance ?? []]]) {
            for (const c of cells) {
                const writing = part === 'FOOTPRINT'
                    ? (writeAt.get(`${c.dx},${c.dy}`) ?? 'floor') : null;
                const why = (part === 'FOOTPRINT' && groundWrites.has(`${c.dx},${c.dy}`))
                    ? carveCellRefusal(record, tx + c.dx, ty + c.dy)
                    : freeRefusal(record, tx + c.dx, ty + c.dy, writing);
                if (why) {
                    return `"${template.instance ?? template.name}" anchored at (${tx},${ty}) `
                        + `needs ${part} cell ${why}`;
                }
            }
        }
        if (groundWrites.size > 0) {
            const carve = carveRefusal(record, template, tx, ty);
            if (carve) return carve;
        }
        /**
         * ⛓⛓ **THE PRE-CHECK SITS HERE**, and both neighbours decide the spot.
         *
         * AFTER the footprint/clearance walk — trap 255's law, restated: the
         * walk is what rejects an off-interior cell, and a flood handed writes
         * outside the room would read `terrainAt` past the rectangle. BEFORE
         * the DOOR LAW — that one is about a SPECIFIC template's mechanism (a
         * door that cuts nothing), and "the room no longer connects" is the
         * more general fact: a reader who moved the anchor wants to hear the
         * structural refusal first. ⛓ AND IT IS LOAD-BEARING for the door law
         * itself, which reads its own open half off this one rather than
         * flooding twice: *this candidate does not seal* IS *with the door
         * cells walkable, the goal is reachable*.
         *
         * ⛓ THERE USED TO BE A THIRD RULE HERE — `laneClear`, the arrow lane's
         * own — and it LEFT WITH ITS ONLY TEMPLATE (⚖ design ruling 9; the
         * measurement is on `procgenPalette.EXCLUDED_TEMPLATES`' `arrow-lane`
         * row). ⛔ A legality rule kept alive for no row is dead code wearing a
         * legality rule's name.
         */
        const sealed = sealRefusal(record, template, tx, ty);
        if (sealed) return sealed;
        return doorRefusal(record, template, tx, ty);
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
        /** ⛓ The kind that BUILT this room, and the block a payload carries. */
        skeletonKind,
        skeletonSpec: skeletonSpecNorm,
        /**
         * ⛓ THE EFFECTIVE SPEC (arc 3, slice 4b) — `chambers` explicit on the
         * five carved tree kinds, which is what the CARVE ran with. ⛔ It is
         * what a reader who asks "what room did this actually build" wants;
         * `skeletonSpec` is what a LINK and a PAYLOAD compare by, and the two
         * differ exactly when the caller left `chambers` unsaid.
         */
        skeletonEffective,
        /** What the carve actually ran — `null` at the open room. */
        carve: carved ? Object.freeze({ ...carved.carve }) : null,
        /**
         * ⛓⛓ THE ELEMENT BINDING'S WHOLE ANSWER (arc 3, slice 3) — the spec that
         * ran, whether a gadget is in this room, its record, and the graded
         * refusal BY NAME when one is not. ⛔ `certified` is NOT here: the model
         * cannot solve (the oracle takes the model), so certification lives on
         * `summary.elements[]` where `generateSeedlingLevel` puts it.
         */
        elements: elementInfo,
        /**
         * ⛓⛓ **THE AREA BINDING'S WHOLE ANSWER** (arc 3, slice 4b) — the spec
         * that ran, the partition, the graph, the locks and flags it realised,
         * and the graded refusal BY NAME when it did not run. ⛔ `certified` is
         * NOT here: the model cannot solve, so the area graph's certification
         * lives on `summary.areas` where `generateSeedlingLevel` puts it.
         */
        areas: areaInfo,
        /**
         * ⛓⛓ **THE ROOM PROBE, ON THE SURFACE** (arc 3, slice 4a) — the same
         * READ-ONLY view an `on-connector` element is handed, memoised so a
         * caller that asks twice reads one answer.
         *
         * ⛔ It is exported because the CENSUS needs to ask the elements'
         * builders directly (the pocket-preference control arm runs
         * `buildKillGate` twice on ONE room) and because slice 5's page will
         * draw the main path and the cut cells as overlays. A census that built
         * its own probe would be measuring a room the generator does not
         * generate — `feedback_code_sweep_misses_the_data`, from the instrument
         * side.
         */
        roomProbe: () => { probeMemo ??= roomProbeFor(); return probeMemo; },
        /**
         * ⛓⛓⛓ **THE GENERATION LEDGER** (arc 3, slice 5a, D3) — one frozen row
         * per phase, in the order the phases RAN, each with the tiles/entities
         * DELTA against the row before it and its own sentence.
         *
         * ⛔ **IT IS NOT ON `summary` AND THEREFORE NOT ON ANY PAYLOAD.** 4d
         * §15.13's false mover is the reason it is stated: a field that reaches
         * `certification.geometry` reaches the payload, and the acceptance
         * batch moved on five rows before anybody noticed. The ledger reaches
         * the MODEL and the seam's own return, and nothing else.
         */
        ledger: ledger.rows(),
        /**
         * ⛓⛓ **THE ELEMENT'S DEMAND, AS CELLS** (arc 3, slice 4d's region, made
         * readable in 5a). ⛔ It lives HERE and NOT on `placed`, because
         * §15.13 measured that a `demand` on the placement rides
         * `certification.geometry` into every payload that holds a kill gate.
         * The page's overlay reads this; the payload never sees it.
         */
        elementDemand: () => Object.freeze([...elementDemand].map(([k, must]) => {
            const [x, y] = k.split(',').map(Number);
            return Object.freeze({ x, y, must });
        })),
        elementSpec: elementSpecNorm,
        /**
         * ⛓ **WHICH HEAD THIS RUN ACTUALLY DREW** — the same object as
         * `elementSpec` for a bare head, and the drawn member for a `+` LIST.
         * ⛔ Its own field rather than an overwrite of `elementSpec`, because
         * "what the caller asked for" and "what the stream chose" are different
         * facts and a payload that carried only the second could not be
         * reproduced from the first.
         */
        elementHead,
        /**
         * ⛓⛓ **HOW MANY DRAWS THE ROOM STREAM SPENT** — the COUNTING instrument
         * the byte-inertness claim is really about (arc-1 §9's rule: count the
         * draws, do not compare the tiles). At `--elements=none` it is exactly
         * what it was before this slice existed, because the element branch is
         * not entered; with a gadget asked for it is strictly greater, whether the
         * gadget was placed or REFUSED — a refused element spends its draws
         * (arc-2 §10.3), and that is why `--elements=guard` at a refusing seed is
         * a different level from `--elements=none`.
         *
         * ⛔ It is read AFTER the carve, so it is the whole room's count and not
         * the element's alone; the element's own span is
         * `drawsAtConstruct - drawsBefore` on its record.
         */
        roomDraws: roomRng.draws,
        goalCell: Object.freeze({ ...goalCell }),
        goalOel: Object.freeze({ ...goalOel }),
        goals: Object.freeze([Object.freeze(collectGoal(goalOel.x, goalOel.y))]),
        boot: () => bootAtTile(blank, d.start.tx, d.start.ty),
        interiorCells,
        isFree,
        /**
         * ⛓⛓ THE SITE CLASSES THIS ROOM OFFERS (arc 3 slice 1) — CELL LISTS in
         * `{tx,ty}`, row-major, derived from the SKELETON once at construction.
         * `sites.branch` is a list of `{mouth, dir, length, cells}` stubs; every
         * other key is a flat cell list, and `sites.chambers` is the blob
         * decomposition `sites.chamber` flattens.
         */
        get sites() { return sitesOf(); },
        /**
         * ⛓⛓⛓ **THE AREA PARTITION OF THE FINISHED ROOM** (arc 3, slice 4b) —
         * `procgenCore/areaPartition.partitionAreas` over the room the
         * composites left, with the element's area DECLARED and the goal's
         * VESTIBULE grown when it needs one. ⛔ It spends NO draw, it is
         * MEMOIZED, and it is a GETTER-style closure for `sites`' own reason: a
         * model nobody asks pays nothing, and at `--areas=0` nobody asks.
         *
         * ⛔ IT IS THE **ONE** DERIVATION. The census
         * (`census-seedling-areas.mjs`), the binding below and (slice 5a) the
         * page all read this answer rather than each building their own — a
         * census that partitioned its own room would be measuring a level the
         * generator does not generate (`feedback_code_sweep_misses_the_data`,
         * from the instrument side).
         */
        areaPartition: () => areaPartitionOf(),
        /**
         * ⛓ COUNTS ONLY — what a census, a report or (later) a payload may
         * carry. ⛔ Never the cell lists: a shipped cell list is a second copy
         * of the terrain that can go stale against it, and a reader who wants
         * the cells re-derives them from the level (arc 1's rule).
         *
         * ⛔ A GETTER for the same reason `sites` is: a model nobody asks pays
         * nothing.
         */
        get siteSummary() { return siteSummaryOf(sitesOf()); },
        /**
         * ⛓ EXPOSED SO THE DOMAIN SWEEP CAN ENUMERATE LEGAL ANCHORS WITHOUT
         * RETYPING THE RULE (GENERATE-UI slice 2). `isFree` was already on this
         * surface for the same reason; `legalAt` is the whole of `refusalAt` —
         * the footprint/carve walk, the carve rule, the seal pre-check and the
         * DOOR LAW — and a sweep that re-derived any of it would be the seventh
         * copy of a retype this arc has refused. ⛔ It is the SAME function
         * `anchorsFor` calls — not an agreeing one.
         *
         * ⛓ ARC 3 SLICE 2 RETIRED `doorClear` FROM THIS SURFACE with the rule
         * itself. It was exported so a sweep could ask the door question without
         * the rest; the door question is now two floods over the record, which
         * is not a thing a caller can usefully ask about a template ALONE, and
         * `refusalAt` answers it by name.
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
         * ── ⛓⛓⛓ ARC 3 SLICE 1: **THE SHUFFLED LIST IS THE TEMPLATE'S SITE
         *    CLASS**, and at the default `'any'` it is the SAME CALL ────────
         *
         * A row that declares `site: 'chamber'` is offered the chamber cells;
         * a row that declares nothing (or `'any'`) is offered
         * `interiorCells(record)` — literally the expression this line has
         * always held, so the default is byte-inert by a code path that does
         * not change rather than by a comparison that happens to pass.
         *
         * ⛔ THIS IS NOT A LEGALITY RULE (`procgenCore/sites.js`'s law): the
         * cells offered are still walked through `legalAt`, and a DIRECTED
         * placement outside the class stays legal because `refusalAt` never
         * learns a template has a site at all.
         *
         * ⚠ THE LIST'S **LENGTH AND ORDER** ARE BOTH PART OF THE LEVEL.
         * `rng.shuffle` is Fisher-Yates and spends `n - 1` draws, so a shorter
         * class shifts every draw after it and a same-length class in a
         * different order produces a different level. That is exactly why the
         * open room's ONE chamber is emitted in `interiorCells`' own row-major
         * order: it makes an area template's `chamber` declaration byte-inert
         * at `empty` and load-bearing everywhere else (⚖ arc-3 Q1).
         *
         * @returns {Array<{tx,ty}>} up to `limit` legal anchors IN SHUFFLE
         *   ORDER; `[]` when the class is empty or the whole of it refuses.
         */
        anchorsFor(record, template, rng, limit = 1) {
            if (!Number.isInteger(limit) || limit <= 0) {
                fail(`procgenSeedling: anchorsFor needs a positive integer limit, got `
                    + `${JSON.stringify(limit)}. The bound is what the trace names `
                    + '(`anchorTriesPerCandidate`), so there is no value meaning "all".');
            }
            const offered = (template.site === undefined || template.site === 'any')
                ? interiorCells(record)
                : siteCells(sitesOf(), template.site);
            const out = [];
            for (const c of rng.shuffle(offered)) {
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
 * ⛓⛓⛓ **THE MODEL + ORACLE + THE ELEMENT'S CERTIFICATION, IN ONE PLACE** —
 * PROCGEN ELEMENTS arc 3, slice 3.
 *
 * ⛔ IT EXISTS BECAUSE THERE ARE **TWO** CALLERS AND THE SECOND ONE FOUND OUT
 * THE HARD WAY. `generateSeedlingLevel` is one; the yield table's Seedling cell
 * builds its own model and oracle so it can WRAP the oracle for timing, and a
 * private copy of the certify-then-drop dance there would be a second answer to
 * *"is this gadget certified"* — which is exactly the class of duplication this
 * arc keeps paying for. So the dance lives here once and the sweep passes
 * `wrapOracle`.
 *
 * @param {Function} [o.wrapOracle] applied to EVERY oracle this makes, including
 *   the one the certification solve runs on, so a caller counting solves counts
 *   that one too — it is a real solve of a real room.
 */
/**
 * ⛓⛓⛓ **WHY A CERTIFICATION SOLVE DID NOT CERTIFY — CLASSIFIED FROM THE
 * SOLVE'S OWN STRUCTURED FIELDS, NEVER FROM ITS PROSE.**
 *
 * ⛔ Slice 3 wrote this field as a CONSTANT, `'the-solver-does-not-chain (S1:
 * nested openers)'`, and that was honest exactly while every refusal had one
 * cause. Slice S1 gave the solver the chain, and the FIRST run of the six-arm
 * yield table under it produced a refusal that constant would have MISLABELLED:
 * `rooms` seed 4, whose sentence is *"Obstacle: pickup:torchpickup … Strategy
 * 'collect'…"* — the goal's own APPROACH is blocked (trap 348's class), which has
 * nothing to do with opener chaining. A label that survives the cause it names is
 * a label that lies.
 *
 * ⛔ AND IT KEYS ON `verdict` AND `obstacle.kind`, NOT ON THE SENTENCE. A
 * prose-keyed classifier makes a wording fix a behaviour change (trap 337); these
 * two fields are what `procgenOracle.solve` already returns as data, and
 * `reasonText` rides alongside verbatim for the reader.
 */
function certificationGap(cert) {
    if (cert.verdict === VERDICT.SOLVED) return null;
    if (cert.verdict === VERDICT.BUDGET_EXHAUSTED) {
        return `the-certification-solve-exhausted-${cert.budgetKind ?? 'a-budget'}`;
    }
    const kind = cert.obstacle?.kind ?? null;
    if (kind === 'pickup') return 'the-goal-approach-is-blocked';
    if (kind === 'proximity-hazard') return 'no-reachable-stance-and-no-prerequisite';
    if (kind === 'solid') return 'a-frontier-obstacle-with-no-usable-order';
    return 'the-certification-solve-refused';
}

/**
 * ⛓⛓⛓ **THE DEFAULT ELEMENT SPEC, BY BIOME — ONE PLACE, AND THE PLACE IS THE
 * SEAM** (PROCGEN ELEMENTS arc 3, slice 4c; ⚖ user, 2026-08-17).
 *
 * ── ⛔ WHY THIS EXISTS AT ALL ──────────────────────────────────────────
 *
 * Slice 4c RETIRED the three door TEMPLATES (`procgenPalette`'s exclusion rows
 * carry each one's measurement). Retiring them while `--elements=` still
 * defaulted to `none` would leave the DEFAULT generator with no doors at all —
 * a regression at every default seed, and the exact coupling ⚖ D5 refused to
 * execute blind. The default spec is the other half of the ruling: what the
 * templates stopped doing, the elements now do BY DEFAULT.
 *
 * ── THE SPEC ──────────────────────────────────────────────────────────
 *
 *   pre-sword   `guard;len=2+blockpocket`
 *   post-sword  `guard;len=2+killgate+blockpocket`
 *
 * ⛓ It is a `+` LIST, which is a CHOICE and not a conjunction (`elementSpec`'s
 * own law: ONE BLOCK PER LEVEL, and two of the three heads put a `pushableblock`
 * in the room). ⇒ one element per level, drawn from the set certified for this
 * biome — which is D5's proposal as measured, not a new design.
 *
 * ⛔ **`killgate` IS ABSENT PRE-SWORD BECAUSE IT WOULD BE A FREE REFUSAL**, not
 * because it is worse there: `ELEMENT_TABLE.killgate.needs = ['hasSword']` and
 * the seam refuses it for free before a solve. A pre-sword list that named it
 * would spend a third of its draws on a head that cannot certify, and the yield
 * table would be measuring the boot rather than the elements.
 *
 * ⛓ `len=2` IS A NAMED PARAMETER AND THAT IS LOAD-BEARING (`namedParams`): a
 * named parameter is an OVERRIDE that spends NO draw, an omitted one is DRAWN.
 * `len=2` is the guard size S1 certified 16 of 18 placements at (§11.8) and it
 * is stated rather than drawn so the default is ONE run and not a distribution
 * over four sizes, three of which are un-measured at this default.
 *
 * ⛔ **`none` STAYS SELECTABLE AND STAYS BYTE-INERT RELATIVE TO ITSELF.**
 * `--elements=none` runs no element machinery, spends no draw and produces the
 * same bytes it always did FOR THAT ARM. ⚠ It is NOT byte-identical to the
 * pre-4c default any more, and it never could be: the goal draw moved in the
 * same commit. That is said here because "`none` is inert" was a GATE for three
 * slices and the sentence it now makes is a weaker one.
 *
 * ── ⛔ AND THE ONE PLACE IS `seedlingSeam`, NOT `seedlingModel` ────────
 *
 * The model has no items — the boot is the SEAM's argument, which is the same
 * reason the item gate below lives here. A model asked for a default it cannot
 * name would have to be told the biome twice. ⇒ `seedlingModel({seed})` still
 * builds a bare room, and every caller that reaches a BIOME (the CLI, the sweep,
 * the batch, the pairs dump, the page's ladder) gets the default from here.
 *
 * @param {object|null} items the biome's boot flags (`palette.items`)
 */
export function defaultElementsFor(items) {
    const heads = [{ name: 'guard', params: { len: 2 } }];
    if (items?.hasSword === true) heads.push({ name: 'killgate' });
    heads.push({ name: 'blockpocket' });
    return normalizeElementSpec({ any: heads });
}

export function seedlingSeam({
    seed, items = null, budget = DEFAULT_BUDGET, defaults, skeleton = DEFAULT_SKELETON,
    elements, areas = DEFAULT_AREAS, require, wrapOracle = (o) => o,
} = {}) {
    /**
     * ⛓⛓⛓ **THE DIRECTIVE IS RESOLVED FIRST, BECAUSE IT FORCES THE HEAD**
     * (PROCGEN ELEMENTS arc 3, slice 4d, D1). `resolveRequireDirective` is the
     * ONE resolution and it lives in `elementSpec` beside the `needs` it reads;
     * this is its Seedling call site.
     *
     * ⛔ IT RUNS BEFORE THE BIOME DEFAULT, and the order is the whole point: a
     * default applied first would spend the list's `pick` and the directive
     * would then be narrowing a draw that had already happened.
     *
     * ⚠ A REFUSED DIRECTIVE STILL BUILDS A LEVEL (arc 1's rule — *a refused
     * directive shows what the run produced, labelled*): `dir.elements` is the
     * caller's own spec unchanged on every refusal, so the run below is the run
     * that would have happened, and the refusal rides out on `seam.require`.
     */
    const dir = resolveRequireDirective({ require, elements, items });
    if (dir.asked.length > 0 && !dir.refused) elements = dir.elements;
    /**
     * ⛔ `undefined` MEANS "NOBODY SAID", AND ONLY THAT REACHES THE BIOME
     * DEFAULT. An explicit `{name:'none'}` is a CHOICE and is honoured; `null`
     * keeps the model's own `?? DEFAULT_ELEMENTS` meaning (`none`), which is what
     * every caller that spells "no element" already writes.
     */
    if (elements === undefined) elements = defaultElementsFor(items);
    let model = seedlingModel({ seed, defaults, skeleton, elements, areas });
    let oracle = wrapOracle(seedlingOracle({ model, items, budget }));
    /**
     * ⛓⛓⛓ **THE CERTIFICATION SOLVE — PROCGEN ELEMENTS arc 3, slice 3 (D4), AND
     * IT IS WHERE THE ARC'S DEPENDENCY IS PUBLISHED RATHER THAN HIDDEN.**
     *
     * The element is part of the SKELETON, so the solve that certifies it is the
     * one `generateLevel` runs at step 0 — *the control that must solve before
     * any template is drawn*. ⛔ It is run HERE FIRST, before `generateLevel`,
     * for one reason: the loop's step-0 failure is a THROW (*"THE SKELETON DID
     * NOT SOLVE"*), and a solver capability this arc does not have must arrive as
     * a GRADED REFUSAL with the solve's own words, not as an exception a caller
     * reads as a broken room builder.
     *
     * ⛓⛓⛓ **SLICE S1 MADE IT CERTIFY.** ⚖ Ruling 22's chain — block on
     * `button`(A) HOLDS `lock`(A) → the player reaches `buttonroom`(B) →
     * `lock`(B)s open → collect — needed the solver to raise an order as the
     * PREREQUISITE of reaching another obstacle's stance, and slice 3 measured
     * that it could not. S1 built it (`solverBot.stancePrerequisite`,
     * `NESTED_OPENER_DEPTH`, guard (iii), the dwell arm), and the certification
     * solve now returns `SOLVED` with `['weigh','hold','collect']` on the
     * ordinary placement: 16 of 18 at `len=2` and 16 of 16 at `len=3` over the
     * yield table's own bound, with the lifted claim `true` on every one.
     *
     * ⇒ on a refusal the level is STILL regenerated with the element DROPPED —
     * the same draws spent, the composite not committed — so `--elements=guard`
     * yields a real level, the pass-2 ladder stays comparable to the `none` arm,
     * and the GEOMETRY the census measured is carried on the certification so no
     * number is lost. ⛔ Nothing here retries, relaxes a bound or widens a catch:
     * the two cells that refuse, refuse, and `certificationGap` says which kind
     * of refusal it was from the solve's own structured fields.
     */
    let certification = null;
    /**
     * ⛓⛓ SLICE 5b (D4) — **THE SOLVE'S OWN TRACE AND RECORDS, HELD FOR THE
     * LEDGER ROW AND FOR NOTHING ELSE.** ⛔ They are LOCALS and not fields on
     * `certification`: §15.13's false mover measured that a field on the
     * certification rides `geometry` into every payload, and a trace on a
     * payload would move the batch md5 for a picture. The oracle already hands
     * both back (`procgenOracle`'s SOLVED return), so no second solve and no
     * new field on the seam's return.
     */
    let certTrace = null;
    let certRecords = null;
    /**
     * ⛓⛓⛓ **THE ITEM GATE — REFUSED FOR FREE, BEFORE A SOLVE IS SPENT** (arc 3,
     * slice 4a). The kill gate is the only element in the arc a PRE-SWORD boot
     * cannot clear: `weaponForPress` returns null with no sword slot, so the
     * press is a silent no-op and the lock never opens. That is the same fact
     * `KILL_LOCK_TEMPLATES` encodes by living only in `POST_SWORD_TEMPLATES`,
     * and the element table states it as `needs` (a BINDING fact, like `binds`).
     *
     * ⛔ IT IS ASKED HERE AND NOT IN THE MODEL, because the model has no items —
     * the boot is the SEAM's argument. And it is asked BEFORE the solve because
     * spending a full solver budget to discover what the boot flags already say
     * is the cost this arc keeps refusing to pay. ⚠ The draws are still spent
     * and the element is still DROPPED by the ordinary path, so a refused
     * biome is a real level and not an error.
     */
    const needed = (ELEMENT_TABLE[model.elementHead?.name]?.needs ?? [])
        .filter((k) => items?.[k] !== true);
    if (model.elements.ran && needed.length > 0) {
        certification = Object.freeze({
            certified: false,
            verdict: null,
            classifiedBy: null,
            reasonText: null,
            ticks: null,
            strategies: Object.freeze([]),
            heldAtDoor: null,
            geometry: model.elements.placed,
            obstacle: null,
            gap: 'the-element-needs-an-item-this-biome-does-not-grant',
            needs: Object.freeze(needed),
        });
        model = seedlingModel({ seed, defaults, skeleton, elements, areas, dropElement: true });
        oracle = wrapOracle(seedlingOracle({ model, items, budget }));
    } else if (model.elements.ran) {
        const cert = oracle.solve(model.skeleton(), { templates: [] });
        certTrace = cert.trace ?? null;
        certRecords = cert.records ?? null;
        certification = Object.freeze({
            certified: cert.verdict === VERDICT.SOLVED,
            verdict: cert.verdict,
            classifiedBy: cert.classifiedBy ?? null,
            reasonText: cert.reasonText ?? null,
            ticks: cert.ticks ?? cert.ticksSpent ?? null,
            strategies: Object.freeze((cert.records ?? []).map((r) => r.strategy)),
            /** ⛓ THE LIFTED CLAIM (arc-2 §9.4, translated): a block was on
             *  `button`(A) at the tick the player FIRST entered `lock`(A)'s cell.
             *  `null` = the route never crossed the door, which is what an
             *  uncertified gadget looks like from the plan's side. */
            heldAtDoor: cert.verdict === VERDICT.SOLVED
                ? liftedClaimFor(model.elements.placed[0].element)(
                    cert, model.elements.placed[0]) : null,
            /** ⛓ THE GEOMETRY, carried across the drop so the census survives it. */
            geometry: model.elements.placed,
            /** ⛓ THE OBSTACLE THE SOLVE NAMED — structured, beside the prose. */
            obstacle: cert.obstacle ?? null,
            gap: certificationGap(cert),
        });
        if (!certification.certified) {
            model = seedlingModel({ seed, defaults, skeleton, elements, areas, dropElement: true });
            oracle = wrapOracle(seedlingOracle({ model, items, budget }));
        }
    }
    /**
     * ⛓⛓⛓ **THE AREA GRAPH'S OWN CERTIFICATION — PROCGEN ELEMENTS arc 3, slice
     * 4b (D3), AND IT IS ATTRIBUTED RATHER THAN BLAMED.**
     *
     * The locks and the flag are part of the SKELETON, so the solve that
     * certifies them is the one above — and when an element ran, that solve has
     * ALREADY seen them. What this block adds is the case the element branch
     * does not cover (a graph with no element) and, when both ran and the solve
     * failed, THE ATTRIBUTION: rebuild with `areas: {keys: 0}` and ask again.
     *
     *  · it now solves ⇒ the GRAPH is what the solver could not do. The level
     *    ships with its element and WITHOUT the graph, `areas.refused` naming
     *    `the-area-graph-does-not-certify`.
     *  · it still does not ⇒ the ELEMENT is, and the ordinary `dropElement`
     *    path above has already run.
     *
     * ⛔ THE ELEMENT SURVIVES THE GRAPH'S DROP, and that is the point of
     * rebuilding with `areas: {keys: 0}` rather than with `dropElement` (⚖ arc
     * 1: *a refused GRAPH still shows its carved level*). ⚠ THE PRICE, said
     * plainly: a level where BOTH ran and the solve fails costs up to three
     * solves. It buys an attribution nothing else in the pipeline can make, and
     * it is spent only on failure.
     */
    let areaCertification = null;
    if (model.areas.ran) {
        /**
         * ⛓ WHETHER A SOLVE HAS ALREADY SEEN THIS ROOM. The locks and the flag
         * are part of the SKELETON, so when an element ran and CERTIFIED, the
         * solve above already walked past every one of them — asking again
         * would be a second answer to one question and a second full budget.
         * When the element was DROPPED the model was rebuilt (with the graph
         * still on it) and no solve has seen the rebuild, so this one is real.
         */
        const alreadySolved = certification !== null && certification.certified;
        const cert = alreadySolved ? null
            : oracle.solve(model.skeleton(), { templates: [] });
        const solved = alreadySolved || cert.verdict === VERDICT.SOLVED;
        areaCertification = Object.freeze({
            certified: solved,
            verdict: cert?.verdict ?? (alreadySolved ? VERDICT.SOLVED : null),
            classifiedBy: cert?.classifiedBy ?? null,
            reasonText: cert?.reasonText ?? null,
            ticks: cert?.ticks ?? cert?.ticksSpent ?? null,
            strategies: Object.freeze((cert?.records ?? []).map((r) => r.strategy)),
            /** ⛓ HOW THE VERDICT WAS REACHED, because two of them are not a
             *  solve of this room: `lifted-from-the-elements-solve` means the
             *  element's own certification already crossed every lock. */
            source: alreadySolved ? 'lifted-from-the-elements-solve' : 'its-own-solve',
            /** ⛓ THE GRAPH'S OWN ANSWER, CARRIED ACROSS THE DROP so the census
             *  and the payload survive it — the rule the element's `geometry`
             *  already follows. */
            areas: model.areas,
        });
        if (!solved) {
            /**
             * ⛔ REBUILT WITH `areas: {keys: 0}` AND **NOT** WITH
             * `dropElement` — ⚖ arc 1: *a refused GRAPH still shows its carved
             * level*, and here it also still shows its ELEMENT. The element's
             * own drop is the branch above's decision and is preserved
             * verbatim; this one only takes the graph away.
             */
            model = seedlingModel({ seed, defaults, skeleton, elements,
                areas: { keys: 0 },
                dropElement: certification !== null && !certification.certified });
            oracle = wrapOracle(seedlingOracle({ model, items, budget }));
        }
    }
    /**
     * ⛓⛓⛓ **THE LEDGER'S LAST PASS-1 ROW IS THE CERTIFICATION'S** (slice 5a,
     * D3) — the seam's own phase, appended to the FINAL model's ledger.
     *
     * ⛔ THE MODEL'S LEDGER IS THE ONE THAT SHIPPED. On a refused certification
     * the model is REBUILT (with the element dropped, or with the graph taken
     * away), and `model.ledger` is that rebuild's — so the rows describe the
     * room on screen and not the one that failed. The row below is what says
     * the first one existed.
     *
     * ⛔ AND IT IS NOT ON `summary`: the ledger reaches the model and this
     * return, never a payload (4d §15.13's false mover).
     */
    const certRows = [];
    if (certification) {
        certRows.push(phaseRow({
            index: model.ledger.length,
            phase: 'certification',
            sentence: certification.certified
                ? `the CERTIFICATION solve SOLVED the skeleton-with-element in `
                    + `${certification.ticks} tick(s) via `
                    + `[${certification.strategies.join(', ')}]; the lifted claim is `
                    + `${certification.heldAtDoor}`
                : `the CERTIFICATION did NOT hold — ${certification.gap ?? certification.verdict}`
                    + `${certification.reasonText ? `: ${certification.reasonText}` : ''}. ⇒ the `
                    + 'level was regenerated WITHOUT the element (its draws were spent either '
                    + 'way), and the rows above are that rebuild\'s.',
            draws: model.roomDraws,
            refusal: certification.certified ? null
                : { reason: certification.gap ?? 'the-certification-did-not-hold',
                    detail: certification.reasonText ?? String(certification.verdict) },
            data: {
                certified: certification.certified,
                verdict: certification.verdict,
                ticks: certification.ticks,
                strategies: [...certification.strategies],
                heldAtDoor: certification.heldAtDoor,
                gap: certification.gap ?? null,
                /** ⛓ SLICE 5b (D4) — the solve's RECORDS as reader's lines, one
                 *  per record, in the order the solver made them. */
                recordLines: (certRecords ?? []).map((r, i) => `${i + 1}. ${r.goal ?? '?'}`
                    + ` — ${r.strategy ?? '(no strategy)'}${r.target ? ` (${r.target})` : ''}`),
            },
            /**
             * ⛓⛓⛓ SLICE 5b (D4) — **THE ROUTE, AND ONLY WHEN THE SOLVE HELD.**
             * ⛔ On a refusal the model is REBUILT with the element dropped and
             * `model.ledger` is that rebuild's, so a route taken through the
             * room that FAILED would be painted over a different room. The row's
             * sentence already says the rebuild happened; a picture that lied
             * about which room it belonged to would be worse than none.
             */
            facts: certification.certified
                ? [(() => {
                    const route = certificationRouteCells(certTrace);
                    if (route.cells.length < 2) return null;
                    return paintable({
                        id: 'certification-route',
                        label: `the CERTIFICATION solve's ROUTE — ${route.cells.length} cell(s) `
                            + `over ${route.rows} decision row(s) that carried a corridor`,
                        kind: 'path',
                        cells: route.cells,
                        note: route.gaps === 0 ? null
                            : `⚠ ${route.gaps} GAP(S): the trace MERGE lets a substantive `
                                + 'decision outrank a `walk` on a shared tick, so the walk to a '
                                + 'stance is never a `path` row at all (arc-3 §11.6). ⛔ The '
                                + 'holes are NOT bridged — a straight line the solver never '
                                + 'walked would be the picture inventing a route.',
                    });
                })()].filter(Boolean)
                : [],
        }));
    }
    if (areaCertification) {
        certRows.push(phaseRow({
            index: model.ledger.length + certRows.length,
            phase: 'area-certification',
            sentence: `the AREA GRAPH's certification came back `
                + `${areaCertification.certified} (${areaCertification.source})`
                + `${areaCertification.reasonText
                    ? ` — ${areaCertification.reasonText}` : ''}`,
            draws: model.roomDraws,
            refusal: areaCertification.certified ? null
                : { reason: 'the-area-graph-does-not-certify',
                    detail: areaCertification.reasonText ?? String(areaCertification.verdict) },
            data: {
                certified: areaCertification.certified,
                verdict: areaCertification.verdict,
                ticks: areaCertification.ticks,
                source: areaCertification.source,
            },
        }));
    }
    return { model,
        oracle,
        certification,
        areaCertification,
        require: dir,
        ledger: Object.freeze([...model.ledger, ...certRows]) };
}

/**
 * ⛓⛓ **THE AREA BINDING'S REPORT — COUNTS AND NAMES, NEVER CELL LISTS.**
 *
 * Arc 1's rule for what a payload may carry, carried whole: *a shipped cell
 * list is a second copy of the terrain that can go stale against it, and a
 * reader who wants the cells re-derives them from the level* (here with
 * `model.areaPartition()`, which is the ONE derivation). ⛔ The LOCK and FLAG
 * cells ARE carried, and the exception is deliberate: they are the two things a
 * reader cannot re-derive — which boundary cell took a lock is a fact about the
 * GRAPH, not about the terrain.
 */
export function areaSummaryOf(areaInfo, { certification = null } = {}) {
    return Object.freeze({
        spec: formatAreaSpec(areaInfo.spec),
        ran: areaInfo.ran,
        calledModule: areaInfo.calledModule,
        ...(areaInfo.partitionSummary ? { partition: areaInfo.partitionSummary } : {}),
        ...(areaInfo.graph ? {
            symbols: Object.freeze([...areaInfo.graph.symbols]),
            draws: areaInfo.graph.draws,
            attempts: areaInfo.graph.attempts,
            graphifyEdges: areaInfo.graph.edges.filter((e) => e.kind === 'graphify').length,
        } : {}),
        lockCount: areaInfo.locks.length,
        locks: Object.freeze(areaInfo.locks.map((l) => Object.freeze({ ...l }))),
        flags: Object.freeze(areaInfo.flags.map((f) => Object.freeze({ ...f }))),
        ...(areaInfo.groups ? { groups: areaInfo.groups, tags: areaInfo.tags } : {}),
        ...(areaInfo.supersededFlagLock
            ? { supersededFlagLock: areaInfo.supersededFlagLock } : {}),
        refused: areaInfo.refused ? Object.freeze({ ...areaInfo.refused }) : null,
        ...(certification ? {
            certified: certification.certified,
            certification: Object.freeze({
                verdict: certification.verdict,
                classifiedBy: certification.classifiedBy,
                reasonText: certification.reasonText,
                ticks: certification.ticks,
                strategies: certification.strategies,
                source: certification.source,
            }),
        } : {}),
    });
}

/**
 * ⛓⛓⛓ **THE `require:[X]` VERDICT — PROCGEN ELEMENTS arc 3, slice 4d (D1).**
 *
 * A directive is MET or the RUN IS REFUSED BY NAME. There are SIX ways it can
 * fail and each is a different fact, so each has its own name; three are
 * decided before a room exists (`elementSpec.resolveRequireDirective`) and
 * three can only be known from a finished level, which is why they are here:
 *
 *   `the-required-element-was-refused: <its own refusal>`
 *        the head was forced and the ROOM could not host it — `no-cut-cell`,
 *        `wall-does-not-seal`, `no-pocket`… carried VERBATIM, because "the
 *        directive failed" and "this 10x10 room has no main-path cut whose wall
 *        seals it" are different things to a caller choosing a seed.
 *   `the-required-element-did-not-certify: <gap>`
 *        it fit and the SOLVER could not walk it, so the level shipped with the
 *        element DROPPED. ⛔ Checked EXPLICITLY and not inferred from the drop:
 *        a directive met on an uncertified element would be a run claiming a
 *        gate nobody proved is crossable.
 *   `the-item-is-not-required: <grade>`
 *        the element is there, certified, and the WITHOUT-arm SOLVED ANYWAY —
 *        which on this arc's own corpus is not hypothetical: 4c measured a kill
 *        lock cleared by pass-2 water. The grade says which kind of not.
 *
 * ⛓ THE WITH-ARM SPENDS NO SOLVE. `summary.finalTicks` is `levelGenerator`'s
 * LAST solve, and that solve is a solve of the FINAL RECORD by the loop's own
 * structure: a rejected candidate leaves the record unchanged, and `lastSolve`
 * only advances when a candidate is KEPT. Its verdict is `SOLVED` by the same
 * structure — the loop keeps only SOLVED anchors, and a skeleton that does not
 * solve THROWS rather than returning. ⇒ the with-arm is stated, not re-run.
 *
 * ⚠ THE PRICE, SAID PLAINLY: the WITHOUT arm is real and costs ONE SOLVE PER
 * TRUE BOOT FLAG. Post-sword grants exactly one (`hasSword`), so a
 * `--require=hasSword` run costs exactly one extra solve.
 *
 * ⛓ EXPORTED because `generateSeedlingLevel` is not the only caller that
 * composes the seam with the loop: `sweep-yield-table.mjs` builds the two by
 * hand so it can time the oracle, and a private copy of this verdict there
 * would be a second answer to *"was the directive met"*.
 */
export function requireVerdict({ dir, model, certification, out, palette, seed, budget }) {
    const base = {
        asked: dir.asked,
        element: dir.heads.length === 1 ? dir.heads[0] : dir.heads,
        forced: dir.forced,
        spec: formatElementSpec(model.elementSpec),
    };
    const no = (reason, detail) => Object.freeze({
        ...base, met: false, grade: null, evidence: null,
        with: null, without: null, refused: Object.freeze({ reason, detail }),
    });
    if (dir.refused) return no(dir.refused.reason, dir.refused.detail);

    /**
     * ⛔⛔ THE ORDER IS THE PIPELINE'S OWN, and the first cut had it wrong.
     * A DROPPED element leaves `elements.ran === false` with the refusal
     * `the-skeleton-does-not-solve-with-the-element`, so a placement check
     * asked first reports every UNCERTIFIED gate as one the room could not
     * HOST — which is the opposite fact (it fit perfectly; the solver could not
     * walk it) and the one a caller picking a seed would act on wrongly.
     * ⇒ certification is asked FIRST, because a `certification` object exists
     * only when the element PLACED. Trap 357's shape: a "deepest stage" list
     * that does not match the order the stages run in names the wrong one.
     */
    const head = model.elementHead?.name ?? null;
    if (certification && certification.certified !== true) {
        return no(`the-required-element-did-not-certify: ${certification.gap ?? 'no-solve'}`,
            certification.reasonText ?? 'the certification solve did not reach the goal, so '
                + 'the level shipped with the element DROPPED. ⛔ A directive is never met on '
                + 'an element the solver could not walk.');
    }
    if (!model.elements.ran || !dir.heads.includes(head)) {
        const why = model.elements.refused;
        return no(`the-required-element-was-refused: ${why?.reason ?? 'it-did-not-run'}`,
            why?.detail ?? `the run's element head is ${JSON.stringify(head)} and the `
                + `directive needs one of [${dir.heads.join(', ')}].`);
    }
    /**
     * ⛓ THE DIFFERENTIAL — the ONE implementation (`procgenRequirements`), on
     * the FINAL level, both arms at the SAME budget the seam ran under.
     */
    const report = requirementsFor({
        record: out.record,
        model,
        palette,
        summary: out.summary,
        seed,
        biome: palette.name,
    }, { verdict: VERDICT.SOLVED, ticks: out.summary.finalTicks }, { budget });
    const rows = dir.asked.map((flag) => report.rows.find((r) => r.flag === flag) ?? null);
    const graded = rows.map((r) => (r ? gradeOf(r) : 'NOT-MEASURED'));
    const met = graded.every((g) => REQUIRING_GRADES.includes(g));
    const one = (pick) => (dir.asked.length === 1 ? pick(0) : dir.asked.map((_, i) => pick(i)));
    const report1 = Object.freeze({
        ...base,
        met,
        grade: one((i) => graded[i]),
        evidence: one((i) => rows[i]?.evidence ?? null),
        with: Object.freeze({ verdict: VERDICT.SOLVED, ticks: out.summary.finalTicks ?? null }),
        without: one((i) => (rows[i] ? Object.freeze({
            verdict: rows[i].withoutVerdict, ticks: rows[i].withoutTicks,
        }) : null)),
        refused: met ? null : Object.freeze({
            reason: `the-item-is-not-required: ${[].concat(graded).join(', ')}`,
            detail: `the element is placed and CERTIFIED and the differential did not grade `
                + `[${dir.asked.join(', ')}] as REQUIRED at maxTicksPerTarget=`
                + `${budget.maxTicksPerTarget}: the level solved WITHOUT it too. ⛔ THAT IS A `
                + 'REAL ANSWER, not a missing measurement — 4c measured a kill lock cleared '
                + 'by pass-2 WATER, which is a level whose gate opens for a reason the '
                + 'directive did not ask for. ⚠ The claim is SOLVER-RELATIVE and BOUNDED: no '
                + 'budget was escalated and no exhaustive search exists anywhere in this '
                + 'design.',
        }),
    });
    return report1;
}

/**
 * GENERATE ONE SEEDLING LEVEL — the whole seam, wired.
 *
 * ⛔ TWO STREAMS, TWO SEEDS FROM ONE. The model's room stream and the loop's
 * template stream are separate `ProcgenRng`s built from the SAME seed, so the
 * level's identity is one number and neither stream can shift the other by
 * spending a draw.
 */
export function generateSeedlingLevel({
    seed, palette = PRE_SWORD_PALETTE, bounds, budget = DEFAULT_BUDGET, defaults,
    skeleton = DEFAULT_SKELETON, elements, areas = DEFAULT_AREAS, require,
} = {}) {
    const { model, oracle, certification, areaCertification, require: dir,
        ledger: seamLedger } = seedlingSeam({
        seed, items: palette.items ?? null, budget, defaults, skeleton, elements, areas,
        require,
    });
    const out = generateLevel({ rng: rngFor(seed), model, oracle, palette, bounds });
    /**
     * ⛓⛓⛓ **THE DIRECTIVE'S VERDICT, ON THE FINAL LEVEL** (arc 3, slice 4d,
     * D1/D2) — and the level has to be FINISHED for it to mean anything.
     *
     * ⛔ A SKELETON-TIME DIFFERENTIAL WOULD BE BLIND TO THE THING 4c FOUND: the
     * arc's only rich post-sword seed had its kill lock cleared because PASS-2
     * FURNITURE DROWNED THE SPINNER (`cause:'water'`), so the item was not
     * required at all on the level that shipped, while it plainly was on the
     * skeleton. ⇒ both arms run here, after the ladder.
     */
    const requireReport = dir.asked.length === 0
        ? null : requireVerdict({ dir, model, certification, out, palette, seed, budget });
    return {
        ...out,
        model,
        certification,
        areaCertification,
        require: requireReport,
        /**
         * ⛓ THE PASS-1 LEDGER, from the seam. ⛔ The PASS-2 half is `out.trace`
         * as it stands — attempt rows with the template, its params, the
         * anchors offered, the per-anchor refusal BY NAME, the solve and the
         * keep/revert — and the ledger deliberately does NOT duplicate it. The
         * page's phase ladder hands over to the existing STEP at the last
         * pass-1 row.
         */
        ledger: seamLedger,
        summary: Object.freeze({
            ...out.summary,
            /**
             * ⛓⛓ **THE AREA BINDING'S REPORT** (arc 3, slice 4b) — the maze's
             * `summary.areas` block, one substrate over. ⛔ OMITTED ENTIRELY at
             * `keys: 0`, which is what keeps every committed payload
             * byte-identical, and it carries the graph's own answer FROM BEFORE
             * the drop (`areaCertification.areas`) so a refused certification is
             * still a readable report rather than an absence.
             */
            ...(resolveAreaSpec(normalizeAreaSpec(areas ?? DEFAULT_AREAS)).keys === 0 ? {}
                : { areas: areaSummaryOf(areaCertification?.areas ?? model.areas,
                    { certification: areaCertification }) }),
            /**
             * ⛓ ⚖ DESIGN RULING 20's SOLVER-WORK RECORDS for the element, on the
             * key the design gives them. ⛔ Omitted entirely at `--elements=none`,
             * which is what keeps the payload byte-identical there.
             */
            ...(!isElementList(model.elementSpec) && model.elementSpec.name === ELEMENTS_NONE
                ? {} : { elements: elementSummaryOf(model, { certification }) }),
            /**
             * ⛓⛓ **THE DIRECTIVE'S BLOCK** (arc 3, slice 4d) — the maze's
             * `summary.require`, one substrate over. ⛔ OMITTED ENTIRELY when
             * nothing was asked, which is what keeps every committed payload
             * byte-identical (arc-1 §10.2's own rule).
             */
            ...(requireReport ? { require: requireReport } : {}),
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
