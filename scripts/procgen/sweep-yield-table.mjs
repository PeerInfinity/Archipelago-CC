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
 *   `--sizes=`  MAZE only: `11x11,7x7,5x5,4x4` by default (§9.6's ladder).
 *               ⛔ Seedling's room is FIXED at one screen (10x10,
 *               `SINGLE_SCREEN_TILES`), so its second axis is the kind's own
 *               FLOOR FRACTION, printed as a column rather than swept.
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
    if (SUBSTRATE === 'maze') {
        const {
            MAZE_PALETTE, mazeModel, mazeOracle,
        } = await M('mazeRoom/procgenMaze.js');
        const { TILE_FLOOR } = await M('mazeRoom/mazeRoomEngine.js');
        model = mazeModel({ seed, width: size.width, height: size.height, skeleton: { kind } });
        palette = MAZE_PALETTE;
        oracle = mazeOracle({ model, items: palette.items ?? null });
        const sk = model.skeleton();
        floorPct = Math.round((100 * [...sk.tiles].filter((t) => t === TILE_FLOOR).length)
            / sk.tiles.length);
    } else {
        const {
            interiorCells, seedlingModel, seedlingOracle,
        } = await M('seedlingDemo/procgenSeedling.js');
        const { PRE_SWORD_PALETTE } = await M('seedlingDemo/procgenPalette.js');
        const { terrainAt } = await M('seedlingDemo/procgenLevel.js');
        model = seedlingModel({ seed, skeleton: { kind } });
        palette = PRE_SWORD_PALETTE;
        oracle = seedlingOracle({ model, items: palette.items ?? null });
        const sk = model.skeleton();
        const cells = interiorCells(sk);
        floorPct = Math.round((100 * cells.filter((c) => terrainAt(sk, c.tx, c.ty) === 'ground')
            .length) / cells.length);
    }

    const t0 = process.hrtime.bigint();
    let out = null;
    let error = null;
    try {
        out = generateLevel({
            rng: (await M(`${SUBSTRATE === 'maze' ? 'mazeRoom' : 'seedlingDemo'}/procgenRng.js`))
                .rngFor(seed),
            model,
            oracle: wrap(oracle),
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
    say(JSON.stringify({
        substrate: SUBSTRATE,
        kind,
        size: size.label,
        seed,
        floorPct,
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
const KINDS = arg('kinds', '') === '' ? [...OFFERED]
    : arg('kinds', '').split(',').map((s) => s.trim()).filter(Boolean);
for (const k of KINDS) {
    if (!OFFERED.includes(k)) {
        note(`sweep-yield-table: the ${SUBSTRATE} binding does not offer the kind "${k}" `
            + `[${OFFERED.join(', ')}].`);
        process.exit(2);
    }
}

/**
 * ⛔ SEEDLING HAS ONE SIZE AND SAYS SO. `SINGLE_SCREEN_TILES` is 10x10 and the
 * binding has no width/height argument at all — offering a `--sizes=` that
 * silently did nothing would be a knob claiming an axis this sweep does not
 * have.
 */
const SIZES = (SUBSTRATE === 'maze'
    ? arg('sizes', '11x11,7x7,5x5,4x4')
    : '10x10').split(',').map(parseSize);
if (SUBSTRATE === 'seedling' && arg('sizes', '') !== '') {
    note('sweep-yield-table: --sizes= is a MAZE axis. Seedling\'s room is fixed at one '
        + 'screen (SINGLE_SCREEN_TILES, 10x10) and its second axis is the kind\'s FLOOR '
        + 'FRACTION, which this table prints as a column.');
    process.exit(2);
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
    `# THE YIELD TABLE — \`${SUBSTRATE}\` (CONSTRUCTIVE-MODE arc, slice 6, §3.6 item 1)`,
    '',
    `command: \`node scripts/procgen/sweep-yield-table.mjs --substrate=${SUBSTRATE} `
        + `--kinds=${KINDS.join(',')} ${SUBSTRATE === 'maze'
            ? `--sizes=${SIZES.map((s) => s.label).join(',')} ` : ''}`
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
    const childArgs = [SELF, `--substrate=${SUBSTRATE}`,
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
say(`| kind | size | floor % | cells | saturated | kept | ${SUBSTRATE === 'maze'
    ? 'wall / door' : 'per template'} outcomes: KEPT / REVERTED / NO_ANCHOR / ILLEGAL `
    + '| solves | mean genMs | MAX genMs | MAX solveMs |');
say('|---|---|---|---|---|---|---|---|---|---|---|');
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
    say(`| ${kind} | ${size} | ${ok.length ? `${mean(ok.map((r) => r.floorPct))}%` : '-'} `
        + `| ${ok.length}/${rows.length} | ${sat} (${pct(sat, ok.length)}) `
        + `| ${ok.reduce((a, r) => a + r.keptCount, 0)} | ${perTemplate} `
        + `| ${ok.reduce((a, r) => a + r.solves, 0)} | ${mean(ok.map((r) => r.genMs))} `
        + `| ${Math.max(0, ...ok.map((r) => r.genMs))} `
        + `| ${Math.max(0, ...ok.map((r) => r.maxSolveMs))} |`);
}
say('');

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
