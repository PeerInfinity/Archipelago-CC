/**
 * mazeRoom/mazeLab — **THE MAZE LAB PAGE, WITHOUT THE DOM.** Generate, edit,
 * solve; the URL grammar; the payload.
 *
 * CONSTRUCTIVE-MODE arc, slice 3 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.5 / ⚖ ruling 7). This is `seedlingDemo/watchGenerate.js`'s
 * counterpart and it is deliberately NOT a copy of it: everything about the two
 * pages that is GRAMMAR now lives in `procgenCore/urlParams.js` and
 * `procgenCore/labView.js` (see `urlParams.js`'s docblock for the measurement
 * that decided the lift), and what is left here is the part that is about the
 * MAZE.
 *
 * ⚠ TOOLING ONLY, and the same three laws as `watchGenerate`: it makes no
 * claims, gates nothing, and nothing that DOES make a claim may depend on it.
 * It renders RAW TRUTH — a refusal arrives with the oracle's own verbatim text,
 * a saturated run says SATURATED, and a payload mismatch is REPORTED by name.
 * And it owns NO LOOP: `procgenCore/levelGenerator.generateLevel` is the loop,
 * reached through `procgenMaze.generateMazeLevel` — the same entry
 * `scripts/procgen/generate-maze-level.mjs` calls.
 *
 * ── ⛔⛔ THREE MODES, ONE STATE, AND THE THIRD ONE IS THE POINT ────────
 *
 * GENERATE is the ladder (STEP = "obstacleTarget = k, re-run", so a step-k
 * level IS `generate-maze-level.mjs --seed=S --count=k` byte for byte).
 * EDIT is `mazeRoomEditor.js`'s palette. SOLVE is `mazeOracle`.
 *
 * ⚖ §3.8's certification law is what binds them: **editing never bypasses the
 * oracle.** A generated state is certified — the loop's own last accepting
 * solve did it. The moment an edit lands, `certification` becomes `null` and
 * the page SAYS UNCERTIFIED, until SOLVE puts a verdict back. ⛔ It is `null`
 * and not `false`: "nobody has asked" and "the oracle said no" are different
 * facts and a boolean would merge them, which is the readout defect this repo
 * keeps recording.
 *
 * ── ⚖ RULING 9 — AN EDITED LEVEL'S IDENTITY IS THE PAYLOAD ────────────
 *
 * The URL carries seed + palette + bounds + room + roster + directives, which
 * is a RUN somebody could type. It does NOT carry the edits, and the identity
 * line says so out loud once `edits` is non-empty. `?gen=` / download / upload
 * is the reproduction channel, and `deserializeMazeLevel` is why that is a
 * promise rather than an intention.
 *
 * ── ⛓ THE ROOM SIZE IS A PARAMETER, AND THAT IS A MEASUREMENT ─────────
 *
 * Slice 2 §9.6: the v1 palette on the DEFAULT 11x11 room reverts NOTHING over
 * seeds 1..12 (240 kept, 0 reverted, 0 saturated — every door is walked
 * around). Reverts appear at 5x5/target 12 and saturation at 4x4. So a lab page
 * without `?width=`/`?height=` would be a page on which the REVERTED and
 * SATURATED panes are unreachable, and a person looking at it would conclude
 * the palette never refuses anything. Seedling has no such parameter (its room
 * is the game's), which is why this is one of the four places the two grammars
 * differ.
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: this file is unit-tested in node and loaded in
 * a browser, so it may reach for neither side's globals. The DOM arm is
 * `mazeLabView.js`.
 */

import {
    DEFAULT_BOUNDS, KEEP_POLICY, STOP, directedAttempt,
} from '../procgenCore/levelGenerator.js';
import { catalogueRows, normalizeRoster, restrictPalette } from '../procgenCore/paletteRoster.js';
import {
    ANCHOR_SALT, PARAM_SALT, directiveSeed, intParam, parseDirectives, readBounds,
    readRosterSpec, readSkeleton, writeBounds, writeDirectedParam, writeInt, writeRosterParam,
    writeRunFlag, writeSkeletonParam,
} from '../procgenCore/urlParams.js';
import {
    DEFAULT_SKELETON, DEFAULT_SKELETON_KIND, SKELETON_KINDS,
} from '../procgenCore/skeletonKinds.js';
import { MazeRoomEditor, PALETTE_ENTRIES, PALETTE_TYPES } from './mazeRoomEditor.js';
import { createState, step } from './mazeRoomEngine.js';
import {
    DEFAULT_MAZE_BUDGET, MAZE_DEFAULTS, MAZE_PALETTE, MAZE_SKELETON_KINDS, assertMazeBudget,
    cloneWorld, deserializeMazeLevel, generateMazeLevel, mazeModel, mazeOracle,
    serializeMazeLevel,
} from './procgenMaze.js';
import { SEED_MAX, rngFor } from './procgenRng.js';

export class MazeLabError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MazeLabError';
    }
}

const fail = (message) => { throw new MazeLabError(message); };

/**
 * ⚖ THE PALETTES, AS ONE MAP WITH TWO READERS — the maze's answer to
 * `watchGenerate.GENERATE_BIOMES`, and it uses the SAME `?biome=` key on
 * purpose (⚖ kickoff §3.4: *"the maze lab page uses the SAME URL grammar"*).
 *
 * ⚠ THE KEY IS `biome` AND THE MAZE HAS NO BIOMES. On the Seedling page the
 * parameter selects the BOOT INVENTORY; here it selects the PALETTE, and today
 * there is exactly one (`maze-v1`). Named rather than renamed because one
 * grammar across two pages is worth more than a second word for "which set of
 * templates" — and because the maze DOES have a `biome` vocabulary already
 * (`mazeRoomBiomeLibrary.js`'s wall backends), which slice 5 will bring in as
 * `?skeleton=` kinds. ⛔ Spelling THOSE `?biome=` would have been the real
 * collision, and this note is here so slice 5 does not make it.
 */
export const MAZE_BIOMES = Object.freeze({ 'maze-v1': MAZE_PALETTE });
export const MAZE_BIOME_NAMES = Object.freeze(Object.keys(MAZE_BIOMES));
export const DEFAULT_MAZE_BIOME = 'maze-v1';

export function paletteFor(biome) {
    const palette = MAZE_BIOMES[biome];
    if (!palette) {
        fail(`mazeLab: biome ${JSON.stringify(biome)} is not one of `
            + `[${MAZE_BIOME_NAMES.join(', ')}]. The biome selects the PALETTE, so falling `
            + 'through to another one would generate a level whose certification is about a '
            + 'run nobody asked for.');
    }
    return palette;
}

/** The three arms. ⛔ Named, because `?source=` selects one and a typo must refuse. */
export const SOURCES = Object.freeze({
    GENERATE: 'generate',
    EDIT: 'edit',
    SOLVE: 'solve',
});

/**
 * ⚖ Ruling 9(b)'s reserved block, FILLED by slice 5.
 *
 * ⛓⛓ ITS SPELLING MOVED FROM `open-room` TO `empty`, and it is now RE-EXPORTED
 * from `procgenCore/skeletonKinds.js` rather than declared here. ⚖ Ruling 2 —
 * one vocabulary across substrates — and the maze biome table has always called
 * the open room `empty`, so this page's private name for it was the odd one
 * out. (Seedling's `empty-bordered` moved in the same commit and for the same
 * reason.) ⛔ An old payload carrying `open-room` now diverges BY NAME in
 * `agreementWithPayload`, which is that check working rather than a shim to
 * write. No committed artifact carried either spelling.
 */
export { DEFAULT_SKELETON };

/** ⛓ The kinds this page offers — the maze can run every one (§ the simulator). */
export const SKELETON_KIND_NAMES = MAZE_SKELETON_KINDS;

/**
 * ⛓ THE DIRECTED BOUND. Seedling measured 12 against its own room; the maze's
 * anchor list is the WHOLE GRID filtered by legality (`procgenMaze.anchorsFor`),
 * which on the default 11x11 room is up to 119 cells. ⚠ So the number here is
 * NOT the Seedling measurement carried over — it is a press budget, and a maze
 * solve is milliseconds (the whole BFS state space is `cells x 2^items` = 242),
 * so 12 authorises ~13 solves and costs nothing a person would notice. Stated
 * rather than copied, because a bound with a borrowed justification is a bound
 * nobody measured.
 */
export const DIRECTED_ANCHOR_TRIES = 12;

/* ══════════════════════════════════════════════════════════════════════
 * THE URL — ONE READER, ONE WRITER
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ── THE WHOLE GRAMMAR, AND WHERE EACH HALF COMES FROM ─────────────────
 *
 * SHARED with `watch.html` through `procgenCore/urlParams.js`:
 *   ?source=  ?seed=  ?biome=  ?count=  ?tries=  ?k=  ?anchortries=
 *   ?families= / ?templates=   ?directed=   ?run=1   ?gen=
 *
 * MAZE-ONLY, each with the line that forced it:
 *   ?width= / ?height=   the ROOM. §9.6: the default 11x11 never reverts, so a
 *                        page without this cannot show the REVERTED or
 *                        SATURATED panes at all.
 *   ?expansions=         the BFS NODE CAP. Seedling's budget is `?tickbudget=`
 *                        and is denominated in solver TICKS; these are two
 *                        different quantities and one word for both would be
 *                        the two-spellings failure at its most expensive.
 *
 * ⛓ `?skeleton=`         SLICE 5, and SHARED with watch.html through
 *                        `urlParams.readSkeleton`/`writeSkeletonParam`. The
 *                        maze offers EVERY kind (it owns the two
 *                        simulator-bound backends); Seedling refuses two of
 *                        them by name. ⛔ It is NEVER spelled `?biome=` —
 *                        that selects the PALETTE on both pages, and the
 *                        collision is the one slice 3 wrote this warning
 *                        about.
 *
 * ⚠ `?source=` DEFAULTS TO GENERATE, unlike watch.html — and the reason is a
 * measured difference between the substrates, not a taste. watch.html refuses
 * to infer GENERATE because a Seedling solve costs SECONDS and an arm that
 * waits for a press must not be the one a stale URL lands in. A maze solve is
 * milliseconds, and a page with no default would open on nothing.
 */
export function readLabParams(search) {
    const q = new URLSearchParams(search);
    const source = (q.get('source') || SOURCES.GENERATE).toLowerCase();
    if (!Object.values(SOURCES).includes(source)) {
        fail(`mazeLab: ?source=${JSON.stringify(q.get('source'))} is not one of `
            + `[${Object.values(SOURCES).join(', ')}]. ⛔ It REFUSES rather than falling back `
            + 'to GENERATE: a typo that silently opened a different arm would show a level '
            + 'nobody asked for under a link that names one.');
    }
    const biome = (q.get('biome') || DEFAULT_MAZE_BIOME).toLowerCase();
    const roster = normalizeRoster(paletteFor(biome), readRosterSpec(q));
    return {
        source,
        seed: intParam(q, 'seed', 1),
        biome,
        /** ⛓ §9.6's parameter — see the file docblock. */
        width: intParam(q, 'width', MAZE_DEFAULTS.width),
        height: intParam(q, 'height', MAZE_DEFAULTS.height),
        roster,
        /**
         * ⚠ READ AFTER THE ROSTER on purpose: a directive names a template, and
         * the palette it is checked against is the biome's WHOLE roster rather
         * than the restricted one — a restriction says what a RUN may draw
         * from, a directive is the user naming a template by hand.
         */
        directed: q.get('directed') === null
            ? null : parseDirectives(q.get('directed'), paletteFor(biome)),
        bounds: readBounds(q),
        /** ⛓ SLICE 5 — the room the loop starts from. Absent is the open room. */
        skeleton: readSkeleton(q, { simulator: true, substrate: 'the maze lab page' }),
        budget: { maxExpansions: intParam(q, 'expansions', DEFAULT_MAZE_BUDGET.maxExpansions) },
        /** A payload to REPRODUCE and check against — see `agreementWithPayload`. */
        gen: q.get('gen'),
        /** RUN-ALL on load. `?run=1` is also how the step encoding is read. */
        run: q.get('run') === '1',
    };
}

/**
 * ── ⛔ THE OTHER HALF, AND IT REFUSES WHAT THE READER WOULD REFUSE ─────
 *
 * GENERATE-UI §8.6's standing law: a URL this page cannot reload must not be
 * writable in the first place, because it is not a link to the run it is
 * showing. Every integer goes through `urlParams.writeInt`, the roster through
 * `normalizeRoster`, the directives through `formatDirectives`.
 *
 * ⚠ EVERY OTHER PARAMETER SURVIVES. This rewrites the ones it owns and COPIES
 * the rest — the switch arc's law (the URL is rewritten, never rebuilt, never
 * reloaded).
 *
 * ⛔ AND THE EDITS ARE NOT IN IT (⚖ ruling 9). `describeState` says so by name
 * once there are any; the payload is the reproduction.
 */
export function writeLabParams(search, {
    source = SOURCES.GENERATE, seed, biome, width, height, bounds, budget, step,
    roster = null, directives = null, payloadOwned = false, skeleton = DEFAULT_SKELETON,
} = {}) {
    const q = new URLSearchParams(search);
    if (payloadOwned) return q.toString();
    q.delete('gen');
    q.set('source', String(source));
    writeInt(q, 'seed', seed);
    q.set('biome', String(biome));
    writeInt(q, 'width', width);
    writeInt(q, 'height', height);
    writeBounds(q, bounds);
    /**
     * ⛓ SLICE 5 — DELETED at the open room rather than written
     * `?skeleton=empty`: the default is spelled by absence, and the one writer
     * refuses on the way out whatever the one reader would refuse.
     */
    writeSkeletonParam(q, skeleton, { simulator: true, substrate: 'the maze lab page' });
    writeInt(q, 'expansions', budget.maxExpansions);
    writeRosterParam(q, roster ? normalizeRoster(paletteFor(biome), roster) : null);
    writeDirectedParam(q, directives, paletteFor(biome));
    writeRunFlag(q, step);
    return q.toString();
}

/** ⛓ ONE reader of the `run` + `count` encoding — `urlParams.stepFromParams`. */
export { stepFromParams } from '../procgenCore/urlParams.js';

/* ══════════════════════════════════════════════════════════════════════
 * GENERATE
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * THE STATE AT STEP k — the level, the trace so far, and what stopped it.
 *
 * `step === 0` is the SKELETON: the open room and its goal, before any template
 * is drawn. It is the loop's own control (`generateLevel` refuses to start if
 * the skeleton does not solve), so the page shows the same room the loop
 * checks.
 *
 * ⛔ THE STEP-0 MODEL IS `mazeModel({seed, width, height})` — the SAME
 * constructor `generateMazeLevel` calls with the same arguments, so the goal
 * cell at step 0 is the goal cell at every later step BY CONSTRUCTION rather
 * than by agreement.
 *
 * ⚠ STEP IS "obstacleTarget = k, RE-RUN" and the price is O(N²) solves for a
 * RUN-ALL to N — `labView.ladderCost` states the ceiling before the press. The
 * payoff is the claim: the page's step-k level IS
 * `generate-maze-level.mjs --seed=S --count=k`, byte for byte, because it is
 * the same call.
 */
export function generateStep({
    seed, biome = DEFAULT_MAZE_BIOME, step, bounds, budget, width, height, roster = null,
    skeleton = DEFAULT_SKELETON,
} = {}) {
    const palette = restrictPalette(paletteFor(biome), roster);
    const b = assertMazeBudget(budget ?? DEFAULT_MAZE_BUDGET);
    if (!Number.isInteger(step) || step < 0) {
        fail(`mazeLab: step must be a non-negative integer, got ${JSON.stringify(step)}. `
            + 'Step 0 is the SKELETON and step k is a run to obstacleTarget=k.');
    }
    const bnds = { ...DEFAULT_BOUNDS, ...(bounds ?? {}) };
    const common = {
        seed,
        biome,
        palette,
        roster: palette.roster ?? null,
        step,
        width: width ?? MAZE_DEFAULTS.width,
        height: height ?? MAZE_DEFAULTS.height,
        budget: b,
        /**
         * ⛓ A LADDER STATE CARRIES AN EMPTY DIRECTIVE LIST AND AN EMPTY EDIT
         * LIST rather than none, so every reader downstream (the payload, the
         * URL writer, `describeState`, `agreementWithPayload`) meets one shape
         * and never has to ask whether either has happened yet.
         */
        directives: Object.freeze([]),
        edits: Object.freeze([]),
        /** ⛓ SLICE 5: the kind this room WAS built from, on every state. */
        skeleton: skeleton ?? DEFAULT_SKELETON,
    };
    if (step === 0) {
        const model = mazeModel({ seed, width, height, skeleton });
        return Object.freeze({
            ...common,
            model,
            record: model.skeleton(),
            trace: [],
            summary: null,
            keptTemplates: [],
            stop: null,
            saturated: false,
            bounds: { ...bnds, obstacleTarget: 0 },
            /**
             * ⛓ THE SKELETON IS CERTIFIED BY THE LOOP'S OWN CONTROL — but the
             * loop did not run here, so this state has not been solved by
             * anything. `null` is the honest answer and the page shows
             * UNCERTIFIED until SOLVE is pressed, which is the same rule an
             * edit follows.
             */
            certification: null,
        });
    }
    const out = generateMazeLevel({
        seed,
        palette,
        bounds: { ...bnds, obstacleTarget: step },
        budget: b,
        width,
        height,
        skeleton,
    });
    return Object.freeze({
        ...common,
        model: out.model,
        record: out.record,
        trace: out.trace,
        summary: out.summary,
        keptTemplates: keptTemplatesOf(out.summary, palette),
        stop: out.summary.stop,
        /**
         * ⚠ TWO SPELLINGS OF ONE FACT, AND ONLY ONE OF THEM IS RELIABLE HERE.
         * `stop` is the LOOP's own answer for the target it was given, and a
         * ladder rung asks for exactly as many as it expects — so a rung that
         * kept fewer than it asked for is the saturated one whatever `stop`
         * says. The RUN-ALL driver reads THIS.
         */
        saturated: out.summary.stop === STOP.SATURATED || out.summary.keptCount < step,
        bounds: { ...bnds, obstacleTarget: step },
        /** ⛓ The loop's own last accepting solve — a generated level IS certified. */
        certification: out.summary.finalCertification ?? null,
    });
}

/**
 * The concrete ROWS a summary's kept list names — the instances rebuilt from
 * `{template, params}`, which is what `directedAttempt` is handed as
 * `keptRows`. ⛔ A reconstruction and not a lookup, and it is the same one
 * `generateMazeLevel` uses internally.
 */
export function keptTemplatesOf(summary, palette) {
    return (summary?.kept ?? []).map((k) => {
        const base = (palette?.templates ?? []).find((t) => t.name === k.template);
        if (!base) {
            fail(`mazeLab: the summary names kept template ${JSON.stringify(k.template)}, `
                + `which palette "${palette?.name}" does not hold. A name the palette does `
                + 'not offer is a defect, not a missing row.');
        }
        return base.instantiate(null, k.params ?? {});
    });
}

/** The state's own oracle — one construction, every caller. */
export const oracleFor = (state) => mazeOracle({
    model: state.model,
    items: state.palette.items ?? null,
    budget: state.budget,
});

/**
 * ── ⛓⛓⛓ ONE DIRECTIVE ONTO THE STATE ON SCREEN ───────────────────────
 *
 * ⛔ **THE STATE IT RETURNS IS THE SAME SHAPE `generateStep` RETURNS**, so
 * every consumer — the pane, the payload, the URL writer, `describeState` —
 * meets one object and none of them learns that a directive happened.
 *
 * ⛔ **`summary` STAYS THE LADDER'S.** It describes the RUN that produced the
 * prefix, and a directive is not part of that run: rewriting `keptCount` into
 * it would make the payload claim a loop kept something no loop drew.
 *
 * ⚠ AND THE CERTIFICATION IS THE ATTEMPT'S OWN. `directedAttempt` KEEPS only a
 * candidate whose solve succeeded, so a KEPT directive re-certifies; a refused
 * one leaves the record — and therefore the certification — exactly as it was.
 */
export function applyDirective(state, spec, index) {
    if (!Number.isInteger(index) || index < 0) {
        fail(`mazeLab: a directive needs its 0-based index, got ${JSON.stringify(index)}. `
            + 'The index is part of the anchor stream\'s derivation, so two identical '
            + 'directives ask two different questions rather than walking one order twice.');
    }
    const palette = paletteFor(state.biome);
    const base = palette.templates.find((t) => t.name === spec?.template);
    if (!base) {
        fail(`mazeLab: a directive names template ${JSON.stringify(spec?.template)}, which `
            + `palette "${palette.name}" does not hold — it offers `
            + `[${palette.templates.map((t) => t.name).join(', ')}].`);
    }
    const keepPolicy = spec.keepPolicy ?? KEEP_POLICY.PREFER_DISCHARGE;
    const bound = spec.bound ?? DIRECTED_ANCHOR_TRIES;
    /**
     * ⛓ TWO SALTED STREAMS — `urlParams.directiveSeed`, shared with Seedling.
     * A directive that leaves a parameter to be DRAWN records the drawn VALUE,
     * so a replay passes it as an override and spends no draw; with a single
     * stream the anchor shuffle would then start from a different position and
     * the replay would walk a DIFFERENT anchor list.
     */
    const template = base.instantiate(
        rngFor(directiveSeed(state.seed, index, PARAM_SALT, SEED_MAX)), spec.params ?? {},
    );
    const out = directedAttempt({
        rng: rngFor(directiveSeed(state.seed, index, ANCHOR_SALT, SEED_MAX)),
        model: state.model,
        oracle: oracleFor(state),
        record: state.record,
        template,
        keptRows: state.keptTemplates,
        anchor: spec.anchor ?? null,
        bound,
        keepPolicy,
        /**
         * ⛓⛓⛓ THE DISCHARGE TEST, AND **`null` IS NOT `false`** — a distinction
         * this slice's own browser row caught me getting wrong.
         *
         * `levelGenerator.walkAnchors` reads the three kinds off this ONE
         * return value: `null`/`undefined` means *"this family has NO VERB to
         * discharge"*, `false` means *"it has one and this solve did not use
         * it"*. The v1 maze palette declares no verbs at all (a wall segment
         * and a door-key have nothing a solve could be said to USE), so `null`
         * is the true answer and `false` would be a claim about a mechanism
         * that does not exist.
         *
         * ⛔ AND THE COST IS NOT COSMETIC. `take = solved && kind !==
         * SOLVED_ONLY` — under `false` the walk REVERTS the first solving
         * anchor and keeps searching for a discharge that can never happen,
         * spending up to `bound` extra solves and landing the template at a
         * DIFFERENT cell. The first cut of this file returned `false` and the
         * browser row's *"a KEPT row says WHICH KIND OF KEEP it was"* claim
         * reddened with `kept:solved-only — no anchor within the bound made the
         * walk USE this template's verb`, about a template with no verb.
         *
         * ⚠ It is passed rather than omitted because `PREFER_DISCHARGE` REFUSES
         * a missing predicate by name — and the day the maze grows a push move
         * or a combat verb, this is the one place it is spelled.
         */
        discharges: () => null,
        rowBase: { directive: index + 1, step: state.step, try: null },
    });
    const recorded = Object.freeze({
        template: base.name,
        instance: template.instance,
        params: template.params,
        family: base.family,
        /** ⛔ `anchor` is what was ASKED for; `at` is where it LANDED. */
        anchor: spec.anchor ?? null,
        keepPolicy,
        bound,
        outcome: out.outcome,
        keptKind: out.keptKind,
        at: out.at,
        anchorsOffered: out.anchorsOffered,
        anchorsWalked: out.anchorsWalked,
    });
    return Object.freeze({
        ...state,
        record: out.record,
        trace: Object.freeze([...(state.trace ?? []), ...out.rows]),
        keptTemplates: out.outcome === 'KEPT'
            ? Object.freeze([...state.keptTemplates, template])
            : state.keptTemplates,
        directives: Object.freeze([...(state.directives ?? []), recorded]),
    });
}

/**
 * ⛓⛓⛓ THE WHOLE CONSTRUCTION, FROM ITS IDENTITY — the ladder to step k, then
 * the directives in order.
 *
 * ⛔ **ONE PATH.** The page presses one directive at a time and this replays
 * them in a batch, and they must agree byte for byte — so the page calls
 * `applyDirective` with the same index this does. A second replay path would be
 * a second answer to *"what does this link mean"*.
 */
export function generateWithDirectives({
    seed, biome, step, bounds, budget, width, height, roster = null, directed = null,
    skeleton = DEFAULT_SKELETON,
} = {}) {
    let state = generateStep({
        seed, biome, step, bounds, budget, width, height, roster, skeleton,
    });
    (directed ?? []).forEach((spec, i) => { state = applyDirective(state, spec, i); });
    return state;
}

/** ⛓ The catalogue, from `procgenCore/paletteRoster.js` — one spelling, two pages. */
export function labCatalogue(biome) {
    return catalogueRows(paletteFor(biome));
}

/**
 * ⛓ THE SKELETONS SECTION OF THE CATALOGUE, from `procgenCore/skeletonKinds.js`
 * — one spelling, two pages, for the same reason `labCatalogue` is shared.
 */
export { skeletonCatalogue } from '../procgenCore/skeletonKinds.js';

/* ══════════════════════════════════════════════════════════════════════
 * EDIT (⚖ ruling 8 + §3.8)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ ONE MANUAL EDIT — `mazeRoomEditor.applyAt` on a CLONE.
 *
 * ⛔ **IT CLONES FIRST, AND THAT IS NOT A CONVENIENCE.** `MazeRoomEditor`
 * MUTATES the world it is given (it is the panel's editor, and the panel owns
 * exactly one world). A lab page's state object is frozen and its `record` is
 * shared with the trace rows, the payload and — after a `?gen=` load — with the
 * thing it is being compared against. Editing in place would silently rewrite
 * the level the page says it generated. ⇒ every edit is applied to
 * `cloneWorld(record)` and the previous world is kept, which also gives UNDO
 * for free (the stack is a list of worlds, exactly as the Seedling arc's undo
 * is a list of records).
 *
 * ⛔ **AND IT UNCERTIFIES** (⚖ §3.8): `certification` goes to `null` on any
 * edit that CHANGED something. An edit the editor refused (`ok: false`) or one
 * that changed nothing (`Tile already floor.`) leaves the state exactly as it
 * was — a refusal is not a modification, and marking the level uncertified for
 * a click that did nothing would be a readout claiming a fact that did not
 * happen.
 *
 * @param {object} state  a `generateStep`/`applyDirective`/`loadPayload` state
 * @param {MazeRoomEditor} editor  the page's editor (its palette selection is
 *   UI state and lives with the UI)
 * @returns {{state: object, result: object}} the new state and the editor's own
 *   descriptor VERBATIM — the page prints `result.description` unchanged,
 *   because the editor's refusal is the evidence channel.
 */
export function applyEdit(state, editor, tx, ty) {
    if (!(editor instanceof MazeRoomEditor)) {
        fail('mazeLab: applyEdit needs a MazeRoomEditor — the palette selection is the '
            + 'page\'s, and a second editor would be a second answer to "what does a click '
            + 'do".');
    }
    const next = cloneWorld(state.record);
    const result = editor.applyAt(next, tx, ty);
    /**
     * ⛓⛓⛓ **THE TEST IS "DID THE WORLD CHANGE", NOT WHAT THE EDITOR CALLED IT**
     * — and this row is here because the first cut asked the editor and got the
     * wrong answer.
     *
     * `MazeRoomEditor._setTile` returns `ok('tile', 'Tile (3,3) already
     * floor.')` for a click that changed NOTHING: `ok: true`, and `type` is
     * `'tile'` rather than `'noop'` (`'noop'` is reserved for its REFUSALS). So
     * a guard on `ok`/`type` counted "you clicked floor on a floor tile" as a
     * manual edit — which bumps the edit count, drops the CERTIFICATION and
     * makes the identity line say the URL stopped being a reproduction, all for
     * a click that did nothing. ⚖ §3.8 is a law about CHANGES.
     *
     * ⛔ Asked of the WORLD rather than fixed in the editor: the editor is the
     * panel's too and its descriptors are its own business, and comparing the
     * serialised worlds is the one question this page actually has (rooms are
     * tens of cells, so the comparison is free).
     */
    const changed = result.ok
        && JSON.stringify(serializeMazeLevel(next))
            !== JSON.stringify(serializeMazeLevel(state.record));
    if (!changed) {
        return { state, result };
    }
    const edit = Object.freeze({
        n: (state.edits?.length ?? 0) + 1,
        type: result.type,
        at: Object.freeze({ tx, ty }),
        palette: editor.selectedType,
        description: result.description,
    });
    return {
        state: Object.freeze({
            ...state,
            record: next,
            edits: Object.freeze([...(state.edits ?? []), edit]),
            /** ⚖ §3.8: UNCERTIFIED until re-solved. `null`, never `false`. */
            certification: null,
            /** ⛓ The world before this edit, so UNDO is a pop and not a replay. */
            undoStack: Object.freeze([...(state.undoStack ?? []), state.record]),
        }),
        result,
    };
}

/** ⛓ UNDO is a POP of the world stack. Uncertified stays uncertified — the
 *  oracle has still not been asked about the world now on screen. */
export function undoEdit(state) {
    const stack = state.undoStack ?? [];
    if (stack.length === 0) return state;
    return Object.freeze({
        ...state,
        record: stack[stack.length - 1],
        undoStack: Object.freeze(stack.slice(0, -1)),
        edits: Object.freeze((state.edits ?? []).slice(0, -1)),
        certification: null,
    });
}

/* ══════════════════════════════════════════════════════════════════════
 * SOLVE
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * THE DISPLAY SOLVE — the current world, through the loop's OWN oracle.
 *
 * ⛔ `mazeOracle` built from the state's own model and the palette's own items,
 * which is exactly what `generateMazeLevel` builds internally. Not a second
 * oracle, not a second goal predicate, not a second budget.
 *
 * ⚠ IT RETURNS THE ORACLE'S VERDICT OBJECT UNCHANGED, refusals included. A
 * REFUSED solve on an EDITED level is the whole point of the mode — a wall
 * painted across the only corridor must come back REFUSED with the oracle's own
 * sentence, not with a page's paraphrase of it.
 */
export function solveState(state) {
    return oracleFor(state).solve(state.record);
}

/**
 * SOLVE, AND KEEP THE ANSWER — the certification law's other half (⚖ §3.8).
 *
 * ⛔ A REFUSED solve records `null`, not the refusal: `certification` answers
 * *"has the oracle said this world is completable"* and a refusal is a no. The
 * refusal itself rides in `lastSolve`, which is what the pane prints — two
 * fields because they are two questions, and a page that stored the refusal AS
 * the certification would show a level as certified because somebody asked.
 */
export function certify(state) {
    const solved = solveState(state);
    return Object.freeze({
        ...state,
        lastSolve: solved,
        certification: solved.verdict === 'SOLVED' ? solved.certification : null,
    });
}

/**
 * ⛓ THE CELLS A PLAN WALKS — what the canvas overlay draws.
 *
 * ⛔ IT REPLAYS THE PLAN THROUGH THE ENGINE'S OWN `step`, from the same start
 * construction the oracle used. A page-side "apply the direction letters to a
 * coordinate" would be a SECOND movement model, and the first world with a
 * closed door in it would draw a path through it — the picture would show the
 * walk the solver was refused. ⚠ Which is also why this returns `null` for a
 * plan that does not replay rather than a partial path: the oracle's own replay
 * throws a SEAM DEFECT in that case, and an overlay is not the place to
 * discover one.
 */
export function planCells(state, solved) {
    if (!solved?.plan?.length) return null;
    let s = createState(state.record);
    for (const id of state.palette?.items ?? []) s.inventory.add(id);
    const cells = [{ x: s.player_pos.x, y: s.player_pos.y }];
    for (const input of solved.plan) {
        const next = step(state.record, s, input);
        if (!next) return null;
        s = next;
        cells.push({ x: s.player_pos.x, y: s.player_pos.y });
    }
    return cells;
}

/* ══════════════════════════════════════════════════════════════════════
 * THE PAYLOAD — the identity of an EDITED level (⚖ ruling 9)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ WHAT DOWNLOAD WRITES AND UPLOAD READS.
 *
 * ⛔ THE `level` FIELD IS `serializeMazeLevel`'s AND IS BYTE-COMPATIBLE WITH
 * `generate-maze-level.mjs --json`'s, on purpose — that is what makes the
 * browser row's cross-runtime identity claim possible at all, and what lets a
 * CLI payload be dropped into this page's LOAD box.
 *
 * ⚠ IT CARRIES THE EDITS AND THE CERTIFICATION, and the URL carries neither.
 * That is ruling 9 in one object: a URL is an INSTRUCTION (a run somebody could
 * type) and a payload is a REPORT (what actually happened, including the parts
 * no seed will reproduce).
 */
export function labPayload(state) {
    return {
        generator: 'frontend/modules/mazeRoom/lab.html',
        seed: state.seed,
        palette: state.palette?.name ?? null,
        biome: state.biome,
        width: state.width,
        height: state.height,
        bounds: state.bounds,
        budget: state.budget,
        roster: state.roster ?? null,
        directives: state.directives ?? [],
        skeleton: state.skeleton ?? DEFAULT_SKELETON,
        edits: state.edits ?? [],
        certified: Boolean(state.certification),
        summary: state.summary,
        level: serializeMazeLevel(state.record),
        trace: state.trace ?? [],
    };
}

/**
 * ⛓⛓⛓ REPRODUCE AN EMITTED PAYLOAD AND CHECK IT, which is a stronger contract
 * than loading one.
 *
 * The page could draw `payload.level` directly; instead it GENERATES from the
 * payload's own seed/biome/bounds/room and compares. ⛔ That keeps ONE path
 * into the page — every level the page draws came out of the loop, in the page
 * — and it turns the export into a determinism check across two runtimes
 * (node's CLI and the browser's) rather than a picture of a file.
 *
 * ⚠ A MISMATCH IS THE FINDING, so it is returned rather than thrown: the page
 * shows the room it generated AND says the payload disagreed.
 *
 * ⚠ AND AN **EDITED** PAYLOAD IS EXPECTED TO DIVERGE — that is ruling 9 again,
 * and the check says so BY NAME instead of reporting an unexplained level
 * difference. Such a payload is LOADED (`deserializeMazeLevel`), not
 * reproduced.
 */
export function agreementWithPayload(payload, state) {
    const differences = [];
    const cmp = (what, a, b) => {
        if (JSON.stringify(a) !== JSON.stringify(b)) differences.push(what);
    };
    if (!payload || typeof payload !== 'object') {
        return { checked: false, agrees: false, differences: ['the payload is not an object'] };
    }
    if ((payload.edits ?? []).length > 0) {
        return {
            checked: false,
            agrees: false,
            differences: [],
            why: `this payload carries ${payload.edits.length} MANUAL EDIT(S), and ⚖ ruling 9 `
                + 'says an edited level\'s identity is the payload rather than the seed. '
                + 'Regenerating from its seed would reproduce the level BEFORE the edits and '
                + 'report a difference whose real cause is that the edits are not in the '
                + 'seed. Use LOAD, which takes `level` as it stands.',
        };
    }
    cmp('seed', payload.seed, state.seed);
    cmp('biome', payload.biome, state.biome);
    cmp('width', payload.width ?? MAZE_DEFAULTS.width, state.width);
    cmp('height', payload.height ?? MAZE_DEFAULTS.height, state.height);
    cmp('roster', payload.roster ?? null, state.roster ?? null);
    cmp('directives', payload.directives ?? [], state.directives ?? []);
    cmp('skeleton', payload.skeleton ?? DEFAULT_SKELETON, state.skeleton ?? DEFAULT_SKELETON);
    cmp('level', payload.level, serializeMazeLevel(state.record));
    cmp('trace', payload.trace, state.trace);
    return {
        checked: true,
        agrees: differences.length === 0,
        differences,
        why: differences.length === 0
            ? null
            : `the payload and this page's own generation differ in [${differences.join(', ')}]. `
                + 'The page is showing WHAT IT GENERATED; the payload was emitted from the '
                + 'same seed, so a difference is a determinism finding across the two '
                + 'runtimes, not a display problem.',
    };
}

/**
 * ⛓ LOAD a payload's level AS IT STANDS — the channel an EDITED level travels
 * on. The state that comes back is UNCERTIFIED whatever the payload claimed:
 * `certified: true` in a file is somebody else's assertion, and this page's
 * certification is its own oracle's answer or nothing.
 */
export function loadPayload(payload, { biome = DEFAULT_MAZE_BIOME } = {}) {
    const world = deserializeMazeLevel(payload?.level ?? payload);
    const seed = Number.isInteger(payload?.seed) ? payload.seed : 1;
    const palette = paletteFor(payload?.biome ?? biome);
    /**
     * ⛔ THE MODEL IS REBUILT AROUND THE LOADED WORLD'S OWN GOAL, not around
     * the seed's. A payload may have been edited — its exit MOVED — and a model
     * whose `goalPos` came from the seed would solve for a cell the world does
     * not have an exit on. The seed is kept for the identity line and for
     * anchor streams; it is not the authority on this world's geometry.
     *
     * ⛓ SLICE 5: AND IT IS BUILT AT THE **OPEN ROOM**, WHATEVER KIND THE
     * PAYLOAD NAMES. The model here exists for `goalPos`, legality and the
     * anchor streams; its `skeleton()` is never called, because the record
     * comes from the payload. Carving one would spend the room stream's draws
     * to build a world that is immediately thrown away. ⚠ The payload's own
     * `skeleton` block still rides onto the state below — the loaded level
     * SAYS which kind produced it.
     */
    const goal = [...world.exits.values()][0];
    const model = mazeModel({
        seed,
        width: world.width,
        height: world.height,
        defaults: { ...MAZE_DEFAULTS, entrance: { x: world.entrance.x, y: world.entrance.y } },
    });
    const bound = Object.freeze({
        ...model,
        goalCell: Object.freeze({ tx: goal.x, ty: goal.y }),
        goalPos: Object.freeze({ x: goal.x, y: goal.y }),
    });
    return Object.freeze({
        seed,
        biome: payload?.biome ?? biome,
        palette,
        roster: payload?.roster ?? null,
        step: 0,
        width: world.width,
        height: world.height,
        model: bound,
        record: world,
        trace: payload?.trace ?? [],
        summary: payload?.summary ?? null,
        keptTemplates: [],
        directives: payload?.directives ?? [],
        edits: payload?.edits ?? [],
        skeleton: payload?.skeleton ?? DEFAULT_SKELETON,
        stop: null,
        saturated: false,
        bounds: { ...DEFAULT_BOUNDS, ...(payload?.bounds ?? {}) },
        budget: assertMazeBudget(payload?.budget ?? DEFAULT_MAZE_BUDGET),
        certification: null,
        loaded: true,
    });
}

/* ══════════════════════════════════════════════════════════════════════
 * THE READOUT
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ THE IDENTITY LINE — ⚖ §3.5/§3.8's own sentence: *"seed N's ladder to
 * step k, then M directed attempts, then E manual edits — the URL is not a
 * reproduction after edits; the payload is."*
 *
 * ⛔ IT SAYS THE URL IS NOT A REPRODUCTION **ONLY WHEN THAT IS TRUE**. A
 * generated or directed level reproduces from its link exactly, and a page that
 * warned about it unconditionally would train a reader to ignore the one time
 * it matters.
 *
 * ⛔ AND UNCERTIFIED IS ITS OWN CLAUSE, not an absence. ⚖ §3.8: editing never
 * bypasses the oracle, and the way that is enforced on a page is that the state
 * SAYS so until SOLVE has been pressed.
 *
 * ⚠ EVERY BOUND THAT RAN IS IN IT (⚖ kickoff §5), including the two the
 * Seedling line has no room for: the ROOM and the EXPANSION cap.
 */
export function describeState(state, solved = null) {
    const s = state.summary;
    const edits = (state.edits ?? []).length;
    const directives = (state.directives ?? []).length;
    /**
     * ⛓ SLICE 5 — THE SKELETON KIND, NAMED ONLY WHEN IT IS NOT THE OPEN ROOM.
     * ⛔ A clause printed on every level would train a reader to skip it, and
     * the one time it matters is the one time it is there — the same rule the
     * "URL is not a reproduction after edits" clause below already follows.
     */
    const kind = state.skeleton?.kind ?? DEFAULT_SKELETON_KIND;
    const bits = [
        `seed ${state.seed} · ${state.biome} · ${state.width}x${state.height} · step ${state.step}`
            + (kind === DEFAULT_SKELETON_KIND
                ? '' : ` · skeleton: ${kind} (CARVED, not the open room)`)
            + (directives ? `, then ${directives} directed attempt(s)` : '')
            + (edits ? `, then ${edits} manual edit(s)` : ''),
        `palette: ${state.palette?.name ?? '(none)'}`
            + (state.roster ? '' : ' (the WHOLE roster — no restriction)'),
        s ? `kept ${s.keptCount}/${state.bounds.obstacleTarget} over ${s.attempts} attempt(s)`
            : `the SKELETON — ${kind === DEFAULT_SKELETON_KIND
                ? 'the open room' : `a ${kind} CARVE`} and its goal, before any template`,
        `bounds: target=${state.bounds.obstacleTarget} tries=${state.bounds.triesPerStep} `
            + `k=${state.bounds.saturationK} `
            + `anchortries=${state.bounds.anchorTriesPerCandidate}`,
        `budget: ${state.budget.maxExpansions} BFS expansions (⛓ NODES, not ms)`,
        state.certification
            ? `CERTIFIED — the oracle walked ${state.certification.steps} step(s) to the goal`
            : 'UNCERTIFIED — nothing has solved the world now on screen',
    ];
    if (edits) {
        bits.push('⚠ the URL is NOT a reproduction after edits — the PAYLOAD is '
            + '(download / the save box)');
    }
    if (state.stop) bits.push(`stop: ${state.stop}`);
    if (solved) {
        bits.push(`solve: ${solved.verdict}`
            + (solved.ticks ? ` in ${solved.ticks} step(s)` : ''));
    }
    return bits.join('  ·  ');
}

export {
    MAZE_DEFAULTS, MAZE_PALETTE, PALETTE_ENTRIES, PALETTE_TYPES, MazeRoomEditor, STOP,
    deserializeMazeLevel, serializeMazeLevel,
};
