#!/usr/bin/env node
/**
 * census-seedling-density — **WHAT EACH POSITION OF THE DENSITY DIAL BUYS.**
 *
 * PROCGEN ELEMENTS arc 5, slice 6b (§3.6). ⚖ The arc's density item is *"naming
 * + measurement"*: `procgenCore/densityBlock.js` NAMES the six levers in one
 * line on both pages and both CLIs, and this instrument is the other half —
 * the table that says what turning each of them actually does to a room.
 *
 * ⛔⛔ **A DIAL WITHOUT A TABLE IS A KNOB.** The block alone would let a reader
 * see that a level was built at `kind=winding · chambers=2 · size=20x20 ·
 * fill=shell · element=chamber;w=2;h=3 · target=6` and tell them nothing about
 * what any of that bought. ⇒ every row below prints the BLOCK beside the four
 * numbers it moved: how much room got written, how much of it can be stood on,
 * how many obstacles the ladder kept there, and whether the element it names
 * ever reached the room.
 *
 * ── ⛔ IT IS A MEASUREMENT, NOT A GATE (the house sweep law) ───────────
 *
 * Nothing here decides anything and nothing here is a bound the generator can
 * see. ⛓ It runs the SAME `generateSeedlingLevel` the CLI runs, one cell per
 * CHILD PROCESS under a per-cell wall-clock cap (`sweep-yield-table`'s shape),
 * so one pathological cell cannot eat the table and a killed cell is COUNTED
 * rather than silently missing.
 *
 * ── ⛓ IT NAMES WHAT IT BOUNDED (`feedback_bounded_sweep_must_name_what_it_
 *    bounded`) ────────────────────────────────────────────────────────
 *
 * The kinds, the two sizes, the two fills, the two element arms, the seeds, the
 * biome and the per-cell cap are all printed in the header, with the command
 * that reproduces the table. ⛔ AND THE AXES IT DOES **NOT** SWEEP ARE NAMED
 * THERE TOO: `chambers` rides INSIDE a kind (`winding;chambers=2` is a kind
 * here, which is how every other Seedling census spells it) and
 * `obstacleTarget` is held FIXED — it is a lever of the block, but sweeping it
 * would be re-measuring `sweep-yield-table`'s own column with a worse
 * instrument.
 *
 * Run:
 *   node scripts/procgen/census-seedling-density.mjs
 *   node scripts/procgen/census-seedling-density.mjs --kinds=winding --seeds=1-2
 *   node scripts/procgen/census-seedling-density.mjs --estimate-only
 *   node scripts/procgen/census-seedling-density.mjs --json=/tmp/density.json
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = join(HERE, 'census-seedling-density.mjs');
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules', p));

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const has = (name) => process.argv.includes(`--${name}`);
const say = (t) => process.stdout.write(`${t}\n`);
const note = (t) => process.stderr.write(`${t}\n`);

const KINDS = arg('kinds', 'empty,winding,rooms,branchy').split(',').filter(Boolean);
const SIZES = arg('sizes', '10x10,20x20').split(',').filter(Boolean).map((spec) => {
    const m = /^(\d+)x(\d+)$/.exec(spec.trim());
    if (!m) { note(`census-seedling-density: --sizes= member "${spec}" is not WxH.`); process.exit(2); }
    return { width: Number(m[1]), height: Number(m[2]), label: `${m[1]}x${m[2]}` };
});
const FILLS = arg('fills', 'dense,shell').split(',').filter(Boolean);
/** ⛓ `default` = the biome's own `+` list (what a generated level actually is);
 *  `none` = the same room with no element at all. The pair is the honest answer
 *  to "what does the element member of the block buy". */
const ARMS = arg('elements', 'default,none').split(',').filter(Boolean);
const SEEDS = (() => {
    const spec = arg('seeds', '1-3');
    const m = /^(\d+)-(\d+)$/.exec(spec);
    if (!m) return spec.split(',').map(Number);
    const out = [];
    for (let s = Number(m[1]); s <= Number(m[2]); s += 1) out.push(s);
    return out;
})();
const BIOME = arg('biome', 'pre-sword');
const COUNT = Number(arg('count', '6'));
const CELL_BUDGET_S = Number(arg('cellbudget', '120'));
const JSON_OUT = arg('json', '');

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE WORKER — one cell, one child process (`sweep-yield-table`'s shape)
 * ══════════════════════════════════════════════════════════════════════ */

const CELL = arg('cell', '');
if (CELL) {
    const [kind, sizeLabel, fill, armName, seedText] = CELL.split('|');
    const { densityBlock } = await M('procgenCore/densityBlock.js');
    const { defaultElementsFor, generateSeedlingLevel, seedlingSkeletonSpec } =
        await M('seedlingDemo/procgenSeedling.js');
    const { PRE_SWORD_PALETTE, POST_SWORD_PALETTE } = await M('seedlingDemo/procgenPalette.js');
    const { ELEMENTS_NONE } = await M('seedlingDemo/procgenSeedlingElements.js');
    const { parseElementSpec } = await M('procgenCore/elementSpec.js');
    const { terrainAt } = await M('seedlingDemo/procgenLevel.js');
    const palette = BIOME === 'post-sword' ? POST_SWORD_PALETTE : PRE_SWORD_PALETTE;
    const [w, h] = sizeLabel.split('x').map(Number);
    const elements = armName === 'none'
        ? parseElementSpec(ELEMENTS_NONE) : defaultElementsFor(palette.items);
    let row;
    try {
        const out = generateSeedlingLevel({
            seed: Number(seedText),
            palette,
            /** ⛔ THE SIZE TRAVELS AS `defaults`, which is the CLI's own spelling
             *  (`generate-seedling-level.mjs:449`) — `generateSeedlingLevel` has
             *  no `width`/`height` argument of its own, and a cell that passed
             *  two ignored keys would have run the whole size axis at 10x10
             *  while printing `size=WxH` in the block. */
            defaults: { width: w, height: h },
            fill,
            skeleton: seedlingSkeletonSpec(kind),
            elements,
            bounds: { obstacleTarget: COUNT, triesPerStep: 8, saturationK: 3,
                anchorTriesPerCandidate: 1 },
        });
        /**
         * ⛔⛔ **THE HARNESS'S LABEL AGAINST THE RECORD'S OWN ROOM.** This row
         * exists because the census's first build passed `width`/`height` keys
         * `generateSeedlingLevel` does not take, so every cell of the size axis
         * ran at 10x10 while the harness labelled half of them `20x20` — and
         * the DENSITY BLOCK is what caught it, because the block reads the
         * RECORD and the column read the ASK. ⇒ the disagreement is a named
         * refusal now, not a table nobody could tell was inert.
         */
        if (out.record.width !== w || out.record.height !== h) {
            throw new Error(`census-seedling-density: the cell asked for ${w}x${h} and the `
                + `RECORD is ${out.record.width}x${out.record.height} — the size axis is not `
                + 'reaching the generator, and every row of this table would be a 10x10 room '
                + 'wearing another label.');
        }
        const tiles = out.record.layers.find((l) => l.name === 'tiles').tiles.length;
        let ground = 0;
        for (let ty = 0; ty < out.record.height; ty += 1) {
            for (let tx = 0; tx < out.record.width; tx += 1) {
                if (terrainAt(out.record, tx, ty) === 'ground') ground += 1;
            }
        }
        row = {
            kind, size: sizeLabel, fill, arm: armName, seed: Number(seedText),
            /** ⛔ THE BLOCK IS SPELLED BY THE SHIPPED FUNCTION, on this run's own
             *  record and resolved head — the same call the CLI and both pages
             *  make. A census that re-spelled it would be measuring a fifth
             *  answer to "what is this level". */
            block: densityBlock({
                skeleton: seedlingSkeletonSpec(kind),
                width: out.record.width,
                height: out.record.height,
                fill,
                element: out.model.elementHead ?? null,
                obstacleTarget: COUNT,
            }),
            cells: out.record.width * out.record.height,
            written: tiles,
            ground,
            kept: out.summary?.keptCount ?? 0,
            target: COUNT,
            elemRan: out.summary?.elements?.ran ?? false,
            elemHead: out.model.elementHead?.name ?? null,
            elemRefusal: out.summary?.elements?.refused?.reason ?? null,
        };
    } catch (e) {
        row = { kind, size: sizeLabel, fill, arm: armName, seed: Number(seedText),
            error: { name: e.name, message: String(e.message).slice(0, 300) } };
    }
    say(JSON.stringify(row));
    process.exit(0);
}

/* ══════════════════════════════════════════════════════════════════════
 * THE HARNESS
 * ══════════════════════════════════════════════════════════════════════ */

const cells = [];
for (const kind of KINDS) {
    for (const size of SIZES) {
        for (const fill of FILLS) {
            for (const armName of ARMS) {
                for (const seed of SEEDS) cells.push({ kind, size, fill, arm: armName, seed });
            }
        }
    }
}

const COMMAND = `node scripts/procgen/census-seedling-density.mjs --kinds=${KINDS.join(',')} `
    + `--sizes=${SIZES.map((s) => s.label).join(',')} --fills=${FILLS.join(',')} `
    + `--elements=${ARMS.join(',')} --seeds=${SEEDS[0]}-${SEEDS[SEEDS.length - 1]} `
    + `--biome=${BIOME} --count=${COUNT} --cellbudget=${CELL_BUDGET_S}`;

say('# SEEDLING DENSITY CENSUS — what each position of the dial buys');
say('');
say(`command: \`${COMMAND}\``);
say('');
say(`kinds:    ${KINDS.join(', ')}`);
say(`sizes:    ${SIZES.map((s) => s.label).join(', ')}`);
say(`fills:    ${FILLS.join(', ')}`);
say(`elements: ${ARMS.join(', ')} — \`default\` is the BIOME's own \`+\` list, \`none\` is `
    + 'no element at all');
say(`seeds:    ${SEEDS.join(', ')} (${SEEDS.length})   biome: ${BIOME}   `
    + `obstacleTarget: ${COUNT} (HELD FIXED)`);
say(`cells:    ${cells.length}, one CHILD PROCESS each, capped at ${CELL_BUDGET_S} s`);
say('');
say('⛔ NOT SWEPT, and named: `chambers` rides INSIDE a kind here (`winding;chambers=2` is a');
say('   kind, as in every other Seedling census) and `obstacleTarget` is HELD FIXED — it is a');
say('   lever of the block, but `sweep-yield-table.mjs` already owns the column that sweeps it.');
say('');
if (has('estimate-only')) process.exit(0);

const results = [];
const denom = { attempted: 0, completed: 0, timedOut: 0, threw: 0, harnessFailed: 0 };
for (const c of cells) {
    denom.attempted += 1;
    note(`[stderr] ${c.kind} ${c.size.label} ${c.fill} ${c.arm} seed ${c.seed} `
        + `(${denom.attempted}/${cells.length})…`);
    let stdout = null;
    let killed = false;
    try {
        stdout = execFileSync(process.execPath, [SELF,
            `--cell=${c.kind}|${c.size.label}|${c.fill}|${c.arm}|${c.seed}`,
            `--biome=${BIOME}`, `--count=${COUNT}`], {
            encoding: 'utf8', timeout: CELL_BUDGET_S * 1000, maxBuffer: 64 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch (e) {
        killed = e.killed === true || e.signal === 'SIGTERM';
        stdout = e.stdout ?? null;
    }
    if (killed) {
        denom.timedOut += 1;
        results.push({ ...c, size: c.size.label, aborted: 'TIMEOUT' });
        continue;
    }
    let row = null;
    try { row = JSON.parse((stdout ?? '').trim().split('\n').filter(Boolean).pop() ?? ''); }
    catch { row = null; }
    if (!row) { denom.harnessFailed += 1; results.push({ ...c, size: c.size.label, aborted: 'HARNESS' }); continue; }
    if (row.error) { denom.threw += 1; note(`[stderr]   THREW ${row.error.name}: ${row.error.message}`); }
    else denom.completed += 1;
    results.push(row);
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const one = (n) => (Math.round(n * 10) / 10);

say('## Every cell — the BLOCK, and the four numbers it moved');
say('');
say('| density block | written | ground | kept/target | element |');
say('|---|---|---|---|---|');
for (const r of results) {
    if (r.aborted || r.error) {
        say(`| \`${r.kind} ${r.size} ${r.fill} ${r.arm} seed ${r.seed}\` | ⛔ `
            + `${r.aborted ?? `THREW ${r.error.name}`} | | | |`);
        continue;
    }
    say(`| \`${r.block}\` s${r.seed} | ${r.written}/${r.cells} (${pct(r.written, r.cells)}) `
        + `| ${r.ground} | ${r.kept}/${r.target} | `
        + `${r.elemRan ? `**${r.elemHead}**` : `⛔ ${r.elemRefusal ?? 'none'}`} |`);
}
say('');

const ok = results.filter((r) => !r.aborted && !r.error);
say('## The roll-up — one row per DIAL POSITION, over the seeds and kinds');
say('');
say('| size | fill | elements | written | ground | kept/target | element placed |');
say('|---|---|---|---|---|---|---|');
for (const size of SIZES) {
    for (const fill of FILLS) {
        for (const armName of ARMS) {
            const g = ok.filter((r) => r.size === size.label && r.fill === fill
                && r.arm === armName);
            if (!g.length) continue;
            say(`| ${size.label} | ${fill} | ${armName} `
                + `| ${one(mean(g.map((r) => r.written)))} of ${g[0].cells} `
                + `(${pct(mean(g.map((r) => r.written)), g[0].cells)}) `
                + `| ${one(mean(g.map((r) => r.ground)))} `
                + `| ${one(mean(g.map((r) => r.kept)))}/${COUNT} `
                + `| ${g.filter((r) => r.elemRan).length}/${g.length} |`);
        }
    }
}
say('');
say(`denominators: attempted ${denom.attempted}, completed ${denom.completed}, `
    + `TIMED OUT ${denom.timedOut}, THREW ${denom.threw}, harness-failed ${denom.harnessFailed}`);

if (JSON_OUT) {
    mkdirSync(dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, JSON.stringify({ command: COMMAND, denom, results }, null, 2));
    note(`[stderr] wrote ${JSON_OUT}`);
}
