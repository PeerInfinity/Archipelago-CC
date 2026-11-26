#!/usr/bin/env node
/**
 * WITNESS for fidelity READERORDER (wave 64): what the GAME does when a reader that updates before the responders
 * (a PushableBlock*, a Spinner, a WallFlyer) meets lock L on the frame L opens or resets. Each `stage.mjs` shape is
 * staged in the vanilla L38 (level data through `botLoadLevels`, its own `set_id`; no game edit) and played on a FRESH
 * page per run (wave 62's `hang-witness.mjs` method: an unused group, `botStatus` sampled, `botDrain` read at the end).
 *
 *  - The WHOLE tape: `botMobiles` + `botStatus` sampled in a tight loop (every tick the page lets us see), and
 *    `botDrain` (the player's stream) at the end.
 *  - HOLD-CUTS (`cutTape(…, n, {hold: true})`, tape v12: the world is held after n ticks) at each `--cuts` frame: the
 *    exact state after n frames — every Mobile row (the readers and the player) and L's TYPE, read off the page's
 *    `persistence_cleared` (`Lock.turnOff` clears (38,20) on the open, `returnToNormal` sets it back on the reset,
 *    `Lock.as:90-107`: "cleared" = `type == ""`).
 * Run: python3 scripts/serve-nocache.py 9798 & SEEDLING_PORT=9798 node <this> --only=a1-open [--out=…] [--cuts=a-b]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const P = (f) => import(join(REPO, 'scripts/procgen', f));
const { HEADLESS_LOGIC_ONLY_ARGS } = await P('headlessChromium.js');
const { assertLogicOnlyChannel } = await P('seedlingChannel.js');
const { takeBoxLockOrExit } = await P('boxLock.js');
const S = await import(join(HERE, 'stage.mjs'));
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
const HOST = arg('host', `http://localhost:${process.env.SEEDLING_PORT || '8000'}`).replace(/\/+$/, '');
const OUT = arg('out', null);
const ONLY = arg('only', null)?.split(',') ?? null;
const CUTS = arg('cuts', null);
const PARAMS = JSON.parse(arg('params', '{}'));
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { gameVisibleTape } = await M('tapeFormat.js');
const { planLevelSetChunks } = await M('levelSetValidator.js');
const L25 = await M('fidelityL25ApItem.js');
const manifest = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/wasm/builds.json'), 'utf8'));
const capabilities = manifest.builds.find((b) => b.name === PAGE)?.capabilities ?? null;
const base = L25.l25Sets(REPO).vanilla;
const stagedSet = (s) => ({ ...base, set_id: `${base.set_id}-ro-${s.name}`, rooms: base.rooms.map((r) => (r.id !== S.LEVEL ? r
    : { ...r, source: { record: { ...S.stagedRecord({ level: S.LEVEL, ...r.source.record }, s), level: undefined } } })) });

takeBoxLockOrExit({ name: 'readerorder-witness.mjs', kind: 'browser' });
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
let proved = false;
const READERS = /PushableBlock|Spinner|WallFlyer|Player$/;
const rowOf = (m) => ({ cls: m.cls.split('::').pop(), x: m.x, y: m.y, vx: m.vx, vy: m.vy, type: m.type, destroy: m.destroy, alpha: m.alpha });
const lockOpen = (st) => (st?.persistence_cleared ?? []).some((c) => Number(c.level) === S.LEVEL && Number(c.tag) === S.L_TAG);

async function play(set, tape, { sample = false } = {}) {
    const page = await browser.newPage();
    const log = [];
    page.on('pageerror', (e) => log.push(`pageerror ${String(e.message).slice(0, 200)}`));
    const call = (n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[name] !== 'function') return null;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    const json = async (n, a) => { const r = await call(n, a); return r === null ? null : JSON.parse(r); };
    try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (const s = Date.now(); !(await page.evaluate(() => !!window.__runtimeReady));) { if (Date.now() - s > 180000) throw new Error('runtime'); await page.waitForTimeout(200); }
        await page.click('#btn-start');
        for (const s = Date.now(); !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)));) { if (Date.now() - s > 180000) throw new Error('bot'); await page.waitForTimeout(200); }
        if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
        const answers = [];
        for (const c of planLevelSetChunks(set).chunks) answers.push(await call('botLoadLevels', JSON.stringify(c)));
        if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
        const mounted = (await json('botLevelSet'))?.active ?? null;
        if (await call('botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('botLoadTape');
        if (await call('botStart') !== 'ok') throw new Error('botStart');
        const samples = new Map();
        let status = null;
        for (const s = Date.now(); Date.now() - s < 120000;) {
            if (sample) {
                const raw = await page.evaluate(() => { const g = window.__swfBridge.game; return [String(g.botMobiles()), String(g.botStatus())]; });
                const m = JSON.parse(raw[0]);
                const st = JSON.parse(raw[1]);
                if (Number.isInteger(m.tick) && !samples.has(m.tick) && st.level === S.LEVEL) {
                    samples.set(m.tick, { tick: m.tick, lockOpen: lockOpen(st), hits: st.hits, rows: (m.mobiles ?? []).filter((r) => READERS.test(r.cls)).map(rowOf) });
                }
                if (st.finished) { status = st; break; }
            } else {
                const st = await json('botStatus');
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                if (st?.finished) { status = st; break; }
                await page.waitForTimeout(100);
            }
        }
        if (!status) throw new Error('the tape did not finish');
        const mob = await json('botMobiles');
        const drained = await json('botDrain');
        return { mounted, tick: status.tick, held: status.held, hits: status.hits, lockOpen: lockOpen(status),
            rows: (mob?.mobiles ?? []).filter((r) => READERS.test(r.cls)).map(rowOf), mobTick: mob?.tick,
            stream: (drained?.ticks ?? []).map((o) => ({ level: o.level, x: o.x, y: o.y })),
            samples: [...samples.values()].sort((a, b) => a.tick - b.tick), log };
    } finally {
        await page.close();
    }
}

const out = [];
try {
    for (const s of S.SHAPES) {
        if (ONLY && !ONLY.includes(s.name)) continue;
        const set = stagedSet(s);
        const tape = S.shapeTape(s, PARAMS);
        const t0 = Date.now();
        const whole = await play(set, tape, { sample: true });
        console.log(`${s.name}: whole tape ${tape.tick_count} t, mounted ${whole.mounted}, ${whole.samples.length} sampled ticks, stream ${whole.stream.length}, hits ${whole.hits}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        // controls: cut at the analogous frames (the bracketing A2 releases at the pulse's move, the occupancy shapes where the
        // model shuts L on the reader, the never-pressed ones where the reader meets the shut L).
        const FOCUS = { 'a1-ctl': 133, 'a2-r149': 156, 'a2-r151': 156, 'a2-ctl': 156, 'b1-occ': 133, 'b1-ctl': 30, 'b2-occ': 161, 'b2-ctl': 20 };
        const focus = s.meet ?? FOCUS[s.name] ?? null;
        const [a, b] = CUTS ? CUTS.split('-').map(Number) : (focus ? [focus - 3, focus + 2] : [null, null]);
        const cuts = [];
        for (let n = a; a !== null && n <= b; n++) {
            const c = await play(set, L25.cutTape(tape, n, { hold: true }));
            cuts.push({ n, tick: c.tick, mobTick: c.mobTick, held: c.held, lockOpen: c.lockOpen, hits: c.hits, rows: c.rows, streamLen: c.stream.length });
            const rd = c.rows.filter((r) => r.cls !== 'Player').map((r) => `${r.cls}(${r.x},${r.y})`).join(' ');
            const pl = c.rows.find((r) => r.cls === 'Player');
            console.log(`  cut ${n}: tick ${c.tick} held ${c.held} L ${c.lockOpen ? 'OPEN' : 'shut'} ${rd} Player(${pl?.x},${pl?.y}) hits ${c.hits}`);
        }
        out.push({ shape: s.name, params: { ...s.defaults, ...PARAMS }, set: set.set_id, tape, whole, cuts });
    }
} finally {
    await browser.close();
}
if (OUT) writeFileSync(OUT, `${JSON.stringify({ source: 'readerorder-witness.mjs', build: PAGE, capabilities, shapes: out }, null, 1)}\n`);
