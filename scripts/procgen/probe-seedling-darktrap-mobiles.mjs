#!/usr/bin/env node
/**
 * probe-seedling-darktrap-mobiles — ⛓⛓⛓ seedling-fidelity-staticladder D2: A DARKTRAP'S LIGHT DEATH, ASKED OF THE
 * GAME TICK BY SAMPLED TICK (WALLFLYER's `probe-seedling-wallflyer-mobiles.mjs`, one class over).
 *
 * `DarkTrap.update` starts dying the tick a lit `LightPole`'s light reaches it, skips `super.update()` from then on
 * (no `hitPlayer`), counts 30, plays "die1" and is removed by its `endAnim` (`enemyDamage.DARKTRAP_LIGHT_DEATH`).
 * The game's `botMobiles()` reports every `Mobile`, the DarkTrap included (`anim`, `anim_index`, presence); this
 * compares, at the SAME tick and in the boot level, the model's `run.darkTraps` (`levelRun.darkTrapsNow`, the
 * `CONTACT_FIDELITY.darkTrapLight` switch ON for the model run) against the game's rows:
 *   · PRESENCE — a model body that is `removed` must have no game row, and the reverse;
 *   · "die1" — playing in the game ⇔ the model's anim is on and the body not removed; and its frame index;
 *   · the PLAYER — the sample clock is calibrated on the player's x/y, which also witnesses the harmlessness: a
 *     dying darktrap the model walks through without a hit and the game hits would move the player.
 * `startDying` itself is not a game field; it is witnessed as "die1"'s first tick minus `deathCounter`.
 *
 * ⚠ ONE ROOM: bodies are joined by their placement within the boot level; samples after the first transition are
 * not compared.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-darktrap-mobiles.mjs --file=<tape.json>   e.g. a survey `views/step-<n>-walk.json`
 *   … --tape=<fixture name>   a committed tape
 *   … --out=<file.json>       write every sample with both readings
 *   … --record --name=<name>  write the TAPE and the GAME's DarkTrap samples to `fixtures/darktrap-witness/<name>.json`,
 *                             which `fidelityDarkTrap.test.js` replays against the model in node — only on a PASS.
 *                             ⚠ The tape is EMBEDDED, not added to `fixtures/tapes`: the roster replays every tape
 *                             under the DEFAULT model, and `darkTrapLight` ships OFF (a walk through a dying darktrap
 *                             is a hit there).
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

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const TAPE = arg('tape');
    const FILE = arg('file');
    if (!TAPE === !FILE) {
        console.error('probe-seedling-darktrap-mobiles: exactly one of --tape=<fixture name> or --file=<path> is required');
        process.exit(2);
    }
    const OUT = arg('out');
    const RECORD = process.argv.includes('--record');
    const NAME = arg('name') ?? TAPE;
    if (RECORD && !NAME) {
        console.error('probe-seedling-darktrap-mobiles: --record needs --name=<witness name> (or --tape=<fixture name>)');
        process.exit(2);
    }

    takeBoxLockOrExit({ name: 'probe-seedling-darktrap-mobiles.mjs', kind: 'browser' });

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
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));

    const tape = TAPE ? loadTape(TAPE) : parseTape(readFileSync(FILE, 'utf8'));
    const LABEL = TAPE ?? FILE;

    // ── the MODEL, the switch ON: the darktraps after each tick (index 0 = boot) ──
    const col = [];
    withContactFidelity({ darkTrapLight: true }, () => {
        let run = null;
        const st = createTapeStepper(tape, {
            levelSource: atlasLevelSource(),
            onTick: (t, s, h, rn) => { run = rn; },
        });
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            col[o.t] = {
                px: o.x, py: o.y, level: run ? run.level : tape.boot.level,
                bodies: (run?.darkTraps ?? []).map((b) => ({ id: b.id, x: b.x, y: b.y, startDying: b.startDying,
                    dyingAt: b.dyingAt, deathCounter: b.deathCounter, dying: b.dying, dieIndex: b.dieIndex,
                    removed: b.removed, removedAt: b.removedAt })),
            };
            r = st.next();
        }
    });

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
            frames.push({ status: { tick: s.tick, level: s.level, finished: s.finished, hits: s.hits ?? null }, mobiles: m });
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
    const bodiesOf = (f) => rowsOf(f).filter((r) => /DarkTrap$/.test(r.cls));
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
    let compared = 0;
    const rows = [];
    const disagreements = [];
    const game = new Map();
    const model = new Map();
    const firstAt = (m, id, k, t) => {
        if (!m.has(id)) m.set(id, {});
        if (m.get(id)[k] === undefined) m.get(id)[k] = t;
    };
    const inBoot = (f) => col[tickOf(f)].level === bootLevel && f.status.level === bootLevel;
    for (const f of samples) {
        if (!inBoot(f)) continue;
        const t = tickOf(f);
        const gs = bodiesOf(f);
        const live = col[t].bodies.filter((b) => !b.removed);
        for (const b of col[t].bodies) {
            if (b.startDying) firstAt(model, b.id, 'startDying', b.dyingAt);
            if (b.dying && !b.removed) firstAt(model, b.id, 'die1', t);
            if (b.removed) firstAt(model, b.id, 'removed', b.removedAt);
        }
        if (gs.length !== live.length) {
            disagreements.push(`t ${t}: game has ${gs.length} DarkTrap row(s), the model ${live.length} live`);
        }
        for (const g of gs) {
            // A static body: the join is its constructed point (`.oel` + 8), which never moves.
            const b = live.find((m) => Math.abs(m.x - g.x) < 1e-9 && Math.abs(m.y - g.y) < 1e-9);
            if (!b) {
                disagreements.push(`t ${t}: the game's DarkTrap at (${g.x}, ${g.y}) has no live model body there`);
                continue;
            }
            compared += 1;
            const gameDying = g.anim === 'die1';
            if (gameDying) firstAt(game, b.id, 'die1', t);
            rows.push({ t, id: b.id, game: { x: g.x, y: g.y, anim: g.anim, anim_index: g.anim_index, destroy: g.destroy },
                model: b });
            if (gameDying !== b.dying) {
                disagreements.push(`t ${t} ${b.id}: game anim "${g.anim}" model "die1" ${b.dying}`);
            } else if (gameDying && g.anim_index !== b.dieIndex) {
                disagreements.push(`t ${t} ${b.id}: game die1 index ${g.anim_index} model ${b.dieIndex}`);
            }
        }
    }
    {
        let prev = null;
        for (const f of samples) {
            if (!inBoot(f)) continue;
            const t = tickOf(f);
            const n = bodiesOf(f).length;
            if (prev !== null && n < prev.n) {
                console.log(`      the game's DarkTrap count falls ${prev.n} → ${n} between sampled t ${prev.t} and t ${t}`);
                for (const b of col[prev.t].bodies) {
                    if (!b.removed && !bodiesOf(f).some((g) => Math.abs(g.x - b.x) < 1e-9 && Math.abs(g.y - b.y) < 1e-9)) {
                        firstAt(game, b.id, 'removedBy', t);
                    }
                }
            }
            prev = { t, n };
        }
    }
    const agree = compared > 0 && disagreements.length === 0;
    console.log(`${agree ? 'PASS' : 'FAIL'}: every DarkTrap's "die1" anim and index and PRESENCE are the model's at every `
        + `sampled tick in L${bootLevel} — ${compared} comparison(s)`);
    for (const d of disagreements.slice(0, 16)) console.log(`      ${d}`);
    if (disagreements.length > 16) console.log(`      … ${disagreements.length - 16} more`);
    for (const id of new Set([...model.keys(), ...game.keys()])) {
        const m = model.get(id) ?? {};
        const g = game.get(id) ?? {};
        console.log(`      DEATH ${id}: model startDying t${m.startDying} die1 t${m.die1} removed t${m.removed} · `
            + `game die1 t${g.die1} removed by t${g.removedBy}`);
    }
    console.log(`      game status at the end: hits ${status.hits ?? '?'}, level ${status.level}, tick ${status.tick}`);
    if (OUT) {
        writeFileSync(OUT, `${JSON.stringify({ tape: LABEL, page: PAGE_NAME, calibrated, fits, compared, disagreements,
            death: { model: Object.fromEntries(model), game: Object.fromEntries(game) }, rows }, null, 1)}\n`);
        console.log(`wrote ${OUT}`);
    }
    if (RECORD) {
        if (!(calibrated && agree)) {
            console.log('NOT RECORDED: the run did not pass — a witness the model disagrees with is not a fixture');
        } else {
            const dir = join(MODULE, 'fixtures', 'darktrap-witness');
            mkdirSync(dir, { recursive: true });
            const out = {
                name: NAME,
                source: LABEL,
                page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-darktrap-mobiles.mjs --record',
                note: 'the GAME\'s DarkTrap rows (`botMobiles()`) at each sampled tick of the boot level, in row order',
                samples: samples.filter(inBoot).map((f) => ({
                    t: tickOf(f),
                    player: { x: playerOf(f).x, y: playerOf(f).y },
                    bodies: bodiesOf(f).map((g) => ({ x: g.x, y: g.y, anim: g.anim, anim_index: g.anim_index })),
                })),
                // The tape as written (a `--file`), re-parsed by the test; a `--tape` fixture is named by `source`.
                tape: FILE ? JSON.parse(readFileSync(FILE, 'utf8')) : null,
            };
            const path = join(dir, `${NAME}.json`);
            writeFileSync(path, `${JSON.stringify(out, null, 1)}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${out.samples.length} sampled tick(s)`);
        }
    }
    process.exit(calibrated && agree ? 0 : 1);
}
