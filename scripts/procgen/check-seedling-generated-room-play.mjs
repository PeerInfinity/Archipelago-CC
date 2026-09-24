#!/usr/bin/env node
/**
 * Seedling generated levels, G2: a world whose Seedling rooms the procgen
 * pipeline GENERATED plays in the Seedling wasm. Its level set is ASSEMBLED
 * from the rules.json and DELIVERED when the game starts; the AP item in the
 * start room fires a real check; the game's own doors take the player into the
 * maze and into the other generated room.
 *
 * The world is the committed `seedling_generated_room` preset
 * (`make-seedling-spiral-room-preset.mjs --state=generated`, from
 * `SEEDLING_GENERATED_ROOM_STATE`). Every expectation is read from that preset,
 * or from the set the gate assembles from it headless (the same function the
 * page runs), never typed here.
 *
 *   ARM A — THE DELIVERY. ▶ Start; the panel log names the GENERATED arm; the
 *     game's `botLevelSet` reports the assembler's `set_id`, its room count
 *     (the generated rooms + the PARKING room) and its start level.
 *   ARM B — THE BOOT. The player is VISIBLE (the `Player` mobile in
 *     `botMobiles`) on the approach cell of the start room's first door, level
 *     0. W0 #4: how many `new Game(0, …)` landings the boot made and where
 *     (the glue's region arrival and the load's explicit-start reset).
 *   ARM C — THE CHECK. Real keys walk the player to the goal cell (the
 *     `apitem`): the game writes `pendingCheck`, ONE `user:locationCheck` is
 *     published for the start room's location, and the readout says
 *     "found <item> for you".
 *   ARM D — THE MAZE DOOR. Walk onto the start room's door to the maze: the
 *     game's own door report (`pendingExit`) names the door's tile, and its id
 *     arm (`out_teleporter_<x>_<y>` = the payload's `exit_id`) resolves it; ONE
 *     `user:regionMove` to the maze; the game's swap into the PARKING room is
 *     swallowed; the flash panel parks; the Maze Room tab is in front with the
 *     keyboard.
 *   ARM E — BACK. The maze walks to its exit back; the arrival lands on that
 *     door's APPROACH cell (the binding's `source_region` arm), the player
 *     visible and standing still.
 *   ARM F — GENERATED ↔ GENERATED. Walk onto the start room's door to the
 *     other generated room: the game's own `@to` lands in that room on the
 *     paired door's approach, AND the host's `regionMove` loads it (W0 #4's
 *     question, measured: one landing or two, and where). No park — both rooms
 *     are the same substrate.
 *
 * ⛔ PAGE ERRORS ARE A DIAGNOSTIC LINE, NOT A check() (the logic-only channel
 * loses the WebGPU device by design — see `check-seedling-spiral-room-play.mjs`).
 * The hands are `seedlingRoomPlay.js`'s, shared with the spiral and sphere gates.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default
 * http://localhost:8000); the wasm build (the `flashPanel/wasm` submodule), or
 * this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/check-seedling-generated-room-play.mjs [--host=http://localhost:8000] [--game=seedling_generated_room]
 * @ci-box enrolled beside check-seedling-spiral-room-play as a box row (seedling generated G2): its arms hold real keys for wall-clock durations against the Seedling wasm, measured only on this box's logic-only channel.
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { createRoomPlay, roomPath } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/**
 * ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door): the box
 * lock, the preset read and the browser all live in `main()`.
 */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'check-seedling-generated-room-play.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const GAME = arg('game', 'seedling_generated_room');

    const PRESET = JSON.parse(readFileSync(join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const FLASH_DIR = join(REPO, 'frontend/modules/flashPanel');
    const WASM_PAGE = PRESET.flash_panel?.wasm ?? '';
    const ARTIFACT = join(FLASH_DIR, 'wasm', dirname(WASM_PAGE));
    if (!WASM_PAGE || !existsSync(join(FLASH_DIR, 'wasm', WASM_PAGE))
        || !existsSync(join(ARTIFACT, `${dirname(WASM_PAGE)}.wasm`))) {
        console.log(`SKIP: seedling wasm artifact not staged at ${ARTIFACT} (the preset's flash_panel.wasm is `
            + `${JSON.stringify(WASM_PAGE)}) — see frontend/modules/flashPanel/README.md`);
        process.exit(0);
    }

    // ── What the preset says, and the set assembled from it (the page's own function) ──
    const M = (p) => import(join(REPO, 'frontend/modules', p));
    const { assembleGeneratedSeedlingSet, PARKING_ROOM_NAME } = await M('seedlingDemo/seedlingGeneratedSet.js');
    const { walkableCellsFrom } = await M('seedlingDemo/levelSetExits.js');
    const { buildLevelWorld } = await M('seedlingDemo/levelWorld.js');
    const SIDECARS = PRESET.preset_sidecars['1'];
    const START = PRESET.regions['1'].Menu.exits[0].connected_region;
    const ROOM = SIDECARS[START]?.playable_payload ?? null;
    const TILE = ROOM?.tile_size;
    const locationItem = new Map();
    for (const region of Object.values(PRESET.regions['1'])) {
        for (const l of region.locations ?? []) locationItem.set(l.name, l.item ?? null);
    }
    const SELF = Number(Object.keys(PRESET.player_names ?? { 1: '' })[0]);
    const ASSEMBLED = assembleGeneratedSeedlingSet(PRESET, {
        locationItemOf: (n) => (locationItem.get(n) ? { name: locationItem.get(n).name, player: locationItem.get(n).player } : null),
        selfPlayer: SELF,
    });
    const SET = ASSEMBLED.set;
    const LOC = ROOM?.locations?.[0] ?? null;
    const LOC_ITEM = LOC ? ASSEMBLED.table.get(`${ROOM.level}|${LOC.tag}`) : null;
    const MAZE_DOOR = ROOM?.exits.find((e) => SIDECARS[e.targetRegion]?.substrate !== SIDECARS[START].substrate) ?? null;
    const GEN_DOOR = ROOM?.exits.find((e) => SIDECARS[e.targetRegion]?.substrate === SIDECARS[START].substrate) ?? null;
    const OTHER = GEN_DOOR ? SIDECARS[GEN_DOOR.targetRegion].playable_payload : null;
    const PAIRED = OTHER?.exits.find((e) => e.targetRegion === START) ?? null;
    const cellOfPx = (p) => ({ tx: p.x / TILE, ty: p.y / TILE });

    /** The hazard-walled path planner (the shared hands' `roomPath`). */
    const pathIn = (payload, from, to) => roomPath(payload, from, to, { walkableCellsFrom, buildLevelWorld });

    const URL = `${HOST}/frontend/?game=${GAME}&seed=1`;
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const logs = [];
    page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const {
        check, failures, waitFor, gameFrame, readGameState, livePlayer, activeTabTitles, currentRegion,
        glueStats, glueMoves, activeSubstrates, arrival, installWatchers, focusGame, focusChain, gameHasKeys,
        invoked, parsePending, mazeHasKeys, readLevelSet, walkPath,
    } = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: 'check-seedling-generated-room-play' });

    const liveCell = async () => {
        const p = await livePlayer();
        return p ? { tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE), x: p.x, y: p.y } : null;
    };
    const panelLog = () => page.evaluate(() => document.querySelector('.flash-panel-log')?.textContent ?? '');
    const onApproach = (live, spawn) => !!live && Math.hypot(live.x - (spawn.x + TILE / 2), live.y - (spawn.y + TILE / 2)) <= 3;
    const landings = (level, spawn) => logs.filter((l) => l.includes(invoked(level, spawn))).length;
    const stillFor = async (ms = 2400) => {
        const samples = [];
        for (let t = 0; t < ms; t += 200) {
            // eslint-disable-next-line no-await-in-loop
            samples.push(await livePlayer());
            // eslint-disable-next-line no-await-in-loop
            await page.waitForTimeout(200);
        }
        return { still: samples.every((p) => p && Math.hypot(p.x - samples[0].x, p.y - samples[0].y) <= 1), samples };
    };
    /** Walk from the live cell to `target` in `payload`'s room; `stopWhen` ends it. */
    async function walkTo(label, payload, target, stopWhen) {
        await focusGame();
        const here = await liveCell();
        const path = here ? pathIn(payload, { tx: here.tx, ty: here.ty }, target) : null;
        check(`${label}: a walkable path from the player's cell ${JSON.stringify(here && { tx: here.tx, ty: here.ty })} `
            + `to ${JSON.stringify(target)} (doors are walls on the way)`, !!path, path ? `${path.length - 1} step(s)` : 'none');
        if (!path) return null;
        const walked = await walkPath(path, { tile: TILE, stopWhen });
        console.log(`  (${label}) path ${path.map((c) => `${c.tx},${c.ty}`).join(' ')} ; walked ${walked.trace.join(' ')}`);
        return { path, walked };
    }

    try {
        check('the preset carries the pieces the arms need, read off its own sidecars',
            !!ROOM && ROOM.generated === true && !!LOC && !!LOC_ITEM && !!MAZE_DOOR && !!GEN_DOOR && !!PAIRED,
            `start ${START}, location ${LOC?.name} (${LOC_ITEM?.item}), maze door ${MAZE_DOOR?.exit_id} -> `
            + `${MAZE_DOOR?.targetRegion}, generated door ${GEN_DOOR?.exit_id} -> ${GEN_DOOR?.targetRegion}`);
        check('the set assembled headless (the page\'s own function) validates and ends in the PARKING room',
            SET.rooms.at(-1)?.name === PARKING_ROOM_NAME && SET.rooms.length === ASSEMBLED.report.rooms + 1,
            `${SET.set_id}: ${SET.rooms.map((r) => r.name).join(', ')}`);

        // ── boot ────────────────────────────────────────────────────────────
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        await waitFor('rules loaded', () => page.evaluate(
            () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
        await installWatchers();
        check(`boot: the preset loaded and the player starts in ${START}`, (await currentRegion()) === START,
            await currentRegion());
        await waitFor('Flash Game tab activated', () => page.evaluate(() => {
            const tab = [...document.querySelectorAll('.lm_tab')].find((t) => t.title === 'Flash Game');
            if (!tab) return false;
            tab.click();
            return true;
        }));
        await waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
        await waitFor('start button enabled', () => gameFrame().evaluate(() => {
            const b = document.getElementById('btn-start');
            return !!b && !b.disabled;
        }));
        await gameFrame().click('#btn-start');
        await assertLogicOnlyChannel(gameFrame());
        await waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
            document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);

        // ── ARM A — the delivery ────────────────────────────────────────────
        const load = await waitFor('the AP load finished (the panel\'s own step log)', () => page.evaluate(async () => {
            const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
            const r = p?._apLoadResult;
            return r ? { ok: r.ok, why: r.why, steps: r.steps, reset: r.reset } : null;
        }), 120000);
        const log = await panelLog();
        check('ARM A: the panel log names the GENERATED arm (the fifth fact diverted)',
            /ap placement: the GENERATED arm — the rules carry 2 generated Seedling room\(s\)/.test(log)
            && log.includes(`— ${SET.set_id}`), log.split('\n').filter((l) => l.includes('ap placement')).join(' | '));
        const back = await readLevelSet();
        check('ARM A: botLevelSet reports the ASSEMBLED set — its set_id, every room incl. the PARKING room, its start level',
            back?.active === SET.set_id && back?.table_levels === SET.rooms.length && back?.start_level === SET.start.level,
            JSON.stringify(back));
        const delivered = load.steps.find((s) => s.name === 'deliver-end')?.detail;
        check('ARM A: the load delivered, reset and bound (ok, every step present)', load.ok === true
            && ['deliver-end', 'reset-end', 'bind'].every((n) => load.steps.some((s) => s.name === n)),
            `delivered ${JSON.stringify(delivered)}, reset ${JSON.stringify(load.reset && { mode: load.reset.mode, landed: load.reset.landed })}`);

        // ── ARM B — the boot position ───────────────────────────────────────
        const first = ROOM.exits[0];
        await page.waitForTimeout(1500);
        const st = await readGameState();
        const liveB = await liveCell();
        check(`ARM B: the player is VISIBLE on ${first.exit_id}'s APPROACH cell ${JSON.stringify(cellOfPx(first.entrance_spawn))}, level ${ROOM.level}`,
            st.level === ROOM.level && onApproach(liveB, first.entrance_spawn), `level ${st.level}, live ${JSON.stringify(liveB)}`);
        const statsB = await glueStats();
        console.log(`  (W0 #4) boot landings at new Game(${ROOM.level},${first.entrance_spawn.x},${first.entrance_spawn.y}): `
            + `${landings(ROOM.level, first.entrance_spawn)} — glue teleports ${statsB.teleports}, reset ${load.reset?.mode} `
            + `landed ${load.reset?.landed}; warnings ${statsB.warnings}`);
        check('ARM B: the boot made its landings without a warning and published no crossing',
            statsB.warnings === 0 && (await glueMoves()).length === 0, JSON.stringify(statsB));
        const chainB = await focusChain();
        check('ARM B: the game\'s CANVAS has the page\'s keyboard after ▶ Start (no click)', gameHasKeys(chainB), JSON.stringify(chainB));

        // ── ARM C — the check ───────────────────────────────────────────────
        const checksBefore = (await glueStats()).locationChecks;
        const pendingBefore = (await readGameState()).pendingCheck;
        const checked = async () => ((await readGameState()).pendingCheck !== pendingBefore);
        const walkC = await walkTo('ARM C', ROOM, LOC.cell, checked);
        check(`ARM C: real keys walked the player onto the goal cell ${JSON.stringify(LOC.cell)} and the game wrote pendingCheck`,
            !!walkC?.walked.ok && await checked(), JSON.stringify(walkC?.walked));
        const pc = (await readGameState()).pendingCheck;
        const statsC = await waitFor('the check binding published the check', async () => {
            const s = await glueStats();
            return s.locationChecks > checksBefore ? s : null;
        }, 10000).catch(() => null);
        const [, lvl, tag] = String(pc).split('|').map(Number);
        check(`ARM C: pendingCheck names (level ${ROOM.level}, tag ${LOC.tag}) and ONE user:locationCheck went out for ${LOC.name}`,
            lvl === ROOM.level && tag === LOC.tag && statsC?.locationChecks === checksBefore + 1
            && (await panelLog()).includes(`[ap placement] checked "${LOC.name}"`), `pendingCheck ${JSON.stringify(pc)}, ${JSON.stringify(statsC)}`);
        const found = `[ap placement] found ${LOC_ITEM.item} for ${LOC_ITEM.player === SELF ? 'you' : `Player ${LOC_ITEM.player}`} at "${LOC.name}"`;
        check(`ARM C: the readout says "found ${LOC_ITEM.item} for you"`, (await panelLog()).includes(found)
            && statsC?.itemsFound >= 1, found);

        // ── ARM D — the maze door ───────────────────────────────────────────
        const exitBefore = (await readGameState()).pendingExit;
        const fired = async () => ((await readGameState()).pendingExit !== exitBefore);
        const doorD = { tx: MAZE_DOOR.exit_tiles[0][0], ty: MAZE_DOOR.exit_tiles[0][1] };
        const walkD = await walkTo('ARM D', ROOM, doorD, fired);
        const pD = parsePending((await readGameState()).pendingExit);
        check(`ARM D: real keys walked onto ${MAZE_DOOR.exit_id} and the game fired it`, !!walkD?.walked.ok && !!pD,
            JSON.stringify((await readGameState()).pendingExit));
        check(`ARM D: the door report's id arm IS the payload's exit_id (out_${pD?.type}_${pD?.x}_${pD?.y})`,
            !!pD && `out_${pD.type}_${pD.x}_${pD.y}` === MAZE_DOOR.exit_id && pD.fromLevel === ROOM.level
            && pD.to === ASSEMBLED.report.parkingLevel, JSON.stringify(pD));
        const movesD = await waitFor('ONE regionMove to the maze', async () => {
            const m = await glueMoves();
            return m.length >= 1 ? m : null;
        }, 15000);
        check(`ARM D: ONE user:regionMove ${START} -> ${MAZE_DOOR.targetRegion} through ${MAZE_DOOR.exitName}`,
            movesD.length === 1 && movesD[0].sourceRegion === START && movesD[0].targetRegion === MAZE_DOOR.targetRegion
            && movesD[0].exitName === MAZE_DOOR.exitName, JSON.stringify(movesD));
        const parked = await waitFor('the game swaps into the PARKING room', async () => {
            const s = await readGameState();
            return s.level === ASSEMBLED.report.parkingLevel ? s : null;
        }, 10000).catch(() => null);
        await page.waitForTimeout(2500);
        const statsD = await glueStats();
        check(`ARM D: the game's own swap into the PARKING room (level ${ASSEMBLED.report.parkingLevel}) was swallowed — no second move; the panel PARKED`,
            !!parked && (await glueMoves()).length === 1 && statsD.parks === 1
            && (await activeSubstrates()).at(-1) === SIDECARS[MAZE_DOOR.targetRegion].substrate,
            `level ${parked?.level}, ${JSON.stringify(statsD)}, active ${JSON.stringify(await activeSubstrates())}`);
        const region = await waitFor('gameState follows', async () => ((await currentRegion()) === MAZE_DOOR.targetRegion) || null, 15000).catch(() => null);
        const mazeKeys = await waitFor('the maze panel has the keyboard', mazeHasKeys, 5000).catch(() => null);
        const tabs = await activeTabTitles();
        check('ARM D: gameState moved to the maze; the Maze Room tab is in front WITH the keyboard (no click)',
            !!region && tabs.includes('Maze Room') && typeof mazeKeys === 'string' && mazeKeys.startsWith('maze-room-panel'),
            `tabs ${tabs.join(', ')}, activeElement ${JSON.stringify(mazeKeys)}`);

        // ── ARM E — back through the maze ───────────────────────────────────
        const loadsBefore = (await glueStats()).loads;
        const crossed = await page.evaluate(async (want) => {
            const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
            const exit = [...p.world.exits.values()].find((e) => e.targetRegion === want);
            if (!exit) return { error: `no exit of ${p.currentRegionId} leads to ${want}` };
            const at = { ...p.state.player_pos };
            const onIt = at.x === exit.x && at.y === exit.y;
            const c = p.getPlaybackController();
            if (onIt) {
                // step off onto a floor neighbour first — an arrival stands ON the exit back
                const off = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy }))
                    .find((q) => q.x >= 0 && q.y >= 0 && q.x < p.world.width && q.y < p.world.height
                        && p.world.tiles[q.y * p.world.width + q.x] === 0 && !p.world.obstacles.has(`${q.x},${q.y}`));
                c.walkTo({ kind: 'tile', x: off.x, y: off.y });
                c.instant?.();
                for (let i = 0; i < 50 && (p.state.player_pos.x !== off.x || p.state.player_pos.y !== off.y); i += 1) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => setTimeout(r, 200));
                }
            }
            c.walkTo({ kind: 'exit', name: exit.exit_id });
            c.instant?.();
            return { from: p.currentRegionId, exit: exit.exit_id, stoodOn: onIt };
        }, START);
        check(`ARM E: the maze walked to its exit back to ${START}`, !crossed.error, JSON.stringify(crossed));
        await waitFor(`gameState back in ${START}`, async () => ((await currentRegion()) === START) || null, 20000);
        const wantE = MAZE_DOOR.entrance_spawn;
        await waitFor(`the arrival new Game(${ROOM.level},${wantE.x},${wantE.y})`,
            () => logs.some((l) => l.includes(invoked(ROOM.level, wantE))) || null, 20000);
        await page.waitForTimeout(1500);
        const a = await arrival();
        const liveE = await liveCell();
        const stillE = await stillFor();
        check(`ARM E: back in ${START} on ${MAZE_DOOR.exit_id}'s APPROACH ${JSON.stringify(cellOfPx(wantE))}, chosen by the source_region arm`,
            a.arrivedFrom?.source_region === MAZE_DOOR.targetRegion && a.spawn?.exitId === MAZE_DOOR.exit_id
            && a.spawn?.matchedArrivedFrom === true && onApproach(liveE, wantE),
            `arrivedFrom ${JSON.stringify(a.arrivedFrom)}, spawn ${JSON.stringify(a.spawn)}, live ${JSON.stringify(liveE)}`);
        check('ARM E: the player is VISIBLE and NOT WALKING after the return', stillE.still && !!liveE,
            stillE.samples.map((p) => (p ? `(${p.x.toFixed(1)},${p.y.toFixed(1)})` : 'null')).join(' '));
        const statsE = await glueStats();
        check('ARM E: the glue resumed and loaded the room again; no new crossing',
            statsE.loads === loadsBefore + 1 && statsE.resumes === 1 && (await glueMoves()).length === 1, JSON.stringify(statsE));

        // ── ARM F — generated ↔ generated ───────────────────────────────────
        const exitBeforeF = (await readGameState()).pendingExit;
        const firedF = async () => ((await readGameState()).pendingExit !== exitBeforeF);
        const doorF = { tx: GEN_DOOR.exit_tiles[0][0], ty: GEN_DOOR.exit_tiles[0][1] };
        const landingsBefore = landings(OTHER.level, PAIRED.entrance_spawn);
        const teleportsBefore = (await glueStats()).teleports;
        /**
         * ⛓ EVERY CHECKPOINT THE GAME TAKES, recorded INSIDE the frame at 16 ms: the
         * game's own `@to` construction writes `Main.playerPositionX/Y` = the door's
         * `playerx/playery`, and the glue's arrival teleport writes them again. A
         * gate that looked only at the end would see the glue's landing and pass a
         * wrong `@to` (a mutant did exactly that). The FIRST level-${OTHER?.level}
         * entry is the game's own.
         */
        await gameFrame().evaluate(() => {
            window.__landings = [];
            let last = '';
            window.__landingTimer = setInterval(() => {
                try {
                    const st = JSON.parse(window.__swfBridge.game.readState());
                    const k = `${st.level}|${st.playerPositionX}|${st.playerPositionY}`;
                    if (k !== last) { last = k; window.__landings.push({ t: Date.now(), level: st.level, x: st.playerPositionX, y: st.playerPositionY }); }
                } catch { /* the frame is mid-swap */ }
            }, 16);
        });
        const walkF = await walkTo('ARM F', ROOM, doorF, firedF);
        const pF = parsePending((await readGameState()).pendingExit);
        check(`ARM F: real keys walked onto ${GEN_DOOR.exit_id}; the door report's id arm IS its exit_id; @to = ${GEN_DOOR.targetRegion}'s level`,
            !!walkF?.walked.ok && !!pF && `out_${pF.type}_${pF.x}_${pF.y}` === GEN_DOOR.exit_id && pF.to === OTHER.level,
            JSON.stringify(pF));
        const movesF = await waitFor('the regionMove to the other generated room', async () => {
            const m = await glueMoves();
            return m.length >= 2 ? m : null;
        }, 15000).catch(async () => glueMoves());
        await waitFor(`gameState in ${GEN_DOOR.targetRegion}`, async () => ((await currentRegion()) === GEN_DOOR.targetRegion) || null, 15000).catch(() => null);
        await page.waitForTimeout(3000);
        const stF = await readGameState();
        const liveF = await liveCell();
        const statsF = await glueStats();
        const trail = await gameFrame().evaluate(() => { clearInterval(window.__landingTimer); return window.__landings; });
        const intoOther = trail.filter((l) => l.level === OTHER.level);
        console.log(`  (W0 #4) checkpoints recorded in the frame: ${trail.map((l) => `L${l.level}@(${l.x},${l.y})`).join(' -> ')}`);
        check(`ARM F: the GAME'S OWN @to (the first level-${OTHER.level} checkpoint) is the paired approach ${JSON.stringify(PAIRED.entrance_spawn)}`,
            intoOther.length >= 1 && intoOther[0].x === PAIRED.entrance_spawn.x && intoOther[0].y === PAIRED.entrance_spawn.y,
            JSON.stringify(intoOther));
        const glueLanded = landings(OTHER.level, PAIRED.entrance_spawn) - landingsBefore;
        check(`ARM F: ONE user:regionMove ${START} -> ${GEN_DOOR.targetRegion}; gameState follows; NO park (same substrate)`,
            movesF.length === 2 && movesF[1].targetRegion === GEN_DOOR.targetRegion
            && (await currentRegion()) === GEN_DOOR.targetRegion && statsF.parks === 1, `${JSON.stringify(movesF[1])}, ${JSON.stringify(statsF)}`);
        check(`ARM F: the player lands in level ${OTHER.level} on the PAIRED door's approach ${JSON.stringify(cellOfPx(PAIRED.entrance_spawn))}, visible`,
            stF.level === OTHER.level && onApproach(liveF, PAIRED.entrance_spawn), `level ${stF.level}, live ${JSON.stringify(liveF)}`);
        console.log(`  (W0 #4) gen↔gen landings: the game's own @to swap (no bridge line) + ${glueLanded} glue arrival `
            + `teleport(s) new Game(${OTHER.level},${PAIRED.entrance_spawn.x},${PAIRED.entrance_spawn.y}); glue teleports `
            + `${teleportsBefore} -> ${statsF.teleports}; warnings ${statsF.warnings}`);
        check('ARM F: the second landing (the host\'s arrival) is on the SAME cell and raises no warning',
            glueLanded <= 1 && statsF.warnings === 0, `glue landings ${glueLanded}, warnings ${statsF.warnings}`);

        const statsEnd = await glueStats();
        check('the glue agrees with the independent watcher', statsEnd.regionMoves === (await glueMoves()).length,
            JSON.stringify(statsEnd));
    } catch (err) {
        check(`fatal: ${err.message}`, false);
        console.log(`PAGE LOGS (last 60):\n${logs.slice(-60).join('\n')}`);
    } finally {
        await browser.close();
    }

    console.log(`PAGE ERRORS (diagnostic, logic-only channel — the device loss is expected): ${pageErrors.length}`);
    for (const e of pageErrors) console.log(`  pageerror: ${e}`);
    const failed = failures();
    console.log(failed === 0
        ? '\nOK: the generated Seedling rooms play — delivered, checked, out to the maze and back, room to room'
        : `\nFAILED: ${failed} check(s)`);
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
