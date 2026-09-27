#!/usr/bin/env node
/**
 * Seedling generated levels, G7: a REAL Seedling room's OWN location is
 * COLLECTED in play — the chest of the real `starting_house` fires the game's
 * `pendingCheck`, and the ATLAS arm (bound where the room stands: no rewrite,
 * no delivery) turns it into ONE `user:locationCheck` for the atlas-named
 * location, the item the rules placed there arrives in the state manager, and
 * the door that item unlocks lets the player out.
 *
 * The world is the committed `seedling_atlas_location` preset
 * (`make-seedling-spiral-room-preset.mjs --state=atlas-location`, from
 * `SEEDLING_ATLAS_LOCATION_STATE` = G6's first pick): the START is the real
 * `starting_house` (level 86) with `key_blue` in its chest; the room's one door
 * leads to a maze child behind `Has(key_blue)` (read off static data). Every
 * expectation is read from that preset, the starter atlas or its map extract —
 * the chest's address is the map entity's own `@tag` — never typed here.
 *
 *   Phase A — boot in the real room; ▶ Start; the panel log names the ATLAS
 *     arm and its one bound location; the load's step log is `bind` alone (no
 *     overlay, no delivery, no reset); the adapter was told the host owns it.
 *   Phase L — LOCKED: a real key onto the door WITHOUT `key_blue`: the game
 *     fires it, the host refuses and bounces the player back onto the door's
 *     return spawn; no check fired.
 *   Phase K — THE CHEST: a real key onto the chest: the game writes
 *     `pendingCheck "<seq>|86|<tag>|0"`; ONE `user:locationCheck` for
 *     `Starting House - Chest` (the glue's, and no vanilla-named one from the
 *     adapter's property path); the readout "found key_blue for you"; the state
 *     manager holds `key_blue` and has the location checked.
 *   Phase O — OUT: the same door WITH `key_blue`: ONE `user:regionMove` into
 *     the maze child through the door's `exitName`; the maze owns the player.
 *   Phase R — IN AGAIN (trap 1418), by maze keys back onto the paired exit: the
 *     glue resumes and its own arrival lands on the door's return spawn; the
 *     chest does not check twice.
 *
 * ⛔ PAGE ERRORS ARE A DIAGNOSTIC LINE, NOT A check() (the logic-only channel
 * loses the WebGPU device by design — see `check-seedling-spiral-room-play.mjs`).
 * The hands are `seedlingRoomPlay.js`'s, shared with the other room gates.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default
 * http://localhost:8000); the wasm build (the `flashPanel/wasm` submodule), or
 * this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/check-seedling-atlas-location-play.mjs [--host=http://localhost:8000] [--game=seedling_atlas_location]
 * @ci-box enrolled beside check-seedling-atlas-host-play as a box row (seedling generated G7): its phases hold real keys for wall-clock durations against the Seedling wasm, measured only on this box's logic-only channel.
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
import { FLASH_PANEL, clickPanelTab, createRoomPlay } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/**
 * ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door): the box
 * lock, the preset read and the browser all live in `main()`.
 */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'check-seedling-atlas-location-play.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const GAME = arg('game', 'seedling_atlas_location');

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

    // ── What the preset, the atlas and the map say ──────────────────────────
    const M = (p) => import(join(REPO, 'frontend/modules', p));
    const { lockedDoorMessage, ruleItemNames, staticExitOf } = await M('flashPanel/seedlingDoorGate.js');
    const { DOOR_LOCKED_EVENT } = await M('flashPanel/seedlingRegionGlue.js');
    const { atlasPathInIndex } = await M('flashPanel/mapDocumentPath.js');
    const SIDECARS = PRESET.preset_sidecars['1'];
    const REGIONS = PRESET.regions['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const ROOM = SIDECARS[START]?.substrate === 'flash_seedling' ? SIDECARS[START].playable_payload : null;
    const TILE = ROOM?.tile_size;
    const DOOR = ROOM?.exits?.[0] ?? null;
    const RULE = DOOR ? staticExitOf({ regions: REGIONS }, START, DOOR.exitName)?.access_rule ?? null : null;
    const ITEMS = RULE ? ruleItemNames(RULE) : [];
    const ITEM = ITEMS[0] ?? null; // key_blue, in the committed world
    const CHILD = DOOR?.targetRegion ?? null;
    const MESSAGE = CHILD ? lockedDoorMessage(CHILD, ITEMS) : null;
    const FORWARD = (SIDECARS[CHILD]?.playable_payload?.exits ?? []).find((e) => e.targetRegion === START) ?? null;
    const LOC = (REGIONS[START]?.locations ?? []).find((l) => l.item?.name === ITEM) ?? null;
    const SELF = Number(Object.keys(PRESET.player_names ?? { 1: '' })[0]);
    /** The chest's address: the atlas tile of the location → the map entity granting its vanilla item → its @tag. */
    const INDEX = JSON.parse(readFileSync(join(FLASH_DIR, 'atlases', 'atlas_files.json'), 'utf8'));
    const ATLAS = JSON.parse(readFileSync(join(REPO, 'frontend',
        atlasPathInIndex(INDEX, PRESET.region_atlas.atlas_id)), 'utf8'));
    const ATLAS_LOC = ATLAS.regions.find((r) => r.region_id === ROOM?.atlas_region)?.locations
        ?.find((l) => l.name === LOC?.name) ?? null;
    const MAP = JSON.parse(readFileSync(join(FLASH_DIR, 'atlases',
        PRESET.region_atlas?.map_document ?? 'seedling-map.json'), 'utf8'));
    const LEVEL = MAP.levels.find((l) => l.level === ROOM?.level);
    const onTile = (t) => (LEVEL?.entities ?? []).filter((e) => Math.floor(e.x / MAP.tile_size) === t[0]
        && Math.floor(e.y / MAP.tile_size) === t[1]);
    const CHEST = ATLAS_LOC ? onTile(ATLAS_LOC.tile).find((e) => e.type === 'chest') ?? null : null;
    const CHEST_TAG = CHEST ? Number(CHEST.attrs?.tag) : null;
    const doorEntity = DOOR ? onTile(DOOR.exit_tiles[0]).find((e) => e.attrs?.to !== undefined) ?? null : null;
    const REAL_TO = doorEntity ? Number(doorEntity.attrs.to) : null;
    const RETURNS = returnSpawnTable(MAP);
    const HOME = DOOR ? RETURNS.get(returnKey(ROOM.level, ...DOOR.exit_tiles[0])) ?? DOOR.entrance_spawn : null;
    /**
     * Which key steps onto each target from the door's return spawn — measured on
     * the box at G6 (plan §12.4, `box-t3-atlas-try2`): the house door is BELOW
     * the return spawn, the chest two tiles ABOVE it. Keyed by the ATLAS door id
     * and the entity type, so a regenerated preset binding another room fails
     * here by name.
     */
    const STEP_KEYS = Object.freeze({ door: 'ArrowDown', chest: 'ArrowUp' });

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
        holdUntil, invoked, parsePending, mazeKeyPlan, pressKeys, mazePlayer, mazeHasKeys,
    } = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: 'check-seedling-atlas-location-play' });

    const held = (item) => page.evaluate((it) =>
        window.stateManagerProxy?.getLatestStateSnapshot?.()?.inventory?.[it] ?? 0, item);
    const checkedLocations = () => page.evaluate(() =>
        [...(window.stateManagerProxy?.getLatestStateSnapshot?.()?.checkedLocations ?? [])]);
    /** Every `user:locationCheck` on the dispatcher, whoever published it (the glue OR the adapter). */
    const locationChecks = () => page.evaluate(() => window.__locationChecks ?? []);
    const doorLocks = () => page.evaluate(() => window.__doorLocked ?? []);
    const panelLog = () => page.evaluate(() => document.querySelector('.flash-panel-log')?.textContent ?? '');
    const hostOwned = () => page.evaluate(async () => {
        const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
        return [...(p?.adapter?.hostOwnedLocations ?? [])];
    });
    const loadResult = () => page.evaluate(async () => {
        const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
        const r = p?._apLoadResult;
        return r ? { ok: r.ok, why: r.why, steps: r.steps, reset: r.reset, delivered: r.delivered } : null;
    });
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
    /**
     * A real key onto the door until the game writes a new pendingExit; the parsed report.
     * ⛓ The budget is per TILE: from the chest the door is three tiles down, not
     * one, and a tile took 1.8 s at load 17 (measured, the first run's Phase L).
     */
    async function stepOntoDoor() {
        await focusGame();
        const before = (await readGameState()).pendingExit;
        const from = await livePlayer();
        const tiles = from ? Math.max(1, DOOR.exit_tiles[0][1] - Math.floor(from.y / TILE)) : 1;
        const on = await holdUntil(STEP_KEYS[DOOR.exit_id], async () => {
            const s = await readGameState();
            return s.pendingExit !== before ? s.pendingExit : null;
        }, 6000 * tiles);
        if (!on.value) {
            console.log(`  (stepOntoDoor) no door fired in ${on.ms} ms (${tiles} tile(s) budgeted) — from `
                + `${JSON.stringify(from)} to ${JSON.stringify(await livePlayer())}; focus ${JSON.stringify(await focusChain())}; `
                + `state ${JSON.stringify(await readGameState())}`);
        }
        const p = parsePending(on.value);
        return { p, ms: on.ms, onTile: !!p && Math.floor(p.x / TILE) === DOOR.exit_tiles[0][0]
            && Math.floor(p.y / TILE) === DOOR.exit_tiles[0][1] };
    }

    try {
        check('the preset\'s START is the REAL room holding the gate\'s item in its OWN atlas-named location, its one door '
            + 'gated off static data', !!ROOM && ROOM.atlas_region === 'starting_house' && !!DOOR && !!ITEM && !!LOC
            && ROOM.exits.length === 1 && SIDECARS[CHILD]?.substrate === 'maze' && DOOR.access_rule === undefined,
        `${START} (${ROOM?.atlas_region}, level ${ROOM?.level}): ${DOOR?.exit_id} -> ${CHILD} ${JSON.stringify(RULE)}; `
            + `${LOC?.name} holds ${LOC?.item?.name}`);
        check('the location is the atlas\'s, on a tile whose chest carries a persistence tag (the address the table binds)',
            !!ATLAS_LOC && !!CHEST && Number.isInteger(CHEST_TAG) && CHEST_TAG >= 0,
            `${ATLAS_LOC?.name} tile ${JSON.stringify(ATLAS_LOC?.tile)}; chest ${JSON.stringify(CHEST)}`);
        check('the door is PAIRED with the child\'s exit, and the map gives it a REAL @to other than the room\'s level',
            !!FORWARD && DOOR.targetExitId === FORWARD.exit_id && Number.isInteger(REAL_TO) && REAL_TO !== ROOM.level,
            `${DOOR?.exit_id}/${FORWARD?.exit_id}; @to ${REAL_TO}`);
        check('the door and the chest have a measured step recipe', !!STEP_KEYS[DOOR?.exit_id] && !!STEP_KEYS[CHEST?.type]);

        // ── Phase A — boot, and the ATLAS arm binds ────────────────────────
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        await waitFor('rules loaded', () => page.evaluate(
            () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
        await installWatchers();
        await page.evaluate(async ({ label, event }) => {
            window.__doorLocked = [];
            window.__locationChecks = [];
            const bus = (await import('./app/core/eventBus.js')).default;
            bus.subscribe(event, (p) => window.__doorLocked.push(p), label);
            const { getActivePanelInstance } = await import('./modules/flashPanel/index.js');
            // ⛓ Every publish, glue's or adapter's, is ONE dispatcher call — wrap the one they share.
            const wrap = () => {
                const d = getActivePanelInstance()?.adapter?.dispatcher ?? null;
                if (!d || d.__g7Wrapped) return !!d;
                const orig = d.publish.bind(d);
                d.publish = (name, payload, opts) => {
                    if (name === 'user:locationCheck') window.__locationChecks.push(payload?.locationName ?? null);
                    return orig(name, payload, opts);
                };
                d.__g7Wrapped = true;
                return true;
            };
            window.__g7WrapDispatcher = wrap;
        }, { label: 'check-seedling-atlas-location-play', event: DOOR_LOCKED_EVENT });
        check(`Phase A: the player starts in the real room ${START}`, (await currentRegion()) === START, await currentRegion());
        await waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
        await waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
        await waitFor('start button enabled', () => gameFrame().evaluate(() => {
            const b = document.getElementById('btn-start');
            return !!b && !b.disabled;
        }));
        await gameFrame().click('#btn-start');
        await assertLogicOnlyChannel(gameFrame());
        await waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
            document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);
        const wrapped = await waitFor('the dispatcher both check paths publish on', () => page.evaluate(() =>
            window.__g7WrapDispatcher?.() || null), 20000).catch(() => false);
        check('Phase A: the dispatcher the glue and the adapter share is watched', wrapped === true);
        const load = await waitFor('the AP load finished (the panel\'s own step log)', loadResult, 120000);
        const log = await panelLog();
        check(`Phase A: the panel log names the ATLAS arm and its ONE bound location, refusing none`,
            log.includes('atlas arm: 1 real room(s), 1 of 1 location(s) bound where they stand (no rewrite, no delivery)')
            && !log.includes('is NOT bound') && !log.includes('not applicable'),
            log.split('\n').filter((l) => l.includes('ap placement')).join(' | '));
        check('Phase A: the load BOUND and did nothing else — no overlay, no delivery, no reset',
            load?.ok === true && JSON.stringify((load.steps ?? []).map((s) => s.name)) === '["bind"]'
            && load.reset === null && load.delivered === null && !(await glueStats()).setDeliveries,
            JSON.stringify(load));
        check(`Phase A: the adapter was told the host OWNS ${LOC.name} (its property path stands down on it)`,
            JSON.stringify(await hostOwned()) === JSON.stringify([LOC.name]), JSON.stringify(await hostOwned()));
        await page.waitForTimeout(1500);
        const liveA = await livePlayer();
        check(`Phase A: the player stands at ${DOOR.exit_id}'s return spawn in level ${ROOM.level}, holding no ${ITEM}`,
            (await readGameState()).level === ROOM.level && near(liveA, HOME) && (await held(ITEM)) === 0,
            `live ${JSON.stringify(liveA)}, return spawn ${JSON.stringify(HOME)}`);
        const chainA = await focusChain();
        check('Phase A: the game\'s CANVAS has the page\'s keyboard after ▶ Start (no click)', gameHasKeys(chainA), JSON.stringify(chainA));
        const bootStats = await glueStats();

        // ── Phase L — the door WITHOUT the key ──────────────────────────────
        const landingsBeforeL = landings(ROOM.level, HOME);
        const checkBeforeL = (await readGameState()).pendingCheck;
        const L = await stepOntoDoor();
        check(`Phase L: a real ${STEP_KEYS[DOOR.exit_id]} onto ${DOOR.exit_id} WITHOUT ${ITEM}: the game fired it, @to = its REAL level ${REAL_TO}`,
            L.onTile && L.p.fromLevel === ROOM.level && L.p.to === REAL_TO, `${JSON.stringify(L.p)} in ${L.ms} ms`);
        const bounced = await waitFor('the bounce lands the player back in the room', async () => {
            const s = await glueStats();
            const st = await readGameState();
            return s.bounces >= 1 && st.level === ROOM.level && landings(ROOM.level, HOME) > landingsBeforeL ? s : null;
        }, 15000).catch(() => null);
        await page.waitForTimeout(1500);
        const liveL = await livePlayer();
        const still = await stillFor();
        const statsL = await glueStats();
        check(`Phase L: the host REFUSED — NO user:regionMove, bounced to the return spawn, standing still; "${MESSAGE}"; `
            + 'no check fired', !!bounced && near(liveL, HOME) && still && (await glueMoves()).length === 0
            && statsL.doorsLocked === 1 && statsL.bounces === 1 && statsL.warnings === 0
            && (await panelLog()).includes(`[door gate] ${MESSAGE}`) && (await doorLocks()).length === 1
            && statsL.locationChecks === bootStats.locationChecks && (await readGameState()).pendingCheck === checkBeforeL,
        `live ${JSON.stringify(liveL)}, still ${still}, ${JSON.stringify(statsL)}`);

        // ── Phase K — the chest ─────────────────────────────────────────────
        await focusGame();
        const pendingBefore = (await readGameState()).pendingCheck;
        const checksBefore = (await locationChecks()).length;
        const K = await holdUntil(STEP_KEYS.chest, async () => {
            const s = await readGameState();
            return s.pendingCheck !== pendingBefore ? s.pendingCheck : null;
        }, 6000);
        const parts = String(K.value ?? '').split('|').map(Number);
        check(`Phase K: a real ${STEP_KEYS.chest} onto ${LOC.name} (tile ${JSON.stringify(ATLAS_LOC.tile)}) and the game wrote `
            + `pendingCheck <seq>|${ROOM.level}|${CHEST_TAG}|0 — the chest's own @tag, no rewrite`,
            parts.length === 4 && parts[1] === ROOM.level && parts[2] === CHEST_TAG && parts[3] === 0,
            `${JSON.stringify(K.value)} in ${K.ms} ms; live ${JSON.stringify(await livePlayer())}`);
        const got = await waitFor(`${ITEM} arrives in the state manager`, async () => ((await held(ITEM)) >= 1) || null, 10000)
            .catch(() => null);
        await page.waitForTimeout(2000);
        const checksK = (await locationChecks()).slice(checksBefore);
        const statsK = await glueStats();
        check(`Phase K: ONE user:locationCheck — for "${LOC.name}", the glue's — and NO second, vanilla-named one from the `
            + 'adapter\'s property path', JSON.stringify(checksK) === JSON.stringify([LOC.name])
            && statsK.locationChecks === bootStats.locationChecks + 1 && !(await panelLog()).includes('dispatched user:locationCheck'),
        `${JSON.stringify(checksK)}; ${JSON.stringify(statsK)}`);
        check(`Phase K: the readout "found ${ITEM} for you", the state manager holds ${ITEM} and has ${LOC.name} checked`,
            !!got && (await panelLog()).includes(`[ap placement] found ${ITEM} for ${LOC.item.player === SELF ? 'you' : `Player ${LOC.item.player}`} at "${LOC.name}"`)
            && (await checkedLocations()).includes(LOC.name), `holds ${await held(ITEM)}; checked ${JSON.stringify(await checkedLocations())}`);

        // ── Phase O — out through the door WITH the key ─────────────────────
        const O = await stepOntoDoor();
        const movesO = await waitFor('ONE regionMove into the child', async () => {
            const m = await glueMoves();
            return m.length >= 1 ? m : null;
        }, 15000).catch(async () => glueMoves());
        check(`Phase O: a real ${STEP_KEYS[DOOR.exit_id]} onto ${DOOR.exit_id} WITH ${ITEM}: ONE user:regionMove ${START} -> ${CHILD} `
            + `through ${DOOR.exitName}`, O.onTile && movesO.length === 1 && movesO[0].sourceRegion === START
            && movesO[0].targetRegion === CHILD && movesO[0].exitName === DOOR.exitName, `${JSON.stringify(O.p)}; ${JSON.stringify(movesO)}`);
        const inChild = await waitFor(`gameState in ${CHILD}`, async () =>
            ((await currentRegion()) === CHILD ? CHILD : null), 15000).catch(() => null);
        const landed = await waitFor(`the maze panel holds ${CHILD}`, async () => {
            const m = await mazePlayer();
            return m?.region === CHILD ? m : null;
        }, 15000).catch(() => null);
        await page.waitForTimeout(1500);
        check(`Phase O: the flash panel PARKED and the maze owns ${CHILD}, the player ON ${FORWARD.exit_id} (${FORWARD.x},${FORWARD.y})`,
            inChild === CHILD && (await activeSubstrates()).at(-1) === 'maze' && landed?.pos.x === FORWARD.x
            && landed?.pos.y === FORWARD.y && (await glueMoves()).length === 1, JSON.stringify(landed));
        await waitFor('the maze panel has the keyboard after the door', mazeHasKeys, 5000).catch(() => null);

        // ── Phase R — in again (trap 1418) ──────────────────────────────────
        const loadsBeforeR = (await glueStats()).loads;
        const resumesBeforeR = (await glueStats()).resumes;
        const landingsBeforeR = landings(ROOM.level, HOME);
        const again = await mazeKeyPlan({ exitTo: START });
        await pressKeys(again.keys ?? []);
        const inAgain = await waitFor(`gameState back in ${START}`, async () =>
            ((await currentRegion()) === START ? START : null), 15000).catch(async () => currentRegion());
        await waitFor('the arrival on the return spawn again', () => landings(ROOM.level, HOME) > landingsBeforeR || null, 20000)
            .catch(() => null);
        await page.waitForTimeout(2500);
        const liveR = await livePlayer();
        const statsR = await glueStats();
        const a = await arrival();
        check(`Phase R: back through ${FORWARD.exit_id} (${again.keys?.join(' ') ?? again.error}) the glue RESUMED (no delivery, `
            + `no reset) and its own arrival landed on ${DOOR.exit_id}'s return spawn`,
            inAgain === START && statsR.loads === loadsBeforeR + 1 && statsR.resumes === resumesBeforeR + 1
            && near(liveR, HOME) && a.spawn?.exitId === DOOR.exit_id, `live ${JSON.stringify(liveR)}, ${JSON.stringify(statsR)}`);
        const chest2 = await holdUntil(STEP_KEYS.chest, async () => null, 2000);
        await page.waitForTimeout(1500);
        const statsR2 = await glueStats();
        check(`Phase R: onto the (opened) chest again — no second check (${(await locationChecks()).length} user:locationCheck in all)`,
            JSON.stringify(await locationChecks()) === JSON.stringify([LOC.name]) && statsR2.locationChecks === statsK.locationChecks,
            `${chest2.ms} ms held; ${JSON.stringify(statsR2)}`);

        const statsEnd = await glueStats();
        check('the glue agrees with the independent watchers', statsEnd.regionMoves === (await glueMoves()).length
            && statsEnd.regionMoves === 1 && statsEnd.warnings === 0 && statsEnd.doorsLocked === (await doorLocks()).length
            && statsEnd.locationChecks === (await locationChecks()).length, JSON.stringify(statsEnd));
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
        ? '\nOK: the real room\'s own chest is a check — collected once, the item arrived, the door it gates opened'
        : `\nFAILED: ${failed} check(s)`);
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
