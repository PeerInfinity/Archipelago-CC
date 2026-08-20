/**
 * procgenDocs/glossary.js — **THE PROCGEN GLOSSARY, AS DATA.** One frozen
 * entry per term the procgen docs and the two lab pages use as vocabulary:
 * what it means in plain English, what the rule actually is in this project,
 * and where that rule lives.
 *
 * ⚖ It exists because the user asked for it on 2026-08-18: *"demos.md and the
 * demo pages are dense with technical jargon — a new document that defines
 * each of the technical terms, linked from the document and the demo pages …
 * served on GitHub Pages … covering ALL of procgen, not just the Seedling
 * substrate"*.
 *
 * ⛔⛔ **ONE DATA MODULE, FIVE READERS.** This file is the ONLY copy:
 *
 *   - `procgenDocs/glossary.html` renders it (locally and on GitHub Pages) —
 *     the page IS its data, it fetches nothing.
 *   - `procgenDocs/demos.html` links every catalogue entry's `terms` here.
 *   - `seedlingDemo/watch.html` and `mazeRoom/lab.html` link the page from
 *     their headers and hang `oneLinerFor(id)` on section summaries as
 *     `title=` tooltips. ⛔ A lab page gains a link and `title=`s and NOTHING
 *     else — no readout of theirs moves.
 *   - `scripts/procgen/check-procgen-demos.mjs` LOADS the page and asserts it
 *     renders what this module holds.
 *   - `glossary.test.js` gates the shape without a browser.
 *
 * ── ⛓ TWO LEVELS PER ENTRY, AND THAT IS THE WHOLE POINT ────────────────
 *
 * `plain` is ONE sentence someone who has never read a record can read. It
 * carries no jargon, no file name and no number. `detail` is *in this
 * project*: the concrete rule, the measured number, the refusal's own name —
 * and it cites the TRACKED docs. ⛔ Never a `NewDocs/` pointer: that tree is
 * deliberately gitignored, so a reader on GitHub Pages cannot follow one.
 *
 * ── THE ENTRY SHAPE ─────────────────────────────────────────────────────
 *
 *   id        stable slug — the page's anchor (`glossary.html#door-law`) AND
 *             the key `demos.js` entries name in their `terms`
 *   term      the display form
 *   aliases   other spellings the docs use for the same thing
 *   area      one of `AREAS` — the block the page files it under
 *   plain     ONE jargon-free sentence
 *   detail    "in this project" — the `inline()` markdown subset (code,
 *             **bold**, *italic*, [text](url), <url>, paragraphs, fences)
 *   where     `{label, doc}` for a tracked doc (optionally `#fragment`) and
 *             `{label, code}` for a repo path — rendered as GitHub links
 *   seeAlso   other entry ids
 *
 * ⛔ NOTHING HERE IS INVENTED. Every entry is traceable to a tracked doc or a
 * string a reader meets on one of the two lab pages; the candidate set it was
 * chosen FROM is measured by `scripts/procgen/harvest-procgen-terms.mjs`, and
 * the words that were NOT defined are published with their reason in the
 * as-built rather than left silent.
 */

/* ⛓⛓ THE PAGES MAPPING IS SPELLED ONCE, IN `demos.js`, AND IMPORTED. A second
 * copy of "`frontend/` is the Pages root" is exactly the drift P1 deleted. */
import { PAGES_BASE, REPO_URL, docHref, pagesUrl } from './demos.js';

export { PAGES_BASE, REPO_URL, docHref };

/** ⛓ The page this module is rendered by — the anchor target of every link. */
export const GLOSSARY_PAGE = '/frontend/modules/procgenDocs/glossary.html';

/** ⛓ The doc directory every `where.doc` must live under. ⛔ Tracked only. */
export const DOC_ROOT = 'docs/json/developer/procgen/';

/**
 * The blocks the page files terms under, in the order it prints them —
 * outermost first, so a reader who arrives knowing nothing meets the world
 * pipeline before the cell-level vocabulary of one room.
 */
export const AREAS = Object.freeze([
    Object.freeze({
        id: 'pipeline',
        title: 'The world pipeline',
        blurb: 'How a whole multi-region world is generated, compiled and played.',
    }),
    Object.freeze({
        id: 'substrates',
        title: 'Substrates',
        blurb: 'The pluggable per-region game engines, and the registry that dispatches to them.',
    }),
    Object.freeze({
        id: 'level-gen',
        title: 'Level generation — pass 1 and pass 2',
        blurb: 'The second, smaller pipeline that fills ONE region: elements, the carve, '
            + 'the area graph, certification, and the keep-or-revert loop.',
    }),
    Object.freeze({
        id: 'lock-and-key',
        title: 'The area graph — the lock-and-key layer',
        blurb: 'Dividing one room into areas and locking some of them behind keys found in '
            + 'others, so the room has to be explored in an order.',
    }),
    Object.freeze({
        id: 'seedling',
        title: 'Seedling — the real-game bot and its generator',
        blurb: 'Driving the real recompiled game with an input tape, and the arm of its '
            + 'watch page that generates levels.',
    }),
    Object.freeze({
        id: 'maze',
        title: 'The maze substrate and its lab',
        blurb: 'The grid-of-tiles substrate: the first binding of the loop core, and the '
            + 'exact solver it certifies with.',
    }),
    Object.freeze({
        id: 'pages',
        title: 'The lab pages, their URLs and their readouts',
        blurb: 'What you are looking at when you open one, and what a link to one names.',
    }),
    Object.freeze({
        id: 'testing',
        title: 'Instruments, gates and rows',
        blurb: 'How a claim about any of the above is measured, and what makes a measurement '
            + 'worth believing.',
    }),
]);

export const AREA_IDS = Object.freeze(AREAS.map((a) => a.id));

/** ⛓ ONE constructor, so every entry is frozen the same way and a missing
 *  field is a shape error at import rather than an `undefined` on the page. */
const t = (o) => Object.freeze({
    id: o.id,
    term: o.term,
    aliases: Object.freeze(o.aliases ?? []),
    area: o.area,
    plain: o.plain,
    detail: o.detail,
    where: Object.freeze((o.where ?? []).map((w) => Object.freeze({ ...w }))),
    seeAlso: Object.freeze(o.seeAlso ?? []),
});

const ARCH = 'docs/json/developer/procgen/architecture.md';
const GOTCHAS = 'docs/json/developer/procgen/gotchas.md';
const MAZE = 'docs/json/developer/procgen/maze.md';
const SEEDLING = 'docs/json/developer/procgen/seedling-bot.md';
const REGISTRY = 'docs/json/developer/procgen/substrate-registry.md';
const SPHERE = 'docs/json/developer/procgen/sphere-growth.md';
const STEPPED = 'docs/json/developer/procgen/stepped-pipeline.md';
const PATHS = 'docs/json/developer/procgen/paths-and-obstacles.md';
const PLAYBACK = 'docs/json/developer/procgen/playback-and-debugging.md';
const LOOPREC = 'docs/json/developer/procgen/loop-recording.md';
const DEMOS_DOC = 'docs/json/developer/procgen/demos.md';

/** ⛓ THE GENERATED REFERENCE PAGE (PROCGEN DOCS P3a). ⛔ A CODE path, not a
 *  `doc`: it is not a tracked `.md` under `DOC_ROOT` — it is a page in
 *  `frontend/`, rendered from three modules that `scripts/procgen/
 *  generate-procgen-reference.mjs` writes out of the code itself. The terms
 *  below whose answer is a TABLE point at it, because the table there cannot
 *  drift from the code and a re-typed one always does. */
const REFERENCE = 'frontend/modules/procgenDocs/reference.html';

const TWO_PASS = `${ARCH}#level-generation-two-passes-over-one-loop-core`;
const PASS1 = `${ARCH}#pass-1--the-skeleton-in-draw-order`;
const PASS2 = `${ARCH}#pass-2--the-keep-or-revert-loop-site-typed`;
const LEDGER_SEC = `${ARCH}#the-ledger-the-step-through-and-the-instruments`;
const ELEMENTS_SEC = `${SEEDLING}#the-procgen-elements-design--pass-1--elements--connectors-an-intra-level-area-graph-pass-2-site-typed-designed-2026-08-15-arcs-1-2-and-3-are-closed--arcs-12-on-the-maze-see-mazemdmazemd-arc-3--seedling-closed-2026-08-18-over-fourteen-slices-and--arc-3-is-closed-at-the-end-of-this--is-its-summary-arc-4--the-chain--ask-first-arc-5--shortcuts--density--arenas`;
const URL_TABLE = `${SEEDLING}#the-url-parameters-whole-and-current`;
const STANDING_LAWS = `${SEEDLING}#the-standing-laws`;
const MAZE_AREAS = `${MAZE}#the-area-graph`;
const MAZE_ELEMENT = `${MAZE}#the-first-element`;
const MAZE_LAB = `${MAZE}#the-maze-lab-page-frontendmodulesmazeroomlabhtml`;

export const TERMS = Object.freeze([

    /* ══════════ THE WORLD PIPELINE ══════════════════════════════════ */

    t({
        id: 'procgen',
        term: 'procgen',
        aliases: ['procedural generation'],
        area: 'pipeline',
        plain: 'The part of this fork that builds a whole playable game world out of '
            + 'nothing but a number, instead of loading one somebody authored.',
        detail: 'The frontend generates complete multi-region worlds — regions, entrances, '
            + 'locations, items, access rules and the per-region playable content — and '
            + 'compiles them to an ordinary `rules.json`, the same format exported from a real '
            + 'Archipelago game. Because the output is ordinary, a generated world round-trips '
            + 'through the whole existing toolchain: the frontend plays it, `world_generator` '
            + 'turns it into a Python world package, `Generate.py` distributes items into it, '
            + 'and the exporter writes it back out.',
        where: [{ label: 'architecture.md § What procgen is in this fork', doc: `${ARCH}#what-procgen-is-in-this-fork` }],
        seeAlso: ['rules-json', 'substrate', 'layout-driver', 'level'],
    }),
    t({
        id: 'rules-json',
        term: '`rules.json`',
        aliases: ['the output format'],
        area: 'pipeline',
        plain: 'The single file format everything here reads and writes — the description of '
            + 'a world\'s places, its things, and what you need in order to get anywhere.',
        detail: 'Every driver ends in `buildRulesJson`, so a generated world is a standard '
            + 'rules file that every existing consumer (the tracker, the region graph, the '
            + 'world generator) already understands. A procgen one adds up to three top-level '
            + 'keys and nothing else: [`preset_sidecars`](#preset-sidecars), '
            + '[`procgen_metadata`](#procgen-metadata) and [`loop_costs`](#loop-costs). That is '
            + 'why non-procgen consumers need no special handling at all.',
        where: [{ label: 'architecture.md § rules.json extensions', doc: `${ARCH}#rulesjson-extensions` }],
        seeAlso: ['preset-sidecars', 'procgen-metadata', 'loop-costs', 'round-trip'],
    }),
    t({
        id: 'layout-driver',
        term: 'a layout driver',
        aliases: ['driver', 'the four drivers'],
        area: 'pipeline',
        plain: 'The piece that decides the SHAPE of a world — how many places there are, '
            + 'which ones connect to which, and what kind of game each one is.',
        detail: 'Four of them, all in `procgenPipelineEngine.js` and selected by the Procgen '
            + 'Pipeline panel\'s Mode toggle: **[sphere growth](#sphere-growth)** (the primary '
            + 'one), **[top-down](#top-down)**, **[shuffled spiral](#shuffled-spiral)** and '
            + '**grid growth** (deprecated — still selectable, receives no new features). A '
            + 'driver builds the region graph and assigns each region a '
            + '[substrate](#substrate); what fills a single region is a separate, smaller '
            + 'pipeline. ⚠ *Braid* is NOT one of them — it is a bounce level-generation '
            + 'regime, and confusing the two is common enough to have its own gotcha.',
        where: [
            { label: 'architecture.md § The four layout drivers', doc: `${ARCH}#the-four-layout-drivers` },
            { label: 'gotchas.md § "Braid" is not a pipeline driver', doc: `${GOTCHAS}#braid-is-not-a-pipeline-driver` },
        ],
        seeAlso: ['sphere-growth', 'top-down', 'shuffled-spiral', 'braid', 'level'],
    }),
    t({
        id: 'sphere-growth',
        term: 'sphere growth',
        aliases: ['growSpheres'],
        area: 'pipeline',
        plain: 'The main way a world gets built: first plan which things unlock which other '
            + 'things, then grow the world outward so it matches that plan.',
        detail: 'It is PLAN-FIRST. `spherePlanner.js` decides the sphere structure before any '
            + 'region exists; `growSpheres` then grows the world wave by wave so the built '
            + 'world matches it. The plan doubles as a verification '
            + '[oracle](#oracle): after compilation the ACTUAL item spheres are recomputed '
            + 'from the built world and compared against the planned ones, and the CLI exits '
            + 'non-zero on a mismatch.',
        where: [
            { label: 'sphere-growth.md § The sphere plan', doc: `${SPHERE}#the-sphere-plan-sphereplannerjs` },
            { label: 'architecture.md § The four layout drivers', doc: `${ARCH}#the-four-layout-drivers` },
        ],
        seeAlso: ['sphere', 'sphere-plan', 'layout-driver', 'oracle'],
    }),
    t({
        id: 'sphere',
        term: 'a sphere',
        aliases: ['item sphere'],
        area: 'pipeline',
        plain: 'A ring of the world: everything you can reach with what you have, before you '
            + 'find the next thing that opens more.',
        detail: 'Sphere 0 is what the start reaches with nothing; sphere *n+1* is what the '
            + 'items found in spheres ≤ *n* unlock. The **stratification rule** and the '
            + 'three-phase tree split in `sphere-growth.md` are how the planner decides which '
            + 'item lands in which sphere, and the sphere structure is the thing the compile '
            + 'step verifies against.',
        where: [{ label: 'sphere-growth.md § The stratification rule and the sphere tree', doc: `${SPHERE}#the-stratification-rule-and-the-sphere-tree` }],
        seeAlso: ['sphere-plan', 'sphere-growth', 'oracle'],
    }),
    t({
        id: 'sphere-plan',
        term: 'the sphere plan',
        aliases: [],
        area: 'pipeline',
        plain: 'The list, written before anything is built, of which discovery opens which '
            + 'part of the world — and afterwards, the answer key the finished world is '
            + 'marked against.',
        detail: 'It is the one artefact in the pipeline that is BOTH an input and an '
            + '[oracle](#oracle). `spherePlanner.js` writes it first; the compile step '
            + 'recomputes the real spheres from the built world and compares. A driver that '
            + 'grew something the plan did not describe fails there rather than shipping.',
        where: [{ label: 'sphere-growth.md § The sphere plan', doc: `${SPHERE}#the-sphere-plan-sphereplannerjs` }],
        seeAlso: ['sphere', 'sphere-growth', 'oracle'],
    }),
    t({
        id: 'top-down',
        term: 'top-down',
        aliases: ['topDownFromRulesJson'],
        area: 'pipeline',
        plain: 'Taking a real game\'s map and rebuilding it here as a playable world, keeping '
            + 'its layout and its rules.',
        detail: 'It realises an EXISTING `rules.json` — one exported from a real game, say — '
            + 'as a procgen world: each source region is placed in a grid cell and realised by '
            + 'a [substrate](#substrate), preserving the source\'s region graph and access '
            + 'rules. As a [stepped pipeline](#stepped-pipeline) it is four steps: '
            + '`layout → realise → finalize → compile`, and each region realises from its own '
            + 'sub-seed so re-running a later step after a hand-edit stays deterministic.',
        where: [
            { label: 'architecture.md § The four layout drivers', doc: `${ARCH}#the-four-layout-drivers` },
            { label: 'stepped-pipeline.md § Top-down mode', doc: `${STEPPED}#top-down-mode--four-steps` },
        ],
        seeAlso: ['layout-driver', 'stepped-pipeline', 'rules-json'],
    }),
    t({
        id: 'shuffled-spiral',
        term: 'shuffled spiral',
        aliases: ['arrangeShuffledSpiral'],
        area: 'pipeline',
        plain: 'Laying a world out as a chain winding outward from the middle — the way to '
            + 'build one out of games whose content is a fixed set of hand-made areas.',
        detail: 'This is the driver for **zone-based** substrates, whose content is a pool of '
            + 'pre-authored [zones](#zone) rather than procedurally grown geometry. It '
            + 'arranges [content sources](#content-source) into a world and resolves one per '
            + 'planned cell through a single seam, `resolveSpiralContentSource`.',
        where: [{ label: 'architecture.md § The four layout drivers', doc: `${ARCH}#the-four-layout-drivers` }],
        seeAlso: ['content-source', 'zone', 'layout-driver'],
    }),
    t({
        id: 'content-source',
        term: 'a content source',
        aliases: ['zone-based substrate'],
        area: 'pipeline',
        plain: 'A game that brings its own hand-made areas to the world instead of having '
            + 'new ones invented for it.',
        detail: 'A content source exposes a fixed `zoneCount` and instantiates a region '
            + 'descriptor per ordinal via `extractZoneRules`. ⛓ **It draws no rng at all** — '
            + 'only [procedural substrates](#substrate) consume the [rng stream](#rng-stream) '
            + '— which is what lets a data-backed *region library* join as a content source '
            + 'alongside code-backed ones. jta, bounce, runner and omsi participate this way.',
        where: [{ label: 'substrate-registry.md § Build time — content sources', doc: `${REGISTRY}#build-time--content-sources-zone-based-substrates` }],
        seeAlso: ['zone', 'shuffled-spiral', 'substrate', 'rng-stream'],
    }),
    t({
        id: 'zone',
        term: 'a zone',
        aliases: [],
        area: 'pipeline',
        plain: 'One of a game\'s pre-made areas, used here as the contents of one place in '
            + 'the generated world.',
        detail: 'A [content source](#content-source) declares how many it has (`zoneCount`) '
            + 'and hands one out per ordinal. ⚠ On JtA the host owns zone transitions in '
            + 'managed mode — the fork never advances its own zone — which is a whole class '
            + 'of confusing hangs and has its own gotcha.',
        where: [
            { label: 'jta.md § Zone-based mapping', doc: 'docs/json/developer/procgen/jta.md#zone-based-mapping' },
            { label: 'gotchas.md § In managed mode JtA never advances its own zone', doc: `${GOTCHAS}#in-managed-mode-jta-never-advances-its-own-zone` },
        ],
        seeAlso: ['content-source', 'jta-substrate', 'shuffled-spiral'],
    }),
    t({
        id: 'region',
        term: 'a region',
        aliases: [],
        area: 'pipeline',
        plain: 'One place in the world — one room, one level, one area — with ways out of it '
            + 'to other places.',
        detail: 'Regions and the [entrances](#entrance) between them are the world\'s graph. '
            + 'Each region is assigned exactly one [substrate](#substrate), which supplies its '
            + 'playable content; a single generated world can mix them, so one region is a '
            + 'maze and the next is a platformer. At play time '
            + '[procgenPlayer](#procgen-player) publishes the owning substrate\'s load event '
            + 'as the player moves between them.',
        where: [{ label: 'architecture.md § The pieces and the data flow', doc: `${ARCH}#the-pieces-and-the-data-flow` }],
        seeAlso: ['entrance', 'substrate', 'procgen-player', 'level'],
    }),
    t({
        id: 'entrance',
        term: 'an entrance',
        aliases: ['exit'],
        area: 'pipeline',
        plain: 'A way from one place in the world to another.',
        detail: 'Entrances are the edges of the region graph and ordinary `rules.json` '
            + 'content — a generated world\'s exits are the same shape a real game\'s are, '
            + 'which is why the tracker and the region graph need no special handling for '
            + 'one. An entrance may carry an access rule, which compiles from the '
            + '[obstacle](#obstacle) vocabulary.',
        where: [{ label: 'paths-and-obstacles.md § The vocabulary', doc: `${PATHS}#the-vocabulary-frontendmodulessharedprocgenlibraryjs` }],
        seeAlso: ['region', 'obstacle', 'requirement', 'rules-json'],
    }),
    t({
        id: 'obstacle',
        term: 'an obstacle',
        aliases: [],
        area: 'pipeline',
        plain: 'Something in the way that you need a particular thing in order to get past.',
        detail: 'Obstacles and items are the intermediate vocabulary a substrate\'s generator '
            + 'emits INSTEAD of writing access rules directly: a producer says *this path is '
            + 'blocked by this obstacle*, and one compiler turns the whole set into Rule '
            + 'Builder rules. The inverse — rule back to requirement — is '
            + '`ruleRequirements.js`. Inside a single level, pass 2\'s job is to place '
            + 'obstacles up to a target count.',
        where: [
            { label: 'paths-and-obstacles.md § The vocabulary', doc: `${PATHS}#the-vocabulary-frontendmodulessharedprocgenlibraryjs` },
            { label: 'paths-and-obstacles.md § The compiler', doc: `${PATHS}#the-compiler-frontendmodulessharedprocgenpathsandobstaclescompilerjs` },
        ],
        seeAlso: ['requirement', 'entrance', 'obstacle-target', 'pass-2'],
    }),
    t({
        id: 'requirement',
        term: 'a requirement',
        aliases: [],
        area: 'pipeline',
        plain: 'What you must already have before a particular route is open to you.',
        detail: 'The inverse direction of an [obstacle](#obstacle): '
            + '`procgenPipeline/ruleRequirements.js` reads a compiled access rule back into '
            + 'the requirement it expresses. ⚠ Do not confuse it with the level generator\'s '
            + '`?require=` [directive](#require-directive), which asks a single level\'s run '
            + 'to place a gate on a named item.',
        where: [{ label: 'paths-and-obstacles.md § The inverse', doc: `${PATHS}#the-inverse-rule--requirement-frontendmodulesprocgenpipelinerulerequirementsjs` }],
        seeAlso: ['obstacle', 'require-directive', 'entrance'],
    }),
    t({
        id: 'preset-sidecars',
        term: '`preset_sidecars`',
        aliases: ['sidecar'],
        area: 'pipeline',
        plain: 'The extra file section holding the actual playable contents of every place — '
            + 'the tile grids, the platforms, the prose.',
        detail: 'Per player, per region: the serialized substrate world, keyed by region id '
            + 'with the substrate id alongside. ⛓ **Its presence is also the marker** the '
            + 'runtime uses to recognise a procgen world at all — [procgenPlayer]'
            + '(#procgen-player) checks for `preset_sidecars[playerId]` on rules load and, '
            + 'when it is absent, stays completely out of the way.',
        where: [{ label: 'architecture.md § rules.json extensions', doc: `${ARCH}#rulesjson-extensions` }],
        seeAlso: ['rules-json', 'procgen-player', 'warehouse', 'payload'],
    }),
    t({
        id: 'procgen-metadata',
        term: '`procgen_metadata`',
        aliases: [],
        area: 'pipeline',
        plain: 'The notes a generated world keeps about how it was made.',
        detail: 'Source counts, the sphere tree, and enough structure that a '
            + '[stepped-pipeline](#stepped-pipeline) [envelope](#envelope) can be rebuilt '
            + 'from a compiled `rules.json` (`rebuildEnvelopeFromRulesJson`).',
        where: [{ label: 'architecture.md § rules.json extensions', doc: `${ARCH}#rulesjson-extensions` }],
        seeAlso: ['rules-json', 'envelope', 'stepped-pipeline'],
    }),
    t({
        id: 'loop-costs',
        term: '`loop_costs`',
        aliases: [],
        area: 'pipeline',
        plain: 'The price list for the idle-game layer — what each action costs to perform.',
        detail: 'Per-action mana costs; **its presence is what enables [loop mode]'
            + '(#loop-mode) for the world.** ⚠ Four files deal with loop costs and are easy '
            + 'to conflate — a live generator, a pure headless one (the only one that actually '
            + 'stamps this key at compile time), a debugger with an intentionally different '
            + 'model, and the runtime store. A change to the pricing vocabulary has to land in '
            + '**both** generators or it is a no-op where it matters.',
        where: [
            { label: 'architecture.md § rules.json extensions', doc: `${ARCH}#rulesjson-extensions` },
            { label: 'gotchas.md § Three loop-cost engines, one store', doc: `${GOTCHAS}#three-loop-cost-engines-one-store` },
        ],
        seeAlso: ['loop-mode', 'rules-json'],
    }),
    t({
        id: 'loop-mode',
        term: 'loop mode',
        aliases: ['the loops module'],
        area: 'pipeline',
        plain: 'Playing the world as an idle game: you queue up actions, they cost a resource, '
            + 'and when it runs out the run resets and starts again.',
        detail: 'The `loops` module activates when the loaded `rules.json` carries '
            + '[`loop_costs`](#loop-costs). Which affordances a given region gets — queueable '
            + 'actions, manual play, custom queues — is declared by the `loopSupport` field on '
            + 'its substrate\'s [registry entry](#registry-entry). Per-block Manual / Record / '
            + 'Playback modes and the Instant toggle are the recording layer on top.',
        where: [
            { label: 'loop-recording.md § Block modes', doc: `${LOOPREC}#block-modes` },
            { label: 'architecture.md § Runtime', doc: `${ARCH}#runtime-playing-a-generated-world` },
        ],
        seeAlso: ['loop-costs', 'registry-entry', 'omsi-substrate', 'jta-substrate'],
    }),
    t({
        id: 'warehouse',
        term: 'the warehouse',
        aliases: [],
        area: 'pipeline',
        plain: 'The unpacked contents of every place in the world, held ready in memory while '
            + 'you play.',
        detail: 'Built by `procgenPlayerEngine.js` on rules load: for each '
            + '[`preset_sidecars`](#preset-sidecars) entry it looks up the substrate in the '
            + '[registry](#substrate-registry), calls `deserializeWorld(playable_payload)` and '
            + 'stores `{substrate, world, loadRegionEvent}` per region.',
        where: [{ label: 'architecture.md § Runtime', doc: `${ARCH}#runtime-playing-a-generated-world` }],
        seeAlso: ['procgen-player', 'preset-sidecars', 'load-event'],
    }),
    t({
        id: 'procgen-player',
        term: 'procgenPlayer',
        aliases: [],
        area: 'pipeline',
        plain: 'The invisible piece that notices a world was generated and hands the right '
            + 'place to the right game engine as you walk around.',
        detail: '⛔ **It has no panel**, which makes it easy to overlook, and it is the piece '
            + 'that makes a procgen `rules.json` playable at all. It builds the '
            + '[warehouse](#warehouse), resolves the start region by walking `start_regions`, '
            + 'and publishes the owning substrate\'s [load event](#load-event) as the player '
            + 'moves. If play-time routing misbehaves, look here first and not in the '
            + 'substrate panels.',
        where: [{ label: 'gotchas.md § procgenPlayer has no panel', doc: `${GOTCHAS}#procgenplayer-has-no-panel` }],
        seeAlso: ['warehouse', 'load-event', 'preset-sidecars', 'region'],
    }),
    t({
        id: 'envelope',
        term: 'the envelope',
        aliases: [],
        area: 'pipeline',
        plain: 'The saved half-finished state of a build, so you can stop, look at it, change '
            + 'it by hand, and carry on.',
        detail: 'The unit of state of the [stepped pipeline](#stepped-pipeline): a '
            + 'serializable object each step reads from and merges into, so intermediate '
            + 'results can be inspected and hand-edited — in the panel, or as JSON files '
            + 'between CLI invocations. It can also be rebuilt from a compiled world via '
            + '[`procgen_metadata`](#procgen-metadata).',
        where: [{ label: 'stepped-pipeline.md § The envelope', doc: `${STEPPED}#the-envelope` }],
        seeAlso: ['stepped-pipeline', 'byte-identity', 'procgen-metadata'],
    }),
    t({
        id: 'stepped-pipeline',
        term: 'the stepped pipeline',
        aliases: [],
        area: 'pipeline',
        plain: 'Running a world build as a series of separate steps you can pause between, '
            + 'rather than one long uninterruptible operation.',
        detail: 'Sphere growth is six steps (`plan → allocate → topology → items → regions → '
            + 'compile`); top-down is four. The panel and the CLI share the same step-runner '
            + 'modules precisely so the wiring cannot drift. ⚠ **Two different "step-throughs" '
            + 'share a word**: this one steps the *world* drivers and is editable between '
            + 'steps; the [phase ladder](#phase-ladder) steps a *single level\'s* construction '
            + 'and is a read-only replay. They do not interact.',
        where: [
            { label: 'stepped-pipeline.md', doc: STEPPED },
            { label: 'architecture.md § The stepped pipeline', doc: `${ARCH}#the-stepped-pipeline` },
        ],
        seeAlso: ['envelope', 'byte-identity', 'phase-ladder'],
    }),
    t({
        id: 'byte-identity',
        term: 'byte identity',
        aliases: ['the byte-identity contract', 'byte-for-byte'],
        area: 'pipeline',
        plain: 'The promise that two different ways of doing the same build produce exactly '
            + 'the same file, down to the last character.',
        detail: '⛔ **A load-bearing invariant, not a test nicety.** The stepped pipeline at '
            + 'default batching must reproduce the monolithic driver\'s output byte for byte. '
            + 'It holds because all randomness is one continuous seeded '
            + '[stream](#rng-stream) consumed in the monolithic order, with snapshots threaded '
            + 'across step boundaries. Adding, removing or reordering an rng '
            + '[draw](#draw) anywhere breaks it silently — treat any new `rng()` call in '
            + 'generation code as a change that needs `scripts/procgen/verify-*.mjs` re-run.',
        where: [
            { label: 'gotchas.md § Byte-identity is a load-bearing invariant', doc: `${GOTCHAS}#byte-identity-is-a-load-bearing-invariant` },
            { label: 'stepped-pipeline.md § The byte-identity contract', doc: `${STEPPED}#the-byte-identity-contract` },
        ],
        seeAlso: ['determinism', 'rng-stream', 'draw', 'byte-inert'],
    }),
    t({
        id: 'determinism',
        term: 'determinism',
        aliases: ['deterministic'],
        area: 'pipeline',
        plain: 'The rule that the same starting number always produces the same world, on any '
            + 'machine, however busy it is.',
        detail: 'Given the same `(seed, parameters)`, generation reproduces the same world '
            + 'byte for byte. ⛓ **The generator broke this once and the shape of the fix is '
            + 'the lesson**: a solve that SUCCEEDED was reclassified `BUDGET_EXHAUSTED` when '
            + 'it took longer than a wall-clock budget, so elapsed time — not a property of '
            + 'the candidate — decided what was kept. `wallClockMs` is now GONE from the '
            + 'default budget entirely and `assertBudget` REFUSES a budget still carrying it. '
            + 'Every remaining bound is a property of the candidate.',
        where: [
            { label: 'gotchas.md § Generation used to be non-deterministic under load', doc: `${GOTCHAS}#generation-used-to-be-non-deterministic-under-load--fixed-2026-08-14-and-the-shape-of-the-fix-is-the-lesson` },
            { label: 'architecture.md § Determinism and verification', doc: `${ARCH}#determinism-and-verification` },
        ],
        seeAlso: ['rng-stream', 'byte-identity', 'tick-budget', 'control-arm'],
    }),
    t({
        id: 'rng-stream',
        term: 'the rng stream',
        aliases: ['seeded rng', 'the draw stream'],
        area: 'pipeline',
        plain: 'The single source of every random choice a build makes, replayable from its '
            + 'starting number.',
        detail: 'All generation randomness flows from `createRng(seed)` '
            + '(`frontend/modules/shared/rng.js`, mulberry32 with `getState`/`setState` for '
            + 'step-boundary snapshots). ONE stream consumed in one order is what makes '
            + '[byte identity](#byte-identity), the stepped pipeline and every verification '
            + 'instrument possible. ⚠ `shared/` is a git submodule — `git log`/`blame` on it '
            + 'must run inside the submodule.',
        where: [
            { label: 'architecture.md § Determinism and verification', doc: `${ARCH}#determinism-and-verification` },
            { label: 'gotchas.md § `shared/` is a git submodule', doc: `${GOTCHAS}#shared-is-a-git-submodule` },
            { label: 'shared/rng.js (submodule)', code: 'frontend/modules/shared/rng.js' },
        ],
        seeAlso: ['draw', 'seed', 'byte-identity', 'determinism', 'counting-spy'],
    }),
    t({
        id: 'draw',
        term: 'a draw',
        aliases: ['spends a draw', 'byte-inert'],
        area: 'pipeline',
        plain: 'One consumption of the random source — and once you take one, everything '
            + 'chosen afterwards is different.',
        detail: 'The unit of the arc\'s most-used argument. A change that SPENDS a draw moves '
            + 'every later choice, so any "nothing else moved" claim about it needs a '
            + '[control arm](#control-arm) rather than a tile comparison; a change that spends '
            + 'none is [byte-inert](#byte-inert) and the cheap seed→level pair dumps really '
            + 'do gate it. ⛓ Related and load-bearing: a parameter a caller NAMES is an '
            + 'override that spends no draw, one they OMIT is drawn — so `guard` and '
            + '`guard;len=2` are different runs even when `len` resolves to 2.',
        where: [
            { label: 'gotchas.md § "The `empty` pairs are UNCHANGED" is a gate only for a change that spends no draw', doc: `${GOTCHAS}#the-empty-pairs-are-unchanged-is-a-gate-only-for-a-change-that-spends-no-draw` },
            { label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE },
        ],
        seeAlso: ['rng-stream', 'byte-inert', 'control-arm', 'counting-spy'],
    }),
    t({
        id: 'seed',
        term: 'a seed',
        aliases: [],
        area: 'pipeline',
        plain: 'The number you start from — the same number always gives the same result.',
        detail: 'On the lab pages the seed is half of a level\'s IDENTITY (the other half is '
            + 'the [biome](#biome), and the [skeleton](#skeleton) kind is part of it too). '
            + '⚠ **A ladder RESETS when its identity changes** — a new seed, a new biome, or '
            + 'any [directive](#directive) — and the page says so BEFORE the press. Each '
            + 'region in a top-down build realises from its own sub-seed.',
        where: [{ label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE }],
        seeAlso: ['rng-stream', 'biome', 'skeleton', 'determinism'],
    }),
    t({
        id: 'round-trip',
        term: 'the Python round-trip',
        aliases: [],
        area: 'pipeline',
        plain: 'Sending a generated world out through the real Archipelago tools and getting '
            + 'it back still playable.',
        detail: 'Three steps, with the extra keys preserved end to end: `world_generator` '
            + 'creates a package under `worlds/` and writes the extra keys to sidecar files; '
            + '`Generate.py` runs normal Archipelago generation; the exporter\'s base handler '
            + 're-injects those sidecars as top-level keys in the newly exported `rules.json`. '
            + 'The result has real multiworld item distribution and the frontend still plays '
            + 'it as a procgen world.',
        where: [{ label: 'architecture.md § The Python round-trip', doc: `${ARCH}#the-python-round-trip` }],
        seeAlso: ['rules-json', 'preset-sidecars', 'procgen'],
    }),

    /* ══════════ SUBSTRATES ══════════════════════════════════════════ */

    t({
        id: 'substrate',
        term: 'a substrate',
        aliases: ['procedural substrate'],
        area: 'substrates',
        plain: 'One of the interchangeable little games that can fill a place in the world — '
            + 'a maze, a platformer, a text adventure.',
        detail: 'Substrates are pluggable per-region game engines, and a single generated '
            + 'world can mix them. Seven are registered: `maze`, `bounce`, `text_adventure`, '
            + '`flash`, `runner`, `jta`, `omsi`. Two kinds participate at build time — '
            + '**procedural** ones generate region geometry on demand, **[content sources]'
            + '(#content-source)** instantiate a pre-authored [zone](#zone) per ordinal. '
            + '⛔ Which are actually LIVE depends on the launch mode: `frontend/modes.json` '
            + 'maps modes to module-config variants, each enabling a different set.',
        where: [
            { label: 'architecture.md § Substrates at a glance', doc: `${ARCH}#substrates-at-a-glance` },
            { label: 'gotchas.md § Which substrates are live depends on the launch mode', doc: `${GOTCHAS}#which-substrates-are-live-depends-on-the-launch-mode` },
        ],
        seeAlso: ['substrate-registry', 'registry-entry', 'load-event', 'content-source'],
    }),
    t({
        id: 'substrate-registry',
        term: 'the substrate registry',
        aliases: [],
        area: 'substrates',
        plain: 'The lookup table that lets the rest of the system ask for "the maze" by name '
            + 'without knowing anything about mazes.',
        detail: 'Build-time generation and runtime playback both dispatch by id through '
            + '`shared/procgen/substrateRegistry.js`, so substrates and the pipeline stay '
            + 'decoupled. ⛔ **Substrate libraries register on IMPORT** and the headless '
            + 'scripts depend on that side effect — they are a separate boot context where no '
            + 'module `register()` runs. A substrate that fails to register is NOT an error: '
            + 'the pipeline just skips regions asking for it and the script exits 0 having '
            + 'written a world missing that substrate.',
        where: [
            { label: 'substrate-registry.md § Registry mechanics', doc: `${REGISTRY}#registry-mechanics` },
            { label: 'gotchas.md § Substrate libraries register on IMPORT', doc: `${GOTCHAS}#substrate-libraries-register-on-import--headless-scripts-depend-on-it` },
            { label: 'shared/procgen/substrateRegistry.js (submodule)', code: 'frontend/modules/shared/procgen/substrateRegistry.js' },
        ],
        seeAlso: ['substrate', 'registry-entry', 'load-event'],
    }),
    t({
        id: 'registry-entry',
        term: 'a registry entry',
        aliases: ['the entry contract'],
        area: 'substrates',
        plain: 'The form a game fills in to join: its name, how to draw it, how to save it, '
            + 'and what it can do.',
        detail: 'The contract is documented field by field in `substrate-registry.md`, in '
            + 'five groups — identity, runtime, playback, loop mode, and build time. '
            + '`loopSupport` declares what [loop-mode](#loop-mode) affordances its regions '
            + 'get; `victoryItem`, when a quota\'d substrate declares one, becomes the '
            + 'world\'s completion condition instead of a constant-true goal.',
        where: [{ label: 'substrate-registry.md § Entry contract', doc: `${REGISTRY}#entry-contract` }],
        seeAlso: ['substrate', 'substrate-registry', 'load-event', 'playback-controller'],
    }),
    t({
        id: 'load-event',
        term: 'a load event',
        aliases: ['loadRegion'],
        area: 'substrates',
        plain: 'The announcement that says "you are now here, draw it" to whichever game owns '
            + 'the place you just walked into.',
        detail: 'One per substrate — `maze:loadRegion`, `bounce:loadRegion`, '
            + '`runner:loadRegion`, `textAdventure:loadRegion`, `flash:loadRegion`, '
            + '`jta:loadRegion`, `omsi:loadRegion` — published by '
            + '[procgenPlayer](#procgen-player) with the deserialized world as payload. The '
            + 'substrate\'s panel subscribes and renders. ⚠ `bounceDemo` shares '
            + '`flashSubstrate`\'s CODE but registers its OWN identity, so bounce loads never '
            + 'configure the flash placeholder\'s bridge.',
        where: [
            { label: 'architecture.md § Runtime', doc: `${ARCH}#runtime-playing-a-generated-world` },
            { label: 'gotchas.md § bounceDemo shares flashSubstrate\'s code, not its identity', doc: `${GOTCHAS}#bouncedemo-shares-flashsubstrates-code-not-its-identity` },
        ],
        seeAlso: ['procgen-player', 'registry-entry', 'bounce-substrate', 'flash-substrate'],
    }),
    t({
        id: 'maze-substrate',
        term: 'the maze substrate',
        aliases: ['mazeRoom', '`maze`'],
        area: 'substrates',
        plain: 'The grid-of-tiles game: you walk a character around squares, push blocks, '
            + 'press buttons and open doors.',
        detail: 'Its state is `(player, blocks, inventory)` and its engine is '
            + '`mazeRoomEngine.js`. It has [biomes](#biome) and wall backends, hazards as '
            + 'content modules, an [autopather](#maze-lab), and — the reason it matters here '
            + '— it was the FIRST binding of the shared [loop core](#loop-core), so the '
            + '[area graph](#area-graph) and the first [element](#element) were built and '
            + 'proved on it before Seedling got them.',
        where: [
            { label: 'maze.md § The engine', doc: `${MAZE}#the-engine-mazeroomenginejs` },
            { label: 'maze.md § The maze as the second substrate on the procgen loop', doc: `${MAZE}#the-maze-as-the-second-substrate-on-the-procgen-loop` },
        ],
        seeAlso: ['maze-lab', 'bfs-oracle', 'area-graph', 'loop-core', 'skeleton-kind'],
    }),
    t({
        id: 'bounce-substrate',
        term: 'the bounce substrate',
        aliases: ['bounceDemo', '`bounce`'],
        area: 'substrates',
        plain: 'The Doodle-Jump-style game: you bounce upward from platform to platform.',
        detail: 'A vertical platformer with a physics-verified generator: the `canJump` '
            + 'solver decides whether one platform is reachable from another, and a '
            + 'derive-rules verifier checks the emitted access rules against the physics. Its '
            + 'level geometry is generated in the **[braid](#braid)** regime. It reuses '
            + '`flashSubstrate`\'s panel and bridge CODE under its own identity.',
        where: [
            { label: 'bounce.md § The canJump solver', doc: 'docs/json/developer/procgen/bounce.md#the-canjump-solver-canjumpjs' },
            { label: 'bounce.md § Level generation', doc: 'docs/json/developer/procgen/bounce.md#level-generation-generatorjs' },
        ],
        seeAlso: ['braid', 'flash-substrate', 'runner-substrate', 'substrate'],
    }),
    t({
        id: 'runner-substrate',
        term: 'the runner substrate',
        aliases: ['runnerDemo', '`runner`'],
        area: 'substrates',
        plain: 'The auto-runner game: the character runs forward on its own and you decide '
            + 'when to jump.',
        detail: 'A port of the GMTK toolkit physics, with a `canRun` solver built on a '
            + 'doom/touch/launch model, strip generation and spec planning, and a greedy '
            + 're-plan bot. Like bounce it reuses `flashSubstrate`\'s panel/bridge code under '
            + 'its own identity, and it participates in world building as a '
            + '[content source](#content-source).',
        where: [{ label: 'runner.md § The canRun solver', doc: 'docs/json/developer/procgen/runner.md#the-canrun-solver-canrunjs' }],
        seeAlso: ['bounce-substrate', 'content-source', 'substrate'],
    }),
    t({
        id: 'text-adventure-substrate',
        term: 'the text adventure substrate',
        aliases: ['`text_adventure`'],
        area: 'substrates',
        plain: 'The one you play by reading: the same grid of tiles, rendered as prose '
            + 'instead of pictures.',
        detail: 'A tile-grid engine whose output is prose, hosted in an iframe by '
            + '`textAdventureSubstrateWrapper` — that wrapper is the ENABLED path. A '
            + 'direct-panel module registers the same substrate id and is disabled in the '
            + 'default module config. ⛓ Being cheap to generate, it is the substrate an '
            + 'in-app test builds a synthetic world out of; expensive ones must load a '
            + 'committed preset instead.',
        where: [
            { label: 'text-adventure.md § The wrapper', doc: 'docs/json/developer/procgen/text-adventure.md#the-wrapper-frontendmodulestextadventuresubstratewrapper' },
            { label: 'gotchas.md § Generating a procgen world in-page can time out every iframe', doc: `${GOTCHAS}#generating-a-procgen-world-in-page-can-time-out-every-iframe` },
        ],
        seeAlso: ['substrate', 'load-event'],
    }),
    t({
        id: 'flash-substrate',
        term: 'the flash substrate',
        aliases: ['`flash`', '`__swfBridge`'],
        area: 'substrates',
        plain: 'The way an old Flash game, converted to run in a modern browser, becomes a '
            + 'place in the world.',
        detail: 'Recompiled Flash games (SWF→WASM) hosted in an iframe, speaking the '
            + '`__swfBridge` contract. It supplies the panel factory and bridge that '
            + '[bounce](#bounce-substrate) and [runner](#runner-substrate) reuse under their '
            + 'own identities, and `flash_seedling` is how a real game\'s map becomes procgen '
            + 'regions.',
        where: [{ label: 'flash.md § The `__swfBridge` contract', doc: 'docs/json/developer/procgen/flash.md#the-__swfbridge-contract' }],
        seeAlso: ['bounce-substrate', 'runner-substrate', 'seedling', 'load-event'],
    }),
    t({
        id: 'jta-substrate',
        term: 'the JtA substrate',
        aliases: ['`jta`', 'Journey to Ascension'],
        area: 'substrates',
        plain: 'The reference example of a game that brings its own hand-made areas, with the '
            + 'host lending out a shared pool of energy.',
        detail: 'The reference zone-based substrate, with host-side shared-mana brokering. '
            + '⛔ In **managed mode** the host owns zone transitions and the fork never calls '
            + '`advanceZone()` — engine code assuming otherwise loops forever. A second trap '
            + 'in the same family: a frozen substrate cannot generate the reset that unfreezes '
            + 'it, so a pin that masks the condition the host uses to decide a reset is due '
            + 'hangs both sides.',
        where: [
            { label: 'jta.md § Managed-mode zone invariants', doc: 'docs/json/developer/procgen/jta.md#managed-mode-zone-invariants' },
            { label: 'gotchas.md § A frozen substrate cannot generate the reset that unfreezes it', doc: `${GOTCHAS}#a-frozen-substrate-cannot-generate-the-reset-that-unfreezes-it` },
        ],
        seeAlso: ['zone', 'content-source', 'loop-mode', 'omsi-substrate'],
    }),
    t({
        id: 'omsi-substrate',
        term: 'the omsi substrate',
        aliases: ['`omsi`', 'Idle Loops'],
        area: 'substrates',
        plain: 'An idle game joined as a substrate — several places in the world all overlay '
            + 'the same town, and the host owns the clock.',
        detail: 'The `omsi-loops` fork of Idle Loops: host-owned clock, mana mirrored into '
            + 'the shared pool, N regions overlaying one town. It declares '
            + '`requiresLoopMode`, so it only participates when [loop mode](#loop-mode) is '
            + 'live. ⚠ Any automated multi-run walk over it must set `autoRestartQueue` ON, '
            + 'or the step gate closes on the fork and the walk polls a frozen world to its '
            + 'timeout.',
        where: [
            { label: 'omsi.md § Host-side clock and mana brokering', doc: 'docs/json/developer/procgen/omsi.md#host-side-clock-and-mana-brokering' },
            { label: 'loop-recording.md § autoRestartQueue governs the resets loops owns', doc: `${LOOPREC}#autorestartqueue-governs-the-resets-loops-owns` },
        ],
        seeAlso: ['loop-mode', 'jta-substrate', 'zone'],
    }),
    t({
        id: 'braid',
        term: 'braid',
        aliases: ['braid generator', 'Regime 1', 'Regime 2'],
        area: 'substrates',
        plain: 'The branching two-lane shape a bounce level is built in — NOT a way of laying '
            + 'out a whole world.',
        detail: '⛔ **"Braid" is not a pipeline driver.** The Mode toggle offers exactly four '
            + '[drivers](#layout-driver); braid names a bounce level-generation REGIME inside '
            + '`bounceDemo/generator.js` — the 2-wide branching-path geometry, in two regimes '
            + '(1: movement arrows free; 2: gated, where items gate progress). Braid code runs '
            + '*within* a driver\'s per-region realisation of bounce regions. ⚠ Only '
            + 'ITEM-GATED platforms must be one-way; lane blocking-freedom is not a '
            + 'requirement of the shape.',
        where: [
            { label: 'gotchas.md § "Braid" is not a pipeline driver', doc: `${GOTCHAS}#braid-is-not-a-pipeline-driver` },
            { label: 'bounce.md § Braid generators', doc: 'docs/json/developer/procgen/bounce.md#braid-generators' },
        ],
        seeAlso: ['bounce-substrate', 'layout-driver'],
    }),
    t({
        id: 'playback-controller',
        term: 'a playback controller',
        aliases: ['getPlaybackController'],
        area: 'substrates',
        plain: 'Each game\'s own answer to "walk over there" — because what walking means is '
            + 'different in a maze and in a platformer.',
        detail: 'The [playback bot](#playback-bot) resolves the current substrate\'s '
            + '`getPlaybackController()` from the [registry](#substrate-registry) and drives '
            + 'the controller directly, bypassing the eventBus, so each substrate implements '
            + 'its own semantics — bounce, for example, synthesizes real physics input. '
            + 'Iframe-hosted substrates speak the same contract through a proxy.',
        where: [{ label: 'playback-and-debugging.md § The PlaybackController contract', doc: `${PLAYBACK}#the-playbackcontroller-contract-and-iframe-proxies` }],
        seeAlso: ['playback-bot', 'registry-entry', 'substrate'],
    }),
    t({
        id: 'playback-bot',
        term: 'the playback bot',
        aliases: [],
        area: 'substrates',
        plain: 'The automatic player that walks a recorded route through a whole world to '
            + 'prove it can be finished.',
        detail: 'It walks a recorded sphere log through the world, resolving a '
            + '[playback controller](#playback-controller) per region. It is the layer the '
            + 'in-app round-trip test uses to drive a generated world through the real '
            + 'frontend from first check to Victory. ⚠ Not to be confused with the Seedling '
            + '[bot](#seedling), which drives ONE recompiled game with an input '
            + '[tape](#tape).',
        where: [{ label: 'playback-and-debugging.md § The playback bot', doc: `${PLAYBACK}#the-playback-bot-frontendmodulesplaybackbot` }],
        seeAlso: ['playback-controller', 'seedling', 'tape'],
    }),

    /* ══════════ LEVEL GENERATION — PASS 1 AND PASS 2 ════════════════ */

    t({
        id: 'level',
        term: 'a level',
        aliases: ['the room'],
        area: 'level-gen',
        plain: 'The contents of one place: a small grid with a way in, a way on, and things '
            + 'in between.',
        detail: 'What fills a SINGLE [region](#region) is a second, smaller pipeline with its '
            + 'own shape, shared by the two substrates that have a [lab page](#lab-page) and '
            + 'running over one substrate-neutral [loop core](#loop-core). A Seedling room is '
            + '10×10; a maze lab room is typically 15×15, which is why the '
            + '[area graph](#area-graph) accepts routinely there and rarely on Seedling.',
        where: [{ label: 'architecture.md § Level generation: two passes over one loop core', doc: TWO_PASS }],
        seeAlso: ['loop-core', 'pass-1', 'pass-2', 'region', 'lab-page'],
    }),
    t({
        id: 'loop-core',
        term: 'the loop core',
        aliases: ['levelGenerator', 'the Cloudberry loop'],
        area: 'level-gen',
        plain: 'The one piece of shared machinery that fills a place with things, whichever '
            + 'game that place happens to be.',
        detail: '`procgenCore/levelGenerator.js` — substrate-neutral. Its shape is: pick a '
            + '[template](#template), instantiate its parameters, offer '
            + '[anchors](#anchor), refuse the illegal ones by name, solve, keep or revert; '
            + 'stop at the [obstacle target](#obstacle-target) or at '
            + '[saturation](#saturation). ⛓ It has TWO bindings — Seedling '
            + '(`seedlingDemo/procgenSeedling.js`) and the maze '
            + '(`mazeRoom/procgenMaze.js`) — and the maze was the second.',
        where: [
            { label: 'architecture.md § Pass 2 — the keep-or-revert loop', doc: PASS2 },
            { label: 'maze.md § The maze as the second substrate on the procgen loop', doc: `${MAZE}#the-maze-as-the-second-substrate-on-the-procgen-loop` },
            { label: 'procgenCore/levelGenerator.js', code: 'frontend/modules/procgenCore/levelGenerator.js' },
        ],
        seeAlso: ['binding', 'pass-2', 'template', 'keep-or-revert'],
    }),
    t({
        id: 'binding',
        term: 'a binding',
        aliases: [],
        area: 'level-gen',
        plain: 'The adapter that teaches one particular game to speak the shared '
            + 'level-building machinery\'s language.',
        detail: 'The [loop core](#loop-core) and the [element](#element) constructors are '
            + 'substrate-neutral; a binding maps their vocabulary onto one substrate\'s own. '
            + 'The maze maps element tiles and symbols onto grid tiles and area symbols, '
            + 'Seedling maps them onto blocks, buttons and locks, and **neither re-derives '
            + 'the gadget\'s geometry** — that is the element contract, one shape across '
            + 'three bindings. A binding also supplies its own '
            + '[door law](#door-law) and its own [solver](#solver) for '
            + '[certification](#certification).',
        where: [{ label: 'maze.md § The first element', doc: MAZE_ELEMENT }],
        seeAlso: ['loop-core', 'element', 'door-law', 'certification'],
    }),
    t({
        id: 'pass-1',
        term: 'pass 1',
        aliases: ['the skeleton pass'],
        area: 'level-gen',
        plain: 'The first half of building a level: construct the things the level is ABOUT, '
            + 'and check they actually work.',
        detail: 'In draw order: the [goal](#goal) → the [element head](#element-head) → '
            + '[pre-carve elements](#pre-carve-element) → **[the carve](#the-carve)** → '
            + '[on-connector elements](#on-connector-element) → the '
            + '[area partition](#area-partition) and [area graph](#area-graph) → '
            + '[composites](#composite) → **[certification](#certification)**. ⚖ Design ruling '
            + '24 is the rule that separates the passes: **area is pass 1\'s job** — a pass-2 '
            + 'template that needs open space proposes only where pass 1 made some, and is '
            + 'honestly NO_ANCHOR elsewhere.',
        where: [{ label: 'architecture.md § Pass 1 — the skeleton, in draw order', doc: PASS1 }],
        seeAlso: ['pass-2', 'goal', 'element', 'the-carve', 'certification'],
    }),
    t({
        id: 'pass-2',
        term: 'pass 2',
        aliases: ['the decoration pass'],
        area: 'level-gen',
        plain: 'The second half: try one addition at a time, keep it if the level still '
            + 'works, undo it if it does not.',
        detail: 'The [keep-or-revert](#keep-or-revert) loop, now SITE-TYPED. What arc 3 added '
            + 'to it: [sites](#site) as a proposal distribution, the one flood-based '
            + '[door law](#door-law), bounded carving by templates, and the retirement of the '
            + 'three door templates into pass 1 — **the roster is decoration now**, '
            + '41/45 instantiations → **23/23**, three families (wall · water · pit), all '
            + '`site:\'chamber\'`.',
        where: [{ label: 'architecture.md § Pass 2 — the keep-or-revert loop, site-typed', doc: PASS2 }],
        seeAlso: ['pass-1', 'keep-or-revert', 'site', 'roster', 'template'],
    }),
    t({
        id: 'skeleton',
        term: 'the skeleton',
        aliases: [],
        area: 'level-gen',
        plain: 'The bare room before anything is put in it — walls, floor, a start and a goal.',
        detail: 'Everything [pass 1](#pass-1) constructs, before a single pass-2 '
            + '[template](#template) is drawn. ⛓ The empty bordered room is also the loop\'s '
            + 'own **[control arm](#control-arm)**: it is solvable by construction, so a '
            + 'skeleton solve that FAILS is a defect in the room builder — which is exactly '
            + 'the accusation a wall-clock budget once made on behalf of a busy machine.',
        where: [
            { label: 'architecture.md § Pass 1', doc: PASS1 },
            { label: 'gotchas.md § Generation used to be non-deterministic under load', doc: `${GOTCHAS}#generation-used-to-be-non-deterministic-under-load--fixed-2026-08-14-and-the-shape-of-the-fix-is-the-lesson` },
        ],
        seeAlso: ['skeleton-kind', 'the-carve', 'control-arm', 'pass-1'],
    }),
    /**
     * ⛓⛓⛓ PROCGEN ELEMENTS arc 5, slice 1 — **THE ROOM CONTRACT'S TWO TERMS**,
     * and the licence being spent is named (⚖ the count gate's own rule): the
     * user's arc-5 rulings 1 and 2 create two settings a reader meets on the
     * address bar (`?width=`/`?height=` and `?fill=`), and the URL-grammar
     * table refuses a parameter with no glossary term — the P5 finding that put
     * the ceiling at 149 in the first place.
     */
    t({
        id: 'room-size',
        term: 'the room size',
        aliases: ['`?width=`', '`?height=`', '60x60'],
        area: 'level-gen',
        plain: 'How many tiles wide and tall the generated room is.',
        detail: 'Two separate knobs, `?width=`/`?height=` and `--width=`/`--height=`, with the '
            + 'DEFAULT pinned at **10x10** — one screen (`camera.SCREEN_W / TILE_SIZE`), and '
            + 'the room every committed Seedling artifact was recorded in. ⛔ The maximum is '
            + '**60** on each axis and it is a MEASUREMENT of the shipped game, not a budget: '
            + 'the widest vanilla level is 40x60 and the tallest is 60x58, over the 116 in '
            + '`flashPanel/atlases/seedling-map.json`. Outside `[3..60]` REFUSES BY NAME and '
            + 'is never clamped. ⚠ A size is a CONSTANT INPUT and not a [draw](#draw), so a '
            + 'NAMED `width=10` and an omitted one build the same room cell for cell — the '
            + 'opposite of an [element](#element) parameter, where naming it spends no draw '
            + 'and omitting it spends one.',
        where: [
            { label: 'architecture.md § Pass 1', doc: PASS1 },
            { label: 'seedling-bot.md § The procgen ELEMENTS design', doc: SEEDLING },
        ],
        seeAlso: ['skeleton', 'skeleton-kind', 'room-fill', 'draw'],
    }),
    t({
        id: 'room-fill',
        term: 'the room fill',
        aliases: ['`?fill=`', 'the shell format', 'the closure law'],
        area: 'level-gen',
        plain: 'Whether the room writes a tile for every cell, or only for the floor and the '
            + 'wall that touches it.',
        detail: '`dense` (the default) writes every cell of the rectangle. `shell` writes the '
            + 'floor, the wall cells 8-adjacent to it, and NOTHING beyond — vanilla\'s own '
            + 'sparse form (27 of the 116 vanilla levels are sparse, down to 20% filled). '
            + '⛔ **NULL IS NOT WALL**: `levelWorld` builds solids only from the entries a '
            + 'record HAS, and so does the real game, so an absent cell has no collision '
            + 'anywhere. ⛔ Hence **THE CLOSURE LAW** — *no floor cell may be 4-adjacent to '
            + 'an absent cell* — refused by name over every shell record, and a pass-2 CARVE '
            + 'beside an absent cell refused for the same reason. ⛓ The room is generated '
            + 'DENSE and STRIPPED at the end of a pass, so every legality rule keeps reading '
            + 'the dense room; what the strip buys is measured, and it is **0%** on an open '
            + 'room and **~50-82%** of the record\'s bytes on a carved one.',
        where: [
            { label: 'architecture.md § Pass 1', doc: PASS1 },
            { label: 'seedling-bot.md § The procgen ELEMENTS design', doc: SEEDLING },
        ],
        seeAlso: ['room-size', 'level', 'skeleton', 'graded-refusal'],
    }),
    t({
        id: 'skeleton-kind',
        term: 'a skeleton kind',
        aliases: ['`?skeleton=`', 'tree kind', 'carved kind'],
        area: 'level-gen',
        plain: 'Which shape of room to start from — a plain box, a winding corridor, a set of '
            + 'chambers, and so on.',
        detail: 'Seven, in `procgenCore/skeletonKinds.js`: `empty` · `winding` · `branchy` · '
            + '`bushy` · `loopy` · `open` · `rooms`, with parameters '
            + '[`chambers=k`](#chambers) / `minRoom` / `prune`. ⚖ Ruling 2: **the kinds ARE '
            + 'the maze biome names**, one vocabulary across both substrates. Spelled '
            + '`?skeleton=<kind>[;k=v]…` and NEVER `?biome=` — that one selects the '
            + '[palette](#palette). ⛔ Changing it RESETS the ladder, because the room a '
            + 'ladder is built in is part of the level\'s identity.',
        where: [
            { label: 'the REFERENCE page § Skeleton kinds — codec vs EFFECTIVE defaults per substrate, generated', code: REFERENCE },
            { label: 'maze.md § Kind parameters', doc: `${MAZE}#kind-parameters-constructive-mode-slice-7` },
            { label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE },
        ],
        seeAlso: ['the-carve', 'chambers', 'biome', 'skeleton'],
    }),
    t({
        id: 'the-carve',
        term: 'the carve',
        aliases: ['carving', 'the carver'],
        area: 'level-gen',
        plain: 'Digging the room\'s corridors and open spaces out of solid rock.',
        detail: 'The maze algorithms reused as corridor/chamber carvers, run over the whole '
            + 'grid — and their answer INSIDE a reserved element rectangle is discarded, which '
            + 'is how a [pre-carve element](#pre-carve-element) survives it. The carve is also '
            + 'called **the [connector](#connector)** in ledger and legend text. ⛔ A pass-2 '
            + 'template MAY carve, bounded: the write must be on untouched skeleton terrain, '
            + 'the carved cells one 4-connected blob with exactly one '
            + '[mouth](#mouth) (a dead end), and the start→goal path may not get shorter.',
        where: [
            { label: 'architecture.md § Pass 1', doc: PASS1 },
            { label: 'architecture.md § Pass 2', doc: PASS2 },
        ],
        seeAlso: ['connector', 'skeleton-kind', 'chambers', 'mouth', 'pre-carve-element'],
    }),
    t({
        id: 'connector',
        term: 'the connector',
        aliases: [],
        area: 'level-gen',
        plain: 'The step that joins the room up — the same thing as the carve, named for what '
            + 'it achieves rather than how.',
        detail: 'The `carve` [ledger](#ledger) row is the connector\'s: it names the kind and '
            + 'the effective parameters, and its tile delta IS the carve. '
            + '[Pre-carve](#pre-carve-element) elements are constructed BEFORE it and '
            + '[on-connector](#on-connector-element) elements AFTER it — that is what the two '
            + 'names mean.',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['the-carve', 'pre-carve-element', 'on-connector-element', 'ledger'],
    }),
    t({
        id: 'chambers',
        term: '`chambers`',
        aliases: ['`chambers=1`', 'a chamber'],
        area: 'level-gen',
        plain: 'How many wide open spaces to hollow out of an otherwise corridor-like room.',
        detail: '⚖ **Seedling\'s five carved tree kinds default `chambers` to 1** while the '
            + 'shared codec\'s default is 0 — kept over those five kinds **4 → 102** of 120 '
            + 'pre-sword and **4 → 105** post-sword, against `chambers=2`\'s 113/103. ⛓ That '
            + 'difference forces a rule on every reader: `winding` and `winding;chambers=0` '
            + 'normalise to the same object, so the URL reader must hand the string **as '
            + 'typed** to the resolver and the writer must spell the parameter explicitly, or '
            + 'a typed `0` is unspellable in a link. ⛔ And a SCHEMA default is a spelling '
            + 'rule, not a construction rule: moving `CHAMBERS_PARAM.default` changes which '
            + 'parameters get written out and produces a byte-identical maze.',
        where: [
            { label: 'gotchas.md § A SCHEMA DEFAULT is a spelling rule, not a construction rule', doc: `${GOTCHAS}#a-schema-default-is-a-spelling-rule-not-a-construction-rule` },
            { label: 'architecture.md § Pass 1', doc: PASS1 },
        ],
        seeAlso: ['skeleton-kind', 'the-carve', 'chamber', 'url-parameter'],
    }),
    t({
        id: 'goal',
        term: 'the goal',
        aliases: ['GOAL_MIN_FROM_START'],
        area: 'level-gen',
        plain: 'The place you are trying to reach — chosen first, and never right next to '
            + 'where you start.',
        detail: 'The [stream](#rng-stream)\'s FIRST draw, at Manhattan distance **≥ 3** from '
            + 'the start (`GOAL_MIN_FROM_START = 3`). At distance *m* the shortest path is '
            + '≥ *m+1* cells, so *m ≥ 3* is what makes *a door element is never refused for '
            + 'the goal\'s position alone* a PROOF rather than a margin. The goal also gets a '
            + 'declared radius-2 **[vestibule](#vestibule)** so no area lock can land on its '
            + 'doorstep.',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['vestibule', 'pass-1', 'draw', 'cut'],
    }),
    t({
        id: 'element',
        term: 'an element',
        aliases: ['a gadget', '`?elements=`'],
        area: 'level-gen',
        plain: 'A whole little contraption built into the level on purpose — a block to push, '
            + 'a switch to press, a door it opens — rather than a single obstacle dropped in.',
        detail: 'The thing [pass 1](#pass-1) constructs and the level is ABOUT. Two phases: '
            + '[pre-carve](#pre-carve-element) and [on-connector](#on-connector-element). '
            + 'Three ship: the [guard](#guard), the [kill gate](#kill-gate) and the '
            + '[block pocket](#block-pocket). ⛔ **`?elements=` ABSENT ≠ `none`**: absent is '
            + '*nobody said* and reaches the biome DEFAULT SPEC, while `?elements=none` is a '
            + 'CHOICE that turns it off. An element that fails '
            + '[certification](#certification) is DROPPED, never shipped uncertified.',
        where: [
            { label: 'the REFERENCE page § Elements — every head, its `needs` and its parameters, generated', code: REFERENCE },
            { label: 'architecture.md § Pass 1', doc: PASS1 },
            { label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE },
        ],
        seeAlso: ['element-head', 'guard', 'kill-gate', 'block-pocket', 'certification'],
    }),
    t({
        id: 'element-head',
        term: 'the element head',
        aliases: ['`ELEMENT_TABLE`', 'the biome default spec'],
        area: 'level-gen',
        plain: 'Which contraption this level gets — picked from what the player is already '
            + 'carrying when the level begins.',
        detail: 'With nothing asked, `defaultElementsFor(items)` supplies the **biome default '
            + 'spec**: `guard;len=2+blockpocket` pre-sword, `guard;len=2+killgate+blockpocket` '
            + 'post-sword. ⛓ **A `+` list is a CHOICE** — one `rng.pick`, because one block '
            + 'per level forbids a conjunction. `ELEMENT_TABLE.<head>.needs` gates a head '
            + 'against the biome\'s [boot items](#boot-items) for free: a pre-sword '
            + '`killgate` refuses without spending a solve.',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['element', 'biome', 'boot-items', 'require-directive'],
    }),
    t({
        id: 'pre-carve-element',
        term: 'a `pre-carve` element',
        aliases: [],
        area: 'level-gen',
        plain: 'A contraption built into the room BEFORE the corridors are dug, in its own '
            + 'reserved rectangle.',
        detail: 'Constructed in absolute coordinates inside a snug rectangle the '
            + '[binding](#binding) offers, writing its whole site — floor AND wall. The '
            + '[carve](#the-carve) then runs over the whole grid and its answer inside that '
            + 'rectangle is discarded. TWO are shipped: the reverse-pull block gadget '
            + '([the guard](#guard)) at `turns = 0` — `turns > 0` refuses '
            + '`the-chain-is-arc-4` by name and spends no draw — and '
            + '[the chamber](#chamber-element), which is floor and nothing else. ⛓ A DOORLESS '
            + 'one takes no flag, no lock and no tag, and the binding asks what it DECLARED '
            + 'rather than which element it is. ⚠ Its rectangle is the '
            + 'ELEMENT\'s own declared SNUG FOOTPRINT, offered in every orientation: a '
            + 'straight lane is `len+2` along the pull axis by 4 across, so a len-4 gadget '
            + 'is offered 6x4 AND 4x6 rather than the 6x6 square the binding used to size. '
            + 'An element that declares none is offered the binding\'s square, which is how '
            + 'the maze binding stayed byte-identical.',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['guard', 'the-carve', 'on-connector-element', 'element'],
    }),
    t({
        id: 'on-connector-element',
        term: 'an `on-connector` element',
        aliases: [],
        area: 'level-gen',
        plain: 'A contraption added AFTER the corridors exist, which reads the room it landed '
            + 'in and writes only a few cells.',
        detail: 'Handed a read-only room probe (`floorAt`, `mainPath`, `isCut`, '
            + '`connectedWith`, the binding\'s own [`doorLaw`](#door-law)) and writing '
            + '**sparsely** — ⛓ *a door does not make an area, it cuts one*. Two ship: the '
            + '[kill gate](#kill-gate) and the [block pocket](#block-pocket).',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['kill-gate', 'block-pocket', 'door-law', 'candidate-funnel'],
    }),
    t({
        id: 'guard',
        term: 'the guard',
        aliases: ['reverse-pull block', '`guard;len=2`'],
        area: 'level-gen',
        plain: 'A block you have to drag backwards onto a switch, which holds a door open.',
        detail: 'The `reverse-pull-block` gadget, `procgenCore/elements/reversePullBlock.js` — '
            + 'the FIRST element and the one built on all three bindings. It is constructed '
            + 'PRE-CARVE in a reserved rectangle, joined to the room by the shortest tunnel, '
            + 'with its [flag](#flag) (`buttonroom`) and the flag\'s LOCK on a main-path '
            + '[cut](#cut). Its [lifted claim](#lifted-claim) is *a block was on the button at '
            + 'the tick the door was first crossed*. Certifies **32 of 34** placements.',
        where: [
            { label: 'maze.md § The guard', doc: `${MAZE}#the-guard` },
            { label: 'architecture.md § Pass 1', doc: PASS1 },
        ],
        seeAlso: ['element', 'pre-carve-element', 'flag', 'lifted-claim', 'certification'],
    }),
    t({
        id: 'kill-gate',
        term: 'the kill gate',
        aliases: ['`killgate`'],
        area: 'level-gen',
        plain: 'A locked door whose key is a creature: kill the thing in the pocket beside it '
            + 'and the door opens.',
        detail: 'An [on-connector](#on-connector-element) element: a lock on a main-path '
            + '[cut](#cut) whose wall is **GROWN** until it meets the room (0 cells on a '
            + 'corridor, 7 on the open 10×10 room), with the body whose death opens it in a '
            + 'start-side pocket. It declares a **[demand](#demand)**. Certifies **6 of 28** '
            + 'post-sword — ⚠ *the number to beat*; the 22 refusals are one pre-existing '
            + 'solver class.',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['demand', 'on-connector-element', 'cut', 'certification', 'grade'],
    }),
    t({
        id: 'block-pocket',
        term: 'the block pocket',
        aliases: ['`blockpocket`'],
        area: 'level-gen',
        plain: 'A block standing in a doorway, with a straight run behind it ending in a dead '
            + 'end to push it into.',
        detail: 'The second [on-connector](#on-connector-element) element. The block stands IN '
            + 'the door cell, so its [clearer](#clearer) is EMPTY — there is no separate thing '
            + 'to reach — and the run ends at the FIRST cell along the push where the room '
            + 'reconnects. ⛓ Clause (a) of the carve law admits a **[dead end](#mouth) and '
            + 'nothing else**: exactly one 4-neighbour of the carved blob is walkable once the '
            + 'placement is painted; two mouths would be a TUNNEL. Certifies **36 of 36**.',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['clearer', 'mouth', 'on-connector-element', 'certification'],
    }),
    t({
        id: 'chamber-element',
        term: 'the chamber element',
        aliases: ['`chamber`', 'open-chamber', 'the element that is SPACE'],
        area: 'level-gen',
        plain: 'An open room built into the level on purpose, so a key has somewhere to live.',
        detail: 'A [pre-carve](#pre-carve-element) element that is nothing but floor: an open '
            + '`w × h` blob DECLARED as an [area](#area), a mouth for the '
            + '[connector](#connector), and no block, no button, no door, no '
            + '[symbol](#symbol) and no [tag](#tag). ⛓ It exists because of a measurement '
            + 'rather than an argument: a bare tree [skeleton kind](#skeleton-kind) accepts '
            + '`--areas=2` on **0 of 264** cells at every size from 10×10 to 30×30, because a '
            + 'bigger tree room grows [corridor](#corridor) and not [chambers](#chamber) — '
            + 'what it lacks is a PLACE, and no amount of room gives it one. ⚠ Its blob is a '
            + 'chamber by the 2×2 rule on its own merits and is declared anyway, so the '
            + '[partition](#area-partition) never has to find it. ⛔ It is NOT in any biome '
            + 'default: `--elements=chamber;w=2;h=3` is how a room asks for one.',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['pre-carve-element', 'chamber', 'area', 'area-partition', 'element-head'],
    }),
    t({
        id: 'demand',
        term: 'a demand',
        aliases: ['the element\'s DEMAND region'],
        area: 'level-gen',
        plain: 'A patch of the room an element reserves, saying "whatever you decorate later, '
            + 'do not make this part deadly".',
        detail: 'The [kill gate](#kill-gate) declares one: the connected REGION its body can '
            + 'reach must stay floor and the walls confining it must stay wall, because the '
            + 'body is a diagonal billiard rather than an axis runner. ⛓ Before the demand, '
            + '2 of 10 certified gates were opened by *water* rather than by the sword; after '
            + 'it, **17 of 17 `sword`**. ⚠ A geometry demand for a MOVING body is a REGION, '
            + 'not a shape. ⛔ And a constraint that removes an engine failure class is not a '
            + 'FIX — it MOVED which cell meets it.',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['kill-gate', 'pass-2', 'grade', 'require-directive'],
    }),
    t({
        id: 'door-law',
        term: 'the door law',
        aliases: ['a door is a cut', 'door = cut', '`doorLaw`'],
        area: 'level-gen',
        plain: 'A door only counts as a door if closing it really does separate you from the '
            + 'goal — and the thing that opens it is on your side.',
        detail: 'ONE flood-based law, every kind: with the row\'s terrain painted and its '
            + '`doorCells` walled, the goal is unreachable from the start (**CUT**), and every '
            + '[`clearer`](#clearer) cell is still reachable from the start '
            + '(**START-SIDE**). It replaced the interior-span law and `doorClear`, unified '
            + 'rather than kinds-scoped ON THE EVIDENCE — 40 seeds × 20 instantiations, '
            + '**zero disagreements** with the retired predicate.',
        where: [{ label: 'architecture.md § Pass 2', doc: PASS2 }],
        seeAlso: ['cut', 'clearer', 'flood', 'pass-2', 'door-cells'],
    }),
    t({
        id: 'cut',
        term: 'a cut',
        aliases: ['CUT', '`isCut`'],
        area: 'level-gen',
        plain: 'A single place that, if you wall it off, really does split the room in two.',
        detail: 'The load-bearing test behind every lock in the system: a lock is a CUT, not '
            + 'decoration (⚖ ruling 17). The picture of it is two [floods](#flood) — the room '
            + 'with the lock cell walled — with the goal in the far component and the '
            + '[flag](#flag) that opens it in the near one. On the maze, every placed '
            + '[symbol](#symbol) is a cut **148 of 148**.',
        where: [
            { label: 'architecture.md § Pass 1', doc: PASS1 },
            { label: 'maze.md § The area graph', doc: MAZE_AREAS },
        ],
        seeAlso: ['door-law', 'flood', 'lock', 'flag', 'requirements-differential'],
    }),
    t({
        id: 'clearer',
        term: 'the clearer',
        aliases: [],
        area: 'level-gen',
        plain: 'The thing you have to reach in order to open the door — the switch, the '
            + 'block, the creature.',
        detail: 'Half of the [door law](#door-law): every clearer cell must still be '
            + 'reachable from the start once the door is walled, or the door is a lock with '
            + 'its own key behind it. ⛓ It can legitimately be **EMPTY** — the '
            + '[block pocket](#block-pocket)\'s block stands IN the door cell, so there is no '
            + 'separate thing to reach.',
        where: [{ label: 'architecture.md § Pass 2', doc: PASS2 }],
        seeAlso: ['door-law', 'block-pocket', 'cut', 'door-cells'],
    }),
    t({
        id: 'site',
        term: 'a site',
        aliases: ['`site:`', 'SITES'],
        area: 'level-gen',
        plain: 'A kind of spot in the room — a corner, a dead end, an open middle — used to '
            + 'suggest where a thing might sensibly go.',
        detail: '`procgenCore/sites.js` derives six classes once per model from the carved '
            + 'skeleton: `main` · `bend` · `branch` · `tip` · [`chamber`](#chamber) · '
            + '[`corridor`](#corridor). A row declares one `site:` class; the default '
            + '`\'any\'` is the whole interior, so a row that declares nothing is '
            + '[byte-inert](#byte-inert). ⛔⛔ **A site is a PROPOSAL DISTRIBUTION, never a '
            + 'legality rule** — nothing is refused for standing off one.',
        where: [
            { label: 'architecture.md § Pass 2', doc: PASS2 },
            { label: 'seedling-bot.md § arc 3, slice 1', doc: `${SEEDLING}#arc-3-slice-1--arrow-lane-out-and-pass-2-learns-sites-2026-08-16` },
            { label: 'procgenCore/sites.js', code: 'frontend/modules/procgenCore/sites.js' },
        ],
        seeAlso: ['chamber', 'corridor', 'anchor', 'byte-inert', 'overlay-layer'],
    }),
    t({
        id: 'chamber',
        term: 'a chamber',
        aliases: [],
        area: 'level-gen',
        plain: 'A wide open part of the room, as opposed to a one-square-wide passage.',
        detail: 'Both a [site](#site) class and the unit the [area partition](#area-partition) '
            + 'is built from: a cell is WIDE iff it belongs to at least one all-floor 2×2 '
            + 'square, and an [area](#area) is a maximal 4-connected blob of wide cells. ⚠ '
            + 'Measured at 11×11: an un-chambered corridor carve has **zero** real chambers — '
            + 'a 1-wide maze has no 2×2 square anywhere — and `rooms` yields **3–8**. All '
            + 'three surviving pass-2 template families declare `site:\'chamber\'`.',
        where: [
            { label: 'maze.md § The area graph', doc: MAZE_AREAS },
            { label: 'architecture.md § Pass 2', doc: PASS2 },
        ],
        seeAlso: ['site', 'area', 'chambers', 'wide-cell', 'corridor', 'chamber-element'],
    }),
    t({
        id: 'corridor',
        term: 'a corridor cell',
        aliases: [],
        area: 'level-gen',
        plain: 'A one-square-wide passage — floor, but not part of any open space.',
        detail: 'A [site](#site) class, and in the [area partition](#area-partition) every '
            + 'floor cell that is not [wide](#wide-cell): i.e. an **EDGE** of the area graph '
            + 'rather than a node.',
        where: [{ label: 'maze.md § The area graph', doc: MAZE_AREAS }],
        seeAlso: ['site', 'chamber', 'area-partition', 'wide-cell'],
    }),
    t({
        id: 'wide-cell',
        term: 'a wide cell',
        aliases: ['WIDE'],
        area: 'lock-and-key',
        plain: 'A floor square with enough room around it to be part of an open space rather '
            + 'than a passage.',
        detail: 'ONE rule, two substrates: **a cell is WIDE iff it belongs to at least one '
            + 'all-floor 2×2 square** (`procgenCore/areaPartition.js`). Everything the '
            + '[area partition](#area-partition) does follows from it.',
        where: [{ label: 'maze.md § The area graph', doc: MAZE_AREAS }],
        seeAlso: ['area-partition', 'chamber', 'corridor'],
    }),
    t({
        id: 'mouth',
        term: 'a mouth',
        aliases: ['dead end', 'one mouth', 'carve-mouth'],
        area: 'level-gen',
        plain: 'The single opening of a pocket — one way in and out, which is what makes it a '
            + 'place to stand rather than a shortcut.',
        detail: 'Clause (a) of the carve law: **exactly one** 4-neighbour of the whole carved '
            + 'blob is walkable once the placement is painted. ⛓ Two mouths would be a '
            + 'TUNNEL — a change to the room\'s connectivity rather than a place to stand. The '
            + '[guard](#guard)\'s gadget has an entry mouth joined by the shortest tunnel and '
            + 'its **exit mouth SEALED**: with both open the door is not a cut on ~30% of '
            + 'runs.',
        where: [
            { label: 'architecture.md § Pass 2', doc: PASS2 },
            { label: 'architecture.md § Pass 1', doc: PASS1 },
        ],
        seeAlso: ['the-carve', 'block-pocket', 'composite', 'cut'],
    }),
    t({
        id: 'area',
        term: 'an area',
        aliases: ['`?areas=`'],
        area: 'lock-and-key',
        plain: 'One open space in the room, treated as a single place for the purpose of '
            + 'locking it.',
        detail: 'A maximal 4-connected blob of [wide cells](#wide-cell); every other floor '
            + 'cell is a [corridor](#corridor) cell, i.e. an edge. A one-cell area is GROWN on '
            + 'the entrance and on the goal when they do not fall inside a chamber, and floor '
            + 'the entrance cannot reach is not partitioned at all. ⚠ Acceptance on a 10×10 '
            + 'Seedling room is **0–4 of 12 seeds per kind** and the cause is the AREA COUNT — '
            + 'published, not tuned; most seeds refuse with '
            + '`the-partition-yields-one-area-or-fewer`.',
        where: [{ label: 'maze.md § The area graph', doc: MAZE_AREAS }],
        seeAlso: ['area-partition', 'area-graph', 'wide-cell', 'synthetic-area', 'graded-refusal'],
    }),
    t({
        id: 'area-partition',
        term: 'the area partition',
        aliases: [],
        area: 'lock-and-key',
        plain: 'Chopping the room into named open spaces joined by passages.',
        detail: '`procgenCore/areaPartition.js` — **one rule, two substrates** '
            + '([wide cells](#wide-cell) → [areas](#area) → [corridor](#corridor) edges). It '
            + 'is the input the [area graph](#area-graph) grows its lock-and-key tree over, '
            + 'and it is drawn by the `areas` [overlay layer](#overlay-layer), one selectable '
            + 'line per area.',
        where: [
            { label: 'architecture.md § Pass 1', doc: PASS1 },
            { label: 'procgenCore/areaPartition.js', code: 'frontend/modules/procgenCore/areaPartition.js' },
        ],
        seeAlso: ['area', 'area-graph', 'wide-cell', 'overlay-layer'],
    }),
    t({
        id: 'area-graph',
        term: 'the area graph',
        aliases: ['the lock-and-key layer'],
        area: 'lock-and-key',
        plain: 'A plan that says which open spaces are locked, and which space holds the key '
            + 'to each — so the room has to be explored in an order.',
        detail: '`procgenCore/areaGraph.js`, a JS re-implementation of MetaZelda\'s '
            + 'lock-and-key logic, growing a tree over the [areas](#area) in '
            + '[key levels](#key-level). Asked for with `--areas=<keys>` / `?areas=` through '
            + 'one codec. ⛔ **At `keys: 0` — the default — nothing here runs at all**: no '
            + 'partition, no call, no draw, and every seed→level pair is byte-identical. '
            + '⛓ It is VERIFIED, not assumed — see [realisation](#realisation).',
        where: [
            { label: 'maze.md § The area graph', doc: MAZE_AREAS },
            { label: 'procgenCore/areaGraph.js', code: 'frontend/modules/procgenCore/areaGraph.js' },
        ],
        seeAlso: ['area', 'key-level', 'lock', 'flag', 'realisation', 'graphify'],
    }),
    t({
        id: 'key-level',
        term: 'a key level',
        aliases: ['level 0', 'level-n flood'],
        area: 'lock-and-key',
        plain: 'How many keys deep into the room a space is — level 0 is what you can reach '
            + 'with none.',
        detail: 'The **level-n flood** is the verification: for each key level *n*, with every '
            + 'door above level *n* treated as wall, the flood from the entrance must equal '
            + 'exactly the areas of level ≤ *n* plus the corridor components touching them. '
            + '⛓ A locked edge is a [cut](#cut) BY CONSTRUCTION of the tree; the flood is the '
            + 'check that the GRID agrees, which is the one thing construction cannot promise.',
        where: [{ label: 'maze.md § The area graph', doc: MAZE_AREAS }],
        seeAlso: ['area-graph', 'flood', 'realisation', 'cut'],
    }),
    t({
        id: 'lock',
        term: 'a lock',
        aliases: ['`door_K`', 'boundary lock'],
        area: 'lock-and-key',
        plain: 'A door that will not open until you are carrying the right thing.',
        detail: '⛓ **The lock is a property of the AREA, not of the edge**: for every area at '
            + 'key level L ≥ 1, `door_K{L-1}` is placed on **every boundary cell** of that '
            + 'area. On a tree edge that is exactly the edge\'s own symbol at the child\'s '
            + 'mouth; it additionally covers junction corridors touching three areas, and the '
            + 'cycles the tree did not take — which a per-edge door would simply be walked '
            + 'around. **Nothing is carved and nothing is walled to make this true.**',
        where: [{ label: 'maze.md § The area graph', doc: MAZE_AREAS }],
        seeAlso: ['flag', 'symbol', 'area-graph', 'cut', 'door-cells'],
    }),
    t({
        id: 'door-cells',
        term: '`doorCells`',
        aliases: ['the door cell'],
        area: 'lock-and-key',
        plain: 'The exact squares the door occupies — the ones the law walls off to test it.',
        detail: 'A row declares them; the [door law](#door-law) walls them and floods. On the '
            + '[maze lab](#maze-lab) an [area](#area) lock is placed on **every boundary '
            + 'cell** of the locked area rather than on one edge, which is what makes it a '
            + 'cut a player cannot simply walk around.',
        where: [{ label: 'maze.md § The area graph', doc: MAZE_AREAS }],
        seeAlso: ['door-law', 'lock', 'area', 'clearer'],
    }),
    t({
        id: 'flag',
        term: 'a flag',
        aliases: ['the key', '`key_K`', '`buttonroom`'],
        area: 'lock-and-key',
        plain: 'The thing you pick up that opens a particular lock.',
        detail: '`key_K{n}` is drawn into a NON-boundary cell of the area the module assigned '
            + 'the [symbol](#symbol) to, and per-instance `obstacleLib`/`itemLib` entries '
            + '(`door_K0 → key_K0`) are carried in the payload — without them '
            + '`isObstacleCleared` treats the id as unknown and **the door opens for '
            + 'everybody**. On Seedling the [guard](#guard)\'s flag is a `buttonroom` and it '
            + 'must sit in the START-side component of its lock\'s [cut](#cut).',
        where: [{ label: 'maze.md § The area graph', doc: MAZE_AREAS }],
        seeAlso: ['lock', 'symbol', 'cut', 'guard'],
    }),
    t({
        id: 'symbol',
        term: 'a symbol',
        aliases: ['`K0`', '`K1`'],
        area: 'lock-and-key',
        plain: 'The name of one lock-and-key pair, so a run can be asked for that pair by name.',
        detail: 'The maze\'s [`?require=`](#require-directive) names an area-graph SYMBOL '
            + '(`K0`), where Seedling\'s names an ITEM FLAG (`hasSword`) — the same parameter '
            + 'spelling over two different vocabularies. A met symbol on the maze is graded '
            + '**STRONG** and that is the only [grade](#grade) reachable there, because the '
            + 'BFS differential is a proof rather than an estimate.',
        where: [{ label: 'maze.md § The area graph', doc: MAZE_AREAS }],
        seeAlso: ['require-directive', 'grade', 'lock', 'flag', 'bfs-oracle'],
    }),
    t({
        id: 'graphify',
        term: '`graphify`',
        aliases: [],
        area: 'lock-and-key',
        plain: 'How often the lock plan is allowed an extra connection, so the room is not a '
            + 'plain branching tree.',
        detail: 'MetaZelda\'s extra-edge probability, default **0.2**, one of the knobs in the '
            + '`--areas=<keys>[;key=value]…` codec beside `goalShortcut` (which admits the '
            + 'post-solve entrance↔exit shortcut, default on). Graphify edges are drawn dashed '
            + 'in the maze lab\'s area legend.',
        where: [{ label: 'maze.md § The area graph', doc: MAZE_AREAS }],
        seeAlso: ['area-graph', 'key-level', 'maze-lab'],
    }),
    t({
        id: 'vestibule',
        term: 'the vestibule',
        aliases: ['the goal\'s VESTIBULE'],
        area: 'lock-and-key',
        plain: 'A little cleared porch around the goal, so nothing gets locked directly onto '
            + 'its doorstep.',
        detail: 'A **[synthetic area](#synthetic-area) of radius 2** grown around the '
            + '[goal](#goal) on Seedling, declared so that no [lock](#lock) can land there. It '
            + 'is one of the [paintables](#paintable) on the `realisation` '
            + '[ledger](#ledger) row.',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['goal', 'synthetic-area', 'realisation', 'paintable'],
    }),
    t({
        id: 'synthetic-area',
        term: 'a synthetic area',
        aliases: ['SYNTHETIC'],
        area: 'lock-and-key',
        plain: 'An area that was grown deliberately rather than found in the room\'s shape.',
        detail: 'The one-cell areas grown on the entrance and the goal when they do not fall '
            + 'inside a chamber, and the goal\'s [vestibule](#vestibule). ⛔ On the overlay a '
            + 'synthetic area is **dash-outlined, never filled**: it is not a '
            + '[chamber](#chamber) and must not read as one.',
        where: [{ label: 'maze.md § The area graph', doc: MAZE_AREAS }],
        seeAlso: ['area', 'vestibule', 'overlay-layer', 'chamber'],
    }),
    t({
        id: 'realisation',
        term: 'realisation',
        aliases: [],
        area: 'lock-and-key',
        plain: 'Turning the lock plan into actual doors and keys on actual squares — and '
            + 'checking the room agrees.',
        detail: 'It puts a [lock](#lock) on every boundary cell of an area at key level ≥ 1 '
            + 'and its [flag](#flag) inside the area holding the symbol, then runs the '
            + '[level-n flood](#key-level). ⛔ **When the flood DISAGREES the graph refuses and '
            + 'the level ships carved** — and the refusal writes its own `realisation` '
            + '[ledger](#ledger) row carrying the offending level\'s flood, which is the '
            + 'picture the refusal is about.',
        where: [
            { label: 'maze.md § The area graph', doc: MAZE_AREAS },
            { label: 'architecture.md § Pass 1', doc: PASS1 },
        ],
        seeAlso: ['area-graph', 'key-level', 'graded-refusal', 'ledger', 'flood'],
    }),
    t({
        id: 'composite',
        term: 'a composite',
        aliases: [],
        area: 'level-gen',
        plain: 'The finishing touches that join a contraption to the room it was built beside.',
        detail: 'The last pass-1 phase, and it **spends no draw**: the element\'s ring '
            + 're-walled, its entry [mouth](#mouth) joined by the shortest tunnel, its exit '
            + 'mouth SEALED, the [flag](#flag) placed and its [lock](#lock) realised.',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['mouth', 'element', 'flag', 'lock', 'draw'],
    }),
    t({
        id: 'certification',
        term: 'certification',
        aliases: ['certified', 'the certification solve'],
        area: 'level-gen',
        plain: 'Actually playing the half-built level with the game\'s own solver to prove the '
            + 'contraption can be used — before decorating anything.',
        detail: 'The substrate\'s OWN [solver](#solver) run against the '
            + '[skeleton](#skeleton), once, before pass 2 exists. Seedling\'s is the R8 bot '
            + 'plus S1\'s nested openers; the maze\'s is the exact [BFS](#bfs-oracle). '
            + 'Each certification carries a **[lifted claim](#lifted-claim)**. ⛔ **A failed '
            + 'certification is a [graded refusal](#graded-refusal) by name and the element is '
            + 'DROPPED — never shipped uncertified**, and the overlay then draws no element '
            + 'group at all, with the reason as a [legend](#legend) row.',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['solver', 'lifted-claim', 'graded-refusal', 'element', 'oracle'],
    }),
    t({
        id: 'lifted-claim',
        term: 'a lifted claim',
        aliases: [],
        area: 'level-gen',
        plain: 'The specific sentence a successful solve is taken to have proved — not just '
            + '"it finished", but "it used the thing".',
        detail: 'For the [guard](#guard): *a block was on the button at the tick the door was '
            + 'first crossed*. ⛓ Without one, a solve that walked straight past the gadget '
            + 'would certify it — the claim is what makes certification about the ELEMENT '
            + 'rather than about the level.',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['certification', 'guard', 'solver', 'requirements-differential'],
    }),
    t({
        id: 'graded-refusal',
        term: 'a graded refusal',
        aliases: ['refuses BY NAME', 'a named refusal'],
        area: 'level-gen',
        plain: 'When something cannot be done, saying exactly which rule stopped it — rather '
            + 'than crashing, retrying, or quietly doing something else.',
        detail: 'The arc\'s most-used discipline. A refusal names its reason '
            + '(`the-biome-lacks-the-item`, `the-partition-yields-one-area-or-fewer`, '
            + '`the-chain-is-arc-4`, `the-skeleton-does-not-solve-with-the-element`), rides '
            + 'VERBATIM to the page, and **never widens a bound to make the page look '
            + 'better**. On the maze an unmet [directive](#require-directive) is a REFUSED '
            + 'RUN, never a retry; the CLI exits **6**. ⛓ On a graded refusal the carved room '
            + 'is left exactly as the carve left it.',
        where: [
            { label: 'the REFERENCE page § The refusal vocabulary — every name a run can refuse by, generated', code: REFERENCE },
            { label: 'maze.md § The area graph', doc: MAZE_AREAS },
            { label: 'seedling-bot.md § The standing laws', doc: STANDING_LAWS },
        ],
        seeAlso: ['certification', 'require-directive', 'grade', 'realisation'],
    }),
    t({
        id: 'template',
        term: 'a template',
        aliases: ['a palette template', 'a concrete row'],
        area: 'level-gen',
        plain: 'A recipe for one kind of thing pass 2 can add — a wall of some length, a pool '
            + 'of some size — with knobs on it.',
        detail: '⛓ **A palette template is a FUNCTION**, not a frozen arrangement of tiles: '
            + '`{name, family, params: [{key, domain, default, why}], instantiate(rng, '
            + 'overrides)}`, built by ONE constructor. `instantiate` returns a **CONCRETE '
            + 'ROW** — the old frozen-row shape — stamped with `params` (the VALUES) and '
            + '`instance` (the derived label, `wall-segment(ori=v,len=4)`). ⚠ `params` means '
            + 'the SCHEMA ARRAY on a base and the VALUES OBJECT on an instance.',
        where: [
            { label: 'the REFERENCE page § Templates — every roster row with its parameter domains, generated', code: REFERENCE },{ label: 'seedling-bot.md § What the arm is now', doc: `${SEEDLING}#what-the-arm-is-now` }],
        seeAlso: ['instantiation', 'family', 'palette', 'roster', 'anchor'],
    }),
    t({
        id: 'instantiation',
        term: 'an instantiation',
        aliases: ['`instance`'],
        area: 'level-gen',
        plain: 'One specific filled-in version of a recipe — this wall, four squares long, '
            + 'upright.',
        detail: 'The output contract of [`instantiate`](#template): `anchorsFor`, `legalAt`, '
            + '`place`, the [oracle](#oracle), the pin union and both sentinel slots consume '
            + 'one and never learn the migration from frozen rows happened. **86 '
            + 'instantiations are walked through `assertPalette` at module load.** ⛓ '
            + '`instantiateKept` rebuilds one from `{template, params}` and passes NO rng, so a '
            + 'dropped parameter REFUSES rather than silently becoming the default.',
        where: [{ label: 'seedling-bot.md § The standing laws', doc: STANDING_LAWS }],
        seeAlso: ['template', 'roster', 'anchor', 'graded-refusal'],
    }),
    t({
        id: 'family',
        term: 'a family',
        aliases: [],
        area: 'level-gen',
        plain: 'A group of related recipes — all the wall ones, all the water ones — so you '
            + 'can ask for variety rather than for a particular recipe.',
        detail: 'The catalogue view groups [templates](#template) by family, `?families=` '
            + 'selects a sub-[roster](#roster) by it, and a level\'s variety is measured in '
            + 'families kept. After arc 3 slice 4c the Seedling roster is **three** — wall · '
            + 'water · pit. ⚠ The demo catalogue\'s `families>=3` bar returned **1 hit in 40** '
            + 'and is PUBLISHED rather than tuned; relaxing it to `families>=2` gives four.',
        where: [{ label: 'architecture.md § Pass 2', doc: PASS2 }],
        seeAlso: ['template', 'roster', 'restrict', 'palette'],
    }),
    t({
        id: 'palette',
        term: 'the palette',
        aliases: ['`?biome=`'],
        area: 'level-gen',
        plain: 'The set of things a particular kind of level is allowed to contain.',
        detail: '⛔ Selected by **`?biome=`** on BOTH pages — never by '
            + '[`?skeleton=`](#skeleton-kind), which selects the room shape. The two Seedling '
            + '[biome](#biome) palettes now differ only in `items`. `procgenPalette` is also '
            + 'the single home of the [discharge](#discharge) test that the batch, both sweeps '
            + 'and the page all ask.',
        where: [{ label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE }],
        seeAlso: ['biome', 'roster', 'template', 'discharge'],
    }),
    t({
        id: 'roster',
        term: 'the roster',
        aliases: ['the catalogue of templates'],
        area: 'level-gen',
        plain: 'The list of everything this level could contain, shown on the page so you can '
            + 'tick things off it.',
        detail: '⛓ **The roster is DECORATION now**: all three door templates retired into '
            + 'pass-1 [elements](#element) — **41/45 instantiations → 23/23**, three families, '
            + 'all `site:\'chamber\'`. The page\'s catalogue view is DATA (`catalogueRows`), '
            + 'grouped by family, and the EXCLUDED rows are IN it — greyed, with `cause` + '
            + '`measured` + `wouldNeed` VERBATIM and no input on them.',
        where: [
            { label: 'architecture.md § Pass 2', doc: PASS2 },
            { label: 'seedling-bot.md § What the arm is now', doc: `${SEEDLING}#what-the-arm-is-now` },
        ],
        seeAlso: ['template', 'family', 'restrict', 'palette'],
    }),
    t({
        id: 'restrict',
        term: 'RESTRICT',
        aliases: ['`?families=`', '`?templates=`'],
        area: 'level-gen',
        plain: 'Narrowing what a run may draw from, by unticking things on the list.',
        detail: '`restrictPalette(palette, {axis, names})` returns a palette of the **SAME '
            + 'SHAPE**, so the restriction is an ARGUMENT and the [loop core](#loop-core) is '
            + 'untouched. Spelled `?families=` / `?templates=` (comma lists): ABSENT is the '
            + 'whole roster, an EMPTY value REFUSES, and ⛔ **both present REFUSES**.',
        where: [{ label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE }],
        seeAlso: ['roster', 'family', 'template', 'url-parameter'],
    }),
    t({
        id: 'anchor',
        term: 'an anchor',
        aliases: ['`?anchortries=`', 'click-to-anchor'],
        area: 'level-gen',
        plain: 'The exact square a thing would be placed at, if it is placed at all.',
        detail: '`model.anchorsFor(record, template, rng, limit)` offers them — **ONE shuffle '
            + 'whatever the limit is**, so the default of 1 is byte-inert BY CONSTRUCTION. '
            + '`?anchortries=` is how many LEGAL anchors one candidate may be SOLVED at. ⚠ Not '
            + '`?anchors=`, which is the domain sweep\'s enumeration mode. On the page, AT… '
            + 'arms a canvas click and the clicked TILE becomes the explicit anchor of ONE '
            + '[directed attempt](#directed-attempt).',
        where: [{ label: 'seedling-bot.md § What the arm is now', doc: `${SEEDLING}#what-the-arm-is-now` }],
        seeAlso: ['anchor-search', 'directed-attempt', 'template', 'byte-inert'],
    }),
    t({
        id: 'anchor-search',
        term: 'the anchor search',
        aliases: [],
        area: 'level-gen',
        plain: 'Trying a thing in several places before giving up on it.',
        detail: '⚠ **A search buys what its stopping rule asks for, which may not be what you '
            + 'wanted.** It recovers KEEPS (`ori=v` 11→12 of 12 seeds at N=2) and leaves '
            + '[DISCHARGES](#discharge) flat (1→2, unchanged out to every legal anchor), '
            + 'because the first legal anchor SOLVES at 23 of 24 rows — a first-solve stop '
            + 'never walks to the discharging one. It bought placeability, not '
            + 'informativeness.',
        where: [{ label: 'seedling-bot.md § The three findings worth carrying off the arc', doc: `${SEEDLING}#the-three-findings-worth-carrying-off-the-arc` }],
        seeAlso: ['anchor', 'discharge', 'keep-or-revert'],
    }),
    t({
        id: 'keep-or-revert',
        term: 'the keep-or-revert loop',
        aliases: ['KEEP', 'REVERT'],
        area: 'level-gen',
        plain: 'Add one thing, check the level still works, and either leave it or take it '
            + 'straight back out.',
        detail: '[Pass 2](#pass-2) in one sentence: pick a [template](#template), instantiate '
            + 'its parameters, offer [anchors](#anchor), refuse the illegal ones by name, '
            + 'solve, keep or revert; stop at the [obstacle target](#obstacle-target) or at '
            + '[saturation](#saturation). ⚖ The free loop keeps **FIRST-SOLVED**; a '
            + '[directed attempt](#directed-attempt) may instead PREFER DISCHARGE — two '
            + 'policies through ONE walk (`walkAnchors`), which is what keeps the free ladder '
            + 'byte-inert by construction (measured 48/48).',
        where: [{ label: 'architecture.md § Pass 2', doc: PASS2 }],
        seeAlso: ['pass-2', 'saturation', 'obstacle-target', 'directed-attempt', 'discharge'],
    }),
    t({
        id: 'saturation',
        term: 'saturation',
        aliases: ['SATURATED', '`?k=`'],
        area: 'level-gen',
        plain: 'Stopping because the room has stopped accepting anything new, not because the '
            + 'target was reached.',
        detail: 'The other end condition of the [keep-or-revert](#keep-or-revert) loop: after '
            + '`?k=` consecutive failures the run reports SATURATED rather than pretending it '
            + 'met the target. ⛔ It says so by name — the four attempt outcomes are never '
            + 'blurred.',
        where: [{ label: 'seedling-bot.md § The standing laws', doc: STANDING_LAWS }],
        seeAlso: ['keep-or-revert', 'obstacle-target', 'graded-refusal'],
    }),
    t({
        id: 'obstacle-target',
        term: 'the obstacle target',
        aliases: ['`?count=`', '`?tries=`'],
        area: 'level-gen',
        plain: 'How many things you asked the level to end up containing.',
        detail: '`?count=` is the target, `?tries=` the tries per step, `?k=` the '
            + '[saturation](#saturation) K. A `count=0` run generates the '
            + '[skeleton](#skeleton) and stops, which is why nearly every demo entry that '
            + 'wants to show a pass-1 [element](#element) carries it.',
        where: [{ label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE }],
        seeAlso: ['keep-or-revert', 'saturation', 'obstacle', 'url-parameter'],
    }),
    t({
        id: 'directed-attempt',
        term: 'a directed attempt',
        aliases: ['ATTEMPT', 'AT…'],
        area: 'level-gen',
        plain: 'Asking for one specific thing to be placed, right now, instead of letting the '
            + 'generator choose.',
        detail: '`levelGenerator.directedAttempt` places ONE named [template](#template) on '
            + 'the record ON SCREEN. ⚖ The user\'s ruling: *verb 2 PREFERS DISCHARGE; the free '
            + 'loop keeps FIRST-SOLVED*. The readout says WHICH KIND of keep it was, and '
            + '`KEPT_KIND` has THREE members — `discharged` / `solved-only` / '
            + '`solved-no-verb` — because a wall has no verb to fall short of.',
        where: [{ label: 'seedling-bot.md § What the arm is now', doc: `${SEEDLING}#what-the-arm-is-now` }],
        seeAlso: ['directive', 'discharge', 'anchor', 'payload'],
    }),
    t({
        id: 'directive',
        term: 'a directive',
        aliases: ['`--directed=`', '`directives`'],
        area: 'level-gen',
        plain: 'A recorded instruction to place a particular thing — kept with the level so '
            + 'the level can be rebuilt.',
        detail: '⛔ **`?directed=` is RETIRED from the URL** and REFUSES BY NAME there (it '
            + 'does not silently open the ladder — that would be a link that means something '
            + 'other than it says). The GRAMMAR is unchanged and still spoken by three '
            + 'channels: the CLI `--directed=` flag, the page\'s ATTEMPT / AT… buttons, and '
            + '`payload.directives`. ⛓ A level that was directed or edited has a FILE for its '
            + 'identity, not a URL — see [the payload](#payload).',
        where: [{ label: 'seedling-bot.md § The URL parameters — the URL diet § follows it', doc: URL_TABLE }],
        seeAlso: ['directed-attempt', 'payload', 'url-parameter', 'seed'],
    }),
    t({
        id: 'discharge',
        term: 'discharge',
        aliases: ['discharged', 'the verb', 'solved-only'],
        area: 'level-gen',
        plain: 'Actually USING the thing that was placed — as opposed to merely getting past '
            + 'it some other way.',
        detail: '⚖ *discharged* and *solved-only* are **two facts and are never blurred**, and '
            + 'a template with no verb to discharge says so BY NAME (`solved-no-verb`) instead '
            + 'of reporting a shortfall that could not exist. ⛔ **ONE DISCHARGE TEST** — '
            + '`procgenPalette`\'s `CLEARER_STRATEGY` / `verbOf` / `dischargesVerb`, which the '
            + 'batch, both sweeps and the page all ask.',
        where: [{ label: 'seedling-bot.md § The standing laws', doc: STANDING_LAWS }],
        seeAlso: ['directed-attempt', 'keep-or-revert', 'lifted-claim', 'anchor-search'],
    }),
    t({
        id: 'require-directive',
        term: '`?require=`',
        aliases: ['rule-directed', 'the directive'],
        area: 'level-gen',
        plain: 'Asking for a level where a specific item is genuinely needed to finish.',
        detail: 'The generator is RULE-DIRECTED: you name an ITEM and it DERIVES the '
            + '[element head](#element-head) from `ELEMENT_TABLE.needs`, then '
            + '[grades](#grade) the finished level with a '
            + '[differential](#requirements-differential). ⛔ Seedling names an item flag '
            + '(`hasSword`), the maze names an area-graph [symbol](#symbol) (`K0`). ⛔ And the '
            + 'two pages differ on a refusal: **Seedling still SHOWS the level, labelled** '
            + '(following the CLI); **the maze shows nothing at all**, because there the graph '
            + 'IS the level\'s structure.',
        where: [
            { label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE },
            { label: 'maze.md § The area graph', doc: MAZE_AREAS },
        ],
        seeAlso: ['grade', 'requirements-differential', 'element-head', 'graded-refusal', 'symbol'],
    }),
    t({
        id: 'requirements-differential',
        term: 'the requirements differential',
        aliases: ['the ablation'],
        area: 'level-gen',
        plain: 'Proving an item was really needed by generating the same level again without '
            + 'it and seeing whether the level can still be finished.',
        detail: 'The same run generated again with the flag off, solved, and compared '
            + '(`seedlingDemo/procgenRequirements.js`). On the maze the equivalent is exact: '
            + 'remove `key_K` from the finished level and the goal must be unreachable '
            + '(`isCut`) — a proof rather than an estimate, which is why STRONG is the only '
            + 'grade reachable there.',
        where: [
            { label: 'architecture.md § Pass 1', doc: PASS1 },
            { label: 'maze.md § The area graph', doc: MAZE_AREAS },
        ],
        seeAlso: ['grade', 'require-directive', 'cut', 'bfs-oracle'],
    }),
    t({
        id: 'grade',
        term: 'a grade',
        aliases: ['STRONG', 'WEAK', 'BOUND-DEPENDENT', 'INERT', 'NOT-ESTABLISHED'],
        area: 'level-gen',
        plain: 'How strongly the level actually depends on the item that was asked for — from '
            + '"cannot be finished without it" down to "makes no difference".',
        detail: 'Five, from `procgenRequirements.js`: **STRONG** / **BOUND-DEPENDENT** / '
            + '**WEAK** / **INERT** / **NOT-ESTABLISHED**, with seven named refusals and exit '
            + '6 when the directive cannot be met. ⛓ Seed 30 is the seed the '
            + '[demand](#demand) rescued: before it, the kill lock was cleared by pass-2 '
            + '*water* and the directive graded WEAK; the gate now declares a demand on its '
            + 'body\'s region and the same seed grades STRONG.',
        where: [{ label: 'architecture.md § Pass 1', doc: PASS1 }],
        seeAlso: ['require-directive', 'requirements-differential', 'demand', 'graded-refusal'],
    }),
    t({
        id: 'biome',
        term: 'a biome',
        aliases: ['pre-sword', 'post-sword', 'maze-v1'],
        area: 'level-gen',
        plain: 'Which flavour of level this is — which decorations it may use, and what the '
            + 'player is assumed to already have.',
        detail: '`?biome=` selects the [palette](#palette) AND the BOOT INVENTORY. Seedling '
            + 'has `pre-sword` and `post-sword`; the maze lab has `maze-v1`. ⛓ The biome is '
            + 'what makes `ELEMENT_TABLE.needs` gating free — a pre-sword `killgate` refuses '
            + 'without spending a solve — and the two Seedling palettes now differ ONLY in '
            + 'their `items`. ⛔ Do not confuse with a [skeleton kind](#skeleton-kind), even '
            + 'though the kinds ARE the maze\'s own biome names.',
        where: [{ label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE }],
        seeAlso: ['palette', 'boot-items', 'skeleton-kind', 'element-head'],
    }),
    t({
        id: 'boot-items',
        term: 'the boot items',
        aliases: ['boot inventory', 'starting conditions'],
        area: 'level-gen',
        plain: 'What the player is holding at the moment the level starts.',
        detail: 'Set by the [biome](#biome) and editable on the page\'s own boot form. They '
            + 'gate [element heads](#element-head) for free through `ELEMENT_TABLE.needs`, and '
            + 'they are what a [`?require=`](#require-directive) directive is checked against '
            + 'BEFORE a room exists — a pre-sword boot does not grant `hasSword`, so the '
            + 'directive is refused by name (`the-biome-lacks-the-item`) with exit 6.',
        where: [{ label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE }],
        seeAlso: ['biome', 'element-head', 'require-directive', 'arm'],
    }),
    t({
        id: 'tick-budget',
        term: 'the tick budget',
        aliases: ['`?tickbudget=`', '`maxTicksPerTarget`'],
        area: 'level-gen',
        plain: 'How long a single solve is allowed to run, counted in game steps rather than '
            + 'in seconds.',
        detail: '⛓ **Counted in TICKS on purpose.** The old `wallClockMs` made elapsed time — '
            + 'not a property of the candidate — decide what was kept, so a busy machine '
            + 'generated a different level. `maxTicksPerTarget` already binds where the clock '
            + 'used to: 326 solves over 40 seeds, max TOTAL ticks **800**, against a tick '
            + 'analogue of the old provenance of ~5,360. ⛔ Threading `planDash`\'s '
            + '`maxExpansions` up into the budget was refused twice — it binds in 1 solve of '
            + '326, and when it fires it is one rung\'s sub-reason inside a ladder refusal.',
        where: [{ label: 'gotchas.md § Generation used to be non-deterministic under load', doc: `${GOTCHAS}#generation-used-to-be-non-deterministic-under-load--fixed-2026-08-14-and-the-shape-of-the-fix-is-the-lesson` }],
        seeAlso: ['determinism', 'bfs-oracle', 'solver', 'control-arm'],
    }),
    t({
        id: 'solver',
        term: 'a solver',
        aliases: ['SOLVE', 'the solve'],
        area: 'level-gen',
        plain: 'The automatic player that tries to finish a level, and says how it did it.',
        detail: 'Each [binding](#binding) brings its own: Seedling\'s is the R8 bot with its '
            + 'nested openers, the maze\'s is an exact BFS over `(player, blocks, inventory)`. '
            + 'It is what [certification](#certification) and [pass 2](#pass-2) both ask, and '
            + 'its walk is a [paintable](#paintable) — the `certification` [ledger](#ledger) '
            + 'row carries the route with its gaps counted and NAMED rather than bridged.',
        where: [
            { label: 'architecture.md § Pass 1', doc: PASS1 },
            { label: 'maze.md § Identity and certification', doc: `${MAZE}#identity-and-certification` },
        ],
        seeAlso: ['certification', 'oracle', 'bfs-oracle', 'paintable', 'seedling'],
    }),
    t({
        id: 'oracle',
        term: 'an oracle',
        aliases: [],
        area: 'level-gen',
        plain: 'The independent authority that says whether a thing is right — separate from '
            + 'the thing that produced it.',
        detail: 'Used two ways here, and they are worth keeping apart. In the pipeline, the '
            + '[sphere plan](#sphere-plan) is the oracle the compiled world is checked '
            + 'against. In the level generator, `procgenOracle.js` is what decides whether a '
            + 'placement SOLVED. ⛔ A [control arm](#control-arm) an oracle can fail for the '
            + 'MACHINE\'s reasons will eventually accuse your code of the machine\'s problem.',
        where: [
            { label: 'architecture.md § Determinism and verification', doc: `${ARCH}#determinism-and-verification` },
            { label: 'gotchas.md § Generation used to be non-deterministic under load', doc: `${GOTCHAS}#generation-used-to-be-non-deterministic-under-load--fixed-2026-08-14-and-the-shape-of-the-fix-is-the-lesson` },
        ],
        seeAlso: ['solver', 'sphere-plan', 'control-arm', 'certification'],
    }),
    t({
        id: 'flood',
        term: 'a flood',
        aliases: ['flood fill', '`gridFlood.reachableFrom`'],
        area: 'level-gen',
        plain: 'Spreading outward from a square to find everywhere you could walk to from it.',
        detail: 'The instrument behind the [door law](#door-law), the '
            + '[level-n](#key-level) checks and every reachability claim in the system. '
            + '⛔ **A flood cannot see a ONE-WAY mechanic, and it lies OPTIMISTICALLY**: it is '
            + '`for each neighbour: if walkable, enqueue`, a symmetric relation by '
            + 'construction, so every directed mechanic is invisible to it and the graph '
            + 'promises a route the walk cannot take. Model one as a refusal on the STEP, '
            + 'never on the CELL, and run a DIRECTED flood against the undirected one as a '
            + 'control.',
        where: [{ label: 'gotchas.md § A component flood cannot see a ONE-WAY mechanic', doc: `${GOTCHAS}#a-component-flood-cannot-see-a-one-way-mechanic-and-it-lies-optimistically` }],
        seeAlso: ['door-law', 'key-level', 'cut', 'control-arm', 'area'],
    }),
    t({
        id: 'candidate-funnel',
        term: 'the candidate funnel',
        aliases: ['offered', 'tried', 'legal'],
        area: 'level-gen',
        plain: 'The narrowing list of places a thing could go: everywhere considered, '
            + 'everywhere actually tested, and everywhere that passed.',
        detail: 'Three [paintable](#paintable) lines on the `on-connector` '
            + '[ledger](#ledger) row — offered ⊇ reached-the-law ⊇ passed-it — CARRIED out of '
            + 'the construct\'s own law calls and never re-derived. ⛓ The element\'s ONE draw '
            + 'is a choice among candidates that have ALL already passed every rule: a pick '
            + 'landing on one the law would refuse would be a draw spent to fail. ⚠ '
            + '`cost.candidates` on the payload carries only the LAST number; the three lines '
            + 'are the only place the whole funnel is visible.',
        where: [{ label: 'seedling-bot.md § arc 3, slice 5b', doc: `${SEEDLING}#arc-3-slice-5b--the-demo-catalogue-and-the-four-intermediate-results` }],
        seeAlso: ['on-connector-element', 'paintable', 'ledger', 'draw'],
    }),
    t({
        id: 'byte-inert',
        term: 'byte-inert',
        aliases: ['spends no draw'],
        area: 'level-gen',
        plain: 'A change that leaves every generated level exactly as it was, character for '
            + 'character.',
        detail: 'The property most arc-3 changes had to establish before shipping. It follows '
            + 'from spending no [draw](#draw) — a `site:\'any\'` row, an anchor limit of 1, the '
            + '[ledger](#ledger) itself (proved by a [counting spy](#counting-spy), 336 '
            + 'pairs / 0 moved). ⛔ When a change DOES spend a draw the cheap pair dumps are '
            + 'guaranteed to move and the byte-inert claim needs a '
            + '[control arm](#control-arm) instead.',
        where: [{ label: 'gotchas.md § "The `empty` pairs are UNCHANGED"', doc: `${GOTCHAS}#the-empty-pairs-are-unchanged-is-a-gate-only-for-a-change-that-spends-no-draw` }],
        seeAlso: ['draw', 'counting-spy', 'control-arm', 'byte-identity'],
    }),

    /* ══════════ SEEDLING ════════════════════════════════════════════ */

    t({
        id: 'seedling',
        term: 'Seedling',
        aliases: ['the Seedling bot', 'the real-game bot'],
        area: 'seedling',
        plain: 'A real, existing game that this project drives automatically — and the second '
            + 'place the level generator was made to work.',
        detail: 'Seedling is a recompiled Flash game. Two things live under the name: the '
            + '**bot**, which drives the real game with an input [tape](#tape) and checks a JS '
            + 'physics transcription against what the game actually did '
            + '([the differential](#seedling-differential)); and the **generator arm** of its '
            + 'watch page, which is the second [binding](#binding) of the '
            + '[loop core](#loop-core). ⛔ Seedling is not a registered '
            + '[substrate](#substrate) — its map reaches the pipeline through '
            + '[`flash_seedling`](#flash-substrate).',
        where: [{ label: 'seedling-bot.md § The shape: two implementations, one tape, compared', doc: `${SEEDLING}#the-shape-two-implementations-one-tape-compared` }],
        seeAlso: ['tape', 'seedling-differential', 'rung', 'binding', 'flash-substrate'],
    }),
    t({
        id: 'tape',
        term: 'a tape',
        aliases: ['the input tape'],
        area: 'seedling',
        plain: 'A recorded list of button presses that replays a run of the game exactly.',
        detail: 'The unit of evidence for the whole Seedling bot arc: a committed tape is '
            + 'replayed against BOTH implementations and the two are compared frame by frame. '
            + '⛓ Tape versions are numbered (v2 relaxations, v7 carries the RNG state, v8 is '
            + 'the staging block the page\'s SOLVE and MANUAL arms both boot from). ⛔ The '
            + 'watch page NEVER writes `fixtures/` — a generated or directed level lives in '
            + 'the tab, the save box and the Download button.',
        where: [{ label: 'seedling-bot.md § The tape', doc: `${SEEDLING}#the-tape` }],
        seeAlso: ['seedling', 'seedling-differential', 'arm', 'lab-page'],
    }),
    t({
        id: 'seedling-differential',
        term: 'the differential',
        aliases: [],
        area: 'seedling',
        plain: 'Running the same recorded input through the real game and through this '
            + 'project\'s copy of its physics, and comparing every frame.',
        detail: 'Movement, collision, room transitions and A* pathing, checked against what '
            + 'the game actually did. ⚠ Do not confuse it with the '
            + '[requirements differential](#requirements-differential), which ablates an ITEM '
            + 'from a generated level; this one ablates nothing and compares two '
            + 'IMPLEMENTATIONS.',
        where: [{ label: 'seedling-bot.md § The shape', doc: `${SEEDLING}#the-shape-two-implementations-one-tape-compared` }],
        seeAlso: ['seedling', 'tape', 'requirements-differential'],
    }),
    t({
        id: 'rung',
        term: 'a rung',
        aliases: ['R8', 'R9'],
        area: 'seedling',
        plain: 'One step up the ladder of how much of the real game the bot can handle — each '
            + 'one adds a class of thing it previously could not.',
        detail: 'R1–R8 are closed: the relaxed full walk, solids, the crutches off, hazards, '
            + 'enemies, bosses and the ending, the honest playthrough, and the live '
            + '**solver** bot. R9 is next. ⛓ A [certification](#certification) '
            + '[solver](#solver) capability landed OUTSIDE the rung during arc 3 (nested '
            + 'openers, depth 2), which R9 inherits along with three named residues.',
        where: [{ label: 'seedling-bot.md § R8: the live solver bot, as built', doc: `${SEEDLING}#r8-the-live-solver-bot-as-built-closed-2026-08-11` }],
        seeAlso: ['seedling', 'solver', 'certification'],
    }),
    t({
        id: 'arm',
        term: 'an arm',
        aliases: ['`?source=`', 'GENERATE', 'REPLAY', 'MANUAL'],
        area: 'seedling',
        plain: 'Which of the watch page\'s four jobs you are doing: replaying a recording, '
            + 'letting the bot play, playing yourself, or generating a level.',
        detail: 'Selected by `?source=` — `replay` · `solve` · `manual` · `generate` — and a '
            + 'bare `?gen=` also selects GENERATE. ⛓ SOLVE and MANUAL share **ONE boot panel '
            + 'and one staging block**: two boxes cannot share a block, and the whole point of '
            + 'the switch arc was that the level you are looking at follows you between modes. '
            + 'The GENERATE arm can hand its level to the other two in memory and in place.',
        where: [{ label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE }],
        seeAlso: ['lab-page', 'boot-items', 'tape', 'url-parameter'],
    }),
    t({
        id: 'generation-ladder',
        term: 'the generation ladder',
        aliases: ['STEP', 'RUN-ALL', '`?run=1`'],
        area: 'seedling',
        plain: 'The pass-2 run performed one addition at a time, with a button to take the '
            + 'next step and a button to run it all.',
        detail: '`STEP` advances one [keep-or-revert](#keep-or-revert) attempt, `RUN-ALL` runs '
            + 'to the [obstacle target](#obstacle-target), `RESET` returns to the '
            + '[skeleton](#skeleton). `?run=1` presses RUN-ALL on load and is DELETED at step '
            + '0 rather than spelt `run=0`. ⚠ **Not the same thing as the '
            + '[phase ladder](#phase-ladder)**, which steps pass 1 and is a read-only replay; '
            + 'the phase ladder hands over to this one at the last pass-1 row.',
        where: [{ label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE }],
        seeAlso: ['phase-ladder', 'keep-or-revert', 'obstacle-target', 'url-parameter'],
    }),

    /* ══════════ THE MAZE AND ITS LAB ════════════════════════════════ */

    t({
        id: 'maze-lab',
        term: 'the maze lab',
        aliases: ['`lab.html`'],
        area: 'maze',
        plain: 'The maze substrate\'s own page for generating, editing and solving one room.',
        detail: '`frontend/modules/mazeRoom/lab.html`, with three modes — GENERATE, EDIT, '
            + 'SOLVE (the exact BFS oracle). It is where the [area graph](#area-graph) and '
            + 'the first [element](#element) were built, and where they accept routinely: at '
            + '15×15 the room is big enough that the graph works, against '
            + '**0–4 of 12** on a 10×10 Seedling room. ⚠ On THIS page a refused '
            + '[directive](#require-directive) offers no level and no payload.',
        where: [{ label: 'maze.md § The maze lab page', doc: MAZE_LAB }],
        seeAlso: ['lab-page', 'bfs-oracle', 'area-graph', 'maze-substrate', 'require-directive'],
    }),
    t({
        id: 'bfs-oracle',
        term: 'the exact BFS oracle',
        aliases: ['`?expansions=`'],
        area: 'maze',
        plain: 'The maze\'s solver: it tries every possibility in order, so when it says a '
            + 'level cannot be finished, that is a fact and not a guess.',
        detail: 'A breadth-first search over `(player, blocks, inventory)`. Because it is '
            + 'exhaustive, its [differential](#requirements-differential) is a PROOF rather '
            + 'than an estimate — which is why **STRONG is the only [grade](#grade) reachable '
            + 'on the maze**, and why the graded half of the certification scale is exercised '
            + 'there only in its trivial case. `?expansions=` bounds it.',
        where: [{ label: 'maze.md § Identity and certification', doc: `${MAZE}#identity-and-certification` }],
        seeAlso: ['solver', 'grade', 'requirements-differential', 'maze-lab', 'tick-budget'],
    }),

    /* ══════════ THE LAB PAGES, THEIR URLS AND THEIR READOUTS ════════ */

    t({
        id: 'lab-page',
        term: 'a lab page',
        aliases: ['`watch.html`', 'the watch page'],
        area: 'pages',
        plain: 'A single self-contained web page for building, watching and poking at one '
            + 'level — no app around it.',
        detail: 'Two of them: `seedlingDemo/watch.html` and '
            + '[`mazeRoom/lab.html`](#maze-lab). Both are served from the repo root locally '
            + 'and published on [GitHub Pages](#github-pages), both publish a '
            + '[readout](#readout) a browser [row](#browser-row) asserts against, and both '
            + 'carry a **source stamp** saying which copy of the code is actually running — a '
            + 'diagnostic, not a fix, added after a round trip was lost to "the fix is wrong" '
            + 'being indistinguishable from "your browser did not re-fetch".',
        where: [
            { label: 'maze.md § The maze lab page', doc: MAZE_LAB },
            { label: 'seedling-bot.md § The editor arc — `watch.html` becomes the lab page', doc: `${SEEDLING}#the-editor-arc--watchhtml-becomes-the-lab-page-tooling-closed-2026-08-12` },
        ],
        seeAlso: ['maze-lab', 'readout', 'arm', 'github-pages', 'demo-catalogue'],
    }),
    t({
        id: 'demo-catalogue',
        term: 'the demo catalogue',
        aliases: ['`demos.js`', '`demos.html`'],
        area: 'pages',
        plain: 'The list of everything the two lab pages can be made to show, each with a '
            + 'link that shows it.',
        detail: '⛓ **ONE data module, two readers.** `procgenDocs/demos.js` holds the '
            + 'entries; [`demos.html`](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/demos.html) '
            + 'renders them and `check-procgen-demos.mjs` IMPORTS the same module, loads every '
            + 'link the page shows and asserts each entry\'s own [claim](#claim) off the '
            + 'page\'s readout. ⛔ **Never hand-spell a URL**: every one came out of the page\'s '
            + 'own writer, so pasting one back into the bar is a fixed point.',
        where: [
            { label: 'demos.md — the pointer', doc: DEMOS_DOC },
            { label: 'procgenDocs/demos.js', code: 'frontend/modules/procgenDocs/demos.js' },
        ],
        seeAlso: ['claim', 'browser-row', 'lab-page', 'url-parameter', 'github-pages'],
    }),
    t({
        id: 'ledger',
        term: 'the generation ledger',
        aliases: ['the ledger', 'a ledger row'],
        area: 'pages',
        plain: 'The running record a level keeps of how it was built — one entry per step, '
            + 'written by that step as it happened.',
        detail: '`seedlingDemo/procgenLedger.js`. One row per [phase](#phase-ladder), appended '
            + 'BY the phase with the facts it had already computed, and **[byte-inert]'
            + '(#byte-inert)** — proved by a [counting spy](#counting-spy), 336 pairs / 0 '
            + 'moved. Each row carries its own sentence, its tile/entity delta, its refusal by '
            + 'name and its [paintables](#paintable). ⛔ **A phase that is never REACHED writes '
            + 'NO ROW**, which is what makes an omission visible. Measured cost: median '
            + '**1.048× → 1.129×**, worst observed 1.190×.',
        where: [
            { label: 'architecture.md § The ledger, the step-through and the instruments', doc: LEDGER_SEC },
            { label: 'seedlingDemo/procgenLedger.js', code: 'frontend/modules/seedlingDemo/procgenLedger.js' },
        ],
        seeAlso: ['phase-ladder', 'paintable', 'fact-line', 'byte-inert', 'counting-spy'],
    }),
    t({
        id: 'phase-ladder',
        term: 'the phase ladder',
        aliases: ['a phase', '`PHASE ▶`', 'the phase step-through'],
        area: 'pages',
        plain: 'A slider that walks you through a level\'s construction one step at a time, '
            + 'showing the room as it was at each.',
        detail: 'Phase *k* is the room as of [ledger](#ledger) row *k*, rebuilt from the row '
            + 'DELTAS and handed to the existing renderer — ⛔ **nothing is re-run**. At the '
            + 'last pass-1 row the label says *"pass 2 — use STEP"*, where the '
            + '[generation ladder](#generation-ladder) takes over. ⛓ Folding back to phase *k* '
            + 'is NOT the same as re-running without what phase *k* did: a '
            + '[pre-carve](#pre-carve-element) element spends its [draws](#draw) before the '
            + 'carve, so the two reach the carver at different stream positions.',
        where: [{ label: 'architecture.md § The ledger, the step-through and the instruments', doc: LEDGER_SEC }],
        seeAlso: ['ledger', 'generation-ladder', 'fact-line', 'view-setting', 'stepped-pipeline'],
    }),
    t({
        id: 'paintable',
        term: 'a paintable',
        aliases: ['an intermediate result'],
        area: 'pages',
        plain: 'A working-out a step produced — a set of squares it considered, a region it '
            + 'measured — that the page can draw on the level for you.',
        detail: 'Uniform data on a [ledger](#ledger) row: the [door law](#door-law)\'s two '
            + 'floods, the [level-n floods](#key-level) and the goal\'s '
            + '[vestibule](#vestibule), the [candidate funnel](#candidate-funnel), and the '
            + '[certification](#certification) solve\'s route with its gaps named. ⚖ Per the '
            + 'user\'s ruling of 2026-08-18 a paintable is drawn **when its text line is '
            + 'selected** — so ONE hue plus an outlined PICK is enough, and no per-fact '
            + 'drawing code exists to keep in step.',
        where: [{ label: 'architecture.md § The ledger, the step-through and the instruments', doc: LEDGER_SEC }],
        seeAlso: ['fact-line', 'ledger', 'candidate-funnel', 'overlay-layer'],
    }),
    t({
        id: 'fact-line',
        term: 'a fact line',
        aliases: ['tick a fact line'],
        area: 'pages',
        plain: 'One tickable sentence under the step readout; ticking it draws what that '
            + 'sentence describes.',
        detail: 'The selectable half of a [paintable](#paintable). ⛔ It is a '
            + '[VIEW setting](#view-setting), not a URL parameter: it re-draws, it never '
            + 'regenerates. A demo catalogue entry names the fact lines to tick and the '
            + '[browser row](#browser-row) really ticks them before it asserts, so an entry '
            + 'naming a fact id the phase did not record FAILS.',
        where: [{ label: 'seedling-bot.md § arc 3, slice 5b', doc: `${SEEDLING}#arc-3-slice-5b--the-demo-catalogue-and-the-four-intermediate-results` }],
        seeAlso: ['paintable', 'view-setting', 'phase-ladder', 'browser-row'],
    }),
    t({
        id: 'overlay-layer',
        term: 'an overlay layer',
        aliases: ['the overlay', '`off → sites → elements → areas → all`'],
        area: 'pages',
        plain: 'An extra picture drawn on top of the level showing something you could not '
            + 'otherwise see — where the spots are, what the contraption occupies, how the '
            + 'room is divided.',
        detail: 'Five, CUMULATIVE: `off` · `sites` · `elements` · `areas` · `all`. Drawn as a '
            + 'SIBLING after the renderer, on the same canvas, because a '
            + '[site](#site) class and an [area partition](#area-partition) are facts about '
            + 'the MODEL rather than about the world the renderer was handed. ⛔ **Nothing is '
            + 'labelled on the canvas** — the symbols are named once each in the '
            + '[legend](#legend) and the picture carries only colour. ⛔ **A dropped element '
            + 'draws NOTHING** and says so in the legend.',
        where: [
            { label: 'architecture.md § The ledger, the step-through and the instruments', doc: LEDGER_SEC },
            { label: 'seedlingDemo/watchGenOverlay.js', code: 'frontend/modules/seedlingDemo/watchGenOverlay.js' },
        ],
        seeAlso: ['legend', 'site', 'area-partition', 'view-setting', 'paintable'],
    }),
    t({
        id: 'legend',
        term: 'the legend',
        aliases: [],
        area: 'pages',
        plain: 'The key under the picture naming every colour and shape on it.',
        detail: '⚠ **ONE ROW PER SYMBOL, never one per cell** — door counts are not small (up '
            + 'to 50 over eight 15×15 cells). It is DERIVED from the groups the draw actually '
            + 'painted, so the page cannot name a symbol the draw did not paint, and a '
            + '[refusal](#graded-refusal) appears here as a NOTE row rather than as a picture.',
        where: [{ label: 'maze.md § The area-graph overlay', doc: `${MAZE}#the-area-graph-overlay` }],
        seeAlso: ['overlay-layer', 'graded-refusal', 'readout'],
    }),
    t({
        id: 'readout',
        term: 'a readout',
        aliases: ['`__editorGenerate`', '`__mazeLab`'],
        area: 'pages',
        plain: 'The machine-readable summary a page publishes about itself, so a test can '
            + 'check what it is showing.',
        detail: 'Each lab page publishes one: `watch.html` → `window.__editorGenerate`, '
            + '`lab.html` → `window.__mazeLab`. ⛓⛓ **It is MEASURED, not echoed.** The '
            + 'overlay readout is the SAME object the draw consumed, and the demo catalogue '
            + 'page\'s readout is measured off its own DOM — a readout copied from the import '
            + 'would hold even with the render deleted. ⛔ A wait must be on the claim\'s own '
            + 'PRE-CONDITION and never on existence: both pages publish at the '
            + '[skeleton](#skeleton), before `?run=1`\'s ladder has run a rung.',
        where: [
            { label: 'maze.md § The browser row', doc: `${MAZE}#the-browser-row` },
            { label: 'check-procgen-demos.mjs', code: 'scripts/procgen/check-procgen-demos.mjs' },
        ],
        seeAlso: ['browser-row', 'claim', 'lab-page', 'legend'],
    }),
    t({
        id: 'url-parameter',
        term: 'a URL parameter',
        aliases: ['ONE WRITER', 'the URL diet'],
        area: 'pages',
        plain: 'The settings written into a link, which name exactly the run you would have '
            + 'typed in by hand.',
        detail: '⚖ **RULED**: a URL names *the launch parameters a person types*, and nothing '
            + 'else — `source · seed · biome · count/tries/k/anchortries · '
            + 'families|templates · skeleton;params · tickbudget · elements · areas · '
            + 'require · gen` (the maze adds `width/height/expansions`). ⛔ **ONE WRITER**: '
            + '`writeGenerateParams` is the only thing that writes one, and it is the inverse '
            + 'of the reader. ⛔ **The writer REFUSES what the reader would refuse** — a URL '
            + 'this page cannot reload must not be writable. ⛓ [View settings](#view-setting) '
            + 'are NOT parameters.',
        where: [
            { label: 'the REFERENCE page § The URL grammar — every parameter of both lab pages, generated', code: REFERENCE },
            { label: 'seedling-bot.md § The URL parameters, whole and current', doc: URL_TABLE },
            { label: 'seedling-bot.md § The URL parameters — the URL diet § follows it', doc: URL_TABLE },
        ],
        seeAlso: ['view-setting', 'payload', 'seed', 'demo-catalogue'],
    }),
    t({
        id: 'view-setting',
        term: 'a view setting',
        aliases: [],
        area: 'pages',
        plain: 'A control that changes what you SEE without changing what was generated.',
        detail: 'The [phase ladder](#phase-ladder), the [overlay](#overlay-layer) select and '
            + 'the per-phase [fact lines](#fact-line). ⛔ **None of them is a '
            + '[URL parameter](#url-parameter)**: they re-DRAW, they never regenerate, they do '
            + 'not touch the ladder, and none is written to the bar — a phase index in a link '
            + 'would name a PICTURE rather than a run, and a run is what a link is for.',
        where: [{ label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE }],
        seeAlso: ['url-parameter', 'phase-ladder', 'overlay-layer', 'fact-line'],
    }),
    t({
        id: 'payload',
        term: 'the payload',
        aliases: ['`?gen=`', '`procgenLab:load`'],
        area: 'pages',
        plain: 'The saved file that IS a hand-built level — because once you have edited '
            + 'something, a link can no longer describe it.',
        detail: '**The payload is the construction**: `directives` + `edits`, in that order, '
            + 'replayed by `?gen=` and by the host\'s `procgenLab:load` on BOTH lab pages. So '
            + 'the identity of a level that was directed or edited is a FILE, and the page '
            + 'says so where it states the identity — *"⚠ the URL is NOT a reproduction of '
            + 'this construction — it names the LADDER alone; the PAYLOAD is"*. `?gen=PATH` is '
            + 'a determinism check across node and the browser, not a picture of a file.',
        where: [{ label: 'seedling-bot.md § The URL parameters — the URL diet § follows it', doc: URL_TABLE }],
        seeAlso: ['url-parameter', 'directive', 'determinism', 'preset-sidecars'],
    }),
    t({
        id: 'github-pages',
        term: 'GitHub Pages',
        aliases: ['the deployed site', 'PAGES'],
        area: 'pages',
        plain: 'The public copy of these pages on the web, updated whenever a change is '
            + 'pushed.',
        detail: '`.github/workflows/deploy-gh-pages.yml` publishes the **`frontend/` directory '
            + 'AS the site root**, so a repo path `/frontend/modules/…` lives at '
            + '`<base>/modules/…` there — the mapping is spelled ONCE, in `demos.js`. ⚠ Pages '
            + 'serves the tree as of the last push to `main`, so a page changed locally but '
            + 'not yet pushed shows the older behaviour there.',
        where: [
            { label: 'demos.md — the pointer', doc: DEMOS_DOC },
            { label: 'procgenDocs/demos.js', code: 'frontend/modules/procgenDocs/demos.js' },
        ],
        seeAlso: ['demo-catalogue', 'lab-page', 'browser-row'],
    }),

    /* ══════════ P5 — THE NINE THE 140 CEILING LEFT OUT ══════════════
     *
     * ⚖ THE CEILING IS LIFTED FOR THESE NINE (user, via the P5 charge). Seven
     * are URL parameters the generated URL-grammar table reported as having NO
     * glossary term at all — a table that links a term for 30 of 37 rows and
     * silently blanks the other 7 is a table that looks complete. The last two
     * are `component` and `a wall backend`, which P2 WROTE and then DROPPED to
     * land inside D5's 80–140 band; §18.8 named them as the first two back if
     * the ceiling ever moved.
     */

    t({
        id: 'attack-hold',
        term: 'the attack hold',
        aliases: ['`?attackhold=`', 'the afterimage'],
        area: 'pages',
        plain: 'How long a swing stays drawn on screen after the game has stopped swinging.',
        detail: 'A count of TICKS, not a duration — `?attackhold=N` keeps a fired attack rect '
            + 'painted for `N` ticks after the engine dropped it, so a five-tick swing can be '
            + 'seen at all. ⛔ It is a [view setting](#view-setting) and it makes NO claim: '
            + 'held rects are drawn in different ink and `attackRectsAt` never returns one, so '
            + 'the two channels partition the presses. ⚠ ABSENT and `?attackhold=0` are '
            + 'DIFFERENT — absent is the page\'s default, 0 is a reader asking for the raw '
            + 'picture — and a bad value is REPORTED rather than refused or ignored, because '
            + 'throwing would take the page down over a typo in a query string.',
        where: [{ label: 'seedlingDemo/watchOverlays.js — `parseAttackHold`', code: 'frontend/modules/seedlingDemo/watchOverlays.js' }],
        seeAlso: ['url-parameter', 'view-setting', 'overlay-layer', 'tick'],
    }),
    t({
        id: 'tick',
        term: 'a tick',
        aliases: ['`?tick=`', 'the cursor', 'a frame'],
        area: 'pages',
        plain: 'One step of the game clock — and, in a link, which step the viewer opens at.',
        detail: 'The unit everything on these pages is counted in: a [tape](#tape) is a list of '
            + 'ticks, a [solve](#solver)\'s cost is ticks, and the [tick budget](#tick-budget) '
            + 'bounds a solve in ticks precisely so a busy machine cannot change what is kept. '
            + '`?tick=N` is the VIEW half — a whole index ≥ 0 that sets the cursor. ⚠ It is '
            + 'CLAMPED **and says so**: a tape shorter than the request usually means the run '
            + 'threw early, and landing silently on the last frame would present a truncated '
            + 'run as a complete one.',
        where: [{ label: 'seedlingDemo/watchManual.js — `readViewParams` / `clampTick`', code: 'frontend/modules/seedlingDemo/watchManual.js' }],
        seeAlso: ['url-parameter', 'view-setting', 'tape', 'tick-budget', 'playback-speed'],
    }),
    t({
        id: 'playback-speed',
        term: 'the playback speed',
        aliases: ['`?speed=`'],
        area: 'pages',
        plain: 'How fast the viewer replays a recording — 1 is real time.',
        detail: 'A plain multiplier read with `Number()`, defaulting to 1. ⛔ A '
            + '[view setting](#view-setting): it changes how fast you WATCH and never what was '
            + 'recorded, so nothing it does can reach a [tape](#tape) or a claim about one. '
            + '⚠ Not to be confused with a [browser row](#browser-row)\'s wall-clock cost — a '
            + 'wasm differential leg runs at ~0.5 frames/sec whatever this says.',
        where: [{ label: 'seedling-bot.md § The URL parameters', doc: URL_TABLE }],
        seeAlso: ['url-parameter', 'view-setting', 'tick', 'tape'],
    }),
    t({
        id: 'screenshot-flag',
        term: 'the screenshot flag',
        aliases: ['`?shot=1`'],
        area: 'pages',
        plain: 'Tells the page it is being photographed by a script rather than read by a '
            + 'person.',
        detail: 'The literal `1`, and nothing else counts. It is how the lab page\'s CLI arm '
            + 'exports a view as a PNG an agent can read — the one channel by which a '
            + 'human-facing page becomes evidence in a record. ⛔ A [view setting](#view-setting) '
            + 'like [`?tick=`](#tick): it selects a PICTURE, never a run.',
        where: [{ label: 'seedlingDemo/watchManual.js — `readViewParams`', code: 'frontend/modules/seedlingDemo/watchManual.js' }],
        seeAlso: ['url-parameter', 'view-setting', 'tick', 'browser-row'],
    }),
    t({
        id: 'staged-level',
        term: 'the staged level',
        aliases: ['`?level=`', 'the staging'],
        area: 'pages',
        plain: 'Which level of the real game the SOLVE arm loads before it starts playing.',
        detail: 'A number naming one of the real game\'s levels, read by the SOLVE arm together '
            + 'with [`?boot=`](#boot-items) — what the player HAS — and `?goals=`. ⛔ Its '
            + 'presence is what SELECTS the arm: `?source=` overrides, but a bare '
            + '[`?tape=`](#tape) is REPLAY and a `?level=` is SOLVE, so the arm is inferred '
            + 'rather than being a fourth thing to remember. ⚠ A GENERATED level is 900, which '
            + 'is outside the real game\'s 116 and is why a scratch run\'s clears do not ride '
            + 'into a tape.',
        where: [{ label: 'seedlingDemo/watchSolve.js — `readSolveParams`', code: 'frontend/modules/seedlingDemo/watchSolve.js' }],
        seeAlso: ['url-parameter', 'boot-items', 'solver', 'tape'],
    }),
    t({
        id: 'tape-name',
        term: 'the tape name',
        aliases: ['`?name=`'],
        area: 'pages',
        plain: 'The label written into the recording the SOLVE arm produces.',
        detail: 'A plain string, carried into `buildStagedTape` so a saved [tape](#tape) says '
            + 'what it is. ⛓ It names the ARTIFACT and never the run: two solves of the same '
            + '[seed](#seed) with different `?name=` are the same solve, which is why it is '
            + 'the one SOLVE parameter that cannot change what is generated.',
        where: [{ label: 'seedlingDemo/watchSolve.js — `readSolveParams`', code: 'frontend/modules/seedlingDemo/watchSolve.js' }],
        seeAlso: ['url-parameter', 'tape', 'staged-level'],
    }),
    t({
        id: 'wall-clock-budget',
        term: 'the wall-clock budget (RETIRED)',
        aliases: ['`?budgetms=`', '`wallClockMs`'],
        area: 'pages',
        plain: 'A bound on generation measured in SECONDS — removed, because it made a busy '
            + 'computer generate a different level.',
        detail: '⛔ **GONE, and the parameter WARNS rather than refusing.** Elapsed time is not '
            + 'a property of a candidate, so a keep-or-revert loop bounded by it kept different '
            + 'obstacles under load and [determinism](#determinism) died silently. Its '
            + 'successor is the [tick budget](#tick-budget), counted in [ticks](#tick). ⚠ The '
            + 'reader tolerates the old key on purpose — a stale link should say where its '
            + 'bound went, not fail — which is the opposite of `?directed=`, a key whose '
            + 'CHANNEL moved and which therefore refuses by name.',
        where: [{ label: 'gotchas.md § Generation used to be non-deterministic under load', doc: `${GOTCHAS}#generation-used-to-be-non-deterministic-under-load--fixed-2026-08-14-and-the-shape-of-the-fix-is-the-lesson` }],
        seeAlso: ['tick-budget', 'determinism', 'url-parameter', 'keep-or-revert'],
    }),
    t({
        id: 'component',
        term: 'a component',
        aliases: ['a connected component', 'a corridor component'],
        area: 'level-gen',
        plain: 'One blob of squares that are all reachable from each other and from nothing '
            + 'outside it.',
        detail: 'What a [flood](#flood) returns: the maximal set of walkable cells joined to a '
            + 'start. ⛓ It is the unit almost every geometric claim here is really about — '
            + 'a [cut](#cut) is a wall that SPLITS the level into two components, an '
            + '[area](#area) is a component of the partition, and *the room is connected* means '
            + '*there is one component*. ⛔ And it inherits the flood\'s blindness: a component '
            + 'is computed over a SYMMETRIC neighbour relation, so a one-way mechanic joins two '
            + 'cells the walk cannot travel between.',
        where: [
            { label: 'gotchas.md § A component flood cannot see a ONE-WAY mechanic', doc: `${GOTCHAS}#a-component-flood-cannot-see-a-one-way-mechanic-and-it-lies-optimistically` },
            { label: 'procgenCore/gridFlood.js', code: 'frontend/modules/procgenCore/gridFlood.js' },
        ],
        seeAlso: ['flood', 'cut', 'area', 'area-partition', 'door-law'],
    }),
    t({
        id: 'wall-backend',
        term: 'a wall backend',
        aliases: ['a backend', 'a maze algorithm'],
        area: 'maze',
        plain: 'One strategy for drawing the walls of a room — the actual maze algorithm.',
        detail: 'Registered by id in `shared/procgen/mazeAlgorithms/registry.js` (kept in '
            + '`shared/` so a future grid substrate can reuse it) and selected through a '
            + '[skeleton kind](#skeleton-kind), which bundles a backend with its parameters '
            + 'and post-processors. ⛔ **A backend is not a biome and not a kind**: adding a '
            + 'biome over an existing backend is one line in `skeletonKinds.js`; adding a '
            + 'BACKEND is a new file. ⚠ Two defaults live in that table and must not be '
            + 'collapsed — `DEFAULT_BIOME_ID` (`classic`) is what an unconfigured AP region '
            + 'generates, `DEFAULT_SKELETON_KIND` (`empty`) is what the constructive loop '
            + 'starts from.',
        where: [{ label: 'maze.md § Biomes and wall backends', doc: `${MAZE}#biomes-and-wall-backends` }],
        seeAlso: ['skeleton-kind', 'skeleton', 'biome', 'the-carve'],
    }),

    /* ══════════ INSTRUMENTS, GATES AND ROWS ═════════════════════════ */

    t({
        id: 'browser-row',
        term: 'a browser row',
        aliases: ['a row', 'a check row'],
        area: 'testing',
        plain: 'A script that opens a real page in a real browser, presses its controls, and '
            + 'checks what it says.',
        detail: 'The `scripts/procgen/check-*.mjs` family. ⛔ **A row brings its own server, '
            + 'so it cannot skip** — a row that quietly does nothing when no server is up is '
            + 'a row that passes for the wrong reason. Each prints one PASS/FAIL line per '
            + 'claim; the counts quoted in the records (`check-maze-lab` 122/0, '
            + '`check-procgen-demos` 94/0) are those lines.',
        where: [
            { label: 'maze.md § The browser row', doc: `${MAZE}#the-browser-row` },
            { label: 'check-procgen-demos.mjs', code: 'scripts/procgen/check-procgen-demos.mjs' },
        ],
        seeAlso: ['claim', 'readout', 'gate', 'demo-catalogue'],
    }),
    t({
        id: 'claim',
        term: 'a claim',
        aliases: ['the claim grammar'],
        area: 'testing',
        plain: 'One checkable sentence about what a page should be showing — the smallest '
            + 'unit of "and this really is true".',
        detail: 'In the demo catalogue it is a written grammar: `<path> <op> <value>`, e.g. '
            + '`elements.certified == true`, parsed by ONE function so the page, the '
            + '[row](#browser-row) and the unit test all agree what a well-formed entry is; a '
            + 'malformed claim THROWS. ⚖ **A catalogue entry without a claim is not an '
            + 'entry.**',
        where: [{ label: 'procgenDocs/demos.js', code: 'frontend/modules/procgenDocs/demos.js' }],
        seeAlso: ['browser-row', 'readout', 'gate', 'demo-catalogue'],
    }),
    t({
        id: 'gate',
        term: 'a gate',
        aliases: [],
        area: 'testing',
        plain: 'A check that has to pass before a change ships.',
        detail: '⛔ **A fixture is only a gate for a change if it can DISTINGUISH the two '
            + 'builds.** The standing Seedling battery md5 did not move across the '
            + '[determinism](#determinism) fix — and re-running it with the defect '
            + 'deliberately reinstated produced the *same* md5, because the branch is dormant '
            + 'at quiet-box speeds. ⇒ run the baseline against a '
            + '[mutant](#mutant) before reading a stationary digest as either a pass or a '
            + 'finding.',
        where: [{ label: 'gotchas.md § Generation used to be non-deterministic under load', doc: `${GOTCHAS}#generation-used-to-be-non-deterministic-under-load--fixed-2026-08-14-and-the-shape-of-the-fix-is-the-lesson` }],
        seeAlso: ['mutant', 'browser-row', 'control-arm', 'claim'],
    }),
    t({
        id: 'mutant',
        term: 'a mutant',
        aliases: ['a mutant build'],
        area: 'testing',
        plain: 'A deliberately broken copy of the code, used to check that your test would '
            + 'actually have noticed.',
        detail: 'The standard close of a slice: one build, one gate each, and an INERT mutant '
            + '(nothing reddens) means the test is fixed or the reason it is legitimately '
            + 'unseen is written down. ⛓ It is the only answer to *"would this have caught '
            + 'it?"* — and a mutant\'s PREDICTED witness is a hypothesis; the row that '
            + 'actually reddens tells you more.',
        where: [{ label: 'gotchas.md § Generation used to be non-deterministic under load', doc: `${GOTCHAS}#generation-used-to-be-non-deterministic-under-load--fixed-2026-08-14-and-the-shape-of-the-fix-is-the-lesson` }],
        seeAlso: ['gate', 'browser-row', 'control-arm'],
    }),
    t({
        id: 'control-arm',
        term: 'a control arm',
        aliases: ['a control run'],
        area: 'testing',
        plain: 'The known-good case you run beside the real one, so you can tell a broken '
            + 'change from a broken machine.',
        detail: 'The empty bordered room is the loop\'s: solvable by construction. ⛔ **A '
            + 'control arm that can be failed by the MACHINE will eventually accuse your code '
            + 'of the machine\'s problem** — a wall-clock budget reclassified the skeleton '
            + 'solve at load ~100 and the guard then reported *"a defect in the room builder"* '
            + 'for a room that was fine. When a change spends a [draw](#draw), the byte-inert '
            + 'claim you want is carried by a control run **in the same tree** (a `git '
            + 'worktree` at the base commit) rather than by a tile comparison.',
        where: [
            { label: 'gotchas.md § Generation used to be non-deterministic under load', doc: `${GOTCHAS}#generation-used-to-be-non-deterministic-under-load--fixed-2026-08-14-and-the-shape-of-the-fix-is-the-lesson` },
            { label: 'gotchas.md § "The `empty` pairs are UNCHANGED"', doc: `${GOTCHAS}#the-empty-pairs-are-unchanged-is-a-gate-only-for-a-change-that-spends-no-draw` },
        ],
        seeAlso: ['byte-inert', 'draw', 'gate', 'skeleton', 'counting-spy'],
    }),
    t({
        id: 'counting-spy',
        term: 'a counting spy',
        aliases: ['`model.roomDraws`'],
        area: 'testing',
        plain: 'A counter wrapped around the random source, so you can prove a change took no '
            + 'extra random numbers.',
        detail: 'The right instrument for a [byte-inert](#byte-inert) claim when the cheap '
            + 'pair dumps cannot serve — it answers *did this change move a '
            + '[draw](#draw)?* directly rather than by comparing tiles. It is what proved the '
            + '[ledger](#ledger) inert: **336 pairs / 0 moved**.',
        where: [{ label: 'gotchas.md § "The `empty` pairs are UNCHANGED"', doc: `${GOTCHAS}#the-empty-pairs-are-unchanged-is-a-gate-only-for-a-change-that-spends-no-draw` }],
        seeAlso: ['byte-inert', 'draw', 'control-arm', 'ledger'],
    }),
    t({
        id: 'census',
        term: 'a census',
        aliases: ['`census-*.mjs`'],
        area: 'testing',
        plain: 'A script that counts what actually happens across many runs, so a claim about '
            + '"usually" has a number behind it.',
        detail: '`census-seedling-{sites,doors,elements,areas,enemies}.mjs` and friends. ⛓ The '
            + 'GEOMETRY a census measured is carried on `certification.geometry` even when the '
            + 'element is DROPPED, so no number is lost to a refusal — it is simply not on the '
            + 'canvas. ⚠ Careful: adding such a field changes the printed payload, and an md5 '
            + 'that moves for that reason is a payload-SHAPE mover, not a behaviour one.',
        where: [
            { label: 'architecture.md § The ledger, the step-through and the instruments', doc: LEDGER_SEC },
            { label: 'gotchas.md § A payload-SHAPE mover and a BEHAVIOUR mover', doc: `${GOTCHAS}#a-payload-shape-mover-and-a-behaviour-mover-are-indistinguishable-in-an-md5` },
        ],
        seeAlso: ['sweep', 'yield-table', 'certification', 'gate'],
    }),
    t({
        id: 'sweep',
        term: 'a sweep',
        aliases: ['a bounded sweep', '`find-seedling-seeds.mjs`'],
        area: 'testing',
        plain: 'Running the same thing over a stated range of inputs and reporting what came '
            + 'back.',
        detail: '⛔ **A bounded sweep must NAME what it bounded.** `find-seedling-seeds.mjs '
            + '--where=` searches by named property, and when it is used to pick a demo the '
            + 'BAR IS PUBLISHED, not tuned: the sword-gated entry\'s search asked for '
            + '`families>=3` over seeds 1–40, N ≥ 3 was stated before the run, it returned '
            + '**1 hit**, and the four hits at the relaxed `families>=2` are listed beside it '
            + 'rather than one being promoted quietly.',
        where: [{ label: 'demos.md — the pointer', doc: DEMOS_DOC }],
        seeAlso: ['census', 'yield-table', 'gate', 'demo-catalogue'],
    }),
    t({
        id: 'yield-table',
        term: 'the yield table',
        aliases: ['`sweep-yield-table.mjs`'],
        area: 'testing',
        plain: 'The arc\'s main scoreboard: for each kind of room, how often the thing you '
            + 'asked for actually got built.',
        detail: 'The arc\'s **primary instrument**. It is what settled '
            + '[`chambers=1`](#chambers) (kept 4 → 102 of 120 pre-sword) and what publishes '
            + 'the [area graph](#area-graph)\'s acceptance (0–4 of 12 per kind on a 10×10 '
            + 'room). ⛓ Its answers are PUBLISHED rather than tuned — a bound is never widened '
            + 'to make a number look better.',
        where: [
            { label: 'architecture.md § The ledger, the step-through and the instruments', doc: LEDGER_SEC },
            { label: 'seedling-bot.md § slice 6 — the yield table and the connectivity pre-check', doc: `${SEEDLING}#slice-6--the-yield-table-and-the-connectivity-pre-check` },
        ],
        seeAlso: ['census', 'sweep', 'chambers', 'area-graph'],
    }),
]);

/* ══════════ THE READERS' HELPERS ════════════════════════════════════ */

/** ⛓ ONE index, built once. Every reader asks this rather than scanning. */
const BY_ID = new Map(TERMS.map((e) => [e.id, e]));

/** The entry, or `null` — ⛔ never a throw: a page must render the rest. */
export const termById = (id) => BY_ID.get(String(id)) ?? null;

/**
 * ⛓⛓ **THE ONE-LINER IS THE `plain` SENTENCE, VERBATIM.** It is what the lab
 * pages hang on a `<summary title="…">`, so a term whose `plain` is jargon
 * would put jargon in the tooltip that exists to remove it. Returns `''` for
 * an unknown id, because a `title=""` is a missing tooltip and a thrown error
 * is a broken page.
 */
export const oneLinerFor = (id) => termById(id)?.plain ?? '';

/**
 * The link to a term's definition.
 *
 * - no `base` → `glossary.html#<id>`, correct from any page in this directory
 *   and from a repo-rooted dev server alike when the caller prefixes it;
 * - a `base` → the DEPLOYED page, through the ONE spelling of the Pages
 *   mapping (`pagesUrl` in `demos.js`).
 */
export function hrefFor(id, { base = null } = {}) {
    const anchor = `#${String(id)}`;
    return base ? `${pagesUrl(GLOSSARY_PAGE, { base })}${anchor}` : `glossary.html${anchor}`;
}

/** Terms of one area, in declaration order. */
export const termsInArea = (areaId) => TERMS.filter((e) => e.area === areaId);

/**
 * ⛓⛓⛓ **THE SHAPE GATE, CALLABLE FROM A PAGE.** It answers everything that
 * can be decided without a filesystem: ids unique and slug-shaped, every
 * `area` declared, every `seeAlso` resolving, every `where` naming either a
 * TRACKED doc under `docs/json/developer/procgen/` or a repo code path, and
 * `plain` being ONE sentence. ⛔ Whether a `where.doc` FILE exists, and
 * whether its `#fragment` names a real heading, needs the disk — that half
 * lives in `glossary.test.js`.
 *
 * @returns {string[]} the problems; EMPTY means well-formed.
 */
export function assertGlossary() {
    const problems = [];
    const seen = new Set();
    const areas = new Set(AREA_IDS);
    for (const e of TERMS) {
        if (seen.has(e.id)) problems.push(`duplicate id ${JSON.stringify(e.id)}`);
        seen.add(e.id);
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) {
            problems.push(`id ${JSON.stringify(e.id)} is not a lower-kebab slug`);
        }
        if (!areas.has(e.area)) {
            problems.push(`${e.id}: area ${JSON.stringify(e.area)} is not one of `
                + `[${AREA_IDS.join(', ')}]`);
        }
        if (!e.term) problems.push(`${e.id}: no display term`);
        if (!e.plain) problems.push(`${e.id}: no plain sentence`);
        if (!e.detail) problems.push(`${e.id}: no detail`);
        /** ⛔ ONE sentence: a `plain` that ran to three would be a second
         *  `detail`, and the tooltip it feeds has no room for one. */
        if ((String(e.plain).match(/[.!?](\s|$)/g) ?? []).length > 1) {
            problems.push(`${e.id}: plain is more than one sentence — ${e.plain}`);
        }
        if (!e.where.length) problems.push(`${e.id}: names nowhere it lives`);
        for (const w of e.where) {
            if (!w.label) problems.push(`${e.id}: a where entry with no label`);
            if (w.doc && w.code) problems.push(`${e.id}: ${w.label} names both doc and code`);
            if (!w.doc && !w.code) problems.push(`${e.id}: ${w.label} names neither doc nor code`);
            if (w.doc) {
                if (!String(w.doc).startsWith(DOC_ROOT)) {
                    problems.push(`${e.id}: ${w.doc} is not under ${DOC_ROOT}`);
                }
                /** ⛔ `NewDocs/` is gitignored, so a pointer into it is a link
                 *  a reader on Pages cannot follow. */
                if (/(^|\/)NewDocs\//.test(String(w.doc))) {
                    problems.push(`${e.id}: ${w.doc} points into the UNPUBLISHED NewDocs tree`);
                }
            }
            if (w.code && /(^|\/)NewDocs\//.test(String(w.code))) {
                problems.push(`${e.id}: ${w.code} points into the UNPUBLISHED NewDocs tree`);
            }
        }
    }
    for (const e of TERMS) {
        for (const other of e.seeAlso) {
            if (!seen.has(other)) {
                problems.push(`${e.id}: seeAlso ${JSON.stringify(other)} resolves to nothing`);
            }
            if (other === e.id) problems.push(`${e.id}: seeAlso points at itself`);
        }
    }
    return problems;
}

export default TERMS;
