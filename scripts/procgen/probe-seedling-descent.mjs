#!/usr/bin/env node
/**
 * Seedling fidelity DESCENT, D1: **A FALL'S DESCENT FIRES THE DOOR IT LANDS ON — ON THE GAME.**
 *
 * ⚖ The user (2026-10-05): L110's fall is not repointed; the MODEL is fixed so a
 * fall-from-ceiling descent fires a live teleporter/stairs it crosses, as the
 * game does (`seedlingDemo/fidelityDescent.js` states the rule).
 *
 * The arms of `fidelityDescent.DESCENT_ARMS` are each played on a fresh page
 * (one arm, one page, default build p4f, headless logic-only):
 *
 *   BUILT-IN   nothing mounted: L110's vanilla control lands its pit on L0's
 *              `stairsdown@256,272`, the only pit in the atlas that lands on a door
 *   DELIVERED  the set `vanillaRecordSet` delivers (`delivered`), or a PROBE
 *              variant of it (`delivered:<variant>`, `DESCENT_VARIANTS`): `approved`
 *              (the descent crosses L2's `stairsup@48,16` from above) and
 *              `latch-probe` (the landing tile on L2's `teleporter@48,96`, the drop
 *              on its `stairsup@48,16`: which one fires says where the arrival
 *              frame's `Teleporter.check()` saw the player)
 *   SOLVER     (`solver/builtin`, D3) the solver's own plan from L110's arrival
 *              (48,112) into its pit (`descentSolverArm`): the game must end in
 *              L2 (56,40) through L0's stairs
 *
 * Each arm reads the drained stream (`{t, x, y, level}` per tick), the transitions
 * DERIVED from its level changes, and `botStatus`. The model replays the same tape
 * on the same world and its stream is compared row by row, or its refusal is
 * recorded by name.
 *
 * `--record=<path>` writes the readings (`fixtures/descent-oracle.json`, which
 * `fidelityDescent.test.js` holds the model to). `--only=<tape>/<world>,...` picks
 * arms. Prints `PASS:`/`FAIL:`/`ROW` rows and `ALL CHECKS PASSED` / `N CHECK(S)
 * FAILED`. The PASS rows assert only what an arm must do to be a reading at all
 * (the page ran the tape to its end, on the set it asked for); what the game DID
 * is the recorded row.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the
 * wasm build (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: SEEDLING_PORT=9250 node scripts/procgen/probe-seedling-descent.mjs [--record=<path>]
 *        [--only=fall/builtin,fall/delivered:latch-probe]
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

/** The transitions a drained stream implies: one per level change, at the tick it shows. */
export function derivedTransitions(ticks) {
    const out = [];
    for (let i = 1; i < ticks.length; i += 1) {
        if (ticks[i].level !== ticks[i - 1].level) {
            out.push({ t: ticks[i].t, from: ticks[i - 1].level, to: ticks[i].level,
                at: { x: ticks[i].x, y: ticks[i].y } });
        }
    }
    return out;
}

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const { takeBoxLockOrExit } = await import('./boxLock.js');
    takeBoxLockOrExit({ name: 'probe-seedling-descent.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const F = await M('fidelityDescent.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const { gameVisibleTape } = await M('tapeFormat.js');
    const { runTape } = await M('tapeRunner.js');

    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE_NAME, 'game.html'))) {
        console.log(`SKIP: seedling wasm build ${PAGE_NAME} not staged`);
        process.exit(0);
    }
    const RECORD = process.argv.find((a) => a.startsWith('--record='))?.slice('--record='.length) ?? '';
    const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',').filter(Boolean) ?? null;
    const ARMS = F.DESCENT_ARMS.filter(([t, w]) => !ONLY || ONLY.includes(`${t}/${w}`));
    if (ONLY && ARMS.length !== ONLY.length) throw new Error(`--only: unknown arm(s) in ${ONLY.join(',')}`);
    let failed = 0;
    const check = (name, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const worlds = {};
    for (const [, w] of ARMS) worlds[w] ??= F.descentWorld(REPO, w);

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let proved = false;
    const call = (page, name, arg) => page.evaluate(([n, a]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[n] !== 'function') return null;
        return a === undefined ? g[n]() : g[n](a);
    }, [name, arg]);
    const json = async (page, name, arg) => {
        const raw = await call(page, name, arg);
        return raw === null ? null : JSON.parse(raw);
    };
    async function waitFor(page, what, fn, ms) {
        const t0 = Date.now();
        for (;;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(250);
        }
    }
    /** One arm: a fresh page, the set mounted (or not), one tape played to its end. */
    async function arm(set, tape) {
        const page = await browser.newPage();
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            let mounted = null;
            if (set) {
                const answers = [];
                for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
                if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
                mounted = await json(page, 'botLevelSet');
            }
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            const started = await call(page, 'botStart');
            if (started !== 'ok') throw new Error(`botStart: ${started}`);
            // 0.31 s/frame is the differential's headless budget; 451 dead frames is the beam.
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = await json(page, 'botStatus');
                return st?.finished ? st : null;
            }, Math.ceil((tape.tick_count + 451 + 25 + 60) * 0.31 * 1000) + 120000);
            const drained = await json(page, 'botDrain');
            const seam = await json(page, 'botSeam');
            return { status, drained, seam, mounted };
        } finally {
            await page.close();
        }
    }

    const oracle = {
        source: 'probe-seedling-descent.mjs --record (seedling fidelity DESCENT)',
        build: PAGE_NAME,
        variant_set_ids: Object.fromEntries(Object.entries(worlds).filter(([, w]) => w.set).map(([k, w]) => [k, w.set.set_id])),
        arms: [],
    };
    try {
        for (const [which, world] of ARMS) {
            const tape = F.DESCENT_TAPES[which]();
            const w = worlds[world];
            const label = `${which}/${world}`;
            const g = await arm(w.set, tape);
            const ticks = (g.drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level }));
            let model = null;
            try {
                const out = runTape(tape, { levelSource: w.levelSource });
                model = { ticks: out.ticks.map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })), refused: null };
            } catch (e) {
                model = { ticks: null, refused: e.message.split('\n')[0] };
            }
            let worst = null;
            let firstDiff = null;
            if (model.ticks) {
                worst = 0;
                const n = Math.min(model.ticks.length, ticks.length);
                for (let i = 0; i < n; i += 1) {
                    const a = ticks[i];
                    const b = model.ticks[i];
                    const d = a.level !== b.level ? Infinity : Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
                    if (d > worst) worst = d;
                    if (d > 0 && firstDiff === null) firstDiff = { i, game: a, model: b };
                }
                if (model.ticks.length !== ticks.length) worst = Infinity;
            }
            const row = {
                tape: which,
                world,
                mounted: g.mounted ? { active: g.mounted.active, table_levels: g.mounted.table_levels } : null,
                observations: ticks.length,
                transitions: derivedTransitions(ticks),
                final: ticks.at(-1) ?? null,
                dead_frames: g.status.dead_frames ?? null,
                error: g.status.error || '',
                model: {
                    refused: model.refused,
                    worst: worst === Infinity ? 'level-or-length' : worst,
                    first_diff: firstDiff,
                    transitions: model.ticks ? derivedTransitions(model.ticks) : null,
                },
                ticks,
            };
            oracle.arms.push(row);
            const { ticks: _t, ...shown } = row;
            console.log(`ROW ${label} ${JSON.stringify(shown)}`);
            check(`${label}: the game ran the tape to its end`, ticks.length === tape.tick_count + 1 && !row.error,
                `${ticks.length} obs, error ${JSON.stringify(row.error)}`);
            if (w.set) {
                check(`${label}: the set asked for is the one mounted`, g.mounted?.active === w.set.set_id,
                    JSON.stringify(row.mounted));
            }
        }
    } finally {
        await browser.close();
    }
    if (RECORD) {
        // ONE LINE PER ARM'S STREAM: `ticks` as `[t, x, y, level]` rows, so the
        // oracle stays a reviewable size (5 arms × ~150 rows).
        const marks = [];
        const text = JSON.stringify(oracle, (k, v) => {
            if (k !== 'ticks' || !Array.isArray(v)) return v;
            marks.push(JSON.stringify(v.map((o) => [o.t, o.x, o.y, o.level])));
            return `@@TICKS${marks.length - 1}@@`;
        }, 2).replace(/"@@TICKS(\d+)@@"/g, (_, i) => marks[Number(i)]);
        writeFileSync(RECORD, `${text}\n`);
        console.log(`RECORDED: ${RECORD}`);
    }
    console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
    process.exit(failed ? 1 : 0);
}
