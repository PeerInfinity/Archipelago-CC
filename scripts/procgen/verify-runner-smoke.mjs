import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import {
    buildRunGraph, findRunPath, planPlatformIds, canRunDetailed, ENTRANCE,
    policiesFor,
} from '../../frontend/modules/runnerDemo/canRun.js';
import { createGameSession } from '../../frontend/modules/runnerDemo/gameCore.js';

// Runner phase-7 gate (plan §5 row 7) — the shuffled-spiral runner world
// in the REAL frontend, no manual play:
//   1. ?game=runner_worldgen&seed=1 boots, procgenPlayer builds the
//      warehouse from preset_sidecars, publishes runner:loadRegion, the
//      iframe bridge handshakes (appReady) and configure() lands — all
//      proven by the game page's status line naming the start region.
//   2. The region actually renders (canvas non-blank screenshot).
//   3. A SOLVER WITNESS is replayed as the input tape: the canRun edge
//      witnesses for the start region's level are position-triggered
//      jump policies (`jump@X+HOLD`), fed to the live game as keyboard
//      presses when the player crosses each trigger x. The start
//      level's only route runs seg0→seg1→seg2→tip0 (no direct
//      seg2→seg3 edge — the branch tip hosts the mandatory landing),
//      so one clean life collects loc_0 on seg2 (a real
//      user:locationCheck) and then touches the tip's branch portal
//      exit_br0 (a real user:regionMove, side S → region_1_1).
//
// Requires the dev server on :8000.

const PRESET = 'frontend/presets/runner_worldgen/AP_14089154938208861744/'
    + 'AP_14089154938208861744_rules.json';
const START_REGION = 'region_1_0';

// ── Node side: build the witness tape from the preset itself ─────
const rules = JSON.parse(readFileSync(PRESET, 'utf8'));
const sidecars = rules.preset_sidecars['1'];
const payload = sidecars[START_REGION].playable_payload;
const level = payload.params.runnerLevel;
const C = payload.params.physics.constants;

// The run ends at the FIRST portal host along the path (its portal box
// sits in the host's auto-run wake), so walk toward the nearest portal
// host reachable with no abilities and cut the plan there.
const portalHosts = new Map(level.portals.map((p) => [p.on, p]));
const graph = buildRunGraph(level, {}, { constants: C });
let plan = null;
for (const host of portalHosts.keys()) {
    const res = findRunPath(graph, host);
    if (!res?.ok) continue;
    const ids = planPlatformIds(res.plan);
    const cutAt = ids.findIndex((id) => portalHosts.has(id));
    const cut = ids.slice(0, cutAt + 1);
    if (!plan || cut.length < plan.length) plan = cut;
}
if (!plan) throw new Error('no ability-free path to any portal host — bad preset?');
const endPortal = portalHosts.get(plan[plan.length - 1]);
const exits = payload.exits ?? [];
const endSide = Object.entries(payload.params.sidePortals)
    .find(([, pid]) => pid === endPortal.id)?.[0];
const expectRegion = exits.find((e) => e.side === endSide)?.targetRegion;
if (!expectRegion) throw new Error(`no exit for side ${endSide}`);

// Per-leg witness/policy -> tape event, CHAIN-VALIDATED against the
// real gameCore sim before touching the browser. Policies are
// position-triggered (`jump@X+HOLD`); the solver's per-leg witnesses
// sample each leg from a fresh arrival state, and one engine quirk
// doesn't survive the chain: `currentlyJumping` is only cleared on a
// grounded vy≈0 tick (which a running player never produces, since
// gravity integrates before that branch), so after the first jump of a
// life the coyote counter stays zeroed and MID-COYOTE triggers are
// dead. Grounded-trigger policies from the same solver family replay
// fine — so per leg we take the witness policy plus the leg's other
// jump policies as candidates, prefer grounded triggers, and greedily
// pick the first whose whole-chain sim (spawn -> ... -> leg target)
// lands. (The phase-8 bot is naturally immune: it forward-sims
// candidates from the LIVE state.)
const parsePolicy = (name) => {
    const m = /^jump@(-?[\d.]+)\+(\d+)$/.exec(name);
    return m ? { kind: 'jump', triggerX: parseFloat(m[1]), holdTicks: parseInt(m[2], 10) } : null;
};

// Simulate a tape prefix on the real game session; true iff the player
// reaches `targetId` without dying first.
function chainSimReaches(events, targetId, maxTicks = 800) {
    const session = createGameSession(level, { constants: C });
    let idx = 0;
    let holdLeft = 0;
    for (let t = 0; t < maxTicks; t++) {
        const ev = events[idx];
        if (ev && holdLeft === 0 && session.state.x >= ev.triggerX - 0.001) {
            holdLeft = ev.holdTicks;
            idx++;
        }
        const jump = holdLeft > 0;
        if (holdLeft > 0) holdLeft--;
        for (const e of session.tick({ jump, drop: false, reset: false })) {
            if (e.type === 'respawned') return false;
        }
        if (session.state.standingOn === targetId) return true;
    }
    return false;
}

const tape = [];
const legIds = [ENTRANCE, ...plan];
for (let i = 1; i < legIds.length; i++) {
    const [from, to] = [legIds[i - 1], legIds[i]];
    const r = canRunDetailed(level, from, to, {}, { constants: C });
    if (!r.ok) throw new Error(`leg ${from} -> ${to} not solvable`);
    const w = r.witnesses[0];
    if (w?.policy === 'entry' || w?.policy === 'none') continue; // no input
    const fromPlatform = level.platforms.find((p) => p.id === from);
    const lip = fromPlatform.x + fromPlatform.w;
    const candidates = [
        ...(w ? [parsePolicy(w.policy)] : []),
        ...policiesFor(level, fromPlatform, {}, { constants: C })
            .map((p) => parsePolicy(p.name)),
    ].filter(Boolean)
        // grounded triggers first (see header), then max range/height
        .sort((a, b) => (b.triggerX <= lip) - (a.triggerX <= lip)
            || b.triggerX - a.triggerX || b.holdTicks - a.holdTicks);
    const picked = candidates.find((cand) => chainSimReaches([...tape, cand], to));
    if (!picked) throw new Error(`no chain-viable policy for leg ${from} -> ${to}`);
    tape.push({ ...picked, leg: `${from}->${to}` });
}
// The full tape must also touch the pickup + the end portal in-sim.
{
    const session = createGameSession(level, { constants: C });
    let idx = 0;
    let holdLeft = 0;
    const touched = new Set();
    for (let t = 0; t < 1000 && !touched.has('exit'); t++) {
        const ev = tape[idx];
        if (ev && holdLeft === 0 && session.state.x >= ev.triggerX - 0.001) {
            holdLeft = ev.holdTicks;
            idx++;
        }
        const jump = holdLeft > 0;
        if (holdLeft > 0) holdLeft--;
        for (const e of session.tick({ jump, drop: false, reset: false })) {
            if (e.type === 'pickup') touched.add(e.id);
            if (e.type === 'exit' && e.portalId === endPortal.id) touched.add('exit');
        }
    }
    if (!touched.has(level.pickups[0]?.id) || !touched.has('exit')) {
        throw new Error(`chain sim did not touch pickup+portal: ${[...touched]}`);
    }
}
const TICK_MS = 1000 / C.TICK_HZ;
for (const e of tape) e.holdMs = e.holdTicks * TICK_MS;
console.log(`TAPE (${level.id}; ends at ${endPortal.id} side ${endSide} -> ${expectRegion}):`);
for (const e of tape) console.log(' ', e.leg, e.kind, '@', e.triggerX, `hold ${Math.round(e.holdMs)}ms`);

// ── Browser side ─────────────────────────────────────────────────
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

await page.goto('http://localhost:8000/frontend/?game=runner_worldgen&seed=1');

function runnerFrame() {
    const f = page.frames().find((fr) => fr.url().includes('runnerDemo/game/index.html'));
    if (!f) throw new Error('runner iframe not found');
    return f;
}
const status = () => runnerFrame().evaluate(
    () => document.getElementById('status')?.textContent ?? '');

async function waitFor(desc, fn, timeoutMs = 30000, everyMs = 300) {
    const start = Date.now();
    for (;;) {
        let v = null;
        try { v = await fn(); } catch { /* frame not ready yet */ }
        if (v) return v;
        if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for: ${desc}`);
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

// 1. Warehouse + runner:loadRegion + appReady handshake + configure —
//    the game page's status line names the region only after the whole
//    chain has run.
const st0 = await waitFor('start region configured into the runner iframe', async () => {
    const t = await status();
    return t.includes(`region: ${START_REGION}`) ? t : null;
}, 60000);
ok(st0.includes(`level: ${level.id}`),
    `start region configured from preset_sidecars (${st0.slice(0, 60)}…)`);

// Host-side capture of the NEXT runner:loadRegion so the region move at
// the end is observed on the event pipeline, not just via iframe text.
await page.evaluate(async () => {
    const { default: eventBus } = await import('./app/core/eventBus.js');
    window.__runnerLoads = [];
    eventBus.subscribe('runner:loadRegion', (d) => window.__runnerLoads.push(d?.region_id),
        'verify-runner-smoke');
});

// 2. Canvas non-blank.
const pixels = await runnerFrame().evaluate(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Set();
    for (let i = 0; i < data.length; i += 16) {
        colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        if (colors.size > 4) break;
    }
    return { w: canvas.width, h: canvas.height, distinctColors: colors.size };
});
ok(pixels.distinctColors > 4,
    `region renders — canvas ${pixels.w}x${pixels.h} non-blank (${pixels.distinctColors}+ colors)`);

// 3. Replay the witness tape. The driver runs INSIDE the iframe (a 4ms
//    setInterval reading __runnerDebug directly and synthesizing the
//    same KeyboardEvents a player would) — cross-process polling is far
//    too coarse for the coyote-window triggers the witnesses use. A
//    fall (x snapping back to spawn) restarts the tape; the driver
//    stops when the level changes (the portal fired) or the tape runs
//    out (auto-run rides the wake to the portal on its own).
await runnerFrame().evaluate(([events, levelId]) => {
    const state = { idx: 0, lastX: -Infinity, attempts: 0, presses: 0, done: false };
    window.__tapeState = state;
    const press = (code, ms) => {
        state.presses++;
        window.dispatchEvent(new KeyboardEvent('keydown', { code }));
        setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code })), ms);
    };
    const iv = setInterval(() => {
        const d = window.__runnerDebug();
        const p = d?.player;
        if (!p) return;
        if (d.levelId !== levelId) { // region moved — tape's job is done
            state.done = true;
            clearInterval(iv);
            return;
        }
        if (p.x < state.lastX - 1.5) state.idx = 0, state.attempts++; // respawn
        state.lastX = p.x;
        const ev = events[state.idx];
        if (!ev || p.x < ev.triggerX - 0.03) return;
        state.idx++;
        const code = ev.kind === 'drop' ? 'KeyS' : 'Space';
        press(code, ev.holdMs);
        if (ev.airDelayMs != null) {
            setTimeout(() => press(code, ev.airHoldMs), ev.airDelayMs);
        }
    }, 4);
}, [tape, level.id]);

// 4. The pickup on the way (seg2's loc_0) landed as a REAL
//    user:locationCheck…
const checkedName = `${START_REGION}__${level.pickups[0].id}`;
const snapA = await waitFor(`${checkedName} checked`, async () => {
    const s = await snapshot();
    return s.checked?.includes?.(checkedName) ? s : null;
}, 90000);
const tapeState = await page.evaluate(() => {
    const f = [...document.querySelectorAll('iframe')]
        .find((el) => el.src.includes('runnerDemo/game/index.html'));
    return f?.contentWindow?.__tapeState ?? null;
}).catch(() => null);
console.log('tape state:', JSON.stringify(tapeState));
ok(true, `pickup drove user:locationCheck (${checkedName})`);
const grantedItem = rules.canonical_placements?.['1']?.[checkedName];
ok(!grantedItem || Number(snapA.inventory?.[grantedItem]) > 0,
    `granted item reached the host inventory (${grantedItem})`);

// 5. …and the portal drove a REAL user:regionMove into the expected
//    neighbor, observed both on the event pipeline and in the iframe.
await waitFor(`region ${expectRegion} loaded`, async () =>
    (await status()).includes(`region: ${expectRegion}`));
ok(true, `portal ${endPortal.id} drove user:regionMove -> ${expectRegion}`);
const loads = await page.evaluate(() => window.__runnerLoads);
ok(loads.includes(expectRegion),
    `runner:loadRegion published for ${expectRegion} (host eventBus)`);

const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'))
    .filter((l) => !l.includes("Couldn't find skill") && !l.includes('isLoopModeActive'))
    // textAdventureSubstrateWrapper probes <game>_textadventure.json for
    // every loaded game and handles the miss (null customData); the
    // browser still logs the bare 404. Benign for non-text games.
    .filter((l) => !l.includes('404'));
ok(errors.length === 0, `no page errors${errors[0] ? ` — first: ${errors[0].slice(0, 200)}` : ''}`);

await browser.close();
if (failures) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
}
console.log('\nAll runner smoke checks passed.');
