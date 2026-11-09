#!/usr/bin/env node
/**
 * entrance-step — headless driver for the stepped ENTRANCE-SHUFFLE pipeline (ER E4b): pool → classify → shuffle →
 * compile over an installable atlas, through `procgenPipeline/entranceShuffleSteps.js` and the substrate hooks the
 * registry declares for the atlas (`entranceShuffleHooksFor`). Writes the envelope's PUBLIC fields as JSON and, after
 * `compile`, the compiled rules.json.
 *
 * ⛓ The envelope's INTERNAL fields (the pooled atlas, the vanilla compile, the live shuffle binding) are not written:
 * every run re-pools and re-classifies (deterministic, ~10 s). `--attempt K` resumes the draw sequence at draw K.
 *
 * Run:
 *   node scripts/procgen/entrance-step.js run --atlas seedling-eff9e209 --seed 1 -o er-env.json --rules-out er-rules.json
 *   node scripts/procgen/entrance-step.js run --atlas seedling-eff9e209 --seed 1 --to classify -o er-classify.json
 *   node scripts/procgen/entrance-step.js run --atlas <id> --seed 7 --max-attempts 20 --sweep events -o -
 *
 * Flags:
 *   --atlas ID          the content source (an atlas id a registered substrate's `entranceShuffle.atlasIds` holds)
 *   --seed N            the shuffle seed (default 1)
 *   --to STEP           stop after pool | classify | shuffle | compile (default compile)
 *   --max-attempts N    draws before the run refuses (default 50)
 *   --sweep S           the reach's inventory: placed (default, vanilla items) | events (GER's all-state)
 *   -o, --out PATH      the envelope JSON (`-` = stdout; default: none)
 *   --rules-out PATH    after compile: the compiled rules.json
 *   -h, --help          print this and exit
 */
import { writeFileSync } from 'node:fs';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const STEP_NAMES = ['pool', 'classify', 'shuffle', 'compile'];

/** argv → `{atlas, seed, to, maxAttempts, sweep, out, rulesOut}` (throws on a bad flag). */
export function parseEntranceStepArgs(argv) {
    const [cmd, ...rest] = argv;
    if (cmd !== 'run') throw new Error(`entrance-step: the subcommand is \`run\`, got ${JSON.stringify(cmd)}`);
    const o = { seed: 1, to: 'compile', maxAttempts: 50, sweep: 'placed', out: null, rulesOut: null, atlas: null };
    for (let i = 0; i < rest.length; i += 1) {
        const a = rest[i];
        const v = () => {
            const x = rest[i + 1];
            if (x === undefined) throw new Error(`entrance-step: ${a} takes a value`);
            i += 1;
            return x;
        };
        if (a === '--atlas') o.atlas = v();
        else if (a === '--seed') o.seed = Number(v());
        else if (a === '--to') o.to = v();
        else if (a === '--max-attempts') o.maxAttempts = Number(v());
        else if (a === '--sweep') o.sweep = v();
        else if (a === '-o' || a === '--out') o.out = v();
        else if (a === '--rules-out') o.rulesOut = v();
        else throw new Error(`entrance-step: unknown flag ${a}`);
    }
    if (!o.atlas) throw new Error('entrance-step: --atlas names the content source');
    if (!Number.isInteger(o.seed)) throw new Error('entrance-step: --seed is an integer');
    if (!STEP_NAMES.includes(o.to)) throw new Error(`entrance-step: --to is one of ${STEP_NAMES.join(', ')}`);
    if (!Number.isInteger(o.maxAttempts) || o.maxAttempts < 1) throw new Error('entrance-step: --max-attempts is a positive integer');
    if (!['placed', 'events'].includes(o.sweep)) throw new Error('entrance-step: --sweep is placed or events');
    return o;
}

/** The envelope's PUBLIC fields (the ones `ENTRANCE_ENVELOPE_FIELDS` marks public), rules.json dropped from compile. */
export function publicEnvelope(env, fields) {
    const out = { kind: 'entrance-envelope' };
    for (const [k, def] of Object.entries(fields)) {
        if (def.visibility !== 'public' || env[k] === undefined) continue;
        out[k] = k === 'compile' ? (({ rulesJson, ...rest }) => rest)(env.compile) : env[k];
    }
    return out;
}

if (isEntryPoint(import.meta.url)) await main();

async function main() {
    let o;
    try {
        o = parseEntranceStepArgs(process.argv.slice(2));
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
    const { loadPipelineSubstrates } = await import('./registerPipelineSubstrates.js');
    await loadPipelineSubstrates();
    const M = await import('../../frontend/modules/procgenPipeline/entranceShuffleSteps.js');
    const { stringifyRulesJson } = await import('../../frontend/modules/shared/rulesJsonBuilder.js');
    const hooks = await M.entranceShuffleHooksFor(o.atlas).load();
    const env = M.newEntranceEnvelope({ atlasId: o.atlas, seed: o.seed, maxAttempts: o.maxAttempts, sweep: o.sweep });
    for (const step of M.ENTRANCE_STEPS) {
        const t0 = Date.now();
        // eslint-disable-next-line no-await-in-loop
        await M.runEntranceStep(step, env, { hooks });
        console.error(`entrance-step: ${step} ${Date.now() - t0} ms`);
        if (step === o.to) break;
    }
    if (env.compile) {
        const a = env.compile.attempts;
        console.error(`entrance-step: accepted draw ${env.shuffle.attempt} of ${a.draws} (${a.shuffleRefused} shuffle-refused, `
            + `${a.rejectedUnbeatable} unbeatable, ${a.rejectedCheck} check-rejected); ${env.compile.moved.length} exit(s) moved, `
            + `${env.compile.spheres} sphere states`);
    }
    if (o.out) {
        const text = `${JSON.stringify(publicEnvelope(env, M.ENTRANCE_ENVELOPE_FIELDS), null, 2)}\n`;
        if (o.out === '-') process.stdout.write(text);
        else writeFileSync(o.out, text);
    }
    if (o.rulesOut) {
        if (!env.compile) {
            console.error('entrance-step: --rules-out needs the compile step');
            process.exit(1);
        }
        writeFileSync(o.rulesOut, stringifyRulesJson(env.compile.rulesJson));
    }
}
