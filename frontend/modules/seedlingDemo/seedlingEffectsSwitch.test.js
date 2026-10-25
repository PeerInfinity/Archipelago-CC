/**
 * ⛓ GRAPHICS G6 — THE EFFECTS SWITCH, in node, over the COMMITTED seedling pack's manifest (the in-app row
 * `seedling-js-runtime-graphics-effects-switch` carries the live switch in a browser).
 *
 * The switch covers two families: G4's RAIN (`stepEffectSkin`/`holdEffectSkin`/`effectOps` `rain: false`) and G5's
 * LAVA GLOW (`nightOps` `lavaGlow: false`: the lava tiles' night copies and their `solidBmp` edges).
 *
 *   1. ⛔ OFF IS A STACK WITHOUT THOSE FAMILIES, OP FOR OP: on every G5 night tape and the Dungeon 6 rain
 *      stand-still, the room's ops, the night ops and the solid ops with the switch OFF equal the ON ops with the
 *      two families' ops removed — every tick, formatted line for line. Each family must really be removed
 *      somewhere (no vacuous pass), and nothing else may differ.
 *   2. The OFF goldens (`effects-off-*.txt`): per tick, the OFF frame's md5 — change detectors, recorded from this
 *      renderer. Re-record after a deliberate change: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   3. The rain switched back ON spawns from that frame as an all-ON run does (its cosmetic key is the frame count).
 *   4. ⛔ STATE IDENTITY, DIRECTLY against pure-off (fidelity's DIGESTREAD is on main, so the G5 control arm is no
 *      longer needed): `stateDigest()` at every tick, and the end state, equal for a run never drawn, a run drawn
 *      with the effects and the lights ON (every skin view the page reads, `talkingNow` included), and one with
 *      the effects OFF.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { md5 } from './md5.js';
import { runTape as runFixtureTape } from './tapeRunner.js';
import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { withContactFidelity } from './contactFidelity.js';
import { TILE_LAYER, roomOps } from './seedlingSkinRenderer.js';
import { hazardOps, hazardSkinView, stepHazardSkin, HAZARD_OBJECT_TAGS } from './seedlingHazardSkin.js';
import { EFFECT_RULES, KEYS, effectOps, effectSkinView, holdEffectSkin, stepEffectSkin } from './seedlingEffectSkin.js';
import { LAVA_TILE, formatNightOp, nightMainOps, nightOps, nightSkinView, stepNightSkin } from './seedlingNightSkin.js';

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

/** G5's night tapes (`seedlingNightSkin.test.js`), plus the Dungeon 6 rain stand-still (G4's `rain-L61`). */
const TAPES = Object.freeze([
    { name: 'crusher-L42', fixture: 'crusher-l42-round-trip' },
    { name: 'totem-L43', fixture: 'r6-totem-kill' },
    { name: 'walk-L59', fixture: 'r4-walk-6-health', golden: true },
    { name: 'lava-L76', level: 76, at: [152, 92], n: 200, fidelity: { igneousLava: false }, golden: true },
    { name: 'poles-L63', level: 63, at: [72, 120], n: 120 },
    { name: 'pole-lit-L74', level: 74, at: [40, 40], n: 120 },
    { name: 'ray-L49', level: 49, at: [72, 72], n: 60 },
    { name: 'rain-L61', level: 61, at: [104, 144], n: 240, golden: true },
]);

function boot(level, [x, y]) {
    const rt = createJsRuntime({ onStateChanged: () => {}, log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    return rt;
}

function drive(tape, each) {
    return withContactFidelity(tape.fidelity ?? {}, () => {
        if (tape.fixture) {
            let last = null;
            const out = runFixtureTape(fixture(tape.fixture), { levelSource: atlasLevelSource(),
                onTick: (t, now, held, run) => { last = run; each(t, run); } });
            return JSON.stringify([out.ticks, out.final, last?.stateDigest()]);
        }
        const rt = boot(tape.level, tape.at);
        for (let i = 0; i < tape.n; i += 1) {
            rt.tick(new Set());
            each(rt.ticks, rt.run);
        }
        return JSON.stringify([rt.ticks, rt.run?.state, rt.game.readState(), rt.run?.stateDigest()]);
    });
}

const CAM = (run) => {
    const c = run.cameraNow?.cam;
    return c ? { x: c.x, y: c.y, w: 160, h: 160 } : { x: 0, y: 0, w: 160, h: 160 };
};

/** One arm of the page's paint: its own effect and night skins, the room's ops, and the night frame. */
function arm(effects) {
    let eskin = null;
    let nskin = null;
    return (tick, run, hv, hskin) => {
        const fv = effectSkinView(run, { record: recordOf(run.level) });
        eskin = stepEffectSkin(eskin, fv, tick, { rain: effects });
        const view = nightSkinView(run, { record: recordOf(run.level) });
        nskin = stepNightSkin(nskin, view, tick);
        const cam = CAM(run);
        const main = nightMainOps(view, { cam });
        const ops = roomOps(run.world, art, { level: run.level, tick,
            entitySprites: [...hazardOps(hv, art, { skin: hskin }), ...effectOps(fv, art, { skin: eskin, rain: effects }), ...main],
            drawnObjects: (o) => HAZARD_OBJECT_TAGS.has(o.tag) });
        const night = nightOps(view, art, { skin: nskin, ops, hazard: { view: hv, skin: hskin }, whiteOut: fv?.whiteOut ?? null,
            whiteOutAlpha: EFFECT_RULES.whiteOutAlpha, cam, lavaGlow: effects });
        return { ops, night, droplets: eskin.droplets.length };
    };
}

/** The two families' ops: a drop (in the room, and its night copy), a lava tile's night copy. */
const isRain = (op) => op?.key === KEYS.droplet;
const isLavaCopy = (op) => op?.key === LAVA_TILE && op.layer === TILE_LAYER;
const lines = (ops) => (ops ?? []).map(formatNightOp);

function runBoth(tape) {
    const on = arm(true);
    const off = arm(false);
    let hskin = null;
    const rows = [];
    drive(tape, (tick, run) => {
        const hv = hazardSkinView(run);
        hskin = stepHazardSkin(hskin, hv, tick);
        rows.push({ tick, level: run.level, on: on(tick, run, hv, hskin), off: off(tick, run, hv, hskin) });
    });
    return rows;
}

function golden(name, got) {
    const path = join(GOLDENS, name);
    if (process.env.UPDATE_SKIN_GOLDENS) {
        writeFileSync(path, `${got.join('\n')}\n`);
        return got;
    }
    expect(existsSync(path), `${path} — record it with UPDATE_SKIN_GOLDENS=1`).toBe(true);
    return readFileSync(path, 'utf8').trimEnd().split('\n');
}

/** Per tick the OFF frame's summary + md5 (room / night / solid); a run of identical lines is one. */
function offGoldenLines(rows) {
    const out = [];
    let open = null;
    for (const r of rows) {
        const n = r.off.night;
        const text = [...lines(r.off.ops), '--', ...lines(n?.ops), '--', ...lines(n?.solid)];
        const body = `l=${r.level} a=${n ? +n.alpha.toFixed(4) : 0} r=${r.off.ops.length} n=${n?.ops.length ?? 0} s=${n?.solid.length ?? 0} `
            + `${md5(text.join('\n')).slice(0, 12)}`;
        if (open && open.body === body) { open.to = r.tick; continue; }
        if (open) out.push(`t=${open.from}${open.to !== open.from ? `..${open.to}` : ''} ${open.body}`);
        open = { from: r.tick, to: r.tick, body };
    }
    if (open) out.push(`t=${open.from}${open.to !== open.from ? `..${open.to}` : ''} ${open.body}`);
    return out;
}

describe('1. ⛔ effects OFF = the stack without the rain and the lava glow, op for op', () => {
    const removed = { rain: 0, lavaCopy: 0, lavaEdges: 0 };
    for (const tape of TAPES) {
        it(`${tape.name}: every tick, the room / night / solid ops OFF equal ON minus the two families`, () => {
            const rows = runBoth(tape);
            expect(rows.length).toBeGreaterThan(0);
            for (const r of rows) {
                const at = `${tape.name} t=${r.tick} l=${r.level}`;
                expect(lines(r.off.ops), `${at} room`).toEqual(lines(r.on.ops.filter((o) => !isRain(o))));
                expect(r.off.droplets, `${at} no drop alive`).toBe(0);
                expect(!!r.off.night, `${at} the night frame exists in both or neither`).toBe(!!r.on.night);
                if (!r.on.night) continue;
                expect(r.off.night.alpha, `${at} alpha`).toBe(r.on.night.alpha);
                expect(lines(r.off.night.ops), `${at} night`).toEqual(lines(r.on.night.ops.filter((o) => !isRain(o) && !isLavaCopy(o))));
                expect(r.off.night.solid, `${at} solid`).toEqual([]);
                removed.rain += r.on.ops.filter(isRain).length;
                removed.lavaCopy += r.on.night.ops.filter(isLavaCopy).length;
                removed.lavaEdges += r.on.night.solid.length;
            }
            if (tape.golden) expect(offGoldenLines(rows)).toEqual(golden(`effects-off-${tape.name}.txt`, offGoldenLines(rows)));
        });
    }
    it('…and each family was really there to remove (no vacuous pass)', () => {
        expect(removed.rain).toBeGreaterThan(100);
        expect(removed.lavaCopy).toBeGreaterThan(100);
        expect(removed.lavaEdges).toBeGreaterThan(100);
    });
});

describe('2. the switch is live', () => {
    it('the rain switched back ON spawns from that frame as an all-ON run does', () => {
        const rt = boot(61, [104, 144]);
        let on = null;
        let flip = null;
        for (let i = 0; i < 160; i += 1) {
            rt.tick(new Set());
            const fv = effectSkinView(rt.run, { record: recordOf(61) });
            on = stepEffectSkin(on, fv, rt.ticks);
            flip = stepEffectSkin(flip, fv, rt.ticks, { rain: i < 80 || i >= 100 });
            if (i >= 80 && i < 100) expect(flip.droplets).toEqual([]);
        }
        expect(flip.frame).toBe(on.frame);
        // a drop lives well under 60 frames here: 60 frames after the switch back, every drop alive is one both spawned
        expect(flip.droplets).toEqual(on.droplets);
        expect(on.droplets.length).toBeGreaterThan(0);
    });

    it('a held (dead) frame with the rain OFF adds no drop', () => {
        const rt = boot(61, [104, 144]);
        rt.tick(new Set());
        const fv = effectSkinView(rt.run, { record: recordOf(61) });
        const skin = { ...stepEffectSkin(null, fv, 0, { live: false }), fadeQueue: [1, 0.5] };
        expect(holdEffectSkin(skin, fv, { rain: false }).droplets).toEqual([]);
    });
});

describe('4. ⛔ state identity: stateDigest equal with the effects and the lights ON, OFF, and never drawn', () => {
    /** One run of `tape`; `paint` (an `arm(…)` painter, or null = never drawn) runs every tick before the digest. */
    const digestsOf = (tape, paint) => {
        const digests = [];
        let hskin = null;
        const end = drive(tape, (tick, run) => {
            if (paint) {
                const hv = hazardSkinView(run);
                hskin = stepHazardSkin(hskin, hv, tick);
                paint(tick, run, hv, hskin);
                void run.talkingNow;
            }
            digests.push(run.stateDigest());
        });
        return { digests, end };
    };
    for (const tape of TAPES) {
        it(`${tape.name}: every tick's stateDigest() and the end state`, () => {
            const never = digestsOf(tape, null);
            const on = digestsOf(tape, arm(true));
            const off = digestsOf(tape, arm(false));
            expect(never.digests.length).toBeGreaterThan(0);
            expect(on.digests).toEqual(never.digests);
            expect(off.digests).toEqual(never.digests);
            expect(on.end).toBe(never.end);
            expect(off.end).toBe(never.end);
        });
    }
});
