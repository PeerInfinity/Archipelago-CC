#!/usr/bin/env node
/**
 * probe-seedling-chaser-mobiles — ⛓ seedling-fidelity-staticladder D3: ONE BRIDGED CHASER CLASS, ASKED OF THE GAME TICK
 * BY SAMPLED TICK (`probe-seedling-bobsoldier-mobiles.mjs` with the class and the tape as arguments).
 *
 * Compares every sampled row of the named AS3 class that `botMobiles()` reports (position, velocity, `hits`,
 * `hits_timer`, presence) against the model's `run.entities('chasers')` bodies of that census tag at the SAME tick,
 * after calibrating the sample clock on the player. It was written for K2 (`KILLLOCK_BODIES.lavaRunnerLive`): the
 * model run takes the process's switches, so `SEEDLING_KILLLOCK_BODIES=all` turns the lavarunner bridge on for it
 * (the GAME always runs the real class).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   SEEDLING_KILLLOCK_BODIES=all node scripts/procgen/probe-seedling-chaser-mobiles.mjs --class=LavaRunner --file=<tape.json>
 *   … --tape=<fixture name>  a committed tape instead of --file
 *   … --out=<file.json>      write every sample with both readings
 *   … --upto=<tick>          compare only samples at or before this tick
 *   … --record --name=<n>    write the tape and the GAME's rows of the class (with the player) to
 *                            `fixtures/chaser-witness/<n>.json` — only on a PASS; `fidelityLavaRunner.test.js` replays it
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
    const CLASS = arg('class');
    if (!TAPE === !FILE || !CLASS) {
        console.error('probe-seedling-chaser-mobiles: --class=<AS3 class> and exactly one of --tape=<fixture> / --file=<path> are required');
        process.exit(2);
    }
    const OUT = arg('out');
    const RECORD = process.argv.includes('--record');
    const NAME = arg('name');
    if (RECORD && !NAME) {
        console.error('probe-seedling-chaser-mobiles: --record needs --name=<witness name>');
        process.exit(2);
    }
    const UPTO = arg('upto') === null ? Infinity : Number(arg('upto'));

    takeBoxLockOrExit({ name: 'probe-seedling-chaser-mobiles.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

    const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));

    const tape = TAPE ? loadTape(TAPE) : parseTape(readFileSync(FILE, 'utf8'));
    const { CHASERS } = await import(join(MODULE, 'chasers.js'));
    const TAG = Object.entries(CHASERS).find(([, c]) => c.as3 === CLASS)?.[0];
    if (!TAG) {
        console.error(`probe-seedling-chaser-mobiles: no CHASERS row transcribes ${CLASS}`);
        process.exit(2);
    }

    // ── the MODEL: the run's own chaser state after each tick (index 0 = boot) ──
    const col = [];
    {
        let run = null;
        const st = createTapeStepper(tape, {
            levelSource: atlasLevelSource(),
            onTick: (t, s, h, rn) => { run = rn; },
        });
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            const ch = run ? (run.entities('chasers') ?? []) : [];
            col[o.t] = {
                px: o.x, py: o.y,
                bodies: ch.map((c) => ({ id: c.id, x: c.x, y: c.y, vx: c.vx, vy: c.vy, hits: c.hits, hitsTimer: c.hitsTimer,
                    removed: c.removed === true,
                    swordSpin: c.swordSpin, swordSpinning: c.swordSpinning })),
            };
            r = st.next();
        }
    }

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
        const deadline = Date.now() + 600000;
        for (let i = 0; Date.now() < deadline; i += 1) {
            const raw = await page.evaluate(() => {
                const g = window.__swfBridge.game;
                return [String(g.botMobiles()), String(g.botStatus())];
            });
            const m = JSON.parse(raw[0]);
            const s = JSON.parse(raw[1]);
            frames.push({ status: { tick: s.tick, level: s.level, finished: s.finished }, mobiles: m });
            if (s.finished) { status = s; break; }
        }
    } finally {
        await browser.close();
    }
    if (!status) {
        console.log('FAIL: the tape never finished inside the deadline');
        process.exit(1);
    }

    // ── the JOIN ────────────────────────────────────────────────────────────
    const rowsOf = (f) => f.mobiles.mobiles ?? [];
    const tickOf = (f) => f.mobiles.tick ?? f.status.tick;
    const playerOf = (f) => rowsOf(f).find((r) => /Player$/.test(r.cls));
    const bodiesOf = (f) => rowsOf(f).filter((r) => new RegExp(`(^|[.:])${CLASS}$`).test(r.cls));
    const inTape = frames.filter((f) => {
        const t = tickOf(f);
        return Number.isInteger(t) && t >= 0 && t <= tape.tick_count && col[t] && playerOf(f);
    });
    // one sample per tick (the first one at it — later ones may straddle the update)
    const byTick = new Map();
    for (const f of inTape) if (!byTick.has(tickOf(f))) byTick.set(tickOf(f), f);
    const samples = [...byTick.values()];

    const fits = [];
    for (let shift = -3; shift <= 3; shift += 1) {
        const ok = samples.every((f) => {
            const m = col[tickOf(f) + shift];
            const p = playerOf(f);
            return m && Math.abs(m.px - p.x) < 1e-9 && Math.abs(m.py - p.y) < 1e-9;
        });
        if (ok) fits.push(shift);
    }
    const calibrated = fits.length === 1 && fits[0] === 0;
    console.log(`${calibrated ? 'PASS' : 'FAIL'}: the sample clock is the model's — `
        + `${samples.length} sampled tick(s) inside the tape; shifts that fit every player x: `
        + `[${fits.join(', ')}] (must be exactly [0])`);

    let worst = 0;
    let compared = 0;
    const rows = [];
    const disagreements = [];
    for (const f of samples) {
        const t = tickOf(f);
        if (t > UPTO) continue;
        const game = bodiesOf(f);
        const model = col[t].bodies.filter((b) => b.id.startsWith(`${TAG}@`) && !b.removed);
        if (game.length !== model.length) {
            disagreements.push(`t ${t}: game has ${game.length} ${CLASS} row(s), the model ${model.length}`);
            continue;
        }
        for (let i = 0; i < game.length; i += 1) {
            // the census id names the PLACEMENT; join by nearest
            const g = game[i];
            const b = model.reduce((best, x) => (!best || Math.hypot(x.x - g.x, x.y - g.y)
                < Math.hypot(best.x - g.x, best.y - g.y) ? x : best), null);
            // position AND velocity, to the bit; and the body's own damage state
            const d = [g.x - b.x, g.y - b.y, g.vx - b.vx, g.vy - b.vy].map(Math.abs);
            worst = Math.max(worst, ...d);
            compared += 1;
            rows.push({ t, game: { x: g.x, y: g.y, vx: g.vx, vy: g.vy, anim: g.anim, enemy: g.enemy },
                model: b });
            if (d.some((x) => x > 1e-9)) {
                disagreements.push(`t ${t}: game (${g.x}, ${g.y}) v (${g.vx}, ${g.vy}) model `
                    + `(${b.x}, ${b.y}) v (${b.vx}, ${b.vy})`);
            }
            if (g.enemy && (g.enemy.hits !== b.hits || g.enemy.hits_timer !== b.hitsTimer)) {
                disagreements.push(`t ${t}: game hits ${g.enemy.hits}/${g.enemy.hits_timer} model `
                    + `${b.hits}/${b.hitsTimer}`);
            }
        }
    }
    const agree = compared > 0 && disagreements.length === 0;
    console.log(`${agree ? 'PASS' : 'FAIL'}: every ${CLASS}'s position, velocity, hits and hits_timer are the model's at every sampled tick, and they exist exactly when the model's do`
        + `${Number.isFinite(UPTO) ? ` <= ${UPTO}` : ''} — ${compared} comparison(s), worst |Δ| ${worst}`);
    for (const d of disagreements.slice(0, 12)) console.log(`      ${d}`);
    if (disagreements.length > 12) console.log(`      … ${disagreements.length - 12} more`);
    if (OUT) {
        writeFileSync(OUT, `${JSON.stringify({ tape: TAPE ?? FILE, class: CLASS, page: PAGE_NAME, calibrated, fits, compared, worst, disagreements, rows }, null, 1)}\n`);
        console.log(`wrote ${OUT}`);
    }
    if (RECORD) {
        if (!(calibrated && agree)) {
            console.log('NOT RECORDED: the run did not pass — a witness the model disagrees with is not a fixture');
        } else {
            const { mkdirSync } = await import('node:fs');
            const dir = join(MODULE, 'fixtures', 'chaser-witness');
            mkdirSync(dir, { recursive: true });
            const out = {
                name: NAME, class: CLASS, source: TAPE ?? FILE, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-chaser-mobiles.mjs --record',
                switches: { SEEDLING_KILLLOCK_BODIES: process.env.SEEDLING_KILLLOCK_BODIES ?? null },
                note: `the GAME's ${CLASS} rows (\`botMobiles()\`) and the player at each sampled tick`,
                samples: samples.filter((f) => tickOf(f) <= UPTO).map((f) => ({
                    t: tickOf(f), level: f.status.level, player: { x: playerOf(f).x, y: playerOf(f).y },
                    bodies: bodiesOf(f).map((g) => ({ x: g.x, y: g.y, vx: g.vx, vy: g.vy,
                        hits: g.enemy?.hits ?? null, hits_timer: g.enemy?.hits_timer ?? null })),
                })),
                tape: FILE ? JSON.parse(readFileSync(FILE, 'utf8')) : null,
            };
            const path = join(dir, `${NAME}.json`);
            writeFileSync(path, `${JSON.stringify(out, null, 1)}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${out.samples.length} sampled tick(s)`);
        }
    }
    process.exit(calibrated && agree ? 0 : 1);
}
