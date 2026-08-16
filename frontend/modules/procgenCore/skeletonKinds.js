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
import { assertParamSchema, enumerateValues } from './templateContract.js';

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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ SLICE 7 — THE KIND PARAMETERS
 * ══════════════════════════════════════════════════════════════════════
 *
 * CONSTRUCTIVE-MODE arc, slice 7 (⚖ kickoff §3.6 item 3, ⚖ open question 5's
 * reserved `;` spelling). A kind used to be a FIXED bundle; it is now a bundle
 * with declared knobs, spelled `?skeleton=rooms;minRoom=2;chambers=1`.
 *
 * ── ⛔ ONE SCHEMA LANGUAGE — `templateContract.assertParamSchema` ─────
 *
 * `[{key, domain, default, why}]`, the SAME array a parameterized template
 * declares, checked by the SAME function, enumerated by the SAME
 * `enumerateValues`. A second schema language for kinds would be two answers
 * to "what is a declared knob", and this arc's first law is one of everything.
 *
 * ── ⛔⛔ A PARAMETER AT ITS DEFAULT IS **BYTE-INERT**, NOT MERELY EQUIVALENT
 *
 * The `target` of a post-processor knob is APPENDED ONLY WHEN THE VALUE IS OFF
 * ITS DEFAULT. So at `chambers=0` no `chambers` post-processor runs, no draw is
 * spent, and every committed seed→level pair of every kind survives the day the
 * knob was declared. ⛔ It is not enough that `chambers(k=0)` returns early —
 * that would already be true — the point is that the RUNNER does not call it,
 * so nothing about the run's shape depends on the knob existing.
 *
 * ── ⛓ THE DRAW ORDER, DECLARED (⚖ kickoff §3.4: the order IS the identity)
 *
 *   goal cell (the binding's, first draw)
 *     → the backend, under `params` merged with the BACKEND-targeted values
 *     → the table's own post-processors, in table order
 *     → the value-added post-processors, in SCHEMA DECLARATION order
 *
 * `chambers` is declared LAST in every kind that has it, so it stamps onto a
 * finished layout rather than onto something a later pass will fill back in —
 * and `chambers=0` therefore moves nothing that comes before it, which is what
 * the draw-order test drives.
 */

/**
 * ⛓⛓ CHAMBERS — the knob ⚖ §3.6(3) exists for. A carved room is CORRIDOR, and
 * every AREA template in either palette (a pool, a pit patch, a lane) needs
 * somewhere wider than one tile to anchor. `k` open 3×3 squares is the smallest
 * thing that gives it one.
 *
 * ⛔ SHARED BY REFERENCE ACROSS SIX KINDS, deliberately: `chambers=2` must mean
 * the same domain and the same default on `bushy` as on `rooms`, and six copies
 * of a literal is six places for them to drift.
 *
 * ⚠ `size` is NOT on the URL in v1 — the table fixes it at 3 (`target.fixed`).
 * A knob nobody has swept is a knob nobody has adjudicated (⚖ ruling 4), and
 * the yield table this slice re-runs sweeps `k`, not `size`.
 */
const CHAMBERS_PARAM = Object.freeze({
    key: 'chambers',
    domain: Object.freeze([0, 1, 2, 3]),
    default: 0,
    why: 'how many 3x3 open squares to stamp onto the finished carve. 0 = off, and off '
        + 'is BYTE-INERT — the post-processor is not appended at all, so no draw is spent. '
        + 'A carved room is corridor; an area template has nowhere to be until this runs.',
    target: Object.freeze({ post: 'chambers', param: 'k', fixed: Object.freeze({ size: 3 }), marginAware: true }),
});

/**
 * ⛓⛓⛓ PRUNE — **A BOOLEAN, AND THE MEASUREMENT IS WHY.**
 *
 * The brief sized this {0, 1..4}. Measured first (⚖ trap 254: measure what the
 * subject admits before sizing a knob), on `branchy`/`bushy`/`loopy`/`open`/
 * `rooms` × seeds 1..5 × BOTH substrate geometries: `pruneDeadEnds` re-lists its
 * dead ends inside `while (changed)`, so it runs to a FIXED POINT and thresholds
 * 1, 2, 3, 4, 5 and 9999 give the byte-identical residue in every one of the 50
 * cells. ⇒ **the domain the subject admits is {0, 1}**, and a {0..4} knob would
 * have offered four spellings of one room.
 *
 * ⛔ AND IT IS DECLARED ON TWO KINDS, NOT FOUR — each exclusion measured:
 *   · `branchy` — `branchy;prune=1` is BYTE-IDENTICAL to `winding` on seeds
 *     1..8 (same backend, same picker, same fixed point). A second spelling of
 *     an existing kind is exactly what this vocabulary refuses; say `winding`.
 *   · `open`    — full braid already removes every removable dead end, so
 *     `prune=1` was a NO-OP on 5 seeds × both substrates. A knob that does
 *     nothing is a control that writes state nobody reads.
 * `bushy;prune=1` (a random-picker tree, pruned) and `loopy;prune=1` (a half-
 * braided maze with its stuck dead ends filled) are rooms NO kind name reaches,
 * which is the whole case for the knob.
 */
const PRUNE_PARAM = Object.freeze({
    key: 'prune',
    domain: Object.freeze([0, 1]),
    default: 0,
    why: 'fill every dead end back in (1) or leave them (0). MEASURED to be a boolean: '
        + 'pruneDeadEnds runs to a fixed point, so thresholds 1..9999 are one room. 0 = '
        + 'today, and byte-inert.',
    target: Object.freeze({ post: 'pruneDeadEnds', param: 'threshold' }),
});

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
        paramSchema: Object.freeze([CHAMBERS_PARAM]),
    }),
    bushy: Object.freeze({
        name: 'Bushy',
        description: 'Recursive backtracker with random picker — bushier, Prim\'s-like with shorter branches.',
        backend: 'recursive_backtracker',
        params: Object.freeze({ picker: 'random' }),
        paramSchema: Object.freeze([PRUNE_PARAM, CHAMBERS_PARAM]),
    }),
    loopy: Object.freeze({
        name: 'Loopy',
        description: 'Kruskal\'s spanning tree with 50% braid — perfect maze with some loops mixed in.',
        backend: 'kruskals',
        postProcessors: Object.freeze([
            Object.freeze({ id: 'braid', params: Object.freeze({ p: 0.5 }) }),
        ]),
        paramSchema: Object.freeze([PRUNE_PARAM, CHAMBERS_PARAM]),
    }),
    open: Object.freeze({
        name: 'Open',
        description: 'Kruskal\'s spanning tree with full braid — every dead end removed, loops everywhere.',
        backend: 'kruskals',
        postProcessors: Object.freeze([
            Object.freeze({ id: 'braid', params: Object.freeze({ p: 1.0 }) }),
        ]),
        paramSchema: Object.freeze([CHAMBERS_PARAM]),
    }),
    rooms: Object.freeze({
        name: 'Rooms',
        description: 'Recursive division — partitions the region into chambers connected by single-tile gaps.',
        backend: 'recursive_division',
        params: Object.freeze({ minRoom: 3 }),
        /**
         * ⛓ `minRoom` — the ONE backend-targeted knob, and the only one whose
         * value reaches `backend.run` rather than a post-processor. ⛔ Its
         * default is TODAY'S LITERAL (3), so the table's `params` and the
         * resolved value agree at the default and the `rooms` pairs cannot
         * move. The domain is {2,3,4}: 2 is the smallest partition
         * `recursive_division` will make, and above 4 the 10x10 Seedling room
         * stops dividing at all.
         */
        paramSchema: Object.freeze([
            Object.freeze({
                key: 'minRoom',
                domain: Object.freeze([2, 3, 4]),
                default: 3,
                why: 'the smallest chamber recursive_division will cut. Smaller = more, '
                    + 'tighter rooms; larger = fewer, bigger ones. 3 is today\'s value.',
                target: Object.freeze({ backend: 'minRoom' }),
            }),
            CHAMBERS_PARAM,
        ]),
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
        /**
         * ⛔ NO `prune` KNOB HERE — this kind IS the pruned one, and a knob that
         * could turn it off would spell `branchy` under the name `winding`.
         */
        paramSchema: Object.freeze([CHAMBERS_PARAM]),
    }),
});

/**
 * ⛓⛓ THE SCHEMA IS CHECKED AT **DEFINITION TIME**, by the SAME function
 * `defineTemplate` uses — a domain nobody can enumerate is a domain nobody
 * swept, and a default outside its own domain is a form control that offers an
 * illegal value. Both would otherwise surface on the day somebody pressed
 * something.
 *
 * ⛔ AND `chambers` MUST BE THE LAST DECLARED PARAMETER wherever it appears.
 * The value-added post-processors run in DECLARATION order, so declaring
 * `chambers` before `prune` would prune the stamped chamber's own edges back
 * into wall — the draw order IS the identity (⚖ §3.4), and this is the one
 * place it can be asserted rather than remembered.
 */
for (const [kind, entry] of Object.entries(BIOMES)) {
    const schema = entry.paramSchema ?? [];
    assertParamSchema(schema, `skeleton kind ${JSON.stringify(kind)}`);
    const at = schema.findIndex((p) => p.key === 'chambers');
    if (at >= 0 && at !== schema.length - 1) {
        fail(`skeletonKinds: the kind ${JSON.stringify(kind)} declares "chambers" at `
            + `position ${at} of ${schema.length}. It must be LAST: value-added `
            + 'post-processors run in declaration order, and a chamber stamped before a '
            + 'prune would be pruned back out.');
    }
    if (entry.carves === false && schema.length > 0) {
        fail(`skeletonKinds: the kind ${JSON.stringify(kind)} carves nothing and cannot `
            + 'declare parameters — there is no carve for them to change.');
    }
}

/** ⛓ The same table under the name the constructive mode reads it by. */
export const SKELETON_KINDS = BIOMES;

/** ⛔ THE MAZE REGION DEFAULT — see the file docblock. Not the kind default. */
export const DEFAULT_BIOME_ID = 'classic';

/** ⛔ THE CONSTRUCTIVE DEFAULT — the open room. See the file docblock. */
export const DEFAULT_SKELETON_KIND = 'empty';

/** The skeleton block every state and every payload carries. */
export const DEFAULT_SKELETON = Object.freeze({ kind: DEFAULT_SKELETON_KIND });

export const KIND_IDS = Object.freeze(Object.keys(BIOMES));

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE KIND PARAMETERS — ONE CODEC, ONE VALIDATOR, ONE FORMATTER
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛔ THE STRING↔OBJECT CODEC LIVES **HERE**, BESIDE THE TABLE IT VALIDATES
 * AGAINST — not in `urlParams.js`. The URL is one channel; the two CLIs'
 * `--skeleton=` is another, and the pages' forms are a third. A parser in the
 * URL file would have made the CLIs either import the URL grammar (which knows
 * about `URLSearchParams`) or grow a second one. `urlParams` keeps the ONE
 * reader and the ONE writer of the PARAMETER; what a VALUE means is the
 * table's own question.
 */

/** The declared schema of a kind — `[]` for a kind with no knobs. */
export function paramSchemaFor(kind) {
    return BIOMES[kind]?.paramSchema ?? [];
}

/** Every declared value combination of a kind — `templateContract`'s enumerator. */
export function enumerateKindValues(kind) {
    return enumerateValues({ params: paramSchemaFor(kind) });
}

/**
 * ⛓⛓ THE ONE VALIDATOR. Unknown keys and out-of-domain values refuse **BY
 * NAME**, with what WAS declared — a reader who typed `minRoom` at `branchy`
 * has no other channel to learn that the knob is `rooms`'.
 *
 * @returns {object} the FULL value set (every declared key, defaults filled) —
 *   what `carveSkeleton` runs under.
 */
export function resolveSkeletonParams(kind, values = {}) {
    const schema = paramSchemaFor(kind);
    const declared = schema.map((p) => p.key);
    for (const key of Object.keys(values ?? {})) {
        const p = schema.find((q) => q.key === key);
        if (!p) {
            fail(`skeletonKinds: the skeleton kind ${JSON.stringify(kind)} has no parameter `
                + `${JSON.stringify(key)}. It declares `
                + `${declared.length ? `[${declared.join(', ')}]` : 'NO parameters'}. `
                + '⛔ A silently ignored parameter is a link that names a room it did not '
                + 'build.');
        }
        if (!p.domain.includes(values[key])) {
            fail(`skeletonKinds: ${JSON.stringify(kind)} parameter "${key}" was given `
                + `${JSON.stringify(values[key])}, which is not in its declared domain `
                + `[${p.domain.join(', ')}]. Every value in a domain is one a sweep `
                + 'measured; a value outside it is one nobody has adjudicated.');
        }
    }
    const out = {};
    for (const p of schema) {
        out[p.key] = Object.prototype.hasOwnProperty.call(values ?? {}, p.key)
            ? values[p.key] : p.default;
    }
    return out;
}

/**
 * The values that are NOT at their default, in DECLARATION order — what the URL
 * writes and what the payload carries. ⛔ The default is spelled by ABSENCE, the
 * same rule the kind itself and the whole roster follow, so one room has exactly
 * one spelling.
 */
export function nonDefaultParams(kind, values = {}) {
    const full = resolveSkeletonParams(kind, values);
    const out = {};
    for (const p of paramSchemaFor(kind)) {
        if (full[p.key] !== p.default) out[p.key] = full[p.key];
    }
    return out;
}

/**
 * ⛓ THE CANONICAL `{kind, params}` — `params` OMITTED when every value is at
 * its default. ⛔ That omission is what makes `agreementWithPayload` compare
 * with a BOTH-SIDES DEFAULT: a payload written before this slice carries
 * `{kind}` and normalizes to the same object a page at all-defaults produces,
 * so an old payload agrees rather than diverging on a field it could not have
 * had. (A payload naming a NON-default value and a page at the default still
 * diverge BY NAME, which is correct.)
 */
export function normalizeSkeleton(spec, { validate = true } = {}) {
    const kind = spec?.kind ?? DEFAULT_SKELETON_KIND;
    /**
     * ⛔ THE UNKNOWN-KIND SENTENCE IS `assertKind`'s, NOT A SECOND ONE — one
     * answer to "which kinds may I ask for", wherever the question is asked.
     * ⚠ `simulator: true` on purpose: this normalizer is substrate-agnostic, so
     * "your binding cannot run that" is the CALLER's refusal (the URL reader
     * and both bindings each make it with their own offer list) and must not be
     * pre-empted here.
     */
    if (validate) assertKind(kind, { simulator: true });
    const params = BIOMES[kind] ? nonDefaultParams(kind, spec?.params ?? {}) : {};
    return Object.keys(params).length === 0
        ? Object.freeze({ kind })
        : Object.freeze({ kind, params: Object.freeze(params) });
}

/**
 * `rooms;minRoom=2;chambers=1` — the ONE spelling, used by the URL writer, both
 * CLIs, the identity line and the sweep's row labels. A kind at all defaults
 * formats as its bare id.
 */
export function formatSkeleton(spec) {
    const norm = normalizeSkeleton(spec);
    const parts = Object.entries(norm.params ?? {}).map(([k, v]) => `${k}=${v}`);
    return parts.length === 0 ? norm.kind : `${norm.kind};${parts.join(';')}`;
}

/**
 * ⛓⛓⛓ THE ONE PARSER — `<kind>[;key=value]…` → `{kind[, params]}`.
 *
 * ⚖ Open question 5's default spelling, landed by slice 7. Slice 5 REFUSED a
 * `;` clause by name and reserved it for exactly this; the refusal is now a
 * grammar.
 *
 * ⛔ FIVE DISTINGUISHED REFUSALS, because a reader can act on each: a clause
 * with no `=`, an empty clause, a duplicated key, a key the kind does not
 * declare (with the ones it does), and a value outside a declared domain (with
 * the domain). ⚠ Values are matched against the domain BY STRING, so the
 * object carries the domain's own typed member (the number 2, never "2") —
 * which is what makes `agreementWithPayload` and the fixed point comparable at
 * all.
 */
export function parseSkeleton(value, { simulator = false, substrate = 'this substrate' } = {}) {
    const raw = String(value ?? '').trim();
    const [head, ...clauses] = raw.split(';');
    const kind = assertKind(head.trim().toLowerCase(), { simulator, substrate });
    const schema = paramSchemaFor(kind);
    const declared = schema.map((p) => p.key);
    const params = {};
    for (const clause of clauses) {
        const text = clause.trim();
        if (text === '') {
            fail(`skeletonKinds: ${JSON.stringify(raw)} carries an EMPTY parameter clause. `
                + 'Each clause is `key=value`, separated by `;` — an empty one is a typo '
                + 'the reader can fix, not a value.');
        }
        const eq = text.indexOf('=');
        if (eq <= 0) {
            fail(`skeletonKinds: the clause ${JSON.stringify(text)} in `
                + `${JSON.stringify(raw)} is not \`key=value\`. The kind `
                + `${JSON.stringify(kind)} declares `
                + `${declared.length ? `[${declared.join(', ')}]` : 'NO parameters'}.`);
        }
        const key = text.slice(0, eq).trim();
        const rawValue = text.slice(eq + 1).trim();
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            fail(`skeletonKinds: ${JSON.stringify(raw)} names "${key}" TWICE. One knob, one `
                + 'value — a link that sets a parameter twice does not say which room it '
                + 'means.');
        }
        const p = schema.find((q) => q.key === key);
        if (!p) {
            fail(`skeletonKinds: the skeleton kind ${JSON.stringify(kind)} has no parameter `
                + `${JSON.stringify(key)}. It declares `
                + `${declared.length ? `[${declared.join(', ')}]` : 'NO parameters'}. `
                + '⛔ A silently ignored parameter is a link that names a room it did not '
                + 'build.');
        }
        const typed = p.domain.find((v) => String(v) === rawValue);
        if (typed === undefined) {
            fail(`skeletonKinds: ${JSON.stringify(kind)} parameter "${key}" was given `
                + `${JSON.stringify(rawValue)}, which is not in its declared domain `
                + `[${p.domain.join(', ')}].`);
        }
        params[key] = typed;
    }
    return normalizeSkeleton({ kind, params });
}

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
        /**
         * ⛓ SLICE 7 — THE KIND'S DECLARED KNOBS, so a page can MOUNT A FORM
         * from the catalogue instead of keeping a second list of what a kind
         * takes. ⛔ The schema objects themselves, frozen at declaration: the
         * form's options ARE the domain and its pre-fill IS the default, so a
         * control cannot offer a value the parser would refuse.
         */
        params: entry.paramSchema ?? [],
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
 * @param {object} [o]
 * @param {object} [o.params]  the kind's declared values (⛓ slice 7); missing
 *   keys take their declared default, and a key the kind does not declare
 *   refuses BY NAME.
 * @param {number} [o.margin]  cells in from the grid edge that may never be
 *   carved — the BINDING's fact (Seedling 1, the maze 0). Reaches only the
 *   post-processors that declare `marginAware`.
 * @returns {{kind, backend, backendStats, postProcessors: string[], params: object}}
 */
export function carveSkeleton(kind, world, rng, { params = {}, margin = 0 } = {}) {
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
    /**
     * ⛓⛓⛓ SLICE 7 — THE DECLARED VALUES, RESOLVED AND ROUTED. Two kinds of
     * target and they are NOT symmetric:
     *
     *  · `{backend: 'minRoom'}` MERGES over the table's own `params`. It is
     *    always applied, because the default IS the table's literal — merging
     *    3 over 3 writes the same argument the backend has always received.
     *  · `{post: 'chambers', param: 'k'}` APPENDS a post-processor, and ⛔ ONLY
     *    WHEN THE VALUE IS OFF ITS DEFAULT. That is the byte-inert law: at the
     *    default the runner does not call it, so it spends no draw and the
     *    layout it would have received is the layout that ships.
     *
     * ⚠ `margin` reaches only a target that declares `marginAware`. It is the
     * CALLER's fact (the Seedling room has a wall ring to protect; the maze has
     * none), so it is threaded rather than defaulted — and handing it to a
     * post-processor that does not read it would be a parameter nobody obeys.
     */
    const values = resolveSkeletonParams(kind, params);
    const backendParams = { ...(entry.params ?? {}) };
    const added = [];
    for (const p of entry.paramSchema ?? []) {
        const v = values[p.key];
        if (p.target.backend) {
            backendParams[p.target.backend] = v;
            continue;
        }
        if (v === p.default) continue;
        added.push({
            id: p.target.post,
            params: {
                ...(p.target.fixed ?? {}),
                [p.target.param]: v,
                ...(p.target.marginAware ? { margin } : {}),
            },
        });
    }
    const backendStats = backend.run(world, backendParams, rng);
    const ran = [];
    for (const pp of [...(entry.postProcessors ?? []), ...added]) {
        const fn = getPostProcessor(pp.id);
        if (!fn) {
            fail(`skeletonKinds: the kind ${JSON.stringify(kind)} names post-processor `
                + `${JSON.stringify(pp.id)}, which does not exist.`);
        }
        fn(world, pp.params ?? {}, rng);
        ran.push(pp.id);
    }
    return {
        kind, backend: entry.backend, backendStats, postProcessors: ran, params: values,
    };
}
