/**
 * In-app verify for X1 maze consumable tiles (cross-game consumable
 * pool). The unit suite pins the generator and the overlay plumbing; the
 * in-app substrate tests drive the panel through the test controller
 * with tiles INJECTED onto a live world. This script is the independent
 * stratum, and it differs from both in the way that matters: every tile
 * it walks was placed by the REAL GENERATOR and read back out of a real
 * rules.json on disk, in a real browser, over the real resourceChannels
 * bus, into a real omsi engine.
 *
 * That separation is deliberate (memory: feedback_verifier_shared_
 * assumption). The in-app tests would still pass if generation-side
 * placement were broken, because they inject their own tiles; this
 * script would not.
 *
 * What it asserts:
 *   1. The committed-on-disk preset really carries generator-placed
 *      consumableTiles / manaTiles in its maze sidecars, and the grants
 *      name a co-present substrate (omsi).
 *   2. The PLAYBACK BOT walks onto a generator-placed foreign tile and
 *      the grant lands in the omsi engine's OWN resources bag — the full
 *      path: tile → detectStepEvents → visualizer → panel → grantItem →
 *      crossSubstrate:itemGranted → omsi bridge → addResource.
 *   3. No AP location is checked by that pickup (D10) — these tiles are
 *      not locations and must never enter the location table.
 *   4. Re-walking the tile does NOT re-grant (one-shot within a loop),
 *      and a loop reset makes it grant again (X1-R1).
 *   5. A generator-placed mana tile raises the shared pool (X1-R4).
 *   6. The bot's collect policy is 'never' by DEFAULT and reports no
 *      detour even with uncollected tiles present (X1-R3 — this is what
 *      keeps existing playback byte-identical); flipping it to 'always'
 *      makes the same call return a real tile.
 *
 * Fixture: maze_consumable_test (frontend-only preset, NOT committed —
 * regenerate with:
 *   node scripts/procgen/spiral-step.js run --seed 1 \
 *     --quota maze=2 --quota omsi=1 --start maze --items key_red=1 \
 *     --consumable-tiles 2 --mana-tiles 1 --mana-tile-amount 500 \
 *     --enable-loop-mode \
 *     --rules-out frontend/presets/maze_consumable_test/AP_1/AP_1_rules.json \
 *     -o /tmp/mct-env.json
 * ).
 *
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run: node scripts/procgen/verify-maze-consumable-tiles.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const RULES = 'frontend/presets/maze_consumable_test/AP_1/AP_1_rules.json';
const URL = 'http://localhost:8000/frontend/?rules=presets/maze_consumable_test/AP_1/AP_1_rules.json';
const TIMEOUT_MS = 60000;

function fail(msg) {
    throw new Error(msg);
}

// ────────────────────────────────────────────────────────────────
// (1) Read the generator's own output off disk. Everything the browser
// is later asked to do is derived from THIS, not from anything the app
// tells us — so a placement regression shows up as a disk-side failure
// before the browser is even involved.
// ────────────────────────────────────────────────────────────────
let rules;
try {
    rules = JSON.parse(readFileSync(RULES, 'utf8'));
} catch {
    fail(`fixture missing: ${RULES}\n  regenerate it with the command in this file's header`);
}
const playerId = Object.keys(rules.preset_sidecars)[0];
const regions = Object.entries(rules.preset_sidecars[playerId])
    .map(([name, sc]) => [name, sc, sc.playable_payload ?? sc]);

const withConsumable = regions.find(([, , p]) => (p.consumableTiles ?? []).length > 0);
if (!withConsumable) fail('no generator-placed consumableTiles in the preset');
const withMana = regions.find(([, , p]) => (p.manaTiles ?? []).length > 0);
if (!withMana) fail('no generator-placed manaTiles in the preset');

const [consRegion, , consPayload] = withConsumable;
const consTile = consPayload.consumableTiles[0];
const [manaRegion, , manaPayload] = withMana;
const manaTile = manaPayload.manaTiles[0];

if (consTile.substrate !== 'omsi') {
    fail(`expected an omsi-targeted tile, got substrate '${consTile.substrate}'`);
}
const omsiRegion = regions.find(([, sc]) => sc.substrate === 'omsi')?.[0];
if (!omsiRegion) fail('preset has no omsi region — nothing to receive the grant');

console.log(`fixture: ${regions.length} regions; omsi region ${omsiRegion}`);
console.log(`  consumable tile: ${consRegion} (${consTile.x},${consTile.y}) `
    + `→ ${consTile.substrate}/${consTile.type} x${consTile.count}`);
console.log(`  mana tile:       ${manaRegion} (${manaTile.x},${manaTile.y}) → +${manaTile.amount}`);

const browser = await chromium.launch({
    args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
    ],
});

async function makePage(url) {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));
    await page.goto(url);
    return { page, logs };
}

async function waitFor(page, logs, desc, fn, ms = TIMEOUT_MS) {
    const start = Date.now();
    for (;;) {
        let v = false;
        try { v = await fn(); } catch { /* keep polling */ }
        if (v) return v;
        if (Date.now() - start > ms) {
            console.log('  PAGE LOGS (last 25):\n    ' + logs.slice(-25).join('\n    '));
            fail(`timeout waiting for: ${desc}`);
        }
        await page.waitForTimeout(400);
    }
}

const { page, logs } = await makePage(URL);

/** Read a value out of the omsi engine's own global lexical scope. */
const omsiEval = (code) => page.evaluate((c) => {
    const win = document.querySelector('iframe.omsisw-iframe')?.contentWindow;
    if (!win) throw new Error('omsi iframe not mounted');
    return win.eval(c);
}, code);

const mazePanel = () => page.evaluate(async () => {
    const m = await import('./modules/mazeRoom/index.js');
    return !!m.getPanelInstance()?.world;
});

function moveTo(target, source) {
    return page.evaluate(([t, s]) => {
        window.eventDispatcher?.publish('verify', 'user:regionMove', {
            sourceRegion: s, targetRegion: t, exitName: null,
        }, { initialTarget: 'bottom' });
    }, [target, source]);
}

try {
    // ── boot ────────────────────────────────────────────────────
    await waitFor(page, logs, 'app booted with a maze panel + world', mazePanel, 45000);
    console.log('  ✓ app booted; maze panel has a world');

    await waitFor(page, logs, 'omsi engine booted (resources bag readable)',
        async () => typeof (await omsiEval('resources.gold')) === 'number', 45000);
    console.log('  ✓ omsi engine booted; resources bag readable');

    // ── (6) collect policy default, checked BEFORE anything is
    // collected so there are genuinely tiles available to detour to ──
    await moveTo(consRegion, null);
    await waitFor(page, logs, `maze panel showing ${consRegion}`, () => page.evaluate(async (r) => {
        const m = await import('./modules/mazeRoom/index.js');
        return m.getPanelInstance()?.currentRegionId === r;
    }, consRegion));

    const uncollected = await page.evaluate(async () => {
        const m = await import('./modules/mazeRoom/index.js');
        return m.getPanelInstance()?.listUncollectedConsumables?.() ?? [];
    });
    if (uncollected.length === 0) fail('region reports no uncollected consumable tiles');
    console.log(`  ✓ ${consRegion} reports ${uncollected.length} uncollected tile(s)`);

    const bot = () => page.evaluate(async () => {
        const m = await import('./modules/playbackBot/index.js');
        const b = m.getActivePanel?.()?.getBot?.();
        return b ? { policy: b.getMazeCollectPolicy?.() ?? null } : null;
    });
    const botState = await bot();
    if (botState && botState.policy !== 'never') {
        fail(`bot collect policy defaults to '${botState.policy}', expected 'never' (X1-R3)`);
    }
    console.log(`  ✓ bot collect policy defaults to 'never' (X1-R3)`);

    // The default must be a real no-op, and the opt-in must really
    // engage — assert both against the LIVE controller, with genuine
    // uncollected tiles present, so neither result is vacuous.
    const detours = await page.evaluate(async () => {
        const m = await import('./modules/playbackBot/index.js');
        const b = m.getActivePanel?.()?.getBot?.();
        if (!b?._nextCollectDetour) return null;
        const off = b._nextCollectDetour();
        b.setMazeCollectPolicy('always');
        const on = b._nextCollectDetour();
        b.setMazeCollectPolicy('never'); // restore the default for the rest of the run
        return { off, on };
    });
    if (detours) {
        if (detours.off !== null) {
            fail(`policy 'never' offered a detour ${JSON.stringify(detours.off)} — must be a no-op`);
        }
        if (!detours.on) fail("policy 'always' offered no detour despite uncollected tiles");
        console.log(`  ✓ 'never' offers no detour; 'always' offers `
            + `(${detours.on.x},${detours.on.y}) against the live controller`);
    }

    // ── (2)+(3) the grant lands; no AP location is checked ──────
    const goldKey = consTile.type;
    const before = await omsiEval(`resources.${goldKey}`);
    const checkedBefore = await page.evaluate(async () => {
        const proxy = (await import('./modules/stateManager/stateManagerProxySingleton.js')).default;
        const snap = await proxy.getSnapshot();
        const c = snap?.checkedLocations;
        return Array.isArray(c) ? c.length : Object.keys(c ?? {}).length;
    });
    console.log(`  before: omsi ${goldKey}=${before}, checkedLocations=${checkedBefore}`);

    // Drive the BOT (not the panel) onto the generator-placed tile.
    const walked = await page.evaluate(async ([region, x, y]) => {
        const m = await import('./modules/playbackBot/index.js');
        const b = m.getActivePanel?.()?.getBot?.();
        if (!b?.walkToTile) return false;
        b.walkToTile(region, x, y);
        return true;
    }, [consRegion, consTile.x, consTile.y]);
    if (!walked) fail('playback bot exposes no walkToTile — cannot drive the walk');

    const landed = await waitFor(page, logs,
        `omsi resources.${goldKey} reaches ${before + consTile.count}`,
        async () => (await omsiEval(`resources.${goldKey}`)) === before + consTile.count, 30000);
    if (!landed) fail('grant never landed');
    console.log(`  ✓ bot walked the foreign tile; omsi ${goldKey} ${before} → `
        + `${before + consTile.count} (generator-placed grant, full bus)`);

    const checkedAfter = await page.evaluate(async () => {
        const proxy = (await import('./modules/stateManager/stateManagerProxySingleton.js')).default;
        // Snapshot reads are async behind the worker — ping before
        // reading or the "did a location get checked?" comparison can
        // race the pickup it is meant to observe.
        await proxy.pingWorker('verify-consumable', 3000);
        const snap = await proxy.getSnapshot();
        const c = snap?.checkedLocations;
        return Array.isArray(c) ? c.length : Object.keys(c ?? {}).length;
    });
    if (checkedAfter !== checkedBefore) {
        fail(`pickup checked an AP location (${checkedBefore} → ${checkedAfter}) — D10 says it must not`);
    }
    console.log('  ✓ no AP location was checked by the pickup (D10)');

    // ── (4) one-shot within a loop, respawns on reset ───────────
    const home = await page.evaluate(async () => {
        const m = await import('./modules/mazeRoom/index.js');
        const w = m.getPanelInstance().world;
        return { x: w.entrance.x, y: w.entrance.y };
    });
    const rewalk = async () => {
        await page.evaluate(async ([region, x, y]) => {
            const m = await import('./modules/playbackBot/index.js');
            m.getActivePanel?.()?.getBot?.()?.walkToTile(region, x, y);
        }, [consRegion, home.x, home.y]);
        await page.waitForTimeout(1500);
        await page.evaluate(async ([region, x, y]) => {
            const m = await import('./modules/playbackBot/index.js');
            m.getActivePanel?.()?.getBot?.()?.walkToTile(region, x, y);
        }, [consRegion, consTile.x, consTile.y]);
        await page.waitForTimeout(2500);
    };

    await rewalk();
    const afterRewalk = await omsiEval(`resources.${goldKey}`);
    if (afterRewalk !== before + consTile.count) {
        fail(`re-walking the tile re-granted (${goldKey}=${afterRewalk}) — should be one-shot per loop`);
    }
    console.log('  ✓ re-walking the collected tile does NOT re-grant (one-shot per loop)');

    await page.evaluate(async () => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        centralRegistry.getPublicFunction('gameState', 'triggerLoopReset')();
    });
    console.log('  … fired a loop reset');
    await rewalk();
    const afterReset = await waitFor(page, logs,
        `omsi resources.${goldKey} reaches ${before + consTile.count * 2} after the reset`,
        async () => (await omsiEval(`resources.${goldKey}`)) === before + consTile.count * 2, 20000);
    if (!afterReset) fail('the tile did not respawn after a loop reset');
    console.log('  ✓ collected tiles respawn after a loop reset (X1-R1)');

    // ── (5) mana tile raises the pool ───────────────────────────
    await moveTo(manaRegion, consRegion);
    await waitFor(page, logs, `maze panel showing ${manaRegion}`, () => page.evaluate(async (r) => {
        const m = await import('./modules/mazeRoom/index.js');
        return m.getPanelInstance()?.currentRegionId === r;
    }, manaRegion));
    const poolBefore = await page.evaluate(async () => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        return centralRegistry.getPublicFunction('gameState', 'getCurrentMana')();
    });
    await page.evaluate(async ([region, x, y]) => {
        const m = await import('./modules/playbackBot/index.js');
        m.getActivePanel?.()?.getBot?.()?.walkToTile(region, x, y);
    }, [manaRegion, manaTile.x, manaTile.y]);
    const refilled = await waitFor(page, logs, `mana pool rises above ${poolBefore}`,
        async () => (await page.evaluate(async () => {
            const { centralRegistry } = await import('./app/core/centralRegistry.js');
            return centralRegistry.getPublicFunction('gameState', 'getCurrentMana')();
        })) > poolBefore, 30000);
    if (!refilled) fail('the mana tile did not raise the pool');
    console.log(`  ✓ generator-placed mana tile raised the pool above ${poolBefore} (X1-R4)`);

    const errors = logs.filter((l) => l.startsWith('[pageerror]'));
    if (errors.length > 0) fail('page errors:\n  ' + errors.join('\n  '));

    await browser.close();
    console.log('\nVERIFY MAZE CONSUMABLE TILES: OK');
    process.exit(0);
} catch (e) {
    console.log('\n‼ FAILURE:', e.message);
    await browser.close();
    process.exit(1);
}
