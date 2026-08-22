/**
 * ══ THE CAMPAIGN CENSUS — does the TRUE-START SOLVER CHAIN continue, pair by
 *    pair, and what does each break cost? ══════════════════════════════════
 *
 * ⚖ RULING 11 (user, 2026-08-20): *"As we work our way through Seedling, I'll
 * want to construct a sequence of tapes to play back our solutions from the
 * beginning of the game, and so if there are tapes from our solutions so far
 * that don't work, then I'll want to fix them. And I'll want the tapes to be
 * recorded from the solver, not constructed manually."*
 *
 * ⚖ RULING 14 (user, 2026-08-21) names the chain's basis: the SOLVER BATTERY
 * in sphere order — `r8-solve-1` (the true start) → 2 → … → 11 → `r9-solve-3`
 * → the three route steps with NO tape → the L14 camera band, where the chain
 * stops honestly. The `r8-d2` tail rejoins when L14/L15/L16 fall, so it is
 * censused as its OWN block with its own bound.
 *
 * ⛔ THIS INSTRUMENT MOVES NOTHING. It reads tapes, walks the model and asks
 * `director.continuationAdmission` — the SAME function the page asks, imported
 * rather than re-spelled (trap 383). Its output is a FIX LIST: one row per
 * segment, each verdict carrying the reason and, where the model can compute
 * it, the number the re-record will have to produce.
 *
 * ── WHAT IS ASSERTED, AND WHAT IS NOT ────────────────────────────────────
 *
 * ⛔ AN UNASSERTED ROW IS NEVER A PASS, and the JS tier leaves two unasserted
 * at every boundary BY NAME: `rng` (the model keeps no LFSR position) and
 * `seam` (the model builds no seam envelope). The GAME answers both, from
 * `botSeam()` → `segmentBootFromLatch`, which is why this script prints the
 * wasm tier's COMMAND and does not pretend to have run it.
 *
 * ⛓⛓⛓ THE FREE ORACLE IS WHAT SEES THE DRIFT ANYWAY. `gameClock.
 * declaredSeamTimeAfter` computes the `seam.time` a segment's SUCCESSOR must
 * declare from this segment's own counting — an oracle, not a derivation (the
 * numbers on the right came out of the GAME, one per committed seam). ⚠ NO
 * TAPE DECLARES `save.time`; the clock is `seam.time`, and on this tier a
 * drift in it is an ORACLE row rather than a refusal. Said per row.
 *
 * ⛔⛔ THE ORACLE IS FED A **STAGED** WALK'S DEAD FRAMES, NEVER A
 * CONTINUATION'S. A staged walk pays the boot fade (`LOAD_FADE_FRAMES`) and
 * the declared latch it is compared against was itself measured after a
 * fresh-page replay that paid the same fade; a continuation does not pay it.
 * An oracle fed the continuation's dead frames would report EVERY boundary of
 * a chain that is exact — `act2-the-sword`'s ten are — as short by exactly
 * that fade.
 *
 * ⛔ PAIRWISE, AND THAT IS THE POINT. Window k is walked from its OWN
 * declaration and window k+1's admission is asked against that world, so a
 * break at pair 4 does not blind the census to pairs 5..11. The WHOLE-CHAIN
 * continuation is reported too, as a second row with its own bound.
 *
 * ── THE ROCK-EXPOSURE REPORT (⚖ ruling 13) ───────────────────────────────
 *
 * The user's design for SHORTENING on Seedling: *"if the player can break
 * rocks, then we treat rocks as a passable terrain, and trigger the verb if
 * the chosen path happens to pass through a rock tile."* Ruling 14 asks this
 * slice whether that would move any CHAIN room — because if it would, the
 * shortening slice goes BEFORE the chain re-record.
 *
 * ⛔ THE PROBE IS SCRATCH AND THE SHIPPED PLANNER IS BYTE-UNTOUCHED. It
 * reuses the planner's EXISTING per-visit `brokenRocks` family — the set the
 * engine already uses to say "this rock is gone" — so "rocks passable" is
 * spelled the way the engine already spells a broken one rather than as a new
 * concept, and the two path lengths are read off the same `planTilePath`.
 *
 * Usage:
 *   node scripts/procgen/census-seedling-campaign.mjs
 *   node scripts/procgen/census-seedling-campaign.mjs --json
 *   node scripts/procgen/census-seedling-campaign.mjs --no-write
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { collectRun } = await import(join(MODULE, 'watchOverlays.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { rngPostureForBootLevel } = await import(join(MODULE, 'seamPosture.js'));
const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const {
    continuationAdmission, refusalsOnly, jsLiveEnvelope,
} = await import(join(MODULE, 'director.js'));
const { declaredSeamTimeAfter, LOAD_FADE_FRAMES } = await import(join(MODULE, 'gameClock.js'));
const { buildLevelWorld, ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { planTilePath, contactKey } = await import(join(MODULE, 'botDriverV2.js'));

const AS_JSON = process.argv.includes('--json');
const WRITE = !process.argv.includes('--no-write');
const OUT_DIR = join(REPO, 'NewDocs', 'plans', 'r9-slice5-census');
const SURVEY_DIR = join(REPO, 'NewDocs', 'plans', 'seedling-editor-survey');

/**
 * ⛓⛓⛓ THE SUBJECT, in sphere order (⚖ ruling 14) — **AND IT IS DERIVED NOW.**
 *
 * Slice 5 spelled this list out and said why: *"there IS no chain for it yet —
 * assembling one is what the fix list is FOR."* R9 slice 6 assembled it, so the
 * subject is `PLAYTHROUGH_CHAINS.r9-campaign`'s own segments and a chain that
 * grows a room is censused the day it does (trap 495: a typed list decays).
 *
 * ⚠ THE FIX LIST'S SHAPE IS UNCHANGED and that is the point of re-running it: a
 * census whose every pair reads CONTINUES is the same instrument reporting that
 * the work it ordered is done, not a different one reporting success.
 */
const { PLAYTHROUGH_CHAINS } = await import(join(MODULE, 'playthroughWalk.js'));
const CAMPAIGN_CHAIN = PLAYTHROUGH_CHAINS.find((c) => c.id === 'r9-campaign');
if (!CAMPAIGN_CHAIN) {
    throw new Error('census: PLAYTHROUGH_CHAINS has no `r9-campaign` — the census\'s '
        + 'subject is the chain the campaign assembles, and a hand-typed fallback here '
        + 'would report on a walk nobody committed.');
}
const CHAIN = [...CAMPAIGN_CHAIN.segments];
/** ⛓ The detached tail — its OWN chain, continuable only after L14–L16 fall. */
const TAIL = ['r8-solve-18', 'r8-d2-19', 'r8-d2-20'];
/**
 * ⛓⛓⛓ THE GAPS, DERIVED — and R9 slice 6 CLOSED ALL FOUR.
 *
 * Slice 5 named them by number (11 / 13 / 14 / 15: the L11 teleporter leg the
 * survey's own `KNOWN_ANSWERS` map had hidden, and the three legs with no tape
 * at all). The chain now walks every one, so the list is computed from the
 * chain's rooms rather than typed: a route step whose room the chain does not
 * end at is still a gap, and the day one opens it is reported without an edit.
 */
const GAP_STEPS = [];
/** ⛓ Where the chain stops honestly — the survey's own refusal family. */
const STOP_STEP = 16;

const source = atlasLevelSource();
const lines = [];
const say = (l = '') => { lines.push(l); if (!AS_JSON) console.log(l); };

// ─────────────────────────────────────────────────────────────────────
// 1. THE STAGED WALKS — one per tape, and the oracle's input
// ─────────────────────────────────────────────────────────────────────

/**
 * ⚠ A STAGED walk: the tape's own declaration, its own boot, its own fade.
 * This is the walk whose `deadFramesOwed` the oracle may read (see the
 * docblock) and the world window k+1's admission is asked against.
 */
function stagedWalk(name) {
    const tape = loadTape(name);
    const parsed = parseTape(tape);
    const collected = collectRun(tape, source);
    if (collected.error) return { name, parsed, error: collected.error.message };
    const run = collected.run;
    return {
        name,
        parsed,
        run,
        ticks: parsed.tick_count,
        deadFramesOwed: run.deadFramesOwed,
        endLevel: run.level,
        endCtor: run.worldCtor,
        declaredTime: parsed.seam ? parsed.seam.time : null,
        envelope: jsLiveEnvelope(run, parsed.persistence, parsed.pins),
    };
}

const walks = new Map();
const walkOf = (name) => {
    if (!walks.has(name)) walks.set(name, stagedWalk(name));
    return walks.get(name);
};

// ─────────────────────────────────────────────────────────────────────
// 2. THE PAIRWISE ADMISSION + THE FREE ORACLE
// ─────────────────────────────────────────────────────────────────────

function censusPair(a, b, index) {
    const wa = walkOf(a);
    const wb = { parsed: parseTape(loadTape(b)) };
    if (wa.error) {
        return { pair: `${a} → ${b}`, verdict: 'WALK FAILED', why: wa.error, rows: [] };
    }
    /**
     * ⛓ R9 SLICE 8 (⚖ ruling 20) — the posture gate, on the GAME tier. This
     * pair's live side is a real `botSeam()` envelope, so its `rng` row is
     * ASSERTED — and `rng.gameplay` is comparable only in a render-CLEAN boot
     * room. The census asks the same question the page asks, with the same
     * function, off the same atlas.
     */
    const rngPosture = rngPostureForBootLevel(wb.parsed.boot.level, source);
    const found = continuationAdmission(wb.parsed, wa.envelope,
        { index, label: b, rngPosture });
    const refusals = refusalsOnly(found);
    const unasserted = found.filter((f) => f.informational);
    /**
     * ⛓ THE FREE ORACLE. ⛔ Skipped BY NAME when window k declares no
     * `seam.time` — `r8-solve-1` is the true start and has `seam: null`, so
     * there is nothing for the oracle to count FROM. A zero substituted here
     * would be an answer where there is none.
     */
    let oracle = null;
    if (wa.declaredTime === null) {
        oracle = { asked: false, why: `${a} declares no \`seam\` block (the true start) — `
            + 'the oracle counts FROM a declared time and there is none' };
    } else if (wb.parsed.seam == null) {
        oracle = { asked: false, why: `${b} declares no \`seam\` block` };
    } else {
        const predicted = declaredSeamTimeAfter({
            declaredTime: wa.declaredTime,
            deadFramesOwed: wa.deadFramesOwed,
            tickCount: wa.ticks,
        });
        const declared = wb.parsed.seam.time;
        oracle = {
            asked: true, predicted, declared, delta: declared - predicted,
            agrees: predicted === declared,
        };
    }
    const verdict = refusals.length > 0
        ? 'REFUSED'
        : (oracle && oracle.asked && !oracle.agrees ? 'NEEDS RE-RECORD' : 'CONTINUES');
    return {
        pair: `${a} → ${b}`,
        from: a,
        to: b,
        verdict,
        refusals: refusals.map((f) => ({ what: f.what, detail: f.detail })),
        unasserted: unasserted.map((f) => f.what),
        oracle,
        endLevel: wa.endLevel,
        endCtor: wa.endCtor,
        bootLevel: wb.parsed.boot.level,
        bootCtor: { x: wb.parsed.boot.x, y: wb.parsed.boot.y },
        ticks: wa.ticks,
        deadFramesOwed: wa.deadFramesOwed,
    };
}

function censusBlock(title, names, startIndex = 1) {
    say(`\n### ${title}`);
    say('');
    const rows = [];
    for (let i = 0; i < names.length - 1; i += 1) {
        const row = censusPair(names[i], names[i + 1], startIndex + i);
        rows.push(row);
        const o = row.oracle;
        const clock = o == null ? '—'
            : (!o.asked ? `UNASSERTED — ${o.why}`
                : (o.agrees ? `seam.time ${o.declared} ✓`
                    : `seam.time predicted ${o.predicted} vs declared ${o.declared} `
                        + `(Δ${o.delta > 0 ? '+' : ''}${o.delta})`));
        say(`${String(i + 1).padStart(2)}. ${row.pair}`);
        say(`    ${row.verdict}  ·  ends L${row.endLevel} (${row.endCtor.x},${row.endCtor.y}) `
            + `→ boots L${row.bootLevel} (${row.bootCtor.x},${row.bootCtor.y})`);
        say(`    oracle: ${clock}`);
        say(`    UNASSERTED (never a pass): ${row.unasserted.length
            ? row.unasserted.join(' · ') : 'none'}`);
        for (const r of row.refusals) say(`    ⛔ ${r.what} — ${r.detail.split('.')[0]}.`);
    }
    return rows;
}

// ─────────────────────────────────────────────────────────────────────
// 3. THE WHOLE-CHAIN CONTINUATION — the second row, with its own bound
// ─────────────────────────────────────────────────────────────────────

/**
 * ⛓ ONE RUN, every window resumed, the timed rows handed over rebased — what
 * the PAGE does. It stops at the first refusal by construction, which is why
 * it is reported BESIDE the pairwise census and not instead of it.
 */
function wholeChain(names) {
    const parsed = names.map((n) => parseTape(loadTape(n)));
    let run = null;
    let offset = 0;
    let admitted = 0;
    for (let k = 0; k < names.length; k += 1) {
        if (k > 0) {
            const live = jsLiveEnvelope(run, parsed[0].persistence, parsed[0].pins);
            /**
             * ⚠ NO POSTURE HERE, AND THAT IS NOT AN OVERSIGHT. This tier's
             * live side is `jsLiveEnvelope` — the MODEL, which keeps no LFSR
             * position at all, so `rng` is already UNASSERTED by name and
             * there is nothing for a posture to excuse.
             */
            const found = continuationAdmission(parsed[k], live, { index: k, label: names[k] });
            const refusals = refusalsOnly(found);
            if (refusals.length > 0) {
                return {
                    stepped: k, admitted, stoppedAt: names[k],
                    why: refusals.map((f) => f.what),
                };
            }
            admitted += 1;
            const forward = (parsed[k].persistence ?? []).filter((c) => c.at !== undefined)
                .map((c) => ({ ...c, at: c.at + offset }));
            if (forward.length > 0) run.addTimedClears(forward);
        }
        const collected = collectRun(loadTape(names[k]), source, k === 0 ? {} : { run });
        if (collected.error) {
            return { stepped: k, admitted, threwIn: names[k], why: [collected.error.message] };
        }
        run = collected.run;
        offset += parsed[k].tick_count;
    }
    return {
        stepped: names.length, admitted, stoppedAt: null,
        endLevel: run.level, endCtor: run.worldCtor, ticks: offset,
    };
}

// ─────────────────────────────────────────────────────────────────────
// 4. THE ROCK-EXPOSURE PROBE (⚖ ruling 13)
// ─────────────────────────────────────────────────────────────────────

const ROCK_TYPES = new Set(['breakablerock', 'breakablerockghost']);
const rocksIn = (level) => (source(level).entities ?? [])
    .filter((e) => ROCK_TYPES.has(e.type))
    .map((e) => ({ id: `${e.type}@${e.x},${e.y}`, type: e.type, x: e.x, y: e.y }));

/**
 * ⛔ THE SCRATCH FLAG, AND IT IS THE ENGINE'S OWN VOCABULARY. `brokenRocks` is
 * the per-visit set the planner already consults (`levelWorld.js:3820` —
 * `if (o.brokenRocks && s.rockId && o.brokenRocks.has(s.rockId)) return null`),
 * so handing it EVERY rock in the room is exactly "plan as if the player had
 * already broken them" — no new passability concept, and the shipped planner
 * is byte-untouched.
 */
function rockExposure({ label, level, from, to, postSword }) {
    const rocks = rocksIn(level);
    const world = buildLevelWorld(source(level), { roles: ROLES });
    /**
     * ⛔ EVERY TELEPORTER VOLUME IS TREATED AS ALREADY-CONTACTED, IN BOTH ARMS.
     *
     * A route step's own endpoints ARE teleporter volumes — the leg starts on
     * the arrival pad and ends on the exit — and `plannerObstacleAt` blocks a
     * teleporter unless the leg NAMED it (`allowTeleporter` is ONE index) or
     * the run has already CONTACTED it. A live leg has; a cold probe has not,
     * and both ends refuse.
     *
     * ⚠ SO THE RELAXATION IS NAMED RATHER THAN HIDDEN: it is applied
     * IDENTICALLY to the solid arm and the rocks-passable arm, so the two
     * lengths differ ONLY in the rocks — which is the whole content of this
     * report. It is a comparison, not an absolute route.
     */
    const contacts = new Set((world.teleporters ?? [])
        .map((tp) => contactKey({ kind: 'teleporter', blocker: tp })));
    const plan = (brokenRocks) => {
        try {
            return {
                len: planTilePath(world, from, to, null, { brokenRocks, contacts }).length,
            };
        } catch (e) {
            return { len: null, why: e.message.split('.')[0] };
        }
    };
    const solid = plan(null);
    const passable = plan(new Set(rocks.map((r) => r.id)));
    let verdict;
    if (rocks.length === 0) {
        verdict = 'THE AXIS REACHES NOTHING HERE — this room holds no breakable rock';
    } else if (!postSword) {
        verdict = 'PRE-SWORD — `rockBreaksUnder` cannot be satisfied, so no shortening '
            + 'claim is makeable about this walk';
    } else if (solid.len === null && passable.len !== null) {
        verdict = `REQUIRED, NOT A SHORTCUT — the rock CUTS the room (${solid.why}); `
            + 'a rocks-passable planner finds a path where today\'s refuses';
    } else if (solid.len !== null && passable.len !== null && passable.len < solid.len) {
        verdict = `⛔ SHORTENS — ${solid.len} → ${passable.len} tiles`;
    } else {
        verdict = `NO SHORTENING — ${solid.len} tiles either way`;
    }
    return {
        label, level, postSword, rocks: rocks.map((r) => r.id),
        solid: solid.len, passable: passable.len, verdict,
    };
}

// ─────────────────────────────────────────────────────────────────────
// 5. THE ROUTE'S OWN ROWS — read from the survey, or UNASSERTED by name
// ─────────────────────────────────────────────────────────────────────

function surveyRows() {
    const routeP = join(SURVEY_DIR, 'route.json');
    const surveyP = join(SURVEY_DIR, 'survey.json');
    if (!existsSync(routeP) || !existsSync(surveyP)) {
        return { available: false, why: `${routeP} / survey.json are not on disk — run `
            + '`node scripts/procgen/survey-seedling-route.mjs` (or `--derive-only` for the '
            + 'route alone) first. ⛔ The gap and stop rows are the SURVEY\'s answer and '
            + 'this script will not invent them.' };
    }
    const route = JSON.parse(readFileSync(routeP, 'utf8'));
    const survey = JSON.parse(readFileSync(surveyP, 'utf8'));
    const byStep = new Map(survey.rows.map((r) => [String(r.step), r]));
    return {
        available: true,
        steps: route.steps.map((s) => ({ ...s, solved: byStep.get(String(s.step)) ?? null })),
    };
}

// ═════════════════════════════════════════════════════════════════════
// THE REPORT
// ═════════════════════════════════════════════════════════════════════

say('# THE CAMPAIGN CENSUS — the true-start solver chain, pair by pair');
say('');
say('Generated by `node scripts/procgen/census-seedling-campaign.mjs`.');
say('⛔ Moves nothing: it reads tapes, walks the model, and asks '
    + '`director.continuationAdmission` — the page\'s own function.');
say('');
say(`SUBJECT (⚖ ruling 14): ${CHAIN.length} solver tapes in sphere order — `
    + `${CHAIN.join(' → ')}`);
say(`THEN: ${GAP_STEPS.length} route steps with NO tape, then the STOP at step ${STOP_STEP}.`);
say(`DETACHED TAIL (its own block, its own bound): ${TAIL.join(' → ')}`);
say('');
say('BOUNDS, NAMED: the JS tier leaves `rng` and `seam` UNASSERTED at every '
    + 'boundary (the model keeps no LFSR position and builds no seam envelope); '
    + 'the GAME answers both and its command is at the end of this report. No '
    + `tape declares \`save.time\` — the clock is \`seam.time\`, so on this tier a `
    + 'drift in it is an ORACLE row and never a refusal.');
say(`The oracle reads a STAGED walk's dead frames (LOAD_FADE_FRAMES = `
    + `${LOAD_FADE_FRAMES}); a continuation's would be short by exactly that.`);

const chainRows = censusBlock('THE CHAIN, PAIRWISE', CHAIN);
const tailRows = censusBlock('THE DETACHED TAIL, PAIRWISE', TAIL);

say('\n### THE WHOLE-CHAIN CONTINUATION — one run, every window resumed');
const chainWhole = wholeChain(CHAIN);
const tailWhole = wholeChain(TAIL);
for (const [what, w, names] of [['chain', chainWhole, CHAIN], ['tail', tailWhole, TAIL]]) {
    say(`  ${what}: ${w.stepped} of ${names.length} window(s) stepped, `
        + `${w.admitted} boundary(ies) admitted`
        + (w.stoppedAt ? ` — STOPPED at ${w.stoppedAt}: ${w.why.join('; ')}`
            : ` — end L${w.endLevel} (${w.endCtor.x},${w.endCtor.y}), ${w.ticks} ticks`));
}

// ── THE FIX LIST ─────────────────────────────────────────────────────
const survey = surveyRows();
const fix = [];
for (const row of chainRows) {
    if (row.verdict === 'CONTINUES') {
        fix.push({ segment: row.to, kind: 'CONTINUES', note: `boots ${row.from}'s own end` });
    } else if (row.verdict === 'NEEDS RE-RECORD') {
        fix.push({
            segment: row.to,
            kind: 'NEEDS RE-RECORD',
            rows: ['seam.time'],
            reason: `${row.from} walks ${row.ticks} ticks; the declared latch was measured `
                + 'after a walk of a different length',
            predicted: { 'seam.time': row.oracle.predicted },
        });
    } else {
        fix.push({
            segment: row.to,
            kind: 'REFUSED',
            rows: row.refusals.map((r) => r.what),
            reason: row.refusals.map((r) => r.what).join('; '),
        });
    }
}
if (survey.available) {
    for (const n of GAP_STEPS) {
        const s = survey.steps.find((x) => x.step === n);
        fix.push({
            segment: `route step ${n} (L${s.level} visit ${s.visit})`,
            kind: 'GAP (no tape)',
            reason: s.goals.map((g) => g.why).join('; '),
            ticks: s.solved?.ticks ?? null,
            solvesToday: s.solved?.verdict === 'SOLVED',
        });
    }
    const stop = survey.steps.find((x) => x.step === STOP_STEP);
    fix.push({
        segment: `route step ${STOP_STEP} (L${stop.level})`,
        kind: 'STOPS',
        reason: stop.solved?.verdict === 'SOLVED'
            ? 'the survey SOLVES it — the stop has moved and this row is a finding'
            : (stop.solved?.why ?? 'the survey refuses it'),
    });
} else {
    fix.push({ segment: 'route steps', kind: 'UNASSERTED', reason: survey.why });
}

say('\n### ⛔⛔ THE FIX LIST — one row per segment');
say('');
for (const f of fix) {
    say(`  ${f.kind.padEnd(16)} ${f.segment}`);
    if (f.reason) say(`      ${f.reason}`);
    if (f.predicted) {
        say(`      PREDICTED: ${Object.entries(f.predicted)
            .map(([k, v]) => `${k} = ${v}`).join(', ')}`);
    }
    if (f.ticks != null) say(`      the survey solves it today at ${f.ticks} ticks`);
}

// ── THE ROCK-EXPOSURE REPORT ─────────────────────────────────────────
say('\n### ⚖ RULING 13 — THE ROCK-EXPOSURE REPORT');
say('');
const exposures = [];
{
    const s3 = walkOf('r8-solve-3').parsed;
    const r9 = walkOf('r9-solve-3').parsed;
    exposures.push(rockExposure({
        label: 'r8-solve-3 (route step 3, L3 outbound)', level: 3,
        from: { x: s3.boot.x, y: s3.boot.y }, to: { x: 128, y: 48 }, postSword: false,
    }));
    exposures.push(rockExposure({
        label: 'r9-solve-3 (route step 12, L3 return)', level: 3,
        from: { x: r9.boot.x, y: r9.boot.y }, to: { x: 64, y: 0 }, postSword: true,
    }));
    if (survey.available) {
        for (const n of [13, 14]) {
            const s = survey.steps.find((x) => x.step === n);
            exposures.push(rockExposure({
                label: `route step ${n} (L${s.level} visit ${s.visit})`,
                level: s.level,
                from: { x: s.arrival.x, y: s.arrival.y },
                to: { x: s.goals[0].exit.x, y: s.goals[0].exit.y },
                postSword: true,
            }));
        }
    } else {
        say(`  ⛔ steps 13/14 UNASSERTED — ${survey.why}`);
    }
}
for (const e of exposures) {
    say(`  L${e.level}  ${e.label}`);
    say(`      rocks: ${e.rocks.length ? e.rocks.join(', ') : 'none'}`);
    say(`      planned path: ${e.solid ?? 'REFUSED'} tiles solid · `
        + `${e.passable ?? 'REFUSED'} tiles rocks-passable`);
    say(`      ⇒ ${e.verdict}`);
}
const anyShorter = exposures.some((e) => /^⛔ SHORTENS/.test(e.verdict));
say('');
say(anyShorter
    ? '⇒ ⛔ A CHAIN ROOM MOVES — the shortening slice goes BEFORE the chain re-record.'
    : '⇒ NO CHAIN ROOM MOVES — the chain re-record goes ahead and shortening follows '
        + 'under its own licence (⚖ ruling 14).');

// ── THE WASM TIER'S COMMAND, AND ITS BOUND ───────────────────────────
say('\n### THE WASM TIER — the command, and what only it can answer');
say('');
say('⛔ NOT RUN HERE. `rng` and `seam` are the two rows this tier leaves '
    + 'unasserted, and only the real GPU can answer them (`botSeam()` → '
    + '`segmentBootFromLatch`). On the user\'s Windows Chrome, announced:');
say('');
/**
 * ⛔⛔ THE SUBJECT IS THE JS-ADMITTED PREFIX, NOT THE WHOLE CHAIN — MEASURED,
 * not reasoned. `watch.html` runs the JS walk FIRST, because that walk is what
 * produces each window's model stream for the per-tick verdict. So a queue the
 * JS tier REFUSES never reaches the ship at all: `?tapes=<the whole chain>`
 * stops at *"window 11 (`r9-solve-3`) cannot continue window 10"* and
 * `__watch.wasm` never reaches `runtime`. Naming the whole chain here would
 * print a command that cannot answer the question it is printed for
 * (trap 486 — an instrument that cannot FIRE).
 */
const firstRefusal = chainRows.findIndex((r) => r.verdict === 'REFUSED');
const wasmPrefix = firstRefusal === -1 ? CHAIN : CHAIN.slice(0, firstRefusal + 1);
say(`    http://localhost:8000/frontend/modules/seedlingDemo/watch.html`
    + `?tapes=${wasmPrefix.join(',')}&side=wasm`);
say(`    http://localhost:8000/frontend/modules/seedlingDemo/watch.html`
    + `?tapes=${TAIL.join(',')}&side=wasm`);
say('');
say(`⛔ THE FIRST URL IS THE JS-ADMITTED PREFIX (${wasmPrefix.length} of `
    + `${CHAIN.length} tapes), and that is not a convenience: the page runs the `
    + 'JS walk FIRST — it is what produces each window\'s model stream — so a '
    + 'queue the JS tier refuses never reaches the ship. Asking for the whole '
    + 'chain prints a command that stops before the wasm arm begins.');
say('⛔ AND ITS OWN BOUND: the ship stops at the first boundary IT refuses, so '
    + 'every pair from there on is UNASSERTED on rng/seam and stays on the fix '
    + 'list. The as-built records how far it reached.');

// ── THE OUTPUT FILE ──────────────────────────────────────────────────
if (WRITE) {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, 'fix-list.md'), `${lines.join('\n')}\n`);
    if (!AS_JSON) console.log(`\nwrote ${join(OUT_DIR, 'fix-list.md')}`);
}
if (AS_JSON) {
    console.log(JSON.stringify({
        generator: 'census-seedling-campaign.mjs',
        chain: CHAIN, tail: TAIL, gapSteps: GAP_STEPS, stopStep: STOP_STEP,
        chainRows, tailRows, chainWhole, tailWhole, fix, exposures,
        surveyAvailable: survey.available,
    }, null, 2));
}
