#!/usr/bin/env node
/**
 * probe-seedling-bobsoldier-mobiles — ⛓⛓⛓ seedling-fidelity-bobsoldier: THE BOBSOLDIER'S OWN POSITION, ASKED OF THE
 * GAME, TICK BY SAMPLED TICK (U7's `probe-seedling-u7-puncher-mobiles.mjs`, one class over).
 *
 * An expectation carries the PLAYER, so a chaser is visible to the differential only through what it does to the
 * player — the sword's knockback, a contact. The chase moves nothing of the player's until the blade lands, so the
 * per-tick claim "the model walks this body where the game walks it" needs the body itself. `botMobiles()` returns
 * the game's live entity rows; this samples it as fast as the page answers while a tape replays, and compares every
 * sampled BobSoldier row (position, velocity, `hits`, `hits_timer`, presence) against the model's chaser state at the
 * SAME tick.
 *
 * ⚠ THE SWORD'S ANGLE IS NOT READABLE: `botMobiles` reports no `swordSpin`, so the spin's phase is witnessed only
 * through what it does — the tick each blade crossing knocks the player (the tape's own differential) — and the
 * model's readout (`run.chasers[].swordSpin`) is printed beside the game's row for a reader.
 *
 * ⚠ THE SAMPLE'S TICK IS CALIBRATED, NOT ASSUMED: the PLAYER's x/y at each sample is matched against the model's, and
 * exactly one shift (zero) must fit every in-tape sample before a single body number is read.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-bobsoldier-mobiles.mjs --tape=bobsoldier-sword
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
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const TAPE = arg('tape');
    if (!TAPE) {
        console.error('probe-seedling-bobsoldier-mobiles: --tape=<fixture name> is required');
        process.exit(2);
    }
    const OUT = arg('out');
    const UPTO = arg('upto') === null ? Infinity : Number(arg('upto'));

    takeBoxLockOrExit({ name: 'probe-seedling-bobsoldier-mobiles.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
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
            const ch = run ? run.entities('chasers') : [];
            col[o.t] = {
                px: o.x, py: o.y,
                bodies: ch.map((c) => ({ id: c.id, x: c.x, y: c.y, vx: c.vx, vy: c.vy, hits: c.hits, hitsTimer: c.hitsTimer,
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
    const bodiesOf = (f) => rowsOf(f).filter((r) => /BobSoldier$/.test(r.cls));
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
        const model = col[t].bodies.filter((b) => b.id.startsWith('bobsoldier@'));
        if (game.length !== model.length) {
            disagreements.push(`t ${t}: game has ${game.length} BobSoldier row(s), the model ${model.length}`);
            continue;
        }
        for (let i = 0; i < game.length; i += 1) {
            // the census id names the PLACEMENT; join by nearest (one BobSoldier per room here)
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
    console.log(`${agree ? 'PASS' : 'FAIL'}: the BobSoldier's position, velocity, hits and hits_timer are the model's at every sampled tick, and it exists exactly when the model's does`
        + `${Number.isFinite(UPTO) ? ` <= ${UPTO}` : ''} — ${compared} comparison(s), worst |Δ| ${worst}`);
    for (const d of disagreements.slice(0, 12)) console.log(`      ${d}`);
    if (disagreements.length > 12) console.log(`      … ${disagreements.length - 12} more`);
    if (OUT) {
        writeFileSync(OUT, `${JSON.stringify({ tape: TAPE, page: PAGE_NAME, calibrated, fits, compared, worst, disagreements, rows }, null, 1)}\n`);
        console.log(`wrote ${OUT}`);
    }
    process.exit(calibrated && agree ? 0 : 1);
}
