#!/usr/bin/env node
/**
 * probe-seedling-ghost-rope — seedling-hammer-ghost-rope (GHOSTROPE): DOES THE GHOST SWORD CUT A ROPE ON THE GAME?
 *
 * Plays `ghostRopeWitness.GHOST_ROPE_WITNESSES` (L16's `rope@32,16`, one press from three distances, the ghost sword
 * and a plain-sword control) on a FRESH p4g page each (headless, the logic-only channel), and asks: is the rope's tag
 * {16,0} written (the cut), at which tick, and does the game's walk agree with the model's at 0 px on every tick?
 * See `ghostRopeWitness.js` for the AS3 lines and the four witnesses.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-ghost-rope.mjs                    # every witness: play, compare
 *   node scripts/procgen/probe-seedling-ghost-rope.mjs --only=ghostrope-l16-reach
 *   node scripts/procgen/probe-seedling-ghost-rope.mjs --record           # also write fixtures/ghost-rope-witness/<name>.json
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
import { sampleOf } from './probe-seedling-rope-verb.mjs';
import { GHOST_ROPE_TARGET, GHOST_ROPE_WITNESSES, GHOST_ROPE_WITNESS_DIR, ghostRopeModel, ghostRopeTape }
    from '../../frontend/modules/seedlingDemo/ghostRopeWitness.js';
import { compareWitness } from '../../frontend/modules/seedlingDemo/fidelityRope.js';

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
    takeBoxLockOrExit({ name: 'probe-seedling-ghost-rope.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    for (const w of GHOST_ROPE_WITNESSES) {
        if (only && !only.includes(w.name)) continue;
        const { tape } = await ghostRopeTape(w);
        const model = await ghostRopeModel(tape);
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
        const first = samples.find((s) => s.level === GHOST_ROPE_TARGET.level
            && s.cleared.includes(GHOST_ROPE_TARGET.tag))?.t ?? null;
        const pull = model.pulls[0] ?? null;
        if (w.cut) {
            check(`${w.name}: the game CUTS ${GHOST_ROPE_TARGET.id} — {16,0} written at the model's pull + 1`
                + `${pull ? ` (t${pull.t + 1})` : ''}`, pull !== null && first === pull.t + 1,
            `game first holds it at t${first}; model pull ${pull ? `t${pull.t}` : 'NONE'}; first test from `
                + `${JSON.stringify(model.testFrom)}`);
        } else {
            check(`${w.name}: the game does NOT cut ${GHOST_ROPE_TARGET.id} (and nor does the model)`,
                first === null && pull === null, `game first holds {16,0} at t${first}; model pull `
                    + `${pull ? `t${pull.t}` : 'NONE'}; first test from ${JSON.stringify(model.testFrom)}`);
        }
        check(`${w.name}: no hit on the game`, samples.every((s) => !s.hits),
            `max hits ${Math.max(0, ...samples.map((s) => s.hits ?? 0))}`);
        if (RECORD) {
            mkdirSync(GHOST_ROPE_WITNESS_DIR, { recursive: true });
            const path = join(GHOST_ROPE_WITNESS_DIR, `${w.name}.json`);
            writeFileSync(path, `${JSON.stringify({ name: w.name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-ghost-rope.mjs --record',
                end: { level: status.level, tick: status.tick }, cutAt: first, pull, testFrom: model.testFrom,
                tape, samples })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
