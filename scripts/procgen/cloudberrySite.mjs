/**
 * cloudberrySite — open the Cloudberry Kingdom game page headless, served from a
 * local copy of the site (`scripts/setup/fetch-cloudberry-site.mjs`), for the
 * instruments that need the game's own generator (the pack maker) without a dev
 * server: Playwright answers every request to a private origin from the folder.
 *
 * The page is opened with `?embed=1` (which implies the generator API), so the same
 * page offers `window.cloudberry.generateText`, `__cloudberryEmbed.canonicalDocText`
 * (the document hash's canonical text) and the game side of `__swfBridge`
 * (`configure`, to prove a payload plays).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

import { DEFAULT_OUT, readRecord } from '../setup/fetch-cloudberry-site.mjs';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';

// https: the page hashes with crypto.subtle, which only a secure context has (nothing is fetched over TLS:
// Playwright fulfils every request itself).
export const SITE_ORIGIN = 'https://cloudberry.local';
const READY_TIMEOUT_MS = 240000;
// Headless Chromium has no GPU: SwiftShader gives the page its WebGL 2 — the directory's one spelling of the switches.
export const CHROMIUM_ARGS = HEADLESS_LOGIC_ONLY_ARGS;

const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
    '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain',
};

/** The local site folder, or a refusal by name. */
export function siteDirOrThrow(dir = DEFAULT_OUT) {
    const root = resolve(dir);
    if (!existsSync(join(root, 'index.html'))) {
        throw new Error(`no Cloudberry site at ${root} — run: node scripts/setup/fetch-cloudberry-site.mjs`);
    }
    return root;
}

/**
 * Open the embedded page in `browser` (a Playwright Browser) with the site served
 * from `dir`. Resolves once the generator API and the embed bridge are ready.
 * @returns {{ page, build, close }}
 */
export async function openCloudberryPage(browser, { dir = DEFAULT_OUT, log = () => {} } = {}) {
    const root = siteDirOrThrow(dir);
    const record = readRecord(root);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.route(`${SITE_ORIGIN}/**`, async (route) => {
        const url = new URL(route.request().url());
        const file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
        if (!(file === root || file.startsWith(root + sep)) || !existsSync(file) || !statSync(file).isFile()) {
            await route.fulfill({ status: 404, body: 'not found' });
            return;
        }
        await route.fulfill({
            status: 200,
            body: readFileSync(file),
            headers: { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' },
        });
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => { if (e.message !== 'unwind') log(`PAGEERROR: ${e.message}`); });
    // packs= a base that 404s: the check-coin look falls back (no fetch leaves the private origin).
    await page.goto(`${SITE_ORIGIN}/index.html?embed=1&packs=${encodeURIComponent(`${SITE_ORIGIN}/no-packs/`)}`);
    await page.waitForFunction(() => window.cloudberry && window.__cloudberryEmbed && window.__swfBridge?.configure,
        null, { timeout: READY_TIMEOUT_MS });
    await page.evaluate(() => window.cloudberry.ready());
    return { page, build: record?.build ?? null, close: () => context.close() };
}

/**
 * Generate one document: `{ text, doc, docSha256 }` — `docSha256` over the page's own
 * canonical text (the build id blanked), exactly what the page checks at configure.
 */
export async function generateDocument(page, args) {
    const { text, canon } = await page.evaluate(async (a) => {
        const t = await window.cloudberry.generateText(a);
        return { text: t, canon: window.__cloudberryEmbed.canonicalDocText(t) };
    }, args);
    return { text, doc: JSON.parse(text), docSha256: createHash('sha256').update(canon, 'utf8').digest('hex') };
}

/**
 * Configure the page with a region payload (`params`) and report what it did:
 * `{ refusal, playResult }` — a refusal names why (hash mismatch, missing coin, …).
 */
export async function configurePayload(page, params, { regionId = 'probe' } = {}) {
    return page.evaluate(async ({ params, regionId }) => {
        const w = window;
        w.__swfBridge.sendLocation ??= () => {};
        w.__swfBridge.sendExit ??= () => {};
        w.__swfBridge.setPlayClock ??= () => {};
        await w.__swfBridge.configure({ gameId: 'cloudberry', params, ap_items: {}, ap_locations: {}, regionId, checkedLocations: [] });
        const app = w.__cloudberryEmbed.app;
        return { refusal: app.refusal ?? null, playResult: app.playResult ?? null };
    }, { params, regionId });
}
