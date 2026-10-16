/**
 * seedlingDemo/spinningAxe — ⛓⛓⛓ SEEDLING FIDELITY SPINNINGAXE: `Puzzlements/SpinningAxe.as`'s geometry, moved
 * VERBATIM out of `hazards.js` (where the AXE slice transcribed it) because the SIMULATION now steps the axe:
 * `levelRun.stepSpinningAxesNow` lands `SpinningAxe.hitPlayer` on the player behind
 * `CONTACT_FIDELITY.spinningAxePlayerHit`. A module `levelRun.js` imports is simulation (`seedlingSolverSurface.js`),
 * so the solver family reaches these through the door (`solverView.js`) — `hazards.js` imports them there and
 * re-exports them, so every consumer of `hazards.js` (the danger map, the solver, the axe probes) is unchanged.
 * The `lavaChain.js` pattern (K2PREP). New here: `axeHitPoint`, the point `hitPlayer` hands `Player.hit`.
 */

/**
 * ⛓⛓⛓ SEEDLING FIDELITY AXE — THE SPINNING AXE, AT ONE UPDATE COUNT.
 *
 * `SpinningAxe.update` (`Puzzlements/SpinningAxe.as:49-63`), each frame:
 *
 *     sprSpinningAxe.angle += spinRate;                // its OWN counter
 *     var a = -sprSpinningAxe.angle / 180 * Math.PI;
 *     p = collideLine("Player", x, y, x + 32·cos a, y + 32·sin a)
 *     if (!p) p = collideRect("Player", x - 6, y - 6, 12, 12)
 *     hitPlayer(p, a)                                  // force 5, damage 1
 *
 * ⇒ the phase is NOT `Game.time`: `Image.angle` starts at 0 in the ctor and
 * gains `rate` degrees per `update()` of THIS entity, which runs inside
 * `World.update`, i.e. once per live frame of the visit (`Game.update`'s
 * `blackCover <= 0` gate). The caller supplies `updates`, the count INCLUDING
 * the frame being asked about.
 *
 * ⚠ `collideRect` is INCLUSIVE (`net/flashpunk/Entity.as:263-264`, `>=`/`<=`),
 * so the hub test reaches one pixel further than `rectsOverlap` would — and
 * since the hub's own 8x8 `Solid` sits inside it, ANY contact with the hub is
 * a hit. The line is `collideLinePlayer` below — `World.collideLine` with the
 * sample left a Number, as `Entity.collidePoint` leaves it.
 */
export const SPINNING_AXE = Object.freeze({
    length: 32,
    endRectSide: 12,
    force: 5,
    damage: 1,
    src: 'Puzzlements/SpinningAxe.as:21-24,49-63',
});

/**
 * `World.collideLine("Player", …)` (`net/flashpunk/World.as:411-500`, precision
 * 1, no `p`) against ONE box: the endpoints are cast to `int` at the signature,
 * the loop is `while (x < toX)` (the end point is never sampled) and the minor
 * axis advances by a fraction.
 *
 * ⛔⛔ THE SAMPLE IS **NOT** TRUNCATED. `World.collidePoint(type, pX:Number,
 * pY:Number)` hands the fractional sample to `Entity.collidePoint`, which is
 * `pX >= x - originX && … && pX < x - originX + width` on NUMBERS
 * (`Entity.as:292-295`). `crusher.collideLineSolid` truncates the sample first,
 * which is the same answer against integer edges and a DIFFERENT one against a
 * player standing at a fractional x: MEASURED on the game, the AXE report's D1
 * door arm (player at x 63.3, box edges 61.3/65.3) is hit on frame 57; the
 * truncating test says 58, this one says 57. ⛓ That shared function is the
 * crusher's and the spinner hammer's too; it samples untruncated as well since
 * fidelity LINEFLIP (`contactFidelity.CONTACT_FIDELITY.collideLinePointsExact`
 * ON), so the two now agree.
 */
export function collideLinePlayer(box, fromX, fromY, toX, toY) {
    const fx = Math.trunc(fromX);
    const fy = Math.trunc(fromY);
    const tx = Math.trunc(toX);
    const ty = Math.trunc(toY);
    const at = (px, py) => px >= box.x && py >= box.y && px < box.right && py < box.bottom;
    // `FP.distance(...) < precision`: the short sweep, `collidePoint(type, fromX, toY)`.
    if (Math.hypot(tx - fx, ty - fy) < 1) return at(fx, ty);
    const xDelta = Math.abs(tx - fx);
    const yDelta = Math.abs(ty - fy);
    let xSign = tx > fx ? 1 : -1;
    let ySign = ty > fy ? 1 : -1;
    let x = fx;
    let y = fy;
    if (xDelta > yDelta) {
        ySign *= yDelta / xDelta;
        if (xSign > 0) { while (x < tx) { if (at(x, y)) return true; x += xSign; y += ySign; } }
        else { while (x > tx) { if (at(x, y)) return true; x += xSign; y += ySign; } }
    } else {
        xSign *= xDelta / yDelta;
        if (ySign > 0) { while (y < ty) { if (at(x, y)) return true; x += xSign; y += ySign; } }
        else { while (y > ty) { if (at(x, y)) return true; x += xSign; y += ySign; } }
    }
    return false;
}

/** The blade at `updates` updates since the ctor (`SpinningAxe.as:53-56`). */
export function axeLine(axe, updates) {
    const deg = axe.rate * updates;
    const a = -deg / 180 * Math.PI;
    return {
        deg, angle: a, x0: axe.cx, y0: axe.cy,
        x1: axe.cx + SPINNING_AXE.length * Math.cos(a),
        y1: axe.cy + SPINNING_AXE.length * Math.sin(a),
    };
}

/**
 * Does the axe hit this player box on its `updates`-th update? `{arm, line}`
 * or null. ⛔ The box is the one the axe TESTS — the player's PRE-move box,
 * because `loadlevel` adds the axe (`Game.as:2358`) after the Player
 * (`:2250`) and `World.addUpdate` prepends, so the axe updates first.
 */
export function axeHitsPlayer(axe, updates, box) {
    if (!Number.isInteger(updates)) {
        throw new Error(`axeHitsPlayer: ${updates} is not an update count — the angle `
            + 'is the axe\'s own counter and a caller without one must ask the disc.');
    }
    const line = axeLine(axe, updates);
    if (collideLinePlayer(box, line.x0, line.y0, line.x1, line.y1)) return { arm: 'blade', line };
    const h = SPINNING_AXE.endRectSide / 2;
    if (box.right >= axe.cx - h && box.bottom >= axe.cy - h
        && box.x <= axe.cx + h && box.y <= axe.cy + h) return { arm: 'hub', line };
    return null;
}

/**
 * Can the axe reach this box at ANY angle? The nearest point of the box within
 * the blade's length (+1 for the line's integer endpoints) or touching the hub
 * rect. ⚠ A conservative "yes" — it is the DOORSTEP test (where a walk may
 * stand and wait out a phase), not a danger verdict.
 */
export function axeCanReach(axe, box) {
    const nx = Math.max(box.x, Math.min(axe.cx, box.right));
    const ny = Math.max(box.y, Math.min(axe.cy, box.bottom));
    return Math.hypot(nx - axe.cx, ny - axe.cy) <= SPINNING_AXE.length + 1;
}

/**
 * ⛓ fidelity SPINNINGAXE — the point `SpinningAxe.hitPlayer(p, a)` hands `Player.hit` (`SpinningAxe.as:65-76`),
 * verbatim:
 *
 *     var m:Number = Math.tan(a + 2 * spinRate / 180 * Math.PI);
 *     var a:Number = p.x;  var b:Number = p.y;          // ⚠ `a` is REDECLARED: m reads the blade angle first
 *     var c:Number = y - m * x;
 *     var _x:Number = (m * (b - c) + a) / (m * m + 1);
 *     p.hit(null, force, new Point(_x, b + (a - _x) / m), damage);
 *
 * i.e. the foot of the perpendicular from the player's point onto the line through the hub at the blade's angle
 * two updates EARLIER (`a` is `−angle`, so `a + 2·spinRate` is `−(angle − 2·spinRate)`: update `updates − 2`). `updates` is the count `axeLine` takes (the angle the hit is tested at); `(px, py)` is the
 * player's entity point (`p.x`, `p.y`), which the axe reads BEFORE the player moves. ⚠ `m === 0` makes the y a
 * 0/0 or ±∞ (a blade two updates from horizontal) — the game's knockback is then `NaN`; returned as is, and the
 * caller refuses a non-finite point by name rather than guessing what `atan2(NaN)` throws the player to.
 */
export function axeHitPoint(axe, updates, px, py) {
    const a = axeLine(axe, updates).angle;
    const m = Math.tan(a + 2 * axe.rate / 180 * Math.PI);
    const c = axe.cy - m * axe.cx;
    const x = (m * (py - c) + px) / (m * m + 1);
    return { x, y: py + (px - x) / m, m };
}
