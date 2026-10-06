/**
 * Noiz2sa substrate — PRICING a world's regions against the Loops cost planner, at generation time (bulletml N5).
 * Pure: no DOM, no eventBus.
 *
 * ⚖ The user's design (2026-10-05): "The algorithm will need to track how much mana has been spent so far in Noiz2sa
 * regions. This is how much was spent on training the bot's stats. Like the Loops algorithm, process the regions in
 * the order they are reached in the sphere log. For each region, first assign which scenes to use for that region. It
 * should be a scene that the current stats have a 50% chance of winning, erring on the side of a higher chance of
 * winning. In the generation settings, there should be a control for the set of scenes to use for the final region.
 * Scale both the difficulty and the number of scenes in the other regions based on that. Once that is set, the next
 * value to adjust to reach the target cost is the mana drain. A higher mana drain also means faster conversion from
 * mana to training points."
 *
 * The walk (`planNoiz2saPricing`), over the ONE cost model's planned steps (`shared/procgen/loopCostPlanner.js`):
 *
 *  1. SPEND. In step order, every queued action in a Noiz2sa region spends mana there: a move out of it (its planned
 *     cost, XP-discounted as the planner charges it) and a location check in it. The planner's EXPLORE actions are not
 *     counted: a Noiz2sa region has none (a first entry explores it fully, `noiz2saFirstEntry.js`). Within a step the
 *     traversal comes first, then the step's cost assignments, then its check — the order the loop plays them.
 *  2. TRAINING. Training points = the Noiz2sa mana spent so far × the world's `pointsPerMana`; the predicted tracks are
 *     a fresh trainer earning those points under the Even strategy (`tracks.js`, the default step prices), and the
 *     predicted SKILL is the mean of the five tracks (Even keeps them within one step of each other, and equal tracks
 *     are the skill slider the sweeps measured).
 *  3. THE MOVE SPAN, when the walk first prices a Noiz2sa region (the planner assigns its cost when the walk first
 *     reaches it). The ORDER is the walk's first-reach order, then the regions the sphere log never reaches (priced by
 *     the planner's defaults step after the walk, at the skill the walk ended on). Its NUMBER of scenes ramps linearly
 *     over that order from 1 (the first) to the final region's count; WHICH scenes is `noiz2saDifficulty.js` `pickSpan`
 *     at the predicted skill (the hardest span the bot clears deathless with chance ≥ 0.5). The FINAL region — the last
 *     in that order — plays the generation setting exactly (`noiz2saFinalSpan`). (Why the never-reached regions count:
 *     a spiral often leaves Noiz2sa regions off every planned path; ending the order on the last REACHED one priced the
 *     final span at whatever skill that region was reached with — skill 0 when it was the first region reached.)
 *  4. THE RATE: the region's planned cost ÷ the move span's expected seconds at that skill, so a move run is expected
 *     to drain the planned cost. Written as the region's `timeDrainPerSecond` (the payload's; the shared cost writer
 *     passes it into `loop_costs`).
 *  5. A LOCATION'S CHECK SPAN, when the walk prices the location: from the move span's start, the number of scenes
 *     whose expected seconds at the region's rate come closest to the location's planned cost (at the skill predicted
 *     then).
 *  6. The world's `pointsPerMana` is chosen so the predicted skill is `TARGET_FINAL_SKILL` when the walk's sphere
 *     entries are done (⚖ "an Even-trained bot reaches ~skill 95+ by the final spheres"). The planner's costs do not
 *     depend on the spans or the rates, so the total Noiz2sa mana is known before any span is picked: no iteration.
 *
 * A Noiz2sa START region is free to leave (the planner's rule) and so has no rate: its move span is one scene picked at
 * skill 0, and the default drain applies.
 */
import { CostPlanner, topologyFromRulesJson } from '../shared/procgen/loopCostPlanner.js';
import { newTrainer, earn, DEFAULT_TRAINING } from '../bulletml-dodge/src/game/tracks.js';
import { TRACKS } from '../bulletml-dodge/src/game/human.js';
import { pickSpan, parseSpan, spanDifficulty, spanLength, spanAt, sceneIndex, SCENE_TOTAL } from './noiz2saDifficulty.js';
import { showSpan } from './noiz2saRegion.js';

/**
 * ⚖ The final region's scenes, by default: the last four scenes of the game, 10:7–10:boss, ending on its last boss. The
 * measured bot clears it deathless with chance about 0.27 at skill 95, 0.6 at 97 and 1 from 98 on, so it asks for the
 * ~95+ skill the default training pace (`TARGET_FINAL_SKILL`) reaches, and four scenes leave the ramp room to grow.
 */
export const DEFAULT_FINAL_SPAN = '10:7–10:boss';
/** the generation-form setting's key (the procgen params bag) */
export const FINAL_SPAN_PARAM = 'noiz2saFinalSpan';
/** ⚖ "an Even-trained bot reaches ~skill 95+ by the final spheres" */
export const TARGET_FINAL_SKILL = 95;
/** a world priced before N5 (or without loop mode) has no pace of its own: one point per mana (at the default drain of
 *  one mana per second, the old one point per second) */
export const DEFAULT_POINTS_PER_MANA = 1;
/** the step prices the prediction assumes: tracks.js's defaults (a player who changes them trains at another pace) */
export const PRICING_STEP_PRICES = Object.freeze({ stepBase: DEFAULT_TRAINING.stepBase, stepGrowth: DEFAULT_TRAINING.stepGrowth });

const round = (x, d) => { const f = 10 ** d; return Math.round(x * f) / f; };

/** the mean track of a fresh Even trainer that earned `points` */
export function skillForPoints(points, prices = PRICING_STEP_PRICES) {
    const tr = newTrainer({ settings: { pointsPerSecond: 1, pointsPerScore: 0, ...prices }, strategy: 'even' });
    if (points > 0) earn(tr, { seconds: points });
    return TRACKS.reduce((a, k) => a + tr.tracks[k], 0) / TRACKS.length;
}
/** the predicted skill after `mana` Noiz2sa mana at `pointsPerMana` */
export const predictedSkill = (mana, pointsPerMana, prices = PRICING_STEP_PRICES) => skillForPoints(mana * pointsPerMana, prices);

/** the points every track at `skill` (an integer) costs from zero */
export function pointsForSkill(skill, prices = PRICING_STEP_PRICES) {
    const s = Math.max(0, Math.min(100, Math.round(skill)));
    return newTrainer({ settings: { ...prices }, tracks: Object.fromEntries(TRACKS.map((k) => [k, s])) }).spent;
}

/** the world's pace: the points per mana at which `manaEnd` Noiz2sa mana buys `target` (4 significant digits, up) */
export function pointsPerManaFor(manaEnd, { target = TARGET_FINAL_SKILL, prices = PRICING_STEP_PRICES } = {}) {
    if (!(manaEnd > 0)) return DEFAULT_POINTS_PER_MANA;
    const exact = pointsForSkill(target, prices) / manaEnd;
    const mag = 10 ** (Math.floor(Math.log10(exact)) - 3);
    return Number((Math.ceil(exact / mag - 1e-9) * mag).toPrecision(6));
}

/**
 * The walk's events, in order, from the planner's steps: `{kind: 'spend', region, mana}` for every action in a Noiz2sa
 * region (a move out of it, a check in it), `{kind: 'region', region, cost, unreached}` when the planner prices a
 * Noiz2sa region and `{kind: 'location', location, region, cost, unreached}` when it prices a location of one
 * (`unreached`: by the defaults step, after the sphere entries).
 */
export function noiz2saWalkEvents(steps, { isNoiz2sa, regionOfLocation }) {
    const out = [];
    for (const step of steps ?? []) {
        const queue = step.queue ?? [];
        const unreached = step.phase === 'DEFAULTS';
        for (const q of queue) {
            if (q.type === 'move' && isNoiz2sa(q.from) && q.cost > 0) out.push({ kind: 'spend', region: q.from, mana: q.cost });
        }
        for (const ca of step.costAssignments ?? []) {
            if (ca.type === 'region' && isNoiz2sa(ca.name)) out.push({ kind: 'region', region: ca.name, cost: ca.cost, unreached });
            if (ca.type === 'location') {
                const region = regionOfLocation(ca.name);
                if (region && isNoiz2sa(region)) out.push({ kind: 'location', location: ca.name, region, cost: ca.cost, unreached });
            }
        }
        for (const q of queue) {
            if (q.type === 'locationCheck' && isNoiz2sa(q.region) && q.cost > 0) out.push({ kind: 'spend', region: q.region, mana: q.cost });
        }
    }
    return out;
}

/** the check span of a location: from `start`, the length whose expected mana at `rate` is closest to `cost` */
export function checkSpanFor(start, { rate, cost, skill }) {
    const a = sceneIndex(start);
    let best = null;
    for (let n = 1; a + n <= SCENE_TOTAL; n++) {
        const span = spanAt(a, n);
        const d = spanDifficulty(span, skill);
        const mana = rate * d.seconds;
        const miss = Math.abs(Math.log(Math.max(mana, 1e-9) / Math.max(cost, 1e-9)));
        if (!best || miss < best.miss - 1e-12) best = { span, p: d.p, seconds: d.seconds, mana, miss };
        if (mana > cost * 4) break; // E only grows with length here: past 4× nothing comes closer
    }
    return best;
}

/**
 * Price the Noiz2sa regions of a planned walk. → `{pointsPerMana, manaEnd, finalRegion, regions: [...], locations:
 * [...]}`; each region `{region, order, unreached, start, mana, skill, scenes, span, p, seconds, cost, rate, expected}`
 * (`order` its place in first-reach order, `mana` the Noiz2sa mana spent before it, `expected` = rate × seconds), each
 * location `{location, region, mana, skill, cost, span, p, seconds, expected}`.
 *
 * @param {object} args
 * @param {Array} args.steps          the planner's planned steps (`getPlannedSteps()` after `planAll()`)
 * @param {string|null} args.startRegion
 * @param {(r: string) => boolean} args.isNoiz2sa
 * @param {(l: string) => string|null} args.regionOfLocation
 * @param {string} [args.finalSpan]   the final region's span, e.g. "10:7–10:boss"
 * @param {number} [args.pointsPerMana] the pace; omitted, the one that reaches TARGET_FINAL_SKILL
 */
export function planNoiz2saPricing({
    steps, startRegion = null, isNoiz2sa, regionOfLocation, finalSpan = DEFAULT_FINAL_SPAN, pointsPerMana = null,
    prices = PRICING_STEP_PRICES,
}) {
    const final = parseSpan(finalSpan);
    const finalScenes = spanLength(final);
    const events = noiz2saWalkEvents(steps, { isNoiz2sa, regionOfLocation });
    const reachedEvents = events.filter((e) => !e.unreached);
    const manaEnd = reachedEvents.filter((e) => e.kind === 'spend').reduce((a, e) => a + e.mana, 0);
    const ppm = Number.isFinite(pointsPerMana) && pointsPerMana > 0 ? pointsPerMana : pointsPerManaFor(manaEnd, { prices });
    // the walk's first-reach order, then the regions only the defaults step prices (after the walk)
    const reachedOrder = [...new Set(events.filter((e) => e.kind === 'region' && e.region !== startRegion).map((e) => e.region))];
    const K = reachedOrder.length;
    const finalRegion = K ? reachedOrder[K - 1] : null;

    const regions = new Map();
    const locations = [];
    let mana = 0;
    const priceRegion = (name, cost, unreached) => {
        if (regions.has(name)) return;
        const skill = predictedSkill(mana, ppm, prices);
        const isStart = name === startRegion;
        const order = reachedOrder.indexOf(name);
        let pick;
        if (name === finalRegion) {
            pick = { span: final, ...spanDifficulty(final, skill) };
        } else {
            const n = isStart || K <= 1 ? 1 : Math.round(1 + (finalScenes - 1) * order / (K - 1));
            pick = pickSpan(n, skill);
        }
        const rate = isStart || !(cost > 0) ? null : Math.max(0.0001, round(cost / pick.seconds, 4));
        regions.set(name, {
            region: name, order, unreached: !!unreached, start: isStart, final: name === finalRegion, mana, skill,
            scenes: spanLength(pick.span), span: pick.span, p: pick.p, seconds: pick.seconds, cost, rate,
            expected: rate === null ? null : rate * pick.seconds,
        });
    };
    // the start region is never priced by a step (its cost is the free-to-leave rule): price its spans first
    if (startRegion && isNoiz2sa(startRegion)) priceRegion(startRegion, 0, false);
    for (const e of events) {
        if (e.kind === 'spend') { mana += e.unreached ? 0 : e.mana; continue; }
        if (e.kind === 'region') { priceRegion(e.region, e.cost, e.unreached); continue; }
        const r = regions.get(e.region);
        if (!r) continue; // its region is priced later (cannot happen with the planner's order; kept total)
        const skill = predictedSkill(mana, ppm, prices);
        const rate = r.rate ?? 1;
        const c = checkSpanFor(r.span.start, { rate, cost: e.cost, skill });
        locations.push({
            location: e.location, region: e.region, unreached: !!e.unreached, mana, skill, cost: e.cost,
            span: c.span, p: c.p, seconds: c.seconds, expected: c.mana,
        });
    }
    return { pointsPerMana: ppm, manaEnd, finalRegion, finalSpan: final, regions: [...regions.values()], locations };
}

/** the noiz2sa regions of a rules.json slot: region name → its sidecar (`preset_sidecars[pid][name]`) */
function noiz2saSidecars(rulesJson, playerId, substrateId) {
    const out = new Map();
    for (const [name, sc] of Object.entries(rulesJson?.preset_sidecars?.[playerId] ?? {})) {
        if (sc?.substrate === substrateId && sc.playable_payload) out.set(name, sc);
    }
    return out;
}

/**
 * Plan a rules.json's walk with the ONE cost model (the planner's defaults: those `generateLoopCosts` uses) and price
 * its Noiz2sa regions. → the plan, or null when the slot has no Noiz2sa region.
 */
export function planNoiz2saWorld({ rulesJson, sphereLog, playerId, finalSpan = DEFAULT_FINAL_SPAN, substrateId = 'noiz2sa' }) {
    const pid = String(playerId);
    const sidecars = noiz2saSidecars(rulesJson, pid, substrateId);
    if (sidecars.size === 0) return null;
    const topology = topologyFromRulesJson(rulesJson, pid);
    const planner = new CostPlanner({ topology, playerId: pid });
    planner.loadSphereLog(sphereLog ?? []);
    planner.planAll();
    return planNoiz2saPricing({
        steps: planner.getPlannedSteps(),
        startRegion: topology.startRegion,
        isNoiz2sa: (r) => sidecars.has(r),
        regionOfLocation: (l) => topology.locations.get(l)?.region ?? null,
        finalSpan,
    });
}

const plainSpan = (s) => ({ start: { ...s.start }, end: { ...s.end } });

/**
 * Write a plan into the payloads: each priced region's `move`, its priced locations' `check`, its
 * `timeDrainPerSecond` (not for a start region) and `pricing` (what the walk predicted, for the panel and the tests).
 * Mutates `rulesJson`. → the number of regions written.
 */
export function applyNoiz2saPricing(rulesJson, playerId, plan, { substrateId = 'noiz2sa' } = {}) {
    if (!plan) return 0;
    const sidecars = noiz2saSidecars(rulesJson, String(playerId), substrateId);
    const locsByRegion = new Map();
    for (const l of plan.locations) {
        if (!locsByRegion.has(l.region)) locsByRegion.set(l.region, []);
        locsByRegion.get(l.region).push(l);
    }
    let written = 0;
    for (const r of plan.regions) {
        const payload = sidecars.get(r.region)?.playable_payload;
        if (!payload) continue;
        const idOf = new Map(Object.entries(payload.ap_locations ?? {}).map(([id, name]) => [name, id]));
        const priced = new Map((locsByRegion.get(r.region) ?? []).map((l) => [idOf.get(l.location), l]));
        payload.move = plainSpan(r.span);
        if (Array.isArray(payload.locations)) {
            payload.locations = payload.locations.map((l) => (priced.has(l.id) ? { ...l, check: plainSpan(priced.get(l.id).span) } : l));
        }
        if (r.rate !== null) payload.timeDrainPerSecond = r.rate;
        else delete payload.timeDrainPerSecond;
        payload.pricing = {
            pointsPerMana: plan.pointsPerMana,
            mana: round(r.mana, 2),
            skill: round(r.skill, 2),
            p: round(r.p, 4),
            seconds: round(r.seconds, 2),
            cost: r.cost,
            final: r.final,
            reached: !r.unreached,
            locations: Object.fromEntries([...priced].filter(([id]) => id).map(([id, l]) => [id, {
                skill: round(l.skill, 2), p: round(l.p, 4), seconds: round(l.seconds, 2), cost: l.cost,
            }])),
        };
        written++;
    }
    return written;
}

/** the registry hook (`priceRegions`): plan and write a rules.json's Noiz2sa regions; → the plan (or null) */
export function priceNoiz2saRegions({ rulesJson, sphereLog, playerId, params = null }) {
    const finalSpan = typeof params?.[FINAL_SPAN_PARAM] === 'string' && params[FINAL_SPAN_PARAM].trim()
        ? params[FINAL_SPAN_PARAM] : DEFAULT_FINAL_SPAN;
    const plan = planNoiz2saWorld({ rulesJson, sphereLog, playerId, finalSpan });
    applyNoiz2saPricing(rulesJson, playerId, plan);
    return plan;
}

/** one line per priced region, for logs and the report */
export function describePricing(plan) {
    if (!plan) return ['no Noiz2sa region'];
    const lines = [`pointsPerMana ${plan.pointsPerMana} (Noiz2sa mana over the walk ${round(plan.manaEnd, 2)})`];
    for (const r of plan.regions) {
        lines.push(`${r.region}${r.final ? ' (final)' : ''}${r.unreached ? ' (unreached)' : ''}: mana ${round(r.mana, 1)} → skill ${round(r.skill, 1)}; `
            + `move ${showSpan(r.span)} (${r.scenes}) p ${round(r.p, 3)} E ${round(r.seconds, 1)} s; cost ${r.cost} → rate `
            + `${r.rate ?? '—'}/s, expected ${r.expected === null ? '—' : round(r.expected, 2)}`);
    }
    for (const l of plan.locations) {
        lines.push(`  ${l.location}: skill ${round(l.skill, 1)}; check ${showSpan(l.span)} p ${round(l.p, 3)} E ${round(l.seconds, 1)} s; `
            + `cost ${l.cost}, expected ${round(l.expected, 2)}`);
    }
    return lines;
}
