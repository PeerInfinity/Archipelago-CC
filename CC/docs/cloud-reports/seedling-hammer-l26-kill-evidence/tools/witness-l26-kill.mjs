#!/usr/bin/env node
/**
 * Scratch witness (hammer L26-KILL; decides nothing, gates nothing): the chest route's survey step 35 (L26 from (8,2),
 * reach-exit (144,208) -> L28) solved in node under the named arms, each plan folded to a staged tape
 * (`buildStagedTape`, the survey's own fold), replayed in the model on the survey's rooms and on the game's DELIVERED
 * record set, and played on the game (p4g, the default build, headless logic-only) on a FRESH page per arm, with
 * `botStatus()` / `botMobiles()` sampled at the Bot's own observation point. Prints one ROW per arm: ticks, the
 * model's hits, the game's hits (a `hits_timer` rise or a lethal reset), and the first player parting between the
 * game and the model. Adapted from the L98-L99 slice's `witness-l98-l99.mjs`.
 *
 *   node CC/docs/cloud-reports/seedling-hammer-l26-kill-evidence/tools/witness-l26-kill.mjs \
 *       [--host=http://localhost:8000] [--only=on,...] [--out=<dir>]
 * Takes the box lock (kind `browser`).
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const P = (p) => import(join(REPO, p));
const M = (p) => P(join('frontend/modules/seedlingDemo', p));

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
const ONLY = arg('only', null)?.split(',') ?? null;
const OUT = arg('out', null);
const PAGE = 'seedling_bot_ap_p4g';

const { HEADLESS_LOGIC_ONLY_ARGS } = await P('scripts/procgen/headlessChromium.js');
const { assertLogicOnlyChannel } = await P('scripts/procgen/seedlingChannel.js');
const { takeBoxLockOrExit } = await P('scripts/procgen/boxLock.js');
const { parseTape, gameVisibleTape, heldKeysAt } = await M('tapeFormat.js');
const { planLevelSetChunks } = await M('levelSetValidator.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { l25Sets } = await M('fidelityL25ApItem.js');
const { deliveredChestDocument } = await M('apChestDelivery.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { CONTACT_FIDELITY } = await M('contactFidelity.js');
const { patchedMapDocument } = await M('seedlingSetPatches.js');
const { twoPassSolve } = await M('twoPassSolve.js');
const { buildStagedTape } = await M('botDriverV1.js');
const S = await M('solverBot.js');

const SETS = l25Sets(REPO);
const MAP = patchedMapDocument(JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8')));
const SURVEY_SOURCE = levelSourceFromAtlas(CONTACT_FIDELITY.apChestItem ? deliveredChestDocument(MAP) : MAP);
const BOOT = readFileSync(join(REPO, 'frontend/modules/seedlingDemo/fixtures/hammer-l26-kill/survey-step-35-boot.json'), 'utf8');
const GOALS = [{ kind: 'reach-exit', exit: { x: 144, y: 208 } }];
const ARMS = [
    { name: 'on', asForecast: true },
    { name: 'off-dashless', asForecast: false, dashMode: 'none' },
].filter((a) => !ONLY || ONLY.includes(a.name));

async function tapeFor(arm) {
    const staging = solveStaging(stagingFromTape(parseTape(BOOT)));
    const makeRun = (persistence) => createRunForStaging({ ...staging, persistence }, SURVEY_SOURCE);
    const solved = await S.withKillLockStanceAsForecast(arm.asForecast, () => twoPassSolve({ makeRun, goals: GOALS,
        name: `witness-${arm.name}`, boot: staging.boot, persistence: staging.persistence, log: () => {},
        ...(arm.dashMode ? { dashMode: arm.dashMode } : {}) }));
    return parseTape(buildStagedTape({
        staging: { ...staging, persistence: solved.persistence,
            equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
        perTick: solved.out.perTick, name: `witness-${arm.name}`,
    }));
}

function model(tape, source) {
    const run = createRunForStaging(stagingFromTape(tape), source);
    const rows = [{ x: run.state.x, y: run.state.y, level: run.level }];
    for (let t = 0; t < tape.tick_count; t += 1) {
        run.advance(new Set(heldKeysAt(tape, t)));
        rows.push({ x: run.state.x, y: run.state.y, level: run.level });
    }
    return { rows, hits: run.playerHits.map((h) => `${h.id ?? h.source}@t${h.t}`), deaths: run.playerDeaths.length,
        level: run.level };
}

takeBoxLockOrExit({ name: 'witness-l26-kill.mjs', kind: 'browser' });
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
async function game(tape) {
    const page = await browser.newPage();
    try {
        await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 720 && !(await page.evaluate(() => !!window.__runtimeReady)); i += 1) await page.waitForTimeout(250);
        await page.click('#btn-start');
        for (let i = 0; i < 720 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i += 1) await page.waitForTimeout(250);
        await assertLogicOnlyChannel(page);
        const bot = (n, a) => page.evaluate(([name, x]) => {
            const g = window.__swfBridge.game;
            return String(x === undefined ? g[name]() : g[name](x));
        }, [n, a]);
        const answers = [];
        for (const c of planLevelSetChunks(SETS.delivered).chunks) answers.push(await bot('botLoadLevels', JSON.stringify(c)));
        if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
        if (await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('botLoadTape');
        if (await bot('botStart') !== 'ok') throw new Error('botStart');
        const byTick = new Map();
        for (const deadline = Date.now() + 600000; Date.now() < deadline;) {
            const raw = await page.evaluate(() => {
                const g = window.__swfBridge.game;
                return [String(g.botMobiles()), String(g.botStatus())];
            });
            const m = JSON.parse(raw[0]);
            const s = JSON.parse(raw[1]);
            if (s.error) throw new Error(`botStatus: ${s.error}`);
            const t = m.tick ?? s.tick;
            const final = s.finished || t >= tape.tick_count;
            if (Number.isInteger(t) && t >= 0 && !(final && byTick.has(t))) {
                byTick.set(t, { player: m.mobiles.find((r) => /Player$/.test(r.cls)) ?? null, hits: s.hits,
                    hits_timer: s.hits_timer, level: s.level ?? null });
            }
            if (s.finished) return byTick;
        }
        throw new Error('the tape never finished inside the deadline');
    } finally {
        await page.close();
    }
}

if (OUT) mkdirSync(OUT, { recursive: true });
for (const arm of ARMS) {
    const tape = await tapeFor(arm);
    if (OUT) writeFileSync(join(OUT, `${arm.name}.tape.json`), `${JSON.stringify(tape)}\n`);
    const ms = model(tape, SURVEY_SOURCE);
    const md = model(tape, SETS.deliveredSource);
    const g = await game(tape);
    const gameHits = [];
    let sampled = 0;
    let firstParting = null;
    for (let t = 1, timer = 0, hits = 0; t <= tape.tick_count; t += 1) {
        const row = g.get(t);
        if (!row) continue;
        sampled += 1;
        if (row.hits_timer > timer || (row.hits === 0 && hits > 0)) gameHits.push(t);
        timer = row.hits_timer;
        hits = row.hits;
        const mr = md.rows[t];
        if (firstParting === null && row.player && (Math.abs(row.player.x - mr.x) > 1e-9 || Math.abs(row.player.y - mr.y) > 1e-9)) {
            firstParting = { t, game: [row.player.x, row.player.y], model: [mr.x, mr.y] };
        }
    }
    const last = g.get(Math.max(...g.keys()));
    console.log(`ROW ${JSON.stringify({ arm: arm.name, ticks: tape.tick_count, sampled,
        model: { survey: { hits: ms.hits, deaths: ms.deaths, level: ms.level }, delivered: { hits: md.hits, deaths: md.deaths, level: md.level } },
        game: { hits: gameHits, endLevel: last?.level ?? null }, firstParting })}`);
}
await browser.close();
