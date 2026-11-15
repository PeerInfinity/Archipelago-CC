#!/usr/bin/env node
// ActionNodes graph → rules.json compiler CLI (design `action-nodes.md`, slice AN-1).
//
// Compiles an `action-graph` document into an ordinary rules.json: one region per node, the Archipelago logic DERIVED
// by the exact one-loop search, a seeded assumed fill, the embedded sphere log, the A6 proof report in
// `procgen_metadata[p].action_logic`, the `action_nodes[p]` block and the authored `loop_costs[p]`. A graph that
// fails validation, the search budget or the A6 proof is REFUSED by name (exit 1) and nothing is written.
//
// The output is deterministic (no clock), so the check mode is an exact "does the committed preset still compile
// byte-identically" gate, the shape region-atlas-compile.mjs uses.
//
// Usage:
//   node scripts/procgen/action-nodes-compile.mjs [<graph.json>] [-o out.json] [--seed N] [--check] [--quiet]
//
// With no graph it compiles the example graph to the committed preset:
//   node scripts/procgen/action-nodes-compile.mjs \
//       frontend/modules/actionNodes/graphs/example-village.json \
//       -o frontend/presets/action_nodes_example/AP_1/AP_1_rules.json
//   node scripts/procgen/action-nodes-compile.mjs --check
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp } from './argvHelp.js';
import { compileActionGraph } from '../../frontend/modules/actionNodes/actionGraphCompiler.js';
import { stringifyRulesJson } from '../../frontend/modules/shared/rulesJsonBuilder.js';

argvHelp(import.meta.url);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_GRAPH = 'frontend/modules/actionNodes/graphs/example-village.json';
const DEFAULT_OUT = 'frontend/presets/action_nodes_example/AP_1/AP_1_rules.json';
const USAGE = 'usage: node scripts/procgen/action-nodes-compile.mjs [<graph.json>] [-o out.json] [--seed N] [--check] [--quiet]';

function main() {
    const argv = process.argv.slice(2);
    const has = (flag) => argv.includes(flag);
    const valueOf = (flag) => {
        const i = argv.indexOf(flag);
        return i === -1 ? undefined : argv[i + 1];
    };
    const VALUE_FLAGS = ['-o', '--out', '--seed'];
    const unknown = argv.filter((a, i) => a.startsWith('-') && !VALUE_FLAGS.includes(a) && !['--check', '--quiet'].includes(a)
        && !VALUE_FLAGS.includes(argv[i - 1]));
    if (unknown.length) {
        console.error(`unknown flag(s): ${unknown.join(' ')}\n${USAGE}`);
        process.exit(2);
    }
    const positional = argv.filter((a, i) => !a.startsWith('-') && !VALUE_FLAGS.includes(argv[i - 1]));
    const graphFile = positional[0] ?? DEFAULT_GRAPH;
    const outFile = valueOf('-o') ?? valueOf('--out') ?? (positional[0] ? null : DEFAULT_OUT);
    const check = has('--check');
    const quiet = has('--quiet');
    const seedArg = valueOf('--seed');

    const graphPath = resolve(REPO, graphFile);
    const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
    let result;
    try {
        result = compileActionGraph(graph, {
            seed: seedArg === undefined ? 1 : Number(seedArg),
            graphPath: relative(REPO, graphPath),
        });
    } catch (e) {
        console.error(`REFUSED: ${e.name}: ${e.message}`);
        process.exit(1);
    }
    const { rules, report } = result;
    const text = `${stringifyRulesJson(rules)}\n`;

    if (!quiet) {
        console.log(`graph ${graph.graph_id}: ${report.search.item_combinations} item combinations, `
            + `at most ${report.search.max_states_per_combination} states each`);
        for (const [name, t] of Object.entries(report.targets)) {
            console.log(`  ${t.kind.padEnd(5)} ${name}: ${t.rule}`);
            for (const w of t.witnesses) console.log(`        witness ${JSON.stringify(w.items)}: ${w.plan} (${w.mana_left} mana left)`);
        }
        for (const s of report.a6.spheres) console.log(`  sphere ${s.sphere}: ${s.open_at_once} open — ${s.checks.join(', ')}`);
        console.log(`  A6: every check earnable, sphere log reaches the goal`);
    }

    if (check) {
        if (!outFile) {
            console.error('ERROR: the check mode needs -o <file> to compare against');
            process.exit(2);
        }
        const target = resolve(REPO, outFile);
        if (!existsSync(target)) {
            console.error(`FAIL: ${outFile} does not exist — run without the check flag to write it`);
            process.exit(1);
        }
        if (readFileSync(target, 'utf8') !== text) {
            console.error(`FAIL: ${outFile} is not what ${relative(REPO, graphPath)} compiles to — regenerate it`);
            process.exit(1);
        }
        console.log(`OK: ${outFile} is byte-identical to the compiled graph`);
        process.exit(0);
    }
    if (outFile) {
        const target = resolve(REPO, outFile);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text);
        if (!quiet) console.log(`wrote ${outFile} (${text.length} bytes)`);
    } else {
        process.stdout.write(text);
    }
}

// Run only when invoked as a script: importing this file does nothing (check-procgen-help.mjs's import door).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
