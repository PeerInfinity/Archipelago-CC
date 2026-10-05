#!/usr/bin/env node
/**
 * Seedling JS solver-walk, slice W1 (plan `seedling-js-solver-walk-plan.md` §5.3) — a wasm room
 * ARRIVAL on the live flashPanel page → a JS staging → the S2 worker's solve, with NO play.
 *
 * On `seedling_atlas_location` (default build p4e, headless logic-only, under the box lock) an
 * in-iframe sampler polls `botSeam()` (0.1 ms) between the game's frames; the first sample whose
 * `beginEntry` CHANGED is an arrival (`wasmArrival.isArrival`), and in that same JS turn it reads
 * `botStatus` ONCE and the bridge's `readState`. Three arrivals are taken:
 *   A   a host `jump` to the Starting House at its spawn;
 *   B   the locked house door (a real ArrowDown, no key): the game's own door to level 0, then
 *       the glue's bounce back — two arrivals (B0 level 0, B86 the house's return spawn). ⛓ W5: B0
 *       stages like any room (W1 refused it: the moonrock's `beam`/`rockSet`, now on readState);
 *   C   the chest opened for real (ArrowUp; the check and the SealPiece land), then a host
 *       `jump` — the house with a non-empty cleared set and `seal_parts`.
 * Each arrival is staged (`stagingFromWasmArrival`), witnessed field for field against its own
 * reads, round-tripped through the tape format (`buildStagedTape` → `parseTape`), and every
 * house arrival is SOLVED for the chest and the door through `createWorkerSolveService` — a real
 * module Worker in the host page — and again in place in node, which must agree key for key.
 *
 * ⛔ IT PLAYS NOTHING: `botLoadTape` / `botStart` / `botReset` are wrapped and COUNTED from the
 * moment the game's verbs exist; any call fails the run. Real keys move the player (B, C) — a player's
 * input, not a tape.
 *
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED` (exit 1 on a fail).
 * `--record=<path>` writes the arrivals' raw reads (the vitest fixture's source).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build
 * (the `flashPanel/wasm` submodule), or this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/probe-seedling-wasm-arrival-solve.mjs [--host=http://localhost:8000] [--record=<path>]
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

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

/**
 * The in-iframe instrument (`window.__w1`): the tape verbs wrapped and counted, and an arrival
 * sampler that reads `botSeam` per sample and `botStatus` ONCE per arrival.
 */
function installInstrument() {
    const game = window.__swfBridge.game;
    const J = (s) => { try { return JSON.parse(s); } catch { return { __raw: s }; } };
    const calls = { botLoadTape: 0, botStart: 0, botReset: 0, botStatus: 0, botSeam: 0 };
    for (const name of ['botLoadTape', 'botStart', 'botReset']) {
        const orig = game[name].bind(game);
        game[name] = (...a) => { calls[name] += 1; return orig(...a); };
    }
    const seam = () => { calls.botSeam += 1; return J(game.botSeam()); };
    window.__w1 = {
        calls,
        seam,
        arrivals: [],
        /** Sample `ms`; every beginEntry change is an arrival, read in the same turn. */
        watch(ms) {
            return new Promise((resolve) => {
                const t0 = performance.now();
                let prev = seam().beginEntry ?? null;
                const step = () => {
                    const se = seam();
                    const be = se.beginEntry ?? null;
                    if (be && JSON.stringify(be) !== JSON.stringify(prev)) {
                        const s0 = performance.now();
                        calls.botStatus += 1;
                        const status = J(game.botStatus());
                        const statusMs = performance.now() - s0;
                        const state = J(game.readState());
                        window.__w1.arrivals.push({ t: +(performance.now() - t0).toFixed(1), seam: se, status,
                            state, statusMs: +statusMs.toFixed(2) });
                        prev = be;
                    }
                    if (performance.now() - t0 < ms) setTimeout(step, 0);
                    else resolve(window.__w1.arrivals.length);
                };
                step();
            });
        },
    };
    return true;
}

/**
 * In the HOST page: solve `goals` from `staging` through the S2 worker service (a real module
 * Worker). Returns per goal `{ok, keys, expected, verbs, solveMs, …}` or the refusal.
 */
async function solveInPage({ staging, goals, map }) {
    const W = await import('./modules/seedlingDemo/wasmArrival.js');
    const { createWorkerSolveService } = await import('./modules/seedlingDemo/jsRuntimeSolveService.js');
    const { indexLevels, levelSourceFromAtlas } = await import('./modules/seedlingDemo/atlasSource.js');
    const doc = await (await fetch(map)).json();
    const records = indexLevels(doc);
    const levelSource = levelSourceFromAtlas(records);
    const record = records.get(staging.boot.level);
    const service = createWorkerSolveService();
    const out = [];
    try {
        for (const goal of goals) {
            const mapped = W.arrivalSolverGoal(goal, { staging, levelSource, record });
            if (!mapped.goal) { out.push({ name: goal.name, ok: false, kind: 'walker', message: mapped.walker }); continue; }
            const request = W.arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource, records });
            const t0 = performance.now();
            const handle = service.start(request);
            while (!handle.settled && performance.now() - t0 < 60000) {
                // eslint-disable-next-line no-await-in-loop
                await new Promise((r) => { setTimeout(r, 20); });
            }
            if (!handle.settled) handle.cancel();
            const res = handle.result;
            const wallMs = Math.round(performance.now() - t0);
            if (!res?.ok) { out.push({ name: goal.name, ok: false, kind: res?.kind, message: res?.message, wallMs }); continue; }
            const p = res.plan;
            out.push({ name: goal.name, ok: true, solverGoal: mapped.goal, keys: p.solution.map((s) => [...s].sort()),
                expected: p.expected, verbs: p.verbs, solveMs: Math.round(p.solveMs), wallMs,
                where: service.kind, workers: service.stats.workers });
        }
    } finally {
        service.dispose();
    }
    return out;
}

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-arrival-solve.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const RECORD = arg('record', '');
    const GAME = 'seedling_atlas_location';
    const PRESET = JSON.parse(readFileSync(join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const FLASH_DIR = join(REPO, 'frontend/modules/flashPanel');
    const WASM_PAGE = slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '';
    if (!WASM_PAGE || !existsSync(join(FLASH_DIR, 'wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const SD = join(REPO, 'frontend/modules/seedlingDemo');
    const W = await import(join(SD, 'wasmArrival.js'));
    const { createInPlaceSolveService } = await import(join(SD, 'jsRuntimeSolver.js'));
    const { indexLevels, levelSourceFromAtlas } = await import(join(SD, 'atlasSource.js'));
    const { buildStagedTape } = await import(join(SD, 'botDriverV1.js'));
    const { parseTape } = await import(join(SD, 'tapeFormat.js'));
    const { createRunForStaging, stagingFromTape } = await import(join(SD, 'tapeRunner.js'));
    const { resolveSeedlingAtlasGoal } = await import(join(FLASH_DIR, 'seedlingPlaybackController.js'));
    const MAP_REL = 'modules/flashPanel/atlases/seedling-map.json';
    const records = indexLevels(JSON.parse(readFileSync(join(REPO, 'frontend', MAP_REL), 'utf8')));
    const levelSource = levelSourceFromAtlas(records);

    const REGIONS = PRESET.regions['1'];
    const SIDECARS = PRESET.preset_sidecars['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const ROOM = SIDECARS[START].playable_payload;
    const DOOR = ROOM.exits[0];
    const CHEST = REGIONS[START].locations.find((l) => l.item?.name === 'key_blue').name;

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const logs = [];
    page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: 'w1' });
    const { check } = rp;
    const recorded = [];
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
        // Wrapped the moment the game's verbs exist — before the panel's own load runs.
        await rp.waitFor('the game\'s bot verbs', () => rp.gameFrame().evaluate(
            () => typeof window.__swfBridge?.game?.botStart === 'function'), 60000);
        await rp.gameFrame().evaluate(installInstrument);
        await rp.waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
            document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);
        await rp.waitFor('the AP load finished', () => page.evaluate(async () => {
            const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
            return !!p?._apLoadResult;
        }), 120000);
        await page.waitForTimeout(1500);
        const atlas = await page.evaluate(async () => {
            const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
            const a = p?.seedlingPlaybackSurface?.()?.atlas ?? null;
            return a ? { entries: a.entries, refused: a.refused, regions: [...a.regions] } : null;
        }).then((a) => (a ? { ...a, regions: new Map(a.regions) } : null));
        check('the panel carries the atlas arm\'s name → cell map', !!atlas, atlas ? `${atlas.entries.length} bound` : 'none');
        const chestGoal = resolveSeedlingAtlasGoal({ kind: 'location', name: CHEST }, atlas);
        const doorGoal = resolveSeedlingAtlasGoal({ kind: 'exit', name: DOOR.exitName }, atlas, { region: START });
        check('the chest and the door resolve to goals (the controller\'s own mapping)', !!chestGoal.goal && !!doorGoal.goal,
            JSON.stringify([chestGoal, doorGoal]));
        const GOALS = [chestGoal.goal, doorGoal.goal];

        const w = (fn, a) => rp.gameFrame().evaluate(fn, a);
        const state0 = await rp.readGameState();
        const spawn = { x: state0.playerPositionX, y: state0.playerPositionY };

        /** Watch `ms` while `act` runs; the arrivals it saw. */
        async function arrivalsDuring(label, act, ms) {
            const from = await w(() => window.__w1.arrivals.length);
            const watching = w((d) => window.__w1.watch(d), ms);
            await act();
            await watching;
            const got = await w((n) => window.__w1.arrivals.slice(n), from);
            console.log(`INFO: ${label} — ${got.length} arrival(s): ${JSON.stringify(got.map((a) => [a.seam.beginEntry?.['begin.level'],
                a.status.level, a.state.playerPositionX, a.state.playerPositionY, a.status.x, a.status.y, a.statusMs]))}`);
            return got.map((a) => ({ ...a, label }));
        }

        const A = await arrivalsDuring('A host jump to the house spawn', () => rp.jump(ROOM.level, spawn.x, spawn.y), 4000);
        const B = await arrivalsDuring('B the locked door (no key) and the glue\'s bounce', async () => {
            await rp.focusGame();
            await rp.holdUntil('ArrowDown', async () => {
                const n = await w(() => window.__w1.arrivals.length);
                return n >= 2 ? n : null;
            }, 6000);
        }, 9000);
        await rp.focusGame();
        const before = await rp.readGameState();
        const K = await rp.holdUntil('ArrowUp', async () => {
            const st = await rp.readGameState();
            return st.pendingCheck !== before.pendingCheck ? st.pendingCheck : null;
        }, 8000);
        console.log(`INFO: the chest for real — pendingCheck ${JSON.stringify(K)}`);
        await page.waitForTimeout(1500);
        const state1 = await rp.readGameState();
        const C = await arrivalsDuring('C a host jump after the chest', () => rp.jump(ROOM.level, state1.playerPositionX,
            state1.playerPositionY), 4000);

        const arrivals = [...A, ...B, ...C];
        check('every arrival read botStatus ONCE (one read per beginEntry change)',
            (await w(() => window.__w1.calls.botStatus)) === arrivals.length, `${arrivals.length} arrival(s)`);
        check('A: one arrival, level 86', A.length === 1 && A[0].status.level === ROOM.level);
        check('B: two arrivals, level 0 then 86 (the game door, the glue bounce)',
            B.length === 2 && B[0].status.level === 0 && B[1].status.level === ROOM.level, JSON.stringify(B.map((a) => a.status.level)));
        check('C: one arrival, level 86, the chest cleared', C.length === 1
            && C[0].status.persistence_cleared.some((c) => c.level === ROOM.level && c.tag === 0));

        for (const arr of arrivals) {
            const tag = `${arr.label.split(' ')[0]}${arr.status.level}`;
            const { seam, status, state } = arr;
            const be = seam.beginEntry;
            check(`${tag}: read before the first stepped tick (game_time ${status.game_time} = begin save.time ${be['save.time']})`,
                status.game_time === be['save.time']);
            recorded.push({ label: arr.label, seam, status, state, statusMs: arr.statusMs });
            let staged;
            try {
                staged = W.stagingFromWasmArrival({ seam, status, state, record: records.get(status.level) ?? null });
            } catch (e) {
                // ⛓ W5 — no arrival is refused any more: level 0's moonrock reads `beam`/`rockSet`,
                // which games/seedling.json now declares, so B0 stages off readState like any room.
                check(`${tag}: staged (W5: the moonrock's beam/rockSet come off readState — no refusal)`, false,
                    e.message.slice(0, 240));
                continue;
            }
            const { staging, undeclared, gamePins } = staged;
            console.log(`INFO: ${tag} staging ${JSON.stringify(staging)}`);
            console.log(`INFO: ${tag} undeclared seam keys ${JSON.stringify(undeclared)}; the game's live pins ${JSON.stringify(gamePins)}`);
            for (const r of W.arrivalStagingWitness(staging, { seam, status, state })) check(`${tag}: ${r.name}`, r.ok, r.detail);
            const fresh = createRunForStaging(staging, levelSource);
            check(`${tag}: the staged JS run stands where the game's player does (no stepped tick on either side)`,
                fresh.level === status.level && fresh.state.x === status.x && fresh.state.y === status.y,
                `JS (${fresh.state.x}, ${fresh.state.y}) game (${status.x}, ${status.y}); spawn (${staging.boot.x}, ${staging.boot.y})`);
            const tape = parseTape(buildStagedTape({ staging, perTick: [], name: `w1-${tag}` }));
            // A tape's clear rows carry a `note` the model never reads; the rest must come back unchanged.
            const back = stagingFromTape(tape);
            back.persistence = back.persistence.map(({ level, tag }) => ({ level, tag }));
            check(`${tag}: the staging round-trips the tape format (buildStagedTape → parseTape)`,
                JSON.stringify(back) === JSON.stringify(staging),
                JSON.stringify(back) === JSON.stringify(staging) ? `v${tape.tape_version}` : `${JSON.stringify(back)}`);
            if (status.level !== ROOM.level) continue;

            const inPage = await page.evaluate(solveInPage, { staging, goals: GOALS, map: MAP_REL });
            const inPlace = createInPlaceSolveService();
            const chestCleared = staging.persistence.some((c) => c.level === ROOM.level && c.tag === 0);
            for (const [i, goal] of GOALS.entries()) {
                const got = inPage[i];
                const mapped = W.arrivalSolverGoal(goal, { staging, levelSource, record: records.get(ROOM.level) });
                const local = mapped.goal ? inPlace.start(W.arrivalSolveRequest({ staging, solverGoal: mapped.goal,
                    levelSource, records })).result : { ok: false, message: mapped.walker };
                if (goal.kind === 'location' && chestCleared) {
                    // The chest is open: nothing to collect. The solver must say so, not walk.
                    check(`${tag}: ${goal.name} — already collected → a named refusal (worker and in place)`,
                        !got.ok && !local.ok, `${got.kind}: ${String(got.message).slice(0, 160)}`);
                    continue;
                }
                check(`${tag}: ${goal.name} — solved in the WORKER`, got.ok && got.where === 'worker',
                    got.ok ? `${got.keys.length} keys, verbs ${got.verbs}, solve ${got.solveMs} ms (wall ${got.wallMs})`
                        : `${got.kind}: ${got.message}`);
                if (!got.ok) continue;
                const exp = got.expected;
                console.log(`INFO: ${tag} ${goal.name} expected trajectory ${exp.length} rows: first ${JSON.stringify(exp[0])}`
                    + ` last ${JSON.stringify(exp.at(-1))}`);
                check(`${tag}: ${goal.name} — the trajectory starts where the game's player stands (0 deaths)`,
                    exp[0].level === ROOM.level && exp[0].x === status.x && exp[0].y === status.y && exp[0].deaths === 0);
                check(`${tag}: ${goal.name} — one expected row per key set (+ the start)`, exp.length === got.keys.length + 1);
                if (goal.kind === 'exit') {
                    check(`${tag}: ${goal.name} — the trajectory ends OUT of the house`, exp.at(-1).level !== ROOM.level,
                        `ends ${JSON.stringify(exp.at(-1))}`);
                }
                const localKeys = local.ok ? local.plan.solution.map((s) => [...s].sort()) : null;
                check(`${tag}: ${goal.name} — the worker's plan = the in-place plan, key for key and row for row`,
                    local.ok && JSON.stringify(localKeys) === JSON.stringify(got.keys)
                        && JSON.stringify(local.plan.expected) === JSON.stringify(exp));
            }
        }
        const calls = await w(() => window.__w1.calls);
        check('NOTHING PLAYED: botLoadTape / botStart / botReset never called', calls.botLoadTape === 0
            && calls.botStart === 0 && calls.botReset === 0, JSON.stringify(calls));
        // ⛔ No zero-pageerror claim: on the logic-only channel the device-lost message IS the
        // channel's signature (`seedlingChannel.js`); the count is reported, not asserted.
        console.log(`INFO: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s) (the logic-only channel's device loss)`);
    } catch (e) {
        check(`fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
    }
    if (RECORD) {
        writeFileSync(RECORD, `${JSON.stringify({
            source: `${GAME} seed 1, default build ${WASM_PAGE}, probe-seedling-wasm-arrival-solve.mjs`,
            arrivals: recorded,
        }, null, 1)}\n`);
        console.log(`INFO: recorded ${recorded.length} arrival(s) → ${RECORD}`);
    }
    await browser.close();
    const n = rp.failures();
    console.log(n === 0 ? 'ALL CHECKS PASSED' : `${n} CHECK(S) FAILED`);
    process.exit(n === 0 ? 0 : 1);
}
