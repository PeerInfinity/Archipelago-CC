#!/usr/bin/env node
/**
 * probe-seedling-wandkillblast — ⛓ SEEDLING FIDELITY WANDKILLBLAST (wave 73): THE WAND KILL'S EXPLOSION, ITS TWO
 * UNWITNESSED HALVES, ON THE GAME, TICK BY SAMPLED TICK, AGAINST THE MODEL.
 *
 * `dieEffects("Wand")` adds `Explosion(x, y, ["Player", "Enemy"], max(width, height), 1)` (`Enemies/Enemy.as:189-209`);
 * its `added()` — the end-of-tick `updateLists()` — asks the prefilter square, then the origin-to-origin disc
 * (`FP.distance <= radius`), and calls `Player.hit(null, 4, p, 1)` or `Enemy.hit(4, p, 1)` (`Projectiles/Explosion.as:
 * 45-68`). Wave 71 witnessed the kill and modelled both arms, but neither was witnessed:
 *   (b) THE PLAYER HALF. A stance that lands six shots never put the player in the disc: closer, the body's contact
 *       knocks the player back. This probe uses the one window the game leaves open: the kill tick itself. The shot
 *       updates first and plays the body's "die", so that body's `hitPlayer` is gated on the kill tick
 *       (`Enemy.as:213`), while the turret's contact on the tick BEFORE still read the player's previous position. So
 *       the player walks in on the kill tick: not overlapping the body at the end of tick k-1, in the disc at the end
 *       of tick k.
 *   (c) THE SECOND BODY. No census pair is inside a disc (the nearest is 16 px), so a neighbour is STAGED: one entity
 *       added to the vanilla room (level data through `botLoadLevels`, its own `set_id`; the game runs unmodified).
 *
 * Every shape runs on a FRESH page (p4g, headless logic-only) and is compared at every sampled tick with the model's
 * replay under `switches` (wave 71's `modelWandKillSamples` / `compareKillSample` join: the player, every shot, every
 * wand-class body's hits / hitsTimer / anim, every spit and the player's `hits` / `hits_timer`).
 *
 * Run (a dev server at the repo root):
 *   node scripts/procgen/probe-seedling-wandkillblast.mjs [--host=http://localhost:8000] [--only=<name>[,…]] [--record] [--dump]
 *   --record   write `fixtures/wandkillblast-witness/<name>.json` (the shape, its tape and the GAME's samples), which
 *              `fidelityWandKillBlast.test.js` replays against the model — only where the model (`switches`) matches.
 *   --dump     print the game's per-tick changes — a reading aid.
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
import { gameRowsOf } from './probe-seedling-wandenemybodies.mjs';
import { compareKillSample, modelWandKillSamples, wandKillTape } from './probe-seedling-wandkill.mjs';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** Five spaced presses: each shot lands after the last one's 30 i-frames (wave 71's `SIX`, less the last). */
const FIVE = Object.freeze([4, 36, 68, 100, 132]);
const press = (t) => ({ key: 'primary', from: t, to: t + 1 });

/**
 * The shapes. `boot` is OEL (the player's origin lands 8 px right and down of it). `stage`: entities ADDED to the
 * vanilla room (`null`: the vanilla room). `switches`: the keys the model runs under for the comparison.
 *   blast-above        (b) L29, above turret@80,176 (centre 88,184) facing S: five shots, then the sixth at t169 and a
 *                      walk S from t170. The player is not overlapping the turret at the end of t176 (its contact at
 *                      t177 reads that) and is at (88, 174.7) at the end of the kill tick t178, 9.3 px from the blast
 *                      centre: in the square and in the disc. The model: `Player.hit(null, 4, p, 1)`.
 *   blast-above-late   (b) control: the walk a tick later — at the kill the player is in the square and OUTSIDE the
 *                      disc (10.75 px).
 *   blast-above-noshot (b) control: no sixth shot — the walk takes the turret's CONTACT instead (`hitPlayer`, force 3).
 *   blast-below        (b) L29, below turret@112,240 (centre 120,248) facing N: the same from the other side.
 */
export const WAND_KILL_BLAST_SHAPES = Object.freeze({
    'blast-above': { boot: { level: 29, x: 80, y: 156 }, ticks: 250, stage: null,
        inputs: [{ key: 'down', from: 0, to: 1 }, ...FIVE.map(press), press(169), { key: 'down', from: 170, to: 220 }] },
    'blast-above-late': { boot: { level: 29, x: 80, y: 156 }, ticks: 250, stage: null,
        inputs: [{ key: 'down', from: 0, to: 1 }, ...FIVE.map(press), press(169), { key: 'down', from: 171, to: 221 }] },
    'blast-above-noshot': { boot: { level: 29, x: 80, y: 156 }, ticks: 250, stage: null,
        inputs: [{ key: 'down', from: 0, to: 1 }, ...FIVE.map(press), { key: 'down', from: 170, to: 220 }] },
    'blast-below': { boot: { level: 29, x: 112, y: 260 }, ticks: 250, stage: null,
        inputs: [{ key: 'up', from: 0, to: 1 }, ...FIVE.map(press), press(169), { key: 'up', from: 170, to: 220 }] },
    ...Object.fromEntries([
        ['turret', { type: 'turret', x: 74, y: 182 }],
        ['sandtrap', { type: 'sandtrap', x: 74, y: 182, attrs: { tag: '30' } }],
        ['icetrap', { type: 'icetrap', x: 74, y: 182 }],
        ['lavatrap', { type: 'lavatrap', x: 74, y: 182 }],
        ['drill', { type: 'drill', x: 74, y: 182 }],
        ['wallflyer', { type: 'wallflyer', x: 74, y: 182 }],
    ].map(([k, e]) => [`second-${k}`, { boot: { level: 29, x: 80, y: 156 }, ticks: 250, stage: [e],
        inputs: [{ key: 'down', from: 0, to: 1 }, ...FIVE.map(press), press(164)] }])),
    // The stripped L38 (its teleporters and `lightalpha` only — waves 64-69's staging room): the open upper room.
    'chain-sandtrap': { boot: { level: 38, x: 96, y: 16 }, ticks: 440, strip: true,
        stage: [{ type: 'sandtrap', x: 96, y: 40, attrs: { tag: '25' } }, { type: 'sandtrap', x: 89, y: 47, attrs: { tag: '26' } },
            { type: 'sandtrap', x: 103, y: 47, attrs: { tag: '27' } }],
        inputs: [{ key: 'down', from: 0, to: 1 }, ...[4, 36, 68, 100].map(press),
            { key: 'left', from: 130, to: 170 }, { key: 'down', from: 170, to: 197 },
            { key: 'right', from: 222, to: 223 }, ...[226, 258, 290, 322, 354, 386].map(press)] },
    'wallflyer-rest': { boot: { level: 38, x: 23, y: 70 }, ticks: 240, strip: true,
        stage: [{ type: 'wallflyer', x: 24, y: 40 }, { type: 'sandtrap', x: 23, y: 40, attrs: { tag: '25' } }],
        inputs: [{ key: 'up', from: 0, to: 1 }, ...[4, 36, 68, 100, 132, 164].map(press)] },
});

/**
 * The switches a shape's model runs under: both wand keys and the trap bodies' key (L29 has no trap body), and for a
 * STAGED shape (a second body) `wandKillBlastBodies` — the key this wave adds (OFF: wave 71's refusal by name).
 */
export function wandKillBlastSwitches(name, extra = {}) {
    const w = WAND_KILL_BLAST_SHAPES[name];
    if (!w) throw new Error(`wandKillBlastSwitches: no shape "${name}"`);
    return { wandShotEnemyBodies: true, wandShotKill: true, wandShotTrapBodies: true,
        ...(w.stage ? { wandKillBlastBodies: true } : {}), ...extra };
}

/** The tape for one shape, as `parseTape` takes it (wave 71's seam, RNG and pins). */
export function wandKillBlastTape(name) {
    const w = WAND_KILL_BLAST_SHAPES[name];
    if (!w) throw new Error(`wandKillBlastTape: no shape "${name}"`);
    return {
        ...wandKillTape('turret-kill'),
        name: `wandkillblast-${name}`,
        description: `fidelity WANDKILLBLAST witness ${name} (probe-seedling-wandkillblast.mjs)`,
        boot: { ...w.boot }, tick_count: w.ticks, inputs: w.inputs.map((r) => ({ ...r })),
    };
}

/** The room's entities as a shape stages them: `strip` keeps only the teleporters and `lightalpha`; then `stage`. */
export function stagedEntities(entities, w) {
    const keep = w.strip ? entities.filter((e) => e.type === 'teleporter' || e.type === 'lightalpha') : entities;
    return [...keep, ...structuredClone(w.stage)];
}

/** The shape's level source: the atlas, with the shape's entities added to its room. */
export async function wandKillBlastLevelSource(name) {
    const w = WAND_KILL_BLAST_SHAPES[name];
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const atlas = atlasLevelSource();
    if (!w.stage) return atlas;
    return (n) => {
        const rec = atlas(n);
        return n !== w.boot.level ? rec : { ...rec, entities: stagedEntities(rec.entities, w) };
    };
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
    const vanilla = vanillaRecordSet(EMBED, MAP).set;
    const setFor = (name) => {
        const w = WAND_KILL_BLAST_SHAPES[name];
        if (!w.stage) return vanilla;
        return { ...vanilla, set_id: `${vanilla.set_id}-wkb-${name}`, rooms: vanilla.rooms.map((r) => (r.id !== w.boot.level ? r
            : { ...r, source: { record: { ...r.source.record, entities: stagedEntities(r.source.record.entities, w) } } })) };
    };
    console.log(`PAGE: ${PAGE} · delivered ${vanilla.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-wandkillblast.mjs', kind: 'browser' });
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
    const play = async (set, tape) => {
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
                frames.push({ t: m.tick ?? s.tick, stick: s.tick, level: s.level, hits: s.hits ?? null,
                    hitsTimer: s.hits_timer ?? null, rows: gameRowsOf(m) });
                return s.finished ? s : null;
            }, 10 * 60 * 1000, 10);
            return { status, mounted, frames };
        } finally {
            await page.close();
        }
    };
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    try {
        const only = arg('only', null)?.split(',');
        for (const name of Object.keys(WAND_KILL_BLAST_SHAPES)) {
            if (only && !only.includes(name)) continue;
            const set = setFor(name);
            const tape = parseTape(JSON.stringify(wandKillBlastTape(name)));
            const levelSource = await wandKillBlastLevelSource(name);
            const model = await modelWandKillSamples(tape, wandKillBlastSwitches(name), { levelSource });
            const g = await play(set, tape);
            const byTick = new Map();
            for (const f of g.frames) {
                if (Number.isInteger(f.t) && f.t >= 0 && f.t <= tape.tick_count && f.rows.player && !byTick.has(f.t)) {
                    byTick.set(f.t, f.stick === f.t ? f : { ...f, hits: null, hitsTimer: null });
                }
            }
            const samples = [...byTick.values()].sort((a, b) => a.t - b.t).filter((f) => f.t > 0 && f.level === tape.boot.level);
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
            }
            const firstHit = samples.find((f) => (f.hits ?? 0) > 0) ?? null;
            console.log(`ROW ${JSON.stringify({ name, set_id: set.set_id, mounted: g.mounted?.active, samples: samples.length,
                hits: g.status?.hits ?? null, firstHitSample: firstHit ? { t: firstHit.t, hits: firstHit.hits,
                    hitsTimer: firstHit.hitsTimer, player: firstHit.rows.player } : null,
                cleared: g.status?.persistence_cleared ?? null, modelError: model.error,
                modelKills: model.final?.kills ?? null, modelBlasts: model.final?.blasts ?? null,
                modelPlayerHits: model.final?.playerHits ?? null })}`);
            check(`${name}: the game ran on the staged set`, g.mounted?.active === set.set_id, `${g.mounted?.active}`);
            check(`${name}: the sample clock is the model's (shifts fitting every player x/y and shot: [${fits}], must be [0])`,
                fits.length === 1 && fits[0] === 0 && model.error === null, model.error ?? '');
            check(`${name}: every shot, body, spit and player hit is the model's at every sampled tick`,
                dis.length === 0, dis.slice(0, 8).join(' | '));
            if (RECORD && fits.length === 1 && fits[0] === 0 && dis.length === 0 && model.error === null) {
                const dir = join(MODULE, 'fixtures', 'wandkillblast-witness');
                mkdirSync(dir, { recursive: true });
                const out = {
                    name, page: PAGE, set_id: set.set_id, delivered_set: vanilla.set_id,
                    recordedBy: 'scripts/procgen/probe-seedling-wandkillblast.mjs --record',
                    note: 'the GAME\'s rows (`botMobiles()`: the player, every WandShot, the six classes\' bodies and every '
                        + 'TurretSpit; `botStatus()`\'s `hits`/`hits_timer` where read on the same tick) at each sampled '
                        + 'tick, and the persistence the run cleared at its end',
                    stage: WAND_KILL_BLAST_SHAPES[name].stage,
                    hits: g.status?.hits ?? null,
                    persistenceCleared: g.status?.persistence_cleared ?? null,
                    samples: samples.map((f) => ({ t: f.t, ...f.rows, hits: f.hits, hitsTimer: f.hitsTimer })),
                    tape: wandKillBlastTape(name),
                };
                writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(out)}\n`);
                console.log(`recorded fixtures/wandkillblast-witness/${name}.json — ${out.samples.length} sample(s)`);
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
