#!/usr/bin/env node
/**
 * Measure-only (the divergence sweep, planner `seedling-js-planning-2`) — THE LIVE WASM DIVERGENCE SWEEP: every
 * leg of `--legs=<jsonl>` (`seedling-divergence-legs.mjs`) served by the PRODUCTION wasm playback engine on the
 * live `seedling_playthrough` page (default build p4f, headless logic-only, under the box lock), one jsonl row per
 * leg. It changes nothing tracked. The in-page half is `seedlingDivergenceLab.js` (imported by URL).
 *
 * Per leg: (inventory mode) the items the AP route holds at the leg's sphere are granted through the AP path
 * (`stateManagerProxy.addItemToInventory`, in collection order — the game appends slots in acquisition order),
 * each waited into the game; a host jump to the leg's resolved arrival (`seedlingRoomPlay.jumpSettled`: a jump
 * the region binding re-places is re-jumped INSIDE the room); then `engine.walkTo(goal)` — forced re-arrival →
 * freeze → worker solve → one tape → watch → (W3) recovery / exact-repeat failure — until done / crossed /
 * failed / the leg budget. The row carries the engine's history, every plan's verdict, the shipped tapes, and
 * for each play that left its plan the model and game rows around the tick and the first differing field.
 *
 *   --mode=bare|inv      bare: no grants (exits first, the location legs last); inv: legs in sphere order, grants
 *   --from=N --limit=N   a window of the (mode-ordered) list — yield the box in chunks
 *   --page-legs=N        a fresh page every N legs (default 60; the row records the page's leg index)
 *   --ids=a,b            only these leg ids
 *   --out=<jsonl>        append rows here (default stdout only)
 *   --producer=walker    §3: the same engine built the WG way (`generated: true`): the J2 WALKER's tape, shipped to the game
 *   --dump=<json>        write the page's delivered set + name map (the node bare pass stages from it)
 *
 * Location legs: a location opened once stays open for the session, so a page takes at most ONE arrival per
 * location; the k-th arrivals of every location share the k-th location page.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build.
 *
 * Run: node scripts/procgen/probe-seedling-divergence-sweep.mjs --legs=<jsonl> [--mode=bare|inv] [--host=…] [--from=N] [--limit=N] [--page-legs=N] [--ids=…] [--out=…] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLASH_PANEL, clickPanelTab, createRoomPlay } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/** The mode's leg order, cut into PAGES (each a fresh page). Exported for a reader of the rows. */
export function orderLegs(legs, mode, pageLegs) {
    const exits = legs.filter((l) => l.goal.kind === 'exit');
    const locs = legs.filter((l) => l.goal.kind === 'location');
    const sIdx = (l) => (l.sphere?.index ?? Infinity);
    const bySphere = (a, b) => sIdx(a) - sIdx(b) || a.id - b.id;
    const pages = [];
    const ex = mode === 'inv' ? [...exits].sort(bySphere) : exits;
    for (let i = 0; i < ex.length; i += pageLegs) pages.push(ex.slice(i, i + pageLegs));
    // location rounds: the k-th arrival of each location
    const rounds = [];
    const seen = new Map();
    for (const l of (mode === 'inv' ? [...locs].sort(bySphere) : locs)) {
        const k = seen.get(l.goal.name) ?? 0;
        seen.set(l.goal.name, k + 1);
        (rounds[k] ??= []).push(l);
    }
    for (const r of rounds) pages.push(r);
    return pages;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-divergence-sweep.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const MODE = arg('mode', 'bare');
    const OUT = arg('out', '');
    const FROM = Number(arg('from', '0'));
    const LIMIT = Number(arg('limit', '100000'));
    const PAGE_LEGS = Number(arg('page-legs', '60'));
    const DUMP = arg('dump', '');
    const PRODUCER = arg('producer', 'solver');
    const IDS = arg('ids', '').split(',').filter(Boolean).map(Number);
    const GAME = 'seedling_playthrough';
    const PRESET = JSON.parse(readFileSync(join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const WASM_PAGE = PRESET.flash_panel?.wasm ?? '';
    if (!WASM_PAGE || !existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const all = readFileSync(arg('legs', ''), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const pages = orderLegs(IDS.length ? all.filter((l) => IDS.includes(l.id)) : all, MODE, PAGE_LEGS);
    // the window, over the flattened order (pages kept)
    let n = 0;
    const windowed = pages.map((p) => p.filter(() => { const keep = n >= FROM && n < FROM + LIMIT; n += 1; return keep; })).filter((p) => p.length);
    console.log(`INFO: mode ${MODE}: ${windowed.reduce((a, p) => a + p.length, 0)} legs in ${windowed.length} page(s) (of ${all.length} legs)`);
    // ⛔ a FRESH BROWSER per page: a second page in the same browser never reached 'ready' (measured, the trial)
    let browser = null;
    const emit = (row) => {
        const line = JSON.stringify(row);
        console.log(`ROW ${line.length > 600 ? `${line.slice(0, 600)}…` : line}`);
        if (OUT) appendFileSync(OUT, `${line}\n`);
    };
    let pageNo = 0;
    for (const legs of windowed) {
        pageNo += 1;
        // eslint-disable-next-line no-await-in-loop
        browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
        // eslint-disable-next-line no-await-in-loop
        await runPage(legs, pageNo);
        // eslint-disable-next-line no-await-in-loop
        await browser.close();
    }
    console.log('INFO: sweep done');
    process.exit(0);

    async function runPage(legs, pageNo) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `div-${MODE}-${pageNo}` });
        const tb = Date.now();
        let booted = false;
        let bootErr = null;
        for (let attempt = 1; attempt <= 2 && !booted; attempt++) try {
            if (attempt > 1) await page.goto('about:blank');
            await page.goto(`${HOST}/frontend/?rules=./presets/${GAME}/AP_1/AP_1_rules.json`, { waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            await rp.waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)), 180000);
            await rp.waitFor('start button enabled', () => rp.gameFrame().evaluate(() => {
                const b = document.getElementById('btn-start');
                return !!b && !b.disabled;
            }), 180000);
            await rp.gameFrame().click('#btn-start', { timeout: 120000 });
            await assertLogicOnlyChannel(rp.gameFrame());
            await rp.waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
                document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);
            await rp.waitFor('the AP load finished (the delivered set + the name map)', () => page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                const s = p?.seedlingPlaybackSurface?.();
                return !!(p?._apLoadResult && s?.atlas && s?.wasm?.deliveredSet);
            }), 120000);
            await page.waitForTimeout(1500);
            await page.evaluate(async () => {
                const { createLab } = await import('/scripts/procgen/seedlingDivergenceLab.js');
                window.__div = await createLab();
            });
            booted = true;
        } catch (e) {
            bootErr = e;
            console.log(`FAIL: page ${pageNo} boot (attempt ${attempt}): ${e.message.split('\n')[0]}`);
            console.log(logs.filter((l) => !/initialState|testLogic|Test discovery/.test(l)).slice(-8).join('\n'));
        }
        if (!booted) {
            for (const leg of legs) emit({ id: leg.id, mode: MODE, page: pageNo, end: 'page-boot-failed', error: String(bootErr?.message).slice(0, 300) });
            await page.close();
            return;
        }
        if (DUMP && pageNo === 1) {
            // the rooms the game PLAYS (the vanilla arm's delivered set) + the name → cell map, for the node bare pass
            const d = await page.evaluate(() => {
                const s = window.__div.surface();
                return JSON.stringify({ deliveredSet: s.wasm.deliveredSet, entries: s.atlas.entries, refused: s.atlas.refused });
            });
            writeFileSync(DUMP, d);
            console.log(`INFO: dumped the delivered set + the name map → ${DUMP}`);
        }
        const peek = await page.evaluate(() => JSON.parse(JSON.stringify(window.__div.peek())));
        console.log(`INFO: page ${pageNo} booted in ${Math.round((Date.now() - tb) / 1000)} s; botStatus fields: ${Object.keys(peek.status ?? {}).join(',')}`);
        const granted = [];
        let swaps = 0;
        for (const [i, leg] of legs.entries()) {
            const row = { id: leg.id, mode: MODE, producer: PRODUCER, page: pageNo, pageLeg: i, level: leg.level, arrive: [leg.arrive.x, leg.arrive.y],
                goal: leg.goal.name, kind: leg.goal.kind, sphere: leg.sphere?.label ?? null };
            try {
                if (MODE === 'inv') {
                    const want = leg.sphere?.inventory ?? null;
                    const need = want ? multisetMinus(want, granted) : [];
                    for (const item of need) {
                        // eslint-disable-next-line no-await-in-loop
                        await page.evaluate(async (name) => {
                            const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
                            await proxy.addItemToInventory(name);
                        }, item);
                        granted.push(item);
                        // eslint-disable-next-line no-await-in-loop
                        await page.waitForTimeout(400);
                    }
                    row.granted = need;
                    row.holding = granted.length;
                }
                // eslint-disable-next-line no-await-in-loop
                const landed = await rp.jumpSettled(leg.level, leg.arrive.x, leg.arrive.y);
                swaps += landed.jumps;
                row.landed = landed;
                // eslint-disable-next-line no-await-in-loop
                const r = await page.evaluate((a) => window.__div.serveLeg(a).then((x) => JSON.parse(JSON.stringify(x))),
                    { leg, budgetMs: 90000, producer: PRODUCER });
                Object.assign(row, r);
                swaps += (r.history ?? []).length;
            } catch (e) {
                row.end = 'probe-error';
                row.error = e.message.split('\n')[0].slice(0, 400);
                row.consoleTail = logs.slice(-12);
            }
            const exits = logs.filter((l) => /heap_alloc|ExitStatus|out of memory/.test(l));
            if (exits.length) row.gameMemory = exits.slice(-3);
            row.swapsOnPage = swaps;
            emit(row);
            if (row.gameMemory) { console.log('INFO: the game ran out of memory — a fresh page for the rest'); break; }
        }
        console.log(`INFO: page ${pageNo}: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s), ~${swaps} swaps`);
        await page.close();
    }
}

function multisetMinus(want, have) {
    const left = new Map();
    for (const h of have) left.set(h, (left.get(h) ?? 0) + 1);
    const out = [];
    for (const w of want) {
        const k = left.get(w) ?? 0;
        if (k > 0) left.set(w, k - 1); else out.push(w);
    }
    return out;
}
