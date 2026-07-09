#!/usr/bin/env node
/**
 * Regression probe: `skipFreeZones()` must terminate in MANAGED (substrate) mode.
 *
 * The fork's `skipCurrentZoneIfFree()` free-completes a zone whose tasks are all
 * single-tick, then reports whether it skipped. Standalone, the Travel task's
 * `onFullyFinishTask` calls `advanceZone()` and swaps `GAMESTATE.tasks`. In
 * managed mode the host owns zone transitions, so `advanceZone()` never runs and
 * the task array does not change — a `skipCurrentZoneIfFree()` that always
 * returned true made `skipFreeZones()`'s `while` loop re-skip the finished zone
 * forever, hanging the game inside `doEnergyReset()`.
 *
 * The hang needs three things at once, all of which real substrate play reaches:
 *   - managed mode (always, in the procgen substrate),
 *   - the Minor Time Compression perk (a ZONE 1 perk — a v1 AP item), and
 *   - a zone whose tasks are all single-tick (skill level >= ~600 at vanilla
 *     costs; instantly, at `cost_multiplier` 0.05 — which is what the Pass-B
 *     balancer's below-floor clamp assigns).
 *
 * Each case runs in its own child process with a timeout, so a re-introduced
 * hang shows up as a failure instead of wedging the test run.
 *
 *   node scripts/procgen/verify-jta-managed-zone-skip.mjs
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const TIMEOUT_MS = 30000;

// Child mode: set up one scenario, run doEnergyReset, print the outcome.
if (process.argv[2] === '--case') {
    const [managed, perk, cheap, level] = process.argv.slice(3);
    const { loadJtaEnv } = await import(
        `file://${path.join(repoRoot, 'CC/scripts/jta-stats/node-env.mjs')}`);
    const env = await loadJtaEnv();
    const { sim, zones, win, game } = env;
    win.pauseGameLoop();
    win.initializeHeadless();
    win.setInstantMode(true);
    win.setManagedMode(managed === '1');
    win.loadZone(0);
    const G = game.GAMESTATE;
    if (cheap === '1') {
        win.applyTaskPatches([...zones.TASK_LOOKUP.values()]
            .filter((d) => d.zone_id === 0)
            .map((d) => ({ id: d.id, cost_multiplier: 0.05 })));
    }
    for (const s of G.skills) { s.level = Number(level); s.progress = 0; }
    if (perk === '1') win.grantPerk('Minor Time Compression');
    sim.doEnergyReset();
    const fullyDone = G.tasks.filter((t) => t.reps >= t.task_definition.max_reps).length;
    process.stdout.write(JSON.stringify({ zone: G.current_zone, fullyDone, taskCount: G.tasks.length }));
    win.pauseGameLoop();
    process.exit(0);
}

let failures = 0;
const ok = (cond, msg) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}: ${msg}`);
    if (!cond) failures++;
};

/** Returns the child's parsed result, or null if it hung / crashed. */
function runCase({ managed, perk, cheap, level }) {
    try {
        const out = execFileSync(process.execPath, [
            fileURLToPath(import.meta.url), '--case',
            managed ? '1' : '0', perk ? '1' : '0', cheap ? '1' : '0', String(level),
        ], { cwd: repoRoot, encoding: 'utf8', timeout: TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'] });
        return JSON.parse(out);
    } catch {
        return null;
    }
}

// The hang case: managed + the perk + an all-single-tick zone (balancer costs).
const hung = runCase({ managed: true, perk: true, cheap: true, level: 0 });
ok(hung !== null, 'managed + MinorTimeCompression + cheap zone: doEnergyReset terminates');
if (hung) {
    ok(hung.zone === 0, `managed mode does not self-advance the zone (stayed at ${hung.zone})`);
    ok(hung.fullyDone === hung.taskCount,
        `the free zone's tasks are still completed, so items/perks/checks are awarded (${hung.fullyDone}/${hung.taskCount})`);
}

// Same, at vanilla costs and the skill level real play reaches.
const vanillaHigh = runCase({ managed: true, perk: true, cheap: false, level: 800 });
ok(vanillaHigh !== null, 'managed + MinorTimeCompression at skill 800 (vanilla costs): terminates');

// Standalone must still skip zones — the feature is not disabled, only bounded.
const solo = runCase({ managed: false, perk: true, cheap: true, level: 0 });
ok(solo !== null && solo.zone > 0,
    `standalone still skips free zones (advanced to zone ${solo?.zone})`);

// Without the perk there is no skipping at all, in either mode.
const noPerk = runCase({ managed: true, perk: false, cheap: true, level: 0 });
ok(noPerk !== null && noPerk.zone === 0 && noPerk.fullyDone === 0,
    'no MinorTimeCompression: no free-zone skipping happens');

console.log(failures === 0
    ? '\nAll managed-mode zone-skip assertions passed.'
    : `\n${failures} assertion(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
