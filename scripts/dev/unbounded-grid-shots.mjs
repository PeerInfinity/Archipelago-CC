#!/usr/bin/env node
/**
 * unbounded-grid-shots — PNGs of composite maps, drawn by the app's own renderer through
 * `scripts/dev/unbounded-grid-render.html`, for the survey `unbounded-grid-survey` (2026-11-15).
 *
 *   node scripts/dev/unbounded-grid-shots.mjs --port=8141 --out=<dir> <label>=<servedPath>[@WxH][#tilePx] ...
 *
 * `servedPath` is a path under the served tree (e.g. frontend/presets/procgen_maze/AP_3/AP_3_rules.json,
 * or a variant copied under the gitignored frontend/downloads/). `@WxH` outlines the growth box.
 * Writes <out>/<label>.png and <out>/shots.json (canvas size, map cells, region count per shot).
 * Takes the box lock (kind browser), as every Playwright driver here does.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { takeBoxLockOrExit } from '../procgen/boxLock.js';
import { REGISTRY_LIBRARIES } from '../procgen/reference/registry.mjs';

const arg = (n, d = null) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const PORT = arg('port', process.env.TEST_PORT ?? '8000');
const OUT = arg('out');
if (!OUT) { console.error('--out=<dir> required'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const shots = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((a) => {
    const [label, rest] = a.split(/=(.*)/s);
    const [pathBox, tile = '2'] = rest.split('#');
    const [path, box = null] = pathBox.split('@');
    return { label, path, box, tile };
});
takeBoxLockOrExit({ name: 'unbounded-grid-shots.mjs', kind: 'browser' });

const browser = await chromium.launch();
const results = {};
try {
    for (const s of shots) {
        const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
        await page.addInitScript((libs) => { window.__libs = libs; }, [...REGISTRY_LIBRARIES]);
        const url = `http://localhost:${PORT}/scripts/dev/unbounded-grid-render.html?src=/${s.path}&tile=${s.tile}`
            + `&label=${encodeURIComponent(s.label)}${s.box ? `&box=${s.box}` : ''}`;
        await page.goto(url);
        await page.waitForFunction(() => window.__done, null, { timeout: 120000 });
        const done = await page.evaluate(() => window.__done);
        results[s.label] = { ...s, ...done };
        if (done.ok) await page.screenshot({ path: join(OUT, `${s.label}.png`), fullPage: true });
        console.log(s.label, JSON.stringify(done).slice(0, 300));
        await page.close();
    }
} finally {
    await browser.close();
}
writeFileSync(join(OUT, 'shots.json'), JSON.stringify(results, null, 1));
