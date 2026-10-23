#!/usr/bin/env node
/**
 * probe-seedling-drill-kill — ⛓⛓⛓ seedling-fidelity-drillkill: THE SOLVER KILLS L28's DRILLS FIRST, THEN CUTS THE
 * ROPE (`CONTACT_FIDELITY.drillKillFirst`), PLAYED ON THE GAME AND COMPARED WITH THE MODEL TICK BY TICK.
 *
 * Each witness (`fidelityDrillKill.DRILLKILL_WITNESSES`) is played on a FRESH p4g page (headless, the logic-only
 * channel); every poll reads `botStatus` (the player) and `botMobiles` (every `Drill` with its `hits` / `hitsTimer`,
 * and the bobsoldier), and the model replays the same tape with the key ON:
 *
 *   drillkill-l28-sword-l25   the solver's plan from the L25 arrival, the Sword: `drill@128,96` killed, then the cut
 *   drillkill-l28-spear-l25   the same with the Spear (the cut ROPESTANCE refused at t59)
 *   drillkill-l28-sword-l26   from the L26 arrival, the Sword: both drills killed, then the cut
 *   drillkill-l28-spear-l26   the same with the Spear
 *   drillkill-l28-fire-l26    Fire at `drill@80,96` (scripted): its `hits` never move (`hitByFire` false)
 *
 * The goal witnesses' keys are the solver's plan at the time of the run (`twoPassSolve`, the key ON); `--record`
 * keeps the tape, so the replay test checks the recording against the model and, separately, that the solver still
 * makes the same plan.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-drill-kill.mjs                       # every witness: build, play, compare
 *   node scripts/procgen/probe-seedling-drill-kill.mjs --only=drillkill-l28-spear-l25
 *   node scripts/procgen/probe-seedling-drill-kill.mjs --record              # also write fixtures/drillkill-witness/
 *   node scripts/procgen/probe-seedling-drill-kill.mjs --dump=60-66          # print both sides on those ticks
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. Takes the box lock.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { DRILLKILL_WITNESS_DIR, DRILLKILL_WITNESSES, compareDrillKillWitness, drillKillModelSamples, drillKillSampleOf,
    drillKillTape } from '../../frontend/modules/seedlingDemo/fidelityDrillKill.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

async function playOnGame(page, tapeJson) {
    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const tape = parseTape(JSON.stringify(tapeJson));
    const bot = (n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge.game;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
    const started = await bot('botStart');
    if (started !== 'ok') throw new Error(`botStart: ${started}`);
    const byTick = new Map();
    const deadline = Date.now() + 600000;
    let status = null;
    while (Date.now() < deadline) {
        const raw = await page.evaluate(() => {
            const g = window.__swfBridge.game;
            return [String(g.botStatus()), String(g.botMobiles())];
        });
        const s = JSON.parse(raw[0]);
        const m = JSON.parse(raw[1]);
        if (Number.isInteger(s.tick) && m.tick === s.tick) byTick.set(s.tick, drillKillSampleOf(s, m));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const only = arg('only')?.split(',') ?? null;
    const RECORD = process.argv.includes('--record');
        takeBoxLockOrExit({ name: 'probe-seedling-drill-kill.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    for (const w of DRILLKILL_WITNESSES) {
        if (only && !only.includes(w.name)) continue;
        const { tape } = await drillKillTape(w);
        const model = await drillKillModelSamples(tape);
        check(`${w.name}: the model (key ON) replays the tape to its end`, model.error === null, model.error ?? '');
        const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
        let played;
        try {
            const page = await browser.newPage();
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
            await page.click('#btn-start');
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
                await page.waitForTimeout(250);
            }
            await assertLogicOnlyChannel(page);
            played = await playOnGame(page, tape);
        } finally {
            await browser.close();
        }
        const { status, samples } = played;
        const dump = arg('dump')?.split('-').map(Number) ?? null;
        if (dump) {
            for (const g of samples.filter((x) => x.t >= dump[0] && x.t <= dump[1])) {
                const m = model.samples[g.t];
                console.log(`      t${g.t} game p(${g.x}, ${g.y}) h${g.hits} drills ${JSON.stringify(g.drills)} chasers `
                    + `${JSON.stringify(g.chasers)}\n         model p(${m?.x}, ${m?.y}) h${m?.hits} drills `
                    + `${JSON.stringify(m?.drills)} chasers ${JSON.stringify(m?.chasers)}`);
            }
        }
        const bad = compareDrillKillWitness(samples, model.samples, tape.boot.level);
        check(`${w.name}: the game reproduces the model at 0 px (player, drills with hits, chasers) on all ${samples.length} `
            + 'sampled tick(s)', bad.length === 0, bad.slice(0, 4).join('; '));
        const hits = samples.filter((s, i) => i > 0 && s.hits > samples[i - 1].hits).map((s) => `t${s.t}`);
        const last = samples.at(-1);
        console.log(`      ${w.name}: the game's hits land at [${hits.join(', ')}]; its drills at the end `
            + `${JSON.stringify(last?.drills ?? [])}; model drill events: `
            + `${model.events.filter((e) => e.kind !== 'contact').map((e) => `${e.t}:${e.id}:${e.kind}`).join(' ')}; `
            + `model rope pulls ${JSON.stringify(model.pulls)}`);
        if (RECORD) {
            mkdirSync(DRILLKILL_WITNESS_DIR, { recursive: true });
            const path = join(DRILLKILL_WITNESS_DIR, `${w.name}.json`);
            writeFileSync(path, `${JSON.stringify({ name: w.name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-drill-kill.mjs --record',
                end: { level: status.level, tick: status.tick }, tape, samples })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
