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
    deriveTransitions, diffObservationStreams, gameVisibleTape,
    serializeObservationStream,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const {
    EXPECTATIONS_DIR, fixtureNames, loadExpectation, loadTape,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/fixtures/index.js'));
const {
    LEGACY_ONLY_LEVELS, LEGACY_TAPES, TIERS, assertTiersComplete, tapesInTier,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/fixtures/tiers.js'));
// ⛓ R7 slice 1: the seam latch's consumer, DERIVED by mapping the signature
// over the game's `botSeam()` envelope. The findings function lives beside
// the signature it maps, so a row added there cannot go unreported here.
const {
    seamLatchFindings,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/r7Acceptance.js'));
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
// ⛓ R7 slice 2: the segment chain. `isPlaythroughSegment` is what decides
// whether a tape's latch is held to `requireCalm` — the 118 committed
// fixtures do not end at arrivals and a segment does, by construction.
const { playthroughAcceptanceFindings } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/playthroughAcceptance.js'));
const { assertChainsWellFormed, isPlaythroughSegment } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/playthroughWalk.js'));
// ⛔ The declared ENCOUNTER exemption — see `r5Chain.MODEL_EXEMPT`. A
// scripted boss is not a mechanic the engine can model, so the three
// mirror checks below are AMENDED by a per-fixture declaration rather than
// skipped: the game is asserted against `mirror + earned`, which is a
// harder claim than the unamended one.
const { MODEL_EXEMPT } = await import(join(REPO, 'frontend/modules/seedlingDemo/r5Chain.js'));
// ⛓ The MEASURED ceremony constants, so the budget spends numbers the
// model banked rather than literals this file invents.
const {
    CEREMONY_DEAD_FRAMES,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/sealCeremony.js'));
// ⛓⛓ The fade band, R5 slice 12 — derived and asserted in the module, so
// this file spends it rather than defining it.
const {
    describeFadeBand, fadeBand,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/deadFrameBand.js'));
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
    // ⛔⛔ THIS FILE FIRST, and it was missing from the first cut — which is
    // the same hole one level up. A verdict is produced by the CHECKS as
    // much as by the model: edit a threshold, a band, or the dead-frame
    // budget's arithmetic, and every stored PASS is about a question that
    // is no longer being asked. The fingerprint has to cover the asker.
    h.update(readFileSync(fileURLToPath(import.meta.url)));
    // …and the driver that produces the stream on the game side.
    // ⚠ THE PATH IS INLINE, NOT `WIN_DRIVER`. That const is declared ~115
    // lines below this function's only call site, and reading it here is
    // the temporal dead zone this slice opened with (§24.2) — very nearly
    // reproduced inside the fix for it, and caught by checking the
    // declaration order rather than by trusting that a name in scope is a
    // name with a value.
    const winDriver = join(HERE, 'seedling-bot-replay-win.py');
    if (existsSync(winDriver)) h.update(readFileSync(winDriver));
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
// ⛓ R7 slice 2: the SEAM rides along. Without it a `--resume` run would
// rebuild `replayed` with no latch and every chain row would read UNCLAIMED
// — correct behaviour and a useless run, which is exactly the shape a
// checkpoint must not be able to produce.
function writePayload(name, stream, status, seam) {
    const dir = dirname(payloadPath(name));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(payloadPath(name), JSON.stringify({ stream, status, seam }));
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
// ⛓ R6 slice 0 added `gate` and `legacy` (the ruled roster trim). `full`
// still means EVERYTHING — the pre-push gate was not narrowed, and the
// demotion only leaves the per-slice `gate`. See `fixtures/tiers.js` for
// the evidence the list rests on and the coverage it names as leaving.
if (!Object.keys(TIERS).includes(TIER)) {
    console.error(`--tier must be one of ${Object.keys(TIERS).join(', ')}, got "${TIER}"`);
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
 * ⚠ THE ROOM-LOAD FADE IS A BAND, NOT A CONSTANT — R5 slice 10 — AND ITS
 * SHAPE IS `mean * N ± c * √N`, NOT LINEAR — R5 slice 12.
 *
 * `blackCover` decays from `cover()`, i.e. per RENDER, while `Bot.update`'s
 * dead-frame gate samples per UPDATE. So the number of dead frames a load
 * costs is "how many renders fit inside twenty units of decay", which is not
 * the same quantity whenever the two loops are not locked 1:1.
 *
 * ⛔ The linear `[17*N, 24*N]` this used to be was wrong on both sides at
 * once: its floor was the smallest observation (so a STARVED run went red)
 * and its ceiling grew 5 frames per load (so on the four FULL WALKS it was
 * blind to a 150-frame freeze the model had missed — measured, by name).
 * The derivation, the banked observations and the two-sided check now live
 * in `deadFrameBand.js` + `deadFrameBand.test.js`.
 */
/**
 * ⛔⛔⛔ R6 SLICE 4: AND THE BUDGET WAS SCALED FROM THE WRONG QUANTITY.
 *
 * `tick_count` is what the BOT counts. What the browser has to render is
 * ENGINE FRAMES, and every frozen frame a ceremony spends is a frame the
 * bot does not count — `Game.freezeObjects` gates `Bot.update`'s tick, not
 * the engine's. `r6-totem-control` is 490 ticks and **~930 engine frames**
 * (a 99-frame wand fade, a 150-frame `specialTimer`, a 186-frame fallrock
 * drop), so a budget of `490 * 2.5 s` timed out at 1347 s with the tape
 * still running — indistinguishable, from the outside, from a dead bot.
 *
 * ⇒ the model already knows the number. `runTape`'s `frozenFramesOwed` is
 * the same quantity the dead-frame budget spends below, so the deadline
 * spends it too rather than inventing slack.
 * [[feedback_read_the_harness_own_constants]] — one instrument over.
 */
const deadlineFor = (tickCount, deadFrames = 0) =>
    Math.ceil((tickCount + deadFrames + FADE_FRAMES) * SECONDS_PER_FRAME * 1000) + 60000;

/**
 * The frozen frames the MODEL says this tape spends — memoised, because
 * `runTape` is milliseconds offline and the deadline is asked for twice.
 *
 * ⚠ A MODEL NUMBER IN A HARNESS BUDGET, and that is sound in exactly one
 * direction: it can only make the harness WAIT LONGER. A model that
 * under-counts the freeze produces the timeout that used to happen anyway;
 * one that over-counts costs patience and nothing else. It is never an
 * assertion.
 */
const deadFrameCache = new Map();
const modelDeadFrames = (name, tapeObj) => {
    if (deadFrameCache.has(name)) return deadFrameCache.get(name);
    let owed = 0;
    try {
        owed = runTape(tapeObj, { levelSource: atlasLevelSource() }).frozenFramesOwed ?? 0;
    } catch {
        // A tape the model refuses is a tape the comparison will report on
        // properly in a moment; the budget just falls back to the old one.
        owed = 0;
    }
    deadFrameCache.set(name, owed);
    return owed;
};

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
    // ⛓ R7 slice 6d: the GAME-VISIBLE PROJECTION, at every game-facing
    // channel. A model-only tape feature never crosses to the game — see
    // `gameVisibleTape`'s docblock for why that is a claim and not a hack.
    writeFileSync(tapeWsl, JSON.stringify(gameVisibleTape(tapeObj)));
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
        '--deadline-sec',
        String(Math.ceil(deadlineFor(tapeObj.tick_count, modelDeadFrames(name, tapeObj)) / 1000)),
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
    // ⚠ THE ASSERTION ITSELF IS BELOW, beside the dead-frame budget, because
    // its expectation is DERIVED from the model's collection list and
    // `expected` does not exist yet at this point in the function. Reaching
    // backwards for it is the temporal dead zone slice 11 opened with — the
    // third time this file's ordering has mattered, so the check moved to
    // the data rather than the data being dragged up to the check.

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
    // ── ⛔⛔ THE AUTO-ADVANCE EXPECTATION IS EARNED, NOT ZERO ───────────
    //
    // Slice 10 re-armed this guard as `saw_auto_advance === 0` for every
    // tape. Its first run reported `r4-walk-1-sword` and `r4-walk-full` at
    // 1 — and both are RIGHT. `Bot.autoAdvance`'s own docblock says so:
    // *"The sword's `Help(3)` is auto-advanced on every run that collects
    // the sword … a v4 tape gets the honest one, and R4 asserts it as a
    // POSITIVE."*
    //
    // ⛓ THREE `new Help(...)` EXIST IN THE WHOLE GAME, and only one is on
    // any route here:
    //
    //   `Inventory.as:174`   `new Help(0)`  — behind `if (help)`, which is
    //                                         exactly what R1's one AS3 line
    //                                         (`Inventory.help = false`)
    //                                         turns off. The suppression
    //                                         HOLDS; this is not it.
    //   `Game.as:938`        `new Help(2)`  — the intro cutscene's end.
    //   `Pickups/Sword.as:48` `new Help(3)` — in `Sword.removed()`, with NO
    //                                         `help` guard at all.
    //
    // ⇒ collecting the sword raises a Help that nothing suppresses, and the
    // counter reporting it is the readout working. The defect was a
    // CONSTANT expectation for a value the route earns.
    //
    // ⚠ AND IT IS STILL A CENSUS GUARD, because the expectation is exact:
    // a Help the route did NOT earn still goes red, and a sword collection
    // that FAILS to raise one goes red too. Version-scoped to match
    // `autoAdvance`'s own scoping — a v<=3 tape's counter is
    // bug-compatible and reports 0 however many Helps it dismissed.
    // ── ⛓⛓⛓ R7 SLICE 1: THE SCOPING IS GONE, AND IT IS THE BATCH'S ────
    //     ONLY VISIBLE EFFECT ON THE ROSTER
    //
    // `Bot.autoAdvance` had three counting rules (v<=3 counted phase-1
    // RELEASES, v4 a `Help`'s ARRIVAL, v5+ any freeze's arrival) and both
    // scopings were justified by "the committed expectations of the ~8
    // frozen R3 collection fixtures say `saw_auto_advance: 0`". ⛔ Measured
    // at R7 slice 0 over all 118 expectation files: **none of them carries
    // the field.** They are exactly `{ticks, transitions}`. What asserts it
    // is THIS LINE, re-derived from the model on every run.
    //
    // So the fork unified the counter (one rule, every version: count a
    // freeze ARRIVAL) and this expectation drops its version arm to match.
    // Without the co-change the three v<=3 sword tapes — `r3-collect-sword`,
    // `r3-walk-1-sword`, `r3-walk-full` — go RED BY BEING CORRECT: they
    // report the `Help(3)` they always raised and always dismissed.
    //
    // ⚠ THE PRESS SCHEDULE DID NOT MOVE. `dispatchKey` is unconditional on
    // every version and stayed that way (the batch's stated refusal), so no
    // frozen frame shifted, no LFSR draw moved, and the roster is expected
    // BYTE-IDENTICAL. This is the whole of what changed.
    const swordPickups = (expected.collected ?? []).filter((c) => c.item === 'sword').length;
    const wantAutoAdvance = swordPickups;
    check(`${name}: dialogue auto-advance is exactly what the route earns`,
        status.saw_auto_advance === wantAutoAdvance,
        status.saw_auto_advance === wantAutoAdvance
            ? `saw_auto_advance=${status.saw_auto_advance}, and the route earns `
                + `${wantAutoAdvance}${swordPickups > 0
                    ? ` — ${swordPickups} sword pickup(s), each raising \`Sword.removed()\`'s`
                        + ' unguarded `Help(3)` (R7: counted on EVERY version)'
                    : ''}`
            : `saw_auto_advance=${status.saw_auto_advance} against ${wantAutoAdvance} earned `
                + `(${swordPickups} sword pickup(s), tape v${tape.tape_version}). `
                + (status.saw_auto_advance > wantAutoAdvance
                    ? 'A dialogue or Help the route was supposed to avoid froze the game, so '
                        + 'the proximity-hazard census missed something.'
                    : 'The route collected a sword and the game raised NO Help — so either '
                        + 'the pickup never fired or the counter has stopped seeing it.'));

    // ── ⛓⛓ AND ITS FIRST RUN FOUND WHAT IT WAS MISSING — R5 slice 11 ───
    //
    // The budget shipped counting `sealCollections` — R5's CHEST seal — and
    // nothing else, which was every ceremony the slice that wrote it had in
    // front of it. Its first contact with the roster (it was in a TDZ until
    // slice 11, so it had never run) reported 26 tapes OUT OF BAND, and
    // every one of them by an exact multiple of a constant already banked:
    //
    //   23 tapes   150 x items collected   the ORDINARY `special` pickup
    //                                      ceremony — which is what R3 and
    //                                      R4 exist to drive
    //    3 tapes   174 + 150 x spawned     `FallRockLarge`'s freeze in L32,
    //                                      plus the BobBoss's RUNTIME-SPAWNED
    //                                      reward, which is in no level's
    //                                      pickup list and so in no
    //                                      `collected` record
    //
    // ⛓⛓ AND THE INSTRUMENT REDISCOVERED TWO FACTS THE MODEL HAD ALREADY
    // WRITTEN DOWN AND NEVER FED IT. `MODEL_EXEMPT` has described the
    // runtime-spawned reward and the 174-frame rock since R5 slice 3, in
    // prose. An independent stratum converging on the record is the thing
    // §14's law keeps asking for, and it is the evidence that this budget
    // measures the world rather than the model's assumptions.
    //
    // ⚠ EVERY TERM COMES FROM A BANKED CONSTANT, none from a literal here:
    // `CEREMONY_DEAD_FRAMES.pickup` is the measured 150 and
    // `MODEL_EXEMPT[name].freezeFrames` is `rockSchedule().bossSpawnsAt`,
    // which runs the fall as a loop because the closed form rounds wrong.
    // ⛓⛓⛓ R6 SLICE 3: A DEATH IS A LOAD THE TRANSITION LIST CANNOT SEE.
    //
    // `restartLevel()` builds a whole new `Game` in the SAME level, so the
    // level field never changes and `deriveTransitions` — the one derivation
    // both sides share — reports nothing. Its fade is a real fade all the
    // same, so a run that died and was counted as `transitions + 1` would be
    // one whole load of dead frames over its ceiling. ⛔ AND THE FIX IS
    // TWO-SIDED: the term comes from the MODEL's `playerDeaths`, so a model
    // that invented a death the game did not take blows the band from the
    // other direction.
    // ⛓⛓⛓ R6 SLICE 6d: AND A SAME-LEVEL ENDING REBOOT IS A LOAD NOBODY CAN
    // SEE EITHER — the death's own argument, on the other two `Seed` arms.
    // `Seed.update`'s plain and tree arms are both `new Game(level, …)`, so
    // the level field never changes and `deriveTransitions` reports nothing;
    // W-seed pays THREE load fades against a transition list of zero. Read
    // from the MODEL's `endingReboots`, so a model that invented one blows
    // the band from the other direction.
    // ⛔ …EXCEPT THE TERMINAL ONE, AND THE FENCEPOST IS THE HARNESS'S.
    // `Bot.update` disarms at the TOP of the frame `tick >= tickCount`, and
    // W-seed's credits reboot happens LATER IN THAT SAME FRAME — so its load
    // fade is never counted, because by the time it starts the bot has
    // stopped looking. A reboot on the tape's last observation costs the
    // dead-frame ledger nothing; every earlier one costs a whole fade.
    const sameLevelReboots = (expected.endingReboots ?? [])
        .filter((r) => r.sameLevel && r.t < tape.tick_count).length;
    const loads = stream.transitions.length + 1 + (expected.playerDeaths?.length ?? 0)
        + sameLevelReboots;
    const sealFrames = (expected.sealCollections ?? [])
        .reduce((n, c) => n + (c.deadFrames ?? 0), 0);
    /**
     * Every ordinary `special` pickup the run walked ONTO.
     *
     * ⛔ STARTED, NOT COMPLETED — R6 slice 6d. `Pickup.pick_up()` raises the
     * freeze and counts `specialTimer` down on CONTACT, and it does not ask
     * whether the dialogue after it will ever be dismissed. `collected` is
     * the completion ledger, so a tape that ends mid-ceremony paid 150 dead
     * frames the term could not see: `r6-seed-control` reported 170 dead
     * against 0 modelled and blew the band by 150 on its first recording.
     * The two lists are identical for every fixture that finishes what it
     * starts, which is every fixture before this one.
     */
    const pickupFrames = (expected.ceremonyStarts ?? expected.collected ?? []).length
        * CEREMONY_DEAD_FRAMES.pickup;
    const exempt = MODEL_EXEMPT[name] ?? null;
    /** A reward spawned at RUNTIME freezes exactly like a placed pickup. */
    const spawnedFrames = (exempt?.earned ?? []).length * CEREMONY_DEAD_FRAMES.pickup;
    /** A freeze the tape's own exemption declares — the L32 rock. */
    const declaredFreeze = exempt?.freezeFrames ?? 0;
    const ceremonyFrames = sealFrames + pickupFrames + spawnedFrames + declaredFreeze;
    const modelled = (expected.frozenFramesOwed ?? 0) + ceremonyFrames;
    const residue = status.dead_frames - modelled;
    const { lo, hi } = fadeBand(loads);
    check(`${name}: the dead frames are accounted for`,
        residue >= lo && residue <= hi,
        `${status.dead_frames} dead = ${modelled} modelled `
        // ⚠ ITEMISED, not a single "ceremony" total. The failure this check
        // exists to diagnose is "which freeze is missing", and a lump sum
        // makes every one of them look the same — the 26 that failed its
        // first run were told apart by hand arithmetic off a single number.
        + `(${expected.frozenFramesOwed ?? 0} run freeze + ${sealFrames} seal + `
        + `${pickupFrames} pickup + ${spawnedFrames} spawned + ${declaredFreeze} declared) `
        + `+ ${residue} residue, against ${describeFadeBand(loads)}`
        + `${residue >= lo && residue <= hi ? '' : ' ⛔ OUT OF BAND — a '
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
    // ⚠ `exempt` is bound ONCE, up in the dead-frame budget — the budget
    // spends the same row's `earned` and `freezeFrames`, so two bindings of
    // the same lookup would be two places to keep in step.
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

    // ── ⛓⛓⛓ R6 SLICE 6d: THE WIN STATICS, AND THE FIRST TAPE TO MOVE ONE ──
    //
    // The baseline was "they stay false until R6 actually beats the game",
    // pinned so the terminal assertion had something to flip. W-blood is the
    // flip: `Seed.update`'s bloody arm sets `Game.cutscene[1] = true` on the
    // line above `FP.world = new Game(1, 64, 96, false)`.
    //
    // ⛔⛔ AND THE EXPECTATION IS DERIVED FROM THE MODEL, not from a new tape
    // field — `endingReboots` already says which arm ran and therefore which
    // `cutscene` slot it set. So the check is TWO-SIDED in the strong sense:
    // a run that declared no ending must leave every static false (the old
    // pin, unchanged), and a run whose model rebooted must find the flag SET
    // in the game or the arm never ran.
    //
    // ⛔ `menu` STAYS FALSE ON BOTH, and that is the sharpest thing here.
    // W-blood lands in L1 with `cutscene[1]` armed and parks 23.5 px from an
    // Oracle whose `doneTalking()` is `exitToMenu()`; a `menu = true` in this
    // window means the HARNESS walked that dialogue (trap 92), and the record
    // would be a claim about the instrument. `R6_BLOOD_MENU_DERIVATION`.
    // ⛔ THE COMPARISON IS AGAINST THE MODEL'S OWN FINAL ARRAY, not against
    // the arms it ran — because the tree arm SETS `[2]` on the way in and
    // CLEARS it on the way out (`Seed.as:78`, the only thing in the game
    // that does), so W-seed runs two reboots and finishes with every flag
    // false again. An expectation derived from "which arms fired" would
    // demand a `true` the game is right not to have.
    const modelCutscene = expected.cutscene ?? [false, false, false, false];
    const ranEnding = (expected.endingReboots ?? []).length > 0;
    if (!ranEnding) {
        check(`${name}: the win statics are still false`,
            status.menu === false && status.cutscene.every((c) => c === false),
            `menu=${status.menu}, cutscene=${JSON.stringify(status.cutscene)}`);
    } else {
        const same = JSON.stringify(status.cutscene) === JSON.stringify(modelCutscene);
        check(`${name}: \`Game.cutscene\` is exactly what the model's ending arms left`,
            same,
            same
                ? `cutscene=${JSON.stringify(status.cutscene)} after `
                + `${(expected.endingReboots ?? [])
                    .map((r) => `${r.arm} L${r.fromLevel}->L${r.toLevel}@${r.t}`)
                    .join(', ')}`
                : `cutscene=${JSON.stringify(status.cutscene)} against the model's `
                + `${JSON.stringify(modelCutscene)}. A flag the model set and the game `
                + 'did not means the terminal arm never ran; the other way round means '
                + 'a second arm fired that nothing accounts for.');
        if (expected.credits) {
            // ── ⛓⛓⛓ THE RUNG'S TERMINAL: "the game says it was beaten" ──
            //
            // `menu_state` is a DIRECT readout since slice 6a, so this is a
            // measurement rather than the elimination §8.8 had to settle
            // for. The elimination stays as the second stratum — the readout
            // says it is a menu with index 2, `R6_MENU_WRITERS` says the 2
            // came from the tree — and `menuWriterEliminations('W-seed')` is
            // asserted in vitest rather than restated here.
            check(`${name}: ⛓⛓⛓ THE CREDITS — the game's own \`menu_state\` reads 2`,
                status.menu === true && status.menu_state === expected.credits.menuState,
                status.menu === true && status.menu_state === expected.credits.menuState
                    ? `menu=true, menu_state=${status.menu_state} — the ladder's first `
                    + '"the game says it was beaten", conditional on the declared save '
                    + `state. The model reached it at tick ${expected.credits.t}`
                    : `menu=${status.menu}, menu_state=${status.menu_state} against the `
                    + `model's ${expected.credits.menuState}. \`menuState\` survives `
                    + '`Game`\'s constructor only because `Game.menu = true` is assigned '
                    + 'BEFORE the world (`end()`\'s `if (!menu) menuState = 0` would '
                    + 'wipe it), so a 0 here means the tree arm did not run.');
        } else {
            check(`${name}: …and no menu — the harness did not walk the Oracle`,
                status.menu === false,
                status.menu === false
                    ? 'menu=false with `cutscene[1]` armed in L1, which is the whole point '
                    + 'of ending the tape with no key edge: `Oracle.doneTalking()` under '
                    + 'that flag is `exitToMenu()`'
                    : 'menu=TRUE — something completed L1\'s Oracle dialogue. The tape '
                    + 'presses nothing after the reboot, so the only candidate is '
                    + '`Bot.autoAdvance` (trap 92) and this record is a claim about the '
                    + 'harness, not the game');
        }
    }

    // ── ⛓⛓⛓ R6 SLICE 3: WHAT THE RUN TOOK, FROM THE GAME'S OWN READOUT ──
    //
    // `hits` and `hits_timer` are R5-batch readouts that NOTHING consumed
    // until this slice — the arc's own "a readout with no reader is a
    // bounded vacuity" debt, paid. They are the terminal state of
    // `playerDamage`'s two counters, and asserting them turns every
    // `noDamage: false` tape into a check on the damage model rather than
    // only on the positions it produces.
    //
    // ⛔ ASSERTED ON EVERY TAPE, not only the ones that take damage. A
    // guarded tape reporting `hits: 0` is the NEGATIVE control for the whole
    // model: a build in which `Bot.noDamage` had stopped working would move
    // this number on ninety-nine fixtures at once, and no position
    // comparison would say why.
    //
    // ⚠ `hits` is a Number in the game (`WandShot` damage is 0.5), so this
    // compares numerically and not by identity of ints.
    if (status.hits !== undefined) {
        check(`${name}: the game's own \`hits\` matches the damage model`,
            status.hits === expected.damage.hits,
            `game: ${status.hits}, model: ${expected.damage.hits}`
            + `${expected.playerHits.length ? ` (${expected.playerHits.length} landed hit(s), `
                + `${expected.playerDeaths.length} death(s) — a death RESETS \`hits\`, so a `
                + 'mismatch here can be a death the model placed on the wrong tick)' : ''}`);
        // ⛔⛔⛔ `hits_timer` IS **NOT** DRAIN-STABLE, AND THE NEW CHECK
        // FOUND THAT ON ITS FIRST NON-ZERO TAPE.
        //
        // `r6-contact-pair-standing` ends mid-window: the model says 1 and
        // the game said 0, with all 91 observations byte-identical. The
        // model is not wrong — `hitUpdate()` runs in `Player.update`, which
        // keeps running after the tape's last observation, and the drain
        // happens some unbounded number of engine frames later. A countdown
        // is exactly the quantity a few extra frames destroys, and no
        // positional comparison could ever have shown it. ⇒ THE SOUND
        // COMPARISON IS A BOUND, not an equality:
        //
        //   · the game's value may only be LOWER (more frames elapsed);
        //   · a model that says the window is SHUT must find it shut, or
        //     the model missed a hit entirely.
        //
        // ⚠ AND THE WEAK DIRECTION IS NAMED: a model that thought the
        // window LONGER than it is passes this bound. What catches that is
        // the position stream — the steering gap between two hits is the
        // window, and it is compared tick for tick.
        //
        // The `hits` equality above is safe by contrast: nothing moves it
        // after the tape stops except a further hit, and that would fail the
        // equality loudly rather than quietly.
        const timerOk = status.hits_timer <= expected.damage.hitsTimer
            && (expected.damage.hitsTimer !== 0 || status.hits_timer === 0);
        check(`${name}: the game's own \`hits_timer\` is inside the i-frame window`,
            timerOk,
            `game: ${status.hits_timer}, model: ${expected.damage.hitsTimer}`
            + `${status.hits_timer < expected.damage.hitsTimer
                ? ` (${expected.damage.hitsTimer - status.hits_timer} frame(s) of drain gap `
                  + '— `hitUpdate` keeps running after the tape\'s last observation)' : ''}`);
    }

    // ── ⛓⛓⛓ R7 SLICE 1: `botStatus.save`, CONSUMED AT LAST (R6 debt 6) ─
    //
    // `Bot.saveReadout()` has shipped since R5 slice 23, live off
    // `Player.hasTotemPart(i)` / `Player.hasKey(i)` / `Main.hasSealPart(i)`,
    // and the sweep read fourteen other `botStatus` fields and not this one.
    // So the sixteen BOOTED seals and every DRIVEN key collect were asserted
    // from the model side and the observation stream, never from the game's
    // own save array — `botMobiles`' shape of debt, one readout later.
    //
    // ⛔ THE READOUT MUST BE PRESENT. A build without it would make every
    // assertion below vacuously true by comparing undefined to undefined,
    // which is the failure the R0 acceptance-signal check exists to prevent.
    if (status.save !== undefined) {
        const want = expected.saveState;
        const gameKeys = (status.save.keys ?? []).map(Boolean);
        const gameTotem = (status.save.totem_parts ?? []).map(Boolean);
        const gameSeals = (status.save.seal_parts ?? []).map(Number);
        if (!want) {
            check(`${name}: the model reports a save state to check against`, false,
                'runTape returned no `saveState` — the v1 engine ran (noclip with no '
                + 'levelSource), so the game\'s array has nothing to be compared with');
        } else {
            // ⛓ KEYS ARE AN EQUALITY, and they are the strong arm: the model
            // knows every key it booted with (the v6 `save` block) and every
            // key a ceremony earned (`BossKey.removed()` writes
            // `Player.hasKeySet(keyType, true)`), so both directions are
            // real. A key the game holds and the model does not is an
            // unmodelled collection; the reverse is a ceremony that never
            // completed.
            check(`${name}: the game's own \`hasKey\` array matches the model`,
                gameKeys.join(',') === want.keys.join(','),
                `game: [${gameKeys}], model: [${want.keys}]`
                + `${gameKeys.join(',') === want.keys.join(',') ? '' : ' — a key the '
                    + 'model does not hold was collected (or a ceremony the model '
                    + 'completed never wrote its flag)'}`);
            // ⛓ SAME FOR THE TOTEM PARTS, and this arm found its own defect:
            // the census carried a `bosskey`'s `keyType` and NOT a
            // `totempart`'s index, so the model could never have said which
            // of the five moved. Fixed in this batch (`levelWorld`'s pickup
            // row) — the consumer is what made the silence visible, which is
            // debt 6's whole shape.
            check(`${name}: the game's own \`hasTotemPart\` array matches the model`,
                gameTotem.join(',') === want.totem_parts.join(','),
                `game: [${gameTotem}], model: [${want.totem_parts}]`);
            // ⛔⛔ THE SEALS ARE A SHAPE CLAIM, NOT AN IDENTITY ONE, AND
            // SAYING SO IS THE POINT. `Chest.open()` picks the identity with
            // a REJECTION SAMPLER — `floor(Math.random()*16)` redrawn until
            // `getSealPart` finds an unused slot, the commit being a side
            // effect inside the predicate — so which seal lands in which slot
            // is a fact about the run's stream position. What the model does
            // know, exactly:
            //
            //   · the boot-declared prefix is untouched (positional, v6);
            //   · one slot fills per chest OPENED (not per ceremony
            //     completed — the identity commits at open, so open-and-die
            //     still awards it);
            //   · every filled slot holds a legal, UNIQUE identity in 0..15
            //     and every empty one holds -1, because the sampler cannot
            //     produce anything else.
            //
            // An equality check here would be a check that could only pass by
            // accident, and a skipped check would be a silence.
            const filled = gameSeals.filter((v) => v !== -1);
            const wantFilled = want.bootSealParts.length + want.sealSlotsEarned;
            const prefixOk = want.bootSealParts
                .every((id, i) => gameSeals[i] === id);
            const uniqueOk = new Set(filled).size === filled.length
                && filled.every((v) => v >= 0 && v < gameSeals.length);
            const compactOk = gameSeals.slice(filled.length).every((v) => v === -1);
            check(`${name}: the game's own \`hasSealPart\` array has the shape the run earns`,
                filled.length === wantFilled && prefixOk && uniqueOk && compactOk,
                `game: [${gameSeals}] — ${filled.length} filled against `
                + `${want.bootSealParts.length} booted + ${want.sealSlotsEarned} chest(s) `
                + `opened${prefixOk ? '' : '; the BOOTED PREFIX MOVED'}`
                + `${uniqueOk ? '' : '; a repeated or out-of-range identity, which the '
                    + 'rejection sampler cannot produce'}`
                + `${compactOk ? '' : '; a -1 BELOW a filled slot, which `getSealPart` '
                    + '(first empty slot wins) cannot produce'}`
                + ' (identities are RNG at chest OPEN and are not predicted)');
        }
    } else {
        check(`${name}: botStatus carries the save readout`, false,
            '`save` is missing — this is a pre-R5-slice-23 build, and every save '
            + 'assertion would be vacuous against it');
    }

    // ── ⛓ R7 SLICE 1: THE EDGE ECHO (R6 debt 4) ───────────────────────
    //
    // The debt asks for "one boolean that separates the candidate mechanisms
    // in one run" — did the GAME see the edge on the tick the tape named.
    // `Bot.recordEdges` latches `Input.pressed`/`released`/`check` at the top
    // of each armed tick, so the totals are what the game actually received.
    //
    // ⛔ ASSERTED AGAINST THE TAPE'S OWN SPANS, which is what makes it a
    // check rather than a printout: every span is one press and one release,
    // so the totals are `spans per key` — EXCEPT for `primary`, which
    // `autoAdvance` also dispatches, and there the tape's count is a LOWER
    // BOUND. A key whose totals fall short means an edge the game never saw.
    if (status.input && status.input.press_totals) {
        const spansPerKey = {};
        for (const span of tape.inputs) {
            spansPerKey[span.key] = (spansPerKey[span.key] ?? 0) + 1;
        }
        // ⚠ EVERY span is observable, including one ending exactly at
        // `tick_count`: `recordEdges` runs after the dispatch loops and
        // BEFORE the disarm, so the final tick's release is latched too.
        // `autoAdvance`'s presses are NOT — they fire on DEAD frames, which
        // return before the echo — so `primary` may only ever run OVER.
        const short = Object.entries(spansPerKey)
            .filter(([k, n]) => (status.input.press_totals[k] ?? 0) < n
                || (status.input.release_totals[k] ?? 0) < n)
            .map(([k, n]) => `${k}: ${status.input.press_totals[k] ?? 0} press / `
                + `${status.input.release_totals[k] ?? 0} release against ${n} span(s)`);
        check(`${name}: the game saw every edge the tape dispatched`,
            short.length === 0,
            short.length === 0
                ? `${Object.entries(spansPerKey).map(([k, n]) => `${k} x${n}`).join(', ')
                    || '(no spans)'} — all seen`
                + `${(status.input.press_totals.primary ?? 0) > (spansPerKey.primary ?? 0)
                    ? `; primary +${(status.input.press_totals.primary ?? 0)
                        - (spansPerKey.primary ?? 0)} from autoAdvance` : ''}`
                : `${short.join('; ')} — an edge was dispatched and the game never `
                    + 'reported seeing it');
    }

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

    // ── ⛓⛓⛓ R6 SLICE 4: THE BOSS-KILL LEDGER, FROM THE GAME'S OWN ARRAY ──
    //
    // The rung's HEADLINE (§3.1) is "kills by persistence tag, asserted
    // from the game's own persistence readout", and this is where it is
    // asserted. `BossTotem.removed()` runs `Game.setPersistence(tag,
    // false)`, so a kill lands in `persistence_cleared` exactly like a
    // touch-lock's open — the polarity is a CLEAR, not a set.
    //
    // ⛔⛔ AND THE NEGATIVE ARM IS ASSERTED TOO, on every tape that reaches
    // a boss room without killing anything. `r6-totem-control` lands NINE of
    // the ten shots and its whole claim is that `{43,5}` stayed SET — which
    // is a statement about the game's array and not about the model's, so
    // it is checked here rather than only in vitest. A one-sided ledger
    // ("every kill wrote its flag") would pass on a build that cleared the
    // flag for every visitor.
    if ((expected.bossKills ?? []).length > 0) {
        const missing = expected.bossKills
            .filter((k) => k.flag && !clearedInGame.has(`${k.flag.level}:${k.flag.tag}`))
            .map((k) => `${k.id} (${k.flag.level}:${k.flag.tag})`);
        check(`${name}: every boss the run KILLED wrote its persistence flag`,
            missing.length === 0,
            missing.length === 0
                ? `${expected.bossKills.map((k) => `${k.id} -> ${k.flag.level}:${k.flag.tag} `
                    + `(kill ${k.killTick}, tag ${k.tagTick})`).join(', ')} off`
                : `${missing.join(', ')} still SET — the model killed a boss the game did `
                + 'not, or `removed()` never ran (the white-out is 240 RENDER frames and '
                + 'the tape may have stopped inside it)');
    } else if ((expected.bossWalks ?? []).length > 0) {
        // The run woke a boss and did NOT kill it: its tag must still be on.
        const wronglyCleared = [...clearedInGame]
            .filter((k) => k === '43:5');
        check(`${name}: the boss the run did NOT kill kept its flag`,
            wronglyCleared.length === 0,
            wronglyCleared.length === 0
                ? '{43,5} still set, with the boss awake and walking'
                : `${wronglyCleared.join(', ')} CLEARED by a run that never killed him`);
    }

    // ── ⛓⛓⛓ R6 SLICE 5: THE SHIELDSPIRE'S ROW OF THE SAME LEDGER ─────
    //
    // ⛔ AND ITS WRITE SITE IS NOT `removed()`. `ShieldBoss.startDeath` is
    // `Game.setPersistence(tag, false); play("die")` — the flag is written
    // by the killing HIT, 34 ticks before the body leaves the world. So a
    // tape that stops between the two still owes `{19,0}` in the game's
    // array, which is the OPPOSITE fencepost from the totem's (whose flag
    // lands 241 ticks after the kill and whose tape must NOT stop early).
    //
    // ⛔⛔ TWO-SIDED, like the totem's. `r6-shield-control` lands two of the
    // three hits and its whole claim is that `{19,0}` stayed SET — and it
    // is a claim about the GAME's array, so a build that cleared the flag
    // for every visitor would pass a one-sided check.
    const shieldKills = (expected.shieldBossKills ?? []).filter((k) => k.what === 'tag');
    const shieldSaw = (expected.shieldBossBand ?? []).length > 0;
    if (shieldKills.length > 0) {
        const missing = shieldKills
            .filter((k) => k.flag && !clearedInGame.has(`${k.flag.level}:${k.flag.tag}`))
            .map((k) => `${k.id} (${k.flag.level}:${k.flag.tag})`);
        check(`${name}: every ShieldBoss the run KILLED wrote its persistence flag`,
            missing.length === 0,
            missing.length === 0
                ? shieldKills.map((k) => `${k.id} -> ${k.flag.level}:${k.flag.tag} off at `
                    + `tick ${k.t} (destroy ${k.destroyTick}, removed ${k.removedTick})`)
                    .join(', ')
                : `${missing.join(', ')} still SET — the model killed a ShieldBoss the `
                + 'game did not. `startDeath` writes the flag INSIDE the killing hit, so '
                + 'this cannot be a tape that stopped too early.');
    } else if (shieldSaw) {
        // The run stood in the band and did NOT finish him: the tag stays on.
        const wronglyCleared = [...clearedInGame].filter((k) => k === '19:0');
        check(`${name}: the ShieldBoss the run did NOT kill kept its flag`,
            wronglyCleared.length === 0,
            wronglyCleared.length === 0
                ? '{19,0} still set, with the fight driven and unfinished'
                : `${wronglyCleared.join(', ')} CLEARED by a run that never killed him`);
    }

    // ── ⛓⛓⛓ R6 SLICE 6c: THE WATCHER'S ROW — NOT A KILL ──────────────
    //
    // `Watcher.doneTalking()` is `if (Game.checkPersistence(tag))
    // Game.setPersistence(tag, false)`, so `{114,0}` lands in
    // `persistence_cleared` with the same polarity as every other row on
    // this ledger and a completely different cause: a dialogue read to its
    // last page.
    //
    // ⛔⛔ TWO-SIDED, and this pair needs it more than the fights do.
    // `r6-watcher-control` is ONE X release short of twenty pages and its
    // whole claim is that `{114,0}` stayed SET — a claim about the game's
    // array, not the model's. And the negative arm is checked from the
    // presence of a WATCHER IN THE ROOM (`watcherSeedLive`, or a live
    // dialogue) rather than from "the model wrote nothing", because "the
    // model wrote nothing" is exactly what a broken model says.
    const talks = expected.watcherTalks ?? [];
    const sawWatcher = talks.length > 0 || (expected.watcherSeedLive ?? []).length > 0;
    if (talks.length > 0) {
        const missing = talks
            .filter((k) => !clearedInGame.has(`${k.flag.level}:${k.flag.tag}`))
            .map((k) => `${k.id} (${k.flag.level}:${k.flag.tag})`);
        check(`${name}: every Watcher the run talked out wrote its persistence flag`,
            missing.length === 0,
            missing.length === 0
                ? talks.map((k) => `${k.id} -> ${k.flag.level}:${k.flag.tag} off at tick `
                    + `${k.t} (cause ${k.cause}, page ${k.page} of ${k.pages})`).join(', ')
                : `${missing.join(', ')} still SET — the pages are exhausted in the `
                + 'model and nothing wrote in the game. `doneTalking()` runs from the '
                + '`talking` '
                + 'SETTER, so a page count one short leaves the flag alone.');
    } else if (sawWatcher) {
        const wronglyCleared = [...clearedInGame].filter((k) => k === '114:0');
        check(`${name}: the Watcher the run did NOT talk out kept its flag`,
            wronglyCleared.length === 0,
            wronglyCleared.length === 0
                ? '{114,0} still set, with the dialogue driven and unfinished'
                : `${wronglyCleared.join(', ')} CLEARED by a run that never exhausted `
                + 'the pages — either the model is a page out, or the run left the 24 px '
                + 'circle, which runs `doneTalking()` through the `talking` setter and '
                + 'earns the flag for nothing (trap 102)');
    }

    // ── ⛓⛓⛓ R6 SLICE 6c: THE FINAL DOOR'S ROW ────────────────────────
    //
    // `FinalDoor.removed()` is `Game.setPersistence(tag, false)` and
    // `animEnd` is its only caller, so `{113,0}` lands in
    // `persistence_cleared` on the same tick the 32x32 body stops
    // colliding — the OPPOSITE fencepost from the ShieldBoss's, whose flag
    // precedes its corpse by 34 ticks.
    //
    // ⛔⛔ TWO-SIDED, and the negative arm is checked from the CEREMONY
    // rather than from the absence of a write. `r6-final-door-control`
    // approaches the door and fires the SealController exactly as the drive
    // does — the overlay is unconditional — and its whole claim is that
    // `{113,0}` stayed SET because `!checkPersistence(0, 114)` was false.
    // "The model wrote nothing" is what a broken model also says; "the model
    // ran the ceremony and wrote nothing" is a claim.
    const doorFlags = expected.finalDoorFlags ?? [];
    const sawDoor = (expected.doorCeremonies ?? []).length > 0;
    if (doorFlags.length > 0) {
        const missing = doorFlags
            .filter((f) => !clearedInGame.has(`${f.level}:${f.tag}`))
            .map((f) => `${f.id} (${f.level}:${f.tag})`);
        check(`${name}: every FinalDoor the run opened wrote its persistence flag`,
            missing.length === 0,
            missing.length === 0
                ? doorFlags.map((f) => `${f.id} -> ${f.level}:${f.tag} off`).join(', ')
                + ` (open ${(expected.doorEvents ?? []).find((e) => e.what === 'open')?.t}, `
                + `removed ${(expected.doorEvents ?? []).find((e) => e.what === 'removed')?.t})`
                : `${missing.join(', ')} still SET — the model opened a door the game did `
                + 'not. `animEnd` fires on graphic update 57 and the play frame is update '
                + '1, so a model one tick out here is a model one tick out everywhere.');
    } else if (sawDoor) {
        const wronglyCleared = [...clearedInGame].filter((k) => k === '113:0');
        check(`${name}: the FinalDoor the run did NOT open kept its flag`,
            wronglyCleared.length === 0,
            wronglyCleared.length === 0
                ? '{113,0} still set, with the approach driven and the seal ceremony run'
                : `${wronglyCleared.join(', ')} CLEARED by a run whose second condition `
                + '(`!checkPersistence(0, 114)`, the Watcher) was never met');
    }

    // ── ⛓⛓⛓ R6 SLICE 6h: THE OWL'S TWO — THE RUNG'S LAST LEDGER ROWS ──
    //
    // `FinalBoss.endAnim`'s "dead" arm writes BOTH `{112,0}` and `{112,1}`
    // (`setPersistence(tag, false)` twice), 109 ticks after the kill — so the
    // pair lands in `persistence_cleared` together or not at all, and a model
    // one tick out on either fencepost of the die/dead chain writes neither.
    //
    // ⛔⛔ TWO-SIDED, and the negative arm needs the FIGHT and not just the
    // room. The Owl is `onlyHitBy = "Lava"`: nothing the player does can
    // damage him, so "no flag was written" is what a run that never entered
    // L112 also reports. `r6-owl-control` is the same tape with the THIRD
    // press deleted — it lands two of the three lava self-hits, the Owl
    // survives on `hits` 2 of 3, and its whole claim is that both flags
    // stayed SET. That is a statement about the game's own array.
    const owlFlags = expected.finalBossFlags ?? [];
    const owlLava = (expected.finalBossLava ?? []).filter((l) => l.landed);
    if (owlFlags.length > 0) {
        const missing = owlFlags
            .filter((f) => !clearedInGame.has(`${f.level}:${f.tag}`))
            .map((f) => `${f.id} (${f.level}:${f.tag})`);
        const tags = (expected.finalBossKills ?? []).find((k) => k.what === 'tagsWritten');
        const kill = (expected.finalBossKills ?? []).find((k) => k.what === 'startDeath');
        check(`${name}: every FinalBoss the run killed wrote BOTH persistence flags`,
            missing.length === 0 && owlFlags.length === 2,
            missing.length === 0
                ? `${owlFlags.map((f) => `${f.level}:${f.tag}`).join(' + ')} off, `
                + `${owlLava.length} lava self-hit(s), kill at tick ${kill?.t} -> tags at `
                + `${tags?.t} (${tags?.t - kill?.t} ticks — the die/dead chain)`
                : `${missing.join(', ')} still SET — the model ran endAnim's "dead" arm `
                + 'and the game did not. The chain is `play("die")` inside `update()` '
                + '(48 ticks) then `play("dead")` inside the die CALLBACK (61 more), and '
                + 'either fencepost being one out writes neither flag.');
    } else if (owlLava.length > 0) {
        const wronglyCleared = [...clearedInGame]
            .filter((k) => k === '112:0' || k === '112:1');
        check(`${name}: the FinalBoss the run did NOT kill kept both flags`,
            wronglyCleared.length === 0,
            wronglyCleared.length === 0
                ? `{112,0} and {112,1} still set, with ${owlLava.length} of 3 lava `
                + 'self-hits driven and the Owl alive'
                : `${wronglyCleared.join(', ')} CLEARED by a run that landed only `
                + `${owlLava.length} of the three lava self-hits — either the model is a `
                + 'shove short, or something other than `endAnim` writes this pair');
    }

    // ── ⛓⛓⛓ R6 SLICE 6d: THE ENDING REBOOT — A ROW WITH NO FLAG IN IT ──
    //
    // Every other line of this ledger is a persistence write. W-blood has
    // none: `Seed` overrides `removeSelf` with two lines that never reach
    // `removed()`, so the pickup grants nothing and clears nothing. What it
    // does instead is move the player to another ROOM, and the game's own
    // level field is where that shows up.
    //
    // ⛔⛔ TWO-SIDED, and the negative arm is checked from the HIT that did
    // not spawn a seed rather than from the absence of a reboot.
    // `r6-watcher-blood-control` lands three of the four hits — the sword
    // reaches him, the counter moves, `hitsTimer` refuses four tests per
    // press exactly as on the drive — and its whole claim is that
    // `hits > dieFrames.length` was never met. "The model rebooted nothing"
    // is what a broken model says too; "the model swung three times and
    // rebooted nothing" is a claim.
    // ⛔ CROSS-LEVEL ONLY. `deriveTransitions` reads the observation
    // stream's LEVEL field, so a `Seed` arm that reboots into the same room
    // is invisible to it by construction — W-seed's two reboots produce
    // zero transitions and that is correct, not a divergence. Their witness
    // is the DEAD-FRAME BAND (one load fade each, via `sameLevel`) and the
    // `cutscene` array, both checked above.
    const reboots = (expected.endingReboots ?? []).filter((r) => !r.sameLevel);
    const swung = (expected.watcherHits ?? []).filter((h) => h.landed);
    if (reboots.length > 0) {
        const want = reboots.map((r) => `${r.fromLevel}->${r.toLevel}`).join(', ');
        const got = stream.transitions.map((t) => `${t.from_level}->${t.to_level}`).join(', ');
        check(`${name}: the game took the ending reboot the model ordered`,
            want === got,
            want === got
                ? `${got} at tick(s) ${stream.transitions.map((t) => t.t).join(', ')} — `
                + `derived from the GAME's own level field, against the model's `
                + `${reboots.map((r) => `${r.arm}@${r.t}`).join(', ')}`
                : `the model ordered ${want} and the game's stream shows ${got}. A `
                + '`Seed` terminal arm is a `FP.world = new Game(...)` written inside a '
                + 'pickup: if the game did not take it, the cover fade never reached '
                + '`coverAlpha >= 1` and the ceremony is a different length.');
    } else if (swung.length > 0) {
        check(`${name}: the Watcher the run did NOT finish rebooted nothing`,
            stream.transitions.length === 0,
            stream.transitions.length === 0
                ? `${swung.length} hit(s) landed and the run never left level `
                + `${swung[0].level} — one short of \`hits > dieFrames.length\``
                : `${swung.length} hit(s) landed and the game changed level `
                + `(${stream.transitions.map((t) => `${t.from_level}->${t.to_level}`)
                    .join(', ')}) — the seed spawned in the game and not in the model, `
                + 'so the hit counter is a hit out.');
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
        // ⛓ R7 slice 2: ENDS-MEET v2. `chainFindings` needs the TAPES as
        // well as the replays — the boot side of every seam is the
        // successor tape's own eight blocks — so they are loaded here from
        // the same `loadTape` the sweep used, never re-derived.
        ...playthroughAcceptanceFindings(
            new Map([...replayed.keys()].map((n) => [n, loadTape(n)])), replayed),
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
        const { stream, status, seam } = replayOnWindows(name, tapeObj);
        return { stream: withDerivedTransitions(name, stream), status, seam };
    }
    const page = await freshPage();
    try {
        const loaded = await botOn(page, 'botLoadTape',
            JSON.stringify(gameVisibleTape(tapeObj)));
        if (loaded !== 'ok') throw new Error(`botLoadTape(${name}): ${loaded}`);
        const started = await botOn(page, 'botStart');
        if (started !== 'ok') throw new Error(`botStart(${name}): ${started}`);

        const status = await waitFor(page, `tape ${name} to finish`, async () => {
            const st = await botJsonOn(page, 'botStatus');
            return st.finished ? st : null;
        }, deadlineFor(tapeObj.tick_count, modelDeadFrames(name, tapeObj)));

        const drained = await botJsonOn(page, 'botDrain');
        // ⛓ R7 slice 1: the seam latch, read ONCE after the tape finished —
        // its own callback for `botMobiles`' reason (a few KB on a poll that
        // shares the update/render thread the dead-frame band rides on). A
        // build without it returns null, which `checkSeamLatch` reports as a
        // FAILURE rather than skipping: an absent readout that makes every
        // assertion below it vacuous is the one shape a gate must not have.
        const rawSeam = await botOn(page, 'botSeam');
        const seam = rawSeam === null ? null : JSON.parse(rawSeam);
        return { stream: withDerivedTransitions(name, drained), status, seam };
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
    // ⛔ THE TIER LIST IS ASSERTED AGAINST THE WHOLE ROSTER, ALWAYS — even
    // under `--only`, and even at `--tier=full` which never skips anything.
    // A demotion list whose names no longer exist demotes nothing and reads
    // exactly like one that works, so the check must not be reachable only
    // from the tier that uses it. See `fixtures/tiers.js`.
    try {
        assertTiersComplete(allNames);
        check('the tier assignment still names real fixtures',
            true, `${LEGACY_TAPES.length} legacy, ${allNames.length - LEGACY_TAPES.length} gate`);
    } catch (e) {
        check('the tier assignment still names real fixtures', false, e.message);
    }
    // ⛔ THE SAME RULE FOR THE CHAINS, and for the same reason: a chain
    // naming a tape that no longer exists asserts nothing and prints the
    // same green as one that works. Asserted against the WHOLE roster, not
    // the `--only` selection — a narrowed sweep must not narrow this.
    try {
        const r = assertChainsWellFormed(allNames);
        check('the playthrough chains still name real fixtures', true,
            `${r.chains} chain(s), ${r.segments} segment(s), ${r.seams} seam(s)`);
    } catch (e) {
        check('the playthrough chains still name real fixtures', false, e.message);
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
    } else if ((TIER === 'gate' || TIER === 'legacy') && ONLY.size === 0) {
        names = tapesInTier(TIER, allNames);
        const skipped = allNames.filter((n) => !names.includes(n));
        console.log(`TIER ${TIER}: ${names.length} tape(s); NOT RUN HERE `
            + `(run them with --tier=${TIER === 'gate' ? 'legacy' : 'gate'} or `
            + `--tier=full): ${skipped.join(', ')}`);
        if (TIER === 'gate') {
            // ⚠ The coverage the demotion bounded, restated on every run that
            // benefits from it. A bounded sweep must name what it bounded,
            // and the place to name it is the run that is doing the bounding.
            console.log(`  ⚠ COVERAGE NOT IN THIS TIER: level(s) `
                + `${LEGACY_ONLY_LEVELS.join(', ')} are reached by no gate tape.`);
        }
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
        const { stream, status, seam } = result;
        replayed.set(name, { stream, status, seam });

        // ── ⛓⛓⛓ R7 SLICE 1: THE SEAM LATCH, ON EVERY TAPE ─────────────
        //
        // The batch's headline instrument, and the roster is its first
        // customer. No fixture here ends at a calm ARRIVAL — that convention
        // arrives with the segments — so the invariants are REPORTED and not
        // required (`requireCalm: false`). What IS required on all 118 is the
        // part that would otherwise ship dark, which is exactly the debt-6
        // shape this batch is paying off elsewhere: the latch FIRES, it is
        // WHOLE (not a failure disarm's partial), and it carries EVERY
        // signature row.
        //
        // ⛔ A missing envelope is a FAILURE, never a skip. A build without
        // `botSeam` would make every seam assertion in slice 2 vacuous, and
        // "the readout must be present" is the R0 acceptance-signal law.
        // ⛓⛓ R7 SLICE 2: `requireCalm` IS NOW A BRANCH, and this is the
        // line the segment convention lives on. A committed R1..R6 fixture
        // ends wherever its window ended, so its invariants are REPORTED;
        // a SEGMENT claims a level arrival by construction (§3.1), so the
        // spent fade, the zero shake, the absent freeze/dialogue/menu and
        // the zero-velocity fresh Player are REQUIRED of it. The six
        // predicates are `r7Acceptance`'s, already mutation-tested — this
        // consumes them, it does not restate them.
        const isSegment = isPlaythroughSegment(name);
        const latchRows = seamLatchFindings(seam ?? null, { requireCalm: isSegment });
        const unclaimed = latchRows.filter((r) => !r.ok);
        check(`${name}: the seam latch fired and carries the whole signature`
            + `${isSegment ? ', AT A CALM ARRIVAL' : ''}`,
            unclaimed.length === 0,
            unclaimed.length === 0
                ? `${Object.keys(seam.seam).length} field(s) latched at tick `
                    + `${seam.seam['latch.tick']} (${latchRows.length - 1} signature rows)`
                : `${unclaimed.length} row(s) not claimed: `
                    + `${unclaimed.slice(0, 6).map((r) => `${r.name} [${r.detail}]`).join('; ')}`
                    + `${unclaimed.length > 6 ? ` …and ${unclaimed.length - 6} more` : ''}`);
        // ⛓ AND THE MARKER AGREES WITH THE BLOCK. `botStatus.seam` is a
        // three-field marker served by a DIFFERENT callback from the block
        // itself; two readouts of one latch that could disagree are two
        // readouts nobody can trust. Cheap, and it is the only thing that
        // says the split was done right.
        if (status.seam) {
            check(`${name}: botStatus's seam marker agrees with botSeam's block`,
                status.seam.latched === Boolean(seam?.latched)
                && status.seam.partial === Boolean(seam?.partial),
                `marker {latched: ${status.seam.latched}, partial: ${status.seam.partial}} `
                + `vs block {latched: ${seam?.latched}, partial: ${seam?.partial}}`);
        }
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
        // ⛓⛓⛓ R6 SLICE 6d ADDS A THIRD WAY TO EARN IT, and it is the
        // longest-lived: `Game.as:956`'s `cutscene[1]` arm writes
        // `p.receiveInput = false` on EVERY frame from the bloody reboot to
        // the end of the tape. A pit transport is ~83 px of falling and a
        // ShieldLock is ~101 ticks; this one never ends.
        const endingReboots = expectedRun?.endingReboots ?? [];
        const causes = [
            ...(transports.length ? [`${transports.length} pit transport(s)`] : []),
            ...lockSnaps.map((s) => `${s.id} for ${s.ticks} tick(s)`),
            // ⛓ TWO SHAPES, ONE LINE. `cutscene[1]` walks the player north
            // with `receiveInput = false`; `cutscene[2]` adds
            // `active = false` and holds them still. Both write the first
            // term of `Player.input()`'s guard, and the tree arm's reboot
            // (which CLEARS the flag) is the one that does not.
            ...endingReboots.filter((r) => r.arm !== 'tree').map((r) => `the `
                + `cutscene[${r.cutscene}] ${r.arm === 'bloody' ? 'scripted walk' : 'tree hold'} `
                + `from tick ${r.t} in L${r.toLevel}`),
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
        if (ok) writePayload(name, stream, status, seam);
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
