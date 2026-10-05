#!/usr/bin/env node
/**
 * Seedling JS solver-walk, slice WG (plan `seedling-js-solver-walk-plan.md` §5, the WG AS-BUILT) —
 * the Playback Bot walks GENERATED Seedling rooms (`flash_seedling_gen`) ON THE WASM RUNTIME
 * (default build p4e, headless logic-only, under the box lock). Each goal is served at an arrival
 * by `flashPanel/seedlingWasmPlayback.js` in its GENERATED mode: the engine stages the MOUNTED set
 * the generated arm delivered (not a map document), and the tape is the J2 WALKER's, produced in
 * the S2 worker from the arrival's staging (`seedlingDemo/wasmWalkTape.js`, `producer: 'walker'`).
 *
 *   R   `seedling_generated_room`: the bot drains the sphere log (the start room's apitem
 *       `region_0_0__key_blue_pickup`) — checked ONCE, key_blue ONCE, 0 fake checks (the binding's
 *       checks 1, nothing caught in a host botStart window), the leg `done`, producer `walker`, 0
 *       divergence. Then the bot is sent to the maze region `region_1_1` (`walkToTile`, the J2
 *       row's route): the generated door `region_0_0 → region_0_1` and the parking door
 *       `region_0_1 → region_1_1` are walked as two exit legs — each crossing reported ONCE, every
 *       planned tick stepped on plan. No `error:` status; every host botStart bracketed.
 *   L   `seedling_generated_leaf`: the sphere log's two maze locations, then the generated LEAF's
 *       apitem behind them (the bot crosses the maze into the generated room — an arrival the glue
 *       teleports) — every location checked ONCE, the generated leg by the walker, 0 fake checks.
 *   P   (`seedling_generated_room`, its own fresh page) W3's bound on the walker's tapes: a
 *       divergence injected into EVERY apitem plan (ArrowRight ~200 ms, the W3 injector) → 3 forced
 *       re-arrivals, then the bot's `error:` names the failure (the count and the bound) — ⛓ W4: or
 *       sooner, when one divergence EXACTLY repeats the previous one (same tick, same game row; the
 *       probe names which); no check
 *       fired, AP state intact, nothing armed or held, no stale key.
 *
 * `--record=<path>` writes the engine's recorded arrival reads (`{seam, status, state}` per
 * arrival, `engine.arrivalReads`) of the R session — the vitest fixture
 * `frontend/modules/seedlingDemo/fixtures/wasm-arrival-gen-p4f.json`.
 *
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED` (exit 1 on a fail).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build
 * (the `flashPanel/wasm` submodule), or this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/probe-seedling-wasm-generated-playback.mjs [--host=http://localhost:8000]
 *        [--only=R|L|P] [--record=<path>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLASH_PANEL, clickPanelTab, createRoomPlay, slotBlockOf } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

const SUBSTRATE = 'flash_seedling_gen';

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

/** In the game frame: count the tape verbs (never blocks one). */
function installCounters() {
    const game = window.__swfBridge.game;
    if (window.__wg) return true;
    const calls = { botLoadTape: 0, botStart: 0, botReset: 0, botStatus: 0, botDrain: 0, botSeam: 0 };
    for (const name of Object.keys(calls)) {
        const orig = game[name].bind(game);
        game[name] = (...a) => { calls[name] += 1; return orig(...a); };
    }
    window.__wg = { calls };
    return true;
}

/** In the PAGE: W3's divergence injector, on the generated instance's engine (every location plan). */
async function installInjector({ wasmPage, substrate }) {
    const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
    const frame = [...document.querySelectorAll('iframe')].find((f) => f.src.includes(wasmPage));
    const gw = frame?.contentWindow;
    if (!gw?.__swfBridge?.game) return 'no game window';
    const inj = { injected: [], seenShips: 0, stop: false };
    window.__wginj = inj;
    const press = (type) => {
        const ev = new gw.KeyboardEvent(type, { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true });
        Object.defineProperty(ev, 'keyCode', { get: () => 39 });
        Object.defineProperty(ev, 'which', { get: () => 39 });
        (gw.document.getElementById('canvas') ?? gw.document.body).dispatchEvent(ev);
    };
    const loop = () => {
        if (inj.stop) return;
        const e = substrateRegistry.get(substrate)?.getPlaybackController?.()?._wasmEngine;
        if (e) {
            const s = e.status();
            const ships = e.stats.ships;
            if (s.phase === 'playing' && ships > inj.seenShips && s.goal?.kind === 'location') {
                inj.seenShips = ships;
                inj.injected.push({ ship: ships, drained: s.drained, recoveries: s.recoveries });
                gw.setTimeout(() => press('keydown'), 150);
                gw.setTimeout(() => press('keyup'), 350);
            }
        }
        gw.setTimeout(loop, 0);
    };
    gw.setTimeout(loop, 0);
    return true;
}

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-generated-playback.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const ONLY = arg('only', '');
    const RECORD = arg('record', '');
    const FLASH_DIR = join(REPO, 'frontend/modules/flashPanel');
    const presetOf = (game) => JSON.parse(readFileSync(join(REPO, `frontend/presets/${game}/AP_1/AP_1_rules.json`), 'utf8'));
    const WASM_PAGE = slotBlockOf(presetOf('seedling_generated_room'), 'flash_panel')?.wasm ?? '';
    if (!WASM_PAGE || !existsSync(join(FLASH_DIR, 'wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const SESSIONS = ONLY ? [ONLY] : ['R', 'L', 'P'];
    let failed = 0;
    for (const MODE of SESSIONS) {
        console.log(`INFO: ── session ${MODE} ──`);
        // eslint-disable-next-line no-await-in-loop
        failed += await runSession(MODE);
    }
    await browser.close();
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

    async function runSession(MODE) {
        const GAME = MODE === 'L' ? 'seedling_generated_leaf' : 'seedling_generated_room';
        const PRESET = presetOf(GAME);
        const REGIONS = PRESET.regions['1'];
        const START = REGIONS.Menu.exits[0].connected_region;
        const GEN_REGIONS = Object.keys(REGIONS).filter((r) => PRESET.preset_sidecars?.['1']?.[r]?.substrate === SUBSTRATE);
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `wg-${MODE}` });
        const { check } = rp;
        const w = (fn, a) => rp.gameFrame().evaluate(fn, a);
        const ap = () => page.evaluate(async () => {
            const snap = window.stateManagerProxy?.getLatestStateSnapshot?.();
            const glue = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
            return { inv: snap?.inventory ?? {}, checked: [...(snap?.checkedLocations ?? [])],
                checks: [...(window.__checks ?? [])],
                binding: glue?.checkBinding ? { ...glue.checkBinding.stats, checked: [...glue.checkBinding.checked] } : null };
        });
        const engineStats = () => page.evaluate(async (substrate) => {
            const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
            const c = substrateRegistry.get(substrate)?.getPlaybackController?.();
            const e = c?._wasmEngine ?? null;
            return e ? JSON.parse(JSON.stringify({ ...e.stats, generated: e.generated, lastRefusal: c.lastRefusal,
                status: c.status(), arrivalReads: e.arrivalReads })) : null;
        }, SUBSTRATE);
        const botState = () => page.evaluate(async () => {
            const { getActivePanel } = await import('./modules/playbackBot/index.js');
            const bot = getActivePanel()?.getBot?.();
            return { status: bot?.getStatus?.() ?? '', log: (bot?.getLog?.() ?? []).slice(-60) };
        });
        /** Poll the bot until `done(status)` (or an `error:`), printing each status change. */
        async function untilBot(done, maxMs) {
            const t0 = Date.now();
            let last = '';
            let end = null;
            while (Date.now() - t0 < maxMs) {
                // eslint-disable-next-line no-await-in-loop
                end = await botState();
                if (end.status !== last) { console.log(`INFO: +${((Date.now() - t0) / 1000).toFixed(1)} s bot: ${end.status}`); last = end.status; }
                // eslint-disable-next-line no-await-in-loop
                if (end.status.startsWith('error') || (await done(end))) break;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(500);
            }
            return end;
        }
        try {
            await page.goto(`${HOST}/frontend/?game=${GAME}&seed=1`, { waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded', () => page.evaluate(
                () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
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
            await rp.waitFor('the AP load finished (the generated arm delivered its set)', () => page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                return !!p?._apLoadResult && !!p.seedlingPlaybackSurface()?.wasm?.levelSet;
            }), 120000);
            await rp.waitFor('dispatcher wrapped', () => page.evaluate(async () => {
                window.__checks = window.__checks ?? [];
                const { getActivePanelInstance } = await import('./modules/flashPanel/index.js');
                const d = getActivePanelInstance()?.adapter?.dispatcher ?? null;
                if (!d) return false;
                if (!d.__wg) {
                    const orig = d.publish.bind(d);
                    d.publish = (n, p, o) => {
                        if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                        return orig(n, p, o);
                    };
                    d.__wg = true;
                }
                return true;
            }), 20000);
            await page.waitForTimeout(1500);
            await w(installCounters);
            const status = async () => JSON.parse(await w(() => window.__swfBridge.game.botStatus()));
            const ap0 = await ap();
            check('the fresh world: nothing checked', ap0.checks.length === 0, JSON.stringify(ap0.checks));

            if (MODE === 'P') {
                const inj = await page.evaluate(installInjector, { wasmPage: WASM_PAGE, substrate: SUBSTRATE });
                check('P: the divergence injector is armed on the game window', inj === true, String(inj));
            }
            const booted = await page.evaluate(async (start) => {
                const bus = (await import('./app/core/eventBus.js')).default;
                bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'tests');
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                for (let i = 0; i < 50 && !getActivePanel()?.getBot?.(); i++) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => { setTimeout(r, 100); });
                }
                const bot = getActivePanel()?.getBot?.();
                if (!bot) return { ok: false, why: 'no playback bot panel' };
                const { getSphereStateSingleton } = await import('./modules/sphereState/singleton.js');
                const sphere = getSphereStateSingleton().getSphereData() ?? [];
                bot.onRegionMove({ targetRegion: start });
                bot.refresh();
                await bot.play();
                return { ok: true, sphere: sphere.flatMap((s) => s.locations ?? []), region: bot.getCurrentRegion() };
            }, START);
            const SPHERE = booted.sphere ?? [];
            const GEN_LOCS = SPHERE.filter((n) => GEN_REGIONS.some((r) => (REGIONS[r].locations ?? []).some((l) => l.name === n)));
            check('the bot is mounted, in the start region, with the embedded sphere log naming a generated location',
                booted.ok && booted.region === START && GEN_LOCS.length === 1, JSON.stringify({ ...booted, GEN_LOCS }));
            await clickPanelTab(page, FLASH_PANEL).catch(() => null);
            const end = await untilBot((e) => e.status.startsWith('finished'), 180000);
            const apB = await ap();
            let eng = await engineStats();
            const hist = () => eng?.history ?? [];
            const calls = await w(() => window.__wg.calls);
            console.log(`INFO: engine ${JSON.stringify({ ...eng, arrivalReads: undefined })}`);
            console.log(`INFO: verb calls ${JSON.stringify(calls)}; binding ${JSON.stringify(apB.binding)}`);
            const bracketed = () => (eng?.hostStarts?.length ?? 0) >= 2 && eng.hostStarts.every((h) => h.to >= h.from)
                && eng.hostStarts.length === 2 * eng.ships - (eng.ships - eng.solves);

            if (MODE === 'P') {
                const inj = await page.evaluate(() => { const i = window.__wginj; if (i) i.stop = true; return i ? { injected: i.injected } : null; });
                const legs = hist().filter((h) => h.goal?.kind === 'location');
                // ⛓ W4 — an EXACT repeat (same tick, same game row) fails before the bound
                const repeat = /at the SAME tick with the SAME game row/.test(end?.status ?? '');
                const k = repeat ? legs.filter((h) => h.outcome === 'diverged').length : 3;
                console.log(`INFO: P failed by ${repeat ? `an EXACT REPEAT after ${k + 1} plans` : 'the bound (4 plans)'}`);
                check('P: the bot shows the engine\'s named failure (error:; the bound — or ⛓ W4 an exact repeat — named)',
                    /^error:/.test(end?.status ?? '') && (repeat
                        ? new RegExp(`${k + 1} times in a row \\(gave up after ${k} forced re-arrival`).test(end.status)
                        : /the game left the plan 4 times/.test(end.status) && /gave up after 3 forced re-arrivals, the bound is 3/.test(end.status)),
                    `status "${end?.status}"`);
                check(`P: ${k} recover${k === 1 ? 'y' : 'ies'} then the failure, on WALKER tapes (${k + 1} plans, ${k + 1} injections)`,
                    k >= 1 && eng?.recoveries === k && JSON.stringify(legs.map((h) => h.outcome)) === JSON.stringify([...Array(k).fill('diverged'), 'failed'])
                        && legs.slice(0, k).every((h) => h.producer === 'walker') && eng.ships === k + 1 && inj?.injected.length === k + 1,
                    JSON.stringify({ recoveries: eng?.recoveries, outcomes: legs.map((h) => [h.outcome, h.producer]), ships: eng?.ships, injected: inj?.injected.length }));
                const stale = legs.filter((h) => h.input).map((h) => (h.input.held ?? []).filter((k) => !(h.input.press_totals?.[k] >= 1)));
                check('P: no STALE key at any divergence (the release pair after each botReset)', stale.every((x) => x.length === 0),
                    JSON.stringify({ stale, keyReleases: eng?.keyReleases }));
                check('P: NO check fired and AP state intact', apB.checks.length === 0 && apB.binding.checks === 0
                    && JSON.stringify(apB.inv) === JSON.stringify(ap0.inv), JSON.stringify({ checks: apB.checks, binding: apB.binding }));
                const stP = await status();
                check('P: nothing of ours left armed or held; the engine idle', !stP.armed && !stP.held && eng?.status?.state === 'idle',
                    JSON.stringify({ armed: stP.armed, held: stP.held, engine: eng?.status?.state }));
            } else {
                const errs = (end?.log ?? []).filter((l) => typeof l === 'string' && l.startsWith('error:'));
                check(`${MODE}: the Playback Bot completed ${GAME} from its sphere log on WASM (finished, no error:)`,
                    errs.length === 0 && end?.status.startsWith('finished'), `status "${end?.status}", errors ${JSON.stringify(errs)}`);
                const missing = SPHERE.filter((n) => !apB.checked.includes(n));
                check(`${MODE}: every sphere-log location is checked in the state manager`, missing.length === 0, JSON.stringify(missing));
                // The flash panel's dispatcher carries the GENERATED rooms' checks (a maze location is the maze substrate's).
                const once = GEN_LOCS.map((n) => [n, apB.checks.filter((c) => c === n).length]).filter(([, k]) => k !== 1);
                check(`${MODE}: every generated location checked EXACTLY ONCE on the flash panel's dispatcher, nothing else on it`,
                    once.length === 0 && apB.checks.length === GEN_LOCS.length, JSON.stringify({ once, checks: apB.checks }));
                check(`${MODE}: 0 fake checks — the binding made exactly the generated checks and caught nothing in a host botStart window`,
                    apB.binding.checks === GEN_LOCS.length && (apB.binding.armingWindow ?? 0) === 0,
                    `checks ${apB.binding.checks}, armingWindow ${apB.binding.armingWindow}`);
                // ⛓ An apitem leg normally ends `stopped`: the game reports the check ON the contact tick (the
                // tape's last), the bot takes it and moves on — stopping the controller before the engine's
                // `finished` read (STATUS_MS). Measured (R, run 1): 220 of 220 planned ticks drained, on plan.
                const locLeg = hist().filter((h) => h.goal?.kind === 'location').at(-1);
                check(`${MODE}: the engine runs GENERATED (the mounted set) and served the apitem by the WALKER producer: every planned tick stepped, on plan`,
                    eng?.generated === true && locLeg?.producer === 'walker' && !locLeg.divergence && locLeg.drained >= locLeg.ticks
                        && (locLeg.outcome === 'done' || (locLeg.outcome === 'stopped' && locLeg.phase === 'playing')), JSON.stringify(locLeg));
                check(`${MODE}: 0 divergences, 0 recoveries`, eng?.divergences === 0 && eng?.recoveries === 0,
                    JSON.stringify({ divergences: eng?.divergences, recoveries: eng?.recoveries }));
                check(`${MODE}: every host botStart bracketed by seq reads (freeze + plan per attempt)`, bracketed(), JSON.stringify(eng?.hostStarts));
            }

            if (MODE === 'R') {
                // ── the crossings: the J2 row's route out of the generated rooms into the maze ──
                const MAZE = { region: 'region_1_1', x: 5, y: 5 };
                const movesBefore = (await rp.glueMoves()).length;
                const r = await page.evaluate(async (t) => {
                    const { getActivePanel } = await import('./modules/playbackBot/index.js');
                    const bot = getActivePanel()?.getBot?.();
                    const ok = bot.walkToTile(t.region, t.x, t.y);
                    return ok;
                }, MAZE);
                check('R: the bot took the cross-region tile target into the maze', !!r?.ok, JSON.stringify(r));
                const regionAt = () => page.evaluate(() => window.centralRegistry?.getPublicFunction('gameState', 'getCurrentRegion')?.() ?? null);
                await untilBot(async () => (await regionAt()) === MAZE.region, 120000);
                const moves = (await rp.glueMoves()).slice(movesBefore).map((m) => m.targetRegion);
                eng = await engineStats();
                const doors = hist().filter((h) => h.goal?.kind === 'exit');
                console.log(`INFO: R moves after the queue ${JSON.stringify(moves)}; door legs ${JSON.stringify(doors)}`);
                check('R: the bot arrived in the maze region (gameState)', (await regionAt()) === MAZE.region, String(await regionAt()));
                check('R: the generated door (→ region_0_1) and the parking door (→ region_1_1) each reported ONCE',
                    moves.filter((m) => m === 'region_0_1').length === 1 && moves.filter((m) => m === 'region_1_1').length === 1,
                    JSON.stringify(moves));
                check('R: both exit legs were WALKER tapes, every planned tick stepped, none off the plan',
                    doors.length === 2 && doors.every((d) => d.producer === 'walker' && (d.outcome === 'done'
                        || (d.outcome === 'stopped' && d.phase === 'playing')) && d.drained >= d.ticks && !d.divergence),
                    JSON.stringify(doors.map((d) => ({ o: d.outcome, p: d.producer, ticks: d.ticks, drained: d.drained, div: d.divergence }))));
                const errs = (await botState()).log.filter((l) => typeof l === 'string' && l.startsWith('error:'));
                check('R: no error: status at any point', errs.length === 0, JSON.stringify(errs));
                const apR = await ap();
                check('R: still exactly one check after the crossings (no door leg re-declared a fake one)',
                    apR.checks.length === 1 && apR.binding.checks === 1 && (apR.binding.armingWindow ?? 0) === 0, JSON.stringify(apR.binding));
                check('R: every host botStart bracketed (all legs)', bracketed(), JSON.stringify(eng?.hostStarts));
                if (RECORD) {
                    const reads = eng?.arrivalReads ?? [];
                    writeFileSync(RECORD, `${JSON.stringify({ comment: 'probe-seedling-wasm-generated-playback.mjs --record (WG): the '
                        + 'wasm engine\'s raw arrival reads on seedling_generated_room (p4e, headless logic-only)', game: GAME,
                        arrivals: reads }, null, 1)}\n`);
                    console.log(`INFO: recorded ${reads.length} arrival(s) to ${RECORD}`);
                }
            }
            console.log(`INFO: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s) (the logic-only channel's device loss)`);
            const wp = logs.filter((l) => /wasm playback|\[playback\]/.test(l));
            if (wp.length) console.log(`INFO: playback log lines:\n  ${wp.slice(-30).join('\n  ')}`);
        } catch (e) {
            check(`fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
        }
        await page.close();
        return rp.failures();
    }
}
