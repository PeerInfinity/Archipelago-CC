/**
 * ⛓⛓ SEEDLING HAMMER-PHASE SIBLING-EXIT — **THE ROUTE'S EXIT, OR AN AP-EQUIVALENT SIBLING OF IT** (switch
 * `SIBLING_EXIT_CHOICE`, OFF; `SEEDLING_SIBLING_EXIT_CHOICE=1` turns it on). ⚖ The user, 2026-11-22: *"Launch it now
 * (Recommended)"*; ⚖ no-hit logic: a plan that tanks a hit does not ship.
 *
 * MEASURED (`CC/docs/cloud-reports/seedling-hammer-lookahead.md`): the route names ONE exit, and a room can hold several
 * exits AP cannot tell apart — the same source region, the same `connected_region`, the same rule. The L16 pit is seven
 * (`level_16__r1c9 -> level_17`, `#2` … `#7`, one tile each, rule `True_`); the route always names the first, whose fall
 * lands on a bob (1 hit inside the leg's own plan), while four of its siblings solve hitless from the same arrival.
 *
 * ON: an exit goal whose exit has siblings carries them (`siblings: [{name, tiles}]`, `resolveSeedlingAtlasGoal`); the
 * mapper maps each (`attachSiblingSolverGoals`) onto the solver goal; the solve (`solveAnytime`'s sibling arm, the page's
 * SOLVE WORKER) solves the named exit first and, ONLY when its plan takes a hit, solves every sibling from the same
 * arrival request and ships the choice (`chooseSiblingExit`). OFF: no map carries siblings, no goal carries them, no arm
 * runs — byte-identical.
 *
 * ⛓ THE THREADS. The switch is read on the page's MAIN thread (the map and the goal, `seedlingPlaybackController`), via
 * `solverEnvChannel.pageSolverEnvSwitchOn` (YETI-TALK's pattern), and by `process.env` in node. The worker reads no
 * switch: it answers what the request carries.
 *
 * ⛔ Generic: no level, coordinate or Seedling constant. The set is read off the AP rules (`apSiblingExitsOf`), and the
 * rule is compared as an OBJECT (`sameApRule`), never by its name.
 */
import { pageSolverEnvSwitchOn } from './solverEnvChannel.js';

export const SIBLING_EXIT_CHOICE = {
    enabled: globalThis.process?.env?.SEEDLING_SIBLING_EXIT_CHOICE === '1' || pageSolverEnvSwitchOn('SEEDLING_SIBLING_EXIT_CHOICE'),
};
export const SIBLING_EXIT_CHOICE_DEFAULT = false;

/** Run `fn` with `SIBLING_EXIT_CHOICE` set to `enabled`, restoring the previous value. */
export function withSiblingExitChoice(enabled, fn) {
    const was = SIBLING_EXIT_CHOICE.enabled;
    SIBLING_EXIT_CHOICE.enabled = enabled === true;
    try { return fn(); } finally { SIBLING_EXIT_CHOICE.enabled = was; }
}

/** A value with its object keys sorted (arrays keep their order): two rules are equal when these stringify equal. */
function canonical(v) {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
    return v;
}

/** Are two AP access rules the SAME OBJECT (structurally)? A missing rule equals only a missing rule. */
export function sameApRule(a, b) {
    if (a === undefined || a === null || b === undefined || b === null) return (a ?? null) === (b ?? null);
    return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/** The fixed order of a sibling set: the exit NAME (code-point order), never solve-time order. */
export const byExitName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * The AP-equivalent sibling exits of every door the rules carry: `Map<exitName, [{name, tiles, level}]>` (the exit
 * itself excluded, in `byExitName` order), only for an exit that has at least one. Two exits are siblings when they
 * leave the SAME region, reach the SAME `connected_region` and carry the SAME rule (`sameApRule`), and both are DOORS of
 * that region's payload (a sidecar exit with tiles) that land in the same level. A logical link (no tiles) is no sibling.
 *
 * @param {object} rules     the raw rules.json
 * @param {string} playerId  the slot whose regions are read
 * @param {Map<string, object>|object} regions  regionId → `flash_seedling` payload (the doors and their tiles)
 */
export function apSiblingExitsOf(rules, playerId, regions) {
    const payloads = regions instanceof Map ? regions : new Map(Object.entries(regions ?? {}));
    const out = new Map();
    for (const [regionId, region] of Object.entries(rules?.regions?.[String(playerId)] ?? {})) {
        const doors = new Map((payloads.get(regionId)?.exits ?? [])
            .filter((d) => d?.exitName && Array.isArray(d.exit_tiles) && d.exit_tiles.length > 0)
            .map((d) => [d.exitName, d]));
        const exits = (region?.exits ?? []).filter((e) => doors.has(e.name));
        for (const e of exits) {
            const door = doors.get(e.name);
            const sibs = exits.filter((o) => o !== e && o.connected_region === e.connected_region
                && sameApRule(o.access_rule, e.access_rule) && doors.get(o.name).target_level === door.target_level)
                .map((o) => ({ name: o.name, tiles: doors.get(o.name).exit_tiles.map((t) => [...t]), level: door.target_level }))
                .sort(byExitName);
            if (sibs.length) out.set(e.name, sibs);
        }
    }
    return out;
}

/**
 * Why `other` is NOT an AP-equivalent sibling of `exit` (both rules.json exit rows of the same region), or null when it
 * is one. The refusal the set derivation applies, said by name.
 */
export function notSiblingReason(exit, other) {
    if (!exit || !other) return 'no such exit';
    if (other.name === exit.name) return `"${other.name}" is the exit itself`;
    if (other.connected_region !== exit.connected_region) {
        return `"${other.name}" reaches ${other.connected_region}, not ${exit.connected_region}`;
    }
    if (!sameApRule(other.access_rule, exit.access_rule)) {
        return `"${other.name}" carries another rule (${JSON.stringify(other.access_rule ?? null)}) than "${exit.name}" `
            + `(${JSON.stringify(exit.access_rule ?? null)})`;
    }
    return null;
}

/**
 * The deterministic choice (js-22 item 3). `rows[0]` is the NAMED exit, the rest its siblings: `{name, ok, ticks, hits,
 * deaths}` (`hits`/`deaths` the model's verdict on the plan's own ticks; `ok` false = no plan).
 *   · the named exit, unless its plan takes a hit (or a death) and a sibling's plan takes none;
 *   · among the hitless siblings: fewest ticks, then the exit NAME (never solve-time order);
 *   · every sibling hits (or none solves): the named exit, and `why` says so.
 * A named exit with no plan keeps its refusal: the choice moves a hit, it does not answer a refusal.
 *
 * @returns {{chosen: string, index: number, why: string}}
 */
export function chooseSiblingExit(rows) {
    const named = rows[0];
    const hurt = (r) => (r.hits ?? 0) > 0 || (r.deaths ?? 0) > 0;
    if (!named?.ok) return { chosen: named?.name ?? null, index: 0, why: 'the named exit has no plan (the choice moves a hit only)' };
    if (!hurt(named)) return { chosen: named.name, index: 0, why: 'the named exit is hitless' };
    const clean = rows.slice(1).map((r, i) => ({ r, index: i + 1 })).filter(({ r }) => r.ok && !hurt(r))
        .sort((a, b) => (a.r.ticks - b.r.ticks) || byExitName(a.r, b.r));
    if (clean.length === 0) {
        return { chosen: named.name, index: 0,
            why: `the named exit takes ${named.hits ?? 0} hit(s), and every sibling hits or has no plan — the named exit is kept` };
    }
    const { r, index } = clean[0];
    return { chosen: r.name, index,
        why: `the named exit takes ${named.hits ?? 0} hit(s); "${r.name}" solves hitless (${r.ticks} t)` };
}

/**
 * The mapper's half: the solver goal `mapped` of an exit goal that carries `siblings`, with each sibling mapped by
 * `mapSibling(siblingGoal)` (→ a solver goal, or null: a sibling the solver has no goal for is dropped, by name in
 * `siblingsDropped`). A goal with no siblings returns `mapped` UNCHANGED (the same object).
 */
export function attachSiblingSolverGoals(goal, mapped, mapSibling) {
    if (!mapped || !Array.isArray(goal?.siblings) || goal.siblings.length === 0) return mapped;
    const siblings = [];
    const dropped = [];
    for (const s of goal.siblings) {
        const { siblings: _drop, ...rest } = goal;
        const sibGoal = { ...rest, tiles: s.tiles.map((t) => [...t]), name: s.name };
        let m = null;
        try { m = mapSibling(sibGoal); } catch (err) { m = null; dropped.push({ name: s.name, why: String(err?.message ?? err) }); continue; }
        if (m) siblings.push({ name: s.name, goal: m });
        else dropped.push({ name: s.name, why: 'the solver has no goal for it' });
    }
    if (siblings.length === 0) return mapped;
    return { ...mapped, siblings, siblingsOf: goal.name ?? null, ...(dropped.length ? { siblingsDropped: dropped } : {}) };
}

/** A plan's verdict row for `chooseSiblingExit`. */
export function siblingRowOf(name, answer) {
    const ok = answer?.ok === true;
    const m = ok ? answer.plan?.modelHits ?? null : null;
    return { name, ok, ticks: ok ? answer.plan.solution.length : null, hits: m ? m.hits : null, deaths: m ? m.deaths : null,
        ...(ok ? {} : { kind: answer?.kind ?? null }) };
}

/**
 * The solve's half (`solveAnytime`'s sibling arm, the SOLVE WORKER and node): `request.solverGoal` carries `siblings`.
 * `solveOne(request, onPass)` is one ordinary anytime solve. The named exit is solved first (its passes heard by
 * `onPass`, so a provisional plan is the named exit's, today's); only if its plan takes a hit is each sibling solved, in
 * the set's fixed order, from the SAME request (the goal swapped). The answer is the chosen solve's, stamped
 * `siblingExit: {named, chosen, why, rows}` (on the plan too).
 */
export function solveWithSiblings(request, solveOne, onPass = () => {}) {
    const { siblings, siblingsOf = null, siblingsDropped = null, ...namedGoal } = request.solverGoal;
    const named = solveOne({ ...request, solverGoal: namedGoal }, onPass);
    const namedName = siblingsOf ?? 'the named exit';
    const rows = [siblingRowOf(namedName, named)];
    const answers = [named];
    const hurt = rows[0].ok && ((rows[0].hits ?? 0) > 0 || (rows[0].deaths ?? 0) > 0);
    if (hurt && named.kind !== 'divergence') {
        for (const s of siblings) {
            const a = solveOne({ ...request, solverGoal: s.goal }, () => {});
            answers.push(a);
            rows.push(siblingRowOf(s.name, a));
        }
    }
    const choice = chooseSiblingExit(rows);
    const stamp = { named: namedName, chosen: choice.chosen, why: choice.why, rows,
        solved: rows.length, ...(siblingsDropped ? { dropped: siblingsDropped } : {}),
        ...(hurt ? {} : { skipped: siblings.map((s) => s.name) }) };
    const out = answers[choice.index];
    return { ...out, siblingExit: stamp, ...(out.ok ? { plan: { ...out.plan, siblingExit: stamp } } : {}) };
}

/** A note line for a shipped plan's sibling choice ('' when none ran or the named exit was kept hitless). */
export function siblingExitNote(plan) {
    const s = plan?.siblingExit;
    if (!s || (s.chosen === s.named && s.solved === 1)) return '';
    return s.chosen === s.named ? `sibling exits: kept "${s.named}" — ${s.why}`
        : `sibling exit "${s.chosen}" in place of "${s.named}" — ${s.why}`;
}
