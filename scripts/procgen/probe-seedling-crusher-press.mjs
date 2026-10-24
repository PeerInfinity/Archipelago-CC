#!/usr/bin/env node
/**
 * probe-seedling-crusher-press — ⛓⛓⛓ seedling-fidelity-searchgaps D-A: THE SOLVER BAITS L41's CRUSHER ONTO THE COVER'S
 * BUTTON (`CONTACT_FIDELITY.crusherBaitPressGoal`), PLAYED ON THE GAME AND COMPARED WITH THE MODEL TICK BY TICK.
 *
 * Each witness (`fidelityCrusherPress.CRUSHERPRESS_WITNESSES`) is the solver's plan with the key ON (`solveSegment`, its
 * `forkRun`), cut where the bait ends, played on a FRESH p4g page (headless, the logic-only channel); every poll reads
 * `botStatus` (the player: x, y, level, hits) and the model replays the same tape:
 *
 *   crusherpress-l41-bait   the shield swing at (216,88), then R5's chains W,S,E: the crusher parks on
 *                           `button@248,232` and `cover@112,128` opens (the model's end state, asserted); then a walk
 *                           INTO the crusher's constructor cell (15,5) — the discriminator: on a game whose crusher
 *                           stayed home that cell is its body, and the stream would diverge there
 *
 * ⚠ The crusher is in no game readout, so the game's claim is the player's stream at 0 px and a player never hit (a
 * crusher contact is 1000 damage). `--record` keeps the tape and the samples, so `fidelityCrusherPress.test.js` checks the
 * recording against the model and, separately, that the solver still makes the same plan.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-crusher-press.mjs              # build, play, compare
 *   node scripts/procgen/probe-seedling-crusher-press.mjs --record     # also write fixtures/crusherpress-witness/
 *   node scripts/procgen/probe-seedling-crusher-press.mjs --dump=0-10  # print both sides on those ticks
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
import {
    CRUSHERPRESS_WITNESS_DIR, CRUSHERPRESS_WITNESSES, compareCrusherPressWitness, crusherPressModelSamples,
    crusherPressSampleOf, crusherPressTape,
} from '../../frontend/modules/seedlingDemo/fidelityCrusherPress.js';

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
        if (Number.isInteger(s.tick)) byTick.set(s.tick, crusherPressSampleOf(s));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-crusher-press.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    for (const w of CRUSHERPRESS_WITNESSES) {
        const { tape, cut, bait, refusal, probeTicks, probeReached } = await crusherPressTape(w);
        console.log(`      ${w.name}: the plan is cut at t${cut} (the bait from t${bait?.tick ?? '?'}), then the probe walk `
            + `into the crusher's home (${probeTicks} t); the solve itself refuses past the bait: `
            + `${(refusal ?? 'none').slice(0, 160)}`);
        check(`${w.name}: the model's probe walk reaches crusher@240,64's constructor cell (15,5)`, probeReached === true);
        const model = await crusherPressModelSamples(tape);
        check(`${w.name}: the model replays the tape to its end`, model.error === null, model.error ?? '');
        check(`${w.name}: the model ends with crusher@240,64 parked on button@248,232, 0 contacts, cover@112,128 open`,
            model.end?.crushers?.['crusher@240,64']?.x === 256 && model.end.crushers['crusher@240,64'].y === 240
                && model.end.parked === true && model.end.contacts === 0 && model.end.open.includes('cover@112,128'),
            JSON.stringify(model.end));
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
                console.log(`      t${g.t} game p(${g.x}, ${g.y}) h${g.hits}   model p(${m?.x}, ${m?.y}) h${m?.hits}`);
            }
        }
        const bad = compareCrusherPressWitness(samples, model.samples);
        check(`${w.name}: the game reproduces the model at 0 px (player x, y, level, hits) on all ${samples.length} sampled `
            + 'tick(s)', bad.length === 0, bad.slice(0, 4).join('; '));
        check(`${w.name}: the game's player is never hit (a crusher contact is 1000)`,
            samples.length > 0 && samples.every((s) => s.hits === 0), `hits ${[...new Set(samples.map((s) => s.hits))]}`);
        check(`${w.name}: the game sampled the tape to its end`, samples.at(-1)?.t >= tape.tick_count - 2,
            `last t${samples.at(-1)?.t} of ${tape.tick_count}`);
        if (RECORD) {
            mkdirSync(CRUSHERPRESS_WITNESS_DIR, { recursive: true });
            const path = join(CRUSHERPRESS_WITNESS_DIR, `${w.name}.json`);
            writeFileSync(path, `${JSON.stringify({ name: w.name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-crusher-press.mjs --record',
                end: { level: status.level, tick: status.tick }, cut, model: model.end, tape, samples })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
