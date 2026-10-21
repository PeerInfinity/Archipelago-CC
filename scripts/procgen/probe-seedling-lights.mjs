#!/usr/bin/env node
/**
 * probe-seedling-lights — ⛓⛓⛓ seedling-fidelity-lights D1/D2: THE L69 LIGHTS FIGHT, ASKED OF THE GAME TICK BY SAMPLED
 * TICK, and (with `--compare`) of the model at the same ticks.
 *
 * The game's `botMobiles()` reports every `Mobile` in update order, so the fight's three moving classes are all
 * visible: the intro `NPC` (an `NPC` is a `Mobile`), the six `LightBoss` fliers (position, velocity, `hits`,
 * `hits_timer`, anim), and every `LightBossShot`. The `LightBossTotem` and the exit `Teleporter` are plain `Entity`s
 * and NOT visible here: the totem is witnessed by the player standing against it, the teleporter by the level
 * change it causes, and `endState()`'s write by `botStatus().persistence_cleared`.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   SEEDLING_PORT=9701 node scripts/procgen/probe-seedling-lights.mjs --file=<tape.json> --frames=<out.json>
 *   … --compare            replay the tape in the model (`createTapeStepper`) under the process's switches
 *                          (`SEEDLING_CONTACT_FIDELITY`) and compare every sampled tick: the player, every flier
 *                          (x, y, vx, vy, hits, hits_timer, die anim) and every shot (x, y), joined by order
 *   … --witness=<name>     re-witness `fixtures/lights-witness/<name>.json` (its embedded tape)
 *   … --record --name=<n>  write `fixtures/lights-witness/<n>.json` (the game's samples + the tape) — only on a PASS
 *                          of `--compare`
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** The classes this probe reads, by `getQualifiedClassName`'s tail. */
const IS = {
    player: (r) => /(^|[.:])Player$/.test(r.cls),
    flier: (r) => /(^|[.:])LightBoss$/.test(r.cls),
    shot: (r) => /(^|[.:])LightBossShot$/.test(r.cls),
    npc: (r) => /(^|[.:])NPC$/.test(r.cls),
};

/** One game frame, reduced to what the fight is. */
export function reduceFrame(m, s) {
    const rows = m.mobiles ?? [];
    const p = rows.find(IS.player) ?? null;
    return {
        tick: m.tick ?? s.tick,
        level: s.level,
        finished: s.finished,
        time: s.game_time ?? null,
        hits: s.hits,
        hitsTimer: s.hits_timer,
        cleared: (s.persistence_cleared ?? []).filter((c) => c.level === 69 || c.level === 36),
        player: p ? { x: p.x, y: p.y, vx: p.vx, vy: p.vy } : null,
        npc: rows.filter(IS.npc).map((r) => ({ x: r.x, y: r.y })),
        fliers: rows.filter(IS.flier).map((r) => ({ x: r.x, y: r.y, vx: r.vx, vy: r.vy, anim: r.anim,
            animIndex: r.anim_index, hits: r.enemy?.hits ?? null, hitsTimer: r.enemy?.hits_timer ?? null })),
        shots: rows.filter(IS.shot).map((r) => ({ x: r.x, y: r.y, vx: r.vx, vy: r.vy })),
    };
}

/** The LAST poll before the tick advanced (the `Bot`'s own observation point); the final tick keeps its first. */
export function samplesOf(frames, tickCount) {
    const inTape = frames.filter((f) => Number.isInteger(f.tick) && f.tick >= 0 && f.tick <= tickCount && f.player);
    const finalTick = inTape.reduce((mx, f) => Math.max(mx, f.tick), -Infinity);
    const byTick = new Map();
    for (const f of inTape) if (f.tick !== finalTick || !byTick.has(f.tick)) byTick.set(f.tick, f);
    return [...byTick.values()];
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
    const WITNESS = arg('witness');
    const FILE = arg('file') ?? (WITNESS ? join(MODULE, 'fixtures', 'lights-witness', `${WITNESS}.json`) : null);
    if (!FILE) {
        console.error('probe-seedling-lights: --file=<tape.json> or --witness=<name> is required');
        process.exit(2);
    }
    const FRAMES = arg('frames');
    const COMPARE = process.argv.includes('--compare');
    const RECORD = process.argv.includes('--record');
    const NAME = arg('name');
    if (RECORD && (!NAME || !COMPARE)) {
        console.error('probe-seedling-lights: --record needs --name=<witness name> and --compare');
        process.exit(2);
    }

    takeBoxLockOrExit({ name: 'probe-seedling-lights.mjs', kind: 'browser' });

    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const rawTape = WITNESS ? JSON.parse(readFileSync(FILE, 'utf8')).tape : JSON.parse(readFileSync(FILE, 'utf8'));
    const tape = parseTape(JSON.stringify(rawTape));

    // ── the GAME ────────────────────────────────────────────────────────────
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const frames = [];
    let finished = false;
    try {
        const page = await browser.newPage();
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) {
            await page.waitForTimeout(250);
        }
        await page.click('#btn-start');
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
            await page.waitForTimeout(250);
        }
        await assertLogicOnlyChannel(page);
        const bot = (n, a) => page.evaluate(([name, x]) => {
            const g = window.__swfBridge.game;
            return String(x === undefined ? g[name]() : g[name](x));
        }, [n, a]);
        const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        const started = await bot('botStart');
        if (started !== 'ok') throw new Error(`botStart: ${started}`);
        const deadline = Date.now() + 600000;
        while (Date.now() < deadline) {
            const raw = await page.evaluate(() => {
                const g = window.__swfBridge.game;
                return [String(g.botMobiles()), String(g.botStatus())];
            });
            const f = reduceFrame(JSON.parse(raw[0]), JSON.parse(raw[1]));
            frames.push(f);
            if (f.finished) { finished = true; break; }
        }
    } finally {
        await browser.close();
    }
    if (!finished) {
        console.log('FAIL: the tape never finished inside the deadline');
        process.exit(1);
    }
    const samples = samplesOf(frames, tape.tick_count);
    console.log(`game: ${frames.length} frame(s), ${samples.length} sampled tick(s) of ${tape.tick_count}`);
    if (FRAMES) {
        writeFileSync(FRAMES, `${JSON.stringify({ tape: FILE, page: PAGE_NAME, samples })}\n`);
        console.log(`wrote ${FRAMES}`);
    }
    if (!COMPARE) process.exit(0);

    // ── the MODEL ───────────────────────────────────────────────────────────
    const { compareLightsWitness, modelLightsTrack } = await import(join(MODULE, 'lightBossWitness.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const track = modelLightsTrack(tape, { levelSource: atlasLevelSource() });
    const verdict = compareLightsWitness(samples, track);
    console.log(`${verdict.pass ? 'PASS' : 'FAIL'}: ${verdict.compared} sampled tick(s) compared, worst |Δ| ${verdict.worst}`
        + ` (player, fliers, shots, level, the (69,0) write)`);
    for (const d of verdict.disagreements.slice(0, 16)) console.log(`      ${d}`);
    if (verdict.disagreements.length > 16) console.log(`      … ${verdict.disagreements.length - 16} more`);
    if (RECORD) {
        if (!verdict.pass) {
            console.log('NOT RECORDED: the model disagrees with the game — a witness it cannot reproduce is not a fixture');
            process.exit(1);
        }
        const dir = join(MODULE, 'fixtures', 'lights-witness');
        mkdirSync(dir, { recursive: true });
        const out = {
            name: NAME, page: PAGE_NAME, recordedBy: 'scripts/procgen/probe-seedling-lights.mjs --compare --record',
            switches: process.env.SEEDLING_CONTACT_FIDELITY ?? null,
            note: 'the GAME\'s L69 fight at each sampled tick: player, intro NPC, LightBoss fliers, LightBossShots, '
                + 'level, persistence_cleared rows of L69/L36',
            samples, tape: rawTape,
        };
        const path = join(dir, `${NAME}.json`);
        writeFileSync(path, `${JSON.stringify(out)}\n`);
        console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} sampled tick(s)`);
    }
    process.exit(verdict.pass ? 0 : 1);
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
