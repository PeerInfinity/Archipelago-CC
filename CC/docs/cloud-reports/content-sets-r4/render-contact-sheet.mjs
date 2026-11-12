#!/usr/bin/env node
/**
 * Screenshot contact-sheet.html (beside this file) to contact-sheet.png with the repo's own Playwright.
 * Needs a static server at the repository root: `python -m http.server <port>` there, then
 *   node CC/docs/cloud-reports/content-sets-r4/render-contact-sheet.mjs [--port=<port>] [--dark]
 * (default port: TEST_PORT or 8000).
 */
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const port = arg('port') ?? process.env.TEST_PORT ?? '8000';
const dark = process.argv.includes('--dark');
const url = `http://localhost:${port}/CC/docs/cloud-reports/content-sets-r4/contact-sheet.html`;
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: dark ? 'dark' : 'light' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 }).catch(() => {});
    const status = await page.textContent('#status');
    const out = join(HERE, dark ? 'contact-sheet-dark.png' : 'contact-sheet.png');
    await page.screenshot({ path: out, fullPage: true });
    console.log(`${status}\nwrote ${out}`);
    if (errors.length) { console.error(`page errors:\n${errors.join('\n')}`); process.exitCode = 1; }
} finally {
    await browser.close();
}
