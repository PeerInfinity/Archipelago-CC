#!/usr/bin/env node
/**
 * Seedling's L66 DOOR into Dungeon 6 (`out_teleporter_72_64` → L70), ON THE GAME (slice rules-l66-l57-probe): does
 * the player need the Yellow Key to take it?
 *
 * The door is a `teleporter@72,64` standing in building8's doorway: `Building8Mask.png` (64x64 at 48,16) is solid
 * everywhere at y 64-79 except the notch x 72-87 (`Scenery/Building.as:21-22`). A `bosslock@72,64 {keyType 4,
 * tag 0}` (`Puzzlements/BossLock.as:29-36`, hitbox 16x16 at 72..88 x 64..80, `type "Solid"`) fills that same notch,
 * and opens only for `Player.hasKey(4)` probed from the row below (`:62-63`). Key 4 is the Yellow Key
 * (`games/seedling.json`, flash `key4`). The lock is HALF A TILE off the grid, so no tile is wholly its, and the
 * analyzer binds the door through building8's `manual` cells without charging it: the shipped rules have
 * `level_66__r5c4 -> level_70` = True_ (census-seedling-bosslocks: NOT-SEALED, off-grid). The `--masks` census
 * flood called the door unreachable for the opposite reason: the tile-centre box test seals both tiles the notch
 * straddles.
 *
 * Tapes, each on a FRESH page on the DELIVERED set, `noHazards` EMPTY, booted where the L70 door lands the player
 * (72,80, `in_L70_32_64`), holding UP into the door:
 *   bare        no key, the lock standing (what the rules charge: nothing) — stalls under the lock, no L70
 *   other-keys  keys 0-3 (Red, Green, Purple, Blue) — the same stall: it is key 4, not any key
 *   yellow-key  key 4 — the lock opens and the door takes the player into L70 (the control)
 *   lock-open   no key, `{66,0}` cleared (the lock built open, `BossLock.as:42-46`) — L70: the notch itself is
 *               walkable at x=72, so the mask flood's sealed door tile is an artifact of its tile-centre test
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l66-door.mjs [--host=http://localhost:8000] [--only=bare,…] [--repeat=N] [--dump]
 * `--repeat=N` runs every tape N times, each on its own fresh page (the 8x a slice owes, in one CI job).
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
/** Where `out_teleporter_72_64` leads (`to: 70`). */
export const DOOR_TO = 70;
/** The lock's bottom edge (y 80): a player held under a standing lock never gets above it. */
export const LOCK_BOTTOM_Y = 80;
/** Where L70's door to L66 lands the player (`teleporter@32,64 {playerx 72, playery 80}`). */
export const ARRIVAL = Object.freeze({ level: 66, x: 72, y: 80 });

/** Ticks holding UP, then idle ticks: the door's transition lands inside them. */
const HOLD = 180;
const SETTLE = 60;

/** The tapes. Exported for the unit rows. */
export function l66Tapes() {
    const tape = (name, keys, persistence = []) => ({
        tape_version: 6, game: 'seedling', noclip: false, noDamage: true, noHazards: [], equips: [], grants: [],
        name: `l66-door-${name}`, description: `probe-seedling-l66-door: ${name}`, persistence,
        save: { totem_parts: [], keys, seal_parts: [] },
        boot: { ...ARRIVAL }, tick_count: HOLD + SETTLE, inputs: [{ key: 'up', from: 0, to: HOLD }],
    });
    const lock = [{ level: 66, tag: 0, note: 'bosslock@72,64 {keyType 4}, in building8\'s doorway' }];
    return {
        bare: tape('bare', []),
        'other-keys': tape('other-keys', [0, 1, 2, 3]),
        'yellow-key': tape('yellow-key', [4]),
        'lock-open': tape('lock-open', [], lock),
    };
}

/** What one run says. Exported for the unit rows. */
export function readRun(ticks, status) {
    const levels = [...new Set(ticks.map((o) => o.level))];
    const in66 = ticks.filter((o) => o.level === 66);
    return {
        levels,
        reachedDoor: levels.includes(DOOR_TO),
        minY66: in66.length ? Math.min(...in66.map((o) => o.y)) : null,
        cleared: status?.persistence_cleared ?? null,
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape: the Yellow Key or the lock already open takes the door; nothing else does. */
export function expectL66(name, r) {
    if (name === 'yellow-key' || name === 'lock-open') return r.reachedDoor;
    return !r.reachedDoor && r.minY66 !== null && r.minY66 >= LOCK_BOTTOM_Y;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const set = vanillaRecordSet(EMBED, MAP).set;
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-l66-door.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const call = (page, n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[name] !== 'function') return null;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    const json = async (page, n, a) => { const r = await call(page, n, a); return r === null ? null : JSON.parse(r); };
    const waitFor = async (page, what, fn, ms) => {
        for (const t0 = Date.now(); ;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(250);
        }
    };
    const logs = [];
    const run = async (tape) => {
        const page = await browser.newPage();
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            await assertLogicOnlyChannel(page);
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const mounted = await json(page, 'botLevelSet');
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = await json(page, 'botStatus');
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                return st?.finished ? st : null;
            }, 10 * 60 * 1000);
            const drained = await json(page, 'botDrain');
            return { status, mounted, ticks: (drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })) };
        } finally {
            await page.close();
        }
    };
    try {
        const only = arg('only', null)?.split(',');
        const repeat = Math.max(1, Number(arg('repeat', '1')) || 1);
        for (const [name, raw] of Object.entries(l66Tapes()).flatMap((e) => Array(repeat).fill(e))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readRun(g.ticks, g.status);
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                keys: tape.save.keys, persistence: tape.persistence, ...read };
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.includes('--dump')) console.log(`TICKS ${g.ticks.filter((o) => o.t % 10 === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const what = name === 'yellow-key' ? 'with the Yellow Key the lock opens and out_teleporter_72_64 takes the player into L70'
                : name === 'lock-open' ? 'with the lock built open (no key) the doorway notch is walked and the door takes the player into L70'
                    : 'without the Yellow Key the lock stands: the player stalls under it, no L70';
            check(`${name}: ${what}`, expectL66(name, read),
                JSON.stringify({ levels: read.levels, minY66: read.minY66, cleared: read.cleared, final: read.final }));
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
