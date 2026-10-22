#!/usr/bin/env node
/**
 * probe-seedling-rope-verb — ⛓⛓⛓ seedling-fidelity-rope: THE SOLVER'S `rope` VERB (`CONTACT_FIDELITY.ropeCutVerb`),
 * ITS PLANS PLAYED ON THE GAME.
 *
 * rules-2's `rules-rope-events` makes a cut rope a cross-visit event (`flag:L16:0` `rope@32,16`, `flag:L28:0`
 * `rope@160,64`) and asks the solver for a `clear-tag` on the rope's own tag. These tapes are the solver's own plans for
 * that goal (`twoPassSolve`, `dashMode: 'all'`, the switch ON), each played on a FRESH p4g page (headless, the
 * logic-only channel) and compared with the model tick by tick:
 *
 *   rope-l16-cut-cross   `r9-solve-16`'s staging (the L15 arrival (32,64), the Sword): clear-tag {16,0}, then
 *                        reach-exit `stairsup@352,80` → L18 — the cut, the three lanes silent after it, the exit
 *   rope-l16-verb        the same staging re-pointed at (72,40): the swing is the verb's own (`execPull`'s aim and
 *                        press), not the stance walk's strike
 *   rope-l28-cut         the staging re-pointed at L28's L25 arrival (96,16), the Sword alone, nothing cleared:
 *                        clear-tag {28,0} — the cut, and the rock's {28,1} written by `FallRock.fall` on the same frame
 *
 * A sample is `{t, level, x, y, hits, cleared}` (`cleared` = the boot level's persistence-cleared tags), the LAST poll of
 * each tick; the tape's final tick is dropped (the game runs on past a tape's end).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-rope-verb.mjs                     # every witness: plan, play, compare
 *   node scripts/procgen/probe-seedling-rope-verb.mjs --only=rope-l28-cut
 *   node scripts/procgen/probe-seedling-rope-verb.mjs --record            # also write fixtures/rope-witness/<name>.json
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
import { ROPE_WITNESS_DIR, ROPE_WITNESSES, compareWitness, modelSamples, ropePlan }
    from '../../frontend/modules/seedlingDemo/fidelityRope.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
/** One `botStatus` poll, folded to a sample. */
export function sampleOf(s, level) {
    return { t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits ?? null,
        cleared: (s.persistence_cleared ?? []).filter((c) => c.level === level).map((c) => c.tag).sort((a, b) => a - b) };
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
        const s = JSON.parse(await page.evaluate(() => String(window.__swfBridge.game.botStatus())));
        if (Number.isInteger(s.tick)) byTick.set(s.tick, sampleOf(s, tape.boot.level));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const only = arg('only')?.split(',') ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-rope-verb.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    for (const w of ROPE_WITNESSES) {
        if (only && !only.includes(w.name)) continue;
        const { solved, tape } = await ropePlan(w);
        const cuts = solved.out.records.filter((r) => r.goal === 'clear-tag');
        check(`${w.name}: the plan cuts it (${cuts.map((c) => c.arm).join(', ')})`, cuts.length === 1,
            `${solved.out.perTick.length} t, ledgerAt ${cuts[0]?.ledgerAt}, confirmedAt ${cuts[0]?.confirmedAt}`);
        const model = await modelSamples(tape);
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
        const bad = compareWitness(samples, model.samples);
        check(`${w.name}: the game reproduces the model at 0 px on all ${samples.length} sampled tick(s)`,
            bad.length === 0, bad.slice(0, 4).join('; '));
        check(`${w.name}: the walk ends in L${w.to}`, status.level === w.to, `game ends level ${status.level}`);
        const pull = model.pulls[0] ?? null;
        for (const tag of w.flags) {
            const first = samples.find((s) => s.level === tape.boot.level && s.cleared.includes(tag))?.t ?? null;
            const want = tag === 0 && pull ? pull.t + 1 : null;
            check(`${w.name}: the game writes {${tape.boot.level},${tag}}${want !== null ? ` at the model's pull + 1 (t${want})` : ''}`,
                first !== null && (want === null || first === want), `game first holds it at t${first}`);
        }
        check(`${w.name}: no hit on the game`, samples.every((s) => !s.hits), `max hits ${Math.max(0, ...samples.map((s) => s.hits ?? 0))}`);
        if (RECORD) {
            mkdirSync(ROPE_WITNESS_DIR, { recursive: true });
            const path = join(ROPE_WITNESS_DIR, `${w.name}.json`);
            writeFileSync(path, `${JSON.stringify({ name: w.name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-rope-verb.mjs --record',
                end: { level: status.level, tick: status.tick }, pull, tape, samples })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
