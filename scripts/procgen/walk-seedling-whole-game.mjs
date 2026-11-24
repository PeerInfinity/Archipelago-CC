#!/usr/bin/env node
/**
 * The whole-game Seedling walk, as a measure: N/48 and where it stopped.
 *
 * Runs `npm test -- --mode=test-substrates --batch=tutorials-seedling-whole-game`
 * with the walk instrument switched on (tutorialTests.js § The walk instrument:
 * the TEST_MEASURE_* env vars), reads the walk's `[MEASURE end]` line and prints
 * ONE summary line:
 *
 *   24/48, stop: entry 24 "Level 089 - Feather" in level_58__r3c3, cause: refusal "error: …" (walk 3001 s, run 3020 s)
 *
 * The row itself reads PASSED whatever happens (the ratchet grades it against
 * `firstFailingStep: 'bot-plays'`), so PASSED is not the result: the summary is.
 *
 * Usage:
 *   node scripts/procgen/walk-seedling-whole-game.mjs [--seed=1] [--runtime=wasm|js]
 *        [--budget-s=10800] [--stall-s=300] [--skip-refusals=0] [--port=8000]
 *        [--wait-for-box=<sec>] [--min=N] [--log=<path>] [--python=python]
 *
 *   From the tree root, the venv active, a dev server on --port (default: the harness's, 8000).
 *   --seed=N         the Seedling Playthrough seed the walk plays (default 1, the committed preset).
 *                    Another seed is GENERATED into the tree (Generate.py, "Templates/Seedling Playthrough.yaml")
 *                    and REVERTED afterwards: preset_files.json put back, the new preset dir and its
 *                    output/AP_<id>.zip deleted. A seed whose preset dir already exists is used as it is.
 *   --runtime=       the Flash runtime the walk plays under (session override). Unset = the app's setting.
 *   --budget-s=      the bot-plays step's wait (TEST_MEASURE_STEP_TIMEOUT_MS); the in-app and Playwright
 *                    clocks are set above it, so the walk stops on this budget, never on the harness clock.
 *                    A step's own wait is the floor (the bot step's is 180 s).
 *   --stall-s=       the bot's stall window (TEST_MEASURE_BOT_STALL_MS; the app's default is 60 s).
 *   --skip-refusals= the skip probe (TEST_MEASURE_SKIP_REFUSALS): on a bot error, count the head as seen
 *                    and play on, K times. A lower bound on what lies past a stop; it fixes nothing.
 *   --min=N          exit 1 when fewer than N checks were reached (for later use). Otherwise: exit 0 ALWAYS —
 *                    this is a measure, not a gate; a run that measured nothing says so on its line.
 *                    (A bad argument or a failed seed generation exits 2: nothing was measured.)
 *
 * Docs: docs/json/developer/procgen/seedling-bot.md § Running the whole-game walk.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAME_DIR = 'seedling_playthrough';
const TEMPLATE = 'Templates/Seedling Playthrough.yaml';

export function parseArgs(argv) {
    const o = { seed: 1, runtime: null, budgetS: 10800, stallS: 300, skipRefusals: 0, port: null, waitForBox: null, min: null, log: null, python: 'python' };
    for (const a of argv) {
        const eq = a.indexOf('=');
        const k = eq === -1 ? a : a.slice(0, eq);
        const v = eq === -1 ? undefined : a.slice(eq + 1);
        const int = () => { if (!/^\d+$/.test(v ?? '')) throw new Error(`${k} takes a whole number, got ${v}`); return Number(v); };
        switch (k) {
            case '--seed': o.seed = int(); break;
            case '--runtime': if (!['wasm', 'js'].includes(v)) throw new Error('--runtime is wasm or js'); o.runtime = v; break;
            case '--budget-s': o.budgetS = int(); break;
            case '--stall-s': o.stallS = int(); break;
            case '--skip-refusals': o.skipRefusals = int(); break;
            case '--port': o.port = int(); break;
            case '--wait-for-box': o.waitForBox = int(); break;
            case '--min': o.min = int(); break;
            case '--log': o.log = v; break;
            case '--python': o.python = v; break;
            default: throw new Error(`unknown argument ${a}`);
        }
    }
    if (o.budgetS < 1) throw new Error('--budget-s must be at least 1');
    if (o.seed < 1) throw new Error('--seed must be at least 1');
    return o;
}

/** The env the instrument reads (app.spec.js turns each into its URL param). */
export function measureEnv(o) {
    const env = {
        TEST_MEASURE_STEP_TIMEOUT_MS: String(o.budgetS * 1000),
        TEST_MEASURE_BOT_STALL_MS: String(o.stallS * 1000),
        // Above the step budget, so the walk's own budget decides the stop.
        TEST_AUTO_START_TIMEOUT_MS: String((o.budgetS + 300) * 1000),
        TEST_TIMEOUT: String((o.budgetS + 600) * 1000),
    };
    if (o.seed !== 1) env.TEST_MEASURE_PLAYTHROUGH_SEED = String(o.seed);
    if (o.runtime) env.TEST_MEASURE_FLASH_RUNTIME = o.runtime;
    if (o.skipRefusals > 0) env.TEST_MEASURE_SKIP_REFUSALS = String(o.skipRefusals);
    return env;
}

/** `key=value` / `key="json string"` fields of one [MEASURE …] line. */
export function parseMeasureFields(line) {
    const out = {};
    const re = /(\w+)=("(?:[^"\\]|\\.)*"|\S+)/g;
    let m;
    while ((m = re.exec(line))) {
        let v = m[2];
        if (v.startsWith('"')) { try { v = JSON.parse(v); } catch { /* keep raw */ } }
        out[m[1]] = v;
    }
    return out;
}

/** The run's log → the summary's parts. null when no [MEASURE end] line was logged. */
export function summarize(log) {
    const lines = log.split(/\r?\n/);
    const endLine = lines.filter((l) => l.includes('[MEASURE end]')).at(-1);
    if (!endLine) return null;
    const f = parseMeasureFields(endLine.slice(endLine.indexOf('[MEASURE end]')));
    const skips = lines.filter((l) => /\[MEASURE skip \d+\] t=/.test(l)).length;
    const total = Number(f.botQueue);
    const cursor = Number(f.botCursor);
    const botChecked = Number(f.botChecked);
    const status = typeof f.status === 'string' ? f.status : null;
    const why = typeof f.why === 'string' ? f.why : null;
    let cause;
    if (f.walkEnd === 'complete') cause = 'none: the walk completed';
    else if (status?.startsWith('error')) cause = `refusal ${JSON.stringify(status)}`;
    // `[\s\S]`, not `.`: a quoted status may run to several lines (a ladder refusal's rung reasons, carried whole).
    else if (why && /has said [\s\S]* for \d+(\.\d+)? s/.test(why)) cause = `stall ${JSON.stringify(why)}`;
    else if (why === 'its done check never held') cause = `budget: the step's wait ran out (status ${JSON.stringify(status)})`;
    else cause = `${f.walkEnd ?? '?'} ${JSON.stringify(why ?? status)}`;
    const timing = lines.find((l) => l.includes('[tutorial-walk-timing] seedling-whole-game'));
    const botPlays = timing ? /bot-plays ([\d.]+)s/.exec(timing)?.[1] : null;
    return {
        reached: Number.isFinite(botChecked) ? botChecked - skips : null,
        skips,
        total: Number.isFinite(total) ? total : null,
        entry: Number.isFinite(cursor) ? cursor + 1 : null,
        location: f.botHead ?? null,
        region: f.botRegion ?? f.lastRegionEvent ?? null,
        transport: f.transport ?? null,
        cause,
        walkS: botPlays ? Number(botPlays) : Number.parseInt(f.t, 10),
    };
}

export function summaryLine(s, runS) {
    const n = `${s.reached ?? '?'}/${s.total ?? '?'}${s.skips ? ` (+${s.skips} skipped)` : ''}`;
    return `${n}, stop: entry ${s.entry ?? '?'} ${JSON.stringify(s.location)} in ${s.region ?? '?'}, cause: ${s.cause}`
        + ` (transport ${s.transport ?? '?'}; walk ${Number.isFinite(s.walkS) ? s.walkS.toFixed(0) : '?'} s, run ${runS.toFixed(0)} s)`;
}

const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });

function seedId(o, seed) {
    const r = spawnSync(o.python, ['-c', `import sys; sys.path.insert(0, 'scripts/lib'); from seed_utils import get_seed_id; print(get_seed_id(${seed}))`], { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`could not compute the seed id with ${o.python}: ${r.stderr}`);
    return r.stdout.trim();
}

/** Generate seed N into the tree unless its preset is there; → an undo function. */
function prepareSeed(o) {
    if (o.seed === 1) return () => {};
    const id = `AP_${seedId(o, o.seed)}`;
    const dir = path.join(ROOT, 'frontend/presets', GAME_DIR, id);
    if (fs.existsSync(dir)) { console.log(`[walk] seed ${o.seed}: ${id} is already in the tree; used as it is`); return () => {}; }
    const indexRel = 'frontend/presets/preset_files.json';
    if (git('status', '--porcelain', '--', indexRel).stdout.trim()) {
        throw new Error(`${indexRel} already has changes; the walk would not be able to put it back. Commit or revert it first.`);
    }
    const zip = path.join(ROOT, 'output', `${id}.zip`);
    const zipExisted = fs.existsSync(zip);
    const undo = () => {
        git('checkout', '--', indexRel);
        fs.rmSync(dir, { recursive: true, force: true });
        if (!zipExisted) fs.rmSync(zip, { force: true });
        console.log(`[walk] seed ${o.seed}: reverted (${indexRel} checked out; ${path.relative(ROOT, dir)} and output/${id}.zip deleted)`);
    };
    console.log(`[walk] seed ${o.seed}: generating ${id} (${TEMPLATE})`);
    const r = spawnSync(o.python, ['Generate.py', '--weights_file_path', TEMPLATE, '--multi', '1', '--seed', String(o.seed)], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0 || !fs.existsSync(dir)) { undo(); throw new Error(`Generate.py failed for seed ${o.seed} (exit ${r.status}; ${path.relative(ROOT, dir)} ${fs.existsSync(dir) ? 'exists' : 'missing'})`); }
    return undo;
}

async function main() {
    const o = parseArgs(process.argv.slice(2));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = path.resolve(ROOT, o.log ?? `test-results/whole-game-walk/walk-seed${o.seed}-${o.runtime ?? 'auto'}-${stamp}.log`);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const undo = prepareSeed(o);
    const t0 = Date.now();
    let log = '';
    let child = null;
    const onSignal = (sig) => { if (child) child.kill(sig); };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);
    try {
        const args = ['test', '--', '--mode=test-substrates', '--batch=tutorials-seedling-whole-game'];
        if (o.port) args.push(`--port=${o.port}`);
        if (o.waitForBox != null) args.push(`--wait-for-box=${o.waitForBox}`);
        const env = { ...process.env, ...measureEnv(o) };
        console.log(`[walk] npm ${args.join(' ')}  env ${Object.entries(measureEnv(o)).map(([k, v]) => `${k}=${v}`).join(' ')}`);
        console.log(`[walk] log: ${path.relative(ROOT, logPath)}`);
        const out = fs.createWriteStream(logPath);
        const code = await new Promise((resolve) => {
            child = spawn('npm', args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
            const take = (chunk) => {
                const s = chunk.toString();
                log += s;
                out.write(s);
                // Echo the progress the reader needs, not the thousands of browser lines.
                for (const l of s.split('\n')) if (/\[PROGRESS |\[MEASURE (tick|skip|end)|IN-APP|box/.test(l)) console.log(l.replace(/^BROWSER LOG \(log\): /, ''));
            };
            child.stdout.on('data', take);
            child.stderr.on('data', take);
            child.on('close', (c) => resolve(c));
        });
        out.end();
        const runS = (Date.now() - t0) / 1000;
        const s = summarize(log);
        if (!s) {
            console.log(`no [MEASURE end] line: the walk never ran its bot step (npm test exit ${code}; run ${runS.toFixed(0)} s) — read ${path.relative(ROOT, logPath)}`);
            return o.min != null ? 1 : 0;
        }
        console.log(summaryLine(s, runS));
        return o.min != null && (s.reached ?? 0) < o.min ? 1 : 0;
    } finally {
        undo();
    }
}

if (isEntryPoint(import.meta.url)) {
    main().then((c) => process.exit(c), (e) => { console.error(`walk-seedling-whole-game: ${e.message}`); process.exit(2); });
}
