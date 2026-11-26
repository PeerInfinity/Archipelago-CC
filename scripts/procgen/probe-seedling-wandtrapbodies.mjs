#!/usr/bin/env node
/**
 * probe-seedling-wandtrapbodies — ⛓ SEEDLING FIDELITY WANDTRAPBODIES (wave 67): A WAND SHOT AT A DARKTRAP OR A PLACED
 * GRENADE, ON THE GAME, TICK BY SAMPLED TICK, AGAINST THE MODEL WITH `wandShotTrapBodies` ON.
 *
 * `WandShot.solids` holds "Enemy" (`WandShot.as:69`), and a `DarkTrap` (`SandTrap.as:35` `setHitbox(16,16,8,8)`) and
 * a `Grenade` (`Grenade.as:43-44` `setHitbox(6,6,3,3)`, `type = "Enemy"`) are both `"Enemy"`. A shot that meets one
 * calls its `hit` (both EMPTY overrides) and plays "die". `Entity.collide` skips a body whose `collidable` is false
 * (`net/flashpunk/Entity.as:162`): a grenade writes `collidable = false` on every falling update and `true` on every
 * resting one (`Grenade.as:78,109`); a darktrap never writes it. The game's `botMobiles()` reports every `Mobile` (the
 * shot, the DarkTraps, the Grenade), so each sample is compared at the SAME tick with the model's replay:
 *   · the PLAYER at 0 px (the sample clock's calibration: exactly shift [0]);
 *   · every WandShot: count, (x, y) and anim ("flare" / "die") — the stop point and the stop tick;
 *   · every DarkTrap: presence and "die1" (dying), by its centre;
 *   · every Grenade: presence, (x, y) and anim ("sit" / "explode" / "hit").
 * Only the boot level is compared (each tape stays in it).
 *
 * Each tape (`WAND_TRAP_TAPES`) is played on a FRESH page of the game (p4g, headless logic-only) on the DELIVERED
 * vanilla set (`vanillaRecordSet`, mounted with `botLoadLevels`; the row prints its `set_id`). L63 for the darktraps
 * and the falling/resting grenade, L75 for a DORMANT one (L63's dormant grenade box sits inside `spinningaxe@128,80`'s
 * Solid, where no shot can reach it).
 *
 * Run (a dev server at the repo root):
 *   node scripts/procgen/probe-seedling-wandtrapbodies.mjs [--host=http://localhost:8000] [--only=<name>[,…]] [--record]
 *   --record   write `fixtures/wandtrapbodies-witness/<name>.json` (the tape and the GAME's samples), which
 *              `fidelityWandTrapBodies.test.js` replays against the model — only on a PASS.
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. Takes the box lock (kind `browser`).
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** The Wand and the items a staged visit needs (the wand witnesses' seam, `fixtures/wand-witness`). */
const SEAM = Object.freeze({
    items: {
        hasSword: true, hasGhostSword: false, hasShield: true, hasFire: true, hasWand: true, hasFireWand: false,
        canSwim: false, hasSpear: false, hasDarkShield: false, hasDarkSuit: false, hasDarkSword: false,
        hasFeather: false, hasTorch: true,
    },
    beam: false, rock_set: false, hits_max: 3, first_use: false, extended: false, time: 8586, primary: 0,
    secondary: 0, grass_cut: 0, cutscene: [false, false, false, false], menu_state: 0, music: { set: 'Room', index: 1 },
});
/** Split RNG (exact shakes, `shakeExactSplit`): the grenade's blast shakes the camera. */
const RNG = Object.freeze({ seed: 1356861785, split: true, cosmetic: 0 });

/**
 * The witness tapes. Each: boot, the Wand selected at t0 (slot 2), a one-tick tap to face, ONE press at `press`
 * (the shot is first seen 8 ticks later). The player stands at the boot point + 8.
 *   a-live          L63, facing E at darktrap@64,96 (alive, its pole dark): the shot stops on it, the trap lives on.
 *   b-counter       L63, {63,1} cleared (lightpole@64,88 lit): the trap counts its 30 down — the shot still stops.
 *   b-die1          the same, the shot arriving while "die1" plays — still a body: it stops.
 *   b-removal-edge  arriving on the tick the trap is removed (the shot updates first): it stops.
 *   b-removed       arriving one tick later: no body, the shot flies on to its fizzle.
 *   c-dormant       L75, facing E at the DORMANT grenade@72,168 (48 px above its cell, the player > 32 px away, so
 *                   it never arms): collidable from its ctor (the `Entity` default) — the shot stops on it.
 *   d-fall          L63, standing W of grenade@128,128 (armed at once): the shot crosses its box while it falls
 *                   (`collidable = false`) — it flies through.
 *   d-bounce        the same, crossing on its bounce (still a falling update): through.
 *   d-rest          crossing while it rests (`collidable = true`): it stops.
 *   d-explode       crossing during "explode": it stops.
 *   d-hit           crossing during "hit" (after the blast): it stops.
 *   d-removal-edge  crossing on the tick it is removed (the shot updates first): it stops.
 *   d-removed       crossing one tick later: through.
 */
export const WAND_TRAP_TAPES = Object.freeze({
    'a-live': { boot: { level: 63, x: 24, y: 104 }, face: 'right', press: 4, ticks: 40 },
    'b-counter': { boot: { level: 63, x: 24, y: 104 }, face: 'right', press: 4, ticks: 40, cleared: [1] },
    'b-die1': { boot: { level: 63, x: 24, y: 104 }, face: 'right', press: 34, ticks: 70, cleared: [1] },
    'b-removal-edge': { boot: { level: 63, x: 24, y: 104 }, face: 'right', press: 60, ticks: 100, cleared: [1] },
    'b-removed': { boot: { level: 63, x: 24, y: 104 }, face: 'right', press: 61, ticks: 100, cleared: [1] },
    'c-dormant': { boot: { level: 75, x: 40, y: 120 }, face: 'right', press: 4, ticks: 40 },
    'd-fall': { boot: { level: 63, x: 105, y: 128 }, face: 'right', press: 21, ticks: 60 },
    'd-bounce': { boot: { level: 63, x: 105, y: 128 }, face: 'right', press: 62, ticks: 100 },
    'd-rest': { boot: { level: 63, x: 105, y: 128 }, face: 'right', press: 90, ticks: 130 },
    'd-explode': { boot: { level: 63, x: 105, y: 128 }, face: 'right', press: 130, ticks: 170 },
    'd-hit': { boot: { level: 63, x: 105, y: 128 }, face: 'right', press: 150, ticks: 185 },
    'd-removal-edge': { boot: { level: 63, x: 105, y: 128 }, face: 'right', press: 154, ticks: 185 },
    'd-removed': { boot: { level: 63, x: 105, y: 128 }, face: 'right', press: 155, ticks: 185 },
});

/** The tape for one witness, as `parseTape` takes it. */
export function wandTrapTape(name) {
    const w = WAND_TRAP_TAPES[name];
    if (!w) throw new Error(`wandTrapTape: no witness "${name}"`);
    return {
        game: 'seedling', tape_version: 8, name: `wandtrapbodies-${name}`,
        description: `fidelity WANDTRAPBODIES witness ${name} (probe-seedling-wandtrapbodies.mjs)`,
        boot: { ...w.boot }, noclip: false, noDamage: false, noHazards: [], grants: [],
        persistence: (w.cleared ?? []).map((tag) => ({ level: w.boot.level, tag, note: `wandtrapbodies ${name}` })),
        equips: [{ t: 0, slot: 2 }], pins: ['sound', 'dead_frames'],
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: { ...RNG }, seam: structuredClone(SEAM),
        tick_count: w.ticks,
        inputs: [{ key: w.face, from: 0, to: 1 }, { key: 'primary', from: w.press, to: w.press + 1 }],
    };
}

const near = (a, b) => Math.abs(a - b) < 1e-9;

/**
 * The MODEL's readings, one per tick (index 0 = boot): the player, the live shots, the darktraps (centre, dying,
 * removed) and the placed grenades (point, anim, removed), with `switches` ON (and `WAND_VERB`, as the wand witnesses).
 */
export async function modelWandTrapSamples(tape, switches = { wandShotTrapBodies: true }) {
    const M = (p) => import(join(MODULE, p));
    const { createTapeStepper } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const { withContactFidelity } = await M('contactFidelity.js');
    const { withWandVerb } = await M('wandVerb.js');
    const col = [];
    let error = null;
    withWandVerb(true, () => withContactFidelity(switches, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        try {
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                col[o.t] = {
                    px: o.x, py: o.y, level: run ? run.level : tape.boot.level,
                    shots: (run?.wandShotsLive ?? []).filter((s) => !s.removed).map((s) => ({ x: s.x, y: s.y, anim: s.anim })),
                    traps: (run?.darkTraps ?? []).map((b) => ({ x: b.x, y: b.y, dying: b.dying, removed: b.removed })),
                    grenades: (run?.placedGrenades ?? []).map((g) => ({ x: g.x, y: g.y, anim: g.anim, removed: g.removed })),
                    shotHits: (run?.wandShotHits ?? []).map((h) => ({ id: h.id, arm: h.arm })),
                };
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
    }));
    return { col, error };
}

/** The game's rows of one sample, reduced to what is compared. */
export function gameRowsOf(mobiles) {
    const rows = mobiles?.mobiles ?? [];
    const player = rows.find((r) => /Player$/.test(r.cls));
    return {
        player: player ? { x: player.x, y: player.y } : null,
        shots: rows.filter((r) => /WandShot$/.test(r.cls)).map((r) => ({ x: r.x, y: r.y, anim: r.anim })),
        traps: rows.filter((r) => /DarkTrap$/.test(r.cls)).map((r) => ({ x: r.x, y: r.y, anim: r.anim ?? '' })),
        grenades: rows.filter((r) => /Grenade$/.test(r.cls)).map((r) => ({ x: r.x, y: r.y, anim: r.anim ?? '' })),
    };
}

/**
 * Compare one game sample (`gameRowsOf` + its tick) against the model's reading at that tick. Returns the
 * disagreements, as text. Exported for the unit rows (the same join, in node, against a recording).
 */
export function compareSample(t, g, m) {
    const out = [];
    if (!m) return [`t ${t}: the model has no reading`];
    if (!g.player || !near(g.player.x, m.px) || !near(g.player.y, m.py)) {
        out.push(`t ${t}: player game (${g.player?.x}, ${g.player?.y}) model (${m.px}, ${m.py})`);
    }
    if (g.shots.length !== m.shots.length) out.push(`t ${t}: shots game ${JSON.stringify(g.shots)} model ${JSON.stringify(m.shots)}`);
    for (const s of g.shots) {
        const ms = m.shots.find((x) => near(x.x, s.x) && near(x.y, s.y));
        if (!ms) out.push(`t ${t}: the game's shot at (${s.x}, ${s.y}) "${s.anim}" has no model shot (${JSON.stringify(m.shots)})`);
        else if (ms.anim !== s.anim) out.push(`t ${t}: shot at (${s.x}, ${s.y}) game "${s.anim}" model "${ms.anim}"`);
    }
    const liveTraps = m.traps.filter((b) => !b.removed);
    if (g.traps.length !== liveTraps.length) out.push(`t ${t}: darktraps game ${g.traps.length} model ${liveTraps.length}`);
    for (const b of g.traps) {
        const mb = liveTraps.find((x) => near(x.x, b.x) && near(x.y, b.y));
        if (!mb) out.push(`t ${t}: the game's DarkTrap at (${b.x}, ${b.y}) has no live model trap`);
        else if ((b.anim === 'die1') !== mb.dying) out.push(`t ${t}: DarkTrap (${b.x}, ${b.y}) game "${b.anim}" model dying=${mb.dying}`);
    }
    const liveGrenades = m.grenades.filter((x) => !x.removed);
    // Before the grenade's first update the model has not built its row yet: the game's dormant row is at the ctor's point.
    if (!(m.grenades.length === 0 && g.grenades.length > 0 && t === 0)) {
        if (g.grenades.length !== liveGrenades.length) out.push(`t ${t}: grenades game ${JSON.stringify(g.grenades)} model ${JSON.stringify(liveGrenades)}`);
        for (const x of g.grenades) {
            const mg = liveGrenades.find((y) => near(y.x, x.x) && near(y.y, x.y));
            if (!mg) out.push(`t ${t}: the game's Grenade at (${x.x}, ${x.y}) "${x.anim}" has no model grenade (${JSON.stringify(liveGrenades)})`);
            else if ((mg.anim ?? '') !== x.anim) out.push(`t ${t}: Grenade (${x.x}, ${x.y}) game "${x.anim}" model "${mg.anim}"`);
        }
    }
    return out;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) {
        console.log(`SKIP: no wasm artifact ${PAGE}`);
        process.exit(0);
    }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const RECORD = process.argv.includes('--record');
    const M = (p) => import(join(MODULE, p));
    const { parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const set = vanillaRecordSet(EMBED, MAP).set;
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-wandtrapbodies.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const call = (page, n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[name] !== 'function') return null;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    const waitFor = async (page, what, fn, ms, every = 250) => {
        for (const t0 = Date.now(); ;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(every);
        }
    };
    const play = async (tape) => {
        const page = await browser.newPage();
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            await assertLogicOnlyChannel(page);
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const mounted = JSON.parse(await call(page, 'botLevelSet'));
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const frames = [];
            const status = await waitFor(page, 'the tape to finish', async () => {
                const raw = await page.evaluate(() => {
                    const g = window.__swfBridge.game;
                    return [String(g.botMobiles()), String(g.botStatus())];
                });
                const m = JSON.parse(raw[0]);
                const s = JSON.parse(raw[1]);
                if (s?.error) throw new Error(`botStatus: ${s.error}`);
                frames.push({ t: m.tick ?? s.tick, level: s.level, hits: s.hits ?? null, rows: gameRowsOf(m) });
                return s.finished ? s : null;
            }, 10 * 60 * 1000, 10);
            return { status, mounted, frames };
        } finally {
            await page.close();
        }
    };
    try {
        const only = arg('only', null)?.split(',');
        for (const name of Object.keys(WAND_TRAP_TAPES)) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape(JSON.stringify(wandTrapTape(name)));
            const model = await modelWandTrapSamples(tape);
            const g = await play(tape);
            const byTick = new Map();
            for (const f of g.frames) {
                if (Number.isInteger(f.t) && f.t >= 0 && f.t <= tape.tick_count && f.rows.player && !byTick.has(f.t)) byTick.set(f.t, f);
            }
            // ⚠ The game's tick-0 reading can be the PREVIOUS world's mobiles (read before the boot world is built): skipped.
            const samples = [...byTick.values()].sort((a, b) => a.t - b.t).filter((f) => f.t > 0 && f.level === tape.boot.level);
            const fits = [];
            for (let shift = -3; shift <= 3; shift += 1) {
                if (samples.every((f) => {
                    const m = model.col[f.t + shift];
                    return m && near(m.px, f.rows.player.x) && near(m.py, f.rows.player.y);
                })) fits.push(shift);
            }
            const dis = samples.flatMap((f) => compareSample(f.t, f.rows, model.col[f.t]));
            const shotTicks = samples.filter((f) => f.rows.shots.length > 0).length;
            console.log(`ROW ${JSON.stringify({ name, set_id: set.set_id, mounted: g.mounted?.active, samples: samples.length,
                shotSamples: shotTicks, hits: g.status?.hits ?? null, modelError: model.error,
                modelShotHits: model.col.at(-1)?.shotHits ?? null })}`);
            check(`${name}: the sample clock is the model's (shifts fitting every player x/y: [${fits}], must be [0])`,
                fits.length === 1 && fits[0] === 0 && model.error === null, model.error ?? '');
            check(`${name}: every shot, darktrap and grenade is the model's (wandShotTrapBodies ON) at every sampled tick`,
                dis.length === 0 && shotTicks > 0, dis.slice(0, 8).join(' | '));
            if (RECORD && fits.length === 1 && fits[0] === 0 && dis.length === 0 && model.error === null) {
                const dir = join(MODULE, 'fixtures', 'wandtrapbodies-witness');
                mkdirSync(dir, { recursive: true });
                const out = {
                    name, page: PAGE, delivered_set: set.set_id,
                    recordedBy: 'scripts/procgen/probe-seedling-wandtrapbodies.mjs --record',
                    note: 'the GAME\'s rows (`botMobiles()`: the player, every WandShot, DarkTrap and Grenade) at each sampled tick',
                    hits: g.status?.hits ?? null,
                    samples: samples.map((f) => ({ t: f.t, ...f.rows })),
                    tape: wandTrapTape(name),
                };
                writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(out)}\n`);
                console.log(`recorded fixtures/wandtrapbodies-witness/${name}.json — ${out.samples.length} sample(s)`);
            }
        }
    } catch (e) {
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
