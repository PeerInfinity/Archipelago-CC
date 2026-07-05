// JtA automation statistics driver.
//
// Environment-agnostic: runs both inside a real browser page (see
// run-playwright.mjs) and in plain Node with DOM stubs (see run-node.mjs).
// Everything environment-specific arrives through `env`:
//   env.sim   — module namespace of build/simulation.js
//   env.game  — module namespace of build/game.js (live GAMESTATE binding)
//   env.zones — module namespace of build/zones.js
//   env.win   — the window object carrying the programmatic API
//               (initializeHeadless, setInstantMode, pauseGameLoop)
//
// Measures, for every task in the first `zoneLimit` zones, the cumulative
// run number at which the task is FIRST fully completed (reps == max_reps).
//
// Two rules baked in from the 2026-07-04 session:
//  - The run-end decision (auto-prestige vs energy reset) lives in the
//    rendering layer, so this driver replicates that branch itself: when
//    is_in_energy_reset flips on, call sim.maybeAutoPrestige() and fall
//    back to sim.doEnergyReset() if it returns false.
//  - energy_reset_count zeroes on prestige, so cumulative runs are counted
//    here in the driver, never read back from the game.

// The user's tested play profile (numeric threshold defaults are already the
// tuned values, so only booleans + threshold_all_skipped need setting).
export function baselineMods() {
  const on = [
    "auto_haste",
    "auto_lightning",
    "auto_use_cycle",
    "auto_use_free_items",
    "artifact_tasks_item_cycle_only",
    "auto_dreamcatcher",
    "auto_ring",
    "auto_prioritize",
    "auto_prestige",
    "auto_buy_cheapest",
    "resume_automation_on_reset",
    "force_automation",
    "award_spark_on_discovery",
    "auto_continue_energy_reset",
    "suppress_prestige_popup",
    "show_spark_stats",
    "instant_mode_allowed",
    "threshold_master",
    "threshold_perk_affordable_enabled",
    "threshold_perk_unaffordable_enabled",
    "threshold_combat_enabled",
    "threshold_item_enabled",
    "threshold_prestige_enabled",
    "threshold_progression_enabled",
    "threshold_unlocker_enabled",
    "threshold_other_enabled",
    "auto_prestige_stall_enabled",
    // NOT queue_cycle (mutually exclusive with auto_prioritize),
    // NOT instant_mode (driven via window.setInstantMode instead),
    // NOT auto_prestige ratio/target/wealth conditions (stall-only profile).
  ];
  const mods = {};
  for (const name of on) mods[name] = true;
  mods.threshold_all_skipped = 2; // Best Task
  return mods;
}

export function runFirstCompletionStats(env, options = {}) {
  const { sim, game, zones, win } = env;
  const zoneLimit = options.zoneLimit ?? 15;
  const maxRuns = options.maxRuns ?? 500;
  const maxTicksPerRun = options.maxTicksPerRun ?? 200000;
  const endZone = options.endZone ?? 99;
  const logEvery = options.logEvery ?? 25;
  const mods = options.mods ?? baselineMods();
  const log = env.log ?? ((msg) => console.log(msg));

  // Fresh state, no wall-clock ticking. pauseGameLoop is a no-op headlessly
  // (the loop never started) but essential in the browser page.
  win.pauseGameLoop();
  win.initializeHeadless();
  win.setInstantMode(true);

  for (const [name, value] of Object.entries(mods)) {
    if (!sim.setMod(name, value)) {
      throw new Error(`setMod(${name}, ${JSON.stringify(value)}) failed`);
    }
  }

  // Automation-panel setting, not a mod: "Skip on Block". With the default
  // Pause on Block, the priority walk parks forever on the first blocked
  // task (too-strong boss / missing item) — a permanent idle in a headless
  // run (observed: run 10, zone 2, Goblin Warlord). Not wiped by prestige.
  const skipBlocked = options.skipBlocked ?? true;
  game.GAMESTATE.automation_skip_blocked = skipBlocked;

  // Optional experiment axis: player-configurable Auto-Fill group order.
  // Valid keys: item, combat, perk, prestige, unlocker, plain, mandatory,
  // travel (getAutoFillOrder sanitizes, so partial lists are fine).
  const autoFillOrder = options.autoFillOrder ?? null;
  if (autoFillOrder) {
    game.GAMESTATE.auto_fill_order = [...autoFillOrder];
  }

  sim.setAutomationEndZone(endZone);
  sim.autoFillAllPriorities();
  sim.setAutomationMode(sim.AutomationMode.All);

  // Task universe: every task defined in zones 0..zoneLimit-1.
  const universe = new Map();
  zones.ZONES.slice(0, zoneLimit).forEach((zone, zi) => {
    for (const def of zone.tasks) {
      universe.set(def.id, {
        id: def.id,
        name: def.name,
        zone: zi,
        zoneName: zone.name,
        maxReps: def.max_reps,
      });
    }
  });

  const completions = new Map();
  const runEnds = [];
  let run = 1;
  let ticks = 0;
  let ticksThisRun = 0;
  let stalled = false;

  const scan = (tasks) => {
    for (const t of tasks) {
      const def = t.task_definition;
      if (
        t.reps >= def.max_reps &&
        universe.has(def.id) &&
        !completions.has(def.id)
      ) {
        completions.set(def.id, {
          ...universe.get(def.id),
          run,
          prestiges: game.GAMESTATE.prestige_count,
        });
      }
    }
  };

  const now =
    typeof performance !== "undefined" ? () => performance.now() : () => 0;
  const t0 = now();

  while (completions.size < universe.size && run <= maxRuns) {
    // Capture the pre-tick task array: on a zone advance the tick replaces
    // GAMESTATE.tasks, and the completed Travel task only exists in the old
    // array (same Task objects, mutated in place).
    const before = game.GAMESTATE.tasks;
    sim.updateGamestate();
    ticks++;
    ticksThisRun++;
    scan(before);
    if (game.GAMESTATE.tasks !== before) scan(game.GAMESTATE.tasks);
    // Nobody drains the render-event queue headlessly, and saveGame
    // serializes the whole gamestate (queue included) on every instant
    // completion — clearing per tick keeps that O(1).
    game.GAMESTATE.pending_render_events.length = 0;

    if (game.GAMESTATE.is_in_energy_reset) {
      const zoneAtEnd = game.GAMESTATE.current_zone;
      const prestiged = sim.maybeAutoPrestige();
      if (!prestiged) sim.doEnergyReset();
      runEnds.push({
        run,
        endZone: zoneAtEnd,
        highestZone: game.GAMESTATE.highest_zone,
        prestiged,
        ticks: ticksThisRun,
      });
      if (run % logEvery === 0) {
        log(
          `[driver] run ${run}: ${completions.size}/${universe.size} tasks completed, ` +
            `zone ${zoneAtEnd}, prestiges ${game.GAMESTATE.prestige_count}, ${ticks} ticks total`
        );
      }
      run++;
      ticksThisRun = 0;
      continue;
    }

    if (ticksThisRun > maxTicksPerRun) {
      stalled = true;
      log(
        `[driver] STALLED: run ${run} exceeded ${maxTicksPerRun} ticks without an energy reset ` +
          `(zone ${game.GAMESTATE.current_zone}, active task: ${game.GAMESTATE.active_task?.task_definition?.name ?? "none"})`
      );
      break;
    }
  }

  const wallMs = now() - t0;
  // The sim restarts the interval loop via setTickRate() during play (zone
  // advances, prestige); re-pause so the page doesn't resume ticking the
  // finished game after we return.
  win.pauseGameLoop();
  const completed = Array.from(completions.values()).sort(
    (a, b) => a.zone - b.zone || a.id - b.id
  );
  const unreached = Array.from(universe.values())
    .filter((t) => !completions.has(t.id))
    .sort((a, b) => a.zone - b.zone || a.id - b.id);

  return {
    options: {
      zoneLimit,
      maxRuns,
      maxTicksPerRun,
      endZone,
      skipBlocked,
      autoFillOrder,
      mods,
    },
    timing: {
      wallMs,
      ticks,
      runsExecuted: runEnds.length,
      ticksPerSec: wallMs > 0 ? Math.round((ticks / wallMs) * 1000) : null,
    },
    stalled,
    allCompleted: completions.size === universe.size,
    taskCount: universe.size,
    completedCount: completions.size,
    finalState: {
      prestiges: game.GAMESTATE.prestige_count,
      highestZone: game.GAMESTATE.highest_zone,
      divineSpark: game.GAMESTATE.divine_spark,
    },
    completions: completed,
    unreached,
    runEnds,
  };
}
