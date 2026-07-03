/**
 * Runner `canRun` — the solver (plan §4.3; the canJump analog and the
 * same law, copied from bounceDemo/canJump.js): a conservative
 * forward-query sampler of `step` that NEVER simulates physics of its
 * own — every answer comes from running the real engine forward, so
 * `step` and `canRun` cannot disagree by construction.
 *
 * Per-leg semantics: the edge A→B exists iff, from EVERY sampled
 * arrival condition on A (landing x across A's stand span × a small
 * arrival-vx set), SOME sampled input policy makes the player's next
 * SUPPORT on a different platform be B. The ∀arrival is because the
 * player cannot choose where a previous leg drops them; the ∃policy is
 * because the player chooses the inputs. A leg ends at `standingOn`
 * switching to a foreign platform — that covers both airborne landings
 * (`landedOn`) and auto-running across a flush platform boundary,
 * which never goes airborne and so never fires `landedOn`. Hazard
 * touch or the kill floor (`respawned`) is leg failure; pickups and
 * portals touched en route are recorded on the detailed result.
 *
 * DOOM, TOUCH, AND LAUNCH (the refinement that makes both corridor
 * hazards — plan §4.5's spikes-on-route-floors — and pre-gate goals
 * verifiable): call an arrival state LIVE if some policy from it
 * avoids death, DOOMED otherwise (under auto-run a platform before an
 * uncrossable gap dooms every stand — the run always ends in the
 * pit). Death costs nothing permanent (respawn, monotone world), so
 * accessibility is about SOME spawn trajectory reaching each goal;
 * the graph is a modular proof system for that, with two edge grades:
 *
 * - TOUCH edge A→B: from every LIVE sampled arrival on A, some policy
 *   makes the next support B. Enough to grant B's goals: the goal-
 *   wake invariant (level.js) keeps goal corridors free of blocks and
 *   hazards, so ANY landing on a host collects its wake goals even
 *   when the player dies right after — the item-before-the-gate
 *   pattern (a pickup at a doomed floor's edge) derives correctly
 *   instead of circularly requiring the gate's own item.
 * - LAUNCH edge A→B (`ok`, the graph edge): additionally the witness
 *   landing must itself be a LIVE state (`survivesFrom` on the exact
 *   landed state). Only launch edges chain: every chain hop's real
 *   arrival is the previous hop's witness landing, live by
 *   construction — which is also exactly why the ∀ may exclude
 *   doomed samples: no chain can produce them. (Arrivals overlapping
 *   a hazard die on the arrival tick itself and fall out the same
 *   way.)
 *
 * The entry leg touch-reaches the spawn platform; expanding onward
 * requires its landing to be live. A platform whose every sampled
 * arrival is doomed gets NO out-edges of either grade (a vacuous ∀
 * must not fabricate reach). Both classifications fall out of the
 * sims the edge query already runs. Residual: sub-sample doom windows
 * can escape the arrival grid — the same class of gap as bounce's
 * hover sampling, absorbed the same way (the generator keeps hazards
 * at least an arrival-grid step clear of landing zones).
 *
 * Why auto-run collapses the state (plan §2): a player who always
 * holds right has vx converging to maxSpeed as a deterministic
 * function of distance run since landing — the per-hop state is
 * (landing x, arrival vx) with no free velocity dimension, and the
 * input space per hop collapses to jump timings and hold lengths. The
 * residual arrival variation is ∀-quantified over a sampled set
 * (`arrivalVxFractions`, default {0.6, 1}·maxSpeed) and the
 * generator's templates keep run-ups past the convergence distance so
 * sub-sample windows can't flip a verdict (bounce's hover-sampling
 * precedent). Conservative by design: the policy family is finite, so
 * real edges can be missed — pessimistic, the safe direction (derived
 * rules never claim a run the player can't make).
 *
 * Policy family (finite, cheapest-first; parameterized by abilities so
 * Brake/Left later EXTEND it rather than rework it):
 *   - `none`: run off the edge (also the flush-boundary walk-over).
 *   - `jump@x+hold`: press jump when x reaches a trigger, hold for
 *     {tap, mid, full} ticks. Triggers are POSITION-based (arrival-
 *     independent, so one witness policy tends to serve every
 *     arrival): a span grid, the platform edge, a mid-coyote point
 *     past the edge, and hazard-lead points placed a closed-form
 *     ascent ahead of each hazard (placement heuristic only — every
 *     verdict still comes from the sim).
 *   - `…+air@d+hold2`: a second press d ticks after the first, when
 *     the effective params grant an air jump (Double Jump).
 *   - `drop@x`: hold drop from a trigger when standing on a one-way
 *     platform (drop-through descend).
 *
 * Node keys carry a `hitsRemaining` dimension RESERVED from day one
 * (plan §1): always 0 in v1 (MAX_HITS 0 — any hazard touch fails the
 * leg), so the hit-budget final phase (§4.10) adds edges that spend
 * hits without re-architecting the graph.
 *
 * The platform graph feeds `simulatorCore.js`'s BFS exactly like
 * bounce's makeJumpSolver: node = keyed platform (plus ENTRANCE),
 * input = target node, and a returned plan is the platform sequence
 * the playback bot replays.
 *
 * v1 has no movers ⇒ no phase machinery. When moving hazards or
 * platforms arrive, bounce's dj phase quantification (canJump.js) is
 * the tested precedent to copy.
 */

import { DEFAULTS, step as physicsStep, spawnState } from './physics.js';
import { activePlatforms, isPlatformActive, effectiveParams } from './suppression.js';
import { reach, makeBfsSolver } from '../shared/simulatorCore.js';

export const ENTRANCE = 'entrance';

/** Node key with the reserved hitsRemaining dimension (v1: always 0). */
export const nodeKey = (platformId, hitsRemaining = 0) => `${platformId}~h${hitsRemaining}`;
export const nodePlatformId = (key) => key.slice(0, key.lastIndexOf('~h'));

/** Foot-probe inset from physics.js groundUnder (mirrors level.js). */
const FOOT = 0.05;
const topOf = (p) => p.y + p.h;
const isSolidType = (p) => p.type === 'ground';
const round2 = (v) => Math.round(v * 100) / 100;

/** Springs are mid-leg geometry, never graph nodes: the engine never
 *  grounds on one (physics.js groundUnder excludes them), so no leg
 *  can END there and no arrival set exists to launch from. The bounce
 *  happens INSIDE a leg's sim — the policy family already contains
 *  the witnesses (jump onto the spring, ride the deterministic arc). */
const isStandable = (p) => p.type !== 'spring';

/** Active springs whose x-extent could touch a from→to leg's corridor
 *  — the pre-filters must widen their reach bounds by what a bounce
 *  adds, or they would reject spring-assisted legs before the sim
 *  ever runs (fail-only filters may prune, never lie). */
function corridorSprings(level, from, to, abilities, C) {
    return activePlatforms(level, abilities).filter((p) => p.type === 'spring'
        && p.x + p.w > from.x - C.PLAYER_W
        && p.x < to.x + to.w + C.PLAYER_W);
}

function platformById(level, id) {
    return level.platforms.find((p) => p.id === id) ?? null;
}

/** The stand span on `p`: player bottom-left x positions with a foot
 *  probe on the platform, clamped to the side walls. */
function standSpan(p, level, C) {
    return {
        lo: Math.max(p.x - C.PLAYER_W + FOOT, 0),
        hi: Math.min(p.x + p.w - FOOT, level.size.width - C.PLAYER_W),
    };
}

/** A just-arrived (grounded, mid-run) state on `from` — the runner
 *  analog of bounce's launchedState. Field-for-field what a real
 *  landing tick leaves behind; `step` takes it from here. */
function arrivedState(from, x, vx) {
    return {
        x,
        y: topOf(from),
        vx,
        vy: 0,
        facing: 1,
        desiredJump: false,
        pressingJump: false,
        jumpBufferCounter: 0,
        coyoteTimeCounter: 0,
        currentlyJumping: false,
        canJumpAgain: false,
        gravityScale: 1,
        gravMultiplier: 1,
        onGround: true,
        t: 0,
        landedOn: null,
        standingOn: from.id,
        touchedPickups: [],
        touchedPortals: [],
        hits: 0,
        respawned: null,
    };
}

/**
 * Run one leg from `fromId` (a platform id or ENTRANCE) under one
 * input policy, through the real engine, until the player is
 * supported by a different platform, dies (hazard / kill floor), or
 * times out. Returns `{ landedOn, landing, landingState, died,
 * timedOut, pickupsTouched, portalsTouched }` — `landedOn` here is
 * the leg's destination support (which may have been walked onto, not
 * landed on; the name mirrors bounce's jumpQuery contract), and
 * `landingState` the exact engine state there (survivesFrom's input).
 *
 * Platform legs start from a synthesized just-arrived state at
 * `opts.x0` with `opts.vx0`; ENTRANCE legs start from the real
 * spawnState (the spawn is deterministic — plan §1's standard
 * entrance — so they take no policy and their destination is simply
 * the first platform that supports the runner).
 */
export function runQuery(level, fromId, abilities, opts = {}) {
    const C = opts.constants ?? DEFAULTS;
    const maxFrames = opts.maxFrames ?? 400;
    const policy = opts.policy ?? (() => null);

    let state;
    if (fromId === ENTRANCE) {
        state = spawnState(level, C);
    } else {
        const from = platformById(level, fromId);
        if (!from) throw new Error(`runQuery: unknown platform '${fromId}'`);
        state = arrivedState(from, opts.x0 ?? from.x, opts.vx0 ?? 0);
    }
    return simulateLeg(level, fromId, state, policy, abilities, C, maxFrames);
}

function simulateLeg(level, fromId, startState, policy, abilities, C, maxFrames) {
    let state = startState;
    const pickupsTouched = new Set();
    const portalsTouched = new Set();
    const done = (over) => ({
        landedOn: null,
        landingState: null,
        died: null,
        timedOut: false,
        pickupsTouched: [...pickupsTouched],
        portalsTouched: [...portalsTouched],
        ...over,
    });

    for (let i = 1; i <= maxFrames; i++) {
        state = physicsStep(state, policy(state, i), level, abilities, C);
        for (const id of state.touchedPickups) pickupsTouched.add(id);
        for (const id of state.touchedPortals) portalsTouched.add(id);
        if (state.respawned) return done({ died: state.respawned });
        if (state.standingOn && state.standingOn !== fromId) {
            return done({
                landedOn: state.standingOn,
                landing: { x: state.x, y: state.y },
                landingState: state,
            });
        }
    }
    return done({ timedOut: true });
}

/**
 * Can the player, from this EXACT state supported by `platformId`,
 * avoid death under some policy? (Landing anywhere — including back
 * on the same platform — or merely outliving the frame budget both
 * count; only `died` legs don't.) The inbound half of the
 * doomed-arrival refinement: witnesses may only deliver the player
 * into survivable states.
 */
export function survivesFrom(level, platformId, state, abilities, opts = {}) {
    const C = opts.constants ?? DEFAULTS;
    const maxFrames = opts.maxFrames ?? 400;
    const platform = platformById(level, platformId);
    if (!platform) return false;
    // Optional per-(level, abilities) memo (opts.doomCache, a Map the
    // flood/graph builders create per evaluation): landing states from
    // different arcs cluster on the same spots, and scanning the whole
    // policy family per candidate landing is the doomed-floor cost
    // blowup. Landing states are near-canonical (grounded, vy 0), so
    // (platform, x, vx, canJumpAgain) at 2 decimals identifies one —
    // the same epsilon class as the sampling grids (bounce's hover
    // precedent).
    const key = opts.doomCache
        ? `${platformId}|${round2(state.x)}|${round2(state.vx)}|${state.canJumpAgain ? 1 : 0}`
        : null;
    if (key !== null && opts.doomCache.has(key)) return opts.doomCache.get(key);
    let survives = false;
    for (const p of policiesFor(level, platform, abilities, opts)) {
        if (!simulateLeg(level, platformId, state, p.make(), abilities, C, maxFrames).died) {
            survives = true;
            break;
        }
    }
    if (key !== null) opts.doomCache.set(key, survives);
    return survives;
}

/** ENTRANCE's sole destination: the first platform that supports the
 *  spawn drop (null if the drop dies or never lands). The landing may
 *  be doomed — that still touch-reaches the platform; whether it can
 *  EXPAND is the flood's survivesFrom call on the landing state. */
export function entryTarget(level, abilities, opts = {}) {
    return runQuery(level, ENTRANCE, abilities, { ...opts, policy: null }).landedOn;
}

// ── The policy family ──────────────────────────────────────────────

/** Closed-form ascent ticks to gain `rise` under the effective params.
 *  PLACEMENT HEURISTIC ONLY (hazard-lead triggers): it positions
 *  candidate policies; every verdict still comes from the sim. */
function riseTicks(C, rise) {
    const gUp = (2 * C.jumpHeight) / (C.timeToJumpApex * C.timeToJumpApex);
    const v0 = Math.sqrt(2 * gUp * C.jumpHeight);
    const disc = v0 * v0 - 2 * gUp * rise;
    if (disc <= 0) return C.timeToJumpApex * C.TICK_HZ;
    return ((v0 - Math.sqrt(disc)) / gUp) * C.TICK_HZ;
}

function jumpPolicy(name, triggerX, hold, second = null) {
    return {
        name,
        make: () => {
            let pressAt = null;
            return (state, frame) => {
                if (pressAt === null && state.x >= triggerX) pressAt = frame;
                if (pressAt === null) return null;
                const dt = frame - pressAt;
                if (dt < hold) return { jump: true };
                if (second && dt >= second.at && dt < second.at + second.hold) {
                    return { jump: true };
                }
                return null;
            };
        },
    };
}

function dropPolicy(name, triggerX, holdTicks) {
    return {
        name,
        make: () => {
            let dropAt = null;
            return (state, frame) => {
                if (dropAt === null && state.x >= triggerX) dropAt = frame;
                if (dropAt !== null && frame - dropAt < holdTicks) return { drop: true };
                return null;
            };
        },
    };
}

/**
 * The sampled input-policy family for legs launched from `from`.
 * Cheapest-first; canRun stops at the first witness. Exported for the
 * derive-rules verifier and the fixture tests (per-policy probes).
 * Ability-parametric: air-jump combos appear only when the effective
 * params grant them, drop-throughs only on one-way platforms —
 * Brake/Left later add policies here, not a re-architecture.
 */
export function policiesFor(level, from, abilities, opts = {}) {
    const C = effectiveParams(opts.constants ?? DEFAULTS, abilities ?? {});
    const apexT = Math.ceil(C.timeToJumpApex * C.TICK_HZ);
    const holdFull = apexT + 2; // release after the apex = full rise,
    //                             and leaves the button free for a
    //                             near-apex second press
    const holdMid = Math.ceil(apexT / 2);
    const holds = [holdFull, 1, holdMid];

    const { lo, hi } = standSpan(from, level, C);
    const triggers = new Set([round2(hi)]); // the edge: max range
    // mid-coyote: past the edge, inside the (0.03, coyoteTime) window
    triggers.add(round2(hi + C.maxSpeed * C.coyoteTime * 0.45));
    const gridStep = opts.triggerStep ?? Math.min(3, Math.max(0.75, (hi - lo) / 8));
    for (let x = lo; x < hi; x += gridStep) triggers.add(round2(x));
    // hazard-lead triggers: launch a closed-form ascent ahead of each
    // hazard the run corridor could clip, so "hop the spikes" is in
    // the family wherever the spikes sit (grids can straddle them)
    for (const hz of level.hazards ?? []) {
        const clearance = hz.y + hz.h - topOf(from);
        if (clearance <= -0.01 || hz.y >= topOf(from) + C.PLAYER_H) continue;
        const dx = (riseTicks(C, Math.max(clearance, 0.05)) / C.TICK_HZ) * C.maxSpeed;
        for (const margin of [0, 0.4, 0.8]) {
            const t = round2(hz.x - C.PLAYER_W - dx - margin);
            if (t >= lo - C.PLAYER_W && t <= hi) triggers.add(t);
        }
    }
    const sorted = [...triggers].sort((a, b) => b - a); // edge-first

    const policies = [{ name: 'none', make: () => () => null }];
    for (const trig of sorted) {
        for (const hold of holds) {
            policies.push(jumpPolicy(`jump@${trig}+${hold}`, trig, hold));
        }
    }
    if ((C.maxAirJumps ?? 0) > 0) {
        for (const trig of sorted) {
            for (const hold of [holdFull, holdMid]) {
                const delays = [...new Set([
                    hold + 2, // asap after release
                    Math.max(hold + 2, apexT + 2), // at the apex (max range)
                    Math.max(hold + 2, 2 * apexT + 8), // late, into the fall
                ])];
                for (const d of delays) {
                    for (const hold2 of [holdFull, 1]) {
                        policies.push(jumpPolicy(
                            `jump@${trig}+${hold}+air@${d}+${hold2}`,
                            trig, hold, { at: d, hold: hold2 },
                        ));
                    }
                }
            }
        }
    }
    if (!isSolidType(from)) {
        for (const trig of sorted) {
            for (const dh of [6, Infinity]) {
                policies.push(dropPolicy(
                    dh === Infinity ? `drop@${trig}` : `drop@${trig}+${dh}`, trig, dh));
            }
        }
    }
    return policies;
}

/** Sampled arrival conditions on `from`: landing x across the stand
 *  span (ends always included) × arrival-vx fractions of maxSpeed. */
function arrivalsFor(level, from, C_eff, opts = {}) {
    const { lo, hi } = standSpan(from, level, C_eff);
    const xs = new Set([round2(lo), round2(hi)]);
    const stepX = opts.x0Step ?? Math.max(1, (hi - lo) / 12);
    for (let x = lo; x < hi; x += stepX) xs.add(round2(x));
    const fractions = opts.arrivalVxFractions ?? [0.6, 1];
    const arrivals = [];
    for (const x0 of xs) {
        for (const f of fractions) {
            arrivals.push({ x0, vx0: round2(f * C_eff.maxSpeed) });
        }
    }
    return arrivals;
}

/**
 * Detailed edge query: `{ ok, touch, witnesses }`. `ok` is the LAUNCH
 * verdict (chainable; one live-landing witness per live arrival),
 * `touch` the weaker goal-granting verdict (see the header's doom/
 * touch/launch section; ok ⇒ touch). `witnesses` accompany ok only.
 */
export function canRunDetailed(level, fromId, toId, abilities, opts = {}) {
    const C = opts.constants ?? DEFAULTS;
    const C_eff = effectiveParams(C, abilities ?? {});
    const fail = { ok: false, touch: false, witnesses: [] };

    const to = platformById(level, toId);
    if (!to || !isPlatformActive(to, abilities) || !isStandable(to)) return fail;

    if (fromId === ENTRANCE) {
        // Deterministic spawn (plan §1): the entry leg takes no inputs.
        const r = runQuery(level, ENTRANCE, abilities, { ...opts, policy: null });
        if (r.landedOn !== toId) return fail;
        const live = survivesFrom(level, toId, r.landingState, abilities, opts);
        return {
            ok: live,
            touch: true,
            witnesses: live ? [{ x0: null, vx0: 0, policy: 'entry' }] : [],
        };
    }
    const from = platformById(level, fromId);
    if (!from || !isPlatformActive(from, abilities) || !isStandable(from)) return fail;

    // Cheap pre-filters — fail-only (pessimistic is the safe direction),
    // each backed by an engine invariant, not a re-simulation:
    // 1) x-monotonicity: under AUTO_RUN vx is never negative (desiredVx
    //    is +maxSpeed, arrivals/bonks leave vx ≥ 0), so landing x ≥
    //    launch x ≥ from's stand-span lo. A target wholly left of that
    //    can never be the leg's destination.
    if (to.x + to.w < from.x - C.PLAYER_W) return fail;
    // 2) rise: each launch re-derives jumpSpeed from jumpHeight, so the
    //    total gain is bounded by jumpHeight per jump (+ margin for the
    //    inherited gravityScale quirk's overshoot). Corridor springs
    //    widen the budget: each bounce adds up to SPRING_RISE.
    const springs = corridorSprings(level, from, to, abilities, C_eff);
    const springRise = springs.length * C_eff.SPRING_RISE;
    const airJumps = C_eff.maxAirJumps ?? 0;
    if (topOf(to) - topOf(from)
            > C_eff.jumpHeight * (1 + airJumps) * 1.15 + springRise + 0.5) return fail;
    // 3) range: maxSpeed × a generous airtime bound (ascent per jump ≤
    //    timeToJumpApex; descent timed with UP-gravity, which the
    //    downward multiplier only ever shortens). Each corridor spring
    //    adds a bounce's airtime, timed with UNDAMPENED up-gravity on
    //    both halves (the real cut/downward multipliers only shorten
    //    it — generous is the safe direction for a fail-only filter).
    const gUp = (2 * C_eff.jumpHeight) / (C_eff.timeToJumpApex * C_eff.timeToJumpApex);
    const drop = Math.max(0, topOf(from) - topOf(to));
    const fall = C_eff.jumpHeight * (1 + airJumps) + springRise + drop + 0.5;
    const airTime = C_eff.timeToJumpApex * (1 + airJumps)
        + springs.length * 2 * Math.sqrt((2 * C_eff.SPRING_RISE) / gUp)
        + Math.sqrt((2 * fall) / gUp) + C_eff.coyoteTime;
    if (to.x - (from.x + from.w) > C_eff.maxSpeed * airTime * 1.25 + C.PLAYER_W) return fail;

    const policies = policiesFor(level, from, abilities, opts);
    // Per-evaluation leg memo (opts.legCache, a Map the flood/graph
    // builders create per (level, abilities) evaluation, exactly like
    // doomCache): a leg's outcome is TARGET-INDEPENDENT — simulateLeg
    // ends when support switches to ANY foreign platform, and this
    // function only inspects WHICH — so without the memo the same
    // (arrival × policy) sims re-run for every candidate target a
    // source is probed against. Keyed by policy NAME: names encode
    // trigger/hold exactly (the policy identity within one family),
    // and the family is a pure function of (level, from, abilities).
    const legCache = opts.legCache ?? null;
    const runLeg = (x0, vx0, p) => {
        const key = legCache === null ? null : `${fromId}|${x0}|${vx0}|${p.name}`;
        if (key !== null) {
            const hit = legCache.get(key);
            if (hit !== undefined) return hit;
        }
        const r = runQuery(level, fromId, abilities, { ...opts, x0, vx0, policy: p.make() });
        if (key !== null) legCache.set(key, r);
        return r;
    };
    const witnesses = [];
    let liveArrivals = 0;
    let launch = true;
    for (const { x0, vx0 } of arrivalsFor(level, from, C_eff, opts)) {
        // Engine-attribution probe: standSpan brackets the lip stands,
        // but on a FLUSH boundary (spike-hop partner floors) the
        // engine's ground probe attributes a left-overhang stand to
        // the abutting neighbor — a state no landing on `from` can
        // produce, since legs END the moment support switches. One
        // real step decides (the module's law: never re-derive engine
        // logic); samples the engine hands to another platform are
        // excluded from the ∀ exactly like doomed ones: no chain
        // delivers them as arrivals on `from`.
        const attribution = physicsStep(
            arrivedState(from, x0, vx0), null, level, abilities, C);
        if (attribution.standingOn && attribution.standingOn !== fromId) continue;
        let live = false;
        let touched = false;
        let witness = null;
        // Witness budget: after this many candidate landings on `to`
        // fail the live check, stop looking for this arrival and grade
        // it touch-only. Pessimistic-safe (an edge can only be UNDER-
        // graded, never fabricated) and bounds the doomed-floor cost:
        // an edge into a floor with no live landing would otherwise
        // scan policies × policies.
        const witnessBudget = opts.witnessBudget ?? 8;
        let failedChecks = 0;
        for (const p of policies) {
            const r = runLeg(x0, vx0, p);
            if (r.died) continue;
            live = true;
            if (r.landedOn === toId) {
                touched = true;
                if (survivesFrom(level, toId, r.landingState, abilities, opts)) {
                    witness = { x0, vx0, policy: p.name };
                    break;
                }
                if (++failedChecks >= witnessBudget) break;
            }
        }
        // Doomed arrival (every policy died): no chain can produce it
        // — excluded from the ∀ (see the header refinement).
        if (!live) continue;
        liveArrivals += 1;
        if (!touched) return fail; // a live arrival cannot make it at all
        if (witness) witnesses.push(witness);
        else launch = false; // touchable, but only into doom windows
    }
    // A vacuous ∀ (every sampled arrival doomed) must not fabricate
    // reach: a platform the player can only die on has no out-edges.
    if (liveArrivals === 0) return fail;
    return { ok: launch, touch: true, witnesses: launch ? witnesses : [] };
}

export function canRun(level, fromId, toId, abilities, opts = {}) {
    return canRunDetailed(level, fromId, toId, abilities, opts).ok;
}

// ── Graph + search (simulatorCore) ─────────────────────────────────

/**
 * Build the per-leg platform graph for one ability set — the SOUND
 * DEFAULT substrate (full N² minus pre-filters) and the layered
 * flood's oracle. `{ level, abilities, nodes, edges, touches }` with
 * nodes keyed by `nodeKey` (hitsRemaining always 0 in v1): `edges`
 * are LAUNCH edges (chainable), `touches` the full touch relation
 * (⊇ edges — goal-granting; see the header). Suppressed platforms
 * don't exist under this ability set.
 */
export function buildRunGraph(level, abilities, opts = {}) {
    const platforms = activePlatforms(level, abilities).filter(isStandable);
    const nodes = [nodeKey(ENTRANCE), ...platforms.map((p) => nodeKey(p.id))];
    const edges = new Map(nodes.map((n) => [n, new Set()]));
    const touches = new Map(nodes.map((n) => [n, new Set()]));
    // one doom + leg memo per (level, abilities) evaluation — NEVER
    // share across ability sets (doom/legs under {} ≠ under {doubleJump})
    const graphOpts = { doomCache: new Map(), legCache: new Map(), ...opts };
    for (const from of [ENTRANCE, ...platforms.map((p) => p.id)]) {
        for (const to of platforms) {
            if (to.id === from) continue;
            const r = canRunDetailed(level, from, to.id, abilities, graphOpts);
            if (r.touch) touches.get(nodeKey(from)).add(nodeKey(to.id));
            if (r.ok) edges.get(nodeKey(from)).add(nodeKey(to.id));
        }
    }
    return { level, abilities, nodes, edges, touches };
}

/**
 * simulatorCore solver over a run graph: state = node key, input =
 * target node key, step succeeds iff the edge exists. A returned plan
 * is the keyed platform sequence the playback bot replays
 * (`planPlatformIds` strips the reserved hits dimension).
 */
export function makeRunSolver(graph) {
    return makeBfsSolver({
        step: (world, node, target) => (world.edges.get(node)?.has(target) ? target : null),
        inputs: graph.nodes.filter((n) => n !== nodeKey(ENTRANCE)),
        visitedKey: (node) => node,
    });
}

/** Shortest leg path entrance → `toPlatformId` via simulatorCore. */
export function findRunPath(graph, toPlatformId, options = {}) {
    return reach(graph, makeRunSolver(graph), nodeKey(ENTRANCE),
        (node) => nodePlatformId(node) === toPlatformId, options);
}

export const planPlatformIds = (plan) => plan.map(nodePlatformId);

/** All platforms REACHED from the entrance (returns PLATFORM ids —
 *  hits levels collapse): flood fill over launch edges, then one
 *  touch step out of every launchable node (touch targets grant
 *  their goals but cannot chain onward — see the header). */
export function reachablePlatforms(graph) {
    const start = nodeKey(ENTRANCE);
    const launchable = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
        const n = queue.shift();
        for (const next of graph.edges.get(n) ?? []) {
            if (!launchable.has(next)) {
                launchable.add(next);
                queue.push(next);
            }
        }
    }
    const reached = new Set();
    for (const n of launchable) {
        if (n !== start) reached.add(nodePlatformId(n));
        for (const t of graph.touches.get(n) ?? []) reached.add(nodePlatformId(t));
    }
    return reached;
}

/**
 * Left-to-right layered reachability for STRIP levels — the runner
 * analog of bounce's reachableBraidPlatforms, but with a stronger
 * guarantee: it is VERDICT-IDENTICAL to
 * `reachablePlatforms(buildRunGraph(...))`, not merely
 * requirement-over-stating (deriveRules.js pruning doctrine — the
 * safe direction if the argument ever weakens).
 *
 * The argument: (1) edges are evaluated LAZILY, only out of already-
 * reached platforms — edges out of unreachable platforms can never
 * change a flood's result; (2) the only skipped pairs are those the
 * x-monotonicity pre-filter inside canRun would fail anyway (under
 * AUTO_RUN, vx ≥ 0 always, so a leg can never end on a platform
 * wholly left of its launch span). Same edge predicate, strictly
 * fewer evaluations: reached-count × N legs instead of N².
 *
 * `goalHosts` (portal/pickup host ids) early-exits the flood the
 * moment every goal host is reached (goal-reachable ⇔ host-reachable
 * by the goal-wake invariant, level.js).
 *
 * AUTO_RUN-only: when Brake/Left arrive, the x-prune dies with them —
 * fall back to the full graph under those ability sets.
 */
export function reachableRunPlatforms(level, abilities, opts = {}) {
    // per-evaluation doom + leg memos (see buildRunGraph)
    const { goalHosts, ...queryOpts } = {
        doomCache: new Map(), legCache: new Map(), ...opts,
    };
    const C = queryOpts.constants ?? DEFAULTS;
    const platforms = activePlatforms(level, abilities).filter(isStandable)
        .sort((a, b) => (a.x - b.x) || (a.y - b.y));
    const reached = new Set();
    const entryLeg = runQuery(level, ENTRANCE, abilities, { ...queryOpts, policy: null });
    if (!entryLeg.landedOn) return reached;
    reached.add(entryLeg.landedOn);
    const remaining = goalHosts
        ? new Set([...goalHosts].filter((h) => !reached.has(h))) : null;
    const launchable = new Set();
    const queue = [];
    if (survivesFrom(level, entryLeg.landedOn, entryLeg.landingState, abilities, queryOpts)) {
        launchable.add(entryLeg.landedOn);
        queue.push(entryLeg.landedOn);
    }
    while (queue.length > 0 && !(remaining && remaining.size === 0)) {
        const fromId = queue.shift();
        const from = platforms.find((p) => p.id === fromId);
        for (const p of platforms) {
            if (launchable.has(p.id)) continue; // fully expanded already
            if (p.x + p.w < from.x - C.PLAYER_W) continue; // the x-prune
            const r = canRunDetailed(level, fromId, p.id, abilities, queryOpts);
            if (r.touch) {
                reached.add(p.id);
                remaining?.delete(p.id);
            }
            if (r.ok) {
                launchable.add(p.id);
                queue.push(p.id);
            }
            if (remaining && remaining.size === 0) break;
        }
    }
    return reached;
}
