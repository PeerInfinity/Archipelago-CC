#!/usr/bin/env node
/**
 * alias-witness.mjs — slice `rules-spinner-tag-alias`: drive ONE committed tape on the WASM game (`game.html`, default
 * build `seedling_bot_ap_p4g`) and record, for the tag −1 persistence question:
 *
 *   - `botStatus().persistence_cleared` BEFORE `botStart` (the boot sweep's table) and AFTER `finished`
 *     (the table the load / reconcile path of `seedlingEventCollector` reads);
 *   - EVERY distinct `readState().pendingCheck` string the game posted while the tape ran (the LIVE path's input),
 *     sampled on every animation frame, with the game tick it was first seen at.
 *
 * Usage:  node CC/docs/cloud-reports/rules-spinner-tag-alias-evidence/tools/alias-witness.mjs
 *              [--tape=r8-l18-spinner-press | --tape-file=<path>] [--host=http://localhost:8000] [--build=seedling_bot_ap_p4g]
 *
 * Writes JSON to stdout. Takes the box lock (kind `browser`). A probe, not a gate.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { takeBoxLockOrExit } from '../../../../../scripts/procgen/boxLock.js';
import { HEADLESS_WEBGPU_ARGS } from '../../../../../scripts/procgen/headlessChromium.js';
import { gameVisibleTape, parseTape } from '../../../../../frontend/modules/seedlingDemo/tapeFormat.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);

takeBoxLockOrExit({ name: 'alias-witness.mjs', kind: 'browser' });
const HOST = arg('host', 'http://localhost:8000');
const BUILD = arg('build', 'seedling_bot_ap_p4g');
const TAPE = arg('tape', 'r8-l18-spinner-press');
const file = arg('tape-file', '') || join(REPO, 'frontend/modules/seedlingDemo/fixtures/tapes', `${TAPE}.json`);
const tape = parseTape(JSON.parse(readFileSync(file, 'utf8')));
const tapeJson = JSON.stringify(gameVisibleTape(tape));

const browser = await chromium.launch({ args: HEADLESS_WEBGPU_ARGS });
const out = { tape: tape.name, build: BUILD, file: file.replace(REPO + '/', '') };
try {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${BUILD}/game.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__runtimeReady === true, null, { timeout: 180000 });
    await page.click('#btn-start');
    await page.waitForFunction(() => typeof window.__swfBridge?.game?.botStatus === 'function'
        && window.__swfBridge.game.botStatus(), null, { timeout: 180000 });
    // The bridge must be CONFIGURED to monitor `Game.pendingCheck` (the panel does this through `flashBridgeAdapter.
    // configureBridge`, from `games/seedling.json`); then every report arrives in `__swfBridge.stateLog`.
    const gcfg = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
    out.configure = await page.evaluate((c) => window.__swfBridge.game.configure(c), JSON.stringify({
        classes: gcfg.classes, state_properties: gcfg.state_properties.filter((q) => q.property === 'pendingCheck'),
        path_reads: [] }));
    out.load = await page.evaluate((j) => window.__swfBridge.game.botLoadTape(j), tapeJson);
    // The sampler: every rAF, the pendingCheck string and the game's tick.
    await page.evaluate(() => {
        const g = window.__swfBridge.game;
        window.__pc = [];
        let last = null;
        const tick = () => {
            try {
                const s = JSON.parse(g.readState());
                if (s.pendingCheck !== last) {
                    last = s.pendingCheck;
                    const st = JSON.parse(g.botStatus());
                    window.__pc.push({ pendingCheck: last, level: st.level, tick: st.tick ?? st.ticks ?? null,
                        game_time: st.game_time ?? null });
                }
            } catch (e) { window.__pc.push({ error: String(e) }); }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
    out.start = await page.evaluate(() => window.__swfBridge.game.botStart());
    const st0 = await page.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
    out.before = { level: st0.level, persistence_cleared: st0.persistence_cleared };
    const t0 = Date.now();
    const LIMIT = Number(arg('limit-ms', '900000'));
    for (;;) {
        const s = await page.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
        if (s.finished === true) break;
        if (Date.now() - t0 > LIMIT) { out.timedOut = true; break; }
        process.stderr.write(`[${Math.round((Date.now() - t0) / 1000)}s] ${JSON.stringify(
            Object.fromEntries(Object.entries(s).filter(([k, v]) => typeof v !== 'object')))}\n`);
        await page.waitForTimeout(10000);
    }
    await page.waitForTimeout(300);
    const st1 = await page.evaluate(() => JSON.parse(window.__swfBridge.game.botStatus()));
    out.after = { level: st1.level, persistence_cleared: st1.persistence_cleared, finished: st1.finished,
        statusKeys: Object.keys(st1) };
    out.pendingChecks = await page.evaluate(() => window.__pc);
    out.stateLog = await page.evaluate(() => (window.__swfBridge.stateLog ?? []).filter((r) => r.name === 'pendingCheck'));
    const k = (c) => `${c.level}:${c.tag}`;
    const b = new Set((out.before.persistence_cleared ?? []).map(k));
    out.gained = (out.after.persistence_cleared ?? []).filter((c) => !b.has(k(c)));
    out.errors = errors;
} finally {
    await browser.close();
}
console.log(JSON.stringify(out, null, 1));
