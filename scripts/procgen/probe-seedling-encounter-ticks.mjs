#!/usr/bin/env node
/**
 * probe-seedling-encounter-ticks — ⛓⛓ seedling-fidelity-encounters2: AN ENCOUNTER, ASKED OF THE GAME TICK BY SAMPLED
 * TICK (the BobSoldier probe's harness, `probe-seedling-bobsoldier-mobiles.mjs`, pointed at the two encounters).
 *
 * An expectation carries the PLAYER's x/y per tick and the item properties only at the END. Two encounter questions
 * live between those: WHICH tick the Bob Boss arena moves the player (a knockback, a transition teleport, the rock's
 * snap), and WHICH tick `DarkSword.removed()` sets `hasDarkSword`. This replays a tape on the game, samples
 * `botMobiles()` + `botStatus()` as fast as the page answers, and prints, per sampled tick, beside the model's
 * readings at the SAME tick:
 *   the player   x / y / vx / vy                    (game `Player` row; model `run.state`)
 *   the boss     every `BobBoss*` row (x, y, v, anim) (game) / `run.entities('bobBoss')` (model)
 *   the items    `hasFire`, `hasDarkSword`            (game `botStatus().items`; model `run.inventory`)
 *
 * ⚠ THE SAMPLE'S TICK IS CALIBRATED, NOT ASSUMED: the player's x/y at each sample is matched against the model's, and
 * the shifts that fit every sampled tick are printed (exactly [0] = the two clocks are one).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-encounter-ticks.mjs --tape=enc-l12-witch [--from=80] [--to=120] [--out=<json>]
 *   node scripts/procgen/probe-seedling-encounter-ticks.mjs --tape-file=<path.json> …   (an uncommitted tape)
 *   … --tail=<frames>   keep sampling this many extra page answers after `finished` (what the game does AFTER
 *                       the tape's last tick, with no keys: a removal that lands later shows here)
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
    const TAPE_FILE = arg('tape-file');
    if (!TAPE && !TAPE_FILE) {
        console.error('probe-seedling-encounter-ticks: --tape=<fixture name> or --tape-file=<path> is required');
        process.exit(2);
    }
    const OUT = arg('out');
    const FROM = arg('from') === null ? 0 : Number(arg('from'));
    const TO = arg('to') === null ? Infinity : Number(arg('to'));
    const TAIL = arg('tail') === null ? 0 : Number(arg('tail'));
    // ⛓ `--hold-at=<tick>[,<ms>]`: the page's item-delivery freeze, reproduced — the first time the game reports
    // `tick >= <tick>`, `botHold("on")`, wait <ms> (default 300), `botHold("off")` (`freezeAndDeliver`'s shape).
    // A third number <n> holds on the n-th page answer at that tick instead of the first (a tick spans several
    // frames when dead frames precede its observation); `--hold-live` holds only once `readState().freezeObjects`
    // reads false (the page's own pre-check).
    const HOLD = arg('hold-at') === null ? null : arg('hold-at').split(',').map(Number);
    const holds = [];
    const HOLD_LIVE = process.argv.includes('--hold-live');
    // ⛓ `--write-at=<tick>,<property>,<true|false>`: the PANEL ADAPTER's item write, reproduced — BridgeGeneric is
    // configured as `flashBridgeAdapter.configureBridge` does (games/seedling.json's classes / state_properties /
    // path_reads), and the first time the game reports `tick >= <tick>` the write `{class, property, value}` is
    // queued for its next `getItemQueue` poll (`_itemWritesFor`'s clearing write is `value: false`).
    // `--configure` alone configures the bridge with no write (the control).
    const WRITE = arg('write-at') === null ? null : (() => {
        const [t, property, v] = arg('write-at').split(',');
        return { t: Number(t), property, value: v === 'true' };
    })();
    const CONFIGURE = WRITE !== null || process.argv.includes('--configure');
    const writes = [];
    const HOLD_BLOCK = process.argv.includes('--hold-block');
    let holdSeen = 0;

    takeBoxLockOrExit({ name: 'probe-seedling-encounter-ticks.mjs', kind: 'browser' });

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

    const tape = TAPE_FILE ? JSON.parse(readFileSync(TAPE_FILE, 'utf8')) : loadTape(TAPE);
    const name = TAPE ?? tape.name;

    // ── the MODEL: the run's readings after each tick (index = the observation's t) ──
    const col = [];
    let modelRun = null;
    {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            const bb = run ? run.entities('bobBoss') : new Map();
            const inv = run ? run.inventory : {};
            col[o.t] = {
                px: o.x, py: o.y, vx: run?.state?.vx ?? null, vy: run?.state?.vy ?? null,
                boss: bb.get('boss') ?? null, rock: bb.get('rock') ?? null, pending: bb.get('pending') ?? null,
                fire: bb.get('fire') ?? null, dialogue: bb.get('dialogue') ?? null,
                hasFire: inv?.hasFire === true, hasDarkSword: inv?.hasDarkSword === true,
                // every boolean item property, for the flip table (a placed pickup's flag as well as the two above)
                items: Object.fromEntries(Object.entries(inv ?? {}).filter(([, v]) => typeof v === 'boolean')),
            };
            r = st.next();
        }
        modelRun = run;
    }

    // ── the GAME ────────────────────────────────────────────────────────────
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const frames = [];
    /** the game's OWN observation stream (`botDrain`): the authoritative per-tick x/y, every tick */
    const obs = [];
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
        const bot = (n, a) => page.evaluate(([nm, x]) => {
            const g = window.__swfBridge.game;
            return String(x === undefined ? g[nm]() : g[nm](x));
        }, [n, a]);
        if (CONFIGURE) {
            const cfg = JSON.parse(readFileSync(join(REPO, 'frontend', 'modules', 'flashPanel', 'games', 'seedling.json'), 'utf8'));
            const r = await page.evaluate((c) => String(window.__swfBridge.game.configure(JSON.stringify(c))),
                { classes: cfg.classes, state_properties: cfg.state_properties, path_reads: cfg.path_reads });
            if (r !== 'ok') throw new Error(`configure: ${r}`);
            if (WRITE) {
                const def = cfg.state_properties.find((p) => p.property === WRITE.property);
                if (!def) throw new Error(`--write-at: games/seedling.json declares no state property ${WRITE.property}`);
                WRITE.cls = def.class;
            }
        }
        const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        const started = await bot('botStart');
        if (started !== 'ok') throw new Error(`botStart: ${started}`);
        const deadline = Date.now() + 900000;
        let after = -1;
        for (let i = 0; Date.now() < deadline; i += 1) {
            const raw = await page.evaluate(() => {
                const g = window.__swfBridge.game;
                return [String(g.botMobiles()), String(g.botStatus()), String(g.botDrain())];
            });
            const m = JSON.parse(raw[0]);
            const s = JSON.parse(raw[1]);
            for (const o of JSON.parse(raw[2]).ticks ?? []) obs.push(o);
            frames.push({ i, tick: m.tick ?? s.tick, finished: !!s.finished, level: s.level, items: s.items ?? {},
                frozen: s.frozen ?? null, held: s.held ?? null, mobiles: m.mobiles ?? [] });
            if (WRITE && writes.length === 0 && Number.isInteger(s.tick) && s.tick >= WRITE.t && !s.finished) {
                const w = { 'class': WRITE.cls, property: WRITE.property, value: WRITE.value };
                await page.evaluate((x) => window.__swfBridge.queueItems(x), w);
                writes.push({ ...w, queuedAt: s.tick });
                console.log(`INFO: queued the adapter's write ${JSON.stringify(w)} at tick ${s.tick}`);
            }
            if (HOLD && Number.isInteger(s.tick) && s.tick >= HOLD[0]) holdSeen += 1;
            if (HOLD && holds.length === 0 && Number.isInteger(s.tick) && s.tick >= HOLD[0] && !s.finished
                && holdSeen >= (HOLD[2] ?? 1)
                && !(HOLD_LIVE && await page.evaluate(() => JSON.parse(String(window.__swfBridge.game.readState?.() ?? '{}')).freezeObjects === true))) {
                // ⛓ `--hold-block`: the page's refusal is computed SYNCHRONOUSLY while the game is held
                // (`freezeAndDeliver`: on → status → drain → `deliveryRefusal` → off, ONE JS turn), so the main
                // thread is busy, no frame runs, and the release comes in the same turn. Without it: on, an async
                // wait (frames keep running, frozen), off.
                const { on, off } = await page.evaluate(async ([ms, block]) => {
                    const g = window.__swfBridge.game;
                    const one = () => JSON.parse(String(g.botStatus()));
                    const r = String(g.botHold('on'));
                    const st = one();
                    const a = { r, tick: st.tick, frozen: st.frozen, x: st.x, y: st.y };
                    if (block) {
                        const t0 = performance.now();
                        while (performance.now() - t0 < ms) { /* the model's replay, stood in for */ }
                        a.blockedMs = Math.round(performance.now() - t0);
                    } else await new Promise((res) => setTimeout(res, ms));
                    const st2 = one();
                    return { on: a, off: { r: String(g.botHold('off')), tick: st2.tick, frozen: st2.frozen } };
                }, [HOLD[1] ?? 300, HOLD_BLOCK]);
                holds.push({ on, off });
                console.log(`INFO: botHold at ${JSON.stringify(on)} … ${JSON.stringify(off)}`);
            }
            if (s.finished && after < 0) { status = s; after = 0; }
            if (after >= 0 && (after += 1) > TAIL) break;
        }
    } finally {
        await browser.close();
    }
    if (!status) {
        console.log('FAIL: the tape never finished inside the deadline');
        process.exit(1);
    }

    // ── the JOIN ────────────────────────────────────────────────────────────
    const playerOf = (f) => f.mobiles.find((r) => /Player$/.test(r.cls));
    const bossesOf = (f) => f.mobiles.filter((r) => /BobBoss/.test(r.cls));
    const byTick = new Map();
    for (const f of frames) {
        if (!Number.isInteger(f.tick) || !col[f.tick] || !playerOf(f) || f.finished) continue;
        if (!byTick.has(f.tick)) byTick.set(f.tick, f);
    }
    const samples = [...byTick.values()];
    const fits = [];
    for (let shift = -3; shift <= 3; shift += 1) {
        if (samples.every((f) => {
            const m = col[f.tick + shift];
            const p = playerOf(f);
            return m && Math.abs(m.px - p.x) < 1e-9 && Math.abs(m.py - p.y) < 1e-9;
        })) fits.push(shift);
    }
    console.log(`INFO: ${name}: ${frames.length} page answers, ${samples.length} sampled tick(s) of ${tape.tick_count}; `
        + `shifts that fit every player x/y: [${fits.join(', ')}]`);
    const r3 = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
    const rows = [];
    let firstOff = null;
    const flips = { game: {}, model: {} };
    let prevG = null;
    let prevM = null;
    for (const f of samples) {
        const m = col[f.tick];
        const p = playerOf(f);
        const g = { hasFire: f.items.hasFire === true, hasDarkSword: f.items.hasDarkSword === true };
        const gi = Object.fromEntries(Object.entries(f.items).filter(([, v]) => typeof v === 'boolean'));
        for (const k of Object.keys(m.items)) {
            if (!(k in gi)) continue;
            if (prevG && prevG[k] !== gi[k]) flips.game[k] = [...(flips.game[k] ?? []), f.tick];
            if (prevM && prevM[k] !== m.items[k]) flips.model[k] = [...(flips.model[k] ?? []), f.tick];
        }
        prevG = gi;
        prevM = m.items;
        const off = Math.abs(m.px - p.x) > 1e-9 || Math.abs(m.py - p.y) > 1e-9;
        if (off && firstOff === null) firstOff = f.tick;
        const row = {
            t: f.tick, off,
            game: { x: p.x, y: p.y, vx: p.vx, vy: p.vy, ...g, frozen: f.frozen,
                bosses: bossesOf(f).map((b) => ({ cls: b.cls.split('::').pop(), x: b.x, y: b.y, vx: b.vx, vy: b.vy,
                    anim: b.anim ?? null, enemy: b.enemy ?? null })) },
            model: { x: m.px, y: m.py, vx: m.vx, vy: m.vy, hasFire: m.hasFire, hasDarkSword: m.hasDarkSword,
                boss: m.boss && { form: m.boss.form, x: m.boss.x, y: m.boss.y, vx: m.boss.vx, vy: m.boss.vy,
                    hits: m.boss.hits, hitsTimer: m.boss.hitsTimer, formingTimer: m.boss.formingTimer,
                    nextBossTimer: m.boss.nextBossTimer, destroy: m.boss.destroy },
                rock: m.rock, pending: m.pending, fire: m.fire, dialogue: m.dialogue },
        };
        rows.push(row);
        if (f.tick >= FROM && f.tick <= TO) {
            const gb = row.game.bosses.map((b) => `${b.cls}(${r3(b.x)},${r3(b.y)} v${r3(b.vx)},${r3(b.vy)})`).join(' ');
            const mb = row.model.boss ? `f${row.model.boss.form}(${r3(row.model.boss.x)},${r3(row.model.boss.y)} `
                + `v${r3(row.model.boss.vx)},${r3(row.model.boss.vy)} h${row.model.boss.hits}/${row.model.boss.hitsTimer})` : '-';
            console.log(`t${f.tick}${off ? ' ⛔' : '  '} G p(${r3(p.x)},${r3(p.y)} v${r3(p.vx)},${r3(p.vy)}) `
                + `F${+g.hasFire}D${+g.hasDarkSword} ${gb || '-'} | M p(${r3(m.px)},${r3(m.py)} v${r3(m.vx)},${r3(m.vy)}) `
                + `F${+m.hasFire}D${+m.hasDarkSword} ${mb}${m.pending ? ` pend${JSON.stringify(m.pending)}` : ''}`);
        }
    }
    // after `finished`: what the game did with no tape (the tail)
    const tail = frames.filter((f) => f.finished).map((f) => ({ tick: f.tick, level: f.level,
        hasFire: f.items.hasFire === true, hasDarkSword: f.items.hasDarkSword === true,
        player: playerOf(f) && { x: playerOf(f).x, y: playerOf(f).y } }));
    // ⛓ the authoritative compare: the game's drained observation stream against the model's, every tick
    let streamOff = null;
    let streamWorst = 0;
    for (const o of obs) {
        const m = col[o.t];
        if (!m) continue;
        const d = Math.max(Math.abs(m.px - o.x), Math.abs(m.py - o.y));
        streamWorst = Math.max(streamWorst, d);
        if (d > 1e-9 && streamOff === null) streamOff = { t: o.t, game: { x: o.x, y: o.y }, model: { x: m.px, y: m.py } };
    }
    console.log(`INFO: the drained stream: ${obs.length} obs, worst |Δ| ${streamWorst}, first off ${JSON.stringify(streamOff)}`);
    console.log(`INFO: first SAMPLED tick off the model (a sample may straddle a frozen frame): ${firstOff ?? 'none'}`);
    console.log(`INFO: item flips (sampled ticks) — game ${JSON.stringify(flips.game)}, model ${JSON.stringify(flips.model)}`);
    console.log(`INFO: at finished — game hasFire ${status.items?.hasFire} hasDarkSword ${status.items?.hasDarkSword}; `
        + `model hasFire ${modelRun?.inventory?.hasFire} hasDarkSword ${modelRun?.inventory?.hasDarkSword}`);
    if (TAIL > 0) {
        const last = tail.at(-1);
        console.log(`INFO: tail (${tail.length} answers after finished): last ${JSON.stringify(last)}; `
            + `hasDarkSword turned true at answer ${tail.findIndex((r) => r.hasDarkSword)}, hasFire at ${tail.findIndex((r) => r.hasFire)}`);
    }
    if (OUT) {
        writeFileSync(OUT, `${JSON.stringify({ tape: name, page: PAGE_NAME, fits, firstOff, streamOff, streamWorst, flips, rows, tail, obs }, null, 1)}\n`);
        console.log(`wrote ${OUT}`);
    }
    process.exit(obs.length > 0 && streamOff === null ? 0 : 1);
}
