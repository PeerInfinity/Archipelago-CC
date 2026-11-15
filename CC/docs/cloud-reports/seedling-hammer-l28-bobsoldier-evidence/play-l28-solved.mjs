#!/usr/bin/env node
// EVIDENCE (slice seedling-hammer-l28-bobsoldier). Nothing tracked is edited. ROCK-HOLDER-WAIT's
// `play-wait-prefix.mjs`, with one more switch: `--sight=1` (default) turns `KILL_STANCE_SIGHT` ON.
//
// The solver's OWN plan for L28 → the L30 door from state (136,296), {28,0}+{28,1} cleared, with
// `SEEDLING_RESTING_HOLDER` and `fallRockHoldsButton` ON (and `KILL_STANCE_SIGHT` per `--sight`), captured tick by
// tick (`run.advance`'s input) up to `--cut` (default: the whole solve, every tick the solver stepped).
// Then: a staged tape (`buildStagedTape`), the model's samples (`rockButtonModelSamples`, the switch ON), and a FRESH
// p4g page (headless logic-only, the box lock): `compareRockButton` (player 0 px, level, hits, L28 flags).
//
//   node CC/docs/cloud-reports/seedling-hammer-l28-bobsoldier-evidence/play-l28-solved.mjs [--sight=1] [--cut=<all>] [--idle=0] [--out=<json>]
//   (`--idle=N` appends N empty ticks after the cut: the model and the game then run on past the solver's last key)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.ARCHCC_ROOT ?? '/home/user/Archipelago-CC';
const MODULE = join(ROOT, 'frontend/modules/seedlingDemo');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const SIGHT = (args.sight ?? '1') === '1';

const { takeBoxLockOrExit } = await import(join(ROOT, 'scripts/procgen/boxLock.js'));
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(ROOT, 'scripts/procgen/headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(ROOT, 'scripts/procgen/seedlingChannel.js'));
const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
const { arrivalStaging } = await import(join(MODULE, 'fidelityArrival.js'));
const SB = await import(join(MODULE, 'solverBot.js'));
const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { L28, compareRockButton, rockButtonModelSamples, rockButtonSampleOf } = await import(join(MODULE, 'fidelityRockButton.js'));

const boot = { level: 28, x: 128, y: 288 };
const staging = arrivalStaging(boot, { items: ['hasSword'], cleared: [0, 1] });

// 1. the solver's own keys, captured
const perTick = [];
let solve = null;
SB.withKillStanceSight(SIGHT, () => SB.withRestingHolder(true, () => withContactFidelity({ fallRockHoldsButton: true }, () => {
    const run = createRunForStaging(staging, atlasLevelSource());
    const advance = run.advance.bind(run);
    run.advance = (...a) => {
        if (a.length !== 1) throw new Error(`advance with ${a.length} args at t${run.ticksCompleted}`);
        perTick.push(new Set(a[0]));
        return advance(...a);
    };
    const equip = run.equipNow?.bind(run);
    if (equip) run.equipNow = (...a) => { if (true) throw new Error('equip inside the prefix'); return equip(...a); };
    try {
        SB.solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 304, y: 16 } }], name: 'l28-bobsoldier',
            boot });
        solve = { ok: true, ticks: run.ticksCompleted };
    } catch (e) {
        solve = { ok: false, at: run.ticksCompleted, error: e.constructor.name, message: e.message.slice(0, 400) };
    }
    solve.hits = run.ledger('playerHits').map((h) => [h.t, h.source, h.id]);
})));
const CUT = Number(args.cut ?? perTick.length);
if (perTick.length < CUT && !args.idle) throw new Error(`the solver stepped only ${perTick.length} ticks (< cut ${CUT})`);
const IDLE = Number(args.idle ?? 0);
const prefix = [...perTick.slice(0, CUT), ...Array.from({ length: IDLE }, () => new Set())];
const tape = buildStagedTape({ staging, perTick: prefix, name: 'l28-bobsoldier-solved' });

// 2. the model, the switch ON (the solver's own world)
const model = await rockButtonModelSamples(tape, { fallRockHoldsButton: true });

// 3. the game
takeBoxLockOrExit({ name: 'play-l28-solved.mjs', kind: 'browser' });
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
let status = null;
const byTick = new Map();
try {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
    await page.click('#btn-start');
    for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
        await page.waitForTimeout(250);
    }
    await assertLogicOnlyChannel(page);
    const bot = (n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge.game;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(parseTape(JSON.stringify(tape)))));
    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
    if (await bot('botStart') !== 'ok') throw new Error('botStart');
    const deadline = Date.now() + 600000;
    while (Date.now() < deadline) {
        const s = JSON.parse(await page.evaluate(() => String(window.__swfBridge.game.botStatus())));
        if (Number.isInteger(s.tick)) byTick.set(s.tick, rockButtonSampleOf(s));
        if (s.finished) { status = s; break; }
    }
} finally {
    await browser.close();
}
if (!status) throw new Error('the tape never finished');
const samples = [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t);
const bad = compareRockButton(samples, model.samples);
const first = (tag) => samples.find((s) => s.cleared.includes(tag))?.t ?? null;
const out = {
    sight: SIGHT, solve, cut: CUT, idle: IDLE, perTickTotal: perTick.length, page: PAGE,
    idleLead: prefix.findIndex((s) => s.size > 0),
    game: { sampled: samples.length, lockAt: first(L28.lock.tag), minY: Math.min(...samples.map((s) => s.y)),
        maxHits: Math.max(0, ...samples.map((s) => s.hits ?? 0)),
        firstHitT: samples.find((s) => (s.hits ?? 0) > 0)?.t ?? null, end: { x: status.x, y: status.y, level: status.level } },
    model: { lockWriteT: model.ledger.writes.find((w) => w.tag === L28.lock.tag)?.t ?? null,
        minY: Math.min(...model.samples.filter(Boolean).map((s) => s.y)),
        firstHitT: model.samples.findIndex((s) => s && s.hits > 0) },
    diverging: bad.length, firstDiverging: bad.slice(0, 4),
    tape,
};
if (args.out) writeFileSync(args.out, `${JSON.stringify(out)}\n`);
const { tape: _t, ...summary } = out;
console.log(JSON.stringify(summary, null, 1));
console.log(bad.length === 0 && out.game.maxHits === 0 ? 'ALL CHECKS PASSED' : 'CHECK FAILED');
