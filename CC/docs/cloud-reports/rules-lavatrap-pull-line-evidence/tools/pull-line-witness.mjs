#!/usr/bin/env node
// rules-lavatrap-pull-line: ON THE GAME (p4g, headless logic-only), with the DARK SUIT, does a LavaTrap reel the player
// from a tile the line test CUT (the line to the trap crosses a wall)? And where is the player next reeled, if anywhere?
// Each arm boots on a tile, holds keys, idles, and the game reports the player every tick. Delivered set, `noDamage`
// (L77/L78's runners walk those corridors; a pull with the suit is not damage, LavaTrap.as:61-72).
//   node pull-line-witness.mjs [--host=http://localhost:8000] [--only=a,b] [--out=<dir>]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || new URL('../../../../../', import.meta.url).pathname;
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const T = 16;
const { chromium } = createRequire(join(REPO, 'package.json'))('playwright');
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(REPO, 'scripts/procgen/headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(REPO, 'scripts/procgen/seedlingChannel.js'));
const { takeBoxLockOrExit } = await import(join(REPO, 'scripts/procgen/boxLock.js'));
const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
const { vanillaRecordSet } = await M('levelSetExporter.js');
const { planLevelSetChunks } = await M('levelSetValidator.js');
const J = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const MAP = J('frontend/modules/flashPanel/atlases/seedling-map.json');
const set = vanillaRecordSet(J('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), MAP).set;
const trapsOf = (level) => MAP.levels.find((l) => l.level === level).entities.filter((e) => e.type === 'lavatrap').map((e) => [Math.floor(e.x / T), Math.floor(e.y / T)]);

/** segments: [[key, ticks], …] (key null = idle). Boot is the tile's top-left, as probe-seedling-l78-pull-order.mjs boots. */
export const ARMS = {
    // L78 (11,6): the line to trap (9,6) crosses the wall (10,6). In from (11,5), stand, leave east along row 6.
    'L78-11-6-in-from-north-stand': { level: 78, boot: [11, 5], segs: [['down', 40], [null, 120]] },
    'L78-11-6-cross-to-east': { level: 78, boot: [11, 5], segs: [['down', 30], ['right', 50], [null, 100]] },
    'L78-11-6-in-from-east-and-up': { level: 78, boot: [12, 6], segs: [['left', 30], [null, 60], ['up', 30], [null, 60]] },
    // L78 (9,8): the line to (9,6) crosses the wall (9,7). Walk row 8 from (10,8) west to (8,8) and back.
    'L78-9-8-row8-west': { level: 78, boot: [10, 8], segs: [['left', 45], [null, 120]] },
    'L78-9-8-row8-east': { level: 78, boot: [8, 8], segs: [['right', 45], [null, 120]] },
    'L78-9-8-stand': { level: 78, boot: [9, 8], segs: [[null, 160]] },
    // L77 (6,10): the line to trap (6,12) crosses the wall (6,11). Walk row 10 east from (4,10) to (8,10), and back.
    'L77-6-10-row10-east': { level: 77, boot: [4, 10], segs: [['right', 75], [null, 120]] },
    'L77-6-10-row10-west': { level: 77, boot: [8, 10], segs: [['left', 75], [null, 120]] },
    'L77-6-10-stand': { level: 77, boot: [6, 10], segs: [[null, 160]] },
    // controls: a KEPT disc tile is reeled (the probe sees a pull when there is one)
    'L78-control-10-6-from-12-5': { level: 78, boot: [11, 5], segs: [['left', 20], [null, 120]] },
    'L77-control-7-11-from-7-10': { level: 77, boot: [7, 10], segs: [['down', 30], [null, 120]] },
};
function tapeOf(name, a) {
    let t = 0;
    const inputs = [];
    for (const [key, n] of a.segs) { if (key) inputs.push({ key, from: t, to: t + n }); t += n; }
    return parseTape({
        tape_version: 6, game: 'seedling', noclip: false, noDamage: true, noHazards: [], persistence: [], equips: [],
        save: { totem_parts: [], keys: [], seal_parts: [] }, name: `pull-line-${name}`, description: `pull-line witness ${name}`,
        boot: { level: a.level, x: a.boot[0] * T, y: a.boot[1] * T }, grants: [{ level: a.level, items: ['darksuit'] }],
        tick_count: t, inputs, pins: [...PIN_NAMES],
    });
}
if (process.argv[1] && process.argv[1].endsWith('pull-line-witness.mjs')) {
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const out = arg('out', null);
    if (out) mkdirSync(out, { recursive: true });
    takeBoxLockOrExit({ name: 'rules-lavatrap-pull-line-witness', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const call = (page, n, x) => page.evaluate(([name, v]) => String(v === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](v)), [n, x]);
    const until = async (fn, ms) => { for (const t0 = Date.now(); ;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 150)); } };
    const only = arg('only', null)?.split(',');
    let proved = false;
    for (const [name, a] of Object.entries(ARMS)) {
        if (only && !only.includes(name)) continue;
        const tape = tapeOf(name, a);
        const page = await browser.newPage();
        try {
            await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`, { waitUntil: 'domcontentloaded' });
            await until(() => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await until(() => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels ${answers}`);
            if (await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('botLoadTape');
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const status = await until(async () => { const s = JSON.parse(await call(page, 'botStatus')); if (s.error) throw new Error(s.error); return s.finished ? s : null; }, 600000);
            const ticks = (JSON.parse(await call(page, 'botDrain'))?.ticks ?? []).map((o) => ({ t: o.t, level: o.level, x: o.x, y: o.y }));
            const traps = trapsOf(a.level);
            const tileOf = (o) => [Math.floor(o.x / T), Math.floor(o.y / T)];
            const onTrap = ticks.filter((o) => o.level === a.level && traps.some(([x, y]) => tileOf(o)[0] === x && tileOf(o)[1] === y));
            // the tile path (run-length), and every jump > 2 px in one tick (a reel moves the player 3+ px/tick)
            const path = [];
            for (const o of ticks) { const k = tileOf(o).join(','); if (path.at(-1)?.tile !== k) path.push({ tile: k, t: o.t }); }
            const jumps = [];
            for (let i = 1; i < ticks.length; i += 1) { const d = Math.hypot(ticks[i].x - ticks[i - 1].x, ticks[i].y - ticks[i - 1].y); if (d > 2) jumps.push({ t: ticks[i].t, d: +d.toFixed(2), at: [ticks[i].x, ticks[i].y] }); }
            const row = { arm: name, level: a.level, finished: !!status.finished, obs: ticks.length, tick_count: tape.tick_count, hits: status.hits ?? null,
                start: ticks[0], end: ticks.at(-1), path: path.map((p) => `${p.tile}@${p.t}`).join(' '),
                reeledOnto: onTrap[0] ? { trap: tileOf(onTrap[0]), t: onTrap[0].t } : null, jumps: jumps.slice(0, 6) };
            console.log('ROW', JSON.stringify(row));
            if (out) { writeFileSync(join(out, `${name}.tape.json`), JSON.stringify(tape)); writeFileSync(join(out, `${name}.game.json`), JSON.stringify({ row, ticks })); }
        } catch (e) {
            console.log('ROW', JSON.stringify({ arm: name, error: String(e.message).split('\n')[0] }));
        } finally { await page.close(); }
    }
    await browser.close();
}
