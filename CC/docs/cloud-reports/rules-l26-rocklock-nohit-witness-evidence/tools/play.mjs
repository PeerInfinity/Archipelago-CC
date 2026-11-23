#!/usr/bin/env node
// Play one L26 plan ON THE GAME (headless p4g, a FRESH browser + page per call), from the plan file's own staging
// (arms.mjs --out, or a hand-authored plan of the same shape: {staging, perTick, plan:[[keys]...]}).
//   node play.mjs <plan.json> <out.json> [--items={"hasShield":true}]   (overrides seam items; slots re-derived)
// Prints ROW {end, hits, clears, ticks} and writes every tick's [tick, level, x, y, hits] to out.json (+ the tape played).
// Staged: boot, items, save, seam only. Nothing removed, no flag, no game value. Damage ON (noDamage false).
// Adapted from seedling-hammer-small-walls-evidence/tools/legwitness.mjs (--play).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const [file, out] = process.argv.slice(2);
const extra = JSON.parse((process.argv.find((a) => a.startsWith('--items=')) ?? '--items={}').slice(8));
const p = JSON.parse(readFileSync(file, 'utf8'));
const { inventorySlotsFor, parseTape, gameVisibleTape } = await M('tapeFormat.js');
const { buildStagedTape } = await M('botDriverV1.js');
const items = { ...p.staging.seam.items, ...extra };
const staging = { ...p.staging, noDamage: false, seam: { ...p.staging.seam, items }, inventory_slots: inventorySlotsFor(items) };
const perTick = [...(p.perTick ?? []), ...p.plan].map((k) => new Set(k));
const built = buildStagedTape({ staging, perTick, name: `l26-${file.split('/').pop()}` });
const gtape = parseTape(JSON.stringify(built));
const { chromium } = await import('playwright');
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(R, 'scripts/procgen/headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(R, 'scripts/procgen/seedlingChannel.js'));
const { takeBoxLockOrExit } = await import(join(R, 'scripts/procgen/boxLock.js'));
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const HOST = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;
takeBoxLockOrExit({ name: 'rules-l26-rocklock-nohit-witness', kind: 'browser' });
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
    const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(gtape)));
    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
    if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
    const samples = []; let lastT = -1; let status; let firstHit = null; const mobs = [];
    for (const t0 = Date.now(); Date.now() - t0 < 10 * 60 * 1000;) {
        status = JSON.parse(String(await call(page, 'botStatus')));
        if (status.error) throw new Error(status.error);
        if (Number.isInteger(status.tick) && status.tick > lastT) {
            lastT = status.tick; samples.push([status.tick, status.level, status.x, status.y, status.hits]);
            if (firstHit == null && status.hits > 0) firstHit = [status.tick, status.level, status.x, status.y];
            // the punchers (and the player's own row) off `botMobiles`, the same poll: [tick, cls, x, y, anim, hits?, destroy]
            const mob = JSON.parse(String(await call(page, 'botMobiles')));
            for (const m of (mob.mobiles ?? mob ?? [])) if (/Puncher|Player|WandShot/.test(m.cls)) mobs.push([status.tick, m.cls.split('::').pop(), +m.x.toFixed(1), +m.y.toFixed(1), m.anim, m.enemy?.hits ?? null, m.enemy?.hits_timer ?? null, m.destroy]);
        }
        if (status.finished) break;
        await page.waitForTimeout(5);
    }
    const clears = [...new Set((status.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`))].sort();
    const row = { plan: file.split('/').pop(), items: Object.keys(items).filter((k) => items[k]), slots: staging.inventory_slots,
        finished: !!status.finished, ticks: gtape.tick_count, end: { level: status.level, x: status.x, y: status.y },
        hits: status.hits ?? null, deaths: status.deaths ?? null, firstHitSample: firstHit, clears, statusKeys: Object.keys(status) };
    console.log('ROW', JSON.stringify(row));
    writeFileSync(out, JSON.stringify({ row, tape: built, samples, mobs }));
} finally { await page.close(); await browser.close(); }
