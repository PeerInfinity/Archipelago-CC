#!/usr/bin/env node
/**
 * Seedling JS solver-walk, slice W0 (plan `seedling-js-solver-walk-plan.md` §5.3) —
 * MEASURE ONLY: can the wasm game take a HOST-BUILT tape mid-play, on the LIVE
 * flashPanel page (the `seedling_atlas_location` atlas world, default build p4e)?
 *
 * It prints measured rows; it asserts nothing about what the answer SHOULD be,
 * apart from the setup it depends on (`SETUP:` rows, which fail the run).
 *
 *   Session F (fresh page) — the FAKE-CHECK hazard, and (iii) on a game door:
 *     F-iii  a real ArrowDown onto the locked house door (no key): the game's
 *            Teleporter fires, the glue bounces; an in-iframe sampler records
 *            when pendingExit / level / beginEntry move, against `game_time`;
 *            on the bounce's arrival it arms a ZERO-TICK `hold` tape and reads
 *            how many dead frames were left (= the host saw the arrival before
 *            the first stepped tick, by that many frames).
 *     F1     a tape re-declaring the live cleared set PLUS the chest's clear
 *            NOT last → does a `user:locationCheck` fire?
 *     F2     the same with the chest's clear LAST → does it fire?
 *   Session H (fresh page) — the honest path:
 *     H0     the chest for real (one check, key_blue arrives).
 *     H-ii   a zero-tick tape: boot = current level + SPAWN, the live cleared set
 *            and save arrays re-declared → region moves, checks, inventory,
 *            position, then a host item write still lands.
 *     H-i    zero-tick `hold` at rest: Game.time, bodies, a held key; then which
 *            verb releases it (botLoadTape / botStart / botReset / botLoadLevels);
 *            a world swap requested WHILE held.
 *     H-iii  out through the door with the key, back in through the maze: the
 *            glue's resume arrival, instrumented like F-iii.
 *
 * ⚠ `parseTape` SORTS `persistence` by (level, tag), and BridgeGeneric reports
 * ONE `pendingCheck` per frame — so of a re-declared set only the row that
 * sorts LAST reaches the binding. F1/F2 therefore differ by sort position, not
 * by the order the rows are written in.
 * ⚠ The vanilla chest's SealPiece raises a `SealController` freeze that
 * `Bot.autoAdvance` does not dismiss: an armed tape counts dead frames through
 * it, which can confound H-i (the run says so with a SETUP FAIL).
 *
 * Flags: `--fiii=arm|observe|race` (F-iii arms on the landed `begin` record, only
 * samples, or arms on the LEVEL report — before the swap lands — and stops);
 * `--only=F` (session F only), `--only=J` (a host `jump`, armed on the landed
 * begin), `--only=S` (the post-chest freeze, sampled at 0/2/4/8/16 s, then X).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000);
 * the wasm build (the `flashPanel/wasm` submodule), or this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/probe-seedling-wasm-host-tape.mjs [--host=http://localhost:8000]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLASH_PANEL, clickPanelTab, createRoomPlay, slotBlockOf } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

/**
 * The in-iframe instrument, installed as `window.__w0`. Every verb call is
 * timed; the sampler runs on a 0 ms timer between the game's own frames.
 * Evaluated INSIDE the game frame, so it closes over nothing of node's.
 */
function installInstrument() {
    const g = () => window.__swfBridge.game;
    const timed = (name, ...args) => {
        const t0 = performance.now();
        const out = g()[name](...args);
        const ms = performance.now() - t0;
        (window.__w0.costs[name] ||= []).push(ms);
        return out;
    };
    const J = (s) => { try { return JSON.parse(s); } catch { return { __raw: s }; } };
    window.__w0 = {
        costs: {},
        timed,
        status: () => J(timed('botStatus')),
        seam: () => J(timed('botSeam')),
        state: () => J(g().readState()),
        /** Load + start one tape string; `{load, start}`. */
        play(tapeJson) {
            const load = timed('botLoadTape', tapeJson);
            const start = load === 'ok' ? timed('botStart') : null;
            return { load, start };
        },
        /**
         * Sample until `ms` elapse. `armOn(sample)` → a tape JSON to play the first
         * time it answers one (the act happens in the SAME JS turn as the sample).
         */
        sample(ms, armOn = null) {
            return new Promise((resolve) => {
                const rows = [];
                const t0 = performance.now();
                let armed = null;
                const step = () => {
                    const st = window.__w0.status();
                    const rs = window.__w0.state();
                    const se = window.__w0.seam();
                    const row = { t: +(performance.now() - t0).toFixed(1), gt: st.game_time, level: rs.level,
                        mainLevel: st.level, pendingExit: rs.pendingExit, spawn: [rs.playerPositionX, rs.playerPositionY],
                        begin: se.beginEntry ? se.beginEntry['begin.level'] : null,
                        beginTime: se.beginEntry ? se.beginEntry['save.time'] : null,
                        held: st.held, finished: st.finished, armed: st.armed, dead: st.dead_frames, x: st.x, y: st.y,
                        sa: st.saw_auto_advance, ri: st.receive_input, menu: st.menu_state, tick: st.tick };
                    if (!armed && armOn) {
                        const tape = armOn(row, rows);
                        if (tape) {
                            armed = { at: { ...row }, ...window.__w0.play(tape) };
                            row.act = { load: armed.load, start: armed.start };
                        }
                    }
                    if (rows.length === 0 || JSON.stringify({ ...rows.at(-1), t: 0 }) !== JSON.stringify({ ...row, t: 0 })) {
                        rows.push(row);
                    }
                    if (performance.now() - t0 < ms) setTimeout(step, 0);
                    else resolve({ rows, armed });
                };
                step();
            });
        },
    };
    return true;
}

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-wasm-host-tape.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const GAME = 'seedling_atlas_location';
    const PRESET = JSON.parse(readFileSync(join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const FLASH_DIR = join(REPO, 'frontend/modules/flashPanel');
    const WASM_PAGE = slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '';
    if (!WASM_PAGE || !existsSync(join(FLASH_DIR, 'wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const { parseTape, holdingWindowTape, gameVisibleTape } = await import(
        join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));

    const REGIONS = PRESET.regions['1'];
    const SIDECARS = PRESET.preset_sidecars['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const ROOM = SIDECARS[START].playable_payload;
    const DOOR = ROOM.exits[0];
    const CHILD = DOOR.targetRegion;
    const LOC = REGIONS[START].locations.find((l) => l.item?.name === 'key_blue');
    const ITEM = 'key_blue';

    /** A game-visible tape string (zero ticks unless `inputs`). */
    function tapeJson({ level, x, y, persistence = [], save = {}, hold = false, inputs = [] }) {
        const raw = { tape_version: 8, game: 'seedling', noclip: false, boot: { level, x, y }, inputs,
            noDamage: false, noHazards: [], grants: [], equips: [], pins: [],
            persistence: persistence.map((p) => ({ level: p.level, tag: p.tag, note: 'w0' })),
            save: { totem_parts: save.totem_parts ?? [], keys: save.keys ?? [], seal_parts: [] },
            rng: { seed: 0, split: false, cosmetic: 0, fp: 0 } };
        const t = parseTape(raw);
        return JSON.stringify(gameVisibleTape(hold ? holdingWindowTape(t) : t));
    }
    const indices = (bools) => (bools ?? []).flatMap((b, i) => (b ? [i] : []));

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let setupFailures = 0;
    const allLogs = [];
    const setup = (label, ok, detail = '') => {
        console.log(`${ok ? 'SETUP ok' : 'SETUP FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) setupFailures += 1;
        return ok;
    };
    const row = (id, what, value) => console.log(`ROW ${id} | ${what} | ${typeof value === 'string' ? value : JSON.stringify(value)}`);

    async function session(label) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        page.on('crash', () => logs.push('[CRASH] page crashed'));
        page.on('framedetached', (fr) => logs.push(`[detached] ${fr.url()}`));
        page.on('framenavigated', (fr) => logs.push(`[nav] ${fr === page.mainFrame() ? 'MAIN' : 'frame'} ${fr.url()}`));
        allLogs.push(logs);
        const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `w0-${label}` });
        await page.goto(`${HOST}/frontend/?game=${GAME}&seed=1`, { waitUntil: 'domcontentloaded' });
        await rp.waitFor('rules loaded', () => page.evaluate(
            () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
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
        // Every user:locationCheck on the shared dispatcher (glue's or adapter's).
        await rp.waitFor('dispatcher wrapped', () => page.evaluate(async () => {
            window.__checks = window.__checks ?? [];
            const { getActivePanelInstance } = await import('./modules/flashPanel/index.js');
            const d = getActivePanelInstance()?.adapter?.dispatcher ?? null;
            if (!d) return false;
            if (!d.__w0) {
                const orig = d.publish.bind(d);
                d.publish = (n, p, o) => {
                    if (n === 'user:locationCheck') window.__checks.push(p?.locationName ?? null);
                    return orig(n, p, o);
                };
                d.__w0 = true;
            }
            return true;
        }), 20000);
        await page.waitForTimeout(1500);
        await rp.gameFrame().evaluate(installInstrument);
        const w = (fn, a) => rp.gameFrame().evaluate(fn, a);
        const ap = () => page.evaluate(async () => {
            const snap = window.stateManagerProxy?.getLatestStateSnapshot?.();
            const glue = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
            return { inv: snap?.inventory ?? {}, checked: [...(snap?.checkedLocations ?? [])],
                checks: [...(window.__checks ?? [])], glue: glue?.stats ?? null,
                binding: glue?.checkBinding ? { ...glue.checkBinding.stats, checked: [...glue.checkBinding.checked] } : null,
                region: window.centralRegistry?.getPublicFunction('gameState', 'getCurrentRegion')?.() ?? null };
        });
        return { page, logs, rp, w, ap };
    }

    /** The live persistence/save readout and the spawn, for a re-declaring tape. */
    async function liveDeclaration(w) {
        return w(() => {
            const st = window.__w0.status();
            const rs = window.__w0.state();
            return { level: st.level, spawn: { x: rs.playerPositionX, y: rs.playerPositionY },
                cleared: st.persistence_cleared, save: st.save, live: { x: st.x, y: st.y }, gt: st.game_time,
                pendingCheck: rs.pendingCheck, items: st.items };
        });
    }

    /**
     * Arm a zero-tick hold tape on the first sample that shows `begin.level == level`
     * with the begin record CHANGED from the baseline (the world swap LANDED).
     */
    async function instrumentArrival(w, { level, declaredFrom, ms = 6000, trigger }) {
        const base = await w(() => window.__w0.seam().beginEntry);
        const sampling = w(({ lv, baseJson, decl, ms: dur }) => window.__w0.sample(dur, (r) => {
            const be = window.__w0.seam().beginEntry;
            if (!be || be['begin.level'] !== lv || JSON.stringify(be) === baseJson) return null;
            const rs = window.__w0.state();
            // The tape is built in-frame from the CURRENT spawn, so it is the arrival's own.
            const t = JSON.parse(decl);
            t.boot = { level: lv, x: rs.playerPositionX, y: rs.playerPositionY };
            return JSON.stringify(t);
        }), { lv: level, baseJson: JSON.stringify(base), decl: declaredFrom, ms });
        await trigger();
        const out = await sampling;
        const after = await w(() => ({ st: window.__w0.status(), seam: window.__w0.seam() }));
        return { ...out, after };
    }

    /** Play a tape and sample `ms`: a compact timeline [t, gt, armed, held, finished, dead, saw_auto_advance, receive_input, x, y]. */
    async function playAndWatch(w, tape, ms = 2500) {
        const r = await w((t) => window.__w0.play(t), tape);
        const smp = await w((d) => window.__w0.sample(d), ms);
        const se = await w(() => window.__w0.seam());
        return { r, tl: smp.rows.map((x) => [x.t, x.gt, x.armed, x.held, x.finished, x.dead, x.sa, x.ri, +x.x.toFixed(1), +x.y.toFixed(1)]),
            menu: smp.rows.at(-1)?.menu, latch: se.latched ? { blackCover: se.seam?.['arrival.blackCover'],
                freeze: se.seam?.['static.Game.freezeObjects'] } : null };
    }
    const releaseAll = (w) => w(() => window.__w0.timed('botReset'));

    if (arg('only', '') === 'S') {
        // The post-chest stall: does an armed zero-tick tape latch N s after the real chest?
        try {
            const S = await session('S');
            const s0 = await liveDeclaration(S.w);
            await S.rp.focusGame();
            const K = await S.rp.holdUntil('ArrowUp', async () => {
                const st = await S.rp.readGameState();
                return st.pendingCheck !== s0.pendingCheck ? st.pendingCheck : null;
            }, 6000);
            row('S.chest', 'pendingCheck', K);
            const t0 = Date.now();
            for (const waitS of [0, 2, 4, 8, 16]) {
                const left = waitS * 1000 - (Date.now() - t0);
                if (left > 0) await S.page.waitForTimeout(left);
                const d = await liveDeclaration(S.w);
                const tp = tapeJson({ level: d.level, x: d.spawn.x, y: d.spawn.y, persistence: d.cleared,
                    save: { totem_parts: indices(d.save.totem_parts), keys: indices(d.save.keys) } });
                const pw = await playAndWatch(S.w, tp, 700);
                row(`S.after${waitS}s`, 'zero-tick tape: [t,gt,armed,held,finished,dead,sa,ri,x,y] first/last; live',
                    { first: pw.tl[0], last: pw.tl.at(-1), latch: pw.latch, gtNow: d.gt, live: d.live });
                await releaseAll(S.w);
            }
            // Re-arm and dismiss with X (Player.keys[6]) — real keyboard.
            const d = await liveDeclaration(S.w);
            const tp = tapeJson({ level: d.level, x: d.spawn.x, y: d.spawn.y, persistence: d.cleared,
                save: { totem_parts: indices(d.save.totem_parts), keys: indices(d.save.keys) } });
            await S.w((t) => window.__w0.play(t), tp);
            await S.rp.focusGame();
            await S.page.keyboard.press('x');
            const pw = await S.w((ms) => window.__w0.sample(800), 800);
            row('S.afterX', 'armed tape after a real X press: last', pw.rows.at(-1));
            row('S.ap', 'AP', await S.ap());
        } catch (e) { setup(`S fatal ${e.stack}`, false); }
        await browser.close();
        process.exit(0);
    }
    if (arg('only', '') === 'J') {
        try {
            const J = await session('J');
            const jd = await liveDeclaration(J.w);
            const tJ = tapeJson({ level: jd.level, x: 0, y: 0, persistence: jd.cleared,
                save: { totem_parts: indices(jd.save.totem_parts), keys: indices(jd.save.keys) }, hold: arg('jhold', '1') === '1' });
            let res = null;
            try {
                res = await instrumentArrival(J.w, { level: jd.level, declaredFrom: tJ, ms: 4000,
                    trigger: () => J.rp.jump(jd.level, jd.spawn.x, jd.spawn.y) });
            } catch (e) { row('J.err', 'instrumentArrival threw', e.message); }
            if (res) {
                row('J.timeline', 'rows', res.rows.map((r) => [r.t, r.gt, r.level, r.begin, r.armed, r.held, r.finished, r.dead, r.act ? `ACT:${r.act.load}/${r.act.start}` : '']));
                row('J.after', 'status', { held: res.after.st.held, finished: res.after.st.finished, dead: res.after.st.dead_frames, err: res.after.st.error, blackCover: res.after.seam.seam?.['arrival.blackCover'], freeze: res.after.seam.seam?.['static.Game.freezeObjects'] });
            }
            await J.page.waitForTimeout(2000);
            console.log(`FRAMES: ${J.page.frames().map((f) => f.url()).join(' | ')}`);
            console.log(`J LOGS (last 50):\n${J.logs.filter((l) => !/BridgeGeneric\] (set|Wrote)/.test(l)).slice(-50).join('\n')}`);
        } catch (e) { setup(`J fatal ${e.stack}`, false); }
        await browser.close();
        process.exit(0);
    }
    try {
        // ════════════════ Session F ════════════════
        const F = await session('F');
        const decl0 = await liveDeclaration(F.w);
        setup('F: booted in level ' + ROOM.level, decl0.level === ROOM.level, JSON.stringify(decl0.spawn));
        row('F0', 'boot: persistence_cleared / save / spawn / live', { cleared: decl0.cleared, save: decl0.save,
            spawn: decl0.spawn, live: decl0.live, pendingCheck: decl0.pendingCheck });

        const restF = await playAndWatch(F.w, tapeJson({ level: decl0.level, x: decl0.spawn.x, y: decl0.spawn.y, hold: true }), 2000);
        row('F-i.rest', 'zero-tick hold at rest on a FRESH room (no chest yet)', restF);
        await releaseAll(F.w);
        await F.page.waitForTimeout(500);
        // F-iii: the locked door, game's own Teleporter, glue's bounce.
        const declF = tapeJson({ level: ROOM.level, x: 0, y: 0, persistence: decl0.cleared,
            save: { totem_parts: indices(decl0.save.totem_parts), keys: indices(decl0.save.keys) }, hold: true });
        // Arm on the SECOND landed begin (the bounce back into ROOM.level), not the door's own world.
        const baseSeam = await F.w(() => window.__w0.seam().beginEntry);
        await F.rp.focusGame();
        const sampFiii = F.w(({ lv, baseJson, decl, arm }) => {
            let sawOther = false;
            return window.__w0.sample(8000, () => {
                const be = window.__w0.seam().beginEntry;
                if (!be || JSON.stringify(be) === baseJson) return null;
                if (be['begin.level'] !== lv) {
                    sawOther = true;
                    // RACE: arm the instant the level REPORT reads lv, before the begin record does.
                    if (!(arm === 'race' && window.__w0.state().level === lv)) return null;
                } else if (!sawOther || arm !== 'arm') return null;
                const rs = window.__w0.state();
                const t = JSON.parse(decl);
                t.boot = { level: lv, x: rs.playerPositionX, y: rs.playerPositionY };
                return JSON.stringify(t);
            });
        }, { lv: ROOM.level, baseJson: JSON.stringify(baseSeam), decl: declF, arm: arg('fiii', 'arm') });
        await F.page.keyboard.down('ArrowDown');
        await F.page.waitForTimeout(2500);
        await F.page.keyboard.up('ArrowDown');
        const Fiii = await sampFiii;
        const FiiiAfter = await F.w(() => ({ st: window.__w0.status(), seam: window.__w0.seam() }));
        row('F-iii.timeline', 'sampler rows (t ms, game_time, level, pendingExit, begin.level, held, dead)',
            Fiii.rows.map((r) => [r.t, r.gt, r.level, r.pendingExit, r.begin, r.held, r.dead, r.act ? `ACT:${r.act.load}/${r.act.start}` : '']));
        row('F-iii.act', 'hold tape armed at', Fiii.armed);
        row('F-iii.result', 'after: finished/held/dead_frames/tick/error; seam arrival.blackCover; begin',
            { finished: FiiiAfter.st.finished, held: FiiiAfter.st.held, dead: FiiiAfter.st.dead_frames, tick: FiiiAfter.st.tick,
                error: FiiiAfter.st.error, blackCover: FiiiAfter.seam.seam?.['arrival.blackCover'], latched: FiiiAfter.seam.latched,
                level: FiiiAfter.st.level, x: FiiiAfter.st.x, y: FiiiAfter.st.y });
        row('F-iii.ap', 'AP side after the bounce', await F.ap());
        if (arg('fiii', 'arm') === 'race') {
            await F.page.waitForTimeout(2000);
            const stuck = await F.w(() => ({ st: window.__w0.status(), seam: window.__w0.seam(), rs: window.__w0.state() }));
            row('F-iii.race.2s', 'armed on the LEVEL report: 2 s later — held/level/readState level/begin/x,y',
                { held: stuck.st.held, finished: stuck.st.finished, dead: stuck.st.dead_frames, mainLevel: stuck.st.level,
                    begin: stuck.seam.beginEntry, latchLevel: stuck.seam.seam?.['level'] ?? stuck.seam.seam?.['boot.level'],
                    x: stuck.st.x, y: stuck.st.y, gt: stuck.st.game_time });
            row('F-iii.race.ap', 'AP side', await F.ap());
        }
        await releaseAll(F.w);
        await F.page.waitForTimeout(1500);
        row('F-iii.afterReset', 'after botReset: level/begin/held/x,y', await F.w(() => {
            const st = window.__w0.status(); const se = window.__w0.seam();
            return { level: st.level, begin: se.beginEntry, held: st.held, x: st.x, y: st.y, gt: st.game_time };
        }));
        if (arg('fiii', 'arm') === 'race') { await browser.close(); process.exit(0); }

        // F1 / F2: the fake chest clear.
        const declF1 = await liveDeclaration(F.w);
        // The chest tag: the binding's own table (level, tag) for the bound location.
        const chestKey = await F.page.evaluate(async (locName) => {
            const glue = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
            const b = glue?.checkBinding ?? null;
            return [...(b?.table?.values() ?? [])].filter((e) => e.location === locName)
                .map((e) => ({ level: e.level, tag: e.tag, location: e.location }));
        }, LOC.name);
        row('F.chestKey', 'the binding table entry for the location', chestKey);
        const tag = chestKey[0]?.tag;
        setup('F: the chest tag is read off the binding table', chestKey.length === 1 && Number.isInteger(tag)
            && chestKey[0].level === ROOM.level, JSON.stringify(chestKey));
        const apF0 = await F.ap();
        row('F1.before', 'AP side before', apF0);
        // The live set is EMPTY on a fresh room, so a non-location slot rides beside the fake one. ⚠ parseTape SORTS
        // persistence by (level, tag), so the filler must sort AFTER the chest: same level, the last tag.
        const otherClears = [...declF1.cleared.filter((c) => !(c.level === ROOM.level && c.tag === tag)), { level: ROOM.level, tag: 29 }];
        setup('F1: the filler clear is not a bound location', !chestKey.some((e) => e.level === ROOM.level && e.tag === 29));
        const t1 = tapeJson({ level: ROOM.level, x: declF1.spawn.x, y: declF1.spawn.y,
            persistence: [{ level: ROOM.level, tag }, ...otherClears],
            save: { totem_parts: indices(declF1.save.totem_parts), keys: indices(declF1.save.keys) } });
        const r1 = await playAndWatch(F.w, t1);
        const apF1 = await F.ap();
        const d1 = await liveDeclaration(F.w);
        row('F1', 'fake chest clear FIRST of ' + (otherClears.length + 1) + ': load/start; checks; key_blue; pendingCheck; live',
            { r1, checks: apF1.checks, keyBlue: apF1.inv[ITEM] ?? 0, checked: apF1.checked, pendingCheck: d1.pendingCheck,
                chestCleared: d1.cleared.some((c) => c.level === ROOM.level && c.tag === tag), live: d1.live, glue: apF1.glue });
        const t2 = tapeJson({ level: ROOM.level, x: declF1.spawn.x, y: declF1.spawn.y,
            persistence: [...otherClears, { level: ROOM.level, tag }],
            save: { totem_parts: indices(declF1.save.totem_parts), keys: indices(declF1.save.keys) } });
        const r2 = await playAndWatch(F.w, t2);
        const apF2 = await F.ap();
        const d2 = await liveDeclaration(F.w);
        row('F2', 'fake chest clear LAST: load/start; checks; key_blue; pendingCheck',
            { r2, checks: apF2.checks, keyBlue: apF2.inv[ITEM] ?? 0, checked: apF2.checked, pendingCheck: d2.pendingCheck,
                glue: apF2.glue });
        row('F.costs', 'verb call ms (count, median, max)', await F.w(() => Object.fromEntries(Object.entries(window.__w0.costs)
            .map(([k, v]) => { const s = [...v].sort((a, b) => a - b); return [k, [s.length, +s[s.length >> 1].toFixed(2), +s.at(-1).toFixed(2)]]; }))));
        await F.page.close();
        if (arg('only', '') === 'F') throw Object.assign(new Error('only F'), { onlyF: true });

        // ════════════════ Session H ════════════════
        const H = await session('H');
        const h0 = await liveDeclaration(H.w);
        setup('H: booted in level ' + ROOM.level, h0.level === ROOM.level);
        await H.rp.focusGame();
        const pc0 = h0.pendingCheck;
        const K = await H.rp.holdUntil('ArrowUp', async () => {
            const s = await H.rp.readGameState();
            return s.pendingCheck !== pc0 ? s.pendingCheck : null;
        }, 6000);
        await H.page.waitForTimeout(2500);
        const apH0 = await H.ap();
        setup('H0: the chest checked for real, once; key_blue held', apH0.checks.length === 1 && (apH0.inv[ITEM] ?? 0) >= 1,
            `${K.value}; ${JSON.stringify(apH0.checks)}`);

        // The vanilla chest's SealPiece raises a SealController freeze (Game.freezeObjects) that
        // Bot.autoAdvance does not dismiss; a real X (Player.keys[6]) does. Clear it so H-ii/H-i start live.
        await H.page.waitForTimeout(1500);
        await H.rp.focusGame();
        await H.page.keyboard.press('x');
        await H.page.waitForTimeout(1500);
        // H-ii: same-world start, live declaration re-declared.
        const hd = await liveDeclaration(H.w);
        row('H-ii.before', 'declaration read: level/spawn/live/cleared/save/pendingCheck', hd);
        const movesBefore = (await H.rp.glueMoves()).length;
        const tii = tapeJson({ level: hd.level, x: hd.spawn.x, y: hd.spawn.y, persistence: hd.cleared,
            save: { totem_parts: indices(hd.save.totem_parts), keys: indices(hd.save.keys) } });
        const rii = await playAndWatch(H.w, tii, 3000);
        const apH1 = await H.ap();
        const hd2 = await liveDeclaration(H.w);
        row('H-ii', 'load/start; region moves; checks; key_blue; checked; live before→after; spawn; pendingCheck before→after; cleared equal',
            { rii, moves: (await H.rp.glueMoves()).length - movesBefore, checks: apH1.checks, keyBlue: apH1.inv[ITEM] ?? 0,
                checked: apH1.checked, region: apH1.region, live: [hd.live, hd2.live], spawn: hd2.spawn,
                pendingCheck: [hd.pendingCheck, hd2.pendingCheck],
                clearedEqual: JSON.stringify(hd.cleared) === JSON.stringify(hd2.cleared), glue: apH1.glue,
                sealParts: [hd.save.seal_parts, hd2.save.seal_parts], keysSave: [hd.save.keys, hd2.save.keys],
                rebuilt: (await H.w(() => window.__w0.seam().beginEntry)) !== null });
        // A host item write after the host tape: the adapter path's own form.
        const write = await H.w(async () => {
            const seen = [];
            window.__swfBridge.queueItems({ class: 'main', property: 'hasSword', value: true });
            const t0 = performance.now();
            while (performance.now() - t0 < 1500) {
                // eslint-disable-next-line no-await-in-loop
                await new Promise((r) => setTimeout(r, 16));
                const s = window.__w0.status().items;
                const v = s?.sword ?? s?.hasSword ?? null;
                if (seen.length === 0 || seen.at(-1)[1] !== v) seen.push([+(performance.now() - t0).toFixed(0), v]);
            }
            return seen;
        });
        row('H-ii.write', 'a raw hasSword=true write after the host tape: items.sword over 1.5 s (the adapter re-clears it: not owned)', write);
        // The door WITH the key still works after the host tape (inventory intact as the gate reads it).

        // H-i: zero-tick hold at rest.
        const hi = await liveDeclaration(H.w);
        const tHold = tapeJson({ level: hi.level, x: hi.spawn.x, y: hi.spawn.y, persistence: hi.cleared,
            save: { totem_parts: indices(hi.save.totem_parts), keys: indices(hi.save.keys) }, hold: true });
        const rHold = await playAndWatch(H.w, tHold, 2500);
        const heldA = await H.w(() => window.__w0.status());
        await H.page.waitForTimeout(0);
        const mobA = await H.w(() => JSON.parse(window.__swfBridge.game.botMobiles()).mobiles.map((m) => [m.cls, m.x, m.y, m.frame]));
        await H.rp.focusGame();
        await H.page.keyboard.down('ArrowLeft');
        await H.page.waitForTimeout(1500);
        await H.page.keyboard.up('ArrowLeft');
        await H.page.waitForTimeout(500);
        const heldB = await H.w(() => window.__w0.status());
        const mobB = await H.w(() => JSON.parse(window.__swfBridge.game.botMobiles()).mobiles.map((m) => [m.cls, m.x, m.y, m.frame]));
        const seamHeld = await H.w(() => window.__w0.seam());
        row('H-i.hold', 'zero-tick hold at rest: load/start; held; finished; tick; dead; game_time A→B over 2 s with ArrowLeft held; player A→B; mobiles equal; seam blackCover',
            { rHold, held: [heldA.held, heldB.held], finished: heldA.finished, tick: heldA.tick, dead: heldA.dead_frames,
                gt: [heldA.game_time, heldB.game_time], player: [[heldA.x, heldA.y], [heldB.x, heldB.y]],
                mobilesEqual: JSON.stringify(mobA) === JSON.stringify(mobB), mobiles: mobA.length,
                blackCover: seamHeld.seam?.['arrival.blackCover'], latched: seamHeld.latched });
        setup('H-i: the zero-tick hold LATCHED and HELD before the swap test', heldA.held === true && heldB.held === true,
            JSON.stringify([heldA.held, heldB.held, heldA.dead_frames]));
        // A world swap requested WHILE held (the glue's jump form).
        const begin0 = (await H.w(() => window.__w0.seam())).beginEntry;
        await H.rp.jump(hi.level, hi.spawn.x, hi.spawn.y);
        await H.page.waitForTimeout(1500);
        const swapHeld = await H.w(() => ({ st: window.__w0.status(), seam: window.__w0.seam() }));
        row('H-i.swapWhileHeld', 'jump(new Game) queued while held: begin entry moved? held? game_time',
            { beginBefore: begin0, beginAfter: swapHeld.seam.beginEntry, held: swapHeld.st.held, gt: swapHeld.st.game_time });
        // Releases: botLoadTape alone, then botStart.
        const rel = {};
        rel.loadTape = await H.w((t) => { const r = window.__w0.timed('botLoadTape', t); const s = window.__w0.status(); return { r, held: s.held, gt: s.game_time }; }, tHold);
        await H.page.waitForTimeout(500);
        rel.loadTapeAfter500 = await H.w(() => { const s = window.__w0.status(); return { held: s.held, gt: s.game_time }; });
        rel.start = await H.w(() => { const r = window.__w0.timed('botStart'); const s = window.__w0.status(); return { r, held: s.held, armed: s.armed, gt: s.game_time }; });
        await H.page.waitForTimeout(1500);
        rel.startAfter = await H.w(() => { const s = window.__w0.status(); const se = window.__w0.seam(); return { held: s.held, finished: s.finished, dead: s.dead_frames, gt: s.game_time, level: s.level, begin: se.beginEntry }; });
        row('H-i.release.loadTape+start', 'botLoadTape alone keeps the hold? botStart releases (and the queued swap then lands)?', rel);
        // Now held again by that tape (it declared hold). botReset:
        const relR = await H.w(async () => {
            const before = window.__w0.status();
            const r = window.__w0.timed('botReset');
            const s = window.__w0.status();
            await new Promise((ok) => setTimeout(ok, 1000));
            const s2 = window.__w0.status();
            return { heldBefore: before.held, r, held: s.held, gt: [s.game_time, s2.game_time] };
        });
        row('H-i.release.reset', 'botReset on a held room', relR);
        // Hold again, then botLoadLevels('not json').
        const hj = await liveDeclaration(H.w);
        const tHold2 = tapeJson({ level: hj.level, x: hj.spawn.x, y: hj.spawn.y, persistence: hj.cleared,
            save: { totem_parts: indices(hj.save.totem_parts), keys: indices(hj.save.keys) }, hold: true });
        await H.w((t) => window.__w0.play(t), tHold2);
        await H.page.waitForTimeout(800);
        const relL = await H.w(async () => {
            const before = window.__w0.status();
            const r = window.__w0.timed('botLoadLevels', 'not json');
            const s = window.__w0.status();
            await new Promise((ok) => setTimeout(ok, 1000));
            const s2 = window.__w0.status();
            return { heldBefore: before.held, r, held: s.held, gt: [s.game_time, s2.game_time] };
        });
        row('H-i.release.loadLevels', "botLoadLevels('not json') on a held room", relL);
        await releaseAll(H.w);
        const apHi = await H.ap();
        row('H-i.ap', 'AP side after all holds/releases', apHi);

        // H-iii: out with the key, back in through the maze (the glue's resume arrival).
        await H.page.waitForTimeout(1000);
        await H.rp.focusGame();
        const pe0 = (await H.rp.readGameState()).pendingExit;
        const out = await H.rp.holdUntil('ArrowDown', async () => {
            const s = await H.rp.readGameState();
            return s.pendingExit !== pe0 ? s.pendingExit : null;
        }, 20000);
        const inChild = await H.rp.waitFor('maze owns the child', async () => ((await H.rp.currentRegion()) === CHILD ? CHILD : null), 15000).catch(() => null);
        setup('H-iii: out through the door WITH key_blue after the host tapes (AP gate intact)', inChild === CHILD,
            `${out.value}; region ${await H.rp.currentRegion()}`);
        await H.page.waitForTimeout(1500);
        const hk = await liveDeclaration(H.w);
        const tArr = tapeJson({ level: ROOM.level, x: 0, y: 0, persistence: hk.cleared,
            save: { totem_parts: indices(hk.save.totem_parts), keys: indices(hk.save.keys) }, hold: true });
        const again = await H.rp.mazeKeyPlan({ exitTo: START });
        const Hiii = await instrumentArrival(H.w, { level: ROOM.level, declaredFrom: tArr, ms: 8000,
            trigger: () => H.rp.pressKeys(again.keys ?? []) });
        row('H-iii.timeline', 'sampler rows (t ms, game_time, level, pendingExit, begin.level, held, dead)',
            Hiii.rows.map((r) => [r.t, r.gt, r.level, r.pendingExit, r.begin, r.held, r.dead, r.act ? `ACT:${r.act.load}/${r.act.start}` : '']));
        row('H-iii.act', 'hold tape armed at', Hiii.armed);
        row('H-iii.result', 'after: finished/held/dead/error; seam arrival.blackCover; position',
            { finished: Hiii.after.st.finished, held: Hiii.after.st.held, dead: Hiii.after.st.dead_frames, tick: Hiii.after.st.tick,
                error: Hiii.after.st.error, blackCover: Hiii.after.seam.seam?.['arrival.blackCover'], level: Hiii.after.st.level,
                x: Hiii.after.st.x, y: Hiii.after.st.y });
        await releaseAll(H.w);
        await H.page.waitForTimeout(1500);
        row('H-iii.ap', 'AP side at the end', await H.ap());
        row('H.costs', 'verb call ms (count, median, max)', await H.w(() => Object.fromEntries(Object.entries(window.__w0.costs)
            .map(([k, v]) => { const s = [...v].sort((a, b) => a - b); return [k, [s.length, +s[s.length >> 1].toFixed(2), +s.at(-1).toFixed(2)]]; }))));
        await H.page.close();
    } catch (err) {
        if (err.onlyF) { await browser.close(); console.log('PROBE COMPLETE (F only)'); process.exit(0); }
        setup(`fatal: ${err.stack}`, false);
        console.log(`PAGE LOGS (last 80):\n${(allLogs.at(-1) ?? []).slice(-80).join('\n')}`);
    } finally {
        await browser.close();
    }
    console.log(setupFailures === 0 ? 'PROBE COMPLETE' : `${setupFailures} SETUP FAILURE(S)`);
    process.exit(setupFailures === 0 ? 0 : 1);
}
