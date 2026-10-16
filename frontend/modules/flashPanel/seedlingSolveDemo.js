/**
 * flashPanel/seedlingSolveDemo — ⛓ AUTO-SHOW (slice `solve-progress-auto`): **A SOLVE THE PANEL CAN STAGE**, so the
 * Solve Progress view can be watched (and its feature check `seedling-solve-progress-auto-show` can run) on a real
 * solve without a test harness reaching into the page.
 *
 * `l6-enemy-room` is the L6 enemy room the in-app row `seedling-js-runtime-solve-progress-view` solves: the
 * player arrives through level 5's door (the game's own return spawn, `seedlingReturnSpawns.js`) and the solver
 * walks to the stairs at (224, 32) past the bobs. JS runtime, deterministic. ⚖ The user (2026-10-15): L6 now; L18
 * later. (L18's 20–45 s was a node hammer solve, §5.58. In the page, measured by slice `seedling-slowsolve-check`:
 * L18 from L16 with the sword solves in 4.4 s at 56 / 640 units, and its whole walk takes 20 s.)
 *
 * ⛓ SLOWSOLVE (slice `seedling-slowsolve-check`, ⚖ the user 2026-10-16: "the longest solve that actually
 * completes", "an example that isn't a boss fight", then the same solve "with the time limits extended, for the
 * optional parts of the solve that are cut"): `l12-dash-cut` is divergence leg 108. The player enters L12 through
 * level 0's door at (16, 80), holding the sword, and walks to the teleporter at (432, 352). At the defaults the
 * dashless pass ships a 561-tick walk (36 units) and the full pass, which may dash, is CUT by the 85-unit upgrade
 * window at `sword-dash`. With `flashPanel.seedlingSolverUpgradeWindowWork` = 0 the full pass finishes at 202 units
 * and ships 328 ticks. (Measured on one box; the units are the same everywhere, the seconds are not.)
 *   - Why leg 108 and not 168 (the same goal from L95's lower door, the longer solve): the sword must come through
 *     the AP item path, so the demo runs on seedling_playthrough, and there the region glue moves any arrival in
 *     `level_12__r0c19` to that region's entry, (16, 80). Only that entry stays where the demo put it.
 *   - `needs`: items the page must HOLD and have SLOTTED. The panel never writes them: a flag alone gets no slot (so
 *     sword-dash is unavailable and the full pass is SKIPPED), so they come through the AP item path (seedling
 *     _playthrough's Progressive Sword). A demo that lacks one is refused by name.
 *
 * The panel handles the bus event `SOLVE_DEMO_EVENT` (`{demo}`) — see `FlashPanelUI.stageSolveDemo` — and reports
 * on its root element: `data-solve-demo` = `staging` | `staged` | `refused`, with the reason in
 * `data-solve-demo-why`. Pure here: no fetch, no DOM.
 */
import { returnKey, returnSpawnTable } from './seedlingReturnSpawns.js';

/** The bus event the panel stages a demo on: `{demo: <a key of SOLVE_DEMOS>}`. */
export const SOLVE_DEMO_EVENT = 'flashPanel:stageSolveDemo';

export const SOLVE_DEMOS = Object.freeze({
    'l6-enemy-room': Object.freeze({ level: 6, from: 5, exit: Object.freeze({ x: 224, y: 32 }),
        title: 'level 6: past the bobs to the stairs' }),
    'l12-dash-cut': Object.freeze({ level: 12, from: 0, exit: Object.freeze({ x: 432, y: 352 }),
        needs: Object.freeze([Object.freeze({ item: 'Progressive Sword', flag: 'hasSword', slot: 0 })]),
        title: 'level 12: from level 0\'s door to the teleporter at (432, 352), sword in hand' }),
});

/**
 * Where a demo starts and what it walks to, read off the map document → `{ok: true, level, spawn: {x, y}, goal}`
 * or `{ok: false, why}`. `goal` is the page's `walkTo` goal.
 */
export function solveDemoStage(mapDoc, id) {
    const demo = SOLVE_DEMOS[id];
    if (!demo) return { ok: false, why: `no solve demo '${id}' (known: ${Object.keys(SOLVE_DEMOS).join(', ')})` };
    const size = mapDoc?.tile_size;
    const room = (mapDoc?.levels ?? []).find((l) => l.level === demo.level);
    if (!Number.isInteger(size) || !room) return { ok: false, why: `the map has no level ${demo.level}` };
    const tile = (e) => [Math.floor(e.x / size), Math.floor(e.y / size)];
    const door = (room.entities ?? []).find((e) => Number(e.attrs?.to) === demo.from);
    const exit = (room.entities ?? []).find((e) => e.x === demo.exit.x && e.y === demo.exit.y);
    if (!door || !exit) return { ok: false, why: `level ${demo.level} lacks its door from ${demo.from} or its exit` };
    const spawn = returnSpawnTable(mapDoc).get(returnKey(demo.level, ...tile(door)));
    if (!spawn) return { ok: false, why: `level ${demo.level}'s door from ${demo.from} has no return spawn` };
    return { ok: true, level: demo.level, spawn: { x: spawn.x, y: spawn.y },
        goal: { kind: 'exit', level: demo.level, tiles: [tile(exit)] } };
}

/**
 * The demo's `needs` the page lacks: an item it does not hold (`page.flags[flag]`) or holds without its inventory
 * slot (`page.run.inventorySlots`) → the item names, `[]` when none.
 */
export function solveDemoMissing(id, page) {
    const slots = page?.run?.inventorySlots ?? [];
    return (SOLVE_DEMOS[id]?.needs ?? [])
        .filter((n) => page?.flags?.[n.flag] !== true || (Number.isInteger(n.slot) && !slots.includes(n.slot)))
        .map((n) => n.item);
}

/**
 * Where the page's run was booted when it is NOT the demo's spawn (`run.worldCtor`), else null. On a world with an
 * AP region glue (seedling_playthrough) an arrival is moved to its region's entry FROM THE REGION THE PLAYER LEFT:
 * entered from level 33's side, L12's region puts the player at (432, 368), beside the goal. A demo staged there
 * would solve a different walk, so the panel refuses it by name instead.
 */
export function solveDemoMoved(stage, run) {
    const at = run?.worldCtor ?? null;
    if (!at || (at.x === stage.spawn.x && at.y === stage.spawn.y)) return null;
    return { x: at.x, y: at.y };
}

/**
 * Hand the page the upgrade window (`flashPanel.seedlingSolverUpgradeWindowWork`) before a demo's walk, as
 * `seedlingPlaybackController` does with every goal: `undefined` (not read yet) and `null` (unset) leave the page's
 * own value. The request stamps the window (`jsRuntimeSolver`), so the default (85) is byte-identical to no push.
 */
export function pushDemoWindow(playback, windowWork) {
    if (windowWork === undefined || windowWork === null) return false;
    playback.setSolverUpgradeWindowWork?.(windowWork);
    return true;
}
