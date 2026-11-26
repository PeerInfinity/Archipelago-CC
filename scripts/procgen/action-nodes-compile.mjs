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
//   node scripts/procgen/action-nodes-compile.mjs [<graph.json>] [-o out.json] [--seed N] [--exists id,id]
//                                                 [--fill-attempts N] [--check] [--quiet]
//
// `--fill-attempts` caps how many times the seeded fill is tried before the graph is refused (`fill-failed`); the
// default is the compiler's DEFAULT_FILL_ATTEMPTS. Attempt 1 uses the seed itself, so a graph that fills first time
// compiles to the same bytes whatever the cap (AN-OMSI-1).
//
// `--exists` names the content packs (`frontend/packs/`) the graph is the resolved structure of; the world then records
// those pack ids in `provenance[p].exists` instead of the graph's own provenance block (Z.7, AN-1b).
//
// With no graph it recompiles EVERY committed ActionNodes preset by the recipe that preset records (AN-OMSI-2): the
// roster is derived, not listed — each `preset_files.json` folder whose game is ActionNodes, its rules file's
// `procgen_metadata[p].graph_path` (the graph), `generation_seed` (the seed) and `provenance[p].exists` (the packs).
// A new preset enrols itself the moment it is committed and registered. `--check` with no graph checks them all;
// these two are the same for the example preset:
//   node scripts/procgen/action-nodes-compile.mjs                 (writes every committed preset)
//   node scripts/procgen/action-nodes-compile.mjs frontend/modules/actionNodes/graphs/example-village.json \
//       -o frontend/presets/action_nodes_example/AP_1/AP_1_rules.json --exists example-village
//   node scripts/procgen/action-nodes-compile.mjs --check         (checks every committed preset)
// A new preset is written once with an explicit recipe, then registered in preset_files.json, e.g. the omsi town:
//   node scripts/procgen/action-nodes-compile.mjs frontend/modules/actionNodes/graphs/omsi-first-town.json \
//       -o frontend/presets/action_nodes_omsi_town/AP_3/AP_3_rules.json --seed 3
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp } from './argvHelp.js';
import { ACTION_GRAPH_DRIVER, ACTION_NODES_GAME, compileActionGraph } from '../../frontend/modules/actionNodes/actionGraphCompiler.js';
import { stringifyRulesJson } from '../../frontend/modules/shared/rulesJsonBuilder.js';

argvHelp(import.meta.url);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// The example preset's recipe. The CLI does not read these (its roster is derived, `committedActionPresets`):
// actionGraphCompiler.test.js pins that the roster derives exactly this recipe for the example preset.
export const DEFAULT_GRAPH = 'frontend/modules/actionNodes/graphs/example-village.json';
export const DEFAULT_OUT = 'frontend/presets/action_nodes_example/AP_1/AP_1_rules.json';
/** The pack the example graph is the resolved structure of (PL-2: `resolve(action_nodes, {exists: [it]})` equals it). */
export const DEFAULT_EXISTS = Object.freeze(['example-village']);
const PRESET_INDEX = 'frontend/presets/preset_files.json';

/**
 * Every committed ActionNodes preset with the recipe it records: `{out, graph, seed, exists}`. Derived from
 * `preset_files.json` (a folder whose game is ActionNodes) and the rules file itself (`procgen_metadata[p]`, written
 * by the compiler, names the graph; `generation_seed` the seed; `provenance[p].exists` the packs, else null). A rules
 * file the compiler did not write is an error, not a skip: an ActionNodes preset nothing can regenerate is a red.
 */
export function committedActionPresets(repo = REPO) {
    const index = JSON.parse(readFileSync(resolve(repo, PRESET_INDEX), 'utf8'));
    const out = [];
    for (const [dir, entry] of Object.entries(index)) {
        for (const [folder, row] of Object.entries(entry.folders ?? {})) {
            if (!(row.games ?? []).some((g) => g.game === ACTION_NODES_GAME.gameName)) continue;
            for (const file of (row.files ?? []).filter((f) => f.endsWith('_rules.json'))) {
                const rel = `frontend/presets/${dir}/${folder}/${file}`;
                const rules = JSON.parse(readFileSync(resolve(repo, rel), 'utf8'));
                const [p] = Object.keys(rules.procgen_metadata ?? {});
                const meta = rules.procgen_metadata?.[p];
                if (meta?.driver !== ACTION_GRAPH_DRIVER || !meta.graph_path) {
                    throw new Error(`${rel}: an ActionNodes preset whose rules name no compiler recipe `
                        + `(procgen_metadata[${p}].driver/graph_path)`);
                }
                out.push({ out: rel, graph: meta.graph_path, seed: rules.generation_seed,
                    exists: rules.provenance?.[p]?.exists ?? null });
            }
        }
    }
    return out;
}
const USAGE = 'usage: node scripts/procgen/action-nodes-compile.mjs [<graph.json>] [-o out.json] [--seed N] [--exists id,id] [--fill-attempts N] [--check] [--quiet]';

function main() {
    const argv = process.argv.slice(2);
    const has = (flag) => argv.includes(flag);
    const valueOf = (flag) => {
        const i = argv.indexOf(flag);
        return i === -1 ? undefined : argv[i + 1];
    };
    const VALUE_FLAGS = ['-o', '--out', '--seed', '--exists', '--fill-attempts'];
    const unknown = argv.filter((a, i) => a.startsWith('-') && !VALUE_FLAGS.includes(a) && !['--check', '--quiet'].includes(a)
        && !VALUE_FLAGS.includes(argv[i - 1]));
    if (unknown.length) {
        console.error(`unknown flag(s): ${unknown.join(' ')}\n${USAGE}`);
        process.exit(2);
    }
    const positional = argv.filter((a, i) => !a.startsWith('-') && !VALUE_FLAGS.includes(argv[i - 1]));
    const check = has('--check');
    const quiet = has('--quiet');
    const fillArg = valueOf('--fill-attempts');
    if (fillArg !== undefined && !(Number.isInteger(Number(fillArg)) && Number(fillArg) >= 1)) {
        console.error(`--fill-attempts takes a whole number of at least 1, got '${fillArg}'\n${USAGE}`);
        process.exit(2);
    }
    const fillAttempts = fillArg === undefined ? undefined : Number(fillArg);

    if (!positional[0]) {
        // The committed roster: each preset by its own recorded recipe.
        const recipeFlags = ['-o', '--out', '--seed', '--exists'].filter(has);
        if (recipeFlags.length) {
            console.error(`${recipeFlags.join(' ')} need(s) a graph: with none, every committed preset is compiled by its `
                + `own recorded recipe\n${USAGE}`);
            process.exit(2);
        }
        const roster = committedActionPresets();
        let bad = 0;
        for (const r of roster) {
            if (!quiet) console.log(`== ${r.out} (graph ${r.graph}, seed ${r.seed}${r.exists ? `, exists ${r.exists.join(',')}` : ''})`);
            if (!compileOne({ graphFile: r.graph, outFile: r.out, seed: r.seed, exists: r.exists, fillAttempts, check, quiet })) bad += 1;
        }
        if (check) {
            console.log(bad ? `FAIL: ${bad} of ${roster.length} committed ActionNodes preset(s) differ`
                : `OK: all ${roster.length} committed ActionNodes preset(s) are byte-identical to their compiled graphs`);
        }
        process.exit(bad ? 1 : 0);
    }

    const graphFile = positional[0];
    const outFile = valueOf('-o') ?? valueOf('--out') ?? null;
    const seedArg = valueOf('--seed');
    const existsArg = valueOf('--exists');
    const exists = existsArg !== undefined ? existsArg.split(',').map((x) => x.trim()).filter(Boolean) : null;
    if (check && !outFile) {
        console.error('ERROR: the check mode needs -o <file> to compare against');
        process.exit(2);
    }
    const ok = compileOne({ graphFile, outFile, seed: seedArg === undefined ? 1 : Number(seedArg), exists, fillAttempts, check, quiet });
    process.exit(ok ? 0 : 1);
}

/** Compile one graph; check it against, or write it to, `outFile` (stdout when none). Returns whether it passed. */
function compileOne({ graphFile, outFile, seed, exists, fillAttempts, check, quiet }) {
    for (const id of exists ?? []) {
        if (!existsSync(resolve(REPO, 'frontend/packs', id))) {
            console.error(`unknown pack '${id}' in --exists: no frontend/packs/${id}/\n${USAGE}`);
            process.exit(2);
        }
    }
    const graphPath = resolve(REPO, graphFile);
    const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
    let result;
    try {
        result = compileActionGraph(graph, {
            seed,
            graphPath: relative(REPO, graphPath),
            exists,
            ...(fillAttempts === undefined ? {} : { fillAttempts }),
        });
    } catch (e) {
        console.error(`REFUSED: ${e.name}: ${e.message}`);
        return false;
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
        for (const sp of report.a6.spheres) console.log(`  sphere ${sp.sphere}: ${sp.open_at_once} open — ${sp.checks.join(', ')}`);
        console.log(`  A6: every check earnable, sphere log reaches the goal`);
        if (report.fill) console.log(`  fill: attempt ${report.fill.attempt} filled it (seed ${report.fill.seed})`);
    }

    if (check) {
        const target = resolve(REPO, outFile);
        if (!existsSync(target)) {
            console.error(`FAIL: ${outFile} does not exist — run without the check flag to write it`);
            return false;
        }
        if (readFileSync(target, 'utf8') !== text) {
            console.error(`FAIL: ${outFile} is not what ${relative(REPO, graphPath)} compiles to — regenerate it`);
            return false;
        }
        console.log(`OK: ${outFile} is byte-identical to the compiled graph`);
        return true;
    }
    if (outFile) {
        const target = resolve(REPO, outFile);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text);
        if (!quiet) console.log(`wrote ${outFile} (${text.length} bytes)`);
    } else {
        process.stdout.write(text);
    }
    return true;
}

// Run only when invoked as a script: importing this file does nothing (check-procgen-help.mjs's import door).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
