/**
 * mazeRoom/mazeLabView — **THE MAZE LAB PAGE'S DOM ARM.** `lab.html` calls
 * `main()` and this file is everything between a URL and a canvas.
 *
 * CONSTRUCTIVE-MODE arc, slice 3 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.5). The counterpart of `seedlingDemo/watchViewer.js`, and it
 * is deliberately much smaller: every claim-making thing it touches lives
 * elsewhere — the loop in `procgenCore/`, the bindings in `procgenMaze.js`, the
 * headless page logic in `mazeLab.js`, the DRAW in `mazeRoomRender.js`.
 *
 * ⚠ TOOLING ONLY: it makes no claims and gates nothing.
 *
 * ── ⛔ THE LAWS IT IS BUILT AGAINST, EACH ONE PAID FOR ELSEWHERE ───────
 *
 * 1. **ONE READER, ONE WRITER.** `mazeLab.readLabParams` /
 *    `mazeLab.writeLabParams` are the only two functions in the page that know
 *    what a parameter is called. ⛔ Every control writes its value back through
 *    the writer AT PRESS TIME, so a copied address bar reproduces the run — the
 *    GENERATE-UI arc's slice-1 defect was a form that edited local variables
 *    and left the bar naming a level the page was not showing.
 * 2. **THE SOURCE SELECTOR DOES NOT RELOAD** (the SWITCH arc's law). The three
 *    arms share one state and one canvas; switching shows a different panel and
 *    starts a new LIFETIME.
 * 3. **EVERY `addEventListener` GOES THROUGH THE LIFETIME** (`procgenCore/
 *    pageLifetime.js`, trap 259). Not a style rule: a listener registered
 *    directly is invisible to the readout, so a leak would sit next to a report
 *    of a clean teardown.
 * 4. **THE PAGE NEVER WRITES `fixtures/`** or any repo path. Download and the
 *    save box are the only ways a level leaves.
 * 5. **RAW TRUTH.** A refusal is printed with the oracle's or the editor's own
 *    sentence, verbatim. A paraphrase would be a lossy copy of the only
 *    evidence channel a generator has.
 *
 * ── THE READOUTS ──────────────────────────────────────────────────────
 *
 * `window.__mazeLab` is what `scripts/procgen/check-maze-lab.mjs` asserts on;
 * `window.__mazeLabLifetime` is the teardown account. ⛔ Both are set on EVERY
 * render, not only under a parameter — a readout that existed only when asked
 * for would make the thing it reports untestable from the other side.
 */

import { createLifetimeHolder } from '../procgenCore/pageLifetime.js';
import { describeKeptKind, generationRows, ladderCost, tileAtPoint } from '../procgenCore/labView.js';
import { COLORS, TILE_PX, drawWorld, plainView } from './mazeRoomRender.js';
/**
 * ⛓⛓⛓ THE AREA OVERLAY IS A **SIBLING** DRAW, called after `drawWorld` exactly
 * as the plan and the hover overlays are — a graph is a fact about the MODEL,
 * not a property of the world, and the panel (the renderer's other caller) has
 * no model at all. It brings its own op-log fixture, so `drawWorld`'s seven
 * captured hashes stay byte-identical (⚖ arc-1 slice 3).
 */
import { AREA_LAYERS, areaLegend, drawAreaOverlay } from './mazeAreaOverlay.js';
/**
 * ⛓⛓⛓ ARC 2 SLICE 4 — THE GADGET IS A **SECOND SIBLING** OVERLAY, for the
 * reason the area one is (see its docblock, ⚖ Q5): a gadget's site, ports and
 * tunnel are facts about the MODEL, and the BLOCK MOVES — `state.blocks` is
 * state, not world, and `drawWorld`'s contract is "draw this world".
 */
import { drawElementOverlay, elementLegend } from './mazeElementOverlay.js';
import {
    DEFAULT_MAZE_BIOME, DIRECTED_ANCHOR_TRIES, MAZE_BIOME_NAMES, MAZE_DEFAULTS,
    MazeRoomEditor, PALETTE_ENTRIES, PALETTE_TYPES,
    SOURCES, agreementWithPayload, applyDirective, applyEdits, certifyInto, describeState,
    generateStep, generateWithDirectives, labCatalogue, labPayload, loadPayload,
    openEditSession, planCells, planFrames, projectSession, readLabParams, serializeMazeLevel,
    skeletonCatalogue, stepFromParams, writeLabParams,
} from './mazeLab.js';
/**
 * ⛓⛓⛓ EDITOR v3 SLICE A2 — **THE SHARED TOOL, MOUNTED.** ⛔ The canvas tool,
 * the stroke-is-one-group law, the command table and the key map are
 * `procgenCore/editorView`'s and are not re-spelled here; what stays this
 * page's is the GEOMETRY (`cellAt`), the PALETTE (an op template), the
 * substrate's own BOUNDS sentences, and the renderer.
 */
import { UNDO_COMMAND_ID, mountEditorView } from '../procgenCore/editorView.js';
import { describeOps } from '../procgenCore/editCore.js';
import { mazeEditAdapter } from './mazeEditAdapter.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
// ⛓ SLICE 7: the ONE normalizer for a skeleton spec — this form, the identity
// line and the URL bar all spell a room the same way.
import { normalizeSkeleton } from '../procgenCore/skeletonKinds.js';
/**
 * ⛓ PROCGEN DOCS P2 — THE GLOSSARY, AS TOOLTIPS ONLY. `data-term` in the
 * markup names a slug; the SENTENCE comes from the one module that holds it.
 * ⛔ Nothing here is a readout and nothing here changes a control or a label.
 */
import { applyGlossaryTips } from '../procgenDocs/glossaryTips.js';

/**
 * ⛓⛓⛓ EDITOR v3 E2c — **THE SET ARM.** The maze's page-side bindings are
 * `mazeSetLab.js`'s (node-tested, and `setEditorView.test.js` reads the same
 * list); the ADAPTER is E2a's; the intake doors are
 * `procgenPipeline/regionLibraryLoader`'s own — `parseRegionLibrary` for text
 * and `loadServedLibrary` for a committed pack, both returning
 * `{ok, library, errors, warnings}`, so there is ONE validator door and not a
 * second one written here.
 */
import {
    LAB_SUBSTRATE, bindWorldParts, makeDrawRoomStill, mazeLibraryRows, mazeSetBindings,
    roomBaseTag, sniffSetDocument, worldDoorDisconnectOp, worldDoorOp, worldDoorPreview,
    worldDoorRows, worldPartDescriptors, worldSetBindings,
} from './mazeSetLab.js';
import { createEditSession } from '../procgenCore/editCore.js';
/**
 * ⛓⛓⛓ EDITOR INTEGRATION W4 — **THE WORLD HALF.** W2's three modules take
 * every substrate half INJECTED (`procgenCore/` may import neither adapter), and
 * `mazeSetLab.js` is where this page plugs them in; what the PAGE reaches for
 * directly is the composite adapter, the record constructor and the two
 * readers a merged atlas needs.
 */
import { partOfRegion } from '../procgenCore/worldDerivation.js';
import { createWorldSetAdapter, partAt, worldRecord } from '../procgenCore/worldSetAdapter.js';
/**
 * ⛓⛓⛓ EDITOR INTEGRATION W4 (§9.6 #1) — **THE ROOM-EDITOR CONTRACT'S HOST
 * HALF, WITH A PAGE FOR A HOST.** `openLabRoomEditor` resolves a mounted
 * `procgenLabPanel` INSTANCE by default and there is none inside `lab.html`;
 * `createPageLabTransport` is the panel-shaped object that replaces it.
 */
import { createPageLabTransport, openLabRoomEditor } from '../procgenLabPanel/labRoomEditor.js';
/**
 * ⛓ …and the DECLARATIONS come off the substrate entries themselves — `page`
 * and `arm` are the registry's words (W3 §9.2) and this file must not be the
 * second place either is spelled. ⛔ Read off the ENTRY rather than through
 * `substrateRegistry.get`, because a standalone page runs no app bootstrap and
 * nothing has registered anything.
 */
import { substrateRegistryEntry as FLASH_SEEDLING_ENTRY } from '../flashPanel/flashSeedlingLibrary.js';
import { MAZE_CONDITION_DEPS, mazeGridFor } from './mazeAtlasDerivation.js';
import { tileTypeForPlacement } from '../flashPanel/seedlingSemantics.js';
import { TILE_SIZE } from '../seedlingDemo/levelWorld.js';
import { validateLevelSet } from '../seedlingDemo/levelSetValidator.js';
import { parseOelLevel } from '../seedlingDemo/procgenLevelOel.js';
import { deserializeMazeWorld } from './mazeRoomEngine.js';
/**
 * ⛓⛓⛓ **THE SHARED SET EDITOR, MOUNTED — THE SAME FUNCTION `watch.html` BINDS
 * TO SEEDLING** (EDITOR v3 E2b lifted it; §7/§16.2's one-toolkit law). ⛔ The
 * strip, the two-click CONNECT gesture, the rooms table, both forms, the rule
 * box, the REPORT, the identity line and the four downloads are NOT re-spelled
 * here: writing them a second time would be a 1,000-line copy that drifts from
 * the day it lands. What this page supplies is the maze's BINDINGS
 * (`mazeSetLab.js`) and the two pipeline functions the mount refuses to import
 * for itself.
 */
import { mountSetEditor } from '../procgenCore/setEditorView.js';
import { compileRegionAtlas, substrateIdFor } from '../procgenPipeline/regionAtlasCompiler.js';
import { validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import {
    loadServedIndex, loadServedLibrary, parseRegionLibrary,
} from '../procgenPipeline/regionLibraryLoader.js';
import {
    createMazeSetAdapter, createSetSession, emptyMazeOverlay, setRecord,
} from './mazeSetAdapter.js';
import { readBundle } from '../presets/documentBundle.js';
import { loadJSZipBrowser } from '../presets/loadJSZipBrowser.js';

// ⛓ ELEMENTS ARC 1 SLICE 3: the ONE area codec — the form, the identity line,
// the URL bar and both CLIs spell a graph the same way.
import {
    AREA_PARAM_SCHEMA, KEYS_DOMAIN, formatRequireList, normalizeAreaSpec, parseRequireList,
} from '../procgenCore/areaSpec.js';
// ⛓ ELEMENTS ARC 2 SLICE 4: the ONE element codec — the form's options ARE its
// declared domains, and the identity line, the URL bar and both CLIs spell a
// gadget the same way.
import {
    DEFAULT_ELEMENTS, ELEMENT_NAMES, elementSpecOf, normalizeElementSpec, paramSchemaFor,
} from '../procgenCore/elementSpec.js';

const $ = (id) => document.getElementById(id);

/**
 * ⛓⛓⛓ EDITOR INTEGRATION W4 — **WHICH LAB PAGE EDITS A ROOM OF WHICH
 * SUBSTRATE, READ OFF THE SUBSTRATE ENTRIES.**
 *
 * ⛔ Keyed by SUBSTRATE ID because that is what a world's cell carries; the
 * `{kind, page, arm}` inside is the entry's own declaration, verbatim. A table
 * of pages and arms typed here would be the second place W3 §9.2's three field
 * names live, and `arm` is deliberately not the same word on the two pages.
 */
const ROOM_EDITOR_DECLARATIONS = Object.freeze({
    [FLASH_SEEDLING_ENTRY.id]: FLASH_SEEDLING_ENTRY.roomEditor,
});

/**
 * ⛓ …and where each lab page's HTML is, relative to `frontend/`. ⛔ Not
 * `procgenLabPanel.LAB_PAGES`, whose paths are relative to `index.html` and
 * whose import would pull the Golden Layout panel into a standalone page.
 */
const LAB_PAGE_DIRS = Object.freeze({
    seedling: 'seedlingDemo/watch.html',
    maze: 'mazeRoom/lab.html',
});
const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
};

/** ⚠ A generous ceiling for ONE maze solve. The whole BFS state space of the
 *  default room is 242 states, so a run of 49 solves measures in tens of ms —
 *  the number is stated so a caller raising the target can price it BEFORE
 *  pressing, which is the same discipline `costModel` applies to one run. */
const WORST_CASE_SOLVE_MS = 3;

/**
 * ⛓ HOW FAST THE SOLVE REPLAY AUTOPLAYS. ⚠ THIS IS A WALL CLOCK AND IT IS
 * ALLOWED TO BE ONE: it paces an ANIMATION and decides nothing. ⛔ No budget,
 * no bound and no generated artifact reads it — the generator's budgets are
 * NODES (`?expansions=`) and the browser row drives the replay with the STEP
 * button, so nothing that makes a claim depends on this number.
 */
const PLAY_FRAME_MS = 110;

/**
 * ⛓ **ONE RESOLVER FOR EVERY REPO PATH THIS PAGE FETCHES**, against `frontend/`.
 * ⛔ `import.meta.url`-relative and never a string built from `location`: the
 * page is served from the repo root on the dev server and from `frontend/` on
 * Pages, and a path assembled from the address bar would 404 on one of them.
 * (`watchViewer.repoUrl` is the same idea; this page only ever needs the
 * `frontend/` half, so it is the whole of it.)
 */
const FRONTEND = new URL('../../', import.meta.url).href;
const frontendUrl = (path) => new URL(path, FRONTEND).href;

/**
 * ⛓⛓ **THE TWO OPTIONAL SCHEMAS, DEGRADED TO A NAMED ABSENCE** — `watchViewer`'s
 * own rule (its `loadOptionalJson`): the rule box says only the SHAPE is checked
 * without the rules schema, and the REPORT says the STRUCTURAL pass did not run
 * without the atlas one. ⛔ A data file must not be a single point of failure
 * for a control that works without it.
 */
const optionalJson = async (path, what) => {
    try {
        const res = await fetch(frontendUrl(path));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`${what} would not load (${e.message}) — the control that reads it `
            + 'degrades to a NAMED absence and says so on the page.');
        return null;
    }
};

export function main() {
    // ⛓ P2: the summaries' and the two legend boxes' `title=` tooltips,
    // filled from the glossary. ⛔ A link and a tooltip are the whole of this
    // page's share of P2 — no readout of it moves.
    applyGlossaryTips(document);
    const lifetimes = createLifetimeHolder({
        publish: (snap) => { window.__mazeLabLifetime = snap; },
    });

    /* ── THE PAGE'S OWN STATE. `state` is the LEVEL; everything else here is
     *    about the page (which arm, which palette entry, what was hovered). ── */
    let params = null;
    let state = null;
    let lastSolve = null;
    let payloadCheck = null;
    let hover = null;
    let editor = null;
    /**
     * ⛓⛓⛓ EDITOR v3 SLICE A2 — **THE EDIT SESSION IS THE HOME FOR `record`,
     * `edits` AND `certified`**, for the whole page life and not only in the
     * EDIT arm. ⛔ `state`'s copies of those three are PROJECTIONS, written by
     * `mazeLab.projectSession` and by nothing else; the page carried a WORLD
     * STACK (`undoStack`) until this slice and now carries base + ops, which is
     * ⚖ law (a) of `procgenCore/editCore`.
     *
     * ⛔ It is RE-OPENED, never edited, when the base record moves — a rung, a
     * directive, a LOAD. Those are not edits: they replace the level the edits
     * are edits OF, and a session that kept its op list across one would fold
     * yesterday's presses onto today's room.
     */
    let session = null;
    /** ⛓ `procgenCore/editorView`'s mount, alive only while the EDIT arm is. */
    let tool = null;
    let message = '';
    let messageBad = false;
    /**
     * ⛓⛓ THE AREA LAYER — a VIEW setting and nothing else. ⛔ It is NOT in the
     * URL (⚖ constructive ruling 9: the bar describes what was BUILT, and which
     * layer a reader is looking at is not part of that), and it never resets
     * the ladder: stepping the layers re-DRAWS, it does not re-generate.
     */
    let areaLayer = 'all';
    /**
     * ⛓⛓⛓ ARC 2 SLICE 4 — **THE SOLVE REPLAY.** `null` until SOLVE produces a
     * plan; then `{frames, index, playing}` where `frames` is
     * `mazeLab.planFrames`' output — one frame per position along the plan,
     * each carrying the player's cell and `state.blocks` VERBATIM.
     *
     * ⛔ It is CLEARED by anything that changes the world (a new rung, an edit,
     * an undo, a load): a replay of a plan through a level that has moved under
     * it would be an animation of a walk nobody can take.
     */
    let play = null;
    let playTimer = null;
    /**
     * ⛓⛓⛓ **THE ONE ANSWER TO "WHICH BLOCK LAYOUT IS ON SCREEN"**, and it is
     * deliberately ONE function rather than two agreeing ones.
     *
     * The element overlay is HANDED this, and the readout PUBLISHES this — so
     * `window.__mazeLab.play.blocks` is not a claim ABOUT the picture, it is
     * the picture's own argument. A build that drew the level's INITIAL layout
     * during a replay (`world.blocks` rather than `state.blocks`) therefore
     * moves the readout too, and the browser row's "the block moved between
     * frames" claim can see it. Two functions would have let the picture be
     * wrong while the readout stayed right, which is the echo/value split
     * (trap 269) reappearing inside one page.
     */
    const overlayBlocks = () => (play ? play.frames[play.index].blocks : null);
    /**
     * ⛓⛓ SLICE 4 — THE OPTIONAL HOST BRIDGE. `null` STANDALONE, and that is
     * not a fallback: `mazeLabBridge.js` is never even FETCHED without
     * `?iframeId=` (see `installBridge`), so the page a person opens at
     * :8000 has the module graph slice 3 measured, unchanged.
     *
     * ⛔ EVERY USE IS `bridge?.`, so the hosted and standalone pages run the
     * SAME code down to one optional call — the layout-consistency payoff
     * ⚖ ruling 6 bought the iframe for is only real if the document is
     * genuinely the same document.
     */
    let bridge = null;

    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ EDITOR v3 E2c — THE SET ARM'S STATE
     * ══════════════════════════════════════════════════════════════════
     *
     * ⛔ **THE HELD DOCUMENTS AND THE SESSION ARE TWO DIFFERENT FACTS, AND BOTH
     * ARE KEPT.** `heldLibrary` is the document AS LOADED — it is what
     * `mazeSetAdapter`'s `librarySource` resolves a `library` base against, and
     * that base CHECKS THE ID (⚖ ruling 2, §26.6), so a page that kept only the
     * session's folded record would have nothing to answer with. `setSession`
     * is where the EDITS live, and its `record()` is the one truth about what
     * the arm is showing.
     *
     * ⛓ `setSource` is HOW the library arrived. It exists because `?library=`
     * is COPIED FORWARD by the URL writer (it is not a parameter this page
     * owns): a paste after a `?library=` boot leaves a bar naming a document
     * nobody is editing, and this is the field that says so out loud instead of
     * letting the address be the only account.
     */
    let setAdapter = null;
    let setSession = null;
    /** ⛓ The lifted mount, alive only while the SET arm is. */
    let setUi = null;
    /** ⛓ The SET arm's own lifetime, so a LOAD arriving later can remount on it. */
    let setArmLt = null;
    /**
     * ⛓⛓⛓ **THE ROOM SESSION, AND IT LIVES INSIDE THE SET ARM'S LIFETIME.**
     *
     * ⛔⛔ NOT behind `#source=edit`. §27.1 #5: switching the selector RETIRES
     * this arm, which takes the LIBRARY session with it — a person who opened a
     * room that way would find the set's whole op list gone. The room is a
     * `mazeEditAdapter` session over ONE entry's world, mounted on the SAME
     * `#canvas` the EDIT arm uses, under `setArmLt`.
     *
     * ⛓ Three variables and each is one fact: WHICH entry, the SESSION its
     * edits live in, and the `editorView` mount that is drawing it. The
     * PALETTE is a fourth, and it is per-room because it is built from the
     * ROOM's own `itemLib`/`obstacleLib` — the lab level's would offer items
     * this entry does not have.
     */
    let setRoomIndex = null;
    let setRoomSess = null;
    let setRoomTool = null;
    let setRoomEditor = null;
    let heldLibrary = null;
    let heldOverlay = null;
    let setSource = null;
    /**
     * ⛓⛓⛓ EDITOR INTEGRATION W4 — **THE WORLD, BESIDE THE LIBRARY.** A world
     * is held INSTEAD of a library, never as well: its parts ARE the documents,
     * and a library loaded under a world would be a third document the world's
     * manifest does not name. ⛔ `heldWorld !== null` is the ONE test the arm
     * branches on, so there is no second way to ask which document is open.
     */
    let heldWorld = null;
    let heldWorldDocs = null;
    /**
     * ⛓⛓ EDITOR INTEGRATION W4 — **THE ROOM OPEN IN THE OTHER SUBSTRATE'S
     * PAGE**, or `null`. ⛔ A THIRD session beside the strip's and the maze
     * room's (§21.5 grew a row): it lives in ITS page, its `Ctrl+Z` is that
     * page's, and what this page holds is the door and the frame.
     */
    let foreignRoom = null;
    /** ⛓ …and which substrate the LAST foreign room was, so the sentence the
     *  fold prints can name it after the session has already been dropped.
     *  ⛔ DECLARED HERE and not beside its writer: a `let` declared below an
     *  arrow function that reads it is in its temporal dead zone if anything
     *  calls that function during mount ([[feedback_mount_time_call_hits_tdz]]). */
    let foreignSubstrateWas = null;
    let worldParts = null;
    let worldDeps = null;
    let worldNotes = [];
    /** The LOAD box's own note — separate from `say`, which is the page's. */
    let setLoadNote = '';
    let setLoadBad = false;
    /** The served index, FILTERED to the packs this arm can open. `null` until fetched. */
    let servedRows = null;
    /**
     * ⛓⛓ The two optional schemas, fetched ONCE and only for the SET arm.
     *
     * ⛔ **EVERY PATH THAT CAN HOLD A LIBRARY AWAITS `ensureSetSchemas` FIRST**,
     * and that is an ORDERING the code enforces rather than a convention:
     * `createMazeSetAdapter` CAPTURES `rulesSchema` at construction, so a
     * session opened before the fetch landed would check authored rules against
     * nothing for the rest of its life — and the page would say the rule
     * validated. Found by reading the capture, not by a row.
     */
    let rulesSchema = null;
    let atlasSchema = null;
    let setSchemasPromise = null;

    const say = (text, bad = false) => { message = text; messageBad = bad; };

    /**
     * ⛓⛓⛓ **THE ONE PLACE A NEW BASE RECORD ARRIVES.** Every `generateStep`,
     * every directive, every LOAD lands here, so there is one answer to *what
     * is this page editing* and one moment at which the op list is allowed to
     * reset.
     */
    const adopt = (next) => {
        state = next;
        session = openEditSession(state);
        state = projectSession(state, session);
        return state;
    };

    /** ⛓ THE SESSION CHANGED — put its three answers back on the state. ⛔ The
     *  ONE writer of `record`/`edits`/`certified` on this page. */
    const sync = () => { state = projectSession(state, session); };

    /**
     * ⛓ THE PALETTE'S EDITOR — created lazily because it needs the level's own
     * libraries, and re-created when a LOAD brings different ones.
     */
    const ensureEditor = () => {
        if (!editor) {
            editor = new MazeRoomEditor({
                itemLib: state.record.itemLib ?? DEFAULT_ITEMS,
                obstacleLib: state.record.obstacleLib ?? DEFAULT_OBSTACLES,
            });
        }
        return editor;
    };

    /**
     * ⛓⛓ **THE PALETTE, AS AN OP TEMPLATE** — `MazeRoomEditor.opFor` is the one
     * place the editor's private selection (`selectedItemId`,
     * `selectedObstacleId`) is spent, and it was already the ONE op builder a
     * press used. ⛔ `editorView` never sees a palette; it asks for an op.
     */
    const brushOp = (tx, ty) => ensureEditor().opFor(tx, ty);

    /**
     * ⛓ **WHAT A FLOOD PAINTS** — the CURRENT palette tile, and only a tile.
     * ⛔ A descriptor with no `entity` key emits `setTile` alone
     * (`mazeWriteOps` emits ops only for the fields the descriptor presents),
     * so a fill repaints the floor of a component without erasing what stands
     * on it. `null` when the palette names something that is not a tile — the
     * view refuses by name rather than flooding with a guess.
     */
    const floodTarget = () => {
        const t = ensureEditor().selectedType;
        if (t === PALETTE_TYPES.FLOOR) return { tile: 'floor' };
        if (t === PALETTE_TYPES.WALL) return { tile: 'wall' };
        return null;
    };

    /** ⛓ THE TWO PASTE FILTERS, read AT THE PRESS (the read-at-press law). */
    const pasteOptions = () => ({
        tilesOnly: $('labPasteTiles').checked,
        entitiesOnly: $('labPasteEntities').checked,
    });

    /**
     * ⛓⛓⛓ **§9.4's TWO BOUNDS, COUNTED OFF THE CLIP AND SAID BEFORE THE PASTE
     * LANDS.** ⛔ They are the MAZE's and `editorView` cannot know either — it
     * only guarantees that whatever this function names is printed first:
     *
     *  · **a pasted `setButton` DUPLICATES its resolved index** — the op shape
     *    carries the index on purpose (a replay must not allocate a different
     *    one), and `applyEditOp` does not refuse a duplicate, so two cells end
     *    up pressing one door;
     *  · **the ENTRANCE is a SINGLETON** — `setEntrance` MOVES the world's only
     *    one, and the cell it came from silently stops being the entrance.
     *
     * ⚠ Measured, not assumed: both are pinned by `mazeEditAdapter.test.js`.
     */
    const clipWarnings = (clip) => {
        const parts = (clip?.cells ?? []).flat().map((d) => d?.entity).filter(Boolean);
        const buttons = parts.filter((e) => e.button !== undefined).length;
        const entrances = parts.filter((e) => e.entrance).length;
        const out = [];
        if (buttons) {
            out.push(`this clip carries ${buttons} BUTTON(s) — a paste places a SECOND cell `
                + 'holding the same `button_A{n}`, so two cells will press one door');
        }
        if (entrances) {
            out.push('this clip carries the ENTRANCE — it is a SINGLETON, so a paste MOVES it '
                + 'and the cell it came from stops being the entrance');
        }
        return out;
    };

    /**
     * ⛓⛓ **THE PAGE'S COMMAND ROWS** — `editorView` adds the four tools and
     * `Escape`, and binds `Ctrl/Cmd+Z` to the row whose id is `undo`. ⛔ ONE
     * table: the buttons below and the keys are both views of it.
     */
    const undoCommand = {
        id: 'undo',
        label: 'UNDO one edit',
        key: 'u',
        run: () => {
            if (!session.undo()) {
                say('nothing to undo — this level carries no manual edit');
                render();
                return;
            }
            sync();
            lastSolve = null;
            clearPlay();
            say('undid one edit — UNDO is the FOLD over a shorter list, not a stack pop, so '
                + 'the level is byte-identical to one that never had it. Still UNCERTIFIED '
                + '(nothing has solved the world on screen)');
            render();
        },
    };

    /**
     * ⛓⛓ THE REPLAY DIES WITH THE WORLD IT IS A REPLAY OF. ⛔ Called from every
     * place that already sets `lastSolve = null` — a new rung, a directed
     * attempt, an edit, an undo, a load — because a plan animated over a level
     * that has moved under it is a picture of a walk nobody can take. The timer
     * is cleared first: an interval that outlived its frames would index past
     * the end of an array that no longer exists.
     */
    const stopPlaying = () => {
        if (playTimer !== null) clearInterval(playTimer);
        playTimer = null;
        if (play) play = { ...play, playing: false };
    };
    const clearPlay = () => { stopPlaying(); play = null; };

    /* ══════════════════════════════════════════════════════════════════
     * THE URL — written at every press, read only at boot
     * ══════════════════════════════════════════════════════════════════ */

    /**
     * ⛔ `history.replaceState` AND NOT AN ASSIGNMENT TO `location.search`. The
     * latter NAVIGATES, which is the reload the SWITCH arc removed; this
     * rewrites the bar in place and the page keeps its state.
     *
     * ⚠ IT REWRITES THE PARAMETERS IT OWNS AND COPIES THE REST, from the bar as
     * it stands — so a parameter this page does not know about survives a press
     * instead of being silently dropped.
     */
    const writeUrl = () => {
        if (!state) return;
        const search = writeLabParams(window.location.search, {
            source: params.source,
            seed: state.seed,
            biome: state.biome,
            width: state.width,
            height: state.height,
            bounds: state.bounds,
            budget: state.budget,
            step: state.step,
            roster: state.roster,
            // ⛔ SLICE 12: NO `directives` — ⚖ §3.9 took the list off the bar.
            skeleton: state.skeleton,
            areas: state.areas,
            require: state.require,
            /** ⛓ ARC 2 SLICE 4 — and the ELEMENT. ⛔ A defect this slice's own
             *  browser row found: the reader, the form, the identity line and
             *  the model all had it while THIS line did not, so the SELECTOR
             *  built the gadget and handed back a bar that names no element —
             *  a link to a level it does not describe. */
            elements: state.elements,
        });
        window.history.replaceState(null, '', `${window.location.pathname}?${search}`);
    };

    /* ══════════════════════════════════════════════════════════════════
     * THE CANVAS
     * ══════════════════════════════════════════════════════════════════ */

    /**
     * ⛓⛓ ONE DRAW, THREE PASSES: the world through `mazeRoomRender.drawWorld`
     * — the SAME function `mazeRoomUI` calls, pixel-gated — then the PLAN and
     * then the hovered cell, both on top.
     *
     * ⛔ THE OVERLAYS ARE NOT INSIDE `drawWorld`. A plan is a fact about a
     * SOLVE and a hover is a fact about a MOUSE; neither is a property of the
     * world, and putting them in the renderer would mean the panel had to pass
     * `plan: null` forever to say it has no solver.
     */
    /**
     * ⛓⛓⛓ A REFUSED **DIRECTIVE** MEANS THERE IS NO LEVEL TO SHOW. The run did
     * not produce what was asked for, so the page draws nothing and prints the
     * reason where the level would be. ⛔ An area graph that refused is a
     * different case: the room the carve built IS the level this run produced
     * (it simply has no locks), so it is drawn, with the module's reason beside
     * it — ⚖ the honest 11x11-at-two-keys state, which the acceptance table
     * says is most seeds.
     */
    const requireRefusal = () => state?.requireResult?.refused ?? null;

    /**
     * ⛓⛓⛓ EDITOR v3 E2c — **WHICH WORLD IS ON `#canvas`, IN ONE FUNCTION.**
     *
     * ⛔ In the SET arm the canvas belongs to the OPEN ROOM — a `mazeEditAdapter`
     * session over ONE library entry — and with no room open there is nothing
     * to draw. The level the other three arms hold is not this library's, and
     * painting it under a library somebody is editing would be a picture of the
     * wrong document beside a readout about the right one.
     *
     * ⛓ ONE function rather than two agreeing ones, for `overlayBlocks`' reason:
     * `draw`, `cellAt` and the hover all ask THIS, so a build that drew one
     * world and addressed another cannot exist.
     */
    const canvasWorld = () => (params?.source === SOURCES.SET
        ? (setRoomSess ? setRoomSess.record() : null)
        : state?.record ?? null);

    const draw = () => {
        const canvas = $('canvas');
        if (!state) return;
        /**
         * ⛓⛓ **THE EDITING OUTLINE IS A FACT ABOUT WHETHER A CLICK PAINTS, AND
         * IT IS DECIDED HERE RATHER THAN AT MOUNT.** ⛔ A DEFECT THIS SLICE'S
         * BROWSER ROW FOUND: it was set once in `mount()`, which for the SET arm
         * runs BEFORE any room is open — so opening one gave a canvas that
         * painted with no outline, and closing it left the outline on a canvas
         * that had nothing to paint. `mount` answers *which arm*; only `draw`
         * answers *is there a room under the cursor*.
         */
        canvas.classList.toggle('editing', params.source === SOURCES.EDIT
            || (params.source === SOURCES.SET && setRoomSess !== null));
        const w = canvasWorld();
        if (!w) {
            canvas.hidden = true;
            return;
        }
        canvas.width = w.width * TILE_PX;
        canvas.height = w.height * TILE_PX;
        const ctx = canvas.getContext('2d');
        // ⛓ A refused DIRECTIVE is a fact about the LADDER; a library room is
        //   not one of its rungs, so it draws regardless.
        if (params.source !== SOURCES.SET && requireRefusal()) {
            canvas.hidden = true;
            return;
        }
        canvas.hidden = false;
        /**
         * ⛓ DURING A REPLAY THE PLAYER IS DRAWN AT THE FRAME'S CELL — through
         * `plainView`'s own `playerPos` field, which the renderer has always
         * had and this page has never used (it had no play). `null` outside a
         * replay, which is the pre-play view `drawWorld` already documents.
         */
        drawWorld(ctx, w, plainView({
            tilePx: TILE_PX,
            playerPos: play ? play.frames[play.index].player : null,
        }));
        /**
         * ⛔⛔ EDITOR v3 E2c — **THE THREE SIBLING OVERLAYS ARE THE LAB LEVEL'S,
         * AND THEY DO NOT DRAW OVER A LIBRARY ROOM.** The area graph, the
         * gadget and the solve plan are all facts about `state.model` — the
         * level `?seed=` built. A library ENTRY is a different document
         * entirely, and painting the ladder's doors and keys over somebody
         * else's room would be an overlay of the wrong subject drawn in a
         * picture that looks right.
         */
        if (params.source !== SOURCES.SET) {
            // ⛓ THE GRAPH, over the grid — the sibling draw, layer by layer.
            drawAreaOverlay(ctx, state.model?.areas ?? null, { tilePx: TILE_PX, layer: areaLayer });
            /**
             * ⛓⛓ THE GADGET, over both — the second sibling. `blocks` is the ONE
             * answer (`overlayBlocks`), so the picture and the readout cannot
             * disagree about where the block is.
             */
            drawElementOverlay(ctx, state.model?.elements ?? null, {
                tilePx: TILE_PX, layer: areaLayer, blocks: overlayBlocks(),
            });

            const cells = lastSolve ? planCells(state, lastSolve) : null;
            if (cells && cells.length > 1) {
                ctx.save();
                ctx.strokeStyle = COLORS.player;
                ctx.lineWidth = 2.5;
                ctx.globalAlpha = 0.85;
                ctx.beginPath();
                cells.forEach((c, i) => {
                    const x = c.x * TILE_PX + TILE_PX / 2;
                    const y = c.y * TILE_PX + TILE_PX / 2;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                });
                ctx.stroke();
                ctx.restore();
            }
        }
        if (hover) {
            ctx.save();
            ctx.strokeStyle = '#ffd75f';
            ctx.lineWidth = 2;
            ctx.strokeRect(hover.tx * TILE_PX + 1, hover.ty * TILE_PX + 1,
                TILE_PX - 2, TILE_PX - 2);
            ctx.restore();
        }
    };

    /**
     * ⛔ THE CELL A POINT NAMES IS `labView.tileAtPoint`'s ANSWER, derived from
     * the ROOM's dimensions and the ELEMENT's on-screen size — never from
     * `TILE_PX`, which is the canvas's INTRINSIC scale and says nothing about
     * how the browser is presenting it. ⚠ An out-of-range point REFUSES rather
     * than clamping, so this catches and reports instead of silently naming the
     * last cell.
     */
    const cellAt = (event) => {
        const canvas = $('canvas');
        const rect = canvas.getBoundingClientRect();
        /**
         * ⛓ EDITOR v3 E2c — THE DIMENSIONS COME FROM `canvasWorld()`, the same
         * function `draw` paints from. ⛔ `state.record` was right while the
         * canvas could only ever hold the lab's own level; under the SET arm it
         * holds one library ENTRY, whose room is a different size, and a build
         * that addressed cells by the lab level's dimensions would paint the
         * wrong tile on any entry that is not 11x11.
         */
        const world = canvasWorld();
        if (!world) return null;
        try {
            return tileAtPoint({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                width: rect.width,
                height: rect.height,
                cols: world.width,
                rows: world.height,
            });
        } catch {
            return null;
        }
    };

    /* ══════════════════════════════════════════════════════════════════
     * THE PANES
     * ══════════════════════════════════════════════════════════════════ */

    const renderTrace = () => {
        const box = $('labTrace');
        box.textContent = '';
        const rows = generationRows(state?.trace ?? []);
        if (rows.length === 0) {
            box.appendChild(el('div', 'traceNone',
                'no attempts yet — the SKELETON is the open room and its goal, before any '
                + 'template is drawn.'));
            return;
        }
        for (const r of rows) {
            const row = el('div', `tr ${r.outcome === 'KEPT' ? 'kept' : ''}`);
            const head = el('div');
            head.appendChild(el('b', null, r.label));
            head.appendChild(document.createTextNode(' '));
            head.appendChild(el('span', null, r.instance));
            if (r.at) head.appendChild(el('span', null, ` ${r.at}`));
            head.appendChild(document.createTextNode(' '));
            head.appendChild(el('span', r.outcome === 'KEPT' ? 'g' : 'o', r.outcome));
            if (r.verdict) head.appendChild(el('span', 's', ` ${r.verdict}`));
            if (r.ticks !== null) head.appendChild(el('span', null, ` ${r.ticks} step(s)`));
            row.appendChild(head);
            // ⛔ VERBATIM, both of them, and as two lines because they are two
            // claims: HOW the oracle decided, and WHAT the solver said.
            if (r.classifiedBy) row.appendChild(el('div', 'rj', `classified by: ${r.classifiedBy}`));
            if (r.reasonText) row.appendChild(el('div', 'rj', r.reasonText));
            box.appendChild(row);
        }
    };

    /**
     * ⛓⛓⛓ THE CATALOGUE + RESTRICT. ⚖ Ruling 1: *"a list of things that can be
     * generated"* + *"choose the sub-roster a run may draw from"*.
     *
     * ⛔ THE EXCLUDED ROWS ARE IN IT (the v1 maze palette declares none, and the
     * branch is written anyway — a list that could not show what a palette
     * CANNOT generate would be the graceful-skip shape wearing a roster's
     * clothes, and slice 6's yield table is expected to produce exclusions).
     */
    const renderRoster = () => {
        const box = $('labRoster');
        box.textContent = '';
        const cat = labCatalogue(state.biome);
        const picked = new Set(state.roster?.axis === 'families' ? state.roster.names : []);
        for (const g of cat.groups) {
            const fam = el('div', 'catFamily');
            const head = el('div', 'catHead');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'famBox';
            cb.dataset.family = g.family;
            cb.checked = !state.roster || picked.has(g.family);
            lifetimes.current().on(cb, 'change', () => {
                const on = [...document.querySelectorAll('#labRoster .famBox')]
                    .filter((b) => b.checked).map((b) => b.dataset.family);
                /**
                 * ⛔ ALL-TICKED IS **NO RESTRICTION**, not a restriction naming
                 * everything. The two are different questions and
                 * `restrictPalette` names the palette differently for each, so a
                 * page that wrote one when a person meant the other would put a
                 * roster in the payload nobody asked for.
                 */
                const all = on.length === cat.groups.length;
                try {
                    adopt(Object.freeze({
                        ...state,
                        roster: all ? null : { axis: 'families', names: on },
                    }));
                    say(all ? 'the WHOLE roster — no restriction'
                        : `restricted to families [${on.join(', ')}]`);
                } catch (e) {
                    say(e.message, true);
                }
                render();
            });
            head.appendChild(cb);
            head.appendChild(document.createTextNode(` ${g.family}`));
            fam.appendChild(head);
            for (const t of g.templates) {
                const row = el('div', 'catRow');
                row.appendChild(el('b', null, t.name));
                if (t.why) row.appendChild(el('div', 'rj', t.why));
                fam.appendChild(row);
                fam.appendChild(directedForm(t));
            }
            for (const x of g.excluded) {
                const row = el('div', 'catRow excluded');
                row.appendChild(el('b', null, x.name));
                if (x.cause) row.appendChild(el('div', 'rj', x.cause));
                fam.appendChild(row);
            }
            box.appendChild(fam);
        }
        $('labRosterNote').textContent = `${cat.counts.templates} template(s) in `
            + `${cat.counts.families} family(ies)${cat.counts.excluded
                ? `, ${cat.counts.excluded} excluded` : ''}`;
    };

    /**
     * ⛓⛓⛓ VERB 2 — the per-row parameter form and its ATTEMPT button. ⚖ Ruling
     * 1: *"a button to make the generator attempt to generate that specific
     * thing."*
     *
     * ⛔ THE COST IS PRINTED BESIDE THE BUTTON, before it is pressed. A solve is
     * synchronous and uninterruptible, so a budget bounds what is ACCEPTED and
     * never what is SPENT — the number a presser is agreeing to has to be
     * visible at press time.
     */
    const directedForm = (t) => {
        const form = el('div', 'catForm');
        const selects = new Map();
        for (const p of t.params ?? []) {
            const s = document.createElement('select');
            s.dataset.key = p.key;
            /**
             * ⛓ "any" IS A REAL OPTION AND IT IS THE DEFAULT: a directive may
             * leave a parameter to be DRAWN, and what it then RECORDS is the
             * drawn value (`mazeLab.applyDirective`'s two salted streams).
             */
            s.appendChild(new Option('any', ''));
            for (const v of p.domain) s.appendChild(new Option(`${p.key}=${v}`, String(v)));
            form.appendChild(el('span', null, ` ${p.key} `));
            form.appendChild(s);
            selects.set(p.key, { select: s, domain: p.domain });
        }
        const btn = el('button', null, 'ATTEMPT');
        btn.dataset.template = t.name;
        lifetimes.current().on(btn, 'click', () => {
            const values = {};
            for (const [key, { select, domain }] of selects) {
                if (select.value === '') continue;
                values[key] = domain.find((v) => String(v) === select.value);
            }
            try {
                adopt(applyDirective(state, {
                    template: t.name,
                    params: values,
                    anchor: null,
                    bound: DIRECTED_ANCHOR_TRIES,
                }, (state.directives ?? []).length));
                const d = state.directives[state.directives.length - 1];
                say(`${d.instance}: ${d.outcome}`
                    + (d.at ? ` at (${d.at.tx},${d.at.ty})` : '')
                    + (d.outcome === 'KEPT' ? ` — ${describeKeptKind(d)}` : ''),
                d.outcome !== 'KEPT');
                lastSolve = null;
                clearPlay();
                writeUrl();
            } catch (e) {
                say(e.message, true);
            }
            render();
        });
        form.appendChild(document.createTextNode(' '));
        form.appendChild(btn);
        form.appendChild(el('span', 'cost',
            ` ≤ ${DIRECTED_ANCHOR_TRIES + 1} solves`));
        return form;
    };

    const renderDirectives = () => {
        const box = $('labDirectives');
        box.textContent = '';
        for (const d of state.directives ?? []) {
            const row = el('div', 'dRow');
            row.appendChild(el('b', null, d.instance));
            row.appendChild(document.createTextNode(' '));
            row.appendChild(el('span', d.outcome === 'KEPT' ? 'g' : 'o', d.outcome));
            if (d.at) row.appendChild(el('span', null, ` at (${d.at.tx},${d.at.ty})`));
            row.appendChild(el('div', 'rj',
                d.outcome === 'KEPT'
                    ? describeKeptKind(d)
                    : `${d.anchorsWalked ?? 0} of ${d.anchorsOffered ?? 0} offered anchor(s) `
                        + 'were walked and none was accepted'));
            box.appendChild(row);
        }
        $('labDirectivesNote').textContent = (state.directives ?? []).length
            ? `${state.directives.length} directive(s), in order`
            : 'none — press ATTEMPT on a catalogue row';
    };

    const renderEditPanel = () => {
        const box = $('labPalette');
        box.textContent = '';
        for (const e of PALETTE_ENTRIES) {
            const b = el('button', 'paletteBtn', `${e.glyph} ${e.label}`);
            b.dataset.type = e.type;
            if (editor?.selectedType === e.type) b.classList.add('armed');
            lifetimes.current().on(b, 'click', () => {
                editor.selectType(e.type);
                say(`palette: ${e.label} — click a tile`);
                render();
            });
            box.appendChild(b);
        }
        /**
         * ⛓⛓ SLICE A2 — **THE TOOL BUTTONS ARE A VIEW OF `editorView`'s COMMAND
         * TABLE**, in its own order, each carrying the key the table declares.
         * ⛔ They live in `#labTools` and NOT in `#labPalette`: the browser row
         * ENUMERATES the palette box (one button per `PALETTE_ENTRIES` row) and
         * a knob dropped into an enumerated container counts as a member — the
         * group-B lesson, and it reds three claims at once.
         */
        const tools = $('labTools');
        tools.textContent = '';
        for (const row of tool?.commands ?? []) {
            if (row.id === undoCommand.id) continue;
            const b = el('button', 'toolBtn', `${row.label}${row.key ? ` (${row.key})` : ''}`);
            b.dataset.tool = row.id;
            if (tool && row.id === tool.tool) b.classList.add('armed');
            lifetimes.current().on(b, 'click', () => { row.run(); render(); });
            tools.appendChild(b);
        }
        /**
         * ⛓⛓ THE NOTE IS `editCore.describeOps` PLUS THE PER-OP SENTENCES. ⛔
         * The head counts TOP-LEVEL ops, which is what UNDO is a count of: a
         * pane that said "14 edits" for a list holding one 14-cell stroke would
         * describe a history with fourteen presses in it and thirteen of them
         * un-undoable. The group sizes ride in the parenthesis.
         */
        $('editNote').textContent = (state.edits ?? []).length
            ? `${describeOps(state.edits.map((e) => e.op))}: `
                + state.edits.map((e) => `#${e.n} ${e.description}`).join(' · ')
            : 'no manual edits yet.';
        $('clipNote').textContent = tool?.clip
            ? `clip: ${tool.clip.w}x${tool.clip.h}`
                + (clipWarnings(tool.clip).length
                    ? ` ⚠ ${clipWarnings(tool.clip).join(' ⚠ ')}` : '')
            : 'no clip — arm RECT and click two opposite corners';
    };

    const renderSolvePanel = () => {
        const note = $('solveNote');
        note.textContent = '';
        /**
         * ⛓⛓⛓ THE REPLAY'S OWN LINE — ⚖ design ruling 6 fn. 3. It names the
         * FRAME, the BLOCK LAYOUT at that frame and how many DISTINCT layouts
         * the whole plan visits, because the last number is the one that says
         * whether this level's solve pushes anything at all: a plan that never
         * moves a block visits exactly one.
         */
        const pn = $('playNote');
        for (const id of ['labPlayPrev', 'labPlayNext', 'labPlay', 'labPlayReset']) {
            $(id).disabled = !play;
        }
        if (!play) {
            pn.textContent = lastSolve
                ? 'no plan to replay — the solve produced none, or it did not replay through '
                    + 'the engine\'s own `step` (which is a SEAM DEFECT, not an animation '
                    + 'problem).'
                : '';
        } else {
            const f = play.frames[play.index];
            const layouts = new Set(play.frames.map((g) => JSON.stringify(g.blocks))).size;
            /**
             * ⛓⛓ THE LINE PRINTS `overlayBlocks()`, NOT `f.blocks` — a defect
             * MUTANT (b) found in this file. Reading the frame directly made
             * the sentence a SECOND answer to "which layout is on screen": under
             * a build that handed the overlay the level's initial layout the
             * picture showed one thing and this line said another, and it was
             * the LINE that was right. ⛔ One function answers that question.
             * ⚠ `layouts` is deliberately still off the FRAMES: it is a
             * statement about the PLAN, not about the picture.
             */
            const shown = overlayBlocks();
            pn.textContent = `frame ${play.index}/${play.frames.length - 1}`
                + ` · player (${f.player.x},${f.player.y})`
                + ` · blocks ${shown === null ? '(this level has none)' : `[${shown.join(' ')}]`}`
                + ` · ${layouts} DISTINCT block layout(s) over the whole plan`
                + `${layouts > 1 ? ' — the walk PUSHES' : ''}`;
        }
        if (!lastSolve) {
            note.appendChild(el('div', 'rj',
                'press SOLVE — the ORACLE runs on the world now on screen (the same '
                + '`mazeOracle` the loop uses, certified by REPLAY through the engine\'s own '
                + '`step`).'));
            return;
        }
        note.appendChild(el('div', lastSolve.verdict === 'SOLVED' ? 'g' : 'o',
            `${lastSolve.verdict}${lastSolve.ticks ? ` in ${lastSolve.ticks} step(s)` : ''}`));
        // ⛔ VERBATIM — the oracle's own sentence, never a paraphrase.
        note.appendChild(el('div', 'rj', `classified by: ${lastSolve.classifiedBy}`));
        if (lastSolve.reasonText) note.appendChild(el('div', 'rj', lastSolve.reasonText));
    };

    /* ══════════════════════════════════════════════════════════════════
     * THE FORM
     * ══════════════════════════════════════════════════════════════════ */

    const FIELDS = [
        ['labSeed', (s) => s.seed],
        ['labWidth', (s) => s.width],
        ['labHeight', (s) => s.height],
        ['labCount', (s) => s.bounds.obstacleTarget],
        ['labTries', (s) => s.bounds.triesPerStep],
        ['labK', (s) => s.bounds.saturationK],
        ['labAnchorTries', (s) => s.bounds.anchorTriesPerCandidate],
        ['labExpansions', (s) => s.budget.maxExpansions],
    ];

    /**
     * ── ⛓⛓⛓ SLICE 7 — THE KIND'S PARAMETERS, AS A FORM ─────────────────
     *
     * ⛔ MOUNTED FROM THE CATALOGUE'S OWN SCHEMA (the options ARE the declared
     * domain, the pre-selection IS the declared default), and RE-MOUNTED AT
     * DEFAULTS on every kind change rather than merged — `minRoom` is `rooms`'
     * knob and carrying it onto `winding` would be a control writing state
     * nobody reads. ⚠ No "any (draw it)" option: a template parameter may be
     * drawn, a room parameter is chosen.
     */
    const mountSkeletonParams = (kind, values = {}) => {
        const box = $('labSkeletonParams');
        box.innerHTML = '';
        const row = skeletonCatalogue({ simulator: true }).find((r) => r.kind === kind);
        for (const p of row?.params ?? []) {
            const label = document.createElement('label');
            label.textContent = `${p.key} `;
            label.title = p.why;
            const sel = document.createElement('select');
            sel.dataset.skelParam = p.key;
            for (const v of p.domain) {
                const o = new Option(String(v), String(v));
                if (v === (values[p.key] ?? p.default)) o.selected = true;
                sel.appendChild(o);
            }
            label.appendChild(sel);
            box.appendChild(label);
        }
    };
    /** ⛔ TYPED FROM THE DOMAIN — a `<select>` hands back a string and the
     *  state, the payload and the URL all carry the domain's own number. */
    const readSkeletonParams = (kind) => {
        const out = {};
        const row = skeletonCatalogue({ simulator: true }).find((r) => r.kind === kind);
        for (const p of row?.params ?? []) {
            const sel = $('labSkeletonParams')
                .querySelector(`select[data-skel-param="${p.key}"]`);
            if (!sel) continue;
            const v = p.domain.find((d) => String(d) === sel.value);
            if (v !== undefined) out[p.key] = v;
        }
        return out;
    };

    /**
     * ⛓⛓ THE AREA PANE — the module's own sentence, and a LEGEND with one row
     * per SYMBOL. ⚠ §9.11(6): door counts are not small, so the canvas carries
     * colour only and the symbols are named exactly once, here.
     */
    const renderAreaPane = () => {
        const note = $('labAreaNote');
        const legendBox = $('labAreaLegend');
        legendBox.innerHTML = '';
        note.textContent = '';
        note.className = '';
        const info = state.model?.areas ?? null;
        const req = state.requireResult ?? null;
        // ⛔ VERBATIM — the binding's / the directive's own reason.
        if (req?.refused) {
            note.className = 'refused';
            note.textContent = `⛔ requires ${formatRequireList(req.asked)} — REFUSED: `
                + `${req.refused.reason}. ${req.refused.detail} ⛓ No level is shown, because `
                + 'this run did not produce the one that was asked for.';
            return;
        }
        if (info && info.spec.keys > 0 && !info.ran) {
            note.className = 'refused';
            note.textContent = `⛔ the area graph REFUSED: ${info.refused.reason}. `
                + `${info.refused.detail}`;
            return;
        }
        if (!info?.ran) return;
        note.className = 'ran';
        note.textContent = `areas: ${info.partitionSummary.areaCount} `
            + `(${info.partitionSummary.syntheticCount} synthetic — the 1-cell areas grown on `
            + `the entrance and the goal), ${info.partitionSummary.adjacencyCount} adjacency `
            + `pair(s), ${info.graph.edges.filter((e) => e.kind === 'graphify').length} graphify `
            + `edge(s) (dashed); layer: ${areaLayer}`
            + (req ? ` · requires ${formatRequireList(req.asked)} MET, every symbol STRONG `
                + '(remove the key, keep the doors → the goal is unreachable)' : '');
        for (const row of areaLegend(info)) {
            const box = el('div', 'lg');
            const sw = el('span', 'sw');
            sw.style.background = row.color;
            box.appendChild(sw);
            box.appendChild(el('b', null, row.symbol));
            box.appendChild(el('span', null,
                `${row.doorCount} door(s) on ${row.areas.length} area(s) at key level `
                + `${row.level}; key in ${row.key ? `${row.key.area} (${row.key.x},${row.key.y})`
                    : '(nowhere)'}`));
            legendBox.appendChild(box);
        }
    };

    /**
     * ⛓⛓⛓ THE ELEMENT PANE — the binding's own sentence, and a LEGEND with one
     * row per PLACED GADGET. ⚠ §10.11.5 is why the REFUSAL row exists and is
     * not a fallback: `guard;len=3;turns=1` at 15x15 places on ~38% of seeds
     * and GUARDS on ~7%, so on most seeds THE REFUSAL IS WHAT THIS PAGE HAS TO
     * SAY, and it says it where the gadget would be. ⛔ No bound is widened to
     * make the page look better.
     */
    const renderElementPane = () => {
        const note = $('labElementNote');
        const box = $('labElementLegend');
        box.innerHTML = '';
        note.textContent = '';
        note.className = '';
        const info = state.model?.elements ?? null;
        if (!info || info.spec?.name === DEFAULT_ELEMENTS.name) return;
        if (!info.ran) {
            note.className = 'refused';
            // ⛔ VERBATIM — the binding's own reason and its own detail.
            note.textContent = `⛔ the element REFUSED: ${info.refused.reason}. `
                + `${info.refused.detail}`;
            return;
        }
        note.className = 'ran';
        note.textContent = `elements: ${info.placed.length} gadget(s) placed. ⛓ THE SITE is `
            + 'outlined in pink and the TUNNEL — the cells the CONNECTOR dug to reach the '
            + 'entry port — is shaded violet and dashed, because a 28-cell straight corridor '
            + 'is otherwise read as an artefact of the maze backend. The BLOCK is the square, '
            + 'the BUTTON the ring (FILLED while it is pressed), the guard DOOR the brown '
            + 'border and the FLAG the pennant; the two stubs on the site edge are its PORTS '
            + '(green in, orange out — the exit mouth is SEALED, so the gadget is a '
            + 'one-mouth pocket and its door is a CUT of the level).';
        for (const row of elementLegend(info)) {
            const lg = el('div', 'lg');
            const sw = el('span', 'sw');
            sw.style.background = row.color;
            lg.appendChild(sw);
            lg.appendChild(el('b', null, row.instance));
            lg.appendChild(el('span', null,
                `${row.button} holds ${row.hold} → ${row.door}; `
                + `${row.guards ? `GUARDS ${row.guards}` : 'guards NOTHING on this seed'}; `
                + `len=${row.cost.len} turns=${row.cost.turns} ${row.cost.cells} carved cell(s), `
                + `${row.tunnelCells} tunnel cell(s)`));
            box.appendChild(lg);
        }
    };

    /**
     * ⛓ THE ELEMENT'S PARAMETERS, AS A FORM — mounted from the codec's own
     * schema for the SELECTED HEAD (`paramSchemaFor`, which is the element's
     * own `params` plus the binding's `binds`; there is no third source and
     * nothing is copied), and RE-MOUNTED on a head change rather than merged.
     *
     * ⛓⛓ IT HAS AN "any (draw it)" OPTION AND THE AREA FORM DOES NOT, and that
     * is the one place this form differs from its two siblings: for an element,
     * a parameter the caller NAMES is an override that spends NO draw and one
     * they omit is DRAWN, so `guard` and `guard;len=3` are different runs even
     * when `len` resolves to 3 (`elementSpec.namedParams`). A form with no way
     * to say "draw it" could only ever produce the first kind.
     */
    const mountElementParams = (name, values = {}) => {
        const box = $('labElementParams');
        box.innerHTML = '';
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
     *  which is exactly how "draw this one" is spelled in the spec. */
    const readElementParams = (name) => {
        const out = {};
        for (const p of paramSchemaFor(name)) {
            const sel = $('labElementParams').querySelector(`select[data-elem-param="${p.key}"]`);
            if (!sel || sel.value === '') continue;
            const v = p.domain.find((d) => String(d) === sel.value);
            if (v !== undefined) out[p.key] = v;
        }
        return out;
    };

    /**
     * ⛓ THE AREA SPEC'S PARAMETERS, AS A FORM — mounted from the codec's own
     * schema (the options ARE the declared domain, the pre-selection IS the
     * declared default), exactly as the skeleton's params form is.
     */
    const mountAreaParams = (values = {}) => {
        const box = $('labAreaParams');
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
    /** ⛔ TYPED FROM THE DOMAIN — a `<select>` hands back a string. */
    const readAreaParams = () => {
        const out = {};
        for (const p of AREA_PARAM_SCHEMA) {
            const sel = $('labAreaParams').querySelector(`select[data-area-param="${p.key}"]`);
            if (!sel) continue;
            const v = p.domain.find((d) => String(d) === sel.value);
            if (v !== undefined) out[p.key] = v;
        }
        return out;
    };
    /**
     * ⛔ THE DIRECTIVE IS PARSED THROUGH THE ONE CODEC, at the press — an empty
     * box is NO directive (which is what absence means in the URL too), and a
     * misspelled symbol REFUSES by name rather than being dropped.
     */
    const readRequireBox = () => {
        const raw = $('labRequire').value.trim();
        return raw === '' ? null : parseRequireList(raw);
    };

    const fillForm = () => {
        for (const [id, get] of FIELDS) $(id).value = String(get(state));
        $('labBiome').value = state.biome;
        $('labSkeleton').value = state.skeleton?.kind ?? 'empty';
        mountSkeletonParams(state.skeleton?.kind ?? 'empty', state.skeleton?.params ?? {});
        $('labAreas').value = String(state.areas?.keys ?? 0);
        mountAreaParams(state.areas?.params ?? {});
        $('labElements').value = state.elements?.name ?? DEFAULT_ELEMENTS.name;
        mountElementParams(state.elements?.name ?? DEFAULT_ELEMENTS.name,
            state.elements?.params ?? {});
        $('labRequire').value = formatRequireList(state.require);
        $('labAreaLayer').value = areaLayer;
    };

    /** The form's numbers, as the next run's arguments. ⛔ The FORM is read at
     *  press time and never cached — a control that edited a local variable is
     *  the defect law 1 exists to end. */
    const formArgs = () => ({
        seed: Number($('labSeed').value),
        biome: $('labBiome').value,
        width: Number($('labWidth').value),
        height: Number($('labHeight').value),
        bounds: {
            obstacleTarget: Number($('labCount').value),
            triesPerStep: Number($('labTries').value),
            saturationK: Number($('labK').value),
            anchorTriesPerCandidate: Number($('labAnchorTries').value),
        },
        budget: { maxExpansions: Number($('labExpansions').value) },
        roster: state.roster,
        /**
         * ⛓ SLICE 5 — READ AT THE PRESS like every other control (law 1). ⛔
         * The SELECT is read, not a variable: a handler that cached the kind
         * early would leave the form comparing a value to itself, which is the
         * defect the read-at-press law exists to end.
         */
        skeleton: normalizeSkeleton({
            kind: $('labSkeleton').value,
            /** ⛓ SLICE 7 — the parameters, read at the press on the same terms. */
            params: readSkeletonParams($('labSkeleton').value),
        }),
        /** ⛓ ELEMENTS SLICE 3 — the graph and the directive, read at the press. */
        areas: normalizeAreaSpec({
            keys: Number($('labAreas').value), params: readAreaParams(),
        }),
        /** ⛓ ELEMENTS ARC 2 SLICE 4 — the gadget, read at the press. */
        elements: normalizeElementSpec({
            name: $('labElements').value, params: readElementParams($('labElements').value),
        }),
        require: readRequireBox(),
    });

    const goTo = (step) => {
        const a = formArgs();
        try {
            adopt(generateStep({ ...a, step }));
            lastSolve = null;
            clearPlay();
            payloadCheck = null;
            say(`step ${step}: ${state.summary
                ? `kept ${state.summary.keptCount}/${step}` : 'the skeleton'}`);
        } catch (e) {
            say(e.message, true);
        }
        writeUrl();
        render();
    };

    /**
     * ⛓ RUN-ALL climbs the ladder one rung at a time so the display updates
     * after EVERY placement — and stops at SATURATION, which is the loop's own
     * answer and not a count this page keeps.
     */
    const runAll = () => {
        const a = formArgs();
        const target = a.bounds.obstacleTarget;
        say(`RUN-ALL to ${target}: ≤ ${ladderCost(a.bounds, WORST_CASE_SOLVE_MS).solves} solves`);
        try {
            for (let k = 1; k <= target; k += 1) {
                adopt(generateStep({ ...a, step: k }));
                if (state.saturated) {
                    say(`SATURATED at step ${k} — ${a.bounds.saturationK} consecutive steps `
                        + 'kept nothing', true);
                    break;
                }
            }
            lastSolve = null;
            clearPlay();
            payloadCheck = null;
        } catch (e) {
            say(e.message, true);
        }
        writeUrl();
        render();
    };

    /* ══════════════════════════════════════════════════════════════════
     * SAVE / LOAD — ⛔ THE PAGE NEVER WRITES fixtures/
     * ══════════════════════════════════════════════════════════════════ */

    const refreshSaveBox = () => {
        $('labText').value = JSON.stringify(labPayload(state), null, 2);
    };

    const download = () => {
        const blob = new Blob([`${JSON.stringify(labPayload(state), null, 2)}\n`],
            { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `maze-seed${state.seed}-step${state.step}`
            + `${(state.edits ?? []).length ? `-e${state.edits.length}` : ''}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        say(`downloaded ${a.download}`);
    };

    const loadFromBox = () => {
        try {
            const payload = JSON.parse($('labText').value);
            adopt(loadPayload(payload));
            editor = null;
            lastSolve = null;
            clearPlay();
            payloadCheck = null;
            say(`loaded a ${state.width}x${state.height} level with `
                + `${(state.edits ?? []).length} recorded edit(s) — UNCERTIFIED until SOLVE`);
        } catch (e) {
            say(e.message, true);
        }
        render();
    };

    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ EDITOR v3 E2c — THE SET ARM: ONE INTAKE PATH PER DOCUMENT KIND
     * ══════════════════════════════════════════════════════════════════
     *
     * ⛔ **THE PAGE OWNS NO VALIDATOR.** Text goes through
     * `regionLibraryLoader.parseRegionLibrary` and a served pack through
     * `loadServedLibrary`; both return `{ok, library, errors, warnings}` and
     * both run `validateRegionLibrary`, so the sentence a reader gets is the
     * validator's own and there is exactly one of them. An OVERLAY is refused by
     * `mazeSetAdapter.setRecord` (`assertOverlay` names the room, the exit and
     * the rule), for the same reason.
     */

    const setNote = (text, bad = false) => { setLoadNote = text; setLoadBad = bad; };

    /** ⛓ ONE promise, awaited by every path that can hold a library. */
    const ensureSetSchemas = () => {
        if (!setSchemasPromise) {
            setSchemasPromise = Promise.all([
                optionalJson('schema/rules.schema.json', 'the rules schema'),
                optionalJson('schema/region-atlas.schema.json', 'the region-atlas schema'),
            ]).then(([rules, atlas]) => { rulesSchema = rules; atlasSchema = atlas; });
        }
        return setSchemasPromise;
    };

    /**
     * ⛓⛓ **OPEN A SESSION OVER THE HELD PAIR.** ⛔ Re-opened, never edited, when
     * either document is replaced — the same law `adopt` follows for the level:
     * a session that kept its op list across a new library would fold yesterday's
     * presses onto today's rooms.
     *
     * ⛓ The `librarySource`/`overlaySource` the adapter is built with resolve
     * ONLY the held documents and CHECK THE ID (⚖ ruling 2's shape) — a base
     * naming a different `library_id` refuses by name rather than opening
     * against whatever happens to be in hand.
     */
    const openSetSession = () => {
        /**
         * ⛓⛓⛓ EDITOR INTEGRATION W4 — **A WORLD OPENS OVER W2's COMPOSITE.**
         * The descriptors are built PER LOAD because two of their halves are
         * facts about the document in hand (the Seedling part's
         * `atlas.mapDocument` names the WORLD; both adapters take the fetched
         * schema), and the ids are the WORLD's own.
         */
        if (heldWorld) {
            const built = worldPartDescriptors({
                world: heldWorld,
                rulesSchema,
                mapDocument: heldWorld.world_id ?? 'world.json',
                tileSize: TILE_SIZE,
                parseOel: parseOelLevel,
                tileTypeForPlacement,
                substrateIdFor,
            });
            if (built.errors.length > 0) {
                throw new Error(`this world's parts cannot be opened — ${built.errors.join(' | ')}`);
            }
            worldParts = built.parts;
            worldDeps = built.deps;
            setAdapter = createWorldSetAdapter({ parts: worldParts });
            const base = { kind: 'world', world_id: heldWorld.world_id ?? null };
            setSession = createSetSession(
                setAdapter, worldRecord(heldWorld, heldWorldDocs), { base });
            return;
        }
        worldParts = null;
        worldDeps = null;
        setAdapter = createMazeSetAdapter({
            rulesSchema,
            librarySource: (id) => (heldLibrary?.library_id === id ? heldLibrary : null),
            overlaySource: (id) => (heldOverlay?.overlay_id === id ? heldOverlay : null),
        });
        const base = { kind: 'library', library_id: heldLibrary.library_id };
        if (heldOverlay?.overlay_id) base.overlay_id = heldOverlay.overlay_id;
        setSession = createSetSession(
            setAdapter, setRecord(heldLibrary, heldOverlay ?? emptyMazeOverlay()), { base });
    };

    /**
     * ⛓⛓ **THE ROOM `<select>` IS THE PAGE'S TO FILL, AND THAT IS THE MOUNT'S
     * OWN DIVISION** — `selectRoom` only ever sets its VALUE (`setEditorView.js`),
     * exactly as `watchViewer.renderSetRooms` fills Seedling's. ⛔ It is filled
     * BEFORE the mount, because `mountSetEditor` ends with `selectRoom(0)` and
     * a `value = '0'` on an empty `<select>` sets nothing.
     */
    /**
     * ⛓⛓ EDITOR INTEGRATION W4 — **ONE ROOM COUNT AND ONE OPTION LIST FOR BOTH
     * DOCUMENTS.** ⛔ Off the ADAPTER's `bounds`/`readCell` rather than off
     * `record().library.entries`: a world's record has no `library` half at all,
     * and every reader of "how many rooms" that reached into one document would
     * be a second place to teach the next one.
     */
    const setRoomCount = () => (setSession ? setAdapter.bounds(setSession.record()).w : 0);

    const setRoomOptions = () => {
        if (!setSession) return [];
        const record = setSession.record();
        return Array.from({ length: setRoomCount() }, (_, i) => {
            const cell = setAdapter.readCell(record, i, 0);
            return {
                value: String(i),
                label: `${i}${cell.room?.name ? ` · ${cell.room.name}` : ''}`
                    + (cell.part ? ` [${cell.part}]` : ''),
            };
        });
    };

    const fillSetRoomSelect = () => {
        const sel = $('editSetRoom');
        if (!sel) return;
        const keep = sel.value;
        sel.innerHTML = '';
        const options = setRoomOptions();
        for (const o of options) sel.appendChild(new Option(o.label, o.value));
        if (keep !== '' && Number(keep) < options.length) sel.value = keep;
        sel.disabled = options.length === 0;
    };

    /**
     * ⛓⛓ **THE CONTROLS ARE ENABLED BY THE PAGE, NOT BY THE MOUNT** — the same
     * division `watchViewer` uses. ⛔ `editRoomClose` is NOT in this roster: the
     * mount owns it and disables it on every render when no room is open, and a
     * page that also wrote it would be a second authority on a control whose
     * state is a fact only the mount has. `editDownloadRules` is the REPORT's,
     * for the same reason.
     *
     * ⛓⛓ `editSetAddRoom` IS IN IT NOW (EDITOR v3 E6b). E2c kept it out with a
     * `title` saying this arm had no blank maze room to mint; E3b landed
     * `blankMazeRoomPayload`, so the sentence stopped being true and both
     * halves of it — the roster comment and the button's own `title` — are
     * retired rather than left as a true-looking claim about a button that
     * works. ⛓ It belongs to THIS roster and not to the mount's, for the same
     * reason every other op button does: whether a library is held is the
     * PAGE's fact.
     */
    const SET_CONTROLS = Object.freeze([
        'editSetRoom', 'editSetGesture', 'editSetDisconnect', 'editSetReport', 'editSetUndo',
        'editSetRuleCommit', 'editSetMarkLocation', 'editSetAddRoom',
        'editDownloadSet', 'editDownloadBundle',
    ]);

    const enableSetControls = () => {
        const has = Boolean(setSession) && setRoomCount() > 0;
        for (const id of SET_CONTROLS) { if ($(id)) $(id).disabled = !has; }
    };

    /**
     * ⛓ THE PAGE'S BLOB WRITER, handed to the mount so every one of its four
     * downloads lands the same way `#labDownload` does. ⛔ The page NEVER writes
     * a repo path — a blob and a click, like every other download in this arc.
     *
     * ⚠ DECLARED ABOVE ITS READER ON PURPOSE: `remountSetEditor` passes it into
     * the options bag, and a `const` declared below a mount-time call is in its
     * temporal dead zone when the bag is built — `?.` does not help
     * ([[feedback_mount_time_call_hits_tdz]], and `watchViewer`'s `loadZip`
     * carries the same note for the same reason).
     */
    const setDownload = (name, text, type) => {
        const blob = new Blob([text], { type });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ EDITOR v3 E2c — THE ROOM SESSION, INSIDE THE SET ARM'S LIFETIME
     * ══════════════════════════════════════════════════════════════════ */

    /**
     * ⛓ WHAT THE SET EDITOR SEES OF THE OPEN ROOM — `{room, ops, session}`.
     * ⛔ A FUNCTION, because the op count changes with every paint and a
     * captured number would be the count at mount (`watchViewer`'s own note).
     */
    const setRoomSessionNow = () => (setRoomIndex === null || !setRoomSess
        ? null
        : { room: setRoomIndex, ops: setRoomSess.ops().length, session: setRoomSess });

    /** ⛓ DROP the room session without writing it back — §21.5's DISCARD half. */
    const discardSetRoom = () => {
        setRoomTool?.destroy();
        setRoomTool = null;
        setRoomSess = null;
        setRoomIndex = null;
        setRoomEditor = null;
    };

    /**
     * ⛓ EDITOR INTEGRATION W4 — **(the maze library, the entry, the LOCAL index)
     * for a global room**, whichever document is held. ⛔ ONE function, because
     * the base tag names a `library_id` and a room INDEX and both are the
     * PART's under a world.
     */
    const mazeEntryAt = (record, index) => {
        if (!heldWorld) {
            return { library: record.library, entry: record.library.entries[index], local: index };
        }
        const at = partAt(record, index, worldParts, 'openSetRoomAt');
        const library = record.parts[at.part.id];
        return { library, entry: library.entries?.[at.local], local: at.local };
    };

    /**
     * ⛓⛓⛓ EDITOR INTEGRATION W4 — **A ROOM OF THE OTHER SUBSTRATE OPENS IN ITS
     * OWN PAGE, THROUGH W3's ROOM-EDITOR CONTRACT.**
     *
     * ⚖ THE ONE-EDITOR LAW, one document up from the one-renderer law: a
     * Seedling room is edited by `watch.html`'s EDIT arm, and a second Seedling
     * room editor written here would be the thing this whole arc exists to
     * refuse. ⛔ The `page` and the `arm` come off the SUBSTRATE REGISTRY ENTRY
     * (W3 §9.2), never spelled here — `arm` is not the same word on the two
     * pages and this file must not be the second place either is written.
     *
     * ⛔ **THE RETURN IS ONE `replace-room` ADDRESSED GLOBALLY** (§9.6 #2). The
     * envelope hands back the whole SET RECORD the other page is holding; what
     * this world wants is room `local` OF it, re-issued at the GLOBAL index —
     * a `replace-room` for a `record` room and a `replace-room-xml` for a
     * legacy `xml` one, because an edit may never convert a room's KIND (§22.8).
     */
    const openForeignRoomAt = (index, cell) => {
        if (foreignRoom !== null) {
            if (foreignRoom.index === index) return true;
            say(`⛔ room ${foreignRoom.index} is already open in the ${foreignRoom.substrate} `
                + 'editor — CLOSE it there first.', true);
            return false;
        }
        if (setRoomIndex !== null && setRoomSess?.ops().length > 0) {
            say(`⛔ room ${setRoomIndex} is open HERE with ${setRoomSess.ops().length} unwritten `
                + 'edit(s). CLOSE it into the world first (that is ONE `replace-room`).', true);
            return false;
        }
        const decl = ROOM_EDITOR_DECLARATIONS[cell.substrate] ?? null;
        if (!decl || decl.kind !== 'lab') {
            say(`⛔ room ${index} plays on \`${cell.substrate}\`, and this page knows no LAB `
                + `editor for it. The substrates it can open are `
                + `${Object.keys(ROOM_EDITOR_DECLARATIONS).join(', ')}.`, true);
            return false;
        }
        const at = partAt(setSession.record(), index, worldParts, 'openSetRoomAt');
        const doc = setSession.record().parts[at.part.id];
        const box = $('labSetForeignFrame');
        if (!box) {
            say('⛔ this page has no frame to host the other editor in (`#labSetForeignFrame`)',
                true);
            return false;
        }
        box.hidden = false;
        const transport = createPageLabTransport({
            page: decl.page,
            src: frontendUrl(`modules/${LAB_PAGE_DIRS[decl.page]}`),
            mount: box,
            listen: (target, event, handler) => lifetimes.current().on(target, event, handler),
            note: (text, bad) => say(text, bad),
        });
        const door = openLabRoomEditor({
            page: decl.page,
            arm: decl.arm,
            room: at.local,
            record: doc,
            bus: transport.bus,
            transport,
            onSave: (returned) => foldForeignRoom(index, at, returned),
        });
        if (!door.ok) {
            transport.dispose();
            box.hidden = true;
            say(`⛔ ${door.why}`, true);
            return false;
        }
        foreignRoom = {
            index, part: at.part.id, local: at.local, substrate: cell.substrate,
            page: decl.page, arm: decl.arm, transport, door,
        };
        say(`OPENED room ${index} ("${cell.room?.name ?? ''}") in the ${decl.page} editor below `
            + '— edit it there and press its CLOSE; the folded room comes back as ONE '
            + '`replace-room` on this world.');
        setUi?.render();
        render();
        return true;
    };

    /** ⛓ …and the return leg: room `local` OF the returned document, at the GLOBAL index. */
    const foldForeignRoom = (index, at, returned) => {
        const room = returned?.set?.rooms?.[at.local] ?? returned?.rooms?.[at.local] ?? null;
        const source = room?.source ?? null;
        let result;
        if (source?.record) {
            result = setSession.apply({ op: 'replace-room', room: index, record: source.record });
        } else if (typeof source?.xml === 'string') {
            result = setSession.apply({ op: 'replace-room-xml', room: index, xml: source.xml });
        } else {
            result = { ok: false, description: `the ${at.part.id} editor handed back a room `
                + `whose source is neither a \`record\` nor an \`xml\` (${JSON.stringify(source)}) `
                + '— an `embed` room cannot be re-written from another page' };
        }
        closeForeignRoom();
        if (!result.ok) say(`⛔ the room came back and was REFUSED — ${result.description}`, true);
        else if (result.applied === false) {
            say(`room ${index} came back UNCHANGED — the reader closed it with no edit, so no `
                + '`replace-room` was minted (an op that changes nothing is not an edit)');
        } else {
            say(`room ${index} came back from the ${foreignSubstrateWas ?? 'other'} editor as `
                + 'ONE `replace-room`');
        }
        setUi?.render();
        render();
    };

    /** ⛓ Drop the foreign session and its frame — the DISCARD half, §21.5's. */
    const closeForeignRoom = () => {
        if (foreignRoom === null) return;
        foreignSubstrateWas = foreignRoom.substrate;
        foreignRoom.door?.close?.();
        foreignRoom.transport?.dispose?.();
        foreignRoom = null;
        const box = $('labSetForeignFrame');
        if (box) box.hidden = true;
    };

    /**
     * ⛓⛓⛓ **OPEN ONE ENTRY OF THE LIBRARY, AND IT IS THE ONLY BRIDGE.**
     *
     * ⛔ **A ROOM SESSION ALREADY OPEN IS NOT SILENTLY REPLACED**, in the words
     * `watchViewer` refuses it in: `closeRoomSession` is the ONE way a room's
     * edits reach the library (D1 §20.7), so opening another while one holds
     * edits would drop them — the same loss §21.5 rules about for a renumbering.
     *
     * ⛔ **THE WORLD COMES THROUGH `deserializeMazeWorld`, THE CAPTURE PATH'S
     * SPELLING** (§27.1 #3). `deserializeMazeLevel` accepts the same bytes
     * without a word (§28.5 measured it), so nothing refuses the mistake here —
     * what says it is the CLOSE, where the lab spelling mints an edit out of an
     * untouched room and every exit's `side` comes back `null`.
     */
    const openSetRoomAt = (index) => {
        if (!setSession) return false;
        /**
         * ⛓⛓⛓ EDITOR INTEGRATION W4 — **WHICH EDITOR A ROOM OPENS IN IS THE
         * CELL'S OWN SUBSTRATE**, and this is the one place that decides. A
         * maze room opens IN THIS PAGE exactly as it always has; a Seedling
         * room opens in `watch.html` through W3's room-editor contract, with
         * this page as the HOST (§9.6 #1).
         *
         * ⛔ **THE SUBSTRATE, NOT THE PART.** A world could hold two maze parts
         * one day, and a dispatch on the part id would then have to be told
         * about the second one; a dispatch on `readCell().substrate` is told by
         * the document.
         */
        const openCell = (() => {
            try { return setAdapter.readCell(setSession.record(), index, 0); } catch { return null; }
        })();
        if (heldWorld && openCell && openCell.substrate !== LAB_SUBSTRATE) {
            return openForeignRoomAt(index, openCell);
        }
        /**
         * ⛔⛔ §9.6 #3 — **A SEEDLING ROOM OPEN IN THE OTHER PAGE BLOCKS THIS
         * ONE, AND THE STRIP SAYS SO BEFORE IT OPENS.** Each page refuses a
         * second room session while one holds unwritten edits, and a strip that
         * discovered that in the other page's note would be telling the reader
         * about a refusal they cannot see.
         */
        if (foreignRoom !== null && foreignRoom.index !== index) {
            say(`⛔ room ${foreignRoom.index} is open in the ${foreignRoom.substrate} editor `
                + `(${foreignRoom.page}.html, in the frame below). CLOSE it there first — its `
                + 'edits reach this world through that page\'s own close, as ONE '
                + '`replace-room`, and opening a second room would leave them with nowhere '
                + 'to go.', true);
            return false;
        }
        if (setRoomIndex !== null && setRoomIndex !== index
            && setRoomSess.ops().length > 0) {
            say(`⛔ room ${setRoomIndex} is open with ${setRoomSess.ops().length} unwritten `
                + 'edit(s). CLOSE it into the LIBRARY first (that is ONE `replace-room`), or '
                + 'its edits go nowhere — a room session is the only place they live until '
                + 'then.', true);
            return false;
        }
        if (setRoomIndex === index) return true;
        const record = setSession.record();
        const cell = openCell ?? setAdapter.readCell(record, index, 0);
        /**
         * ⛓ EDITOR INTEGRATION W4 — the ENTRY comes out of the cell's own PART
         * under a world, and out of the library when one is held. ⛔ Not
         * `record.library.entries[index]`: a world's record has no `library`
         * half, and its rooms are the parts' CONCATENATED, so the index would be
         * wrong even if there were one.
         */
        const { library, entry, local } = mazeEntryAt(record, index);
        let world;
        try {
            world = deserializeMazeWorld(cell.payload);
        } catch (e) {
            say(`⛔ room ${index} ("${entry?.entry_id}") would not open — ${e.message}`, true);
            return false;
        }
        discardSetRoom();
        setRoomIndex = index;
        setRoomSess = createEditSession(mazeEditAdapter, world, {
            base: roomBaseTag(library, local, entry),
        });
        /**
         * ⛓ THE PALETTE IS THE ROOM'S OWN. ⛔ Not `ensureEditor()`: that one is
         * built from the LAB LEVEL's libraries, and a library entry brings its
         * own `itemLib`/`obstacleLib` — offering the ladder's items on somebody
         * else's room would let a press place a body the entry cannot hold.
         */
        setRoomEditor = new MazeRoomEditor({
            itemLib: world.itemLib ?? DEFAULT_ITEMS,
            obstacleLib: world.obstacleLib ?? DEFAULT_OBSTACLES,
        });
        setRoomTool = mountEditorView({
            canvas: $('canvas'),
            session: setRoomSess,
            adapter: mazeEditAdapter,
            // ⛔ THE GEOMETRY STAYS THIS PAGE'S, and it is the SAME `cellAt` the
            //   EDIT arm uses — it reads `canvasWorld()`, which is this room.
            cellAt,
            brushOp: (tx, ty) => setRoomEditor.opFor(tx, ty),
            floodTarget: () => {
                const t = setRoomEditor.selectedType;
                if (t === PALETTE_TYPES.FLOOR) return { tile: 'floor' };
                if (t === PALETTE_TYPES.WALL) return { tile: 'wall' };
                return null;
            },
            pasteOptions,
            clipWarnings,
            /**
             * ⛓⛓⛓ §21.5 — **WHICH SESSION `Ctrl+Z` HITS IS THE DOM'S OWN FOCUS.**
             * This view keeps the DOCUMENT as its key target; the STRIP's view
             * binds to the strip canvas and stops keydown from bubbling. ⛔ So
             * the undo bound here is the ROOM's, and the identity line reads
             * `document.activeElement` to say which one a press will reach.
             */
            commands: [{
                id: UNDO_COMMAND_ID,
                label: 'UNDO one room edit',
                run: () => {
                    const n = setRoomSess.ops().length;
                    if (!setRoomSess.undo()) {
                        say('this room session has nothing to undo', true);
                        return;
                    }
                    say(`UNDO — ${n - 1} room edit(s) remain`);
                    render();
                },
            }],
            lifetime: setArmLt,
            say,
            offRoom: () => 'that point is outside the room — the cell you name is the cell '
                + 'that gets edited, so a click past the edge REFUSES rather than clamping '
                + 'to the last one',
            onChange: () => { setUi?.render(); render(); },
        });
        say(`OPENED room ${index} ("${entry?.entry_id}") — paint on the canvas, then press `
            + 'CLOSE to fold every edit into ONE `replace-room`');
        /**
         * ⛔ **THE PAGE RENDERS HERE, AND THE MOUNT'S OWN `render()` IS NOT THE
         * SAME ONE.** `editSetRowOpen` calls `openRoomAt` and then the MOUNT's
         * render — which repaints the strip and the identity line and knows
         * nothing about `#canvas`, the room palette or `window.__mazeLab`. A
         * page that waited for its next render would show an opened room on an
         * empty canvas.
         */
        render();
        return true;
    };

    /**
     * ⛓⛓⛓ EDITOR INTEGRATION W4 — **THE MAZE ROW'S `gridFor`, BOUND TO THE
     * WORLD'S MAZE PART.**
     *
     * ⛔ `compileRegionAtlas`'s maze row projects a region through the LIBRARY
     * ENTRY its `map_ref` indexes, and in a merged atlas the region ids are
     * NAMESPACED — so the resolver has to split the part off before it can
     * index anything, and a region belonging to the OTHER part answers `null`
     * (its sidecar is the flash builder's, not this row's). It is the same
     * recipe `seedlingDemo/worldChain.test.js` binds for node.
     */
    const worldCompileOptions = () => {
        const mz = (worldParts ?? []).find((p) => p.kind === 'region-library');
        if (!mz) return {};
        return {
            mazeProjection: {
                ...MAZE_CONDITION_DEPS,
                gridFor: (region) => {
                    if (partOfRegion(region.region_id) !== mz.id) return null;
                    const entry = setSession?.record().parts?.[mz.id]?.entries?.[region.map_ref];
                    return entry ? mazeGridFor(entry.payload) : null;
                },
            },
        };
    };

    /**
     * ⛓⛓⛓ **THE LIFTED MOUNT, OVER THE MAZE'S BINDINGS.** ⛔ Destroy-then-create,
     * and the reason is the one `setEditorView.js`'s own docblock records: a new
     * document REMOUNTS this panel, and a dead mount's listeners survive the
     * remount (they ride the ARM's lifetime, which has not been retired) — the
     * dead one then applies its ops to the OLD session and repaints the OLD
     * `<select>` over the live one ([[feedback_remounted_panel_keeps_old_listeners]]).
     */
    const remountSetEditor = () => {
        setUi?.destroy();
        setUi = null;
        /** ⛔ A NEW DOCUMENT TAKES THE OPEN ROOM WITH IT: the entry a room
         *  session was opened FROM does not survive a different library, and a
         *  session left standing would close into rooms it never came from.
         *  ⛓ EDITOR INTEGRATION W4 — and the FOREIGN one goes with it for the
         *  same reason, frame and all: its door would otherwise fold a room of
         *  the previous document into this one at whatever index it was told. */
        discardSetRoom();
        closeForeignRoom();
        if (!setSession || !setArmLt?.alive()) return;
        fillSetRoomSelect();
        setUi = mountSetEditor({
            lifetime: setArmLt,
            session: setSession,
            adapter: setAdapter,
            deps: {},
            compileRegionAtlas,
            validateRegionAtlas,
            atlasSchema: atlasSchema ?? undefined,
            /**
             * ⛓ THE BINDINGS ARE `mazeSetLab.js`'s — the SAME object
             * `setEditorView.test.js` drives in node, with the ONE thing it
             * stubs made real: `drawRoomStill` is `drawWorld` on the entry's
             * own world (§27.1 #2 measured that it reads no `window.`).
             *
             * ⛓⛓ EDITOR v3 E6b — **THE BLANK ROOM'S SIZE IS READ AT THE PRESS**,
             * off the page's own two inputs. ⛔ A thunk, not a value: a person
             * may retype the size between presses, and a number captured at
             * mount would mint the size the page had when it loaded.
             * ⛔ No `Number.isInteger` guard and no clamp here — `createWorld`
             * refuses a dimension below 2 by name and its sentence is what
             * `#editSetNote` prints (ONE authority; the `min="2"` on the inputs
             * is a hint to a person, not a check).
             */
            /**
             * ⛓⛓⛓ EDITOR INTEGRATION W4 — **THE WORLD'S BINDINGS, OR THE
             * MAZE'S.** ⛔ ONE branch, on the ONE test (`heldWorld`), and both
             * objects come out of `mazeSetLab.js` — the page chooses which
             * document it is editing and knows nothing else about either.
             */
            ...(heldWorld
                ? worldSetBindings({
                    parts: worldParts,
                    deps: worldDeps,
                    rulesSchema,
                    parseOel: parseOelLevel,
                    drawMazeStill: makeDrawRoomStill(),
                    compileOptions: worldCompileOptions(),
                    gameName: heldWorld.name ?? 'World',
                })
                : mazeSetBindings({
                    rulesSchema,
                    drawRoomStill: makeDrawRoomStill(),
                    blankSize: () => ({
                        width: Number($('editSetNewW').value),
                        height: Number($('editSetNewH').value),
                    }),
                })),
            say,
            /**
             * ⛓⛓ §21.5's THREE RULES ARRIVE THROUGH THE MOUNT: it computes the
             * renumbering DECISION before the op and calls `discardRoom` /
             * `openRoomAt` itself, so a MOVE UP over an edited open room is
             * discarded loudly and a zero-op one is silently reopened on its new
             * index — the same code that does it on `watch.html`.
             */
            roomSession: setRoomSessionNow,
            openRoomAt: openSetRoomAt,
            discardRoom: discardSetRoom,
            download: setDownload,
            loadZip: () => loadJSZipBrowser({ src: frontendUrl('libs/jszip/jszip.min.js') }),
            /**
             * ⛔ THE PAGE'S OWN `render`, NOT THE MOUNT'S: the mount re-renders
             * itself on every applied op, and what this has to refresh is the
             * PAGE — `window.__mazeLab.set`, the canvas and the LOAD note.
             */
            /**
             * ⛔ THE PAGE'S OWN `render`, NOT THE MOUNT'S — and W4 adds the
             * DOOR's four `<select>`s to it, because a `connect` the strip's own
             * gesture landed moves the DERIVED exits (a displaced door's far
             * endpoint becomes unwired). ⛓ Here and not in `render()`: this
             * fires once per applied op, and `render()` fires on every hover.
             */
            onSetChange: () => { enableSetControls(); fillDoorSelects(); render(); },
            doc: document,
        });
        enableSetControls();
        /** ⛓ EDITOR INTEGRATION W4 — the door's four `<select>`s are the PAGE's,
         *  filled after the mount for `fillSetRoomSelect`'s reason one control
         *  over: a `value` set on an empty `<select>` sets nothing. */
        fillDoorSelects();
        /**
         * ⛔ AND THE PAGE'S READOUT IS REDRAWN AFTER THE MOUNT, not only before
         * it: `window.__mazeLab.set.mounted` and `selected` are facts about a
         * mount that did not exist a line ago, and a page whose readout learned
         * about them at the next press would report `mounted: false` to anything
         * that looked in between (C2 met the same shape from the other side).
         */
        render();
    };

    /**
     * ⛓ HOLD A VALIDATED LIBRARY. Takes the loader's OWN result shape, so both
     * doors (`parseRegionLibrary`, `loadServedLibrary`) arrive here unchanged.
     */
    const holdLibrary = (res, how) => {
        if (!res.ok) {
            setNote(`⛔ REFUSED — \`validateRegionLibrary\` says: ${res.errors.join(' · ')}`, true);
            return false;
        }
        /**
         * ⛓ EDITOR INTEGRATION W4 — **A LIBRARY REPLACES A HELD WORLD, and the
         * note says so.** The two are alternatives, never both: a world's parts
         * ARE its documents.
         */
        const droppedWorld = heldWorld;
        heldWorld = null;
        heldWorldDocs = null;
        worldNotes = [];
        heldLibrary = res.library;
        setSource = how;
        try {
            openSetSession();
        } catch (e) {
            /**
             * ⛔ AN OVERLAY HELD FROM AN EARLIER LIBRARY MAY NOT FIT THIS ONE —
             * `setRecord` refuses by name (a link naming a room the new library
             * does not have). ⛓ The LIBRARY is kept and the OVERLAY is dropped,
             * because the rooms are the document a person just chose and the
             * overlay is the one that has gone stale; saying which is dropped is
             * the whole of the fix.
             */
            heldOverlay = null;
            openSetSession();
            remountSetEditor();
            setNote(`LOADED ${heldLibrary.library_id} (${how}) — ⚠ the OVERLAY held before it `
                + `was DROPPED: ${e.message}`, true);
            return true;
        }
        remountSetEditor();
        setNote(`LOADED ${heldLibrary.library_id} (${how}) — `
            + (droppedWorld
                ? '⚠ the WORLD held before it was DROPPED (a world\'s parts ARE its documents, '
                  + 'so a library beside one would be a third document nothing names) · '
                : '')
            + `${heldLibrary.entries.length} room(s)`
            + (heldOverlay
                ? `, overlay ${heldOverlay.overlay_id ?? '(unstamped)'}`
                : ', NO overlay (⚠ every LINK, every location and every authored rule lives '
                  + 'there — and for the maze the links ARE the graph, so the REPORT will '
                  + 'refuse the export until one arrives or you draw them here)')
            + (res.warnings.length ? ` ⚠ ${res.warnings.length} warning(s): ${res.warnings[0]}`
                : ''));
        return true;
    };

    /**
     * ⛓⛓⛓ EDITOR INTEGRATION W4 — **HOLD A WORLD: ITS PARTS FIRST, THEN THE
     * DOCUMENT THAT BINDS THEM.**
     *
     * ⛔ **EACH PART GOES THROUGH ITS OWN VALIDATOR BEFORE THE WORLD IS ASKED
     * ANYTHING** — the level set through Seedling's, the region library through
     * the maze's — because a world that bound a malformed part would report the
     * failure as a WORLD problem, which is a true sentence about the wrong
     * subject. The world then binds them BY `doc_id` (`bindWorldParts`).
     *
     * ⛔ **A WORLD REPLACES THE HELD LIBRARY, LOUDLY.** Its parts ARE the
     * documents; a library left standing beside one would be a third document
     * the manifest does not name, and the strip would have no way to say which
     * of the two it was showing.
     */
    const holdWorld = ({ world, members, how }) => {
        const built = worldPartDescriptors({
            world,
            rulesSchema,
            mapDocument: world.world_id ?? 'world.json',
            tileSize: TILE_SIZE,
            parseOel: parseOelLevel,
            tileTypeForPlacement,
            substrateIdFor,
        });
        if (built.errors.length > 0) {
            setNote(`⛔ NOT LOADED — ${built.errors.join(' · ')}`, true);
            return false;
        }
        /** ⛓ EACH PART'S OWN DOOR, in the world's own declaration order. */
        const validated = [];
        for (const part of built.parts) {
            const member = members.find((m) => m.kind === part.kind);
            if (member === undefined) { validated.push(member); continue; }
            if (part.kind === 'region-library') {
                const res = parseRegionLibrary(JSON.stringify(member.doc));
                if (!res.ok) {
                    setNote(`⛔ NOT LOADED — part "${part.id}" is a REGION LIBRARY and `
                        + `\`validateRegionLibrary\` refuses it: ${res.errors.join(' · ')}`, true);
                    return false;
                }
                validated.push({ kind: part.kind, doc: res.library });
            } else {
                const res = validateLevelSet(member.doc);
                if (!res.ok) {
                    setNote(`⛔ NOT LOADED — part "${part.id}" is a LEVEL SET and `
                        + `\`validateLevelSet\` refuses it: ${res.errors.join(' · ')}`, true);
                    return false;
                }
                validated.push({ kind: part.kind, doc: member.doc });
            }
        }
        const bound = bindWorldParts({
            world,
            parts: built.parts,
            members: [...validated.filter(Boolean), ...members.filter((m) => m.kind === 'world')],
        });
        if (!bound.ok) {
            setNote(`⛔ NOT LOADED — ${bound.errors.join(' · ')}`, true);
            return false;
        }
        const previous = { heldWorld, heldWorldDocs, heldLibrary, heldOverlay };
        heldWorld = world;
        heldWorldDocs = bound.docs;
        heldLibrary = null;
        heldOverlay = null;
        worldNotes = bound.notes;
        setSource = how;
        try {
            openSetSession();
        } catch (e) {
            /** ⛔ EVERY HELD DOCUMENT GOES BACK, not just the world: a refusal
             *  must leave the arm exactly as it found it, and the LIBRARY it was
             *  showing is part of that. */
            ({ heldWorld, heldWorldDocs, heldLibrary, heldOverlay } = previous);
            openSetSession();
            remountSetEditor();
            setNote(`⛔ NOT LOADED — this world does not open: ${e.message}`, true);
            return false;
        }
        remountSetEditor();
        const rooms = setRoomCount();
        setNote(`LOADED the world ${world.world_id ?? '(unstamped)'} (${how}) — `
            + `${built.parts.length} part(s) `
            + `${built.parts.map((p) => `"${p.id}" (${p.kind})`).join(' + ')}, `
            + `${rooms} room(s), ${(world.links ?? []).length} crossing(s)`
            + (previous.heldLibrary
                ? ' ⚠ the LIBRARY held before it was DROPPED: a world\'s parts ARE its documents'
                : '')
            + (bound.notes.length ? ` ⚠ ${bound.notes.join(' | ')}` : ''));
        return true;
    };

    /** ⛓ HOLD AN OVERLAY over the library already held. */
    const holdOverlay = (overlay, how) => {
        /**
         * ⛔ EDITOR INTEGRATION W4 — an overlay has NOTHING TO BE AN OVERLAY OF
         * under a world: a world IS the composite overlay and holds one per
         * PART, keyed by part, inside the world document itself.
         */
        if (heldWorld) {
            setNote('⛔ NOT LOADED — a WORLD is held, and a world IS the composite overlay: it '
                + 'carries ONE overlay per PART, keyed by part, inside the world document. A '
                + 'loose overlay names no part and there is nothing here for it to be an '
                + 'overlay OF. Load its BUNDLE, or load the region library on its own first.',
            true);
            return false;
        }
        if (!heldLibrary) {
            setNote('⛔ NOT LOADED — this is an OVERLAY and no LIBRARY is held. An overlay is '
                + 'keyed by ROOM INDEX into a library, so there is nothing for it to be an '
                + 'overlay OF until one is loaded. Load the library first.', true);
            return false;
        }
        const previous = heldOverlay;
        heldOverlay = overlay;
        try {
            openSetSession();
        } catch (e) {
            heldOverlay = previous;
            openSetSession();
            remountSetEditor();
            setNote(`⛔ NOT LOADED — this overlay does not fit \`${heldLibrary.library_id}\`: `
                + `${e.message}`, true);
            return false;
        }
        remountSetEditor();
        setNote(`LOADED an OVERLAY (${how}) — ${overlay.overlay_id ?? '(unstamped)'}, `
            + `${(overlay.links ?? []).length} link(s) over `
            + `${heldLibrary.entries.length} room(s)`);
        return true;
    };

    /**
     * ⛓⛓⛓ **THE ONE JSON DOOR.** `sniffSetDocument` says which document this is
     * — through `documentBundle.classifyDocument`, the SAME classifier the
     * bundle and Seedling's load box use — and a kind this arm does not load is
     * NAMED rather than called "not a library" (a true sentence about the wrong
     * subject).
     */
    const takeSetJson = (parsed, how) => {
        const sniff = sniffSetDocument(parsed);
        if (sniff.kind === 'library') return holdLibrary(parseRegionLibrary(JSON.stringify(parsed)), how);
        if (sniff.kind === 'overlay') return holdOverlay(parsed, how);
        setNote(`⛔ NOT LOADED — ${sniff.why}`, true);
        return false;
    };

    /**
     * ⛓⛓ **A `.zip` BUNDLE CARRIES BOTH.** ⛔ The library is taken FIRST and the
     * overlay second, in that order and not the archive's: an overlay is keyed
     * by room INDEX into a library, so applying one before its rooms are held
     * would refuse for a reason that is about the ORDER rather than about the
     * documents. ⚠ `region-library` became a bundle member kind in this slice's
     * first commit; before it, `readBundle` reported the library in `notes` as
     * unclassifiable and this branch would have found nothing to take.
     */
    const takeSetBundle = async (bytes, how) => {
        const { members, notes } = await readBundle(bytes, {
            jszip: await loadJSZipBrowser({ src: frontendUrl('libs/jszip/jszip.min.js') }),
        });
        const byKind = new Map(members.map((m) => [m.kind, m.doc]));
        /**
         * ⛓⛓⛓ EDITOR INTEGRATION W4 — **A BUNDLE CARRYING A `world` MEMBER IS
         * A WORLD, AND THE WORLD DECIDES.** ⛔ It is checked FIRST and not
         * merged with the library path: a world NAMES its parts, so which
         * documents this bundle's members are is the world's answer and not the
         * archive's — and a bundle carrying a world AND a stray overlay would
         * otherwise load the overlay over a library the world never declared.
         */
        if (byKind.has('world')) return holdWorld({ world: byKind.get('world'), members, how });
        const skipped = members.map((m) => m.kind)
            .filter((k) => k !== 'region-library' && k !== 'overlay');
        if (!byKind.has('region-library') && !byKind.has('overlay')) {
            setNote('⛔ NOTHING TO LOAD in this bundle — it carries '
                + `${members.map((m) => m.kind).join(', ') || 'no recognised member'} and this `
                + 'arm reads a REGION LIBRARY and its OVERLAY. '
                + (notes.length ? notes.join(' | ') : ''), true);
            return false;
        }
        let ok = true;
        if (byKind.has('region-library')) {
            ok = holdLibrary(parseRegionLibrary(JSON.stringify(byKind.get('region-library'))), how);
        }
        if (ok && byKind.has('overlay')) ok = holdOverlay(byKind.get('overlay'), how);
        if (ok && skipped.length) {
            setNote(`${setLoadNote} · ⚠ the ${skipped.join(' and ')} member(s) were NOT loaded: `
                + 'this arm DERIVES both from the library and the overlay', setLoadBad);
        }
        return ok;
    };

    /** ⛓ The paste box and the file input, through the ONE door above. */
    const loadSetFromBox = async () => {
        await ensureSetSchemas();
        let parsed;
        try {
            parsed = JSON.parse($('labSetText').value);
        } catch (e) {
            setNote(`⛔ NOT LOADED — this is not JSON (${e.message}). A \`.zip\` BUNDLE has to `
                + 'arrive through Upload: a zip is bytes and this box is text.', true);
            render();
            return;
        }
        takeSetJson(parsed, 'paste');
        render();
    };

    /**
     * ⛓⛓ **THE SERVED PACKS, FILTERED TO WHAT THIS ARM CAN OPEN.**
     * `mazeLibraryRows` drops the bounce and runner packs by their OWN declared
     * `substrates` — offering them would be a picker whose rows refuse on the
     * press, because `deserializeMazeWorld` has nothing to do with a bounce
     * zone's payload.
     */
    const fillLibraryPick = () => {
        const sel = $('labLibraryPick');
        if (!sel) return;
        sel.innerHTML = '';
        for (const row of servedRows ?? []) {
            sel.appendChild(new Option(row.label, row.file));
        }
        sel.disabled = (servedRows ?? []).length === 0;
    };

    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ EDITOR INTEGRATION W4 — THE CROSS-PART DOOR
     * ══════════════════════════════════════════════════════════════════ */

    /**
     * ⛓⛓ **THE DERIVED EXITS, CACHED ON THE RECORD OBJECT.**
     *
     * ⛔ A `WeakMap` KEYED ON THE RECORD, which is `linksIndexOf`'s trick and is
     * safe for its reason: every op rebuilds the record (copy-on-write, so a
     * refusal leaves the caller's untouched), so an edited world is a DIFFERENT
     * object and misses the cache. There is no invalidation to get wrong.
     * ⛔ AND IT IS WHY THIS IS NOT DONE IN `render()`: deriving a merged atlas
     * is two derivations plus a merge, and `render` runs on every HOVER.
     */
    const doorRowsCache = new WeakMap();
    /**
     * ⛓⛓⛓ **THE PREVIEW THE NOTE IS SHOWING, HELD — NOT RE-DERIVED FOR THE
     * READOUT.** ⛔ Two reasons, and the second is the one that matters: a
     * preview is a full merged-atlas derivation and `render()` runs on every
     * HOVER, so deriving it there would put two derivations on the mouse path;
     * and a readout that ran its OWN would be a second authority whose answer
     * could differ from the sentence on screen. This is written where the note
     * is written, and read where the readout is read.
     */
    let doorPreview = null;
    const doorRows = () => {
        if (!heldWorld || !setSession) return null;
        const record = setSession.record();
        if (!doorRowsCache.has(record)) {
            doorRowsCache.set(record, worldDoorRows(record, worldParts, worldDeps));
        }
        return doorRowsCache.get(record);
    };

    /** ⛓ The endpoint a pair of `<select>`s names, in the WORLD's own words. */
    const doorEndpoint = (roomId, exitId) => {
        const rows = doorRows();
        if (!rows?.ok) return null;
        const room = rows.rows[Number($(roomId)?.value)];
        const exit = $(exitId)?.value ?? '';
        if (!room || exit === '') return null;
        return { part: room.part, room: room.local, exit, global: room.index };
    };

    const doorOneWay = () => {
        const v = $('labDoorOneWay')?.value ?? '';
        return v === '' ? null : v === '1';
    };

    /**
     * ⛓⛓ **THE PREVIEW IS THE DERIVATION'S OWN ANSWER**, not a second model of
     * the displacement rule — W2 shipped that rule's first spelling with a
     * defect precisely because *"only connections whose two endpoints are in the
     * SAME part"* is easy to miss. The sentence a reader gets before the press
     * is the sentence they get after it.
     */
    const renderDoorNote = () => {
        const note = $('labDoorNote');
        if (!note) return;
        const rows = doorRows();
        if (!rows) { note.textContent = ''; return; }
        if (!rows.ok) { note.textContent = `⛔ ${rows.why}`; note.className = 'note bad'; return; }
        const from = doorEndpoint('labDoorFromRoom', 'labDoorFromExit');
        const to = doorEndpoint('labDoorToRoom', 'labDoorToExit');
        const built = worldDoorOp(from, to, doorOneWay());
        doorPreview = { from, to, one_way: doorOneWay(), ...built, displaced: null };
        if (!built.ok) {
            note.textContent = built.why;
            note.className = 'note bad';
            return;
        }
        const preview = worldDoorPreview(setSession.record(), worldParts, worldDeps, built.op);
        doorPreview = { ...doorPreview, displaced: preview.displaced ?? null, previewWhy: preview.why ?? null };
        if (!preview.ok) {
            note.textContent = `⛔ this crossing would be REFUSED — ${preview.why}`;
            note.className = 'note bad';
            return;
        }
        note.textContent = `a CROSSING (object endpoints, `
            + `${built.op.one_way ? 'ONE-WAY' : 'TWO-WAY'}): `
            + `${from.part}/${from.room}/${from.exit} → ${to.part}/${to.room}/${to.exit}`
            + (preview.displaced.length
                ? ` · ⚠ it would DISPLACE ${preview.displaced.length} part-internal `
                  + `connection(s): ${preview.displaced.map((d) => `${d.region}/${d.exit} `
                      + `(was → ${d.was.join('/')})`).join(', ')} — a generated Seedling set has `
                  + 'NO spare exit, so a crossing takes over a door that already leads somewhere '
                  + 'and the far endpoint becomes UNWIRED'
                : ' · it displaces nothing');
        note.className = 'note';
    };

    const fillDoorSelects = () => {
        const rows = doorRows();
        const box = $('labWorldDoorBox');
        if (box) box.hidden = !heldWorld;
        if (!rows?.ok) return;
        for (const [roomId, exitId] of [
            ['labDoorFromRoom', 'labDoorFromExit'], ['labDoorToRoom', 'labDoorToExit'],
        ]) {
            const roomSel = $(roomId);
            const exitSel = $(exitId);
            if (!roomSel || !exitSel) continue;
            const keepRoom = roomSel.value;
            roomSel.innerHTML = '';
            for (const row of rows.rows) {
                roomSel.appendChild(new Option(
                    `${row.index} [${row.part}] ${row.name || ''}`.trim(), String(row.index),
                ));
            }
            if (keepRoom !== '' && Number(keepRoom) < rows.rows.length) roomSel.value = keepRoom;
            const row = rows.rows[Number(roomSel.value)] ?? rows.rows[0];
            const keepExit = exitSel.value;
            exitSel.innerHTML = '';
            for (const exit of row?.exits ?? []) exitSel.appendChild(new Option(exit, exit));
            /** ⛓ A room the derivation DROPPED says so, rather than offering an
             *  empty list that reads as "this room has no doors". */
            exitSel.disabled = (row?.exits ?? []).length === 0;
            if (keepExit !== '' && (row?.exits ?? []).includes(keepExit)) exitSel.value = keepExit;
        }
        renderDoorNote();
    };

    const applyDoorOp = (built) => {
        if (!built.ok) { say(built.why, true); renderDoorNote(); return; }
        const result = setSession.apply(built.op);
        if (!result.ok) {
            say(`⛔ REFUSED — ${result.description}`, true);
        } else {
            /**
             * ⛓ AND THE DISPLACEMENT IS NAMED AFTER, off the derivation that
             * actually ran — the same reader, the same sentence, one press later.
             */
            const after = worldDoorRows(setSession.record(), worldParts, worldDeps);
            say(`${result.description}${after.ok ? '' : ` ⚠ ${after.why}`}`);
        }
        setUi?.render();
        fillDoorSelects();
        render();
    };

    /**
     * ⛓ THE SET ARM'S OWN PANE — the LOAD box's note and the served picker.
     * ⛔ It does NOT drive the set editor's own render: that mount owns its
     * strip, its forms and its report and re-renders itself on every applied op
     * (`onChange`), and a page that repainted it from here would redraw the
     * whole strip on every hover.
     */
    const renderSetPanel = () => {
        const note = $('labSetLoadNote');
        if (note) {
            note.textContent = setLoadNote || '— nothing loaded yet';
            note.className = setLoadBad ? 'note bad' : 'note';
        }
        fillLibraryPick();
        enableSetControls();
        renderSetRoomBox();
        /** ⛓ EDITOR INTEGRATION W4 — the door box exists only under a WORLD, and
         *  its selects are refilled here because a `connect` moves the derived
         *  exits (a displaced door's far endpoint becomes unwired). */
        const doorBox = $('labWorldDoorBox');
        if (doorBox) doorBox.hidden = !heldWorld;
    };

    /**
     * ⛓⛓ **THE OPEN ROOM'S PALETTE AND TOOLS** — the EDIT arm's two boxes, in
     * the SET panel and bound to the ROOM's editor. ⛔ Hidden with no room open,
     * because a palette with nothing to paint on is a control that refuses on
     * every press.
     */
    const renderSetRoomBox = () => {
        const box = $('labSetRoomBox');
        if (!box) return;
        box.hidden = setRoomSess === null && foreignRoom === null;
        /**
         * ⛓⛓⛓ EDITOR INTEGRATION W4 — **§21.5's LAW GAINS ONE ROW: THREE
         * SESSIONS CAN EXIST, AND THE THIRD'S KEYS ARE IN ANOTHER PAGE.**
         *
         * The strip's `Ctrl+Z` binds to the strip canvas, a maze room's to this
         * document, and a Seedling room's lives inside `watch.html` — where
         * this page's keydown never reaches and where that page's own identity
         * line already says which of ITS two sessions a press hits. ⛔ Said
         * here rather than left to the reader to work out from the fact that a
         * frame has focus: §21.5's whole rule is that the page NAMES which
         * session an undo will reach, and a page that went quiet the moment a
         * third one existed would be keeping the rule only while it was easy.
         */
        if (setRoomSess === null && foreignRoom !== null) {
            $('labSetPalette').textContent = '';
            $('labSetTools').textContent = '';
            $('labSetRoomNote').textContent = `room ${foreignRoom.index} (part `
                + `"${foreignRoom.part}", room ${foreignRoom.local} of it) is open in the `
                + `${foreignRoom.page} editor in the frame below — its palette, its tools and `
                + 'its `Ctrl+Z` are ITS page\'s, and its CLOSE is what folds the room back here '
                + 'as ONE `replace-room`. ⛔ A second room cannot be opened until it is closed.';
            return;
        }
        if (setRoomSess === null) return;
        const pal = $('labSetPalette');
        pal.textContent = '';
        for (const e of PALETTE_ENTRIES) {
            const b = el('button', 'paletteBtn', `${e.glyph} ${e.label}`);
            b.dataset.type = e.type;
            if (setRoomEditor?.selectedType === e.type) b.classList.add('armed');
            lifetimes.current().on(b, 'click', () => {
                setRoomEditor.selectType(e.type);
                say(`palette: ${e.label} — click a tile of room ${setRoomIndex}`);
                render();
            });
            pal.appendChild(b);
        }
        const tools = $('labSetTools');
        tools.textContent = '';
        for (const row of setRoomTool?.commands ?? []) {
            const b = el('button', 'toolBtn', `${row.label}${row.key ? ` (${row.key})` : ''}`);
            b.dataset.tool = row.id;
            if (setRoomTool && row.id === setRoomTool.tool) b.classList.add('armed');
            lifetimes.current().on(b, 'click', () => { row.run(); render(); });
            tools.appendChild(b);
        }
        $('labSetRoomNote').textContent = `room ${setRoomIndex} — `
            + `${setRoomSess.ops().length} unwritten edit(s); CLOSE folds them into ONE `
            + '`replace-room`, and MOVE UP with edits open DISCARDS them (loudly)';
    };

    /* ══════════════════════════════════════════════════════════════════
     * RENDER
     * ══════════════════════════════════════════════════════════════════ */

    const render = () => {
        const src = params.source;
        $('generatePanel').hidden = src !== SOURCES.GENERATE;
        $('editPanel').hidden = src !== SOURCES.EDIT;
        $('solvePanel').hidden = src !== SOURCES.SOLVE;
        // ⛓ EDITOR v3 E2c — the fourth panel, hidden on exactly the same terms.
        $('setPanel').hidden = src !== SOURCES.SET;
        $('source').value = src;
        fillForm();
        draw();
        renderTrace();
        renderAreaPane();
        renderElementPane();
        if (src === SOURCES.GENERATE) {
            renderRoster();
            renderDirectives();
            /**
             * ⚠ THE BOUNDS ARE READ STRAIGHT OFF THE FIELDS HERE, not through
             * `formArgs()`: that one now also parses the `requires` box, and a
             * REFUSAL while somebody is still typing must not take the whole
             * render down with it. The press is where a malformed directive is
             * reported (and it is, by name).
             */
            const target = {
                obstacleTarget: Number($('labCount').value),
                triesPerStep: Number($('labTries').value),
                saturationK: Number($('labK').value),
                anchorTriesPerCandidate: Number($('labAnchorTries').value),
            };
            $('labNote').textContent = 'RUN-ALL to '
                + `${Number($('labCount').value)} authorises ≤ `
                + `${ladderCost(target, WORST_CASE_SOLVE_MS).solves} solves `
                + '(⚠ a CEILING — the loop keeps its first candidate most of the time).';
        }
        if (src === SOURCES.EDIT) {
            ensureEditor();
            renderEditPanel();
        }
        if (src === SOURCES.SOLVE) renderSolvePanel();
        if (src === SOURCES.SET) renderSetPanel();
        refreshSaveBox();

        $('identity').textContent = describeState(state, lastSolve);
        $('status').textContent = message || '—';
        $('status').className = messageBad ? 'bad' : 'ok';
        $('detail').textContent = payloadCheck
            ? (payloadCheck.why ?? '?gen= — the page REPRODUCED the payload byte-identically')
            : '';

        window.__mazeLab = {
            source: src,
            url: window.location.search,
            seed: state.seed,
            biome: state.biome,
            width: state.width,
            height: state.height,
            step: state.step,
            bounds: state.bounds,
            budget: state.budget,
            roster: state.roster ?? null,
            stop: state.stop,
            saturated: state.saturated,
            /**
             * ⛓⛓ SLICE 4: DID THIS STATE COME OUT OF THE LOOP, OR OUT OF A
             * PAYLOAD? `loadPayload` sets it and nothing else does.
             *
             * ⛔ Added because a MUTANT found the hole: `check-procgen-lab-
             * hosting.mjs` waited for "step 0, uncertified, zero edits" to
             * decide the host's SEND had landed — and the page's OWN BOOT state
             * satisfies all three (no `?run=`, nothing solved yet). With the
             * resend removed the row still went red, but on the byte
             * comparison rather than on the wait, which is trap 246's shape:
             * a wait a PRE-state can satisfy is not a wait for the claim. This
             * field is the one fact that separates the two.
             */
            loaded: Boolean(state.loaded),
            identity: $('identity').textContent,
            /**
             * ⛓⛓⛓ SLICE 12 — THE TRI-STATE, PUBLISHED AS IT STANDS. ⚠ It was
             * `Boolean(state.certification)`, which reported `false` after an
             * EDIT where Seedling reported `null` — both protocol-legal
             * (`labProtocol.assertStateChanged` documents the distinction) and
             * slice 11 §16.2 named this page as the side to move. `null` =
             * nobody has asked; `false` = the ORACLE said no, which on this
             * page happens in exactly one place (`certify` on a REFUSED
             * verdict).
             */
            certified: state.certified ?? null,
            edits: (state.edits ?? []).length,
            editLog: (state.edits ?? []).map((e) => e.description),
            /**
             * ⛓⛓⛓ SLICE A2 — **THE OP LIST AS THE PAGE HOLDS IT**, so a
             * browser row can tell a 3-cell STROKE (one entry, one group of 3)
             * from three presses (three entries). ⛔ A count alone cannot: both
             * builds paint the same three cells, and `edits` would read 3 under
             * the mutant that applies a drag's cells one at a time.
             */
            editOps: (state.edits ?? []).map((e) => (e.op?.op === 'group'
                ? { op: 'group', label: e.op.label, members: e.op.ops.length }
                : e.op)),
            editNote: describeOps((state.edits ?? []).map((e) => e.op)),
            /** ⛓ WHICH TOOL IS ARMED, and what the clipboard holds — `null`
             *  outside the EDIT arm, where no tool is mounted. */
            editTool: tool?.tool ?? null,
            editClip: tool?.clip ? { w: tool.clip.w, h: tool.clip.h } : null,
            /**
             * ⛓⛓⛓ EDITOR v3 E2c — **THE SET ARM, AS A CHANNEL A ROW CAN READ.**
             *
             * ⛔ `null` until a LIBRARY is held, and that is not the same as
             * "the arm is not mounted": `source` says HOW the document arrived,
             * so a row can tell a `?library=` boot from a paste — which matters
             * because `?library=` is COPIED FORWARD by the URL writer and a
             * paste afterwards leaves the bar naming a document nobody is
             * editing. ⛔ The counts are read off the SESSION's record, never
             * off `heldLibrary`: the session is where the edits are, and a
             * readout of the loaded document would report the library as it
             * arrived while the strip showed the one being edited.
             */
            set: setSession ? {
                source: setSource,
                /**
                 * ⛓⛓⛓ EDITOR INTEGRATION W4 — **THE WORLD, AND THE THREE
                 * FIELDS THAT EXIST ONLY WHEN ONE IS HELD.** ⛔ `null` under a
                 * library rather than absent: a row that could not tell "no
                 * world" from "this field has not landed yet" would read a page
                 * editing a library exactly like one that failed to open a
                 * world. The counts are the SESSION's, like every other field
                 * here — `heldWorld` is the document AS LOADED.
                 */
                world: heldWorld ? {
                    world_id: setSession.record().world.world_id ?? null,
                    name: setSession.record().world.name ?? null,
                    /** ⛓ Per part: what it IS and how many rooms it brought. */
                    parts: worldParts.map((p) => ({
                        id: p.id,
                        kind: p.kind,
                        rooms: p.bounds(p.recordOf(
                            setSession.record().parts[p.id],
                            setSession.record().world.overlays[p.id],
                        )).w,
                        doc_id: p.idOf(setSession.record().parts[p.id]),
                    })),
                    /** ⛓ The CROSSINGS — `world.links`, which is a different
                     *  list from either part's own overlay links. */
                    crossings: (setSession.record().world.links ?? []).map((l) => ({
                        from: l.from, to: l.to, one_way: l.one_way,
                    })),
                    notes: worldNotes,
                } : null,
                /** ⛓ WHICH SUBSTRATE PLAYS EACH ROOM, in strip order, off the
                 *  descriptor — the same read the badge makes. */
                substrates: setSession
                    ? Array.from({ length: setRoomCount() },
                        (_, i) => setAdapter.readCell(setSession.record(), i, 0).substrate ?? null)
                    : null,
                /** ⛓ …and which PART each room belongs to, `null` under a library. */
                parts: setSession
                    ? Array.from({ length: setRoomCount() },
                        (_, i) => setAdapter.readCell(setSession.record(), i, 0).part ?? null)
                    : null,
                library_id: setSession.record().library?.library_id ?? null,
                overlay_id: setSession.record().overlay?.overlay_id ?? null,
                rooms: setRoomCount(),
                links: heldWorld
                    ? (setSession.record().world.links ?? []).length
                        + Object.values(setSession.record().world.overlays ?? {})
                            .reduce((n, o) => n + (o?.links ?? []).length, 0)
                    : (setSession.record().overlay.links ?? []).length,
                locations: heldWorld
                    ? Object.values(setSession.record().world.overlays ?? {})
                        .flatMap((o) => Object.values(o?.rooms ?? {}))
                        .reduce((n, r) => n + (r.locations ?? []).length, 0)
                    : Object.values(setSession.record().overlay.rooms ?? {})
                        .reduce((n, r) => n + (r.locations ?? []).length, 0),
                ops: setSession.ops().length,
                opList: setSession.ops().map((o) => o.op),
                loadNote: $('labSetLoadNote')?.textContent ?? '',
                /** ⛓ WHAT THE PICKER OFFERS — the FILTER is the claim, not a count. */
                servedOffered: (servedRows ?? []).map((r) => r.library_id),
                /** ⛓ Which optional schema actually arrived — a NAMED absence. */
                schemas: { rules: Boolean(rulesSchema), atlas: Boolean(atlasSchema) },
                /**
                 * ⛓⛓ WHAT THE MOUNT ITSELF HOLDS. ⛔ `mounted: false` is a real
                 * state and not a hole: a library can be held while the arm is
                 * not on screen, and a row that could not tell those apart would
                 * read a page that had loaded nothing exactly like one that had.
                 */
                mounted: Boolean(setUi),
                selected: setUi ? setUi.selected : null,
                /**
                 * ⛓⛓⛓ **EDITOR v3 E3a — THE FOUR FIELDS E2c HAD TO DROP ARE
                 * BACK, AND THE SEAM IS WHY THEY CAN BE.**
                 *
                 * §30.7/§30.8: `mountSetEditor` called `onSetChange` BEFORE its
                 * own `render()` on the applied-op path and NOT AT ALL on the
                 * REPORT path, so this snapshot — written by the PAGE's
                 * `render`, which `onSetChange` is what triggers — was written
                 * while the mount's rows, note, identity line and report box
                 * were still the PREVIOUS press's. MEASURED on the two-click
                 * CONNECT: `links` read 1 off the SESSION while a `strip` field
                 * read `linkedFrom: [0,0,0,0]`, one op behind. Four fields were
                 * therefore published NOWHERE rather than published stale.
                 *
                 * ⛔ E3a gave the mount ONE ordering rule — its own `render()`
                 * first, then `onSetChange({why})`, on every path — so what is
                 * derived from the MOUNT is current here too. ⇒ §30.7's rule
                 * (*"a page may publish what it derives from the SESSION, and
                 * nothing it derives from the MOUNT"*) is RETIRED BY NAME: it
                 * was a rule about a broken seam, not about readouts.
                 *
                 * ⛓ `check-maze-lab` keeps ONE DOM read per field beside these,
                 * because THAT is the claim: the readout and the mount's own DOM
                 * must AGREE. A readout that lagged would disagree with the box
                 * on screen, which is exactly what the mutant (the `render()`
                 * put back after the notification) reproduces.
                 */
                strip: setUi ? {
                    rooms: setUi.rows().length,
                    names: setUi.rows().map((r) => r.name),
                    exits: setUi.rows().map((r) => r.exits),
                    linkedFrom: setUi.rows().map((r) => r.linkedFrom),
                    locations: setUi.rows().map((r) => r.locations),
                    rules: setUi.rows().map((r) => r.rules),
                    /**
                     * ⛓⛓ EDITOR v3 E6b — **WHICH CELLS THE PAINTER BADGED.**
                     * ⛔ `setUi.badges()`, not a re-derivation from the record:
                     * trap 722 was exactly the two answers coming apart, and a
                     * readout that computed its own would have agreed with the
                     * record while the strip disagreed with both. On this
                     * substrate every entry carries its world INLINE, so
                     * `mazeSetBindings.sourceKind` is the constant `'record'`
                     * and this reads `[false × rooms]` — a claim the gate makes
                     * rather than a silence (§32.6: the browser ink probes
                     * cannot see the glyph at all).
                     */
                    badges: setUi.badges(),
                    /**
                     * ⛓⛓ EDITOR INTEGRATION W4 — **WHICH SUBSTRATE THE PAINTER
                     * STAMPED ON EACH CELL.** ⛔ `setUi.substrates()`, the
                     * PAINTER's own decision, not a second read of the record —
                     * `badges()`' reason exactly (trap 722): a readout that
                     * derived its own would agree with the record while the
                     * strip disagreed with both. On a LIBRARY it is
                     * `[null × rooms]`, which is the claim its gate makes
                     * rather than a silence.
                     */
                    substrates: setUi.substrates(),
                } : null,
                /**
                 * ⛓ THE NOTE AND THE IDENTITY LINE ARE THE MOUNT'S OWN BOXES —
                 * it writes them and exposes no accessor, so the page reads them
                 * where the mount put them. ⛔ That is NOT a vacuous
                 * cross-check: what the gate compares is a value read AT PAGE
                 * RENDER TIME against the same box read later, and a page that
                 * rendered BEFORE the mount would hold the previous press's
                 * sentence while the box on screen held the current one.
                 */
                note: setUi ? ($('editSetNote')?.textContent ?? '') : null,
                identity: setUi ? ($('editSetIdentity')?.textContent ?? '') : null,
                /**
                 * ⛓⛓ **AND THE REPORT'S VERDICT, OFF `setUi.report()`** — the
                 * mount's own `lastReport`, not a re-run: a readout that ran the
                 * report itself would be a second authority whose atlas derive
                 * cost lands on every page render. `null` until the REPORT
                 * button has been pressed, which is a state a row can assert.
                 */
                report: setUi?.report() ? {
                    rows: setUi.report().rows.map((r) => `[${r.kind}] ${r.text}`),
                    errors: setUi.report().rows.filter((r) => r.severity === 'error').length,
                    rulesAllowed: setUi.report().download.rules.allowed,
                    rulesWhy: setUi.report().download.rules.why ?? null,
                } : null,
                /**
                 * ⛓⛓ THE OPEN ROOM, AS THE PAGE HOLDS IT. ⛔ `openRoomOps` is a
                 * COUNT and `openRoomOpList` is the list, for the reason the
                 * lab's own `editOps` exists: a 3-cell STROKE is ONE entry of
                 * three members and a count alone cannot tell it from three
                 * presses.
                 */
                openRoom: setRoomIndex,
                /**
                 * ⛓⛓ EDITOR INTEGRATION W4 — **AND WHICH PART THAT ROOM IS IN.**
                 * The strip's index is GLOBAL and a part's own is not; a row
                 * that had only the global index could not tell which document
                 * an edit is about to land in, which is the one thing the two
                 * openers differ over.
                 */
                openRoomPart: setRoomIndex === null || !heldWorld ? null
                    : setAdapter.readCell(setSession.record(), setRoomIndex, 0).part,
                openRoomSubstrate: setRoomIndex === null ? null
                    : setAdapter.readCell(setSession.record(), setRoomIndex, 0).substrate ?? null,
                openRoomOps: setRoomSess ? setRoomSess.ops().length : 0,
                openRoomOpList: setRoomSess
                    ? setRoomSess.ops().map((o) => (o.op === 'group'
                        ? { op: 'group', label: o.label, members: o.ops.length } : o))
                    : null,
                /** ⛓ THE IDENTITY TAG the room's edits are edits OF — read off
                 *  the session's own `payload()`, which is the ONE place the
                 *  core carries a base (it never interprets one). */
                openRoomBase: setRoomSess ? setRoomSess.payload().base : null,
                openRoomTool: setRoomTool?.tool ?? null,
                /**
                 * ⛓⛓⛓ EDITOR INTEGRATION W4 — **THE THIRD SESSION.** A world
                 * strip can have a maze room open HERE and a Seedling room open
                 * in `watch.html` — never both (§9.6 #3), which is what makes
                 * this a single object and not a list. ⛔ `null` is a real state
                 * and not a hole: a row that could not tell "no foreign room"
                 * from "the frame is up but nothing is in it" would read a
                 * refused open exactly like a successful one.
                 */
                /**
                 * ⛓⛓⛓ EDITOR INTEGRATION W4 — **THE CROSS-PART DOOR CONTROL, AS
                 * A CHANNEL A ROW CAN READ.** ⛔ `null` under a library: the box
                 * does not exist there, and a field that read `{}` would make a
                 * page with no world look like one whose control had emptied.
                 * ⛓ `shape` is the CLAIM — `world` for a crossing (object
                 * endpoints) and `part` for a door the gesture refused as
                 * belonging to one part's own `connect` (array endpoints). A
                 * mutant that always wrote object endpoints reads `world` here
                 * on a same-part pair, which is exactly what the strip's own
                 * gesture is for.
                 */
                worldDoor: heldWorld ? (() => {
                    const rows = doorRows();
                    if (!rows?.ok) return { ok: false, why: rows?.why ?? null, exits: null };
                    return {
                        ok: doorPreview?.ok ?? false,
                        why: doorPreview?.why ?? null,
                        shape: doorPreview?.shape ?? null,
                        from: doorPreview?.from ?? null,
                        to: doorPreview?.to ?? null,
                        one_way: doorPreview?.one_way ?? null,
                        /** ⛓ WHAT EACH ROOM MAY BE CROSSED FROM — the DERIVED
                         *  atlas's exit ids, which is what a world link names
                         *  and is NOT the part's own exit vocabulary. Off the
                         *  record-keyed cache, so a hover costs nothing. */
                        exits: rows.rows.map((r) => ({
                            index: r.index, part: r.part, region_id: r.region_id, exits: r.exits,
                        })),
                        /** ⛓ …and the DISPLACEMENT the press would cause, as the
                         *  PREVIEW computed it — the same answer the note on
                         *  screen is showing, never a second derivation. */
                        displaced: doorPreview?.displaced ?? null,
                        note: $('labDoorNote')?.textContent ?? '',
                    };
                })() : null,
                foreignRoom: foreignRoom ? {
                    index: foreignRoom.index,
                    part: foreignRoom.part,
                    local: foreignRoom.local,
                    substrate: foreignRoom.substrate,
                    page: foreignRoom.page,
                    arm: foreignRoom.arm,
                    iframeId: foreignRoom.transport.iframeId,
                    /** ⛓ Whether the other page has ANSWERED yet — the flush
                     *  point, and the one fact that separates "the frame is
                     *  loading" from "the document is in it". */
                    connected: foreignRoom.transport.ready(),
                } : null,
            } : null,
            directives: (state.directives ?? []).map((d) => ({
                instance: d.instance, outcome: d.outcome, keptKind: d.keptKind, at: d.at,
            })),
            rows: generationRows(state.trace ?? []),
            catalogue: labCatalogue(state.biome),
            /** ⛓ SLICE 5 — the SKELETONS section, beside the template catalogue. */
            skeletons: skeletonCatalogue({ simulator: true }),
            skeleton: state.skeleton ?? null,
            /**
             * ⛓⛓⛓ SLICE 3 — THE GRAPH THE PAGE IS SHOWING, and ⛔ **NO LEVEL
             * AND NO PAYLOAD WHEN THE DIRECTIVE WAS REFUSED**: a run that did
             * not produce what was asked for has no artifact to hand out, and a
             * readout that offered one anyway would be the page disagreeing
             * with its own refusal box.
             */
            areas: state.areas ?? null,
            require: state.require ?? null,
            requireResult: state.requireResult ?? null,
            areaGraph: state.model?.areas?.ran
                ? {
                    ran: true,
                    areaCount: state.model.areas.partitionSummary.areaCount,
                    syntheticCount: state.model.areas.partitionSummary.syntheticCount,
                    symbols: state.model.areas.graph.symbols,
                    doors: state.model.areas.doors.length,
                    keys: state.model.areas.keys.length,
                    graphifyEdges: state.model.areas.graph.edges
                        .filter((e) => e.kind === 'graphify').length,
                    solutionPath: state.model.areas.graph.solutionPath,
                }
                : { ran: false, refused: state.model?.areas?.refused ?? null },
            /**
             * ⛓⛓⛓ ARC 5, SLICE 6b — **THE SHORTCUT, AS A CHANNEL A ROW CAN
             * READ.** Slice 5 computed the arc's fifth grade and REACHED it on
             * four generated maze levels, and slice 5's own residue named the
             * gap this closes: the shortcut had no demo-catalogue row because
             * it had no readout to claim on. ⛔ `lengths` is the pair the
             * shortcut law measured (the route with the extra edge OPEN, and
             * with it WALLED), which is the mechanism itself rather than a flag
             * saying it happened — a `shortcut: true` would be an echo of the
             * parameter (trap 269).
             *
             * ⛔ `null` when `shortcut=0` (the default), never `{}`: *nobody
             * asked* and *it was asked and refused* are different facts, and the
             * refusal rides `areaGraph.refused` as every other one does.
             */
            shortcut: state.model?.areas?.shortcut ?? null,
            areaLegend: areaLegend(state.model?.areas ?? null),
            areaLayer,
            areaNote: $('labAreaNote').textContent,
            /**
             * ⛓⛓⛓ ARC 2 SLICE 4 — THE GADGET THE PAGE IS SHOWING. ⛔ `elements`
             * is the SPEC the run was asked for and `elementInfo` is what the
             * BINDING did with it — two fields because they are two facts, and
             * a page that published only the first would let a build that read
             * `?elements=` into the bar and never passed it to the model look
             * exactly like one that did (trap 269, and mutant (a) of this
             * slice is precisely that build).
             */
            elements: state.elements ?? null,
            elementInfo: state.model?.elements
                ? {
                    ran: state.model.elements.ran,
                    spec: state.model.elements.spec,
                    placed: state.model.elements.placed.map((p) => ({
                        instance: p.instance,
                        index: p.index,
                        params: p.params,
                        site: p.site,
                        block: p.block,
                        button: p.button,
                        door: p.door,
                        flagCell: p.flagCell,
                        ports: p.ports,
                        tunnel: p.tunnel,
                        guards: p.guards ?? null,
                        cost: p.cost,
                    })),
                    refused: state.model.elements.refused,
                }
                : null,
            elementLegend: elementLegend(state.model?.elements ?? null),
            elementNote: $('labElementNote').textContent,
            /**
             * ⛓⛓⛓ **THE REPLAY, AND `blocks` IS THE OVERLAY'S OWN ARGUMENT.**
             * `overlayBlocks()` is called once here and once in `draw()` — the
             * SAME function — so this readout is not a claim about the picture,
             * it IS what the picture was drawn from. That is what lets a
             * browser row assert "the block MOVED between two frames" as a
             * VALUE and have it mean something about the canvas.
             */
            play: play
                ? {
                    index: play.index,
                    frames: play.frames.length,
                    playing: play.playing,
                    player: play.frames[play.index].player,
                    blocks: overlayBlocks(),
                    /** ⛓ How many DISTINCT block layouts the whole plan visits.
                     *  1 means the walk pushes nothing. */
                    layouts: new Set(play.frames.map((f) => JSON.stringify(f.blocks))).size,
                }
                : null,
            level: requireRefusal() ? null : serializeMazeLevel(state.record),
            trace: state.trace ?? [],
            payload: requireRefusal() ? null : labPayload(state),
            payloadCheck,
            solve: lastSolve && {
                verdict: lastSolve.verdict,
                ticks: lastSolve.ticks,
                classifiedBy: lastSolve.classifiedBy,
                reasonText: lastSolve.reasonText,
            },
            message,
            busy: false,
        };
        lifetimes.announce();
        // ⛓ SLICE 4: the host hears what the readout says, at the same moment
        // and from the same object — a second derivation for the host would be
        // a second answer to "what is this page showing".
        bridge?.announce();
    };

    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ EDITOR v3 E2c — MOUNTING THE SET ARM
     * ══════════════════════════════════════════════════════════════════ */

    /**
     * ⛓⛓ **THE TWO OPTIONAL SCHEMAS AND THE SERVED INDEX ARE FETCHED WHEN THIS
     * ARM MOUNTS, AND ONLY THEN.** ⛔ Not at boot: a person who opened
     * `?seed=3&count=4` never asked for a schema or a library index, and slice
     * 3's §10.10(6) promised in writing that this page's module graph and its
     * network are what a GENERATE load needs. ⚠ Every continuation goes through
     * `lt.report`, because an arm can be retired while a fetch is in flight and
     * a late `render()` would repaint a panel the page has moved off.
     */
    const primeSetArm = async (lt) => {
        await ensureSetSchemas();
        if (servedRows === null) {
            try {
                servedRows = mazeLibraryRows(await loadServedIndex(fetch, FRONTEND));
            } catch (e) {
                servedRows = [];
                setNote(`⚠ the served library index would not load (${e.message}) — the picker `
                    + 'is empty and PASTE, UPLOAD and `?library=` are unaffected', true);
            }
        }
        lt.report('the SET arm was retired while its index was in flight', () => { render(); });
    };

    /**
     * ⛓⛓ **ONE FILE INPUT, TWO SHAPES.** A `.zip` is sniffed by its own magic
     * (`PK`), exactly as `presetUI` and `watchViewer` sniff theirs — never by
     * the file's NAME, which a person may have changed and which says nothing
     * about the bytes.
     */
    const uploadSetFile = async (file, lt) => {
        await ensureSetSchemas();
        const bytes = new Uint8Array(await file.arrayBuffer());
        const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
        try {
            if (isZip) await takeSetBundle(bytes, 'upload (.zip)');
            else {
                $('labSetText').value = new TextDecoder().decode(bytes);
                takeSetJson(JSON.parse($('labSetText').value), 'upload');
            }
        } catch (e) {
            setNote(`⛔ REFUSED — ${e.message}`, true);
        }
        lt.report('an upload finished after the SET arm was retired', () => { render(); });
    };

    const mountSetArm = (lt) => {
        setArmLt = lt;
        lt.onRetire(() => {
            setUi?.destroy();
            setUi = null;
            discardSetRoom();
            setArmLt = null;
        });
        // ⛓ A library held at BOOT (`?library=`) predates this arm — mount over it now.
        remountSetEditor();
        lt.on($('labSetLoad'), 'click', loadSetFromBox);
        /**
         * ⛓⛓ EDITOR INTEGRATION W4 — the CROSS-PART door's five controls. ⛔ The
         * two room `<select>`s refill their exit list on change, because a
         * world's exits are the DERIVED atlas's and belong to the region, not to
         * the strip's selection.
         */
        for (const id of ['labDoorFromRoom', 'labDoorToRoom']) {
            lt.on($(id), 'change', () => { fillDoorSelects(); });
        }
        for (const id of ['labDoorFromExit', 'labDoorToExit', 'labDoorOneWay']) {
            lt.on($(id), 'change', () => { renderDoorNote(); render(); });
        }
        lt.on($('labDoorConnect'), 'click', () => applyDoorOp(worldDoorOp(
            doorEndpoint('labDoorFromRoom', 'labDoorFromExit'),
            doorEndpoint('labDoorToRoom', 'labDoorToExit'),
            doorOneWay(),
        )));
        lt.on($('labDoorDisconnect'), 'click', () => applyDoorOp(worldDoorDisconnectOp(
            doorEndpoint('labDoorFromRoom', 'labDoorFromExit'),
        )));
        lt.on($('labSetUpload'), 'change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            uploadSetFile(file, lt);
            // ⛔ Cleared, or picking the SAME file twice fires no `change` event
            //   and the second press would look like a page that stopped working.
            e.target.value = '';
        });
        lt.on($('labLibraryLoad'), 'click', () => {
            const file = $('labLibraryPick').value;
            if (!file) {
                setNote('⛔ no served pack is offered — the index names none whose `substrates` '
                    + 'include `maze`', true);
                render();
                return;
            }
            ensureSetSchemas()
                .then(() => loadServedLibrary(fetch, file, { basePath: FRONTEND }))
                .then((res) => lt.report('a served pack arrived after the arm was retired', () => {
                    holdLibrary(res, `served \`${file}\``);
                    render();
                }));
        });
        primeSetArm(lt);
    };

    /* ══════════════════════════════════════════════════════════════════
     * MOUNT ONE ARM
     * ══════════════════════════════════════════════════════════════════ */

    /**
     * ⛔ RETIRE-THEN-CREATE, and the ordering is the whole point: the other
     * order leaves a window in which two arms are both alive and both believe
     * they own the canvas. `createLifetimeHolder.start` enforces it.
     */
    const mount = (source, why) => {
        params = { ...params, source };
        const lt = lifetimes.start(source, why);

        lt.on($('source'), 'change', () => {
            mount($('source').value, `the SOURCE selector chose ${$('source').value}`);
            writeUrl();
        });
        for (const [id] of FIELDS) {
            lt.on($(id), 'change', () => { writeUrl(); });
        }
        lt.on($('labBiome'), 'change', () => { writeUrl(); });
        /**
         * ⛓⛓ SLICE 5 — A KIND CHANGE **RESETS THE LADDER TO THE SKELETON**,
         * and says so. The room is the level's identity every bit as much as
         * the seed: step 3 of a `winding` room followed by step 4 of an `open`
         * one is a display that has never shown a level any single run
         * produces. ⛓ It is the same reset a changed seed causes on the
         * Seedling page, applied to the other half of the identity — and it is
         * spelled as a press (`goTo(0)`) rather than as a flag, so the URL, the
         * form and the level all move together through the one path.
         */
        lt.on($('labSkeleton'), 'change', () => {
            /**
             * ⛓ SLICE 7 — THE PARAMS FORM IS RE-MOUNTED AT DEFAULTS **BEFORE**
             * the press, because `goTo(0)` reads it: a kind change that left
             * `rooms`' `minRoom` select standing would hand `winding` a
             * parameter it does not declare, and the press would refuse.
             */
            mountSkeletonParams($('labSkeleton').value);
            goTo(0);
            say(`skeleton kind: ${$('labSkeleton').value} — RESET to the skeleton, because the `
                + 'room a ladder is built in is part of the level\'s identity');
            render();
        });
        /**
         * ⛓⛓ SLICE 7 — AND A PARAMETER CHANGE RESETS ON EXACTLY THE SAME
         * TERMS. `rooms;minRoom=2` and `rooms;minRoom=4` are two different
         * rooms, so a ladder cannot span them. ⛔ Delegated from the CONTAINER
         * rather than bound per select, because the selects are re-created on
         * every kind change and a per-element listener would be re-bound (or
         * leaked) each time.
         */
        lt.on($('labSkeletonParams'), 'change', (e) => {
            if (!e.target?.dataset?.skelParam) return;
            goTo(0);
            say(`skeleton parameter ${e.target.dataset.skelParam}=${e.target.value} — RESET to `
                + 'the skeleton: a kind parameter builds a DIFFERENT room, exactly as the '
                + 'kind does');
            render();
        });
        /**
         * ⛓⛓⛓ AN AREA-SPEC OR DIRECTIVE CHANGE **RESETS THE LADDER**, on
         * exactly the terms a kind change does: the area graph is built with
         * the MODEL, before pass 2 runs, so `keys=1` at step 3 followed by
         * `keys=2` at step 4 would be a display no single run produces. ⛔ And
         * the directive is a property of the RUN, not of a rung.
         */
        lt.on($('labAreas'), 'change', () => {
            // ⛓ the params form is re-mounted BEFORE the press, because the
            // press reads it (the skeleton form's own lesson).
            mountAreaParams();
            goTo(0);
            say(`areas: ${$('labAreas').value} key(s) — RESET to the skeleton, because the `
                + 'area graph is built with the model, before the loop runs');
            render();
        });
        lt.on($('labAreaParams'), 'change', (e) => {
            if (!e.target?.dataset?.areaParam) return;
            goTo(0);
            say(`area parameter ${e.target.dataset.areaParam}=${e.target.value} — RESET to the `
                + 'skeleton: a graph knob builds a DIFFERENT level');
            render();
        });
        /**
         * ⛓⛓⛓ AN ELEMENT CHANGE **RESETS THE LADDER**, on exactly the terms an
         * area or a kind change does — and the reason is stronger here: the
         * gadget is stamped into the room BEFORE the carve and its draws move
         * the whole room stream, so `elements=none` at step 3 followed by
         * `elements=guard` at step 4 would be a display no single run produces.
         */
        lt.on($('labElements'), 'change', () => {
            // ⛓ the params form is re-mounted BEFORE the press, because the
            // press reads it (the skeleton form's own lesson): a `binds` select
            // left standing from `guard` would be handed to a head that does
            // not declare it, and the press would refuse.
            mountElementParams($('labElements').value);
            goTo(0);
            say(`elements: ${$('labElements').value} — RESET to the skeleton, because an `
                + 'element is stamped into the room BEFORE the carve and its draws move the '
                + 'whole room stream');
            render();
        });
        lt.on($('labElementParams'), 'change', (e) => {
            if (!e.target?.dataset?.elemParam) return;
            goTo(0);
            say(`element parameter ${e.target.dataset.elemParam}=`
                + `${e.target.value === '' ? '(drawn)' : e.target.value} — RESET to the `
                + 'skeleton: a named parameter is an OVERRIDE that spends no draw, so naming '
                + 'one builds a DIFFERENT level from leaving it drawn');
            render();
        });
        lt.on($('labRequire'), 'change', () => {
            goTo(0);
            const asked = $('labRequire').value.trim();
            say(asked === ''
                ? 'no directive — the run is not required to place any symbol'
                : `requires ${asked} — RESET to the skeleton; the directive is MET or the run `
                    + 'is REFUSED (⛔ no bound is widened to meet it, and there is no retry)');
            render();
        });
        /**
         * ⛓ THE LAYER STEPPER — a VIEW control. ⛔ It re-DRAWS and does not
         * regenerate, is not written to the URL, and does not touch the ladder:
         * *"step through the layers"* is a reader building up one picture.
         */
        lt.on($('labAreaLayer'), 'change', () => {
            areaLayer = $('labAreaLayer').value;
            render();
        });
        lt.on($('labAreaLayerNext'), 'click', () => {
            areaLayer = AREA_LAYERS[(AREA_LAYERS.indexOf(areaLayer) + 1) % AREA_LAYERS.length];
            say(`layer: ${areaLayer}`);
            render();
        });
        lt.on($('labStep'), 'click', () => goTo(state.step + 1));
        lt.on($('labRunAll'), 'click', runAll);
        lt.on($('labReset'), 'click', () => goTo(0));
        lt.on($('labRosterAll'), 'click', () => {
            adopt(Object.freeze({ ...state, roster: null }));
            say('the WHOLE roster — no restriction');
            writeUrl();
            render();
        });
        lt.on($('labDirectivesClear'), 'click', () => {
            adopt(Object.freeze({ ...state, directives: Object.freeze([]) }));
            say('directives cleared — press STEP or RUN-ALL to rebuild the level without them');
            writeUrl();
            render();
        });
        lt.on($('labSolve'), 'click', () => {
            try {
                /**
                 * ⛓⛓ SLICE A2 — **ONE SOLVE, AND THE VERDICT GOES INTO THE
                 * SESSION.** It was two (`solveState` then `certify`, which
                 * solves again); `certifyInto` asks the oracle once and writes
                 * the tri-state through `session.setCertified` — ⛔ the ONE
                 * place `false` is reachable on this page.
                 */
                state = certifyInto(state, session);
                lastSolve = state.lastSolve;
                /**
                 * ⛓⛓⛓ AND THE PLAN BECOMES FRAMES — ⚖ design ruling 6 fn. 3.
                 * ⛔ `planFrames` replays through the ENGINE's own `step`, so
                 * the block positions in them are the ones the SOLVER produced
                 * and not a page-side movement model.
                 */
                clearPlay();
                const frames = planFrames(state, lastSolve);
                play = frames ? { frames, index: 0, playing: false } : null;
                say(`SOLVE: ${lastSolve.verdict}`
                    + (frames ? ` — ${frames.length - 1} frame(s) to replay` : ''),
                lastSolve.verdict !== 'SOLVED');
            } catch (e) {
                say(e.message, true);
            }
            render();
        });
        /**
         * ⛓⛓ THE REPLAY CONTROLS — a STEP-THROUGH first and an autoplay second,
         * in that order on purpose: ⚖ design ruling 6 fn. 3 asks for a
         * step-through, and it is also the only form a browser row can drive
         * without a wall clock. PLAY is an interval over the same index, and it
         * is registered on the LIFETIME's retire hook so an arm switch cannot
         * leave a second one running over the first (trap 259's shape for
         * timers rather than listeners).
         */
        const seek = (to) => {
            if (!play) return;
            const n = play.frames.length;
            play = { ...play, index: Math.max(0, Math.min(n - 1, to)) };
            render();
        };
        lt.onRetire(() => stopPlaying());
        lt.on($('labPlayPrev'), 'click', () => { stopPlaying(); seek(play.index - 1); });
        lt.on($('labPlayNext'), 'click', () => { stopPlaying(); seek(play.index + 1); });
        lt.on($('labPlayReset'), 'click', () => { stopPlaying(); seek(0); });
        lt.on($('labPlay'), 'click', () => {
            if (!play) return;
            if (play.playing) {
                stopPlaying();
                say('replay paused');
                render();
                return;
            }
            if (play.index >= play.frames.length - 1) play = { ...play, index: 0 };
            play = { ...play, playing: true };
            /**
             * ⛔ THE TICK THAT LANDS ON THE LAST FRAME STOPS THERE — it does
             * not advance and then discover on the NEXT tick that it is done.
             * The difference is observable: a reader (and a browser row) that
             * sees `index` at the last frame would otherwise still find
             * `playing: true` for one interval, which is a readout describing
             * an animation that has nothing left to do.
             */
            playTimer = setInterval(lt.guard('the SOLVE replay', () => {
                if (!play) return;
                const next = play.index + 1;
                play = { ...play, index: Math.min(next, play.frames.length - 1) };
                if (next >= play.frames.length - 1) {
                    stopPlaying();
                    say('replay finished — the block is where the plan left it');
                }
                render();
            }), PLAY_FRAME_MS);
            say('replaying the plan — the BLOCK moves with `state.blocks`');
            render();
        });
        lt.on($('labUndo'), 'click', undoCommand.run);
        lt.on($('labDownload'), 'click', download);
        lt.on($('labLoad'), 'click', loadFromBox);
        lt.on($('labUpload'), 'change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const r = new FileReader();
            r.onload = () => lt.report('an upload finished after the arm was retired', () => {
                $('labText').value = String(r.result);
                loadFromBox();
            });
            r.readAsText(file);
        });

        const canvas = $('canvas');
        // ⛓ E2c: the `editing` outline moved to `draw()` — see its docblock. It
        //   is a fact about whether a click paints, and in the SET arm that is
        //   not known until a room is open.
        lt.on(canvas, 'mousemove', (e) => {
            const c = cellAt(e);
            if (c?.tx === hover?.tx && c?.ty === hover?.ty) return;
            hover = c;
            draw();
        });
        lt.on(canvas, 'mouseleave', () => { hover = null; draw(); });
        lt.on(canvas, 'click', (e) => {
            /**
             * ⛓⛓ SLICE 4 — `procgenLab:selectTile` FIRES IN EVERY ARM, and
             * BEFORE the EDIT guard. It is not an edit; it is *"the reader
             * pointed at this cell"*, which is the only thing a host can do
             * anything with (⚖ §3.5's third page→host event). Publishing it
             * only in EDIT would make the event mean "an edit happened" under
             * a name that says otherwise, and the host would have no way to
             * learn that a click in SOLVE was a click at all.
             */
            const clicked = cellAt(e);
            if (clicked) bridge?.selectTile(clicked.tx, clicked.ty);
            /**
             * ⛓⛓⛓ SLICE A2 — **THE EDIT BRANCH IS GONE FROM HERE.**
             * `procgenCore/editorView` owns the tool: one `armed` value, the
             * stroke-as-one-group, rect/paste/flood, Escape and the key map.
             * ⛔ This listener survives because `selectTile` is NOT an edit —
             * it fires in every arm and says *"the reader pointed at this
             * cell"*, which is the only thing a host can act on (⚖ §3.5's
             * third page→host event). Two listeners on one canvas, and they
             * answer two different questions.
             */
        });

        /**
         * ⛓⛓⛓ **THE TOOL IS MOUNTED ONLY IN THE EDIT ARM, ON THIS ARM'S OWN
         * LIFETIME.** ⛔ Retire-then-create means leaving EDIT detaches every
         * listener `editorView` registered — the overlay is taken down by
         * `destroy` on the same retirement, because the element is this file's
         * DOM and not the lifetime's.
         */
        tool = null;
        if (source === SOURCES.EDIT) {
            ensureEditor();
            tool = mountEditorView({
                canvas,
                session,
                adapter: mazeEditAdapter,
                // ⛔ THE GEOMETRY STAYS THIS PAGE'S — `check-maze-lab` claim 5
                //   computes the target cell independently and asserts the tile
                //   it named is the tile that changed.
                cellAt,
                brushOp,
                floodTarget,
                pasteOptions,
                clipWarnings,
                commands: [undoCommand],
                lifetime: lt,
                say,
                offRoom: () => 'that point is outside the room — the cell you name is the cell '
                    + 'that gets edited, so a click past the edge REFUSES rather than clamping '
                    + 'to the last one',
                onChange: ({ result }) => {
                    sync();
                    if (result?.applied) { lastSolve = null; clearPlay(); }
                    render();
                },
            });
            lt.onRetire(() => { tool?.destroy(); tool = null; });
        }

        render();

        /**
         * ⛓⛓⛓ EDITOR v3 E2c — **THE SET ARM, ON THIS ARM'S OWN LIFETIME.** ⛔ Its
         * LOAD controls, its served index and the shared set-editor mount all
         * ride `lt`, so leaving the arm detaches every one of them — the same
         * retire-then-create the EDIT arm's tool follows.
         *
         * ⛔⛔ **AFTER `render()`, AND THAT IS A DEFECT THIS SLICE'S OWN PROBE
         * FOUND.** `mountSetEditor` paints the strip during mount, and
         * `overviewLayout` sizes it from `overview.parentNode.clientWidth` — which
         * is **0 while `#setPanel` is still `hidden`**, because a hidden element
         * has no layout. MEASURED on the first browser run: the strip came up
         * **72×132** (4 rooms × `OVERVIEW.minCellPx` = 18, the SCROLL floor)
         * instead of the ~300 px cells the stage has room for, with ink in it —
         * so every readout said the strip had drawn and the picture was a
         * quarter of an inch wide. ⇒ the page unhides the panel FIRST and the
         * mount measures a laid-out parent. ⚠ A row asserting only INK could not
         * have seen this; the strip's WIDTH is asserted too.
         */
        if (source === SOURCES.SET) {
            mountSetArm(lt);
            /**
             * ⛓⛓⛓ EDITOR INTEGRATION W3 — **`?room=` OPENS ONE ENTRY, AFTER
             * THE ARM IS MOUNTED.** ⛔ Here and not in `boot()`: `boot` is what
             * FETCHES a `?library=`, and the room session mounts its tool on
             * `#canvas` inside a `#setPanel` the arm has just unhidden — the
             * same laid-out-parent rule the strip pays above. A room opened
             * before the mount would measure a hidden canvas.
             *
             * ⛔ AND `openSetRoomAt` IS THE ONE BRIDGE — the same function the
             * strip's own press calls, so a host-driven room and a hand-clicked
             * one are the same session with the same base tag. It refuses in
             * `say()` when nothing is held, and a `false` here is that refusal
             * already printed.
             */
            if (params.room !== null && params.room !== undefined) {
                if (!setSession) {
                    say(`⛔ ?room=${params.room} — this arm is holding NO region library, so `
                        + 'there is no room to open. Load one first (the LOAD box, Upload, a '
                        + 'served pack, or `?library=`), or send one over `procgenLab:load`.',
                    true);
                    render();
                } else if (params.room >= setRoomCount()) {
                    /**
                     * ⛔ THE BOUND IS CHECKED HERE AND NOT INSIDE `openSetRoomAt`:
                     * that function's callers are the strip's own presses, which
                     * can only name a row that exists. A URL can name anything,
                     * and `setAdapter.readCell` would throw on an index the
                     * library does not have — a page-killing answer to a typo.
                     */
                    say(`⛔ ?room=${params.room} — the held `
                        + (heldWorld
                            ? `world "${setSession.record().world.world_id ?? '(unstamped)'}"`
                            : `library "${setSession.record().library.library_id ?? '(unstamped)'}"`)
                        + ` has ${setRoomCount()} room(s), numbered from `
                        + '0. No room was opened.', true);
                    render();
                } else if (!openSetRoomAt(params.room)) {
                    // ⛓ `openSetRoomAt` printed its own reason (a room already
                    //   open with unwritten edits, or one that would not open).
                    render();
                }
            }
        }
    };

    /* ══════════════════════════════════════════════════════════════════
     * BOOT
     * ══════════════════════════════════════════════════════════════════ */

    for (const name of MAZE_BIOME_NAMES) {
        $('labBiome').appendChild(new Option(name, name));
    }
    /**
     * ⛓⛓ THE SKELETON SELECTOR — the kinds this page OFFERS, plus the ones it
     * does not, greyed WITH THEIR REASON as the catalogue's exclusion rows are.
     * ⚠ The maze offers every kind, so nothing is greyed HERE today; the
     * disabled branch is written and driven anyway, because it is the branch
     * the Seedling page's copy of this list needs and a list that silently
     * dropped what it cannot offer could not answer *"why not that one?"*.
     */
    for (const row of skeletonCatalogue({ simulator: true })) {
        const opt = new Option(`${row.kind}${row.isDefault ? ' (the open room)' : ''}`, row.kind);
        opt.disabled = !row.offered;
        opt.title = row.offered ? row.description : `unavailable here — needs ${row.why}`;
        $('labSkeleton').appendChild(opt);
    }
    /**
     * ⛓ THE AREA CONTROLS' OPTIONS ARE THE CODEC'S OWN DOMAINS — `KEYS_DOMAIN`
     * and `AREA_LAYERS`. ⛔ A hand-typed list here would be a second
     * vocabulary, and the reader would meet whichever one drifted.
     */
    for (const k of KEYS_DOMAIN) {
        $('labAreas').appendChild(new Option(`${k}${k === 0 ? ' (off)' : ''}`, String(k)));
    }
    for (const l of AREA_LAYERS) $('labAreaLayer').appendChild(new Option(l, l));
    mountAreaParams();
    /**
     * ⛓ THE ELEMENT SELECTOR'S OPTIONS ARE THE CODEC'S OWN `ELEMENT_NAMES` —
     * `none` first, because it IS the default and the whole point of ⚖ ruling 5
     * is that it is a head somebody can type rather than a missing value.
     */
    for (const name of ELEMENT_NAMES) {
        $('labElements').appendChild(new Option(
            `${name}${name === DEFAULT_ELEMENTS.name ? ' (off — no element is constructed)' : ''}`,
            name,
        ));
    }
    mountElementParams(DEFAULT_ELEMENTS.name);
    /**
     * ⛓⛓ EDITOR v3 E6b — **THE BLANK ROOM'S DEFAULT SIZE, FROM THE CONSTANT
     * `#labWidth`/`#labHeight` FALL BACK TO.** `readLabParams` reads
     * `MAZE_DEFAULTS.width/height` when `?width=`/`?height=` are absent, and the
     * GENERATE form is then filled from `state`; the SET arm's two inputs are
     * not `state`'s, so they are seeded here — from the SAME frozen object.
     * ⛔ Not typed into `lab.html`: a literal in the markup would be a second
     * answer to *"how big is a maze room"*, and the first slice to move the
     * constant would leave this arm minting a size the rest of the page does
     * not use.
     */
    $('editSetNewW').value = String(MAZE_DEFAULTS.width);
    $('editSetNewH').value = String(MAZE_DEFAULTS.height);
    stamp();

    try {
        params = readLabParams(window.location.search);
    } catch (e) {
        $('status').textContent = e.message;
        $('status').className = 'bad';
        window.__mazeLab = { fatal: e.message };
        return;
    }

    /**
     * ⛓⛓⛓ EDITOR v3 E2c — **`?library=` IS `?gen=`'s SIBLING, AND THE TWO
     * FAILURE MODES ARE TOLD APART.**
     *
     * ⛔ A TRANSPORT failure is FATAL, exactly as `?gen=`'s is: the address
     * NAMED a document, the page could not get it, and opening an arm with no
     * library would be a page pretending the link said something else.
     * ⛓ A CONTENT failure is NOT: the fetch worked and the document is what is
     * wrong, so `validateRegionLibrary`'s own sentences go in the arm's LOAD
     * box where every other refusal about a document goes, and the rest of the
     * page still works. Two different facts, two different channels.
     *
     * ⚠ It is not `?gen=`: a library is not reproducible from a seed, so there
     * is nothing to REPRODUCE-and-compare and the page takes it as it stands.
     */
    const bootLibrary = async (url) => {
        let res;
        try {
            res = await fetch(url);
        } catch (e) {
            throw new Error(`?library=${url} — the fetch FAILED (${e.message}). ⛔ REFUSED `
                + 'rather than opened on nothing: the address names a REGION LIBRARY, and an '
                + 'arm with no library under a link that names one would be a page saying '
                + 'something the address does not.');
        }
        if (!res.ok) {
            throw new Error(`?library=${url} — HTTP ${res.status}. ⛔ REFUSED rather than `
                + 'opened on nothing: the address names a REGION LIBRARY, and an arm with no '
                + 'library under a link that names one would be a page saying something the '
                + 'address does not.');
        }
        holdLibrary(parseRegionLibrary(await res.text()), `?library=${url}`);
    };

    /**
     * ⛓⛓⛓ EDITOR INTEGRATION W4 — **`?world=` FETCHES A BUNDLE.** ⛔ Bytes and
     * not text: a world names its parts and travels with them, so the address
     * is a `.zip`. The law is `?library=`'s, said in the same words — a
     * TRANSPORT failure is FATAL BY NAME (the address promised a world and the
     * page has none), and a CONTENT failure goes in the arm's own LOAD box
     * through `takeSetBundle`, which leaves the rest of the page working.
     */
    const bootWorld = async (url) => {
        let res;
        try {
            res = await fetch(url);
        } catch (e) {
            throw new Error(`?world=${url} — the fetch FAILED (${e.message}). ⛔ REFUSED `
                + 'rather than opened on nothing: the address names a WORLD BUNDLE, and an arm '
                + 'with no world under a link that names one would be a page saying something '
                + 'the address does not.');
        }
        if (!res.ok) {
            throw new Error(`?world=${url} — HTTP ${res.status}. ⛔ REFUSED rather than opened `
                + 'on nothing: the address names a WORLD BUNDLE, and an arm with no world '
                + 'under a link that names one would be a page saying something the address '
                + 'does not.');
        }
        await takeSetBundle(new Uint8Array(await res.arrayBuffer()), `?world=${url}`);
    };

    const boot = async () => {
        /**
         * ⛓ FIRST, because it is independent of the ladder: `?library=` fills
         * the SET arm and `?seed=`/`?gen=` fill the other three, and a URL is
         * allowed to carry both.
         *
         * ⛓⛓ EDITOR INTEGRATION W4 — **AND `?world=` WINS OVER `?library=`.** A
         * world's parts ARE its documents, so the two cannot both be held; the
         * WORLD is the larger document and the arm SAYS which one it took
         * rather than loading one over the other in whichever order the reader
         * happened to type them.
         */
        if (params.world) {
            await ensureSetSchemas();
            await bootWorld(params.world);
            if (params.library) {
                setNote(`${setLoadNote} · ⚠ \`?library=${params.library}\` was IGNORED — a WORLD `
                    + 'is held and its parts ARE its documents, so a library beside one would '
                    + 'be a third document the world\'s manifest does not name', setLoadBad);
            }
        } else if (params.library) {
            await ensureSetSchemas();
            await bootLibrary(params.library);
        }
        if (params.gen) {
            /**
             * ⛓⛓⛓ `?gen=` REPRODUCES A PAYLOAD AND CHECKS IT, which is a
             * stronger contract than loading one: the page GENERATES from the
             * payload's own seed/bounds/room and compares. ⛔ One path into the
             * page — every level it draws came out of the loop, in the page —
             * and the export becomes a determinism check across node and the
             * browser rather than a picture of a file.
             */
            const res = await fetch(params.gen);
            if (!res.ok) throw new Error(`?gen=${params.gen} — HTTP ${res.status}`);
            const payload = await res.json();
            adopt(generateWithDirectives({
                seed: payload.seed,
                biome: payload.biome ?? DEFAULT_MAZE_BIOME,
                step: payload.bounds?.obstacleTarget ?? 0,
                bounds: payload.bounds,
                budget: payload.budget,
                width: payload.width,
                height: payload.height,
                roster: payload.roster ?? null,
                /**
                 * ⛓⛓⛓ SLICE 12 — **THE PAYLOAD IS THE DIRECTIVE CHANNEL.** It
                 * was `null` here while `?directed=` carried the list; ⚖ §3.9
                 * retired the parameter, so a payload's own `directives` are
                 * replayed, IN ORDER AND AT THE SAME INDICES (the array's order
                 * IS the index, so `directiveSeed`'s index-as-salt is
                 * untouched), through the SAME `applyDirective` the ATTEMPT
                 * button presses. ⚠ A RECORDED directive's `params` are the
                 * RESOLVED values, so the replay spends no draw and the
                 * comparison below can be byte-exact.
                 */
                directed: payload.directives ?? null,
                /**
                 * ⛓ SLICE 5: a payload names the ROOM it was built in, and
                 * reproducing it under a different skeleton would report a
                 * level divergence whose real cause is the question. ⚠ `??` and
                 * not a constant: a payload written before the block existed
                 * names no kind, and that IS the open room.
                 */
                skeleton: payload.skeleton ?? undefined,
                /** ⛓ SLICE 3 — a payload names the GRAPH it was built with. */
                areas: payload.areas ?? undefined,
                /**
                 * ⛓⛓ ARC 2 SLICE 4 — and the GADGET. ⛔ Through
                 * `elementSpecOf` (inside `generateStep`'s normalizer via
                 * `safeElementSpec`? no — here, explicitly), because the two
                 * writers put different shapes under this key: this page's
                 * payload carries the SPEC and `generate-maze-level.mjs --json`
                 * carries `elementSummaryOf`'s block. One reader knows both.
                 */
                elements: elementSpecOf(payload.elements) ?? undefined,
                require: payload.require ?? null,
            }));
            /**
             * ⛓⛓⛓ ARC 2 SLICE 4 — **AND THEN THE EDITS**, in order, through the
             * SAME `applyEditOp` a press uses (constructive §18.2's residue,
             * closed). The order is LADDER → DIRECTIVES → EDITS, which is
             * Seedling's own rule (§16.3) with the maze's third leg finally on
             * it. ⚠ A payload whose edits predate the op shape throws BY NAME
             * from `applyEdits` and the boot's catch prints it — LOAD is the
             * way in for one, and the message says so.
             */
            if ((payload.edits ?? []).length) adopt(applyEdits(state, payload.edits));
            payloadCheck = agreementWithPayload(payload, state);
            say(payloadCheck.agrees
                ? 'the browser REPRODUCED the payload byte-identically — level AND trace'
                : `the payload and this page's generation DIFFER: ${payloadCheck.why}`,
            !payloadCheck.agrees);
            return;
        }
        adopt(generateWithDirectives({
            seed: params.seed,
            biome: params.biome,
            step: stepFromParams(params),
            bounds: params.bounds,
            budget: params.budget,
            width: params.width,
            height: params.height,
            roster: params.roster,
            /**
             * ⛔ SLICE 12 — NO `directed` HERE EITHER: a URL boot is a LADDER,
             * always. A directive reaches this page from the ATTEMPT button or
             * from a payload, and `?directed=` refuses in `readLabParams`.
             */
            /**
             * ⛓⛓ SLICE 5 — AND A DEFECT MY OWN ROW FOUND HERE. `?skeleton=`
             * reached `readLabParams`, the writer echoed it back into the bar
             * and the readout printed it, so three of the five browser claims
             * were green — while THIS call was still missing the argument and
             * the page generated the open room. The one claim that could see it
             * was the byte comparison against node's carved level.
             */
            skeleton: params.skeleton,
            /**
             * ⛓⛓ SLICE 3 — AND THE AREA SPEC AND THE DIRECTIVE REACH THE
             * GENERATOR HERE. ⛔ This is the exact line slice 5's defect was on
             * (`?skeleton=` reached the reader, the bar and the identity line
             * while THIS call was missing the argument, and three of five
             * claims were green on a page generating the open room), so the
             * browser row's `?areas=` claim is a BYTE COMPARISON against node's
             * own level rather than an echo of the parameter.
             */
            areas: params.areas,
            /**
             * ⛓⛓⛓ ARC 2 SLICE 4 — **AND THE ELEMENT SPEC REACHES THE
             * GENERATOR HERE.** ⛔ This is the exact line slice 5's defect and
             * arc-1's mutant (b) both sat on: the parameter reaches
             * `readLabParams`, the writer echoes it into the bar and the
             * identity line prints it, so the ECHO claims go green while THIS
             * call is missing the argument and the page builds a level with no
             * gadget in it. ⇒ the browser row's `?elements=` claim is a BYTE
             * COMPARISON against node's own level, plus a COUNT of the blocks
             * and buttons ON that level, never an echo of the parameter.
             */
            elements: params.elements,
            require: params.require,
        }));
        say(`seed ${params.seed} at step ${stepFromParams(params)}`
            + (params.skeleton?.kind && params.skeleton.kind !== 'empty'
                ? `, skeleton ${params.skeleton.kind}` : ''));
    };

    /* ══════════════════════════════════════════════════════════════════
     * SLICE 4 — WHAT A HOST MAY DO TO THIS PAGE
     * ══════════════════════════════════════════════════════════════════
     *
     * ⛔ TWO VERBS, AND EACH GOES THROUGH THE PAGE'S EXISTING ONE-OF. There is
     * no host-only path into this page: `load` is the LOAD box's own function
     * (so the box shows what was loaded, which is what a reader looking at the
     * panel would expect to find), and `navigate` is `readLabParams` + `boot`
     * + `mount` — the SWITCH arc's law, in place, with no reload.
     */

    /**
     * HOST → PAGE `procgenLab:load`. ⛔ A LOAD BOX'S own function, verbatim —
     * and since EDITOR INTEGRATION W3 the page decides WHICH box by SNIFFING,
     * through the classifier it already had.
     *
     * ⛓⛓⛓ **THE SNIFF IS `sniffSetDocument`, NOT A SECOND TEST.** It is
     * `documentBundle.classifyDocument` — the same answer the SET arm's paste
     * box, the `.zip` bundle reader and Seedling's load box get — so a REGION
     * LIBRARY or an OVERLAY handed over by a host lands in the SET arm's intake
     * and anything else keeps going exactly where it went before. ⛔ A
     * host-only routing test here would be the two-spellings failure at the one
     * boundary this arc keeps paying for.
     *
     * ⚠ BYTE-INERT FOR EVERY EXISTING CLAIM: `check-procgen-lab-hosting.mjs`
     * sends LAB LEVEL payloads, which classify as they always did and go to
     * `#labText` / `loadFromBox()` unchanged.
     *
     * ⛔ AND IT DOES **NOT** RE-NAVIGATE. The SET arm may not be the arm on
     * screen; holding the document is what `procgenLab:navigate ?source=set&room=n`
     * arrives for, one message later. A load that switched arms by itself would
     * make the host's next navigate a second, contradictory decision about what
     * the reader is looking at.
     */
    const loadFromHost = (payload) => {
        const sniff = sniffSetDocument(payload);
        if (sniff.kind === 'library' || sniff.kind === 'overlay') {
            $('labSetText').value = JSON.stringify(payload, null, 2);
            ensureSetSchemas().then(() => {
                takeSetJson(payload, 'the HOST');
                render();
            });
            return;
        }
        $('labText').value = JSON.stringify(payload, null, 2);
        loadFromBox();
    };

    /**
     * HOST → PAGE `procgenLab:navigate`. ⛔ `history.replaceState` and NOT an
     * assignment to `location.search`: the latter NAVIGATES, and a hosted page
     * that reloaded itself would drop the iframe's adapter connection with it
     * — the standalone page's law (law 2) with a second reason behind it.
     *
     * ⚠ `?iframeId=`/`?hostOrigin=` are PRESERVED, because they are this
     * frame's address and the host did not send them. A navigate that dropped
     * them would leave a page that still runs but can no longer be reached.
     */
    const navigate = async (search) => {
        const asked = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
        const here = new URLSearchParams(window.location.search);
        for (const key of ['iframeId', 'hostOrigin']) {
            if (here.has(key) && !asked.has(key)) asked.set(key, here.get(key));
        }
        window.history.replaceState(null, '', `${window.location.pathname}?${asked}`);
        try {
            params = readLabParams(window.location.search);
            await boot();
        } catch (e) {
            // ⛔ RAW TRUTH, on the page: a refused navigate says so where every
            // other refusal on this page says it, and does NOT fall through to
            // a level nobody asked for.
            say(e.message, true);
            render();
            return;
        }
        mount(params.source, 'the HOST navigated');
    };

    /**
     * ⛓⛓⛓ THE BRIDGE IS FETCHED ONLY UNDER `?iframeId=`.
     *
     * ⛔ Not "loaded and inert" — NOT FETCHED. A static import would put
     * `AdapterClient` (and `shared/communicationProtocol.js` with it) into the
     * standalone page's module graph, where it would install a `message`
     * listener on a page that has no host — and slice 3's §10.10(6) promised
     * the opposite in writing. `check-maze-lab.mjs` asserts the graph.
     */
    const installBridge = async () => {
        const iframeId = new URLSearchParams(window.location.search).get('iframeId');
        if (!iframeId) return;
        const mod = await import('./mazeLabBridge.js');
        bridge = await mod.installMazeLabBridge({
            iframeId,
            readout: () => window.__mazeLab,
            load: loadFromHost,
            navigate,
            /**
             * ⛓⛓⛓ EDITOR INTEGRATION W3 — **THE SET ARM, FOR THE PAYLOAD.**
             * ⛔ Off the SESSION and the open-room index, not off
             * `window.__mazeLab.set`: the readout carries COUNTS of the record
             * (rooms, links, ops), never the record itself, and a host cannot
             * fold a `replace-room` back into a count. The same law the readout
             * itself states — *"the counts are read off the SESSION's record"*.
             */
            /**
             * ⛔⛔ EDITOR INTEGRATION W4 — **A WORLD DOES NOT RIDE THIS
             * ENVELOPE, AND THE REFUSAL IS THE ENVELOPE'S OWN SENTENCE.**
             * `makeSetRecordEnvelope`'s `substrate` says *what a reader may
             * assume about `record`'s SHAPE — a region library on the maze, a
             * level set on Seedling* — and a WORLD record (`{world, parts}`) is
             * neither. Publishing one under `substrate: 'maze'` would be a true
             * address on a document of the wrong kind, which is the one thing
             * that envelope exists to prevent. ⇒ while a world is held the
             * bridge falls back to the LADDER payload, exactly as it does with
             * nothing loaded, and `window.__mazeLab.set.world` is where a
             * reader learns what this page is editing. A world-shaped envelope
             * is a PROTOCOL addition and belongs to whichever slice gives a
             * host a reason to drive one.
             */
            setArm: () => (setSession && !heldWorld
                ? { room: setRoomIndex, record: setSession.record() }
                : null),
        });
    };

    boot().then(() => {
        mount(params.source, 'the URL');
        // ⚠ AFTER the first mount, so the `ready` the bridge publishes carries
        // a page that has already drawn — §3.5 says `ready` is *"after connect
        // + first render"*, and a host that mirrored a pre-render state would
        // print an identity line for a level nobody could see.
        return installBridge();
    }).catch((e) => {
        // ⛔ RAW TRUTH: a boot that failed says so with its own message and the
        // page does NOT fall back to a level nobody asked for.
        $('status').textContent = e.message;
        $('status').className = 'bad';
        window.__mazeLab = { fatal: e.message };
    });
}

/**
 * ⛓ IS THIS PAGE RUNNING THE CODE THAT IS ON DISK? The dev server is a plain
 * `python -m http.server`, which sends `Last-Modified` and NO `Cache-Control`,
 * so a browser may serve a module from cache without asking. ⛔ A DIAGNOSTIC,
 * not a fix — a hard reload is what changes the answer; this only says which
 * copy is running. (`watch.html`'s `#sourceStamp`, and it cost a round trip
 * there before it existed.)
 */
function stamp() {
    const box = document.getElementById('sourceStamp');
    fetch(new URL('./mazeLabView.js', import.meta.url), { method: 'HEAD' })
        .then((r) => {
            box.textContent = `mazeLabView.js Last-Modified: ${r.headers.get('last-modified')
                ?? '(none sent)'} — if this is older than your edit, hard-reload `
                + '(Ctrl+Shift+R).';
        })
        .catch(() => { box.textContent = 'source stamp unavailable (no HEAD).'; });
}
