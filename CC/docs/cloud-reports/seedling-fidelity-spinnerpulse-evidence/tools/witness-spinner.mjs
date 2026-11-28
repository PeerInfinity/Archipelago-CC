#!/usr/bin/env node
/**
 * wave 72 (SPINNERPULSE) D1/D2: the GAME's per-tick spinner stream. Wave 69's `witness-deadframe2.mjs` (`--tapes=`)
 * method — a committed tape on the vanilla set (`botLoadLevels`, its own `set_id`), a FRESH page per run, `botMobiles`
 * + `botStatus` sampled in a tight loop — keeping every sampled Spinner row in full (x, y, vx, vy, the enemy block's
 * hits / hits_timer, destroy, alpha). `--tape=<name>` (a committed `fixtures/tapes/<name>.json`) or `--tapefile=<path>`
 * (a JSON tape, e.g. a staged witness shape). `--set=<path>` mounts a staged level set instead of the vanilla one.
 * `--cuts=a,b` adds hold-cuts (exact state after n frames, `cutTape(…, n, {hold:true})`).
 * Run: python3 scripts/serve-nocache.py 9798 & SEEDLING_PORT=9798 node <this> --tape=r5-shaft-control --out=f.json
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const P = (f) => import(join(REPO, 'scripts/procgen', f));
const { HEADLESS_LOGIC_ONLY_ARGS } = await P('headlessChromium.js');
const { assertLogicOnlyChannel } = await P('seedlingChannel.js');
const { takeBoxLockOrExit } = await P('boxLock.js');
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
const HOST = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { gameVisibleTape } = await M('tapeFormat.js');
const { planLevelSetChunks } = await M('levelSetValidator.js');
const L25 = await M('fidelityL25ApItem.js');
const base = L25.l25Sets(REPO).vanilla;
const SET = arg('set', null) ? JSON.parse(readFileSync(arg('set'), 'utf8')) : base;
const rowOf = (m) => ({ x: m.x, y: m.y, vx: m.vx, vy: m.vy, destroy: m.destroy, alpha: m.alpha, hits: m.enemy?.hits, ht: m.enemy?.hits_timer });

export async function play(browser, set, tape) {
    const page = await browser.newPage();
    const call = (n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[name] !== 'function') return null;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (const s = Date.now(); !(await page.evaluate(() => !!window.__runtimeReady));) { if (Date.now() - s > 180000) throw new Error('runtime'); await page.waitForTimeout(200); }
        await page.click('#btn-start');
        for (const s = Date.now(); !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)));) { if (Date.now() - s > 180000) throw new Error('bot'); await page.waitForTimeout(200); }
        await assertLogicOnlyChannel(page);
        const answers = [];
        for (const c of planLevelSetChunks(set).chunks) answers.push(await call('botLoadLevels', JSON.stringify(c)));
        if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
        if (await call('botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('botLoadTape');
        if (await call('botStart') !== 'ok') throw new Error('botStart');
        const samples = new Map();
        let status = null;
        for (const s = Date.now(); Date.now() - s < 300000;) {
            const raw = await page.evaluate(() => { const g = window.__swfBridge.game; return [String(g.botMobiles()), String(g.botStatus())]; });
            const m = JSON.parse(raw[0]); const st = JSON.parse(raw[1]);
            if (Number.isInteger(m.tick) && !samples.has(m.tick)) {
                samples.set(m.tick, { tick: m.tick, level: st.level, hits: st.hits, dead: st.dead_frames,
                    cleared: (st.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`),
                    sp: (m.mobiles ?? []).filter((r) => /Spinner$/.test(r.cls)).map(rowOf),
                    pl: (m.mobiles ?? []).filter((r) => /Player$/.test(r.cls)).map((r) => ({ x: r.x, y: r.y })) });
            }
            if (st.finished) { status = st; break; }
        }
        if (!status) throw new Error('the tape did not finish');
        return { tick: status.tick, held: status.held, hits: status.hits, cleared: status.persistence_cleared, samples: [...samples.values()].sort((a, b) => a.tick - b.tick) };
    } finally { await page.close(); }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
    const tape = arg('tapefile', null) ? JSON.parse(readFileSync(arg('tapefile'), 'utf8'))
        : JSON.parse(readFileSync(join(REPO, 'frontend/modules/seedlingDemo/fixtures/tapes', `${arg('tape', 'r5-shaft-control')}.json`), 'utf8'));
    takeBoxLockOrExit({ name: 'witness-spinner.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const out = { source: 'witness-spinner.mjs', build: PAGE, tape: arg('tape', arg('tapefile', null)), set: SET.set_id, cuts: [] };
    try {
        out.whole = await play(browser, SET, tape);
        console.log(`whole: tick ${out.whole.tick} hits ${out.whole.hits} sampled ${out.whole.samples.length}`);
        for (const n of (arg('cuts', '') || '').split(',').filter(Boolean).map(Number)) {
            const c = await play(browser, SET, L25.cutTape(tape, n, { hold: true }));
            const last = c.samples.at(-1);
            out.cuts.push({ n, tick: c.tick, held: c.held, last });
            console.log(`cut ${n}: tick ${c.tick} held ${c.held} ${JSON.stringify(last?.sp)}`);
        }
    } finally { await browser.close(); }
    if (arg('out', null)) writeFileSync(arg('out'), `${JSON.stringify(out)}\n`);
}
