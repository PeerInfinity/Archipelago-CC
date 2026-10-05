#!/usr/bin/env node
/**
 * Seedling solver-walk, slice W8 — can the wasm
 * Playback Bot ADOPT a room it never saw arrive (the COLD START), with no re-arrival? ⚖ The user (2026-10-03):
 * the solver must not need to exit and re-enter a room to solve it. Default build p4e, headless logic-only,
 * under the box lock; every session on a FRESH page (the wasm game runs out of memory after ~150–170 swaps).
 *
 * MEASURE (`wasmAdoptLab.js`, imported by URL; outside the engine):
 *   H  the house cold start, nobody touches it. Idle readouts (rng stable; ⛓ p4f: the live rng EQUALS the
 *      begin record — the tapeless build runs the cosmetic split; on p4e it sat 91 draws past); adopt; the chest solved from
 *      the shadow "arrival + N idle ticks" for N ∈ {0, 1, 19, ~elapsed, 2000} → ONE shadow (minus the tick
 *      count) and ONE plan; the plan played ON PLAN.
 *   P  a frame-exact PERSON (a same-world tape: right ×1, idle ×40, left ×1, idle ×40): back on the spawn to
 *      the bit, v = 0, no rng draw, persistence unchanged — the brief's test PASSES, but the player is turned
 *      (`side-stand`): the FACING clause is what catches it. (The itemless chest plan still plays on plan:
 *      facing reads only through an item.)
 *   R  rooms left UNWATCHED after a host jump (L7, L9, L13 — no Mobile, no timed puzzlement): adopted, every
 *      N ≥ 1 the same shadow and plan, each exit plan played on plan out of the room.
 * WITNESS (the engine, through the Playback Bot):
 *   W  `seedling_atlas_location`: the bot walks the house (chest, door) with **0 forced re-arrivals in total**
 *      — the cold start ADOPTED, the chest a continuation from "arrival + 1 idle tick", the door a continuation
 *      from the chest's held end; the chest checked once; 0 divergences; swaps 1 (the door).
 *   L  ⛓ W8b — LEVEL 0 (`seedling_atlas`, the bot from its hub): the room's two Mobiles besides the player,
 *      `introchar` and `statue2`, sampled idle (v 0, at their record positions, idle anim, no rng draw); the cold
 *      start ADOPTED with them admitted as inert NPCs (`wasmPlayback.INERT_MOBILES`) — the walk hub → house →
 *      chest spends **0 forced re-arrivals in total** (W8 spent one: refused `mobiles`); 0 divergences.
 *   N  ⛓ W8c / skip-intro — THE NEW GAME (`seedling_playthrough`, loaded by `?rules=`: the `?game=` form
 *      resolves another seed with no flash_panel). ⚖ 2026-10-03 the host's level-set reset SKIPS the intro
 *      (`seedlingRandomizerWiring.NEW_GAME_INTRO` false): the explicit start into level 0 at the game's boot
 *      position, so the begin record reads level 0, no wind cutscene, no `Help(2)` freeze. The CONTROLLER's
 *      own engine (its production deps) is driven at once (⛓ §5.16: the vanilla arm's map is now bound — checked;
 *      the Playback Bot's own walk is `probe-seedling-wasm-vanilla-map.mjs`): level 0's stairs, then L13's — the room
 *      ADOPTED straight through (no `ceremony` phase entered; W8c's ceremony stays as the fallback for a page
 *      that shows the intro, pinned in vitest), the L13 arrival held: **0 forced re-arrivals in total**, every
 *      held check equal, 0 divergences.
 *   K  a person's REAL keys move the player before the bot drives → the adoption is REFUSED by name (a
 *      clause: position / velocity / facing) and the named `cold-start` re-arrival serves the walk, which
 *      still finishes.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/probe-seedling-wasm-adopt.mjs [--host=http://localhost:8000] [--only=H,P,R,W,K,L,N]
 *      [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLASH_PANEL, clickPanelTab, createRoomPlay } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/** The house chest (the cold start of `seedling_atlas_location`). */
export const CHEST = { kind: 'location', level: 86, tag: 0, entityType: 'chest', name: 'Starting House - Chest' };
/** R — no-mobile, untimed rooms entered by a host jump and left unwatched; an exit the solver walks to. */
export const UNWATCHED_ROOMS = [
    { level: 7, x: 96, y: 32, goal: { kind: 'exit', level: 7, tiles: [[12, 2]], name: 'out_stairsdown_192_32' } },
    { level: 9, x: 80, y: 16, goal: { kind: 'exit', level: 9, tiles: [[1, 0]], name: 'out_teleporter_16_0' } },
    { level: 13, x: 64, y: 96, goal: { kind: 'exit', level: 13, tiles: [[2, 2]], name: 'out_stairsdown_32_32' } },
];
/** N — the new game's first rooms: level 0's stairs (beside the spawn (16, 128)), then L13's (W8's R room). */
export const NEW_GAME_LEGS = [
    { kind: 'exit', level: 0, tiles: [[2, 12]], name: 'out_stairsdown_32_192' },
    { kind: 'exit', level: 13, tiles: [[2, 2]], name: 'out_stairsdown_32_32' },
];
/** P — the frame-exact person: one tick right, settle, one tick left, settle (back on the spawn, turned). */
export const PERSON_KEYS = [['right'], ...Array(40).fill([]), ['left'], ...Array(40).fill([])];

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

/** In the GAME frame: count host `new Game` pushes (the forced re-arrivals' world swaps). */
function installSwapCounter() {
    const br = window.__swfBridge;
    if (window.__w8swaps) return true;
    const c = { hostNewGame: 0 };
    const q = br.queueItems.bind(br);
    br.queueItems = (items) => {
        for (const i of (Array.isArray(items) ? items : [items])) if (i?.invocation === 'new_instance' && i.className === 'Game') c.hostNewGame += 1;
        return q(items);
    };
    window.__w8swaps = c;
    return true;
}

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-adopt.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const SESSIONS = arg('only', 'H,P,R,W,K,L,N').split(',').filter(Boolean);
    /** The house walk (H/P/R/W/K) and ⛓ W8b's level-0 cold start (L: `seedling_atlas`, from its hub). */
    const presetOf = (game) => {
        const preset = JSON.parse(readFileSync(join(REPO, `frontend/presets/${game}/AP_1/AP_1_rules.json`), 'utf8'));
        const regions = preset.regions['1'];
        return { GAME: game, PRESET: preset, REGIONS: regions, START: regions.Menu.exits[0].connected_region };
    };
    const PRESETS = { house: presetOf('seedling_atlas_location'), level0: presetOf('seedling_atlas'), newGame: presetOf('seedling_playthrough') };
    const WASM_PAGE = PRESETS.house.PRESET.flash_panel?.wasm ?? '';
    if (!WASM_PAGE || !existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    for (const S of SESSIONS) {
        console.log(`INFO: ── session ${S} (a fresh page) ──`);
        // eslint-disable-next-line no-await-in-loop
        failed += await runSession(S);
    }
    await browser.close();
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

    async function runSession(S) {
        const { GAME, PRESET, REGIONS, START } = S === 'N' ? PRESETS.newGame : S === 'L' ? PRESETS.level0 : PRESETS.house;
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `w8-${S}` });
        const { check } = rp;
        const out = (tag, o) => console.log(`ROW ${tag} ${JSON.stringify(o)}`);
        const L = (fn, a) => page.evaluate(fn, a);
        const engine = () => page.evaluate(async () => {
            const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
            const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
            const e = c?._wasmEngine ?? null;
            return e ? JSON.parse(JSON.stringify({ stats: e.stats, status: e.status() })) : null;
        });
        /** Start the Playback Bot from START and wait for `finished`/`error:`. */
        async function botWalk(budgetMs = 240000) {
            if (!PRESET.sphere_log) {
                const locs = Object.values(REGIONS).flatMap((r) => r.locations ?? []);
                const HOUSE = Object.keys(REGIONS).find((k) => (REGIONS[k].locations ?? []).length > 0);
                const items = Object.fromEntries(locs.map((l) => [l.item.name, 1]));
                const LOG = [
                    { type: 'metadata', seed: 1, seed_name: '', event_locations: {}, event_items: {} },
                    { type: 'state_update', sphere_index: '0', player_data: { 1: { new_inventory_details: { base_items: {}, resolved_items: {} },
                        new_accessible_locations: locs.map((l) => l.name), new_accessible_regions: ['Menu', START, HOUSE], sphere_locations: [] } } },
                    { type: 'state_update', sphere_index: '0.1', player_data: { 1: { new_inventory_details: { base_items: items, resolved_items: items },
                        new_accessible_locations: [], new_accessible_regions: [], sphere_locations: locs.map((l) => l.name) } } },
                ].map((e) => JSON.stringify(e)).join('\n');
                await page.evaluate(async (text) => {
                    const { getSphereStateSingleton } = await import('./modules/sphereState/singleton.js');
                    return getSphereStateSingleton().loadSphereLog('probe-seedling-wasm-adopt:implied', text);
                }, LOG);
            }
            const booted = await page.evaluate(async (start) => {
                const bus = (await import('./app/core/eventBus.js')).default;
                bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'tests');
                const { getActivePanel } = await import('./modules/playbackBot/index.js');
                for (let i = 0; i < 50 && !getActivePanel()?.getBot?.(); i++) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => { setTimeout(r, 100); });
                }
                const bot = getActivePanel()?.getBot?.();
                if (!bot) return { ok: false, why: 'no playback bot panel' };
                bot.onRegionMove({ targetRegion: start });
                bot.refresh();
                await bot.play();
                return { ok: true, region: bot.getCurrentRegion() };
            }, START);
            check(`${S}: the bot is mounted in ${START}`, booted.ok && booted.region === START, JSON.stringify(booted));
            await clickPanelTab(page, FLASH_PANEL).catch(() => null);
            const t0 = Date.now();
            let last = '';
            let end = null;
            while (Date.now() - t0 < budgetMs) {
                // eslint-disable-next-line no-await-in-loop
                end = await page.evaluate(async () => {
                    const { getActivePanel } = await import('./modules/playbackBot/index.js');
                    const bot = getActivePanel()?.getBot?.();
                    return { status: bot?.getStatus?.() ?? '' };
                });
                if (end.status !== last) { console.log(`INFO: +${((Date.now() - t0) / 1000).toFixed(1)} s bot: ${end.status}`); last = end.status; }
                if (end.status.startsWith('finished') || end.status.startsWith('error')) break;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(500);
            }
            return end;
        }
        /** Solve `goal` for each N, compare the shadows and plans, play one on plan. */
        async function sweepN({ tag, level, goal, Ns, hold }) {
            const sol = await L(({ Ns2, g, lv }) => Ns2.map((N) => window.__adopt.solveN(window.__staging, g, lv, N)), { Ns2: Ns, g: goal, lv: level });
            for (const s of sol) out(`${tag} solve`, { N: s.N, refusal: s.refusal, error: s.error, keys: s.solution?.length, verbs: s.verbs, last: s.expected?.at(-1) });
            const ok = sol.filter((s) => s.solution && s.N >= 1);
            check(`${tag}: every N ≥ 1 → the SAME shadow (minus the tick count) and the SAME plan`,
                ok.length === Ns.filter((n) => n >= 1).length && ok.every((s) => s.digestNoT === ok[0].digestNoT && JSON.stringify(s.solution) === JSON.stringify(ok[0].solution)),
                JSON.stringify(sol.map((s) => [s.N, s.solution?.length ?? null, s.error ?? s.refusal ?? ''])));
            const n0 = sol.find((s) => s.N === 0);
            out(`${tag} N=0 plan == N≥1 plan`, { same: !!n0?.solution && JSON.stringify(n0.solution) === JSON.stringify(ok[0]?.solution) });
            const pick = ok.at(-2) ?? ok[0];
            if (!pick) return;
            const pl = await L(({ keys, expected, lv, h }) => window.__adopt.play(window.__staging, keys, expected, { hold: h, roomLevel: lv }),
                { keys: pick.solution, expected: pick.expected, lv: level, h: hold });
            out(`${tag} play N=${pick.N}`, pl);
            check(`${tag}: the adopted plan (N=${pick.N}) played ON PLAN ${hold ? 'to its held end' : 'out of the room'}`,
                !pl.error && pl.div === null && (hold ? pl.outcome === 'held' : pl.endLevel !== level), JSON.stringify(pl));
        }

        try {
            // ⛓ W8c — the playthrough by its rules file: `?game=seedling_playthrough&seed=1` loads another seed (no flash_panel).
            await page.goto(S === 'N' ? `${HOST}/frontend/?rules=./presets/${GAME}/AP_1/AP_1_rules.json` : `${HOST}/frontend/?game=${GAME}&seed=1`,
                { waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            await rp.installWatchers();
            await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            await rp.waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
            await rp.waitFor('start button enabled', () => rp.gameFrame().evaluate(() => {
                const b = document.getElementById('btn-start');
                return !!b && !b.disabled;
            }));
            await rp.gameFrame().click('#btn-start');
            await assertLogicOnlyChannel(rp.gameFrame());
            await rp.waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
                document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);
            await rp.waitFor('the AP load finished', () => page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                return !!p?._apLoadResult;
            }), 120000);
            await rp.waitFor('dispatcher wrapped', () => page.evaluate(async () => {
                window.__checks = window.__checks ?? [];
                const { getActivePanelInstance } = await import('./modules/flashPanel/index.js');
                const d = getActivePanelInstance()?.adapter?.dispatcher ?? null;
                if (!d) return false;
                if (!d.__w8) {
                    const orig = d.publish.bind(d);
                    d.publish = (n, p, o) => {
                        if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                        return orig(n, p, o);
                    };
                    d.__w8 = true;
                }
                return true;
            }), 20000);
            await page.waitForTimeout(1500);
            await rp.gameFrame().evaluate(installSwapCounter);
            await page.evaluate(async () => {
                const { createLab } = await import('/scripts/procgen/wasmAdoptLab.js');
                window.__adopt = await createLab();
            });

            if (S === 'H' || S === 'P') {
                const r0 = await L(() => { const { _seam, _status, _state, ...rest } = window.__adopt.readouts(); return rest; });
                out(`${S} boot readouts`, r0);
                const idle = await L(() => window.__adopt.idleSamples(3000, 600));
                out(`${S} idle`, idle);
                check(`${S}: idle in the house the rng takes NO draw`, idle.every((s) => s.rng === idle[0].rng), JSON.stringify(idle.map((s) => s.rng)));
                // ⛓ p4f (3′b): the tapeless boot runs the COSMETIC split, so the house build's tile draws (91 on
                // p4e) land on the cosmetic stream and the live gameplay rng EQUALS the begin record at rest.
                // (`split` below is botStatus's echo of the last tape's flag, false after botReset — not the live one.)
                check(`${S}: p4f — the live rng EQUALS the begin record at rest (the tapeless build drew only cosmetic; echo split ${r0.split})`,
                    r0.rngFromBegin === 0, `LFSR distance ${r0.rngFromBegin}`);
                if (S === 'P') {
                    const pr = await L(async (keys) => {
                        const a = window.__adopt;
                        const r = a.readouts();
                        const { stagingFromWasmArrival } = await import('/frontend/modules/seedlingDemo/wasmArrival.js');
                        const { staging } = stagingFromWasmArrival({ seam: r._seam, status: r._status, state: r._state });
                        window.__savedSeam = r._seam; // the person's botLoadTape clears the begin record: keep the cold start's
                        return a.person(staging, keys);
                    }, PERSON_KEYS);
                    out('P person', pr);
                }
                const ad = await L(async (S2) => {
                    const a = window.__adopt;
                    const r = a.readouts();
                    if (S2 === 'P') { r._seam = window.__savedSeam; r.beginEntry = window.__savedSeam.beginEntry; r.rngFromBegin = a.rngDistance(r.beginEntry['rng.gameplay'], r.rng); }
                    const res = await a.adopt(r, 86);
                    const { staging, ...rest } = res;
                    window.__staging = staging;
                    const { _seam, _status, _state, ...rr } = r;
                    return { readouts: rr, ...rest };
                }, S);
                out(`${S} adopt`, ad);
                const c = ad.clauses ?? {};
                if (S === 'H') {
                    check('H: nobody touched it — at spawn, v 0, facing down, no other Mobile, no hits: ALL true', c.atSpawn && c.vZero && c.facingDown && c.noOtherMobiles && c.noHits, JSON.stringify(c));
                } else {
                    check('P: after the person the brief\'s clauses PASS — back on the spawn to the bit, v 0 (the latch), no rng draw, persistence unchanged',
                        c.atSpawn && c.vZero && c.noOtherMobiles && c.noHits && ad.readouts.rngFromBegin === 0 && ad.readouts.persistence.length === 0,
                        JSON.stringify({ c, rngFromBegin: ad.readouts.rngFromBegin }));
                    check('P: …but the player is TURNED: the facing clause (botMobiles\' stand animation) FAILS — the model\'s shadow faces down',
                        c.facingDown === false && /side-stand$/.test(ad.readouts.player.anim ?? '') && ad.shadow1?.direction === 3, JSON.stringify({ anim: ad.readouts.player.anim, shadow: ad.shadow1 }));
                }
                const est = Math.max(2, ad.readouts.gt - ad.readouts.beginEntry['save.time'] - 19);
                await sweepN({ tag: S, level: 86, goal: CHEST, Ns: [0, 1, 19, est, 2000], hold: true });
            }

            if (S === 'R') {
                for (const room of UNWATCHED_ROOMS) {
                    // eslint-disable-next-line no-await-in-loop
                    const j = await L(({ level, x, y }) => window.__adopt.jump(level, x, y), room);
                    if (j.error) { check(`R L${room.level}: the host jump landed`, false, j.error); continue; }
                    // eslint-disable-next-line no-await-in-loop
                    await page.waitForTimeout(3000); // the room runs UNWATCHED: no hold
                    // eslint-disable-next-line no-await-in-loop
                    const ad = await L(async (level) => {
                        const a = window.__adopt;
                        const r = a.readouts();
                        const res = await a.adopt(r, level);
                        const { staging, ...rest } = res;
                        window.__staging = staging;
                        const { _seam, _status, _state, ...rr } = r;
                        return { readouts: rr, ...rest };
                    }, room.level);
                    out(`R L${room.level} adopt`, ad);
                    const c = ad.clauses ?? {};
                    check(`R L${room.level}: unwatched, nobody touched it — at spawn, v 0, facing down, no other Mobile, no hits`,
                        !ad.error && c.atSpawn && c.vZero && c.facingDown && c.noOtherMobiles && c.noHits, JSON.stringify({ c, error: ad.error }));
                    const est = Math.max(2, ad.readouts.gt - ad.readouts.beginEntry['save.time'] - 19);
                    // eslint-disable-next-line no-await-in-loop
                    await sweepN({ tag: `R L${room.level}`, level: room.level, goal: room.goal, Ns: [0, 1, est, 2000], hold: false });
                    // eslint-disable-next-line no-await-in-loop
                    await page.waitForTimeout(1500);
                }
            }


            if (S === 'N') {
                // ⛓ skip-intro — the boot: the reset's EXPLICIT start (the intro skipped), no ceremony running.
                const boot = await L(() => {
                    const a = window.__adopt;
                    const r = a.readouts();
                    const ls = JSON.parse(a.game().botLevelSet());
                    return { begin: r.beginEntry, level: r.level, x: r.x, y: r.y, gt: r.gt, cutscene: r._status.cutscene, receive: r._status.receive_input,
                        freeze: r._state.freezeObjects, startLevel: ls.start_level, set: ls.active };
                });
                out('N boot', boot);
                const reset = await page.evaluate(async () => {
                    const r = (await import('./modules/flashPanel/index.js')).getActivePanelInstance()._apLoadResult;
                    const b = r?.steps?.find((x) => x.name === 'reset-begin')?.detail ?? null;
                    return { mode: r?.reset?.mode, intro: r?.reset?.intro, level: r?.reset?.level, landed: r?.reset?.landed, args: b?.args, boot: b?.bootPosition };
                });
                out('N reset', reset);
                check('N: the reset SKIPPED the intro — the explicit start into level 0 at the game\'s boot position',
                    reset.mode === 'explicit-start' && reset.intro === false && reset.level === 0 && reset.landed === true
                        && reset.args?.x === reset.boot?.x && reset.args?.y === reset.boot?.y, JSON.stringify(reset));
                check('N: the begin record reads level 0 (not the arm\'s −1), the set starts in level 0, the game stands in level 0',
                    boot.begin?.['begin.level'] === 0 && boot.startLevel === 0 && boot.level === 0, JSON.stringify(boot));
                check('N: no ceremony on the page — no wind cutscene, input taken, no freeze (no Help)',
                    boot.cutscene?.[0] === false && boot.receive === true && boot.freeze === false,
                    JSON.stringify({ cutscene: boot.cutscene, receive: boot.receive, freeze: boot.freeze }));
                const surf = await page.evaluate(async () => {
                    const s = (await import('./modules/flashPanel/index.js')).getActivePanelInstance().seedlingPlaybackSurface();
                    return { atlas: s.atlas?.arm ?? null, report: !!s.report };
                });
                // ⛓ §5.16 — the vanilla arm now binds its map (`realRoomPlaybackMap`); the Playback Bot's walk of this preset is
                // `probe-seedling-wasm-vanilla-map.mjs`. N keeps driving the controller's engine directly.
                check('N: the vanilla arm binds the flash_seedling name → cell map (§5.16; the generated report stays null)',
                    surf.atlas === 'vanilla' && !surf.report, JSON.stringify(surf));
                const run = await page.evaluate(async ({ legs }) => {
                    const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
                    const c = substrateRegistry.get('flash_seedling')?.getPlaybackController?.();
                    let engine = null;
                    for (let i = 0; i < 100 && !engine; i++) {
                        engine = c._engineFor(c._getSurface());
                        // eslint-disable-next-line no-await-in-loop
                        if (!engine) await new Promise((r) => { setTimeout(r, 100); });
                    }
                    if (!engine) return { error: 'the controller built no wasm engine' };
                    const game = () => c._getSurface().wasm.getGame();
                    const answers = [];
                    const legsOut = [];
                    for (const leg of legs) {
                        const doneBefore = engine.stats.done;
                        // The goal waits for the previous crossing's HELD arrival (W7), so the second walkTo comes after it.
                        for (let i = 0; i < 300 && leg !== legs[0] && engine.status().phase !== 'held'; i++) {
                            // eslint-disable-next-line no-await-in-loop
                            await new Promise((r) => { setTimeout(r, 100); });
                        }
                        answers.push(engine.walkTo(leg));
                        const t0 = performance.now();
                        let level = null;
                        while (performance.now() - t0 < 240000) {
                            // eslint-disable-next-line no-await-in-loop
                            await new Promise((r) => { setTimeout(r, 250); });
                            level = JSON.parse(game().readState()).level;
                            if (engine.stats.failed > 0 || (engine.stats.done > doneBefore && level !== leg.level)) break;
                        }
                        legsOut.push({ leg: leg.name, level, ms: Math.round(performance.now() - t0) });
                        if (engine.stats.failed > 0) break;
                    }
                    const st = engine.stats;
                    return { answers, legs: legsOut, stats: JSON.parse(JSON.stringify({ adopted: st.adopted, forced: st.forced, forcedBy: st.forcedBy,
                        adoptRefused: st.adoptRefused, ceremonies: st.ceremonies, dismissed: st.dismissed, held: st.held, heldChecks: st.heldChecks,
                        continuations: st.continuations, divergences: st.divergences, recoveries: st.recoveries, failed: st.failed, done: st.done,
                        hostStarts: st.hostStarts.map((h) => h.label), history: st.history.map((h) => ({ goal: h.goal?.name, outcome: h.outcome,
                            continuation: h.continuation ?? false, prefix: h.prefix ?? 0, divergence: h.divergence ?? null, reason: h.reason ?? null })) })) };
                }, { legs: NEW_GAME_LEGS });
                out('N run', run);
                const st = run.stats ?? {};
                check('N: the first goal ADOPTED straight through — no ceremony entered, nothing dismissed',
                    run.answers?.[0]?.action !== 'await-ceremony' && (st.ceremonies ?? []).length === 0 && (st.dismissed ?? []).length === 0
                        && st.adopted === 1 && st.hostStarts?.[0] === 'adopt',
                    JSON.stringify({ answer: run.answers?.[0], ceremonies: st.ceremonies, dismissed: st.dismissed, hostStarts: st.hostStarts }));
                check('N: both legs crossed — level 0 → L13, then out of L13', run.legs?.length === 2 && run.legs[0].level === 13 && run.legs[1].level !== 13,
                    JSON.stringify(run.legs));
                check('N: 0 forced re-arrivals IN TOTAL, nothing refused',
                    st.forced === 0 && Object.keys(st.forcedBy ?? {}).length === 0 && (st.adoptRefused ?? []).length === 0,
                    JSON.stringify({ forced: st.forced, forcedBy: st.forcedBy, refused: st.adoptRefused }));
                // A held CHECK is taken at a continuation only; the L13 leg is a held ARRIVAL (freeze + plan) — measured: 1 check, 3 holds.
                check('N: the adoption\'s held check equal (the adopted room == the shadow "arrival + 1 idle tick"); the L13 and L14 arrivals HELD',
                    (st.heldChecks ?? []).length === 1 && st.heldChecks[0].shipped === 1 && st.heldChecks[0].equal && st.held === 3,
                    JSON.stringify({ heldChecks: st.heldChecks, held: st.held }));
                check('N: 0 divergences, 0 recoveries, 0 failed', st.divergences === 0 && st.recoveries === 0 && st.failed === 0,
                    JSON.stringify({ d: st.divergences, r: st.recoveries, f: st.failed, history: st.history }));
            }
            if (S === 'L') {
                // ⛓ W8b — level 0's NPC Mobiles, untouched: sampled idle (v 0, at the record, idle anim, no rng draw) and admitted.
                const samples = await L(async () => {
                    const a = window.__adopt;
                    const rows = [];
                    for (let i = 0; i < 6; i++) {
                        const st = a.status();
                        const npc = (a.mobiles().mobiles ?? []).filter((r) => !/Player/.test(r.cls))
                            .map((r) => ({ cls: r.cls, x: r.x, y: r.y, vx: r.vx, vy: r.vy, anim: r.anim, type: r.type, destroy: r.destroy, collidable: r.collidable }));
                        rows.push({ gt: st.game_time, rng: st.rng?.state, x: st.x, y: st.y, npc: JSON.stringify(npc) });
                        // eslint-disable-next-line no-await-in-loop
                        await new Promise((r) => { setTimeout(r, 500); });
                    }
                    return rows;
                });
                out('L idle', { n: samples.length, gt: [samples[0].gt, samples.at(-1).gt], npc: [...new Set(samples.map((r) => r.npc))] });
                const npc0 = JSON.parse(samples[0].npc);
                check('L: level 0 holds exactly introchar + statue2, v 0, idle, at (152,296) / (208,160) — unchanged over 2.5 s of ticks',
                    new Set(samples.map((r) => r.npc)).size === 1 && samples.at(-1).gt > samples[0].gt
                        && JSON.stringify(npc0.map((r) => [r.cls, r.x, r.y, r.vx, r.vy]).sort()) === JSON.stringify([['NPCs::IntroCharacter', 152, 296, 0, 0], ['NPCs::Statue', 208, 160, 0, 0]]),
                    samples[0].npc);
                check('L: idle in level 0 the rng takes NO draw and the player stays put', samples.every((r) => r.rng === samples[0].rng && r.x === samples[0].x && r.y === samples[0].y),
                    JSON.stringify(samples.map((r) => [r.rng, r.x, r.y])));
                const end = await botWalk();
                const eng = await engine();
                const st = eng?.stats ?? {};
                const swaps = await rp.gameFrame().evaluate(() => window.__w8swaps);
                const checks = await L(() => window.__checks ?? []);
                console.log(`INFO: L adopted ${st.adopted}; adoptRefused ${JSON.stringify(st.adoptRefused)}; forced ${st.forced} ${JSON.stringify(st.forcedBy)}; `
                    + `continuations ${st.continuations}; heldChecks ${JSON.stringify(st.heldChecks)}; hostStarts ${JSON.stringify((st.hostStarts ?? []).map((h) => h.label))}; `
                    + `host new Game ${swaps?.hostNewGame}`);
                check('L: the bot FINISHED the seedling_atlas walk from the hub', (end?.status ?? '').startsWith('finished'), `status "${end?.status}"`);
                // The one host `new Game` left is the region GLUE's redirect into the house (W7 §5.12 measured it), not the engine's:
                // the engine's re-arrivals are `forced`. W8 walked 2 (its cold-start re-arrival + the redirect).
                check('L: level 0\'s cold start ADOPTED — 0 forced re-arrivals IN TOTAL, nothing refused; host new Game 1 = the glue\'s redirect only',
                    st.adopted === 1 && st.forced === 0 && Object.keys(st.forcedBy ?? {}).length === 0 && (st.adoptRefused ?? []).length === 0
                        && swaps?.hostNewGame === 1 && (st.hostStarts ?? [])[0]?.label === 'adopt',
                    JSON.stringify({ adopted: st.adopted, forced: st.forced, forcedBy: st.forcedBy, refused: st.adoptRefused, swaps }));
                check('L: every held check equal (the adopted level 0 == the shadow "arrival + 1 idle tick")',
                    (st.heldChecks ?? []).length >= 1 && st.heldChecks[0].shipped === 1 && st.heldChecks.every((h) => h.equal),
                    JSON.stringify(st.heldChecks));
                const chestName = Object.values(REGIONS).flatMap((r) => r.locations ?? []).map((l) => l.name).find((n) => /Chest/.test(n));
                check('L: the chest checked EXACTLY ONCE', checks.filter((n) => n === chestName).length === 1, JSON.stringify(checks));
                check('L: 0 divergences, 0 recoveries', st.divergences === 0 && st.recoveries === 0, JSON.stringify({ d: st.divergences, r: st.recoveries }));
            }

            if (S === 'W' || S === 'K') {
                if (S === 'K') {
                    await rp.focusGame();
                    const moved = await rp.keyMovesPlayer('ArrowRight', 2, 800);
                    check('K: a person\'s real ArrowRight moved the player before the bot drove', moved.moved, JSON.stringify(moved));
                    await page.waitForTimeout(1000);
                }
                const end = await botWalk();
                const eng = await engine();
                const st = eng?.stats ?? {};
                const swaps = await rp.gameFrame().evaluate(() => window.__w8swaps);
                const moves = await rp.glueMoves();
                const checks = await L(() => window.__checks ?? []);
                const legs = (st.history ?? []).map((h) => ({ goal: h.goal?.name ?? h.goal?.kind, outcome: h.outcome, continuation: h.continuation ?? false,
                    prefix: h.prefix ?? 0, ticks: h.ticks, divergence: h.divergence ?? null, heldEnd: h.heldEnd ?? null }));
                console.log(`INFO: ${S} legs ${JSON.stringify(legs)}`);
                console.log(`INFO: ${S} adopted ${st.adopted}; adoptRefused ${JSON.stringify(st.adoptRefused)}; forced ${st.forced} ${JSON.stringify(st.forcedBy)}; `
                    + `continuations ${st.continuations}; heldChecks ${JSON.stringify(st.heldChecks)}; hostStarts ${JSON.stringify((st.hostStarts ?? []).map((h) => h.label))}; `
                    + `swaps host ${swaps?.hostNewGame} + doors ${(moves ?? []).length}`);
                check(`${S}: the bot FINISHED`, (end?.status ?? '').startsWith('finished'), `status "${end?.status}"`);
                const chestName = Object.values(REGIONS).flatMap((r) => r.locations ?? []).map((l) => l.name).find((n) => /Chest/.test(n));
                check(`${S}: the chest checked EXACTLY ONCE`, checks.filter((n) => n === chestName).length === 1, JSON.stringify(checks));
                check(`${S}: 0 divergences, 0 recoveries`, st.divergences === 0 && st.recoveries === 0, JSON.stringify({ d: st.divergences, r: st.recoveries }));
                if (S === 'W') {
                    check('W: the cold start was ADOPTED — 0 forced re-arrivals IN TOTAL, 0 host new Game', st.adopted === 1 && st.forced === 0
                        && Object.keys(st.forcedBy ?? {}).length === 0 && (st.adoptRefused ?? []).length === 0 && swaps?.hostNewGame === 0,
                        JSON.stringify({ adopted: st.adopted, forced: st.forced, forcedBy: st.forcedBy, refused: st.adoptRefused, swaps }));
                    check('W: chest and door are both CONTINUATIONS (prefix 1 = the idle tick; then 1 + the chest\'s keys), each after an exact held check',
                        st.continuations === 2 && legs[0]?.continuation && legs[0].prefix === 1 && legs[0].heldEnd === true
                            && legs[1]?.continuation && legs[1].prefix === 1 + legs[0].ticks && (st.heldChecks ?? []).every((h) => h.equal),
                        JSON.stringify({ legs, heldChecks: st.heldChecks }));
                    check('W: world swaps = 1 (the door) — W7 walked 2 (the cold start\'s new Game + the door)', swaps?.hostNewGame + (moves ?? []).length === 1,
                        `host ${swaps?.hostNewGame} + doors ${(moves ?? []).length}`);
                } else {
                    const clause = st.adoptRefused?.[0]?.clause;
                    check('K: the adoption was REFUSED by name (the moved player is not "the arrival + idle ticks")', st.adopted === 0
                        && ['position', 'velocity', 'facing'].includes(clause), JSON.stringify(st.adoptRefused));
                    check('K: …and the named cold-start re-arrival served the walk (forced 1, cold-start)', st.forced === 1 && st.forcedBy?.['cold-start'] === 1,
                        JSON.stringify(st.forcedBy));
                }
            }
            console.log(`INFO: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s) (the logic-only channel's device loss)`);
        } catch (e) {
            check(`fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
        }
        await page.close();
        return rp.failures();
    }
}
