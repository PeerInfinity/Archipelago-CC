#!/usr/bin/env node
/**
 * probe-seedling-fire-push — ⛓⛓⛓ seedling-fidelity-firepush: L40's BOSS KEY 2 BEHIND `pushableblockfire@576,576`, THE
 * ROOM'S PULSER MOVING IT (`CONTACT_FIDELITY.fireBlockPulseShove`), PLAYED ON THE GAME AND COMPARED WITH THE MODEL TICK
 * BY TICK.
 *
 * The witness (`fidelityFirePush.firePushTape`) is `r5-l40-part5`'s legs, 35 scripted Fire presses that park
 * `pushableblockfire@480,480` on button@768,400 {t 5}, and then the SOLVER's plan with the key ON (hold button@816,400
 * until pulser@592,576 has pushed the fire block west, shove the walk block north, collect the key), played on a FRESH
 * p4g page (headless, the logic-only channel); every poll reads `botStatus` (the player) and `botMobiles` (every
 * `PushableBlockFire` and `PushableBlock`), and the model replays the same tape with the key ON.
 *
 * `--record` keeps the tape and the game's rows, so the replay test checks the recording against the model and,
 * separately, that the solver still makes the same plan.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-fire-push.mjs              # build, play, compare
 *   node scripts/procgen/probe-seedling-fire-push.mjs --record     # also write fixtures/firepush-witness/
 *   node scripts/procgen/probe-seedling-fire-push.mjs --dump=60-66 # print both sides on those ticks
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
import { FIREPUSH_SWITCHES, FIREPUSH_WITNESS, FIREPUSH_WITNESS_DIR, compareFirePushWitness, firePushModelSamples,
    firePushSampleOf, firePushTape, packFirePushSample } from '../../frontend/modules/seedlingDemo/fidelityFirePush.js';

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
        if (Number.isInteger(s.tick) && m.tick === s.tick) byTick.set(s.tick, firePushSampleOf(s, m));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-fire-push.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const name = FIREPUSH_WITNESS;
    const { tape, out, prefixTape } = await firePushTape();
    const pulse = (out.records ?? []).find((r) => r.via === 'pulse') ?? null;
    console.log(`      ${name}: the prefix is ${prefixTape.tick_count} t, the plan ${out.perTick.length} t; its pulse `
        + `${pulse ? `shove held ${pulse.hold.heldFor} t on button@816,400 -> ${pulse.target} at (${pulse.to.tx},${pulse.to.ty})` : 'NONE'}`);
    const model = await firePushModelSamples(tape, FIREPUSH_SWITCHES);
    check(`${name}: the model (key ON) replays the tape to its end`, model.error === null, model.error ?? '');
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
            console.log(`      t${g.t} game p(${g.x}, ${g.y}) blocks ${JSON.stringify(g.blocks)} turrets ${JSON.stringify(g.turrets)}\n         model p(${m?.x}, `
                + `${m?.y}) blocks ${JSON.stringify(m?.blocks)}`);
        }
    }
    const bad = compareFirePushWitness(samples, model.samples);
    check(`${name}: the game reproduces the model at 0 px (the player, every pushable block) on all ${samples.length} `
        + 'sampled tick(s)', bad.length === 0, bad.slice(0, 4).join('; '));
    const at = (s, cls, x, y) => (s?.blocks ?? []).some((b) => b.cls === cls && b.x === x && b.y === y);
    const last = samples.at(-1);
    check(`${name}: the game ends with the fire block in the west pocket (560,576), the other on the t5 button (768,400) `
        + 'and the walk block at (576,512)', at(last, 'PushableBlockFire', 560, 576) && at(last, 'PushableBlockFire', 768, 400)
        && at(last, 'PushableBlock', 576, 512), JSON.stringify(last?.blocks ?? []));
    const corpse = samples.filter((g) => (g.turrets ?? []).some((c) => c.anim === 'dead'));
    // on (30,24) the corpse two-cycles (488,391.5) <-> (487.5,392); one tile short it is (488,407.5) <-> (487.5,408)
    const onT2 = (g) => (g.turrets ?? []).some((c) => c.anim === 'dead' && c.y < 400);
    const firstOnT2 = corpse.find(onT2);
    check(`${name}: the game's ice-turret corpse comes to rest on button@480,384 {t 2} and stays there`,
        firstOnT2 !== undefined && corpse.filter((g) => g.t >= firstOnT2.t).every(onT2),
        firstOnT2 ? `on it from t${firstOnT2.t} at ${JSON.stringify(firstOnT2.turrets)}` : 'never on it');
    const end = samples.at(-1);
    check(`${name}: the game's player ends on Boss Key 2's cell (41,33)`, end && Math.floor(end.x / 16) === 41
        && Math.floor(end.y / 16) === 33, end ? `(${end.x}, ${end.y})` : 'no sample');
    console.log(`      ${name}: the model's pulse pushes ${JSON.stringify(model.pushes)}; the game ends at L${status.level} `
        + `t${status.tick}`);
    if (RECORD) {
        mkdirSync(FIREPUSH_WITNESS_DIR, { recursive: true });
        const path = join(FIREPUSH_WITNESS_DIR, `${name}.json`);
        writeFileSync(path, `${JSON.stringify({ name, page: PAGE_NAME,
            recordedBy: 'scripts/procgen/probe-seedling-fire-push.mjs --record',
            end: { level: status.level, tick: status.tick }, tape,
            rows: '[t, level, x, y, blocks, corpse] — fidelityFirePush.packFirePushSample',
            samples: samples.map(packFirePushSample) })}\n`);
        console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
