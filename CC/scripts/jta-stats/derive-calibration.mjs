#!/usr/bin/env node
/**
 * Phase 3c — derive the estimator correction curve for the zone-randomization
 * balancer (plan §2 caveat 1).
 *
 * `estimateResetsToComplete` assumes a DEDICATED grind: the task is worked on
 * every tick of every reset. Real automation splits attention across the whole
 * task queue, buys items, trips thresholds. So the estimate is a biased
 * predictor of the number of resets a task actually takes, and the balancer —
 * which inverts the estimator to pick a `cost_multiplier` — has to correct for
 * that bias or it will systematically mis-pace.
 *
 * Phase 0's `profile-vanilla.mjs` already sampled the raw pairs: at every Nth
 * run boundary it recorded `estimateResetsToComplete` for each not-yet-complete
 * task near the frontier. Joining those against the run each task actually
 * completed on gives (estimate at decision time → actual resets to completion).
 *
 * The aggregate table committed in `vanilla-profile.json` is WHOLE-GAME and,
 * under spark-off, tail-dominated: late tasks sit for hundreds of runs while
 * prestige spark accumulates, which swamps the signal and makes the curve
 * non-monotonic. SUMMARY.md Round 5 says to derive the balancer's curve from
 * the zone<=14 samples instead. That is what this script does.
 *
 * One property of the resulting curve is load-bearing, and it is a real bound on
 * how precisely cost can pace anything:
 *
 *   A FLOOR. Even at estimate 0 ("completable right now") the median task still
 *   takes ~6 resets to actually complete, because automation works a priority
 *   queue and doesn't reach it immediately. Targets below the floor are
 *   unreachable by cost alone. This is robust: it rests on the largest bucket
 *   (est 0 carries most samples).
 *
 * `floorResets` and `plateauResets` are simply the ends of the measured curve.
 * The upper end is a SAMPLING LIMIT, not a game property — it is the median
 * actual for the highest estimate bucket we observed, and the curve is still
 * climbing there. (An earlier sparse run at --sample-every 5 showed the medians
 * flattening past estimate ~10 and that was read as a "plateau" caused by skill
 * XP compounding; --sample-every 1 quintupled the samples and the flattening
 * disappeared. Bucket medians at n ~ 20 are not to be trusted.)
 *
 * Because bucket medians are still somewhat noisy and need not come out
 * monotone, the emitted `curve` is an isotonic (pool-adjacent-violators) fit of
 * median actual against estimate. The balancer inverts that monotone curve and
 * clamps to [floorResets, plateauResets], reporting any target it could not
 * reach.
 *
 * Usage:
 *   node CC/scripts/jta-stats/derive-calibration.mjs [--zone-limit 14] [--variant standalone]
 *
 * Reads   results/vanilla-profile-raw-<variant>.json  +  results/vanilla-profile.json
 * Writes  results/calibration-<variant>-z<zoneLimit>.json
 *
 * The balancer consumes the STANDALONE variant: since `energyBonusSync` became
 * the default, substrate play is natively standalone-paced (2026-07-08 ruling),
 * so that is the runtime the correction curve has to describe. pinned100 stays
 * derivable for comparison.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(here, 'results');

// The four zone-0..14 tasks with no in-game unlocker (SeeBeyondTheVeil-gated).
// Excluded from the v1 location pool, the pacing walk, and — here — the
// calibration universe, so their multi-hundred-reset waits don't skew it.
const SBTV_GATED_TASK_IDS = new Set([17, 28, 88, 158]);

// Estimate buckets, matching profile-vanilla.mjs's so the two tables can be
// read side by side. `>cap` samples are dropped: the estimator returns
// max_resets+1 for "unreachable within the cap", which is a censored
// observation, not a measurement.
const BUCKETS = [[0, 0], [1, 1], [2, 2], [3, 5], [6, 10], [11, 20], [21, 50], [51, 200]];
const ESTIMATOR_CAP = 200;

function parseArgs(argv) {
    // --label matches profile-vanilla.mjs's: it selects which profiling run to
    // read (e.g. --no-prestige writes the "noprestige" label) and keeps a
    // re-derivation from overwriting the committed curve.
    const out = { zoneLimit: 14, variant: 'standalone', label: '' };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--zone-limit') out.zoneLimit = Number(argv[++i]);
        else if (argv[i] === '--variant') out.variant = argv[++i];
        else if (argv[i] === '--label') out.label = argv[++i];
        else throw new Error(`unknown arg ${argv[i]}`);
    }
    return out;
}

const quantile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const stats = (values) => {
    if (!values.length) return null;
    const s = [...values].sort((a, b) => a - b);
    const mean = s.reduce((a, b) => a + b, 0) / s.length;
    return {
        n: s.length,
        mean: Number(mean.toFixed(2)),
        p25: quantile(s, 0.25),
        p50: quantile(s, 0.5),
        p75: quantile(s, 0.75),
        p90: quantile(s, 0.9),
        max: s[s.length - 1],
    };
};

/**
 * Pool-adjacent-violators: the least-squares-closest non-decreasing sequence to
 * `ys`, weighted by `ws`. Turns the noisy bucket medians into a curve that can
 * be inverted unambiguously.
 */
function isotonic(ys, ws) {
    const blocks = ys.map((y, i) => ({ sum: y * ws[i], weight: ws[i], count: 1 }));
    for (let i = 1; i < blocks.length; i++) {
        while (i > 0 && blocks[i - 1].sum / blocks[i - 1].weight > blocks[i].sum / blocks[i].weight) {
            blocks[i - 1].sum += blocks[i].sum;
            blocks[i - 1].weight += blocks[i].weight;
            blocks[i - 1].count += blocks[i].count;
            blocks.splice(i, 1);
            i--;
        }
    }
    const out = [];
    for (const b of blocks) {
        for (let k = 0; k < b.count; k++) out.push(Number((b.sum / b.weight).toFixed(3)));
    }
    return out;
}

function main() {
    const { zoneLimit, variant, label } = parseArgs(process.argv);
    const suffix = label ? `-${label}` : '';
    const rawPath = path.join(RESULTS, `vanilla-profile-raw-${variant}${suffix}.json`);
    const profPath = path.join(RESULTS, `vanilla-profile${suffix}.json`);
    for (const p of [rawPath, profPath]) {
        if (!fs.existsSync(p)) throw new Error(`missing ${p} — run profile-vanilla.mjs first`);
    }
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    const profile = JSON.parse(fs.readFileSync(profPath, 'utf8'));

    const zoneOf = new Map(profile.static.tasks.map((t) => [t.id, t.zone]));
    const completedAt = new Map(raw.result.completions.map((c) => [c.id, c.run]));

    // Join: every (estimate at run R) for a task that later completed at run C
    // contributes one observation (estimate → C - R). Samples for tasks that
    // never completed are censored and dropped.
    const pairs = [];
    let censored = 0;
    for (const [taskId, run, estimate] of raw.estimatorSamples) {
        if ((zoneOf.get(taskId) ?? Infinity) > zoneLimit) continue;
        if (SBTV_GATED_TASK_IDS.has(taskId)) continue;
        if (estimate > ESTIMATOR_CAP) continue;
        const completionRun = completedAt.get(taskId);
        if (completionRun == null || completionRun <= run) { censored++; continue; }
        pairs.push({ estimate, actual: completionRun - run });
    }
    if (!pairs.length) throw new Error('no usable samples');

    const buckets = [];
    for (const [lo, hi] of BUCKETS) {
        const inBucket = pairs.filter((p) => p.estimate >= lo && p.estimate <= hi);
        if (!inBucket.length) continue;
        const ratios = inBucket.filter((p) => p.estimate >= 1).map((p) => p.actual / p.estimate);
        buckets.push({
            lo,
            hi,
            // Midpoint is the x the isotonic fit and the balancer's inversion
            // interpolate against.
            estimate: (lo + hi) / 2,
            actualResets: stats(inBucket.map((p) => p.actual)),
            actualOverEstimate: ratios.length ? stats(ratios) : null,
        });
    }

    const fitted = isotonic(buckets.map((b) => b.actualResets.p50), buckets.map((b) => b.actualResets.n));
    const curve = buckets.map((b, i) => ({ estimate: b.estimate, actualP50: fitted[i], n: b.actualResets.n }));

    const out = {
        generatedAt: null,       // stamped by the caller if wanted; kept null for byte-stable reruns
        source: path.basename(rawPath),
        variant,
        label,
        zoneLimit,
        excludedTaskIds: [...SBTV_GATED_TASK_IDS],
        estimatorCap: ESTIMATOR_CAP,
        sampleCount: pairs.length,
        censoredCount: censored,
        // The reachable pacing window. The balancer clamps every target into it
        // and reports the ones it had to clamp. `floorResets` is a real game
        // property (automation's queue). `plateauResets` is only the top of the
        // MEASURED range — the curve is still climbing there — so a target above
        // it is not "impossible", merely outside what this profile observed.
        floorResets: curve[0].actualP50,
        plateauResets: curve[curve.length - 1].actualP50,
        buckets,
        curve,
    };

    const outPath = path.join(RESULTS, `calibration-${variant}${suffix}-z${zoneLimit}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);

    console.log(`variant=${variant}${label ? ` label=${label}` : ''} zoneLimit=${zoneLimit}`);
    console.log(`usable samples: ${pairs.length} (censored: ${censored})`);
    console.log(`${'estimate'.padStart(10)} ${'n'.padStart(5)} ${'p25'.padStart(5)} ${'p50'.padStart(5)} ${'p75'.padStart(5)} ${'isotonic'.padStart(9)}`);
    for (let i = 0; i < buckets.length; i++) {
        const b = buckets[i];
        const label = b.lo === b.hi ? String(b.lo) : `${b.lo}-${b.hi}`;
        console.log(`${label.padStart(10)} ${String(b.actualResets.n).padStart(5)} ${String(b.actualResets.p25).padStart(5)} ${String(b.actualResets.p50).padStart(5)} ${String(b.actualResets.p75).padStart(5)} ${String(curve[i].actualP50).padStart(9)}`);
    }
    console.log(`\nreachable pacing window: [${out.floorResets}, ${out.plateauResets}] resets`);
    console.log(`wrote ${path.relative(process.cwd(), outPath)}`);
}

main();
