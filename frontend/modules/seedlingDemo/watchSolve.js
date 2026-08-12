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

import { parseTape, requiredTapeVersion } from './tapeFormat.js';
import {
    checkSolveDespawns, createRunForStaging, solveStaging, stagingFromTape,
} from './tapeRunner.js';
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
 * ⛓ THE COMMITTED TAPE WHOSE BOOT BLOCK IS THE TRUE GAME START — the
 * page's default staging, as a NAME rather than as eleven fields (slice 5).
 *
 * `act2-the-sword` is R7's honest playthrough and its FIRST SEGMENT starts
 * where a new game does. The page fetches this tape and takes its boot block
 * through `stagingFromJson`, so the default is the same artifact the game
 * and the differential already agreed on rather than a hand transcription of
 * it — see `watchViewer.trueStartStaging`.
 *
 * ⛔ THE NAME IS ASSERTED AGAINST THE CHAIN, NOT TRUSTED. `playthroughWalk`
 * imports `fixtures/index.js` and therefore `node:fs`, so this page cannot
 * read `PLAYTHROUGH_CHAINS` at all (slice 1 §8.4: one such import makes the
 * whole module graph unloadable in a browser). `watchSolve.test.js` runs in
 * node, where it can — and it asserts this constant IS
 * `PLAYTHROUGH_CHAINS.find(c => c.id === 'act2-the-sword').segments[0]`.
 * That is `SEAM_SIGNATURE`'s own shape: a value checked across the boundary
 * it cannot be imported across, never a second list nobody compares.
 */
export const TRUE_START_CHAIN = 'act2-the-sword';
export const TRUE_START_SEGMENT = 'r7-act2-1';

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
 *
 * ⛓⛓⛓ SLICE 5 — THE TWO COMPLETION FIELDS WERE **LITERALS**, AND BOTH WERE
 * WRONG FOR EXACTLY THE BOOTS THIS SLICE SET OUT TO UNBLOCK.
 *
 * The bare arm wrapped the block in `{tape_version: 8, tick_count: 0}`.
 * Both are properties of the WRAPPER, not of the block — and `parseTape`
 * reads them as claims about the block:
 *
 *   · `tape_version: 8` means "`persistence[].at` cannot exist" and
 *     "`despawn` means [] BY DEFINITION", so pasting `r8-solve-18`'s own
 *     boot block into the textarea and pressing anything got the parser's
 *     v9 refusal — the SAME mislabelling `buildStagedTape` was making at
 *     the other end of the page, in the same shape, one module over. ⇒
 *     `requiredTapeVersion`, the one owner of the rule, exactly as the fold
 *     now asks it.
 *   · `tick_count: 0` bounds every declared `at` to `[0, 0]` ("a removal
 *     after the last tick never happens" — a statement about a TAPE). A
 *     staging block has no ticks at all, so the bound is not merely tight,
 *     it is a category error: `r7-act2-6`'s despawn at 120 is legal in the
 *     tape it came from and unrepresentable here. ⇒ the completion is wide
 *     enough to hold what the block DECLARES, which is the smallest number
 *     that stops the wrapper from making claims of its own.
 *
 * ⚠ THE ZERO-TICK TAPE IS A VALIDATION VEHICLE AND NOTHING ELSE — it is
 * never emitted, never replayed and never compared. Widening its
 * `tick_count` therefore weakens no check that exists; the tapes this page
 * FOLDS get their bound from `buildStagedTape`, against the run's own
 * length, which is the place the question is real.
 *
 * ⛓ MEASURED, NOT REASONED: the SOLVE arm re-reads this box at press time
 * (slice 5) and `?boot=r8-solve-18.json&solve=1` refused here before this
 * change — the CLI's own acceptance row caught it, with the parser's
 * message, on the first run after the re-read landed.
 */
export function stagingFromJson(json) {
    const isTape = Array.isArray(json?.inputs) && json?.tick_count !== undefined;
    if (isTape) return stagingFromTape(parseTape(json));
    const declaredTicks = Math.max(0, ...[
        ...(json?.persistence ?? []).map((c) => c.at),
        ...(json?.despawn ?? []).map((d) => d.at),
    ].filter((t) => Number.isFinite(t)));
    const completed = {
        game: 'seedling',
        name: 'editor-staging',
        ...json,
        tick_count: declaredTicks,
        inputs: [],
    };
    return stagingFromTape(parseTape({
        ...completed,
        tape_version: json?.tape_version ?? requiredTapeVersion(completed, 8),
    }));
}

/**
 * ⛓⛓⛓ THE BOOT FORM v1 — the fields a checkbox may edit (slice 5, kickoff
 * §12.4), and the one place their JSON PATH is written.
 *
 * ⛔⛔ THE CHARTER SAYS `save.hasSword` AND THE TAPE HAS NO SUCH FIELD, and
 * the difference is not cosmetic. A tape's version-6 `save` block is
 * `{totem_parts, keys, seal_parts}` — three index arrays and nothing else;
 * `parseSave` refuses any other key BY NAME. The item flags live in the
 * version-8 `seam` block as `seam.items.hasSword`. ⛓ `save.hasSword` IS a
 * real name: it is `SEAM_BOOT_SPEC[].field`, the GAME's own property path,
 * which `Bot.latchSeam` emits and `seamFindings` maps over — the other half
 * of the two key spaces `seamFieldsFromBlock`'s docblock calls "different
 * and both load-bearing". So the form's label comes from one space and its
 * write lands in the other, and this table is the only place that is said.
 *
 * ⚠ TWO FIELDS, NOT THIRTEEN. `SEAM_BOOT_SPEC` carries all thirteen item
 * flags and rendering the lot would be four lines less code — and a form
 * offering `hasDarkSuit` on a page whose solver has no policy for it is
 * trap 119's family in UI clothes. Sword and shield are what the ruling
 * asked for and what the route to the shield needs; the JSON editor is
 * right there for anything else, which is ⚖ §1.7's whole point.
 */
export const ITEM_FORM_FIELDS = Object.freeze([
    Object.freeze({ id: 'sword', key: 'items.hasSword', field: 'save.hasSword', label: 'sword' }),
    Object.freeze({ id: 'shield', key: 'items.hasShield', field: 'save.hasShield', label: 'shield' }),
]);

/**
 * The form's reading of a staging block: `{sword, shield}`, each `true`,
 * `false` or **`null`** for "this block declares nothing about it".
 *
 * ⚠ THREE STATES, NOT TWO, because the seam has three. `parseSeam` keeps
 * only the keys a tape DECLARED — "not declared" and "declared false" are
 * different segments and only one of them can be checked against a
 * predecessor (`seamToBlock`'s own note). A form that read absence as
 * `false` would turn every undeclared block into a declaring one the moment
 * anybody touched a different checkbox.
 */
export function itemFlagsOf(staging) {
    const seam = staging?.seam ?? null;
    const out = {};
    for (const f of ITEM_FORM_FIELDS) {
        const [group, leaf] = f.key.split('.');
        const v = seam?.[group]?.[leaf];
        out[f.id] = v === undefined || v === null ? null : v;
    }
    return out;
}

/**
 * The same block with ONE item flag set — the checkbox's whole write.
 *
 * ⛔ IT RETURNS A STAGING BLOCK AND NOT TEXT. The form's source of truth is
 * the PARSED block: the checkbox edits it, the page re-serialises, and the
 * textarea re-derives the checkboxes from whatever it then parses. A
 * function that edited the JSON STRING would be a second serialiser, and
 * the two would agree until somebody's block had a comment in it.
 *
 * ⚠ It CREATES the seam when there is none — `r7-act2-1`, the page's own
 * default, declares `seam: null`. A partial seam is legal (`parseSeam` skips
 * every absent key) and a partial one is the honest thing to write: filling
 * in the other twelve flags would be the page claiming state nobody
 * measured.
 */
export function withItemFlag(staging, id, on) {
    const f = ITEM_FORM_FIELDS.find((x) => x.id === id);
    if (!f) {
        throw new Error(`watchSolve: "${id}" is not a boot-form field; the form covers `
            + `${ITEM_FORM_FIELDS.map((x) => x.id).join(', ')}. Everything else is the `
            + 'JSON editor, which is the spine (⚖ kickoff §1.7).');
    }
    const [group, leaf] = f.key.split('.');
    const seam = staging.seam ?? {};
    return {
        ...staging,
        seam: { ...seam, [group]: { ...(seam[group] ?? {}), [leaf]: Boolean(on) } },
    };
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
 *
 * ⛓ AND THE DECLARED DESPAWNS ARE CHECKED AFTER THE WALK (slice 5). The
 * `staging` argument is the block AS DECLARED and `honest` is the dropped
 * one, so both halves of `solveStaging`'s seam are in scope here and nowhere
 * else — which is why the check belongs at this call site rather than inside
 * the drop, which has no run to ask. `despawns` rides out beside `out` for
 * the page to display; a refusal is the checker's own message, verbatim.
 *
 * ⛓⛓ PROCGEN PoC SLICE 1 — `maxTicksPerTarget`, PASSED THROUGH AND NOT
 * DEFAULTED HERE.
 *
 * `solveSegment` has always taken a per-target tick budget and this call site
 * never offered one, so every caller got the solver's own
 * `DEFAULT_MAX_TICKS_PER_TARGET` whatever it asked for — which is fine until
 * something wants to BOUND a solve. The procgen loop does: it runs hundreds
 * of solves against generated rooms, and a budget it names but cannot enforce
 * would be a bound nobody applies (the generator's own oracle caught exactly
 * that, by measuring a 7-tick budget still solving in 134 ticks).
 *
 * ⛔ THE DEFAULT STAYS THE SOLVER'S. `undefined` is forwarded, so the
 * parameter's absence reaches `solveSegment`'s own default rather than a
 * second copy of the number here — which is what makes this addition
 * byte-inert for the page, the battery and the acceptance row. Both
 * directions are driven in `watchSolve.test.js`.
 *
 * ⛓⛓ PROCGEN PoC SLICE 4b — `scratchPersistence`, THE SAME SHAPE ONE SLICE
 * ON, and it stops here.
 *
 * A generated level has no tape, so a kill-lock clear the model can compute
 * has no declared writer and `levelRun` refuses to invent one (⚖ kickoff
 * §1.13). The flag lets it, for solve/generated contexts only. ⛔ THE PAGE
 * NEVER PASSES IT: `watchViewer`'s SOLVE arm solves ATLAS levels, which have
 * tapes and declarations; only `procgenOracle` passes `true`. Absent it is
 * `false`, so the page, the battery and the acceptance row are unchanged —
 * and `censusWorld` above builds its run without it for the same reason.
 */
export function solveForPage({
    levelSource, staging, goals, name, now = () => Date.now(), maxTicksPerTarget,
    scratchPersistence = false,
}) {
    const honest = solveStaging(staging);
    const t0 = now();
    const run = createRunForStaging(honest, levelSource, { scratchPersistence });
    const out = solveSegment({ run, goals, name, boot: honest.boot, maxTicksPerTarget });
    const ms = now() - t0;
    const despawns = checkSolveDespawns(staging, run);
    return {
        out,
        run,
        ms,
        despawns,
        // ⛓ Slice 4b: the fold is UNCHANGED — a scratch run's self-declared
        // clears do NOT ride into the tape, because `tapeFormat` bounds
        // `persistence[].level` to the real game's 116 levels and a generated
        // level is 900. See `buildStagedTape`'s docblock for the ruling this
        // measurement overtook; the rows leave through `run.scratchClears`.
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
