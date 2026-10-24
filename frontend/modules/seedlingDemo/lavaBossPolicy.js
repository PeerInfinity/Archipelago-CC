/**
 * seedlingDemo/lavaBossPolicy — THE KING OF FIRE'S FIGHT, AS A POLICY THE MODEL CAN PLAY (`lavaBoss.js`).
 *
 * ⛓⛓⛓ seedling-fidelity-bosskills D2. The solver's `lavaboss` verb (`solverBot.execLavaBoss`) drives this one tick at
 * a time against the live run, reading only what the run publishes (`run.state`, `run.lavaBossFight`,
 * `run.slashInfo`): the fight is DETERMINISTIC (D1: a 99-update cycle, no gameplay draw), so the run's own state is
 * the whole of what the policy needs to know, and its answer is checked by playing it, never assumed.
 *
 * ── THE KILL, IN THE GAME'S OWN MECHANISM (`LavaBoss.hit`, `:143-174`) ─────────────────────────────────────────
 *   1. stand on the body's column below it, facing up, and swing as the sweep's middle ball (`v` (0, 1), from
 *      `(x, y + 32)`) comes into the slash rect: the swing reverses it at twice the speed (`LavaBall.hit`) and it opens
 *      the 120-update window on the body (`hitsTimer`, no count) — during which the body plays "hit" and attacks
 *      nothing;
 *   2. inside the window, walk up under the body and swing up: the first non-ball hit COUNTS and re-arms 120 more
 *      quiet updates ("hitplayer");
 *   3. three counts is `startDeath`: the report `{82,0}`, then "die" and the fade.
 * The runners every smash spawns are struck when they come within reach (two hits each; the suit's retaliation is a
 * third source of damage on them).
 *
 * ⚖ The parameters are what a caller searches over (`LAVA_BOSS_POLICY_VARIANTS`): each variant is played on a fork of
 * the run and the first that kills without a death is the one committed (`execLavaBoss`).
 */

import { distanceRectPoint, slashRect } from './solverView.js';

/** The swing's reach (`slashingSprite.width * scaleX`, 16) and the rect's depth along it. */
const REACH = 16;
/** A LavaRunner's box half-size (`setHitbox(12, 12, 6, 6)`). */
const RUNNER_HALF = 6;

/** Would a swing in direction `dir` from `p` reach a runner at `r` (the rect, then the reach gate)? */
function swingReaches(p, dir, r) {
    const rc = slashRect(p.x, p.y, dir);
    const box = { x: r.x - RUNNER_HALF, y: r.y - RUNNER_HALF, w: 12, h: 12,
        right: r.x + RUNNER_HALF, bottom: r.y + RUNNER_HALF };
    if (!(box.x < rc.right && box.right > rc.x && box.y < rc.bottom && box.bottom > rc.y)) return false;
    return distanceRectPoint(p.x, p.y, box) <= REACH;
}

/** The parameters a caller may vary; the first is the default. */
export const LAVA_BOSS_POLICY_VARIANTS = Object.freeze([
    Object.freeze({ standY: 168, strike: 20 }),
    Object.freeze({ standY: 176, strike: 20 }),
    Object.freeze({ standY: 160, strike: 20 }),
    Object.freeze({ standY: 168, strike: 26 }),
    Object.freeze({ standY: 184, strike: 24 }),
    Object.freeze({ standY: 152, strike: 24 }),
]);

const DIR_KEYS = Object.freeze({ 0: 'right', 1: 'up', 2: 'left', 3: 'down' });

/** The direction (0 right, 1 up, 2 left, 3 down) from the player to a point. */
function facing(px, py, tx, ty) {
    const dx = tx - px;
    const dy = ty - py;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 2;
    return dy >= 0 ? 3 : 1;
}

/** The keys that walk toward a point, with a dead band. */
function walkKeys(px, py, tx, ty, band = 1) {
    const out = [];
    if (tx - px > band) out.push('right');
    else if (px - tx > band) out.push('left');
    if (ty - py > band) out.push('down');
    else if (py - ty > band) out.push('up');
    return out;
}

/**
 * A fresh memory for one fight. `pressCooldown` keeps a swing from re-pressing inside its own window (a second press
 * restarts the window, `swordWindowReplace`), which would waste the tests the first one owes.
 */
export function createLavaBossPolicy(params = LAVA_BOSS_POLICY_VARIANTS[0]) {
    return { params: { ...params }, lastPress: -1000, tick: 0, phase: 'approach', log: [] };
}

/**
 * ONE tick's keys. `view` is `run.lavaBossFight` (null = no fight), `p` is `run.state`, `slashing` the run's
 * `slashInfo.state.slashing`. Returns a Set of key names (the tape's).
 */
export function lavaBossPolicyStep(mem, { view, p, slashing }) {
    mem.tick += 1;
    const keys = new Set();
    if (view === null || view.boss.removed || view.boss.destroy) return keys;
    const b = view.boss;
    const colX = b.x;
    const bodyBottom = b.y + 29;               // `setHitbox(64, 58, 32, 29)`
    const canPress = !slashing && mem.tick - mem.lastPress > 7;
    const press = (dir, why) => {
        keys.add(DIR_KEYS[dir]);
        keys.add('primary');
        mem.lastPress = mem.tick;
        mem.log.push({ tick: mem.tick, why, dir });
    };
    // (1) a runner a swing reaches now (its five tests run on the next five updates): strike it first.
    const runners = (view.runners ?? []).filter((r) => !r.removed && !r.dying
        && Math.hypot(r.x - p.x, r.y - p.y) <= mem.params.strike);
    if (runners.length > 0 && canPress) {
        const order = [facing(p.x, p.y, runners[0].x, runners[0].y), 0, 1, 2, 3];
        for (const dir of order) {
            if (runners.some((r) => swingReaches(p, dir, r))) {
                press(dir, `runner ${runners.map((r) => r.id).join('+')}`);
                return keys;
            }
        }
    }
    const window = b.hitsTimer > 0 && b.lastHitType === 'LavaBall' && b.hits < 3;
    if (window) {
        // (3) the window: up under the body, swing up once in reach.
        mem.phase = 'strike';
        const ty = bodyBottom + 6;
        if (Math.abs(p.x - colX) <= 6 && p.y - bodyBottom <= REACH - 1) {
            if (canPress) press(1, 'boss');
            else keys.add('up');
            return keys;
        }
        for (const k of walkKeys(p.x, p.y, colX, ty)) keys.add(k);
        return keys;
    }
    // (2) the middle ball, coming down the column: swing as it enters the rect.
    const mid = (view.balls ?? []).find((s) => !s.beenHit && s.vx === 0 && s.vy > 0 && Math.abs(s.x - p.x) < 10);
    if (mid) {
        const gap = p.y - mid.y;           // the ball's centre above the player
        if (gap <= 21 && gap > 8 && canPress) {
            press(1, `ball ${mid.id}`);
            return keys;
        }
    }
    // (4) otherwise: hold the stance below the body, facing up.
    mem.phase = 'stance';
    const want = walkKeys(p.x, p.y, colX, mem.params.standY);
    for (const k of want) keys.add(k);
    if (want.length === 0 && p.direction !== 1 && canPress === true) keys.add('up');
    return keys;
}
