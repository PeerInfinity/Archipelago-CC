#!/usr/bin/env node
/**
 * probe-seedling-u9-shield-mobiles — ⛓⛓⛓ U9-swim: A STEPPED BODY'S OWN
 * POSITION, ASKED OF THE GAME, TICK BY SAMPLED TICK — for the shield-bump
 * witnesses (`plan-seedling-u9-shield-bump.mjs`).
 *
 * U7's `probe-seedling-u7-puncher-mobiles.mjs`, generalised by one argument:
 * `--class=Bob|Puncher|Spinner` picks the `botMobiles()` rows (`cls` ends in
 * it) and the model's body ids (`<tag>@`; ⛓ R2-swim D1 adds `WallFlyer`, read from
 * `run.wallFlyers.bodies`, with velocity). ⛓ R1-swim D3: a `Spinner` is read
 * from `run.entities('spinnerBodies')`, which carries no velocity — so for a
 * spinner the comparison is position, `hits` and `hits_timer` (a position
 * equal to the bit on every tick pins the velocity that moved it). Everything else is U7's: an expectation
 * carries the PLAYER only, so a shove that has not yet reached the player is
 * invisible to the differential; this compares the body itself. The sample's
 * tick is CALIBRATED on the player's x (exactly one shift, zero, must fit),
 * and position, velocity, `hits` and `hits_timer` must be the model's at
 * every sampled tick.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-u9-shield-mobiles.mjs --tape=u9-shield-bob-shove --class=Bob
 *   … --out=<file.json>    write every sample with both readings
 *   … --upto=<tick>        compare only samples at or before this tick
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const TAPE = arg('tape');
if (!TAPE) {
    console.error('probe-seedling-u9-shield-mobiles: --tape=<fixture name> is required');
    process.exit(2);
}
const CLASS = arg('class') ?? 'Bob';
if (!/^(Bob|Puncher|Spinner|WallFlyer)$/.test(CLASS)) {
    console.error(`probe-seedling-u9-shield-mobiles: --class=${CLASS} — Bob, Puncher, Spinner or WallFlyer`);
    process.exit(2);
}
const TAG = CLASS.toLowerCase();
const OUT = arg('out');
const UPTO = arg('upto') === null ? Infinity : Number(arg('upto'));

takeBoxLockOrExit({ name: 'probe-seedling-u9-shield-mobiles.mjs', kind: 'browser' });

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4e';
const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
    + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { gameVisibleTape } = await import(join(MODULE, 'tapeFormat.js'));
const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));

const tape = loadTape(TAPE);

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
        // ⛓ R2-swim D1: a `WallFlyer` is read from `run.wallFlyers.bodies` (live, unremoved).
        const ch = !run ? [] : (CLASS === 'Spinner' ? run.entities('spinnerBodies')
            : CLASS === 'WallFlyer' ? run.wallFlyers.bodies.filter((w) => !w.removed)
                : run.entities('chasers'));
        col[o.t] = {
            px: o.x, py: o.y,
            bodies: ch.map((c) => ({ id: c.id, x: c.x, y: c.y, vx: c.vx, vy: c.vy, hits: c.hits, hitsTimer: c.hitsTimer })),
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
const bodiesOf = (f) => rowsOf(f).filter((r) => r.cls.endsWith(CLASS));
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
    const model = col[t].bodies.filter((b) => b.id.startsWith(`${TAG}@`));
    if (game.length !== model.length) {
        disagreements.push(`t ${t}: game has ${game.length} ${CLASS} row(s), the model ${model.length}`);
        continue;
    }
    for (let i = 0; i < game.length; i += 1) {
        // the census id names the PLACEMENT; join by nearest (one body per room here)
        const g = game[i];
        const b = model.reduce((best, x) => (!best || Math.hypot(x.x - g.x, x.y - g.y)
            < Math.hypot(best.x - g.x, best.y - g.y) ? x : best), null);
        // position AND velocity, to the bit; and the body's own damage state
        // (a spinner's model row has no velocity — see the header)
        const d = (b.vx === undefined ? [g.x - b.x, g.y - b.y]
            : [g.x - b.x, g.y - b.y, g.vx - b.vx, g.vy - b.vy]).map(Math.abs);
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
console.log(`${agree ? 'PASS' : 'FAIL'}: the ${CLASS}'s position, velocity, hits and hits_timer are the model's at every sampled tick, and it exists exactly when the model's does`
    + `${Number.isFinite(UPTO) ? ` <= ${UPTO}` : ''} — ${compared} comparison(s), worst |Δ| ${worst}`);
for (const d of disagreements.slice(0, 12)) console.log(`      ${d}`);
if (disagreements.length > 12) console.log(`      … ${disagreements.length - 12} more`);
if (OUT) {
    writeFileSync(OUT, `${JSON.stringify({ tape: TAPE, class: CLASS, page: PAGE_NAME, calibrated, fits, compared, worst, disagreements, rows }, null, 1)}\n`);
    console.log(`wrote ${OUT}`);
}
process.exit(calibrated && agree ? 0 : 1);
