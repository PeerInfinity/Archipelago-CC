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
 * ── ⛓⛓⛓ A TEMPLATE IS NOW A **FUNCTION**, AND A CONCRETE ROW IS ITS OUTPUT
 *
 * ⚖ GENERATE-mode UI arc, SLICE 2 (kickoff §3.1), the user's own ruling:
 * *"migrating away from fixed templates towards parameterized templates. A
 * collection of functions that each generate a coherent set of features for
 * the map, instead of a collection of predefined arrangements of tiles."*
 *
 * So `palette.templates` holds **BASE templates**:
 *
 *   `name`        unique; the roster key and the trace's `template` field.
 *                 ⛔ IT DOES NOT MOVE WITH THE PARAMETERS — the instance label
 *                 is a separate field, because the family tallies and the pin
 *                 union both key on the base name (trap 199).
 *   `family`      the roster the report counts by (⚖ §5, trap 199)
 *   `params`      the DECLARED, UI-facing schema: an ARRAY of
 *                 `{key, domain, default, why}`. `domain` is a small finite
 *                 list; `default` must be in it and is what verb 2's form
 *                 pre-fills. ⛔ Nothing in the free-running loop reads
 *                 `default` — the loop DRAWS. It is the UI's value and the
 *                 record of what the frozen row used to be.
 *   `instantiate(rng, overrides)` → a CONCRETE ROW
 *
 * and a **CONCRETE ROW** is exactly the shape this table held before the
 * migration, plus two stamps:
 *
 *   `footprint`   the cells it OCCUPIES, as {dx,dy} from its anchor. Every one
 *                 must be free interior ground or the placement is refused BY
 *                 NAME before any solve.
 *   `clearance`   cells that must ALSO be free but are not written — the
 *                 template's own "and this stays walkable" rule.
 *   `terrain`     tiles written, `{dx, dy, terrain}` in `procgenLevel.TERRAIN`
 *   `entities`    entities added, `{dx, dy, type, attrs}` — attrs TRANSCRIBED
 *                 from real atlas rooms, cited per template
 *   `pins`        staging pins this template obliges (`bootStaging`'s argument)
 *   `door`        `'h'|'v'` — `procgenSeedling.legalAt`'s own rule
 *   `site`        ⛓ ARC 3 SLICE 1: which SITE CLASS the free loop should
 *                 propose anchors from (`procgenCore/sites.SITE_CLASSES`).
 *                 Default `'any'` = the whole interior, which is what
 *                 `anchorsFor` has always shuffled. ⛔ It is a fact about the
 *                 SEARCH and never about legality — see that file's law.
 *
 * ⛓ **A `lane` FIELD USED TO LIVE HERE** (`'avoidable'` on the arrow trap: the
 * model computed the lane with the ENGINE's own geometry and refused an anchor
 * whose lane covered the start or the goal). ⛔ THE WORD IS RETIRED, not
 * reserved — it went with `arrow-lane` when ⚖ design ruling 9 took that row out
 * of the generator, and `procgenSeedling.laneClear` went with both. See the
 * `arrow-lane` row in `EXCLUDED_TEMPLATES` for the measurement.
 *   `params`      ⛓ THE STAMP: the VALUES this instance was built from, as a
 *                 plain object. ⚠ The base's `params` is the SCHEMA (an
 *                 ARRAY); a concrete row's is the VALUES (an OBJECT). Two
 *                 shapes, one word, and `assertPalette` asserts the shapes so
 *                 a reader who mixes them meets a refusal rather than a
 *                 silently empty loop.
 *   `instance`    the derived label — `wall-segment(ori=v,len=4)` — which is
 *                 what the pane prints and what a reader identifies a row by.
 *
 * ⛔ **THE CONCRETE ROW IS THE OUTPUT CONTRACT.** `anchorsFor`, `legalAt`,
 * `place`, the oracle, the pin union and the sentinel slots consume concrete
 * rows and never learn the migration happened. A zero-parameter template is the
 * degenerate case: one instantiation, byte-identical to the frozen row it
 * replaced. ⚠ THE SHIPPED ROSTER NO LONGER HOLDS ONE — `arrow-lane` was it, and
 * it left with ⚖ design ruling 9 — so the case is now exercised by a synthetic
 * template in `watchGenerate.test.js`'s directive-grammar rows rather than by a
 * palette row (trap 312: retiring a row makes some claims VACUOUS rather than
 * false; the honest move is to say which sentence still has content).
 *
 * ── ⛔⛔ THE DRAW ORDER **IS** PART OF DETERMINISM, SO IT IS DECLARED ───
 *
 * `instantiate` draws each declared parameter from the SAME injected stream,
 * **in `params` array order** (schema order), one `rng.pick(domain)` per
 * parameter — and a parameter supplied through `overrides` consumes NO draw.
 * The loop's order within one attempt is therefore: pick the base template,
 * draw its parameters in schema order, then ask the model for an anchor. ⚠ The
 * number of draws an attempt spends is TEMPLATE-DEPENDENT (two for a wall
 * segment, one for a weigh lock), which is harmless precisely because the
 * template is drawn first — the stream decides the count before it spends it.
 *
 * ⛓ **AND THE OLD DOCBLOCK'S REJECTION OF A FACTORY IS SUPERSEDED** — see the
 * `PLACEMENT_GROUP` block below, which is edited rather than left standing
 * (trap 223: a section that was true when written reads as current forever).
 * Its three reasons were: `assertPalette` walks static footprints (it now
 * walks every ENUMERATED instantiation, which is strictly more), the
 * post-sword roster is a superset BY CONSTRUCTION (it still is — a spread of
 * the same base objects), and the measurements are attached to a row a reader
 * can see (they still are, beside the domain each one certifies).
 *
 * ⛔ NO NODE IMPORTS (see `atlasSource.js`): this file is on the GENERATE
 * arm's path in the browser.
 */

import { TERRAIN } from './procgenLevel.js';
/**
 * ⛓ THE TEMPLATE CONTRACT — `procgenCore/`, since CONSTRUCTIVE-MODE slice 2.
 * Imported for this file's OWN use (the roster below is built with
 * `defineTemplate`, and `assertPalette` walks `enumerateValues`) and
 * re-exported below for every caller that has always taken it from here.
 */
import { defineTemplate, enumerateValues } from '../procgenCore/templateContract.js';
/**
 * ⛓ THE SITE VOCABULARY — `procgenCore/sites.js`, since PROCGEN ELEMENTS arc 3
 * slice 1. Imported for `assertPalette`'s membership check alone: the CLASSES
 * are a shared fact about grids, and what a class MEANS for a Seedling anchor
 * is `procgenSeedling.anchorsFor`'s.
 */
import { SITE_CLASSES } from '../procgenCore/sites.js';

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
 * ⛓ THE TRANSPOSE — what makes ONE orientation parameter replace a hand-
 * unrolled `-h`/`-v` pair.
 *
 * `along` runs down the template's own axis and `across` is perpendicular to
 * it: for `ori:'h'` that is `(dx, dy)`, for `'v'` it is `(dy, dx)`. Every
 * wave-1 door geometry below is written ONCE in these coordinates, so the two
 * orientations cannot drift apart the way two literal rows can.
 */
const at = (ori, along, across) => (ori === 'h' ? cell(along, across) : cell(across, along));
/** `n` cells in a line down the template's own axis, from its anchor. */
const lineCells = (ori, n) => Object.freeze(
    Array.from({ length: n }, (_, i) => at(ori, i, 0)),
);
/** The along-axis offset of a cell, in the same coordinates. */
const alongOf = (ori) => (c) => (ori === 'h' ? c.dx : c.dy);

/**
 * ⛓⛓⛓ THE TEMPLATE CONTRACT ITSELF LIVES IN `procgenCore/` SINCE 2026-08-15.
 *
 * CONSTRUCTIVE-MODE arc, slice 2 (kickoff §3.2). `defineTemplate`,
 * `enumerateValues`, `enumerateInstantiations` and `instantiateKept` moved to
 * `procgenCore/templateContract.js` VERBATIM (only the refusals' own prefix
 * changed, from `procgenPalette:` to `templateContract:`, so a maze template's
 * refusal does not name a Seedling file). They are re-exported here because
 * every existing caller — this file's own roster, `procgenSeedling`'s pin
 * union, `watchGenerate.keptTemplatesOf`, the sweeps, the tests — imports them
 * from `procgenPalette.js`, and the move must not be visible to any of them.
 *
 * ⛔ WHAT STAYED IS EVERYTHING THAT KNOWS WHAT A ROW *MEANS*: `assertPalette`
 * (TERRAIN, the `door: 'h'|'v'` rule, the group/tag slots), the geometry
 * helpers above (`paint` writes `terrain`; `at`'s transpose exists for the
 * wave-1 door geometry), the verb/discharge vocabulary and the roster
 * machinery. See `templateContract.js`'s docblock for the line-by-line reason.
 */
export {
    TemplateContractError, defineTemplate, enumerateInstantiations, enumerateValues,
    instantiateKept,
} from '../procgenCore/templateContract.js';

/**
 * ⛓⛓⛓ AND THE ROSTER MACHINERY FOLLOWED IN SLICE 3 — `procgenCore/
 * paletteRoster.js`.
 *
 * Slice 2 recorded `normalizeRoster`/`restrictPalette`/`catalogueRows` as
 * STAYING, on the line *"the roster/URL spellings of the Seedling page"*. That
 * line stopped being true the moment `mazeRoom/lab.html` existed with the same
 * `?families=`/`?templates=` spelling and the same catalogue — and re-read
 * against the code, none of the three touches a Seedling fact: they walk
 * `palette.templates[].{name, family, params, why}` and `palette.excluded[]`,
 * which is `templateContract.defineTemplate`'s own output shape. Moved
 * VERBATIM; only the refusal prefix changed (`procgenPalette:` ->
 * `paletteRoster:`). Re-exported here so no caller learns the move.
 */
export {
    PaletteRosterError, catalogueRows, normalizeRoster, restrictPalette,
} from '../procgenCore/paletteRoster.js';

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE DISCHARGE TEST — ONE SPELLING (GENERATE-mode UI arc, slice 5)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ §12.1's evidence standard, in one place: **a kept clearer is certified by
 * a `{strategy}` RECORD in the solve, never by a keep-count** — an obstacle
 * nobody walked into cannot produce one.
 *
 * ⛔ IT WAS WRITTEN THREE TIMES BEFORE THIS SLICE and the copies were
 * identical, which is the good case and still the wrong number of copies:
 * `batch-seedling-acceptance.mjs`, `sweep-seedling-anchor-search.mjs` and
 * `sweep-seedling-wave1-domains.mjs` each carried the same frozen literal.
 * Verb 2 needs the same test on the PAGE (a browser module cannot import a
 * script), so the choice was a fourth copy or a hoist. ⛓ The convergence was
 * checked BEFORE the merge rather than after: the three declarations were read
 * off disk and compared character for character (identical), and the two USE
 * shapes — the batch's `strategies.includes(verb)` against the sweeps'
 * `records.some(r => r.strategy === verb)` — were DRIVEN over the batch's own
 * subjects and agreed on all of them. The as-built carries the table.
 *
 * ── ⛔⛔ `null` IS NOT `false`, AND THE DIFFERENCE IS THE WHOLE POINT ──
 *
 * A wall, a water pool and a pit patch have NO verb to
 * discharge. Returning `false` for them would let a readout print
 * *"solved-only"* — *"we looked for the good outcome and did not get it"* —
 * about a template for which there was never anything to look for. That is
 * the shape trap 249 names one level up: a line that cannot distinguish two
 * cases, worn as if it could. So `verbOf` answers `null` and every caller
 * has to say which of the three cases it is in.
 */

/**
 * Which template families own a CLEARER, and which solver strategy discharges
 * it. ⛓ Taken from the solver's own strategy vocabulary, and keyed on
 * `family` because that is the roster's stable axis — an instance label is a
 * geometry (trap 199, and slice 2 §9.10's residue).
 */
export const CLEARER_STRATEGY = Object.freeze({
    shove: 'shove',
    weigh: 'weigh',
    kill: 'kill',
});

/**
 * The verb a family's own clearer discharges, or `null` when the family has
 * none. ⛔ `null` means *"there is nothing here to discharge"* and is NEVER
 * the same answer as "it did not discharge" — see the section docblock.
 */
export function verbOf(family) {
    return CLEARER_STRATEGY[family] ?? null;
}

/**
 * Did this solve DISCHARGE the family's own verb?
 *
 * @returns {boolean|null} `true`/`false` for a family that HAS a verb;
 *   `null` for one that has none, which is a third answer and not a `false`.
 *
 * ⚠ It takes the RECORDS rather than the whole verdict object so that the one
 * caller who has only a strategy list (the batch, which precomputes one) and
 * the callers who hold a solve can ask the same function the same way.
 */
export function dischargesVerb(family, records) {
    const verb = verbOf(family);
    if (!verb) return null;
    return (records ?? []).some((r) => r?.strategy === verb);
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ VERB 1 — **RESTRICT** (GENERATE-mode UI arc, slice 4, ⚖ ruling 1)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ The user's ask: *"a list of things that can be generated"* plus a way to
 * *"choose the sub-roster a run may draw from"*. The loop takes its palette
 * INJECTED (`levelGenerator.generateLevel`'s own argument), so a restriction
 * is an ARGUMENT and not an edit: `restrictPalette` returns a palette object
 * of exactly the same shape and the loop never learns a restriction happened.
 * ⛔ ZERO loop-core changes are made by this slice, and that is by
 * construction rather than by care.
 *
 * ── THE RESTRICTION'S ONE SHAPE: `{axis, names}` ──────────────────────
 *
 * `axis` is `'families'` or `'templates'`; `names` is the list on that axis.
 * ⛔ ONE SHAPE, not two optional lists, because *"which axis is this?"* has to
 * have an answer at every site that carries a restriction — the URL reader,
 * the URL writer, the palette, the payload and the readout all pass this same
 * object around.
 *
 * ⛔ **THE TWO AXES DO NOT COMPOSE — a restriction naming both REFUSES.** Two
 * parameters that can each name a sub-roster are two spellings of one setting
 * the moment both are present, and the arc has already paid for that failure
 * mode once (slice 1 exists because the form and the URL held two spellings of
 * one run). *Say it one way* is cheaper to reason about than any composition
 * rule, and a defined intersection would still have to be printed somewhere
 * for a reader to know what ran.
 *
 * ── ⚠ WHY THE DERIVED NAME SPELLS ITS AXIS ────────────────────────────
 *
 * Kickoff §3.4 suggests `pre-sword[wall,weigh]`. ⛓ MEASURED AGAINST THE ROSTER
 * OF THE DAY, that spelling was ambiguous: `arrow-lane` was both a FAMILY name
 * and a TEMPLATE name, so `pre-sword[arrow-lane]` named two different
 * sub-rosters and a reader could not tell which ran. ⚠ THAT COLLISION IS GONE
 * — `arrow-lane` left the roster with ⚖ design ruling 9 and no shipped name
 * equals a shipped family today — and the rule STAYS, because a roster is a
 * thing slices add to and a spelling that is unambiguous only until the next
 * row lands is a spelling nobody can rely on. The axis therefore rides in
 * the name — `pre-sword[families:pit,water]`, `pre-sword[templates:pit-patch]`
 * — and that name is `summary.palette`, so it is what the payload, the batch
 * report and the page's readout all carry.
 *
 * ⛔ **THE NAMES ARE SORTED AND DEDUPED HERE, ONCE.** `?families=weigh,water`
 * and `?families=water,weigh` are one restriction; two derived names for one
 * sub-roster would be the same two-spellings defect one level down, and the
 * URL writer's FIXED-POINT check (slice 1) would fail on the second load.
 */

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
 * ⛓⛓⛓ **THE DOOR GEOMETRY — ONE FUNCTION, AND SINCE SLICE 4c ITS ONLY CALLER IS
 * THE CENSUS** (PROCGEN ELEMENTS arc 3, slice 2; re-homed in slice 4c).
 *
 * *`span` cells in a line down the template's own axis, all of them written
 * `wall` except the one at `gap`, which is the DOOR CELL.* All three door
 * families were spelling that out separately — three `lineCells` + three
 * `filter(along !== gap)` — which was harmless while the length was a frozen
 * constant and stopped being harmless the moment it was a PARAMETER whose
 * domain a sweep certifies.
 *
 * ⛔ **THE THREE FAMILIES RETIRED IN SLICE 4c AND THIS FUNCTION DID NOT**, and
 * the reason is the second paragraph rather than sentiment.
 * `census-seedling-doors.mjs` sizes a door's `span` by counting anchors where a
 * bare wall-and-gap CUTS the room; a census that built its own door shape would
 * measure a door no *element* can produce either, and the number it published
 * would be a claim about the census's geometry
 * (`feedback_code_sweep_misses_the_data`, from the instrument side). ⇒ its
 * callers today are that census and `procgenSeedlingDoorCut.test.js`'s door-LAW
 * rows, which drive the law on this shape because it is the shape the census
 * measured.
 *
 * ⚠ `span = 1` IS THE DEGENERATE CASE AND IT IS THE POINT: one cell, `gap = 0`,
 * NO wall written at all. On a corridor the lock cell IS the door — ⚖ design
 * ruling 17 — and the geometry says so by producing an empty `wall` list rather
 * than by a special case somewhere else. It is also what the room-aware
 * `killgate` element GROWS to on a corridor (0 wall cells), which is the same
 * statement with the room asked instead of a parameter drawn.
 *
 * @param {'h'|'v'} ori
 * @param {number} span how many cells the wall spans, `>= 1` (the interior of a
 *   single screen is 8, which is where the census's span-8 column comes from)
 * @param {number} gap  which cell along it is the door, `0..span-1`
 */
export function doorGeometry(ori, span, gap) {
    if (!Number.isInteger(span) || span < 1) {
        fail(`procgenPalette: doorGeometry needs an integer span >= 1, got `
            + `${JSON.stringify(span)}. A door of no cells is not a door.`);
    }
    if (!Number.isInteger(gap) || gap < 0 || gap >= span) {
        fail(`procgenPalette: doorGeometry got gap ${JSON.stringify(gap)} for span ${span}; `
            + `the gap is a cell OF the wall, so it is 0..${span - 1}. A gap outside the span `
            + 'would produce a solid wall with a door cell nothing writes — a row whose door '
            + 'law would wall a cell the wall already holds.');
    }
    const cells = lineCells(ori, span);
    const along = alongOf(ori);
    return Object.freeze({
        cells,
        doorCell: at(ori, gap, 0),
        wall: paint(cells.filter((c) => along(c) !== gap), 'wall'),
    });
}

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
 * ⛓⛓⛓ **AND THE PARAGRAPH ABOVE IS NOW HISTORY, NOT THE STATE OF AFFAIRS**
 * (GENERATE-mode UI arc slice 2; trap 223 — a section that was true when
 * written reads as current forever, so it is EDITED where it stands rather
 * than contradicted somewhere else). ⚖ The user ruled parameterized templates
 * in, and every row in this file is now a `build(values)` function. Each of
 * the three reasons above was DISCHARGED rather than overruled:
 *
 *  · `assertPalette` no longer walks static footprints — it ENUMERATES every
 *    declared domain and runs every instantiation through the same per-row
 *    checks, which is strictly more than it used to do (count in its docblock).
 *  · `POST_SWORD_TEMPLATES` is still a superset BY CONSTRUCTION: it spreads the
 *    same frozen BASE objects, and `procgenPostSword.test.js` still drives it.
 *  · The measurements are still attached where a reader finds them — beside the
 *    domain each one certifies, in the `SPINNER_OFFSET` table's own shape.
 *
 * ⛔ WHAT DOES **NOT** CHANGE is this slot. A `build` may vary geometry; it
 * may not invent a group. The sentinel is still a per-PLACEMENT value that
 * only `place` can resolve, and `assertGroupSlot` runs against every
 * instantiation rather than against one frozen row.
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
    /**
     * ⛓⛓ ⚖ RULING 4's LIGHT SWEEP — `node
     * scripts/procgen/sweep-seedling-wave1-domains.mjs --seeds=12`, the
     * dedicated geometry (this instance ALONE in the bordered room with that
     * seed's goal), ONE anchor per (value, seed) — the cell `anchorsFor` itself
     * draws, which is the anchor the loop would use.
     *
     *   ori=h  len   2    3    4    5      ori=v  len   2    3    4    5
     *   solved      12   12   12   12             solved 12   12   12   12
     *   refused      0    0    0    0             refused 0    0    0    0
     *   threw        0    0    0    0             threw   0    0    0    0
     *
     * ⇒ every declared length places and certifies alone, at every seed, in
     * both orientations. ⚠ THAT IS NOT A CLAIM THAT THE VALUES ARE
     * INTERCHANGEABLE — a wall segment is not a clearer, so it has no
     * `discharged` column and nothing here says which length constrains a room
     * more. What the table certifies is what ⚖ ruling 4 asks of a domain: every
     * value is one the generator can actually place and the oracle can
     * adjudicate, with ZERO throws (the only class that would abort a RUN).
     */
    defineTemplate({
        name: 'wall-segment',
        family: 'wall',
        /**
         * ⛓⛓ ARC 3 SLICE 1 — AN AREA TEMPLATE IS OFFERED **CHAMBER** CELLS.
         *
         * ⚖ Design §4.3: *"area templates (pool / pit / segment) are offered
         * the chamber site class only; on a bare corridor they are what the
         * yield table says — sealers."* This row paints a BLOCK of terrain, and
         * on a 1-wide corridor the only blocks it can paint are the ones the
         * connectivity pre-check then refuses BY NAME (slice 6's 64 sealing
         * REVERTs were exactly these three families). A chamber is where a
         * patch of terrain is decoration rather than a wall across the way.
         *
         * ── ⛓⛓⛓ AND THERE IS **NO FALLBACK** — ⚖ THE USER RULED, 2026-08-16
         *
         * The site census (as-built §8.3) measured that a Seedling 10x10 room
         * carved by a BARE TREE KIND has **no all-ground 2x2 square at all on
         * 10 of 12 seeds**, so this declaration makes these three rows
         * NO_ANCHOR on most `branchy`/`bushy`/`loopy`/`open`/`winding` seeds
         * (yield table: kept 156 → 55, saturated cells 4 → 40 of 56). A
         * `'chamber, else anywhere'` fallback was proposed and **OVERRULED**:
         *
         * ⚖ **THINGS THAT NEED AREA ARE PLACED FIRST** (the design's own law —
         * pass 1 constructs elements and the connector leaves the space they
         * demand; pass 2 decorates what pass 1 built). A fallback to "anywhere"
         * would RE-CREATE THE OPEN-ROOM ASSUMPTION THIS ARC EXISTS TO REMOVE:
         * it would put a patch of terrain in a 1-wide corridor precisely
         * because there was nowhere proper for it.
         *
         * ⇒ **A BARE TREE KIND IS A CORRIDOR-ONLY SKELETON, and ≈0 kept there
         * is the TRUTH about it, not a defect.** Area is pass 1's to provide —
         * `chambers=k`, `rooms`, and (later) elements — and the yield table's
         * `chambers=1` / `chambers=2` / `rooms` arm is where this declaration
         * pays (as-built §8.4).
         *
         * ⛔ THE PRICE IS DECLARED: on the OPEN room this changes NOTHING —
         * `empty`'s one chamber IS its interior, in the same order — and on a
         * CARVED room it MOVES seed→level pairs, which ⚖ GENERATE-UI ruling 5
         * licenses and the arc-3 slice-1 as-built re-records with its command.
         */
        site: 'chamber',
        params: [
            { key: 'ori', domain: ['h', 'v'], default: 'h',
                why: 'the two orientations were `wall-segment-h3` and `-v3`, one parameter '
                    + 'hand-unrolled into two rows. Collapsing them is ⚖ ruling 3\'s wave-1 '
                    + 'item and it is what stops the pair drifting apart' },
            { key: 'len', domain: [2, 3, 4, 5], default: 3,
                why: 'the frozen row was THREE and the number was never measured — three '
                    + 'is the default because it is what shipped. The domain stops at 5 '
                    + 'because 6 would be within two cells of spanning an 8-wide interior, '
                    + 'and a near-spanning wall is a door with no clearer in it (the '
                    + '`wall-gap-block` family is where a door belongs)' },
        ],
        why: 'Stone cells in a line; `world.solids` gains them with tag `tile:Stone`. The '
            + 'two orientations are two values of one draw, so a room can be constrained '
            + 'on both axes from one template',
        build: ({ ori, len }) => {
            const cells = lineCells(ori, len);
            return {
                footprint: cells,
                clearance: Object.freeze([]),
                terrain: paint(cells, 'wall'),
                entities: Object.freeze([]),
                pins: Object.freeze([]),
            };
        },
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
    /**
     * ⛓⛓ ⚖ RULING 4's SWEEP, same command and same bound as `wall-segment`'s:
     * ALL NINE `w x h` combinations read **12 solved / 0 refused / 0 threw**
     * over seeds 1..12. A pool routes a walk around itself and never seals a
     * room on its own, so a flat table is the expected shape here and the
     * number worth reading is the zero in the `threw` column.
     */
    defineTemplate({
        name: 'water-pool',
        family: 'water',
        /**
         * ⛓⛓ ARC 3 SLICE 1 — AN AREA TEMPLATE IS OFFERED **CHAMBER** CELLS.
         *
         * ⚖ Design §4.3: *"area templates (pool / pit / segment) are offered
         * the chamber site class only; on a bare corridor they are what the
         * yield table says — sealers."* This row paints a BLOCK of terrain, and
         * on a 1-wide corridor the only blocks it can paint are the ones the
         * connectivity pre-check then refuses BY NAME (slice 6's 64 sealing
         * REVERTs were exactly these three families). A chamber is where a
         * patch of terrain is decoration rather than a wall across the way.
         *
         * ── ⛓⛓⛓ AND THERE IS **NO FALLBACK** — ⚖ THE USER RULED, 2026-08-16
         *
         * The site census (as-built §8.3) measured that a Seedling 10x10 room
         * carved by a BARE TREE KIND has **no all-ground 2x2 square at all on
         * 10 of 12 seeds**, so this declaration makes these three rows
         * NO_ANCHOR on most `branchy`/`bushy`/`loopy`/`open`/`winding` seeds
         * (yield table: kept 156 → 55, saturated cells 4 → 40 of 56). A
         * `'chamber, else anywhere'` fallback was proposed and **OVERRULED**:
         *
         * ⚖ **THINGS THAT NEED AREA ARE PLACED FIRST** (the design's own law —
         * pass 1 constructs elements and the connector leaves the space they
         * demand; pass 2 decorates what pass 1 built). A fallback to "anywhere"
         * would RE-CREATE THE OPEN-ROOM ASSUMPTION THIS ARC EXISTS TO REMOVE:
         * it would put a patch of terrain in a 1-wide corridor precisely
         * because there was nowhere proper for it.
         *
         * ⇒ **A BARE TREE KIND IS A CORRIDOR-ONLY SKELETON, and ≈0 kept there
         * is the TRUTH about it, not a defect.** Area is pass 1's to provide —
         * `chambers=k`, `rooms`, and (later) elements — and the yield table's
         * `chambers=1` / `chambers=2` / `rooms` arm is where this declaration
         * pays (as-built §8.4).
         *
         * ⛔ THE PRICE IS DECLARED: on the OPEN room this changes NOTHING —
         * `empty`'s one chamber IS its interior, in the same order — and on a
         * CARVED room it MOVES seed→level pairs, which ⚖ GENERATE-UI ruling 5
         * licenses and the arc-3 slice-1 as-built re-records with its command.
         */
        site: 'chamber',
        params: [
            { key: 'w', domain: [1, 2, 3], default: 2,
                why: 'the frozen row was 2x2 and its own docblock called the size a '
                    + 'declared choice; the measurement was that the cells build as water. '
                    + 'The domain stops at 3 because a 4-wide pool in an 8-wide interior '
                    + 'is half the room' },
            { key: 'h', domain: [1, 2, 3], default: 2,
                why: 'the same, on the other axis. ⛔ NOT collapsed into an `ori` — a pool '
                    + 'is a RECTANGLE and w x h says more than a length and a flip does' },
        ],
        why: 'Water cells; `world.lethalTerrainTiles` gains them, and the block must pin '
            + '`sound` for any wet tick (R5 §13) — at every size, which is why the pin is '
            + 'static and not a function of the parameters',
        build: ({ w, h }) => {
            const cells = rectCells(w, h);
            return {
                footprint: cells,
                clearance: Object.freeze([]),
                terrain: paint(cells, 'water'),
                entities: Object.freeze([]),
                pins: Object.freeze(['sound']),
            };
        },
    }),
    /**
     * ⛓ THE PIT PATCH — `TERRAIN.pit` (column 7 → type 6), landing in
     * `world.pitTiles`.
     *
     * Two cells rather than four: a pit is a hole in the floor and the atlas's
     * own pits (L4's two cells) are small. The size is a declared choice, not
     * a measurement — the measurement is that the cells build as pits.
     */
    /**
     * ⛓⛓ ⚖ RULING 4's SWEEP: ALL SIX `w x h` combinations read **12 solved /
     * 0 refused / 0 threw** over seeds 1..12.
     *
     * ⚠⚠ AND THE ZERO IN THE `threw` COLUMN IS THE ONE TO READ ON THIS ROW.
     * §15.5's `PhysicsV2Error` — *the approach drive clips lethal terrain the
     * corridor planner routed around* — is a PIT-shaped abort in dense rooms,
     * and it is the class that kills a RUN rather than a candidate. It did not
     * fire once here, at any size. ⛔ That is NOT a claim that the class is
     * gone: this sweep places ONE template in an otherwise empty room, and
     * §15.5 measured the aborts in six-obstacle rooms. The domain is clean; the
     * density question is the loop's and is still open (R9).
     */
    defineTemplate({
        name: 'pit-patch',
        family: 'pit',
        /**
         * ⛓⛓ ARC 3 SLICE 1 — AN AREA TEMPLATE IS OFFERED **CHAMBER** CELLS.
         *
         * ⚖ Design §4.3: *"area templates (pool / pit / segment) are offered
         * the chamber site class only; on a bare corridor they are what the
         * yield table says — sealers."* This row paints a BLOCK of terrain, and
         * on a 1-wide corridor the only blocks it can paint are the ones the
         * connectivity pre-check then refuses BY NAME (slice 6's 64 sealing
         * REVERTs were exactly these three families). A chamber is where a
         * patch of terrain is decoration rather than a wall across the way.
         *
         * ── ⛓⛓⛓ AND THERE IS **NO FALLBACK** — ⚖ THE USER RULED, 2026-08-16
         *
         * The site census (as-built §8.3) measured that a Seedling 10x10 room
         * carved by a BARE TREE KIND has **no all-ground 2x2 square at all on
         * 10 of 12 seeds**, so this declaration makes these three rows
         * NO_ANCHOR on most `branchy`/`bushy`/`loopy`/`open`/`winding` seeds
         * (yield table: kept 156 → 55, saturated cells 4 → 40 of 56). A
         * `'chamber, else anywhere'` fallback was proposed and **OVERRULED**:
         *
         * ⚖ **THINGS THAT NEED AREA ARE PLACED FIRST** (the design's own law —
         * pass 1 constructs elements and the connector leaves the space they
         * demand; pass 2 decorates what pass 1 built). A fallback to "anywhere"
         * would RE-CREATE THE OPEN-ROOM ASSUMPTION THIS ARC EXISTS TO REMOVE:
         * it would put a patch of terrain in a 1-wide corridor precisely
         * because there was nowhere proper for it.
         *
         * ⇒ **A BARE TREE KIND IS A CORRIDOR-ONLY SKELETON, and ≈0 kept there
         * is the TRUTH about it, not a defect.** Area is pass 1's to provide —
         * `chambers=k`, `rooms`, and (later) elements — and the yield table's
         * `chambers=1` / `chambers=2` / `rooms` arm is where this declaration
         * pays (as-built §8.4).
         *
         * ⛔ THE PRICE IS DECLARED: on the OPEN room this changes NOTHING —
         * `empty`'s one chamber IS its interior, in the same order — and on a
         * CARVED room it MOVES seed→level pairs, which ⚖ GENERATE-UI ruling 5
         * licenses and the arc-3 slice-1 as-built re-records with its command.
         */
        site: 'chamber',
        params: [
            { key: 'w', domain: [1, 2, 3], default: 2,
                why: 'the frozen row was 2x1 — "the atlas\'s own pits (L4\'s two cells) are '
                    + 'small", a declared choice. The domain keeps that end and offers two '
                    + 'more; 4 would be half the interior' },
            { key: 'h', domain: [1, 2], default: 1,
                why: 'the frozen row was ONE cell tall. A pit is a hole in the floor and '
                    + 'the atlas\'s are thin, so the domain is deliberately shorter on this '
                    + 'axis than the pool\'s — the asymmetry is the atlas\'s, not a typo' },
        ],
        why: 'Pit cells; `world.pitTiles` gains them and the corridor planner prices them '
            + 'as a fall',
        build: ({ w, h }) => {
            const cells = rectCells(w, h);
            return {
                footprint: cells,
                clearance: Object.freeze([]),
                terrain: paint(cells, 'pit'),
                entities: Object.freeze([]),
                pins: Object.freeze([]),
            };
        },
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
    /**
     * ⛓⛓⛓ ⚖ **RULED OUT OF THE GENERATOR ENTIRELY** (user, 2026-08-15, the
     * PROCGEN ELEMENTS design session; design ruling 9), and it is the FIRST
     * row here whose cause is a RULING rather than a mechanism the oracle
     * could not adjudicate. The template WORKED — 22 KEPT over the slice-6
     * sweep — and left anyway, because vanilla uses arrow lanes only as part
     * of a PRE-SWORD PUZZLE and that puzzle is not what the generator is for.
     *
     * ⛔ `laneClear` LEFT WITH IT (⚖ arc-3 kickoff §6 Q3's named default). The
     * lane rule was this template's own contract, its only caller, and its
     * measurement now lives on this row; a rule kept alive for no row is dead
     * code wearing a legality rule's name. `lane: 'avoidable'` therefore also
     * leaves the CONCRETE-ROW vocabulary (see this file's header and
     * `procgenCore/templateContract`): the word is retired, not reserved.
     */
    Object.freeze({
        name: 'arrow-lane',
        family: 'arrow-lane',
        cause: '⚖ RULED OUT (user, 2026-08-15) — a pre-sword-puzzle element only; the '
            + 'generator does not use arrow lanes',
        measured: '⛓ IT WAS ALSO THE WHOLE COST STORY ON A CARVED ROOM, and that is why the '
            + 'ruling is recorded with a number rather than as a preference. The '
            + 'constructive-mode arc\'s yield table (§13.5) found every expensive solve in '
            + 'the sweep to be an `arrow-lane` REVERT — the worst single solve was **77.8 s** '
            + '(`bushy` seed 5), against a per-cell mean under 1 s — and an arrow lane writes '
            + 'NO TERRAIN AT ALL, so the connectivity pre-check slice 6 shipped could not '
            + 'touch it and must not have. §14.13 re-measured it at every chamber count: '
            + '**`arrow-lane` owned 21 of the 23 REVERTs** in the Seedling sweep and the one '
            + 'expensive cell at each. ⛔ The cost is the SOLVER walking its whole combat '
            + 'ladder against a live volley before refusing; nothing about it is a defect, '
            + 'which is exactly why no slice could fix it and the row had to be ruled on.',
        refusalText: 'solverBot(procgen-l900) collect (96,32) stance: the combat ladder is '
            + 'EXHAUSTED. The corridor passes through danger at (80.4,24.0) — '
            + 'arrowLane:arrowtrap@80,16 (an ARMED trap\'s lane — a STATE question, and still '
            + 'danger at every horizon: the volley that has not fired yet is the one a walk '
            + 'needs warning about) — and every rung of ⚖ §11.8a\'s order refused:\n'
            + '  avoid: no admissible corridor with the danger map\'s 1 volume(s) forbidden — '
            + 'no walkable tile path in level 900 from tile (1,1) to (6,1). …\n'
            + '  (the `time`, `bait` and `kill` rungs follow, each refusing BY NAME.) '
            + '⛓ CAPTURED AT `58fa04225` BEFORE THE ROW WAS REMOVED, from `branchy` seed 4 at '
            + 'count 3 / tries 4 / k 3 / anchortries 1 — the cheapest cell in the sweep that '
            + 'produces one (668 ms), because after this commit there is no way to produce '
            + 'another.',
        wouldNeed: 'the pre-sword puzzle as an ELEMENT, when that puzzle is wanted — a '
            + 'constructor that builds the trap, the cover the player waits behind and the '
            + 'button that disarms it TOGETHER (`procgenCore/elements.js`\'s contract), so '
            + 'the lane is a thing the level was built around rather than a hazard dropped '
            + 'into an existing room for the walk to route past. ⛔ Until then the honest '
            + 'answer is that the generator has no use for one: ⚖ design ruling 8 designs '
            + 'for POST-SWORD by default, and a post-sword player walks through the volley.',
    }),
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
    /**
     * ⛓⛓⛓ **THE TWO PRE-SWORD DOOR TEMPLATES — RETIRED IN SLICE 4c** (⚖ user,
     * 2026-08-16/17; PROCGEN ELEMENTS arc 3). They are the second and third rows
     * in this file whose cause is a RULING rather than an oracle that could not
     * adjudicate them, and unlike `arrow-lane` they were not ruled out for what
     * they DID — they were SUPERSEDED by a mechanism that can do it.
     *
     * ⛔ WHAT MADE THE RULING MEASURABLE was slice 2's door law (*a door is a
     * CUT*) and the `on-connector` element phase slice 4a built. A pass-2
     * TEMPLATE writes a RELATIVE footprint at an anchor somebody else offers, so
     * it can carry a `span` but cannot ask the room how long the wall should be,
     * and cannot carve the cell the mechanism needs. Both rows below spent their
     * whole lives NO_ANCHOR on every carved kind for exactly that reason, and the
     * yield table could not tell them apart from a template that worked until the
     * door law made the difference legible.
     *
     * ⚠ THE `+` LIST AND THE BIOME DEFAULT ARE WHAT MAKE THE RETIREMENT SAFE:
     * `--elements=` now defaults to a CHOICE over the certified elements per
     * biome (`procgenSeedling.defaultElementsFor`), so retiring these rows does
     * NOT leave the default generator without doors — which is the coupling ⚖ D5
     * refused to execute blind.
     */
    Object.freeze({
        name: 'wall-gap-block',
        family: 'shove',
        cause: '⚖ SUPERSEDED (user, 2026-08-16) — the room-aware `blockpocket` ELEMENT does '
            + 'what this row could not: it carves the block\'s REST CELL',
        measured: '⛓ ITS OWN CENSUS IS WHAT RETIRED IT. Slice 2 §9.2 counted 170 CUT anchors '
            + 'for a span-1 door on `winding` and the sweep could use NONE of them, because a '
            + 'span-1 block in a 1-wide corridor is shoved to the next bend and SEALS it '
            + '(§9.11). This row therefore kept its `INTERIOR_SPAN` constant and NOTHING on '
            + 'any carved kind at any span: **0 KEPT on the eight carved kinds in every arm '
            + 'of S1\'s six-arm yield table (§11.9), 2 per arm on `empty`.** The element '
            + 'places on ALL TEN kinds — **62 of 120 (kind, seed) cells**, `empty` 8/12 and '
            + '`winding` 7/12 — and certifies with `shove` on every placement, with the '
            + 'lifted claim TRUE (arc-3 §12).',
        /**
         * ⛔ `null`, AND THE PARENTHESIS BELONGS IN `measured`. This field is the
         * VERBATIM text of a probe REFUSAL — the arc's evidence channel — and
         * the three original rows here carry one. This row never THREW: it was
         * kept on `empty` and NO_ANCHOR everywhere else, which is exactly why a
         * keep-count could not tell it apart from a template that worked. Slice
         * 2's door law made the difference legible; §12's element made it
         * useful. A prose sentence in this field would read, to `catalogueRows`
         * and to the row that counts measured refusals, as a refusal that
         * happened.
         */
        refusalText: null,
        wouldNeed: 'nothing this palette can give it. A pass-2 TEMPLATE writes a RELATIVE '
            + 'footprint at an anchor somebody else offers, so it cannot know where the '
            + 'corridor bends — and the rest cell is exactly that. The room-aware element '
            + 'walks the straight run and CARVES the bend (`procgenCore/elements/'
            + 'blockPocket.js`), which is design catalogue #2 and needs the `on-connector` '
            + 'phase to be possible at all. ⛓ Its wave-1 `ori`/`gap` domain sweep (every '
            + 'legal anchor of seeds 1..12, zero throws at all sixteen values) is preserved '
            + 'in the arc-3 kickoff §13.6.',
    }),
    Object.freeze({
        name: 'wall-gap-lock-weigh',
        family: 'weigh',
        cause: '⚖ SUPERSEDED (user, 2026-08-16) — the `guard` ELEMENT brings its own lane '
            + 'and CARVES it; this row demanded one the room already had',
        measured: '⛓ ⚖ Q2 WAS ANSWERED BY MEASUREMENT AND THE ANSWER WAS ZERO. Its clearer '
            + 'is a SIX-CELL LANE at across `-1`, and no corridor has a straight run beside '
            + 'a bridge cell: **0 KEPT on the eight carved kinds in every arm of S1\'s '
            + 'six-arm table (§11.9), 1-2 per arm on `empty`.** Slice 2 §9.5b swept every '
            + 'span and it kept NOTHING at any of them. The reverse-pull element carries its '
            + 'own lane into the room and certifies: 16 of 18 placements at `len=2` and 16 '
            + 'of 16 at `len=3`, `heldAtDoor` TRUE on every one (§11.8).',
        /** ⛔ `null` — NO_ANCHOR on every carved kind, so no refusal text exists.
         *  The lane is refused by `legalAt` before a solve is spent, which is the
         *  S1 guard working exactly as its docblock says. See `wall-gap-block`'s
         *  row above for why this field is not a place for prose. */
        refusalText: null,
        wouldNeed: 'a room that already has a six-cell straight lane beside a cut cell. That '
            + 'is what pass 1 does NOT build, and asking pass 2 to find one is asking a '
            + 'decorator to be a constructor. ⛓ The element is the same mechanism with the '
            + 'lane brought along (⚖ design ruling 2), and the yield table above is the '
            + 'before it should be read against.',
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
 * ⛓⛓⛓ **THE POST-SWORD-EXCLUSIVE ROSTER, AND IT IS EMPTY** — PROCGEN ELEMENTS
 * arc 3, slice 4c (⚖ user, 2026-08-17: all three door TEMPLATES retire together
 * once the room-aware elements land).
 *
 * Slice 4e created this array for `wall-gap-spinner-killlock`, the arc's first
 * sword-gated family. Slice 4c retired that row (`POST_SWORD_EXCLUDED_TEMPLATES`
 * carries its measurement) and the room-aware `killgate` ELEMENT does its job
 * with the same boot gate spelled as `needs: ['hasSword']` in
 * `procgenCore/elementSpec.ELEMENT_TABLE`.
 *
 * ⛔ **THE ARRAY STAYS, EMPTY, RATHER THAN THE SEAM BEING DELETED.** Two reasons,
 * both structural: `POST_SWORD_TEMPLATES` is a SPREAD of it, so the containment
 * claim `procgenPostSword.test.js` drives keeps holding by construction with no
 * edit; and the next sword-gated family (arc 5's arena) has a declared home
 * rather than a seam to re-invent. ⚠ What it costs to say it this way is one
 * honest sentence: **today the two biomes ship the SAME roster, and the biome IS
 * the BOOT ITEMS plus the elements' `needs`** — `assertPalette` drives that.
 */
const KILL_LOCK_TEMPLATES = Object.freeze([]);

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
    /**
     * ⛓⛓⛓ **THE THIRD DOOR TEMPLATE — RETIRED IN SLICE 4c WITH THE OTHER TWO**
     * (⚖ user, 2026-08-16/17). ⛔ It is the row slice 4e PROMOTED into
     * `KILL_LOCK_TEMPLATES` — the arc's first and only sword-gated family — so
     * its retirement is what leaves that array empty and the biome split resting
     * on the BOOT ITEMS plus the elements' `needs`.
     */
    Object.freeze({
        name: 'wall-gap-spinner-killlock',
        family: 'kill',
        cause: '⚖ SUPERSEDED (user, 2026-08-16) — the room-aware `killgate` ELEMENT GROWS '
            + 'its wall to the room instead of drawing a `span` from a two-value domain',
        measured: '⛓ THE `span` PARAMETER WAS A PROXY FOR A MEASUREMENT THE ROOM CAN MAKE '
            + 'ITSELF. Slice 2 measured its domain as `{1, 8}` — two values for two rooms — '
            + 'and published the price: *"half this family\'s `empty` draws are now '
            + 'NO_ANCHOR by construction"* (§9.11). The element grows 0 cells on a corridor, '
            + '7 on the open 10x10 room and a chamber\'s walls in a chamber, draws NO '
            + 'parameter at all, and places on ALL TEN kinds — **61 of 120 (kind, seed) '
            + 'cells** against the template\'s 39 legal span-1 anchors on `winding` and 0 '
            + 'anywhere at span 8 except `empty` (§9.5).',
        /** ⛔ `null`. ⚠ Its THROW class survives it and is NOT this row's to fix:
         *  the pocket-corner `swing … collideLine("Solid")` abort is PRE-EXISTING
         *  solver behaviour, measured four times (§9.5c, §9b.3) and ⚖ endorsed as
         *  an R9 exception — the ELEMENT meets it too (arc-3 §12's yield table).
         *  That is a fact about the solver, not a refusal this template produced,
         *  so it is not written into the evidence field. */
        refusalText: null,
        wouldNeed: 'nothing. ⛔ AND THE ELEMENT DOES NOT DISCHARGE THE CLASS — it inherits '
            + 'it. What retires this row is that the `span` domain, the `SPINNER_OFFSET` '
            + 'constant and the `gap` clamp all become facts about the ROOM rather than '
            + 'draws, which is the whole point of the `on-connector` phase. ⛓ The two '
            + 'measurements that sized its constants — the `SPINNER_OFFSET` sweep and the '
            + '`span` domain\'s per-value discharge table — are preserved in the arc-3 '
            + 'kickoff §13.6.',
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
            fail(`procgenPalette: template "${t.instance ?? t.name}" puts ${onSlot.length} entit`
                + `${onSlot.length === 1 ? 'y' : 'ies'} on the placement-group slot but `
                + 'declares no `groups`. `place` resolves the slot only for a template '
                + 'that declares it, so the sentinel would reach the level as a literal '
                + 'and `intAttr` parses any non-numeric string as 0 — silently back into '
                + 'the shared group this slot exists to end.');
        }
        return;
    }
    if (t.groups !== 1) {
        fail(`procgenPalette: template "${t.instance ?? t.name}" declares groups=${t.groups}; the only `
            + 'supported count is 1. `procgenSeedling` derives ONE id from the anchor '
            + 'cell, and a second group would need a spacing rule that keeps the ids '
            + 'injective — which nobody has written.');
    }
    if (onSlot.length < 2) {
        fail(`procgenPalette: template "${t.instance ?? t.name}" declares groups=1 but only `
            + `${onSlot.length} of its entities carry PLACEMENT_GROUP. A group of one `
            + 'publishes to nothing and hears from nothing — this is the half-converted '
            + 'row (the lock moved to a private group, the button left on a literal), '
            + 'which reads as parameterized and never opens.');
    }
    for (const e of t.entities ?? []) {
        if (e.attrs?.tset !== undefined && e.attrs.tset !== PLACEMENT_GROUP) {
            fail(`procgenPalette: template "${t.instance ?? t.name}" declares groups=1 and its `
                + `"${e.type}" still carries the LITERAL tset "${e.attrs.tset}". One `
                + 'placement would then span two groups, which is not a mechanism '
                + 'anybody designed.');
        }
    }
    const writesAnchor = (t.terrain ?? []).some((w) => w.dx === 0 && w.dy === 0)
        || (t.entities ?? []).some((e) => e.dx === 0 && e.dy === 0);
    if (!footprintKeys.has('0,0') || !writesAnchor) {
        fail(`procgenPalette: template "${t.instance ?? t.name}" declares groups=1 but does not `
            + 'occupy AND write its own anchor (0,0). The group id is derived from the '
            + 'anchor cell, so an unconsumed anchor lets a later placement anchor in the '
            + 'same cell and land in the SAME group — the defect, restored.');
    }
}

/**
 * ⛓⛓⛓ **THE DOOR LAW'S OWN DECLARATION, CHECKED WHERE A ROW'S MEANING IS
 * CHECKED** — PROCGEN ELEMENTS arc 3, slice 2.
 *
 * `procgenSeedling`'s door law (*a door is a CUT*) reads two lists off the row:
 * `doorCells` — the gap cell(s) the clearer stands in or behind — and `clearer`
 * — the cells that must be reachable from the START once the door is walled.
 * Neither is derivable from the geometry, so both are DECLARED, and every way
 * of declaring them wrongly would be SILENT:
 *
 *  · **`door` with no `doorCells`** — the law would wall the empty set, find the
 *    goal reachable, and refuse EVERY anchor as "not a cut". A family that never
 *    places reads as a family the room has no room for.
 *  · **`doorCells` with no `door`** — the law never runs; the row places
 *    decoration doors and nothing says so.
 *  · **A DOOR CELL THAT WRITES WALL.** The law's open half is `sealRefusal`'s
 *    answer — *with the door cells walkable the goal is reachable* — and a door
 *    cell the row itself walls is never walkable. The two clauses would then be
 *    the same flood asked twice, and every such row would refuse everywhere.
 *  · **A cell outside the footprint** (or, for `clearer`, outside footprint ∪
 *    clearance) — a cell no legality rule reserved, so the law would be reading
 *    terrain another template is free to take.
 */
function assertDoorCells(t, footprintKeys) {
    const where = `template "${t.instance ?? t.name}"`;
    const clearanceKeys = new Set((t.clearance ?? []).map((c) => `${c.dx},${c.dy}`));
    if (t.door === undefined) {
        for (const [field, v] of [['doorCells', t.doorCells], ['clearer', t.clearer]]) {
            if (v !== undefined) {
                fail(`procgenPalette: ${where} declares \`${field}\` but no \`door\`. The door `
                    + 'law runs only for a row that declares `door`, so these cells would be '
                    + 'a description nobody reads — and the row would place DECORATION doors '
                    + 'with nothing saying so.');
            }
        }
        return;
    }
    if (!Array.isArray(t.doorCells) || t.doorCells.length === 0) {
        fail(`procgenPalette: ${where} declares door "${t.door}" and no \`doorCells\`. The law `
            + 'walls those cells and asks whether the goal is still reachable; with none to '
            + 'wall the goal always is, so the row would be refused at EVERY anchor and read '
            + 'as a family this room has no place for.');
    }
    if (!Array.isArray(t.clearer)) {
        fail(`procgenPalette: ${where} declares door "${t.door}" and no \`clearer\` ARRAY. An `
            + 'EMPTY array is the right answer for a family whose clearer stands IN the door '
            + 'cell (`wall-gap-block`), and it has to be said rather than omitted — the law '
            + 'cannot tell "nothing to reach" from "nobody wrote the list".');
    }
    const walled = new Set((t.terrain ?? []).filter((w) => w.terrain !== 'ground')
        .map((w) => `${w.dx},${w.dy}`));
    for (const c of t.doorCells) {
        const key = `${c.dx},${c.dy}`;
        if (!footprintKeys.has(key)) {
            fail(`procgenPalette: ${where} names DOOR cell (${key}), which is not in its own `
                + 'footprint. The footprint is what the legality check reserves, so a door '
                + 'cell outside it is terrain another template is free to take.');
        }
        if (walled.has(key)) {
            fail(`procgenPalette: ${where} names DOOR cell (${key}) and also WRITES it as `
                + 'blocking terrain. A door cell is the GAP — the law\'s open half is the '
                + 'seal pre-check\'s own answer (*with the door cells walkable the goal is '
                + 'reachable*), and a cell the row walls itself is never walkable, so the '
                + 'row would refuse at every anchor.');
        }
    }
    for (const c of t.clearer) {
        const key = `${c.dx},${c.dy}`;
        if (!footprintKeys.has(key) && !clearanceKeys.has(key)) {
            fail(`procgenPalette: ${where} names CLEARER cell (${key}), which is in neither `
                + 'its footprint nor its `clearance`. The law demands that cell be reachable '
                + 'from the start; a cell no legality rule reserved is one another template '
                + 'may take the moment after.');
        }
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
            fail(`procgenPalette: template "${t.instance ?? t.name}" puts an entity on the `
                + 'placement-tag slot but declares no `tags`. `place` resolves the slot '
                + 'only for a template that declares it, so the sentinel would reach the '
                + 'level and be read as tag 0 — the GOAL\'s own flag.');
        }
        return;
    }
    if (t.tags !== 1) {
        fail(`procgenPalette: template "${t.instance ?? t.name}" declares tags=${t.tags}; the only `
            + 'supported count is 1. `placementTagId` allocates ONE free slot per '
            + 'placement, and a second would need its own allocation nobody has written.');
    }
    if (onSlot.length < 1) {
        fail(`procgenPalette: template "${t.instance ?? t.name}" declares tags=1 and no entity carries `
            + 'PLACEMENT_TAG. A declared slot nobody uses is a claim with nothing '
            + 'behind it.');
    }
    for (const e of t.entities ?? []) {
        const v = e.attrs?.tag;
        if (v === undefined || v === PLACEMENT_TAG) continue;
        if (Number.parseInt(v, 10) >= 0) {
            fail(`procgenPalette: template "${t.instance ?? t.name}" declares tags=1 and its `
                + `"${e.type}" still carries the LITERAL tag "${v}". One placement would `
                + 'then write two rows of the persistence table. (A literal `-1` is '
                + 'allowed — that is the game\'s spelling of UNTAGGED, not a slot.)');
        }
    }
}

/**
 * EVERY **INSTANTIATION**, CHECKED — shapes, terrains, the sentinel slots and
 * the roster's own name uniqueness. Called at module load, for
 * `procgenLevel.assertTerrainColumns`'s own reason: a malformed template is a
 * defect in THIS file and there is no run in which it should reach a level
 * record.
 *
 * ── ⛓⛓⛓ WHAT SLICE 2 CHANGED, AND WHY IT IS STRICTLY MORE ────────────
 *
 * It used to walk one frozen row per template. It now walks the CARTESIAN
 * PRODUCT of each template's declared domains and runs every one of the same
 * per-row checks against the concrete row `instantiate` returns — footprint
 * non-empty and duplicate-free, terrain in `TERRAIN` and inside the footprint,
 * entities inside the footprint, `door` valid, and both sentinel-slot
 * invariants. ⛔ A domain value that produced a malformed row would otherwise
 * be a defect nobody meets until a seed happens to draw it.
 *
 * ── THE LOAD-TIME COST, STATED WITH ITS COUNT ─────────────────────────
 *
 * **41 instantiations for `pre-sword` and 43 for `post-sword`** — 84 at module
 * load, both palettes (⛓ ARC 3 SLICE 1: 42/44 before `arrow-lane`'s single
 * zero-parameter instantiation left with the row):
 *
 *   `wall-segment`               ori(2) x len(4)   =  8
 *   `water-pool`                 w(3)   x h(3)     =  9
 *   `pit-patch`                  w(3)   x h(2)     =  6
 *   `wall-gap-block`             ori(2) x gap(8)   = 16
 *   `wall-gap-lock-weigh`        ori(2)            =  2
 *   `wall-gap-spinner-killlock`  ori(2)            =  2   (post-sword only)
 *
 * Every one is pure object construction — no solve, no world build — so the
 * whole check is arithmetic on frozen literals. ⚠ THE NUMBERS ARE ALSO A BOUND:
 * a template whose domains multiplied into thousands would make this a cost
 * rather than a check, and the day one does, the enumeration needs a stated
 * SAMPLE instead (⚖ kickoff §3.1 already names that as the escape and requires
 * it be stated). `procgenPalette.test.js` asserts these counts FROM the roster
 * so the table above cannot go stale silently.
 */
export function assertPalette(palette = PRE_SWORD_PALETTE) {
    const names = new Set();
    if (!palette?.templates?.length) {
        fail('procgenPalette: a palette with no templates is not a palette.');
    }
    for (const base of palette.templates) {
        if (typeof base.name !== 'string' || names.has(base.name)) {
            fail(`procgenPalette: template names must be unique and non-empty — `
                + `"${base.name}" is not. The trace keys on the name and two rows with one `
                + 'name would count as one family member twice (trap 199).');
        }
        names.add(base.name);
        if (typeof base.family !== 'string' || !base.family) {
            fail(`procgenPalette: template "${base.name}" has no family. The report counts `
                + 'by family and an unnamed one would be counted as "undefined".');
        }
        if (typeof base.instantiate !== 'function' || !Array.isArray(base.params)) {
            fail(`procgenPalette: template "${base.name}" is not a PARAMETERIZED template `
                + '— it needs an `instantiate(rng, overrides)` and a `params` SCHEMA ARRAY '
                + '(⚖ ruling 2). A frozen row reaching the roster would place fine and '
                + 'never appear in a domain sweep, which is a template nobody certified.');
        }
        /**
         * ⛓⛓ ARC 3 SLICE 1 — THE SITE CLASS, CHECKED WHERE THE ROW'S MEANING
         * IS CHECKED — and AFTER the parameterized-row refusal, because a frozen
         * row has no `site` either and would otherwise meet a sentence about site
         * classes when its real problem is that it is not a template at all (⛓ the
         * ORDER was found by this file's own frozen-row test, not by reasoning). `templateContract.defineTemplate` asserts the TYPE (a
         * non-empty string) because it imports nothing; the VOCABULARY is
         * asked here, beside every other "what does this row mean" question,
         * against `procgenCore/sites.SITE_CLASSES`.
         *
         * ⛔ AN UNKNOWN CLASS WOULD BE SILENT OTHERWISE: `anchorsFor` would ask
         * the model for a class it does not derive, get a refusal deep inside
         * `siteCells`, and the template would read as one nobody can place —
         * the named-arm-nobody-built shape, one field over (the same argument
         * the `door: 'h'|'v'` check below is here for).
         */
        if (!SITE_CLASSES.includes(base.site)) {
            fail(`procgenPalette: template "${base.name}" declares site `
                + `${JSON.stringify(base.site)}, which is not one of `
                + `[${SITE_CLASSES.join(', ')}]. A site class names WHERE the free loop `
                + 'proposes anchors from (`procgenCore/sites.js`); an unrecognised one '
                + 'would leave the row unplaceable with no reader ever told why. ⛔ It is '
                + 'not a legality rule — a DIRECTED placement outside the class stays '
                + 'legal, and a class this skeleton has none of is an honest NO_ANCHOR.');
        }
        for (const values of enumerateValues(base)) {
            const t = base.instantiate(null, values);
            const where = `template "${t.instance}"`;
            if (t.name !== base.name || t.family !== base.family) {
                fail(`procgenPalette: ${where} came back naming "${t.name}"/"${t.family}" `
                    + `rather than its base "${base.name}"/"${base.family}". The base name `
                    + 'is the roster key and the family is what the report counts, so a '
                    + '`build` that renamed either would split one family into instances.');
            }
            if (!t.params || Array.isArray(t.params) || typeof t.params !== 'object') {
                fail(`procgenPalette: ${where} carries \`params\` that is not a VALUES `
                    + 'OBJECT. The base\'s `params` is the SCHEMA ARRAY and an instance\'s '
                    + 'is the values it was built from; the trace and the pin union both '
                    + 'read the second one.');
            }
            if (typeof t.instance !== 'string' || !t.instance) {
                fail(`procgenPalette: template "${base.name}" produced an instance with no `
                    + 'label. The pane prints it and a reader identifies a row by it.');
            }
            if (!Array.isArray(t.footprint) || t.footprint.length === 0) {
                fail(`procgenPalette: ${where} has an empty footprint — a template that `
                    + 'occupies no cell cannot be placed legally or illegally.');
            }
            const seen = new Set();
            for (const c of t.footprint) {
                const key = `${c.dx},${c.dy}`;
                if (seen.has(key)) {
                    fail(`procgenPalette: ${where} names cell (${key}) twice in its `
                        + 'footprint. `withTerrain` refuses a doubled cell BY NAME, so this '
                        + 'would be an illegal placement at every anchor in the room.');
                }
                seen.add(key);
            }
            for (const w of t.terrain ?? []) {
                if (!TERRAIN[w.terrain]) {
                    fail(`procgenPalette: ${where} writes terrain "${w.terrain}", which is `
                        + `not one of the PoC's four (${Object.keys(TERRAIN).join(', ')}).`);
                }
                if (!seen.has(`${w.dx},${w.dy}`)) {
                    fail(`procgenPalette: ${where} writes (${w.dx},${w.dy}), which is not `
                        + 'in its own footprint. The footprint is what the legality check '
                        + 'reserves, so a write outside it would paint a cell nobody '
                        + 'checked was free.');
                }
            }
            // ⛔ SLICE 4e: a `door` typo would SILENTLY DISABLE the legality
            // rule that keeps the kill-lock family from aborting runs, and the
            // template would still place — the named-arm-nobody-built shape,
            // one field over. ⛓ Slice 2: `door` is DERIVED from a parameter
            // now, so this runs against every value of it.
            if (t.door !== undefined && t.door !== 'h' && t.door !== 'v') {
                fail(`procgenPalette: ${where} has door "${t.door}"; the rule in `
                    + '`procgenSeedling.legalAt` reads \'h\' or \'v\' and anything else '
                    + 'would be silently ignored — a legality gate that does not gate.');
            }
            assertDoorCells(t, seen);
            for (const e of t.entities ?? []) {
                if (typeof e.type !== 'string' || !seen.has(`${e.dx},${e.dy}`)) {
                    fail(`procgenPalette: ${where} places entity "${e.type}" at `
                        + `(${e.dx},${e.dy}), which is not in its footprint.`);
                }
            }
            assertGroupSlot(t, seen);
            assertTagSlot(t);
        }
    }
    return true;
}

assertPalette();
// ⛔ BOTH biomes, at load. The post-sword roster is the pre-sword one plus a
// sword-gated family, so this is the check that fires on the day a template
// reaches one biome and not the other.
assertPalette(POST_SWORD_PALETTE);
