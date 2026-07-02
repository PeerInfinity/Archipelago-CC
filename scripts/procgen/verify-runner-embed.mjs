/**
 * Runner phase-9 gate (plan §4.9, phase table row 9) — the full
 * embed round-trip on a SPHERE-GROWN world, first check → Victory,
 * driven end to end by the phase-8 playback bot (no
 * sendLocation/sendExit shortcuts — every check and region move is the
 * game playing itself). verify-bounce-embed.mjs is the template;
 * verify-runner-bot.mjs supplies the bot-driving surface.
 *
 * The committed preset (runner_sphere_worldgen, seed 1,
 * preserved-dev-presets.txt) is the dump-sphere-growth →
 * world_generator → Generate.py round-trip of a runner-only 3-sphere
 * world: S1=[Blue Platforms] S2=[Double Jump] S3=[Victory].
 *
 *   region_2_2 (start)  loc_0=Blue Platforms   exit_S  = blue stone gap
 *   region_2_3          loc_0=Double Jump      exit_E  = dj gap,
 *                       back portal exit_br0 (N, UNGATED early tip)
 *   region_3_3          loc_0=Victory          back portal only (W)
 *
 * Sequence: check loc_0 → wait for the ability IN-GAME (items must
 * flow host → bridge pollItems → setItems, not just into the host
 * inventory) → cross the gate the ability unsuppresses → repeat →
 * Victory. Then the ungated back portal is played once (region_3_3 →
 * region_2_3) — the §4.9 back-portal contract, driven on real physics.
 *
 * Requires the dev server on :8000.
 * Run: node scripts/procgen/verify-runner-embed.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const PRESET = 'frontend/presets/runner_sphere_worldgen/AP_14089154938208861744/'
    + 'AP_14089154938208861744_rules.json';
const rules = JSON.parse(readFileSync(PRESET, 'utf8'));
const canonical = rules.canonical_placements['1'];

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

let failures = 0;
const ok = (cond, label) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}`);
    if (!cond) failures++;
};

await page.goto('http://localhost:8000/frontend/?game=runner_sphere_worldgen&seed=1');

function runnerFrame() {
    const f = page.frames().find((fr) => fr.url().includes('runnerDemo/game/index.html'));
    if (!f) throw new Error('runner iframe not found');
    return f;
}
const status = () => runnerFrame().evaluate(
    () => document.getElementById('status')?.textContent ?? '');
const gameDebug = () => runnerFrame().evaluate(
    () => window.__runnerDebug?.() ?? null).catch(() => null);

async function waitFor(desc, fn, timeoutMs = 90000, everyMs = 300) {
    const start = Date.now();
    for (;;) {
        let v = null;
        try { v = await fn(); } catch { /* frame not ready yet */ }
        if (v) return v;
        if (Date.now() - start > timeoutMs) {
            const dbg = await gameDebug();
            console.log('BOT STATUS:', JSON.stringify(dbg?.botStatus ?? null));
            console.log('PAGE LOGS (last 15):', logs.slice(-15).join('\n'));
            throw new Error(`timeout waiting for: ${desc}`);
        }
        await page.waitForTimeout(everyMs);
    }
}

async function snapshot() {
    return page.evaluate(async () => {
        const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
        await proxy.pingWorker('sync');
        const s = proxy.uiCache ?? {};
        return { inventory: s.inventory ?? null, checked: s.checkedLocations ?? null };
    });
}

/** walkTo through the injected host-side PlaybackProxy — the exact
 *  surface loops' executeVia: 'playbackBot' drives. */
async function walkTo(target) {
    return page.evaluate(async (t) => {
        const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
        const controller = substrateRegistry.get('runner')?.getPlaybackController?.();
        if (!controller) return false;
        controller.walkTo(t);
        return true;
    }, target);
}

/** Bot-drive one location check, then wait for the granted item to
 *  reach BOTH the host inventory and the in-game session (abilities
 *  unsuppress geometry only after setItems). */
async function checkLocation(region, apName) {
    const item = canonical[apName];
    ok(await walkTo({ kind: 'location', name: apName }), `walkTo ${apName} dispatched`);
    const snap = await waitFor(`${apName} checked by the bot`, async () => {
        const s = await snapshot();
        return s.checked?.includes?.(apName) ? s : null;
    });
    ok(Number(snap.inventory?.[item]) > 0,
        `bot drove a real user:locationCheck (${apName}) — ${item} in host inventory`);
    const dbg = await waitFor(`${item} received IN-GAME`, async () => {
        const d = await gameDebug();
        return d?.items?.includes?.(item) ? d : null;
    });
    ok(dbg.items.includes(item), `${item} reached the game session (setItems)`);
}

/** Bot-drive one region move. */
async function moveTo(exitName, expectRegion) {
    ok(await walkTo({ kind: 'exit', name: exitName }), `walkTo exit ${exitName} dispatched`);
    await waitFor(`region ${expectRegion} loaded`, async () =>
        (await status()).includes(`region: ${expectRegion}`) ? true : null);
    ok(true, `bot drove a real user:regionMove -> ${expectRegion}`);
}

// ── boot: sphere-grown preset builds the warehouse, start region
//    configured into the iframe (preset_sidecars round-trip) ──
await waitFor('start region region_2_2 configured into the runner iframe', async () =>
    (await status()).includes('region: region_2_2') ? true : null, 120000);
ok(true, 'sphere-grown preset booted to region_2_2 from preset_sidecars');

// ── first check → Victory, every leg played by the bot ──
await checkLocation('region_2_2', 'region_2_2__loc_0');       // Blue Platforms
await moveTo('exit_S', 'region_2_3');                         // blue stone gap
await checkLocation('region_2_3', 'region_2_3__loc_0');       // Double Jump
await moveTo('exit_E', 'region_3_3');                         // dj gap
await checkLocation('region_3_3', 'region_3_3__loc_0');       // Victory

const final = await snapshot();
ok(Number(final.inventory?.Victory) > 0, 'Victory granted — first check → Victory complete');
ok(final.checked.length === 3, `all 3 sphere checks collected (${final.checked.length})`);

// ── the §4.9 back-portal contract, played: region_3_3's entrance-side
//    portal is UNGATED geometry — the bot returns without any item gate ──
await moveTo('region_2_3', 'region_2_3');
ok(true, 'ungated back portal played (region_3_3 -> region_2_3)');

const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'))
    .filter((l) => !l.includes("Couldn't find skill") && !l.includes('isLoopModeActive'))
    // benign handled probe: <game>_textadventure.json 404s on every
    // non-text game load (textAdventureSubstrateWrapper)
    .filter((l) => !l.includes('404'));
ok(errors.length === 0, `no page errors${errors[0] ? ` — first: ${errors[0].slice(0, 200)}` : ''}`);

await browser.close();
if (failures) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
}
console.log('\nAll runner embed checks passed (sphere-grown world, bot-driven).');
