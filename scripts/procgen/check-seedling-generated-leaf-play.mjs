#!/usr/bin/env node
/**
 * Seedling generated levels, G3: a GENERATED Seedling room that sphere growth
 * placed as a LEAF behind a maze gate plays in the Seedling wasm, and the AP
 * item it holds is DELIVERED — the case `seedling-pipeline-plan.md` §17.6 left
 * open for real rooms. The maze's gates open as their keys are collected; the
 * maze's own walking takes the player in; the generated set is assembled and
 * mounted when ▶ Start is pressed; the goal cell's item fires a real check; the
 * game's own door takes the player back out, onto the maze exit paired with it.
 *
 * The world is the committed `seedling_generated_leaf` preset
 * (`make-seedling-spiral-room-preset.mjs --state=generated-leaf`, from
 * `SEEDLING_GENERATED_LEAF_STATE`). Every expectation is read from that preset,
 * or from the set the gate assembles from it headless (the same function the
 * page runs), never typed here — including the ROUTE: the region path from the
 * start to the leaf, and for every hop the item its rule names and the location
 * the rules placed it at.
 *
 *   Phase A — boot the DEFAULT mode on `?game=<preset>&seed=1`. The player starts
 *     in the maze START region, the maze panel holds the keyboard, and the flash
 *     glue has loaded nothing.
 *   Phase B — THE ROUTE. For every hop from the start to the leaf's parent: real
 *     keys walk to the location that holds the hop's gate item (the item
 *     arrives), then through the hop's exit (gameState follows).
 *   Phase C — IN, DELIVERED. Real keys cross the parent's gated exit: gameState
 *     moves to the leaf and the Flash Game tab comes forward; ▶ Start (the one
 *     click a person makes); the panel log names the GENERATED arm; the game's
 *     `botLevelSet` reports the assembler's `set_id`; the arrival lands the
 *     player VISIBLE on the door's APPROACH cell (the binding's arm is printed);
 *     no crossing is published; the canvas holds the keyboard.
 *   Phase D — THE CHECK. Real keys walk the player to the goal cell (the
 *     `apitem`): the game writes `pendingCheck`, ONE `user:locationCheck` for the
 *     leaf's location, and the readout says "found <item> for you".
 *   Phase E — OUT, fired BY THE GAME. Real keys walk onto the door: the game's
 *     door report's id arm (`out_<type>_<x>_<y>`) IS the payload's `exit_id` and
 *     its `@to` is the PARKING level; ONE `user:regionMove` to the parent through
 *     the door's `exitName`; the swap into the parking room is swallowed; the
 *     flash panel parks; the maze lands the player ON the exit paired with the
 *     door (the maze's arrival arm is printed) and holds the keyboard.
 *   Phase F — IN AGAIN, by keys off and back onto that exit. No delivery and no
 *     reset this time: the glue resumes, and the binding's OWN arrival lands the
 *     player on the door's approach. ⛔ MEASURED: Phase C alone cannot tell — the
 *     load's explicit-start reset re-lands on the same approach (the set's start
 *     IS the leaf's one door's approach), so a binding that landed the player ON
 *     the door passed Phases A–E (the mutant "arrival on the door tile").
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
 * Run: node scripts/procgen/check-seedling-generated-leaf-play.mjs [--host=http://localhost:8000] [--game=seedling_generated_leaf]
 * @ci-box enrolled beside check-seedling-generated-room-play as a box row (seedling generated G3): its phases hold real keys for wall-clock durations against the Seedling wasm, measured only on this box's logic-only channel.
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
 * The region path from `start` to `goal` through the rules' exits (Menu
 * excluded), each hop `{from, to, exit, rule}`; null when there is none.
 */
export function routeTo(regions, start, goal) {
    const prev = new Map([[start, null]]);
    const queue = [start];
    for (let i = 0; i < queue.length && !prev.has(goal); i += 1) {
        for (const e of regions[queue[i]]?.exits ?? []) {
            if (prev.has(e.connected_region) || e.connected_region === 'Menu') continue;
            prev.set(e.connected_region, { from: queue[i], to: e.connected_region, exit: e.name, rule: e.access_rule });
            queue.push(e.connected_region);
        }
    }
    if (!prev.has(goal)) return null;
    const hops = [];
    for (let at = prev.get(goal); at; at = prev.get(at.from)) hops.unshift(at);
    return hops;
}

/**
 * ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door): the box
 * lock, the preset read and the browser all live in `main()`.
 */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'check-seedling-generated-leaf-play.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const GAME = arg('game', 'seedling_generated_leaf');

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
    const SIDECARS = PRESET.preset_sidecars['1'];
    const REGIONS = PRESET.regions['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const LEAVES = Object.entries(SIDECARS).filter(([, s]) => s.substrate === GEN_ROOM_SUBSTRATE_ID);
    const [LEAF, LEAF_SIDECAR] = LEAVES[0] ?? [null, null];
    const ROOM = LEAF_SIDECAR?.playable_payload ?? null;
    const TILE = ROOM?.tile_size;
    const DOOR = ROOM?.exits?.[0] ?? null;
    const PARENT = DOOR?.targetRegion ?? null;
    /** The parent's exit into the leaf, as the maze sidecar spells it. */
    const FORWARD = (SIDECARS[PARENT]?.playable_payload?.exits ?? []).find((e) => e.targetRegion === LEAF) ?? null;
    /** Where the rules placed each item: item → `[region, location]`. */
    const placedAt = new Map();
    const locationItem = new Map();
    for (const [r, reg] of Object.entries(REGIONS)) {
        for (const l of reg.locations ?? []) {
            locationItem.set(l.name, l.item ?? null);
            if (l.item?.name) placedAt.set(l.item.name, [r, l.name]);
        }
    }
    /** The route to the leaf: every hop, the item its rule names, and where that item lies. */
    const ROUTE = (routeTo(REGIONS, START, LEAF) ?? []).map((h) => ({
        ...h, item: h.rule?.rule === 'Has' ? h.rule.args.item_name : null,
        at: h.rule?.rule === 'Has' ? placedAt.get(h.rule.args.item_name) ?? null : null,
    }));
    const SELF = Number(Object.keys(PRESET.player_names ?? { 1: '' })[0]);
    const ASSEMBLED = assembleGeneratedSeedlingSet(PRESET, {
        locationItemOf: (n) => (locationItem.get(n) ? { name: locationItem.get(n).name, player: locationItem.get(n).player } : null),
        selfPlayer: SELF,
    });
    const SET = ASSEMBLED.set;
    const LOC = ROOM?.locations?.[0] ?? null;
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
        check, failures, waitFor, gameFrame, readGameState, livePlayer, activeTabTitles, currentRegion,
        glueStats, glueMoves, activeSubstrates, arrival, installWatchers, focusGame, focusChain, gameHasKeys,
        invoked, parsePending, mazeKeyPlan, pressKeys, mazePlayer, mazeHasKeys, readLevelSet, walkPath,
    } = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: 'check-seedling-generated-leaf-play' });

    /** How much of `item` the player holds, off the state snapshot. */
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
    const liveCell = async () => {
        const p = await livePlayer();
        return p ? { tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE), x: p.x, y: p.y } : null;
    };
    const panelLog = () => page.evaluate(() => document.querySelector('.flash-panel-log')?.textContent ?? '');
    const onApproach = (live, spawn) => !!live && Math.hypot(live.x - (spawn.x + TILE / 2), live.y - (spawn.y + TILE / 2)) <= 3;
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
    /** Walk the maze player to the live tile of location `name` in the region it holds. */
    async function collect(label, item, name) {
        const tile = await page.evaluate(async (locName) => {
            const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
            const hit = [...(p.world.itemLocationNames ?? new Map())].find(([, n]) => n === locName);
            if (!hit) return null;
            const [x, y] = hit[0].split(',').map(Number);
            return { x, y };
        }, name);
        check(`${label}: the live maze world has a tile for "${name}"`, !!tile, JSON.stringify(tile));
        const plan = await mazeKeyPlan({ tile });
        await pressKeys(plan.keys ?? []);
        const got = await waitFor(`${item} arrives`, async () => ((await held(item)) >= 1) || null, 10000).catch(() => false);
        check(`${label}: walking onto ${JSON.stringify(tile)} collected ${item}`, !!got,
            `${plan.keys?.length ?? plan.error} keys; holds ${await held(item)}`);
    }

    try {
        check('the preset places ONE generated room, not the start region, with ONE bound door to a maze parent',
            LEAVES.length === 1 && LEAF !== START && ROOM?.generated === true && ROOM.exits.length === 1
            && DOOR.external === true && SIDECARS[PARENT]?.substrate === 'maze', `${LEAF}: ${DOOR?.exit_id} -> ${PARENT}; start ${START}`);
        check('the door and the parent\'s exit are PAIRED by targetExitId, both ways',
            !!FORWARD && DOOR.targetExitId === FORWARD.exit_id && FORWARD.targetExitId === DOOR.exitName,
            `${DOOR?.exit_id}.targetExitId ${DOOR?.targetExitId} / ${FORWARD?.exit_id}.targetExitId ${FORWARD?.targetExitId}`);
        check('the route to the leaf ends through the parent, and EVERY hop is gated on an item placed on the route before it',
            ROUTE.length >= 1 && ROUTE.at(-1).from === PARENT && ROUTE.every((h, i) => !!h.item && !!h.at
                && ROUTE.slice(0, i + 1).some((g) => g.from === h.at[0])),
            ROUTE.map((h) => `${h.from} -[${h.item} @ ${h.at?.[1]}]-> ${h.to}`).join(' ; '));
        check('the leaf holds ONE location on its goal cell, and the set assembled headless joins its item',
            !!LOC && LOC.cell.tx === ROOM.goal_cell.tx && LOC.cell.ty === ROOM.goal_cell.ty && !!LOC_ITEM,
            `${LOC?.name} (${LOC_ITEM?.item}) at ${JSON.stringify(LOC?.cell)}`);
        check('the set assembled headless (the page\'s own function) validates and ends in the PARKING room',
            SET.rooms.at(-1)?.name === PARKING_ROOM_NAME && SET.rooms.length === ASSEMBLED.report.rooms + 1,
            `${SET.set_id}: ${SET.rooms.map((r) => r.name).join(', ')}`);

        // ── Phase A — boot, in the maze ─────────────────────────────────────────
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        await waitFor('rules loaded', () => page.evaluate(
            () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
        await installWatchers();
        await page.evaluate(async (label) => {
            window.__mazeLoads = [];
            const bus = (await import('./app/core/eventBus.js')).default;
            bus.subscribe('maze:loadRegion', (p) => window.__mazeLoads.push(
                { region_id: p?.region_id ?? null, arrivedFrom: p?.arrivedFrom ?? null }), label);
        }, 'check-seedling-generated-leaf-play');
        check(`Phase A: the player starts in the maze region ${START}`, (await currentRegion()) === START,
            await currentRegion());
        await waitFor(`the maze panel holds ${START}`, async () => ((await mazePlayer())?.region === START) || null, 20000);
        const bootKeys = await waitFor('the maze panel has the keyboard', mazeHasKeys, 10000).catch(() => null);
        check('Phase A: the MAZE panel has the page\'s keyboard at boot (no click)',
            typeof bootKeys === 'string' && bootKeys.startsWith('maze-room-panel'), String(bootKeys));
        /** The start region is a MAZE, so the glue has already PARKED once; count from here. */
        const boot = await glueStats();
        check('Phase A: the flash glue has loaded nothing yet', (boot?.loads ?? 0) === 0 && boot?.regionMoves === 0,
            JSON.stringify(boot));

        // ── Phase B — the route, key by key ─────────────────────────────────────
        for (const hop of ROUTE.slice(0, -1)) {
            if ((await held(hop.item)) < 1) await collect(`Phase B (${hop.from})`, hop.item, hop.at[1]);
            const plan = await mazeKeyPlan({ exitTo: hop.to });
            await pressKeys(plan.keys ?? []);
            const moved = await waitFor(`gameState moves to ${hop.to}`, async () =>
                ((await currentRegion()) === hop.to ? hop.to : null), 15000).catch(async () => currentRegion());
            await waitFor(`the maze panel holds ${hop.to}`, async () => ((await mazePlayer())?.region === hop.to) || null, 15000)
                .catch(() => null);
            check(`Phase B: WITH ${hop.item} the keys cross ${hop.from} -> ${hop.to}`, moved === hop.to,
                `${plan.keys?.length ?? plan.error} keys; region ${moved}`);
        }

        // ── Phase C — in, and the generated set delivered ───────────────────────
        const last = ROUTE.at(-1);
        if ((await held(last.item)) < 1) await collect(`Phase C (${last.from})`, last.item, last.at[1]);
        const toLeaf = await mazeKeyPlan({ exitTo: LEAF });
        await pressKeys(toLeaf.keys ?? []);
        const inLeaf = await waitFor(`gameState moves to ${LEAF}`, async () =>
            ((await currentRegion()) === LEAF ? LEAF : null), 15000).catch(async () => currentRegion());
        check(`Phase C: WITH ${last.item} the keys cross ${FORWARD.exit_id} into the generated leaf ${LEAF}`,
            inLeaf === LEAF, `${toLeaf.keys?.length ?? toLeaf.error} keys; region ${inLeaf}`);
        check('Phase C: the maze\'s crossing published no flash glue move', (await glueMoves()).length === 0);
        await waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
        const tabs = await activeTabTitles();
        check('Phase C: the Flash Game tab came forward by itself (no tab click)', tabs.includes('Flash Game'),
            `active tabs: ${tabs.join(', ')}`);
        await waitFor('start button enabled', () => gameFrame().evaluate(() => {
            const b = document.getElementById('btn-start');
            return !!b && !b.disabled;
        }));
        // ▶ Start: the one click a person makes to boot the game.
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
        check(`Phase C: the panel log names the GENERATED arm for the one generated room (${LEAF})`,
            log.includes(`ap placement: the GENERATED arm — the rules carry 1 generated Seedling room(s) (${LEAF})`)
            && log.includes(`— ${SET.set_id}`), log.split('\n').filter((l) => l.includes('ap placement')).join(' | '));
        const mounted = await readLevelSet();
        check('Phase C: botLevelSet reports the ASSEMBLED set — its set_id, the leaf + the PARKING room, its start level',
            mounted?.active === SET.set_id && mounted?.table_levels === SET.rooms.length && mounted?.start_level === SET.start.level,
            JSON.stringify(mounted));
        check('Phase C: the load delivered, reset and bound (ok, every step present)', load.ok === true
            && ['deliver-end', 'reset-end', 'bind'].every((n) => load.steps.some((s) => s.name === n)),
            `reset ${JSON.stringify(load.reset && { mode: load.reset.mode, landed: load.reset.landed })}`);
        const want = DOOR.entrance_spawn;
        await waitFor(`the arrival new Game(${ROOM.level},${want.x},${want.y})`,
            () => logs.some((l) => l.includes(invoked(ROOM.level, want))) || null, 20000);
        await page.waitForTimeout(2500);
        const a = await arrival();
        const liveC = await liveCell();
        const armC = a.spawn?.matchedArrivedFrom && a.spawnByExitId?.exitId === DOOR.exit_id ? 'exit_id (arm 1-2)'
            : a.spawn?.matchedArrivedFrom ? 'source_region (arm 3)' : 'unmatched';
        console.log(`  (Phase C) the binding's arrival: arrivedFrom ${JSON.stringify(a.arrivedFrom)} -> ${JSON.stringify(a.spawn)}; `
            + `by exit_id alone ${JSON.stringify(a.spawnByExitId)} — the arm: ${armC}; landings `
            + `${logs.filter((l) => l.includes(invoked(ROOM.level, want))).length}`);
        check(`Phase C: the player is VISIBLE on ${DOOR.exit_id}'s APPROACH cell ${JSON.stringify(cellOfPx(want))}, level ${ROOM.level}, `
            + 'and the binding MATCHED the arrival to that door',
            (await readGameState()).level === ROOM.level && onApproach(liveC, want)
            && a.spawn?.exitId === DOOR.exit_id && a.spawn?.matchedArrivedFrom === true
            && a.spawn.x === want.x && a.spawn.y === want.y,
            `live ${JSON.stringify(liveC)}, spawn ${JSON.stringify(a.spawn)}`);
        const statsC = await glueStats();
        check('Phase C: the glue loaded the leaf once, published no crossing, raised no warning; the generated room\'s substrate owns it',
            statsC.loads === 1 && (await glueMoves()).length === 0 && statsC.warnings === 0
            && (await activeSubstrates()).at(-1) === GEN_ROOM_SUBSTRATE_ID, JSON.stringify(statsC));
        const chainC = await focusChain();
        check('Phase C: the game\'s CANVAS has the page\'s keyboard after ▶ Start (no canvas click)', gameHasKeys(chainC),
            JSON.stringify(chainC));

        // ── Phase D — the check ─────────────────────────────────────────────────
        const checksBefore = (await glueStats()).locationChecks;
        const pendingBefore = (await readGameState()).pendingCheck;
        const checked = async () => ((await readGameState()).pendingCheck !== pendingBefore);
        const walkD = await walkTo('Phase D', LOC.cell, checked);
        check(`Phase D: real keys walked the player onto the goal cell ${JSON.stringify(LOC.cell)} and the game wrote pendingCheck`,
            !!walkD?.walked.ok && await checked(), JSON.stringify(walkD?.walked));
        const pc = (await readGameState()).pendingCheck;
        const statsD = await waitFor('the check binding published the check', async () => {
            const s = await glueStats();
            return s.locationChecks > checksBefore ? s : null;
        }, 10000).catch(() => null);
        const [, lvl, tag] = String(pc).split('|').map(Number);
        check(`Phase D: pendingCheck names (level ${ROOM.level}, tag ${LOC.tag}) and ONE user:locationCheck went out for ${LOC.name}`,
            lvl === ROOM.level && tag === LOC.tag && statsD?.locationChecks === checksBefore + 1
            && (await panelLog()).includes(`[ap placement] checked "${LOC.name}"`), `pendingCheck ${JSON.stringify(pc)}, ${JSON.stringify(statsD)}`);
        const found = `[ap placement] found ${LOC_ITEM.item} for ${LOC_ITEM.player === SELF ? 'you' : `Player ${LOC_ITEM.player}`} at "${LOC.name}"`;
        check(`Phase D: the readout says "found ${LOC_ITEM.item} for you"`, (await panelLog()).includes(found)
            && statsD?.itemsFound >= 1, found);

        // ── Phase E — out, by the game's own door ───────────────────────────────
        const exitBefore = (await readGameState()).pendingExit;
        const fired = async () => ((await readGameState()).pendingExit !== exitBefore);
        const doorE = { tx: DOOR.exit_tiles[0][0], ty: DOOR.exit_tiles[0][1] };
        const walkE = await walkTo('Phase E', doorE, fired);
        const pE = parsePending((await readGameState()).pendingExit);
        check(`Phase E: real keys walked onto ${DOOR.exit_id} and the game fired it`, !!walkE?.walked.ok && !!pE,
            JSON.stringify((await readGameState()).pendingExit));
        check(`Phase E: the door report's id arm IS the payload's exit_id (out_${pE?.type}_${pE?.x}_${pE?.y}); @to = the PARKING level`,
            !!pE && `out_${pE.type}_${pE.x}_${pE.y}` === DOOR.exit_id && pE.fromLevel === ROOM.level
            && pE.to === ASSEMBLED.report.parkingLevel, JSON.stringify(pE));
        const movesE = await waitFor('ONE regionMove to the parent', async () => {
            const m = await glueMoves();
            return m.length >= 1 ? m : null;
        }, 15000);
        check(`Phase E: ONE user:regionMove ${LEAF} -> ${PARENT} through ${DOOR.exitName}`,
            movesE.length === 1 && movesE[0].sourceRegion === LEAF && movesE[0].targetRegion === PARENT
            && movesE[0].exitName === DOOR.exitName, JSON.stringify(movesE));
        const parked = await waitFor('the game swaps into the PARKING room', async () => {
            const s = await readGameState();
            return s.level === ASSEMBLED.report.parkingLevel ? s : null;
        }, 10000).catch(() => null);
        const back = await waitFor(`gameState back in ${PARENT}`, async () =>
            ((await currentRegion()) === PARENT ? PARENT : null), 15000).catch(() => null);
        await page.waitForTimeout(2500);
        const statsE = await glueStats();
        check(`Phase E: the swap into the PARKING room (level ${ASSEMBLED.report.parkingLevel}) was swallowed — no second move; `
            + 'the flash panel PARKED and the maze owns the region',
            !!parked && back === PARENT && (await glueMoves()).length === 1 && statsE.parks === boot.parks + 1
            && (await activeSubstrates()).at(-1) === 'maze',
            `level ${parked?.level}, ${JSON.stringify(statsE)}, active ${JSON.stringify(await activeSubstrates())}`);
        const landed = await waitFor(`the maze panel holds ${PARENT}`, async () => {
            const m = await mazePlayer();
            return m?.region === PARENT ? m : null;
        }, 15000);
        const arm = await mazeArm();
        console.log(`  (Phase E) the maze's arrival: ${JSON.stringify(arm)}`);
        check(`Phase E: the maze put the player ON ${FORWARD.exit_id} (${FORWARD.x},${FORWARD.y}), the exit PAIRED with the door, `
            + `by the maze's arm "${arm?.arm?.by}"`,
            landed.pos.x === FORWARD.x && landed.pos.y === FORWARD.y && arm?.region === PARENT
            && arm?.arrivedFrom?.exit_id === DOOR.targetExitId,
            `player ${JSON.stringify(landed.pos)}; ${JSON.stringify(arm)}`);
        const mazeKeys = await waitFor('the maze panel has the keyboard after the door', mazeHasKeys, 5000)
            .catch(async () => page.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`));
        check('Phase E: the MAZE panel has the page\'s keyboard after the door (no click)',
            typeof mazeKeys === 'string' && mazeKeys.startsWith('maze-room-panel'), JSON.stringify(mazeKeys));

        // ── Phase F — in again: NO load, NO reset — the binding's arrival alone ──
        const loadsBeforeF = (await glueStats()).loads;
        const landingsBeforeF = logs.filter((l) => l.includes(invoked(ROOM.level, want))).length;
        const pendingF = (await readGameState()).pendingExit;
        const again = await mazeKeyPlan({ exitTo: LEAF });
        await pressKeys(again.keys ?? []);
        const inAgain = await waitFor(`gameState back in ${LEAF}`, async () =>
            ((await currentRegion()) === LEAF ? LEAF : null), 15000).catch(async () => currentRegion());
        check(`Phase F: off ${FORWARD.exit_id} and back on (${again.keys?.join(' ') ?? again.error}) re-enters ${LEAF}`,
            inAgain === LEAF, String(inAgain));
        await waitFor(`the arrival new Game(${ROOM.level},${want.x},${want.y}) again`, () =>
            logs.filter((l) => l.includes(invoked(ROOM.level, want))).length > landingsBeforeF || null, 20000).catch(() => null);
        await page.waitForTimeout(2500);
        const liveF = await liveCell();
        const statsF = await glueStats();
        check(`Phase F: the glue RESUMED (no second delivery, no reset) and its OWN arrival landed the player on ${DOOR.exit_id}'s `
            + `APPROACH ${JSON.stringify(cellOfPx(want))}; no door fired`,
            statsF.loads === loadsBeforeF + 1 && statsF.resumes === 2 && onApproach(liveF, want)
            && (await readGameState()).pendingExit === pendingF && (await glueMoves()).length === 1,
            `live ${JSON.stringify(liveF)}, ${JSON.stringify(statsF)}, pendingExit ${JSON.stringify((await readGameState()).pendingExit)}`);
        const chainF = await focusChain();
        check('Phase F: the game\'s CANVAS has the keyboard again (no click)', gameHasKeys(chainF), JSON.stringify(chainF));

        const statsEnd = await glueStats();
        check('the glue agrees with the independent watcher', statsEnd.regionMoves === (await glueMoves()).length
            && statsEnd.regionMoves === 1 && statsEnd.warnings === 0, `${JSON.stringify(statsEnd)} (boot ${JSON.stringify(boot)})`);
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
        ? '\nOK: the generated leaf plays — the maze gates opened key by key, in through them, the set delivered, the item checked, out by the game\'s own door and in again'
        : `\nFAILED: ${failed} check(s)`);
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
