#!/usr/bin/env node
/**
 * probe-seedling-fire-move — ⛓⛓⛓ seedling-fidelity-firemove: THE SOLVER'S OWN FIRE PRESSES
 * (`CONTACT_FIDELITY.fireBlockRoute`), PLAYED ON THE GAME AND COMPARED WITH THE MODEL TICK BY TICK.
 *
 * The witness is the route survey's step 94 (`Level 041 - Totem Part 240,144`) SOLVED with the key ON (and FIREPUSH's
 * three): its walk view tape — the crusher baited onto the cover's button, six solver-derived Fire presses parking
 * `pushableblockfire@112,144` on `button@176,176` {t 1}, the part collected through `wandlock@240,96`. It is played on
 * a FRESH p4g page (headless, the logic-only channel); every poll reads `botStatus` (the player) and `botMobiles` (every
 * `PushableBlockFire` and `PushableBlock`; a crusher is not a `Mobile`), and the model replays the same tape with the keys ON.
 *
 * `--record` writes `fixtures/firemove-witness/firemove-l41-part3.json` (the tape and the game's rows), which
 * `fidelityFireMove.test.js` replays against the model.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-fire-move.mjs --tape=<step-94-walk.json>           # play, compare
 *   node scripts/procgen/probe-seedling-fire-move.mjs --tape=<step-94-walk.json> --record  # also write the fixture
 *   node scripts/procgen/probe-seedling-fire-move.mjs                                       # the committed fixture's tape
 *   node scripts/procgen/probe-seedling-fire-move.mjs --dump=60-66                          # print both sides on those ticks
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. Takes the box lock.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FIREMOVE_L41, FIREMOVE_L41_WITNESS, FIREMOVE_SWITCHES, FIREMOVE_WITNESS_DIR, compareFireMoveWitness,
    fireMoveModelSamples, fireMoveSampleOf, packFireMoveSample } from '../../frontend/modules/seedlingDemo/fidelityFireMove.js';

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
    const deadline = Date.now() + 1200000;
    let status = null;
    while (Date.now() < deadline) {
        const raw = await page.evaluate(() => {
            const g = window.__swfBridge.game;
            return [String(g.botStatus()), String(g.botMobiles())];
        });
        const s = JSON.parse(raw[0]);
        const m = JSON.parse(raw[1]);
        if (Number.isInteger(s.tick) && m.tick === s.tick) byTick.set(s.tick, fireMoveSampleOf(s, m));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-fire-move.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const name = FIREMOVE_L41_WITNESS;
    const tapePath = arg('tape') ?? join(FIREMOVE_WITNESS_DIR, `${name}.json`);
    const raw = JSON.parse(readFileSync(tapePath, 'utf8'));
    const tape = { ...(raw.tape ?? raw), name };
    console.log(`      ${name}: ${tape.tick_count} t from ${tapePath.startsWith(REPO) ? tapePath.slice(REPO.length + 1) : tapePath}`);
    const model = await fireMoveModelSamples(tape, FIREMOVE_SWITCHES);
    check(`${name}: the model (keys ON) replays the tape to its end`, model.error === null, model.error ?? '');
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
            console.log(`      t${g.t} game p(${g.x}, ${g.y}) ${JSON.stringify(g.bodies)}\n         model p(${m?.x}, `
                + `${m?.y}) ${JSON.stringify(m?.bodies)}`);
        }
    }
    const bad = compareFireMoveWitness(samples, model.samples, FIREMOVE_L41.level);
    check(`${name}: the game reproduces the model at 0 px (the player, every pushable block) on all ${samples.length} `
        + 'sampled tick(s)', bad.length === 0, bad.slice(0, 4).join('; '));
    const onButton = (s) => (s?.bodies ?? []).some((b) => b.cls === 'PushableBlockFire'
        && b.x === FIREMOVE_L41.onto.tx * 16 && b.y === FIREMOVE_L41.onto.ty * 16);
    const firstOn = samples.find(onButton);
    check(`${name}: the game parks the fire block on button@176,176 (${FIREMOVE_L41.onto.tx},${FIREMOVE_L41.onto.ty})`,
        firstOn !== undefined, firstOn ? `from t${firstOn.t}` : 'never');
    console.log(`      ${name}: the game ends at L${status.level} t${status.tick}`);
    if (RECORD) {
        mkdirSync(FIREMOVE_WITNESS_DIR, { recursive: true });
        const path = join(FIREMOVE_WITNESS_DIR, `${name}.json`);
        writeFileSync(path, `${JSON.stringify({ name, page: PAGE_NAME,
            recordedBy: 'scripts/procgen/probe-seedling-fire-move.mjs --record',
            source: 'the route survey step 94 walk view, fireBlockRoute + FIREPUSH\'s three ON',
            end: { level: status.level, tick: status.tick }, tape,
            rows: '[t, level, x, y, bodies] — fidelityFireMove.packFireMoveSample',
            samples: samples.map(packFireMoveSample) })}\n`);
        console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
