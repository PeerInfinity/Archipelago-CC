#!/usr/bin/env node
// SCRATCH (seedling-hammer-c1 D1): replay a hand-built tape on the GAME (p4f, headless logic-only) and print, per
// sampled tick, the player and every row whose class matches --cls (default SandTrap|Turret|TurretSpit), with the
// Enemy fields. Measure-only; nothing tracked.
//   SEEDLING_PORT=9570 node game-sample.mjs --file=tape.json [--cls=SandTrap|Turret] [--out=samples.json]
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/user/Archipelago-CC/package.json')('playwright');
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const P = (p) => import(join(REPO, 'scripts/procgen', p));
const { HEADLESS_LOGIC_ONLY_ARGS } = await P('headlessChromium.js');
const { takeBoxLockOrExit } = await P('boxLock.js');
const { assertLogicOnlyChannel } = await P('seedlingChannel.js');
const { gameVisibleTape, parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const arg = (k, f = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? f;
const tape = parseTape(readFileSync(arg('file'), 'utf8'));
const CLS = new RegExp(`(${arg('cls', 'SandTrap|Turret|TurretSpit')})$`);
takeBoxLockOrExit({ name: 'c1 game-sample', kind: 'browser' });
const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/${process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f'}/game.html`;
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const frames = [];
let drained = null;
try {
    const page = await browser.newPage();
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
    await page.click('#btn-start');
    for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
    await assertLogicOnlyChannel(page);
    const bot = (n, a) => page.evaluate(([name, x]) => String(x === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](x)), [n, a]);
    const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
    const started = await bot('botStart');
    if (started !== 'ok') throw new Error(`botStart: ${started}`);
    const deadline = Date.now() + 600000;
    while (Date.now() < deadline) {
        const raw = await page.evaluate(() => [String(window.__swfBridge.game.botMobiles()), String(window.__swfBridge.game.botStatus())]);
        const m = JSON.parse(raw[0]);
        const s = JSON.parse(raw[1]);
        frames.push({ tick: m.tick ?? s.tick, s, m });
        if (s.finished) break;
    }
    drained = JSON.parse(await bot('botDrain'));
} finally { await browser.close(); }
const seen = new Set();
const out = [];
for (const f of frames) {
    if (seen.has(f.tick)) continue;
    seen.add(f.tick);
    const rows = (f.m.mobiles ?? []);
    const pl = rows.find((r) => /Player$/.test(r.cls));
    const bodies = rows.filter((r) => CLS.test(r.cls)).map((r) => ({ cls: r.cls.split('::').pop(), x: r.x, y: r.y,
        anim: r.anim, idx: r.anim_index, destroy: r.destroy, alpha: r.alpha, on: r.on_screen, angle: r.angle,
        hits: r.enemy?.hits, ht: r.enemy?.hits_timer }));
    out.push({ t: f.tick, level: f.s.level, px: pl?.x, py: pl?.y, hits: f.s.hits ?? f.s.player_hits, s: { hits: f.s.hits, hitsMax: f.s.hits_max }, bodies });
}
for (const o of out) {
    console.log(`t${String(o.t).padStart(4)} L${o.level} p(${o.px?.toFixed?.(2)},${o.py?.toFixed?.(2)}) hits=${JSON.stringify(o.s.hits)} `
        + o.bodies.map((b) => `${b.cls}(${b.x.toFixed(1)},${b.y.toFixed(1)}) a=${b.anim}#${b.idx} h=${b.hits} ht=${b.ht} d=${b.destroy} al=${b.alpha?.toFixed?.(2)}${b.cls === 'Turret' ? ` ang=${b.angle?.toFixed?.(1)}` : ''}`).join(' | '));
}
const last = frames.at(-1)?.s;
console.log('FINAL status keys', Object.keys(last ?? {}).join(','));
console.log('FINAL', JSON.stringify({ tick: last?.tick, level: last?.level, x: last?.x, y: last?.y, hits: last?.hits, persistence_cleared: last?.persistence_cleared }));
if (arg('out')) writeFileSync(arg('out'), JSON.stringify({ frames: out, drained, final: last }, null, 0));
process.exit(0);
