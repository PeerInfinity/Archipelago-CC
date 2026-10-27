#!/usr/bin/env node
/**
 * Seedling's L12 → L83 door, ON THE GAME (slice rules-l12-bosslock-probe): survey route steps 172/203 (L12 visits
 * 14/16, `reach-exit` teleporter@32,848 → L83; 167/198 at fidelity CHESTSEAL's base) refuse KEYLOCK-SEALED on
 * `bosslock@112,192`, "flag {12,11} held". Is that lock on the way, and does the rules' charge (Wand + Yellow Key, past
 * the Swim edge r0c19 → r42c28) reach L83 from the arrival?
 *
 * ⛓ THE LOCKS (`assets/levels/OverWorld/region1.oel`, L12 = OverWorld1_1):
 *   - `bosslock@112,192` keyType 4 (Yellow) tag 11 stands between `stairsdown@96,240` (→ L5) and the north of the room.
 *     `BossLock.update` opens on `collideLine("Player", …)` on the row UNDER the lock (`BossLock.as:62`, y 209), so it
 *     opens from the south only; its removal writes the tag FALSE (`:81`), and `check()` removes a lock whose tag reads
 *     false at build (`:43-46`). The persistence table starts all-TRUE (`Main.levelPersistence`, `persistenceClearedList`
 *     lists the false ones), so "flag {12,11} held" = TRUE = the lock stands. The rules carry it the same way:
 *     `L12 flag 11` lives in r13c6 (the L5 stairs pocket, its key side) and gates only r0c19 → r13c6.
 *   - The goal `teleporter@32,848` is closed on every side but the south, where `bosslock@32,864` (keyType 4, tag 12,
 *     key line y 881) and `magicallock@32,864` (tag 7, opened by a `WandShot`) are STACKED on one tile. The south strip
 *     under them is reached from the row-48 water through a 13 px cliffside gap (x 202..214 at y 896).
 *
 * Tapes, each on a FRESH page on the DELIVERED set, the survey's staging (`r8-solve-11`'s block re-pointed at the boot,
 * the route's keys [0..4], items, seals and cleared flags at step 172), `noDamage` false:
 *   lock11-north-shut    north of bosslock@112,192 with key 4, DOWN into it — NOT passed, {12,11} not written
 *   lock11-south-opens   south of it (its key line), UP — the game writes {12,11} and the player passes north
 *   lock11-cleared-north {12,11} cleared at boot (the state the game just wrote), north, DOWN — no lock, passed south
 *   doors-key-wand       under the stacked locks with key 4: UP onto the key line, wait the fade, select the Wand, shoot
 *                        UP, walk UP — {12,12} and {12,7} written, into L83
 *   doors-key-only       the same with no shot — {12,12} written, {12,7} not, still in L12 (the Wand is needed)
 *   doors-wand-no-key    keys [0..3], the shot and the walk — {12,12} not written, still in L12 (the key is needed);
 *                        whether the shot reaches the magical lock behind a standing bosslock is RECORDED, not asserted
 *   arrival-chain        the arrival (168,384) of step 172 with only `burnabletree@480,640` {12,2} and
 *                        `shieldlocknorm@288,704` {12,10} pre-cleared (so neither Fire nor the Shield can be the
 *                        way): the SOLVER's own walk for `clear-tag {12,12}` (Swim, through the 13 px gap to the key
 *                        line), then doors-key-wand's tail — into L83, with {12,11} never written
 * And two MODEL rows (`INFO`, not checks: they are the gap this probe hands to fidelity, and they flip when it closes):
 *   model-arrival        the solver from the survey's step-172 staging: its verdict and refusal
 *   model-under-locks    the solver from (40,888), right under the stacked locks: its verdict and refusal
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, `INFO {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l12-bosslock.mjs [--host=http://localhost:8000] [--only=doors-key-wand,…] [--repeat=N] [--no-model] [--dump]
 * `--repeat=N` runs every tape N times, each on its own fresh page (the 8x a slice owes, in one CI job).
 * `--no-model` skips the two MODEL rows (≈1 min of solving).
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
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** Step 172's arrival (L36's teleporter lands under teleporter@168,368). */
export const ARRIVAL = Object.freeze({ level: 12, x: 168, y: 384 });
/** Tile (7,11), north of bosslock@112,192 (tile (7,12)); tile (7,13), south of it, on its key line. */
export const LOCK11_NORTH = Object.freeze({ level: 12, x: 112, y: 176 });
export const LOCK11_SOUTH = Object.freeze({ level: 12, x: 112, y: 208 });
/** Tile (2,55), under the stacked locks at tile (2,54). */
export const UNDER_DOORS = Object.freeze({ level: 12, x: 32, y: 880 });
export const LOCK11 = Object.freeze({ id: 'bosslock@112,192', tag: 11, top: 192, bottom: 208 });
export const DOOR_LOCK = Object.freeze({ id: 'bosslock@32,864', tag: 12 });
export const DOOR_MAGIC = Object.freeze({ id: 'magicallock@32,864', tag: 7 });
export const TREE_TAG = 2;
export const SHIELDLOCK_TAG = 10;
/** The goal and its aim: `reach-exit` teleporter@32,848 → L83. */
export const GOAL = Object.freeze({ kind: 'reach-exit', exit: Object.freeze({ x: 32, y: 848 }) });
export const TO = 83;

/** The survey's staging at step 172 (`views/step-172-boot.json` at base 6f5916203e): keys, items, seals, clears. */
export const STEP172 = Object.freeze({
    keys: [0, 1, 2, 3, 4],
    items: ['canSwim', 'hasDarkSword', 'hasFeather', 'hasFire', 'hasShield', 'hasSpear', 'hasTorch', 'hasWand'],
    seal_parts: [...Array(16).keys()],
    totem_parts: [0, 1, 2, 3, 4],
    clears: [[0, 1], [16, 0], [19, 1], [31, 0], [30, 2], [30, 0], [12, 3], [39, 8], [40, 8], [58, 1], [62, 0], [68, 0]]
        .map(([level, tag]) => Object.freeze({ level, tag })),
});

/** The survey's staging for one boot (`l12keylineStaging`'s construction, with step 172's save). */
export async function l12Staging(boot, { keys = STEP172.keys, extraClears = [] } = {}) {
    const { l12keylineStaging } = await import('./plan-seedling-l12keyline-witness.mjs');
    const staging = await l12keylineStaging({ boot, keys: [], items: STEP172.items,
        clears: [...STEP172.clears, ...extraClears.map((tag) => ({ level: 12, tag }))] });
    staging.save = { ...staging.save, keys: [...keys], seal_parts: [...STEP172.seal_parts],
        totem_parts: [...STEP172.totem_parts] };
    return staging;
}

/** The Wand's slot under step 172's items (`Inventory.addItemsFromSave`'s order). */
export async function wandSlot(staging) {
    const { inventorySlotsFor, INVENTORY_ITEM_IDS } = await import(join(MODULE, 'tapeFormat.js'));
    return inventorySlotsFor(staging.seam.items).indexOf(INVENTORY_ITEM_IDS.wand);
}

/**
 * The stacked doors' tail from a stance on the key line, starting at tick `t`: UP onto the line for 100 ticks (the
 * bosslock's `keyTimer` 60 + a 20-tick fade), then select the Wand and shoot UP, then walk UP into the teleporter.
 */
export function doorsTail(t, slot, { shoot = true } = {}) {
    return {
        inputs: [{ key: 'up', from: t, to: t + 100 }, ...(shoot ? [{ key: 'primary', from: t + 106, to: t + 107 }] : []),
            { key: 'up', from: t + 140, to: t + 300 }],
        equips: shoot ? [{ t: t + 104, slot }] : [],
        ticks: t + 320,
    };
}

/** The tapes. `arrival-chain` asks the solver (≈30 s); the rest are written here. Exported for the unit rows. */
export async function l12Tapes({ chain = true } = {}) {
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { requiredTapeVersion } = await import(join(MODULE, 'tapeFormat.js'));
    const tape = (name, staging, { inputs, equips = [], ticks }) => {
        const t = { ...staging, game: 'seedling', name: `l12-bosslock-${name}`,
            description: `probe-seedling-l12-bosslock: ${name}`, noclip: false, noDamage: false, noHazards: [],
            grants: [], equips, tick_count: ticks, inputs };
        return { ...t, tape_version: requiredTapeVersion(t, 8) };
    };
    const north = await l12Staging(LOCK11_NORTH);
    const slot = await wandSlot(north);
    const under = await l12Staging(UNDER_DOORS);
    const noKey = await l12Staging(UNDER_DOORS, { keys: [0, 1, 2, 3] });
    const out = {
        'lock11-north-shut': tape('lock11-north-shut', north, { inputs: [{ key: 'down', from: 10, to: 150 }], ticks: 160 }),
        'lock11-south-opens': tape('lock11-south-opens', await l12Staging(LOCK11_SOUTH),
            { inputs: [{ key: 'up', from: 10, to: 170 }], ticks: 180 }),
        'lock11-cleared-north': tape('lock11-cleared-north', await l12Staging(LOCK11_NORTH, { extraClears: [LOCK11.tag] }),
            { inputs: [{ key: 'down', from: 10, to: 45 }], ticks: 60 }),
        'doors-key-wand': tape('doors-key-wand', under, doorsTail(0, slot)),
        'doors-key-only': tape('doors-key-only', under, doorsTail(0, slot, { shoot: false })),
        'doors-wand-no-key': tape('doors-wand-no-key', noKey, doorsTail(0, slot)),
    };
    if (chain) {
        const staging = await l12Staging(ARRIVAL, { extraClears: [TREE_TAG, SHIELDLOCK_TAG] });
        const solved = await solveFrom(staging, [{ kind: 'clear-tag', tag: { level: 12, tag: DOOR_LOCK.tag },
            at: { x: 32, y: 864 }, obstacle: DOOR_LOCK.id }], 'l12-bosslock-arrival-chain');
        const built = buildStagedTape({ staging: { ...staging, persistence: solved.persistence,
            equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
        perTick: solved.out.perTick, name: 'l12-bosslock-arrival-chain' });
        const n = solved.out.perTick.length;
        const tail = doorsTail(n, slot);
        out['arrival-chain'] = { ...built, description: `probe-seedling-l12-bosslock: arrival-chain (the solver's ${n} t `
            + `walk, verbs [${verbsOf(solved).join(', ')}], then the doors' tail)`,
        inputs: [...built.inputs, ...tail.inputs], equips: [...(built.equips ?? []), ...tail.equips],
        tick_count: tail.ticks, planTicks: n, planVerbs: verbsOf(solved) };
    }
    return out;
}

function verbsOf(solved) {
    return (solved.out.trace?.rows ?? []).map((r) => `${r.strategy?.verb ?? '?'}${r.obstacle?.id ? `(${r.obstacle.id})` : ''}`);
}

/** The solver from one staging (the survey's `twoPassSolve`). Throws its refusal. */
export async function solveFrom(staging, goals, name) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const levelSource = atlasLevelSource();
    return twoPassSolve({ makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals, name, boot: staging.boot, dashMode: 'all', persistence: staging.persistence, log: () => {} });
}

/**
 * What one run says. `cleared` = the game's `persistence_cleared` for L12 at the end LESS the first sample's (what
 * the run itself wrote). Exported for the unit rows.
 */
export function readRun(ticks, firstCleared = [], lastCleared = []) {
    const in12 = ticks.filter((o) => o.level === 12);
    const wrote = lastCleared.filter((c) => !firstCleared.includes(c));
    return {
        levels: [...new Set(ticks.map((o) => o.level))],
        minY12: in12.length ? Math.min(...in12.map((o) => o.y)) : null,
        maxY12: in12.length ? Math.max(...in12.map((o) => o.y)) : null,
        wrote: wrote.filter((c) => c.startsWith('12:')).sort(),
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape. */
export function expectL12(name, r) {
    const has = (tag) => r.wrote.includes(`12:${tag}`);
    const inL83 = r.levels.includes(TO);
    switch (name) {
        case 'lock11-north-shut': return !has(LOCK11.tag) && r.maxY12 < LOCK11.bottom && !inL83;
        case 'lock11-south-opens': return has(LOCK11.tag) && r.minY12 <= LOCK11_NORTH.y;
        case 'lock11-cleared-north': return r.maxY12 >= LOCK11.bottom;
        case 'doors-key-wand': return has(DOOR_LOCK.tag) && has(DOOR_MAGIC.tag) && inL83;
        case 'doors-key-only': return has(DOOR_LOCK.tag) && !has(DOOR_MAGIC.tag) && !inL83;
        case 'doors-wand-no-key': return !has(DOOR_LOCK.tag) && !inL83;
        case 'arrival-chain': return has(DOOR_LOCK.tag) && has(DOOR_MAGIC.tag) && !has(LOCK11.tag) && inL83;
        default: return false;
    }
}

const WHAT = {
    'lock11-north-shut': 'from the north with key 4, DOWN into bosslock@112,192 does NOT open it: not passed, {12,11} not written (the far side)',
    'lock11-south-opens': 'from its key line (south) UP opens it: the game writes {12,11} and the player passes north',
    'lock11-cleared-north': 'with {12,11} cleared at boot the lock is not built: from the north DOWN passes it',
    'doors-key-wand': 'under the stacked locks: key line, fade, Wand shot UP, walk UP — {12,12} and {12,7} written, into L83',
    'doors-key-only': 'the same with no shot: {12,12} written, {12,7} NOT, still in L12 (the Wand is needed)',
    'doors-wand-no-key': 'without key 4: {12,12} NOT written, still in L12 (the Yellow Key is needed)',
    'arrival-chain': 'from step 172\'s arrival, Fire and Shield doors pre-cleared: the solver\'s Swim walk to the key line, then key + Wand — into L83, {12,11} never written',
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
    const M = (p) => import(join(MODULE, p));
    const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const set = vanillaRecordSet(EMBED, MAP).set;
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-l12-bosslock.mjs', kind: 'browser' });
    const only = arg('only', null)?.split(',');
    const want = (n) => !only || only.includes(n);
    if (!process.argv.includes('--no-model')) {
        for (const [name, boot] of [['model-arrival', ARRIVAL], ['model-under-locks', { ...UNDER_DOORS, x: 40, y: 888 }]]) {
            if (!want(name)) continue;
            const t0 = Date.now();
            let row;
            try {
                const s = await solveFrom(await l12Staging(boot), [GOAL], `l12-bosslock-${name}`);
                row = { verdict: 'SOLVED', ticks: s.out.perTick.length, verbs: verbsOf(s) };
            } catch (e) {
                row = { verdict: 'REFUSED', refusal: String(e.message).split('\n')[0].slice(0, 400) };
            }
            console.log(`INFO ${JSON.stringify({ model: name, boot, ...row, ms: Date.now() - t0 })}`);
        }
    }
    const tapes = await l12Tapes({ chain: !only || only.includes('arrival-chain') });

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
    const clearedOf = (st) => (st?.persistence_cleared ?? []).map((c) => (typeof c === 'string' ? c : `${c.level}:${c.tag}`));
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
            // The cleared set at the first armed sample (the boot's own clears applied) and at the end.
            let first = null;
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = JSON.parse(String(await page.evaluate(() => window.__swfBridge.game.botStatus())));
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                if (first === null && !st.arm?.pending && st.arm?.armed_at >= 0) first = clearedOf(st);
                return st?.finished ? st : null;
            }, 15 * 60 * 1000, 20);
            const drained = await json(page, 'botDrain');
            return { status, mounted, first: first ?? [], last: clearedOf(status),
                ticks: (drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })) };
        } finally {
            await page.close();
        }
    };
    try {
        const repeat = Math.max(1, Number(arg('repeat', '1')) || 1);
        for (const [name, raw] of Object.entries(tapes).flatMap((e) => Array(repeat).fill(e))) {
            if (!want(name)) continue;
            const { planTicks, planVerbs, ...fields } = raw;
            const tape = parseTape({ ...fields, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readRun(g.ticks, g.first, g.last);
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                boot: tape.boot, ...(planTicks ? { planTicks, planVerbs } : {}), hits: g.status?.hits ?? null, ...read };
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.includes('--dump')) console.log(`TICKS ${g.ticks.filter((o) => o.t % 10 === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            check(`${name}: ${WHAT[name]}`, expectL12(name, read),
                JSON.stringify({ levels: read.levels, minY12: read.minY12, maxY12: read.maxY12, wrote: read.wrote, final: read.final }));
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
