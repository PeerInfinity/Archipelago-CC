/**
 * seedlingDemo/watchViewer — watch a tape replay, in the browser.
 *
 * ⚠ TOOLING ONLY. This page makes no claims, gates nothing, and nothing
 * that DOES make a claim may depend on it. The gates are vitest (JS stream
 * == the committed oracle recording) and
 * `scripts/procgen/verify-seedling-bot-differential.mjs` (the live game ==
 * those recordings); a viewer is a window onto the same run, not a third
 * opinion about it. What this page IS, and its named limits:
 * `docs/json/developer/procgen/seedling-bot.md` § "The editor arc".
 *
 * ⚠ That citation used to be `CC/docs/plans/seedling-bot-watch-page.md`,
 * which has not existed on disk since the docs migration moved it under the
 * gitignored `NewDocs/` — i.e. the page's only stated design reference was
 * unreachable to every reader who did not have this working machine. It now
 * points at the TRACKED section.
 *
 *   watch.html?tape=<repo-relative path>&side=js|wasm[&speed=N]
 *
 * `side=js`   steps `tapeRunner.createTapeStepper` on an animation-frame
 *             pacer and draws the level, the player and the model state the
 *             observation stream cannot carry. Works anywhere — it needs
 *             only the committed atlas and a committed tape.
 * `side=wasm` iframes the recompiled game and drives its own bot callbacks.
 *             Local-only BY NATURE: the wasm artifact is gitignored and
 *             there is no CI build in either repo.
 *
 * ⚠ IT RENDERS RAW TRUTH. No position smoothing, no interpolation between
 * ticks, no eliding of dead frames — they are counted and shown. The whole
 * value of watching a replay is seeing what the model actually did, and a
 * viewer that tidies it up is a viewer that hides the next divergence. The
 * terrain readout shows the RAW state and the EFFECTIVE one side by side
 * for the same reason: `noHazards` is exactly the difference between them.
 *
 * ⚠ AND IT DOES NOT OWN A TICK LOOP. `createTapeStepper` is the incremental
 * face of `runTape` — one loop, two faces, pinned in `tapeRunner.test.js`
 * by stepping every committed fixture to completion and comparing byte for
 * byte. A private loop here would be the verifier-shared-assumption trap in
 * tooling clothes.
 *
 * ── SOURCE = SOLVE (editor arc slice 1) ───────────────────────────────
 *
 * A second way to get a tape: instead of fetching one, SOLVE one. The page
 * takes a level, a tape v8 staging block and a goal list, runs
 * `solveSegment` to completion IN THE PAGE, folds the result with the one
 * fold, and hands the tape to the SAME collect-then-scrub machinery above
 * (⚖ solve-then-scrub, kickoff §1.2 — a live think-mode is deferred on the
 * measured latency, which is why the wall clock is displayed rather than
 * merely taken).
 *
 * ⛔ Every one of the three laws survives it. It makes NO CLAIM: the solved
 * tape is a thing to look at, it is never written to `fixtures/` (the
 * roster is disk-derived, so a saved experiment would silently join the
 * differential), and no gate consumes it. It is RAW TRUTH: the solver's
 * refusals are surfaced with their own message and their trace rows, an
 * ambiguous default exit is reported rather than guessed, and the solve's
 * cost is shown in milliseconds. And it adds NO LOOP: `solveSegment`
 * advances the run, the stepper replays it, and this file drives neither.
 *
 * ⛔ IT ALSO BUILDS NO WORLD OF ITS OWN. The run comes from
 * `createRunForStaging` — the construction `createTapeStepper` uses — so
 * the world the solver senses is the world the replay runs. See
 * `watchSolve.js`, which holds everything here that is pure.
 *
 * ── OVERLAYS + THE TRACE PANE (editor arc slice 2) ────────────────────
 *
 * Eight independently toggleable layers over the same canvas — the player
 * trail, the movers' paths, and markers for actions, damage and events —
 * plus a pane rendering the decision trace beside them.
 *
 * ⛔ ALL THREE LAWS SURVIVE IT, and each one bites somewhere specific:
 *
 * NO LOOP: every mover position is SAMPLED from the live run through
 * `createTapeStepper`'s `onTick` hook, once per tick, inside the collect
 * loop that was already running. A layer that re-stepped the world to find
 * out where a spinner was would be a second cost model with pixels.
 *
 * RAW TRUTH: sampled positions, one per tick, never interpolated; a marker
 * stands at the position the run held on the tick its ledger names, and a
 * ledger row that cannot be placed there — `earnedClears` carries no tick —
 * is REPORTED by name rather than dropped or invented.
 *
 * NO CLAIM: the pane renders the trace the solver produced (or the sidecar
 * beside a committed tape, through the producer's own validator) and
 * nothing gates on any of it. See `watchOverlays.js`, which holds
 * everything here that is pure.
 *
 * ── SOURCE = MANUAL, AND TAPE I/O (editor arc slice 3) ────────────────
 *
 * A third way to get a tape: DRIVE one. Keyboard → held set →
 * `run.advance` on the page's own pacer, every tick recorded; STOP folds
 * the session with the one fold and hands it to the REPLAY machinery above.
 *
 * ⛔ THE NO-LOOP LAW SURVIVES IT, and the distinction is the one the law
 * exists for. What it forbids is a second REPLAY loop — two readers of one
 * tape drift, and the one nobody tests is the one that drifts. A manual
 * drive is a PRODUCER, beside `solveSegment` and `botDriverV1/V2`: keys in,
 * `perTick` out, with no tape it claims to reproduce. ⛓ And the join is
 * ASSERTED rather than asserted-by-comment: STOP runs
 * `watchManual.foldRoundTrip`, which replays the fold through
 * `createTapeStepper` and compares EVERY observation and EVERY held set
 * against what the drive recorded. That comparison is the acceptance row.
 *
 * ⛔ RAW TRUTH SURVIVES IT: the live overlays are the replay's own
 * `sampleMovers`/`extractMarkers` calls over the session's real
 * observations, never a smoothed or predicted view; a refusal mid-drive
 * carries the run's own message WITH its tick and keeps the session, so
 * what was driven up to it can still be folded and looked at.
 *
 * ⛔ NO CLAIM SURVIVES IT: a hand-driven tape is never written to
 * `fixtures/`. It lives in the save box, in a download, and in your hands.
 *
 * ⚠ ONE NEW LIFETIME RULE CAME WITH IT — `replayGeneration`. Every arm used
 * to replay exactly once per document, because every way of leaving one
 * NAVIGATED; a pasted tape and a manual fold have no path to navigate to, so
 * two animation loops can now exist. The counter retires the superseded one.
 * It is NOT a conditional re-arm: within a generation a throw still re-arms
 * and reports its tick, which is R4's lesson and stays.
 *
 * ⛓⛓ AND THE SWITCH ARC GENERALISED IT (`watchLifetime`): the SOURCE
 * selector no longer navigates either, so ARMS now supersede each other in
 * one document too. Two counters, two questions — a manual fold supersedes a
 * REPLAY without ending the MANUAL arm that started it.
 */

/**
 * ⛓⛓ SLICE 11: `LevelWorldError` IS IMPORTED FOR ITS CLASS, not for a message
 * match — the GENERATE arm's edit-solve catches THAT class and only on a
 * record that carries manual edits (see `show`'s `certifying` pass). Traps
 * 171/173: the ORACLE's catch is untouched.
 */
import { buildLevelWorld, LevelWorldError, TILE_SIZE } from './levelWorld.js';
import { levelSourceFromAtlas } from './atlasSource.js';
/**
 * ⛓ THE ▶ LOAD-IN-WASM PAYLOAD BUILDERS — the ONE fold (`buildStagedTape`) and
 * the ONE exporter/validator/chunker the CLI rows already use. ⛔ All four are
 * headless-safe by their own docblocks (no `node:` imports, no DOM), which is
 * why a browser page may import them at all.
 */
import { buildStagedTape } from './botDriverV1.js';
import { buildLevelSet } from './levelSetExporter.js';
import { planLevelSetChunks, validateLevelSet } from './levelSetValidator.js';
import { createRunForStaging, rolesForStaging, solveStaging } from './tapeRunner.js';
/**
 * ⛓⛓⛓ R9 SLICE 2 — THE DIRECTOR, **IMPORTED**, NEVER RE-SPELLED (⚖ ruling 10).
 *
 * R5 built one page / N windows / zero re-boots after the first, and drove it
 * from a Windows Playwright script; `seedlingDemo/director.js` has been its
 * model since, with no imports of its own so that a browser can load it —
 * and until this slice NOTHING in `frontend/` imported it. The boundary rules
 * the page applies are that module's, called; a page that re-spelled them
 * would be two directors agreeing until one was edited.
 */
import {
    boundaryFindings, campaignChoice, continuationAdmission, expandSequence,
    formatTapesParam, jsLiveEnvelope, PAGE_CHAINS, parseTapesParam, refusalsOnly,
    sequenceAdmission, streamBoundaryFindings,
} from './director.js';
/**
 * ⛓ R9 SLICE 10 — the ledger and the seam-field reader, IMPORTED rather than
 * re-spelled. `chainGoalFindings` credits a chain in node with exactly these
 * two functions; the campaign readout credits the RUN with the same two, so
 * the page and the acceptance cannot drift into two opinions about what
 * "earned" means. `r7Acceptance.js` imports only `tapeFormat`/`rng` and is
 * already loaded in the browser by `watchWasm.js`.
 */
import { goalEarnedWitness, R7_GOAL_LEDGER, seamBootFields } from './r7Acceptance.js';
import {
    censusGoalOptions, censusWorld, defaultGoalsFromCensus, formatGoalsParam,
    harvestPresets, itemFlagsOf, ITEM_FORM_FIELDS, parseGoalsParam, readSolveParams,
    solveForPage, stagingFromJson, TRUE_START_CHAIN, TRUE_START_SEGMENT, withItemFlag,
} from './watchSolve.js';
import {
    activeTraceIndex, arrowLanesAt, ATTACK_HOLD_DEFAULT, attackHoldsAt, attackRectsAt,
    bodiesAt, channelSummary, collectRun, crushersAt, dangerQueriesAt, defaultLayerSet,
    hammerLinesAt, LAYER_IDS, MARKER_GLYPHS, markersVisibleAt, modelStreamOf,
    OVERLAY_LAYERS, overlaysFor,
    parseAttackHold, parseLayersParam, pathPointsUpTo,
    // ⛓ ⚖ ITEM (v): the still frame samples the run it already holds — the
    // SAME seam the replay and the manual drive read, never a fifth sampler.
    sampleMovers,
    // ⛓ ⚖ ITEM (iv): the static/live partition, answered where the run is.
    staticEnemyBodies,
    SWING_WINDOW_NOTE, traceRowFields,
    traceSidecarPath, worldChangesAt, dialogueAt,
} from './watchOverlays.js';
import {
    clampTick, createManualSession, foldRoundTrip, heldFromCodes, KEYBOARD_ROWS,
    liveOverlaysFor, parseTapeText, readViewParams, serializeTapeText, tapeKeyForCode,
} from './watchManual.js';
import {
    agreementWithPayload, agreementWithTrace, BIOME_NAMES, describeState, displaySolve,
    DIRECTED_ANCHOR_TRIES, applyDirective, describeKeptKind, directedCost, displayStaging,
    ELEMENTS_CONTROL_DEFAULT, ELEMENTS_CONTROL_LIST, elementsAskSpelling, elementsControlValue,
    elementsFromControl,
    generateStep, generationRows, ladderCost, paletteFor, readGenerateParams,
    skeletonCatalogue, tileAtPoint, writeGenerateParams,
} from './watchGenerate.js';
// ⛓ SLICE 7: the ONE formatter/normalizer for a skeleton spec — the identity
// line, the URL bar and this form all spell a room the same way.
import { formatSkeleton } from '../procgenCore/skeletonKinds.js';
/**
 * ⛓⛓ ARC 3 SLICE 5a (D2) — the ONE resolver of a Seedling skeleton spec and the
 * ONE list of the keys this binding spells explicitly. ⛔ The form used to
 * `normalizeSkeleton` its own read, which spells a value at the CODEC's default
 * by ABSENCE — so the `chambers` control SHOWED 0 while the run used Seedling's
 * own default of 1, and a typed 0 was indistinguishable from an omitted one.
 */
import {
    seedlingExplicitSkeletonParams, seedlingSkeletonSpec,
} from './procgenSeedling.js';
/** ⛓ SLICE 5a (D1) — the `?gen=` path re-parses the AREA spec, which
 *  `areaSummaryOf` reports as a STRING (arc-2 §11.5's asymmetry). */
/**
 * ⛓⛓⛓ R9 SLICE 0 — and the AREA controls' own vocabulary with it: the options
 * ARE `KEYS_DOMAIN`/`AREA_PARAM_SCHEMA`, the reset comparison is
 * `formatAreaSpec`'s own spelling, and `formatRequireList` is what puts the
 * directive back in its box. ⛔ Not one of them is re-typed here.
 */
import {
    AREA_PARAM_SCHEMA, KEYS_DOMAIN, formatAreaSpec, formatRequireList, normalizeAreaSpec,
    parseAreaSpec,
} from '../procgenCore/areaSpec.js';
/**
 * ⛓⛓⛓ R9 SLICE 0 — the ELEMENT control's vocabulary, from the codec that owns
 * it: the heads, the head's own params schema, the `none` head's name, the
 * list test, the one formatter and the Seedling `?require=` grammar.
 */
import {
    ELEMENT_NAMES, NONE as ELEMENTS_NONE, formatElementSpec, isElementList,
    parseItemRequireList, paramSchemaFor,
} from '../procgenCore/elementSpec.js';
/**
 * ⛓⛓⛓ ARC 3 SLICE 5a (D4/D5) — the STEP-THROUGH's fold and the three SIBLING
 * overlays. ⛔ `drawGenOverlay`/`drawPaintables` are called AFTER
 * `renderer.draw` on the same canvas; `makeRenderer.draw` and `OVERLAY_LAYERS`
 * are untouched, so the world row's `drawn.*` readouts are unmoved.
 */
/**
 * ⛓⛓⛓ THE WASM SHIP — one mechanism, four callers (REPLAY's `?side=wasm` and
 * the ▶ load-in-wasm button in SOLVE, MANUAL and GENERATE). ⛔ `WASM_PAGE`
 * lives THERE now, beside the sequence that loads it, so the build is named
 * once in the page rather than in a constant one file away from its only use.
 */
import {
    END_STATE_TOLERANCE, levelSetDisagreement, remapStreamRooms, roomOfGeneratedLevel,
    shipToWasm, stagesOf, VERDICT_SCOPE, verdictBlock, WASM_PAGE, WASM_STAGES, verdictOf,
} from './watchWasm.js';
import { foldLedger } from './procgenLedger.js';
import {
    GEN_LAYERS, drawGenOverlay, drawPaintables, genOverlaysFor,
} from './watchGenOverlay.js';
// ⛓ SLICE 4: the catalogue is DATA (`catalogueRows`) and the restriction is a
// palette operation (`restrictPalette`) — both live where palettes live, and
// this file only renders and wires them.
import { catalogueRows, restrictPalette } from './procgenPalette.js';
// ⛓ SLICE 11 adds `TERRAIN_NAMES` — the edit tool's terrain picker is mounted
// from the four-terrain vocabulary itself, so this file keeps no second list.
/**
 * ⛓ SLICE 5a adds `emptyLevel`/`withTerrain`/`withEntities` — the STEP-THROUGH
 * rebuilds phase k's room from the ledger's DELTAS through the record's own
 * pure writers, never by a second construction.
 */
import {
    assertRoomSize, atlasOf, emptyLevel, FILL_DENSE, FILL_MODES, fillByName,
    ROOM_TILES_MAX, ROOM_TILES_MIN, SINGLE_SCREEN_TILES, TERRAIN_NAMES,
    withEntities, withTerrain,
} from './procgenLevel.js';
/**
 * ⛓⛓⛓ SLICE 11 (constructive-mode arc) — FREE TILE / OBJECT EDITING. ⚖ Ruling
 * 8 + §3.8. The ops are PURE and live there; this file is the tool UI, the one
 * canvas click, and the two laws made visible (the identity line's third leg,
 * and UNCERTIFIED-until-SOLVE).
 */
import {
    EDIT_OPS, ENTITY_ROSTER, describeEdit, editState, editStates, undoEdit,
} from './watchEdit.js';
import { createLifetimeHolder } from './watchLifetime.js';
// ⛓ SLICE 4 (constructive-mode arc): ONE summary of this page's state, in the
// shape `procgenCore/labProtocol.js` asks for. ⛔ A PROJECTION of the readouts
// below, never a second derivation — see that file's docblock.
import { watchSummary } from './watchSummary.js';
/**
 * ⛓⛓⛓ THE ENTRANCES — ⚖ the user's item, and the module docblock is where the
 * measurements live (280 teleporters, 112 of 116 levels with an entrance, the
 * four without, and the half-tile between a boot block and a player position).
 */
import {
    BOOT_TO_PLAYER_OFFSET, collectEntrances, entranceLabel, entrancesTo, playerPointFor,
} from './watchEntrances.js';
import { parseDecisionTrace } from './decisionTrace.js';
import { coerceTerrainState, HAZARD_STATES, ITEM_NAMES, parseTape } from './tapeFormat.js';
import { playerBoxAt, terrainProbeRect } from './playerPhysicsV2.js';
// ⛓ GROUP B: the legend states the swing's LENGTH, and it states the engine's
// own number rather than a page-side "5" — the one-spelling law, applied to a
// sentence. See `watchOverlays`' `SLASH_HIT_TICKS` import block.
import { SLASH_HIT_TICKS } from './presses.js';
import { TILE_TYPE_NAMES } from '../flashPanel/seedlingSemantics.js';
/**
 * ⛓ PROCGEN DOCS P2 — THE GLOSSARY, AS TOOLTIPS ONLY. `data-term` in the
 * markup names a slug; the SENTENCE comes from the one module that holds it.
 * ⛔ Nothing here is a readout and nothing here changes a control or a label.
 */
import { applyGlossaryTips, legendTipFor } from '../procgenDocs/glossaryTips.js';


/**
 * ⛓ REPO-RELATIVE PATHS ARE RESOLVED FROM THIS MODULE'S OWN URL, NOT FROM
 * THE ORIGIN'S ROOT. The dev server serves the REPO root, but GitHub Pages
 * (`.github/workflows/deploy-gh-pages.yml`) publishes `frontend/` AS its root
 * under `/<repo>/`, so a root-absolute `/frontend/…` is a 404 there — measured
 * 2026-08-18: every demo-catalogue URL on Pages refused with
 * `atlas: /frontend/modules/flashPanel/atlases/seedling-map.json — HTTP 404`.
 * `import.meta.url` is right in both worlds because `watch.html` loads this
 * module directly (not through the bundle): a repo path under `frontend/` is
 * resolved against the `frontend/` directory this file sits two levels below,
 * and anything outside `frontend/` (only reachable on the dev server anyway)
 * against the repo root. ONE resolver; every fetch of a repo path goes
 * through it.
 */
const FRONTEND_ROOT = new URL('../../', import.meta.url);
const REPO_ROOT = new URL('../../../', import.meta.url);
function repoUrl(path) {
    const p = String(path).replace(/^\/+/, '');
    return p.startsWith('frontend/')
        ? new URL(p.slice('frontend/'.length), FRONTEND_ROOT).href
        : new URL(p, REPO_ROOT).href;
}
const ATLAS_URL = repoUrl('frontend/modules/flashPanel/atlases/seedling-map.json');

const PIT = HAZARD_STATES.pit;

/**
 * Tile colours by TYPE, not by tileset column — the column is a drawing
 * detail and the type is what the physics reads. Anything unlisted falls
 * back to a plain floor colour, which is honest: it walks at 0.8 like the
 * rest.
 */
const TILE_COLOURS = {
    1: '#1d4f7a',   // Water
    6: '#000000',   // Pit — the R1 transport primitive
    10: '#7a6a3a',  // Cliff Stairs
    16: '#4a3f3a',  // Igneous Stone
    17: '#8a2b12',  // Lava
    21: '#c8d6e0',  // Snow
    22: '#8fc7d8',  // Ice
    25: '#2f7fa8',  // Waterfall
    28: '#4b3a63',  // Ghost Tile
    29: '#6b4a2a',  // Bridge — solid until something spears it
    30: '#6a5a83',  // Ghost Tile Step
};
const SOLID_COLOUR = '#3a3a42';
const FLOOR_COLOUR = '#6b6152';

/**
 * ⛓⛓⛓ GROUP B — THE OBJECT SOLIDS, BY FAMILY, AND THE COMPLAINT THAT FORCED
 * IT: *a pushable block and a breakable rock are the same grey box.*
 *
 * They were. Every entity solid — 1219 of them across the atlas's 116 levels —
 * was drawn `#55506a`, so the two things a room's puzzle is usually MADE of
 * were indistinguishable from each other and from a dresser.
 *
 * ⛔ THE KEY IS THE RUN'S OWN JOIN, NOT THE TAG. `levelWorld` stamps exactly
 * one id field per changeable solid (`pushableId`, `rockId`, `chestId`, …) —
 * the same field `liveRectOf` switches on and the same one the world-state
 * layer marks through. Colouring by `s.tag` instead would be a second
 * classification of the same objects: `breakablerock` and `breakablerockghost`
 * are two tags and one family, `lock`/`cover`/`wandlock`/`bosslock`/
 * `shieldlock`/`rocklock`/`grasslock` are seven tags and one, and the day a
 * class was added the palette would quietly fall back to grey while the
 * mechanics kept working.
 *
 * ⛔⛔ MEASURED FIRST: NO SOLID CARRIES TWO OF THESE FIELDS. Over all 116
 * levels — activatorId 70 · rockId 24 · pushableId 19 · chestId 16 · treeId 6
 * · magicalLockId 6 · bridgeId 5 · pulserId 4 · crusherId 4 · ropeId 3 ·
 * turretId 2 · shieldBossId 1 · bossId 1 · finalDoorId 1, and **zero**
 * multi-keyed. So "first field that matches" is a total function here and not
 * a precedence rule that happens to work; if that ever stops being true the
 * order below becomes a silent choice, which is why the measurement is written
 * down rather than assumed.
 *
 * ⚠ 1057 OF THE 1219 CARRY NO FIELD AT ALL and stay grey — trees, poles,
 * spires, statues, furniture. That is the honest answer: they are scenery with
 * no run-changeable state, the legend says so, and a palette that gave every
 * tag its own hue would spend the reader's whole colour budget on the 87% of
 * boxes nothing can happen to.
 */
const OBJECT_SOLID_FAMILIES = Object.freeze([
    Object.freeze({ key: 'pushableId', colour: '#6f5fd0', label: 'PUSHABLE block — a press or a lean moves it one tile' }),
    Object.freeze({ key: 'rockId', colour: '#a8703a', label: 'BREAKABLE rock — a press destroys it' }),
    Object.freeze({ key: 'chestId', colour: '#c0a038', label: 'chest' }),
    Object.freeze({ key: 'activatorId', colour: '#3f7f8a', label: 'lock / cover — opens while its group is held' }),
    Object.freeze({ key: 'magicalLockId', colour: '#8a3f8a', label: 'magical lock — the wand opens it' }),
    Object.freeze({ key: 'treeId', colour: '#3f7a3f', label: 'burnable tree' }),
    Object.freeze({ key: 'ropeId', colour: '#9a7a4a', label: 'rope — a pull SHRINKS it to one cell, it does not vanish' }),
    Object.freeze({ key: 'bridgeId', colour: '#6b4a2a', label: 'bridge — solid until something spears it' }),
    Object.freeze({ key: 'pulserId', colour: '#b04070', label: 'pulser — solid always; its flag makes it HIT' }),
    Object.freeze({ key: 'crusherId', colour: '#c04040', label: 'crusher — charges at a player it can SEE' }),
    Object.freeze({ key: 'turretId', colour: '#7fb0c0', label: 'ice turret — an ENEMY while alive, a wall once dead' }),
    Object.freeze({ key: 'bossId', colour: '#8a5f2a', label: 'boss totem — a wall until the wand WAKES it' }),
    Object.freeze({ key: 'shieldBossId', colour: '#9a4040', label: 'shield boss' }),
    Object.freeze({ key: 'finalDoorId', colour: '#5a5a9a', label: 'final door' }),
]);
/** Scenery: an object solid with no run-changeable state at all. */
const SCENERY_COLOUR = '#55506a';
const objectSolidColour = (s) => {
    for (const f of OBJECT_SOLID_FAMILIES) if (s[f.key]) return f.colour;
    return SCENERY_COLOUR;
};

/**
 * The overlay palette, by channel. Named here and rendered into the LEGEND
 * from the same table, so a colour nobody can identify is impossible —
 * `unknownShapes`' lesson applied to ink instead of geometry.
 */
const PATH_COLOURS = Object.freeze({
    player: '#7fe0ff',
    chaser: '#ff9a6a',
    spinner: '#d05090',
    pushable: '#9a8cff',
    arrow: '#8fc7d8',
});

/**
 * ⛓ SLICE 6's THREE SHAPE LAYERS, and their ink is deliberately NOT the
 * matching path colour.
 *
 * A chaser's PATH is `#ff9a6a` and its BOX is `#ffd0a0`: two readings of one
 * body, one cumulative and one at this tick, and a viewer that painted both
 * in the same colour would make "where it has been" and "where it is"
 * indistinguishable at exactly the moment they matter — the tick something
 * touched something.
 *
 * `hammerTouch` is the second hammer colour and it is the layer's whole
 * point: the line is drawn WHITE-HOT on the ticks the engine's own
 * `hammerHitsPlayer` says it reached the player, so the picture and
 * `run.spinnerContacts` agree on screen and not merely in a readout.
 */
const SHAPE_COLOURS = Object.freeze({
    hitbox: '#ffd0a0',
    /**
     * ⛓⛓⛓ ⚖ ITEM (iv) — A PLACEMENT IS NOT A POSITION, AND THE INK SAYS SO.
     * The live hitbox is `#ffd0a0`, warm; this is the same family COOLED
     * (`#a08a6a`), for `attackHeld`'s reason one channel over: it must read as
     * *the same kind of thing, not live*. A distinct hue would say "a different
     * kind of body"; the SAME hue would make a census placement
     * indistinguishable from a body the run is stepping, which is the whole
     * distinction the layer exists to draw.
     */
    staticEnemy: '#a08a6a',
    hammer: '#ff8fd0',
    hammerTouch: '#ffffff',
    attack: '#ffd75f',
    /**
     * ⛓⛓⛓ GROUP B — THE AFTERIMAGE, AND ITS INK IS A DESATURATED `attack` ON
     * PURPOSE. It has to read as *the same swing, no longer live*: a hue of
     * its own would make it look like a different event, and the FULL `attack`
     * yellow would make a display choice indistinguishable from the tick the
     * engine collided a rect on. So it is the same colour drained, drawn
     * outline-only, and the legend row says the word "display choice".
     */
    attackHeld: '#8a7638',
    /**
     * ⛓ A LANE IS NOT AN ARROW, AND THE INK SAYS SO. `PATH_COLOURS.arrow` is
     * the flights; this is the trap's column. A distinct hue is the legend's
     * job made visible — the two layers answer different questions and a
     * reader who cannot tell them apart on the canvas has the legend's
     * distinction and not the picture's.
     */
    lane: '#7fd4ff',
    /**
     * ⛓⛓⛓ SLICE 9 — THREE INK FAMILIES, AND THE SEPARATION IS THE POINT.
     *
     * `gone`/`swapped`/`notsolid` are CORRECTIONS to the base picture. They
     * are deliberately a colour nothing else on the canvas uses, because the
     * mark's whole content is "the grey box under me is not true" — painting
     * it in the base's own greys would make the correction look like more
     * base.
     *
     * `crusher`/`crusherLane`/`crusherLaneLive` are RAW TRUTH: where the body
     * is and what the run's own scan can see from there.
     *
     * ⛔⛔ `danger`/`dangerClear` ARE NEITHER, AND THE INK SAYS SO LOUDEST.
     * ⚖ Item 9's supersession of §14.4c is conditional on the layer being
     * *explicitly labelled as the bot's heuristic*, and a colour shared with
     * any raw-truth layer would undo that label on the canvas whatever the
     * legend said. This is the one layer on the page that draws an OPINION,
     * so it gets an ink no fact wears.
     */
    gone: '#ff4f9f',
    swapped: '#8fff9f',
    notsolid: '#ffae4f',
    crusher: '#c04040',
    crusherLane: '#7a4040',
    crusherLaneLive: '#ff6a6a',
    danger: '#b070ff',
    dangerClear: '#4a3a70',
});

const $ = (id) => document.getElementById(id);
const fmt = (n) => (typeof n === 'number' ? Number(n.toFixed(4)) : n);

/**
 * ⛓ WHICH REPLAY OWNS THE CANVAS.
 *
 * Every arm used to replay exactly once per page load — leaving one always
 * NAVIGATED — so the animation loop could re-arm itself forever and never
 * meet a successor. Editor slice 3 breaks that: a PASTED tape has no path to
 * navigate to and a MANUAL session's fold has no path at all, so `replayTape`
 * can now run a second time in one document. ⚠ Since the switch arc the
 * SOURCE selector does not navigate either — but an ARM change is
 * `armLifetimes`' question, not this counter's.
 *
 * ⛔ WITHOUT THIS COUNTER THE TWO LOOPS BOTH DRAW. The first one keeps its
 * own `frames`/`cursor` closure and its own rAF chain; the canvas would
 * flicker between two runs and the HUD would disagree with itself every
 * other frame — a failure that looks like a rendering bug and is a lifetime
 * bug.
 *
 * ⚠ THE UNCONDITIONAL RE-ARM SURVIVES INTACT, and the distinction matters:
 * within a generation the loop still re-arms after a THROW (R4's lesson —
 * a frame that cannot be drawn must report its tick, not stop the clock).
 * What stops a loop is being SUPERSEDED, which is a decision, not a failure.
 */
let replayGeneration = 0;

/**
 * Replay a tape this page is HOLDING (a paste, an upload, a manual fold).
 *
 * Assigned by whichever arm knows the level source; the default refuses by
 * name rather than doing nothing, because "the button did nothing" is the
 * one outcome a user cannot act on.
 */
let replayLoadedTape = () => {
    fatal('this page has no level source, so a loaded tape cannot be replayed here',
        'the wasm side (`?side=wasm`) drives the recompiled game and does not build JS '
        + 'worlds. Load the tape with &side=js.');
};

/**
 * ⛓⛓⛓ WHICH ARM OWNS THE PAGE — the second lifetime question, and NOT the
 * one `replayGeneration` answers (see `watchLifetime`'s docblock for why the
 * two must stay separate: a manual fold supersedes a REPLAY without ending
 * the MANUAL arm that started it).
 *
 * ⚠ IT LANDED ONE SLICE BEFORE ITS FIRST USER, deliberately: the teardown was
 * built and proved while the selector still navigated and a document teardown
 * still retired everything anyway. A teardown written in the same commit as
 * the switch that needs it is a teardown tested only through that switch.
 *
 * The readout is what the browser row asserts on. It names the live arm and
 * keeps the retired ones, because "did the manual loop stop when I left it"
 * is a question about the past.
 */
const armLifetimes = createLifetimeHolder();

/**
 * ⛔⛔ A **GETTER**, AND THE FIRST CUT WAS AN ASSIGNMENT — measured, by the
 * browser row, which came back with an EMPTY `stopped` list for a loop it had
 * just watched stop.
 *
 * The holder publishes on every change, so the assignment ran at the instant
 * the switch happened. A retired loop's one blocked tick lands AFTER that
 * instant — it is the frame that was already scheduled — so the published
 * object was frozen one tick before the only evidence anybody reads it for.
 * ⚖ The same readout-assigned-from-a-getter trap the holder's own history hit
 * one level down, which is worth saying twice: a leak witness that is a
 * SNAPSHOT cannot see the leak, because leaks are what happens next.
 */
Object.defineProperty(window, '__editorLifetime', {
    get: () => armLifetimes.state(),
    configurable: true,
});

function readParams() {
    const q = new URLSearchParams(window.location.search);
    /**
     * ⛓ THE GENERATE ARM'S PARAMETERS, parsed where they are testable — and
     * its `source` WINS when it applies. `?source=generate` says so outright
     * and `?gen=` is unambiguous (nothing else in the page's vocabulary
     * spells it); everything else the arm reads (`?seed=`, `?count=`) is a
     * bound, not a selector, so a stale SOLVE link cannot land here.
     */
    const gen = readGenerateParams(window.location.search);
    return {
        gen,
        tape: q.get('tape'),
        /**
         * ⛓⛓⛓ R9 SLICE 2 — THE SEQUENCE, beside the single tape and in the
         * ONE reader (⚖ ruling 10, §6 Q6). `,` is the page's list separator,
         * already spelled by `?layers=` and `?goals=`; the decision is
         * `director.parseTapesParam`'s, which is pure, tested, and keeps
         * ABSENT (`null`) distinguishable from EMPTY (`[]`) — a `?tapes=`
         * with nothing in it is a URL a reader can produce, and it must not
         * silently become the single-tape arm.
         */
        tapes: parseTapesParam(q.get('tapes')),
        side: (q.get('side') || 'js').toLowerCase(),
        speed: Number(q.get('speed') || 1),
        // ⚠ RAW. `parseLayersParam` is where it is decided, and it is pure so
        // the decision is tested; an absent parameter is not an empty one.
        layers: q.get('layers'),
        // ⛓ GROUP B: `?attackhold=N`, raw for the same reason — the decision
        // is `parseAttackHold`'s, which is pure and reports a bad value by
        // name instead of silently falling back.
        attackHold: q.get('attackhold'),
        // The SOLVE arm's own parameters, parsed where they are testable.
        ...readSolveParams(window.location.search),
        // ⛓ …and the VIEW parameters (`?tick=`, `?shot=`), for the same
        // reason and in the same shape. Both are pure decisions about a
        // string, so both are decided where a test can reach them.
        ...readViewParams(window.location.search),
        // ⛔ LAST, so it WINS over `readSolveParams`' inference. `?gen=` with
        // no `?source=` has to select GENERATE, and `readSolveParams` would
        // have already answered `replay` for that URL.
        ...(gen.isGenerate ? { source: 'generate' } : {}),
    };
}

function fatal(message, detail = '') {
    $('status').className = 'bad';
    $('status').textContent = message;
    $('detail').textContent = detail;
}

/**
 * ⛔⛔⛓ R9 SLICE 11b — **ONE FETCH FOR EVERY COMMITTED ARTIFACT THIS PAGE
 * READS, AND IT IS UNCACHEABLE.** ⚖ Ruling 32 C, trap 557.
 *
 * ── THE FAILURE THIS EXISTS TO MAKE IMPOSSIBLE ────────────────────────
 *
 * R9 slice 11 re-recorded four tapes and then read ONE ship-gate red at
 * `boundary 2/3` with every delta exactly 32 — the re-record's own number,
 * arriving as if it were a boot regression. The tree had not changed, the
 * pipeline had written nothing, and two re-runs came back 245/0. Cause
 * UNPROVEN (§21.9), most likely a stale response for a tape whose bytes had
 * just been rewritten. ⛔ It cost ~40 minutes and it was diagnosed as a
 * regression before the re-run refuted it.
 *
 * ⇒ a tape's bytes are read through HERE and nowhere else, with
 * `cache: 'no-store'`, so "the page is holding the previous recording" stops
 * being one of the things a red can mean. **The unification is half the fix**:
 * before this the bytes arrived down FIVE separate `fetch(` calls (the
 * `?tape=` load, the trace sidecar, the roster manifest, the directory
 * listing, the per-tape roster read), and busting four of five is a bug that
 * looks exactly like a fix.
 *
 * ⚠ WHERE THIS ACTUALLY BITES, measured: `python -m http.server` sends no
 * `Cache-Control` at all, and Chrome's heuristic freshness is 10% of the
 * document's age — a tape written seconds ago is revalidated, so the LOCAL
 * dev server is not the dangerous host. **GitHub Pages sends
 * `Cache-Control: max-age=600`**, and against that shape a second read of a
 * rewritten file returns the OLD bytes with no request on the wire at all.
 * The measurement is in the slice's as-built with the command that took it.
 *
 * ⛔ `cache` is set LAST so a caller cannot override it. The two
 * `only-if-cached` probes further down are NOT artifact reads — they measure
 * the cache rather than trusting it, and they stay as they are.
 */
function fetchArtifact(url, init = {}) {
    return fetch(url, { ...init, cache: 'no-store' });
}

async function fetchJson(url, what) {
    const res = await fetchArtifact(url);
    if (!res.ok) throw new Error(`${what}: ${url} — HTTP ${res.status}`);
    return res.json();
}

/**
 * ── ⛔⛔ CLEAR THE READOUTS, KEEP THE INPUTS ───────────────────────────
 *
 * The reload used to do this too, and indiscriminately. Doing it by hand
 * forces the distinction the reload never had to make, and the two halves
 * answer to different laws:
 *
 * A READOUT is a statement about a run — the status bar, the detail line, the
 * HUD, the legend, the trace panes, the progress bar, the canvas, and the
 * `window.__editorX` objects the browser rows assert on. Left standing across
 * a switch it becomes a statement about a run that is no longer on screen,
 * which is the RAW TRUTH law's plainest violation: a refusal from the SOLVE
 * arm sitting above a MANUAL session, describing nothing.
 *
 * AN INPUT is the user's own work — the boot boxes, the tape box, the goal
 * list, the seed and bounds. Clearing those is the thing this whole arc
 * exists to STOP doing. ⚠ So they are not listed here, and the omission is
 * the feature.
 */
function resetPageChrome() {
    $('status').className = '';
    $('status').textContent = '';
    $('detail').textContent = '';
    $('title').textContent = '';
    $('hud').innerHTML = '';
    $('legend').innerHTML = '';
    $('layers').innerHTML = '';
    $('trace').innerHTML = '';
    $('genTrace').innerHTML = '';
    $('bar').style.width = '0%';
    $('scrub').max = '0';
    $('scrub').value = '0';
    const canvas = $('canvas');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    /**
     * ⛔ THE PAGE'S OWN READOUTS GO WITH THEM. `check-seedling-editor-*.mjs`
     * read these to decide whether the arm did what it claims, and a stale
     * `__editorSolve` under a live GENERATE would let a row assert a PASS
     * against the arm before last — a verifier reading the wrong run and
     * agreeing with it.
     */
    delete window.__editorSolve;
    delete window.__editorManual;
    delete window.__editorGenerate;
    delete window.__editorGenerated;
    // ⛓ R9 slice 2: and the SEQUENCE's, for the same reason — a `window 2 of
    // 2` left standing over the arm you switched to describes a walk that is
    // no longer on screen.
    delete window.__editorSequence;
    // ⛓ And "an arm has finished mounting" is a claim about the arm that just
    // left. Cleared here, it becomes the honest thing to wait on: it reappears
    // only when the ARRIVING arm is done (see `mountArm`).
    delete window.__editorArm;
    /**
     * ⛓ AND THE SHIP'S READOUT, WITH ITS PANEL. A `wasm verdict: agrees` left
     * standing over the arm you switched TO would be a statement about a run
     * that is no longer on screen — the RAW TRUTH law's plainest violation,
     * and the one this readout is most likely to commit because a ship
     * outlives the press that started it.
     */
    delete window.__editorWasm;
    $('wasmPanel').hidden = true;
    $('wasmStage').textContent = '';
    $('wasmStages').textContent = '';
    $('wasmVerdict').textContent = '';
    $('wasmVerdict').className = '';
    $('wasmHud').innerHTML = '';
    // ⛓ SLICE 4: `__watch` is a PROJECTION of the four above, so it goes with
    // them — a summary that outlived its sources would be the one readout on
    // this page describing a run nobody can see.
    delete window.__watch;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ SLICE 4 (constructive-mode arc) — THE HOST SEAM
 * ══════════════════════════════════════════════════════════════════════
 *
 * Three module-level names, and every one of them is inert standalone.
 * `NewDocs/plans/seedling-constructive-mode-kickoff.md` §3.5.
 */

/**
 * ⛓ The optional host bridge (`watchBridge.js`), `null` standalone. ⛔ NEVER
 * FETCHED without `?iframeId=` — the editor arc's ruling that this page is a
 * standalone document is unchanged, and a network probe in
 * `check-seedling-editor-boot.mjs` gates it.
 */
let hostBridge = null;

/**
 * ⛓⛓ THE PAYLOAD A HOST HANDED OVER, WAITING FOR THE ARM THAT READS IT.
 *
 * ⛔ THIS IS THE `?gen=` PATH'S OWN INPUT, DELIVERED BY HAND. `runGenerate`
 * fetches a payload when `?gen=` names one and then REGENERATES from its
 * identity and COMPARES; a `procgenLab:load` supplies the same object where
 * the fetch would have produced it, and every line after that is unchanged.
 * The alternative — a second "display this level" path — would be a level on
 * screen that the page never generated, on a page whose entire claim is that
 * everything it draws came out of the loop in the page.
 *
 * ⚠ CONSUMED ONCE, by the next generate mount. A payload left standing would
 * silently own the arm after the reader pressed something.
 */
let pendingHostPayload = null;
export const takePendingHostPayload = () => {
    const p = pendingHostPayload;
    pendingHostPayload = null;
    return p;
};

/**
 * ⛓ PUBLISH `window.__watch` AND TELL THE HOST. One call, from the places the
 * page's own readouts are written — so the summary, the readouts and the
 * host's status line are one statement made once.
 */
function publishWatch(source) {
    window.__watch = watchSummary({
        source,
        href: window.location.href,
        generate: window.__editorGenerate ?? null,
        generated: window.__editorGenerated ?? null,
        // ⛓ The ship's readout, PROJECTED like the other four — `watchSummary`
        // adds no truth of its own, it quotes what the page already wrote.
        wasm: window.__editorWasm ?? null,
    });
    hostBridge?.announce();
    return window.__watch;
}

/**
 * ── ⛓⛓⛓ THE BLOCK AN ARM MOUNTS FROM, AND WHY THE BOX WINS ───────────
 *
 * ⛔ A BOX THAT ALREADY HOLDS A BLOCK BEATS `?boot=`. This is the whole point
 * of switching in place: you edit the starting conditions in SOLVE, look at
 * them in MANUAL, come back — and find your own block, not the one the URL
 * names. On a fresh document the box is empty and the URL wins, exactly as it
 * always did, so every existing link still opens what it always opened.
 *
 * ⚠ AND IT IS SAID OUT LOUD. The URL stops being the page's whole state the
 * moment this rule fires, so the note names where the block came from — a
 * view showing edits the link does not carry must not look like a view of the
 * link.
 *
 * ⛔⛔ UNPARSEABLE TEXT IS **KEPT AND REPORTED**, never replaced. Re-fetching
 * over it would delete the user's work at precisely the moment they most want
 * it back (they were mid-edit), and "the box was wrong so the page threw it
 * away" is not a recovery. The arm refuses to mount instead, with the
 * parser's own message — the same answer the boot form gives to the same
 * text.
 */
async function stagingForMount(boxEl, params) {
    const held = boxEl.value.trim();
    if (held) {
        let staging;
        try {
            staging = stagingFromJson(JSON.parse(held));
        } catch (e) {
            throw new Error('the block already in this tab\'s box will not parse, and it is '
                + 'KEPT rather than overwritten with what ?boot= names — fix it, or pick a '
                + `preset to load another one. The parser's own message: ${e.message}`);
        }
        return {
            staging,
            origin: 'THE BLOCK ALREADY IN THIS TAB\'S BOX — your own edits, kept across the '
                + `SOURCE switch and NOT re-read from ${params.boot ? `?boot=${params.boot}` : 'the true game start'}`,
            kept: true,
        };
    }
    if (params.boot) {
        const path = params.boot.replace(/^\/+/, '');
        return { staging: stagingFromJson(await fetchJson(repoUrl(path), 'boot')), origin: path, kept: false };
    }
    return {
        staging: await trueStartStaging(),
        origin: `THE TRUE GAME START — ${TRUE_START_SEGMENT}'s boot block `
            + `(${TRUE_START_CHAIN} segment 1)`,
        kept: false,
    };
}

// ── side=js ──────────────────────────────────────────────────────────────

/**
 * Everything the viewer draws, per level, cached the same way the runner
 * memoises worlds. Built with the census the TAPE implies, exactly as
 * `runTape` picks it — a viewer that consulted a different census could
 * refuse to draw a level the run happily walks through.
 */
function makeRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    const trail = [];
    let scale = 1;
    /**
     * Hazard shapes this renderer does not know how to draw.
     *
     * Collected rather than thrown: a viewer that cannot draw one volume
     * should still draw the level. Surfaced by the caller, so a fourth shape
     * is a line in the detail bar rather than a silently missing rectangle —
     * or, as it was before R4, a dead animation loop.
     */
    const unknownShapes = new Set();

    /**
     * Size the canvas to a level, at the largest INTEGER scale that fits.
     *
     * ⚠ THE 560 IS A BUDGET, NOT A CLAMP. `Math.max(1, ...)` wins, so a
     * level taller than 560 px is drawn at scale 1 and the page scrolls —
     * which is the honest arm: the alternative is a fractional scale, and a
     * pixel-art canvas at 0.58x is a blurred lie about where the player is.
     * Level 12 is 640x960 and really does need 960 px of canvas.
     */
    function fit(world) {
        const w = world.width * TILE_SIZE;
        const h = world.height * TILE_SIZE;
        scale = Math.max(1, Math.min(
            Math.floor((canvas.parentElement.clientWidth - 8) / w),
            Math.floor(560 / h),
        ));
        canvas.width = w * scale;
        canvas.height = h * scale;
    }

    /**
     * Is the canvas already the right size for this level?
     *
     * ⛔ BOTH DIMENSIONS, and testing only the width was a real bug with a
     * real symptom: *"some maps, like level 12, display at the wrong height,
     * so the bottom part of the map is not displayed."*
     *
     * The R4 walk enters L37 (640x320) immediately before L12 (640x960).
     * Both are 640 px wide and L37 sits at scale 1, so a width-only guard
     * saw `canvas.width === 640 * 1`, skipped the refit, and drew L12 into a
     * canvas 320 px tall — **the top third of the level, and no indication
     * that the other 640 px existed.** It bites exactly when consecutive
     * levels share a pixel width at the same scale, which is why it looked
     * like "some maps".
     *
     * Phrased as "the canvas is world dimensions times ONE uniform scale",
     * because that is the invariant `fit` establishes and the thing a
     * consumer can check.
     */
    const fitted = (world) => canvas.width === world.width * TILE_SIZE * scale
        && canvas.height === world.height * TILE_SIZE * scale;

    const rect = (r, fill, alpha = 1) => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fill;
        ctx.fillRect(r.x * scale, r.y * scale,
            (r.right - r.x) * scale, (r.bottom - r.y) * scale);
        ctx.globalAlpha = 1;
    };
    const outline = (r, stroke, width = 1) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.strokeRect(r.x * scale + 0.5, r.y * scale + 0.5,
            (r.right - r.x) * scale - 1, (r.bottom - r.y) * scale - 1);
    };

    /**
     * One sampled position, as a device-pixel dot.
     *
     * ⚠ THE SAME ROUNDING THE BREADCRUMB TRAIL USES, and for the same
     * reason: a 1x1 rect at a half-pixel offset is anti-aliased across four
     * pixels at ~25% alpha each, which at scale 1 makes a whole path nearly
     * invisible. It is a rasterisation detail, not smoothing — nothing about
     * the sampled position itself is adjusted, and the HUD still reports the
     * exact doubles.
     */
    const dotAt = (x, y, colour, alpha = 1) => {
        const d = Math.max(1, scale);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colour;
        ctx.fillRect(Math.round(x * scale) - (d >> 1), Math.round(y * scale) - (d >> 1), d, d);
        ctx.globalAlpha = 1;
    };

    /**
     * ⛓ SLICE 6 — a LINE in world coordinates, for the hammer.
     *
     * ⛔ THE ENDPOINTS ARE NOT ROUNDED. `dotAt` rounds because a 1x1 rect at a
     * half-pixel offset nearly vanishes; a stroked line is already several
     * device pixels long and rounding its ends would MOVE it — and this
     * line's whole content is where its far end is. The half-pixel offset is
     * the canvas convention for a crisp 1 px stroke, applied to the stroke and
     * not to the geometry.
     */
    const lineAt = (x0, y0, x1, y1, colour, width = 1) => {
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(width, Math.round(scale / 2) * width);
        ctx.beginPath();
        ctx.moveTo(x0 * scale + 0.5, y0 * scale + 0.5);
        ctx.lineTo(x1 * scale + 0.5, y1 * scale + 0.5);
        ctx.stroke();
    };

    /**
     * A marker glyph, at the position its ledger's tick names.
     *
     * ⛔ THE `default` ARM IS THE LESSON, NOT DECORATION — the same one the
     * hazard-shape loop learned at R4. A marker source this renderer has no
     * glyph for must SAY SO on the canvas; "nothing drawn" and "nothing
     * happened" are indistinguishable otherwise.
     */
    /**
     * ⛓⛓⛓ SLICE 6 — WHAT THE LAST DRAW ACTUALLY PUT ON THE CANVAS.
     *
     * ⛔ THE POINT IS THAT IT IS WRITTEN INSIDE THE `if (on.has(…))` ARMS, not
     * beside them. Slice 5's two findings were both a control writing into
     * state nobody read, and both were caught by asserting in the DRIVEN
     * SYSTEM rather than at the widget. A readout derived alongside the draw
     * would repeat that mistake one layer up: `hammerLinesAt` could be
     * perfect, the checkbox could be checked, the `if` could be testing the
     * wrong key, and a derivation-shaped readout would report the line as
     * present while the canvas stayed empty.
     *
     * ⚠ LAST DRAW, not cumulative — these three layers are THIS TICK ONLY, so
     * the readout is reset at the top of each pass and describes the frame
     * you are looking at.
     */
    const drawn = {
        hitboxes: { boxes: [], why: null },
        /**
         * ⛓ ⚖ ITEM (iv) — the `{…, why}` PAIR SHAPE from the outset, and a
         * `reading` beside it: this layer can legitimately draw nothing for
         * THREE different reasons (the room has none, the census was not
         * consulted, this draw was handed no run) and a picture that showed the
         * same empty canvas for all three would be the hole the layer exists
         * to fill.
         */
        staticEnemies: { boxes: [], why: null, reading: null },
        hammer: { lines: [], why: null },
        attacks: [],
        /**
         * ⛓⛓⛓ GROUP B — ITS OWN CHANNEL, AND THAT IS THE WHOLE SAFEGUARD.
         * `attacks` is what the run COLLIDED; this is what the page is still
         * showing you afterwards. Folding the afterimage into `attacks` would
         * have made `check-seedling-editor-shapes`' claim — *"the attack rect
         * is drawn on its fired tick, and NOT OTHERWISE"* — pass on a picture
         * that no longer says that, which is a check measuring the page's
         * decoration instead of the game's timing.
         */
        attacksHeld: [],
        lanes: { lanes: [], why: null },
        /**
         * ⛓ SLICE 9's three, in the `{…, why}` PAIR SHAPE FROM THE OUTSET —
         * kickoff §16.9 item 1, and §16.5 is why it is worth saying: the shape
         * has to be chased into `get drawn()`, which is DOM-side and which no
         * module test reaches. All three can legitimately draw nothing, so all
         * three carry a reason.
         */
        worldstate: { changes: [], why: null },
        crushers: { crushers: [], why: null },
        danger: { queries: [], why: null },
    };

    const unknownGlyphs = new Set();
    function glyph(kind, x, y, colour, source) {
        const r = Math.max(3, 2 * scale);
        const px = Math.round(x * scale);
        const py = Math.round(y * scale);
        ctx.strokeStyle = colour;
        ctx.fillStyle = colour;
        ctx.lineWidth = Math.max(1, Math.round(scale / 2));
        ctx.beginPath();
        switch (kind) {
        case 'square':
            ctx.strokeRect(px - r, py - r, 2 * r, 2 * r);
            return;
        case 'cross':
            ctx.moveTo(px - r, py - r); ctx.lineTo(px + r, py + r);
            ctx.moveTo(px + r, py - r); ctx.lineTo(px - r, py + r);
            ctx.stroke();
            return;
        case 'plus':
            ctx.moveTo(px - r, py); ctx.lineTo(px + r, py);
            ctx.moveTo(px, py - r); ctx.lineTo(px, py + r);
            ctx.stroke();
            return;
        case 'diamond':
            ctx.moveTo(px, py - r); ctx.lineTo(px + r, py);
            ctx.lineTo(px, py + r); ctx.lineTo(px - r, py);
            ctx.closePath(); ctx.fill();
            return;
        case 'triangle':
            ctx.moveTo(px, py - r); ctx.lineTo(px + r, py + r); ctx.lineTo(px - r, py + r);
            ctx.closePath(); ctx.stroke();
            return;
        case 'circle':
            ctx.arc(px, py, r, 0, 7);
            ctx.stroke();
            return;
        default:
            unknownGlyphs.add(`${source} (glyph "${kind}")`);
        }
    }

    return {
        reset() { trail.length = 0; },
        fit,
        draw(world, state, opts) {
            if (!fitted(world)) fit(world);
            ctx.fillStyle = '#101014';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Tiles. A SOLID leaves the getState candidate list, so it is
            // drawn as a wall regardless of its type — that IS the fact the
            // resolver acts on.
            const solidRects = new Set(world.solids.map((s) => `${s.rect.x},${s.rect.y}`));
            for (const t of world.tiles) {
                const isSolid = solidRects.has(`${t.rect.x},${t.rect.y}`);
                rect(t.rect, isSolid ? SOLID_COLOUR : (TILE_COLOURS[t.t] ?? FLOOR_COLOUR));
            }
            // A HOLE is a cell with no tile at all — walkable, and the only
            // place the sticky resolver is observable. Left as background.

            // Object solids (buildings, statues, NPCs...) and pixelmasks.
            // ⛓ GROUP B: coloured by the run's own family join, not by tag —
            // see `OBJECT_SOLID_FAMILIES`. Scenery keeps the old grey.
            for (const s of world.objectSolids) rect(s.rect, objectSolidColour(s), 0.85);
            for (const p of world.pixelmasks) outline(p.rect, '#a06060');

            // Volumes. Teleporters and pits are TRANSPORT; the rest are
            // avoid volumes the planner routes around.
            for (const tp of world.teleporters) {
                if (tp.deactivated) continue;
                rect(tp.rect, '#2fa8a0', 0.35);
                outline(tp.rect, '#3fd8ce');
            }
            for (const t of world.tiles) {
                if (t.t === PIT) outline(t.rect, '#c04040', 2);
            }
            // ⚠ THREE SHAPES, and the third one arrived at R4 with a
            // `BossLock`. A hazard is a rect (`collide`), a disc
            // (`FP.distance < r`) or a LINE (`collideLine` over integer
            // probes) — and a `line` entry carries NEITHER `rect` NOR
            // `disc`, both null. This loop used to be `if (h.rect) ... else
            // <disc>`, which dereferenced `h.disc.x` on the first bosslock
            // it met and threw inside the rAF callback, killing the
            // animation with no message at all. Level 12 holds FIVE of them.
            //
            // The `default` arm is the lesson, not decoration: a fourth
            // shape should say so on the canvas rather than stop the clock.
            if (opts.on.has('volumes')) {
                for (const p of world.pickups) rect(p.rect, '#d8c030', 0.4);
                for (const h of world.proximityHazards) {
                    if (h.rect) {
                        rect(h.rect, '#d05090', 0.35);
                    } else if (h.disc) {
                        ctx.strokeStyle = '#d05090';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.arc(h.disc.x * scale, h.disc.y * scale, h.disc.r * scale, 0, 7);
                        ctx.stroke();
                    } else if (h.line) {
                        // The probes are the INTEGER points `[x0, x1]` on
                        // row `y`, so the drawn band is one pixel tall and
                        // `x1 + 1` wide — never a rect enclosing them, which
                        // is the over-approximation the census refuses.
                        rect({
                            x: h.line.x0, right: h.line.x1 + 1,
                            y: h.line.y, bottom: h.line.y + 1,
                        }, '#ff6fae', 0.9);
                    } else {
                        unknownShapes.add(`${h.tag}@${h.x},${h.y} (${h.kind})`);
                    }
                }
            }

            // The breadcrumb trail — raw sampled positions, one per tick,
            // never interpolated.
            //
            // ⚠ FILTERED TO THE LEVEL BEING DRAWN. Every level is its own
            // coordinate space (`Game.as:1854` rewrites FP.width/height on
            // each load), so a dot recorded at (296,168) in level 94 means
            // nothing at (296,168) in level 0 — carrying the trail across a
            // swap draws a path the player never walked. The points keep
            // their level rather than being cleared, so scrubbing BACK
            // across a crossing restores the old level's trail instead of
            // losing it.
            //
            // ⚠ The DRAW position is rounded to the device pixel. That is a
            // rasterisation detail, not smoothing: a 1x1 rect at a half-pixel
            // offset is anti-aliased across four pixels at ~25% alpha each,
            // which at scale 1 makes the whole trail nearly invisible over
            // the floor colour. The HUD still reports the exact doubles, and
            // nothing about the path itself is adjusted.
            if (opts.on.has('player')) {
                for (const p of trail) {
                    if (p.level !== world.level) continue;
                    dotAt(p.x, p.y, PATH_COLOURS.player);
                }
            }

            /**
             * ── THE MOVER PATHS (kickoff §3.2) ──────────────────────────
             *
             * ⛔ FROM THE PER-TICK SAMPLES, NEVER FROM `world`. The world
             * this renderer draws is built SEPARATELY from the run's and is
             * never advanced (slice 1's §8.8 note, deliberate: the run's own
             * world would show END-state geometry at early scrub positions).
             * So its bodies are where the LEVEL put them, not where the run
             * has them, and a mover overlay read off it would draw every
             * enemy parked at its spawn for the whole tape.
             */
            const { samples, cursor } = opts;
            if (opts.on.has('enemies')) {
                for (const e of pathPointsUpTo(samples, cursor, world.level, 'enemies')) {
                    dotAt(e.x, e.y, PATH_COLOURS[e.kind] ?? PATH_COLOURS.chaser);
                }
            }
            if (opts.on.has('pushables')) {
                for (const b of pathPointsUpTo(samples, cursor, world.level, 'pushables')) {
                    dotAt(b.x + b.w / 2, b.y + b.h / 2, PATH_COLOURS.pushable);
                }
            }
            if (opts.on.has('arrows')) {
                for (const a of pathPointsUpTo(samples, cursor, world.level, 'arrows')) {
                    dotAt(a.x, a.y, PATH_COLOURS.arrow);
                }
            }

            /**
             * ── ⛓ THE SHAPE LAYERS (slice 6) — THIS TICK, NOT THE WALK ────
             *
             * Drawn BELOW the player and ABOVE the paths: they are geometry
             * the run holds right now, so they must not bury the player
             * sprite, and they must not be buried by three hundred path dots.
             *
             * ⛔ EVERY RECT AND EVERY LINE HERE CAME FROM THE ENGINE. This
             * block chooses colours and z-order and computes no geometry at
             * all — see `watchOverlays`' one-spelling import block.
             */
            drawn.hitboxes = { boxes: [], why: null };
            // ⛓ ⚖ ITEM (iv): reset with its siblings — LAST DRAW, not cumulative.
            drawn.staticEnemies = { boxes: [], why: null, reading: null };
            drawn.hammer = { lines: [], why: null };
            drawn.attacks = [];
            drawn.attacksHeld = [];
            drawn.lanes = { lanes: [], why: null };
            drawn.worldstate = { changes: [], why: null };
            drawn.crushers = { crushers: [], why: null };
            drawn.danger = { queries: [], why: null };
            /**
             * ⛓⛓⛓ SLICE 9 — THE WORLD-STATE MARKS, AND THEY ARE DRAWN FIRST
             * OF THE SHAPE LAYERS ON PURPOSE.
             *
             * They belong to the GEOMETRY above them — a correction to the
             * tiles and object solids already painted — so they sit under
             * every body, every lane and every line. Ordering them last would
             * put "this wall is gone" on top of the enemy standing where the
             * wall was, which reads as a mark on the enemy.
             *
             * ⛔ NOTHING IS UN-DRAWN. ⚖ The charter's own condition: the mark
             * says the base is no longer true; it does not erase the base. A
             * viewer that repainted the floor would be indistinguishable from
             * one that had built the world fresh, and the reader would lose
             * the only evidence that the picture needed correcting at all.
             */
            if (opts.on.has('worldstate')) {
                // ⛓ SLICE 2c: the world being PAINTED is handed over too, so
                // the layer can mark a solid the run has cleared AWAY — one
                // that is in this picture and in no set the run keeps.
                const w = worldChangesAt(samples, cursor, world.level, world);
                drawn.worldstate = { changes: [], why: w.why };
                for (const ch of w.changes) {
                    const b = ch.base;
                    if (ch.effect === 'swapped' && ch.rect) {
                        // What is TRUE now, filled; what the level built,
                        // outlined and struck through. Two boxes, because the
                        // fact is that they are DIFFERENT boxes.
                        outline(b, SHAPE_COLOURS.gone);
                        lineAt(b.x, b.y, b.right, b.bottom, SHAPE_COLOURS.gone);
                        rect(ch.rect, SHAPE_COLOURS.swapped, 0.3);
                        outline(ch.rect, SHAPE_COLOURS.swapped);
                    } else {
                        const ink = ch.effect === 'notsolid'
                            ? SHAPE_COLOURS.notsolid : SHAPE_COLOURS.gone;
                        outline(b, ink);
                        lineAt(b.x, b.y, b.right, b.bottom, ink);
                        lineAt(b.right, b.y, b.x, b.bottom, ink);
                    }
                    drawn.worldstate.changes.push({
                        id: ch.id, family: ch.family, tag: ch.tag, effect: ch.effect,
                        verb: ch.verb, base: ch.base, rect: ch.rect,
                    });
                }
            }
            /**
             * ⛓⛓⛓ THE CRUSHERS — the dangling R5 forward's first reader.
             *
             * ⛔ THE LANE OUTLINES ARE NOT FILLED unless the scan MATCHED
             * them. A crusher's four lanes are 32x96 each and a filled set
             * would bury the room the layer exists to explain; a matched lane
             * is the one fact worth the ink, because it is what will make the
             * body charge.
             */
            if (opts.on.has('crushers')) {
                const c = crushersAt(opts.live);
                drawn.crushers = { crushers: [], why: c.why };
                for (const body of c.crushers) {
                    for (const lane of body.lanes) {
                        if (lane.live) rect(lane.rect, SHAPE_COLOURS.crusherLaneLive, 0.15);
                        outline(lane.rect,
                            lane.live ? SHAPE_COLOURS.crusherLaneLive : SHAPE_COLOURS.crusherLane,
                            lane.live ? 2 : 1);
                    }
                    rect(body.rect, SHAPE_COLOURS.crusher, 0.3);
                    outline(body.rect, SHAPE_COLOURS.crusher);
                    drawn.crushers.crushers.push({
                        id: body.id, rect: body.rect, x: body.x, y: body.y,
                        resting: body.resting, shieldedBy: body.shieldedBy, dir: body.dir,
                        lanes: body.lanes.map((l) => ({ dir: l.dir, live: l.live, rect: l.rect })),
                        live: body.lanes.filter((l) => l.live).map((l) => l.dir),
                    });
                }
            }
            if (opts.on.has('danger')) {
                /**
                 * ⛓⛓⛓ ⚖ ITEM 9 — WHAT THE SOLVER WAS TOLD, AND NOTHING ELSE.
                 *
                 * ⛔ THE BOX IS `playerBoxAt(q.x, q.y)` — the ENGINE's own
                 * builder, and the very call `dangerNow` made when it asked
                 * (`dangerAt(run, tick, playerBoxAt(x, y))`). Not a rect this
                 * page assembled from the recorded position: a box literal
                 * without `right`/`bottom` never overlaps anything, silently,
                 * which is a defect this package has already paid for once.
                 *
                 * ⚠ AND THE REASONS ARE TEXT, WHICH IS A FACT ABOUT THE UNION
                 * AND NOT A SHORTCUT HERE. `dangerAt` returns `{kind, id,
                 * why}` per source and NO GEOMETRY, so there is no shape to
                 * draw for "an ARMED trap's lane" beyond the query box itself.
                 * Inventing one — reaching for `dangerVolumes` to fill in the
                 * picture — is precisely the third opinion the law forbids and
                 * the refusal §14.4c still stands on.
                 */
                const d = dangerQueriesAt(opts.dangerQueries, cursor, world.level);
                drawn.danger = { queries: [], why: d.why };
                for (const q of d.queries) {
                    const box = playerBoxAt(q.x, q.y);
                    const ink = q.danger ? SHAPE_COLOURS.danger : SHAPE_COLOURS.dangerClear;
                    rect(box, ink, q.danger ? 0.35 : 0.15);
                    outline(box, ink, 2);
                    drawn.danger.queries.push({
                        where: q.where, tick: q.tick, runTick: q.runTick, x: q.x, y: q.y,
                        danger: q.danger, mode: q.mode, horizon: q.horizon,
                        sources: q.sources.map((s) => ({ kind: s.kind, id: s.id, why: s.why })),
                        box,
                    });
                }
            }
            if (opts.on.has('hitboxes')) {
                /**
                 * ⛔ SLICE 8: `why` IS CARRIED OUT, exactly as `hammer` has
                 * done since slice 6. An empty hitboxes layer meant two things
                 * and drew one picture — L16's nine refused bodies looked
                 * identical to an empty corridor. See `bodiesAt`.
                 */
                const b = bodiesAt(samples, cursor, world.level);
                drawn.hitboxes = { boxes: [], why: b.why };
                for (const body of b.bodies) {
                    outline(body.rect, SHAPE_COLOURS.hitbox);
                    drawn.hitboxes.boxes.push({
                        id: body.id, kind: body.kind, tag: body.tag, rect: body.rect,
                    });
                }
            }
            if (opts.on.has('staticenemies')) {
                /**
                 * ⛓⛓⛓ ⚖ ITEM (iv) — THE BODIES NO OTHER LAYER COULD SHOW.
                 *
                 * ⛔ THE CHANNEL IS HANDED IN, ALREADY PARTITIONED. The
                 * renderer cannot compute this: the partition is the RUN's own
                 * verdict (`chaserRoomVerdict`, `isBridgedChaser`, the live
                 * spinner roster) and `draw` is given a WORLD, not a run — a
                 * world this renderer deliberately never advances. So
                 * `watchOverlays.staticEnemyBodies` answers it at the call
                 * sites that hold a run, exactly as `sampleMovers` does, and
                 * this arm paints what it was given.
                 *
                 * ⚠ `null` IS AN HONEST ABSENCE — a caller with no run at all
                 * (the phase ladder's folds) says so, rather than reporting an
                 * empty room. The `why` carries which it was.
                 */
                const st = opts.staticEnemies
                    ?? { bodies: [], why: 'this draw was handed no run, so nothing is known '
                        + 'about static bodies here' };
                drawn.staticEnemies = { boxes: [], why: st.why, reading: st.reading ?? null };
                for (const body of st.bodies) {
                    outline(body.rect, SHAPE_COLOURS.staticEnemy);
                    drawn.staticEnemies.boxes.push({
                        id: body.id, tag: body.tag, rect: body.rect,
                    });
                }
            }
            if (opts.on.has('lanes')) {
                /**
                 * ⛓ THE ARMED TRAPS' COLUMNS — the trap's GEOMETRY, not the
                 * `arrows` layer's sampled flights. Outlined and barely
                 * filled: a lane runs the full height of the room, so a solid
                 * one would bury everything standing in it, which is exactly
                 * the population the layer exists to show is in danger.
                 */
                const l = arrowLanesAt(samples, cursor, world.level);
                drawn.lanes = { lanes: [], why: l.why };
                for (const lane of l.lanes) {
                    rect(lane.rect, SHAPE_COLOURS.lane, 0.12);
                    outline(lane.rect, SHAPE_COLOURS.lane);
                    drawn.lanes.lanes.push({ id: lane.id, t: lane.t, rect: lane.rect });
                }
            }
            if (opts.on.has('hammer')) {
                // ⚠ `why` is CARRIED OUT, not swallowed: "no spinner in this
                // room" and "this run has no clock" both draw nothing, and
                // only one of them is a limitation of the page.
                const h = hammerLinesAt(samples, cursor, world.level);
                drawn.hammer = { lines: [], why: h.why };
                for (const l of h.lines) {
                    lineAt(l.x0, l.y0, l.x1, l.y1,
                        l.touches ? SHAPE_COLOURS.hammerTouch : SHAPE_COLOURS.hammer,
                        l.touches ? 2 : 1);
                    drawn.hammer.lines.push({ ...l, degrees: l.angle * 180 / Math.PI });
                }
            }
            if (opts.on.has('attacks')) {
                /**
                 * ⛓⛓⛓ GROUP B — THE HELD RECTS FIRST, SO THE LIVE ONE IS ON
                 * TOP. A sword's five hit ticks overlap heavily (measured:
                 * `r6-owl-kill`'s rect walks 2.2 px across them), and drawing
                 * the afterimage last would put a dim outline over the bright
                 * fill of the tick the engine is actually swinging on.
                 *
                 * ⛔ OUTLINE ONLY, NEVER FILLED. `attackRectsAt`'s rows are
                 * filled AND outlined; these are the same geometry with the
                 * engine no longer behind it, and the difference has to be
                 * legible at a glance rather than only in the readout.
                 */
                for (const p of attackHoldsAt(
                    opts.presses, cursor, world.level, opts.attackHold)) {
                    outline(p.rect, SHAPE_COLOURS.attackHeld);
                    drawn.attacksHeld.push({
                        t: p.t, fired: p.fired, weapon: p.weapon, direction: p.direction,
                        rect: p.rect, age: p.age, hold: p.hold,
                    });
                }
                for (const p of attackRectsAt(opts.presses, cursor, world.level)) {
                    rect(p.rect, SHAPE_COLOURS.attack, 0.25);
                    outline(p.rect, SHAPE_COLOURS.attack);
                    drawn.attacks.push({
                        t: p.t, fired: p.fired, weapon: p.weapon, direction: p.direction,
                        rect: p.rect, hits: (p.hits ?? []).map((h) => h.id ?? h.tag ?? '?'),
                    });
                }
            }

            /**
             * ── ⛓⛓⛓ GROUP B: THE PLAYER IS TWO BOXES, AND ONLY ONE OF THEM
             * ── IS A COLLISION VOLUME ─────────────────────────────────────
             *
             * ⚖ The user asked which of the two overlapping boxes is the real
             * hitbox, and ruled that BOTH stay drawn once the answer was in
             * hand — so the answer lives here and in the legend rather than in
             * a layer toggle. It is:
             *
             *  · **WHITE, FILLED — `playerBoxAt(x, y)`.** THE hitbox. The
             *    engine's own `HITBOX` origin/width/height, the box the
             *    physics collides solids with, the box `dangerAt` is queried
             *    with (`dangerAt(run, tick, playerBoxAt(x, y))`), and the box
             *    `hammerHitsPlayer` is handed. If a question is "did that
             *    touch the player", this is the rect that answered it.
             *
             *  · **YELLOW, OUTLINE — `terrainProbeRect(x, y)`.** NOT a
             *    collision volume and never consulted as one. It is the same
             *    box shifted DOWN by `checkOffsetY = 1`, and it exists because
             *    `Player.getState()` (`Player.as:660`) compares the NEAREST
             *    TILE against that shifted rect to decide which terrain the
             *    player is standing in — water, ice, pit, lava. So it is a
             *    diagnostic of terrain PROBING: when the two boxes straddle a
             *    tile boundary, the yellow one is why the terrain readout says
             *    what it says.
             *
             * ⚠ THE ONE-PIXEL OVERLAP IS THE POINT, not a rendering artefact.
             * They differ by exactly `checkOffsetY`, which is the whole reason
             * a player can be collision-clear of a pit and reading `pit`.
             */
            outline(terrainProbeRect(state.x, state.y), '#ffd75f');
            rect(playerBoxAt(state.x, state.y), '#ffffff', 0.9);

            // Markers LAST, so the one the player is standing on is not
            // painted over by the player.
            for (const m of markersVisibleAt(opts.markers, cursor, world.level, opts.on)) {
                const g = MARKER_GLYPHS[m.source];
                if (!g) { unknownGlyphs.add(`${m.source}@${m.tick} (no glyph)`); continue; }
                glyph(g.glyph, m.x, m.y, g.colour, `${m.source}@${m.tick}`);
            }
        },
        mark(state, level) { trail.push({ x: state.x, y: state.y, level }); },
        /**
         * ⛓ What the LAST `draw` really put on the canvas (slice 6).
         *
         * ⚠ SLICE 8: `hitboxes` and `lanes` are `{…, why}` PAIRS, like
         * `hammer` — an empty layer and a layer with a reason are different
         * readouts, and this accessor has to carry the reason out or the
         * check that reads it cannot tell them apart. (It is also the shape
         * this getter got WRONG first: it still spread `hitboxes` as a bare
         * array and the page died on `drawn.hitboxes.map is not a function`,
         * which the browser row caught on its first run.)
         */
        get drawn() {
            return {
                hitboxes: {
                    boxes: drawn.hitboxes.boxes.map((b) => ({ ...b })),
                    why: drawn.hitboxes.why,
                },
                // ⛓ ⚖ ITEM (iv), in the pair shape, because this accessor is
                // DOM-side and no module test reaches it (§16.5's lesson).
                staticEnemies: {
                    boxes: drawn.staticEnemies.boxes.map((b) => ({ ...b })),
                    why: drawn.staticEnemies.why,
                    reading: drawn.staticEnemies.reading,
                },
                hammer: { lines: drawn.hammer.lines.map((l) => ({ ...l })), why: drawn.hammer.why },
                attacks: drawn.attacks.map((a) => ({ ...a })),
                attacksHeld: drawn.attacksHeld.map((a) => ({ ...a })),
                lanes: {
                    lanes: drawn.lanes.lanes.map((l) => ({ ...l })),
                    why: drawn.lanes.why,
                },
                /**
                 * ⛔ SLICE 9 — AND THIS IS THE ACCESSOR §16.5 CAUGHT WRONG.
                 * All three landed as `{…, why}` pairs at their producers, and
                 * a copier that spread one of them as a bare array is a page
                 * that will not load with every module test green. The browser
                 * row is what exercises these three lines.
                 */
                worldstate: {
                    changes: drawn.worldstate.changes.map((c) => ({ ...c })),
                    why: drawn.worldstate.why,
                },
                crushers: {
                    crushers: drawn.crushers.crushers.map((c) => ({ ...c })),
                    why: drawn.crushers.why,
                },
                danger: {
                    queries: drawn.danger.queries.map((q) => ({ ...q })),
                    why: drawn.danger.why,
                },
            };
        },
        /** Shapes met that this renderer has no arm for; empty is the norm. */
        get unknownShapes() { return [...unknownShapes]; },
        /** Marker sources met that this renderer has no GLYPH for; same law. */
        get unknownGlyphs() { return [...unknownGlyphs]; },
    };
}

async function runJs(params, lifetime) {
    /**
     * ⛓⛓⛓ R9 SLICE 2 — `?tapes=` SELECTS THE SEQUENCE ARM, and `?tape=` is
     * untouched. ⛔ ABSENT is not EMPTY: `?tapes=` written with nothing in it
     * lands here as `[]` and gets the sequence arm's own refusal, not a silent
     * fall-through to the single-tape one (`director.parseTapesParam`).
     */
    if (params.tapes !== null) return runJsSequence(params, lifetime);
    // ⛓ A pasted or uploaded tape has no path to navigate to, so it replays
    // IN PLACE — through the same `replayLoadedTape` hook every arm sets, and
    // against this same level source (`armPrelude`).
    const { levelSource } = await armPrelude(params, lifetime);
    const tape = await fetchJson(repoUrl(params.tape), 'tape');
    if (!lifetime.alive()) return undefined;
    return replayTape(tape, params.tape, params, levelSource,
        await fetchTraceSidecar(params.tape));
}


/**
 * ══ ⛓⛓⛓ R9 SLICE 2 — THE SEQUENCE ARM (⚖ ruling 10) ═════════════════════
 *
 * ⚖ The user's own sentence, 2026-08-20: *"I want the second tape to continue
 * from the game state at the end of the first tape. I don't want it to reload
 * a fresh page. And I want it to work like this for both JS playback and wasm
 * playback."*
 *
 * ⛓ THE GAME ALREADY DOES THIS, and that is why it is a small function.
 * `Bot.botStart` re-arms the SAME world when the next tape's boot names its
 * construction args — `if (bootLevel != Main.level || !atBootPosition())
 * FP.world = new Game(bootLevel, bootX, bootY)` (`Bot.as:1722-1725`) — and its
 * own comment names it *"the CONTINUATION path (the director's window
 * boundaries)"* (`:2759-2766`). R5's Windows driver has driven N windows on
 * one page since (`seedling-bot-replay-win.py --tapes`). What was missing was
 * the PAGE doing it, on both sides.
 *
 * ── THE SHAPE ─────────────────────────────────────────────────────────
 *
 * `?tapes=a,b,c` → expand any chain HEADLINE to its segments (`PAGE_CHAINS`,
 * asserted in node against `PLAYTHROUGH_CHAINS`) → fetch → **TIER 1**
 * admission (`director.sequenceAdmission`, decidable from the tapes alone) →
 * then, window by window, **TIER 2** (`director.continuationAdmission`) against
 * the LIVE run before window k+1's first tick, and `collectRun(tape, src,
 * {run})` to step the given run with that tape's held sets.
 *
 * ⛔ A REFUSAL STOPS THE SEQUENCE AND IS NAMED. Never a silent rebuild: the
 * game WOULD rebuild, and a rebuild is not a continuation (⚖ §6 Q7).
 *
 * ── ⛓ WHY THE FRAMES ARE RE-INDEXED, AND WHY THE BOUNDARY FRAME IS DROPPED
 *
 * `overlaysFor`'s `frameAt(t)` indexes the frames array BY TICK, and every
 * ledger the run keeps (`transitions`, `earnedClears`, `playerHits`, …) is
 * numbered by `ticksCompleted`, which CONTINUES across a resumed window. So
 * the combined frames are re-stamped to sequence-absolute ticks and window
 * k+1's frame 0 is dropped: it is the same observation as window k's last —
 * measured, `r8-d2-19`'s tick 864 and `r8-d2-20`'s tick 0 are both
 * `L20 (200,72)` — and that is exactly the arithmetic
 * `playthroughAcceptance.chainFindings` does with its stream slices
 * (`864 + 781 = 1645`).
 */
/**
 * ⛓ R9 SLICE 5 — `jsLiveEnvelope` and its `blocksWhy` MOVED TO `director.js`,
 * beside the admission that reads them, so the campaign census can import the
 * SAME function in node instead of re-spelling it (trap 383). Re-exported
 * here, not copied: `director.jsLiveEnvelope` IS this name.
 */
export { jsLiveEnvelope };
/**
 * A queued member → the repo path it is fetched from. A member with a `/` is
 * already a path (what `?tape=` carries); a bare name is a fixture, which is
 * what a chain expands to.
 */
function tapePathFor(member) {
    const m = String(member).replace(/^\/+/, '');
    if (m.includes('/')) return m;
    return `${DEFAULT_TAPE_DIR}/${m.endsWith('.json') ? m : `${m}.json`}`;
}

/**
 * The nearest chain the roster DOES have that starts with a given tape — so a
 * refusal carries its own next work order (R8 lesson 2, the cheapest planning
 * instrument there is).
 */
function nearestChainFor(name) {
    const bare = String(name).replace(/^.*\//, '').replace(/\.json$/, '');
    for (const [id, segs] of Object.entries(PAGE_CHAINS)) {
        if (segs.includes(bare) && segs.length > 1) return `?tapes=${id} (${segs.join(',')})`;
    }
    return null;
}

/**
 * ══ ⛓⛓⛓ R9 SLICE 10 — THE CAMPAIGN READOUT (⚖ ruling 19) ══════════════════
 *
 * *"a way for the watch page to play the full sequence of campaign tapes that
 * we have solved so far"* — and, having played it, to SAY WHERE THE PLAYTHROUGH
 * STANDS: how many rooms it crossed, which goal-ledger rows it credited, where
 * it stopped and what the next work order is.
 *
 * ⛔ EVERY NUMBER IS DERIVED, AND THE GATE RE-DERIVES EVERY ONE (trap 269 — an
 * echo is not a value). Nothing here is typed: the chain comes from
 * `campaignChoice`, the rooms from the walk's own windows, the credit from the
 * committed tapes through `r7Acceptance`'s own two functions, and the frontier
 * from an artifact the census writes and `--check`s.
 *
 * ⛔⛔ SCOPE, AS RULED. Only the fresh-start solver chain is ever named here.
 * The detached `r8-d2` tail is real, playable on its own and NOT part of this:
 * ⚖ ruling 19 scopes the player to *"the tapes that can be played continuously
 * from a fresh game start"*, so the readout may say the rooms past the stop are
 * unsolved and may not offer them.
 */
const FRONTIER_PATH = 'frontend/modules/seedlingDemo/fixtures/campaign-frontier.json';
let frontierMemo = null;

/**
 * The census's committed projection of the route survey. ⚠ The survey JSON
 * itself is gitignored (`NewDocs/*`), so this artifact is the only thing a
 * BROWSER can read — and `census-seedling-campaign.mjs --check-frontier` is
 * what keeps it honest against the survey on a machine that has one.
 *
 * ⛔ A MISSING OR MALFORMED ARTIFACT IS A NAMED ABSENCE, never a silent one:
 * the readout prints the reason where the work order would have gone.
 */
async function campaignFrontier() {
    if (frontierMemo) return frontierMemo;
    try {
        const j = await fetchJson(repoUrl(FRONTIER_PATH), 'the campaign frontier');
        frontierMemo = { artifact: j, why: null };
    } catch (e) {
        frontierMemo = { artifact: null, why: `${FRONTIER_PATH} — ${e.message}` };
    }
    return frontierMemo;
}

/**
 * ⛓⛓⛓ WHICH GOAL-LEDGER ROWS THIS RUN CREDITED, and the derivation is
 * `chainGoalFindings`' own — `goalEarnedWitness` over a segment's BOOT and its
 * LATCH, asking whether the collectible went NOT-HELD to HELD inside one driven
 * window, which a declaration cannot fake.
 *
 * ⛔ THE LATCH IS THE SUCCESSOR'S BOOT BLOCK, AND THAT IS THE CUSTODY CHAIN'S
 * WHOLE CLAIM, NOT A SHORTCUT. `boot(k+1) == latch(k)` is an equality the GAME
 * produced over all 46 signature rows (R9 slice 6) and `seamLatchFindings`
 * gates it in node. So the fields compared here came out of the running game,
 * not out of the model's item mirror — which `levelRun.initialInventory`'s own
 * docblock warns against reading as an oracle ("a test that asserted an item
 * from here would be asserting that this file agrees with itself", trap 250).
 *
 * ⛔ AND THE RUN IS WHAT GATES IT. Only windows this walk actually STEPPED are
 * offered a witness, so a run that stops at window 5 credits nothing from
 * window 10 — the readout reports the playthrough, not the roster.
 *
 * ⚠ THE LAST STEPPED WINDOW IS UNASSERTED BY NAME. It has no successor boot, so
 * whether it earned anything is a question this page cannot answer; saying
 * nothing would make "earned nothing" and "could not look" print the same
 * thing (trap 119).
 */
function campaignLedger(parsedTapes, names, stepped) {
    const rows = [];
    const credited = [];
    const boots = parsedTapes.map((t) => seamBootFields(t));
    const usable = Math.min(stepped, parsedTapes.length) - 1;
    for (let k = 0; k < usable; k += 1) {
        for (const row of R7_GOAL_LEDGER) {
            if (credited.some((c) => c.id === row.id)) continue;
            const witness = goalEarnedWitness(row, boots[k], boots[k + 1]);
            if (witness) credited.push({ id: row.id, segment: names[k], witness });
        }
    }
    const unasserted = usable >= 0 && usable < parsedTapes.length
        ? [{
            window: usable + 1,
            label: names[usable] ?? null,
            why: 'the last window this run stepped has no successor boot block, so its '
                + 'own latch is not on the page — any row it earned is UNASSERTED here, '
                + 'not absent',
        }]
        : [];
    return { total: R7_GOAL_LEDGER.length, credited, creditedCount: credited.length,
        unasserted, rows };
}

/**
 * The structural object the gate reads and the block the reader sees, built
 * from one source. ⛔ The DOM is rendered FROM `__campaign`, never beside it: a
 * readout and an object that are two renderings of two computations is the
 * shape trap 269 is about.
 */
function publishCampaign(seq, parsedTapes, names, run) {
    const choice = campaignChoice();
    const stepped = seq.windows.filter((w) => !w.refused).length;
    /**
     * ⛔ THE ARTIFACT IS PREFETCHED (`campaignFrontier()` is awaited at the top
     * of `walkSequence`) SO THIS FUNCTION IS SYNCHRONOUS — and it has to be:
     * `stop()` publishes `__editorSequence` synchronously and the gates wait on
     * that, so a campaign object that arrived one microtask later would be a
     * readout the gate could legally read as absent. `frontierMemo` is already
     * filled by the time any caller gets here; the `?? {}` is the shape for a
     * caller that has not, and it degrades to a NAMED absence rather than a
     * throw.
     */
    const { artifact = null, why = 'the frontier artifact was not fetched before the '
        + 'walk began' } = frontierMemo ?? {};
    const isCampaign = choice.id !== null && seq.asked.length === 1
        && seq.asked[0] === choice.id;
    const ledger = parsedTapes
        ? campaignLedger(parsedTapes, names, stepped)
        : { total: R7_GOAL_LEDGER.length, credited: [], creditedCount: 0,
            unasserted: [{ window: 0, label: null,
                why: 'the walk stopped before any tape was parsed' }], rows: [] };
    const camp = {
        /** ⛓ The chain the ▶ campaign control WOULD play, derived, always. */
        campaign: choice.id,
        campaignWhy: choice.why,
        campaignRefusal: choice.refusal,
        /** ⚠ …and whether THIS sequence is that chain. `?tapes=r8-d2` is a
         *  legal sequence and is not the campaign; the readout says which. */
        isCampaign,
        asked: [...seq.asked],
        chainSegments: choice.segments.length,
        rooms: {
            crossed: stepped,
            of: seq.windows.length,
            rows: seq.windows.map((w) => ({
                index: w.index,
                segment: w.label,
                level: w.endLevel ?? null,
                ticks: w.ticks ?? null,
                admitted: w.refused ? false : w.index === 0
                    || Boolean(seq.boundaries.find((b) => b.index === w.index)),
            })),
        },
        ledger,
        end: run && stepped > 0 ? {
            level: run.level,
            /**
             * ⛔ THE PLAYER'S OWN LAST OBSERVATION, NOT `worldCtor`. The two are
             * different quantities that both read as "an (x,y) at the end":
             * `worldCtor` is the ARGUMENTS the last level was constructed with
             * (what `continuationAdmission` compares across a boundary), and the
             * player is where the walk actually stands. Slice 10 measured them
             * disagreeing on this very chain — ctor (160,64) against the player
             * — so both are published, each under its own name.
             */
            x: seq.stream?.at(-1)?.x ?? null,
            y: seq.stream?.at(-1)?.y ?? null,
            ctor: run.worldCtor ? { x: run.worldCtor.x, y: run.worldCtor.y } : null,
            ticks: seq.ticks ?? null,
            /**
             * ⛔ UNASSERTED BY NAME on this side. `seam.time` is a thing the
             * GAME counts (`Game.as:832`'s `time += timeRate`, per RENDER); the
             * JS model builds no seam envelope at all, so a number here would
             * be this page inventing the one field it cannot see.
             */
            seamTime: null,
            seamTimeWhy: 'the JS model builds no seam envelope and keeps no render '
                + 'count, so `seam.time` is UNASSERTED on this side — the wasm arm '
                + 'answers it from `botSeam()`',
        } : null,
        stoppedAt: seq.refusal
            ? {
                window: seq.windows.findIndex((w) => w.refused),
                label: seq.windows.find((w) => w.refused)?.label ?? null,
                reason: seq.refusal.reason,
                detail: seq.refusal.detail,
            }
            : null,
        /**
         * ⛓ THE NEXT WORK ORDER, VERBATIM from the committed artifact. ⛔ The
         * page does not summarise the refusal: the census derived it from the
         * survey's own sentence and the reader is owed that sentence.
         */
        frontier: artifact
            ? {
                chain: artifact.chain,
                lastArrival: artifact.lastArrival,
                nextStep: artifact.nextStep,
                refusal: artifact.refusal,
                why: artifact.why,
                source: FRONTIER_PATH,
            }
            : { chain: null, lastArrival: null, nextStep: null, refusal: null,
                why, source: FRONTIER_PATH },
    };
    window.__campaign = camp;
    renderCampaign(camp);
    return camp;
}

/** ⛓ The reader's view of the SAME object — rendered from it, not beside it. */
function renderCampaign(c) {
    const el = $('campaignReadout');
    if (!el) return;
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const parts = [];
    parts.push(`<b>THE PLAYTHROUGH</b> — ${c.isCampaign
        ? `the campaign chain <code>${esc(c.campaign)}</code>`
        : `a sequence of ${c.asked.length} member(s), NOT the campaign `
            + `(that is <code>${esc(c.campaign ?? 'refused')}</code>)`}`);
    parts.push(`rooms crossed: <b>${c.rooms.crossed}</b> of ${c.rooms.of}`);
    parts.push(c.rooms.rows.map((r) => `  ${r.index + 1}. ${esc(r.segment)} — `
        + `${r.level === null ? 'not stepped' : `ends L${r.level}`}`
        + `${r.ticks === null ? '' : `, ${r.ticks} ticks`}`
        + `${r.admitted ? '' : ' — REFUSED'}`).join('<br>'));
    parts.push(`goal ledger: <b>${c.ledger.creditedCount} / ${c.ledger.total}</b> credited`
        + (c.ledger.credited.length
            ? ` — ${c.ledger.credited.map((r) => `${esc(r.id)} (${esc(r.segment)})`)
                .join(', ')}` : ''));
    for (const u of c.ledger.unasserted) {
        parts.push(`⚠ UNASSERTED: window ${u.window}${u.label ? ` (${esc(u.label)})` : ''}`
            + ` — ${esc(u.why)}`);
    }
    if (c.end) {
        parts.push(`ends: the player at L${c.end.level} (${c.end.x},${c.end.y})`
            + `${c.end.ctor ? `, world built at (${c.end.ctor.x},${c.end.ctor.y})` : ''}`
            + `, ${c.end.ticks} ticks`
            + `  ·  ⚠ seam.time UNASSERTED — ${esc(c.end.seamTimeWhy)}`);
    }
    if (c.stoppedAt) {
        parts.push(`⛔ STOPPED at window ${c.stoppedAt.window} `
            + `(${esc(c.stoppedAt.label)}): ${esc(c.stoppedAt.reason)}`);
    }
    if (c.frontier.nextStep) {
        parts.push(`<b>NEXT WORK ORDER</b> — route step ${c.frontier.nextStep.step}, `
            + `L${c.frontier.nextStep.level} → L${c.frontier.nextStep.crossesTo}: `
            + `${esc(c.frontier.refusal.family)}`);
        parts.push(`<i>${esc(c.frontier.refusal.text)}</i>`);
        parts.push('⚠ the rooms beyond that arrival are UNSOLVED — this player shows '
            + 'only what plays continuously from a fresh game start.');
    } else {
        parts.push(`⚠ no work order — ${esc(c.frontier.why ?? 'the frontier artifact '
            + 'names no refused step')}`);
    }
    el.innerHTML = parts.join('<br>');
    el.hidden = false;
}

/**
 * ⛓⛓⛓ THE SEQUENCE'S ONE WALK — resolve, admit, and step N windows on ONE live
 * run. **BOTH ARMS CALL THIS.** The JS arm scrubs what it collected; the wasm
 * arm ships the same windows to the real game and compares against the same
 * per-window model streams. ⛔ A second copy of the window loop would be two
 * opinions about where a boundary is.
 *
 * @returns {object} `{seq, stop, frames, samples, run, parsedTapes, tapes, names}`
 *   — `seq.refusal` non-null means it stopped and `stop` has already painted it
 */
async function walkSequence(params, lifetime, levelSource) {
    const { names, expansions } = expandSequence(params.tapes);
    const seq = {
        asked: [...params.tapes],
        expansions,
        windows: [],
        admitted: false,
        refusal: null,
        boundaries: [],
    };
    /**
     * ⛓ R9 SLICE 10 — what the campaign readout needs, kept as the walk fills
     * it in, so a STOP can report the playthrough it got as far as instead of
     * reporting nothing. ⛔ A refused run is the case the readout exists FOR.
     */
    const sofar = { parsedTapes: null, names: null, run: null };
    /**
     * ⛔ A REFUSAL IS PAINTED AND RETURNED, never thrown: the readout is what
     * the browser row asserts on, and a stop that only threw would leave the
     * page describing nothing.
     */
    const stop = (reason, detail) => {
        seq.refusal = { reason, detail };
        publishCampaign(seq, sofar.parsedTapes, sofar.names, sofar.run);
        window.__editorSequence = seq;
        fatal(`the sequence stopped: ${reason}`, detail);
        return { seq, stopped: true };
    };
    /**
     * ⛓ R9 SLICE 10 — the campaign frontier, fetched ONCE and before anything
     * plays, so `publishCampaign` can run synchronously beside `stop()`.
     */
    await campaignFrontier();
    if (names.length === 0) {
        return stop('the queue is empty',
            '`?tapes=` was written and names nothing. A sequence of zero tapes plays '
            + 'nothing; use ?tape= for one.');
    }

    // ── fetch, then TIER 1 — before anything plays ───────────────────
    const tapes = [];
    for (const n of names) {
        try {
            // eslint-disable-next-line no-await-in-loop
            tapes.push(await fetchJson(repoUrl(tapePathFor(n)), `tape ${n}`));
        } catch (e) {
            return stop(`the roster has no "${n}"`, e.message);
        }
        if (!lifetime.alive()) return seq;
    }
    const parsedTapes = tapes.map((t) => parseTape(t));
    sofar.parsedTapes = parsedTapes;
    sofar.names = names;
    const tier1 = sequenceAdmission(parsedTapes.map((t, i) => ({ ...t, name: names[i] })));
    seq.tier1 = tier1;
    const refused1 = refusalsOnly(tier1);
    if (refused1.length > 0) {
        return stop('a window was refused at queue time',
            refused1.map((f) => `${f.where}: ${f.what} — ${f.detail}`).join('\n\n'));
    }

    /**
     * ⚠ THE HUD's EFFECTIVE-TERRAIN ROW READS WINDOW 1's RELAXATIONS. `parsed`
     * is per-tape and the viewer holds one; a sequence whose windows declare
     * DIFFERENT `noHazards` would draw the later ones' terrain against the
     * first one's list. Said out loud rather than policed: a shrinking
     * relaxation list is what a subtractive ladder looks like
     * (`director.crutchScheduleFindings`), so refusing it would be wrong.
     */
    const relaxations = parsedTapes.map((t) => (t.noHazards ?? []).join('+'));
    seq.mixedRelaxations = new Set(relaxations).size > 1 ? relaxations : null;

    // ── the window loop, on ONE run ──────────────────────────────────
    const frames = [];
    const samples = [];
    /**
     * ⛓ ONE ENTRY PER WINDOW, for the WASM arm: the model's own stream for that
     * window and the end state it predicts. ⛔ Out of THIS walk — never a second
     * one — so the per-window verdict compares the game against the very run
     * the JS side scrubbed.
     */
    const perWindow = [];
    let run = null;
    let offset = 0;
    let last = null;
    for (let k = 0; k < tapes.length; k += 1) {
        if (k > 0) {
            const live = jsLiveEnvelope(run, parsedTapes[0].persistence, parsedTapes[0].pins);
            /**
             * ⛔⛔ R9 SLICE 8 (⚖ ruling 20) — **THE JS STEPPER APPLIES NOTHING
             * FROM `tick0`, AND THAT IS THE MEASUREMENT, NOT AN OMISSION.**
             *
             * The v11 tick-0 latch answers a question only the GAME has: where
             * a FRESH PAGE stood one build and one fade after it applied the
             * declaration. The model has neither half of that gap —
             *   · it keeps NO LFSR position (`SEAM_BOOT_SPEC` marks the rng
             *     rows `modelled: false`; the admission's `rng` row is
             *     UNASSERTED by name on this tier), and
             *   · it ALREADY pays the boot cost, because a sequence is ONE
             *     `levelRun` and `enterWorld` spends `LOAD_FADE_FRAMES` at the
             *     crossing that ends window k − 1 (§14.1, measured: 9200 vs a
             *     declared 9179).
             * ⇒ applying the block here would move the model AWAY from the
             * game this slice just corrected — the same defect slice 6
             * measured and declined to build.
             *
             * ⚠ NO POSTURE IS PASSED for the same reason: there is no asserted
             * `rng` row on this tier for a posture to excuse.
             *
             * The field is kept out of the model structurally as well as
             * behaviourally: `stagingFromTape` does not forward it, and a unit
             * row reds if it ever does.
             */
            const found = continuationAdmission(parsedTapes[k], live, {
                index: k, label: names[k], nearest: nearestChainFor(names[0]),
            });
            seq.boundaries.push({
                index: k,
                label: names[k],
                live: { level: live.level, ctor: live.ctor, cleared: live.cleared },
                admission: found,
            });
            const refusals = refusalsOnly(found);
            if (refusals.length > 0) {
                seq.windows.push({ index: k, label: names[k], refused: true });
                return stop(`window ${k} ("${names[k]}") cannot continue window ${k - 1}`,
                    refusals.map((f) => `${f.what} — ${f.detail}`).join('\n\n'));
            }
        }
        /**
         * ⛓⛓⛓ R9 SLICE 5 (⚖ ruling 14's timed-row rule) — **THE WINDOW'S OWN
         * FORWARD DECLARATIONS, HANDED TO THE RESUMED RUN AND REBASED.**
         *
         * ⛔ AFTER THE ADMISSION AND BEFORE THE FIRST TICK. The wasm side
         * withholds these rows from the game (`watchWasm.continuationTape`)
         * because the live game EARNS the clear on its own tick; the model
         * cannot — `levelRun` refuses to compute a kill-lock clear itself, so
         * an undeclared one THROWS. Slice 2 measured that throw at tick 1067 of
         * `act2-the-sword`, and it was the SECOND thing standing between that
         * chain and eleven windows.
         *
         * ⛔ REBASED BY THE WINDOW'S OFFSET, because a tape's `at` is
         * WINDOW-LOCAL and the resumed run's `ticksCompleted` is the
         * SEQUENCE's. An unrebased row would fire in whichever earlier window
         * happened to span that tick, or never.
         *
         * ⛔ AND ONLY FOR k > 0. Window 0 STAGES its own run, where
         * `createLevelRun` reads the tape's timed rows at construction exactly
         * as it always has — untouched by this slice.
         */
        if (k > 0) {
            const forward = (parsedTapes[k].persistence ?? [])
                .filter((c) => c.at !== undefined)
                .map((c) => ({ ...c, at: c.at + offset }));
            if (forward.length > 0) {
                try {
                    run.addTimedClears(forward);
                } catch (e) {
                    return stop(`window ${k} ("${names[k]}") declares a forward clear this `
                        + 'world cannot take', e.message);
                }
            }
            seq.boundaries[seq.boundaries.length - 1].forwardRows = forward
                .map((c) => `${c.level}:${c.tag}@${c.at}`);
        }
        const transitionsBefore = run ? run.transitions.length : 0;
        // eslint-disable-next-line no-await-in-loop
        const collected = collectRun(tapes[k], levelSource, k === 0 ? {} : { run });
        if (collected.error) {
            return stop(`window ${k} ("${names[k]}") threw mid-walk`, collected.error.message);
        }
        run = collected.run;
        sofar.run = run;
        const isLast = k === tapes.length - 1;
        const keep = isLast ? collected.frames.length : collected.frames.length - 1;
        for (let i = 0; i < keep; i += 1) {
            const f = collected.frames[i];
            frames.push({ ...f, observation: { ...f.observation, t: offset + f.observation.t } });
            samples.push(collected.samples[i]);
        }
        /**
         * ⛔⛔ THE WINDOW'S OWN TRANSITIONS, SLICED AND REBASED — and the first
         * Windows run of the ship row is what caught this (trap 436: a LIVE
         * read versus a buffered stream, in its nastiest costume).
         *
         * `modelStreamOf` returns `finished.transitions`, which IS the run's
         * OWN array — the same object, sequence-absolute and STILL GROWING. So
         * window 1's "model stream" quietly acquired window 2's transition at
         * t=1645 the moment window 2 crossed a door, and the per-window verdict
         * refused by name: *"transitions[1].t (1645) is past the end of the
         * stream (865 observations)"*. ⇒ each window takes the transitions its
         * OWN span produced, by INDEX (so the boundary transition belongs to
         * the window that made it and to no other), rebased to window-local
         * ticks. The WHOLE sequence's stream keeps the absolute numbering,
         * which is what its own verdict compares.
         */
        const mine = collected.finished
            ? collected.finished.transitions.slice(transitionsBefore)
                .map((t) => ({ ...t, t: t.t - offset }))
            : [];
        perWindow.push({
            tape: tapes[k],
            label: names[k],
            modelStream: collected.finished
                ? { ticks: [...collected.finished.ticks], transitions: mine } : null,
            modelStreamWhy: collected.finished ? null
                : 'the JS model did not finish this window',
            expect: expectFromFrames(collected.frames),
            expectWhy: collected.frames.length ? null : 'the model collected no frames',
        });
        seq.windows.push({
            index: k,
            label: names[k],
            from: offset,
            to: offset + collected.parsed.tick_count,
            ticks: collected.parsed.tick_count,
            observations: collected.finished.ticks.length,
            finished: {
                transitions: collected.finished.transitions.length,
                transports: collected.finished.transports.length,
                grants: collected.finished.grants.length,
                collected: collected.finished.collected.length,
            },
            endLevel: run.level,
            endCtor: run.worldCtor,
        });
        /**
         * ⛓ THE DIRECTOR'S OWN BOUNDARY CHECKS, over the MODEL's per-tick
         * samples — `boundaryFindings` wants a `botStatus`-shaped readout on
         * each side, and the model's is its last observation plus its item
         * mirror. ⛔ `streamBoundaryFindings` is the one that can be believed
         * (its own docblock): both sides are the currency the differential
         * compares.
         */
        if (k > 0 && last) {
            const b = seq.boundaries[seq.boundaries.length - 1];
            b.stream = streamBoundaryFindings(
                { ticks: last.finished.ticks }, { ticks: collected.finished.ticks },
                { index: k - 1, label: names[k] },
            );
            b.status = boundaryFindings(
                modelStatusOf(last), modelStatusOf(collected, 0),
                { ticks: last.finished.ticks }, { index: k - 1, label: names[k] },
            );
        }
        offset += collected.parsed.tick_count;
        last = collected;
        if (!lifetime.alive()) return seq;
    }

    seq.admitted = true;
    seq.ticks = offset;
    seq.observations = frames.length;
    /**
     * ⛓⛓⛓ THE STREAM ITSELF, ON THE READOUT — and `watchWasm`'s opposite rule
     * is not being broken, it is being distinguished.
     *
     * There the readout publishes the DIFF and not the stream, because the
     * comparator has both sides in the page and a few thousand observations
     * through `__watch` would make every ship publish a megabyte. Here the
     * CLAIM IS AN EQUALITY WITH AN OUTSIDE ORACLE — the headline `r8-d2`
     * replayed alone — and the oracle lives in node, in the row. A digest
     * computed in the page and compared to a digest computed in the row would
     * be an ECHO (trap 269): it would agree with itself for any stream both
     * sides happened to spell the same way. So the row takes the OBSERVATIONS
     * and diffs them against its own `runTapeToStream`. 1646 of
     * `{t, level, x, y}` is ~60 KB.
     */
    seq.stream = frames.map((f) => f.observation);
    const combinedParsed = { ...parsedTapes[0], tick_count: offset };
    const combined = {
        parsed: combinedParsed,
        frames,
        samples,
        // ⛔ The RUN's own return, with the combined observation stream in
        // place of the last window's — every other field on it (transitions,
        // transports, grants, the ledgers) is already sequence-absolute
        // because `ticksCompleted` continues across a resumed window.
        finished: { ...last.finished, ticks: frames.map((f) => f.observation) },
        run,
        error: null,
    };
    /**
     * ⛓ R9 SLICE 10 — the campaign readout for the walk that FINISHED, published
     * here rather than in each arm so the JS arm and the wasm arm cannot end up
     * with two answers about the same walk (the wasm arm ships AFTER this and
     * changes none of it: the windows are the ones this walk admitted).
     */
    publishCampaign(seq, parsedTapes, names, run);
    return {
        seq, stop, names, tapes, parsedTapes, run, frames, samples,
        combined, combinedParsed,
        label: `${names.join(' → ')} — ${names.length} window(s), one game state`,
        perWindow,
    };
}

/**
 * ⛓ THE JS ARM — scrub the walk. `?tapes=` with `side=js`.
 */
async function runJsSequence(params, lifetime) {
    const { levelSource } = await armPrelude(params, lifetime);
    const walked = await walkSequence(params, lifetime, levelSource);
    if (!walked || walked.stopped || !walked.seq.admitted) return walked?.seq ?? null;
    return replayTape(walked.combinedParsed, walked.label, params, levelSource, null, null,
        { precollected: walked.combined, sequence: walked.seq });
}

/**
 * ⛓⛓⛓ THE WASM ARM — the SAME windows, shipped to the real game (⚖ ruling 10's
 * second half). `?tapes=` with `side=wasm`.
 *
 * ⛔ THE MODEL WALK COMES FIRST AND IS THE SAME ONE. `walkSequence` steps the N
 * windows on one JS run, which does three jobs at once: it ADMITS every
 * boundary before a single tape reaches the game (so a non-continuable queue is
 * refused without touching the frame at all), it produces the per-window model
 * streams the per-window verdict compares against, and it produces the WHOLE
 * sequence's stream, which is what the concatenation verdict is about.
 *
 * ⚠ A JS-side refusal STOPS THE SHIP. The alternative — ship anyway and let the
 * game's own boundary report it — would be interesting exactly once and would
 * spend a real GPU run to learn what the model already knew by name.
 */
async function runWasmSequence(params, lifetime) {
    const { levelSource } = await armPrelude(params, lifetime);
    const walked = await walkSequence(params, lifetime, levelSource);
    if (!walked || walked.stopped || !walked.seq.admitted) return walked?.seq ?? null;
    if (!lifetime.alive()) return walked.seq;
    window.__editorSequence = walked.seq;
    return shipToWasm(
        {
            windows: walked.perWindow,
            label: walked.label,
            /**
             * ⛓ R9 SLICE 8 — the atlas the POSTURE GATE reads. Passing the
             * source the page is ALREADY rendering from, rather than letting
             * `watchWasm` reach for its own, is the point: a posture computed
             * against a different atlas than the one on screen would be a true
             * sentence about the wrong room.
             */
            levelSource,
            /**
             * ⛓ THE WHOLE SEQUENCE'S expectation and stream — for one window
             * these are the same objects the single-tape ship has always
             * passed; for N they are the SEQUENCE's, which is the subject the
             * concatenation verdict is about.
             */
            expect: walked.perWindow[walked.perWindow.length - 1].expect,
            expectWhy: null,
            modelStream: modelStreamOf(walked.combined),
            modelStreamWhy: null,
            note: `${walked.perWindow.length} window(s) on ONE game state — `
                + `${walked.names.join(' → ')}`,
        },
        {
            frame: $('frame'),
            lifetime,
            readout: replayWasmReadout(lifetime, params.source),
            tolerance: END_STATE_TOLERANCE,
        },
    );
}

/**
 * A `botStatus`-shaped readout OUT OF THE MODEL, for the two director checks
 * that were written against the game's.
 *
 * ⚠ It carries what the model HAS and omits what it does not: no
 * `dead_frames` (that is `continuationFindings`' input and belongs to the wasm
 * row), no `persistence_cleared` beyond the run's earned rows. The absent
 * fields make their checks report rather than pass, which is the module's own
 * rule about an unasserted check.
 */
function modelStatusOf(collected, at = -1) {
    const o = at < 0 ? collected.finished.ticks.at(-1) : collected.finished.ticks[at];
    const inv = collected.run.inventory;
    return {
        level: o.level,
        x: o.x,
        y: o.y,
        items: inv,
        grants: [],
        persistence_cleared: collected.run.earnedClears.map((c) => ({
            level: c.level, tag: c.tag,
        })),
    };
}

/**
 * A committed tape's decision trace, if it has one.
 *
 * ⚠ A MISSING SIDECAR IS THE NORM, NOT AN ERROR — most of the roster is
 * hand-authored and only the solver's tapes carry a trace. So this NEVER
 * throws and always returns a reason: the pane renders "no trace for this
 * tape — <why>", with the path it looked for, and a fetch that failed for
 * some other reason (a malformed sidecar, a server error) is distinguishable
 * from a tape that simply never had one.
 *
 * ⛔ THROUGH `parseDecisionTrace`, the producer's own validator. A sidecar
 * this page rendered without validating would be a second, laxer reader of
 * a format that already has one.
 */
async function fetchTraceSidecar(tapePath) {
    const { path, why } = traceSidecarPath(tapePath);
    if (!path) return { trace: null, why };
    try {
        const res = await fetchArtifact(repoUrl(path));
        if (!res.ok) {
            return { trace: null, why: `${path} — HTTP ${res.status} (only the solver's `
                + 'tapes carry a trace sidecar)' };
        }
        return { trace: parseDecisionTrace(await res.json(), path), why: null };
    } catch (e) {
        return { trace: null, why: `${path} — ${e.message}` };
    }
}

/**
 * Draw and scrub a tape — one fetched by REPLAY, or one SOLVE just folded.
 *
 * ⚠ ONE REPLAY PATH for both arms, deliberately. A solved tape shown by
 * some second, simpler renderer would be a picture of a run nobody had
 * replayed; going through here means the thing on screen is the thing the
 * stepper produced, which is the thing the differential would check.
 * `label` is what the status bar calls it — a path for REPLAY, a name for
 * SOLVE. Returns the collected frames, so a caller can report how many.
 */
/**
 * The renderer's per-level world source, memoised — ONE rule, and both arms
 * of the page reach it.
 *
 * ⚠ THE CENSUS THE STAGING BLOCK IMPLIES, THROUGH THE RUNNER'S OWN RULE, so
 * the viewer can never refuse to draw a level the run walks through. This
 * used to read `tape.noclip === false ? ROLES : RELAXED_ROLES` off the RAW
 * fetched JSON: a second spelling of `rolesForStaging` that agreed with it
 * only by accident, because a v1 tape's JSON carries no `noclip` key at all.
 * The raw test got the right answer for the wrong reason, and the obvious
 * tidy-up to `tape.noclip ? …` would have silently flipped the census on
 * every v1 fixture.
 *
 * ⚠ AND THE STAGING'S CLEARS, for the same reason as the census: a viewer
 * that built a level the run does not have would draw locks the player walks
 * straight through. Grouped BY LEVEL because `buildLevelWorld`'s orphan
 * guard refuses a tag the level does not own — the same rule `levelRun`
 * follows, and the reason it groups too.
 *
 * ⛓ `staging` is a PARSED TAPE for REPLAY/SOLVE and a MANUAL session's own
 * honest block for MANUAL. The two carry the same two fields this needs
 * (`noclip`, `persistence`), which is exactly what makes one rule possible —
 * `tapeRunner.stagingFromTape`'s whole point is that a tape IS a staging
 * block plus inputs.
 */
function makeWorldFor(levelSource, staging) {
    const roles = rolesForStaging(staging);
    const clearedByLevel = new Map();
    for (const c of staging.persistence ?? []) {
        if (!clearedByLevel.has(c.level)) clearedByLevel.set(c.level, []);
        clearedByLevel.get(c.level).push(c.tag);
    }
    const worlds = new Map();
    return (n) => {
        if (!worlds.has(n)) {
            const cleared = clearedByLevel.get(n);
            worlds.set(n, buildLevelWorld(levelSource(n),
                cleared ? { roles, cleared } : { roles }));
        }
        return worlds.get(n);
    };
}

/**
 * The ON set for this page load, and the `?layers=` names nobody knows.
 *
 * ⚠ CALLED ONCE PER ARM, and the Set it returns IS the live toggle state —
 * the checkboxes mutate it in place. Calling it again per draw would rebuild
 * the defaults every frame and silently undo every toggle.
 */
function layerSetFor(params) {
    const parsed = parseLayersParam(params.layers);
    return { on: parsed.on ?? defaultLayerSet(), unknown: parsed.unknown };
}

/**
 * ⛓⛓⛓ GROUP B — THE ATTACK HOLD, AND IT IS PAGE STATE RATHER THAN ARM STATE.
 *
 * The layer SET is per arm (`mountLayerControls` is handed one), because which
 * layers you want is a question about the walk you are looking at. How long an
 * afterimage should linger is a question about YOUR EYES, so it survives an arm
 * switch the way `?speed=` does — and the switch arc's whole point is that
 * changing SOURCE no longer reloads, which would otherwise be the only thing
 * resetting it.
 *
 * ⛔ IT IS READ AT DRAW TIME, NEVER CAPTURED. Every draw site passes
 * `attackHold: attackHoldNow()`, so the control's `onchange` needs to do
 * nothing but write and redraw — a value closed over at mount would go stale
 * the first time the knob moved, silently, and only on the arm that mounted
 * first.
 */
let attackHold = ATTACK_HOLD_DEFAULT;
const attackHoldNow = () => attackHold;

/**
 * ⛓⛓⛓ GROUP B — AUTO-ADVANCE THE CEREMONY TEXT WHILE DRIVING BY HAND.
 *
 * ⚖ The user's own suggestion, and ON by default because without it a manual
 * drive that walks onto a pickup simply stops: the screen freezes, the page
 * says nothing, and paging out needs SPACED X releases the driver has no way
 * to know about (`PRESS_GAP` — a release that lands mid-type-out fast-forwards
 * the page instead of turning it).
 *
 * ⛔ IT IS A SWITCH AND HAS TO BE. It makes the page dispatch keys the driver
 * did not press, and those keys are RECORDED — they are in the folded tape,
 * which is the honest outcome and also exactly why turning it off must be
 * possible. Page state like `attackHold`, for the same reason: it is a
 * question about how you want to drive, not about the walk you are looking at.
 */
let autoAdvanceText = true;
const autoAdvanceTextNow = () => autoAdvanceText;

/**
 * The per-layer toggles and the LEGEND, both generated from `OVERLAY_LAYERS`
 * and `MARKER_GLYPHS`.
 *
 * ⛔ ONE ROSTER. A hand-written checkbox list would be a second copy of the
 * layer table, and the day a layer was added the URL parameter and the UI
 * would disagree about how many there are.
 *
 * ⛓ Extracted from `replayTape` at slice 3 so the MANUAL arm gets the same
 * eight toggles over its LIVE drive — a second copy for the live view would
 * be the same fork one level down.
 */
function mountLayerControls(on, redraw) {
    const layerBox = $('layers');
    layerBox.innerHTML = '';
    for (const l of OVERLAY_LAYERS) {
        const label = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.id = `layer-${l.id}`;
        box.checked = on.has(l.id);
        box.onchange = () => {
            if (box.checked) on.add(l.id); else on.delete(l.id);
            redraw();
        };
        label.appendChild(box);
        label.appendChild(document.createTextNode(` ${l.label}`));
        layerBox.appendChild(label);
    }
    /**
     * ⛓⛓⛓ GROUP B — THE HOLD KNOB, NEXT TO the toggles and NOT INSIDE THEM.
     *
     * ⛔⛔ `#viewknobs`, NOT `#layers`, AND THE CONTAINER IS A CONTRACT. Three
     * acceptance rows enumerate `#layers input` to assert that the toggle count
     * and `OVERLAY_LAYERS` agree — so a field that is not a layer, mounted in
     * that box, reports the roster as one longer than it is. MEASURED: the
     * first cut put it there and reddened `check-seedling-editor-world`,
     * `-lanes` and `-shapes` simultaneously, each complaining "FIFTEEN now — 16".
     * It is a knob about the DISPLAY, not a member of the roster, and it now
     * lives where that is true of the DOM as well as of the prose.
     *
     * ⚠ `.onchange`, NOT `addEventListener` — the idiom every control in this
     * function already uses, and the one `watchLifetime.test.js` asserts
     * STRUCTURALLY over this source. The box is rebuilt on every arm mount, so
     * the handler dies with the element and there is nothing to retire.
     */
    const knobBox = $('viewknobs');
    knobBox.innerHTML = '';
    const holdLabel = document.createElement('label');
    holdLabel.title = `${SWING_WINDOW_NOTE.hold}\n\n${SWING_WINDOW_NOTE.sword}`
        + `\n\n${SWING_WINDOW_NOTE.spear}`;
    const holdInput = document.createElement('input');
    holdInput.type = 'number';
    holdInput.id = 'attack-hold';
    holdInput.min = '0';
    holdInput.step = '1';
    holdInput.style.width = '52px';
    holdInput.value = String(attackHoldNow());
    holdInput.onchange = () => {
        const n = Number(holdInput.value);
        // ⚠ A TYPED-IN NONSENSE VALUE SNAPS BACK rather than being accepted as
        // NaN and quietly drawing nothing — the field then SHOWS what is in
        // force, which is the only way a reader can tell the two apart.
        attackHold = Number.isInteger(n) && n >= 0 ? n : attackHoldNow();
        holdInput.value = String(attackHoldNow());
        redraw();
    };
    holdLabel.appendChild(document.createTextNode('attack hold '));
    holdLabel.appendChild(holdInput);
    holdLabel.appendChild(document.createTextNode(' ticks (display choice)'));
    knobBox.appendChild(holdLabel);
    /**
     * ⛓⛓⛓ GROUP B — THE AUTO-ADVANCE SWITCH, in the knob box beside the hold.
     *
     * ⚠ IT ONLY BITES ON THE MANUAL ARM (nothing else dispatches keys), but it
     * is mounted for every arm on purpose: an option that appeared and vanished
     * with the SOURCE selector would be one a reader could not find in order
     * to reason about a tape they had already driven.
     */
    const autoLabel = document.createElement('label');
    autoLabel.title = 'A pickup ceremony freezes the player and pages on `Input.released(X)`, '
        + 'spaced by `PRESS_GAP` — a release that lands mid-type-out fast-forwards the page '
        + 'instead of turning it. With this on, the page drives those releases for you, on '
        + 'the SAME cadence `botDriverV2.runCollect` uses. ⚠ They are RECORDED: the folded '
        + 'tape contains every key dispatched, including these.';
    const autoBox = document.createElement('input');
    autoBox.type = 'checkbox';
    autoBox.id = 'auto-advance-text';
    autoBox.checked = autoAdvanceTextNow();
    autoBox.onchange = () => { autoAdvanceText = autoBox.checked; };
    autoLabel.appendChild(autoBox);
    autoLabel.appendChild(document.createTextNode(
        ' auto-advance ceremony text while driving (records the X releases)'));
    knobBox.appendChild(autoLabel);
    const swatch = (colour, text) =>
        `<span class="sw"><i style="background:${colour}"></i>${text}</span>`;
    $('legend').innerHTML = [
        swatch(PATH_COLOURS.player, 'player'),
        swatch(PATH_COLOURS.chaser, 'chaser'),
        swatch(PATH_COLOURS.spinner, 'spinner'),
        swatch(PATH_COLOURS.pushable, 'pushable'),
        swatch(PATH_COLOURS.arrow, 'arrow'),
        // ⛓ SLICE 6's three, each with a row of its own. A layer whose ink
        // nobody can name is the `unknownShapes` lesson applied to colour —
        // the reason this legend is generated from the tables rather than
        // written out — and three new strokes with no legend rows would have
        // re-opened exactly that.
        swatch(SHAPE_COLOURS.hitbox, 'enemy hitbox (this tick)'),
        // ⛓ ⚖ ITEM (iv): its own row, generated from the same table the
        // renderer colours from — a hue nobody can name is the `unknownShapes`
        // lesson applied to ink, and this one is a whole family of body.
        swatch(SHAPE_COLOURS.staticEnemy, 'static "Enemy" PLACEMENT — a body this room does '
            + 'not step (a sandtrap, a dead-lane turret, or any chaser in a room whose '
            + 'roster is REFUSED). Where the LEVEL put it, not where a run has it'),
        swatch(SHAPE_COLOURS.hammer, 'hammer line'),
        swatch(SHAPE_COLOURS.hammerTouch, 'hammer REACHING the player'),
        swatch(SHAPE_COLOURS.attack, 'attack rect (fired) — a SWORD press fires '
            + `${SLASH_HIT_TICKS}, on T+1…T+${SLASH_HIT_TICKS}; a spear records ONE`),
        // ⛓⛓⛓ GROUP B. The row says "display choice" in words for the same
        // reason the `danger` row says "the bot's HEURISTIC": this is the only
        // other stroke on the canvas that is not something the run did, and a
        // reader who cannot tell it from the live rect has the page's own
        // afterimage back as evidence.
        swatch(SHAPE_COLOURS.attackHeld, 'the same rect HELD after the swing ended — '
            + 'a DISPLAY CHOICE of this page, not the game\'s timing (set the hold to 0)'),
        // ⛓ SLICE 8, and the wording carries the whole distinction: the
        // ARROW swatch above is the sampled FLIGHTS, this is the trap's own
        // COLUMN while it is armed. Two layers, two rows, two sentences —
        // a legend that said "arrows" twice would be the blur itself.
        swatch(SHAPE_COLOURS.lane, 'armed arrow-trap LANE (the column, not the flights)'),
        // ⛓ SLICE 9. Six rows for three layers, because three of the strokes
        // are corrections to the BASE picture and a reader who cannot tell a
        // correction from a fact has the picture's distinction and not the
        // legend's — the `unknownShapes` lesson applied to meaning.
        swatch(SHAPE_COLOURS.gone, 'GONE — the level built a solid here and the run has removed it'),
        swatch(SHAPE_COLOURS.swapped, 'the box that is REALLY there now (a pulled rope, a turret corpse)'),
        swatch(SHAPE_COLOURS.notsolid, 'drawn as a wall and NOT one — a live ice turret is an Enemy'),
        swatch(SHAPE_COLOURS.crusher, 'crusher body, where the RUN left it'),
        swatch(SHAPE_COLOURS.crusherLaneLive, 'crusher trigger lane the scan MATCHED (dim = not matched)'),
        // ⚖ The one OPINION on the canvas, and the row says so in words —
        // item 9's "labelled as the bot's HEURISTIC" is this line plus the ink.
        swatch(SHAPE_COLOURS.danger, 'the box the SOLVER asked about, and was told DANGER '
            + '(dim = told clear) — the bot\'s HEURISTIC, not what happened'),
        /**
         * ⛓⛓⛓ GROUP B — THE PLAYER'S TWO BOXES, NAMED.
         *
         * ⚖ The user's question was "which of these is the real hitbox?", and
         * that it had to be asked at all is the finding: the page drew two
         * overlapping boxes one pixel apart and told nobody which was which.
         * ⚖ The ruling was to keep both and DOCUMENT them, so these two rows
         * are the fix. See the draw site for the mechanism.
         */
        swatch('#ffffff', 'the PLAYER HITBOX — `playerBoxAt`, the box that collides '
            + 'solids and the box `dangerAt` is asked about'),
        swatch('#ffd75f', 'the TERRAIN PROBE — `terrainProbeRect`, the hitbox shifted down '
            + '`checkOffsetY` (1 px), which `getState` compares the nearest tile against. '
            + 'NOT a collision volume'),
        /**
         * ⛓⛓⛓ GROUP B — ONE ROW PER OBJECT-SOLID FAMILY, generated from the
         * table the renderer colours from, for `OVERLAY_LAYERS`' own reason: a
         * hand-written list would be a second copy, and the day a family was
         * added the canvas would grow a hue with no name.
         */
        ...OBJECT_SOLID_FAMILIES.map((f) => swatch(f.colour, f.label)),
        swatch(SCENERY_COLOUR, 'scenery — an object solid with no state a run can change '
            + '(trees, poles, statues, furniture: 1057 of the atlas\'s 1219)'),
        ...Object.values(MARKER_GLYPHS).map(
            (g) => swatch(g.colour, `${g.glyph} = ${g.label}`)),
    ].join('');
}

/**
 * @param {Array|null} [dangerQueries] ⚖ item 9 — `solveSegment`'s record of
 *   the danger the SOLVER was told, when this replay is a solve's own output.
 *   `null` on every other path, and the distinction is load-bearing: the layer
 *   reports "no solver ran" by NAME rather than drawing an empty picture that
 *   looks like a calm room (trap 196, and item 9 names the sentence).
 */
/**
 * ⛓⛓⛓ `afterDraw` — **THE SIBLING-OVERLAY SEAM** (PROCGEN ELEMENTS arc 3,
 * slice 5a, D5). ⛔ It is a CALLBACK and not a new `view` field on the renderer:
 * `makeRenderer.draw`'s contract is that every option says how to PRESENT THE
 * WORLD IT WAS HANDED, and a site class or an area partition is a fact about
 * the MODEL that produced the world — the renderer's other callers (SOLVE,
 * MANUAL, the panel) have no model at all. Extending the renderer would also
 * expire the world row's `drawn.*` readouts, which are a gate. ⇒ the GENERATE
 * arm is the ONE caller that passes this, and it draws AFTER every
 * `renderer.draw`, including every scrub frame.
 */
async function replayTape(tape, label, params, levelSource, traceSource = null,
    dangerQueries = null, {
        scratchPersistence = false, afterDraw = null, precollected = null, sequence = null,
    } = {}) {
    replayGeneration += 1;
    const myGeneration = replayGeneration;
    const canvas = $('canvas');
    const renderer = makeRenderer(canvas);
    const parsed = parseTape(tape);
    const worldFor = makeWorldFor(levelSource, parsed);

    /**
     * ⛓⛓⛓ ONE WALK, TWO READINGS — the frames the scrubber shows and the
     * per-tick mover SAMPLES the overlays draw, collected together by
     * `watchOverlays.collectRun`.
     *
     * Collect eagerly: a tape is at most a few thousand ticks and the whole
     * point of scrubbing is that going BACK costs nothing. It is still the
     * one loop — every frame and every sample comes from the stepper, and
     * the samples come through its `onTick` hook, whose own docblock calls
     * it "the one seam a claim may read live state through".
     *
     * ⛔ THIS IS WHY NO ENGINE CHANGE WAS NEEDED, and slice 1's §8.8 note
     * expected one. That note read the stepper's RETURN OBJECT (`{tape,
     * tickCount, worldFor, next, …}`, which indeed exposes no run) and
     * concluded slice 2 needed an additive `run` getter. It does not: the
     * hook has forwarded the run since R6 slice 4. A getter beside it would
     * have been a second way to reach the same object — trap 119's family
     * in its other form, a seam with no consumer because the consumer
     * already had one.
     */
    /**
     * ⛓⛓⛓ PROCGEN PoC SLICE 5 — THE SCRUB FORK, and the ONE caller that
     * passes the flag is the GENERATE arm.
     *
     * §13.4's residue: a generated solve can bank a kill-lock clear that
     * `tapeFormat` cannot declare (`persistence[].level` is bounded to the
     * real game's 0..115 and a generated level is 900), so re-stepping that
     * tape on the ordinary path throws MID-WALK — measured, 270 of 379
     * frames. The default here is FALSE, so every other arm (REPLAY, SOLVE,
     * MANUAL, a paste, an upload) scrubs exactly as it always did and a
     * committed tape's undeclared clear is still the refusal it should be.
     */
    /**
     * ⛓⛓⛓ R9 SLICE 2 — **`precollected`, AND IT IS THE ONLY SEAM THE SEQUENCE
     * NEEDS.** (⚖ ruling 10.)
     *
     * The SEQUENCE arm walks its N windows on ONE live run before the viewer
     * mounts — window k+1 resumes window k's run through `createTapeStepper`'s
     * `run` option — and hands the combined walk in here. ⛔ Nothing else
     * changes: the rAF loop is not forked, the scrub, the HUD, the overlays,
     * the markers and the trace pane all read the same `{frames, samples,
     * finished, run}` shape they always did, and the combined frames are
     * indexed by SEQUENCE-ABSOLUTE tick so `overlaysFor`'s `frameAt(t)` places
     * a run-absolute ledger row exactly as it does for one tape.
     *
     * ⚠ THE BRIEF ASKED FOR AN END-OF-TAPE HOOK ON THE rAF LOOP INSTEAD, and
     * this is the same claim collected the way this function already collects.
     * Its own docblock above is the reason: *"Collect eagerly: a tape is at
     * most a few thousand ticks and the whole point of scrubbing is that going
     * BACK costs nothing."* A hook that collected window k+1 when the CURSOR
     * reached the end of window k would make the scrub span the sequence only
     * after you had watched it, and would put a second collection path inside
     * the one loop that must never be forked. Said out loud in the as-built.
     */
    const collected = precollected ?? collectRun(tape, levelSource, { scratchPersistence });
    const { frames, samples, finished, run } = collected;
    if (collected.error) {
        fatal('the run threw before finishing — the viewer shows what it got',
            collected.error.message);
    }
    let cursor = 0;
    /**
     * ⛓ `?tick=` AND `?shot=` BOTH START PAUSED, and that is the whole
     * content of "initial cursor". A page that landed on tick 200 and
     * immediately played forward from it has not shown you tick 200; the
     * parameter would be a flicker. `?shot=1` needs it for a second reason —
     * a screenshot of an animating page is a screenshot of whenever the
     * shutter happened to open.
     */
    let playing = !(params.shot || params.tick !== null);
    let speed = params.speed;

    /**
     * ── THE LAYERS, THE MARKERS AND THE LEGEND (kickoff §3.2) ──────────
     *
     * Derived ONCE, from the ledgers the run already kept and the frames
     * just collected. Nothing here re-simulates anything, and every
     * marker's position is the position the run held on the tick its own
     * ledger names.
     */
    const layerParam = layerSetFor(params);
    const on = layerParam.on;
    const { markers, unplaced, presses } = overlaysFor(collected);

    $('scrub').max = String(Math.max(0, frames.length - 1));
    $('status').className = 'ok';
    $('status').textContent = `${label} — ${frames.length} observations`;

    const hud = () => {
        const f = frames[cursor];
        if (!f) return;
        const world = worldFor(f.observation.level);
        const raw = f.state.terrain ?? 0;
        const eff = coerceTerrainState(raw, parsed.noHazards ?? []);
        const fall = f.state.fall;
        $('hud').innerHTML = [
            row('tick', `${f.observation.t} / ${parsed.tick_count}`),
            row('level', `${f.observation.level} (${world.width}x${world.height})`),
            row('position', `${fmt(f.observation.x)}, ${fmt(f.observation.y)}`),
            row('velocity', `${fmt(f.state.vx)}, ${fmt(f.state.vy)}`),
            // BOTH values. `noHazards` is exactly their difference, and a
            // viewer that showed one would hide the whole relaxation.
            row('terrain raw', `${raw} ${TILE_TYPE_NAMES[raw] ?? ''}`),
            row('terrain effective', `${eff} ${TILE_TYPE_NAMES[eff] ?? ''}`,
                eff === raw ? '' : 'coerced'),
            row('held', [...f.held].join(' + ') || '—'),
            row('transport', fall
                ? `${fall.phase}${fall.phase === 'out' ? ` alpha ${fmt(fall.alpha)}`
                    : ` yStart ${fall.yStart}${fall.bounced ? ' (bounced)' : ''}`}`
                : '—', fall ? 'transport' : ''),
            row('transitions', f.transitions.length
                ? f.transitions.map((t) => `${t.from_level}→${t.to_level}@${t.t}`).join(' ')
                : '—'),
            row('grants', f.grants.length
                ? f.grants.map((g) => `L${g.level} ${g.items.join('+')}@${g.t}`).join(' ')
                : '—'),
            row('items', f.inventory
                ? (ITEM_NAMES.filter((n) => n !== 'health')
                    .filter((n) => f.inventory[itemProp(n)]).join(' ') || '—')
                    + `  hitsMax=${f.inventory.hitsMax}`
                : '—'),
        ].join('');
        renderer.draw(world, f.state, {
            on,
            samples,
            markers,
            presses,
            // ⛓ GROUP B: read at DRAW time, never captured — see `attackHold`.
            attackHold: attackHoldNow(),
            cursor,
            /**
             * ⛓⛓⛓ SLICE 9 — THE R5 FORWARD, READ OFF THE FRAME ITSELF.
             * `crushers`/`crusherScans` are the two channels `sampleMovers`
             * deliberately did NOT copy (its own docblock: they "are already
             * on the frame"), so the layer takes them from the frame the
             * scrubber is showing rather than from a second reading. That is
             * what makes this the FORWARD's reader and not a fifth sampler.
             */
            live: { crushers: f.crushers, crusherScans: f.crusherScans },
            /**
             * ⛓ ⚖ ITEM (iv): the STATIC bodies, from the replay's own run.
             * ⚠ NOT per-tick and not on the frame — a census placement does not
             * change with the cursor, which is exactly what distinguishes it
             * from every other body channel here.
             */
            staticEnemies: staticEnemyBodies(collected.run, {
                // ⛔ THE FRAME'S LEVEL, NOT THE RUN'S — the walk ended
                // somewhere and the cursor is somewhere else.
                level: f.observation.level,
                // ⛔ AND THE LIVE ROSTER AT THIS CURSOR, from the samples the
                // shape layers already read. `run.spinnerBodies` is the room
                // the run ENDED in and would exclude the wrong bodies here.
                liveIds: bodiesAt(samples, cursor, f.observation.level).bodies
                    .filter((b) => b.kind === 'spinner').map((b) => b.id),
            }),
            dangerQueries,
        });
        // ⛓ SLICE 5a — THE SIBLINGS, after every draw including every scrub
        // frame. `null` on every arm but GENERATE.
        afterDraw?.(canvas);
        // ⛓ GROUP B: scrubbing a REPLAY through a pickup shows its text too —
        // the same call the manual arm makes, over the same sample channel.
        dialogue = renderDialogue(samples, cursor, f.observation.level);
        pane.highlight(cursor);
    };
    /** ⛓ GROUP B: the last ceremony readout, for `__editorOverlays`. */
    let dialogue = { ceremony: null, visible: '', why: null };

    const itemProp = (name) => {
        // The property behind an item name, without importing the table's
        // internals: the mirror is keyed by property.
        const map = {
            sword: 'hasSword', darksword: 'hasDarkSword', ghostsword: 'hasGhostSword',
            shield: 'hasShield', darkshield: 'hasDarkShield', wand: 'hasWand',
            firewand: 'hasFireWand', fire: 'hasFire', conch: 'canSwim',
            feather: 'hasFeather', spear: 'hasSpear', darksuit: 'hasDarkSuit',
            torch: 'hasTorch',
        };
        return map[name] ?? name;
    };
    const row = (k, v, cls = '') =>
        `<div class="r ${cls}"><span>${k}</span><b>${v}</b></div>`;

    function seek(i) {
        cursor = Math.max(0, Math.min(frames.length - 1, i));
        renderer.reset();
        for (let j = 0; j <= cursor; j++) renderer.mark(frames[j].state, frames[j].observation.level);
        $('scrub').value = String(cursor);
        hud();
    }

    let acc = 0;
    /**
     * ⚠ A THROW IN HERE USED TO STOP THE CLOCK AND SAY NOTHING.
     *
     * `requestAnimationFrame(frame)` is the LAST statement, so anything that
     * threw above it — a level whose geometry the renderer had no arm for,
     * say — skipped the re-arm and the animation simply froze mid-walk. No
     * status, no detail, no console line the page surfaced: indistinguishable
     * from a slow tape or a paused one.
     *
     * That is exactly how R4's third hazard shape presented: the viewer
     * stopped "near the beginning, when it entered level 12", which holds
     * FIVE bosslocks. So the re-arm is unconditional now and the failure is
     * REPORTED, once, with the tick it happened on — a viewer that cannot
     * draw a frame should say which one.
     */
    let frameError = null;
    function frame() {
        // ⛔ SUPERSEDED, so this loop retires. NOT the same thing as the
        // conditional re-arm the docblock above forbids: a throw still
        // re-arms below, because a frame that cannot be drawn must report
        // its tick rather than stop the clock.
        if (myGeneration !== replayGeneration) return;
        try {
            if (playing && frames.length) {
                acc += speed;
                while (acc >= 1 && cursor < frames.length - 1) {
                    cursor += 1;
                    acc -= 1;
                    renderer.mark(frames[cursor].state, frames[cursor].observation.level);
                }
                if (acc >= 1) acc = 0;
                if (cursor >= frames.length - 1) playing = false;
                $('scrub').value = String(cursor);
                hud();
            }
        } catch (e) {
            playing = false;
            if (!frameError) {
                frameError = e;
                const f = frames[cursor];
                fatal(`the viewer could not draw observation ${f?.observation.t} `
                    + `(level ${f?.observation.level}) — the RUN is unaffected, this is `
                    + 'the drawing side', `${e.message}\n${e.stack ?? ''}`);
            }
        }
        requestAnimationFrame(frame);
    }

    $('play').onclick = () => {
        if (cursor >= frames.length - 1) seek(0);
        playing = !playing;
        $('play').textContent = playing ? 'Pause' : 'Play';
    };
    $('scrub').oninput = (e) => { playing = false; $('play').textContent = 'Play'; seek(Number(e.target.value)); };
    $('speed').oninput = (e) => { speed = Number(e.target.value); $('speedv').textContent = `${speed}x`; };
    $('speed').value = String(speed);
    $('speedv').textContent = `${speed}x`;

    mountLayerControls(on, hud);

    // ── the trace pane (kickoff §3.3) ────────────────────────────────
    const pane = mountTracePane(traceSource, (t) => {
        playing = false;
        $('play').textContent = 'Play';
        seek(t);
    });

    /**
     * ── ⛓ `?tick=N` — THE INITIAL CURSOR ────────────────────────────────
     *
     * Through `clampTick`, which CLAMPS AND SAYS SO: a tape shorter than the
     * requested tick is a real fact (usually the run threw early), and
     * landing silently on the last frame would present a truncated run as a
     * complete one at the wrong cursor.
     */
    const landed = clampTick(params.tick, frames.length);
    seek(landed.tick);
    $('play').textContent = playing ? 'Pause' : 'Play';
    requestAnimationFrame(frame);

    if (finished) {
        // ⚠ NAMED, NOT SILENT: a hazard shape this renderer has no arm for
        // draws nothing, and "nothing drawn" and "no volume there" look
        // identical on a canvas.
        const unknown = renderer.unknownShapes;
        $('detail').textContent = `finished: ${finished.transitions.length} transition(s), `
            + `${finished.transports.length} pit transport(s), `
            + `${finished.grants.length} grant(s)`
            + (unknown.length
                ? `  ⚠ ${unknown.length} volume(s) NOT DRAWN — no renderer arm for their `
                + `shape: ${unknown.join(', ')}`
                : '')
            + (sequence ? `  ·  ${sequence.windows.length} window(s), one game state` : '');
    }
    /**
     * ⛓⛓⛓ R9 SLICE 2 — THE SEQUENCE'S OWN READOUT, and it is STRUCTURAL.
     *
     * `check-seedling-editor-sequence.mjs` reads this, exactly as the other
     * rows read `__editorSolve`/`__editorGenerate`/`__editorWasm`. It carries
     * `window k of N` per window with that window's own `finished` summary,
     * the admission findings each boundary was admitted by, and the
     * director's `boundaryFindings`/`streamBoundaryFindings` over the MODEL's
     * own per-tick samples — the same two functions the Windows driver's
     * trace is asserted with, called, not re-spelled.
     */
    if (sequence) window.__editorSequence = sequence;

    /**
     * ⚠ THE OVERLAYS' OWN ABSENCES, REPORTED. Three of them, and every one
     * reads as "quiet run" on a canvas if nobody says otherwise:
     * a `?layers=` name nobody knows, a ledger row with nowhere to stand,
     * and a marker source with no glyph.
     */
    const notes = [];
    if (layerParam.unknown.length) {
        notes.push(`⚠ ?layers= names ${layerParam.unknown.length} unknown layer(s): `
            + `${layerParam.unknown.join(', ')} — the roster is ${LAYER_IDS.join(', ')}`);
    }
    if (unplaced.length) {
        // ⚠ "NOT PLACED", not "NOT DRAWN", and the two words are two facts.
        // A volume is NOT DRAWN because this renderer has no arm for its
        // SHAPE; a ledger row is NOT PLACED because there is no tick to
        // stand it on. `probe-seedling-watch-page` asserts on the first
        // phrase, and one word for both would have made an unplaceable
        // clear read as a renderer that had lost a hazard shape.
        // Grouped BY REASON: a full walk has seven tickless clears and all
        // seven carry the same paragraph. The rows are still named
        // individually — the reason is what repeats, not the finding.
        const byWhy = new Map();
        for (const u of unplaced) {
            if (!byWhy.has(u.why)) byWhy.set(u.why, []);
            byWhy.get(u.why).push(u.what);
        }
        notes.push(`⚠ ${unplaced.length} ledger row(s) NOT PLACED: `
            + [...byWhy].map(([why, what]) => `${what.join(', ')} — ${why}`).join('  ·  '));
    }
    if (renderer.unknownGlyphs.length) {
        notes.push(`⚠ ${renderer.unknownGlyphs.length} marker(s) with no glyph: `
            + renderer.unknownGlyphs.join(', '));
    }
    /**
     * ⚠ SLICE 6 — THE HAMMER LAYER'S NAMED ABSENCE. A spinner room whose boot
     * declares no `save.time` draws no line, and an empty canvas is what "the
     * hammer is not swinging" looks like too. Only 28 of the 153 committed
     * tapes ever have a live clock (this slice's roster sweep), so the absence
     * is the COMMON case and saying so is not a corner-case courtesy.
     */
    if (renderer.drawn.hammer.why) notes.push(`⚠ no hammer line: ${renderer.drawn.hammer.why}`);
    /**
     * ⛓ SLICE 9 — THE TWO NEW NAMED ABSENCES THAT ARE WORTH SAYING OUT LOUD
     * AT LOAD, and the third that is not.
     *
     * `worldstate` and `crushers` both draw nothing in most rooms in the game,
     * and a reader who has just switched a layer on deserves to be told
     * WHICH nothing before concluding the layer is broken. The DANGER layer is
     * deliberately NOT here: it is OFF by default (⚖ item 9), so a note about
     * it at load would be the page explaining a layer nobody asked to see —
     * and its own `why` is on the readout the moment it is switched on.
     */
    if (renderer.drawn.worldstate.why) {
        notes.push(`⚠ no world-state change drawn: ${renderer.drawn.worldstate.why}`);
    }
    if (renderer.drawn.crushers.why) notes.push(`⚠ no crusher drawn: ${renderer.drawn.crushers.why}`);
    // ⚠ A `?tick=` this page could not honour EXACTLY says so — both the
    // unreadable form (`readViewParams`) and the out-of-range one.
    if (params.tickWhy) notes.push(`⚠ ${params.tickWhy}`);
    if (landed.why) notes.push(`⚠ ${landed.why}`);
    if (notes.length) {
        $('detail').textContent += `${$('detail').textContent ? '\n' : ''}${notes.join('\n')}`;
    }

    // ── SAVE / LOAD (kickoff §3.4) ───────────────────────────────────
    mountTapeIO(tape, label);

    /**
     * The overlays' readout, for `check-seedling-editor-overlays.mjs` — the
     * same contract `window.__editorSolve` is for slice 1's row. It carries
     * the DERIVED facts (every marker, every unplaced row, the per-channel
     * body counts), not a picture: the acceptance rows are ledger facts and
     * a screenshot is evidence, never the gate.
     */
    window.__editorOverlays = {
        label,
        frames: frames.length,
        layers: OVERLAY_LAYERS.map((l) => ({ id: l.id, on: on.has(l.id) })),
        unknownLayerParams: layerParam.unknown,
        /**
         * ⛓⛓⛓ GROUP B — THE SWING, AS A READOUT, so a check can assert the
         * distinction the ink is making rather than only look at it.
         *
         * `hold` is the DISPLAY CHOICE in force; `window` is the ENGINE's own
         * answer, and the two are named apart here for the same reason they are
         * drawn apart. ⚠ `spearHitTicksUnmodelled` is carried BY NAME because
         * it is a bound on the model that the picture cannot show: a spear
         * draws one rect where the game tests three times, and an absence with
         * no written cause reads as a room where nothing happened.
         */
        attackSwing: {
            hold: attackHoldNow(),
            holdDefault: ATTACK_HOLD_DEFAULT,
            swordHitTicks: SLASH_HIT_TICKS,
            note: SWING_WINDOW_NOTE,
        },
        /**
         * ⛓⛓⛓ GROUP B — THE CEREMONY AT THE SCRUB TICK. A GETTER, not a value
         * captured when the readout was built: the box is re-rendered on every
         * `hud()` and a snapshot taken at mount would report tick 0's ceremony
         * (i.e. none) for the whole session, which is the leak-witness shape —
         * evidence that lands one tick late reads as evidence of nothing.
         */
        get dialogue() {
            return {
                ceremony: dialogue.ceremony,
                visible: dialogue.visible,
                why: dialogue.why,
                shown: !$('dialogue').hidden,
                text: $('dialogue').textContent,
            };
        },
        markers,
        unplaced,
        unknownGlyphs: renderer.unknownGlyphs,
        channels: {
            enemies: channelSummary(samples, 'enemies'),
            pushables: channelSummary(samples, 'pushables'),
            arrows: channelSummary(samples, 'arrows'),
            // ⛓ SLICE 6: the shape layers' own emptiness readout. `bodies` is
            // the collider channel, and it is a DIFFERENT count from `enemies`
            // whenever a class reports a position but no census hitbox — which
            // is a fact worth being able to see.
            bodies: channelSummary(samples, 'bodies'),
            // ⛓ SLICE 8: the armed lanes over the whole walk. A trap that is
            // armed for three ticks and a trap that is never armed both draw
            // nothing at most cursor positions, and only this count tells
            // them apart across the tape.
            lanes: channelSummary(samples, 'lanes'),
            /**
             * ⛓ SLICE 9: every object the run changed anywhere on the walk.
             * A rock broken at tick 50 is invisible at every cursor before it
             * and unremarkable at every cursor after; only this count says the
             * walk changed anything at all. ⚠ `bodies` counts DISTINCT ids, so
             * an object changed for 300 ticks contributes ONE — which is the
             * number a reader wants here.
             */
            changes: channelSummary(samples, 'changes'),
        },
        /**
         * ⛓⛓⛓ SLICE 9 — THE POPULATION BEHIND AN EMPTY `worldstate` LAYER, at
         * the scrub tick. `drawn.worldstate.why` says WHICH nothing is on
         * screen; this is the count that claim rests on (trap 196: never read
         * an absence without its population count), and it is the census's
         * shape one layer over.
         */
        get changeCounts() {
            const s = samples[Math.min(Math.max(cursor, 0), samples.length - 1)];
            return s?.changeCounts ?? null;
        },
        /**
         * ⚖ ITEM 9 — WHETHER THERE IS A SOLVER TO SHOW AT ALL, as a fact
         * rather than as an inference from an empty layer. `null` here and
         * `[]` are the two different answers the layer's own first branch is
         * about; a row that could only see the drawn result could not tell
         * "REPLAY, so no bot" from "a bot that asked nothing".
         */
        dangerQueries: dangerQueries === null ? null : dangerQueries.length,
        /**
         * ⛓ SLICE 8 — THE CENSUS BEHIND AN EMPTY `hitboxes` LAYER, at the
         * scrub tick. `drawn.hitboxes.why` says WHICH nothing is on screen;
         * this is the population count that claim rests on, so a reader never
         * has to take the sentence's word for it (trap 196: never read an
         * absence without its population count).
         */
        get census() {
            const s = samples[Math.min(Math.max(cursor, 0), samples.length - 1)];
            return s?.census ?? null;
        },
        /**
         * ⛓⛓⛓ SLICE 6 — WHAT THE RENDERER DREW ON THE CURRENT FRAME, read
         * back off the renderer itself rather than recomputed here. A check
         * that recomputed it would be checking a derivation nothing on screen
         * used, which is `collectRun`'s own reason for living in
         * `watchOverlays` and slice 5's lesson stated one layer up.
         *
         * ⛔⛔ A GETTER, AND THE FIRST CUT WAS NOT — this slice's own defect,
         * found by its browser row. `drawn: renderer.drawn` EVALUATES the
         * renderer's getter once, at readout-assembly time, and freezes that
         * frame for ever. Every `?tick=N` row still passed, because `seek()`
         * runs before this object is built; the row that SCRUBBED got tick
         * zero's boxes and read them as tick 120's, so a layer that tracks
         * perfectly reported a body that never moved. A snapshot wearing a
         * live readout's name is the same shape as slice 5's two findings —
         * state that looks like it is being read and is not.
         */
        get drawn() { return renderer.drawn; },
        /** The whole press ledger, so a row can ask "and at a NON-press tick?" */
        presses: presses.map((p) => ({ t: p.t, fired: p.fired, level: p.level, rect: p.rect })),
        trace: pane.readout,
    };

    /**
     * ── ⛓⛓⛓ `?shot=1` — THE CLI'S CONTRACT (kickoff §3.4/§3.5) ─────────
     *
     * The readiness signal slice 4's exporter waits on. Three parts, and
     * each one is load-bearing for a headless screenshot:
     *
     *  1. NOTHING IS ANIMATING. `playing` is already false above, so the
     *     canvas holds the requested tick indefinitely. A shutter opened on
     *     a playing page photographs whenever it happened to open.
     *  2. THE FRAME IS DRAWN BEFORE THE FLAG IS SET. `seek()` ran the full
     *     draw path (`hud()` → `renderer.draw`) synchronously above, so a
     *     waiter that sees the flag is looking at a painted canvas — not at
     *     one scheduled to paint on the next rAF.
     *  3. IT IS BOTH A DOM ATTRIBUTE AND A JS OBJECT. Playwright's
     *     `waitForSelector('body[data-shot-ready="1"]')` needs no page
     *     evaluation and no injected script; `window.__editorShot` carries
     *     the facts a caller should assert AFTER the wait — which tick was
     *     actually drawn, how many frames existed, and any reason the
     *     request could not be honoured exactly.
     *
     * ⚠ IT IS SET WHETHER OR NOT `?shot=1` WAS ASKED FOR — the flag on the
     * body is not. A readout that only existed under the parameter would
     * make the parameter untestable from the other side.
     */
    window.__editorShot = {
        ready: true,
        requested: params.shot,
        tick: cursor,
        frames: frames.length,
        label,
        why: [params.tickWhy, landed.why].filter(Boolean).join('  ·  ') || null,
    };
    if (params.shot) document.body.dataset.shotReady = '1';
    return { frames, finished };
}

/**
 * ── SAVE / LOAD — the tape in your hands (kickoff §3.4, ⚖ §1.3) ─────────
 *
 * Save is the CURRENT tape — replayed, solved or manually recorded, all
 * three arrive here as an object — serialised into the textarea, with a
 * Download button writing the same bytes. Load is the reverse: paste into
 * the box, or Upload a file, and the page navigates to it.
 *
 * ⛔ THROUGH `parseTape`, VIA `parseTapeText`. A malformed tape refuses with
 * the PARSER'S own message — the same one the runner and the differential
 * would give it — rather than a second, laxer opinion held by a page.
 *
 * ⛔⛔ AND THE PAGE NEVER WRITES `fixtures/`. The roster is disk-derived
 * (`fixtures/index.js`), so a saved experiment would silently enter the
 * differential's roster. A download goes to the browser's download
 * directory; promotion to a fixture stays a deliberate act outside this arc.
 *
 * ⚠ A LOADED TAPE IS HELD IN MEMORY AND REPLAYED IN PLACE — it is NOT put in
 * the URL. A tape is kilobytes; `?tape=` names a path the server can serve
 * and a pasted experiment has no path. So the picker's navigate-to-load
 * remains the route for committed tapes and this is the route for the ones
 * that exist only here.
 */
function mountTapeIO(tape, label) {
    const box = $('tapeText');
    if (!box) return;
    box.value = serializeTapeText(tape);
    $('tapeName').textContent = label;
    $('tapeNote').textContent = '';

    $('tapeDownload').onclick = () => {
        const name = (tape?.name || 'tape').replace(/[^A-Za-z0-9._-]+/g, '-');
        const url = URL.createObjectURL(
            new Blob([box.value], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const loadText = async (text, from) => {
        const got = parseTapeText(text);
        if (got.error) {
            $('tapeNote').textContent = `⚠ ${from} REFUSED (${got.error}) — ${got.why}`;
            return;
        }
        // ⛓ The SAME replay path everything else uses. A pasted tape that
        // was drawn by some second, simpler renderer would be a picture of a
        // run nobody had replayed.
        //
        // ⚠ THE NOTE IS WRITTEN *AFTER* THE REPLAY, and the ordering is a
        // bug this row caught: the replay re-mounts this whole panel (it is
        // showing a different tape now, so it must), which clears the note —
        // so a note written first was wiped by the very load it announced.
        // The page said nothing about a load that had plainly happened.
        await replayLoadedTape(got.tape, `${from}: ${got.parsed.name}`);
        $('tapeNote').textContent = `loaded from ${from}: ${got.parsed.name} — `
            + `${got.parsed.tick_count} ticks, v${got.parsed.tape_version}`;
        window.__editorLoaded = { from, name: got.parsed.name, ticks: got.parsed.tick_count };
    };

    $('tapeLoad').onclick = () => loadText(box.value, 'paste');
    $('tapeUpload').onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        box.value = text;
        loadText(text, `upload ${file.name}`);
    };
}

/**
 * ── THE TRACE PANE (kickoff §3.3) ────────────────────────────────────────
 *
 * `source` is `{trace}` for a trace this page already holds (an in-page
 * SOLVE's `out.trace`) or `{why}` for one it could not get — and BOTH are
 * rendered. A tape with no sidecar says so BY NAME, with the path it looked
 * for: "no trace" and "a trace this page failed to fetch" are different
 * facts and an empty pane would state neither.
 *
 * Rows at or before the cursor are highlighted (a trace is SPARSE, so the
 * last such row is the decision in force right now); clicking one seeks to
 * its tick.
 */
function mountTracePane(source, seekTo) {
    const box = $('trace');
    const rows = source?.trace?.rows ?? [];
    if (!rows.length) {
        const why = source?.why
            ?? (source?.trace ? 'the trace has no rows' : 'no trace was offered');
        box.innerHTML = '';
        const el = document.createElement('div');
        el.className = 'traceNone';
        el.textContent = `no trace for this tape — ${why}`;
        box.appendChild(el);
        return { highlight() {}, readout: { rows: 0, why } };
    }

    box.innerHTML = '';
    const els = rows.map((row) => {
        const f = traceRowFields(row);
        const el = document.createElement('div');
        el.className = 'tr';
        el.title = f.line;      // the CLI's own line — one summary, two views
        el.innerHTML = `<b>t${f.tick}</b> <span class="g">${f.goal}</span>`
            + ` <span class="o">${f.obstacle}</span> → <span class="s">${f.strategy}</span>`
            + (f.rejected.length
                ? `<div class="rj">rejected: ${f.rejected.join('; ')}</div>`
                : '<div class="rj none">rejected: (nothing else considered)</div>');
        el.onclick = () => seekTo(row.tick);
        box.appendChild(el);
        return { el, tick: row.tick };
    });

    let lastActive = -2;
    return {
        highlight(cursor) {
            const active = activeTraceIndex(rows, cursor);
            if (active === lastActive) return;
            lastActive = active;
            els.forEach((r, i) => {
                r.el.classList.toggle('past', i <= active);
                r.el.classList.toggle('now', i === active);
            });
            /**
             * ⛔ THE PANE SCROLLS, NOT THE PAGE (group A, item 8).
             *
             * `scrollIntoView` scrolls EVERY scrollable ancestor, and the
             * document is one of them — so following a solve's trace dragged
             * the whole page up and down under the reader once per highlighted
             * row, which is the "why does it keep jumping" complaint. Moving
             * the pane's own `scrollTop` by the overshoot keeps the active row
             * visible and leaves the document exactly where it was put.
             */
            if (active >= 0) {
                const r = els[active].el.getBoundingClientRect();
                const b = box.getBoundingClientRect();
                if (r.top < b.top) box.scrollTop -= (b.top - r.top);
                else if (r.bottom > b.bottom) box.scrollTop += (r.bottom - b.bottom);
            }
        },
        readout: { rows: rows.length, why: null, firstTick: rows[0].tick },
    };
}

// ── SOURCE = SOLVE ───────────────────────────────────────────────────────

/**
 * ⛓⛓⛓ THE DEFAULT STAGING BLOCK IS **THE TRUE GAME START** (slice 5,
 * kickoff §12.3) — and it is FETCHED, never typed.
 *
 * ── what it replaced, and why that was worse than it looked ───────────
 *
 * It used to be a frozen literal: `{level: 0, x: 16, y: 16}`, everything
 * else empty, described here as "deliberately the EMPTIEST honest one". It
 * was honest — nothing was pre-cleared — and it was still a boot state THE
 * GAME NEVER HAS. `(16,16)` is the atlas's convention for "just inside the
 * top-left door" and L0's real spawn is `(80,128)`; `pins` was `[]` where
 * every honest walk in the tree pins `dead_frames`; `rng` was `null` where
 * the game boots with a live `fp` seed. Arriving at the page with nothing
 * typed put you in a room the player cannot be standing in, and the first
 * thing anybody does with an editor is press the button before typing.
 *
 * ⛔ SO IT IS THE HONEST CHAIN'S OWN SEGMENT-1 BOOT, THROUGH THE SAME SEAM
 * A PASTED BLOCK TAKES. `act2-the-sword` is R7's honest playthrough and its
 * first segment starts where a new game does; its committed tape is the
 * artifact the game and the differential already agreed on. The page fetches
 * that tape and runs it through `stagingFromJson` — the `?boot=` path,
 * unchanged — so the default validates through `parseTape` exactly as any
 * pasted block does. ⚠ A literal transcription of the same numbers would be
 * the same eleven fields typed a second time, and the copy would be right
 * until the chain moved (trap 86: one definition, owned, never retyped).
 *
 * ⚠ AND A FETCH CAN FAIL. `?boot=`'s failure is already REPORTED rather than
 * swallowed and this one is too — there is no literal to silently fall back
 * to, which is the point: a page that quietly reverted to a made-up boot
 * would present the fallback as the game's start.
 */
const trueStartStaging = async () =>
    stagingFromJson(await fetchJson(repoUrl(`${DEFAULT_TAPE_DIR}/${TRUE_START_SEGMENT}.json`),
        `the true game start (${TRUE_START_SEGMENT})`));

/**
 * "Boot like `r8-solve-18`" — the staging-is-declared law in UI clothes.
 *
 * The preset is not a hand-typed approximation of a room's starting state,
 * it is the exact block the game and the differential already agreed on.
 *
 * ⛓ ONE DROPDOWN, TWO ARMS (slice 3). SOLVE and MANUAL both need "start me
 * where that tape started", and a second harvest for the manual panel would
 * be a second answer to which tapes can be booted from.
 *
 * Fired but NOT awaited: with `?boot=` given, an arm should not wait on a
 * roster fetch it is not going to use.
 *
 * `source` rides in the navigation so choosing a preset from the MANUAL
 * panel lands back in MANUAL rather than silently switching arms.
 */
/**
 * ⛓⛓ A COMMITTED BOOT PER LEVEL, harvested from the same roster the preset
 * dropdown lists (group A, item 10).
 *
 * The level stepper needs somewhere to PUT the player. `boot.x/y` belong to
 * the level the block came from, so stepping to another one and keeping them
 * usually spawns you inside a wall — the `?level=` override note has said
 * exactly this since the editor arc. A tape that starts in the target level
 * already knows a position the game itself used.
 *
 * ⚠ FIRST WINS, and the roster order is the directory listing's, so this is
 * "a committed boot" and never "the canonical one" — the map is only ever
 * consulted for a starting position, never for a claim.
 * ⚠ EMPTY UNTIL THE ROSTER LOADS, which is a real state the stepper reports
 * rather than waits on: 150 tapes should not block the first press.
 */
const committedBootByLevel = new Map();

/**
 * ⛓ THE ROSTER LOAD, AS A PROMISE THE STEPPER CAN AWAIT — resolved once per
 * document, because `loadAtlas`'s reason applies here too.
 *
 * ⚠ MEASURED BY THE BROWSER ROW: it pressed ▶ within milliseconds of mount,
 * the map was still empty, and the level stepped with the PREVIOUS level's
 * boot position and a note saying so. Honest, and the worse of the two
 * outcomes for anybody who clicks fast. Awaiting the fetch that is already in
 * flight costs a human nothing (they click seconds later) and gets the row —
 * and a fast hand — the committed boot instead of the caveat.
 */
let bootRosterReady = null;

function mountBootPresets(sel, source, noteEl = null) {
    bootRosterReady = loadTapeIndex(DEFAULT_TAPE_DIR).then((index) => {
        if (index.error) {
            sel.innerHTML = `<option value="">— no preset list: ${index.error} —</option>`;
            return;
        }
        const { presets, refused } = harvestPresets(index.records);
        for (const p of presets) {
            const lvl = p.staging.boot.level;
            if (!committedBootByLevel.has(lvl)) {
                committedBootByLevel.set(lvl, { name: p.name, boot: p.staging.boot });
            }
        }
        sel.innerHTML = '<option value="">— boot like… —</option>';
        for (const p of presets) {
            const el = document.createElement('option');
            el.value = p.name;
            el.textContent = `${p.name} — L${p.staging.boot.level}`;
            sel.appendChild(el);
        }
        // ⚠ A tape that would not parse is NAMED. A preset list that
        // silently shrank would read as a smaller roster.
        if (refused.length && noteEl) {
            noteEl.textContent += `${noteEl.textContent ? '  ·  ' : ''}`
                + `⚠ ${refused.length} tape(s) refused as presets: `
                + refused.map((r) => `${r.name} (${r.why})`).join('; ');
        }
        sel.onchange = () => {
            const chosen = presets.find((p) => p.name === sel.value);
            if (!chosen) return;
            // A full navigation, like the tape picker's — one code path for
            // "load something else", and the URL stays the whole state.
            const q = new URLSearchParams(window.location.search);
            q.set('source', source);
            q.set('boot', `${DEFAULT_TAPE_DIR}/${chosen.name}.json`);
            q.set('level', String(chosen.staging.boot.level));
            q.delete('goals');
            q.delete('solve');
            window.location.search = q.toString();
        };
    });
}

/**
 * ⛓⛓⛓ THE BOOT FORM (slice 5, kickoff §12.4) — checkboxes over the SAME
 * PARSED BLOCK the textarea holds, in BOTH directions.
 *
 * ⛔ ONE SOURCE OF TRUTH, AND IT IS THE TEXTAREA'S PARSE. Ticking a box
 * parses the box's text, edits the resulting BLOCK (`withItemFlag`) and
 * re-serialises the whole thing back; typing in the textarea re-derives the
 * boxes from whatever it now parses. Nothing is cached between the two, so
 * there is no state that can disagree with what is on screen — a form
 * holding its own copy of the flags is the two-cost-models trap with
 * checkboxes, and the copy would win silently whenever the user typed.
 *
 * ⛔⛔ A TEXTAREA THAT WILL NOT PARSE **DISABLES** THE BOXES, with the
 * parser's own message. The alternative is guessing: a form that kept the
 * last good flags would let you tick a box against a block that does not
 * exist and then write it into text you never meant to keep. Refusing to
 * offer the control is the honest answer, and the reason is on screen.
 *
 * ⚠ THE THIRD STATE IS RENDERED AS `indeterminate`. `itemFlagsOf` returns
 * `null` for a flag the block declares NOTHING about (the seam keeps only
 * declared keys), and a dash-filled box says that where an unticked one
 * would say "declared false". Clicking one writes a real `false`, which is
 * a declaration — as it should be, because that is what the user just did.
 *
 * @param {object} lifetime the mounting arm's lifetime — the box listener
 *   below dies with it (see `watchLifetime`).
 * @param {Function} onChange fired after a box writes, so the arm can
 *   re-derive anything downstream (the SOLVE arm re-reads its census).
 */
function mountBootForm(formEl, boxEl, noteEl, lifetime, onChange = () => {}) {
    /**
     * ⛔ MOUNTED TWICE IS NOW NORMAL, so the previous mount's controls are
     * REMOVED rather than appended beside. Every other `mount*` in this file
     * already clears its box (`layerBox.innerHTML = ''` and friends); this one
     * appended into a `<div>` that also holds a static label from `watch.html`,
     * so it could not simply be emptied — and an in-place switch back to an
     * arm would have given it a second row of sword checkboxes, each writing
     * the same field, the older one holding a `boxEl` nobody reads any more.
     */
    formEl.querySelector('[data-boot-form]')?.remove();
    const fields = document.createElement('span');
    fields.dataset.bootForm = '1';
    formEl.appendChild(fields);

    const boxes = ITEM_FORM_FIELDS.map((f) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `${formEl.id}-${f.id}`;
        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${f.label}`));
        // The GAME's own property path, so the control says which field it
        // writes rather than only what it is called.
        label.title = `${f.field}  (writes seam.${f.key})`;
        fields.appendChild(label);
        return { f, input };
    });
    const why = document.createElement('span');
    fields.appendChild(why);

    const sync = () => {
        let staging = null;
        let refusal = null;
        try {
            staging = stagingFromJson(JSON.parse(boxEl.value));
        } catch (e) {
            refusal = e.message;
        }
        const flags = staging ? itemFlagsOf(staging) : null;
        for (const { f, input } of boxes) {
            input.disabled = !staging;
            input.indeterminate = Boolean(staging) && flags[f.id] === null;
            input.checked = flags?.[f.id] === true;
        }
        why.textContent = refusal
            ? `  ⚠ the block below will not parse, so these are disabled — ${refusal}`
            : '';
        return staging;
    };

    for (const { f, input } of boxes) {
        input.onchange = () => {
            let parsed;
            try {
                parsed = stagingFromJson(JSON.parse(boxEl.value));
            } catch {
                // Unreachable while the box is enabled — but re-syncing is
                // the honest answer if it ever is, rather than writing into
                // text the parser has already refused.
                sync();
                return;
            }
            boxEl.value = JSON.stringify(withItemFlag(parsed, f.id, input.checked), null, 4);
            sync();
            onChange();
        };
    }
    /**
     * A block edited by hand re-derives the boxes — the other direction.
     *
     * ⛔ THROUGH THE ARM'S LIFETIME, and this one ACCUMULATES rather than
     * leaking quietly: `input` listeners stack, so an arm mounted twice in
     * one document would re-derive the checkboxes twice per keystroke, three
     * times on the third mount. Nothing visibly breaks — it just does the
     * work N times — which is why it would have survived a switch nobody
     * profiled.
     */
    lifetime.on(boxEl, 'input', () => sync());
    sync();
    if (noteEl && !noteEl.textContent) noteEl.textContent = '';
    return { sync };
}

/**
 * ── ⛓⛓ WHERE TO PUT THE PLAYER IN A LEVEL NOBODY HAS A TAPE FOR ──────
 *
 * ⚠ MEASURED FIRST: 42 of the atlas's 116 levels have a committed boot in the
 * tape roster. So two thirds of the level stepper's destinations have no
 * position the game itself ever used, and carrying the previous level's `x/y`
 * into them drops the player inside a wall about as often as not — which
 * makes MANUAL unusable for exactly the rooms you most want to look at.
 *
 * ⛔ SO THE PAGE CHOOSES ONE, AND SAYS THAT IT CHOSE. The nearest WALKABLE,
 * NON-PIT tile to where the player already was, rejecting any cell where the
 * engine's own `playerBoxAt` would overlap a solid. That is a tooling
 * convenience and NOT a fact about the game: no claim may rest on it, and the
 * note in the panel calls it a choice rather than a boot.
 *
 * ⚠ `walkableTiles` and the solid rosters are the ENGINE's own, through
 * `censusWorld` — the same world build the arms press into. A spawn picked
 * from a second idea of "walkable" would put the player somewhere this page
 * thinks is fine and the physics does not.
 */
function chooseSpawn(levelSource, block, level) {
    const world = censusWorld(levelSource, { ...block, boot: { ...block.boot, level } });
    const blockers = [...(world.solids ?? []), ...(world.objectSolids ?? [])].map((s) => s.rect);
    const pits = new Set((world.pitTiles ?? []).map((t) => `${t.rect.x},${t.rect.y}`));
    const hits = (r) => blockers.some((s) =>
        r.x < s.right && r.right > s.x && r.y < s.bottom && r.bottom > s.y);
    let best = null;
    let bestD = Infinity;
    for (const t of world.walkableTiles ?? []) {
        if (pits.has(`${t.rect.x},${t.rect.y}`)) continue;
        const x = t.rect.x + TILE_SIZE / 2;
        const y = t.rect.y + TILE_SIZE / 2;
        if (hits(playerBoxAt(x, y))) continue;
        // ⚠ THE DISTANCE IS MEASURED IN THE SAME SPACE THE ANSWER IS GIVEN IN.
        // `block.boot` is ctor args and `(x, y)` is a tile centre, so the old
        // comparison carried a half-tile bias in both axes — harmless at this
        // resolution, and exactly the kind of mixed-space arithmetic that
        // produced the bug below. Both sides are corners now.
        const cx = x - BOOT_TO_PLAYER_OFFSET;
        const cy = y - BOOT_TO_PLAYER_OFFSET;
        const d = ((cx - block.boot.x) ** 2) + ((cy - block.boot.y) ** 2);
        /**
         * ⛔⛔⛔ THE TILE'S CORNER, NOT ITS CENTRE — AND THIS WAS A REAL
         * DEFECT, MEASURED.
         *
         * A staging block's `boot.x`/`boot.y` are the `Game` CONSTRUCTOR'S
         * ARGS (`playerx`/`playery`), and the Player ctor re-centres onto the
         * tile (`Player.as:357`) — so the player is observed at `boot + 8`.
         * This loop validates a tile CENTRE (`playerBoxAt(cx, cy)` clears the
         * solids) and used to write that centre straight into `boot`, which
         * the engine then offset again: the player landed half a tile DOWN AND
         * RIGHT of the cell that had been checked.
         *
         * ⛓ MEASURED over a twelve-level sample while the entrances item was
         * being built: **five of the twelve spawned INSIDE A SOLID** — L58,
         * L84, L70, L90 and L110 — which is the precise failure this function
         * exists to prevent. The cell is right; the field it was written into
         * was wrong.
         *
         * ⇒ the corner, which is `centre - BOOT_TO_PLAYER_OFFSET` and is also
         * exactly the form a teleporter's own `playerx`/`playery` take. *A
         * validated coordinate written into a field somebody else offsets has
         * not been validated.*
         */
        if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
    }
    return best;
}

/**
 * ── ⛓⛓⛓ DRAW THE LEVEL NOW, BEFORE ANYTHING RUNS (group A, item 9) ────
 *
 * SOLVE drew nothing until you pressed SOLVE (or passed `?solve=1`) and
 * MANUAL drew nothing until you pressed START, so both arms opened on a black
 * canvas: the page had the level in its hands and was showing you nothing.
 * This builds the run the arm is ABOUT to use and draws its first frame.
 *
 * ⛔ IT IS NOT A SECOND CONSTRUCTION. `createRunForStaging(solveStaging(…))`
 * is the same pair `solveForPage` and `createManualSession` use, so the room
 * you are looking at before you press anything is the room the press will run
 * in — a preview built some other way could differ from it in exactly the
 * ways that matter (a `solveStaging` relaxation, a scratch clear).
 *
 * ⛔ AND IT IS NOT A LOOP. One `draw`, no rAF, nothing scheduled — the page's
 * third law is about tick loops, and a still frame has no tick to advance.
 * Anything that starts afterwards (a solve's scrub, a manual drive) builds its
 * own renderer and supersedes this frame in the ordinary way.
 *
 * ⚠ A REFUSAL IS REPORTED AND NOT FATAL TO THE MOUNT. A block that will not
 * build is worth saying — with the builder's own message — but the arm must
 * still finish mounting, or a bad `?level=` would leave you with no panel to
 * fix it in.
 */
function previewLevel(levelSource, staging, layers, lifetime, afterDraw = null) {
    try {
        const run = createRunForStaging(solveStaging(staging), levelSource,
            { scratchPersistence: isHeldLevel(staging.boot.level) });
        const world = makeWorldFor(levelSource, staging)(run.level);
        const renderer = makeRenderer($('canvas'));
        renderer.reset();
        renderer.fit(world);
        renderer.draw(world, run.state, {
            on: layers.on,
            /**
             * ── ⛓⛓⛓ ⚖ WATCH-PAGE ITEM (v) — THE STILL FRAME HAS A RUN ─────
             *
             * ⚖ The user, 2026-08-22: *"the page does not draw the ENEMIES on
             * the first draw when a level is selected in solve mode"*.
             *
             * ⛔ THE OLD COMMENT HERE WAS HALF TRUE AND THE FALSE HALF WAS THE
             * DEFECT. It said *"the still frame has no history and no run
             * behind it"* — and there is no HISTORY, but there IS a run: it is
             * `createRunForStaging`'s, built four lines up, and its
             * `run.chasers` and `run.spinnerBodies` hold live bodies at this
             * very instant. Handing `[]` was not describing an absence, it was
             * discarding something the function already had, and the visible
             * consequence was a room whose two bobs appeared only after
             * somebody pressed a key.
             *
             * ⛓ ONE SAMPLE, AT CURSOR 0, from `sampleMovers` — the SAME seam
             * the replay and the manual drive read, so the still frame's bodies
             * are the same derivation and not a fifth sampler. It is a WALK of
             * length one, which is exactly what a still frame is.
             *
             * ⚠ `markers` and `presses` STAY EMPTY, and that is not an
             * oversight: a marker is something that HAPPENED and a press is
             * something somebody DID, and neither has yet. Only the bodies
             * exist before the first tick.
             */
            samples: [sampleMovers(run)],
            markers: [],
            presses: [],
            // ⛓ GROUP B: passed even though `presses` is empty, so the still
            // frame's emptiness is the CHANNEL's and not a missing option —
            // an omitted key here would fall through to `attackHoldsAt`'s own
            // default and make this site behave differently from the other two
            // for a reason nothing on the page states.
            attackHold: attackHoldNow(),
            cursor: 0,
            live: { crushers: run.crushers, crusherScans: run.crusherScans },
            /**
             * ⛓⛓⛓ ⚖ ITEM (iv) BESIDE ITEM (v): the still frame's LIVE bodies
             * come from the one sample above, and its STATIC ones from here.
             * Two sources, because they are two kinds of body — and on L6 that
             * is two bobs from the sample and four sandtraps from this.
             */
            staticEnemies: staticEnemyBodies(run),
            // ⚖ Nothing has solved this room yet, and `null` is how the layer
            // is told to SAY so rather than drawing a calm room.
            dangerQueries: null,
        });
        // ⛓ SLICE 5a (D5) — the SIBLING overlays, on the same canvas.
        afterDraw?.($('canvas'));
        /**
         * ⛓⛓⛓ WHERE THE PLAYER ACTUALLY IS IN THE DRAWN ROOM, AND WHETHER
         * THEY FIT — ⚖ the entrances item's own witness.
         *
         * ⛔ IT IS THE RUN'S STATE, NOT THE BLOCK'S NUMBERS. `run.state` is
         * what `createRunForStaging` produced from the boot block, so it has
         * ALREADY had the Player ctor's half tile applied — which is the whole
         * quantity the item turned on. A readout that re-derived the position
         * from `boot.x + 8` would be a second spelling of the very offset it
         * exists to check, and would agree with a wrong boot block perfectly.
         *
         * ⛔⛔ AND `clear` IS ASKED OF THE DRAWN WORLD'S OWN SOLIDS with the
         * ENGINE's `playerBoxAt`. `chooseSpawn` used to validate a tile centre
         * and write it into a field the engine offsets, so the cell it checked
         * and the cell the player stood in were different cells — measured, 5
         * of a 12-level sample spawned inside a solid. This is the reading
         * that fails when that is true, and it is taken from the picture the
         * page is showing rather than from the function under suspicion.
         */
        const box = playerBoxAt(run.state.x, run.state.y);
        const blockers = [...(world.solids ?? []), ...(world.objectSolids ?? [])];
        const inside = blockers.find((s) => box.x < s.rect.right && box.right > s.rect.x
            && box.y < s.rect.bottom && box.bottom > s.rect.y);
        window.__editorSpawn = {
            level: run.level,
            boot: { x: staging.boot.x, y: staging.boot.y },
            player: { x: run.state.x, y: run.state.y },
            offset: BOOT_TO_PLAYER_OFFSET,
            clear: !inside,
            // ⚠ THE BLOCKER IS NAMED. "The player is inside something" and
            // "the player is inside `tile:Stone` at 96,64" are the same
            // verdict and very different findings.
            inside: inside ? { tag: inside.tag ?? null, rect: inside.rect } : null,
            solids: blockers.length,
        };
        /**
         * ── ⛓⛓⛓ ⚖ ITEMS (iv) AND (v) — WHAT THE STILL FRAME REALLY DREW ───
         *
         * ⛔ ITS OWN READOUT, NOT A FIELD ON `__editorSpawn`. That readout
         * answers *"where is the player and does it fit"*; this one answers
         * *"which bodies are on the canvas before anything has been pressed"*.
         * Two questions under one name is the failure trap 550 records, and the
         * two rows that read these have nothing to do with each other.
         *
         * ⛔ READ OFF THE RENDERER, NEVER RECOMPUTED. `renderer.drawn` is what
         * the last `draw` PUT ON THE CANVAS; a readout derived here would be a
         * derivation nothing on screen used, and it would agree with a renderer
         * that drew nothing at all.
         */
        window.__editorStill = {
            level: run.level,
            drawn: renderer.drawn,
            // ⚠ The ONE sample the frame was handed, named so a row can tell
            // "no bodies in this room" from "no sample was passed".
            samples: 1,
        };
        return { drew: true, level: run.level, why: null };
    } catch (e) {
        // ⚠ A REFUSED PREVIEW HAS NO SPAWN TO REPORT, and `null` says so
        // rather than leaving the LAST level's answer standing — a stale
        // `clear: true` under a room that would not build is the readout
        // lying about the room on screen.
        window.__editorSpawn = null;
        // ⚠ AND THE DRAW MANIFEST WITH IT — a refused preview drew nothing, and
        // leaving the LAST room's bodies standing would be the readout lying
        // about the canvas, which is the same defect one field over.
        window.__editorStill = null;
        lifetime.report(`the level preview refused: ${e.message}`, () => {
            $('detail').textContent = `⚠ this block will not build, so nothing is drawn yet — `
                + `${e.message}`;
        });
        return { drew: false, level: staging?.boot?.level ?? null, why: e.message };
    }
}

/**
 * ⛓ THE ATLAS, ONCE PER DOCUMENT. Every arm needs it and every arm fetched
 * its own copy — which cost nothing when an arm mount meant a page load, and
 * costs a re-fetch per SOURCE switch now that it does not.
 *
 * ⚠ A REJECTION IS NOT CACHED. Memoising the promise itself would pin a
 * transient failure (a server restart mid-switch) for the life of the tab,
 * and the arm would report "the atlas is missing" forever with no way back
 * short of a reload — the one thing this arc removed.
 */
let atlasPromise = null;
function loadAtlas() {
    if (!atlasPromise) {
        atlasPromise = fetchJson(ATLAS_URL, 'atlas')
            .catch((e) => { atlasPromise = null; throw e; });
    }
    return atlasPromise;
}

/**
 * ── ⛓⛓⛓ THE LEVEL THE GENERATE ARM HANDED OVER (switch slice 4) ───────
 *
 * ⛔ IT IS A LEVEL, NOT A FILE AND NOT A SEED. The GENERATE arm holds the
 * record it just generated; the bridge hands that RECORD to SOLVE or MANUAL
 * directly, in memory. Regenerating from `?seed=` would be a second path to
 * a level and a second chance to disagree — the page's standing rule is that
 * every level it draws came out of the loop, IN THE PAGE, once.
 *
 * ⚠ IT SURVIVES A SWITCH AND NOT A RELOAD, which is the honest boundary: a
 * generated room is not in the atlas and not on disk, so a link to it could
 * only ever be a link to the GENERATION (`?source=generate&seed=…`), and that
 * is what the address bar keeps saying. The arms SAY they are holding one.
 */
let heldGeneratedLevel = null;

/**
 * A source that answers for the held generated level and defers to the atlas
 * for everything else.
 *
 * ⛔ BOTH HALVES ARE NEEDED, and the composite is not decoration: the
 * generated room is the only level the arm is looking at, but the TAPE I/O
 * box, a pasted tape and any teleporter whose `to` names a real room all ask
 * this same source for committed levels. A source that held only the
 * generated record would refuse them by name — see `runGenerate`'s own note,
 * which fetches the real atlas for exactly this reason.
 */
function levelSourceWithHeld(atlasSource, held) {
    if (!held) return atlasSource;
    return (level) => (level === held.record.level ? held.record : atlasSource(level));
}

/**
 * ⛔⛔ THE SCRATCH FORK IS ABOUT **THIS RUN'S LEVEL**, not about whether the
 * page happens to be holding a generated one.
 *
 * The first cut keyed it on `Boolean(heldGeneratedLevel)`, which is wrong in a
 * way that only shows on the paths nobody looks at twice: hand a generated
 * room to SOLVE, then paste a COMMITTED tape into the box below the canvas,
 * and that tape — which has a v9 `at` row declaring its own kill-lock clear —
 * would replay with the model as a second writer of the slot its tape already
 * owns. The flag is vacuous exactly where no tape exists and correct
 * everywhere else, so it asks about the LEVEL.
 */
const isHeldLevel = (level) =>
    Boolean(heldGeneratedLevel) && level === heldGeneratedLevel.record.level;

/**
 * ⛓ WHAT EVERY ARM DOES FIRST, and did in four copies: get the atlas, build
 * a level source over it, and point the page's "replay a tape I am holding"
 * hook at it. The copies were identical, which is how they stayed correct —
 * and is exactly why the fifth one would not have been.
 */
/**
 * ⛓ THE PAGE'S LEVEL SOURCE, IN ONE PLACE. `armPrelude` builds it for every arm
 * that draws; the `?side=wasm` arm now needs the same one to walk the JS MODEL
 * of the tape it is shipping, and a second composition there would be a second
 * opinion about which world a committed tape runs in.
 */
const pageLevelSource = (atlas) =>
    levelSourceWithHeld(levelSourceFromAtlas(atlas), heldGeneratedLevel);

async function armPrelude(params, lifetime) {
    const atlas = await loadAtlas();
    const levelSource = pageLevelSource(atlas);
    replayLoadedTape = (t, lbl) => replayTape(t, lbl, params, levelSource, null,
        undefined, { scratchPersistence: isHeldLevel(t?.boot?.level) })
        .catch((e) => lifetime.report(`a loaded tape would not replay: ${e.message}`,
            () => fatal('the loaded tape would not replay', e.stack || e.message)));
    return { atlas, levelSource };
}

/**
 * ── ⛓⛓⛓ THE BOOT PANEL, SHARED BY SOLVE AND MANUAL (switch slice 3) ───
 *
 * Both arms start from a staging block and both built the same panel around
 * it: level readout, preset picker, item form, textarea, note. Two copies of
 * a panel drift — MANUAL's level input was `disabled` and SOLVE's was not —
 * and, more to the point, ⛔ TWO BOXES CANNOT SHARE A BLOCK. The ask this arc
 * came from is that the level you are looking at follows you between modes,
 * and no amount of copying between two textareas is as honest as having one.
 *
 * ⚠ `#bootLevel` IS A READOUT AND NOW SAYS SO. It was written by both arms
 * and read by neither: in SOLVE you could type a level into it and nothing
 * whatsoever consumed the number (MANUAL marked the same field `disabled`,
 * which is the same fact with better manners). The level lives INSIDE the
 * block — ⛔ one source of truth, and it is the textarea's parse — so the
 * field is `readonly` rather than made into a second writer of it.
 */
async function mountBootPanel(params, lifetime, {
    verb, namePrefix, levelSource, layers, atlas, onBoxChange = () => {},
} = {}) {
    let { staging, origin, kept } = await stagingForMount($('bootBox'), params);
    if (!lifetime.alive()) return { staging: null, name: null };

    // ⚠ ?level= OVERRIDES the block's own level and SAYS SO. The boot x/y
    // belong to the block's level, so pointing it at another one usually
    // spawns the player somewhere meaningless — a fact worth a line in the
    // note rather than a mysterious refusal from the solver.
    const notes = [];
    if (params.level !== null && Number.isFinite(params.level)) {
        if (params.level !== staging.boot.level) {
            notes.push(`?level=${params.level} overrode the staging block's own level `
                + `${staging.boot.level} — the boot x/y (${staging.boot.x},${staging.boot.y}) `
                + `are still level ${staging.boot.level}'s`);
        }
        staging = { ...staging, boot: { ...staging.boot, level: params.level } };
    }
    /**
     * ⛔ PROVENANCE, IN THE ORDER THAT MATTERS. A handed-over generated level
     * is ALSO "a block the box was already holding", so the kept note is true
     * of it — and it is the wrong sentence, because it says the block is your
     * edits when it is the generator's output. The stronger fact wins and
     * says everything the weaker one would have.
     */
    if (isHeldLevel(staging.boot.level)) {
        const h = heldGeneratedLevel;
        notes.push(`⛓⛓ LEVEL ${h.record.level} WAS GENERATED IN THIS PAGE — seed ${h.seed}, `
            + `${h.biome}, step ${h.step} — and handed over by the GENERATE arm. It is not `
            + 'in the atlas and not on disk: THIS TAB holds it, a reload loses it, and the '
            + 'link above describes the GENERATION and not the room. The run uses the '
            + 'SCRATCH PERSISTENCE fork, because a generated room has no tape to declare a '
            + 'kill-lock clear (⚖ kickoff §1.13) — so a clear it banks leaves through '
            + '`run.scratchClears` and NOT through the folded tape, whose `persistence[].'
            + 'level` is bounded to the real game\'s 116 levels.');
    } else if (kept) {
        notes.push('⛓ the starting conditions below are THIS TAB\'S OWN, kept across a '
            + 'SOURCE switch — they are not what this URL names, so a copy of the link '
            + 'will not show them');
    }
    /**
     * ⚠ THE DEFAULT NAME STAYS PER-ARM. It is not decoration: it rides into
     * the tape a MANUAL session FOLDS, so unifying it here would quietly
     * rename every hand-driven tape from `manual-L0` to the solver's own
     * prefix — a shared panel must not relabel the artifacts its arms produce.
     */
    const name = params.name || `${namePrefix}-L${staging.boot.level}`;
    $('title').textContent = `${name} — ${verb} from ${origin}`;
    $('bootLevel').value = String(staging.boot.level);
    $('bootLevel').title = 'the level the block below boots into — a READOUT of '
        + '`boot.level`, which is where the level actually lives. Edit it in the block, '
        + 'or override it with ?level=.';
    $('bootBox').value = JSON.stringify(staging, null, 4);
    $('bootNote').textContent = notes.join('  ·  ');

    // ⛓ ONE ROSTER, ONE TABLE: the key legend is rendered FROM the binding
    // map, so a rebinding cannot leave the page describing the old keys.
    $('manualKeys').textContent = KEYBOARD_ROWS
        .map((r) => `${r.code.replace(/^(Key|Arrow)/, '')}→${r.key}`).join('  ');
    // ⚠ The preset navigation carries THIS arm's source, so choosing a preset
    // from MANUAL lands back in MANUAL. It still navigates — a preset is an
    // explicit "load something else", and the reload is what makes it beat
    // the kept block (`stagingForMount`).
    mountBootPresets($('bootPreset'), params.source, $('bootNote'));
    mountBootForm($('bootForm'), $('bootBox'), $('bootNote'), lifetime, onBoxChange);

    /**
     * ⛓ THE BLOCK IN THE BOX, RE-READ — never a closure copy. Editor slice 5's
     * whole finding was a form editing a block nobody read, and every control
     * added since answers to that: the box's parse is the one source of truth.
     */
    const blockNow = () => stagingFromJson(JSON.parse($('bootBox').value));

    // ⛓ THE LEVEL IS ON SCREEN BEFORE ANY BUTTON IS PRESSED (item 9). Both
    // arms that mount this panel get it, from the block the panel is showing.
    let preview = previewLevel(levelSource, staging, layers, lifetime);

    /**
     * ⚠ DEBOUNCED, AND GUARDED. Holding ▶ fires a change per click and each
     * one builds a world; the delay coalesces a run of them into one draw.
     * ⛔ Through `lifetime.guard`, because a pending timer that fires after
     * the arm is retired would paint this arm's level onto the next one's
     * canvas — the exact hazard the switch arc exists to close, re-introduced
     * by a convenience.
     */
    let pending = null;
    const redraw = lifetime.guard('boot-panel-redraw', () => {
        pending = null;
        try {
            preview = previewLevel(levelSource, blockNow(), layers, lifetime);
        } catch { /* the box will not parse; the form already says so */ }
        onBoxChange();
    });
    const scheduleRedraw = () => {
        if (pending !== null) clearTimeout(pending);
        pending = setTimeout(redraw, 120);
    };
    lifetime.onRetire(() => { if (pending !== null) clearTimeout(pending); });
    mountLayerControls(layers.on, redraw);

    /**
     * ⛓ THE ATLAS'S OWN LEVEL LIST — hoisted above the entrance index, which
     * scans it, and still the stepper's list. One enumeration of "the rooms
     * this atlas has"; two of them would drift the day the atlas grew a gap.
     */
    const atlasLevels = [...(atlas?.levels ?? []).map((l) => l.level)].sort((a, b) => a - b);

    /**
     * ── ⛓⛓⛓ WHERE THE PLAYER STARTS (⚖ the user's item) ────────────────
     *
     * ⛔ THE INDEX IS BUILT ONCE PER PANEL MOUNT, AND EAGERLY. An entrance to
     * L10 lives in L9 and L11, so answering "where do I start in L10" needs
     * every OTHER level scanned — a lazy per-level build would do the same
     * whole-atlas walk on the first press and again on every cache miss.
     * MEASURED at 93 ms for all 116 rooms with `roles: ['trigger']`, which is
     * what makes eager affordable and is why the cheap role set is not an
     * optimisation but the reason this control can exist at all.
     *
     * ⚠ REFUSALS ARE CARRIED, not swallowed: a room that will not build is one
     * whose exits are missing from this index, and `entrancesTo` folds that
     * into the sentence it gives for an empty answer.
     */
    const entranceIndex = collectEntrances(levelSource, atlasLevels);
    if (entranceIndex.refused.length > 0) {
        lifetime.report(`${entranceIndex.refused.length} level(s) would not build while `
            + 'indexing entrances', () => {});
    }

    /**
     * ⛔⛔ ONE WRITER FOR THE BOOT POSITION, AND IT IS THIS.
     *
     * Every control that can change where the player starts — the selector,
     * the two number fields, the level stepper — goes through here, so "what
     * is in the block" and "what the selector says" cannot drift apart. The
     * page has paid for the other shape once already (editor slice 5: a form
     * editing a block nobody read).
     *
     * @param {{x:number,y:number}} at the `Game` CONSTRUCTOR'S ARGS — not the
     *   player's position. See `watchEntrances`' docblock for the half tile.
     * @param {string} source the `#bootStart` value this came from
     */
    const writeStart = (at, source, extraNote = null) => {
        let block;
        try {
            block = blockNow();
        } catch (e) {
            $('bootNote').textContent = `the block will not parse — ${e.message}`;
            return;
        }
        block = { ...block, boot: { ...block.boot, x: at.x, y: at.y } };
        $('bootBox').value = JSON.stringify(block, null, 4);
        $('bootX').value = String(at.x);
        $('bootY').value = String(at.y);
        $('bootStart').value = source;
        const p = playerPointFor(at);
        // ⚠ BOTH NUMBERS, ALWAYS. The block holds ctor args and the HUD shows
        // the player's position, and they differ by the half tile — a readout
        // that printed one of them would make the other look like a bug.
        const note = `start ${at.x},${at.y} — the \`Game\` ctor's own args, so the player is `
            + `observed at (${p.x},${p.y})`;
        $('bootNote').textContent = extraNote ? `${extraNote}  ·  ${note}` : note;
        scheduleRedraw();
    };

    /**
     * ⛔ THE OPTIONS ARE THE LADDER, IN DESCENDING ORDER OF TRUST, and each one
     * carries its own sentence rather than a shared one.
     *
     * ⚠ `chooseSpawn` IS STILL OFFERED AND IS STILL LAST. It is the only
     * answer for the four rooms nothing leads into (58, 69, 81, 84 — measured)
     * and it is still *a convenience for looking around, not a position the
     * game ever used*. What changed is that it is no longer the DEFAULT for
     * the 74 levels that have no committed boot: 112 of 116 rooms now get the
     * game's own arrival point instead.
     */
    const startOptionsFor = (level) => {
        const opts = [];
        const committed = committedBootByLevel.get(level);
        if (committed) {
            opts.push({
                value: 'committed',
                label: `COMMITTED BOOT — ${committed.boot.x},${committed.boot.y} `
                    + `(from ${committed.name}, a position the game itself used)`,
                at: { x: committed.boot.x, y: committed.boot.y },
                note: `level ${level} — booting at (${committed.boot.x},${committed.boot.y}) `
                    + `from ${committed.name}'s own boot block, a position the game itself used`,
            });
        }
        const { entrances, why } = entrancesTo(entranceIndex, level);
        for (const e of entrances) {
            opts.push({
                value: `entrance:${e.id}`,
                label: `ENTRANCE — ${entranceLabel(e)}`,
                at: { x: e.x, y: e.y },
                note: `level ${level} — the ENTRANCE from L${e.from}`
                    + `${e.isStairs ? ' (stairs)' : ''}: where the game itself puts the player `
                    + 'when they walk in, from that teleporter\'s own `playerx`/`playery`'
                    + `${e.deactivated ? '. ⚠ THIS TELEPORTER IS DEACTIVATED on a fresh boot, '
                        + 'so the route in is shut even though the arrival point is real' : ''}`,
            });
        }
        return { opts, why };
    };

    /**
     * ── ⛓⛓⛓ THE LEVEL STEPPER (group A, items 7 and 10) ───────────────
     *
     * ⛔ IT WALKS THE ATLAS'S OWN LEVEL LIST, not `level ± 1`. The atlas has
     * gaps, and a stepper that counted integers would hand you a refusal from
     * `levelSourceFromAtlas` for a room the game does not have — a control
     * that produces errors for pressing it is not a control.
     *
     * ⚠ A GENERATED LEVEL IS NOT IN THAT LIST (900 is nobody's neighbour), so
     * stepping from one LEAVES it, and the note says so rather than the
     * button doing nothing.
     */
    const stepLevel = async (dir) => {
        // ⛓ The roster is already in flight from the preset mount; this is a
        // no-op by the time a human presses.
        await bootRosterReady?.catch(() => {});
        if (!lifetime.alive()) return;
        let block;
        try {
            block = blockNow();
        } catch (e) {
            $('bootNote').textContent = `the block will not parse, so the level cannot be `
                + `stepped — ${e.message}`;
            return;
        }
        const here = block.boot.level;
        const at = atlasLevels.indexOf(here);
        const next = at === -1
            ? (dir > 0 ? atlasLevels[0] : atlasLevels[atlasLevels.length - 1])
            : atlasLevels[at + dir];
        if (next === undefined) {
            $('bootNote').textContent = `level ${here} is the ${dir > 0 ? 'last' : 'first'} `
                + `level this atlas holds (${atlasLevels.length} of them), so there is no `
                + `${dir > 0 ? 'next' : 'previous'} one`;
            return;
        }
        await setLevel(next, at === -1
            ? `level ${here} is not in the atlas (a generated room is nobody's neighbour), `
                + 'so stepping left it'
            : null);
    };

    /**
     * ⛔⛔ THE BOOT POSITION IS NO LONGER GUESSED FOR 112 OF THE 116 ROOMS.
     *
     * Group A shipped this with two answers and a warning: a COMMITTED BOOT
     * from the tape roster (42 levels) or `chooseSpawn`, *a convenience for
     * looking around, not a position the game ever used*. ⚖ The user's item
     * replaces the second one wherever the game itself has an answer — and it
     * does, in the shape of a teleporter: **an entrance to level N is any
     * teleporter whose `to` is N**, and its `playerx`/`playery` are the very
     * ctor args `levelRun`'s transition arm passes when the player walks in.
     *
     * ⛔ FOUR OUTCOMES NOW, AND STILL FOUR DIFFERENT SENTENCES — the same rule
     * Group A wrote this comment for. "A tape booted here", "the game puts you
     * here when you walk in", "this page picked a spot" and "nothing could be
     * picked, so the old position stands and may be inside a wall" are four
     * degrees of trust, and a note that read the same for all of them would
     * make the weakest look like the strongest.
     *
     * ⚠ THE COMMITTED BOOT STILL WINS WHERE IT EXISTS, and that is a decision
     * rather than an oversight. MEASURED: of the 42, exactly **21 sit on an
     * entrance and 21 do not** — `r3-collect-shield` boots at (112,72) in L20,
     * mid-room, to isolate one mechanism. Both are positions the game used and
     * they answer different questions; the SELECTOR offers every entrance
     * regardless, so nothing is hidden by the default.
     */
    async function setLevel(level, why = null) {
        await bootRosterReady?.catch(() => {});
        if (!lifetime.alive()) return;
        let block;
        try {
            block = blockNow();
        } catch (e) {
            $('bootNote').textContent = `the block will not parse — ${e.message}`;
            return;
        }
        block = { ...block, boot: { ...block.boot, level } };
        $('bootBox').value = JSON.stringify(block, null, 4);
        $('bootLevel').value = String(level);
        const { opts, why: noEntranceWhy } = startOptionsFor(level);
        mountStartOptions(opts, noEntranceWhy);
        const notes2 = [];
        if (why) notes2.push(why);
        if (opts.length > 0) {
            // ⛔ THE LADDER'S HEAD — committed first where it exists, then the
            // entrances in atlas order. `startOptionsFor` builds it in that
            // order and this takes the front rather than re-deciding, so the
            // selector's first row and the block's contents cannot disagree.
            const pick = opts[0];
            notes2.push(pick.note);
            writeStart(pick.at, pick.value, notes2.join('  ·  '));
            return;
        }
        /**
         * ⚠ ONLY THE FOUR ROOMS NOTHING LEADS INTO REACH THIS (58, 69, 81, 84
         * — measured), and the reason the entrance index gave is printed with
         * the fallback rather than replaced by it: "this page picked a spot"
         * is much easier to trust than it should be without "…because nothing
         * in the atlas walks into this room" beside it.
         */
        if (noEntranceWhy) notes2.push(noEntranceWhy);
        let chosen = null;
        try {
            chosen = chooseSpawn(levelSource, block, level);
        } catch (e) {
            notes2.push(`⚠ level ${level}'s world would not build, so no spawn could be `
                + `chosen — ${e.message}`);
        }
        if (chosen) {
            notes2.push(`level ${level} — ⚠ THIS PAGE CHOSE (${chosen.x},${chosen.y}): the `
                + 'nearest walkable non-pit cell where the player box clears the solids. A '
                + 'convenience for looking around, not a position the game ever used — '
                + 'nothing may rest on it');
            mountStartOptions([{
                value: 'page-chose',
                label: `THIS PAGE CHOSE — ${chosen.x},${chosen.y} (nearest clear cell; not a `
                    + 'position the game ever used)',
                at: chosen,
                note: notes2[notes2.length - 1],
            }], noEntranceWhy);
            writeStart(chosen, 'page-chose', notes2.join('  ·  '));
            return;
        }
        notes2.push(`level ${level} — ⚠ no entrance, no committed boot, AND no free cell `
            + `could be chosen, so the boot position (${block.boot.x},${block.boot.y}) is `
            + 'still the previous level\'s and may be inside a wall');
        $('bootNote').textContent = notes2.join('  ·  ');
        $('bootX').value = String(block.boot.x);
        $('bootY').value = String(block.boot.y);
        scheduleRedraw();
    }

    /**
     * ⛓⛓⛓ THE SELECTOR'S OPTIONS, PLUS THE ONE THAT IS ALWAYS THERE.
     *
     * ⚠ `custom` IS NOT A PLACE, IT IS AN ATTRIBUTION. Every other row names
     * where its numbers came from; this one says a human typed them, which is
     * the honest label for a coordinate with no provenance — and it is exactly
     * what the two number fields select when they are edited.
     */
    let startOptions = [];
    function mountStartOptions(opts, noEntranceWhy) {
        startOptions = opts;
        const sel = $('bootStart');
        sel.innerHTML = '';
        for (const o of opts) {
            const el = document.createElement('option');
            el.value = o.value;
            el.textContent = o.label;
            sel.appendChild(el);
        }
        const custom = document.createElement('option');
        custom.value = 'custom';
        custom.textContent = 'CUSTOM — the x/y beside this box, typed by hand';
        sel.appendChild(custom);
        // ⚠ A NAMED ABSENCE ON THE CONTROL ITSELF. A selector holding nothing
        // but "custom" reads as a broken control; the reason it is empty is a
        // fact about the atlas and belongs where the emptiness is.
        sel.title = opts.length > 0
            ? 'where the start position came from — the game\'s own answers first'
            : (noEntranceWhy ?? 'no start position could be derived for this level');
    }

    lifetime.on($('bootStart'), 'change', () => {
        const want = $('bootStart').value;
        if (want === 'custom') {
            // ⚠ Selecting CUSTOM changes nothing but the label: the numbers in
            // the fields are already what is in force, and moving the player
            // because a dropdown was opened would be a control with a side
            // effect nobody asked for.
            writeStart({ x: Number($('bootX').value), y: Number($('bootY').value) }, 'custom',
                'CUSTOM — these coordinates are yours; nothing in the game or the tape '
                + 'roster claims them');
            return;
        }
        const opt = startOptions.find((o) => o.value === want);
        if (opt) writeStart(opt.at, opt.value, opt.note);
    });

    /**
     * ⛓ THE TWO NUMBER FIELDS, AND EDITING ONE SWITCHES THE ATTRIBUTION.
     *
     * ⛔ A HAND-TYPED COORDINATE MAY NOT KEEP AN ENTRANCE'S LABEL. The whole
     * item is about knowing where a start position came from; a selector still
     * reading "ENTRANCE from L9" over numbers somebody had since edited would
     * be the page asserting a provenance that is no longer true.
     */
    const onCoordEdit = () => {
        const x = Number($('bootX').value);
        const y = Number($('bootY').value);
        if (!Number.isInteger(x) || !Number.isInteger(y)) {
            // ⚠ SNAP BACK rather than write NaN into the block: the field then
            // SHOWS what is in force, which is the only way to tell a rejected
            // edit from an accepted one.
            let block;
            try { block = blockNow(); } catch { return; }
            $('bootX').value = String(block.boot.x);
            $('bootY').value = String(block.boot.y);
            $('bootNote').textContent = 'a start coordinate is a whole number of pixels — '
                + 'the `Game` constructor takes ints, so a fraction is not a position the '
                + 'engine can be booted at. The previous value stands';
            return;
        }
        writeStart({ x, y }, 'custom',
            'CUSTOM — these coordinates are yours; nothing in the game or the tape roster '
            + 'claims them');
    };
    lifetime.on($('bootX'), 'change', onCoordEdit);
    lifetime.on($('bootY'), 'change', onCoordEdit);

    /**
     * ⛓⛓⛓ READ THE BLOCK AND SAY WHERE ITS POSITION CAME FROM — WITHOUT
     * MOVING IT.
     *
     * ⛔⛔ THIS IS THE HALF THAT MUST NOT WRITE. A panel mounts holding a block
     * that came from a preset, a `?boot=` tape or the kept block of a previous
     * arm, and that position is the user's. `setLevel` CHOOSES a position (the
     * level changed, so the old one is meaningless); this only ATTRIBUTES the
     * one already there. A mount that ran the chooser would silently replace a
     * hand-tuned boot every time the SOURCE selector was touched — and since
     * the switch arc the selector no longer reloads, that would happen over
     * and over in one document.
     *
     * ⚠ AND AN UNMATCHED POSITION IS `custom`, NOT THE FIRST OPTION. A block
     * whose coordinates are nobody's entrance is exactly the case the label
     * exists for; defaulting the selector to the head of the ladder would
     * caption somebody's own numbers with a provenance they do not have.
     */
    function syncStartControls() {
        let block;
        try {
            block = blockNow();
        } catch {
            // The form already says the block will not parse; leaving the
            // fields as they are beats writing a guess into them.
            return;
        }
        const { opts, why: noEntranceWhy } = startOptionsFor(block.boot.level);
        mountStartOptions(opts, noEntranceWhy);
        $('bootX').value = String(block.boot.x);
        $('bootY').value = String(block.boot.y);
        $('bootLevel').value = String(block.boot.level);
        const match = opts.find((o) => o.at.x === block.boot.x && o.at.y === block.boot.y);
        $('bootStart').value = match ? match.value : 'custom';
    }
    syncStartControls();
    /**
     * ⚠ AND AGAIN ONCE THE TAPE ROSTER LANDS. `committedBootByLevel` is filled
     * by a fetch, so the first render can legitimately be missing the
     * COMMITTED BOOT row — the same race the level stepper documents and
     * answers by awaiting. Here the answer is to render twice: immediately, so
     * the control is never empty, and again when the roster resolves, so the
     * option appears. ⛔ Guarded on the lifetime, because a retired arm's
     * promise still settles.
     */
    bootRosterReady?.then(() => { if (lifetime.alive()) syncStartControls(); })
        .catch(() => {});

    $('bootPrev').onclick = () => stepLevel(-1);
    $('bootNext').onclick = () => stepLevel(1);
    // ⛓ TYPING A LEVEL WRITES THE BLOCK, through the same function the arrows
    // use — one path from "a level was chosen" to "the block says so".
    lifetime.on($('bootLevel'), 'change', () => {
        const wanted = Number($('bootLevel').value);
        if (!Number.isInteger(wanted)) return;
        /**
         * ⛔⛔ A CHANGE TO THE LEVEL ALREADY IN FORCE IS NOT A CHANGE, AND
         * TREATING IT AS ONE CLOBBERS A DELIBERATE CHOICE.
         *
         * `setLevel` PICKS a start position — that is its job, because a new
         * room makes the old coordinates meaningless. So a spurious re-fire
         * for the SAME level throws away whatever the user selected in the
         * meantime and silently reinstates the head of the ladder.
         *
         * ⛓ MEASURED, and it is not hypothetical: a number input fires
         * `change` on BLUR as well as on commit, so the sequence "type a
         * level, then click the entrance picker" delivered a second `change`
         * from the field losing focus. The browser row caught it as an
         * entrance selection that reverted to the committed boot between one
         * read and the next — `48,32` back to `48,80` with the selector
         * flipping itself to `committed`.
         *
         * ⇒ the level field answers "take me to a different room", and the
         * start-position controls answer "put me somewhere in this one". A
         * control that quietly did both is why this guard exists.
         */
        let here = null;
        try { here = blockNow().boot.level; } catch { /* the form says so */ }
        if (here === wanted) return;
        setLevel(wanted);
    });
    // ⚠ The roster decides where the player STARTS, so the stepper is only
    // meaningfully pressable once it has answered. Enabled either way — a
    // control that vanishes is worse than one that reports a caveat — but the
    // await above is what makes the caveat rare.
    /**
     * A hand edit of the block itself redraws too — on `change` (blur) rather
     * than per keystroke, which would build a world for every half-typed number.
     *
     * ⛓ AND IT RE-ATTRIBUTES THE START POSITION FIRST. Typing an entrance's
     * coordinates into the textarea makes the selector say `ENTRANCE from L9`;
     * typing anything else makes it say CUSTOM. ⚠ ONE LISTENER DOING BOTH,
     * deliberately: a second `change` on the same element would be a second
     * thing to retire and a second ordering to reason about, for a handler
     * that is two statements.
     */
    lifetime.on($('bootBox'), 'change', () => { syncStartControls(); scheduleRedraw(); });

    return { staging, origin, kept, name, preview, setLevel, redraw };
}

/**
 * The SOLVE arm: staging in, the bot's own walk out, scrubbed by REPLAY's
 * machinery.
 *
 * ⚠ The solve is SYNCHRONOUS and blocks the page while it runs — which is
 * exactly the quantity ⚖ kickoff §1.2 deferred the live think-mode on, so
 * the page measures it and shows it rather than hiding it behind a
 * spinner.
 */
async function runSolve(params, lifetime) {
    const { levelSource, atlas } = await armPrelude(params, lifetime);
    // ⛔ EVERY AWAIT IS A PLACE THE PAGE CAN HAVE CHANGED HANDS. A mount that
    // kept writing after its arm was retired would paint this arm's title and
    // block over the one the user actually switched to.
    if (!lifetime.alive()) return;

    const layers = layerSetFor(params);
    const { staging, name } = await mountBootPanel(params, lifetime, {
        verb: 'solving',
        namePrefix: 'editor',
        levelSource,
        layers,
        atlas,
        // ⛓ The SOLVE arm's own consumer: a ticked sword rebuilds the world
        // the goal picker offers, so the census follows the box.
        onBoxChange: () => refreshFromBox(),
    });
    if (!lifetime.alive()) return;

    // ── the goal picker, over this staging block's own census ────────
    let goals = params.goals ? parseGoalsParam(params.goals) : [];
    /**
     * ⛔ WHETHER THE GOAL LIST IS THE USER'S. `?goals=` and every press of
     * add/clear make it theirs, and the auto-pick below then keeps its hands
     * off — a control that re-chose for you after you cleared it would be
     * fighting you, once per level change.
     */
    let goalsAreYours = goals.length > 0;
    const showGoals = () => {
        $('solveGoals').textContent = goals.length ? formatGoalsParam(goals) : '—';
    };
    const fillCensus = (world) => {
        const options = censusGoalOptions(world);
        $('solveGoalPick').innerHTML = '';
        for (const o of options) {
            const el = document.createElement('option');
            el.value = o.spec;
            el.textContent = o.label;
            // Listed, never dropped — but not selectable, with the reason
            // in the tooltip. "Shut" and "absent" must not look alike.
            el.disabled = !o.usable;
            if (o.why) el.title = o.why;
            $('solveGoalPick').appendChild(el);
        }
        if (!options.length) {
            $('solveGoalPick').innerHTML =
                '<option value="">— this level\'s census names no exit and no placement —</option>';
            return;
        }
        /**
         * ── ⛓⛓⛓ THE GOALS, PRE-FILLED FROM THE CENSUS (group A, item 10) ──
         *
         * Browsing levels with ◀ ▶ is unusable if every step needs a trip to
         * the dropdown before SOLVE can be pressed. So the list is filled on
         * arrival — ⛔ BY `defaultGoalsFromCensus`, THE PAGE'S OWN EXISTING
         * LAW, and never by a second policy invented here.
         *
         * ⚠ MEASURED, TWICE OVER. The first cut auto-picked "the first usable
         * option", which quietly overruled the one case that law exists for —
         * a level with two live exits, where the page refuses because a solve
         * toward the wrong one prints a tick count that looks like an answer.
         * `check-seedling-editor-boot.mjs` went red on exactly that (level 4).
         * The second cut fired only when the census had ONE usable option of
         * any kind, which honoured the law but almost never fired: level 0 has
         * eight, seven of them pickups nobody is ambiguous about.
         *
         * ⇒ ASK THE FUNCTION THAT ALREADY KNOWS. It takes every placement and
         * the single live exit when there is exactly one, and REFUSES — with
         * the alternatives named — when there is not. That is precisely the
         * set of decisions this page is entitled to make, so the pre-fill and
         * the press now agree by construction rather than by care.
         */
        if (!goalsAreYours) {
            const d = defaultGoalsFromCensus(world);
            const usable = options.filter((o) => o.usable);
            if (usable.length) $('solveGoalPick').value = usable[0].spec;
            if (d.goals) {
                goals = d.goals;
                showGoals();
                $('bootNote').textContent += `${$('bootNote').textContent ? '  ·  ' : ''}`
                    + `⛓ goals pre-filled from this level's census — ${formatGoalsParam(d.goals)}`
                    + '. This is the SAME default SOLVE would use on an empty list, not a '
                    + 'second opinion about it; add or clear to make the list yours.';
            } else {
                $('bootNote').textContent += `${$('bootNote').textContent ? '  ·  ' : ''}`
                    + `⚠ no goals pre-filled — ${d.refusal}`;
            }
        }
    };
    showGoals();

    /**
     * ⛔⛔ THE BLOCK THE BUTTON ACTUALLY SOLVES IS THE ONE IN THE BOX —
     * and until slice 5 it was not.
     *
     * `runSolve` fetched a staging block, printed it into the textarea and
     * then kept its own closure copy; `solveNow` solved THAT. So every edit
     * anybody made to the "starting conditions" editor since slice 1 shipped
     * was silently discarded — the page showed a block, accepted changes to
     * it, and solved a different one. The MANUAL arm has re-read its own box
     * at START since slice 3 (`stagingFromJson(JSON.parse(...))`), which is
     * what makes the asymmetry visible now that a FORM writes into the box:
     * a sword checkbox over a textarea nobody reads is a control that does
     * nothing, reporting success.
     *
     * ⚠ Found by building the form, not by inspection — the same way slice
     * 3's load-note was found by its browser row. A feature that consumes an
     * input is how you learn whether the input was ever consumed.
     */
    const stagingNow = () => {
        const block = stagingFromJson(JSON.parse($('bootBox').value));
        return params.level !== null && Number.isFinite(params.level)
            ? { ...block, boot: { ...block.boot, level: params.level } }
            : block;
    };

    // The census needs a built world, and building one can refuse (a level
    // the atlas does not have, an orphan clear). REPORTED, not swallowed.
    let world = null;
    /**
     * ⛔⛔ THE CENSUS IS REBUILT FROM THE BLOCK BEING SOLVED, and it has to
     * take that block as an ARGUMENT rather than re-deriving it.
     *
     * The first cut re-read the box here too, and `solveNow` re-read it
     * again — two readings of one textarea in a single press. Retyping the
     * level to 4 then produced a refusal naming LEVEL 11's exits: the block
     * was fresh and the census was the one built at mount. That is the
     * two-cost-models trap in miniature, and its tell was a message about
     * the wrong room. ⚠ Caught by the acceptance row, which asserted the
     * refusal names the level in the box — a check on `__editorSolve.level`
     * alone would have been green.
     */
    const refreshCensus = (block) => {
        try {
            world = censusWorld(levelSource, block);
            fillCensus(world);
            return true;
        } catch (e) {
            fatal(`level ${block.boot.level} would not build from this staging block`,
                e.message);
            return false;
        }
    };
    refreshCensus(staging);
    /**
     * ⛓ THE FORM'S CONSUMER, IN THE SAME SLICE (trap 119). A ticked sword
     * rebuilds the world the goal picker offers — `Karlore` removes itself
     * when the player has fire and a `BossKey` in its own first `check()`,
     * so an item flag really can change what a level CONTAINS.
     *
     * ⚠ And a HAND edit refreshes it on `change` (blur), not on `input`: a
     * world build per keystroke would rebuild a level for every half-typed
     * number. The press-time refresh in `solveNow` is what makes the picker's
     * staleness cosmetic rather than load-bearing.
     */
    function refreshFromBox() { try { refreshCensus(stagingNow()); } catch { /* shown */ } }
    // ⛓ NO SECOND `change` LISTENER ON THE BOX. The panel's own redraw calls
    // `onBoxChange` — which IS this function — so registering here too would
    // rebuild the census twice per edit: harmless, invisible, and exactly the
    // kind of duplicate work the shared panel exists to stop.

    $('solveGoalAdd').onclick = () => {
        const spec = $('solveGoalPick').value;
        if (!spec) return;
        // ⛓ Touching the list makes it YOURS — the auto-pick stops choosing.
        goals = [...(goalsAreYours ? goals : []), ...parseGoalsParam(spec)];
        goalsAreYours = true;
        showGoals();
    };
    $('solveGoalClear').onclick = () => { goals = []; goalsAreYours = true; showGoals(); };

    // ── SOLVE ────────────────────────────────────────────────────────
    async function solveNow() {
        $('solveGo').disabled = true;
        /**
         * ⛔ THE PREVIOUS SOLVE'S TAPE STOPS BEING SHIPPABLE THE MOMENT THIS
         * PRESS STARTS. Left standing, a solve that then REFUSED would leave
         * the button enabled over a tape from the room before the one in the
         * box — a ship that works, reports `agrees`, and is about the wrong
         * level.
         */
        setShippable({ why: 'solving\u2026' });
        // ⛔ THE BOX, RE-READ AT PRESS — see `stagingNow`. A refusal here is
        // the tape parser's own message, exactly as the MANUAL arm's is.
        let block;
        try {
            block = stagingNow();
        } catch (e) {
            fatal('the starting conditions would not parse — this is the tape parser\'s '
                + 'own message', e.message);
            window.__editorSolve = { status: 'refused', message: e.message };
            $('solveGo').disabled = false;
            return;
        }
        // ⛔ ONE READING PER PRESS: the census the default goals come from is
        // rebuilt from the SAME block the solve will run, so a refusal names
        // the room in the box rather than the room at mount.
        if (!refreshCensus(block)) {
            $('solveGo').disabled = false;
            return;
        }
        let list = goals;
        if (!list.length) {
            if (!world) return;
            const d = defaultGoalsFromCensus(world);
            if (!d.goals) {
                fatal('no goals — and this level has no unambiguous default', d.refusal);
                window.__editorSolve = { status: 'refused', message: d.refusal };
                $('solveGo').disabled = false;
                return;
            }
            list = d.goals;
            goals = list;
            showGoals();
        }

        $('status').className = '';
        $('status').textContent = `solving ${name} in level ${block.boot.level} `
            + `toward ${formatGoalsParam(list)}…`;
        // Yield one frame so the status paints BEFORE the synchronous solve
        // takes the thread. Without it the page looks frozen with the old
        // text on it, which is a lie about what it is doing.
        await new Promise((r) => requestAnimationFrame(r));

        let solved;
        try {
            solved = solveForPage({
                levelSource, staging: block, goals: list, name, now: () => performance.now(),
                /**
                 * ⛓⛓ THE SCRATCH FORK, AND ONLY FOR A LEVEL WITH NO TAPE
                 * BEHIND IT. A kill-lock clear is DECLARED by a recorded
                 * tape's v9 `at` row; a level the GENERATE arm just handed
                 * over has no tape at all, so `levelRun`'s refusal to compute
                 * a clear nobody declared is vacuous exactly there and
                 * correct everywhere else. ⛔ Keyed on the HELD LEVEL, never
                 * on the level NUMBER: 900 is a convention, and a flag that
                 * read it would turn any block someone typed 900 into a
                 * scratch solve.
                 */
                scratchPersistence: isHeldLevel(block.boot.level),
            });
        } catch (e) {
            // ⚠ THE SOLVER'S OWN MESSAGE, VERBATIM, with the rows it got
            // through first — a refused segment is still reviewable, and
            // `SolverRefusal` carries them for exactly that. ⛓ Slice 5: the
            // despawn CHECK's refusal arrives through this same arm, which
            // is why the wording says "the solver" rather than naming one.
            const rows = e.rows?.length;
            /**
             * ⛓⛓⛓ ⚖ EDITOR ARC SLICE 10 — THE DANGER RECORD, ON THE ONE
             * OUTCOME THAT CAN CARRY A NON-EMPTY ONE.
             *
             * Slice 9 gave the page a `danger` layer and then measured that
             * across 30 solves of 9 committed blocks NOT ONE recorded query
             * came back dangerous (§17.5) — a theorem, not an accident:
             * `refuseDanger` THROWS when the union answers danger, so a
             * segment that reaches its goal cannot have had a dangerous gate.
             * ⇒ the interesting half of that channel lives HERE, on the
             * refusal path, and until slice 10 nothing read it.
             *
             * ⛔ THE READOUT IS THREE DIFFERENT ANSWERS, NOT A COUNT. `null`
             * = this refusal carries no record at all (thrown by a
             * module-level helper, which cannot see `solveSegment`'s
             * recorder — the same bound `rows` and `perTick` already have);
             * `0` = the bot asked nothing before it stopped; `n` with
             * `dangerous: 0` = it was told CLEAR every time and stopped for
             * some other reason. Collapsing those would report "no danger"
             * for a refusal nobody recorded.
             */
            const queries = Array.isArray(e.dangerQueries) ? e.dangerQueries : null;
            const dangerous = (queries ?? []).filter((q) => q.danger);
            const dangerLine = queries === null
                ? '\n\n(this refusal carries NO danger record — it was raised outside '
                    + 'the solve loop\'s own recorder)'
                : `\n\n⚖ the danger the bot was told: ${queries.length} query(s), `
                    + `${dangerous.length} DANGEROUS${dangerous.length
                        ? `:\n${dangerous.slice(0, 4).map((q) => `  · ${q.where} at tick `
                            + `${q.tick} (run tick ${q.runTick}), L${q.level} `
                            + `(${q.x},${q.y}) — ${q.sources
                                .map((s) => `${s.kind}:${s.id ?? '?'} (${s.why})`).join('; ')}`)
                            .join('\n')}`
                        : ' — every gate this walk reached answered CLEAR'}`;
            fatal('the solver REFUSED — this is its own message, not the page\'s',
                `${e.message}${rows ? `\n\n(${rows} decision row(s) before the refusal)` : ''}`
                + dangerLine);
            window.__editorSolve = {
                status: 'refused',
                message: e.message,
                rows: rows ?? 0,
                dangerQueries: queries === null ? null : queries.length,
                dangerousQueries: queries === null ? null : dangerous.length,
                /**
                 * ⛔ THE UNION'S OWN `why` STRINGS, VERBATIM — a paraphrase
                 * would be a second spelling of the warning, and the warning
                 * is the entire content of the channel (the recorder's own
                 * rule, one module over).
                 */
                dangerSources: dangerous.flatMap((q) => q.sources.map((s) => s.why)),
            };
            $('solveGo').disabled = false;
            return;
        }

        const solveMs = Math.round(solved.ms);
        $('solveTime').textContent = `solved in ${solveMs} ms`;
        const replayT0 = performance.now();
        // ⛓ The trace goes STRAIGHT into the pane: an in-page solve already
        // holds it, so fetching a sidecar for a tape that was never written
        // would be looking on disk for something in memory.
        // ⚖ ITEM 9: the danger the SOLVER was told rides straight into the
        // replay, exactly as its trace does — the solve holds both in memory,
        // and a page that went looking for either on disk would be looking for
        // an artifact that was never written.
        const replayed = await replayTape(solved.tape, name, params, levelSource,
            { trace: solved.out.trace, why: null }, solved.out.dangerQueries,
            // ⛓ The tape being scrubbed came from a scratch solve iff the
            // solve above was one — the same fork, kept in step by construction.
            { scratchPersistence: isHeldLevel(block.boot.level) });
        const { frames } = replayed;
        const replayMs = Math.round(performance.now() - replayT0);

        /**
         * ⛓ The trace's SHAPE, beside the run's own counts — the same
         * summary `solve-seedling-r8-battery` prints. The rows themselves
         * are in the pane (slice 2), which is the consumer this readout was
         * standing in for.
         */
        $('detail').textContent = `${$('detail').textContent}`
            + `${$('detail').textContent ? '  ·  ' : ''}`
            + `SOLVED: ${solved.out.perTick.length} ticks, `
            + `${solved.out.trace.rows.length} decision(s), `
            + `${solved.out.replans} re-plan(s), `
            + `${solved.run.playerHits.length} hit(s), `
            + `${solved.run.playerDeaths.length} death(s)  ·  `
            + `solve ${solveMs} ms + replay ${replayMs} ms`
            /**
             * ⛓ THE DESPAWN CHECK'S VERDICT, ON SCREEN (slice 5). A check
             * whose only outcome anybody sees is its REFUSAL is a check
             * nobody can tell ran — trap 119's family, one channel over. A
             * reproduced row names the model's own tick beside the declared
             * witness band so the two numbers are visibly different things.
             */
            + (solved.despawns.length
                ? `  ·  DESPAWN CHECK: ${solved.despawns.map((d) => `${d.id} declared by `
                    + `${d.at}${d.reproduced ? ` — the model removed it at ${d.t} (${d.cause})`
                        : ' — NOT reproduced by this walk (the route never caused it)'}`)
                    .join('; ')}`
                : '');
        $('status').className = 'ok';
        $('status').textContent = `${name} — ${frames.length} observations, `
            + `solved in ${solveMs} ms`;

        /**
         * The page's own readout, for `check-seedling-editor-solve.mjs`.
         * Sets are not JSON, so the held keys travel as arrays IN THE
         * SOLVER'S OWN ORDER — sorting them here would hide exactly the
         * kind of difference the acceptance row exists to catch.
         */
        window.__editorSolve = {
            status: 'ok',
            name,
            level: block.boot.level,
            despawns: solved.despawns,
            tapeVersion: solved.tape.tape_version,
            goals: formatGoalsParam(list),
            tickCount: solved.out.perTick.length,
            perTick: solved.out.perTick.map((held) => [...held]),
            inputs: solved.tape.inputs,
            traceRows: solved.out.trace.rows.length,
            solveMs,
            replayMs,
            frames: frames.length,
        };
        // The pane reads the object above directly; this is the same trace,
        // exposed for a CLI or a console that wants the rows without the DOM.
        window.__editorTrace = solved.out.trace;
        /**
         * ⛓⛓ AND IT IS NOW SHIPPABLE. ⛔ THE TAPE IS `solved.tape` — the fold
         * `buildStagedTape` already made, the same one `?side=wasm` would
         * replay if it had been committed. Building a second tape here from
         * `perTick` would be a second fold of one walk.
         *
         * ⛓ THE EXPECTATION IS THE FRAMES THE SCRUB IS ALREADY SHOWING, so
         * "where the JS model ended" is literally the last frame on screen —
         * not a re-walk that could differ from it.
         */
        setShippable({
            what: `\u25b6 ship the solve's own tape \u2014 ${name}, `
                + `${solved.tape.tick_count} tick(s) in level ${block.boot.level}`,
            build: () => ({
                tape: solved.tape,
                expect: expectFromFrames(frames),
                /**
                 * ⛓⛓ AND THE WHOLE STREAM, FROM THE SAME WALK — not a second
                 * one. `replayTape` returns the stepper's own `finished` block,
                 * which IS `runTape`'s result, which is what `runTapeToStream`
                 * hands the node differential. So the per-tick verdict compares
                 * the run THIS SCRUB IS SHOWING against the real game, in the
                 * one observation vocabulary (trap 383).
                 */
                modelStream: modelStreamOf(replayed),
                modelStreamWhy: modelStreamOf(replayed) ? null
                    : 'the model walk did not finish — the scrub shows what it got',
                label: `${name} \u2014 the solve's own tape`,
            }),
        });
        $('solveGo').disabled = false;
    }

    $('solveGo').onclick = solveNow;
    if (params.solve) await solveNow();
    else {
        $('status').textContent = `ready — level ${staging.boot.level} from ${origin}. `
            + 'Pick goals and press SOLVE.';
    }
}

// ── SOURCE = MANUAL (editor arc slice 3) ─────────────────────────────────

/**
 * ── ⛓⛓⛓ DRIVE THE PLAYER BY HAND, AND FOLD THE SESSION INTO A TAPE ─────
 *
 * ⛔ THE LOOP LAW, ANSWERED. This advances a run tick by tick, and the page's
 * third law is NO PRIVATE TICK LOOP. It is not one: the law forbids a second
 * REPLAY loop (two of those drift, and the one nobody tests is the one that
 * drifts). This is a PRODUCER, beside `solveSegment` and `botDriverV1/V2` —
 * keys in, `perTick` out, with no tape it claims to reproduce. And the join
 * is ASSERTED rather than assumed: STOP folds with the ONE fold and replays
 * the result through the ONE stepper, comparing every observation
 * (`watchManual.foldRoundTrip`). If a producer ever did drift from the
 * replay, that comparison is where it shows.
 *
 * ⛔ ONE CONSTRUCTION AND ONE FOLD, both `solveForPage`'s:
 * `createRunForStaging(solveStaging(staging))` and `buildStagedTape`.
 *
 * ⚠ THE LIVE OVERLAYS ARE THE REPLAY'S OWN CALLS. `sampleMovers` per tick
 * (slice 2's line, no new mechanism) and `extractMarkers` over the session's
 * observations — so what you see while driving and what you see scrubbing
 * the tape you just recorded are the same derivation, not two that agree.
 */
async function runManual(params, lifetime) {
    const { levelSource, atlas } = await armPrelude(params, lifetime);
    if (!lifetime.alive()) return;

    /**
     * ⛓ THE SAME PANEL SOLVE MOUNTS, over the SAME box — which is what makes
     * a block edited in SOLVE the block you drive here. ⚠ MANUAL passes no
     * `onBoxChange`: it re-reads the box at START (slice 3 of the editor arc),
     * so there is nothing downstream to refresh in between.
     */
    // ⚠ ONCE, AND BEFORE THE PANEL. The Set IS the live toggle state — the
    // checkboxes mutate it in place, so rebuilding it per draw would undo
    // every toggle every frame, and the preview must share the one the drive
    // will use or a layer would mean two different things either side of START.
    const layers = layerSetFor(params);
    const { staging, name } = await mountBootPanel(params, lifetime, {
        verb: 'driving', namePrefix: 'manual', levelSource, layers, atlas,
    });
    if (!lifetime.alive()) return;

    if (layers.unknown.length) {
        $('bootNote').textContent += `${$('bootNote').textContent ? '  ·  ' : ''}`
            + `⚠ ?layers= names ${layers.unknown.length} unknown layer(s): `
            + `${layers.unknown.join(', ')} — the roster is ${LAYER_IDS.join(', ')}`;
    }

    /**
     * ── ⛓⛓⛓ MANUAL'S SHIP: A **ZERO-INPUT** TAPE, AND THEN IT IS YOURS ────
     *
     * ⚖ THE USER MEASURED THIS (2026-08-19): the keyboard drives the real game
     * once a wasm replay has finished, so shipping a tape with `tick_count: 0`
     * and no inputs is the whole of "put me in this room, in this state, and
     * give me the controls". ⛔ No new wasm verb was needed and none was added.
     *
     * ⛔ THE BLOCK IS RE-READ AT PRESS TIME, exactly as START re-reads it. A
     * block captured at mount would ship the room you arrived in while the box
     * showed the one you edited — the defect slice 5 found in SOLVE, in the
     * same page, one control over.
     *
     * ⚠ A BLOCK HANDED OVER BY GENERATE BOOTS AT LEVEL 900, which the real
     * game does not have. That is a NAMED refusal at the `tape` stage
     * (`botLoadTape: <the game's own bounds message>`) and not a silent
     * failure — and it is the honest answer: a generated room reaches the real
     * game through the GENERATE arm's ship, which mounts it as a level SET.
     */
    setShippable({
        what: '\u25b6 ship these starting conditions as a ZERO-INPUT tape \u2014 '
            + 'after which the keyboard drives the REAL game',
        build: () => {
            const block = solveStaging(stagingFromJson(JSON.parse($('bootBox').value)));
            return {
                tape: buildStagedTape({ staging: block, perTick: [], name }),
                // ⛔ NO EXPECTATION, and the verdict SAYS so rather than
                // reporting a vacuous agreement: nothing has been driven yet,
                // so there is no JS run to agree with.
                expect: null,
                expectWhy: 'manual',
                /**
                 * ⛔ AND NO MODEL STREAM EITHER, FOR THE SAME REASON THE
                 * EXPECTATION IS ABSENT. A zero-input tape has nothing to
                 * disagree about — a per-tick comparison over it would be
                 * vacuous agreement on the boot frame, printed as if the real
                 * game had reproduced a run. The verdict says `no per-tick
                 * comparison (…)` and still reports how many observations the
                 * game drained, which is the honest fact this arm has.
                 */
                modelStream: null,
                modelStreamWhy: 'manual — nothing has been driven in JS, and a '
                    + 'zero-input tape has no run to reproduce; the keyboard is yours '
                    + 'from here',
                label: `${name} \u2014 your starting conditions, zero input`,
                note: 'the run is YOURS from here \u2014 the keyboard drives the real game '
                    + 'in the frame below (\u2696 user-measured, 2026-08-19)',
            };
        },
    });

    const canvas = $('canvas');
    let session = null;
    let driving = false;
    let speed = params.speed;
    const codes = new Set();
    let renderer = null;
    let worldFor = null;

    /**
     * ⚠ THE KEYBOARD IS READ FROM PHYSICAL CODES AND ONLY WHILE DRIVING.
     *
     * `preventDefault` on the bound keys, or the arrows scroll the page out
     * from under the canvas mid-run — and a run you cannot see is a run you
     * cannot drive. Deliberately NOT captured when the session is stopped:
     * typing a boot block into the textarea must not press X.
     */
    const onKey = (down) => (e) => {
        if (!driving) return;
        if (!tapeKeyForCode(e.code)) return;
        e.preventDefault();
        if (down) codes.add(e.code); else codes.delete(e.code);
    };
    /**
     * ⛔⛔ THESE THREE ARE THE ARM-SWITCH HAZARD IN ITS SHARPEST FORM. They
     * are on WINDOW, not on a panel, and `onKey` refuses only when this arm
     * is not `driving` — a flag in a closure that outlives the arm. Left
     * registered, a retired MANUAL would go on swallowing arrow keys under
     * SOLVE and GENERATE, and `preventDefault` means it would eat the page's
     * scrolling with them. Nothing would throw and nothing would draw wrong:
     * the keyboard would simply be haunted.
     */
    lifetime.on(window, 'keydown', onKey(true));
    lifetime.on(window, 'keyup', onKey(false));
    // A window that loses focus mid-press would otherwise hold that key for
    // the rest of the session — the tape would record a hold nobody made.
    lifetime.on(window, 'blur', () => codes.clear());

    const drawLive = () => {
        const world = worldFor(session.run.level);
        const last = session.observations[session.observations.length - 1];
        const { markers } = liveOverlaysFor(session);
        renderer.draw(world, session.run.state, {
            on: layers.on,
            samples: session.samples,
            markers,
            // ⛓ SLICE 6: the LIVE drive gets the shape layers too, off the
            // same ledger the replay path reads — a hand swing shows its rect
            // on the tick it fired, exactly as a replayed one does.
            presses: session.run.presses,
            // ⛓ GROUP B: the LIVE drive gets the afterimage too — a hand swing
            // is five ticks and a blink exactly like a replayed one.
            attackHold: attackHoldNow(),
            cursor: session.tick,
            /**
             * ⛓ SLICE 9 — THE MANUAL ARM HAS NO FRAMES, so it hands the LIVE
             * run's own two getters. One derivation (`crushersAt`), two
             * sources, and each is that path's own per-tick reading: the
             * replay path's is the R5 FORWARD, this one's is the run being
             * driven right now. A manual drive that showed no crusher because
             * the forward is a replay artifact would be the layer lying about
             * the one room it exists for.
             */
            live: { crushers: session.run.crushers, crusherScans: session.run.crusherScans },
            // ⛓ ⚖ ITEM (iv): the live run being driven right now is the one
            // that knows which of its bodies it steps.
            staticEnemies: staticEnemyBodies(session.run),
            // ⚖ A MANUAL DRIVE HAS NO SOLVER, and `null` is how the layer is
            // told to say so by name rather than drawing a calm room.
            dangerQueries: null,
        });
        $('hud').innerHTML = [
            manualRow('tick', String(session.tick)),
            manualRow('level', `${last.level} (${world.width}x${world.height})`),
            manualRow('position', `${fmt(last.x)}, ${fmt(last.y)}`),
            manualRow('held', [...heldFromCodes(codes)].sort().join(' + ') || '—'),
            manualRow('hits', `${session.run.playerHits.length}`),
            manualRow('deaths', `${session.run.playerDeaths.length}`),
            manualRow('clears', `${session.run.earnedClears.length}`),
            /**
             * ⛓ GROUP B: what the auto-advance has DRIVEN, on the HUD beside
             * what the driver did. Keys the page dispatched on your behalf and
             * wrote into your tape are not a thing to leave to a tooltip.
             */
            manualRow('auto text', autoAdvanceTextNow()
                ? `${session.autoText.releases} release(s) over `
                    + `${session.autoText.ceremonies} ceremony(s)`
                : 'OFF — you are pressing X yourself'),
        ].join('');
        // ⛓ GROUP B: the live drive's own ceremony box, from the sample the
        // session just took. The manual arm's cursor IS its tick.
        renderDialogue(session.samples, session.tick, last.level);
        $('status').textContent = `${name} — DRIVING, ${session.tick} tick(s) recorded`;
    };

    /**
     * ⚠ THE PACER IS THE PAGE'S OWN, and `speed` means the same thing it
     * means in REPLAY: ticks per animation frame. At 1x that is the game's
     * own rate on a 60 Hz display.
     *
     * ⛔ THE PER-FRAME STEP COUNT IS CAPPED. A backgrounded tab wakes with a
     * multi-second delta, and an uncapped accumulator would drive hundreds
     * of ticks in one frame with whatever keys were down — recording a walk
     * nobody made, at full speed, into the tape.
     */
    let acc = 0;
    const MAX_STEPS_PER_FRAME = 8;
    function manualFrame() {
        try {
            if (driving && session) {
                acc += speed;
                let steps = 0;
                while (acc >= 1 && steps < MAX_STEPS_PER_FRAME) {
                    acc -= 1;
                    steps += 1;
                    /**
                     * ⛓⛓⛓ GROUP B — THE CEREMONY DRIVES ITSELF, IF ASKED.
                     *
                     * ⛔ THE DECISION IS THE SESSION'S (`heldFor`), THE STEP IS
                     * STILL THIS LOOP'S. One place dispatches a manual tick,
                     * which is the no-second-loop law at its own scale; what
                     * moved into `watchManual` is the RULE about which keys,
                     * because that is the part that can be wrong and therefore
                     * the part that has tests.
                     */
                    const { held } = session.heldFor(heldFromCodes(codes),
                        { autoAdvanceText: autoAdvanceTextNow() });
                    session.step(held);
                    renderer.mark(session.run.state, session.run.level);
                }
                if (acc >= 1) acc = 0;
                drawLive();
            }
        } catch (e) {
            driving = false;
            // The run REFUSED (a soft-lock stance, an orphan clear). Its own
            // message, with the tick — and the session is kept, so STOP can
            // still fold what was driven up to it.
            fatal(`the run refused at tick ${session?.tick} — this is its own message`,
                `${e.message}\n${e.stack ?? ''}`);
            $('manualStop').disabled = false;
        }
        requestAnimationFrame(manualTick);
    }

    /**
     * ⛔⛔ THE LOOP THE RELOAD USED TO STOP. `manualFrame` re-arms from its own
     * tail unconditionally and had NO supersession check of any kind —
     * `replayGeneration` guards `replayTape`'s loop and never guarded this
     * one, because until now the only way to leave MANUAL was to navigate.
     * Retired, it would keep stepping `session` for the life of the tab,
     * under whichever arm came next, recording ticks into a tape nobody is
     * driving.
     *
     * ⚠ The guard wraps the BODY, so the tail above cannot re-arm — and the
     * unconditional re-arm after a THROW inside it survives untouched, which
     * is R4's lesson and a different question entirely.
     */
    const manualTick = lifetime.guard('manual-frame', manualFrame);

    $('manualStart').onclick = () => {
        let block;
        try {
            block = stagingFromJson(JSON.parse($('bootBox').value));
        } catch (e) {
            fatal('the starting conditions would not parse — this is the tape parser\'s '
                + 'own message', e.message);
            return;
        }
        try {
            session = createManualSession({
                levelSource, staging: block, name,
                // ⛓ Same fork, same reason as SOLVE's — a generated room has
                // no tape to declare a clear, and driving it is what would
                // produce one.
                scratchPersistence: isHeldLevel(block.boot.level),
            });
        } catch (e) {
            fatal(`level ${block.boot.level} would not build from this staging block`,
                e.message);
            return;
        }
        // ⛔ SUPERSEDES ANY REPLAY THAT OWNS THE CANVAS — see
        // `replayGeneration`. Without it a previously folded tape's loop
        // would keep drawing over the live drive.
        replayGeneration += 1;
        worldFor = makeWorldFor(levelSource, session.staging);
        renderer = makeRenderer(canvas);
        renderer.reset();
        renderer.fit(worldFor(session.run.level));
        driving = true;
        acc = 0;
        $('manualStart').disabled = true;
        $('manualStop').disabled = false;
        $('status').className = '';
        $('detail').textContent = '';
        mountLayerControls(layers.on, drawLive);
        drawLive();
        requestAnimationFrame(manualTick);
    };

    $('manualStop').onclick = async () => {
        if (!session) return;
        driving = false;
        $('manualStart').disabled = false;
        $('manualStop').disabled = true;

        /**
         * ⛓⛓⛓ THE ACCEPTANCE ROW, PERFORMED BY THE PAGE ITSELF.
         *
         * Fold with the one fold, replay through the one stepper, compare
         * every observation and every held set. Reported on the page rather
         * than merely computed: a round trip that silently failed would show
         * a tape that looks exactly like a good one.
         */
        const trip = foldRoundTrip(session, levelSource);
        /**
         * ⛓ THE DESPAWN CHECK, AT STOP (slice 5). A hand drive is a walk
         * like any other, so the declared removals owe the same account —
         * and STOP is where the walk is finished, which is what makes the
         * question answerable. ⚠ REPORTED, never thrown here: STOP's job is
         * to hand back what was driven, and a refusal that discarded the
         * session would lose a real walk over a bookkeeping disagreement.
         */
        let despawns = [];
        let despawnWhy = null;
        try { despawns = session.checkDespawns(); } catch (e) { despawnWhy = e.message; }
        window.__editorManual = {
            name,
            despawns,
            despawnWhy,
            ticks: session.tick,
            observations: session.observations.length,
            frames: trip.frames.length,
            roundTrip: trip.ok,
            faithful: trip.faithful,
            refusal: session.refusal,
            reproduced: trip.reproduced,
            mismatches: trip.mismatches,
            error: trip.error ? trip.error.message : null,
            inputs: trip.tape.inputs,
            clears: session.run.earnedClears.length,
        };
        $('status').className = trip.ok ? 'ok' : 'bad';
        $('status').textContent = `${name} — ${session.tick} tick(s) driven, folded into `
            + `${trip.tape.inputs.length} input span(s)`;
        // ⚠ THREE OUTCOMES, NOT TWO. A drive the run REFUSED is a legitimate
        // session whose tape legitimately refuses; calling that a broken
        // round trip would teach the next reader to ignore a red.
        $('detail').textContent = trip.ok
            ? `⛓ ROUND TRIP OK — the fold replays frame-for-frame: `
              + `${session.observations.length} observation(s) driven, `
              + `${trip.frames.length} frame(s) replayed, every position and every held `
              + 'set identical'
              + (trip.reproduced
                  ? `  ·  and the run's REFUSAL at tick ${session.refusal.tick} reproduced `
                    + 'identically'
                  : '')
            : `⛔ ROUND TRIP FAILED — ${trip.mismatches.length} mismatch(es): `
              + trip.mismatches.slice(0, 6).map(
                  (m) => `t${m.tick} ${m.what}: drove ${m.drove}, replayed ${m.replayed}`)
                  .join('  ·  ')
              + (trip.error ? `  ·  the replay threw: ${trip.error.message}` : '')
              + (session.refusal && !trip.error
                  ? `  ·  the DRIVE refused at tick ${session.refusal.tick} and the replay `
                    + 'did NOT — the fold lost the refusal'
                  : '');
        if (despawnWhy) {
            $('detail').textContent += `  ·  ⛔ DESPAWN CHECK REFUSED — ${despawnWhy}`;
        } else if (despawns.length) {
            $('detail').textContent += `  ·  DESPAWN CHECK: ${despawns.map((d) => `${d.id} `
                + `declared by ${d.at}${d.reproduced ? ` — the model removed it at ${d.t}`
                    : ' — NOT reproduced by this walk'}`).join('; ')}`;
        }

        // ⛓ And the tape is handed to the page's OWN REPLAY arm, so what you
        // scrub is what the stepper produced — not a picture of the drive.
        await replayTape(trip.tape, `${name} (manual fold)`, params, levelSource, null);
        // replayTape rewrites status/detail; the round-trip verdict is the
        // headline and goes back on top of it.
        $('detail').textContent = `${$('detail').textContent}\n`
            + (trip.ok ? '⛓ manual fold: round trip OK'
                : `⛔ manual fold: ROUND TRIP FAILED (${trip.mismatches.length})`);
    };

    $('status').textContent = `ready — level ${staging.boot.level} from ${origin}. `
        + 'Press START, then drive with the arrow keys and X/C.';
}

const manualRow = (k, v) => `<div class="r"><span>${k}</span><b>${v}</b></div>`;

/** Text into HTML. The ceremony strings are the game's, not this page's. */
const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * ⛓⛓⛓ GROUP B — RENDER THE CEREMONY TEXT, from the per-tick sample.
 *
 * ⛔ ONE RENDERER, BOTH ARMS, ONE CHANNEL. The complaint was about MANUAL
 * mode, and a box wired only into the manual arm would have been a second
 * reading the first time somebody scrubbed a REPLAY through a pickup. Both
 * arms already sample through `sampleMovers`, so both get this from one call.
 *
 * ⛔⛔ THE TYPED PREFIX AND THE REST ARE BOTH SHOWN, and the difference is the
 * whole content. `Game.talk()` types one character every `framesPerCharacter`
 * RENDER frames, and a release that lands before the page has finished typing
 * FAST-FORWARDS it instead of turning it — so "how far has this typed" is
 * precisely the state that decides what the next X release does. Showing only
 * the visible prefix would hide the page; showing only the whole page would
 * hide the type-out. Both, in two inks.
 *
 * ⚠ AND AN ABSENCE IS PRINTED, NOT HIDDEN, WHEN IT HAS A REASON WORTH READING.
 * A textless ceremony — a boss key, a totem part — freezes the screen for 150
 * frames with nothing to press, which looks exactly like a hang; that one gets
 * the box and the sentence. "No ceremony is running", the state of almost
 * every tick, hides the box instead: a permanent banner saying nothing is
 * happening is noise, and `dialogueAt`'s reason is still in the readout for
 * anything that asks.
 */
function renderDialogue(samples, cursor, level) {
    const box = $('dialogue');
    const d = dialogueAt(samples, cursor, level);
    if (!d.ceremony) {
        box.hidden = true;
        box.innerHTML = '';
        return d;
    }
    const c = d.ceremony;
    const who = `${c.tag ?? 'pickup'}${c.item ? ` → ${c.item}` : ''}`;
    if (!c.dialogue) {
        box.hidden = false;
        box.innerHTML = `<div class="meta">CEREMONY — ${esc(who)}</div>`
            + `<div class="why">${esc(d.why ?? '')}</div>`;
        return d;
    }
    const dl = c.dialogue;
    const rest = typeof dl.text === 'string' ? dl.text.slice(d.visible.length) : '';
    box.hidden = false;
    box.innerHTML = `<div class="meta">CEREMONY — ${esc(who)} — page ${dl.page + 1}`
        + ` of ${dl.pages}${dl.done ? ' — DONE' : ''}</div>`
        + `<div class="txt">${esc(d.visible)}<span class="rest">${esc(rest)}</span></div>`
        + `<div class="meta">typed ${dl.currentCharacter}/${dl.pageLength} chars`
        + ` (${dl.framesPerCharacter} frames each) — the page turns on an X RELEASE, and`
        + ' one that lands before the type-out finishes fast-forwards it instead</div>';
    return d;
}

// ── SOURCE = GENERATE (PROCGEN PoC slice 5) ──────────────────────────────

/**
 * The GENERATION trace, in its own pane beside the decision trace.
 *
 * ⛔ TWO PANES BECAUSE THERE ARE TWO TRACES, and they answer different
 * questions about different things. The decision trace is the SOLVER's, one
 * row per obstacle it reasoned about, indexed by TICK — which is why its rows
 * are clickable and light up as the scrubber passes them. A generation row is
 * an ATTEMPT: a template, an anchor, a verdict class and (⚖ §7.4) the
 * refusal's own verbatim text. It has no tick and nothing to seek to.
 * Rendering them in one list would need a row shape that is a superset of
 * both and true of neither.
 *
 * ⚠ THE REASON TEXT IS THE ROW'S BODY, not a tooltip. Trap 202: the danger
 * channel is empty on every success BY CONSTRUCTION, so the refusals are the
 * evidence channel — and evidence you have to hover to see is evidence
 * nobody reads.
 */
function mountGenerationPane(rows) {
    const box = $('genTrace');
    box.innerHTML = '';
    if (!rows.length) {
        const el = document.createElement('div');
        el.className = 'traceNone';
        el.textContent = 'no generation trace yet — this is the SKELETON, the bordered '
            + 'room and its goal before any template was drawn (⚖ the loop\'s own control)';
        box.appendChild(el);
        return { rows: 0 };
    }
    for (const r of rows) {
        const el = document.createElement('div');
        el.className = `tr past${r.outcome === 'KEPT' ? ' kept' : ''}`;
        // ⛓ THE INSTANCE LABEL, not the roster key — `wall-segment(ori=v,len=4)`
        // and `wall-segment(ori=h,len=2)` are two different obstacles.
        /**
         * ⛓ SLICE 3: THE ANCHOR WALK IS VISIBLE, ROW BY ROW. `r.label` already
         * carries the ordinal (`1.2a3`); this adds the DENOMINATOR beside the
         * cell, so a reader can tell a walk the BOUND stopped from a walk
         * LEGALITY stopped without counting rows.
         */
        el.innerHTML = `<b>${r.label}</b> <span class="s">${r.instance}</span>`
            + (r.at ? ` <span class="g">${r.at}</span>` : '')
            + (r.anchorsOffered > 1
                ? ` <span class="rj">anchor ${r.anchorTry}/${r.anchorsOffered}</span>` : '')
            + ` → <span class="${r.outcome === 'KEPT' ? 'g' : 'o'}">${r.outcome}</span>`
            + (r.verdict ? ` <span class="rj">${r.verdict}</span>` : '')
            + (r.ticks !== null ? ` <span class="rj">${r.ticks}t</span>` : '')
            + (r.classifiedBy ? `<div class="rj">by: ${r.classifiedBy}</div>` : '')
            + (r.reasonText ? `<div class="rj">${r.reasonText}</div>` : '');
        box.appendChild(el);
    }
    return { rows: rows.length };
}

/**
 * ── ⛓⛓⛓ THE CATALOGUE — ⚖ ruling 1's *"a list of things that can be
 * ── generated"*, on the page (slice 4) ────────────────────────────────
 *
 * One row per template, grouped by family, carrying the DECLARED parameter
 * schema (keys, domains, defaults and each parameter's own `why`) and the
 * template's `why` — and a checkbox, which is verb 1: the sub-roster this run
 * may draw from.
 *
 * ⛔ **THE EXCLUDED ROWS ARE IN IT, GREYED, WITH `cause` + `measured` +
 * `wouldNeed` VERBATIM.** They are not selectable and carry no input, because
 * there is nothing to draw — but a catalogue of "what can be generated" that
 * hid what CANNOT, and why, is the graceful-skip shape: the reader would read
 * a short list as the whole answer. The text is the palette's own, character
 * for character (trap 202's channel: the measurement IS the content).
 *
 * ⛔ **BUILT FROM THE ROSTER** (trap 199): `catalogueRows` derives the groups,
 * the order and the totals from `palette.templates` / `palette.excluded`, so
 * nothing here counts anything, and a template added to the table appears
 * without an edit on this side.
 *
 * ⚠ THE CHECKBOX CARRIES `data-template` = THE BASE NAME, which is the roster
 * key the restriction is spelled in and the key the pin union looks up — never
 * the instance label, which is a geometry and not a roster entry.
 */
function mountCatalogue(catalogue, selected, onAttempt = null, onArm = null) {
    const box = $('genRoster');
    box.innerHTML = '';
    const dom = (p) => `${p.key} ∈ {${p.domain.join(',')}} (default ${p.default})`;
    /**
     * ⛓⛓⛓ VERB 2's PER-ROW FORM (slice 5) — built FROM the row's own declared
     * schema, which the catalogue row already carries (slice 4's residue: the
     * `params` array rides on each row with its domains, defaults and `why`).
     * ⛔ NO SECOND LOOKUP: a form that re-fetched the template to learn its
     * parameters would be a second answer to "what can this template be asked".
     *
     * ⛓ **THE `any` OPTION IS THE FREE LOOP'S OWN BEHAVIOUR**, offered by hand:
     * leave the value to the seeded stream. What the directive then RECORDS is
     * the DRAWN value, never the word "any" — so a copied link names a concrete
     * instance and reproduces it without re-drawing. (That is only safe because
     * a directive's parameter draw and its anchor walk are SEPARATE streams —
     * see `watchGenerate.directiveSeed`.)
     */
    const mountForm = (row, t) => {
        if (!onAttempt) return;
        const form = document.createElement('div');
        form.className = 'catForm';
        const selects = new Map();
        for (const p of t.params) {
            const sel = document.createElement('select');
            sel.dataset.param = p.key;
            const anyOpt = document.createElement('option');
            anyOpt.value = '';
            anyOpt.textContent = `${p.key}: any (draw it)`;
            sel.appendChild(anyOpt);
            for (const v of p.domain) {
                const o = document.createElement('option');
                o.value = String(v);
                o.textContent = `${p.key}=${v}`;
                // ⛔ PRE-FILLED FROM THE DECLARED DEFAULT, which `defineTemplate`
                // already checks is IN the domain — so the form cannot offer an
                // illegal value, and the check lives where the schema is.
                if (v === p.default) o.selected = true;
                sel.appendChild(o);
            }
            selects.set(p.key, sel);
            form.appendChild(sel);
        }
        /**
         * ⚠ READ AT THE PRESS, like every other control on this panel
         * (`readForm`'s law). An empty value means "any" and is simply left out
         * of the overrides, so `instantiate` draws it.
         *
         * ⛓ SLICE 6 MADE IT A THUNK, and the reason is which press. ATTEMPT
         * commits immediately, so its press IS the moment; AT… only ARMS, and
         * the moment the attempt happens is the CLICK — so the click calls
         * this, and a select moved between arming and clicking is honoured.
         * One reading rule, applied at the instant each control actually acts.
         */
        const readParams = () => {
            const params = {};
            for (const [key, sel] of selects) {
                if (sel.value === '') continue;
                const p = t.params.find((q) => q.key === key);
                params[key] = p.domain.find((v) => String(v) === sel.value);
            }
            return params;
        };
        const go = document.createElement('button');
        go.textContent = 'ATTEMPT this';
        go.dataset.attempt = t.name;
        go.onclick = () => onAttempt(t.name, readParams());
        form.appendChild(go);
        /**
         * ⛓⛓⛓ SLICE 6 — AT…, ⚖ ruling 6's manual half. It ARMS a canvas
         * click; the clicked TILE becomes the explicit anchor of ONE directed
         * attempt at exactly that cell. ⛔ It exists on SELECTABLE rows only,
         * for the same reason ATTEMPT and the checkbox do: there is nothing on
         * an excluded row to place.
         */
        if (onArm) {
            const at = document.createElement('button');
            at.dataset.arm = t.name;
            at.textContent = 'AT… a clicked tile';
            at.onclick = () => onArm(t.name, readParams);
            form.appendChild(at);
        }
        const cost = document.createElement('span');
        cost.className = 'cost';
        // ⛔ THE CEILING, BEFORE THE PRESS — the same discipline `#genNote`
        // applies to the ladder, from the same arithmetic (`directedCost`).
        // ⛓ BOTH CEILINGS, because AT… is a walk of ONE cell and costs a
        // different number: a row that printed only the search's would be
        // quoting a bound the clicked attempt never runs under.
        cost.textContent = ` ≤ ${directedCost(DIRECTED_ANCHOR_TRIES, 139).solves} solve(s) `
            + `(bound ${DIRECTED_ANCHOR_TRIES} + 1 display) · AT… costs `
            + `${directedCost(1, 139).solves} (one cell + 1 display)`;
        form.appendChild(cost);
        row.appendChild(form);
    };
    for (const g of catalogue.groups) {
        const fam = document.createElement('div');
        fam.className = 'catFamily';
        const head = document.createElement('div');
        head.className = 'catHead';
        head.textContent = `family ${g.family} — ${g.templates.length} template(s)`
            + (g.excluded.length ? `, ${g.excluded.length} EXCLUDED` : '');
        fam.appendChild(head);
        for (const t of g.templates) {
            const row = document.createElement('div');
            row.className = 'catRow';
            const label = document.createElement('label');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.dataset.template = t.name;
            cb.checked = selected.has(t.name);
            label.appendChild(cb);
            const name = document.createElement('b');
            name.textContent = ` ${t.name}`;
            label.appendChild(name);
            row.appendChild(label);
            const schema = document.createElement('div');
            schema.className = 'rj';
            schema.textContent = t.params.length
                ? `params: ${t.params.map(dom).join(' · ')}`
                : 'params: none — one instantiation, the degenerate case';
            row.appendChild(schema);
            for (const p of t.params) {
                const w = document.createElement('div');
                w.className = 'rj';
                w.textContent = `${p.key}: ${p.why}`;
                row.appendChild(w);
            }
            if (t.why) {
                const w = document.createElement('div');
                w.className = 'rj';
                w.textContent = t.why;
                row.appendChild(w);
            }
            mountForm(row, t);
            fam.appendChild(row);
        }
        for (const e of g.excluded) {
            const row = document.createElement('div');
            row.className = 'catRow excluded';
            const name = document.createElement('b');
            name.textContent = `⛔ ${e.name}`;
            row.appendChild(name);
            // ⛔ VERBATIM, all three fields, and `textContent` so the palette's
            // own text cannot be reinterpreted as markup on the way through.
            for (const [what, text] of [['cause', e.cause], ['measured', e.measured],
                ['would need', e.wouldNeed]]) {
                if (!text) continue;
                const d = document.createElement('div');
                d.className = 'rj';
                d.textContent = `${what}: ${text}`;
                row.appendChild(d);
            }
            fam.appendChild(row);
        }
        box.appendChild(fam);
    }
    return {
        groups: catalogue.groups.length,
        templates: catalogue.counts.templates,
        excluded: catalogue.counts.excluded,
        boxes: box.querySelectorAll('input[type=checkbox]').length,
        // ⛓ SLICE 5: one ATTEMPT button per SELECTABLE row — the excluded rows
        // carry no form for the same reason they carry no checkbox (there is
        // nothing to draw), and the row asserts that from the roster.
        attemptButtons: box.querySelectorAll('button[data-attempt]').length,
        // ⛓ SLICE 6: one AT… per SELECTABLE row, on the same terms.
        armButtons: box.querySelectorAll('button[data-arm]').length,
        paramSelects: box.querySelectorAll('select[data-param]').length,
    };
}

/**
 * ── ⛓⛓⛓ THE DIRECTIVES APPLIED TO THE LEVEL ON SCREEN (slice 5) ───────
 *
 * ⚖ The user's ruling, on the page: the readout says **which kind of keep it
 * was** — `kept:discharged` against `kept:solved-only` — and how many anchors
 * were walked. ⛔ The wording is `watchGenerate.describeKeptKind`'s, ONE
 * spelling shared with the CLI, so the two cannot describe one outcome two
 * ways; and a template with NO verb to discharge says that BY NAME rather than
 * appearing to have fallen short of something.
 *
 * ⛔ A REFUSED directive is a row too, with its VERBATIM text — the four
 * outcomes are never blurred into "it didn't work" (RAW TRUTH), and a
 * directive that refused is exactly the row a reader is looking for.
 */
function mountDirectives(directives) {
    const box = $('genDirectives');
    box.innerHTML = '';
    for (const [i, d] of (directives ?? []).entries()) {
        const el = document.createElement('div');
        el.className = 'dRow';
        const kept = d.outcome === 'KEPT';
        el.innerHTML = `<b>d${i + 1}</b> <span class="s">${d.instance}</span>`
            + (d.at ? ` <span class="g">(${d.at.tx},${d.at.ty})</span>` : '')
            + ` → <span class="${kept ? 'g' : 'o'}">${d.outcome}</span>`;
        const why = document.createElement('div');
        why.className = 'rj';
        /**
         * ⛔ `textContent`, so the palette's and the solver's own text cannot be
         * reinterpreted as markup on the way through.
         *
         * ⛓⛓ SLICE 6: a CLICKED directive says so, and it does NOT say
         * *"walked 1 of 1 legal anchor(s)"* — the named cell may be exactly the
         * one the model refused, and `at` alone cannot tell *the search found
         * this* from *somebody named it*.
         */
        why.textContent = (kept ? describeKeptKind(d) : '')
            + (kept ? ' · ' : '')
            + (d.anchor
                ? `the EXPLICIT anchor (${d.anchor.tx},${d.anchor.ty}) — a CLICK, not a `
                    + 'search: ONE named cell, adjudicated by the model before any solve, '
                    + `policy ${d.keepPolicy}`
                : `walked ${d.anchorsWalked} of ${d.anchorsOffered} legal anchor(s), `
                    + `bound ${d.bound}, policy ${d.keepPolicy}`);
        el.appendChild(why);
        box.appendChild(el);
    }
    return { rows: (directives ?? []).length };
}

/**
 * ⛓⛓ SLICE 11 — THE EDIT LOG, one row per recorded op.
 *
 * ⛔ ITS OWN CONTAINER (`#genEdits`), for the reason `#genRoster` and
 * `#genDirectives` have theirs: `#layers` and `#bootForm` are ENUMERATED by
 * acceptance rows, and an edit row is neither a layer nor a boot flag. The
 * generation trace keeps the generation rows — an edit is not an attempt and
 * has no verdict.
 *
 * ⛔ `textContent` on the row, so an entity type somebody typed cannot be
 * reinterpreted as markup on the way through.
 */
function mountEdits(edits) {
    const box = $('genEdits');
    box.innerHTML = '';
    for (const [i, op] of (edits ?? []).entries()) {
        const el = document.createElement('div');
        el.className = 'eRow';
        const n = document.createElement('b');
        n.textContent = `e${i + 1}`;
        el.appendChild(n);
        const text = document.createElement('span');
        text.className = 'et';
        text.textContent = ` ${describeEdit(op)}`;
        el.appendChild(text);
        box.appendChild(el);
    }
    return { rows: (edits ?? []).length };
}

/**
 * ── ⛓⛓⛓ THE FOURTH SOURCE: GENERATE ONE, LOOK AT IT, KEEP STEPPING ─────
 *
 * ⚖ Kickoff §3.5 and ruling §1.3: seed + biome + obstacle-count target (+
 * budget) → the Cloudberry loop runs IN THE PAGE. STEP places one template
 * and re-solves; RUN-ALL runs to the target or to saturation, and the display
 * updates after EVERY placement — the current level drawn, the LATEST SOLVE's
 * path layers over it, and the verdict / kept-or-reverted template / verbatim
 * refusal as pane rows.
 *
 * ⛔ ALL THREE OF THE PAGE'S LAWS SURVIVE IT, and each bites somewhere:
 *
 * NO CLAIM: a generated level is never written to `fixtures/` (the roster is
 * disk-derived, so a saved experiment would silently join the differential).
 * It lives in the box, in a download and in your hands. No gate consumes it —
 * the acceptance batch runs the same loop from a script.
 *
 * RAW TRUTH: the loop's refusals arrive VERBATIM; a saturated run says
 * SATURATED and names the bound that ended it; a `?gen=` payload that
 * disagrees with what this page generated is REPORTED rather than redrawn;
 * and the display solve is compared against the trace row that accepted the
 * record, because "they must agree" is a claim and not an excuse to skip it.
 *
 * NO PRIVATE TICK LOOP: the walk is `solveSegment`'s, folded by the one fold,
 * scrubbed by the one stepper — `replayTape`, unchanged, exactly as SOLVE and
 * MANUAL reach it. ⛓ WITH ONE OPTION: the scrub is told the tape came from a
 * SCRATCH solve (§13.4's residue; see `createTapeStepper`'s docblock). That
 * is the one caller in the codebase that passes it.
 *
 * ⛔ AND NO SECOND GENERATOR LOOP. STEP is "obstacleTarget = k, re-run" —
 * see `watchGenerate`'s docblock for the prefix property that makes it sound
 * and for the O(N²) price it costs, which is stated before it is spent.
 */
async function runGenerate(params, lifetime) {
    const gp = params.gen;
    let seed = gp.seed;
    let biome = gp.biome;
    let bounds = { ...gp.bounds };
    const budget = { ...gp.budget };
    /**
     * ⛓⛓ CONSTRUCTIVE-MODE SLICE 5 — THE ROOM THE LADDER IS BUILT IN. Read at
     * the press like the seed and the biome (`readForm`), and a change RESETS
     * the ladder for the same reason a changed seed does: step 3 of a
     * `winding` room and step 4 of an `open` one are not two rungs of one run.
     */
    let skeleton = { ...gp.skeleton };
    /**
     * ── ⛓⛓⛓ ARC 3, SLICE 5a (D1) — THE THREE PARAMETERS, AS PAGE STATE ─────
     *
     * ⛔ `elements` IS `undefined` WHEN NOBODY SAID, and that is not a
     * placeholder: `seedlingSeam` reads `undefined` as *apply the BIOME
     * DEFAULT* and an explicit `{name:'none'}` as *turn it off* (4c §13.3). A
     * page that spelled the absence as `null` or `{name:'none'}` would silently
     * disable the default on every load.
     *
     * ⛓⛓⛓ **THEY HAVE FORM CONTROLS SINCE R9 SLICE 0** (`#genElements` +
     * `#genElementParams`, `#genAreas` + `#genAreaParams`, `#genRequire`) —
     * the note that stood here said *"no form controls THIS SLICE"* and named
     * the user's standing item; the item is paid. ⛔ Nothing else moved: the
     * reader still resolves them, the ONE writer still spells them and the
     * state still carries their REPORTS. These locals are the CALLER's ask —
     * `undefined` for `elements` still means *nobody said* — and the controls
     * below are read at the PRESS into exactly them.
     */
    let elements = gp.elements;
    let areas = gp.areas;
    let require = gp.require;
    /**
     * ⛓⛓⛓ PROCGEN ELEMENTS arc 5, slice 1 — **THE ROOM CONTRACT**, ⚖ rulings 1
     * and 2. The reader resolves `?width=`/`?height=`/`?fill=` and the ONE
     * writer spells them back off the STATE — ⛓⛓ and since R9 slice 0 they have
     * CONTROLS too (`#genWidth`/`#genHeight`/`#genFill`), which is the parked
     * form-controls line paid. ⛔ The writer is unchanged: it still deletes
     * width/height IN PLACE at the pinned 10x10 and `fill` at `dense`, so a
     * default room's bar stays byte-identical to every link ever copied off
     * this page.
     */
    let size = gp.size;
    let fill = gp.fill;

    /**
     * ⛓ `?gen=` — a payload emitted by `generate-seedling-level.mjs`, whose
     * seed/biome/count REPLACE the URL's. The page then generates and
     * COMPARES (⚖ `agreementWithPayload`): one path into the page, and the
     * export becomes a cross-runtime determinism check rather than a picture
     * of a file.
     */
    let payload = null;
    /**
     * ⛓ SLICE 4 — VERB 1. `null` is the whole roster; otherwise the normalized
     * `{axis, names}`. ⚠ It is read at PRESS from the catalogue's checkboxes
     * (`readForm`'s law) and written back by the ONE writer, like every other
     * control on this panel.
     */
    let roster = gp.roster;
    /**
     * ⛓ Set once, when a press takes the URL back off `?gen=` — so the detail
     * line can say the reproduction claim GONE rather than just stop printing
     * it. See `writeGenerateParams`' docblock for why the two cannot coexist.
     */
    let payloadDropped = false;
    /**
     * ⛓⛓⛓ SLICE 5 — VERB 2. ⛔ THERE IS NO LOCAL COPY OF THE DIRECTIVE LIST:
     * `state.directives` is the one source of truth, because it is what
     * `applyDirective` RETURNED and therefore what the record on screen was
     * really built from. A mirror beside it would be the two-spellings failure
     * mode with the page's own identity in it.
     *
     * ⛓⛓ SLICE 12 — AND THEY COME FROM THE **PAYLOAD** NOW, not from the bar
     * (⚖ §3.9). These are the directives a `?gen=` / `procgenLab:load` must
     * replay after the ladder reaches its target. ⛔ Applied through the SAME
     * `applyDirective` a press uses, AT THE SAME INDICES — a payload's
     * `directives` array order IS the index, so nothing is re-indexed and
     * `directiveSeed`'s index-as-salt keeps meaning what it meant.
     *
     * ⚠ A RECORDED directive is a superset of a spec, and the part that matters
     * is that its `params` are the RESOLVED values: a replay therefore spends
     * NO draw where the original spent one, which is what the two salted
     * streams exist for and what makes the reproduction byte-exact.
     */
    let pendingDirected = null;
    /**
     * ⛓⛓ SLICE 4 — A HOST'S `procgenLab:load`, WHERE THE FETCH WOULD HAVE BEEN.
     * ⛔ ONE RECONSTRUCTION: the object replaces the fetch's RESULT and nothing
     * downstream knows the difference, so a SEND from the panel re-derives the
     * level and reports agreement exactly as `?gen=` does. See
     * `watchBridge.js`'s docblock — this page has never had a second path.
     */
    const handed = takePendingHostPayload();
    if (handed || gp.gen) {
        payload = handed ?? await fetchJson(gp.gen.startsWith('/') ? gp.gen : `/${gp.gen}`,
            'the generated payload');
        seed = payload.seed;
        biome = payload.biome;
        bounds = { ...bounds, ...(payload.bounds ?? {}) };
        /**
         * ⛔ AND THE PAYLOAD'S OWN ROSTER WITH THEM. The `?gen=` path
         * REGENERATES from the payload's identity and compares; a payload made
         * under a RESTRICTION but reproduced under the whole roster would
         * report a level DIVERGENCE whose real cause is that the page asked a
         * different question — a false finding fired by the check that exists
         * to catch real ones. ⚠ `?? null` because a payload written before
         * this field existed names no roster, which IS what an unrestricted
         * run has.
         */
        roster = payload.roster ?? null;
        /**
         * ⛓⛓⛓ SLICE 12 — THE PAYLOAD IS THE DIRECTIVE CHANNEL. ⚠ `?? null`
         * because a payload written before slice 5 names none, and "no
         * directives" is exactly what a plain ladder run has.
         */
        pendingDirected = payload.directives ?? null;
        /**
         * ── ⛓⛓⛓ SLICE 5a (D1) — **THE PAYLOAD'S OWN THREE SPECS**, for the
         * ── reason the roster and the directives are already adopted: `?gen=`
         * ── REGENERATES and compares, so a payload made WITH a kill gate and
         * ── reproduced under a different element spec would report a level
         * ── divergence whose real cause is that a different run was asked for.
         *
         * ⛔ **EACH IS READ IN ITS OWN SPELLING** (see `agreementWithPayload`):
         * `elements.spec` is the normalized OBJECT and `areas.spec` is ALREADY
         * A STRING (`areaSummaryOf` formats it) — arc-2 §11.5's *"a REPORT, not
         * a SPEC"* asymmetry, which this slice READS rather than fixes because
         * unifying it would move `summary` on every committed payload.
         *
         * ⚠ `undefined` IS PRESERVED: a payload with no `elements` block asked
         * for no element, and on a pre-4c file that is the truth. A payload
         * whose block IS there hands its spec straight back.
         *
         * ⛓ AND THE SKELETON WITH THEM — a carved payload reproduced in the
         * open room would have reported a `level` divergence with a `skeleton`
         * one beside it, which is two findings for one cause.
         */
        if (payload.skeleton) skeleton = seedlingSkeletonSpec(payload.skeleton);
        /**
         * ⛓⛓ ARC 5, SLICE 1 — **THE ROOM CONTRACT COMES OFF THE PAYLOAD TOO**,
         * for the skeleton's own reason: a payload built at 20x12 and
         * reproduced at the default 10x10 reports a LEVEL divergence whose real
         * cause is a different ROOM. ⛔ The SIZE is read off `payload.level` —
         * the record IS the room, and every payload has always carried it, so
         * even a file written before this slice reproduces at its own size.
         */
        if (payload.level) {
            size = { width: payload.level.width, height: payload.level.height };
        }
        if (payload.fill) fill = payload.fill;
        if (payload.summary?.elements) elements = payload.summary.elements.spec;
        if (payload.summary?.areas) areas = parseAreaSpec(payload.summary.areas.spec);
        if (payload.summary?.require) require = [...payload.summary.require.asked];
    }

    $('genSeed').value = String(seed);
    $('genCount').value = String(bounds.obstacleTarget);
    $('genTries').value = String(bounds.triesPerStep);
    $('genK').value = String(bounds.saturationK);
    $('genAnchorTries').value = String(bounds.anchorTriesPerCandidate);
    const biomeSel = $('genBiome');
    biomeSel.innerHTML = BIOME_NAMES
        .map((b) => `<option value="${b}">${b}</option>`).join('');
    biomeSel.value = biome;

    /**
     * ── ⛓⛓⛓ CONSTRUCTIVE-MODE SLICE 5 — THE SKELETON SELECTOR ──────────
     *
     * ⚖ Ruling 2's vocabulary, as a control. The kinds this binding OFFERS are
     * selectable; the ones it cannot run (`classic`, `corridor` — they need the
     * maze simulator) are listed DISABLED with the reason in their tooltip
     * rather than hidden, because a list that silently dropped them could not
     * answer *"why can't I pick that?"* — the same argument the catalogue's
     * greyed exclusion rows already make.
     *
     * ⛔ IT IS NOT IN THE ROSTER BOX. The roster is what a RUN MAY DRAW FROM
     * (a set, sampled, one checkbox per member); the kind is the room the run
     * starts IN (exactly one, chosen, its own parameter). A kind with a
     * checkbox would mean something the loop never asks.
     */
    const skeletonSel = $('genSkeleton');
    skeletonSel.innerHTML = '';
    for (const row of skeletonCatalogue({ simulator: false })) {
        const opt = document.createElement('option');
        opt.value = row.kind;
        opt.textContent = `${row.kind}${row.isDefault ? ' (the open room)' : ''}`;
        opt.disabled = !row.offered;
        opt.title = row.offered ? row.description : `unavailable here — needs ${row.why}`;
        skeletonSel.appendChild(opt);
    }
    skeletonSel.value = skeleton.kind;

    /**
     * ── ⛓⛓⛓ SLICE 7 — THE KIND'S PARAMETERS, AS A FORM ─────────────────
     *
     * ⛔ MOUNTED FROM THE CATALOGUE'S OWN SCHEMA, so this page keeps no second
     * list of what a kind takes: the options ARE the declared domain and the
     * pre-selection IS the declared default, which is why a control here cannot
     * offer a value `parseSkeleton` would refuse.
     *
     * ⛔ AND IT IS RE-MOUNTED AT DEFAULTS ON EVERY KIND CHANGE, not merged.
     * `minRoom` is `rooms`' knob and `prune` is `bushy`'s; carrying a value
     * across a kind change would either refuse at the next press or silently
     * drop — and a form holding a setting the selected kind does not have is a
     * control that writes state nobody reads.
     *
     * ⚠ There is no "any (draw it)" option, unlike the template form: a
     * template parameter may be DRAWN, a room parameter is CHOSEN. The room is
     * one thing, in force, named by the link.
     */
    const skeletonParamBox = $('genSkeletonParams');
    const mountSkeletonParams = (kind, values = {}) => {
        skeletonParamBox.innerHTML = '';
        const row = skeletonCatalogue({ simulator: false }).find((r) => r.kind === kind);
        for (const p of row?.params ?? []) {
            const label = document.createElement('label');
            label.textContent = `${p.key} `;
            label.title = p.why;
            const sel = document.createElement('select');
            sel.dataset.skelParam = p.key;
            for (const v of p.domain) {
                const o = document.createElement('option');
                o.value = String(v);
                o.textContent = String(v);
                if (v === (values[p.key] ?? p.default)) o.selected = true;
                sel.appendChild(o);
            }
            label.appendChild(sel);
            skeletonParamBox.appendChild(label);
        }
    };
    /**
     * ⛔ THE READ IS TYPED FROM THE DOMAIN, never from the string. A `<select>`
     * hands back `"2"`; the state, the payload and the URL all carry the number
     * 2, and a page that put the string on the state would diverge from its own
     * payload on a field that says the same thing.
     */
    const readSkeletonParams = (kind) => {
        const out = {};
        const row = skeletonCatalogue({ simulator: false }).find((r) => r.kind === kind);
        for (const p of row?.params ?? []) {
            const sel = skeletonParamBox.querySelector(`select[data-skel-param="${p.key}"]`);
            if (!sel) continue;
            const v = p.domain.find((d) => String(d) === sel.value);
            if (v !== undefined) out[p.key] = v;
        }
        return out;
    };
    mountSkeletonParams(skeleton.kind, skeleton.params ?? {});
    /**
     * ⛔ THROUGH `lifetime.on`, LIKE EVERY OTHER CONTROL ON THIS PANEL — a bare
     * `addEventListener` survives a panel retire and the next mount adds a
     * second one (the leak this page's SubscriptionTracker exists for).
     */
    lifetime.on(skeletonSel, 'change', () => mountSkeletonParams(skeletonSel.value));

    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ SEEDLING BOT R9, SLICE 0 — **THE SIX URL-ONLY PARAMETERS, AS
     * ⛓⛓⛓ CONTROLS**: `?width=` `?height=` `?fill=` `?areas=` `?require=`
     * ⛓⛓⛓ `?elements=`
     * ══════════════════════════════════════════════════════════════════
     *
     * ⚖ The user's standing form-controls item (arc-3 §16.9(9), arc-5 D5).
     * ⛔ **THIS ADDS NO PARAMETER.** The reader (`readGenerateParams`) and the
     * ONE writer (`writeGenerateParams`) have owned all six since arc-3 slice
     * 5a / arc-5 slice 1 — §8.6's standing law is that every control arrives
     * WITH its parameter in the one writer, and here the parameters arrived
     * first. So the writer does NOT change, and the identity of every
     * committed artifact is untouched by construction.
     *
     * ⛔ **OPTIONS FROM THE CODEC'S OWN DOMAINS, NEVER A SECOND LIST** — the
     * maze lab's law (`mazeLabView.js:1493`), one substrate over: `FILL_MODES`,
     * `KEYS_DOMAIN`, `AREA_PARAM_SCHEMA`, `ELEMENT_NAMES`, `paramSchemaFor`,
     * and `assertRoomSize`'s own `[3..60]` on the two number inputs. A
     * hand-typed list here would be a second vocabulary and the reader would
     * meet whichever one drifted.
     *
     * ⛔ **READ AT THE PRESS** by `readForm()` (this page's law 1), never
     * cached; the URL is written ONLY in `show()`, through the one writer,
     * FROM THE STATE. A changed one RESETS the ladder to step 0 with the
     * reason said in the status line — every one of the six is run-defining
     * (⚖ §6 Q3's default; the alternative, the maze's immediate
     * `change → goTo(0)` regenerate, is named in the as-built).
     */
    const fillSel = $('genFill');
    fillSel.innerHTML = '';
    for (const mode of FILL_MODES) {
        fillSel.appendChild(new Option(
            `${mode}${mode === FILL_DENSE ? ' (every cell — the pinned default)' : ''}`, mode));
    }
    $('genWidth').min = String(ROOM_TILES_MIN);
    $('genWidth').max = String(ROOM_TILES_MAX);
    $('genHeight').min = String(ROOM_TILES_MIN);
    $('genHeight').max = String(ROOM_TILES_MAX);

    const areasSel = $('genAreas');
    areasSel.innerHTML = '';
    for (const k of KEYS_DOMAIN) {
        areasSel.appendChild(new Option(`${k}${k === 0 ? ' (off)' : ''}`, String(k)));
    }
    /** ⛓ The area spec's parameters, from the codec's own schema — the options
     *  ARE the declared domain and the pre-selection IS the declared default,
     *  exactly as the skeleton's form is. */
    const mountAreaParams = (values = {}) => {
        const box = $('genAreaParams');
        box.innerHTML = '';
        for (const p of AREA_PARAM_SCHEMA) {
            const label = document.createElement('label');
            label.textContent = `${p.key} `;
            label.title = p.why;
            const sel = document.createElement('select');
            sel.dataset.areaParam = p.key;
            for (const v of p.domain) {
                const o = new Option(String(v), String(v));
                if (v === (values[p.key] ?? p.default)) o.selected = true;
                sel.appendChild(o);
            }
            label.appendChild(sel);
            box.appendChild(label);
        }
    };
    /** ⛔ TYPED FROM THE DOMAIN — a `<select>` hands back a string, and the
     *  state, the payload and the URL all carry the number. */
    const readAreaParams = () => {
        const out = {};
        for (const p of AREA_PARAM_SCHEMA) {
            const sel = $('genAreaParams').querySelector(`select[data-area-param="${p.key}"]`);
            if (!sel) continue;
            const v = p.domain.find((d) => String(d) === sel.value);
            if (v !== undefined) out[p.key] = v;
        }
        return out;
    };

    const elementsSel = $('genElements');
    elementsSel.innerHTML = '';
    /**
     * ⛓⛓⛓ **THE THIRD STATE, AND IT IS FIRST IN THE LIST.** `(biome default)`
     * ≡ `undefined` ≡ *nobody said*, which `seedlingSeam` resolves through
     * `defaultElementsFor(items)`. ⛔ The maze's control has only two states
     * because the maze's default IS `none`; a Seedling control that copied it
     * would spell `none` on every load and silently turn the biome default off
     * — and the two default-stream identities (`7f1e99ba…` / `b020ef81…`) are
     * what would move. The mutant that writes `none` here is built and
     * measured in the as-built rather than argued about.
     */
    elementsSel.appendChild(new Option(
        '(biome default) — nobody said, so the BIOME\'s own spec runs',
        ELEMENTS_CONTROL_DEFAULT));
    for (const name of ELEMENT_NAMES) {
        elementsSel.appendChild(new Option(
            `${name}${name === ELEMENTS_NONE ? ' (off — no element is constructed)' : ''}`,
            name));
    }
    /**
     * ⛓ THE HEAD'S PARAMETERS, from `paramSchemaFor` — the element's own
     * `params` plus the binding's `binds`, and there is no third source.
     *
     * ⛓⛓ IT HAS AN `any (draw it)` OPTION AND THE AREA FORM DOES NOT, which is
     * the one place these two forms differ: for an element a parameter the
     * caller NAMES is an override that spends NO draw and one they omit is
     * DRAWN, so `guard` and `guard;len=3` are different runs even when `len`
     * comes out 3 (`elementSpec.namedParams`). A form with no way to say "draw
     * it" could only ever produce the first kind.
     */
    const mountElementParams = (name, values = {}) => {
        const box = $('genElementParams');
        box.innerHTML = '';
        if (!name || name === ELEMENTS_CONTROL_LIST) return;
        for (const p of paramSchemaFor(name)) {
            const label = document.createElement('label');
            label.textContent = `${p.key} `;
            label.title = p.why;
            const sel = document.createElement('select');
            sel.dataset.elemParam = p.key;
            sel.appendChild(new Option('any (draw it)', ''));
            for (const v of p.domain) {
                const o = new Option(String(v), String(v));
                if (String(v) === String(values[p.key])) o.selected = true;
                sel.appendChild(o);
            }
            label.appendChild(sel);
            box.appendChild(label);
        }
    };
    /** ⛔ TYPED FROM THE DOMAIN, and an UNSET select contributes NOTHING —
     *  which is exactly how *draw this one* is spelled in the spec. */
    const readElementParams = (name) => {
        const out = {};
        for (const p of paramSchemaFor(name)) {
            const sel = $('genElementParams').querySelector(`select[data-elem-param="${p.key}"]`);
            if (!sel || sel.value === '') continue;
            const v = p.domain.find((d) => String(d) === sel.value);
            if (v !== undefined) out[p.key] = v;
        }
        return out;
    };
    /**
     * ⛓⛓ **THE `+` LIST THIS PAGE WAS LOADED WITH, AND IT IS READ-ONLY.** A
     * list is a DISTRIBUTION over two or more heads; a `<select>` option per
     * subset is not a vocabulary anybody can act on, so the control does not
     * offer one — it SHOWS the list it was handed, under a sentinel whose
     * label names it verbatim, and `elementsFromControl` gives that sentinel
     * back the very spec it displays. ⇒ a press that leaves the control alone
     * KEEPS the list, and the option can never mean something the page is not
     * holding.
     */
    let urlElementList;
    let elementListOption = null;
    const showElementList = (spec) => {
        if (elementListOption) { elementListOption.remove(); elementListOption = null; }
        if (!spec) return;
        elementListOption = new Option(
            `(list: ${formatElementSpec(spec)} — from the URL)`, ELEMENTS_CONTROL_LIST);
        elementsSel.insertBefore(elementListOption, elementsSel.firstChild);
    };
    /**
     * ⛓ `fillForm()`'s Seedling half — ON LOAD THE CONTROLS SHOW THE URL'S
     * VALUES, including the biome-default state when `?elements=` is absent.
     * ⛔ Called AFTER the `?gen=` payload block above has had its say, so a
     * payload's own room and specs are what the form shows.
     */
    const fillGenerateControls = () => {
        $('genWidth').value = String(size.width);
        $('genHeight').value = String(size.height);
        fillSel.value = fill;
        areasSel.value = String(areas?.keys ?? 0);
        mountAreaParams(areas?.params ?? {});
        $('genRequire').value = formatRequireList(require);
        urlElementList = isElementList(elements) ? elements : undefined;
        showElementList(urlElementList);
        elementsSel.value = elementsControlValue(elements);
        mountElementParams(
            isElementList(elements) || elements === undefined ? null : elements.name,
            elements?.params ?? {},
        );
    };
    fillGenerateControls();
    /**
     * ⛔ THE TWO SUB-FORMS ARE RE-MOUNTED AT DEFAULTS ON A HEAD CHANGE, never
     * merged — the skeleton form's own measured lesson: a `len` select left
     * standing from `guard` would be handed to a head that does not declare it
     * and the press would refuse. ⛓ Through `lifetime.on` like every other
     * listener on this panel; a bare `addEventListener` survives a panel retire
     * and the next mount adds a second one.
     */
    lifetime.on(elementsSel, 'change', () => {
        const v = elementsSel.value;
        mountElementParams(
            v === ELEMENTS_CONTROL_DEFAULT || v === ELEMENTS_CONTROL_LIST ? null : v);
    });
    lifetime.on(areasSel, 'change', () => mountAreaParams());

    /**
     * ── ⛓⛓⛓ THE CATALOGUE, AND VERB 1's ONE CONTROL ───────────────────
     *
     * The view is the WHOLE biome roster (plus its exclusions); the CHECKBOXES
     * are the restriction. ⛔ The two are separate on purpose: a catalogue that
     * showed only the selected sub-roster could not be used to widen it again,
     * and the exclusions would vanish exactly when a reader is asking "why
     * can't I pick that?".
     */
    /**
     * ⛔ DECLARED **BEFORE** THE CATALOGUE BLOCK, and the reason is measured:
     * `updateRunButtons` runs at mount — before any generation — and slice 5
     * made it read `state.directives` (the ladder-reset law lives in the ONE
     * writer of the buttons' state). With these declared below, that mount-time
     * call hit the temporal dead zone and threw *"Cannot access 'state' before
     * initialization"*, taking the whole arm down before it drew anything. ⛓ The
     * acceptance row caught it; `state?.` does NOT help, because the TDZ throws
     * on the REFERENCE, not on the property access.
     */
    let step = 0;
    let state = null;
    let lastPayload = null;
    /**
     * ⛓⛓⛓ SLICE 6 — THE ARMED CLICK. ⛓⛓ SLICE 11 GAVE IT A SECOND KIND rather
     * than a second variable:
     *
     *   `null`                                nothing is pending
     *   `{kind:'template', template, readParams}`  AT… on a catalogue row
     *   `{kind:'edit', tool}`                 an edit tool is selected
     *
     * ⛔ **ONE VARIABLE, ONE WRITER (`setArmed`), ONE LISTENER.** The two are
     * mutually exclusive by construction — a click means exactly one thing —
     * and arming either DISARMS the other, including the tool `<select>`, which
     * `renderArmed` drives back to `off`. A second `editTool` variable beside
     * this one would let a page look unarmed for templates while a paint was
     * still pending, which is the state the reader's next click gets wrong.
     *
     * ⛔ It is declared HERE with `state` for the same measured reason (trap
     * 252): `renderArmed` runs from `renderCatalogue`, which runs at MOUNT, and
     * a reference to a `let` declared below would throw in the temporal dead
     * zone and take the whole arm down before it drew anything.
     */
    let armed = null;
    /**
     * ── ⛓⛓⛓ SLICE 5a (D4/D4'/D5) — **THE PHASE LADDER AND THE OVERLAYS, AS
     * ── VIEW STATE** ────────────────────────────────────────────────────
     *
     * ⛔ ALL THREE ARE VIEW SETTINGS: they RE-DRAW, they never regenerate, and
     * NONE of them is written to the URL (the maze lab's layer stepper is the
     * pattern, arc-1 §10). A phase index in the bar would name a picture rather
     * than a run, and the run is what a link is for.
     *
     *   `phaseIndex`  `null` = the FINISHED level (what the page has always
     *                 shown); an integer = *everything up to and including
     *                 ledger row k*, rebuilt from the row DELTAS and handed to
     *                 the EXISTING renderer. ⛔ Nothing is re-run.
     *   `genLayer`    `off → sites → elements → areas → all`, cumulative.
     *   `selectedFacts` the paintable ids the reader has TICKED — ⚖ the user's
     *                 ruling of 2026-08-18: the picture follows the TEXT
     *                 selection, so overlapping facts are the reader's problem
     *                 to sequence rather than the palette's to distinguish.
     *
     * ⛔ Declared HERE with `state` and `armed` for the measured reason (trap
     * 252): the mount-time render reads them, and a `let` declared below would
     * throw in the temporal dead zone.
     */
    let phaseIndex = null;
    /**
     * ⛓ ⚖ ITEM (iii) — WHY A `?phase=` WAS NOT HONOURED, if it was not.
     *
     * ⛔ A REFUSAL IS SPOKEN AND IS ON THE READOUT, never clamped. Silently
     * landing on the nearest row would make a demo link that named a phase this
     * ladder does not have look exactly like one that named a phase it does —
     * and the reader would be studying the wrong picture with no way to tell.
     * `null` is *no `?phase=` was refused*, which is also the state after a
     * later press moves the page somewhere legal.
     */
    let phaseWhy = null;
    let genLayer = 'off';
    let selectedFacts = new Set();
    /**
     * ⛓ R9 SLICE 0 — the reason the LAST ladder reset gave, `null` until one
     * happens. Declared HERE with `state` for the measured TDZ reason (trap
     * 252): the mount-time publish reads it.
     */
    let lastResetReason = null;
    /**
     * ⛓⛓⛓ SLICE 11 — **THE CERTIFICATION, AS PAGE STATE** (⚖ §3.8(b)).
     *
     *   `null`               NOBODY HAS ASKED about the record now on screen
     *   `{solved:true, …}`   the oracle certified it
     *   `{solved:false, …}`  the oracle was asked and did NOT certify it
     *
     * ⚠ TRAP 262, kept: `null` and `false` are different facts and the readout
     * carries the difference. Before this slice `certified` on this arm was
     * always `true` — a non-SOLVED display solve is FATAL on the ladder path
     * (the loop kept the record, so a refusal means the room answered twice) —
     * and free editing is what makes the other two reachable.
     *
     * ⛔ TWO WRITERS AND NO MORE: a SOLVE sets it (`show`'s solving pass) and
     * an EDIT clears it (`runEdit`/`undo`). It is deliberately NOT on the
     * frozen generator state: `generateStep` is the CLI's entry too and a
     * certification is a fact about a page's last press, not about a recipe.
     */
    let certified = null;

    let catalogueReadout = null;
    const rosterBoxes = () => [...$('genRoster').querySelectorAll('input[data-template]')];
    const checkedNames = () => rosterBoxes().filter((b) => b.checked)
        .map((b) => b.dataset.template);
    /**
     * ⚠ IT READS THE **SELECT**, NOT THE ARM'S `biome` VARIABLE. The variable
     * is only updated at the press (`readForm`'s read-at-press law, which is
     * also what makes a biome change RESET the ladder — a handler that moved
     * the variable early would leave `readForm` comparing a value to itself
     * and the ladder would silently continue under the new biome).
     */
    /**
     * ── ⛓⛓⛓ SLICE 6 — THE ARMED STATE, WRITTEN IN ONE PLACE ───────────
     *
     * ⛔ ONE WRITER, THREE OUTPUTS: the AT… button, the canvas, and the note.
     * They are three views of one variable rather than three flags, which is
     * `updateRunButtons`' own shape one control over — and the reason is the
     * same: a page that LOOKS unarmed while a click is still pending turns the
     * reader's next click into something they did not intend.
     *
     * ⛓ THE ESCAPE LISTENER GOES THROUGH `lifetime.on`, LIKE EVERY OTHER
     * LISTENER ON THIS PAGE, and it is registered ONCE with the armed check in
     * the HANDLER rather than in the registration. ⛔ The first draft added and
     * removed a bare `window.addEventListener` on each arm/disarm — which
     * `watchLifetime.test.js`'s structural row caught by name: a listener the
     * holder never saw is invisible to the teardown readout, so a leak would
     * sit beside a report of a clean teardown. The lifetime owns the
     * unregistration (an AbortSignal), which is a stronger guarantee than the
     * hand-written removal it replaced.
     */
    function renderArmed() {
        const canvas = $('canvas');
        const template = armed?.kind === 'template' ? armed : null;
        const tool = armed?.kind === 'edit' ? armed.tool : 'off';
        canvas.classList.toggle('armed', Boolean(armed));
        for (const b of $('genRoster').querySelectorAll('button[data-arm]')) {
            const on = Boolean(template) && b.dataset.arm === template.template;
            b.classList.toggle('armed', on);
            b.textContent = on ? 'AT… ARMED — click a tile (Esc cancels)' : 'AT… a clicked tile';
        }
        $('genArmNote').textContent = template
            ? `⛓ ARMED: "${template.template}" will be placed at the TILE you click on the `
                + 'level below, as ONE directed attempt at exactly that cell. ⛔ The model '
                + 'adjudicates the cell FIRST, so an illegal one refuses BY NAME without '
                + 'spending a solve. Press Escape, or AT… again, to cancel.'
            : 'click-to-anchor: press AT… on a catalogue row, then click a tile on the level '
                + 'below. ⛔ The unit is the TEMPLATE — the EDIT tools below are what paint a '
                + 'bare tile, and only one of the two can be armed at a time.';
        /**
         * ⛓⛓ THE TOOL SELECT IS A VIEW OF `armed`, NOT A SECOND STORE. Arming
         * a template drives it back to `off` here, so the two controls cannot
         * both look live — which is the whole reason there is one variable.
         */
        $('genEditTool').value = tool;
        $('genEditNote').textContent = editNoteText(tool);
        // ⛓ The readout carries both, so an acceptance row can assert the
        // armed state without reading a string out of a note.
        if (window.__editorGenerate) {
            window.__editorGenerate.armed = template?.template ?? null;
            window.__editorGenerate.editTool = tool;
        }
    }
    /**
     * ⛔ THE ONE WRITER OF `armed`. Every arm, disarm and re-arm on this panel
     * goes through here — the AT… callback, the tool `<select>`, Escape, the
     * catalogue rebuild and the click handler's own disarm — so there is one
     * place that decides what the page LOOKS like when something is pending.
     */
    const setArmed = (next) => { armed = next; renderArmed(); };
    /**
     * ⚠ THE SENTENCE THE EDIT SECTION SHOWS, and it says what a click will DO
     * before it is clicked — the same law the ARMED note follows. ⛔ The
     * certification half is deliberately NOT here: it is a statement about the
     * level, so it lives in `#genEditCert`, which every draw rewrites.
     */
    const editNoteText = (tool) => ({
        off: 'no edit tool — clicks on the level do nothing (AT… still arms a template).',
        paint: '⛓ PAINT ARMED: the clicked tile becomes the selected terrain. ⛔ The border '
            + 'ring is editable too, and NOTHING here checks legality — free means free, and '
            + 'the ORACLE is the guard (press SOLVE). Escape cancels.',
        place: '⛓ PLACE ARMED: the entity type below is placed at the clicked tile\'s OEL '
            + 'corner with the attributes in the box, LITERALLY (no activator-group '
            + 'derivation — a hand placement has no anchor to derive from). Escape cancels.',
        attrs: '⛓ ATTRS ARMED: the clicked tile\'s LAST entity has its attributes REPLACED by '
            + 'the box (not merged — clearing a field is spelled by leaving it out). '
            + 'Escape cancels.',
        remove: '⛓ REMOVE ARMED: the clicked tile\'s LAST entity is deleted. A tile holding '
            + 'none refuses BY NAME rather than doing nothing. Escape cancels.',
    }[tool] ?? '');
    const renderCatalogue = () => {
        const full = paletteFor(biomeSel.value);
        const selected = new Set(roster
            ? restrictPalette(full, roster).templates.map((t) => t.name)
            : full.templates.map((t) => t.name));
        catalogueReadout = mountCatalogue(catalogueRows(full), selected,
            (template, params) => attempt(template, params),
            /**
             * ⛔ A SECOND PRESS DISARMS, and so does AT… on a DIFFERENT row —
             * two rows armed at once would make the next click mean two things.
             */
            (template, readParams) => {
                setArmed(armed?.kind === 'template' && armed.template === template
                    ? null : { kind: 'template', template, readParams });
            });
        for (const b of rosterBoxes()) b.onchange = () => updateRunButtons();
        // ⛔ The buttons were just rebuilt, so the armed VIEW has to be redrawn
        // — and `armed` itself is dropped, because the row object it named is
        // gone and its form is a new one. ⛓ SLICE 11: that drops a selected
        // EDIT TOOL too, which is right for the same reason — the catalogue is
        // rebuilt on a biome/roster change, and a brush left live across one
        // would paint under a page the reader has just re-described.
        setArmed(null);
    };
    /**
     * ⛔ AN EMPTY RESTRICTION REFUSES **BEFORE** THE PRESS. `levelGenerator`
     * already refuses an empty palette as *"a finding ABOUT THE PALETTE"* and
     * that refusal STAYS as the backstop — but discovering it after a press
     * means the page spent a click to tell you something it knew before it. So
     * the three ladder buttons go dead with the reason beside them, and the
     * catalogue stays live because ticking a box is the fix.
     */
    let busyNow = false;
    function updateRunButtons() {
        const checked = checkedNames();
        const all = rosterBoxes().length;
        const empty = checked.length === 0;
        for (const id of ['genStep', 'genRunAll', 'genReset']) {
            $(id).disabled = busyNow || empty;
        }
        $('genRosterNote').textContent = empty
            ? '⛔ NOTHING is ticked — an EMPTY roster is a finding ABOUT THE PALETTE, not a '
                + 'run that quietly places nothing. The ladder buttons are disabled until '
                + 'at least one template is ticked.'
            : (checked.length === all
                ? `the WHOLE roster: ${all} template(s), no restriction`
                : `RESTRICTED to ${checked.length} of ${all}: ${checked.join(', ')}`);
        /**
         * ── ⛓⛓⛓ THE LADDER-RESET-ON-DIRECTIVES LAW (slice 5) ──────────────
         *
         * ⛔ **THE PREFIX PROPERTY DOES NOT CROSS A DIRECTIVE.** STEP is
         * "obstacleTarget = k, re-run" and it is sound because a run to k is a
         * strict PREFIX of a run to k+1 — but a directed attempt is not part of
         * any run, so "re-run to k+1" cannot reproduce *ladder-to-k + directive*
         * and then add one. A ladder button pressed after a directive would
         * either discard the directive silently or display a level no single
         * construction produces.
         *
         * ⚖ **THE CHOICE, AND IT IS THE ONE THE BRIEF LEFT OPEN: ENABLED, AND
         * RESET WITH THE REASON SAID BEFORE THE PRESS.** Disabling them would
         * strand the page — RESET is itself a ladder button, so a directed level
         * would have no way back to a ladder at all — and this arm already has
         * exactly this shape built and tested for a changed seed
         * (`readForm`'s reset). ⛔ What matters is that the page says what will
         * happen BEFORE the press, which is what this note is.
         *
         * ⛓ IT LIVES HERE because this is the ONE writer of the ladder buttons'
         * state (slice 4 §11.10), and a third reason they may behave
         * differently belongs with the other two rather than beside them.
         */
        const nDirectives = (state?.directives ?? []).length;
        /**
         * ⛓⛓ SLICE 11: THE EDITS JOIN THE SAME SENTENCE, in the same one
         * writer, for the third time this note has grown a reason. ⛔ An edit
         * ALSO blocks a directed attempt (the ordering rule — see
         * `applyDirective`'s backstop), which is a fact about the CATALOGUE's
         * buttons and is therefore said here, where the reader is looking
         * before pressing one.
         */
        const nEdits = (state?.edits ?? []).length;
        $('genDirectivesNote').textContent = (nDirectives === 0 && nEdits === 0)
            ? 'none yet — the level on screen is the ladder alone'
            : `⚠ ${nDirectives} directive(s)`
                + (nEdits ? ` and ${nEdits} manual edit(s)` : '')
                + ' applied. The prefix property does NOT cross either, so STEP and RUN-ALL '
                + 'will RESET to the skeleton and DROP them — the same reset a changed seed '
                + 'causes, and for the same reason (this level is not one any single ladder '
                + 'run produces). ⛔ Download the PAYLOAD first if you want to keep it — '
                + 'since slice 12 the URL names the LADDER alone, and `?gen=` of that file '
                + 'replays the directives and the edits in order.'
                + (nEdits
                    ? ' ⛔ And ATTEMPT / AT… are REFUSED while edits stand: the payload '
                        + 'carries `directives` and `edits` as two lists, which means exactly '
                        + 'one construction only because the order is ladder → directives → '
                        + 'edits.'
                    : '');
        $('genDirectivesClear').disabled = busyNow || (nDirectives === 0 && nEdits === 0);
    }
    $('genRosterAll').onclick = () => {
        // ⚠ The whole roster is spelled by ABSENCE, so this clears the
        // restriction rather than writing one that names every member.
        roster = null;
        renderCatalogue();
        updateRunButtons();
    };
    /**
     * ⛔ A BIOME CHANGE RESETS THE RESTRICTION AND RE-RENDERS. The two rosters
     * are different lists — `wall-gap-spinner-killlock` exists only post-sword
     * — so carrying a restriction across would either refuse by name or, worse,
     * mean something different under the same words. The ladder already RESETS
     * on a biome change for the same reason (the seed IS the level's identity);
     * this is that law applied to the roster.
     */
    biomeSel.onchange = () => {
        roster = null;
        renderCatalogue();
        updateRunButtons();
    };
    renderCatalogue();
    updateRunButtons();
    // ⛓ SLICE 11: the edit buttons start dead (nothing to undo, no record yet)
    // and turn over with the run buttons from then on.
    updateEditButtons();

    const atlas = await loadAtlas();
    /**
     * ⛔ THE PAGE'S ATLAS IS FETCHED AND THEN NOT USED FOR THE LEVEL — a
     * generated room is not in it. `atlasOf(record)` wraps the ONE record in
     * the atlas shape `levelSourceFromAtlas` takes (⚖ kickoff §2: the
     * atlas-record JSON IS the PoC's level format), which is exactly what
     * `procgenOracle` does on the other side of the seam. The real atlas is
     * still fetched because the TAPE I/O and the loaded-tape path below need
     * a source for committed levels.
     */
    const atlasSource = levelSourceFromAtlas(atlas);
    replayLoadedTape = (t, lbl) => replayTape(t, lbl, params, atlasSource, null)
        .catch((e) => fatal('the loaded tape would not replay', e.stack || e.message));

    const cost = ladderCost(bounds, 139);
    $('genNote').textContent = cost.why;

    /**
     * ⚠ ONE PLACE DECIDES WHETHER THE LADDER BUTTONS ARE LIVE, because there
     * are now TWO reasons they may not be: a run in flight, and an empty
     * roster. Two writers of one `disabled` flag would let a finished run
     * re-enable a button the catalogue had just disabled.
     */
    const busy = (on) => {
        busyNow = on;
        updateRunButtons();
        // ⛓ SLICE 11: the edit buttons have the same two reasons to be dead
        // (a run in flight, nothing to act on), so they turn over here too
        // rather than in a second place that could disagree about `busyNow`.
        updateEditButtons();
    };

    /**
     * ONE DISPLAY UPDATE, called after EVERY placement (⚖ ruling §1.3).
     *
     * ⚠ IT RETURNS THE READOUT RATHER THAN SETTING IT, so RUN-ALL can decide
     * what to do next from the same object the acceptance row reads.
     */
    /**
     * ── ⛓⛓⛓ SLICE 11 — THE THREE PASSES THROUGH THIS ONE FUNCTION ─────────
     *
     * `show()` used to have exactly one mode: SOLVE the record, and treat a
     * non-SOLVED verdict as FATAL — sound on the ladder path, where the loop
     * already kept the record and a refusal means one room answered twice.
     * Free editing adds two states that path cannot express, so the mode is now
     * ONE argument and the function is still one function:
     *
     *  · **UNEDITED** (`edits.length === 0`, the ladder and the directives) —
     *    unchanged in every respect: solve, replay the tape, fatal on a
     *    disagreement.
     *  · **EDITED, NOT CERTIFYING** (after a paint) — ⛔ **NO SOLVE AT ALL**,
     *    which is ⚖ §3.8(b) as a mechanism rather than a label: a page that
     *    quietly re-solved on every edit would show a certified level and there
     *    would be nothing for the SOLVE button to mean. The room is drawn as a
     *    STILL FRAME through `previewLevel` — the page's ONE
     *    draw-without-a-run — and `certified` stays whatever the edit left it
     *    (`null`).
     *  · **EDITED, CERTIFYING** (the SOLVE press) — solve, and REPORT the
     *    verdict whatever it is. A REFUSED edited level is the mode working.
     *
     * ⚠ IT RETURNS THE READOUT RATHER THAN SETTING IT, so RUN-ALL can decide
     * what to do next from the same object the acceptance row reads.
     */
    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ SLICE 5a — THE PHASE LADDER, THE OVERLAYS AND THE LEGEND
     * ══════════════════════════════════════════════════════════════════ */

    /** ⛓ The pass-1 ledger of the state on screen — EMPTY before the first
     *  generation, which is what the controls are disabled on. */
    const ledgerOf = () => state?.ledger ?? [];

    /**
     * ⛓⛓⛓ **THE OVERLAY DATA — AND IT IS THE PICTURE'S ARGUMENT.**
     * `window.__editorGenerate.overlays` publishes THIS object, the very one
     * `drawGenOverlay` consumed, so a browser row asserting a cell list is
     * asserting something about the canvas (arc-2 §11.2's law: two functions
     * would let the picture be wrong while the readout stayed right).
     */
    const overlayData = () => genOverlaysFor(state?.model ?? null,
        { layer: genLayer, phase: phaseIndex });

    /** ⛓ The paintables the reader has TICKED, in the row's own order. ⚖ The
     *  2026-08-18 ruling: the picture follows the TEXT selection. */
    const selectedPaintables = () => {
        const row = phaseIndex === null ? null : ledgerOf()[phaseIndex];
        return (row?.data.facts ?? []).filter((f) => selectedFacts.has(f.id));
    };

    /**
     * ⛔ THE SIBLING DRAW. `tilePx` is derived from the CANVAS the renderer
     * just sized (`canvas.width / world.width`) rather than from the
     * renderer's private scale — one reading, and it is the picture's own
     * geometry.
     */
    const afterDrawGen = (canvas) => {
        const cols = state?.record?.width ?? 0;
        if (!cols || !canvas?.width) return;
        const view = { tilePx: canvas.width / cols };
        const ctx = canvas.getContext('2d');
        drawGenOverlay(ctx, overlayData(), view);
        drawPaintables(ctx, selectedPaintables(), view);
    };

    /**
     * ⛓⛓ THE LEGEND — one row per SYMBOL, never per cell (arc-1's rule), and
     * DERIVED from the overlay data so the page cannot name something the draw
     * did not paint.
     */
    function renderLegend() {
        const data = overlayData();
        /** ⛓ P2: each row carries the GLOSSARY sentence for the thing it
         *  names, as a `title=`. ⛔ THE ROW'S TEXT DOES NOT CHANGE — three
         *  acceptance rows assert it — and a group id the map does not know
         *  simply gets no tooltip. */
        $('genLegend').innerHTML = data.legend.length === 0
            ? (genLayer === 'off' ? '' : '<span class="note">nothing to draw at this layer</span>')
            : data.legend.map((row) => `<div class="tr"${legendTipFor(row.id)
                ? ` title="${esc(legendTipFor(row.id))}"` : ''}>`
                + (row.color
                    ? `<span style="display:inline-block;width:1em;height:1em;`
                        + `background:${row.color};vertical-align:middle"></span> ` : '⛔ ')
                + `${esc(row.label)}${row.count ? ` — ${row.count} cell(s)` : ''}`
                + `${row.note ? ` <span class="note">(${esc(row.note)})</span>` : ''}</div>`)
                .join('');
        $('genLayerNote').textContent = genLayer === 'off' ? ''
            : `${data.groups.length} group(s), ${data.counts.sites + data.counts.elements
                + data.counts.areas} cell(s) drawn`;
    }

    /**
     * ⛓⛓⛓ **THE PHASE READOUT — THE ROW'S OWN SENTENCE**, its counts and its
     * refusal BY NAME, plus one SELECTABLE line per intermediate result.
     *
     * ⛔ THE SENTENCE IS THE PHASE'S, VERBATIM. Nothing here re-narrates a
     * phase: a page that wrote its own summary of what the carve did would be a
     * second answer to the question the ledger exists to answer once.
     */
    function renderPhaseNote() {
        const rows = ledgerOf();
        const at = phaseIndex;
        $('genPhase').max = String(Math.max(0, rows.length - 1));
        $('genPhase').disabled = rows.length === 0;
        /**
         * ⛔ **`◀ PHASE` FROM THE FINISHED LEVEL ENTERS AT THE LAST ROW AND
         * `PHASE ▶` AT THE FIRST**, so neither is dead on arrival — the state a
         * reader starts in IS the finished one, and a disabled pair there would
         * make the ladder look like it had not been built. Only the ENDS
         * disable.
         */
        $('genPhasePrev').disabled = rows.length === 0 || at === 0;
        $('genPhaseNext').disabled = rows.length === 0 || at === rows.length - 1;
        $('genPhaseEnd').disabled = at === null;
        if (at === null) {
            $('genPhaseLabel').textContent = rows.length
                ? `the FINISHED level — ${rows.length} pass-1 phase(s) recorded; `
                    + 'STEP is pass 2'
                : 'no generation yet';
            $('genPhaseNote').textContent = '';
            $('genPhaseFacts').innerHTML = '';
            return;
        }
        const row = rows[at];
        $('genPhase').value = String(at);
        $('genPhaseLabel').textContent = `phase ${at + 1} of ${rows.length} — `
            + `${row.phase}${at === rows.length - 1
                ? '  ·  pass 2 — use STEP' : ''}`;
        /**
         * ⛓ THE DELTA IS THE ROW'S OWN, not a recount of the picture: `changed`
         * is what THIS phase wrote over the one before it.
         */
        $('genPhaseNote').textContent = `${row.sentence}`
            + `  ·  ${row.tiles.changed.length} tile(s) changed, `
            + `${row.entities.added.length} entit(y|ies) added`
            + `${row.entities.removed.length ? `, ${row.entities.removed.length} removed` : ''}`
            + `  ·  draws ${row.draws.before} → ${row.draws.after}`
            + (row.refusal ? `  ·  ⛔ REFUSED: ${row.refusal.reason}` : '');
        $('genPhaseFacts').innerHTML = row.data.facts.length === 0
            ? '<span class="note">this phase recorded no paintable intermediate result</span>'
            : `<label class="note"><input type="checkbox" data-fact="__all"`
                + `${row.data.facts.every((f) => selectedFacts.has(f.id)) ? ' checked' : ''}>`
                + ' ALL of this phase\'s facts</label>'
                + row.data.facts.map((f) => `<label class="tr">`
                    + `<input type="checkbox" data-fact="${esc(f.id)}"`
                    + `${selectedFacts.has(f.id) ? ' checked' : ''}> ${esc(f.label)}`
                    + ` — ${f.count} cell(s)${f.pick ? `, pick (${f.pick.x},${f.pick.y})` : ''}`
                    + `${f.note ? ` <span class="note">(${esc(f.note)})</span>` : ''}</label>`)
                    .join('');
    }

    /**
     * ⛓⛓⛓ **PHASE k, DRAWN — AND NOTHING IS RE-RUN.** The room is rebuilt from
     * the ledger's own DELTAS (`foldLedger`) and handed to the EXISTING
     * renderer as a still frame. ⛔ The renderer is not changed and the model is
     * not rebuilt: a step-through that regenerated would be a second generator
     * with its own answer.
     */
    async function showPhase() {
        const rows = ledgerOf();
        const at = phaseIndex;
        if (at === null || !rows.length) return;
        const folded = foldLedger(rows, at,
            { width: state.record.width, height: state.record.height });
        const walled = emptyLevel({ level: state.record.level, width: state.record.width,
            height: state.record.height, floor: 'wall' });
        const record = withEntities(withTerrain(walled, folded.terrain), folded.entities);
        const staging = { ...displayStaging(state), boot: displayStaging(state).boot };
        const why = previewLevel(levelSourceFromAtlas(atlasOf(record)),
            { ...staging, boot: { ...staging.boot, level: record.level } },
            layerSetFor(params), lifetime, afterDrawGen).why;
        $('status').className = why ? 'bad' : '';
        $('status').textContent = why
            ? `phase ${at + 1}/${rows.length} (${rows[at].phase}) would not BUILD: ${why}`
            : `phase ${at + 1}/${rows.length} — ${rows[at].phase} (a VIEW; nothing was re-run)`;
        renderPhaseNote();
        renderLegend();
        publishPhase(record);
    }

    /**
     * ⛔ THE READOUT PUBLISHES THE **SAME OBJECTS** THE DRAW CONSUMED — the row,
     * the selected paintables and the overlay data — so a browser row asserting
     * a cell list is asserting something about the canvas (value ≠ echo).
     */
    function publishPhase(record = null) {
        const rows = ledgerOf();
        window.__editorGenerate = {
            ...(window.__editorGenerate ?? {}),
            phase: {
                index: phaseIndex,
                count: rows.length,
                phases: rows.map((r) => r.phase),
                /** ⛓ ⚖ ITEM (iii): the `?phase=` refusal, BY NAME. `null` = none. */
                why: phaseWhy,
                row: phaseIndex === null ? null : rows[phaseIndex],
                selected: selectedPaintables(),
                level: record,
            },
            layer: genLayer,
            overlays: overlayData(),
            legend: overlayData().legend,
        };
    }

    /**
     * ── ⛓⛓⛓ THE ARM'S ADDRESS BAR — ONE WRITER, ONE `replaceState` ─────
     *
     * Everything that was inline in `show()` until R9 slice 13, moved out
     * VERBATIM so that `goToPhase` can reach it too. Every value it names is
     * `runGenerate`'s own closure state, so nothing is threaded through a
     * parameter list; the one argument is the PHASE, because that is the only
     * thing the two callers disagree about.
     *
     * ⛔ THE PHASE IS AN ARGUMENT AND NOT A READ OF `phaseIndex`, and the
     * difference is real: `goToPhase` assigns `phaseIndex` before it awaits a
     * re-draw, and `show()` may run inside that await. A writer that read the
     * live variable would be writing whichever value won the race. The caller
     * that KNOWS which phase it just moved to passes it.
     *
     * @param {number|null} at the phase index to name in the bar; `null` is
     *   the FINISHED level, which is spelled by ABSENCE.
     */
    function rewriteUrl(at = phaseIndex) {
        const q = new URLSearchParams(window.location.search);
        q.set('goals', formatGoalsParam(state.model.goals));
        q.delete('boot');
        q.delete('level');
        /**
         * ── ⛓⛓⛓ AND THE FORM'S OWN VALUES WITH THEM (slice 1) ─────────
         *
         * ⛔ THE PANEL USED TO EDIT LOCAL VARIABLES AND NOTHING ELSE. Seed
         * 3 → 9, press RUN-ALL, and the address bar still said `?seed=3`:
         * the link named a level the page was not showing, on a page whose
         * ONLY persistence is the URL. `writeGenerateParams` is the single
         * writer and `readGenerateParams` the single reader — see that
         * docblock for why `count` is `state.bounds.obstacleTarget`, why
         * `run` is deleted rather than zeroed, and what `?gen=` does here.
         *
         * ⚠ WRITTEN FROM `state`, NOT FROM THE FORM. `show()` runs after the
         * generation, so the state holds the arguments the record on screen
         * was ACTUALLY made with — the form is where they came from, but it
         * is the run that the link has to name.
         */
        const search = writeGenerateParams(q.toString(), {
            seed: state.seed,
            biome: state.biome,
            bounds: state.bounds,
            /** ⛓ ARC 5, SLICE 1 — from the STATE, like the skeleton: the room
             *  the record on screen was really built in. Deleted at 10x10 /
             *  `dense` by the writer. */
            size: state.size,
            fill: state.fill,
            // ⛓ CONSTRUCTIVE SLICE 5: from the STATE — the kind the room on
            // screen was really CARVED from, so a link cannot name a skeleton
            // the page did not build. DELETED at the open room by the writer.
            skeleton: state.skeleton,
            /**
             * ⛓⛓ SLICE 5a (D1) — THE THREE, from the RUN's own arguments.
             *
             * ⛔ `elements` COMES FROM THE LOCAL, NOT FROM `state.elements`, and
             * the difference is the whole of *nobody said*: the state carries
             * the REPORT of whatever the seam resolved (which under 4c's biome
             * default is a `+` list on every level), while what the link has to
             * name is what the CALLER asked for. Writing the resolved default
             * back would freeze the biome's spec into the URL and a post-sword
             * link would then reproduce a pre-sword element list.
             * ⛓ `areas`/`require` are the caller's too, for the same reason,
             * and both are also byte-identical to their reports' `spec`.
             */
            elements,
            areas,
            require,
            // ⛓ SLICE 4: from the STATE, like every other parameter here — the
            // palette the record on screen was really drawn from carries it,
            // so the link cannot name a roster the run did not have.
            roster: state.roster,
            // ⛔ SLICE 12: NO `directives` ARGUMENT — ⚖ §3.9 took the list off
            // the bar, so the writer has no such parameter and a link names the
            // LADDER alone. `describeState` says so as soon as there is one.
            step,
            /**
             * ── ⛓⛓⛓ ⚖ WATCH-PAGE ITEM (iii) — THE PHASE, ON THE ADDRESS BAR
             *
             * ⚖ The user, 2026-08-22: *"a URL parameter for the PHASE so demo
             * links deep-link to a phase"*. This REVERSES the ladder's founding
             * rule — see `goToPhase`'s docblock and `watch.html`'s, both
             * rewritten in the same slice.
             *
             * ⛔ IT IS THE ROW'S **NAME**, NOT ITS INDEX. The name is what the
             * label prints, what the demo prose says and what a reader types;
             * it is also stable across seeds, while an index renumbers the day
             * a pass-1 row is inserted — and the whole point of the parameter
             * is that a demo link written today still lands on `carve`
             * tomorrow.
             *
             * ⛔ AND FINISHED IS SPELLED BY ABSENCE, so the default leaves the
             * bar exactly as clean as it has always been. `null` DELETES.
             */
            phase: at === null ? null : (ledgerOf()[at]?.phase ?? null),
            payloadOwned: Boolean(payload),
        });
        window.history.replaceState(null, '', `${window.location.pathname}?${search}`);
    }

    async function show(why, { certifying = false } = {}) {
        const edited = (state.edits ?? []).length > 0;
        const solving = !edited || certifying;
        let solved = null;
        let engineError = null;
        let solveMs = 0;
        if (solving) {
            const t0 = performance.now();
            try {
                solved = displaySolve(state);
            } catch (e) {
                /**
                 * ── ⛔⛔⛔ THE PAGE'S OWN CATCH — NARROW BY **CLASS** AND BY
                 * ── **SCOPE**, and the oracle's is untouched (traps 171/173) ──
                 *
                 * A hand-placed entity the engine has never transcribed makes
                 * `buildLevelWorld` throw a `LevelWorldError` — which is NOT a
                 * refusal and which `procgenOracle` deliberately propagates,
                 * because on a GENERATED record it is a defect in the generator
                 * and a loop that swallowed it would hide its own bugs.
                 *
                 * On a HAND-EDITED record it is neither: it is the honest
                 * answer to *"can the engine build what you just typed"*, and
                 * the page owes the reader that answer rather than a blank tab.
                 * ⛔ So the catch is bounded twice — the class is named, and it
                 * only applies when `edits.length > 0`. An unedited record that
                 * throws still takes the arm down, loudly, exactly as before;
                 * any OTHER class still propagates even on an edited one,
                 * because a `TypeError` in the solver is a defect wherever it
                 * happens.
                 */
                if (!edited || !(e instanceof LevelWorldError)) throw e;
                engineError = e;
            }
            solveMs = Math.round(performance.now() - t0);
            /**
             * ⛔ ONE OF THE TWO WRITERS OF `certified` (the other is an edit,
             * which clears it). A solve that reached every goal certifies; a
             * refusal, a budget exhaustion and an engine throw are all
             * `{solved:false}` WITH THE REASON, because "the oracle said no"
             * and "the oracle said no BECAUSE the world would not build" are
             * different findings a reader has to be able to tell apart.
             */
            certified = engineError
                ? {
                    solved: false,
                    at: why ?? null,
                    verdict: null,
                    errorName: engineError.name,
                    reasonText: engineError.message,
                }
                : {
                    solved: (solved.certification?.certified ?? false) === true,
                    at: why ?? null,
                    verdict: solved.verdict,
                    ticks: solved.ticks ?? null,
                    errorName: solved.errorName ?? null,
                    reasonText: solved.reasonText ?? null,
                };
        }
        const agreement = solved
            ? agreementWithTrace(state, solved)
            : {
                compared: false,
                agrees: true,
                why: 'the record on screen carries manual edits and NOTHING has solved it — '
                    + 'there is no display solve to compare against the trace',
            };
        const genRows = generationRows(state.trace);
        const paneReadout = mountGenerationPane(genRows);
        const directiveReadout = mountDirectives(state.directives);
        const editReadout = mountEdits(state.edits);
        renderCertification();
        lastPayload = {
            generator: 'frontend/modules/seedlingDemo/watchViewer.js (SOURCE = GENERATE)',
            seed,
            biome,
            // ⛓ SLICE 4: an IDENTITY field beside seed and biome — see
            // `agreementWithPayload`. The CLI's payload carries the same one.
            roster: state.roster,
            /**
             * ⛓ SLICE 5: the construction beside the ladder — ⚖ §3.5, and an
             * IDENTITY field `agreementWithPayload` compares. The CLI's payload
             * carries the same two.
             */
            directives: state.directives,
            /**
             * ⛓⛓⛓ SLICE 11: THE MANUAL EDITS — the part of this level NO SEED
             * WILL REPRODUCE, which is precisely why it is in the payload and
             * not in the URL (⚖ ruling 9). `agreementWithPayload` compares it,
             * and the `?gen=` path replays it, so this file IS the reproduction.
             */
            edits: state.edits,
            /**
             * ⛓ SLICE 11: the CERTIFICATION rides with the record — `true`,
             * `false`, or `null` for *nobody has asked*. ⚠ It is NOT an
             * identity field and `agreementWithPayload` does not compare it: a
             * loaded level is uncertified whatever the file claimed, which is
             * the maze page's own law (§10.5 claim 7).
             */
            certified: certified === null ? null : certified.solved,
            /** ⚖ Ruling 9(b)'s reserved block, so the constructive mode is additive. */
            skeleton: state.skeleton,
            bounds: state.bounds,
            budget: state.budget,
            summary: state.summary,
            level: state.record,
            trace: state.trace,
        };
        const label = `generated-s${seed}-${biome}-step${step}`;
        $('title').textContent = `${label} — the Cloudberry loop, in this page`;

        if (!edited && solved.verdict !== 'SOLVED') {
            /**
             * ⛔ A REFUSED DISPLAY SOLVE IS A DISAGREEMENT, NOT A VIEW. Every
             * record on the ladder is one the LOOP accepted, so a refusal here
             * means the same room answered two ways. Reported with the
             * solver's own text; nothing is drawn over the last good frame.
             */
            fatal(`the DISPLAY solve of step ${step} came back ${solved.verdict} — the loop `
                + 'KEPT this record, so the same room has answered two ways',
                `${solved.reasonText ?? solved.classifiedBy ?? '(no text)'}`);
            window.__editorGenerate = {
                status: 'refused', step, seed, biome,
                verdict: solved.verdict, message: solved.reasonText ?? null,
            };
            // ⛓ SLICE 4: a REFUSAL is a state change too, and a host left on
            // the last good identity line would be reading a level the page
            // has stopped showing (`watchSummary` maps `status !== 'ok'` to
            // "this arm holds no generated level", by name).
            publishWatch('generate');
            return { solved, agreement, drew: false };
        }

        const levelSource = levelSourceFromAtlas(atlasOf(state.record));
        /**
         * ⛓⛓ MOVED UP BY SLICE 11, and only past the refusal check above: the
         * STILL-FRAME path below asks `isHeldLevel(staging.boot.level)` for its
         * scratch-persistence flag, which reads this. ⛔ It stays BELOW the
         * refusal return, so the "the bridge is armed only by a drawn level"
         * law is unchanged — a room the page could not show is still never
         * handed to another arm.
         */
        heldGeneratedLevel = {
            record: state.record, seed, biome, step, bounds: state.bounds, budget: state.budget,
        };
        /**
         * ── ⛓⛓⛓ SLICE 11 — THE TWO DRAWS, AND WHY THE SECOND ONE EXISTS ────
         *
         * The replay is a scrub of the SOLVE'S OWN TAPE, so it needs a solve. An
         * edited level that nobody has solved has no tape and MUST NOT get one
         * (§3.8(b)); an edited level the oracle REFUSED has none either. Both
         * are drawn as a still frame by `previewLevel` — ⛔ the page's ONE
         * draw-without-a-run, already used by SOLVE and MANUAL before their
         * first press, so this adds no third renderer.
         *
         * ⚠ AND ITS REFUSAL IS THE ENGINE-THROW DISPLAY'S OTHER HALF: a record
         * the world cannot build cannot be drawn either, and `previewLevel`
         * reports the builder's own message and leaves the last good frame
         * standing rather than blanking the canvas.
         */
        let frames = [];
        let stillWhy = null;
        if (solved && solved.verdict === 'SOLVED') {
            ({ frames } = await replayTape(solved.tape, label, params, levelSource,
                { trace: solved.trace, why: null }, solved.dangerQueries,
                // ⛓ THE SCRUB FORK — see `replayTape`'s own note. This arm is the
                // one caller: the tape it is scrubbing came from a scratch solve.
                // ⛓ SLICE 5a: and the SIBLING overlays, after every scrub frame.
                { scratchPersistence: true, afterDraw: afterDrawGen }));
        } else {
            stillWhy = previewLevel(levelSource, displayStaging(state),
                layerSetFor(params), lifetime, afterDrawGen).why;
        }

        $('status').className = stillWhy ? 'bad' : 'ok';
        $('status').textContent = solved && solved.verdict === 'SOLVED'
            ? `${label} — ${frames.length} observations, `
                + `${solved.ticks} ticks${why ? ` · ${why}` : ''}`
            : `${label} — ${state.edits.length} manual edit(s), a STILL FRAME (no solve `
                + `behind it)${why ? ` · ${why}` : ''}`
                + (solved ? `  ·  SOLVE said ${solved.verdict}` : '')
                + (engineError ? `  ·  ⛔ ${engineError.name}` : '')
                + (stillWhy ? `  ·  ⛔ the room would not even BUILD: ${stillWhy}` : '');
        /**
         * ⛓ SLICE 4: computed ONCE and carried into the readout below, so the
         * host's mirrored identity line and the page's own detail line cannot
         * be two different sentences about one level. `describeState` stays
         * the ONE identity function.
         */
        const identityLine = describeState(state, solved);
        $('detail').textContent = `${identityLine}`
            + (solving ? `  ·  display solve ${solveMs} ms` : '')
            + (engineError
                // ⚠ THE ENGINE'S OWN NAME AND TEXT, VERBATIM — a paraphrase of
                // a builder refusal is a page inventing a reason.
                ? `  ·  ⛔ the world REFUSED to build this record: ${engineError.name}: `
                    + `${engineError.message}`
                : '')
            + (agreement.compared
                ? `  ·  trace/display agreement: ${agreement.agrees ? 'YES' : 'NO'}`
                : '')
            + (agreement.agrees ? '' : `  ·  ⛔ ${agreement.why}`)
            + (payload
                ? `  ·  ?gen= reproduction: ${payload.__check?.agrees === false
                    ? `⛔ DIFFERS in [${payload.__check.differences.join(', ')}]`
                    : (payload.__check ? 'byte-identical' : '(checked at the target)')}`
                : (payloadDropped
                    // ⚠ SAID, not silently done. The reproduction line above was a
                    // statement about the payload's run; this is no longer that run,
                    // so the claim goes and its absence is explained where it stood.
                    ? '  ·  ?gen= was DROPPED at the press — this level is the page\'s own '
                        + 'run and the URL now names it explicitly'
                    : ''));

        /**
         * The page's own readout, for `check-seedling-editor-generate.mjs`.
         * ⛔ Every bound that ran is in it — a readout that named the level
         * and not the bounds would let a batch quote a number nobody could
         * reproduce (⚖ kickoff §5).
         */
        window.__editorGenerate = {
            status: 'ok',
            seed,
            biome,
            step,
            /**
             * ⛓ SLICE 4 (constructive-mode arc): the IDENTITY LINE, the same
             * string the detail line prints. ⛔ Carried rather than rebuilt —
             * `watchSummary` projects this readout for the host, and a summary
             * that called `describeState` itself would be a second answer to
             * "what is this level" one refactor away from disagreeing.
             */
            identity: identityLine,
            /**
             * ⛓ SLICE 4: the DERIVED palette name and the restriction that
             * produced it. ⛔ The name is `summary.palette`'s own string, so a
             * row asserting about the roster and a payload quoting it cannot
             * be reading two different things.
             */
            palette: state.palette.name,
            roster: state.roster,
            catalogue: catalogueReadout,
            /**
             * ⛓ CONSTRUCTIVE SLICE 5: the ROOM this level was built in, and
             * the kinds this binding offers. ⛔ Read off the STATE, so a row
             * asserting about the kind and the level it asserts against cannot
             * be two different rooms.
             */
            skeleton: state.skeleton ?? null,
            skeletons: skeletonCatalogue({ simulator: false }),
            /**
             * ⛓⛓⛓ ARC 5, SLICE 1 — **THE ROOM, AS A CHANNEL A ROW CAN READ**
             * (⚖ rulings 1 and 2). ⛔ It exists because the claim a browser row
             * makes about a MULTI-SCREEN or SHELL room has to be read off the
             * channel it is about (trap 430's family, and slice 0 paid a
             * Windows run to learn it): `width`/`height` say whether the camera
             * can scroll at all, and `tiles` against `cells` is the strip,
             * measured rather than asserted from the flag.
             */
            room: {
                width: state.record?.width ?? null,
                height: state.record?.height ?? null,
                cells: (state.record?.width ?? 0) * (state.record?.height ?? 0),
                tiles: (state.record?.layers ?? []).find((l) => l.name === 'tiles')
                    ?.tiles.length ?? null,
                fill: state.fill ?? null,
                multiScreen: (state.record?.width ?? 0) > SINGLE_SCREEN_TILES.width
                    || (state.record?.height ?? 0) > SINGLE_SCREEN_TILES.height,
            },
            /**
             * ⛓⛓⛓ SLICE 5a (D1) — **THE THREE BLOCKS, READ OFF THE STATE**, in
             * the CLI's own shapes (`elementSummaryOf`, `areaSummaryOf`,
             * `summary.require`). ⛔ `null` when the thing was not asked for,
             * NEVER `{}` — *the graph was never asked* and *the graph ran and
             * found nothing* are different facts, and the browser row asserts
             * the `null` explicitly.
             */
            elements: state.elements ?? null,
            areas: state.areas ?? null,
            require: state.require ?? null,
            /**
             * ⛓ AND WHAT THE **CALLER** ASKED FOR, beside what the run
             * resolved. `undefined` is *nobody said* and JSON cannot carry it,
             * so it is spelled `null` HERE and the field beside it says which:
             * a page that reported only the resolved spec could not be
             * distinguished from one that had spelled the biome default into
             * its own URL.
             */
            elementsAsked: elements ?? null,
            areasAsked: areas ?? null,
            requireAsked: require ?? null,
            /**
             * ⛓⛓ R9 SLICE 0 — **THE LAST LADDER RESET'S OWN SENTENCE**, so the
             * reset a changed control causes is a fact a row can read rather
             * than a line that scrolled past. ⛔ `null` until one happens.
             */
            lastResetReason,
            /**
             * ⛓ SLICE 5: the construction, and WHICH KIND OF KEEP each
             * directive was. ⛔ `keptKind` is reported RAW — the row asserts on
             * it, and a readout that collapsed `solved-no-verb` into
             * `solved-only` would hide the very distinction the ruling asks for.
             */
            directives: state.directives,
            directiveRows: directiveReadout?.rows ?? 0,
            /**
             * ⛓ SLICE 6: is a canvas click PENDING, and for which template?
             * `renderArmed` is the one writer of it, and this is the initial
             * value on every redraw — so a readout can never claim an arm that
             * a re-render dropped.
             */
            armed: armed?.kind === 'template' ? armed.template : null,
            /**
             * ⛓⛓ SLICE 11: THE EDITS, AND THEY ARE THE READOUT'S OWN THREE
             * FIELDS rather than one. `edits` is the COUNT a host mirrors
             * (`stateChanged.edits`), `editList` is the ordered ops a row
             * asserts literals against, and `editTool` is which brush is armed
             * — three different questions, and a count alone cannot answer the
             * second (trap 269: an echoed number is not a value).
             */
            edits: state.edits.length,
            editList: state.edits,
            editRows: editReadout?.rows ?? 0,
            editTool: armed?.kind === 'edit' ? armed.tool : 'off',
            skeleton: state.skeleton,
            bounds: state.bounds,
            budget: state.budget,
            stop: state.stop,
            saturated: state.saturated,
            keptCount: state.summary?.keptCount ?? 0,
            attempts: state.summary?.attempts ?? 0,
            genRows: genRows.length,
            paneRows: paneReadout.rows,
            vetoes: genRows.filter((r) => r.outcome !== 'KEPT')
                .map((r) => ({ label: r.label, template: r.template, outcome: r.outcome,
                    verdict: r.verdict, reasonText: r.reasonText })),
            verdict: solved?.verdict ?? null,
            ticks: solved?.ticks ?? null,
            /**
             * ⛓⛓⛓ SLICE 11 — THE CERTIFICATION, AND IT IS NOW A REAL
             * TRI-STATE. ⚠ Trap 262: `null` is *nobody has asked about the
             * record now on screen* (what an edit leaves behind) and `false` is
             * *the oracle was asked and said no*. Before this slice only `true`
             * was reachable here.
             */
            certified: certified === null ? null : certified.solved,
            certification: certified,
            strategies: (solved?.records ?? []).map((r) => r.strategy),
            scratchClears: solved?.scratchClears ?? [],
            frames: frames.length,
            /** ⚠ The builder's refusal, when the record would not even BUILD. */
            engineError: engineError
                ? { name: engineError.name, message: engineError.message } : null,
            drewStill: solved && solved.verdict === 'SOLVED' ? false : true,
            stillWhy,
            agreement,
            payloadCheck: payload?.__check ?? null,
        };
        /**
         * ⛓⛓ SLICE 5a — THE PHASE BLOCK AND THE OVERLAYS RIDE THE ORDINARY
         * READOUT. ⛔ Written AFTER the readout above rather than into it,
         * because `publishPhase` is also what the phase controls call on their
         * own — one writer of these three fields, whichever path got here.
         */
        publishPhase(null);
        renderPhaseNote();
        renderLegend();
        window.__editorGenerated = lastPayload;
        /**
         * ── ⛓⛓⛓ THE DRAWN LEVEL **IS** THE PAGE'S LEVEL (group A, item 1) ──
         *
         * ⛔ HANDING OVER IS NOT A BUTTON ANY MORE, IT IS A CONSEQUENCE OF
         * DRAWING. Slice 4 armed the bridge on the two buttons alone, which
         * left the obvious route broken: switching GENERATE → MANUAL with the
         * SOURCE SELECTOR found an empty boot box, fell back to `?boot=`, and
         * dropped you at the true game start in level 0 — the generated room
         * you were looking at simply gone. The buttons and the selector are
         * two ways of saying the same thing, so they must leave the same state
         * behind.
         *
         * ⚠ THE PRICE IS STATED, because it is a real one: a block you typed
         * by hand in SOLVE is REPLACED the moment GENERATE draws a level. That
         * is the honest reading of "this is the page's current level", and the
         * note below says so where it happens rather than leaving you to
         * discover it two switches later.
         *
         * ⛓ SLICE 11 MOVED `heldGeneratedLevel` ITSELF ABOVE THE DRAW (the
         * still frame's scratch-persistence flag reads it). What stays here is
         * everything else the hand-over needs, and the refusal path still
         * returns before ALL of it: the bridge is armed only by a drawn level.
         * ⚠ AN EDITED LEVEL IS HANDED OVER TOO, certified or not — SOLVE and
         * MANUAL are exactly where you go to look at a room the oracle refused.
         */
        // ⛔ THE GENERATOR'S OWN BLOCK, through `displayStaging` — pins
        // included. Building one here would be a second staging for the same
        // room, differing exactly where it matters least visibly.
        $('bootBox').value = JSON.stringify(displayStaging(state), null, 4);
        /**
         * ⛔ AND THE MODEL'S OWN GOAL WITH IT. The receiving arm builds its
         * defaults from the level's CENSUS, which is not the list the
         * generator certified against — the model names one goal
         * (`collectGoal(goalOel)`) and a census can offer several. Without
         * this the other arm walks a question that LOOKS like the certified
         * one, silently. `?boot=`/`?level=` go, so a stale committed tape
         * cannot be re-read over the handed level.
         */
        /**
         * ── ⛓⛓⛓ THE ADDRESS BAR, THROUGH THE PAGE'S ONE WRITER ────────
         *
         * ⛓ R9 SLICE 13 MOVED THIS BLOCK OUT UNCHANGED, into `rewriteUrl`.
         * `?phase=` is written by `goToPhase`, which re-draws through
         * `showPhase()` and never calls `show()` — so the block had to become
         * reachable from both, and the page's law is ONE writer and ONE
         * `replaceState`. Adding a second `replaceState` in the ladder would
         * have been the drift the fixed-point rows exist to catch.
         */
        rewriteUrl();

        $('genToSolve').disabled = false;
        $('genToManual').disabled = false;
        $('genBridgeNote').textContent = `step ${step} (seed ${seed}, ${biome}) IS the page's `
            + 'current level: the shared starting-conditions block now holds it, so SOLVE and '
            + 'MANUAL take it however you reach them — these buttons or the SOURCE selector. '
            + '⚠ A block you had typed by hand was replaced.';
        // ⛓ SLICE 4: LAST, after the URL has been rewritten — `__watch.url` is
        // the frame's address and the host's "open standalone" is built from
        // it, so publishing before `replaceState` would hand out a link to the
        // run before this one.
        /**
         * ── ⛓⛓⛓ AND THIS ROOM IS SHIPPABLE — AS A **ONE-ROOM LEVEL SET** ──
         *
         * ⛔ THE TAPE IS THE CERTIFICATION SOLVE'S OWN. `procgenOracle.solve`
         * returns `tape` on a SOLVED verdict (it is `solveForPage`'s fold,
         * carried straight out), so nothing is re-solved here and
         * `watchGenerate.test.js`'s display-solve == certification claim is
         * untouched. MEASURED: seed 1 pre-sword step 4 → SOLVED, 166 ticks,
         * `boot {level:900,x:16,y:16}`, 27 inputs.
         *
         * ⛔ AND **NO `link`**, MEASURED. `buildLevelSet([oneEntry])` with no
         * `link`, with `link:true`, and with `{topology:'chain',regions:[1]}`
         * produce a BYTE-IDENTICAL set (content hash `4ac90eaa` all three; 0
         * doors, 1 chunk, `validateLevelSet` ok, reachability 1/1) —
         * `linkGeneratedRooms` plans no transition for a one-room chain. So
         * passing one would be a bound nobody applies.
         *
         * ⚠ THE LEVEL IS REMAPPED AND THE READOUT SAYS SO. The record is level
         * 900 and the exporter assigns dense ids, so the game reports room 0;
         * `roomOfGeneratedLevel` is the ONE place that mapping is written (⚖
         * the orchestrator, 2026-08-19 — the per-tick slice inherits it).
         */
        setShippable(solved?.tape ? {
            what: `\u25b6 ship this room as a ONE-ROOM level set + its certification tape `
                + `\u2014 seed ${state.seed}, ${state.biome}, step ${state.step}`,
            build: () => buildGenerateShip(state, solved),
        } : {
            why: engineError
                ? `this record would not BUILD (${engineError.name}) \u2014 there is no `
                    + 'certification tape to ship'
                : `the display solve did not SOLVE (verdict ${solved?.verdict ?? 'none'}) `
                    + '\u2014 there is no certification tape to ship',
        });
        publishWatch('generate');
        return { solved, agreement, drew: true };
    }

    /**
     * ── ⛓⛓⛓ HAND THIS LEVEL TO ANOTHER ARM ───────────────────────────
     *
     * ⚠ WHAT DOES **NOT** RIDE: the level. `?seed=` still describes the
     * GENERATION, so the address bar keeps pointing at the thing that IS
     * reproducible, and the arms say out loud that they are holding a room
     * the URL does not name.
     */
    /**
     * The buttons are now SHORTCUTS, not the mechanism — `show()` has already
     * left the level, the block and the goal where any route to another arm
     * will find them. Kept because "SOLVE this level" is what you actually
     * want to say, and hunting the SOURCE selector to say it is friction.
     */
    const handOver = (source) => (state?.record ? switchArm(source) : undefined);
    $('genToSolve').onclick = () => handOver('solve');
    $('genToManual').onclick = () => handOver('manual');

    /* ── ⛓⛓⛓ SLICE 11 — FREE TILE / OBJECT EDITING (⚖ ruling 8, §3.8) ──── */

    /**
     * ⛓⛓⛓ **THE CERTIFICATION, MADE VISIBLE** — §3.8(b)'s whole visible half.
     *
     * ⛔ ONE WRITER OF THE SENTENCE, called from `show()` on every draw, so the
     * pane cannot describe a level the page has stopped showing. The three
     * states are three sentences and never two: `null` is *nobody has asked*
     * (what an edit leaves behind), `false` names the verdict or the engine's
     * refusal VERBATIM, `true` names the walk.
     */
    function renderCertification() {
        const n = (state?.edits ?? []).length;
        const box = $('genEditCert');
        if (certified === null) {
            box.className = 'note bad';
            box.textContent = n
                ? `⛔ UNCERTIFIED — ${n} edit(s) since the last solve; press SOLVE. `
                    + 'Nothing has solved the room now on screen, and an edit never certifies '
                    + 'itself: free editing is exactly the mode in which the oracle is the '
                    + 'only thing that can say the level is still beatable.'
                : '⛔ UNCERTIFIED — nothing has solved the room now on screen.';
            return;
        }
        if (certified.solved) {
            box.className = 'note';
            box.textContent = `✔ CERTIFIED — the oracle SOLVED this exact record`
                + (certified.ticks ? ` in ${certified.ticks} tick(s)` : '')
                + (n ? `, manual edits and all` : '')
                + (certified.at ? ` (${certified.at})` : '');
            return;
        }
        box.className = 'note bad';
        box.textContent = certified.errorName && certified.verdict === null
            // ⚠ VERBATIM, name first. "The world would not build it" and "the
            // solver could not beat it" are different findings.
            ? `⛔ UNCERTIFIED — the world REFUSED to BUILD this record. `
                + `${certified.errorName}: ${certified.reasonText}`
            : `⛔ UNCERTIFIED — the oracle answered ${certified.verdict}. `
                + `${certified.reasonText ?? '(no text)'}`;
    }

    /**
     * ⛔ ONE PLACE DECIDES WHETHER THE EDIT BUTTONS ARE LIVE, the same law
     * `updateRunButtons` follows one control over: UNDO needs an edit to undo,
     * SOLVE needs a record, and both are dead while a run holds the thread.
     */
    function updateEditButtons() {
        const n = (state?.edits ?? []).length;
        $('genEditUndo').disabled = busyNow || n === 0;
        $('genEditSolve').disabled = busyNow || !state?.record;
    }

    /**
     * ⛓⛓⛓ ONE MANUAL EDIT — the op is built HERE from the tool and the form,
     * and applied by `watchEdit.editState`, which is the ONE place an edit
     * touches a record.
     *
     * ⛔ **AND IT CLEARS THE CERTIFICATION FIRST**, before the op is even
     * applied. ⚖ §3.8(b): the moment the record moves, the last solve is about
     * a room that is no longer on screen — so the clear cannot be conditional
     * on the op succeeding, and it cannot come after a draw that would have
     * printed the stale verdict for one frame.
     *
     * ⚠ A REFUSED OP LEAVES THE LEVEL ALONE and says why, with the ops
     * module's own sentence. `editState` refuses an out-of-room cell
     * (`withTerrain`'s message), a REMOVE on an empty cell and a malformed
     * attrs object — none of them is a modification, so none of them counts as
     * an edit. ⛓ Trap 263 the maze paid for: the count, the certification and
     * the "this URL is no longer a reproduction" clause must move only for a
     * click that CHANGED something.
     */
    async function runEdit(tool, at) {
        busy(true);
        try {
            if (!lifetime.alive() || !state?.record) return;
            let op;
            try {
                op = editOpFor(tool, at);
            } catch (e) {
                $('status').className = 'bad';
                $('status').textContent = `the ${tool} edit was REFUSED — ${e.message}`;
                return;
            }
            let next;
            try {
                next = editState(state, op);
            } catch (e) {
                $('status').className = 'bad';
                $('status').textContent = `the ${tool} edit at (${at.tx},${at.ty}) was `
                    + `REFUSED — ${e.message}`;
                return;
            }
            /**
             * ⛓⛓⛓ TRAP 263, WHICH THE MAZE PAGE PAID FOR ONCE (§10.6 defect 2):
             * a click that CHANGED NOTHING is not an edit. `editState` returns
             * the SAME state object when the record did not move, so this is an
             * identity check and not a flag a caller could forget — and the
             * count, the certification and the "this URL is no longer a
             * reproduction" clause all stay put. ⚠ SAID, not silently nothing.
             */
            if (next === state) {
                $('status').className = '';
                $('status').textContent = `the ${tool} click at (${at.tx},${at.ty}) changed `
                    + 'NOTHING, so it is not an edit — the count, the certification and the '
                    + 'identity line are unmoved. ⚖ §3.8 is a law about CHANGES.';
                return;
            }
            state = next;
            certified = null;
            await show(describeEdit(op));
        } finally {
            busy(false);
            updateEditButtons();
        }
    }

    /**
     * The tool + the form → ONE op. ⛔ The JSON box is parsed HERE and its
     * refusal is the reader's own text, because a page that silently treated
     * unparseable attributes as `{}` would place an entity nobody asked for.
     */
    function editOpFor(tool, at) {
        if (tool === 'paint') {
            return { op: 'paint', tx: at.tx, ty: at.ty, terrain: $('genEditTerrain').value };
        }
        if (tool === 'remove') return { op: 'remove', tx: at.tx, ty: at.ty };
        const raw = $('genEditAttrs').value.trim();
        let attrs;
        try {
            attrs = raw === '' ? {} : JSON.parse(raw);
        } catch (e) {
            throw new Error(`the attributes box does not parse as JSON (${e.message}). `
                + 'It is a literal OEL attribute set — e.g. {"tset":"0","tag":"-1"} — and '
                + 'nothing here derives an activator group for you.');
        }
        if (tool === 'attrs') return { op: 'attrs', tx: at.tx, ty: at.ty, attrs };
        return { op: 'place', tx: at.tx, ty: at.ty, type: $('genEditType').value.trim(), attrs };
    }

    /**
     * ⛔ READ THE FORM, AND RESET THE LADDER IF ITS IDENTITY CHANGED.
     *
     * The seed IS the level's identity (⚖ kickoff §5). Pressing STEP after
     * retyping the seed must not continue somebody else's ladder: step 3 of
     * seed 9 followed by step 4 of seed 10 is a display that has never shown
     * a level any single run produces. So a changed seed or biome RESETS to
     * the skeleton and SAYS so — the same shape as the SOLVE arm re-reading
     * its own textarea at press time (⛓ slice 5 of the editor arc, whose
     * whole finding was a control that edited a value nobody read).
     */
    function readForm() {
        /**
         * ⛔ AND THE PAYLOAD STOPS OWNING THE URL HERE, AT THE FIRST PRESS.
         *
         * `?gen=` is an IDENTITY: it names a file whose seed/biome/bounds
         * REPLACE the URL's, so a URL carrying both it and the form's values
         * would hold two spellings of one run — exactly what this slice
         * exists to end. A press means the state on screen is the page's own
         * from now on (the step it reaches, under the bounds the form now
         * holds), so `gen` goes and the explicit parameters take over.
         *
         * ⚠ THE PRESS, NOT THE EDIT. "Did the form move away from the
         * payload's values" would be a THIRD place that knows what the
         * payload's identity is, and it would still have to answer for a
         * press that changes the STEP without changing a field.
         */
        payloadDropped = payloadDropped || Boolean(payload);
        payload = null;
        const nextSeed = Number($('genSeed').value);
        const nextBiome = $('genBiome').value;
        /**
         * ⛓⛓ CONSTRUCTIVE-MODE SLICE 5 — THE SKELETON KIND JOINS THE
         * IDENTITY, so a change to it RESETS the ladder exactly as a changed
         * seed or biome does. ⛔ The reason is the same and it is not a
         * convenience: step 3 of a `winding` room followed by step 4 of an
         * `open` one is a display that has never shown a level any single run
         * produces. ⚠ Read from the SELECT at the press, never cached.
         */
        const nextKind = $('genSkeleton').value;
        /**
         * ⛓⛓ SLICE 7 — AND ITS PARAMETERS, on exactly the same terms. A
         * `minRoom` change builds a DIFFERENT ROOM, so step 3 of `minRoom=2`
         * followed by step 4 of `minRoom=4` is a display no single run ever
         * produced — the same argument the kind itself makes.
         *
         * ⛔ The comparison is against the NORMALIZED spelling, so a form left
         * at its defaults does not read as a change on the first press.
         */
        /**
         * ⛓⛓⛓ SLICE 5a (D2) — RESOLVED, NOT NORMALIZED. The form's selects
         * ALWAYS name every knob the kind declares, so `readSkeletonParams`
         * hands the resolver a TYPED value for `chambers` — including a typed
         * 0, which `normalizeSkeleton` would have spelled by absence and
         * `seedlingSkeletonSpec` would then have re-defaulted to 1.
         */
        const nextSkeleton = seedlingSkeletonSpec({
            kind: nextKind, params: readSkeletonParams(nextKind),
        });
        /** ⛓ COMPARED IN THE BAR'S OWN SPELLING, so `chambers=0` and `chambers=1`
         *  read as the different rooms they are. */
        const spell = (spec) => formatSkeleton(spec,
            { explicit: seedlingExplicitSkeletonParams(spec?.kind) });
        /**
         * ── ⛓⛓⛓ R9 SLICE 0 — **AND THE SIX JOIN THE IDENTITY**, on exactly
         * ── the terms the seed, the biome and the skeleton are already on.
         *
         * The room, the fill, the area graph, the directive and the element are
         * ALL fixed before pass 2 runs: the room is the rectangle the carve
         * happens in, the element is stamped in BEFORE the carve and its draws
         * move the whole room stream, and the graph is built with the model. So
         * step 3 under one spelling followed by step 4 under another is a
         * display no single run ever produced — the ladder RESETS, and the
         * status line NAMES which control did it (⚖ §6 Q3's default).
         *
         * ⛔ EACH IS ADJUDICATED HERE, AT THE PRESS, BY ITS OWN GRAMMAR —
         * `assertRoomSize`, `fillByName`, `normalizeAreaSpec`,
         * `parseItemRequireList` — so a refusal is spoken under the name of the
         * value that caused it rather than surfacing three frames later out of
         * the writer. `pressForm` below is what turns the throw into the status
         * line.
         *
         * ⚠ AN EMPTY `#genRequire` IS **ABSENT**, NEVER `''`. `parseItemRequireList('')`
         * refuses by name (a directive somebody emptied is not the same as no
         * directive), so a box that mapped empty to the empty string would
         * refuse on the very first press of an untouched page.
         */
        const nextSize = assertRoomSize({
            width: Number($('genWidth').value),
            height: Number($('genHeight').value),
        }, 'the Seedling page');
        const nextFill = fillByName(fillSel.value, 'the Seedling page');
        const nextAreas = normalizeAreaSpec({
            keys: Number(areasSel.value), params: readAreaParams(),
        });
        const askedRequire = $('genRequire').value.trim();
        const nextRequire = askedRequire === '' ? null : parseItemRequireList(askedRequire);
        /**
         * ⛓ THE THREE-STATE ELEMENT CONTROL, mapped by the ONE pair of
         * inverses in `watchGenerate.js` — the view holds no second opinion
         * about what `(biome default)` means.
         */
        const elementsValue = elementsSel.value;
        const elementsIsHead = elementsValue !== ELEMENTS_CONTROL_DEFAULT
            && elementsValue !== ELEMENTS_CONTROL_LIST;
        const nextElements = elementsFromControl(elementsValue, {
            params: elementsIsHead ? readElementParams(elementsValue) : {},
            list: urlElementList,
        });
        const changedControls = [];
        if (nextSeed !== seed) changedControls.push('seed');
        if (nextBiome !== biome) changedControls.push('biome');
        if (spell(nextSkeleton) !== spell(skeleton)) changedControls.push('skeleton');
        if (nextSize.width !== size.width || nextSize.height !== size.height) {
            changedControls.push('room size');
        }
        if (nextFill !== fill) changedControls.push('fill');
        if (formatAreaSpec(nextAreas) !== formatAreaSpec(areas)) changedControls.push('areas');
        if (formatRequireList(nextRequire) !== formatRequireList(require)) {
            changedControls.push('require');
        }
        if (elementsAskSpelling(nextElements) !== elementsAskSpelling(elements)) {
            changedControls.push('elements');
        }
        seed = nextSeed;
        biome = nextBiome;
        skeleton = nextSkeleton;
        size = nextSize;
        fill = nextFill;
        areas = nextAreas;
        require = nextRequire;
        elements = nextElements;
        bounds = {
            obstacleTarget: Number($('genCount').value),
            triesPerStep: Number($('genTries').value),
            saturationK: Number($('genK').value),
            anchorTriesPerCandidate: Number($('genAnchorTries').value),
        };
        /**
         * ── ⛓⛓ THE SUB-ROSTER, READ AT THE PRESS LIKE EVERY OTHER CONTROL ──
         *
         * ⛔ THE WHOLE ROSTER IS SPELLED BY ABSENCE, never by a restriction
         * that names every member: `?templates=<all six>` and no parameter at
         * all would be two spellings of one setting, and they would give the
         * run two different NAMES (`summary.palette` carries the derived one).
         *
         * ⛓ AND THE COARSE SPELLING SURVIVES A PRESS THAT DID NOT CHANGE THE
         * SELECTION. A page loaded with `?families=water,weigh` whose boxes
         * still tick exactly that family's members keeps saying `?families=` —
         * rewriting it as `?templates=…` would silently FREEZE the membership
         * of a restriction whose whole point is that it is by family. The
         * moment the ticks say something else, the checkbox is what expressed
         * it, so the fine spelling is what names it.
         */
        const checked = checkedNames();
        if (checked.length === rosterBoxes().length) {
            roster = null;
        } else {
            const coarse = roster?.axis === 'families'
                ? restrictPalette(paletteFor(biome), roster).templates.map((t) => t.name)
                : null;
            const same = coarse !== null && coarse.length === checked.length
                && coarse.every((n) => checked.includes(n));
            if (!same) roster = { axis: 'templates', names: checked };
        }
        /** ⛓ R9 SLICE 0 — the answer is now WHICH controls moved, not just
         *  THAT one did: the status line names them (`resetReason`). `null` is
         *  *nothing changed*, and every caller reads it as the falsy it is. */
        return changedControls.length === 0 ? null : changedControls.join(', ');
    }

    async function goTo(target, why) {
        busy(true);
        try {
            if (step >= target) {
                // ⚠ SAID, not silently nothing. "The button did nothing" is
                // the one outcome a user cannot act on.
                $('status').className = '';
                $('status').textContent = `already at step ${step}, and the obstacle target `
                    + `is ${target} — raise the target, or press RESET to start over`;
                return;
            }
            for (let k = step + 1; k <= target; k += 1) {
                /**
                 * ⛔ THE DRIVER IS A LOOP TOO, and it is the one that spends
                 * SECONDS per iteration. It yields to the frame below, so a
                 * switch can land in the middle of a RUN-ALL — and a retired
                 * arm that kept going would generate levels nobody asked for
                 * and paint them over whatever now owns the canvas. Checked
                 * after every await, which is where ownership can have moved.
                 */
                if (!lifetime.alive()) return;
                $('status').className = '';
                $('status').textContent = `generating step ${k} of ${target} `
                    + `(seed ${seed}, ${biome})…`;
                // Yield a frame so the status paints BEFORE the synchronous
                // loop takes the thread — without it the page looks frozen
                // with the old text on it, which is a lie about what it does.
                await new Promise((r) => requestAnimationFrame(r));
                if (!lifetime.alive()) return;
                state = generateStep({ seed, biome, step: k, bounds, budget, roster, skeleton, elements, areas, require, size, fill });
                step = k;
                const out = await show(why);
                if (!out.drew) return;
                if (state.saturated) {
                    $('status').textContent += `  ·  SATURATED — ${bounds.saturationK} `
                        + 'consecutive step(s) kept nothing, so the loop stopped short of '
                        + `the target of ${bounds.obstacleTarget}`;
                    break;
                }
            }
        } finally {
            busy(false);
        }
    }

    const resetToSkeleton = async (why) => {
        /**
         * ⛓⛓ R9 SLICE 0 — **THE SENTENCE IS RECORDED, NOT JUST PRINTED.** The
         * status line is overwritten by the step that follows a reset, so a
         * browser row cannot read it there — and a reason nothing executes is
         * prose (trap 476). ⛔ ONE WRITER: whatever this reset was told, in the
         * words the reader saw.
         */
        lastResetReason = why ?? null;
        step = 0;
        // ⛓ A FRESH `generateStep` STATE CARRIES AN EMPTY DIRECTIVE LIST, so
        // the reset drops them BY CONSTRUCTION rather than by a second line
        // somebody could forget to write.
        state = generateStep({ seed, biome, step: 0, bounds, budget, roster, skeleton, elements, areas, require, size, fill });
        await show(why);
    };
    /**
     * ── ⛓⛓⛓ VERB 2's PRESS — ⚖ ruling 1's *"attempt to generate that
     * ── specific thing"* ─────────────────────────────────────────────────
     *
     * ⛔ IT DOES NOT TOUCH THE LADDER. A directive is applied to the record ON
     * SCREEN, at whatever step that is (including the skeleton), and it never
     * re-runs the loop — so the ladder's own identity is untouched and the
     * only thing that grows is the directive list.
     *
     * ⚠ THE FOUR OUTCOMES ARE REPORTED DISTINCTLY, with the refusal's VERBATIM
     * text in the pane. ⛔ And `ABORTED` still ABORTS: `applyDirective` lets a
     * `GenerationAborted` propagate, and this handler shows it as the fatal it
     * is rather than as "the attempt didn't work" (traps 171/173).
     */
    async function attempt(template, params, anchor = null) {
        busy(true);
        try {
            if (!lifetime.alive()) return;
            /**
             * ── ⛓⛓⛓ SLICE 11 — REFUSED BY NAME **BEFORE** THE PRESS SPENDS
             * ── ANYTHING (the ordering rule) ───────────────────────────────
             *
             * ⚖ v1's rule is *edits come AFTER all directives*, so a directed
             * attempt onto an edited level would make the construction order
             * unrecoverable from the payload's two lists.
             * `watchGenerate.applyDirective` refuses it as the STRUCTURAL
             * backstop; this is the page saying so first, with the sentence
             * that names the way out — the same shape as the empty-roster rule,
             * where the loop's own refusal stays and the page still tells you
             * before you spend a click.
             */
            if (state.edits.length) {
                $('status').className = 'bad';
                $('status').textContent = `⛔ REFUSED: the level on screen carries `
                    + `${state.edits.length} manual edit(s), and a directed attempt onto it `
                    + 'would make the construction ORDER unrecoverable — the payload carries '
                    + '`directives` and `edits` as two lists, which mean one construction '
                    + 'only because the order is ladder → directives → edits. UNDO the edits, '
                    + 'or download the payload first.';
                return;
            }
            const spec = {
                template,
                params,
                /**
                 * ⛓⛓⛓ SLICE 6: `null` is a SEARCH (the ATTEMPT button); a cell
                 * is a CLICK, and then the walk is ONE anchor long — which is
                 * why the bound goes with it rather than staying global.
                 */
                anchor,
                /**
                 * ⛔ NO `keepPolicy` SINCE ARC-3 SLICE 4c. Seedling runs every
                 * directive under `first-solved`: the three templates with a
                 * VERB retired into ELEMENTS, so `prefer-discharge` has nothing
                 * to prefer over. `applyDirective` REFUSES a spec that names
                 * one — see its docblock for the two reasons.
                 */
                bound: anchor ? 1 : DIRECTED_ANCHOR_TRIES,
            };
            $('status').className = '';
            $('status').textContent = `directed attempt: ${template} on step ${step} `
                + `(seed ${seed}, ${biome})`
                + (anchor ? ` at the CLICKED cell (${anchor.tx},${anchor.ty})` : '') + '…';
            await new Promise((r) => requestAnimationFrame(r));
            if (!lifetime.alive()) return;
            let next;
            try {
                next = applyDirective(state, spec, state.directives.length);
            } catch (e) {
                /**
                 * ⛔ AN ENGINE THROW IS A FINDING, NOT A REFUSAL. It arrives
                 * here only because `directedAttempt` refused to swallow it,
                 * and the page must not swallow it either — it is shown with
                 * the engine's own text and the level on screen is left alone.
                 */
                fatal(`the DIRECTED attempt for "${template}" ABORTED — the engine threw `
                    + 'something the oracle does not classify, which is a defect and not a '
                    + 'rejected candidate', e.message);
                return;
            }
            state = next;
            const d = state.directives[state.directives.length - 1];
            const out = await show(`ATTEMPT ${d.instance} → ${d.outcome}`);
            if (!out.drew) return;
            $('status').textContent += `  ·  ${d.outcome === 'KEPT'
                ? describeKeptKind(d)
                : `⛔ ${d.outcome} — the level on screen is UNCHANGED`}`
                // ⛓ SLICE 6: the same distinction `mountDirectives` draws — a
                // clicked cell is ONE named cell, not "1 of 1 LEGAL anchor(s)",
                // because the model may be exactly what refused it.
                + (d.anchor
                    ? `  ·  the EXPLICIT anchor (${d.anchor.tx},${d.anchor.ty}) — a CLICK, `
                        + 'not a search'
                    : `  ·  walked ${d.anchorsWalked} of ${d.anchorsOffered} legal anchor(s)`);
        } finally {
            busy(false);
        }
    }

    /**
     * ── ⛓⛓⛓ SLICE 6 — THE CLICK ITSELF (⚖ ruling 6's manual half) ─────
     *
     * ⛔ IT IS `.onclick =`, NOT `addEventListener`, so a later arm's own
     * assignment REPLACES this one rather than stacking beside it — the
     * convention every other control on this page follows. `lifetime.alive()`
     * is the second guard, for the case where no later arm claims the canvas.
     *
     * ⛔ AND IT DOES NOTHING WHEN NOTHING IS ARMED. A canvas that acted on
     * every click would make scrubbing a level into an edit of it.
     *
     * ⛓ THE CONVERSION IS `watchGenerate.tileAtPoint` — the ONE pixel-to-tile
     * mapping, given the ELEMENT's on-screen size and the ROOM's own
     * dimensions, so the answer is right at whatever integer scale the
     * renderer chose and whatever size CSS is presenting it at.
     */
    lifetime.on(window, 'keydown', (ev) => {
        if (ev.key !== 'Escape' || !armed) return;
        // ⛓ SLICE 11: ONE key clears BOTH kinds, because there is one variable
        // — a page with a second Escape for the brush would be a page where
        // "cancel" meant different things depending on what was pending.
        const what = armed.kind === 'template'
            ? 'AT… cancelled — nothing was placed'
            : `the ${armed.tool} tool was DISARMED — nothing was edited`;
        setArmed(null);
        $('status').className = '';
        $('status').textContent = what;
    });
    $('canvas').onclick = async (ev) => {
        if (!lifetime.alive() || !state?.record) return;
        const rect = $('canvas').getBoundingClientRect();
        let at = null;
        let refusal = null;
        try {
            at = tileAtPoint({
                x: ev.clientX - rect.left,
                y: ev.clientY - rect.top,
                width: rect.width,
                height: rect.height,
                cols: state.record.width,
                rows: state.record.height,
            });
        } catch (e) {
            refusal = e.message;
        }
        /**
         * ⛓⛓ SLICE 4 — `procgenLab:selectTile`, AND IT DOES NOT NEED AN ARM.
         * ⛔ The event says *"the reader pointed at this cell"*, which is the
         * only thing a host can act on; firing it only while ARMED would make
         * it mean "a directive was placed" under a name that says otherwise.
         * ⚠ The page's own behaviour is unchanged — the armed guard below is
         * exactly where it was, one statement further down.
         */
        if (at) hostBridge?.selectTile(at.tx, at.ty);
        if (!armed || busyNow) return;
        if (refusal !== null) {
            // ⚠ SAID, not swallowed — a click the page ignored silently is the
            // one outcome the reader cannot act on.
            $('status').className = '';
            $('status').textContent = refusal;
            return;
        }
        /**
         * ── ⛓⛓⛓ SLICE 11 — THE SECOND KIND, AND THE ONE ASYMMETRY BETWEEN
         * ── THEM: **AN EDIT TOOL STAYS ARMED, A TEMPLATE ARM DOES NOT** ─────
         *
         * ⛔ A template arm spends a SOLVE and is a one-shot: it disarms before
         * the attempt so a second click cannot queue a second directive behind
         * a running solve. An edit tool is a BRUSH — painting a corridor is
         * five clicks and re-arming between each would be a control that
         * fights its own purpose — so it survives the click and Escape (or the
         * `off` option) is how it ends. ⚠ `busyNow` still gates it, so a click
         * during the redraw cannot land a second op on a stale record.
         */
        if (armed.kind === 'edit') {
            await runEdit(armed.tool, at);
            return;
        }
        const { template, readParams } = armed;
        // ⛔ DISARMED BEFORE THE ATTEMPT, so a second click while the solve is
        // running cannot queue a second directive behind it.
        setArmed(null);
        await attempt(template, readParams(), at);
    };
    /**
     * ⚠ CLEARING IS A RESET TO THE LADDER, not an undo of one directive. There
     * is no undo in this arm and there must not be one: a directive's effect is
     * a NEW record, and the way back to the record before it is to rebuild the
     * construction without it — which is what re-running the ladder is.
     */
    $('genDirectivesClear').onclick = async () => {
        busy(true);
        try {
            const n = state.directives.length;
            // ⛓ SLICE 11: a fresh `generateStep` state carries an EMPTY EDIT
            // list too, so this drops the edits BY CONSTRUCTION exactly as it
            // has always dropped the directives — and SAYS so, because they are
            // the half no URL and no seed will bring back.
            const e = state.edits.length;
            const cleared = `CLEARED ${n} directive(s)`
                + (e ? ` and ${e} manual edit(s) — the edits are GONE (⚖ ruling 9: no URL `
                    + 'ever carried them)' : '');
            if (step === 0) {
                await resetToSkeleton(`${cleared} — back to the skeleton`);
            } else {
                state = generateStep({ seed, biome, step, bounds, budget, roster, skeleton, elements, areas, require, size, fill });
                await show(`${cleared} — back to seed ${seed}'s ladder at step ${step}`);
            }
        } finally {
            busy(false);
        }
    };
    /**
     * ⛓⛓ THE ONE SENTENCE THE LADDER BUTTONS SAY WHEN THEY RESET, and there
     * are now THREE reasons — a changed identity, a directive, and (slice 11) a
     * manual EDIT. ⛔ Written once: `genStep` and `genRunAll` had the same
     * two-branch literal, and a third branch added to one of them would have
     * been a page that explained itself differently depending on which button
     * you pressed.
     *
     * ⛓ WHY AN EDIT RESETS AT ALL: STEP is *"obstacleTarget = k, re-run"*, and
     * it is sound because a run to k is a strict PREFIX of a run to k+1. A hand
     * edit is not part of any run, so "re-run to k+1" cannot reproduce
     * *ladder-to-k + a painted wall* and then add one — the directives law,
     * one mechanism over, and for exactly the same reason.
     */
    const resetReason = (identityChanged) => {
        if (state.edits.length) {
            return `${state.edits.length} manual edit(s) were applied — RESET to the `
                + 'skeleton, because a run to step k is a prefix of a run to k+1 and that '
                + 'property does NOT cross a hand edit. ⚠ The edits are GONE: the URL never '
                + 'carried them (⚖ ruling 9), so download the payload first if you want them';
        }
        if (state.directives.length) {
            return `${state.directives.length} directive(s) were applied — RESET to the `
                + 'skeleton, because a run to step k is a prefix of a run to k+1 and '
                + 'that property does NOT cross a directive';
        }
        /**
         * ⛓⛓ R9 SLICE 0 — AND IT NAMES THE CONTROLS. `readForm` used to answer
         * *did the identity change*; it now answers *which of the eleven
         * run-defining controls moved*, and a reader who changed the FILL is
         * told that rather than being told about the seed. ⛔ Same sentence
         * shape, same one writer.
         */
        return identityChanged
            ? `the run's identity changed (${identityChanged}) — RESET to the skeleton, `
                + 'because these are what the level IS: a run to step k under one spelling '
                + 'is not a prefix of a run to k+1 under another'
            : 'RESET to the skeleton';
    };
    /**
     * ⛓⛓⛓ R9 SLICE 0 — **THE PRESS'S ONE READ, AND ITS ONE REFUSAL PATH.**
     *
     * `readForm` adjudicates six new values through their own grammars at the
     * press, and each of them can REFUSE (a room outside `[3..60]`, a fill that
     * is not a mode, an emptied directive, a parameter outside its domain). ⛔ A
     * throw out of an `onclick` is an unhandled rejection and a blank status
     * line — the one outcome a reader cannot act on — so the refusal is caught
     * HERE, said under the control's own name, and the press does NOT fall
     * through to a run nobody asked for.
     */
    const pressForm = () => {
        try {
            return { ok: true, changed: readForm() };
        } catch (e) {
            $('status').className = 'bad';
            $('status').textContent = `⛔ the form was REFUSED — ${e.message}`;
            return { ok: false, changed: null };
        }
    };
    $('genStep').onclick = async () => {
        // ⛓ THE LAW, SAID AGAIN AT THE MOMENT IT BITES. `updateRunButtons`
        // says it BEFORE the press; this says it in the status line after,
        // so the reset is never something the page just did quietly.
        const { ok, changed } = pressForm();
        if (!ok) return undefined;
        if (changed || state.directives.length || state.edits.length) {
            await resetToSkeleton(resetReason(changed));
        }
        return goTo(Math.min(step + 1, bounds.obstacleTarget), 'STEP');
    };
    $('genRunAll').onclick = async () => {
        const { ok, changed } = pressForm();
        if (!ok) return undefined;
        if (changed || state.directives.length || state.edits.length) {
            await resetToSkeleton(resetReason(changed));
        }
        return goTo(bounds.obstacleTarget, 'RUN-ALL');
    };
    $('genReset').onclick = async () => {
        if (!pressForm().ok) return;
        await resetToSkeleton('RESET — the skeleton');
    };

    /* ── ⛓⛓⛓ SLICE 5a — THE PHASE LADDER AND THE OVERLAY STEPPER ───────
     *
     * ⛔ EVERY ONE OF THESE IS A **VIEW** CONTROL: it re-DRAWS, it never
     * regenerates and it does not touch the ladder. ⛓ And they hand over: at
     * the LAST pass-1 row the label says *"pass 2 — use STEP"*, and today's
     * STEP (obstacleTarget = k, re-run) is unchanged.
     *
     * ⛓⛓⛓ **AND THE PHASE **IS** IN THE URL NOW — ⚖ THE USER, 2026-08-22.**
     * This comment used to end *"and it is not written to the URL (arc-1's law
     * for the maze's layer stepper, one substrate over)"*, and R9 slice 13
     * REVERSED that on the user's own item (iii): *"a URL parameter for the
     * PHASE so demo links deep-link to a phase"*. Eight entries in the demo
     * catalogue used to instruct a reader to press `PHASE ▶` until a label
     * matched; they now name the phase in the link.
     *
     * ⚠ THE OVERLAY STEPPER IS **NOT** COVERED BY THE REVERSAL and keeps
     * arc-1's law. The ruling was about the phase, and a display layer is not a
     * step of the construction — the thing a deep link has to be able to name.
     *
     * ⛔ ONE WRITER STILL, AND ONE `replaceState`: `goToPhase` calls
     * `rewriteUrl`, the same function `show()` calls. FINISHED is spelled by
     * ABSENCE, so a link to the default is byte-identical to every link ever
     * copied off this page.
     */
    const goToPhase = async (next) => {
        const rows = ledgerOf();
        if (!rows.length) return;
        const at = next === null ? null
            : Math.max(0, Math.min(rows.length - 1, next));
        /** ⛔ THE SELECTION IS SCOPED TO ITS ROW. A fact id is unique within a
         *  phase and not across them, so carrying ticks forward would paint a
         *  cell list from a phase the reader is no longer looking at. */
        if (at !== phaseIndex) selectedFacts = new Set();
        phaseIndex = at;
        if (at === null) {
            /** ⛓ BACK TO THE FINISHED LEVEL — through the page's ONE display
             *  path, so the level on screen is the level the state holds. */
            await show('back to the FINISHED level');
        } else {
            await showPhase();
            /**
             * ⛓⛓⛓ ⚖ ITEM (iii) — AND THE BAR FOLLOWS, THROUGH THE ONE WRITER.
             *
             * ⛔ `showPhase()` does NOT go through `show()`, which is where the
             * arm's only `replaceState` lives — so without this line the ladder
             * would move the page and leave the link naming the finished level.
             * It calls `rewriteUrl`, the same function `show()` calls; a second
             * `replaceState` here would be the drift the fixed-point rows exist
             * to catch, and is the mutant this line is measured against.
             *
             * ⚠ `at` IS PASSED, not read: `phaseIndex` is assigned above and
             * `showPhase` awaits, so the live variable is not reliably this
             * call's answer. The caller that knows passes it.
             */
            rewriteUrl(at);
        }
        // ⛓ A press that LANDS somewhere clears a standing `?phase=` refusal:
        // the readout's `why` describes the page now, not a URL it once had.
        phaseWhy = null;
    };
    /**
     * ⛓⛓⛓ ⚖ ITEM (iii) — `?phase=<name>` RESOLVED AGAINST **THIS** LADDER.
     *
     * ⛔ A NAME THAT IS NOT ON THIS LADDER IS REFUSED BY NAME AND THE PAGE
     * STAYS ON THE FINISHED LEVEL. It is not clamped to the nearest row, not
     * rounded to the first, not silently ignored: the refusal names the phase
     * that was asked for AND lists the phases this run actually recorded, in
     * the status line where the reader is looking and on the readout where a
     * row can assert it. ⚠ A clamp is the failure this repo keeps recording —
     * a URL that names something the page cannot show, showing something else
     * that looks right.
     *
     * ⚠ THE MATCH IS ON THE ROW'S OWN `.phase`, the same string the label
     * prints and the writer writes. Nothing here normalises case or trims: a
     * ladder row name is an identifier, and a reader who typed a near-miss is
     * better served by being told than by being guessed at.
     */
    const applyPhaseParam = async (asked) => {
        if (asked === null || asked === undefined || !lifetime.alive()) return;
        const rows = ledgerOf();
        const at = rows.findIndex((r) => r.phase === asked);
        if (at >= 0) { await goToPhase(at); return; }
        phaseWhy = `?phase=${asked} — this run's ladder has no such phase. It recorded `
            + `[${rows.map((r) => r.phase).join(', ')}]`;
        $('status').className = 'bad';
        $('status').textContent = `⛔ ${phaseWhy}`;
        // ⛔ REPUBLISHED so the readout carries the refusal too: a row that can
        // only read the status TEXT is asserting on a sentence, not on state.
        publishPhase();
        renderPhaseNote();
    };
    lifetime.on($('genPhase'), 'input', () => goToPhase(Number($('genPhase').value)));
    lifetime.on($('genPhasePrev'), 'click',
        () => goToPhase(phaseIndex === null ? ledgerOf().length - 1 : phaseIndex - 1));
    lifetime.on($('genPhaseNext'), 'click',
        () => goToPhase(phaseIndex === null ? 0 : phaseIndex + 1));
    lifetime.on($('genPhaseEnd'), 'click', () => goToPhase(null));
    /**
     * ⛓⛓⛓ ⚖ THE USER'S RULING OF 2026-08-18 — *"only display the visual
     * representation when the corresponding TEXT DESCRIPTION is selected"*. The
     * readout's lines ARE the control, and one generic painter draws whichever
     * are ticked; there is no per-fact drawing code and therefore no per-fact
     * hue vocabulary to keep in step.
     */
    lifetime.on($('genPhaseFacts'), 'change', async (e) => {
        const id = e.target?.dataset?.fact;
        if (!id) return;
        const row = phaseIndex === null ? null : ledgerOf()[phaseIndex];
        if (id === '__all') {
            selectedFacts = e.target.checked
                ? new Set((row?.data.facts ?? []).map((f) => f.id)) : new Set();
        } else if (e.target.checked) selectedFacts.add(id);
        else selectedFacts.delete(id);
        await showPhase();
    });
    const setLayer = async (next) => {
        genLayer = next;
        $('genLayer').value = next;
        if (phaseIndex === null) await show(`overlay: ${next}`);
        else await showPhase();
    };
    lifetime.on($('genLayer'), 'change', () => setLayer($('genLayer').value));
    lifetime.on($('genLayerNext'), 'click',
        () => setLayer(GEN_LAYERS[(GEN_LAYERS.indexOf(genLayer) + 1) % GEN_LAYERS.length]));
    /**
     * ⛔ THE DOWNLOAD IS THE CLI'S OWN PAYLOAD SHAPE, so a level generated in
     * the page can be handed straight back to `--gen=` (and to the batch's
     * report). A second shape here would be a second thing to keep in step.
     */
    /* ── ⛓⛓⛓ SLICE 11 — THE EDIT SECTION'S CONTROLS ────────────────────── */

    /**
     * ⛔ MOUNTED FROM THE MODULES' OWN VOCABULARIES, so this file keeps no
     * second list of what a terrain or an entity is: `procgenLevel.TERRAIN_NAMES`
     * is the four-terrain vocabulary and `watchEdit.ENTITY_ROSTER` is the
     * offered types with their reasons in the tooltips. ⚠ The type field is a
     * free `<input>` with the roster as a `<datalist>` and NOT a `<select>`,
     * which is §3.8(b) as a control: the world is the adjudicator, so a type
     * nobody offered must be typeable and must refuse from the ENGINE with its
     * own construction site rather than from a dropdown that never let you ask.
     */
    $('genEditTerrain').innerHTML = TERRAIN_NAMES
        .map((t) => `<option value="${t}">${t}</option>`).join('');
    const typeList = $('genEditTypes');
    typeList.innerHTML = '';
    for (const e of ENTITY_ROSTER) {
        const o = document.createElement('option');
        o.value = e.type;
        o.label = e.why;
        typeList.appendChild(o);
    }
    $('genEditType').value = ENTITY_ROSTER[0].type;
    $('genEditAttrs').value = JSON.stringify(ENTITY_ROSTER[0].attrs);
    /**
     * ⚠ THE ATTRS BOX FOLLOWS THE TYPE ONLY WHEN THE TYPE IS ONE THE ROSTER
     * KNOWS — a suggestion, not a rewrite: a free type leaves whatever you had
     * typed standing, because the page has nothing to suggest for it.
     */
    lifetime.on($('genEditType'), 'change', () => {
        const row = ENTITY_ROSTER.find((e) => e.type === $('genEditType').value.trim());
        if (row) $('genEditAttrs').value = JSON.stringify(row.attrs);
    });
    // ⛔ THROUGH THE ONE WRITER. The select is a VIEW of `armed` (see
    // `renderArmed`), so this hands it the value and reads nothing back.
    lifetime.on($('genEditTool'), 'change', () => {
        const tool = $('genEditTool').value;
        setArmed(EDIT_OPS.includes(tool) ? { kind: 'edit', tool } : null);
    });
    $('genEditUndo').onclick = async () => {
        busy(true);
        try {
            const n = state.edits.length;
            if (n === 0) return;
            state = undoEdit(state);
            /**
             * ⛔ UNDO DOES **NOT** RESTORE A CERTIFICATION. The oracle has still
             * not been asked about the record now on screen — it happens to be a
             * record it once certified, but "once solved a record equal to this"
             * and "solved this" are the same fact only if nothing else moved,
             * and a page is not entitled to that inference. The maze page's own
             * rule (`undoEdit`: *uncertified stays uncertified*).
             */
            certified = null;
            await show(`UNDO — ${n - 1} manual edit(s) remain`);
        } finally {
            busy(false);
        }
    };
    /**
     * ⛓⛓⛓ THE SOLVE PRESS — §3.8(b)'s other half, and the ONLY thing that can
     * certify an edited level. ⛔ It runs `displaySolve`, which is
     * `procgenSeedling.seedlingOracle` over the CURRENT record with the KEPT
     * TEMPLATES' pin union — the same oracle the loop used, not a second one.
     *
     * ⚠ THE PINS ARE THE KEPT TEMPLATES', AND THAT IS SAID OUT LOUD: a
     * hand-placed entity has no template, so it contributes no pin. A water
     * pool painted by hand does NOT oblige `'sound'` the way the water TEMPLATE
     * does — the pin union is a fact about what the loop drew, and inventing a
     * pin for a hand edit would certify the room under an inventory nobody
     * asked for.
     */
    $('genEditSolve').onclick = async () => {
        busy(true);
        try {
            if (!state?.record) return;
            await show('SOLVE — certifying the record on screen', { certifying: true });
        } finally {
            busy(false);
        }
    };
    $('genDownload').onclick = () => {
        if (!lastPayload) return;
        const blob = new Blob([`${JSON.stringify(lastPayload, null, 2)}\n`],
            { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `generated-s${seed}-${biome}-c${step}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    // ── the skeleton, before anything is drawn ───────────────────────────
    state = generateStep({ seed, biome, step: 0, bounds, budget, roster, skeleton, elements, areas, require, size, fill });
    await show('the SKELETON');

    if (gp.run || payload) {
        await goTo(bounds.obstacleTarget, payload ? '?gen= reproduction' : 'RUN-ALL (?run=1)');
    }
    /**
     * ── ⛓⛓⛓ THE PAYLOAD'S DIRECTIVES, REPLAYED (slice 5, re-channelled 12) ─
     *
     * ⛔ AFTER the ladder and BEFORE the payload check, because that is the
     * order the identity is defined in: *seed S's ladder to step k, THEN N
     * directed attempts*. A payload comparison taken before the directives
     * were applied would be comparing a prefix to a whole.
     *
     * ⛔ THE SAME `applyDirective` A PRESS USES, AT THE SAME INDICES. One
     * construction path (`watchGenerate.generateWithDirectives` is the CLI's
     * and the tests' entry into it), so a loaded payload and a hand-pressed
     * sequence cannot produce different levels.
     *
     * ⛓ SLICE 12: the source is `payload.directives` — `?directed=` is gone
     * from the bar, so this is the ONLY channel a directive list travels on
     * into a fresh page, and the edits below ride the same one.
     */
    if (pendingDirected?.length && lifetime.alive()) {
        for (const [i, spec] of pendingDirected.entries()) {
            if (!lifetime.alive()) return;
            $('status').className = '';
            $('status').textContent = `?gen= replaying directive ${i + 1} of `
                + `${pendingDirected.length}: ${spec.template}…`;
            await new Promise((r) => requestAnimationFrame(r));
            if (!lifetime.alive()) return;
            state = applyDirective(state, spec, i);
        }
        pendingDirected = null;
        const out = await show(`?gen= — ${state.directives.length} directive(s) replayed`);
        if (!out.drew) return;
    }
    /**
     * ── ⛓⛓⛓ SLICE 11 — THE PAYLOAD'S OWN EDITS, REPLAYED ──────────────────
     *
     * ⛔ AFTER the ladder and the directives, because that is the order the
     * identity is defined in (`applyDirective`'s backstop): *seed S's ladder to
     * step k, THEN N directed attempts, THEN E manual edits.*
     *
     * ⛓⛓ **AND THE ASYMMETRY SLICE 11 RECORDED IS GONE** (slice 12, ⚖ §3.9).
     * It used to be that a directive was expressible in a URL (`?directed=`)
     * and an edit was not, so `?gen=` replayed the edits and left the
     * directives to the bar. The user's ruling removed the parameter, so BOTH
     * legs now travel on the payload and are replayed here in the identity's
     * own order. ⇒ `?gen=` and `procgenLab:load` REPRODUCE a directed AND
     * edited level byte for byte, and the cross-runtime determinism claim
     * covers the whole construction rather than two thirds of it.
     *
     * ⛔ THROUGH `watchEdit.editStates` — the SAME fold the click handler, UNDO
     * and `generateWithDirectives({edits})` use. One reconstruction.
     *
     * ⚠ AND THE RESULT IS **UNCERTIFIED**, whatever the file claimed: `show()`
     * runs its no-solve pass on an edited state, so a payload with
     * `certified: true` in it does not certify anything here. A file's own
     * certification is somebody else's assertion (the maze row's claim 7).
     */
    if (payload?.edits?.length && lifetime.alive()) {
        $('status').className = '';
        $('status').textContent = `?gen= replaying ${payload.edits.length} manual edit(s)…`;
        await new Promise((r) => requestAnimationFrame(r));
        if (!lifetime.alive()) return;
        state = editStates(state, payload.edits);
        certified = null;
        const out = await show(`?gen= — ${state.edits.length} manual edit(s) replayed`);
        if (!out.drew) return;
    }
    if (gp.run || payload) {
        if (payload) {
            /**
             * ⛔ CHECKED AT THE TARGET AND REPORTED EITHER WAY. A payload that
             * matches is a determinism statement across node and the browser;
             * one that does not is a FINDING, and the page keeps showing what
             * IT generated.
             */
            payload.__check = agreementWithPayload(payload, state);
            await show(payload.__check.agrees
                ? '?gen= reproduced byte-identically'
                : `⛔ ?gen= DIFFERS in [${payload.__check.differences.join(', ')}]`);
        }
    }
    /**
     * ── ⛓⛓⛓ ⚖ ITEM (iii) — THE DEEP LINK, APPLIED **LAST** ────────────
     *
     * ⛔ AFTER EVERYTHING, BECAUSE THE LADDER MUST EXIST. `?phase=` names a row
     * of a ledger the model records while it runs; applied before RUN-ALL, the
     * directives or the payload's edits, it would be resolved against a ladder
     * that is one, three or ten rows shorter than the one the reader is about
     * to be handed — and would land on a different picture on a link that named
     * a real phase. The generation has to finish first.
     *
     * ⛔ AND IT GOES THROUGH `goToPhase`, THE SAME FUNCTION THE BUTTONS CALL.
     * A deep link is a press the URL made; a second path to the phase would be
     * a second chance to disagree with the one the reader can produce by hand.
     */
    await applyPhaseParam(gp.phase);
}

/**
 * ⛓⛓⛓ THE GENERATE SHIP'S PAYLOAD — a ONE-ROOM set, its chunks, and the
 * certification tape rebooted into room 0.
 *
 * ⛔ IT LIVES AT MODULE LEVEL, not inside `runGenerate`, for one reason: it is
 * the only part of the ship a unit test could ever reach without a browser,
 * and burying it in a 1,200-line arm closure would make it reachable only
 * through the DOM. The arm hands it `state` and the display solve; everything
 * else it derives from those two.
 *
 * ⛔ EVERY REFUSAL IS A THROW WITH THE PRODUCER'S OWN MESSAGE. `shipToWasmNow`
 * turns it into the `payload` stage's named refusal, so "the set would not
 * validate" and "the game rejected the tape" are different findings with
 * different names — which is the whole of the stage machine's promise.
 */
function buildGenerateShip(state, solved) {
    const entryName = `${state.biome}_seed${state.seed}_step${state.step}`;
    const { set } = buildLevelSet(
        [{ seed: state.seed, record: state.record, summary: state.summary, name: entryName }],
        {
            setId: `watch-oneroom-${state.biome}-${state.seed}-${state.step}`,
            generator: 'watch.html ▶ load in wasm',
            provenance: {
                biome: state.biome, seed: state.seed, step: state.step, bounds: state.bounds,
            },
        },
    );
    const v = validateLevelSet(set);
    if (!v.ok) {
        throw new Error(`the one-room set would not validate on the SENDER: ${v.errors.join(' | ')}`);
    }
    const { chunks, oversized } = planLevelSetChunks(set);
    if (oversized.length) {
        throw new Error('a room exceeds the proven chunk envelope on its own: '
            + JSON.stringify(oversized));
    }
    /**
     * ⛓ THE SET'S ORDER IS ITS IDENTITY — position is the room id, which is
     * `buildLevelSet`'s own rule. One entry, so the order is one record.
     */
    const mapped = roomOfGeneratedLevel(state.record.level, set.rooms.length,
        [state.record.level]);
    if (mapped.room === null) throw new Error(mapped.why);
    /**
     * ⛔ THE MODEL'S END STATE COMES FROM THE **UNREMAPPED** TAPE, walked in
     * the level source that HAS level 900 — the model has no room 0 to walk.
     * Only the expectation's `level` is remapped; its x, y and items are the
     * model's own. Walking the remapped tape here would ask the JS engine for
     * a room it does not have and refuse.
     */
    const walked = collectRun(solved.tape, levelSourceFromAtlas(atlasOf(state.record)),
        { scratchPersistence: true });
    if (walked.error) {
        throw new Error('the JS model would not re-walk the certification tape, so there is '
            + `no end state to compare against: ${walked.error.message}`);
    }
    const modelEnd = expectFromFrames(walked.frames);
    /**
     * ⛓⛓⛓ AND THE WHOLE STREAM, REMAPPED THE SAME WAY THE EXPECTATION IS.
     *
     * ⛔ EVERY observation of a generated walk carries level 900, not just the
     * last one — so the per-tick differential needs the remap applied across
     * the stream, through the ONE function that owns it. A raw comparison would
     * print `tick 0 differs: … level=900 … level=0` on a ship that worked
     * perfectly, which is a verdict about two id spaces at every tick instead
     * of at one (§18.15.3's reason, one instrument further along).
     */
    const modelStream = remapStreamRooms(modelStreamOf(walked), set.rooms.length,
        [state.record.level]);
    return {
        levelSet: set,
        chunks,
        // ⛓ The generated room REPLACES the vanilla set as room 0, so the tape
        // that certified it boots there.
        tape: { ...solved.tape, boot: { ...solved.tape.boot, level: mapped.room } },
        expect: { ...modelEnd, level: mapped.room },
        modelStream,
        modelStreamWhy: null,
        label: `${entryName} — the certification tape, in a ONE-ROOM set (${set.set_id})`,
        note: mapped.why,
    };
}

// ── ▶ LOAD IN WASM — the button, and what each arm hands it ──────────────

/**
 * ── ⛓⛓⛓ WHAT THIS PAGE HOLDS THAT COULD BE SHIPPED, OR WHY NOT ───────
 *
 * ⛔ IT IS A **BUILDER**, NOT A PAYLOAD. The block a MANUAL ship sends is
 * whatever is in the box AT PRESS TIME — the same law `solveNow` learned the
 * hard way (slice 5: the arm solved a closure copy while the page showed an
 * editable one, so every edit anybody made was silently discarded). A payload
 * captured when the arm mounted would ship the room you arrived in, and it
 * would look exactly like a working ship.
 *
 * ⛔ AND THE DISABLED STATE CARRIES ITS REASON. "Greyed out" is a refusal with
 * no name on it — the reader cannot tell "press SOLVE first" from "this level
 * would not certify" from "the arm has not finished mounting". `why` is the
 * button's `title` and the note beside it (trap 403's shape, at the control
 * rather than at the readout).
 *
 *   what    one line: what pressing it will send
 *   why     one line: what is missing, when nothing can be sent
 *   build   `() => payload` for `shipToWasm`, re-read at press time
 */
let shippable = null;

/** The disabled reason each arm starts a mount with. */
const NOTHING_TO_SHIP = Object.freeze({
    replay: 'REPLAY ships through the ENGINE selector — pick `wasm` above',
    solve: 'no solve yet — press SOLVE, then this ships the tape it produced',
    manual: 'the boot panel has not mounted yet',
    generate: 'no generated level yet — STEP or RUN-ALL first',
});

function setShippable(next) {
    shippable = next && next.build ? next : null;
    const btn = $('loadWasm');
    if (!btn) return;
    btn.disabled = !shippable;
    btn.title = shippable ? shippable.what : (next?.why ?? 'nothing to ship');
    $('loadWasmNote').textContent = shippable ? '' : (next?.why ?? '');
}

/**
 * ⛓ THE JS MODEL'S END STATE, from the frames the page already collected.
 *
 * ⛔ ONE DERIVATION. `collectRun` is what `replayTape` walks and what the
 * GENERATE arm re-walks for its certification tape, so both callers read the
 * SAME last frame rather than each forming an opinion about where the model
 * ended.
 */
function expectFromFrames(frames) {
    const f = frames[frames.length - 1];
    if (!f) return null;
    return {
        level: f.observation.level,
        x: f.observation.x,
        y: f.observation.y,
        // ⚠ The inventory the frame carries, not a set of names: `verdictOf`
        // reads it exactly as it reads `botStatus.items`, so "held" means one
        // thing on both sides of the comparison.
        items: f.inventory ?? {},
    };
}

/**
 * ⛓ THE SHIP'S OWN READOUT — its own block, beside the JS run's, never over it.
 *
 * ⛔ `#status` AND `#hud` ARE NOT TOUCHED. In SOLVE they hold the solve's tick
 * count and the scrub HUD; in GENERATE they hold the identity line and the
 * certification. ⚖ D3 puts the wasm verdict BESIDE those, and a ship that
 * painted over them would delete the very thing the verdict is compared with.
 */
/**
 * ⛓⛓ WHAT A SHIP PUBLISHES — **ONE SPELLING, BOTH READOUTS.**
 *
 * The button's panel and REPLAY's shared chrome paint different things on
 * purpose (⚖ D3), but "what a ship published" must not be two answers: the
 * browser rows read `__watch.wasm`, not the DOM, and a channel that existed in
 * one arm and not the other would make a REPLAY per-tick verdict unassertable
 * — which is exactly the witness ⚖ D4 wants it for.
 */
function publishShip(state, source, lifetime) {
    window.__editorWasm = {
        stage: state.stage ?? null,
        stages: state.stages ?? [],
        reached: [...(state.reached ?? [])],
        refusal: state.refusal ?? null,
        verdict: state.verdict ?? null,
        /** ⛓ What the game handed over, as COUNTS — the rows read `__watch`. */
        drain: state.drain ?? null,
        /**
         * ⛓⛓⛓ **THE VERDICT'S OWN NOTE** (SEEDLING BOT R9, slice 1, E5-bucket
         * item E3). `verdictBlock(v, state.note)` paints it beside the verdict —
         * *"level remapped 900→0"* is the live example — and until this slice
         * the projection dropped it, so the ship row had to REGEX
         * `verdictText`, i.e. assert a fact about the mapping by pattern-matching
         * the painted string. ⛔ A claim about what the readout NAMES still has
         * to read the readout; a claim about WHICH MAPPING WAS APPLIED is about
         * the ship, and now has a field of its own.
         */
        note: state.note ?? null,
        label: state.label ?? null,
        set: state.set ?? null,
        status: state.status ?? null,
        scope: VERDICT_SCOPE,
        /**
         * ⛓⛓⛓ R9 SLICE 2 — THE SEQUENCE'S OWN ROWS (⚖ ruling 10). One entry per
         * window: its admission findings, its per-window verdict, its
         * `continuationFindings` (`dead_frames` MUST be 0 on a continuation
         * window — a window that never left one room and paid a fade was
         * REBUILT), the keys the boundary released and whether the player MOVED
         * across it. ⛔ Carried, never recomposed: trap 440 is `publishShip`
         * dropping a field the caller owned, and this is the same field one
         * shape up.
         */
        windows: state.windows ?? [],
    };
    if (lifetime.alive()) publishWatch(source);
}

function shipReadout(source, lifetime) {
    const paintStages = (state) => {
        $('wasmStages').textContent = state.stages
            .map((s) => (state.reached.includes(s) ? `✓ ${s}` : `· ${s}`)).join('   ');
    };
    const publish = (state) => publishShip(state, source, lifetime);
    return {
        onStage(stage, message, state) {
            $('wasmStage').textContent = `${stage} — ${message}`;
            paintStages(state);
            publish(state);
        },
        onRefusal(stage, reason, detail, state) {
            $('wasmStage').textContent = `⛔ REFUSED at ${stage}: ${reason}`;
            $('wasmVerdict').textContent = detail;
            $('wasmVerdict').className = 'bad';
            paintStages(state);
            publish(state);
            $('loadWasm').disabled = !shippable;
        },
        onTick(st, tape) {
            // ⛔ NO `state.status = st` HERE. `shipToWasm`'s poll already wrote
            // it before calling this; a second writer of one field is exactly
            // the shape this page keeps paying for.
            $('wasmHud').innerHTML = wasmHudRows(st, tape);
        },
        onVerdict(v, state) {
            paintStages(state);
            $('wasmVerdict').className = v.agrees === false ? 'bad' : (v.agrees ? 'ok' : '');
            /**
             * ⛔⛔ THE SCOPE RIDES WITH THE VERDICT, ALWAYS. An `agrees` with no
             * bound beside it reads as "the real game reproduced the model",
             * which is a claim this comparison cannot make: it looks at ONE
             * frame and two runs can meet there having disagreed on every tick
             * in between.
             */
            /**
             * ⛓⛓ TWO LINES NOW, EACH WITH ITS OWN SCOPE, and `verdictBlock` is
             * where that layout lives so the unit rows assert the printed text
             * rather than a reconstruction of it. The END-STATE line is never
             * dropped: it is the check that ran FIRST and the one a
             * `verdict-internally-inconsistent` is inconsistent WITH.
             */
            $('wasmVerdict').textContent = verdictBlock(v, state.note);
            publish(state);
            $('loadWasm').disabled = !shippable;
        },
    };
}

/**
 * ⛓ PRESS IT. One ship at a time, and each one starts from a fresh iframe.
 *
 * ⛔ THE BUTTON IS DISABLED FOR THE DURATION rather than queueing a second
 * ship. The wasm cannot rewind, so two ships in flight would be two runs
 * writing one readout — and the second one's `botStatus` would describe a
 * world the first one left behind.
 */
async function shipToWasmNow(source, lifetime) {
    if (!shippable || !lifetime.alive()) return null;
    const btn = $('loadWasm');
    btn.disabled = true;
    $('wasmPanel').hidden = false;
    $('wasmVerdict').className = '';
    $('wasmVerdict').textContent = '';
    $('wasmHud').innerHTML = '';
    const readout = shipReadout(source, lifetime);
    let payload;
    try {
        payload = await shippable.build();
    } catch (e) {
        /**
         * ⛔ A PAYLOAD THAT WOULD NOT BUILD IS A NAMED STAGE TOO. It happens
         * BEFORE `shipToWasm` gets a chance to name one — an unparseable boot
         * block, a set that will not validate — and an unnamed failure here
         * would be the one hole in the stage machine.
         */
        readout.onRefusal('payload', 'the page could not build a payload', e.message, {
            stage: 'payload', stages: WASM_STAGES, reached: [],
            refusal: { stage: 'payload', reason: 'payload-would-not-build', detail: e.message },
            verdict: verdictOf(null, null, END_STATE_TOLERANCE,
                { refusal: { reason: 'payload-would-not-build' } }),
            label: shippable.what, set: null, status: null,
        });
        return null;
    }
    return shipToWasm(payload, {
        frame: $('frame'), lifetime, readout, tolerance: END_STATE_TOLERANCE,
    });
}

/**
 * ⛓ WIRE THE BUTTON FOR THIS MOUNT — and RESET it, which is the half that
 * matters. An arm that arrives holding nothing must not inherit the previous
 * arm's `shippable`: pressing it would ship the run you switched away from.
 */
function wireShipButton(params, lifetime) {
    setShippable({ why: NOTHING_TO_SHIP[params.source] ?? 'this arm holds nothing shippable' });
    $('loadWasm').onclick = () => shipToWasmNow(params.source, lifetime);
}

// ── side=wasm ────────────────────────────────────────────────────────────

/**
 * ⛓⛓⛓ THE REPLAY ARM IS NOW A **CALLER** OF `watchWasm.shipToWasm`.
 *
 * ⛔ THE MECHANISM MOVED, THE BEHAVIOUR DID NOT. Every string this arm printed
 * it still prints, in the same order, at the same stage — because what moved
 * is the SEQUENCE (probe → runtime → the user's Start → tape → running →
 * finished) and what stayed is the READOUT, which is now an interface this
 * function supplies. `check-seedling-wasm-pages.mjs` reads those exact strings
 * off the live DOM and is the gate on that claim.
 *
 * ⛔ AND THE READOUT HAD TO BECOME AN INTERFACE RATHER THAN A DEFAULT. The
 * ▶ load-in-wasm button ships from SOLVE, MANUAL and GENERATE, where `#status`
 * and `#hud` already hold the JS run's own answer — a ship that painted them
 * would delete the certification it is meant to be printed BESIDE (⚖ D3).
 * REPLAY is the one arm that owns the whole page, so it is the one arm whose
 * readout writes there.
 */
async function runWasm(params, lifetime) {
    // ⛓ R9 slice 2: `?tapes=` selects the SEQUENCE, on this side too.
    if (params.tapes !== null) return runWasmSequence(params, lifetime);
    const tape = await fetchJson(repoUrl(params.tape), 'tape');
    const frame = $('frame');
    /**
     * ── ⛓⛓⛓ ⚖ D4 — REPLAY GETS THE PER-TICK VERDICT FREE, AND IT IS THE
     * ── CHEAPEST WITNESS THERE IS ────────────────────────────────────────
     *
     * A committed tape's stream is KNOWN: the r8-* fixtures carry RECORDED
     * oracle streams, and `tapeRunner.test.js` already pins the model against
     * them. So a divergence printed here is attributable without generating or
     * solving anything, which is what makes this arm the one to run first when
     * the verdict ever goes red.
     *
     * ⛔ AND IT MAY NOT COST THE ARM ITS EXISTING BEHAVIOUR (⚖ D4's second
     * half). The walk is WRAPPED: an atlas that will not load, or a committed
     * tape the JS engine refuses (a legacy fixture, an undeclared clear),
     * degrades to `no per-tick comparison (<the reason>)` — and every string
     * this arm has always printed is still printed, in the same order, because
     * none of this touches the readout.
     */
    let modelStream = null;
    let modelStreamWhy = null;
    let expect = null;
    try {
        const collected = collectRun(tape, pageLevelSource(await loadAtlas()));
        if (collected.error) throw collected.error;
        modelStream = modelStreamOf(collected);
        expect = expectFromFrames(collected.frames);
    } catch (e) {
        modelStreamWhy = `the JS model would not walk this tape — ${e.message}`;
    }
    if (!lifetime.alive()) return;
    await shipToWasm(
        {
            tape,
            label: params.tape,
            expect,
            expectWhy: expect ? null : (modelStreamWhy ?? 'replay'),
            modelStream,
            modelStreamWhy,
        },
        {
            frame,
            lifetime,
            readout: replayWasmReadout(lifetime, params.source),
            tolerance: END_STATE_TOLERANCE,
        },
    );
}

/** One HUD row, in the wasm arm's own spelling. */
const wasmRow = (k, v) => `<div class="r"><span>${k}</span><b>${v}</b></div>`;

/**
 * ⛓ THE LIVE `botStatus` BLOCK AS HUD ROWS — ONE rendering, two consumers.
 *
 * REPLAY paints it into the shared `#hud`; a SHIP paints it into its own
 * `#wasmHud` beside the JS run's. ⛔ A second copy of these eleven rows would
 * be two opinions about what the game is reporting, and the one nobody looks
 * at is the one that would rot.
 */
function wasmHudRows(st, tape) {
    const items = st.items || {};
    return [
        wasmRow('tick', `${st.tick ?? '?'} / ${tape.tick_count}`),
        wasmRow('level', st.level ?? '?'),
        wasmRow('position', `${fmt(st.x)}, ${fmt(st.y)}`),
        // Shown, not elided: the fade frames are real frames the tick counter
        // skips, and how many there were is a fact about the run.
        wasmRow('dead frames', st.dead_frames ?? 0),
        wasmRow('receive input', String(st.receive_input)),
        wasmRow('saw input refused', String(st.saw_input_refused)),
        wasmRow('auto advance', st.saw_auto_advance ?? 0),
        wasmRow('grants', (st.grants || [])
            .map((g) => `L${g.level} ${(g.items || []).join('+')}@${g.t}`).join(' ') || '—'),
        wasmRow('items', Object.entries(items)
            .filter(([k, v]) => v === true && k !== 'hitsMax')
            .map(([k]) => k).join(' ') || '—'),
        wasmRow('hitsMax', items.hitsMax ?? '?'),
        wasmRow('finished', String(st.finished)),
    ].join('');
}

/**
 * ⛓ THE REPLAY ARM'S READOUT — the page's shared chrome, with the strings it
 * has always printed.
 *
 * ⚠ `onStage('runtime')` IS DELIBERATELY QUIET. The original sequence printed
 * "loading the runtime…" when the frame was pointed at the build and the
 * "press ▶ Start" line only once the runtime was up and the wait was about to
 * begin — which is `probe` and `start` here. A line at `runtime` would be a
 * third readout state the live row has never seen.
 */
function replayWasmReadout(lifetime, source = 'replay') {
    /**
     * ⛓ THE CHANNEL, NOT THE CHROME. This arm's `#status` strings are what the
     * live pages row asserts on and none of them move; what is ADDED is
     * `__watch.wasm`, which this arm never published — so `?side=wasm` becomes
     * assertable on the same fields the button's ships are (⚖ D4).
     */
    const publish = (state) => publishShip(state ?? {}, source, lifetime);
    return {
        onStage(stage, message, state) {
            publish(state);
            if (stage === 'probe') {
                $('canvas').style.display = 'none';
                $('status').textContent = 'loading the runtime…';
                // ⛓ The canvas comes back when this arm goes; the frame's own
                // teardown is `shipToWasm`'s (it owns the iframe).
                lifetime.onRetire(() => { $('canvas').style.display = ''; });
                return;
            }
            if (stage === 'start') {
                $('play').style.display = 'none';
                $('status').textContent = 'runtime ready — press ▶ Start inside the frame below. '
                    + 'One REAL click: the renderer and the audio context consume the user '
                    + 'activation, and nothing this page can do substitutes for it.';
                return;
            }
            if (stage === 'running') {
                $('status').className = 'ok';
                // ⛔ THE SHIP'S OWN LABEL, not a second derivation of it off
                // `#title`: two spellings of "which tape is this" is exactly
                // the shape this page keeps paying for.
                $('status').textContent = message;
            }
        },
        onRefusal(stage, reason, detail, state) {
            publish(state);
            if (stage === 'probe') {
                fatal('the wasm build is not on this machine', detail);
                return;
            }
            if (stage === 'start') {
                fatal('the tape never started', detail);
                return;
            }
            if (stage === 'runtime') {
                fatal('the wasm runtime never came up', `${reason} — ${detail}`);
                return;
            }
            fatal('could not start the tape', reason);
        },
        onTick(st, tape) {
            const pct = Math.round(100 * (st.tick ?? 0) / Math.max(1, tape.tick_count));
            $('bar').style.width = `${pct}%`;
            $('hud').innerHTML = wasmHudRows(st, tape);
        },
        onVerdict(v, state) {
            publish(state);
            /**
             * ⛔ THE CHROME STILL SAYS THE SAME THREE WORDS. The verdict's own
             * sentences are the BUTTON's channel (⚖ D3) and `__watch.wasm`'s;
             * adding a line here would move a readout the live row asserts on,
             * which ⚖ D4 forbids. The per-tick answer IS published — it is just
             * not painted over a readout that predates it.
             */
            if (v.kind !== 'not-finished') $('status').textContent += ' — finished';
        },
    };
}


// ── entry ────────────────────────────────────────────────────────────────

/** Where to look for sibling tapes when no `?tape=` names a directory. */
const DEFAULT_TAPE_DIR = 'frontend/modules/seedlingDemo/fixtures/tapes';

/**
 * The GENERATED roster file a static host can serve.
 *
 * ⚠ It lives INSIDE the directory it indexes, which `fixtures/index.js`'s
 * `fixtureNames()` enumerates — so the name is a shared constant there and
 * here, and the listing branch below filters it out too. A roster file that
 * read as a tape would be a fixture named `index` with no expectation.
 */
const TAPE_INDEX_FILE = 'index.json';

/**
 * List the tapes next to the one being watched, and offer them.
 *
 * ⛓ THIS USED TO READ THE DEV SERVER'S DIRECTORY LISTING AND NOTHING ELSE,
 * deliberately, and the argument for that was: *slice 4 records segment
 * tapes as it goes, and a manifest would be stale between the recording and
 * the regeneration that noticed.* That argument is right about manifests in
 * general and it was answered rather than dropped — `index.json` is
 * GENERATED by `scripts/procgen/generate-tape-index.mjs`, gated by that
 * script's `--check` (regenerate-no-diff) AND by `tapeIndexManifest.test.js`,
 * which compares the roster to `readdirSync(tapes/)` and to the tapes
 * themselves, because a fixed point cannot see a generator that stopped
 * covering its directory.
 *
 * ⛔ WHAT THE LISTING COULD NOT DO: GitHub Pages emits no directory listing,
 * so on the published site this returned `{error}`, the picker read `— no
 * directory listing —`, the SOLVE arm's presets dropdown read `— no preset
 * list —`, and 153 tracked, deployed, 200-serving tapes were reachable only
 * by typing their names into `?tape=`. ⚖ The user, 2026-08-19: *"keep the
 * tapes in the repository, and fix the page to use them"*.
 *
 * So: the manifest FIRST, the listing as the fallback — a roster kept
 * somewhere other than `fixtures/tapes/` still lists its siblings with no
 * manifest and no second parameter, which is the original docblock's own
 * case. `index.source` says which of the two answered, and the picker prints
 * it: two mechanisms that produce the same options are worth telling apart.
 *
 * The directory comes from the CURRENT tape's own path.
 */
/**
 * Every tape in a directory.
 *
 * ⛓ Two consumers, and they want DIFFERENT amounts. The picker wants a
 * one-line summary per tape; the SOLVE arm wants each tape's whole staging
 * block for the presets dropdown. They used to share one all-fetching path
 * because the labels could only come from the tapes. With a manifest the
 * labels no longer can — so `withTapes` says which caller you are, and the
 * picker stops pulling 1.4 MB to write 153 labels.
 *
 * `{records, error, source}` rather than a throw: a static host with
 * neither manifest nor listing is a working page with no picker, not a
 * broken page.
 */
async function loadTapeIndex(dir, { withTapes = true } = {}) {
    let names = [];
    let source = null;
    let summaries = null;
    try {
        const res = await fetchArtifact(repoUrl(`${dir}/${TAPE_INDEX_FILE}`));
        if (res.ok) {
            const m = await res.json();
            if (Array.isArray(m?.tapes)) {
                summaries = new Map(m.tapes.map((r) => [r.file, r]));
                names = m.tapes.map((r) => r.file).sort();
                source = 'manifest';
            }
        }
    } catch { /* no manifest here; the listing below is the other way in */ }
    if (!source) {
        try {
            const res = await fetchArtifact(`${repoUrl(dir)}/`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            names = [...html.matchAll(/href="([^"?/]+\.json)"/g)]
                .map((m) => decodeURIComponent(m[1]))
                .filter((n, i, a) => a.indexOf(n) === i && n !== TAPE_INDEX_FILE)
                .sort();
            source = 'listing';
        } catch (e) {
            return {
                dir,
                records: [],
                source: 'none',
                error: `no ${TAPE_INDEX_FILE} and could not list /${dir}/: ${e.message}`,
            };
        }
    }
    const records = await Promise.all(names.map(async (n) => {
        const name = n.replace(/\.json$/, '');
        const base = { name, file: n, path: `${dir}/${n}`, summary: summaries?.get(n) ?? null };
        if (!withTapes && base.summary) return { ...base, tape: null };
        try {
            return { ...base, tape: await (await fetchArtifact(repoUrl(`${dir}/${n}`))).json() };
        } catch (e) {
            // Kept in the list WITHOUT a tape: the file exists, and a
            // roster that hid the one it could not read would be lying
            // about its own size.
            return { ...base, tape: null, why: e.message };
        }
    }));
    return { dir, records, source, error: null };
}

async function populatePicker(params, index) {
    const sel = $('tapes');
    const src = $('tapesrc');
    const dir = index.dir;
    if (index.error) {
        sel.innerHTML = '<option>— no directory listing —</option>';
        sel.disabled = true;
        sel.title = `${index.error}. The page still works from ?tape= directly.`;
        if (src) src.textContent = 'roster source: none';
        return;
    }

    /**
     * A one-line summary per tape — what it boots into and how long it runs
     * are the two things you pick on.
     *
     * ⛓ FROM WHICHEVER SOURCE ANSWERED, in the SAME words. The manifest row
     * carries exactly these four fields under its own spellings, and the
     * tape carries them under the tape's; both are normalised here so a
     * reader cannot tell the two paths apart BY THE LABEL — which is the
     * point, because if they could, one of them would be wrong.
     */
    const summarise = (r) => {
        const t = r.summary || (r.tape && {
            tickCount: r.tape.tick_count,
            bootLevel: r.tape.boot?.level ?? null,
            tapeVersion: r.tape.tape_version,
            noHazards: r.tape.noHazards,
        });
        if (!t) return `${r.name} — ⚠ unreadable (${r.why})`;
        const relaxed = (t.noHazards || []);
        const pit = t.tapeVersion === 2 && !relaxed.includes('pit') ? ' pit-LIVE' : '';
        return `${r.name} — L${t.bootLevel ?? '?'}, `
            + `${t.tickCount} ticks, v${t.tapeVersion}${pit}`;
    };
    const names = index.records.map((r) => r.file);
    const labels = index.records.map(summarise);

    sel.innerHTML = '';
    names.forEach((n, i) => {
        const o = document.createElement('option');
        o.value = `${dir}/${n}`;
        o.textContent = labels[i];
        if (o.value === (params.tape || '').replace(/^\/+/, '')) o.selected = true;
        sel.appendChild(o);
    });
    sel.disabled = false;
    /**
     * ⛓ WHICH SOURCE ANSWERED, ON THE PAGE. Two mechanisms now produce this
     * list — the generated `index.json` and the server's directory listing —
     * and they are meant to agree. A reader who cannot tell them apart
     * cannot tell a working manifest from a manifest that silently fell back
     * to a listing that happens to work locally and not on Pages.
     */
    const note = `${index.records.length} tapes from ${index.source === 'manifest'
        ? `${TAPE_INDEX_FILE} (generated)` : "the server's directory listing"}`;
    sel.title = note;
    if (src) src.textContent = `roster: ${index.source}`;
    /**
     * Load on select. A full navigation rather than an in-place swap.
     *
     * ⚠ BOTH HALVES OF THE ORIGINAL REASON ARE NOW SPENT, and R9 slice 2
     * spends the second one.
     *
     * The first was "reloading keeps both sides on one code path instead of
     * giving the JS side a teardown nobody tests" — the switch arc built that
     * teardown and a browser row tests it.
     *
     * ⛓⛓⛓ The second was *"the wasm side cannot rewind the GAME (`botReset`
     * forgets the tape, not the world — every tape needs a fresh page)"*.
     * ⛔ TRUE, AND NOT A REASON, because a CONTINUATION never rewinds: the
     * next tape does not go back to a boot, it re-arms the world already
     * standing. `botStart` rebuilds only when the next boot names other
     * construction args (`Bot.as:1722-1725`), and its own comment calls it
     * *"the CONTINUATION path (the director's window boundaries)"* (`:2759`).
     * That is what `?tapes=` and the queue control beside this picker do, on
     * both sides.
     *
     * What stands is neither: picking a tape stays a navigation because it is
     * an explicit "load something else", and the reload is what lets it BEAT
     * the block `stagingForMount` would otherwise keep.
     */
    sel.onchange = () => {
        const q = new URLSearchParams(window.location.search);
        q.set('tape', sel.value);
        q.set('side', params.side);
        window.location.search = q.toString();
    };
    mountQueueControl(params, sel);
}

/**
 * ⛓⛓⛓ R9 SLICE 2 — THE ORDERED ADD-TO-QUEUE CONTROL (⚖ ruling 10).
 *
 * ⛔ BESIDE the single-tape picker, never instead of it. What the picker gives
 * you is "load something else"; what this gives you is "and then this one, on
 * the same game". The queue is `?tapes=`, so a sequence is a LINK like every
 * other view on this page — and the WRITER is here, the one place the page
 * writes a tape selection into the bar.
 *
 * ⛓ THE PICKER'S OWN NOTE IS CORRECTED IN THE SAME BREATH (see it above): its
 * navigation was justified by the wasm REWIND — *"the wasm side cannot rewind
 * the GAME (`botReset` forgets the tape, not the world — every tape needs a
 * fresh page)"*. ⛔ THAT IS THE HALF THIS SLICE SPENDS: a CONTINUATION needs
 * no rewind at all, because it does not go back — `botStart` re-arms the same
 * world (`Bot.as:1722-1725`, and `:2759` calls it "the CONTINUATION path").
 * The reason that survives is the other one: picking a tape is an explicit
 * "load something else", and the reload is what lets it beat the block
 * `stagingForMount` would otherwise keep.
 */
function mountQueueControl(params, sel) {
    const queued = params.tapes ? [...params.tapes] : [];
    const bare = (v) => String(v).replace(/^.*\//, '').replace(/\.json$/, '');
    const render = () => {
        const { names, expansions } = expandSequence(queued);
        $('queueList').textContent = queued.length === 0
            ? 'queue: empty — pick a tape and press + queue'
            : `queue: ${queued.join(' → ')}`
                + (expansions.length
                    ? `  (${names.length} window(s): ${names.join(' → ')})` : '');
        $('queueRun').disabled = queued.length === 0;
        $('queueClear').disabled = queued.length === 0;
    };
    /**
     * ⛔ `set` WHEN THERE IS SOMETHING TO WRITE, `delete` WHEN THERE IS NOT —
     * and `formatTapesParam` is what decides which (trap 478: a delete-then-set
     * MOVES an existing key to the end of the bar, which a fixed point cannot
     * see and a round trip can).
     */
    const write = (go, { dropSingle = false } = {}) => {
        const q = new URLSearchParams(window.location.search);
        const value = formatTapesParam(queued);
        if (value === null) q.delete('tapes'); else q.set('tapes', value);
        /**
         * ⛓ R9 SLICE 10 — ▶ campaign DROPS `?tape=`, and the ordinary queue does
         * not. The queue is built up beside a tape you are looking at and
         * keeping that selection in the bar is right; a campaign REPLACES the
         * queue outright and its whole point is a link somebody else can open,
         * so a leftover `?tape=` naming whichever tape happened to be picked
         * would be a stray in a URL meant to be shared.
         */
        if (dropSingle) q.delete('tape');
        q.set('side', params.side);
        if (go) window.location.search = q.toString();
        else window.history.replaceState(null, '', `${window.location.pathname}?${q}`);
    };
    $('queueAdd').onclick = () => {
        queued.push(bare(sel.value));
        render();
        write(false);
    };
    $('queueClear').onclick = () => {
        queued.length = 0;
        render();
        write(false);
    };
    $('queueRun').onclick = () => write(true);
    /**
     * ⛓⛓⛓ R9 SLICE 10 — ▶ campaign (⚖ ruling 19, the user's): *"a way for the
     * watch page to play the full sequence of campaign tapes that we have
     * solved so far"*.
     *
     * ⛔ IT HOLDS NO CHAIN ID AND NO SEGMENT LIST. `campaignChoice` picks the
     * one custody chain that boots a true start and whose every segment the
     * solver recorded, and the day the roster gains a room the button plays one
     * more window with no edit here (trap 495: a typed list decays).
     *
     * ⛔ AND IT WRITES THROUGH THE QUEUE'S OWN WRITER. The campaign is not a
     * second player: it REPLACES the queue with the chain id and presses run, so
     * what happens next is `?tapes=<chain>` — the same LINK, the same arm, the
     * same admission — and the address bar afterwards is a campaign you can
     * send to somebody. `?side=` rides along untouched, so `side=wasm` queues
     * the same fifteen windows and waits for the one human ▶ Start the wasm
     * side may never press for itself.
     *
     * ⛔⛔ A REFUSAL IS SPOKEN **AND** STRUCTURAL (trap 480). A control that only
     * greys out is a control whose reason a gate has to guess at, and a gate
     * that has to guess spends its timeout instead of failing by name — so the
     * button carries the sentence in its `title`, and `window.__campaign`
     * carries `campaignRefusal` whether or not a sequence ever runs.
     */
    const choice = campaignChoice();
    const btn = $('campaignRun');
    if (choice.refusal) {
        btn.disabled = true;
        btn.title = `${choice.refusal.reason} — ${choice.refusal.detail}`;
    } else {
        btn.title = `plays ${choice.why}`;
        btn.onclick = () => {
            queued.length = 0;
            queued.push(choice.id);
            render();
            write(true, { dropSingle: true });
        };
    }
    /**
     * ⛓⛓ THE CONTROL'S OWN READOUT, **UNDER ITS OWN NAME** — so that "which
     * chain would ▶ campaign play, and why not" is answerable on a page that has
     * played nothing.
     *
     * ⛔⛔ AND IT IS **NOT** `__campaign`, WHICH THE DEMO ROW IS WHAT CAUGHT.
     * The first spelling published both states under one name, and a reader
     * waiting for "the campaign readout exists" was then satisfied INSTANTLY by
     * the control's pre-walk object — on the page it had just navigated away
     * from — and asserted a claim about a walk that had not started. Two states
     * under one name is a readout whose terminal condition cannot be written
     * (trap 246's shape). ⇒ `__campaignControl` is what the control publishes
     * and `__campaign` is what a WALK publishes, so the presence of the second
     * IS the terminal condition.
     */
    window.__campaignControl = {
        campaign: choice.id,
        campaignWhy: choice.why,
        campaignRefusal: choice.refusal,
        isCampaign: false,
        asked: [...queued],
        chainSegments: choice.segments.length,
        rooms: null,
        ledger: null,
        end: null,
        stoppedAt: null,
        frontier: null,
        beforeAnyWalk: true,
    };
    render();
}

/**
 * Which panels belong to an arm. ONE TABLE, read on mount and on switch.
 *
 * ⛓ THE BOOT PANEL IS SHARED, so it is shown for BOTH arms that start from a
 * staging block and only the ACTIONS beside it change. That is the visible
 * half of "one box, one block": the panel does not blink out and back when
 * you move between SOLVE and MANUAL, because it is the same panel.
 */
const PANELS = Object.freeze({
    replayPick: (s) => s === 'replay',
    bootPanel: (s) => s === 'solve' || s === 'manual',
    solveActions: (s) => s === 'solve',
    solveGoalLine: (s) => s === 'solve',
    manualActions: (s) => s === 'manual',
    generatePanel: (s) => s === 'generate',
    /**
     * ⛓ ▶ LOAD IN WASM is up for the three arms that HOLD something, and down
     * for REPLAY — where the ENGINE selector already ships the tape and a
     * second control for one act would be two answers to "how do I run this in
     * the real game". ⚖ The user's 2026-08-19 ruling: a separate button, not
     * the SIDE selector.
     */
    wasmShip: (s) => s !== 'replay',
    // ⛓ The generation pane only exists for the arm that produces one — a
    // permanently empty "GENERATION TRACE" heading on the REPLAY page would
    // be a channel with nothing in it and no way to tell why.
    genTraceSection: (s) => s === 'generate',
});

function showPanelsFor(source) {
    for (const [id, belongs] of Object.entries(PANELS)) $(id).hidden = !belongs(source);
}

/**
 * ── ⛓⛓⛓ THE SOURCE SELECTOR — AND IT NO LONGER NAVIGATES ─────────────
 *
 * ⚠ THE URL IS STILL WRITTEN, through `replaceState` instead of assignment.
 * "Every view is a link" was the reason the selector navigated, and it is
 * kept exactly: copy the address bar after a switch and it opens the arm you
 * are looking at. What changed is that the DOCUMENT survives — so the boot
 * box you edited, the tape you pasted and the goals you picked are all still
 * there when you come back, which is the entire point (⛓ `stagingForMount`).
 *
 * ⛔ AND THE URL IS WRITTEN BEFORE THE ARM MOUNTS, because the arm reads its
 * parameters back out of it (`readParams`). Mounting first would mount the
 * arm you left.
 *
 * ⚠ `replaceState` AND NOT `pushState`: back would otherwise walk the arms
 * you have visited without restoring what any of them held, since the state
 * that makes them different lives in the document. A history entry that
 * cannot be honoured is worse than none.
 */
function wireSourceSelector(params, onSwitch) {
    const sel = $('source');
    sel.value = params.source;
    showPanelsFor(params.source);
    sel.onchange = () => onSwitch(sel.value);

    // ⛓ The engine picker rides the same switch — REPLAY-only, because the
    // other three arms build JS worlds and the wasm side builds none.
    const sideSel = $('side');
    sideSel.value = params.side;
    sideSel.onchange = () => onSwitch('replay', sideSel.value);
}

/**
 * ── ⛓⛓⛓ ⚖ WATCH-PAGE ITEM (i) — COLLAPSE ALL / EXPAND ALL ─────────────
 *
 * ⛔ **THE SET IS DERIVED, NEVER TYPED** (⚖ ruling 17). `querySelectorAll
 * ('details')` is the page's OWN answer to *"what is collapsible here"*, and it
 * is the only answer that cannot go stale. A typed id list was the obvious
 * alternative and is wrong for a measured reason: the page holds THIRTEEN
 * `<details>` across four panels, and TWO of them (the boot block and
 * `#tapeIO`) carry no `.genSection` class — so even the class, which looks like
 * a derivation, is a filter that silently drops two sections. The gate row over
 * the un-listed section is built for exactly that mutant.
 *
 * ⛔ **PAGE-WIDE, AND WIRED ONCE AT THE DOCUMENT'S BOOT** — beside the SOURCE
 * selector and for its reason. The arms mount and unmount beneath these
 * sections; a control wired inside an arm's lifetime would stop working on the
 * first SOURCE switch, and it would be reported by nothing, because a button
 * that does nothing looks exactly like a button whose sections were already
 * closed (trap 552: a control wired to nothing spends a gate's timeout).
 *
 * ⛔ **A VIEW SETTING. NOT IN THE URL, AND NOT PERSISTED.** The sections
 * themselves have been a view setting since 2026-08-18 and this is the same
 * setting operated in bulk; writing it to the bar would put a display
 * preference into every link copied off this page. A reload restores the
 * page's own defaults — TEN open, THREE closed — and that default is asserted
 * as its own row so this control cannot silently move it.
 *
 * ⚠ IT DOES NOT FIGHT THE TWO GATES THAT FORCE A SECTION OPEN after load
 * (`check-seedling-editor-boot.mjs`, `-edit.mjs`). Those run at mount; a press
 * is the reader's word and is simply the later one.
 */
function wireSectionChrome(root = document) {
    const setAll = (open) => {
        for (const d of root.querySelectorAll('details')) d.open = open;
    };
    root.getElementById('collapseAll').onclick = () => setAll(false);
    root.getElementById('expandAll').onclick = () => setAll(true);
}

/** `replay-js` and `replay-wasm` are two machines with two teardowns. */
const armNameFor = (params) =>
    (params.source === 'replay' ? `replay-${params.side}` : params.source);

/**
 * ⛓ THE FOUR ARMS, AS ONE TABLE — the runner and the readout key an arm's
 * REFUSAL is written to.
 *
 * ⚠ THE KEYS ARE THE BROWSER ROWS' VOCABULARY (`__editorSolve` and friends),
 * so they are named here rather than constructed: a row that polls for one of
 * these by name is asserting against the arm it thinks it is.
 *
 * ⚠ AND THE SELECTION RULES STAY IN THEIR PARAMETER READERS. Nothing here
 * INFERS an arm — `readSolveParams` and `readGenerateParams` already decide
 * that, and for stated reasons (MANUAL and GENERATE are asked for by name
 * because a stale URL must not land in an arm that waits for a press or
 * spends seconds per press).
 */
const ARMS = Object.freeze({
    solve: { run: runSolve, readout: '__editorSolve' },
    generate: { run: runGenerate, readout: '__editorGenerate' },
    manual: { run: runManual, readout: '__editorManual' },
});

/**
 * ── ⛓⛓⛓ MOUNT THE ARM `params` NAMES, AGAINST A LIFETIME ──────────────
 *
 * ⚠ ONE ENTRY, and it is the seam the in-place SOURCE switch is built on: a
 * switch is `mountArm` again with a different `source`, and the lifetime
 * started here is what retires the arm being left.
 *
 * ⛔ THE ARM'S OWN REFUSAL GOES THROUGH `lifetime.report`. An arm can fail
 * AFTER it has been retired — every one of these paths awaits a fetch — and
 * `fatal` paints the shared status bar, so a dead arm's refusal would
 * overwrite the live arm's readout with a message that is true about nothing
 * on screen. Reported this way it is kept on the retired lifetime instead,
 * where the readout still shows it.
 */
async function mountArm(params, lifetime) {
    /**
     * ⛔ BEFORE THE BODY, BECAUSE THE RESET IS THE HALF THAT MATTERS. An arm
     * that arrives holding nothing must not inherit the previous arm's
     * `shippable`: the button would still be enabled and pressing it would
     * ship the run the reader just switched away from, with this arm's
     * readout around it.
     */
    wireShipButton(params, lifetime);
    try {
        await mountArmBody(params, lifetime);
    } finally {
        /**
         * ⛓ SLICE 4: `__watch` exists for EVERY arm, not just GENERATE.
         *
         * ⛔ IN A `finally`, AND GUARDED ON THE LIFETIME. The generate arm
         * publishes from `show()` (where the level is), but SOLVE, MANUAL and
         * REPLAY have no such point — and a host whose panel showed nothing
         * for three of the four arms would be reporting "not connected" for a
         * page that is working. ⚠ A RETIRED lifetime publishes nothing: an arm
         * that finished after the reader switched away must not overwrite the
         * live arm's summary, which is `lifetime.report`'s own rule one level
         * up.
         */
        if (lifetime.alive()) publishWatch(params.source);
    }
}

async function mountArmBody(params, lifetime) {
    const arm = ARMS[params.source];
    if (arm) {
        // ⚠ NO PICKER FETCH FOR THESE THREE. `runSolve` starts the roster
        // load itself and does not await it — a solve with `?boot=` given
        // should not wait on 150 tapes it is not going to read.
        try {
            await arm.run(params, lifetime);
        } catch (e) {
            lifetime.report(`the ${params.source} arm failed: ${e.message}`, () => {
                fatal(`the ${params.source} arm failed`, e.stack || e.message);
                window[arm.readout] = { status: 'refused', message: e.message };
            });
        }
        /**
         * ⛓⛓ "THE MOUNT FINISHED" IS A FACT NOTHING ELSE STATED, and it was
         * the browser row that needed it: a row waiting for the arriving arm
         * by watching its boot box waits for a box that is ALREADY FULL —
         * `stagingForMount` keeps it across the switch — so the wait returns
         * instantly and the row reads the OUTGOING arm's page. It went green
         * on a note that had not been written yet.
         *
         * ⚠ Written only while this arm still owns the page, and carrying the
         * lifetime's generation, so "which mount is this" has an answer that
         * two mounts of the same arm cannot blur.
         */
        if (lifetime.alive()) {
            window.__editorArm = {
                source: params.source, arm: lifetime.name, generation: lifetime.generation,
            };
        }
        return;
    }

    /**
     * ⛓ R9 SLICE 2: a SEQUENCE names its own windows, so the title is theirs.
     */
    $('title').textContent = (params.tapes && params.tapes.length > 0)
        ? params.tapes.join(' → ') : (params.tape || '(no tape)');
    // The picker is populated even with no tape, so the page is a launcher
    // rather than an error when you arrive without one.
    const dir = params.tape
        ? params.tape.replace(/^\/+/, '').split('/').slice(0, -1).join('/')
        : DEFAULT_TAPE_DIR;
    // ⛓ `withTapes: false` — with a manifest the labels come from it, so the
    // picker stops fetching 1.4 MB of tape to write 153 lines of text. Without
    // one (the listing branch) the tapes are still the only place the labels
    // can come from, and they are fetched exactly as before.
    const picking = loadTapeIndex(dir, { withTapes: false })
        .then((index) => populatePicker(params, index));
    /**
     * ⛓⛓ R9 SLICE 2: `?tapes=` IS A TAPE SELECTION TOO. Without this the
     * sequence arm would never be reached — a bare `?tapes=` URL carries no
     * `?tape=` and would land in the no-tape refusal below, which is the
     * right message for the wrong page.
     */
    if (!params.tape && params.tapes === null) {
        await picking;
        lifetime.report('no ?tape= given', () => fatal(
            'no ?tape= given — pick one above, or switch source to SOLVE',
            'watch.html?tape=frontend/modules/seedlingDemo/fixtures/tapes/'
            + 'pit-fall-chain-85.json&side=js'));
        /**
         * ⛓⛓⛓ …AND IT STILL DRAWS A LEVEL. ⚖ THE USER'S REPORT: *"when the
         * page first loads, it doesn't load and display the level"*.
         *
         * ⛔ THIS WAS THE ONE ARM THAT DID NOT, AND IT IS THE ONE YOU LAND ON.
         * Group A's item was "every arm draws its level on mount" and SOLVE,
         * MANUAL, GENERATE and a REPLAY-with-a-tape all do — MEASURED at
         * 102400/102400 opaque pixels each. A bare `watch.html` is REPLAY with
         * no `?tape=`, which reported the missing parameter and RETURNED, so
         * the default entry point to the page was the only black canvas on it.
         *
         * ⛔⛔ IT DRAWS THE TRUE GAME START, WHICH IS NOT A TAPE AND IS NOT A
         * GUESS. `trueStartStaging` is the same block `stagingForMount` hands
         * SOLVE and MANUAL when nothing else is named — the committed boot of
         * `TRUE_START_SEGMENT` — so this is the page's existing answer to
         * "where does the game begin", drawn instead of withheld. No tape is
         * invented, no run is stepped, and `previewLevel` hands every history
         * channel an EMPTY array: it is a still frame of a room, which is
         * exactly what the other arms put up.
         *
         * ⚠ THE REFUSAL SURVIVES INTACT AND IS REPORTED FIRST. "There is no
         * tape here" is still true and still on screen; what changes is that
         * the reader can see the room the picker is about to launch them into.
         * A drawing that had REPLACED the message would be a page pretending
         * to have loaded something.
         *
         * ⚠ `side=wasm` IS EXCLUDED BY NATURE, not by preference: that arm
         * iframes the recompiled game and builds no JS worlds at all, so there
         * is nothing here for it to draw.
         */
        if (params.side !== 'wasm') {
            try {
                const { levelSource } = await armPrelude(params, lifetime);
                if (!lifetime.alive()) return;
                const staging = await trueStartStaging();
                if (!lifetime.alive()) return;
                previewLevel(levelSource, staging, layerSetFor(params), lifetime);
            } catch (e) {
                /**
                 * ⚠ REPORTED, AND THE TAPE REFUSAL IS NOT OVERWRITTEN. The
                 * missing `?tape=` is the actionable fact and a failure to
                 * draw a courtesy preview must not bury it — so this appends
                 * rather than calling `fatal` a second time.
                 */
                lifetime.report(`the opening preview would not draw: ${e.message}`, () => {
                    $('detail').textContent = `${$('detail').textContent}\n⚠ and the opening `
                        + `preview of the true game start would not draw — ${e.message}`;
                });
            }
        }
        return;
    }
    document.body.dataset.side = params.side;
    try {
        if (params.side === 'wasm') await runWasm(params, lifetime);
        else await runJs(params, lifetime);
    } catch (e) {
        lifetime.report(`the ${params.side} side failed: ${e.message}`,
            () => fatal(`${params.side} side failed`, e.stack || e.message));
    }
    if (lifetime.alive()) {
        window.__editorArm = {
            source: params.source, arm: lifetime.name, generation: lifetime.generation,
        };
    }
}

/**
 * ⛓ SWITCH ARMS IN PLACE — the URL, then the teardown, then the mount.
 *
 * ⛔ THE ORDER IS THE CONTRACT. `armLifetimes.start` retires the outgoing arm
 * BEFORE the incoming one exists (⚖ `watchLifetime`), so there is no instant
 * at which two arms both believe they own the canvas — the state the reload
 * used to make unreachable. The chrome is cleared between them, so nothing
 * the old arm said survives to describe the new one's run.
 *
 * ⚠ IT IS `await`ed BUT NOTHING AWAITS IT: the selector's `onchange` cannot,
 * and a mount can take seconds (GENERATE's first solve). A failure therefore
 * has to land somewhere visible, which is what the arms' own
 * `lifetime.report` paths do.
 */
async function switchArm(source, side = null) {
    const q = new URLSearchParams(window.location.search);
    q.set('source', source);
    /**
     * ⛓ THE ENGINE MOVES THE SAME WAY THE ARM DOES (item 11). `?side=` was
     * URL-only, so trying the other engine meant editing the address bar —
     * and the in-place switch already knows how to retire a wasm arm (the
     * iframe's `about:blank` teardown rides on `onRetire`), so there was
     * nothing left to build but the control.
     */
    if (side) q.set('side', side);
    /**
     * ⛔ THE ARM'S OWN BOUNDS DO NOT FOLLOW IT. `?tickbudget=` means one thing
     * to GENERATE and `?tick=` means another to the scrub cursor; what makes
     * them safe to leave in the URL is that each arm reads only its own
     * vocabulary. The one parameter that must be rewritten is the one being
     * switched, so that is the only one touched here.
     */
    await navigateTo(q.toString(), `the SOURCE selector switched to ${source}`);
}

/**
 * ⛓⛓ SLICE 4 — THE THREE STEPS AFTER THE URL, AS ONE FUNCTION.
 *
 * ⛔ EXTRACTED, NOT ADDED. `switchArm` is its one pre-existing caller and its
 * body is unchanged; the second caller is `procgenLab:navigate`, and a host
 * that re-implemented "write the bar, re-read it, retire, mount" would be a
 * SECOND way into an arm — with its own opinion about whether the chrome is
 * cleared and in which order the lifetimes turn over. ⚖ §5's ONE OF EVERYTHING,
 * and here the "everything" is the SWITCH arc's whole result.
 *
 * ⛔ `replaceState` AND NOT AN ASSIGNMENT TO `location.search`: the latter
 * NAVIGATES, which is the reload the SWITCH arc removed — and inside an iframe
 * it would drop the adapter connection with it.
 *
 * ⚠ `?iframeId=`/`?hostOrigin=` ARE PRESERVED. They are this frame's address,
 * the host did not send them in a `navigate`, and a page that dropped them
 * would still run and never be reachable again.
 */
async function navigateTo(search, why) {
    const asked = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const here = new URLSearchParams(window.location.search);
    for (const key of ['iframeId', 'hostOrigin']) {
        if (here.has(key) && !asked.has(key)) asked.set(key, here.get(key));
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${asked.toString()}`);
    const params = readParams();
    showPanelsFor(params.source);
    resetPageChrome();
    await mountArm(params, armLifetimes.start(armNameFor(params), why));
}

/**
 * ⛓⛓⛓ WHICH COPY OF THIS SCRIPT IS RUNNING — the stamp, and why a page whose
 * whole job is showing you the truth needed one about itself.
 *
 * ⚖ A user reported an arm not drawing its level on load. Every arm was
 * measured drawing it, in a fresh browser, at every window size — and there
 * was no way, from the page, to tell "the fix is wrong" from "your browser
 * never fetched the fix". The dev server is a plain `python -m http.server`:
 * it sends `Last-Modified` and NO `Cache-Control`, so a browser may apply
 * heuristic freshness and serve this module from cache without revalidating.
 *
 * ⛔ THE WITNESS IS THE RESOURCE TIMING ENTRY, NOT A GUESS. A response the
 * browser took from its own cache reports `transferSize === 0` with a
 * non-zero `decodedBodySize`; one that came off the network reports bytes.
 * That is the browser's own account of what it did, which is the only
 * authority here — a page cannot otherwise know what it was served.
 *
 * ⚠ AND IT IS REPORTED, NEVER ACTED ON. This does not bust the cache, add a
 * query string or reload anything: a page that silently re-fetched itself
 * would make the same ambiguity unobservable in the other direction, and a
 * reader would have no way to know their browser was ever holding stale code.
 * Ctrl+Shift+R is the fix; saying so is this function's whole job.
 *
 * ⚠ `null` IS A REAL ANSWER in both channels — a browser that exposes no
 * resource entry for the module, or a server that answers no HEAD, is a
 * limitation of the reading and says so rather than claiming "fresh".
 */
async function stampSource() {
    const el = $('sourceStamp');
    if (!el) return;
    const href = new URL('./watchViewer.js', import.meta.url).href;
    /**
     * ⛔⛔ THREE STATES, NOT TWO — AND THE MIDDLE ONE IS THE COMMON ONE.
     * MEASURED against this very server: a second load in a warm context
     * reported **300 bytes**, which is not a download (the module is ~250 KB)
     * and not a silent cache hit either. It is a **304 revalidation**: the
     * browser asked, the server said "unchanged", and the body came from
     * cache. A two-state reading called that "fetched from the network", which
     * is false, and would have called it "cached/stale" just as wrongly.
     *
     *   `transferSize === 0`              taken from cache WITHOUT asking — the
     *                                     only state that CAN be stale, so it
     *                                     is measured further below (the
     *                                     cached copy's own date vs the
     *                                     server's) before it is called so
     *   `0 < transferSize < decoded`      REVALIDATED (304) — cached AND current
     *   `transferSize >= decodedBodySize` downloaded in full
     */
    let state = null;
    let bytes = null;
    let decoded = null;
    try {
        const entry = performance.getEntriesByType('resource').find((e) => e.name === href);
        if (entry && entry.decodedBodySize > 0) {
            bytes = entry.transferSize;
            decoded = entry.decodedBodySize;
            if (entry.transferSize === 0) state = 'cache';
            else if (entry.transferSize < entry.decodedBodySize) state = 'revalidated';
            else state = 'network';
        }
    } catch { /* the API is optional; `null` says so */ }
    let onDisk = null;
    try {
        // ⛔ `no-store` ON THIS ONE REQUEST, so the answer is the SERVER's and
        // not another reading of the same cache the question is about.
        const r = await fetch(href, { method: 'HEAD', cache: 'no-store' });
        onDisk = r.headers.get('last-modified');
    } catch { /* offline or blocked — reported as an absence below */ }
    const disk = onDisk ? `server copy ${onDisk}` : 'server answered no HEAD';
    if (state === 'cache') {
        /**
         * ⛓⛓ A CACHE HIT IS NOT YET A STALE COPY — MEASURE, THEN SAY WHICH
         * (2026-08-18, after the message read as an alarm on GitHub Pages,
         * where the host sends `Cache-Control: max-age=600` and a warm reload
         * is SUPPOSED to come from cache). The cached copy's own
         * `Last-Modified` is readable: `cache: 'only-if-cached'` (same-origin
         * only) answers from the cache and never touches the network. Compared
         * with the no-store HEAD's `Last-Modified` above there are three
         * honest answers, and only ONE of them is the warning:
         *   equal    ⇒ cached AND current — a plain note, no reload asked
         *   differ   ⇒ STALE — both dates printed, HARD RELOAD asked
         *   unreadable ⇒ the old caution, in the server's words, not "disk"
         * ⛔ Still REPORTED, never acted on.
         */
        let cachedDate = null;
        try {
            const c = await fetch(href, { method: 'HEAD', cache: 'only-if-cached', mode: 'same-origin' });
            if (c.ok) cachedDate = c.headers.get('last-modified');
        } catch { /* the cache would not answer — reported as unreadable below */ }
        const reload = 'HARD RELOAD (Ctrl+Shift+R) before believing anything about the page\'s behaviour';
        if (cachedDate && onDisk && cachedDate === onDisk) {
            el.className = 'note';
            el.textContent = `script served from your browser's cache (transferSize 0) — and it is `
                + `CURRENT: the cached copy and the server's copy are both dated ${onDisk} `
                + '(this host allows caching; no reload needed)';
            return;
        }
        el.className = 'note bad';
        el.textContent = cachedDate && onDisk
            ? `⚠ STALE SCRIPT: your browser's cached copy is dated ${cachedDate} but the `
                + `server's copy is dated ${onDisk} — ${reload}.`
            : `⚠ THIS PAGE'S SCRIPT CAME FROM YOUR BROWSER'S CACHE WITHOUT ASKING THE SERVER `
                + `(transferSize 0) and the cached copy's date could not be read, so it may be `
                + `older than the server's — ${reload}. ${disk}`;
        return;
    }
    el.className = 'note';
    if (state === 'revalidated') {
        // ⚠ THE HEALTHY CACHE HIT, NAMED AS ONE. The body came from cache and
        // the server was asked whether that was still right — so this is
        // CURRENT, and calling it "cached" would send a reader chasing a
        // problem they do not have.
        el.textContent = `script REVALIDATED with the server (304, ${bytes} B of headers `
            + `for ${decoded} B of script) — cached but current · ${disk}`;
        return;
    }
    el.textContent = state === 'network'
        ? `script downloaded fresh (${bytes} B) · ${disk}`
        : '⚠ this browser reports no timing entry for the page script, so whether it came '
            + `from cache is not a question it can answer · ${disk}`;
}

export async function main() {
    /**
     * ── ⛓⛓ A REFUSED URL SAYS SO, ON THE PAGE ─────────────────────────
     *
     * The parameter readers refuse by name — a non-integer `?seed=`, a
     * `?families=` naming a template this biome does not hold, both roster
     * spellings at once. ⛔ Until slice 4 that refusal went nowhere: `main()`
     * was the top of the stack, so the throw became an unhandled rejection and
     * the page sat on "loading…" with the reason only in the console. A
     * refusal nobody can see is the graceful-skip shape with the grace removed
     * — the page did not fall back to anything, it simply stopped.
     *
     * ⚠ This does NOT soften the refusal: the arm still does not mount, and
     * the message is the reader's own, verbatim.
     */
    let params;
    try {
        params = readParams();
    } catch (e) {
        fatal('the URL parameters were REFUSED — nothing was generated', e.message);
        window.__editorParams = { status: 'refused', message: e.message };
        return;
    }
    // ⛓ P2: the section summaries' `title=` tooltips, filled from the
    // glossary. ⛔ Before any arm mounts and after the refusal branch, because
    // a refused URL should still be able to explain its own vocabulary.
    applyGlossaryTips(document);
    // ⛓ FIRST, AND NOT AWAITED: the stamp is a diagnostic ABOUT the page and
    // must not delay the page. A failure in it may not stop an arm mounting.
    stampSource().catch(() => {});
    /**
     * ⛓⛓⛓ GROUP B — `?attackhold=` IS APPLIED ONCE, AT THE DOCUMENT'S BOOT,
     * AND NOT AT EVERY ARM MOUNT.
     *
     * The hold is page state (see `attackHold`), so re-reading the parameter
     * on each SOURCE switch would silently undo a knob the reader had turned —
     * the switch arc's whole premise is that switching does not reload, and a
     * setting that reset itself on a switch anyway would be that premise
     * leaking. ⚠ A BAD VALUE IS REPORTED, not swallowed: the parse hands back
     * the default with a reason, and the page says the reason where it says
     * every other parameter's.
     */
    const holdParam = parseAttackHold(params.attackHold);
    attackHold = holdParam.hold;
    if (holdParam.why) $('detail').textContent = `⚠ ${holdParam.why}`;
    wireSourceSelector(params, switchArm);
    // ⛓ ITEM (i): page-wide chrome, wired beside the SOURCE selector and for
    // its reason — it must outlive every arm mount. BEFORE the first mount, so
    // a reader who lands on a slow-generating URL can already fold the page.
    wireSectionChrome();
    await mountArm(params, armLifetimes.start(armNameFor(params), 'the page loaded'));
    // ⚠ AFTER the first mount, so the `procgenLab:ready` the bridge publishes
    // carries a page that has already drawn (⚖ §3.5: *"after connect + first
    // render"*). A host mirroring a pre-mount state would print an identity
    // line for a level nobody could see.
    await installHostBridge();
}

/**
 * ⛓⛓⛓ SLICE 4 — THE BRIDGE IS FETCHED ONLY UNDER `?iframeId=`.
 *
 * ⛔ Not "loaded and inert" — NOT FETCHED. A static import would put
 * `AdapterClient` into the standalone page's graph, where it installs a
 * `message` listener on a page that has no host; the editor arc's ruling that
 * `watch.html` is a standalone document would then be true only by politeness.
 * `check-seedling-editor-boot.mjs` measures the request list.
 *
 * ⚠ A FAILURE HERE DOES NOT TAKE THE PAGE DOWN. The arm has already mounted;
 * a host that cannot be reached leaves a working standalone page inside an
 * iframe, which is strictly better than a blank one, and the reason is
 * reported to the console rather than swallowed.
 */
async function installHostBridge() {
    const iframeId = new URLSearchParams(window.location.search).get('iframeId');
    if (!iframeId) return;
    try {
        const mod = await import('./watchBridge.js');
        hostBridge = await mod.installWatchBridge({
            iframeId,
            readout: () => window.__watch,
            load: hostLoad,
            navigate: (search) => navigateTo(search, 'the HOST navigated'),
        });
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('watchViewer: the host bridge would not install —', e.message);
    }
}

/**
 * HOST → PAGE `procgenLab:load`. ⛔ THE `?gen=` RECONSTRUCTION, with the object
 * handed over instead of fetched — see `watchBridge.js`'s docblock for why
 * that is the page's ONE path and not a new one.
 *
 * ⛔ `?gen=` IS DELETED FROM THE BAR. A stale one would make `runGenerate`
 * fetch a FILE the host did not send; the payload in hand is the identity now,
 * and the URL must not name a different one.
 */
async function hostLoad(payload) {
    pendingHostPayload = payload;
    const q = new URLSearchParams(window.location.search);
    q.set('source', 'generate');
    q.delete('gen');
    await navigateTo(q.toString(), 'the HOST sent a level payload');
}
