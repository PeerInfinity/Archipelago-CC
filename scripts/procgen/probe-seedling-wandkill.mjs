#!/usr/bin/env node
/**
 * probe-seedling-wandkill — ⛓ SEEDLING FIDELITY WANDKILL (wave 71): THE PLAIN WAND'S KILL, ON THE GAME, TICK BY SAMPLED
 * TICK, AGAINST THE MODEL WITH `wandShotKill` ON (and `wandShotEnemyBodies` beside it, which it requires).
 *
 * The plain wand's `damage` is 0.5 (`WandShot.as:29`) against `hitsMax` 3 (`Enemy.as:22`), so the kill is the SIXTH
 * landed hit, each after the last one's 30 i-frames (`Enemy.hit`, `Enemy.as:141-181`). At `hits >= hitsMax` the
 * class's `startDeath("Wand")` runs inside the SHOT's update (the shot is run-time added and updates first):
 *   · Turret, SandTrap, WallFlyer, Drill — `play("die")` + `dieEffects("Wand")` (`Enemy.as:189-209`), which adds an
 *     `Explosion(x, y, ["Player", "Enemy"], max(width, height), 1)`: its radius ×0.65 into an `int`, a `Rng.cos()`
 *     draw for its sprite ANGLE (cosmetic), and in `added()` — the end-of-tick `updateLists()` — a `hit` on the
 *     player (`Player.hit(null, 4, p, 1)`) and on every Enemy (`Enemy.hit(4, p, 1)`, `t` ""), each asked by the
 *     prefilter square then the origin-to-origin disc (`Explosion.as:45-68`);
 *   · LavaTrap — `play("die")` only (`LavaTrap.as:119-122`): its `update` returns before the tongue from that tick,
 *     and `endAnim` removes it;
 *   · IceTrap — `canHit = false` (`IceTrap.as:32`): never.
 * The game's `botMobiles()` reports every `Mobile` with its `Enemy` fields; each sample is compared with the model's
 * replay at the SAME tick (`probe-seedling-wandenemybodies.mjs`'s join, plus the player's `hits`/`hits_timer` off
 * `botStatus`, a LavaTrap's and a WallFlyer's "die", and the persistence the run cleared at the end).
 *
 * Each tape (`WAND_KILL_TAPES`) is played on a FRESH page of the game (p4g, headless logic-only) on the DELIVERED
 * vanilla set, as wave 68's witnesses are.
 *
 * Run (a dev server at the repo root):
 *   node scripts/procgen/probe-seedling-wandkill.mjs [--host=http://localhost:8000] [--only=<name>[,…]] [--record] [--dump]
 *   --record   write `fixtures/wandkill-witness/<name>.json` (the tape and the GAME's samples), which
 *              `fidelityWandKill.test.js` replays against the model — only on a PASS.
 *   --dump     print the game's per-tick changes (bodies, shots, the player's hits) — a reading aid.
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
import { WAND_ENEMY_CLASSES, gameRowsOf, compareSample } from './probe-seedling-wandenemybodies.mjs';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** The wand witnesses' seam (`probe-seedling-wandenemybodies.mjs`'s). */
const SEAM = Object.freeze({
    items: {
        hasSword: true, hasGhostSword: false, hasShield: true, hasFire: true, hasWand: true, hasFireWand: false,
        canSwim: false, hasSpear: false, hasDarkShield: false, hasDarkSuit: false, hasDarkSword: false,
        hasFeather: false, hasTorch: true,
    },
    beam: false, rock_set: false, hits_max: 3, first_use: false, extended: false, time: 8586, primary: 0,
    secondary: 0, grass_cut: 0, cutscene: [false, false, false, false], menu_state: 0, music: { set: 'Room', index: 1 },
});
/** Split RNG (exact shakes, `shakeExactSplit`). */
const RNG = Object.freeze({ seed: 1356861785, split: true, cosmetic: 0 });

/** Six presses, 32 ticks apart: each shot lands after the last one's 30 i-frames. */
export const SIX = Object.freeze([4, 36, 68, 100, 132, 164]);

/**
 * The witness tapes. `trap`: the room also holds a wave-67 trap body, so `wandShotTrapBodies` is ON beside the keys.
 *   turret-kill        L59, facing E at turret@152,64 (wave 68's `turret-live` stance): six spaced shots — the kill,
 *                      the "die" anim, `destroy`, `Mobile.death`'s fade and the removal; the Explosion at (160, 72),
 *                      r 10 (the player 40 px away: outside it).
 *   turret-kill-l65    L65, facing E at turret@64,112 — the walk's room (`turret-l65`'s stance).
 *   sandtrap-kill      L16, facing W at sandtrap@48,32 (`sandtrap-live`'s stance): the kill, "die", the removal and
 *                      the tag `removed()` writes; `sandtrap@32,32` 16 px W is in the prefilter square and outside
 *                      the disc.
 *   sandtrap-kill-l36  L36, facing N at sandtrap@64,80 (`sandtrap-l36`'s stance): THREE neighbours' boxes in the
 *                      square (@48,80, @80,80, @64,64), every origin 16 px off: the disc decides, and none is hit.
 *   lavatrap-kill      L108, facing N at lavatrap@128,176 (40 px: outside its 32 px tongue): "die" and the removal,
 *                      no Explosion. (L78's `lavatrap-live` stance is crossed by a lavarunner before the sixth shot,
 *                      and L80's likewise: the runner is not a body a wand shot is modelled on.)
 *   icetrap-six        L46, facing W at icetrap@168,328: six shots, nothing (`canHit = false`). (L53's jellyfish
 *                      kill the player at `icetrap-live`'s stance before the fourth.)
 *   drill-kill         L88, facing E at the sitting drill@128,160 from 59 px (`drill-sit`'s stance): the kill.
 *   wallflyer-kill     L27, above wallflyer@192,48 facing S (off its trigger ray: it never launches): the kill. The
 *                      player never moves here, so the shots' flight is what pins the sample clock.
 *   wallflyer-kill-l22 L22, above wallflyer@128,80 facing S: the kill.
 */
export const WAND_KILL_TAPES = Object.freeze({
    'turret-kill': { boot: { level: 59, x: 120, y: 64 }, face: 'right', presses: SIX, ticks: 230, trap: true },
    'turret-kill-l65': { boot: { level: 65, x: 32, y: 112 }, face: 'right', presses: SIX, ticks: 230, trap: true },
    'sandtrap-kill': { boot: { level: 16, x: 80, y: 32 }, face: 'left', presses: SIX, ticks: 230 },
    'sandtrap-kill-l36': { boot: { level: 36, x: 64, y: 112 }, face: 'up', presses: SIX, ticks: 230 },
    'lavatrap-kill': { boot: { level: 108, x: 128, y: 216 }, face: 'up', presses: SIX, ticks: 230 },
    'icetrap-six': { boot: { level: 46, x: 208, y: 328 }, face: 'left', presses: SIX, ticks: 200 },
    'drill-kill': { boot: { level: 88, x: 68, y: 160 }, face: 'right', presses: SIX, ticks: 230 },
    'wallflyer-kill': { boot: { level: 27, x: 192, y: 16 }, face: 'down', presses: SIX, ticks: 230 },
    'wallflyer-kill-l22': { boot: { level: 22, x: 128, y: 40 }, face: 'down', presses: SIX, ticks: 230 },
});

/** The switches a witness runs the model under: both wand keys, and `wandShotTrapBodies` where the room needs it. */
export function wandKillSwitches(name, extra = {}) {
    const w = WAND_KILL_TAPES[name];
    if (!w) throw new Error(`wandKillSwitches: no witness "${name}"`);
    return { wandShotEnemyBodies: true, wandShotKill: true, ...(w.trap ? { wandShotTrapBodies: true } : {}), ...extra };
}

/** The tape for one witness, as `parseTape` takes it. */
export function wandKillTape(name) {
    const w = WAND_KILL_TAPES[name];
    if (!w) throw new Error(`wandKillTape: no witness "${name}"`);
    return {
        game: 'seedling', tape_version: 8, name: `wandkill-${name}`,
        description: `fidelity WANDKILL witness ${name} (probe-seedling-wandkill.mjs)`,
        boot: { ...w.boot }, noclip: false, noDamage: false, noHazards: [], grants: [],
        persistence: [], equips: [{ t: 0, slot: 2 }], pins: ['sound', 'dead_frames'],
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: { ...RNG }, seam: structuredClone(SEAM),
        tick_count: w.ticks,
        inputs: [{ key: w.face, from: 0, to: 1 }, ...w.presses.map((p) => ({ key: 'primary', from: p, to: p + 1 }))],
    };
}

const near = (a, b) => Math.abs(a - b) < 1e-9;

/**
 * The MODEL's readings, one per tick (index 0 = boot): `modelWandEnemySamples`'s, plus the player's `hits` /
 * `hitsTimer`, a LavaTrap's and a WallFlyer's "die", and, at the end, the wand kills, their blasts and the
 * persistence the run cleared.
 */
export async function modelWandKillSamples(tape, switches, { levelSource = null } = {}) {
    const M = (p) => import(join(MODULE, p));
    const { createTapeStepper } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const { withContactFidelity } = await M('contactFidelity.js');
    const { withWandVerb } = await M('wandVerb.js');
    const { buildLevelWorld } = await M('levelWorld.js');
    // ⛓ wave 73 (WANDKILLBLAST): a staged witness passes its own level source (the vanilla atlas, one room edited).
    const src = levelSource ?? atlasLevelSource();
    const census = buildLevelWorld(src(tape.boot.level), {}).pressEnemies
        .filter((e) => WAND_ENEMY_CLASSES.includes(e.as3)).map((e) => ({ id: `${e.tag}@${e.x},${e.y}`, as3: e.as3,
            x: e.x + 8, y: e.y + 8 }));
    const col = [];
    let error = null;
    let final = null;
    withWandVerb(true, () => withContactFidelity(switches, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: src, onTick: (t, s, h, rn) => { run = rn; } });
        try {
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                const statics = new Map((run?.staticBodies ?? []).map((b) => [b.id, b]));
                const lava = new Map((run?.wandKillLavaTraps ?? []).map((b) => [b.id, b]));
                const flyers = new Map((run?.wallFlyers?.bodies ?? []).map((w) => [w.id, w]));
                const drills = new Map((run?.drills?.bodies ?? []).map((d) => [d.id, d]));
                const shooters = new Map((run?.shooters ?? []).map((t) => [t.id, t]));
                const bodies = [];
                for (const c of census) {
                    if (c.as3 === 'WallFlyer') {
                        const w = flyers.get(c.id);
                        if (w) bodies.push({ cls: c.as3, id: c.id, x: w.x, y: w.y, vx: w.vx, vy: w.vy, hits: w.hits,
                            hitsTimer: w.hitsTimer, removed: w.removed, dying: w.dieAnim !== null && !w.destroy,
                            destroy: w.destroy === true });
                    } else if (c.as3 === 'Drill') {
                        const d = drills.get(c.id);
                        if (d) bodies.push({ cls: c.as3, id: c.id, x: d.x, y: d.y, anim: d.anim, hits: d.hits,
                            hitsTimer: d.hitsTimer, removed: d.removed });
                    } else {
                        const row = statics.get(c.id) ?? lava.get(c.id) ?? null;
                        const t = shooters.get(c.id) ?? null;
                        bodies.push({ cls: c.as3, id: c.id, x: c.x, y: c.y, hits: row?.hits ?? 0,
                            hitsTimer: row?.hitsTimer ?? 0, removed: row?.removed === true, dying: row?.dying === true,
                            destroy: row?.destroy === true, anim: t ? t.anim : null });
                    }
                }
                col[o.t] = {
                    px: o.x, py: o.y, level: run ? run.level : tape.boot.level,
                    hits: run?.damage?.hits ?? null, hitsTimer: run?.damage?.hitsTimer ?? null,
                    shots: (run?.wandShotsLive ?? []).filter((s) => !s.removed).map((s) => ({ x: s.x, y: s.y, anim: s.anim })),
                    bodies,
                    spits: [...shooters.values()].flatMap((t) => t.spits.map((s) => ({ x: s.x, y: s.y }))),
                };
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
        final = run ? {
            enemyHits: run.wandEnemyBodyHits,
            kills: run.wandKills ?? null,
            blasts: run.wandKillBlasts ?? null,
            playerHits: (run.playerHits ?? []).length,
            staticDeaths: run.staticBodyDeaths ?? [],
        } : null;
    }));
    return { col, error, final };
}

/**
 * `compareSample` (wave 68's join), plus the kill's own readings: the player's `hits` and `hits_timer`, and a
 * LavaTrap's and a WallFlyer's "die" against the model's `dying`.
 */
export function compareKillSample(t, g, m) {
    const out = compareSample(t, g, m);
    if (!m) return out;
    if (g.hits !== undefined && g.hits !== null && (g.hits !== m.hits || g.hitsTimer !== m.hitsTimer)) {
        out.push(`t ${t}: player hits/hits_timer game ${g.hits}/${g.hitsTimer} model ${m.hits}/${m.hitsTimer}`);
    }
    const live = m.bodies.filter((b) => !b.removed);
    for (const b of g.bodies) {
        if (b.cls !== 'LavaTrap' && b.cls !== 'WallFlyer') continue;
        const mb = live.find((x) => x.cls === b.cls && near(x.x, b.x) && near(x.y, b.y));
        if (mb && (b.anim === 'die') !== (mb.dying === true)) {
            out.push(`t ${t}: ${b.cls} (${b.x}, ${b.y}) game "${b.anim}" model dying=${mb.dying}`);
        }
        if (mb && b.cls === 'WallFlyer' && (b.destroy === true) !== (mb.destroy === true)) {
            out.push(`t ${t}: WallFlyer (${b.x}, ${b.y}) destroy game ${b.destroy} model ${mb.destroy}`);
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
    const DUMP = process.argv.includes('--dump');
    const M = (p) => import(join(MODULE, p));
    const { parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const set = vanillaRecordSet(EMBED, MAP).set;
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-wandkill.mjs', kind: 'browser' });
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
                // ⚠ `botStatus`'s `hits`/`hits_timer` are read in the same evaluate as `botMobiles`, so a sample's
                // player damage is the same tick's.
                frames.push({ t: m.tick ?? s.tick, stick: s.tick, level: s.level, hits: s.hits ?? null,
                    hitsTimer: s.hits_timer ?? null, rows: gameRowsOf(m) });
                return s.finished ? s : null;
            }, 10 * 60 * 1000, 10);
            return { status, mounted, frames };
        } finally {
            await page.close();
        }
    };
    try {
        const only = arg('only', null)?.split(',');
        for (const name of Object.keys(WAND_KILL_TAPES)) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape(JSON.stringify(wandKillTape(name)));
            const model = await modelWandKillSamples(tape, wandKillSwitches(name));
            const g = await play(tape);
            const byTick = new Map();
            for (const f of g.frames) {
                // ⚠ the player's damage is compared only where the status and the mobiles were the same tick.
                if (Number.isInteger(f.t) && f.t >= 0 && f.t <= tape.tick_count && f.rows.player && !byTick.has(f.t)) {
                    byTick.set(f.t, f.stick === f.t ? f : { ...f, hits: null, hitsTimer: null });
                }
            }
            const samples = [...byTick.values()].sort((a, b) => a.t - b.t).filter((f) => f.t > 0 && f.level === tape.boot.level);
            // ⚠ The player AND every shot point: a stance where the player never moves (L27's) fits every shift on
            // the player alone, and the shots' flight pins the clock.
            const fits = [];
            for (let shift = -3; shift <= 3; shift += 1) {
                if (samples.every((f) => {
                    const m = model.col[f.t + shift];
                    return m && near(m.px, f.rows.player.x) && near(m.py, f.rows.player.y)
                        && m.shots.length === f.rows.shots.length
                        && f.rows.shots.every((s) => m.shots.some((x) => near(x.x, s.x) && near(x.y, s.y)));
                })) fits.push(shift);
            }
            const dis = samples.flatMap((f) => compareKillSample(f.t, { ...f.rows, hits: f.hits, hitsTimer: f.hitsTimer },
                model.col[f.t]));
            if (DUMP) {
                let prev = '';
                for (const f of samples) {
                    const line = JSON.stringify({ p: [f.rows.player.x, f.rows.player.y], hits: f.hits, ht: f.hitsTimer,
                        shots: f.rows.shots.map((s) => [s.x, s.y, s.anim]),
                        b: f.rows.bodies.map((b) => [b.cls, b.x, b.y, b.anim, b.hits, b.hitsTimer, b.destroy, b.vx, b.vy]),
                        spits: f.rows.spits.length });
                    if (line !== prev) console.log(`DUMP ${name} t${f.t} ${line}`);
                    prev = line;
                }
                console.log(`DUMP ${name} persistence_cleared ${JSON.stringify(g.status?.persistence_cleared ?? null)}`);
            }
            const shotTicks = samples.filter((f) => f.rows.shots.length > 0).length;
            console.log(`ROW ${JSON.stringify({ name, set_id: set.set_id, mounted: g.mounted?.active, samples: samples.length,
                shotSamples: shotTicks, hits: g.status?.hits ?? null, modelError: model.error,
                cleared: g.status?.persistence_cleared ?? null,
                modelKills: model.final?.kills ?? null, modelBlasts: model.final?.blasts ?? null })}`);
            check(`${name}: the sample clock is the model's (shifts fitting every player x/y and shot: [${fits}], must be [0])`,
                fits.length === 1 && fits[0] === 0 && model.error === null, model.error ?? '');
            check(`${name}: every shot, body, spit and player hit is the model's (wandShotKill ON) at every sampled tick`,
                dis.length === 0 && shotTicks > 0, dis.slice(0, 8).join(' | '));
            const cleared = (g.status?.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`).sort();
            const modelCleared = (model.final?.staticDeaths ?? []).filter((d) => d.write !== null)
                .map((d) => `${d.level}:${d.tag}`).sort();
            check(`${name}: the persistence the game cleared is the model's static deaths' writes`,
                JSON.stringify(cleared) === JSON.stringify(modelCleared), `game [${cleared}] model [${modelCleared}]`);
            if (RECORD && fits.length === 1 && fits[0] === 0 && dis.length === 0 && model.error === null) {
                const dir = join(MODULE, 'fixtures', 'wandkill-witness');
                mkdirSync(dir, { recursive: true });
                const out = {
                    name, page: PAGE, delivered_set: set.set_id,
                    recordedBy: 'scripts/procgen/probe-seedling-wandkill.mjs --record',
                    note: 'the GAME\'s rows (`botMobiles()`: the player, every WandShot, the six classes\' bodies and every '
                        + 'TurretSpit; `botStatus()`\'s `hits`/`hits_timer` where read on the same tick) at each sampled '
                        + 'tick, and the persistence the run cleared at its end',
                    hits: g.status?.hits ?? null,
                    persistenceCleared: g.status?.persistence_cleared ?? null,
                    samples: samples.map((f) => ({ t: f.t, ...f.rows, hits: f.hits, hitsTimer: f.hitsTimer })),
                    tape: wandKillTape(name),
                };
                writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(out)}\n`);
                console.log(`recorded fixtures/wandkill-witness/${name}.json — ${out.samples.length} sample(s)`);
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
