#!/usr/bin/env node
/**
 * Seedling LETHAL LANDINGS, THE GAME'S WAY (rules `rules-game-truth-gaps`, R2). Every landing the
 * `seedling_playthrough` rules put a player on (each sub-region exit's `resolveArrivalSpawn`, the runtime
 * binding's own answer, as `model-coverage/probe-arrivals` enumerated them) whose tile is LETHAL TERRAIN in the
 * physics model (`seedlingLethalArrivals.lethalTerrainUnder`). Derived from the committed rules, never typed.
 *
 * Each landing is booted on the bare wasm game exactly as a door does it, `new Game(level, x, y)` (the tape's
 * `boot`), with water, lava and pits ARMED and no items:
 *   - idle, and under each held direction (up/down/left/right), for `--ticks`: does the GAME kill the arrival
 *     (`die()` -> `restartLevel()` -> `new Game(level, playerPosition)`), leave the level (`level` changes),
 *     or let it live?
 *     ⛔ A DEATH IS READ OFF `botStatus.dead_frames`, NEVER OFF THE POSITION. The drown spiral holds the player
 *     still and the restart re-places it at the same landing, so the x/y/level ticks of an idle drown are one
 *     point from first to last (measured: L50 (32,16), 180 ticks, 1 distinct position, 5 restarts). Each
 *     restart is a ~20-frame fade the tape does not advance through: `dead_frames` read at the first live
 *     tick (the boot's own fade) and at the end; with no level change, any growth is a restart. With the
 *     conch the same boot stays at the boot's count.
 *   - CONTROL: idle with the item the terrain's transcription row names (`canSwim` -> conch,
 *     `hasDarkSuit` -> darksuit): no death.
 * Each row is compared with the physics model's verdict (`arrivalIsLethal`) and the generator's gate (the
 * committed rules: does the edge that lands there require the saving item?).
 *
 * One REAL crossing too (`--cross`, default on): boot in L53 beside `teleporter@208,64 {to 48}` and walk
 * right through it. The game itself picks the landing (`playerx/playery`); the row reports where it put the
 * player and whether the player then drowns: the landing data is the game's, not ours.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}` measurement rows, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build
 * (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: node scripts/procgen/probe-seedling-lethal-landings.mjs [--host=http://localhost:8000]
 *      [--only=<level>,<level>] [--ticks=180] [--cross=on|off] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { headlessWebgpuArgs } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
/** The preset, by its rules file. */
export const RULES_FILE = 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json';
/** The real crossing: L53's door to L48, approached from the land west of it. */
export const CROSSING = Object.freeze({ boot: { level: 53, x: 192, y: 64 }, key: 'right', to: 48 });
/** The terrain flag -> the tape item that grants it (`tapeFormat.ITEM_PROPERTIES`, read, not typed). */
const INPUTS = [null, 'up', 'down', 'left', 'right'];

/**
 * The lethal landings of the committed rules: `{level, x, y, regions[], cameFrom[], flag}`. `flag` is the
 * terrain's own transcription condition (`canSwim`/`hasDarkSuit`).
 */
export async function lethalLandingsOfRules(rules, mapDoc) {
    const imp = (p) => import(join(REPO, p));
    const { resolveArrivalSpawn } = await imp('frontend/modules/flashPanel/seedlingRegionBinding.js');
    const { returnSpawnTable } = await imp('frontend/modules/flashPanel/seedlingReturnSpawns.js');
    const { lethalTerrainUnder } = await imp('frontend/modules/seedlingDemo/seedlingLethalArrivals.js');
    const SEM = await imp('frontend/modules/flashPanel/seedlingSemantics.js');
    const returns = returnSpawnTable(mapDoc);
    const slot = Object.keys(rules.preset_sidecars)[0];
    const out = new Map();
    for (const [region, side] of Object.entries(rules.preset_sidecars[slot])) {
        const w = side.playable_payload;
        if (!w || !Number.isFinite(w.level)) continue;
        const level = mapDoc.levels.find((l) => l.level === w.level);
        for (const e of w.exits ?? []) {
            const s = resolveArrivalSpawn(w, { exit_id: e.exit_id }, returns);
            if (!s) continue;
            const terrain = lethalTerrainUnder(level, s.x, s.y);
            if (!terrain) continue;
            const key = `${s.level},${s.x},${s.y}`;
            if (!out.has(key)) {
                const placement = level.layers.filter((l) => l.name !== 'cliffsides').flatMap((l) => l.tiles ?? [])
                    .find(([x, y]) => x === terrain.tile[0] && y === terrain.tile[1]);
                const row = SEM.tileSemantics(SEM.tileTypeForPlacement(placement));
                out.set(key, { level: s.level, x: s.x, y: s.y, regions: [], flag: row.condition?.flag ?? null, label: row.label });
            }
            out.get(key).regions.push(`${region}/${e.exit_id}`);
        }
    }
    return [...out.values()];
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const TICKS = Number(arg('ticks', '180'));
    const ONLY = arg('only', '') ? arg('only', '').split(',').map(Number) : null;
    const CROSS = arg('cross', 'on') !== 'off';
    const rules = JSON.parse(readFileSync(join(REPO, RULES_FILE), 'utf8'));
    const PAGE_NAME = rules.flash_panel?.[Object.keys(rules.flash_panel ?? {})[0]]?.wasm
        ?? Object.values(rules).find((v) => v?.['1']?.flash_panel)?.['1']?.flash_panel?.wasm ?? 'seedling_bot_ap_p4f';
    const page0 = typeof PAGE_NAME === 'string' && PAGE_NAME.includes('/') ? PAGE_NAME.split('/')[0] : PAGE_NAME;
    const WASM_DIR = join(REPO, 'frontend/modules/flashPanel/wasm', page0);
    if (!existsSync(WASM_DIR)) { console.log(`SKIP: no wasm artifact at ${WASM_DIR}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${page0}/game.html`;

    const { patchedMapDocument } = await import(join(REPO, 'frontend/modules/seedlingDemo/seedlingSetPatches.js'));
    const { levelSourceFromAtlas } = await import(join(REPO, 'frontend/modules/seedlingDemo/atlasSource.js'));
    const { arrivalIsLethal } = await import(join(REPO, 'frontend/modules/seedlingDemo/seedlingLethalArrivals.js'));
    const { ITEM_PROPERTIES, PIN_NAMES, parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
    const { spawnFromBoot } = await import(join(REPO, 'frontend/modules/seedlingDemo/playerPhysicsV1.js'));
    const MAP = patchedMapDocument(JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8')));
    const levelSource = levelSourceFromAtlas(MAP);
    const itemFor = (flag) => Object.entries(ITEM_PROPERTIES).find(([, v]) => v.property === flag)?.[0] ?? null;

    // Which edges land there, and do the rules charge them the saving item? (the AP region graph)
    const REG = rules.regions[Object.keys(rules.regions)[0]];
    const side = rules.preset_sidecars[Object.keys(rules.preset_sidecars)[0]];
    const ruleText = (r) => JSON.stringify(r ?? null);
    const gatesOf = (landing, item) => landing.regions.flatMap((x) => {
        const [reg, exitId] = x.split('/');
        const nb = side[reg].playable_payload.exits.find((e) => e.exit_id === exitId)?.targetRegion;
        if (!nb) return [];
        return (REG[nb]?.exits ?? []).filter((e) => e.connected_region === reg)
            .map((e) => ({ edge: `${nb} -> ${reg}`, charged: ruleText(e.access_rule).includes(`"${item}"`) }));
    });
    const apItemFor = (flag) => ({ canSwim: 'Progressive Swim', hasDarkSuit: 'Dark Suit' })[flag];

    let landings = await lethalLandingsOfRules(rules, MAP);
    if (ONLY) landings = landings.filter((l) => ONLY.includes(l.level));
    console.log(`INFO: ${landings.length} lethal-terrain landing(s) in ${RULES_FILE}; page ${page0}`);

    takeBoxLockOrExit({ name: 'probe-seedling-lethal-landings.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: headlessWebgpuArgs({ enableFeatures: ['WebAssemblyExperimentalJSPI'] }) });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };

    const tapeOf = (name, boot, { items = [], key = null, ticks = TICKS } = {}) => parseTape({
        tape_version: 8, game: 'seedling', name, description: 'probe-seedling-lethal-landings', boot,
        noclip: false, noDamage: false, noHazards: [], grants: items.length ? [{ level: boot.level, items }] : [],
        persistence: [], equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: { seed: 1, split: false }, seam: {},
        tick_count: ticks, inputs: key ? [{ key, from: 0, to: ticks }] : [],
    });

    /** Run tapes on ONE fresh page (the wasm game runs out of memory after ~100 world swaps). */
    async function runTapes(tapes) {
        const page = await browser.newPage();
        const logs = [];
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const bot = (name, a) => page.evaluate(([n, x]) => String(window.__swfBridge.game[n](x)), [name, a]);
        const botJson = async (name, a) => JSON.parse(await bot(name, a));
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i += 1) await page.waitForTimeout(250);
            await page.click('#btn-start');
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i += 1) await page.waitForTimeout(250);
            const out = [];
            for (const tape of tapes) {
                const loaded = await bot('botLoadTape', JSON.stringify(tape));
                if (loaded !== 'ok') throw new Error(`botLoadTape ${tape.name}: ${loaded}`);
                if (await bot('botStart') !== 'ok') throw new Error(`botStart ${tape.name} refused`);
                const deadline = Date.now() + 10 * 60 * 1000;
                let base = null;
                let last = null;
                const samples = [];
                for (;;) {
                    const st = await botJson('botStatus');
                    samples.push({ tick: st.tick, level: st.level, dead: st.dead_frames });
                    // the boot's own fade is over at the first live tick; read the baseline there
                    if (base === null && st.tick >= 1) base = st.dead_frames;
                    last = st;
                    if (st.finished) break;
                    if (st.error) throw new Error(`${tape.name}: ${st.error}`);
                    if (Date.now() > deadline) throw new Error(`${tape.name}: deadline`);
                    await page.waitForTimeout(base === null ? 50 : 200);
                }
                const ticks = (await botJson('botDrain')).ticks ?? [];
                ticks.deadFrames = { base, end: last?.dead_frames ?? null };
                ticks.samples = samples;
                out.push(ticks);
            }
            return out;
        } catch (e) {
            console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
            throw e;
        } finally {
            await page.close();
        }
    }

    const verdictOf = (ticks, boot) => {
        const left = ticks.find((o) => o.level !== boot.level);
        const { base, end } = ticks.deadFrames ?? {};
        if (left) return { verdict: `left->L${left.level}@${left.t}`, deadFrames: { base, end } };
        if (!Number.isFinite(base) || !Number.isFinite(end)) return { verdict: 'unread', deadFrames: { base, end } };
        return { verdict: end > base ? 'dies' : 'alive', deadFrames: { base, end } };
    };

    for (const L of landings) {
        const boot = { level: L.level, x: L.x, y: L.y };
        const item = itemFor(L.flag);
        const tapes = [...INPUTS.map((k) => tapeOf(`land-L${L.level}-${k ?? 'idle'}`, boot, { key: k })),
            tapeOf(`land-L${L.level}-idle-${item}`, boot, { items: [item] })];
        let streams;
        try {
            // eslint-disable-next-line no-await-in-loop
            streams = await runTapes(tapes);
        } catch (e) {
            check(`L${L.level} (${L.x},${L.y}): the wasm runs`, false, String(e.message).split('\n')[0]);
            continue;
        }
        const game = INPUTS.map((k, i) => `${k ?? 'idle'}:${verdictOf(streams[i], boot).verdict}`);
        const dead = INPUTS.map((k, i) => verdictOf(streams[i], boot).deadFrames);
        const control = verdictOf(streams[INPUTS.length], boot);
        const cameFrom = [...new Set(L.regions.map((x) => {
            const [reg, exitId] = x.split('/');
            const nb = side[reg].playable_payload.exits.find((e) => e.exit_id === exitId)?.targetRegion;
            return nb ? Number(/^level_(\d+)/.exec(nb)?.[1]) : null;
        }).filter((v) => v !== null))];
        const level = MAP.levels.find((l) => l.level === L.level);
        const model = arrivalIsLethal(level, L.x, L.y, { levelSource, cameFrom: cameFrom[0] ?? null, ticks: TICKS });
        const gameLethal = game.every((g) => g.endsWith(':dies') || cameFrom.some((c) => g.includes(`left->L${c}@`)));
        const edges = gatesOf(L, apItemFor(L.flag));
        console.log(`ROW ${JSON.stringify({ level: L.level, x: L.x, y: L.y, terrain: L.label, game, control: control.verdict,
            gameLethal, modelLethal: model.lethal, model: model.tries, deadFrames: dead, edges })}`);
        check(`L${L.level} (${L.x},${L.y}) ${L.label}: the game ${gameLethal ? 'kills' : 'does NOT kill'} an item-less arrival; `
            + `the model agrees`, gameLethal === model.lethal, `game ${game.join(' ')} | model ${model.tries.join(' ')}`);
        check(`L${L.level} (${L.x},${L.y}): the ${item} saves it (idle, no death)`, control.verdict === 'alive', control.verdict);
        if (gameLethal) {
            for (const e of edges) check(`L${L.level} (${L.x},${L.y}): the landing edge ${e.edge} requires ${apItemFor(L.flag)}`, e.charged);
        }
    }

    if (CROSS && (!ONLY || ONLY.includes(CROSSING.to))) {
        const boot = CROSSING.boot;
        const [ticks] = await runTapes([tapeOf('cross-L53-L48', boot, { key: CROSSING.key, ticks: 2 * TICKS })]);
        const firstIn = ticks.find((o) => o.level === CROSSING.to);
        const after = firstIn ? ticks.filter((o) => o.level === CROSSING.to) : [];
        const landing = firstIn ? { x: firstIn.x, y: firstIn.y } : null;
        const door = MAP.levels.find((l) => l.level === boot.level).entities
            .find((e) => /teleporter/.test(e.type) && Number(e.attrs?.to) === CROSSING.to);
        const want = door ? spawnFromBoot({ x: Number(door.attrs.playerx), y: Number(door.attrs.playery) }) : null;
        // ⛔ by `dead_frames`, as above: the crossing's own fade is over at the first live L48 tick (a sample in
        //    L48 with a tick past the crossing's); any growth after it, still in L48, is a restart.
        const live = firstIn ? ticks.samples.find((x) => x.level === CROSSING.to && x.tick > firstIn.t) : null;
        const endS = ticks.samples.at(-1);
        const respawns = live && endS.level === CROSSING.to ? endS.dead - live.dead : 0;
        console.log(`ROW ${JSON.stringify({ crossing: `L${boot.level}->L${CROSSING.to}`, landing, door: door && { playerx: door.attrs.playerx, playery: door.attrs.playery }, respawns, ticksInL48: after.length })}`);
        check(`the game crosses L${boot.level} -> L${CROSSING.to} through its door`, !!firstIn);
        check('it lands where the door says (playerx/playery)', !!landing && !!want && landing.x === want.x && landing.y === want.y,
            JSON.stringify({ landing, want }));
        check('and the item-less arrival is killed there (restart fades after the arrival)', respawns > 0, `dead frames after the arrival: ${respawns}`);
    }

    await browser.close();
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
