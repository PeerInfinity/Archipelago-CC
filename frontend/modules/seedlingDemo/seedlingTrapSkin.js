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
 *   · ⛓ G11 — THE FALL (⚖ user 2026-10-27, "hold fallrock only"): `fall()` freezes the
 *     game for the span the run spends at once (`rockFalls`' `deadFrames`, one span
 *     per pull: rows sharing a `t` fall together). The page HOLDS those frames
 *     (`rockHoldSlot`, the run does not tick) and each held frame steps the rock with
 *     the model's own pure `stepFallRock` from `publishActivate`'s state: 60 waits,
 *     then `vy += 0.6` a frame, then the 90-frame camera hold and the release.
 *     BAND, named: the camera's pan to the landing and `Game.shake = 30` are not
 *     shown, and the other bodies' graphics stand still (as in a load fade's hold).
 *
 * ⛔ NOT YET (`TRAP_PENDING`): what the run does not model — the lava trap's
 * tongue, chomp and attach (the model's lava trap is a hazard DISC).
 */
import { ANIMS, freshSprite, play, rectOp, spriteOp, updateSprite, worldFrame } from './seedlingEnemySkin.js';
import { createFallRock, publishActivate, stepFallRock } from './fallRock.js';

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
    // ⛓ G10 re-examined both (draw-only): neither can be drawn from what the run carries without contradicting it.
    LavaTrap: 'the tongue ("out"/"in", angle, nightBmp copy), "chomp" [2] and "die" (LavaTrap.as:56-170): the launch ATTACHES '
        + 'the player and pulls it along the tongue to its death, and the model is a hazard disc — a drawn tongue would show a '
        + 'pull the run never makes. Needs the model (fidelity) to carry the tongue',
    // ⛓ G11: G8–G10 said the fall was inside "the dead frames the fade hold shows" — it was not: the page held only LOAD
    //    spans, and a fall is a FREEZE span, so it played as one tick. Now held (`rockHoldSlot`); what stays:
    'FallRock / FallRockLarge': 'BAND: the camera pan to the landing and its shake; a FallRockLarge\'s own fall (the BobBoss and '
        + 'King of Fire rocks spend other freeze spans, which the page does not hold)',
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
    const falls = read(run, 'rockFalls', []) ?? [];
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
        // ⛓ G11 — the run's whole fall ledger (copies), so the reducer can tell a NEW span; the placements to replay one
        rockFallRows: falls.map((f) => ({ id: f.id, level: f.level, t: f.t, deadFrames: f.deadFrames ?? 0 })),
        rockPlacements: (world?.fallRocks ?? []).filter((r) => r.tag === 'fallrock').map((r) => ({ id: r.id, x: r.x, y: r.y })),
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
export const TRAP_RULES = Object.freeze({ chompUpdate, updateSprite, worldFrame, fallStep: stepFallRock });

/**
 * ⛓ G11 — the hold a NEW fall span owes: `frames` held slots, each rock replayed from its `fall()` state
 * (`publishActivate`), parked at frame 0. Rows sharing a `t` are one span (`fallrocks-together`).
 */
function queueFallHold(view, rows) {
    const mine = rows.filter((r) => r.level === view.level && r.deadFrames > 0);
    if (!mine.length) return null;
    const t = mine.at(-1).t;
    const span = mine.filter((r) => r.t === t);
    const rocks = new Map();
    for (const r of span) {
        const p = (view.rockPlacements ?? []).find((q) => q.id === r.id);
        if (p) rocks.set(r.id, publishActivate(createFallRock(p.x, p.y, 0, 0, false), true).state);
    }
    return rocks.size ? { t, frame: 0, frames: span[0].deadFrames, rocks } : null;
}

/** Does the skin owe a held slot for a fall? */
export const rockHoldOwed = (skin) => !!skin?.rockHold && skin.rockHold.frame < skin.rockHold.frames;

/**
 * ⛓ G11 — ONE SLOT OF THE PAGE'S CLOCK during a fall's freeze: `{ skin, held }`. Held: the rocks take one frame of
 * `FallRock.update` (`stepFallRock`, cleared, no player — the snap is the run's) and the run does NOT tick.
 */
export function rockHoldSlot(skin) {
    if (!rockHoldOwed(skin)) return { skin, held: false };
    const R = skin.rules ?? TRAP_RULES;
    const h = skin.rockHold;
    const rocks = new Map([...h.rocks].map(([id, st]) => [id, R.fallStep(st, null, { cleared: true }).state]));
    return { skin: { ...skin, rockHold: { ...h, frame: h.frame + 1, rocks } }, held: true };
}

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
    // ⛓ G11 — a fall this tick queues its hold; a run first met (a stack switched on, a new run) holds nothing old.
    // A LIVE tick ends any hold still owed (the freeze is over once the run ticks again): never carried.
    const rows = view.rockFallRows ?? [];
    const sameRun = !!prev && prev.epoch.run === view.epoch.run;
    const seen = sameRun ? (prev.rockSeen ?? rows.length) : rows.length;
    const rockHold = rows.length > seen ? queueFallHold(view, rows.slice(seen)) : null;
    return { epoch: view.epoch, gameTime: view.gameTime, player: view.player, bodies, rules: R, rockSeen: rows.length, rockHold };
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
        // ⛓ G11 — inside a held fall the rock is where its replay has it (parked at frame 0, then falling, then landed)
        const held = skin.rockHold?.rocks.get(r.id);
        const at = held ? { ...r, y: held.y } : r;
        push(big ? KEYS.fallRockLarge : KEYS.fallRock, 0, at, boxAround(at.x, at.y, s, s), ROCK_COLOUR, { layer: -(r.fallTo - s / 2 + s) });
    }
    return ops.filter(Boolean);
}
