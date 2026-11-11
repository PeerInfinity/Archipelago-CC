#!/usr/bin/env node
/**
 * Seedling ENCOUNTER-LOCK LATCH, THE GAME'S WAY (rules `rules-l26-rocklock-pocket`). The rules now price a kill-lock
 * (`tSet == -1`: opens on `Game.totalEnemies() == 0`, `RockLock.as:52` / `Lock.as:111`) that one side cannot clear as
 * an EVENT on that side (`seedlingObstacleEvents.encounterLockSides`): the pocket's crossing needs
 * `L<n> flag <tag>: <class>@x,y cleared`, collected on the room side. That is honest only if the lock STAYS open once
 * cleared, so a later entry from the pocket finds it open. This asks the wasm game, per lock the producer's census
 * FIRES on (`playthroughEncounterLocks`, never listed by hand) — first checking that the shipped rules carry its event
 * (`seedling_playthrough` AP_1, by `encounterEventsOf`), on the side the census says clears it — with the pocket cell
 * and the step direction read off the census (the `cannot` side's step into the lock):
 *
 *   BARE    booted in the POCKET, no flag, every kill arm granted (sword, spear, wand, dark shield), holding INTO the
 *           lock and pressing `primary` on a cadence: the lock stands (the player never passes its far edge) and the
 *           game writes no `{level, tag}` — the room is never cleared from the pocket;
 *   CLEAR   booted in the ROOM beside the lock, a CLOSED LOOP of short continuation windows on one live page
 *           (`clearStep`): walk to the nearest body the lock COUNTS (`Game.totalEnemies()`, read off the game source,
 *           `countedClassesFromSource`), face it, press `primary`, until the game's roster is empty. Granted: the
 *           sword, plus the flags a gated cell on the route to a body asks for (`armFlags`: L53's water → the conch).
 *           Then the GAME must WRITE `{level, tag}` (`RockLock.as:65`, `Lock.turnOff` `Lock.as:96`) — a FAIL if not.
 *           Every window with a successor HOLDS the room (`heldWindow`: the build's `hold` capability), so no frame
 *           runs between two windows and the arm is the same arm on every machine — a check of its own.
 *           Staged: boot, grants, inputs. Never the flag, a kill count, a body;
 *   BUILT   booted in the POCKET with the event's own flag staged as persistence, nothing granted, holding INTO the
 *           lock: the game BUILDS it open (`RockLock.check` `RockLock.as:34-37`, `Lock.check` `Lock.as:42`) and the
 *           player walks past its far edge;
 *   RETURN  as BUILT, with exactly the flag CLEAR read back from the game (a FAIL when CLEAR wrote none).
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. A run with no fired lock
 * FAILS (the subject moved). Prereqs: a dev server at the repo root (`--host=`, default
 * http://localhost:8000); the wasm build, or SKIP. Takes the box lock. Headless LOGIC-ONLY (proved,
 * `CHANNEL: headless logic-only`), so it runs in CI too (`.github/workflows/seedling-probe.yml`).
 *
 * Run: node scripts/procgen/probe-seedling-encounter-latch.mjs [--host=http://localhost:8000] [--ticks=600]
 *      [--clear-ticks=4000] [--settle=240] [--only=26] [--wait-for-box=<sec>]
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

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/** The step directions, as the census names them, to a held key. */
export const DIR_KEYS = Object.freeze({ N: 'up', E: 'right', S: 'down', W: 'left' });

/**
 * The encounter events of a rules document: every event location whose obstacle is a `tset -1` lock placed in
 * `map` — `{level, tag, cls, x, y, name, side, across}`.
 */
export function encounterEventsOf(rules, map) {
    const out = [];
    for (const region of Object.values(rules.regions?.['1'] ?? {})) {
        for (const loc of region.locations ?? []) {
            const o = loc.obstacle;
            if (!loc.event || loc.event_kind !== 'game_state' || !o) continue;
            const e = map.levels.find((l) => l.level === o.level)?.entities
                ?.find((x) => x.type === o.class && x.x === o.x && x.y === o.y);
            if (!e || Number(e.attrs?.tset) !== -1) continue;
            out.push({ level: o.level, tag: o.tag, cls: o.class, x: o.x, y: o.y, name: loc.name, side: loc.side, across: loc.across });
        }
    }
    return out.sort((a, b) => a.level - b.level);
}

/**
 * The classes a kill-lock COUNTS, read off the game SOURCE: the `classCount(X)` terms of `Game.totalEnemies()`
 * (`vendor/seedling/src/Game.as`). FlashPunk's `classCount` is keyed by the EXACT class (`World.as` `_classCount[e._class]`),
 * so a subclass not named there (`IceTrap`) is not counted, even though `classCount(Enemy)` is. Returns the qualified
 * names `botMobiles()` reports (`Enemies::Jellyfish`), or null when the source is absent.
 */
export function countedClassesFromSource(gameAs) {
    const body = /function\s+totalEnemies\s*\(\)[^{]*\{([\s\S]*?)\n\s*\}/.exec(gameAs ?? '')?.[1];
    if (!body) return null;
    const names = [...body.replace(/\/\/.*$/gm, '').matchAll(/classCount\((\w+)\)/g)].map((m) => `Enemies::${m[1]}`);
    return names.length ? [...new Set(names)].sort() : null;
}

/**
 * ONE STEP of the CLEAR arm's closed loop: given the player's centre, its last move, and the live counted bodies (the
 * game's `botMobiles()` rows), the next chunk of inputs from tick `t`. Pure.
 *   · a body inside the sword's slash box (`Player.getSlashRect`: 16 px along the facing, ±16 across; the press tests
 *     the body's hitbox, so a few px of slack) → tap the facing key for one tick, then `primary`;
 *   · else hold the key(s) toward the next waypoint of `path(from, to)` (tile centres; the body's own tile when none);
 *   · a move chunk that STALLED (`moveStalled`: no progress along the route's step — a breakable rock is the next cell)
 *     → press `primary` facing the step.
 * Returns `{inputs, ticks, kind, target}`; a move also carries `keys` and `step`, the key of the route's next step
 * (null when the route has none: the body's own tile).
 */
export function clearStep({ t, player, bodies, path, lastMove, T = 16, reach = 20, across = 14, moveTicks = 8 }) {
    const dist = (b) => Math.hypot(b.x - player.x, b.y - player.y);
    const target = [...bodies].sort((a, b) => dist(a) - dist(b))[0];
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const axisKey = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up');
    const along = Math.max(Math.abs(dx), Math.abs(dy));
    const off = Math.min(Math.abs(dx), Math.abs(dy));
    const press = (key) => ({
        inputs: [{ key, from: t, to: t + 1 }, { key: 'primary', from: t + 1, to: t + 3 }], ticks: 12, kind: 'attack', key,
    });
    if (along <= reach && off <= across) return { ...press(axisKey), target: target.cls };
    if (lastMove && lastMove.stuck) return { ...press(lastMove.step ?? lastMove.keys[0]), kind: 'break', target: target.cls };
    const tile = (p) => [Math.floor(p.x / T), Math.floor(p.y / T)];
    const route = path(tile(player), tile(target)) ?? [];
    const [wx, wy] = route.length > 1 ? [route[1][0] * T + T / 2, route[1][1] * T + T / 2] : [target.x, target.y];
    const keys = [];
    if (Math.abs(wx - player.x) > 1) keys.push(wx > player.x ? 'right' : 'left');
    if (Math.abs(wy - player.y) > 1) keys.push(wy > player.y ? 'down' : 'up');
    if (!keys.length) keys.push(axisKey);
    const [sx, sy] = route.length > 1 ? [route[1][0] - route[0][0], route[1][1] - route[0][1]] : [0, 0];
    const step = Object.keys(STEP_OF).find((key) => STEP_OF[key][0] === sx && STEP_OF[key][1] === sy) ?? null;
    return { inputs: keys.map((key) => ({ key, from: t, to: t + moveTicks })), ticks: moveTicks, kind: 'move', keys, step,
        target: target.cls };
}

/** A held key's unit step, in tiles (and pixels). */
const STEP_OF = Object.freeze({ right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] });

/**
 * Did a move window STALL? `last` is the move as it started (`{x, y, step}`: the player then, and the key of the
 * route's next step), `now` the player after it. With a step, the measure is PROGRESS ALONG IT: under one pixel is a
 * stall, however far the player went sideways. (The total displacement is the wrong measure: held against a rock, the
 * player still slides along it toward the waypoint's other coordinate, overshoots it, and comes back the next window —
 * a walk that never stops and never arrives.) With no step, any displacement under one pixel. Pure.
 */
export function moveStalled(last, now) {
    const [ax, ay] = STEP_OF[last.step] ?? [0, 0];
    const dx = now.x - last.x;
    const dy = now.y - last.y;
    return last.step ? dx * ax + dy * ay < 1 : Math.hypot(dx, dy) < 1;
}

/** A 4-neighbour BFS over `passable(x, y)` tiles: the tile path `[from, …, to]`, or null. */
export function tilePath(width, height, passable, [fx, fy], [gx, gy]) {
    const key = (x, y) => y * width + x;
    const prev = new Map([[key(fx, fy), null]]);
    const queue = [[fx, fy]];
    while (queue.length) {
        const [x, y] = queue.shift();
        if (x === gx && y === gy) {
            const out = [];
            for (let k = key(x, y); k !== null; k = prev.get(k)) out.unshift([k % width, Math.floor(k / width)]);
            return out;
        }
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + ax;
            const ny = y + ay;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height || prev.has(key(nx, ny))) continue;
            if (!(nx === gx && ny === gy) && !passable(nx, ny)) continue;
            prev.set(key(nx, ny), key(x, y));
            queue.push([nx, ny]);
        }
    }
    return null;
}

/** Does a grid cell's gate condition (`{flag}` / `{any}` / `{all}`) hold for the flag set? */
export function conditionHolds(c, flags) {
    if (c?.flag) return flags.has(c.flag);
    if (c?.any) return c.any.some((x) => conditionHolds(x, flags));
    if (c?.all) return c.all.every((x) => conditionHolds(x, flags));
    return false;
}

/**
 * The flags a CLEAR arm must hold to walk the room to its bodies: route from `from` to each body tile over every
 * non-wall cell (`cellAt(x, y)` → a grid cell), and for each GATED cell on the route whose conditions the `base` flags do
 * not meet, take the condition's flag (an `any`'s first). Sorted. Pure — the arm's grants are derived, not listed.
 */
export function armFlags({ width, height, cellAt, blocked, from, bodies, base }) {
    const open = (x, y) => !blocked(x, y) && !['wall', 'sink'].includes(cellAt(x, y)?.kind ?? 'wall');
    const need = new Set();
    const first = (c) => c.flag ?? (c.any ?? c.all ?? []).map(first).find(Boolean) ?? null;
    for (const b of bodies) {
        for (const [x, y] of tilePath(width, height, open, from, b) ?? []) {
            const cell = cellAt(x, y);
            if (cell?.kind !== 'gated') continue;
            for (const c of cell.conditions ?? []) {
                if (!conditionHolds(c, base)) {
                    const f = first(c);
                    if (f) need.add(f);
                }
            }
        }
    }
    return [...need].sort();
}

/** Did a run's player pass the lock tile's FAR edge moving `dir`? (tile pixels `[px, py]`, size `T`) */
export function passedLock(ys, xs, dir, [px, py], T) {
    if (dir === 'W') return Math.min(...xs) < px;
    if (dir === 'E') return Math.max(...xs) > px + T;
    if (dir === 'N') return Math.min(...ys) < py;
    return Math.max(...ys) > py + T;
}

/**
 * A CLEAR-arm window that HAS a successor, as the game is to be handed it. On a build declaring the `hold` capability
 * the window is stamped `hold: true` (`tapeFormat.holdingWindowTape`, projected by `gameVisibleTape` — the director's
 * own two calls), so the game FREEZES the room at the window's last tick until the next `botStart`. Without it the
 * room steps on every wall-clock frame the page spends between two windows, and the closed loop's next decision is
 * taken on a room that has moved on by a number of frames the machine's load picks. On a build that cannot hold, the
 * tape is returned untouched (the loader would refuse tape_version 12). Pure.
 */
export function heldWindow(tape, { capable, holdingWindowTape, gameVisibleTape }) {
    return capable ? gameVisibleTape(holdingWindowTape(tape)) : tape;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const TICKS = Number(arg('ticks', '600'));
    const CLEAR_TICKS = Number(arg('clear-ticks', '4000'));
    const SETTLE = Number(arg('settle', '240'));
    const only = arg('only', '') ? new Set(arg('only', '').split(',').map(Number)) : null;
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const { PIN_NAMES, parseTape, ITEM_PROPERTIES, holdingWindowTape, gameVisibleTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
    // Can this build HOLD the room between two windows? Read from the manifest's `capabilities`, never from its name.
    const { holdCapabilityOf } = await import(join(REPO, 'frontend/modules/seedlingDemo/watchWasm.js'));
    const HOLD = holdCapabilityOf(JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/wasm/builds.json'), 'utf8')),
        `../flashPanel/wasm/${PAGE}/game.html`);
    const held = (tape) => heldWindow(tape, { capable: HOLD.capable, holdingWindowTape, gameVisibleTape });
    const ITEM_OF = Object.fromEntries(Object.entries(ITEM_PROPERTIES).map(([item, p]) => [p.property, item]));
    const P = await import(join(REPO, 'scripts/procgen/make-seedling-playthrough-rules.mjs'));
    const { ENEMY_CLASSES } = await import(join(REPO, 'frontend/modules/seedlingDemo/combat.js'));
    const T = P.PLAYTHROUGH_MAP.tile_size;
    const RULES = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
    const events = new Map(encounterEventsOf(RULES, P.PLAYTHROUGH_MAP).map((k) => [`${k.level}:${k.tag}`, k]));
    const fired = P.playthroughEncounterLocks().filter((r) => r.fires && (!only || only.has(r.level)));
    console.log(`HOLD: ${HOLD.why} — the CLEAR arm's windows ${HOLD.capable ? 'hold the room between them' : 'CANNOT hold the room: it runs free between them'}`);
    console.log(`PAGE: ${PAGE} · ${fired.length} fired encounter lock(s): ${fired.map((r) => r.name).join(' · ')}`);

    takeBoxLockOrExit({ name: 'probe-seedling-encounter-latch.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    check('the census fires on at least one encounter lock', fired.length > 0);
    // The counted classes: the game SOURCE's `totalEnemies()` when the Seedling source is checked out, else the model's
    // own ruling (then the model-vs-source check cannot run, and says so).
    const GAME_AS = join(REPO, 'vendor/seedling/src/Game.as');
    const fromSource = existsSync(GAME_AS) ? countedClassesFromSource(readFileSync(GAME_AS, 'utf8')) : null;
    const asQualified = (type) => `Enemies::${ENEMY_CLASSES[type]?.as3 ?? type}`;
    const modelBodies = (level) => (P.playthroughKillLocks.get(level)?.bodies ?? [])
        .map((b) => asQualified(b.at.split('@')[0])).sort();
    const counted = fromSource ?? [...new Set(fired.flatMap((r) => modelBodies(r.level)))].sort();
    console.log(`COUNTED (${fromSource ? 'Game.as totalEnemies()' : 'the model: vendor/seedling absent'}): ${counted.join(' ')}`);
    if (!fromSource) console.log('NOTE: the model-vs-source body check needs vendor/seedling; it did not run');
    const tapeOf = (name, level, boot, inputs, persistence, items, ticks, seed = 1) => parseTape({
        tape_version: 8, game: 'seedling', name, description: 'probe-seedling-encounter-latch',
        boot: { level, ...boot }, noclip: false, noDamage: true, noHazards: [],
        grants: items.length ? [{ level, items }] : [], persistence, equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed, split: false }, seam: {}, tick_count: ticks, inputs,
    });
    // `primary` pressed for 2 ticks every 24 (a press is an edge: `Input.pressed`), over `ticks`.
    const presses = (ticks, every = 24) => Array.from({ length: Math.floor(ticks / every) }, (_, i) => (
        { key: 'primary', from: i * every, to: i * every + 2 }));

    // ⛔ EVERY ARM ON A FRESH PAGE: nothing a tape leaves on a page (statics, the save object) can reach the next arm.
    // Within the CLEAR arm, one page carries a CHAIN of windows: `botStart` builds a new world only when the tape's
    // boot level or position differs from the live one (`Bot.as` `botStart`: `if (bootLevel != Main.level ||
    // !atBootPosition()) new Game(...)`), so a window declaring the same boot CONTINUES the live room — the director's
    // continuations, by design. Its persistence sweep runs every window; nothing the arm reads is written before the
    // last window (below).
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
                gameTime: st.game_time ?? null, held: st.held === true, mobiles: (await botJson('botMobiles')).mobiles ?? [] };
        };
        return { play, close: () => page.close() };
    };
    const run = async (tape) => {
        const s = await session();
        try { return await s.play(tape); } finally { await s.close(); }
    };
    try {
        for (const row of fired) {
            const id = `L${row.level} ${row.cls}@${row.x},${row.y} {${row.level},${row.tag}}`;
            const k = events.get(`${row.level}:${row.tag}`);
            check(`${id}: the shipped rules carry its event "${row.name}" (a latch: ${row.latch})`, !!k && k.name === row.name,
                JSON.stringify(k ?? null));
            if (!k) continue;
            const cannot = row.sides.find((s) => s.verdict === 'cannot');
            const { tile: [tx, ty], dir } = cannot.steps[0];
            const D = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[dir];
            const pocket = { x: (tx - D[0]) * T, y: (ty - D[1]) * T };
            const room = { x: (tx + D[0]) * T, y: (ty + D[1]) * T };
            const lockPx = [tx * T, ty * T];
            const into = DIR_KEYS[dir];
            const flag = [{ level: k.level, tag: k.tag, note: `the rules' event ${k.name}` }];
            const has = (cleared) => cleared.some((c) => Number(c.level) === k.level && Number(c.tag) === k.tag);
            const at = (r) => r.ticks.filter((o) => o.level === k.level);
            const summary = (r) => {
                const o = at(r);
                return { n: o.length, xMin: Math.min(...o.map((p) => p.x)), xMax: Math.max(...o.map((p) => p.x)),
                    yMin: Math.min(...o.map((p) => p.y)), yMax: Math.max(...o.map((p) => p.y)), last: o.at(-1), wrote: has(r.cleared) };
            };
            const passed = (r) => passedLock(at(r).map((o) => o.y), at(r).map((o) => o.x), dir, lockPx, T);
            const arms = ['sword', 'spear', 'wand', 'darkshield'];
            const bare = await run(tapeOf(`l${k.level}-${k.tag}-bare`, k.level, pocket,
                [{ key: into, from: 0, to: TICKS }, ...presses(TICKS)], [], arms, TICKS));
            const built = await run(tapeOf(`l${k.level}-${k.tag}-built`, k.level, pocket,
                [{ key: into, from: 0, to: TICKS }], flag, [], TICKS));
            // CLEAR, CLOSED LOOP, ON ONE LIVE PAGE: booted in the ROOM beside the lock (grants: `armFlags`). Each WINDOW is a
            // short continuation tape (same boot: no rebuild; the rng seeded in the first window only); after it the
            // probe reads the game's roster of the bodies the lock COUNTS (`botMobiles`) and the player, and picks the
            // next window (`clearStep`): walk to the nearest, face it, press. When the game's roster is empty, one last
            // window of `SETTLE` idle ticks (the lock fades 0.01 alpha a tick before `turnOff` writes the flag,
            // `Lock.as:65-96`), and the probe reads what the game wrote there. Nothing is staged but the boot, the
            // grants and the inputs: no flag, no kill count, no body removed.
            // ⛔ EVERY WINDOW WITH A SUCCESSOR HOLDS THE ROOM (`heldWindow`): the game freezes at the window's last tick
            // until the next `botStart`, so the roster the probe reads IS the room the next window starts in. Free-running,
            // the room stepped ~2 frames per window on the wall clock (the page's own time between two tapes), a count
            // the machine's load picks: the same arm then killed in a different order, walked out of the level (a
            // rebuild) or never stalled against L53's rock. `gapFrames` counts those frames and must be 0; `unheld`
            // counts the windows the game did not report held. The SETTLE window has no successor and does not hold.
            // ⚠ Every window's `botStart` re-sweeps the persistence TABLE to the fresh start (`Bot.as`, RULING 25), so a
            // write in an earlier window (L53's breakable rock, a Spinner's `setPersistence(-1)` aliasing to
            // `{level-1, 29}`) is not read back; the lock's own write lands in the SETTLE window (its fade outlasts a
            // window), which is the one the arm reads.
            const level = P.PLAYTHROUGH_MAP.levels.find((l) => l.level === k.level);
            const grid = P.playthroughGridFor(level);
            const lockTiles = new Set(row.tiles.map(([x, y]) => `${x},${y}`));
            const cellAt = (x, y) => grid.cells[(y - (grid.origin?.y ?? 0)) * grid.width + (x - (grid.origin?.x ?? 0))];
            const blocked = (x, y) => lockTiles.has(`${x},${y}`);
            // THE ARM'S GRANTS, DERIVED: the sword, plus every flag a gated cell (water, a breakable rock) on the route
            // from the room to a counted body asks for and the sword does not give.
            const bodyTiles = (P.playthroughKillLocks.get(k.level)?.bodies ?? []).map((b) => {
                const [type, xy] = b.at.split('@');
                const [bx, by] = xy.split(',').map(Number);
                const c = ENEMY_CLASSES[type]?.ctor ?? { dx: 8, dy: 8 };
                return [Math.floor((bx + c.dx) / T), Math.floor((by + c.dy) / T)];
            });
            const base = new Set(['hasSword']);
            const needFlags = armFlags({ width: grid.width, height: grid.height, cellAt, blocked,
                from: [room.x / T, room.y / T], bodies: bodyTiles, base });
            const grants = ['sword', ...needFlags.map((f) => ITEM_OF[f]).filter(Boolean)];
            const flags = new Set([...base, ...needFlags]);
            const walkable = (x, y) => {
                const cell = cellAt(x, y);
                if (blocked(x, y) || ['wall', 'sink'].includes(cell?.kind ?? 'wall')) return false;
                // A gate the sword breaks (a rock) is walked INTO and broken (`clearStep`'s stalled press); any other gate
                // is walkable only with its flag granted.
                return cell.kind !== 'gated' || (cell.conditions ?? []).every((c) => conditionHolds(c, flags));
            };
            const path = (a, b) => tilePath(grid.width, grid.height, walkable, a, b);
            const live = (r) => r.mobiles.filter((m) => counted.includes(m.cls) && !m.destroy);
            const S = await session();
            const name = `l${k.level}-${k.tag}-clear`;
            let w = null;
            let clear;
            let t = 0;
            let lastMove = null;
            let rebuilds = 0;
            let gapFrames = 0;
            let unheld = 0;
            let windows = 0;
            let pressCount = 0;
            let counted0 = [];
            const steps = { move: 0, attack: 0, break: 0 };
            const kills = [];
            const trail = [];
            try {
                w = await S.play(held(tapeOf(name, k.level, room, [], [], grants, 1)));
                if (!w.held) unheld += 1;
                const roster0 = live(w).map((m) => ({ cls: m.cls, x: Math.round(m.x), y: Math.round(m.y) }));
                counted0 = roster0;
                let alive = roster0.length;
                for (; t < CLEAR_TICKS && live(w).length;) {
                    const me = w.ticks.at(-1);
                    if (lastMove) lastMove.stuck = moveStalled(lastMove, me);
                    const step = clearStep({ t: 0, player: me, bodies: live(w), path, lastMove });
                    steps[step.kind] += 1;
                    pressCount += step.inputs.filter((i) => i.key === 'primary').length;
                    lastMove = step.kind === 'move' ? { x: me.x, y: me.y, keys: step.keys, step: step.step } : null;
                    if (trail.length < 400) trail.push([t, step.kind[0], Math.round(me.x), Math.round(me.y)]);
                    const before = w;
                    w = await S.play(held(tapeOf(name, k.level, room, step.inputs, [], grants, step.ticks, 0)));
                    windows += 1;
                    if (!w.held) unheld += 1;
                    // A window that did not continue the live room (a rebuild) restarts at the boot: the player jumps.
                    const first = w.ticks[0];
                    if (first && Math.hypot(first.x - me.x, first.y - me.y) > 6) rebuilds += 1;
                    if (before.gameTime !== null && w.gameTime !== null) gapFrames += Math.max(0, w.gameTime - before.gameTime - step.ticks);
                    t += step.ticks;
                    if (live(w).length < alive) {
                        kills.push({ t, left: live(w).length, at: [Math.round(w.ticks.at(-1).x), Math.round(w.ticks.at(-1).y)] });
                        alive = live(w).length;
                    }
                }
                clear = live(w).length ? w : await S.play(tapeOf(name, k.level, room, [], [], grants, SETTLE, 0));
            } finally {
                await S.close();
            }
            const killedAt = live(w).length ? null : t;
            const clearRow = { staged: { boot: room, grants, derivedFlags: needFlags, persistence: [] }, counted: counted0,
                rosterLeft: live(clear).map((m) => `${m.cls}@${Math.round(m.x)},${Math.round(m.y)}`), killedAt, kills,
                ticks: killedAt === null ? t : t + SETTLE, windows, steps, presses: pressCount, rebuilds, gapFrames, unheld,
                trail: trail.slice(0, 60) };
            if (fromSource) {
                const model = modelBodies(k.level);
                const game = counted0.map((b) => b.cls).sort();
                check(`${id}: the model's counted bodies (${model.join(', ')}) are the game's counted roster at boot`,
                    JSON.stringify(model) === JSON.stringify(game), JSON.stringify({ model, game: counted0 }));
            }
            check(`${id}: CLEAR — every window continued the live room (no rebuild)`, rebuilds === 0, `rebuilds ${rebuilds}`);
            if (HOLD.capable) {
                check(`${id}: CLEAR — the room was HELD between the windows (the game reports every hold; no frame ran free)`,
                    gapFrames === 0 && unheld === 0, `gapFrames ${gapFrames}, unheld ${unheld} of ${windows + 1}`);
            }
            check(`${id}: CLEAR — game combat from the room empties the counted roster`, killedAt !== null,
                JSON.stringify(clearRow));
            const written = clear.cleared.filter((c) => Number(c.level) === k.level && Number(c.tag) === k.tag)
                .map((c) => ({ level: Number(c.level), tag: Number(c.tag), note: 'written by the CLEAR arm (game)' }));
            const ret = written.length ? await run(tapeOf(`l${k.level}-${k.tag}-return`, k.level, pocket,
                [{ key: into, from: 0, to: TICKS }], written, [], TICKS)) : null;
            console.log(`ROW ${JSON.stringify({
                lock: id, event: k.name, side: k.side, across: k.across, dir, pocket, room,
                bare: summary(bare), built: summary(built),
                clear: { ...summary(clear), ...clearRow, cleared: clear.cleared }, ret: ret && summary(ret),
            })}`);
            check(`${id}: BARE — from the pocket, every kill arm granted, the lock stands and the game writes no flag`,
                !passed(bare) && !has(bare.cleared), JSON.stringify(summary(bare)));
            check(`${id}: BUILT — the event's flag staged, the game builds it open and the player walks through from the pocket`,
                passed(built), JSON.stringify(summary(built)));
            // The lock's OPENING is the write: `Lock.turnOff` / `RockLock` clear `type` and call
            // `Game.setPersistence(tag, false)` in the same step, and nothing else writes that tag on this level.
            check(`${id}: CLEAR — the room cleared, the GAME wrote the event's flag {${k.level},${k.tag}} (the lock opened; the probe staged no flag)`,
                written.length > 0, JSON.stringify(clear.cleared));
            check(`${id}: RETURN — holding only the flag the game wrote, the pocket's crossing walks through the lock`,
                !!ret && passed(ret), JSON.stringify(ret && summary(ret)));
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
