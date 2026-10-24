/**
 * seedlingNightSkin — G5's proof, in node, over the COMMITTED seedling pack's
 * manifest (no pixels; `seedlingTileLayer.test.js`'s compositing model and the
 * in-app row carry the canvas half):
 *
 *   1. ONE REAL TAPE PER FAMILY: committed fixture tapes through the model
 *      (`tapeRunner.runTape`) — the crusher room with the torch light
 *      following the player, the Boss Totem's laser, parts and white-out, the
 *      Dungeon 6 walk's grenade lights and bone torches — and JS-runtime
 *      stand-stills in the lava room (its glow and its edges), the light-pole
 *      rooms (unlit: the `darkLight` circles on the screen; lit), and the light
 *      ray room. Each tick is a golden line: the composite's alpha, the counts,
 *      and an md5 of every night / solid / main op; the first tick of each
 *      visit prints the ops in full. A run of identical
 *      lines is one. ⚠ CHANGE DETECTORS recorded from this renderer.
 *      Re-record after a deliberate change: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   2. THE INDEPENDENT STRATUM: the composite's alpha, the day's ramp, the
 *      radii, the colour lerp, the follow step, the lanes and the copies by
 *      hand from the AS3.
 *   3. ONE MUTANT PER RULE (`NIGHT_RULES`): each turns a golden red.
 *   4. THE ADAPTER reads the run and writes nothing.
 *   6. THE NIGHT CANVAS CACHE (`paintNight`): redrawn only when a field of an op changes, the solid canvas on its
 *      own signature, the composite every paint — on a recording fake canvas.
 *   5. ⛔ STATE IDENTITY: each tape's observation stream, final state,
 *      ledgers and `stateLog` byte-identical with the adapter, the reducer
 *      and the ops running every tick, and without; and (fidelity-12's
 *      clearance, 2026-10-24) on a pole level `stateDigest()` and the clears
 *      equal with and without a `lightPolesNow` read, before the first tick
 *      and right after a level entry.
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
import { withContactFidelity } from './contactFidelity.js';
import { createNightLayer, paintNight, roomOps } from './seedlingSkinRenderer.js';
import { hazardOps, hazardSkinView, stepHazardSkin, HAZARD_OBJECT_TAGS } from './seedlingHazardSkin.js';
import { EFFECT_RULES, effectOps, effectSkinView, stepEffectSkin } from './seedlingEffectSkin.js';
import {
    LIGHT_POSITION, NIGHT, NIGHT_COPIES, NIGHT_COVERAGE, NIGHT_RULES, PLAYER_LIGHT, TILE_NIGHT, as3Colour, colorLerp, crusherLanes,
    dayLightAlpha, formatNightOp, lightCircles, lightLayer, lightRadius, nightAlpha, nightLevel, nightMainOps, nightOps, nightSkinView,
    playerLightColour, recordLights, stepNightSkin,
} from './seedlingNightSkin.js';

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
 * THE TAPES. `fixture` names a committed tape (run through the model);
 * otherwise `level`/`at`/`n` stand the JS runtime still. `want` is what the
 * tape must really reach (`tagsOf`).
 */
export const TAPES = Object.freeze([
    // L42 (lightalpha 0.1), the tape holds hasTorch: the PlayerLight, the torch, the crusher's copy and lanes
    { name: 'night-crusher-L42', fixture: 'crusher-l42-round-trip', want: ['dark', 'playerLight', 'lane', 'copy:seedling:puzzlement/crusher'] },
    // L43 (0.2): the totem's SCREENed parts, its laser, the shots, the explosions and the white-out rect
    { name: 'night-totem-L43', fixture: 'r6-totem-kill', want: ['dark', 'laser', 'screen', 'whiteout', 'copy:seedling:fx/explosion', 'copy:seedling:projectile/bosstotemshot'] },
    // the Dungeon 6 walk: bone torches, orbs, the grenade light
    { name: 'night-walk-L59', fixture: 'r4-walk-6-health', want: ['dark', 'grenadeLight', 'circle'] },
    // L76 (0.1): the lava's glow and edges, igneous, the chain's "hit" copy (igneousLava pinned OFF, G3c's chain-L76 stance)
    { name: 'night-lava-L76', level: 76, at: [152, 92], n: 200, fidelity: { igneousLava: false },
        want: ['dark', 'solid', 'copy:seedling:tile/lava', 'copy:seedling:puzzlement/lavachain'] },
    // L63 (0.05): three UNLIT poles (their darkLight on the screen), two plant torches, the ghost tiles
    { name: 'night-poles-L63', level: 63, at: [72, 120], n: 120, want: ['dark', 'darkLight', 'copy:seedling:tile/ghostTile'] },
    // L74 (0.1): an inverted pole, LIT at boot; the lava runners
    { name: 'night-pole-lit-L74', level: 74, at: [40, 40], n: 120, want: ['dark', 'poleLit'] },
    // L49 (0.1): a light ray (its night shaft + its two screen rects) and shadows
    { name: 'night-ray-L49', level: 49, at: [72, 72], n: 60, want: ['dark', 'ray', 'shadow'] },
]);

function boot(level, [x, y], onStateChanged = () => {}) {
    const rt = createJsRuntime({ onStateChanged, log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    return rt;
}

const LEDGERS = ['crusherContacts', 'bombEvents', 'placedGrenadeEvents', 'playerHits', 'playerDeaths', 'transitions', 'earnedClears'];
const ledgersOf = (run) => (run ? LEDGERS.map((n) => {
    const v = run[n];
    return v instanceof Map ? [...v] : v;
}) : null);

/** Drive a tape; `each(tick, run)` after every tick. Returns what the state identity compares. */
function drive(tape, each = () => {}) {
    return withContactFidelity(tape.fidelity ?? {}, () => {
        if (tape.fixture) {
            let last = null;
            const stream = [];
            const out = runFixtureTape(fixture(tape.fixture), {
                levelSource: atlasLevelSource(),
                onTick: (t, now, held, run) => { last = run; stream.push(JSON.stringify([t, run.level, now])); each(t, run); },
            });
            return { stream, end: JSON.stringify([out.ticks, out.final, ledgersOf(last), last?.stateDigest?.()]), stateLog: '' };
        }
        const reports = [];
        const rt = boot(tape.level, tape.at, (n, v) => reports.push([n, v]));
        const stream = [];
        for (let i = 0; i < tape.n; i += 1) {
            rt.tick(new Set());
            stream.push(JSON.stringify([rt.ticks, rt.run?.level, rt.run?.state, rt.game.readState()]));
            each(rt.ticks, rt.run);
        }
        return { stream, end: JSON.stringify([ledgersOf(rt.run), rt.run?.stateDigest?.()]), stateLog: JSON.stringify(reports) };
    });
}

const CAM = (run) => {
    const c = run.cameraNow?.cam;
    return c ? { x: c.x, y: c.y, w: 160, h: 160 } : { x: 0, y: 0, w: 160, h: 160 };
};

/** One row per tick: the views, the skins, the room's ops and the night frame — as the page builds them. */
function runTape(tape, { rules } = {}) {
    const rows = [];
    let skin = null;
    let hskin = null;
    let eskin = null;
    drive(tape, (tick, run) => {
        const view = nightSkinView(run, { record: recordOf(run.level) });
        skin = stepNightSkin(skin, view, tick, rules ? { rules } : {});
        const hv = hazardSkinView(run);
        hskin = stepHazardSkin(hskin, hv, tick);
        const fv = effectSkinView(run, { record: recordOf(run.level) });
        eskin = stepEffectSkin(eskin, fv, tick);
        const cam = CAM(run);
        const main = nightMainOps(view, { cam });
        const ops = roomOps(run.world, art, { level: run.level, tick,
            entitySprites: [...hazardOps(hv, art, { skin: hskin }), ...effectOps(fv, art, { skin: eskin }), ...main],
            drawnObjects: (o) => HAZARD_OBJECT_TAGS.has(o.tag) });
        const night = nightOps(view, art, { skin, ops, hazard: { view: hv, skin: hskin }, whiteOut: fv?.whiteOut ?? null,
            whiteOutAlpha: EFFECT_RULES.whiteOutAlpha, cam, ...(rules ? { rules } : {}) });
        rows.push({ tick, level: run.level, view, skin, main, night });
    });
    return rows;
}

/** Short tags per row, for the `want` list. */
function tagsOf(r) {
    const out = [];
    const n = r.night;
    if (n) out.push('dark');
    for (const o of n?.ops ?? []) {
        if (o.circle) out.push('circle');
        else if (o.key) out.push(`copy:${o.key}`);
        if (o.blend === 'screen' && o.key) out.push('screen');
        if (o.colour === '#ffffff' && o.layer === -Infinity) out.push('whiteout');
        if (!o.key && !o.circle && o.blend === 'screen') out.push('ray');
        if (!o.key && !o.circle && o.colour === '#000000') out.push('shadow');
        if (!o.key && !o.circle && o.colour === '#ffffff' && o.layer !== -Infinity && o.rect.w === 96 || o.rect?.h === 96) out.push('lane');
    }
    if (n?.solid.length) out.push('solid');
    if (r.main.some((o) => o.circle && o.colour === '#000000')) out.push('darkLight');
    if (r.view.poles && [...r.view.poles.values()].some(Boolean)) out.push('poleLit');
    if (r.skin.playerLight) out.push('playerLight');
    if (n?.ops.some((o) => o.circle && o.colour === '#ffff00' && o.circle.r === 20)) out.push('grenadeLight');
    if (n?.ops.some((o) => !o.key && !o.circle && o.layer !== -Infinity && o.colour !== '#ffffff' && o.colour !== '#000000' && !o.blend
        && r.level === 43)) out.push('laser');
    return out;
}

/** The golden: per tick a summary + md5 of the frame; the first tick of each visit in full. */
function goldenLines(rows) {
    const lines = [];
    let open = null;
    let lastLevel = null;
    for (const r of rows) {
        const n = r.night;
        const text = [...(n?.ops ?? []).map(formatNightOp), '--', ...(n?.solid ?? []).map(formatNightOp), '--', ...r.main.map(formatNightOp)];
        const body = `l=${r.level} a=${n ? +n.alpha.toFixed(4) : 0} n=${n?.ops.length ?? 0} s=${n?.solid.length ?? 0} m=${r.main.length} ${md5(text.join('\n')).slice(0, 12)}`;
        const full = r.level !== lastLevel;
        lastLevel = r.level;
        if (!full && open && open.body === body) { open.to = r.tick; continue; }
        if (open) lines.push(...open.out());
        open = { from: r.tick, to: r.tick, body, out() { return [`t=${this.from}${this.to !== this.from ? `..${this.to}` : ''} ${this.body}`, ...(full ? text.map((l) => `    ${l}`) : [])]; } };
    }
    if (open) lines.push(...open.out());
    return lines;
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

const rowsCache = new Map();
const rowsOf = (tape) => {
    if (!rowsCache.has(tape.name)) rowsCache.set(tape.name, runTape(tape));
    return rowsCache.get(tape.name);
};

describe('1. the night layer on real tapes (goldens)', () => {
    for (const tape of TAPES) {
        it(`${tape.name}: reaches ${tape.want.join(', ')} and matches its golden`, () => {
            const rows = rowsOf(tape);
            const seen = new Set(rows.flatMap(tagsOf));
            for (const w of tape.want) expect(seen.has(w), `${tape.name} never shows ${w}`).toBe(true);
            const lines = goldenLines(rows);
            expect(lines).toEqual(golden(`${tape.name}.txt`, lines));
        }, 240_000);
    }
});

describe('2. the independent stratum, from the AS3', () => {
    it('the composite alpha: 0 without the tag; 1 − 0.9·(0.1 + a) − 0.1 with it; clamped', () => {
        expect(nightAlpha(nightLevel({ entities: [] }), 0)).toBe(0);
        const L = (a) => nightLevel({ entities: [{ type: 'lightalpha', attrs: { alpha: String(a) } }] });
        expect(nightAlpha(L(0.1), 0)).toBeCloseTo(0.72, 12);
        expect(nightAlpha(L(0), 0)).toBeCloseTo(0.81, 12);
        expect(nightAlpha(L(0.05), 0)).toBeCloseTo(0.765, 12);
        expect(nightAlpha(L(0.9), 0)).toBe(0);
    });

    it('the day: dawn 0.1 → 1, day 1, twilight 1 → 0.1, night 0.1 (dayLength 9600, nightLength 4800 at FPS 60)', () => {
        expect([NIGHT.dayLength, NIGHT.nightLength]).toEqual([9600, 4800]);
        expect(dayLightAlpha(0, true)).toBeCloseTo(0.1, 12);
        expect(dayLightAlpha(1200, true)).toBeCloseTo(0.55, 12);
        expect(dayLightAlpha(2400, true)).toBe(1);
        expect(dayLightAlpha(7199, true)).toBe(1);
        expect(dayLightAlpha(8400, true)).toBeCloseTo(0.55, 12);
        expect(dayLightAlpha(9600, true)).toBe(0.1);
        expect(dayLightAlpha(14399, true)).toBe(0.1);
        expect(dayLightAlpha(14400, true)).toBeCloseTo(0.1, 12);
        expect(dayLightAlpha(5000, false)).toBe(1);
        // a daynight room with no lightalpha (L0) at night: 1 − 0.1·1·0.9 − 0.1 = 0.81
        expect(nightAlpha({ lightAlpha: 1, dayNight: true }, 10000)).toBeCloseTo(0.81, 12);
        expect(nightAlpha({ lightAlpha: 1, dayNight: true }, 5000)).toBe(0);
    });

    it('a Light\'s radius: int((rmax − rmin) · wf / (frames − 1) + rmin), smooth by the sine; two circles, ×0.5 inside', () => {
        // Torch: 3 frames, 1 loop → worldFrame(3) = int(time % 45 / 15): 28, 30, 32
        expect([0, 15, 30, 44].map((t) => lightRadius({ frames: 3, loops: 1 }, t))).toEqual([28, 30, 32, 32]);
        // smooth, 100 frames: wf 0 → the middle (30); a quarter → 32 (int)
        expect(lightRadius({ frames: 100, loops: 1, smooth: true }, 0)).toBe(30);
        expect(lightRadius({ frames: 100, loops: 1, smooth: true, rmin: 20, rmax: 32 }, 11)).toBe(31);
        const [a, b] = lightCircles({ x: 10.9, y: -3.2, frames: 3, loops: 1 }, 15, -240);
        expect(a.circle).toEqual({ x: 10, y: -3, r: 30 });
        expect(b.circle).toEqual({ x: 10, y: -3, r: 15 });
        expect([a.alpha, a.colour, a.layer]).toEqual([0.2, '#ffffff', -240]);
        expect(lightLayer(480)).toBe(-720);
    });

    it('colours: AS3 uint(String) and FP.colorLerp; the torch light cycles its five colours over 12 loops', () => {
        expect([as3Colour('0xFFCC00'), as3Colour('0882266'), as3Colour(''), as3Colour('0x000000')]).toEqual(['#ffcc00', '#0d765a', '#ffffff', '#000000']);
        expect(colorLerp('#ffcc00', '#ffffff', 0.5)).toBe('#ffe57f');
        expect(colorLerp('#000000', '#ffffff', 0)).toBe('#000000');
        expect(playerLightColour(0)).toBe(PLAYER_LIGHT.colours[0]);
        // worldFrame(100, 12) = int(time % 540 / 5.4); 20 frames per colour
        expect(playerLightColour(108)).toBe('#ffffff');
        expect(playerLightColour(54)).toBe('#ffe57f');
    });

    it('the torch light: born at the player, then a fifth of the way to the player plus myLightPosition each tick', () => {
        const RUN = {};
        const view = (x, y, direction, hasTorch = true) => ({ epoch: { run: RUN, key: 'k' }, player: { x, y, direction }, hasTorch });
        let s = stepNightSkin(null, view(100, 100, 3));
        expect(s.playerLight).toEqual({ x: 100, y: 100 });
        s = stepNightSkin(s, view(100, 100, 3));
        expect(s.playerLight).toEqual({ x: 100, y: 100 + (LIGHT_POSITION[3].y) / 5 });
        s = stepNightSkin(s, view(110, 100, 0));
        expect(s.playerLight.x).toBeCloseTo(100 + (110 - 6 - 100) / 5, 12);
        expect(stepNightSkin(null, view(1, 1, 3, false)).playerLight).toBe(null);
        // a new visit drops it (a new Game builds a new Player)
        expect(stepNightSkin(s, { ...view(5, 5, 3), epoch: { run: RUN, key: 'other' } }).playerLight).toEqual({ x: 5, y: 5 });
    });

    it('the record: torches centred, bone torch 2 offset by its mirror, plant torches, orbs, poles, shadows, rays', () => {
        const r = recordLights({ entities: [
            { type: 'torch', x: 16, y: 32, attrs: { c: '0xFF0000' } },
            { type: 'bonetorch2', x: 0, y: 0, attrs: { c: '0xFFCC00', flip: '1' } },
            { type: 'planttorch', x: 32, y: 32, attrs: { c: '0xFFFF44', flip: '0', distance: '96' } },
            { type: 'orb', x: 50, y: 60, attrs: { c: '0x00FF00' } },
            { type: 'lightpole', x: 64, y: 88, attrs: { c: '0xFFFF44', tag: '0', invert: '0' } },
            { type: 'shadow', x: 8, y: 9, attrs: { color: '0x000000', alpha: '0.25', width: '32', height: '16' } },
            { type: 'lightray', x: 1, y: 2, attrs: { color: '0xFFFF88', alpha: '0.1', width: '16', height: '32' } },
        ] });
        expect(r.lights).toEqual([
            { id: 'torch@16,32', x: 24, y: 40, frames: 3, loops: 1, colour: '#ff0000', smooth: false },
            { id: 'bonetorch2@0,0', x: 9, y: -3, frames: 4, loops: 2, colour: '#ffcc00', smooth: false },
        ]);
        expect(r.plantTorches[0]).toMatchObject({ x: 40, y: 35, cx: 40, cy: 40, distance: 96, smooth: true, frames: 100 });
        expect(r.orbs[0]).toMatchObject({ sx: 50, sy: 60, rmin: 40, rmax: 48, frames: 60, loops: 2 });
        expect(r.poles[0]).toMatchObject({ id: 'lightpole@64,88', x: 72, startY: 96, alpha: 0.5, inner: 0.8, loops: 1.5 });
        expect(r.shadows[0]).toEqual({ rect: { x: 8, y: 9, w: 32, h: 16, right: 40, bottom: 25 }, colour: '#000000', alpha: 63 / 255, layer: -9 });
        expect(r.rays[0]).toMatchObject({ x: 1, y: 2, w: 16, h: 32, colour: '#ffff88', alpha: 0.1, layer: -34 });
    });

    it('the crusher\'s four lanes: a 96 × 32 / 32 × 96 white rect each, from the body\'s top-left', () => {
        expect(crusherLanes({ x: 100, y: 200 }, 0).map((l) => [l.rect.x, l.rect.y, l.rect.w, l.rect.h])).toEqual([
            [84, 184, 96, 32], [84, 120, 32, 96], [20, 184, 96, 32], [84, 184, 32, 96]]);
    });

    it('the copies\' table names only keys the pack has; the tile glows only tile keys', () => {
        for (const k of [...Object.keys(NIGHT_COPIES), ...Object.keys(TILE_NIGHT)]) expect(art.has(k), k).toBe(true);
        for (const k of Object.keys(TILE_NIGHT)) expect(k.startsWith('seedling:tile/')).toBe(true);
        expect(NIGHT_COVERAGE.drawn.length).toBeGreaterThan(0);
    });
});

describe('3. one mutant per rule turns a golden red', () => {
    const MUTANTS = [
        ['nightAlpha', { nightAlpha: (l, t) => Math.min(1, NIGHT_RULES.nightAlpha(l, t) + 0.05) }, 'night-crusher-L42'],
        ['lightCircles', { lightCircles: (l, t, layer) => NIGHT_RULES.lightCircles({ ...l, inner: 0.6 }, t, layer) }, 'night-walk-L59'],
        ['tileNight', { tileNight: { ...TILE_NIGHT, 'seedling:tile/ghostTile': () => 0.05 } }, 'night-poles-L63'],
        ['copies', { copies: { ...NIGHT_COPIES, 'seedling:puzzlement/crusher': { alpha: 0.5 } } }, 'night-crusher-L42'],
        ['lavaEdges', { lavaEdges: (op, cell, time) => NIGHT_RULES.lavaEdges(op, cell, time).slice(0, 1) }, 'night-lava-L76'],
        ['crusherLanes', { crusherLanes: (c, layer) => NIGHT_RULES.crusherLanes(c, layer).slice(1) }, 'night-crusher-L42'],
        ['totemLaserRects', { totemLaserRects: (t, h, s) => NIGHT_RULES.totemLaserRects(t, { ...h, y: h.y + 1 }, s) }, 'night-totem-L43'],
        ['plantAlpha', { plantAlpha: (d, dist) => 0.2 * Math.max(1 - d / dist, 0) }, 'night-poles-L63'],
        ['playerLightColour', { playerLightColour: () => '#ffcc00' }, 'night-crusher-L42'],
        ['followStep', { followStep: (l, p) => ({ x: l.x + (p.x - l.x) / 4, y: l.y + (p.y - l.y) / 4 }) }, 'night-crusher-L42'],
    ];
    for (const [name, rules, tapeName] of MUTANTS) {
        it(`${name} → ${tapeName} moves`, () => {
            const tape = TAPES.find((t) => t.name === tapeName);
            const good = goldenLines(rowsOf(tape));
            const bad = goldenLines(runTape(tape, { rules: { ...NIGHT_RULES, ...rules } }));
            const moved = bad.filter((l, i) => l !== good[i]).length + Math.abs(bad.length - good.length);
            expect(moved, `${name} did not move ${tapeName}`).toBeGreaterThan(3);
        }, 240_000);
    }
});

describe('4. the adapter reads the run and writes nothing', () => {
    const frozen = (o) => new Proxy(o, { set: () => { throw new Error('nightSkinView wrote to the run'); }, defineProperty: () => { throw new Error('nightSkinView defined on the run'); } });
    it('maps the run and the record; a write anywhere throws', () => {
        const run = frozen({
            level: 63, transitions: [], playerDeaths: [], gameTime: 900, state: frozen({ x: 10, y: 20, direction: 2 }),
            inventory: frozen({ hasTorch: true }), world: frozen({ world: frozen({ width: 320, height: 480 }) }),
            lightPolesNow: [frozen({ id: 'lightpole@64,88', x: 72, y0: 88, lit: false, hitsTimer: 0, rect: null })],
        });
        const v = nightSkinView(run, { record: frozen({ entities: [frozen({ type: 'lightalpha', x: 0, y: 0, attrs: frozen({ alpha: '0.05' }) })] }) });
        expect(v.epoch).toEqual({ run, key: '63|0|0' });
        expect([v.level, v.gameTime, v.hasTorch, v.player, v.room]).toEqual([63, 900, true, { x: 10, y: 20, direction: 2 }, { width: 320, height: 480 }]);
        expect(v.night).toEqual({ lightAlpha: 0.15000000000000002, dayNight: false, snowing: false });
        expect([...v.poles]).toEqual([['lightpole@64,88', false]]);
        expect(nightSkinView(null)).toBe(null);
        // a run with no pole getter: the poles are not drawn (null), by name
        expect(nightSkinView({ level: 1, state: { x: 0, y: 0 } }).poles).toBe(null);
    });
});

describe('5. ⛔ STATE IDENTITY — the night renderer never touches the run', () => {
    for (const tape of TAPES) {
        it(`${tape.name}: the stream, the end state (stateDigest), the ledgers and the stateLog byte-identical with the renderer on and off`, () => {
            // ⚠ The CONTROL arm reads G3c's hazard adapter every tick too, as the page already does on main: its lazy
            // `crushers` / `bossesWoken` move `stateDigest().visit` in a room with neither (streams and ledgers do
            // not move; a finding for fidelity, §5.135). This row isolates what the NIGHT layer adds.
            let hc = null;
            const control = drive(tape, (tick, run) => { hc = stepHazardSkin(hc, hazardSkinView(run), tick); });
            const off = drive(tape);
            let drawn = 0;
            let skin = null;
            let hskin = null;
            const on = drive(tape, (tick, run) => {
                const view = nightSkinView(run, { record: recordOf(run.level) });
                skin = stepNightSkin(skin, view, tick);
                const hv = hazardSkinView(run);
                hskin = stepHazardSkin(hskin, hv, tick);
                const main = nightMainOps(view, { cam: CAM(run) });
                const ops = roomOps(run.world, art, { level: run.level, tick, entitySprites: [...hazardOps(hv, art, { skin: hskin }), ...main] });
                const n = nightOps(view, art, { skin, ops, hazard: { view: hv, skin: hskin }, cam: CAM(run) });
                drawn += (n?.ops.length ?? 0) + main.length;
            });
            expect(drawn).toBeGreaterThan(0);
            expect(md5(on.stream.join('\n'))).toBe(md5(off.stream.join('\n')));
            expect(md5(on.stateLog)).toBe(md5(off.stateLog));
            expect(md5(on.end)).toBe(md5(control.end));
            // without the digest, the end state is also the pure-off arm's
            const noDigest = (e) => JSON.stringify(JSON.parse(e).slice(0, -1));
            expect(md5(noDigest(on.end))).toBe(md5(noDigest(off.end)));
        }, 240_000);
    }

    // fidelity-12's clearance (2026-10-24): `lightPolesNow` builds the visit's pole entries on a first read — the
    // pure boot value a tick builds. On a pole level the digest and the clears must not see the read.
    it('lightPolesNow on L63: stateDigest() and the clears equal with and without a read, before the first tick and after a level entry', () => {
        const arm = (readAt) => {
            const rt = boot(63, [72, 120]);
            const out = [];
            const snap = () => out.push(JSON.stringify([rt.run?.stateDigest?.(), rt.run?.earnedClears, rt.run?.ledger?.('bankedClears')]));
            if (readAt.has('boot') && rt.run) void rt.run.lightPolesNow;
            rt.tick(new Set());
            if (readAt.has('first')) void rt.run.lightPolesNow;
            snap();
            // a level entry: a fresh Game in L62 (another pole room), then read before its first tick
            rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [62, 72, 120] }]);
            rt.tick(new Set());
            if (readAt.has('entry')) void rt.run.lightPolesNow;
            snap();
            for (let i = 0; i < 40; i += 1) rt.tick(new Set());
            snap();
            return out;
        };
        const never = arm(new Set());
        const always = arm(new Set(['boot', 'first', 'entry']));
        expect(never.length).toBe(3);
        expect(always).toEqual(never);
        // the getter answered with copies: mutating them changes nothing the run reads next
        const rt = boot(63, [72, 120]);
        rt.tick(new Set());
        const rows = rt.run.lightPolesNow;
        expect(rows.length).toBe(3);
        rows[0].lit = !rows[0].lit;
        if (rows[0].rect) rows[0].rect.x += 1000;
        expect(rt.run.lightPolesNow[0].lit).toBe(!rows[0].lit);
        if (rows[0].rect) expect(rt.run.lightPolesNow[0].rect.x).toBe(rows[0].rect.x - 1000);
    });
});

describe('6. the night canvas is redrawn only when its picture changes; the composite every paint', () => {
    const fakeCanvas = (log, name) => {
        const ctx = new Proxy({ globalCompositeOperation: 'source-over', globalAlpha: 1 }, {
            get: (t, k) => (k in t ? t[k] : (...a) => { log.push([name, k, t.globalCompositeOperation, t.globalAlpha, a.length]); }),
            set: (t, k, v) => { t[k] = v; return true; },
        });
        return { width: 480, height: 480, getContext: () => ctx, name };
    };
    const night = (r, edgeScale = 1.5) => ({
        alpha: 0.72,
        ops: [{ circle: { x: 10, y: 10, r }, colour: '#ffcc00', alpha: 0.2, layer: -240, rect: { x: 10 - r, y: 10 - r, w: 2 * r, h: 2 * r } }],
        solid: [{ rect: { x: 0, y: 0, w: 16, h: 16 }, colour: '#ffff00', alpha: 0.4, layer: 100, scaleX: edgeScale }],
    });
    it('reuses, redraws on a changed field, keeps the solid canvas, and composites (multiply, alpha) every paint', () => {
        const log = [];
        let n = 0;
        const cache = createNightLayer((w, h) => fakeCanvas(log, `off${n++}`));
        const main = fakeCanvas(log, 'main');
        const view = { x: 0, y: 0, w: 160, h: 160 };
        const paint = (nt) => paintNight(main.getContext(), nt, null, view, main, { cache, fill: '#080822' });
        paint(night(28));
        paint(night(28));
        expect([cache.redraws, cache.reused, cache.solidRedraws]).toEqual([1, 1, 1]);
        paint(night(30)); // the light's radius moved: redraw; the solid did not: reuse it
        expect([cache.redraws, cache.reused, cache.solidRedraws]).toEqual([2, 1, 1]);
        paint(night(30, 1.6)); // the edges pulsed: both
        expect([cache.redraws, cache.solidRedraws]).toEqual([3, 2]);
        const composites = log.filter(([who, k, op]) => who === 'main' && k === 'drawImage' && op === 'multiply');
        expect(composites.length).toBe(4);
        expect(log.filter(([who, k, op]) => who === 'off0' && k === 'drawImage' && op === 'hard-light').length).toBe(3);
        // a room the night does not darken draws nothing at all
        const before = log.length;
        paint({ ...night(30), alpha: 0 });
        expect(log.length).toBe(before);
    });
});
