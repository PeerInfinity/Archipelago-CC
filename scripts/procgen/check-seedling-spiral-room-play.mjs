#!/usr/bin/env node
/**
 * Seedling in the pipeline, T2: the ONE real Seedling room that the shuffled
 * spiral placed among three maze rooms PLAYS in the Seedling wasm. The game's
 * own doors take the player out into the maze, and the maze's own walking
 * brings them back in.
 *
 * The world is the committed `seedling_spiral_room` preset
 * (`make-seedling-spiral-room-preset.mjs`, from `SEEDLING_SPIRAL_ROOM_STATE`):
 * the room is the START region and binds two real doors, both `external` to the
 * maze. The expectations are read from that preset, the starter atlas and its
 * map extract, never re-typed here.
 *
 *   Phase A — boot the DEFAULT mode on `?game=<preset>&seed=1`. The flash panel
 *     engages from the rules' own `flash_panel` block, and the wasm reaches
 *     'ready'.
 *   Phase B — ARRIVAL. The start region is the Seedling room, and the initial
 *     load teleports the player to its first bound door as a
 *     `new Game(level, x, y)`: to the game's OWN return spawn for that door (the
 *     reverse link's playerx/playery, one tile off it; T2b U2b), the door tile
 *     only when the map has none. The arrival publishes no crossing, and the
 *     player is where the game draws it.
 *   Phase C — DEPARTURE, fired BY THE GAME. Real keys on the focused canvas step
 *     onto the door (off it first when standing on it), so the game's own Teleporter writes
 *     `pendingExit`. That report reaches the binding's door-TILE arm (the door
 *     has a hand name, so the `out_<type>_<x>_<y>` id arm cannot match it), and
 *     ONE `user:regionMove` goes to the maze neighbour on the real channel.
 *     gameState follows; the game still swaps into the door's real destination,
 *     and that level report is swallowed. The flash panel parks, and the maze
 *     is the active substrate.
 *   Phase D — RETURN. The maze panel's own playback controller walks to the
 *     exit back, and a keypress takes it. procgenPlayer hands over
 *     `arrivedFrom.source_region`, the binding's THIRD arrival arm (the maze's
 *     own `exit_id` names no door), and the arrival teleport lands on that
 *     door's return spawn. No crossing is published.
 *   Phase C2/D2 — the same out and back through the SECOND bound door. This is
 *     the discriminator: the first door is also `exits[0]`, the no-match
 *     fallback, so only a return that lands on the second door's spawn proves
 *     the third arm chose it.
 *   Phase D3 — the user's own path (T2b): the Maze Room tab, its inactive
 *     overlay's "Open the … panel" button, then NO click: the Flash Game tab is
 *     in front and a key moves the player.
 *
 *   ⛓ SEEDLING T2b rows (each one does NOT do the person's work for them):
 *     U1 a return brings the Flash Game tab forward by itself; U2a the game's
 *     canvas holds the page's keyboard after ▶ Start, after the automatic
 *     activation and after the overlay's button (and a key moves the player);
 *     U2b the arrival is the game's own return spawn, off the door; F3 a key
 *     held ACROSS the house door leaves the player still after the return; F1
 *     the maze lands the player ON its exit back; F4 the maze has the keyboard
 *     after the door; F2 two maze crossings by real keypresses do not throw.
 *   Phase E — an UNDECLARED door of the same level. ⚠ It is a JUMP, not a
 *     door fire: the first one the atlas lists (hut_door) sits behind a
 *     breakablerock that needs a sword. So the game is sent straight to that
 *     door's own destination (`new Game(to, playerx, playery)`, the
 *     Teleporter's own construction), and the binding's level arm must WARN and
 *     move nothing.
 *
 * ⛓ THE KEY RECIPE (measured at T2 W0-3). `botMobiles` gives the player's LIVE
 * position; readState's `playerPositionX/Y` are `Main.*`, the respawn
 * CHECKPOINT, and do not move while the player walks. The canvas must hold
 * focus. A door fires when the player walks ONTO it, and an arrival lands ON
 * the door, so the gate first steps off (one key held, and the live position
 * must move) and then steps back on (the opposite key).
 *
 * ⛔ PAGE ERRORS ARE A DIAGNOSTIC LINE, NOT A check(). The logic-only channel
 * (`HEADLESS_LOGIC_ONLY_ARGS`, which real-time key holds need at full tick
 * rate) loses the WebGPU device BY DESIGN, and that loss arrives as page errors
 * (two, measured). `headlessChromium.test.js`'s H2 row puts any gate whose
 * check() reads a pageerror collector on the pixel set, and this gate's
 * claims are about logic. So every page error is PRINTED VERBATIM at the end,
 * where a third one, the kind a thrown handler would make, is visible to a
 * reader. A thrown glue handler would also leave the stats checks below short.
 *
 * The regionMove watcher wraps the flashPanel dispatcher's publish and THROWS
 * if it cannot. Every negative phase follows a positive count on the same
 * watcher, so none of them can pass on a silent one.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default
 * http://localhost:8000); the wasm build (the `flashPanel/wasm` submodule),
 * or this SKIPs (exit 0).
 *
 * Run: node scripts/procgen/check-seedling-spiral-room-play.mjs [--host=http://localhost:8000] [--game=seedling_spiral_room]
 * @ci-box enrolled beside check-seedling-atlas-play as a box row (seedling-pipeline T2): its phases hold real keys for wall-clock durations against the Seedling wasm, measured only on this box's logic-only channel.
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
import { createRoomPlay, STEP_OFF_PX, HOLD_CEILING_MS } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/**
 * ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door): the box
 * lock, the preset read and the browser all live in `main()`.
 */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'check-seedling-spiral-room-play.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const GAME = arg('game', 'seedling_spiral_room');

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
    const START = PRESET.regions['1'].Menu.exits[0].connected_region;
    const ROOM = SIDECARS[START]?.playable_payload ?? null;
    const DOORS = ROOM?.exits ?? [];
    const TILE = ROOM?.tile_size;
    /**
     * Which key steps OFF each bound door and which steps back ON, measured at W0-3
     * on the box: the house door is entered upward, the owl's-nest stairs
     * rightward. Keyed by the ATLAS door id, so a regenerated preset that binds a
     * different door fails here by name instead of walking into a wall.
     */
    const STEP_KEYS = Object.freeze({
        house_door: { off: 'ArrowDown', on: 'ArrowUp' },
        owls_nest_stairs: { off: 'ArrowLeft', on: 'ArrowRight' },
    });
    /**
     * ⛔ HELD UNTIL, NOT HELD FOR (`STEP_OFF_PX` / `HOLD_CEILING_MS`, now in
     * `seedlingRoomPlay.js`). A fixed hold covers a different number of game
     * ticks at a different load: run 1 of this gate held the step-off for 400 ms,
     * the player stopped at y 286.7 (W0 had reached 290.5), still inside the door,
     * so the latch never cleared and the step back on fired nothing. The step-off
     * now holds until the LIVE player is a whole tile from the door's spawn, and
     * the step-on until the game writes a new `pendingExit`; each has a ceiling.
     */

    // The undeclared door for Phase E: the first atlas DOOR (not a screen edge) of
    // the room's own sub-region that the preset did NOT bind, and the map entity on
    // its tile.
    const ATLAS = JSON.parse(readFileSync(join(FLASH_DIR, 'atlases/seedling.json'), 'utf8'));
    const MAP = JSON.parse(readFileSync(join(FLASH_DIR, 'atlases',
        PRESET.region_atlas?.map_document ?? 'seedling-map.json'), 'utf8'));
    const bound = new Set(DOORS.map((d) => d.exit_id));
    const atlasRegion = ATLAS.regions.find((r) => r.region_id === ROOM?.atlas_region);
    const LEVEL = MAP.levels.find((l) => l.level === ROOM?.level);
    const LINK_TYPES = ['teleporter', 'stairsdown', 'stairsup'];
    const entityOn = ([tx, ty]) => LEVEL?.entities.find((e) => LINK_TYPES.includes(e.type)
        && Math.floor(e.x / MAP.tile_size) === tx && Math.floor(e.y / MAP.tile_size) === ty);
    /**
     * ⛓ T2b U2b — WHERE AN ARRIVAL THROUGH `door` LANDS: the game's own return
     * spawn off the SAME table the panel builds from the same map document, the
     * door tile only when the map has none. Read, never re-typed.
     */
    const RETURNS = returnSpawnTable(MAP);
    const arrivalOf = (door) => {
        const [tx, ty] = door.entrance_tile ?? door.exit_tiles[0];
        const back = RETURNS.get(returnKey(ROOM.level, tx, ty));
        return back ? { x: back.x, y: back.y, landing: 'return-spawn' }
            : { ...door.entrance_spawn, landing: 'entrance-spawn' };
    };
    const UNDECLARED = (atlasRegion?.exits ?? [])
        .filter((e) => e.kind !== 'edge' && (e.sub_region ?? null) === (ROOM?.atlas_sub_region ?? null)
            && !bound.has(e.exit_id))
        .map((e) => ({ exit: e, entity: entityOn(e.exit_tiles[0]) }))
        .find((u) => u.entity && Number(u.entity.attrs.to) !== ROOM.level) ?? null;

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

    /** ⛓ T3: the shared hands (`seedlingRoomPlay.js`); this gate keeps only its own phases. */
    const {
        check, failures, waitFor, gameFrame, readGameState, livePlayer, activeTabTitles, currentRegion,
        glueStats, glueMoves, activeSubstrates, arrival, installWatchers, jump, focusGame, focusChain,
        gameHasKeys, keyMovesPlayer, holdUntil, invoked, parsePending, mazeKeyPlan, pressKeys,
        mazeHasKeys,
    } = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: 'check-seedling-spiral-room-play' });

    /**
     * Out through `door`, fired by the game. Returns the parsed pendingExit.
     * `expectMoves` is the glue-move count the departure must leave behind.
     */
    async function departThrough(label, door, expectMoves, expectParks, { holdAcross = false } = {}) {
        const keys = STEP_KEYS[door.exit_id];
        await focusGame();
        const centre = { x: door.entrance_spawn.x + TILE / 2, y: door.entrance_spawn.y + TILE / 2 };
        const before = await livePlayer();
        /**
         * ⛓ ON the door (a jump put it there) → step off first: the game's
         * check() latch fires a door only when the player walks ONTO it. At the
         * door's return spawn (an arrival, T2b U2b) the player is already off it.
         */
        const onDoor = !!before && Math.hypot(before.x - centre.x, before.y - centre.y) <= TILE / 2;
        check(`${label}: the LIVE player stands ${onDoor ? 'ON' : 'within a tile or two of'} ${door.exit_id} before stepping on`,
            !!before && Math.hypot(before.x - centre.x, before.y - centre.y) <= 2 * TILE,
            `live ${JSON.stringify(before)}, door centre ${JSON.stringify(centre)}`);
        if (onDoor) {
            const off = await holdUntil(keys.off, async () => {
                const p = await livePlayer();
                return p && Math.hypot(p.x - centre.x, p.y - centre.y) >= STEP_OFF_PX ? p : null;
            });
            check(`${label}: ${keys.off} held until the LIVE player stood a tile off ${door.exit_id}`,
                !!off.value, `${JSON.stringify(before)} -> ${JSON.stringify(off.value ?? await livePlayer())} in ${off.ms} ms`);
        }
        const pendingBefore = (await readGameState()).pendingExit;
        const firedYet = async () => {
            const s = await readGameState();
            return s.pendingExit !== pendingBefore ? s.pendingExit : null;
        };
        /**
         * ⛓ T2b F3 — `holdAcross`: the key stays DOWN through the door, the
         * park and the maze tab coming forward, and comes up only then, landing
         * wherever the page's focus now is. That is a person holding the key
         * into the door; the game must still end up with the key released.
         */
        const on = holdAcross
            ? await (async () => {
                const start = Date.now();
                await page.keyboard.down(keys.on);
                let value = null;
                try {
                    while (!value && Date.now() - start < HOLD_CEILING_MS) {
                        // eslint-disable-next-line no-await-in-loop
                        await page.waitForTimeout(50);
                        // eslint-disable-next-line no-await-in-loop
                        value = await firedYet();
                    }
                    if (value) {
                        await waitFor('the park, with the key still held', async () =>
                            ((await glueStats())?.parks === expectParks) || null, 15000);
                        await page.waitForTimeout(300);
                    }
                } finally {
                    await page.keyboard.up(keys.on);
                }
                return { value, ms: Date.now() - start };
            })()
            : await holdUntil(keys.on, firedYet);
        check(`${label}: ${keys.on} held until the game fired a door`, !!on.value,
            `pendingExit ${JSON.stringify(on.value)} in ${on.ms} ms`);
        const moves = await waitFor(`the game fires ${door.exit_id} and the glue publishes the move`, async () => {
            const m = await glueMoves();
            return m.length >= expectMoves ? m : null;
        }, 15000);
        const st = await readGameState();
        const fired = parsePending(st.pendingExit);
        const tile = fired ? [Math.floor(fired.x / TILE), Math.floor(fired.y / TILE)] : null;
        const onDoorTile = !!tile && (door.exit_tiles ?? []).some(([x, y]) => x === tile[0] && y === tile[1]);
        check(`${label}: the game's OWN door report names ${door.exit_id}'s tile (pixel / tile_size ∈ exit_tiles)`,
            onDoorTile && fired.fromLevel === ROOM.level,
            `pendingExit ${JSON.stringify(st.pendingExit)} -> tile ${JSON.stringify(tile)}, exit_tiles `
            + JSON.stringify(door.exit_tiles));
        check(`${label}: …and it can ONLY be the tile arm — the id arm's out_<type>_<x>_<y> is not ${door.exit_id}`,
            !!fired && `out_${fired.type}_${fired.x}_${fired.y}` !== door.exit_id);
        const last = moves[moves.length - 1];
        check(`${label}: ONE user:regionMove on the real channel, to the maze neighbour through ${door.exitName}`,
            moves.length === expectMoves && last.sourceRegion === START
            && last.targetRegion === door.targetRegion && last.exitName === door.exitName, JSON.stringify(last));
        const region = await waitFor('gameState follows the departure', async () =>
            ((await currentRegion()) === door.targetRegion ? door.targetRegion : null), 15000);
        check(`${label}: gameState really moved to ${door.targetRegion} (the effect, not just the event)`,
            region === door.targetRegion, region);
        const activeTab = await page.evaluate(() => [...document.querySelectorAll('.lm_tab.lm_active')]
            .map((t) => t.title).join(', '));
        console.log(`  (diagnostic) active tabs right after the departure: ${activeTab}`);
        const swapped = await waitFor('the game swaps into the door\'s real destination', async () => {
            const s = await readGameState();
            return s.level === fired?.to ? s : null;
        }, 10000);
        // Give the glue every chance to (wrongly) read that swap as a second crossing.
        await page.waitForTimeout(2500);
        check(`${label}: the game's own swap into level ${fired?.to} was swallowed — no second move`,
            swapped.level === fired?.to && (await glueMoves()).length === expectMoves,
            `level ${swapped.level}, ${(await glueMoves()).length} glue moves`);
        const stats = await glueStats();
        const active = await activeSubstrates();
        check(`${label}: the flash panel PARKED and the maze owns the region (procgen:activeSubstrateChanged)`,
            stats.parks === expectParks && active[active.length - 1] === door.target_substrate,
            `parks ${stats.parks}, active-substrate events ${JSON.stringify(active)}`);
        /**
         * ⛓ T2b F1 — THE MAZE LANDS THE PLAYER ON ITS EXIT BACK, not on its
         * `entrance`. The spiral links no reverse exits, so `arrivedFrom.exit_id`
         * is the room's own `exitName`, which no maze exit has; the maze's
         * `source_region` arm picks the exit whose target is the room. Read off
         * the maze panel's live state and the live world, nothing typed here.
         */
        const landed = await waitFor(`the maze panel holds ${door.targetRegion}`, () => page.evaluate(async (want) => {
            const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
            if (!p?.world || p.currentRegionId !== want.region) return null;
            const back = [...p.world.exits.values()].filter((e) => e.targetRegion === want.start);
            return { pos: { ...p.state.player_pos }, entrance: p.world.entrance, back: back.map((e) => ({ id: e.exit_id, x: e.x, y: e.y })) };
        }, { region: door.targetRegion, start: START }), 15000);
        /**
         * ⛓ T2b F4 — …AND THE MAZE HAS THE KEYBOARD. The door moved the page's
         * focus nowhere useful before (BODY, measured): the maze's root was
         * focused while still hidden. Nothing here clicks it.
         */
        const mazeKeys = await waitFor('the maze panel has the keyboard after the door', mazeHasKeys, 5000).catch(async () => page.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`));
        check(`${label}: the MAZE panel has the page's keyboard after the door (no click)`,
            typeof mazeKeys === 'string' && mazeKeys.startsWith('maze-room-panel'), `activeElement ${JSON.stringify(mazeKeys)}`);
        check(`${label}: the maze put the player ON its exit back to ${START} (${landed.back.map((e) => e.id).join(', ')}), not on its entrance`,
            landed.back.some((e) => e.x === landed.pos.x && e.y === landed.pos.y),
            `player ${JSON.stringify(landed.pos)}, entrance ${JSON.stringify(landed.entrance)}, exits back ${JSON.stringify(landed.back)}`);
        return fired;
    }

    /**
     * ONE crossing by the maze panel's OWN walking, off the LIVE world: its
     * playback controller walks to a floor tile beside the exit that leads to
     * `target`, then onto the exit (`walkTo({kind: 'exit'})`, the playback bot's
     * crossing). Exit tiles are walls to the flood,
     * because stepping onto one IS the crossing. `{error, reachable}` when no such
     * exit is reachable from where the player stands; `reachable` lists the regions
     * the reachable exits lead to.
     */
    const mazeCross = (target) => page.evaluate(async (want) => {
        const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
        const world = p.world;
        const key = (x, y) => `${x},${y}`;
        const blocked = new Set([...world.obstacles.keys()]);
        for (const e of world.exits.values()) blocked.add(key(e.x, e.y));
        const from = { ...p.state.player_pos };
        const seen = new Set([key(from.x, from.y)]);
        const queue = [from];
        while (queue.length) {
            const { x, y } = queue.shift();
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const nx = x + dx; const ny = y + dy; const k = key(nx, ny);
                if (seen.has(k) || blocked.has(k) || nx < 0 || ny < 0 || nx >= world.width || ny >= world.height
                    || world.tiles[ny * world.width + nx] !== 0) continue;
                seen.add(k);
                queue.push({ x: nx, y: ny });
            }
        }
        // The key that walks FROM the staging tile ONTO the exit is the direction back.
        const dirs = [{ dx: 0, dy: -1, k: 'ArrowDown' }, { dx: 1, dy: 0, k: 'ArrowLeft' },
            { dx: 0, dy: 1, k: 'ArrowUp' }, { dx: -1, dy: 0, k: 'ArrowRight' }];
        const stagingOf = (e) => dirs.map((d) => ({ x: e.x + d.dx, y: e.y + d.dy, k: d.k }))
            .find((c) => seen.has(key(c.x, c.y))) ?? null;
        const exits = [...world.exits.values()].filter((e) => e.targetRegion);
        const back = exits.find((e) => e.targetRegion === want && stagingOf(e));
        if (!back) {
            return { error: `from ${JSON.stringify(from)} in ${p.currentRegionId} no reachable exit leads to ${want}`,
                reachable: exits.filter((e) => stagingOf(e)).map((e) => e.targetRegion), seen: seen.size };
        }
        const st = stagingOf(back);
        const c = p.getPlaybackController();
        c.walkTo({ kind: 'tile', x: st.x, y: st.y });
        c.instant?.();
        for (let i = 0; i < 100 && !(p.state.player_pos.x === st.x && p.state.player_pos.y === st.y); i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 200));
        }
        const at = { ...p.state.player_pos };
        if (at.x !== st.x || at.y !== st.y) return { error: `the walk stopped at ${JSON.stringify(at)}`, st };
        // ⛔ ONTO the exit by the controller too (the playback bot's `kind: 'exit'`),
        //   not by a synthetic keypress — see `returnFrom` for the queue it trips.
        const actionQueue = { cursor: p._mazeQueue?.cursor, length: p._mazeQueue?.length };
        c.walkTo({ kind: 'exit', name: back.exit_id });
        c.instant?.();
        return { region: p.currentRegionId, from, exit: back.exit_id, to: want, actionQueue };
    }, target);

    /**
     * ⛓ T2b F2 — ONE maze→maze crossing by REAL KEYPRESSES (the maze panel's
     * own `_handleKeydown`, which holds the page's keyboard after F4): the keys
     * of a shortest path from the player to the exit into `target`, pressed one
     * by one. Exits are walls to the flood except the goal. `{keys, region,
     * queue}` after the crossing, or `{error}`.
     */
    const mazeKeyCross = async (target) => {
        const plan = await mazeKeyPlan({ exitTo: target });
        if (plan.error) return plan;
        await pressKeys(plan.keys);
        const after = await waitFor(`the keypresses crossed into ${target}`, () => page.evaluate(async (want) => {
            const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
            return p?.currentRegionId === want
                ? { region: want, queue: { cursor: p._mazeQueue?.cursor, length: p._mazeQueue?.length } } : null;
        }, target), 8000).catch(() => null);
        return after ? { ...after, keys: plan.keys.length, from: plan.from } : { error: `the ${plan.keys.length} keys did not cross into ${target}` };
    };

    /**
     * Back into the room from `mazeRegion`, the region the departure left us in,
     * and ONLY from it: the arrival arm under test is the one that reads
     * `source_region`.
     *
     * ⛓ THE STRAIGHT WALK BACK (T2b F1). Before F1 the maze put an arrival from
     * the room on its `entrance`, because the spiral links no reverse exit and
     * the maze had no `source_region` arm; in `region_1_0` that cell is a
     * six-tile pocket whose only way out is `exit_0`, and this walk had to go out
     * to a neighbour and back in (3 hops, measured). The maze now lands the player
     * ON its exit back (the departure asserts it), so the walk is one hop. The
     * out-and-back fallback stays for a world where the exit back is out of reach;
     * the hop list printed below says which path ran.
     *
     * ⚠ THE PLACED-REGION LEG'S KEYPRESS (`_handleKeydown`) IS NOT USED HERE. Run 7
     * took the second hop by keypress, and the maze panel's own `ActionQueue.add`
     * threw "atIndex 0 is inside the done region (cursor 1)": the first hop's
     * keypress crossed into another MAZE region inside its own `stepOne`, the new
     * region's `clear()` emptied the queue, and the cursor then advanced past it.
     * Each hop prints the queue's `{cursor, length}` before it moves.
     */
    async function returnFrom(label, mazeRegion, door, expectLoads,
        { stillAfterReturn = false, keyAfterReturn = null, keyCrossVia = null } = {}) {
        await page.evaluate(async () => {
            const bus = (await import('./app/core/eventBus.js')).default;
            bus.publish('ui:activatePanel', { panelId: 'mazeRoomPanel' }, 'check-seedling-spiral-room-play');
        });
        const mazeRegionNow = () => page.evaluate(async () => {
            const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
            return p?.world && p.state ? p.currentRegionId : null;
        });
        const panelRegion = await waitFor(`the maze panel holds ${mazeRegion}`, mazeRegionNow, 20000);
        check(`${label}: the maze panel is playing ${mazeRegion}`, panelRegion === mazeRegion, panelRegion);
        if (keyCrossVia) {
            /**
             * ⛓ T2b F2 — out to `keyCrossVia` and back BY KEYPRESSES. Before the
             * fix, the first crossing left the queue at {cursor 1, length 0} and
             * the FIRST key of the second threw "ActionQueue.add: atIndex 0 is
             * inside the done region" (reproduced at W0 on try 1).
             */
            const errorsBefore = pageErrors.length;
            const out = await mazeKeyCross(keyCrossVia);
            const back = out.error ? out : await mazeKeyCross(mazeRegion);
            const thrown = pageErrors.slice(errorsBefore).filter((e) => /ActionQueue|done region/.test(e));
            check(`${label}: two maze crossings by REAL KEYPRESSES (${mazeRegion} -> ${keyCrossVia} -> ${mazeRegion}), `
                + 'no ActionQueue throw, the queue empty after each',
            !out.error && !back.error && thrown.length === 0
                && out.queue.cursor === 0 && out.queue.length === 0 && back.queue.cursor === 0 && back.queue.length === 0,
            `${JSON.stringify(out)} ; ${JSON.stringify(back)} ; thrown ${JSON.stringify(thrown)}`);
        }
        const hops = [];
        let walk = null;
        for (let hop = 0; hop < 4; hop += 1) {
            const here = await mazeRegionNow();
            if (here === mazeRegion) {
                logs.length = 0;
                walk = await mazeCross(START);
                if (!walk.error) { hops.push(`${here} -> ${START} queue ${JSON.stringify(walk.actionQueue)}`); break; }
                const out = walk.reachable?.find((r) => r !== START);
                if (!out) break;
                const step = await mazeCross(out);
                if (step.error) { walk = step; break; }
                hops.push(`${here} -> ${out} queue ${JSON.stringify(step.actionQueue)} (the exit back is out of reach: ${walk.error})`);
            } else {
                const step = await mazeCross(mazeRegion);
                if (step.error) { walk = step; break; }
                hops.push(`${here} -> ${mazeRegion} queue ${JSON.stringify(step.actionQueue)}`);
            }
            const left = here;
            await waitFor(`the maze left ${left}`, async () => ((await mazeRegionNow()) !== left) || null, 15000);
        }
        check(`${label}: the maze walked back into ${START} from ${mazeRegion}, by its own walking`,
            !!walk && !walk.error && hops.at(-1)?.startsWith(`${mazeRegion} -> ${START} `),
            `${hops.join(' ; ')}${walk?.error ? ` ; ${JSON.stringify(walk)}` : ''}`);
        const region = await waitFor(`gameState back in ${START}`, async () =>
            ((await currentRegion()) === START ? START : null), 15000);
        const want = arrivalOf(door);
        const call = invoked(ROOM.level, want);
        await waitFor(`arrival invocation ${call}`, () => logs.some((l) => l.includes(call)) || null, 20000);
        const st = await waitFor('the game reports the arrival spawn', async () => {
            const s = await readGameState();
            return s.level === ROOM.level && s.playerPositionX === want.x
                && s.playerPositionY === want.y ? s : null;
        }, 15000);
        if (stillAfterReturn) {
            /**
             * ⛓ T2b F3 — NO WALKING WITHOUT A KEY. Phase C held its key across
             * the door and released it after the park, where the game could not
             * hear it. Nothing presses a key here, and nothing released one into
             * the game for it.
             */
            const samples = [];
            for (let i = 0; i < 12; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                samples.push(await livePlayer());
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(200);
            }
            const ok = samples.every((p) => p && Math.hypot(p.x - samples[0].x, p.y - samples[0].y) <= 1);
            check(`${label}: the player stands STILL after the return — the key held across the door was released into the game`,
                ok, samples.map((p) => (p ? `(${p.x.toFixed(1)},${p.y.toFixed(1)})` : 'null')).join(' '));
        }
        const a = await arrival();
        const armsOneTwo = DOORS.some((d) => d.exit_id === a.arrivedFrom?.exit_id || d.exitName === a.arrivedFrom?.exit_id);
        check(`${label}: back in ${START}, and the arrival teleport landed on ${door.exit_id}'s ${want.landing}`,
            region === START && st.level === ROOM.level, `${call}; checkpoint (${st.playerPositionX},${st.playerPositionY})`);
        check(`${label}: the binding chose ${door.exit_id} by the THIRD arm — source_region ${mazeRegion}, `
            + 'and an exit_id that names no door',
            a.arrivedFrom?.source_region === mazeRegion && !armsOneTwo
            && a.spawn?.exitId === door.exit_id && a.spawn?.matchedArrivedFrom === true, JSON.stringify(a));
        const stats = await glueStats();
        check(`${label}: the glue resumed and loaded the room again`, stats.loads === expectLoads
            && (await activeSubstrates()).at(-1) === SIDECARS[START].substrate, JSON.stringify(stats));
        /**
         * ⛓ T2b U1 — THE RETURN BRINGS THE FLASH GAME TAB FORWARD BY ITSELF.
         * Nothing in this gate has clicked a tab since the departure (the maze
         * tab came forward then), so the only writer of this state is the
         * panel's own activation on `flashSeedling:loadRegion`.
         */
        const tabs = await waitFor('the Flash Game tab comes forward on the return', async () => {
            const t = await activeTabTitles();
            return t.includes('Flash Game') ? t : null;
        }, 5000).catch(async () => activeTabTitles());
        check(`${label}: the return ACTIVATED the Flash Game tab by itself (no tab click)`,
            tabs.includes('Flash Game'), `active tabs: ${tabs.join(', ')}`);
        /**
         * ⛓ T2b U2a — …AND THE GAME HAS THE KEYBOARD. No canvas click and no
         * focus() from here: the page's focus is inside the frame, on the
         * canvas, and a key moves the player.
         */
        const chain = await waitFor('the game canvas has the keyboard after the return', async () => {
            const c = await focusChain();
            return gameHasKeys(c) ? c : null;
        }, 5000).catch(async () => focusChain());
        check(`${label}: the game's CANVAS has the page's keyboard after the automatic activation (no click)`,
            gameHasKeys(chain), JSON.stringify(chain));
        if (keyAfterReturn) {
            const k = await keyMovesPlayer(keyAfterReturn);
            check(`${label}: ${keyAfterReturn} pressed with no click moves the player`, k.moved,
                `${JSON.stringify(k.before)} -> ${JSON.stringify(k.after)}`);
        }
    }

    try {
        check('the preset\'s start region is a placed Seedling room with bound doors',
            !!ROOM && DOORS.length >= 2
            && DOORS.every((d) => d.external === true), `${START}: ${DOORS.map((d) => d.exit_id).join(', ')}`);
        check('every bound door has a measured step recipe', DOORS.every((d) => STEP_KEYS[d.exit_id]),
            DOORS.map((d) => d.exit_id).join(', '));
        check(`Phase E has an undeclared door of level ${ROOM?.level} to jump through`, !!UNDECLARED,
            UNDECLARED ? `${UNDECLARED.exit.exit_id} -> level ${UNDECLARED.entity.attrs.to}` : 'none');

        // ── Phase A — boot ──────────────────────────────────────────────────────
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        await waitFor('rules loaded', () => page.evaluate(
            () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
        await installWatchers();
        check('Phase A: the regionMove watcher is installed on the real publish channel', true);
        check(`Phase A: the preset loaded and the player starts in ${START}`,
            (await currentRegion()) === START, await currentRegion());
        const statsA = await glueStats();
        check('Phase A: procgen routed the start region to the flash_seedling glue',
            !!statsA && statsA.loads === 1, JSON.stringify(statsA));
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
        const status = await waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
            document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);
        check('Phase A: the flash panel engaged from the rules\' own flash_panel block and reached ready',
            status === 'ready', WASM_PAGE);

        // ── Phase B — arrival ───────────────────────────────────────────────────
        const first = DOORS[0];
        const arriveB = arrivalOf(first);
        check(`Phase B: the map gives ${first.exit_id} a return spawn of the game's own, OFF the door tile`,
            arriveB.landing === 'return-spawn'
            && (arriveB.x !== first.entrance_spawn.x || arriveB.y !== first.entrance_spawn.y),
            `${JSON.stringify(arriveB)} vs the door tile ${JSON.stringify(first.entrance_spawn)}`);
        const arrivalCall = invoked(ROOM.level, arriveB);
        await waitFor(`arrival invocation ${arrivalCall}`, () => logs.some((l) => l.includes(arrivalCall)) || null, 120000);
        const stB = await waitFor('the game reports the arrival spawn', async () => {
            const st = await readGameState();
            return st.level === ROOM.level && st.playerPositionX === arriveB.x ? st : null;
        });
        check(`Phase B: the arrival is a new Game at ${first.exit_id}'s return spawn, level ${ROOM.level}`,
            stB.playerPositionY === arriveB.y, arrivalCall);
        check('Phase B: the arrival published no crossing', (await glueMoves()).length === 0);
        /**
         * ⛓ T2b U2a — ▶ Start. The page's own click listener focuses the canvas
         * (game.html), and then ~1.75 s later the AP loading overlay let go by
         * focusing the IFRAME ELEMENT, which parks the frame's focus on its BODY
         * (measured at 0f2e7a2a9f: canvas at 0.25 s, BODY from 1.75 s, three
         * runs). So this reads ONCE, after the arrival has settled, the state a
         * person is left in; a waitFor would pass on the transient canvas.
         */
        await page.waitForTimeout(2500);
        const chainB = await focusChain();
        check('Phase B: after ▶ Start, and after the arrival settled, the game\'s CANVAS has the page\'s keyboard (no canvas click)',
            gameHasKeys(chainB), JSON.stringify(chainB));
        /**
         * ⛓ T2b U2b — THE PLAYER IS WHERE THE GAME DRAWS IT. On the house
         * door's own tile the game does not draw the player (measured, plan
         * §15.0); the live entity stands at the return spawn's centre, and no
         * door has fired.
         */
        const liveB = await livePlayer();
        const stIdle = await readGameState();
        check(`Phase B: the LIVE player stands at the return spawn, off ${first.exit_id}, and no door fired`,
            !!liveB && Math.hypot(liveB.x - (arriveB.x + TILE / 2), liveB.y - (arriveB.y + TILE / 2)) <= 2
            && stIdle.pendingExit === '' && (await glueMoves()).length === 0,
            `live ${JSON.stringify(liveB)}, pendingExit ${JSON.stringify(stIdle.pendingExit)}`);

        // ── Phase C / D — out and back through the first door ───────────────────
        await departThrough('Phase C', first, 1, 1, { holdAcross: true });
        await returnFrom('Phase D', first.targetRegion, first, 2,
            { stillAfterReturn: true, keyAfterReturn: STEP_KEYS[first.exit_id].off });
        check('Phase D: the return published no crossing', (await glueMoves()).length === 1,
            `${(await glueMoves()).length} glue moves`);

        // ── Phase C2 / D2 — the second door: the third arm's discriminator ──────
        const second = DOORS[1];
        await page.waitForTimeout(1500);
        // Focus (and the key release in it) BEFORE the jump: a key the game still
        // thinks is held would walk the player off the stairs as soon as it lands.
        await focusGame();
        await jump(ROOM.level, second.entrance_spawn.x, second.entrance_spawn.y);
        await waitFor(`the player stands on ${second.exit_id}`, async () => {
            const p = await livePlayer();
            return p && Math.abs(p.x - second.entrance_spawn.x - 8) <= 8 && Math.abs(p.y - second.entrance_spawn.y - 8) <= 8;
        }, 10000);
        await page.waitForTimeout(500);
        await departThrough('Phase C2', second, 2, 2);
        check(`Phase C2: the second door is NOT exits[0] (${first.exit_id}), so D2 can tell the arms apart`,
            second.exit_id !== first.exit_id
            && (second.entrance_spawn.x !== first.entrance_spawn.x || second.entrance_spawn.y !== first.entrance_spawn.y));
        // F2's detour: the maze neighbour of the stairs' region that is not the
        // room, read off the preset (region_1_1 in the committed one).
        const detour = (SIDECARS[second.targetRegion]?.playable_payload?.exits ?? [])
            .map((e) => e.targetRegion).find((r) => r && r !== START && SIDECARS[r]?.substrate === 'maze') ?? null;
        check('Phase D2: the stairs\' maze region has a maze neighbour for the F2 keypress detour', !!detour, String(detour));
        await returnFrom('Phase D2', second.targetRegion, second, 3, { keyCrossVia: detour });
        check('Phase D2: the return published no crossing', (await glueMoves()).length === 2,
            `${(await glueMoves()).length} glue moves`);

        // ── Phase D3 — the OVERLAY'S BUTTON (the user's own path, T2b U2a) ──────
        // A person looks at the Maze Room tab (the gate's one tab click, standing
        // in for theirs), sees "Currently playing Seedling (region atlas)" and
        // presses the overlay's button. From there on nothing is clicked.
        await page.evaluate(() => {
            [...document.querySelectorAll('.lm_tab')].find((t) => t.title === 'Maze Room')?.click();
        });
        const button = page.locator('.substrate-inactive-overlay button').filter({ visible: true }).first();
        await button.waitFor({ state: 'visible', timeout: 10000 });
        const buttonText = await button.textContent();
        await button.click();
        const chainD3 = await waitFor('the game canvas has the keyboard after the button', async () => {
            const c = await focusChain();
            return gameHasKeys(c) ? c : null;
        }, 5000).catch(async () => focusChain());
        check(`Phase D3: "${buttonText}" — the Flash Game tab is in front and its CANVAS has the keyboard (no click)`,
            (await activeTabTitles()).includes('Flash Game') && gameHasKeys(chainD3), JSON.stringify(chainD3));
        const kD3 = await keyMovesPlayer(STEP_KEYS[second.exit_id].off);
        check(`Phase D3: ${STEP_KEYS[second.exit_id].off} pressed with no click moves the player`, kD3.moved,
            `${JSON.stringify(kD3.before)} -> ${JSON.stringify(kD3.after)}`);

        // ── Phase E — the undeclared door's level (a JUMP; see the header) ──────
        await page.waitForTimeout(1500);
        const warnsBefore = (await glueStats()).warnings;
        const to = Number(UNDECLARED.entity.attrs.to);
        logs.length = 0;
        await jump(to, Number(UNDECLARED.entity.attrs.playerx), Number(UNDECLARED.entity.attrs.playery));
        await waitFor(`the game moved to level ${to}`, async () => ((await readGameState()).level === to) || null, 10000);
        const warned = await waitFor('the level arm warns', async () => {
            const s = await glueStats();
            return s.warnings > warnsBefore ? s : null;
        }, 10000);
        const warnLine = logs.find((l) => l.startsWith('[warning]') && l.includes(`to level ${to}`)) ?? '';
        check(`Phase E: level ${ROOM.level} -> ${to} (${UNDECLARED.exit.exit_id}'s destination) WARNS, naming the level `
            + 'and the region', warned.warnings === warnsBefore + 1 && warnLine.includes(`region "${START}"`), warnLine);
        await page.waitForTimeout(2000);
        check('Phase E: …and moved nothing', (await glueMoves()).length === 2 && (await currentRegion()) === START,
            `${(await glueMoves()).length} glue moves, region ${await currentRegion()}`);

        const statsEnd = await glueStats();
        check('the glue agrees with the independent watcher', statsEnd.regionMoves === (await glueMoves()).length
            && statsEnd.parks === 2 && statsEnd.resumes === 2, JSON.stringify(statsEnd));
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
        ? '\nOK: the placed Seedling room plays — its own doors out into the maze, the maze walked back in'
        : `\nFAILED: ${failed} check(s)`);
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
