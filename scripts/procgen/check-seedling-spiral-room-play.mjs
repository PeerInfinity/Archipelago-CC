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
 *     load teleports the player to its first bound door's `entrance_spawn` as a
 *     `new Game(level, x, y)`. The arrival publishes no crossing. Standing ON
 *     the door and pressing into it does NOT fire it (the game's check() latch).
 *   Phase C — DEPARTURE, fired BY THE GAME. Real keys on the focused canvas step
 *     off the door and back on, so the game's own Teleporter writes
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
 *     door's spawn. No crossing is published.
 *   Phase C2/D2 — the same out and back through the SECOND bound door. This is
 *     the discriminator: the first door is also `exits[0]`, the no-match
 *     fallback, so only a return that lands on the second door's spawn proves
 *     the third arm chose it.
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
     * ⛔ HELD UNTIL, NOT HELD FOR. A fixed hold covers a different number of game
     * ticks at a different load: run 1 of this gate held the step-off for 400 ms,
     * the player stopped at y 286.7 (W0 had reached 290.5), still inside the door,
     * so the latch never cleared and the step back on fired nothing. The step-off
     * now holds until the LIVE player is a whole tile from the door's spawn, and
     * the step-on until the game writes a new `pendingExit`; each has a ceiling.
     */
    const STEP_OFF_PX = 16;
    const HOLD_CEILING_MS = 4000;

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

    let failures = 0;
    /** `PASS: ` / `FAIL: ` rows and a last `ALL CHECKS PASSED` / `N CHECK(S) FAILED` (F1's vocabulary). */
    function check(name, ok, detail = '') {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failures += 1;
    }

    async function waitFor(desc, fn, timeoutMs = 60000) {
        const start = Date.now();
        for (;;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - start > timeoutMs) {
                console.log(`PAGE LOGS (last 40):\n${logs.slice(-40).join('\n')}`);
                throw new Error(`timeout waiting for: ${desc}`);
            }
            await page.waitForTimeout(250);
        }
    }

    function gameFrame() {
        const f = page.frames().find((fr) => fr.url().includes(WASM_PAGE));
        if (!f) throw new Error('seedling wasm iframe not found');
        return f;
    }

    /** readState: `level`, `pendingExit` and the `Main.*` CHECKPOINT (not the live position). */
    async function readGameState() {
        const raw = await gameFrame().evaluate(() => window.__swfBridge.game.readState());
        try { return JSON.parse(raw); } catch { return { __raw: raw }; }
    }

    /** The player's LIVE position (entity centre), off `botMobiles`. */
    async function livePlayer() {
        const raw = await gameFrame().evaluate(() => window.__swfBridge.game.botMobiles());
        let doc;
        try { doc = JSON.parse(raw); } catch { return null; }
        const p = (doc?.mobiles ?? []).find((m) => /player/i.test(m.cls ?? ''));
        return p ? { x: p.x, y: p.y } : null;
    }

    const activeTabTitles = () => page.evaluate(() => [...document.querySelectorAll('.lm_tab.lm_active')]
        .map((t) => t.title));
    const currentRegion = () => page.evaluate(() =>
        window.centralRegistry?.getPublicFunction('gameState', 'getCurrentRegion')?.() ?? null);
    const glueStats = () => page.evaluate(async () => {
        const mod = await import('./modules/flashPanel/index.js');
        return mod.getSeedlingRegionGlue()?.stats ?? null;
    });
    const glueMoves = async () => (await page.evaluate(() => window.__roomMoves ?? []))
        .filter((m) => m.source === 'seedlingRegionGlue');
    const activeSubstrates = () => page.evaluate(() => window.__roomActive ?? []);

    /** What the binding resolved for the region it holds: the arm's own answer, not a log line. */
    const arrival = () => page.evaluate(async () => {
        const glue = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
        const { resolveArrivalSpawn } = await import('./modules/flashPanel/seedlingRegionBinding.js');
        const b = glue.binding;
        return { region: b.region, arrivedFrom: b.arrivedFrom, spawn: resolveArrivalSpawn(b.world, b.arrivedFrom) };
    });

    /** A `new Game(level, x, y)` the glue did not ask for: the template's native jump. */
    async function jump(level, x, y) {
        await gameFrame().evaluate(({ l, px, py }) => {
            window.__swfBridge.queueItems({
                invocation: 'new_instance',
                className: 'Game',
                args: [l, px, py],
                assignTo: { class: 'net.flashpunk.FP', property: 'world' },
            });
        }, { l: level, px: x, py: y });
    }

    async function hold(key, ms) {
        await gameFrame().evaluate(() => document.getElementById('canvas')?.focus());
        await page.keyboard.down(key);
        await page.waitForTimeout(ms);
        await page.keyboard.up(key);
    }

    /**
     * ⛔ GIVE THE GAME REAL FOCUS, THE WAY A PLAYER DOES. The Flash Game and Maze
     * Room tabs share one stack, and walking the maze back (Phase D) brings the
     * maze tab forward; `canvas.focus()` inside the iframe then does NOT move the
     * page's own focus back into it, and held keys went to the maze panel (run 2:
     * the step-off "moved" the wrong way and the door never fired). So the tab is
     * selected again and the canvas CLICKED.
     */
    async function focusGame() {
        await page.evaluate(() => {
            [...document.querySelectorAll('.lm_tab')].find((t) => t.title === 'Flash Game')?.click();
        });
        await page.waitForTimeout(300);
        await gameFrame().click('#canvas');
        // ⛔ …and RELEASE every arrow into it. A door fires mid-hold, and the
        // region move that follows can take the page's focus before the key comes
        // up, so the game never hears the release and walks on with it held.
        for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
            // eslint-disable-next-line no-await-in-loop
            await page.keyboard.up(k);
        }
        await page.waitForTimeout(200);
    }

    /** Hold `key` until `until()` answers, or the ceiling; `{value, ms}`. */
    async function holdUntil(key, until, ceilingMs = HOLD_CEILING_MS) {
        await gameFrame().evaluate(() => document.getElementById('canvas')?.focus());
        const start = Date.now();
        await page.keyboard.down(key);
        let value = null;
        try {
            while (!value && Date.now() - start < ceilingMs) {
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(50);
                // eslint-disable-next-line no-await-in-loop
                value = await until();
            }
        } finally {
            await page.keyboard.up(key);
        }
        return { value, ms: Date.now() - start };
    }

    const invoked = (level, spawn) => `[BridgeGeneric] Invoked: new Game(${level},${spawn.x},${spawn.y})`;
    const parsePending = (v) => {
        const parts = String(v ?? '').split('|');
        return parts.length === 6 ? { fromLevel: +parts[1], type: parts[2], x: +parts[3], y: +parts[4], to: +parts[5] } : null;
    };

    /**
     * Out through `door`, fired by the game. Returns the parsed pendingExit.
     * `expectMoves` is the glue-move count the departure must leave behind.
     */
    async function departThrough(label, door, expectMoves, expectParks) {
        const keys = STEP_KEYS[door.exit_id];
        await focusGame();
        const centre = { x: door.entrance_spawn.x + TILE / 2, y: door.entrance_spawn.y + TILE / 2 };
        const before = await livePlayer();
        check(`${label}: the LIVE player stands on ${door.exit_id} before stepping off`,
            !!before && Math.hypot(before.x - centre.x, before.y - centre.y) <= TILE / 2,
            `live ${JSON.stringify(before)}, door centre ${JSON.stringify(centre)}`);
        const off = await holdUntil(keys.off, async () => {
            const p = await livePlayer();
            return p && Math.hypot(p.x - centre.x, p.y - centre.y) >= STEP_OFF_PX ? p : null;
        });
        check(`${label}: ${keys.off} held until the LIVE player stood a tile off ${door.exit_id}`,
            !!off.value, `${JSON.stringify(before)} -> ${JSON.stringify(off.value ?? await livePlayer())} in ${off.ms} ms`);
        const pendingBefore = (await readGameState()).pendingExit;
        const on = await holdUntil(keys.on, async () => {
            const s = await readGameState();
            return s.pendingExit !== pendingBefore ? s.pendingExit : null;
        });
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
     * Back into the room from `mazeRegion`, the region the departure left us in,
     * and ONLY from it: the arrival arm under test is the one that reads
     * `source_region`.
     *
     * ⛔ THE STRAIGHT WALK BACK IS NOT ALWAYS THERE (measured, run 6). Arriving
     * from the room, the maze puts the player on its `entrance`, because the spiral
     * links no reverse exit and the maze has no `source_region` arm. In
     * `region_1_0` that cell is a six-tile pocket whose only way out is `exit_0`.
     * So when the exit back is out of reach, the walk goes out to a neighbour and
     * back in. The maze lands a maze-to-maze arrival ON the paired exit tile, which
     * is on the far side of the pocket, and every hop is the maze's own walking.
     *
     * ⚠ THE PLACED-REGION LEG'S KEYPRESS (`_handleKeydown`) IS NOT USED HERE. Run 7
     * took the second hop by keypress, and the maze panel's own `ActionQueue.add`
     * threw "atIndex 0 is inside the done region (cursor 1)": the first hop's
     * keypress crossed into another MAZE region inside its own `stepOne`, the new
     * region's `clear()` emptied the queue, and the cursor then advanced past it.
     * Each hop prints the queue's `{cursor, length}` before it moves.
     */
    async function returnFrom(label, mazeRegion, door, expectLoads) {
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
        const call = invoked(ROOM.level, door.entrance_spawn);
        await waitFor(`arrival invocation ${call}`, () => logs.some((l) => l.includes(call)) || null, 20000);
        const st = await waitFor('the game reports the arrival spawn', async () => {
            const s = await readGameState();
            return s.level === ROOM.level && s.playerPositionX === door.entrance_spawn.x
                && s.playerPositionY === door.entrance_spawn.y ? s : null;
        }, 15000);
        const a = await arrival();
        const armsOneTwo = DOORS.some((d) => d.exit_id === a.arrivedFrom?.exit_id || d.exitName === a.arrivedFrom?.exit_id);
        check(`${label}: back in ${START}, and the arrival teleport landed on ${door.exit_id}'s spawn`,
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
        const wrapped = await page.evaluate(async () => {
            const mod = await import('./modules/flashPanel/index.js');
            const d = mod.getDispatcher();
            if (!d || typeof d.publish !== 'function') return false;
            window.__roomMoves = [];
            const publish = d.publish.bind(d);
            d.publish = (name, data, opts) => {
                if (name === 'user:regionMove') window.__roomMoves.push(data);
                return publish(name, data, opts);
            };
            window.__roomActive = [];
            const bus = (await import('./app/core/eventBus.js')).default;
            bus.subscribe('procgen:activeSubstrateChanged',
                (p) => window.__roomActive.push(p ? p.substrate : null), 'check-seedling-spiral-room-play');
            return true;
        });
        if (!wrapped) throw new Error('could not wrap the flashPanel dispatcher — the watcher would be silent');
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
        const arrivalCall = invoked(ROOM.level, first.entrance_spawn);
        await waitFor(`arrival invocation ${arrivalCall}`, () => logs.some((l) => l.includes(arrivalCall)) || null, 120000);
        const stB = await waitFor('the game reports the arrival spawn', async () => {
            const st = await readGameState();
            return st.level === ROOM.level && st.playerPositionX === first.entrance_spawn.x ? st : null;
        });
        check(`Phase B: the arrival is a new Game at ${first.exit_id}'s entrance_spawn, level ${ROOM.level}`,
            stB.playerPositionY === first.entrance_spawn.y, arrivalCall);
        check('Phase B: the arrival published no crossing', (await glueMoves()).length === 0);
        await page.waitForTimeout(1000);
        await focusGame();
        const onDoor = await livePlayer();
        await hold(STEP_KEYS[first.exit_id].on, 500);
        await page.waitForTimeout(800);
        const stLatch = await readGameState();
        check(`Phase B: pressing INTO ${first.exit_id} while standing on it does not fire it (the check() latch)`,
            stLatch.pendingExit === '' && stLatch.level === ROOM.level && (await glueMoves()).length === 0,
            `live ${JSON.stringify(onDoor)} -> ${JSON.stringify(await livePlayer())}, pendingExit `
            + JSON.stringify(stLatch.pendingExit));

        // ── Phase C / D — out and back through the first door ───────────────────
        await departThrough('Phase C', first, 1, 1);
        await returnFrom('Phase D', first.targetRegion, first, 2);
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
        await returnFrom('Phase D2', second.targetRegion, second, 3);
        check('Phase D2: the return published no crossing', (await glueMoves()).length === 2,
            `${(await glueMoves()).length} glue moves`);

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
        console.log(`FAIL: fatal: ${err.message}`);
        console.log(`PAGE LOGS (last 60):\n${logs.slice(-60).join('\n')}`);
        failures += 1;
    } finally {
        await browser.close();
    }

    // ⛔ Not a check(): see the header. Printed verbatim so a third error shows.
    console.log(`PAGE ERRORS (diagnostic, logic-only channel — the device loss is expected): ${pageErrors.length}`);
    for (const e of pageErrors) console.log(`  pageerror: ${e}`);
    console.log(failures === 0
        ? '\nOK: the placed Seedling room plays — its own doors out into the maze, the maze walked back in'
        : `\nFAILED: ${failures} check(s)`);
    console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
}
