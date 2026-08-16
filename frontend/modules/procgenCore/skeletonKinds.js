/**
 * procgenCore/skeletonKinds — **THE ONE SKELETON VOCABULARY, FOR BOTH
 * SUBSTRATES.**
 *
 * CONSTRUCTIVE-MODE arc, slice 5 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.3, ⚖ ruling 2: *"reuse the maze algorithms, and keep the
 * naming consistent — the constructive skeleton kinds ARE the maze biome
 * names, one vocabulary across substrates"*).
 *
 * ── ⛓⛓⛓ WHY THE TABLE MOVED HERE, IN ONE LINE ────────────────────────
 *
 * It used to live in `mazeRoom/mazeRoomBiomeLibrary.js`. `seedlingDemo/` must
 * not import `mazeRoom/` — a cross-substrate edge is exactly what the arc's
 * shared refactor spent slice 1 removing — and a RE-EXPORT from a neutral file
 * would not have helped, because a re-export still imports the file it
 * re-exports. So the TABLE moved and `mazeRoomBiomeLibrary.js` became the
 * re-export: every maze caller (`mazeRoomEngine.generateMaze`, `mazeRoomUI`,
 * `dump-maze-byteidentity.mjs`, the biome tests) keeps its import path and its
 * behaviour, and the maze's own biome tests stay green as the regression net
 * for the move.
 *
 * ── ⛔ TWO DEFAULTS, TWO DIFFERENT QUESTIONS — DO NOT COLLAPSE THEM ────
 *
 *   `DEFAULT_BIOME_ID` = `classic`  — what an AP REGION generates when
 *      `preset_sidecars[player][region].biome` says nothing. A maze fact,
 *      unchanged since the biome library shipped, and moving it would change
 *      every region nobody configured.
 *   `DEFAULT_SKELETON_KIND` = `empty` — what the CONSTRUCTIVE loop starts from
 *      when `?skeleton=` says nothing: the open room both bindings have always
 *      built. ⛓ It is what makes this slice ADDITIVE — at the default kind
 *      nothing here runs at all and the empty-room seed→level pairs cannot
 *      move.
 *
 * ── ⛔ WHICH KINDS A BINDING OFFERS IS **DECLARED**, NOT DERIVED ───────
 *
 * `corridor_only` and `random_walls` need the maze SIMULATOR (they solve as
 * they build), so they live in `mazeRoom/mazeAlgorithms/` and a grid-only
 * binding cannot run them. The table says so with `needs`. ⛔ It would have
 * been cheaper to derive the answer from the registry — "is the backend
 * registered?" — and that answer is INCIDENTAL: it is true or false depending
 * on who else imported what, so a Seedling page that happened to pull in
 * `randomWalls.js` for an unrelated reason would silently start offering a kind
 * it cannot honestly run. A declared `needs` is a fact about the backend.
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: both lab pages load this in a browser.
 */

import { getPostProcessor } from '../shared/procgen/mazeAlgorithms/postProcessors.js';
import { getBackend } from '../shared/procgen/mazeAlgorithms/registry.js';

/**
 * ── ⛓⛓ REGISTER-ON-IMPORT: **THE BINDING IMPORTS THE BACKENDS, NOT THIS
 *    FILE** — and a measurement is what decided that ────────────────────
 *
 * ⚖ Kickoff §5's trap: backends register themselves into the shared registry
 * when their files are imported. The obvious home for those three side-effect
 * imports is HERE, in the file that dispatches to them. ⛔ It was written that
 * way first and `dump-maze-byteidentity.mjs` caught it: the dump prints
 * `listBackends()` in REGISTRATION order as a canary, and importing the three
 * portable backends from a file `mazeRoomEngine` reaches through
 * `mazeRoomBiomeLibrary` made them register BEFORE `mazeRoom/mazeAlgorithms/
 * index.js`'s own three. Every one of the 768 cell rows was byte-identical and
 * the HEADER LINE moved — `empty,random_walls,corridor_only,recursive_*` became
 * `kruskals,recursive_*,empty,…` — which is precisely the fact
 * `mazeAlgorithms/index.js`'s docblock says "must not change".
 *
 * ⇒ each BINDING imports what it runs: `mazeRoom/procgenMaze.js` gets all six
 * through `mazeRoomEngine.js` as it always did, and `seedlingDemo/
 * procgenSeedling.js` imports the three portable ones itself. `carveSkeleton`
 * refuses BY NAME when a backend is missing, so a future binding that forgets
 * meets a sentence naming the import it owes rather than a silent fallback.
 */

export class SkeletonKindError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SkeletonKindError';
    }
}

const fail = (message) => { throw new SkeletonKindError(message); };

/** ⛓ What a binding without the maze simulator cannot run, said once. */
const NEEDS_SIMULATOR = 'the maze simulator — it solves the room as it builds it, so it '
    + 'runs only in the maze substrate';

/**
 * THE TABLE. Named bundles of (backend, params, post-processors), looked up by
 * id. ⛓ Two readers now: `generateMaze` (which region layout to build) and
 * `skeleton()` in both bindings (which room the constructive loop starts from).
 *
 * Adding a kind that uses an existing backend is a one-line change here; adding
 * a backend is a new file under `shared/procgen/mazeAlgorithms/` (portable) or
 * `mazeRoom/mazeAlgorithms/` (simulator-bound) plus an entry here.
 *
 * See docs/json/developer/procgen/maze.md ("Biomes and wall backends").
 */
export const BIOMES = Object.freeze({
    empty: Object.freeze({
        name: 'Empty',
        description: 'No walls — just entrance and exits. Showcases the topology layer.',
        backend: 'empty',
        /**
         * ⛓⛓ THE OPEN ROOM IS NOT CARVED, IT IS **LEFT ALONE** — and that is
         * why this slice cannot move an existing seed→level pair. Both
         * bindings short-circuit on this kind and never reach `carveSkeleton`,
         * so no backend runs, no draw is spent, and `skeleton()` returns
         * exactly the record it returned before the kinds existed. (Running the
         * `empty` BACKEND would have been equivalent for the maze — it writes
         * nothing — and wrong for Seedling, whose open room has a wall ring the
         * grid contract knows nothing about.)
         */
        carves: false,
    }),
    classic: Object.freeze({
        name: 'Classic',
        description: 'Uniform random wall proposals with a feasibility check. The original v1 generator.',
        backend: 'random_walls',
        needs: NEEDS_SIMULATOR,
    }),
    corridor: Object.freeze({
        name: 'Corridor',
        description: 'Shortest path from entrance to each exit; everything else is wall.',
        backend: 'corridor_only',
        needs: NEEDS_SIMULATOR,
    }),
    branchy: Object.freeze({
        name: 'Branchy',
        description: 'Recursive backtracker with newest-cell picker — long winding corridors with deep dead ends.',
        backend: 'recursive_backtracker',
        params: Object.freeze({ picker: 'newest' }),
    }),
    bushy: Object.freeze({
        name: 'Bushy',
        description: 'Recursive backtracker with random picker — bushier, Prim\'s-like with shorter branches.',
        backend: 'recursive_backtracker',
        params: Object.freeze({ picker: 'random' }),
    }),
    loopy: Object.freeze({
        name: 'Loopy',
        description: 'Kruskal\'s spanning tree with 50% braid — perfect maze with some loops mixed in.',
        backend: 'kruskals',
        postProcessors: Object.freeze([
            Object.freeze({ id: 'braid', params: Object.freeze({ p: 0.5 }) }),
        ]),
    }),
    open: Object.freeze({
        name: 'Open',
        description: 'Kruskal\'s spanning tree with full braid — every dead end removed, loops everywhere.',
        backend: 'kruskals',
        postProcessors: Object.freeze([
            Object.freeze({ id: 'braid', params: Object.freeze({ p: 1.0 }) }),
        ]),
    }),
    rooms: Object.freeze({
        name: 'Rooms',
        description: 'Recursive division — partitions the region into chambers connected by single-tile gaps.',
        backend: 'recursive_division',
        params: Object.freeze({ minRoom: 3 }),
    }),
    /**
     * ⛓⛓⛓ SLICE 5's ONE NEW KIND — **CLOUDBERRY'S PASS 1**, and the only
     * entry in this table that was added for the constructive mode rather than
     * inherited from the region generator.
     *
     * A perfect maze (recursive backtracker, `newest` picker — the longest
     * corridors of the two) with EVERY dead end filled back in. What survives
     * is the unique entrance→exit path and nothing else: a single winding
     * corridor, which is exactly the ⚖ 2026-08-14 wording *"construct a path …
     * starting from a map filled with walls"*.
     *
     * ⛔ IT IS **NOT** A RENAME OF `corridor`, and the two must not be
     * collapsed. `corridor` is the BFS SHORTEST path (`corridor_only`, maze-only
     * because it needs the simulator) — the least interesting route to the
     * goal. This is the spanning tree's own route, which wanders. Two
     * constructions, two names.
     *
     * ⛓ THE THRESHOLD, MEASURED RATHER THAN TUNED: `pruneDeadEnds` iterates
     * `while (changed)` and re-lists the dead ends every pass, so it runs to a
     * FIXED POINT — no non-protected floor tile is left with one floor
     * neighbour — for ANY threshold >= 1, and the residue is identical at 1, 2
     * and 9999 (driven in `skeletonKinds.test.js`). The number is large
     * anyway, because it states the INTENT (*fill every dead end, however long
     * the stub*) rather than a tuned depth, and because on a BRAIDED input —
     * which this kind is not, but a future one might be — the per-pass depth
     * would stop mattering only up to the first junction.
     */
    winding: Object.freeze({
        name: 'Winding',
        description: 'Recursive backtracker with every dead end filled — one winding corridor '
            + 'from the entrance to the goal, and wall everywhere else. Cloudberry\'s pass 1.',
        backend: 'recursive_backtracker',
        params: Object.freeze({ picker: 'newest' }),
        postProcessors: Object.freeze([
            Object.freeze({ id: 'pruneDeadEnds', params: Object.freeze({ threshold: 9999 }) }),
        ]),
    }),
});

/** ⛓ The same table under the name the constructive mode reads it by. */
export const SKELETON_KINDS = BIOMES;

/** ⛔ THE MAZE REGION DEFAULT — see the file docblock. Not the kind default. */
export const DEFAULT_BIOME_ID = 'classic';

/** ⛔ THE CONSTRUCTIVE DEFAULT — the open room. See the file docblock. */
export const DEFAULT_SKELETON_KIND = 'empty';

/** The skeleton block every state and every payload carries. */
export const DEFAULT_SKELETON = Object.freeze({ kind: DEFAULT_SKELETON_KIND });

export const KIND_IDS = Object.freeze(Object.keys(BIOMES));

/**
 * Resolve a biome reference to its definition + merged params.
 *
 * Input:
 *   `null` / `undefined`         → DEFAULT_BIOME_ID with no overrides
 *   `{ id }`                     → that biome with no overrides
 *   `{ id, paramsOverride }`     → that biome with per-key overrides
 *                                   on top of biome.params
 *
 * Output:
 *   { id, biome, params }
 *
 * Throws if `id` doesn't match a known biome — unknown biomes should
 * never reach the substrate, and silently swapping in the default
 * would mask bugs in the rules-export side.
 */
export function resolveBiome(input) {
    const id = input?.id ?? DEFAULT_BIOME_ID;
    const biome = BIOMES[id];
    if (!biome) {
        const known = Object.keys(BIOMES).join(', ');
        throw new Error(`resolveBiome: unknown biome id '${id}' (known: ${known})`);
    }
    return {
        id,
        biome,
        params: { ...(biome.params ?? {}), ...(input?.paramsOverride ?? {}) },
    };
}

/**
 * The kind ids a binding OFFERS. ⛔ Declared, not derived — see the file
 * docblock.
 *
 * @param {object} o
 * @param {boolean} o.simulator does this binding have the maze simulator?
 */
export function kindsOffered({ simulator = false } = {}) {
    return KIND_IDS.filter((id) => simulator || !BIOMES[id].needs);
}

/**
 * ⛓⛓ THE SKELETONS SECTION OF THE CATALOGUE — ⚖ ruling 1's *"a list of things
 * that can be generated"*, applied to the ROOM rather than to the templates.
 *
 * ⛔ IT IS **NOT** IN THE ROSTER, and that is a decision rather than a layout
 * choice. The roster is what a RUN MAY DRAW FROM — a set the loop samples, with
 * a checkbox per member and a `?families=`/`?templates=` spelling. A kind is
 * the room the run starts IN: exactly one is in force, it is chosen not
 * sampled, and it is spelled by its own parameter. Putting kinds in the roster
 * would give them checkboxes that mean something the loop never asks.
 *
 * ⚠ A kind this binding cannot run is listed with `offered: false` AND ITS
 * REASON, rather than hidden: a catalogue that showed only what is available
 * cannot answer *"why can't I pick that?"*, which is the same argument the
 * template catalogue's greyed exclusion rows already make.
 *
 * @param {boolean} simulator does the reading binding have the maze simulator?
 */
export function skeletonCatalogue({ simulator = false } = {}) {
    return Object.entries(SKELETON_KINDS).map(([kind, entry]) => ({
        kind,
        name: entry.name,
        description: entry.description,
        backend: entry.backend,
        postProcessors: (entry.postProcessors ?? []).map((pp) => pp.id),
        isDefault: kind === DEFAULT_SKELETON_KIND,
        offered: Boolean(simulator || !entry.needs),
        why: entry.needs ?? null,
    }));
}

/**
 * ⛓⛓ THE ONE REFUSAL, AND IT NAMES WHAT WAS ON OFFER.
 *
 * Two different mistakes get two different sentences: a kind nobody has ever
 * defined, and a kind this SUBSTRATE cannot run. A reader who typed
 * `?skeleton=corridor` into the Seedling page's address bar has no other
 * channel to learn which of the two they hit.
 *
 * @param {string} kind
 * @param {object} o
 * @param {boolean} o.simulator  see `kindsOffered`
 * @param {string} o.substrate   the name the refusal calls this binding
 * @returns {string} the kind, unchanged, when it is offered
 */
export function assertKind(kind, { simulator = false, substrate = 'this substrate' } = {}) {
    const entry = BIOMES[kind];
    if (!entry) {
        fail(`skeletonKinds: ${JSON.stringify(kind)} is not a skeleton kind. The vocabulary is `
            + `[${KIND_IDS.join(', ')}] — one set of names across both substrates (⚖ ruling 2), `
            + 'so a kind that exists anywhere is spelled the same way everywhere.');
    }
    if (entry.needs && !simulator) {
        fail(`skeletonKinds: the skeleton kind ${JSON.stringify(kind)} needs ${entry.needs}. `
            + `${substrate} offers [${kindsOffered({ simulator }).join(', ')}]. ⛔ It REFUSES `
            + 'rather than falling back to the open room: a run that silently built a '
            + 'different room than the one its link names would report a level nobody asked '
            + 'for under an address that names one.');
    }
    return kind;
}

/**
 * ⛓⛓⛓ THE CARVE — ONE runner, TWO bindings, and the ORDER **IS** the
 * identity.
 *
 * The backend first, then each post-processor in the table's order, all on ONE
 * rng — the model's ROOM stream. ⛔ Both bindings draw the GOAL CELL from that
 * stream BEFORE calling this, which is what makes the goal of seed s under kind
 * K the goal of seed s under `empty` (⚖ kickoff §3.4, and `skeletonKinds.test.js`
 * / `procgenSeedling.test.js` drive it). A carve that drew first would move
 * every goal and expire the empty-room pairs for nothing.
 *
 * ⛔ NO CONNECTIVITY SAFETY NET HERE, deliberately, and each kind's reason is
 * its own: the two tree backends are connected BY CONSTRUCTION and carve the
 * entrance/exit in themselves (`connectFixedTiles`); `recursive_division` calls
 * `repairConnectivity` inside its own `run`; `braid` and `pruneDeadEnds` only
 * ever open or fill DEAD ENDS, and a tile with one floor neighbour is never on
 * a path between two protected tiles. `generateMaze`'s own fallback net exists
 * for the REGION path and re-runs `random_walls`, which a Seedling binding
 * cannot do — so the honest net here is the LOOP's: `generateLevel` refuses to
 * start when the skeleton does not solve, by name, with the oracle's own text.
 *
 * @param {string} kind   an id `assertKind` accepted
 * @param {object} world  a `gridTiles.js` grid — `{width, height, tiles:
 *   Int8Array, entrance:{x,y}, exits: Map of {x,y}}`. MUTATED in place, which
 *   is the grid contract the backends were written against.
 * @param {object} rng    `{next(): [0,1)}` — the model's room stream
 * @returns {{kind, backend, backendStats, postProcessors: string[]}}
 */
export function carveSkeleton(kind, world, rng) {
    const entry = BIOMES[kind];
    if (!entry) fail(`skeletonKinds: carveSkeleton was given unknown kind ${JSON.stringify(kind)}.`);
    if (entry.carves === false) {
        fail(`skeletonKinds: the kind ${JSON.stringify(kind)} CARVES NOTHING — a binding must `
            + 'short-circuit it and return its own open room, because "no walls" is a '
            + 'substrate fact (the maze has no wall ring; the Seedling room has one) and not '
            + 'something a grid backend can express.');
    }
    const backend = getBackend(entry.backend);
    if (!backend) {
        fail(`skeletonKinds: the kind ${JSON.stringify(kind)} names backend `
            + `${JSON.stringify(entry.backend)}, which is not registered. Backends register `
            + 'ON IMPORT, so this is a missing import in the caller\'s graph and not a bad '
            + 'kind — the three portable ones are imported by this file.');
    }
    const backendStats = backend.run(world, { ...(entry.params ?? {}) }, rng);
    const ran = [];
    for (const pp of entry.postProcessors ?? []) {
        const fn = getPostProcessor(pp.id);
        if (!fn) {
            fail(`skeletonKinds: the kind ${JSON.stringify(kind)} names post-processor `
                + `${JSON.stringify(pp.id)}, which does not exist.`);
        }
        fn(world, pp.params ?? {}, rng);
        ran.push(pp.id);
    }
    return { kind, backend: entry.backend, backendStats, postProcessors: ran };
}
