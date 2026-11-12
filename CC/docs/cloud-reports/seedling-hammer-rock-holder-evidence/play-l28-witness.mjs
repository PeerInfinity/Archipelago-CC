// Plays the ROCK-HOLDER game-witness tapes (`build-l28-walk-tape.mjs`) on a FRESH p4g page each (headless, the
// logic-only channel), samples botStatus every poll (last poll of each tick), and replays each tape on the model.
// Prints per tape: the game's and the model's y at the start of the up hold, the minimum y reached, and the end.
// Writes <evidence>/witness-l28.json. Dev server at the repo root (SEEDLING_PORT, default 8000). Takes the box lock.
//   node CC/docs/cloud-reports/seedling-hammer-rock-holder-evidence/play-l28-witness.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from '../../../../scripts/procgen/headlessChromium.js';
import { takeBoxLockOrExit } from '../../../../scripts/procgen/boxLock.js';
import { assertLogicOnlyChannel } from '../../../../scripts/procgen/seedlingChannel.js';
import { gameVisibleTape, parseTape } from '../../../../frontend/modules/seedlingDemo/tapeFormat.js';
import { runTape } from '../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { atlasLevelSource } from '../../../../frontend/modules/seedlingDemo/levelSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
const NAMES = (process.argv.slice(2).length ? process.argv.slice(2) : ['l28-rock-holder-walk', 'l28-rock-holder-control']);

async function playOnGame(tapeJson) {
    const tape = parseTape(JSON.stringify(tapeJson));
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
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
        const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        const started = await bot('botStart');
        if (started !== 'ok') throw new Error(`botStart: ${started}`);
        const byTick = new Map();
        let status = null;
        let keys = null;
        const deadline = Date.now() + 300000;
        while (Date.now() < deadline) {
            const s = JSON.parse(await bot('botStatus'));
            keys ??= Object.keys(s);
            if (Number.isInteger(s.tick)) {
                byTick.set(s.tick, { t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits ?? null,
                    cleared: (s.persistence_cleared ?? []).filter((c) => c.level === 28).map((c) => c.tag).sort() });
            }
            if (s.finished) { status = s; break; }
        }
        if (!status) throw new Error('the tape never finished');
        return { status, keys, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
    } finally {
        await browser.close();
    }
}

function playOnModel(tapeJson) {
    const r = runTape(parseTape(JSON.stringify(tapeJson)), { levelSource: atlasLevelSource() });
    return r.ticks.map((o) => ({ t: o.t, level: o.level, x: o.x, y: o.y }));
}

takeBoxLockOrExit({ name: 'play-l28-witness.mjs', kind: 'browser' });
const result = {};
for (const name of NAMES) {
    const tapeJson = JSON.parse(readFileSync(join(HERE, 'tapes', `${name}.json`), 'utf8'));
    const holdFrom = Number((tapeJson.description.match(/hold starts at tick (\d+)/) ?? [])[1] ?? NaN);
    const game = await playOnGame(tapeJson);
    let model = null;
    try { model = playOnModel(tapeJson); } catch (e) { model = { error: e.message.slice(0, 300) }; }
    const minY = (xs) => Math.min(...xs.filter((s) => s.level === 28).map((s) => s.y));
    const row = {
        game: { end: game.samples.at(-1), minY: minY(game.samples), maxHits: Math.max(0, ...game.samples.map((s) => s.hits ?? 0)),
            cleared: game.samples.at(-1)?.cleared, statusKeys: game.keys },
        model: Array.isArray(model) ? { end: model.at(-1), minY: minY(model) } : model,
    };
    result[name] = { ...row, samples: game.samples };
    console.log(name, JSON.stringify(row));
}
writeFileSync(join(HERE, 'witness-l28.json'), `${JSON.stringify(result)}\n`);
