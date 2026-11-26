#!/usr/bin/env node
/**
 * WITNESS for fidelity BUTTONROOMCLEAR (wave 63): what the GAME does when ANOTHER presser's publish reaches a
 * ButtonRoom (its whole setter, `ButtonRoom.as:67-98`). Each `fidelityPublishedButtonRoom.BR_SHAPES` shape is staged in
 * the vanilla L38 (level data through `botLoadLevels`, its own `set_id`; no game edit) and its tape is played on a
 * FRESH page. The page's errors are kept, `botStatus` is sampled every 150 ms (the persistence readout for L37/L38,
 * the tick, the level and the position), and `botDrain` (the per-tick stream) is read at the end. Adapted from wave
 * 62's `hang-witness.mjs` (the same L38 + group-6 method, the default p4g page).
 * Run: python3 scripts/serve-nocache.py 9798 & SEEDLING_PORT=9798 node <this> [--out=…] [--only=a,b] [--wall=ms]
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
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
const HOST = arg('host', `http://localhost:${process.env.SEEDLING_PORT || '8000'}`).replace(/\/+$/, '');
const OUT = arg('out', null);
const ONLY = arg('only', null)?.split(',') ?? null;
const WALL = Number(arg('wall', '45000'));
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { gameVisibleTape } = await M('tapeFormat.js');
const { planLevelSetChunks } = await M('levelSetValidator.js');
const L25 = await M('fidelityL25ApItem.js');
const H = await M('fidelityPublishedButtonRoom.js');
const manifest = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/wasm/builds.json'), 'utf8'));
const capabilities = manifest.builds.find((b) => b.name === PAGE)?.capabilities ?? null;
const sets0 = L25.l25Sets(REPO);
const base = sets0.vanilla;
const stagedSet = (shape) => ({ ...base, set_id: `${base.set_id}-publishedbr-${shape.name}`, rooms: base.rooms.map((r) => (r.id !== 38 ? r
    : { ...r, source: { record: { ...H.hangRecord({ level: 38, ...r.source.record }, shape), level: undefined } } })) });

takeBoxLockOrExit({ name: 'br-witness.mjs', kind: 'browser' });
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const KEEP = ['tick', 'tick_count', 'buffered', 'dead_frames', 'finished', 'error', 'level', 'x', 'y', 'receive_input', 'hits', 'frozen', 'held'];
let proved = false;
const rows = [];
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${what}`)), ms))]);
try {
    for (const shape of H.BR_SHAPES) {
        if (ONLY && !ONLY.includes(shape.name)) continue;
        const set = stagedSet(shape);
        const tape = H.brTape(REPO, shape);
        const page = await browser.newPage();
        const log = [];
        const t0 = Date.now();
        page.on('pageerror', (e) => log.push({ ms: Date.now() - t0, kind: 'pageerror', text: String(e.message).slice(0, 400) }));
        page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || /stack|exception|abort/i.test(m.text())) log.push({ ms: Date.now() - t0, kind: `console.${m.type()}`, text: m.text().slice(0, 400) }); });
        const call = (n, a) => page.evaluate(([name, x]) => {
            const g = window.__swfBridge && window.__swfBridge.game;
            if (!g || typeof g[name] !== 'function') return null;
            try { return String(x === undefined ? g[name]() : g[name](x)); } catch (e) { return `THREW: ${e && e.message}`; }
        }, [n, a]);
        const json = async (n, a) => { const r = await call(n, a); try { return r === null ? null : JSON.parse(r); } catch { return { raw: r }; } };
        const row = { shape: shape.name, source: shape.source, set: set.set_id, samples: [], log };
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (const s = Date.now(); !(await page.evaluate(() => !!window.__runtimeReady));) { if (Date.now() - s > 180000) throw new Error('runtime'); await page.waitForTimeout(250); }
            await page.click('#btn-start');
            for (const s = Date.now(); !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)));) { if (Date.now() - s > 180000) throw new Error('bot'); await page.waitForTimeout(250); }
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call('botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            row.mounted = (await json('botLevelSet'))?.active ?? null;
            const loaded = await call('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            row.logBeforeStart = log.length;
            row.startMs = Date.now() - t0;
            row.start = await call('botStart');
            for (const s = Date.now(); Date.now() - s < WALL;) {
                const st = await withTimeout(json('botStatus'), 5000, 'botStatus').catch((e) => ({ raw: String(e.message) }));
                const keep = { ms: Date.now() - t0 };
                for (const k of KEEP) if (st && k in st) keep[k] = st[k];
                if (st?.raw) keep.raw = st.raw;
                keep.cleared = (st?.persistence_cleared ?? []).filter((c) => Number(c.level) === 38 || Number(c.level) === 37).map((c) => `${c.level},${c.tag}`).join(' ');
                row.samples.push(keep);
                if (st?.finished) break;
                await page.waitForTimeout(150);
            }
            const d = await withTimeout(json('botDrain'), 8000, 'botDrain').catch((e) => ({ raw: String(e.message) }));
            row.drain = d?.raw ? { raw: d.raw } : { ticks: (d?.ticks ?? []).map((o) => ({ level: o.level, x: o.x, y: o.y })) };
        } catch (e) {
            row.failure = String(e.message);
        } finally {
            await page.close();
        }
        const last = row.samples.at(-1) ?? {};
        const firstErr = log.find((l) => /Maximum call stack|RangeError|stack/i.test(l.text));
        row.summary = { finished: !!last.finished, tick: last.tick, buffered: last.buffered, dead_frames: last.dead_frames,
            level: last.level, x: last.x, y: last.y, cleared: last.cleared, errors: log.length, firstError: firstErr ?? null,
            drained: row.drain?.ticks?.length ?? row.drain?.raw ?? null };
        console.log(`${shape.name}: ${JSON.stringify(row.summary)}`);
        rows.push(row);
    }
} finally {
    await browser.close();
}
if (OUT) writeFileSync(OUT, `${JSON.stringify({ source: 'br-witness.mjs', build: PAGE, capabilities, rows }, null, 1)}\n`);
