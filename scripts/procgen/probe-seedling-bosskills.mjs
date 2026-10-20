#!/usr/bin/env node
/**
 * probe-seedling-bosskills — ⛓⛓⛓ seedling-fidelity-bosskills D1/D2: THE KING OF FIRE (`LavaBoss`, L82) AND THE
 * TENTACLED BEAST (L57), ASKED OF THE GAME TICK BY TICK.
 *
 * Plays one tape on the game (p4g by default, headless, the logic-only channel) on a FRESH page and polls
 * `botMobiles()` + `botStatus()` as fast as the page answers. Every tick is sampled; the LAST poll of a tick is kept,
 * because a tick that spans a freeze (the arena rock's dead frames) is polled before and after its frames and only
 * the last is the tick's end. The tape's final tick is dropped: the game runs on past a tape's end (cleartag's trap
 * candidate), so its last poll is not the tick's state.
 *
 * A sample is `{t, level, hits, cleared, x, y, boss, balls, runners, tentacles}`:
 *   · `boss` — the `LavaBoss` row (`anim`, `index`, `hits`, `hitsTimer`, `alpha`) or the `TentacleBeast` row, or null;
 *   · `balls` / `runners` / `tentacles` — `[x, y]` per `LavaBall` / `LavaRunner` / `Tentacle`, in the game's list order;
 *   · `cleared` — the persistence-cleared tags of the boot level.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-bosskills.mjs --file=<tape.json> [--out=<samples.json>]
 *   … --record --name=<name>   write `fixtures/lavaboss-witness/<name>.json` (the tape embedded, the samples) —
 *                              `fidelityKingOfFire.test.js` replays it against the model in node, the switch ON
 *   … --witness=<name>         re-play a recorded witness's own tape on the game and compare it to its samples
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();

/** One `botMobiles` + `botStatus` poll, folded to a sample. */
export function sampleOf(m, s, level) {
    const rows = m.mobiles ?? [];
    const cls = (r) => r.cls.replace(/^.*::/, '');
    const boss = rows.find((r) => /(LavaBoss|TentacleBeast)$/.test(r.cls)) ?? null;
    const xy = (re) => rows.filter((r) => re.test(cls(r))).map((r) => [r.x, r.y]);
    return {
        t: m.tick ?? s.tick,
        level: s.level,
        hits: s.hits ?? null,
        cleared: (s.persistence_cleared ?? []).filter((c) => c.level === level).map((c) => c.tag).sort((a, b) => a - b),
        x: s.x,
        y: s.y,
        boss: boss ? { cls: cls(boss), anim: boss.anim, index: boss.anim_index, alpha: boss.alpha,
            hits: boss.enemy?.hits ?? null, hitsTimer: boss.enemy?.hits_timer ?? null } : null,
        balls: xy(/^LavaBall$/),
        runners: xy(/^LavaRunner$/),
        tentacles: xy(/^Tentacle$/),
    };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
    const WITNESS_DIR = join(MODULE, 'fixtures', 'lavaboss-witness');
    const WITNESS = arg('witness');
    const FILE = arg('file');
    if (!FILE === !WITNESS) {
        console.error('probe-seedling-bosskills: exactly one of --file=<tape.json> or --witness=<name> is required');
        process.exit(2);
    }
    const RECORD = process.argv.includes('--record');
    const NAME = arg('name');
    if (RECORD && !NAME) {
        console.error('probe-seedling-bosskills: --record needs --name=<witness name>');
        process.exit(2);
    }
    const OUT = arg('out');

    takeBoxLockOrExit({ name: 'probe-seedling-bosskills.mjs', kind: 'browser' });

    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const recorded = WITNESS ? JSON.parse(readFileSync(join(WITNESS_DIR, `${WITNESS}.json`), 'utf8')) : null;
    const tapeJson = recorded ? recorded.tape : JSON.parse(readFileSync(FILE, 'utf8'));
    const tape = parseTape(JSON.stringify(tapeJson));

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const byTick = new Map();
    let status = null;
    try {
        const page = await browser.newPage();
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
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
        const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        const started = await bot('botStart');
        if (started !== 'ok') throw new Error(`botStart: ${started}`);
        const deadline = Date.now() + 900000;
        while (Date.now() < deadline) {
            const raw = await page.evaluate(() => {
                const g = window.__swfBridge.game;
                return [String(g.botMobiles()), String(g.botStatus())];
            });
            const m = JSON.parse(raw[0]);
            const s = JSON.parse(raw[1]);
            const smp = sampleOf(m, s, tape.boot.level);
            if (Number.isInteger(smp.t)) byTick.set(smp.t, smp);
            if (s.finished) { status = s; break; }
        }
    } finally {
        await browser.close();
    }
    if (!status) {
        console.log('FAIL: the tape never finished inside the deadline');
        process.exit(1);
    }
    const samples = [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t);
    console.log(`${samples.length} sampled tick(s) of ${tape.tick_count}; end: level ${status.level}, tick ${status.tick}, `
        + `hits ${status.hits ?? '?'}`);
    let ok = true;
    if (recorded) {
        const want = new Map(recorded.samples.map((s) => [s.t, JSON.stringify(s)]));
        let n = 0;
        for (const s of samples) {
            if (!want.has(s.t)) continue;
            if (want.get(s.t) !== JSON.stringify(s)) {
                if (n < 6) console.log(`      t ${s.t}: the game today differs from the recording`);
                n += 1;
            }
        }
        ok = n === 0 && samples.length === recorded.samples.length;
        console.log(`${ok ? 'PASS' : 'FAIL'}: the game reproduces ${WITNESS} — ${n} differing tick(s), `
            + `${samples.length}/${recorded.samples.length} sampled`);
    }
    if (OUT) writeFileSync(OUT, `${JSON.stringify({ file: FILE ?? WITNESS, page: PAGE_NAME, status, samples })}\n`);
    if (RECORD) {
        mkdirSync(WITNESS_DIR, { recursive: true });
        const out = {
            name: NAME,
            source: FILE,
            page: PAGE_NAME,
            recordedBy: 'scripts/procgen/probe-seedling-bosskills.mjs --record',
            note: 'the GAME\'s fight rows at every tick of the tape but its last (the last poll per tick); '
                + 'balls / runners / tentacles in the game\'s list order',
            end: { level: status.level, tick: status.tick },
            tape: tapeJson,
            samples,
        };
        const path = join(WITNESS_DIR, `${NAME}.json`);
        writeFileSync(path, `${JSON.stringify(out)}\n`);
        console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
    }
    process.exit(ok ? 0 : 1);
}
