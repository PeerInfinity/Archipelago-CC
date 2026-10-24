/**
 * seedlingEffectSkin — G4's proof, in node, over the COMMITTED seedling
 * pack's manifest (no pixels):
 *
 *   1. ONE REAL TAPE PER FAMILY: committed fixture tapes through the model
 *      (`tapeRunner.runTape`) — the totem's shots and death blast with its
 *      white-out, the bomb pusher's bombs, a Bob and two spinners killed by a
 *      press, a walk through Dungeon 6 (the load fades, the heart pickup's
 *      ceremony text, `hitsMax` 3 → 4), a BobSoldier's two hits — and a key
 *      tape through the JS runtime standing in L61's rain. Each tick's ops for
 *      the tape's families are a golden line, and so is each HELD frame of a
 *      load fade (`h=`, as the page holds); a run of identical lines is one.
 *      ⚠ CHANGE DETECTORS recorded from this renderer. Re-record after a
 *      deliberate change: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   2. THE INDEPENDENT STRATUM: scales, frames, lifetimes, layouts and covers
 *      by hand from the AS3.
 *   3. ONE MUTANT PER FAMILY (`EFFECT_RULES`): each turns a golden red.
 *   4. THE ADAPTER reads the run and writes nothing.
 *   5. ⛔ STATE IDENTITY: each tape's observation stream, final state, ledgers
 *      and `stateLog` byte-identical with the adapter, the reducer, the hold
 *      and both op builders running every tick, and without.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { md5 } from './md5.js';
import { runTape as runFixtureTape } from './tapeRunner.js';
import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { ENEMY_COVERAGE } from './seedlingEnemySkin.js';
import { ROOM_BODY_COVERAGE } from './seedlingRoomBodySkin.js';
import { HAZARD_COVERAGE } from './seedlingHazardSkin.js';
import {
    EFFECT_COVERAGE, EFFECT_RULES, KEYS, PLACEHOLDER_FONT, effectOps, effectSkinView, formatEffectOp, holdEffectSkin, holdOwed,
    jiggleCam, measureText, primeEffectSkin, resolveFont, screenOps, stepEffectSkin,
} from './seedlingEffectSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/skin-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const GAME = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const ATLAS = loadAtlas();
const fixture = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures/tapes', `${name}.json`), 'utf8'));
const recordOf = (level) => ATLAS.levels[level] ?? null;

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

/**
 * THE TAPES. `world` is the art the golden keeps from `effectOps` (the tape's
 * family); `screen` keeps `screenOps` too. `want` is what the tape must
 * really reach (`tagsOf`).
 */
export const TAPES = Object.freeze([
    { name: 'totem-kill-L43', fixture: 'r6-totem-kill', world: [KEYS.explosion], screen: true,
        want: ['x:bossShotBlast', 'x:bossDeathBlast', 'whiteout', 'talk'] },
    { name: 'bombpusher-L40', fixture: 'l40button-l41-part0', world: [KEYS.explosion], screen: false, want: ['x:bomb'] },
    { name: 'slash-bob-L6', fixture: 'r9-l6-bob-press', world: [KEYS.slash], screen: false, want: ['s:chaser'] },
    { name: 'slash-spinner-L18', fixture: 'r8-l18-spinner-press', world: [KEYS.slash], screen: false, want: ['s:spinner'] },
    { name: 'walk-L59', fixture: 'r4-walk-6-health', world: [], screen: true, want: ['fade', 'talk', 'max:4'] },
    { name: 'hearts-L30', fixture: 'bobsoldier-sword', world: [], screen: true, want: ['hit:1', 'hit:2'] },
    // L61 (Dungeon6/2.oel, heaviness 100): standing still, out of both axes' reach (G3c's in-app row's stance)
    { name: 'rain-L61', level: 61, at: [104, 144], n: 240, world: [KEYS.droplet], screen: false, want: ['drop'] },
]);

function boot(level, [x, y], onStateChanged = () => {}) {
    const rt = createJsRuntime({ onStateChanged, log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    return rt;
}

/** Every ledger these families read, read once at the end (in both arms). */
const LEDGERS = ['bossBlasts', 'bombEvents', 'chaserKills', 'spinnerPressKills', 'playerHits', 'playerDeaths', 'transitions', 'deadFrameSpans'];
const ledgersOf = (run) => (run ? LEDGERS.map((n) => run[n]) : null);

/** Drive a tape; `each(tick, run)` after every tick. Returns what the state identity compares. */
function drive(tape, each = () => {}) {
    if (tape.fixture) {
        let last = null;
        const stream = [];
        const out = runFixtureTape(fixture(tape.fixture), {
            levelSource: atlasLevelSource(),
            onTick: (t, now, held, run) => { last = run; stream.push(JSON.stringify([t, run.level, now])); each(t, run); },
        });
        return { stream, end: JSON.stringify([out.ticks, out.final, ledgersOf(last)]), stateLog: '' };
    }
    const reports = [];
    const rt = boot(tape.level, tape.at, (n, v) => reports.push([n, v]));
    const stream = [];
    for (let i = 0; i < tape.n; i += 1) {
        rt.tick(new Set());
        stream.push(JSON.stringify([rt.ticks, rt.run?.level, rt.run?.state, rt.game.readState()]));
        each(rt.ticks, rt.run);
    }
    return { stream, end: JSON.stringify(ledgersOf(rt.run)), stateLog: JSON.stringify(reports) };
}

/** One row per tick, then one per HELD frame (the page's fade hold) — the view, the skin and both op lists. */
function runTape(tape, opts = {}) {
    const rows = [];
    let skin = null;
    const row = (tick, held, view) => rows.push({ tick, held, view, skin,
        ops: effectOps(view, art, { skin, ...opts }),
        screen: skin.cam ? screenOps(view, art, { skin, cam: skin.cam, ...opts }) : [] });
    drive(tape, (tick, run) => {
        const view = effectSkinView(run, { record: recordOf(run.level) });
        skin = stepEffectSkin(skin, view, tick, opts);
        row(tick, false, view);
        while (holdOwed(skin)) {
            skin = holdEffectSkin(skin, view, opts);
            row(tick, true, view);
        }
    });
    return rows;
}

/** Short tags per row, for the golden and the `want` list. */
function tagsOf(r) {
    const out = [];
    for (const e of r.skin.explosions) if (e.sprite.frame === 0 && e.sprite.index === 0 && e.sprite.timer === 0) out.push(`x:${e.source}`);
    for (const s of r.skin.slashes) out.push(`s:${s.kind}`);
    if (r.skin.droplets.length) out.push('drop');
    if (r.view.whiteOut) out.push('whiteout');
    if (r.view.dialogue) out.push(r.view.dialogue.currentCharacter > r.view.dialogue.text.length ? 'typed' : 'talk');
    if (r.held) out.push('fade');
    if (r.skin.hearts.hits) out.push(`hit:${r.skin.hearts.hits}`);
    out.push(`max:${r.skin.hearts.hitsMax}`);
    return out;
}

const toScreen = (o, cam) => (o.sheetRef ? { ...o, dx: o.dx - cam.x, dy: o.dy - cam.y }
    : { ...o, rect: { ...o.rect, x: o.rect.x - cam.x, y: o.rect.y - cam.y, right: o.rect.right - cam.x, bottom: o.rect.bottom - cam.y } });

/** The tape's families' ops only, and a run of identical lines as one `t=a..b` line. */
function goldenLines(rows, tape) {
    const keep = new Set(tape.world);
    const lines = [];
    let open = null;
    for (const r of rows) {
        const ops = r.ops.filter((o) => keep.has(o.key));
        // the overlays in SCREEN coordinates (the camera subtracted), so a scrolling camera is not a new line every tick
        const scr = tape.screen ? r.screen.map((o) => toScreen(o, r.skin.cam)) : [];
        const body = `[${[...new Set(tagsOf(r))].join(',')}] | ${ops.map(formatEffectOp).join(' ; ')}${scr.length ? ` || ${scr.map(formatEffectOp).join(' ; ')}` : ''}`.trimEnd();
        const p = r.held ? 'h' : 't';
        if (open && open.body === body && open.p === p) { open.to = r.tick; continue; }
        if (open) lines.push(open);
        open = { p, from: r.tick, to: r.tick, body };
    }
    if (open) lines.push(open);
    return lines.map((l) => `${l.p}=${l.from}${l.to !== l.from ? `..${l.to}` : ''} ${l.body}`);
}

function golden(name, lines) {
    const path = join(GOLDENS, name);
    if (process.env.UPDATE_SKIN_GOLDENS) {
        mkdirSync(GOLDENS, { recursive: true });
        writeFileSync(path, `${lines.join('\n')}\n`);
    }
    expect(existsSync(path), `${path} — record it with UPDATE_SKIN_GOLDENS=1`).toBe(true);
    return readFileSync(path, 'utf8').trimEnd().split('\n');
}

const tapeRows = new Map();
const rowsOf = (tape) => {
    if (!tapeRows.has(tape.name)) tapeRows.set(tape.name, runTape(tape));
    return tapeRows.get(tape.name);
};

describe('1. golden effect ops (frame CHOICE, not pixels)', () => {
    for (const tape of TAPES) {
        it(`the ${tape.name} tape: every tick's (and held frame's) ops`, () => {
            const rows = rowsOf(tape);
            const lines = goldenLines(rows, tape);
            expect(lines).toEqual(golden(`effect-${tape.name}.txt`, lines));
            const seen = new Set(rows.flatMap(tagsOf));
            for (const w of tape.want) expect(seen, `${tape.name}: ${w}`).toContain(w);
            const ops = rows.flatMap((r) => r.ops).filter((o) => tape.world.includes(o.key));
            if (tape.world.length) {
                expect(ops.length, `${tape.name}: it drew`).toBeGreaterThan(0);
                expect(ops.every((o) => o.sheetRef), `${tape.name}: every effect has art (no rectangle)`).toBe(true);
            }
        }, 240_000);
    }

    it('the coverage table: G4\'s keys reached the pack, and nothing G1–G3c drew is counted again', () => {
        for (const k of [KEYS.explosion, KEYS.slash, KEYS.droplet, KEYS.heart]) expect(art.has(k), k).toBe(true);
        expect(art.has(KEYS.font), 'the seedling pack names the authored font (G4b)').toBe(true);
        const before = new Set([...ENEMY_COVERAGE.drawn, ...ROOM_BODY_COVERAGE.drawn, ...HAZARD_COVERAGE.drawn]);
        for (const c of EFFECT_COVERAGE.drawn) expect(before.has(c), c).toBe(false);
        expect(EFFECT_COVERAGE.modelled).toEqual([]);
    });
});

// ── synthetic views ───────────────────────────────────────────────────────
const RUN = {};
const V = (over = {}) => ({
    epoch: { run: RUN, key: 'syn' }, level: 61, room: { width: 160, height: 320 }, player: { x: 80, y: 80 },
    blasts: [], bombBlasts: [], slashKills: [], chasers: [], spinners: [], whiteOut: null, hits: 0, hitsMax: 3, lastHit: null,
    deaths: 0, loadSpans: [], dialogue: null, cutscene0: false, camera: { cam: { x: 0, y: 0 }, band: null }, rain: null, world: null,
    ...over,
});
function stepAll(views, opts = {}) {
    let skin = null;
    return views.map((view, i) => {
        skin = stepEffectSkin(skin, view, 100 + i, opts);
        return { view, skin, ops: effectOps(view, art, { skin }), screen: screenOps(view, art, { skin, cam: skin.cam }) };
    });
}
const blast = (source, t, x = 80, y = 100) => ({ t, level: 61, id: `b${t}`, x, y, source });

describe('2. the independent stratum (by hand from the AS3)', () => {
    it('an explosion (Explosion.as:26-39): scale r·2/128 (shot 24 → 0.375, the totem 80 → 1.25), frames 0..7 at fps 20, gone at the anim\'s end; layer −FP.height', () => {
        const views = Array.from({ length: 15 }, () => V({ blasts: [blast('bossShotBlast', 5)] }));
        views[0] = V();                                                        // the blast lands on the second tick
        const rows = stepAll(views);
        const ex = rows.map((r) => r.ops.filter((o) => o.key === KEYS.explosion));
        expect(ex[0]).toEqual([]);
        // fps 20 × 0.0333 = 0.666 a tick (Spritemap's `_timer`): frame 0 on its first render (no update yet), then the
        // timer .666, 1.332→1 (.332), .998, 1.664→2, 1.33→3, .996, 1.662→4, 1.328→5, .994, 1.66→6, 1.326→7, .992, and
        // 1.658 → index 8 = the end: `endAnim` removes it — 13 renders
        expect(ex.slice(1).map((o) => o[0]?.frame ?? null)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 5, 5, 6, 7, 7, null]);
        expect(ex[1][0].scaleX).toBe(0.375);
        expect(ex[1][0].layer).toBe(-320);
        expect([ex[1][0].pivotX, ex[1][0].pivotY, ex[1][0].dx, ex[1][0].dy]).toEqual([64, 64, 16, 36]);
        expect(EFFECT_RULES.explosionPose(blast('bossDeathBlast', 1), V()).scale).toBe(1.25);
        expect(EFFECT_RULES.explosionPose(blast('bomb', 1), V()).scale).toBe(0.375);
        // the angle is the cosmetic stream, a stable band: the same blast, the same angle; another blast, another
        const a = EFFECT_RULES.explosionPose(blast('bomb', 1), V()).angle;
        expect(EFFECT_RULES.explosionPose(blast('bomb', 1), V()).angle).toBe(a);
        expect(EFFECT_RULES.explosionPose(blast('bomb', 2), V()).angle).not.toBe(a);
    });

    it('a blast from another level, or one counted before, is not drawn twice', () => {
        const rows = stepAll([V({ blasts: [blast('bomb', 1)] }), V({ blasts: [blast('bomb', 1), { ...blast('bomb', 2), level: 60 }] })]);
        // the first view STARTS the run: the blast already on the ledger is counted, not spawned
        expect(rows.map((r) => r.skin.explosions.length)).toEqual([0, 0]);
    });

    it('a slash hit (Enemy.as:189-203, SlashHit.as:19-23): at the dying body, scale sc/32 + 0.35 (a Bob 8 → 0.6, a spinner 18 → 0.9125), frames [0,1] at fps 15, layer −(y + 24)', () => {
        const bob = { id: 'bob@1', tag: 'bob', x: 50, y: 60 };
        const kill = { t: 9, level: 61, id: 'bob@1', kind: 'chaser' };
        const rows = stepAll([V({ chasers: [bob] }), ...Array.from({ length: 6 }, () => V({ chasers: [bob], slashKills: [kill] }))]);
        const sl = rows.map((r) => r.ops.filter((o) => o.key === KEYS.slash)[0] ?? null);
        // fps 15 × 0.0333 = 0.4995: .4995, .999, 1.4985→1, .998, 1.4975 → the end — 5 renders
        expect(sl.map((o) => o?.frame ?? null)).toEqual([null, 0, 0, 0, 1, 1, null]);
        expect(sl[1].scaleX).toBeCloseTo(0.6, 12);
        expect(sl[1].layer).toBe(-84);
        expect(EFFECT_RULES.slashScale({ kind: 'spinner' }, {})).toBeCloseTo(0.9125, 12);
    });

    it('rain (Game.as:1034-1043): heaviness 100 spawns every frame, 75 one frame in 25; the rect ∩ the screen; disjoint → (0, 0)', () => {
        const rain = (heaviness, rect = { x: 0, y: 0, w: 480, h: 320 }) => ({ heaviness, rect, height: 48, colour: '#882266' });
        const cam = { x: 160, y: 80 };
        let n100 = 0;
        let n75 = 0;
        for (let f = 0; f < 2500; f += 1) {
            const s = EFFECT_RULES.rainSpawn(rain(100), cam, 61, f);
            if (s) { n100 += 1; expect(s.x >= 160 && s.x < 320 && s.y >= 80 && s.y < 240, JSON.stringify(s)).toBe(true); }
            if (EFFECT_RULES.rainSpawn(rain(75), cam, 61, f)) n75 += 1;
        }
        expect(n100).toBe(2500);
        expect(n75).toBeGreaterThan(60);
        expect(n75).toBeLessThan(140);
        expect(EFFECT_RULES.rainSpawn(rain(100, { x: 0, y: 0, w: 100, h: 100 }), { x: 200, y: 200 }, 61, 3)).toEqual({ x: 0, y: 0 });
    });

    it('a droplet (Droplet.as:25-89): 48 px above its row, a pit / a Solid / no tile removes it, a cliff pushes it a tile down; v 1 + 0.1 a frame; six landed frames at 0.6', () => {
        const tiles = [{ tx: 1, ty: 1, t: 1 }, { tx: 2, ty: 1, t: 6 }, { tx: 3, ty: 1, t: 9 }, { tx: 3, ty: 2, t: 1 }, { tx: 4, ty: 1, t: 1 }];
        const world = { tiles, solids: [{ rect: { x: 64, y: 16, right: 80, bottom: 32 } }], objectSolids: [] };
        const rain = { height: 48, colour: '#882266' };
        expect(EFFECT_RULES.makeDroplet({ x: 24, y: 20 }, rain, world)).toMatchObject({ y: -28, startY: -28, endY: 20 });
        expect(EFFECT_RULES.makeDroplet({ x: 40, y: 20 }, rain, world)).toBe(null);          // a pit
        expect(EFFECT_RULES.makeDroplet({ x: 72, y: 20 }, rain, world)).toBe(null);          // a Solid
        expect(EFFECT_RULES.makeDroplet({ x: 200, y: 20 }, rain, world)).toBe(null);         // no tile
        expect(EFFECT_RULES.makeDroplet({ x: 56, y: 20 }, rain, world).endY).toBe(36);       // a cliff: one tile further
        let d = EFFECT_RULES.makeDroplet({ x: 24, y: 20 }, rain, world);
        const ys = [];
        let landed = 0;
        for (let i = 0; i < 60 && d; i += 1) {
            d = EFFECT_RULES.dropletStep(d);
            if (d) { ys.push(d.y); if (d.y === 20) landed += 1; }
        }
        expect(ys.slice(0, 3).map((y) => +y.toFixed(6))).toEqual([-26.9, -25.7, -24.4]);
        // ten landed frames, not nine: 0.6 summed ten times is 5.999999999999999 (< 6) in IEEE doubles — AS3's
        // `Number` too — so the eleventh update (6.6) is the one that removes it
        expect(landed).toBe(10);
    });

    it('a droplet\'s picture (Droplet.as:92-101): alpha by its fall × the player\'s fall-off once it has updated; int(frame); tinted; layer −startY', () => {
        const d = { x: 80, y: 0, startY: -24, endY: 24, vy: 2, frame: 1.8, updated: true, colour: '#882266' };
        const skin = { explosions: [], slashes: [], droplets: [d] };
        const [op] = effectOps(V({ player: { x: 80, y: 40 } }), art, { skin });
        expect(op.alpha).toBeCloseTo(0.5 * 0.5, 12);
        expect([op.frame, op.tint, op.layer]).toEqual([1, '#882266', 24]);
        expect(effectOps(V(), art, { skin: { ...skin, droplets: [{ ...d, y: -24 }] } })).toEqual([]);   // alpha 0: nothing
    });

    it('the hearts (Game.as:1531-1546): healthc = hitsMax − int(hits) − 1; heart i at (148 − (i%2)·11, int(i/2)·11) of the camera; frame int(i > healthc)', () => {
        const rows = stepAll([V({ hits: 0, hitsMax: 4 }), V({ hits: 1.5, hitsMax: 4 }), V({ hits: 3, hitsMax: 3, camera: { cam: { x: 32, y: 48 } } })]);
        const hearts = (r) => r.screen.filter((o) => o.key === KEYS.heart).map((o) => [o.frame, o.dx, o.dy]);
        expect(hearts(rows[0])).toEqual([[0, 148, 0], [0, 137, 0], [0, 148, 11], [0, 137, 11]]);
        expect(hearts(rows[1])).toEqual([[0, 148, 0], [0, 137, 0], [0, 148, 11], [1, 137, 11]]);
        expect(hearts(rows[2])).toEqual([[1, 180, 48], [1, 169, 48], [1, 180, 59]]);
    });

    it('the hearts after a death: the swapped world has updated no player, so they show the killing hit\'s row', () => {
        const views = [V({ hits: 2 }), V({ epoch: { run: RUN, key: 'after' }, deaths: 1, hits: 0, lastHit: { t: 101, hits: 3, hitsMax: 3 } }),
            V({ epoch: { run: RUN, key: 'after' }, deaths: 1, hits: 0 })];
        expect(stepAll(views).map((r) => r.skin.hearts.hits)).toEqual([2, 3, 0]);
    });

    it('the fade (Game.as:1843-1852, pinned): a build\'s 20 dead frames show 0.95 … 0.05 and then ~0; the swapped world before its first is 1', () => {
        const covers = EFFECT_RULES.fadeCovers(20);
        expect(covers.slice(0, 3).map((c) => +c.toFixed(12))).toEqual([0.95, 0.9, 0.85]);
        expect(+covers[18].toFixed(12)).toBe(0.05);
        expect(covers[19]).toBeLessThan(1e-9);
        let skin = stepEffectSkin(null, V(), 1);
        skin = stepEffectSkin(skin, V({ epoch: { run: RUN, key: 'next' }, loadSpans: [20] }), 2);
        expect(holdOwed(skin)).toBe(true);
        const fades = (s) => screenOps(V(), art, { skin: s, cam: { x: 0, y: 0 } }).filter((o) => o.colour === '#000000' && o.rect.w === 160 && o.rect.h === 160);
        expect(fades(skin).map((o) => o.alpha)).toEqual([1]);
        const seen = [];
        while (holdOwed(skin)) { skin = holdEffectSkin(skin, V()); seen.push(fades(skin)[0]?.alpha ?? 0); }
        expect(seen).toHaveLength(20);
        expect(seen[0]).toBe(0.95);
        skin = stepEffectSkin(skin, V({ epoch: { run: RUN, key: 'next' }, loadSpans: [20] }), 3);
        expect(fades(skin)).toEqual([]);                                     // the first live tick: the gate was open
    });

    it('the hold adds a drop each dead frame (the rain is outside the gate) and moves none', () => {
        const world = { tiles: [{ tx: 5, ty: 5, t: 1 }], solids: [], objectSolids: [] };
        const rain = { heaviness: 100, rect: { x: 80, y: 80, w: 16, h: 16 }, height: 48, colour: '#882266' };
        let skin = primeEffectSkin(V({ rain, world, loadSpans: [20] }));
        expect([skin.droplets.length, skin.fadeQueue.length]).toEqual([0, 20]);
        for (let i = 0; i < 20; i += 1) skin = holdEffectSkin(skin, V({ rain, world }));
        expect(skin.droplets.length).toBe(20);
        expect(skin.droplets.every((d) => d.y === d.startY && !d.updated)).toBe(true);
    });

    it('the white-out (BossTotem.as:577-580): white at rumblingTime/240·2, clamped at 1', () => {
        expect(EFFECT_RULES.whiteOutAlpha({ sinceActivation: 900, renders: 1 })).toBeCloseTo(2 / 240, 12);
        expect(EFFECT_RULES.whiteOutAlpha({ sinceActivation: 900, renders: 60 })).toBe(0.5);
        expect(EFFECT_RULES.whiteOutAlpha({ sinceActivation: 900, renders: 200 })).toBe(1);
        const [r] = stepAll([V({ whiteOut: { sinceActivation: 900, renders: 60 } })]);
        expect(r.screen.filter((o) => o.colour === '#ffffff' && o.rect.w === 160).map((o) => o.alpha)).toEqual([0.5]);
    });

    it('the talk bars (Game.as:1677-1758): Draw.rect\'s ints 0..26 and 133..160 at 0.8; the text typed to currentCharacter, CENTERED; <X> only once typed out and not in cutscene[0]', () => {
        const text = 'You got a heart!';
        const rows = stepAll([
            V({ dialogue: { text, currentCharacter: 5 } }),
            V({ dialogue: { text, currentCharacter: text.length + 1 } }),
            V({ dialogue: { text, currentCharacter: text.length + 1 }, cutscene0: true }),
        ]);
        const bars = rows[0].screen.filter((o) => o.alpha === 0.8);
        expect(bars.map((o) => [o.rect.x, o.rect.y, o.rect.w, o.rect.h])).toEqual([[0, 0, 160, 26], [0, 133, 160, 27]]);
        // the authored font (G4b): white glyphs, the black outline copies TINTED (`Text.color` is a multiplying `Image.color`)
        expect(resolveFont(art)).toEqual({ id: KEYS.font, advance: 4, lineHeight: 8, gutter: 4, sprite: true });
        const glyphs = (r, tint = undefined) => r.screen.filter((o) => o.glyph !== undefined && o.tint === tint);
        expect(glyphs(rows[0]).map((o) => String.fromCharCode(o.glyph)).join('')).toBe('Youg');                // 'You g' typed; a space draws nothing
        // CENTER: alignOffsetX = int((160 − 8 − t.width) / 2), t.width = 5·4 + 4; y = int(160·5.5/6 − (8 + 4)/2 + 1) = 141; the 2 px gutter inside
        const m = measureText('You g', resolveFont(art));
        expect([m.w, m.h]).toEqual([24, 12]);
        const [Y] = glyphs(rows[0]);
        expect([Y.dx, Y.dy]).toEqual([8 + Math.trunc((160 - 8 - 24) / 2) + 2, 141 + 2]);
        // frame = code − 32: 'Y' (89) is frame 57, column 57 mod 16 = 9, row 3 of the 16-wide sheet
        expect([Y.frame, Y.sx, Y.sy, Y.sw, Y.sh]).toEqual([57, 36, 24, 4, 8]);
        const prompt = (r, tint) => r.screen.filter((o) => o.glyph === '<'.charCodeAt(0) && o.tint === tint);
        expect(prompt(rows[0])).toEqual([]);
        // four black outline copies at ±1 px (Game.as:1760-1774), then the white one; <X> at (160 − w, 160 − 26 − h/2)
        const white = prompt(rows[1]);
        expect(white.map((o) => [o.dx, o.dy])).toEqual([[160 - 16 + 2, Math.floor(160 - 26 - 6) + 2]]);
        expect(prompt(rows[1], '#000000').map((o) => [o.dx - white[0].dx, o.dy - white[0].dy])).toEqual([[-1, 0], [1, 0], [0, -1], [0, 1]]);
        expect(prompt(rows[2])).toEqual([]);
        // the placeholder still stands in for a stack without a font: the same box, drawn as rectangles
        expect(resolveFont({ has: () => false })).toBe(PLACEHOLDER_FONT);
        const boxes = screenOps(V({ dialogue: { text, currentCharacter: 5 } }), art, { skin: rows[0].skin, cam: { x: 0, y: 0 }, font: PLACEHOLDER_FONT })
            .filter((o) => o.glyph !== undefined);
        expect(boxes.map((o) => o.rect.x)).toEqual([74, 78, 82, 90]);
    });

    it('the camera (Game.as:1966-2010): exact when the model has a point; in a shake band a jiggle inside it (the cosmetic stream), or the middle', () => {
        expect(jiggleCam({ cam: { x: 10, y: 20 }, band: null }, 5, 9)).toEqual({ x: 10, y: 20 });
        const band = { cam: null, band: { x: { lo: 10, hi: 15 }, y: { lo: 40, hi: 40 } } };
        expect(jiggleCam(band, 5, 9, { jiggle: false })).toEqual({ x: 13, y: 40 });
        const xs = new Set();
        for (let t = 0; t < 200; t += 1) {
            const c = jiggleCam(band, 5, t);
            expect(c.x >= 10 && c.x <= 15 && c.y === 40).toBe(true);
            xs.add(c.x);
        }
        expect(xs.size).toBeGreaterThan(3);
        expect(jiggleCam(null, 5, 9)).toBe(null);
    });

    it('the rain row (Game.as:2266-2274): −1 is the room\'s size, the colour is AS3 uint(String) (L65\'s "0882266" is decimal)', () => {
        const run = (level) => ({ level, state: { x: 0, y: 0 }, world: { world: { width: 320, height: 480 } } });
        expect(effectSkinView(run(61), { record: recordOf(61) }).rain).toEqual({ heaviness: 100, rect: { x: 0, y: 0, w: 320, h: 480 }, height: 48, colour: '#882266' });
        expect(effectSkinView(run(65), { record: recordOf(65) }).rain.colour).toBe(`#${(882266).toString(16).padStart(6, '0')}`);
        expect(effectSkinView(run(95), { record: recordOf(95) }).rain.rect.w).toBe(480);
        expect(effectSkinView(run(58), { record: recordOf(58) }).rain.heaviness).toBe(75);
        expect(effectSkinView(run(10), { record: recordOf(10) }).rain).toBe(null);
    });
});

describe('3. one mutant per family turns a golden red', () => {
    const T = Object.fromEntries(TAPES.map((t) => [t.name, t]));
    const differs = (tape, opts) => {
        const want = readFileSync(join(GOLDENS, `effect-${tape.name}.txt`), 'utf8').trimEnd().split('\n');
        const got = goldenLines(runTape(tape, opts), tape);
        return got.filter((l, i) => l !== want[i]).length + Math.abs(got.length - want.length);
    };
    const MUTANTS = [
        ['Explosion — explosionPose: never scaled', 'totem-kill-L43', { rules: { explosionPose: (b, v) => ({ ...EFFECT_RULES.explosionPose(b, v), scale: 1 }) } }],
        ['Explosion — updateSprite: twice the fps', 'bombpusher-L40', { rules: { updateSprite: (sp, a, e) => EFFECT_RULES.updateSprite(sp, a, e, 2) } }],
        // the slash's whole footprint in its golden is four lines (two kills × frames 0 and 1): the mutant must move all four
        ['SlashHit — slashScale: without the + 0.35', 'slash-spinner-L18', { rules: { slashScale: (k, b) => EFFECT_RULES.slashScale(k, b) - 0.35 } }, 3],
        ['Droplet — dropletStep: no gravity', 'rain-L61', { rules: { dropletStep: (d) => EFFECT_RULES.dropletStep({ ...d, vy: d.vy - 0.1 }) } }],
        ['Rain — rainSpawn: the whole rain rect, not the screen', 'rain-L61', { rules: { rainSpawn: (r, cam, l, f) => EFFECT_RULES.rainSpawn(r, { x: 0, y: 0, w: 1e4 }, l, f) } }],
        ['White-out — whiteOutAlpha: without the ×2', 'totem-kill-L43', { rules: { whiteOutAlpha: (w) => EFFECT_RULES.whiteOutAlpha(w) / 2 } }],
        ['Hearts — heartsSample: one hit too many', 'hearts-L30', { rules: { heartsSample: (...a) => { const s = EFFECT_RULES.heartsSample(...a); return { ...s, hits: s.hits + 1 }; } } }],
        ['Fade — fadeCovers: the first dead frame unstepped', 'walk-L59', { rules: { fadeCovers: (n) => [1, ...EFFECT_RULES.fadeCovers(n - 1)] } }],
        ['Talk — typedText: the whole page at once', 'totem-kill-L43', { rules: { typedText: (d) => d.text } }],
        ['Font — glyphFrame: one frame off (a wrong glyph)', 'totem-kill-L43', { rules: { glyphFrame: (code) => EFFECT_RULES.glyphFrame(code) + 1 } }],
    ];
    for (const [name, tape, opts, over = 5] of MUTANTS) it(name, () => expect(differs(T[tape], opts)).toBeGreaterThan(over), 240_000);
});

describe('4. the adapter reads the run and writes nothing', () => {
    const frozen = (o) => new Proxy(o, { set: () => { throw new Error('effectSkinView wrote to the run'); }, defineProperty: () => { throw new Error('effectSkinView defined on the run'); } });

    it('maps every family; a write anywhere throws', () => {
        const run = frozen({
            level: 43, transitions: [], playerDeaths: [], state: frozen({ x: 1, y: 2 }),
            world: frozen({ world: frozen({ width: 320, height: 480 }), bossTotems: [frozen({ id: 'bt' })], tiles: [] }),
            bossBlasts: [frozen({ t: 3, level: 43, source: 'bossShotBlast', id: 's1', x: 10, y: 20, radius: 15 })],
            bombEvents: [frozen({ t: 4, level: 43, what: 'explode', id: 'b', at: frozen({ x: 1, y: 1 }) }), frozen({ t: 4, level: 43, what: 'blast', id: 'b', at: frozen({ x: 5, y: 6 }) })],
            chaserKills: [frozen({ t: 5, level: 43, id: 'bob@1', by: 'press', weapon: 'sword' }), frozen({ t: 6, level: 43, id: 'bob@2', by: 'arrow' })],
            spinnerPressKills: [frozen({ t: 7, level: 43, id: 'sp', weapon: 'spear' }), frozen({ t: 8, level: 43, id: 'sp2', weapon: 'bomb' })],
            chasers: [frozen({ id: 'bob@1', tag: 'bob', x: 3, y: 4 })], spinnerBodies: [frozen({ id: 'sp', x: 7, y: 8 })],
            bossesWoken: [frozen({ destroy: true, removed: false, sinceActivation: 800, whiteOutRenders: 12 })],
            damage: frozen({ hits: 1 }), inventory: frozen({ hitsMax: 4 }), playerHits: [frozen({ t: 2, hits: 1, hitsMax: 4 })],
            deadFrameSpans: [frozen({ kind: 'load', frames: 20 }), frozen({ kind: 'ceremony', frames: 150 })],
            ceremonyNow: frozen({ dialogue: frozen({ text: 'Hi', currentCharacter: 1, done: false }) }), cutscene: [false],
            cameraNow: frozen({ cam: frozen({ x: 0, y: 160 }), band: null }),
        });
        const v = effectSkinView(run, { record: frozen({ entities: [frozen({ type: 'droplet', x: 0, y: 0, attrs: frozen({ heaviness: '100', startheight: '48', color: '0x882266', width: '-1', height: '-1' }) })] }) });
        expect(v.epoch).toEqual({ run, key: '43|0|0' });
        expect(v.blasts).toEqual([{ t: 3, level: 43, id: 's1', x: 10, y: 20, source: 'bossShotBlast' }]);
        expect(v.bombBlasts).toEqual([{ t: 4, level: 43, id: 'b', x: 5, y: 6, source: 'bomb' }]);
        expect(v.slashKills).toEqual([{ t: 5, level: 43, id: 'bob@1', kind: 'chaser' }, { t: 7, level: 43, id: 'sp', kind: 'spinner' }]);
        expect(v.whiteOut).toEqual({ sinceActivation: 800, renders: 12 });
        expect([v.hits, v.hitsMax, v.loadSpans, v.dialogue]).toEqual([1, 4, [20], { text: 'Hi', currentCharacter: 1 }]);
        expect(v.rain).toEqual({ heaviness: 100, rect: { x: 0, y: 0, w: 320, h: 480 }, height: 48, colour: '#882266' });
        expect(effectSkinView(null)).toBe(null);
    });
});

describe('5. ⛔ STATE IDENTITY — the effect renderer never touches the run', () => {
    for (const tape of TAPES) {
        it(`${tape.name}: the stream, the end state, the ledgers and the stateLog byte-identical with the renderer on and off`, () => {
            const off = drive(tape);
            let drawn = 0;
            let skin = null;
            const on = drive(tape, (tick, run) => {
                const view = effectSkinView(run, { record: recordOf(run.level) });
                skin = stepEffectSkin(skin, view, tick);
                while (holdOwed(skin)) skin = holdEffectSkin(skin, view);
                drawn += effectOps(view, art, { skin }).length + (skin.cam ? screenOps(view, art, { skin, cam: skin.cam }).length : 0);
            });
            expect(drawn).toBeGreaterThan(0);
            expect(md5(on.stream.join('\n'))).toBe(md5(off.stream.join('\n')));
            expect(md5(on.end)).toBe(md5(off.end));
            expect(md5(on.stateLog)).toBe(md5(off.stateLog));
        }, 240_000);
    }
});
