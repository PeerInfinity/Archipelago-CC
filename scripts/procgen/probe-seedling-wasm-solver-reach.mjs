#!/usr/bin/env node
/**
 * Planning probe (session `seedling-wasm-solver-planning`, plan
 * `NewDocs/plans/seedling-wasm-solver-plan.md` §1) — HOW FAR THE SOLVER REACHES ON THE WASM RUNTIME, measured
 * on the live flashPanel page (`seedling_atlas_location`, default build p4e, headless logic-only, under the box
 * lock). MEASURE ONLY: it prints JSON rows and changes nothing tracked. The in-page half is
 * `wasmSolverReachLab.js` (imported by URL from the dev server).
 *
 *   C   the CONTINUATION: arrive (host jump), solve, play K ticks HELD, compare the game (botStatus, botMobiles)
 *       with the JS shadow (staging + those K keys), then continue — `rest` of the same plan, or a fresh
 *       `prefix` re-solve from the shadow (S0) — and compare the continuation tick by tick; `composite` plays the
 *       prefix + the re-solve as ONE tape from the arrival (no seam: a divergence there is the model's).
 *       `--c=L4:40:resolve,L6:150:rest` picks rows (a fresh page each run; L5's lock persists once opened)
 *   O   the GAME ORACLE: `twoPassSolve` on L8 (sandtrap, GAME-sourced) with the live game as `gameTick`; then a
 *       plain solve from a re-arrival that carries the clear
 *   M   the MOONROCK: `Main.beam`/`Main.rockSet` read through BridgeGeneric `configure`, then a level-0 leg
 *   S   the SWEEP: every leg of `--legs=<jsonl>` (the node pre-pass's `outcome: solved` rows) through the REAL
 *       W2/W3 engine — divergences, recoveries, failures; `--limit=N`, `--from=N`. A game that EXITS (every call
 *       throws `ExitStatus`) is reported with its console tail and the page is rebooted
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build.
 *
 * Run: node scripts/procgen/probe-seedling-wasm-solver-reach.mjs --only=C|O|M|S [--host=…] [--c=…] [--legs=…] [--limit=N] [--from=N] [--wait-for-box=<sec>]
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

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-solver-reach.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const ONLY = arg('only', 'C');
    const GAME = 'seedling_atlas_location';
    const PRESET = JSON.parse(readFileSync(join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const WASM_PAGE = PRESET.flash_panel?.wasm ?? '';
    if (!WASM_PAGE || !existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let page;
    let logs = [];
    let rp;
    const out = (tag, o) => console.log(`ROW ${tag} ${JSON.stringify(o)}`);
    async function boot() {
        if (page) { try { await page.close(); } catch { /* gone */ } }
        page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `reach-${ONLY}` });
        if (ONLY === 'M') {
            // BridgeGeneric takes ONE configure ("error:already configured" on a second): the two statics must be in
            // the game config the panel configures with — served here with `Main.beam`/`Main.rockSet` appended.
            await page.route('**/flashPanel/games/seedling.json', async (route) => {
                const r = await route.fetch();
                const cfg = await r.json();
                cfg.state_properties.splice(cfg.state_properties.length - 1, 0,
                    { class: 'main', property: 'beam', type: 'boolean' }, { class: 'main', property: 'rockSet', type: 'boolean' });
                await route.fulfill({ response: r, json: cfg });
            });
        }
        await page.goto(`${HOST}/frontend/?game=${GAME}&seed=1`, { waitUntil: 'domcontentloaded' });
        await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
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
        await page.evaluate(async () => {
            const { createLab } = await import('/scripts/procgen/wasmSolverReachLab.js');
            window.__lab = await createLab();
        });
    }
    try {
        await boot();
        const ev = (fn, a) => page.evaluate(fn, a);
        if (ONLY === 'C') {
            const legs = [
                { name: 'L5 kill', level: 5, x: 80, y: 32, goal: { kind: 'exit', level: 5, tiles: [[3, 7]], name: 'out_teleporter_48_112' }, Ks: [100, 300] },
                { name: 'L6 bait', level: 6, x: 32, y: 16, goal: { kind: 'exit', level: 6, tiles: [[14, 2]], name: 'out_stairsup_224_32' }, Ks: [60, 150] },
                { name: 'L4 shove', level: 4, x: 16, y: 16, goal: { kind: 'exit', level: 4, tiles: [[4, 1]], name: 'out_stairsdown_64_16' }, Ks: [40, 120] },
                { name: 'L86 chest', level: 86, x: 48, y: 48, goal: { kind: 'location', level: 86, tag: 0, entityType: 'chest', name: 'chest' }, Ks: [10] },
            ];
            // `--c=L4:40:resolve,L5:100:rest` picks rows (fresh page order matters: L5's lock persists once opened)
            const pickC = arg('c', '');
            const wanted = pickC ? pickC.split(',').map((t) => t.split(':')) : null;
            const plan = wanted ? wanted.map(([n, K, mode]) => ({ leg: legs.find((l) => l.name.startsWith(`${n} `)), K: Number(K), mode }))
                : legs.flatMap((leg) => leg.Ks.flatMap((K) => ['rest', 'resolve'].map((mode) => ({ leg, K, mode }))));
            for (const { leg, K, mode } of plan) {
                {
                    {
                        // eslint-disable-next-line no-await-in-loop
                        let r;
                        try { r = await ev((a) => window.__lab.continuation(a), { ...leg, K, mode }); } catch (err) {
                            r = { error: `evaluate: ${err.message.split('\n')[0]}` };
                            await ev(() => { try { window.__lab.game().botReset(); } catch { /* */ } });
                        }
                        out('C', { leg: leg.name, K, mode, releases: await ev(() => window.__lab.releases.splice(0)), ...r });
                    }
                }
            }
        } else if (ONLY === 'O') {
            // The two-pass loop runs HERE (twoPassSolve.js cannot load in a page: r8Acceptance imports node:fs);
            // its `gameTick` plays each measuring prefix on the live game.
            const SD = join(REPO, 'frontend/modules/seedlingDemo');
            const { twoPassSolve } = await import(join(SD, 'twoPassSolve.js'));
            const { createRunForStaging } = await import(join(SD, 'tapeRunner.js'));
            const { indexLevels, levelSourceFromAtlas } = await import(join(SD, 'atlasSource.js'));
            const levelSource = levelSourceFromAtlas(indexLevels(JSON.parse(readFileSync(
                join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'))));
            const L8 = { level: 8, x: 144, y: 48, goal: { kind: 'exit', level: 8, tiles: [[6, 12]], name: 'out_teleporter_96_192' } };
            const st = await ev((a) => window.__lab.oracleStage(a), L8);
            out('O-stage', { solverGoal: st.solverGoal, walker: st.walker, error: st.error, clears: st.staging?.persistence });
            const calls = [];
            const gameTick = async ({ perTick, pending }) => {
                const r = await ev((a) => window.__lab.oraclePlay(a), { ...L8, perTick: perTick.map((k) => [...k]),
                    pending: { level: pending.level, tag: pending.tag } });
                calls.push({ pending: { level: pending.level, tag: pending.tag, source: pending.source }, ...r });
                out('O-play', calls.at(-1));
                if (!r.firstSeen) throw new Error(`the game never cleared {${pending.level},${pending.tag}} in ${perTick.length} ticks`);
                return { at: r.firstSeen.at, evidence: `live wasm, ${r.firstSeen.at} rows drained (previous sample ${r.lastBefore?.rows})` };
            };
            const makeRun = (persistence) => createRunForStaging({ ...st.staging, persistence: [...st.staging.persistence, ...persistence] },
                levelSource, { scratchPersistence: true });
            const t0 = Date.now();
            try {
                const two = await twoPassSolve({ makeRun, goals: [st.solverGoal], name: 'lab-oracle', boot: st.staging.boot, gameTick,
                    log: (m) => console.log(`INFO: ${m}`) });
                out('O-two', { ms: Date.now() - t0, passes: two.passes, declarations: two.declarations, ticks: two.out.perTick.length,
                    prefixChecks: two.prefixChecks });
            } catch (err) { out('O-two', { ms: Date.now() - t0, error: err.message.slice(0, 600) }); }
            out('O-plain', await ev((a) => window.__lab.oraclePlain(a), L8));
        } else if (ONLY === 'M') {
            const r = await ev(() => window.__lab.moonrock({ x: 160, y: 272,
                goal: { kind: 'exit', level: 0, tiles: [[16, 17]], name: 'owls_nest_stairs' } }));
            out('M', r);
        } else if (ONLY === 'S') {
            const file = arg('legs', '');
            const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
                .filter((r) => r.outcome === 'solved');
            const from = Number(arg('from', '0'));
            const limit = Number(arg('limit', String(rows.length)));
            const pick = rows.slice(from, from + limit);
            console.log(`INFO: ${pick.length} legs (of ${rows.length} solved)`);
            for (const [i, leg] of pick.entries()) {
                // eslint-disable-next-line no-await-in-loop
                let r;
                try { r = await ev((l) => window.__lab.sweepLeg(l), leg); } catch (err) {
                    r = { error: `evaluate: ${err.message.split('\n')[0]}`, consoleTail: logs.slice(-25) };
                    // The game EXITED (ExitStatus): every later call would throw — boot a fresh page and go on.
                    try { await boot(); } catch (e2) { console.log(`FAIL: reboot: ${e2.message}`); break; }
                }
                out('S', { i: from + i, level: leg.level, goal: leg.exit_id ?? leg.location, arrive: leg.arrive,
                    nodeKeys: leg.keys, nodeVerbs: leg.verbs, ...r });
            }
        }
    } catch (err) {
        console.log(`FAIL: ${err.message}`);
        console.log(logs.slice(-30).join('\n'));
    }
    console.log(`INFO: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s)`);
    await browser.close();
    process.exit(0);
}
