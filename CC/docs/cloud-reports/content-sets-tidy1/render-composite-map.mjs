#!/usr/bin/env node
/**
 * Content sets TIDY-1 (a sibling of content-sets-r5/render-contact-sheet.mjs): screenshot composite-map.html.
 * Needs a static server at a repository root (the tree it serves is the tree drawn), then
 *   node CC/docs/cloud-reports/content-sets-tidy1/render-composite-map.mjs --port=<port> --label=<before|after> [--out=<png>]
 * (default port: TEST_PORT or 8000; default out: composite-map-<label>.png beside this file).
 */
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const port = arg('port') ?? process.env.TEST_PORT ?? '8000';
const label = arg('label') ?? 'after';
const out = arg('out') ?? join(HERE, `composite-map-${label}.png`);
const url = `http://localhost:${port}/CC/docs/cloud-reports/content-sets-tidy1/composite-map.html?label=${label}`;
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, colorScheme: 'light' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 60000 }).catch(() => {});
    console.log(await page.textContent('#status'));
    await page.screenshot({ path: out, fullPage: true });
    console.log(`wrote ${out}`);
    if (errors.length) { console.error(`page errors:\n${errors.join('\n')}`); process.exitCode = 1; }
} finally {
    await browser.close();
}
