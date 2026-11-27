#!/usr/bin/env node
/**
 * probe-seedling-wandswingdrill — ⛓ SEEDLING FIDELITY WANDSWINGDRILL (wave 70): TWO MODEL ERRORS WAVE 68 MEASURED,
 * WITNESSED ON THE GAME TICK BY SAMPLED TICK, AGAINST THE MODEL OFF AND WITH THE SLICE'S KEY ON.
 *
 * GAP 1 — `itemPressHeldBySlash`. `Player.useItem` (`Player.as:1575-1615`) runs from `input()` on
 * `Input.pressed(keys[4|5])` — an EDGE, never buffered — and its wand / fire arms go through `set wanding`
 * (`:832-849`, `!slashing && (!firing || hasFireWand) && !deathRaying && !spearing`) and `set firing` (`:856-873`,
 * `!slashing && (!wanding || hasFireWand) && …`). `_slashing` is raised by `set slashing` and lowered by `slashEnd`, the
 * sword sprite's complete-callback (`:41`, `:1046`), which `sprites()` fires BELOW `input()`; so a wand or fire press
 * on any tick from the swing's press through its `slashEnd` tick is DROPPED (no window, no shot, no fire, and no
 * retry: the key is not re-read until its next press edge). The model admitted a LONE such press unconditionally
 * (`levelRun` `pressCalls`: `pressCalls.length === 0 || …`) and opened its window.
 *   Tapes (L10, boot (16,48), C = the sword (seam `secondary` 0), X = the wand (equip slot 2) or fire (slot 1)):
 *     swing-wand-<k>   C at 4, X (the wand) at 4 + k, k = 0..6 (k = 0 is the X+C tick: the existing second-call gate)
 *     swing-wand-held  C at 4, X held from 6 to 14 (one edge, inside the swing): no shot, ever
 *     swing-fire-2     right held, C at 4, X (fire) at 6, C at 12: the game drops the fire and DASHES on 12
 *                      (`slashTimer` 20 from 4, `!slashDashed`); OFF opens a fire window and gates the dash
 *     swing-fire-6     the same, fire at 10 (after the swing): it fires in both and gates the dash in both (control)
 *     wand-swing-2     X (the wand) at 4, C at 6: `set slashing`'s `!wanding` drops the sword in both (the converse)
 *     wand-walk        RESIDUE (report only, never recorded): right held, X (the wand) at 4, no sword — the game's shot
 *                      VANISHES at t 25 (x 89 → none, no "die" anim, 13 updates into its 16) where the model flies on to
 *                      L10's Stone at x 96 and dies; not a swing effect (the walking tapes above stop at t 24)
 *     c1-wand-<t>      C1's L62 sword kill (`c1-l62-turret`, its sword press at 84) cut at 86, the Wand at 86, X at t
 *                      (87, 88, 89): wave 68's measured case (with both wand keys ON; 90 is its `turret-die`)
 * GAP 2 — `drillSightLineGame`. A `Tile` is typed "Tile" by its ctor and writes `type = types[t]` in its FIRST
 * `update()` (`Scenery/Tile.as:110`, `:117-121`; Cliff, `t` 9, is "Solid"); `loadlevel` adds the tiles before the
 * drills and `World.addUpdate` prepends, so on a world's first frame the drill updates while no tile is "Solid" yet,
 * and its `collideLine("Solid", x, y, p.x, p.y)` (`Drill.as:84`) sees only the object solids. The model's
 * `collideLineSolid` read every tile solid on that frame too, so a drill whose line crosses a tile never hopped on it.
 *   Tapes (no input; the drill's first update reads the player's boot point):
 *     drill-l88-e    L88, the player at (176, 168), 40 px E of `drill@128,160` across `tile:Cliff` (160..176)
 *     drill-l88-se   L88, (174, 178)          drill-l88-nw  L88, (97, 141)
 *     drill-l91-e    L91, (117, 72)           drill-l91-w   L91, (29, 80)    (`drill@64,80`, beside three Bobs)
 *
 * Each tape is played on a FRESH page of the game (p4g, headless logic-only) on the DELIVERED vanilla set (mounted with
 * `botLoadLevels`); each sample is compared at the same tick with the model's replay (the player at 0 px, every
 * WandShot, the six enemy classes' bodies — `probe-seedling-wandenemybodies.mjs`'s join), the model OFF (the shipped
 * switches) and ON (the witness's `switches`). A GAP is a witness whose OFF disagrees with the game.
 *
 * Run (a dev server at the repo root):
 *   node scripts/procgen/probe-seedling-wandswingdrill.mjs [--host=http://localhost:8000] [--only=<name>[,…]] [--record]
 *   --dump=<dir>  write every witness's game samples to `<dir>/<name>.json` (any verdict; for reading a FAIL)
 *   --record   write `fixtures/wandswingdrill-witness/<name>.json` (the tape and the GAME's samples), which
 *              `fidelityWandSwingDrill.test.js` replays against the model — only when ON is the game.
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
import { compareSample, gameRowsOf, modelWandEnemySamples } from './probe-seedling-wandenemybodies.mjs';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** The staged seam: the sword, the shield, fire and the wand; `secondary` 0 puts the SWORD on C. */
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

const SWING = { level: 10, x: 16, y: 48 };
const press = (key, t) => ({ key, from: t, to: t + 1 });

/**
 * The witness tapes. `gap`: 1 (the press) or 2 (the drill); `slot`: X's item slot (2 the wand, 1 fire); `inputs`;
 * `from`: a committed C1 sword-kill tape cut at `cut` with the Wand at `equipAt` (wave 68's shape).
 */
export const WAND_SWING_DRILL_TAPES = Object.freeze({
    ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((k) => [`swing-wand-${k}`, {
        gap: 1, boot: SWING, slot: 2, ticks: 40,
        inputs: [press('right', 0), press('secondary', 4), press('primary', 4 + k)],
    }])),
    'swing-wand-held': { gap: 1, boot: SWING, slot: 2, ticks: 40,
        inputs: [press('right', 0), press('secondary', 4), { key: 'primary', from: 6, to: 15 }] },
    'swing-fire-2': { gap: 1, boot: SWING, slot: 1, ticks: 24,
        inputs: [{ key: 'right', from: 0, to: 24 }, press('secondary', 4), press('primary', 6), press('secondary', 12)] },
    'swing-fire-6': { gap: 1, boot: SWING, slot: 1, ticks: 24,
        inputs: [{ key: 'right', from: 0, to: 24 }, press('secondary', 4), press('primary', 10), press('secondary', 14)] },
    'wand-swing-2': { gap: 1, boot: SWING, slot: 2, ticks: 24,
        inputs: [{ key: 'right', from: 0, to: 24 }, press('primary', 4), press('secondary', 6)] },
    'wand-walk': { gap: 1, boot: SWING, slot: 2, ticks: 40, residue: true,
        inputs: [{ key: 'right', from: 0, to: 30 }, press('primary', 4)] },
    ...Object.fromEntries([87, 88, 89].map((t) => [`c1-wand-${t}`, {
        gap: 1, from: 'c1-l62-turret', cut: 86, equipAt: 86, slot: 2, presses: [t], ticks: 110, wandKeys: true,
    }])),
    'drill-l88-e': { gap: 2, boot: { level: 88, x: 168, y: 160 }, ticks: 60 },
    'drill-l88-se': { gap: 2, boot: { level: 88, x: 166, y: 170 }, ticks: 60 },
    'drill-l88-nw': { gap: 2, boot: { level: 88, x: 89, y: 133 }, ticks: 60 },
    'drill-l91-e': { gap: 2, boot: { level: 91, x: 109, y: 64 }, ticks: 60 },
    'drill-l91-w': { gap: 2, boot: { level: 91, x: 21, y: 72 }, ticks: 60 },
});

/** The slice's key for a witness's gap. */
export const GAP_KEY = Object.freeze({ 1: 'itemPressHeldBySlash', 2: 'drillSightLineGame' });

/** The switches the witness's ON arm runs under (OFF: `extra` alone). */
export function wandSwingDrillSwitches(name, { on = true, extra = {} } = {}) {
    const w = WAND_SWING_DRILL_TAPES[name];
    if (!w) throw new Error(`wandSwingDrillSwitches: no witness "${name}"`);
    return {
        ...(on ? { [GAP_KEY[w.gap]]: true } : {}),
        ...(w.wandKeys ? { wandShotTrapBodies: true, wandShotEnemyBodies: true } : {}),
        ...extra,
    };
}

/** The tape for one witness, as `parseTape` takes it. */
export function wandSwingDrillTape(name) {
    const w = WAND_SWING_DRILL_TAPES[name];
    if (!w) throw new Error(`wandSwingDrillTape: no witness "${name}"`);
    if (w.from) {
        const base = JSON.parse(readFileSync(join(MODULE, 'fixtures', 'static-sword-witness', `${w.from}.tape.json`), 'utf8'));
        return {
            ...base,
            name: `wandswingdrill-${name}`,
            description: `fidelity WANDSWINGDRILL witness ${name} (probe-seedling-wandswingdrill.mjs): ${w.from} cut at `
                + `${w.cut}, the Wand at ${w.equipAt}`,
            seam: { ...structuredClone(base.seam), items: { ...base.seam.items, hasWand: true } },
            equips: [{ t: w.equipAt, slot: w.slot }],
            tick_count: w.ticks,
            inputs: [...base.inputs.filter((sp) => sp.from < w.cut).map((sp) => ({ ...sp, to: Math.min(sp.to, w.cut) })),
                ...w.presses.map((p) => press('primary', p))],
        };
    }
    return {
        game: 'seedling', tape_version: 8, name: `wandswingdrill-${name}`,
        description: `fidelity WANDSWINGDRILL witness ${name} (probe-seedling-wandswingdrill.mjs)`,
        boot: { ...w.boot }, noclip: false, noDamage: false, noHazards: [], grants: [],
        persistence: [], equips: w.slot === undefined ? [] : [{ t: 0, slot: w.slot }], pins: ['sound', 'dead_frames'],
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: { ...RNG }, seam: structuredClone(SEAM),
        tick_count: w.ticks,
        inputs: (w.inputs ?? []).map((sp) => ({ ...sp })),
    };
}

/** Every disagreement of a recording's samples with one model replay (the probe's and the unit rows' join). */
export function disagreements(samples, model) {
    return samples.flatMap((f) => compareSample(f.t, f, model.col[f.t]));
}

export { modelWandEnemySamples };

/** The probe's clock test: exactly shift 0 — or, for a drill tape (a still player), any fit set that holds 0. */
export function clockOk(w, fits) {
    return w.gap === 2 ? fits.includes(0) : (fits.length === 1 && fits[0] === 0);
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
    const { CONTACT_FIDELITY_KEYS } = await M('contactFidelity.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const set = vanillaRecordSet(EMBED, MAP).set;
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-wandswingdrill.mjs', kind: 'browser' });
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
        for (const name of Object.keys(WAND_SWING_DRILL_TAPES)) {
            if (only && !only.includes(name)) continue;
            const w = WAND_SWING_DRILL_TAPES[name];
            const tape = parseTape(JSON.stringify(wandSwingDrillTape(name)));
            const keyed = CONTACT_FIDELITY_KEYS.includes(GAP_KEY[w.gap]);
            const off = await modelWandEnemySamples(tape, wandSwingDrillSwitches(name, { on: false }));
            const on = keyed ? await modelWandEnemySamples(tape, wandSwingDrillSwitches(name)) : null;
            const g = await play(tape);
            const byTick = new Map();
            for (const f of g.frames) {
                if (Number.isInteger(f.t) && f.t >= 0 && f.t <= tape.tick_count && f.rows.player && !byTick.has(f.t)) byTick.set(f.t, f);
            }
            // ⚠ The game's tick-0 reading can be the PREVIOUS world's mobiles (read before the boot world is built): skipped.
            const samples = [...byTick.values()].sort((a, b) => a.t - b.t).filter((f) => f.t > 0 && f.level === tape.boot.level)
                .map((f) => ({ t: f.t, ...f.rows }));
            const ref = on ?? off;
            const fits = [];
            for (let shift = -3; shift <= 3; shift += 1) {
                if (samples.every((f) => {
                    const m = ref.col[f.t + shift];
                    return m && Math.abs(m.px - f.player.x) < 1e-9 && Math.abs(m.py - f.player.y) < 1e-9;
                })) fits.push(shift);
            }
            const disOff = disagreements(samples, off);
            const disOn = on ? disagreements(samples, on) : null;
            const shotTicks = samples.filter((f) => f.shots.length > 0).length;
            const drills = samples.flatMap((f) => f.bodies.filter((b) => b.cls === 'Drill').map((b) => `${f.t}:${b.x},${b.y}:${b.anim}`));
            console.log(`ROW ${JSON.stringify({ name, gap: w.gap, set_id: set.set_id, samples: samples.length, shotSamples: shotTicks,
                hits: g.status?.hits ?? null, offError: off.error, onError: on?.error ?? null,
                firstShot: samples.find((f) => f.shots.length > 0)?.t ?? null,
                drillFirst: drills.slice(0, 3), offDisagreements: disOff.length, onDisagreements: disOn?.length ?? null })}`);
            console.log(`${disOff.length > 0 || off.error ? 'GAP' : 'NO GAP'}: ${name} — OFF ${off.error ?? disOff.slice(0, 4).join(' | ')}`);
            if (on && w.residue) {
                console.log(`RESIDUE: ${name} — ON ${disOn.length} disagreement(s): ${disOn.slice(0, 3).join(' | ')}`);
            } else if (on) {
                // ⚠ A drill tape's player stands still, so its x/y fit every shift near 0: there the drill's tick-1 hop
                // pins the clock (a shift of -1 compares the hop with the model's unhopped drill), so 0 must fit and the
                // body join below must be exact.
                check(`${name}: the sample clock is the model's (shifts fitting every player x/y: [${fits}], must be `
                    + `${w.gap === 2 ? 'contain 0 — the hop pins it' : '[0]'})`,
                    clockOk(w, fits) && on.error === null, on.error ?? '');
                check(`${name}: every shot and body is the model's (${GAP_KEY[w.gap]} ON) at every sampled tick`,
                    disOn.length === 0, disOn.slice(0, 8).join(' | '));
            }
            const DUMP = arg('dump', null);
            if (DUMP) {
                mkdirSync(DUMP, { recursive: true });
                writeFileSync(join(DUMP, `${name}.json`), `${JSON.stringify({ name, samples, tape: wandSwingDrillTape(name) })}\n`);
            }
            if (RECORD && on && !w.residue && clockOk(w, fits) && disOn.length === 0 && on.error === null) {
                const dir = join(MODULE, 'fixtures', 'wandswingdrill-witness');
                mkdirSync(dir, { recursive: true });
                const out = {
                    name, gap: w.gap, page: PAGE, delivered_set: set.set_id,
                    recordedBy: 'scripts/procgen/probe-seedling-wandswingdrill.mjs --record',
                    note: 'the GAME\'s rows (`botMobiles()`: the player, every WandShot and the six enemy classes\' bodies) '
                        + 'at each sampled tick',
                    hits: g.status?.hits ?? null,
                    samples,
                    tape: wandSwingDrillTape(name),
                };
                writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(out)}\n`);
                console.log(`recorded fixtures/wandswingdrill-witness/${name}.json — ${out.samples.length} sample(s)`);
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
