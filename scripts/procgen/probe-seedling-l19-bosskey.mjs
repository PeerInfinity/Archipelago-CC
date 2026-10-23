#!/usr/bin/env node
/**
 * Seedling's L19 BOSS KEY, ON THE GAME (slice tile-l19-bosskey, W0): can the player take `bosskey@96,64` (keyType 0)
 * WITHOUT A SWORD? The key's 8x8 box (entity (104,72), x[100,108) y[68,76)) lies wholly inside `shieldboss@80,32`'s
 * 48x48 body (entity (104,64), x[80,128) y[40,88); `ShieldBoss.as:34,49`), "ShieldBoss" is in `Mobile.solids`
 * (`Mobile.as:17`) and `Player extends Mobile`; a Pickup is taken only on a box overlap with the Player
 * (`Pickup.as` `collide("Player", x, y)`). So the source says: only the boss's removal (`destroy`, after the third
 * landed hit) uncovers the key. This probe asks the game.
 *
 * Tapes, each on a FRESH page on the DELIVERED set, built on `fixtures/tapes/r6-shield-kill.json` (R6's W-shield):
 *   kill            the R6 tape as committed (a sword granted): `{19,0}` is written and the key is taken off the body
 *   swordless-up    the same inputs with NO grant: the same `up` span and presses — no kill, no key
 *   swordless-east  no grant: right, up the body's east side, then left into it — no key
 *   swordless-west  no grant: left, up the body's west side, then right into it — no key
 * The swordless arms set `noDamage` (the stand-under stab would otherwise knock the walk away); solidity is unchanged.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l19-bosskey.mjs [--host=http://localhost:8000] [--only=kill,…] [--dump]
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
const SOURCE_TAPE = 'frontend/modules/seedlingDemo/fixtures/tapes/r6-shield-kill.json';
/** The key's box and the ShieldBoss body's box, as entity rectangles [x0, y0, x1, y1). */
export const KEY_BOX = Object.freeze([100, 68, 108, 76]);
export const BODY_BOX = Object.freeze([80, 40, 128, 88]);
export const SHIELD_KILL = '19,0';

/** The tapes, derived from the source tape. Exported for the unit rows. */
export function l19Tapes(source) {
    const tape = (name, over) => ({ ...source, name: `l19-bosskey-${name}`, description: `probe-seedling-l19-bosskey: ${name}`, ...over });
    const spans = (list) => {
        let t = 0;
        return list.map(([key, n]) => { const s = { key, from: t, to: t + n }; t += n; return s; });
    };
    const total = (list) => list.reduce((a, [, n]) => a + n, 0);
    const east = [['right', 50], ['up', 120], ['left', 120], ['up', 60]];
    const west = [['left', 50], ['up', 120], ['right', 120], ['up', 60]];
    const swordless = { grants: [], noDamage: true };
    return {
        kill: tape('kill', {}),
        'swordless-up': tape('swordless-up', swordless),
        'swordless-east': tape('swordless-east', { ...swordless, tick_count: total(east), inputs: spans(east) }),
        'swordless-west': tape('swordless-west', { ...swordless, tick_count: total(west), inputs: spans(west) }),
    };
}

/** The Chebyshev gap between the player's 4x5 box (from (x-2, y-2)) and a box; < 0 is overlap. */
export function gapTo(x, y, [x0, y0, x1, y1]) {
    return Math.max(x0 - (x + 2), (x - 2) - x1, y0 - (y + 3), (y - 2) - y1);
}

/** What one run says. Exported for the unit rows. */
export function readRun(ticks, status) {
    const clears = [...new Set((status?.persistence_cleared ?? []).map((c) => `${Number(c.level)},${Number(c.tag)}`))].sort();
    const in19 = ticks.filter((o) => o.level === 19);
    const minGap = (box) => (in19.length ? Math.min(...in19.map((o) => gapTo(o.x, o.y, box))) : null);
    return {
        key0: status?.save?.keys?.[0] ?? null,
        clears,
        keyGap: minGap(KEY_BOX),
        bodyGap: minGap(BODY_BOX),
        minY19: in19.length ? Math.min(...in19.map((o) => o.y)) : null,
        hits: status?.hits ?? null,
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape. */
export function expectL19(name, r) {
    if (name === 'kill') return r.key0 === true && r.clears.includes(SHIELD_KILL);
    return r.key0 === false && !r.clears.includes(SHIELD_KILL) && r.keyGap !== null && r.keyGap > 0;
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

    takeBoxLockOrExit({ name: 'probe-seedling-l19-bosskey.mjs', kind: 'browser' });
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
        for (const [name, raw] of Object.entries(l19Tapes(readJson(SOURCE_TAPE)))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readRun(g.ticks, g.status);
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                grants: tape.grants, noDamage: tape.noDamage, ...read };
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.includes('--dump')) console.log(`TICKS ${g.ticks.filter((o) => o.t % 10 === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const what = name === 'kill'
                ? `with the sword the third hit writes {${SHIELD_KILL}} and the key is taken off the vacated body`
                : 'with NO sword the body stays, the player never touches the key\'s box, and key 0 is not held';
            check(`${name}: ${what}`, expectL19(name, read),
                JSON.stringify({ key0: read.key0, clears: read.clears, keyGap: read.keyGap, bodyGap: read.bodyGap, minY19: read.minY19, final: read.final }));
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
