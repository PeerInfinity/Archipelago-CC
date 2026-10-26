/**
 * seedlingDemo/seedlingPuzzleSkin — **THE STAIRS, THE PUSHABLE BLOCKS AND THE
 * SAND TRAPS, IN THE ORIGINAL GRAPHICS** (Seedling JS graphics G7). G3's three
 * pieces again (`seedlingEnemySkin.js`, whose Spritemap transcription, hit tint
 * and op shape this module reuses):
 *
 *   · `puzzleSkinView(run, { record })` — THE ONE ADAPTER from the run (and the
 *     room's `.oel` record: the stairs' direction and `flip`, which the world
 *     does not keep) to what these pictures need. It copies; it writes nothing.
 *   · `stepPuzzleSkin(prev, view, tick)` — the renderer's own FlashPunk state,
 *     one GAME tick at a time: a block's sink fade, a trap's Spritemap and tint.
 *   · `puzzleOps(view, art, { skin })` — PURE. The draw ops, Y-sorted with the
 *     room by each class's own `layer`.
 *
 * ── What AS3 does, transcribed (`vendor/seedling/src`) ─────────────────
 *
 *   · STAIRS (`Stairs.as`) — a `Teleporter` built visible, its graphic a
 *     16 × 16 Spritemap on frame `int(!up)`, mirrored when the `.oel` says
 *     `flip`, at `layer = -y`. FlashPunk's unscaled `Image.render` draws at the
 *     entity's x, y (`originX = 8` is only the flip's pivot), so the frame sits
 *     on the stairs' own cell either way.
 *   · PUSHABLE BLOCKS (`PushableBlock.as`, `PushableBlockFire.as`,
 *     `PushableBlockSpear.as`) — a `Mobile` at the run's own position
 *     (`run.pushables`), frame `Game.worldFrame(frameCount)` at the render,
 *     `layer = -(y + 16)`. The fire block is tinted 0xFF0000 and the spear
 *     block 0x8822FF (the fire sheet). A block that comes to rest over water,
 *     lava or a pit sets `destroy`, and `Mobile.death()` takes 0.1 off its
 *     alpha every update from that one on; the run removes it when the alpha
 *     reaches 0.
 *   · SAND TRAPS (`Enemies/SandTrap.as`) — a static `Enemy` centred on its
 *     cell (`centerOO`, 14 × 14), at `layer = -(y - 8 + 16·4/5)`. Its update:
 *     `Enemy.update` (the hit tint), then "chomp" when the player is within 20
 *     px and it is not chomping already, then frame `Game.worldFrame(2)` while
 *     no anim plays. "chomp" loops, and its `endAnim` sends it back to that
 *     world frame. "die" is the run's (`run.staticBodies`' `dieIndex`), as is
 *     the removal.
 *
 * ⛔ THE RENDERER ONLY READS. Three getters, each already on the run, each
 * reading without building (`levelRun`'s `keptUnlessReading` /
 * `staticBodyStates.get`): `run.pushables` (rect, `destroy`, `removed`),
 * `run.staticBodies` (a trap's hits, i-frames, "die" frame, removal) and
 * `run.gameTime`. A block's alpha is RE-DERIVED here from `destroy` (a cosmetic
 * count of the fade, never a second model of the block): ⚠ band — the count
 * advances once per run tick, so a fade that straddles frames the run SPENDS
 * (a freeze, a ceremony) shows a brighter block than the game for those
 * frames; the removal is the run's either way.
 *
 * ⛔ NOT YET (`PUZZLE_COVERAGE.remaining` = `seedlingSkinCensus.CENSUS_REMAINING`):
 * every other undrawn class of the census of record.
 */
import {
    ANIMS, ENEMY_COLOUR, ENEMY_HIT_TINT, freshSprite, hitTint, play, rectOp, spriteOp, updateSprite, worldFrame,
} from './seedlingEnemySkin.js';
import { CENSUS_REMAINING } from './seedlingSkinCensus.js';

export const KEYS = Object.freeze({
    stairs: 'seedling:puzzlement/stairs',
    block: 'seedling:puzzlement/pushableblock',
    blockFire: 'seedling:puzzlement/pushableblockfire',
    sandTrap: 'seedling:enemy/sandtrap',
});

/** The `.oel` tags of the bodies this skin draws over their build-time rectangles (`roomOps`' `drawnObjects`). */
export const PUZZLE_OBJECT_TAGS = Object.freeze(new Set(['pushableblock', 'pushableblockfire', 'pushableblockspear']));
/** The `.oel` tags that build a `Stairs` (`levelWorld.STAIRS_TAGS`). */
const STAIRS = Object.freeze({ stairsup: true, stairsdown: false });

/** Each block class's sheet and `Image.color` (`PushableBlockFire.as:29`, `PushableBlockSpear.as:16`). */
export const BLOCKS = Object.freeze({
    pushableblock: Object.freeze({ key: KEYS.block, frames: 4, tint: null }),
    pushableblockfire: Object.freeze({ key: KEYS.blockFire, frames: 4, tint: '#ff0000' }),
    pushableblockspear: Object.freeze({ key: KEYS.blockFire, frames: 4, tint: '#8822ff' }),
});
/** `Mobile.as:65` — `alpha -= 0.1` per update once `destroy`. */
const BLOCK_FADE = 0.1;
/** `SandTrap.as:17` `chompRange`. */
const CHOMP_RANGE = 20;
/** `SandTrap.as:33` — "die". */
const TRAP_DIE = Object.freeze([4, 5, 6, 7, 8, 9]);
/** The stairs' Spritemap pivot (`Stairs.as:31` `originX = width / 2`). */
const STAIRS_PIVOT_X = 8;
const BLOCK_COLOUR = '#6f5fd0';
const STAIRS_COLOUR = '#7a6a3a';

/**
 * WHAT G7 DRAWS, by AS3 class. ⛓ G8 — `remaining` is now the census of record's
 * (`seedlingSkinCensus.CENSUS_REMAINING`, every tag the levels place, checked by
 * `seedlingSkinCensus.test.js`), not a hand list here.
 */
export const PUZZLE_COVERAGE = Object.freeze({
    drawn: Object.freeze(['Stairs', 'PushableBlock', 'PushableBlockFire', 'PushableBlockSpear', 'SandTrap']),
    remaining: CENSUS_REMAINING,
});

// ── the adapter ─────────────────────────────────────────────────────────

/** A getter's value, or `fallback` when the run has no such member (a stub run in a test). */
const read = (run, name, fallback) => (name in run ? run[name] ?? fallback : fallback);

/**
 * THE ADAPTER. Everything these pictures read, as plain objects (null when
 * there is no run). `record` is the room's level record (`{entities}`).
 */
export function puzzleSkinView(run, { record = null } = {}) {
    if (!run?.state) return null;
    const world = run.world ?? null;
    const now = read(run, 'pushables', null);
    const statics = new Map((read(run, 'staticBodies', []) ?? []).map((b) => [b.id, b]));
    return {
        epoch: { run, key: `${run.level}|${run.transitions?.length ?? 0}|${run.playerDeaths?.length ?? 0}` },
        level: run.level,
        gameTime: run.gameTime ?? null,
        player: { x: run.state.x, y: run.state.y },
        stairs: (record?.entities ?? []).filter((e) => e.type in STAIRS).map((e) => ({
            x: Number(e.x), y: Number(e.y), up: STAIRS[e.type], flip: Boolean(Number(e.attrs?.flip ?? 0)),
        })),
        blocks: (world?.pushables ?? []).map((b) => {
            const live = now?.get?.(b.id) ?? null;
            const r = live?.rect ?? { x: b.x, y: b.y };
            return { id: b.id, tag: b.tag, x: r.x, y: r.y, moved: r.x !== b.x || r.y !== b.y, destroy: !!live?.destroy, removed: !!live?.removed };
        }).filter((b) => !b.removed),
        traps: (world?.pressEnemies ?? []).filter((e) => e.as3 === 'SandTrap').map((e) => {
            const id = `${e.tag}@${e.x},${e.y}`;
            const s = statics.get(id) ?? null;
            // `SandTrap`'s ctor: `super(_x + Tile.w/2, _y + Tile.h/2)`.
            return { id, x: e.x + 8, y: e.y + 8, hitsTimer: s?.hitsTimer ?? 0, dying: !!s?.dying,
                dieIndex: s?.dieIndex ?? null, removed: !!s?.removed };
        }).filter((t) => !t.removed),
    };
}

const sameVisit = (a, b) => !!a && !!b && a.run === b.run && a.key === b.key;

// ── the reducer ─────────────────────────────────────────────────────────

/** `Mobile.death()` — the alpha after this update. */
const blockAlpha = (prev, destroy) => (destroy ? Math.max((prev ?? 1) - BLOCK_FADE, 0) : 1);
/** `SandTrap.update` (:56-72): chomp within range, else the world frame while no anim plays. */
function trapUpdate(sp, t, ctx, R) {
    const p = ctx.player;
    if (p) {
        const d = Math.trunc(Math.hypot(p.x - t.x, p.y - t.y));
        if (d <= CHOMP_RANGE && sp.anim !== 'chomp') play(sp, ANIMS[KEYS.sandTrap], 'chomp');
    }
    if (sp.anim === '') sp.frame = R.worldFrame(ctx.time, 2);
}

/** The reducer's rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const PUZZLE_RULES = Object.freeze({ blockAlpha, trapUpdate, updateSprite, hitTint, worldFrame });

/**
 * One GAME tick of these pictures (call it after every `tick()`). Pure: returns
 * a new object; `prev` null (or another visit) starts afresh. A body updates
 * before the Player, so a trap sees the player where the PREVIOUS tick left
 * him; `time` is the clock at the top of the frame, `now` at the render.
 */
export function stepPuzzleSkin(prev, view, tick, { rules = PUZZLE_RULES } = {}) {
    if (!view) return prev;
    const R = rules === PUZZLE_RULES ? rules : { ...PUZZLE_RULES, ...rules };
    const same = !!prev && sameVisit(prev.epoch, view.epoch);
    const time = same && prev.gameTime !== null ? prev.gameTime : (view.gameTime !== null ? view.gameTime - 1 : tick);
    const ctx = { time, player: same ? prev.player : view.player };
    const old = (k) => (same ? prev.bodies.get(k) : null);
    const bodies = new Map();
    for (const b of view.blocks) {
        const o = old(`b:${b.id}`);
        bodies.set(`b:${b.id}`, { alpha: R.blockAlpha(o?.alpha ?? 1, b.destroy) });
    }
    for (const t of view.traps) {
        const o = old(`s:${t.id}`);
        const st = o ? { ...o, sprite: { ...o.sprite } } : { sprite: freshSprite(), tint: null, prevHits: 0 };
        // `Enemy.update`'s `hitUpdate`, then the class's own update, then the graphic (`World.as:56-58`).
        st.tint = R.hitTint(st.tint, st.prevHits, ENEMY_HIT_TINT);
        if (!t.dying) {
            R.trapUpdate(st.sprite, t, ctx, R);
            R.updateSprite(st.sprite, ANIMS[KEYS.sandTrap], () => play(st.sprite, ANIMS[KEYS.sandTrap], ''));
        }
        st.prevHits = t.hitsTimer;
        bodies.set(`s:${t.id}`, st);
    }
    return { epoch: view.epoch, gameTime: view.gameTime, player: view.player, bodies };
}

// ── the ops ─────────────────────────────────────────────────────────────

const boxAt = (x, y, w, h) => ({ x, y, w, h, right: x + w, bottom: y + h });

/**
 * THE DRAW OPS at the tick `skin` was stepped to. Every op carries the body's
 * hitbox as its fallback rectangle; a body whose key the stack lacks is that
 * rectangle.
 */
export function puzzleOps(view, art, { skin } = {}) {
    if (!view || !art || !skin) return [];
    const ops = [];
    const push = (key, frame, at, box, colour, extra) => {
        const fallback = rectOp(box, colour, 0.85 * (extra.alpha ?? 1), extra.layer);
        ops.push(art.has(key) ? spriteOp(art, key, frame, at, { ...extra, fallback }) : fallback);
    };
    for (const s of view.stairs) {
        const before = ops.length;
        push(KEYS.stairs, s.up ? 0 : 1, s, boxAt(s.x, s.y, 16, 16), STAIRS_COLOUR, { flipX: s.flip, layer: -s.y });
        // `Stairs.as:31`: the flip turns about the frame's centre, not its corner.
        if (ops[before]?.sheetRef) ops[before] = { ...ops[before], pivotX: STAIRS_PIVOT_X, pivotY: 0 };
    }
    const now = view.gameTime ?? 0;
    for (const b of view.blocks) {
        const spec = BLOCKS[b.tag];
        const st = skin.bodies.get(`b:${b.id}`);
        if (!spec || !st) continue;
        push(spec.key, worldFrame(now, spec.frames), b, boxAt(b.x, b.y, 16, 16), BLOCK_COLOUR,
            { alpha: st.alpha, tint: spec.tint, layer: -(b.y + 16) });
    }
    for (const t of view.traps) {
        const st = skin.bodies.get(`s:${t.id}`);
        if (!st) continue;
        const frame = t.dying ? TRAP_DIE[Math.min(t.dieIndex ?? 0, TRAP_DIE.length - 1)] : st.sprite.frame;
        push(KEYS.sandTrap, frame, t, boxAt(t.x - 8, t.y - 8, 16, 16), ENEMY_COLOUR,
            { tint: st.tint, layer: -(t.y - 8 + (16 * 4) / 5) });
    }
    return ops.filter(Boolean);
}
