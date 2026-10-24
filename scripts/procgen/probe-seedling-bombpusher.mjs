#!/usr/bin/env node
/**
 * probe-seedling-bombpusher — ⛓ seedling-fidelity-bombpusher D1/D2: THE LOBBER, ASKED OF THE GAME TICK BY TICK.
 *
 * Plays a tape on the recompiled game (p4f, headless) and polls `botMobiles()` + `botStatus()` at every sampled tick:
 * the `BombPusher`'s Spritemap (anim / index / frame), every `Bomb` row (position, velocity, sprite angle), and the
 * player (position, `hits`, `hits_timer`). It then replays the same tape through the model (`tapeRunner`, the
 * process's switches — `SEEDLING_CONTACT_FIDELITY=bombPusherLive` turns the D2 arm on) and joins the two on the tick:
 *
 *   - the shot clock: every tick the game's lobber enters "shoot", and every tick a new `Bomb` row first appears;
 *   - each bomb's flight: position and velocity, to the bit, against `run.entities('bombs')`;
 *   - the blast: the game's `hits` 0 → n ticks against the model's `playerHits` rows of source `bomb`.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-bombpusher.mjs --file=<tape.json>
 *   … --tape=<fixture name>  a committed tape instead of --file
 *   … --out=<file.json>      write every sample (game rows + model rows)
 *   … --game-only            skip the model replay (a D1 measurement)
 *   … --upto=<tick>          compare only samples at or before this tick
 *   … --reuse=<out.json>     no browser: re-join the model against the game rows a previous `--out` wrote
 *   … --record --name=<n>    with --upto: write the tape and the GAME's rows through that tick (player, hits, camera,
 *                            bombs, lobber anim) to `fixtures/bomb-witness/<n>.json` — only on a PASS;
 *                            `fidelityBombPusher.test.js` replays it
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const TAPE = arg('tape');
    const FILE = arg('file');
    if (!TAPE === !FILE) {
        console.error('probe-seedling-bombpusher: exactly one of --tape=<fixture> / --file=<path> is required');
        process.exit(2);
    }
    const OUT = arg('out');
    const GAME_ONLY = process.argv.includes('--game-only');
    const UPTO = arg('upto') === null ? Infinity : Number(arg('upto'));
    const REUSE = arg('reuse');
    const RECORD = process.argv.includes('--record');
    const NAME = arg('name');
    if (RECORD && (!NAME || !Number.isFinite(UPTO))) {
        console.error('probe-seedling-bombpusher: --record needs --name=<witness name> and --upto=<tick>');
        process.exit(2);
    }

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

    const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const tape = TAPE ? loadTape(TAPE) : parseTape(readFileSync(FILE, 'utf8'));
    const game = REUSE ? JSON.parse(readFileSync(REUSE, 'utf8')).game : await playOnGame(tape, PAGE_URL);
    if (!game) process.exit(1);
    await report({ game, tape, MODULE, GAME_ONLY, UPTO, OUT, TAPE, FILE, PAGE_NAME, RECORD, NAME });
}

/** The game's rows, one sample per tick. ⛔ Takes the box (a browser instrument). */
async function playOnGame(tape, PAGE_URL) {
    const { gameVisibleTape } = await import(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend',
        'modules', 'seedlingDemo', 'tapeFormat.js'));
    takeBoxLockOrExit({ name: 'probe-seedling-bombpusher.mjs', kind: 'browser' });
    // ── the GAME ────────────────────────────────────────────────────────────
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const frames = [];
    let status = null;
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
        const deadline = Date.now() + 900000;
        while (Date.now() < deadline) {
            const raw = await page.evaluate(() => {
                const g = window.__swfBridge.game;
                return [String(g.botMobiles()), String(g.botStatus())];
            });
            const m = JSON.parse(raw[0]);
            const s = JSON.parse(raw[1]);
            const rows = (m.mobiles ?? []).filter((r) => /(Bomb|BombPusher|Player)$/.test(r.cls));
            frames.push({ tick: m.tick ?? s.tick, status: { tick: s.tick, level: s.level, hits: s.hits,
                hits_timer: s.hits_timer, finished: s.finished, camera: s.camera ?? null }, rows });
            if (s.finished) { status = s; break; }
        }
    } finally {
        await browser.close();
    }
    if (!status) {
        console.log('FAIL: the tape never finished inside the deadline');
        return null;
    }

    // one sample per tick: the FIRST at it whose mobiles and status agree on the tick
    const byTick = new Map();
    for (const f of frames) {
        if (!Number.isInteger(f.tick) || f.tick !== f.status.tick || f.tick > tape.tick_count) continue;
        if (!byTick.has(f.tick)) byTick.set(f.tick, f);
    }
    const ticks = [...byTick.keys()].sort((a, b) => a - b);
    return ticks.map((t) => {
        const f = byTick.get(t);
        const p = f.rows.find((r) => /Player$/.test(r.cls));
        const bp = f.rows.find((r) => /BombPusher$/.test(r.cls));
        return {
            t, level: f.status.level, hits: f.status.hits, hitsTimer: f.status.hits_timer, camera: f.status.camera,
            player: p ? { x: p.x, y: p.y, vx: p.vx, vy: p.vy } : null,
            pusher: bp ? { x: bp.x, y: bp.y, anim: bp.anim, index: bp.anim_index, frame: bp.frame } : null,
            bombs: f.rows.filter((r) => /(^|[.:])Bomb$/.test(r.cls))
                .map((r) => ({ x: r.x, y: r.y, vx: r.vx, vy: r.vy, angle: r.angle })),
        };
    });
}

async function report({ game, tape, MODULE, GAME_ONLY, UPTO, OUT, TAPE, FILE, PAGE_NAME, RECORD, NAME }) {
    const ticks = game.map((g) => g.t);

    // ── the GAME's story: shoot plays, bomb births and deaths, hits ─────────
    const events = [];
    for (let i = 1; i < game.length; i += 1) {
        const a = game[i - 1];
        const b = game[i];
        const gap = b.t - a.t;
        if (b.pusher && b.pusher.anim === 'shoot' && a.pusher?.anim !== 'shoot') events.push({ t: b.t, gap, what: 'shoot' });
        if (b.pusher && b.pusher.anim === 'sit' && a.pusher?.anim === 'shoot') events.push({ t: b.t, gap, what: 'sit' });
        if (b.bombs.length > a.bombs.length) events.push({ t: b.t, gap, what: 'bomb+', bombs: b.bombs });
        if (b.bombs.length < a.bombs.length) events.push({ t: b.t, gap, what: 'bomb-', last: a.bombs, player: b.player });
        if (b.hits !== a.hits) events.push({ t: b.t, gap, what: 'hits', from: a.hits, to: b.hits, hitsTimer: b.hitsTimer, player: b.player });
    }
    const missing = [];
    for (let i = 1; i < ticks.length; i += 1) if (ticks[i] - ticks[i - 1] > 1) missing.push(`${ticks[i - 1] + 1}..${ticks[i] - 1}`);
    console.log(`game: ${ticks.length} sampled tick(s) of ${tape.tick_count + 1}; unsampled spans: ${missing.length ? missing.slice(0, 10).join(' ') : 'none'}`);
    for (const e of events) console.log(`  t${e.t}${e.gap > 1 ? ` (gap ${e.gap})` : ''} ${e.what} ${JSON.stringify({ ...e, t: undefined, gap: undefined, what: undefined })}`);

    let model = null;
    if (!GAME_ONLY) model = await modelColumns(MODULE, tape, game);
    let disagreements = [];
    if (model) {
        disagreements = compare(game, model, UPTO);
        if (model.threw && !((model.lastTick ?? 0) >= UPTO)) {
            disagreements.push(`the model threw after t${model.lastTick ?? 0} (the game ran to t${game.at(-1).t})`);
        }
        const gameHits = events.filter((e) => e.what === 'hits' && e.to > e.from).map((e) => e.t);
        console.log(`game hits at ${JSON.stringify(gameHits)}; model playerHits ${JSON.stringify((model.hitsLedger ?? []).map((h) => [h.t, h.source, h.hits]))}`);
        console.log(`${disagreements.length === 0 ? 'PASS' : 'FAIL'}: every Bomb's position and velocity, the lobber's anim and the player's hits are the model's at every sampled tick`
            + `${Number.isFinite(UPTO) ? ` <= ${UPTO}` : ''}`);
        for (const d of disagreements.slice(0, 16)) console.log(`      ${d}`);
        if (disagreements.length > 16) console.log(`      … ${disagreements.length - 16} more`);
    }
    if (OUT) {
        writeFileSync(OUT, `${JSON.stringify({ tape: TAPE ?? FILE, page: PAGE_NAME, game, events,
            ...(model ? { model: model.cols, disagreements } : {}) }, null, 1)}\n`);
        console.log(`wrote ${OUT}`);
    }
    if (RECORD) {
        if (!model || disagreements.length > 0) {
            console.log('NOT RECORDED: the run did not pass — a witness the model disagrees with is not a fixture');
            process.exit(1);
        }
        const { mkdirSync } = await import('node:fs');
        const dir = join(MODULE, 'fixtures', 'bomb-witness');
        mkdirSync(dir, { recursive: true });
        const keep = game.filter((g) => g.t >= 1 && g.t <= UPTO);
        const out = {
            name: NAME, source: TAPE ?? FILE, page: PAGE_NAME, upto: UPTO,
            recordedBy: 'scripts/procgen/probe-seedling-bombpusher.mjs --record',
            switches: { SEEDLING_CONTACT_FIDELITY: process.env.SEEDLING_CONTACT_FIDELITY ?? null },
            note: 'the GAME\'s player, hits, camera, Bomb rows and lobber anim at each sampled tick 1..upto (`botMobiles()`,'
                + ' `botStatus()`); t0 is polled before the boot world exists',
            tape,
            samples: keep.map((g) => ({ t: g.t, p: [g.player.x, g.player.y], hits: g.hits, cam: g.camera,
                anim: g.pusher?.anim ?? null, bombs: g.bombs.map((b) => [b.x, b.y, b.vx, b.vy]) })),
        };
        const path = join(dir, `${NAME}.json`);
        writeFileSync(path, `${JSON.stringify(out)}\n`);
        console.log(`RECORDED ${path} (${out.samples.length} samples)`);
    }
    process.exit(model && disagreements.length > 0 ? 1 : 0);
}

/** The model's per-tick lobber/bomb/player columns (index = observation tick). */
async function modelColumns(MODULE, tape, game) {
    const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    let run = null;
    // ⚖ the cosmetic RNG is never modelled: on a shake band's 'uncertain' ticks the replay reads the GAME's camera
    // (`levelRun.witnessCamera`, the probe-seedling-chaser-mobiles `--camera` arm) — never tick 0 (polled before the
    // level's first `view()`).
    const cams = new Map(game.filter((g) => g.t >= 1 && g.camera).map((g) => [g.t, g.camera]));
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; },
        cameraWitness: (t) => cams.get(t) ?? null });
    const cols = [];
    let r;
    try {
        r = st.next();
    } catch (e) {
        console.log(`MODEL THREW at boot: ${e.message.slice(0, 600)}`);
        return { cols, threw: e.message };
    }
    while (!r.done) {
        const o = r.value.observation;
        const bombs = run?.entities?.('bombs') ?? [];
        const pushers = run?.entities?.('bombPushers') ?? [];
        cols[o.t] = {
            px: o.x, py: o.y,
            hits: run ? run.ledger('playerHits').filter((h) => h.t <= o.t).length : 0,
            bombs: bombs.filter((b) => !b.removed).map((b) => ({ id: b.id, x: b.x, y: b.y, vx: b.v.x, vy: b.v.y })),
            pusher: pushers[0] ? { anim: pushers[0].anim, index: pushers[0].animIndex } : null,
        };
        try {
            r = st.next();
        } catch (e) {
            console.log(`MODEL THREW after t${o.t}: ${e.message.slice(0, 600)}`);
            return { cols, threw: e.message, lastTick: o.t, hitsLedger: run ? run.ledger('playerHits') : [] };
        }
    }
    return { cols, hitsLedger: run ? run.ledger('playerHits') : [] };
}

function compare(game, model, upto) {
    const out = [];
    for (const g of game) {
        // t0 is polled before the boot's world exists (the previous run's player) — the chaser probe's exclusion.
        if (g.t > upto || g.t === 0) continue;
        const m = model.cols[g.t];
        if (!m) continue;
        if (g.player && (g.player.x !== m.px || g.player.y !== m.py)) {
            out.push(`t ${g.t}: player game (${g.player.x}, ${g.player.y}) model (${m.px}, ${m.py})`);
        }
        if (g.bombs.length !== m.bombs.length) {
            out.push(`t ${g.t}: game has ${g.bombs.length} Bomb row(s), the model ${m.bombs.length}`);
            continue;
        }
        for (const gb of g.bombs) {
            const mb = m.bombs.reduce((best, x) => (!best || Math.hypot(x.x - gb.x, x.y - gb.y)
                < Math.hypot(best.x - gb.x, best.y - gb.y) ? x : best), null);
            const d = [gb.x - mb.x, gb.y - mb.y, gb.vx - mb.vx, gb.vy - mb.vy].map(Math.abs);
            if (d.some((x) => x > 1e-9)) {
                out.push(`t ${g.t}: Bomb game (${gb.x}, ${gb.y}) v (${gb.vx}, ${gb.vy}) model ${mb.id} (${mb.x}, ${mb.y}) v (${mb.vx}, ${mb.vy})`);
            }
        }
        if (g.pusher && m.pusher && (g.pusher.anim || '') !== (m.pusher.anim || '')) {
            out.push(`t ${g.t}: lobber anim game "${g.pusher.anim}" model "${m.pusher.anim}"`);
        }
    }
    return out;
}
