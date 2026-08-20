#!/usr/bin/env node
/**
 * sweep-yield-table — **THE YIELD TABLE**: what pass 2 actually yields over a
 * carved room, per skeleton kind, per room size, per seed, on BOTH substrates.
 *
 * CONSTRUCTIVE-MODE arc, slice 6 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.6 item 1). It is Probe 2 (§2.4) formalized and widened: the
 * probe measured ONE substrate, ONE kind, EIGHT seeds and reported *"6 of 8
 * saturate with zero kept, and seed 5's saturated run took 106 s"*. This asks
 * the same question of every kind each binding offers, and — ⛓ §9.6's
 * requirement — of every ROOM SIZE, because the maze's 11x11 default run
 * reverts NOTHING and a table on the default room alone would call the palette
 * fine about a room too big to test it.
 *
 * ── ⛔ IT IS A MEASUREMENT, NOT A GATE (the house sweep law) ───────────
 *
 * ⚖ `sweep-seedling-wave1-domains.mjs` established the shape this file
 * inherits, and the three clauses are the whole law:
 *
 *  1. **A TABLE WITH ITS COMMAND LINE RECORDED.** Every number a run was
 *     bounded by is printed in the header, above the table, so a reader who
 *     finds the table in an as-built can re-run exactly it. A table whose
 *     bounds live only in somebody's shell history is a table nobody can
 *     reproduce.
 *  2. **A LOW-YIELD CELL IS A FINDING, NOT A DEFECT.** Nothing here decides
 *     anything: the oracle still certifies every level it produces, and a kind
 *     that yields nothing is recorded beside its kind rather than pruned.
 *  3. **IT NAMES WHAT IT BOUNDED** (`feedback_bounded_sweep_must_name_what_it_
 *     bounded`). The seeds, the bounds, the kinds, the sizes, AND the per-cell
 *     wall budget are all in the header and in the denominator line.
 *
 * ── ⛓⛓⛓ THE WALL-CLOCK COLUMNS ARE **EVIDENCE**, AND THEY DECIDE NOTHING
 *
 * ⛔ `feedback_wallclock_budget_breaks_determinism`, obeyed to the letter:
 * nothing denominated in time may DECIDE anything about a level. `wallMs` and
 * `maxSolveMs` are printed because the arc's whole finding about corridors is a
 * COST finding (a sealing candidate runs the Seedling planner to its dash cap
 * before refusing), and a cost finding needs a cost number. They are read AFTER
 * the run, they never reclassify a verdict, and no generator input is derived
 * from them.
 *
 * ⚠ THE ONE PLACE A CLOCK ACTS IS THE HARNESS'S OWN PER-CELL BUDGET, and it is
 * a HARNESS bound rather than a generator bound: a cell that outruns it is
 * KILLED and recorded as `TIMEOUT-ABORTED (bound: N s)` in the denominator, and
 * the level it was building never existed. ⛔ Nothing in `levelGenerator.js`,
 * in either binding or in either oracle changes because this file exists.
 *
 * ── ⛔ ONE CELL, ONE CHILD PROCESS — and that is what makes the bound real
 *
 * A Seedling solve is SYNCHRONOUS AND UNINTERRUPTIBLE (`procgenOracle`'s
 * residue): once the loop is inside one, no in-process timer can stop it, so an
 * in-process "budget" would be a number that reports a cell's cost after paying
 * it in full. Each cell therefore runs in a fresh `node` — this same file, in
 * `--cell=` worker mode — under `execFileSync`'s `timeout`. Three things follow
 * and all three are wanted:
 *
 *   · the per-cell wall budget is ENFORCED rather than observed;
 *   · a cell that THROWS is recorded with its error's NAME rather than
 *     vanishing — ⛔ caught HERE, at the harness level, and never by widening
 *     the oracle's own catch (traps 171/173);
 *   · no cell can contaminate another (module state, registry order, warm JIT).
 *
 * ⚠ The child pays ~0.2-0.5 s of module-import startup, which is in `wallMs`
 * for the CELL but not in the reported `genMs`. The tables print `genMs` — the
 * generator's own elapsed — and the denominator prints the harness total.
 *
 * ── THE AXES ──────────────────────────────────────────────────────────
 *
 *   `--kinds=`  default: every kind the binding OFFERS (`MAZE_SKELETON_KINDS` /
 *               `SEEDLING_SKELETON_KINDS` — derived, never a second list).
 *   `--sizes=`  maze: `11x11,7x7,5x5,4x4` by default (§9.6's ladder).
 *               ⛓ SEEDLING TOO SINCE PROCGEN ELEMENTS arc 5, slice 1 (⚖ ruling
 *               1): default `10x10` — the room every committed Seedling number
 *               was measured in — and any pair in [3..60], the VANILLA
 *               maximum. The kind's FLOOR FRACTION stays a column beside it.
 *   `--seeds=`  default `1-8`.
 *
 * Run:
 *   node scripts/procgen/sweep-yield-table.mjs --substrate=maze
 *   node scripts/procgen/sweep-yield-table.mjs --substrate=seedling --seeds=1-8 \
 *       --cellbudget=120 --json=NewDocs/plans/seedling-constructive-yield/seedling-before.json
 *   node scripts/procgen/sweep-yield-table.mjs --substrate=maze --estimate-only
 */

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules', p));
/** ⛓ SLICE 7 — the ONE skeleton-spec parser, shared with the URL and both CLIs. */
const { parseSkeleton } = await M('procgenCore/skeletonKinds.js');
/**
 * ⛓⛓ PROCGEN ELEMENTS arc 1 slice 2 — the ONE area-spec codec, shared with the
 * maze CLI (and, from slice 3, the lab page's `?areas=`). ⛔ ONE `--areas=` for
 * the WHOLE sweep rather than a per-`--kinds=` clause: the area spec is not a
 * property of the skeleton kind, and folding it into the kind string would have
 * made `rooms;keys=1` look like a skeleton parameter the kind does not declare.
 */
const { formatAreaSpec, formatRequireList, parseAreaSpec, parseRequireList } =
    await M('procgenCore/areaSpec.js');
/** ⛓ arc 2 slice 3 — and the same argument: ONE `--elements=` for the whole
 *  sweep, because an element is not a property of the skeleton kind. */
const {
    NONE: ELEMENTS_NONE, formatElementSpec, isElementList, parseElementSpec,
    parseItemRequireList,
} = await M('procgenCore/elementSpec.js');
/** ⛓ arc 3, slice 4d — the budget the Seedling directive's WITHOUT arm runs
 *  under when a cell's oracle does not carry one. */
const { DEFAULT_BUDGET } = await M('seedlingDemo/procgenOracle.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const has = (name) => process.argv.includes(`--${name}`);
const num = (name, fallback) => Number(arg(name, fallback));

const say = (line = '') => process.stdout.write(`${line}\n`);
const note = (line) => process.stderr.write(`${line}\n`);

const SUBSTRATE = arg('substrate', '');
if (SUBSTRATE !== 'maze' && SUBSTRATE !== 'seedling') {
    note('sweep-yield-table: --substrate= must be `maze` or `seedling`. Both bindings are '
        + 'swept by ONE script (⚖ kickoff §5: one of everything) and neither is the default, '
        + 'because a table that did not say which substrate it measured would be unreadable '
        + 'in an as-built.');
    process.exit(2);
}

const BOUNDS = Object.freeze({
    obstacleTarget: num('count', 3),
    triesPerStep: num('tries', 4),
    saturationK: num('k', 3),
    anchorTriesPerCandidate: num('anchortries', 1),
});

/** `1-8` or `1,3,5` — both spellings, because a table's seed list is typed by hand. */
const parseSeeds = (spec) => {
    const out = [];
    for (const part of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
        const m = /^(\d+)-(\d+)$/.exec(part);
        if (m) {
            for (let i = Number(m[1]); i <= Number(m[2]); i += 1) out.push(i);
        } else if (/^\d+$/.test(part)) out.push(Number(part));
        else {
            note(`sweep-yield-table: "${part}" is not a seed or a seed range (\`1-8\`).`);
            process.exit(2);
        }
    }
    return out;
};

/** `11x11` → `{width, height}`; anything else refuses BY NAME. */
const parseSize = (spec) => {
    const m = /^(\d+)x(\d+)$/.exec(spec.trim());
    if (!m) {
        note(`sweep-yield-table: "${spec}" is not a room size (\`11x11\`).`);
        process.exit(2);
    }
    return { width: Number(m[1]), height: Number(m[2]), label: `${m[1]}x${m[2]}` };
};

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ WORKER MODE — ONE CELL, IN PROCESS, OVER THE BINDINGS
 *
 * ⛔ It calls `generateLevel` with the binding's own model / oracle / palette
 * rather than `generateSeedlingLevel` / `generateMazeLevel`, for ONE reason:
 * the per-solve timing has to wrap the oracle, and the wrappers build theirs
 * internally. Everything else — the model, the palette, the bounds, the loop —
 * is the binding's, unaltered. ⚠ The wrapper is a TIMER and nothing else: it
 * forwards to `oracle.solve` as a method call, so the oracle's own `this` (and
 * therefore `pinsFor`) is untouched.
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ THE AREA SPEC FOR EVERY CELL OF THIS SWEEP. ⛔ Seedling REFUSES it by name:
 * the area binding is the MAZE's in this arc (§3.2), and a flag that silently
 * did nothing on one substrate would be a column that means two things.
 */
const AREAS = parseAreaSpec(arg('areas', '0'));
/**
 * ⛓⛓ SLICE 3 — THE RULE-DIRECTED DIRECTIVE FOR EVERY CELL, in the same one
 * codec (`--require=K0,K1`). ⛔ It costs NOTHING extra: its proof is the
 * ablation arm of the cost record the area binding already computes, so the
 * column below is a REPORT of a differential rather than a second measurement.
 */
/**
 * ⛓⛓⛓ **TWO VOCABULARIES, ONE FLAG** (arc 3, slice 4d). The MAZE requires
 * AREA-GRAPH SYMBOLS (`K0`); SEEDLING requires BOOT ITEM FLAGS (`hasSword`) and
 * DERIVES the element head from the catalogue's `needs`. The grammar is one
 * (`areaSpec.parseRequireList`); the vocabulary is the substrate's, so the
 * parse is too — a `--require=hasSword` handed to the maze's parser would be
 * refused as *"not an area-graph symbol"*, which is true and is the wrong
 * sentence.
 */
const REQUIRE = process.argv.some((a) => a.startsWith('--require='))
    ? (SUBSTRATE === 'seedling'
        ? parseItemRequireList(arg('require', '')) : parseRequireList(arg('require', '')))
    : null;
/**
 * ⛓⛓⛓ PROCGEN ELEMENTS arc 2 slice 3 — THE ELEMENT FOR EVERY CELL, through the
 * ONE codec (`procgenCore/elementSpec.js`): `--elements='guard;len=3;turns=1'`.
 * ⛓⛓⛓ **ABSENT IS NOT `none` ON THE SEEDLING ARM SINCE ARC-3 SLICE 4c.** The
 * flag is read as *"was it typed"*: absent passes `undefined`, and each
 * substrate's own binding then says what that means. The MAZE's says `none`
 * (`mazeModel`'s destructuring default — untouched by 4c, ⛔ its own arc);
 * SEEDLING's says `defaultElementsFor(palette.items)` — the biome-dependent
 * default that replaced the three retired door TEMPLATES. ⇒ a bare
 * `--substrate=seedling` sweep now measures the DEFAULT generator, which is the
 * arm a reader of this table actually wants, and `--elements=none` is how the
 * pre-4c element-free arm is asked for by name.
 *
 * ⛓⛓ **BOTH SUBSTRATES TAKE IT SINCE ARC 3 SLICE 3.** Seedling used to refuse it
 * by name ("the element binding is the MAZE's in this arc"); its own binding is
 * `seedlingDemo/procgenSeedlingElements.js`, and the columns below say what the
 * two arms measure.
 *
 * ⛓⛓⛓ **THE SEEDLING ARM'S `guarded` COLUMN WAS `0` BY CONSTRUCTION UNTIL SLICE
 * S1, AND IT IS NOT ANY MORE.** Slice 3 shipped the binding UNCERTIFIED because
 * the solver could not drive ⚖ ruling 22's opener chain, and published that zero
 * as the measurement of the arc's dependency. S1 ("nested openers") built the
 * capability, and the same command now reports 16 of 18 placements certified at
 * `len=2` and 16 of 16 at `len=3`, every one of them with `heldAtDoor: true`.
 * ⛔ The cells that still refuse still print `certified: false` with the solve's
 * own words and a `gap` classified from its structured fields — see
 * `procgenSeedling.certificationGap`, which replaced the constant slice 3 could
 * honestly write when every refusal had one cause.
 */
const ELEMENTS = process.argv.some((a) => a.startsWith('--elements='))
    ? parseElementSpec(arg('elements', ELEMENTS_NONE)) : undefined;
/**
 * ⛔ THE MAZE'S DIRECTIVE IS A PROPERTY OF THE AREA GRAPH and needs one.
 * SEEDLING's is a property of the ELEMENT, so it does not — which is the whole
 * difference between requiring a KEY and requiring an ITEM.
 */
if (REQUIRE && SUBSTRATE !== 'seedling' && AREAS.keys === 0) {
    note('sweep-yield-table: --require= without --areas= — every cell would refuse with '
        + '`the-directive-needs-the-area-graph`, which is a column that means one thing at '
        + 'every row. Say --areas=<n> too.');
    process.exit(2);
}
/**
 * ⛓ PROCGEN ELEMENTS arc 3, slice 4b — **THE SEEDLING ARM HONOURS `--areas=`
 * NOW.** It used to refuse it by name ("Seedling gets the area graph in arc 3;
 * running it here would print an area column that is zero for a reason nobody
 * stated"), and that sentence's condition is met: `seedlingSeam` takes an
 * `areas` spec and reports on `summary.areas`.
 *
 * ⛔ `--require=` IS STILL THE MAZE'S ALONE — the directive is slice 4d's, and
 * a flag accepted here and ignored would print a column with nothing behind it.
 */
/**
 * ⛓⛓ **THE SEEDLING ARM HONOURS `--require=` NOW** (arc 3, slice 4d). It used to
 * refuse it by name (*"the Seedling directive is arc 3 slice 4d; running it here
 * would print a column that is empty at every row"*), and that sentence's
 * condition is met: `seedlingSeam` takes a `require` list and
 * `procgenSeedling.requireVerdict` grades it on the FINAL level.
 *
 * ⚠ AND IT COSTS ONE EXTRA SOLVE PER CELL, unlike the maze's — which is free
 * because its proof is an ablation the area binding already computes. Seedling's
 * WITHOUT arm is a real solve of the real level with `hasSword:false`. Said
 * here because the timing columns of a `--require=` sweep are not comparable to
 * those of one without it.
 */

/**
 * ⛓⛓ PROCGEN ELEMENTS arc 3, slice 2 — **THE BIOME IS AN AXIS NOW**, and it had
 * to become one for an honest door table.
 *
 * The Seedling arm hard-coded `PRE_SWORD_PALETTE`, which was the right default
 * while every door family lived in both biomes. `wall-gap-spinner-killlock` does
 * not: it is POST-SWORD ONLY, so *"the door families on carved kinds"* was a
 * claim the table could not print about a third of them. ⛔ It is a flag rather
 * than a second axis crossed with the kinds: the two arms are separate runs with
 * separate wall-clock columns, because a mixed table's timings would compare a
 * pre-sword solve against a post-sword one and call the difference a kind.
 */
const PALETTE_NAME = arg('palette', 'pre-sword');
if (SUBSTRATE === 'seedling' && PALETTE_NAME !== 'pre-sword' && PALETTE_NAME !== 'post-sword') {
    note(`sweep-yield-table: --palette=${PALETTE_NAME} is not a Seedling biome. The two are `
        + '`pre-sword` (the default, and this arm\'s original) and `post-sword`.');
    process.exit(2);
}
if (SUBSTRATE === 'maze' && process.argv.some((a) => a.startsWith('--palette='))) {
    note('sweep-yield-table: --palette= is the SEEDLING binding\'s — the maze has one palette.');
    process.exit(2);
}

/**
 * ⛓⛓⛓ **THE SPEC THIS RUN ACTUALLY MEASURES** — arc-3 slice 4c. Every column,
 * header and census below reads THIS and never the raw flag, because absent no
 * longer means `none` on the Seedling arm: it means the biome's default. ⛔ It
 * is DERIVED from `procgenSeedling.defaultElementsFor` and the palette's own
 * `items` rather than re-spelled here — a sweep that typed the default would be
 * a second answer to *"what does the default generator build"*, and the first
 * time the two drifted the table would be reporting the sweep.
 */
const ELEMENTS_EFFECTIVE = await (async () => {
    if (ELEMENTS !== undefined) return ELEMENTS;
    if (SUBSTRATE !== 'seedling') return { name: ELEMENTS_NONE };
    const { defaultElementsFor } = await M('seedlingDemo/procgenSeedling.js');
    const { resolveRequireDirective } = await M('procgenCore/elementSpec.js');
    const { POST_SWORD_PALETTE, PRE_SWORD_PALETTE } = await M('seedlingDemo/procgenPalette.js');
    const items = (PALETTE_NAME === 'post-sword' ? POST_SWORD_PALETTE : PRE_SWORD_PALETTE).items;
    /**
     * ⛓⛓⛓ **A DIRECTIVE REPLACES THE BIOME DEFAULT** (arc 3, slice 4d), and
     * this readout has to say so or it would label a `--require=hasSword` sweep
     * with the head the default WOULD have drawn. ⛔ Through the SAME
     * `resolveRequireDirective` the seam calls — this is a label, not a second
     * decision, and a refused directive falls through to the default because
     * that is the run it will actually make.
     */
    if (REQUIRE) {
        const dir = resolveRequireDirective({ require: REQUIRE, elements: undefined, items });
        if (!dir.refused) return dir.elements;
    }
    return defaultElementsFor(items);
})();

const CELL = arg('cell', '');
if (CELL !== '') {
    const [kind, sizeSpec, seedSpec] = CELL.split('|');
    const size = parseSize(sizeSpec);
    const seed = Number(seedSpec);
    const { ATTEMPT, generateLevel } = await M('procgenCore/levelGenerator.js');

    const timed = { solves: 0, maxSolveMs: 0 };
    const wrap = (oracle) => ({
        budget: oracle.budget,
        solve: (...a) => {
            const t = process.hrtime.bigint();
            const r = oracle.solve(...a);
            const ms = Number(process.hrtime.bigint() - t) / 1e6;
            timed.solves += 1;
            if (ms > timed.maxSolveMs) timed.maxSolveMs = ms;
            return r;
        },
    });

    let model;
    let oracle;
    let palette;
    let floorPct;
    /** ⛓ arc 3 slice 1 — Seedling only; the maze binds sites in a later slice. */
    let siteCensus = null;
    /** ⛓ arc 5 slice 1 — Seedling only; the maze's grid has no sparse form. */
    let shellCensus = null;
    /** ⛓ arc 3 slice 3 — the element's certification, from the shared seam. */
    let seedlingCertification = null;
    let seedlingAreaCertification = null;
    /** ⛓ arc 3, slice 4d — the DIRECTIVE's resolution and the ONE function that
     *  grades it, both taken from the seam rather than re-derived here. */
    let seedlingRequireDir = null;
    let seedlingRequireVerdict = null;
    let seedlingPalette = null;
    if (SUBSTRATE === 'maze') {
        const {
            MAZE_PALETTE, mazeModel, mazeOracle,
        } = await M('mazeRoom/procgenMaze.js');
        const { TILE_FLOOR } = await M('mazeRoom/mazeRoomEngine.js');
        model = mazeModel({
            seed, width: size.width, height: size.height, skeleton: parseSkeleton(kind,
                { simulator: true, substrate: 'the maze binding' }),
            areas: AREAS,
            elements: ELEMENTS_EFFECTIVE,
        });
        palette = MAZE_PALETTE;
        /** ⛓ WRAPPED HERE, ONCE. The Seedling arm's `seedlingSeam` wraps its
         *  own (it makes two oracles when the element's certification refuses),
         *  so the shared call below must NOT wrap again — a double wrap would
         *  count every solve twice and double the `maxSolveMs` column's subject. */
        oracle = wrap(mazeOracle({ model, items: palette.items ?? null }));
        const sk = model.skeleton();
        floorPct = Math.round((100 * [...sk.tiles].filter((t) => t === TILE_FLOOR).length)
            / sk.tiles.length);
    } else {
        const {
            interiorCells, seedlingSeam, seedlingSkeletonSpec,
        } = await M('seedlingDemo/procgenSeedling.js');
        const {
            POST_SWORD_PALETTE, PRE_SWORD_PALETTE,
        } = await M('seedlingDemo/procgenPalette.js');
        const { terrainAt } = await M('seedlingDemo/procgenLevel.js');
        palette = PALETTE_NAME === 'post-sword' ? POST_SWORD_PALETTE : PRE_SWORD_PALETTE;
        /**
         * ⛓⛓ ONE SEAM, TWO CALLERS (arc 3 slice 3). `seedlingSeam` is what
         * `generateSeedlingLevel` uses: it builds the model, runs the element's
         * CERTIFICATION solve and — when that refuses, which is every placed
         * gadget today — regenerates with the element DROPPED, its draws still
         * spent. ⛔ A private copy of that dance here would be a second answer to
         * *"is this gadget certified"*. The timing wrapper goes in through
         * `wrapOracle`, so the certification solve is COUNTED like any other.
         */
        const seam = seedlingSeam({
            seed,
            /**
             * ⛓⛓⛓ PROCGEN ELEMENTS arc 5, slice 1 — **THE SIZE IS AN AXIS
             * NOW** (⚖ ruling 1), and it reaches the seam through the
             * `defaults` argument `seedlingModel` has always taken. ⛔ At
             * `10x10` this passes exactly what `SEEDLING_DEFAULTS` says, so
             * every cell this sweep ever ran is unmoved.
             */
            defaults: { width: size.width, height: size.height },
            /** ⛓ arc 3 slice 4b — the SEEDLING resolver, so the five carved tree
             *  kinds get their `chambers` default and a typed 0 survives. */
            skeleton: seedlingSkeletonSpec(kind),
            /**
             * ⛔ WHEN A DIRECTIVE IS TYPED AND `--elements=` IS NOT, THE SEAM
             * GETS `undefined` — *nobody said* — so the directive FORCES the
             * head and spends NO draw. Handing it `ELEMENTS_EFFECTIVE` (which
             * already resolved to that head) would make the seam read an
             * EXPLICIT spec, which is a different fact: `forced` would report
             * false and a reader would be told the caller chose it.
             */
            elements: (REQUIRE && ELEMENTS === undefined) ? undefined : ELEMENTS_EFFECTIVE,
            areas: AREAS,
            items: palette.items ?? null,
            require: REQUIRE ?? undefined,
            wrapOracle: wrap,
        });
        model = seam.model;
        oracle = seam.oracle;
        seedlingCertification = seam.certification;
        seedlingAreaCertification = seam.areaCertification;
        seedlingRequireDir = seam.require;
        seedlingPalette = palette;
        seedlingRequireVerdict = (await M('seedlingDemo/procgenSeedling.js')).requireVerdict;
        const sk = model.skeleton();
        const cells = interiorCells(sk);
        floorPct = Math.round((100 * cells.filter((c) => terrainAt(sk, c.tx, c.ty) === 'ground')
            .length) / cells.length);
        /**
         * ⛓ PROCGEN ELEMENTS arc 3, slice 1 — THE SITE CENSUS, BESIDE THE
         * YIELD. A row that declares `site: 'chamber'` is NO_ANCHOR wherever
         * the skeleton has no chamber, and a NO_ANCHOR column with no site
         * column beside it reads as a template that does not work rather than
         * as a room that has nowhere to put it. ⛔ COUNTS only — the cell lists
         * are re-derivable from the level (`siteSummaryOf`'s own rule).
         */
        siteCensus = model.siteSummary;
        /**
         * ⛓⛓⛓ **THE SHELL'S CLAIMED WIN, MEASURED PER CELL** (arc 5, slice 1,
         * ⚖ ruling 2 — the §6 Q1 evidence). ⛔ Measured on the SKELETON, which
         * is the room the strip has anything to say about: pass 2 only ever
         * paints INSIDE the play area, so the wall a strip drops is the CARVE's
         * and not the ladder's. ⚠ `bytes` is `JSON.stringify` length — the
         * record as it ships — and not a file on disk, so it is comparable
         * across cells and is not a claim about any particular writer.
         */
        const { shellLevel } = await M('seedlingDemo/procgenSeedling.js');
        const shelled = shellLevel(sk, model, 'shell');
        shellCensus = {
            cells: sk.width * sk.height,
            denseTiles: sk.layers[0].tiles.length,
            shellTiles: shelled.layers[0].tiles.length,
            denseBytes: JSON.stringify(sk).length,
            shellBytes: JSON.stringify(shelled).length,
        };
        shellCensus.savedPct = Math.round(
            (100 * (shellCensus.denseBytes - shellCensus.shellBytes)) / shellCensus.denseBytes,
        );
    }

    const t0 = process.hrtime.bigint();
    let out = null;
    let error = null;
    try {
        out = generateLevel({
            rng: (await M(`${SUBSTRATE === 'maze' ? 'mazeRoom' : 'seedlingDemo'}/procgenRng.js`))
                .rngFor(seed),
            model,
            oracle,
            palette,
            bounds: BOUNDS,
        });
    } catch (e) {
        /**
         * ⛔ CAUGHT AT THE HARNESS LEVEL AND CLASSIFIED BY NAME — traps
         * 171/173. A run that throws is RECORDED, not hidden, and it is
         * recorded as an ABORT of the CELL rather than as a rejected candidate:
         * the sweep does not get to decide that an engine error was "that kind
         * didn't work out". The oracle's own catch is not widened by one class.
         */
        error = { name: e.name, message: e.message.slice(0, 400) };
    }
    const genMs = Number(process.hrtime.bigint() - t0) / 1e6;

    const byTemplate = {};
    const revertReasons = {};
    if (out) {
        for (const r of out.trace) {
            if (r.family === 'skeleton') continue;
            const t = (byTemplate[r.template] ??= {
                KEPT: 0, REVERTED: 0, NO_ANCHOR: 0, ILLEGAL_PLACEMENT: 0, ABORTED: 0,
            });
            t[r.outcome] = (t[r.outcome] ?? 0) + 1;
            if (r.outcome === ATTEMPT.REVERTED) {
                // ⛔ VERBATIM, truncated at 60 — the refusal's own words are the
                // evidence channel and this file may group them, never rewrite
                // them.
                const key = `${r.template} :: ${(r.reasonText ?? '(no reasonText)').slice(0, 60)}`;
                revertReasons[key] = (revertReasons[key] ?? 0) + 1;
            }
        }
    }
    /**
     * ⛓ THE AREA CENSUS COLUMNS — measured on THIS cell's own skeleton, so the
     * census and the yield are the same room. ⛔ They are reported even at
     * `--areas=0`, because the census is a fact about the CARVE and the whole
     * point of measuring it was to know what the partition admits BEFORE a lock
     * exists.
     */
    let areaCensus = null;
    if (SUBSTRATE === 'maze') {
        const { partitionMazeAreas } = await M('mazeRoom/procgenMaze.js');
        const sk = model.skeleton();
        const part = partitionMazeAreas(sk, {
            entrance: { x: sk.entrance.x, y: sk.entrance.y },
            goal: { x: model.goalCell.tx, y: model.goalCell.ty },
            declared: model.elements.ran
                ? model.elements.placed.map((p) => ({ id: `E${p.index}`, cells: p.areaCells }))
                : [],
        });
        const deg = new Map(part.areas.map((a) => [a.id, 0]));
        for (const e of part.adjacency) {
            deg.set(e.a, deg.get(e.a) + 1);
            deg.set(e.b, deg.get(e.b) + 1);
        }
        areaCensus = {
            areas: part.areas.length,
            real: part.areas.filter((a) => !a.synthetic).length,
            adjacency: part.adjacency.length,
            maxDegree: Math.max(0, ...deg.values()),
            junctions3: part.corridorComponents.filter((c) => c.touches.length >= 3).length,
            deadFloor: part.deadFloorCells,
            entranceInArea: part.areas.some((a) => a.id === part.entranceArea && !a.synthetic),
            goalInArea: part.areas.some((a) => a.id === part.goalArea && !a.synthetic),
            ran: model.areas.ran,
            refused: model.areas.refused?.reason ?? null,
            doors: model.areas.doors.length,
            symbols: model.areas.graph?.symbols.length ?? 0,
            graphifyEdges: model.areas.graph
                ? model.areas.graph.edges.filter((e) => e.kind === 'graphify').length : 0,
        };
    }
    /**
     * ⛓⛓⛓ THE SEEDLING AREA CENSUS COLUMNS (arc 3, slice 4b) — the maze's block
     * one substrate over, and it reads `model.areaPartition()` rather than
     * building its own (the ONE derivation). ⛔ The graph's own answer is taken
     * from the CERTIFICATION when there is one, because a refused certification
     * REBUILDS the model without the graph and `model.areas` on the rebuild is
     * an absence rather than a report.
     */
    if (SUBSTRATE === 'seedling' && AREAS.keys > 0) {
        const part = model.areaPartition();
        const info = seedlingAreaCertification?.areas ?? model.areas;
        const deg = new Map(part.areas.map((a) => [a.id, 0]));
        for (const e of part.adjacency) {
            deg.set(e.a, deg.get(e.a) + 1);
            deg.set(e.b, deg.get(e.b) + 1);
        }
        areaCensus = {
            areas: part.areas.length,
            real: part.areas.filter((a) => a.kind === 'chamber' && !a.synthetic).length,
            vestibule: part.areas.filter((a) => a.kind === 'goal').length,
            element: part.areas.filter((a) => a.kind === 'element').length,
            adjacency: part.adjacency.length,
            maxDegree: Math.max(0, ...deg.values()),
            junctions3: part.corridorComponents.filter((c) => c.touches.length >= 3).length,
            deadFloor: part.deadFloorCells,
            ran: info.ran,
            refused: info.refused?.reason ?? null,
            certified: seedlingAreaCertification?.certified ?? null,
            certSource: seedlingAreaCertification?.source ?? null,
            locks: info.locks?.length ?? 0,
            flags: info.flags?.length ?? 0,
            guardedFlags: (info.flags ?? []).filter((f) => f.guarded).length,
            superseded: info.supersededFlagLock ? 1 : 0,
            symbols: info.graph?.symbols.length ?? 0,
            graphifyEdges: info.graph
                ? info.graph.edges.filter((e) => e.kind === 'graphify').length : 0,
            tagsUsed: Object.values(info.tags ?? {})
                .reduce((n, t) => n + (t.flag !== undefined ? 1 : 0) + 1, 0),
        };
    }
    /**
     * ⛓⛓⛓ SLICE 3 — THE DIRECTIVE, ASKED OF THIS CELL'S FINISHED LEVEL. ⛔ The
     * proof is the SAME ablation `mazeCostRecords` computes for the elements,
     * so the column is a report of the binding's own differential and not a
     * second answer to "is this lock a cut".
     */
    /**
     * ⛓⛓ THE ELEMENTS CENSUS COLUMNS — site FOUND / CONSTRUCTED / carve
     * RESPECTED / GUARDED, and the cost the PLAN spent. ⛔ Reported only when an
     * element was asked for, so a `--elements=none` sweep's rows are unchanged.
     */
    let elementRow = null;
    /**
     * ⛓⛓⛓ THE SEEDLING ELEMENT ROW (arc 3 slice 3) — and the two numbers it
     * keeps APART are the slice's whole finding: **PLACED** is the geometry (the
     * site fitted, the composite held, the guard is a cut, the flag's lock found
     * a main-path cut) and **CERTIFIED** is the solver's answer. Today the first
     * is sometimes true and the second never is, so a single "kept" column would
     * have averaged a fact with its own refutation.
     */
    if (SUBSTRATE === 'seedling'
        && (isElementList(ELEMENTS_EFFECTIVE) || ELEMENTS_EFFECTIVE.name !== ELEMENTS_NONE)) {
        const geometry = seedlingCertification?.geometry ?? model.elements.placed;
        const p = geometry[0] ?? null;
        /**
         * ⛓ TWO PHASES, TWO GEOMETRIES (arc 3, slice 4a). A `pre-carve` gadget
         * has a SITE, a tunnel and two groups; an `on-connector` door has a door
         * cell, a clearer, a grown wall and a carve. ⛔ Written as two shapes
         * rather than one with `undefined`s, for the same reason
         * `elementSummaryOf` is: a column that reads `site: null` on every row
         * of an arm says nothing about the arm and something false about the
         * element.
         */
        const shape = p && p.phase === 'on-connector' ? {
            phase: 'on-connector',
            doorCell: p.doorCell,
            clearer: p.clearer,
            wall: p.wall,
            carved: p.carved,
            candidates: p.cost.candidates,
            push: p.cost.push ?? null,
            tags: p.tags,
        } : {
            phase: 'pre-carve',
            site: p ? `${p.site.w}x${p.site.h}@${p.site.x},${p.site.y}` : null,
            tunnel: p ? p.tunnel.length : null,
            carveOverwrote: p ? p.carveOverwrote : null,
            tags: p ? p.tags : null,
            groups: p ? p.groups : null,
            flagLockCell: p ? p.flagLockCell : null,
        };
        elementRow = {
            /** ⛓ WHICH HEAD THE STREAM DREW — the same as the spec for a bare
             *  head, the drawn member for a `+` list. */
            head: formatElementSpec(model.elementHead),
            element: p ? p.element : null,
            /** the GEOMETRY held (whether or not the level shipped with it) */
            placed: geometry.length,
            /** what the model says about the room that was actually generated */
            ran: model.elements.ran,
            refused: model.elements.refused?.reason ?? null,
            certified: seedlingCertification ? seedlingCertification.certified : null,
            certVerdict: seedlingCertification?.verdict ?? null,
            certReason: (seedlingCertification?.reasonText ?? '').slice(0, 200) || null,
            gap: seedlingCertification?.gap ?? null,
            /** ⛓ NON-ZERO SINCE ARC 3 SLICE S1 — see this file's `--elements=`
             *  docblock for what it read before, and why. */
            guarded: seedlingCertification?.certified ? 1 : 0,
            heldAtDoor: seedlingCertification?.heldAtDoor ?? null,
            params: p ? p.params : null,
            ...shape,
        };
    }
    if (SUBSTRATE === 'maze' && ELEMENTS_EFFECTIVE.name !== ELEMENTS_NONE) {
        const { mazeCostRecords } = await M('mazeRoom/procgenMaze.js');
        const info = model.elements;
        const rows = (out && info.ran)
            ? mazeCostRecords({ model, record: out.record, kept: out.summary.kept }).elements
                .filter((e) => e.element)
            : [];
        elementRow = {
            ran: info.ran,
            refused: info.refused?.reason ?? null,
            guarded: info.placed.filter((p) => p.guards !== null).length,
            params: info.placed.map((p) => p.params),
            tunnel: info.placed.map((p) => p.tunnel.length),
            carveOverwrote: info.placed.map((p) => p.carveOverwrote),
            pushes: rows.map((r) => r.cost.pushes),
            planLength: rows.map((r) => r.cost.planLength),
            nodes: rows.map((r) => r.cost.nodes),
            heldAtDoor: rows.map((r) => r.heldAtDoor),
        };
    }
    let requireRow = null;
    /**
     * ⛓⛓⛓ **THE SEEDLING DIRECTIVE'S COLUMN** (arc 3, slice 4d). ⛔ Graded by
     * `procgenSeedling.requireVerdict`, the SAME function `generateSeedlingLevel`
     * calls — this file composes the seam and the loop by hand so it can time
     * the oracle, and a private copy of the verdict here would be a second
     * answer to *"was the directive met"*.
     *
     * ⚠ AN ABORTED CELL HAS NO LEVEL, so it has no verdict either: the row is
     * `null` and the ABORT column is where that cell is counted. A directive
     * reported as "not met" on a run that never finished would blame the
     * directive for the engine.
     */
    if (REQUIRE && SUBSTRATE === 'seedling' && out && seedlingRequireDir) {
        const v = seedlingRequireVerdict({
            dir: seedlingRequireDir,
            model,
            certification: seedlingCertification,
            out,
            palette: seedlingPalette,
            seed,
            budget: oracle.budget ?? DEFAULT_BUDGET,
        });
        requireRow = {
            asked: v.asked,
            element: v.element,
            forced: v.forced,
            met: v.met,
            grades: [].concat(v.grade ?? []),
            withTicks: v.with?.ticks ?? null,
            without: [].concat(v.without ?? []).map((w) => w?.verdict ?? null),
            refused: v.refused?.reason ?? null,
        };
    }
    if (REQUIRE && SUBSTRATE === 'maze') {
        const { mazeCostRecords, requireOutcome } = await M('mazeRoom/procgenMaze.js');
        const elements = (out && model.areas?.ran)
            ? mazeCostRecords({ model, record: out.record, kept: out.summary.kept }).elements
            : [];
        const r = requireOutcome({ require: REQUIRE, areas: model.areas, elements });
        requireRow = {
            asked: r.asked,
            met: r.met.map((m) => m.symbol),
            grades: r.met.map((m) => m.grade),
            planWith: r.met.map((m) => m.planWith),
            refused: r.refused?.reason ?? null,
        };
    }
    say(JSON.stringify({
        substrate: SUBSTRATE,
        kind,
        size: size.label,
        seed,
        floorPct,
        siteCensus,
        shellCensus,
        areaCensus,
        elements: elementRow,
        require: requireRow,
        error,
        stop: out?.summary.stop ?? null,
        keptCount: out?.summary.keptCount ?? null,
        attempts: out?.summary.attempts ?? null,
        skeletonTicks: out?.summary.skeletonTicks ?? null,
        finalTicks: out?.summary.finalTicks ?? null,
        solves: timed.solves,
        maxSolveMs: Math.round(timed.maxSolveMs),
        genMs: Math.round(genMs),
        byTemplate,
        revertReasons,
    }));
    process.exit(error ? 5 : 0);
}

/* ══════════════════════════════════════════════════════════════════════
 * THE HARNESS
 * ══════════════════════════════════════════════════════════════════════ */

const {
    MAZE_SKELETON_KINDS,
} = SUBSTRATE === 'maze' ? await M('mazeRoom/procgenMaze.js') : { };
const {
    SEEDLING_SKELETON_KINDS,
} = SUBSTRATE === 'seedling' ? await M('seedlingDemo/procgenSeedling.js') : { };

/** ⛓ DERIVED FROM THE BINDING, never a second list here. */
const OFFERED = SUBSTRATE === 'maze' ? MAZE_SKELETON_KINDS : SEEDLING_SKELETON_KINDS;
/**
 * ⛓⛓ SLICE 7 — A `--kinds=` MEMBER IS A FULL SKELETON SPEC, `;` clauses and
 * all: `--kinds=winding,winding;chambers=2,rooms;minRoom=4`. ⛔ Comma separates
 * the CELLS and `;` separates a kind's PARAMETERS, so the two never collide —
 * and the spec STRING is the row label, so `winding` and `winding;chambers=2`
 * are two rows of one table rather than one row that quietly averaged them.
 *
 * ⛔ VALIDATED HERE, BEFORE THE ESTIMATE PRINTS, through the ONE parser — a
 * sweep that discovered a typo in cell 41 of 56 would have spent the wall clock
 * to find it.
 */
const KINDS = arg('kinds', '') === '' ? [...OFFERED]
    : arg('kinds', '').split(',').map((s) => s.trim()).filter(Boolean);
for (const k of KINDS) {
    try {
        parseSkeleton(k, {
            simulator: SUBSTRATE === 'maze', substrate: `the ${SUBSTRATE} binding`,
        });
    } catch (e) {
        note(`sweep-yield-table: --kinds= member "${k}" — ${e.message}`);
        process.exit(2);
    }
}

/**
 * ⛓⛓⛓ **`--sizes=` IS A SEEDLING AXIS NOW** (PROCGEN ELEMENTS arc 5, slice 1;
 * ⚖ ruling 1 supersedes arc-3 ruling 7's *"stays 10x10"*).
 *
 * ⛔ THIS FILE USED TO REFUSE IT BY NAME, and the refusal was RIGHT at the
 * time: *"the binding has no width/height argument at all — offering a
 * `--sizes=` that silently did nothing would be a knob claiming an axis this
 * sweep does not have."* The binding has one now, so the knob is real; the
 * DEFAULT stays `10x10`, which is the room every committed number in this
 * repo was measured in.
 *
 * ⛔ AND THE RANGE IS THE BINDING'S, checked here before the estimate prints,
 * so a sweep does not discover a typo in cell 41 of 56. Seedling's maximum is
 * the VANILLA maximum, 60 — a `--sizes=64x64` refuses with the atlas
 * measurement in the sentence.
 */
const SIZES = (SUBSTRATE === 'maze'
    ? arg('sizes', '11x11,7x7,5x5,4x4')
    : arg('sizes', '10x10')).split(',').map(parseSize);
if (SUBSTRATE === 'seedling') {
    const { assertRoomSize } = await M('seedlingDemo/procgenLevel.js');
    for (const sz of SIZES) {
        try {
            assertRoomSize({ width: sz.width, height: sz.height }, 'sweep-yield-table');
        } catch (e) {
            note(`sweep-yield-table: --sizes= member "${sz.label}" — ${e.message}`);
            process.exit(2);
        }
    }
}

const SEEDS = parseSeeds(arg('seeds', '1-8'));
const CELL_BUDGET_S = num('cellbudget', SUBSTRATE === 'seedling' ? 120 : 30);
const JSON_OUT = arg('json', '');

const cells = [];
for (const kind of KINDS) for (const size of SIZES) for (const seed of SEEDS) {
    cells.push({ kind, size, seed });
}

/**
 * ⛓⛓ THE ESTIMATE IS PRINTED **BEFORE** THE RUN — ⚖ the brief's own
 * requirement, and Probe 2 is where the number comes from: seed 5's saturated
 * corridor run cost 106 s for ~18 solves, i.e. ~5.9 s per solve at the worst.
 * `costModel`'s arithmetic gives the solve ceiling for these bounds, so the
 * worst case is arithmetic times a MEASURED per-solve worst, not a guess.
 */
const WORST_SOLVE_MS = SUBSTRATE === 'seedling' ? 5900 : 3;
/** ⚠ Measured on this box, and it DOMINATES the maze sweep (13 solves ≈ 40 ms). */
const STARTUP_MS = 150;
const solvesPerCell = 1 + BOUNDS.obstacleTarget * BOUNDS.triesPerStep
    * BOUNDS.anchorTriesPerCandidate;
const worstCellMs = solvesPerCell * WORST_SOLVE_MS;
const cappedCellMs = Math.min(worstCellMs, CELL_BUDGET_S * 1000);

const header = [
    `# THE YIELD TABLE — \`${SUBSTRATE}\`${SUBSTRATE === 'seedling'
        ? ` biome \`${PALETTE_NAME}\`` : ''} (CONSTRUCTIVE-MODE arc, slice 6, §3.6 item 1)`,
    '',
    `command: \`node scripts/procgen/sweep-yield-table.mjs --substrate=${SUBSTRATE} `
        + `--kinds=${KINDS.join(',')} --sizes=${SIZES.map((s) => s.label).join(',')} `
        + `${AREAS.keys > 0 ? `--areas='${formatAreaSpec(AREAS)}' ` : ''}`
        /**
         * ⛓⛓⛓ **THE ELEMENT ARM IS PART OF THE COMMAND** — PROCGEN ELEMENTS arc
         * 5, slice 6a. ⛔ It was MISSING, and the omission broke this file's own
         * law 1 (*"a reader who finds the table in an as-built can re-run exactly
         * it"*) on the axis that changes the table most: §11.9's two tables — the
         * biome default and `chamber;w=2;h=3` — printed the SAME `command:` line,
         * so the pair could not be told apart by the thing that is supposed to
         * identify them. ⚠ It is `ELEMENTS_EFFECTIVE` and not the raw flag, so an
         * OMITTED `--elements=` prints the biome default it resolved to, which is
         * the string the run actually used.
         */
        + `--elements='${formatElementSpec(ELEMENTS_EFFECTIVE)}' `
        + `${REQUIRE ? `--require=${formatRequireList(REQUIRE)} ` : ''}`
        + `${SUBSTRATE === 'seedling' ? `--palette=${PALETTE_NAME} ` : ''}`
        + `--seeds=${arg('seeds', '1-8')} --count=${BOUNDS.obstacleTarget} `
        + `--tries=${BOUNDS.triesPerStep} --k=${BOUNDS.saturationK} `
        + `--anchortries=${BOUNDS.anchorTriesPerCandidate} --cellbudget=${CELL_BUDGET_S}\``,
    '',
    `bounds (frozen for every cell): obstacleTarget=${BOUNDS.obstacleTarget} `
        + `triesPerStep=${BOUNDS.triesPerStep} saturationK=${BOUNDS.saturationK} `
        + `anchorTriesPerCandidate=${BOUNDS.anchorTriesPerCandidate} `
        + `⇒ at most ${solvesPerCell} solve(s) per cell.`,
    `axes: ${KINDS.length} kind(s) x ${SIZES.length} size(s) x ${SEEDS.length} seed(s) `
        + `= **${cells.length} cells**.`,
    `⛔ HARNESS BOUND: **${CELL_BUDGET_S} s per cell**, enforced by killing the cell's own `
        + 'child process. A cell that outruns it is recorded as `TIMEOUT-ABORTED` in the '
        + 'denominator line and the sweep moves on. This is the SWEEP\'s bound; nothing in '
        + 'the generator, either binding or either oracle knows it exists.',
    `⛓ ESTIMATE BEFORE THE RUN: worst-case ${worstCellMs} ms of GENERATION per cell `
        + `(${solvesPerCell} solves x ${WORST_SOLVE_MS} ms, the ${SUBSTRATE === 'seedling'
            ? 'per-solve worst Probe 2 measured on a saturated corridor'
            : 'per-solve ceiling the maze CLI states'}), capped by the harness at `
        + `${CELL_BUDGET_S * 1000} ms, PLUS ~${STARTUP_MS} ms of node startup per cell `
        + `(the child pays it; it is not in genMs) ⇒ **at most `
        + `${Math.round((cells.length * (cappedCellMs + STARTUP_MS)) / 60000)} min** for the `
        + `whole sweep (${cells.length} cells).`,
    '⛔ wall-clock columns are EVIDENCE ONLY — nothing here decides anything about a level '
        + '(`feedback_wallclock_budget_breaks_determinism`).',
    '',
].join('\n');

say(header);
if (has('estimate-only')) process.exit(0);

const results = [];
const denom = { attempted: 0, completed: 0, timedOut: 0, threw: 0, harnessFailed: 0 };
const abortClasses = {};
const harnessT0 = Date.now();

for (const c of cells) {
    denom.attempted += 1;
    note(`[stderr] ${SUBSTRATE} ${c.kind} ${c.size.label} seed ${c.seed} `
        + `(${denom.attempted}/${cells.length})…`);
    const childArgs = [SELF, `--substrate=${SUBSTRATE}`, `--areas=${formatAreaSpec(AREAS)}`,
        `--elements=${formatElementSpec(ELEMENTS_EFFECTIVE)}`,
        // ⛓ arc 3 slice 2 — the biome travels to the worker, or every cell of a
        // `--palette=post-sword` run would silently be a pre-sword one.
        ...(SUBSTRATE === 'seedling' ? [`--palette=${PALETTE_NAME}`] : []),
        ...(REQUIRE ? [`--require=${formatRequireList(REQUIRE)}`] : []),
        `--cell=${c.kind}|${c.size.label}|${c.seed}`,
        `--count=${BOUNDS.obstacleTarget}`, `--tries=${BOUNDS.triesPerStep}`,
        `--k=${BOUNDS.saturationK}`, `--anchortries=${BOUNDS.anchorTriesPerCandidate}`];
    const t0 = Date.now();
    let stdout = null;
    let killed = false;
    try {
        stdout = execFileSync(process.execPath, childArgs, {
            encoding: 'utf8', timeout: CELL_BUDGET_S * 1000, maxBuffer: 64 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'inherit'],
        });
    } catch (e) {
        // ⚠ `execFileSync` throws on a non-zero exit AND on a timeout kill. The
        // two are different findings: exit 5 is a cell that ran and threw (its
        // stdout carries the classified error), a kill is a cell that outran
        // the harness bound.
        killed = e.killed === true || e.signal === 'SIGTERM';
        stdout = e.stdout ?? null;
    }
    const cellMs = Date.now() - t0;
    if (killed) {
        denom.timedOut += 1;
        abortClasses[`TIMEOUT-ABORTED (bound: ${CELL_BUDGET_S} s)`] = (abortClasses[
            `TIMEOUT-ABORTED (bound: ${CELL_BUDGET_S} s)`] ?? 0) + 1;
        results.push({ ...c, size: c.size.label, aborted: 'TIMEOUT', cellMs });
        continue;
    }
    let row = null;
    try {
        row = JSON.parse((stdout ?? '').trim().split('\n').filter(Boolean).pop() ?? '');
    } catch { row = null; }
    if (!row) {
        denom.harnessFailed += 1;
        abortClasses['HARNESS-FAILED (the cell printed no parseable row)'] = (abortClasses[
            'HARNESS-FAILED (the cell printed no parseable row)'] ?? 0) + 1;
        results.push({ ...c, size: c.size.label, aborted: 'HARNESS', cellMs });
        continue;
    }
    if (row.error) {
        denom.threw += 1;
        abortClasses[`THREW ${row.error.name}`] = (abortClasses[`THREW ${row.error.name}`] ?? 0) + 1;
        note(`[stderr]   THREW ${row.error.name}: ${row.error.message.slice(0, 160)}`);
    } else denom.completed += 1;
    results.push({ ...row, cellMs });
}

const harnessMs = Date.now() - harnessT0;

/* ── THE ROLL-UPS ───────────────────────────────────────────────────── */

const pct = (n, d) => (d === 0 ? '-' : `${Math.round((100 * n) / d)}%`);
const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

const groups = new Map();
for (const r of results) {
    const key = `${r.kind}|${r.size}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
}

say('## Per kind x size — the outcome roll-up');
say('');
say(`| kind | size | floor % | SITES (mean/cell) | cells | saturated | kept | ${SUBSTRATE === 'maze'
    ? 'wall / door' : 'per template'} outcomes: KEPT / REVERTED / NO_ANCHOR / ILLEGAL `
    + '| solves | mean genMs | MAX genMs | MAX solveMs |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [key, rows] of groups) {
    const [kind, size] = key.split('|');
    const ok = rows.filter((r) => !r.aborted && !r.error);
    const tally = {};
    for (const r of ok) {
        for (const [t, counts] of Object.entries(r.byTemplate ?? {})) {
            const acc = (tally[t] ??= { KEPT: 0, REVERTED: 0, NO_ANCHOR: 0, ILLEGAL_PLACEMENT: 0 });
            for (const k of Object.keys(acc)) acc[k] += counts[k] ?? 0;
        }
    }
    const perTemplate = Object.entries(tally)
        .map(([t, c]) => `${t} ${c.KEPT}/${c.REVERTED}/${c.NO_ANCHOR}/${c.ILLEGAL_PLACEMENT}`)
        .join('<br>') || '(no attempt)';
    const sat = ok.filter((r) => r.stop === 'SATURATED').length;
    /**
     * ⛓ arc 3 slice 1 — WHAT THE SKELETON OFFERED, beside what the palette
     * kept. `chambers` is the one a `site: 'chamber'` row's NO_ANCHOR column
     * has to be read against: 0 chambers is a room with nowhere to put an area
     * template, which is a fact about the CARVE and not about the template.
     */
    const siteCol = ok.some((r) => r.siteCensus)
        ? `main ${mean(ok.map((r) => r.siteCensus?.main ?? 0))} · chambers `
          + `${mean(ok.map((r) => r.siteCensus?.chambers ?? 0))} · chamber cells `
          + `${mean(ok.map((r) => r.siteCensus?.chamber ?? 0))} · corridor `
          + `${mean(ok.map((r) => r.siteCensus?.corridor ?? 0))} · branches `
          + `${mean(ok.map((r) => r.siteCensus?.branch ?? 0))}`
        : '-';
    say(`| ${kind} | ${size} | ${ok.length ? `${mean(ok.map((r) => r.floorPct))}%` : '-'} `
        + `| ${siteCol} `
        + `| ${ok.length}/${rows.length} | ${sat} (${pct(sat, ok.length)}) `
        + `| ${ok.reduce((a, r) => a + r.keptCount, 0)} | ${perTemplate} `
        + `| ${ok.reduce((a, r) => a + r.solves, 0)} | ${mean(ok.map((r) => r.genMs))} `
        + `| ${Math.max(0, ...ok.map((r) => r.genMs))} `
        + `| ${Math.max(0, ...ok.map((r) => r.maxSolveMs))} |`);
}
say('');

/**
 * ⛓⛓⛓ **THE SHELL'S WIN, PER KIND x SIZE** (arc 5, slice 1; ⚖ ruling 2, and
 * the §6 Q1 evidence the close will cite).
 *
 * ⛔ THE NUMBER IS A MEASUREMENT AND SOME OF IT IS ZERO, WHICH IS THE FINDING:
 * the strip drops WALL CELLS NOTHING CAN TOUCH, so a room whose interior is
 * mostly floor has none to drop and an OPEN bordered room has literally none
 * (every ring cell is 8-adjacent to the interior). A table that only showed the
 * carved kinds would sell the format on its best case.
 */
if (SUBSTRATE === 'seedling' && results.some((r) => r.shellCensus)) {
    say('## THE SHELL — what `--fill=shell` drops, per kind x size (⛓ on the SKELETON)');
    say('');
    say('| kind | size | cells | dense tiles | shell tiles | dropped | dense bytes '
        + '| shell bytes | saved |');
    say('|---|---|---|---|---|---|---|---|---|');
    for (const [key, rs] of groups) {
        const [kind, size] = key.split('|');
        const ok = rs.filter((r) => r.shellCensus);
        if (ok.length === 0) continue;
        const m = (pick) => mean(ok.map(pick));
        say(`| ${kind} | ${size} | ${m((r) => r.shellCensus.cells)} `
            + `| ${m((r) => r.shellCensus.denseTiles)} | ${m((r) => r.shellCensus.shellTiles)} `
            + `| ${m((r) => r.shellCensus.denseTiles - r.shellCensus.shellTiles)} `
            + `| ${m((r) => r.shellCensus.denseBytes)} | ${m((r) => r.shellCensus.shellBytes)} `
            + `| **${m((r) => r.shellCensus.savedPct)}%** |`);
    }
    say('');
}

if (SUBSTRATE === 'maze') {
    say('## THE AREA CENSUS — per kind x size (⛓ measured on the SKELETON, before any lock)');
    say('');
    say('| kind | size | areas (min/mean/max) | REAL (non-synthetic) | <=1 area | adjacency '
        + '| max degree | 3+ junctions | dead floor | ent IN | goal IN | area graph RAN '
        + '| doors | graphify |');
    say('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [key, rows] of groups) {
        const [kind, size] = key.split('|');
        const ok = rows.filter((r) => r.areaCensus && !r.aborted);
        if (!ok.length) continue;
        const c = ok.map((r) => r.areaCensus);
        const n = (f) => c.map(f);
        say(`| ${kind} | ${size} | ${Math.min(...n((x) => x.areas))}/`
            + `${mean(n((x) => x.areas))}/${Math.max(...n((x) => x.areas))} `
            + `| ${mean(n((x) => x.real))} | ${c.filter((x) => x.areas <= 1).length}/${c.length} `
            + `| ${mean(n((x) => x.adjacency))} | ${Math.max(...n((x) => x.maxDegree))} `
            + `| ${c.reduce((a, x) => a + x.junctions3, 0)} `
            + `| ${c.reduce((a, x) => a + x.deadFloor, 0)} `
            + `| ${c.filter((x) => x.entranceInArea).length}/${c.length} `
            + `| ${c.filter((x) => x.goalInArea).length}/${c.length} `
            + `| ${c.filter((x) => x.ran).length}/${c.length} `
            + `| ${c.reduce((a, x) => a + x.doors, 0)} `
            + `| ${c.reduce((a, x) => a + x.graphifyEdges, 0)} |`);
    }
    say('');
}

/**
 * ⛓⛓⛓ **THE DIRECTIVE'S TABLE — BOTH SUBSTRATES SINCE ARC 3, SLICE 4d.** It
 * used to live INSIDE the maze-only area-census block, which is where it was
 * written (slice 3) and is not where it belongs: `--require=` is now a flag both
 * bindings take and a table printed only for one of them would report a
 * Seedling sweep as though nothing had been asked.
 */
if (REQUIRE) {
    say(`## THE DIRECTIVE — \`--require=${formatRequireList(REQUIRE)}\``
        + `${SUBSTRATE === 'seedling' ? ' (arc 3, slice 4d)' : ' (arc 1, slice 3)'}`);
    say('');
    say(SUBSTRATE === 'seedling'
        ? '⛓ MET = the required ITEM\'s ELEMENT (derived from `ELEMENT_TABLE.needs`) was '
            + 'PLACED, CERTIFIED by the seam\'s own solve, and graded REQUIRED by the '
            + 'requirements differential on the FINAL level — STRONG (the without-arm was '
            + 'REFUSED within budget) or BOUND-DEPENDENT (it exhausted the budget). ⛔ WEAK '
            + '(the without-arm THREW) does not meet a directive: an ENGINE throw is not a '
            + 'claim about the level. ⚠ THE WITHOUT-ARM IS A REAL SOLVE and costs one per '
            + 'cell, so this sweep\'s timing columns are not comparable to one without '
            + '`--require=`.'
        : '⛓ MET = every asked symbol placed AND proved a cut by the KEY ablation (remove '
            + '`key_K`, keep the doors, re-solve → the goal is unreachable). The grade is '
            + 'STRONG whenever the ablation refuses, which on this substrate is the only '
            + 'grade reachable — the BFS differential is a PROOF here, and the graded half is '
            + 'exercised in its trivial case (⚖ design §4.5 / PoC §16.6).');
    say('');
    say('| kind | size | MET | REFUSED | by reason | grades |');
    say('|---|---|---|---|---|---|');
    for (const [key, rows] of groups) {
        const [kind, size] = key.split('|');
        const ok = rows.filter((r) => r.require && !r.aborted);
        if (!ok.length) continue;
        const met = ok.filter((r) => r.require.refused === null);
        const why = {};
        for (const r of ok) {
            if (r.require.refused) why[r.require.refused] = (why[r.require.refused] ?? 0) + 1;
        }
        const grades = {};
        for (const r of met) for (const g of r.require.grades) grades[g] = (grades[g] ?? 0) + 1;
        say(`| ${kind} | ${size} | ${met.length}/${ok.length} `
            + `| ${ok.length - met.length}/${ok.length} `
            + `| ${Object.entries(why).map(([k, n]) => `\`${k}\` ${n}`).join('<br>') || '-'} `
            + `| ${Object.entries(grades).map(([g, n]) => `${g} ${n}`).join(', ') || '-'} |`);
    }
    say('');
}

/** ⛓ The area refusals are the MAZE's own block, re-opened after the directive
 *  table moved out from between them (arc 3, slice 4d). */
if (SUBSTRATE === 'maze') {
    say('## THE AREA REFUSALS, by reason');
    say('');
    const refusals = {};
    for (const r of results) {
        const why = r.areaCensus?.refused;
        if (why) refusals[why] = (refusals[why] ?? 0) + 1;
    }
    const refusalRows = Object.entries(refusals).sort((a, b) => b[1] - a[1]);
    if (!refusalRows.length) say('(no cell refused an area graph in this sweep.)');
    else {
        say('| n | reason |');
        say('|---|---|');
        for (const [k, n] of refusalRows) say(`| ${n} | \`${k}\` |`);
    }
    say('');
}

/**
 * ⛓⛓⛓ THE SEEDLING AREA TABLE (arc 3, slice 4b) — its own block rather than a
 * widened maze one, because the two bindings report DIFFERENT things: the maze
 * counts DOORS and asks whether the entrance and the goal are IN an area; the
 * Seedling arm counts BOUNDARY LOCKS, the goal's VESTIBULE, the element's
 * declared area, whether the flag is GUARDED and whether the graph CERTIFIED.
 * ⛔ A shared table would have to leave half its columns blank on each
 * substrate, which is a table that means two things at two rows.
 */
if (SUBSTRATE === 'seedling' && AREAS.keys > 0) {
    say(`## THE SEEDLING AREA TABLE — \`--areas=${formatAreaSpec(AREAS)}\``);
    say('');
    say('| kind | areas (min/mean/max) | REAL | vestibule | element | RAN | CERTIFIED '
        + '| locks | flags GUARDED | superseded | graphify | tags |');
    say('|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [key, rows] of groups) {
        const [kind] = key.split('|');
        const ok = rows.filter((r) => r.areaCensus && !r.aborted);
        if (!ok.length) continue;
        const c = ok.map((r) => r.areaCensus);
        const n = (f) => c.map(f);
        const ran = c.filter((x) => x.ran);
        say(`| \`${kind}\` | ${Math.min(...n((x) => x.areas))}/`
            + `${mean(n((x) => x.areas))}/${Math.max(...n((x) => x.areas))} `
            + `| ${mean(n((x) => x.real))} `
            + `| ${c.filter((x) => x.vestibule > 0).length}/${c.length} `
            + `| ${c.filter((x) => x.element > 0).length}/${c.length} `
            + `| **${ran.length}/${c.length}** `
            + `| **${c.filter((x) => x.certified).length}/${c.length}** `
            + `| ${ran.reduce((a, x) => a + x.locks, 0)} `
            + `| ${ran.reduce((a, x) => a + x.guardedFlags, 0)}/`
                + `${ran.reduce((a, x) => a + x.flags, 0)} `
            + `| ${c.reduce((a, x) => a + x.superseded, 0)} `
            + `| ${c.reduce((a, x) => a + x.graphifyEdges, 0)} `
            + `| ${Math.max(0, ...n((x) => x.tagsUsed))} |`);
    }
    say('');
    say('## THE SEEDLING AREA REFUSALS, by reason');
    say('');
    const why = {};
    for (const r of results) {
        const name = r.areaCensus?.refused
            ?? (r.areaCensus && r.areaCensus.ran && r.areaCensus.certified === false
                ? 'the-area-graph-does-not-certify' : null);
        if (name) why[name] = (why[name] ?? 0) + 1;
    }
    const rowsW = Object.entries(why).sort((a, b) => b[1] - a[1]);
    if (!rowsW.length) say('(no cell refused an area graph in this sweep.)');
    else {
        say('| n | reason |');
        say('|---|---|');
        for (const [k, n] of rowsW) say(`| ${n} | \`${k}\` |`);
    }
    say('');
}

/**
 * ⛓⛓⛓ THE ELEMENTS CENSUS — PROCGEN ELEMENTS arc 2 slice 3's deliverable 1,
 * printed by the sweep so it is re-runnable rather than a table in a document.
 *
 * ⛔ `site` is CONSTRUCTED-or-refused-at-the-site-stage, `carve OK` is the
 * composite plus every check on the way out, and `guarded` is the one that
 * matters: a gadget guarding nothing is ⚖ ruling 1 not happening. `overwrote`
 * is the NON-VACUITY witness of the fixed registration — cells the carve had
 * written differently from what the element wants.
 */
if (SUBSTRATE === 'maze' && ELEMENTS_EFFECTIVE.name !== ELEMENTS_NONE) {
    say(`## THE ELEMENTS CENSUS — \`--elements=${formatElementSpec(ELEMENTS_EFFECTIVE)}\``);
    say('');
    say('| kind | size | N | placed | guarded | worst nodes | max pushes | max tunnel '
        + '| mean overwrote | heldAtDoor true/null |');
    say('|---|---|---|---|---|---|---|---|---|---|');
    const seen = new Map();
    for (const r of results) {
        const k = `${r.kind}|${r.size}`;
        if (!seen.has(k)) {
            seen.set(k, { kind: r.kind, size: r.size, n: 0, placed: 0, guarded: 0, nodes: 0,
                pushes: 0, tunnel: 0, over: [], held: 0, never: 0, why: {} });
        }
        const c = seen.get(k);
        c.n += 1;
        const e = r.elements;
        if (!e) continue;
        if (!e.ran) { c.why[e.refused ?? 'unknown'] = (c.why[e.refused ?? 'unknown'] ?? 0) + 1;
            continue; }
        c.placed += 1;
        c.guarded += e.guarded;
        c.nodes = Math.max(c.nodes, ...e.nodes.map((v) => v ?? 0));
        c.pushes = Math.max(c.pushes, ...e.pushes);
        c.tunnel = Math.max(c.tunnel, ...e.tunnel);
        c.over.push(...e.carveOverwrote);
        for (const h of e.heldAtDoor) { if (h === true) c.held += 1; else if (h === null) c.never += 1; }
    }
    for (const c of seen.values()) {
        const mean = c.over.length
            ? (c.over.reduce((a, b) => a + b, 0) / c.over.length).toFixed(1) : '—';
        say(`| ${c.kind} | ${c.size} | ${c.n} | ${c.placed} | ${c.guarded} | `
            + `${c.nodes || '—'} | ${c.pushes || '—'} | ${c.tunnel} | ${mean} | `
            + `${c.held}/${c.never} |`);
    }
    say('');
    say('### the element REFUSALS, by name');
    say('');
    const all = {};
    for (const c of seen.values()) {
        for (const [k, n] of Object.entries(c.why)) all[k] = (all[k] ?? 0) + n;
    }
    const rows2 = Object.entries(all).sort((a, b) => b[1] - a[1]);
    if (!rows2.length) say('(every cell placed its element.)');
    else {
        say('| n | reason |');
        say('|---|---|');
        for (const [k, n] of rows2) say(`| ${n} | \`${k}\` |`);
    }
    say('');
}

/**
 * ⛓⛓⛓ **THE SEEDLING ELEMENTS CENSUS — arc 3 slice 3**, and it prints THREE
 * columns where the maze prints two, because on Seedling *the geometry held* and
 * *the solver certified it* are different facts today:
 *
 *   PLACED     — the site fitted, the composite held, the guard is a CUT of the
 *                level and the flag's lock found a main-path cut cell.
 *   CERTIFIED  — the skeleton solved WITH the gadget in it. ⛔ **0, always**:
 *                ⚖ ruling 22's opener chain needs a solver capability that does
 *                not exist (arc-3 §10's S1 work order). The refusal SENTENCE is
 *                printed so the column cannot be read as "it did not work out".
 *   GUARDED    — certified AND the flag behind the door. 0 by the same line.
 */
if (SUBSTRATE === 'seedling'
    && (isElementList(ELEMENTS_EFFECTIVE) || ELEMENTS_EFFECTIVE.name !== ELEMENTS_NONE)) {
    const spec = formatElementSpec(ELEMENTS_EFFECTIVE);
    say(`## THE SEEDLING ELEMENTS CENSUS — \`--elements=${spec}\``);
    say('');
    /** ⛓ arc 3 slice 4a — `tunnel`/`overwrote` are the PRE-CARVE phase's own
     *  numbers and `wall`/`carved`/`offered` are the `on-connector` phase's, so
     *  the table carries both columns and each arm fills the pair it has. */
    say('| kind | N | PLACED | CERTIFIED | guarded | max tunnel | mean overwrote '
        + '| wall/carved | door cells offered | heldAtDoor true/null |');
    say('|---|---|---|---|---|---|---|---|---|---|');
    const seen = new Map();
    for (const r of results) {
        if (!seen.has(r.kind)) {
            seen.set(r.kind, { kind: r.kind, n: 0, placed: 0, certified: 0, guarded: 0,
                tunnel: 0, over: [], held: 0, never: 0, why: {}, certWhy: {},
                wall: 0, carved: 0, offered: [] });
        }
        const c = seen.get(r.kind);
        c.n += 1;
        const e = r.elements;
        if (!e) continue;
        if (!e.placed) {
            const k = e.refused ?? 'unknown';
            c.why[k] = (c.why[k] ?? 0) + 1;
            continue;
        }
        c.placed += 1;
        if (e.certified) c.certified += 1;
        else if (e.certReason) {
            const k = `${e.certVerdict}: ${e.certReason.slice(0, 110)}`;
            c.certWhy[k] = (c.certWhy[k] ?? 0) + 1;
        }
        c.guarded += e.guarded;
        c.tunnel = Math.max(c.tunnel, e.tunnel ?? 0);
        if (e.carveOverwrote != null) c.over.push(e.carveOverwrote);
        if (e.phase === 'on-connector') {
            c.wall += (e.wall ?? []).length;
            c.carved += (e.carved ?? []).length;
            if (e.candidates != null) c.offered.push(e.candidates);
        }
        if (e.heldAtDoor === true) c.held += 1; else if (e.heldAtDoor === null) c.never += 1;
    }
    for (const c of seen.values()) {
        const meanOver = c.over.length
            ? (c.over.reduce((a, b) => a + b, 0) / c.over.length).toFixed(1) : '—';
        const offered = c.offered.length
            ? `${Math.min(...c.offered)}..${Math.max(...c.offered)}` : '—';
        say(`| ${c.kind} | ${c.n} | **${c.placed}** | **${c.certified}** | ${c.guarded} | `
            + `${c.tunnel} | ${meanOver} | ${c.wall}/${c.carved} | ${offered} `
            + `| ${c.held}/${c.never} |`);
    }
    say('');
    say('### the element REFUSALS, by name (the GEOMETRY half)');
    say('');
    const all = {};
    const certAll = {};
    for (const c of seen.values()) {
        for (const [k, n] of Object.entries(c.why)) all[k] = (all[k] ?? 0) + n;
        for (const [k, n] of Object.entries(c.certWhy)) certAll[k] = (certAll[k] ?? 0) + n;
    }
    const rows2 = Object.entries(all).sort((a, b) => b[1] - a[1]);
    if (!rows2.length) say('(every cell placed its element.)');
    else {
        say('| n | reason |');
        say('|---|---|');
        for (const [k, n] of rows2) say(`| ${n} | \`${k}\` |`);
    }
    say('');
    say('### ⛔⛔ the CERTIFICATION refusals — the SOLVE\'s own words');
    say('');
    const rows3 = Object.entries(certAll).sort((a, b) => b[1] - a[1]);
    if (!rows3.length) say('(no placed gadget reached a certification solve in this sweep.)');
    else {
        say('| n | the solve said |');
        say('|---|---|');
        for (const [k, n] of rows3) say(`| ${n} | ${k} |`);
    }
    say('');
}

say('## Per cell');
say('');
say('| kind | size | seed | stop | kept | attempts | solves | genMs | maxSolveMs '
    + '| skelTicks | finalTicks |');
say('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
    if (r.aborted) {
        say(`| ${r.kind} | ${r.size} | ${r.seed} | **${r.aborted}-ABORTED** | - | - | - `
            + `| ${r.cellMs} | - | - | - |`);
        continue;
    }
    if (r.error) {
        say(`| ${r.kind} | ${r.size} | ${r.seed} | **THREW ${r.error.name}** | - | - `
            + `| ${r.solves} | ${r.genMs} | ${r.maxSolveMs} | - | - |`);
        continue;
    }
    say(`| ${r.kind} | ${r.size} | ${r.seed} | ${r.stop} | ${r.keptCount} | ${r.attempts} `
        + `| ${r.solves} | ${r.genMs} | ${r.maxSolveMs} | ${r.skeletonTicks} `
        + `| ${r.finalTicks} |`);
}
say('');

say('## The REVERT reasons, verbatim (first 60 chars), grouped');
say('');
const reasons = {};
for (const r of results) {
    for (const [k, n] of Object.entries(r.revertReasons ?? {})) reasons[k] = (reasons[k] ?? 0) + n;
}
const reasonRows = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
if (!reasonRows.length) say('(no candidate was REVERTED in this sweep.)');
else {
    say('| n | template :: the oracle\'s own words |');
    say('|---|---|');
    for (const [k, n] of reasonRows) say(`| ${n} | \`${k.replace(/\|/g, '\\|')}\` |`);
}
say('');

/**
 * ⛓ THE DENOMINATOR LINE — ⚖ `batch-seedling-acceptance.mjs`'s obligation,
 * carried whole: a sweep says how many cells it ATTEMPTED, how many COMPLETED,
 * and what became of the rest BY CLASS. A table that printed only the cells
 * that worked would read as full coverage of a roster it silently truncated.
 */
say('## The denominator');
say('');
say(`attempted **${denom.attempted}** · completed **${denom.completed}** · `
    + `threw **${denom.threw}** · timed out **${denom.timedOut}** · `
    + `harness-failed **${denom.harnessFailed}**`);
if (Object.keys(abortClasses).length) {
    say('');
    for (const [k, n] of Object.entries(abortClasses)) say(`- \`${k}\` x${n}`);
}
say('');
say(`harness wall time: ${Math.round(harnessMs / 1000)} s for ${cells.length} cell(s) `
    + `(includes ~0.2-0.5 s of node startup per cell, which is NOT in genMs).`);

if (JSON_OUT !== '') {
    if (JSON_OUT.includes('fixtures/')) {
        note('sweep-yield-table: REFUSED to write under `fixtures/` — committed fixtures are '
            + 'byte-identical artifacts of recorded runs and no tool in this arc writes them '
            + '(standing law).');
        process.exit(2);
    }
    mkdirSync(dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, `${JSON.stringify({
        substrate: SUBSTRATE,
        kinds: KINDS,
        sizes: SIZES.map((s) => s.label),
        seeds: SEEDS,
        bounds: BOUNDS,
        cellBudgetSeconds: CELL_BUDGET_S,
        denominator: denom,
        abortClasses,
        harnessMs,
        results,
    }, null, 2)}\n`);
    note(`[stderr] wrote ${JSON_OUT}`);
}
