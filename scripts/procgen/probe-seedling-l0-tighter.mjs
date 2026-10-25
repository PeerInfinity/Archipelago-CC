#!/usr/bin/env node
/**
 * Seedling's L0 WAY UP to `out_teleporter_240_0` (tile [15,0], the L89 door), ON THE GAME (slice
 * rules-l0-tighter-probe): can the player reach it from `level_0__r8c0` or `level_0__r11c19` WITHOUT the Feather?
 *
 * The shipped rules charge `level_0__r8c0 -> level_0__r2c13` Has(Progressive Swim, 2): the only crossings from the
 * row-8 lake up into the north-east pool are the two waterfalls at [13,7] and [16,7] (`dirs: {N: hasFeather}`;
 * `Player.as:1557` makes a fall one-way down without the Feather). The rules-l55-waterfall census flood found the
 * door free without it, by walking north THROUGH the starting house (`building@64,64`, cells [4-7,4-7] `manual`:
 * its per-pixel mask is not transcribed) and on east past the r2c12 rock. In the game the house is `type =
 * "Solid"` with `BuildingMask.png` (64x48: solid over cols 4-7 rows 4-6 bar the L1 door notch at col 5 row 6,
 * `Scenery/Building.as:22-23`).
 *
 * Tapes, each on a FRESH page on the DELIVERED set, `noHazards` EMPTY, Conch + Sword granted (the rocks and the
 * water are not the subject), so the Feather is the one variable:
 *   house-swim      boots on r8c0 under the house (96,128): north into it, east, north, east toward the exit —
 *                   the census flood's way; stalls on the house's south face, no L89
 *   house-door-swim boots under the door (80,128), its rock (flag L0:4) cleared: the same inputs, up col 5 — the
 *                   flood's literal path; the notch is the L1 door, so it leaves for L1, never into the house
 *   falls-swim      boots on r8c0 south of the col-13 waterfall (208,144): north up it, east, north into the door —
 *                   stalls on the fall, no L89
 *   falls-feather   the same inputs with the Feather: climbs the fall and takes the door into L89 (the control)
 *   r11-swim        boots on r11c19 (304,176), its rock (flag L0:1) cleared: west to the torch, north into the
 *                   lake, west in it to col 13, the same climb — no L89
 *   r11-feather     the same inputs with the Feather: L89 (the control)
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l0-tighter.mjs [--host=http://localhost:8000] [--only=house-swim,…] [--repeat=N] [--dump]
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
/** Where `out_teleporter_240_0` leads (`to: 89`). */
export const DOOR_TO = 89;
/** Row 5's bottom edge (y 96): from it up the house's mask is solid in all four columns (the door notch is row 6). */
export const HOUSE_SOLID_Y = 96;

const spans = (list) => {
    let t = 0;
    return list.map(([key, n]) => { const s = { key, from: t, to: t + n }; t += n; return s; });
};
const total = (list) => list.reduce((a, [, n]) => a + n, 0);
/** Idle ticks after the last span: the door's transition lands inside them. */
const SETTLE = 60;

/** The tapes. Exported for the unit rows. */
export function l0Tapes() {
    const base = {
        tape_version: 6, game: 'seedling', noclip: false, noDamage: true, noHazards: [], persistence: [], equips: [],
        save: { totem_parts: [], keys: [], seal_parts: [] },
    };
    // Under the house at col 6: north (into it), east along row 4 to col 10, north to row 2, east to the col-15
    // water, north into the door — the flood's path.
    const house = [['up', 120], ['right', 70], ['up', 40], ['right', 90], ['up', 60]];
    // South of the col-13 fall: north up it to row 2, east to col 15, north into the door.
    const falls = [['up', 220], ['right', 40], ['up', 80]];
    // From r11c19: west along row 11 to the torch at [14,11], north into the row-8 lake, west in it to col 13,
    // then the same climb.
    const fromR11 = [['left', 70], ['up', 60], ['left', 45], ...falls];
    const tape = (name, boot, items, list, persistence = []) => ({
        ...base, name: `l0-tighter-${name}`, description: `probe-seedling-l0-tighter: ${name}`, persistence,
        boot, grants: [{ level: 0, items }], tick_count: total(list) + SETTLE, inputs: spans(list),
    });
    const doorRock = [{ level: 0, tag: 4, note: 'breakablerock@80,112, under the L1 door' }];
    const rock = [{ level: 0, tag: 1, note: 'breakablerock@288,176, the r11c19 rock' }];
    return {
        'house-swim': tape('house-swim', { level: 0, x: 96, y: 128 }, ['conch', 'sword'], house),
        'house-door-swim': tape('house-door-swim', { level: 0, x: 80, y: 128 }, ['conch', 'sword'], house, doorRock),
        'falls-swim': tape('falls-swim', { level: 0, x: 208, y: 144 }, ['conch', 'sword'], falls),
        'falls-feather': tape('falls-feather', { level: 0, x: 208, y: 144 }, ['conch', 'sword', 'feather'], falls),
        'r11-swim': tape('r11-swim', { level: 0, x: 304, y: 176 }, ['conch', 'sword'], fromR11, rock),
        'r11-feather': tape('r11-feather', { level: 0, x: 304, y: 176 }, ['conch', 'sword', 'feather'], fromR11, rock),
    };
}

/** What one run says. Exported for the unit rows. */
export function readRun(ticks, status) {
    const levels = [...new Set(ticks.map((o) => o.level))];
    const in0 = ticks.filter((o) => o.level === 0);
    return {
        levels,
        reachedDoor: levels.includes(DOOR_TO),
        minY0: in0.length ? Math.min(...in0.map((o) => o.y)) : null,
        insideHouse: in0.some((o) => o.x >= 64 && o.x < 128 && o.y < HOUSE_SOLID_Y),
        hits: status?.hits ?? null,
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape: the Feather tapes take the door, every Swim-only tape does not. */
export function expectL0(name, r) {
    if (name.endsWith('-feather')) return r.reachedDoor;
    return !r.reachedDoor && !r.insideHouse;
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

    takeBoxLockOrExit({ name: 'probe-seedling-l0-tighter.mjs', kind: 'browser' });
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
        for (const [name, raw] of Object.entries(l0Tapes()).flatMap((e) => Array(repeat).fill(e))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readRun(g.ticks, g.status);
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                grants: tape.grants, ...read };
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.includes('--dump')) console.log(`TICKS ${g.ticks.filter((o) => o.t % 10 === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const what = name.endsWith('-feather')
                ? 'with the Feather the col-13 fall is climbed and out_teleporter_240_0 takes the player into L89'
                : 'with NO feather the door is never reached (and the house is never entered)';
            check(`${name}: ${what}`, expectL0(name, read),
                JSON.stringify({ levels: read.levels, minY0: read.minY0, insideHouse: read.insideHouse, final: read.final }));
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
