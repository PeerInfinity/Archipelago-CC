#!/usr/bin/env node
/**
 * Seedling solver-walk, slice W4 (plan `NewDocs/plans/seedling-wasm-solver-plan.md` §2.1/§3 W4) — the
 * live witness of the wasm ARRIVAL COMPOSITES and the fail-fast on an exact repeat, on `seedling_atlas`
 * (default build p4e, headless logic-only, under the box lock). Each leg is a host jump to an arrival the
 * committed atlas worlds name, then the wasm playback engine (`flashPanel/seedlingWasmPlayback.js`, built
 * the way the controller builds it) serves ONE exit goal there: forced re-arrival → freeze → worker solve →
 * one tape → watch. Measure only: nothing tracked changes.
 *
 *   D   the LATCHED DOORS (one composite tape: the walker's step-off ++ the solver's walk back, solved in
 *       the worker): the starter atlas's HOUSE DOOR from (48,64) and its two stairs, S5's five rooms — each
 *       crossed ON PLAN, producer `step-off`; ⛔ a divergence at the walker→solver JOIN is reported as a
 *       STOP (the seam-free proof failing). The closed pockets (L3 bare, L37 lava) fail BY NAME. The four
 *       `entrance_spawn` fallback arrivals (L34 lock, L43/L100 pit, L58 dead door) are NAMED, not fixed.
 *   T   the PIT exits: L48, L83, L84 fallen on plan (`reach-pit`; the fall is the game's crossing).
 *   X   the deterministic RESIDUE legs (§1.2: L28, L30, L45, L88 ×2): each fails BY NAME after 2 plans
 *       (1 forced re-arrival) — an exact repeat (same tick, same game row) — not after 4.
 *
 * Each session is a FRESH page (the wasm game runs out of memory after ~100–140 world swaps, §1.2).
 * ⛓ A host jump that CROSSES into a room the preset binds is re-placed by the region binding at the
 * region's arrival spawn (the house: (48,48), the game's own return spawn); the probe then jumps again
 * inside the room (no crossing, lands as asked) and checks the engine staged the arrival it named.
 * Prints `PASS:`/`FAIL:` rows, one `LEG {json}` per leg, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`
 * (exit 1 on a fail).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build
 * (the `flashPanel/wasm` submodule), or this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/probe-seedling-wasm-arrival-composites.mjs [--host=http://localhost:8000] [--only=D|T|X] [--legs=<name,name>]
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

const exit = (level, tiles, name) => ({ kind: 'exit', level, tiles, name });
/**
 * The legs, by session. `at` = the arrival (OEL spawn) the host jumps to; `expect` = what the leg must do:
 * `cross` (on plan, out of the room; `producer` the plan's), `closed` (the named closed-pocket refusal),
 * `named` (any named failure — recorded, not fixed), `repeat` (the exact-repeat failure after 2 plans).
 */
export const LEGS = {
    D: [
        { name: 'house door (seedling_atlas)', at: [86, 48, 64], goal: exit(86, [[3, 4]], 'door'), expect: 'cross', producer: 'step-off' },
        { name: 'L2 stairs_up (seedling_atlas)', at: [2, 48, 16], goal: exit(2, [[3, 1]], 'stairs_up'), expect: 'cross', producer: 'step-off' },
        { name: 'L3 stairs_up (seedling_atlas)', at: [3, 64, 0], goal: exit(3, [[4, 0]], 'stairs_up'), expect: 'cross', producer: 'step-off' },
        { name: 'S5 L87', at: [87, 432, 304], goal: exit(87, [[27, 19]], 'L87 door'), expect: 'cross', producer: 'step-off' },
        { name: 'S5 L101', at: [101, 96, 16], goal: exit(101, [[6, 1]], 'out_teleporter_104_24'), expect: 'cross', producer: 'step-off' },
        { name: 'S5 L102', at: [102, 224, 96], goal: exit(102, [[14, 6]], 'L102 door'), expect: 'cross', producer: 'step-off' },
        { name: 'S5 L106', at: [106, 64, 48], goal: exit(106, [[4, 3]], 'L106 door'), expect: 'cross', producer: 'step-off' },
        { name: 'S5 L109', at: [109, 160, 48], goal: exit(109, [[10, 3]], 'L109 door'), expect: 'cross', producer: 'step-off' },
        { name: 'closed L3 bare', at: [3, 96, 128], goal: exit(3, [[6, 8]], 'out_teleporter_96_128'), expect: 'closed' },
        { name: 'closed L37 lava', at: [37, 576, 144], goal: exit(37, [[36, 9]], 'out_stairsdown_576_144'), expect: 'closed' },
        { name: 'fallback L34 lock', at: [34, 128, 0], goal: exit(34, [[8, 0]], 'L34 door'), expect: 'named' },
        { name: 'fallback L43 pit', at: [43, 144, 64], goal: exit(43, [[9, 4]], 'out_teleporter_144_64'), expect: 'named' },
        { name: 'fallback L58 dead door', at: [58, 80, 16], goal: exit(58, [[5, 1]], 'out_teleporter_80_16'), expect: 'named' },
        { name: 'fallback L100 pit', at: [100, 288, 96], goal: exit(100, [[18, 6]], 'out_teleporter_288_96'), expect: 'named' },
    ],
    T: [
        { name: 'pit L48', at: [48, 176, 48], goal: exit(48, [[11, 3]], 'out_pit_2_2'), expect: 'cross', producer: 'solver' },
        { name: 'pit L83', at: [83, 32, 48], goal: exit(83, [[2, 1]], 'out_pit_2_2'), expect: 'cross', producer: 'solver' },
        { name: 'pit L84', at: [84, 16, 16], goal: exit(84, [[1, 1]], 'out_pit_2_3'), expect: 'cross', producer: 'solver' },
    ],
    X: [
        { name: 'residue L28', at: [28, 96, 16], goal: exit(28, [[0, 6]], 'out_teleporter_0_96'), expect: 'repeat' },
        { name: 'residue L30', at: [30, 16, 128], goal: exit(30, [[12, 3]], 'out_stairsdown_192_48'), expect: 'repeat' },
        { name: 'residue L45', at: [45, 112, 288], goal: exit(45, [[7, 0]], 'out_teleporter_112_0'), expect: 'repeat' },
        { name: 'residue L88 a', at: [88, 96, 288], goal: exit(88, [[2, 0]], 'out_teleporter_32_0'), expect: 'repeat' },
        { name: 'residue L88 b', at: [88, 96, 288], goal: exit(88, [[12, 0]], 'out_teleporter_192_0'), expect: 'repeat' },
    ],
};

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

/** In the PAGE: serve one exit goal with a fresh-per-page engine; resolve when it ends. */
async function serveLeg({ goal, budgetMs }) {
    const { getActivePanelInstance, getSeedlingRegionGlue } = await import('./modules/flashPanel/index.js');
    const panel = getActivePanelInstance();
    const glue = getSeedlingRegionGlue();
    const s = panel.seedlingPlaybackSurface();
    if (!window.__w4) {
        const mod = await import(new URL('modules/flashPanel/seedlingWasmPlayback.js', document.baseURI).href);
        const w4 = { notes: [], failed: null };
        w4.engine = await mod.loadWasmPlaybackEngine({ mapPath: s.wasm.mapPath, baseUrl: document.baseURI,
            getGame: s.wasm.getGame, getWin: s.wasm.getWin, teleport: s.wasm.teleport,
            getCheckBinding: () => glue?.checkBinding ?? null,
            onNote: (n) => { if (n) w4.notes.push(n); }, onFailed: (r) => { w4.failed = r; } });
        window.__w4 = w4;
    }
    const w4 = window.__w4;
    w4.failed = null;
    w4.notes = [];
    const engine = w4.engine;
    const h0 = engine.stats.history.length;
    const done0 = engine.stats.done;
    const answer = engine.walkTo(goal);
    const t0 = performance.now();
    let leftAt = null;
    let end = 'timeout';
    while (performance.now() - t0 < budgetMs) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => { setTimeout(r, 200); });
        if (!answer.ok) { end = 'refused'; break; }
        if (w4.failed) { end = 'failed'; break; }
        if (engine.stats.done > done0) { end = 'done'; break; }
        const lv = JSON.parse(s.wasm.getGame().readState()).level;
        const st = engine.status();
        if (lv !== goal.level && st.phase === 'playing') {
            leftAt ??= performance.now();
            // the plan's out-of-room tail drains on its own; give it a moment, then stop as the bot would
            if ((st.drained ?? 0) >= (st.ticks ?? Infinity) || performance.now() - leftAt > 5000) {
                engine.stop();
                end = 'crossed';
                break;
            }
        }
    }
    // ⛓ W7 — a LOCATION plan now ends HELD (the room stays the engine's between goals), and a held room blocks the
    // next leg's host jump (W0 i.11). This witness serves one leg at a time, so it pauses the engine after every
    // leg — the bot's ⏸ (`stop()` releases the hold).
    if (end !== 'crossed') engine.stop();
    const stats = JSON.parse(JSON.stringify(engine.stats));
    const st = JSON.parse(s.wasm.getGame().botStatus());
    const arr = engine.arrivalReads.at(-1) ?? null;
    return { answer, end, failed: w4.failed, notes: w4.notes.slice(-6), legs: stats.history.slice(h0),
        arrivedAt: arr ? { level: arr.status?.level, x: arr.state?.playerPositionX, y: arr.state?.playerPositionY } : null,
        forced: stats.forced, ships: stats.ships, level: st.level, armed: st.armed, held: st.held,
        ms: Math.round(performance.now() - t0) };
}

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-arrival-composites.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const ONLY = arg('only', '');
    const PICK = arg('legs', '').split(',').filter(Boolean);
    const GAME = 'seedling_atlas';
    const PRESET = JSON.parse(readFileSync(join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const WASM_PAGE = PRESET.flash_panel?.wasm ?? '';
    if (!WASM_PAGE || !existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    for (const SESSION of ONLY ? [ONLY] : ['D', 'T', 'X']) {
        const legs = LEGS[SESSION].filter((l) => PICK.length === 0 || PICK.some((p) => l.name.includes(p)));
        if (legs.length === 0) continue;
        console.log(`INFO: ── session ${SESSION} (${legs.length} legs, a fresh page) ──`);
        // eslint-disable-next-line no-await-in-loop
        failed += await runSession(SESSION, legs);
    }
    await browser.close();
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

    async function runSession(SESSION, legs) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `w4-${SESSION}` });
        const { check } = rp;
        try {
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
            for (const leg of legs) {
                const [level, x, y] = leg.at;
                // ⛓ Where the jump really landed. A jump that CROSSES into a room the preset binds is a crossing
                // to the region binding, which re-places the player at the region's arrival spawn (measured on
                // seedling_atlas: 86 (48,64) → (48,48), L2 (48,16) → (48,32), L3 (96,128) → (64,16)). A jump
                // inside the SAME level is no crossing, so a second jump lands as asked. ⛔ The re-placement is
                // WAITED FOR (`jumpSettled`), never timed: a fixed 1200 ms read raced it (W7's L3 bare red).
                // eslint-disable-next-line no-await-in-loop
                const landed = await rp.jumpSettled(level, x, y);
                // eslint-disable-next-line no-await-in-loop
                const r = await page.evaluate(serveLeg, { goal: leg.goal, budgetMs: leg.expect === 'repeat' ? 150000 : 90000 });
                const plays = r.legs.filter((h) => h.outcome !== 'failed');
                const last = r.legs.at(-1) ?? {};
                console.log(`LEG ${JSON.stringify({ session: SESSION, name: leg.name, expect: leg.expect, end: r.end, failed: r.failed,
                    answer: r.answer, level: r.level, ms: r.ms, arrivedAt: r.arrivedAt, landed, legs: r.legs.map((h) => ({ outcome: h.outcome, producer: h.producer,
                        stepOff: h.stepOff ?? null, ticks: h.ticks, drained: h.drained, verbs: h.verbs, divergence: h.divergence,
                        recovery: h.recovery, solvedMs: h.solvedMs })) })}`);
                const dv = r.legs.map((h) => h.divergence).filter(Boolean);
                check(`${SESSION} ${leg.name}: the engine staged the arrival at (${x}, ${y}) in L${level}`,
                    r.arrivedAt?.level === level && r.arrivedAt.x === x && r.arrivedAt.y === y, JSON.stringify({ landed, arrivedAt: r.arrivedAt }));
                // ⛔ STOP: a divergence at the walker→solver JOIN of a composite is the seam-free proof failing.
                const joinHit = r.legs.find((h) => h.divergence && h.stepOff && Math.abs(h.divergence.t - h.stepOff.ticks) <= 1);
                if (joinHit) console.log(`STOP: a composite diverged at its JOIN (t=${joinHit.divergence.t}, join ${joinHit.stepOff.ticks}): ${JSON.stringify(joinHit.divergence)}`);
                if (leg.expect === 'cross') {
                    check(`${SESSION} ${leg.name}: crossed ON PLAN out of L${level} (producer ${leg.producer}, 0 divergences, 1 plan)`,
                        r.answer.ok && ['crossed', 'done'].includes(r.end) && r.level !== level && dv.length === 0
                            && plays.length === 1 && (plays[0].producer ?? 'solver') === leg.producer
                            && (plays[0].drained ?? 0) > (plays[0].stepOff?.ticks ?? 0),
                        JSON.stringify({ end: r.end, level: r.level, failed: r.failed, legs: plays.map((h) => [h.outcome, h.producer, h.ticks, h.drained, h.stepOff?.ticks]) }));
                    check(`${SESSION} ${leg.name}: no JOIN divergence`, !joinHit, JSON.stringify(joinHit?.divergence ?? null));
                } else if (leg.expect === 'closed') {
                    check(`${SESSION} ${leg.name}: refused BY NAME as a closed pocket (no cell next to the door can be walked to)`,
                        r.end === 'failed' && /no cell next to it can be walked to/.test(r.failed ?? '') && plays.length === 0,
                        String(r.failed));
                } else if (leg.expect === 'named') {
                    check(`${SESSION} ${leg.name}: an entrance_spawn fallback arrival — NAMED (a failure by name), not fixed`,
                        ['failed', 'refused'].includes(r.end) && typeof (r.failed ?? r.answer.reason) === 'string',
                        String(r.failed ?? r.answer.reason));
                } else if (leg.expect === 'repeat') {
                    check(`${SESSION} ${leg.name}: fails BY NAME on an EXACT repeat after 2 plans (1 forced re-arrival), not 4`,
                        r.end === 'failed' && /at the SAME tick with the SAME game row 2 times in a row/.test(r.failed ?? '')
                            && JSON.stringify(r.legs.map((h) => h.outcome)) === JSON.stringify(['diverged', 'failed']),
                        JSON.stringify({ end: r.end, failed: r.failed, outcomes: r.legs.map((h) => h.outcome) }));
                }
                check(`${SESSION} ${leg.name}: nothing of ours left armed or held`, !r.armed && !r.held, JSON.stringify({ armed: r.armed, held: r.held }));
            }
            const exits = logs.filter((l) => /heap_alloc|ExitStatus|out of memory/.test(l));
            if (exits.length) console.log(`INFO: the game's memory: ${exits.slice(-3).join(' | ')}`);
        } catch (e) {
            check(`fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
        }
        await page.close();
        return rp.failures();
    }
}
