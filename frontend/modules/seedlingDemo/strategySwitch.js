/**
 * seedlingDemo/strategySwitch — ⛓⛓ SEEDLING STRATEGY SWITCH r1: **A PER-SOLVE OFF SWITCH FOR THE SOLVER'S
 * STRATEGIES**, behind a flag that is ON by default (⚖ the user, 2026-11-01: "Turn it on"; `SEEDLING_STRATEGY_SWITCH=0`
 * turns it off).
 *
 * The user's question (2026-10-28, item 6): can the generator work as the INVERSE of the solver — add content that
 * makes a room REQUIRE each strategy the solver knows? The with/without differential answers it once the solver can
 * be asked to solve WITHOUT one strategy. This module is that ask's state; the gates live at `solverBot.js`'s
 * executor lookups and rung entries and read it.
 *
 *   `solveSegment({ …, disable: ['burn', 'rung:time'] })`  → one solve, with `burn` and the TIME rung switched off.
 *
 * ⛔ THE FLAG (`STRATEGY_SWITCH`) IS ON BY DEFAULT, AND OFF (`SEEDLING_STRATEGY_SWITCH=0`) REFUSES. A non-empty
 * `disable` with the flag off is a `SolverRefusal` (`STRATEGY_SWITCH_OFF`), never a silently ignored option: an
 * ignored switch would grade every room INERT. Absent or `[]` is a no-op at either flag state — nothing is installed, nothing is stamped,
 * and the solve is today's, byte for byte.
 *
 * ⛔ THE SCOPE IS SYNCHRONOUS. `ACTIVE_DISABLE` is a module slot set for one solve's dynamic extent and restored in
 * `finally` (`withDisabledScope`), the shape of `solverBot`'s `activeDeadline` and `solveProgress`'s
 * `activeProgress`: every fork, rewind and replay inside the solve sees the same set, nesting restores the outer,
 * and a throw restores it. A function that returns a THENABLE is refused: an `await` inside would run its tail with
 * the slot already restored (js-13 condition 2). An async caller (`twoPassSolve`) threads the list through to each
 * synchronous solve instead.
 *
 * ⛔ THE TABLES ARE NOT TOUCHED. `OBSTACLE_STRATEGIES`, `STRATEGY_EXECUTORS` and `ESCALATION_LADDER` are read by
 * enumerating readers (the catalogue invariants, `R8_STRATEGY_EXECUTORS`' derivation rows, `KNOWN_STRATEGY_VERBS`),
 * and they read the same frozen tables whether or not a solve is disabling anything.
 *
 * THE VOCABULARY (one namespace, two qualifiers): a bare name disables the VERB (an executor the solver can look up)
 * and, where the same word is a ladder RUNG (`bait`, `kill`), the rung too. `verb:kill` / `rung:kill` separate them.
 * An unknown name, `avoid` (the base walk, not a strategy) and `dash` (spelled `dashMode: 'none'`) refuse by name.
 * The vocabulary itself is `solverBot`'s (`strategyDisableVocabulary`: the executor table's own keys plus the frontier
 * extras, and `DISABLE_RUNGS`); this leaf imports nothing.
 *
 * THE HIT COUNT: each time a gate answers "off" for a lookup that WOULD OTHERWISE have found an executor (or entered
 * a rung it would otherwise have entered), `hits[name]` counts it and `first` keeps the first site. A refusal under
 * the scope carries `disabled = {asked, hits, first, absent}` and a clause; a solved result carries `disabled` too.
 * ⛔ Refusal TEXT does not say why a room refused (measured: L69/L38/L19/L5 refused with sentences about something
 * else), so `hits` is the attribution: REFUSED with `hits > 0` is "refused at the disabled gate"; REFUSED with
 * `hits === 0` is "the strategy was never consulted" — not evidence that the room needs it.
 */

/**
 * ⚖ THE FLAG — `crusherBait.CRUSHER_BAIT`'s shape. A mutable record so a test or a measurement flips it in-process
 * (`withStrategySwitch`); the env var is the CLI/survey/worker switch (the page reaches it through CPWIT's
 * `?seedlingSolverEnv=SEEDLING_STRATEGY_SWITCH=0`). ON by default since the flip (⚖ the user, 2026-11-01; r1 measured
 * ON with no `disable` byte-identical to OFF); `=0` turns it OFF, and OFF refuses a `disable` request by name.
 */
export const STRATEGY_SWITCH = { enabled: globalThis.process?.env?.SEEDLING_STRATEGY_SWITCH !== '0' };

export function withStrategySwitch(enabled, fn) {
    const prior = STRATEGY_SWITCH.enabled;
    STRATEGY_SWITCH.enabled = Boolean(enabled);
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            return out.finally(() => { STRATEGY_SWITCH.enabled = prior; });
        }
        STRATEGY_SWITCH.enabled = prior;
        return out;
    } catch (e) {
        STRATEGY_SWITCH.enabled = prior;
        throw e;
    }
}

/**
 * ⚖ WHAT "NEEDS A STRATEGY" MEANS (hammer-2's ruling on r1): the VERB, as the solver selects and applies it. A verb's
 * own internal mechanics are not the verb: `pulse` and the fire-pulse `shove` press a button through `execHold`'s
 * runner, and that press does not count as `hold` — `disable: ['hold']` leaves them running (0 `hold` hits),
 * `disable: ['pulse']` stops a pulse.
 *
 * ⚖ ONE GAME ACT, TWO SOLVER ENTRY POINTS — `rope` (source hammer-2, 2026-11-04, for seedling-gen-rope-strategy):
 * the `rope` verb (`execRope`) and the ladder's PULL rung are the SAME act. `execRope` calls `execPull`, and both cut
 * through the run's `pullRope` (`RopeStart.hit`, `setPersistence(tag, false)`, the group latched). Only the trigger
 * differs: `rope` fires on a rope that is a wall on the route or a `clear-tag` on its tag (vanilla L16), and the PULL
 * rung fires on an ARMED lane's danger whose group has a rope (the generated rope gate, whose rope is off the route by
 * construction). So the bare name `rope` names the ACT and disables both (`DISABLE_ACT_ALIASES`). A rope-off solve
 * then cannot cut a rope by either door, and `strategy:rope` grades "needs the rope pulled". `verb:rope` still means the
 * verb alone, and `rung:pull` the rung alone (`pull` alone stays a budget rung: on L16 it is INERT).
 */
/**
 * ⚖ The bare names that name a game ACT reached through more than one entry point: name → the RUNGS it also disables.
 * A bare entry only (`verb:<name>` keeps the verb alone). The hits are counted under each gate's own name
 * (`rope`, `rung:pull`), so the attribution says which door the solve tried.
 */
export const DISABLE_ACT_ALIASES = Object.freeze({
    rope: Object.freeze(['pull']),
});

/** The refusal codes (`SolverRefusal.code`). */
export const STRATEGY_DISABLED = 'STRATEGY_DISABLED';
export const STRATEGY_SWITCH_OFF = 'STRATEGY_SWITCH_OFF';
export const STRATEGY_DISABLE_UNKNOWN = 'STRATEGY_DISABLE_UNKNOWN';
export const STRATEGY_DISABLED_SCOPE_CHANGED = 'STRATEGY_DISABLED_SCOPE_CHANGED';

/** The names a `disable` list refuses even though the solver knows the word, and why. */
export const DISABLE_REFUSED_NAMES = Object.freeze({
    avoid: 'AVOID is the base walk (a re-plan around the danger map), not a strategy — disabling it is "no walking", '
        + 'which is not a requirement any room can have',
    dash: 'the dash is not a verb the gates see; a solve without it is `dashMode: \'none\'`, which already exists',
});

/**
 * The scope the solve in hand runs under — `null` is "nothing disabled" (every gate is `ACTIVE_DISABLE !== null && …`,
 * so with none installed no gate reads anything else). A LIVE binding: `solverBot` reads it as it changes.
 */
export let ACTIVE_DISABLE = null;

/**
 * Parse a `disable` list against the solver's vocabulary into a scope (not installed). `refuse(code, message)` makes
 * the caller's own refusal (`solverBot` hands a `SolverRefusal` maker; this leaf imports nothing) and must throw.
 *
 * @param {Array<string>} list
 * @param {{verbs: Set<string>, rungs: Set<string>, available?: (verb: string) => boolean}} vocabulary
 *   `available(verb)`: would the solver's lookup find an executor for `verb` in this process (a switch-gated verb
 *   whose switch is OFF has none, so the gate can never answer for it — its clause says so).
 */
export function parseDisable(list, { verbs, rungs, available = () => true }, refuse) {
    if (!Array.isArray(list)) {
        refuse(STRATEGY_DISABLE_UNKNOWN, `solveSegment: \`disable\` must be an array of strategy names, got `
            + `${list === null ? 'null' : typeof list}.`);
    }
    const asked = [];
    const offVerbs = new Set();
    const offRungs = new Set();
    for (const raw of list) {
        if (typeof raw !== 'string' || raw === '') {
            refuse(STRATEGY_DISABLE_UNKNOWN, `solveSegment: \`disable\` holds ${JSON.stringify(raw)}, which is not a `
                + 'strategy name.');
        }
        const m = /^(verb|rung):(.+)$/.exec(raw);
        const qual = m ? m[1] : null;
        const name = m ? m[2] : raw;
        if (Object.hasOwn(DISABLE_REFUSED_NAMES, name)) {
            refuse(STRATEGY_DISABLE_UNKNOWN, `solveSegment: \`disable: [${raw}]\` is refused by name — `
                + `${DISABLE_REFUSED_NAMES[name]}.`);
        }
        const isVerb = qual !== 'rung' && verbs.has(name);
        const isRung = qual !== 'verb' && rungs.has(name);
        if (!isVerb && !isRung) {
            refuse(STRATEGY_DISABLE_UNKNOWN, `solveSegment: \`disable\` names ${JSON.stringify(raw)}, which is not `
                + `${qual === 'verb' ? 'a verb' : qual === 'rung' ? 'a rung' : 'a verb or a rung'} this solver knows. `
                + `Verbs: [${[...verbs].sort().join(', ')}]. Rungs: [${[...rungs].join(', ')}] (\`rung:<name>\`).`);
        }
        if (isVerb) offVerbs.add(name);
        if (isRung) offRungs.add(name);
        // ⚖ one act, two entry points (`DISABLE_ACT_ALIASES`): a bare `rope` also turns off the PULL rung
        if (qual === null && isVerb) {
            for (const r of (Object.hasOwn(DISABLE_ACT_ALIASES, name) ? DISABLE_ACT_ALIASES[name] : [])) if (rungs.has(r)) offRungs.add(r);
        }
        if (!asked.includes(raw)) asked.push(raw);
    }
    asked.sort();
    return {
        asked: Object.freeze(asked),
        key: disableKeyOf(asked),
        verbs: offVerbs,
        rungs: offRungs,
        /** asked verbs the solver has no executor for in this process (a switch-gated row whose switch is off) */
        absent: Object.freeze([...offVerbs].filter((v) => !available(v)).sort()),
        hits: {},
        first: null,
    };
}

/**
 * A `disable` list's identity — the key `parseDisable` gives its scope (the distinct names, sorted, `,`-joined), or
 * `null` for absent / `[]` (nothing is installed). `twoPassSolve` captures it at entry for its escape-cache scope.
 */
export const disableKeyOf = (list) => (Array.isArray(list) && list.length > 0
    ? [...new Set(list)].sort().join(',') : null);

/** The live scope's identity for a cache key (`null` with none installed). */
export const liveDisableKey = () => (ACTIVE_DISABLE === null ? null : ACTIVE_DISABLE.key);

/** Is `verb` disabled by the live scope? Membership only — counts nothing. */
export const verbDisabled = (verb) => ACTIVE_DISABLE !== null && ACTIVE_DISABLE.verbs.has(verb);

function hit(scope, name, site, id) {
    scope.hits[name] = (scope.hits[name] ?? 0) + 1;
    scope.first ??= { verb: name, site, id: id ?? null };
}

/**
 * THE VERB GATE: is `verb` off? Counts a hit when it is. ⛔ Ask it only where the lookup WOULD otherwise have answered
 * an executor (fidelity condition 1), so `hits` counts real refusals of a real option.
 */
export function verbOff(verb, site, id = null) {
    const s = ACTIVE_DISABLE;
    if (s === null || !s.verbs.has(verb)) return false;
    hit(s, verb, site, id);
    return true;
}

/** THE RUNG GATE: is the ladder rung `rung` off? Counts a hit when it is (ask it where the rung would be entered). */
export function rungOff(rung, site = rung, id = null) {
    const s = ACTIVE_DISABLE;
    if (s === null || !s.rungs.has(rung)) return false;
    hit(s, `rung:${rung}`, site, id);
    return true;
}

/** The scope as a result/refusal field: `{asked, hits, first, absent}` (copies). */
export function disabledReport(scope) {
    return Object.freeze({
        asked: [...scope.asked],
        hits: { ...scope.hits },
        first: scope.first === null ? null : { ...scope.first },
        absent: [...scope.absent],
    });
}

/** The sentence a refusal raised under the scope carries (`deadlineClause`'s shape). */
export function disabledClause(scope) {
    const total = Object.values(scope.hits).reduce((a, b) => a + b, 0);
    const absent = scope.absent.length === 0 ? ''
        : ` [${scope.absent.join(', ')}] ${scope.absent.length === 1 ? 'has' : 'have'} NO executor in this process (a `
            + 'switch-gated row whose switch is OFF), so the gate could never answer for '
            + `${scope.absent.length === 1 ? 'it' : 'them'}.`;
    return ` ⊘ DISABLED: this solve ran with \`disable: [${scope.asked.join(', ')}]\`; `
        + (total === 0
            ? 'the gate never answered "off" (the disabled strategies were never consulted), so this refusal is '
                + 'the room\'s, not the switch\'s.'
            : `the gate answered "off" ${Object.entries(scope.hits).map(([k, n]) => `${n}× ${k}`).join(', ')} `
                + `(first: ${scope.first.verb} at \`${scope.first.site}\`${scope.first.id ? ` (${scope.first.id})` : ''}). `
                + 'This refusal may be the switch\'s, not the room\'s.')
        + absent;
}

/**
 * Run `fn` (SYNCHRONOUS) with `scope` installed; the outer scope is restored after, on a return or a throw.
 * ⛔ A thenable return is refused (the slot would be restored before the promise's tail ran).
 */
export function withDisabledScope(scope, fn) {
    const outer = ACTIVE_DISABLE;
    ACTIVE_DISABLE = scope;
    try {
        const out = fn();
        if (out !== null && typeof out === 'object' && typeof out.then === 'function') {
            throw new Error('strategySwitch: the disable scope is SYNCHRONOUS and `fn` returned a thenable — an '
                + '`await` inside would run its tail with the scope already restored. Thread the `disable` list '
                + 'through to each synchronous solve instead (`twoPassSolve` does).');
        }
        return out;
    } finally {
        ACTIVE_DISABLE = outer;
    }
}
