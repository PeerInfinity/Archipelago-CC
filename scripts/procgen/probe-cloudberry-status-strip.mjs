#!/usr/bin/env node
/**
 * probe-cloudberry-status-strip — **THE CLOUDBERRY PANEL'S STATUS STRIP, PLAYED AND PHOTOGRAPHED** (cloudberry P7a).
 *
 * The Cloudberry panel's Archipelago status strip (P7a), in the
 * real frontend, with screenshots: the committed sphere preset's start level (Clouds locked, the east
 * exit locked), Clouds received (held, exit open), the bot's walk to the free coin (a "You found"
 * entry), the details expanded, and a phone-width view. Prints the strip's model at each step.
 *
 *   node scripts/procgen/probe-cloudberry-status-strip.mjs --port 8140 [--out <dir>] [--viewport 390x844]
 *
 * `--viewport` loads the page at that size from the start (390x844 = the app's phone layout); the shots
 * are then prefixed with the size.
 *
 * Needs a dev server on --port and the same-origin site copy (scripts/setup/fetch-cloudberry-site.mjs).
 * Takes the box lock.
 */
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';

argvHelp(import.meta.url);
/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-cloudberry-status-strip.mjs', kind: 'browser' });
    const argv = process.argv.slice(2);
    const arg = (name, def) => {
        const eq = argv.find((a) => a.startsWith(`${name}=`));
        if (eq) return eq.slice(name.length + 1);
        const i = argv.indexOf(name);
        return i >= 0 ? argv[i + 1] : def;
    };
    const PORT = Number(arg('--port', process.env.TEST_PORT ?? 8000));
    const OUT = path.resolve(arg('--out', 'test-results/cloudberry-status-strip'));
    fs.mkdirSync(OUT, { recursive: true });
    const [VW, VH] = String(arg('--viewport', '1280x800')).split('x').map(Number);
    const PREFIX = VW === 1280 && VH === 800 ? '' : `${VW}x${VH}-`;
    const browser = await chromium.launch({ args: [...HEADLESS_LOGIC_ONLY_ARGS] });
    let failed = 0;
    try {
        const page = await browser.newPage({ viewport: { width: VW, height: VH }, ...(VW < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
        page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
        const seed = 'AP_14089154938208861744';
        await page.goto(`http://localhost:${PORT}/frontend/?rules=${encodeURIComponent(`./presets/cloudberry_sphere_worldgen/${seed}/${seed}_rules.json`)}`);
        const frame = () => page.frames().find((f) => f.url().includes('/external/cloudberry/index.html') && f.url().includes('loadRegionEvent'));
        const waitFor = async (desc, fn, ms = 180000) => {
            const t0 = Date.now();
            for (;;) {
                let v = null;
                try { v = await fn(); } catch { /* reloading */ }
                if (v) return v;
                if (Date.now() - t0 > ms) throw new Error(`timeout waiting for: ${desc}`);
                await page.waitForTimeout(150);
            }
        };
        const strip = () => page.evaluate(() => {
            const s = document.querySelector('[data-testid="substrate-status-strip"]');
            if (!s || s.hidden) return null;
            const q = (sel) => [...s.querySelectorAll(sel)];
            return {
                region: s.dataset.region,
                items: q('[data-item]').map((e) => `${e.dataset.item}:${e.dataset.state}`),
                checks: s.querySelector('[data-section="checks"]')?.textContent,
                exits: q('[data-exit]').map((e) => `${e.dataset.exit}:${e.dataset.state}:${e.title}`),
                activity: s.querySelector('[data-section="activity"]')?.textContent,
                bot: s.querySelector('[data-section="bot"]')?.textContent,
                height: s.getBoundingClientRect().height,
            };
        });
        const shot = async (name) => {
            const panel = VW < 600 ? null : await page.$('.flashsub-root:has([data-testid="substrate-status-strip"])');
            await (panel ?? page).screenshot({ path: path.join(OUT, `${PREFIX}${name}.png`) });
            console.log(`  shot ${PREFIX}${name}.png`);
        };
        await waitFor('region_2_2 configured', () => frame()?.evaluate(() => {
            const a = window.__cloudberryEmbed?.app; return a?.config?.regionId === 'region_2_2' && a.playResult?.ok;
        }));
        const s1 = await waitFor('the strip shows region_2_2', async () => { const s = await strip(); return s?.region === 'region_2_2' ? s : null; }, 30000);
        console.log('start:', JSON.stringify(s1));
        await page.waitForTimeout(1500);
        await shot('1-start-clouds-locked');
        await page.evaluate(async () => {
            const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
            await proxy.addItemToInventory('Clouds', 1);
        });
        const s2 = await waitFor('Clouds held in the strip', async () => { const s = await strip(); return s?.items.includes('Clouds:held') ? s : null; }, 30000);
        console.log('clouds:', JSON.stringify(s2));
        await page.waitForTimeout(600);
        await shot('2-clouds-received');
        // The bot to the free coin (the host-side playback controller).
        await page.evaluate(async () => {
            const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
            substrateRegistry.get('cloudberry').getPlaybackController().walkTo({ kind: 'location', name: 'region_2_2__loc_0' });
        });
        const s3b = await waitFor('the bot line', async () => { const s = await strip(); return s?.bot ? s : null; }, 30000);
        console.log('bot:', JSON.stringify(s3b));
        await shot('3-bot-walking');
        const s3 = await waitFor('a found entry', async () => { const s = await strip(); return /found|Received|Checked/.test(s?.activity ?? '') && /1\/2/.test(s.checks) ? s : null; }, 120000);
        console.log('found:', JSON.stringify(s3));
        await page.waitForTimeout(400);
        await shot('4-coin-found');
        await page.click('.flashsub-strip-toggle');
        await page.waitForTimeout(300);
        await shot('5-details');
        const focus = await page.evaluate(() => document.activeElement?.tagName);
        console.log('focus after toggle:', focus);
        await page.click('.flashsub-strip-toggle');
        await page.waitForTimeout(300);
        console.log('collapsed again:', JSON.stringify(await strip()));
    } catch (e) {
        failed++;
        console.log(`FAILED: ${e.message}`);
    } finally {
        await browser.close();
    }
    process.exitCode = failed ? 1 : 0;
}
