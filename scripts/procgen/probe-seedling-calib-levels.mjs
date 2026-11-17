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
 * Run:
 *   gh workflow run seedling-probe.yml --ref <branch> -f probes=probe-seedling-calib-levels.mjs
 *   node scripts/procgen/probe-seedling-calib-levels.mjs --compare=<control run id or json> --tip=<tip run id or json>
 *   node scripts/procgen/probe-seedling-calib-levels.mjs --compare=<…> --tip=<…> --moved=<level,level>
 *   node scripts/procgen/probe-seedling-calib-levels.mjs --compare=<…> --tip=<…> --expect-flag=<level>   (a mutant's check)
 *
 * ⛓ The normalisation replaces the old L12/L0 yardstick children, which timed one fixed level as the runner's speed: a
 * slice that moved that level moved its own yardstick. The median of ~100 levels does not move with any one of them.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { compareLevels, levelReport, presetLevels } from './seedlingCalibLevels.js';

argvHelp(import.meta.url);

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CALIB_FILE = 'frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.calib.test.js';
const CALIB_CONFIG = 'vitest.calib.config.js';
const PRESET = 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json';
const OUT = resolve(REPO, 'test-results/seedling-probe');
const OUT_FILE = 'calib-levels.json';

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

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const list = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${msg}`); if (!ok) fails += 1; };
const headSha = () => process.env.GITHUB_SHA
    || spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim();

async function runMode() {
    console.log('CHANNEL: headless logic-only (P3 timing probe: the calib file, one test per level; no browser)');
    const { default: config } = await import(pathToFileURL(resolve(REPO, CALIB_CONFIG)).href);
    const limitMs = config.test.testTimeout;
    const levels = presetLevels(JSON.parse(readFileSync(resolve(REPO, PRESET), 'utf8')));
    mkdirSync(OUT, { recursive: true });
    const raw = resolve(OUT, 'calib-vitest.json');
    const t0 = Date.now();
    const r = spawnSync('npx', ['vitest', 'run', '--config', CALIB_CONFIG, CALIB_FILE,
        '--reporter=default', '--reporter=json', `--outputFile.json=${raw}`], { cwd: REPO, stdio: 'inherit' });
    const wallS = (Date.now() - t0) / 1000;
    if (!existsSync(raw)) {
        check(false, `vitest wrote its JSON report (rc=${r.status} signal=${r.signal}, none at ${raw})`);
        return;
    }
    const rep = levelReport(JSON.parse(readFileSync(raw, 'utf8')), levels);
    check(rep.problems.length === 0, `every one of the preset's ${levels.length} levels has exactly one test (${rep.problems.join('; ') || 'none off'})`);
    for (const row of rep.levels) check(row.status === 'passed', `${row.level} ${row.status} ${row.ms ?? '-'} ms`);
    for (const t of rep.others) check(t.status === 'passed', `${t.title} ${t.status} ${t.ms} ms`);
    const all = [...rep.levels.filter((x) => Number.isFinite(x.ms)).map((x) => ({ name: x.level, ms: x.ms })),
        ...rep.others.map((t) => ({ name: t.title, ms: t.ms }))].sort((a, b) => b.ms - a.ms);
    const heaviest = all[0];
    check(heaviest && heaviest.ms < limitMs, `the heaviest test is inside the config's testTimeout (${heaviest?.name} ${heaviest?.ms} ms < ${limitMs} ms)`);
    for (const row of [...rep.levels].filter((x) => Number.isFinite(x.ms)).sort((a, b) => b.ms - a.ms)) console.log(`MEASURED: level ${row.level} ms=${row.ms}`);
    const sum = rep.levels.reduce((a, x) => a + (x.ms ?? 0), 0);
    console.log(`MEASURED: calib file rc=${r.status} wall ${wallS.toFixed(1)} s, level tests sum ${(sum / 1000).toFixed(1)} s, ${rep.levels.length} levels + ${rep.others.length} other tests, nproc ${cpus().length}`);
    if (heaviest) console.log(`MEASURED: heaviest test ${heaviest.name} ${(heaviest.ms / 1000).toFixed(1)} s of the ${limitMs / 1000} s testTimeout (${(100 * (1 - heaviest.ms / limitMs)).toFixed(1)}% headroom)`);
    const doc = { probe: 'probe-seedling-calib-levels', headSha: headSha(), limitMs, wallS, rc: r.status, nproc: cpus().length,
        levels: rep.levels, others: rep.others };
    writeFileSync(resolve(OUT, OUT_FILE), `${JSON.stringify(doc, null, 1)}\n`);
    console.log(`MEASURED: wrote ${OUT_FILE} (${rep.levels.length} levels) at ${doc.headSha}`);
    check(r.status === 0, `the calib file is green (rc=${r.status})`);
}

/** A side of a comparison: a path to a calib-levels.json, or a run id whose artifact `gh run download` fetches. */
function loadSide(spec, label) {
    if (/^[0-9]+$/.test(spec)) {
        const dir = mkdtempSync(join(tmpdir(), `calib-levels-${spec}-`));
        const r = spawnSync('gh', ['run', 'download', spec, '-p', '*-log', '-D', dir], { cwd: REPO, encoding: 'utf8' });
        if (r.status !== 0) throw new Error(`${label}: gh run download ${spec} failed: ${(r.stderr || '').trim()}`);
        const found = [];
        const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f === OUT_FILE) found.push(p); } };
        walk(dir);
        if (found.length !== 1) throw new Error(`${label}: run ${spec} holds ${found.length} ${OUT_FILE} files (want 1)`);
        return { ...JSON.parse(readFileSync(found[0], 'utf8')), source: `run ${spec}` };
    }
    return { ...JSON.parse(readFileSync(resolve(spec), 'utf8')), source: spec };
}

function compareMode() {
    console.log('CHANNEL: headless logic-only (P3 timing probe: compare two calib-levels.json; runs nothing)');
    const control = loadSide(arg('compare'), 'control');
    const tip = loadSide(arg('tip') ?? '', 'tip');
    const moved = list(arg('moved'));
    const expect = arg('expect-flag') !== undefined ? list(arg('expect-flag')) : [];
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
