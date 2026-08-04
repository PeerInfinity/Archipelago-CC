/**
 * seedlingDemo/encounters — the ENCOUNTER LADDER: a disc is a price, not a
 * wall.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §3.2 **as amended
 * 2026-08-03** — "aggro discs are PRICING objects, not walls. The bot must
 * HANDLE encounters — defeat or avoid as appropriate."
 *
 * ── THE LADDER, CHEAPEST FIRST ────────────────────────────────────────
 *
 *   1. `path-avoid`      the path never enters the disc. Free, and a
 *                        chaser never approached never moves.
 *   2. `wake-and-thread` the path enters, the enemy wakes, and the crossing
 *                        is proven contact-free ANYWAY. Priced in ticks;
 *                        the woken enemy's displacement persists for the
 *                        rest of the visit.
 *   3. `kill`            presses x the 21-tick cadence, plus the stance
 *                        approach. Chosen when it is cheaper than threading
 *                        or when a kill-lock demands it regardless.
 *   4. `hard-avoid`      what simulation cannot pin: the phase-uncertain
 *                        family, and lethal contact (Crusher, damage 1000).
 *                        A route that needs one of these is re-planned.
 *
 * The planner EMITS the chosen verdict into the route artifact — derived,
 * then audited, exactly like the clear list. **The executor's wake rule is
 * the INTEGRITY half only**: it refuses a wake the plan did not declare (the
 * R1 `contacts` shape — a route that silently changed), never a wake the
 * plan resolved.
 *
 * ── ⛓ HOW RUNG 2 IS PROVEN WITHOUT THE CLASS TRANSCRIPTIONS ───────────
 *
 * §3.2 says wake-and-thread is "simulated exactly through the wake", and the
 * per-class chase transcriptions are SLICE 3's. This module does not wait
 * for them, because it does not have to: a contact-freedom proof only needs
 * an OVER-APPROXIMATION of where the enemy can be.
 *
 * `chaseEnvelope` is that. Every chaser on this map moves by at most its own
 * `moveSpeed` per tick — `Mobile.friction()` runs before `moveX/moveY`, and
 * every chase block re-normalizes to `moveSpeed` after moving, so the real
 * step is `moveSpeed - f` — so the set of positions reachable `n` ticks after
 * a wake is contained in a disc of radius `n * moveSpeed` around the spawn.
 * A crossing whose player box never meets that disc is contact-free FOR ANY
 * CHASE POLICY, which is a stronger statement than one exact transcription
 * would make and does not depend on the transcription being right.
 *
 * What it costs: crossings the envelope cannot clear are not "contacts",
 * they are UNDECIDED, and they escalate to rung 3 or to slice 3's exact
 * simulation. The instrument says which, by name, and never the other way
 * round — an envelope that reported "clear" when the exact model would not
 * is the failure this shape makes impossible.
 *
 * ⚠ THE BOUND HOLDS ONLY WHILE NOTHING HAS HIT THE ENEMY. `Enemy.hit`
 * applies knockback, and a knocked enemy's own chase code takes the `pushed`
 * branch, which does NOT re-normalize. So the envelope is sound for an avoid
 * crossing and must never be used to price the ticks after a press lands;
 * `priceCrossing` refuses when asked to.
 *
 * ── AND WHAT THE CAMERA BUYS ──────────────────────────────────────────
 *
 * An off-screen enemy does not run `mobileUpdate`, so it cannot move
 * (`camera.js`'s header). The envelope therefore grows only on ticks where
 * SOME point of it could be on screen — a tightening, applied only when the
 * caller passes a camera track, and skipped conservatively otherwise.
 */

import { ENEMY_CLASSES, KILL_CADENCE_FLOOR, pressesFor, stepBoundFor } from './combat.js';
import { SCREEN_H, SCREEN_W } from './camera.js';
// ⛔ THE PLAYER BOX IS THE PHYSICS MODULE'S, NEVER A SECOND TRANSCRIPTION.
// This module shipped one — `{w: 2, h: 2, ox: 4, oy: 5}` — by reading
// `normalHitbox = new Rectangle(2, 2, 4, 5)` as (w, h, ox, oy) when
// `Rectangle` is (x, y, width, height) and `setHitbox` is called
// `(width, height, x, y)`. The real box is 4x5 with origin (2,2), i.e. two
// pixels wider and five taller than the wrong one, sitting three pixels
// lower. `playerPhysicsV2.playerBoxAt` has had it right since v2 and every
// leg in four rungs rides on it.
import { playerBoxAt } from './playerPhysicsV2.js';
import { hazardVolume, volumeHitsBox } from './hazards.js';

/** `Mobile.DEFAULT_FRICTION` — what damps a chaser that stops chasing. */
export const FRICTION = 0.25;

/** The ladder, cheapest first. A verdict names exactly one of these. */
export const LADDER = Object.freeze([
    'path-avoid', 'wake-and-thread', 'kill', 'hard-avoid',
]);

export class EncounterError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EncounterError';
    }
}

const fail = (message) => { throw new EncounterError(message); };

const boxAt = (o) => playerBoxAt(o.x, o.y);

/**
 * Every point on a path that enters an instance's aggro disc, grouped into
 * CROSSINGS (contiguous runs).
 *
 * ⚠ A crossing is a run, not a tick. Two separate entries into the same
 * disc are two crossings and two verdicts, because the second one starts
 * with the enemy already displaced by the first.
 *
 * @param {object[]} path        `{t, x, y, level}` observations
 * @param {object}   instance    a `combatCensusOf().enemies` row
 */
export function crossingsOf(path, instance) {
    const disc = instance.disc;
    if (!disc) return [];
    const out = [];
    let live = null;
    for (const o of path) {
        if (o.level !== instance.level) {
            if (live) { out.push(live); live = null; }
            continue;
        }
        const d = Math.hypot(o.x - disc.x, o.y - disc.y);
        if (d <= disc.r) {
            if (!live) live = { instance, from: o.t, to: o.t, minDist: d, r: disc.r };
            else { live.to = o.t; live.minDist = Math.min(live.minDist, d); }
        } else if (live) {
            out.push(live);
            live = null;
        }
    }
    if (live) out.push(live);
    return out;
}

/**
 * The envelope of an instance's possible positions after a wake.
 *
 * Returns the radius per tick, from the wake. The growth rule:
 *
 *   - while the envelope's NEAREST point to the player is inside the class's
 *     own `runRange`, the enemy might be chasing: grow by the step bound.
 *   - once it is not, the enemy is out of range and `friction()` damps it,
 *     so the remaining travel is a COAST of at most `bound^2 / (2 * f)`.
 *     Modelled as continuing to grow, but only up to that budget.
 *
 * Both arms over-approximate. That is the point.
 *
 * @param {object} instance
 * @param {object[]} path  the observations from the wake tick onward
 * @param {object=} opts.cameraAt  `(t) => {x, y}` — the tightening
 */
/**
 * ⛔⛔ R5 SLICE 8, STEP 0: THE SWEEP'S ONE REAL FINDING IN THE ENUMERATED
 * TEN, and it is the rope's shape wearing a disguise.
 *
 * `chaseEnvelope`'s body used to be `row.hitbox ?? {w:0,h:0,ox:0,oy:0}`.
 * That keeps the arithmetic FINITE — no rect it builds is ever malformed,
 * so the `assertRect` family could never have caught it — by giving a
 * body-less row a ZERO-SIZE BODY. The clearance it then measures is
 * optimistic by half the real body on each axis, and the answer is a
 * plausible number rather than a silent `false`, which is strictly harder
 * to notice than the rope was.
 *
 * ⛓ IT IS CURRENTLY UNREACHABLE, AND SILENTLY SO. All six hitbox-less rows
 * carry `boss:`, and `encounterVerdict` returns hard-avoid at rung 4 before
 * it ever calls the envelope. That is the same "two independent reasons,
 * either one alone reads as a clean audit" pattern slice 7 named on the
 * rope, which is why the default becomes a throw rather than a comment.
 *
 * ⚠ SEPARATE FROM ITS CALLER so it can be tested at all: every shipped row
 * satisfies it by construction, so a test that went through `chaseEnvelope`
 * could only ever exercise the passing arm. A guard whose failing arm no
 * test can reach is the thing this whole step is about.
 *
 * @param {string} tag  the census tag, for the message
 * @param {object} row  its `ENEMY_CLASSES` entry
 */
export function assertEnvelopeBody(tag, row) {
    if (row?.hitbox) return row.hitbox;
    if (row?.boss || row?.envelopeProof === false) return null;
    return fail(`chaseEnvelope: "${tag}" has no transcribed hitbox and is neither a `
        + '`boss` nor `envelopeProof: false`. A zero-size body makes every clearance '
        + 'in this envelope optimistic by half the real body on each axis, and reports '
        + 'a plausible number rather than failing — transcribe the hitbox, or declare '
        + 'which of the two exemptions applies.');
}

export function chaseEnvelope(instance, path, { cameraAt = null } = {}) {
    const bound = stepBoundFor(instance.tag);
    if (bound === null) {
        fail(`chaseEnvelope: "${instance.tag}" has no step bound. A boss (or an unpriced `
            + 'tag) is an ENCOUNTER SCRIPT, not something an envelope may declare '
            + 'contact-free — 0 would read as "static" and prove the arena safe.');
    }
    const row = ENEMY_CLASSES[instance.tag];
    const runRange = typeof row.aggro?.range === 'number' ? row.aggro.range : 0;
    const coastBudget = (bound * bound) / (2 * FRICTION);
    // ⛔ The body-less default is a NAMED EXEMPTION rather than a `??`.
    // See `assertEnvelopeBody` for what the `??` was hiding, and why the
    // guard lives outside this function.
    const box = assertEnvelopeBody(instance.tag, row) ?? { w: 0, h: 0, ox: 0, oy: 0 };
    // ⛔ THE PAD IS NOT DECORATION. A turret's body is 16x16 and its THREAT
    // is a 64 px spit; a bobsoldier's is 8x8 and its sword line is 16 px
    // past it. An envelope that measured the body would declare a shooting
    // gallery contact-free, which is the exact failure mode this whole shape
    // exists to make impossible. `envelopeProof: false` says the pad is so
    // much larger than the body that no clearance proof is worth making.
    const pad = row.threatPad ?? 0;
    const rows = [];
    let r = 0;
    let coasted = 0;
    let stoppedAt = null;
    for (let i = 0; i < path.length; i += 1) {
        const o = path[i];
        // ⚠⚠ A LEVEL CHANGE ENDS THE ENVELOPE. `restartLevel`/a teleporter is
        // `FP.world = new Game(...)`, which destroys every enemy in the old
        // world — so an envelope that kept growing across the boundary would
        // report a closest approach hundreds of ticks later, in a room this
        // instance does not exist in. It did exactly that before this line.
        if (instance.level !== undefined && o.level !== instance.level) {
            stoppedAt = o.t;
            break;
        }
        // The reachable set of the enemy's BOX after n ticks is the box grown
        // by `r` on every side (an over-approximation of the Minkowski sum
        // with a disc), then by the threat pad. Separation is the AABB gap,
        // which is what a contact test actually asks — a disc-vs-disc test
        // through the half-diagonal is loose by up to 40% on a 16x16 body
        // and reported real contacts where there were none.
        const grow = r + pad;
        const eBox = {
            x: instance.cx - box.ox - grow,
            y: instance.cy - box.oy - grow,
            right: instance.cx - box.ox + box.w + grow,
            bottom: instance.cy - box.oy + box.h + grow,
        };
        const p = boxAt(o);
        const gapX = Math.max(p.x - eBox.right, eBox.x - p.right);
        const gapY = Math.max(p.y - eBox.bottom, eBox.y - p.bottom);
        const clearance = Math.max(gapX, gapY);
        const d = Math.hypot(o.x - instance.cx, o.y - instance.cy);
        rows.push({ t: o.t, r, dist: d, clearance });
        // ⚠ The chase gate is on the NEAREST point of the envelope, not on
        // the spawn: an enemy that has already moved toward the player is
        // closer than the spawn is, so asking about the spawn would let a
        // route leave the leash on paper while the real enemy is still
        // chasing.
        const nearest = Math.max(d - r, 0);
        let frozen = false;
        if (cameraAt) {
            const cam = cameraAt(o.t);
            // Conservative: frozen only if the WHOLE envelope is off screen.
            if (cam) {
                frozen = eBox.right < cam.x || eBox.bottom < cam.y
                    || eBox.x > cam.x + SCREEN_W || eBox.y > cam.y + SCREEN_H;
            }
        }
        if (frozen) continue;
        if (nearest <= runRange) {
            r += bound;
        } else if (coasted < coastBudget) {
            const step = Math.min(bound, coastBudget - coasted);
            r += step;
            coasted += step;
        }
    }
    return { bound, runRange, pad, coastBudget, stoppedAt, rows };
}

/**
 * Price ONE crossing on the ladder, and say which rung and why.
 *
 * @param {object}   crossing   from `crossingsOf`
 * @param {object[]} path       the whole observation stream
 * @param {object=}  opts.cameraAt
 * @param {boolean=} opts.hasDarkSword  halves the kill bill
 * @param {boolean=} opts.mustClear     a kill lock demands this instance dead
 * @param {boolean=} opts.alreadyHit    ⚠ refuses: the bound does not hold
 */
export function priceCrossing(crossing, path, {
    cameraAt = null, hasDarkSword = false, mustClear = false, alreadyHit = false,
} = {}) {
    const inst = crossing.instance;
    const presses = pressesFor(inst.row, { hasDarkSword });
    const killCost = presses === null ? null : presses * KILL_CADENCE_FLOOR;
    const base = {
        level: inst.level,
        tag: inst.tag,
        x: inst.x,
        y: inst.y,
        from: crossing.from,
        to: crossing.to,
        minDist: Number(crossing.minDist.toFixed(2)),
        discR: crossing.r,
        counted: inst.counted,
    };
    if (alreadyHit) {
        fail(`priceCrossing: ${inst.tag}@${inst.x},${inst.y} has already been hit. `
            + '`Enemy.hit` applies knockback and a knocked enemy\'s chase takes the '
            + '`pushed` branch, which does not re-normalize to moveSpeed — so the step '
            + 'bound the envelope rests on no longer holds. Price the post-press ticks '
            + 'with the exact transcription, not with an envelope.');
    }
    // ── rung 3, taken FIRST when it is not optional ───────────────────
    if (mustClear) {
        return {
            ...base,
            rung: 'kill',
            cost: killCost,
            presses,
            why: 'a kill lock in this level waits on `totalEnemies() == 0`, so this '
                + 'instance is on the bill whatever the crossing costs',
        };
    }
    // ── rung 4, for what simulation cannot pin ────────────────────────
    if (inst.row.boss) {
        return {
            ...base,
            rung: 'hard-avoid',
            cost: null,
            why: 'a boss is an ENCOUNTER SCRIPT (§3.3) — hand-authored leg sequences '
                + 'over the same verbs, not an A* goal and not an envelope',
        };
    }
    // ⛔ Some classes have no clearance proof to make: the threat is not
    // the body. A turret's spit covers its whole 64 px range, a lavatrap's
    // tongue latches at 32 and then writes the player's position, a
    // wallflyer's trigger ray is the screen. For those the ladder skips
    // rung 2 by construction, because "the body did not touch you" is not
    // a statement about whether you were hit.
    if (inst.row.envelopeProof === false) {
        return {
            ...base,
            rung: presses === null ? 'hard-avoid' : 'kill',
            cost: killCost,
            presses,
            basis: 'no-body-proof',
            why: `${inst.row.threat} ⇒ a clearance proof on the body would prove nothing, `
                + `so the crossing is priced at rung ${presses === null ? '4' : '3'}.`,
        };
    }
    // ── rung 2, proven by the envelope ────────────────────────────────
    const tail = path.filter((o) => o.t >= crossing.from);
    const env = chaseEnvelope(inst, tail, { cameraAt });
    let worst = Infinity;
    let worstT = null;
    for (const r of env.rows) {
        if (r.clearance < worst) { worst = r.clearance; worstT = r.t; }
    }
    if (worst > 0) {
        return {
            ...base,
            rung: 'wake-and-thread',
            cost: crossing.to - crossing.from + 1,
            clearance: Number(worst.toFixed(2)),
            clearanceAt: worstT,
            basis: 'envelope',
            why: `the envelope (${env.bound} px/tick from the wake, leash ${env.runRange}, `
                + `pad ${env.pad}) never reaches the player: closest approach `
                + `${worst.toFixed(2)} px at t${worstT}`
                + `${env.stoppedAt === null ? '' : `, and the visit ends at t${env.stoppedAt}`}`
                + '. Contact-free for ANY chase policy, not just the transcribed one.',
        };
    }
    // ⛓ A STATIC INSTANCE HAS NO OVER-APPROXIMATION IN IT. When the step
    // bound and the pad are both zero the "envelope" is the class's own
    // hitbox, unmoved — so a negative clearance is not undecided, it is a
    // PROVEN overlap with a body that was never going to be anywhere else.
    // That distinction is the whole difference between "the instrument
    // cannot tell yet" and "this route walks through a darktrap", and it is
    // what makes the re-route floor a number rather than an upper bound.
    const isStatic = env.bound === 0 && env.pad === 0;
    if (isStatic) {
        return {
            ...base,
            rung: presses === null ? 'hard-avoid' : 'kill',
            cost: killCost,
            presses,
            clearance: Number(worst.toFixed(2)),
            clearanceAt: worstT,
            basis: 'exact-static',
            proven: true,
            why: `⛔ PROVEN CONTACT, not an approximation: this class never moves and has `
                + `no reach past its own hitbox, and the path is ${(-worst).toFixed(2)} px `
                + `INSIDE it at t${worstT}. `
                + (presses === null
                    ? 'It cannot be killed, so the crossing must be re-routed.'
                    : 'Kill it or re-route.'),
        };
    }
    // ── undecided: the envelope could not clear it ────────────────────
    return {
        ...base,
        rung: presses === null ? 'hard-avoid' : 'kill',
        cost: killCost,
        presses,
        clearance: Number(worst.toFixed(2)),
        clearanceAt: worstT,
        basis: 'envelope-undecided',
        proven: false,
        why: presses === null
            ? `the envelope closes to ${worst.toFixed(2)} px at t${worstT} and this class `
                + 'cannot be killed — the crossing must be re-routed'
            : `the envelope closes to ${worst.toFixed(2)} px at t${worstT}, so the crossing `
                + 'is UNDECIDED by over-approximation. Rung 3 prices it; slice 3\'s exact '
                + 'transcription may yet demote it to wake-and-thread.',
    };
}

/**
 * The hazard half of the ladder: the Puzzlements family has no disc and no
 * leash, so a crossing is an overlap with its VOLUME.
 */
export function priceHazardCrossings(path, hazards, world) {
    const out = [];
    for (const h of hazards) {
        const v = hazardVolume(h, world);
        let live = null;
        for (const o of path) {
            if (o.level !== h.level) continue;
            const hit = volumeHitsBox(v, boxAt(o));
            if (hit) {
                if (!live) {
                    live = {
                        level: h.level, tag: h.tag, x: h.x, y: h.y,
                        from: o.t, to: o.t, kind: hit.kind, part: hit.why,
                    };
                } else live.to = o.t;
            } else if (live) { out.push({ ...live, verdict: v }); live = null; }
        }
        if (live) out.push({ ...live, verdict: v });
    }
    return out.map((c) => ({
        level: c.level,
        tag: c.tag,
        x: c.x,
        y: c.y,
        from: c.from,
        to: c.to,
        // ⚠ NOTHING IN THIS FAMILY IS KILLABLE, so the conservative verdict
        // is always rung 4 — but only the phase-uncertain ones and the
        // lethal ones STAY there. A self-timed hazard (spinningaxe, pulser,
        // crusher's cycle, the arrow cadence) can be pinned exactly from the
        // live-tick count, which demotes it to rung 2; that transcription is
        // the rung after this one, so the demotion is NAMED rather than
        // assumed. An unnamed provisional is how a conservative verdict
        // silently becomes a permanent re-route.
        rung: 'hard-avoid',
        cost: null,
        basis: c.verdict.verdict === 'hard-avoid' ? 'lethal' : 'phase-not-yet-pinned',
        demotableTo: c.verdict.verdict === 'hard-avoid' ? null : 'wake-and-thread',
        why: `the path is inside its ${c.kind} volume (${c.part}) for `
            + `${c.to - c.from + 1} tick(s). ${c.verdict.why}`,
        exactness: c.verdict.exactness,
        phaseSpread: c.verdict.phaseSpread ?? null,
    }));
}

/**
 * ⛔ THE EXECUTOR'S WAKE RULE — the INTEGRITY half, and only that.
 *
 * §3.2 as amended: the executor refuses a wake the plan did not DECLARE
 * (the R1 `contacts` shape — a route that silently changed), never a wake
 * the plan RESOLVED. So this compares the crossings a recording actually
 * made against the verdicts the route artifact carries, and reports:
 *
 *   `undeclared`  a crossing with no verdict — a refusal. Something moved.
 *   `stale`       a verdict for a crossing that did not happen — the route
 *                 changed under the artifact, which is the same defect
 *                 pointing the other way.
 *
 * ⚠ It does NOT re-price. A verdict is the plan's; auditing it by re-running
 * the pricer would compare the artifact to the thing that produced it, which
 * is the §14 shape. What makes this an audit is that one side comes from a
 * RECORDING and the other from a committed file.
 *
 * @param {object[]} declared  the route artifact's `encounters` list
 * @param {object[]} observed  crossings derived from a drained stream
 */
export function auditEncounterVerdicts(declared, observed) {
    const key = (c) => `${c.level}:${c.tag}@${c.x},${c.y}`;
    const findings = [];
    const declaredBy = new Map();
    for (const d of declared ?? []) {
        if (!LADDER.includes(d.rung)) {
            findings.push({
                kind: 'malformed',
                what: `${key(d)} declares rung "${d.rung}", which is not on the ladder `
                    + `(${LADDER.join(' → ')})`,
            });
        }
        declaredBy.set(key(d), (declaredBy.get(key(d)) ?? 0) + 1);
    }
    const seen = new Map();
    for (const o of observed ?? []) {
        seen.set(key(o), (seen.get(key(o)) ?? 0) + 1);
        if (!declaredBy.has(key(o))) {
            findings.push({
                kind: 'undeclared',
                what: `${key(o)} — the walk entered its volume at t${o.from}..t${o.to} and `
                    + 'the route artifact declares no verdict for it. An undeclared wake '
                    + 'is a route that silently changed.',
            });
        }
    }
    for (const k of declaredBy.keys()) {
        if (!seen.has(k)) {
            findings.push({
                kind: 'stale',
                what: `${k} — the artifact declares a verdict for a crossing this walk `
                    + 'never made. The route moved and the artifact did not.',
            });
        }
    }
    return findings;
}

/**
 * Walk the ladder for a whole path against one level's census.
 *
 * The route artifact's `encounters` block is exactly this, per level, in
 * tick order — derived, then audited.
 */
export function encounterPlan(path, world, {
    cameraAt = null, hasDarkSword = false, mustClear = new Set(),
} = {}) {
    if (!world.combat) {
        fail('encounterPlan needs a world built with the `combat` role. A world without '
            + 'one has no census to price, and answering emptily would say "nothing here '
            + 'can hurt you" — the most dangerous thing this module could say untruthfully.');
    }
    const verdicts = [];
    for (const inst of world.combat.enemies) {
        const withLevel = { ...inst, level: world.level };
        for (const crossing of crossingsOf(path, withLevel)) {
            verdicts.push(priceCrossing(crossing, path, {
                cameraAt,
                hasDarkSword,
                mustClear: mustClear.has(`${inst.tag}@${inst.x},${inst.y}`),
            }));
        }
    }
    verdicts.push(...priceHazardCrossings(
        path,
        world.combat.hazards.map((h) => ({ ...h, level: world.level })),
        world.world,
    ));
    verdicts.sort((a, b) => a.from - b.from);
    const byRung = {};
    for (const v of verdicts) byRung[v.rung] = (byRung[v.rung] ?? 0) + 1;
    return { level: world.level, verdicts, byRung };
}
