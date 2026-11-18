// MEASURE ONLY (seedling-fidelity-l39hit D1.3): play a seam-declaring L39 tape on a FRESH p4g page (headless,
// logic-only, the delivered set via botLoadLevels — probe-seedling-l39-shaft.mjs's playOnGame), polling botStatus +
// botMobiles every tick: player x/y, hits, hits_timer, every Spinner. The model replays the same tape (defaults,
// delivered set) with its playerHits ledger. Writes {game, model, modelHits} to <out>.
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/user/Archipelago-CC/package.json')('playwright');
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = '/home/user/Archipelago-CC/';
const MODULE = join(R, 'frontend/modules/seedlingDemo');
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(R + 'scripts/procgen/headlessChromium.js');
const { takeBoxLockOrExit } = await import(R + 'scripts/procgen/boxLock.js');
const { assertLogicOnlyChannel } = await import(R + 'scripts/procgen/seedlingChannel.js');
const [tapePath, out] = process.argv.slice(2);
takeBoxLockOrExit({ name: 'l39hit witness.mjs (scratch)', kind: 'browser' });
const tapeJson = JSON.parse(readFileSync(tapePath, 'utf8'));
const { parseTape, gameVisibleTape } = await import(join(MODULE, 'tapeFormat.js'));
const tape = parseTape(JSON.stringify(tapeJson));
// ---- model
const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
const { l39LevelSource } = await import(join(MODULE, 'fidelityL39Shaft.js'));
const levelSource = await l39LevelSource('delivered');
const model = []; let run = null;
const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
while (!r.done) {
    const o = r.value.observation;
    const sp = run && run.level === 39 ? run.entities('spinnerBodies').filter((b) => !b.destroy).map((b) => [b.id, b.x, b.y]) : [];
    model.push({ t: o.t, level: o.level, x: o.x, y: o.y, hits: (run?.ledger('playerHits') ?? []).length, sp });
    r = st.next();
}
const modelHits = run.ledger('playerHits');
console.log('MODEL', model.length, 'rows; playerHits', JSON.stringify(modelHits));
// ---- game
const { vanillaRecordSet } = await import(join(MODULE, 'levelSetExporter.js'));
const rj = (rel) => JSON.parse(readFileSync(join(R, rel), 'utf8'));
const set = vanillaRecordSet(rj('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), rj('frontend/modules/flashPanel/atlases/seedling-map.json')).set;
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const game = [];
let status = null;
try {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
    await page.click('#btn-start');
    for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
    await assertLogicOnlyChannel(page);
    const bot = (n, a) => page.evaluate(([name, x]) => { const g = window.__swfBridge.game; return String(x === undefined ? g[name]() : g[name](x)); }, [n, a]);
    const { planLevelSetChunks } = await import(join(MODULE, 'levelSetValidator.js'));
    const answers = [];
    for (const c of planLevelSetChunks(set).chunks) answers.push(await bot('botLoadLevels', JSON.stringify(c)));
    if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
    const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
    if ((await bot('botStart')) !== 'ok') throw new Error('botStart');
    const byTick = new Map();
    const deadline = Date.now() + 1200000;
    while (Date.now() < deadline) {
        const raw = await page.evaluate(() => { const g = window.__swfBridge.game; return [String(g.botStatus()), String(g.botMobiles())]; });
        const s = JSON.parse(raw[0]); const m = JSON.parse(raw[1]);
        if (Number.isInteger(s.tick) && m.tick === s.tick && !byTick.has(s.tick)) {
            byTick.set(s.tick, { t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits, hits_timer: s.hits_timer, game_time: s.game_time,
                sp: (m.mobiles ?? []).filter((q) => /Spinner$/.test(q.cls) && !q.destroy).map((q) => [q.x, q.y, q.hits ?? null]) });
        }
        if (s.finished) { status = s; break; }
    }
    game.push(...[...byTick.values()].sort((a, b) => a.t - b.t));
} finally { await browser.close(); }
console.log('GAME', game.length, 'ticks sampled; end', JSON.stringify(status && { level: status.level, tick: status.tick, x: status.x, y: status.y, hits: status.hits }));
const firstHit = game.find((g) => g.hits > 0);
console.log('GAME first hits>0 sample', JSON.stringify(firstHit));
writeFileSync(out, JSON.stringify({ game, model, modelHits, end: status }));
