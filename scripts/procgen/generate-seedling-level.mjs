#!/usr/bin/env node
/**
 * generate-seedling-level — THE PoC's CLI TWIN (kickoff §3.5, slice 2).
 *
 * Seed + biome + obstacle target + budget in; a generated Seedling level and
 * its FULL generation trace out. One loop, one model, one oracle — this
 * script owns no generation logic at all: it parses arguments, calls
 * `procgenSeedling.generateSeedlingLevel`, and prints. ⚖ Kickoff §5's
 * one-of-everything law, applied to the thing most likely to grow a second
 * copy of the loop.
 *
 * ── ⛔ STDOUT IS THE DETERMINISM CHANNEL ──────────────────────────────
 *
 * `prove-seedling-procgen-seam.mjs`'s law, inherited: everything that may
 * honestly differ between two runs of one seed — milliseconds, this
 * machine's speed — goes to STDERR and never to stdout. So
 *
 *     node … --seed=1 > a; node … --seed=1 > b; cmp a b
 *
 * is the determinism proof rather than a ritual, in two SEPARATE PROCESSES
 * (one process proves the generator is a function; two prove it depends on
 * nothing the process carries).
 *
 * ── ⚠⚠ NOTHING BOUNDS ELAPSED TIME, SO THE COST IS STATED UP FRONT ────
 *
 * `solveSegment` is synchronous and uninterruptible, and since 2026-08-14 no
 * budget in this pipeline is denominated in milliseconds at all: the budget
 * bounds TICKS, which is a property of the candidate rather than of the box
 * (`procgenOracle`'s DEFAULT_BUDGET docblock carries the measurements). ⇒
 * `--cost` prints `levelGenerator.costModel`'s arithmetic — `1 + target x
 * tries` solves at the worst measured solve — BEFORE anything runs, and the
 * real total goes to stderr afterwards. A reader who expected a timeout is the
 * reader this exists for, and there is no timeout to expect.
 *
 * ── WHAT THIS SCRIPT DOES NOT DO ──────────────────────────────────────
 *
 * ⛔ NO PNG. ⚖ Kickoff §3.5 pairs the CLI's JSON with a PNG through
 * `export-seedling-view.mjs`, and that exporter renders a level THE PAGE HAS
 * LOADED — it drives `watch.html` in a browser, and the page's SOURCE arms
 * are the atlas, a tape and manual mode. A synthetic level enters the page
 * through the GENERATE arm, which is **slice 4's** work. There is no
 * zero-new-surface way to hand the existing exporter a level that is not in
 * the atlas: `--level` selects an atlas level by id. Reported rather than
 * half-built (slice 2's charge says exactly this).
 *
 * ⛔ NOTHING IS WRITTEN TO `fixtures/`, EVER (standing law). `--out` writes
 * where it is told; without it the payload is stdout.
 *
 * Run:
 *   node scripts/procgen/generate-seedling-level.mjs --seed=1
 *   node scripts/procgen/generate-seedling-level.mjs --seed=1 --count=8 --json
 *   node scripts/procgen/generate-seedling-level.mjs --seed=1 --out=/tmp/level.json
 *   node scripts/procgen/generate-seedling-level.mjs --cost --count=8
 *   node scripts/procgen/generate-seedling-level.mjs --seed=3 --families=water,weigh
 *   node scripts/procgen/generate-seedling-level.mjs --seed=3 --templates=pit-patch
 *   node scripts/procgen/generate-seedling-level.mjs --seed=6 --count=0 \
 *       --directed='wall-gap-block(ori=v,gap=1)@12d'
 */

import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const M = (p) => import(join(HERE, '..', '..', 'frontend/modules/seedlingDemo', p));
// ⛓ The loop core left `seedlingDemo/` in CONSTRUCTIVE-MODE slice 2 (the maze
// binds to the same file); the Seedling bindings did not.
const CORE = (p) => import(join(HERE, '..', '..', 'frontend/modules/procgenCore', p));

const { ATTEMPT, STOP, costModel } = await CORE('levelGenerator.js');
const { formatSkeleton, parseSkeleton } = await CORE('skeletonKinds.js');
const { formatAreaSpec, parseAreaSpec } = await CORE('areaSpec.js');
const { DEFAULT_BUDGET } = await M('procgenOracle.js');
const { generateSeedlingLevel, seedlingSkeletonSpec } = await M('procgenSeedling.js');
const {
    FILL_DENSE, ROOM_TILES_MAX, ROOM_TILES_MIN, SINGLE_SCREEN_TILES, assertRoomSize, fillByName,
} = await M('procgenLevel.js');
const {
    DEFAULT_SKELETON, GENERATE_BIOMES, describeKeptKind, directedCost, generateWithDirectives,
    paletteFor, parseDirectives,
} = await M('watchGenerate.js');
const { restrictPalette } = await M('procgenPalette.js');
const {
    ITEMS_ELEMENTS_NEED, NONE: ELEMENTS_NONE, formatElementSpec, isElementList,
    parseElementSpec, parseItemRequireList,
} = await CORE('elementSpec.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const has = (name) => process.argv.includes(`--${name}`);
const num = (name, fallback) => Number(arg(name, fallback));

const SEED = num('seed', 1);
const BIOME = arg('biome', 'pre-sword');
const COUNT = num('count', 6);
const TRIES = num('tries', 8);
const SATURATION_K = num('k', 3);
/**
 * ⛓ THE ANCHOR SEARCH (GENERATE-mode UI slice 3, track B). 1 is the
 * pre-search behaviour and the level it produces is byte-identical to what
 * this CLI produced before the bound existed; above 1 the loop walks further
 * down the SAME seeded anchor order before giving a candidate up.
 */
const ANCHOR_TRIES = num('anchor-tries', 1);
/**
 * ⛓⛓ CONSTRUCTIVE-MODE SLICE 5 — **THE ROOM THE LOOP STARTS FROM.** The
 * default is the OPEN bordered room this CLI has always generated, so
 * `--skeleton` absent produces exactly the level it produced before the kinds
 * existed. ⛔ `classic` and `corridor` need the maze simulator and refuse BY
 * NAME inside the binding — this file keeps no second list.
 */
/**
 * ⛓⛓ SLICE 7 — AND ITS PARAMETERS, in the SAME `;` grammar the URL speaks:
 * `--skeleton='rooms;minRoom=2;chambers=1'` (quote it — `;` is the shell's).
 * ⛔ ONE PARSER (`skeletonKinds.parseSkeleton`), so a CLI and a link cannot
 * disagree about what a value means.
 */
/**
 * ⛓⛓ ARC 3, SLICE 4b — **THROUGH THE SEEDLING RESOLVER**, not bare
 * `parseSkeleton`: the five carved TREE kinds default to `chambers=1` on this
 * substrate (D6), and the default must be applied BEFORE normalisation or a
 * typed `chambers=0` is indistinguishable from an omitted one.
 */
const SKELETON = seedlingSkeletonSpec(arg('skeleton', 'empty'));
/**
 * ⛓⛓⛓ PROCGEN ELEMENTS arc 5, slice 1 — **THE ROOM CONTRACT** (⚖ rulings 1
 * and 2): `--width=`/`--height=` in tiles, and `--fill=dense|shell`.
 *
 * ⛔ ABSENT IS THE ONE-SCREEN 10x10 ROOM this CLI has always generated, and the
 * knob is BYTE-INERT when it is not typed: size is a CONSTANT INPUT and not a
 * draw, so `--width=10 --height=10` prints the identical payload to a run with
 * neither flag (this slice proves it with the PAIR, `--json | cmp`, rather than
 * asserting it about one arm).
 *
 * ⛔ A SIZE OUTSIDE [3..60] REFUSES BY NAME AND EXITS 6 — the maze CLI's
 * "refused run" code, which is what a directive or a graph refusal already
 * uses here. 60 is the VANILLA MAXIMUM measured over the shipped atlas, and the
 * refusal says so; it is never clamped, because a clamp would certify a room
 * nobody asked for.
 */
const SIZE = (() => {
    const size = {
        width: num('width', SINGLE_SCREEN_TILES.width),
        height: num('height', SINGLE_SCREEN_TILES.height),
    };
    try {
        return assertRoomSize(size, 'generate-seedling-level');
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        process.exit(6);
        return null;
    }
})();
const SIZE_TYPED = process.argv.some((a) => a.startsWith('--width=') || a.startsWith('--height='));
const FILL = (() => {
    try {
        return fillByName(arg('fill', FILL_DENSE), 'generate-seedling-level');
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        process.exit(6);
        return null;
    }
})();
/**
 * ⛓⛓⛓ PROCGEN ELEMENTS arc 3, slice 3 — **THE ELEMENT**, through the ONE codec
 * (`procgenCore/elementSpec.js`), the same string the maze CLI takes and the
 * same one slice 5's `?elements=` will read: `--elements=guard`,
 * `--elements='guard;len=2'` (quote it — `;` is the shell's).
 *
 * ⛓⛓⛓ **THE DEFAULT FOLLOWS THE BIOME SINCE ARC-3 SLICE 4c** (⚖ user,
 * 2026-08-17). ABSENT is not `none` any more: it is
 * `procgenSeedling.defaultElementsFor(palette.items)` —
 * `guard;len=2+blockpocket` pre-sword, `guard;len=2+killgate+blockpocket`
 * post-sword, a `+` LIST meaning ONE of these, drawn. ⛔ That is the other half
 * of the retirement of the three door TEMPLATES: what they stopped doing, the
 * elements now do by default.
 *
 * ⛔ `--elements=none` IS STILL SELECTABLE and still draws no site, constructs
 * nothing and spends no draw. ⚠ It is no longer byte-identical to what this CLI
 * printed before elements existed — the GOAL DRAW moved in the same commit.
 *
 * ⛔ THE FLAG IS READ AS "WAS IT TYPED", not as a value with a default: absent
 * passes `undefined` to `generateSeedlingLevel`, which is the ONE place that
 * knows the biome. A default spelled here would be a second answer to "what
 * does this run build" and the sweep would need a third.
 *
 * ⚠ `turns` IS NOT A KNOB HERE even though the codec carries it: ⚖ arc-3 ruling
 * 1 gives Seedling the STRAIGHT LANE only, so the binding forces `turns = 0` and
 * REFUSES BY NAME when a spec names anything else (`the-chain-is-arc-4`). ⚠ And
 * `binds` is the MAZE's knob (which area may hold a key symbol) — Seedling's
 * area binding is slice 4, so it resolves and is not yet consulted.
 *
 * ⛔⛔ **NO PLACED GADGET IS CERTIFIED TODAY.** The readout and the payload say
 * so with the SOLVE'S OWN refusal text; see `procgenSeedlingElements.js`'s
 * docblock and the arc-3 as-built §10 (the S1 "nested openers" work order).
 */
const ELEMENTS_ARG = arg('elements', '');
const ELEMENTS = ELEMENTS_ARG === '' ? undefined : parseElementSpec(ELEMENTS_ARG);

/**
 * ⛓⛓⛓ PROCGEN ELEMENTS arc 3, slice 4b — **THE AREA GRAPH**, through arc 1's
 * ONE codec (`procgenCore/areaSpec.js`), the same string the MAZE CLI takes and
 * the same one slice 5a's `?areas=` will read: `--areas=1`,
 * `--areas='2;graphify=0.5;goalShortcut=0'` (quote it — `;` is the shell's).
 *
 * ⛔ THE DEFAULT IS `0`, WHICH MEANS THE MODULE DOES NOT RUN AT ALL — not "runs
 * and returns early". No partition is computed, `buildAreaGraph` is not called
 * and the rng is not touched, so a run without this flag is byte-identical to
 * the one this CLI printed before the flag existed.
 *
 * ⛔ A REFUSED GRAPH IS A REFUSED RUN AND SAYS SO IN THE EXIT CODE (6, the maze
 * CLI's own), while the LEVEL is still printed — the evidence for the refusal is
 * in it, and a level shipped without its graph is arc 1's own rule (*a refused
 * GRAPH still shows its carved level*).
 */
const AREAS = parseAreaSpec(arg('areas', '0'));

/**
 * ⛓⛓⛓ PROCGEN ELEMENTS arc 3, slice 4d — **`--require=hasSword`, THE
 * RULE-DIRECTED RUN** (⚖ design §3.5's family J′; the maze CLI's `--require=K0`
 * one substrate over, and the same grammar — `areaSpec.parseRequireList` with
 * the ITEM vocabulary).
 *
 * ⛔ IT NAMES AN ITEM, NEVER AN ELEMENT. The element is DERIVED from the
 * catalogue's `needs` (today `killgate`), so a second sword-gated element is a
 * row in `ELEMENT_TABLE` and nothing else.
 *
 * ⚠ AND IT MOVES THE ROOM AT THE SAME SEED. The biome DEFAULT is a `+` list
 * that spends one `pick`; a FORCED head is a BARE head and spends none, so
 * `--require=hasSword` and the bare default draw different streams even when
 * the default happens to land `killgate`. The identity line names the spec the
 * run actually used, which is where a reader sees it.
 *
 * ⛔ A DIRECTIVE THAT CANNOT BE MET IS A REFUSED RUN — exit 6, the level still
 * printed (arc 1's rule), the reason NAMED.
 */
const REQUIRE_ARG = arg('require', '');
const REQUIRE = REQUIRE_ARG === '' ? undefined : parseItemRequireList(REQUIRE_ARG);

/**
 * ⛓ WHAT EACH ELEMENT'S LIFTED CLAIM ACTUALLY CLAIMS — the discriminating
 * question is per MECHANISM (arc-3 §12), so the readout names it rather than
 * printing one element's sentence over another's number.
 */
const LIFTED_CLAIM_TEXT = Object.freeze({
    'reverse-pull-block': 'A BLOCK WAS ON THE BUTTON WHEN THE DOOR WAS FIRST CROSSED',
    'kill-gate': 'THIS GATE\'S OWN BODY CLEARED THIS GATE\'S OWN LOCK, BEFORE THE CROSSING',
    'block-pocket': 'THIS BLOCK WAS SHOVED AS FAR AS THE ELEMENT GUARANTEED',
});
/**
 * ⛓⛓ VERB 1 — **RESTRICT** (GENERATE-mode UI slice 4). `--families=a,b` or
 * `--templates=x,y` narrows the sub-roster this run may draw from; ABSENT is
 * the whole roster.
 *
 * ⛔ BOTH AT ONCE REFUSES, exactly as `?families=`/`?templates=` do in the
 * page: they are two spellings of one setting, so there is nothing to
 * compose. ⛔ AND THE MEMBER NAMES ARE VALIDATED — `restrictPalette` refuses
 * an unknown family or template BY NAME and lists what the palette offers,
 * because a silently dropped member would WIDEN the roster and certify the
 * level under a question nobody asked.
 *
 * ⚠ THE CLI HAS THE FLAGS SO THE TWO RUNTIMES STAY ONE SPELLING. The page can
 * emit a restricted payload; without these flags this script could not
 * reproduce one, and `?gen=` compares the roster like every other identity
 * field.
 */
const list = (name) => {
    const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
    if (raw === undefined) return null;
    const names = raw.slice(`--${name}=`.length).split(',').map((x) => x.trim())
        .filter((x) => x !== '');
    if (names.length === 0) {
        process.stderr.write(`generate-seedling-level: --${name}= names nothing. The whole `
            + 'roster is spelled by leaving the flag out; an empty list is a restriction '
            + 'somebody emptied.\n');
        process.exit(2);
    }
    return names;
};
const FAMILIES = list('families');
const TEMPLATES = list('templates');
if (FAMILIES && TEMPLATES) {
    process.stderr.write('generate-seedling-level: --families= and --templates= are two '
        + 'spellings of ONE setting (the sub-roster) and do not compose. Say it one way.\n');
    process.exit(2);
}
const ROSTER = FAMILIES ? { axis: 'families', names: FAMILIES }
    : (TEMPLATES ? { axis: 'templates', names: TEMPLATES } : null);
/**
 * ⛓⛓ VERB 2 — **THE DIRECTED ATTEMPT** (GENERATE-mode UI slice 5), parsed by
 * `urlParams.parseDirectives`, the SAME function the page and the payload's
 * instance labels use, so the CLI and the page cannot disagree about what a
 * construction is.
 *
 * ⛔ IT IS HERE FOR THE SAME REASON `--families=` IS: the payload is compared
 * across the two runtimes (`?gen=`), and a field only ONE producer can emit is
 * a field that check can never exercise. ⚠ A run with no `--directed=` takes
 * the pre-slice code path untouched, so no existing invocation moves.
 *
 * ⛓⛓⛓ **AND IT STAYS, WHERE `?directed=` WENT** (constructive-mode slice 12,
 * ⚖ kickoff §3.9). The user's ruling took the directive list off the ADDRESS
 * BAR — a URL names the launch parameters a person types, and a construction is
 * the payload's job. ⛔ A CLI FLAG IS A DIFFERENT SURFACE and the ruling does
 * not touch it: it is how a script or a browser row LAUNCHES a directed run in
 * node, and it is what produces the payloads `?gen=` then replays. One grammar,
 * three channels (this flag, the ATTEMPT button, `payload.directives`); the
 * bar is simply no longer one of them.
 */
const DIRECTED_ARG = arg('directed', '');
/**
 * ⛔ `--budget-ms` IS GONE and is refused by name below rather than ignored —
 * the wall clock it set no longer exists (`procgenOracle`'s DEFAULT_BUDGET
 * docblock has the measurements). A flag that silently did nothing would leave
 * a caller believing they had bounded a run they had not.
 */
const BUDGET = {
    maxTicksPerTarget: num('ticks', DEFAULT_BUDGET.maxTicksPerTarget),
};
if (process.argv.some((a) => a.startsWith('--budget-ms'))) {
    process.stderr.write('generate-seedling-level: --budget-ms is GONE. Elapsed time no '
        + 'longer classifies a solve — it is not a property of the candidate, and it made '
        + 'generation depend on how busy the box was. Bound `--ticks` instead.\n');
    process.exit(2);
}

/**
 * ⚖ THE TWO BIOMES (kickoff §0), and slice 4 is where the second one arrives.
 *
 * The refusal stays BY NAME: a `--biome` this map does not hold must not
 * silently generate the other biome's level, because the boot is the whole
 * difference between them and a level generated under the wrong inventory is
 * a level whose certification is about a run nobody asked for.
 *
 * ⛓ SLICE 5 — IMPORTED, NOT SPELLED. The page's GENERATE arm needs the same
 * map, and the moment there were two of them "the CLI and the page generate
 * different levels for the same `--biome`" became possible. One map
 * (`watchGenerate.GENERATE_BIOMES`), two readers.
 */
const BIOMES = GENERATE_BIOMES;
if (!BIOMES[BIOME]) {
    process.stderr.write(`generate-seedling-level: biome "${BIOME}" is not available — `
        + `this build ships [${Object.keys(BIOMES).join(', ')}].\n`);
    process.exit(2);
}

/**
 * ⛔ THE RESTRICTION IS APPLIED THROUGH THE SAME FUNCTION THE PAGE USES, so a
 * `--families=` run and a `?families=` run draw from the same sub-roster in
 * the same ORDER (which `rng.pick` indexes, so the order IS identity).
 */
let PALETTE;
try {
    PALETTE = restrictPalette(BIOMES[BIOME], ROSTER);
} catch (e) {
    process.stderr.write(`generate-seedling-level: ${e.message}\n`);
    process.exit(2);
}

const say = (line) => process.stdout.write(`${line}\n`);
const note = (line) => process.stderr.write(`${line}\n`);
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const bounds = {
    obstacleTarget: COUNT,
    triesPerStep: TRIES,
    saturationK: SATURATION_K,
    anchorTriesPerCandidate: ANCHOR_TRIES,
};

if (has('cost')) {
    /** ⚠ 139 ms is slice 1's own worst measured empty-room solve. */
    const cost = costModel(bounds, 139);
    say(JSON.stringify(cost, null, 2));
    process.exit(0);
}

const DIRECTED = DIRECTED_ARG === '' ? null : parseDirectives(DIRECTED_ARG, paletteFor(BIOME));
/**
 * ⛔ `--elements=` AND `--directed=` DO NOT COMPOSE THIS SLICE, and it refuses
 * BY NAME rather than silently dropping one. `generateWithDirectives` is the
 * PAGE's construction path and builds its own model; threading the element
 * through it is family K (slice 5, `?elements=`), and a flag that was accepted
 * and ignored would produce a payload naming a gadget the level does not hold.
 */
if (DIRECTED && AREAS.keys > 0) {
    process.stderr.write('generate-seedling-level: --areas= and --directed= do not compose. '
        + 'The directed path is `watchGenerate.generateWithDirectives` (the page\'s), which '
        + 'builds its own model; the area binding reaches it in slice 5a with `?areas=`. A '
        + 'flag accepted and ignored would produce a payload naming a graph the level does '
        + 'not hold.\n');
    process.exit(2);
}
if (DIRECTED && REQUIRE !== undefined) {
    process.stderr.write('generate-seedling-level: --require= and --directed= do not compose. '
        + 'A directive is a property of the WHOLE RUN and it FORCES the element head before '
        + 'the model exists; the directed path is `watchGenerate.generateWithDirectives` (the '
        + `page's), which builds its own model. The items some element needs are `
        + `[${ITEMS_ELEMENTS_NEED.join(', ')}].\n`);
    process.exit(2);
}
if (DIRECTED && ELEMENTS !== undefined
    && (isElementList(ELEMENTS) || ELEMENTS.name !== ELEMENTS_NONE)) {
    process.stderr.write('generate-seedling-level: --elements= and --directed= do not compose '
        + 'yet. The directed path is `watchGenerate.generateWithDirectives` (the page\'s), and '
        + 'the element binding reaches it in slice 5 with `?elements=`. Say one or the other.\n');
    process.exit(2);
}

/**
 * ⛔ `--directed=` DOES NOT COMPOSE WITH THE ROOM CONTRACT THIS SLICE, and it
 * refuses BY NAME rather than silently building a default room. The directed
 * path is `watchGenerate.generateWithDirectives` (the PAGE's), which DOES take
 * the size — but a directive's own anchor domain is the room's, and no directed
 * subject in this repo was ever recorded at another size. ⚠ Named rather than
 * threaded: a flag accepted and ignored would print a payload whose level is
 * not the room the caller asked for, and threading it would ship a domain
 * nothing measured.
 */
if (DIRECTED && (SIZE_TYPED || FILL !== FILL_DENSE)) {
    process.stderr.write('generate-seedling-level: --directed= does not compose with '
        + '--width=/--height=/--fill= yet. A directive\'s anchors are the ROOM\'s, and no '
        + 'directed subject has been measured at another size or in the shell format. Say one '
        + 'or the other.\n');
    process.exit(2);
}

const t0 = Date.now();
let out;
try {
    out = DIRECTED
        // ⛓ ONE construction path, shared with the page — `generateWithDirectives`
        // runs the ladder to the target and then applies the directives in order,
        // with the same per-directive stream derivation the page uses.
        ? generateWithDirectives({
            seed: SEED, biome: BIOME, step: bounds.obstacleTarget, bounds, budget: BUDGET,
            roster: ROSTER, directed: DIRECTED, skeleton: SKELETON,
        })
        : generateSeedlingLevel({
            seed: SEED, palette: PALETTE, bounds, budget: BUDGET, skeleton: SKELETON,
            areas: AREAS,
            elements: ELEMENTS,
            require: REQUIRE,
            /** ⛓ ARC 5, SLICE 1 — the room contract, through the seam's own
             *  `defaults` argument; the shell strip runs at the end of pass 2. */
            defaults: { width: SIZE.width, height: SIZE.height },
            fill: FILL,
        });
} catch (e) {
    /**
     * ⛔ AN ABORT PRINTS ITS EVIDENCE AND EXITS 3 — a distinct code, because
     * "the room could not be generated" and "the engine threw inside the
     * oracle" are different things to a caller. `GenerationAborted` carries
     * the trace up to the abort precisely so this branch has something to
     * print (see its docblock: the measured case is the solver's own drive
     * clipping lethal terrain in a dense room).
     */
    if (e.name !== 'GenerationAborted') throw e;
    note(`ABORTED: ${e.message}`);
    say(JSON.stringify({
        seed: SEED, biome: BIOME, bounds, roster: PALETTE.roster ?? null, aborted: true,
        cause: { name: e.cause?.name ?? null, message: e.cause?.message ?? null },
        trace: e.trace,
    }, null, 2));
    process.exit(3);
}
const elapsedMs = Date.now() - t0;

/**
 * ⛔ THE PAYLOAD — everything that must be identical between two runs of one
 * seed, and NOTHING that is allowed to differ. No `ms`, nothing derived from
 * one. The LEVEL is the atlas record itself (⚖ kickoff §2: the atlas-record
 * JSON IS the PoC's level format), so this file is loadable by anything that
 * can read the atlas.
 */
const payload = {
    generator: 'scripts/procgen/generate-seedling-level.mjs',
    seed: SEED,
    biome: BIOME,
    bounds,
    /**
     * ⛓ SLICE 4: THE SUB-ROSTER THIS RUN DREW FROM — `null` for the whole
     * roster. It is an IDENTITY field: `agreementWithPayload` compares it
     * beside seed and biome, because a payload made under a restriction and
     * reproduced under the whole roster would report a level DIVERGENCE whose
     * real cause is the question, not the generator.
     */
    roster: PALETTE.roster ?? null,
    /**
     * ⛓ SLICE 5: THE DIRECTIVES, in order — ⚖ §3.5's *"the level becomes ladder
     * + directives"*. An identity field like the roster, compared by
     * `agreementWithPayload` with `?? []` on both sides so a payload written
     * before this field existed does not falsely diverge.
     */
    directives: out.directives ?? [],
    /**
     * ⚖ Ruling 9(b)'s block, FILLED by slice 5. ⚠ `out.skeleton` exists only on
     * a `generateWithDirectives` state (the page's shape); a plain
     * `generateSeedlingLevel` returns the loop's own three fields, so the CLI's
     * own `SKELETON` is the fallback rather than the constant — a payload that
     * said `empty` about a `winding` run would be a report contradicting its
     * own level.
     */
    skeleton: out.skeleton ?? SKELETON,
    /**
     * ⛓ ARC 5, SLICE 1 — **OMITTED ENTIRELY AT `dense`**, which is what keeps
     * every payload written before this slice byte-identical. The SIZE needs no
     * field of its own: `payload.level` IS the room and has always carried
     * `width`/`height`, which is what `agreementWithPayload` compares.
     */
    ...(FILL === FILL_DENSE ? {} : { fill: FILL }),
    /**
     * ⚠ THE BUDGET COMES FROM WHICHEVER OBJECT RAN. A `--count=0 --directed=…`
     * construction has NO ladder summary — nothing was drawn — but the
     * directives still ran under a budget, and that budget is on the state.
     * Printing `null` there would be a payload that could not say what its own
     * solves were bounded by.
     */
    budget: out.summary?.budget ?? out.budget,
    summary: out.summary,
    level: out.record,
    trace: out.trace,
};

if (has('json')) {
    say(JSON.stringify(payload, null, 2));
} else {
    const s = out.summary;
    say(`# generated Seedling level — seed ${SEED}, biome ${BIOME}`);
    say('');
    const tileCount = out.record.layers.find((l) => l.name === 'tiles').tiles.length;
    say(`room:   ${out.record.width}x${out.record.height} tiles, level ${out.record.level}`
        + `, skeleton ${formatSkeleton(SKELETON)}`
        + (SKELETON.kind === 'empty' ? ' (the bordered open room)' : ' (CARVED)')
        /**
         * ⛓ ARC 5, SLICE 1 — the FILL, and it prints the CELL COUNT beside it
         * rather than the word alone: `shell` on an open room drops nothing at
         * all (every wall of the ring touches the floor), and a readout that
         * said `shell` without the number would let a reader believe a strip
         * had happened where none did.
         */
        + `, fill ${FILL} (${tileCount} of ${out.record.width * out.record.height} cells `
        + 'written)');
    /**
     * ⛓⛓ THE ELEMENT LINE — and it prints the CERTIFICATION VERDICT, not a
     * placement, because the two differ today and hiding the difference is the
     * one thing this slice must not do.
     */
    /**
     * ⛔ KEYED ON THE **RESOLVED** SPEC, NOT ON THE FLAG (arc-3 slice 4c). The
     * flag is absent at the biome default and the run still holds an element;
     * a readout that asked the flag would print nothing about the very thing
     * the default just built — the ECHO-vs-VALUE shape (trap 269) with the two
     * ends swapped.
     */
    const SPEC = out.model.elementSpec;
    /**
     * ⛓⛓ THE AREA BINDING'S OWN LINE (arc 3, slice 4b) — the MAZE CLI's block,
     * one substrate over. ⛔ Printed only when the graph was ASKED for, so a run
     * without `--areas=` says nothing new.
     */
    /**
     * ⛓⛓ THE DIRECTIVE'S OWN LINE (arc 3, slice 4d) — the maze CLI's `requires:`
     * block, one substrate over. ⛔ Printed only when a directive was ASKED for,
     * so a run without `--require=` says nothing new, and it names the GRADE
     * rather than a bare met/not: STRONG and BOUND-DEPENDENT are both "met" and
     * a reader picking a demo seed wants to know which.
     */
    if (s?.require) {
        const r = s.require;
        say(`requires: ${[].concat(r.asked).join(', ')} — `
            + `${r.met ? 'MET' : 'NOT MET'} via the ${[].concat(r.element).join('/')} element `
            + `(${r.forced ? 'head FORCED by the directive, no draw spent' : 'as asked'}; `
            + `spec ${r.spec})`
            + (r.met
                ? `; grade ${[].concat(r.grade).join(', ')} — WITH the item ${r.with.ticks} `
                    + `tick(s) SOLVED, WITHOUT it `
                    + `${[].concat(r.without).map((w) => w?.verdict ?? 'n/a').join(', ')}`
                : `; ⛔ ${r.refused.reason}`));
    }
    if (AREAS.keys > 0) {
        const a = s?.areas;
        say(`areas:  ${formatAreaSpec(AREAS)} — ${a?.partition?.areaCount ?? 0} area(s) `
            + `(${a?.partition?.syntheticCount ?? 0} synthetic, `
            + `${a?.partition?.elementCount ?? 0} declared by an element), `
            + `${a?.partition?.adjacencyCount ?? 0} adjacency pair(s); `
            + (a?.ran
                ? `${a.symbols.length} symbol(s) [${a.symbols.join(', ')}], `
                    + `${a.lockCount} lock(s) on area boundaries, ${a.flags.length} flag(s) `
                    + `${a.flags.map((f) => `${f.symbol}@(${f.x},${f.y})`
                        + `${f.guarded ? ' GUARDED by the element' : ''}`).join(' ')}, `
                    + `${a.graphifyEdges} graphify edge(s); ${a.draws} draw(s) over `
                    + `${a.attempts} attempt(s); tags `
                    + `${Object.entries(a.tags ?? {}).map(([k, t]) => `${k}{flag ${t.flag}, `
                        + `locks ${t.lock}}`).join(' ')}`
                    + (a.supersededFlagLock
                        ? `; ⛓ the element's own flag-lock at (${a.supersededFlagLock.x},`
                            + `${a.supersededFlagLock.y}) was SUPERSEDED by the boundary locks`
                        : '')
                : `⛔ REFUSED: ${a?.refused?.reason} — ${a?.refused?.detail}`));
        if (a?.ran) {
            say(`        ⛔⛔ CERTIFIED: ${a.certified} — ${a.certification.verdict}`
                + ` (${a.certification.source})`);
            if (a.certification.reasonText) {
                say(`        the solve's own words: ${a.certification.reasonText}`);
            }
        }
    }
    if (isElementList(SPEC) || SPEC.name !== ELEMENTS_NONE) {
        const e = s?.elements ?? null;
        const p = e?.placed?.[0] ?? null;
        /**
         * ⛓ A `+` LIST NAMES SEVERAL HEADS AND THE STREAM DREW ONE, so the line
         * prints both: what was asked for, and what this seed got.
         */
        const asked = formatElementSpec(SPEC);
        const drew = formatElementSpec(out.model.elementHead);
        const head = asked === drew ? asked : `${asked} -> drew \`${drew}\``;
        /**
         * ⛓⛓ TWO PHASES, TWO GEOMETRIES, TWO SENTENCES. A `pre-carve` gadget
         * has a SITE and a tunnel; an `on-connector` door has neither — it has
         * a door cell, a clearer, the wall it GREW and the cell it CARVED. One
         * printer that said `site: undefined` for a door would be the summary's
         * own flattening defect wearing a readout.
         */
        const shape = () => (p.phase === 'on-connector'
            ? `${p.instance} door (${p.doorCell.x},${p.doorCell.y})`
                + `${p.tags?.lock !== undefined ? ` [tag ${p.tags.lock}]` : ''}; `
                + `clearer ${p.clearer.map((c) => `(${c.x},${c.y})`).join(' ') || '(none)'}; `
                + `wall GREW ${p.wall} cell(s), CARVED ${p.carved}; `
                + `${p.cost.candidates} door cell(s) were offered`
                + `${p.cost.push !== undefined ? `; the block owes ${p.cost.push} push(es)` : ''}`
            : `${p.instance} at site (${p.site.x},${p.site.y}) ${p.site.w}x${p.site.h}; `
                + `block (${p.block.x},${p.block.y}) -> button (${p.button.x},${p.button.y}) `
                + `[group A=${p.groups.A}]; guard door (${p.door.x},${p.door.y}) `
                + `[tag ${p.tags.lockA}]; FLAG buttonroom (${p.flagCell.x},${p.flagCell.y}) `
                + `[group B=${p.groups.B}, tag ${p.tags.flag}]; its LOCK on the main-path cut `
                + `(${p.flagLockCell.x},${p.flagLockCell.y}) [tag ${p.tags.lockB}]; tunnel `
                + `${p.tunnel} cell(s); the carve had written ${p.carveOverwrote} of its `
                + 'cells differently');
        say(`element: ${head} — `
            + (p
                ? shape()
                : `⛔ REFUSED: ${out.model.elements.refused?.reason} — `
                    + `${out.model.elements.refused?.detail}`));
        if (p) {
            const c = e.certification;
            say(`         ⛔⛔ CERTIFIED: ${e.certified} — ${c.verdict}`
                + `${c.gap ? ` (${c.gap})` : ''}`);
            if (c.reasonText) say(`         the solve's own words: ${c.reasonText}`);
            say(`         ⛓ ${LIFTED_CLAIM_TEXT[p.element] ?? 'THE LIFTED CLAIM'}: `
                + `${c.heldAtDoor === null ? 'the route never crossed it' : c.heldAtDoor}`);
            if (!e.certified) {
                say('         ⇒ the level below was generated WITHOUT the gadget (the draws '
                    + 'were spent either way). ⛔ Nothing solved around it.');
            }
        }
    }
    /**
     * ⛓ SLICE 5: A CONSTRUCTION MAY HAVE NO LADDER AT ALL (`--count=0
     * --directed=…` places onto the bare skeleton), and then there is no
     * summary to print. ⛔ It says so BY NAME rather than printing an empty
     * section: "no ladder" and "a ladder that kept nothing" are different
     * facts, and the directive table below is where this run's content is.
     */
    if (!s) {
        say('ladder: NONE — obstacleTarget=0, so nothing was drawn. This level is the '
            + 'SKELETON plus its directives (below).');
    } else {
    say(`start:  (${s.startCell.tx},${s.startCell.ty})   goal: ${s.goalClass} at cell `
        + `(${s.goalCell.tx},${s.goalCell.ty}) = OEL (${s.goalOel.x},${s.goalOel.y})`);
    say(`items:  ${JSON.stringify(s.items)}   pins: [${s.pins.join(', ')}]`);
    say(`palette: ${PALETTE.name}`
        + (PALETTE.roster ? '' : ' (the WHOLE roster — no restriction)'));
    say(`bounds: obstacleTarget=${bounds.obstacleTarget} triesPerStep=${bounds.triesPerStep} `
        + `saturationK=${bounds.saturationK} `
        + `anchorTriesPerCandidate=${bounds.anchorTriesPerCandidate}`);
    say(`budget: maxTicksPerTarget=${s.budget.maxTicksPerTarget} `
        + '(⛓ TICKS, not milliseconds — the budget is a property of the candidate, so '
        + 'this run reproduces on a loaded box)');
    say('');
    say(`stop:   ${s.stop}${s.stop === STOP.SATURATED
        ? ` — ${bounds.saturationK} consecutive steps kept nothing` : ''}`);
    say(`kept:   ${s.keptCount} obstacle(s) over ${s.attempts} attempt(s); `
        + `solve ${s.skeletonTicks} ticks (skeleton) -> ${s.finalTicks} ticks (final)`);
    say(`draws:  ${s.drawsSpent}, rng state ${s.rngState}`);
    say('');
    say('## per family');
    for (const [family, c] of Object.entries(s.byFamily)) {
        say(`  ${family.padEnd(12)} kept ${c.kept}  reverted ${c.reverted}  `
            + `illegal ${c.illegal}  no-anchor ${c.noAnchor}`);
    }
    say('');
    say('## the generation trace');
    for (const r of out.trace) {
        // ⛓ THE INSTANCE LABEL, not the roster key (GENERATE-mode UI slice 2)
        // — `wall-segment(ori=v,len=4)` and `wall-segment(ori=h,len=2)` are two
        // different obstacles, and a trace that called both `wall-segment`
        // would print a key where a reader needs a geometry.
        say(`  step ${String(r.step).padStart(2)}.${r.try} `
            + `${String(r.instance ?? r.template ?? '(skeleton)').padEnd(30)} `
            + `${r.at ? `@(${r.at.tx},${r.at.ty})`.padEnd(9) : ''.padEnd(9)} `
            + `${r.outcome.padEnd(18)} ${r.verdict ?? '-'}`
            + `${r.ticks !== null ? ` ${r.ticks} ticks` : ''}`);
        if (r.outcome !== ATTEMPT.KEPT) {
            say(`      classified by: ${r.classifiedBy}`);
            if (r.reasonText) say(`      reason: ${r.reasonText}`);
        }
    }
    say('');
    say(`certification: ${JSON.stringify(s.finalCertification)}`);
    }
    /**
     * ⛓⛓ THE DIRECTIVES, EACH WITH **WHICH KIND OF KEEP IT WAS** — ⚖ the
     * user's ruling: the readout says whether the walk DISCHARGED the
     * template's own verb or settled for a solve, and a template with no verb
     * to discharge says THAT rather than reporting a shortfall that could not
     * exist.
     */
    if (payload.directives.length) {
        say('');
        say('## the directives, in order');
        for (const [i, d] of payload.directives.entries()) {
            say(`  d${i + 1} ${d.instance.padEnd(30)} `
                + `${d.at ? `@(${d.at.tx},${d.at.ty})`.padEnd(9) : ''.padEnd(9)} `
                + `${d.outcome.padEnd(18)} ${describeKeptKind(d)}`);
            /**
             * ⛓ SLICE 6: an EXPLICIT anchor is not a search, and the report
             * says which it was — `at` alone cannot distinguish *the search
             * found this cell* from *somebody named it*. ⛔ And it does NOT say
             * "walked 1 of 1 LEGAL anchor(s)" about a clicked cell: the cell
             * may be exactly the one the model refused.
             */
            say(d.anchor
                ? `      the EXPLICIT anchor (${d.anchor.tx},${d.anchor.ty}) — a CLICK, not a `
                    + `search: ONE named cell, adjudicated by the model before any solve `
                    + `(bound ${d.bound}, policy ${d.keepPolicy})`
                : `      walked ${d.anchorsWalked} of ${d.anchorsOffered} legal anchor(s), `
                    + `bound ${d.bound}, policy ${d.keepPolicy}`);
        }
        say('');
    }
    say(`level sha: ${sha(out.record)}   trace sha: ${sha(out.trace)}`);
    say('');
    // ⛔ THE BIOME'S OWN exclusions, not the pre-sword list under another
    // name — the two biomes exclude different families for different measured
    // reasons, and printing one under the other's heading would be a report
    // that agrees with itself by construction.
    const excluded = BIOMES[BIOME].excluded ?? [];
    say(`## excluded from this palette (${excluded.length}), each with its measurement`);
    for (const x of excluded) {
        say(`  ${x.name.padEnd(22)} ${x.cause}`);
    }
}

if (has('out') || arg('out', '') !== '') {
    const path = arg('out', '');
    if (path.includes('fixtures/')) {
        note('generate-seedling-level: REFUSED to write under `fixtures/` — committed '
            + 'fixtures are byte-identical artifacts of recorded runs and no tool in this '
            + 'arc writes them (standing law).');
        process.exit(2);
    }
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
    note(`[stderr] wrote ${path}`);
}

/**
 * ⛓ SLICE 5: THE CEILING IS THE LADDER'S **PLUS** ONE PER DIRECTIVE, and it is
 * summed from the two cost models rather than re-derived — `costModel` prices
 * the loop and `directedCost` prices one directed attempt, and a third
 * arithmetic here would be a third answer to "what did this cost".
 *
 * ⚠ `obstacleTarget: 0` is a real construction (a directive on the bare
 * skeleton) and the LOOP refuses that bound by name, so the ladder term is
 * simply absent — it is not "zero cost measured", it is no ladder.
 */
const ceilingMs = (bounds.obstacleTarget > 0 ? costModel(bounds, 139).worstCaseTotalMs : 0)
    + (DIRECTED ?? []).reduce((n, d) => n + directedCost(d.bound, 139).worstCaseTotalMs, 0);
note(`[timing, stderr only] ${elapsedMs} ms for ${out.trace.length} solve(s); `
    + `cost model said <= ${ceilingMs} ms`);

/**
 * ⛓⛓ PROCGEN ELEMENTS arc 3, slice 4b — **A REFUSED GRAPH IS A REFUSED RUN,
 * AND IT SAYS SO IN THE EXIT CODE** (6, the maze CLI's own, and for its
 * reason). The payload and the LEVEL are still printed, because the evidence
 * for the refusal is in them and arc 1's rule is that a refused graph still
 * ships its carved level; what the exit code carries is that the run did not
 * produce what was asked for. ⛔ Distinct from 3 (an abort inside the
 * generator) and 4 (a two-process drift): those are defects, this is the honest
 * answer to a room that cannot host the graph.
 *
 * ⚠ AN UNCERTIFIED GRAPH IS THE SAME ANSWER. `ran: true, certified: false` is a
 * level the solver could not walk, and it ships without the graph — so a caller
 * that reads only the exit code is told the same thing either way.
 */
/**
 * ⛓⛓ PROCGEN ELEMENTS arc 3, slice 4d — **A DIRECTIVE THAT WAS NOT MET IS A
 * REFUSED RUN**, exit 6 (the maze CLI's own code for exactly this, and the one
 * the area graph took one slice earlier). The payload and the LEVEL are still
 * printed: arc 1's rule is that a refused directive shows what the run
 * produced, LABELLED, and the evidence for the refusal is in it.
 *
 * ⛔ THE CHECK RUNS BEFORE THE AREA GRAPH'S so a run that asked for both and
 * failed the DIRECTIVE says so — the two exit with the same code and the
 * stderr line is what distinguishes them.
 */
const REQ = out.summary?.require ?? null;
if (REQ && !REQ.met) {
    note(`generate-seedling-level: ⛔ REQUIRE REFUSED — ${REQ.refused.reason}: `
        + `${REQ.refused.detail}`);
    process.exit(6);
}
if (AREAS.keys > 0 && !(out.summary?.areas?.ran && out.summary.areas.certified)) {
    const a = out.summary?.areas;
    note(`generate-seedling-level: ⛔ AREAS REFUSED — ${a?.refused
        ? `${a.refused.reason}: ${a.refused.detail}`
        : `the-area-graph-does-not-certify: ${a?.certification?.reasonText
            ?? a?.certification?.classifiedBy ?? 'the solve did not reach the goal'}`}`);
    process.exit(6);
}
