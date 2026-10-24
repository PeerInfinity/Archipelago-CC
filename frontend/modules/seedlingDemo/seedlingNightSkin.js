/**
 * seedlingDemo/seedlingNightSkin — **THE NIGHT LAYER, IN THE ORIGINAL
 * GRAPHICS** (Seedling JS graphics G5): the lights, the grenade's light, the
 * Boss Totem's laser, and every copy the game draws onto `nightBmp`, then the
 * one MULTIPLY composite that darkens the room. A FIFTH sibling module, so
 * G1–G4b's goldens are unchanged by construction; the page draws it only when
 * the lights are on (`?lights=on|off`, the flash panel's `seedlingJsLights`,
 * default ON under a graphics stack, nothing without one).
 *
 * ── What AS3 does, transcribed (`vendor/seedling/src`) ─────────────────
 *
 *   · `Game.bufferRestore()` (`Game.as:1658-1662`) fills `nightBmp` with
 *     0xFF080822 at the end of every render; during `super.render()` each
 *     entity writes onto it (`Draw.setTarget(nightBmp, FP.camera)`), in the
 *     same layer order as the screen; `bufferTransforms()` (`:1555-1645`)
 *     draws `solidBmp` onto it with HARDLIGHT, then the WHOLE of it onto the
 *     screen with MULTIPLY at
 *         a = 1 − (currentLightAlpha · lightAlpha) · (1 − minDarkness) − min(minDarkness, lightAlpha)
 *     — before `talk()`, the cover, the hearts and the fade (`:1071-1083`), so
 *     the overlays are never darkened.
 *   · `lightAlpha` = 1, or `minLightAlpha + lightalpha@alpha` when the level
 *     has the tag (`Game.as:2071-2087`). A room without it composites at
 *     1 − 0.9 − 0.1 = 0: no effect at all. 98 of the 116 levels carry it.
 *   · `currentLightAlpha` is 1 unless the level has `daynight`: then the
 *     day's clock (`todaysTime = time % (dayLength + nightLength)`, `:895`)
 *     ramps it 0.1 → 1 over dawn, holds through day, back over twilight and
 *     sits at 0.1 through the night (16 levels).
 *   · `Light.render()` (`Scenery/Light.as:48-79`): two `Draw.circlePlus` at
 *     the light's centre, radius `c_radius` (int) and `c_radius · 0.5` (or
 *     `i_radius_factor`), colour and alpha the light's, onto `nightBmp` —
 *     or onto the SCREEN when `darkLight` (an unlit light pole: black, 0.8).
 *     Every Light sets `layer = −FP.height · 3/2`: drawn after every body.
 *
 * ⛔ THE RENDERER ONLY READS. `nightSkinView(run, { record })` is the one
 * adapter (ledger and state copies: `state`, `inventory`, `gameTime`, and the
 * read-only `lightPolesNow`, ⚖ cleared by fidelity-12 through planning-10 on
 * 2026-10-24); the light positions, the shadows and the rays are the room's
 * `.oel` record. `stepNightSkin` is the renderer's own state — the player's
 * torch light following the player (`PlayerLight.update`, a lerp the game
 * keeps on the entity, not the sim). ⚖ NEVER MODELS THE COSMETIC RNG: the
 * Orb's float phase (`Orb.as:29` `randVal = Rng.cos()`) and a fuchsia tile's
 * pulse phase are `cosmeticRand`, a named band. Nothing here touches a tick
 * stream (`seedlingNightSkin.test.js` §5).
 *
 * ⛔ ROOM MODE: the game's `nightBmp` is the 160 × 160 screen; the room view
 * darkens the whole room with the same pixels per room pixel. The screen-
 * anchored nightBmp writes (the totem's white rect, a light ray's top edge)
 * use the MODEL's camera rect, as G4's overlays do (⚖ user 2026-10-21).
 */
import { TILE_LAYER, cosmeticRand } from './seedlingSkinRenderer.js';
import { worldFrame } from './seedlingEnemySkin.js';
import { totemActivationStage, totemLaserTint, totemParts } from './seedlingHazardSkin.js';

// ── constants, each from the AS3 ────────────────────────────────────────

/** `Game.as:458-466, 1561-1563, 1660`; `Main.as:27` FPS 60. */
export const NIGHT = Object.freeze({
    fill: '#080822', minLightAlpha: 0.1, minDarkness: 0.1, nightAlpha: 0.1,
    dayLength: 160 * 60, nightLength: 80 * 60,
});
/** `Light.as:31` ctor defaults and `:22` `i_radius_factor`. */
const LIGHT = Object.freeze({ frames: 1, loops: 1, colour: '#ffffff', smooth: false, rmin: 28, rmax: 32, alpha: 0.2, inner: 0.5 });
/** `Light.as:51`: every Light's layer, by the ROOM's height. */
export const lightLayer = (roomHeight) => -roomHeight * 3 / 2;
const TILE = 16;
const YELLOW = '#ffff00';
const WHITE = '#ffffff';

/** AS3 `uint(String)` of an `.oel` colour attribute ("0xFFCC00", or decimal), as '#rrggbb'. */
export function as3Colour(s, fallback = 0xffffff) {
    const str = String(s ?? '').trim();
    let n = /^0x/i.test(str) ? Number.parseInt(str.slice(2), 16) : Number.parseInt(str, 10);
    if (!Number.isFinite(n)) n = fallback;
    return `#${((n >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;
}
const hexRgb = (c) => [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16));
const rgbHex = (r, g, b) => `#${[r, g, b].map((v) => (v & 0xff).toString(16).padStart(2, '0')).join('')}`;

/** `FP.colorLerp(from, to, t)` (`FP.as`): per channel `c + (to − c) · t`, packed by a shift (toward zero). */
export function colorLerp(from, to, t) {
    if (t <= 0) return from;
    if (t >= 1) return to;
    const a = hexRgb(from);
    const b = hexRgb(to);
    return rgbHex(...a.map((c, i) => Math.trunc(c + (b[i] - c) * t)));
}

// ── the level's light ───────────────────────────────────────────────────

/** `Game.loadlevel` (`Game.as:2071-2093`): the level's `lightAlpha`, `dayNight` and `snowing`, from its record. */
export function nightLevel(record) {
    const ents = record?.entities ?? [];
    const la = ents.find((e) => e.type === 'lightalpha');
    return {
        lightAlpha: la ? NIGHT.minLightAlpha + Number(la.attrs?.alpha) : 1,
        dayNight: ents.some((e) => e.type === 'daynight'),
        snowing: ents.some((e) => e.type === 'snow'),
    };
}

/** `bufferTransforms()`'s `currentLightAlpha` (`Game.as:1561-1583`) at `Game.time` = `time`. */
export function dayLightAlpha(time, dayNight) {
    if (!dayNight) return 1;
    const N = NIGHT;
    const day = N.dayLength + N.nightLength;
    const t = (((time ?? 0) % day) + day) % day;
    const q = N.dayLength / 4;
    if (t < q) return (t / q) * (1 - N.nightAlpha) + N.nightAlpha;
    if (t < q * 3) return 1;
    if (t < N.dayLength) return (1 - (t - q * 3) / q) * (1 - N.nightAlpha) + N.nightAlpha;
    return N.nightAlpha;
}

/** THE COMPOSITE'S ALPHA (`Game.as:1634`), clamped to [0, 1] as a ColorTransform's multiplier is. */
export function nightAlpha(level, time) {
    const la = level.lightAlpha;
    const a = 1 - dayLightAlpha(time, level.dayNight) * la * (1 - NIGHT.minDarkness) - Math.min(NIGHT.minDarkness, la);
    return Math.min(Math.max(a, 0), 1);
}

// ── the record's lights ─────────────────────────────────────────────────

/**
 * The room's static light sources, from its `.oel` record (`Game.as:2369-2373`, `:2374`, `:2417-2418`), each as
 * its class's ctor places its `Light`. Pure. `poles` are the light poles' rows (their `Light` follows the pole's
 * bob and its lit state, both per frame — `lightOps`).
 */
export function recordLights(record) {
    const out = { lights: [], poles: [], orbs: [], plantTorches: [], shadows: [], rays: [] };
    for (const e of record?.entities ?? []) {
        const a = e.attrs ?? {};
        const flip = Number.parseInt(a.flip ?? '0', 10) !== 0 ? -1 : 1;
        switch (e.type) {
        case 'torch':
            // `Torch.as:19-24`: centre of the cell; Torch.png 12 × 10 / 4 × 10 = 3 frames, 1 loop, not smooth.
            out.lights.push({ id: `torch@${e.x},${e.y}`, x: e.x + 8, y: e.y + 8, frames: 3, loops: 1, colour: as3Colour(a.c), smooth: false });
            break;
        case 'bonetorch':
        case 'bonetorch2': {
            // `BoneTorch.as:24-44`: type 1 offsets (−1, −11) by the mirror; `frames` (0,1,2,1) = 4, `loops` 2.
            const off = e.type === 'bonetorch2' ? { x: -1, y: -11 } : { x: 0, y: 0 };
            out.lights.push({ id: `${e.type}@${e.x},${e.y}`, x: e.x + 8 + off.x * flip, y: e.y + 8 + off.y, frames: 4, loops: 2, colour: as3Colour(a.c), smooth: false });
            break;
        }
        case 'planttorch':
            // `PlantTorch.as:23-41`: the light at (0, −5); 100 frames, 1 loop, smooth; its alpha by the player's distance.
            out.plantTorches.push({ id: `planttorch@${e.x},${e.y}`, cx: e.x + 8, cy: e.y + 8, x: e.x + 8, y: e.y + 8 - 5,
                frames: 100, loops: 1, colour: as3Colour(a.c), smooth: true, distance: Number.parseInt(a.distance ?? '100', 10) });
            break;
        case 'orb':
            // `Orb.as:34-58`: `super(_x, _y)` (no centring); Light(60, 2, c, smooth, 40, 48, 0.2) riding the float.
            out.orbs.push({ id: `orb@${e.x},${e.y}`, sx: e.x, sy: e.y, frames: 60, loops: 2, colour: as3Colour(a.c), smooth: true, rmin: 40, rmax: 48 });
            break;
        case 'lightpole':
            // `LightPole.as:31-45`: centre of the cell; Light(100, 1.5, c, smooth, 28, 32, 0.5), `i_radius_factor` 0.8.
            out.poles.push({ id: `lightpole@${e.x},${e.y}`, x: e.x + 8, startY: e.y + 8, frames: 100, loops: 1.5, colour: as3Colour(a.c),
                smooth: true, alpha: 0.5, inner: 0.8 });
            break;
        case 'shadow': {
            // `Shadow.as:24-46`: a w × h BitmapData of colour c at alpha int(a · 255), drawn onto nightBmp; layer −y.
            const w = Number(a.width);
            const h = Number(a.height);
            out.shadows.push({ rect: { x: e.x, y: e.y, w, h, right: e.x + w, bottom: e.y + h }, colour: as3Colour(a.color, 0),
                alpha: Math.trunc(Number(a.alpha) * 255) / 255, layer: -e.y });
            break;
        }
        case 'lightray':
            // `LightRay.as:19-41`; layer −(y + h).
            out.rays.push({ x: e.x, y: e.y, w: Number(a.width), h: Number(a.height), colour: as3Colour(a.color), alpha: Number(a.alpha),
                layer: -(e.y + Number(a.height)) });
            break;
        default:
        }
    }
    return out;
}

/** `Light.draw()`'s radius (`Light.as:63-74`) at `Game.time` = `time`: an AS3 `int` (toward zero). */
export function lightRadius(l, time) {
    const frames = l.frames ?? LIGHT.frames;
    const rmin = l.rmin ?? LIGHT.rmin;
    const rmax = l.rmax ?? LIGHT.rmax;
    const wf = worldFrame(time, frames, l.loops ?? LIGHT.loops);
    if (frames <= 1) return Math.trunc(rmin);
    const r = l.smooth
        ? (rmax - rmin) * (Math.sin((wf / (frames - 1)) * 2 * Math.PI) + 1) / 2 + rmin
        : ((rmax - rmin) * wf) / (frames - 1) + rmin;
    return Math.trunc(r);
}

/** The two `circlePlus` of one Light as ops (`Draw.circlePlus` takes int x, y). */
export function lightCircles(l, time, layer) {
    const r = lightRadius(l, time);
    const x = Math.trunc(l.x);
    const y = Math.trunc(l.y);
    const colour = l.colour ?? LIGHT.colour;
    const alpha = l.alpha ?? LIGHT.alpha;
    const circle = (rad) => ({ circle: { x, y, r: rad }, colour, alpha, layer, rect: { x: x - rad, y: y - rad, w: 2 * rad, h: 2 * rad } });
    return [circle(r), circle(r * (l.inner ?? LIGHT.inner))];
}

// ── the player's torch light ────────────────────────────────────────────

/** `PlayerLight.as:11-43`. */
export const PLAYER_LIGHT = Object.freeze({
    frames: 100, loops: 3, rmin: 20, rmax: 32, alpha: 0.5, smooth: true, colorLoops: 12, movementDivisor: 5,
    colours: Object.freeze(['#ffcc00', '#ffffff', '#ff0000', '#00ff00', '#0000ff']),
});
/** `Player.as:1650-1661` `myLightPosition` by `direction`. */
export const LIGHT_POSITION = Object.freeze([{ x: -6, y: -5 }, { x: 0, y: 5 }, { x: 6, y: -5 }, { x: 0, y: -6 }]);

/** `PlayerLight.update()`'s colour at `Game.time` = `time`. */
export function playerLightColour(time) {
    const P = PLAYER_LIGHT;
    const wf = worldFrame(time, P.frames, P.colorLoops);
    const seg = (wf / P.frames) * P.colours.length;
    const i = Math.trunc(seg);
    return colorLerp(P.colours[i % P.colours.length], P.colours[(i + 1) % P.colours.length], seg - i);
}

// ── the adapter ─────────────────────────────────────────────────────────

/** A getter's value, or `fallback` when the run has no such member (a stub run in a test). */
const read = (run, name, fallback) => (name in run ? run[name] ?? fallback : fallback);

/**
 * THE ADAPTER. Everything the night layer reads, from the run and the room's
 * record, as plain objects (null when there is no run). The visit identity is
 * G3's.
 */
export function nightSkinView(run, { record = null } = {}) {
    if (!run?.state) return null;
    const s = run.state;
    const inv = read(run, 'inventory', {}) ?? {};
    const poles = 'lightPolesNow' in run ? run.lightPolesNow : null;
    return {
        epoch: { run, key: `${run.level}|${run.transitions?.length ?? 0}|${run.playerDeaths?.length ?? 0}` },
        level: run.level,
        gameTime: run.gameTime ?? null,
        room: run.world?.world ? { width: run.world.world.width, height: run.world.world.height } : { width: 160, height: 160 },
        player: { x: s.x, y: s.y, direction: s.direction ?? 3 },
        hasTorch: !!inv.hasTorch,
        night: nightLevel(record),
        sources: recordLights(record),
        // `id` → lit (`activate` XOR `invert`); null = the run exposes no pole state (the poles are not drawn, by name)
        poles: poles ? new Map(poles.map((p) => [`lightpole@${p.id.split('@')[1]}`, !!p.lit])) : null,
        world: run.world ?? null,
    };
}

const sameVisit = (a, b) => !!a && !!b && a.run === b.run && a.key === b.key;

/**
 * THE REDUCER: the player's torch light, one GAME tick at a time (and the visit's first tick, `visitTick`). `Player.update` adds a `PlayerLight` at the
 * player when it has none and `hasTorch` (`Player.as:495-498`; a new `Game` builds a new Player, so a new visit
 * has none); from the next update on, the light moves a fifth of the way to the player plus `myLightPosition`.
 */
export function stepNightSkin(prev, view, tick = 0, { rules = NIGHT_RULES } = {}) {
    if (!view) return prev;
    const same = !!prev && sameVisit(prev.epoch, view.epoch);
    // the tick the visit was first drawn at: a lava tile bakes its edges from the frame it shows then (`lavaEdges`)
    const visitTick = same ? prev.visitTick : tick;
    let light = same ? prev.playerLight : null;
    if (light) {
        light = (rules.followStep ?? NIGHT_RULES.followStep)(light, view.player);
    } else if (view.hasTorch) {
        light = { x: view.player.x, y: view.player.y };
    }
    return { epoch: view.epoch, playerLight: light, visitTick };
}

/** `PlayerLight.update()` (`:33-41`): a fifth of the way to the player plus `myLightPosition`. */
function followStep(light, player) {
    const off = LIGHT_POSITION[player.direction] ?? { x: 0, y: 0 };
    const d = PLAYER_LIGHT.movementDivisor;
    return { x: light.x + (player.x + off.x - light.x) / d, y: light.y + (player.y + off.y - light.y) / d };
}

// ── the ops ─────────────────────────────────────────────────────────────

/**
 * A main op's night copy, by art key: `alpha` — `'same'` (the op's own), a number (the class sets it before the
 * copy), or a function of the op and the context; `when(op, ctx)` gates it. ⛔ Only keys the renderer already
 * draws; a class whose picture G1–G4b does not draw has no copy here (`NIGHT_COVERAGE.remaining`).
 */
export const NIGHT_COPIES = Object.freeze({
    // `Player.as:1215-1220`: with the dark suit, the body again; `:1268-1272` the slash at 0.25.
    'seedling:player/shrumDark': { alpha: 'same' },
    'seedling:player/slash': { alpha: 0.25 },
    'seedling:player/slashDark': { alpha: 0.25 },
    'seedling:player/ghostSword': { alpha: 0.25 },
    // `LavaRunner.as:121-126`, `BossTotemShot.as:86-92`, `Explosion.as:75-81`, `SlashHit.as:26-32`: the same picture.
    'seedling:enemy/lavarunner': { alpha: 'same' },
    'seedling:projectile/bosstotemshot': { alpha: 'same' },
    'seedling:fx/explosion': { alpha: 'same' },
    'seedling:fx/slashhit': { alpha: 'same' },
    // `Droplet.as:99-105`: "NOT RESTORATIVE" — the same frame, tint and alpha.
    'seedling:fx/droplet': { alpha: 'same' },
    // `TurretSpit.as:77-85`: at 0.1.
    'seedling:projectile/turretspit': { alpha: 0.1 },
    // `Grenade.as:115-123`: alpha · 0.5.
    'seedling:enemy/grenade': { alpha: (op) => (op.alpha ?? 1) * 0.5 },
    // `Building.as:46-57`: the mound (building 8) only.
    'seedling:scenery/building8': { alpha: 'same' },
    // `Crusher.as:107-123`: the picture (and its four lanes, `crusherLanes`).
    'seedling:puzzlement/crusher': { alpha: 'same' },
    // `LavaChain.as:63-73`: only while its anim is "hit".
    'seedling:puzzlement/lavachain': { alpha: 'same', when: (op, ctx) => ctx.hitChains.has(`${opCentre(op).x},${opCentre(op).y}`) },
});

/**
 * A TILE's night copy, by art key (`Tile.as:124-487`), as its alpha at `Game.time` = `time`; `phases` = 100.
 * `r0` is the tile's cosmetic draw (`randVal`, ⚖ never modelled: `cosmeticRand`).
 */
const sinPulse = (time, n, loops, div, phase = 0) => (Math.sin((worldFrame(time, n, loops) / div) * 2 * Math.PI + phase) + 1) / 2;
export const TILE_NIGHT = Object.freeze({
    'seedling:tile/darkStone': (time) => sinPulse(time, 100, 5, 100), // `:185-191`
    'seedling:tile/igneousStone': () => 0.25, // `:196-201`, `igneousAlpha`
    'seedling:tile/lava': () => 1, // `:240-244`
    'seedling:tile/iceWall': (time, ctx) => (ctx.snowing ? null : sinPulse(time, 60, 5, 60) * 0.3 + 0.1), // `:262-272`
    'seedling:tile/iceWallGlowing': (time, ctx) => (ctx.snowing ? null : sinPulse(time, 60, 5, 60) * 0.3 + 0.1), // `:277-287`
    'seedling:tile/ghostTile': (time) => sinPulse(time, 100, 3, 99) * 0.05, // `:331-339`
    'seedling:tile/bridge': (time) => sinPulse(time, 100, 3, 99) * 0.1, // `:364-375` (G1 never draws the opening)
    'seedling:tile/ghostTileStep': (time) => sinPulse(time, 100, 3, 99) * 0.05, // `:380-386`
    'seedling:tile/igneousToLava': () => 0.25, // `:428-433`
    'seedling:tile/fuchsiaTile': (time, ctx, r0) => sinPulse(time, 100, 4, 100, r0 * 2 * Math.PI) * 0.75 + 0.25, // `:445-451`
});

/** An op's anchor point: its pivot (a sprite from `spriteOp`), else its box's centre. */
function opCentre(op) {
    if (op.pivotX !== undefined) return { x: op.dx + op.pivotX, y: op.dy + op.pivotY };
    return { x: op.dx + op.sw / 2, y: op.dy + op.sh / 2 };
}

/** A copy of a sprite op with its own alpha (1 = the field absent, as `drawOp` reads it). */
function withAlpha(op, alpha, extra = {}) {
    const { still: _still, alpha: _a, ...rest } = op;
    return { ...rest, ...(alpha !== 1 ? { alpha } : {}), ...extra };
}

/** `Crusher.as:115-121`: the four lanes, white, onto nightBmp (`Draw.rect`'s defaults: 0xFFFFFF, alpha 1). */
const CRUSHER = Object.freeze({ intDist: 64, w: 32, h: 32, ox: 16, oy: 16 });
export function crusherLanes({ x, y }, layer) {
    const C = CRUSHER;
    return [[1, 0], [0, -1], [-1, 0], [0, 1]].map(([dx, dy]) => {
        const rx = Math.trunc(x + (-C.ox + C.intDist * (dx < 0 ? dx : 0)));
        const ry = Math.trunc(y + (-C.oy + C.intDist * (dy < 0 ? dy : 0)));
        const w = C.w + C.intDist * Math.abs(dx);
        const h = C.h + C.intDist * Math.abs(dy);
        return { rect: { x: rx, y: ry, w, h, right: rx + w, bottom: ry + h }, colour: WHITE, alpha: 1, layer };
    });
}

/**
 * `BossTotem.getLaserRect(dir, headPos, laserPos)` (`:658-670`) for the RENDER's head pose: sweep down from
 * `headPos + laserPos` a pixel at a time to the first "Solid".
 */
const LASER_POS = Object.freeze({ x: -8, y: -11 });
export function totemLaserRects(t, head, isSolid) {
    const lw = t.laserWidth;
    const sx = head.x + LASER_POS.x;
    const sy = head.y + LASER_POS.y;
    const out = [];
    for (const dir of [1, -1]) {
        let i = 0;
        for (; i < 160; i += 1) {
            const px = t.x + sx * dir - (dir < 0 ? lw : 0);
            const py = t.y + sy + i;
            if (isSolid({ x: px, y: py, w: lw, h: 1, right: px + lw, bottom: py + 1 })) break;
        }
        const x = t.x + sx * dir - lw / 2;
        out.push({ x, y: t.y + sy, w: lw, h: i, right: x + lw, bottom: t.y + sy + i });
    }
    return out;
}

/**
 * THE MAIN-BUFFER OPS the lights add (Y-sorted with the room, so the page hands them to `roomOps` with the
 * bodies): a light ray's two rects (`LightRay.as:30-33`: the shaft at 0.2, then the head SCREENed at a/2) and an
 * UNLIT pole's `darkLight` circles (black, 0.8, on the screen). `cam` = the model's camera rect.
 */
export function nightMainOps(view, { cam }) {
    if (!view) return [];
    const ops = [];
    for (const r of view.sources.rays) {
        if (r.y - cam.y + r.h < 0) continue;
        const shaft = { x: r.x, y: cam.y, w: r.w, h: r.y - cam.y + r.h };
        ops.push({ rect: { ...shaft, right: shaft.x + shaft.w, bottom: shaft.y + shaft.h }, colour: r.colour, alpha: 0.2, layer: r.layer });
        ops.push({ rect: { x: r.x, y: r.y, w: r.w, h: r.h, right: r.x + r.w, bottom: r.y + r.h }, colour: r.colour, alpha: r.alpha / 2, layer: r.layer, blend: 'screen' });
    }
    if (view.poles) {
        const layer = lightLayer(view.room.height);
        for (const p of view.sources.poles) {
            if (view.poles.get(p.id) !== false) continue;
            ops.push(...lightCircles({ ...poleAt(p, view.gameTime), colour: '#000000', alpha: 0.8 }, view.gameTime, layer));
        }
    }
    return ops;
}

/** `LightPole.render()` (`:61`): the bob `2 · sin(2π · (time % 45) / 45)` about the pole's centre minus its 8 px origin. */
function poleAt(p, time) {
    return { ...p, y: p.startY - 8 + 2 * Math.sin((2 * Math.PI * ((((time ?? 0) % 45) + 45) % 45)) / 45) };
}

/**
 * THE NIGHT FRAME at the tick `skin` was stepped to: `{ alpha, ops, solid }` — `ops` are drawn onto the night
 * canvas (filled `NIGHT.fill`) in FlashPunk's layer order, `solid` onto a clear canvas that is then HARDLIGHTed
 * onto it, and the night canvas is MULTIPLIED onto the room at `alpha`. Null when the composite is 0 (a room with
 * no `lightalpha` and no `daynight`): the game's night canvas there changes no pixel.
 *
 * @param {object} view  `nightSkinView`
 * @param {object} art
 * @param {object} o
 * @param {object} o.skin   `stepNightSkin`'s state
 * @param {object[]} o.ops  the room's main ops (`roomOps`, with every body): the copies are made from them
 * @param {object} [o.hazard] `{ view, skin }` — G3c's (the chains' anims, the grenades' hit, the totem's pose)
 * @param {object} [o.whiteOut] G4's `effectSkinView(...).whiteOut`, and `o.whiteOutAlpha` its alpha rule
 * @param {object} o.cam    the model's camera rect (the screen-anchored writes)
 */
export function nightOps(view, art, { skin = null, ops = [], hazard = null, whiteOut = null, whiteOutAlpha = null, cam, rules = NIGHT_RULES } = {}) {
    if (!view) return null;
    const R = rules === NIGHT_RULES ? rules : { ...NIGHT_RULES, ...rules };
    const time = view.gameTime ?? 0;
    const alpha = R.nightAlpha(view.night, time);
    if (alpha <= 0) return null;
    const night = [];
    const solid = [];
    const ctx = { snowing: view.night.snowing, hitChains: new Set() };
    for (const c of hazard?.view?.chains ?? []) {
        const st = hazard.skin?.bodies?.get(`c:${c.id}`);
        if (st && !st.unknown && st.anim?.anim === 'hit') ctx.hitChains.add(`${c.x},${c.y}`);
    }
    const level = view.level;

    // 1. the copies, in the room's own order (the main list is already layer-sorted)
    for (const op of ops) {
        if (!op?.key) continue;
        const tileRule = op.layer === TILE_LAYER ? R.tileNight[op.key] : null;
        if (tileRule) {
            const cell = op.fallback?.rect ?? { x: op.dx, y: op.dy };
            const k = tileRule(time, ctx, cosmeticRand(level, Math.round(cell.x / TILE), Math.round(cell.y / TILE), 0));
            if (k !== null && k > 0) night.push(withAlpha(op, k));
            if (op.key === 'seedling:tile/lava') solid.push(...R.lavaEdges(edgeFrameOf(op, cell, art, level, skin), cell, time));
            continue;
        }
        const rule = R.copies[op.key];
        if (!rule || (rule.when && !rule.when(op, ctx))) continue;
        const k = rule.alpha === 'same' ? (op.alpha ?? 1) : (typeof rule.alpha === 'function' ? rule.alpha(op, ctx) : rule.alpha);
        if (k > 0) night.push(withAlpha(op, k));
        if (op.key === 'seedling:puzzlement/crusher') night.push(...R.crusherLanes(opCentre(op), op.layer));
    }

    // 2. the Boss Totem: each part SCREENed at scale + 0.1 (`renderPart`, `:672-695`), its laser and its white-out
    for (const t of hazard?.view?.totems ?? []) {
        if (!t.activated) continue;
        const st = hazard.skin?.bodies?.get(`t:${t.id}`);
        if (!st) continue;
        const stage = totemActivationStage(t.sinceActivation);
        for (const op of ops) {
            if (op?.key !== 'seedling:enemy/bosstotem') continue;
            const k = stage < 1 ? stage : (op.alpha ?? 1);
            if (k > 0) night.push(withAlpha(op, k, { scaleX: (op.scaleX ?? 1) * 1.1, scaleY: (op.scaleY ?? 1) * 1.1, blend: 'screen' }));
        }
        const head = totemParts(hazard.view, t, st).find((p) => p.part === 'head');
        if (head && head.angle === 0 && view.world?.collidesSolid && stage > 0) {
            const H = { x: head.at.x - t.x, y: head.at.y - t.y };
            const colour = totemLaserTint(t.laserWidth) ?? WHITE;
            const layer = t.activated ? -(t.y + 12 + 32) : 0;
            for (const r of R.totemLaserRects(t, H, (b) => !!view.world.collidesSolid(b))) {
                night.push({ rect: r, colour, alpha: stage, layer });
            }
        }
    }
    if (whiteOut && whiteOutAlpha && cam) {
        night.push({ rect: { x: cam.x, y: cam.y, w: cam.w, h: cam.h, right: cam.x + cam.w, bottom: cam.y + cam.h }, colour: WHITE,
            alpha: whiteOutAlpha(whiteOut), layer: -Infinity });
    }

    // 3. the shadows and the rays' night shafts (the rays' SCREEN blend is still set: `LightRay.as:32-36`)
    for (const s of view.sources.shadows) night.push({ rect: s.rect, colour: s.colour, alpha: s.alpha, layer: s.layer });
    for (const r of view.sources.rays) {
        if (!cam || r.y - cam.y + r.h < 0) continue;
        const h = r.y - cam.y + r.h;
        night.push({ rect: { x: r.x, y: cam.y, w: r.w, h, right: r.x + r.w, bottom: cam.y + h }, colour: r.colour, alpha: r.alpha, layer: r.layer, blend: 'screen' });
    }

    // 4. the Lights, after every body (one layer for all)
    const L = lightLayer(view.room.height);
    for (const l of view.sources.lights) night.push(...R.lightCircles(l, time, L));
    for (const p of view.sources.plantTorches) {
        // `PlantTorch.render()` (:46-52): alpha = 0.2 · max(1 − distance(torch, player) / distance, 0)²
        const d = Math.hypot(p.cx - view.player.x, p.cy - view.player.y);
        const k = R.plantAlpha(d, p.distance);
        if (k > 0) night.push(...R.lightCircles({ ...p, alpha: k }, time, L));
    }
    for (const o of view.sources.orbs) {
        // `Orb.update()` (:49-58): the float about its start, phased by `randVal` (cosmetic: `cosmeticRand`)
        const rv = cosmeticRand(level, o.sx, o.sy, 7);
        const f = worldFrame(time, 100, 4) / 99 + rv;
        night.push(...R.lightCircles({ ...o, x: o.sx + 5 * Math.sin(f * 4 * Math.PI), y: o.sy + 5 * Math.sin(f * 2 * Math.PI) }, time, L));
    }
    if (view.poles) {
        for (const p of view.sources.poles) if (view.poles.get(p.id)) night.push(...R.lightCircles(poleAt(p, time), time, L));
    }
    for (const g of hazard?.view?.grenades ?? []) {
        // `Grenade.as:93-99, 136`: Light(x, endY, 2, 1, yellow, false, 20, 20, 1), alpha 1 − index / 2 while "hit"
        const st = hazard.skin?.bodies?.get(`g:${g.id}`);
        if (st?.anim !== 'hit') continue;
        const k = 1 - st.sprite.index / 2;
        if (k > 0) night.push(...R.lightCircles({ x: g.x, y: g.endY, frames: 2, loops: 1, colour: YELLOW, smooth: false, rmin: 20, rmax: 20, alpha: k }, time, L));
    }
    if (skin?.playerLight && sameVisit(skin.epoch, view.epoch)) {
        const P = PLAYER_LIGHT;
        night.push(...R.lightCircles({ ...skin.playerLight, frames: P.frames, loops: P.loops, smooth: true, rmin: P.rmin, rmax: P.rmax,
            alpha: P.alpha, colour: R.playerLightColour(time) }, time, L));
    }
    return { alpha, ops: layerSorted(night), solid };
}

/**
 * The frame a lava tile's `myEdges` was BAKED from (`Tile.as:210-223`: built on the tile's first render, never
 * again): its `flow` frame at the visit's first tick (`skin.visitTick`), with the renderer's own phase
 * (`TILE_ART`'s `floor(r · frames)`, `r` = `cosmeticRand(level, tx, ty, 0)`). Without a skin, the op's own frame.
 * ⚠ Band: the game's first render of an off-screen tile is when it first comes on screen; the room view bakes all
 * of them at the visit's first tick.
 */
function edgeFrameOf(op, cell, art, level, skin) {
    if (!skin || skin.visitTick === undefined || !art?.frameAt) return op;
    const frames = art.resolve(op.key)?.sprite?.anims?.flow?.frames?.length ?? 1;
    const phase = Math.floor(cosmeticRand(level, Math.round(cell.x / TILE), Math.round(cell.y / TILE), 0) * frames);
    const fr = art.frameRect(op.key, art.frameAt(op.key, 'flow', skin.visitTick, phase) ?? 0);
    return fr ? { key: op.key, sheetRef: fr.sheetRef, sx: fr.sx, sy: fr.sy, sw: fr.sw, sh: fr.sh } : op;
}

/**
 * `Tile.as:206-238`: a lava tile's `myEdges` — its baked frame (`edgeFrameOf`) at 1.5× tinted yellow at 0.4, then
 * at 1.25× (still yellow) — drawn onto `solidBmp` at the tile's centre, scaled by `sin(worldFrame(10, 2) / 10 · 2π)
 * · 0.1 + 1`.
 */
function lavaEdges(op, cell, time) {
    const sc = Math.sin((worldFrame(time, 10, 2) / 10) * 2 * Math.PI) * 0.1 + 1;
    const cx = cell.x + TILE / 2;
    const cy = cell.y + TILE / 2;
    const base = { key: op.key, sheetRef: op.sheetRef, sx: op.sx, sy: op.sy, sw: op.sw, sh: op.sh, rot: 0, flipX: false, flipY: false,
        dx: cx - op.sw / 2, dy: cy - op.sh / 2, pivotX: op.sw / 2, pivotY: op.sh / 2, tint: YELLOW, layer: TILE_LAYER, fallback: null };
    return [{ ...base, scaleX: 1.5 * sc, scaleY: 1.5 * sc, alpha: 0.4 }, { ...base, scaleX: 1.25 * sc, scaleY: 1.25 * sc }];
}

/** `PlantTorch.render()` (`:46-50`): `0.2 · max(1 − d / distance, 0)²`. */
const plantAlpha = (d, distance) => 0.2 * Math.max(1 - d / distance, 0) ** 2;

/**
 * THE SWAPPABLE RULES (a test's MUTANT replaces one): the composite's alpha, a Light's circles, the tile glows,
 * the copies, the lava's edges, the crusher's lanes, the laser, the plant torch's fade, the torch light's colour
 * and its follow step.
 */
export const NIGHT_RULES = Object.freeze({
    nightAlpha, lightCircles, tileNight: TILE_NIGHT, copies: NIGHT_COPIES, lavaEdges, crusherLanes, totemLaserRects,
    plantAlpha, playerLightColour, followStep,
});

/** FlashPunk's order: the highest layer first, ties in push order (a stable sort). */
function layerSorted(ops) {
    return ops.map((op, i) => [op, i]).sort((a, b) => (b[0].layer - a[0].layer) || (a[1] - b[1])).map(([op]) => op);
}

/** One night op as a golden line (`formatOp`'s grammar, plus a circle and a blend). */
export function formatNightOp(op) {
    const blend = op.blend ? ` blend=${op.blend}` : '';
    if (op.circle) return `circle(${op.colour}, ${op.circle.x}, ${op.circle.y}, ${+op.circle.r.toFixed(4)}) alpha=${+op.alpha.toFixed(4)}`;
    if (!op.sheetRef) {
        const r = op.rect;
        return `fillRect(${op.colour}, ${+r.x.toFixed(4)}, ${+r.y.toFixed(4)}, ${+r.w.toFixed(4)}, ${+r.h.toFixed(4)}) alpha=${+op.alpha.toFixed(4)}${blend}`;
    }
    const t = [op.rot ? ` rot=${op.rot}` : '', op.flipX ? ' flipX' : '', op.scaleX !== undefined ? ` scale=${+op.scaleX.toFixed(4)}x${+op.scaleY.toFixed(4)}` : '',
        op.alpha !== undefined ? ` alpha=${+op.alpha.toFixed(4)}` : '', op.tint ? ` tint=${op.tint}` : ''].join('');
    return `drawImage(${op.sheetRef}, ${op.sx}, ${op.sy}, ${+op.dx.toFixed(4)}, ${+op.dy.toFixed(4)})${t}${blend}`;
}

/** WHAT G5 DRAWS, from the census of every `nightBmp` / `solidBmp` writer in the AS3 (§5.135). */
export const NIGHT_COVERAGE = Object.freeze({
    drawn: Object.freeze([
        'the night composite (lightalpha, daynight; Game.bufferTransforms)',
        'Light: Torch, BoneTorch, PlantTorch (player-distance alpha), Orb (float), LightPole (lit / darkLight, lightPolesNow), the grenade light, PlayerLight (hasTorch)',
        'tile glows: darkStone, igneousStone, lava (+ solidBmp edges, HARDLIGHT), iceWall(s) unless snowing, ghostTile(s), bridge, igneousToLava, fuchsiaTile',
        'copies: the dark-suit body, the slash, LavaRunner, BossTotemShot, Explosion, SlashHit, Droplet, TurretSpit, Grenade, the mound (building 8), Crusher (+ its lanes), LavaChain (hit)',
        'the Boss Totem: its parts SCREENed, its LASER, its white-out rect',
        'Shadow, LightRay (night shaft + its two screen rects)',
    ]),
    remaining: Object.freeze([
        'the PlayerLight sprite (PlayerLight.png is not in the pack)', 'Wire (not drawn by G1)', 'DarkTrap\'s die1 copy (no dark-trap picture)',
        'the copies of classes G1–G4b draw as rectangles or not at all: Lock, RockLock, BossLock, BossKey, the pickups (GhostSword, FireWand, Wand, '
            + 'TorchPickup, HealthPickup), Pulser, BeamTower, Pull, PushableBlockFire, LavaTrap, LavaBoss, LightBoss, LightBossTotem, Moonrock, '
            + 'TreeLarge, FrozenBoss, FinalDoor, SealController, Help, WandShot, RayShot, LavaBall, the spear / fire / death ray / dark shield',
        'the slash-narrow blur copies (Player.as:1201-1212)', 'snow, the blizzard and the black-and-white pass (not nightBmp)',
        'the underwater colour transform', 'Teleporter: no graphic (renderLight copies an empty graphic)',
    ]),
});

