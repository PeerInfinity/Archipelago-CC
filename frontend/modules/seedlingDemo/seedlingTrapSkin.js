/**
 * seedlingDemo/seedlingTrapSkin — **THE ARROW TRAPS, THE ICE / DARK / LAVA
 * TRAPS AND THE FALLING ROCKS, IN THE ORIGINAL GRAPHICS** (Seedling JS graphics
 * G8). G7's three pieces again (`seedlingPuzzleSkin.js`):
 *
 *   · `trapSkinView(run)` — THE ONE ADAPTER. It copies; it writes nothing.
 *   · `stepTrapSkin(prev, view, tick)` — the renderer's own Spritemaps, one GAME
 *     tick at a time (an ice or dark trap's chomp).
 *   · `trapOps(view, art, { skin })` — PURE. The draw ops, Y-sorted with the room.
 *
 * ── What AS3 does, transcribed (`vendor/seedling/src`) ─────────────────
 *
 *   · ARROW TRAP (`Puzzlements/ArrowTrap.as`) — a 16 × 5 Spritemap centred at
 *     (x + 8, y + 2.5), `Game.worldFrame(frameCount)` at the render; no hitbox,
 *     so `layer = -y`. Its arrows are G3's.
 *   · ICE TRAP (`Enemies/IceTrap.as`) — centred, "chomp" [0,1,2,1] at 10 fps
 *     when the player is within `int(distance) ≤ 8` and it is not chomping
 *     already; its `endAnim` plays "" (back to `Game.worldFrame(2)`). It never
 *     re-layers (`layering` is empty): `layer = -(y − 8 + 16·4/5)`.
 *   · DARK TRAP (`Enemies/DarkTrap.as`) — a `SandTrap` on its own sheet: the sand
 *     trap's chomp within 20 px until a light reaches it, then 30 frozen updates
 *     and "die1" (the run's `darkTraps`: `startDying`, `dieIndex`, removal);
 *     "die1" is drawn again onto nightBmp.
 *   · LAVA TRAP (`Enemies/LavaTrap.as`) — centred, frame 0 (`play("")`);
 *     `layer = -(y − 5 + 10·4/5)`.
 *   · FALL ROCK / FALL ROCK LARGE (`Scenery/FallRock*.as`) — an Image centred on
 *     its cell (its 2 × 2), PARKED at `y = −16` (`−32`) above the room until its
 *     group falls, then on its cell; `layer = -(fallTo − originY + height)`. The
 *     run says which: `rockFalls` (a fall this visit) or the build's `postFall`.
 *
 * ⛔ NOT YET (`TRAP_PENDING`): what the run does not model — the lava trap's
 * tongue, chomp and attach (the model's lava trap is a hazard DISC), and the
 * rock's fall itself (it falls inside the dead frames the fade hold shows; the
 * run lands it in one tick).
 */
import { ANIMS, freshSprite, play, rectOp, spriteOp, updateSprite, worldFrame } from './seedlingEnemySkin.js';

export const KEYS = Object.freeze({
    arrowTrap: 'seedling:puzzlement/arrowtrap',
    iceTrap: 'seedling:enemy/icetrap',
    darkTrap: 'seedling:enemy/darktrap',
    lavaTrap: 'seedling:enemy/lavatrap',
    fallRock: 'seedling:scenery/fallrock',
    fallRockLarge: 'seedling:scenery/fallrocklarge',
});
/** `ArrowTrap.png` is 32 × 5: two 16 × 5 frames. */
const ARROW_TRAP_FRAMES = 2;
/** `IceTrap.as:19` `chompRange`; `SandTrap.as:17`'s for the dark trap. */
const ICE_CHOMP = 8;
const DARK_CHOMP = 20;
/** `DarkTrap.as:22` "die1". */
const DIE1 = Object.freeze([4, 0, 1, 0, 4, 5, 4, 5, 6, 7, 8, 9, 10, 11]);
/** `FallRock.as:36` / `FallRockLarge.as:38`: where a rock waits before it falls. */
const PARKED = Object.freeze({ fallrock: -16, fallrocklarge: -32 });
const TRAP_COLOUR = '#e04848';
const ROCK_COLOUR = '#8a7a6a';

/** WHAT G8 DRAWS, by AS3 class. */
export const TRAP_COVERAGE = Object.freeze({
    drawn: Object.freeze(['ArrowTrap', 'IceTrap', 'DarkTrap', 'LavaTrap', 'FallRock', 'FallRockLarge']),
});
/** Drawn in their default state: what the run does not model. */
export const TRAP_PENDING = Object.freeze({
    LavaTrap: 'the tongue ("out"/"in", angle, nightBmp copy), "chomp" [2] and "die" (LavaTrap.as:56-170): the model is a hazard disc',
    'FallRock / FallRockLarge': 'the fall itself (vy += 0.6 after 60 updates): it happens in the dead frames the fade hold shows',
});

// ── the adapter ─────────────────────────────────────────────────────────

const read = (run, name, fallback) => (name in run ? run[name] ?? fallback : fallback);

/** The tick this visit of `level` began (its newest arrival), 0 for the boot visit. */
function visitStart(run) {
    const ts = run.transitions ?? [];
    for (let i = ts.length - 1; i >= 0; i -= 1) if ((ts[i].to_level ?? ts[i].to) === run.level) return ts[i].t ?? 0;
    return 0;
}

/** THE ADAPTER. Everything these pictures read, as plain objects (null when there is no run). */
export function trapSkinView(run) {
    if (!run?.state) return null;
    const world = run.world ?? null;
    const level = run.level;
    const since = visitStart(run);
    const fell = new Set((read(run, 'rockFalls', []) ?? []).filter((f) => f.level === level && f.t >= since).map((f) => f.id));
    const dark = new Map((read(run, 'darkTraps', []) ?? []).map((d) => [d.id, d]));
    const presses = world?.pressEnemies ?? [];
    const at = (e) => ({ id: `${e.tag}@${e.x},${e.y}`, x: e.x + 8, y: e.y + 8 });
    return {
        epoch: { run, key: `${level}|${run.transitions?.length ?? 0}|${run.playerDeaths?.length ?? 0}` },
        level,
        gameTime: run.gameTime ?? null,
        player: { x: run.state.x, y: run.state.y },
        arrowTraps: (world?.arrowTraps ?? []).map((a) => ({ id: a.id, x: a.x + 8, y: a.y + 2.5 })),
        iceTraps: presses.filter((e) => e.as3 === 'IceTrap').map(at),
        darkTraps: presses.filter((e) => e.as3 === 'DarkTrap').map((e) => {
            const d = dark.get(`${e.tag}@${e.x},${e.y}`) ?? null;
            return { ...at(e), startDying: !!d?.startDying, dieIndex: d?.dieIndex ?? null, removed: !!d?.removed };
        }).filter((d) => !d.removed),
        lavaTraps: presses.filter((e) => e.as3 === 'LavaTrap').map(at),
        fallRocks: (world?.fallRocks ?? []).map((r) => {
            const half = r.tag === 'fallrocklarge' ? 16 : 8;
            const landed = r.postFall === true || fell.has(r.id);
            return { id: r.id, tag: r.tag, x: r.x + half, fallTo: r.y + half, y: landed ? r.y + half : PARKED[r.tag] ?? -16, landed };
        }),
    };
}

const sameVisit = (a, b) => !!a && !!b && a.run === b.run && a.key === b.key;

// ── the reducer ─────────────────────────────────────────────────────────

/** `IceTrap.update` (:27-42) / `SandTrap.update` (:56-72): chomp in range, else the world frame while no anim plays. */
function chompUpdate(sp, t, ctx, key, range) {
    const p = ctx.player;
    if (p && Math.trunc(Math.hypot(p.x - t.x, p.y - t.y)) <= range && sp.anim !== 'chomp') play(sp, ANIMS[key], 'chomp');
    if (sp.anim === '') sp.frame = worldFrame(ctx.time, 2);
}

/** The reducer's rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const TRAP_RULES = Object.freeze({ chompUpdate, updateSprite, worldFrame });

/**
 * One GAME tick of these pictures (call it after every `tick()`). Pure: returns
 * a new object. A trap updates before the Player (the previous tick's position);
 * `time` is the top-of-frame clock.
 */
export function stepTrapSkin(prev, view, tick, { rules = TRAP_RULES } = {}) {
    if (!view) return prev;
    const R = rules === TRAP_RULES ? rules : { ...TRAP_RULES, ...rules };
    const same = !!prev && sameVisit(prev.epoch, view.epoch);
    const time = same && prev.gameTime !== null ? prev.gameTime : (view.gameTime !== null ? view.gameTime - 1 : tick);
    const ctx = { time, player: same ? prev.player : view.player };
    const bodies = new Map();
    const step = (t, key, range) => {
        const o = same ? prev.bodies.get(t.id) : null;
        const sp = o ? { ...o } : freshSprite();
        R.chompUpdate(sp, t, ctx, key, range);
        R.updateSprite(sp, ANIMS[key], () => play(sp, ANIMS[key], ''));
        bodies.set(t.id, sp);
    };
    for (const t of view.iceTraps) step(t, KEYS.iceTrap, ICE_CHOMP);
    // `DarkTrap.update`: once a light has reached it, `super.update()` no longer runs (the run's "die1" takes over)
    for (const t of view.darkTraps) {
        if (t.startDying) bodies.set(t.id, same ? (prev.bodies.get(t.id) ?? freshSprite()) : freshSprite());
        else step(t, KEYS.darkTrap, DARK_CHOMP);
    }
    return { epoch: view.epoch, gameTime: view.gameTime, player: view.player, bodies, rules: R };
}

// ── the ops ─────────────────────────────────────────────────────────────

const boxAround = (x, y, w, h) => ({ x: x - w / 2, y: y - h / 2, w, h, right: x + w / 2, bottom: y + h / 2 });

/** THE DRAW OPS at the tick `skin` was stepped to; a body whose key the stack lacks is its rectangle. */
export function trapOps(view, art, { skin } = {}) {
    if (!view || !art || !skin) return [];
    const R = skin.rules ?? TRAP_RULES;
    const ops = [];
    const push = (key, frame, at, box, colour, extra) => {
        const fallback = rectOp(box, colour, 0.85, extra.layer);
        ops.push(art.has(key) ? spriteOp(art, key, frame, at, { ...extra, fallback }) : fallback);
    };
    const now = view.gameTime ?? 0;
    for (const a of view.arrowTraps) push(KEYS.arrowTrap, R.worldFrame(now, ARROW_TRAP_FRAMES), a, boxAround(a.x, a.y, 16, 5), TRAP_COLOUR, { layer: -a.y });
    for (const t of view.iceTraps) {
        push(KEYS.iceTrap, skin.bodies.get(t.id)?.frame ?? 0, t, boxAround(t.x, t.y, 16, 16), TRAP_COLOUR, { layer: -(t.y - 8 + (16 * 4) / 5) });
    }
    for (const t of view.darkTraps) {
        const frame = t.dieIndex !== null ? DIE1[Math.min(t.dieIndex, DIE1.length - 1)] : (skin.bodies.get(t.id)?.frame ?? 0);
        push(KEYS.darkTrap, frame, t, boxAround(t.x, t.y, 14, 14), TRAP_COLOUR, { layer: -(t.y - 8 + (16 * 4) / 5) });
        // `DarkTrap.render` draws "die1" onto nightBmp too (`seedlingNightSkin.NIGHT_COPIES`); `formatOp` does not print the mark
        if (t.dieIndex !== null && ops.at(-1)?.sheetRef) ops[ops.length - 1] = { ...ops.at(-1), dying: true };
    }
    for (const t of view.lavaTraps) push(KEYS.lavaTrap, 0, t, boxAround(t.x, t.y, 10, 10), TRAP_COLOUR, { layer: -(t.y - 5 + (10 * 4) / 5) });
    for (const r of view.fallRocks) {
        const big = r.tag === 'fallrocklarge';
        const s = big ? 32 : 16;
        push(big ? KEYS.fallRockLarge : KEYS.fallRock, 0, r, boxAround(r.x, r.y, s, s), ROCK_COLOUR, { layer: -(r.fallTo - s / 2 + s) });
    }
    return ops.filter(Boolean);
}
