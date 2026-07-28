/**
 * In-app tests for the region atlas's MAZE projection
 * (CC/docs/plans/region-atlas-plan.md, Phases 5b and 6).
 *
 * Phase 4 bound an atlas region to the real recompiled Seedling game, and that
 * leg can only ever be a standalone verifier that SKIPs: it needs a 31 MB
 * gitignored wasm artifact, so an enumerated in-app test would be red on every
 * machine missing it. The maze projection is the answer to that — the same
 * geometry and the same item gating, playable from the committed repo — so these
 * legs CAN live in the suite, and they are the payoff of the phase.
 *
 *   1. seedling-atlas-maze-boundary-crossing — walking onto a boundary exit tile
 *      of the start sub-region crosses into the neighbouring ATLAS region
 *      through the real dispatcher, procgenPlayer and gameState, and the player
 *      arrives standing on the paired exit tile (the crossing they came through,
 *      not the region's entrance — which is what the exit_id-is-exitName
 *      invariant buys).
 *   2. seedling-atlas-maze-gated-crossing — a sub-region crossing whose rule the
 *      Phase-5a analyzer COMPUTED from the tile map blocks without the items and
 *      passes with them. Both halves are asserted, and the negative is bracketed
 *      by positives: the walk to the tile beside the gate has to succeed first,
 *      and the crossing has to happen afterwards, so "nothing moved" cannot pass
 *      because the machinery was dead.
 *   4. seedling-atlas-sphere-bot-completion (Phase 8) — the real playback bot
 *      BEATS that grown world: it builds its queue from the preset's EMBEDDED
 *      sphere log (this preset has no .jsonl sidecar), routes itself across
 *      generated regions and real map regions alike, and reaches `finished`
 *      holding the victory item. Its negative half matters as much: a router
 *      that picks an exit the projection walled used to stall in silence, and
 *      a timed poll cannot tell a silent stall from slow progress — so the
 *      leg also asserts the bot never entered an error status.
 *
 *   3. seedling-atlas-sphere-placed-region (Phase 6) — the same map, but walked
 *      in a world sphere growth GREW: generated maze regions with pieces of the
 *      real Seedling map hung off them behind the driver's synthetic gates. Its
 *      own assertion is that the arrival lands on a FLOOR tile — an atlas region
 *      is sized to its own bounds and is mostly wall, so the grid-mirror arrival
 *      a generated region uses would drop the player inside solid rock, and
 *      neither the compile nor the sphere oracle would notice.
 *
 * Everything is read off the LIVE world rather than hard-coded: which exit is
 * ungated, which is gated, what item its rule wants, and which tile to stand on.
 * A projection change that moves a tile therefore retargets these tests instead
 * of breaking them — and a projection that stops gating anything fails them.
 */

import { registerTest } from '../testRegistry.js';
import { getPanelInstance } from '../../mazeRoom/index.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import { getActivePanel as getBotPanel } from '../../playbackBot/index.js';
import { getSphereStateSingleton } from '../../sphereState/singleton.js';

const PRESET_PATH = './presets/seedling_atlas_maze/AP_1/AP_1_rules.json';
// A world sphere growth GREW with pieces of the same map hung off it
// (region-atlas Phase 6). Regenerate with the command in the preset's README.
const SPHERE_PRESET_PATH = './presets/seedling_atlas_sphere/AP_1/AP_1_rules.json';
const START_REGION = 'overworld_start__r8c0';

const KEY_FOR = Object.freeze({
    N: 'ArrowUp', S: 'ArrowDown', E: 'ArrowRight', W: 'ArrowLeft',
});
const DELTA_FOR = Object.freeze({
    ArrowUp: { dx: 0, dy: -1 },
    ArrowDown: { dx: 0, dy: 1 },
    ArrowRight: { dx: 1, dy: 0 },
    ArrowLeft: { dx: -1, dy: 0 },
});

/** gameState's current region — the AP-side truth, not the panel's. */
function readCurrentRegion() {
    try {
        const gs = getGameStateSingleton();
        return gs?.getCurrentRegion?.() ?? gs?.currentRegion ?? null;
    } catch { return null; }
}

/** Load the maze-flavoured atlas preset and stand in the start sub-region. */
async function enterStartRegion(testController) {
    testController.log('Loading seedling_atlas_maze preset (the real Seedling map as maze worlds)…');
    await testController.loadRulesFromFile(PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 5000);
    testController.reportCondition('rules loaded', true);

    testController.eventBus.publish('ui:activatePanel', { panelId: 'mazeRoomPanel' });

    const panel = await testController.pollForValue(
        () => {
            const p = getPanelInstance();
            return (p?.world && p.state && p.currentRegionId === START_REGION) ? p : null;
        },
        `maze panel mounted in ${START_REGION}`,
        20000, 250);
    testController.assertEqual(
        'the preset put the player in the atlas start sub-region', true, !!panel);
    if (!panel) return null;
    // The AP side agrees — otherwise the panel is showing a world gameState does
    // not think we are in, and every later "the region changed" is meaningless.
    testController.assertEqual('gameState agrees which region we are in',
        START_REGION, readCurrentRegion());
    return panel;
}

/** The obstacle sitting on an exit tile, or undefined when the exit is ungated. */
function gateOn(world, exit) {
    const id = world.obstacles.get(`${exit.x},${exit.y}`);
    return id ? { id, def: world.obstacleLib?.[id] } : undefined;
}

/**
 * A minimal set of {name, count} that satisfies a Rule Builder tree: an Or takes
 * its first branch, an And takes all of them. Derived from the rule the
 * PROJECTION emitted, so the test never names a Seedling item itself.
 */
function itemsSatisfying(rule) {
    if (!rule || typeof rule !== 'object') return [];
    if (rule.rule === 'Has') return [{ name: rule.args?.item_name, count: rule.args?.count ?? 1 }];
    if (rule.rule === 'Or') return itemsSatisfying(rule.children?.[0]);
    if (rule.rule === 'And') return (rule.children ?? []).flatMap(itemsSatisfying);
    return [];
}

/**
 * Tiles the player can stand on and walk to, without crossing an exit or a gate:
 * an ordinary flood over plain floor from `from`. A staging tile the player
 * cannot actually get to makes the whole leg red for a reason that has nothing
 * to do with what it tests, and in a generated world that happens — an exit can
 * sit in a pocket whose only approach is another exit tile.
 */
function walkableFrom(world, from) {
    const key = (x, y) => `${x},${y}`;
    const blocked = new Set([...world.obstacles.keys()]);
    for (const e of world.exits.values()) blocked.add(key(e.x, e.y));
    const seen = new Set([key(from.x, from.y)]);
    const queue = [{ x: from.x, y: from.y }];
    while (queue.length > 0) {
        const { x, y } = queue.shift();
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const nx = x + dx;
            const ny = y + dy;
            const k = key(nx, ny);
            if (seen.has(k) || blocked.has(k)) continue;
            if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
            if (world.tiles[ny * world.width + nx] !== 0) continue;
            seen.add(k);
            queue.push({ x: nx, y: ny });
        }
    }
    return seen;
}

/**
 * A tile beside `target` that is plain floor: not an exit, not an obstacle —
 * and, when `from` is given, one the player can actually walk to.
 *
 * `towardKey` is the key that walks FROM that tile ONTO `target` — i.e. the
 * direction back, (-dx, -dy). Getting this backwards makes the whole test
 * vacuous: the player walks AWAY from the gate, nothing moves onto it, and
 * "blocked" passes for the wrong reason.
 */
function stagingTileBeside(world, target, from = null) {
    const dirs = [
        { dx: 0, dy: -1, toward: 'S' }, // the tile is NORTH of target: press South
        { dx: 1, dy: 0, toward: 'W' },
        { dx: 0, dy: 1, toward: 'N' },
        { dx: -1, dy: 0, toward: 'E' },
    ];
    const reachable = from ? walkableFrom(world, from) : null;
    let fallback = null;
    for (const d of dirs) {
        const x = target.x + d.dx;
        const y = target.y + d.dy;
        if (x < 0 || y < 0 || x >= world.width || y >= world.height) continue;
        if (world.tiles[y * world.width + x] !== 0) continue;
        if (world.obstacles.has(`${x},${y}`)) continue;
        let onExit = false;
        for (const e of world.exits.values()) if (e.x === x && e.y === y) { onExit = true; break; }
        if (onExit) continue;
        const tile = { x, y, towardKey: KEY_FOR[d.toward] };
        if (!reachable || reachable.has(`${x},${y}`)) return tile;
        // Keep the first unreachable candidate so the failure stays the old
        // "the walk did not arrive" rather than turning into "no tile at all".
        fallback = fallback ?? tile;
    }
    return fallback;
}

/** Walk the panel's real playback controller onto a tile and wait for arrival. */
async function walkTo(testController, panel, tile, label) {
    const controller = panel.getPlaybackController?.();
    if (!controller?.walkTo) {
        testController.assertEqual('the maze panel exposes a playback controller', true, false);
        return false;
    }
    controller.walkTo({ kind: 'tile', x: tile.x, y: tile.y });
    controller.instant?.();
    const arrived = await testController.pollForCondition(
        () => {
            const p = getPanelInstance();
            return p?.state?.player_pos?.x === tile.x && p.state.player_pos.y === tile.y;
        },
        label, 20000, 200);
    testController.assertEqual(label, true, !!arrived);
    return !!arrived;
}

/** One step through the REAL keyboard path (queue -> executor -> engine.step). */
function press(panel, key) {
    panel._handleKeydown({ key, preventDefault: () => {} });
}

/**
 * The key really does aim at the tile under test. Without this, a mis-signed
 * direction walks the player AWAY and "the step did not move it" passes for
 * entirely the wrong reason — which is exactly what happened on the first run.
 */
function assertAimedAt(testController, staging, target) {
    const d = DELTA_FOR[staging.towardKey];
    const aim = { x: staging.x + d.dx, y: staging.y + d.dy };
    testController.assertEqual(
        `pressing ${staging.towardKey} from (${staging.x},${staging.y}) aims at the tile under test`,
        `${target.x},${target.y}`, `${aim.x},${aim.y}`);
    return aim.x === target.x && aim.y === target.y;
}

// ────────────────────────────────────────────────────────────────
// 1. A boundary crossing changes the AP region
// ────────────────────────────────────────────────────────────────
async function boundaryCrossing(testController) {
    const panel = await enterStartRegion(testController);
    if (!panel) return testController.getOverallResult();

    const world = panel.world;
    // An UNGATED boundary exit of this sub-region: one of the atlas's own level
    // links (the house door / the owl's nest stairs), which the projection put on
    // the marked entrance tile.
    const exit = [...world.exits.values()].find((e) => e.targetRegion && !gateOn(world, e));
    testController.assertEqual('the start sub-region has an ungated exit to walk out of',
        true, !!exit);
    if (!exit) return testController.getOverallResult();
    testController.log(`exit '${exit.exit_id}' at (${exit.x},${exit.y}) -> '${exit.targetRegion}' `
        + `(arrive at '${exit.targetExitId}')`);

    // Walk to the tile beside it, then step ON — the step is what crosses.
    const staging = stagingTileBeside(world, exit, panel.state.player_pos);
    testController.assertEqual('there is a floor tile beside the exit to step from',
        true, !!staging);
    if (!staging) return testController.getOverallResult();
    if (!await walkTo(testController, panel, staging,
        `walked to (${staging.x},${staging.y}), beside the exit`)) {
        return testController.getOverallResult();
    }
    if (!assertAimedAt(testController, staging, exit)) return testController.getOverallResult();

    press(panel, staging.towardKey);
    const crossed = await testController.pollForCondition(
        () => readCurrentRegion() === exit.targetRegion,
        `stepping onto the exit tile moved the AP region to '${exit.targetRegion}'`,
        15000, 200);
    if (!crossed) {
        testController.log(`DIAG: gameState region '${readCurrentRegion()}', panel `
            + `'${getPanelInstance()?.currentRegionId}', pos `
            + JSON.stringify(getPanelInstance()?.state?.player_pos));
    }
    testController.assertEqual(
        'walking a marked boundary tile crossed into the neighbouring atlas region '
        + '(through the real dispatcher, procgenPlayer and gameState)', true, !!crossed);
    if (!crossed) return testController.getOverallResult();

    // The substrate followed, and it is showing the destination's own world.
    const arrived = await testController.pollForValue(
        () => {
            const p = getPanelInstance();
            return (p?.world && p.currentRegionId === exit.targetRegion) ? p : null;
        },
        `the maze panel adopted '${exit.targetRegion}'`, 15000, 200);
    testController.assertEqual('the maze panel adopted the destination region',
        true, !!arrived);
    if (!arrived) return testController.getOverallResult();

    // Arrival lands on the crossing we came through, not on the region's spawn.
    // This is what the exit_id-is-exitName invariant buys: procgenPlayer resolves
    // the source exit's targetExitId in the destination's exits Map.
    const back = arrived.world.exits.get(exit.targetExitId);
    testController.assertEqual('the destination carries the paired exit back here',
        true, !!back && back.targetRegion === START_REGION);
    if (back) {
        testController.assertEqual(
            'the player arrived ON the crossing tile, not at the region entrance',
            `${back.x},${back.y}`,
            `${arrived.state.player_pos.x},${arrived.state.player_pos.y}`);
    }

    return testController.getOverallResult();
}

// ────────────────────────────────────────────────────────────────
// 2. A computed gate blocks without the item and passes with it
// ────────────────────────────────────────────────────────────────
async function gatedCrossing(testController) {
    const panel = await enterStartRegion(testController);
    if (!panel) return testController.getOverallResult();

    const world = panel.world;
    let gated = null;
    for (const e of world.exits.values()) {
        const gate = gateOn(world, e);
        if (!gate?.def?.clear_rule || !e.targetRegion) continue;
        const wants = itemsSatisfying(gate.def.clear_rule);
        if (wants.length > 0 && wants.every((w) => typeof w.name === 'string')) {
            gated = { exit: e, gate, wants };
            break;
        }
    }
    testController.assertEqual(
        'the start sub-region has a rule-gated crossing (the analyzer computed one)',
        true, !!gated);
    if (!gated) return testController.getOverallResult();
    const { exit, gate, wants } = gated;
    testController.log(`gated crossing '${exit.exit_id}' at (${exit.x},${exit.y}) -> `
        + `'${exit.targetRegion}'; rule ${JSON.stringify(gate.def.clear_rule)}`);

    // ── positive control: get to the tile beside the gate ──────────
    const staging = stagingTileBeside(world, exit, panel.state.player_pos);
    testController.assertEqual('there is a floor tile beside the gate to step from',
        true, !!staging);
    if (!staging) return testController.getOverallResult();
    if (!await walkTo(testController, panel, staging,
        `walked to (${staging.x},${staging.y}), beside the gated crossing`)) {
        return testController.getOverallResult();
    }
    if (!assertAimedAt(testController, staging, exit)) return testController.getOverallResult();

    // ── the negative: the same step, without the items ────────────
    //
    // The keyboard path is synchronous (handleInput appends AND executes), so the
    // step has already resolved when press() returns; the extra beat is only so
    // an asynchronous region-move chain would have had time to fire if the step
    // HAD gone through.
    press(panel, staging.towardKey);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const posAfterBlock = { ...getPanelInstance().state.player_pos };
    testController.assertEqual(
        'without the items, stepping onto the gated crossing does not move the player',
        `${staging.x},${staging.y}`, `${posAfterBlock.x},${posAfterBlock.y}`);
    testController.assertEqual('and the AP region did not change',
        START_REGION, readCurrentRegion());

    // ── grant through the normal item path ────────────────────────
    for (const w of wants) {
        testController.log(`granting ${w.name} x${w.count}`);
        await testController.stateManager.addItemToInventory(w.name, w.count);
    }
    await testController.stateManager.pingWorker('after-item-grant', 5000);

    // ── the positive: the same step now crosses ───────────────────
    press(panel, staging.towardKey);
    const crossed = await testController.pollForCondition(
        () => readCurrentRegion() === exit.targetRegion,
        `with the items, the same step crossed into '${exit.targetRegion}'`,
        15000, 200);
    if (!crossed) {
        testController.log(`DIAG: gameState region '${readCurrentRegion()}', pos `
            + JSON.stringify(getPanelInstance()?.state?.player_pos)
            + `, inventory-visible rule ${JSON.stringify(gate.def.clear_rule)}`);
    }
    testController.assertEqual(
        'the computed gate opened once the items were held, and the crossing fired '
        + 'a real region move', true, !!crossed);

    return testController.getOverallResult();
}

// ────────────────────────────────────────────────────────────────
// 3. A GENERATED sphere world contains real map regions, behind its gate
// ────────────────────────────────────────────────────────────────
//
// The two legs above walk the vanilla map: the atlas's own regions, connected
// the way the game connects them. This one walks a world sphere growth GREW
// (region-atlas Phase 6): generated maze regions with pieces of the real
// Seedling map hung off them behind the driver's synthetic gates. The witness
// that matters is that the placed region is enterable AT ALL — an atlas region
// is sized to its own bounds and most of its tiles are wall, so an arrival
// computed the way a generated region's would be lands the player inside solid
// rock and the world is unplayable while still compiling and passing its oracle.
async function generatedSphereWorld(testController) {
    testController.log('Loading seedling_atlas_sphere (a grown sphere world with real map regions)…');
    await testController.loadRulesFromFile(SPHERE_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 5000);
    testController.eventBus.publish('ui:activatePanel', { panelId: 'mazeRoomPanel' });

    const panel = await testController.pollForValue(
        () => {
            const p = getPanelInstance();
            return (p?.world && p.state && p.currentRegionId) ? p : null;
        },
        'maze panel mounted in the grown world', 20000, 250);
    testController.assertEqual('the grown world loaded', true, !!panel);
    if (!panel) return testController.getOverallResult();

    const startRegion = panel.currentRegionId;
    testController.assertEqual('gameState agrees which region we are in',
        startRegion, readCurrentRegion());

    // An atlas region is named after the map (`overworld_start__r1c6`), never
    // after its grid cell — which is how a leg can find one without being told.
    const world = panel.world;
    const toAtlas = [...world.exits.values()]
        .find((e) => e.targetRegion && !/^region_\d+_\d+$/.test(e.targetRegion));
    testController.assertEqual(
        'the start region has an exit into a placed atlas region', true, !!toAtlas);
    if (!toAtlas) return testController.getOverallResult();
    testController.log(`exit '${toAtlas.exit_id}' -> atlas region '${toAtlas.targetRegion}'`);

    // The sphere driver's synthetic gate: the HOST is a generated maze region, so
    // the gate is realised physically on the way out of it. Read the wanted items
    // off it rather than naming them — this leg should survive a re-grow.
    const gate = gateOn(world, toAtlas);
    testController.assertEqual('the exit into the atlas region carries the driver\'s gate',
        true, !!gate?.def?.clear_rule);
    const wants = itemsSatisfying(gate?.def?.clear_rule);
    testController.log(`gate rule ${JSON.stringify(gate?.def?.clear_rule)}`);

    const staging = stagingTileBeside(world, toAtlas, panel.state.player_pos);
    testController.assertEqual('there is a floor tile beside the exit to step from',
        true, !!staging);
    if (!staging) return testController.getOverallResult();
    if (!await walkTo(testController, panel, staging,
        `walked to (${staging.x},${staging.y}), beside the exit into the atlas region`)) {
        return testController.getOverallResult();
    }
    if (!assertAimedAt(testController, staging, toAtlas)) return testController.getOverallResult();

    // The negative, bracketed by the walk that had to succeed before it.
    //
    // The inventory is EMPTIED of the gate items rather than assumed empty: the
    // only route to the staging tile can run over the very pickup the gate wants
    // (it does in the committed world — sphere-1 items live in the wave-0 start
    // region), and a "blocked" that passed because the walk failed, or failed
    // because the walk collected the key, would say nothing either way.
    const held = [];
    for (const wItem of wants) {
        const count = Number(
            testController.stateManager.getSnapshot()?.inventory?.[wItem.name] ?? 0);
        held.push({ ...wItem, count: Math.max(count, wItem.count) });
        if (count > 0) {
            testController.log(`removing ${wItem.name} x${count} picked up on the way`);
            await testController.stateManager.removeItemFromInventory(wItem.name, count);
        }
    }
    await testController.stateManager.pingWorker('after-item-clear', 5000);

    press(panel, staging.towardKey);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const blocked = getPanelInstance().state.player_pos;
    testController.assertEqual(
        'without the gate items the step onto the exit does not move the player',
        `${staging.x},${staging.y}`, `${blocked.x},${blocked.y}`);
    testController.assertEqual('and the AP region did not change',
        startRegion, readCurrentRegion());

    for (const wItem of held) {
        testController.log(`granting ${wItem.name} x${wItem.count}`);
        await testController.stateManager.addItemToInventory(wItem.name, wItem.count);
    }
    await testController.stateManager.pingWorker('after-item-grant', 5000);

    press(panel, staging.towardKey);
    const crossed = await testController.pollForCondition(
        () => readCurrentRegion() === toAtlas.targetRegion,
        `stepping onto the exit crossed into the placed atlas region `
        + `'${toAtlas.targetRegion}'`, 15000, 200);
    testController.assertEqual(
        'a grown sphere world can be walked into a region of the REAL Seedling map',
        true, !!crossed);
    if (!crossed) {
        testController.log(`DIAG: gameState region '${readCurrentRegion()}', panel `
            + `'${getPanelInstance()?.currentRegionId}', pos `
            + JSON.stringify(getPanelInstance()?.state?.player_pos));
        return testController.getOverallResult();
    }

    const arrived = await testController.pollForValue(
        () => {
            const p = getPanelInstance();
            return (p?.world && p.currentRegionId === toAtlas.targetRegion) ? p : null;
        },
        `the maze panel adopted '${toAtlas.targetRegion}'`, 15000, 200);
    testController.assertEqual('the maze panel adopted the placed atlas region',
        true, !!arrived);
    if (!arrived) return testController.getOverallResult();

    // THE assertion of this leg: the arrival tile is walkable. Most of an atlas
    // region is wall, so the driver's usual grid-mirror arrival tile would put
    // the player inside solid terrain with nowhere to step.
    const w = arrived.world;
    const pos = arrived.state.player_pos;
    testController.assertEqual(
        'the player arrived standing on a FLOOR tile of the real map, not inside a wall',
        0, w.tiles[pos.y * w.width + pos.x]);

    // And the real map came with it: its own gates are in the grown world.
    const ruleGates = [...w.obstacles.values()]
        .filter((id) => w.obstacleLib?.[id]?.clear_set_type === 'rule');
    testController.log(`the placed region carries ${ruleGates.length} of the map's own `
        + `rule gate(s) and ${w.exits.size} routed exit(s)`);
    testController.assertEqual('the placed region kept a way back to its parent',
        true, [...w.exits.values()].some((e) => e.targetRegion === startRegion));

    return testController.getOverallResult();
}

/**
 * Phase 8, slice B — the real playback bot BEATS the grown atlas world.
 *
 * The headless witness (frontend/modules/procgenPipeline/atlasMazeBot.slow.test.js)
 * proves the same world beatable by walking tiles through the engine directly.
 * This leg proves the SHIPPED bot does it: the sphere queue, the PathFinder
 * router, the maze playback controller, procgenPlayer's warehouse and the real
 * dispatcher, all in a browser.
 *
 * Two things this can witness that the headless walk cannot:
 *   - the queue comes from the preset's EMBEDDED `sphere_log` (there is no
 *     .jsonl beside this preset), through the module that prefers it;
 *   - a router pick the substrate cannot reach is now a NAMED error status
 *     instead of a silent stall. That distinction is the whole reason this
 *     leg is not just "poll until finished": a stalled bot and a slow bot look
 *     identical to a timeout, so the run asserts no error status ever appeared
 *     as well as asserting completion.
 */
async function sphereWorldBotCompletion(testController) {
    // The bot panel must be mounted BEFORE the rules load: procgenPlayer
    // publishes its synthetic initial user:regionMove on rulesLoaded, and a bot
    // that is not listening yet never learns its starting region.
    testController.eventBus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' });
    const botPanel = await testController.pollForValue(
        () => getBotPanel(), 'playback bot panel instance', 5000, 100);
    testController.reportCondition('playback bot panel mounted', !!botPanel);
    const bot = botPanel?.getBot?.();
    testController.reportCondition('bot reachable via panel.getBot()', !!bot);
    if (!bot) return testController.getOverallResult();

    testController.log('Loading the sphere-grown Seedling atlas world…');
    await testController.loadRulesFromFile(SPHERE_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 5000);

    // The queue's source. This preset carries its sphere log INSIDE rules.json;
    // sphereState prefers that embedded array over a sidecar file, and there is
    // no sidecar to fall back to — so a non-empty queue here IS the assertion
    // that the embedded path works.
    const sphereState = getSphereStateSingleton();
    const sphereLoaded = await testController.pollForCondition(
        () => (sphereState.getSphereData()?.length ?? 0) > 0,
        'the EMBEDDED sphere log was loaded (this preset has no .jsonl sidecar)',
        10000, 200);
    testController.reportCondition('embedded sphere log loaded', !!sphereLoaded);
    if (!sphereLoaded) return testController.getOverallResult();

    bot.refresh();
    testController.log(`start region '${bot.getCurrentRegion?.() ?? '?'}' `
        + '(the queue is built lazily on the first play/instant)');
    testController.reportCondition('bot picked up its starting region',
        !!bot.getCurrentRegion?.());

    // Every status the bot passes through, READ OFF ITS LOG rather than
    // sampled. `_setStatus` appends each distinct status to `_log`, so the log
    // is the mutation record: an `error:` that is overwritten a millisecond
    // later still appears in it, and an interval sampler would miss exactly
    // that case — which is the interesting one, since `instant()` drives the
    // whole queue in a tight loop.
    const errorStatuses = () => (bot.getLog?.() ?? [])
        .filter((line) => typeof line === 'string' && line.startsWith('error:'));

    await bot.instant();
    const finished = await testController.pollForCondition(
        () => (bot.getStatus() || '').startsWith('finished'),
        'the bot drained its whole sphere queue', 60000, 250);

    if (!finished) {
        testController.log(`bot final status: "${bot.getStatus()}"`);
        testController.log('bot status log (tail): '
            + JSON.stringify(bot.getLog?.().slice(-12) ?? []));
    }
    testController.assertEqual(
        'the shipped playback bot BEAT a sphere-grown world containing real map regions',
        true, !!finished);

    // The silent-stall guard. A router pick the maze projection walled (the AP
    // graph lists crossings the projection deliberately does not) used to leave
    // the bot waiting forever; it now names the target it cannot reach.
    //
    // Positive control FIRST: an empty error list means nothing unless the log
    // it is filtered from was actually written. Assert the bot recorded real
    // statuses before believing it recorded no errors.
    const statusLog = bot.getLog?.() ?? [];
    testController.assertEqual('the bot wrote a status log to read errors out of',
        true, statusLog.length > 1 && statusLog.some((l) => String(l).startsWith('finished')));
    testController.assertEqual(
        'the bot never hit an unreachable-target error draining the queue',
        '[]', JSON.stringify(errorStatuses()));

    // Completion means the goal item, not just an empty queue.
    await testController.stateManager.pingWorker('after-bot-run', 5000);
    const inventory = testController.stateManager.getSnapshot()?.inventory ?? {};
    testController.assertEqual('the bot is holding the victory item',
        true, Number(inventory.victory ?? 0) > 0);

    // It really crossed regions rather than finishing where it started. The
    // witness is gameState's own PATH — the AP-side record of every regionMove
    // that actually landed — not the bot's status log (plain text) and not its
    // own cursor, which would just be the bot agreeing with itself.
    const gs = getGameStateSingleton();
    const walked = () => new Set(
        (gs?.getPath?.() ?? [])
            .filter((e) => e.type === 'regionMove')
            .map((e) => e.destinationRegion)
            .filter(Boolean));
    const afterQueue = walked();
    testController.log(`gameState path visited ${afterQueue.size} region(s): `
        + JSON.stringify([...afterQueue]));
    testController.assertEqual('the run was cross-region, not a single-room walk',
        true, afterQueue.size > 1);

    // Now the atlas half. The SPHERE QUEUE alone never enters a placed map
    // region in this world: every advancement item sits in a generated region,
    // and the one location the atlas marks (`Starting House - Chest`) holds
    // filler, so the sphere log does not name it. Asserting "the queue walked
    // into the real map" would therefore have been an assertion about this
    // particular fill, not about the bot.
    //
    // What IS worth proving is that the bot can ROUTE INTO a placed atlas
    // region — the leg where a walled AP-only crossing would strand it. Send it
    // there by name; walkToLocation routes across regions one exit at a time,
    // re-entering on every arrival.
    const ATLAS_LOCATION = 'Starting House - Chest';
    testController.log(`routing the bot to '${ATLAS_LOCATION}' in a placed atlas region…`);
    bot.walkToLocation(ATLAS_LOCATION);
    const reachedAtlas = await testController.pollForCondition(
        () => [...walked()].some((r) => r !== 'Menu' && !/^region_\d+_\d+$/.test(r)),
        'the bot routed itself into a region of the REAL Seedling map', 40000, 250);

    const atlasRegions = [...walked()]
        .filter((r) => r !== 'Menu' && !/^region_\d+_\d+$/.test(r));
    testController.log(`real-map regions walked: ${JSON.stringify(atlasRegions)}; `
        + `bot status "${bot.getStatus()}"`);
    testController.assertEqual(
        'the bot routed itself into a region of the REAL Seedling map',
        true, !!reachedAtlas);

    // Re-checked AFTER the manual leg: routing into the atlas is exactly where a
    // walled AP-only crossing would strand the router, so the silent-stall guard
    // has to cover this half too.
    testController.assertEqual(
        'no unreachable-target error at any point', '[]', JSON.stringify(errorStatuses()));

    return testController.getOverallResult();
}

registerTest({
    id: 'seedling-atlas-maze-boundary-crossing',
    name: 'Seedling atlas (maze): walking a marked boundary crosses the AP region',
    description: 'Loads the maze-flavoured Seedling atlas preset, walks onto one of the '
               + "atlas's own marked boundary tiles in the start sub-region, and asserts "
               + 'the AP region changes through the real dispatcher / procgenPlayer / '
               + 'gameState — and that the player arrives standing on the paired crossing '
               + 'tile rather than the destination\'s entrance.',
    testFunction: boundaryCrossing,
    category: 'Seedling atlas maze',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'seedling-atlas-maze-gated-crossing',
    name: 'Seedling atlas (maze): a computed gate blocks without its item and passes with it',
    description: 'A sub-region crossing whose rule the Phase-5a analyzer computed from the '
               + 'real tile map: the step onto it is a no-op with an empty inventory and '
               + 'crosses once the rule\'s item is granted through the normal stateManager '
               + 'path. Both halves are asserted, the negative bracketed by the walk that '
               + 'must succeed before it and the crossing that must succeed after.',
    testFunction: gatedCrossing,
    category: 'Seedling atlas maze',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'seedling-atlas-sphere-placed-region',
    name: 'Seedling atlas (sphere): a grown world can be walked into a real map region',
    description: 'Loads a sphere-grown world that placed pieces of the real Seedling map '
               + 'behind the driver\'s synthetic gates, proves the gate blocks and then '
               + 'opens, and asserts the arrival lands on a FLOOR tile of the real map — '
               + 'the failure an atlas region sized to its own bounds invites, and one no '
               + 'compile or sphere oracle would catch.',
    testFunction: generatedSphereWorld,
    category: 'Seedling atlas maze',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'seedling-atlas-sphere-bot-completion',
    name: 'Seedling atlas (sphere): the playback bot beats the grown world',
    description: 'Drives the SHIPPED playback bot through the sphere-grown Seedling atlas '
               + 'world: queue built from the preset\'s embedded sphere log, cross-region '
               + 'routing over generated and real-map regions, terminal "finished" status '
               + 'with the victory item held — and no unreachable-target error along the '
               + 'way, since a silent stall is indistinguishable from slow progress.',
    testFunction: sphereWorldBotCompletion,
    category: 'Seedling atlas maze',
    enabled: false, // off by default — runs only in the test-substrates mode
});
