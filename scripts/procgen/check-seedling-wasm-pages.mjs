#!/usr/bin/env node
/**
 * check-seedling-wasm-pages — is the Seedling wasm build actually SERVED at
 * the site root, and does watch.html therefore stop saying it isn't?
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────
 *
 * The builds used to be a gitignored hand-copied directory. Every path in
 * the app pointed at them and the published site had none of them, so
 * `watch.html?side=wasm` HEAD-probed the game page, got a 404, and printed
 *
 *     the wasm build is not on this machine
 *     …/<build>/game.html is missing (HTTP 404).
 *
 * to every visitor. Making the directory the submodule PeerInfinity/
 * seedling-wasm is what retires that readout, and this row is what says so:
 * it reads the message OFF THE PAGE rather than inferring it from the files.
 *
 * ⛔ Two files being 200 is NOT the claim. The page could still refuse for
 * its own reasons, so the third check is the page's own `#status`/`#detail`.
 *
 * ── AND THE SECOND THING THE SITE COULD NOT DO ───────────────────────
 *
 * The same root cause had a second victim. `watch.html`'s tape picker
 * learned what tapes exist by fetching the DIRECTORY and regexing the
 * server's listing out of it — and Pages emits no listing, so the picker
 * read `— no directory listing —` while 153 tracked tapes sat there
 * serving 200s. `fixtures/tapes/index.json` (generated) is the fix, and
 * this row is what says it reached the SITE: the option count comes off the
 * live DOM, and the page's own readout says which source answered.
 *
 * ⛓ AND THEN IT LOADS ONE, FOR REAL. §18.13 left "the ▶ Start click" as the
 * one thing the live proof could not include, on the page's own warning
 * that nothing it does can substitute for a user gesture. True of the
 * PARENT document — not of Playwright, whose click is a real input event
 * with real user activation (`verify-seedling-wasm-bridge.mjs` has always
 * started the game that way). So the last arm drives one tape into the
 * live wasm and reads `botLoadTape`/`botStart`'s verdict off the status
 * line. If it does not get there, it prints the STAGE it reached rather
 * than a bare FAIL — a boot that dies on the runtime and one that dies on
 * the tape are different findings.
 *
 * ── THE ARMS ─────────────────────────────────────────────────────────
 *
 *   --root=<url>          a site root: the live Pages site, or a local
 *                         Pages-SHAPED root (serve a copy of ./frontend,
 *                         which is exactly what the deploy uploads)
 *   --expect-missing      invert it: assert the page DOES print "is
 *                         missing". Run this against the same root with the
 *                         submodule contents removed — a check that cannot
 *                         fail proves nothing, and this is the mutant that
 *                         shows this one can.
 *   --expect-listing      the tape-roster mutant: assert the picker fell
 *                         back to the server's DIRECTORY LISTING, i.e. the
 *                         manifest was not served. Run it against a root
 *                         with `index.json` removed (a dev server, which
 *                         emits a listing) — and against a Pages-shaped
 *                         root with no listing either, where the picker is
 *                         expected to go dark instead.
 *   --no-play             skip the last arm (the live tape load), for a
 *                         quick structural pass.
 *   --no-ship             skip the ▶ load-in-wasm arms (three more wasm boots,
 *                         one per arm) — the same escape, one item down.
 *
 * ── ⛓⛓ AND THE BUTTON, ON THIS ROOT ─────────────────────────────────
 *
 * `watch.html` gained a ▶ load-in-wasm button: SOLVE, MANUAL and GENERATE each
 * ship what they hold into the real game. What a machine with NO GPU can
 * honestly witness is everything up to the first tick — the build probed, the
 * runtime up, the user's ▶ Start accepted, a one-room level SET mounted and
 * READ BACK, the tape accepted, the run started. ⛔ It cannot witness a
 * VERDICT: 255 ticks at ~0.5 ticks/s on swiftshader is eight minutes of
 * software rasterising, and a deadline over that measures machine load rather
 * than the game. `check-seedling-wasm-ship.mjs` is the real-GPU arm that
 * finishes the sentence.
 *
 * ⛓ MANUAL IS THE ONE ARM THAT REACHES `finished` HERE, and that is why it is
 * here: its tape is ZERO-INPUT, so the only frames between `running` and
 * `finished` are the world-load fade. Which makes `receive_input: true` after
 * `finished` — ⚖ the user's measured fact that the keyboard drives the real
 * game once a replay ends — assertable without a GPU.
 *
 * Run:
 *   node scripts/procgen/check-seedling-wasm-pages.mjs \
 *        --root=https://peerinfinity.github.io/Archipelago-CC
 *   node scripts/procgen/check-seedling-wasm-pages.mjs \
 *        --root=http://localhost:8012 --label="local Pages-shaped root"
 */
import { readdirSync } from 'node:fs';

import { chromium } from 'playwright';

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`)
    .slice(n.length + 3);
const ROOT = arg('root', '').replace(/\/+$/, '');
const LABEL = arg('label', ROOT);
const EXPECT_MISSING = process.argv.includes('--expect-missing');
const EXPECT_LISTING = process.argv.includes('--expect-listing');
const NO_PLAY = process.argv.includes('--no-play');
const NO_SHIP = process.argv.includes('--no-ship');
if (!ROOT) { console.log('FAIL: --root=<siteRoot> is required'); process.exit(1); }

const BUILD = 'seedling_bot_ap_p4b';   // the build watch.html's WASM_PAGE names
const GAME = `${ROOT}/modules/flashPanel/wasm/${BUILD}/game.html`;
const WASM = `${ROOT}/modules/flashPanel/wasm/${BUILD}/${BUILD}.wasm`;
const TAPE = 'frontend/modules/seedlingDemo/fixtures/tapes/pit-fall-chain-85.json';
/**
 * ⛓ THE SHIP ARMS' SEGMENT — `check-seedling-editor-solve.mjs`'s own accepted
 * one. ⛔ Reused rather than invented: a red here is then about the SHIP and
 * not about a solve nobody else runs.
 */
/**
 * ⛓ THE REPLAY ARM'S TAPE — 30 ticks, COMMITTED, and its stream is already an
 * ORACLE (`tapeRunner.test.js` pins the JS model against the recorded
 * expectation). Short enough that swiftshader's ~0.5 ticks/s is a minute
 * rather than the eight a 255-tick solve would cost, which is what makes a
 * PER-TICK verdict reachable on a machine with no GPU at all.
 */
const REPLAY_TAPE = 'frontend/modules/seedlingDemo/fixtures/tapes/friction-stop.json';
/**
 * ⛓ R9 slice 7b: the boot moved `r7-act2-4` -> `r8-solve-4` with the hand
 * chain's retirement (⚖ ruling 14). The two blocks were compared field by
 * field before the swap and are BYTE-EQUAL over all eleven boot fields
 * (`boot` `seam` `grants` `persistence` `equips` `pins` `save` `rng`
 * `noclip` `noHazards` `noDamage`), so this row boots the SAME L4 world it
 * always did — only the file that carries the block changed.
 */
const SHIP_BOOT = 'frontend/modules/seedlingDemo/fixtures/tapes/r8-solve-4.json';
const SHIP_GOALS = 'exit:64,16';
const SHIP_NAME = 'r8-solve-4';
const WATCH = `${ROOT}/modules/seedlingDemo/watch.html?tape=${encodeURIComponent(TAPE)}&side=wasm`;

let bad = 0;
const say = (n, ok, d = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${n}${d ? ` — ${d}` : ''}`);
    if (!ok) bad++;
};
console.log(`# ${LABEL}\n# root ${ROOT}${EXPECT_MISSING ? '  [--expect-missing]' : ''}`);

for (const [name, url] of [['game.html', GAME], [`${BUILD}.wasm`, WASM]]) {
    const r = await fetch(url, { method: 'HEAD' })
        .catch((e) => ({ status: `unreachable (${e.message})`, ok: false, headers: new Map() }));
    // ⛔ content-length is the TRANSFER size, not the file size. Node's fetch
    // sends Accept-Encoding: gzip, and GitHub Pages compresses — the live
    // 33,604,931-byte wasm reports 12,574,313 here while a local
    // python http.server (no compression) reports the true 33,604,931. Two
    // runs of this row disagreeing about "bytes" is the encoding, not the
    // file; say which is which rather than print a number nobody can compare.
    const len = r.headers?.get?.('content-length');
    const enc = r.headers?.get?.('content-encoding');
    const size = len
        ? `, ${Number(len).toLocaleString()} bytes ${enc ? `over the wire (${enc}; the file is larger)` : 'on the wire = the file size (identity encoding)'}`
        : '';
    say(`${name} ${EXPECT_MISSING ? '404s (submodule absent)' : 'is served'}`,
        EXPECT_MISSING ? !r.ok : r.ok, `HTTP ${r.status}${size}`);
}

/**
 * ⛔ THE WEBGPU FLAGS ARE NOT OPTIONAL, and their absence is invisible until
 * something asks the game to RUN. With `--no-sandbox` alone the page reaches
 * `__runtimeReady` and prints "runtime ready — press ▶ Start", because that
 * is a JS-side milestone; the ▶ click then invokes `runSWF`, the WebGPU
 * renderer cannot initialise, `botStatus` never appears, and 180 s later the
 * page says "the tape never started". Measured here, first run of the play
 * arm. These are `verify-seedling-wasm-bridge.mjs`'s own flags.
 */
const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
        '--no-sandbox',
    ],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
await page.goto(WATCH, { waitUntil: 'domcontentloaded' });
const read = () => page.evaluate(() => ({
    status: document.getElementById('status')?.textContent ?? '',
    detail: document.getElementById('detail')?.textContent ?? '',
    frameSrc: document.getElementById('frame')?.getAttribute('src') ?? '',
}));
// Settle on a readout: the fatal, or the line the wasm path prints once the
// probe passed. ⛔ Do NOT wait on "a readout EXISTS" — a mid-run page has one.
let readout = await read();
for (let i = 0; i < 120 && !/missing|runtime|ready|click/i.test(readout.status + readout.detail); i++) {
    await page.waitForTimeout(500);
    readout = await read();
}
console.log(`  page readout: status="${readout.status}" detail="${readout.detail}"`);
console.log(`  game iframe src: "${readout.frameSrc}"`);
const missing = /is missing/.test(readout.status + readout.detail);
say(EXPECT_MISSING
    ? 'watch.html PRINTS "is missing" (the readout this submodule retires)'
    : 'watch.html does NOT print "is missing"',
EXPECT_MISSING ? missing : !missing);
if (!EXPECT_MISSING) {
    say('watch.html pointed its iframe at the game page',
        readout.frameSrc.includes(`${BUILD}/game.html`), readout.frameSrc);
}
/**
 * ── THE TAPE PICKER, OFF THE LIVE DOM ────────────────────────────────
 *
 * ⛔ THE EXPECTED COUNT IS NOT A LITERAL. 153 would be a number to update by
 * hand every time a tape is recorded, and a stale literal in a check row
 * fails for a reason that has nothing to do with the site.
 *
 * ⛔ AND IT IS NOT READ OUT OF THE MANIFEST EITHER, which was this row's
 * first cut and which the manifest MUTANT immediately broke: deleting
 * `index.json` to prove the fall-back is exactly the arm that most needs
 * this number, and the row crashed on ENOENT before making a single claim.
 * It counts the DIRECTORY — the thing the manifest is generated from and
 * gated against — so the row survives its own mutant and still compares two
 * different artifacts (this checkout's files vs the site's DOM). When they
 * disagree the honest reading is usually "the deploy is older than the
 * working tree", which the message says out loud.
 */
const TAPES_HERE = new URL(
    '../../frontend/modules/seedlingDemo/fixtures/tapes/', import.meta.url);
const WANT_TAPES = readdirSync(TAPES_HERE)
    .filter((f) => f.endsWith('.json') && f !== 'index.json').length;

/**
 * ⛔ WAIT FOR A TERMINAL STATE, NOT FOR THE ELEMENT. `#tapes` exists from the
 * first paint carrying `loading…`, so reading it straight away is reading a
 * mid-run page — measured: the manifest arm happened to be finished by the
 * time the wasm readout settled and the LISTING arm was not, because that
 * branch still fetches every tape to build its labels. A row that read
 * `loading…` and called it "the picker went dark" would have reported the
 * fall-back broken when it was merely slower.
 */
await page.waitForFunction(() => {
    const sel = document.getElementById('tapes');
    if (!sel || !sel.options.length) return false;
    return !/loading…/.test(sel.options[0].textContent ?? '');
}, null, { timeout: 120000 }).catch(() => { /* reported by the claims below */ });

const picker = await page.evaluate(() => ({
    options: [...document.querySelectorAll('#tapes option')].map((o) => o.textContent),
    disabled: document.getElementById('tapes')?.disabled ?? null,
    source: document.getElementById('tapesrc')?.textContent ?? '',
    title: document.getElementById('tapes')?.getAttribute('title') ?? '',
}));
console.log(`  picker: ${picker.options.length} option(s), ${picker.source || '(no source readout)'}`);
console.log(`  first option: ${picker.options[0] ?? '(none)'}`);

if (EXPECT_LISTING) {
    // The mutant arm. On a server that DOES emit a listing the picker must
    // still fill — from the listing, saying so. On one that does not, it
    // goes dark, which is the pre-manifest behaviour this whole item
    // retires; both are accepted here and NAMED, because which one you get
    // is a fact about the host, not about the page.
    const fellBack = /roster: listing/.test(picker.source);
    const wentDark = picker.options.some((o) => /no directory listing/.test(o));
    say('with no manifest the picker falls back to the listing, or goes dark and says so',
        fellBack || wentDark, fellBack ? `listing, ${picker.options.length} option(s)` : `dark: ${picker.options[0]}`);
    if (fellBack) {
        say('…and the fallback found the same roster', picker.options.length === WANT_TAPES,
            `${picker.options.length} vs ${WANT_TAPES} on disk here`);
    }
} else {
    say('the tape picker is populated from the generated manifest',
        /roster: manifest/.test(picker.source), picker.source || '(no #tapesrc readout)');
    say(`…with every committed tape in it (${WANT_TAPES} on disk here)`,
        picker.options.length === WANT_TAPES,
        picker.options.length === WANT_TAPES ? `${picker.options.length} options`
            : `${picker.options.length} options on the site vs ${WANT_TAPES} here — `
              + 'if the site is behind, this is the deploy, not the page');
    say('…and the options are LABELLED from the manifest, not left as bare filenames',
        picker.options.every((o) => /— L.* ticks, v\d/.test(o)),
        picker.options[0] ?? '(none)');
}

/**
 * ── AND ONE TAPE, DRIVEN INTO THE REAL GAME, ON THIS ROOT ────────────
 *
 * The page refuses to press ▶ itself and says why (the renderer and the
 * audio context consume the user activation). Playwright's click IS a user
 * gesture, so the row can do what the page must not.
 */
if (!NO_PLAY && !EXPECT_MISSING) {
    let stage = 'runtime never reported ready';
    try {
        await page.waitForFunction(
            () => /runtime ready/.test(document.getElementById('status')?.textContent ?? ''),
            null, { timeout: 180000 });
        stage = 'runtime ready, Start not clicked';
        const gameFrame = page.frames().find((f) => f.url().includes('/game.html'));
        if (!gameFrame) throw new Error('the game iframe never appeared');
        await gameFrame.click('#btn-start', { timeout: 60000 });
        stage = 'Start clicked, the tape never loaded';
        await page.waitForFunction(
            () => /running in the real game|could not start the tape|never started/
                .test(document.getElementById('status')?.textContent ?? ''),
            null, { timeout: 240000 });
        const st = await read();
        stage = st.status;
        say('⛓ one tape LOADS AND RUNS in the live wasm — botLoadTape/botStart both ok',
            /running in the real game/.test(st.status), st.status || st.detail);
    } catch (e) {
        say('⛓ one tape LOADS AND RUNS in the live wasm — botLoadTape/botStart both ok',
            false, `stopped at: ${stage} (${e.message.split('\n')[0]})`);
    }
}


/**
 * ── ⛓⛓⛓ ▶ LOAD IN WASM, ON THIS ROOT — THE HEADLESS HALF ─────────────
 *
 * The button ships what the page holds into the real game. What a machine with
 * no GPU can honestly witness is everything up to the first tick: the build
 * probed, the runtime up, the user's ▶ Start accepted, a level set MOUNTED and
 * read back, the tape accepted, the run started. ⛔ It cannot witness a
 * VERDICT — 255 ticks at ~0.5 ticks/s on swiftshader is eight minutes of
 * software rasterising, and a deadline over that is a race against machine load
 * rather than a fact. `check-seedling-wasm-ship.mjs` is the real-GPU arm that
 * finishes the sentence, and it says so.
 *
 * ⛔ ONE ARM = ONE FRESH PAGE. The wasm cannot rewind — `botReset` forgets the
 * tape, not the world — so a second ship in the same document would start from
 * wherever the first one stopped and report it as data.
 *
 * ⛓ MANUAL IS THE EXCEPTION THAT REACHES `finished`, and it is why the arm is
 * here at all: its tape is ZERO-INPUT, so the only frames between `running` and
 * `finished` are the world-load fade. That is what makes `receive_input: true`
 * after `finished` — ⚖ the user's measured fact that the keyboard drives the
 * real game once a replay ends — assertable on a machine with no GPU.
 */
async function shipArm({ name, url, steps, want }) {
    const p = await browser.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    let stage = 'the page never mounted its arm';
    try {
        await p.goto(url, { waitUntil: 'domcontentloaded' });
        for (const step of steps) {
            stage = step.what;
            if (step.wait) {
                // eslint-disable-next-line no-await-in-loop
                await p.waitForFunction(step.wait, null, { timeout: step.ms ?? 180000 });
            } else if (step.click) {
                // eslint-disable-next-line no-await-in-loop
                await p.click(step.click, { timeout: 60000 });
            } else if (step.frameClick) {
                /**
                 * ⛔ THE ONE CLICK THE PAGE MAY NEVER MAKE, AND THE ROW MAY.
                 * Playwright's click is a real input event with real user
                 * activation; a parent-side click latches `started` and hides
                 * the button without ever supplying one.
                 */
                // eslint-disable-next-line no-await-in-loop
                const gf = p.frames().find((f) => f.url().includes('/game.html'));
                if (!gf) throw new Error('the game iframe never appeared');
                // eslint-disable-next-line no-await-in-loop
                await gf.click(step.frameClick, { timeout: 60000 });
            }
        }
        stage = 'done';
    } catch (e) {
        stage = `${stage} (${e.message.split('\n')[0]})`;
    }
    const wasm = await p.evaluate(() => window.__watch?.wasm ?? null).catch(() => null);
    console.log(`  ${name}: stage=${wasm?.stage ?? 'none'} reached=${
        JSON.stringify(wasm?.reached ?? [])} refusal=${JSON.stringify(wasm?.refusal ?? null)}`);
    await p.close().catch(() => {});
    /**
     * ⛔ A STOPPED ARM PRINTS THE STAGE IT REACHED, never a bare FAIL. A ship
     * that died on the runtime and one that died on the tape are different
     * findings, and the whole design is that the page can tell you which.
     */
    want(wasm, stage === 'done' ? '' : `stopped at: ${stage}`, errs);
}

if (!NO_SHIP && !EXPECT_MISSING) {
    const watchAt = (q) => `${ROOT}/modules/seedlingDemo/watch.html?${q}`;
    const reached = (w, s) => Boolean(w?.reached?.includes(s));

    // ── SOLVE: a tiny committed staging, solved in the page, then shipped ──
    await shipArm({
        name: 'SOLVE',
        url: watchAt(`source=solve&level=4&boot=${SHIP_BOOT}`
            + `&goals=${encodeURIComponent(SHIP_GOALS)}&solve=1&name=${SHIP_NAME}`),
        steps: [
            { what: 'the solve finished in the page', ms: 240000,
                wait: "window.__editorSolve && window.__editorSolve.status === 'ok'" },
            { what: '▶ load in wasm became enabled', ms: 60000,
                wait: "!document.getElementById('loadWasm').disabled" },
            { what: 'press ▶ load in wasm', click: '#loadWasm' },
            { what: 'the ship reached `runtime`', ms: 300000,
                wait: "window.__watch?.wasm?.reached?.includes('runtime')" },
            { what: 'press ▶ Start inside the frame', frameClick: '#btn-start' },
            { what: 'the ship reached `running`', ms: 300000,
                wait: "window.__watch?.wasm?.reached?.includes('running')" },
        ],
        want: (w, stopped) => {
            say('⛓ SOLVE ships its own tape — probe and runtime reached',
                reached(w, 'probe') && reached(w, 'runtime'),
                stopped || `reached ${JSON.stringify(w?.reached)}`);
            say('⛓ …and after a REAL ▶ Start the game accepted the tape and started it',
                reached(w, 'tape') && reached(w, 'running'),
                stopped || JSON.stringify(w?.refusal ?? w?.reached));
        },
    });

    // ── GENERATE: a small seed, shipped as a ONE-ROOM level SET ────────────
    await shipArm({
        name: 'GENERATE',
        url: watchAt('source=generate&seed=1&biome=pre-sword&count=4&tries=8&k=3'
            + '&anchortries=1&run=1'),
        steps: [
            /**
             * ⛔ WAIT FOR THE LADDER TO FINISH, NOT FOR ITS FIRST `ok`.
             * `?run=1&count=4` publishes `status: 'ok'` at EVERY step, so a
             * row that pressed on the first one would ship step 1 and read a
             * `set_id` naming step 4 — measured: the title said `step 3` while
             * the mounted set said `-4-`. `#genRunAll` re-enabling is the
             * page's own "the ladder is done" (the demo row waits on it too).
             */
            { what: 'the generator ran its whole ladder and certified the room', ms: 300000,
                wait: "window.__editorGenerate?.status === 'ok'"
                    + " && window.__editorGenerate?.step === 4"
                    + " && !document.getElementById('genRunAll').disabled"
                    + " && !document.getElementById('loadWasm').disabled" },
            { what: 'press ▶ load in wasm', click: '#loadWasm' },
            { what: 'the ship reached `runtime`', ms: 300000,
                wait: "window.__watch?.wasm?.reached?.includes('runtime')" },
            { what: 'press ▶ Start inside the frame', frameClick: '#btn-start' },
            { what: 'the one-room set MOUNTED and was read back', ms: 300000,
                wait: "window.__watch?.wasm?.reached?.includes('levels')"
                    + " || window.__watch?.wasm?.refusal" },
        ],
        want: (w, stopped) => {
            /**
             * ⛔ THE READBACK IS THE CLAIM, not the delivery. Reading the set
             * back out of the artifact is the only check that does not share
             * the producer's assumptions — the `levels` stage is only entered
             * once `botLevelSet` AGREED with what was sent, field by field.
             */
            say('⛓⛓ GENERATE ships a ONE-ROOM level SET, and the artifact reads it BACK',
                reached(w, 'levels'),
                stopped || `refusal ${JSON.stringify(w?.refusal ?? null)}`);
            say('…with exactly one room in it, under the set_id the exporter stamped',
                w?.set?.rooms === 1 && typeof w?.set?.set_id === 'string'
                    && w.set.set_id.startsWith('watch-oneroom-'),
                JSON.stringify(w?.set ?? null));
        },
    });

    // ── MANUAL: a ZERO-INPUT tape, and the keyboard afterwards ─────────────
    await shipArm({
        name: 'MANUAL',
        url: watchAt(`source=manual&boot=${SHIP_BOOT}`),
        steps: [
            { what: 'the boot panel mounted', ms: 240000,
                wait: "window.__editorArm?.source === 'manual'"
                    + " && !document.getElementById('loadWasm').disabled" },
            { what: 'press ▶ load in wasm', click: '#loadWasm' },
            { what: 'the ship reached `runtime`', ms: 300000,
                wait: "window.__watch?.wasm?.reached?.includes('runtime')" },
            { what: 'press ▶ Start inside the frame', frameClick: '#btn-start' },
            { what: 'the zero-input tape finished', ms: 420000,
                wait: "window.__watch?.wasm?.reached?.includes('finished')"
                    + " || window.__watch?.wasm?.refusal" },
        ],
        want: (w, stopped) => {
            say('⛓ MANUAL ships a ZERO-INPUT tape and the game accepts it',
                reached(w, 'tape'), stopped || JSON.stringify(w?.refusal ?? null));
            /**
             * ⚖ THE USER'S MEASURED FACT, OFF `botStatus`: the keyboard drives
             * the real game once a replay has finished. That is what makes a
             * zero-input tape a complete answer to "put me in this room and
             * give me the controls" — and it is why no new wasm verb was added.
             */
            say('⛓⛓ …and `receive_input` is TRUE once it has FINISHED — the keyboard is yours',
                reached(w, 'finished') && w?.status?.receive_input === true,
                stopped || `finished=${w?.status?.finished} receive_input=${
                    w?.status?.receive_input}`);
            say('⛔ …with NO expectation, said out loud rather than reported as agreement',
                w?.verdict?.kind === 'none' && /manual/.test(w?.verdict?.text ?? ''),
                w?.verdict?.text ?? '(no verdict)');
            /**
             * ── ⛓⛓ THE HEADLESS HALF OF THE PER-TICK SLICE ──────────────
             *
             * MANUAL is the one arm a machine with no GPU can drive to
             * `finished`, so it is the one that can witness the DRAIN at all.
             * ⛔ The drain is asserted SEPARATELY from the verdict: a build
             * whose `botDrain` answered nothing degrades to the labelled
             * end-state fallback by design, and a row that read only the
             * verdict could not tell that fallback from a real answer.
             */
            say('⛓⛓ the game DRAINS its whole observation stream — read ONCE, after '
                + '`finished`, and it is a BUFFERED stream rather than a sample',
                reached(w, 'drain') && (w?.drain?.observations ?? 0) > 0,
                stopped || `drain ${JSON.stringify(w?.drain ?? null)}`);
            /**
             * ⛔ AND A ZERO-INPUT TAPE IS VACUOUS PER TICK, WHICH IS AN ANSWER.
             * Nothing was driven in JS, so there is no run to reproduce —
             * reporting agreement on the boot frame would be a per-tick claim
             * about a comparison that had nothing to compare.
             */
            say('⛔ …and the PER-TICK verdict says WHY there is none rather than '
                + 'reporting a vacuous agreement — with the drained count beside it',
                w?.verdict?.perTick?.kind === 'none'
                    && /manual/.test(w?.verdict?.perTick?.text ?? '')
                    && /observation\(s\) drained/.test(w?.verdict?.perTick?.text ?? ''),
                w?.verdict?.perTick?.text ?? '(no per-tick verdict)');
        },
    });

    /**
     * ── ⛓⛓⛓ REPLAY — THE ONE ARM THAT CAN SEE `agrees per tick` HEADLESS ──
     *
     * ⛔ AND IT IS THE CHEAPEST WITNESS THERE IS, on ANY root including the
     * deployed site: `friction-stop` is a COMMITTED 30-tick tape whose stream
     * is already an oracle (`tapeRunner.test.js` pins the JS model against the
     * recorded expectation), so a divergence here is attributable without
     * generating or solving anything. Thirty ticks is also short enough that
     * swiftshader's ~0.5 ticks/s is a minute rather than the eight the SOLVE
     * arm would cost.
     *
     * ⚠ `?side=wasm` SHIPS ON LOAD — no `#loadWasm` press. The stage machine
     * is the same one, which is why this arm is assertable on the same fields.
     */
    await shipArm({
        name: 'REPLAY',
        url: watchAt(`side=wasm&tape=${encodeURIComponent(REPLAY_TAPE)}`),
        steps: [
            { what: 'the ship reached `runtime`', ms: 300000,
                wait: "window.__watch?.wasm?.reached?.includes('runtime')" },
            { what: 'press ▶ Start inside the frame', frameClick: '#btn-start' },
            { what: 'the committed tape finished and was drained', ms: 420000,
                wait: "window.__watch?.wasm?.reached?.includes('drain')"
                    + " || window.__watch?.wasm?.refusal" },
        ],
        want: (w, stopped) => {
            say('⛓ REPLAY publishes `__watch.wasm` — the same channel the button\'s '
                + 'ships do, which is what makes this arm assertable at all',
                reached(w, 'drain') && (w?.drain?.observations ?? 0) > 0,
                stopped || `drain ${JSON.stringify(w?.drain ?? null)}`);
            /**
             * ⛓⛓⛓ THE CLAIM THE SLICE EXISTS FOR, ON A MACHINE WITH NO GPU.
             */
            say('⛓⛓⛓ wasm verdict: AGREES PER TICK — the real game reproduced the JS '
                + 'model observation for observation, on a COMMITTED tape',
                w?.verdict?.perTick?.kind === 'agrees',
                stopped || `${w?.verdict?.perTick?.text} `
                    + `(end state: ${w?.verdict?.text})`);
            /**
             * ⛔ AND THE END-STATE CHECK RAN TOO, AND AGREES. A per-tick
             * agreement beside an end state that disagrees about the same frame
             * is `verdict-internally-inconsistent` by construction — this is
             * the row that would see it.
             */
            say('⛔ …and the END-STATE check ran FIRST and agrees with it — never '
                + '`verdict-internally-inconsistent`',
                w?.verdict?.agrees === true && w?.verdict?.perTick?.kind !== 'inconsistent',
                stopped || `${w?.verdict?.text} / ${w?.verdict?.perTick?.kind}`);
        },
    });
}

await browser.close();
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILURE(S)`);
process.exit(bad === 0 ? 0 : 1);
