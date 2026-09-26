#!/usr/bin/env node
/**
 * Seedling generated levels, G4: a GENERATED Seedling room HOSTS a child behind
 * an AP gate, and the HOST enforces it — the game cannot hold a pipeline item,
 * so when the gated door fires without the item the glue refuses the crossing,
 * swallows the game's own swap into the parking room and teleports the player
 * back onto the door's approach cell, and the panel says which item is missing.
 * With the item, the same door crosses exactly as every generated door does.
 *
 * The world is the committed `seedling_generated_host` preset
 * (`make-seedling-spiral-room-preset.mjs --state=generated-host`, from
 * `SEEDLING_GENERATED_HOST_STATE`). Every expectation is read from that preset,
 * or from the set the gate assembles from it headless (the same function the
 * page runs), never typed here — the gated door is the one whose payload
 * `exitGates` entry is a rule, the item is the one that rule names, the
 * sentence is `lockedDoorMessage` of the rule's target and item.
 *
 *   Phase A — THE DELIVERY. Boot `?game=<preset>&seed=1` (the START is the
 *     generated room); Flash Panel tab, ▶ Start; the panel log names the
 *     GENERATED arm; `botLevelSet` reports the assembler's `set_id`.
 *   Phase B — THE BOOT. The player is VISIBLE on the gated door's APPROACH cell;
 *     the state manager holds none of the gate's item.
 *   Phase L — LOCKED. Real keys walk onto the gated door WITHOUT the item: the
 *     game fires it (`pendingExit`, `to` = the PARKING level); the host refuses:
 *     NO `user:regionMove`, the AP region is still the room; the game's swap
 *     into the parking room is swallowed AND reversed — the bounce teleport
 *     `new Game(<room level>, <approach>)` lands the player VISIBLE on the
 *     approach cell again (level back, standing still); the panel log carries
 *     the refusal naming the region and the item, and `flashSeedling:doorLocked`
 *     carries the same; no warning.
 *   Phase K — THE KEY. Real keys walk to the goal cell (the `apitem`): the check
 *     fires and the state manager's inventory now holds the item.
 *   Phase O — OPEN. The same door, the same keys: ONE `user:regionMove` into the
 *     maze child through the door's `exitName`; the parking swap swallowed; the
 *     flash panel parks; the maze puts the player ON the exit paired with the
 *     door. Still exactly one refusal and one bounce on the books.
 *   Phase R — IN AGAIN (trap 1418: a first landing can mask the binding), by
 *     keys off and back onto that maze exit: the glue resumes, no reset, and the
 *     binding's OWN arrival lands the player on the door's approach; no door
 *     fired, no new refusal.
 *
 * ⛔ PAGE ERRORS ARE A DIAGNOSTIC LINE, NOT A check() (the logic-only channel
 * loses the WebGPU device by design — see `check-seedling-spiral-room-play.mjs`).
 * The hands are `seedlingRoomPlay.js`'s, shared with the spiral, sphere,
 * generated-room and generated-leaf gates.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default
 * http://localhost:8000); the wasm build (the `flashPanel/wasm` submodule), or
 * this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/check-seedling-generated-host-play.mjs [--host=http://localhost:8000] [--game=seedling_generated_host]
 * @ci-box enrolled beside check-seedling-generated-leaf-play as a box row (seedling generated G4): its phases hold real keys for wall-clock durations against the Seedling wasm, measured only on this box's logic-only channel.
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
    takeBoxLockOrExit({ name: 'check-seedling-generated-host-play.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const GAME = arg('game', 'seedling_generated_host');

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
    const { GEN_ROOM_SUBSTRATE_ID } = await M('seedlingDemo/seedlingGenRoomPayload.js');
    const { walkableCellsFrom } = await M('seedlingDemo/levelSetExits.js');
    const { buildLevelWorld } = await M('seedlingDemo/levelWorld.js');
    const { lockedDoorMessage, ruleItemNames } = await M('flashPanel/seedlingDoorGate.js');
    const { DOOR_LOCKED_EVENT } = await M('flashPanel/seedlingRegionGlue.js');
    const SIDECARS = PRESET.preset_sidecars['1'];
    const REGIONS = PRESET.regions['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const ROOM = SIDECARS[START]?.playable_payload ?? null;
    const TILE = ROOM?.tile_size;
    /** The gated door: the one whose payload gate is a rule (the play-side world's `access_rule`). */
    const DOOR = ROOM?.exits?.find((e) => ROOM.exitGates?.[e.exitName] && ROOM.exitGates[e.exitName].rule !== 'True_') ?? null;
    const RULE = DOOR ? ROOM.exitGates[DOOR.exitName] : null;
    const CHILD = DOOR?.targetRegion ?? null;
    const ITEMS = RULE ? ruleItemNames(RULE) : [];
    const ITEM = ITEMS[0] ?? null;
    const MESSAGE = CHILD ? lockedDoorMessage(CHILD, ITEMS) : null;
    /** The child's exit back into the room, as the maze sidecar spells it. */
    const FORWARD = (SIDECARS[CHILD]?.playable_payload?.exits ?? []).find((e) => e.targetRegion === START) ?? null;
    const locationItem = new Map();
    for (const reg of Object.values(REGIONS)) for (const l of reg.locations ?? []) locationItem.set(l.name, l.item ?? null);
    const SELF = Number(Object.keys(PRESET.player_names ?? { 1: '' })[0]);
    const ASSEMBLED = assembleGeneratedSeedlingSet(PRESET, {
        locationItemOf: (n) => (locationItem.get(n) ? { name: locationItem.get(n).name, player: locationItem.get(n).player } : null),
        selfPlayer: SELF,
    });
    const SET = ASSEMBLED.set;
    const PARKING = ASSEMBLED.report.parkingLevel;
    const LOC = ROOM?.locations?.find((l) => locationItem.get(l.name)?.name === ITEM) ?? null;
    const LOC_ITEM = LOC ? ASSEMBLED.table.get(`${ROOM.level}|${LOC.tag}`) : null;
    const cellOfPx = (p) => ({ tx: p.x / TILE, ty: p.y / TILE });
    const pathIn = (payload, from, to) => roomPath(payload, from, to, { walkableCellsFrom, buildLevelWorld });

    const URL = `${HOST}/frontend/?game=${GAME}&seed=1`;
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const logs = [];
    page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const {
        check, failures, waitFor, gameFrame, readGameState, livePlayer, currentRegion,
        glueStats, glueMoves, activeSubstrates, arrival, installWatchers, focusGame, focusChain, gameHasKeys,
        invoked, parsePending, mazeKeyPlan, pressKeys, mazePlayer, mazeHasKeys, readLevelSet, walkPath,
    } = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: 'check-seedling-generated-host-play' });

    /** How much of `item` the player holds, off the state manager's snapshot (what the door gate reads). */
    const held = (item) => page.evaluate((it) =>
        window.stateManagerProxy?.getLatestStateSnapshot?.()?.inventory?.[it] ?? 0, item);
    const doorLocks = () => page.evaluate(() => window.__doorLocked ?? []);
    const bindingMarks = () => page.evaluate(async () => {
        const b = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue()?.binding;
        return b ? { bounce: b.pendingBounce, departure: b.pendingDeparture, arrival: b.pendingArrival } : null;
    });
    const mazeArm = () => page.evaluate(async () => {
        const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
        const { resolveMazeArrival } = await import('./modules/mazeRoom/mazeArrival.js');
        const last = (window.__mazeLoads ?? []).at(-1) ?? null;
        return last ? { region: last.region_id, arrivedFrom: last.arrivedFrom,
            arm: resolveMazeArrival(p.world, last.arrivedFrom) } : null;
    });
    const liveCell = async () => {
        const p = await livePlayer();
        return p ? { tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE), x: p.x, y: p.y } : null;
    };
    const panelLog = () => page.evaluate(() => document.querySelector('.flash-panel-log')?.textContent ?? '');
    const onApproach = (live, spawn) => !!live && Math.hypot(live.x - (spawn.x + TILE / 2), live.y - (spawn.y + TILE / 2)) <= 3;
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
    /** Walk from the live cell to `target` in the room; `stopWhen` ends it. */
    async function walkTo(label, target, stopWhen) {
        await focusGame();
        const here = await liveCell();
        const path = here ? pathIn(ROOM, { tx: here.tx, ty: here.ty }, target) : null;
        check(`${label}: a safe walkable path from the player's cell ${JSON.stringify(here && { tx: here.tx, ty: here.ty })} `
            + `to ${JSON.stringify(target)} (doors and hazards are walls on the way)`, !!path, path ? `${path.length - 1} step(s)` : 'none');
        if (!path) return null;
        const walked = await walkPath(path, { tile: TILE, stopWhen });
        console.log(`  (${label}) path ${path.map((c) => `${c.tx},${c.ty}`).join(' ')} ; walked ${walked.trace.join(' ')}`);
        return { path, walked };
    }
    const doorCell = DOOR ? { tx: DOOR.exit_tiles[0][0], ty: DOOR.exit_tiles[0][1] } : null;

    try {
        check('the preset\'s START is a generated room with a GATED door to a maze child, read off its own sidecars',
            ROOM?.generated === true && SIDECARS[START].substrate === GEN_ROOM_SUBSTRATE_ID && !!DOOR && DOOR.external === true
            && SIDECARS[CHILD]?.substrate === 'maze' && !!ITEM,
            `start ${START}; ${DOOR?.exit_id} (${DOOR?.exitName}) -> ${CHILD}, gate ${JSON.stringify(RULE)}`);
        check('the rules.json carries the SAME gate on that exit (the payload\'s exitGates is the logic\'s rule)',
            JSON.stringify(REGIONS[START].exits.find((e) => e.name === DOOR?.exitName)?.access_rule) === JSON.stringify(RULE));
        check(`the gate's item ${ITEM} stands on a location of the room itself (reachable before the door), and the set joins it`,
            !!LOC && !!LOC_ITEM && LOC_ITEM.item === ITEM, `${LOC?.name} at ${JSON.stringify(LOC?.cell)} (${LOC_ITEM?.item})`);
        check('the door and the child\'s exit are PAIRED by targetExitId, both ways',
            !!FORWARD && DOOR.targetExitId === FORWARD.exit_id && FORWARD.targetExitId === DOOR.exitName,
            `${DOOR?.exit_id}.targetExitId ${DOOR?.targetExitId} / ${FORWARD?.exit_id}.targetExitId ${FORWARD?.targetExitId}`);
        check('the set assembled headless (the page\'s own function) validates and ends in the PARKING room',
            SET.rooms.at(-1)?.name === PARKING_ROOM_NAME && SET.rooms.length === ASSEMBLED.report.rooms + 1,
            `${SET.set_id}: ${SET.rooms.map((r) => r.name).join(', ')}; parking level ${PARKING}`);

        // ── Phase A — boot + the delivery ─────────────────────────────────────
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        await waitFor('rules loaded', () => page.evaluate(
            () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
        await installWatchers();
        await page.evaluate(async ({ label, event }) => {
            window.__mazeLoads = [];
            window.__doorLocked = [];
            const bus = (await import('./app/core/eventBus.js')).default;
            bus.subscribe('maze:loadRegion', (p) => window.__mazeLoads.push(
                { region_id: p?.region_id ?? null, arrivedFrom: p?.arrivedFrom ?? null }), label);
            bus.subscribe(event, (p) => window.__doorLocked.push(p), label);
        }, { label: 'check-seedling-generated-host-play', event: DOOR_LOCKED_EVENT });
        check(`Phase A: the preset loaded and the player starts in the generated room ${START}`,
            (await currentRegion()) === START, await currentRegion());
        await waitFor('Flash Panel tab activated', () => page.evaluate(() => {
            const tab = [...document.querySelectorAll('.lm_tab')].find((t) => t.title === 'Flash Panel');
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
        const load = await waitFor('the AP load finished (the panel\'s own step log)', () => page.evaluate(async () => {
            const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
            const r = p?._apLoadResult;
            return r ? { ok: r.ok, why: r.why, steps: r.steps, reset: r.reset } : null;
        }), 120000);
        const log = await panelLog();
        check(`Phase A: the panel log names the GENERATED arm for the one generated room (${START})`,
            log.includes(`ap placement: the GENERATED arm — the rules carry 1 generated Seedling room(s) (${START})`)
            && log.includes(`— ${SET.set_id}`), log.split('\n').filter((l) => l.includes('ap placement')).join(' | '));
        const mounted = await readLevelSet();
        check('Phase A: botLevelSet reports the ASSEMBLED set — its set_id, the room + the PARKING room, its start level',
            mounted?.active === SET.set_id && mounted?.table_levels === SET.rooms.length && mounted?.start_level === SET.start.level,
            JSON.stringify(mounted));
        check('Phase A: the load delivered, reset and bound (ok, every step present)', load.ok === true
            && ['deliver-end', 'reset-end', 'bind'].every((n) => load.steps.some((s) => s.name === n)),
            `reset ${JSON.stringify(load.reset && { mode: load.reset.mode, landed: load.reset.landed })}`);

        // ── Phase B — the boot position ─────────────────────────────────────
        const want = DOOR.entrance_spawn;
        await page.waitForTimeout(1500);
        const liveB = await liveCell();
        check(`Phase B: the player is VISIBLE on ${DOOR.exit_id}'s APPROACH cell ${JSON.stringify(cellOfPx(want))}, level ${ROOM.level}`,
            (await readGameState()).level === ROOM.level && onApproach(liveB, want), `live ${JSON.stringify(liveB)}`);
        check(`Phase B: the state manager holds NO ${ITEM} yet`, (await held(ITEM)) === 0, String(await held(ITEM)));
        const statsB = await glueStats();
        check('Phase B: the boot raised no warning, published no crossing, refused no door',
            statsB.warnings === 0 && (await glueMoves()).length === 0 && statsB.doorsLocked === 0 && statsB.bounces === 0,
            JSON.stringify(statsB));
        const chainB = await focusChain();
        check('Phase B: the game\'s CANVAS has the page\'s keyboard after ▶ Start (no click)', gameHasKeys(chainB), JSON.stringify(chainB));

        // ── Phase L — LOCKED: the door without the item ─────────────────────
        const landingsBeforeL = landings(ROOM.level, want);
        const exitBeforeL = (await readGameState()).pendingExit;
        const firedL = async () => ((await readGameState()).pendingExit !== exitBeforeL);
        const walkL = await walkTo('Phase L', doorCell, firedL);
        const pL = parsePending((await readGameState()).pendingExit);
        check(`Phase L: real keys walked onto the gated door ${DOOR.exit_id} WITHOUT ${ITEM} and the game fired it (@to = the PARKING level ${PARKING})`,
            !!walkL?.walked.ok && !!pL && `out_${pL.type}_${pL.x}_${pL.y}` === DOOR.exit_id && pL.to === PARKING,
            JSON.stringify(pL));
        const bounced = await waitFor('the bounce lands the player back in the room', async () => {
            const s = await glueStats();
            const st = await readGameState();
            return s.bounces >= 1 && st.level === ROOM.level && landings(ROOM.level, want) > landingsBeforeL ? s : null;
        }, 15000).catch(() => null);
        await page.waitForTimeout(1500);
        const liveL = await liveCell();
        const still = await stillFor();
        check(`Phase L: the host REFUSED — the bounce teleport new Game(${ROOM.level},${want.x},${want.y}) landed the player VISIBLE `
            + `on the approach ${JSON.stringify(cellOfPx(want))} again, standing still`,
            !!bounced && onApproach(liveL, want) && still && (await readGameState()).level === ROOM.level,
            `live ${JSON.stringify(liveL)}, still ${still}, landings ${landingsBeforeL} -> ${landings(ROOM.level, want)}`);
        const statsL = await glueStats();
        check(`Phase L: NO user:regionMove, the AP region is still ${START}, and the game's parking swap was swallowed (no warning, no mark left)`,
            (await glueMoves()).length === 0 && (await currentRegion()) === START && statsL.warnings === 0
            && statsL.doorsLocked === 1 && statsL.bounces === 1 && statsL.parks === statsB.parks,
            `${JSON.stringify(statsL)}; marks ${JSON.stringify(await bindingMarks())}`);
        const marks = await bindingMarks();
        check('Phase L: the binding holds no mark after the bounce landed (the swap and the landing each consumed theirs)',
            !marks?.bounce && !marks?.departure && !marks?.arrival, JSON.stringify(marks));
        check(`Phase L: the panel says "${MESSAGE}"`, (await panelLog()).includes(`[door gate] ${MESSAGE}`),
            (await panelLog()).split('\n').filter((l) => l.includes('[door gate]')).join(' | '));
        const locks = await doorLocks();
        check(`Phase L: ONE ${DOOR_LOCKED_EVENT} naming ${CHILD} and [${ITEMS.join(', ')}]`,
            locks.length === 1 && locks[0].region === CHILD && locks[0].sourceRegion === START
            && JSON.stringify(locks[0].needs) === JSON.stringify(ITEMS) && locks[0].message === MESSAGE, JSON.stringify(locks));

        // ── Phase K — the key ────────────────────────────────────────────────
        const checksBefore = (await glueStats()).locationChecks;
        const pendingBefore = (await readGameState()).pendingCheck;
        const checked = async () => ((await readGameState()).pendingCheck !== pendingBefore);
        const walkK = await walkTo('Phase K', LOC.cell, checked);
        check(`Phase K: real keys walked the player onto ${LOC.name}'s cell ${JSON.stringify(LOC.cell)} and the game wrote pendingCheck`,
            !!walkK?.walked.ok && await checked(), JSON.stringify(walkK?.walked));
        const got = await waitFor(`${ITEM} arrives in the state manager`, async () => ((await held(ITEM)) >= 1) || null, 10000)
            .catch(() => null);
        const statsK = await glueStats();
        check(`Phase K: ONE user:locationCheck for ${LOC.name}, "found ${ITEM} for you", and the state manager now holds ${ITEM}`,
            !!got && statsK.locationChecks === checksBefore + 1
            && (await panelLog()).includes(`[ap placement] found ${LOC_ITEM.item} for ${LOC_ITEM.player === SELF ? 'you' : `Player ${LOC_ITEM.player}`} at "${LOC.name}"`),
            `holds ${await held(ITEM)}; ${JSON.stringify(statsK)}`);

        // ── Phase O — OPEN: the same door with the item ─────────────────────
        const exitBeforeO = (await readGameState()).pendingExit;
        const firedO = async () => ((await readGameState()).pendingExit !== exitBeforeO);
        const walkO = await walkTo('Phase O', doorCell, firedO);
        const pO = parsePending((await readGameState()).pendingExit);
        check(`Phase O: real keys walked onto ${DOOR.exit_id} again, WITH ${ITEM}, and the game fired it`,
            !!walkO?.walked.ok && !!pO && `out_${pO.type}_${pO.x}_${pO.y}` === DOOR.exit_id, JSON.stringify(pO));
        const movesO = await waitFor('ONE regionMove into the child', async () => {
            const m = await glueMoves();
            return m.length >= 1 ? m : null;
        }, 15000).catch(async () => glueMoves());
        check(`Phase O: ONE user:regionMove ${START} -> ${CHILD} through ${DOOR.exitName}`,
            movesO.length === 1 && movesO[0].sourceRegion === START && movesO[0].targetRegion === CHILD
            && movesO[0].exitName === DOOR.exitName, JSON.stringify(movesO));
        const parked = await waitFor('the game swaps into the PARKING room', async () => {
            const s = await readGameState();
            return s.level === PARKING ? s : null;
        }, 10000).catch(() => null);
        const inChild = await waitFor(`gameState in ${CHILD}`, async () =>
            ((await currentRegion()) === CHILD ? CHILD : null), 15000).catch(() => null);
        await page.waitForTimeout(2500);
        const statsO = await glueStats();
        check(`Phase O: the swap into the PARKING room was swallowed (no second move); the flash panel PARKED and the maze owns ${CHILD}; `
            + 'still ONE refusal and ONE bounce on the books',
            !!parked && inChild === CHILD && (await glueMoves()).length === 1 && statsO.parks === statsB.parks + 1
            && (await activeSubstrates()).at(-1) === 'maze' && statsO.doorsLocked === 1 && statsO.bounces === 1
            && statsO.warnings === 0,
            `level ${parked?.level}, ${JSON.stringify(statsO)}, active ${JSON.stringify(await activeSubstrates())}`);
        const landed = await waitFor(`the maze panel holds ${CHILD}`, async () => {
            const m = await mazePlayer();
            return m?.region === CHILD ? m : null;
        }, 15000);
        const arm = await mazeArm();
        console.log(`  (Phase O) the maze's arrival: ${JSON.stringify(arm)}`);
        check(`Phase O: the maze put the player ON ${FORWARD.exit_id} (${FORWARD.x},${FORWARD.y}), the exit PAIRED with the door`,
            landed.pos.x === FORWARD.x && landed.pos.y === FORWARD.y && arm?.region === CHILD
            && arm?.arrivedFrom?.exit_id === DOOR.targetExitId, `player ${JSON.stringify(landed.pos)}; ${JSON.stringify(arm)}`);
        const mazeKeys = await waitFor('the maze panel has the keyboard after the door', mazeHasKeys, 5000)
            .catch(async () => page.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`));
        check('Phase O: the MAZE panel has the page\'s keyboard after the door (no click)',
            typeof mazeKeys === 'string' && mazeKeys.startsWith('maze-room-panel'), JSON.stringify(mazeKeys));

        // ── Phase R — in again: NO load, NO reset — the binding's arrival alone ──
        const loadsBeforeR = (await glueStats()).loads;
        const resumesBeforeR = (await glueStats()).resumes;
        const landingsBeforeR = landings(ROOM.level, want);
        const pendingR = (await readGameState()).pendingExit;
        const again = await mazeKeyPlan({ exitTo: START });
        await pressKeys(again.keys ?? []);
        const inAgain = await waitFor(`gameState back in ${START}`, async () =>
            ((await currentRegion()) === START ? START : null), 15000).catch(async () => currentRegion());
        check(`Phase R: off ${FORWARD.exit_id} and back on (${again.keys?.join(' ') ?? again.error}) re-enters ${START} — `
            + `the child's back door is gated on the same ${ITEM}, and the player holds it`, inAgain === START, String(inAgain));
        await waitFor(`the arrival new Game(${ROOM.level},${want.x},${want.y}) again`, () =>
            landings(ROOM.level, want) > landingsBeforeR || null, 20000).catch(() => null);
        await page.waitForTimeout(2500);
        const liveR = await liveCell();
        const statsR = await glueStats();
        const a = await arrival();
        console.log(`  (Phase R) the binding's arrival: arrivedFrom ${JSON.stringify(a.arrivedFrom)} -> ${JSON.stringify(a.spawn)}`);
        check(`Phase R: the glue RESUMED (no second delivery, no reset) and its OWN arrival landed the player on ${DOOR.exit_id}'s `
            + `APPROACH ${JSON.stringify(cellOfPx(want))}; no door fired, no new refusal`,
            statsR.loads === loadsBeforeR + 1 && statsR.resumes === resumesBeforeR + 1 && onApproach(liveR, want)
            && a.spawn?.exitId === DOOR.exit_id && a.spawn?.matchedArrivedFrom === true
            && (await readGameState()).pendingExit === pendingR && (await glueMoves()).length === 1
            && statsR.doorsLocked === 1 && statsR.bounces === 1,
            `live ${JSON.stringify(liveR)}, ${JSON.stringify(statsR)}, spawn ${JSON.stringify(a.spawn)}`);
        const chainR = await focusChain();
        check('Phase R: the game\'s CANVAS has the keyboard again (no click)', gameHasKeys(chainR), JSON.stringify(chainR));

        const statsEnd = await glueStats();
        check('the glue agrees with the independent watchers', statsEnd.regionMoves === (await glueMoves()).length
            && statsEnd.regionMoves === 1 && statsEnd.warnings === 0 && statsEnd.doorsLocked === (await doorLocks()).length,
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
        ? '\nOK: the generated host plays — the gated door refused without the key and bounced the player home, the key opened it, into the maze child and back'
        : `\nFAILED: ${failed} check(s)`);
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
