#!/usr/bin/env node
/**
 * JTA Cost Debugger CLI
 *
 * Generates costs via simulated playthrough and outputs a detailed
 * step-by-step report. Each step = one action queue (one energy budget).
 *
 * Usage:
 *   node scripts/jta/cost-debugger.js \
 *     --gamedata frontend/presets/jta/AP_SEED/AP_SEED_P1_Player1_gamedata.json \
 *     --spherelog frontend/presets/jta/AP_SEED/AP_SEED_sphere_log.jsonl \
 *     --output jta_cost_debug_report.json \
 *     --normal-attempts 1 --perk-attempts 5 --boss-attempts 5 \
 *     --player 1
 */

import { readFileSync, writeFileSync } from 'fs';
import { JTACostPlanner } from '../../frontend/modules/jtaCostDebugger/jtaCostPlanner.js';

function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--gamedata' || arg === '-g') {
            args.gamedata = argv[++i];
        } else if (arg === '--spherelog' || arg === '-s') {
            args.spherelog = argv[++i];
        } else if (arg === '--output' || arg === '-o') {
            args.output = argv[++i];
        } else if (arg === '--normal-attempts') {
            args.normalAttempts = parseInt(argv[++i]);
        } else if (arg === '--perk-attempts') {
            args.perkAttempts = parseInt(argv[++i]);
        } else if (arg === '--boss-attempts') {
            args.bossAttempts = parseInt(argv[++i]);
        } else if (arg === '--player' || arg === '-p') {
            args.player = parseInt(argv[++i]);
        } else if (arg === '--traversal-attempts') {
            args.traversalAttempts = parseInt(argv[++i]);
        } else if (arg === '--traversal-cost-scale') {
            args.traversalCostScale = parseFloat(argv[++i]);
        } else if (arg === '--adjust-xp') {
            args.adjustXpMult = true;
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }
    return args;
}

function printUsage() {
    console.log(`
JTA Cost Debugger - Simulated Playthrough Cost Generator

Usage:
  node scripts/jta/cost-debugger.js [options]

Options:
  -g, --gamedata <path>         Randomized game data JSON (required)
  -s, --spherelog <path>        Sphere log JSONL (required)
  -o, --output <path>           Output path for report JSON (default: stdout summary only)
  --normal-attempts <n>         Attempts for regular tasks (default: 1)
  --perk-attempts <n>           Attempts for perk tasks (default: 5)
  --boss-attempts <n>           Attempts for boss tasks (default: 5)
  -p, --player <n>              Player number in sphere log (default: 1)
  --adjust-xp                   Adjust xpMult on grinding tasks to hit exact attempt counts
  -h, --help                    Show this help

Example:
  node scripts/jta/cost-debugger.js \\
    -g frontend/presets/jta/AP_14089154938208861744/AP_14089154938208861744_P1_Player1_gamedata.json \\
    -s frontend/presets/jta/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl \\
    -o jta_cost_debug_report.json
`);
}

const args = parseArgs(process.argv);

if (args.help) {
    printUsage();
    process.exit(0);
}

if (!args.gamedata || !args.spherelog) {
    console.error('Error: --gamedata and --spherelog are required');
    printUsage();
    process.exit(1);
}

// Load inputs
const gameDataJson = JSON.parse(readFileSync(args.gamedata, 'utf-8'));
const sphereLogContent = readFileSync(args.spherelog, 'utf-8');

const settings = {
    normalAttempts: args.normalAttempts ?? 1,
    perkAttempts: args.perkAttempts ?? 5,
    bossAttempts: args.bossAttempts ?? 5,
    traversalAttempts: args.traversalAttempts ?? 5,
    traversalCostScale: args.traversalCostScale ?? 0.5,
    playerNumber: args.player ?? 1,
    adjustXpMult: args.adjustXpMult ?? false,
};

console.log(`Loading game data from: ${args.gamedata}`);
console.log(`Loading sphere log from: ${args.spherelog}`);
console.log(`Settings: normal=${settings.normalAttempts}, perk=${settings.perkAttempts}, boss=${settings.bossAttempts}, player=${settings.playerNumber}`);
console.log('');

// Run cost debugger
const startTime = Date.now();
const planner = new JTACostPlanner();
const result = planner.planCosts(gameDataJson, sphereLogContent, settings);
const elapsed = Date.now() - startTime;

// Summary
const { steps, assignedCosts, costData } = result;
const spheres = new Set(steps.map(s => s.sphereIndex));
const costAssignments = steps.filter(s => s.costAssignment);
const completedSteps = steps.filter(s => s.targetCompleted);
const failedSteps = steps.filter(s => !s.targetCompleted);
const grindingSteps = steps.filter(s => s.attemptNumber === 0);

console.log(`Cost generation complete in ${elapsed}ms`);
console.log(`Total steps: ${steps.length}`);
console.log(`Spheres: ${spheres.size}`);
console.log(`Tasks costed: ${assignedCosts.size}`);
console.log(`Cost assignments: ${costAssignments.length}`);
console.log(`Completed: ${completedSteps.length}, Failed/grinding: ${failedSteps.length}`);
if (grindingSteps.length > 0) {
    console.log(`Grinding steps (focus unreachable): ${grindingSteps.length}`);
}

// Print step-by-step summary
console.log('\n--- Step Summary ---\n');
for (const step of steps) {
    const status = step.targetCompleted ? 'OK' : step.attemptNumber === 0 ? 'GRIND' : 'FAIL';
    const costInfo = step.costAssignment
        ? ` [COST: ${step.costAssignment.taskName} costMult=${step.costAssignment.costMult.toFixed(4)}]`
        : '';
    const attempt = step.attemptNumber === 0
        ? 'grind'
        : `${step.attemptNumber}/${step.targetAttempts}`;
    console.log(
        `  Step ${String(step.stepIndex).padStart(3)} | S${step.sphereIndex} | ` +
        `${status.padEnd(5)} | ${attempt.padEnd(5)} | ` +
        `E: ${step.energyBudget.toFixed(0)}->${step.energyRemaining.toFixed(1).padStart(5)} | ` +
        `${step.targetTask}${costInfo}`
    );
}

// Print grinding efficiency for first step that has a grind plan
const firstGrindStep = steps.find(s => s.grindPlan);
if (firstGrindStep) {
    console.log('\n--- XP Grinding Efficiency (Step ' + firstGrindStep.stepIndex + ') ---\n');
    console.log('  Task                                Zone                 Skills          Cost      XP    XP/E  Sel');
    console.log('  ' + '-'.repeat(105));
    for (const gt of firstGrindStep.grindPlan.tasks) {
        console.log(
            `  ${gt.taskName.padEnd(36)} ${(gt.zoneName || '').padEnd(20)} ` +
            `${gt.skills.join(',').padEnd(14)} ` +
            `${gt.cost.toFixed(1).padStart(6)} ${gt.xp.toFixed(0).padStart(7)} ` +
            `${gt.xpPerEnergy.toFixed(1).padStart(7)}  ${gt.selected ? 'Y' : ''}`
        );
    }
    console.log(`  Budget: ${firstGrindStep.grindPlan.budget.toFixed(1)} | Selected: ${firstGrindStep.grindPlan.tasksSelected}/${firstGrindStep.grindPlan.candidatesConsidered}`);
}

// Print cost assignments table
console.log('\n--- Cost Assignments ---\n');
console.log('  Task                                    Zone                   Cat    costMult     xpMult  Attempts  Energy');
console.log('  ' + '-'.repeat(110));
for (const [taskName, info] of assignedCosts) {
    console.log(
        `  ${taskName.padEnd(40)} ${(info.zoneId !== undefined ? `Zone ${info.zoneId}` : '?').padEnd(22)} ` +
        `${(info.category || '?').padEnd(6)} ${info.costMult.toFixed(6).padStart(10)} ` +
        `${info.xpMult.toFixed(4).padStart(9)}  ${String(info.targetAttempts).padStart(8)}  ` +
        `${(info.energyAtAssignment !== undefined ? info.energyAtAssignment.toFixed(1) : '?').padStart(6)}`
    );
}

// Run verification
console.log('\n--- Verification ---\n');
const verifyStart = Date.now();
const verifyResult = planner.verifyCosts(gameDataJson, sphereLogContent, assignedCosts, settings);
const verifyElapsed = Date.now() - verifyStart;

const { comparison, verifySteps } = verifyResult;
const matched = comparison.filter(c => c.match).length;
const close = comparison.filter(c => !c.match && Math.abs(c.delta) <= 1).length;
const far = comparison.filter(c => !c.match && Math.abs(c.delta) > 1).length;

console.log(`Verification complete in ${verifyElapsed}ms (${verifySteps.length} steps)`);
console.log(`  Exact match: ${matched}/${comparison.length}`);
if (close > 0) console.log(`  Off by 1: ${close}`);
if (far > 0) console.log(`  Off by 2+: ${far}`);

const mismatches = comparison.filter(c => !c.match);
if (mismatches.length > 0) {
    console.log('\n  Mismatches:');
    for (const c of mismatches) {
        const delta = c.delta > 0 ? `+${c.delta}` : `${c.delta}`;
        console.log(`    ${c.taskName.padEnd(40)} planned=${c.plannedAttempts} actual=${c.actualAttempts} (${delta})`);
    }
}

// Write full report to file
if (args.output) {
    // Convert Maps to plain objects for JSON serialization
    const serializableResult = {
        ...costData,
        settings,
        elapsed,
        steps: steps.map(s => ({
            ...s,
            // Ensure Maps/Sets are serializable
            stateBefore: s.stateBefore ? {
                ...s.stateBefore,
                perks: Array.isArray(s.stateBefore.perks) ? s.stateBefore.perks : [...(s.stateBefore.perks || [])],
            } : null,
            stateAfter: s.stateAfter ? {
                ...s.stateAfter,
                perks: Array.isArray(s.stateAfter.perks) ? s.stateAfter.perks : [...(s.stateAfter.perks || [])],
            } : null,
        })),
        assignedCosts: Object.fromEntries(assignedCosts),
    };

    writeFileSync(args.output, JSON.stringify(serializableResult, null, 2), 'utf-8');
    console.log(`\nFull report written to: ${args.output}`);
}
