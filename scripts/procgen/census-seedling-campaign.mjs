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
 *   node scripts/procgen/census-seedling-campaign.mjs --write-frontier
 *   node scripts/procgen/census-seedling-campaign.mjs --check-frontier
 */

import { createHash } from 'node:crypto';
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
/** ⛓ R9 slice 10 — the two frontier modes (see `FRONTIER` below). */
const WRITE_FRONTIER = process.argv.includes('--write-frontier');
const CHECK_FRONTIER = process.argv.includes('--check-frontier');
const OUT_DIR = join(REPO, 'NewDocs', 'plans', 'r9-slice5-census');
const SURVEY_DIR = join(REPO, 'NewDocs', 'plans', 'seedling-editor-survey');

/**
 * ⛓⛓⛓ THE SUBJECT, in sphere order (⚖ ruling 14) — **AND IT IS DERIVED NOW.**
 *
 * Slice 5 spelled this list out and said why: *"there IS no chain for it yet —
 * assembling one is what the fix list is FOR."* R9 slice 6 assembled it, so the
 * subject is the campaign chain's own segments and a chain that grows a room is
 * censused the day it does (trap 495: a typed list decays). ⛓ Slice 10 goes one
 * step further: WHICH chain that is is `director.campaignChoice`'s answer now.
 *
 * ⚠ THE FIX LIST'S SHAPE IS UNCHANGED and that is the point of re-running it: a
 * census whose every pair reads CONTINUES is the same instrument reporting that
 * the work it ordered is done, not a different one reporting success.
 */
/**
 * ⛓⛓⛓ R9 SLICE 10 — **THE SUBJECT IS NOW THE PAGE'S OWN ANSWER**, not a name
 * typed here. `director.campaignChoice` is what the ▶ campaign control asks,
 * and it picks by rule: the custody chain that boots a true start and whose
 * every segment the solver recorded (⚖ ruling 19). ⛔ ONE ANSWER, TWO READERS —
 * the instrument that reports on the campaign and the control that plays it can
 * no longer disagree about which chain that is, which is exactly the drift a
 * second `find(c => c.id === '…')` here would have been free to acquire.
 */
const { campaignChoice } = await import(join(MODULE, 'director.js'));
const CHOICE = campaignChoice();
if (CHOICE.refusal) {
    throw new Error(`census: ${CHOICE.refusal.reason} — ${CHOICE.refusal.detail}\n\n`
        + 'The census\'s subject is the chain the ▶ campaign control plays, and a '
        + 'hand-typed fallback here would report on a walk nobody committed.');
}
const CHAIN_ID = CHOICE.id;
const CHAIN = [...CHOICE.segments];
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

// ─────────────────────────────────────────────────────────────────────
// 5b. ⛓⛓⛓ R9 SLICE 10 — THE FRONTIER, DERIVED, AND COMMITTED AS AN ARTIFACT
// ─────────────────────────────────────────────────────────────────────

/**
 * ⛓⛓⛓ WHERE THE CHAIN STOPS AND WHY — **COMPUTED, NOT TYPED.**
 *
 * ⛔ THIS REPLACED A LITERAL. Until R9 slice 10 this file held
 * `const STOP_STEP = 16;` with a one-line comment, and a literal cannot see the
 * stop MOVE: the day a slice solves L14 the survey's step 16 starts reporting
 * SOLVED and the census would go on printing "the STOP at step 16" as if
 * nothing had happened — which is trap 495 (a typed count decays) wearing a
 * route step's clothes. ⚖ Ruling 17: derive it.
 *
 * ── THE DERIVATION, IN THREE MOVES ────────────────────────────────────
 *
 * 1. **THE CHAIN'S ARRIVALS ARE MEASURED, NOT DECLARED.** Each segment is
 *    walked (`walkOf`) and its `endLevel` is the room it arrives in. That is a
 *    sequence the MODEL produced.
 * 2. **THE ROUTE IS ALIGNED TO IT.** `route.steps[].crossesTo` is the same kind
 *    of sequence from the other side — the survey's own plan — so the chain
 *    covers the longest PREFIX of route steps whose `crossesTo` sequence equals
 *    the measured arrivals. ⛔ An alignment rather than a count: a chain that
 *    grows a room extends the prefix by itself, and a chain that takes a
 *    DIFFERENT route stops matching and says so instead of quietly claiming the
 *    steps it did not walk.
 * 3. **THE STOP IS THE FIRST STEP AFTER THAT PREFIX THE SURVEY REFUSES.** Not
 *    "the next step" — a step the survey SOLVES is a gap with a tape waiting to
 *    be recorded, not a frontier — and not a step number anybody chose.
 *
 * ⚠ AND IF THE ALIGNMENT BREAKS, THE ROW IS UNASSERTED BY NAME. A chain whose
 * arrivals do not prefix the route is a finding about one of the two, and
 * inventing a stop for it would be this script answering a question it was
 * handed the wrong inputs for.
 *
 * ⛔ THE SURVEY JSON IS GITIGNORED (`NewDocs/*`), WHICH IS WHY THE ARTIFACT
 * EXISTS. `campaign-frontier.json` is the COMMITTED PROJECTION of it: the page
 * reads the artifact — it has no other way to know what the next work order is
 * — and `--check-frontier` is what keeps the projection honest against the
 * survey on a machine that has one.
 */
const SOURCE_FILES = Object.freeze([
    'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json',
    'frontend/modules/flashPanel/atlases/seedling-map.json',
    'frontend/modules/flashPanel/atlases/seedling-sphere-order.json',
]);
const FRONTIER_PATH = join(MODULE, 'fixtures', 'campaign-frontier.json');
const md5 = (b) => createHash('md5').update(b).digest('hex');

/**
 * ⛓ THE PROVENANCE THAT SURVIVES A MACHINE. ⛔ NOT a digest of `survey.json`:
 * that file carries per-row `ms` timings, so hashing it would give a
 * fingerprint that moves with the machine and reds for a reason that is not a
 * change (trap 548). These three are the survey's own declared `sources`, all
 * committed, and if any of them moves the route the survey planned may have
 * moved with it.
 */
function sourceDigests() {
    const out = {};
    for (const rel of SOURCE_FILES) {
        const abs = join(REPO, rel);
        out[rel] = existsSync(abs) ? md5(readFileSync(abs)) : null;
    }
    return out;
}

function deriveFrontier(surveyRes) {
    const arrivals = CHAIN.map((n) => walkOf(n)).map((w) => (w.error ? null : w.endLevel));
    const base = {
        artifact_version: 1,
        generatedBy: 'node scripts/procgen/census-seedling-campaign.mjs --write-frontier',
        chain: CHAIN_ID,
        segments: [...CHAIN],
        arrivals,
        sources: sourceDigests(),
    };
    if (arrivals.some((a) => a === null)) {
        return { ...base, lastArrival: null, nextStep: null, refusal: null, covered: null,
            why: 'a chain segment did not walk, so the chain has no measured arrival '
                + 'sequence to align the route against' };
    }
    if (!surveyRes.available) {
        return { ...base, lastArrival: null, nextStep: null, refusal: null, covered: null,
            why: surveyRes.why };
    }
    const steps = surveyRes.steps;
    let covered = 0;
    while (covered < arrivals.length && covered < steps.length
        && steps[covered].crossesTo === arrivals[covered]) covered += 1;
    if (covered !== arrivals.length) {
        return { ...base, lastArrival: null, nextStep: null, refusal: null, covered,
            why: `the chain's measured arrivals stop prefixing the route at segment `
                + `${covered + 1} (${CHAIN[covered]} arrives in L${arrivals[covered]}; `
                + `route step ${steps[covered]?.step} crosses to `
                + `L${steps[covered]?.crossesTo}). A chain that walks a different route `
                + 'has no stop this alignment can name.' };
    }
    const last = steps[covered - 1];
    const refused = steps.slice(covered).find((x) => x.solved && x.solved.refusal);
    if (!refused) {
        return { ...base,
            lastArrival: { step: last.step, level: last.crossesTo, segment: CHAIN.at(-1) },
            nextStep: null, refusal: null, covered,
            why: 'no route step after the chain is refused by the survey — every '
                + 'remaining step SOLVES today, so the frontier is a GAP LIST rather '
                + 'than a refusal and this is a finding, not a stop' };
    }
    return {
        ...base,
        covered,
        lastArrival: { step: last.step, level: last.crossesTo, segment: CHAIN.at(-1) },
        nextStep: {
            step: refused.step,
            level: refused.level,
            visit: refused.visit,
            crossesTo: refused.crossesTo,
            goals: refused.goals.map((g) => g.why),
        },
        refusal: { family: refused.solved.family, text: refused.solved.refusal },
        why: null,
    };
}

const survey = surveyRows();
const FRONTIER = deriveFrontier(survey);

/**
 * ⛔ THE CHECK IS FIELD BY FIELD, AND IT SAYS WHICH FIELDS IT COULD NOT RUN.
 * The four structural fields (`chain`, `segments`, `arrivals`, `sources`) need
 * no survey and therefore run in CI; `lastArrival`, `nextStep` and `refusal`
 * are the survey's answer and are SKIPPED BY NAME where it is absent. A check
 * that cannot run is not a check that passed.
 */
function checkFrontier() {
    if (!existsSync(FRONTIER_PATH)) {
        console.log(`FAIL  ${FRONTIER_PATH} is not on disk — run --write-frontier`);
        return 1;
    }
    const on = JSON.parse(readFileSync(FRONTIER_PATH, 'utf8'));
    const rows = [];
    const cmp = (name, mine, theirs) => rows.push({
        name, ok: JSON.stringify(mine) === JSON.stringify(theirs), mine, theirs,
    });
    cmp('chain', FRONTIER.chain, on.chain);
    cmp('segments', FRONTIER.segments, on.segments);
    cmp('arrivals', FRONTIER.arrivals, on.arrivals);
    cmp('sources', FRONTIER.sources, on.sources);
    if (survey.available && FRONTIER.nextStep) {
        cmp('lastArrival', FRONTIER.lastArrival, on.lastArrival);
        cmp('nextStep', FRONTIER.nextStep, on.nextStep);
        cmp('refusal', FRONTIER.refusal, on.refusal);
    } else {
        console.log('SKIP  lastArrival / nextStep / refusal — '
            + `${FRONTIER.why ?? survey.why}\n      A check that cannot run is not a `
            + 'check that passed; the four structural rows below still do.');
    }
    let bad = 0;
    for (const r of rows) {
        if (!r.ok) bad += 1;
        console.log(`${r.ok ? 'PASS' : 'FAIL'}  campaign-frontier.json: ${r.name}`);
        if (!r.ok) {
            console.log(`      on disk : ${JSON.stringify(r.theirs)}`);
            console.log(`      derived : ${JSON.stringify(r.mine)}`);
        }
    }
    console.log(`\n  ${rows.length - bad} pass, ${bad} fail`);
    if (bad) {
        console.log('\n⛔ THE ARTIFACT IS STALE. It is a PROJECTION of the route survey '
            + 'and of this chain, and one of them has moved. Re-derive it with\n  node '
            + 'scripts/procgen/census-seedling-campaign.mjs --write-frontier');
    }
    return bad ? 1 : 0;
}

if (CHECK_FRONTIER) process.exit(checkFrontier());
if (WRITE_FRONTIER) {
    writeFileSync(FRONTIER_PATH, `${JSON.stringify(FRONTIER, null, 2)}\n`);
    console.log(`wrote ${FRONTIER_PATH}`);
    process.exit(0);
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
say(`THEN: ${GAP_STEPS.length} route steps with NO tape, then the STOP at `
    + (FRONTIER.nextStep ? `step ${FRONTIER.nextStep.step} (L${FRONTIER.nextStep.level}) — `
        + `${FRONTIER.refusal.family.split(' —')[0]}.`
        : `an UNASSERTED step — ${FRONTIER.why}`));
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
    if (FRONTIER.nextStep) {
        fix.push({
            segment: `route step ${FRONTIER.nextStep.step} (L${FRONTIER.nextStep.level})`,
            kind: 'STOPS',
            reason: FRONTIER.refusal.family,
        });
    } else {
        // ⛓ THE STOP MOVED, OR THE ALIGNMENT BROKE — either is a FINDING, and
        // the derivation says which rather than printing a step nobody derived.
        fix.push({ segment: 'route steps', kind: 'FINDING', reason: FRONTIER.why });
    }
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
        chain: CHAIN, tail: TAIL, gapSteps: GAP_STEPS, frontier: FRONTIER,
        chainRows, tailRows, chainWhole, tailWhole, fix, exposures,
        surveyAvailable: survey.available,
    }, null, 2));
}
