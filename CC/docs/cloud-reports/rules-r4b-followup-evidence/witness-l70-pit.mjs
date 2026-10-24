#!/usr/bin/env node
/**
 * rules-r4b-followup part 1 — THE L70 → L69 PIT LANDING, ON THE GAME (p4g, headless logic-only, fresh page per arm).
 *
 * L70's only pit is tile (2,2) = (32,32). The two sources disagree on its landing in L69:
 *   - `playerPhysicsV2.fallDestination` (the model; the tile CENTRE minus the control offset) → ctor (48,128)
 *   - the atlas's `out_pit_3_7` (`seedlingAtlasDerivation.pitOf`; the tile CORNER minus the offset) → (48,112)
 * `Player.checkFallingInPit` uses `fallInPitPos = (tile_test.x, tile_test.y)` and a `Tile` is built at
 * `super(_x + w/2, _y + h/2)`: the centre. This reads which one the game uses.
 *
 * Arms: two tapes (into the pit from below with `up`, and from the left with `right`) × (built-in map, the
 * delivered set). Each prints `ROW {json}` with the derived transitions; the arrival tile is the first L69 row
 * of the stream snapped to 16. Measure only.
 *
 * Run: SEEDLING_PORT=8211 node CC/docs/cloud-reports/rules-r4b-followup-evidence/witness-l70-pit.mjs
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..');
const P = (p) => import(join(REPO, 'scripts/procgen', p));
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { takeBoxLockOrExit } = await P('boxLock.js');
takeBoxLockOrExit({ name: 'witness-l70-pit.mjs', kind: 'browser' });
const { HEADLESS_LOGIC_ONLY_ARGS } = await P('headlessChromium.js');
const { derivedTransitions } = await P('probe-seedling-descent.mjs');
const F = await M('fidelityDescent.js');
const { tapeOf } = await M('fidelityMoonrock.js');
const { planLevelSetChunks } = await M('levelSetValidator.js');
const { gameVisibleTape } = await M('tapeFormat.js');
const { runTape } = await M('tapeRunner.js');

const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

const TAPES = {
    up: () => tapeOf({
        name: 'l70-pit-up', boot: { level: 70, x: 32, y: 48 }, flags: { beam: false, rockSet: false },
        ticks: 150, spans: [['up', 0, 12]],
        description: 'rules-r4b-followup — L70 booted on the tile below its pit (32,32); up t0–t11.',
    }),
    right: () => tapeOf({
        name: 'l70-pit-right', boot: { level: 70, x: 16, y: 32 }, flags: { beam: false, rockSet: false },
        ticks: 150, spans: [['right', 0, 12]],
        description: 'rules-r4b-followup — L70 booted on the tile left of its pit (32,32); right t0–t11.',
    }),
};

const call = (page, name, arg) => page.evaluate(([n, a]) => {
    const g = window.__swfBridge && window.__swfBridge.game;
    if (!g || typeof g[n] !== 'function') return null;
    return a === undefined ? g[n]() : g[n](a);
}, [name, arg]);
const json = async (page, name, arg) => { const raw = await call(page, name, arg); return raw === null ? null : JSON.parse(raw); };
async function waitFor(page, what, fn, ms) {
    const t0 = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
        await page.waitForTimeout(250);
    }
}

const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const rows = [];
try {
    for (const world of ['builtin', 'delivered']) {
        const w = F.descentWorld(REPO, world);
        for (const [name, mk] of Object.entries(TAPES)) {
            const tape = mk();
            const page = await browser.newPage();
            try {
                await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
                await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady), 180000);
                await page.click('#btn-start');
                await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
                if (w.set) for (const c of planLevelSetChunks(w.set).chunks) await call(page, 'botLoadLevels', JSON.stringify(c));
                if (await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('botLoadTape');
                if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
                const status = await waitFor(page, 'finish', async () => { const s = await json(page, 'botStatus'); return s?.finished ? s : null; }, 300000);
                const ticks = ((await json(page, 'botDrain'))?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level }));
                let model = null;
                try {
                    const out = runTape(tape, { levelSource: w.levelSource });
                    model = derivedTransitions(out.ticks.map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })));
                } catch (e) { model = `refused: ${e.message.split('\n')[0]}`; }
                const first69 = ticks.find((o) => o.level === 69);
                const row = {
                    world, tape: name, observations: ticks.length, error: status.error || '',
                    transitions: derivedTransitions(ticks), first_l69: first69 ?? null,
                    final: ticks.at(-1) ?? null,
                    final_tile: ticks.at(-1) ? [Math.floor(ticks.at(-1).x / 16), Math.floor(ticks.at(-1).y / 16)] : null,
                    model_transitions: model,
                };
                rows.push(row);
                console.log(`ROW ${JSON.stringify(row)}`);
            } finally { await page.close(); }
        }
    }
} finally { await browser.close(); }
