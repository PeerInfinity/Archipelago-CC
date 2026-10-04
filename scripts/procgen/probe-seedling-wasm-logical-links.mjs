#!/usr/bin/env node
/**
 * Seedling solver-walk §5.17 — LOGICAL SUB-REGION LINKS on the wasm runtime (plan
 * `NewDocs/plans/seedling-js-solver-walk-plan.md`). `seedling_playthrough` loaded by `?rules=`, default build
 * p4e, headless logic-only, under the box lock; every session on a FRESH page.
 *
 *   H  A HUMAN WALK (no bot): keys pressed on the game canvas, the region glue reading the position. From a
 *      tile of `level_0__r8c0` the player walks west through the pond into `level_0__r14c0` and back (the
 *      tiles DERIVED from the committed partition: a row where the two sub-regions face each other across
 *      tiles of neither). First WITHOUT the link's item (`Progressive Swim`): no move, however far the
 *      player gets. Then WITH it: exactly ONE logical `user:regionMove` each way, `logical: true`, no
 *      teleport, and gameState's region follows.
 *   B  THE PLAYBACK BOT on the rules' DIRECTED graph (§5.16 D's labelled in-page override of the proxy's
 *      auto-detected `assumeBidirectional`; the bidirectional-exits slice fixes that in the rules): the
 *      sphere queue's first goal (the Sword, level 10) through the LOGICAL link
 *      `level_0__r8c0 -> level_0__r1c6`, credited by the binding at once, the next door walked. The Sword
 *      CHECKED; the walk continues to the next named refusal (`ROW B reach`), within `--budget-s`.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/probe-seedling-wasm-logical-links.mjs [--host=http://localhost:8000] [--only=H,B]
 *      [--budget-s=900] [--wait-for-box=<sec>]
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

/** The preset, by its rules file (served path relative to `frontend/`). */
export const RULES_PATH = './presets/seedling_playthrough/AP_1/AP_1_rules.json';

/**
 * H's crossing, DERIVED from the partition: the first row of `level` where a tile of `from` and a tile of
 * `to` face each other with only no-sub-region tiles ('.') between them, every one of them `walkable`
 * (`(x, y) → bool`: the model's flood, so a pole between the two is not a way across).
 * `{row, fromTile, toTile, dir}` (tiles `[x, y]`; `dir` the arrow from `from` towards `to`) or null.
 */
export function facingTiles(partitionRegion, from, to, walkable = () => true) {
    const ch = (s) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[partitionRegion.sub_regions.indexOf(s)];
    const a = ch(from);
    const b = ch(to);
    for (const [y, row] of partitionRegion.rows.entries()) {
        for (const m of row.matchAll(new RegExp(`${b}\\.+${a}|${a}\\.+${b}`, 'g'))) {
            const left = m[0][0];
            const lx = m.index;
            const rx = m.index + m[0].length - 1;
            const [fx, tx] = left === a ? [lx, rx] : [rx, lx];
            const o = partitionRegion.origin;
            let clear = true;
            for (let x = lx; x <= rx; x += 1) clear = clear && walkable(x + o[0], y + o[1]);
            if (!clear) continue;
            return { row: y + o[1], fromTile: [fx + o[0], y + o[1]], toTile: [tx + o[0], y + o[1]],
                dir: tx < fx ? 'ArrowLeft' : 'ArrowRight' };
        }
    }
    return null;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-logical-links.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const SESSIONS = arg('only', 'H,B').split(',').filter(Boolean);
    const BUDGET_MS = Number(arg('budget-s', '900')) * 1000;
    const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
    const PARTITION = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-subregion-partition.json'), 'utf8'));
    const REGIONS = PRESET.regions['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
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
        const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `ll-${S}` });
        const { check } = rp;
        const out = (tag, o) => console.log(`ROW ${tag} ${JSON.stringify(o)}`);
        const panelLogTail = () => page.evaluate(() => (document.querySelector('.flash-panel-log')?.textContent ?? '')
            .split('\n').slice(-12).join(' | '));
        const glue = () => page.evaluate(async () => {
            const g = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
            const b = g.binding;
            return { region: b.region, physicalSub: b.physicalSub, subRegions: !!b.subRegions, logicalMoves: b.logicalMoves,
                stats: { ...g.stats } };
        });
        const tileOf = (p) => (p ? [Math.floor(p.x / 16), Math.floor(p.y / 16)] : null);

        /** H — a person's keys across a seam. */
        async function runHuman() {
            const entry = PARTITION.atlases[PRESET.region_atlas.atlas_id].regions.level_0;
            // The model's own flood from the start (every solid live; water is not solid) — the tiles a body fits.
            const MAP_DOC = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
            const { walkableCellsFrom } = await import('../../frontend/modules/seedlingDemo/levelSetExits.js');
            const L0 = MAP_DOC.levels.find((l) => l.level === 0);
            // Flooded from the first tile of r8c0 (the start's sub-region).
            const d = entry.sub_regions.indexOf('r8c0');
            const ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[d];
            const fy = entry.rows.findIndex((r) => r.includes(ch));
            const flood = walkableCellsFrom(L0, { tx: entry.rows[fy].indexOf(ch) + entry.origin[0], ty: fy + entry.origin[1] });
            const cross = facingTiles(entry, 'r8c0', 'r14c0', (x, y) => flood.has(`${x},${y}`));
            out('H crossing', cross);
            check('H: the partition has a row where r8c0 and r14c0 face each other', !!cross, JSON.stringify(cross));
            if (!cross) return;
            const g0 = await rp.waitFor('the binding holds the start sub-region and the sub-region map', async () => {
                const g = await glue();
                return g.region === START && g.subRegions ? g : null;
            }, 60000);
            out('H start', g0);
            const back = cross.dir === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
            const centre = ([tx, ty]) => ({ x: tx * 16 + 8, y: ty * 16 + 8 });
            const reach = async (key, tile, ceilingMs) => rp.holdUntil(key, async () => {
                const t = tileOf(await rp.livePlayer());
                return t && t[0] === tile[0] && t[1] === tile[1] ? t : null;
            }, ceilingMs);
            const movesNow = async () => (await rp.glueMoves()).map((m) => ({ from: m.sourceRegion, to: m.targetRegion,
                exit: m.exitName, logical: m.logical === true }));

            // 1. WITHOUT the item.
            await rp.jump(0, centre(cross.fromTile).x, centre(cross.fromTile).y);
            await page.waitForTimeout(1500);
            await rp.focusGame();
            const before = await movesNow();
            const dry = await reach(cross.dir, cross.toTile, 4000);
            await page.waitForTimeout(1000);
            const dryMoves = (await movesNow()).slice(before.length);
            const gDry = await glue();
            out('H without the item', { reached: dry.value, at: tileOf(await rp.livePlayer()), moves: dryMoves, glue: gDry });
            check('H: WITHOUT Progressive Swim no logical move is credited, wherever the player got',
                dryMoves.length === 0 && gDry.region === START, JSON.stringify({ dryMoves, region: gDry.region }));

            // 2. WITH the item.
            await page.evaluate(async () => {
                const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
                await proxy.addItemToInventory('Progressive Swim');
            });
            await rp.waitFor('the game can swim', async () => ((await rp.readGameState()).canSwim === true ? true : null), 20000);
            await rp.jump(0, centre(cross.fromTile).x, centre(cross.fromTile).y);
            await page.waitForTimeout(1500);
            const g1 = await glue();
            check('H: back on r8c0 after the jump, the AP region unmoved', g1.region === START, JSON.stringify(g1));
            await rp.focusGame();
            const base = (await movesNow()).length;
            const teleports0 = g1.stats.teleports;
            const over = await reach(cross.dir, cross.toTile, 6000);
            await page.waitForTimeout(1000);
            const gOver = await glue();
            const region1 = await rp.currentRegion();
            const ret = await reach(back, cross.fromTile, 6000);
            await page.waitForTimeout(1000);
            const gBack = await glue();
            const region2 = await rp.currentRegion();
            const wet = (await movesNow()).slice(base);
            out('H with the item', { over: over.value, back: ret.value, moves: wet, gameState: [region1, region2],
                glue: gBack, teleports: gBack.stats.teleports - teleports0, positionReads: gBack.stats.positionReads });
            const OUT = 'level_0__r14c0';
            check('H: the walk reached the other sub-region and came back', !!over.value && !!ret.value,
                JSON.stringify({ over: over.value, back: ret.value }));
            check('H: exactly ONE logical move each way (no double moves, no flicker at the seam)',
                wet.length === 2 && wet[0].from === START && wet[0].to === OUT && wet[1].from === OUT && wet[1].to === START
                    && wet.every((m) => m.logical), JSON.stringify(wet));
            check('H: gameState\'s region followed both moves', region1 === OUT && region2 === START,
                JSON.stringify([region1, region2]));
            check('H: the glue teleported nobody (a logical region load is not an arrival)',
                gBack.stats.teleports === teleports0 && gOver.region === OUT, JSON.stringify({ t0: teleports0, t: gBack.stats.teleports }));
        }

        /** Mount the Playback Bot in START with the DERIVED sphere log, and play. */
        async function startBot() {
            await page.evaluate(async (rulesPath) => {
                const rules = await (await fetch(rulesPath)).json();
                const { generateSphereLog } = await import('./modules/shared/procgen/forwardSimulator.js');
                const text = generateSphereLog(rules).map((e) => JSON.stringify(e)).join('\n');
                const { getSphereStateSingleton } = await import('./modules/sphereState/singleton.js');
                return getSphereStateSingleton().loadSphereLog('probe-seedling-wasm-logical-links:derived', text);
            }, RULES_PATH);
            return page.evaluate(async (start) => {
                const bus = (await import('./app/core/eventBus.js')).default;
                bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'tests');
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                for (let i = 0; i < 50 && !getActivePanel()?.getBot?.(); i++) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => { setTimeout(r, 100); });
                }
                const bot = getActivePanel()?.getBot?.();
                if (!bot) return { ok: false, why: 'no playback bot panel' };
                bot.onRegionMove({ targetRegion: start });
                bot.refresh();
                bot._ensureQueueBuilt?.();
                const head = bot._queue?.[0] ?? null;
                await bot.play();
                return { ok: true, region: bot.getCurrentRegion(), head: head && { location: head.locationName, region: head.regionName } };
            }, START);
        }
        const botStatus = () => page.evaluate(async () => {
            const { getActivePanel } = await import('./modules/playbackBot/index.js');
            const bot = getActivePanel()?.getBot?.();
            return { status: bot?.getStatus?.() ?? '', region: bot?.getCurrentRegion?.() ?? null };
        });
        const engineStats = () => page.evaluate(async () => {
            const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
            const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
            const e = c?._wasmEngine ?? null;
            if (!e) return { engine: false, lastRefusal: c?.lastRefusal ?? null };
            const st = e.stats;
            return JSON.parse(JSON.stringify({
                engine: true, adopted: st.adopted, forced: st.forced, forcedBy: st.forcedBy, adoptRefused: st.adoptRefused,
                held: st.held, continuations: st.continuations, divergences: st.divergences, recoveries: st.recoveries,
                failed: st.failed, done: st.done, hostStarts: (st.hostStarts ?? []).map((h) => h.label),
                history: (st.history ?? []).map((h) => ({ goal: h.goal?.name, level: h.goal?.level, outcome: h.outcome,
                    reason: h.reason ?? null })),
                lastRefusal: c.lastRefusal }));
        });

        /** B — the bot through the Sword's logical link (directed routing, the labelled override). */
        async function runBot() {
            const pinned = await page.evaluate(() => {
                const proxy = window.stateManagerProxy;
                proxy.getEffectiveBidirectionalSetting();
                proxy._bidirectionalDetectionCache = { assumeBidirectional: false, source: 'probe', detection: null };
                return proxy.getEffectiveBidirectionalSetting();
            });
            check('B: the proxy routes on the directed graph (the probe\'s labelled override)', pinned.assumeBidirectional === false
                && pinned.source === 'probe', JSON.stringify(pinned));
            const booted = await startBot();
            out('B boot', booted);
            check(`B: the bot is mounted in ${START}, its first goal in level 10`, booted.ok && booted.region === START
                && /^level_10(__|$)/.test(booted.head?.region ?? ''), JSON.stringify(booted));
            await clickPanelTab(page, FLASH_PANEL).catch(() => null);
            const sword = booted.head?.location;
            const t0 = Date.now();
            const statuses = [];
            let end = null;
            let swordAt = null;
            while (Date.now() - t0 < BUDGET_MS) {
                // eslint-disable-next-line no-await-in-loop
                end = await botStatus();
                if (end.status !== statuses.at(-1)?.status) {
                    statuses.push({ s: Math.round((Date.now() - t0) / 1000), status: end.status, region: end.region });
                    console.log(`INFO: B +${((Date.now() - t0) / 1000).toFixed(1)} s bot: ${end.status}`);
                }
                // eslint-disable-next-line no-await-in-loop
                const checks = await page.evaluate(() => window.__checks ?? []);
                if (swordAt === null && checks.includes(sword)) swordAt = Math.round((Date.now() - t0) / 1000);
                if (end.status.startsWith('error') || end.status.startsWith('finished')) break;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(500);
            }
            const eng = await engineStats();
            const checks = await page.evaluate(() => window.__checks ?? []);
            const moves = (await rp.glueMoves()).map((m) => `${m.logical ? '~' : ''}${m.exitName}`);
            const g = await glue();
            out('B engine', eng);
            out('B reach', { seconds: Math.round((Date.now() - t0) / 1000), sword, swordAt, checks, moves,
                logicalMoves: g.stats.logicalMoves, finalStatus: end?.status, region: end?.region, statuses: statuses.slice(-15) });
            out('B next refusal', { status: (end?.status ?? '').startsWith('error') ? end.status : null, engineRefusal: eng.lastRefusal ?? null });
            check('B: the Sword\'s logical link was CREDITED (a logical move r8c0 → r1c6)',
                moves.includes('~level_0__r8c0 -> level_0__r1c6'), JSON.stringify(moves.slice(0, 6)));
            check(`B: the bot reached and CHECKED the Sword ("${sword}")`, swordAt !== null && checks.filter((c) => c === sword).length === 1,
                JSON.stringify({ swordAt, checks }));
            check('B: every location checked once', new Set(checks).size === checks.length, JSON.stringify(checks));
            check('B: the walk ends FINISHED, with a NAMED refusal, or on the budget — never a silent stall',
                (end?.status ?? '').startsWith('finished') || (end?.status ?? '').startsWith('error') || Date.now() - t0 >= BUDGET_MS,
                end?.status ?? '');
        }

        try {
            await page.goto(`${HOST}/frontend/?rules=${RULES_PATH}`, { waitUntil: 'domcontentloaded' });
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
            await rp.waitFor('dispatcher wrapped', () => page.evaluate(async () => {
                window.__checks = window.__checks ?? [];
                const { getActivePanelInstance } = await import('./modules/flashPanel/index.js');
                const d = getActivePanelInstance()?.adapter?.dispatcher ?? null;
                if (!d) return false;
                if (!d.__ll) {
                    const orig = d.publish.bind(d);
                    d.publish = (n, p, o) => {
                        if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                        return orig(n, p, o);
                    };
                    d.__ll = true;
                }
                return true;
            }), 20000);
            if (S === 'H') await runHuman();
            if (S === 'B') await runBot();
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
