#!/usr/bin/env node
/**
 * Seedling's L16 walk-in block against its five Bobs, ON THE GAME (slice rules-l16-holder-enemies): do the Bobs stop
 * the block on its way to the button that holds lock@320,112 open, where the rules price the entry from (19,7) on
 * Sword|Spear alone?
 *
 * ⛓ THE ROWS. `census-seedling-block-stoppers.mjs`'s five L16 HOLDER rows: pushableblock@256,80 ([16,5]) is the one
 * body that can hold button@272,48 ([17,3], tset 1), the plain Button of lock@320,112 ([20,7], tag 7, re-closing:
 * `seedlingPlaythroughOverlay.RECLOSING_LOCK`). `seedlingBlockPaths.blockHolderSearch` prices the entry from (19,7) on
 * `any(Sword|Spear)`: the block goes E to [17,5] (pushed from [15,5]), the player rounds by breakablerock@304,64
 * ([19,4], Sword|Spear) to [17,6] and pushes it N twice onto the button. The search models no Enemy, and the five
 * bobs (@160,112 @176,16 @208,32 @192,80 @224,96 — [10,7] [11,1] [13,2] [12,5] [14,6]) can enter every cell of that
 * path:
 *   - a walked-in block stops at Enemy (`PushableBlock.as:28`, `solids.push("Enemy", "Player")`; `moveX/moveY` hitting
 *     one resets `tile` to the current one, `:101-108`), and a Bob is an Enemy (`Enemy.as:58`);
 *   - a Bob chases the player inside `runRange` 80 at `moveSpeed` 0.5 in a STRAIGHT line (no path search), keeps still
 *     outside it, stops at Solid and Enemy (`Bob.as:18,21,39,55-76`, `Mobile.as:17`); 8x8 hitbox (`Bob.as:41`);
 *   - it is rebuilt on every entry (`Bob.removed` is empty, `Bob.as:44-47`), so a kill lasts the visit;
 *   - it dies to 3 hits (`Enemy.as:22`) of any attack but Fire (`Enemy.as:141-181`): the Sword press (`Player.as:924`)
 *     and the Spear thrust (`Player.as:989`) — the two items the entry's price already holds.
 *
 * Tapes, each on a FRESH page on the DELIVERED set, the Sword granted (the price's cheaper branch: the rock needs it
 * whichever way the Bobs go), `noDamage` true (the question is the push and the reach, not the hits). Boot on [10,2],
 * the east room's doorway from the row-2 corridor (the way in from the L15/L17 arrivals); the block and the Bobs are
 * sampled from `botMobiles`, the player from `botDrain`. Every tape walks the holder path as the search prices it —
 * to [15,5], push E (the block -> [17,5]), by [16,4] to [18,4], ONE Sword press at the rock [19,4], round by
 * [19,5..7] to [17,6], push N twice (-> [17,4] -> the button [17,3]), then round again and E through the lock to
 * [22,7] — and the Bobs are left alive unless the tape says otherwise:
 *   alive        in along row 2 (north of the water [12..14,3..4]). Witnessed: four of the five chase the player into
 *                the water and drown (`terrain.water: 'dies'`), no Sword hit lands on one, the block is never stopped;
 *   alive-south  in down column 10 and along row 6, clear of the water: two Bobs survive the chase and follow the
 *                player the whole way — they TRAIL the block (wedged on [16,5] against its west face, x 268; onto
 *                [17,5]/[17,4] only after it has left them) and never stand ahead of it;
 *   kill-first   the control: Sword presses at the doorway while they close in (three die, the rest drown), then the
 *                same path south;
 *   lure         alive-south, and the player WAITS 300 ticks at [17,6] behind the block on [17,5] before pushing N:
 *                every chaser presses toward it and none reaches [17,4] (from the west a straight-line chase toward
 *                [17,6] runs into the wall [16,6] and the block's west face);
 *   parked       alive-south, and the player waits 200 ticks on [18,4] after the rock: the trailing Bob wedges at the
 *                block's north-west corner ([16,5]/[16,4], x 268 y 81) and never takes [17,4];
 *   pinned       alive-south, and the player waits 200 ticks on [18,3], NORTH of the path: the Bob DOES come up [16,4]
 *                over [17,4] to the player — and when the player rounds by [19,4..7] to [17,6] it follows, straight
 *                down column 19 (x 308), off the path; the block goes N past where it stood.
 * No lure leaves a Bob on a cell ahead of the block: a straight-line chaser stands between the block and the player
 * only on the player's own side of the loop, and the loop [17,4] -> [19,4..7] -> [17,6] drags it off [17,4]. Where one
 * did stand there (not witnessed), the price already holds its kill verb (Sword|Spear, 3 hits).
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l16-holder-bobs.mjs [--host=http://localhost:8000] [--only=alive,alive-south,kill-first,lure,parked,pinned] [--repeat=N] [--dump]
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
export const LEVEL = 16;
/** [10,2]: the east room's doorway from the row-2 corridor. */
export const BOOT = Object.freeze({ level: LEVEL, x: 160, y: 32 });
/** The block's path to the button, as `blockHolderSearch` finds it: [16,5] -> E [17,5] -> N [17,4] -> N [17,3]. */
export const BLOCK_PATH = Object.freeze(['16,5', '17,5', '17,4', '17,3']);
export const BUTTON = '17,3';
/** Past the lock [20,7]: the east pocket (the stairs to L18). */
export const PAST_LOCK_X = 21;

/** The tapes. Exported for the unit rows. */
export function holderTapes() {
    const tape = (name, inputs, tick_count) => ({
        tape_version: 6, game: 'seedling', noclip: false, noDamage: true, noHazards: [],
        persistence: [], equips: [], save: { totem_parts: [], keys: [], seal_parts: [] },
        name: `l16-holder-bobs-${name}`, description: `probe-seedling-l16-holder-bobs: ${name}`,
        boot: { ...BOOT }, grants: [{ level: LEVEL, items: ['sword'] }],
        tick_count, inputs,
    });
    const walk = (key, from, n) => ({ key, from, to: from + n });
    // One tile's step (16 px): 11 ticks of a held key, then a rest.
    const steps = (t, keys) => keys.map((k, i) => walk(k, t + i * 20, 11));
    const press = (t, dir) => [{ key: dir, from: t, to: t + 1 }, { key: 'primary', from: t + 4, to: t + 5 }];
    // THE HOLDER PATH from [10,2]: E along row 2 to [15,2], S to [15,5]; push E (the block [16,5] -> [17,5]);
    // N/E by [16,4] to [18,4]; the Sword at the rock [19,4]; E/S round by [19,5..7], W to [17,7], N to [17,6];
    // `wait` ticks there; push N twice (the block -> [17,4] -> [17,3], the button); then E by [18,4] and S down
    // [19,5..7] and E through the lock [20,7] to [22,7].
    const path = (t, { wait = 0, approach = 'north', park = 0, atPark = null } = {}) => {
        const out = [];
        const via = approach === 'north'
            ? ['right', 'right', 'right', 'right', 'right', 'down', 'down', 'down']
            : ['down', 'down', 'down', 'down', 'right', 'right', 'right', 'right', 'right', 'up'];
        out.push(...steps(t, via));
        t += via.length * 20;
        out.push(walk('right', t, 60)); // the push E: the block slides 16 px at 0.5 a tick
        t += 80;
        out.push(...steps(t, ['up', 'right', 'right']));
        t += 3 * 20;
        out.push(...press(t, 'right'));
        t += 40 + park;
        if (atPark) {
            const a = atPark(t);
            out.push(...a.inputs);
            t = a.end;
        }
        out.push(...steps(t, ['right', 'down', 'down', 'down', 'left', 'left', 'up']));
        t += 7 * 20 + wait;
        out.push(walk('up', t, 100)); // the push N, twice
        t += 120;
        out.push(...steps(t, ['right', 'right', 'down', 'down', 'down', 'right', 'right', 'right']));
        t += 8 * 20;
        return { inputs: out, end: t };
    };
    // The Bobs killed at the doorway: they chase into Sword range, press after press facing each way they come from.
    const kill = (t) => {
        const out = [];
        for (let i = 0; i < 24; i += 1) out.push(...press(t + i * 25, ['right', 'down', 'up', 'right'][i % 4]));
        return { inputs: out, end: t + 24 * 25 + 20 };
    };
    const alive = path(4);
    const south = path(4, { approach: 'south' });
    const k = kill(4);
    const afterKill = path(k.end, { approach: 'south' });
    const lure = path(4, { approach: 'south', wait: 300 });
    const PARK = 200;
    const parked = path(4, { approach: 'south', park: PARK });
    const pinned = path(4, { approach: 'south', atPark: (t) => ({ inputs: [...steps(t, ['up']), ...steps(t + 20 + PARK, ['down'])], end: t + 40 + PARK }) });
    return {
        alive: tape('alive', alive.inputs, alive.end + 20),
        'alive-south': tape('alive-south', south.inputs, south.end + 20),
        'kill-first': tape('kill-first', [...k.inputs, ...afterKill.inputs], afterKill.end + 20),
        lure: tape('lure', lure.inputs, lure.end + 20),
        parked: tape('parked', parked.inputs, parked.end + 20),
        pinned: tape('pinned', pinned.inputs, pinned.end + 20),
    };
}

const tileOf = (p) => `${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`;
/** The block's top-left is its tile's corner (`setHitbox(16, 16)`, no origin): the tile it is mostly on. */
const blockTileOf = (b) => `${Math.round(b.x / TILE)},${Math.round(b.y / TILE)}`;

/**
 * What one run says. `ticks` = the player (`botDrain`), `samples` = `[{t, block: {x, y}|null, bobs: [{x, y, anim}]}]`.
 * Exported for the unit rows.
 */
export function readRun(ticks = [], samples = []) {
    const inLevel = ticks.filter((o) => o.level === LEVEL);
    const last = samples.at(-1) ?? null;
    const blockTiles = [...new Set(samples.filter((s) => s.block).map((s) => blockTileOf(s.block)))];
    const onButton = samples.find((s) => s.block && blockTileOf(s.block) === BUTTON && s.block.x % TILE === 0 && s.block.y % TILE === 0);
    // A Bob AHEAD of the block: on a path cell the block has not reached yet (the census's question).
    const ahead = (s) => {
        if (!s.block) return [];
        const at = BLOCK_PATH.indexOf(blockTileOf(s.block));
        return s.bobs.map((b) => tileOf(b)).filter((t) => at >= 0 && BLOCK_PATH.indexOf(t) > at);
    };
    return {
        passedLock: inLevel.some((o) => Math.floor(o.x / TILE) >= PAST_LOCK_X),
        finalTile: inLevel.length ? tileOf(inLevel.at(-1)) : null,
        blockFinal: last?.block ? blockTileOf(last.block) : null,
        blockOnButtonAt: onButton?.t ?? null,
        blockTiles,
        bobTiles: [...new Set(samples.flatMap((s) => s.bobs.map((b) => tileOf(b))))],
        bobAhead: [...new Set(samples.flatMap(ahead))],
        bobsAtStart: samples[0]?.bobs.length ?? null,
        // The east room's Bobs (x >= 10 tiles) still alive when the block lands on the button.
        eastBobsAtButton: onButton ? onButton.bobs.filter((b) => b.x >= 10 * TILE).length : null,
        swordKill: samples.some((s) => s.bobs.some((b) => b.anim === 'die')),
    };
}

/** The expectation per tape: the block on the button and the lock passed, every way; Bobs killed only on kill-first. */
export function expectHolder(name, r) {
    const held = r.blockFinal === BUTTON && r.blockOnButtonAt !== null && r.passedLock
        && BLOCK_PATH.every((t) => r.blockTiles.includes(t));
    switch (name) {
        case 'alive': return held && !r.swordKill;
        case 'alive-south': case 'lure': case 'parked': case 'pinned': return held && !r.swordKill && r.eastBobsAtButton >= 1;
        case 'kill-first': return held && r.swordKill && r.eastBobsAtButton === 0;
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

    takeBoxLockOrExit({ name: 'probe-seedling-l16-holder-bobs.mjs', kind: 'browser' });
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
                const block = mobiles.find((m) => /(^|:)PushableBlock$/.test(String(m.cls)));
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
        for (const [name, raw] of Object.entries(holderTapes()).flatMap((e) => Array(repeat).fill(e))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readRun(g.ticks, g.samples);
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                samples: g.samples.length, hits: g.status?.hits ?? null, final: g.ticks.at(-1) ?? null, ...read };
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.includes('--dump')) {
                const fmt = (s) => `${s.t}:${s.block ? blockTileOf(s.block) : "-"}|${s.bobs.filter((b) => b.x > 128).map((b) => `${b.x.toFixed(0)},${b.y.toFixed(0)}${b.anim ? `/${b.anim[0]}` : ""}`).join(";")}`;
                console.log(`TICKS ${g.ticks.filter((o) => o.t % 10 === 0).map((o) => `${o.t}:${tileOf(o)}`).join(' ')}`);
                console.log(`SAMPLES ${g.samples.filter((s, i) => i % 15 === 0).map(fmt).join(' ')}`);
            }
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const what = {
                alive: 'in along row 2, no Bob hit: the block goes [17,5], [17,4] onto the button [17,3], and the player passes the lock [20,7]',
                'alive-south': 'in along row 6, Bobs alive and chasing at the button: the same holder path goes the same way',
                'kill-first': 'with the east room\'s Bobs dead first the same holder path goes the same way',
                lure: 'with the player waiting 300 ticks behind the block, the Bobs pressing toward it, the same path still goes',
                parked: 'with the player waiting 200 ticks on [18,4] (the Bob wedged at the block\'s corner), the same path still goes',
                pinned: 'with the player waiting 200 ticks on [18,3] (the Bob drawn over [17,4]), the same path still goes',
            }[name];
            check(`${name}: ${what}`, expectHolder(name, read), JSON.stringify(read));
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
