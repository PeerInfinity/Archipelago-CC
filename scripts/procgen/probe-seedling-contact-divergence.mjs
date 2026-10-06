#!/usr/bin/env node
/**
 * Measure-only (slice `seedling-fidelity-terrain` D1, planner `seedling-fidelity-planning-3`) — THE HELD
 * PER-TICK COMPARE behind the divergence sweep's "terrain" rows: each leg of `--legs=<jsonl>`
 * (`seedling-divergence-legs.mjs`) is served by the PRODUCTION wasm playback engine on the live
 * `seedling_playthrough` page (default build p4f, headless logic-only, under the box lock) exactly as
 * `probe-seedling-divergence-sweep.mjs` serves it, while `seedlingContactLab.js` samples the GAME's player and
 * bodies every tick (`botMobiles` + `botStatus`, first sample per game tick) and replays the MODEL's run for the
 * settled plan. One jsonl row per leg: for each play that left its plan, the first tick and field where the game's
 * player (x, y, vx, vy, hits, hits_timer) differs from the model's, and both sides' bodies around it.
 * It changes nothing tracked.
 *
 *   --legs=<jsonl>       the leg list (required)
 *   --ids=a,b            only these leg ids (the inventory of each leg's sphere is granted, in sphere order)
 *   --page=<build>       drive another staged build (also SEEDLING_PAGE)
 *   --out=<jsonl>        append rows here
 *   --around=N           body rows kept on each side of the divergence tick (default 6)
 *   --capture=<dir>      also write <dir>/<leg id>.json per leg: the first diverged play's solve request (the
 *                        staging, Maps/Sets tagged), the room records, the plan, and EVERY sampled game tick —
 *                        the game witness `replay-seedling-contact-capture.mjs` reproduces in node
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build.
 *
 * Run: node scripts/procgen/probe-seedling-contact-divergence.mjs --legs=<jsonl> --ids=… [--host=…] [--page=<build>] [--out=…] [--around=N] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLASH_PANEL, clickPanelTab, createRoomPlay } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/**
 * The legs as pages, the sweep's `inv` order (`probe-seedling-divergence-sweep.mjs`'s `orderLegs`, restated so this
 * file does not import that one's argument parsing): the exits in sphere order on one page, then one page per round
 * of location arrivals (a location opened once stays open for the session).
 */
export function contactPages(legs) {
    const sIdx = (l) => (l.sphere?.index ?? Infinity);
    const bySphere = (a, b) => sIdx(a) - sIdx(b) || a.id - b.id;
    const exits = legs.filter((l) => l.goal.kind === 'exit').sort(bySphere);
    const rounds = [];
    const seen = new Map();
    for (const l of legs.filter((x) => x.goal.kind === 'location').sort(bySphere)) {
        const k = seen.get(l.goal.name) ?? 0;
        seen.set(l.goal.name, k + 1);
        (rounds[k] ??= []).push(l);
    }
    return [...(exits.length ? [exits] : []), ...rounds];
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
    takeBoxLockOrExit({ name: 'probe-seedling-contact-divergence.mjs', kind: 'browser' });
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const OUT = arg('out', '');
    const AROUND = Number(arg('around', '6'));
    const CAPTURE = arg('capture', '');
    const IDS = arg('ids', '').split(',').filter(Boolean).map(Number);
    const GAME = 'seedling_playthrough';
    const PRESET = JSON.parse(readFileSync(join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const BUILD = arg('page', '') || process.env.SEEDLING_PAGE || '';
    const WASM_PAGE = BUILD ? `${BUILD}/game.html` : (PRESET.flash_panel?.wasm ?? '');
    if (!WASM_PAGE || !existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const all = readFileSync(arg('legs', ''), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const pick = IDS.length ? all.filter((l) => IDS.includes(l.id)) : all;
    const pages = contactPages(pick);
    console.log(`INFO: ${pick.length} legs in ${pages.length} page(s)`);
    for (const [pi, legs] of pages.entries()) {
        // eslint-disable-next-line no-await-in-loop
        const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
        // eslint-disable-next-line no-await-in-loop
        try { await runPage(browser, legs, pi + 1); } finally { await browser.close(); }
    }
    console.log('INFO: done');
    process.exit(0);

    async function runPage(browser, legs, pageNo) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `contact-${pageNo}` });
        if (BUILD && WASM_PAGE !== PRESET.flash_panel?.wasm) {
            await page.route(`**/presets/${GAME}/AP_1/AP_1_rules.json`, async (route) => {
                const r = await route.fetch();
                let doc = null;
                try { doc = r.ok() ? JSON.parse(await r.text()) : null; } catch { doc = null; }
                if (!doc) { await route.fulfill({ response: r }); return; }
                doc.flash_panel = { ...(doc.flash_panel ?? {}), wasm: WASM_PAGE };
                await route.fulfill({ response: r, json: doc });
            });
        }
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
        await rp.waitFor('the AP load finished', () => page.evaluate(async () => {
            const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
            const s = p?.seedlingPlaybackSurface?.();
            return !!(p?._apLoadResult && s?.atlas && s?.wasm?.deliveredSet);
        }), 120000);
        await page.waitForTimeout(1500);
        await page.evaluate(async () => {
            const { createContactLab } = await import('/scripts/procgen/seedlingContactLab.js');
            window.__contact = await createContactLab();
        });
        const granted = [];
        for (const leg of legs) {
            const row = { id: leg.id, level: leg.level, arrive: [leg.arrive.x, leg.arrive.y], goal: leg.goal.name,
                sphere: leg.sphere?.label ?? null, page: WASM_PAGE };
            try {
                const left = new Map();
                for (const h of granted) left.set(h, (left.get(h) ?? 0) + 1);
                const need = [];
                for (const w of leg.sphere?.inventory ?? []) {
                    const k = left.get(w) ?? 0;
                    if (k > 0) left.set(w, k - 1); else need.push(w);
                }
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
                // eslint-disable-next-line no-await-in-loop
                row.landed = await rp.jumpSettled(leg.level, leg.arrive.x, leg.arrive.y);
                // eslint-disable-next-line no-await-in-loop
                const r = await page.evaluate((a) => window.__contact.contactCompare(a).then((x) => JSON.parse(JSON.stringify(x))),
                    { leg, budgetMs: 90000, around: AROUND, capture: !!CAPTURE });
                const cap = r.contact?.find((c) => c.capture)?.capture ?? null;
                if (CAPTURE && cap) {
                    mkdirSync(CAPTURE, { recursive: true });
                    writeFileSync(join(CAPTURE, `${leg.id}.json`), JSON.stringify({ leg, page: WASM_PAGE, ...cap }));
                }
                for (const c of r.contact ?? []) delete c.capture;
                Object.assign(row, { end: r.end, failed: r.failed ? String(r.failed).slice(0, 300) : null,
                    plans: r.plans, contact: r.contact, gamePlaysSampled: r.gamePlaysSampled });
            } catch (e) {
                row.end = 'probe-error';
                row.error = e.message.split('\n')[0].slice(0, 400);
            }
            const line = JSON.stringify(row);
            console.log(`ROW ${line.slice(0, 400)}`);
            if (OUT) appendFileSync(OUT, `${line}\n`);
        }
        await page.close();
    }
}
