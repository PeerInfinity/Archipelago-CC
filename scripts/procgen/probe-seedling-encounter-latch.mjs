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
 *   CLEAR   booted in the ROOM beside the lock, the sword granted, alternating facing and pressing `primary`: a ROW
 *           (not a FAIL) — when the counted bodies die, the lock fades and the game WRITES `{level, tag}`
 *           (`RockLock.as:65`, `Lock.turnOff` `Lock.as:96`);
 *   BUILT   booted in the POCKET with the event's own flag staged as persistence, nothing granted, holding INTO the
 *           lock: the game BUILDS it open (`RockLock.check` `RockLock.as:34-37`, `Lock.check` `Lock.as:42`) and the
 *           player walks past its far edge;
 *   RETURN  as BUILT, with exactly the flag CLEAR read back from the game (run only when CLEAR wrote it).
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. A run with no fired lock
 * FAILS (the subject moved). Prereqs: a dev server at the repo root (`--host=`, default
 * http://localhost:8000); the wasm build, or SKIP. Takes the box lock. Headless LOGIC-ONLY (proved,
 * `CHANNEL: headless logic-only`), so it runs in CI too (`.github/workflows/seedling-probe.yml`).
 *
 * Run: node scripts/procgen/probe-seedling-encounter-latch.mjs [--host=http://localhost:8000] [--ticks=600]
 *      [--clear-ticks=1800] [--only=26] [--wait-for-box=<sec>]
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

/** Did a run's player pass the lock tile's FAR edge moving `dir`? (tile pixels `[px, py]`, size `T`) */
export function passedLock(ys, xs, dir, [px, py], T) {
    if (dir === 'W') return Math.min(...xs) < px;
    if (dir === 'E') return Math.max(...xs) > px + T;
    if (dir === 'N') return Math.min(...ys) < py;
    return Math.max(...ys) > py + T;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const TICKS = Number(arg('ticks', '600'));
    const CLEAR_TICKS = Number(arg('clear-ticks', '1800'));
    const only = arg('only', '') ? new Set(arg('only', '').split(',').map(Number)) : null;
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const { PIN_NAMES, parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
    const P = await import(join(REPO, 'scripts/procgen/make-seedling-playthrough-rules.mjs'));
    const T = P.PLAYTHROUGH_MAP.tile_size;
    const RULES = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
    const events = new Map(encounterEventsOf(RULES, P.PLAYTHROUGH_MAP).map((k) => [`${k.level}:${k.tag}`, k]));
    const fired = P.playthroughEncounterLocks().filter((r) => r.fires && (!only || only.has(r.level)));
    console.log(`PAGE: ${PAGE} · ${fired.length} fired encounter lock(s): ${fired.map((r) => r.name).join(' · ')}`);

    takeBoxLockOrExit({ name: 'probe-seedling-encounter-latch.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    check('the census fires on at least one encounter lock', fired.length > 0);
    const tapeOf = (name, level, boot, inputs, persistence, items, ticks) => parseTape({
        tape_version: 8, game: 'seedling', name, description: 'probe-seedling-encounter-latch',
        boot: { level, ...boot }, noclip: false, noDamage: true, noHazards: [],
        grants: items.length ? [{ level, items }] : [], persistence, equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 1, split: false }, seam: {}, tick_count: ticks, inputs,
    });
    // `primary` pressed for 2 ticks every 24 (a press is an edge: `Input.pressed`), over `ticks`.
    const presses = (ticks, every = 24) => Array.from({ length: Math.floor(ticks / every) }, (_, i) => (
        { key: 'primary', from: i * every, to: i * every + 2 }));

    // ⛔ EVERY TAPE ON A FRESH PAGE: nothing a tape leaves on a page (statics, the save object) can reach the next.
    const logs = [];
    const run = async (tape) => {
        const page = await browser.newPage();
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const bot = (name, a) => page.evaluate(([n, x]) => String(window.__swfBridge.game[n](x)), [name, a]);
        const botJson = async (name, a) => JSON.parse(await bot(name, a));
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i += 1) await page.waitForTimeout(250);
            await page.click('#btn-start');
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i += 1) await page.waitForTimeout(250);
            await assertLogicOnlyChannel(page);
            const loaded = await bot('botLoadTape', JSON.stringify(tape));
            if (loaded !== 'ok') throw new Error(`botLoadTape ${tape.name}: ${loaded}`);
            if (await bot('botStart') !== 'ok') throw new Error(`botStart ${tape.name}`);
            for (const deadline = Date.now() + 10 * 60 * 1000; ;) {
                const st = await botJson('botStatus');
                if (st.finished) break;
                if (st.error) throw new Error(`${tape.name}: ${st.error}`);
                if (Date.now() > deadline) throw new Error(`${tape.name}: deadline`);
                await page.waitForTimeout(500);
            }
            const drained = await botJson('botDrain');
            return { ticks: drained.ticks ?? [], cleared: (await botJson('botStatus')).persistence_cleared ?? [] };
        } finally {
            await page.close();
        }
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
            // CLEAR: face back toward the lock and away from it in turns, pressing; the room's bodies run at the player.
            const away = DIR_KEYS[{ N: 'S', S: 'N', E: 'W', W: 'E' }[dir]];
            const turns = Array.from({ length: Math.floor(CLEAR_TICKS / 60) }, (_, i) => (
                { key: i % 2 ? into : away, from: i * 60, to: i * 60 + 3 }));
            const clear = await run(tapeOf(`l${k.level}-${k.tag}-clear`, k.level, room,
                [...turns, ...presses(CLEAR_TICKS, 12)], [], ['sword'], CLEAR_TICKS));
            const written = clear.cleared.filter((c) => Number(c.level) === k.level && Number(c.tag) === k.tag)
                .map((c) => ({ level: Number(c.level), tag: Number(c.tag), note: 'written by the CLEAR arm (game)' }));
            const ret = written.length ? await run(tapeOf(`l${k.level}-${k.tag}-return`, k.level, pocket,
                [{ key: into, from: 0, to: TICKS }], written, [], TICKS)) : null;
            console.log(`ROW ${JSON.stringify({
                lock: id, event: k.name, side: k.side, across: k.across, dir, pocket, room,
                bare: summary(bare), built: summary(built), clear: { ...summary(clear), cleared: clear.cleared },
                ret: ret && summary(ret),
            })}`);
            check(`${id}: BARE — from the pocket, every kill arm granted, the lock stands and the game writes no flag`,
                !passed(bare) && !has(bare.cleared), JSON.stringify(summary(bare)));
            check(`${id}: BUILT — the event's flag staged, the game builds it open and the player walks through from the pocket`,
                passed(built), JSON.stringify(summary(built)));
            if (ret) {
                check(`${id}: RETURN — the flag the CLEAR arm wrote, staged, opens the pocket's crossing`, passed(ret),
                    JSON.stringify(summary(ret)));
            }
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
