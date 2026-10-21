/**
 * seedlingDemo/tentacleBeastPolicy — THE TENTACLED BEAST'S FIGHT, AS A POLICY THE MODEL CAN PLAY (`tentacleBeast.js`).
 *
 * ⛓⛓⛓ seedling-fidelity-bosskills D3. The solver's `tentaclebeast` verb (`solverBot.execTentacleBeast`) drives this
 * one tick at a time against the live run, reading only what the run publishes (`run.state`,
 * `run.entities('tentacleBeastFight')`, `run.progress('slashInfo')`). The fight's placements are DRAWS, but the run
 * steps the draw stream itself (`TentacleDrawStream`, under its premises), so the run's own state is the whole of what
 * the policy needs, and its answer is checked by playing it, never assumed.
 *
 * ── THE KILL, IN THE GAME'S OWN MECHANISM (`TentacleBeast.as`, `Tentacle.as`) ──────────────────────────────────
 *   · a tentacle is hittable only while it SITS (`canHit = currentAnim == "sit"`, 37 updates of its 86); one sword
 *     hit kills it (`hitsMax` 1) and its cut fades for 100 updates before it leaves (`alpha -= 0.01`), and only then
 *     does the beast's `maxTentacles` fall;
 *   · eight are gone → "dying", the report `{57,0}`, and the mouth (`createMouthEntrance`);
 *   · the danger is the swipe: on each update of "hitting" a 66x8 rect on the tentacle's facing side
 *     (`hitRect = Rectangle(66 * int(!right), 6, 66, 8)`) hits the player — so the policy never stands in the band of
 *     a tentacle that is about to swipe, and strikes from a spot outside every such band;
 *   · the whirlpools pull the player toward their centre while they live; the policy keeps clear of them.
 *
 * ⚖ The parameters are what a caller searches over (`TENTACLE_BEAST_POLICY_VARIANTS`): each variant is played on a fork
 * of the run and the first that kills without a death is the one committed (`execTentacleBeast`).
 */

import { distanceRectPoint, playerBoxAt, slashRect, tentacleRect, tentacleSwipeRect } from './solverView.js';

/** The swing's reach (`slashingSprite.width * scaleX`, 16). */
const REACH = 16;

/** The parameters a caller may vary; the first is the default. */
export const TENTACLE_BEAST_POLICY_VARIANTS = Object.freeze([
    Object.freeze({ gap: 10, margin: 3, whirl: 26, warn: 'hit' }),
    Object.freeze({ gap: 12, margin: 4, whirl: 30, warn: 'hit' }),
    Object.freeze({ gap: 8, margin: 2, whirl: 24, warn: 'hit' }),
    Object.freeze({ gap: 10, margin: 5, whirl: 34, warn: 'sit' }),
    Object.freeze({ gap: 14, margin: 3, whirl: 26, warn: 'sit' }),
]);

const DIR_KEYS = Object.freeze({ 0: 'right', 1: 'up', 2: 'left', 3: 'down' });

/** The keys that walk toward a point, with a dead band. */
function walkKeys(px, py, tx, ty, band = 1) {
    const out = [];
    if (tx - px > band) out.push('right');
    else if (px - tx > band) out.push('left');
    if (ty - py > band) out.push('down');
    else if (py - ty > band) out.push('up');
    return out;
}

const overlaps = (a, b) => a.right >= b.x && a.bottom >= b.y && a.x <= b.right && a.y <= b.bottom;
const grow = (r, m) => ({ x: r.x - m, y: r.y - m, right: r.right + m, bottom: r.bottom + m });

/** A tentacle whose swipe is near enough to keep out of: "hit"/"hitting" always, "sit" too under `warn: 'sit'`. */
function threatens(t, warn) {
    if (t.destroy) return false;
    if (t.anim === 'hit' || t.anim === 'hitting') return true;
    return warn === 'sit' && t.anim === 'sit';
}

/** Would the player standing at (x, y) be inside any threatening swipe band (grown by `margin`)? */
function inDanger(view, x, y, params) {
    const box = playerBoxAt(x, y);
    return view.tentacles.some((t) => threatens(t, params.warn) && overlaps(box, grow(tentacleSwipeRect(t), params.margin)));
}

/** Is (x, y) inside a whirlpool's keep-out (any phase: a growing one comes alive where it stands)? */
function nearWhirl(view, x, y, params) {
    return view.whirlpools.some((w) => Math.hypot(w.x - x, w.y - y) <= params.whirl);
}

/** The swing a press in `dir` from (x, y) would land on tentacle `t` (rect overlap, then the reach). */
function swingLands(x, y, dir, t) {
    const box = tentacleRect(t);
    if (!overlaps(slashRect(x, y, dir), box)) return false;
    return distanceRectPoint(x, y, box) <= REACH;
}

/**
 * A fresh memory for one fight. `lastPress` keeps a swing from re-pressing inside its own window (a second press
 * restarts the window, `swordWindowReplace`).
 */
export function createTentacleBeastPolicy(params = TENTACLE_BEAST_POLICY_VARIANTS[0]) {
    return { params: { ...params }, lastPress: -1000, tick: 0, target: null, log: [] };
}

/**
 * ONE tick's keys. `view` is `run.entities('tentacleBeastFight')` (null = no fight), `p` is `run.state`, `slashing`
 * the run's `slashInfo.state.slashing`. Returns a Set of key names (the tape's).
 */
export function tentacleBeastPolicyStep(mem, { view, p, slashing }) {
    mem.tick += 1;
    const keys = new Set();
    if (view === null || view.beast.dead) return keys;
    const P = mem.params;
    // (0) asleep: swim up under it until it wakes (`FP.distance(...) <= distActivate`, 48).
    if (!view.beast.activated) {
        for (const k of walkKeys(p.x, p.y, view.beast.x, view.beast.y + 44)) keys.add(k);
        return keys;
    }
    const canPress = !slashing && mem.tick - mem.lastPress > 7;
    // (1) a sitting tentacle a swing lands on from here, now: strike it.
    const live = view.tentacles.filter((t) => !t.destroy && t.anim === 'sit' && t.hitsTimer <= 0);
    if (canPress) {
        for (const t of live) {
            for (const dir of [0, 1, 2, 3]) {
                if (swingLands(p.x, p.y, dir, t)) {
                    keys.add(DIR_KEYS[dir]);
                    keys.add('primary');
                    mem.lastPress = mem.tick;
                    mem.log.push({ tick: mem.tick, why: `strike ${t.id}`, dir });
                    return keys;
                }
            }
        }
    }
    // (2) inside a swipe band (or a whirlpool's keep-out): step out, up or down, whichever is clear soonest.
    if (inDanger(view, p.x, p.y, P) || nearWhirl(view, p.x, p.y, P)) {
        let best = null;
        for (const [dx, dy, k] of [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']]) {
            for (let d = 1; d <= 40; d += 1) {
                const x = p.x + dx * d;
                const y = p.y + dy * d;
                if (y < 98 || y > 200 || x < 12 || x > 196) break;
                if (!inDanger(view, x, y, P) && !nearWhirl(view, x, y, P)) {
                    if (best === null || d < best.d) best = { d, k };
                    break;
                }
            }
        }
        if (best) keys.add(best.k);
        return keys;
    }
    // (3) the nearest sitting tentacle with a safe strike spot: walk to the spot.
    let goal = null;
    for (const t of live) {
        const spots = [
            { x: t.x, y: t.y + P.gap },                                   // below, swinging up
            { x: t.right ? t.x - P.gap - 4 : t.x + P.gap + 4, y: t.y },    // on its blind side
        ];
        for (const s of spots) {
            if (inDanger(view, s.x, s.y, P) || nearWhirl(view, s.x, s.y, P)) continue;
            const d = Math.hypot(s.x - p.x, s.y - p.y);
            if (goal === null || d < goal.d) goal = { d, s, id: t.id };
        }
    }
    if (goal !== null) {
        mem.target = goal.id;
        for (const k of walkKeys(p.x, p.y, goal.s.x, goal.s.y)) keys.add(k);
        return keys;
    }
    // (4) nothing to strike: hold below the spawn band's middle, out of the bands.
    for (const k of walkKeys(p.x, p.y, 104, 200)) keys.add(k);
    return keys;
}

