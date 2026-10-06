#!/usr/bin/env node
/**
 * probe-seedling-ladder2-phase — ⛓⛓⛓ SEEDLING FIDELITY LADDER2, D1: **WHEN DO
 * A PLACED GRENADE, A LAVA CHAIN AND A BEAM TOWER HIT A STANDING PLAYER, ASKED
 * OF THE GAME.**
 *
 * The three classes the combat ladder refuses by name (`enemy:grenade`,
 * `hazard:lavachain`, `hazard:beamtower`), each on its own clock:
 *
 *   - GRENADE (`placedGrenade.js`): dormant until the player's entity point is
 *     within 32 px of `(x, endY)`; then a fall, a 60-update count and the 21-
 *     update `"explode"` anim, whose callback is the 20 px blast. Its clock is
 *     the grenade's own update count — the visit's live ticks (H: update
 *     `f − V + K`, K = 0).
 *   - LAVA CHAIN (`hazards.stepLavaChain`): the arm goes out when `Game.time %
 *     90 < 1.5`. Its clock is `Game.time` (H: frame f reads `T0 + f − 1 + K`,
 *     K = 0, where `T0` is the model run's `gameTime` at the boot).
 *   - BEAM TOWER (`hazards.stepBeamTower`): its own Spritemap from the ctor —
 *     an INT `10 · speed` fps, the side turning by `rate` after each `sit` —
 *     plus a `Game.time` bob (the chain's K). Its clock is the visit's live
 *     ticks (H: update `f − V + K`, K = 0).
 *
 * All three are added after the Player (`Game.as:2297, 2298, 2359` vs `:2250`),
 * so each tests the PRE-move box: frame f tests observation f − 1.
 *
 * Each ARM boots the survey's staging (`r8-solve-11`'s block, re-pointed) where
 * the class reaches the standing player, and holds NO key (or walks in first).
 * The game's stream leaves the model's (which bills none of the three) on the
 * frame the knockback moves the player; the model predicts that frame for each
 * offset K. A NEGATIVE arm (`expect: 'none'`) stands where the class never
 * reaches and must never diverge.
 *
 * `--model-only` prints the predictions without a browser. `--record=<path>`
 * writes the readings as JSON. Prints `PASS:`/`FAIL:` rows and `ALL CHECKS
 * PASSED` / `N CHECK(S) FAILED`.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the
 * wasm build (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: SEEDLING_PORT=9460 node scripts/procgen/probe-seedling-ladder2-phase.mjs [--model-only] [--record=<path>]
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { axeArmStaging } from './probe-seedling-axe-phase.mjs';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** The offsets the arms choose between: H is K = 0. */
export const OFFSETS = Object.freeze([-3, -2, -1, 0, 1, 2, 3]);

/** How long each arm stands: past the grenade's 155-update blast and two chain cycles. */
export const STAND_TICKS = Number(process.env.LADDER2_STAND ?? 200);

/**
 * The arms. `target` is the census row (`tag`, `x`, `y` = the `.oel` cell, `cx`,
 * `cy` = the entity point, `attrs`); `boot` is the staging's block (the entity
 * point is boot + 8); `inputs` walk in before the stand.
 */
export const LADDER2_ARMS = Object.freeze([
    // ⛔ L59's and L63's grenades spawn INSIDE a wall: the fall column is solid,
    // and the fall ignores it (`collidable = false`), so they blast on schedule.
    { name: 'l2-grenade-l59-walled', kind: 'grenade', level: 59,
        target: { tag: 'grenade', x: 112, y: 112, cx: 120, cy: 120 },
        boot: { level: 59, x: 112, y: 124 } },
    { name: 'l2-grenade-l75', kind: 'grenade', level: 75,
        target: { tag: 'grenade', x: 72, y: 168, cx: 80, cy: 176 },
        boot: { level: 75, x: 72, y: 180 } },
    // Armed (26 px < 32) and outside the 20 px blast: never moved.
    { name: 'l2-grenade-l75-armed-clear', kind: 'grenade', level: 75, expect: 'none',
        target: { tag: 'grenade', x: 72, y: 168, cx: 80, cy: 176 },
        boot: { level: 75, x: 72, y: 194 } },
    { name: 'l2-grenade-l63-walled', kind: 'grenade', level: 63,
        target: { tag: 'grenade', x: 128, y: 128, cx: 136, cy: 136 },
        boot: { level: 63, x: 112, y: 128 } },
    { name: 'l2-chain-l79', kind: 'lavachain', level: 79,
        target: { tag: 'lavachain', x: 96, y: 80, cx: 104, cy: 88, attrs: { dir: '2' } },
        boot: { level: 79, x: 56, y: 80 } },
    { name: 'l2-chain-l72', kind: 'lavachain', level: 72,
        target: { tag: 'lavachain', x: 128, y: 160, cx: 136, cy: 168, attrs: { dir: '3' } },
        boot: { level: 72, x: 128, y: 182 } },
    { name: 'l2-chain-l75-c', kind: 'lavachain', level: 75,
        target: { tag: 'lavachain', x: 80, y: 80, cx: 88, cy: 88, attrs: { dir: '2' } },
        boot: { level: 75, x: 56, y: 80 } },
    { name: 'l2-chain-l75-a', kind: 'lavachain', level: 75,
        target: { tag: 'lavachain', x: 96, y: 32, cx: 104, cy: 40, attrs: { dir: '2' } },
        boot: { level: 75, x: 64, y: 32 } },
    { name: 'l2-beam-l104', kind: 'beamtower', level: 104,
        target: { tag: 'beamtower', x: 16, y: 56, cx: 24, cy: 72, attrs: { direction: '0', rate: '1', speed: '1' } },
        boot: { level: 104, x: 112, y: 48 } },
    // ⛓ THE TURN: a rate-1 tower's SECOND side (`up`), which the census volume never prices.
    { name: 'l2-beam-l104-up', kind: 'beamtower', level: 104,
        target: { tag: 'beamtower', x: 16, y: 56, cx: 24, cy: 72, attrs: { direction: '0', rate: '1', speed: '1' } },
        boot: { level: 104, x: 16, y: 22 } },
    { name: 'l2-beam-l103-west', kind: 'beamtower', level: 103,
        target: { tag: 'beamtower', x: 208, y: 248, cx: 216, cy: 264, attrs: { direction: '2', rate: '4', speed: '0.25' } },
        boot: { level: 103, x: 160, y: 240 } },
    // ⛓ THE LEVEL'S EDGE: the right beam past x 160 — `FP.width` is the level's (320), not
    // the screen's. A first cut ended it at 160 and the game knocked a witness at x 200.
    { name: 'l2-beam-l103-east', kind: 'beamtower', level: 103,
        target: { tag: 'beamtower', x: 144, y: 200, cx: 152, cy: 216, attrs: { direction: '0', rate: '2', speed: '0.5' } },
        boot: { level: 103, x: 192, y: 191 } },
    { name: 'l2-beam-l103-mid', kind: 'beamtower', level: 103,
        target: { tag: 'beamtower', x: 144, y: 200, cx: 152, cy: 216, attrs: { direction: '0', rate: '2', speed: '0.5' } },
        boot: { level: 103, x: 100, y: 192 } },
]);

/** The arm's tape: the staging and its inputs then `STAND_TICKS` empty key sets. */
export async function ladder2ArmTape(arm) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const staging = await axeArmStaging(arm);
    const perTick = [...(arm.inputs ?? []).flatMap(([key, n]) =>
        Array.from({ length: n }, () => (key ? new Set([key]) : new Set()))),
    ...Array.from({ length: STAND_TICKS }, () => new Set())];
    const built = buildStagedTape({ staging, perTick, name: arm.name });
    return parseTape({ ...built, description: `SEEDLING FIDELITY LADDER2 D1 probe arm ${arm.name}: `
        + `stand where ${arm.target.tag}@${arm.target.x},${arm.target.y} reaches for ${STAND_TICKS} ticks. `
        + 'Authored by scripts/procgen/probe-seedling-ladder2-phase.mjs.' });
}

/**
 * The model's first hit frame under offset K: frame f (observation f − 1's box
 * and entity point), the class's update `f − V + K` (grenade, beam) and
 * `Game.time = T0 + f − 1 + (kind === 'lavachain' ? K : 0)`.
 */
export async function predictFirstHit(arm, stream, K, { V = 0, T0 = null, solidAt = null, size = null } = {}) {
    const H = await import(join(MODULE, 'hazards.js'));
    const G = await import(join(MODULE, 'placedGrenade.js'));
    const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
    const t = arm.target;
    // The class's own state, stepped once per update from its ctor (update 1).
    const uK = arm.kind === 'lavachain' ? 0 : K;
    const tK = arm.kind === 'lavachain' ? K : 0;
    let grenade = null;
    let chain = null;
    let tower = null;
    if (arm.kind === 'grenade') grenade = G.createPlacedGrenade(t.cx, t.cy);
    if (arm.kind === 'lavachain') chain = H.createLavaChainState();
    if (arm.kind === 'beamtower') tower = H.createBeamTower(t, size);
    let u = 0;
    for (let f = 1; f < stream.length; f += 1) {
        const o = stream[f - 1];
        if (o.level !== arm.level || f - 1 < V) continue;
        const want = f - V + uK;
        if (want < 1) continue;
        const box = playerBoxAt(o.x, o.y);
        while (u < want) {
            u += 1;
            const time = T0 === null ? null : T0 + (f - 1) + tK - (want - u);
            const last = u === want;
            if (grenade) {
                const ev = G.stepPlacedGrenade(grenade, o.x, o.y, { solidAt });
                if (last && ev === 'blast' && G.blastReaches(grenade, o.x, o.y)) {
                    return { f, u, what: 'blast', armedAt: grenade.armedAt };
                }
            } else if (chain) {
                const reaching = H.stepLavaChain(chain, time);
                if (last && reaching && H.rectTouchesBox(H.lavaChainRect(t.cx, t.cy, t.attrs.dir), box)) {
                    return { f, u, what: `chain ${chain.anim}`, time };
                }
            } else if (tower) {
                const rect = H.stepBeamTower(tower, time);
                if (last && rect && H.rectTouchesBox(rect, box)) {
                    return { f, u, what: `beam side ${tower.direction}`, rect };
                }
            }
        }
    }
    return null;
}

async function main() {
    const MODEL_ONLY = process.argv.includes('--model-only');
    const RECORD = process.argv.find((a) => a.startsWith('--record='))?.slice('--record='.length) ?? '';
    const M = (p) => import(join(MODULE, p));
    const { gameVisibleTape } = await M('tapeFormat.js');
    const { runTape, createRunForStaging, stagingFromTape, solveStaging } = await M('tapeRunner.js');
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
    const only = process.env.LADDER2_ARMS ? process.env.LADDER2_ARMS.split(',') : null;
    for (const arm of LADDER2_ARMS) {
        if (only && !only.includes(arm.name)) continue;
        const tape = await ladder2ArmTape(arm);
        const replay = runTape(tape, { levelSource });
        const model = replay.ticks;
        const V = (replay.transitions ?? []).filter((t) => t.to_level === arm.level).at(-1)?.t ?? 0;
        const T0 = createRunForStaging(solveStaging(stagingFromTape(tape)), levelSource).gameTime ?? null;
        const rest = model.at(-1);
        const world = buildLevelWorld(levelSource(arm.level));
        const solidAt = (b) => world.collidesSolid(b);
        const predictions = {};
        for (const K of OFFSETS) predictions[K] = await predictFirstHit(arm, model, K, { V, T0, solidAt, size: world.world });
        // ⛓ The stand is asked up to the predicted hit: since LADDER2 D2 the model BILLS the
        // grenade's blast (`stepPlacedGrenadesNow`), so a grenade arm's model moves there too.
        const from = (arm.inputs ?? []).reduce((n, [, k]) => n + k, 0);
        const stand = model.slice(from, predictions[0] ? predictions[0].f : model.length);
        const still = stand.every((o) => o.x === stand[0].x && o.y === stand[0].y && o.level === arm.level);
        const clear = !world.collidesSolid(playerBoxAt(stand[0].x, stand[0].y));
        console.log(`${arm.name}: model rests at (${rest.x},${rest.y}) ${still ? 'for the stand' : '⚠ but MOVES'}, `
            + `T0 ${T0}; first hit by K: `
            + OFFSETS.map((K) => `${K}→${predictions[K] ? `f${predictions[K].f}` : '—'}`).join(' '));
        check(`${arm.name}: the model stands still in L${arm.level} and the standing box is clear of solids`,
            still && clear, `stands at (${stand[0].x},${stand[0].y})`);
        if (arm.expect === 'none') {
            check(`${arm.name}: the model predicts NO hit at K = 0 (a negative arm)`, predictions[0] === null);
        } else {
            check(`${arm.name}: the model predicts a hit at K = 0`, predictions[0] !== null,
                predictions[0] ? `f${predictions[0].f} ${predictions[0].what}` : '');
        }
        if (arm.kind !== 'grenade') check(`${arm.name}: the boot declares Game.time`, T0 !== null);
        prepared.push({ arm, tape, model, predictions, V, T0 });
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
    takeBoxLockOrExit({ name: 'probe-seedling-ladder2-phase.mjs', kind: 'browser' });
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

    const oracle = { source: 'probe-seedling-ladder2-phase.mjs --record (seedling fidelity LADDER2 D1)',
        build: PAGE_NAME, hypothesis: 'frame f tests obs f − 1; update f − V + K; Game.time T0 + f − 1 + K',
        arms: [] };
    const agreeing = { grenade: new Set(OFFSETS), lavachain: new Set(OFFSETS), beamtower: new Set(OFFSETS) };
    try {
        for (const { arm, tape, model, predictions, V, T0 } of prepared) {
            const game = await play(tape);
            // The knock is the game's first move off the standing position. ⛓ Not the first
            // divergence from the model: since LADDER2 D2 the model bills the grenade's blast,
            // so on a grenade arm the two agree through the knock (`modelDivergence`).
            const from = (arm.inputs ?? []).reduce((n, [, k]) => n + k, 0);
            const ref = model[from];
            const first = game.ticks.findIndex((o, i) => i > from
                && (o.level !== ref.level || o.x !== ref.x || o.y !== ref.y));
            const modelDivergence = game.ticks.findIndex((o, i) => model[i]
                && (o.level !== model[i].level || o.x !== model[i].x || o.y !== model[i].y));
            const matches = OFFSETS.filter((K) => (arm.expect === 'none'
                ? predictions[K] === null && first < 0 : predictions[K]?.f === first));
            for (const K of OFFSETS) if (!matches.includes(K)) agreeing[arm.kind].delete(K);
            oracle.arms.push({
                gameStream: game.ticks.map((o) => [o.t, o.level, o.x, o.y]),
                arm: arm.name, kind: arm.kind, target: arm.target, boot: arm.boot, inputs: arm.inputs ?? [],
                V, T0, stood: { x: model.at(-1).x, y: model.at(-1).y }, gameRows: game.ticks.length,
                gameFirstMove: first, modelDivergence, gameRowThen: game.ticks[first] ?? null, predictions, matches,
                status: game.status, error: game.status.error || '',
            });
            if (arm.expect === 'none') {
                check(`${arm.name}: the game never moves the standing player (a negative control)`,
                    first < 0 && !game.status.error, `first moved observation ${first}`);
            } else {
                check(`${arm.name}: the game knocks the standing player (a positive control)`,
                    first > 0 && !game.status.error, `first moved observation ${first}`);
            }
            check(`${arm.name}: the game agrees with K = 0`, matches.includes(0),
                `game f${first}; K matching: [${matches.join(', ')}]`);
        }
    } finally {
        await browser.close();
    }
    oracle.agreeingOffsets = Object.fromEntries(Object.entries(agreeing).map(([k, s]) => [k, [...s]]));
    for (const [k, s] of Object.entries(agreeing)) {
        if (prepared.some((p) => p.arm.kind === k)) {
            check(`every ${k} arm agrees on one offset`, s.size >= 1, `[${[...s].join(', ')}]`);
        }
    }
    if (RECORD) {
        writeFileSync(RECORD, `${JSON.stringify(oracle, null, 2)}\n`);
        console.log(`RECORDED: ${RECORD}`);
    }
    console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
    process.exit(failed ? 1 : 0);
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();
