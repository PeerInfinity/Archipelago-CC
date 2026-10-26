/**
 * seedlingDemo/seedlingMachineSkin — **THE MACHINES, IN THE ORIGINAL GRAPHICS**
 * (Seedling JS graphics G9b): BeamTower, Pulser, Wire, Whirlpool, Pull, Pod,
 * LittleStones (+ its grass), Moonrock, MoonrockPile, FinalDoor. G7's three
 * pieces again:
 *
 *   · `machineSkinView(run, { record })` — THE ONE ADAPTER. It copies; it writes nothing.
 *   · `stepMachineSkin(prev, view, tick)` — the renderer's own count: the tick a
 *     visit began, each wire's latched `on`, each Pull's radius.
 *   · `machineOps(view, art, { skin })` — PURE. The main-buffer ops (Y-sorted with the
 *     room); `machineNightOps(view, { skin })` the ones a class draws onto nightBmp
 *     ONLY (the Pull's circle), which `nightOps` takes as `extra`.
 *
 * ── What AS3 does, transcribed (`vendor/seedling/src`) ─────────────────
 *
 *   · BEAMTOWER (`Puzzlements/BeamTower.as`) — its Spritemap frame and `y` are the
 *     run's (`machinesNow`, ⚖ fidelity-14 2026-10-26); `layer = -y` at its build.
 *     `render()`: `a = 0` on "sit", else 0.1 on a side's first frame and 1 on its
 *     second (the firing one); the beam is `n` (5 sideways, 4 vertical)
 *     `Draw.linePlus` from `getLine(d, i)` to the level's edge, red at the two
 *     outer lines and yellow inside, at alpha `a`, onto the main buffer and again
 *     onto nightBmp — before the body when it beams up, after it otherwise. A
 *     tower whose clock or `y` the run lost (`animKnown` / `yKnown` false) is its
 *     stand-in rectangle (⚖ fidelity-14: the band, never a guessed frame).
 *   · PULSER (`Puzzlements/Pulser.as`) — `radius`, `anim` and its tick are the run's
 *     (`machinesNow`). `render()`: while `radius > 10`, `circlePlus(x, y, radius,
 *     yellow, rVal, fill = false, (8 − 1)·rVal + 1)` with `rVal = 1 − radius/28`,
 *     and again onto nightBmp two thicker; then the body onto nightBmp, then the
 *     body. Frame: "pulse" [0..4] at 20 fps, else 0.
 *   · WIRE (`Scenery/Wire.as`) — `img` from its `.oel` (or, when −1, `check()`'s
 *     4-neighbour mask against Wire / ButtonRoom boxes and the level's edge); `on`
 *     LATCHES: `render()` sets it from a pressed neighbour ButtonRoom or a lit
 *     neighbour Wire and nothing ever sets it false. Here: a wire is on once a
 *     ButtonRoom it is wired to (through wires, `activatorsNow.pressers`' `down`)
 *     has been down this visit. ⚠ Band: the game lights a chain over its render
 *     order, a frame or two. Tinted 0xFFFF00 on / 0x404040 off, at (x, y), and on
 *     nightBmp at 0.1 while on.
 *   · WHIRLPOOL (`Puzzlements/Whirlpool.as`) — centred on its 2×2 cells, alpha 0.5,
 *     frame `whirlFrames[worldFrame(16)]`; its angle starts at `Rng.cos()·360` (⚠ the
 *     cosmetic band: `cosmeticRand`, ⚖ never model the cosmetic RNG) and gains 20°
 *     each render (counted as the visit's ticks; ⚠ band: a frozen frame renders too).
 *   · PULL (`Puzzlements/Pull.as`) — draws ONLY onto nightBmp: `circlePlus(centre,
 *     radius, red, count/3)`. `update()`: `radius += 0.5` per colliding body, 0 with
 *     none, else `radius % (√(16² + 16²)/2)`. The model transcribes the PLAYER arm
 *     only (it refuses a Pull room with blocks or spinners), so the count is the
 *     player's overlap — re-derived here per tick (⚠ band: the order the Pull and
 *     the player update in, one tick).
 *   · POD (`Scenery/Pod.as`) — `run.owlPods` (`anim`, `animAge`) when the run has the
 *     Owl's room built; else the ctor's own "open" from the visit's start.
 *     "open" [0..6] / "close" [6..0] at 10 fps, "opened" 6, "closed" 0; alpha 0.5;
 *     `layer = frame ≤ 3 ? −(y + 48) : body − 1`. Its body (`PodBody`) at
 *     `−(y − 48)`.
 *   · LITTLESTONES (`Scenery/LittleStones.as`) — the Image at (x, y), `layer = −y`,
 *     and its five `Grass` blades (`Scenery/Grass.as`: frame `startIndex +
 *     worldFrame(2)`, `startIndex` from `Rng.cos()` — the cosmetic band). ⚠ PENDING:
 *     a CUT blade (frame 0, the fire's grey) — the run does not carry grass cuts.
 *   · MOONROCK (`Scenery/Moonrock.as`) — the run's rock (`moonrock.rocks`: `y`,
 *     `fallTo`, `trigger`, `canBeam`), frame `worldFrame(7)`, `layer = −(fallTo + 24)`,
 *     the body again onto nightBmp. While it beams (`!trigger && beam && canBeam`):
 *     the white shaft rect, and 20 `linePlus` flares whose colour, offset, alpha and
 *     thickness are `Rng.cos()` draws (the cosmetic band) — on both buffers.
 *   · MOONROCKPILE (`Scenery/MoonrockPile.as`) — the Image at (x, y) where the world
 *     built it (it APPEARS on a clear), `layer = −(y + 16·4/5)`.
 *   · FINALDOOR (`Scenery/FinalDoor.as`) — `run.finalDoors`: frame 0 until it opens,
 *     then "open" [1,1,1,1,2..25] at 15 fps by `openUpdates`; gone once removed; and
 *     again onto nightBmp. `layer = −(y + 16)`.
 *
 * ⛔ THE RENDERER ONLY READS: `machinesNow`, `activatorsNow`, `pulls`, `owlPods`,
 * `moonrock`, `finalDoors`, `world`, `state`, `gameTime`, and the room's record.
 */
import { rectOp, spriteOp, worldFrame } from './seedlingEnemySkin.js';
import { cosmeticRand } from './seedlingSkinRenderer.js';
import { PROFILE } from './seedlingProfile.js';
import { playerBoxAt } from './playerPhysicsV2.js';

export const KEYS = Object.freeze({
    beamTower: 'seedling:machine/beamtower',
    pulser: 'seedling:machine/pulser',
    wire: 'seedling:machine/wire',
    whirlpool: 'seedling:machine/whirlpool',
    littleStones: 'seedling:scenery/littlestones',
    grass: 'seedling:scenery/grass',
    moonrock: 'seedling:scenery/moonrock',
    moonrockPile: 'seedling:scenery/moonrockpile',
    pod: 'seedling:scenery/pod',
    podBody: 'seedling:scenery/podbody',
    finalDoor: 'seedling:scenery/finaldoor',
});

/** WHAT G9b DRAWS, by AS3 class. */
export const MACHINE_COVERAGE = Object.freeze({
    drawn: Object.freeze(['BeamTower', 'Pulser', 'Wire', 'Whirlpool', 'Pull', 'Pod', 'LittleStones', 'Moonrock', 'MoonrockPile',
        'FinalDoor']),
    pending: Object.freeze(['Grass: a cut blade (the run carries no grass cuts)']),
});
/** The `.oel` tags whose build-time rectangle this skin replaces (`roomOps`' `drawnObjects`). */
export const MACHINE_OBJECT_TAGS = Object.freeze(new Set(['beamtower', 'pulser', 'moonrockpile', 'finaldoor', 'moonrock']));

const MACHINE_COLOUR = '#a0a0c0';
const YELLOW = '#ffff00';
const RED = '#ff0000';
const WHITE = '#ffffff';
const FP_ELAPSED = PROFILE.fpMaxElapsed;
/** `Pulser.as` radii and thickness. */
const PULSE = Object.freeze({ min: 10, max: 28, thickMin: 1, thickMax: 8, lightExtra: 2, frames: [0, 1, 2, 3, 4], fps: 20 });
/** `Whirlpool.as` `whirlFrames`, `spinRate`, `maxAlpha`. */
const WHIRL = Object.freeze({ frames: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1], spin: 20, alpha: 0.5 });
/** `Pull.as`: `radiusRate`, `maxEntitiesAlpha`, and the wrap `√(w² + h²)/2`. */
const PULL = Object.freeze({ rate: 0.5, maxCount: 3, wrap: Math.sqrt(16 * 16 + 16 * 16) / 2 });
/** `Pod.as` anims (10 fps). */
const POD_ANIMS = Object.freeze({ open: [0, 1, 2, 3, 4, 5, 6], opened: [6], close: [6, 5, 4, 3, 2, 1, 0], closed: [0] });
/** `FinalDoor.as` "open" (15 fps). */
const DOOR_OPEN = Object.freeze([1, 1, 1, 1, ...Array.from({ length: 24 }, (_, i) => i + 2)]);
/** `LittleStones.as` grass positions. */
const GRASS_AT = Object.freeze([[1, 14], [1, 9], [9, 14], [5, 1], [1, 6]]);
/** `Grass.png` 15 × 4 at 3 × 4 → `frameCount` 5. */
const GRASS_FRAMES = 5;

/** A FlashPunk `Spritemap`'s index after `updates` updates of an anim at `fps` (repeated addition, as `update()` does). */
export function animIndex(fps, updates, length, loop = false) {
    let timer = 0;
    let index = 0;
    for (let u = 0; u < updates; u += 1) {
        timer += fps * FP_ELAPSED;
        while (timer >= 1) {
            timer -= 1;
            index += 1;
            if (index >= length) index = loop ? 0 : length - 1;
        }
    }
    return index;
}

const sameVisit = (a, b) => !!a && !!b && a.run === b.run && a.key === b.key;
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** `Wire.check()`'s mask: +1 right, +2 up, +4 left, +8 down (a Wire/ButtonRoom box half a tile over, or the edge). */
export function wireMask(w, boxes, size) {
    const hits = (dx, dy) => boxes.some((b) => b !== w.box && b.x < w.x + dx + 16 && b.right > w.x + dx && b.y < w.y + dy + 16 && b.bottom > w.y + dy);
    let img = 0;
    if (hits(8, 0) || w.x + 16 + 1 >= size.width) img += 1;
    if (hits(0, -8) || w.y - 1 < 0) img += 2;
    if (hits(-8, 0) || w.x - 1 < 0) img += 4;
    if (hits(0, 8) || w.y + 16 + 1 >= size.height) img += 8;
    return img;
}

/** The room's wires (each with its `check()` mask) and ButtonRooms — static per record, so built once (a 70-wire room's mask is O(n²)). */
const WIRING = new WeakMap();
function wiringOf(record, size) {
    const key = record ?? WIRING;
    const hit = WIRING.get(key);
    if (hit && hit.w === size.width && hit.h === size.height) return hit.out;
    const ents = record?.entities ?? [];
    const rooms = ents.filter((e) => e.type === 'buttonroom').map((e) => {
        const x = num(e.x);
        const y = num(e.y);
        return { id: `buttonroom@${x},${y}`, x, y, box: { x: x + 4, y: y + 5, right: x + 12, bottom: y + 11 } };
    });
    const wires = ents.filter((e) => e.type === 'wire').map((e) => {
        const x = num(e.x);
        const y = num(e.y);
        return { id: `wire@${x},${y}`, x, y, img: num(e.attrs?.img, -1), box: { x, y, right: x + 16, bottom: y + 16 } };
    });
    const boxes = [...wires.map((w) => w.box), ...rooms.map((r) => r.box)];
    for (const w of wires) if (w.img < 0) w.img = wireMask(w, boxes, size);
    const out = { rooms: Object.freeze(rooms.map(({ box, ...r }) => Object.freeze(r))), wires: Object.freeze(wires.map(({ box, ...w }) => Object.freeze(w))) };
    if (record) WIRING.set(record, { w: size.width, h: size.height, out });
    return out;
}

/** THE ADAPTER (null when there is no run). `record` is the room's level record (`{entities}`). */
export function machineSkinView(run, { record = null } = {}) {
    if (!run?.state) return null;
    const ents = record?.entities ?? [];
    const size = run.world?.world ? { width: run.world.world.width, height: run.world.world.height } : { width: 160, height: 160 };
    const machines = run.machinesNow ?? { pulsers: [], beamTowers: [] };
    const acts = run.activatorsNow ?? null;
    const { rooms: roomCells, wires } = wiringOf(record, size);
    const down = new Map((acts?.pressers ?? []).map((p) => [p.id, !!p.down]));
    const rooms = roomCells.map((r) => ({ ...r, down: down.get(r.id) === true }));
    const objectAt = new Set((run.world?.objectSolids ?? []).map((o) => `${o.tag}@${o.x},${o.y}`));
    const pods = run.owlPods ?? [];
    const player = { x: run.state.x, y: run.state.y };
    const mr = run.moonrock ?? null;
    return {
        epoch: { run, key: `${run.level}|${run.transitions?.length ?? 0}|${run.playerDeaths?.length ?? 0}` },
        level: run.level,
        gameTime: run.gameTime ?? null,
        size,
        player,
        beamTowers: machines?.beamTowers ?? [],
        pulsers: machines?.pulsers ?? [],
        wires,
        rooms,
        whirlpools: ents.filter((e) => e.type === 'whirlpool').map((e) => ({ id: `whirlpool@${num(e.x)},${num(e.y)}`, x: num(e.x) + 16, y: num(e.y) + 16 })),
        pulls: (run.pulls ?? []).map((p) => ({ id: p.id, x: p.x, y: p.y })),
        pods: ents.filter((e) => e.type === 'pod').map((e) => {
            const x = num(e.x) + 8;
            const y = num(e.y) + 8;
            const live = pods.find((p) => p.x === x && p.y === y) ?? null;
            return { id: `pod@${num(e.x)},${num(e.y)}`, x, y, anim: live?.anim ?? null, animAge: live?.animAge ?? null };
        }),
        stones: ents.filter((e) => e.type === 'littlestones').map((e) => ({ x: num(e.x), y: num(e.y) })),
        piles: ents.filter((e) => e.type === 'moonrockpile' && objectAt.has(`moonrockpile@${num(e.x)},${num(e.y)}`))
            .map((e) => ({ x: num(e.x), y: num(e.y) })),
        rocks: (mr?.rocks ?? []).map((r) => ({ id: r.id, x: r.x, y: r.y, fallTo: r.fallTo, beaming: !r.trigger && !!mr.beam && !!r.canBeam })),
        doors: (run.finalDoors ?? []).filter((d) => !d.removed).map((d) => ({ id: d.id, x: d.x, y: d.y, opening: d.opening, openUpdates: d.openUpdates })),
    };
}

/** THE REDUCER: the visit's first tick, the wires that have lit, each Pull's radius. */
export function stepMachineSkin(prev, view, tick) {
    if (!view) return null;
    const same = !!prev && sameVisit(prev.epoch, view.epoch);
    const lit = new Set(same ? prev.lit : []);
    // a lit ButtonRoom lights every wire chained to it (4-neighbours one tile apart); `on` never goes false
    const byCell = new Map(view.wires.map((w) => [`${w.x},${w.y}`, w]));
    const queue = [];
    for (const r of view.rooms) {
        if (!r.down) continue;
        for (const [dx, dy] of [[16, 0], [-16, 0], [0, 16], [0, -16]]) {
            const w = byCell.get(`${r.x + dx},${r.y + dy}`);
            if (w && !lit.has(w.id)) { lit.add(w.id); queue.push(w); }
        }
    }
    for (const w of view.wires) if (lit.has(w.id)) queue.push(w);
    while (queue.length) {
        const w = queue.pop();
        for (const [dx, dy] of [[16, 0], [-16, 0], [0, 16], [0, -16]]) {
            const n = byCell.get(`${w.x + dx},${w.y + dy}`);
            if (n && !lit.has(n.id)) { lit.add(n.id); queue.push(n); }
        }
    }
    const pulls = new Map();
    const box = playerBoxAt(view.player.x, view.player.y);
    for (const p of view.pulls) {
        const count = box.right > p.x && box.x < p.x + 16 && box.bottom > p.y && box.y < p.y + 16 ? 1 : 0;
        let radius = (same ? prev.pulls.get(p.id)?.radius : 0) ?? 0;
        radius += PULL.rate * count;
        radius = count <= 0 ? 0 : radius % PULL.wrap;
        pulls.set(p.id, { radius, count });
    }
    return { epoch: view.epoch, visitTick: same ? prev.visitTick : tick, tick, lit, pulls };
}

/** The rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const MACHINE_RULES = Object.freeze({
    worldFrame,
    whirlAngle: (level, w, renders) => (cosmeticRand(level, w.x, w.y, 61) * 360 + WHIRL.spin * renders) % 360,
    grassStart: (level, x, y) => Math.floor((cosmeticRand(level, x, y, 62) * (GRASS_FRAMES - 1)) / 2) * 2 + 1,
    pulseFrame: (p) => (p.anim === 'pulse' ? PULSE.frames[animIndex(PULSE.fps, p.animTick, PULSE.frames.length, true)] : 0),
    doorFrame: (d) => (d.opening ? DOOR_OPEN[animIndex(15, d.openUpdates, DOOR_OPEN.length)] : 0),
    podFrame: (p, visitAge) => {
        const anim = p.anim ?? 'open';
        const age = p.anim ? (p.animAge ?? 0) : visitAge;
        const frames = POD_ANIMS[anim] ?? POD_ANIMS.closed;
        // a one-shot holds its last index: "open" ends on 6 (= "opened"), "close" on 0 (= "closed")
        return frames[animIndex(10, age, frames.length)];
    },
});

/** `BeamTower.getLine(d, n)`: from `(x, y − 8)` to the level's edge. */
export function beamLine(t, n, size) {
    const from = { x: t.cx, y: t.y - 8 };
    switch (t.direction) {
    case 0: from.x += 6; from.y -= 11 - n; return [from, { x: size.width, y: from.y }];
    case 1: from.x -= 2 - n; from.y -= 11; return [from, { x: from.x, y: 0 }];
    case 2: from.x -= 6; from.y -= 11 - n; return [from, { x: 0, y: from.y }];
    case 3: from.x -= 2 - n; from.y -= 5; return [from, { x: from.x, y: size.height }];
    default: return [from, { ...from }];
    }
}

const lineOp = (a, b, colour, alpha, thick, layer) => ({
    line: { x1: a.x, y1: a.y, x2: b.x, y2: b.y, thick }, colour, alpha, layer,
    rect: { x: Math.min(a.x, b.x) - thick, y: Math.min(a.y, b.y) - thick, w: Math.abs(b.x - a.x) + 2 * thick, h: Math.abs(b.y - a.y) + 2 * thick },
});
const ringOp = (x, y, r, colour, alpha, thick, layer) => ({ circle: { x, y, r, thick }, colour, alpha, layer,
    rect: { x: x - r - thick, y: y - r - thick, w: 2 * (r + thick), h: 2 * (r + thick) } });
const circleOp = (x, y, r, colour, alpha, layer) => ({ circle: { x, y, r }, colour, alpha, layer, rect: { x: x - r, y: y - r, w: 2 * r, h: 2 * r } });
const box = (x, y, w, h) => ({ x, y, w, h, right: x + w, bottom: y + h });

/** THE MAIN-BUFFER OPS at the render clock; a body whose key the stack lacks (or whose state the run lost) is its rectangle. */
export function machineOps(view, art, { skin = null, rules = MACHINE_RULES } = {}) {
    if (!view || !art) return [];
    const R = rules === MACHINE_RULES ? rules : { ...MACHINE_RULES, ...rules };
    const time = view.gameTime ?? 0;
    const visit = skin && sameVisit(skin.epoch, view.epoch) ? skin : null;
    const renders = visit ? visit.tick - visit.visitTick + 1 : 1;
    const ops = [];
    const sprite = (key, frame, at, fallbackBox, extra) => {
        const fallback = rectOp(fallbackBox, MACHINE_COLOUR, 0.85, extra.layer);
        const op = art.has(key) ? spriteOp(art, key, frame, at, { ...extra, fallback }) : null;
        ops.push(op ?? fallback);
        return op;
    };

    for (const t of view.beamTowers) {
        const layer = -(t.y);
        if (!t.animKnown || !t.yKnown) { ops.push(rectOp(box(t.cx - 8, t.y - 24, 16, 32), MACHINE_COLOUR, 0.85, layer)); continue; }
        const a = t.anim === 'sit' ? 0 : ((t.frame - 1) % 2 === 0 ? 0.1 : 1);
        const n = t.direction === 0 || t.direction === 2 ? 5 : 4;
        const lines = [];
        if (a > 0) {
            for (let i = 0; i < n; i += 1) {
                const [from, to] = beamLine(t, i, view.size);
                lines.push(lineOp(from, to, i <= 0 || i >= n - 1 ? RED : YELLOW, a, 1, layer));
            }
        }
        if (t.direction === 1) ops.push(...lines);
        const body = sprite(KEYS.beamTower, t.frame, { x: t.cx, y: t.y }, box(t.cx - 8, t.y - 24, 16, 32), { layer });
        if (t.direction !== 1) ops.push(...lines);
        if (body && lines.length) body.nightExtra = lines.map((l) => ({ ...l }));
    }

    for (const p of view.pulsers) {
        const layer = 0;
        let ring2 = null;
        if (p.radius > PULSE.min) {
            const rVal = 1 - p.radius / PULSE.max;
            const thick = (PULSE.thickMax - PULSE.thickMin) * rVal + PULSE.thickMin;
            ops.push(ringOp(p.x, p.y, p.radius, YELLOW, rVal, thick, layer));
            ring2 = ringOp(p.x, p.y, p.radius, YELLOW, rVal, thick + PULSE.lightExtra, layer);
        }
        const body = sprite(KEYS.pulser, R.pulseFrame(p), p, box(p.x - 8, p.y - 8, 16, 16), { layer });
        if (body) {
            body.nightCopy = true;
            if (ring2) body.nightExtra = [ring2];
        }
    }

    for (const w of view.wires) {
        const on = !!visit?.lit.has(w.id);
        const op = sprite(KEYS.wire, w.img, w, box(w.x, w.y, 16, 16), { layer: 0, tint: on ? YELLOW : '#404040' });
        if (op && on) op.nightCopy = true;
    }

    for (const w of view.whirlpools) {
        sprite(KEYS.whirlpool, WHIRL.frames[R.worldFrame(time, WHIRL.frames.length)], w, box(w.x - 16, w.y - 16, 32, 32),
            { layer: 0, alpha: WHIRL.alpha, rot: -R.whirlAngle(view.level, w, renders) });
    }

    for (const p of view.pods) {
        const bodyLayer = -(p.y - 48);
        sprite(KEYS.podBody, 0, p, box(p.x - 12, p.y - 12, 24, 24), { layer: bodyLayer });
        const frame = R.podFrame(p, renders);
        sprite(KEYS.pod, frame, p, box(p.x - 12, p.y - 12, 24, 24), { layer: frame <= 3 ? -(p.y + 48) : bodyLayer - 1, alpha: 0.5 });
    }

    for (const s of view.stones) {
        sprite(KEYS.littleStones, 0, s, box(s.x, s.y, 16, 16), { layer: -s.y });
        for (const [gx, gy] of GRASS_AT) {
            const at = { x: s.x + gx, y: s.y + gy };
            sprite(KEYS.grass, R.grassStart(view.level, at.x, at.y) + R.worldFrame(time, 2), at, box(at.x, at.y, 3, 4), { layer: -at.y });
        }
    }

    for (const p of view.piles) sprite(KEYS.moonrockPile, 0, p, box(p.x, p.y, 32, 16), { layer: -(p.y + (16 * 4) / 5) });

    for (const r of view.rocks) {
        const layer = -(r.fallTo + 24);
        if (r.beaming) {
            const flares = moonrockFlares(r, view.level, renders, layer);
            ops.push(...flares);
            const body = sprite(KEYS.moonrock, R.worldFrame(time, 7), r, box(r.x, r.y, 48, 48), { layer });
            if (body) { body.nightCopy = true; body.nightExtra = flares.map((f) => ({ ...f })); }
            continue;
        }
        const body = sprite(KEYS.moonrock, R.worldFrame(time, 7), r, box(r.x, r.y, 48, 48), { layer });
        if (body) body.nightCopy = true;
    }

    for (const d of view.doors) {
        const body = sprite(KEYS.finalDoor, R.doorFrame(d), d, box(d.x - 16, d.y - 16, 32, 32), { layer: -(d.y + 16) });
        if (body) body.nightCopy = true;
    }
    return ops;
}

/**
 * `Moonrock.drawFlares()`: the white shaft, then 20 lines whose five `Rng.cos()` draws each are the COSMETIC band
 * (`cosmeticRand` keyed by the rock and the visit's render, ⚖ never model the cosmetic RNG).
 */
function moonrockFlares(r, level, renders, layer) {
    const m = 2;
    const cx = r.x + 26;
    const cy = r.y + 26;
    const out = [{ rect: box(cx - 8 - m, cy - m, 16, r.fallTo - r.y + 8), colour: WHITE, alpha: 0.5, layer }];
    for (let i = 0; i < 20; i += 1) {
        const c = (k) => cosmeticRand(level, renders, i, 70 + k);
        const rgb = [192 + 64 * c(0), 192 + 64 * c(1), 192 * c(2)].map((v) => Math.min(255, Math.trunc(v)));
        const colour = `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
        const dx = Math.trunc(16 * 2 * c(3) - 16);
        const dy = Math.trunc(16 * 2 * c(4) - 16);
        out.push(lineOp({ x: cx + dx - m, y: cy - m }, { x: cx + dx - m, y: r.fallTo + 26 + dy - m }, colour, c(5) / 2, c(6) * 3 + 0.5, layer));
    }
    return out;
}

/** THE NIGHT-ONLY OPS (a class that draws nothing on the main buffer): the Pull's circle. */
export function machineNightOps(view, { skin = null } = {}) {
    if (!view) return [];
    const visit = skin && sameVisit(skin.epoch, view.epoch) ? skin : null;
    const out = [];
    for (const p of view.pulls) {
        const st = visit?.pulls.get(p.id);
        if (!st || st.count <= 0) continue;
        // `circlePlus(x − originX + width/2, y − originY + height/2, radius, red, alpha)`
        out.push(circleOp(p.x + 8, p.y + 8, st.radius, RED, st.count / PULL.maxCount, -(p.y + 16)));
    }
    return out;
}
