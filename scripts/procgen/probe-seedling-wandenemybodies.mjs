#!/usr/bin/env node
/**
 * probe-seedling-wandenemybodies — ⛓ SEEDLING FIDELITY WANDENEMYBODIES (wave 68): A WAND SHOT AT A TURRET, LAVATRAP,
 * WALLFLYER, ICETRAP, SANDTRAP OR DRILL, ON THE GAME, TICK BY SAMPLED TICK, AGAINST THE MODEL WITH
 * `wandShotEnemyBodies` ON.
 *
 * `WandShot.solids` holds "Enemy" (`WandShot.as:69`) and all six classes are `Enemy`s (`Enemy.as:58`), none of which
 * writes `collidable`: a body stops the shot from its ctor until the world removes it. The shot calls
 * `(_e as Enemy).hit(3, new Point(x, y), damage, "Wand")` (`WandShot.as:112-117`; `damage` 0.5) — `Enemy.hit`'s gates
 * (`Enemy.as:141-181`) and each class's `knockback`/`startDeath`. The game's `botMobiles()` reports every `Mobile` with
 * its `Enemy` fields (`Bot.as` `mobileRow`), so each sample is compared at the SAME tick with the model's replay:
 *   · the PLAYER at 0 px (the sample clock's calibration: exactly shift [0]);
 *   · every WandShot: count, (x, y) and anim ("flare" / "die") — the stop point and the stop tick;
 *   · every body of the six classes: presence, (x, y), `hits`, `hitsTimer`; a WallFlyer's `v`; a Drill's anim; a
 *     Turret's anim (its fire gate: "startshot" / "finishshot" / "", and "die");
 *   · every TurretSpit: count and (x, y) — a hit's i-frames hold the turret's next shot.
 * Only the boot level is compared (each tape stays in it).
 *
 * Each tape (`WAND_ENEMY_TAPES`) is played on a FRESH page of the game (p4g, headless logic-only) on the DELIVERED
 * vanilla set (`vanillaRecordSet`, mounted with `botLoadLevels`; the row prints its `set_id`). Two shapes:
 *   · a STAGED stance: boot, the Wand selected at t0 (slot 2), a one-tick tap to face, presses at `presses`;
 *   · a SWORD KILL, then the wand (`from`): a committed C1 sword-kill witness (`fixtures/static-sword-witness/`) cut at
 *     `cut`, the Wand granted and its slot (`slot`: the base seam's slot order) selected at `equipAt`, presses at `presses` — a shot at a body in its "die" anim, in
 *     its fade, and after its removal.
 *
 * Run (a dev server at the repo root):
 *   node scripts/procgen/probe-seedling-wandenemybodies.mjs [--host=http://localhost:8000] [--only=<name>[,…]] [--record]
 *   --record   write `fixtures/wandenemybodies-witness/<name>.json` (the tape and the GAME's samples), which
 *              `fidelityWandEnemyBodies.test.js` replays against the model — only on a PASS.
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
/** Split RNG (exact shakes, `shakeExactSplit`). */
const RNG = Object.freeze({ seed: 1356861785, split: true, cosmetic: 0 });

/** The six classes, as `botMobiles()` names them (`getQualifiedClassName`). */
export const WAND_ENEMY_CLASSES = Object.freeze(['Turret', 'LavaTrap', 'WallFlyer', 'IceTrap', 'SandTrap', 'Drill']);

/**
 * The witness tapes. `trap`: the room also holds a wave-67 trap body, so `wandShotTrapBodies` is ON beside the key.
 *   turret-live       L59, facing E at turret@152,64 (32 px: in its range, it aims and spits): (a) the stop, the hit
 *                     (hits 0.5, 30 i-frames), and the turret's fire gate held by them.
 *   turret-iframes    the same, three presses 20 and 30 ticks apart: the second lands in the i-frames (no damage),
 *                     the third after them (hits 1).
 *   turret-l65        L65, facing E at turret@64,112 — the walk's room (d, staged).
 *   turret-die        C1's L62 sword kill of turret@232,248 (`c1-l62-turret`), the wand fired into its "die" anim (b).
 *                     ⚠ pressed at 90: the sword press at 84 holds `slashing` up, and `set wanding`'s `!slashing`
 *                     (`Player.as:834`) swallows a wand press at 88 or 89 (measured: no shot on the game).
 *   turret-fade       the same, the shot meeting the `destroy`ed turret in `Mobile.death`'s fade (b).
 *   turret-removed    the same, the shot fired after the fade removed it: it flies on (b).
 *   lavatrap-live     L78, facing E at lavatrap@96,80 from 40 px (outside its 32 px tongue): (a), (d) staged.
 *   lavatrap-iframes  three presses, 20 and 30 ticks apart.
 *   icetrap-live      L53, facing W at icetrap@160,192: `canHit = false` — it stops the shot and takes nothing.
 *                     (L45's boot beside icetrap@64,64 cannot move: no clock calibration there.)
 *   sandtrap-live     L16, facing W at sandtrap@48,32: (a).
 *   sandtrap-l36      L36, facing N at sandtrap@64,80 (C1's room).
 *   sandtrap-die      C1's L36 sword kill (`c1-l36-sandtraps`), the wand fired into a dying sandtrap's "die" (b).
 *   sandtrap-removed  the same, the shot fired after `endAnim` removed it: it flies on (b).
 *   wallflyer-flight  L27, facing E at wallflyer@192,48 on its trigger ray: the flyer launches at the player and the
 *                     shot meets it IN FLIGHT (c) — the hit reverses `v`.
 *   drill-sit         L88, facing E at the SITTING (invisible) drill@128,160 from 59 px (outside its 48 px run range):
 *                     it stops the shot; "hit" for 30 updates.
 *   drill-hop         L88, below it, facing N: the drill hops at the player on tick 1 and the shot meets it at its
 *                     hopped cell (c); its i-frames hold the next hop.
 */
export const WAND_ENEMY_TAPES = Object.freeze({
    'turret-live': { boot: { level: 59, x: 120, y: 64 }, face: 'right', presses: [4], ticks: 60, trap: true },
    'turret-iframes': { boot: { level: 59, x: 120, y: 64 }, face: 'right', presses: [4, 24, 54], ticks: 90, trap: true },
    'turret-l65': { boot: { level: 65, x: 32, y: 112 }, face: 'right', presses: [4], ticks: 50, trap: true },
    'turret-die': { from: 'c1-l62-turret', cut: 86, equipAt: 86, slot: 2, presses: [90], ticks: 110, trap: true },
    'turret-fade': { from: 'c1-l62-turret', cut: 86, equipAt: 86, slot: 2, presses: [100], ticks: 125, trap: true },
    'turret-removed': { from: 'c1-l62-turret', cut: 86, equipAt: 86, slot: 2, presses: [112], ticks: 140, trap: true },
    'lavatrap-live': { boot: { level: 78, x: 56, y: 80 }, face: 'right', presses: [4], ticks: 50, trap: true },
    'lavatrap-iframes': { boot: { level: 78, x: 56, y: 80 }, face: 'right', presses: [4, 24, 54], ticks: 90, trap: true },
    'icetrap-live': { boot: { level: 53, x: 192, y: 192 }, face: 'left', presses: [4], ticks: 40 },
    'sandtrap-live': { boot: { level: 16, x: 80, y: 32 }, face: 'left', presses: [4], ticks: 50 },
    'sandtrap-l36': { boot: { level: 36, x: 64, y: 112 }, face: 'up', presses: [4], ticks: 50 },
    'sandtrap-die': { from: 'c1-l36-sandtraps', cut: 86, equipAt: 86, slot: 1, presses: [90], ticks: 112 },
    'sandtrap-removed': { from: 'c1-l36-sandtraps', cut: 86, equipAt: 86, slot: 1, presses: [112], ticks: 140 },
    'wallflyer-flight': { boot: { level: 27, x: 152, y: 48 }, face: 'right', presses: [4], ticks: 60 },
    'drill-sit': { boot: { level: 88, x: 68, y: 160 }, face: 'right', presses: [4], ticks: 60 },
    'drill-hop': { boot: { level: 88, x: 128, y: 200 }, face: 'up', presses: [4], ticks: 60 },
});

/** The switches a witness runs the model under: the key, and `wandShotTrapBodies` beside it where the room needs it. */
export function wandEnemySwitches(name, extra = {}) {
    const w = WAND_ENEMY_TAPES[name];
    if (!w) throw new Error(`wandEnemySwitches: no witness "${name}"`);
    return { wandShotEnemyBodies: true, ...(w.trap ? { wandShotTrapBodies: true } : {}), ...extra };
}

/** The tape for one witness, as `parseTape` takes it. */
export function wandEnemyTape(name) {
    const w = WAND_ENEMY_TAPES[name];
    if (!w) throw new Error(`wandEnemyTape: no witness "${name}"`);
    const presses = w.presses.map((p) => ({ key: 'primary', from: p, to: p + 1 }));
    if (w.from) {
        const base = JSON.parse(readFileSync(join(MODULE, 'fixtures', 'static-sword-witness', `${w.from}.tape.json`), 'utf8'));
        return {
            ...base,
            name: `wandenemybodies-${name}`,
            description: `fidelity WANDENEMYBODIES witness ${name} (probe-seedling-wandenemybodies.mjs): ${w.from} cut at `
                + `${w.cut}, the Wand at ${w.equipAt}`,
            seam: { ...structuredClone(base.seam), items: { ...base.seam.items, hasWand: true } },
            equips: [{ t: w.equipAt, slot: w.slot }],
            tick_count: w.ticks,
            inputs: [...base.inputs.filter((sp) => sp.from < w.cut).map((sp) => ({ ...sp, to: Math.min(sp.to, w.cut) })),
                ...presses],
        };
    }
    return {
        game: 'seedling', tape_version: 8, name: `wandenemybodies-${name}`,
        description: `fidelity WANDENEMYBODIES witness ${name} (probe-seedling-wandenemybodies.mjs)`,
        boot: { ...w.boot }, noclip: false, noDamage: false, noHazards: [], grants: [],
        persistence: [], equips: [{ t: 0, slot: 2 }], pins: ['sound', 'dead_frames'],
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: { ...RNG }, seam: structuredClone(SEAM),
        tick_count: w.ticks,
        inputs: [{ key: w.face, from: 0, to: 1 }, ...presses],
    };
}

const near = (a, b) => Math.abs(a - b) < 1e-9;

/**
 * The MODEL's readings, one per tick (index 0 = boot): the player, the live shots, the six classes' bodies (entity
 * point, `hits`, `hitsTimer`, removed; a flyer's `v`, a drill's and a turret's anim) and the turret spits.
 */
export async function modelWandEnemySamples(tape, switches = { wandShotEnemyBodies: true }) {
    const M = (p) => import(join(MODULE, p));
    const { createTapeStepper } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const { withContactFidelity } = await M('contactFidelity.js');
    const { withWandVerb } = await M('wandVerb.js');
    const { buildLevelWorld } = await M('levelWorld.js');
    const src = atlasLevelSource();
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
                const lava = new Map((run?.wandLavaTraps ?? []).map((b) => [b.id, b]));
                const flyers = new Map((run?.wallFlyers?.bodies ?? []).map((w) => [w.id, w]));
                const drills = new Map((run?.drills?.bodies ?? []).map((d) => [d.id, d]));
                const shooters = new Map((run?.shooters ?? []).map((t) => [t.id, t]));
                const bodies = [];
                for (const c of census) {
                    if (c.as3 === 'WallFlyer') {
                        const w = flyers.get(c.id);
                        if (w) bodies.push({ cls: c.as3, id: c.id, x: w.x, y: w.y, vx: w.vx, vy: w.vy, hits: w.hits,
                            hitsTimer: w.hitsTimer, removed: w.removed, dying: w.dieAnim !== null });
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
                    shots: (run?.wandShotsLive ?? []).filter((s) => !s.removed).map((s) => ({ x: s.x, y: s.y, anim: s.anim })),
                    bodies,
                    spits: [...shooters.values()].flatMap((t) => t.spits.map((s) => ({ x: s.x, y: s.y }))),
                };
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
        final = run ? { enemyHits: run.wandEnemyBodyHits, shotHits: run.wandShotHits.map((h) => ({ id: h.id, arm: h.arm })),
            playerHits: (run.playerHits ?? []).length } : null;
    }));
    return { col, error, final };
}

/** The game's rows of one sample, reduced to what is compared. */
export function gameRowsOf(mobiles) {
    const rows = mobiles?.mobiles ?? [];
    const player = rows.find((r) => /Player$/.test(r.cls));
    const cls = (r) => WAND_ENEMY_CLASSES.find((c) => new RegExp(`(^|[:.])${c}$`).test(r.cls)) ?? null;
    return {
        player: player ? { x: player.x, y: player.y } : null,
        shots: rows.filter((r) => /WandShot$/.test(r.cls)).map((r) => ({ x: r.x, y: r.y, anim: r.anim })),
        bodies: rows.filter((r) => cls(r) !== null).map((r) => ({
            cls: cls(r), x: r.x, y: r.y, vx: r.vx, vy: r.vy, anim: r.anim ?? '', destroy: r.destroy,
            hits: r.enemy?.hits ?? null, hitsTimer: r.enemy?.hits_timer ?? null,
        })),
        spits: rows.filter((r) => /TurretSpit$/.test(r.cls)).map((r) => ({ x: r.x, y: r.y })),
    };
}

/** The model's anim for a game body's, where the model carries one (`null`: not compared). */
function modelAnim(m) {
    if (m.cls === 'Drill') return m.anim;
    if (m.cls === 'Turret') {
        if (m.destroy) return '';
        if (m.dying) return 'die';
        return m.anim;
    }
    return null;
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
    const live = m.bodies.filter((b) => !b.removed);
    if (g.bodies.length !== live.length) {
        out.push(`t ${t}: bodies game ${JSON.stringify(g.bodies.map((b) => [b.cls, b.x, b.y]))} model `
            + `${JSON.stringify(live.map((b) => [b.cls, b.x, b.y]))}`);
    }
    for (const b of g.bodies) {
        const mb = live.find((x) => x.cls === b.cls && near(x.x, b.x) && near(x.y, b.y));
        if (!mb) {
            out.push(`t ${t}: the game's ${b.cls} at (${b.x}, ${b.y}) has no live model body (${JSON.stringify(live.filter((x) => x.cls === b.cls).map((x) => [x.x, x.y]))})`);
            continue;
        }
        if (!near(b.hits, mb.hits) || b.hitsTimer !== mb.hitsTimer) {
            out.push(`t ${t}: ${b.cls} (${b.x}, ${b.y}) hits/hitsTimer game ${b.hits}/${b.hitsTimer} model ${mb.hits}/${mb.hitsTimer}`);
        }
        if (b.cls === 'WallFlyer' && !(near(b.vx, mb.vx) && near(b.vy, mb.vy))) {
            out.push(`t ${t}: WallFlyer (${b.x}, ${b.y}) v game (${b.vx}, ${b.vy}) model (${mb.vx}, ${mb.vy})`);
        }
        const ma = modelAnim(mb);
        if (ma !== null && ma !== b.anim) out.push(`t ${t}: ${b.cls} (${b.x}, ${b.y}) anim game "${b.anim}" model "${ma}"`);
        if (b.cls === 'SandTrap' && (b.anim === 'die') !== (mb.dying === true)) {
            out.push(`t ${t}: SandTrap (${b.x}, ${b.y}) game "${b.anim}" model dying=${mb.dying}`);
        }
    }
    if (g.spits.length !== m.spits.length) out.push(`t ${t}: spits game ${JSON.stringify(g.spits)} model ${JSON.stringify(m.spits)}`);
    for (const s of g.spits) {
        if (!m.spits.some((x) => near(x.x, s.x) && near(x.y, s.y))) out.push(`t ${t}: the game's spit at (${s.x}, ${s.y}) has no model spit (${JSON.stringify(m.spits)})`);
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

    takeBoxLockOrExit({ name: 'probe-seedling-wandenemybodies.mjs', kind: 'browser' });
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
        for (const name of Object.keys(WAND_ENEMY_TAPES)) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape(JSON.stringify(wandEnemyTape(name)));
            const model = await modelWandEnemySamples(tape, wandEnemySwitches(name));
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
                modelEnemyHits: model.final?.enemyHits ?? null, modelShotHits: model.final?.shotHits ?? null })}`);
            check(`${name}: the sample clock is the model's (shifts fitting every player x/y: [${fits}], must be [0])`,
                fits.length === 1 && fits[0] === 0 && model.error === null, model.error ?? '');
            check(`${name}: every shot, body and spit is the model's (wandShotEnemyBodies ON) at every sampled tick`,
                dis.length === 0 && shotTicks > 0, dis.slice(0, 8).join(' | '));
            if (RECORD && fits.length === 1 && fits[0] === 0 && dis.length === 0 && model.error === null) {
                const dir = join(MODULE, 'fixtures', 'wandenemybodies-witness');
                mkdirSync(dir, { recursive: true });
                const out = {
                    name, page: PAGE, delivered_set: set.set_id,
                    recordedBy: 'scripts/procgen/probe-seedling-wandenemybodies.mjs --record',
                    note: 'the GAME\'s rows (`botMobiles()`: the player, every WandShot, the six classes\' bodies and every '
                        + 'TurretSpit) at each sampled tick',
                    hits: g.status?.hits ?? null,
                    samples: samples.map((f) => ({ t: f.t, ...f.rows })),
                    tape: wandEnemyTape(name),
                };
                writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(out)}\n`);
                console.log(`recorded fixtures/wandenemybodies-witness/${name}.json — ${out.samples.length} sample(s)`);
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
