#!/usr/bin/env node
// MEASUREMENT-ONLY (copied from PKSW-HITS for STACK4-MEASURE, lock name changed; the play half of L40-SPINNER-WALLS's legwitness.mjs, unchanged in what it drives):
// play a staged tape (a survey walk view) ON THE GAME, headless p4g logic-only, fresh page, delivered AP set, under the
// box lock; print one ROW {finished, ticks, end, hits, clears} and write the samples.
//   node tapewitness.mjs <tape.json> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = process.env.REPO || process.cwd();
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const [tapeFile, outFile] = process.argv.slice(2);
const { parseTape, gameVisibleTape } = await M('tapeFormat.js');
const gtape = parseTape(readFileSync(tapeFile, 'utf8'));
const { chromium } = await import('playwright');
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(R, 'scripts/procgen/headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(R, 'scripts/procgen/seedlingChannel.js'));
const { takeBoxLockOrExit } = await import(join(R, 'scripts/procgen/boxLock.js'));
const { planLevelSetChunks } = await M('levelSetValidator.js');
const { l25Sets } = await M('fidelityL25ApItem.js');
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const HOST = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;
takeBoxLockOrExit({ name: 'stack4-measure-step149-witness', kind: 'browser' });
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const call = (page, n, a) => page.evaluate(([name, x]) => String(x === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](x)), [n, a]);
const until = async (page, fn, ms) => { for (const t0 = Date.now(); ;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout'); await page.waitForTimeout(100); } };
const page = await browser.newPage();
try {
    await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`, { waitUntil: 'domcontentloaded' });
    await until(page, () => page.evaluate(() => !!window.__runtimeReady), 180000);
    await page.click('#btn-start');
    await until(page, () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
    await assertLogicOnlyChannel(page);
    const answers = [];
    for (const c of planLevelSetChunks(l25Sets(R).delivered).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
    if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
    const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(gtape)));
    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
    if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
    const samples = [];
    let lastT = -1;
    let status;
    for (const t0 = Date.now(); Date.now() - t0 < 20 * 60 * 1000;) {
        status = JSON.parse(String(await call(page, 'botStatus')));
        if (status.error) throw new Error(status.error);
        if (Number.isInteger(status.tick) && status.tick >= lastT + 10) { lastT = status.tick; samples.push([status.tick, status.level, status.x, status.y, status.hits]); }
        if (status.finished) break;
        await page.waitForTimeout(20);
    }
    const clears = [...new Set((status.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`))].sort();
    const row = { tape: tapeFile.split('/').pop(), finished: !!status.finished, ticks: gtape.tick_count,
        end: { level: status.level, x: status.x, y: status.y }, hits: status.hits ?? null, clears };
    console.log('ROW', JSON.stringify(row));
    writeFileSync(outFile, JSON.stringify({ row, samples }));
} finally { await page.close(); await browser.close(); }
