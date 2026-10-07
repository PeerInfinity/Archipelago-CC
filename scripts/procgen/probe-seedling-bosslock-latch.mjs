#!/usr/bin/env node
/**
 * Seedling BOSSLOCK LATCH, THE GAME'S WAY (rules `rules-lock-events`, W0). The rules are about to export each
 * one-sided BossLock as a `game_state` event keyed on its persistence flag `{level, tag}`, and to gate the lock's
 * far-side (north → south) crossing on that event instead of on "the south side is reachable". The JS collector
 * reads events off the game's `persistence_cleared`, so this asks the wasm game three things per placed BossLock
 * (every `bosslock` in `seedling-map.json`, read there, never listed by hand):
 *
 *   OPEN   booted on the tile SOUTH of the lock, its key presented (`save.keys`), holding UP: the game opens it
 *          (`BossLock.update` probes the row below, `BossLock.as:58-63`) and WRITES `{level, tag}` into
 *          `persistence_cleared` (`Game.setPersistence(tag, false)`, `:78`);
 *   HELD   booted on the tile NORTH of it, the key presented, NO flag, holding DOWN: the lock stays (the key does
 *          not open it from the north — STANCE);
 *   RETURN booted north again with exactly the flag OPEN read back from the game staged as persistence, holding
 *          DOWN: the game built the lock open (`check()` removes it, `:42-46`) and the player walks south past it.
 *
 * A lock whose north tile the player cannot stand on, or whose south row it cannot reach, is reported as a ROW
 * (`north-blocked` / `not-opened`) and is not a FAIL: the census decides which locks are one-sided separators,
 * this probe witnesses the latch. The checks are on the locks the brief names as STANCE's measured rooms
 * (`--strict`, default 30,48) plus any lock whose OPEN arm did open.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (proved, `CHANNEL: headless logic-only`), so it runs in CI too
 * (`.github/workflows/seedling-probe.yml`).
 *
 * Run: node scripts/procgen/probe-seedling-bosslock-latch.mjs [--host=http://localhost:8000] [--ticks=240]
 *      [--only=30,48] [--strict=30,48] [--wait-for-box=<sec>]
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
const TILE = 16;

/** Every placed BossLock in a map extract: `{level, x, y, keyType, tag}`. */
export function bossLocksOf(map) {
    return map.levels.flatMap((l) => (l.entities ?? []).filter((e) => e.type === 'bosslock').map((e) => ({
        level: l.level, x: e.x, y: e.y, keyType: Number(e.attrs?.keyType ?? 0), tag: Number(e.attrs?.tag ?? -1),
    })));
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const TICKS = Number(arg('ticks', '240'));
    const only = arg('only', '') ? new Set(arg('only', '').split(',').map(Number)) : null;
    const strict = new Set(arg('strict', '30,48').split(',').filter(Boolean).map(Number));
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const { PIN_NAMES, parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
    const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
    const locks = bossLocksOf(MAP).filter((k) => !only || only.has(k.level));
    console.log(`PAGE: ${PAGE} · ${locks.length} bosslock(s)`);

    takeBoxLockOrExit({ name: 'probe-seedling-bosslock-latch.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const tapeOf = (name, k, boot, key, persistence, keys = [k.keyType]) => parseTape({
        tape_version: 8, game: 'seedling', name, description: 'probe-seedling-bosslock-latch',
        boot: { level: k.level, ...boot }, noclip: false, noDamage: true, noHazards: [],
        grants: [], persistence, equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys, seal_parts: [] },
        rng: { seed: 1, split: false }, seam: {}, tick_count: TICKS,
        inputs: [{ key, from: 0, to: TICKS }],
    });

    const page = await browser.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const bot = (name, a) => page.evaluate(([n, x]) => String(window.__swfBridge.game[n](x)), [name, a]);
    const botJson = async (name, a) => JSON.parse(await bot(name, a));
    try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i += 1) await page.waitForTimeout(250);
        await page.click('#btn-start');
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i += 1) await page.waitForTimeout(250);
        // ⛓ the logic-only channel, PROVED before anything is measured (`seedlingChannel.js`)
        await assertLogicOnlyChannel(page);
        const run = async (tape) => {
            if (await bot('botLoadTape', JSON.stringify(tape)) !== 'ok') throw new Error(`botLoadTape ${tape.name}`);
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
        };
        const inLevel = (ticks, k) => ticks.filter((o) => o.level === k.level);
        const has = (cleared, k) => cleared.some((c) => Number(c.level) === k.level && Number(c.tag) === k.tag);
        for (const k of locks) {
            const id = `L${k.level} bosslock@${k.x},${k.y} {${k.level},${k.tag}} key ${k.keyType}`;
            const south = { x: k.x, y: k.y + TILE };
            const north = { x: k.x, y: k.y - TILE };
            const open = await run(tapeOf(`l${k.level}-${k.tag}-open`, k, south, 'up', []));
            const opened = has(open.cleared, k);
            const openMinY = Math.min(...inLevel(open.ticks, k).map((o) => o.y));
            const held = await run(tapeOf(`l${k.level}-${k.tag}-held`, k, north, 'down', []));
            const heldMaxY = Math.max(...inLevel(held.ticks, k).map((o) => o.y));
            const written = open.cleared.filter((c) => Number(c.level) === k.level && Number(c.tag) === k.tag)
                .map((c) => ({ level: Number(c.level), tag: Number(c.tag), note: 'written by the OPEN arm (game)' }));
            const ret = opened ? await run(tapeOf(`l${k.level}-${k.tag}-return`, k, north, 'down', written)) : null;
            const retMaxY = ret ? Math.max(...inLevel(ret.ticks, k).map((o) => o.y)) : null;
            // BUILT OPEN, from the side the key would open it: the flag staged, NO key, holding UP. A lock the
            // game built open lets the player through; one it built closed stops a keyless player at its face.
            const built = opened ? await run(tapeOf(`l${k.level}-${k.tag}-built`, k, south, 'up', written, [])) : null;
            const builtMinY = built ? Math.min(...inLevel(built.ticks, k).map((o) => o.y)) : null;
            const bare = await run(tapeOf(`l${k.level}-${k.tag}-bare`, k, south, 'up', [], []));
            const bareMinY = Math.min(...inLevel(bare.ticks, k).map((o) => o.y));
            const lockBottom = k.y + TILE;
            const row = {
                lock: id, opened, cleared: open.cleared, openMinY,
                heldMaxY, heldCrossed: heldMaxY > lockBottom, heldCleared: has(held.cleared, k),
                retMaxY, retCrossed: retMaxY !== null && retMaxY > lockBottom, retCleared: ret?.cleared ?? null,
                builtMinY, builtCrossed: builtMinY !== null && builtMinY < k.y, builtCleared: built?.cleared ?? null,
                bareMinY, bareCrossed: bareMinY < k.y,
                firstTick: { open: open.ticks[0] ?? null, held: held.ticks[0] ?? null },
            };
            console.log(`ROW ${JSON.stringify(row)}`);
            if (!(strict.has(k.level) || opened)) continue;
            check(`${id}: OPEN from the south with the key WRITES {${k.level},${k.tag}} to persistence_cleared`, opened,
                JSON.stringify(open.cleared));
            check(`${id}: HELD — from the north with the key and no flag, the lock stays (no crossing, no write)`,
                !row.heldCrossed && !row.heldCleared, JSON.stringify({ heldMaxY, lockBottom }));
            check(`${id}: RETURN — the game-written flag staged, the lock is built open and the player crosses south`,
                row.retCrossed, JSON.stringify({ retMaxY, lockBottom }));
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await page.close();
        await browser.close();
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
