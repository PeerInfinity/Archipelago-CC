#!/usr/bin/env node
/**
 * probe-seedling-rock-fire — ⛓⛓⛓ seedling-fidelity-rockfire: A FIRE PRESS REACHING A BREAKABLE ROCK, PLAYED ON THE GAME
 * AND COMPARED WITH THE MODEL TICK BY TICK.
 *
 * The witnesses (`fidelityRockFire.ROCKFIRE_TAPES`) hold the player against a rock and press once: L40's rockType-0
 * `breakablerock@176,128` with Fire (with and without the Ghost Sword held) and with the Sword (the control), and
 * L101's rockType-1 `breakablerockghost@224,96` with Fire, with and without the Ghost Sword. `genericHit`'s rock arm is
 * `(e as BreakableRock).hit(hasGhostSword ? 1 : 0)` for every `t`, so the AS3 says a Fire press breaks a rock exactly
 * when a swing would. Each tape is played on a FRESH p4g page (headless, the logic-only channel); every poll reads
 * `botStatus` (the player, and `persistence_cleared`: the tick `endAnim` writes the rock's flag). The rock's SOLID is
 * read through the player, held against it: x moves on the observation the cell opens. The model replays the same tape
 * (`--on=<k1,k2>` ON, the rest at their defaults).
 *
 *   --only=<n1,n2>  the witnesses to play (default: all of `ROCKFIRE_WITNESSES`)
 *   --on=<k1,k2>    contact-fidelity keys ON for the model's replay
 *   --record        write `fixtures/rockfire-witness/<name>.json` (the tape and the game's rows)
 *   --dump=a-b      print both sides on those ticks
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-rock-fire.mjs --on=fireRockArm
 *   node scripts/procgen/probe-seedling-rock-fire.mjs --record
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
import { ROCKFIRE_TAPES, ROCKFIRE_WITNESSES, ROCKFIRE_WITNESS_DIR, compareRockFireWitness, firstCleared,
    firstMoveAfter, packRockFireSample, rockFireModelSamples, rockFireSampleOf, rockFireTape,
} from '../../frontend/modules/seedlingDemo/fidelityRockFire.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

async function playOnGame(page, tapeJson, level) {
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
        if (Number.isInteger(s.tick)) byTick.set(s.tick, rockFireSampleOf(s, level));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t <= tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-rock-fire.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const over = Object.fromEntries((arg('on') ?? '').split(',').filter(Boolean).map((k) => [k, true]));
    const only = arg('only')?.split(',') ?? ROCKFIRE_WITNESSES;
    for (const name of only) {
        const spec = ROCKFIRE_TAPES[name];
        if (!spec) throw new Error(`unknown witness ${name}; known: ${ROCKFIRE_WITNESSES.join(', ')}`);
        const tape = await rockFireTape(name);
        const model = await rockFireModelSamples(tape, over);
        console.log(`      ${name}: ${tape.tick_count} t, ${spec.weapon} on input(s) ${[spec.press].flat().join(',')} at ${spec.rock}`
            + `${Object.keys(over).length ? ` (ON: ${Object.keys(over).join(', ')})` : ''}`);
        check(`${name}: the model replays the tape to its end`, model.error === null, model.error ?? '');
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
            played = await playOnGame(page, tape, spec.level);
        } finally {
            await browser.close();
        }
        const { status, samples } = played;
        const dump = arg('dump')?.split('-').map(Number) ?? null;
        if (dump) {
            for (const g of samples.filter((x) => x.t >= dump[0] && x.t <= dump[1])) {
                console.log(`      t${g.t} game ${JSON.stringify(packRockFireSample(g))} model ${JSON.stringify(model.samples[g.t] ?? null)}`);
            }
        }
        const inTape = samples.filter((g) => g.t < tape.tick_count);
        const gameOpen = firstMoveAfter(inTape, [spec.press].flat()[0] + 1);
        const gameWrite = firstCleared(inTape, spec.flag.tag);
        const rock = model.rocks.find((r) => r.id === spec.rock) ?? null;
        console.log(`      ${name}: the game — the cell opens on obs ${gameOpen}, {${spec.flag.level},${spec.flag.tag}} `
            + `first cleared on obs ${gameWrite}; the model — hitTick ${rock?.hitTick ?? '-'} goneAt ${rock?.goneAt ?? '-'}, `
            + `opens on obs ${firstMoveAfter(model.samples, [spec.press].flat()[0] + 1)}, written on obs `
            + `${firstCleared(model.samples, spec.flag.tag, 'written')}`);
        check(`${name}: on the game the rock ${spec.breaks ? 'BREAKS (the cell opens and its flag is written)' : 'does NOT break (the cell never opens, no flag is written)'}, as the AS3 reads`,
            spec.breaks ? (gameOpen !== null && gameWrite !== null) : (gameOpen === null && gameWrite === null),
            `opens ${gameOpen}, written ${gameWrite}`);
        const bad = model.error === null ? compareRockFireWitness(samples, model.samples, tape.tick_count, spec.rockTags) : ['the model threw'];
        check(`${name}: the game = the model at 0 px (the player; the rock's flag write) on every sampled tick before the tape's end (${inTape.length})`,
            bad.length === 0, `${bad.length} bad: ${bad.slice(0, 3).join('; ')}`);
        console.log(`      ${name}: the game ends at L${status.level} t${status.tick} p(${status.x}, ${status.y})`);
        if (RECORD) {
            mkdirSync(ROCKFIRE_WITNESS_DIR, { recursive: true });
            const path = join(ROCKFIRE_WITNESS_DIR, `${name}.json`);
            writeFileSync(path, `${JSON.stringify({ name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-rock-fire.mjs --record',
                end_status: { level: status.level, tick: status.tick },
                game: { opens: gameOpen, written: gameWrite }, tape,
                rows: '[t, level, x, y, cleared] — the tape level\'s cleared persistence tags `tag,tag` (fidelityRockFire.packRockFireSample)',
                samples: samples.map(packRockFireSample) })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
