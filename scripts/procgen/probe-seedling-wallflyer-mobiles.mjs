#!/usr/bin/env node
/**
 * probe-seedling-wallflyer-mobiles — ⛓⛓⛓ seedling-fidelity-wallflyer: THE WALLFLYER'S OWN BODY, AND ITS DEATH, ASKED
 * OF THE GAME TICK BY SAMPLED TICK (BOBSOLDIER's `probe-seedling-bobsoldier-mobiles.mjs`, one class over).
 *
 * An expectation carries the PLAYER, so a wallflyer is visible to the differential only through what it does to the
 * player — a contact. Its death touches the player not at all: the "die" anim, `endAnim`'s `destroy`, `Mobile.death`'s
 * alpha and the removal (`classCount(WallFlyer)` moving) are all body state. `botMobiles()` reports every one of them
 * (`anim`, `anim_index`, `destroy`, `alpha`, `enemy.hits`/`hits_timer`) and this compares them, with the position and
 * the velocity, against the model's `run.wallFlyers.bodies` at the SAME tick — and the body's PRESENCE: a model body
 * that is `removed` must have no game row, and the reverse.
 *
 * It also prints the death's three ticks on both sides — the first tick the body's anim reads "die" (the kill), the
 * first tick it reads `destroy` (`endAnim`), the first tick it is gone (the removal) — which is the D3 witness.
 *
 * ⚠ THE SAMPLE'S TICK IS CALIBRATED, NOT ASSUMED: the PLAYER's x/y at each sample is matched against the model's, and
 * exactly one shift (zero) must fit every in-tape sample before a single body number is read.
 * ⚠ ONE ROOM: the bodies are joined by their placement id within the boot level; a tape that changes level is
 * compared up to its first transition (the rest is printed as `left`).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-wallflyer-mobiles.mjs --tape=wallflyer-kill
 *   … --file=<path.json>   a tape that is not a fixture (e.g. a survey `views/step-<n>-walk.json`)
 *   … --out=<file.json>    write every sample with both readings
 *   … --record             (with --tape) write the GAME's samples to `fixtures/wallflyer-witness/<tape>.json`, which
 *                          `fidelityWallFlyer.test.js` replays against the model in node — only when this run PASSES
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
        console.error('probe-seedling-wallflyer-mobiles: exactly one of --tape=<fixture name> or --file=<path> is required');
        process.exit(2);
    }
    const OUT = arg('out');
    const RECORD = process.argv.includes('--record');
    if (RECORD && !TAPE) {
        console.error('probe-seedling-wallflyer-mobiles: --record needs --tape=<fixture name>');
        process.exit(2);
    }

    takeBoxLockOrExit({ name: 'probe-seedling-wallflyer-mobiles.mjs', kind: 'browser' });

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
    const LABEL = TAPE ?? FILE;

    // ── the MODEL: the run's wallflyer state after each tick (index 0 = boot) ──
    const col = [];
    let modelEvents = [];
    {
        let run = null;
        const st = createTapeStepper(tape, {
            levelSource: atlasLevelSource(),
            onTick: (t, s, h, rn) => { run = rn; },
        });
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            const wf = run ? run.wallFlyers : { bodies: [], events: [] };
            col[o.t] = {
                px: o.x, py: o.y, level: run ? run.level : tape.boot.level,
                bodies: wf.bodies.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy, hits: b.hits,
                    hitsTimer: b.hitsTimer, destroy: b.destroy, alpha: b.alpha, removed: b.removed,
                    dying: b.dieAnim !== null, dieIndex: b.dieAnim ? b.dieAnim.index : null })),
            };
            if (run) modelEvents = run.wallFlyers.events;
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
    const bodiesOf = (f) => rowsOf(f).filter((r) => /WallFlyer$/.test(r.cls));
    const inTape = frames.filter((f) => {
        const t = tickOf(f);
        return Number.isInteger(t) && t >= 0 && t <= tape.tick_count && col[t] && playerOf(f);
    });
    const byTick = new Map();
    for (const f of inTape) if (!byTick.has(tickOf(f))) byTick.set(tickOf(f), f);
    const samples = [...byTick.values()].sort((a, b) => tickOf(a) - tickOf(b));

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
    const firstOff = samples.find((f) => {
        const m = col[tickOf(f)];
        const p = playerOf(f);
        return Math.abs(m.px - p.x) >= 1e-9 || Math.abs(m.py - p.y) >= 1e-9;
    });
    if (firstOff) {
        const p = playerOf(firstOff);
        const m = col[tickOf(firstOff)];
        console.log(`      the player first differs at sampled t ${tickOf(firstOff)}: game (${p.x}, ${p.y}) model `
            + `(${m.px}, ${m.py})`);
    }
    console.log(`${calibrated ? 'PASS' : 'FAIL'}: the sample clock is the model's — `
        + `${samples.length} sampled tick(s) inside the tape of ${tape.tick_count}; shifts that fit every player x: `
        + `[${fits.join(', ')}] (must be exactly [0])`);

    const bootLevel = tape.boot.level;
    let worst = 0;
    let compared = 0;
    const rows = [];
    const disagreements = [];
    const gameDeath = new Map();
    const modelDeath = new Map();
    const firstAt = (m, id, k, t) => {
        if (!m.has(id)) m.set(id, {});
        if (m.get(id)[k] === undefined) m.get(id)[k] = t;
    };
    for (const f of samples) {
        const t = tickOf(f);
        if (col[t].level !== bootLevel || f.status.level !== bootLevel) continue;
        const game = bodiesOf(f);
        const live = col[t].bodies.filter((b) => !b.removed);
        for (const b of col[t].bodies) {
            if (b.dying) firstAt(modelDeath, b.id, 'die', t);
            if (b.destroy) firstAt(modelDeath, b.id, 'destroy', t);
            if (b.removed) firstAt(modelDeath, b.id, 'removed', t);
        }
        if (game.length !== live.length) {
            disagreements.push(`t ${t}: game has ${game.length} WallFlyer row(s), the model ${live.length} live`);
        }
        // ⚠ the game's rows carry no placement id, and two flyers on one ray CROSS — so the join is the cheapest
        // ASSIGNMENT over every pairing (≤ 4 bodies a room), costed on position plus a large charge per differing
        // damage field: a nearest-first join swapped L22's two y-120 flyers as they passed.
        const cost = (g, b) => Math.hypot(g.x - b.x, g.y - b.y)
            + (g.enemy && g.enemy.hits !== b.hits ? 1000 : 0) + (g.enemy && g.enemy.hits_timer !== b.hitsTimer ? 1000 : 0);
        const perms = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)])
            .map((p) => [x, ...p])));
        let pairing = [];
        if (game.length > 0 && live.length >= game.length) {
            let best = Infinity;
            for (const p of perms(live)) {
                const c = game.reduce((s, g, i) => s + cost(g, p[i]), 0);
                if (c < best) { best = c; pairing = p.slice(0, game.length); }
            }
        }
        for (let gi = 0; gi < game.length; gi += 1) {
            const g = game[gi];
            const b = pairing[gi];
            if (!b) continue;
            if (g.anim === 'die') firstAt(gameDeath, b.id, 'die', t);
            if (g.destroy) firstAt(gameDeath, b.id, 'destroy', t);
            const d = [g.x - b.x, g.y - b.y, g.vx - b.vx, g.vy - b.vy].map(Math.abs);
            worst = Math.max(worst, ...d);
            compared += 1;
            rows.push({ t, id: b.id, game: { x: g.x, y: g.y, vx: g.vx, vy: g.vy, anim: g.anim, anim_index: g.anim_index,
                destroy: g.destroy, alpha: g.alpha, hits: g.enemy?.hits, hits_timer: g.enemy?.hits_timer }, model: b });
            if (d.some((x) => x > 1e-9)) {
                disagreements.push(`t ${t} ${b.id}: game (${g.x}, ${g.y}) v (${g.vx}, ${g.vy}) model `
                    + `(${b.x}, ${b.y}) v (${b.vx}, ${b.vy})`);
            }
            if (g.enemy && (g.enemy.hits !== b.hits || g.enemy.hits_timer !== b.hitsTimer)) {
                disagreements.push(`t ${t} ${b.id}: game hits ${g.enemy.hits}/${g.enemy.hits_timer} model `
                    + `${b.hits}/${b.hitsTimer}`);
            }
            if (g.destroy !== b.destroy) disagreements.push(`t ${t} ${b.id}: game destroy ${g.destroy} model ${b.destroy}`);
            // ⛓ the "die" anim: playing in the game ⇔ the model's anim is on and `endAnim` has not set `destroy`
            // (`endAnim`'s die arm then plays "" — the model keeps its finished anim object).
            const gameDying = g.anim === 'die';
            const modelDying = b.dying && !b.destroy;
            if (gameDying !== modelDying) {
                disagreements.push(`t ${t} ${b.id}: game anim "${g.anim}" model dying ${modelDying}`);
            } else if (gameDying && g.anim_index !== b.dieIndex) {
                disagreements.push(`t ${t} ${b.id}: game die index ${g.anim_index} model ${b.dieIndex}`);
            }
            if (g.alpha !== null && Math.abs(g.alpha - b.alpha) > 1e-9) {
                disagreements.push(`t ${t} ${b.id}: game alpha ${g.alpha} model ${b.alpha}`);
            }
        }
    }
    // the GAME's removal tick, read directly: the first sampled tick with one row fewer than the tick before
    {
        let prev = null;
        for (const f of samples) {
            const t = tickOf(f);
            if (col[t].level !== bootLevel || f.status.level !== bootLevel) continue;
            const n = bodiesOf(f).length;
            if (prev !== null && n < prev.n) {
                console.log(`      the game's WallFlyer count falls ${prev.n} → ${n} between sampled t ${prev.t} and t ${t}`);
            }
            prev = { t, n };
        }
    }
    const agree = compared > 0 && disagreements.length === 0;
    console.log(`${agree ? 'PASS' : 'FAIL'}: every WallFlyer's position, velocity, hits, hits_timer, "die" anim and `
        + `index, destroy, alpha and PRESENCE are the model's at every sampled tick in L${bootLevel} — ${compared} `
        + `comparison(s), worst |Δ| ${worst}`);
    for (const d of disagreements.slice(0, 16)) console.log(`      ${d}`);
    if (disagreements.length > 16) console.log(`      … ${disagreements.length - 16} more`);
    const ids = [...new Set([...modelDeath.keys(), ...gameDeath.keys()])];
    for (const id of ids) {
        const m = modelDeath.get(id) ?? {};
        const g = gameDeath.get(id) ?? {};
        console.log(`      DEATH ${id}: model die t${m.die} destroy t${m.destroy} removed t${m.removed} · `
            + `game die t${g.die} destroy t${g.destroy}`);
    }
    const kills = modelEvents.filter((e) => e.kind === 'killed' || e.kind === 'removed' || e.kind === 'destroyed');
    console.log(`      model events: ${JSON.stringify(kills.map((e) => `${e.kind}@${e.t} ${e.id}${e.by ? ` by ${e.by}` : ''}`))}`);
    if (OUT) {
        writeFileSync(OUT, `${JSON.stringify({ tape: LABEL, page: PAGE_NAME, calibrated, fits, compared, worst,
            disagreements, death: { model: Object.fromEntries(modelDeath), game: Object.fromEntries(gameDeath) },
            rows }, null, 1)}\n`);
        console.log(`wrote ${OUT}`);
    }
    if (RECORD) {
        if (!(calibrated && agree)) {
            console.log('NOT RECORDED: the run did not pass — a witness the model disagrees with is not a fixture');
        } else {
            const { mkdirSync } = await import('node:fs');
            const dir = join(MODULE, 'fixtures', 'wallflyer-witness');
            mkdirSync(dir, { recursive: true });
            const pick = (g) => ({ x: g.x, y: g.y, vx: g.vx, vy: g.vy, anim: g.anim, anim_index: g.anim_index,
                destroy: g.destroy, alpha: g.alpha, hits: g.enemy?.hits ?? null, hits_timer: g.enemy?.hits_timer ?? null });
            const out = {
                tape: TAPE,
                page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-wallflyer-mobiles.mjs --record',
                note: 'the GAME\'s WallFlyer rows (`botMobiles()`) at each sampled tick of the boot level, in row order',
                samples: samples.filter((f) => col[tickOf(f)].level === bootLevel && f.status.level === bootLevel)
                    .map((f) => ({ t: tickOf(f), bodies: bodiesOf(f).map(pick) })),
            };
            const path = join(dir, `${TAPE}.json`);
            writeFileSync(path, `${JSON.stringify(out, null, 1)}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${out.samples.length} sampled tick(s)`);
        }
    }
    process.exit(calibrated && agree ? 0 : 1);
}
