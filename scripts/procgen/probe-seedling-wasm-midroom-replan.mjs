#!/usr/bin/env node
/**
 * Seedling solver-walk — MID-ROOM REPLAN on an item delivery. ⚖ The user (2026-10-03): items can arrive
 * mid-room, from OTHER players too; the solver replans IN the room, never by leaving and re-entering it. The
 * wasm engine's DELIVERY GATE holds an item that arrives while the bot drives, freezes the room
 * (`botHold("on")`), writes the item, re-stages the room's arrival with it and replans the goal as a
 * continuation from the frozen tick. Default build p4f, headless logic-only, under the box lock; every session
 * on a FRESH page.
 *
 *   M  MEASURE (`wasmMidRoomLab.js`, imported by URL; `seedling_atlas_location`, host jumps): a plan frozen at
 *      an ARBITRARY tick is the shadow TO THE BIT (position, velocity, facing, chasers) and does not move;
 *      `botHold("off")` resumes it on plan; an AP item written while frozen lands and `botStatus` shows it,
 *      the game still frozen; the prefix replays to the same model run with the item staged at the arrival;
 *      a continuation shipped from the frozen tape behind a LEAD tick (the keys the frozen tape held) plays
 *      on plan — including the seam that a keydown+keyup release broke (L4 `down`) and an X press held.
 *   D  THE WITNESS (`seedling_playthrough` by `?rules=`, the Playback Bot on the derived sphere log): while a
 *      solver plan PLAYS mid-room, an item arrives the way a remote player's does — a `ReceivedItems` packet
 *      from player 2 on the client's `connection:message` (the AP layer's receive path, not a page poke; the
 *      game's DataPackage is sent first, as a server does at connect, so the client can name the item). The
 *      room freezes, the item lands, the goal is replanned (or the interrupted plan resumes, by name), and the
 *      goal finishes in that room with no forced re-arrival and 0 divergences. Freeze and replan times are
 *      measured (`ROW D delivery`).
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/probe-seedling-wasm-midroom-replan.mjs [--host=http://localhost:8000] [--only=M,D]
 *      [--item="Progressive Shield"] [--budget-s=420] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLASH_PANEL, clickPanelTab, createRoomPlay } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/** The witness preset, by its rules file (served path relative to `frontend/`): its item table names every game item. */
export const RULES_PATH = './presets/seedling_playthrough/AP_1/AP_1_rules.json';

const L6 = { level: 6, x: 32, y: 16, goal: { kind: 'exit', level: 6, tiles: [[14, 2]], name: 'out_stairsup_224_32' } };
const L4 = { level: 4, x: 16, y: 16, goal: { kind: 'exit', level: 4, tiles: [[4, 1]], name: 'out_stairsdown_64_16' } };
const L86 = { level: 86, x: 48, y: 48, goal: { kind: 'location', level: 86, tag: 0, entityType: 'chest', name: 'chest' } };
/**
 * Session M's rows, in order, on ONE page. ⚠ The items ACCUMULATE (each arrival reads the game as it stands), and
 * an item changes the plans after it: with the sword in hand L4's plan is a shorter shove whose RE-SOLVE hits
 * the known L4 residue (`seedling-wasm-solver-plan` §1.3 class, measured: t 12, no key held at the freeze), and
 * with the kit the house chest opens before tick 30 (a freeze after it finds the goal done). So the shield row
 * runs before the sword, and the chest freezes early.
 */
export const M_ROWS = [
    { tag: 'L6 K=37 resume', ...L6, K: 37, mode: 'resume' },
    { tag: 'L6 K=181 resume', ...L6, K: 181, mode: 'resume' },
    { tag: 'L4 K=97 resume', ...L4, K: 97, mode: 'resume' },
    { tag: 'L4 K=23 idle:12 (the seam a key-pair release broke)', ...L4, K: 23, mode: 'idle:12' },
    { tag: 'L4 K=23 + Progressive Shield, replan', ...L4, K: 23, item: 'Progressive Shield', itemProp: 'hasShield', mode: 'replan' },
    { tag: 'L86 K=10 + Light, replan', ...L86, K: 10, item: 'Light', itemProp: 'hasTorch', mode: 'replan' },
    { tag: 'L6 K=113 + Progressive Sword, replan', ...L6, K: 113, item: 'Progressive Sword', itemProp: 'hasSword', mode: 'replan' },
    { tag: 'L6 at an X press + Health, replan', ...L6, K: 'at:primary', item: 'Health', itemProp: 'hitsMax', mode: 'replan' },
];

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-midroom-replan.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const SESSIONS = arg('only', 'M,D').split(',').filter(Boolean);
    const ITEM = arg('item', 'Progressive Shield').replace(/^"|"$/g, '');
    const BUDGET_MS = Number(arg('budget-s', '420')) * 1000;
    const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
    const WASM_PAGE = PRESET.flash_panel?.wasm ?? '';
    if (!WASM_PAGE || !existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    for (const S of SESSIONS) {
        console.log(`INFO: ── session ${S} (a fresh page) ──`);
        // eslint-disable-next-line no-await-in-loop
        failed += await runSession(S);
    }
    await browser.close();
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

    async function runSession(S) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `midroom-${S}` });
        const { check } = rp;
        const out = (tag, o) => console.log(`ROW ${tag} ${JSON.stringify(o)}`);
        const panelLogTail = () => page.evaluate(() => (document.querySelector('.flash-panel-log')?.textContent ?? '')
            .split('\n').slice(-12).join(' | '));
        const engine = () => page.evaluate(async () => {
            const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
            const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
            const e = c?._wasmEngine ?? null;
            return e ? JSON.parse(JSON.stringify({ stats: e.stats, status: e.status(), lastRefusal: c.lastRefusal })) : null;
        });
        const botStatus = () => page.evaluate(async () => {
            const { getActivePanel } = await import('./modules/playbackBot/index.js');
            const bot = getActivePanel()?.getBot?.();
            return { status: bot?.getStatus?.() ?? '', region: bot?.getCurrentRegion?.() ?? null };
        });

        /** M — the measurements (unknowns 1-3), through the committed pieces. */
        async function runMeasure() {
            await page.evaluate(async () => {
                const { createMidRoomLab } = await import('/scripts/procgen/wasmMidRoomLab.js');
                window.__mr = await createMidRoomLab();
            });
            for (const row of M_ROWS) {
                let r;
                try {
                    // eslint-disable-next-line no-await-in-loop
                    r = await page.evaluate((a) => window.__mr.holdAt(a), row);
                } catch (err) {
                    r = { error: `evaluate: ${err.message.split('\n')[0]}` };
                    // eslint-disable-next-line no-await-in-loop
                    await page.evaluate(() => window.__mr.resetClean()).catch(() => null);
                }
                out('M', { tag: row.tag, ...r });
                const t = `M ${row.tag}`;
                if (r.error) { check(`${t}: ran`, false, r.error); continue; }
                check(`${t}: frozen at tick ${r.k} (the drain's own count), the frozen game == the shadow to the bit`,
                    r.frozen.frozen === true && r.k === r.rowsAtFreeze && r.mismatch === null
                        && JSON.stringify(r.velocity.game) === JSON.stringify(r.velocity.shadow) && r.chasers.maxGap < 1e-9,
                    JSON.stringify({ k: r.k, rows: r.rowsAtFreeze, game: r.frozen, shadow: r.shadow, velocity: r.velocity, chasers: r.chasers }));
                check(`${t}: nothing moves while frozen (game_time, tick, position, rows, botMobiles)`,
                    Object.values(r.still).every((v) => v === true), JSON.stringify(r.still));
                if (r.item) {
                    check(`${t}: the AP item lands while frozen and botStatus shows it (still frozen)`,
                        Number.isFinite(r.item.landedMs) && r.item.stillFrozen, JSON.stringify(r.item));
                    check(`${t}: the prefix replays to the same model run with the item staged at the arrival`, r.item.prefixSame === true,
                        JSON.stringify(r.item));
                }
                if (r.resumed) {
                    check(`${t}: botHold("off") resumes the same tape on plan`, r.resumed.div === null, JSON.stringify(r.resumed));
                }
                if (r.replan) {
                    check(`${t}: the continuation from the frozen tape (lead ${JSON.stringify(r.replan.lead)}) plays on plan`,
                        !r.replan.error && !r.replan.refusal && r.replan.div === null
                            && r.replan.end.level === r.replan.expectedEnd.level && r.replan.end.x === r.replan.expectedEnd.x
                            && r.replan.end.y === r.replan.expectedEnd.y, JSON.stringify(r.replan));
                }
            }
        }

        /** Mount the Playback Bot in START with the DERIVED sphere log, and play. */
        async function startBot(start) {
            await page.evaluate(async (rulesPath) => {
                const rules = await (await fetch(rulesPath)).json();
                const { generateSphereLog } = await import('./modules/shared/procgen/forwardSimulator.js');
                const text = generateSphereLog(rules).map((e) => JSON.stringify(e)).join('\n');
                const { getSphereStateSingleton } = await import('./modules/sphereState/singleton.js');
                return getSphereStateSingleton().loadSphereLog('probe-seedling-wasm-midroom-replan:derived', text);
            }, RULES_PATH);
            return page.evaluate(async (s) => {
                const bus = (await import('./app/core/eventBus.js')).default;
                bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'tests');
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                for (let i = 0; i < 50 && !getActivePanel()?.getBot?.(); i++) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => { setTimeout(r, 100); });
                }
                const bot = getActivePanel()?.getBot?.();
                if (!bot) return { ok: false, why: 'no playback bot panel' };
                bot.onRegionMove({ targetRegion: s });
                bot.refresh();
                await bot.play();
                return { ok: true, region: bot.getCurrentRegion() };
            }, start);
        }

        /** The AP layer's receive path: a `ReceivedItems` packet from player 2, as the server relays a remote item. */
        const receive = (name) => page.evaluate(async (itemName) => {
            const proxy = window.stateManagerProxy;
            const items = proxy.getStaticData()?.items;
            const entries = items instanceof Map ? [...items.entries()] : Object.entries(items ?? {});
            const id = entries.find(([k, v]) => (v?.name ?? k) === itemName)?.[1]?.id ?? null;
            if (!Number.isInteger(id)) return { ok: false, why: `no item id for ${itemName}` };
            const { getClientModuleEventBus } = await import('./modules/client/index.js');
            const bus = getClientModuleEventBus?.() ?? (await import('./app/core/eventBus.js')).default;
            const before = proxy.getLatestStateSnapshot?.()?.inventory?.[itemName] ?? 0;
            // A server sends its DataPackage at connect: the id → name tables the client reads a ReceivedItems by.
            // Offline there is none, so the game's own (the loaded rules') is sent first, as that server would.
            const sd = proxy.getStaticData();
            const locs = sd.locationNameToId instanceof Map ? Object.fromEntries(sd.locationNameToId) : (sd.locationNameToId ?? {});
            bus.publish('connection:message', [{ cmd: 'DataPackage', data: { games: { [sd.game_name]: {
                item_name_to_id: Object.fromEntries(entries.map(([k, v]) => [v?.name ?? k, v?.id]).filter(([, i]) => Number.isInteger(i))),
                location_name_to_id: locs } } } }], 'client');
            bus.publish('connection:message', [{ cmd: 'ReceivedItems', index: 1,
                items: [{ item: id, location: 987654321, player: 2, flags: 1 }] }], 'client');
            for (let i = 0; i < 100; i += 1) {
                const now = proxy.getLatestStateSnapshot?.()?.inventory?.[itemName] ?? 0;
                if (now > before) return { ok: true, id, count: now };
                // eslint-disable-next-line no-await-in-loop
                await new Promise((r) => { setTimeout(r, 20); });
            }
            return { ok: false, why: 'the inventory never showed it', id };
        }, name);

        /** D — the witness: an item from another player arrives while a solver plan plays mid-room. */
        async function runDelivery() {
            const start = PRESET.regions['1'].Menu.exits[0].connected_region;
            const booted = await startBot(start);
            check(`D: the bot is mounted in ${start}`, booted.ok && booted.region === start, JSON.stringify(booted));
            await clickPanelTab(page, FLASH_PANEL).catch(() => null);
            const t0 = Date.now();
            let injected = null;
            let last = '';
            // Wait for a solver plan PLAYING mid-room with room to spare, then inject.
            while (Date.now() - t0 < BUDGET_MS && !injected) {
                // eslint-disable-next-line no-await-in-loop
                const e = await engine();
                const st = e?.status;
                const b = await botStatus(); // eslint-disable-line no-await-in-loop
                if (b.status !== last) { console.log(`INFO: D +${((Date.now() - t0) / 1000).toFixed(1)} s bot: ${b.status}`); last = b.status; }
                if (b.status.startsWith('error') || b.status.startsWith('finished')) break;
                if (st?.phase === 'playing' && st.room && st.goal && Number.isInteger(st.ticks) && st.drained >= 10 && st.ticks - st.drained >= 60) {
                    const before = { forcedBy: e.stats.forcedBy, forced: e.stats.forced, divergences: e.stats.divergences, done: e.stats.done,
                        level: st.room.level, goal: st.goal.name ?? st.goal.kind, ticks: st.ticks, drained: st.drained };
                    // eslint-disable-next-line no-await-in-loop
                    const got = await receive(ITEM);
                    injected = { at: Date.now() - t0, before, got };
                    out('D injected', injected);
                    break;
                }
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(100);
            }
            check(`D: "${ITEM}" arrived through the AP receive path (ReceivedItems from player 2) while a plan played mid-room`,
                injected?.got?.ok === true, JSON.stringify(injected));
            if (!injected?.got?.ok) return;
            // Follow the walk until the delivered goal is done and the bot has moved on (or it stops).
            let e = null;
            let row = null;
            let doneAfter = null;
            while (Date.now() - t0 < BUDGET_MS) {
                // eslint-disable-next-line no-await-in-loop
                e = await engine();
                const b = await botStatus(); // eslint-disable-line no-await-in-loop
                if (b.status !== last) { console.log(`INFO: D +${((Date.now() - t0) / 1000).toFixed(1)} s bot: ${b.status}`); last = b.status; }
                row = e?.stats?.deliveries?.[0] ?? null;
                const hist = e?.stats?.history ?? [];
                const cut = hist.findIndex((h) => h.outcome === 'interrupted' || h.outcome === 'resumed');
                doneAfter = cut >= 0 ? hist.slice(cut).find((h) => h.outcome === 'done') ?? null : null;
                if ((doneAfter && e.stats.done >= injected.before.done + 2) || b.status.startsWith('error') || b.status.startsWith('finished')) break;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(250);
            }
            const st = e?.stats ?? {};
            const items = JSON.parse(await rp.gameFrame().evaluate(() => window.__swfBridge.game.botStatus())).items;
            out('D delivery', { row, deferred: st.deliveryDeferred, gateHeld: st.gateHeld, heldChecks: (st.heldChecks ?? []).slice(-3),
                doneAfter: doneAfter && { goal: doneAfter.goal?.name, level: doneAfter.goal?.level, continuation: doneAfter.continuation,
                    prefix: doneAfter.prefix, ticks: doneAfter.ticks, divergence: doneAfter.divergence, end: doneAfter.end },
                forcedBy: st.forcedBy, divergences: st.divergences, fallbacks: st.fallbacks, gameItems: items });
            out('D history', (st.history ?? []).slice(-8).map((h) => ({ goal: h.goal?.name, level: h.goal?.level, outcome: h.outcome,
                kind: h.kind ?? null, continuation: h.continuation ?? null, prefix: h.prefix ?? null, ticks: h.ticks ?? null, drained: h.drained ?? null })));
            check('D: the gate HELD the item until the room froze (one delivery, mid-tape, at a named tick)',
                row?.phase === 'playing' && Number.isInteger(row.tick) && row.tick >= 1 && row.items?.length >= 1, JSON.stringify(row));
            check('D: the item LANDED while the room was frozen, and the game holds it',
                Number.isFinite(row?.landMs) && Object.values(items ?? {}).some(Boolean), JSON.stringify({ landMs: row?.landMs, items }));
            check('D: the goal was REPLANNED in the room (or the interrupted plan resumed, by name) — never re-entered',
                (row?.outcome === 'replanned' || row?.outcome === 'resumed')
                    && !Object.keys(st.forcedBy ?? {}).some((k) => k.startsWith('delivery'))
                    && (st.forced ?? 0) === injected.before.forced, JSON.stringify({ outcome: row?.outcome, forcedBy: st.forcedBy, forced: st.forced }));
            const frozenCheck = (st.heldChecks ?? []).find((h) => h.frozen === true) ?? null;
            check('D: the frozen game == the shadow at the replan (the held check)',
                row?.outcome === 'resumed' || (frozenCheck?.equal === true), JSON.stringify(frozenCheck));
            check('D: the delivered goal finished in its own room, as a continuation from the frozen tick',
                doneAfter?.goal?.level === injected.before.level && (row?.outcome === 'resumed' || (doneAfter.continuation === true && doneAfter.prefix >= row.tick)),
                JSON.stringify(doneAfter && { level: doneAfter.goal?.level, continuation: doneAfter.continuation, prefix: doneAfter.prefix }));
            check('D: 0 divergences', st.divergences === 0, JSON.stringify({ divergences: st.divergences }));
            out('D measured', { freezeMs: row?.freezeMs ?? null, landMs: row?.landMs ?? null, replanMs: row?.replanMs ?? null, ticks: row?.ticks ?? null,
                lead: row?.lead ?? null, tick: row?.tick, of: row?.of });
            check('D: freeze and replan times measured', Number.isFinite(row?.freezeMs) && (row?.outcome === 'resumed' || Number.isFinite(row?.replanMs)),
                JSON.stringify({ freezeMs: row?.freezeMs, replanMs: row?.replanMs }));
            // The bot stops: the gate comes off (deliveries behave as before outside bot driving).
            await page.evaluate(async () => {
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                getActivePanel()?.getBot?.()?.stop?.();
            });
            await page.waitForTimeout(500);
            const after = await engine();
            check('D: stopping the bot removes the gate', after?.status?.gate === null, JSON.stringify(after?.status?.gate));
        }

        try {
            const url = S === 'M' ? `${HOST}/frontend/?game=seedling_atlas_location&seed=1` : `${HOST}/frontend/?rules=${RULES_PATH}`;
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            await rp.installWatchers();
            await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            await rp.waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
            await rp.waitFor('start button enabled', () => rp.gameFrame().evaluate(() => {
                const b = document.getElementById('btn-start');
                return !!b && !b.disabled;
            }));
            await rp.gameFrame().click('#btn-start');
            await assertLogicOnlyChannel(rp.gameFrame());
            await rp.waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
                document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);
            await rp.waitFor('the AP load finished', () => page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                return !!p?._apLoadResult;
            }), 120000);
            await page.waitForTimeout(1500);
            if (S === 'M') await runMeasure();
            if (S === 'D') await runDelivery();
            console.log(`INFO: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s) (the logic-only channel's device loss)`);
            console.log(`INFO: panel log: ${await panelLogTail().catch(() => '?')}`);
        } catch (e) {
            check(`fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
            console.log(`INFO: panel log: ${await panelLogTail().catch(() => '?')}`);
        }
        await page.close();
        return rp.failures();
    }
}
