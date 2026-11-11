#!/usr/bin/env node
/**
 * Seedling KILL-LOCK ARMS, THE GAME'S WAY (rules `rules-l60-l71-killlock`). The encounter-lock rule
 * (`seedlingObstacleEvents.encounterLockSides`) grades each side of a kill-lock (`tSet == -1`: opens on
 * `Game.totalEnemies() == 0`, `Lock.as:111`) as `clears` / `undecided` / `cannot`, and FIRES only on a `cannot`. This
 * asks the wasm game what a side the census did NOT settle can really do. Its subjects are read off the census
 * (`playthroughEncounterLocks`, never listed by hand): every lock it does not fire on, that no cross-level button
 * opens, with a side that is not `clears`. Per subject:
 *
 *   ARMS    per side that is not `clears`, per kill arm ALONE (`ARMS`: none, the sword, the dark sword, the spear, the
 *           ghost sword, the wand, the dark shield): booted in that side's cell behind the lock, a CLOSED LOOP of short
 *           continuation windows on one live page (`standStep`). The player never leaves the side's own tiles: it
 *           stands at the side's point nearest the nearest counted body, faces it and presses `primary` once the body
 *           is within `--engage` px. Read: where each counted body ends (did it come?), which the game killed, whether
 *           the GAME wrote `{level, tag}`, and whether the player then walks through the lock (`OPEN` window).
 *   CLEAR   per side the census says `clears`: the same loop from the room beside the lock, holding the sword plus the
 *           flags a gated cell on the route to a body asks for (`armFlags`: water → the conch); the game must empty
 *           the roster and write the flag.
 *   RETURN  per other side, booted behind the lock holding only the flag CLEAR's game wrote, nothing granted: the
 *           game builds the lock open and the player walks through.
 *
 * ⚠ `--margin` (how far inside its tile the player's check point stays) DECIDES A THRUST'S ALIGNMENT. The default 5 keeps
 * the player out of the pits beside L60's pocket; at 5 the Spear from L71's button cell misses the chamber by 1.5 px and
 * reads shut, and `--only=71 --margin=2` (no pit beside either side) is the run that asks it: there it kills all five.
 * An arm is `shut` for a side only when it is shut at every margin the side allows.
 *
 * Staged: the boot position, the grants, the inputs. Never the flag (but RETURN's, which the game wrote), a kill
 * count, a removed body or a game value. The arms that end with the lock open are the witness's verdict per side;
 * the probe prints them as a `VERDICT` row and FAILS only on a broken instrument (a rebuild, the model's bodies not
 * the game's roster, a `clears` side the game does not clear, a RETURN that does not pass).
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, `VERDICT {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. A run
 * with no subject FAILS (the subject moved). Prereqs: a dev server at the repo root (`--host=`, default
 * http://localhost:8000); the wasm build, or SKIP. Takes the box lock. Headless LOGIC-ONLY (proved,
 * `CHANNEL: headless logic-only`), so it runs in CI too (`.github/workflows/seedling-probe.yml`).
 *
 * Run: node scripts/procgen/probe-seedling-killlock-arms.mjs [--host=http://localhost:8000] [--arm-ticks=1200]
 *      [--clear-ticks=4000] [--settle=240] [--engage=48] [--margin=5] [--only=60] [--arms=sword,spear] [--include-fired] [--wait-for-box=<sec>]
 *      `--include-fired` also asks a lock the census FIRES on (a `cannot` side, each arm alone): the L53 pocket witness
 *
 * ⛓ RECORD, `--include-fired` (session tile-encounter-kill-arms, 2026-11-10, local box, headless logic-only; ARMS windows
 * rebuilds 0 throughout). Each latched kill lock's `cannot` pocket, every arm ALONE, `--margin=7 --arm-ticks=2400
 * --clear-ticks=1` (CLEAR/RETURN cut on purpose: they ask the room side, which this run does not; their FAIL rows are
 * that cut, not the instrument):
 *   | lock                          | pocket side | opens | shut (all 7)                                         | note
 *   | L53 lock@144,208 {53,2}       | N (L54)     | none  | none sword darksword spear ghostsword wand darkshield | spear + ghostsword kill 2 jellyfish
 *   |                               |             |       |                                                       | through the lock; puncher@144,104 never moves
 *   | L18 lock@144,112 {18,0}       | W           | none  | the same seven                                        | both spinners stand
 *   | L26 rocklock@112,208 {26,0}   | W           | none  | the same seven                                        | spear + ghostsword kill one
 *   |                               |             |       |                                                       | puncher; puncher@40,216 stands
 * No arm writes the flag from any of the three pockets, so `opens_from` leaves them out (the maze derivation's `cannot`).
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import {
    DIR_KEYS, armFlags, conditionHolds, countedClassesFromSource, passedLock, tilePath,
} from './probe-seedling-encounter-latch.mjs';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/**
 * The kill arms, each ALONE, as tape grants. The game's own item model: the dark sword re-skins the sword slot
 * (`Inventory.as:345`); the Ghost Sword replaces the sword and the spear slots (`Inventory.addItemsFromSave`), so its
 * arm holds all three; the dark shield bumps only while a shield is held (`Player.as:1141`, `shieldBump`).
 */
export const ARMS = Object.freeze({
    none: [],
    sword: ['sword'],
    darksword: ['sword', 'darksword'],
    spear: ['spear'],
    ghostsword: ['sword', 'spear', 'ghostsword'],
    wand: ['wand'],
    darkshield: ['shield', 'darkshield'],
});

/** The subjects: every census row that does not fire, no cross-level button opens, with a side that is not `clears`. */
export function armSubjects(rows, { includeFired = false } = {}) {
    return rows.filter((r) => (includeFired || !r.fires) && !/cross-level/.test(r.why ?? '') && r.sides.some((s) => s.verdict !== 'clears'));
}

/**
 * The point of a side's own tiles nearest a target, as the player's centre. The game reads the tile under
 * `(x, y + 1)` (`Player.as:434` `checkOffsetY = -originY + height - 2`, `:679`), so that CHECK point is kept `margin` px
 * inside each tile: a centre that lets it cross into a pit or water tile beside the side falls or drowns, and the fall
 * rebuilds the room. `tiles` = `[[x, y], …]`.
 */
export const PLAYER_CHECK_DY = 1;
export function standPoint(tiles, target, T = 16, margin = 5) {
    let best = null;
    for (const [x, y] of tiles) {
        const px = Math.max(x * T + margin, Math.min(target.x, (x + 1) * T - margin));
        const py = Math.max(y * T + margin - PLAYER_CHECK_DY, Math.min(target.y, (y + 1) * T - margin - PLAYER_CHECK_DY));
        const d = Math.hypot(px - target.x, py - target.y);
        if (!best || d < best.d) best = { x: px, y: py, d, tile: [x, y] };
    }
    return best;
}

/**
 * ONE STEP of an ARMS loop: the player (centre) stays in its side's tiles. Pure.
 *   · not at the stand point of the nearest live body (`standPoint`) → hold toward it (through the side's own tiles,
 *     `path`), a few ticks; unless that stand point is `blocked` (a move step toward it did not move the player: a
 *     Solid stands between, e.g. the lock tile over it), when it stands where it is;
 *   · there, and the body within `engage` px → tap the facing key one tick, then `primary`. One press a window of
 *     `attackTicks`, longer than the sword's double-press window (`Player.as:119` `slashTimerMax = 20`): a second
 *     press inside it is the DASH (`Player.as:784-789`), which carries the player off its stand point;
 *   · else wait.
 * `facing` = the key the player last faced (null = unknown); the step returns the facing it leaves.
 * Returns `{inputs, ticks, kind, target, facing}`.
 */
export function standStep({ player, bodies, tiles, path, facing = null, blocked = null, T = 16, engage = 48, tol = 1, attackTicks = 24, margin = 5 }) {
    const dist = (b) => Math.hypot(b.x - player.x, b.y - player.y);
    const target = [...bodies].sort((a, b) => dist(a) - dist(b))[0];
    const stand = standPoint(tiles, target, T, margin);
    const here = [Math.floor(player.x / T), Math.floor(player.y / T)];
    let goal = stand;
    if (here[0] !== stand.tile[0] || here[1] !== stand.tile[1]) {
        const route = path(here, stand.tile);
        if (route && route.length > 2) goal = { x: route[1][0] * T + T / 2, y: route[1][1] * T + T / 2 };
    }
    const [mx, my] = [goal.x - player.x, goal.y - player.y];
    const far = Math.max(Math.abs(mx), Math.abs(my));
    const stuck = !!blocked && Math.hypot(stand.x - blocked.x, stand.y - blocked.y) < 1;
    if (far > tol && !stuck) {
        const keys = [];
        if (Math.abs(mx) > tol) keys.push(mx > 0 ? 'right' : 'left');
        if (Math.abs(my) > tol) keys.push(my > 0 ? 'down' : 'up');
        // The walk covers up to about 2 px a tick and coasts: short holds, re-read after each.
        const ticks = Math.max(1, Math.min(4, Math.floor(far / 3)));
        return { inputs: keys.map((key) => ({ key, from: 0, to: ticks })), ticks: ticks + 4, kind: 'move', keys,
            facing: keys.length === 1 ? keys[0] : null, target: target.cls, stand: { x: stand.x, y: stand.y } };
    }
    if (dist(target) <= engage) {
        const [dx, dy] = [target.x - player.x, target.y - player.y];
        const key = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up');
        // Already facing it (the last tap or single-key walk): press without the tap, which would creep the player.
        const inputs = facing === key ? [{ key: 'primary', from: 0, to: 2 }]
            : [{ key, from: 0, to: 1 }, { key: 'primary', from: 1, to: 3 }];
        return { inputs, ticks: attackTicks, kind: 'attack', key, facing: key, target: target.cls };
    }
    return { inputs: [], ticks: attackTicks, kind: 'wait', facing, target: target.cls };
}

/** The tiles of the side a step INTO the lock starts from: a 4-neighbour flood over `walk(x, y)` from the cell behind it. */
export function sideTiles(start, walk) {
    const seen = new Map([[start.join(','), start]]);
    const queue = [start];
    while (queue.length) {
        const [x, y] = queue.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = `${x + dx},${y + dy}`;
            if (seen.has(k) || !walk(x + dx, y + dy)) continue;
            seen.set(k, [x + dx, y + dy]);
            queue.push([x + dx, y + dy]);
        }
    }
    return [...seen.values()];
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const ARM_TICKS = Number(arg('arm-ticks', '1200'));
    const CLEAR_TICKS = Number(arg('clear-ticks', '4000'));
    const SETTLE = Number(arg('settle', '240'));
    const ENGAGE = Number(arg('engage', '48'));
    const MARGIN = Number(arg('margin', '5'));
    const only = arg('only', '') ? new Set(arg('only', '').split(',').map(Number)) : null;
    const armNames = arg('arms', '') ? arg('arms', '').split(',') : Object.keys(ARMS);
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const { PIN_NAMES, parseTape, ITEM_PROPERTIES } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
    const ITEM_OF = Object.fromEntries(Object.entries(ITEM_PROPERTIES).map(([item, p]) => [p.property, item]));
    const P = await import(join(REPO, 'scripts/procgen/make-seedling-playthrough-rules.mjs'));
    const { ENEMY_CLASSES } = await import(join(REPO, 'frontend/modules/seedlingDemo/combat.js'));
    const T = P.PLAYTHROUGH_MAP.tile_size;
    const subjects = armSubjects(P.playthroughEncounterLocks(), { includeFired: process.argv.includes('--include-fired') }).filter((r) => !only || only.has(r.level));
    console.log(`PAGE: ${PAGE} · ${subjects.length} subject lock(s): ${subjects.map((r) => `L${r.level} ${r.at}`).join(' · ')}`);

    takeBoxLockOrExit({ name: 'probe-seedling-killlock-arms.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    check('the census leaves at least one lock with a side it does not settle', subjects.length > 0);
    const GAME_AS = join(REPO, 'vendor/seedling/src/Game.as');
    const fromSource = existsSync(GAME_AS) ? countedClassesFromSource(readFileSync(GAME_AS, 'utf8')) : null;
    const asQualified = (type) => `Enemies::${ENEMY_CLASSES[type]?.as3 ?? type}`;
    const modelBodies = (level) => (P.playthroughKillLocks.get(level)?.bodies ?? [])
        .map((b) => asQualified(b.at.split('@')[0])).sort();
    const counted = fromSource ?? [...new Set(subjects.flatMap((r) => modelBodies(r.level)))].sort();
    console.log(`COUNTED (${fromSource ? 'Game.as totalEnemies()' : 'the model: vendor/seedling absent'}): ${counted.join(' ')}`);
    if (!fromSource) console.log('NOTE: the model-vs-source body check needs vendor/seedling; it did not run');
    const tapeOf = (name, level, boot, inputs, persistence, items, ticks, seed = 1) => parseTape({
        tape_version: 8, game: 'seedling', name, description: 'probe-seedling-killlock-arms',
        boot: { level, ...boot }, noclip: false, noDamage: true, noHazards: [],
        grants: items.length ? [{ level, items }] : [], persistence, equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed, split: false }, seam: {}, tick_count: ticks, inputs,
    });
    // ⛔ EVERY ARM ON A FRESH PAGE; within an arm one page carries a CHAIN of continuation windows (same boot: `Bot.as`
    // `botStart` rebuilds the world only when the boot level or position differs from the live one). The mechanism and
    // its two caveats (the per-window persistence sweep, the gap frames) are the latch probe's.
    const logs = [];
    const session = async () => {
        const page = await browser.newPage();
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const bot = (name, a) => page.evaluate(([n, x]) => String(window.__swfBridge.game[n](x)), [name, a]);
        const botJson = async (name, a) => JSON.parse(await bot(name, a));
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i += 1) await page.waitForTimeout(250);
        await page.click('#btn-start');
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i += 1) await page.waitForTimeout(250);
        await assertLogicOnlyChannel(page);
        const play = async (tape) => {
            const loaded = await bot('botLoadTape', JSON.stringify(tape));
            if (loaded !== 'ok') throw new Error(`botLoadTape ${tape.name}: ${loaded}`);
            if (await bot('botStart') !== 'ok') throw new Error(`botStart ${tape.name}`);
            for (const deadline = Date.now() + 10 * 60 * 1000; ;) {
                const st = await botJson('botStatus');
                if (st.finished) break;
                if (st.error) throw new Error(`${tape.name}: ${st.error}`);
                if (Date.now() > deadline) throw new Error(`${tape.name}: deadline`);
                await page.waitForTimeout(tape.tick_count > 60 ? 500 : 30);
            }
            const drained = await botJson('botDrain');
            const st = await botJson('botStatus');
            return { ticks: drained.ticks ?? [], cleared: st.persistence_cleared ?? [],
                mobiles: (await botJson('botMobiles')).mobiles ?? [] };
        };
        return { play, close: () => page.close() };
    };
    const live = (r) => r.mobiles.filter((m) => counted.includes(m.cls) && !m.destroy);
    const round = (m) => `${m.cls.split('::').pop()}@${Math.round(m.x)},${Math.round(m.y)}`;
    try {
        for (const row of subjects) {
            const id = `L${row.level} ${row.at} {${row.level},${row.tag}}`;
            const level = P.PLAYTHROUGH_MAP.levels.find((l) => l.level === row.level);
            const grid = P.playthroughGridFor(level);
            const cellAt = (x, y) => (x < 0 || y < 0 || x >= grid.width || y >= grid.height ? null
                : grid.cells[(y - (grid.origin?.y ?? 0)) * grid.width + (x - (grid.origin?.x ?? 0))]);
            const lockTiles = new Set(row.tiles.map(([x, y]) => `${x},${y}`));
            const blocked = (x, y) => lockTiles.has(`${x},${y}`);
            const has = (cleared) => cleared.some((c) => Number(c.level) === row.level && Number(c.tag) === row.tag);
            const bodyTiles = (P.playthroughKillLocks.get(row.level)?.bodies ?? []).map((b) => {
                const [type, xy] = b.at.split('@');
                const [bx, by] = xy.split(',').map(Number);
                const c = ENEMY_CLASSES[type]?.ctor ?? { dx: 8, dy: 8 };
                return [Math.floor((bx + c.dx) / T), Math.floor((by + c.dy) / T)];
            });
            const geometry = (side) => {
                const { tile: [tx, ty], dir } = side.steps[0];
                const D = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[dir];
                return { dir, into: DIR_KEYS[dir], behind: [tx - D[0], ty - D[1]], lockPx: [tx * T, ty * T] };
            };
            const verdict = { lock: id, census: row.sides.map((s) => `${s.steps[0].dir}:${s.verdict}`), sides: [] };
            let rosterChecked = false;

            // ONE LOOP, every arm: booted behind the lock on `side`, holding `items`; the player keeps to the side's OWN tiles
            // for those flags (open cells, and a gated cell only when every condition holds: never a pit, water without
            // the conch, or the lock).
            const armRun = async (side, arm, items, budget) => {
                const g = geometry(side);
                const boot = { x: g.behind[0] * T, y: g.behind[1] * T };
                const flags = new Set(items.map((i) => ITEM_PROPERTIES[i].property));
                const walk = (x, y) => {
                    const cell = cellAt(x, y);
                    if (!cell || blocked(x, y) || ['wall', 'sink'].includes(cell.kind)) return false;
                    return cell.kind === 'open' || (cell.kind === 'gated' && (cell.conditions ?? []).every((c) => conditionHolds(c, flags)));
                };
                const tiles = sideTiles(g.behind, walk);
                const inSide = new Set(tiles.map(([x, y]) => `${x},${y}`));
                const path = (a, b) => tilePath(grid.width, grid.height, (x, y) => inSide.has(`${x},${y}`), a, b);
                const name = `l${row.level}-${row.tag}-${g.dir}-${arm}`;
                const S = await session();
                let w;
                let t = 0;
                let rebuilds = 0;
                let left = false;
                let facing = null;
                let moved = null;
                let blockedStand = null;
                let roster0 = [];
                const steps = { move: 0, attack: 0, wait: 0 };
                const kills = [];
                const trail = [];
                const px = [];
                const py = [];
                let wrote = false;
                let open = null;
                let final = [];
                let cleared = [];
                try {
                    w = await S.play(tapeOf(name, row.level, boot, [], [], items, 1));
                    roster0 = live(w).map(round);
                    if (fromSource && !rosterChecked) {
                        rosterChecked = true;
                        const game = live(w).map((m) => m.cls).sort();
                        check(`${id}: the model's counted bodies are the game's counted roster at boot`,
                            JSON.stringify(modelBodies(row.level)) === JSON.stringify(game), JSON.stringify({ model: modelBodies(row.level), game: roster0 }));
                    }
                    let alive = live(w).length;
                    for (; t < budget && live(w).length;) {
                        const me = w.ticks.at(-1);
                        if (me.level !== row.level) { left = true; break; }
                        px.push(me.x);
                        py.push(me.y);
                        // A move step that moved nothing: its stand point is blocked (until another stand point is asked for).
                        if (moved && Math.hypot(me.x - moved.x, me.y - moved.y) < 0.25) blockedStand = moved.stand;
                        const step = standStep({ player: me, bodies: live(w), tiles, path, facing, blocked: blockedStand, T, engage: ENGAGE, margin: MARGIN });
                        moved = step.kind === 'move' ? { x: me.x, y: me.y, stand: step.stand } : null;
                        facing = step.facing;
                        steps[step.kind] += 1;
                        if (trail.length < 48) trail.push([t, step.kind[0] + (step.keys ?? [step.key ?? '']).map((k) => k[0] ?? '').join(''), Math.round(me.x * 10) / 10, Math.round(me.y * 10) / 10]);
                        w = await S.play(tapeOf(name, row.level, boot, step.inputs, [], items, step.ticks, 0));
                        const first = w.ticks[0];
                        if (first && Math.hypot(first.x - me.x, first.y - me.y) > 6) rebuilds += 1;
                        t += step.ticks;
                        if (live(w).length < alive) {
                            kills.push({ t, left: live(w).length, at: [Math.round(w.ticks.at(-1).x), Math.round(w.ticks.at(-1).y)] });
                            alive = live(w).length;
                        }
                    }
                    final = live(w).map(round);
                    // SETTLE (idle: the lock's fade, `Lock.as:65-96`), then OPEN: hold INTO the lock and read whether the
                    // player passes its far edge. Both windows run whatever the roster, so "the lock stands" is read off
                    // the game too.
                    const settle = await S.play(tapeOf(name, row.level, boot, [], [], items, SETTLE, 0));
                    cleared = settle.cleared;
                    wrote = has(settle.cleared);
                    // Back to the cell behind the lock first (the loop may have left the player anywhere in the side).
                    const home = { cls: 'home', x: g.behind[0] * T + T / 2, y: g.behind[1] * T + T / 2 };
                    for (let i = 0, back = settle; i < 80; i += 1) {
                        const me = back.ticks.at(-1);
                        const step = standStep({ player: me, bodies: [home], tiles, path, T, engage: 0, margin: MARGIN });
                        if (step.kind !== 'move') break;
                        back = await S.play(tapeOf(name, row.level, boot, step.inputs, [], items, step.ticks, 0));
                    }
                    const walkT = 160;
                    const o = await S.play(tapeOf(name, row.level, boot, [{ key: g.into, from: 0, to: walkT }], [], items, walkT, 0));
                    const at = o.ticks.filter((p) => p.level === row.level);
                    open = at.length > 0 && passedLock(at.map((p) => p.y), at.map((p) => p.x), g.dir, g.lockPx, T);
                } finally {
                    await S.close();
                }
                const out = { lock: id, side: g.dir, sideVerdict: side.verdict, sideTiles: tiles.length, arm, grants: items, boot,
                    roster0, final, kills, ticks: t, steps, rebuilds, leftLevel: left,
                    player: px.length ? { xMin: Math.min(...px), xMax: Math.max(...px), yMin: Math.min(...py), yMax: Math.max(...py) } : null,
                    cleared, wrote, open, trail };
                console.log(`ROW ${JSON.stringify(out)}`);
                check(`${id}: ${arm === 'CLEAR' ? 'CLEAR' : 'ARMS'} ${g.dir}/${arm} — every window continued the live room, the player stayed in the level`,
                    rebuilds === 0 && !left, `rebuilds ${rebuilds}, left ${left}`);
                check(`${id}: ${arm === 'CLEAR' ? 'CLEAR' : 'ARMS'} ${g.dir}/${arm} — the roster, the flag and the lock agree (${wrote ? 'empty, written, open' : 'standing, not written, shut'})`,
                    wrote === open && (final.length === 0) === wrote, JSON.stringify({ final, wrote, open }));
                return out;
            };

            // ── ARMS: per side the census did not settle, per arm alone ─────────────────────────────────────────
            for (const side of row.sides.filter((s) => s.verdict !== 'clears')) {
                const opens = [];
                for (const arm of armNames) {
                    if (!ARMS[arm]) throw new Error(`unknown arm ${arm}; know ${Object.keys(ARMS)}`);
                    if ((await armRun(side, arm, ARMS[arm], ARM_TICKS)).wrote) opens.push(arm);
                }
                verdict.sides.push({ dir: side.steps[0].dir, census: side.verdict, opens, shut: armNames.filter((a) => !opens.includes(a)) });
            }

            // ── CLEAR per `clears` side (the same loop; grants: the sword, plus the flags a gated cell on the route to
            // a body asks for, `armFlags`), then RETURN from every other side holding only the game's flag ──────────
            for (const side of row.sides.filter((s) => s.verdict === 'clears')) {
                const g = geometry(side);
                const needFlags = armFlags({ width: grid.width, height: grid.height, cellAt: (x, y) => cellAt(x, y), blocked,
                    from: g.behind, bodies: bodyTiles, base: new Set(['hasSword']) });
                const grants = ['sword', ...needFlags.map((f) => ITEM_OF[f]).filter(Boolean)];
                const clear = await armRun(side, 'CLEAR', grants, CLEAR_TICKS);
                check(`${id}: CLEAR ${g.dir} — game combat from the side the census says clears empties the roster and the GAME writes {${row.level},${row.tag}}`,
                    clear.final.length === 0 && clear.wrote, JSON.stringify({ kills: clear.kills, cleared: clear.cleared }));
                for (const other of row.sides.filter((s) => s !== side)) {
                    const o = geometry(other);
                    const from = { x: o.behind[0] * T, y: o.behind[1] * T };
                    const TICKS = 600;
                    let ret = null;
                    if (clear.wrote) {
                        const R = await session();
                        try {
                            ret = await R.play(tapeOf(`l${row.level}-${row.tag}-${o.dir}-return`, row.level, from,
                                [{ key: o.into, from: 0, to: TICKS }], [{ level: row.level, tag: row.tag, note: 'written by the CLEAR arm (game)' }], [], TICKS));
                        } finally {
                            await R.close();
                        }
                    }
                    const at = (ret?.ticks ?? []).filter((p) => p.level === row.level);
                    const passed = at.length > 0 && passedLock(at.map((p) => p.y), at.map((p) => p.x), o.dir, o.lockPx, T);
                    console.log(`ROW ${JSON.stringify({ lock: id, side: o.dir, arm: 'RETURN', boot: from, persistence: clear.wrote ? [[row.level, row.tag]] : [],
                        last: at.at(-1) ?? null, n: at.length, passed })}`);
                    check(`${id}: RETURN ${o.dir} — holding only the flag the game wrote, nothing granted, the crossing walks through the lock`,
                        passed, JSON.stringify(at.at(-1) ?? null));
                }
            }
            console.log(`VERDICT ${JSON.stringify(verdict)}`);
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.stack ?? e.message).split('\n').slice(0, 3).join(' | '));
    } finally {
        await browser.close();
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
