/**
 * seedlingDemo/seedlingPickupSkin — **THE PLACED VANILLA PICKUPS, IN THE
 * ORIGINAL GRAPHICS** (Seedling JS graphics G9a). G7's three pieces again:
 *
 *   · `pickupSkinView(run)` — THE ONE ADAPTER. It copies; it writes nothing.
 *   · `stepPickupSkin(prev, view, tick)` — the renderer's own count: the tick a
 *     visit began (the HealthPickup's spin is a count of its renders).
 *   · `pickupOps(view, art, { skin })` — PURE. The draw ops, Y-sorted with the room.
 *
 * ⛓ THE AP LOOK. A randomized slot is never a vanilla pickup here: the AP
 * rewrite (`apPlacementRewriter`) replaces it with an `apitem`, which G3's
 * `apItemOps` already draws as its look (or the logo). So this skin draws
 * `world.pickups` — the vanilla classes — and a slot holding an AP item takes
 * G3's look by construction (`seedlingPickupSkin.test.js` holds both on L10).
 *
 * ── What AS3 does, transcribed (`vendor/seedling/src/Pickups`) ──────────
 *
 *   · EVERY placed pickup is built at its cell's centre (`_x + Tile.w/2`), its
 *     graphic `centerOO`'d, and is a `Mobile`: `layering()` sets
 *     `layer = -(y − originY + height)` = −(its hitbox's bottom) every update.
 *   · ITS FRAME at the render: Sword / Conch `worldFrame(3)`, Feather
 *     `worldFrame(8)`, GhostSpear / GhostSword / HealthPickup / BossKey
 *     `worldFrame(frameCount)`, Wand / FireWand `worldFrame(6)`, Seed
 *     `sitFrames[worldFrame(4)]` = [0, 1, 2, 1], BossTotemPart its part
 *     (`frame = _t`), TorchPickup 0 (1 once `pick_up` runs); Shield frame 0;
 *     DarkShield / DarkSuit are Images.
 *   · THE NIGHT COPIES (`nightBmp`): HealthPickup, GhostSword, TorchPickup and
 *     the boss keys 2, 3, 4 render again (`NIGHT_COPIES`, gated on the op's
 *     `nightCopy` so an AP look with the same sheet is never copied); boss key
 *     2 first draws a `circlePlus` of `max(w, h)·(1.1 + 0.25·worldFrame(5)/5)`,
 *     0xFFFFCC at 0.25; the Wand and Fire Wand draw two `circlePlus` (radius
 *     `6·frame/5 + 14` and half that, yellow / orange, `alpha · 0.2`) at
 *     `(x + int(spr.x + 3), y + int(spr.y + 1))`. Those circles ride the op as
 *     `nightExtra`, which `nightOps` pushes before the op's copy.
 *   · THE WAND / FIRE WAND BOB: `spr.y = −originY + 2·sin(2π·(time % 45)/45)`.
 *   · THE WAND'S APPROACH FADE: alpha 0 until its gate opens, then +0.01 per
 *     frozen update. The run spends that fade as ONE lump of dead frames
 *     (`run.wandFades`), so the wand is drawn at 0 before the lump and at 1
 *     after it. ⚠ Band: the ramp itself is inside frames the run does not tick.
 *   · HEALTH: `scaleX`/`scaleY = FP.choose(1, −1)` at its build (the cosmetic
 *     band: `cosmeticRand` keyed by the body, ⚖ never model the cosmetic RNG),
 *     and `angle += 10` before each render — counted here as the visit's ticks
 *     (⚠ band: a frozen or dead frame renders too).
 *   · THE CEREMONY (`Pickup.pick_up`): a `special` pickup rides above the
 *     player while frozen — `x = player.x`, `y = player.y − player.originY −
 *     offY + specialOffset.y·min(2(1 − timer/150), 1)`, `offY = min(height −
 *     originY, image.height − image.originY)`, `layer = −FP.height` — until its
 *     text closes. Phase A (the 150-frame rise) is a lump of dead frames the run
 *     does not tick, so the item is drawn RISEN (`specialOffset.y` = −5) on every
 *     tick `run.ceremonyNow` names it. ⚠ Band: the rise. Runtime pickups (the
 *     Witch's sword, Bob's Fire, the Watcher's seed) are not placed and not here.
 *
 * ⛔ THE RENDERER ONLY READS: `world.pickups`, `takenPickups`, `ceremonyNow`,
 * `wandFades`, `state`, `gameTime` — all already on the run.
 */
import { rectOp, spriteOp, worldFrame } from './seedlingEnemySkin.js';
import { cosmeticRand } from './seedlingSkinRenderer.js';
import { HITBOX } from './playerPhysicsV1.js';

const pickupKey = (look) => `seedling:pickup/${look}`;
export const KEYS = Object.freeze(Object.fromEntries([
    'sword', 'shield', 'wand', 'conch', 'ghostspear', 'health', 'darkshield', 'darksuit', 'feather', 'ghostsword',
    'firewand', 'torchpickup', 'totempart', 'seed', 'bosskey0', 'bosskey1', 'bosskey2', 'bosskey3', 'bosskey4',
].map((k) => [k, pickupKey(k)])));

/** WHAT G9a DRAWS, by AS3 class. */
export const PICKUP_COVERAGE = Object.freeze({
    drawn: Object.freeze(['Sword', 'Shield', 'Wand', 'Conch', 'GhostSpear', 'HealthPickup', 'DarkShield', 'DarkSuit', 'Feather',
        'GhostSword', 'FireWand', 'TorchPickup', 'BossKey', 'BossTotemPart', 'Seed']),
});
/** The `.oel` tags whose build-time stand-in rectangle this skin replaces (`roomOps`' `drawnPickups`). */
export const PICKUP_TAGS = Object.freeze(new Set(['sword', 'shield', 'wand', 'conch', 'ghostspear', 'health', 'darkshield', 'darksuit',
    'feather', 'ghostsword', 'firewand', 'torchpickup', 'bosskey', 'totempart', 'seed']));

const PICKUP_COLOUR = '#e8c040';
/** `Game.timePerFrame`. */
const TIME_PER_FRAME = 45;
/** `Pickup.as:20` `specialOffset`. */
const SPECIAL_OFFSET_Y = -5;
/** `FP.height` — the ceremony's `layer = -FP.height`. */
const FP_HEIGHT = 160;
/** `Seed.as` `sitFrames`. */
const SIT_FRAMES = Object.freeze([0, 1, 2, 1]);

/**
 * Each class's frame at the render (`render()` overrides); `n` = the sheet's frame count (FlashPunk's `frameCount`).
 * A function of `(p, time, n)`.
 */
const FRAME = Object.freeze({
    sword: (p, t) => worldFrame(t, 3),
    conch: (p, t) => worldFrame(t, 3),
    feather: (p, t) => worldFrame(t, 8),
    ghostspear: (p, t, n) => worldFrame(t, n),
    ghostsword: (p, t, n) => worldFrame(t, n),
    health: (p, t, n) => worldFrame(t, n),
    bosskey: (p, t, n) => worldFrame(t, n),
    wand: (p, t) => worldFrame(t, 6),
    firewand: (p, t) => worldFrame(t, 6),
    seed: (p, t) => SIT_FRAMES[worldFrame(t, SIT_FRAMES.length)],
    totempart: (p) => p.totemPart ?? 0,
    torchpickup: (p) => (p.held ? 1 : 0),
});
/** The night copies (`render()` drawing `super.render()` again onto nightBmp). */
const NIGHT_COPY = Object.freeze({ health: true, ghostsword: true, torchpickup: true, bosskey: (p) => p.keyType >= 2 && p.keyType <= 4 });
/** `Wand.as` / `FireWand.as` render: the glow's colour. */
const WAND_GLOW = Object.freeze({ wand: '#ffff00', firewand: '#ff8800' });

const sameVisit = (a, b) => !!a && !!b && a.run === b.run && a.key === b.key;

/** THE ADAPTER (null when there is no run). */
export function pickupSkinView(run) {
    if (!run?.state) return null;
    const world = run.world ?? null;
    const taken = run.takenPickups ?? new Set();
    const level = run.level;
    const cer = run.ceremonyNow ?? null;
    const wandFaded = (run.wandFades ?? []).some((f) => f.level === level);
    const player = { x: run.state.x, y: run.state.y };
    const placed = (world?.pickups ?? [])
        .filter((p) => !taken.has(`pickup:${p.tag}@${p.x},${p.y}`))
        .map((p) => ({
            id: `${p.tag}@${p.x},${p.y}`, tag: p.tag, x: p.x + 8, y: p.y + 8,
            hit: { h: p.cls?.pickup?.h ?? 8, originY: p.cls?.pickup?.originY ?? 4 }, bottom: p.rect.bottom,
            ...(p.keyType !== undefined ? { keyType: p.keyType } : {}),
            ...(p.totemPart !== undefined ? { totemPart: p.totemPart } : {}),
        }));
    // the placed pickup the ceremony is riding (it stays in `world.pickups`, untaken, until the ceremony finishes)
    let held = null;
    if (cer && !cer.runtime && cer.level === level) {
        let best = Infinity;
        for (const p of placed) {
            if (p.tag !== cer.tag) continue;
            const d = Math.hypot(p.x - player.x, p.y - player.y);
            if (d < best) { best = d; held = p.id; }
        }
    }
    return {
        epoch: { run, key: `${level}|${run.transitions?.length ?? 0}|${run.playerDeaths?.length ?? 0}` },
        level,
        gameTime: run.gameTime ?? null,
        player,
        taken: (world?.pickups ?? []).length - placed.length,
        pickups: placed.map((p) => ({ ...p, held: p.id === held, hidden: p.tag === 'wand' && !wandFaded })),
    };
}

/** THE REDUCER: the tick each visit began, and the tick it is stepped to. */
export function stepPickupSkin(prev, view, tick) {
    if (!view) return null;
    const visitTick = prev && sameVisit(prev.epoch, view.epoch) ? prev.visitTick : tick;
    return { epoch: view.epoch, visitTick, tick };
}

/** The rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const PICKUP_RULES = Object.freeze({
    frame: (p, time, n) => FRAME[p.tag]?.(p, time, n) ?? 0,
    // `Wand.as` / `FireWand.as` render: `spr.y = -originY + 2·sin(2π·(Game.time % timePerFrame) / timePerFrame)`
    bob: (time) => 2 * Math.sin((2 * Math.PI * (((time % TIME_PER_FRAME) + TIME_PER_FRAME) % TIME_PER_FRAME)) / TIME_PER_FRAME),
    // `HealthPickup.as`: `angle += 10` per render, from 0 at its build
    spin: (renders) => (10 * renders) % 360,
    // `HealthPickup.as`: `scaleX = FP.choose(1, -1)`, `scaleY = FP.choose(1, -1)` (cosmetic band)
    flips: (level, p) => [cosmeticRand(level, p.x, p.y, 91) < 0.5 ? 1 : -1, cosmeticRand(level, p.x, p.y, 92) < 0.5 ? 1 : -1],
    // `Pickup.pick_up`: the risen item's centre
    risen: (p, player, imgH, imgOriginY) => ({
        x: player.x,
        y: player.y - HITBOX.originY - Math.min(p.hit.h - p.hit.originY, imgH - imgOriginY) + SPECIAL_OFFSET_Y,
    }),
});

const artKeyOf = (p) => (p.tag === 'bosskey' ? pickupKey(`bosskey${p.keyType ?? 0}`) : pickupKey(p.tag));

/** THE DRAW OPS at the render clock; a body whose key the stack lacks is its hitbox rectangle. */
export function pickupOps(view, art, { skin = null, rules = PICKUP_RULES } = {}) {
    if (!view || !art) return [];
    const R = rules === PICKUP_RULES ? rules : { ...PICKUP_RULES, ...rules };
    const time = view.gameTime ?? 0;
    // HealthPickup's renders this visit (1 on the visit's first tick; 1 with no reducer)
    const renders = skin && sameVisit(skin.epoch, view.epoch) ? skin.tick - skin.visitTick + 1 : 1;
    const ops = [];
    for (const p of view.pickups) {
        if (p.hidden) continue;
        const key = artKeyOf(p);
        const layer = p.held ? -FP_HEIGHT : -p.bottom;
        const fallback = rectOp({ x: p.x - 4, y: p.y - 4, w: 8, h: 8, right: p.x + 4, bottom: p.y + 4 }, PICKUP_COLOUR, 0.85, layer);
        const r = art.has(key) ? art.resolve(key) : null;
        if (!r) { ops.push(fallback); continue; }
        const { fw, fh } = r.sprite;
        const frame = R.frame(p, time, r.frameCount);
        // `Image.originY` is an int: `centerOO` truncates the half height
        let at = p.held ? R.risen(p, view.player, fh, Math.trunc(fh / 2)) : { x: p.x, y: p.y };
        const bobY = WAND_GLOW[p.tag] ? R.bob(time) : 0;
        at = { x: at.x, y: at.y + bobY };
        const extra = { layer, fallback };
        if (p.tag === 'health') {
            const [sx, sy] = R.flips(view.level, p);
            extra.rot = -R.spin(renders);
            if (sx !== 1 || sy !== 1) Object.assign(extra, { scaleX: sx, scaleY: sy });
        }
        const op = spriteOp(art, key, frame, at, extra);
        if (!op) { ops.push(fallback); continue; }
        const copy = NIGHT_COPY[p.tag];
        if (copy === true || (typeof copy === 'function' && copy(p))) op.nightCopy = true;
        const night = [];
        if (p.tag === 'bosskey' && p.keyType === 2) {
            // `BossKey.as` render: `circlePlus(x, y, max(width, height)·(1 + 0.1 + 0.25·worldFrame(5)/5), 0xFFFFCC, 0.25)`
            night.push(circleOp(Math.trunc(at.x), Math.trunc(at.y), 8 * (1 + 0.1 + (0.25 * worldFrame(time, 5)) / 5), '#ffffcc', 0.25, layer));
        }
        if (WAND_GLOW[p.tag]) {
            // `offsetX:int = spr.x + 3`, `offsetY:int = spr.y + 1` (truncation); spr.x = -originX, spr.y = -originY + bob
            const cx = Math.trunc(at.x) + Math.trunc(-Math.trunc(fw / 2) + 3);
            const cy = Math.trunc(at.y - bobY) + Math.trunc(-Math.trunc(fh / 2) + bobY + 1);
            const rad = (6 * frame) / 5 + 14;
            night.push(circleOp(cx, cy, rad, WAND_GLOW[p.tag], 0.2, layer), circleOp(cx, cy, rad / 2, WAND_GLOW[p.tag], 0.2, layer));
        }
        if (night.length) op.nightExtra = night;
        ops.push(op);
    }
    return ops;
}

/** A `Draw.circlePlus` op, in G5's `lightCircles` shape. */
function circleOp(x, y, r, colour, alpha, layer) {
    return { circle: { x, y, r }, colour, alpha, layer, rect: { x: x - r, y: y - r, w: 2 * r, h: 2 * r } };
}
