#!/usr/bin/env node
/**
 * Seedling's L63 darktraps over the two L65 arrivals, ON THE GAME (slice rules-l63-darktrap-probe): does
 * darktrap@128,272 (tag 4) seal the arrival (128,288), what kills it, and which flag carries the kill to the next visit?
 *
 * ⛓ THE GEOMETRY. L65's teleporter@128,0 lands the player on [8,18], in a one-tile column through pits ([8,15]..[8,19];
 * [8,19] is the teleporter@128,304 back to L65, [8,14] above [8,15] a pit). darktrap@128,272 stands on [8,17], the
 * column's only way north. lightpole@112,272 (tag 7, `tset` -1: no ButtonRoom writes it) floats over the pit [7,17].
 * The mirror: L65's teleporter@32,0 lands on [2,18], below darktrap@32,272 (tag 3) and lightpole@48,272 (tag 6) on [3,17].
 *   - The trap dies to a lit pole's light only (`DarkTrap.as:33`: not a `PlayerLight`, within `radiusMin` 28): it starts
 *     dying the tick the light is in range, is harmless from then on (`super.update()` skipped, `:39-53`), counts 30,
 *     plays "die1", and only its removal writes `{63,4}` (`SandTrap.as:82-86`).
 *   - The pole is lit by a Spear thrust (`Player.as:1105-1108`), which TOGGLES it (`LightPole.as:77-84`) and writes its
 *     tag AT ONCE (`:94-97`); the pole is built from that tag (`:50`). So a kill followed by leaving before the removal
 *     persists through `{63,7}`: the next visit rebuilds the trap and the lit pole kills it again.
 *   - The thrust's rect (`Player.as:955-990`, 32 x 5 from `spearX/spearY`) reaches the pole's hitbox (10 x 12 at the
 *     bobbing `y = startY - originY`, `LightPole.as:46,61`) from the column's NORTH side [8,16], not from the arrival:
 *     a thrust W from [8,18] runs at y 294-300, below the pole; a thrust UP runs at x 135-141, right of it.
 *
 * Tapes, each on a FRESH page on the DELIVERED set, `noDamage` false (a crossing must be HITLESS); the trap's presence is
 * sampled from `botMobiles` (`Enemies::DarkTrap` at its centre, `anim` "die1" = dying):
 *   alive-walk          arrival, nothing cleared, UP — the trap's contact stops the player below [8,17] (the SEAL)
 *   cleared-walk        arrival, `{63,4}` cleared (the control) — up the column to [8,15], hitless, no trap
 *   pole-lit-wait       arrival, `{63,7}` cleared (the pole built lit): waits, then UP — crossed hitless
 *   arrival-thrust-w    arrival with the Spear: faces W, thrusts, waits, UP — NOT crossed (the pole is out of reach)
 *   arrival-thrust-up   the same thrusting UP — NOT crossed
 *   north-thrust-leave  [8,16] with the Spear: thrusts W, walks DOWN through the dying trap into L65 before its removal,
 *                       comes back, waits, UP — crossed hitless, the trap REBUILT on the return ({63,4} unwritten,
 *                       {63,7} carried the kill)
 *   removed-then-dark   arrival, `{63,7}` cleared: waits out the removal, thrusts (the pole goes OUT), L65 and back, UP —
 *                       crossed hitless with NO trap on the return ({63,4} was written and holds without the light)
 *   left-alive-walk     the mirror arrival (32,288), nothing cleared — NOT crossed (darktrap@32,272 seals it too)
 *   left-cleared-walk   the mirror with `{63,3}` cleared — crossed hitless
 *   left-north-thrust-leave  the mirror of north-thrust-leave from [2,16], thrusting E at lightpole@48,272
 *   left-arrival-thrust-e  the mirror with the Spear, thrusting E at lightpole@48,272 — NOT crossed
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l63-darktrap.mjs [--host=http://localhost:8000] [--only=alive-walk,…] [--repeat=N] [--dump]
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
/** The L65 arrivals: L65's teleporter@128,0 lands on [8,18], its teleporter@32,0 on [2,18] (`playerx`, `playery`). */
export const ARRIVAL = Object.freeze({ level: 63, x: 128, y: 288 });
export const LEFT_ARRIVAL = Object.freeze({ level: 63, x: 32, y: 288 });
/** The column's NORTH side [8,16] (the player at y 264): where a thrust W reaches lightpole@112,272. */
export const NORTH = Object.freeze({ level: 63, x: 128, y: 256 });
/** The mirror's north side [2,16]: where a thrust E reaches lightpole@48,272. */
export const LEFT_NORTH = Object.freeze({ level: 63, x: 32, y: 256 });
/** Past the trap: the player's y below this is [*,15], the far side of the trap's tile [*,17]. */
export const PAST_Y = 256;
/** `{63,4}` = darktrap@128,272 removed, `{63,7}` = lightpole@112,272 lit, `{63,3}` = darktrap@32,272 removed. */
export const TRAP_TAG = 4;
export const POLE_TAG = 7;
export const LEFT_TRAP_TAG = 3;
/** The traps' centres as `botMobiles` reports them (`SandTrap`: placement + half a tile). */
export const TRAP_AT = Object.freeze({ right: { x: 136, y: 280 }, left: { x: 40, y: 280 } });
/** UP ticks from the arrival row [*,18] to [*,15], short of [8,14]'s pit. */
const WALK = 38;

/** The tapes, each with the trap it samples. Exported for the unit rows. */
export function l63Tapes() {
    const tape = (name, { boot = ARRIVAL, persistence = [], spear = false, inputs, ticks }) => ({
        tape_version: 6, game: 'seedling', noclip: false, noDamage: false, noHazards: [],
        persistence: persistence.map((tag) => ({ level: 63, tag, note: `probe-seedling-l63-darktrap: {63,${tag}}` })),
        equips: spear ? [{ t: 0, slot: 1 }] : [],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        name: `l63-darktrap-${name}`, description: `probe-seedling-l63-darktrap: ${name}`,
        boot: { ...boot }, grants: spear ? [{ level: 63, items: ['sword', 'spear'] }] : [],
        tick_count: ticks, inputs,
    });
    // A one-tick tap to face `dir`, then one thrust.
    const thrust = (t, dir) => [{ key: dir, from: t, to: t + 1 }, { key: 'primary', from: t + 4, to: t + 5 }];
    const up = (t, n = WALK) => ({ key: 'up', from: t, to: t + n });
    const left = (name, o) => ({ trap: 'left', ...tape(name, { boot: LEFT_ARRIVAL, ...o }) });
    const right = (name, o) => ({ trap: 'right', ...tape(name, o) });
    return {
        'alive-walk': right('alive-walk', { inputs: [up(10)], ticks: 80 }),
        'cleared-walk': right('cleared-walk', { persistence: [TRAP_TAG], inputs: [up(10)], ticks: 80 }),
        'pole-lit-wait': right('pole-lit-wait', { persistence: [POLE_TAG], inputs: [up(90)], ticks: 160 }),
        'arrival-thrust-w': right('arrival-thrust-w', { spear: true, inputs: [...thrust(10, 'left'), up(100)], ticks: 170 }),
        'arrival-thrust-up': right('arrival-thrust-up', { spear: true, inputs: [...thrust(10, 'up'), up(100)], ticks: 170 }),
        // L65's landing (128,16) walks UP back into its teleporter@128,0 and lands on the arrival again.
        'north-thrust-leave': right('north-thrust-leave', {
            boot: NORTH, spear: true,
            inputs: [...thrust(10, 'left'), { key: 'down', from: 20, to: 60 }, up(90, 14), up(200)],
            ticks: 270,
        }),
        'removed-then-dark': right('removed-then-dark', {
            persistence: [POLE_TAG], spear: true,
            inputs: [...thrust(90, 'left'), { key: 'down', from: 100, to: 125 }, up(150, 30), up(230)],
            ticks: 300,
        }),
        'left-alive-walk': left('left-alive-walk', { inputs: [up(10)], ticks: 80 }),
        'left-cleared-walk': left('left-cleared-walk', { persistence: [LEFT_TRAP_TAG], inputs: [up(10)], ticks: 80 }),
        'left-north-thrust-leave': left('left-north-thrust-leave', {
            boot: LEFT_NORTH, spear: true,
            inputs: [...thrust(10, 'right'), { key: 'down', from: 20, to: 60 }, up(90, 14), up(200)],
            ticks: 270,
        }),
        'left-arrival-thrust-e': left('left-arrival-thrust-e', { spear: true, inputs: [...thrust(10, 'right'), up(100)], ticks: 170 }),
    };
}

/**
 * What one run says. `samples` are the trap readings `[{t, level, trap: null|anim}]` (`anim` '' = standing, 'die1' =
 * dying), `null` = absent. Exported for the unit rows.
 */
export function readRun(ticks, status, samples = []) {
    const levels = [...new Set(ticks.map((o) => o.level))];
    // The LAST stay in L63 (after any L65 round trip): its highest point says whether the column was crossed.
    let i = ticks.length - 1;
    while (i >= 0 && ticks[i].level !== 63) i -= 1;
    let j = i;
    while (j > 0 && ticks[j - 1].level === 63) j -= 1;
    const last = i >= 0 ? ticks.slice(j, i + 1) : [];
    const minY = last.length ? Math.min(...last.map((o) => o.y)) : null;
    const from = last.length ? last[0].t : Infinity;
    // The visit's first tick is read before `SandTrap.check()` has removed a cleared trap: it is skipped.
    const lastVisit = samples.filter((s) => s.level === 63 && s.t > from);
    return {
        levels,
        visits63: ticks.reduce((n, o, k) => n + (o.level === 63 && (k === 0 || ticks[k - 1].level !== 63) ? 1 : 0), 0),
        minY63: minY,
        passed: minY !== null && minY < PAST_Y,
        hits: status?.hits ?? null,
        trapOnLastVisit: lastVisit.some((s) => s.trap !== null),
        trapDyingOnLastVisit: lastVisit.some((s) => s.trap === 'die1'),
        samplesOnLastVisit: lastVisit.length,
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape. */
export function expectL63(name, r) {
    const crossed = r.passed && r.hits === 0;
    const roundTrip = r.levels.includes(65) && r.visits63 === 2;
    switch (name) {
        case 'alive-walk': case 'left-alive-walk': return !r.passed && r.hits > 0;
        case 'arrival-thrust-w': case 'arrival-thrust-up': case 'left-arrival-thrust-e': return !r.passed;
        case 'cleared-walk': case 'left-cleared-walk': return crossed && !r.trapOnLastVisit;
        case 'pole-lit-wait': return crossed;
        case 'north-thrust-leave': case 'left-north-thrust-leave': return crossed && roundTrip && r.trapOnLastVisit;
        case 'removed-then-dark': return crossed && roundTrip && r.samplesOnLastVisit > 0 && !r.trapOnLastVisit;
        default: return false;
    }
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

    takeBoxLockOrExit({ name: 'probe-seedling-l63-darktrap.mjs', kind: 'browser' });
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
    const run = async (tape, trap) => {
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
            const at = TRAP_AT[trap];
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
        for (const [name, raw] of Object.entries(l63Tapes()).flatMap((e) => Array(repeat).fill(e))) {
            if (only && !only.includes(name)) continue;
            const { trap, ...fields } = raw;
            const tape = parseTape({ ...fields, pins: [...PIN_NAMES] });
            const g = await run(tape, trap);
            const read = readRun(g.ticks, g.status, g.samples);
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                persistence: tape.persistence.map((c) => `{${c.level},${c.tag}}`), samples: g.samples.length, ...read };
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.includes('--dump')) console.log(`SAMPLES ${g.samples.map((x) => `${x.t}:${x.level}:${x.trap === null ? '-' : (x.trap || 'on')}`).join(' ')}`);
            if (process.argv.includes('--dump')) console.log(`TICKS ${g.ticks.filter((o) => o.t % 5 === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const what = {
                'alive-walk': 'from the arrival with tag 4 standing and no light, UP is stopped below darktrap@128,272 by a hit (the SEAL)',
                'cleared-walk': 'with {63,4} cleared there is no trap and UP crosses the column to [8,15] hitless (the control)',
                'pole-lit-wait': 'with {63,7} cleared the pole is built lit; after a wait UP crosses the column hitless',
                'arrival-thrust-w': 'a Spear thrust W from the arrival does NOT light lightpole@112,272: the column is not crossed',
                'arrival-thrust-up': 'a Spear thrust UP from the arrival does NOT light it either: the column is not crossed',
                'north-thrust-leave': 'a thrust from [8,16], L65 before the removal and back: the trap is REBUILT and dies again ({63,7}), crossed hitless',
                'removed-then-dark': 'the removal waited out, the pole put OUT, L65 and back: NO trap ({63,4} holds), crossed hitless',
                'left-alive-walk': 'from the mirror arrival (32,288) with tag 3 standing, UP is stopped below darktrap@32,272 by a hit',
                'left-cleared-walk': 'the mirror with {63,3} cleared: no trap, crossed hitless (the control)',
                'left-north-thrust-leave': 'the mirror: a thrust E from [2,16], L65 before the removal and back: rebuilt, dies again ({63,6}), crossed hitless',
                'left-arrival-thrust-e': 'a Spear thrust E from the mirror arrival does NOT light lightpole@48,272: not crossed',
            }[name];
            check(`${name}: ${what}`, expectL63(name, read),
                JSON.stringify({ levels: read.levels, visits63: read.visits63, minY63: read.minY63, hits: read.hits, trapOnLastVisit: read.trapOnLastVisit, trapDyingOnLastVisit: read.trapDyingOnLastVisit, final: read.final }));
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
