#!/usr/bin/env node
/**
 * Seedling swim T1: a GENERATED Seedling room whose gate is WATER, played end
 * to end. The maze START holds the AP item `Progressive Swim` (the conch — the
 * bridge grants `canSwim` on the first one); the maze's exit into the generated
 * `post-swim` room is gated `Has(Progressive Swim)`, and the room's `watergate`
 * stands between the arrival (the door's dry approach) and the victory on its
 * goal cell — the generator certified that goal REQUIRES the swim
 * (`require: canSwim`). So the tree's gate and the room's physics are one item,
 * and past the gate only a swimmer reaches victory.
 *
 * The world is the committed `seedling_generated_swim` preset
 * (`make-seedling-spiral-room-preset.mjs --state=generated-swim`, from
 * `SEEDLING_GENERATED_SWIM_STATE`). Every expectation is read from that preset
 * (the gate's item off the exit's rule, the water off the room's own record, the
 * victory off `completion_condition`), never typed here.
 *
 *   Phase A — boot in the maze START; the maze has the keyboard; the flash glue
 *     has loaded nothing.
 *   ⛔ NO REFUSAL PHASE, MEASURED (not skipped): the brief's phase W — the WATER
 *     refusing a non-swimmer, `drownTimer` rising — is not reachable in this
 *     world, and neither is the maze's own gate refusing one. The room is only
 *     entered through the maze exit gated on the conch, and every maze path from
 *     the START's entrance to that exit crosses the conch's cell, which the maze
 *     collects on step (a static row below reads it off the maze sidecar; seeds
 *     1–12 of this state all measured the same). No player meets either gate
 *     without the item.
 *   Phase K — THE CONCH: real keys walk the maze to the item; the state manager
 *     holds it.
 *   Phase E — IN: the maze keys cross the exit (now open) into the room; ▶ Start;
 *     the panel names the GENERATED arm; the arrival lands on the door's dry
 *     APPROACH; the bridge reports `canSwim` true and `drownTimer` 0.
 *   Phase S — THE SWIM: real keys walk a path that crosses every water cell of
 *     the room (the gate) to the first cell past it; `drownTimer` is read on
 *     every step and stays 0, and the player lands past the gate.
 *   Phase V — THE VICTORY: real keys onto the goal cell; the game writes
 *     pendingCheck, the check fires, the state manager holds the victory item.
 *   Phase C — WORLD COMPLETE: the rules' `completion_condition` — read off the
 *     page's static data, evaluated against the live snapshot — HOLDS (and did
 *     not before V).
 *
 * ⛔ PAGE ERRORS ARE A DIAGNOSTIC LINE, NOT A check() (the logic-only channel
 * loses the WebGPU device by design — see `check-seedling-spiral-room-play.mjs`).
 * The hands are `seedlingRoomPlay.js`'s, shared with the other room gates.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default
 * http://localhost:8000); the wasm build (the `flashPanel/wasm` submodule), or
 * this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/check-seedling-generated-swim-play.mjs [--host=http://localhost:8000] [--game=seedling_generated_swim]
 * @ci-box enrolled beside check-seedling-generated-host-play as a box row (seedling swim T1): its phases hold real keys for wall-clock durations against the Seedling wasm, measured only on this box's logic-only channel.
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { createRoomPlay } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/** The Seedling terrain types `levelWorld` reports (`lethalTerrainTiles` / `pitTiles`). */
const WATER = 1;
const LETHAL = new Set([1, 6, 17]);

/**
 * ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door): the box
 * lock, the preset read and the browser all live in `main()`.
 */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'check-seedling-generated-swim-play.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const GAME = arg('game', 'seedling_generated_swim');

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
    const { assembleGeneratedSeedlingSet } = await M('seedlingDemo/seedlingGeneratedSet.js');
    const { GEN_ROOM_SUBSTRATE_ID } = await M('seedlingDemo/seedlingGenRoomPayload.js');
    const { walkableCellsFrom } = await M('seedlingDemo/levelSetExits.js');
    const { buildLevelWorld } = await M('seedlingDemo/levelWorld.js');
    const { ruleItemNames } = await M('flashPanel/seedlingDoorGate.js');
    const SIDECARS = PRESET.preset_sidecars['1'];
    const REGIONS = PRESET.regions['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const [ROOM_ID, ROOM_SIDECAR] = Object.entries(SIDECARS).find(([, s]) => s.substrate === GEN_ROOM_SUBSTRATE_ID) ?? [];
    const ROOM = ROOM_SIDECAR?.playable_payload ?? null;
    const TILE = ROOM?.tile_size;
    /** The START's exit into the room — the tree's gate — and the item its rule names. */
    const GATE_EXIT = (REGIONS[START]?.exits ?? []).find((e) => e.connected_region === ROOM_ID) ?? null;
    const RULE = GATE_EXIT?.access_rule ?? null;
    const ITEM = RULE && RULE.rule !== 'True_' ? ruleItemNames(RULE)[0] ?? null : null;
    const FORWARD = (SIDECARS[START]?.playable_payload?.exits ?? []).find((e) => e.targetRegion === ROOM_ID) ?? null;
    const DOOR = ROOM?.exits?.find((e) => e.targetRegion === START) ?? null;
    const whereIs = (item) => Object.entries(REGIONS).flatMap(([r, reg]) => (reg.locations ?? [])
        .filter((l) => l.item?.name === item).map((l) => [r, l.name]))[0] ?? null;
    const ITEM_AT = whereIs(ITEM);
    const COMPLETION = PRESET.game_info?.['1']?.completion_condition ?? null;
    const VICTORY = COMPLETION?.item ?? null;
    const VICTORY_LOC = ROOM?.locations?.find((l) => whereIs(VICTORY)?.[1] === l.name) ?? null;
    const locationItem = new Map();
    for (const reg of Object.values(REGIONS)) for (const l of reg.locations ?? []) locationItem.set(l.name, l.item ?? null);
    const SELF = Number(Object.keys(PRESET.player_names ?? { 1: '' })[0]);
    const ASSEMBLED = ROOM ? assembleGeneratedSeedlingSet(PRESET, {
        locationItemOf: (n) => (locationItem.get(n) ? { name: locationItem.get(n).name, player: locationItem.get(n).player } : null),
        selfPlayer: SELF,
    }) : null;
    const SET = ASSEMBLED?.set ?? null;

    // ── The room's own terrain, read off its record (never the generator's hazard set) ──
    const key = (c) => `${c.tx},${c.ty}`;
    const terrain = ROOM ? new Map(buildLevelWorld(ROOM.record).walkableTiles.map((t) => [`${t.tx},${t.ty}`, t.t])) : new Map();
    const WATER_CELLS = new Set([...terrain].filter(([, t]) => t === WATER).map(([k]) => k));
    const LETHAL_CELLS = new Set([...terrain].filter(([, t]) => LETHAL.has(t)).map(([k]) => k));
    const DOOR_CELLS = new Set((ROOM?.exits ?? []).map((e) => `${e.exit_tiles[0][0]},${e.exit_tiles[0][1]}`));
    const APPROACH = DOOR ? { tx: DOOR.entrance_spawn.x / TILE, ty: DOOR.entrance_spawn.y / TILE } : null;
    /** Shortest path over the room's walkable cells with `walls` walled (the door cells always). */
    function pathIn(from, to, walls) {
        const flood = walkableCellsFrom(ROOM.record, ROOM.start);
        const prev = new Map([[key(from), null]]);
        const queue = [from];
        for (let i = 0; i < queue.length; i += 1) {
            if (key(queue[i]) === key(to)) break;
            for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
                const c = { tx: queue[i].tx + dx, ty: queue[i].ty + dy };
                if (prev.has(key(c)) || !flood.has(key(c)) || walls.has(key(c)) || DOOR_CELLS.has(key(c))) continue;
                prev.set(key(c), queue[i]);
                queue.push(c);
            }
        }
        if (!prev.has(key(to))) return null;
        const out = [];
        for (let c = to; c; c = prev.get(key(c))) out.unshift(c);
        return out;
    }
    const DRY_WALLS = LETHAL_CELLS;
    const SWIM_WALLS = new Set([...LETHAL_CELLS].filter((c) => !WATER_CELLS.has(c)));
    const GOAL = ROOM?.goal_cell ?? null;
    const SWIM_PATH = ROOM && APPROACH && GOAL ? pathIn(APPROACH, GOAL, SWIM_WALLS) : null;
    /** The swim leg: from the approach to the first cell past the LAST water cell on the path. */
    const lastWet = SWIM_PATH ? SWIM_PATH.map((c) => WATER_CELLS.has(key(c))).lastIndexOf(true) : -1;
    const SWIM_LEG = SWIM_PATH && lastWet >= 0 ? SWIM_PATH.slice(0, lastWet + 2) : null;
    const PAST_GATE = SWIM_LEG?.at(-1) ?? null;
    const REST_LEG = SWIM_PATH && lastWet >= 0 ? SWIM_PATH.slice(lastWet + 1) : null;

    const URL = `${HOST}/frontend/?game=${GAME}&seed=1`;
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const logs = [];
    page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const {
        check, failures, waitFor, gameFrame, readGameState, livePlayer, currentRegion,
        glueStats, glueMoves, installWatchers, focusGame, focusChain, gameHasKeys, holdUntil,
        invoked, mazeKeyPlan, pressKeys, mazePlayer, mazeHasKeys, readLevelSet, walkPath,
    } = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: 'check-seedling-generated-swim-play' });

    /** How much of `item` the player holds, off the state manager's snapshot. */
    const held = (item) => page.evaluate((it) =>
        window.stateManagerProxy?.getLatestStateSnapshot?.()?.inventory?.[it] ?? 0, item);
    /** The bot build's own status (`botStatus`): `drown_timer` is `Player.drownTimer`. */
    const botStatus = async () => {
        const raw = await gameFrame().evaluate(() => window.__swfBridge.game.botStatus?.() ?? null);
        try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return { __raw: raw }; }
    };
    /**
     * Hold keys toward `cell`'s centre, x then y, until within 1 px or `stopWhen()`
     * answers. ⚠ Measured on the first runs: after the swim the player keeps
     * drifting (water friction), so the walker's snap can let go on the pickup's
     * cell before the player overlaps it.
     */
    async function settleOn(cell, stopWhen) {
        const cx = cell.tx * TILE + TILE / 2;
        const cy = cell.ty * TILE + TILE / 2;
        for (let round = 0; round < 3; round += 1) {
            if (await stopWhen()) return true;
            for (const axis of ['x', 'y']) {
                const p = await livePlayer();
                const d = axis === 'x' ? cx - p.x : cy - p.y;
                if (Math.abs(d) <= 1) continue;
                const k = axis === 'x' ? (d > 0 ? 'ArrowRight' : 'ArrowLeft') : (d > 0 ? 'ArrowDown' : 'ArrowUp');
                // eslint-disable-next-line no-await-in-loop
                await holdUntil(k, async () => {
                    if (await stopWhen()) return 'stopped';
                    const q = await livePlayer();
                    const e = axis === 'x' ? cx - q.x : cy - q.y;
                    return Math.abs(e) <= 1 || Math.sign(e) !== Math.sign(d) ? 'there' : null;
                }, 1500);
            }
        }
        return stopWhen();
    }
    const mazeTileOf = (locName) => page.evaluate(async (name) => {
        const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
        const hit = [...(p?.world?.itemLocationNames ?? new Map())].find(([, n]) => n === name);
        if (!hit) return null;
        const [x, y] = hit[0].split(',').map(Number);
        return { x, y };
    }, locName);
    const completion = () => page.evaluate(() => {
        const sd = window.stateManagerProxy?.getStaticData?.();
        const snap = window.stateManagerProxy?.getLatestStateSnapshot?.();
        const cc = sd?.game_info?.[Object.keys(sd?.game_info ?? {})[0]]?.completion_condition ?? null;
        const holds = cc?.type === 'item_check' ? Number(snap?.inventory?.[cc.item] ?? 0) >= 1 : null;
        return { cc, holds };
    });
    const panelLog = () => page.evaluate(() => document.querySelector('.flash-panel-log')?.textContent ?? '');
    const liveCell = async () => {
        const p = await livePlayer();
        return p ? { tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE), x: p.x, y: p.y } : null;
    };
    const onCell = (live, c, px = 3) => !!live && Math.hypot(live.x - (c.tx * TILE + TILE / 2), live.y - (c.ty * TILE + TILE / 2)) <= px;
    const landings = (level, spawn) => logs.filter((l) => l.includes(invoked(level, spawn))).length;

    try {
        check('the preset\'s START is a maze whose exit into a GENERATED room is gated on one item, read off its own rules',
            SIDECARS[START]?.substrate === 'maze' && ROOM?.generated === true && !!ITEM && !!FORWARD && !!DOOR,
            `start ${START}; ${GATE_EXIT?.name} -> ${ROOM_ID}, gate ${JSON.stringify(RULE)}`);
        check(`the room was generated post-swim with a watergate and require canSwim, at re-roll 0`,
            ROOM?.generation?.biome === 'post-swim' && ROOM.generation.elements === 'watergate'
            && ROOM.generation.require === 'canSwim' && ROOM.generation.rerolls === 0, JSON.stringify(ROOM?.generation));
        check(`the gate's item ${ITEM} lies in the maze START (reachable before the gate)`,
            ITEM_AT?.[0] === START, JSON.stringify(ITEM_AT));
        check(`the completion condition names ${VICTORY}, on the room's goal cell (location 0)`,
            COMPLETION?.type === 'item_check' && !!VICTORY_LOC && key(VICTORY_LOC.cell) === key(GOAL),
            `${JSON.stringify(COMPLETION)} at ${VICTORY_LOC?.name} ${JSON.stringify(VICTORY_LOC?.cell)}`);
        const MAZE = SIDECARS[START]?.playable_payload ?? null;
        const mazeReachesExitAvoiding = (avoid) => {
            if (!MAZE) return null;
            const k = (x, y) => `${x},${y}`;
            const seen = new Set([k(MAZE.entrance.x, MAZE.entrance.y)]);
            const q = [MAZE.entrance];
            for (let i = 0; i < q.length; i += 1) {
                for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
                    const x = q[i].x + dx; const y = q[i].y + dy;
                    if (x === FORWARD.x && y === FORWARD.y) return true;
                    if (x < 0 || y < 0 || x >= MAZE.width || y >= MAZE.height || seen.has(k(x, y))
                        || MAZE.tiles[y * MAZE.width + x] !== 0 || avoid.has(k(x, y))) continue;
                    seen.add(k(x, y));
                    q.push({ x, y });
                }
            }
            return false;
        };
        const itemCells = new Set((MAZE?.items ?? []).filter((i) => i.id === ITEM).map((i) => `${i.x},${i.y}`));
        check(`no player meets the gate WITHOUT ${ITEM}: the maze reaches ${FORWARD?.exit_id} from its entrance, and every such path `
            + 'crosses the item\'s cell (collected on step) — so the brief\'s refusal phase W is unreachable here, measured',
            itemCells.size === 1 && mazeReachesExitAvoiding(new Set()) === true && mazeReachesExitAvoiding(itemCells) === false,
            `entrance ${JSON.stringify(MAZE?.entrance)}, item ${[...itemCells].join(' ')}, exit ${FORWARD?.x},${FORWARD?.y}`);
        const dryToGoal = ROOM && APPROACH ? pathIn(APPROACH, GOAL, DRY_WALLS) : null;
        check('THE WATER IS THE GATE, by the room\'s own record: from the door\'s approach the goal is reachable only across water',
            WATER_CELLS.size > 0 && !LETHAL_CELLS.has(key(APPROACH)) && dryToGoal === null && !!SWIM_LEG,
            `water ${[...WATER_CELLS].join(' ')}; approach ${key(APPROACH)}; swim leg ${SWIM_LEG?.map(key).join(' ')}`);
        check('the set assembled headless (the page\'s own function) holds the room and the PARKING room',
            !!SET && SET.rooms.length === (ASSEMBLED?.report?.rooms ?? 0) + 1, SET ? `${SET.set_id}: ${SET.rooms.map((r) => r.name).join(', ')}` : 'none');

        // ── Phase A — boot, in the maze ─────────────────────────────────────
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        await waitFor('rules loaded', () => page.evaluate(
            () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
        await installWatchers();
        check(`Phase A: the player starts in the maze region ${START}`, (await currentRegion()) === START, await currentRegion());
        await waitFor(`the maze panel holds ${START}`, async () => {
            const m = await mazePlayer();
            return m?.region === START ? m : null;
        }, 20000);
        const bootKeys = await waitFor('the maze panel has the keyboard', mazeHasKeys, 10000).catch(() => null);
        check('Phase A: the MAZE panel has the page\'s keyboard at boot (no click)',
            typeof bootKeys === 'string' && bootKeys.startsWith('maze-room-panel'), String(bootKeys));
        const boot = await glueStats();
        check('Phase A: the flash glue has loaded nothing yet', (boot?.loads ?? 0) === 0 && boot?.regionMoves === 0,
            JSON.stringify(boot));

        // ── Phase K — the conch ─────────────────────────────────────────────
        check(`Phase K: before the walk the state manager holds no ${ITEM}`, (await held(ITEM)) === 0, String(await held(ITEM)));
        const itemTile = await mazeTileOf(ITEM_AT[1]);
        const toItem = itemTile ? await mazeKeyPlan({ tile: itemTile }) : { error: `no live tile for ${ITEM_AT[1]}` };
        await pressKeys(toItem.keys ?? []);
        const got = await waitFor(`${ITEM} arrives`, async () => ((await held(ITEM)) >= 1) || null, 10000).catch(() => null);
        check(`Phase K: real keys walked the maze to ${ITEM_AT[1]} ${JSON.stringify(itemTile)} and collected ${ITEM}`,
            !!got, `${toItem.keys?.length ?? toItem.error} key(s); holds ${await held(ITEM)}`);

        // ── Phase E — in, WITH the item ─────────────────────────────────────
        const toRoom = await mazeKeyPlan({ exitTo: ROOM_ID });
        await pressKeys(toRoom.keys ?? []);
        const inRoom = await waitFor(`gameState moves to ${ROOM_ID}`, async () =>
            ((await currentRegion()) === ROOM_ID ? ROOM_ID : null), 15000).catch(async () => currentRegion());
        check(`Phase E: WITH ${ITEM} the maze keys cross ${FORWARD.exit_id} into the generated room ${ROOM_ID}`,
            inRoom === ROOM_ID && (await glueMoves()).length === 0, `${toRoom.keys?.length ?? toRoom.error} key(s); region ${inRoom}`);
        await waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
        await waitFor('start button enabled', () => gameFrame().evaluate(() => {
            const b = document.getElementById('btn-start');
            return !!b && !b.disabled;
        }));
        await gameFrame().click('#btn-start');
        await assertLogicOnlyChannel(gameFrame());
        await waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
            document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);
        const load = await waitFor('the AP load finished (the panel\'s own step log)', () => page.evaluate(async () => {
            const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
            const r = p?._apLoadResult;
            return r ? { ok: r.ok, why: r.why, steps: r.steps?.map((s) => s.name) } : null;
        }), 120000);
        const log = await panelLog();
        check(`Phase E: the load delivered and the panel log names the GENERATED arm for ${ROOM_ID}`,
            load.ok === true && log.includes(`ap placement: the GENERATED arm — the rules carry 1 generated Seedling room(s) (${ROOM_ID})`)
            && log.includes(`— ${SET.set_id}`), `${JSON.stringify(load)}; ${log.split('\n').filter((l) => l.includes('ap placement')).join(' | ')}`);
        const mounted = await readLevelSet();
        check('Phase E: botLevelSet reports the ASSEMBLED set', mounted?.active === SET.set_id
            && mounted?.table_levels === SET.rooms.length, JSON.stringify(mounted));
        const want = DOOR.entrance_spawn;
        await waitFor(`the arrival new Game(${ROOM.level},${want.x},${want.y})`, () => landings(ROOM.level, want) > 0 || null, 30000)
            .catch(() => null);
        await page.waitForTimeout(2000);
        const liveE = await liveCell();
        const stE = await readGameState();
        check(`Phase E: the arrival lands VISIBLE on ${DOOR.exit_id}'s dry APPROACH ${key(APPROACH)}, level ${ROOM.level}`,
            stE.level === ROOM.level && onCell(liveE, APPROACH), `live ${JSON.stringify(liveE)}; state ${JSON.stringify(stE)}`);
        const bsE = await botStatus();
        check(`Phase E: the bridge grants canSwim (the conch — the state property the game config names) and drownTimer is 0`,
            stE.canSwim === true && bsE?.drown_timer === 0, `readState canSwim ${JSON.stringify(stE.canSwim)}; `
            + `botStatus drown_timer ${bsE?.drown_timer}`);
        const chain = await waitFor('the game has the keyboard', async () => {
            const c = await focusChain();
            return gameHasKeys(c) ? c : null;
        }, 5000).catch(async () => focusChain());
        check('Phase E: the game\'s CANVAS has the page\'s keyboard (no click)', gameHasKeys(chain), JSON.stringify(chain));

        // ── Phase S — the swim ──────────────────────────────────────────────
        const drownSamples = [];
        const sample = async () => { drownSamples.push((await botStatus())?.drown_timer ?? null); return false; };
        await focusGame();
        const hereS = await liveCell();
        const legS = hereS && key(hereS) === key(APPROACH) ? SWIM_LEG : (hereS ? pathIn(hereS, PAST_GATE, SWIM_WALLS) : null);
        const walkS = legS ? await walkPath(legS, { tile: TILE, stepCeilingMs: 8000, stopWhen: sample }) : null;
        console.log(`  (Phase S) path ${legS?.map(key).join(' ')} ; walked ${walkS?.trace?.join(' ')}`);
        const liveS = await liveCell();
        const crossed = (walkS?.trace ?? []).map((t) => t.split('@')[0].split('!')[0]);
        check(`Phase S: real keys SWAM the gate — every water cell on the path crossed (${[...WATER_CELLS].filter((c) => legS?.some((p) => key(p) === c)).join(' ')}), `
            + `the player stands past it on ${key(PAST_GATE)}`,
            !!walkS?.ok && legS.filter((c) => WATER_CELLS.has(key(c))).every((c) => crossed.includes(key(c)))
            && onCell(liveS, PAST_GATE, 4), `live ${JSON.stringify(liveS)}; ${walkS?.why ?? ''}`);
        const bsS = await botStatus();
        check(`Phase S: drownTimer stayed 0 on every step (${drownSamples.length} samples) and after — the conch holds`,
            drownSamples.length > 0 && drownSamples.every((d) => d === 0) && bsS?.drown_timer === 0,
            `samples ${JSON.stringify([...new Set(drownSamples)])}; after ${bsS?.drown_timer}`);
        check('Phase S: still in the room, on its level, no door fired, nothing refused',
            (await currentRegion()) === ROOM_ID && (await readGameState()).level === ROOM.level
            && (await glueMoves()).length === 0 && ((await glueStats())?.doorsLocked ?? 0) === 0, JSON.stringify(await glueStats()));

        // ── Phase V — the victory ───────────────────────────────────────────
        const beforeV = await completion();
        check('Phase V: before the victory the completion condition does NOT hold (the probe can say no)',
            beforeV.holds === false, JSON.stringify(beforeV));
        const checksBefore = (await glueStats()).locationChecks;
        const pendingBefore = (await readGameState()).pendingCheck;
        const checked = async () => ((await readGameState()).pendingCheck !== pendingBefore);
        const hereV = await liveCell();
        const legV = hereV && key(hereV) === key(PAST_GATE) ? REST_LEG : (hereV ? pathIn(hereV, GOAL, SWIM_WALLS) : null);
        const walkV = legV && legV.length > 1 ? await walkPath(legV, { tile: TILE, stepCeilingMs: 8000, stopWhen: checked })
            : { ok: true, trace: [] };
        const settled = await settleOn(GOAL, checked);
        console.log(`  (Phase V) path ${legV?.map(key).join(' ')} ; walked ${walkV?.trace?.join(' ')}; settled ${settled} at ${JSON.stringify(await livePlayer())}`);
        const gotV = await waitFor(`${VICTORY} arrives in the state manager`, async () => ((await held(VICTORY)) >= 1) || null, 10000)
            .catch(() => null);
        const statsV = await glueStats();
        check(`Phase V: real keys walked onto ${VICTORY_LOC.name}'s cell ${key(GOAL)}: the game wrote pendingCheck, ONE `
            + `user:locationCheck, and the state manager holds ${VICTORY}`,
            !!walkV?.ok && await checked() && !!gotV && statsV.locationChecks === checksBefore + 1,
            `holds ${await held(VICTORY)}; ${JSON.stringify(statsV)}`);

        // ── Phase C — world complete ────────────────────────────────────────
        const after = await completion();
        check(`Phase C: WORLD COMPLETE — the rules' completion_condition (off the page's static data) HOLDS on the live snapshot`,
            after.holds === true && JSON.stringify(after.cc) === JSON.stringify(COMPLETION), JSON.stringify(after));
        const statsEnd = await glueStats();
        check('the glue agrees with the independent watchers: no crossing published, no warning, nothing refused',
            statsEnd.regionMoves === (await glueMoves()).length && statsEnd.regionMoves === 0 && statsEnd.warnings === 0
            && (statsEnd.doorsLocked ?? 0) === 0, JSON.stringify(statsEnd));
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
        ? '\nOK: the generated swim world plays — the conch opened the maze\'s gate, the player swam the watergate with drownTimer 0 and took the victory; the world is complete'
        : `\nFAILED: ${failed} check(s)`);
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
