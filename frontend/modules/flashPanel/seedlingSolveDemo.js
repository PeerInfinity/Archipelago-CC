/**
 * flashPanel/seedlingSolveDemo — ⛓ AUTO-SHOW (slice `solve-progress-auto`): **A SOLVE THE PANEL CAN STAGE**, so the
 * Solve Progress view can be watched (and its feature check `seedling-solve-progress-auto-show` can run) on a real
 * solve without a test harness reaching into the page.
 *
 * The one demo today is the L6 enemy room the in-app row `seedling-js-runtime-solve-progress-view` solves: the
 * player arrives through level 5's door (the game's own return spawn, `seedlingReturnSpawns.js`) and the solver
 * walks to the stairs at (224, 32) past the bobs. JS runtime, deterministic. ⚖ The user (2026-10-15): L6 now; L18's
 * hammer solve (20–45 s) is a LATER route.
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
