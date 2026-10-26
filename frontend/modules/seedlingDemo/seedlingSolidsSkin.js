/**
 * seedlingDemo/seedlingSolidsSkin — **THE CHANGEABLE SOLIDS AND THE BUTTONS, IN
 * THE ORIGINAL GRAPHICS** (Seedling JS graphics G8). G7's three pieces again
 * (`seedlingPuzzleSkin.js`):
 *
 *   · `solidsSkinView(run, { record })` — THE ONE ADAPTER from the run (and the
 *     room's `.oel` record: the wires under a `ButtonRoom`) to what these
 *     pictures need. It copies; it writes nothing.
 *   · `stepSolidsSkin(prev, view, tick)` — the renderer's own FlashPunk state,
 *     one GAME tick at a time: a chest's `openTimer`.
 *   · `solidsOps(view, art, { skin })` — PURE. The draw ops, Y-sorted with the
 *     room by each class's own `layer`.
 *
 * ── What AS3 does, transcribed (`vendor/seedling/src`) ─────────────────
 *
 *   · CHEST (`Chest.as`) — centred on its cell, frame 0; `open()` sets frame
 *     1 and `openTimer = 60`, and `timerStep` (the same update) takes one off
 *     and sets `alpha = min(openTimer / 20, 1)`; at 0 it is removed.
 *     `layer = -(y - originY)` = the cell's top.
 *   · BREAKABLE ROCK (`Puzzlements/BreakableRock.as`) — frame 0 until `hit()`
 *     plays "break" [0,1,2,3] at 20 fps; `endAnim` removes it. Type 1 is the
 *     ghost sheet. `layer = -(y - originY + height)`.
 *   · BURNABLE TREE (`Scenery/BurnableTree.as`) — the burn sheet's frame 0
 *     until a fire `hit()` plays "burn" [0..19] at 15 fps; `burnEnd` removes
 *     it. Centred on its 2 × 2 (`Tree.as:20`), `layer = -(y - 16 + 32)`.
 *   · MAGICAL LOCK (`Puzzlements/MagicalLock.as`) — `Game.worldFrame(3)` at the
 *     render until a wand `hit()` plays "destroy" [3..9] at 15 fps; `animEnd`
 *     removes it. Type 1 is the fire sheet.
 *   · THE ACTIVATOR RESPONDERS — `Lock` (and `WandLock`, `GrassLock`,
 *     `ShieldLock`'s two sheets), `Cover` and `BossLock` draw
 *     `Game.worldFrame(frameCount)` at the render; `RockLock` is a plain Image
 *     with no `layer` (0).
 *   · BUTTONS — `Button` frame `int(_active)`, `layer = -y`; `ButtonRoom`
 *     frame `int(_active) + frameAdd` (2 when a Wire lies under it,
 *     `ButtonRoom.as:44-48`), at `Tile.LAYER`.
 *
 * ── LIVE STATE: the run's own ledgers, each read without building ───────
 * A rock's, tree's or magical lock's picture is its Spritemap `k` updates
 * after the `play`, where `k` is counted BACK from the run's own end tick:
 * the model already says how many updates the animation takes to reach its
 * callback (`breakableRocks.HIT_TO_GONE_TICKS`, `burnableTree`'s, a magical
 * lock's `MAGICAL_LOCK_CALLBACK_TICK_OFFSET + 1`) and on which tick it fires
 * (`goneAt`, `callbackTick`), so the last frame drawn and the run's removal are
 * ONE fact. `k = N − (end + 1 − now)`; drawn while `now ≤ end`. ⚠ Band: the
 * collision reads (`brokenRocks` asks the NEXT tick's geometry) drop the cell a
 * view before the picture goes; the picture follows the callback, the run's
 * geometry is untouched. A chest is `openChests` + its own 60-update timer.
 *
 * ⛔ NOT YET (`SOLIDS_PENDING`, the brief's step 2): the responders' FADE (Lock
 * alpha −0.01 drawn INVERT while active, Cover −0.1, BossLock's keyTimer,
 * scale and key icon). `activatorsNow` (⚖ fidelity-13, 2026-10-25) reads the
 * model's fade, but only its OPEN tick is game-witnessed, and the acceptance is a
 * frame-by-frame game read of alpha/held; until then a responder is drawn shut
 * (opaque, normal) until `openActivators` says open, then not drawn. A button's
 * PRESSED frame is drawn from `activatorsNow.pressers` (cleared as-is).
 */
import { HIT_TO_GONE_TICKS as ROCK_CALLBACK } from './breakableRocks.js';
import { HIT_TO_GONE_TICKS as TREE_CALLBACK } from './burnableTree.js';
import { MAGICAL_LOCK_CALLBACK_TICK_OFFSET } from './magicalLock.js';
import { ANIMS, freshSprite, play, rectOp, spriteOp, updateSprite, worldFrame } from './seedlingEnemySkin.js';
import { TILE_LAYER } from './seedlingSkinRenderer.js';
import { objectSolidColour } from './rectPalette.js';

export const KEYS = Object.freeze({
    chest: 'seedling:puzzlement/chest',
    rock: 'seedling:puzzlement/breakablerock',
    rockGhost: 'seedling:puzzlement/breakablerockghost',
    tree: 'seedling:scenery/burnabletree',
    magicalLock: 'seedling:puzzlement/magicallock',
    magicalLockFire: 'seedling:puzzlement/magicallockfire',
    rockLock: 'seedling:puzzlement/rocklock',
    button: 'seedling:puzzlement/button',
    buttonRoom: 'seedling:puzzlement/buttonroom',
});

/** The activator responders: sheet, `frameCount` (the sheet's width / 16) and `layer` from the cell's top `y`. */
export const RESPONDER_ART = Object.freeze({
    lock: Object.freeze({ key: 'seedling:puzzlement/lock', frames: 6, layer: (y) => -(y + 8) }),
    wandlock: Object.freeze({ key: 'seedling:puzzlement/wandlock', frames: 6, layer: (y) => -(y + 8) }),
    grasslock: Object.freeze({ key: 'seedling:puzzlement/grasslock', frames: 5, layer: (y) => -(y + 8) }),
    shieldlock: Object.freeze({ key: 'seedling:puzzlement/shieldlock', frames: 6, layer: (y) => -(y + 8) }),
    shieldlocknorm: Object.freeze({ key: 'seedling:puzzlement/shieldlocknorm', frames: 6, layer: (y) => -(y + 8) }),
    // `Cover.as:28` `layer = -(y - originY + height + 1)`
    cover: Object.freeze({ key: 'seedling:puzzlement/cover', frames: 8, layer: (y) => -(y + 17) }),
    // `BossLock.as:37` `layer = -(y - originY + height)`; the sheet is `Game.bossLocks[keyType]`
    bosslock: Object.freeze({ key: (a) => `seedling:puzzlement/bosslock${a.keyType ?? 0}`, frames: 7, layer: (y) => -(y + 16) }),
});

/** The `.oel` tags whose build-time rectangles these pictures replace (`roomOps`' `drawnObjects`). */
export const SOLIDS_OBJECT_TAGS = Object.freeze(new Set(['chest', 'breakablerock', 'breakablerockghost', 'burnabletree',
    'magicallock', 'magicallockfire', 'rocklock', ...Object.keys(RESPONDER_ART)]));

/** `Chest.as:20` `openTimerMax`; `:98` the alpha's divisor `openTimerMax / 3`. */
const CHEST_OPEN_TIMER = 60;
const CHEST_FADE = CHEST_OPEN_TIMER / 3;

/** WHAT G8 DRAWS, by AS3 class. */
export const SOLIDS_COVERAGE = Object.freeze({
    drawn: Object.freeze(['Chest', 'BreakableRock', 'BurnableTree', 'MagicalLock', 'Lock', 'WandLock', 'GrassLock', 'ShieldLock',
        'Cover', 'BossLock', 'RockLock', 'Button', 'ButtonRoom']),
});
/** Drawn in their DEFAULT state until `activatorsNow` is cleared (the brief's step 2). */
export const SOLIDS_PENDING = Object.freeze({
    'Lock / WandLock / GrassLock / ShieldLock': 'the fade: alpha −0.01 per active update, drawn INVERT while active (Lock.as:64-130)',
    Cover: 'the fade: alpha −0.1 per active update (Cover.as:37-73)',
    BossLock: 'keyTimer 60, then alpha −0.05 / scale +0.05, SCREEN in the last third, the key icon (BossLock.as:58-125)',
    RockLock: 'the kill-lock fade and INVERT (RockLock.as:49-88); drawn shut while the world holds it',
    'a KILL lock (tset −1, `world.killLocks`)': 'its fade after the last kill (Lock.as:109-115): the run banks the clear through its '
        + 'kill-lock ledgers and does not open the activator this visit, so it is drawn shut until a build despawns it',
});

// ── the adapter ─────────────────────────────────────────────────────────

/** A getter's value, or `fallback` when the run has no such member (a stub run in a test). */
const read = (run, name, fallback) => (name in run ? run[name] ?? fallback : fallback);
const asSet = (v) => (v instanceof Set ? v : new Set(v ?? []));

/** The NEWEST ledger row per id in `level` (a magical lock may be hit again, `hitMagicalLock`'s `restarted`). */
function newestBy(rows, level) {
    const out = new Map();
    for (const r of rows ?? []) if (r.level === level) out.set(r.id, r);
    return out;
}

/**
 * THE ADAPTER. Everything these pictures read, as plain objects (null when
 * there is no run). `record` is the room's level record (`{entities}`).
 */
export function solidsSkinView(run, { record = null } = {}) {
    if (!run?.state) return null;
    const world = run.world ?? null;
    const level = run.level;
    const now = read(run, 'ticksCompleted', 0);
    const solids = world?.objectSolids ?? [];
    const openChests = asSet(read(run, 'openChests', null));
    const broken = asSet(read(run, 'brokenRocks', null));
    const burned = asSet(read(run, 'burnedTrees', null));
    const open = asSet(read(run, 'openActivators', null));
    const hits = newestBy(read(run, 'rocksBroken', []), level);
    const burns = newestBy(read(run, 'treeBurns', []), level);
    const wands = newestBy(read(run, 'magicalLocksOpened', []), level);
    const pressed = new Map((read(run, 'activatorsNow', null)?.pressers ?? []).map((p) => [p.id, p.down]));
    const wires = new Set((record?.entities ?? []).filter((e) => e.type === 'wire').map((e) => `${Number(e.x)},${Number(e.y)}`));
    // `k` updates into the animation, counted back from the run's own end tick (`end`); null = not running. A ledger
    // row from an EARLIER visit (a rebuilt `tag = -1` body) has ended, so it is not this one's.
    const running = (r, n, end) => (r && now <= r[end] && n - (r[end] + 1 - now) >= 0 ? n - (r[end] + 1 - now) : null);
    const ended = (r, end) => !!r && now > r[end];
    return {
        epoch: { run, key: `${level}|${run.transitions?.length ?? 0}|${run.playerDeaths?.length ?? 0}` },
        level,
        now,
        gameTime: run.gameTime ?? null,
        chests: (world?.chests ?? []).map((c) => ({ id: c.id, x: c.x, y: c.y, open: openChests.has(c.id) })),
        rocks: solids.filter((o) => o.rockId).map((o) => {
            const r = hits.get(o.rockId);
            return { id: o.rockId, x: o.x, y: o.y, ghost: o.rockType === 1, k: running(r, ROCK_CALLBACK, 'goneAt'),
                gone: broken.has(o.rockId) && (!r || ended(r, 'goneAt')) };
        }).filter((r) => !r.gone),
        trees: (world?.burnableTrees ?? []).map((t) => {
            const r = burns.get(t.id);
            return { id: t.id, x: t.x, y: t.y, k: running(r, TREE_CALLBACK, 'goneAt'), gone: burned.has(t.id) && (!r || ended(r, 'goneAt')) };
        }).filter((t) => !t.gone),
        magicalLocks: (world?.magicalLocks ?? []).map((m) => {
            const r = wands.get(m.id);
            const row = r && { ...r, end: r.hitTick + MAGICAL_LOCK_CALLBACK_TICK_OFFSET };
            return { id: m.id, x: m.x, y: m.y, fire: m.lockType === 1, k: running(row, MAGICAL_LOCK_CALLBACK_TICK_OFFSET + 1, 'end'),
                gone: ended(row, 'end') };
        }).filter((m) => !m.gone),
        responders: (world?.activators ?? []).filter((a) => RESPONDER_ART[a.tag]).map((a) => ({
            id: a.id, tag: a.tag, x: a.x, y: a.y, keyType: a.keyType ?? null, open: open.has(a.id),
        })),
        rockLocks: solids.filter((o) => o.tag === 'rocklock').map((o) => ({ x: o.x, y: o.y })),
        buttons: (world?.pressers ?? []).map((p) => {
            const id = `${p.tag}@${p.x},${p.y}`;
            // `ButtonRoom.check()`: `_active = !checkPersistence(tag)` (the world's `bootPressed`) on the build's frame
            const boot = p.tag === 'buttonroom' && p.bootPressed === true;
            return { id, tag: p.tag, x: p.x, y: p.y, boot, down: pressed.has(id) ? pressed.get(id) === true : boot,
                wire: p.tag === 'buttonroom' && wires.has(`${p.x},${p.y + 16}`) };
        }),
    };
}

const sameVisit = (a, b) => !!a && !!b && a.run === b.run && a.key === b.key;

// ── the reducer ─────────────────────────────────────────────────────────

/** `Chest.timerStep` (:93-104) — the timer after this update; `open()` (:70-91) sets it on the opening one. */
const chestTimer = (prev, open) => (!open ? null : Math.max((prev ?? CHEST_OPEN_TIMER) - 1, 0));
/** `Button.as:47` / `ButtonRoom.as:97` `frame = int(_active)`: the press seen one update ago (the build's: `boot`). */
const buttonFrame = (before, b) => (before ? before.seen : b.boot);
/** The Spritemap `k` updates after `play(name)` (`Spritemap.update`, the enemy skin's transcription). */
function spriteAfter(key, name, k) {
    const sp = freshSprite();
    play(sp, ANIMS[key], name);
    for (let i = 0; i < k; i += 1) updateSprite(sp, ANIMS[key], () => {});
    return sp;
}

/** The reducer's rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const SOLIDS_RULES = Object.freeze({ chestTimer, buttonFrame, spriteAfter, worldFrame });

/** One GAME tick of these pictures (call it after every `tick()`). Pure: returns a new object. */
export function stepSolidsSkin(prev, view, tick, { rules = SOLIDS_RULES } = {}) {
    if (!view) return prev;
    const R = rules === SOLIDS_RULES ? rules : { ...SOLIDS_RULES, ...rules };
    const same = !!prev && sameVisit(prev.epoch, view.epoch);
    const chests = new Map();
    for (const c of view.chests) chests.set(c.id, R.chestTimer(same ? prev.chests.get(c.id) : null, c.open));
    // A button updates BEFORE the Player (`World.addUpdate` prepends), so the frame drawn after this tick is the press
    // the run reported after the PREVIOUS one (`activatorsNow` reads the box this tick left); the build's frame is `boot`.
    const buttons = new Map();
    for (const b of view.buttons) {
        const before = same ? prev.buttons.get(b.id) : null;
        buttons.set(b.id, { shown: R.buttonFrame(before, b), seen: b.down });
    }
    return { epoch: view.epoch, tick, chests, buttons, rules: R };
}

// ── the ops ─────────────────────────────────────────────────────────────

const cellBox = (x, y, w = 16, h = 16) => ({ x, y, w, h, right: x + w, bottom: y + h });

/**
 * THE DRAW OPS at the tick `skin` was stepped to. Every op carries the body's
 * cell as its fallback rectangle; a body whose key the stack lacks is that
 * rectangle.
 */
export function solidsOps(view, art, { skin } = {}) {
    if (!view || !art || !skin) return [];
    const R = skin.rules ?? SOLIDS_RULES;
    const ops = [];
    const push = (key, frame, at, box, colour, extra) => {
        const fallback = rectOp(box, colour, 0.85 * (extra.alpha ?? 1), extra.layer);
        ops.push(art.has(key) ? spriteOp(art, key, frame, at, { ...extra, fallback }) : fallback);
    };
    const now = view.gameTime ?? 0;
    const centre = (o, h = 8) => ({ x: o.x + h, y: o.y + h });
    for (const c of view.chests) {
        const timer = skin.chests.get(c.id) ?? null;
        if (timer === 0) continue;   // `timerStep`: `FP.world.remove(this)`
        const alpha = timer === null ? 1 : Math.min(timer / CHEST_FADE, 1);
        push(KEYS.chest, c.open ? 1 : 0, centre(c), cellBox(c.x, c.y), objectSolidColour({ chestId: c.id }), { alpha, layer: -c.y });
    }
    for (const r of view.rocks) {
        const key = r.ghost ? KEYS.rockGhost : KEYS.rock;
        const frame = r.k === null ? 0 : R.spriteAfter(key, 'break', r.k).frame;
        push(key, frame, centre(r), cellBox(r.x, r.y), objectSolidColour({ rockId: r.id }), { layer: -(r.y + 16) });
    }
    for (const t of view.trees) {
        const frame = t.k === null ? 0 : R.spriteAfter(KEYS.tree, 'burn', t.k).frame;
        push(KEYS.tree, frame, centre(t, 16), cellBox(t.x, t.y, 32, 32), objectSolidColour({ treeId: t.id }), { layer: -(t.y + 32) });
    }
    for (const m of view.magicalLocks) {
        const key = m.fire ? KEYS.magicalLockFire : KEYS.magicalLock;
        const frame = m.k === null ? R.worldFrame(now, 3) : R.spriteAfter(key, 'destroy', m.k).frame;
        push(key, frame, centre(m), cellBox(m.x, m.y), objectSolidColour({ magicalLockId: m.id }), { layer: -(m.y + 16) });
    }
    for (const a of view.responders) {
        if (a.open) continue;   // ⚠ default state (SOLIDS_PENDING): an open responder's alpha is 0
        const spec = RESPONDER_ART[a.tag];
        const key = typeof spec.key === 'function' ? spec.key(a) : spec.key;
        push(key, R.worldFrame(now, spec.frames), centre(a), cellBox(a.x, a.y), objectSolidColour({ activatorId: a.id }), { layer: spec.layer(a.y) });
    }
    for (const r of view.rockLocks) push(KEYS.rockLock, 0, centre(r), cellBox(r.x, r.y), objectSolidColour({}), { layer: 0 });
    for (const b of view.buttons) {
        const down = skin.buttons.get(b.id)?.shown ?? b.boot;
        if (b.tag === 'button') {
            push(KEYS.button, down ? 1 : 0, centre(b), cellBox(b.x + 4, b.y + 5, 8, 6), '#c0c0c0', { layer: -(b.y + 8) });
        } else {
            push(KEYS.buttonRoom, (down ? 1 : 0) + (b.wire ? 2 : 0), centre(b), cellBox(b.x + 4, b.y + 5, 8, 6), '#c0c0c0', { layer: TILE_LAYER });
        }
    }
    return ops.filter(Boolean);
}
