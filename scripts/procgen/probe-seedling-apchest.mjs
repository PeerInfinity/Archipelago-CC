#!/usr/bin/env node
/**
 * Seedling's AP CHEST (`Pickups/APChest`), ON THE GAME (slice seedling-fidelity-apchest).
 *
 * On a build declaring `apchest` (p4h, Seedling `p4h-as3` 169247c4c4) an `<apitem kind="chest">` is a Solid chest
 * opened only from the line one pixel under it (`APChest.as:72-80`), with no SealPiece; its open writes the AP slot
 * clear (`APChest.as:90-92`). The model builds it so on those capabilities (`fidelityApChest.js`, one derivation of
 * the plans and the replay). Every arm plays on a FRESH page, on the playthrough's DELIVERED set
 * (`fidelityL25ApItem.l25Sets`):
 *
 *   <plan>          the whole plan tape: the game's drained stream against the model's p4h replay (0 px expected),
 *                   and whether the chest's slot is cleared (only the plans with a predicted `openTick`).
 *   <plan>@TAKE     cut at `openTick` ticks, `hold`: the slot IS cleared (the open frame's take).
 *   <plan>@BEFORE   cut at `openTick - 1` ticks, `hold`: it is NOT. TAKE/BEFORE bracket the model's open tick.
 *   l25-survey      the L25 survey tape (p4g takes the apitem from the north-east on tick 48): on p4h it takes nothing.
 *
 * `modelOnly` plans (a room not on the delivered set) are listed and skipped. Prints `PASS:`/`FAIL:` rows,
 * `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. `--out=<file>` writes the rows as JSON.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000; or `SEEDLING_PORT`); the wasm
 * build, or SKIP. Takes the box lock. Headless LOGIC-ONLY.
 *
 * Run: SEEDLING_PAGE=seedling_bot_ap_p4h SEEDLING_PORT=9798 node scripts/procgen/probe-seedling-apchest.mjs [--out=…]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', `http://localhost:${process.env.SEEDLING_PORT || '8000'}`).replace(/\/+$/, '');
    const OUT = arg('out', null);
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4h';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { gameVisibleTape } = await M('tapeFormat.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const L25 = await M('fidelityL25ApItem.js');
    const F = await M('fidelityApChest.js');
    const manifest = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/wasm/builds.json'), 'utf8'));
    const capabilities = manifest.builds.find((b) => b.name === PAGE)?.capabilities ?? null;
    const sets = L25.l25Sets(REPO);
    console.log(`PAGE: ${PAGE} · capabilities ${JSON.stringify(capabilities)} · delivered ${sets.delivered.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-apchest.mjs', kind: 'browser' });
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
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const answers = [];
            for (const c of planLevelSetChunks(sets.delivered).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const mounted = await json(page, 'botLevelSet');
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(t)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = await json(page, 'botStatus');
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
    const SLOTS = { 11: '11,0', 25: '25,0', 38: '38,1' };
    const rows = [];
    try {
        for (const p of F.AP_CHEST_PLANS) {
            if (p.modelOnly) { console.log(`SKIP: ${p.name} — modelOnly (${p.what})`); continue; }
            const tape = F.apChestPlanTape(REPO, p);
            const model = F.apChestReplay(tape, sets.deliveredSource, { capabilities });
            const slot = SLOTS[p.boot.level];
            const full = await play(tape);
            const d = drift(model.rows, full.ticks);
            const row = { plan: p.name, slot, predicted: p.predicted, modelOpenTick: model.openTick,
                game: { mounted: full.mounted, observations: full.ticks.length, cleared: full.clears.includes(slot), hits: full.hits,
                    end: full.ticks.at(-1) ?? null }, positions: d };
            check(`${p.name}: the model's p4h replay is the game's stream`, d.worst === 0 && d.compared === tape.tick_count + 1,
                JSON.stringify(d));
            check(`${p.name}: the slot ${slot} is cleared iff the model opens the chest`, full.clears.includes(slot) === (p.predicted.openTick !== null),
                `game ${full.clears.includes(slot)}, predicted openTick ${p.predicted.openTick}`);
            if (p.predicted.openTick !== null) {
                const take = await play(L25.cutTape(tape, p.predicted.openTick, { hold: true }));
                const before = await play(L25.cutTape(tape, p.predicted.openTick - 1, { hold: true }));
                row.take = { ticks: p.predicted.openTick, cleared: take.clears.includes(slot) };
                row.before = { ticks: p.predicted.openTick - 1, cleared: before.clears.includes(slot) };
                check(`${p.name}@TAKE/BEFORE: the clear lands on the model's open tick ${p.predicted.openTick}`,
                    row.take.cleared && !row.before.cleared, JSON.stringify({ take: row.take, before: row.before }));
            }
            console.log(`ROW ${JSON.stringify(row)}`);
            rows.push(row);
        }
        const survey = L25.l25Tape(REPO);
        const s = await play(survey);
        const sm = F.apChestReplay(survey, sets.deliveredSource, { capabilities });
        const sd = drift(sm.rows, s.ticks);
        const srow = { plan: 'l25-survey', slot: '25,0', game: { cleared: s.clears.includes('25,0'), observations: s.ticks.length }, positions: sd };
        check('l25-survey: on this build the survey tape (a north-east touch) takes nothing', !s.clears.includes('25,0'), JSON.stringify(srow.game));
        check('l25-survey: the model\'s replay is the game\'s stream', sd.worst === 0, JSON.stringify(sd));
        console.log(`ROW ${JSON.stringify(srow)}`);
        rows.push(srow);
    } finally {
        await browser.close();
    }
    if (OUT) writeFileSync(OUT, `${JSON.stringify({ source: 'probe-seedling-apchest.mjs', build: PAGE, capabilities,
        delivered_set: sets.delivered.set_id, rows }, null, 2)}\n`);
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
