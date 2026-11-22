#!/usr/bin/env node
/**
 * Seedling P3 TIMING PROBE: the calib scripted pass, timed per level, and a tip compared with a control. Every
 * engineMd5 mover owes a P3 pass (did it slow any level down?); this is the one probe that runs and reads it, in
 * place of a branch-only copy per slice. The pure half is `seedlingCalibLevels.js`.
 *
 * RUN mode (no `--compare`): runs `deriveLevelWorldLogic.calib.test.js` under `vitest.calib.config.js` with vitest's
 * JSON reporter, and prints a `PASS:`/`FAIL:` row per level (its `it` green), one per other test (the coverage and
 * whole-verdict tests), one for the level ↔ test correspondence and one for the heaviest test inside the config's
 * `testTimeout` (read from the config, never typed). `MEASURED:` lines give each level's ms (heaviest first), the wall
 * clock and the heaviest test's headroom. The run is written to `test-results/seedling-probe/calib-levels.json` (the
 * seedling-probe.yml artifact dir): the head SHA, the limit, each level's ms and status, the other tests.
 *
 * COMPARE mode (`--compare=<control>`, with `--tip=<tip>`): reads two such files and runs nothing. Each side is a path
 * to a `calib-levels.json`, or a seedling-probe.yml RUN ID whose artifact `gh run download` fetches (so the two CI runs
 * are compared without copying files about). Per level: ratio = tip ms / control ms, normalised by the MEDIAN ratio of
 * the reference levels (every level, minus the ones `--moved` names, minus those under `FLOOR_MS` in the control). A
 * level whose normalised ratio is over `THRESHOLD`, and that costs at least `FLOOR_MS` in the control, is FLAGGED by
 * name. `PASS:` when the flagged set is empty, or, with `--expect-flag=<a,b>`, exactly that set (a mutant's check).
 * The comparison is arithmetic over two artifacts, so it runs anywhere; only RUN mode belongs on CI.
 *
 * THE MEDIAN VERDICT: the per-level FLAG divides by the median, so a slowdown that hits EVERY level by the same factor
 * moves only the median and flags nothing. So the median ratio itself is judged against the band of medians that
 * main-vs-main pairs measured (`medianBand`, its data below), and a `WARN:` line names a median outside it. Two
 * kinds of pair, two bands:
 *   - UNPAIRED (two CI jobs, one per side): the two runners differ in speed, and that difference IS the median. Its
 *     band is wide, so the WARN catches only a gross uniform slowdown, and it is a warning, not a failed check.
 *   - PAIRED (`--paired=<control ref>` in RUN mode): ONE job checks out the control as a second tree and runs the calib
 *     file in both, on the same runner, so the runner's speed cancels. Its band is narrow, and a median outside it is
 *     a FAILED check row. The job writes both sides and runs the comparison itself (so `--moved`, `--expect-flag` and
 *     `--expect-median` go to the run too). `--paired-tip=<ref>` checks the tip out as a tree as well (default: this
 *     checkout); `--paired-order=sequential|abba|concurrent` and `--paired-first=control|tip` say how (`pairedRun`).
 *     Until an order's band rests on PAIRED_MIN_PAIRS pairs it is PROVISIONAL and warns only.
 *     A paired artifact compares again with `--compare=<run id>` and no `--tip`.
 * `--expect-median=slower|faster|inside` adds a check row for an expected median verdict (a mutant's check), either kind.
 *
 * Run:
 *   gh workflow run seedling-probe.yml --ref <branch> -f probes=probe-seedling-calib-levels.mjs
 *   node scripts/procgen/probe-seedling-calib-levels.mjs --compare=<control run id or json> --tip=<tip run id or json>
 *   node scripts/procgen/probe-seedling-calib-levels.mjs --compare=<…> --tip=<…> --moved=<level,level>
 *   node scripts/procgen/probe-seedling-calib-levels.mjs --compare=<…> --tip=<…> --expect-flag=<level>   (a mutant's check)
 *   gh workflow run seedling-probe.yml --ref <branch> -f probes=probe-seedling-calib-levels.mjs -f args=--paired=<control sha>
 *   gh workflow run seedling-probe.yml --ref <branch> -f probes=probe-seedling-calib-levels.mjs -f args="--paired=<sha> --paired-tip=<sha> --paired-order=abba --paired-first=tip"
 *   node scripts/procgen/probe-seedling-calib-levels.mjs --compare=<paired run id>
 *   node scripts/procgen/probe-seedling-calib-levels.mjs --compare=<…> --tip=<…> --expect-median=slower   (a uniform mutant's check)
 *
 * ⛓ The normalisation replaces the old L12/L0 yardstick children, which timed one fixed level as the runner's speed: a
 * slice that moved that level moved its own yardstick. The median of ~100 levels does not move with any one of them.
 */
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { compareLevels, isAbbreviatedSha, levelReport, medianBand, medianVerdict, mergeReports, presetLevels } from './seedlingCalibLevels.js';

argvHelp(import.meta.url);

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CALIB_FILE = 'frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.calib.test.js';
const CALIB_CONFIG = 'vitest.calib.config.js';
const PRESET = 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json';
const OUT = resolve(REPO, 'test-results/seedling-probe');
const OUT_FILE = 'calib-levels.json';
const CONTROL_FILE = 'calib-levels-control.json'; // a PAIRED run's control side (its tip side is OUT_FILE)

/**
 * The flag rule, from measured main-vs-main runs (session tile-p3-probe; runs 43779970506, 43779978397, 43779985847,
 * all at 27bc98c8b6, every ordered pair): a level is rated only if it costs at least FLOOR_MS in the control, and
 * flagged when its normalised ratio exceeds THRESHOLD.
 *   FLOOR_MS: under it the ratio is timer noise (worst normalised 1.649 with no floor: a 28 ms / 18 ms level); at 100 ms
 *     the worst is 0.797–1.255, no wider than at 1,000 or 3,000 ms, and 36–44 levels are rated instead of 13. Every
 *     unrated level is under it, so together they are a few seconds of the pass and cannot threaten the testTimeout.
 *   THRESHOLD: 1 + twice the worst measured excess (0.255). A 2× mutant on the median-cost rated level (level_46,
 *     run 43783223328 at 4384c84d4f) flagged at 1.841–2.048 against each control, and nothing else did.
 * ⚠ The noise band is set by the BIG levels too (level_16 at 1.255), so a slowdown under ~1.25× of one level is not
 * visible to one tip/control pair: run two of each rather than lower THRESHOLD. Re-derive both as main runs accumulate.
 */
export const FLOOR_MS = 100;
export const THRESHOLD = 1.5;

/**
 * The medians main-vs-main pairs measured (tip median ratio, either way round: `medianBand` folds m and 1/m), one per
 * pair of runs of the same code, and the band `medianBand` derives from them (hi = 1 + 2 × the worst excess).
 *   UNPAIRED (two jobs): 43779970506, 43779978397, 43779985847 (all at 27bc98c8b6) and 43785541082 (0b8dc816f1, the
 *     same tree but for the probe's own files), every pair: 0.961 1.574 1.588 0.843 0.868 0.545. Worst 1.835 → band
 *     0.375–2.670. The runners alone differ by up to 1.84×, so a uniform slowdown under that is invisible to two jobs.
 *   PAIRED (one job, both sides), one list PER `--paired-order` (each order has its own noise): none measured yet.
 *     A band on fewer than PAIRED_MIN_PAIRS pairs is PROVISIONAL: it prints a `WARN:` and fails nothing; with no pair the
 *     paired verdict is not given at all.
 */
export const UNPAIRED_MAIN_MEDIANS = [0.961, 1.574, 1.588, 0.843, 0.868, 0.545];
export const PAIRED_MAIN_MEDIANS = { sequential: [], abba: [], concurrent: [] };
export const PAIRED_MIN_PAIRS = 3;

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const list = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${msg}`); if (!ok) fails += 1; };
const headSha = () => process.env.GITHUB_SHA
    || spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim();

const pre = (tag) => (tag ? `${tag} ` : '');
const vitestArgs = (raw) => ['vitest', 'run', '--config', CALIB_CONFIG, CALIB_FILE,
    '--reporter=default', '--reporter=json', `--outputFile.json=${raw}`];

/** A tree's limit (its own `vitest.calib.config.js`, never typed) and its preset's levels. */
async function treeInputs(dir) {
    const { default: config } = await import(pathToFileURL(resolve(dir, CALIB_CONFIG)).href);
    return { limitMs: config.test.testTimeout, levels: presetLevels(JSON.parse(readFileSync(resolve(dir, PRESET), 'utf8'))) };
}

/**
 * One finished calib run, read out of vitest's JSON report at `raw`: its check rows and `MEASURED:` lines (each
 * prefixed by `tag`, a paired side's name; '' prints RUN mode's rows as they always were), and the doc to write.
 */
function readRun({ raws, rs, wallS, levels, limitMs, sha, tag = '' }) {
    const reps = [];
    for (const [i, raw] of raws.entries()) {
        if (!existsSync(raw)) {
            check(false, `${pre(tag)}vitest wrote its JSON report (rc=${rs[i].status} signal=${rs[i].signal}, none at ${raw})`);
            return null;
        }
        reps.push(levelReport(JSON.parse(readFileSync(raw, 'utf8')), levels));
    }
    const rep = reps.length === 1 ? reps[0] : mergeReports(reps);
    const r = { status: rs.find((x) => x.status !== 0)?.status ?? 0 };
    check(rep.problems.length === 0, `${pre(tag)}every one of the preset's ${levels.length} levels has exactly one test (${rep.problems.join('; ') || 'none off'})`);
    for (const row of rep.levels) check(row.status === 'passed', `${pre(tag)}${row.level} ${row.status} ${row.ms ?? '-'} ms`);
    for (const t of rep.others) check(t.status === 'passed', `${pre(tag)}${t.title} ${t.status} ${t.ms} ms`);
    const all = [...rep.levels.filter((x) => Number.isFinite(x.ms)).map((x) => ({ name: x.level, ms: x.ms })),
        ...rep.others.map((t) => ({ name: t.title, ms: t.ms }))].sort((a, b) => b.ms - a.ms);
    const heaviest = all[0];
    check(heaviest && heaviest.ms < limitMs, `${pre(tag)}the heaviest test is inside the config's testTimeout (${heaviest?.name} ${heaviest?.ms} ms < ${limitMs} ms)`);
    for (const row of [...rep.levels].filter((x) => Number.isFinite(x.ms)).sort((a, b) => b.ms - a.ms)) console.log(`MEASURED: ${pre(tag)}level ${row.level} ms=${row.ms}`);
    const sum = rep.levels.reduce((a, x) => a + (x.ms ?? 0), 0);
    console.log(`MEASURED: ${pre(tag)}calib file rc=${r.status} wall ${wallS.toFixed(1)} s, level tests sum ${(sum / 1000).toFixed(1)} s, ${rep.levels.length} levels + ${rep.others.length} other tests, nproc ${cpus().length}`);
    if (heaviest) console.log(`MEASURED: ${pre(tag)}heaviest test ${heaviest.name} ${(heaviest.ms / 1000).toFixed(1)} s of the ${limitMs / 1000} s testTimeout (${(100 * (1 - heaviest.ms / limitMs)).toFixed(1)}% headroom)`);
    return { probe: 'probe-seedling-calib-levels', headSha: sha, limitMs, wallS, rc: r.status, nproc: cpus().length,
        levels: rep.levels, others: rep.others };
}

async function runMode() {
    console.log('CHANNEL: headless logic-only (P3 timing probe: the calib file, one test per level; no browser)');
    if (arg('paired') !== undefined) return pairedRun(arg('paired'));
    const { limitMs, levels } = await treeInputs(REPO);
    mkdirSync(OUT, { recursive: true });
    const raw = resolve(OUT, 'calib-vitest.json');
    const t0 = Date.now();
    const r = spawnSync('npx', vitestArgs(raw), { cwd: REPO, stdio: 'inherit' });
    const doc = readRun({ raws: [raw], rs: [r], wallS: (Date.now() - t0) / 1000, levels, limitMs, sha: headSha() });
    if (!doc) return;
    writeFileSync(resolve(OUT, OUT_FILE), `${JSON.stringify(doc, null, 1)}\n`);
    console.log(`MEASURED: wrote ${OUT_FILE} (${doc.levels.length} levels) at ${doc.headSha}`);
    check(r.status === 0, `the calib file is green (rc=${r.status})`);
}

const git = (args, cwd = REPO) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const NO_SUBMODULE = ['frontend/modules/flashPanel/wasm']; // the Seedling binaries (358 MB): the logic-only calib file never reads them

/**
 * A second tree for one side of a PAIRED run: `ref` resolved here or fetched from origin (a CI checkout is one commit
 * deep), a detached worktree under `dir`, its submodules but the wasm builds, and its own `npm ci` (its own lockfile).
 */
function prepareTree(ref, dir, label) {
    let sha = git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).stdout.trim();
    if (!sha) {
        // GitHub serves a one-commit fetch for a full SHA or a ref name, never for an abbreviated SHA.
        if (isAbbreviatedSha(ref)) throw new Error(`${label}: ${ref} is an abbreviated SHA this checkout does not hold; pass the full 40-character SHA (or a branch name)`);
        const f = git(['fetch', '--no-tags', '--depth=1', 'origin', ref]);
        if (f.status !== 0) throw new Error(`${label}: git fetch origin ${ref} failed: ${f.stderr.trim()}`);
        sha = git(['rev-parse', 'FETCH_HEAD']).stdout.trim();
    }
    const w = git(['worktree', 'add', '--detach', dir, sha]);
    if (w.status !== 0) throw new Error(`${label}: git worktree add ${dir} ${sha} failed: ${w.stderr.trim()}`);
    const paths = git(['config', '-f', '.gitmodules', '--get-regexp', '\\.path$'], dir).stdout.split('\n')
        .map((l) => l.split(' ')[1]).filter((p) => p && !NO_SUBMODULE.includes(p));
    if (paths.length) {
        let s = git(['submodule', 'update', '--init', '--depth=1', '--', ...paths], dir);
        if (s.status !== 0) s = git(['submodule', 'update', '--init', '--', ...paths], dir);
        if (s.status !== 0) throw new Error(`${label}: git submodule update failed: ${s.stderr.trim()}`);
    }
    const n = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir, encoding: 'utf8' });
    if (n.status !== 0) throw new Error(`${label}: npm ci failed (rc=${n.status}): ${(n.stderr || '').trim().split('\n').slice(-3).join(' | ')}`);
    return { dir, sha, ref };
}

/** One side's calib run as a child whose output goes to `log` (two at once would interleave on the console). */
function runSide(side, raw, log) {
    return new Promise((done) => {
        const fd = openSync(log, 'w');
        const t0 = Date.now();
        const c = spawn('npx', vitestArgs(raw), { cwd: side.dir, stdio: ['ignore', fd, fd] });
        const end = (status, signal) => { closeSync(fd); done({ status, signal, wallS: (Date.now() - t0) / 1000 }); };
        c.on('error', () => end(null, 'spawn-error'));
        c.on('close', end);
    });
}

/**
 * PAIRED: the control (and, with `--paired-tip`, the tip) checked out as trees beside this one, the calib file run in
 * both inside ONE job, so the runner's speed is the same on both sides; then the comparison, here. `--paired-order`:
 *   sequential — first, then second (drift inside the job lands on one side);
 *   abba       — first, second, second, first: each tree runs twice, each level's ms is the mean of its two runs, so a
 *                drift linear in time cancels (four passes: the job's 90 min bounds it, so the wall is printed);
 *   concurrent — both at once (the runner's cores are shared; `nproc` and the CPU model are printed).
 * `--paired-first=control|tip` (default control) says which side starts, so a slot bias can be measured both ways.
 */
async function pairedRun(controlRef) {
    const order = arg('paired-order') ?? 'sequential';
    if (!['sequential', 'abba', 'concurrent'].includes(order)) throw new Error(`--paired-order is sequential, abba or concurrent (got ${order})`);
    const first = arg('paired-first') ?? 'control';
    if (!['control', 'tip'].includes(first)) throw new Error(`--paired-first is control or tip (got ${first})`);
    const tipRef = arg('paired-tip');
    mkdirSync(OUT, { recursive: true });
    const work = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'calib-paired-'));
    const t0 = Date.now();
    const control = prepareTree(controlRef, join(work, 'control'), 'control');
    const tip = tipRef ? prepareTree(tipRef, join(work, 'tip'), 'tip') : { dir: REPO, sha: headSha(), ref: 'this checkout' };
    const S = { control: { ...control, tag: 'control', runs: [] }, tip: { ...tip, tag: 'tip', runs: [] } };
    for (const s of Object.values(S)) Object.assign(s, await treeInputs(s.dir));
    const [A, B] = first === 'control' ? [S.control, S.tip] : [S.tip, S.control];
    console.log(`MEASURED: paired control ${control.ref} @ ${control.sha}; tip ${tip.ref} @ ${tip.sha}; order ${order}, ${first} first; nproc ${cpus().length} (${cpus()[0]?.model ?? '?'}); trees ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const one = async (s) => {
        const k = s.runs.length + 1;
        const raw = resolve(OUT, `calib-vitest-${s.tag}-${k}.json`);
        const res = await runSide(s, raw, resolve(OUT, `calib-vitest-${s.tag}-${k}.log`));
        console.log(`MEASURED: paired ${s.tag} pass ${k} rc=${res.status} wall ${res.wallS.toFixed(1)} s (at +${((Date.now() - t0) / 1000).toFixed(0)} s)`);
        s.runs.push({ raw, res });
    };
    if (order === 'concurrent') await Promise.all([one(A), one(B)]);
    else for (const s of order === 'abba' ? [A, B, B, A] : [A, B]) await one(s);
    const pairId = process.env.GITHUB_RUN_ID ? `run ${process.env.GITHUB_RUN_ID}` : `local ${new Date(t0).toISOString()}`;
    const docs = [S.control, S.tip].map((s) => {
        const doc = readRun({ raws: s.runs.map((x) => x.raw), rs: s.runs.map((x) => x.res), wallS: s.runs.reduce((a, x) => a + x.res.wallS, 0),
            levels: s.levels, limitMs: s.limitMs, sha: s.sha, tag: s.tag });
        if (doc) doc.paired = { pairId, order, first, side: s.tag, passes: s.runs.length, controlSha: control.sha, tipSha: tip.sha };
        return doc;
    });
    for (const s of [S.control, S.tip]) {
        const bad = s.runs.filter((x) => x.res.status !== 0).map((x) => x.res.status);
        check(bad.length === 0, `${s.tag} the calib file is green on every pass (${s.runs.length} passes; rc ${s.runs.map((x) => x.res.status).join(',')})`);
    }
    if (!docs[0] || !docs[1]) return;
    writeFileSync(resolve(OUT, CONTROL_FILE), `${JSON.stringify(docs[0], null, 1)}\n`);
    writeFileSync(resolve(OUT, OUT_FILE), `${JSON.stringify(docs[1], null, 1)}\n`);
    console.log(`MEASURED: wrote ${CONTROL_FILE} @ ${control.sha} and ${OUT_FILE} @ ${tip.sha} (paired, ${pairId}, ${order}, ${first} first); job wall so far ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    compareDocs({ ...docs[0], source: `paired control (${pairId})` }, { ...docs[1], source: `paired tip (${pairId})` });
}

/**
 * A side of a comparison: a path to a calib-levels.json (or to a directory holding one), or a run id whose artifact
 * `gh run download` fetches. `file` picks which side of a PAIRED artifact (the control is CONTROL_FILE).
 */
const downloaded = new Map();
function loadSide(spec, label, file = OUT_FILE) {
    if (/^[0-9]+$/.test(spec)) {
        if (!downloaded.has(spec)) {
            const dir = mkdtempSync(join(tmpdir(), `calib-levels-${spec}-`));
            const r = spawnSync('gh', ['run', 'download', spec, '-p', '*-log', '-D', dir], { cwd: REPO, encoding: 'utf8' });
            if (r.status !== 0) throw new Error(`${label}: gh run download ${spec} failed: ${(r.stderr || '').trim()}`);
            downloaded.set(spec, dir);
        }
        const found = [];
        const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f === file) found.push(p); } };
        walk(downloaded.get(spec));
        if (found.length !== 1) throw new Error(`${label}: run ${spec} holds ${found.length} ${file} files (want 1)`);
        return { ...JSON.parse(readFileSync(found[0], 'utf8')), source: `run ${spec}` };
    }
    const path = existsSync(spec) && statSync(spec).isDirectory() ? join(spec, file) : spec;
    return { ...JSON.parse(readFileSync(resolve(path), 'utf8')), source: path };
}

function compareMode() {
    console.log('CHANNEL: headless logic-only (P3 timing probe: compare two calib-levels.json; runs nothing)');
    // No --tip: the one spec is a PAIRED run (or its directory), holding both sides.
    const pairedSpec = arg('tip') === undefined;
    const control = loadSide(arg('compare'), 'control', pairedSpec ? CONTROL_FILE : OUT_FILE);
    const tip = loadSide(pairedSpec ? arg('compare') : arg('tip'), 'tip');
    compareDocs(control, tip);
}

/** The comparison of two loaded sides: the per-level FLAG rows, then the median verdict. */
function compareDocs(control, tip) {
    const moved = list(arg('moved'));
    const expect = arg('expect-flag') !== undefined ? list(arg('expect-flag')) : [];
    const expectMedian = arg('expect-median');
    if (expectMedian !== undefined && !['slower', 'faster', 'inside'].includes(expectMedian)) throw new Error(`--expect-median is slower, faster or inside (got ${expectMedian})`);
    console.log(`MEASURED: control ${control.source} @ ${control.headSha} wall ${control.wallS?.toFixed?.(1)} s; tip ${tip.source} @ ${tip.headSha} wall ${tip.wallS?.toFixed?.(1)} s`);
    for (const [name, side] of [['control', control], ['tip', tip]]) {
        const red = [...side.levels.filter((x) => x.status !== 'passed').map((x) => x.level), ...side.others.filter((t) => t.status !== 'passed').map((t) => t.title)];
        check(red.length === 0, `the ${name} run is green on every test (red: ${red.join(' | ') || 'none'})`);
    }
    const c = compareLevels(tip, control, { moved, threshold: THRESHOLD, floorMs: FLOOR_MS });
    check(c.onlyTip.length === 0 && c.onlyControl.length === 0, `both runs time the same levels (tip only: ${c.onlyTip.join(',') || 'none'}; control only: ${c.onlyControl.join(',') || 'none'})`);
    check(c.unknownMoved.length === 0, `every --moved level is a level (unknown: ${c.unknownMoved.join(',') || 'none'})`);
    for (const r of [...c.rows].sort((a, b) => b.norm - a.norm)) {
        console.log(`MEASURED: ratio ${r.level} tip ${r.tipMs} ms / control ${r.controlMs} ms = ${r.ratio.toFixed(3)}, normalised ${r.norm.toFixed(3)}${r.moved ? ' (moved)' : ''}${r.rated ? '' : ` (under ${FLOOR_MS} ms: not rated)`}${r.flagged ? ' FLAGGED' : ''}`);
    }
    console.log(`MEASURED: median ratio ${c.median.toFixed(3)} over ${c.referenceCount} reference levels (≥ ${FLOOR_MS} ms in the control, not moved); their normalised spread ${c.spread.min.toFixed(3)}–${c.spread.max.toFixed(3)}, ${c.unflaggedSpread ? `${c.unflaggedSpread.min.toFixed(3)}–${c.unflaggedSpread.max.toFixed(3)}` : 'none'} without the flagged ones; threshold ${THRESHOLD}`);
    for (const l of c.flagged) console.log(`FLAG: ${l} normalised ${c.rows.find((r) => r.level === l).norm.toFixed(3)} > ${THRESHOLD}`);
    const same = c.flagged.length === expect.length && expect.every((l) => c.flagged.includes(l));
    check(same, `the flagged levels are ${expect.length ? `exactly the expected ${expect.join(',')}` : 'none'} (flagged: ${c.flagged.join(',') || 'none'})`);
    medianCheck(c.median, control, tip, expectMedian);
}

/**
 * The MEDIAN verdict (the header says why). Paired when both sides carry the same `paired.pairId` (one job ran both);
 * otherwise unpaired, and judged against the cross-job band.
 */
function medianCheck(med, control, tip, expectMedian) {
    const kind = control.paired && tip.paired && control.paired.pairId === tip.paired.pairId ? 'paired' : 'unpaired';
    const order = kind === 'paired' ? control.paired.order : null;
    const medians = kind === 'paired' ? (PAIRED_MAIN_MEDIANS[order] ?? []) : UNPAIRED_MAIN_MEDIANS;
    const label = kind === 'paired' ? `paired ${order}` : kind;
    const provisional = kind === 'paired' && medians.length < PAIRED_MIN_PAIRS;
    let v = null;
    if (!medians.length) console.log(`MEASURED: median verdict not given: no ${label} main-vs-main pair is on record yet (median ratio ${med.toFixed(3)})`);
    else {
        v = medianVerdict(med, medianBand(medians));
        const band = `${v.band.lo.toFixed(3)}–${v.band.hi.toFixed(3)}`;
        console.log(`MEASURED: median verdict ${label}: median ratio ${med.toFixed(3)} is ${v.direction} the ${label} main-vs-main band ${band} (${v.band.pairs} pairs, worst ${v.band.worst.toFixed(3)})${provisional ? ` PROVISIONAL: under ${PAIRED_MIN_PAIRS} pairs, so it warns only` : ''}${kind === 'unpaired' ? `; two jobs on two runners, so a uniform change inside the band is not visible (--paired sees one)` : ''}`);
        if (v.outside) console.log(`WARN: median ratio ${med.toFixed(3)} is outside the ${label} main-vs-main band ${band}: every level is ${v.direction} together, which the per-level FLAG normalises away${kind === 'unpaired' ? '; separate jobs, so re-run it PAIRED before believing it' : ''}`);
        if (kind === 'paired' && !provisional && expectMedian === undefined) check(!v.outside, `the median ratio ${med.toFixed(3)} is inside the ${label} main-vs-main band ${band} (${v.band.pairs} pairs)`);
    }
    if (expectMedian !== undefined) check(v?.direction === expectMedian, `the ${label} median verdict is the expected ${expectMedian} (${v ? v.direction : 'no band on record'})`);
}

async function main() {
    try {
        if (arg('compare') !== undefined) compareMode(); else await runMode();
    } catch (e) {
        check(false, `the probe ran (${e.message})`);
    }
    console.log(fails === 0 ? 'ALL CHECKS PASSED' : `${fails} CHECK(S) FAILED`);
    process.exit(fails === 0 ? 0 : 1);
}

if (isEntryPoint(import.meta.url)) await main();
