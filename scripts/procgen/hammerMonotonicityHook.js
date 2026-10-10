/**
 * hammerMonotonicityHook — ⛓ SEEDLING HAMMER-PHASE B2 (W0): the capture half of `check-seedling-hammer-monotonicity`.
 *
 * Loaded with `node --import scripts/procgen/hammerMonotonicityHook.js <a row's own script> …` and only when
 * `SEEDLING_SOLVE_CAPTURE=<file.jsonl>` is set (unset: it registers nothing and the run is the row's own, byte for
 * byte). It registers a module-load hook for this process that rewrites ONE declaration of
 * `frontend/modules/seedlingDemo/procgenOracle.js` as it loads — `export function solve(…)` becomes a forwarder to the
 * same body, renamed — so every certify solve of the row (the seam's, `generateLevel`'s, the ablation's, a census's
 * own call) passes through `globalThis.__seedlingSolveHook`, which appends `{n, verdict, ticks, args}` for each solve
 * whose level record holds a spinner. ⛔ Nothing in the repository is edited: the rewrite exists only in this
 * process's module graph, and the row's stdout is unchanged (the instrument checks its md5 against a plain run).
 */
import { appendFileSync } from 'node:fs';
import { register } from 'node:module';

const OUT = process.env.SEEDLING_SOLVE_CAPTURE ?? '';

/** A level record holds a spinner when any entity of it is tagged `spinner` (the generator's and the atlas's spelling). */
export function recordHoldsSpinner(record) {
    return /"(?:tag|name|type|kind)":"spinner"/i.test(JSON.stringify(record ?? null));
}

if (OUT !== '') {
    let n = 0;
    globalThis.__seedlingSolveHook = (solve, args) => {
        const out = solve(...args);
        n += 1;
        if (recordHoldsSpinner(args[0])) {
            const [levelRecord, staging, goals, budget, opts = {}] = args;
            appendFileSync(OUT, `${JSON.stringify({ n, verdict: out.verdict, ticks: out.ticks ?? null,
                args: { levelRecord, staging, goals, budget, opts: { name: opts.name, scratchPersistence:
                    opts.scratchPersistence, dashMode: opts.dashMode } } })}\n`);
        }
        return out;
    };
    register(new URL('./hammerMonotonicityLoader.js', import.meta.url).href);
}
