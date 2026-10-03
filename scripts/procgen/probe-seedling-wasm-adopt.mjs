#!/usr/bin/env node
/**
 * Seedling solver-walk, slice W8 (plan `NewDocs/plans/seedling-js-solver-walk-plan.md` §5.13) — can the wasm
 * Playback Bot ADOPT a room it never saw arrive (the COLD START), with no re-arrival? ⚖ The user (2026-10-03):
 * the solver must not need to exit and re-enter a room to solve it. Default build p4e, headless logic-only,
 * under the box lock; every session on a FRESH page (the wasm game runs out of memory after ~150–170 swaps).
 *
 * MEASURE (`wasmAdoptLab.js`, imported by URL; outside the engine):
 *   H  the house cold start, nobody touches it. Idle readouts (rng stable; the live rng already sits the
 *      build's draws past the begin record, so "rng == begin" is never a clause); adopt; the chest solved from
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
 * Run: node scripts/procgen/probe-seedling-wasm-adopt.mjs [--host=http://localhost:8000] [--only=H,P,R,W,K]
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
    const SESSIONS = arg('only', 'H,P,R,W,K').split(',').filter(Boolean);
    const GAME = 'seedling_atlas_location';
    const PRESET = JSON.parse(readFileSync(join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const REGIONS = PRESET.regions['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const WASM_PAGE = PRESET.flash_panel?.wasm ?? '';
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
            await page.goto(`${HOST}/frontend/?game=${GAME}&seed=1`, { waitUntil: 'domcontentloaded' });
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
                check(`${S}: the live rng sits the BUILD's draws past the begin record already at rest (split ${r0.split}) — "rng == begin" can never be a clause`,
                    r0.rngFromBegin > 0, `LFSR distance ${r0.rngFromBegin}`);
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
                        c.atSpawn && c.vZero && c.noOtherMobiles && c.noHits && ad.readouts.rngFromBegin === 91 && ad.readouts.persistence.length === 0,
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
