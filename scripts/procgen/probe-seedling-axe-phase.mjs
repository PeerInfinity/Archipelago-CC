#!/usr/bin/env node
/**
 * probe-seedling-axe-phase — ⛓⛓⛓ SEEDLING FIDELITY AXE, D1: **WHICH UPDATE OF
 * THE SPINNING AXE TESTS WHICH OBSERVATION, ASKED OF THE GAME.**
 *
 * `SpinningAxe.update` adds `rate` degrees to its sprite angle once per update
 * and tests the Player against the blade at that angle (`hazards.axeHitsPlayer`).
 * The counter is the entity's own, from 0 at the ctor, so the model has to know
 * how many updates the axe has run when it tests a given observation's box.
 * The hypothesis (H0) is the one the source reads as:
 *
 *   the box of observation T (the state after T advances) is tested by the
 *   axe's update in frame T + 1, which is its (T + 1 − V)-th update, where V
 *   is the observation index of the visit's arrival (0 for a boot).
 *
 * Each ARM boots the survey's staging (`r8-solve-11`'s block, re-pointed) beside
 * one axe and holds NO key, so the player stands in the sweep until the blade
 * reaches the box. The game's stream leaves the model's (which bills no axe
 * contact) on the first frame the knockback moves the player. For each offset K
 * in `OFFSETS` the model predicts that frame as the first f with
 * `axeHitsPlayer(axe, f − V + K, box(obs f − 1))`; the arms agree on ONE K
 * or the hypothesis is refuted. ⚠ The arms differ in rate, sign and the side of
 * the hub the player stands on, so a constant K is not an artefact of one angle.
 *
 * `--model-only` prints the model's predictions and the standing streams and
 * exits without a browser. `--record=<path>` writes the readings as JSON.
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the
 * wasm build (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: SEEDLING_PORT=9370 node scripts/procgen/probe-seedling-axe-phase.mjs [--model-only] [--record=<path>]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** The offsets the arms choose between: H0 is K = 0. */
export const OFFSETS = Object.freeze([-3, -2, -1, 0, 1, 2, 3]);

/** How long each arm stands still: more than one revolution of the slowest axe here. */
export const STAND_TICKS = 160;

/**
 * The arms: a level, one axe (census placement → `cx,cy` = +8,+8, `rate`), and a
 * boot whose ENTITY point (boot + 8) stands at `r` px from the hub on one side.
 */
export const AXE_ARMS = Object.freeze([
    { name: 'axe-phase-l61-a-south', level: 61, axe: { id: 'spinningaxe@64,144', cx: 72, cy: 152, rate: 5 },
        boot: { level: 61, x: 64, y: 164 } },
    { name: 'axe-phase-l61-a-north', level: 61, axe: { id: 'spinningaxe@64,144', cx: 72, cy: 152, rate: 5 },
        boot: { level: 61, x: 64, y: 124 } },
    { name: 'axe-phase-l61-b-south', level: 61, axe: { id: 'spinningaxe@160,80', cx: 168, cy: 88, rate: 7 },
        boot: { level: 61, x: 160, y: 100 } },
    // ⛓ THE DOOR ARM: V is the transition's own `t`, not a boot's 0. Boots in L60,
    // holds \`right\` through \`teleporter@160,80\` into L61 and on into axe A's sweep.
    { name: 'axe-phase-l61-door', level: 61, axe: { id: 'spinningaxe@64,144', cx: 72, cy: 152, rate: 5 },
        boot: { level: 60, x: 140, y: 80 }, inputs: [['right', 40]] },
    // ⛓ A SECOND DOOR, another axe and the other side of the room: from L63 by
    // \`teleporter@0,96\` into L61, then \`left\` and \`down\` under axe B's pocket.
    { name: 'axe-phase-l61-door-east', level: 61, axe: { id: 'spinningaxe@160,80', cx: 168, cy: 88, rate: 7 },
        boot: { level: 63, x: 20, y: 96 }, inputs: [['left', 36], ['down', 3]] },
    { name: 'axe-phase-l101-west', level: 101, axe: { id: 'spinningaxe@80,224', cx: 88, cy: 232, rate: -5 },
        boot: { level: 101, x: 60, y: 224 } },
]);

/** The survey's staging, re-pointed at `boot` (`plan-seedling-watcher-witness`'s shape). */
export async function axeArmStaging(arm) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = parseTape(readFileSync(join(MODULE, 'fixtures', 'tapes', 'r8-solve-11.json'), 'utf8'));
    const staging = solveStaging(stagingFromTape(base));
    staging.boot = { ...arm.boot };
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    return staging;
}

/** The arm's tape: the staging and `STAND_TICKS` empty key sets. */
export async function axeArmTape(arm) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const staging = await axeArmStaging(arm);
    const perTick = [...(arm.inputs ?? []).flatMap(([key, n]) =>
        Array.from({ length: n }, () => new Set([key]))),
    ...Array.from({ length: STAND_TICKS }, () => new Set())];
    const built = buildStagedTape({ staging, perTick, name: arm.name });
    return parseTape({ ...built, description: `SEEDLING FIDELITY AXE D1 probe arm ${arm.name}: stand `
        + `still beside ${arm.axe.id} (rate ${arm.axe.rate}) for ${STAND_TICKS} ticks. `
        + 'Authored by scripts/procgen/probe-seedling-axe-phase.mjs.' });
}

/**
 * The model's first hit frame under offset K: the first f >= 1 whose axe update
 * (count `f − V + K`) hits the box of observation f − 1. `V` is the arrival
 * observation: 0 for a boot, the transition's `t` for the door arm.
 */
export async function predictFirstHit(arm, stream, K, V = 0) {
    const { axeHitsPlayer } = await import(join(MODULE, 'hazards.js'));
    const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
    for (let f = 1; f < stream.length; f += 1) {
        const o = stream[f - 1];
        if (o.level !== arm.level || f - 1 < V) continue;
        const u = f - V + K;
        if (u < 1) continue;
        const hit = axeHitsPlayer(arm.axe, u, playerBoxAt(o.x, o.y));
        if (hit) return { f, u, arm: hit.arm, deg: hit.line.deg };
    }
    return null;
}

async function main() {
    const MODEL_ONLY = process.argv.includes('--model-only');
    const RECORD = process.argv.find((a) => a.startsWith('--record='))?.slice('--record='.length) ?? '';
    const M = (p) => import(join(MODULE, p));
    const { gameVisibleTape } = await M('tapeFormat.js');
    const { runTape } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const { buildLevelWorld } = await M('levelWorld.js');
    const { playerBoxAt } = await M('playerPhysicsV2.js');
    const levelSource = atlasLevelSource();

    let failed = 0;
    const check = (name, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };

    const prepared = [];
    const only = process.env.AXE_ARMS ? process.env.AXE_ARMS.split(',') : null;
    for (const arm of AXE_ARMS) {
        if (only && !only.includes(arm.name)) continue;
        const tape = await axeArmTape(arm);
        const replay = runTape(tape, { levelSource });
        const model = replay.ticks;
        const V = (replay.transitions ?? []).filter((t) => t.to_level === arm.level).at(-1)?.t ?? 0;
        const rest = model.at(-1);
        const still = arm.inputs ? rest.level === arm.level
            : model.every((o) => o.x === model[0].x && o.y === model[0].y && o.level === arm.level);
        // ⛔ The standing box must be clear of every solid: a box inside a wall
        // cannot be knocked, so its stream would never move (three first-cut arms
        // around L61's second axe booted INSIDE its pocket's walls).
        const world = buildLevelWorld(levelSource(arm.level));
        const clear = !world.collidesSolid(playerBoxAt(rest.x, rest.y));
        const predictions = {};
        for (const K of OFFSETS) predictions[K] = await predictFirstHit(arm, model, K, V);
        console.log(`${arm.name}: model rests at (${rest.x},${rest.y}) `
            + `${still ? 'for the whole tape' : '⚠ but MOVES'}; first hit by K: `
            + OFFSETS.map((K) => `${K}→${predictions[K] ? `f${predictions[K].f}/${predictions[K].arm}` : '—'}`).join(' '));
        check(`${arm.name}: the model ${arm.inputs ? `arrives in L${arm.level} (V = ${V})`
            : 'stands still (the arm asks one box)'} and the standing box is clear of solids`,
        still && clear, `rests at (${rest.x},${rest.y})`);
        prepared.push({ arm, tape, model, predictions, V });
    }
    if (MODEL_ONLY) {
        console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
        process.exit(failed ? 1 : 0);
    }

    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE_NAME, 'game.html'))) {
        console.log(`SKIP: seedling wasm build ${PAGE_NAME} not staged`);
        process.exit(0);
    }
    const { takeBoxLockOrExit } = await import('./boxLock.js');
    takeBoxLockOrExit({ name: 'probe-seedling-axe-phase.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let proved = false;
    const call = (page, name, arg) => page.evaluate(([n, a]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[n] !== 'function') return null;
        return a === undefined ? g[n]() : g[n](a);
    }, [name, arg]);
    const json = async (page, name, arg) => JSON.parse(await call(page, name, arg));
    async function waitFor(page, what, fn, ms = 300000) {
        const t0 = Date.now();
        for (;;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(200);
        }
    }
    async function play(tape) {
        const page = await browser.newPage();
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)));
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            const started = await call(page, 'botStart');
            if (started !== 'ok') throw new Error(`botStart: ${started}`);
            const ticks = [];
            const status = await waitFor(page, 'the latch', async () => {
                ticks.push(...(await json(page, 'botDrain')).ticks);
                const st = await json(page, 'botStatus');
                return st.finished ? st : null;
            });
            ticks.push(...(await json(page, 'botDrain')).ticks);
            return { status, ticks };
        } finally {
            await page.close();
        }
    }

    const oracle = { source: 'probe-seedling-axe-phase.mjs --record (seedling fidelity AXE D1)',
        build: PAGE_NAME, hypothesis: 'H0: obs T is tested by update T + 1 − V', arms: [] };
    const agreeing = new Set(OFFSETS);
    try {
        for (const { arm, tape, model, predictions, V } of prepared) {
            const game = await play(tape);
            const first = game.ticks.findIndex((o, i) => model[i]
                && (o.level !== model[i].level || o.x !== model[i].x || o.y !== model[i].y));
            const hits = game.status.hits ?? game.status.player?.hits ?? null;
            const matches = OFFSETS.filter((K) => predictions[K]?.f === first);
            for (const K of OFFSETS) if (!matches.includes(K)) agreeing.delete(K);
            oracle.arms.push({
                arm: arm.name, axe: arm.axe, boot: arm.boot, V, stood: { x: model.at(-1).x, y: model.at(-1).y },
                gameFirstMove: first, gameRowThen: game.ticks[first] ?? null, hits,
                predictions, matches, status: game.status, error: game.status.error || '',
            });
            check(`${arm.name}: the game knocks the standing player (a positive control)`,
                first > 0 && !game.status.error, `first moved observation ${first}, hits ${hits}`);
            check(`${arm.name}: the knock lands on the frame H0 (K = 0) predicts`,
                matches.includes(0), `game f${first}; K matching: [${matches.join(', ')}]`);
        }
    } finally {
        await browser.close();
    }
    oracle.agreeingOffsets = [...agreeing];
    check('every arm agrees on one offset', agreeing.size >= 1, `[${[...agreeing].join(', ')}]`);
    if (RECORD) {
        writeFileSync(RECORD, `${JSON.stringify(oracle, null, 2)}\n`);
        console.log(`RECORDED: ${RECORD}`);
    }
    console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
    process.exit(failed ? 1 : 0);
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();
