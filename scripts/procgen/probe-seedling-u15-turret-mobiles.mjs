#!/usr/bin/env node
/**
 * probe-seedling-u15-turret-mobiles — ⛓⛓⛓ U15-swim: THE TURRETS AND THEIR
 * SPITS, ASKED OF THE GAME, TICK BY SAMPLED TICK.
 *
 * U9's `probe-seedling-u9-shield-mobiles.mjs`, for the shooter family. An
 * expectation carries the PLAYER only, so a spit is visible to the
 * differential only when it lands; the aim, the animation clock and each
 * spit's flight need the bodies themselves. `botMobiles()` returns every live
 * `Mobile` — `Turret` is an `Enemy` and `TurretSpit` a `Mobile`, and each row
 * carries `angle` (`Image.angle`), `anim` and `anim_index`.
 *
 * ⚠ THE SAMPLE'S TICK IS CALIBRATED, NOT ASSUMED (U7's law): the PLAYER's x/y
 * at each sample must fit the model's at exactly one shift, zero.
 *
 * Per sampled tick it compares, to the bit:
 *   · every Turret: `angle`, `anim`, `anim_index` against `run.entities('shooters')`;
 *   · the spits: the count, and each one's x, y, vx, vy (joined by nearest).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-u15-turret-mobiles.mjs --tape=u15-turret-spit
 *   … --out=<file.json>    write every sample with both readings
 *   … --upto=<tick>        compare only samples at or before this tick
 *   … --game-only          record the game's rows and compare nothing (a
 *                          model that does not step the family yet)
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
    console.error('probe-seedling-u15-turret-mobiles: --tape=<fixture name> is required');
    process.exit(2);
}
const OUT = arg('out');
const UPTO = arg('upto') === null ? Infinity : Number(arg('upto'));
const GAME_ONLY = process.argv.includes('--game-only');
takeBoxLockOrExit({ name: 'probe-seedling-u15-turret-mobiles.mjs', kind: 'browser' });

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

// ── the MODEL: the run's own shooter state after each tick (index 0 = boot) ──
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
        const sh = (!run || GAME_ONLY) ? [] : run.entities('shooters');
        col[o.t] = { px: o.x, py: o.y, turrets: sh, spits: sh.flatMap((t) => t.spits) };
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
    while (Date.now() < deadline) {
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
const turretsOf = (f) => rowsOf(f).filter((r) => /(^|[.:])Turret$/.test(r.cls));
const spitsOf = (f) => rowsOf(f).filter((r) => /TurretSpit$/.test(r.cls));
const inTape = frames.filter((f) => {
    const t = tickOf(f);
    return Number.isInteger(t) && t >= 0 && t <= tape.tick_count && col[t] && playerOf(f);
});
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
    + `${samples.length} sampled tick(s) inside the tape; shifts that fit every player x/y: `
    + `[${fits.join(', ')}] (must be exactly [0])`);

let compared = 0;
let worst = 0;
const rows = [];
const disagreements = [];
const near = (list, g) => list.reduce((best, x) => (!best || Math.hypot(x.x - g.x, x.y - g.y)
    < Math.hypot(best.x - g.x, best.y - g.y) ? x : best), null);
for (const f of samples) {
    const t = tickOf(f);
    if (t > UPTO) continue;
    const gT = turretsOf(f);
    const gS = spitsOf(f);
    rows.push({
        t,
        game: {
            turrets: gT.map((g) => ({ x: g.x, y: g.y, angle: g.angle, anim: g.anim,
                anim_index: g.anim_index, on_screen: g.on_screen })),
            spits: gS.map((g) => ({ x: g.x, y: g.y, vx: g.vx, vy: g.vy })),
        },
        model: GAME_ONLY ? null : { turrets: col[t].turrets.map((m) => ({ id: m.id, x: m.x,
            y: m.y, angle: m.angle, anim: m.anim, animIndex: m.animIndex,
            shootTimer: m.shootTimer })), spits: col[t].spits },
    });
    if (GAME_ONLY) continue;
    const mT = col[t].turrets;
    if (gT.length !== mT.length) {
        disagreements.push(`t ${t}: game has ${gT.length} Turret row(s), the model ${mT.length}`);
    }
    for (const g of gT) {
        const m = mT.find((x) => x.x === g.x && x.y === g.y);
        if (!m) { disagreements.push(`t ${t}: no model turret at (${g.x},${g.y})`); continue; }
        compared += 1;
        const d = Math.abs(g.angle - m.angle);
        worst = Math.max(worst, d);
        if (d > 1e-9 || g.anim !== m.anim || g.anim_index !== m.animIndex) {
            disagreements.push(`t ${t}: turret (${g.x},${g.y}) game angle ${g.angle} `
                + `anim "${g.anim}"#${g.anim_index}, model angle ${m.angle} anim "${m.anim}"#${m.animIndex}`);
        }
    }
    const mS = col[t].spits;
    if (gS.length !== mS.length) {
        disagreements.push(`t ${t}: game has ${gS.length} spit(s), the model ${mS.length}`);
    }
    for (const g of gS) {
        const m = near(mS, g);
        if (!m) continue;
        compared += 1;
        const d = [g.x - m.x, g.y - m.y, g.vx - m.v.x, g.vy - m.v.y].map(Math.abs);
        worst = Math.max(worst, ...d);
        if (d.some((x) => x > 1e-9)) {
            disagreements.push(`t ${t}: spit game (${g.x}, ${g.y}) v (${g.vx}, ${g.vy}) model `
                + `${m.id} (${m.x}, ${m.y}) v (${m.v.x}, ${m.v.y})`);
        }
    }
}
const agree = GAME_ONLY || (compared > 0 && disagreements.length === 0);
if (!GAME_ONLY) {
    console.log(`${agree ? 'PASS' : 'FAIL'}: every turret's angle and animation, and every spit's `
        + `position and velocity, are the model's at every sampled tick`
        + `${Number.isFinite(UPTO) ? ` <= ${UPTO}` : ''} — ${compared} comparison(s), worst |Δ| ${worst}`);
    for (const d of disagreements.slice(0, 12)) console.log(`      ${d}`);
    if (disagreements.length > 12) console.log(`      … ${disagreements.length - 12} more`);
} else {
    const shots = rows.filter((r) => r.game.spits.length > 0);
    console.log(`GAME ONLY: ${rows.length} sampled tick(s); spits seen on ${shots.length} of them`);
}
if (OUT) {
    writeFileSync(OUT, `${JSON.stringify({ tape: TAPE, page: PAGE_NAME, calibrated, fits,
        compared, worst, disagreements, rows }, null, 1)}\n`);
    console.log(`wrote ${OUT}`);
}
process.exit(calibrated && agree ? 0 : 1);
