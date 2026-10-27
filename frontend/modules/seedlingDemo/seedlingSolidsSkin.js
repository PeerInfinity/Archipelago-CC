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
 * ⛓ G9c — THE RESPONDERS' FADE (⚖ fidelity-14, 2026-10-26: no game read; the AS3
 * recurrence, anchored on the run). Each responder `activatorsNow` carries is stepped
 * here by its own class's update, transcribed, with `activate` = the run's `held > 0`
 * (a BossLock's: `touched`, which latches as `activate` does), and its `type` held to
 * the run's `open` (the witnessed tick; a disagreement is counted, `skin.drift`):
 *   · Lock / WandLock / GrassLock / ShieldLock (`Lock.as:64-97`): active, `alpha > 0 ?
 *     alpha −= 0.01 (Image-clamped) : turnOff()` — open on step 101; inactive, `alpha = 1`
 *     only while `type == normType`, so an OPENED lock released keeps alpha 0 and, the
 *     tick the run re-closes it (`returnToNormal`), still 0: the alpha line ran first —
 *     1 from the step after. Drawn INVERT while active (a white silhouette under
 *     `difference`), and while active onto nightBmp first, NORMAL (`render()`).
 *   · Cover (`Cover.as:37-73`): active, `alpha −= 0.1` then the test — open on step 11;
 *     inactive, `reset()` only when nothing hitable overlaps it or a Chest does — a
 *     player or a block on it keeps the faded alpha.
 *   · BossLock (`BossLock.as:58-125`): `keyTimer` 60 down, then `scale += 0.05`, `alpha −=
 *     0.05` (a private Number, unclamped; the Image clamps it at the render) — open on
 *     step 80; SCREEN while active with `keyTimer ≤ 20`; the key rising and fading above
 *     it (`alpha = keyTimer / 60`) while `keyTimer > 0`. A release keeps alpha, scale and
 *     keyTimer; a re-close (`type != normType`) restores alpha only.
 * ⚠ Band: a frame the run does not tick (a freeze, a ceremony, dead frames) — the same
 * band as G7's sinking block. ⚠ Residue (`SOLIDS_PENDING`): a Cover's overlap counts the
 * player, the chests and the pushables, not an enemy-free Solid the run does not list;
 * ⛓ G10: the kill locks and the RockLock (tset −1: not in `activatorsNow`) fade from the removal tick
 * their kill-lock ledger row banks, the same recurrence, open on its `declaredAt`.
 * A button's PRESSED frame is drawn from `activatorsNow.pressers` (cleared as-is).
 */
import { HIT_TO_GONE_TICKS as ROCK_CALLBACK } from './breakableRocks.js';
import { HIT_TO_GONE_TICKS as TREE_CALLBACK } from './burnableTree.js';
import { MAGICAL_LOCK_CALLBACK_TICK_OFFSET } from './magicalLock.js';
import { ANIMS, freshSprite, play, rectOp, spriteOp, updateSprite, worldFrame } from './seedlingEnemySkin.js';
import { TILE_LAYER } from './seedlingSkinRenderer.js';
import { objectSolidColour } from './rectPalette.js';
import { playerBoxAt } from './playerPhysicsV2.js';

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
/** Still drawn in their DEFAULT state (G9c drew the responders' fades). */
export const SOLIDS_PENDING = Object.freeze({
    'Cover (residue)': 'a release under a Solid the run does not list (not the player, a chest or a pushable): drawn reset',
    // ⛓ G10 — the kill locks and the RockLock fade from the kill-lock ledgers' removal tick (`spinnerKillLockOpens` /
    //    `chaserKillLockOpens`), opening on `declaredAt`; what stays is the MODEL's residue, named here
    'a KILL lock / RockLock (residue, model)': 'the run banks the clear and keeps the body SOLID this visit, so the picture opens on '
        + '`declaredAt` while the run\'s wall stays (⛓ G11: L112\'s tset-0 RockLock fades from the Owl\'s `tagsWritten` row, '
        + '`Button.activateAll(null, 0, true)`; the picture is the game\'s, the wall is whatever the model keeps — not read here)',
    'a KILL lock (band)': 'its ledger row lands a tick after the removal tick, so its first faded frame (0.99) is drawn at 1; the '
        + 'reducer catches up, and the open is on `declaredAt`',
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

/** The tick this visit of the run's level began (its newest arrival), 0 for the boot visit. */
function visitStartOf(run) {
    const ts = run.transitions ?? [];
    for (let i = ts.length - 1; i >= 0; i -= 1) if ((ts[i].to_level ?? ts[i].to) === run.level) return ts[i].t ?? 0;
    return 0;
}
/** A kill lock's fade: 100 steps of 0.01, open on the 101st (`Lock.activationStep`, `RockLock.update`). */
const KILL_FADE_STEPS = 100;

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
    const acts = read(run, 'activatorsNow', null);
    const pressed = new Map((acts?.pressers ?? []).map((p) => [p.id, p.down]));
    const live = new Map((acts?.responders ?? []).map((r) => [r.id, r]));
    // ⛓ G10 — a KILL lock's (tset −1) activation: the removal tick the run's kill-lock ledgers bank for it THIS visit
    // (`Lock.checkEnemies` / `RockLock.update`: `totalEnemies() == 0` from that tick on; the open is 100 later)
    const since = visitStartOf(run);
    const killFrom = new Map();
    for (const row of [...(read(run, 'spinnerKillLockOpens', []) ?? []), ...(read(run, 'chaserKillLockOpens', []) ?? [])]) {
        if (row.level !== level || row.nil || !(row.t >= since)) continue;
        for (const o of row.opens ?? []) if (!killFrom.has(o.at)) killFrom.set(o.at, row.t);
    }
    const killHeld = (id) => (killFrom.has(id) && now >= killFrom.get(id) ? now - killFrom.get(id) + 1 : null);
    // ⛓ G11 — a GROUP RockLock (tset ≥ 0): the Owl's "dead" arm runs `Button.activateAll(null, 0, true)` (the run's
    // `finalBossKills` `tagsWritten` row, stamped with the tick's pre-increment `ticksCompleted`), activating every
    // tset-0 Activators. The lock updates BEFORE the Owl (`stepOwlNow`'s order), so that tick it renders active at
    // alpha 1 and its first fade step is the next tick's: steps = now − (t + 1).
    const groupFrom = new Map();
    for (const row of read(run, 'finalBossKills', []) ?? []) {
        if (row.level === level && row.what === 'tagsWritten' && row.t >= since && !groupFrom.has(0)) groupFrom.set(0, row.t + 1);
    }
    const tsetOf = (o) => {
        const e = (record?.entities ?? []).find((x) => x.type === 'rocklock' && Number(x.x) === o.x && Number(x.y) === o.y);
        return e ? Number.parseInt(e.attrs?.tset ?? e.attrs?.t ?? '-1', 10) : null;
    };
    const groupSteps = (o) => {
        const t = tsetOf(o);
        return t !== null && t >= 0 && groupFrom.has(t) && now >= groupFrom.get(t) ? now - groupFrom.get(t) : null;
    };
    const box = playerBoxAt(run.state.x, run.state.y);
    const pushables = read(run, 'pushables', null);
    const blocks = pushables ? [...pushables.values()].filter((b) => !b.removed).map((b) => b.rect) : [];
    const chestBoxes = (world?.chests ?? []).map((c) => ({ x: c.x, y: c.y, right: c.x + 16, bottom: c.y + 16 }));
    const hit = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
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
        responders: (world?.activators ?? []).filter((a) => RESPONDER_ART[a.tag]).map((a) => {
            const r = live.get(a.id);
            const cell = { x: a.x, y: a.y, right: a.x + 16, bottom: a.y + 16 };
            return {
                id: a.id, tag: a.tag, x: a.x, y: a.y, keyType: a.keyType ?? null, open: open.has(a.id),
                // ⛓ G9c — what the class's own update reads: the run's step count / latch, and (a Cover's reset) what overlaps it
                ...(r ? { held: r.held, touched: !!r.touched, overlap: [box, ...blocks, ...chestBoxes].some((b) => hit(b, cell)),
                    chestUnder: chestBoxes.some((b) => hit(b, cell)) } : {}),
                // ⛓ G10 — a kill lock: its held steps from the kill-lock ledger; it opens on the 101st (`declaredAt`).
                // ⚠ RESIDUE (model): the run keeps it SOLID this visit (it banks the clear); the picture is the game's.
                ...(!(r?.held > 0) && killHeld(a.id) !== null ? { held: killHeld(a.id), touched: false, overlap: false, chestUnder: false, kill: true,
                    open: killHeld(a.id) > KILL_FADE_STEPS } : {}),
            };
        }),
        rockLocks: solids.filter((o) => o.tag === 'rocklock').map((o) => ({ id: `rocklock@${o.x},${o.y}`, x: o.x, y: o.y,
            held: killHeld(`rocklock@${o.x},${o.y}`) ?? 0, group: groupSteps(o) })),
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

/** `Image.alpha`'s setter (`graphics/Image.as:155-158`). */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Which class's update a responder tag runs. */
export const RESPONDER_CLASS = Object.freeze({ lock: 'lock', wandlock: 'lock', grasslock: 'lock', shieldlock: 'lock', shieldlocknorm: 'lock',
    cover: 'cover', bosslock: 'bosslock' });
/** `BossLock.as:27` `keyTimerMax`. */
export const BOSS_KEY_TIMER = 60;

/**
 * ONE UPDATE of a responder's own state, transcribed (`Lock.activationStep`, `Cover.update`, `BossLock.update`),
 * `activate` read off the run. Returns `{state, drift}`: `drift` when the class's `type` disagreed with the run's
 * `open` (the witnessed fact), which then wins.
 */
export function stepResponder(prev, a) {
    const cls = RESPONDER_CLASS[a.tag];
    const s = prev ? { ...prev } : (cls === 'bosslock'
        ? { keyTimer: BOSS_KEY_TIMER, alpha: 1, scale: 1, solid: true, active: false }
        : { alpha: 1, solid: true, active: false });
    if (cls === 'bosslock') {
        s.active = a.touched;
        if (s.active) {
            if (s.keyTimer > 0) s.keyTimer -= 1;
            else {
                s.scale += 0.05;
                s.alpha -= 0.05;
                if (s.alpha <= 0 && s.solid) { s.solid = false; s.alpha = 0; }
            }
        } else if (!s.solid) { s.solid = true; s.alpha = 1; }
    } else if (cls === 'cover') {
        s.active = a.held > 0;
        if (s.active) {
            s.alpha = clamp01(s.alpha - 0.1);
            if (s.alpha <= 0) { s.solid = false; s.alpha = 0; }
        } else if (!a.overlap || a.chestUnder) { s.solid = true; s.alpha = 1; }
    } else {
        s.active = a.held > 0;
        if (s.active) {
            if (s.alpha > 0) s.alpha = clamp01(s.alpha - 0.01);
            else if (s.solid) { s.solid = false; s.alpha = 0; }
        } else {
            if (s.solid) s.alpha = 1;
            // `returnToNormal()` AFTER the alpha line: the run's re-close is the anchor, the alpha follows a step later
            if (!s.solid && !a.open) s.solid = true;
        }
    }
    let drift = false;
    if (s.solid === a.open) {
        drift = true;
        s.solid = !a.open;
        if (a.open) s.alpha = 0;
    }
    return { state: s, drift };
}

/** `RockLock.update` (`RockLock.as:49-70`) for one step, `active` its `activate` (a kill lock: `totalEnemies() == 0`). */
export function stepRockLock(prev, active) {
    const s = { ...prev, active };
    if (active) {
        if (s.alpha > 0) {
            s.alpha = clamp01(s.alpha - 0.01);
            if (s.alpha <= 0) { s.solid = false; s.alpha = 0; }
        }
    } else if (!s.solid) { s.solid = true; s.alpha = 1; }
    return s;
}

/** The reducer's rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const SOLIDS_RULES = Object.freeze({ chestTimer, buttonFrame, spriteAfter, worldFrame, stepResponder, stepRockLock });

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
    const responders = new Map();
    let drift = same ? prev.drift ?? 0 : 0;
    for (const a of view.responders) {
        if (a.held === undefined) continue;
        const before = same ? prev.responders?.get(a.id) ?? null : null;
        // ⛓ G10 — a kill lock's ledger row lands a tick AFTER its removal tick: catch up the steps it owes, so it opens
        // on `declaredAt` (only its first faded frame is late — a band)
        const steps = a.kill ? Math.max(1, a.held - (before?.killHeld ?? 0)) : 1;
        let r = { state: before, drift: false };
        for (let k = 0; k < steps; k += 1) {
            r = R.stepResponder(r.state, a);
            if (r.drift) drift += 1;
        }
        responders.set(a.id, a.kill ? { ...r.state, killHeld: a.held } : r.state);
    }
    // ⛓ G10 — `RockLock.update`: while active, alpha −= 0.01 (the Image clamp) and open at ≤ 0; no reset while it holds
    const rockLocks = new Map();
    for (const r of view.rockLocks ?? []) {
        const old = same ? prev.rockLocks?.get(r.id) : null;
        if (r.group !== null && r.group !== undefined) {
            // ⛓ G11 — a group lock: active from its activation tick, `group` fade steps since (a pure function of the count)
            let st = { alpha: 1, solid: true, active: true };
            for (let i = 0; i < Math.min(r.group, KILL_FADE_STEPS + 1); i += 1) st = R.stepRockLock(st, true);
            rockLocks.set(r.id, st);
            continue;
        }
        rockLocks.set(r.id, R.stepRockLock(old ?? { alpha: 1, solid: true, active: false }, r.held > 0));
    }
    return { epoch: view.epoch, tick, chests, buttons, responders, rockLocks, drift, rules: R };
}

// ── the ops ─────────────────────────────────────────────────────────────

const cellBox = (x, y, w = 16, h = 16) => ({ x, y, w, h, right: x + w, bottom: y + h });
/** `BlendMode.INVERT` on a canvas: the picture's white SILHOUETTE (a `tint` the page's `tinted` reads as `=colour`) under `difference`. */
export const INVERT_SILHOUETTE = '=#ffffff';

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
        const st = skin.responders?.get(a.id) ?? null;
        const spec = RESPONDER_ART[a.tag];
        const key = typeof spec.key === 'function' ? spec.key(a) : spec.key;
        const frame = R.worldFrame(now, spec.frames);
        const colour = objectSolidColour({ activatorId: a.id });
        if (!st) {
            if (a.open) continue;   // ⚠ no live state (a kill lock): shut until the run opens it
            push(key, frame, centre(a), cellBox(a.x, a.y), colour, { layer: spec.layer(a.y) });
            continue;
        }
        const alpha = clamp01(st.alpha);
        const cls = RESPONDER_CLASS[a.tag];
        if (cls === 'bosslock') {
            const extra = { layer: spec.layer(a.y), ...(alpha !== 1 ? { alpha } : {}) };
            if (st.scale !== 1) Object.assign(extra, { scaleX: st.scale, scaleY: st.scale });
            if (alpha > 0) {
                push(key, frame, centre(a), cellBox(a.x, a.y), colour, extra);
                if (st.active && st.keyTimer <= BOSS_KEY_TIMER / 3 && ops.at(-1)?.sheetRef) ops[ops.length - 1].blend = 'screen';
            }
            if (st.active && st.keyTimer > 0) {
                // `myKey.render(…)`: centred on (x, y + height/2 − key.height − keyTimer/60·8 + 3), at keyTimer/60
                const keyArt = `seedling:pickup/bosskey${a.keyType ?? 0}`;
                const at = { x: a.x + 8, y: a.y + 8 + 8 - 16 - (st.keyTimer / BOSS_KEY_TIMER) * 8 + 3 };
                push(keyArt, 0, at, cellBox(at.x - 6, at.y - 8, 12, 16), '#e8c040', { layer: spec.layer(a.y), alpha: st.keyTimer / BOSS_KEY_TIMER });
            }
            continue;
        }
        if (alpha <= 0) continue;
        push(key, frame, centre(a), cellBox(a.x, a.y), colour, { layer: spec.layer(a.y), ...(alpha !== 1 ? { alpha } : {}) });
        if (cls === 'lock' && st.active && ops.at(-1)?.sheetRef) {
            // `render()`: while active, the picture onto nightBmp (NORMAL), then INVERT on the main buffer
            Object.assign(ops[ops.length - 1], { blend: 'difference', tint: INVERT_SILHOUETTE, nightCopy: true });
        }
    }
    for (const r of view.rockLocks) {
        // `RockLock.render`: while active, the picture onto nightBmp (NORMAL), then INVERT on the main buffer
        const st = skin.rockLocks?.get(r.id) ?? null;
        const alpha = st ? clamp01(st.alpha) : 1;
        if (alpha <= 0 && st && !st.solid) continue;
        push(KEYS.rockLock, 0, centre(r), cellBox(r.x, r.y), objectSolidColour({}), { layer: 0, ...(alpha !== 1 ? { alpha } : {}) });
        if (st?.active && ops.at(-1)?.sheetRef) Object.assign(ops[ops.length - 1], { blend: 'difference', tint: INVERT_SILHOUETTE, nightCopy: true });
    }
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
