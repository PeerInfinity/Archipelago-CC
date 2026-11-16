#!/usr/bin/env node
// ActionNodes headless bot: plays a compiled world to its goal with the planner (A13, "as early as possible"; design
// `action-nodes.md` § The bot). Reads the compiled rules.json, takes each check's item from its placement (the
// simulated fill), and prints every loop: what the bot performed, the checks it earned, the items it received and
// its reasoning lines. It reports loops-to-goal with the XP gain scale at the graph's value and at 0 (design §8:
// "that number decides whether to lower it").
//
// Usage:
//   node scripts/procgen/action-nodes-play.mjs [<rules.json>] [--graph <graph.json>] [--quiet] [--json]
//
//   node scripts/procgen/action-nodes-play.mjs
//   node scripts/procgen/action-nodes-play.mjs frontend/presets/action_nodes_example/AP_1/AP_1_rules.json
//
// Exit 1 when the bot does not reach the goal.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp } from './argvHelp.js';
import { buildActionModel } from '../../frontend/modules/actionNodes/actionModel.js';
import { playToGoal } from '../../frontend/modules/actionNodes/actionPlanner.js';
import { placementsFromRules } from '../../frontend/modules/actionNodes/actionGraphCompiler.js';

argvHelp(import.meta.url);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_RULES = 'frontend/presets/action_nodes_example/AP_1/AP_1_rules.json';

function main() {
    const argv = process.argv.slice(2);
    const valueOf = (flag) => {
        const i = argv.indexOf(flag);
        return i === -1 ? undefined : argv[i + 1];
    };
    const positional = argv.filter((a, i) => !a.startsWith('-') && argv[i - 1] !== '--graph');
    const rulesPath = resolve(REPO, positional[0] ?? DEFAULT_RULES);
    const rules = JSON.parse(readFileSync(rulesPath, 'utf8'));
    const p = Object.keys(rules.action_nodes ?? {})[0];
    const meta = rules.procgen_metadata?.[p];
    const graphFile = valueOf('--graph') ?? meta?.graph_path;
    if (!p || !graphFile) {
        console.error('ERROR: not an ActionNodes world (no action_nodes block, or no graph path); pass --graph');
        process.exit(2);
    }
    const graph = JSON.parse(readFileSync(resolve(REPO, graphFile), 'utf8'));
    const model = buildActionModel(graph);
    const placements = placementsFromRules(rules, model, p);
    const quiet = argv.includes('--quiet');

    const scales = [...new Set([model.graph.settings?.xpGainScale ?? 1, 0])];
    const summary = [];
    let ok = true;
    for (const scale of scales) {
        const run = playToGoal(model, { placements, xpGainScale: scale });
        summary.push({ xpGainScale: scale, reachedGoal: run.reachedGoal, loops: run.loops.length });
        ok &&= run.reachedGoal;
        if (argv.includes('--json')) { console.log(JSON.stringify({ xpGainScale: scale, ...run })); continue; }
        if (quiet) continue;
        console.log(`=== xpGainScale ${scale} ===`);
        for (const loop of run.loops) {
            const names = loop.performed.map((id) => model.nodes[model.nodeIx.get(id)].name);
            console.log(`Loop ${loop.loop} [${loop.kind}]: ${names.join(' → ') || '(nothing)'}`
                + `${loop.attempt ? ` → attempt ${model.nodes[model.nodeIx.get(loop.attempt)].name}` : ''}`);
            console.log(`  checks: ${loop.checks.join(', ') || 'none'}; received: ${loop.received.join(', ') || 'nothing'}`);
            for (const line of loop.lines) console.log(`  | ${line}`);
        }
    }
    for (const s of summary) {
        console.log(`xpGainScale ${s.xpGainScale}: ${s.reachedGoal ? `goal in ${s.loops} loop(s)` : `NO GOAL after ${s.loops} loops`}`);
    }
    process.exit(ok ? 0 : 1);
}

// Run only when invoked as a script: importing this file does nothing (check-procgen-help.mjs's import door).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
