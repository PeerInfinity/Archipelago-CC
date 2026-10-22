#!/usr/bin/env node
/**
 * probe-seedling-rope-stance — ⛓⛓⛓ seedling-fidelity-ropestance: THE `rope` VERB'S SPEAR AND FIRE CUTS
 * (`CONTACT_FIDELITY.ropeCutAnyWeapon`), ITS PLANS PLAYED ON THE GAME.
 *
 * The game cuts a `RopeStart` from all three weapons (`Player.genericHit` -> `RopeStart.hit()`): the sword's slash,
 * the spear's 32x5 thrust (no reach gate, no line test) and fire's 32x32 area with its 16 px radius cut. These tapes
 * are the solver's own plans for a `clear-tag` on the rope's tag with NO sword (`twoPassSolve`, `dashMode: 'all'`, both
 * switches ON), each played on a FRESH p4g page (headless, the logic-only channel) and compared with the model tick by
 * tick (`fidelityRopeStance.ROPESTANCE_WITNESSES`):
 *
 *   ropestance-l16-spear       L16 from the L15 arrival (32,64), the Spear alone: a thrust north at `rope@32,16`
 *   ropestance-l16-fire        the same with Fire alone: the nearest fire stance's walk refuses (bob@16,16), the
 *                              second (88,40) is walked and pressed
 *   ropestance-l28-fire        L28 from the L25 arrival (96,16), Fire alone: the plateau walk to (152,56), one press
 *   ropestance-l28-spear-east  a stand EAST of `rope@160,64` (240,72), the Spear alone: face west, one thrust (from the
 *                              L25 side every spear stance is in the unstepped `drill@128,96`'s hop range — the solver
 *                              refuses it by name; measured here: a hop and a hit at t59 the model never saw)
 *   ropestance-l28-wand-spear-east  the same stand, the Wand selected and the Spear held: the plan selects the spear's
 *                              slot for the thrust and restores the wand's
 *
 * A sample is `{t, level, x, y, hits, cleared}` (`cleared` = the boot level's persistence-cleared tags), the LAST poll of
 * each tick; the tape's final tick is dropped (the game runs on past a tape's end).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-rope-stance.mjs                     # every witness: plan, play, compare
 *   node scripts/procgen/probe-seedling-rope-stance.mjs --only=ropestance-l28-fire
 *   node scripts/procgen/probe-seedling-rope-stance.mjs --record            # also write fixtures/ropestance-witness/<name>.json
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
import { ROPESTANCE_WITNESS_DIR as ROPE_WITNESS_DIR, ROPESTANCE_WITNESSES as ROPE_WITNESSES, compareWitness,
    modelSamples, ropeStancePlan as ropePlan } from '../../frontend/modules/seedlingDemo/fidelityRopeStance.js';

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
    takeBoxLockOrExit({ name: 'probe-seedling-rope-stance.mjs', kind: 'browser' });
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
        check(`${w.name}: the plan cuts it with the ${w.weapon} (${cuts.map((c) => `${c.arm} ${c.weapon}`).join(', ')})`,
            cuts.length === 1 && cuts[0].weapon === w.weapon,
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
                recordedBy: 'scripts/procgen/probe-seedling-rope-stance.mjs --record',
                end: { level: status.level, tick: status.tick }, pull, tape, samples })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
