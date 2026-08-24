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
 * The URL carries seed + palette + bounds + room + roster, which is a RUN
 * somebody could type. It does NOT carry the edits — nor, since slice 12, the
 * DIRECTIVES — and the identity line says so out loud once either is
 * non-empty. `?gen=` / download / upload is the reproduction channel, and
 * `deserializeMazeLevel` is why that is a promise rather than an intention.
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
    DEFAULT_BOUNDS, STOP, directedAttempt,
} from '../procgenCore/levelGenerator.js';
import { catalogueRows, normalizeRoster, restrictPalette } from '../procgenCore/paletteRoster.js';
import {
    ANCHOR_SALT, DIRECTIVE_KEEP_POLICY, PARAM_SALT, directiveSeed, dropDirectedParam,
    intParam, readAreas, readBounds,
    readElements, readRequire, readRosterSpec, readSkeleton, refuseDirectedParam, writeAreasParam,
    refuseDuplicateParams,
    writeBounds, writeElementsParam, writeInt, writeRequireParam, writeRosterParam, writeRunFlag,
    writeSkeletonParam,
} from '../procgenCore/urlParams.js';
import {
    DEFAULT_AREAS, formatAreaSpec, formatRequireList, normalizeAreaSpec,
} from '../procgenCore/areaSpec.js';
import { densityLine } from '../procgenCore/densityBlock.js';
/**
 * ⛓⛓⛓ EDITOR v3, SLICE A2 — **THE EDIT CORE IS THIS PAGE'S EDIT MODEL NOW.**
 * ⛔ `foldEdits` is the ONE reconstruction (law (a)); the world STACK this page
 * carried as `undoStack` is GONE, and UNDO is the same fold over a shorter
 * list. `createEditSession` is what the DOM arm mounts `editorView` on, and
 * `mazeEditAdapter` (slice A1) is the six words the core asks of a substrate.
 */
import {
    applyOne, createEditSession, describeOps, foldEdits,
} from '../procgenCore/editCore.js';
/**
 * ⛓⛓ PROCGEN ELEMENTS arc 2, slice 4 — the ONE element codec. ⛔ The page does
 * not parse `?elements=` itself and does not restate a domain: `urlParams`
 * reads the parameter, `elementSpec` adjudicates the string, and the form's
 * options come from the codec's own schema.
 */
import {
    DEFAULT_ELEMENTS, elementSpecOf, formatElementSpec, normalizeElementSpec,
} from '../procgenCore/elementSpec.js';
import {
    DEFAULT_SKELETON, DEFAULT_SKELETON_KIND, SKELETON_KINDS, formatSkeleton,
    normalizeSkeleton,
} from '../procgenCore/skeletonKinds.js';
import {
    MazeRoomEditor, PALETTE_ENTRIES, PALETTE_TYPES,
} from './mazeRoomEditor.js';
import { createState, step } from './mazeRoomEngine.js';
import {
    DEFAULT_MAZE_BUDGET, MAZE_DEFAULTS, MAZE_PALETTE, MAZE_SKELETON_KINDS, assertMazeBudget,
    deserializeMazeLevel, generateMazeLevel, mazeCostRecords, mazeModel, mazeOracle,
    requireOutcome, serializeMazeLevel, worldsEqual,
} from './procgenMaze.js';
import { mazeEditAdapter } from './mazeEditAdapter.js';
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
 *   ?families= / ?templates=   ?run=1   ?gen=
 *
 * ⛔ AND **NOT** `?directed=` — constructive-mode slice 12 retired it (⚖ §3.9).
 * `refuseDirectedParam` names the way in; the payload carries a directive list
 * and `?gen=` replays it.
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
    /**
     * ⛓⛓⛓ SLICE 12 — `?directed=` IS REFUSED BY NAME, BEFORE ANYTHING ELSE IS
     * READ, so an old link's first answer is the one that explains where its
     * directives went. ⚖ §3.9, in the one spelling both pages speak.
     */
    refuseDirectedParam(q, { substrate: 'the maze lab page' });
    /** ⛓ P5 — the query's own SHAPE, in the one spelling both pages speak.
     *  `run=1&run=1` used to be accepted silently by both readers. */
    refuseDuplicateParams(q, { substrate: 'the maze lab page' });
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
         * ⛔⛔ SLICE 12 — **NO `directed` FIELD.** Slice 3's verb 2 is alive on
         * the ATTEMPT button, on `generate-maze-level.mjs --directed=` and in
         * the payload's `directives`; the URL is simply not one of its channels
         * any more, and `?directed=` refuses above rather than being ignored.
         */
        bounds: readBounds(q),
        /** ⛓ SLICE 5 — the room the loop starts from. Absent is the open room. */
        skeleton: readSkeleton(q, { simulator: true, substrate: 'the maze lab page' }),
        /**
         * ⛓⛓ PROCGEN ELEMENTS arc 1 slice 3 — the AREA GRAPH and the RULE
         * DIRECTIVE. Absent `?areas=` is `{keys: 0}`, at which the binding does
         * not partition, does not call the module and spends no draw — so a
         * link without it is the page this arc found (⚖ arc ruling 3).
         */
        areas: readAreas(q),
        require: readRequire(q),
        /**
         * ⛓⛓ PROCGEN ELEMENTS arc 2 slice 3/4 — THE ELEMENT. Absent
         * `?elements=` is `{name: 'none'}`, at which the binding draws no site,
         * instantiates nothing, never calls `construct` and spends no draw — so
         * a link without it is byte-for-byte the level this page produced
         * before elements existed (⚖ arc-2 ruling 5).
         */
        elements: readElements(q),
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
 * showing. Every integer goes through `urlParams.writeInt` and the roster
 * through `normalizeRoster`.
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
    roster = null, payloadOwned = false, skeleton = DEFAULT_SKELETON,
    areas = DEFAULT_AREAS, require = null, elements = DEFAULT_ELEMENTS,
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
    /**
     * ⛓ SLICE 3 — DELETED at `{keys: 0}` and at no directive, for the reason
     * `?skeleton=` is deleted at the open room: the default is spelled by
     * absence, and the writer rewrites IN PLACE so a spec change does not move
     * the parameter to the end of the bar (trap 245).
     */
    writeAreasParam(q, areas);
    writeRequireParam(q, require);
    /**
     * ⛓ ARC 2 SLICE 4 — DELETED at `none`, rewritten IN PLACE otherwise, for
     * exactly the reasons `?areas=` is: the default is spelled by absence, and a
     * `delete` followed by a `set` would move the key to the END of the bar and
     * break the round-trip fixed point (trap 245).
     */
    writeElementsParam(q, elements);
    writeInt(q, 'expansions', budget.maxExpansions);
    writeRosterParam(q, roster ? normalizeRoster(paletteFor(biome), roster) : null);
    /**
     * ⛔ SLICE 12 — THE DIRECTIVES ARE NOT WRITTEN AND THERE IS NO ARGUMENT FOR
     * THEM (⚖ §3.9). A stale key is DELETED rather than copied forward: the
     * reader refuses `?directed=`, so carrying one through a rewrite would hand
     * back a bar this page cannot reload.
     */
    dropDirectedParam(q);
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
    skeleton = DEFAULT_SKELETON, areas = DEFAULT_AREAS, require = null,
    elements = DEFAULT_ELEMENTS,
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
        /**
         * ⛓ SLICE 5: the kind this room WAS built from, on every state.
         * ⛓ SLICE 7: NORMALIZED with its parameters, so one room has exactly
         * one spelling on the state and `agreementWithPayload` can compare with
         * a both-sides default.
         */
        skeleton: normalizeSkeleton(skeleton ?? DEFAULT_SKELETON),
        /**
         * ⛓⛓ SLICE 3 — THE AREA SPEC AND THE DIRECTIVE, on every state, in the
         * one normalized spelling, so the URL writer, the payload comparison
         * and the identity line all read the same object.
         */
        areas: normalizeAreaSpec(areas ?? DEFAULT_AREAS),
        require: require ? Object.freeze([...require]) : null,
        /**
         * ⛓⛓ ARC 2 SLICE 4 — THE ELEMENT SPEC, on every state, in the one
         * normalized spelling. ⚠ `normalizeElementSpec` KEEPS a parameter the
         * caller named EVEN AT ITS DEFAULT VALUE, unlike the area and skeleton
         * normalizers, and that asymmetry is load-bearing rather than
         * cosmetic: a NAMED parameter is an override that spends no draw and an
         * OMITTED one is drawn, so `guard;len=3` and `guard` are different runs
         * (`elementSpec.namedParams`).
         */
        elements: normalizeElementSpec(elements ?? DEFAULT_ELEMENTS),
    };
    if (step === 0) {
        const model = mazeModel({ seed, width, height, skeleton, areas, elements });
        return Object.freeze({
            ...common,
            model,
            record: model.skeleton(),
            /** ⛓ SLICE A2 — see `THE BASE RECORD` below: the record the fold
             *  starts from, and the ONE thing UNDO needs now that the world
             *  stack is gone. A freshly-generated level has no edits, so it IS
             *  the record. */
            baseRecord: model.skeleton(),
            trace: [],
            summary: null,
            /**
             * ⛓⛓⛓ THE DIRECTIVE IS ASKED AT **STEP 0 TOO**, and it has to be:
             * the area graph is built when the MODEL is, before pass 2 exists,
             * so the skeleton rung is already the level the directive is about.
             * ⛔ Its proof is the same ablation the cost records make, so the
             * page runs `mazeCostRecords` here — a handful of BFS solves on the
             * room, and ONLY when the area binding ran AND something was asked.
             */
            requireResult: require && require.length
                ? requireOutcome({
                    require,
                    areas: model.areas,
                    elements: model.areas.ran
                        ? mazeCostRecords({ model, budget: b, record: model.skeleton() }).elements
                        : [],
                })
                : null,
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
            /**
             * ⛓⛓⛓ SLICE 12 — THE TRI-STATE, IN SEEDLING'S SPELLING (⚖ §3.9's
             * second item; slice 11 §16.2 flagged the divergence and named this
             * page as the side to move). `null` = NOBODY HAS ASKED about the
             * record now on screen, `true`/`false` = the ORACLE's own answer.
             * ⛔ It is a FIELD and not `Boolean(certification)`, because
             * `certification` is `null` for both "not asked" and "asked, said
             * no" and a derivation could not tell them apart — which is trap
             * 262 exactly, at the boundary this page publishes across.
             */
            certified: null,
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
        areas,
        elements,
        require,
    });
    return Object.freeze({
        ...common,
        model: out.model,
        record: out.record,
        /** ⛓ SLICE A2 — the fold's base; see `THE BASE RECORD`. */
        baseRecord: out.record,
        trace: out.trace,
        summary: out.summary,
        keptTemplates: keptTemplatesOf(out.summary, palette),
        /** ⛓ SLICE 3 — the loop's own answer about the directive, at this rung. */
        requireResult: out.summary.require ?? null,
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
        /** ⛓ SLICE 12 — and the tri-state says the oracle ANSWERED, and said yes. */
        certified: out.summary.finalCertification ? true : null,
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
    /**
     * ⛓⛓⛓ **`PREFER_DISCHARGE` LEFT THE MAZE IN ARC 5, SLICE 5** (⚖ arc-5
     * ruling 4, the user's own words: *"we can get rid of it or leave it — as
     * far as I'm aware it was never needed"*), and it left MEASURED FIRST.
     *
     * `census-maze-keeps.mjs` swept the policy's own subjects — every directed
     * attempt the page can make: 9 skeleton kinds x seeds 1..6 x steps {0, 2} x
     * all 18 ENUMERATED instantiations of both v1 templates, at this file's own
     * `DIRECTED_ANCHOR_TRIES` bound — and counted the `solved-only` class:
     * **0 of 1944**. ⛓ Zero STRUCTURALLY rather than by the luck of the seeds:
     * this call site handed `discharges: () => null` because the v1 palette
     * declares NO VERB on either template, and `walkAnchors` reads a `null`
     * discharge as `KEPT_KIND.NO_VERB` — never as `solved-only`. The preference
     * had nothing to prefer between on any room the maze can build.
     *
     * ⇒ every directive runs under `DIRECTIVE_KEEP_POLICY`, the CONSTANT
     * Seedling has run under since arc-3 slice 4c, and a spec that asks for
     * anything else REFUSES BY NAME rather than being answered under a policy
     * it did not ask for. ⛔ `discharges` goes with it: under `FIRST_SOLVED`
     * `walkAnchors` never calls the predicate, and passing one would be a
     * declaration about a question nothing puts.
     *
     * ⛓ **THE TRACE FIELD'S DISPOSITION, SAID EXPLICITLY** (the ruling asks
     * for it): `keptKind` STAYS on the directive record and is now `null` on
     * every maze directive — which is what `FIRST_SOLVED` has always meant and
     * what `labView.describeKeptKind`'s default arm already says in words (*"the
     * keep policy was first-SOLVED, so nothing asked"*). ⛔ The FIELD is not
     * dropped: a payload is a REPORT and must still say what was run, and
     * removing it would move every recorded directive's bytes for a `null`.
     * ⚠ `KEEP_POLICY`/`KEPT_KIND` themselves stay in `procgenCore/
     * levelGenerator.js`. Both substrates now run one policy, so the enum's
     * other member is unreachable from either — that removal is a LOOP-CORE
     * change nobody has ruled, and it is named for the arc close rather than
     * taken here.
     */
    if (spec.keepPolicy !== undefined && spec.keepPolicy !== DIRECTIVE_KEEP_POLICY) {
        fail(`mazeLab: a directive asked for keepPolicy ${JSON.stringify(spec.keepPolicy)}. `
            + `Every maze directive runs under ${JSON.stringify(DIRECTIVE_KEEP_POLICY)} since `
            + 'PROCGEN ELEMENTS arc 5 slice 5 (⚖ ruling 4): the `solved-only` class was '
            + 'measured at 0 of 1944 directed attempts and is STRUCTURALLY unreachable — the '
            + 'v1 palette declares no verb on either template. ⛔ An old spec carrying the '
            + 'other policy REFUSES rather than being answered under this one: the two were '
            + 'different questions and silently answering the surviving one is the '
            + 'reinterpretation a versioned grammar exists to prevent.');
    }
    const keepPolicy = DIRECTIVE_KEEP_POLICY;
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
         * ⛔⛔ **`discharges` IS GONE — arc 5, slice 5.** Under `FIRST_SOLVED`
         * `walkAnchors` never asks, so a predicate here would be an answer to a
         * question nothing puts. What follows is kept as the RECORD of why it
         * was `() => null` and never `() => false`, because the distinction is
         * the reason the class it fed was empty:
         *
         * ⛓⛓⛓ THE DISCHARGE TEST, AND **`null` IS NOT `false`** — a distinction
         * the constructive arc's own browser row caught me getting wrong.
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
         * ⚠ It WAS passed rather than omitted because `PREFER_DISCHARGE` refused
         * a missing predicate by name. The day the maze grows a push move or a
         * combat verb, this docblock is where the argument for bringing the
         * preference back starts — with a census, not with a memory.
         */
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
        /** ⛓ SLICE A2 — a DIRECTIVE is not an EDIT: it moves the base the edit
         *  fold starts from, exactly as a ladder rung does. */
        baseRecord: out.record,
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
    skeleton = DEFAULT_SKELETON, areas = DEFAULT_AREAS, require = null,
    elements = DEFAULT_ELEMENTS,
} = {}) {
    let state = generateStep({
        seed, biome, step, bounds, budget, width, height, roster, skeleton, areas, require,
        elements,
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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR v3, SLICE A2 — **THE EDIT MODEL IS `procgenCore/editCore`**
 * ══════════════════════════════════════════════════════════════════════
 *
 * ── ⛓ THE BASE RECORD ────────────────────────────────────────────────
 *
 * ⛔ **`undoStack` IS GONE.** This page carried a list of WORLDS and popped it;
 * ⚖ law (a) of the core says an edited level IS *the base, then the ops, in
 * order*, and UNDO is that same fold over a SHORTER LIST. So the state carries
 * ONE record instead of N: `baseRecord`, the world the ladder / a directive /
 * a LOAD produced, before any manual edit. `record` is `foldEdits(baseRecord,
 * edits)`.
 *
 * ⛔ Not a tidy-up: a stack is only equal to the fold if NOTHING but an edit
 * ever wrote the record, and this page has three other writers (a rung, a
 * directive, a load). A1 pinned the two equal on the maze
 * (`mazeEditAdapter.test.js`) precisely so this replacement could be a swap
 * with a gate behind it.
 *
 * ── ⛓ TWO SPELLINGS OF THE SAME LAW, AND WHY BOTH EXIST ──────────────
 *
 *  · **VALUE** — `applyEdit` / `applyEdits` / `undoEdit`, `(state) → state`.
 *    A payload replay, `?gen=`, the CLI and every test drive these; they take
 *    no session and hold no mutable state.
 *  · **SESSION** — `openEditSession` / `projectSession`, what `mazeLabView`
 *    mounts `procgenCore/editorView` on. A session is the ONE home for the
 *    record, the op list and the certification tri-state while a person is
 *    editing, and `projectSession` is the ONE WRITER that copies those three
 *    back onto the page's state for the readouts to read.
 *
 * ⛔ They are not two application paths: both land in `editCore.foldEdits`,
 * which is the one reconstruction. What differs is who holds the op list.
 */

/**
 * ⛓⛓ **THE IDENTITY TAG A PAYLOAD CARRIES** — §3.2's `base`, in this page's
 * own spelling and in the payload's own field names.
 *
 * ⛔ THE CORE NEVER INTERPRETS IT (`createEditSession`'s docblock): it is an
 * opaque tagged value, carried verbatim, and resolving one back to a record is
 * a substrate's business. It exists so a payload can say *what these edits are
 * edits OF* without the reader having to diff two levels to find out.
 */
export function editBaseTag(state) {
    return Object.freeze({
        kind: 'maze-lab',
        seed: state.seed,
        biome: state.biome,
        width: state.width,
        height: state.height,
        step: state.step,
        skeleton: state.skeleton ?? DEFAULT_SKELETON,
        areas: state.areas ?? DEFAULT_AREAS,
        elements: state.elements ?? DEFAULT_ELEMENTS,
        require: state.require ?? null,
        directives: (state.directives ?? []).map((d) => d.instance),
        loaded: Boolean(state.loaded),
    });
}

/**
 * ⛓ THE FOLD'S OWN STEPS → THE PAGE'S EDIT RECORDS. ⛔ `n` and `description`
 * come from the SAME walk that produced the record (`foldEdits`' `steps`,
 * added by this slice) — a second walk to collect the sentences would be two
 * walkers over one application path, which is what the core exists to prevent.
 */
const editRecordsOf = (steps) => Object.freeze((steps ?? []).map((st, i) => Object.freeze({
    n: i + 1, op: st.op, description: st.description,
})));

/**
 * ⛓ THE THREE FIELDS THE OP LIST DECIDES, written in ONE place.
 *
 * ⛔ `certification` (the verdict OBJECT, which the pane prints) is cleared
 * here rather than kept beside the tri-state: `certified === true` IS *the
 * oracle was asked about the record now on screen and said yes*, so a
 * certification surviving a `null` tri-state would be a display of an answer
 * about a level that has moved. ⚖ §3.8, and the tri-state stays the one home.
 */
const withEdits = (state, { record, steps, certified, certification = null }) => Object.freeze({
    ...state,
    record,
    edits: editRecordsOf(steps),
    certification: certified === true ? certification : null,
    certified,
});

/**
 * ⛓⛓⛓ ONE MANUAL EDIT — the palette's op, through `editCore.applyOne`.
 *
 * ⛔ **THE OP IS BUILT BY `MazeRoomEditor.opFor` AND APPLIED BY THE CORE.** The
 * editor's private selection (`selectedItemId`, `selectedObstacleId`) is spent
 * exactly where it always was; what changed is that the APPLICATION goes
 * through the same `applyOne` a group, a paste and a flood take, so a stroke
 * and a click are one code path and not two.
 *
 * ⛔ **AND IT UNCERTIFIES** (⚖ §3.8): `certification` and the tri-state go to
 * `null` on any edit that CHANGED something. An edit the editor refused
 * (`ok: false`) or one that changed nothing (`Tile already floor.`) leaves the
 * state exactly as it was — a refusal is not a modification, and marking the
 * level uncertified for a click that did nothing would be a readout claiming a
 * fact that did not happen.
 *
 * ⛔ **THE TEST IS "DID THE WORLD CHANGE", NOT WHAT THE EDITOR CALLED IT** —
 * ⚖ law (b), and `mazeEditAdapter`'s `equal` is `procgenMaze.worldsEqual`,
 * which is this function's own former test extracted rather than re-spelled.
 * `MazeRoomEditor._setTile` returns `ok('tile', 'Tile (3,3) already floor.')`
 * for a click that changed NOTHING, so a guard on `ok`/`type` counted it as a
 * manual edit: the count bumped, the certification dropped and the identity
 * line announced that the URL had stopped being a reproduction.
 *
 * @param {object} state  a `generateStep`/`applyDirective`/`loadPayload` state
 * @param {MazeRoomEditor} editor  the page's editor (its palette selection is
 *   UI state and lives with the UI)
 * @returns {{state: object, result: object}} the new state and the ADAPTER's
 *   own descriptor VERBATIM — the page prints `result.description` unchanged,
 *   because the refusal is the evidence channel.
 */
export function applyEdit(state, editor, tx, ty) {
    if (!(editor instanceof MazeRoomEditor)) {
        fail('mazeLab: applyEdit needs a MazeRoomEditor — the palette selection is the '
            + 'page\'s, and a second editor would be a second answer to "what does a click '
            + 'do".');
    }
    const op = editor.opFor(tx, ty);
    if (!op) {
        return {
            state,
            result: { ok: false, description: `Unknown palette type ${editor.selectedType}.` },
        };
    }
    return applyEditOpToState(state, op);
}

/**
 * ⛓⛓ **ONE OP — ATOMIC OR A `group` — ON A STATE.** The palette press above and
 * the DOM arm's stroke / paste / flood all land here, so the "did it change"
 * question and the certification law are asked once.
 */
export function applyEditOpToState(state, op) {
    const res = applyOne(mazeEditAdapter, state.record, op);
    if (!res.ok || worldsEqual(state.record, res.record)) {
        return { state, result: res };
    }
    const edits = [...(state.edits ?? []).map((e) => e.op), res.op ?? op];
    const out = foldEdits(mazeEditAdapter, state.baseRecord ?? state.record, edits);
    return { state: withEdits(state, { ...out, certified: null }), result: res };
}

/**
 * ⛓⛓⛓ **REPLAY A PAYLOAD'S EDITS** — `editCore.foldEdits`, and nothing else.
 *
 * ⛔ THE FOLD IS THE CORE'S: `?gen=` of an EDITED payload reproduces it byte for
 * byte and `agreementWithPayload` can say so. That is the second half of ⚖
 * ruling 9 — the payload IS the identity of an edited level, and a channel that
 * could only carry it one way was half a promise.
 *
 * ⚠ **AN EDIT RECORDED BEFORE THE OP SHAPE EXISTED REFUSES BY NAME.** A payload
 * from constructive slice 12 carries `{n, type, at, palette, description}` —
 * there is no op in it, and guessing one from `palette` is exactly the
 * different-body-at-the-right-cell defect the op shape exists to end. The
 * refusal names LOAD, which takes such a level as it stands.
 *
 * ⚠ AND A REFUSED OP IS A THROW, not a skip: a fold that silently dropped an
 * edit would report a level difference whose real cause is three lines further
 * up. ⛓ The core throws that refusal; this function re-states it in the page's
 * own words so a reader of a `?gen=` failure is told which channel refused.
 */
export function applyEdits(state, edits) {
    (edits ?? []).forEach((edit, i) => {
        if (!editOpOf(edit)) {
            fail(`mazeLab: edit #${i + 1} of this payload carries no \`op\` — it is a `
                + 'DESCRIPTION recorded before maze edits had an op shape (constructive slice '
                + '12), and a fold that guessed one from its `palette` would place a DIFFERENT '
                + 'BODY at the right cell. Use LOAD, which takes the payload\'s `level` as it '
                + 'stands.');
        }
    });
    const ops = [...(state.edits ?? []).map((e) => e.op), ...(edits ?? []).map(editOpOf)];
    let out;
    try {
        out = foldEdits(mazeEditAdapter, state.baseRecord ?? state.record, ops);
    } catch (e) {
        fail(`mazeLab: a recorded edit was REFUSED on replay — ${e.message}`);
    }
    return withEdits(state, { ...out, certified: null });
}

/**
 * ⛓ AN EDIT ENTRY'S OP, whichever of the two envelopes it arrived in.
 *
 * ⛔ A payload written by this build carries `{n, op, description}` and `op` is
 * the closed op; a payload written by arc 2 slice 4 carries the same envelope
 * with a `type`; a payload from constructive slice 12 carries a DESCRIPTION and
 * has no op at all, which is the one case that must refuse. ⚠ `null` here is
 * the REFUSAL's trigger and never a silent skip.
 */
const editOpOf = (edit) => (edit && typeof edit.op === 'object' && edit.op ? edit.op : null);

/**
 * ⛓⛓⛓ **UNDO IS THE FOLD OVER A SHORTER LIST** — ⚖ law (a). ⛔ Not a stack pop:
 * the record after an undo is the record a page that never had that edit would
 * hold, byte for byte, and a stack can only promise that if nothing but an edit
 * ever wrote the record — which is false here (a rung, a directive and a LOAD
 * all write it).
 *
 * ⚠ A GROUP IS ONE ENTRY, so undoing a stroke, a paste or a flood removes the
 * whole thing. ⚠ At ZERO edits it returns the state unchanged, so a page can
 * call it unconditionally and a readout cannot claim an undo that did not
 * happen. Uncertified stays uncertified — the oracle has still not been asked
 * about the world now on screen.
 */
export function undoEdit(state) {
    const edits = state.edits ?? [];
    if (edits.length === 0) return state;
    const out = foldEdits(mazeEditAdapter, state.baseRecord ?? state.record,
        edits.slice(0, -1).map((e) => e.op));
    return withEdits(state, { ...out, certified: null });
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE SESSION — WHAT THE DOM ARM MOUNTS `editorView` ON
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **OPEN A SESSION ON A STATE.** The session owns the op list and the
 * tri-state for as long as a person is editing; `projectSession` is what puts
 * its answers back on the state for the readouts.
 *
 * ⛔ IT IS OPENED ON `baseRecord`, NOT ON `record` — the fold has to start where
 * the edits started, or the first undo would land on a level that already had
 * them. ⚠ A state's existing edits are replayed in, so entering EDIT twice in
 * one page life does not lose the first visit's work.
 */
export function openEditSession(state) {
    const session = createEditSession(mazeEditAdapter, state.baseRecord ?? state.record, {
        base: editBaseTag(state),
        certified: state.certified ?? null,
    });
    for (const edit of state.edits ?? []) {
        const res = session.apply(edit.op);
        if (!res.ok) {
            fail(`mazeLab: this state's own edit #${edit.n} was REFUSED when the session `
                + `re-folded it — ${res.description} ⛔ That is a base/ops disagreement, not `
                + 'a user error: the state carries edits its own `baseRecord` cannot take.');
        }
    }
    /** ⛓ The tri-state is re-stated AFTER the replay: every applied op puts it
     *  back to `null` by law, and a state that arrived CERTIFIED (a generated
     *  rung with no edits) must keep saying so. */
    session.setCertified(state.certified ?? null);
    return session;
}

/**
 * ⛓⛓⛓ **THE ONE WRITER OF `record`, `edits` AND `certified` ON THE PAGE.**
 *
 * ⛔ While a session is open it is the HOME for those three; the state's copies
 * are PROJECTIONS assembled here and written nowhere else. Two writers is
 * exactly the failure this arc has been spending its budget avoiding — a page
 * that edited `state.record` beside a session would show one level and fold
 * another.
 */
export function projectSession(state, session) {
    const ops = session.ops();
    const out = foldEdits(mazeEditAdapter, state.baseRecord ?? state.record, ops);
    return withEdits(state, {
        ...out,
        certified: session.certified,
        certification: state.certification,
    });
}

/**
 * ⛓⛓ **THE ORACLE'S ANSWER, INTO THE SESSION** — ⚖ §3.8's law with ONE home.
 * `certify` computes the verdict (it is a pure question about a record);
 * `session.setCertified` is where the page's answer LIVES, and this is the only
 * bridge between them, which is what keeps `false` reachable in exactly one
 * place.
 */
export function certifyInto(state, session) {
    const answered = certify(state);
    session.setCertified(answered.certified);
    return projectSession(answered, session);
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
        /**
         * ⛓⛓ SLICE 12 — **THE ONLY PLACE `false` IS REACHABLE ON THIS PAGE.**
         * The oracle was ASKED about the record on screen and answered; a
         * REFUSED verdict is a NO, which is a different fact from the `null`
         * an edit leaves and is what the tri-state exists to keep apart.
         */
        certified: solved.verdict === 'SOLVED',
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
/**
 * ⛓⛓⛓ **THE SOLVE, FRAME BY FRAME** — arc-2 §10.11.4 / ⚖ design ruling 6 fn. 3
 * (*"step-through visualisation is non-negotiable"*), and the mechanism this
 * arc exists for is only visible in it: **A BLOCK MOVES.** A static plan line
 * over the room shows where the player walked; it cannot show that the walk
 * PUSHED something, and the whole reverse-pull gadget is a claim about pushing.
 *
 * ⛔ **IT REPLAYS THROUGH THE ENGINE'S OWN `step`, from `createState`** — the
 * same construction the oracle used, and for `planCells`' reason one order of
 * magnitude louder now that there are blocks: a page-side "apply the direction
 * letters to a coordinate" would be a SECOND movement model, and the first
 * thing it would get wrong is which cell a push vacates.
 *
 * ⚠ It returns `null` for a plan that does not replay, exactly as `planCells`
 * does: the oracle's own replay throws a SEAM DEFECT in that case and an
 * animation is not the place to discover one.
 *
 * @returns {Array<{player:{x,y}, blocks:string[]|null, inventory:string[]}>|null}
 *   one frame per position ALONG the plan, `plan.length + 1` of them (frame 0
 *   is the start). `blocks` is `state.blocks` VERBATIM — the engine's sorted
 *   posKey array — or `null` on a world that has none (⚖ ruling 5: absence, not
 *   emptiness, is the switch, and this projection keeps it).
 */
export function planFrames(state, solved) {
    if (!solved?.plan?.length) return null;
    let s = createState(state.record);
    for (const id of state.palette?.items ?? []) s.inventory.add(id);
    const frameOf = (t) => Object.freeze({
        player: Object.freeze({ x: t.player_pos.x, y: t.player_pos.y }),
        blocks: t.blocks === undefined ? null : Object.freeze([...t.blocks]),
        inventory: Object.freeze([...t.inventory].sort()),
    });
    const frames = [frameOf(s)];
    for (const input of solved.plan) {
        const next = step(state.record, s, input);
        if (!next) return null;
        s = next;
        frames.push(frameOf(s));
    }
    return Object.freeze(frames);
}

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
        /**
         * ⛓ SLICE 3 — the AREA SPEC and the DIRECTIVE, beside the skeleton's
         * block and on the same terms: written UNCONDITIONALLY, because a
         * payload's identity must not depend on which fields happened to be at
         * their default (`agreementWithPayload` normalizes both sides, so a
         * payload written before this slice still AGREES).
         */
        areas: state.areas ?? DEFAULT_AREAS,
        /**
         * ⛓ ARC 2 SLICE 4 — THE ELEMENT SPEC, on the same terms as `areas`.
         * ⚠ AND IT IS THE **SPEC**, NOT `elementSummaryOf`'s block: this payload
         * is a REPRODUCTION RECIPE (what the page will re-run from), and what
         * the run PRODUCED is on the level itself — the block, the button and
         * the door are entities in `level`, so a summary here would be a second
         * copy of facts the grid already states. ⛓ `elementSpecOf` is what lets
         * a CLI payload — whose `elements` IS the summary — be read back all the
         * same.
         */
        elements: state.elements ?? DEFAULT_ELEMENTS,
        require: state.require ?? null,
        /**
         * ⛓⛓ EDITOR v3 SLICE A2 — **THE IDENTITY TAG THE EDITS ARE EDITS OF**
         * (§3.2's `base`, carried opaquely by `editCore`). ⛔ It is written
         * UNCONDITIONALLY and is NOT compared by `agreementWithPayload`: it
         * restates fields the payload already carries one by one, so a
         * comparison of it would report one divergence twice.
         */
        base: editBaseTag(state),
        /**
         * ⛓ SLICE A2 — the edits are `{n, op, description}` and `op` is
         * `editCore`'s: a STROKE, a PASTE or a FLOOD is ONE entry whose `op` is
         * a `group` carrying its members. ⛔ That is what makes the count in the
         * identity line a count of UNDOS.
         */
        edits: state.edits ?? [],
        /**
         * ⛓ SLICE 12 — THE TRI-STATE TRAVELS, in Seedling's spelling. ⚠ It is
         * NOT compared by `agreementWithPayload` (a file's certification is
         * somebody else's assertion), so an old payload carrying `false` where
         * this build writes `null` still AGREES.
         */
        certified: state.certified ?? null,
        summary: state.summary,
        level: serializeMazeLevel(state.record),
        trace: state.trace ?? [],
    };
}

/**
 * ⛓ NORMALIZE A PAYLOAD'S AREA SPEC WITHOUT VALIDATING IT — §14.7's lesson,
 * applied to the second spec this page compares. A file naming a value this
 * build no longer declares must be REPORTED as a difference, not thrown at.
 */
function safeAreaSpec(spec) {
    try {
        return normalizeAreaSpec(spec);
    } catch {
        return spec;
    }
}

/**
 * ⛓ THE SAME LESSON FOR THE ELEMENT SPEC, and it has one extra job. `?gen=`
 * accepts payloads from BOTH writers, and the two carry different shapes under
 * the key `elements`: this page writes the SPEC (`{name, params}`) and
 * `generate-maze-level.mjs --json` writes `elementSummaryOf`'s block
 * (`{spec, ran, placed, refused}`). `elementSpecOf` reads the spec out of
 * either, so a CLI payload REPRODUCES here instead of dying on its own report.
 *
 * ⚠ ARC 1's `areas` BLOCK HAS THE SAME ASYMMETRY AND IS **NOT** FIXED HERE: its
 * payloads are byte-gated by this arc, and `normalizeAreaSpec` happens to
 * swallow the CLI shape as `{keys: 0}` rather than throwing, so the divergence
 * is REPORTED rather than fatal. Named as residue, not smoothed over.
 */
function safeElementSpec(spec) {
    try {
        return normalizeElementSpec(elementSpecOf(spec));
    } catch {
        return spec;
    }
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
    /**
     * ⛓⛓⛓ SLICE 12 ASKED THIS AND HAD TO REFUSE AN EDITED PAYLOAD; **ARC 2
     * SLICE 4 STOPS REFUSING**, because the reason has been removed rather than
     * argued away.
     *
     * DIRECTIVES were already reproduced here (the caller replays
     * `payload.directives` through `generateWithDirectives` before comparing).
     * EDITS were refused because *"a maze edit is recorded as a DESCRIPTION, not
     * as an op carrying the item/obstacle id the editor had selected, so a fold
     * would place a different body at the right cell"* — ⇒ the edit record
     * became an OP (`mazeRoomEditor`'s § THE OPS), and the caller now folds
     * `payload.edits` through `applyEdits` before comparing.
     *
     * ⚠ A PAYLOAD WHOSE EDITS PREDATE THE OP SHAPE still cannot be reproduced,
     * and `applyEdits` says so BY NAME rather than this function guessing. LOAD
     * remains the way in for one, and it always was.
     */
    if ((payload.edits ?? []).some((e) => !editOpOf(e))) {
        return {
            checked: false,
            agrees: false,
            differences: [],
            why: `this payload carries ${payload.edits.length} MANUAL EDIT(S) recorded BEFORE `
                + 'maze edits had an op shape (constructive slice 12): they name a cell and a '
                + 'palette TYPE but not the item or obstacle id the editor had selected, so a '
                + 'fold would place a different body at the right cell. ⛓ Edits recorded by '
                + 'this build ARE replayed. Use LOAD, which takes `level` as it stands.',
        };
    }
    cmp('seed', payload.seed, state.seed);
    cmp('biome', payload.biome, state.biome);
    cmp('width', payload.width ?? MAZE_DEFAULTS.width, state.width);
    cmp('height', payload.height ?? MAZE_DEFAULTS.height, state.height);
    cmp('roster', payload.roster ?? null, state.roster ?? null);
    cmp('directives', payload.directives ?? [], state.directives ?? []);
    /**
     * ⛓⛓ SLICE 7 — NORMALIZED ON BOTH SIDES, and that is what makes the
     * both-sides default REAL rather than nominal. A payload written before the
     * kind parameters existed carries `{kind}`; a page at all-defaults produces
     * `{kind}` too, because `normalizeSkeleton` OMITS a value at its default.
     * ⛔ Without the normalization a page that had merely TOUCHED the form
     * would carry `{kind, params:{chambers:0}}` and report a divergence in a
     * field that says the same thing.
     *
     * ⛔⛔ AND THE PAYLOAD SIDE IS NORMALIZED **WITHOUT VALIDATION** — a defect
     * my own suite caught the first time this line was written. A payload
     * naming a RETIRED kind (`open-room`, `empty-bordered`) is precisely what
     * this comparison exists to REPORT BY NAME; a normalizer that refused it
     * turned the report into a throw, and the page would have died on the file
     * it was asked to explain.
     */
    cmp('skeleton', normalizeSkeleton(payload.skeleton ?? DEFAULT_SKELETON, { validate: false }),
        normalizeSkeleton(state.skeleton ?? DEFAULT_SKELETON));
    /**
     * ⛓ SLICE 3 — NORMALIZED ON BOTH SIDES with the both-sides default, and
     * ⛔ the PAYLOAD side WITHOUT VALIDATION, for §14.7's measured reason: a
     * payload naming a value this build no longer declares is exactly what this
     * comparison exists to REPORT BY NAME, and a normalizer that refused it
     * would turn the report into a throw on the file it was asked to explain.
     */
    cmp('areas', safeAreaSpec(payload.areas ?? DEFAULT_AREAS),
        normalizeAreaSpec(state.areas ?? DEFAULT_AREAS));
    /** ⛓ ARC 2 SLICE 4 — normalized on BOTH sides with the both-sides default,
     *  the payload side UNVALIDATED, so a payload written before elements
     *  existed AGREES rather than diverging on a field it could not have had. */
    cmp('elements', safeElementSpec(payload.elements ?? DEFAULT_ELEMENTS),
        normalizeElementSpec(state.elements ?? DEFAULT_ELEMENTS));
    cmp('require', payload.require ?? null, state.require ?? null);
    /** ⛓ ARC 2 SLICE 4 — the EDIT LIST is compared now that it is replayable.
     *  ⛔ On the OPS, not on the descriptions: a description is prose the editor
     *  chose and comparing it would report a wording change as a divergence. */
    cmp('edits', (payload.edits ?? []).map((e) => e.op),
        (state.edits ?? []).map((e) => e.op));
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
        /** ⛓ SLICE A2 — a LOADED level IS its own base; see the `edits` note. */
        baseRecord: world,
        trace: payload?.trace ?? [],
        summary: payload?.summary ?? null,
        keptTemplates: [],
        directives: payload?.directives ?? [],
        /**
         * ⛓⛓⛓ EDITOR v3 SLICE A2 — **A LOADED LEVEL HAS NO EDIT LIST, AND THAT
         * IS THE HONEST STATE.** ⛔ It used to carry `payload.edits`, which was
         * a REPORT of a construction this page did not perform: `record` is the
         * payload's FINAL level, edits already baked in, so `baseRecord` is that
         * same level and folding the list again would apply every edit TWICE.
         * ⚖ Law (a) has no room for a third thing: either the ops fold from the
         * base or they are not this state's ops.
         *
         * ⚠ Nothing is lost — the level IS the edited level, `describeState`
         * says so through the `loaded` clause, and `?gen=` (which replays the
         * ops from the LADDER) is the channel that reproduces one.
         */
        edits: [],
        skeleton: payload?.skeleton ?? DEFAULT_SKELETON,
        /**
         * ⛓ SLICE 3 — a LOADED level says which graph produced it, and ⛔
         * nothing is re-derived: the model above is built at the OPEN room and
         * without areas (its `skeleton()` is never called), so these two fields
         * are the payload's own report and the overlay has nothing to draw.
         */
        areas: payload?.areas ?? DEFAULT_AREAS,
        /** ⛓ ARC 2 SLICE 4 — a LOADED level SAYS which element spec produced
         *  it, and ⛔ nothing is re-derived: the model above is built at the
         *  open room with no elements, so the overlay has no gadget to draw and
         *  the level's own blocks/buttons (which `deserializeMazeLevel` DID
         *  restore) are all a reader gets. That is the honest state of a loaded
         *  file, and it is why LOAD is not a reproduction. */
        elements: safeElementSpec(payload?.elements ?? DEFAULT_ELEMENTS),
        require: payload?.require ?? null,
        requireResult: null,
        stop: null,
        saturated: false,
        bounds: { ...DEFAULT_BOUNDS, ...(payload?.bounds ?? {}) },
        budget: assertMazeBudget(payload?.budget ?? DEFAULT_MAZE_BUDGET),
        certification: null,
        /** ⛓ SLICE 12 — a LOADED level is UNCERTIFIED because NOBODY HAS ASKED:
         *  the file's own `certified` is somebody else's assertion, and this
         *  page's answer is its own oracle's or none. */
        certified: null,
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
    /**
     * ⛓⛓ EDITOR v3 SLICE A2 — **THE COUNT IS OF UNDOS, AND THE GROUPS RIDE IN
     * A PARENTHESIS.** `editCore.describeOps` is the one formatter for it, so
     * this line and the EDIT pane's note cannot disagree about what "3 edits"
     * means when one of them is a 12-cell stroke. ⛔ The head keeps the word
     * "manual" this page has always used — it is what distinguishes an edit
     * from a DIRECTED attempt in the same sentence.
     */
    const editText = describeOps((state.edits ?? []).map((e) => e.op))
        .replace(' edit(s)', ' manual edit(s)');
    const directives = (state.directives ?? []).length;
    /**
     * ⛓ SLICE 5 — THE SKELETON KIND, NAMED ONLY WHEN IT IS NOT THE OPEN ROOM.
     * ⛔ A clause printed on every level would train a reader to skip it, and
     * the one time it matters is the one time it is there — the same rule the
     * "the URL is NOT a reproduction" clause below already follows.
     */
    const kind = state.skeleton?.kind ?? DEFAULT_SKELETON_KIND;
    /**
     * ⛓⛓ SLICE 7 — AND ITS PARAMETERS, in the URL's own spelling
     * (`rooms;minRoom=2;chambers=1`). ONE formatter for the line, the bar and
     * the CLI; a value at its default is not named, for the same reason
     * `empty` is not.
     */
    const skelText = formatSkeleton(state.skeleton ?? DEFAULT_SKELETON);
    /**
     * ⛓⛓ SLICE 3 — THE AREA SPEC AND THE DIRECTIVE, named only when they are
     * not the default, in the URL's own spelling and through the SAME
     * formatters. ⛔ A clause on every level trains a reader to skip it.
     */
    const areaText = formatAreaSpec(state.areas ?? DEFAULT_AREAS);
    const requireText = formatRequireList(state.require);
    /** ⛓ ARC 2 SLICE 4 — the element, in the URL's own spelling and through the
     *  SAME formatter, named only when one was asked for. */
    const elementText = formatElementSpec(state.elements ?? DEFAULT_ELEMENTS);
    const bits = [
        `seed ${state.seed} · ${state.biome} · ${state.width}x${state.height} · step ${state.step}`
            + (skelText === DEFAULT_SKELETON_KIND
                ? '' : ` · skeleton: ${skelText} (CARVED, not the open room)`)
            + (areaText === '0' ? '' : ` · areas: ${areaText}`)
            + (elementText === DEFAULT_ELEMENTS.name ? '' : ` · elements: ${elementText}`)
            + (requireText === '' ? '' : ` · requires: ${requireText}`)
            + (directives ? `, then ${directives} directed attempt(s)` : '')
            + (edits ? `, then ${editText}` : '')
            + (state.loaded ? ' · LOADED from a payload' : ''),
        /**
         * ⛓⛓⛓ ARC 5, SLICE 6b — **THE DENSITY IDENTITY BLOCK** (§3.6), the same
         * six levers the Seedling page prints and through the SAME function
         * (`procgenCore/densityBlock.js`). ⛔ `fill` is `dense` here and it is a
         * statement rather than a placeholder: the maze writes its grid whole
         * and has no fill knob, so `dense` is what this substrate IS.
         *
         * ⛔ IT READS: the room is the RECORD's own `width`/`height`, the
         * element is the spec the model RESOLVED. Nothing is recomputed from
         * the finished level.
         */
        densityLine({
            skeleton: state.skeleton ?? DEFAULT_SKELETON,
            width: state.record?.width ?? state.width,
            height: state.record?.height ?? state.height,
            fill: 'dense',
            element: state.model?.elements?.spec ?? state.elements ?? DEFAULT_ELEMENTS,
            obstacleTarget: state.bounds.obstacleTarget,
        }),
        `palette: ${state.palette?.name ?? '(none)'}`
            + (state.roster ? '' : ' (the WHOLE roster — no restriction)'),
        s ? `kept ${s.keptCount}/${state.bounds.obstacleTarget} over ${s.attempts} attempt(s)`
            : `the SKELETON — ${kind === DEFAULT_SKELETON_KIND
                ? 'the open room' : `a ${skelText} CARVE`} and its goal, before any template`,
        `bounds: target=${state.bounds.obstacleTarget} tries=${state.bounds.triesPerStep} `
            + `k=${state.bounds.saturationK} `
            + `anchortries=${state.bounds.anchorTriesPerCandidate}`,
        `budget: ${state.budget.maxExpansions} BFS expansions (⛓ NODES, not ms)`,
        state.certification
            ? `CERTIFIED — the oracle walked ${state.certification.steps} step(s) to the goal`
            : 'UNCERTIFIED — nothing has solved the world now on screen',
    ];
    /**
     * ⛓⛓⛓ THE AREA GRAPH'S OWN SENTENCE — what it DID, or the module's own
     * REFUSAL. ⛔ Verbatim: the binding's reason is the evidence channel and
     * this line may print it, never rewrite it.
     */
    const info = state.model?.areas ?? null;
    if (info && info.spec.keys > 0) {
        bits.push(info.ran
            ? `areas: ${info.partitionSummary.areaCount} area(s), `
                + `${info.graph.symbols.length} symbol(s) [${info.graph.symbols.join(', ')}], `
                + `${info.doors.length} door(s), ${info.keys.length} key(s)`
            : `⛔ the area graph REFUSED: ${info.refused.reason}`);
    }
    /**
     * ⛓⛓⛓ THE GADGET'S OWN SENTENCE — what it PLACED, or the binding's own
     * REFUSAL, VERBATIM. ⛔ §10.11.5: `guard;len=3;turns=1` at 15x15 places on
     * about 38% of seeds and GUARDS on about 7%, so a page that only spoke when
     * it succeeded would be silent exactly when a reader most needs to know
     * why. The refusal is the evidence channel and this line may print it,
     * never rewrite it.
     */
    const eInfo = state.model?.elements ?? null;
    if (eInfo && eInfo.spec?.name !== DEFAULT_ELEMENTS.name) {
        const p = eInfo.placed?.[0] ?? null;
        bits.push(eInfo.ran
            ? `elements: ${p.instance} at (${p.site.x},${p.site.y}) ${p.site.w}x${p.site.h}, `
                + `${p.tunnel.length} tunnel cell(s), ${p.cost.cells} carved, `
                + (p.guards ? `GUARDS ${p.guards}` : 'guards NOTHING (⚠ ⚖ ruling 1 vacuous '
                    + 'on this seed — the graph gave its symbol to another area)')
            : `⛔ the element REFUSED: ${eInfo.refused.reason}`);
    }
    if (state.requireResult) {
        const r = state.requireResult;
        bits.push(r.refused
            ? `⛔ require ${formatRequireList(r.asked)} REFUSED: ${r.refused.reason}`
            : `require ${formatRequireList(r.asked)} MET — `
                + r.met.map((m) => `${m.symbol} ${m.grade} (the goal is ${m.planWith} step(s) `
                    + 'away WITH the key and UNREACHABLE without it)').join('; '));
    }
    /**
     * ⛓⛓ SLICE 12 WIDENED THE CONDITION AND KEPT THE SENTENCE (⚖ §3.9). The bar
     * stopped carrying `?directed=` too, so from the first directed attempt
     * onward it names the LADDER alone — the same claim, one clause earlier —
     * and the wording dropped "after edits" because either leg can now be the
     * missing one. ⛔ One wording across the two substrates — `watchGenerate`'s
     * `describeState` prints the same sentence, each page naming its own
     * download affordance in the parenthesis.
     */
    /**
     * ⛓⛓ SLICE 12 WIDENED THE CONDITION AND KEPT THE SENTENCE (⚖ §3.9); ⛓ SLICE
     * A2 widens it once more, to a LOADED level. ⛔ It has to: `loadPayload`
     * takes a level AS IT STANDS, so the address bar names a ladder that never
     * produced what is on screen — which is exactly the fact this clause
     * exists to state, and the one case where it used to be silent was the
     * case where the level came from somebody else's file.
     */
    if (directives || edits || state.loaded) {
        bits.push('⚠ the URL is NOT a reproduction of this construction — it names the '
            + 'LADDER alone; the PAYLOAD is (download / the save box)');
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
