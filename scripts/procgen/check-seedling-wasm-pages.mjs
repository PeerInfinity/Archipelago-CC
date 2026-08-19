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
if (!ROOT) { console.log('FAIL: --root=<siteRoot> is required'); process.exit(1); }

const BUILD = 'seedling_bot_ap_p4b';   // the build watch.html's WASM_PAGE names
const GAME = `${ROOT}/modules/flashPanel/wasm/${BUILD}/game.html`;
const WASM = `${ROOT}/modules/flashPanel/wasm/${BUILD}/${BUILD}.wasm`;
const TAPE = 'frontend/modules/seedlingDemo/fixtures/tapes/pit-fall-chain-85.json';
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

await browser.close();
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILURE(S)`);
process.exit(bad === 0 ? 0 : 1);
