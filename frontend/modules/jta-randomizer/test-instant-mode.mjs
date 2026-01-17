#!/usr/bin/env node
/**
 * Test script to validate instant mode against the simulator
 *
 * This script:
 * 1. Runs the simulator to get expected results
 * 2. Runs the real game with instant mode via Playwright
 * 3. Compares the results
 *
 * Usage: node test-instant-mode.mjs [maxResets]
 */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import {
    ZONES, PERKS, PerkType, SkillType, TaskType,
    SKILL_NAMES, PERK_NAMES, getMandatoryTasks
} from './gameData.js';

import {
    calcTaskCost, calcProgressPerTick, calcTaskTicks,
    calcTaskEnergyCost, calcTaskXp, createInitialState,
    simulateRun, doEnergyReset
} from './simulator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const JTA_DIR = join(__dirname, '../../../journey-to-ascension');

// MIME types for serving files
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.map': 'application/json',
};

/**
 * Create a simple HTTP server to serve the JTA game
 */
function createGameServer(port) {
    return new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
            // Serve from JTA_DIR - the build files are in ./build/
            let filePath = join(JTA_DIR, req.url === '/' ? 'index.html' : req.url);

            try {
                const content = readFileSync(filePath);
                const ext = extname(filePath);
                res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
                res.end(content);
            } catch (err) {
                res.writeHead(404);
                res.end(`Not found: ${req.url}`);
            }
        });

        server.listen(port, () => {
            console.log(`Game server running at http://localhost:${port}`);
            resolve(server);
        });

        server.on('error', reject);
    });
}

/**
 * Run the game with instant mode and execute specific tasks
 * Returns detailed per-task results for comparison
 */
async function runGameWithInstantMode(page, taskSequence) {
    // Initialize game in headless mode
    await page.evaluate(() => {
        window.initializeHeadless();
        window.pauseGameLoop();
        window.setInstantMode(true);
    });

    const results = {
        taskResults: [],
        finalState: null
    };

    // Get initial state
    const initialState = await page.evaluate(() => window.getFullState());
    results.initialState = initialState;

    for (const taskId of taskSequence) {
        const beforeState = await page.evaluate(() => window.getFullState());

        // Perform the task
        const performResult = await page.evaluate((id) => {
            return window.performTask(id);
        }, taskId);

        if (!performResult.success) {
            results.taskResults.push({
                taskId,
                success: false,
                error: performResult.error,
                beforeState: {
                    energy: beforeState.currentEnergy,
                    zone: beforeState.currentZone
                }
            });
            continue;
        }

        // Step tick to complete it (instant mode)
        await page.evaluate(() => window.stepTick());

        const afterState = await page.evaluate(() => window.getFullState());

        results.taskResults.push({
            taskId,
            taskName: performResult.taskName,
            success: true,
            energyUsed: beforeState.currentEnergy - afterState.currentEnergy,
            beforeEnergy: beforeState.currentEnergy,
            afterEnergy: afterState.currentEnergy,
            beforeZone: beforeState.currentZone,
            afterZone: afterState.currentZone,
            skillLevels: afterState.skills.map(s => ({ type: s.type, level: s.level })),
            triggeredReset: afterState.isInEnergyReset
        });

        // Handle energy reset if triggered
        if (afterState.isInEnergyReset) {
            await page.evaluate(() => window.doEnergyReset());
        }
    }

    results.finalState = await page.evaluate(() => window.getFullState());
    return results;
}

/**
 * Run a simulation using the simulator to compute expected energy for tasks
 */
function runSimulatorForTasks(taskSequence) {
    const state = createInitialState();
    // Initialize currentEnergy to maxEnergy (simulator doesn't set this by default)
    state.currentEnergy = state.maxEnergy;

    const results = {
        taskResults: [],
        initialState: {
            currentEnergy: state.currentEnergy,
            maxEnergy: state.maxEnergy,
            currentZone: state.currentZone
        }
    };

    for (const taskId of taskSequence) {
        // Find the task in the zone data
        const zone = ZONES[state.currentZone];
        if (!zone) {
            results.taskResults.push({
                taskId,
                success: false,
                error: `Zone ${state.currentZone} not found`
            });
            continue;
        }

        const task = zone.tasks.find(t => t.id === taskId);
        if (!task) {
            results.taskResults.push({
                taskId,
                success: false,
                error: `Task ${taskId} not found in zone ${state.currentZone}`
            });
            continue;
        }

        // Calculate expected energy cost using simulator
        const energyCost = calcTaskEnergyCost(task, state.currentZone, state);
        const beforeEnergy = state.currentEnergy;

        // Check if we have enough energy
        if (energyCost > state.currentEnergy) {
            results.taskResults.push({
                taskId,
                taskName: task.name,
                success: true,
                expectedEnergyCost: energyCost,
                beforeEnergy: beforeEnergy,
                afterEnergy: state.currentEnergy - energyCost,
                triggeredReset: true,
                note: 'Would trigger reset'
            });
            continue;
        }

        // Apply the task
        state.currentEnergy -= energyCost;

        results.taskResults.push({
            taskId,
            taskName: task.name,
            success: true,
            expectedEnergyCost: energyCost,
            beforeEnergy: beforeEnergy,
            afterEnergy: state.currentEnergy,
            triggeredReset: false
        });
    }

    results.finalState = {
        currentEnergy: state.currentEnergy,
        currentZone: state.currentZone
    };

    return results;
}

/**
 * Compare task-by-task results between game and simulator
 */
function compareResults(gameResults, simResults) {
    console.log('\n=== TASK-BY-TASK COMPARISON ===\n');

    const numTasks = Math.min(gameResults.taskResults.length, simResults.taskResults.length);
    let mismatches = 0;
    let totalEnergyDiff = 0;

    console.log('Initial state:');
    console.log(`  Game: energy=${gameResults.initialState.currentEnergy}`);
    console.log(`  Sim:  energy=${simResults.initialState.currentEnergy}\n`);

    for (let i = 0; i < numTasks; i++) {
        const gameTask = gameResults.taskResults[i];
        const simTask = simResults.taskResults[i];

        if (!gameTask.success || !simTask.success) {
            console.log(`Task ${i + 1} (ID ${gameTask.taskId}): SKIPPED`);
            if (gameTask.error) console.log(`  Game error: ${gameTask.error}`);
            if (simTask.error) console.log(`  Sim error: ${simTask.error}`);
            continue;
        }

        const energyDiff = Math.abs(gameTask.energyUsed - simTask.expectedEnergyCost);
        totalEnergyDiff += energyDiff;

        // Allow small floating point differences (< 0.01)
        if (energyDiff > 0.01) {
            mismatches++;
            console.log(`Task ${i + 1} "${gameTask.taskName}" (ID ${gameTask.taskId}): MISMATCH`);
            console.log(`  Game: ${gameTask.beforeEnergy.toFixed(2)} -> ${gameTask.afterEnergy.toFixed(2)} (used: ${gameTask.energyUsed.toFixed(4)})`);
            console.log(`  Sim expected:     ${simTask.expectedEnergyCost.toFixed(4)}`);
            console.log(`  Difference:       ${energyDiff.toFixed(4)}`);
            if (gameTask.triggeredReset) console.log(`  Game triggered reset!`);
        } else {
            console.log(`Task ${i + 1} "${gameTask.taskName}": OK`);
            console.log(`  Game: ${gameTask.beforeEnergy.toFixed(2)} -> ${gameTask.afterEnergy.toFixed(2)} (used: ${gameTask.energyUsed.toFixed(2)})`);
            if (gameTask.triggeredReset) console.log(`  Game triggered reset!`);
        }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Tasks compared: ${numTasks}`);
    console.log(`Mismatches: ${mismatches}`);
    console.log(`Total energy difference: ${totalEnergyDiff.toFixed(4)}`);
    console.log(`Match rate: ${((numTasks - mismatches) / numTasks * 100).toFixed(1)}%`);

    // Final state comparison
    console.log('\n=== FINAL STATE ===');
    console.log(`Game: energy=${gameResults.finalState.currentEnergy.toFixed(2)}, zone=${gameResults.finalState.currentZone}`);
    console.log(`Sim:  energy=${simResults.finalState.currentEnergy.toFixed(2)}, zone=${simResults.finalState.currentZone}`);

    return mismatches === 0;
}

/**
 * Main test function
 */
async function main() {
    console.log('Journey to Ascension - Instant Mode Test');
    console.log('========================================\n');

    // Check if JTA directory exists
    if (!existsSync(JTA_DIR)) {
        console.error(`Error: JTA game directory not found at ${JTA_DIR}`);
        console.error('Please clone the game repository first.');
        process.exit(1);
    }

    // Define test task sequence - tasks from Zone 0 (The Village)
    // These are the first few mandatory tasks in the starting zone
    const testTasks = [];

    // Get Zone 0 tasks from game data
    const zone0 = ZONES[0];
    if (zone0) {
        console.log(`Zone 0 "${zone0.name}" has ${zone0.tasks.length} tasks:`);
        for (const task of zone0.tasks) {
            console.log(`  ID ${task.id}: ${task.name} (costMult: ${task.costMult}, maxReps: ${task.maxReps})`);
            if (testTasks.length < 5) {
                testTasks.push(task.id);
            }
        }
    }

    console.log(`\nTesting with tasks: ${testTasks.join(', ')}\n`);

    // Start game server
    const PORT = 8765;
    let server;
    let browser;

    try {
        server = await createGameServer(PORT);

        // Launch browser
        console.log('Launching browser...');
        browser = await chromium.launch({
            headless: true,
            executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome'
        });
        const page = await browser.newPage();

        // Navigate to game
        console.log('Loading game...');
        await page.goto(`http://localhost:${PORT}`);

        // Wait for game to initialize
        await page.waitForFunction(() => typeof window.getFullState === 'function', { timeout: 10000 });

        console.log('Game loaded, running instant mode test...\n');

        // Run game with instant mode
        const gameResults = await runGameWithInstantMode(page, testTasks);
        console.log(`Game completed ${gameResults.taskResults.length} tasks`);

        // Run simulator for comparison
        console.log('Running simulator for comparison...');
        const simResults = runSimulatorForTasks(testTasks);
        console.log(`Simulator computed ${simResults.taskResults.length} tasks`);

        // Compare results
        const success = compareResults(gameResults, simResults);

        if (success) {
            console.log('\n✓ All tests passed!');
        } else {
            console.log('\n✗ Some tests failed - investigating differences...');
            process.exit(1);
        }

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        if (server) server.close();
    }
}

main();
