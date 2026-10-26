/**
 * seedlingDemo/seedlingNpcSkin — **THE PLACED NPCs, IN THE ORIGINAL GRAPHICS**
 * (Seedling JS graphics G8). G7's three pieces again (`seedlingPuzzleSkin.js`):
 *
 *   · `npcSkinView(run)` — THE ONE ADAPTER from the run to what these pictures
 *     need. It copies; it writes nothing.
 *   · `stepNpcSkin(prev, view, tick)` — the renderer's own FlashPunk state, one
 *     GAME tick at a time: each NPC's Spritemap, its facing, its `inRange` and
 *     `talked`, the Watcher's direction frame.
 *   · `npcOps(view, art, { skin })` — PURE. The draw ops, Y-sorted with the room.
 *
 * ── What AS3 does, transcribed (`vendor/seedling/src/NPCs`) ─────────────
 *
 *   · `NPC` (a `Mobile`) — centred on its cell, `centerOO`, hitbox = its image
 *     (a class may set its own); `layer = -(y − originY + height)` from its first
 *     update (`Mobile.layering`). `talk()` each update: `inRange` = within
 *     `talkRange` of the player (the PREVIOUS tick's position: an NPC updates
 *     before the Player); while in range `scaleX = int(x < p.x)·2 − 1` (it faces
 *     the player and KEEPS that facing once out of range); out of range
 *     `talked = false`. `startTalking` sets `talked`. Its `render` draws the
 *     talk prompt (`Talk.png`, `Game.worldFrame(2, 1/1.25)`) above it while
 *     `inRange && !talked && showTalk`.
 *   · Each class's `render` — "talk" played while `talking` (from its first
 *     frame: `Spritemap.frame =` stops an anim, so every talk starts afresh),
 *     else its stand frame on the world clock (`worldFrame(2)`, or Hermit's and
 *     Sensei's `standAnimFrames`). The Oracle wakes ("waken" → "awake") within
 *     48 px of the player and falls asleep beyond, at the render (the player's
 *     CURRENT position). The Sign and the Totem are a still frame 0.
 *   · `Watcher` — not facing; its frame points at the player (`atan2` over six
 *     frames), the seed frame 6 while it talks pages 9..19, the die frames by
 *     `hits`; `visible = Player.hasShield`.
 *   · The statues are G1's scenery; only their talk prompt is drawn here.
 *
 * ── LIVE STATE: what the run already offers, each read without building ───
 * `talkingNow` (G4b; who is talking), `talkCircles` (the talkers still standing:
 * not cleared, with text), `watchers` (each Watcher's talk, page, hits, clear),
 * `inventory`, `gameTime`, the player. `inRange` is the model's own predicate
 * (`endingChain.inTalkRange` at `talkRangeOf(tag)`), and `talked` follows the
 * run's talk starts and that predicate — the two facts `NPC.talk` keeps it from.
 */
import { ANIMS, freshSprite, play, rectOp, spriteOp, updateSprite, worldFrame } from './seedlingEnemySkin.js';
import { inTalkRange, talkRangeOf } from './endingChain.js';

const fps = (frames, rate) => Object.freeze({ clock: 'fps', frames: Object.freeze(frames), fps: rate });

/**
 * Each placed talker's picture. `key` its sheet (the art row's origin is where the frame sits on the entity:
 * `centerOO`'s centre, or the class's own offset); `stand` its frames off the world clock (`[0, 1]` =
 * `worldFrame(2)`); `hit` its hitbox `[w, h, originX, originY]` (absent = its frame's own, centred); `margin`
 * `charToTalkMargin`; `face` `facePlayer`. Statues: the prompt only.
 */
export const NPC_ART = Object.freeze({
    introchar: Object.freeze({ key: 'seedling:npc/introchar', w: 8, h: 8, stand: [0, 1], face: true }),
    adnanchar: Object.freeze({ key: 'seedling:npc/adnanchar', w: 8, h: 8, stand: [0, 1], face: true }),
    forestchar: Object.freeze({ key: 'seedling:npc/forestchar', w: 8, h: 9, stand: [0, 1], face: true }),
    hermit: Object.freeze({ key: 'seedling:npc/hermit', w: 10, h: 12, stand: [0, 2], face: true }),
    karlore: Object.freeze({ key: 'seedling:npc/karlore', w: 20, h: 20, stand: [0, 1], face: true, hit: [16, 16, 8, 8] }),
    rekcahdam: Object.freeze({ key: 'seedling:npc/rekcahdam', w: 9, h: 10, stand: [0, 1], face: true }),
    sensei: Object.freeze({ key: 'seedling:npc/sensei', w: 8, h: 8, stand: [0, 1], face: true }),
    witch: Object.freeze({ key: 'seedling:npc/witch', w: 16, h: 13, stand: [0, 1], face: true }),
    yeti: Object.freeze({ key: 'seedling:npc/yeti', w: 10, h: 12, stand: [0, 1], face: true }),
    // `Oracle.as:37-46`: `sprOracle.y = -16`, `originY = 16`; hitbox 16 × 16; `charToTalkMargin = 10`
    oracle: Object.freeze({ key: 'seedling:npc/oracle', w: 16, h: 24, face: false, hit: [16, 16, 8, 8], margin: 10 }),
    sign: Object.freeze({ key: 'seedling:npc/sign', w: 16, h: 16, stand: [0], face: false }),
    // `Totem.as:19-26`: origin (16, 48), hitbox 32 × 32 about (16, 16)
    totem: Object.freeze({ key: 'seedling:npc/totem', w: 32, h: 64, stand: [0], face: false, hit: [32, 32, 16, 16] }),
    // `Statue.as:19-57`: G1 draws the body; the prompt sits on the frame's hitbox (frame 0: originY 16; frame 1: 0)
    statue1: Object.freeze({ key: null, face: false, hit: [0, 32, 0, 16] }),
    statue2: Object.freeze({ key: null, face: false, hit: [0, 24, 0, 0] }),
});
/**
 * Each talker's anims: its art row's "talk" (`seedlingEnemyArt.js`, the one spelling), and the Oracle's whole
 * Spritemap (`Oracle.as:42-46`) here — ⚠ its "sleep" and "awake" are `add(name, [f])` at the default frame rate 0, a
 * held frame, which the manifest refuses (like `lavaChain`'s, they ride their own transcription).
 */
export const NPC_ANIMS = Object.freeze({
    ...Object.fromEntries(Object.entries(NPC_ART).filter(([tag, s]) => s.key && tag !== 'oracle' && ANIMS[s.key]).map(([tag, s]) => [tag, ANIMS[s.key]])),
    oracle: Object.freeze({ waken: fps([0, 1, 2], 5), fallAsleep: fps([2, 1, 0], 5), sleep: fps([0], 0), awake: fps([3], 0),
        talk: fps([3, 4, 5], 5) }),
});
export const TALK_KEY = 'seedling:npc/talk';
export const WATCHER_KEY = 'seedling:npc/watcher';
/** The `.oel` tags whose bodies this skin draws (none is an object solid: no build-time rectangle to replace). */
export const NPC_TAGS = Object.freeze(new Set([...Object.keys(NPC_ART).filter((t) => NPC_ART[t].key), 'watcher']));
/** `NPC.as:178`: the prompt bobs 1.25 times per world loop. */
const TALK_LOOPS = 1 / 1.25;
/** `Oracle.as:17` `wakenDistance`. */
const WAKEN_DISTANCE = 48;
/** `Watcher.as:21-27`. */
const WATCHER = Object.freeze({ seedMin: 9, seedMax: 19, seedFrame: 6, normal: 6, die: Object.freeze([7, 8, 9]), last: 9 });
const NPC_COLOUR = '#d0a0e0';

/** WHAT G8 DRAWS, by AS3 class. */
export const NPC_COVERAGE = Object.freeze({
    drawn: Object.freeze(['IntroCharacter', 'AdnanCharacter', 'ForestCharacter', 'Hermit', 'Karlore', 'Rekcahdam', 'Sensei',
        'Witch', 'Yeti', 'Oracle', 'Sign', 'Totem', 'Watcher']),
});

// ── the adapter ─────────────────────────────────────────────────────────

const read = (run, name, fallback) => (name in run ? run[name] ?? fallback : fallback);

/** THE ADAPTER. Everything these pictures read, as plain objects (null when there is no run). */
export function npcSkinView(run) {
    if (!run?.state) return null;
    const world = run.world ?? null;
    const standing = new Set((read(run, 'talkCircles', []) ?? []).map((c) => c.id));
    const now = read(run, 'talkingNow', null);
    const talkingId = now && (now.source === 'talker' || now.source === 'watcher') ? now.id : null;
    const watchers = new Map((read(run, 'watchers', []) ?? []).map((w) => [w.id, w]));
    const texts = new Map((world?.watchers ?? []).map((w) => [w.id, !!w.text]));
    return {
        epoch: { run, key: `${run.level}|${run.transitions?.length ?? 0}|${run.playerDeaths?.length ?? 0}` },
        level: run.level,
        gameTime: run.gameTime ?? null,
        player: { x: run.state.x, y: run.state.y },
        shield: !!read(run, 'inventory', {})?.hasShield,
        talkers: (world?.talkers ?? []).filter((t) => NPC_ART[t.tag] && standing.has(t.id)).map((t) => ({
            id: t.id, tag: t.tag, x: t.ex, y: t.ey, talking: t.id === talkingId,
        })),
        // `Watcher.check()` is empty: a Watcher is never removed, cleared or not
        watchers: [...watchers.values()].map((w) => ({
            id: w.id, x: w.x, y: w.y, cleared: !!w.cleared, talking: !!w.talking, page: w.page, hits: w.hits ?? 0,
            text: texts.get(w.id) ?? false,
        })),
    };
}

const sameVisit = (a, b) => !!a && !!b && a.run === b.run && a.key === b.key;

// ── the reducer ─────────────────────────────────────────────────────────

/** `NPC.talk` (:184-226): `inRange`, the facing (kept out of range), `talked` (set by a talk start, reset out of range). */
function talkUpdate(st, t, ctx) {
    const p = ctx.player;
    st.inRange = inTalkRange(t, p, talkRangeOf(t.tag));
    if (st.inRange) {
        if (NPC_ART[t.tag].face) st.flip = !(t.x < p.x);
    } else st.talked = false;
    if (t.talking) st.talked = true;
}
/** A class's `render` (:render of each NPC): "talk" while talking, else its stand frame; the Oracle's wake by distance. */
function npcFrame(st, t, ctx) {
    const anims = NPC_ANIMS[t.tag];
    const spec = NPC_ART[t.tag];
    if (t.talking && anims?.talk) { play(st.sprite, anims, 'talk'); return; }
    if (t.tag === 'oracle') {
        const d = Math.trunc(Math.hypot(t.x - ctx.now.x, t.y - ctx.now.y));
        if (d <= WAKEN_DISTANCE) { if (st.sprite.anim !== 'awake') play(st.sprite, anims, 'waken'); }
        else if (st.sprite.anim !== 'sleep') play(st.sprite, anims, 'fallAsleep');
        return;
    }
    if (!spec.stand) return;   // a statue: G1 draws its body
    // `Spritemap.frame =` stops any anim, so the next talk starts from its first frame
    st.sprite = { ...freshSprite(), frame: spec.stand[worldFrame(ctx.time, spec.stand.length)] };
}
/** `Watcher.update` (:58-95): the seed frame, else the direction frame, then the die frames by `hits`. */
function watcherFrame(w, ctx) {
    if (w.text && w.talking && !w.cleared && w.page >= WATCHER.seedMin && w.page <= WATCHER.seedMax) return WATCHER.seedFrame;
    if (w.hits > 0) return w.hits > WATCHER.die.length ? WATCHER.last : WATCHER.die[w.hits - 1];
    const p = ctx.player;
    return Math.trunc((((Math.atan2(w.y - p.y, p.x - w.x) + 2 * Math.PI) / (2 * Math.PI)) * WATCHER.normal + WATCHER.normal) % WATCHER.normal);
}

/** The reducer's rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const NPC_RULES = Object.freeze({ talkUpdate, npcFrame, watcherFrame, updateSprite, worldFrame });

/**
 * One GAME tick of these pictures (call it after every `tick()`). Pure: returns
 * a new object. An NPC updates before the Player, so `talk()` and the Watcher see
 * the player where the PREVIOUS tick left him; the class `render`s (the Oracle's
 * wake) see where this one did. The world clock is the top of the frame's.
 */
export function stepNpcSkin(prev, view, tick, { rules = NPC_RULES } = {}) {
    if (!view) return prev;
    const R = rules === NPC_RULES ? rules : { ...NPC_RULES, ...rules };
    const same = !!prev && sameVisit(prev.epoch, view.epoch);
    const time = same && prev.gameTime !== null ? prev.gameTime : (view.gameTime !== null ? view.gameTime - 1 : tick);
    const ctx = { time, player: same ? prev.player : view.player, now: view.player };
    const bodies = new Map();
    for (const t of view.talkers) {
        const o = same ? prev.bodies.get(t.id) : null;
        const st = o ? { ...o, sprite: { ...o.sprite } } : { sprite: freshSprite(), flip: false, inRange: false, talked: false };
        // `Oracle.as:47` `sprOracle.play("sleep")` in the ctor
        if (!o && t.tag === 'oracle') play(st.sprite, NPC_ANIMS.oracle, 'sleep');
        if (NPC_ANIMS[t.tag]) R.updateSprite(st.sprite, NPC_ANIMS[t.tag], () => {
            if (t.tag === 'oracle' && st.sprite.anim === 'waken') play(st.sprite, NPC_ANIMS.oracle, 'awake');
            else if (t.tag === 'oracle' && st.sprite.anim === 'fallAsleep') play(st.sprite, NPC_ANIMS.oracle, 'sleep');
        });
        R.talkUpdate(st, t, ctx);
        R.npcFrame(st, t, { ...ctx, time: view.gameTime ?? time });
        bodies.set(t.id, st);
    }
    for (const w of view.watchers) bodies.set(w.id, { frame: R.watcherFrame(w, ctx) });
    return { epoch: view.epoch, gameTime: view.gameTime, player: view.player, bodies, rules: R };
}

// ── the ops ─────────────────────────────────────────────────────────────

const boxAround = (x, y, w, h) => ({ x: x - w / 2, y: y - h / 2, w, h, right: x + w / 2, bottom: y + h / 2 });

/** THE DRAW OPS at the tick `skin` was stepped to; a body whose key the stack lacks is its hitbox rectangle. */
export function npcOps(view, art, { skin } = {}) {
    if (!view || !art || !skin) return [];
    const R = skin.rules ?? NPC_RULES;
    const ops = [];
    const now = view.gameTime ?? 0;
    for (const t of view.talkers) {
        const st = skin.bodies.get(t.id);
        const spec = NPC_ART[t.tag];
        if (!st || !spec) continue;
        const [hw, hh, , oy] = spec.hit ?? [spec.w, spec.h, spec.w / 2, spec.h / 2];
        const layer = -(t.y - oy + hh);
        if (spec.key) {
            const fallback = rectOp(boxAround(t.x, t.y, hw || spec.w, hh || spec.h), NPC_COLOUR, 0.85, layer);
            ops.push(art.has(spec.key) ? spriteOp(art, spec.key, st.sprite.frame, t, { flipX: st.flip, layer, fallback }) : fallback);
        }
        // `NPC.render` (:174-181): the prompt over it, while in range and not yet talked to
        if (st.inRange && !st.talked && art.has(TALK_KEY)) {
            ops.push(spriteOp(art, TALK_KEY, R.worldFrame(now, 2, TALK_LOOPS), { x: t.x, y: t.y - oy - (spec.margin ?? 2) }, { layer }));
        }
    }
    for (const w of view.watchers) {
        if (!view.shield) continue;   // `visible = Player.hasShield`
        const st = skin.bodies.get(w.id);
        // `:94` `text == "" ? layer = -(y + Tile.h·8) : -(y − originY + height·2/3)`
        const layer = w.text ? -(w.y - 8 + (16 * 2) / 3) : -(w.y + 128);
        const fallback = rectOp(boxAround(w.x, w.y, 16, 16), NPC_COLOUR, 0.85, layer);
        ops.push(art.has(WATCHER_KEY) ? spriteOp(art, WATCHER_KEY, st?.frame ?? 0, w, { layer, fallback }) : fallback);
    }
    return ops.filter(Boolean);
}

