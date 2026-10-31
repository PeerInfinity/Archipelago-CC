#!/usr/bin/env node
/**
 * Seedling's L65 spear block against its Bob, ON THE GAME (slice rules-block-stoppers): does a chasing Bob stop the
 * pushed block where the rules let the crossing r0c8 -> r4c11 through on the Spear alone?
 *
 * ⛓ THE ROW. `census-seedling-block-stoppers.mjs`'s one MOBILE row: pushableblockspear@176,128 stands on [11,8], the
 * one way from the r0c8 side ([12,8], east of it) into r4c11 ([10..11,6..8] and the [11..13,4..5] ledge). The rules'
 * push search (`seedlingBlockPaths.blockCrossingCost`) prices the crossing on the Spear alone; the block must leave by
 * [10,8] and [10,7] (pushed W from [12,8], then N over the pit [10,9] from [10,10]), and bob@208,80 (spawn [13,5], in
 * r4c11) can stand on both: parked there, the search says the crossing closes.
 *   - A block stops at Enemy (`PushableBlockFire.as:31`, `solids.push("Enemy", "Player")`; a Bob is an Enemy,
 *     `Enemy.as:58`). A Bob chases the player inside `runRange` 80 at 0.5 px a tick and keeps still outside it
 *     (`Bob.as:18,21,55-76`), stops at Solid and at Enemy (`Mobile.as:17`, `Bob.as:39`), and is rebuilt on every entry
 *     (no persistence write: `Bob.removed` is empty, `Bob.as:44-47`).
 *   - The push is a THRUST: `Player.spear()` collides a 32x5 rect with EVERY hitable (`Player.as:960-990`), so the
 *     thrust that moves the block also lands on a Bob within 32 px down the line, at `spearDamage` 2 and `spearForce` 7
 *     (`Player.as:144-145`); a Bob takes 3 (`Enemy.as:22`). The push item is a kill verb for it.
 *
 * Tapes, each on a FRESH page on the DELIVERED set, the Spear granted, `noDamage` true (the question is the push and the
 * reach, not the hits). Boot on [12,8]; the block and every Bob are sampled from `botMobiles`, the player from `botDrain`:
 *   alive        the crossing as the push search prices it, the Bob left alive: thrust W ([11,8] -> [10,8]); round the
 *                pit [10,9] to [10,10] and thrust N over it ([10,8] -> [10,7]); from [12,7] thrust W over the wall [11,7]
 *                ([10,7] -> the pit [9,7], destroyed); walk in by [11,8], [10,8], [10,7], [10,6], [11,6] to the ledge
 *                [11,5]/[12,5]. Witnessed: the Bob chases, but pressing toward the player it is held on the ledge row by
 *                the wall [12,6] (x 203.9 .. 183, y ~92) and never stands on [10,7]/[10,8]; the block is never stopped
 *   kill-first   the control: from [12,7] three thrusts N reach the Bob on the ledge above (through the wall [12,6]); it
 *                dies (anim "die" at t ~215), then the same crossing — the same answer
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l65-bob-block.mjs [--host=http://localhost:8000] [--only=alive,kill-first] [--repeat=N] [--dump]
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
export const LEVEL = 65;
/** [12,8]: east of the block, the r0c8 side (the crossing's `start`). */
export const EAST = Object.freeze({ level: LEVEL, x: 192, y: 128 });
/** The Bob's spawn centre as `botMobiles` reports it (bob@208,80 + `Bob.as:34`'s half tile). */
export const BOB_SPAWN = Object.freeze({ x: 216, y: 88 });

/** The tapes. Exported for the unit rows. */
export function bobBlockTapes() {
    const tape = (name, inputs, tick_count) => ({
        tape_version: 6, game: 'seedling', noclip: false, noDamage: true, noHazards: [],
        persistence: [], equips: [], save: { totem_parts: [], keys: [], seal_parts: [] },
        name: `l65-bob-block-${name}`, description: `probe-seedling-l65-bob-block: ${name}`,
        boot: { ...EAST }, grants: [{ level: LEVEL, items: ['spear'] }],
        tick_count, inputs,
    });
    // A one-tick tap to face `dir`, then one thrust.
    const thrust = (t, dir) => [{ key: dir, from: t, to: t + 1 }, { key: 'primary', from: t + 4, to: t + 5 }];
    const walk = (key, from, n) => ({ key, from, to: from + n });
    // One tile's step (16 px): 11 ticks of a held key (~1.2 px a tick, plus the slide out of it), then a rest.
    const steps = (t, keys) => keys.map((k, i) => walk(k, t + i * 20, 11));
    // THE CROSSING, as the push search prices it (from [12,8], the Spear held): thrust W (the block [11,8] -> [10,8]);
    // round the pit [10,9] to [10,10] and thrust N over it ([10,8] -> [10,7]); back to [12,7] and thrust W over the
    // wall [11,7] ([10,7] -> the pit [9,7], the block destroyed); then walk in by [11,8], [10,8], [10,7], [10,6], [11,6]
    // to the ledge [11,5]/[12,5] (r4c11).
    const crossing = (t) => [
        ...thrust(t, 'left'),
        ...steps(t + 50, ['down', 'left', 'down', 'left']),
        ...thrust(t + 140, 'up'),
        ...steps(t + 190, ['right', 'up', 'right', 'up', 'up']),
        ...thrust(t + 300, 'left'),
        ...steps(t + 350, ['down', 'left', 'left', 'up', 'up', 'right', 'up', 'right']),
    ];
    const CROSS = 520;
    // The Bob killed first: from [12,7] (one step N) it stands on the ledge above, inside one thrust N (`Player.as:960-990`,
    // 32 px through the wall [12,6]); three thrusts, 50 ticks apart (its i-frames are 30, `Enemy.as:24`); back to [12,8].
    const kill = (t) => [walk('up', t, 11), ...thrust(t + 150, 'up'), ...thrust(t + 200, 'up'), ...thrust(t + 250, 'up'), walk('down', t + 290, 11)];
    return {
        alive: tape('alive', crossing(4), 4 + CROSS),
        'kill-first': tape('kill-first', [...kill(4), ...crossing(330)], 330 + CROSS),
    };
}

const tileOf = (p) => `${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`;
/** The cells the census finds critical to the crossing (a Bob parked on either closes it). */
export const CRITICAL = Object.freeze(['10,7', '10,8']);
/** r4c11's ledge, where the crossing ends: [11,5] / [12,5]. */
export const LEDGE = Object.freeze(['11,5', '12,5']);

/**
 * What one run says. `ticks` = the player (`botDrain`), `samples` = `[{t, block: {x, y}|null, bobs: [{x, y, anim}]}]`.
 * Exported for the unit rows.
 */
export function readRun(ticks = [], samples = []) {
    const inLevel = ticks.filter((o) => o.level === LEVEL);
    const last = samples.at(-1) ?? null;
    const bobTiles = [...new Set(samples.flatMap((s) => s.bobs.map((b) => tileOf(b))))];
    return {
        reachedLedge: inLevel.some((o) => LEDGE.includes(tileOf(o))),
        finalTile: inLevel.length ? tileOf(inLevel.at(-1)) : null,
        blockFinal: last?.block ?? null,
        blockTiles: [...new Set(samples.filter((s) => s.block).map((s) => tileOf(s.block)))],
        bobTiles,
        bobOnCritical: bobTiles.some((t) => CRITICAL.includes(t)),
        bobAtEnd: last ? last.bobs.length : null,
        bobDiedAt: samples.find((s) => s.bobs.some((b) => b.anim === 'die'))?.t ?? null,
    };
}

/** The expectation per tape. */
export function expectBobBlock(name, r) {
    // The crossing, either way: the block leaves by [10,8] and [10,7] and is destroyed in the pit [9,7]; the player
    // stands on r4c11's ledge.
    const crossed = r.reachedLedge && r.blockFinal === null && ['11,8', '10,8', '10,7', '9,7'].every((t) => r.blockTiles.includes(t));
    switch (name) {
        case 'alive': return crossed && r.bobAtEnd === 1 && r.bobDiedAt === null && !r.bobOnCritical;
        case 'kill-first': return crossed && r.bobAtEnd === 0 && r.bobDiedAt !== null && r.bobDiedAt < 330;
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

    takeBoxLockOrExit({ name: 'probe-seedling-l65-bob-block.mjs', kind: 'browser' });
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
            // The block and the Bobs, sampled while the tape runs (`botMobiles`), each stamped with the game's tick.
            const samples = [];
            const status = await waitFor(page, 'the tape to finish', async () => {
                const raw = await page.evaluate(() => {
                    const g = window.__swfBridge.game;
                    return [String(g.botStatus()), String(g.botMobiles())];
                });
                const st = JSON.parse(raw[0]);
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                const mobiles = JSON.parse(raw[1]).mobiles ?? [];
                const block = mobiles.find((m) => /PushableBlockSpear$/.test(String(m.cls)));
                const bobs = mobiles.filter((m) => /(^|:)Bob$/.test(String(m.cls)))
                    .map((m) => ({ x: m.x, y: m.y, ...(m.anim ? { anim: m.anim } : {}) }));
                if (!st.arm?.pending && st.arm?.armed_at >= 0 && st.level === LEVEL) {
                    samples.push({ t: st.tick, block: block ? { x: block.x, y: block.y } : null, bobs });
                }
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
        for (const [name, raw] of Object.entries(bobBlockTapes()).flatMap((e) => Array(repeat).fill(e))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readRun(g.ticks, g.samples);
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                samples: g.samples.length, hits: g.status?.hits ?? null, final: g.ticks.at(-1) ?? null, ...read };
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.includes('--dump')) {
                const fmt = (s) => `${s.t}:${s.block ? `${s.block.x},${s.block.y}` : '-'}|${s.bobs.map((b) => `${b.x.toFixed(1)},${b.y.toFixed(1)}${b.anim ? `/${b.anim}` : ''}`).join(';')}`;
                console.log(`TICKS ${g.ticks.filter((o) => o.t % 5 === 0).map((o) => `${o.t}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
                console.log(`SAMPLES ${g.samples.filter((s, i) => i % 10 === 0).map(fmt).join(' ')}`);
            }
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const what = {
                alive: 'with the Bob alive the block goes [10,8], [10,7] and into the pit [9,7], the player reaches r4c11\'s ledge, and the Bob never stands on [10,7]/[10,8]',
                'kill-first': 'with the Bob killed first (thrusts N from [12,7]) the same crossing goes the same way',
            }[name];
            check(`${name}: ${what}`, expectBobBlock(name, read), JSON.stringify(read));
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
