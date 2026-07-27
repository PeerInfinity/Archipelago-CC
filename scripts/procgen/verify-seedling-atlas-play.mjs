#!/usr/bin/env node
/**
 * Phase-4 milestone check for the region atlas
 * (CC/docs/plans/region-atlas-plan.md): the REAL Seedling game plays inside the
 * compiled atlas preset — walking through one of the game's own level
 * transitions crosses the AP region boundary, and arriving in a region
 * teleports the player to the marked entrance spawn.
 *
 *   Phase A — boot the DEFAULT mode straight onto ?game=seedling_atlas&seed=1
 *     (flashPanel is enabled there now), start the wasm game, reach 'ready'.
 *   Phase B — ARRIVAL. The initial region load teleports the player to the
 *     start region's marked entrance spawn: BridgeGeneric logs the invocation
 *     and an independent readState off the game's own callback surface shows
 *     the level and coordinates it produced.
 *   Phase C — CROSSING. Queue a `new Game(...)` invocation straight into the
 *     iframe, mimicking the player taking a native teleporter with NO
 *     involvement from the glue's suppression path, and assert the EFFECT:
 *     user:regionMove really published, and gameState's current region really
 *     changed.
 *   Phase D — a second crossing back, so the count is not a one-off.
 *   Phase E — ECHO. A host-driven region move (the shape a Regions-panel click
 *     or a loop queue produces) makes the glue teleport ACROSS levels; the
 *     level report that teleport causes must NOT be read as a crossing. The
 *     positive counts from C and D are asserted before this negative one.
 *
 * The regionMove watcher wraps the dispatcher's publish and THROWS if it
 * cannot — a silent watcher would make Phase E vacuous.
 *
 * Prereqs:
 *   - dev server on :8000 (python -m http.server 8000 at repo root)
 *   - the UNCOMMITTED wasm artifact at
 *     frontend/modules/flashPanel/wasm/seedling_teleport_ap/ (copy command in
 *     frontend/modules/flashPanel/README.md). SKIPs (exit 0) when absent, so
 *     CI — which has no wasm — stays green.
 *
 * Headless: WebGPU comes up on swiftshader, same flags as
 * verify-seedling-wasm-bridge.mjs.
 *
 * Run: node scripts/procgen/verify-seedling-atlas-play.mjs
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', 'seedling_teleport_ap');
if (!existsSync(join(ARTIFACT, 'game.html'))
    || !existsSync(join(ARTIFACT, 'seedling_teleport_ap.wasm'))) {
    console.log(`SKIP: seedling wasm artifact not staged at ${ARTIFACT}`
        + ' — see frontend/modules/flashPanel/README.md for the copy command');
    process.exit(0);
}

// The expected geometry comes from the COMMITTED preset, not from constants
// re-typed here: an atlas edit that moves an entrance spawn should move these
// assertions with it.
const PRESET = JSON.parse(readFileSync(
    join(REPO, 'frontend/presets/seedling_atlas/AP_1/AP_1_rules.json'), 'utf8'));
const SIDECARS = PRESET.preset_sidecars['1'];
const payload = (region) => SIDECARS[region].playable_payload;
const exitOf = (region, exitId) => payload(region).exits.find((e) => e.exit_id === exitId);

const START_REGION = PRESET.regions['1'].Menu.exits[0].connected_region; // overworld_start
// The initial load has no arrivedFrom, so the glue spawns at the region's
// FIRST declared exit (documented in seedlingRegionBinding.resolveArrivalSpawn).
const START_SPAWN = payload(START_REGION).exits[0];
const TO_NEST = exitOf(START_REGION, 'owls_nest_stairs');
const FROM_NEST = exitOf('owls_nest_entrance', 'stairs_up');
const TO_HOUSE = exitOf(START_REGION, 'house_door');

const URL = 'http://localhost:8000/frontend/?game=seedling_atlas&seed=1';

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
        '--no-sandbox',
    ],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

let failures = 0;
function check(name, ok, detail = '') {
    console.log(`${ok ? '  ok  ' : 'FAIL  '}${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures += 1;
}

async function waitFor(desc, fn, timeoutMs = 60000) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > timeoutMs) {
            console.log(`PAGE LOGS (last 40):\n${logs.slice(-40).join('\n')}`);
            throw new Error(`timeout waiting for: ${desc}`);
        }
        await page.waitForTimeout(300);
    }
}

function gameFrame() {
    const f = page.frames().find((fr) => fr.url().includes('seedling_teleport_ap/game.html'));
    if (!f) throw new Error('seedling wasm iframe not found');
    return f;
}

const panelStatus = () => page.evaluate(() =>
    document.querySelector('.flash-panel-status')?.textContent ?? '');

// An INDEPENDENT observation of in-game state: straight off the game's own
// callback surface, not routed through the adapter or the glue.
async function readGameState() {
    const raw = await gameFrame().evaluate(() => window.__swfBridge.game.readState());
    try { return JSON.parse(raw); } catch { return { __raw: raw }; }
}

const currentRegion = () => page.evaluate(() =>
    window.centralRegistry?.getPublicFunction('gameState', 'getCurrentRegion')?.() ?? null);

const glueStats = () => page.evaluate(async () => {
    const mod = await import('./modules/flashPanel/index.js');
    return mod.getSeedlingRegionGlue()?.stats ?? null;
});

const watched = () => page.evaluate(() => window.__atlasRegionMoves ?? null);

/** Take a native teleporter: a `new Game(level, x, y)` the glue did not ask for. */
async function nativeTeleport(level, x, y) {
    await gameFrame().evaluate(({ l, px, py }) => {
        window.__swfBridge.queueItems({
            invocation: 'new_instance',
            className: 'Game',
            args: [l, px, py],
            assignTo: { class: 'net.flashpunk.FP', property: 'world' },
        });
    }, { l: level, px: x, py: y });
}

try {
    // ── Phase A — boot ──────────────────────────────────────────────────────
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await waitFor('rules loaded', () => page.evaluate(
        () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));

    // The watcher. Wrapping the dispatcher's publish is the only channel the
    // glue uses; if it cannot be wrapped, FAIL HERE rather than let every
    // later assertion pass vacuously.
    const wrapped = await page.evaluate(async () => {
        const mod = await import('./modules/flashPanel/index.js');
        const d = mod.getDispatcher();
        if (!d || typeof d.publish !== 'function') return false;
        window.__atlasRegionMoves = [];
        window.__atlasPublish = d.publish.bind(d);
        d.publish = (name, data, opts) => {
            if (name === 'user:regionMove') window.__atlasRegionMoves.push(data);
            return window.__atlasPublish(name, data, opts);
        };
        return true;
    });
    if (!wrapped) throw new Error('could not wrap the flashPanel dispatcher — the watcher would be silent');
    check('Phase A: the regionMove watcher is installed on the real publish channel', true);

    check('Phase A: the preset loaded with the atlas graph',
        (await currentRegion()) === START_REGION, `current region ${await currentRegion()}`);
    const statsA = await glueStats();
    check('Phase A: procgen routed the start region to the flash_seedling glue',
        !!statsA && statsA.loads >= 1, JSON.stringify(statsA));

    await waitFor('Flash Game tab activated', () => page.evaluate(() => {
        const tab = [...document.querySelectorAll('.lm_tab')].find((t) => t.title === 'Flash Game');
        if (!tab) return false;
        tab.click();
        return true;
    }));
    await waitFor('wasm iframe mounted', async () =>
        page.frames().some((fr) => fr.url().includes('seedling_teleport_ap/game.html')));
    await waitFor('start button enabled', () => gameFrame().evaluate(() => {
        const b = document.getElementById('btn-start');
        return !!b && !b.disabled;
    }));
    await gameFrame().click('#btn-start');
    const status = await waitFor("panel status 'ready'", async () =>
        ((await panelStatus()) === 'ready' ? 'ready' : null), 120000);
    check('Phase A: the wasm bridge handshake reaches ready', status === 'ready');

    // ── Phase B — the arrival teleport ──────────────────────────────────────
    const arrivalCall = `[BridgeGeneric] Invoked: new Game(${payload(START_REGION).level},`
        + `${START_SPAWN.entrance_spawn.x},${START_SPAWN.entrance_spawn.y})`;
    await waitFor(`arrival invocation ${arrivalCall}`, () =>
        logs.some((l) => l.includes(arrivalCall)) || null, 120000);
    check('Phase B: the arrival teleport reached the game as a new Game invocation', true,
        arrivalCall);
    const stB = await waitFor('the game reports the arrival spawn', async () => {
        const st = await readGameState();
        return st.level === payload(START_REGION).level
            && st.playerPositionX === START_SPAWN.entrance_spawn.x ? st : null;
    });
    check('Phase B: the game state IS the marked entrance spawn',
        stB.level === payload(START_REGION).level
        && stB.playerPositionX === START_SPAWN.entrance_spawn.x
        && stB.playerPositionY === START_SPAWN.entrance_spawn.y,
        `level=${stB.level} x=${stB.playerPositionX} y=${stB.playerPositionY}`);

    const movesBefore = (await watched()).filter((m) => m.source === 'seedlingRegionGlue').length;
    check('Phase B: the arrival itself published no crossing', movesBefore === 0,
        `${movesBefore} glue moves so far`);

    // ── Phase C — a native crossing the glue did not cause ──────────────────
    await nativeTeleport(TO_NEST.target_level, TO_NEST.target_spawn.x, TO_NEST.target_spawn.y);
    await waitFor('user:regionMove published for the native crossing', async () => {
        const moves = (await watched()).filter((m) => m.source === 'seedlingRegionGlue');
        return moves.length >= 1 ? moves : null;
    });
    const movesC = (await watched()).filter((m) => m.source === 'seedlingRegionGlue');
    check('Phase C: the level change published user:regionMove through the real channel',
        movesC.length === 1
        && movesC[0].targetRegion === TO_NEST.targetRegion
        && movesC[0].exitName === TO_NEST.exitName,
        JSON.stringify(movesC[0]));
    const regionC = await waitFor('gameState follows the crossing', async () =>
        ((await currentRegion()) === TO_NEST.targetRegion ? TO_NEST.targetRegion : null));
    check('Phase C: gameState really moved — the effect, not just the event',
        regionC === TO_NEST.targetRegion, regionC);

    // ── Phase D — and back, so the count is not a one-off ───────────────────
    await nativeTeleport(FROM_NEST.target_level, FROM_NEST.target_spawn.x, FROM_NEST.target_spawn.y);
    const regionD = await waitFor('gameState follows the return crossing', async () =>
        ((await currentRegion()) === FROM_NEST.targetRegion ? FROM_NEST.targetRegion : null));
    const movesD = (await watched()).filter((m) => m.source === 'seedlingRegionGlue');
    check('Phase D: the return crossing published its own move',
        movesD.length === 2 && movesD[1].targetRegion === FROM_NEST.targetRegion
        && regionD === FROM_NEST.targetRegion,
        `${movesD.length} glue moves, region ${regionD}`);

    // ── Phase E — the echo ──────────────────────────────────────────────────
    // A host-driven move (Regions-panel click / loop queue shape). The glue's
    // arrival teleport crosses levels, so the report it causes is exactly the
    // one an unsuppressed echo would re-publish as a crossing.
    logs.length = 0;
    await page.evaluate((move) => {
        window.__atlasPublish('user:regionMove', move, { initialTarget: 'bottom' });
    }, {
        sourceRegion: START_REGION,
        targetRegion: TO_HOUSE.targetRegion,
        exitName: TO_HOUSE.exitName,
        source: 'verify-seedling-atlas-play',
    });
    const echoCall = `[BridgeGeneric] Invoked: new Game(${TO_HOUSE.target_level},`
        + `${TO_HOUSE.target_spawn.x},${TO_HOUSE.target_spawn.y})`;
    await waitFor(`echo-case arrival invocation ${echoCall}`, () =>
        logs.some((l) => l.includes(echoCall)) || null);
    const stE = await waitFor('the game reports the new level', async () => {
        const st = await readGameState();
        return st.level === TO_HOUSE.target_level ? st : null;
    });
    check('Phase E: the host-driven arrival teleport landed across levels',
        stE.level === TO_HOUSE.target_level, `level=${stE.level}`);
    // Give the glue every chance to (wrongly) publish before asserting zero.
    await page.waitForTimeout(3000);
    const movesE = (await watched()).filter((m) => m.source === 'seedlingRegionGlue');
    check('Phase E: the teleport echo did NOT become a second crossing',
        movesE.length === 2, `${movesE.length} glue moves (expected the 2 from C and D)`);
    check('Phase E: gameState stayed where the host put it',
        (await currentRegion()) === TO_HOUSE.targetRegion, await currentRegion());

    const statsEnd = await glueStats();
    check('Phase E: the glue agrees with the independent watcher',
        statsEnd.regionMoves === movesE.length, JSON.stringify(statsEnd));
} catch (err) {
    console.log(`FAIL  fatal: ${err.message}`);
    console.log(`PAGE LOGS (last 60):\n${logs.slice(-60).join('\n')}`);
    failures += 1;
} finally {
    await browser.close();
}

console.log(failures === 0
    ? '\nOK: the real Seedling game walks between atlas regions, and the arrival teleport does not echo'
    : `\nFAILED: ${failures} check(s)`);
process.exit(failures === 0 ? 0 : 1);
