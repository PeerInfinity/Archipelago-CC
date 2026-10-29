#!/usr/bin/env node
/**
 * probe-seedling-l12doors — ⛓⛓⛓ SEEDLING FIDELITY L12DOORS: THE SOLVER'S OWN L12 → L83 PLANS, PLAYED ON THE GAME
 * AND COMPARED WITH THE MODEL TICK BY TICK.
 *
 * Each witness (`plan-seedling-l12doors-witness.mjs` `L12DOORS_WITNESSES`) is the solver's plan under the slice's
 * switches, on rules-4's staging of survey step 172. It is played on a FRESH page of the game (p4g by default,
 * headless, the logic-only channel) on the DELIVERED level set, its every tick drained (`botDrain`), and compared at
 * 0 px with the model replaying the same tape with the witness's switches ON (OFF is reported, not checked). The game
 * must also write {12,12} and {12,7}, never {12,11}, end in L83 and never hit the player.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-l12doors.mjs                    # every witness: derive, play, compare
 *   node scripts/procgen/probe-seedling-l12doors.mjs --only=<name>[,…]  # some
 *   node scripts/procgen/probe-seedling-l12doors.mjs --from-fixture     # the committed tape, not a fresh derivation
 *   node scripts/procgen/probe-seedling-l12doors.mjs --record           # also write fixtures/l12doors-witness/
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. Takes the box lock.
 *
 * Run: node scripts/procgen/probe-seedling-l12doors.mjs [--only=l12doors-arrival,…] [--from-fixture] [--record]
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { readRun } from './probe-seedling-l12-bosslock.mjs';
import { L12DOORS_WITNESSES, L12DOORS_WITNESS_DIR, compareL12DoorsStreams, l12doorsFixture, l12doorsGameChecks,
    l12doorsModel, l12doorsTape, packL12DoorsTick } from './plan-seedling-l12doors-witness.mjs';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const RECORD = process.argv.includes('--record');
    const FROM_FIXTURE = process.argv.includes('--from-fixture');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) {
        console.log(`SKIP: no wasm artifact ${PAGE}`);
        process.exit(0);
    }
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const M = (p) => import(join(MODULE, p));
    const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const set = vanillaRecordSet(readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
        readJson('frontend/modules/flashPanel/atlases/seedling-map.json')).set;
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);
    takeBoxLockOrExit({ name: 'probe-seedling-l12doors.mjs', kind: 'browser' });

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const only = arg('only')?.split(',') ?? null;
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const call = (page, n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[name] !== 'function') return null;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    const waitFor = async (page, what, fn, ms, every = 250) => {
        for (const t0 = Date.now(); ;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(every);
        }
    };
    const clearedOf = (st) => (st?.persistence_cleared ?? []).map((c) => (typeof c === 'string' ? c : `${c.level}:${c.tag}`));
    const play = async (tape) => {
        const page = await browser.newPage();
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            await assertLogicOnlyChannel(page);
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const mounted = JSON.parse(await call(page, 'botLevelSet'));
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            let first = null;
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = JSON.parse(String(await page.evaluate(() => window.__swfBridge.game.botStatus())));
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                if (first === null && !st.arm?.pending && st.arm?.armed_at >= 0) first = clearedOf(st);
                return st?.finished ? st : null;
            }, 15 * 60 * 1000, 20);
            const drained = JSON.parse(await call(page, 'botDrain'));
            const ticks = (drained?.ticks ?? []).map((o) => ({ t: o.t, level: o.level, x: o.x, y: o.y }));
            return { mounted: mounted?.active ?? null, hits: status.hits ?? null, ticks,
                wrote: readRun(ticks, first ?? [], clearedOf(status)).wrote };
        } finally {
            await page.close();
        }
    };
    try {
        for (const w of L12DOORS_WITNESSES) {
            if (only && !only.includes(w.name)) continue;
            const raw = FROM_FIXTURE ? l12doorsFixture(w.name)?.tape : await l12doorsTape(w);
            if (!raw) throw new Error(`${w.name}: no committed recording to play (--from-fixture)`);
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const model = await l12doorsModel(raw, w.switches);
            const off = await l12doorsModel(raw, Object.fromEntries(Object.keys(w.switches).map((k) => [k, false])));
            console.log(`      ${w.name}: ${raw.tick_count} t; switches ${JSON.stringify(w.switches)}`);
            check(`${w.name}: the model (switches ON) replays the tape to its end`, model.error === null, model.error ?? '');
            const g = await play(tape);
            check(`${w.name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === raw.tick_count + 1 && g.mounted === set.set_id, `${g.ticks.length} obs, ${g.mounted}`);
            const bad = compareL12DoorsStreams(g.ticks, model.ticks);
            check(`${w.name}: the game reproduces the model (switches ON) at 0 px on all ${g.ticks.length} tick(s)`,
                bad.length === 0, bad.slice(0, 4).join('; '));
            check(`${w.name}: the game's hit count equals the model's (${model.hits})`, (g.hits ?? 0) === model.hits, `game ${g.hits}`);
            for (const c of l12doorsGameChecks(g)) check(`${w.name}: ${c.name}`, c.ok, c.detail);
            const badOff = off.error ? [] : compareL12DoorsStreams(g.ticks, off.ticks);
            console.log(`      ${w.name}: OFF the model ${off.error ? `refuses: ${off.error.slice(0, 220)}`
                : `parts from the game on ${badOff.length} tick(s)${badOff.length ? `, first ${badOff[0]}` : ''}`}`);
            if (RECORD) {
                mkdirSync(L12DOORS_WITNESS_DIR, { recursive: true });
                const path = join(L12DOORS_WITNESS_DIR, `${w.name}.json`);
                writeFileSync(path, `${JSON.stringify({ name: w.name, page: PAGE, set_id: set.set_id,
                    recordedBy: 'scripts/procgen/probe-seedling-l12doors.mjs --record', switches: w.switches,
                    hits: g.hits, wrote: g.wrote, tape: raw,
                    rows: '[t, level, x, y] — plan-seedling-l12doors-witness.packL12DoorsTick',
                    ticks: g.ticks.map(packL12DoorsTick) })}\n`);
                console.log(`recorded ${path.slice(REPO.length + 1)} — ${g.ticks.length} tick(s)`);
            }
        }
    } catch (e) {
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}
