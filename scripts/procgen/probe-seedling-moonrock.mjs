#!/usr/bin/env node
/**
 * Seedling fidelity MOONROCK, D3: **THE DELIVERED SET'S MOONROCK, ON THE GAME.**
 *
 * ⚖ The user (2026-10-04): on the delivered set the moonrock event never fires
 * (L0's `<moonrock>` removed) and L110's fall reaches L2 —
 * `seedlingDemo/seedlingSetPatches.js`, which also says why the approved L110
 * repoint is NOT in the table (this probe's `approved` variant).
 *
 * The witness tapes of `seedlingDemo/fidelityMoonrock.js` (`MOONROCK_TAPES`)
 * are each played on fresh pages (one arm, one page, default build p4f,
 * headless logic-only):
 *
 *   DELIVERED  the set `vanillaRecordSet` delivers, mounted by `botLoadLevels`
 *              (the chunks `planLevelSetChunks` cuts, the panel's own planner);
 *              `--variants=` adds sets with other patch lists
 *              (`fidelityMoonrock.MOONROCK_VARIANTS`: `unpatched`, `approved`,
 *              `off-stairs`), each its own arm `delivered:<variant>`
 *   BUILT-IN   nothing mounted: the game's own table (the control — the atlas
 *              arms' world, and every committed tape's)
 *
 * Each arm reads the drained stream (`{t, x, y, level}` per tick), the
 * transitions DERIVED from its level changes, `botStatus` (`dead_frames`,
 * `persistence_cleared`) and the seam latch (`save.beam`, `save.rockSet`). The
 * model replays the same tape on the same world (the delivered set's mounted
 * records, or the built-in map) and its stream is compared row by row, or its
 * refusal is recorded by name.
 *
 * `--record=<path>` writes the readings (`fixtures/moonrock-oracle.json`, which
 * `fidelityMoonrock.test.js` holds the model to). `--only=` picks tapes. Prints `PASS:`/`FAIL:`/`ROW` rows and `ALL CHECKS PASSED` / `N CHECK(S)
 * FAILED`. The PASS rows assert only what an arm must do to be a reading at all
 * (the page ran the tape to its end); what the game DID is the recorded row.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the
 * wasm build (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: SEEDLING_PORT=9240 node scripts/procgen/probe-seedling-moonrock.mjs [--record=<path>]
 *        [--only=fall,fallRockSet,shield] [--variants=table,unpatched,approved,off-stairs] [--worlds=delivered,builtin]
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
    takeBoxLockOrExit({ name: 'probe-seedling-moonrock.mjs', kind: 'browser' });
    const { chromium } = await import('playwright');
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const F = await M('fidelityMoonrock.js');
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
    const ONLY = (process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length) ?? 'fall,fallRockSet,shield')
        .split(',').filter(Boolean);
    let failed = 0;
    const check = (name, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };

    const VARIANTS = (process.argv.find((a) => a.startsWith('--variants='))?.slice('--variants='.length) ?? 'table')
        .split(',').filter(Boolean);
    const WORLDS = (process.argv.find((a) => a.startsWith('--worlds='))?.slice('--worlds='.length) ?? 'delivered,builtin')
        .split(',').filter(Boolean);
    const delivered = F.deliveredMoonrockSet(REPO);
    const worlds = {};
    for (const w of WORLDS) {
        if (w === 'builtin') { worlds.builtin = { set: null, levelSource: F.builtInLevelSource(REPO) }; continue; }
        for (const v of VARIANTS) {
            const d = F.deliveredMoonrockSet(REPO, v);
            worlds[v === 'table' ? 'delivered' : `delivered:${v}`] = { set: d.set, levelSource: d.levelSource };
        }
    }

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
        source: 'probe-seedling-moonrock.mjs --record (seedling fidelity MOONROCK)',
        build: PAGE_NAME,
        delivered_set_id: delivered.set.set_id,
        variant_set_ids: Object.fromEntries(Object.entries(worlds).filter(([, w]) => w.set).map(([k, w]) => [k, w.set.set_id])),
        arms: [],
    };
    try {
        for (const which of ONLY) {
            const make = F.MOONROCK_TAPES[which];
            if (!make) throw new Error(`--only: no tape ${JSON.stringify(which)} (have ${Object.keys(F.MOONROCK_TAPES).join(', ')})`);
            const tape = make();
            for (const [world, w] of Object.entries(worlds)) {
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
                const save = g.seam?.seam ?? {};
                const row = {
                    tape: which,
                    world,
                    mounted: g.mounted ? { active: g.mounted.active, table_levels: g.mounted.table_levels } : null,
                    observations: ticks.length,
                    transitions: derivedTransitions(ticks),
                    final: ticks.at(-1) ?? null,
                    dead_frames: g.status.dead_frames ?? null,
                    error: g.status.error || '',
                    beam: save['save.beam'] ?? null,
                    rock_set: save['save.rockSet'] ?? null,
                    cleared_2_0: (g.status.persistence_cleared ?? []).some((r) => r.level === 2 && r.tag === 0),
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
                    check(`${label}: the delivered set is the one mounted`, g.mounted?.active === w.set.set_id,
                        JSON.stringify(row.mounted));
                }
            }
        }
    } finally {
        await browser.close();
    }
    if (RECORD) {
        // ONE LINE PER ARM'S STREAM: `ticks` as `[t, x, y, level]` rows, so the
        // oracle stays a reviewable size (15 arms × ~160 rows).
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
