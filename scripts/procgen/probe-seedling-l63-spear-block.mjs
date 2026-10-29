#!/usr/bin/env node
/**
 * Seedling's L63 spear block against its DarkTrap, ON THE GAME (slice rules-l63-pole-crossings, Part A): can a Spear holder
 * cross from the r6c9 side (east of the block) into r0c1 WITHOUT lightpole@64,88 lit ({63,1})?
 *
 * ⛓ THE GEOMETRY. pushableblockspear@112,96 stands on [7,6], the one cell of row 6 between the east half ([7,7]..[9,8],
 * the r6c9 side, which reaches [7,6] once the block moves) and the west pocket [5,5]/[5,6]/[6,6]. [7,5] is a wall and
 * [8,6] a pit, so the block moves only W (from [9,6] across the pit, or from [7,6]) or E (into the pit, from the west).
 * darktrap@64,96 (tag 8) stands on [4,6], the pocket's way west; lightpole@64,88 (tag 1) lit kills it, and its one
 * thrust stance in the pocket is [5,5] facing W (`poleThrustStances`), reached only through [5,6].
 *   - A block stops at Enemy (`PushableBlockFire.as:31`, `solids.push("Enemy", "Player")`), and a DarkTrap is an Enemy
 *     (`DarkTrap extends SandTrap extends Enemy`): pushed W the block halts on [5,6] against the trap, sealing [5,5].
 *   - The trap is absent only once `{63,8}` is written, which only its removal does (`SandTrap.as:82-86`); its `hit()` is
 *     empty (`DarkTrap.as:56`), so only a light kills it (`DarkTrap.as:33`) — a lit pole ({63,1}).
 *
 * Tapes, each on a FRESH page on the DELIVERED set, the Spear granted, `noDamage` true (the question is the push and the
 * reach, not the hits; L63's Grenade on [8,8] is on the walk). The block is sampled from `botMobiles`:
 *   east-no-f1     from [9,6]: thrust W, walk round to [7,6], thrust W twice, walk W to the block, thrust W, step W, DOWN to [4,7] — the block
 *                  halts on [5,6], the player never reaches [5,5] or the west side (the maze's claim)
 *   east-f1        the same with `{63,1}` cleared (the pole built lit, the trap dies) — the block goes on into the pit [3,6]
 *                  and the player walks W past [4,6] (the control)
 *   east-f8        the same with `{63,8}` cleared (no trap at all) — as east-f1 (the trap is the only stop)
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l63-spear-block.mjs [--host=http://localhost:8000] [--only=east-no-f1,…] [--repeat=N] [--dump]
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
/** [9,6]: east of the pit [8,6], where a thrust W reaches the block on [7,6]. */
export const EAST = Object.freeze({ level: 63, x: 144, y: 96 });
/** `{63,1}` = lightpole@64,88 lit, `{63,8}` = darktrap@64,96 removed. */
export const POLE_TAG = 1;
export const TRAP_TAG = 8;
/** The block's start (its placement) and the trap's centre as `botMobiles` reports them. */
export const BLOCK_START = Object.freeze({ x: 112, y: 96 });
export const TRAP_AT = Object.freeze({ x: 72, y: 104 });
/** West of this the player is past the trap's column [4,*] (the west side); the pole's stance [5,5] is its own test. */
export const WEST_X = 80;

/** The tapes. Exported for the unit rows. */
export function spearBlockTapes() {
    const tape = (name, { persistence = [] }) => {
        // A one-tick tap to face `dir`, then one thrust.
        const thrust = (t, dir) => [{ key: dir, from: t, to: t + 1 }, { key: 'primary', from: t + 4, to: t + 5 }];
        const walk = (key, from, n) => ({ key, from, to: from + n });
        return {
            tape_version: 6, game: 'seedling', noclip: false, noDamage: true, noHazards: [],
            persistence: persistence.map((tag) => ({ level: 63, tag, note: `probe-seedling-l63-spear-block: {63,${tag}}` })),
            equips: [],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            name: `l63-spear-block-${name}`, description: `probe-seedling-l63-spear-block: ${name}`,
            boot: { ...EAST }, grants: [{ level: 63, items: ['spear'] }],
            tick_count: 520,
            inputs: [
                // The trap's light kill (a lit pole) takes 30 ticks + "die1": the first thrust waits it out.
                ...thrust(60, 'left'),
                // [9,6] → [9,8] (the wall [9,9] stops it) → [7,8] (26 ticks at ~1.2 px a tick, short of the pit [6,8])
                // → [7,6] (the wall [7,5] stops it), round the pit [8,6] and the wall [8,7].
                walk('down', 110, 40), walk('left', 156, 26), walk('up', 190, 50),
                ...thrust(250, 'left'), ...thrust(295, 'left'),
                // W until the block stops the walk, then the last thrust from there (with the trap gone it sends the
                // block on into the pit [3,6]); then a short step W (short of that pit) and a short one DOWN to [4,7] (short of the pit [4,8]).
                walk('left', 340, 40), ...thrust(385, 'left'),
                walk('left', 430, 9), walk('down', 445, 15),
            ],
        };
    };
    return {
        'east-no-f1': tape('east-no-f1', {}),
        'east-f1': tape('east-f1', { persistence: [POLE_TAG] }),
        'east-f8': tape('east-f8', { persistence: [TRAP_TAG] }),
    };
}

/** What one run says. `samples` = `[{t, block: {x, y}|null, trap: bool}]`. Exported for the unit rows. */
export function readRun(ticks, status, samples = []) {
    const in63 = ticks.filter((o) => o.level === 63);
    const tileOf = (o) => [Math.floor(o.x / TILE), Math.floor(o.y / TILE)];
    const lastBlock = [...samples].reverse().find((s) => s.t > 0);
    return {
        minX63: in63.length ? Math.min(...in63.map((o) => o.x)) : null,
        reachedStance: in63.some((o) => `${tileOf(o)}` === '5,5'),
        reachedWest: in63.some((o) => o.x < WEST_X),
        // [4,7], below the trap's cell: the west side proper (r0c1's way to the Spear bridge [2,9]).
        reachedLower: in63.some((o) => `${tileOf(o)}` === '4,7'),
        blockFinal: lastBlock?.block ?? null,
        blockTiles: [...new Set(samples.filter((s) => s.block).map((s) => `${Math.floor(s.block.x / TILE)},${Math.floor(s.block.y / TILE)}`))],
        trapEver: samples.some((s) => s.trap),
        trapAtEnd: lastBlock?.trap ?? null,
        levels: [...new Set(ticks.map((o) => o.level))],
        hits: status?.hits ?? null,
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape. */
export function expectSpearBlock(name, r) {
    switch (name) {
        case 'east-no-f1':
            return !r.reachedStance && !r.reachedWest && r.trapAtEnd === true
                && r.blockFinal !== null && r.blockFinal.x === 80 && r.blockFinal.y === 96;
        case 'east-f1': case 'east-f8':
            return r.reachedWest && r.reachedLower && r.trapAtEnd === false && r.blockTiles.includes('3,6') && r.blockFinal === null;
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

    takeBoxLockOrExit({ name: 'probe-seedling-l63-spear-block.mjs', kind: 'browser' });
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
            // The block and the trap, sampled while the tape runs (`botMobiles`), each stamped with the game's tick.
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
                const trap = mobiles.some((m) => /DarkTrap$/.test(String(m.cls))
                    && Math.abs(m.x - TRAP_AT.x) < 4 && Math.abs(m.y - TRAP_AT.y) < 4 && m.anim !== 'die1');
                if (!st.arm?.pending && st.arm?.armed_at >= 0 && st.level === 63) {
                    samples.push({ t: st.tick, block: block ? { x: block.x, y: block.y } : null, trap });
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
        for (const [name, raw] of Object.entries(spearBlockTapes()).flatMap((e) => Array(repeat).fill(e))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readRun(g.ticks, g.status, g.samples);
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                persistence: tape.persistence.map((c) => `{${c.level},${c.tag}}`), samples: g.samples.length, ...read };
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.includes('--dump')) {
                console.log(`TICKS ${g.ticks.filter((o) => o.t % 10 === 0).map((o) => `${o.t}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
                console.log(`BLOCK ${g.samples.filter((s, i, a) => i === 0 || JSON.stringify(s.block) !== JSON.stringify(a[i - 1].block) || s.trap !== a[i - 1].trap).map((s) => `${s.t}:${s.block ? `${s.block.x},${s.block.y}` : '-'}${s.trap ? '+trap' : ''}`).join(' ')}`);
            }
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const what = {
                'east-no-f1': 'without {63,1} the block halts on [5,6] against darktrap@64,96 and the player never reaches [5,5] or the west side',
                'east-f1': 'with {63,1} cleared (the pole lit) the trap dies, the block goes into the pit [3,6], the player walks W past [4,6]',
                'east-f8': 'with {63,8} cleared (no trap) the block goes into the pit and the player walks W past [4,6]',
            }[name];
            check(`${name}: ${what}`, expectSpearBlock(name, read),
                JSON.stringify({ minX63: read.minX63, reachedStance: read.reachedStance, reachedWest: read.reachedWest, blockFinal: read.blockFinal, blockTiles: read.blockTiles, trapAtEnd: read.trapAtEnd, final: read.final }));
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
