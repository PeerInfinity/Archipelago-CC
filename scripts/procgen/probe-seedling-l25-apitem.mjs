#!/usr/bin/env node
/**
 * Seedling's L25 AP CHEST, ON THE GAME (fidelity L25APITEM D1, `CONTACT_FIDELITY.apChestItem`).
 *
 * The randomizer delivers every playthrough location as an `<apitem>` (`seedlingRandomizerWiring`: `vanillaRecordSet`
 * → `buildPlacementTable` → `rewriteRecordSet`), so `Level 025 - Chest` is a NON-SOLID `Pickups/APItem`
 * (`APItem.as:114-115`, 8×8 at the cell's centre) taken on overlap from any side (`Pickup.as:78`), where the vanilla
 * `chest@96,96` is a Solid opened only from the line one pixel under its body (`Chest.as:63`). The tape is the route
 * survey's step-34 solve with the key ON (`fidelityL25ApItem.L25_TAPE`): it walks in from the NORTH-EAST, never
 * stands under the chest, and takes it inside the chest's own cell.
 *
 * Four arms, each on a FRESH page, from the same tape (`fidelityL25ApItem` is the one derivation):
 *   DELIVERED  the whole tape on the delivered set: L25 → L22; the model's replay on the same rooms, 0 px.
 *   TAKE       cut at `takenAt + 1` ticks, `hold`: `{25,0}` is cleared (the apitem's `removed()`).
 *   BEFORE     cut at `takenAt` ticks, `hold`: it is NOT. TAKE/BEFORE bracket the take on the model's tick.
 *   VANILLA    the whole tape on the VANILLA set (the control): the chest stays Solid, `{25,0}` stays set, and the
 *              model's replay on the vanilla rooms (the bottom-line rule) is the game's at 0 px too.
 *
 * `--record` writes `fixtures/l25apitem-witness/oracle.json` (what `fidelityL25ApItem.test.js` holds the model to).
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000; or `SEEDLING_PORT`); the wasm
 * build, or SKIP. Takes the box lock. Headless LOGIC-ONLY.
 *
 * Run: SEEDLING_PORT=9777 node scripts/procgen/probe-seedling-l25-apitem.mjs [--host=…] [--record]
 */
import { chromium } from 'playwright';
import { existsSync, writeFileSync } from 'node:fs';
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
    const RECORD = process.argv.includes('--record');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { gameVisibleTape } = await M('tapeFormat.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const F = await M('fidelityL25ApItem.js');
    const sets = F.l25Sets(REPO);
    const tape = F.l25Tape(REPO);
    const model = { delivered: F.l25Replay(tape, sets.deliveredSource), vanilla: F.l25Replay(tape, sets.vanillaSource) };
    const takenAt = model.delivered.takenAt;
    console.log(`PAGE: ${PAGE} · delivered ${sets.delivered.set_id} · vanilla ${sets.vanilla.set_id} · model takenAt ${takenAt}`);

    takeBoxLockOrExit({ name: 'probe-seedling-l25-apitem.mjs', kind: 'browser' });
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
    const logs = [];
    let proved = false;
    const play = async (set, t) => {
        const page = await browser.newPage();
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
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
    const slot = `${F.L25_SLOT.level},${F.L25_SLOT.tag}`;
    const oracle = { source: 'probe-seedling-l25-apitem.mjs --record (seedling fidelity L25APITEM)', build: PAGE,
        tape: F.L25_TAPE, delivered_set: sets.delivered.set_id, vanilla_set: sets.vanilla.set_id, slot, takenAt };
    try {
        check('the model takes the delivered apitem on some tick, and the vanilla room holds none',
            Number.isInteger(takenAt) && model.vanilla.apItems.length === 0, JSON.stringify(model.delivered.taken));
        const full = await play(sets.delivered, tape);
        const take = await play(sets.delivered, F.cutTape(tape, takenAt + 1, { hold: true }));
        const before = await play(sets.delivered, F.cutTape(tape, takenAt, { hold: true }));
        const van = await play(sets.vanilla, tape);
        const dFull = drift(model.delivered.rows, full.ticks);
        const dVan = drift(model.vanilla.rows, van.ticks);
        Object.assign(oracle, {
            delivered: { mounted: full.mounted, observations: full.ticks.length, cleared: full.clears.includes(slot),
                end: full.ticks.at(-1) ?? null, hits: full.hits, positions: { compared: dFull.compared, worst: dFull.worst } },
            take: { ticks: takenAt + 1, cleared: take.clears.includes(slot) },
            before: { ticks: takenAt, cleared: before.clears.includes(slot) },
            takenAtGame: take.ticks[takenAt] ?? null,
            vanilla: { mounted: van.mounted, observations: van.ticks.length, cleared: van.clears.includes(slot),
                end: van.ticks.at(-1) ?? null, positions: { compared: dVan.compared, worst: dVan.worst } },
        });
        console.log(`ROW ${JSON.stringify({ ...oracle, firstDrift: { delivered: dFull.first, vanilla: dVan.first } })}`);
        check('DELIVERED: the game ran the whole tape on the delivered set', full.mounted === sets.delivered.set_id
            && full.ticks.length === tape.tick_count + 1, `${full.ticks.length} obs, ${full.mounted}`);
        check(`DELIVERED: the apitem is taken ({${slot}} cleared) and the tape ends in L22`,
            oracle.delivered.cleared && oracle.delivered.end?.level === 22, JSON.stringify(oracle.delivered));
        check('DELIVERED: the model replays the game at 0 px', dFull.worst === 0, JSON.stringify(dFull));
        check(`TAKE: ${takenAt + 1} ticks clear {${slot}}`, oracle.take.cleared, JSON.stringify(oracle.take));
        check(`BEFORE: ${takenAt} ticks do NOT`, !oracle.before.cleared, JSON.stringify(oracle.before));
        check('VANILLA (control): the Chest stays Solid — {25,0} set — and the model\'s bottom-line room is the game\'s at 0 px',
            van.mounted === sets.vanilla.set_id && !oracle.vanilla.cleared && dVan.worst === 0, JSON.stringify({ ...oracle.vanilla, first: dVan.first }));
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    if (RECORD && !failed) {
        const out = join(REPO, F.L25_ORACLE);
        writeFileSync(out, `${JSON.stringify(oracle, null, 2)}\n`);
        console.log(`RECORDED: ${out}`);
    }
    console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
    process.exit(failed ? 1 : 0);
}
