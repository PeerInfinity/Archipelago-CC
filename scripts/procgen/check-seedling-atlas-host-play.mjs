#!/usr/bin/env node
/**
 * Seedling generated levels, G6: a REAL Seedling room (a room of the real map,
 * `flash_seedling`) HOSTS a child behind an AP gate, and the HOST enforces it —
 * the game's door opens for whoever walks onto it, so when the gated door fires
 * without the item the glue refuses the crossing, swallows the game's own swap
 * into the door's REAL destination level and teleports the player back onto the
 * door's return spawn, and the panel says which item is missing. Both of the
 * room's door rules are read off the state manager's STATIC DATA (a real room's
 * payload carries none). The world is then PLAYED TO COMPLETION.
 *
 * The world is the committed `seedling_atlas_host` preset
 * (`make-seedling-spiral-room-preset.mjs --state=atlas-host`, from
 * `SEEDLING_ATLAS_HOST_STATE` = T3's sphere-room world WITHOUT its leaf knob): a
 * maze START holding `key_blue`, whose exit leads into the real two-door room
 * `overworld_start__r8c0` behind `Has(key_blue)`; the room's other door leads to
 * a maze child behind `Has(key_red)` holding victory; `key_red` lies in a sibling
 * maze of the start. Every expectation is read from that preset, the starter
 * atlas or its map extract, never typed here.
 *
 *   Phase A — boot in the maze START; the maze has the keyboard.
 *   Phase K1 — real keys walk the maze to `key_blue`; into the room through the
 *     maze's gated exit: the flash glue loads the room and the arrival lands on
 *     the BACK door's return spawn (the game's own, off the door tile).
 *   Phase J — ⚠ A LABELLED JUMP, NOT A WALK (T2's Phase C2/E precedent): the two
 *     doors are across level 0 and the arrival lands at the back door, so the
 *     game is sent to the gated door's tile with `new Game(level, x, y)`; the
 *     gate says so, and every door fire after it is a real key's.
 *   Phase L — LOCKED: a real key steps onto the child's door WITHOUT `key_red`:
 *     the game fires it (`to` = the door's REAL `@to` level, off the map), the
 *     host refuses — NO `user:regionMove`, the swap swallowed AND reversed onto
 *     the door's return spawn, standing still, nothing the real level holds fired
 *     for the frame; the panel line and ONE `flashSeedling:doorLocked` name the
 *     region and the item; the rule came off static data (no fallback note).
 *   Phase B — OUT THE BACK: the page's LIVE door predicate answers the back
 *     door GATED on `Has(key_blue)` off static data (refusing an empty inventory,
 *     passing the live one); a labelled jump to it, a real key onto it: ONE
 *     `user:regionMove` to the maze start.
 *   Phase K2 — real keys walk the maze to `key_red` (the sibling) and back into
 *     the room: ⛓ trap 1418 — the glue RESUMES (no second delivery) and the
 *     binding's OWN arrival lands on the back door's return spawn.
 *   Phase O — OPEN: a labelled jump to the child's door, a real key onto it WITH
 *     `key_red`: ONE `user:regionMove` into the maze child; the swap swallowed;
 *     the maze puts the player ON the exit paired with the door.
 *   Phase V — WORLD COMPLETION: real keys onto the victory tile; the victory
 *     location is checked, the player holds the item and stands in the goal
 *     region, and the rules' `completion_condition` — read off the page's static
 *     data (`game_info`), evaluated against the live snapshot — HOLDS (and did
 *     not before). Nothing in the app exposes a goal state (plan §12.0 #4).
 *
 * ⛔ PAGE ERRORS ARE A DIAGNOSTIC LINE, NOT A check() (the logic-only channel
 * loses the WebGPU device by design — see `check-seedling-spiral-room-play.mjs`).
 * The hands are `seedlingRoomPlay.js`'s, shared with the spiral, sphere and
 * generated-room gates.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default
 * http://localhost:8000); the wasm build (the `flashPanel/wasm` submodule), or
 * this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/check-seedling-atlas-host-play.mjs [--host=http://localhost:8000] [--game=seedling_atlas_host]
 * @ci-box enrolled beside check-seedling-generated-host-play as a box row (seedling generated G6): its phases hold real keys for wall-clock durations against the Seedling wasm, measured only on this box's logic-only channel.
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
import { createRoomPlay, STEP_OFF_PX, slotBlockOf } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/**
 * ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door): the box
 * lock, the preset read and the browser all live in `main()`.
 */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'check-seedling-atlas-host-play.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const GAME = arg('game', 'seedling_atlas_host');

    const PRESET = JSON.parse(readFileSync(join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const FLASH_DIR = join(REPO, 'frontend/modules/flashPanel');
    const WASM_PAGE = slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '';
    const ARTIFACT = join(FLASH_DIR, 'wasm', dirname(WASM_PAGE));
    if (!WASM_PAGE || !existsSync(join(FLASH_DIR, 'wasm', WASM_PAGE))
        || !existsSync(join(ARTIFACT, `${dirname(WASM_PAGE)}.wasm`))) {
        console.log(`SKIP: seedling wasm artifact not staged at ${ARTIFACT} (the preset's flash_panel.wasm is `
            + `${JSON.stringify(WASM_PAGE)}) — see frontend/modules/flashPanel/README.md`);
        process.exit(0);
    }

    // ── What the preset, the atlas and the map say ──────────────────────────
    const M = (p) => import(join(REPO, 'frontend/modules', p));
    const { lockedDoorMessage, ruleItemNames, staticExitOf } = await M('flashPanel/seedlingDoorGate.js');
    const { DOOR_LOCKED_EVENT } = await M('flashPanel/seedlingRegionGlue.js');
    const SIDECARS = PRESET.preset_sidecars['1'];
    const REGIONS = PRESET.regions['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const [ROOM_ID, ROOM_SIDECAR] = Object.entries(SIDECARS).find(([, s]) => s.substrate === 'flash_seedling') ?? [];
    const ROOM = ROOM_SIDECAR?.playable_payload ?? null;
    const TILE = ROOM?.tile_size;
    const ruleOf = (door) => staticExitOf({ regions: REGIONS }, ROOM_ID, door.exitName)?.access_rule ?? null;
    /** The door BACK (to the start, where the player comes in) and the CHILD's door (onward). */
    const BACK = ROOM?.exits?.find((d) => d.targetRegion === START) ?? null;
    const DOOR = ROOM?.exits?.find((d) => d !== BACK && ruleOf(d) && ruleOf(d).rule !== 'True_') ?? null;
    const CHILD = DOOR?.targetRegion ?? null;
    const RULE = DOOR ? ruleOf(DOOR) : null;
    const ITEMS = RULE ? ruleItemNames(RULE) : [];
    const ITEM = ITEMS[0] ?? null; // key_red, in the committed world
    const BACK_RULE = BACK ? ruleOf(BACK) : null;
    const BACK_ITEM = BACK_RULE ? ruleItemNames(BACK_RULE)[0] : null; // key_blue
    const MESSAGE = CHILD ? lockedDoorMessage(CHILD, ITEMS) : null;
    /** The start's exit INTO the room (the maze side of the back door) and the child's exit back. */
    const ENTRY = (SIDECARS[START]?.playable_payload?.exits ?? []).find((e) => e.targetRegion === ROOM_ID) ?? null;
    const FORWARD = (SIDECARS[CHILD]?.playable_payload?.exits ?? []).find((e) => e.targetRegion === ROOM_ID) ?? null;
    const whereIs = (item) => Object.entries(REGIONS).flatMap(([r, reg]) => (reg.locations ?? [])
        .filter((l) => l.item?.name === item).map((l) => [r, l.name]))[0] ?? null;
    const BACK_KEY_AT = whereIs(BACK_ITEM);
    const KEY_AT = whereIs(ITEM);
    const COMPLETION = PRESET.game_info?.['1']?.completion_condition ?? null;
    const VICTORY_AT = whereIs(COMPLETION?.item);
    const MAP = JSON.parse(readFileSync(join(FLASH_DIR, 'atlases',
        slotBlockOf(PRESET, 'region_atlas')?.map_document ?? 'seedling-map.json'), 'utf8'));
    const LEVEL = MAP.levels.find((l) => l.level === ROOM?.level);
    const tileOf = (door) => door.exit_tiles[0];
    const entityOf = (door) => LEVEL?.entities.find((e) => Math.floor(e.x / MAP.tile_size) === tileOf(door)[0]
        && Math.floor(e.y / MAP.tile_size) === tileOf(door)[1] && e.attrs?.to !== undefined) ?? null;
    /** ⛓ (c) of the brief: P = the door's REAL `@to` level (not a parking room). */
    const REAL_TO = DOOR && entityOf(DOOR) ? Number(entityOf(DOOR).attrs.to) : null;
    /** Where an arrival (and a bounce) through a door lands: the game's own return spawn, off the table the panel builds. */
    const RETURNS = returnSpawnTable(MAP);
    const homeOf = (door) => RETURNS.get(returnKey(ROOM.level, ...tileOf(door))) ?? door.entrance_spawn;
    /**
     * Which key steps OFF each door and which steps back ON — measured on the box
     * at T2 W0-3 for this very room (`check-seedling-spiral-room-play.mjs`): the
     * house door is entered upward, the owl's-nest stairs rightward. Keyed by the
     * ATLAS door id, so a regenerated preset that binds other doors fails here by
     * name instead of walking into a wall.
     */
    const STEP_KEYS = Object.freeze({
        house_door: { off: 'ArrowDown', on: 'ArrowUp' },
        owls_nest_stairs: { off: 'ArrowLeft', on: 'ArrowRight' },
    });

    const URL = `${HOST}/frontend/?game=${GAME}&seed=1`;
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const logs = [];
    page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const {
        check, failures, waitFor, gameFrame, readGameState, livePlayer, currentRegion,
        glueStats, glueMoves, activeSubstrates, arrival, installWatchers, jump, focusGame, focusChain, gameHasKeys,
        holdUntil, invoked, parsePending, mazeKeyPlan, pressKeys, mazePlayer, mazeHasKeys,
    } = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: 'check-seedling-atlas-host-play' });

    /** How much of `item` the player holds, off the state manager's snapshot (what the door gate reads). */
    const held = (item) => page.evaluate((it) =>
        window.stateManagerProxy?.getLatestStateSnapshot?.()?.inventory?.[it] ?? 0, item);
    const checkedLocations = () => page.evaluate(() =>
        [...(window.stateManagerProxy?.getLatestStateSnapshot?.()?.checkedLocations ?? [])]);
    const doorLocks = () => page.evaluate(() => window.__doorLocked ?? []);
    const bindingMarks = () => page.evaluate(async () => {
        const b = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue()?.binding;
        return b ? { bounce: b.pendingBounce, departure: b.pendingDeparture, arrival: b.pendingArrival } : null;
    });
    /**
     * ⛓ THE PAGE'S OWN DOOR PREDICATE on a door of the held world — the glue's
     * `canPass` (the static-data read) — with the live snapshot, and a gate built
     * the same way over an EMPTY inventory: what the host WOULD answer a player
     * without the item. Read, never re-implemented.
     */
    const livePredicate = (exitId) => page.evaluate(async (id) => {
        const glue = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
        const b = glue.binding;
        const exit = [...(b.world.exits instanceof Map ? b.world.exits.values() : b.world.exits)].find((e) => e.exit_id === id);
        const { createDoorGate } = await import('./modules/flashPanel/seedlingDoorGate.js');
        const { createSnapshotInterface } = await import('./modules/shared/snapshotInterface.js');
        const sm = window.stateManagerProxy;
        const empty = createDoorGate({ getSnapshot: () => ({ inventory: {}, flags: [] }), getStaticData: () => sm.getStaticData(),
            getSnapshotInterface: () => createSnapshotInterface })(exit, { region: b.region });
        return { live: b.canPass(exit, { region: b.region }), empty, region: b.region };
    }, exitId);
    /** A maze location's tile in the LIVE maze world, by its location name. */
    const mazeTileOf = (locName) => page.evaluate(async (name) => {
        const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
        const hit = [...(p?.world?.itemLocationNames ?? new Map())].find(([, n]) => n === name);
        if (!hit) return null;
        const [x, y] = hit[0].split(',').map(Number);
        return { x, y };
    }, locName);
    /** ⛓ W0 #4 — the completion condition, off the PAGE's static data, evaluated against the live snapshot. */
    const completion = () => page.evaluate(() => {
        const sd = window.stateManagerProxy?.getStaticData?.();
        const snap = window.stateManagerProxy?.getLatestStateSnapshot?.();
        const cc = sd?.game_info?.[Object.keys(sd?.game_info ?? {})[0]]?.completion_condition ?? null;
        const holds = cc?.type === 'item_check' ? Number(snap?.inventory?.[cc.item] ?? 0) >= 1 : null;
        return { cc, holds };
    });
    const panelLog = () => page.evaluate(() => document.querySelector('.flash-panel-log')?.textContent ?? '');
    const near = (live, spawn, px = 3) => !!live && Math.hypot(live.x - (spawn.x + TILE / 2), live.y - (spawn.y + TILE / 2)) <= px;
    const landings = (level, spawn) => logs.filter((l) => l.includes(invoked(level, spawn))).length;
    const stillFor = async (ms = 2000) => {
        const samples = [];
        for (let t = 0; t < ms; t += 200) {
            // eslint-disable-next-line no-await-in-loop
            samples.push(await livePlayer());
            // eslint-disable-next-line no-await-in-loop
            await page.waitForTimeout(200);
        }
        return samples.every((p) => p && Math.hypot(p.x - samples[0].x, p.y - samples[0].y) <= 1);
    };
    /** Real keys through the maze to `goal` (`{tile}` or `{exitTo}`); `{keys, error}`. */
    async function mazeTo(goal) {
        const plan = await mazeKeyPlan(goal);
        await pressKeys(plan.keys ?? []);
        return plan;
    }
    /** Collect `item` at its maze location in `region` (the player is there). */
    async function collectInMaze(label, [region, locName], item) {
        const tile = await mazeTileOf(locName);
        const plan = tile ? await mazeTo({ tile }) : { error: `no live tile for ${locName}` };
        const got = await waitFor(`${item} arrives`, async () => ((await held(item)) >= 1) || null, 10000).catch(() => null);
        check(`${label}: real keys walked ${region}'s maze to ${locName} ${JSON.stringify(tile)} and collected ${item}`,
            !!got, `${plan.keys?.length ?? plan.error} key(s); holds ${await held(item)}`);
    }
    /** The flash glue has the room and the arrival landed on the BACK door's return spawn. */
    async function arriveInRoom(label, landingsBefore) {
        const home = homeOf(BACK);
        const call = invoked(ROOM.level, home);
        await waitFor(`arrival ${call}`, () => landings(ROOM.level, home) > landingsBefore || null, 120000);
        await page.waitForTimeout(2500);
        const live = await livePlayer();
        const a = await arrival();
        check(`${label}: the arrival is ${call} — ${BACK.exit_id}'s return spawn (the game's own, off the door tile) — and `
            + 'the binding chose that door', near(live, home) && a.spawn?.exitId === BACK.exit_id
            && (await currentRegion()) === ROOM_ID, `live ${JSON.stringify(live)}, spawn ${JSON.stringify(a.spawn)}`);
        const chain = await waitFor('the game has the keyboard', async () => {
            const c = await focusChain();
            return gameHasKeys(c) ? c : null;
        }, 5000).catch(async () => focusChain());
        check(`${label}: the game's CANVAS has the page's keyboard (no click)`, gameHasKeys(chain), JSON.stringify(chain));
    }
    /**
     * ⚠ THE LABELLED JUMP (T2's precedent): `new Game(level, x, y)` onto `door`'s
     * tile, then a real key a tile OFF it — the game fires a door only when the
     * player walks ONTO it (its `check()` latch).
     */
    async function jumpBeside(label, door, why) {
        console.log(`  (${label}) ⚠ LABELLED JUMP to ${door.exit_id} — ${why}`);
        await focusGame();
        await jump(ROOM.level, door.entrance_spawn.x, door.entrance_spawn.y);
        const landed = await waitFor(`the player stands on ${door.exit_id}`, async () => {
            const p = await livePlayer();
            return p && Math.abs(p.x - door.entrance_spawn.x - 8) <= 8 && Math.abs(p.y - door.entrance_spawn.y - 8) <= 8 ? p : null;
        }, 10000).catch(() => null);
        await page.waitForTimeout(500);
        const centre = { x: door.entrance_spawn.x + TILE / 2, y: door.entrance_spawn.y + TILE / 2 };
        const off = await holdUntil(STEP_KEYS[door.exit_id].off, async () => {
            const p = await livePlayer();
            return p && Math.hypot(p.x - centre.x, p.y - centre.y) >= STEP_OFF_PX ? p : null;
        });
        check(`${label}: (labelled jump — ${why}) the player landed on ${door.exit_id} and a real ${STEP_KEYS[door.exit_id].off} `
            + 'stepped it a tile off, no door fired', !!landed && !!off.value, `${JSON.stringify(landed)} -> ${JSON.stringify(off.value)}`);
    }
    /** A real key onto `door` until the game writes a new pendingExit; the parsed report. */
    async function stepOnto(door) {
        const before = (await readGameState()).pendingExit;
        const on = await holdUntil(STEP_KEYS[door.exit_id].on, async () => {
            const s = await readGameState();
            return s.pendingExit !== before ? s.pendingExit : null;
        }, 6000);
        const p = parsePending(on.value);
        return { p, ms: on.ms, onTile: !!p && Math.floor(p.x / TILE) === tileOf(door)[0] && Math.floor(p.y / TILE) === tileOf(door)[1] };
    }
    const JUMP_WHY = `the room's two doors are across level ${ROOM?.level} and the arrival lands on ${BACK?.exit_id}'s `
        + 'return spawn — a walk across the real overworld is not what this gate measures';

    try {
        check('the preset places ONE real room, not the start, with a door BACK to the maze start and a door to a maze CHILD',
            !!ROOM && ROOM_ID !== START && ROOM.exits.length === 2 && !!BACK && !!DOOR && SIDECARS[CHILD]?.substrate === 'maze'
            && SIDECARS[START]?.substrate === 'maze', `${ROOM_ID} (${ROOM?.atlas_region}): ${BACK?.exit_id} -> ${START}, `
            + `${DOOR?.exit_id} -> ${CHILD}`);
        check('BOTH door rules are in static data (the rules.json) and NEITHER is in the room\'s payload',
            !!ITEM && !!BACK_ITEM && ROOM.exits.every((d) => d.access_rule === undefined) && ROOM.exitGates === undefined,
            `${DOOR?.exitName}: ${JSON.stringify(RULE)}; ${BACK?.exitName}: ${JSON.stringify(BACK_RULE)}`);
        check('the keys lie in mazes: the back door\'s in the start, the child door\'s in a region reachable without it',
            BACK_KEY_AT?.[0] === START && !!KEY_AT && KEY_AT[0] !== CHILD && SIDECARS[KEY_AT[0]]?.substrate === 'maze',
            `${BACK_ITEM} at ${JSON.stringify(BACK_KEY_AT)}, ${ITEM} at ${JSON.stringify(KEY_AT)}`);
        check('both doors are PAIRED with their maze exits by targetExitId',
            !!ENTRY && !!FORWARD && BACK.targetExitId === ENTRY.exit_id && DOOR.targetExitId === FORWARD.exit_id,
            `${BACK?.exit_id}/${ENTRY?.exit_id}, ${DOOR?.exit_id}/${FORWARD?.exit_id}`);
        check('the map gives the child\'s door a REAL destination level (@to) other than the room\'s',
            Number.isInteger(REAL_TO) && REAL_TO !== ROOM.level, `@to ${REAL_TO}`);
        check('both doors have a measured step recipe', !!STEP_KEYS[BACK?.exit_id] && !!STEP_KEYS[DOOR?.exit_id]);
        check(`the completion condition names ${COMPLETION?.item}, placed in the child ${CHILD}`,
            COMPLETION?.type === 'item_check' && VICTORY_AT?.[0] === CHILD, `${JSON.stringify(COMPLETION)} at ${JSON.stringify(VICTORY_AT)}`);

        // ── Phase A — boot, in the maze ─────────────────────────────────────
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        await waitFor('rules loaded', () => page.evaluate(
            () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
        await installWatchers();
        await page.evaluate(async ({ label, event }) => {
            window.__doorLocked = [];
            const bus = (await import('./app/core/eventBus.js')).default;
            bus.subscribe(event, (p) => window.__doorLocked.push(p), label);
        }, { label: 'check-seedling-atlas-host-play', event: DOOR_LOCKED_EVENT });
        check(`Phase A: the player starts in the maze region ${START}`, (await currentRegion()) === START, await currentRegion());
        await waitFor(`the maze panel holds ${START}`, async () => ((await mazePlayer())?.region === START) || null, 20000);
        const bootKeys = await waitFor('the maze panel has the keyboard', mazeHasKeys, 10000).catch(() => null);
        check('Phase A: the MAZE panel has the page\'s keyboard at boot (no click)',
            typeof bootKeys === 'string' && bootKeys.startsWith('maze-room-panel'), String(bootKeys));
        const boot = await glueStats();

        // ── Phase K1 — key_blue, and into the room ──────────────────────────
        await collectInMaze('Phase K1', BACK_KEY_AT, BACK_ITEM);
        const intoRoom = await mazeTo({ exitTo: ROOM_ID });
        const inRoom = await waitFor(`gameState moves to ${ROOM_ID}`, async () =>
            ((await currentRegion()) === ROOM_ID ? ROOM_ID : null), 15000).catch(async () => currentRegion());
        check(`Phase K1: WITH ${BACK_ITEM} the maze keys cross ${ENTRY.exit_id} into the real room ${ROOM_ID}`,
            inRoom === ROOM_ID && (await glueMoves()).length === 0, `${intoRoom.keys?.length ?? intoRoom.error} key(s)`);
        await waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
        await waitFor('start button enabled', () => gameFrame().evaluate(() => {
            const b = document.getElementById('btn-start');
            return !!b && !b.disabled;
        }));
        await gameFrame().click('#btn-start');
        await assertLogicOnlyChannel(gameFrame());
        await waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
            document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);
        await arriveInRoom('Phase K1', 0);
        const statsIn = await glueStats();
        check('Phase K1: the glue loaded the room once, published no crossing, refused nothing, warned nothing',
            statsIn.loads === (boot?.loads ?? 0) + 1 && statsIn.regionMoves === 0 && statsIn.doorsLocked === 0
            && statsIn.warnings === 0, JSON.stringify(statsIn));
        console.log(`  (Phase K1) ${(await panelLog()).split('\n').filter((l) => l.includes('ap placement')).join(' | ')}`);

        // ── Phase J + L — the child's door, LOCKED ──────────────────────────
        await jumpBeside('Phase J', DOOR, JUMP_WHY);
        const HOME = homeOf(DOOR);
        const landingsBeforeL = landings(ROOM.level, HOME);
        const checkBeforeL = (await readGameState()).pendingCheck;
        const statsBeforeL = await glueStats();
        const L = await stepOnto(DOOR);
        check(`Phase L: a real ${STEP_KEYS[DOOR.exit_id].on} onto ${DOOR.exit_id} WITHOUT ${ITEM}: the game fired it, @to = its REAL level ${REAL_TO}`,
            L.onTile && L.p.fromLevel === ROOM.level && L.p.to === REAL_TO, `${JSON.stringify(L.p)} in ${L.ms} ms`);
        const bounced = await waitFor('the bounce lands the player back in the room', async () => {
            const s = await glueStats();
            const st = await readGameState();
            return s.bounces >= 1 && st.level === ROOM.level && landings(ROOM.level, HOME) > landingsBeforeL ? s : null;
        }, 15000).catch(() => null);
        await page.waitForTimeout(1500);
        const liveL = await livePlayer();
        const still = await stillFor();
        check(`Phase L: the host REFUSED — the bounce new Game(${ROOM.level},${HOME.x},${HOME.y}) landed the player VISIBLE `
            + `at ${DOOR.exit_id}'s return spawn, standing still`,
            !!bounced && near(liveL, HOME) && still && (await readGameState()).level === ROOM.level,
            `live ${JSON.stringify(liveL)}, still ${still}, landings ${landingsBeforeL} -> ${landings(ROOM.level, HOME)}`);
        const statsL = await glueStats();
        check(`Phase L: NO user:regionMove, the AP region is still ${ROOM_ID}, the swap into level ${REAL_TO} swallowed (no warning, `
            + 'no park, no mark left)', (await glueMoves()).length === 0 && (await currentRegion()) === ROOM_ID
            && statsL.warnings === 0 && statsL.doorsLocked === 1 && statsL.bounces === 1 && statsL.parks === statsBeforeL.parks,
            `${JSON.stringify(statsL)}; marks ${JSON.stringify(await bindingMarks())}`);
        const marks = await bindingMarks();
        check('Phase L: the binding holds no mark after the bounce landed', !marks?.bounce && !marks?.departure && !marks?.arrival,
            JSON.stringify(marks));
        check(`Phase L: level ${REAL_TO}'s frame fired nothing — no location check, pendingCheck unchanged`,
            statsL.locationChecks === statsBeforeL.locationChecks && (await readGameState()).pendingCheck === checkBeforeL,
            `pendingCheck ${JSON.stringify((await readGameState()).pendingCheck)}`);
        check(`Phase L: the panel says "${MESSAGE}" — the rule off static data (no fallback note)`,
            (await panelLog()).includes(`[door gate] ${MESSAGE}`) && !(await panelLog()).includes('room\'s own payload'),
            (await panelLog()).split('\n').filter((l) => l.includes('[door gate]')).join(' | '));
        const locks = await doorLocks();
        check(`Phase L: ONE ${DOOR_LOCKED_EVENT} naming ${CHILD} and [${ITEMS.join(', ')}]`,
            locks.length === 1 && locks[0].region === CHILD && locks[0].sourceRegion === ROOM_ID
            && JSON.stringify(locks[0].needs) === JSON.stringify(ITEMS) && locks[0].message === MESSAGE, JSON.stringify(locks));
        const childPred = await livePredicate(DOOR.exit_id);
        check(`Phase L: the page's live predicate on ${DOOR.exit_id}: GATED off static data, refusing (${ITEM} missing)`,
            childPred.live?.gated === true && childPred.live?.pass === false && childPred.live?.source === 'static'
            && JSON.stringify(childPred.live?.missing) === JSON.stringify([ITEM]), JSON.stringify(childPred));

        // ── Phase B — out through the gated BACK door ────────────────────────
        const backPred = await livePredicate(BACK.exit_id);
        check(`Phase B: the page's live predicate on the BACK door ${BACK.exit_id}: GATED on ${BACK_ITEM} off static data — `
            + 'passing the player (who holds it), refusing an empty inventory',
            backPred.live?.gated === true && backPred.live?.pass === true && backPred.live?.source === 'static'
            && backPred.empty?.pass === false && JSON.stringify(backPred.empty?.missing) === JSON.stringify([BACK_ITEM]),
            JSON.stringify(backPred));
        await jumpBeside('Phase B', BACK, JUMP_WHY);
        const B = await stepOnto(BACK);
        const movesB = await waitFor('ONE regionMove back to the start', async () => {
            const m = await glueMoves();
            return m.length >= 1 ? m : null;
        }, 15000).catch(async () => glueMoves());
        check(`Phase B: a real ${STEP_KEYS[BACK.exit_id].on} onto ${BACK.exit_id}: ONE user:regionMove ${ROOM_ID} -> ${START} through `
            + `${BACK.exitName}`, B.onTile && movesB.length === 1 && movesB[0].targetRegion === START
            && movesB[0].exitName === BACK.exitName, `${JSON.stringify(B.p)}; ${JSON.stringify(movesB)}`);
        await waitFor(`the maze panel holds ${START}`, async () => ((await mazePlayer())?.region === START) || null, 15000)
            .catch(() => null);
        await waitFor('the maze panel has the keyboard after the door', mazeHasKeys, 5000).catch(() => null);

        // ── Phase K2 — key_red, and IN AGAIN (trap 1418) ────────────────────
        const toKey = await mazeTo({ exitTo: KEY_AT[0] });
        await waitFor(`the maze panel holds ${KEY_AT[0]}`, async () => ((await mazePlayer())?.region === KEY_AT[0]) || null, 15000)
            .catch(() => null);
        check(`Phase K2: the maze keys cross into ${KEY_AT[0]}`, (await currentRegion()) === KEY_AT[0],
            `${toKey.keys?.length ?? toKey.error} key(s); region ${await currentRegion()}`);
        await collectInMaze('Phase K2', KEY_AT, ITEM);
        const back1 = await mazeTo({ exitTo: START });
        await waitFor(`the maze panel holds ${START}`, async () => ((await mazePlayer())?.region === START) || null, 15000)
            .catch(() => null);
        const loadsBeforeR = (await glueStats()).loads;
        const resumesBeforeR = (await glueStats()).resumes;
        const landingsBeforeR = landings(ROOM.level, homeOf(BACK));
        const back2 = await mazeTo({ exitTo: ROOM_ID });
        const again = await waitFor(`gameState back in ${ROOM_ID}`, async () =>
            ((await currentRegion()) === ROOM_ID ? ROOM_ID : null), 15000).catch(async () => currentRegion());
        check(`Phase K2: back through ${START} (${back1.keys?.length ?? back1.error} + ${back2.keys?.length ?? back2.error} key(s)) `
            + `re-enters ${ROOM_ID}`, again === ROOM_ID, String(again));
        await arriveInRoom('Phase K2 (in again, trap 1418)', landingsBeforeR);
        const statsR = await glueStats();
        check('Phase K2: the glue RESUMED (one more load, one more resume — no second delivery, no reset); no new refusal',
            statsR.loads === loadsBeforeR + 1 && statsR.resumes === resumesBeforeR + 1 && statsR.doorsLocked === 1,
            JSON.stringify(statsR));

        // ── Phase O — OPEN ──────────────────────────────────────────────────
        await jumpBeside('Phase O', DOOR, JUMP_WHY);
        const O = await stepOnto(DOOR);
        const movesO = await waitFor('the regionMove into the child', async () => {
            const m = await glueMoves();
            return m.length >= 2 ? m : null;
        }, 15000).catch(async () => glueMoves());
        const lastO = movesO.at(-1);
        check(`Phase O: a real ${STEP_KEYS[DOOR.exit_id].on} onto ${DOOR.exit_id} WITH ${ITEM}: ONE user:regionMove ${ROOM_ID} -> ${CHILD} `
            + `through ${DOOR.exitName}`, O.onTile && movesO.length === 2 && lastO.sourceRegion === ROOM_ID
            && lastO.targetRegion === CHILD && lastO.exitName === DOOR.exitName, `${JSON.stringify(O.p)}; ${JSON.stringify(movesO)}`);
        const inChild = await waitFor(`gameState in ${CHILD}`, async () =>
            ((await currentRegion()) === CHILD ? CHILD : null), 15000).catch(() => null);
        await page.waitForTimeout(2500);
        const statsO = await glueStats();
        check(`Phase O: the swap into level ${REAL_TO} was swallowed (no third move); the flash panel PARKED and the maze owns `
            + `${CHILD}; still ONE refusal and ONE bounce, no warning`,
            inChild === CHILD && (await glueMoves()).length === 2 && (await activeSubstrates()).at(-1) === 'maze'
            && statsO.doorsLocked === 1 && statsO.bounces === 1 && statsO.warnings === 0,
            `${JSON.stringify(statsO)}, active ${JSON.stringify(await activeSubstrates())}`);
        const landed = await waitFor(`the maze panel holds ${CHILD}`, async () => {
            const m = await mazePlayer();
            return m?.region === CHILD ? m : null;
        }, 15000).catch(() => null);
        check(`Phase O: the maze put the player ON ${FORWARD.exit_id} (${FORWARD.x},${FORWARD.y}), the exit PAIRED with the door`,
            landed?.pos.x === FORWARD.x && landed?.pos.y === FORWARD.y, JSON.stringify(landed));
        await waitFor('the maze panel has the keyboard after the door', mazeHasKeys, 5000).catch(() => null);

        // ── Phase V — world completion ──────────────────────────────────────
        const before = await completion();
        check('Phase V: before the victory the completion condition does NOT hold (the probe can say no)',
            before.holds === false && JSON.stringify(before.cc) === JSON.stringify(COMPLETION), JSON.stringify(before));
        await collectInMaze('Phase V', VICTORY_AT, COMPLETION.item);
        const after = await completion();
        const checked = await checkedLocations();
        check(`Phase V: WORLD COMPLETE — ${VICTORY_AT[1]} is checked, the player holds ${COMPLETION.item} in the goal region `
            + `${CHILD}, and the rules' completion_condition (off the page's static data) HOLDS on the live snapshot`,
            checked.includes(VICTORY_AT[1]) && (await currentRegion()) === CHILD && after.holds === true,
            `${JSON.stringify(after)}; checked ${JSON.stringify(checked)}`);

        const statsEnd = await glueStats();
        check('the glue agrees with the independent watchers', statsEnd.regionMoves === (await glueMoves()).length
            && statsEnd.regionMoves === 2 && statsEnd.warnings === 0 && statsEnd.doorsLocked === (await doorLocks()).length,
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
        ? '\nOK: the real room hosts — its child door refused without the key and bounced the player home, its gated back '
            + 'door let the key-holder out and in again, the key opened the child, and the world is complete'
        : `\nFAILED: ${failed} check(s)`);
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
