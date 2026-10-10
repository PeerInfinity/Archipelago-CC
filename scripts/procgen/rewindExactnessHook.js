/**
 * rewindExactnessHook — ⛓ SEEDLING HAMMER-PHASE B3 (D0): the probe half of `check-seedling-rewind-exactness`.
 *
 * Loaded with `node --import scripts/procgen/rewindExactnessHook.js <a producer's own script> …` and only when
 * `SEEDLING_REWIND_PROBE=<file.jsonl>` is set (unset: it registers nothing and the run is the producer's own, byte for
 * byte). It sets `solverBot.REWIND_PROBE` in this process: every segment that has a `forkRun` (`twoPassSolve`'s
 * passes, `solveForPage`'s solves, the JS worker's `solveFromTape`) then hands it, at every press kill's first tick and at every
 * `SEEDLING_REWIND_EVERY`-th tape tick (default 50), its LIVE run and the rewound one (`replayToTick`). Each pair is
 * fingerprinted — `run.state`, the clock, `entities(…)` for every family, `progress(…)` for every field, `ledger(…)`
 * for every kind, the transitions and the scratch clears, `JSON.stringify` with Sets and Maps spelled out — and one
 * row per probe is appended: equal or not, the fingerprint's md5, the rewind's wall time and, on a mismatch, the
 * first path that differs. ⛔ Nothing in the repository is edited, and nothing the probe does reaches the solve (the
 * producer's stdout md5 is checked against its plain run by the instrument).
 */
import { appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const OUT = process.env.SEEDLING_REWIND_PROBE ?? '';
const EVERY = Number(process.env.SEEDLING_REWIND_EVERY ?? 50);

/** Sets and Maps as tagged arrays, functions named, so two runs' answers compare as text. */
const replacer = (_k, v) => {
    if (v instanceof Set) return { $set: [...v] };
    if (v instanceof Map) return { $map: [...v] };
    if (typeof v === 'function') return '<fn>';
    if (typeof v === 'bigint') return `${v}n`;
    return v;
};

/** One run's observable state at this tick, as text. */
export function fingerprint(run, LR) {
    const ask = (f) => {
        try { return f(); } catch (e) { return `<threw ${e?.name}: ${String(e?.message).slice(0, 80)}>`; }
    };
    const fam = (names, q) => Object.fromEntries(names.map((n) => [n, ask(() => q(n))]));
    return JSON.stringify({
        ticksCompleted: run.ticksCompleted,
        level: run.level,
        state: run.state,
        clock: ask(() => run.gameTimeAt(0)),
        transitions: ask(() => run.transitions),
        scratchClears: ask(() => run.scratchClears),
        entities: fam(LR.ENTITY_FAMILY_NAMES, (n) => run.entities(n)),
        progress: fam(LR.PROGRESS_FIELD_NAMES, (n) => run.progress(n)),
        ledgers: fam(LR.LEDGER_KIND_NAMES, (n) => run.ledger(n)),
    }, replacer);
}

/** The first JSON path at which two parsed fingerprints differ. */
export function firstDiff(a, b, path = '') {
    if (JSON.stringify(a) === JSON.stringify(b)) return null;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
            const d = firstDiff(a[k], b[k], `${path}.${k}`);
            if (d) return d;
        }
    }
    return { path, live: JSON.stringify(a)?.slice(0, 200), rewound: JSON.stringify(b)?.slice(0, 200) };
}

if (OUT !== '') {
    const SB = await import('../../frontend/modules/seedlingDemo/solverBot.js');
    const LR = await import('../../frontend/modules/seedlingDemo/levelRun.js');
    let name = null;
    SB.REWIND_PROBE.ticks = { has: (t) => t > 0 && t % EVERY === 0 };
    SB.REWIND_PROBE.sink = (p) => {
        if (p.name) name = p.name;
        const live = fingerprint(p.live, LR);
        const t0 = performance.now();
        // ⛔ a replay that throws is a mismatch, recorded — never an exception inside the solve the probe watches
        let back;
        try {
            back = fingerprint(p.rewound(), LR);
        } catch (e) {
            back = JSON.stringify({ threw: `${e?.name}: ${String(e?.message).split('\n')[0].slice(0, 160)}` });
        }
        const ms = performance.now() - t0;
        const equal = live === back;
        appendFileSync(OUT, `${JSON.stringify({ name, t: p.t, kind: p.kind, equal, ms: Number(ms.toFixed(2)),
            md5: createHash('md5').update(live).digest('hex').slice(0, 12), bytes: live.length,
            ...(equal ? {} : { diff: firstDiff(JSON.parse(live), JSON.parse(back)) }) })}\n`);
    };
}
