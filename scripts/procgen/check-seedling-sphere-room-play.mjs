#!/usr/bin/env node
/**
 * Seedling in the pipeline, T3: the ONE real Seedling room that SPHERE GROWTH
 * placed as a LEAF behind a maze gate PLAYS in the Seedling wasm. The maze's own
 * gate keeps the player out until its key is collected; the maze's own walking
 * takes them in; the game's own door takes them back out, onto the maze exit
 * paired with it.
 *
 * The world is the committed `seedling_sphere_room` preset
 * (`make-seedling-spiral-room-preset.mjs --state=sphere`, from
 * `SEEDLING_SPHERE_ROOM_STATE`): the START region is a maze, the room hangs off
 * one of its maze regions (the PARENT) through one exit whose rule is the room's
 * entry gate. Every name, tile, gate item and spawn below is READ off that
 * preset, the starter atlas's map extract, and the live world; the one thing
 * typed here is the measured key recipe for the room's door (`STEP_KEYS`).
 *
 *   Phase A — boot the DEFAULT mode on `?game=<preset>&seed=1`. The player starts
 *     in the maze START region, and the maze panel holds the page's keyboard.
 *     The flash glue has loaded nothing.
 *   Phase B — THE GATE HOLDS. Real keys walk the maze player straight at the
 *     parent's exit into the room without the gate item: the maze stops the
 *     player beside the exit and no region changes.
 *   Phase C — THE KEY. Real keys walk to the tile of the location that holds
 *     the gate item (the rules' own placement), and the item arrives.
 *   Phase D — IN. Real keys walk onto the exit: gameState moves to the room, the
 *     Flash Game tab comes forward by itself, and ▶ Start — the one click a
 *     person makes — boots the game. The arrival teleport lands on the game's own
 *     return spawn for the bound door (T2b U2b; the door tile only when the map
 *     has none), and the binding chose the door by its SECOND arm: the sphere
 *     pairs the parent's exit with the door (`targetExitId`), so
 *     `arrivedFrom.exit_id` is the door's `exitName`. No crossing is published,
 *     and the game's canvas holds the keyboard.
 *   Phase E — OUT, fired BY THE GAME. The door's measured key steps the player
 *     onto it; the game writes `pendingExit`, the binding's door-TILE arm
 *     matches, ONE `user:regionMove` goes to the parent through the door's
 *     `exitName`, the flash panel parks, and the maze owns the region. The maze
 *     lands the player ON the exit paired with the door — its FIRST arrival arm
 *     (`exit_id`: the door's `targetExitId`) — and holds the keyboard.
 *   Phase F — IN AGAIN, by keys off and back onto that exit. The glue resumes,
 *     the Flash Game tab comes forward, the arrival lands on the same spawn, and
 *     a key moves the player with no click.
 *
 * ⛔ PAGE ERRORS ARE A DIAGNOSTIC LINE, NOT A check() — the logic-only channel
 * loses the WebGPU device by design (see `check-seedling-spiral-room-play.mjs`'s
 * header, and `headlessChromium.test.js`'s H2 row). They are printed verbatim.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default
 * http://localhost:8000); the wasm build (the `flashPanel/wasm` submodule),
 * or this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/check-seedling-sphere-room-play.mjs [--host=http://localhost:8000] [--game=seedling_sphere_room]
 * @ci-box enrolled beside check-seedling-spiral-room-play as a box row (seedling-pipeline T3): its phases hold real keys for wall-clock durations against the Seedling wasm, measured only on this box's logic-only channel.
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { returnKey, returnSpawnTable } from '../../frontend/modules/flashPanel/seedlingReturnSpawns.js';
import { createRoomPlay } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/**
 * ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door): the box
 * lock, the preset read and the browser all live in `main()`.
 */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'check-seedling-sphere-room-play.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const GAME = arg('game', 'seedling_sphere_room');

    const PRESET = JSON.parse(readFileSync(
        join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const FLASH_DIR = join(REPO, 'frontend/modules/flashPanel');
    /** ⛔ The build the preset's OWN `flash_panel` block names, not a default of this script. */
    const WASM_PAGE = PRESET.flash_panel?.wasm ?? '';
    const ARTIFACT = join(FLASH_DIR, 'wasm', dirname(WASM_PAGE));
    const WASM_FILE = join(ARTIFACT, `${dirname(WASM_PAGE)}.wasm`);
    if (!WASM_PAGE || !existsSync(join(FLASH_DIR, 'wasm', WASM_PAGE)) || !existsSync(WASM_FILE)) {
        console.log(`SKIP: seedling wasm artifact not staged at ${ARTIFACT} (the preset's flash_panel.wasm is `
            + `${JSON.stringify(WASM_PAGE)}) — see frontend/modules/flashPanel/README.md`);
        process.exit(0);
    }

    // ── What the preset says ────────────────────────────────────────────────
    const SIDECARS = PRESET.preset_sidecars['1'];
    const REGIONS = PRESET.regions['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const ROOMS = Object.entries(SIDECARS).filter(([, s]) => s.substrate === 'flash_seedling');
    const [ROOM_ID, ROOM_SIDECAR] = ROOMS[0] ?? [null, null];
    const ROOM = ROOM_SIDECAR?.playable_payload ?? null;
    const DOOR = ROOM?.exits?.[0] ?? null;
    const TILE = ROOM?.tile_size;
    const PARENT = DOOR?.targetRegion ?? null;
    /** The parent's exit into the room, as the maze sidecar and the rules each spell it. */
    const FORWARD = (SIDECARS[PARENT]?.playable_payload?.exits ?? []).find((e) => e.targetRegion === ROOM_ID) ?? null;
    const GATE_RULE = (REGIONS[PARENT]?.exits ?? []).find((e) => e.connected_region === ROOM_ID)?.access_rule ?? null;
    const GATE_ITEM = GATE_RULE?.rule === 'Has' ? GATE_RULE.args.item_name : null;
    /** Where the rules placed the gate item: `[region, location]`. */
    const KEY_AT = Object.entries(REGIONS).flatMap(([r, reg]) => (reg.locations ?? [])
        .filter((l) => l.item?.name === GATE_ITEM).map((l) => [r, l.name]))[0] ?? null;
    /**
     * Which key steps OFF the room's door and which steps back ON, measured on the
     * box at T3 (the stairs sit on the room's top row; the return spawn is the tile
     * below). Keyed by the ATLAS door id, so a regenerated preset that binds a
     * different door fails here by name instead of walking into a wall.
     */
    const STEP_KEYS = Object.freeze({
        stairs_up: { off: 'ArrowDown', on: 'ArrowUp' },
    });

    const MAP = JSON.parse(readFileSync(join(FLASH_DIR, 'atlases',
        PRESET.region_atlas?.map_document ?? 'seedling-map.json'), 'utf8'));
    /** ⛓ T2b U2b — where an arrival through `door` lands, off the SAME table the panel builds. */
    const RETURNS = returnSpawnTable(MAP);
    const arrivalOf = (door) => {
        const [tx, ty] = door.entrance_tile ?? door.exit_tiles[0];
        const back = RETURNS.get(returnKey(ROOM.level, tx, ty));
        return back ? { x: back.x, y: back.y, landing: 'return-spawn' }
            : { ...door.entrance_spawn, landing: 'entrance-spawn' };
    };

    const URL = `${HOST}/frontend/?game=${GAME}&seed=1`;
    const browser = await chromium.launch({
        /** ⛓ logic-only: see the header for why the page errors are not a check(). */
        args: HEADLESS_LOGIC_ONLY_ARGS,
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const logs = [];
    page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const {
        check, failures, waitFor, gameFrame, readGameState, livePlayer, activeTabTitles, currentRegion,
        glueStats, glueMoves, activeSubstrates, arrival, installWatchers, focusChain, gameHasKeys,
        keyMovesPlayer, holdUntil, invoked, parsePending, mazeKeyPlan, pressKeys, mazePlayer, mazeHasKeys,
    } = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: 'check-seedling-sphere-room-play' });

    /** How much of the gate item the player holds, off the state snapshot. */
    const held = (item) => page.evaluate((it) =>
        window.stateManagerProxy?.getLatestStateSnapshot?.()?.inventory?.[it] ?? 0, item);
    /** The maze's arrivals, captured off `maze:loadRegion` (the maze keeps no `arrivedFrom`). */
    const mazeArm = () => page.evaluate(async () => {
        const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
        const { resolveMazeArrival } = await import('./modules/mazeRoom/mazeArrival.js');
        const last = (window.__mazeLoads ?? []).at(-1) ?? null;
        return last ? { region: last.region_id, arrivedFrom: last.arrivedFrom,
            arm: resolveMazeArrival(p.world, last.arrivedFrom) } : null;
    });

    /**
     * The room's arrival: the invocation, the checkpoint, the binding's arm, and
     * the Flash Game tab + canvas keyboard with no click. `loads` is the glue-load
     * count this arrival must leave behind; `pending` the game's `pendingExit`
     * before it (the game keeps its LAST door report — '' only before the first).
     */
    async function arriveInRoom(label, loads, pending) {
        const want = arrivalOf(DOOR);
        const call = invoked(ROOM.level, want);
        await waitFor(`arrival invocation ${call}`, () => logs.some((l) => l.includes(call)) || null, 120000);
        const st = await waitFor('the game reports the arrival spawn', async () => {
            const s = await readGameState();
            return s.level === ROOM.level && s.playerPositionX === want.x && s.playerPositionY === want.y ? s : null;
        }, 20000);
        check(`${label}: the arrival is a new Game at ${DOOR.exit_id}'s ${want.landing}, level ${ROOM.level}`,
            !!st && (want.landing !== 'return-spawn'
                || want.x !== DOOR.entrance_spawn.x || want.y !== DOOR.entrance_spawn.y), call);
        const a = await arrival();
        check(`${label}: the binding chose ${DOOR.exit_id} by its SECOND arm — arrivedFrom.exit_id is the door's `
            + `exitName "${DOOR.exitName}" (the parent's exit's targetExitId), not its atlas id`,
            a.arrivedFrom?.exit_id === DOOR.exitName && a.arrivedFrom?.exit_id === FORWARD.targetExitId
            && a.arrivedFrom?.exit_id !== DOOR.exit_id
            && a.spawn?.exitId === DOOR.exit_id && a.spawn?.matchedArrivedFrom === true
            // …and the exit_id ALONE picks it: arm 3 (source_region) would land on the same door.
            && a.spawnByExitId?.exitId === DOOR.exit_id && a.spawnByExitId?.matchedArrivedFrom === true, JSON.stringify(a));
        const stats = await glueStats();
        check(`${label}: the flash glue loaded the room (${loads} load(s)) and flash_seedling owns it`,
            stats?.loads === loads && (await activeSubstrates()).at(-1) === 'flash_seedling', JSON.stringify(stats));
        const tabs = await waitFor('the Flash Game tab comes forward', async () => {
            const t = await activeTabTitles();
            return t.includes('Flash Game') ? t : null;
        }, 5000).catch(async () => activeTabTitles());
        check(`${label}: the Flash Game tab came forward by itself (no tab click)`, tabs.includes('Flash Game'),
            `active tabs: ${tabs.join(', ')}`);
        // ⛓ Read ONCE after the arrival settled (T2b U2a: the overlay's release moved focus late).
        await page.waitForTimeout(2500);
        const chain = await focusChain();
        check(`${label}: the game's CANVAS has the page's keyboard (no canvas click)`, gameHasKeys(chain),
            JSON.stringify(chain));
        const live = await livePlayer();
        check(`${label}: the LIVE player stands at the arrival spawn, and no door fired`,
            !!live && Math.hypot(live.x - (want.x + TILE / 2), live.y - (want.y + TILE / 2)) <= 2
            && (await readGameState()).pendingExit === pending,
            `live ${JSON.stringify(live)}, want centre (${want.x + TILE / 2},${want.y + TILE / 2})`);
        return want;
    }

    try {
        check('the preset places ONE Seedling room, not the start region, with ONE bound door to a maze parent',
            ROOMS.length === 1 && ROOM_ID !== START && ROOM?.exits?.length === 1 && DOOR.external === true
            && SIDECARS[PARENT]?.substrate === 'maze', `${ROOM_ID}: ${DOOR?.exit_id} -> ${PARENT}; start ${START}`);
        check('the door and the parent\'s exit are PAIRED by targetExitId, both ways',
            !!FORWARD && DOOR.targetExitId === FORWARD.exit_id && FORWARD.targetExitId === DOOR.exitName,
            `${DOOR?.exit_id}.targetExitId ${DOOR?.targetExitId} / ${FORWARD?.exit_id}.targetExitId ${FORWARD?.targetExitId}`);
        check(`the parent's exit into the room is GATED on one item, placed in the start region ${START}`,
            !!GATE_ITEM && KEY_AT?.[0] === START && PARENT === START,
            `rule ${JSON.stringify(GATE_RULE)}; the item at ${JSON.stringify(KEY_AT)}`);
        check('the room\'s door has a measured step recipe', !!STEP_KEYS[DOOR?.exit_id], DOOR?.exit_id);

        // ── Phase A — boot, in the maze ─────────────────────────────────────────
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        await waitFor('rules loaded', () => page.evaluate(
            () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
        await installWatchers();
        await page.evaluate(async () => {
            window.__mazeLoads = [];
            const bus = (await import('./app/core/eventBus.js')).default;
            bus.subscribe('maze:loadRegion', (p) => window.__mazeLoads.push(
                { region_id: p?.region_id ?? null, arrivedFrom: p?.arrivedFrom ?? null }), 'check-seedling-sphere-room-play');
        });
        check(`Phase A: the player starts in the maze region ${START}`, (await currentRegion()) === START,
            await currentRegion());
        const bootMaze = await waitFor(`the maze panel holds ${START}`, async () => {
            const m = await mazePlayer();
            return m?.region === START ? m : null;
        }, 20000);
        const bootKeys = await waitFor('the maze panel has the keyboard', mazeHasKeys, 10000).catch(() => null);
        check('Phase A: the MAZE panel has the page\'s keyboard at boot (no click)',
            typeof bootKeys === 'string' && bootKeys.startsWith('maze-room-panel'), String(bootKeys));
        /**
         * ⛓ The glue's counters at boot. The start region is a MAZE, so the glue
         * has already PARKED once (it parks on any region it does not own); every
         * park/resume below is counted from here.
         */
        const boot = await glueStats();
        check('Phase A: the flash glue has loaded nothing yet', (boot?.loads ?? 0) === 0 && boot?.regionMoves === 0,
            JSON.stringify(boot));

        // ── Phase B — the gate holds ────────────────────────────────────────────
        const exitTile = { x: FORWARD.x, y: FORWARD.y };
        const toGate = await mazeKeyPlan({ exitTo: ROOM_ID }, { ignoreGates: true });
        check(`Phase B: a key path from ${JSON.stringify(bootMaze.pos)} to ${FORWARD.exit_id} exists`, !toGate.error,
            JSON.stringify(toGate));
        check(`Phase B: the player holds no ${GATE_ITEM}`, (await held(GATE_ITEM)) === 0);
        await pressKeys(toGate.keys ?? []);
        await page.waitForTimeout(1500);
        const stopped = await mazePlayer();
        check(`Phase B: WITHOUT ${GATE_ITEM} the maze stops the player BESIDE ${FORWARD.exit_id} and the region stays ${START}`,
            (await currentRegion()) === START && stopped.region === START
            && Math.abs(stopped.pos.x - exitTile.x) + Math.abs(stopped.pos.y - exitTile.y) === 1
            && (await glueStats())?.loads === 0 && (await glueMoves()).length === 0,
            `pressed ${toGate.keys?.length} keys; player ${JSON.stringify(stopped.pos)}, exit ${JSON.stringify(exitTile)}`);

        // ── Phase C — the key ───────────────────────────────────────────────────
        const keyTile = await page.evaluate(async (locName) => {
            const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
            const hit = [...(p.world.itemLocationNames ?? new Map())].find(([, n]) => n === locName);
            if (!hit) return null;
            const [x, y] = hit[0].split(',').map(Number);
            return { x, y };
        }, KEY_AT?.[1]);
        check(`Phase C: the live maze world has a tile for "${KEY_AT?.[1]}"`, !!keyTile, JSON.stringify(keyTile));
        const toKey = await mazeKeyPlan({ tile: keyTile });
        await pressKeys(toKey.keys ?? []);
        const got = await waitFor(`${GATE_ITEM} arrives`, async () => ((await held(GATE_ITEM)) >= 1) || null, 10000)
            .catch(() => false);
        check(`Phase C: walking onto ${JSON.stringify(keyTile)} collected ${GATE_ITEM}`, !!got,
            `${toKey.keys?.length} keys; holds ${await held(GATE_ITEM)}`);

        // ── Phase D — in ────────────────────────────────────────────────────────
        const toRoom = await mazeKeyPlan({ exitTo: ROOM_ID });
        await pressKeys(toRoom.keys ?? []);
        const inRoom = await waitFor(`gameState moves to ${ROOM_ID}`, async () =>
            ((await currentRegion()) === ROOM_ID ? ROOM_ID : null), 15000).catch(async () => currentRegion());
        check(`Phase D: WITH ${GATE_ITEM} the keys cross ${FORWARD.exit_id} into the room ${ROOM_ID}`,
            inRoom === ROOM_ID, `${toRoom.keys?.length} keys; region ${inRoom}`);
        check('Phase D: the maze\'s crossing published no flash glue move', (await glueMoves()).length === 0);
        await waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
        await waitFor('start button enabled', () => gameFrame().evaluate(() => {
            const b = document.getElementById('btn-start');
            return !!b && !b.disabled;
        }));
        // ▶ Start: the one click a person makes to boot the game.
        await gameFrame().click('#btn-start');
        await assertLogicOnlyChannel(gameFrame());
        const status = await waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
            document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);
        check('Phase D: the flash panel engaged from the rules\' own flash_panel block and reached ready',
            status === 'ready', WASM_PAGE);
        await arriveInRoom('Phase D', 1, '');
        check('Phase D: the arrival published no crossing', (await glueMoves()).length === 0);

        // ── Phase E — out, by the game's own door ───────────────────────────────
        const keys = STEP_KEYS[DOOR.exit_id];
        const centre = { x: DOOR.entrance_spawn.x + TILE / 2, y: DOOR.entrance_spawn.y + TILE / 2 };
        const before = await livePlayer();
        check(`Phase E: the LIVE player stands within a tile or two of ${DOOR.exit_id} before stepping on`,
            !!before && Math.hypot(before.x - centre.x, before.y - centre.y) <= 2 * TILE,
            `live ${JSON.stringify(before)}, door centre ${JSON.stringify(centre)}`);
        const pendingBefore = (await readGameState()).pendingExit;
        const on = await holdUntil(keys.on, async () => {
            const s = await readGameState();
            return s.pendingExit !== pendingBefore ? s.pendingExit : null;
        });
        check(`Phase E: ${keys.on} held until the game fired a door`, !!on.value,
            `pendingExit ${JSON.stringify(on.value)} in ${on.ms} ms`);
        const moves = await waitFor('the glue publishes the move', async () => {
            const m = await glueMoves();
            return m.length >= 1 ? m : null;
        }, 15000);
        const fired = parsePending((await readGameState()).pendingExit);
        const tile = fired ? [Math.floor(fired.x / TILE), Math.floor(fired.y / TILE)] : null;
        check(`Phase E: the game's OWN door report names ${DOOR.exit_id}'s tile (pixel / tile_size ∈ exit_tiles)`,
            !!tile && fired.fromLevel === ROOM.level && DOOR.exit_tiles.some(([x, y]) => x === tile[0] && y === tile[1]),
            `pendingExit -> tile ${JSON.stringify(tile)}, exit_tiles ${JSON.stringify(DOOR.exit_tiles)}`);
        const last = moves.at(-1);
        check(`Phase E: ONE user:regionMove on the real channel, to ${PARENT} through ${DOOR.exitName}`,
            moves.length === 1 && last.sourceRegion === ROOM_ID && last.targetRegion === PARENT
            && last.exitName === DOOR.exitName, JSON.stringify(last));
        const back = await waitFor(`gameState back in ${PARENT}`, async () =>
            ((await currentRegion()) === PARENT ? PARENT : null), 15000);
        const statsE = await glueStats();
        check('Phase E: the flash panel PARKED and the maze owns the region',
            back === PARENT && statsE.parks === boot.parks + 1 && (await activeSubstrates()).at(-1) === 'maze',
            `parks ${statsE.parks}, active-substrate events ${JSON.stringify(await activeSubstrates())}`);
        const landed = await waitFor(`the maze panel holds ${PARENT}`, async () => {
            const m = await mazePlayer();
            return m?.region === PARENT ? m : null;
        }, 15000);
        const arm = await mazeArm();
        check(`Phase E: the maze put the player ON ${FORWARD.exit_id}, the exit PAIRED with the door, by its FIRST arm (exit_id)`,
            landed.pos.x === FORWARD.x && landed.pos.y === FORWARD.y && arm?.region === PARENT
            && arm?.arrivedFrom?.exit_id === DOOR.targetExitId && arm?.arm?.by === 'exit_id',
            `player ${JSON.stringify(landed.pos)}; ${JSON.stringify(arm)}`);
        const mazeKeys = await waitFor('the maze panel has the keyboard after the door', mazeHasKeys, 5000)
            .catch(async () => page.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`));
        check('Phase E: the MAZE panel has the page\'s keyboard after the door (no click)',
            typeof mazeKeys === 'string' && mazeKeys.startsWith('maze-room-panel'), JSON.stringify(mazeKeys));

        // ── Phase F — in again, by keys off and back onto the paired exit ──────
        const again = await mazeKeyPlan({ exitTo: ROOM_ID });
        await pressKeys(again.keys ?? []);
        const inAgain = await waitFor(`gameState back in ${ROOM_ID}`, async () =>
            ((await currentRegion()) === ROOM_ID ? ROOM_ID : null), 15000).catch(async () => currentRegion());
        check(`Phase F: off ${FORWARD.exit_id} and back on (${again.keys?.join(' ')}) re-enters ${ROOM_ID}`,
            inAgain === ROOM_ID, String(inAgain));
        await arriveInRoom('Phase F', 2, on.value);
        const k = await keyMovesPlayer(keys.off);
        check(`Phase F: ${keys.off} pressed with no click moves the player`, k.moved,
            `${JSON.stringify(k.before)} -> ${JSON.stringify(k.after)}`);

        const statsEnd = await glueStats();
        check('the glue agrees with the independent watcher', statsEnd.regionMoves === (await glueMoves()).length
            && statsEnd.regionMoves === 1 && statsEnd.parks === boot.parks + 1 && statsEnd.resumes === boot.resumes + 2,
        `${JSON.stringify(statsEnd)} (boot ${JSON.stringify(boot)})`);
    } catch (err) {
        check(`fatal: ${err.message}`, false);
        console.log(`PAGE LOGS (last 60):\n${logs.slice(-60).join('\n')}`);
    } finally {
        await browser.close();
    }

    // ⛔ Not a check(): see the header. Printed verbatim so a third error shows.
    console.log(`PAGE ERRORS (diagnostic, logic-only channel — the device loss is expected): ${pageErrors.length}`);
    for (const e of pageErrors) console.log(`  pageerror: ${e}`);
    const failed = failures();
    console.log(failed === 0
        ? '\nOK: the sphere leaf plays — the maze gate held until its key, in through it, out by the game\'s own door'
        : `\nFAILED: ${failed} check(s)`);
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
