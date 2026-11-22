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

/**
 * Whether a comparison judges per-level FLAGs. Not in a PAIRED CONCURRENT run: the two trees share the runner's cores
 * and reach the heavy levels at different moments, so its main-vs-main per-level spread is too close to the FLAG
 * threshold to judge one level by. Its median is still judged. Every other comparison flags.
 */
export const flagsLevels = (paired) => !(paired && paired.order === 'concurrent');

/**
 * The `timeout-minutes` of one job in a workflow file's text (the job's key at two spaces' indent, then its first
 * `timeout-minutes:` before the next job key), or null when the file does not say. A line reader, not a YAML parser:
 * enough for a workflow whose job keys sit at two spaces, as every workflow here does.
 */
export function jobTimeoutMinutes(text, job) {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => l === `  ${job}:`);
    if (start < 0) return null;
    for (const l of lines.slice(start + 1)) {
        if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(l)) return null; // the next job
        const m = /^ {4}timeout-minutes:\s*([0-9]+)\s*$/.exec(l);
        if (m) return Number(m[1]);
    }
    return null;
}

/** A paired run's wall against its job's limit: the fraction used, and `warn` over `warnAt` (a fraction). */
export function wallVerdict(wallS, limitS, warnAt) {
    if (!(limitS > 0)) throw new Error(`a job limit is a positive number of seconds (got ${limitS})`);
    const used = wallS / limitS;
    return { used, warn: used > warnAt };
}

/**
 * Whether an order's band FAILS a row yet: it rests on at least `rule.pairs` pairs, `rule.checkoutTip` of them in the
 * default shape (`shape: 'checkout-tip'`, the tip in the job's own checkout). Below that it is PROVISIONAL (WARN only).
 */
export function bandFails(rows, rule) {
    const checkoutTip = rows.filter((r) => r.shape === 'checkout-tip').length;
    return { fails: rows.length >= rule.pairs && checkoutTip >= rule.checkoutTip, pairs: rows.length, checkoutTip };
}

/**
 * The median verdict as a check row, ONE-SIDED: the probe exists to catch slowdowns, so only a median ABOVE the band
 * fails; below it passes (a faster tip never blocks a landing; the WARN line says to check the control). The text
 * names the side the median is actually on.
 */
export function medianRow(v, label) {
    const where = { slower: 'above', faster: 'below', inside: 'inside' }[v.direction];
    const band = `${v.band.lo.toFixed(3)}–${v.band.hi.toFixed(3)}`;
    const why = { slower: 'a slowdown the main-vs-main noise never reached', faster: 'faster: never a failure', inside: 'main-vs-main noise' }[v.direction];
    return { ok: v.direction !== 'slower', text: `the median ratio ${v.median.toFixed(3)} is ${where} the ${label} main-vs-main band ${band} (${v.band.pairs} pairs; ${why})` };
}
