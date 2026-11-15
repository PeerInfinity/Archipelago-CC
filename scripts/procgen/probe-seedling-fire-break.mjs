#!/usr/bin/env node
/**
 * probe-seedling-fire-break — ⛓⛓⛓ seedling-fidelity-firebreak (wave 40): THE `break` VERB'S FIRE ARM
 * (`CONTACT_FIDELITY.fireBreakArm`), ITS PLANS PLAYED ON THE GAME.
 *
 * The game breaks an ordinary BreakableRock under a Fire press with or without the Ghost Sword (`Player.fire()` ->
 * `genericHit` -> `BreakableRock.hit(hasGhostSword ? 1 : 0)`; ROCKFIRE's witness, `probe-seedling-rock-fire.mjs`). These
 * tapes are the SOLVER's own plans for a run that holds Fire and NO Sword (`twoPassSolve`, `dashMode: 'all'`, the switch
 * ON), each played on a FRESH p4g page (headless, the logic-only channel) and compared with the model tick by tick
 * (`fidelityFireBreak.FIREBREAK_WITNESSES`): the player at 0 px, the hits, and each rock's persistence write.
 *
 * A sample is `{t, level, x, y, hits, cleared}` (`cleared` = the boot level's persistence-cleared tags), the LAST poll of
 * each tick; the tape's final tick is dropped (the game runs on past a tape's end).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-fire-break.mjs                      # every witness: plan, play, compare
 *   node scripts/procgen/probe-seedling-fire-break.mjs --only=firebreak-l0-rock-west
 *   node scripts/procgen/probe-seedling-fire-break.mjs --record             # also write fixtures/firebreak-witness/<name>.json
 *   node scripts/procgen/probe-seedling-fire-break.mjs --set=rules          # ⛓ RULES rules-fire-breaks-rocks: the rule's
 *                                                                           # own witnesses (`FIREBREAK_RULES_WITNESSES`)
 *   node scripts/procgen/probe-seedling-fire-break.mjs --set=rules-refused  # the rows the solver will not plan: each refusal
 *                                                                           # printed (`FIREBREAK_RULES_REFUSED`), no page
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
import { FIREBREAK_RULES_REFUSED, FIREBREAK_RULES_WITNESSES, FIREBREAK_WITNESS_DIR, FIREBREAK_WITNESSES, compareFireBreak, fireBreakModelSamples, fireBreakPlan,
    fireBreakSampleOf } from '../../frontend/modules/seedlingDemo/fidelityFireBreak.js';

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
        const s = JSON.parse(await page.evaluate(() => String(window.__swfBridge.game.botStatus())));
        if (Number.isInteger(s.tick)) byTick.set(s.tick, fireBreakSampleOf(s, tape.boot.level));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const only = arg('only')?.split(',') ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-fire-break.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const SET = arg('set') ?? 'fidelity';
    const SETS = { fidelity: FIREBREAK_WITNESSES, rules: FIREBREAK_RULES_WITNESSES, 'rules-refused': FIREBREAK_RULES_REFUSED };
    if (!SETS[SET]) throw new Error(`--set=${SET}: the sets are ${Object.keys(SETS).join(', ')}`);
    for (const w of SETS[SET]) {
        if (only && !only.includes(w.name)) continue;
        if (SET === 'rules-refused') {
            const refusal = await fireBreakPlan(w).then(() => null, (e) => String(e.message).split('\n')[0].slice(0, 400));
            check(`${w.name}: the solver refuses to plan it with ${w.items.join(' + ')}`, refusal !== null, refusal ?? 'it PLANNED: move it to FIREBREAK_RULES_WITNESSES and play it');
            continue;
        }
        const { solved, tape } = await fireBreakPlan(w);
        const breaks = solved.out.records.filter((r) => r.strategy === 'break' || r.verb === 'break');
        const wanted = w.breaks ?? w.rocks.map((r) => r.id);
        check(`${w.name}: the plan breaks ${wanted.join(', ')} with Fire`,
            wanted.length > 0 && wanted.every((id) => breaks.some((b) => b.target === id && b.weapon === 'fire')),
            `${solved.out.perTick.length} t; ${breaks.map((b) => `${b.target} ${b.weapon} press t${b.pressedAt} from `
                + `(${b.stance ? `${b.stance.x},${b.stance.y}` : 'the live position'})${b.lean ? ` lean ${b.lean}` : ''}`).join('; ')}`);
        const model = await fireBreakModelSamples(tape);
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
        const tags = w.rocks.map((r) => r.tag);
        const bad = compareFireBreak(samples, model.samples, tags);
        check(`${w.name}: the game reproduces the model at 0 px on all ${samples.length} sampled tick(s) (player, hits, rock flags)`,
            bad.length === 0, bad.slice(0, 4).join('; '));
        check(`${w.name}: the walk ends in L${w.to}`, status.level === w.to, `game ends level ${status.level}`);
        for (const r of w.rocks) {
            const first = samples.find((s) => s.level === tape.boot.level && s.cleared.includes(r.tag))?.t ?? null;
            const rock = model.rocks.find((k) => k.id === r.id) ?? null;
            check(`${w.name}: the game writes {${tape.boot.level},${r.tag}} at the model's goneAt + 1`
                + `${rock ? ` (t${rock.goneAt + 1})` : ''}`, rock !== null && first === rock.goneAt + 1,
            `game first holds it at t${first}; model hit t${rock?.hitTick}, goneAt t${rock?.goneAt}`);
        }
        check(`${w.name}: no hit on the game`, samples.every((s) => !s.hits), `max hits ${Math.max(0, ...samples.map((s) => s.hits ?? 0))}`);
        if (RECORD) {
            mkdirSync(FIREBREAK_WITNESS_DIR, { recursive: true });
            const path = join(FIREBREAK_WITNESS_DIR, `${w.name}.json`);
            writeFileSync(path, `${JSON.stringify({ name: w.name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-fire-break.mjs --record',
                end: { level: status.level, tick: status.tick }, rocks: model.rocks, tape, samples })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
