/**
 * seedlingBridgeSkin — THE BRIDGE'S PICTURE (tile 29), as the run says it is: closed, opening or open.
 *
 * `Scenery/Tile.as:343-376` (`render()`, `case 29`), read at the pinned `vendor/seedling`:
 *
 *   · `:75-77` `closedBridge = [0, 1]`, `openingBridge = [1..6]`, `openBridge = [7..18]` over `Game.sprBridge`
 *     (`Game.as:274-275`, `OpenBridge.png`, 16 × 16 — the pack's `seedling:tile/bridge`, 19 frames);
 *   · `:78-79` `bridgeOpeningTimerMax = 60`, the timer starts there;
 *   · `:344-349` CLOSED (`timer >= 60`): `closedBridge[Game.worldFrame(2, loops = 2)]` — the WORLD clock, the
 *     pack's `closed` anim;
 *   · `:350-356` OPENING (`0 < timer < 60`): `timer--` FIRST, then `openingBridge[int((1 - timer / 60) * 6)]`
 *     under `BlendMode.INVERT`. It is a function of the timer, not of the world clock, and it plays ONCE
 *     (the timer only falls). ⚠ At the last opening render the timer is 0 and the index is 6, one past the
 *     array: `openingBridge[6]` is `undefined`, which `Spritemap.frame:int` takes as 0 — frame 0, inverted;
 *   · `:357-362` OPEN (`timer <= 0`): `openBridge[Game.worldFrame(12, loops = 2)]` — the WORLD clock again (the
 *     pack's `open` anim), NOT timed from the opening: it does not start on frame 7 and it does not hold its last
 *     frame, it loops with every other open bridge in the room;
 *   · `:363-364` the main draw, then `blend = NORMAL`;
 *   · `:366-377` the night copy onto `nightBmp`: alpha `sin-pulse · 0.1` (`seedlingNightSkin.TILE_NIGHT`), but
 *     `1` while opening (`:370-373`), and NORMAL blend (`:364` reset it before this draw).
 *
 * The timer leaves 60 only through `Player.as:1098` (a Spear's `genericHit`, `bridges.js`), and the run holds the
 * result per visit (`levelRun`'s `bridgeStates`, `openBridges`). This module READS the run (`bridgeSkinView`):
 *
 *   · OPEN ⇔ `run.openBridges.has(bridgeId)` — the run's own crossing gate, so the picture is open exactly when
 *     the run lets the player through, never one tick apart from it;
 *   · OPENING: the press row in `run.presses` (`hits: [{as3: 'Tile', id}]`, this level, this visit) gives the
 *     press tick `t` and the hit tick `fired`. The run opens the crossing at `ticksCompleted = t + 60 − 1`
 *     (`openAt`; the gate reads `observation = ticksCompleted + 1 >= walkableAt = t + 60`). The AS3's opening
 *     renders count down to it: the displayed timer is `openAt − 1 − ticksCompleted`, so the last state before
 *     open is the timer-0 render. It starts at the hit's own display (`ticksCompleted > fired`); the model's 60
 *     is one tick shorter than hit + 59 renders + 1, so the two first timers (58, 57) are not shown — both are
 *     index 0 (`openingBridge[0]` = frame 1) like the timer after them, so no picture is lost;
 *   · CLOSED otherwise — and whenever the run holds no bridge state (`openBridges === null`: noclip, or nothing
 *     speared this visit), whatever the ledger says.
 *
 * It writes nothing and copies what it keeps. `null` when there is no run (the lab, a still): the tile rule then
 * draws `closed`, the build look, as before this slice.
 */
import { TICKS_FROM_PRESS_TO_WALKABLE } from './bridges.js';
import { portalVisitTick } from './seedlingSkinRenderer.js';
import { INVERT_SILHOUETTE } from './seedlingSolidsSkin.js';

/** The pack key the tile pass draws for tile 29 (`seedlingSkinRenderer.TILE_ART[29]`). */
export const BRIDGE_TILE_KEY = 'seedling:tile/bridge';
/** The bridge's OBJECT solid tag (`levelWorld.js`, tile 29's `objectSolids` row, `bridgeId`). */
export const BRIDGE_OBJECT_TAGS = Object.freeze(new Set(['tile:Bridge']));

/** `Tile.as:75-79`. */
export const BRIDGE_FRAMES = Object.freeze({
    closed: Object.freeze([0, 1]),
    opening: Object.freeze([1, 2, 3, 4, 5, 6]),
    open: Object.freeze([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]),
});
export const BRIDGE_TIMER_MAX = 60;
/** The canvas spelling of `BlendMode.INVERT` the solids skin uses for a Lock (`seedlingSolidsSkin.js`). */
export const BRIDGE_INVERT = Object.freeze({ blend: 'difference', tint: INVERT_SILHOUETTE });

/** `Tile.as:353` for the timer AFTER that render's `timer--`: the sheet frame (`undefined` → 0 at timer 0). */
export function openingFrame(timer) {
    return BRIDGE_FRAMES.opening[Math.trunc((1 - timer / BRIDGE_TIMER_MAX) * BRIDGE_FRAMES.opening.length)] ?? 0;
}

/**
 * The bridge's look at the run's displayed tick `ticksCompleted`:
 *   `null` (closed — the tile rule's own `closed` anim), `{ anim: 'open' }`, or `{ opening: frame, timer }`.
 * `press` = `{ t, fired }` of this visit's first press that hit it (or null); `open` = the run's gate.
 */
export function bridgeLook({ open, press, ticksCompleted }) {
    if (open) return { anim: 'open' };
    if (!press || !(ticksCompleted > press.fired)) return null;
    const openAt = press.t + TICKS_FROM_PRESS_TO_WALKABLE - 1;
    const timer = Math.min(BRIDGE_TIMER_MAX - 2, Math.max(0, openAt - 1 - ticksCompleted));
    return { opening: openingFrame(timer), timer };
}

/**
 * THE JS PAGE'S ADAPTER: `{ level, look(bridgeId) }` for the current room, or `null` without a run. Reads
 * `run.openBridges`, `run.presses`, `run.transitions` / `run.playerDeaths` (the visit's build tick,
 * `portalVisitTick`) and `run.ticksCompleted`; writes nothing.
 */
export function bridgeSkinView(run) {
    if (!run?.state) return null;
    const gate = run.openBridges ?? null;
    const level = run.level;
    const ticksCompleted = run.ticksCompleted;
    const presses = new Map();
    if (gate !== null) {
        const since = portalVisitTick(run);
        for (const p of run.presses ?? []) {
            if (p.level !== level || p.t < since) continue;
            for (const h of p.hits ?? []) {
                // the FIRST press holds the timer (`levelRun`: `if (!bridges.has(id))`)
                if (h.as3 === 'Tile' && !presses.has(h.id)) presses.set(h.id, { t: p.t, fired: p.fired });
            }
        }
    }
    const open = new Set(gate ?? []);
    return {
        level,
        look: (id) => bridgeLook({ open: open.has(id), press: presses.get(id) ?? null, ticksCompleted }),
    };
}
