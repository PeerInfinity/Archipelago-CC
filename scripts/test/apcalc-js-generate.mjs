#!/usr/bin/env node
// Runs the frontend APCalc generator (frontend/modules/apcalcGenerator/apcalcGeneratorEngine.js)
// on a list of configs and prints each puzzle as canonical JSON, for the JS<->Python parity
// test (worlds/apcalc/test/test_generator_parity.py), which builds the same shape from
// worlds/apcalc/generator/generator.py run on the same RNG (mulberry32).
//
// stdin: a JSON array of engine configs ({ seed, numSpheres, opsPerSphere, numsPerSphere,
//        trashPerSphere, maxBranches, reuseAttempts }).
// stdout: { version: APCALC_GENERATOR_VERSION, results: [...] }, one result per config:
//         { ok: true, puzzle } or { ok: false, error }.
// `puzzle` = { nodes, edges, starting_buttons, generation_attempt, unsafe }, where a path cost
// is a sorted [button, count] list and `unsafe` counts node values / operands that are not
// safe integers (JS doubles lose exactness past 2^53, so a puzzle with any is not exact).
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const engine = await import(pathToFileURL(path.join(here, '../../frontend/modules/apcalcGenerator/apcalcGeneratorEngine.js')).href);

const cost = pc => Object.entries(pc).filter(([, n]) => n > 0).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

const configs = JSON.parse(readFileSync(0, 'utf8'));
const out = [];
for (const config of configs) {
    try {
        const g = await engine.generate(config, () => {});
        let unsafe = 0;
        const nodes = g.nodes.map(n => {
            if (!Number.isSafeInteger(n.value)) unsafe++;
            return [n.index, n.value, n.layer, n.sphere, n.item, n.pathCosts.map(cost)];
        });
        const edges = g.edges.map(e => {
            if (e.operand !== null && !Number.isSafeInteger(e.operand)) unsafe++;
            return [e.index, e.sourceIndex, e.targetIndex, e.operation, e.operand, e.operandDigits,
                e.sphere, e.pathCosts.map(cost)];
        });
        out.push({
            ok: true,
            puzzle: {
                nodes, edges,
                starting_buttons: cost(g.startingButtons),
                generation_attempt: g.generationAttempt,
                unsafe,
            },
        });
    } catch (error) {
        out.push({ ok: false, error: String(error?.message ?? error) });
    }
}
process.stdout.write(JSON.stringify({ version: engine.APCALC_GENERATOR_VERSION, results: out }));
