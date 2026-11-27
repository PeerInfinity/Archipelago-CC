#!/usr/bin/env node
/**
 * WITNESS for fidelity CHESTCOVER (wave 61): the VANILLA set with L38 staged (`fidelityChestCover.coverButtonRecord`:
 * `buttonroom@144,128` swapped for a `button tset 0`, `button@80,192` moved to group 5 — ONE Button in group 0),
 * loaded through `botLoadLevels` (level data; no game edit), playing each `CHEST_COVER_PLANS` tape: the whole tape
 * (the game's drained stream, kept whole in the JSON, vs the model's replay OFF and ON), then cuts (`hold`) around the
 * open: which cut first shows slot 38,1 cleared. Model OFF predicts 12, ON 13 on `l38-cover-button`.
 * Adapted from wave 60's `apchestcover-witness.mjs` (same staging, same door, the default p4g page by default).
 * Run: python3 scripts/serve-nocache.py 9798 & SEEDLING_PORT=9798 node <this> [--out=…]   (SEEDLING_PAGE to override)
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
await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', `http://localhost:${process.env.SEEDLING_PORT || '8000'}`).replace(/\/+$/, '');
    const OUT = arg('out', null);
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { gameVisibleTape } = await M('tapeFormat.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const L25 = await M('fidelityL25ApItem.js');
    const F = await M('fidelityChestCover.js');
    const CF = await M('contactFidelity.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const manifest = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/wasm/builds.json'), 'utf8'));
    const capabilities = manifest.builds.find((b) => b.name === PAGE)?.capabilities ?? null;
    const sets0 = L25.l25Sets(REPO);
    const base = sets0.vanilla;
    const staged = { ...base, set_id: `${base.set_id}-l38btn1`, rooms: base.rooms.map((r) => (r.id !== 38 ? r
        : { ...r, source: { record: { ...F.coverButtonRecord({ level: 38, ...r.source.record }), level: undefined } } })) };
    const swapped = staged.rooms[38].source.record.entities.filter((e) => (e.x === 144 && e.y === 128) || e.type === 'button');
    console.log('L38 at 144,128 + every button (staged):', JSON.stringify(swapped));
    const src = (n) => F.coverButtonRecord(sets0.vanillaSource(n));
    const atlas = atlasLevelSource();
    const srcAtlas = (n) => F.coverButtonRecord(atlas(n));
    const sets = { delivered: staged };
    console.log(`PAGE: ${PAGE} · capabilities ${JSON.stringify(capabilities)} · set ${sets.delivered.set_id}`);

    takeBoxLockOrExit({ name: 'chestcover-witness.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const call = (page, n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[name] !== 'function') return null;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    const json = async (page, n, a) => { const r = await call(page, n, a); return r === null ? null : JSON.parse(r); };
    const waitFor = async (page, what, fn, ms) => {
        for (const t0 = Date.now(); ;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(250);
        }
    };
    let proved = false;
    const play = async (t) => {
        const page = await browser.newPage();
        if (process.env.DEBUG_STATUS) { page.on('console', (m) => console.log('CONSOLE', m.type(), m.text().slice(0, 300))); page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 300))); }
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const answers = [];
            for (const c of planLevelSetChunks(sets.delivered).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (process.env.DEBUG_STATUS) console.log('LOAD', answers.join(','));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const mounted = await json(page, 'botLevelSet');
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(t)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = await json(page, 'botStatus');
                if (process.env.DEBUG_STATUS) { const { input, ...rest } = st ?? {}; { const { save, persistence, persistence_cleared, items, rng, sound_pin, ...r2 } = rest; console.log('STATUS', JSON.stringify(r2).slice(0, 2500)); } }
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                return st?.finished ? st : null;
            }, 10 * 60 * 1000);
            const drained = await json(page, 'botDrain');
            const clears = [...new Set((status.persistence_cleared ?? []).map((c) => `${Number(c.level)},${Number(c.tag)}`))].sort();
            return { mounted: mounted?.active ?? null, clears, hits: status.hits ?? null,
                ticks: (drained?.ticks ?? []).map((o) => ({ level: o.level, x: o.x, y: o.y })) };
        } finally {
            await page.close();
        }
    };
    const drift = (m, g) => {
        let worst = 0;
        let first = null;
        const n = Math.min(m.length, g.length);
        for (let i = 0; i < n; i++) {
            const d = m[i].level !== g[i].level ? Infinity : Math.max(Math.abs(m[i].x - g[i].x), Math.abs(m[i].y - g[i].y));
            if (d > 0 && first === null) first = { t: i, game: g[i], model: m[i] };
            if (d > worst) worst = d;
        }
        return { compared: n, worst, first };
    };
    const rows = [];
    try {
        for (const p of F.CHEST_COVER_PLANS) {
            const tape = F.chestCoverPlanTape(REPO, p);
            const slot = '38,1';
            const m = {};
            for (const on of [false, true]) {
                m[on ? 'on' : 'off'] = CF.withContactFidelity({ chestCoverFencepost: on }, () => F.chestCoverReplay(tape, src, { capabilities }));
                const a = CF.withContactFidelity({ chestCoverFencepost: on }, () => F.chestCoverReplay(tape, srcAtlas, { capabilities }));
                check(`${p.name} ${on ? 'ON' : 'OFF'}: the record-set source and the atlas source replay the same`, JSON.stringify(a.rows) === JSON.stringify(m[on ? 'on' : 'off'].rows));
            }
            const full = await play(tape);
            const dOff = drift(m.off.rows, full.ticks);
            const dOn = drift(m.on.rows, full.ticks);
            const row = { plan: p.name, slot, model: { off: m.off.openTick, on: m.on.openTick }, game: { mounted: full.mounted,
                observations: full.ticks.length, cleared: full.clears.includes(slot), hits: full.hits },
                positions: { off: dOff, on: dOn }, cuts: {}, stream: full.ticks };
            check(`${p.name}: the staged set is mounted`, String(full.mounted ?? '').includes('l38btn1'), JSON.stringify(full.mounted));
            check(`${p.name}: the whole tape clears slot 38,1`, full.clears.includes(slot));
            const around = [m.off.openTick - 2, m.off.openTick - 1, m.off.openTick, m.on.openTick, m.on.openTick + 1]
                .filter((n, i, a) => n > 0 && a.indexOf(n) === i);
            for (const n of around) {
                const c = await play(L25.cutTape(tape, n, { hold: true }));
                row.cuts[n] = c.clears.includes(slot);
            }
            const gameOpen = around.find((n) => row.cuts[n]) ?? null;
            row.gameOpenTick = gameOpen;
            console.log(`VERDICT ${p.name}: the game opens on ${gameOpen}; model OFF ${m.off.openTick}, model ON ${m.on.openTick} — cuts ${JSON.stringify(row.cuts)}`);
            console.log(`(OFF replay vs game: ${JSON.stringify(dOff)}; ON replay vs game: ${JSON.stringify(dOn)})`);
            rows.push(row);
        }
    } finally {
        await browser.close();
    }
    if (OUT) writeFileSync(OUT, `${JSON.stringify({ source: 'chestcover-witness.mjs', build: PAGE, capabilities,
        set: sets.delivered.set_id, rows }, null, 2)}\n`);
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
