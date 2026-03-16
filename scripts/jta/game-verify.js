#!/usr/bin/env node
/**
 * JTA Cost Debugger - Real Game Verification via Playwright
 *
 * Runs the cost debugger's planned steps through the actual game engine
 * in a headless browser with instant mode, comparing planned vs actual results.
 *
 * Usage:
 *   node scripts/jta/game-verify.js \
 *     -g frontend/presets/jta/AP_SEED/AP_SEED_P1_Player1_gamedata.json \
 *     -s frontend/presets/jta/AP_SEED/AP_SEED_sphere_log.jsonl \
 *     [--port 8000] [--two-pass] [--normal-attempts 2]
 *
 * Requires:
 *   - Playwright (npm install playwright)
 *   - The dev server running (python -m http.server 8000), OR use --serve
 */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { JTACostPlanner } from '../../frontend/modules/jtaCostDebugger/jtaCostPlanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
const FRONTEND_DIR = join(PROJECT_ROOT, 'frontend');

// ============================================================================
// Args
// ============================================================================

function parseArgs(argv) {
    const args = { verbose: 0, port: 8000, serve: false };
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--gamedata' || arg === '-g') {
            args.gamedata = argv[++i];
        } else if (arg === '--spherelog' || arg === '-s') {
            args.spherelog = argv[++i];
        } else if (arg === '--port') {
            args.port = parseInt(argv[++i]);
        } else if (arg === '--serve') {
            args.serve = true;
        } else if (arg === '--normal-attempts') {
            args.normalAttempts = parseInt(argv[++i]);
        } else if (arg === '--perk-attempts') {
            args.perkAttempts = parseInt(argv[++i]);
        } else if (arg === '--boss-attempts') {
            args.bossAttempts = parseInt(argv[++i]);
        } else if (arg === '--traversal-attempts') {
            args.traversalAttempts = parseInt(argv[++i]);
        } else if (arg === '--adjust-xp') {
            args.adjustXpMult = true;
        } else if (arg === '--two-pass') {
            args.twoPass = true;
            args.adjustXpMult = true;
        } else if (arg === '-v' || arg === '--verbose') {
            args.verbose++;
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }
    return args;
}

function printUsage() {
    console.log(`
JTA Cost Debugger - Real Game Verification

Runs planned costs through the actual game engine via Playwright headless browser.

Usage:
  node scripts/jta/game-verify.js [options]

Options:
  -g, --gamedata <path>         Randomized game data JSON (required)
  -s, --spherelog <path>        Sphere log JSONL (required)
  --port <n>                    Port for dev server (default: 8000)
  --serve                       Start a temporary HTTP server (otherwise assumes one is running)
  --normal-attempts <n>         Attempts for regular tasks (default: 2)
  --perk-attempts <n>           Attempts for perk tasks (default: 5)
  --boss-attempts <n>           Attempts for boss tasks (default: 5)
  --traversal-attempts <n>      Attempts for traversal tasks (default: 5)
  --adjust-xp                   Adjust xpMult on grinding tasks
  --two-pass                    Two-pass mode (implies --adjust-xp)
  -v, --verbose                 Show per-step details
  -h, --help                    Show this help
`);
}

// ============================================================================
// HTTP Server (optional)
// ============================================================================

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.jsonl': 'text/plain',
    '.yaml': 'text/yaml',
    '.map': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

function createGameServer(port) {
    return new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${port}`);
            let filePath = join(PROJECT_ROOT, url.pathname);

            try {
                const content = readFileSync(filePath);
                const ext = extname(filePath);
                res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
                res.end(content);
            } catch {
                res.writeHead(404);
                res.end(`Not found: ${url.pathname}`);
            }
        });

        server.listen(port, () => {
            resolve(server);
        });

        server.on('error', reject);
    });
}

// ============================================================================
// Main
// ============================================================================

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

const gameDataJson = JSON.parse(readFileSync(args.gamedata, 'utf-8'));
const sphereLogContent = readFileSync(args.spherelog, 'utf-8');

const settings = {
    normalAttempts: args.normalAttempts ?? 2,
    perkAttempts: args.perkAttempts ?? 5,
    bossAttempts: args.bossAttempts ?? 5,
    traversalAttempts: args.traversalAttempts ?? 5,
    adjustXpMult: args.adjustXpMult ?? false,
};

// Step 1: Run the cost planner to get planned steps
console.log('Running cost planner...');
let planner = new JTACostPlanner();
let result = planner.planCosts(gameDataJson, sphereLogContent, settings);

// Two-pass mode
if (args.twoPass) {
    const xpMultOverrides = new Map();
    for (const step of result.steps) {
        const xa = step.costAssignment?.xpAdjustments;
        if (!xa) continue;
        for (const adj of xa) {
            xpMultOverrides.set(adj.taskName, adj.newXpMult);
        }
    }
    if (xpMultOverrides.size > 0) {
        console.log(`Pass 1: ${xpMultOverrides.size} xpMult adjustments found`);
        const pass2GameData = JSON.parse(JSON.stringify(gameDataJson));
        for (const zone of pass2GameData.zones) {
            for (const task of zone.tasks) {
                if (xpMultOverrides.has(task.name)) {
                    task.xpMult = xpMultOverrides.get(task.name);
                }
            }
        }
        planner = new JTACostPlanner();
        result = planner.planCosts(pass2GameData, sphereLogContent, { ...settings, adjustXpMult: false });
        console.log('Pass 2: re-solved with baked xpMult values');
    }
}

const { steps, assignedCosts } = result;
console.log(`Planned: ${steps.length} steps, ${assignedCosts.size} tasks costed\n`);

// Step 2: Build the costs-only data for replaceGameData
const costsOnlyData = {
    zones: (result.adjustedData.zones || []).map(zone => ({
        tasks: (zone.tasks || []).map(task => ({
            id: task.id,
            costMult: task.costMult,
            xpMult: task.xpMult,
        })),
    })),
};

// Build task ID lookup
const taskIdByName = new Map();
for (const zone of gameDataJson.zones) {
    for (const task of zone.tasks) {
        taskIdByName.set(task.name, task.id);
    }
}

// Build sphere perk schedule (for granting perks between spheres)
// We need perk NAMES (not IDs) because the game grants by name
const spherePerkSchedule = new Map();
const sphereLogLines = sphereLogContent.trim().split('\n').map(l => JSON.parse(l));
// parseSphereLog groups by sphere — use the planner's parsed version
// but we need to know which perks each sphere grants
import { parseSphereLog } from '../../frontend/modules/jta-randomizer/jtaCostGenerator.js';
const sphereSteps = parseSphereLog(sphereLogContent, settings.playerNumber ?? 1);
for (const ss of sphereSteps) {
    spherePerkSchedule.set(ss.sphereIndex, ss.perksReceived || []);
}
const sphereIndices = [...spherePerkSchedule.keys()].sort((a, b) => a - b);

// Step 3: Launch browser and run real game verification
let server = null;
let browser = null;

try {
    // Start server if needed
    if (args.serve) {
        server = await createGameServer(args.port);
        console.log(`Dev server started on port ${args.port}`);
    }

    // Launch headless browser
    console.log('Launching headless browser...');
    browser = await chromium.launch({
        headless: true,
        executablePath: '/home/robert/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    });
    const page = await browser.newPage();

    // Navigate to the game iframe page and inject the instant mode wrapper
    const gameUrl = `http://localhost:${args.port}/frontend/modules/jta-remote/index-iframe.html`;
    console.log(`Loading game from ${gameUrl}...`);
    await page.goto(gameUrl);

    // Wait for the game to initialize (GAMESTATE available)
    await page.waitForFunction(
        () => !!window.getGamestate,
        { timeout: 30000 }
    );

    // Inject the instant mode wrapper
    const wrapperPath = join(FRONTEND_DIR, 'modules/jta-randomizer/jta-instant-mode-wrapper.js');
    const wrapperCode = readFileSync(wrapperPath, 'utf-8');
    await page.evaluate((code) => {
        // eslint-disable-next-line no-eval
        (0, eval)(code);
    }, wrapperCode);

    // Wait for wrapper APIs to be available
    await page.waitForFunction(
        () => typeof window.getFullState === 'function',
        { timeout: 5000 }
    );
    console.log('Game loaded, instant mode wrapper ready');

    // Pause game loop, enable instant mode
    await page.evaluate(() => {
        if (window.jta?.pauseGameLoop) window.jta.pauseGameLoop();
        window.setInstantMode(true);
    });

    // Load our cost data into the game
    await page.evaluate((data) => {
        // Update task definitions with our planned costs
        const taskLookup = window.TASK_LOOKUP;
        if (!taskLookup) throw new Error('TASK_LOOKUP not available');
        for (const zone of data.zones) {
            for (const task of zone.tasks) {
                const def = taskLookup.get(task.id);
                if (!def) continue;
                if (task.costMult !== undefined) def.cost_multiplier = task.costMult;
                if (task.xpMult !== undefined) def.xp_mult = task.xpMult;
            }
        }
    }, costsOnlyData);

    console.log('Cost data loaded into game\n');

    // Step 4: Replay planned steps through the real game
    const startTime = Date.now();
    const stepResults = [];
    let lastSphereIndex = null;
    let stepsMatched = 0;
    let energyMismatches = 0;

    for (let i = 0; i < steps.length; i++) {
        const planned = steps[i];
        const focusName = planned.targetTask;

        // Grant perks on sphere transitions
        if (lastSphereIndex !== null && planned.sphereIndex !== lastSphereIndex) {
            const perksToGrant = [];
            for (const si of sphereIndices) {
                if (si < lastSphereIndex) continue;
                if (si >= planned.sphereIndex) break;
                perksToGrant.push(...(spherePerkSchedule.get(si) || []));
            }
            if (perksToGrant.length > 0) {
                await page.evaluate((perkNames) => {
                    const gs = window.getGamestate;
                    if (!gs || !gs.perks) return;
                    // Look up perk IDs from names
                    const perkDefs = window.PERKS;
                    if (!perkDefs) return;
                    for (const name of perkNames) {
                        for (const [id, def] of Object.entries(perkDefs)) {
                            if (def.name === name) {
                                gs.perks.set(parseInt(id), true);
                                break;
                            }
                        }
                    }
                }, perksToGrant);
            }
        }
        lastSphereIndex = planned.sphereIndex;

        // Get state before
        const beforeState = await page.evaluate(() => window.getFullState());

        // Execute each task in the planned queue
        let focusCompleted = false;
        let finalEnergy = beforeState.currentEnergy;

        for (const pEntry of (planned.queue || [])) {
            if (pEntry.status === 'uncosted_skipped') continue;

            const taskId = taskIdByName.get(pEntry.taskName);
            if (taskId === undefined) continue;

            const taskResult = await page.evaluate(({ taskId }) => {
                const result = window.performTask(taskId);
                if (!result.success) return { success: false, error: result.error };
                const tick = window.stepTick();
                const state = window.getFullState();
                return {
                    success: true,
                    energy: state.currentEnergy,
                    isInEnergyReset: tick.isInEnergyReset || state.isInEnergyReset,
                };
            }, { taskId });

            if (!taskResult.success) break;

            finalEnergy = taskResult.energy;
            if (pEntry.taskName === focusName) focusCompleted = true;
            if (taskResult.isInEnergyReset) break;
        }

        const energyDelta = finalEnergy - planned.energyRemaining;
        const completedMatch = focusCompleted === planned.targetCompleted;

        if (completedMatch) stepsMatched++;
        if (Math.abs(energyDelta) > 1) energyMismatches++;

        if (args.verbose || !completedMatch) {
            const status = completedMatch ? 'OK' : 'MISMATCH';
            console.log(
                `Step ${String(i).padStart(4)} | ${focusName.padEnd(35)} | ` +
                `plan=${planned.energyRemaining.toFixed(1).padStart(6)} ` +
                `game=${finalEnergy.toFixed(1).padStart(6)} ` +
                `delta=${energyDelta.toFixed(1).padStart(6)} | ${status}`
            );
        }

        // Reset if focus didn't complete
        if (!focusCompleted) {
            await page.evaluate(() => {
                const gs = window.getGamestate;
                if (gs && gs.is_in_energy_reset) {
                    window.doEnergyReset();
                } else if (gs) {
                    // Force energy reset
                    gs.current_energy = 0;
                    gs.is_in_energy_reset = true;
                    window.doEnergyReset();
                }
            });
        }

        // Progress update
        if (i > 0 && i % 50 === 0) {
            console.log(`  ... ${i}/${steps.length} steps completed`);
        }
    }

    // Grant perks for the last sphere
    if (lastSphereIndex !== null) {
        const perksToGrant = [];
        for (const si of sphereIndices) {
            if (si < lastSphereIndex) continue;
            perksToGrant.push(...(spherePerkSchedule.get(si) || []));
        }
        // (not strictly needed for verification, but keeps parity)
    }

    const elapsed = Date.now() - startTime;

    // Summary
    console.log(`\n--- Real Game Verification ---\n`);
    console.log(`Completed in ${elapsed}ms (${steps.length} steps)`);
    console.log(`  Steps matched: ${stepsMatched}/${steps.length}`);
    console.log(`  Steps mismatched: ${steps.length - stepsMatched}`);
    console.log(`  Energy mismatches (>1): ${energyMismatches}`);

} catch (err) {
    console.error('Error:', err.message);
    if (args.verbose) console.error(err.stack);
    process.exit(1);
} finally {
    if (browser) await browser.close();
    if (server) server.close();
}
