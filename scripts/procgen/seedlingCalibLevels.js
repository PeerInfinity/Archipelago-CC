/**
 * seedlingCalibLevels — the PURE half of `probe-seedling-calib-levels.mjs` (the P3 timing probe): the preset's levels,
 * one calib run's per-level report out of vitest's JSON, and the tip/control comparison normalised by the median.
 *
 * The calib file (`frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.calib.test.js`) has one `it` per level of
 * the `seedling_playthrough_maze` preset, titled `<level>: …`, plus a coverage test and a whole-verdict test. vitest's
 * JSON reporter gives each `it` a duration, so a run is a time per level. The levels are DERIVED here the way that file
 * derives them (each sidecar region's carrier `playable_payload.atlas_region`, in sidecar order); a test file cannot be
 * imported without registering its suites, so the derivation is repeated, and `levelReport` holds the two equal (every
 * derived level has exactly one test, and every other test is named as one).
 */

/** The preset's levels, in sidecar order: each region's carrier `atlas_region` (the calib file's `levelOf`). */
export function presetLevels(rules) {
    const sidecars = rules.preset_sidecars['1'];
    const levelOf = (name) => {
        const own = sidecars[name];
        const carrier = own.playable_payload ? own
            : Object.values(sidecars).find((s) => s.playable_payload && s.shared_world === own.shared_world);
        return carrier.playable_payload.atlas_region;
    };
    const levels = [];
    for (const name of Object.keys(sidecars)) {
        const level = levelOf(name);
        if (!levels.includes(level)) levels.push(level);
    }
    return levels;
}

/**
 * One calib run, read out of vitest's JSON report: a row per level (`{ level, ms, status }`, in level order) and the
 * other tests (`{ title, ms, status }`). `problems` names what does not fit: a level with no test or with two, and a
 * test that names no known level but looks like one would (`<id>: …` where `<id>` is not a level).
 */
export function levelReport(vitestJson, levels) {
    const tests = vitestJson.testResults.flatMap((f) => f.assertionResults);
    const problems = [];
    const rows = [];
    const owned = new Set();
    for (const level of levels) {
        const mine = tests.filter((t) => t.title.startsWith(`${level}: `));
        if (mine.length !== 1) problems.push(`${level}: ${mine.length} tests (want exactly 1)`);
        if (mine[0]) {
            owned.add(mine[0]);
            rows.push({ level, ms: Math.round(mine[0].duration ?? 0), status: mine[0].status });
        } else rows.push({ level, ms: null, status: 'missing' });
    }
    const others = tests.filter((t) => !owned.has(t)).map((t) => ({ title: t.title, ms: Math.round(t.duration ?? 0), status: t.status }));
    return { levels: rows, others, problems };
}

/** The median of a non-empty list of numbers (the mean of the middle two for an even count). */
export function median(xs) {
    if (!xs.length) throw new Error('median of an empty list');
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Tip against control, per level. `ratio` = tip ms / control ms; `norm` = ratio / the MEDIAN ratio over the reference
 * levels (every level both runs timed, minus `moved` — the levels the slice says it moved — minus the levels whose
 * control time is under `floorMs`, whose ratio is timer noise). The median is the runner-speed correction: two
 * runners differ by a near-constant factor, and the median ignores the few levels a slice did slow.
 *
 * A level is FLAGGED when its `norm` is over `threshold` AND it costs at least `floorMs` in the control: a level that
 * got slower by a factor the main-vs-main spread never reached, and big enough for the factor to be a measurement.
 * The two numbers are the probe's, derived from measured main-vs-main runs (its docblock says which).
 */
export function compareLevels(tip, control, { moved = [], threshold, floorMs }) {
    if (!(threshold > 1)) throw new Error(`threshold must be > 1 (got ${threshold})`);
    if (!(floorMs >= 0)) throw new Error(`floorMs must be ≥ 0 (got ${floorMs})`);
    const byLevel = (rows) => new Map(rows.filter((r) => Number.isFinite(r.ms)).map((r) => [r.level, r.ms]));
    const T = byLevel(tip.levels);
    const C = byLevel(control.levels);
    const unknownMoved = moved.filter((l) => !C.has(l) && !T.has(l));
    const onlyTip = [...T.keys()].filter((l) => !C.has(l));
    const onlyControl = [...C.keys()].filter((l) => !T.has(l));
    const rows = [...C.keys()].filter((l) => T.has(l)).map((level) => ({
        level, tipMs: T.get(level), controlMs: C.get(level),
        ratio: T.get(level) / Math.max(C.get(level), 1),
        moved: moved.includes(level),
        rated: C.get(level) >= floorMs,
    }));
    const reference = rows.filter((r) => r.rated && !r.moved);
    if (!reference.length) throw new Error(`no reference level (every level is moved or under ${floorMs} ms in the control)`);
    const med = median(reference.map((r) => r.ratio));
    for (const r of rows) {
        r.norm = r.ratio / med;
        r.flagged = r.rated && r.norm > threshold;
    }
    const band = (rs) => (rs.length ? { min: Math.min(...rs.map((r) => r.norm)), max: Math.max(...rs.map((r) => r.norm)) } : null);
    return {
        rows, median: med, referenceCount: reference.length,
        spread: band(reference),
        // the noise band the flags were judged against: the reference levels that were NOT flagged
        unflaggedSpread: band(reference.filter((r) => !r.flagged)),
        flagged: rows.filter((r) => r.flagged).map((r) => r.level),
        onlyTip, onlyControl, unknownMoved,
    };
}

/**
 * The band a MEDIAN ratio is judged against, from the medians of measured main-vs-main pairs. One pair's median m read
 * the other way round is 1/m, so each pair's excess is max(m, 1/m) − 1. The band is the same rule as the per-level
 * threshold: hi = 1 + 2 × the worst excess, lo = 1 / hi. `pairs` is how many pairs it rests on.
 */
export function medianBand(mainMedians) {
    if (!mainMedians.length) throw new Error('a median band needs at least one main-vs-main pair');
    if (!mainMedians.every((m) => m > 0 && Number.isFinite(m))) throw new Error(`a median is a positive ratio (got ${mainMedians.join(',')})`);
    const worst = Math.max(...mainMedians.map((m) => Math.max(m, 1 / m)));
    const hi = 1 + 2 * (worst - 1);
    return { lo: 1 / hi, hi, worst, pairs: mainMedians.length };
}

/**
 * The verdict on one comparison's median ratio. The per-level FLAG divides by the median, so a slowdown that hits EVERY
 * level by the same factor moves only the median and flags nothing. This is the check that sees it: `outside` when the
 * median leaves the main-vs-main band; `direction` is 'slower' (tip slower than control), 'faster' or 'inside'.
 */
export function medianVerdict(median, band) {
    const direction = median > band.hi ? 'slower' : median < band.lo ? 'faster' : 'inside';
    return { median, band, outside: direction !== 'inside', direction };
}

/**
 * Several runs of ONE tree (a paired ABBA pass runs each tree twice) as one report: each level's ms is the mean of its
 * runs (`runsMs` keeps each), its status `passed` only when every run passed (else the first other status); the other
 * tests the same way, by title; `problems` the union. One report comes back as it was, plus `runsMs`.
 */
export function mergeReports(reps) {
    if (!reps.length) throw new Error('mergeReports needs at least one report');
    const mean = (xs) => (xs.every(Number.isFinite) ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    const status = (ss) => ss.find((s) => s !== 'passed') ?? 'passed';
    const levels = reps[0].levels.map((row, i) => {
        const rows = reps.map((r) => r.levels[i]);
        if (rows.some((x) => x?.level !== row.level)) throw new Error(`mergeReports: the runs list different levels at ${i}`);
        return { level: row.level, ms: mean(rows.map((x) => x.ms)), status: status(rows.map((x) => x.status)), runsMs: rows.map((x) => x.ms) };
    });
    const titles = [...new Set(reps.flatMap((r) => r.others.map((t) => t.title)))];
    const others = titles.map((title) => {
        const ts = reps.map((r) => r.others.find((t) => t.title === title));
        return { title, ms: mean(ts.map((t) => t?.ms ?? NaN)) ?? 0, status: status(ts.map((t) => t?.status ?? 'missing')) };
    });
    return { levels, others, problems: [...new Set(reps.flatMap((r) => r.problems))] };
}

/**
 * An abbreviated SHA (4–39 hex digits): a paired run cannot fetch one into a one-commit-deep CI checkout (GitHub
 * fetches a full SHA or a ref name only), so the probe refuses it by name instead of failing inside `git fetch`.
 */
export const isAbbreviatedSha = (ref) => /^[0-9a-f]{4,39}$/i.test(ref);
