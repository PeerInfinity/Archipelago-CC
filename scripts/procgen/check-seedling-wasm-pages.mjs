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
 *     …/seedling_bot_ap/game.html is missing (HTTP 404).
 *
 * to every visitor. Making the directory the submodule PeerInfinity/
 * seedling-wasm is what retires that readout, and this row is what says so:
 * it reads the message OFF THE PAGE rather than inferring it from the files.
 *
 * ⛔ Two files being 200 is NOT the claim. The page could still refuse for
 * its own reasons, so the third check is the page's own `#status`/`#detail`.
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
 *
 * Run:
 *   node scripts/procgen/check-seedling-wasm-pages.mjs \
 *        --root=https://peerinfinity.github.io/Archipelago-CC
 *   node scripts/procgen/check-seedling-wasm-pages.mjs \
 *        --root=http://localhost:8012 --label="local Pages-shaped root"
 */
import { chromium } from 'playwright';

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`)
    .slice(n.length + 3);
const ROOT = arg('root', '').replace(/\/+$/, '');
const LABEL = arg('label', ROOT);
const EXPECT_MISSING = process.argv.includes('--expect-missing');
if (!ROOT) { console.log('FAIL: --root=<siteRoot> is required'); process.exit(1); }

const BUILD = 'seedling_bot_ap';   // the build watch.html's WASM_PAGE names
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
    const len = r.headers?.get?.('content-length');
    say(`${name} ${EXPECT_MISSING ? '404s (submodule absent)' : 'is served'}`,
        EXPECT_MISSING ? !r.ok : r.ok,
        `HTTP ${r.status}${len ? `, ${Number(len).toLocaleString()} bytes` : ''}`);
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
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
await browser.close();
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILURE(S)`);
process.exit(bad === 0 ? 0 : 1);
