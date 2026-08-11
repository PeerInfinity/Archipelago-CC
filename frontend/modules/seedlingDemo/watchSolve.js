/**
 * seedlingDemo/watchSolve — the editor page's SOLVE arm, without the DOM.
 *
 * ⚠ TOOLING ONLY, and the same three laws as `watchViewer`: it makes no
 * claims, gates nothing, and nothing that DOES make a claim may depend on
 * it. It renders RAW TRUTH — an ambiguous default is REPORTED rather than
 * guessed at, a deactivated exit is listed rather than dropped, and a
 * refusal carries the solver's own message. And it owns NO TICK LOOP:
 * `solveSegment` advances the run, `createTapeStepper` replays the result,
 * which is the whole of the solve-then-scrub shape (⚖ kickoff §1.2).
 *
 * ── WHY THIS IS NOT IN `watchViewer.js` ───────────────────────────────
 *
 * Everything here is PURE — parameters and a level source in, goals and a
 * tape out — so it is unit-testable in node while the viewer stays a DOM
 * script. That split is not tidiness: the page logic that decides WHAT to
 * solve is exactly the part that could quietly build a different world
 * from the runner's, so it is the part that gets tests
 * (`watchSolve.test.js`) and a cross-runtime acceptance row
 * (`scripts/procgen/check-seedling-editor-solve.mjs`).
 *
 * ⛔ ONE OF EVERYTHING. The run comes from `createRunForStaging` (the same
 * construction `createTapeStepper` uses), the tape from `buildStagedTape`
 * (the same fold every driver-emitted tape uses), and the replay from the
 * stepper. This module contributes no fourth opinion about any of them —
 * a viewer that built its own run would be the two-cost-models trap with
 * geometry, and it would look perfectly fine on screen.
 */

import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { buildStagedTape } from './botDriverV1.js';
import { solveSegment } from './solverBot.js';

/**
 * A goal, as a URL-safe string: `exit:X,Y` or `place:X,Y`.
 *
 * ⚠ The vocabulary is the SOLVER's, not a new one — `reach-exit` takes a
 * teleporter's OEL coordinates and `collect-placement` takes a pickup's or
 * chest's, which is exactly what the census lists and exactly what
 * `assertGoal` accepts. A third spelling here would be a second goal
 * language for the same solver.
 */
export function formatGoal(goal) {
    if (goal.kind === 'reach-exit') return `exit:${goal.exit.x},${goal.exit.y}`;
    if (goal.kind === 'collect-placement') {
        return `place:${goal.placement.x},${goal.placement.y}`;
    }
    throw new Error('watchSolve: no ?goals= spelling for goal kind '
        + `${JSON.stringify(goal.kind)} — the solver's vocabulary is closed `
        + '(`assertGoal`), and a new kind is a policy addition, not a new string here.');
}

/** The ordered goal list as one parameter value. */
export const formatGoalsParam = (goals) => goals.map(formatGoal).join(';');

/**
 * Parse `?goals=` — ORDERED, `;`-separated.
 *
 * Refuses by name rather than skipping a bad entry: a goal list that
 * silently lost one of its goals would solve a DIFFERENT segment and print
 * a tick count that looked like an answer.
 */
export function parseGoalsParam(raw) {
    const text = (raw ?? '').trim();
    if (!text) return [];
    return text.split(';').map((chunk, i) => {
        const part = chunk.trim();
        const m = /^(exit|place):(-?\d+),(-?\d+)$/.exec(part);
        if (!m) {
            throw new Error(`watchSolve: goals[${i}] is ${JSON.stringify(part)}, which is `
                + 'not `exit:X,Y` or `place:X,Y`. The goal vocabulary is the solver\'s: '
                + 'an EXIT is a teleporter\'s OEL coordinates and a PLACE is a pickup\'s '
                + 'or chest\'s. Semicolons separate, and the order is the order solved.');
        }
        const [, kind, x, y] = m;
        return kind === 'exit'
            ? { kind: 'reach-exit', exit: { x: Number(x), y: Number(y) } }
            : { kind: 'collect-placement', placement: { x: Number(x), y: Number(y) } };
    });
}

/**
 * A staging block from whatever JSON the caller has: a whole committed
 * tape, or a bare boot block someone typed into the textarea.
 *
 * ⛔ ONE VALIDATOR for both, and it is `parseTape` — a bare block is
 * completed into a zero-tick tape and parsed. So a typo in a hand-typed
 * `rng` gets the tape parser's own message, in the page, rather than a
 * second validator here that would agree with the first until one was
 * edited.
 *
 * ⚠ A PARTIAL BLOCK IS REFUSED, not completed. The v8 vocabulary has no
 * defaults on purpose — `noclip` selects which physics both consumers run
 * and `noDamage` selects whether `Player.hit()` runs — so filling either
 * in here would be choosing an experiment on the caller's behalf and then
 * calling it their declaration. The parser names the first field it is
 * missing; that is the message the page shows.
 */
export function stagingFromJson(json) {
    const isTape = Array.isArray(json?.inputs) && json?.tick_count !== undefined;
    if (isTape) return stagingFromTape(parseTape(json));
    return stagingFromTape(parseTape({
        game: 'seedling',
        name: 'editor-staging',
        tape_version: 8,
        ...json,
        tick_count: 0,
        inputs: [],
    }));
}

/**
 * Everything in a built world that the solver's goal vocabulary can name.
 *
 * ⚠ A DEACTIVATED teleporter is LISTED, not dropped. "This level has one
 * exit" and "this level has two exits and one is shut behind a flag this
 * staging block has not cleared" are different facts, and a picker showing
 * only the live ones would present the second as the first. The entry
 * carries `usable: false` and the reason.
 */
export function censusGoalOptions(world) {
    const options = [];
    for (const p of world.pickups ?? []) {
        options.push({
            usable: true,
            spec: `place:${p.x},${p.y}`,
            label: `pickup ${p.tag} (${p.x},${p.y})`,
            goal: { kind: 'collect-placement', placement: { x: p.x, y: p.y } },
            why: null,
        });
    }
    for (const c of world.chests ?? []) {
        options.push({
            usable: true,
            spec: `place:${c.x},${c.y}`,
            label: `chest ${c.tag} (${c.x},${c.y})`,
            goal: { kind: 'collect-placement', placement: { x: c.x, y: c.y } },
            why: null,
        });
    }
    for (const t of world.teleporters ?? []) {
        options.push({
            usable: !t.deactivated,
            spec: `exit:${t.x},${t.y}`,
            label: `exit → L${t.to} (${t.x},${t.y})${t.isStairs ? ' stairs' : ''}`
                + (t.deactivated ? `  ⚠ DEACTIVATED (tag ${t.tag} not cleared)` : ''),
            goal: { kind: 'reach-exit', exit: { x: t.x, y: t.y } },
            why: t.deactivated
                ? `teleporter tag ${t.tag} is not cleared by this staging block's `
                  + 'persistence, so the world builds it shut — opening it is a STAGING '
                  + 'change, not a goal'
                : null,
        });
    }
    return options;
}

/**
 * The goals `?solve=1` runs when `?goals=` names none.
 *
 * ⛔ IT REFUSES AN AMBIGUOUS LEVEL RATHER THAN PICKING ONE. L4 has two live
 * teleporters — (64,16) to L5 and (0,16) back to L3 — and "the default
 * exit" is not a fact about the level, it is a guess about the caller. The
 * guess would solve a segment nobody asked for and print a tick count that
 * looked like an answer, which is the failure mode the RAW TRUTH law
 * exists to prevent.
 *
 * So: every placement (they are all wanted, in census order), plus the
 * single live exit IF there is exactly one. Otherwise `goals` is null and
 * `refusal` names every candidate WITH the `?goals=` spelling that selects
 * it — a refusal you can act on without reading the atlas.
 */
export function defaultGoalsFromCensus(world) {
    const options = censusGoalOptions(world);
    const places = options.filter((o) => o.goal.kind === 'collect-placement');
    const exits = options.filter((o) => o.goal.kind === 'reach-exit' && o.usable);
    if (exits.length === 1) {
        return { goals: [...places.map((o) => o.goal), exits[0].goal], refusal: null };
    }
    if (exits.length === 0 && places.length > 0) {
        return { goals: places.map((o) => o.goal), refusal: null };
    }
    const shut = options.filter((o) => !o.usable);
    return {
        goals: null,
        refusal: `level ${world.level} has ${exits.length} live exit(s), so there is no `
            + 'DEFAULT exit to solve toward — which one you mean is a fact about you, not '
            + 'about the level. Name it with ?goals= (the order is the order solved): '
            + `${options.filter((o) => o.usable).map((o) => o.spec).join(' ; ') || '(none)'}`
            + (shut.length
                ? `  — and ${shut.length} the staging block builds SHUT: `
                  + `${shut.map((o) => o.spec).join(' ; ')}`
                : ''),
    };
}

/**
 * The PRESETS dropdown's contents: every committed tape's own boot block.
 *
 * "Boot like `r8-solve-18`" is the staging-is-declared law in UI clothes.
 * The preset is not a hand-typed approximation of a room's starting state,
 * it is the exact block the game and the differential already agreed on —
 * save arrays, persistence, the three RNG streams and the seam.
 *
 * ⚠ A tape this page cannot parse lands in `refused` WITH the parser's
 * message; it is never dropped. A preset list that silently shrank would
 * read as a smaller roster.
 */
export function harvestPresets(records) {
    const presets = [];
    const refused = [];
    for (const record of records) {
        try {
            presets.push({
                name: record.name,
                staging: stagingFromTape(parseTape(record.tape)),
            });
        } catch (e) {
            refused.push({ name: record.name, why: e.message });
        }
    }
    return { presets, refused };
}

/**
 * Build the world a staging block declares, for the goal picker's census.
 *
 * ⚠ Through the SAME construction the solve will use, so the census the
 * picker OFFERS is the census the solver SENSES. A picker reading a
 * default-`roles` world would offer goals in rooms the solver then refuses
 * as combat-blind — the two would disagree about what the level contains.
 *
 * The run is built and never advanced; `solveSegment` requires a fresh
 * one, so the solve builds its own rather than reusing this.
 */
export function censusWorld(levelSource, staging) {
    return createRunForStaging(solveStaging(staging), levelSource).world;
}

/**
 * SOLVE — headless, in whatever runtime is calling.
 *
 * Returns the solver's own output, the folded tape (ready for the SAME
 * stepper the REPLAY arm uses) and the measured wall clock. The clock is
 * injected: the page passes `performance.now` and a test can pass anything.
 *
 * ⛔ The run is built HERE and handed over FRESH. `solveSegment` refuses a
 * stale run (`ticksCompleted !== 0`), a combat-blind one and an empty goal
 * list, each by name — and those refusals are the page's error text
 * verbatim, never re-worded here.
 */
export function solveForPage({ levelSource, staging, goals, name, now = () => Date.now() }) {
    const honest = solveStaging(staging);
    const t0 = now();
    const run = createRunForStaging(honest, levelSource);
    const out = solveSegment({ run, goals, name, boot: honest.boot });
    const ms = now() - t0;
    return {
        out,
        run,
        ms,
        tape: buildStagedTape({ staging: honest, perTick: out.perTick, name }),
    };
}

/**
 * The SOLVE arm's URL parameters.
 *
 * ⚠ `?tape=` / `?side=` / `?speed=` stay the viewer's and are untouched —
 * every existing watch URL still means exactly what it meant. SOURCE is
 * inferred rather than being a fourth thing to remember: any SOLVE
 * parameter selects SOLVE, `?source=` overrides, and a bare `?tape=` is
 * REPLAY as it always was.
 */
export function readSolveParams(search) {
    const q = new URLSearchParams(search);
    const level = q.get('level');
    const boot = q.get('boot');
    const solve = q.get('solve') === '1';
    return {
        level: level === null || level === '' ? null : Number(level),
        boot,
        goals: q.get('goals'),
        name: q.get('name'),
        solve,
        source: (q.get('source')
            || (level !== null || boot || solve ? 'solve' : 'replay')).toLowerCase(),
    };
}
