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
 */

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
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
    runTape,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeRunner.js'));

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
const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

let failures = 0;
function check(name, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures++;
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

    const out = execFileSync(WIN_PY, [
        '-3.12', `${WIN_SCRATCH_DOS}\\seedling-bot-replay-win.py`,
        '--url', PAGE_URL,
        '--tape', `${WIN_SCRATCH_DOS}\\tape-${name}.json`,
        '--out', `${WIN_SCRATCH_DOS}\\stream-${name}.json`,
        '--deadline-sec', String(Math.ceil(deadlineFor(tapeObj.tick_count) / 1000)),
    ], { cwd: WIN_SCRATCH_WSL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

    // cmd.exe/py.exe launched from a WSL cwd emit a harmless UNC warning.
    const clean = out.replace(/\r/g, '').split('\n')
        .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l));
    clean.forEach((l) => console.log(`    ${l}`));
    if (!existsSync(outWsl)) {
        throw new Error(`windows driver wrote no stream for ${name}`);
    }
    return JSON.parse(readFileSync(outWsl, 'utf8'));
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
function checkReadout(name, tape, status) {
    if (!status || typeof status !== 'object') {
        check(`${name}: botStatus is readable`, false, 'no status object');
        return;
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
    if (!hasReadout) return;

    check(`${name}: no dialogue auto-advance fired`, status.saw_auto_advance === 0,
        status.saw_auto_advance === 0 ? 'saw_auto_advance=0'
            : `saw_auto_advance=${status.saw_auto_advance} — a ceremony the route was `
            + 'supposed to avoid froze the game, so the proximity-hazard census missed '
            + 'something');

    // The JS side's expectation for this tape, from the same tape the game
    // just ran. `runTape` throws if a grant never fires, so a stale route is
    // caught before the comparison rather than by it.
    const expected = runTape(tape, { levelSource: atlasLevelSource() });

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
    const wrong = Object.entries(expected.inventory)
        .filter(([prop, want]) => status.items[prop] !== want)
        .map(([prop, want]) => `${prop}: game ${status.items[prop]}, expected ${want}`);
    check(`${name}: all 14 item properties match, positives and negatives`,
        wrong.length === 0, wrong.length ? wrong.join('; ')
            : `hitsMax=${status.items.hitsMax}, `
            + `${Object.values(expected.inventory).filter((v) => v === true).length} `
            + 'flag(s) true');

    // The win statics stay false until R6 actually beats the game. Pinned
    // here so the terminal assertion has a baseline rather than being
    // introduced at the rung that needs it to flip.
    check(`${name}: the win statics are still false`,
        status.menu === false && status.cutscene.every((c) => c === false),
        `menu=${status.menu}, cutscene=${JSON.stringify(status.cutscene)}`);
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

    if (ONLY.size > 0) {
        // A misspelled --only would otherwise "pass" by sweeping nothing.
        const unknown = [...ONLY].filter((n) => !allNames.includes(n));
        check('every --only name is a real fixture', unknown.length === 0,
            unknown.length ? `unknown: ${unknown.join(', ')}` : `${ONLY.size} selected`);
    }
    const names = ONLY.size > 0 ? allNames.filter((n) => ONLY.has(n)) : allNames;

    for (const name of names) {
        const tape = loadTape(name);
        let result;
        const t0 = Date.now();
        try {
            result = await replay(name, tape);
        } catch (e) {
            check(`${name}: replays`, false, e.message);
            continue;
        }
        const { stream, status } = result;
        const secs = ((Date.now() - t0) / 1000).toFixed(0);

        if (status.saw_input_refused) {
            // Surfaced, not silently tolerated: receiveInput==false means the
            // game dropped input mid-tape and the stream is not comparable.
            check(`${name}: game accepted input throughout`, false,
                'receiveInput went false mid-tape (cutscene/pit/boss?)');
        }

        checkReadout(name, tape, status);

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
            continue;
        }
        const diff = diffObservationStreams(expected, stream);
        check(`${name}: live game matches the committed `
            + `${provisional ? 'PROVISIONAL' : 'oracle'} stream`,
            diff === null, diff ?? '');
    }

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
