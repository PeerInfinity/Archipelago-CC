#!/usr/bin/env node
/**
 * probe-seedling-spearrect — ⛓⛓ seedling-fidelity-spearrect: THE SPEAR'S TEST AS THE GAME RUNS IT
 * (`CONTACT_FIDELITY.spearGameTest`), PLAYED ON THE GAME AND COMPARED WITH THE MODEL.
 *
 * `Player.spear()` tests a 32x5 rect from the `int` origin with `Entity.collideRect`'s inclusive edges, with no reach
 * gate and no line test, on T+1, T+3 and T+5. Each witness (`fidelitySpearRect.SPEARRECT_WITNESSES`) is played on a
 * FRESH page of the default build (p4g, headless, the logic-only channel): the drained player stream and one
 * `botMobiles()` sample per game tick (every `Mobile`: class, x, y, anim, hits, hitsTimer, destroy). The model replays
 * the same tape with the key ON (it must reproduce the game) and OFF (it must not — the witness is why the key exists).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-spearrect.mjs                       # every witness: play, compare
 *   node scripts/procgen/probe-seedling-spearrect.mjs --only=spearrect-l65-block-edge
 *   node scripts/procgen/probe-seedling-spearrect.mjs --record              # also write fixtures/spearrect-witness/<name>.json
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. Takes the box lock.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import {
    SPEARRECT_WITNESS_DIR, SPEARRECT_WITNESSES, compareSpearRectWitness, spearRectModel, spearRectTape,
} from '../../frontend/modules/seedlingDemo/fidelitySpearRect.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** One `botMobiles()` row, folded. */
export function spearRectRowOf(r) {
    return { cls: r.cls.replace(/^.*[.:]/, ''), x: r.x, y: r.y, anim: r.anim ?? null, destroy: r.destroy ?? null,
        hits: r.enemy?.hits ?? null, hitsTimer: r.enemy?.hits_timer ?? null };
}

async function playOnGame(page, tapeJson, pageName) {
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
    const ticks = [];
    const samples = [];
    let status = null;
    const deadline = Date.now() + 600000;
    while (Date.now() < deadline) {
        const raw = await page.evaluate(() => {
            const g = window.__swfBridge.game;
            return [String(g.botMobiles()), String(g.botStatus()), String(g.botDrain())];
        });
        const m = JSON.parse(raw[0]);
        const s = JSON.parse(raw[1]);
        ticks.push(...(JSON.parse(raw[2]).ticks ?? []));
        const t = m.tick ?? s.tick;
        samples.push({ t, rows: (m.mobiles ?? []).map(spearRectRowOf) });
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    ticks.push(...(JSON.parse(await bot('botDrain')).ticks ?? []));
    const seen = new Set();
    const once = samples.filter((x) => Number.isInteger(x.t) && x.t < tape.tick_count && !seen.has(x.t) && seen.add(x.t));
    return { build: pageName, ticks, samples: once,
        status: { tick: status.tick, level: status.level, hits: status.hits ?? null, error: status.error ?? '' } };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const only = arg('only')?.split(',') ?? null;
    const RECORD = process.argv.includes('--record');
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE_NAME, 'game.html'))) {
        console.log(`SKIP: seedling wasm build ${PAGE_NAME} not staged`);
        process.exit(0);
    }
    takeBoxLockOrExit({ name: 'probe-seedling-spearrect.mjs', kind: 'browser' });
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    for (const w of SPEARRECT_WITNESSES) {
        if (only && !only.includes(w.name)) continue;
        const tape = await spearRectTape(w);
        const on = await spearRectModel(tape, { killLock: w.killLock });
        const off = await spearRectModel(tape, { over: { spearGameTest: false }, killLock: w.killLock });
        check(`${w.name}: the model (key ON) replays the tape to its end`, on.error === null, on.error ?? '');
        const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
        let game;
        try {
            const page = await browser.newPage();
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
            await page.click('#btn-start');
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
                await page.waitForTimeout(250);
            }
            await assertLogicOnlyChannel(page);
            game = await playOnGame(page, tape, PAGE_NAME);
        } finally {
            await browser.close();
        }
        const a = compareSpearRectWitness(game, on, w.classes);
        check(`${w.name}: ON, the game reproduces the model at 0 px — the player on all ${game.ticks.length} observation(s)`,
            a.player.length === 0, a.player.slice(0, 3).join('; '));
        check(`${w.name}: ON, every ${w.classes.join('/')} row the game samples is the model's (${a.compared} rows)`,
            a.bodies.length === 0, a.bodies.slice(0, 3).map((b) => `t${b.t} ${b.cls}: game [${b.game}] model [${b.model}]`).join('; '));
        const b = compareSpearRectWitness(game, off, w.classes);
        check(`${w.name}: OFF, the model does NOT reproduce the game (the witness for the key)`,
            b.bodies.length > 0 || b.player.length > 0,
            b.bodies.length ? `first t${b.bodies[0].t} ${b.bodies[0].cls}: game [${b.bodies[0].game}] model [${b.bodies[0].model}]`
                : (b.player[0] ?? 'OFF agrees everywhere'));
        if (RECORD) {
            mkdirSync(SPEARRECT_WITNESS_DIR, { recursive: true });
            const path = join(SPEARRECT_WITNESS_DIR, `${w.name}.json`);
            writeFileSync(path, `${JSON.stringify({ name: w.name, recordedBy: 'scripts/procgen/probe-seedling-spearrect.mjs --record',
                tape, game })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${game.ticks.length} observation(s), ${game.samples.length} sample(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
