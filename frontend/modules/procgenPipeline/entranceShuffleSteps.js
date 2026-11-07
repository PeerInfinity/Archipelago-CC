// Shared step-runner for the stepped ENTRANCE-SHUFFLE pipeline (ENTRANCE RANDOMIZATION E4b, the ER plan §3.3).
//
// The fifth pipeline mode, `entranceShuffle`: a content source's AUTHORED graph (an atlas), its doorways classified by
// the SUBSTRATE (never here), shuffled by the GER port (`procgenCore/entranceRandomizer.js`, E3) over the production
// reach (`entranceRandomizationReach.js`, E4a), and compiled back through the substrate's own producer:
//
//   ① pool      — `hooks.pool({atlasId})` → `{atlas}`: the authored graph. rng-free.
//   ② classify  — `hooks.classify(atlas)` → `{doorways, target_group_lookup, pinned, outOfScope}` (§3.5): every doorway the
//                 shuffle may move, each `{id, group, type, from, arrival, reverse, pinned}` — `from` the atlas endpoint
//                 that departs, `arrival` the endpoint a door placed AT it lands on (beside it). The mode checks the
//                 classification's shape (coupled reverses, mutual, groups in the lookup) and refuses it by name.
//   ③ shuffle   — `randomizeEntrances` over the VANILLA compile (`hooks.compile(atlas)`), every unpinned doorway named
//                 by the AP exit that carries it (`apExitNamesByEndpoint`, the compiled doc's own record). Draw `k` takes
//                 its own rng (`drawSeed(seed, k)`); an `EntranceRandomizationError` is counted and the next draw taken.
//   ④ compile   — the placements onto the atlas's connections (E1's design note: D placed at E lands on E's `arrival`,
//                 the existing arrival exit beside E, so every room keeps its landing tiles), the substrate's producer
//                 over that doc (`hooks.compile(atlas, {moved})`), then `er` on every classified exit and the
//                 `entrance_randomization[p]` block. The compiled doc must pass E2's validator (a refusal there is a
//                 defect, thrown). A layout NOT BEATABLE under its own compiled rules (the sphere walk collects every
//                 location and the goal) or refused by the substrate's `hooks.checks` is REJECTED and the next draw
//                 taken (back through ③); every rejection is counted and named in `compile.attempts`.
//
// ⛔ THE MODE NEVER NAMES A SUBSTRATE. The hooks arrive in the runner's `opts.hooks`; `entranceShuffleHooksFor(atlasId)`
// resolves them from the substrate registry (the entry whose `entranceShuffle.atlasIds` holds the atlas). The hooks are
// NODE-side for Seedling (its producer reads the map from disk), so this mode runs headless: `runPresetHeadless`, the
// `scripts/procgen/entrance-step.js` CLI, and `scripts/procgen/make-seedling-er-preset.mjs`.
//
// ⛔ VANILLA IS UNTOUCHED: nothing here writes a file; the vanilla compile is the producer's, byte for byte.

import { randomizeEntrances, EntranceRandomizationError } from '../procgenCore/entranceRandomizer.js';
import { entranceRandomizationProblems } from '../procgenCore/entranceRandomizationCheck.js';
import { rngFor, SEED_MAX } from '../mazeRoom/procgenRng.js';
import { generateSphereLog } from '../shared/procgen/forwardSimulator.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { makeRulesDocReach, apExitNamesByEndpoint } from './entranceRandomizationReach.js';
import { stampAtlasIdentity } from './regionAtlasValidator.js';
import {
    runStep as runStepGeneric,
    runToStep as runToStepGeneric,
    detectCompleted as detectCompletedGeneric,
    newEnvelope as newEnvelopeGeneric,
    FIELD_VISIBILITY,
    envelopeSchema,
} from './steppedPipeline.js';

/** Step names in run order; index === the `completed` value the step yields. */
export const ENTRANCE_STEPS = Object.freeze(['pool', 'classify', 'shuffle', 'compile']);

/** The player the mode shuffles (a single-slot compile, as every producer it drives). */
export const ER_PLAYER = '1';

/**
 * The reach's inventory (`makeRulesDocReach` `sweep`): `'placed'` — the starting items, then every reached location's own
 * (vanilla) item — because ⚖ Q4 holds the items vanilla and no fill runs after the shuffle (see the binding's docblock).
 */
export const ER_SWEEP = 'placed';

/** The draws a run may take before it refuses (shuffle refusals and rejected layouts together). */
export const DEFAULT_MAX_ATTEMPTS = 50;

/**
 * Draw `k`'s rng seed: draw 0 IS the run's seed; draw k > 0 mixes `k` in (golden-ratio stride, Knuth), so a retry is a
 * deterministic function of `(seed, k)` and an envelope resumes from its attempt index alone.
 */
export function drawSeed(seed, k) {
    if (k === 0) return seed;
    return Number((BigInt(seed) + BigInt(k) * 2654435761n) % BigInt(SEED_MAX + 1));
}

/** The registry hook for an atlas: `{entry, hooks: () => Promise<hooks>}`, or a refusal naming who declares what. */
export function entranceShuffleHooksFor(atlasId, registry = substrateRegistry) {
    const entries = registry.getAll().filter((e) => e?.entranceShuffle);
    const owner = entries.filter((e) => (e.entranceShuffle.atlasIds ?? []).includes(atlasId));
    if (owner.length !== 1) {
        throw new Error(`entranceShuffle: ${owner.length === 0 ? 'no' : owner.length} registered substrate(s) declare `
            + `entranceShuffle for atlas ${JSON.stringify(atlasId)} (declared: ${entries.map((e) => `${e.id} [${(e.entranceShuffle.atlasIds ?? []).join(', ')}]`).join('; ') || 'none'})`);
    }
    return { entry: owner[0], load: () => owner[0].entranceShuffle.loadHooks() };
}

// ── ② the classification's generic shape ────────────────────────────────

/** Refusals of a classification's shape, as sentences (empty: clean). */
export function classificationProblems(c) {
    const out = [];
    const byId = new Map();
    for (const d of c.doorways ?? []) {
        if (byId.has(d.id)) out.push(`doorway ${d.id} is classified twice`);
        byId.set(d.id, d);
    }
    const groups = new Set(Object.keys(c.target_group_lookup ?? {}));
    for (const d of byId.values()) {
        if (d.type !== 'two_way') out.push(`${d.id}: type ${JSON.stringify(d.type)} — v1 is coupled two-way only (⚖ Q2)`);
        if (!groups.has(d.group)) out.push(`${d.id}: group ${JSON.stringify(d.group)} has no target_group_lookup row`);
        if (d.pinned) continue;
        const r = byId.get(d.reverse);
        if (!r) { out.push(`${d.id}: its reverse ${JSON.stringify(d.reverse)} is not a classified doorway`); continue; }
        if (r.reverse !== d.id) out.push(`${d.id}: its reverse ${r.id} names ${JSON.stringify(r.reverse)} back`);
        if (r.pinned) out.push(`${d.id} moves but its reverse ${r.id} is pinned (⚖ Q2: a pair moves together)`);
        if (!Array.isArray(d.arrival) || !Array.isArray(d.from)) out.push(`${d.id}: no from/arrival endpoint`);
    }
    for (const p of c.pinned ?? []) {
        if (!byId.get(p.doorway)?.pinned) out.push(`pin ${p.doorway} (${p.rule}) names no pinned classified doorway`);
        if (!p.rule || !p.why) out.push(`pin ${p.doorway} has no rule/why`);
    }
    return out;
}

// ── ③ the shuffle's binding over the vanilla compile ─────────────────────

const key = (end) => `${end[0]}/${end[1]}`;

/**
 * The E3 inputs over the vanilla compile: every unpinned doorway is an exit AND a target named by its vanilla AP exit,
 * in its AP region. Returns `{exits, targets, fixedEdges, progressionRegions, reach, byName}`.
 */
export function shuffleBinding(vanillaRules, classification, { sweep = ER_SWEEP } = {}) {
    const names = apExitNamesByEndpoint(vanillaRules, ER_PLAYER);
    const R = vanillaRules.regions[ER_PLAYER];
    const regionOfExit = new Map();
    for (const [region, r] of Object.entries(R)) for (const e of r.exits ?? []) regionOfExit.set(e.name, { region, exit: e });
    const rows = [];
    for (const d of classification.doorways) {
        if (d.pinned) continue;
        const name = names.get(key(d.from));
        if (!name) throw new Error(`entranceShuffle: ${d.id}'s endpoint ${key(d.from)} compiled to no AP exit`);
        const at = regionOfExit.get(name);
        if (!at) throw new Error(`entranceShuffle: ${d.id}'s AP exit ${name} is in no region`);
        rows.push({ doorway: d, name, region: at.region, access_rule: at.exit.access_rule ?? { rule: 'True_' } });
    }
    const byName = new Map(rows.map((r) => [r.name, r]));
    const removed = new Set(rows.map((r) => `${r.region}|${r.name}`));
    const fixedEdges = [];
    const progressionRegions = new Set();
    for (const [name, region] of Object.entries(R)) {
        for (const e of region.exits ?? []) if (!removed.has(`${name}|${e.name}`)) fixedEdges.push({ from: name, to: e.connected_region });
        if ((region.locations ?? []).some((l) => l.item?.advancement === true)) progressionRegions.add(name);
    }
    const ends = rows.map((r) => ({ name: r.name, region: r.region, type: r.doorway.type, group: r.doorway.group }));
    const reach = makeRulesDocReach(vanillaRules, {
        shuffled: rows.map((r) => ({ name: r.name, region: r.region, access_rule: r.access_rule, carrier: r.name })),
        playerId: ER_PLAYER,
        sweep,
    });
    const lookup = new Map(Object.entries(classification.target_group_lookup));
    return { exits: ends, targets: ends.map((e) => ({ ...e })), fixedEdges, progressionRegions, reach, byName, lookup };
}

/** Draws from `from` until one places; refusals are recorded. Returns `{attempt, placements}` (doorway ids) or throws. */
function drawPlacements(env, binding, from, max) {
    for (let k = from; k < max; k += 1) {
        try {
            const res = randomizeEntrances({
                exits: binding.exits, targets: binding.targets, fixedEdges: binding.fixedEdges,
                progressionRegions: binding.progressionRegions, reach: binding.reach, rng: rngFor(drawSeed(env.seed, k)),
                coupled: true, targetGroupLookup: binding.lookup,
            });
            const placements = res.placements.map((p) => ({ exit: binding.byName.get(p.exit).doorway.id, target: binding.byName.get(p.target).doorway.id }));
            return { attempt: k, placements };
        } catch (err) {
            if (!(err instanceof EntranceRandomizationError)) throw err;
            env.attempts.push({ attempt: k, verdict: 'shuffle-refused', why: err.message });
        }
    }
    throw new Error(`entranceShuffle: no layout in ${max} draws (${env.attempts.length} refused/rejected): `
        + `${env.attempts.slice(-3).map((a) => `#${a.attempt} ${a.verdict}: ${a.why}`).join('; ')}`);
}

// ── ④ placements → the doc, and the doc's checks ─────────────────────────

/**
 * The placements onto a COPY of the atlas: D placed at E → D's connection lands on E's `arrival` (E1's design note).
 * Returns `{atlas, moved}` (`moved`: `"<region>/<exit>"` of every doorway placed elsewhere than its vanilla reverse).
 * A layout that moves anything is a DIFFERENT document, so it is RESTAMPED (`stampAtlasIdentity`: a new content hash and
 * `atlas_id`, the same base) — the compiled doc's `region_atlas`/`atlas_ref` name the shuffled graph, and the block's
 * `source.atlas_id` names the authored one it was shuffled from. An identity layout keeps the authored id.
 */
export function applyPlacements(atlas, classification, placements) {
    const byId = new Map(classification.doorways.map((d) => [d.id, d]));
    const doc = structuredClone(atlas);
    const conns = new Map(doc.vanilla_layout.connections.map((c) => [key(c.from), c]));
    const moved = new Set();
    for (const p of placements) {
        const D = byId.get(p.exit);
        const E = byId.get(p.target);
        if (!D || !E || D.pinned || E.pinned) throw new Error(`entranceShuffle: placement ${JSON.stringify(p)} names a pinned or unclassified doorway`);
        conns.get(key(D.from)).to = [...E.arrival];
        if (E.id !== D.reverse) moved.add(key(D.from));
    }
    if (moved.size) stampAtlasIdentity(doc);
    return { atlas: doc, moved };
}

/** LANDING-SET: the shuffled connections land on exactly the vanilla arrivals, each as often (a coupled shuffle permutes them). */
export function landingSetProblems(vanillaAtlas, shuffledAtlas) {
    const count = (a) => {
        const m = new Map();
        for (const c of a.vanilla_layout.connections) m.set(key(c.to), (m.get(key(c.to)) ?? 0) + 1);
        return m;
    };
    const v = count(vanillaAtlas);
    const s = count(shuffledAtlas);
    const out = [];
    for (const k of new Set([...v.keys(), ...s.keys()])) {
        if ((v.get(k) ?? 0) !== (s.get(k) ?? 0)) out.push(`${k} is landed on ${s.get(k) ?? 0}× (vanilla ${v.get(k) ?? 0}×)`);
    }
    return out;
}

/** `er` on every classified exit and the slot's block, in place. Returns the block. */
export function annotateEntranceRandomization(rules, classification, placements, { seed, atlasId }) {
    const names = apExitNamesByEndpoint(rules, ER_PLAYER);
    const byId = new Map(classification.doorways.map((d) => [d.id, d]));
    const nameOf = (id) => {
        const n = names.get(key(byId.get(id).from));
        if (!n) throw new Error(`entranceShuffle: ${id} compiled to no AP exit`);
        return n;
    };
    const exitByName = new Map();
    for (const r of Object.values(rules.regions[ER_PLAYER])) for (const e of r.exits ?? []) exitByName.set(e.name, e);
    for (const d of classification.doorways) {
        const e = exitByName.get(nameOf(d.id));
        e.er = { group: d.group, type: d.type, ...(d.reverse ? { reverse: nameOf(d.reverse) } : {}), shuffle: !d.pinned };
    }
    const block = {
        algorithm: 'ger', coupled: true, target_group_lookup: structuredClone(classification.target_group_lookup), seed,
        source: { atlas_id: atlasId }, placements: placements.map((p) => ({ exit: nameOf(p.exit), target: nameOf(p.target) })),
    };
    rules.entrance_randomization = { ...(rules.entrance_randomization ?? {}), [ER_PLAYER]: block };
    return block;
}

/**
 * BEATABLE under its OWN compiled rules: the sphere walk (`generateSphereLog`, the walk every preset's log is) collects
 * every location and the completion item. Returns `{ok, why, spheres, log}`.
 */
export function beatability(rules) {
    let log;
    try {
        log = generateSphereLog(rules, { playerId: Number(ER_PLAYER) });
    } catch (err) {
        return { ok: false, why: `the sphere walk refused: ${err.message}` };
    }
    const states = log.filter((e) => e.type === 'state_update');
    const got = new Set(states.flatMap((e) => e.player_data?.[ER_PLAYER]?.sphere_locations ?? []));
    const all = Object.values(rules.regions[ER_PLAYER]).flatMap((r) => (r.locations ?? []).map((l) => l.name));
    const missing = all.filter((n) => !got.has(n));
    const goal = rules.game_info?.[ER_PLAYER]?.completion_condition;
    const items = new Set(states.flatMap((e) => Object.keys(e.player_data?.[ER_PLAYER]?.new_inventory_details?.base_items ?? {})));
    const goalOk = goal?.type !== 'item_check' || items.has(goal.item);
    if (missing.length || !goalOk) {
        return { ok: false, why: `${missing.length} location(s) never collected${missing.length ? ` (${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''})` : ''}${goalOk ? '' : `; the goal item ${goal.item} never collected`}`, log };
    }
    return { ok: true, spheres: states.length, log };
}

// ── the runners ─────────────────────────────────────────────────────────

const needHooks = (opts) => {
    if (!opts?.hooks) throw new Error('entranceShuffle: the runner needs opts.hooks (entranceShuffleHooksFor(atlasId).load())');
    return opts.hooks;
};

const RUNNERS = {
    pool: async (env, opts) => {
        const { atlas } = await needHooks(opts).pool({ atlasId: env.source.atlasId });
        if (atlas?.atlas_id !== env.source.atlasId) {
            throw new Error(`entranceShuffle: the pool hook returned atlas ${atlas?.atlas_id}, not ${env.source.atlasId}`);
        }
        env.pool = { atlas };
        env.completed = 0;
        return env;
    },
    classify: async (env, opts) => {
        const c = await needHooks(opts).classify(env.pool.atlas);
        const problems = classificationProblems(c);
        if (problems.length) throw new Error(`entranceShuffle: the classification is refused: ${problems.join('; ')}`);
        env.classify = c;
        env.completed = 1;
        return env;
    },
    shuffle: async (env, opts) => {
        const hooks = needHooks(opts);
        if (!env.vanilla) env.vanilla = { rules: (await hooks.compile(env.pool.atlas, { moved: new Set() })).rules };
        const binding = shuffleBinding(env.vanilla.rules, env.classify, { sweep: env.sweep ?? ER_SWEEP });
        const from = env.shuffle ? env.shuffle.attempt + 1 : 0;
        env.shuffle = drawPlacements(env, binding, from, env.maxAttempts);
        env._binding = binding;
        env.completed = 2;
        return env;
    },
    compile: async (env, opts) => {
        const hooks = needHooks(opts);
        for (;;) {
            const { attempt, placements } = env.shuffle;
            const { atlas, moved } = applyPlacements(env.pool.atlas, env.classify, placements);
            const landing = landingSetProblems(env.pool.atlas, atlas);
            if (landing.length) throw new Error(`entranceShuffle: LANDING-SET broken by draw ${attempt}: ${landing.join('; ')}`);
            const out = await hooks.compile(atlas, { moved });
            const { rules } = out;
            const block = annotateEntranceRandomization(rules, env.classify, placements, { seed: env.seed, atlasId: env.source.atlasId });
            const problems = entranceRandomizationProblems(rules, ER_PLAYER);
            if (problems.length) throw new Error(`entranceShuffle: the compiled doc fails E2's validator: ${problems.join('; ')}`);
            const beat = beatability(rules);
            const refused = beat.ok ? (await hooks.checks?.(rules, { vanilla: env.vanilla.rules, atlas, classification: env.classify, moved, placements, log: beat.log })) ?? [] : [];
            if (beat.ok && refused.length === 0) {
                env.attempts.push({ attempt, verdict: 'accepted' });
                env.compile = { rulesJson: rules, block, moved: [...moved].sort(), spheres: beat.spheres, attempts: summarizeAttempts(env.attempts), notes: out.notes ?? [] };
                env.completed = 3;
                return env;
            }
            env.attempts.push({ attempt, verdict: beat.ok ? 'rejected-check' : 'rejected-unbeatable', why: beat.ok ? refused.join('; ') : beat.why });
            env.shuffle = drawPlacements(env, env._binding ?? shuffleBinding(env.vanilla.rules, env.classify, { sweep: env.sweep ?? ER_SWEEP }), attempt + 1, env.maxAttempts);
        }
    },
};

/** `{draws, accepted, shuffleRefused, rejectedUnbeatable, rejectedCheck, log}` — what the run's draws came to. */
export function summarizeAttempts(attempts) {
    const n = (v) => attempts.filter((a) => a.verdict === v).length;
    return {
        draws: attempts.length, accepted: n('accepted'), shuffleRefused: n('shuffle-refused'),
        rejectedUnbeatable: n('rejected-unbeatable'), rejectedCheck: n('rejected-check'), log: attempts.map((a) => ({ ...a })),
    };
}

const PRESENT = {
    pool: (e) => !!e.pool,
    classify: (e) => !!e.classify,
    shuffle: (e) => !!e.shuffle,
    compile: (e) => !!e.compile,
};

export const ENTRANCE_ENVELOPE_FIELDS = Object.freeze({
    source: { type: 'object', visibility: FIELD_VISIBILITY.PUBLIC, step: null, required: true, about: 'The content source: {atlasId}, the authored graph the shuffle runs over.' },
    seed: { type: 'integer', visibility: FIELD_VISIBILITY.PUBLIC, step: null, required: true, about: 'The shuffle seed; draw k takes drawSeed(seed, k).' },
    maxAttempts: { type: 'integer', visibility: FIELD_VISIBILITY.PUBLIC, step: null, required: true, about: 'The draws a run may take (refusals and rejections together).' },
    sweep: { type: 'string', visibility: FIELD_VISIBILITY.PUBLIC, step: null, about: 'The reach\'s inventory: \'placed\' (default, vanilla items) or \'events\' (GER\'s all-state).' },
    completed: { type: 'integer', visibility: FIELD_VISIBILITY.PUBLIC, step: null, required: true, about: 'Index into ENTRANCE_STEPS of the last step run; -1 = none.' },
    attempts: { type: 'array', visibility: FIELD_VISIBILITY.PUBLIC, step: null, about: 'Every draw: {attempt, verdict, why?} (accepted / shuffle-refused / rejected-unbeatable / rejected-check).' },
    pool: { type: 'object', visibility: FIELD_VISIBILITY.INTERNAL, step: 'pool', about: 'The authored atlas.' },
    classify: { type: 'object', visibility: FIELD_VISIBILITY.PUBLIC, step: 'classify', about: 'The substrate classifier\'s answer: doorways, target_group_lookup, pinned (each with its rule), outOfScope.' },
    vanilla: { type: 'object', visibility: FIELD_VISIBILITY.INTERNAL, step: 'shuffle', about: 'The vanilla compile the shuffle binds its reach over.' },
    _binding: { type: 'object', visibility: FIELD_VISIBILITY.INTERNAL, step: 'shuffle', about: 'The live E3 binding (session only).' },
    shuffle: { type: 'object', visibility: FIELD_VISIBILITY.PUBLIC, step: 'shuffle', about: 'The current draw: {attempt, placements: [{exit, target}] by doorway id}.' },
    compile: { type: 'object', visibility: FIELD_VISIBILITY.PUBLIC, step: 'compile', about: 'The accepted layout: rulesJson, its entrance_randomization block, moved exits, sphere count, attempts summary.' },
});

const DESCRIPTOR = {
    kind: 'entrance-envelope',
    steps: ENTRANCE_STEPS,
    runners: RUNNERS,
    present: PRESENT,
    codecs: {},
    nextStep: (env) => (env.completed < ENTRANCE_STEPS.length - 1 ? ENTRANCE_STEPS[env.completed + 1] : null),
    fields: ENTRANCE_ENVELOPE_FIELDS,
};

/** The JSON Schema of a serialized envelope of this mode (from its `fields`). */
export const entranceEnvelopeSchema = () => envelopeSchema(DESCRIPTOR);

/** A fresh envelope for `{atlasId, seed, maxAttempts?}`. */
export function newEntranceEnvelope({ atlasId, seed, maxAttempts = DEFAULT_MAX_ATTEMPTS, sweep = ER_SWEEP }) {
    if (typeof atlasId !== 'string' || !atlasId) throw new Error('entranceShuffle: the run names no atlasId');
    if (!Number.isInteger(seed)) throw new Error(`entranceShuffle: seed ${JSON.stringify(seed)} is not an integer`);
    return newEnvelopeGeneric({ source: { atlasId }, seed, maxAttempts, sweep, attempts: [] });
}

/** Run a single named step (`opts.hooks` required). */
export async function runEntranceStep(stepName, env, opts = {}) {
    return runStepGeneric(stepName, env, opts, DESCRIPTOR);
}

/** Run steps from the current point through `toStep` (default: to completion). */
export async function runEntranceToStep(env, toStep = 'compile', opts = {}) {
    return runToStepGeneric(env, toStep, opts, DESCRIPTOR);
}

/** The `completed` index from data presence. */
export function detectEntranceCompleted(env) {
    return detectCompletedGeneric(env, DESCRIPTOR);
}
