/**
 * procgenCore/fillRules — **THE FILL RULES, VERSION 1: ONE TABLE** (⛓ CONTENT
 * SETS PL-2; the shared task shape Z.6, ⚖ the user 2026-11-15 Z3: "the fill
 * rules, each with an id. Y's rules are version 1; the gap report names every
 * rule it used; the numbers are tuned once the bot can play the result").
 *
 * A fill rule supplies a part a pack does not state: a number (a time cost, a
 * minimum, a limit, an amount), a placement (`after`), or nothing at all but a
 * line in the gap report (W1, B1). Every rule has an id and a version; the gap
 * report names `<id>@<version>` (`ruleTag`), and a change to a rule's behaviour
 * BUMPS its version, so a regenerated world's report shows it.
 *
 * ⛔ STATED, NOT TUNED. Each rule computes what Z.6 states and nothing more.
 * Under Z7 ("numbers come from a simulated playthrough") their values are
 * STARTING POINTS: a substrate with a walk assigns over them.
 *
 * ⛓ WHICH RULES A SUBSTRATE APPLIES. Its registry entry lists them in
 * `fillRules` (ActionNodes since AN-1b; PL-2 kept that list here until the
 * entry's slice could take it); an entry that declares none applies none.
 * `fillRulesOf` REFUSES BY NAME a rule this table does not hold or one it lists
 * as `not-yet` (X1, X2, AN3).
 *
 * Pure and DOM-free: every `apply` takes plain numbers and ids.
 */

/** The status of a rule: built (version 1) or listed only. */
export const RULE_STATUS = Object.freeze({ BUILT: 'built', NOT_YET: 'not-yet' });

export class FillRuleError extends Error {
    constructor(message) {
        super(`fill rules: ${message}`);
        this.name = 'FillRuleError';
    }
}

const fail = (m) => { throw new FillRuleError(m); };
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const need = (rule, name, v, test = finite) => { if (!test(v)) fail(`${rule}: ${name} ${JSON.stringify(v)} is not usable`); return v; };

/* ── The rules (Z.6, version 1) ─────────────────────────────────────────── */

/** P1 — a task with no place: at the start (ActionNodes: the use-item tree, `after` the start node). */
function p1({ startId }) {
    need('P1', 'startId', startId, (v) => typeof v === 'string' && v.length > 0);
    return [[startId]];
}

/** T1 — the time-cost share of the loop's starting clock, in the receiving game: cost ÷ source start × receiving start. */
function t1Share({ cost, sourceStart }) {
    need('T1', 'cost', cost);
    need('T1', 'sourceStart', sourceStart, (v) => finite(v) && v > 0);
    return cost / sourceStart;
}
function t1({ cost, sourceStart, receivingStart }) {
    need('T1', 'receivingStart', receivingStart, (v) => finite(v) && v > 0);
    return Math.round(t1Share({ cost, sourceStart }) * receivingStart);
}

/**
 * R1 — the stat minimum for the stats a task trains: the smallest level, the same for each trained stat, at which
 * cost × limit fits the starting clock. `costAt(level)` is the task's cost at that level of its trained stats (the
 * game's own curve); levels run 0 … `maxLevel`. Null when no level fits.
 */
function r1({ costAt, limit, startClock, maxLevel }) {
    need('R1', 'costAt', costAt, (v) => typeof v === 'function');
    need('R1', 'limit', limit, (v) => finite(v) && v >= 1);
    need('R1', 'startClock', startClock, (v) => finite(v) && v > 0);
    need('R1', 'maxLevel', maxLevel, (v) => Number.isInteger(v) && v >= 0);
    for (let level = 0; level <= maxLevel; level++) if (costAt(level) * limit <= startClock) return level;
    return null;
}

/**
 * R2 — a stated stat minimum the game cannot enforce: `after` the task that owns the stat, else the same-place task
 * that gives the most of it. The number itself is LISTED (the caller reports it). `givers` is
 * `[{ task, gives }]` of the same place. Returns `{ after: [[task]] }`, or null when nothing gives it.
 */
function r2({ owner = null, givers = [] }) {
    if (owner) return { after: [[owner]] };
    let best = null;
    for (const g of givers) if (best === null || g.gives > best.gives) best = g;
    return best ? { after: [[best.task]] } : null;
}

/** R3 — a resource requirement the game cannot enforce: `after` the first same-place task that gives it. */
function r3({ givers = [] }) {
    return givers.length ? { after: [[givers[0]]] } : null;
}

/**
 * R4 — a minimum on a sum of k stats: each stat ≥ sum ÷ k (rounded up, so the k minimums together reach the sum).
 * Alternative sets a game cannot hold → the first set (`firstSet`).
 */
function r4({ sum, stats }) {
    need('R4', 'sum', sum, (v) => finite(v) && v >= 0);
    need('R4', 'stats', stats, (v) => Array.isArray(v) && v.length > 0);
    const each = Math.ceil(sum / stats.length);
    return Object.fromEntries(stats.map((s) => [s, each]));
}
const firstSet = (sets) => (Array.isArray(sets) && sets.length ? [sets[0]] : sets);

/**
 * L1 — a missing limit: max(1, ⌊starting clock ÷ time at level 0⌋). A growing limit takes its value at the stat's
 * maximum (`timeAtMax` when the game's curve gives one; else the level-0 time). A time of 0 fits any number of
 * performances; the limit is then 1 (stated: no clock bounds it, so the rule does not invent one).
 */
function l1({ startClock, time, timeAtMax = undefined }) {
    need('L1', 'startClock', startClock, (v) => finite(v) && v > 0);
    const t = timeAtMax ?? time;
    need('L1', 'time', t, (v) => finite(v) && v >= 0);
    if (t === 0) return 1;
    return Math.max(1, Math.floor(startClock / t));
}

/** L2 — a use-item task's limit: the number held (at least 1, so the task can be performed once it is held). */
function l2({ held }) {
    need('L2', 'held', held, (v) => finite(v) && v >= 0);
    return Math.max(1, held);
}

/** W1 — a missing word: listed, never written. The entry is shown by its id. */
const w1 = ({ id }) => id;

/** B1 — a boon with no home in the game: listed. */
const b1 = () => null;

/**
 * AN1 — an ActionNodes node's stat minimum: the sum of that stat's gains from the node's `after` ancestors, each
 * ancestor's per-performance gain × its limit. `ancestors` is `[{ gain, limit }]`.
 */
function an1({ ancestors }) {
    need('AN1', 'ancestors', ancestors, Array.isArray);
    return ancestors.reduce((sum, a) => sum + need('AN1', 'gain', a.gain) * need('AN1', 'limit', a.limit), 0);
}

/**
 * AN2 — an ActionNodes stat result: a whole +k per performance, k = round(weight × rate × T1 share × 10), at least 1.
 * `weight` is the stat's share of the task's training (1 ÷ the number of stats it trains when the pack states none);
 * `rate` the game's training rate (1 when its economy states none); `share` the task's T1 share of the loop.
 */
function an2({ weight, rate = 1, share }) {
    need('AN2', 'weight', weight, (v) => finite(v) && v >= 0);
    need('AN2', 'rate', rate, (v) => finite(v) && v >= 0);
    need('AN2', 'share', share, (v) => finite(v) && v >= 0);
    return Math.max(1, Math.round(weight * rate * share * 10));
}

/**
 * AN-flat — the forms ActionNodes v1 does not hold, flattened. `form` names which:
 *   `growing-limit`        → one number (L1, at the stat's maximum): the caller applies L1
 *   `result-when`          → `each`; except `opens`, which A16 already ties to the last performance (kept as is)
 *   `modifies`             → dropped (folded into the target's number when the numbers state one)
 *   `alternative-requires` → the first set
 *   `multipart`            → one performance per segment: the limit is the segment count
 * Every use is listed by the caller.
 */
const AN_FLAT_FORMS = Object.freeze(['growing-limit', 'result-when', 'modifies', 'alternative-requires', 'multipart']);
function anFlat({ form, value }) {
    if (!AN_FLAT_FORMS.includes(form)) fail(`AN-flat: form ${JSON.stringify(form)} is not one of ${AN_FLAT_FORMS.join(', ')}`);
    switch (form) {
        case 'result-when': return value?.opens !== undefined ? value.when : 'each';
        case 'alternative-requires': return firstSet(value);
        case 'multipart': return need('AN-flat', 'segments', value, (v) => Number.isInteger(v) && v >= 1);
        case 'modifies': return null;
        default: return value;
    }
}

const notYet = (id) => () => fail(`rule ${id} is listed as not yet built (Z.6 names it; no slice has written it)`);

/** One row per rule: `{ id, version, status, fills, how, apply }`. */
const row = (id, version, fills, how, apply, status = RULE_STATUS.BUILT) => Object.freeze({ id, version, status, fills, how, apply });

/**
 * ⛓ **THE TABLE** (Z.6, version 1). `fills` and `how` are Z.6's words; `apply` is the stated computation.
 */
export const FILL_RULES = Object.freeze({
    P1: row('P1', 1, 'a task with no place', 'at the start (ActionNodes: the use-item tree)', p1),
    T1: row('T1', 1, 'time cost in another game\'s clock', 'as a share of the loop\'s starting clock: cost ÷ source start × receiving start', t1),
    R1: row('R1', 1, 'the stat minimum for stats a task trains', 'the smallest level, the same for each trained stat, at which cost × limit fits the starting clock', r1),
    R2: row('R2', 1, 'a stated minimum a game cannot enforce', '`after` the task that owns the stat, or the same-place task that gives the most of it; the number is listed', r2),
    R3: row('R3', 1, 'a resource requirement a game cannot enforce', '`after` the first same-place task that gives the resource', r3),
    R4: row('R4', 1, 'a minimum on a sum of k stats', 'each stat ≥ sum ÷ k; alternatives a game cannot hold → the first set', r4),
    X1: row('X1', 1, 'stat lists from a weighted to an unweighted game', 'keep weights ≥ 0.3, through one stat table per pair of stat sets', notYet('X1'), RULE_STATUS.NOT_YET),
    X2: row('X2', 1, 'stat lists from an unweighted to a weighted game', 'equal weights', notYet('X2'), RULE_STATUS.NOT_YET),
    L1: row('L1', 1, 'a missing limit', 'max(1, ⌊starting clock ÷ time at level 0⌋); a growing limit takes its value at the stat\'s maximum', l1),
    L2: row('L2', 1, 'a use-item task\'s limit', 'the number held', l2),
    W1: row('W1', 1, 'a missing word', 'listed, never written', w1),
    B1: row('B1', 1, 'a boon with no home in the game', 'listed', b1),
    AN1: row('AN1', 1, 'an ActionNodes node\'s stat minimum', 'the sum of that stat\'s gains from the node\'s `after` ancestors', an1),
    AN2: row('AN2', 1, 'an ActionNodes stat result', 'a whole +k per performance: k = round(weight × rate × T1 share × 10), at least 1', an2),
    AN3: row('AN3', 1, 'a minimum that builds up over many loops', 'a boost item earned at a check', notYet('AN3'), RULE_STATUS.NOT_YET),
    'AN-flat': row('AN-flat', 1, 'forms ActionNodes v1 does not hold',
        'a growing limit → one number (L1); a `last` or `every_nth` result → `each`, except `opens`; a `modifies` → folded or dropped; alternative requirement sets → the first set; a multipart action → one performance per segment', anFlat),
});

/** The helpers some rules share (T1's share is AN2's input; R4's first set is AN-flat's). */
export const RULE_HELPERS = Object.freeze({ t1Share, firstSet, AN_FLAT_FORMS });

/** `<id>@<version>`: how the gap report names a rule. */
export function ruleTag(id) {
    const r = FILL_RULES[id];
    if (!r) fail(`no rule "${id}" (${Object.keys(FILL_RULES).join(', ')})`);
    return `${r.id}@${r.version}`;
}

/** The rule `id`, refused by name when the table does not hold it or lists it as not yet built. */
export function fillRule(id) {
    const r = FILL_RULES[id];
    if (!r) fail(`no rule "${id}" (${Object.keys(FILL_RULES).join(', ')})`);
    if (r.status !== RULE_STATUS.BUILT) fail(`rule ${id} is listed as not yet built (Z.6 names it; no slice has written it)`);
    return r;
}

/** The registry field a substrate entry lists its rules in. */
export const FILL_RULES_FIELD = 'fillRules';

/**
 * ⛓ **THE RULES A SUBSTRATE APPLIES** — its entry's `fillRules`, else none.
 * Every id is checked: an unknown one, or one the table lists as not yet built (X1, X2, AN3), is REFUSED BY NAME,
 * naming the substrate. Returns a frozen list of ids.
 */
export function fillRulesOf(entry, substrateId = entry?.id) {
    const declared = entry?.[FILL_RULES_FIELD];
    const list = declared ?? [];
    if (!Array.isArray(list)) fail(`substrate "${substrateId}": ${FILL_RULES_FIELD} must be a list of rule ids`);
    for (const id of list) {
        const r = FILL_RULES[id];
        if (!r) fail(`substrate "${substrateId}" asks for rule "${id}", which the table does not hold (${Object.keys(FILL_RULES).join(', ')})`);
        if (r.status !== RULE_STATUS.BUILT) fail(`substrate "${substrateId}" asks for rule ${id}, which the table lists as not yet built`);
    }
    return Object.freeze([...list]);
}
