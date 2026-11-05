/**
 * probe-seedling-rock-gone — ⛓⛓⛓ seedling-fidelity-knockback376 D1: THE TICK A BROKEN `BreakableRock` STOPS BEING
 * SOLID, PLAYED ON THE GAME AND COMPARED WITH THE MODEL TICK BY TICK (`CONTACT_FIDELITY.rockGoneFencepost`).
 *
 * Each short witness (`fidelityRockGone.ROCKGONE_TAPES`) is played on a FRESH p4g page (headless, the logic-only
 * channel); every poll reads `botStatus` (the player, and the swing's own counters `Bot.slashTests` / `slashHits`).
 * The player holds `left` against `breakablerock@176,128` and swings; the observation x first leaves the pinned
 * column is the tick the game freed the cell. The model replays the same tape with the switch ON (it must equal the
 * game at 0 px on every observation) and OFF (it frees the cell two observations early).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-rock-gone.mjs                     # every witness: build, play, compare
 *   node scripts/procgen/probe-seedling-rock-gone.mjs --only=<name>[,…]   # some
 *   node scripts/procgen/probe-seedling-rock-gone.mjs --record            # also write fixtures/rockgone-witness/
 *   node scripts/procgen/probe-seedling-rock-gone.mjs --dump=15-22        # print both sides on those ticks
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. Takes the box lock.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import {
    ROCKGONE_TAPES, ROCKGONE_WITNESS_DIR, compareRockGoneWitness, firstMoveAfter, firstTestAfter, packRockGoneSample,
    rockGoneModelSamples, rockGoneSampleOf, rockGoneTape,
} from '../../frontend/modules/seedlingDemo/fidelityRockGone.js';
import { withContactFidelity } from '../../frontend/modules/seedlingDemo/contactFidelity.js';

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
        if (Number.isInteger(s.tick)) byTick.set(s.tick, rockGoneSampleOf(s));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t <= tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-rock-gone.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const only = arg('only')?.split(',') ?? Object.keys(ROCKGONE_TAPES);
    for (const name of only) {
        const spec = ROCKGONE_TAPES[name];
        if (!spec) throw new Error(`unknown witness ${name}; known: ${Object.keys(ROCKGONE_TAPES).join(', ')}`);
        const tape = await rockGoneTape(name);
        const on = await withContactFidelity({ rockGoneFencepost: true }, () => rockGoneModelSamples(tape));
        const off = await withContactFidelity({ rockGoneFencepost: false }, () => rockGoneModelSamples(tape));
        check(`${name}: the model replays the tape to its end (ON and OFF)`, on.error === null && off.error === null,
            on.error ?? off.error ?? '');
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
                console.log(`      t${g.t} game ${JSON.stringify(g)}\n         ON ${JSON.stringify(on.samples[g.t])}`
                    + `\n         OFF ${JSON.stringify(off.samples[g.t])}`);
            }
        }
        const lastPress = Math.max(...spec.presses);
        const gameOpen = firstMoveAfter(samples, lastPress + 1);
        const onOpen = firstMoveAfter(on.samples.filter(Boolean), lastPress + 1);
        const offOpen = firstMoveAfter(off.samples.filter(Boolean), lastPress + 1);
        const rock = on.samples.at(-1)?.rocks.find((r) => r.id === 'breakablerock@176,128') ?? null;
        console.log(`      ${name}: ${tape.tick_count} t; press(es) ${spec.presses.join(',')}; the game's first swing `
            + `test after the last press on obs ${firstTestAfter(samples, lastPress)}; the model's hitTick `
            + `${rock?.hitTick ?? '-'} goneAt(ON) ${rock?.goneAt ?? '-'}; the cell opens: game obs ${gameOpen}, `
            + `model ON ${onOpen}, OFF ${offOpen}`);
        const bad = compareRockGoneWitness(samples, on.samples, tape.tick_count);
        check(`${name}: the game = the model (key ON) at 0 px on every sampled tick before the tape's end (${samples.filter((g) => g.t < tape.tick_count).length})`, bad.length === 0,
            bad.slice(0, 4).join('; '));
        check(`${name}: OFF the model frees the cell two observations before the game`, offOpen === gameOpen - 2,
            `game ${gameOpen}, OFF ${offOpen}`);
        if (RECORD) {
            mkdirSync(ROCKGONE_WITNESS_DIR, { recursive: true });
            const path = join(ROCKGONE_WITNESS_DIR, `${name}.json`);
            writeFileSync(path, `${JSON.stringify({ name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-rock-gone.mjs --record',
                end: { level: status.level, tick: status.tick }, tape,
                rows: '[t, level, x, y, hits, slashTests, slashHits] — fidelityRockGone.packRockGoneSample',
                samples: samples.map(packRockGoneSample) })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
