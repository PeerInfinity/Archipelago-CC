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
 *   --page-legs=N        a fresh page every N legs (default 60; the row records the page's leg index). ⛔ 1 = one
 *                        clean game per leg, the start ASSERTED empty (CI's default: the game's items are session-wide)
 *   --ids=a,b            only these leg ids (this list's positions)
 *   --keys=k1|k2         only these leg KEYS (`seedling-divergence-legs.legKey`: (region, arrival door, goal) — stable
 *                        across SHAs, where an id shifts)
 *
 * A leg the list marks `stagedEvents` (an arrival whose every door needs a `game_state` event: unstaged, the jump
 * lands inside the unbroken obstacle) has each flag written into the GAME's persistence table before its jump, by the
 * game's own setter (`Game.setPersistence(tag, false, level)`, a bridge `method_call`, the channel key delivery
 * uses), and read back from `botStatus.persistence_cleared` (a flag that never lands = `end: 'stage-failed'`, by
 * name). The jump's `new Game` then builds the room from that table, and the engine declares it as the live table.
 * ⚖ A TEST-HARNESS STAGING CHOICE ONLY — a player using that arrival broke the obstacle earlier in the run; the
 * runtime's "flags flow game → AP only" is unchanged and production never stages a flag the game did not set.
 * A staged flag outlives its leg, so every staging leg gets its OWN fresh page (`orderLegs`), whatever --page-legs.
 *   --no-stage-events    the MUTANT / control: stage nothing (the legs land inside their obstacles)
 * A leg the list marks `skip` (a gate that maps to no flag, or a goal that IS its gating event) is emitted as
 * `end: 'skipped'` with its reason, and never run.
 *   --shard=i/n          only shard i of n (`partitionLegs`: price-balanced, longest first — CI's matrix)
 *   --shard-plan=n [--json]  print the partition (no browser, no box) — the CI plan job
 *   --page=<build>       drive another staged build (also SEEDLING_PAGE), e.g. seedling_bot_ap_p4f
 *   --out=<jsonl>        append rows here (default stdout only)
 *   --producer=walker    §3: the same engine built with the walker INSTRUMENT (`producer: 'walker'`): the J2 WALKER's tape, shipped to the game
 *   --dump=<json>        write the page's delivered set + name map (the node bare pass stages from it)
 *
 * Location legs: a location opened once stays open for the session, so a page takes at most ONE arrival per
 * location; the k-th arrivals of every location share the k-th location page.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build.
 *
 * Run: node scripts/procgen/probe-seedling-divergence-sweep.mjs --legs=<jsonl> [--mode=bare|inv] [--shard=i/n|--shard-plan=n [--json]] [--page=<build>] [--producer=solver|walker] [--host=…] [--from=N] [--limit=N] [--page-legs=N] [--ids=…|--keys=…] [--no-stage-events] [--out=…] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLASH_PANEL, clickPanelTab, createRoomPlay, slotBlockOf, withSlotBlock } from './seedlingRoomPlay.js';
import { legSelectors, pickLegs } from './seedling-divergence-legs.mjs';

argvHelp(import.meta.url);

/**
 * The mode's leg order, cut into PAGES (each a fresh page). Exported for a reader of the rows. A leg that STAGES
 * event flags (`stagedEvents`) is a page of its own, after the rest: its flags outlive it in the game.
 */
export function orderLegs(legs, mode, pageLegs) {
    const staging = legs.filter((l) => l.stagedEvents?.length);
    const rest = legs.filter((l) => !l.stagedEvents?.length);
    const sIdx0 = (l) => (l.sphere?.index ?? Infinity);
    const own = (mode === 'inv' ? [...staging].sort((a, b) => sIdx0(a) - sIdx0(b) || a.id - b.id) : staging).map((l) => [l]);
    return [...orderUnstaged(rest, mode, pageLegs), ...own];
}

function orderUnstaged(legs, mode, pageLegs) {
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
    // ⛔ a round is cut by `pageLegs` too: CI run 37387769158 put each round on ONE page whatever --page-legs said,
    // and the clean-start assertion failed 50 location legs BY NAME (an earlier location's pickup, held)
    for (const r of rounds) for (let i = 0; i < r.length; i += pageLegs) pages.push(r.slice(i, i + pageLegs));
    return pages;
}

/**
 * A leg's EXPECTED price in seconds (the shard balance, not a measurement): a page boot is shared, so a leg pays
 * its jump + solve + play. Measured on the box (chunk 0, load ~18): refusals 5–8 s, crossings 4–29 s, a location
 * 17 s; play time grows with the room. So: 10 s, +10 s for a location (a check ceremony), + the room's tile area /
 * 60 (the walk). Exported for the plan job and its reader.
 */
export function legPrice(leg, areaOf) {
    return 10 + (leg.goal.kind === 'location' ? 10 : 0) + Math.round((areaOf(leg.level) ?? 300) / 60);
}

/** Longest-processing-time-first into exactly `n` shards (deterministic: price desc, then id). */
export function partitionLegs(legs, n, areaOf) {
    const shards = Array.from({ length: n }, (_, i) => ({ shard: i + 1, price: 0, ids: [] }));
    const priced = legs.map((l) => ({ id: l.id, p: legPrice(l, areaOf) })).sort((a, b) => b.p - a.p || a.id - b.id);
    for (const { id, p } of priced) {
        const s = shards.reduce((m, x) => (x.price < m.price ? x : m), shards[0]);
        s.ids.push(id);
        s.price += p;
    }
    for (const s of shards) s.ids.sort((a, b) => a - b);
    return shards;
}

/** The map's room areas, in tiles. */
export function roomAreas(repo) {
    const map = JSON.parse(readFileSync(join(repo, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
    // ⛓ the map's `width`/`height` are in TILES already (L5: 7 × 8)
    const areas = new Map((map.levels ?? []).map((l) => [l.level, (l.width ?? 20) * (l.height ?? 15)]));
    return (level) => areas.get(level);
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
    const PLAN = arg('shard-plan', '');
    if (PLAN) {
        // the plan job: no browser, no box — the partition and the leg count, for the matrix and the merge
        const legs0 = readFileSync(arg('legs', ''), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
        const shards = partitionLegs(legs0, Number(PLAN), roomAreas(REPO));
        // ⛓ a page boot is paid once per `--page-legs` legs (CI measured 18–21 s; priced 30 s)
        const perPage = Number(arg('page-legs', '60'));
        const staging = new Set(legs0.filter((l) => l.stagedEvents?.length).map((l) => l.id));
        for (const x of shards) {
            const own = x.ids.filter((id) => staging.has(id)).length;
            x.price += (Math.ceil((x.ids.length - own) / perPage) + own) * 30;
        }
        const maxPrice = Math.max(...shards.map((x) => x.price));
        if (process.argv.includes('--json')) {
            console.log(JSON.stringify({ legs: legs0.length, matrix: shards.map((x) => x.shard),
                // ⛓ the shard timeout: the priciest shard's estimate ×4 (a 2-CPU runner vs the estimate's box)
                // + the page boots and the setup (20 min)
                timeoutMinutes: Math.ceil((maxPrice * 4) / 60) + 20, shards }));
        } else {
            console.log(`SHARD PLAN: ${legs0.length} legs into ${shards.length} shards (price = legPrice, seconds)`);
            for (const x of shards) console.log(`  shard ${x.shard}: ${x.ids.length} legs, ~${Math.round(x.price / 60)} min`);
        }
        process.exit(0);
    }
    takeBoxLockOrExit({ name: 'probe-seedling-divergence-sweep.mjs', kind: 'browser' });
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const MODE = arg('mode', 'bare');
    const OUT = arg('out', '');
    const FROM = Number(arg('from', '0'));
    const LIMIT = Number(arg('limit', '100000'));
    const PAGE_LEGS = Number(arg('page-legs', '60'));
    const DUMP = arg('dump', '');
    const PRODUCER = arg('producer', 'solver');
    const STAGE_EVENTS = !process.argv.includes('--no-stage-events');
    const SHARD = arg('shard', '');
    const GAME = 'seedling_playthrough';
    const RULES = `frontend/presets/${GAME}/AP_1/AP_1_rules.json`;
    const PRESET = JSON.parse(readFileSync(join(REPO, RULES), 'utf8'));
    // ⛓ --page=<build> (e.g. seedling_bot_ap_p4f) drives another staged build: the rules the page fetches name it
    const BUILD = arg('page', '') || process.env.SEEDLING_PAGE || '';
    const WASM_PAGE = BUILD ? `${BUILD}/game.html` : (slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '');
    if (!WASM_PAGE || !existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const all = readFileSync(arg('legs', ''), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    let pick = pickLegs(all, legSelectors(arg));
    if (SHARD) {
        const [i, n] = SHARD.split('/').map(Number);
        const mine = new Set(partitionLegs(pick, n, roomAreas(REPO))[i - 1].ids);
        pick = pick.filter((l) => mine.has(l.id));
        console.log(`SHARD ${SHARD}: ${pick.length} legs`);
    }
    const pages = orderLegs(pick, MODE, PAGE_LEGS);
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
        // ⛓ only a build OTHER than the preset's is routed. ⛔ And a response that is not the rules JSON passes
        // through untouched: the glob also matches a fetch the server answers with an HTML 404, and `r.json()` on it
        // threw out of the handler and killed every shard of CI run 37376313790 in 0.5 s.
        if (BUILD && WASM_PAGE !== slotBlockOf(PRESET, 'flash_panel')?.wasm) {
            await page.route(`**/presets/${GAME}/AP_1/AP_1_rules.json`, async (route) => {
                const r = await route.fetch();
                let doc = null;
                try { doc = r.ok() ? JSON.parse(await r.text()) : null; } catch { doc = null; }
                if (!doc) { await route.fulfill({ response: r }); return; }
                await route.fulfill({ response: r, json: withSlotBlock(doc, 'flash_panel', { wasm: WASM_PAGE }) });
            });
        }
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
            const row = { id: leg.id, key: leg.key ?? null, mode: MODE, producer: PRODUCER, page: pageNo, pageLeg: i, level: leg.level,
                arrive: [leg.arrive.x, leg.arrive.y], goal: leg.goal.name, kind: leg.goal.kind, sphere: leg.sphere?.label ?? null };
            // ⛔ an arrival needing a game_state event the jump would not stage: named, never run
            if (leg.skip) {
                emit({ ...row, end: 'skipped', skip: leg.skip, events: leg.arrive.events ?? [] });
                continue;
            }
            try {
                // ⛔ THE CLEAN START (planner-3's trace, 2026-10-05): the game's `Inventory.items` is STATIC and
                // append-only for the session — an item an earlier leg PICKED UP stays in the game for every later leg
                // on the page (legs 174/184 held the sword with a granted set of []). So the game's held items are read
                // BEFORE the grants; on a fresh page (`--page-legs=1`, CI's default) they must be empty, else the leg
                // fails BY NAME (`dirty-start`) and runs nothing.
                // eslint-disable-next-line no-await-in-loop
                const before = await page.evaluate(() => window.__div.heldItems());
                row.before = before;
                if (PAGE_LEGS === 1 && (before.slots.length || before.has.length)) {
                    row.end = 'dirty-start';
                    row.error = `the game already holds ${JSON.stringify(before)} before this leg's grants — not a clean start`;
                    throw Object.assign(new Error(row.error), { byName: true });
                }
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
                    // what the game holds after the grants (the slot ORDER is the game's own: acquisition order)
                    // eslint-disable-next-line no-await-in-loop
                    row.after = await page.evaluate(() => window.__div.heldItems());
                }
                // ⚖ TEST-HARNESS STAGING ONLY: the arrival's gating flags, written by the game's own setter (see the head)
                if (leg.stagedEvents?.length) {
                    row.stagedEvents = leg.stagedEvents;
                    if (!STAGE_EVENTS) row.stagingDropped = true;
                    else {
                        // eslint-disable-next-line no-await-in-loop
                        row.staged = await stageEvents(leg.stagedEvents);
                        if (row.staged.missing.length) {
                            row.end = 'stage-failed';
                            row.error = `the game's persistence table never held ${JSON.stringify(row.staged.missing)} after Game.setPersistence`;
                            throw Object.assign(new Error(row.error), { byName: true });
                        }
                    }
                }
                // eslint-disable-next-line no-await-in-loop
                const landed = await rp.jumpSettled(leg.level, leg.arrive.x, leg.arrive.y);
                if (leg.stagedEvents?.length) {
                    // eslint-disable-next-line no-await-in-loop
                    row.stagedAfterJump = heldFlags(leg.stagedEvents, (await page.evaluate(() => window.__div.status()))?.persistence_cleared);
                }
                swaps += landed.jumps;
                row.landed = landed;
                // eslint-disable-next-line no-await-in-loop
                const r = await page.evaluate((a) => window.__div.serveLeg(a).then((x) => JSON.parse(JSON.stringify(x))),
                    { leg, budgetMs: 90000, producer: PRODUCER });
                Object.assign(row, r);
                swaps += (r.history ?? []).length;
            } catch (e) {
                if (e.byName) { emit(row); continue; }
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

        /** Write each flag through the game's own `Game.setPersistence(tag, false, level)`; poll the table for them. */
        async function stageEvents(flags) {
            await rp.gameFrame().evaluate((fs) => {
                window.__swfBridge.queueItems(fs.map((f) => ({ invocation: 'method_call', path: [{ class: 'Game' }],
                    method: 'setPersistence', args: [f.tag, false, f.level] })));
            }, flags.map(({ level, tag }) => ({ level, tag })));
            let got = null;
            for (const t0 = Date.now(); Date.now() - t0 < 10000;) {
                // eslint-disable-next-line no-await-in-loop
                got = heldFlags(flags, (await page.evaluate(() => window.__div.status()))?.persistence_cleared);
                if (!got.missing.length) break;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(100);
            }
            return got;
        }
    }
}

/** Which of `flags` (`{level, tag}`) the game's `persistence_cleared` holds. */
export function heldFlags(flags, cleared) {
    const has = (f) => (cleared ?? []).some((c) => Number(c.level) === f.level && Number(c.tag) === f.tag);
    return { held: flags.filter(has).map((f) => f.eventId), missing: flags.filter((f) => !has(f)).map((f) => f.eventId) };
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
