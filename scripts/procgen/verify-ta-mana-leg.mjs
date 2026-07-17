/**
 * In-app verify for the TEXT-ADVENTURE mana leg after its migration
 * onto the shared resourceChannels helpers (cross-game R1 slice 2).
 * The unit parity suites (mana.test.js / manaDeduction.test.js) pin
 * per-path behavior against fakes; this script is the independent
 * stratum: it drives the leg through the REAL app — real
 * gameState:regionChanged events from real dispatcher moves, real
 * procgenPlayer region info, real start-region resolution — and
 * observes deduction / XP / OOM-reset-teleport end to end.
 *
 * Fixture: jta_mixed_test (AdventureZone is a text_adventure region
 * with manaEnabled; Menu is substrate-less). The preset embeds
 * loop_costs, which auto-enables loop mode — the script disables loop
 * mode first (the direct-play leg is gated on loop mode INACTIVE).
 * The preset has no AP locations, so the location-check path is
 * covered by the unit suite only; this script exercises the
 * region-move charge and the depletion reset.
 *
 * What it asserts:
 *   1. Loop mode disabled → moving OUT of a non-mana region (Menu)
 *      charges nothing.
 *   2. Moving OUT of AdventureZone charges the region move cost (50)
 *      and awards 1:1 XP to AdventureZone.
 *   3. With mana below the move cost, departing AdventureZone
 *      depletes the pool → loop reset fires (count +1, mana refilled)
 *      and the player is teleported to the resolved start region.
 *
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run: node scripts/procgen/verify-ta-mana-leg.mjs
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:8000/frontend/?game=jta_mixed_test&seed=1';
const TIMEOUT_MS = 120000;

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

class VerifyFailure extends Error {}
function fail(msg) {
    throw new VerifyFailure(msg);
}

async function waitFor(desc, fn, ms = TIMEOUT_MS) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > ms) fail(`timeout waiting for ${desc}`);
        await new Promise((r) => setTimeout(r, 250));
    }
}

async function gameState() {
    return page.evaluate(async () => {
        const { getGameStateSingleton } = await import('./modules/gameState/singleton.js');
        let gs = null;
        try { gs = getGameStateSingleton(); } catch { return null; }
        if (!gs) return null;
        return {
            currentRegion: gs.getCurrentRegion(),
            currentMana: gs.getCurrentMana(),
            maxMana: gs.getMaxMana(),
            loopResetCount: gs.getLoopResetCount(),
            loopModeActive: !!gs.isLoopModeActive,
            adventureXP: gs.regionXP.get('AdventureZone') ?? null,
        };
    });
}

async function dispatchMove(sourceRegion, targetRegion) {
    await page.evaluate(async ({ sourceRegion, targetRegion }) => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        const getDispatcher = centralRegistry.getPublicFunction('loops', 'getLoopsModuleDispatcher');
        const dispatcher = getDispatcher?.();
        if (!dispatcher) throw new Error('no dispatcher');
        dispatcher.publish('user:regionMove', { sourceRegion, targetRegion }, { initialTarget: 'bottom' });
    }, { sourceRegion, targetRegion });
}

try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // 0. App up: gameState exists and a current region is set.
    const boot = await waitFor('gameState with current region', async () => {
        const s = await gameState();
        return s?.currentRegion ? s : null;
    });
    console.log('boot state:', JSON.stringify(boot));

    // Loop mode auto-enables when the embedded loop_costs finish
    // loading — a few seconds AFTER boot. Wait for that signal (so we
    // don't race it), then turn loop mode off: the direct-play mana
    // leg only charges when loop mode is inactive.
    await waitFor('loop mode auto-enable', async () => (await gameState()).loopModeActive, 30000)
        .catch(() => console.log('note: loop mode never auto-enabled; continuing'));
    await page.evaluate(async () => {
        const { getGameStateSingleton } = await import('./modules/gameState/singleton.js');
        getGameStateSingleton().setLoopModeActive(false);
    });
    await waitFor('loop mode off', async () => !(await gameState()).loopModeActive);

    // The resolved start region (= boot region: the first warehoused
    // region past the synthetic Menu wrapper — AdventureZone here) is
    // also where the OOM reset must teleport to.
    const resolvedStart = await page.evaluate(async () => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        return centralRegistry.getPublicFunction('procgenPlayer', 'getResolvedStartRegion')?.() ?? null;
    });
    if (!resolvedStart) fail('procgenPlayer resolved no start region');
    let s = await gameState();
    if (s.currentRegion !== 'AdventureZone') {
        await dispatchMove(s.currentRegion, 'AdventureZone');
        await waitFor('player in AdventureZone', async () => (await gameState()).currentRegion === 'AdventureZone');
    }
    const manaStart = (await gameState()).currentMana;

    // 1. AdventureZone → Menu: departing the manaEnabled TA region
    //    charges the region move cost (default 50 at XP level 0) and
    //    awards 1:1 XP.
    await dispatchMove('AdventureZone', 'Menu');
    await waitFor('player on Menu', async () => (await gameState()).currentRegion === 'Menu');
    s = await gameState();
    const charged = manaStart - s.currentMana;
    if (charged !== 50) fail(`expected 50 mana charged departing AdventureZone, got ${charged}`);
    if ((s.adventureXP?.xp ?? 0) !== 50) {
        fail(`expected 50 XP on AdventureZone, got ${JSON.stringify(s.adventureXP)}`);
    }
    console.log('PASS 1: depart charge 50 + 1:1 XP');

    // 2. Menu → AdventureZone: departing a NON-mana region charges nothing.
    const manaAtMenu = s.currentMana;
    await dispatchMove('Menu', 'AdventureZone');
    await waitFor('player in AdventureZone (again)', async () => (await gameState()).currentRegion === 'AdventureZone');
    s = await gameState();
    if (s.currentMana !== manaAtMenu) {
        fail(`departing Menu charged mana: ${manaAtMenu} -> ${s.currentMana}`);
    }
    console.log('PASS 2: no charge departing non-mana region');

    // 3. Depletion: mana now sits at 50 — exactly the next depart's
    //    cost (still XP level 0). Departing AdventureZone drains to 0
    //    → the leg fires the loop reset (count +1, refill to max) and
    //    teleports the player to the resolved start region, overriding
    //    the Menu move.
    const before = await gameState();
    if (before.currentMana !== 50) fail(`expected 50 mana before depletion step, got ${before.currentMana}`);
    await dispatchMove('AdventureZone', 'Menu');
    s = await waitFor('loop reset fired', async () => {
        const cur = await gameState();
        return cur.loopResetCount === before.loopResetCount + 1 ? cur : null;
    });
    if (s.currentMana !== s.maxMana) {
        fail(`reset did not refill mana: ${s.currentMana}/${s.maxMana}`);
    }
    await waitFor(`player teleported to resolved start '${resolvedStart}'`, async () => {
        const cur = await gameState();
        return cur.currentRegion === resolvedStart;
    });
    console.log(`PASS 3: depletion reset + refill + teleport to '${resolvedStart}'`);

    console.log('\nverify-ta-mana-leg: ALL PASS');
    await browser.close();
    process.exit(0);
} catch (err) {
    console.error(`\nverify-ta-mana-leg: FAIL — ${err.message}`);
    console.error('last console logs:');
    for (const l of logs.slice(-25)) console.error(' ', l);
    await browser.close();
    process.exit(1);
}
