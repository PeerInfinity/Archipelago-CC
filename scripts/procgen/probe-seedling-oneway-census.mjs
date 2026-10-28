#!/usr/bin/env node
/**
 * Seedling's ONE-WAY EVENT CENSUS, ON THE GAME (rules `rules-oneway-event-census`, measure only). The census
 * (`CC/docs/cloud-reports/seedling-rules-oneway-census.md`) classifies every entity that can permanently change
 * passability; this probe witnesses the rows whose class rests on the game, not on the source alone.
 *
 * Tapes, each on a FRESH page, built on `fixtures/tapes/r9-solve-16.json`'s staging (its `seam`, `save` and `rng`;
 * boot, persistence, inputs and items replaced; `tick0` dropped):
 *   l82-top-entry    boot L82 (144,16) = the L96 arrival, no items, nothing staged, idle: `fallrocklarge@128,224`
 *                    (`bossrock 1`, `thirdboss 0`) arms on a player above it who is not falling from the ceiling
 *                    (`FallRockLarge.as:70-79`), so it falls on this entry and writes `{82,1}` (`:137-142`)
 *   l82-pocket-seal  boot L82 (160,272) = the L71 pit landing (control@192,208, xOff -160, yOff -272), `{82,1}`
 *                    staged (the rock built fallen, `:49-55`), walk up the rock's columns: the pocket's neck is shut
 *   l82-pocket-lock  the same boot and staging, onto `button@192,240` (tset 1), wait while `lock@192,224` (tset 1)
 *                    fades, then up through it: the pocket's second way out, so a later L71 fall is not a trap
 *   l43-ap-wand      L43's `wand@144,224` REWRITTEN to an `apitem` (`apPlacementRewriter.rewriteRecordSet`, as the AP
 *                    delivery writes it), boot (144,256), walk up onto it: the pickup clears `{43,0}` and NO pocket
 *                    rock falls (`Pickups/APItem.as` has no Activators; only `Wand.as:53-68` publishes tset 0)
 *   l43-vanilla-wand the same tape on the vanilla delivery (a real `Wand`): `{43,1}` and `{43,2}` are written (the
 *                    control: without it the AP arm measured nothing)
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too
 * (`.github/workflows/seedling-probe.yml`).
 *
 * Run: node scripts/procgen/probe-seedling-oneway-census.mjs [--host=http://localhost:8000] [--only=l82-top-entry,…]
 *      [--wait-for-box=<sec>] [--dump]   (--dump: every 10th tick's position in each ROW)
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
const SOURCE_TAPE = 'frontend/modules/seedlingDemo/fixtures/tapes/r9-solve-16.json';
/** L82's neck: the rock's 32x32 box and the lock's tile both span y 224–256; the pocket lies below 256. */
export const L82_NECK = { top: 224, bottom: 256 };
export const L82_ROCK = '82,1';
/** L43's wand location and the two pocket rocks it drops (tset 0; the doorway rock's tag 3 is removed). */
export const L43_ITEM = '43,0';
export const L43_POCKET_ROCKS = ['43,1', '43,2'];

/** The tapes, derived from the source tape. Exported for the unit rows. */
export function censusTapes(source) {
    const none = Object.fromEntries(Object.keys(source.seam.items).map((k) => [k, false]));
    const tape = (name, over) => {
        const { tick0: _drop, ...rest } = source;
        return { ...rest, name: `oneway-census-${name}`, description: `probe-seedling-oneway-census: ${name}`,
            noDamage: true, ...over };
    };
    const seam = { ...source.seam, items: { ...none } };
    const fallen = [{ level: 82, tag: 1, note: '' }];
    const pocket = { level: 82, x: 160, y: 272 };
    // ROCKMOVE's `l43-wand-stairs` staging: the Wand shows (and can be taken) only once the save holds every totem
    // part and the player stands below it (`Wand.as:78`); the presses dismiss the pickup's text.
    const wandStaging = { boot: { level: 43, x: 144, y: 240 }, persistence: [], seam, tick_count: 300,
        save: { ...source.save, totem_parts: [0, 1, 2, 3, 4] },
        inputs: [{ key: 'up', from: 0, to: 8 },
            ...[20, 51, 82, 113, 144, 175].map((t) => ({ key: 'primary', from: t, to: t + 1 }))] };
    return {
        'l82-top-entry': tape('l82-top-entry', { boot: { level: 82, x: 144, y: 16 }, persistence: [], seam,
            tick_count: 240, inputs: [] }),
        'l82-pocket-seal': tape('l82-pocket-seal', { boot: pocket, persistence: fallen, seam, tick_count: 260,
            inputs: [{ key: 'left', from: 0, to: 16 }, { key: 'up', from: 20, to: 260 }] }),
        'l82-pocket-lock': tape('l82-pocket-lock', { boot: pocket, persistence: fallen, seam, tick_count: 420,
            // up onto row 16 (row 17 is three tiles wide), east into the button's column, one short step onto it
            inputs: [{ key: 'up', from: 0, to: 20 }, { key: 'right', from: 24, to: 60 }, { key: 'up', from: 64, to: 72 },
                { key: 'up', from: 220, to: 420 }] }),
        'l43-ap-wand': tape('l43-ap-wand', { ...wandStaging }),
        'l43-vanilla-wand': tape('l43-vanilla-wand', { ...wandStaging }),
    };
}

const derivedTransitions = (ticks) => ticks.slice(1).flatMap((o, i) => (o.level === ticks[i].level ? []
    : [{ t: o.t, from: ticks[i].level, to: o.level, at: { x: o.x, y: o.y } }]));

/** What one run says. Exported for the unit rows. */
export function readRun(ticks, status) {
    const clears = [...new Set((status?.persistence_cleared ?? []).map((c) => `${Number(c.level)},${Number(c.tag)}`))].sort();
    const in82 = ticks.filter((o) => o.level === 82);
    return {
        clears,
        minY82: in82.length ? Math.min(...in82.map((o) => o.y)) : null,
        transitions: derivedTransitions(ticks),
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape. */
export function expectRun(name, r) {
    if (name === 'l82-top-entry') return r.clears.includes(L82_ROCK);
    if (name === 'l82-pocket-seal') return r.minY82 !== null && r.minY82 >= L82_NECK.bottom && r.transitions.length === 0;
    if (name === 'l82-pocket-lock') return r.minY82 !== null && r.minY82 < L82_NECK.top && r.transitions.length === 0;
    if (name === 'l43-ap-wand') return r.clears.includes(L43_ITEM) && !L43_POCKET_ROCKS.some((c) => r.clears.includes(c));
    if (name === 'l43-vanilla-wand') return L43_POCKET_ROCKS.every((c) => r.clears.includes(c));
    return false;
}

export const WHAT = Object.freeze({
    'l82-top-entry': 'entered from L96 (above the rock), the L82 boss rock falls at once and writes {82,1}',
    'l82-pocket-seal': `with the rock fallen, the L71 pit pocket's rock neck is shut (y stays >= ${L82_NECK.bottom})`,
    'l82-pocket-lock': `with the rock fallen, the pocket leaves through lock@192,224 held by button@192,240 (y < ${L82_NECK.top})`,
    'l43-ap-wand': 'the AP delivery\'s L43 apitem clears {43,0} and drops no pocket rock',
    'l43-vanilla-wand': 'the CONTROL: the vanilla Wand drops both pocket rocks ({43,1} {43,2})',
});

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
    const { rewriteRecordSet, AP_LOOK } = await M('apPlacementRewriter.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const vanilla = vanillaRecordSet(EMBED, MAP).set;
    // ⛓ The AP arm: the one L43 location rewritten exactly as the delivery's rewriter writes every placement.
    const ap = rewriteRecordSet(vanilla, new Map([['43|0', {
        ledgerId: 'probe-oneway-census-l43-wand', level: 43, tag: 0, look: AP_LOOK,
        entity: { type: 'wand', x: 144, y: 224 },
    }]])).set;
    const setFor = (name) => (name === 'l43-ap-wand' ? ap : vanilla);
    console.log(`PAGE: ${PAGE} · delivered ${vanilla.set_id} · l43-ap-wand on ${ap.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-oneway-census.mjs', kind: 'browser' });
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
    const run = async (tape, set) => {
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
        for (const [name, raw] of Object.entries(censusTapes(readJson(SOURCE_TAPE)))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape, setFor(name));
            const read = readRun(g.ticks, g.status);
            console.log(`ROW ${JSON.stringify({ tape: name, set_id: setFor(name).set_id, mounted: g.mounted?.active,
                observations: g.ticks.length, boot: tape.boot,
                persistence: tape.persistence.map((c) => `${c.level},${c.tag}`), ...read,
                ...(process.argv.includes('--dump') ? { trace: g.ticks.filter((o) => o.t % 10 === 0) } : {}) })}`);
            check(`${name}: the game ran the tape to its end on the mounted set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === setFor(name).set_id,
                `${g.ticks.length} obs, ${g.mounted?.active}`);
            check(`${name}: ${WHAT[name]}`, expectRun(name, read),
                JSON.stringify({ clears: read.clears, minY82: read.minY82, transitions: read.transitions, final: read.final }));
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
