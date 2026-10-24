/**
 * seedlingDemo/igneousLava — ⛓⛓⛓ fidelity IGNEOUS: THE IGNEOUS-TO-LAVA TILE (type 31), as `Tile.render` runs it.
 *
 * The game (vendor/seedling `src/` @ccdf189776):
 *
 *     Tile.as:105        super(_x + w/2, _y + h/2)            — a Tile's (x, y) is its CENTRE; hitbox 16x16
 *     Tile.as:80-84      igneousFrame 0; igneousCounterMax 8; igneousCounter 8; igneousBreakApart false
 *     Tile.as:126-130    render(): `if (!onScreen(int(t == 32) * 16)) return;`  — margin 0 for type 31
 *     Tile.as:390-433    case 31, INSIDE render():
 *                          not breaking: the nearest Player within sqrt(w² + h²)/2 of (x, y)
 *                                        → counter > 0 ? counter-- : (counter = 8, breakApart = true)
 *                          breaking:     counter > 0 ? counter-- : (counter = 8, frame++,
 *                                        frame >= sprIgneousLava.frameCount → t = 17)
 *     Game.as:278-279    sprIgneousLava = Spritemap(IgneousLava.png, 16, 16)   — the PNG is 48x16: THREE frames
 *     Player.as:677-737  getState() reads `tile.t`; the setter applies `inLava` only when the state CHANGES,
 *                        which 31 → 17 under a standing player is
 *
 * So a fresh tile turns on its 36th IN-RANGE rendered frame at the earliest (9 to break, then 3 × 9), the counter is
 * NOT reset when the player walks away before the break, and once breaking the clock runs whether or not anyone is
 * near. The tile stays lava for the life of the `Game`; a new one rebuilds it from the `.oel`.
 *
 * ⛓ WITNESSED on the game (p4g, headless, `probe-seedling-encounter-ticks.mjs --tape-file`, D1 of the slice report):
 * the sweep leg 649 tape (first in-range render t3 → lava written at the t38 render → the lava death at t39, respawn
 * t69); K=8 vs K=9 in-range frames (only the ninth breaks); a 4-frame visit carried into the return (death t79, where
 * a reset counter would give t83); a fresh stand (death t81); and a death restart rebuilding the tile (death t141 =
 * first in-range t105 + 36).
 *
 * Pure: no run, no world. `levelRun.renderIgneousNow` owns the stepping and the lava write; the solver's pricing reads
 * `igneousRendersToLava`.
 */

export const IGNEOUS = Object.freeze({
    /** `Tile.t` of an Igneous-to-Lava tile, and what it becomes (`t = 17; //Lava`). */
    type: 31,
    becomes: 17,
    /** `igneousCounterMax` (`Tile.as:83`). */
    counterMax: 8,
    /** `Game.sprIgneousLava.frameCount`: IgneousLava.png is 48x16 in 16x16 frames. */
    frameCount: 3,
    /** `Math.sqrt(width * width + height * height) / 2` over the 16x16 hitbox, from the tile's CENTRE. */
    radius: Math.sqrt(16 * 16 + 16 * 16) / 2,
});

/** A tile as `new Tile(…, 31)` builds it. */
export const IGNEOUS_FRESH = Object.freeze({ counter: IGNEOUS.counterMax, breaking: false, frame: 0, lava: false });

/**
 * `FP.distance(p.x, p.y, x, y) <= Math.sqrt(width * width + height * height) / 2` — the player's ORIGIN against the
 * tile's centre (`tile.x`, `tile.y` in `levelWorld`'s tile rows are the centre, as the game's are).
 */
export function igneousInRange(tile, px, py) {
    const dx = px - tile.x;
    const dy = py - tile.y;
    return Math.sqrt(dx * dx + dy * dy) <= IGNEOUS.radius;
}

/**
 * One ON-SCREEN `render()` of one type-31 tile. The caller has already applied `onScreen` (an off-screen render
 * returns before the switch) and skips a tile that has turned.
 *
 * @returns {{state: object, event: null | 'break' | 'frame' | 'lava'}}
 */
export function stepIgneousRender(s, inRange) {
    if (s.lava) return { state: s, event: null };
    if (!s.breaking) {
        if (!inRange) return { state: s, event: null };
        if (s.counter > 0) return { state: { ...s, counter: s.counter - 1 }, event: null };
        return { state: { ...s, counter: IGNEOUS.counterMax, breaking: true }, event: 'break' };
    }
    if (s.counter > 0) return { state: { ...s, counter: s.counter - 1 }, event: null };
    const frame = s.frame + 1;
    if (frame >= IGNEOUS.frameCount) {
        return { state: { counter: IGNEOUS.counterMax, breaking: true, frame, lava: true }, event: 'lava' };
    }
    return { state: { ...s, counter: IGNEOUS.counterMax, frame }, event: 'frame' };
}

/**
 * How many more on-screen renders until the tile is lava, if every one of them is ALSO in range (a breaking tile's
 * clock needs no player, so for it this is exact; for an unbroken one it is the soonest it can turn). 0 = lava now.
 * The render that writes 17 is the last one counted; the player's next update is the first to read it.
 */
export function igneousRendersToLava(s) {
    if (s.lava) return 0;
    const perFrame = IGNEOUS.counterMax + 1;
    const toFrame = s.counter + 1;
    if (s.breaking) return toFrame + (IGNEOUS.frameCount - 1 - s.frame) * perFrame;
    return toFrame + IGNEOUS.frameCount * perFrame;
}
