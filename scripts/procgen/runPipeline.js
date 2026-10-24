/**
 * runPipeline — the pipeline drivers as a FUNCTION (§5au item 10): what the
 * six CLIs do, called from code, returning the result instead of writing
 * files and exiting.
 *
 * Usage:
 *   import { runPipeline } from './scripts/procgen/runPipeline.js';
 *   const { rulesJson, dump } = await runPipeline({
 *       driver: 'dump-shuffled-spiral',
 *       config: { seed: 3, quotas: { maze: 3, jta: 2 } },
 *   });
 *   const { rulesJson: td, envelope } = await runPipeline({
 *       driver: 'topdown-step', config: { mix: { maze: 1 } }, source: rulesJson,
 *   });
 *
 * - `driver`: one of DRIVERS. `config`: the keys that driver's `--config`
 *   takes (`node scripts/procgen/<driver>.js --config-schema`), checked the
 *   same way; omitted keys take the CLI's defaults. Paths in it (`--atlas`,
 *   `--jta-dataset-file`, a topdown `source`) are READ, relative to the
 *   current directory; nothing is ever written.
 * - A `*-step` driver runs its `run` subcommand (to `config.to`, default
 *   compile); `envelope` (a serialized envelope object) resumes one instead of
 *   starting fresh, and topdown-step takes its source as `source` (a rules.json
 *   object) or `config.source` (a path).
 * - Returns `{rulesJson, dump, envelope, summary, oracleErrors}`: `dump` is
 *   set for the dump-* drivers, `envelope` for the step drivers, and
 *   `oracleErrors` (sphere drivers) is non-empty where the CLI would exit 2.
 * - Throws `UsageError` (a bad driver name, a substrate the layout cannot
 *   place), `InputError` (a config that fails its schema, an unreadable
 *   file), or the engine's own error; `outcomeOf(err)` and `EXIT[outcome]`
 *   map each to the CLI's exit code.
 *
 * ⛓ IMPORTING THIS MODULE DOES NOTHING: it imports only cliRun.js (node:fs /
 * path / url). The engine, the drivers and the substrate libraries load on the
 * first call — the frontend module graph logs and starts its singletons then,
 * not on import. And it never calls process.exit: a process that calls it
 * ends when its own work does (measured for every driver, runPipeline.test.js).
 */

import { UsageError } from './cliRun.js';

export { EXIT, InputError, UsageError, outcomeOf } from './cliRun.js';

/** ⛓ The drivers runPipeline can run — the six pipeline CLIs in this directory. */
export const DRIVERS = Object.freeze([
    'sphere-step', 'spiral-step', 'topdown-step',
    'dump-sphere-growth', 'dump-shuffled-spiral', 'dump-grid-growth',
]);

/**
 * Run one pipeline driver in-process.
 * @param {{driver: string, config?: object, envelope?: object|null, source?: object|null}} request
 * @returns {Promise<{rulesJson: object|null, dump: object|null, envelope: object|null, summary: object,
 *          oracleErrors: string[]}>}
 */
export async function runPipeline({ driver, config = {}, envelope = null, source = null } = {}) {
    if (!DRIVERS.includes(driver)) {
        throw new UsageError(`runPipeline: driver must be one of ${DRIVERS.join(', ')}; got ${JSON.stringify(driver)}`);
    }
    const isStep = driver.endsWith('-step');
    if (!isStep && (envelope || source)) {
        throw new UsageError(`runPipeline: ${driver} takes neither an envelope nor a source`);
    }
    if (source && driver !== 'topdown-step') throw new UsageError(`runPipeline: only topdown-step takes a source`);
    const [mod, substrates] = await Promise.all([
        import(`./${driver}.js`),
        import('./registerPipelineSubstrates.js'),
    ]);
    const resolved = mod.resolveConfig(config);
    await substrates.loadPipelineSubstrates();
    substrates.checkSubstrateIds(resolved, mod.SUBSTRATE_CHECK);
    const r = await mod.build(resolved, isStep ? { envelope, ...(source ? { source } : {}) } : {});
    return {
        rulesJson: r.rulesJson ?? null,
        dump: r.dump ?? null,
        envelope: r.envelope ?? null,
        summary: r.summary,
        oracleErrors: r.oracleErrors ?? [],
    };
}
