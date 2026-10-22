#!/usr/bin/env node
/**
 * probe-seedling-drill-mixed — ⛓⛓⛓ seedling-fidelity-drill: EVERY DRILL OF A MIXED ROOM (`CONTACT_FIDELITY.
 * drillMixedRooms`), PLAYED ON THE GAME AND COMPARED WITH THE MODEL TICK BY TICK.
 *
 * `Drill.solids` carries "Enemy" (`Drill.as:35`), so in L28 (two drills and a bobsoldier) a drill's hop can be refused
 * by the other drill or by the bobsoldier. Each witness (`fidelityDrill.DRILL_WITNESSES`) is played on a FRESH p4g page
 * (headless, the logic-only channel); every poll reads `botStatus` (the player) and `botMobiles` (the `Drill`, `Bob`
 * and `BobSoldier` rows), and the model replays the same tape with the key ON:
 *
 *   drill-l28-pair          boot (96,64), idle: `drill@128,96`'s x-hop refused by `drill@80,96` from t16
 *   drill-l28-cliffside     boot (240,192), the greedy walk toward (176,88): the drills never hop — at t65 the player
 *                           is 46.9 px from `drill@128,96` and its sight line crosses the CliffSide pixelmask at (160,112)
 *   drill-l91-bob           L91, boot (120,72), idle: from t49 `drill@64,80`'s x-hop refused by `bob@128,64`
 *   drill-l28-spear-l25     ROPESTANCE's failing run (the spear stance (136,72) from the L25 arrival, planned with the
 *                           drills unstepped): the game's hit at t59. Its keys come from `--plan=<tape.json>` (the plan
 *                           as ROPESTANCE made it) or from the recorded fixture.
 *
 * A sample is `{t, level, x, y, hits, drills: [{x, y, anim, …}], chasers: [{tag, x, y}]}`, the LAST poll of each tick;
 * the tape's final tick is dropped (the game runs on past a tape's end).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-drill-mixed.mjs                         # every witness: build, play, compare
 *   node scripts/procgen/probe-seedling-drill-mixed.mjs --only=drill-l28-pair
 *   node scripts/procgen/probe-seedling-drill-mixed.mjs --plan=<tape.json>      # drill-l28-spear-l25's keys
 *   node scripts/procgen/probe-seedling-drill-mixed.mjs --record                # also write fixtures/drill-witness/<name>.json
 *   node scripts/procgen/probe-seedling-drill-mixed.mjs --dump=60-66            # print both sides on those ticks
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. Takes the box lock.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { DRILL_WITNESS_DIR, DRILL_WITNESSES, compareDrillWitness, drillModelSamples, drillTape }
    from '../../frontend/modules/seedlingDemo/fidelityDrill.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** One poll (`botStatus` + `botMobiles`), folded to a sample. */
export function drillSampleOf(s, m) {
    const rows = m.mobiles ?? [];
    return {
        t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits ?? null,
        drills: rows.filter((r) => /Drill$/.test(r.cls)).map((r) => ({ x: r.x, y: r.y, anim: r.anim, destroy: r.destroy,
            onScreen: r.on_screen, hitsTimer: r.enemy?.hits_timer ?? null })),
        chasers: rows.filter((r) => /(^|:)(Bob|BobSoldier)$/.test(r.cls))
            .map((r) => ({ tag: /BobSoldier$/.test(r.cls) ? 'bobsoldier' : 'bob', x: r.x, y: r.y })),
    };
}

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
        if (Number.isInteger(s.tick) && m.tick === s.tick) byTick.set(s.tick, drillSampleOf(s, m));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const only = arg('only')?.split(',') ?? null;
    const RECORD = process.argv.includes('--record');
    const PLAN = arg('plan');
    takeBoxLockOrExit({ name: 'probe-seedling-drill-mixed.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    for (const w of DRILL_WITNESSES) {
        if (only && !only.includes(w.name)) continue;
        let tape;
        if (w.script.plan) {
            const fixture = join(DRILL_WITNESS_DIR, `${w.name}.json`);
            const src = PLAN ? JSON.parse(readFileSync(PLAN, 'utf8')) : (existsSync(fixture)
                ? JSON.parse(readFileSync(fixture, 'utf8')) : null);
            if (!src) { check(`${w.name}: a plan to replay (--plan=<tape.json> or the fixture)`, false); continue; }
            const t = src.tape ?? src;
            tape = { ...t, name: w.name, description: `seedling-fidelity-drill: ${w.name} — ${t.description ?? ''}` };
        } else {
            tape = await drillTape(w);
        }
        const model = await drillModelSamples(tape);
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
        const bad = compareDrillWitness(samples, model.samples, tape.boot.level);
        check(`${w.name}: the game reproduces the model at 0 px (player, drills, chasers) on all ${samples.length} `
            + 'sampled tick(s)', bad.length === 0, bad.slice(0, 4).join('; '));
        const hits = samples.filter((s, i) => i > 0 && s.hits > samples[i - 1].hits).map((s) => `t${s.t}`);
        console.log(`      ${w.name}: the game's hits land at [${hits.join(', ')}]; model drill events: `
            + `${model.events.filter((e) => e.kind !== 'contact').map((e) => `${e.t}:${e.id}:${e.kind}`).join(' ')}`);
        if (RECORD) {
            mkdirSync(DRILL_WITNESS_DIR, { recursive: true });
            const path = join(DRILL_WITNESS_DIR, `${w.name}.json`);
            writeFileSync(path, `${JSON.stringify({ name: w.name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-drill-mixed.mjs --record',
                end: { level: status.level, tick: status.tick }, tape, samples })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
