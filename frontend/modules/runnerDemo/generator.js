/**
 * Runner level generator (plan §4.5; the shape of
 * bounceDemo/generator.js, horizontal).
 *
 * Generate-and-test (Cloudberry-style): `generateLevel` PROPOSES a
 * left-to-right strip for a target requirement ("this level needs
 * ability set S") and VERIFIES it with the same derive-rules verifier
 * the pipeline uses — every pickup and every exit must derive minimal
 * sets of exactly [S], with no defects. Failed proposals retry with a
 * perturbed seed; geometry is stored explicitly (the
 * no-RNG-determinism principle: the seed only drives generation,
 * nothing at runtime replays it).
 *
 * Construction is a chain of RUN SEGMENTS (flat ground floors at y=0,
 * gaps sized for a plain full-hold running jump) with one GATE SEGMENT
 * per required ability — the horizontal analog of bounce's column gate
 * table:
 *   doubleJump — a gap wider than the max single running jump (solver-
 *                swept, coyote included) but inside double-jump reach
 *   blue (any gated type) — a gap wider than even double-jump reach
 *                with a one-way stepping stone of that type mid-gap:
 *                suppressed without the item, the gap is uncrossable
 * Pickups land on dedicated segments after all gates; the main exit
 * tops the strip's right end. BRANCHES are elevated tip platforms over
 * widened plain gaps after the gates (surplus-exit hosts, portal in
 * the tip's wake); HAZARDS are spike patches on goal-free corridor
 * floors — and every spiked floor gets a FLUSH PARTNER floor after it
 * (the spikeRun-fixture pattern). The partner is load-bearing, not
 * decor: the solver's policy family is one jump per leg, and a leg
 * only ends when support switches platforms — so a spike hop that
 * lands back on the SAME floor must be able to RUN off it alive
 * (flush crossing), not face a second jump-gap it has no jump left
 * for. Spikes on a floor that ends in a jump gap are unsurvivable by
 * construction and fail the whole proposal. The verify run stays the
 * gatekeeper for hazards and tips alike (anything that breaks the
 * route or the gate fails the proposal, retry).
 *
 * Calibration is DERIVED-THEN-SWEPT (bounce's deriveGeometry /
 * sweep-calibrated split): vertical rises come from `jumpHeight`
 * closed-form; horizontal reach has no clean closed form (variable
 * hold under downwardMovementMultiplier + coyote + the solver's own
 * sampling), so `sweepMaxGap` measures it with the SOLVER ITSELF on a
 * two-platform probe — gate windows calibrated against canRun's own
 * verdict absorb the sampling grid by construction. The default
 * profile's geometry is PINNED (CELESTE_GEOMETRY) so committed worlds
 * reproduce byte-identically; other profiles derive on demand and
 * `validateGeometry` asserts the structural constraints either way.
 *
 * `generateZoneSet` builds a whole winnable zone table for the
 * substrate factory: zone 0 requires nothing and grants the first
 * ability item, each later non-filler zone requires a subset of
 * already-granted abilities and grants the next, fillers grant
 * nothing, and the final zone's pickup is Victory.
 */

import { createRng } from '../shared/rng.js';
import { DEFAULTS, PROFILES, DEFAULT_PROFILE_ID } from './physics.js';
import { canRun, reachableRunPlatforms } from './canRun.js';
import { deriveAccessRules } from './deriveRules.js';
import { validateLevel } from './level.js';
import { ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME } from './gameCore.js';

const round2 = (v) => Math.round(v * 100) / 100;
const round1 = (v) => Math.round(v * 10) / 10;

// ── Profile geometry ────────────────────────────────────────────────

/**
 * Max flat gap the SOLVER can cross under `abilities` — binary search
 * over a two-platform probe. The probe parameters are FROZEN (12-unit
 * run-up, 8-unit landing, [0.5, cap] search, 20 halvings) so pinned
 * REACH values reproduce exactly; `cap` only needs raising for very
 * fast profiles (sonic/meatboy saturate 16).
 */
export function sweepMaxGap(C, abilities, { cap = 16 } = {}) {
    const probe = (gap) => ({
        id: 'probe',
        size: { width: 12 + gap + 8, height: 16 },
        platforms: [
            { id: 'a', x: 0, y: 0, w: 12, h: 1, type: 'ground' },
            { id: 'b', x: 12 + gap, y: 0, w: 8, h: 1, type: 'ground' },
        ],
        hazards: [], pickups: [], portals: [], spawn: { x: 1, y: 1 },
    });
    let lo = 0.5;
    let hi = cap;
    for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (canRun(probe(mid), 'a', 'b', abilities, { constants: C })) lo = mid;
        else hi = mid;
    }
    return round2(lo);
}

/**
 * Pinned geometry for the default (celeste) profile. REACH values are
 * the sweepMaxGap results (single 6.69 incl. coyote; dj 11.40);
 * windows leave margin on BOTH sides of every gate boundary so the
 * solver's arrival/trigger grids can't flip a verdict (§4.3 doctrine).
 */
export const CELESTE_GEOMETRY = Object.freeze({
    REACH: Object.freeze({ single: 6.69, dj: 11.4 }),   // swept (sweepMaxGap)
    SEG_W: Object.freeze({ min: 5, span: 2.5 }),        // ≫ run-up convergence (~0.5);
    //                          kept tight — floor width scales the solver's arrival grid
    RUN_GAP: Object.freeze({ min: 2.3, span: 1.3 }),    // max 3.6 ≪ single 6.69
    DJ_GAP: Object.freeze({ min: 7.4, span: 2.4 }),     // > single+0.7; max 9.8 ≤ dj−1.6
    STONE_W: 5,
    STONE_HALF: Object.freeze({ min: 3.5, span: 0.7 }), // total ≥ 12 > dj+0.5; half ≤ 4.2
    BRANCH_GAP: Object.freeze({ min: 4.1, span: 0.8 }), // tip side clearance > PLAYER_W
    //                          (adjacent goal corridors overhang 0.75); max 4.9 ≪ single
    TIP_W: 2.5,
    TIP_H: 0.5,
    BRANCH_RISE: 1.35,                                  // 0.6 × jumpHeight (tip top; apex 2.25 clears)
    HAZARD_MARGIN: 2,                                   // spike patch inset from segment edges
});

/**
 * Derive a profile's generator geometry from its physics constants.
 * Horizontal reaches are swept with the solver unless supplied via
 * `opts.reaches` (tests; pinned profiles never call this). EXPENSIVE
 * when it sweeps (~10s per profile) — generation-time only, and only
 * for profiles without pinned geometry.
 */
export function deriveGeometry(C, opts = {}) {
    const single = opts.reaches?.single
        ?? sweepMaxGap(C, { doubleJump: false, blue: false }, opts);
    const dj = opts.reaches?.dj
        ?? sweepMaxGap(C, { doubleJump: true, blue: false }, opts);
    // run-up convergence distance (moveTowards is linear in v):
    // t = maxSpeed/maxAcceleration, dist = maxSpeed²/(2·maxAcceleration)
    const convergence = (C.maxSpeed * C.maxSpeed) / (2 * C.maxAcceleration);
    const STONE_W = 5;
    const TIP_W = 2.5;
    const djMargin = 0.15 * (dj - single);
    const halfMin = round1((dj * 1.06 - STONE_W) / 2);
    return Object.freeze({
        REACH: Object.freeze({ single, dj }),
        SEG_W: Object.freeze({ min: Math.max(5, round1(convergence * 1.5)), span: 2.5 }),
        RUN_GAP: Object.freeze({ min: round1(0.35 * single), span: round1(0.2 * single) }),
        DJ_GAP: Object.freeze({
            min: round1(single + djMargin),
            span: round1(Math.max(0.5, dj - single - 2 * djMargin - 0.5)),
        }),
        STONE_W,
        STONE_HALF: Object.freeze({
            min: halfMin,
            span: round1(Math.max(0.2, Math.min(0.1 * single, 0.75 * single - halfMin))),
        }),
        BRANCH_GAP: Object.freeze({ min: round1(TIP_W + 2 * (C.PLAYER_W + 0.05)), span: 0.8 }),
        TIP_W,
        TIP_H: 0.5,
        BRANCH_RISE: round1(0.6 * C.jumpHeight),
        HAZARD_MARGIN: 2,
    });
}

/**
 * Structural constraints geometry must satisfy under its constants —
 * checked for pinned and derived geometry alike (tests); returns a
 * list of violation strings, empty = valid. Every gate window must be
 * unclearable by the weaker capability WITH margin and clearable by
 * the stronger one WITH margin (the swept REACH values are the
 * boundary).
 */
export function validateGeometry(G, C) {
    const errors = [];
    const R = G.REACH;
    const wMax = (w) => w.min + w.span;
    if (wMax(G.RUN_GAP) > 0.75 * R.single) {
        errors.push(`RUN_GAP max ${wMax(G.RUN_GAP)} > 75% of single reach ${R.single}`);
    }
    if (G.DJ_GAP.min < R.single + 0.5) {
        errors.push(`DJ_GAP min ${G.DJ_GAP.min} clearable without doubleJump (single ${R.single})`);
    }
    if (wMax(G.DJ_GAP) > R.dj - 0.5) {
        errors.push(`DJ_GAP max ${wMax(G.DJ_GAP)} not clearable with doubleJump (dj ${R.dj})`);
    }
    if (2 * G.STONE_HALF.min + G.STONE_W < R.dj + 0.5) {
        errors.push(`stone gap total ${2 * G.STONE_HALF.min + G.STONE_W} clearable`
            + ` with doubleJump (dj ${R.dj})`);
    }
    if (wMax(G.STONE_HALF) > 0.75 * R.single) {
        errors.push(`STONE_HALF max ${wMax(G.STONE_HALF)} > 75% of single reach ${R.single}`);
    }
    if (G.BRANCH_GAP.min < G.TIP_W + 2 * C.PLAYER_W) {
        errors.push(`BRANCH_GAP min ${G.BRANCH_GAP.min} leaves tip (w ${G.TIP_W})`
            + ' inside an adjacent goal corridor overhang');
    }
    if (wMax(G.BRANCH_GAP) > 0.75 * R.single) {
        errors.push(`BRANCH_GAP max ${wMax(G.BRANCH_GAP)} > 75% of single reach ${R.single}`);
    }
    if (G.BRANCH_RISE > 0.8 * C.jumpHeight) {
        errors.push(`BRANCH_RISE ${G.BRANCH_RISE} above 80% of jump rise ${C.jumpHeight}`);
    }
    const convergence = (C.maxSpeed * C.maxSpeed) / (2 * C.maxAcceleration);
    if (G.SEG_W.min < convergence * 1.2) {
        errors.push(`SEG_W min ${G.SEG_W.min} below run-up convergence ${round2(convergence)}`);
    }
    return errors;
}

// Per-profile pinned geometry; profiles absent here derive (and sweep)
// from their constants.
const GEOMETRIES = Object.freeze({ celeste: CELESTE_GEOMETRY });

/**
 * Resolve a generator `physics` option to { profileId, C, G }.
 * Accepts a profile id (default DEFAULT_PROFILE_ID) or an explicit
 * { constants, geometry } object (tests, custom profiles).
 */
export function resolveGenPhysics(physics = DEFAULT_PROFILE_ID) {
    if (typeof physics === 'string') {
        const profile = PROFILES[physics];
        if (!profile) throw new Error(`runner generator: unknown physics profile '${physics}'`);
        const C = profile.constants;
        return { profileId: physics, C, G: GEOMETRIES[physics] ?? deriveGeometry(C) };
    }
    const C = physics.constants ?? DEFAULTS;
    return {
        profileId: physics.profile ?? null,
        C,
        G: physics.geometry ?? deriveGeometry(C),
    };
}

// ── Proposal ────────────────────────────────────────────────────────

const GATEABLE = new Set(['doubleJump', 'blue']);

function sameSets(minimalSets, want) {
    if (minimalSets.length !== 1) return false;
    const got = minimalSets[0];
    return got.length === want.length && want.every((a) => got.includes(a));
}

const draw = (rng, w) => w.min + rng.next() * w.span;

/**
 * Realize a floor plan left to right — the shared body of proposeLevel
 * and proposeLevelForSpecs. Each plan entry is a floor ({ role, gap,
 * pickupId?, seg← }); `gap` describes the gap BEFORE it ({ kind,
 * type?, portalId? }). rng draws happen in strict floor order (gap
 * draws, then the floor's width draw) followed by the floor's inline
 * hazard pass — the draw order IS the byte-identity contract. Explicit
 * pickupId/portalId override the loc_N / exit_brN counters (the spec
 * path names its goals); the counters are untouched by overrides only
 * because the two naming schemes are never mixed in one plan.
 */
function realizePlan(plan, { rng, G, hazardChance }) {
    const platforms = [];
    const hazards = [];
    const pickups = [];
    const portals = [];
    let x = 0;
    let segN = 0;
    let stoneN = 0;
    let brN = 0;
    let pkN = 0;
    let hzN = 0;
    for (const f of plan) {
        if (f.gap) {
            const g = f.gap;
            if (g.kind === 'run') {
                x = round2(x + draw(rng, G.RUN_GAP));
            } else if (g.kind === 'dj') {
                x = round2(x + draw(rng, G.DJ_GAP));
            } else if (g.kind === 'stone') {
                const half1 = round2(draw(rng, G.STONE_HALF));
                const half2 = round2(draw(rng, G.STONE_HALF));
                platforms.push({
                    id: `stone${stoneN++}`, x: round2(x + half1), y: 0.5,
                    w: G.STONE_W, h: 0.5, type: g.type,
                });
                x = round2(x + half1 + G.STONE_W + half2);
            } else if (g.kind === 'branch') {
                const gapW = round2(draw(rng, G.BRANCH_GAP));
                const tipY = round2(1 + G.BRANCH_RISE - G.TIP_H);
                const tip = {
                    id: `tip${brN}`, x: round2(x + (gapW - G.TIP_W) / 2), y: tipY,
                    w: G.TIP_W, h: G.TIP_H, type: 'ground',
                };
                platforms.push(tip);
                // 0.2 in from the tip's right end: interior hosts have
                // no wall clamp, so the wake stand box starts at
                // right − FOOT inset (the pickup offset, not the
                // wall-clamped exit's 0.6)
                portals.push({
                    id: g.portalId ?? `exit_br${brN}`, on: tip.id,
                    x: round2(tip.x + G.TIP_W - 0.2), y: round2(tipY + G.TIP_H + 0.6),
                    arrow: 'up', exitName: null,
                });
                brN++;
                x = round2(x + gapW);
            }
        }
        const w = round2(draw(rng, G.SEG_W) + (f.role === 'entrance' ? 2 : 0));
        const seg = { id: `seg${segN++}`, x, y: 0, w, h: 1, type: 'ground' };
        platforms.push(seg);
        if (f.role === 'pickup') {
            const pid = f.pickupId ?? `loc_${pkN++}`;
            pickups.push({ id: pid, on: seg.id, x: round2(x + w - 0.2), y: 1.6 });
        }
        f.seg = seg;
        x = round2(x + w);
        // hazard decoration (goal-free plain floors only): a spike
        // patch inset from the floor's edges, plus the FLUSH PARTNER
        // floor the hop needs (see the header — a spiked floor must
        // end in a flush crossing, never a jump gap)
        if (f.role === 'plain' && seg.w >= 2 * G.HAZARD_MARGIN + 1.8
                && rng.next() < hazardChance) {
            const hw = round2(1 + rng.next() * 0.6);
            const lo = seg.x + G.HAZARD_MARGIN;
            const hi = seg.x + seg.w - G.HAZARD_MARGIN - hw;
            hazards.push({
                id: `hz${hzN++}`, type: 'spikes',
                x: round2(lo + rng.next() * (hi - lo)), y: 1, w: hw, h: 0.8,
            });
            const partnerW = round2(4 + rng.next() * 2);
            platforms.push({ id: `seg${segN++}`, x, y: 0, w: partnerW, h: 1, type: 'ground' });
            x = round2(x + partnerW);
        }
    }
    return { platforms, hazards, pickups, portals };
}

/**
 * Assemble a realized plan into a level: width from the realized right
 * edges (+0.01 headroom — the rounded cumulative cursor can trail a
 * platform's x+w by float dust, and the validator's bounds check is
 * exact), the wall-clamped exit_main on the LAST floor, spawn at the
 * standard entrance.
 */
function assembleStrip(id, plan, { platforms, hazards, pickups, portals }) {
    const width = round2(Math.max(...platforms.map((p) => p.x + p.w)) + 0.01);
    const last = plan[plan.length - 1].seg;
    portals.push({
        id: 'exit_main', on: last.id, x: round2(width - 0.6), y: 1.6,
        arrow: 'right', exitName: null,
    });

    return {
        id,
        size: { width, height: 16 },
        platforms, hazards, pickups, portals,
        spawn: { x: 1, y: 1 },
    };
}

/**
 * One proposal — UNVERIFIED geometry (generateLevel is the verified
 * entry; this is exported for tests and the dump CLI's proposal view).
 * Floors are flat ground at y=0 (h=1); gap kinds carry the gate
 * semantics (see realizePlan for the draw-order contract).
 */
export function proposeLevel({
    id, requirement, pickupCount, branchCount, stepsBetween, hazardChance, rng, G,
}) {
    // plan: each entry is a floor; `gap` describes the gap BEFORE it.
    const plan = [{ role: 'entrance', gap: null }];
    const plains = () => {
        const n = 1 + Math.floor(rng.next() * stepsBetween);
        for (let i = 0; i < n; i++) plan.push({ role: 'plain', gap: { kind: 'run' } });
    };
    for (const ability of rng.shuffle([...requirement])) {
        plains();
        plan.push({
            role: 'plain',
            gap: ability === 'doubleJump' ? { kind: 'dj' } : { kind: 'stone', type: ability },
        });
    }
    plains();
    for (let i = 0; i < pickupCount; i++) plan.push({ role: 'pickup', gap: { kind: 'run' } });
    for (let b = 0; b < branchCount; b++) plan.push({ role: 'plain', gap: { kind: 'branch' } });
    plan.push({ role: 'exit', gap: { kind: 'run' } });

    return assembleStrip(id, plan, realizePlan(plan, { rng, G, hazardChance }));
}

/**
 * Re-derive a level's access rules the way generateLevel verifies them
 * (layered strip reach + goal-host early exit). Exported so tests and
 * the dump CLI verify EXACTLY what the generator gatekept.
 */
export function deriveGeneratedRules(level, C = DEFAULTS) {
    const goalHosts = new Set(
        [...(level.pickups ?? []), ...(level.portals ?? [])].map((g) => g.on));
    return deriveAccessRules(level, {
        constants: C, reach: reachableRunPlatforms, goalHosts,
    });
}

/**
 * Generate one strip whose pickups and EVERY exit (main + branch tips)
 * require EXACTLY `requirement` (an ability-name array ⊆
 * doubleJump/blue). Throws if no proposal verifies within `attempts`.
 */
export function generateLevel({
    id = 'gen',
    requirement = [],
    pickupCount = 1,
    branchCount = 0,
    stepsBetween = 2,
    hazardChance = 0.35,
    seed = 1,
    attempts = 8,
    physics = DEFAULT_PROFILE_ID,
} = {}) {
    for (const a of requirement) {
        if (!GATEABLE.has(a)) throw new Error(`generateLevel: no gate template for '${a}'`);
    }
    const { C, G } = resolveGenPhysics(physics);
    const want = [...requirement].sort();
    const rejected = [];
    for (let attempt = 0; attempt < attempts; attempt++) {
        const rng = createRng((seed * 8191 + attempt * 127) | 0);
        const level = proposeLevel({
            id, requirement, pickupCount, branchCount, stepsBetween, hazardChance, rng, G,
        });
        const modelErrors = validateLevel(level, C);
        if (modelErrors.length > 0) {
            rejected.push(`attempt ${attempt}: ${modelErrors[0]}`);
            continue;
        }
        const derived = deriveGeneratedRules(level, C);
        if (derived.defects.length > 0) {
            rejected.push(`attempt ${attempt}: ${derived.defects[0]}`);
            continue;
        }
        const goals = [
            ...level.pickups.map((pk) => derived.pickups[pk.id]),
            ...level.portals.map((pt) => derived.exits[pt.id]),
        ];
        if (goals.every((g) => sameSets(g.minimalSets, want))) return level;
        rejected.push(`attempt ${attempt}: derived rules != [${want.join('+')}]`);
    }
    throw new Error(`generateLevel('${id}'): no valid proposal in ${attempts} attempts`
        + ` (requirement [${want.join('+')}]): ${rejected.join('; ')}`);
}

// ── Spec-driven generation (sphere growth, plan §4.9) ───────────────

/**
 * Widen the plain-run-gap window toward the structural cap
 * (0.75 × single reach — validateGeometry's own bound, which keeps
 * plain gaps grounded-crossable WITHOUT spending the coyote window:
 * the swept reach is coyote-INCLUSIVE, so gaps must never approach it).
 * margin 0 returns G UNCHANGED (byte-identity for default worlds);
 * margin 1 stretches the window max to the cap. Only RUN_GAP moves —
 * gate windows are pinned calibration, never a difficulty knob.
 */
export function applyGapMargin(G, margin = 0) {
    const m = Math.max(0, Math.min(1, margin));
    if (m === 0) return G;
    const cap = 0.75 * G.REACH.single;
    const baseMax = G.RUN_GAP.min + G.RUN_GAP.span;
    const max = Math.min(cap, baseMax + m * (cap - baseMax));
    // floor, not round: a 2dp round-up would nudge the window max past
    // the structural cap and fail validateGeometry
    const span = Math.floor((max - G.RUN_GAP.min) * 100) / 100;
    return Object.freeze({
        ...G,
        RUN_GAP: Object.freeze({ min: G.RUN_GAP.min, span: Math.max(G.RUN_GAP.span, span) }),
    });
}

/**
 * Structural plan for a spec-driven strip (throws, non-retryable —
 * the runner analog of bounce's planBraidGatedChain). A strip realises
 * gates SEQUENTIALLY, so the distinct physics requirements over all
 * goals must form one NESTED CHAIN (∅ ⊂ R1 ⊂ … ⊂ Rk); each goal sits
 * in the window after its requirement's gates and before the next
 * gate, so it derives EXACTLY its requirement. The exit carrying the
 * maximal requirement becomes the wall-clamped exit_main at the strip
 * end; every other exit rides an elevated branch tip in its window
 * (exit_br0..N in spec order) — including any requirement-[] exit,
 * which lands on a tip BEFORE the first gate (this is how the sphere
 * engine's ungated entrance-side back portal is realised: the player
 * spawns past it on the entrance floor and returns to it by choice —
 * a deliberate tip landing — never by the mandatory route's wake).
 *
 * @param {Array<{key: string, requirement: string[]}>} exitSpecs
 * @param {Array<{id: string, requirement: string[]}>} pickupSpecs
 * @returns {{ levels: Array<{ added: string[], pickups: string[],
 *   tips: Array<{key: string, portalId: string}> }>, mainKey: string,
 *   portalByKey: Object<string, string> }}
 */
export function planStripSpecs(exitSpecs = [], pickupSpecs = []) {
    if (exitSpecs.length === 0) {
        throw new Error('runner planStripSpecs: at least one exit spec required');
    }
    const seen = new Set();
    const norm = (req, what) => {
        if (seen.has(what)) throw new Error(`runner planStripSpecs: duplicate goal ${what}`);
        seen.add(what);
        const sorted = [...new Set(req ?? [])].sort();
        for (const a of sorted) {
            if (!GATEABLE.has(a)) {
                throw new Error(`runner planStripSpecs: no gate template for '${a}' (${what})`);
            }
        }
        return sorted;
    };
    const exits = exitSpecs.map((s) => ({ key: s.key, req: norm(s.requirement, `exit '${s.key}'`) }));
    const pickups = pickupSpecs.map((s) => ({ id: s.id, req: norm(s.requirement, `pickup '${s.id}'`) }));

    // Distinct requirement sets (∅ always present — the entrance
    // window), chain-checked smallest to largest.
    const byKey = new Map([['', []]]);
    for (const g of [...exits, ...pickups]) byKey.set(g.req.join('+'), g.req);
    const sets = [...byKey.values()].sort((a, b) => a.length - b.length);
    for (let i = 1; i < sets.length; i++) {
        if (sets[i - 1].length === sets[i].length
                || !sets[i - 1].every((x) => sets[i].includes(x))) {
            throw new Error('runner planStripSpecs: requirements do not form a nested chain '
                + `([${sets[i - 1].join('+')}] vs [${sets[i].join('+')}]) — a strip realises `
                + 'gates sequentially');
        }
    }

    // The strip's right end derives the FULL chain, so the maximal
    // requirement must belong to an exit (the main).
    const top = sets[sets.length - 1];
    const main = exits.find((e) => e.req.length === top.length);
    if (!main) {
        throw new Error(`runner planStripSpecs: the maximal requirement [${top.join('+')}] `
            + 'belongs to no exit — the strip end must be an exit');
    }

    const portalByKey = { [main.key]: 'exit_main' };
    let brN = 0;
    const levels = sets.map((set, i) => {
        const prev = i > 0 ? sets[i - 1] : [];
        const lvlKey = set.join('+');
        const tips = exits
            .filter((e) => e !== main && e.req.join('+') === lvlKey)
            .map((e) => {
                const portalId = `exit_br${brN++}`;
                portalByKey[e.key] = portalId;
                return { key: e.key, portalId };
            });
        return {
            added: set.filter((a) => !prev.includes(a)),
            pickups: pickups.filter((p) => p.req.join('+') === lvlKey).map((p) => p.id),
            tips,
        };
    });
    return { levels, mainKey: main.key, portalByKey };
}

/**
 * One spec-driven proposal — UNVERIFIED geometry (the spec analog of
 * proposeLevel; generateLevelForSpecs is the verified entry). Walks
 * the planStripSpecs levels: per level, gate gaps for the ADDED
 * abilities (shuffled, plains before each — generateLevel's texture),
 * then the level's goals (pickup floors, then branch tips in spec
 * order); the strip ends with the exit_main floor.
 */
export function proposeLevelForSpecs({ id, plan, stepsBetween, hazardChance, rng, G }) {
    const floors = [{ role: 'entrance', gap: null }];
    const plains = () => {
        const n = 1 + Math.floor(rng.next() * stepsBetween);
        for (let i = 0; i < n; i++) floors.push({ role: 'plain', gap: { kind: 'run' } });
    };
    plan.levels.forEach((level, i) => {
        for (const ability of rng.shuffle([...level.added])) {
            plains();
            floors.push({
                role: 'plain',
                gap: ability === 'doubleJump' ? { kind: 'dj' } : { kind: 'stone', type: ability },
            });
        }
        if (level.pickups.length > 0 || level.tips.length > 0
                || i === plan.levels.length - 1) plains();
        for (const pickupId of level.pickups) {
            floors.push({ role: 'pickup', gap: { kind: 'run' }, pickupId });
        }
        for (const tip of level.tips) {
            floors.push({ role: 'plain', gap: { kind: 'branch', portalId: tip.portalId } });
        }
    });
    floors.push({ role: 'exit', gap: { kind: 'run' } });

    return assembleStrip(id, floors, realizePlan(floors, { rng, G, hazardChance }));
}

/**
 * Generate one strip realising per-goal requirements (sphere growth's
 * requirement-targeted entry; generateLevel stays the single-global-
 * requirement zone-table entry). Exit specs carry a caller key (the
 * grid side); the returned portalByKey maps it to the realised portal
 * id. Verification is the SAME gatekeeper as generateLevel —
 * validateLevel + deriveGeneratedRules, then every goal's minimal sets
 * must equal exactly its own requirement. Generator form: yields
 * { type: 'attempt', attempt, attempts } per proposal so the panel's
 * stepped flow can show generate-and-test progress live.
 *
 * @returns {{ level, derived, portalByKey }}
 */
export function* generateLevelForSpecsGen({
    id = 'gen',
    exitSpecs = [],
    pickupSpecs = [],
    stepsBetween = 2,
    hazardChance = 0.35,
    gapMargin = 0,
    seed = 1,
    attempts = 8,
    physics = DEFAULT_PROFILE_ID,
} = {}) {
    const { C, G } = resolveGenPhysics(physics);
    const Geff = applyGapMargin(G, gapMargin);
    // Structural validation runs ONCE (spec-level, non-retryable) so a
    // decline (non-nested chain, tipless maximal set) throws immediately.
    const plan = planStripSpecs(exitSpecs, pickupSpecs);

    const wantByGoal = new Map([
        ...exitSpecs.map((s) => [plan.portalByKey[s.key], [...new Set(s.requirement ?? [])].sort()]),
        ...pickupSpecs.map((s) => [s.id, [...new Set(s.requirement ?? [])].sort()]),
    ]);
    const rejected = [];
    for (let attempt = 0; attempt < attempts; attempt++) {
        yield { type: 'attempt', attempt: attempt + 1, attempts };
        const rng = createRng((seed * 8191 + attempt * 127) | 0);
        const level = proposeLevelForSpecs({
            id, plan, stepsBetween, hazardChance, rng, G: Geff,
        });
        const modelErrors = validateLevel(level, C);
        if (modelErrors.length > 0) {
            rejected.push(`attempt ${attempt}: ${modelErrors[0]}`);
            continue;
        }
        const derived = deriveGeneratedRules(level, C);
        if (derived.defects.length > 0) {
            rejected.push(`attempt ${attempt}: ${derived.defects[0]}`);
            continue;
        }
        const goals = [
            ...level.pickups.map((pk) => [pk.id, derived.pickups[pk.id]]),
            ...level.portals.map((pt) => [pt.id, derived.exits[pt.id]]),
        ];
        const bad = goals.find(([goalId, g]) => !sameSets(g.minimalSets, wantByGoal.get(goalId)));
        if (!bad) return { level, derived, portalByKey: plan.portalByKey };
        rejected.push(`attempt ${attempt}: '${bad[0]}' derived `
            + `!= [${wantByGoal.get(bad[0]).join('+')}]`);
    }
    throw new Error(`generateLevelForSpecs('${id}'): no valid proposal in ${attempts} attempts: `
        + rejected.join('; '));
}

/** Sync wrapper of generateLevelForSpecsGen (drains the attempt events). */
export function generateLevelForSpecs(opts) {
    const gen = generateLevelForSpecsGen(opts);
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value;
}

// ── Zone table ──────────────────────────────────────────────────────

/**
 * Generate a complete winnable zone table (ZONES shape: [{level,
 * items}]) for the substrate factory. `count` >= 3: zone 0 (requires
 * nothing, grants the first ability item) + the second feature zone +
 * the Victory zone; anything beyond is filler.
 */
export function generateZoneSet({ count = 5, seed = 1, physics = DEFAULT_PROFILE_ID } = {}) {
    if (count < 3) throw new Error('generateZoneSet: count must be >= 3');
    const rng = createRng(seed);
    const featureGrants = rng.shuffle(Object.keys(ABILITY_ITEM_NAMES));
    const fillerCount = count - 3;

    // zone plans: starter, second feature (+fillers interleaved), victory
    const plans = [{ requirement: [], grants: [featureGrants[0]] }];
    const middle = featureGrants.slice(1).map((g) => ({ grants: [g] }));
    for (let i = 0; i < fillerCount; i++) {
        middle.splice(Math.floor(rng.next() * (middle.length + 1)), 0, { filler: true });
    }
    plans.push(...middle, { victory: true });

    const granted = [];
    const zones = [];
    plans.forEach((plan, i) => {
        const isStarter = i === 0;
        let requirement = [];
        if (!isStarter && !plan.filler) {
            // require 1-2 already-granted abilities
            const pick = (from) => from[Math.floor(rng.next() * from.length)];
            requirement = [pick(granted)];
            if (granted.length > 1 && rng.next() < 0.5) {
                const more = granted.filter((a) => !requirement.includes(a));
                if (more.length) requirement.push(pick(more));
            }
        }
        const grants = plan.victory ? [] : (plan.grants ?? []);
        // The spec is stamped on the zone so extractZoneRules
        // (zoneRules.js) can re-run generateLevel with a branchCount
        // matching the exit sides it is asked for — same seed, so the
        // no-branch regeneration reproduces `level` byte-identically.
        const spec = {
            requirement,
            pickupCount: plan.victory ? 1 : grants.length,
            seed: (seed * 31 + i) | 0,
            physics,
        };
        const level = generateLevel({ id: `gen_z${i}`, ...spec });
        const items = {};
        level.pickups.forEach((pk, idx) => {
            items[pk.id] = plan.victory
                ? VICTORY_ITEM_NAME
                : ABILITY_ITEM_NAMES[grants[idx]];
        });
        granted.push(...grants);
        zones.push({ level, items, spec });
    });
    return zones;
}
