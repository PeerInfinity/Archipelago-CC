#!/usr/bin/env node
/**
 * probe-seedling-bomb-blast-body — ⛓ seedling-fidelity-bombblast D1/D2: A BOMB'S EXPLOSION ON A BODY, ASKED OF THE GAME
 * TICK BY TICK.
 *
 * `Explosion.added()` (`Explosion.as:47-68`) hands every `"Enemy"` whose box meets the prefilter square and whose
 * origin is within 15 px (`int(24 * 0.65)`) `Enemy.hit(4, new Point(x, y), 1)`. This probe plays a tape on the
 * recompiled game (p4f, headless) and polls `botMobiles()` + `botStatus()` at every frame, keeping one sample per tick
 * (the LAST poll before the tick advanced — fidelity SMALLGAPS D1's observation point): every `Bob`, `BobSoldier`,
 * `Spinner` and `Bomb` row (position, velocity, anim, `hits`, `hits_timer`) and the player. It names each blast (a
 * `Bomb` row that vanished) and every body whose `hits` moved on that tick, with its velocity before and after.
 *
 * Unless `--game-only`, it then replays the tape through the model (`tapeRunner`, the process's switches —
 * `SEEDLING_BOMB_BLAST_BODY=1` turns the D2 arm on) and joins every body of those classes on the tick (nearest row
 * of the class): position and velocity to the bit, `hits` and `hits_timer`, presence.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-bomb-blast-body.mjs --file=<tape.json>
 *   … --tape=<fixture name>  a committed tape instead of --file
 *   … --out=<file.json>      write every sample (game rows; model rows unless --game-only)
 *   … --game-only            skip the model replay (a D1 measurement)
 *   … --reuse=<out.json>     no browser: re-join the model against the game rows a previous `--out` wrote
 *   … --from=<tick>          compare only samples at or after this tick (default 1)
 *   … --upto=<tick>          compare only samples at or before this tick
 *   … --record --name=<n> --window=<a>..<b>
 *                            write the tape and the GAME's rows in the window (the player, its hits, every Bob, BobSoldier
 *                            and Spinner row west of x 400 and north of y 260 — the lobber's reach) to
 *                            `fixtures/bombblast-witness/<n>.json` — only on a PASS of the model over that window;
 *                            `fidelityBombBlast.test.js` replays it
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

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = join(HERE, '..', '..', 'frontend', 'modules', 'seedlingDemo');
/** The AS3 classes asked, and the census tag the model's body ids carry. */
export const BODY_CLASSES = Object.freeze({ Bob: 'bob', BobSoldier: 'bobsoldier', Spinner: 'spinner' });
const classOf = (cls) => Object.keys(BODY_CLASSES).find((c) => new RegExp(`(^|[.:])${c}$`).test(cls)) ?? null;

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const TAPE = arg('tape');
    const FILE = arg('file');
    if (!TAPE === !FILE) {
        console.error('probe-seedling-bomb-blast-body: exactly one of --tape=<fixture> / --file=<path> is required');
        process.exit(2);
    }
    const OUT = arg('out');
    const GAME_ONLY = process.argv.includes('--game-only');
    const FROM = arg('from') === null ? 1 : Number(arg('from'));
    const UPTO = arg('upto') === null ? Infinity : Number(arg('upto'));
    const REUSE = arg('reuse');
    const RECORD = process.argv.includes('--record');
    const NAME = arg('name');
    const WINDOW = arg('window')?.split('..').map(Number) ?? null;
    if (RECORD && (!NAME || !WINDOW || WINDOW.length !== 2 || !WINDOW.every(Number.isInteger) || GAME_ONLY)) {
        console.error('probe-seedling-bomb-blast-body: --record needs --name=<n> --window=<a>..<b> and the model replay');
        process.exit(2);
    }
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

    const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const tape = TAPE ? loadTape(TAPE) : parseTape(readFileSync(FILE, 'utf8'));
    const game = REUSE ? JSON.parse(readFileSync(REUSE, 'utf8')).game : await playOnGame(tape, PAGE_URL);
    if (!game) process.exit(1);

    const events = gameEvents(game);
    console.log(`game: ${game.length} sampled tick(s) of ${tape.tick_count + 1}`);
    for (const e of events) console.log(`  t${e.t} ${e.what} ${JSON.stringify({ ...e, t: undefined, what: undefined })}`);

    let model = null;
    let disagreements = [];
    if (!GAME_ONLY) {
        model = await modelColumns(tape, game);
        disagreements = compare(game, model, RECORD ? WINDOW[0] : FROM, RECORD ? WINDOW[1] : UPTO);
        if (model.threw && !((model.lastTick ?? 0) >= Math.min(UPTO, game.at(-1).t))) {
            disagreements.push(`the model threw after t${model.lastTick ?? 0} (the game ran to t${game.at(-1).t}): `
                + model.threw.slice(0, 300));
        }
        const range = RECORD ? `${WINDOW[0]}..${WINDOW[1]}` : `${FROM}..${Number.isFinite(UPTO) ? UPTO : game.at(-1).t}`;
        console.log(`model body hits: ${JSON.stringify(model.bodyHits)}`);
        console.log(`${disagreements.length === 0 ? 'PASS' : 'FAIL'}: every Bob, BobSoldier and Spinner's position, `
            + `velocity, hits and hits_timer and the player's position are the model's at every sampled tick ${range}`);
        for (const d of disagreements.slice(0, 20)) console.log(`      ${d}`);
        if (disagreements.length > 20) console.log(`      … ${disagreements.length - 20} more`);
    }
    if (OUT) {
        writeFileSync(OUT, `${JSON.stringify({ tape: TAPE ?? FILE, page: PAGE_NAME, game, events,
            ...(model ? { model: model.cols, bodyHits: model.bodyHits, disagreements } : {}) })}\n`);
        console.log(`wrote ${OUT}`);
    }
    if (RECORD) {
        if (disagreements.length > 0) {
            console.log('NOT RECORDED: the model disagrees over the window — a witness the model disagrees with is not a fixture');
            process.exit(1);
        }
        const { mkdirSync } = await import('node:fs');
        const dir = join(MODULE, 'fixtures', 'bombblast-witness');
        mkdirSync(dir, { recursive: true });
        const [a, b] = WINDOW;
        const out = {
            name: NAME, source: TAPE ?? FILE, page: PAGE_NAME, window: [a, b],
            recordedBy: 'scripts/procgen/probe-seedling-bomb-blast-body.mjs --record',
            switches: { SEEDLING_CONTACT_FIDELITY: process.env.SEEDLING_CONTACT_FIDELITY ?? null,
                SEEDLING_BOMB_BLAST_BODY: process.env.SEEDLING_BOMB_BLAST_BODY ?? null },
            note: 'the GAME\'s player, its hits, its camera, and every Bob/BobSoldier/Spinner row with x < 400 and y < 260 at each '
                + 'sampled tick of the window (`botMobiles()`, `botStatus()`; the last poll before the tick advanced); a '
                + 'body row is [class, x, y, vx, vy, hits, hits_timer]',
            events: events.filter((e) => e.t >= a && e.t <= b),
            tape,
            samples: game.filter((g) => g.t >= a && g.t <= b).map((g) => ({ t: g.t, p: [g.player.x, g.player.y],
                hits: g.hits, cam: g.camera, bodies: g.bodies.filter((r) => r.x < 400 && r.y < 260)
                    .map((r) => [r.cls, r.x, r.y, r.vx, r.vy, r.hits, r.hitsTimer]) })),
        };
        const path = join(dir, `${NAME}.json`);
        writeFileSync(path, `${JSON.stringify(out)}\n`);
        console.log(`RECORDED ${path} (${out.samples.length} samples)`);
    }
    process.exit(model && disagreements.length > 0 ? 1 : 0);
}

/** The game's rows, one sample per tick. ⛔ Takes the box (a browser instrument). */
async function playOnGame(tape, PAGE_URL) {
    const { gameVisibleTape } = await import(join(MODULE, 'tapeFormat.js'));
    takeBoxLockOrExit({ name: 'probe-seedling-bomb-blast-body.mjs', kind: 'browser' });
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
        const deadline = Date.now() + 900000;
        while (Date.now() < deadline) {
            const raw = await page.evaluate(() => {
                const g = window.__swfBridge.game;
                return [String(g.botMobiles()), String(g.botStatus())];
            });
            const m = JSON.parse(raw[0]);
            const s = JSON.parse(raw[1]);
            const rows = (m.mobiles ?? []).filter((r) => /(Bomb|Player)$/.test(r.cls) || classOf(r.cls));
            frames.push({ tick: m.tick ?? s.tick, status: { tick: s.tick, level: s.level, hits: s.hits,
                hits_timer: s.hits_timer, finished: s.finished, camera: s.camera ?? null }, rows });
            if (s.finished) { finished = true; break; }
        }
    } finally {
        await browser.close();
    }
    if (!finished) {
        console.log('FAIL: the tape never finished inside the deadline');
        return null;
    }
    // one sample per tick: the LAST poll before the tick advanced; the tape's FINAL tick keeps its first poll
    const inTape = frames.filter((f) => Number.isInteger(f.tick) && f.tick === f.status.tick && f.tick >= 0
        && f.tick <= tape.tick_count);
    const finalTick = inTape.reduce((m, f) => Math.max(m, f.tick), -Infinity);
    const byTick = new Map();
    for (const f of inTape) if (f.tick !== finalTick || !byTick.has(f.tick)) byTick.set(f.tick, f);
    return [...byTick.keys()].sort((a, b) => a - b).map((t) => {
        const f = byTick.get(t);
        const p = f.rows.find((r) => /Player$/.test(r.cls));
        return {
            t, level: f.status.level, hits: f.status.hits, hitsTimer: f.status.hits_timer, camera: f.status.camera,
            player: p ? { x: p.x, y: p.y, vx: p.vx, vy: p.vy } : null,
            bombs: f.rows.filter((r) => /(^|[.:])Bomb$/.test(r.cls)).map((r) => ({ x: r.x, y: r.y, vx: r.vx, vy: r.vy })),
            bodies: f.rows.filter((r) => classOf(r.cls)).map((r) => ({ cls: classOf(r.cls), x: r.x, y: r.y, vx: r.vx,
                vy: r.vy, anim: r.anim ?? null, hits: r.enemy?.hits ?? null, hitsTimer: r.enemy?.hits_timer ?? null })),
        };
    });
}

/** The game's story: each blast (a Bomb row gone), each body whose `hits` moved, each body that left. */
export function gameEvents(game) {
    const events = [];
    const near = (list, b) => list.filter((x) => x.cls === b.cls).reduce((best, x) => (!best
        || Math.hypot(x.x - b.x, x.y - b.y) < Math.hypot(best.x - b.x, best.y - b.y) ? x : best), null);
    for (let i = 1; i < game.length; i += 1) {
        const a = game[i - 1];
        const b = game[i];
        if (b.bombs.length < a.bombs.length) {
            for (const gone of a.bombs.filter((x) => !b.bombs.some((y) => Math.hypot(y.x - x.x - y.vx, y.y - x.y - y.vy) < 1e-6
                || (y.x === x.x && y.y === x.y)))) {
                events.push({ t: b.t, what: 'blast', last: { x: gone.x, y: gone.y, vx: gone.vx, vy: gone.vy } });
            }
        }
        for (const body of b.bodies) {
            const prev = near(a.bodies, body);
            if (!prev) continue;
            if (body.hits !== prev.hits) {
                events.push({ t: b.t, what: 'body-hit', cls: body.cls, from: prev, to: body });
            }
            if (body.anim !== prev.anim && (body.anim === 'die' || prev.anim === 'die')) {
                events.push({ t: b.t, what: 'anim', cls: body.cls, from: prev.anim, to: body.anim, at: [body.x, body.y] });
            }
        }
        for (const c of Object.keys(BODY_CLASSES)) {
            const na = a.bodies.filter((x) => x.cls === c).length;
            const nb = b.bodies.filter((x) => x.cls === c).length;
            if (nb !== na) events.push({ t: b.t, what: 'count', cls: c, from: na, to: nb });
        }
        if (b.hits !== a.hits) events.push({ t: b.t, what: 'player-hits', from: a.hits, to: b.hits, player: b.player });
    }
    return events;
}

/** The model's per-tick body columns (index = observation tick). */
async function modelColumns(tape, game) {
    const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    let run = null;
    // ⚖ the cosmetic RNG is never modelled: on a shake band's 'uncertain' ticks the replay reads the GAME's camera.
    const cams = new Map(game.filter((g) => g.t >= 1 && g.camera).map((g) => [g.t, g.camera]));
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; },
        cameraWitness: (t) => cams.get(t) ?? null });
    const cols = [];
    const bodyHits = () => (run?.ledger?.('bombEvents') ?? []).filter((h) => h.what === 'body-hit').map((h) => [h.t, h.body, h.arm, h.hitsAfter ?? null,
        h.killed ? 'killed' : (h.refusedAt ? 'refused' : 'landed')]);
    let r;
    try {
        r = st.next();
    } catch (e) {
        return { cols, threw: e.message, lastTick: -1, bodyHits: [] };
    }
    while (!r.done) {
        const o = r.value.observation;
        const bodies = [];
        for (const c of run?.entities?.('chasers') ?? []) {
            if (c.removed) continue;
            const cls = Object.keys(BODY_CLASSES).find((k) => BODY_CLASSES[k] === c.tag);
            if (cls) bodies.push({ cls, id: c.id, x: c.x, y: c.y, vx: c.vx, vy: c.vy, hits: c.hits, hitsTimer: c.hitsTimer });
        }
        // `spinnerBodies` carries no velocity: a spinner is joined on position, `hits` and `hits_timer`.
        // ⚠ A faded spinner (alpha < 0) is GONE in the game on that tick (`Spinner.death` removes it in the same
        // update) and still listed by the run until its next tick drains it — for a press kill and a blast kill alike
        // (measured: t1285 and t1350 of `bombblast-l40-bw-lapse1-idle`); the kill ledger's `removedTick` is the game's.
        for (const s of run?.entities?.('spinnerBodies') ?? []) {
            if (s.removed || s.alpha < 0) continue;
            bodies.push({ cls: 'Spinner', id: s.id, x: s.x, y: s.y, vx: null, vy: null, hits: s.hits, hitsTimer: s.hitsTimer });
        }
        cols[o.t] = { px: o.x, py: o.y, bodies };
        try {
            r = st.next();
        } catch (e) {
            return { cols, threw: e.message, lastTick: o.t, bodyHits: bodyHits() };
        }
    }
    return { cols, bodyHits: bodyHits() };
}

function compare(game, model, from, upto) {
    const out = [];
    for (const g of game) {
        if (g.t < Math.max(from, 1) || g.t > upto) continue;
        const m = model.cols[g.t];
        if (!m) continue;
        if (g.player && (g.player.x !== m.px || g.player.y !== m.py)) {
            out.push(`t ${g.t}: player game (${g.player.x}, ${g.player.y}) model (${m.px}, ${m.py})`);
        }
        for (const cls of Object.keys(BODY_CLASSES)) {
            const gs = g.bodies.filter((b) => b.cls === cls);
            const ms = m.bodies.filter((b) => b.cls === cls);
            if (gs.length !== ms.length) {
                out.push(`t ${g.t}: game has ${gs.length} ${cls} row(s), the model ${ms.length}`);
                continue;
            }
            for (const gb of gs) {
                const mb = ms.reduce((best, x) => (!best || Math.hypot(x.x - gb.x, x.y - gb.y)
                    < Math.hypot(best.x - gb.x, best.y - gb.y) ? x : best), null);
                const d = [gb.x - mb.x, gb.y - mb.y, ...(mb.vx === null ? [] : [gb.vx - mb.vx, gb.vy - mb.vy])]
                    .map(Math.abs);
                if (d.some((x) => !(x <= 1e-9))) {
                    out.push(`t ${g.t}: ${cls} game (${gb.x}, ${gb.y}) v (${gb.vx}, ${gb.vy}) model ${mb.id} `
                        + `(${mb.x}, ${mb.y}) v (${mb.vx}, ${mb.vy})`);
                }
                if (gb.hits !== null && (gb.hits !== mb.hits || gb.hitsTimer !== mb.hitsTimer)) {
                    out.push(`t ${g.t}: ${cls} ${mb.id} hits game ${gb.hits}/${gb.hitsTimer} model ${mb.hits}/${mb.hitsTimer}`);
                }
            }
        }
    }
    return out;
}
