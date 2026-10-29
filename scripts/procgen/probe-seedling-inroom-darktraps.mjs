#!/usr/bin/env node
/**
 * Seedling's two OTHER in-room darktraps, ON THE GAME (slice rules-l63-darktrap-probe, step 1 of its fix): are
 * L65's darktrap@144,144 and L101's darktrap@160,80 the class `probe-seedling-l63-darktrap.mjs` witnessed — a barrier
 * that only an UNWIRED lightpole of the same room kills (`tset` -1, no ButtonRoom writes its tag), lit by a Spear
 * thrust from a stance on only some sides?
 *
 * ⛓ L65. darktrap@144,144 (tag 1) on [9,9] is the one way from column 8 (the L63 landing (128,16), its teleporter@128,0
 * back) into the loop [9,10]..[12,9] toward the Spear bridge [11,8] and r4c11. lightpole@128,168 (tag 0) over the pit
 * [8,10] is 22.6 px from the trap's centre (lightpole@176,120, tag 2, is 32+ px: out of `radiusMin` 28).
 * ⛓ L101. darktrap@160,80 (tag 1) on [10,5] is the one way from L102's stairs landing (144,80) on [9,5] (its
 * stairsup@144,96 back) east into the rest of `level_101__r4c9`. lightpole@144,64 (tag 0) on [9,4] reaches it only at
 * the low end of its bob (27.2-30.5 px against 28: `DarkTrap.as:33` starts the death on the first tick inside).
 * The rest is `probe-seedling-l63-darktrap.mjs`'s: `DarkTrap.as:27-54`, `SandTrap.as:82-86`, `LightPole.as:46-97`,
 * `Player.as:955-990,1105-1108`.
 *
 * Tapes, each on a FRESH page on the DELIVERED set, `noDamage` false; the trap sampled from `botMobiles`:
 *   l65-alive           column 8's foot [8,9]: RIGHT then DOWN into the loop — turned back by the trap
 *   l65-cleared         the same with `{65,1}` cleared (the control) — into the loop, hitless
 *   l65-column-thrust   [8,9] with the Spear: faces DOWN, thrusts at the pole, waits, then the walk — crossed hitless
 *   l65-loop-thrust     the loop's [9,10] with the Spear: faces W, thrusts, waits, then UP and LEFT into the column — crossed
 *   l101-alive          the L102 landing [9,5]: RIGHT — stopped by the trap (a hit)
 *   l101-cleared        the same with `{101,1}` cleared — crossed hitless
 *   l101-pocket-thrust  the landing with the Spear: faces UP, thrusts at the pole, waits, RIGHT — crossed hitless
 *   l101-wall-thrust    the r4c2 column's [7,4] with the Spear: faces E, thrusts THROUGH the wall [8,4] — the trap dies
 *   l101-east-thrust    the far side [11,5] with the Spear: faces W, thrusts, waits, LEFT — NOT crossed (no stance there)
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-inroom-darktraps.mjs [--host=http://localhost:8000] [--only=l65-alive,…] [--repeat=N] [--dump]
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
/** Ticks a direction is held to cross one tile (the walk is ~1.15 px a tick). */
const STEP = 16;
/** Ticks waited after a thrust: the death runs 72 ticks from the light (`die1` at +30), harmless from the first. */
const WAIT = 90;

/**
 * The cases: the boot, the trap's centre as `botMobiles` reports it, and `past(o)` — the player is on the trap's far
 * side. Exported for the unit rows.
 */
export function inroomTapes() {
    const tape = (name, { level, boot, persistence = [], spear = false, inputs, ticks }) => ({
        tape_version: 6, game: 'seedling', noclip: false, noDamage: false, noHazards: [],
        persistence: persistence.map((tag) => ({ level, tag, note: `probe-seedling-inroom-darktraps: {${level},${tag}}` })),
        equips: spear ? [{ t: 0, slot: 1 }] : [],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        name: `inroom-darktraps-${name}`, description: `probe-seedling-inroom-darktraps: ${name}`,
        boot: { level, ...boot }, grants: spear ? [{ level, items: ['sword', 'spear'] }] : [],
        tick_count: ticks, inputs,
    });
    const thrust = (t, dir) => [{ key: dir, from: t, to: t + 1 }, { key: 'primary', from: t + 4, to: t + 5 }];
    const hold = (key, t, n = STEP) => ({ key, from: t, to: t + n });
    // L65: [8,9] -> [9,9] (the trap) -> [9,10]; the far side is [9,10]'s row and below, right of the column.
    const l65 = { level: 65, trap: { x: 152, y: 152 } };
    // DOWN stops inside [9,10]: one tile further is the pit row 11, whose fall respawns the player (and rebuilds the room).
    const intoLoop = (t) => [hold('right', t), hold('down', t + STEP, 12)];
    const foot = { x: 128, y: 144 };
    const loop = { x: 144, y: 160 };
    const inLoop = (o) => o.x >= 144 && o.y >= 166;
    const inColumn = (o) => o.x < 144 && o.y < 160;
    // L101: [9,5] -> [10,5] (the trap) -> [11,5].
    const l101 = { level: 101, trap: { x: 168, y: 88 } };
    const landing = { x: 144, y: 80 };
    const east = { x: 176, y: 80 };
    const eastOf = (o) => o.x >= 184;
    const westOf = (o) => o.x < 160;
    const c = (name, at, past, o) => ({ ...at, past, tape: tape(name, { level: at.level, ...o }) });
    return {
        'l65-alive': c('l65-alive', l65, inLoop, { boot: foot, inputs: intoLoop(10), ticks: 70 }),
        'l65-cleared': c('l65-cleared', l65, inLoop, { boot: foot, persistence: [1], inputs: intoLoop(10), ticks: 70 }),
        'l65-column-thrust': c('l65-column-thrust', l65, inLoop, { boot: foot, spear: true, inputs: [...thrust(10, 'down'), ...intoLoop(10 + WAIT)], ticks: 160 }),
        'l65-loop-thrust': c('l65-loop-thrust', l65, inColumn, {
            boot: loop, spear: true, inputs: [...thrust(10, 'left'), hold('up', 10 + WAIT, STEP + 4), hold('left', 30 + WAIT)], ticks: 160,
        }),
        'l101-alive': c('l101-alive', l101, eastOf, { boot: landing, inputs: [hold('right', 10, 2 * STEP)], ticks: 70 }),
        'l101-cleared': c('l101-cleared', l101, eastOf, { boot: landing, persistence: [1], inputs: [hold('right', 10, 2 * STEP)], ticks: 70 }),
        'l101-pocket-thrust': c('l101-pocket-thrust', l101, eastOf, { boot: landing, spear: true, inputs: [...thrust(10, 'up'), hold('right', 10 + WAIT, 2 * STEP)], ticks: 160 }),
        // The pole lit THROUGH the wall [8,4] from the r4c2 column: `collideRectInto` tests no Solid in between.
        'l101-wall-thrust': c('l101-wall-thrust', l101, () => false, { boot: { x: 112, y: 64 }, spear: true,
            inputs: [hold('up', 2, 10), ...[20, 40, 60, 80].flatMap((t) => thrust(t, 'right'))], ticks: 160 }),
        'l101-east-thrust': c('l101-east-thrust', l101, westOf, { boot: east, spear: true, inputs: [...thrust(10, 'left'), hold('left', 10 + WAIT, 2 * STEP)], ticks: 160 }),
    };
}

/** What one run says: the far side reached in the tape's level, the hits, the trap's last reading. */
export function readRun(ticks, status, samples, { level, past }) {
    const here = ticks.filter((o) => o.level === level);
    return {
        levels: [...new Set(ticks.map((o) => o.level))],
        passed: here.some((o) => past(o)),
        hits: status?.hits ?? null,
        trapSeen: samples.some((s) => s.level === level && s.t > 0 && s.trap !== null),
        trapDying: samples.some((s) => s.level === level && s.trap === 'die1'),
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape. */
export function expectInroom(name, r) {
    // L65's trap turns the walk back without a counted hit; the seal is the walk not crossing.
    if (name.endsWith('-alive')) return !r.passed;
    if (name === 'l101-east-thrust') return !r.passed;
    if (name === 'l101-wall-thrust') return r.hits === 0 && r.trapDying;
    if (name.endsWith('-cleared')) return r.passed && r.hits === 0 && !r.trapSeen;
    return r.passed && r.hits === 0 && r.trapDying;
}

const WHAT = {
    'l65-alive': 'L65: from column 8 the walk into the loop is turned back by darktrap@144,144',
    'l65-cleared': 'L65 with {65,1} cleared: no trap, the walk reaches the loop hitless (the control)',
    'l65-column-thrust': 'L65: a Spear thrust DOWN from [8,9] lights lightpole@128,168; after a wait the loop is reached hitless',
    'l65-loop-thrust': 'L65: a Spear thrust W from the loop [9,10] lights it too; after a wait the column is reached hitless',
    'l101-alive': 'L101: from the L102 landing the walk east is stopped by darktrap@160,80 (a hit)',
    'l101-cleared': 'L101 with {101,1} cleared: no trap, the walk east crosses hitless (the control)',
    'l101-pocket-thrust': 'L101: a Spear thrust UP from the landing lights lightpole@144,64; after a wait the walk east crosses hitless',
    'l101-wall-thrust': 'L101: a Spear thrust E from [7,4], through the wall [8,4], lights lightpole@144,64: the trap dies',
    'l101-east-thrust': 'L101: a Spear thrust W from [11,5] does NOT light it: the walk west is not crossed',
};

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

    takeBoxLockOrExit({ name: 'probe-seedling-inroom-darktraps.mjs', kind: 'browser' });
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
    const waitFor = async (page, what, fn, ms, every = 250) => {
        for (const t0 = Date.now(); ;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(every);
        }
    };
    const logs = [];
    const run = async (tape, at) => {
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
            // The trap's presence, sampled while the tape runs (`botMobiles`), each reading stamped with the game's tick.
            const samples = [];
            const status = await waitFor(page, 'the tape to finish', async () => {
                const raw = await page.evaluate(() => {
                    const g = window.__swfBridge.game;
                    return [String(g.botStatus()), String(g.botMobiles())];
                });
                const st = JSON.parse(raw[0]);
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                const row = (JSON.parse(raw[1]).mobiles ?? []).find((m) => /DarkTrap$/.test(String(m.cls))
                    && Math.abs(m.x - at.x) < 4 && Math.abs(m.y - at.y) < 4);
                if (!st.arm?.pending && st.arm?.armed_at >= 0) samples.push({ t: st.tick, level: st.level, trap: row ? (row.anim ?? '') : null });
                return st?.finished ? st : null;
            }, 10 * 60 * 1000, 20);
            const drained = await json(page, 'botDrain');
            return { status, mounted, samples, ticks: (drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })) };
        } finally {
            await page.close();
        }
    };
    try {
        const only = arg('only', null)?.split(',');
        const repeat = Math.max(1, Number(arg('repeat', '1')) || 1);
        for (const [name, cse] of Object.entries(inroomTapes()).flatMap((e) => Array(repeat).fill(e))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...cse.tape, pins: [...PIN_NAMES] });
            const g = await run(tape, cse.trap);
            const read = readRun(g.ticks, g.status, g.samples, cse);
            console.log(`ROW ${JSON.stringify({ tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                persistence: tape.persistence.map((x) => `{${x.level},${x.tag}}`), samples: g.samples.length, ...read })}`);
            if (process.argv.includes('--dump')) console.log(`SAMPLES ${g.samples.map((x) => `${x.t}:${x.level}:${x.trap === null ? '-' : (x.trap || 'on')}`).join(' ')}`);
            if (process.argv.includes('--dump')) console.log(`TICKS ${g.ticks.filter((o) => o.t % 5 === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            check(`${name}: ${WHAT[name]}`, expectInroom(name, read), JSON.stringify(read));
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
