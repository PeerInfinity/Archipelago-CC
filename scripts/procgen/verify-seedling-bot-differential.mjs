#!/usr/bin/env node
/**
 * verify-seedling-bot-differential — replay every committed tape through
 * the REAL recompiled Seedling and compare what the game did against the
 * committed observation streams.
 *
 * This is the oracle leg of the region-atlas Phase 8 v1 rung. Brief:
 * `CC/docs/plans/seedling-bot-v1-opus-kickoff.md`.
 *
 * ── The division of labour ────────────────────────────────────────────
 * The wasm artifact is machine-local forever (there is no CI build in
 * either repo), so the observation streams it produces are COMMITTED and
 * vitest checks JS-vs-recording on every CI run. That leaves this script
 * exactly one job in its default mode: the STALENESS GATE — "the
 * committed recordings still match what the live game does". Without the
 * artifact it SKIPs (exit 0), like every other seedling verifier.
 *
 *   default        replay + compare against the committed streams
 *   --record       write the streams as ORACLE recordings (expectations/<name>.json)
 *   --only=a,b     restrict the sweep to these fixture names
 *
 * `--record` is the only thing in the repo allowed to write a
 * non-provisional expectation. `fixtures/regenerate.mjs` writes only
 * `.provisional.json`, so the two can never be confused for each other.
 *
 * The recorded stream's `transitions` are DERIVED here, not drained:
 * `botDrain` hardcodes `[]`, and the ruling's definition of an entry makes
 * it a pure function of the ticks. See `withDerivedTransitions` below for
 * where and why, and `tapeFormat.js`'s docblock for the contract.
 *
 * `--only` exists BECAUSE of that: recording a newly authored fixture
 * would otherwise rewrite every already-oracle-recorded expectation on the
 * way past, and `--record` does not compare before it writes, so a genuine
 * drift in an old fixture would be silently baked in instead of reported.
 * Narrow the write; leave the regression net alone.
 *
 * ── Prereqs ───────────────────────────────────────────────────────────
 *   - dev server on :8000 at the REPO ROOT (`python -m http.server 8000`)
 *   - the uncommitted wasm artifact at
 *     frontend/modules/flashPanel/wasm/seedling_bot_ap/
 *
 * Runs headless: WebGPU comes up on swiftshader with the same flags as
 * verify-seedling-wasm-bridge.mjs. The page needs a real user gesture to
 * start, which a Playwright click supplies.
 *
 * ⚠ TWO THINGS THIS IS SLOW AND FIDDLY ABOUT, both measured, not guessed:
 *
 * 1. **The recompiled game runs at roughly HALF A FRAME PER SECOND here**
 *    (measured 2026-07-30: 38 ticks in 80s, headless and headed alike, on
 *    software WebGPU). A 140-tick tape therefore takes ~5 minutes, and the
 *    ~18-20 `blackCover` fade frames after every world load cost ~40s on
 *    their own. Timeouts below are SCALED from the tape length for that
 *    reason; a fixed 60s deadline times out before the fade even clears
 *    and looks exactly like a dead bot. (`NO_GRAPHICS` exists in the
 *    runtime but `build_wasm_avm2.sh` does not expose it — building a
 *    graphics-less variant is the obvious speed-up if this becomes
 *    painful.)
 *
 * 2. **Each tape gets a FRESH PAGE.** The bot's `botReset` forgets the
 *    tape, but it cannot rewind the GAME — the player stays wherever the
 *    previous tape left them, so a second tape replayed on the same page
 *    starts from the wrong position and every observation after it is
 *    wrong. Reloading is the honest reset, and against a multi-minute
 *    replay the extra page load is noise.
 *
 * Run: node scripts/procgen/verify-seedling-bot-differential.mjs [--record]
 *
 * ── ⛓⛓ `--resume` — THE SWEEP IS INTERRUPTIBLE (R5 slice 11) ──────────
 *
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --resume
 *
 * A full `--win` sweep is ~2.5 hours of SERIAL browser replay and it used
 * to keep nothing: results were stdout lines and an in-memory counter, so
 * an interrupt at tape 78 threw away 78 tapes. This slice killed the sweep
 * twice — once for the `--win` channel, once because the run had gone
 * stale — and paid full price both times.
 *
 * Every tape's verdict is now appended to
 * `test-results/seedling-differential/checkpoint.jsonl` as it completes,
 * with its `{stream, status}` beside it, and `--resume` reuses a stored
 * PASS **only when its fingerprint still matches**. The fingerprint covers
 * the tape, its expectation, every `.js` under `seedlingDemo/`, the atlas,
 * and the wasm artifact's stamp — so any edit to the model invalidates the
 * checkpoint wholesale.
 *
 * ⛔ THAT BLUNTNESS IS THE POINT, and it is this slice's own finding
 * turned into a mechanism: a sweep that imported its modules before an
 * edit gates the PARENT commit, not the change (§24.2), and it happened
 * TWICE in one day. A resume that trusted a stored PASS across a model
 * edit would make that mistake silent and permanent.
 *
 * Three things are deliberately never reused: a stored FAIL (the failure
 * is what the run exists to surface), anything under `--record` (a
 * recording run must write every expectation it selects), and a verdict
 * whose cached evidence is missing.
 */

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync,
    unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

const PAGE_NAME = 'seedling_bot_ap';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);

if (!existsSync(join(ARTIFACT, 'game.html'))
    || !existsSync(join(ARTIFACT, `${PAGE_NAME}.wasm`))) {
    console.log(`SKIP: seedling bot wasm artifact not staged at ${ARTIFACT}`
        + ' — build it with ~/CC/seedling_bot_build/build_bot.sh and the'
        + ' pipeline documented in that script, then copy the deployed page here');
    process.exit(0);
}

const {
    deriveTransitions, diffObservationStreams, serializeObservationStream,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const {
    EXPECTATIONS_DIR, fixtureNames, loadExpectation, loadTape,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/fixtures/index.js'));
const {
    DEFAULT_TOLERANCE,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/botDriverV1.js'));
const {
    synthesizeLegs,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/botDriverV2.js'));
const {
    atlasLevelSource,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/levelSource.js'));
const {
    runTape, runTapeToStream,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeRunner.js'));
const {
    r1AcceptanceFindings,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/r1Acceptance.js'));
const { r2AcceptanceFindings } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/r2Acceptance.js'));
const { r2TapeSpecs } = await import(join(REPO, 'frontend/modules/seedlingDemo/r2Walk.js'));
const R2_ROUTE = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/seedlingDemo/fixtures/r2-route.json'), 'utf8'));
const { r3AcceptanceFindings } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/r3Acceptance.js'));
const { r3TapeSpecs } = await import(join(REPO, 'frontend/modules/seedlingDemo/r3Walk.js'));
const R3_ROUTE = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/seedlingDemo/fixtures/r3-route.json'), 'utf8'));
const { r4AcceptanceFindings } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/r4Acceptance.js'));
const { r5AcceptanceFindings } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/r5Acceptance.js'));
// ⛔ The declared ENCOUNTER exemption — see `r5Chain.MODEL_EXEMPT`. A
// scripted boss is not a mechanic the engine can model, so the three
// mirror checks below are AMENDED by a per-fixture declaration rather than
// skipped: the game is asserted against `mirror + earned`, which is a
// harder claim than the unamended one.
const { MODEL_EXEMPT } = await import(join(REPO, 'frontend/modules/seedlingDemo/r5Chain.js'));
// ⛔ The declared DROWN exemption — see `r5Swim.DROWN_EXPECTED`. Same
// doctrine, different assert: an armed-water pair needs one arm whose timer
// MOVED, and a declared arm that reports 0 is a RED rather than a pass.
const { drownDeclarationRosterFindings, drownFinding } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/r5Swim.js'));
const { ITEM_PROPERTIES, inventorySlotsFor } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { r4TapeSpecs } = await import(join(REPO, 'frontend/modules/seedlingDemo/r4Walk.js'));
const R4_ROUTE = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/seedlingDemo/fixtures/r4-route.json'), 'utf8'));
const {
    r1TapeSpecs,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/r1Walk.js'));
const R1_ROUTE = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/seedlingDemo/fixtures/r1-route.json'), 'utf8'));

const RECORD = process.argv.includes('--record');
/** `--only=name[,name...]` — restrict the sweep. Empty means "everything". */
const ONLY = new Set(
    process.argv.filter((a) => a.startsWith('--only='))
        .flatMap((a) => a.slice('--only='.length).split(','))
        .map((s) => s.trim())
        .filter(Boolean),
);
/**
 * `--win` drives real-GPU Windows Chrome from WSL instead of the local
 * SwiftShader Chromium. MEASURED 2026-07-30 on this box: 22.1 frames/sec
 * (Intel gen-9) versus ~0.5 on WSL software rendering — a ~44x speedup,
 * which turns a 20-minute fixture sweep into well under a minute. The
 * physics is identical either way (a deterministic tick loop does not care
 * what draws it); this only buys time. Recipe and the interop rules:
 * SWFRecomp-CC `tools/divergence/perf/WINDOWS_PLAYWRIGHT_FROM_WSL.md`.
 */
const WIN = process.argv.includes('--win');

// ── ⛓⛓ THE CHECKPOINT, R5 slice 11 ───────────────────────────────────
//
// A full `--win` sweep is ~2.5 hours of SERIAL browser replay, and until
// now it kept nothing: results existed as stdout lines and an in-memory
// counter, so an interrupt at tape 78 threw away 78 tapes. That is not a
// theoretical cost — this slice killed the sweep TWICE, once because the
// `--win` channel was needed and once because the run had gone stale, and
// paid full price both times.
//
// ⛔⛔ AND "IT HAD GONE STALE" IS THE HALF THAT MAKES A NAIVE RESUME
// DANGEROUS. This same slice found that slice 10's baseline sweep gated
// the PARENT commit, because it imported its modules before the edits
// landed — and then did it AGAIN: a run launched at 20:36 was still going
// when `r5Acceptance.js` (which this file imports) changed at 20:40. A
// resume that trusted a stored PASS would bake exactly that mistake into
// the tooling and make it silent.
//
// So the checkpoint stores a FINGERPRINT beside every result, and a stored
// PASS is reused only when the fingerprint still matches. The fingerprint
// covers everything a per-tape verdict depends on:
//
//   · the tape file's own bytes;
//   · every `.js` under `frontend/modules/seedlingDemo/` — the model, all
//     of it, because "which module does this check depend on" is not
//     answerable statically and a wrong answer here is a false green;
//   · the committed atlas the model reads levels from;
//   · the wasm artifact's size+mtime — the GAME side. Hashing 30 MB per
//     run buys nothing a stamp does not.
//
// ⇒ any edit under `seedlingDemo/` invalidates the whole checkpoint. That
// is deliberately blunt: a resume that is wrong once is worse than a
// resume that is coarse every time.
const RESUME = process.argv.includes('--resume');
const CHECKPOINT_DIR = join(REPO, 'test-results', 'seedling-differential');
const CHECKPOINT = join(CHECKPOINT_DIR, 'checkpoint.jsonl');

/** Hash the model + data the per-tape verdicts depend on. */
function modelFingerprint() {
    const h = createHash('sha256');
    const moduleDir = join(REPO, 'frontend', 'modules', 'seedlingDemo');
    for (const f of readdirSync(moduleDir).filter((n) => n.endsWith('.js')).sort()) {
        h.update(f);
        h.update(readFileSync(join(moduleDir, f)));
    }
    const atlas = join(REPO, 'frontend', 'modules', 'flashPanel', 'atlases', 'seedling-map.json');
    if (existsSync(atlas)) h.update(readFileSync(atlas));
    // ⚠ THE GAME SIDE, BY STAMP RATHER THAN BY CONTENT. A rebuilt wasm is
    // a different game and must invalidate; hashing it every run is a cost
    // with no extra safety, because the pipeline never writes the same
    // bytes with a different mtime.
    for (const f of ['game.html', `${PAGE_NAME}.wasm`]) {
        const p = join(ARTIFACT, f);
        if (!existsSync(p)) continue;
        const s = statSync(p);
        h.update(`${f}:${s.size}:${s.mtimeMs}`);
    }
    return h.digest('hex').slice(0, 16);
}
const FINGERPRINT = modelFingerprint();
/**
 * Per-tape: the model fingerprint, the tape's own bytes, AND ITS
 * EXPECTATION's.
 *
 * ⛔ THE EXPECTATION IS THE COMPARISON TARGET, so leaving it out would let
 * a `--record` of one tape invalidate that tape's verdict while a stored
 * PASS from before the re-record went on being reused. The oracle changing
 * is precisely when a cached verdict is worthless.
 */
function tapeFingerprint(name) {
    const h = createHash('sha256').update(FINGERPRINT);
    h.update(readFileSync(join(REPO, 'frontend/modules/seedlingDemo/fixtures/tapes', `${name}.json`)));
    const exp = join(EXPECTATIONS_DIR, `${name}.json`);
    // An absent expectation is itself a state the verdict depends on (the
    // tape fails by name), so it is hashed as such rather than skipped.
    h.update(existsSync(exp) ? readFileSync(exp) : 'NO-EXPECTATION');
    return h.digest('hex').slice(0, 16);
}

/**
 * Everything the checkpoint already knows, keyed by tape AND fingerprint.
 *
 * ⚠ NOT BY TAPE ALONE. Keying on the name means last-write-wins, and the
 * iteration loop this exists to serve is *edit, run, revert, run* — under
 * which last-write-wins throws away the pre-edit result that just became
 * valid again. Keyed by `tape@fp` the file is an accumulating cache across
 * model states: reverting a change makes its results reusable again,
 * because they were never overwritten. Found by testing the revert, which
 * is the case a "does the fingerprint invalidate?" test does not reach.
 */
function loadCheckpoint() {
    const out = new Map();
    if (!existsSync(CHECKPOINT)) return out;
    for (const line of readFileSync(CHECKPOINT, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
            const r = JSON.parse(line);
            if (r && r.tape && r.fp) out.set(`${r.tape}@${r.fp}`, r);
        } catch { /* a torn last line from a kill -9; ignore it */ }
    }
    return out;
}

/**
 * Append one tape's verdict. ⚠ APPEND, and one JSON object per line —
 * a rewritten whole-file state can be truncated by a kill mid-write, and
 * the thing this exists to survive is being killed.
 */
function recordCheckpoint(entry) {
    if (!existsSync(CHECKPOINT_DIR)) mkdirSync(CHECKPOINT_DIR, { recursive: true });
    appendFileSync(CHECKPOINT, `${JSON.stringify(entry)}\n`);
}

/**
 * ⛓⛓ AND THE REPLAY PAYLOAD IS CACHED TOO, which is what keeps a resumed
 * run a real gate rather than a partial one.
 *
 * The cross-tape findings (`r1AcceptanceFindings` and its five siblings)
 * take the `replayed` map and REFUSE to assert when an arm is missing —
 * "a pair asserted from one arm is not a pair". So a resume that skipped
 * tapes but kept only PASS/FAIL would turn every one of those claims into
 * a SKIP, and the run would exit 0 having checked far less than it looks
 * like. That is the shape this whole slice has been finding, and building
 * it deliberately would be worse than finding it.
 *
 * So each tape's `{stream, status}` is written beside its verdict, under
 * the fingerprint, and a reused tape puts its payload back into
 * `replayed`. A resumed run then evaluates exactly the findings a
 * contiguous one does. ⚠ ~12 MB for the full roster; `test-results/` is
 * gitignored.
 */
const payloadPath = (name) => join(CHECKPOINT_DIR, 'payloads', FINGERPRINT, `${name}.json`);
function writePayload(name, stream, status) {
    const dir = dirname(payloadPath(name));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(payloadPath(name), JSON.stringify({ stream, status }));
}
function readPayload(name) {
    try { return JSON.parse(readFileSync(payloadPath(name), 'utf8')); } catch { return null; }
}

/**
 * `--tier=fast|full` — the sweep is ~55 minutes at full, and R1's own
 * numbers are why: 31,476 ticks across 25 tapes, at a rate that swings
 * 1–25 fps BY LEVEL (the big rooms crawl; L40 measured about 1/s). An
 * iteration loop that costs an hour is one nobody runs, and a gate nobody
 * runs is a gate that is not protecting anything.
 *
 * FAST is every tape below a tick threshold — the pre-walk fixtures, the
 * collision oracles, the contrast pairs. FULL is everything, including the
 * R1 chain and both headlines, and it is what a gate run means.
 *
 * ⚠ The split is on TICK COUNT, read from each tape, not on a hand-kept
 * name list. A list would go stale the first time a fixture was added and
 * nobody thought about which tier it belonged in — and the failure mode is
 * a fast tier that silently stops covering the thing you just wrote.
 * `feedback_coincidental_predicate_rots`, avoided by construction.
 */
const TIER_ARG = process.argv.filter((a) => a.startsWith('--tier='))
    .map((a) => a.slice('--tier='.length).trim()).pop();
const TIER = TIER_ARG ?? 'full';
if (!['fast', 'full'].includes(TIER)) {
    console.error(`--tier must be fast or full, got "${TIER}"`);
    process.exit(1);
}
/** A tape longer than this is FULL-tier only. The R1 segments start at 910. */
const FAST_TIER_MAX_TICKS = 600;
const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

let failures = 0;
/**
 * ⛓ The checks made since `beginTape()`, so the checkpoint can store a
 * tape's verdict rather than just its pass/fail bit. A stored FAIL is
 * re-printed verbatim on resume — a resumed run must report the same
 * failures as the run it continues, or "resume" quietly means "forget".
 */
let tapeChecks = null;
const beginTape = () => { tapeChecks = []; };
const endTape = () => { const c = tapeChecks; tapeChecks = null; return c ?? []; };

function check(name, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures++;
    if (tapeChecks) tapeChecks.push({ name, ok, detail });
}

// Only the local (SwiftShader) path needs a browser here; --win drives
// Windows Chrome out-of-process, per tape.
const browser = WIN ? null : await chromium.launch({
    args: [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
        '--no-sandbox',
    ],
});

/**
 * Measured frame budget. The game runs at ~0.5 ticks/s here, and every
 * world load burns ~20 `blackCover` fade frames before tick 0. Scale the
 * deadline from the tape length with generous slack rather than guessing
 * a constant — under-waiting is indistinguishable from a dead bot.
 */
const SECONDS_PER_FRAME = 2.5;
const FADE_FRAMES = 25;

/**
 * ⚠ THE ROOM-LOAD FADE IS A BAND, NOT A CONSTANT — R5 slice 10.
 *
 * `blackCover` decays from `cover()`, i.e. per RENDER, while `Bot.update`'s
 * dead-frame gate samples per UPDATE. So the number of dead frames a load
 * costs is "how many renders fit inside twenty units of decay", which is not
 * the same quantity whenever the two loops are not locked 1:1. §22.6
 * measured 21 and 20 on `r5-feather`'s two loads and 20 and 19 on L38's —
 * "a constant that is a variable", named there and used here.
 *
 * The band is deliberately generous on both sides: this check exists to
 * catch a 197-frame freeze nobody modelled, not to pin a fencepost.
 */
const FADE_PER_LOAD = Object.freeze({ min: 17, max: 24 });
const deadlineFor = (tickCount) =>
    Math.ceil((tickCount + FADE_FRAMES) * SECONDS_PER_FRAME * 1000) + 60000;

/** Boot a fresh page with the bot armed-ready. Each tape gets its own. */
async function freshPage() {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    page.__logs = logs;

    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
    await page.click('#btn-start');
    await waitFor(page, 'bot callbacks registered',
        () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)));
    return page;
}

async function waitFor(page, desc, fn, timeoutMs = 120000) {
    const start = Date.now();
    let polls = 0;
    for (;;) {
        const v = await fn();
        if (v) return v;
        polls++;
        if (Date.now() - start > timeoutMs) {
            console.log('PAGE LOGS (last 30):\n' + (page.__logs ?? []).slice(-30).join('\n'));
            throw new Error(`timeout waiting for: ${desc} (${polls} polls in `
                + `${((Date.now() - start) / 1000).toFixed(1)}s)`);
        }
        await page.waitForTimeout(500);
    }
}

const botOn = (page, name, arg) => page.evaluate(
    ([n, a]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[n] !== 'function') return null;
        return a === undefined ? g[n]() : g[n](a);
    },
    [name, arg],
);

const botJsonOn = async (page, name, arg) => {
    const raw = await botOn(page, name, arg);
    if (raw === null) throw new Error(`bot.${name} returned null `
        + '(the page shim maps "" to null — a callback must never return the empty string)');
    try {
        return JSON.parse(raw);
    } catch {
        throw new Error(`bot.${name} returned non-JSON: ${raw}`);
    }
};

/**
 * Replay one tape on real-GPU Windows Chrome. The Python driver is a dumb
 * browser driver — all fixture and diff logic stays here, so the tape
 * format has exactly one implementation on the JS side.
 *
 * Windows `py.exe` cannot take Linux paths, so the driver and both JSON
 * files are staged under C:\\playwright\\ (= /mnt/c/playwright/).
 */
function replayOnWindows(name, tapeObj) {
    mkdirSync(WIN_SCRATCH_WSL, { recursive: true });
    const driverWsl = join(WIN_SCRATCH_WSL, 'seedling-bot-replay-win.py');
    writeFileSync(driverWsl, readFileSync(WIN_DRIVER));
    const tapeWsl = join(WIN_SCRATCH_WSL, `tape-${name}.json`);
    const outWsl = join(WIN_SCRATCH_WSL, `stream-${name}.json`);
    writeFileSync(tapeWsl, JSON.stringify(tapeObj));
    try { unlinkSync(outWsl); } catch { /* first run */ }

    // ⚠ `execFileSync` with a pipe means NOTHING the driver prints is
    // visible until it exits, and an R1 walk tape is ten minutes long. The
    // driver therefore rewrites a progress sidecar every second, and this
    // names it up front so a watcher knows where to look — the alternative
    // is a run whose only observable states are "still going" and "done".
    const progressWsl = join(WIN_SCRATCH_WSL, `progress-${name}.json`);
    try { unlinkSync(progressWsl); } catch { /* first run */ }
    console.log(`    progress: tail ${progressWsl}`);
    // ⚠ `execFileSync` THROWS on a non-zero exit and its `message` is only
    // the command line — so a driver that failed and printed exactly why
    // (`REPLAY_FAIL`, plus the last 25 page log lines) would have all of it
    // discarded, leaving "Command failed" as the entire diagnosis. Re-raise
    // with the driver's own output attached.
    let out;
    try {
        out = runWindowsDriver(name, tapeObj);
    } catch (e) {
        const said = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
        throw new Error(`${e.message}${said ? `\n${said.split('\n')
            .filter((l) => !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l))
            .map((l) => `      ${l}`).join('\n')}` : ''}`);
    }
    // cmd.exe/py.exe launched from a WSL cwd emit a harmless UNC warning.
    const clean = out.replace(/\r/g, '').split('\n')
        .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l));
    clean.forEach((l) => console.log(`    ${l}`));
    if (!existsSync(outWsl)) {
        throw new Error(`windows driver wrote no stream for ${name}`);
    }
    return JSON.parse(readFileSync(outWsl, 'utf8'));
}

/** The `py.exe` invocation itself, split out so its failure can be reported. */
function runWindowsDriver(name, tapeObj) {
    return execFileSync(WIN_PY, [
        '-3.12', `${WIN_SCRATCH_DOS}\\seedling-bot-replay-win.py`,
        '--url', PAGE_URL,
        '--tape', `${WIN_SCRATCH_DOS}\\tape-${name}.json`,
        '--out', `${WIN_SCRATCH_DOS}\\stream-${name}.json`,
        '--progress', `${WIN_SCRATCH_DOS}\\progress-${name}.json`,
        '--deadline-sec', String(Math.ceil(deadlineFor(tapeObj.tick_count) / 1000)),
    ], { cwd: WIN_SCRATCH_WSL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * The GAME's `transitions`, derived from the ticks it drained.
 *
 * `Bot.as`'s `botDrain` hardcodes `transitions: []` — the game does not
 * hand the field over and re-recording will never populate it — but §1
 * ruling 2 defines an entry as "the first observation tick whose `level` is
 * the new level", which makes it a pure function of the tick stream. So
 * this is where the game's side is filled in, on BOTH paths (record and
 * compare), from the one derivation in `tapeFormat.js`. The JS engine keeps
 * deriving ITS side from its own world swap; if both sides read the level
 * field, the transitions diff would degenerate into diffing the tick stream
 * against itself.
 *
 * The empty-field check is the reason this is a function and not an inline
 * spread: if a future AS3 build starts reporting transitions for real, that
 * should be a NAMED failure to reconcile, not something the derivation
 * quietly overwrites.
 */
function withDerivedTransitions(name, drained) {
    const derived = deriveTransitions(drained.ticks);
    const reported = drained.transitions ?? [];
    if (reported.length > 0) {
        check(`${name}: the game's own transitions agree with the derivation`,
            JSON.stringify(reported) === JSON.stringify(derived),
            `botDrain reported ${JSON.stringify(reported)}, derived `
            + `${JSON.stringify(derived)} — Bot.as used to hardcode [], so this build `
            + 'reports the field for real and the derivation needs revisiting');
    }
    return { ticks: drained.ticks, transitions: derived };
}

/**
 * R0's ACCEPTANCE SIGNAL, asserted from the GAME's own `botStatus`.
 *
 * ⚠ The JS inventory mirror is NOT consulted for the verdict. It supplies
 * the EXPECTATION — which tick a grant should fire on, and which properties
 * should be true afterwards — and the game supplies the answer. Reading the
 * mirror for both would be the mirror agreeing with itself; the whole point
 * of putting the readout in the batch is that the recompiled game is the
 * oracle for the acceptance signal too, not only for positions.
 *
 * `saw_auto_advance` is checked on EVERY tape, not only the relaxed ones.
 * The auto-advance ships dark at R0 because every route avoids every
 * ceremony — so a non-zero count means the proximity-hazard census missed
 * something and a freeze fired that nobody planned for. That is exactly the
 * failure the sticky counter exists to make visible rather than absorb.
 */
function checkReadout(name, tape, status, stream) {
    if (!status || typeof status !== 'object') {
        check(`${name}: botStatus is readable`, false, 'no status object');
        return null;
    }
    // The batch's readout must be PRESENT. A build without it would make
    // every assertion below vacuously true by comparing undefined to
    // undefined.
    const hasReadout = status.items && typeof status.items === 'object'
        && Array.isArray(status.cutscene) && typeof status.menu === 'boolean'
        && Array.isArray(status.grants);
    check(`${name}: botStatus carries the R0 readout`, !!hasReadout,
        hasReadout ? `${Object.keys(status.items).length} item properties, `
            + `cutscene=${JSON.stringify(status.cutscene)}, menu=${status.menu}`
            : 'items/cutscene/menu/grants missing — is this the pre-R0 build?');
    if (!hasReadout) return null;

    // ⚠ VERSION-SCOPED FROM R4, and the scoping is the whole point. The
    // counter used to increment on the RELEASE, and a `Help` ends its
    // freeze on the PRESS — so the sword's `Help(3)` was auto-advanced on
    // every run that collected it and the readout still said 0. The R4
    // batch counts a Help's ARRIVAL instead, which is NOT byte-inert: it
    // changes the reported value for the ~8 frozen R3 collection fixtures.
    // Gating the fix on `tape_version >= 4` is what keeps those fixtures'
    // committed expectations true, so the inertness gate stays a gate
    // rather than failing by being correct.
    //
    // For v<=3 the claim is unchanged and still a CENSUS GUARD: a non-zero
    // count means a freeze fired that nobody planned for. For a v4 tape the
    // count is honest, and the walk asserts it as a POSITIVE.
    // ⚠⚠ R5 SLICE 10: THE GATE WAS `tape_version < 4` AND EVERY R5 TAPE IS
    // v4 OR v5, so the arc's own fixtures had NO census guard at all. The
    // refuted shaft tape reported 217 dead frames with zero transitions and
    // nothing in the sweep said so (§22.8).
    //
    // ⛔ AND RE-ARMING IT IS NOT ENOUGH, which is the part worth writing
    // down. `Bot.autoAdvance`'s predicate is `Game.talking || helpUp`, and
    // v5's stated unit is "a FREEZE ARRIVAL, whatever raised it". Two
    // classes on this arc raise one and are NEITHER:
    //
    //   · `SealController` (§22.3) — the chest ceremony's 181 frames;
    //   · `FallRock` (slice 10)    — 197 frames, and it is what actually
    //                                happened on the shaft.
    //
    // So `saw_auto_advance == 0` is a guard over DIALOGUE freezes, and it
    // is armed here as exactly that. The freezes it cannot see are caught
    // by the dead-frame budget below, which is a different instrument and
    // is the one that would have caught the shaft.
    check(`${name}: no dialogue auto-advance fired`, status.saw_auto_advance === 0,
        status.saw_auto_advance === 0
            ? `saw_auto_advance=0${tape.tape_version < 4 ? ' (v<=3: bug-compatible count)' : ''}`
            : `saw_auto_advance=${status.saw_auto_advance} — a dialogue or Help the route `
            + 'was supposed to avoid froze the game, so the proximity-hazard census '
            + 'missed something');

    // The JS side's expectation for this tape, from the same tape the game
    // just ran. `runTape` throws if a grant never fires, so a stale route is
    // caught before the comparison rather than by it.
    //
    // ⚠ A throw here is a NAMED failure for THIS tape, never an exception
    // that aborts the sweep — the same rule a missing expectation already
    // follows, and for the same reason: one unmodelled tape must not leave
    // every tape after it unreported. It is also what lets a rung RECORD an
    // oracle for a mechanic the JS does not model yet (the v2 slice-0
    // inversion): the recording is about the GAME, so `--record` still
    // writes it, and this check stays red until the transcription lands.
    let expected;
    try {
        expected = runTape(tape, { levelSource: atlasLevelSource() });
    } catch (e) {
        check(`${name}: the JS model runs this tape`, false,
            `${e.message} — the recording is still valid (it is the game's), but every `
            + 'readout expectation below needs the model, so they are not evaluated');
        return null;
    }

    // ── ⛓⛓ THE DEAD-FRAME BUDGET, R5 slice 10 ────────────────────────────
    //
    // `dead_frames` is `blackCover > 0 || Game.freezeObjects`, summed over
    // the run. Three things put frames in it and the model knows two of them
    // exactly:
    //
    //   · the freezes the RUN causes    `expected.frozenFramesOwed`
    //                                   (a FallRock's fall, exactly derived)
    //   · a ceremony's own freeze       `expected.sealCollections`
    //   · one room-load fade per BUILD  ⚠ NOT A CONSTANT — §22.6 measured
    //                                   21/20 on one level and 20/19 on
    //                                   another, because `blackCover` decays
    //                                   per RENDER and the gate samples per
    //                                   UPDATE. So it is a BAND, per load.
    //
    // The claim is therefore about the RESIDUE, and it is falsifiable: the
    // shaft tape's residue was 217 against one load, twenty times the band.
    // A check that could only ever pass would be worth nothing here — this
    // one is the reason the refutation is diagnosable at all.
    //
    // ⛔⛔ AND IT SITS *BELOW* `expected`, WHICH IS WHERE SLICE 11 HAD TO
    // MOVE IT. Slice 10 wrote it above the `let expected` declaration, so
    // every tape died in the temporal dead zone with `Cannot access
    // 'expected' before initialization` — a HARNESS error, reported once
    // and aborting the sweep on tape one. It was invisible for a whole
    // slice because that slice's baseline sweep had imported the modules
    // BEFORE the edit (§23.10), so the gate that would have caught it was
    // measuring the parent commit. ⇒ a sweep whose result predates the
    // change it is meant to gate is not a gate.
    const loads = stream.transitions.length + 1;
    const ceremonyFrames = (expected.sealCollections ?? [])
        .reduce((n, c) => n + (c.deadFrames ?? 0), 0);
    const modelled = (expected.frozenFramesOwed ?? 0) + ceremonyFrames;
    const residue = status.dead_frames - modelled;
    const lo = loads * FADE_PER_LOAD.min;
    const hi = loads * FADE_PER_LOAD.max;
    check(`${name}: the dead frames are accounted for`,
        residue >= lo && residue <= hi,
        `${status.dead_frames} dead = ${modelled} modelled `
        + `(${expected.frozenFramesOwed ?? 0} run freeze + ${ceremonyFrames} ceremony) `
        + `+ ${residue} residue, against ${loads} load(s) at `
        + `${FADE_PER_LOAD.min}-${FADE_PER_LOAD.max} frames each `
        + `= [${lo},${hi}]${residue >= lo && residue <= hi ? '' : ' ⛔ OUT OF BAND — a '
            + 'freeze fired that the model does not know about, and no positional '
            + 'comparison would report it: a frozen frame advances no tape tick'}`);

    // ⚠ Compared FIELD BY FIELD, not by JSON.stringify. AS3's JSON writer
    // emits object keys in its own order ({items, level, t}) and JS in
    // insertion order ({t, level, items}), so a stringify comparison
    // reports identical data as a mismatch — which is exactly what it did
    // on the first recording run.
    const renderGrant = (g) => `{t:${g.t}, L${g.level}, ${[...g.items].sort().join('+')}}`;
    const gameGrants = status.grants.map(renderGrant).join(' ');
    const wantGrants = expected.grants.map(renderGrant).join(' ');
    check(`${name}: the game fired the grants the tape asked for, at the same ticks`,
        gameGrants === wantGrants,
        `game: [${gameGrants}], expected: [${wantGrants}]`);

    // Every one of the 14, positives AND negatives. The negatives are what
    // catch a grant firing early or a table wired to the wrong setter — a
    // check that only asserted the granted item would pass a build that
    // granted all fourteen.
    // ⛔ AMENDED BY THE DECLARED ENCOUNTER EXEMPTION, and the amendment is
    // announced. `r5Chain.MODEL_EXEMPT` names, per fixture, the items the
    // GAME earns through a mechanic the engine cannot model — a boss's
    // runtime-spawned reward is in no level's pickup list, so no reading of
    // the extract could ever produce it. Folding them in makes this check
    // HARDER: a run that fought the boss and lost now fails here.
    const exempt = MODEL_EXEMPT[name] ?? null;
    const mirror = { ...expected.inventory };
    for (const item of exempt?.earned ?? []) {
        const spec = ITEM_PROPERTIES[item];
        if (!spec) {
            check(`${name}: the exemption names a real item`, false,
                `MODEL_EXEMPT["${name}"].earned lists "${item}", which is not one of the `
                + `fourteen (${Object.keys(ITEM_PROPERTIES).join(', ')})`);
            continue;
        }
        if (spec.kind === 'add') mirror[spec.property] = spec.base + spec.value;
        else mirror[spec.property] = true;
    }
    if (exempt) {
        console.log(`MODEL-EXEMPT: ${name} — earns [${exempt.earned.join(', ') || 'nothing'}]`
            + `${exempt.refusesInput ? ', refuses input' : ''}. ${exempt.why}`);
    }
    const wrong = Object.entries(mirror)
        .filter(([prop, want]) => status.items[prop] !== want)
        .map(([prop, want]) => `${prop}: game ${status.items[prop]}, expected ${want}`);
    check(`${name}: all 14 item properties match, positives and negatives`,
        wrong.length === 0, wrong.length ? wrong.join('; ')
            : `hitsMax=${status.items.hitsMax}, `
            + `${Object.values(mirror).filter((v) => v === true).length} `
            + `flag(s) true${exempt?.earned.length ? ` (${exempt.earned.length} EARNED, `
                + 'not granted)' : ''}`);
    // ...and the exemption has to be EXERCISED. An entry whose fixture
    // matches the plain mirror is a fixture that did not do the thing it is
    // exempt for, which is exactly the shape a stale exemption takes.
    if (exempt && exempt.earned.length > 0) {
        const plainWrong = Object.entries(expected.inventory)
            .filter(([prop, want]) => status.items[prop] !== want);
        check(`${name}: the encounter exemption is EXERCISED`, plainWrong.length > 0,
            plainWrong.length > 0
                ? `the game's item set really does differ from the tape's mirror by `
                    + `[${exempt.earned.join(', ')}] — the encounter fired`
                : 'the game matches the UNAMENDED mirror, so nothing was earned and this '
                    + 'exemption is hiding a run that did not happen');
    }

    // ── R4: THE EQUIP, TWO-SIDEDLY ────────────────────────────────────
    // A new tape field is a place for two consumers to disagree, and this
    // one is the worst-shaped kind: `Player.useItem` switches on
    // `Inventory.getItem(Main.primary)` and falls through to NOTHING for a
    // slot that does not exist, so a mirror that had the slot ORDER wrong
    // would not error — every press would just quietly be a sword slash,
    // and the first symptom would be a bridge that never opened, thousands
    // of ticks away from the cause.
    //
    // So both halves are read from the GAME (`Main.primary`, and
    // `Inventory` SCANNED slot by slot) and compared against the JS
    // mirror's own transcription of `addItemsFromSave`. Asserted on EVERY
    // tape, not just the ones that equip: a v1/v2/v3 fixture's expectation
    // is `primary = 0` and a slot array that follows from its own grants,
    // which is exactly the negative control this needs.
    if (status.primary !== undefined) {
        check(`${name}: Main.primary matches the mirror`,
            status.primary === expected.primary,
            `game: ${status.primary}, expected: ${expected.primary}`);
        const gameSlots = (status.inventory_slots ?? []).join(',');
        // ⛔ RECOMPUTED FROM THE AMENDED MIRROR. `addItemsFromSave` builds the
        // slot array from the item booleans, so an earned item is a slot the
        // tape's own mirror cannot have — and reading the unamended array
        // here would report the encounter's success as a slot-order defect.
        const wantSlots = (exempt?.earned.length
            ? inventorySlotsFor(mirror) : (expected.inventorySlots ?? [])).join(',');
        check(`${name}: the inventory slot ARRAY matches the mirror`,
            gameSlots === wantSlots,
            `game: [${gameSlots}], expected: [${wantSlots}] `
            + '(ids: 0 sword, 1 fire, 2 wand, 3 spear, 4 ghostsword, 5 firewand)');
        // And the two together: the slot the tape selected must actually
        // hold something. This is the check `parseTape` cannot make (it
        // sees a tape, not a run) and the one `Bot.as` defers (the array
        // does not exist until the first `inventory.update()`).
        const held = status.inventory_slots ?? [];
        check(`${name}: the selected slot holds an item`,
            held.length === 0 ? status.primary === 0 : status.primary < held.length,
            `primary=${status.primary} against ${held.length} slot(s)`);
    }

    // ⚠ `drownTimer` is CUMULATIVE and never reset off-hazard, so this is a
    // POSITIVE control for the forbidden-floor policy rather than a
    // formality: a walk that declares lava armed and still reports 0 has,
    // in the game's own accounting, never once stood on an unprotected
    // hazard tile. Every tape on the ladder to date should report 0 —
    // R1-R3 coerce all four hazards, so nothing can touch it.
    //
    // ⛔ AMENDED BY THE DECLARED DROWN EXEMPTION (R5 slice 4 step 4), and
    // like `MODEL_EXEMPT` it HARDENS. `r5Swim.DROWN_EXPECTED` names, per
    // fixture, the arm that is supposed to drown and the band its contact
    // must fall in — and a declared arm reporting 0 fails, because a
    // drowning control that did not drown is a pair that proves nothing
    // about armed water. The logic is a pure function so all four quadrants
    // are mutated red in vitest rather than only ever seen passing here.
    const drown = drownFinding(name, status.drown_timer);
    if (drown) check(drown.name, drown.ok, drown.detail);

    // The win statics stay false until R6 actually beats the game. Pinned
    // here so the terminal assertion has a baseline rather than being
    // introduced at the rung that needs it to flip.
    check(`${name}: the win statics are still false`,
        status.menu === false && status.cutscene.every((c) => c === false),
        `menu=${status.menu}, cutscene=${JSON.stringify(status.cutscene)}`);

    // ── R3: the first half of the crutch LEDGER ───────────────────────
    // `Lock.turnOff()` calls `Game.setPersistence(tag, false)`, so a lock
    // the PLAYER opened leaves its flag in `persistence_cleared` — the R3
    // batch's readout, scanned from `Main.levelPersistence` rather than
    // echoed from the tape. This asserts the direction that is already
    // true: everything the model says was opened by hand really is off in
    // the game's own array.
    //
    // ⚠ Deliberately NOT the exact-set claim yet. A pickup's `removed()`
    // clears a flag too, so the full ledger — "off in the game iff the tape
    // declared it or the run earned it" — needs the collected pickups'
    // tags as well, and that lands with the walk.
    const clearedInGame = new Set((status.persistence_cleared ?? [])
        .map((c) => `${c.level}:${c.tag}`));
    const opened = expected.lockSnaps ?? [];
    if (opened.length > 0) {
        const missing = opened
            .filter((s) => !clearedInGame.has(`${s.level}:${s.persistTag}`))
            .map((s) => `${s.id} (${s.level}:${s.persistTag})`);
        check(`${name}: every touch-lock the player opened wrote its persistence flag`,
            missing.length === 0,
            missing.length === 0
                ? `${opened.map((s) => `${s.id} -> ${s.level}:${s.persistTag}`).join(', ')} `
                + `off, out of ${clearedInGame.size} flag(s) off in all`
                : `${missing.join(', ')} still SET — the lock opened but nothing wrote `
                + 'the flag, so the clear crutch has not actually been retired for it');
    }

    return expected;
}

/**
 * R1's and R2's terminal assertions and segment chains, from the GAME's own
 * reports.
 *
 * The logic itself is `frontend/modules/seedlingDemo/r1Acceptance.js`,
 * deliberately: a claim that only ever runs against a passing eleven-minute
 * replay is a claim nobody has ever seen FAIL, and a check that has never
 * failed is indistinguishable from one that cannot. As a pure function over
 * the drained status and stream, every one of its assertions is mutated and
 * asserted-red in vitest, in milliseconds. This is just the printer.
 */
function checkAcceptance(replayed) {
    if (replayed.size === 0) return;
    const findings = [
        ...r1AcceptanceFindings(R1_ROUTE, r1TapeSpecs(R1_ROUTE), replayed),
        ...r2AcceptanceFindings(R2_ROUTE, r2TapeSpecs(R2_ROUTE), replayed),
        ...r3AcceptanceFindings(R3_ROUTE, r3TapeSpecs(R3_ROUTE), replayed),
        ...r4AcceptanceFindings(R4_ROUTE, r4TapeSpecs(R4_ROUTE), replayed),
        // R5 slice 3: the first live kill, asserted as a PAIR. It needs no
        // route or specs — the claim is entirely "what did these two arms,
        // one field apart, do to the game's own ledger".
        ...r5AcceptanceFindings(replayed),
    ];
    for (const f of findings) {
        if (f.skipped) {
            console.log(`SKIP: ${f.name} — ${f.detail}`);
            continue;
        }
        check(f.name, f.ok, f.detail);
    }
}

/** Replay one tape on its own fresh page and return the drained stream. */
async function replay(name, tapeObj) {
    if (WIN) {
        const { stream, status } = replayOnWindows(name, tapeObj);
        return { stream: withDerivedTransitions(name, stream), status };
    }
    const page = await freshPage();
    try {
        const loaded = await botOn(page, 'botLoadTape', JSON.stringify(tapeObj));
        if (loaded !== 'ok') throw new Error(`botLoadTape(${name}): ${loaded}`);
        const started = await botOn(page, 'botStart');
        if (started !== 'ok') throw new Error(`botStart(${name}): ${started}`);

        const status = await waitFor(page, `tape ${name} to finish`, async () => {
            const st = await botJsonOn(page, 'botStatus');
            return st.finished ? st : null;
        }, deadlineFor(tapeObj.tick_count));

        const drained = await botJsonOn(page, 'botDrain');
        return { stream: withDerivedTransitions(name, drained), status };
    } finally {
        await page.close();
    }
}

try {
    // Boot once up front purely as a positive control: if the bot never
    // registers or never sees a player, everything below would "pass"
    // vacuously by never running. Under --win the per-tape driver does this
    // itself (it fails loudly if the callbacks never appear) and each replay
    // prints its WebGPU adapter, so a silent software fallback is visible.
    if (!WIN) {
        const probe = await freshPage();
        check('bot control surface registered', true,
            'botLoadTape/botStart/botStatus/botDrain/botReset');
        const boot = await botJsonOn(probe, 'botStatus');
        check('bot reports a live player before any tape', Number.isFinite(boot.x),
            `x=${boot.x} y=${boot.y} level=${boot.level}`);
        await probe.close();
    } else {
        console.log('MODE: real-GPU Windows Chrome (--win)');
    }

    const allNames = fixtureNames();
    check('fixture roster is non-empty', allNames.length > 0, `${allNames.length} tapes`);

    // ⚠ A stale drown declaration is SILENT — it is consulted only when its
    // fixture is replayed, so a renamed or deleted arm leaves a weakening
    // in the table that nobody ever reaches. Asserted against the WHOLE
    // roster, not the `--only` selection: a narrowed sweep must not narrow
    // this.
    for (const f of drownDeclarationRosterFindings(allNames)) check(f.name, f.ok, f.detail);

    if (ONLY.size > 0) {
        // A misspelled --only would otherwise "pass" by sweeping nothing.
        const unknown = [...ONLY].filter((n) => !allNames.includes(n));
        check('every --only name is a real fixture', unknown.length === 0,
            unknown.length ? `unknown: ${unknown.join(', ')}` : `${ONLY.size} selected`);
    }
    let names = ONLY.size > 0 ? allNames.filter((n) => ONLY.has(n)) : allNames;
    if (TIER === 'fast' && ONLY.size === 0) {
        const deferred = names.filter((n) => loadTape(n).tick_count > FAST_TIER_MAX_TICKS);
        names = names.filter((n) => loadTape(n).tick_count <= FAST_TIER_MAX_TICKS);
        // ⚠ NAMED, NOT SILENT. A tier that quietly dropped tapes would read
        // as "everything passed" — the same shape as a truncated roster
        // reporting green. Say what was not run and how to run it.
        console.log(`TIER fast: ${names.length} tape(s); DEFERRED to --tier=full `
            + `(> ${FAST_TIER_MAX_TICKS} ticks): ${deferred.join(', ')}`);
    } else if (ONLY.size === 0) {
        console.log(`TIER full: ${names.length} tape(s), every one of them`);
    }
    /** Every tape this run replayed, for the cross-tape R1 checks. */
    const replayed = new Map();

    // ── ⛓⛓ THE RESUME, and what it refuses to reuse ───────────────────
    //
    // ⛔ RECORDING NEVER RESUMES. `--record` exists to write the game's
    // stream, and skipping a tape because a previous run passed would
    // leave the expectation unwritten while the sweep reported success.
    const prior = (RESUME && !RECORD) ? loadCheckpoint() : new Map();
    const reused = [];
    if (RESUME) {
        if (RECORD) {
            console.log('RESUME: IGNORED under --record — a recording run must write '
                + 'every expectation it selects, so nothing is skipped.');
        } else {
            console.log(`RESUME: checkpoint at ${CHECKPOINT}, fingerprint ${FINGERPRINT} `
                + `(model + atlas + wasm stamp), ${prior.size} prior result(s)`);
        }
    }
    for (const name of names) {
        const p = prior.get(`${name}@${tapeFingerprint(name)}`);
        // ⚠ A STORED **FAIL** IS NOT REUSED. A failure is the thing the run
        // exists to surface; re-deriving it costs one tape and removes any
        // way for a stale red to outlive its cause.
        if (!p || !p.ok) continue;
        const payload = readPayload(name);
        if (!payload) continue;   // the verdict is cached and its evidence is not
        replayed.set(name, payload);
        for (const c of p.checks ?? []) {
            console.log(`PASS: ${c.name}${c.detail ? ` — ${c.detail}` : ''} [checkpoint]`);
        }
        reused.push(name);
    }
    if (reused.length > 0) {
        // ⚠ NAMED, NOT SILENT — the same rule `--tier=fast` follows. A run
        // that reused half its roster and printed nothing about it is a run
        // whose green means something different from what it looks like.
        console.log(`RESUME: reusing ${reused.length} tape(s) whose fingerprint still `
            + `matches: ${reused.join(', ')}`);
    }
    const todo = names.filter((n) => !reused.includes(n));
    if (RESUME) {
        console.log(`RESUME: ${todo.length} tape(s) to replay`);
    }

    for (const name of todo) {
        const tape = loadTape(name);
        let result;
        const t0 = Date.now();
        beginTape();
        try {
            result = await replay(name, tape);
        } catch (e) {
            check(`${name}: replays`, false, e.message);
            recordCheckpoint({
                tape: name, fp: tapeFingerprint(name), ok: false, checks: endTape(),
            });
            continue;
        }
        const { stream, status } = result;
        replayed.set(name, { stream, status });
        const secs = ((Date.now() - t0) / 1000).toFixed(0);

        // ⚠ THE READOUT CHECKS ARE THEMSELVES PER-TAPE FALLIBLE, and slice 11
        // paid for learning it. `checkReadout` already turns a `runTape`
        // throw into a named failure — but a defect in the CHECKING code
        // (slice 10's dead-frame budget read `expected` in its temporal dead
        // zone) throws past all of that, out to the harness-level catch, and
        // kills the sweep on tape one. Seventy-eight tapes went unreported
        // behind a single line, which is precisely the failure the
        // missing-expectation rule was written to prevent — stated for
        // `runTape` and not for the code around it. So the boundary is here,
        // where the per-tape loop is, and it names the tape.
        let expectedRun;
        try {
            expectedRun = checkReadout(name, tape, status, stream);
        } catch (e) {
            check(`${name}: the readout checks run`, false,
                `${e.message} — this is a defect in the VERIFIER, not in the game or the `
                + 'tape. Named against this tape so the rest of the roster still reports.');
            expectedRun = null;
        }

        // ⚠ `receiveInput == false` stopped being unconditionally a defect at
        // R1. A pit transport refuses input BY DESIGN — `checkFallingInPit`
        // sets it false for the twenty fall-out ticks and the arrival keeps it
        // refused for the whole fall-from-ceiling descent. So the flag is read
        // TWO-SIDEDLY, against the model's own answer:
        //
        //   the model says a transport happened  -> refusal is REQUIRED, and
        //     its absence means the fall never fired and the fixture is vacuous
        //   the model says none happened         -> refusal is a defect, as before
        //
        // Deriving the expectation from the model rather than from a new tape
        // field is deliberate: a tape field would have to be validated by
        // `Bot.as` too, i.e. an AS3 change and a pipeline run, to state
        // something both sides can already work out.
        //
        // ⚠ R3 ADDS A SECOND WAY TO EARN IT, and it is a different mechanic
        // rather than another fall: `ShieldLock.update` sets
        // `receiveInput = false` for its whole ~101-tick fade. So the
        // expectation is "the model says SOMETHING refuses input here",
        // named by which, and the negative arm below is unchanged — a
        // refusal the model cannot account for is still a defect.
        const transports = expectedRun?.transports ?? [];
        const lockSnaps = expectedRun?.lockSnaps ?? [];
        const causes = [
            ...(transports.length ? [`${transports.length} pit transport(s)`] : []),
            ...lockSnaps.map((s) => `${s.id} for ${s.ticks} tick(s)`),
        ];
        if (causes.length > 0) {
            check(`${name}: the game refused input where the model says it must`,
                status.saw_input_refused === true,
                status.saw_input_refused
                    ? `${causes.join(', ')} modelled`
                    : `the model expects ${causes.join(', ')} but the game never refused `
                    + 'input — the mechanic never fired, so this fixture proves nothing '
                    + 'about it');
        } else if (status.saw_input_refused && MODEL_EXEMPT[name]?.refusesInput) {
            // A DECLARED take-over. `BobBoss.death` sets `receiveInput =
            // false` for each 120-frame form transition, so the refusal is
            // the encounter working — and it is asserted as a POSITIVE:
            // a fixture that declared it and did NOT get it never fought.
            check(`${name}: the declared encounter take-over fired`, true,
                'receiveInput went false mid-tape, which is what '
                + `MODEL_EXEMPT["${name}"] says the script does`);
        } else if (status.saw_input_refused) {
            // Surfaced, not silently tolerated: receiveInput==false means the
            // game dropped input mid-tape and the stream is not comparable.
            check(`${name}: game accepted input throughout`, false,
                'receiveInput went false mid-tape (cutscene/pit/boss/shield lock?) and '
                + 'the model accounts for it with neither a pit transport nor a '
                + 'touch-lock window');
        } else if (MODEL_EXEMPT[name]?.refusesInput) {
            check(`${name}: the declared encounter take-over fired`, false,
                `MODEL_EXEMPT["${name}"] says this script sets receiveInput = false, and `
                + 'the game never refused input — so the encounter did not run');
        }

        // Quantitative pin: a bot that recorded nothing, or teleported,
        // would satisfy a purely positional comparison.
        const expectedTicks = tape.tick_count + 1;
        check(`${name}: observation count`, stream.ticks.length === expectedTicks,
            `${stream.ticks.length} (expected tick_count+1 = ${expectedTicks}), `
            + `${stream.transitions.length} transition(s) derived, `
            + `${status.dead_frames} fade frames skipped, ${secs}s`);

        if (RECORD) {
            writeFileSync(join(EXPECTATIONS_DIR, `${name}.json`),
                serializeObservationStream(stream));
            console.log(`RECORDED: ${name}.json (${stream.ticks.length} observations)`);
            // ── ⛔⛔ R5 SLICE 10: A RECORDING IS NOT EVIDENCE ABOUT THE
            //        MODEL, AND THIS IS WHERE THAT STOPPED BEING PROSE ─────
            //
            // §22.7: the shaft was recorded, `--record` came back green, and
            // it was READ as "the plan survived the game". It was not. What
            // `--record` did was write the game's stream and then `continue`
            // past every comparison — a run with nothing to disagree with.
            // The refutation surfaced later, in `tapeRunner.test.js`'s
            // fixture differential, which is MODEL against RECORDING.
            //
            // So the chain is STRUCTURAL now: recording runs that
            // differential immediately, against the stream just written, and
            // a `--record` sweep whose model is refuted comes back RED. The
            // ordering can no longer be forgotten, because it is not an
            // ordering any more.
            //
            // ⚠ IT IS A NAMED FAILURE FOR THIS TAPE, never a throw — the
            // recording is the GAME's and stays valid whatever the model
            // says. That is the same rule a missing expectation follows, and
            // it is what lets a rung record an oracle for a mechanic the JS
            // does not model yet.
            let modelStream = null;
            try {
                modelStream = runTapeToStream(tape, { levelSource: atlasLevelSource() });
            } catch (e) {
                check(`${name}: THE MODEL RUNS THE TAPE IT JUST RECORDED`, false,
                    `${e.message} — the recording is the game's and is valid; the model `
                    + 'cannot reproduce it, so this fixture is not yet a regression net');
            }
            if (modelStream) {
                const modelDiff = diffObservationStreams(stream, modelStream);
                check(`${name}: ⛓⛓ THE MODEL REPRODUCES THE RECORDING IT JUST MADE`,
                    modelDiff === null,
                    modelDiff === null
                        ? `${stream.ticks.length} observations, `
                            + `${stream.transitions.length} transition(s) — the recording is `
                            + 'an ORACLE and the model already agrees with it'
                        : `${modelDiff} ⛔ THE RECORDING IS VALID AND THE MODEL IS `
                            + 'REFUTED. Do not commit this fixture: a fixture whose model '
                            + 'is wrong is either a permanent red or a silenced one, and '
                            + 'neither is a finding (§22.7).');
            }
            // ⛔ NO CHECKPOINT UNDER --record. The verdict a recording run
            // reaches is about an oracle it wrote moments earlier, and the
            // fingerprint it would be filed under is already stale — the
            // expectation is part of that fingerprint and has just changed.
            endTape();
            continue;
        }

        // A fixture with no expectation yet must be a NAMED failure for that
        // one tape, not an exception that aborts the sweep and leaves every
        // tape after it unreported.
        let expected;
        let provisional;
        try {
            ({ stream: expected, provisional } = loadExpectation(name));
        } catch (e) {
            check(`${name}: has a committed expectation`, false,
                `${e.message} — record it with --record --only=${name}`);
            recordCheckpoint({
                tape: name, fp: tapeFingerprint(name), ok: false, checks: endTape(),
            });
            continue;
        }
        const diff = diffObservationStreams(expected, stream);
        check(`${name}: live game matches the committed `
            + `${provisional ? 'PROVISIONAL' : 'oracle'} stream`,
            diff === null, diff ?? '');

        // ── ⛓ THE TAPE IS DONE: bank it, evidence and all ──────────────
        const checks = endTape();
        const ok = checks.every((c) => c.ok);
        if (ok) writePayload(name, stream, status);
        recordCheckpoint({
            tape: name, fp: tapeFingerprint(name), ok, checks, secs: Number(secs),
        });
    }

    checkAcceptance(replayed);

    if (!RECORD && ONLY.size === 0) {
        // ── The live bot-driver task (v2 slice 4) ────────────────────────
        // Targets in, tape synthesized by `botDriverV2` AT RUN TIME, and
        // every claim asserted from the GAME's own drained observations —
        // the game's word, not the driver's.
        //
        // v1's task was a straight line to one point with collision off,
        // which the driver could not get wrong. This one is the brief's
        // "thread-the-gap + cross-level" task: it plans A* around level 0's
        // lake and its statue, walks into a NAMED teleporter, and plans
        // again in level 94 — so a wrong hitbox, a wrong tile classification
        // or a wrong transition anywhere in the model makes the real game
        // end up somewhere else. It is deliberately NOT one of the committed
        // fixtures: those replay a tape recorded earlier, while this plans
        // a fresh one against the geometry as it stands right now.
        const task = [
            { level: 0, targets: [{ x: 264, y: 216 }], exit: { x: 0, y: 128 } },
            { level: 94, targets: [{ x: 216, y: 200 }] },
        ];
        const levelSource = atlasLevelSource();
        const { tape, arrivals, transitions } = synthesizeLegs(task, {
            levelSource, name: 'live-driver',
        });
        const { stream } = await replay('live-driver', tape);
        for (const a of arrivals) {
            const o = stream.ticks[a.tick];
            const ok = o
                && o.level === a.level
                && Math.abs(o.x - a.target.x) <= DEFAULT_TOLERANCE
                && Math.abs(o.y - a.target.y) <= DEFAULT_TOLERANCE;
            check(`live driver reaches leg ${a.leg} target ${a.index} `
                + `(${a.target.x},${a.target.y}) in level ${a.level}`,
                !!ok, o ? `game reported (${o.x}, ${o.y}) in level ${o.level} at tick `
                    + `${a.tick}` : 'no observation');
        }
        // The crossing is the other half of the claim, and it is checked
        // against the transitions DERIVED from the game's level field —
        // which is why a driver that merely believed it had teleported
        // cannot pass this.
        check('live driver crosses exactly where it planned to',
            JSON.stringify(stream.transitions) === JSON.stringify(transitions),
            `game: ${JSON.stringify(stream.transitions)}, `
            + `driver: ${JSON.stringify(transitions)}`);
    }
} catch (e) {
    console.log(`FAIL: harness error — ${e.message}`);
    failures++;
} finally {
    if (browser) await browser.close();
}

console.log(failures === 0
    ? `\nALL CHECKS PASSED${RECORD ? ' (recording mode)' : ''}`
    : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
