/**
 * seedlingDemo/seedlingEffectSkin — **THE EFFECTS, THE HUD, THE FADE AND THE
 * DIALOGUE BOX, IN THE ORIGINAL GRAPHICS** (Seedling JS graphics G4): the
 * explosions, the sword's slash hits, the rain, the Boss Totem's white-out
 * cover, the hearts, the load fade (`blackCover`) and the talk bars with their
 * typed text. G3c's three pieces again, in a FOURTH sibling module so G1–G3c's
 * goldens are unchanged by construction:
 *
 *   · `effectSkinView(run, { record })` — THE ONE ADAPTER from the run (and
 *     the room's level record, for the rain row the world does not keep) to
 *     what these pictures need. It copies; it writes nothing.
 *   · `stepEffectSkin(prev, view, tick)` — the renderer's own state, one GAME
 *     tick at a time; `holdEffectSkin(skin, view)` — one DEAD frame of a load
 *     fade, which the run does not tick (the page holds its clock for it).
 *   · `effectOps(view, art, { skin })` — PURE: the world-space ops (explosions,
 *     slash hits, droplets), Y-sorted with the room by their own `layer`;
 *     `screenOps(view, art, { skin, cam, font })` — PURE: the screen-anchored
 *     overlays, in `Game.render()`'s order (`Game.as:1071-1083`): `talk()`, the
 *     cover (`newCoverDraw`), `drawHealth()`, `cover()` (the black fade). ⚖ In
 *     room mode they are drawn over the MODEL's camera rect (user, 2026-10-21).
 *
 * ⛔⛔ THE GETTERS. Every member read here is a ledger copy or a state copy:
 * `bossBlasts`, `bombEvents`, `chaserKills`, `spinnerPressKills`, `playerHits`,
 * `playerDeaths`, `transitions`, `deadFrameSpans` (the clock's spans, mapped),
 * `damage`, `inventory`, `ceremonyNow`, `cutscene`, `cameraNow`, `chasers`,
 * `spinnerBodies` (G3's, audited there) and `bossesWoken` (G3c's, audited
 * there: under `!noclip` the boss loop builds it first). None builds state.
 * `seedlingEffectSkin.test.js` holds each family's tape's stream, end state,
 * ledgers and `stateLog` byte-identical with all of this running every tick
 * and without it.
 *
 * ⛔ THE RENDERER ONLY READS, AND ⚖ NEVER MODELS THE COSMETIC RNG. An
 * explosion's angle (`Explosion.as:39`) and the rain's every draw
 * (`Game.as:1034-1043`) are `Rng.cos()` — the cosmetic stream. They are drawn
 * on `cosmeticRand` (a stateless hash keyed by level, tick and id), a named
 * band. The shake's jiggle is the same (`jiggleCam`), in follow mode only.
 *
 * ⛔ NOT DRAWN (`EFFECT_COVERAGE.remaining`): the coins (BOTH spawn sites are
 * commented out in the source — `Enemy.dropCoins`' callers and `Chest.open`'s
 * loop — so the game never shows one); the grenade's light, the lights and
 * every `nightBmp` copy (`Light.render` draws ONLY to `nightBmp` unless
 * `darkLight`: G5); the intro's dust (`Game.cutscene[0]` only, a clock the
 * model refuses); the Wand's kill explosion on a chaser and the LavaBall's
 * (no ledger row carries one); the NPC dialogues and their portraits (the run
 * carries the pickup ceremony's dialogue only); the font's glyphs (⚖ open: a
 * placeholder font stands in, `PLACEHOLDER_FONT`).
 */
import { cosmeticRand } from './seedlingSkinRenderer.js';
import { ANIMS, ENEMY_COLOUR, familyOf, freshSprite, hashId, play, rectOp, spriteOp, updateSprite } from './seedlingEnemySkin.js';
import { ENEMY_ART } from './seedlingEnemyArt.js';
import { BOSS_TOTEM_DEATH_BLAST } from './bossTotemFight.js';

export const KEYS = Object.freeze({
    explosion: 'seedling:fx/explosion',
    slash: 'seedling:fx/slashhit',
    droplet: 'seedling:fx/droplet',
    heart: 'seedling:hud/heart',
    spinner: 'seedling:enemy/spinner',
    /** ⚖ THE FONT SEAM: a pack that names this key supplies the glyphs (frame = char code − 32). No pack does yet. */
    font: 'seedling:font/default',
});

/** WHAT G4 DRAWS. With G1–G3c's `drawn` this is the skinned paint's whole roster. */
export const EFFECT_COVERAGE = Object.freeze({
    drawn: Object.freeze(['Explosion (totem shot, totem death, bomb)', 'SlashHit (press kills: chasers, spinners)', 'Droplet (rain)',
        'BossTotem white-out cover', 'hearts (drawHealth)', 'blackCover (load fade)', 'talk() bars + typed text (pickup ceremonies; placeholder font)']),
    modelled: Object.freeze([]),
    remaining: Object.freeze(['Coin (dead code: never spawned)', 'the grenade light + every Light / nightBmp copy (G5)',
        'DustParticle (intro cutscene only)', 'the Wand-kill and LavaBall explosions (no ledger row)',
        'NPC dialogues + portraits (no run state)', 'the 04B_03 glyphs (⚖ font open)', 'the fire / seed / death covers (no run state)']),
});

// ── constants, each from the AS3 ────────────────────────────────────────

/** `Main.as:36` `super(160, 160)`: `FP.screen`. */
const SCREEN = 160;
/** `Explosion.as:26` `_r` by the model's blast source: `BossTotemShot.as:71` 24, the totem's own (its `max(width,height)`), `Bomb.as:62` 24. */
export const EXPLOSION_R = Object.freeze({ bossShotBlast: 24, bossDeathBlast: BOSS_TOTEM_DEATH_BLAST.visualRadius, bomb: 24 });
const EXPLOSION_FW = 128;
const SLASH_FW = 32;
/** `SlashHit.as:22-23`: `scale = sc / width + 0.35`; `layer = -(y + Tile.h · 3/2)`. */
const SLASH_SCALE_ADD = 0.35;
const SLASH_LAYER_DY = 24;
/** `Droplet.as:13-15` g, frameRate, maxDist; `:45` checkW; the sheet's 6 frames (Droplet.png 54×5 / 9). */
const DROP = Object.freeze({ g: 0.1, frameRate: 0.6, maxDist: 80, checkW: 6, v0: 1, frames: 6, heavinessMax: 100 });
/** `Droplet.as:52-60`: the tiles a drop falls past (cliff, stairs, cave, waterfall), and the pit that eats it. */
const DROP_FALL_PAST = new Set([9, 10, 13, 25]);
const PIT = 6;
const TILE = 16;
/** `BossTotem.as:226-240` `rumblingTimeMax`. */
const RUMBLING_MAX = 240;
/** `Game.as:519` `blackCoverRate`. */
const BLACK_COVER_RATE = 0.05;
/** `Game.as:485-486` the talk bars; `Game.as:1680-1684` `n`, `minM`, `textToImageMargin`. */
const TALK = Object.freeze({ n: 6, alpha: 0.8, colour: '#000000', textToImageMargin: 8 });
/** `Game.as:1541` `cols`; the heart's 12 px, overlapping by one. */
const HEART = Object.freeze({ cols: 2, w: 12, h: 12 });

/**
 * ⚖ THE PLACEHOLDER FONT (the font is OPEN, user 2026-10-21). FlashPunk's
 * `Text` measures `textWidth + 4` × `textHeight + 4` (`Text.as:40-41,53-54`);
 * these metrics stand in for 04B_03's at size 8 until a pack names a font
 * (`KEYS.font`). A glyph is drawn as a box, recorded by its char code.
 */
export const PLACEHOLDER_FONT = Object.freeze({ id: 'placeholder', advance: 4, lineHeight: 9, gutter: 4, glyphW: 3, glyphH: 5 });

const hex6 = (n) => `#${(n >>> 0 & 0xffffff).toString(16).padStart(6, '0')}`;
/** AS3 `uint(String)` of an `.oel` colour attribute: `Number()` (hex with `0x`, else decimal — L65's "0882266" is 882266). */
const oelColour = (s) => hex6(Number(s) || 0);

// ── the adapter ─────────────────────────────────────────────────────────

const read = (run, name, fallback) => (name in run ? run[name] ?? fallback : fallback);

/** `for each (o in xml.objects[0].droplet)` (`Game.as:2266-2274`): the LAST row wins; `-1` is the room's size. */
function rainOf(record, room) {
    const rows = (record?.entities ?? []).filter((e) => e.type === 'droplet');
    if (!rows.length) return null;
    const o = rows[rows.length - 1];
    const a = o.attrs ?? {};
    const w = Number(a.width);
    const h = Number(a.height);
    return {
        heaviness: Math.trunc(Number(a.heaviness) || 0),
        rect: { x: Number(o.x) || 0, y: Number(o.y) || 0, w: w !== -1 ? w : room.width, h: h !== -1 ? h : room.height },
        height: Math.trunc(Number(a.startheight) || 0),
        colour: oelColour(a.color),
    };
}

/**
 * THE ADAPTER. Everything these pictures read, from the run, as plain
 * objects (null when there is no run). `record` is the room's level record
 * (the page's `vanilla`/`mounted` source; a test's atlas row) — only its
 * `droplet` row is read.
 */
export function effectSkinView(run, { record = null } = {}) {
    if (!run?.state) return null;
    const world = run.world ?? null;
    const room = world?.world ?? { width: SCREEN, height: SCREEN };
    const deaths = read(run, 'playerDeaths', []) ?? [];
    const woken = read(run, 'bossesWoken', []) ?? [];
    const totemRows = world?.bossTotems ?? [];
    const cer = read(run, 'ceremonyNow', null);
    const dmg = read(run, 'damage', null);
    return {
        epoch: { run, key: `${run.level}|${run.transitions?.length ?? 0}|${deaths.length}` },
        level: run.level,
        room: { width: room.width, height: room.height },
        player: { x: run.state.x, y: run.state.y },
        blasts: (read(run, 'bossBlasts', []) ?? []).map((b) => ({ t: b.t, level: b.level, id: b.id, x: b.x, y: b.y, source: b.source })),
        bombBlasts: (read(run, 'bombEvents', []) ?? []).filter((e) => e.what === 'blast')
            .map((e) => ({ t: e.t, level: e.level, id: e.id, x: e.at.x, y: e.at.y, source: 'bomb' })),
        // Every press is "Sword" or "Spear" (`levelRun.pressHitType`), so every press kill is a SlashHit (`Enemy.as:200-203`).
        slashKills: [
            ...(read(run, 'chaserKills', []) ?? []).filter((k) => k.by === 'press').map((k) => ({ t: k.t, level: k.level, id: k.id, kind: 'chaser' })),
            ...(read(run, 'spinnerPressKills', []) ?? []).filter((k) => k.weapon === 'sword' || k.weapon === 'spear')
                .map((k) => ({ t: k.t, level: k.level, id: k.id, kind: 'spinner' })),
        ],
        chasers: (read(run, 'chasers', []) ?? []).map((c) => ({ id: c.id, tag: c.tag, x: c.x, y: c.y })),
        spinners: (read(run, 'spinnerBodies', []) ?? []).map((s) => ({ id: s.id, x: s.x, y: s.y })),
        // G3c's pairing: the game's one totem (L43) with the world's one row.
        whiteOut: totemRows.length === 1 && woken[0] && !woken[0].removed && woken[0].destroy
            ? { sinceActivation: woken[0].sinceActivation, renders: woken[0].whiteOutRenders ?? 0 } : null,
        hits: dmg ? dmg.hits : 0,
        hitsMax: run.inventory?.hitsMax ?? 3,
        lastHit: (() => { const h = read(run, 'playerHits', []) ?? []; return h.length ? { ...h[h.length - 1] } : null; })(),
        deaths: deaths.length,
        loadSpans: (read(run, 'deadFrameSpans', []) ?? []).filter((s) => s.kind === 'load').map((s) => s.frames),
        dialogue: cer?.dialogue && !cer.dialogue.done ? { text: cer.dialogue.text ?? '', currentCharacter: cer.dialogue.currentCharacter } : null,
        cutscene0: !!(read(run, 'cutscene', []) ?? [])[0],
        camera: read(run, 'cameraNow', null),
        rain: rainOf(record, room),
        world,
    };
}

const sameVisit = (a, b) => !!a && !!b && a.run === b.run && a.key === b.key;

// ── the camera ──────────────────────────────────────────────────────────

/**
 * The camera `Game.view()` left (`Game.as:1966-2010`), from the run's
 * `cameraNow`: exact, or — under shake — a band. ⚖ The jiggle inside the band
 * is the cosmetic stream (`Rng.cos()`), drawn on `cosmeticRand`; the band's
 * edges are the model's. `jiggle: false` draws the band's middle.
 */
export function jiggleCam(cameraNow, level, tick, { jiggle = true } = {}) {
    if (!cameraNow) return null;
    if (cameraNow.cam) return { x: cameraNow.cam.x, y: cameraNow.cam.y };
    const b = cameraNow.band;
    if (!b) return null;
    const at = (ax, axis) => Math.round(jiggle ? ax.lo + cosmeticRand(level, tick, axis, 0x5a4e) * (ax.hi - ax.lo) : (ax.lo + ax.hi) / 2);
    return { x: at(b.x, 0), y: at(b.y, 1) };
}

// ── the rules ───────────────────────────────────────────────────────────

/** `Explosion.as:38-39`: the scale from `_r`, and the angle — `Rng.cos() · 360`, the cosmetic stream (a named band). */
function explosionPose(blast, view) {
    const r = EXPLOSION_R[blast.source] ?? 24;
    return { scale: (r * 2) / EXPLOSION_FW, angle: cosmeticRand(view.level, hashId(blast.id), blast.t, 0xe7) * 360 };
}

/** `Enemy.dieEffects` (`Enemy.as:189-203`) + `SlashHit.as:22`: `sc` = the body's frame's larger side; scale `sc/32 + 0.35`. */
function slashScale(kill, body) {
    const key = kill.kind === 'spinner' ? KEYS.spinner : familyOf(body.tag)?.key;
    const row = key ? ENEMY_ART.find((r) => r.key === key) : null;
    const sc = row ? Math.max(row.fw, row.fh) : TILE;
    return sc / SLASH_FW + SLASH_SCALE_ADD;
}

/**
 * `Game.update`'s rain (`Game.as:1034-1043`), ONE frame: `!floor(Rng.cos() ·
 * (100 − heaviness))` (heaviness 100 always spawns), the rain rect ∩ the
 * camera's screen, and a Droplet at `int(x + Rng.cos()·w)`, `int(y + h·Rng.cos())`.
 * ⚠ `Rectangle.intersection` of disjoint rects is an EMPTY rect at (0, 0),
 * and the `if` tests the object (always truthy): such a frame spawns at (0, 0).
 * The three draws are the cosmetic stream (`cosmeticRand`, salts 1..3).
 */
function rainSpawn(rain, cam, level, frame) {
    if (!rain || !cam) return null;
    const span = DROP.heavinessMax - rain.heaviness;
    if (Math.floor(cosmeticRand(level, frame, 1, 0xd5) * span)) return null;
    const r = rain.rect;
    const x0 = Math.max(r.x, cam.x);
    const y0 = Math.max(r.y, cam.y);
    const x1 = Math.min(r.x + r.w, cam.x + SCREEN);
    const y1 = Math.min(r.y + r.h, cam.y + SCREEN);
    const hit = x1 > x0 && y1 > y0;
    const ix = hit ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 };
    return { x: Math.trunc(ix.x + cosmeticRand(level, frame, 2, 0xd5) * ix.w), y: Math.trunc(ix.y + ix.h * cosmeticRand(level, frame, 3, 0xd5)) };
}

/**
 * `Droplet` ctor + `added()` (`Droplet.as:25-66`): the drop starts `height`
 * above its landing row; a Solid or a pit under the landing row, or no tile
 * at all, removes it; a cliff/stairs/cave/waterfall tile pushes the landing
 * down a tile. ⚠ A named band: `collideRect("Tile", x−3, endY, 6, 1)` may
 * straddle two tiles and returns one of them; this reads the tile under
 * `(x, endY)`. The Solids are the room's static ones (a pushable is not seen).
 */
function makeDroplet(at, rain, world) {
    const startY = at.y - rain.height;
    let endY = at.y;
    const tileAt = (x, y) => tileGrid(world).get(`${Math.floor(x / TILE)},${Math.floor(y / TILE)}`);
    const box = { x: at.x - DROP.checkW / 2, y: endY, w: DROP.checkW, h: 1 };
    const overlap = (r) => box.x < r.right && box.x + box.w > r.x && box.y < r.bottom && box.y + box.h > r.y;
    let t = tileAt(at.x, endY);
    if ([...(world?.solids ?? []), ...(world?.objectSolids ?? [])].some((s) => overlap(s.rect)) || t === PIT || t === undefined) return null;
    for (let guard = 0; guard < 64 && DROP_FALL_PAST.has(t); guard += 1) {
        endY += TILE;
        t = tileAt(at.x, endY);
        if (t === PIT) return null;
    }
    return { x: at.x, y: startY, startY, endY, vy: DROP.v0, frame: 0, updated: false, colour: rain.colour };
}
const grids = new WeakMap();
function tileGrid(world) {
    if (!world?.tiles) return new Map();
    let g = grids.get(world);
    if (!g) grids.set(world, g = new Map(world.tiles.map((t) => [`${t.tx},${t.ty}`, t.t])));
    return g;
}

/** `Droplet.update` (`:68-89`): `v.y += g`, fall, and once landed `frame += 0.6` until the sheet runs out (removed). */
function dropletStep(d) {
    const vy = d.vy + DROP.g;
    let y = d.y + vy;
    let frame = d.frame;
    if (y >= d.endY) {
        y = d.endY;
        frame += DROP.frameRate;
        if (frame >= DROP.frames) return null;
    }
    return { ...d, y, vy, frame, updated: true };
}

/**
 * `Game.health` from `Player.hitUpdate` (`Player.as:1405`, `Game.as:1531-1535`):
 * the statics `healthc = hitsMax − hits − 1`, `healths = hitsMax`, written on
 * every player update. A swapped visit's first view has updated no player:
 * the statics keep what the LAST update wrote — after a death, the killing
 * hit's row (the enemies update before the player); else the previous sample.
 */
function heartsSample(prev, view, same, deathSwap, tick) {
    if (same || !prev) return { hits: Math.trunc(view.hits), hitsMax: view.hitsMax };
    if (deathSwap && view.lastHit && view.lastHit.t === tick) return { hits: Math.trunc(view.lastHit.hits), hitsMax: view.lastHit.hitsMax };
    return prev;
}

/**
 * ⚖ `Bot.pinDeadFrames` (`Game.as:1843-1852`): a load's `n` dead frames each
 * step `blackCover` by −0.05 in the UPDATE, and the render draws the stepped
 * value — `1 − 0.05k` for k = 1..n, by repeated subtraction, clamped at 0.
 */
function fadeCovers(frames) {
    const out = [];
    let c = 1;
    for (let k = 0; k < frames; k += 1) { c = Math.max(c - BLACK_COVER_RATE, 0); out.push(c); }
    return out;
}

/** `BossTotem.render` while `destroy` (`:577-580`): `rumblingTime++`, then `drawCover(white, rumblingTime / 240 · 2)` (G3c's count). */
function whiteOutAlpha(w) {
    const rumbling = Math.max(0, RUMBLING_MAX - 1 - w.sinceActivation) + w.renders;
    return Math.min((rumbling / RUMBLING_MAX) * 2, 1);
}

/** `talk()`'s `fullString = talkingText.substr(0, currentCharacter)` (`Game.as:1721-1722`). */
const typedText = (d) => d.text.substr(0, d.currentCharacter);

/** The reducer's and the ops' rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const EFFECT_RULES = Object.freeze({
    explosionPose, slashScale, rainSpawn, makeDroplet, dropletStep, heartsSample, fadeCovers, whiteOutAlpha, typedText, updateSprite,
});

// ── the reducer ─────────────────────────────────────────────────────────

/**
 * One GAME tick of the effects (call it after every `tick()`). Pure: returns
 * a new object; `prev` null (or another run) starts afresh.
 *
 * ⛓ The ledgers are the RUN's (they span visits), so what has been seen is
 * counted per run; an entity is per visit (a swap drops them all). An effect
 * the model adds during a tick (`FP.world.add` → `updateLists` at the end of
 * `World.update`) is drawn at its first frame on that tick's render and
 * updates from the next tick, as G3c's shots.
 */
export function stepEffectSkin(prev, view, tick, { rules = EFFECT_RULES, live = true } = {}) {
    if (!view) return prev;
    const R = rules === EFFECT_RULES ? rules : { ...EFFECT_RULES, ...rules };
    const sameRun = !!prev && prev.epoch.run === view.epoch.run;
    const same = sameRun && sameVisit(prev.epoch, view.epoch);
    const deathSwap = sameRun && !same && view.deaths > prev.deaths;
    const seen = sameRun ? { ...prev.seen } : { blasts: 0, bombBlasts: 0, slashKills: 0, loadSpans: 0 };
    const cam = jiggleCam(view.camera, view.level, tick);
    // the explosions and slash hits already alive update; one whose anim ends is removed (`endAnim`)
    const alive = (list, anims) => (same ? list : []).map((e) => {
        const sprite = { ...e.sprite };
        let ended = false;
        R.updateSprite(sprite, anims, () => { ended = true; });
        return ended ? null : { ...e, sprite };
    }).filter(Boolean);
    const explosions = alive(prev?.explosions ?? [], ANIMS[KEYS.explosion]);
    const slashes = alive(prev?.slashes ?? [], ANIMS[KEYS.slash]);
    for (const [name, list] of [['blasts', view.blasts], ['bombBlasts', view.bombBlasts]]) {
        for (const b of list.slice(seen[name])) {
            if (b.level !== view.level || !same) continue;
            const sprite = freshSprite();
            play(sprite, ANIMS[KEYS.explosion], 'explode');
            explosions.push({ id: `${b.id}@${b.t}`, source: b.source, x: b.x, y: b.y, ...R.explosionPose(b, view), sprite });
        }
        seen[name] = list.length;
    }
    for (const k of view.slashKills.slice(seen.slashKills)) {
        const body = (k.kind === 'spinner' ? view.spinners : view.chasers).find((c) => c.id === k.id);
        if (k.level !== view.level || !same || !body) continue;
        const sprite = freshSprite();
        play(sprite, ANIMS[KEYS.slash], 'slash');
        slashes.push({ id: `${k.id}@${k.t}`, kind: k.kind, x: body.x, y: body.y, scale: R.slashScale(k, body), sprite });
    }
    seen.slashKills = view.slashKills.length;
    // the rain: the drops alive update (they are prepended — before the player), then this frame's spawn
    // (`frame` counts every frame the renderer has seen in this run, live and held: the rain's cosmetic key)
    const frame = (sameRun ? prev.frame : 0) + (live ? 1 : 0);
    const droplets = live ? (same ? prev.droplets : []).map(R.dropletStep).filter(Boolean) : [];
    const spawn = live ? R.rainSpawn(view.rain, cam, view.level, frame) : null;
    const drop = spawn ? R.makeDroplet(spawn, view.rain, view.world) : null;
    if (drop) droplets.push(drop);
    // the fade: a build's dead frames (the run spends them; it never ticks them) are owed to the page's hold
    const newLoads = view.loadSpans.slice(seen.loadSpans);
    seen.loadSpans = view.loadSpans.length;
    const fadeQueue = [...(sameRun ? prev.fadeQueue : []), ...newLoads.flatMap((n) => R.fadeCovers(n))];
    return {
        epoch: view.epoch, deaths: view.deaths, seen, frame, cam,
        explosions, slashes, droplets,
        hearts: R.heartsSample(sameRun ? prev.hearts : null, view, same, deathSwap, tick),
        // a live tick ran, so the gate was open: `blackCover <= 0`
        fadeQueue, cover: 0,
    };
}

/**
 * The skin a page starts from BEFORE its first tick: the ledgers counted and
 * the boot build's fade queued (a `new Game`'s dead frames come before its
 * first live update), nothing spawned and nothing updated.
 */
export const primeEffectSkin = (view, opts = {}) => stepEffectSkin(null, view, 0, { ...opts, live: false });

/**
 * ONE DEAD FRAME of a load fade, for the page's hold: the run is not ticked
 * (it already spent these frames), so nothing updates — `super.update()` is
 * gated off by `blackCover > 0` — but `view()` and the rain spawn are outside
 * the gate (`Game.as:880-1043`), so a drop is still ADDED each dead frame (and
 * waits, unmoved and unseen at alpha 0, for the first live frame). Returns
 * the skin with the next cover value showing, or the same skin when nothing
 * is owed. `holdOwed(skin)` says whether the page should hold.
 */
export function holdEffectSkin(skin, view, { rules = EFFECT_RULES } = {}) {
    if (!skin?.fadeQueue?.length) return skin;
    const R = rules === EFFECT_RULES ? rules : { ...EFFECT_RULES, ...rules };
    const [cover, ...rest] = skin.fadeQueue;
    const frame = skin.frame + 1;
    const spawn = view ? R.rainSpawn(view.rain, skin.cam, view.level, frame) : null;
    const drop = spawn ? R.makeDroplet(spawn, view.rain, view.world) : null;
    return { ...skin, frame, fadeQueue: rest, cover, droplets: drop ? [...skin.droplets, drop] : skin.droplets };
}
export const holdOwed = (skin) => !!skin?.fadeQueue?.length;

// ── the ops ─────────────────────────────────────────────────────────────

const boxAt = (x, y, w, h) => ({ x: x - w / 2, y: y - h / 2, w, h, right: x + w / 2, bottom: y + h / 2 });

/**
 * THE WORLD-SPACE OPS at the tick `skin` was stepped to, Y-sorted with the
 * room by `layer`. FlashPunk turns counter-clockwise: an AS3 `angle` is the
 * canvas's `-angle`.
 */
export function effectOps(view, art, { skin } = {}) {
    if (!view || !art || !skin) return [];
    const ops = [];
    const push = (key, frame, at, box, extra) => {
        const fallback = rectOp(box, ENEMY_COLOUR, 0.5 * (extra.alpha ?? 1), extra.layer);
        if (!art.has(key)) { ops.push(fallback); return; }
        const op = spriteOp(art, key, frame, at, { ...extra, fallback });
        if (op) ops.push(op);
    };
    // `Explosion`: `layer = -FP.height` (the ROOM's height, `Game.as:1855`), above every Y-sorted body.
    for (const e of skin.explosions) {
        const r = (e.scale * EXPLOSION_FW) / 2;
        push(KEYS.explosion, e.sprite.frame, e, boxAt(e.x, e.y, 2 * r, 2 * r),
            { rot: -e.angle, scaleX: e.scale, scaleY: e.scale, layer: -view.room.height });
    }
    for (const s of skin.slashes) {
        push(KEYS.slash, s.sprite.frame, s, boxAt(s.x, s.y, SLASH_FW * s.scale, 16 * s.scale),
            { scaleX: s.scale, scaleY: s.scale, layer: -(s.y + SLASH_LAYER_DY) });
    }
    // `Droplet.render` (`:92-101`): alpha (y − startY)/(endY − startY), × the player's fall-off once it has updated
    // (its `player` is set in `update`); frame = int(frame); tinted by its colour. `layer = -startY`.
    for (const d of skin.droplets) {
        let alpha = (d.y - d.startY) / (d.endY - d.startY);
        if (d.updated) alpha *= Math.max(1 - Math.hypot(d.x - view.player.x, d.y - view.player.y) / DROP.maxDist, 0);
        if (!(alpha > 0)) continue;
        push(KEYS.droplet, Math.trunc(d.frame), d, boxAt(d.x, d.y, 9, 5), { alpha, tint: d.colour, layer: -d.startY });
    }
    return ops;
}

/** The font a stack supplies (`KEYS.font`, a glyph sheet: frame = code − 32), or the placeholder. */
export function resolveFont(art) {
    if (art?.has?.(KEYS.font)) {
        const fr = art.frameRect(KEYS.font, 0);
        return { id: KEYS.font, advance: fr.sw, lineHeight: fr.sh, gutter: 4, sprite: true };
    }
    return PLACEHOLDER_FONT;
}

/** FlashPunk `Text`'s box (`Text.as:40-41`): `textWidth + 4` × `textHeight + 4`, lines split on `\n`. */
export function measureText(text, font = PLACEHOLDER_FONT) {
    const lines = text.split('\n');
    return { w: Math.max(...lines.map((l) => l.length)) * font.advance + font.gutter, h: lines.length * font.lineHeight + font.gutter, lines };
}

/** One text draw as glyph ops (the text's top-left at `x, y`, Flash's 2 px gutter inside). */
function textOps(text, x, y, font, art, colour, alpha = 1) {
    const ops = [];
    measureText(text, font).lines.forEach((line, li) => {
        [...line].forEach((ch, ci) => {
            const code = ch.charCodeAt(0);
            if (ch === ' ') return;
            const gx = x + font.gutter / 2 + ci * font.advance;
            const gy = y + font.gutter / 2 + li * font.lineHeight;
            if (font.sprite) {
                const op = spriteOp(art, KEYS.font, code - 32, { x: gx, y: gy }, { layer: 0, tint: colour === '#ffffff' ? null : colour });
                if (op) ops.push({ ...op, glyph: code, font: font.id });
            } else {
                ops.push({ rect: { x: gx, y: gy + (font.lineHeight - font.glyphH) / 2, w: font.glyphW, h: font.glyphH,
                    right: gx + font.glyphW, bottom: gy + (font.lineHeight - font.glyphH) / 2 + font.glyphH },
                colour, alpha, layer: 0, glyph: code, font: font.id });
            }
        });
    });
    return ops;
}

/**
 * `Game.talk()` (`Game.as:1677-1758`) for a pickup ceremony: the two bars
 * (`Draw.rect` takes ints: 0..26 and 133..160), the text typed to the model's
 * `currentCharacter` (`substr(0, currentCharacter)` — the model has already
 * run this render's step), CENTER-aligned (`Pickup.as:103` sets `ALIGN` after
 * `setTemp` set the NPC's "LEFT"), no portrait, and the bold `<X>` once the
 * page is typed out (unless `cutscene[0]`).
 */
function talkOps(view, art, cam, font, R) {
    const d = view.dialogue;
    if (!d) return [];
    const ops = [];
    const n = TALK.n;
    const bar = Math.trunc(SCREEN / n);
    const rect = (x, y, w, h, colour, alpha) => ({ rect: { x, y, w, h, right: x + w, bottom: y + h }, colour, alpha, layer: 0 });
    ops.push(rect(cam.x, cam.y, SCREEN, bar, TALK.colour, TALK.alpha));
    ops.push(rect(cam.x, cam.y + Math.trunc((SCREEN * (n - 1)) / n), SCREEN, Math.trunc(SCREEN / n + 1), TALK.colour, TALK.alpha));
    const shown = R.typedText(d);
    const m = measureText(shown, font);
    const w = TALK.textToImageMargin;
    const alignOffsetX = Math.trunc((SCREEN - w - m.w) / 2);
    const tx = Math.floor(w + alignOffsetX);
    const ty = Math.floor((SCREEN * (n - 1 / 2)) / n - m.h / 2 + 1);
    ops.push(...textOps(shown, cam.x + tx, cam.y + ty, font, art, '#ffffff'));
    if (d.currentCharacter > d.text.length && !view.cutscene0) {
        const x = measureText('<X>', font);
        const px = SCREEN - x.w;
        const py = Math.floor(SCREEN - bar - x.h / 2);
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ops.push(...textOps('<X>', cam.x + px + ox, cam.y + py + oy, font, art, '#000000'));
        ops.push(...textOps('<X>', cam.x + px, cam.y + py, font, art, '#ffffff'));
    }
    return ops;
}

/**
 * THE SCREEN-ANCHORED OPS, in `Game.render()`'s order (`:1071-1083`): the talk
 * bars and text, the cover (`newCoverDraw`: the totem's white-out), the hearts,
 * and the black fade (`cover()`). `cam` is the camera rect's top-left in room
 * pixels (⚖ the model's camera in room mode too).
 */
export function screenOps(view, art, { skin, cam, font = resolveFont(art), rules = EFFECT_RULES } = {}) {
    if (!view || !skin || !cam) return [];
    const R = rules === EFFECT_RULES ? rules : { ...EFFECT_RULES, ...rules };
    const ops = [...talkOps(view, art, cam, font, R)];
    const full = (colour, alpha) => ({ rect: { x: cam.x, y: cam.y, w: SCREEN, h: SCREEN, right: cam.x + SCREEN, bottom: cam.y + SCREEN }, colour, alpha, layer: 0 });
    if (view.whiteOut) ops.push(full('#ffffff', R.whiteOutAlpha(view.whiteOut)));
    // `drawHealth` (`Game.as:1537-1546`): heart i at (160 − 12 − (i % 2)·11, int(i / 2)·11), frame int(i > healthc).
    const { hits, hitsMax } = skin.hearts;
    const healthc = hitsMax - hits - 1;
    for (let i = 0; i < hitsMax; i += 1) {
        const at = { x: cam.x + SCREEN - HEART.w - (i % HEART.cols) * (HEART.w - 1), y: cam.y + Math.trunc(i / 2) * (HEART.h - 1) };
        const frame = i > healthc ? 1 : 0;
        const fallback = { rect: { x: at.x, y: at.y, w: HEART.w, h: HEART.h, right: at.x + HEART.w, bottom: at.y + HEART.h },
            colour: frame ? '#402020' : ENEMY_COLOUR, alpha: 1, layer: 0 };
        ops.push(art?.has(KEYS.heart) ? spriteOp(art, KEYS.heart, frame, at, { layer: 0, fallback }) : fallback);
    }
    // A swapped (or booted) world whose dead frames are still owed has not rendered yet: `new Game` sets `blackCover = 1`.
    const cover = skin.fadeQueue?.length && !skin.cover ? 1 : skin.cover;
    if (cover > 0) ops.push(full('#000000', cover));
    return ops.filter(Boolean);
}

/** One op as a golden line: `formatOp`'s shape plus the overlay fields (an alpha on a rect, a glyph code). */
export function formatEffectOp(op) {
    const a = op.alpha !== undefined && op.alpha !== 1 ? ` alpha=${+op.alpha.toFixed(4)}` : '';
    const g = op.glyph !== undefined ? ` glyph=${op.glyph}` : '';
    if (!op.sheetRef) {
        const r = op.rect;
        return `fillRect(${op.colour}, ${r.x}, ${r.y}, ${(r.right ?? r.x + r.w) - r.x}, ${(r.bottom ?? r.y + r.h) - r.y})${a}${g}`;
    }
    const t = [op.rot ? ` rot=${+op.rot.toFixed(4)}` : '', op.scaleX !== undefined ? ` scale=${+op.scaleX.toFixed(4)}x${+op.scaleY.toFixed(4)}` : '',
        a, op.tint ? ` tint=${op.tint}` : '', g].join('');
    return `drawImage(${op.sheetRef}, ${op.sx}, ${op.sy}, ${+op.dx.toFixed(3)}, ${+op.dy.toFixed(3)})${t}`;
}

