#!/usr/bin/env node
/**
 * probe-seedling-secondary-use — ⛓ seedling-fidelity-secuse W0: THE X+C TICK, ASKED OF THE GAME.
 *
 * `Player.input()` ends `if (Input.pressed(keys[4])) useItem(Main.primary); if (Input.pressed(keys[5]))
 * useItem(Main.secondary);` (`Player.as:1561-1568`), so X and C on ONE tick are two `useItem` calls in one frame,
 * primary first. The model refuses that tick by name (`levelRun`'s C4 arm under `CONTACT_FIDELITY.secondaryUse`), so
 * only the game can say what it does. This plays a set of ARMS — one base tape (a committed `fixtures/chaser-witness/`
 * witness's embedded tape) with each arm's `inputs` (and optional `seam` overrides, e.g. `secondary`) — on the GAME
 * (`seedling_bot_ap_p4g` unless `SEEDLING_PAGE`, headless logic-only) and records the player and the run's `hits` /
 * `hits_timer` at each tick (the LAST poll before the tick advanced, the `Bot`'s own observation point; the final
 * tick keeps its first poll). It reads no model: the model-side comparison is the test's
 * (`fidelitySecondaryUse.test.js`), which is what lets it record an input the model refuses.
 *
 * The arms file: `{"base": "<chaser-witness name>", "tick_count": N, "arms": {"<name>": {"inputs": [...],
 * "seam": {...}?}}}`.
 *
 * The dev server at the repo root, `SEEDLING_PORT` (default 8000).
 *
 * Run: node scripts/procgen/probe-seedling-secondary-use.mjs --arms=<arms.json>
 *      node scripts/procgen/probe-seedling-secondary-use.mjs --arms=<arms.json> --record --name=<n>
 *        (writes `fixtures/secondary-use-witness/<n>.json`: the arms, their tapes and the GAME's rows)
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

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const ARMS = arg('arms');
    const RECORD = process.argv.includes('--record');
    const NAME = arg('name');
    if (!ARMS || (RECORD && !NAME)) {
        console.error('probe-seedling-secondary-use: --arms=<arms.json> is required, and --record needs --name=<n>');
        process.exit(2);
    }
    const HERE = dirname(fileURLToPath(import.meta.url));
    const MODULE = join(HERE, '..', '..', 'frontend', 'modules', 'seedlingDemo');
    const spec = JSON.parse(readFileSync(ARMS, 'utf8'));
    const base = JSON.parse(readFileSync(join(MODULE, 'fixtures', 'chaser-witness', `${spec.base}.json`), 'utf8')).tape;

    takeBoxLockOrExit({ name: 'probe-seedling-secondary-use.mjs', kind: 'browser' });

    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const arms = {};
    try {
        for (const [armName, arm] of Object.entries(spec.arms)) {
            const tapeJson = { ...base, name: `${NAME ?? 'secuse'}-${armName}`, tick_count: spec.tick_count,
                inputs: arm.inputs, seam: { ...base.seam, ...(arm.seam ?? {}) } };
            const tape = parseTape(JSON.stringify(tapeJson));
            const page = await browser.newPage();
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) {
                await page.waitForTimeout(250);
            }
            await page.click('#btn-start');
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
                await page.waitForTimeout(250);
            }
            await assertLogicOnlyChannel(page);
            const bot = (n, a) => page.evaluate(([nm, x]) => {
                const g = window.__swfBridge.game;
                return String(x === undefined ? g[nm]() : g[nm](x));
            }, [n, a]);
            const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape (${armName}): ${loaded}`);
            const started = await bot('botStart');
            if (started !== 'ok') throw new Error(`botStart (${armName}): ${started}`);
            const byTick = new Map();
            let finished = false;
            const deadline = Date.now() + 300000;
            while (Date.now() < deadline) {
                const [m, s] = (await page.evaluate(() => {
                    const g = window.__swfBridge.game;
                    return [String(g.botMobiles()), String(g.botStatus())];
                })).map((x) => JSON.parse(x));
                const t = m.tick ?? s.tick;
                const p = (m.mobiles ?? []).find((r) => /Player$/.test(r.cls));
                if (p && Number.isInteger(t) && t >= 0 && t <= spec.tick_count && !(finished && byTick.has(t))) {
                    // the LAST poll before the tick advanced; the final tick keeps its first (`s.finished` polls after)
                    if (!(t === spec.tick_count && byTick.has(t))) {
                        byTick.set(t, { t, level: s.level, x: p.x, y: p.y, vx: p.vx, vy: p.vy, hits: s.hits,
                            hits_timer: s.hits_timer });
                    }
                }
                if (s.finished) { finished = true; break; }
            }
            await page.close();
            if (!finished) throw new Error(`arm ${armName}: the tape never finished inside the deadline`);
            arms[armName] = { inputs: arm.inputs, seam: arm.seam ?? {}, tape: tapeJson,
                samples: [...byTick.values()].sort((a, b) => a.t - b.t) };
            const s = arms[armName].samples;
            console.log(`${armName.padEnd(10)} ` + s.map((r) => `t${r.t} L${r.level} (${r.x.toFixed(2)},${r.y.toFixed(2)}) `
                + `v(${r.vx.toFixed(2)},${r.vy.toFixed(2)}) hits ${r.hits}`).join(' | '));
        }
    } finally {
        await browser.close();
    }
    if (RECORD) {
        const dir = join(MODULE, 'fixtures', 'secondary-use-witness');
        mkdirSync(dir, { recursive: true });
        const out = { name: NAME, page: PAGE_NAME, base: spec.base, tick_count: spec.tick_count,
            recordedBy: 'scripts/procgen/probe-seedling-secondary-use.mjs --record', note: spec.note ?? null, arms };
        writeFileSync(join(dir, `${NAME}.json`), `${JSON.stringify(out, null, 1)}\n`);
        console.log(`recorded fixtures/secondary-use-witness/${NAME}.json`);
    }
}
