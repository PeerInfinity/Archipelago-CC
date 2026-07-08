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
    // Unlock Savings ON (user ruling 2026-07-06, post-Round-6): the game's
    // toggles still all ship OFF, but this profile models play with the
    // automation explicitly enabled, and there we use the settings that give
    // the best results — savings is a measured pure win in both spark states.
    "auto_buy_budget_enabled",
    "resume_automation_on_reset",
    "force_automation",
    // NOT award_spark_on_discovery (flipped OFF 2026-07-06): the game's own
    // default is false, and Round 5 showed discovery spark is load-bearing —
    // it funds Divinity purchases with zero prestiges, which contaminated
    // every earlier sweep. Spark-on runs are an explicit override now
    // (modOverrides: { award_spark_on_discovery: true }); legacy experiments
    // in experiments.mjs get that override injected automatically.
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

// MARK: Purchase policies (Divinity buy-strategy experiments)
//
// Each policy is a per-tick function replacing the sim's auto_buy_cheapest
// greedy. They use only exported sim APIs (calcPrestigeRepeatableCost,
// hasPrestigeUnlock, addPrestigeUnlock, increasePrestigeRepeatableLevel) and
// the prestige_upgrades data module, so strategies can be A/B tested without
// touching the submodule. Layer gating mirrors maybeAutoBuyCheapest: only
// buy inside GAMESTATE.prestige_layers_unlocked.
//
// Descriptors ({ kind, ...params }):
//   { kind: "cheapest" }                — control; leaves auto_buy_cheapest on
//   { kind: "unlocksFirst" }            — hard save for the cheapest unowned
//                                         unlock; repeatables only when no
//                                         reachable unlock remains
//   { kind: "reserve", f: 1.0 }         — balance floor: repeatables may only
//                                         spend spark above f * next unlock cost
//   { kind: "spendCap", g: 1.0 }        — flow cap: cumulative repeatable spend
//                                         between unlock purchases <= g * next
//                                         unlock cost
//   { kind: "levelCap", cap: 10 }       — greedy, but repeatables stop at level
//                                         `cap` while any reachable unlock is
//                                         unowned
//   { kind: "tiers", list: [...] }      — authored ordering with strict
//                                         head-of-list saving; entries
//                                         { unlock: "Name" } or
//                                         { repeatable: "Name", count: N };
//                                         locked-layer entries are skipped until
//                                         their layer opens; greedy cheapest
//                                         after the list is exhausted
function makePurchasePolicy(env, desc) {
  const { sim, game, prestige } = env;
  if (!desc || desc.kind === "cheapest") return null;

  const G = () => game.GAMESTATE;
  const layerOpen = (layer) => G().prestige_layers_unlocked.includes(layer);
  const unownedUnlocks = () =>
    prestige.PRESTIGE_UNLOCKABLES.filter(
      (u) => layerOpen(u.layer) && !sim.hasPrestigeUnlock(u.type)
    ).sort((a, b) => a.cost - b.cost);
  const cheapestRepeatable = (eligible = () => true) => {
    let best = null;
    let bestCost = Infinity;
    for (const r of prestige.PRESTIGE_REPEATABLES) {
      if (!layerOpen(r.layer) || !eligible(r)) continue;
      const cost = sim.calcPrestigeRepeatableCost(r.type);
      if (cost < bestCost) {
        best = r;
        bestCost = cost;
      }
    }
    return best ? { def: best, cost: bestCost } : null;
  };
  const buyUnlocksWhileAffordable = () => {
    for (;;) {
      const next = unownedUnlocks()[0];
      if (!next || next.cost > G().divine_spark) return;
      sim.addPrestigeUnlock(next.type);
    }
  };

  if (desc.kind === "unlocksFirst") {
    return () => {
      buyUnlocksWhileAffordable();
      if (unownedUnlocks().length > 0) return;
      for (;;) {
        const pick = cheapestRepeatable();
        if (!pick || pick.cost > G().divine_spark) return;
        sim.increasePrestigeRepeatableLevel(pick.def.type);
      }
    };
  }

  if (desc.kind === "reserve") {
    const f = desc.f ?? 1.0;
    return () => {
      for (;;) {
        buyUnlocksWhileAffordable();
        const next = unownedUnlocks()[0];
        const reserve = next ? f * next.cost : 0;
        const pick = cheapestRepeatable();
        if (!pick || pick.cost > G().divine_spark - reserve) return;
        sim.increasePrestigeRepeatableLevel(pick.def.type);
      }
    };
  }

  if (desc.kind === "spendCap") {
    const g = desc.g ?? 1.0;
    let spentSinceUnlock = 0;
    let ownedCount = -1;
    return () => {
      for (;;) {
        const before = unownedUnlocks().length;
        buyUnlocksWhileAffordable();
        const remaining = unownedUnlocks();
        if (ownedCount === -1) ownedCount = remaining.length;
        if (remaining.length < before || remaining.length < ownedCount) {
          spentSinceUnlock = 0; // an unlock landed; new budget window
        }
        ownedCount = remaining.length;
        const next = remaining[0];
        const budget = next ? g * next.cost - spentSinceUnlock : Infinity;
        const pick = cheapestRepeatable();
        if (!pick || pick.cost > G().divine_spark || pick.cost > budget) return;
        sim.increasePrestigeRepeatableLevel(pick.def.type);
        spentSinceUnlock += pick.cost;
      }
    };
  }

  if (desc.kind === "levelCap") {
    const cap = desc.cap ?? 10;
    return () => {
      for (;;) {
        buyUnlocksWhileAffordable();
        const anyUnlockLeft = unownedUnlocks().length > 0;
        const pick = cheapestRepeatable(
          (r) =>
            !anyUnlockLeft || sim.getPrestigeRepeatableLevel(r.type) < cap
        );
        if (!pick || pick.cost > G().divine_spark) return;
        sim.increasePrestigeRepeatableLevel(pick.def.type);
      }
    };
  }

  if (desc.kind === "tiers") {
    const byUnlockName = new Map(
      prestige.PRESTIGE_UNLOCKABLES.map((u) => [u.name, u])
    );
    const byRepName = new Map(
      prestige.PRESTIGE_REPEATABLES.map((r) => [r.name, r])
    );
    const entries = desc.list.map((e) => {
      if (e.unlock) {
        const def = byUnlockName.get(e.unlock);
        if (!def) throw new Error(`tiers: unknown unlock ${e.unlock}`);
        return { kind: "unlock", def };
      }
      const def = byRepName.get(e.repeatable);
      if (!def) throw new Error(`tiers: unknown repeatable ${e.repeatable}`);
      return { kind: "repeatable", def, count: e.count ?? 1, bought: 0 };
    });
    return () => {
      for (;;) {
        // Effective head: first unfinished entry whose layer is open. Strict
        // saving among *available* entries; locked layers don't block.
        const head = entries.find((e) => {
          if (!layerOpen(e.def.layer)) return false;
          return e.kind === "unlock"
            ? !sim.hasPrestigeUnlock(e.def.type)
            : e.bought < e.count;
        });
        if (!head) {
          // List done — fall back to greedy cheapest (unlocks + repeatables).
          buyUnlocksWhileAffordable();
          const pick = cheapestRepeatable();
          const next = unownedUnlocks()[0];
          if (
            pick &&
            pick.cost <= G().divine_spark &&
            (!next || pick.cost < next.cost)
          ) {
            sim.increasePrestigeRepeatableLevel(pick.def.type);
            continue;
          }
          return;
        }
        const cost =
          head.kind === "unlock"
            ? head.def.cost
            : sim.calcPrestigeRepeatableCost(head.def.type);
        if (cost > G().divine_spark) return;
        if (head.kind === "unlock") {
          sim.addPrestigeUnlock(head.def.type);
        } else {
          sim.increasePrestigeRepeatableLevel(head.def.type);
          head.bought++;
        }
      }
    };
  }

  throw new Error(`unknown purchase policy kind: ${desc.kind}`);
}

export function runFirstCompletionStats(env, options = {}) {
  const { sim, game, zones, win } = env;
  const zoneLimit = options.zoneLimit ?? 15;
  const maxRuns = options.maxRuns ?? 500;
  const maxTicksPerRun = options.maxTicksPerRun ?? 200000;
  const endZone = options.endZone ?? 99;
  const logEvery = options.logEvery ?? 25;
  // Substrate emulation: pin max_energy to a fixed value at every run
  // boundary, the way the jta substrate bridge pins energy to the shared
  // loop-mode pool (Energetic Memory growth and prestige energy repeatables
  // stop mattering; threshold pct budgets stay pct-of-pin). null = off.
  const pinMaxEnergy = options.pinMaxEnergy ?? null;
  const applyEnergyPin = () => {
    if (pinMaxEnergy == null) return;
    // Pin starting energy (max_energy) to the shared-pool value and refill
    // current energy to it at each loop boundary (init + after every
    // reset/prestige). This mirrors the host loop reset, where refillMana
    // sets currentMana = maxMana (= startingMana) and discards any surplus.
    // NOT a mid-loop ceiling: between boundaries current_energy is free to
    // exceed max_energy — as it does in JtA and in the shared pool, where
    // maxMana is the loop's STARTING mana (and the mana-bar max), not a cap.
    game.GAMESTATE.max_energy = pinMaxEnergy;
    game.GAMESTATE.current_energy = pinMaxEnergy;
  };
  // Full profile via options.mods, or small experiment deltas on top of the
  // baseline profile via options.modOverrides.
  const mods =
    options.mods ?? { ...baselineMods(), ...(options.modOverrides ?? {}) };
  const log = env.log ?? ((msg) => console.log(msg));

  // Fresh state, no wall-clock ticking. pauseGameLoop is a no-op headlessly
  // (the loop never started) but essential in the browser page.
  win.pauseGameLoop();
  win.initializeHeadless();
  win.setInstantMode(true);
  applyEnergyPin();

  // Field-level game-data patches (Phase 1 enabler): apply the same
  // Tier-1 costMult/xpMult/maxReps/perk/item patches the substrate bridge
  // rides on each region's sidecar, so the harness can measure pacing
  // under randomized/rebalanced data. Applied once after init — patches
  // mutate the static TaskDefinitions in place and never reset, so they
  // persist across every simulated run. Built before the universe below,
  // so a patched max_reps is reflected in the first-completion metric.
  const gameDataPatch = options.gameDataPatch ?? null;
  if (gameDataPatch) {
    if (typeof win.applyTaskPatches !== "function") {
      throw new Error(
        "gameDataPatch set but win.applyTaskPatches is unavailable " +
          "(fork build predates the Tier-1 hooks)"
      );
    }
    const res = win.applyTaskPatches(gameDataPatch);
    log(
      `[driver] gameDataPatch: ${res.applied.length} task(s) patched` +
        (res.skipped.length ? `, ${res.skipped.length} skipped (unknown id)` : "")
    );
  }

  for (const [name, value] of Object.entries(mods)) {
    if (!sim.setMod(name, value)) {
      throw new Error(`setMod(${name}, ${JSON.stringify(value)}) failed`);
    }
  }

  // Divinity purchase policy: a driver-side replacement for the sim's
  // auto_buy_cheapest greedy (which must be OFF so the two don't fight).
  const purchasePolicy = options.purchasePolicy ?? { kind: "cheapest" };
  const runPolicy = makePurchasePolicy(env, purchasePolicy);
  if (runPolicy) {
    sim.setMod("auto_buy_cheapest", false);
    mods.auto_buy_cheapest = false;
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

  // Task universe: every task defined in zones 0..zoneLimit-1, minus
  // options.excludeTaskIds. Exclusion exists for zone-limited spark-off
  // runs: the four SBtV-gated hidden tasks (ids 17/28/88/158) have no
  // in-game unlocker, and without discovery spark or a prestige-scale
  // horizon SeeBeyondTheVeil is never bought — they'd sit as permanent
  // maxRuns+1 penalties. Full-game runs should NOT exclude them (prestige
  // spark buys SBtV eventually; their timing is real tail signal).
  const excludeTaskIds = new Set(options.excludeTaskIds ?? []);
  const universe = new Map();
  zones.ZONES.slice(0, zoneLimit).forEach((zone, zi) => {
    for (const def of zone.tasks) {
      if (excludeTaskIds.has(def.id)) {
        log(`[driver] excluding task ${def.id} (${def.name}, zone ${zi + 1}) from metric universe`);
        continue;
      }
      universe.set(def.id, {
        id: def.id,
        name: def.name,
        zone: zi,
        zoneName: zone.name,
        maxReps: def.max_reps,
        hidden: def.hidden_by_default,
      });
    }
  });

  const completions = new Map();
  const runEnds = [];
  // Unlock purchase timeline: run number at which each one-time Divinity
  // unlock lands, whoever buys it (policy, queue engine, or the sim greedy).
  const purchases = [];
  const ownedUnlocks = new Set();
  const trackPurchases = () => {
    if (!env.prestige) return;
    for (const u of env.prestige.PRESTIGE_UNLOCKABLES) {
      if (!ownedUnlocks.has(u.type) && sim.hasPrestigeUnlock(u.type)) {
        ownedUnlocks.add(u.type);
        purchases.push({ name: u.name, cost: u.cost, layer: u.layer, run });
      }
    }
  };
  let run = 1;
  let ticks = 0;
  let ticksThisRun = 0;
  let stalled = false;
  // Idle = nothing changes tick over tick: no energy drain, no rep gained,
  // no zone advance. Happens at end of content (last zone fully done — the
  // real game shows an overlay whose reset/prestige buttons the player
  // clicks) and would otherwise spin to maxTicksPerRun. After a short grace
  // we replicate that click via the same run-end branch. NOTE: active_task
  // is NOT a usable idle signal — instant mode leaves it null at the end of
  // every tick.
  let idleTicks = 0;
  let lastSig = "";
  const maxIdleTicks = options.maxIdleTicks ?? 50;
  let endOfContentRuns = 0;
  const progressSig = () =>
    `${game.GAMESTATE.current_zone}|${game.GAMESTATE.current_energy}|` +
    `${game.GAMESTATE.tasks.reduce((a, t) => a + t.reps, 0)}`;

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

  // Spark-income accounting, computed EXACTLY at checkpoints rather than by
  // watching per-tick deltas (gains and spends can land in the same tick):
  // earned = spark held + spark ever spent, and spending reconstructs from
  // owned unlocks + repeatable levels (levels never reset, costs are
  // geometric). Divinity purchases are the only spark sinks.
  const checkpointEvery = options.checkpointEvery ?? 100;
  const sparkCheckpoints = [];
  const sparkSpent = () => {
    if (!env.prestige) return 0;
    let spent = 0;
    for (const u of env.prestige.PRESTIGE_UNLOCKABLES) {
      if (sim.hasPrestigeUnlock(u.type)) spent += u.cost;
    }
    for (const r of env.prestige.PRESTIGE_REPEATABLES) {
      const lvl = sim.getPrestigeRepeatableLevel(r.type);
      for (let i = 0; i < lvl; i++) {
        spent += Math.ceil(r.initial_cost * Math.pow(r.scaling_exponent, i));
      }
    }
    return spent;
  };
  const sparkCheckpoint = (atRun) => {
    const held = game.GAMESTATE.divine_spark;
    sparkCheckpoints.push({
      run: atRun,
      sparkEarned: held + sparkSpent(),
      sparkHeld: held,
      prestiges: game.GAMESTATE.prestige_count,
      highestZone: Math.max(
        game.GAMESTATE.highest_zone,
        game.GAMESTATE.highest_prestige_zone ?? 0
      ),
    });
  };

  // Mastery of Time's skipFreeZones() runs INSIDE doEnergyReset/doPrestige
  // (both driver-called) and fully completes every task of each skipped
  // zone on transient task arrays the per-tick scan never sees. Skip only
  // advances through fully-completed zones, so after the run-end action
  // every universe task below current_zone is complete — except hidden
  // tasks whose unlock isn't owned (they aren't in the zone's task list).
  const recordBoundaryCompletions = () => {
    if (run > maxRuns) return;
    const cz = game.GAMESTATE.current_zone;
    for (const t of universe.values()) {
      if (t.zone >= cz || completions.has(t.id)) continue;
      if (t.hidden && !game.GAMESTATE.unlocked_tasks.includes(t.id)) continue;
      completions.set(t.id, {
        ...t,
        run,
        prestiges: game.GAMESTATE.prestige_count,
        viaZoneSkip: true,
      });
    }
    scan(game.GAMESTATE.tasks); // landing zone: MoT auto-completes 1-tick tasks
  };

  const now =
    typeof performance !== "undefined" ? () => performance.now() : () => 0;
  const t0 = now();

  // runToBudget: keep playing to maxRuns even once every universe task has
  // completed — used by the spark-income experiments, where the metric is
  // the earning trajectory, not first completions.
  const runToBudget = options.runToBudget ?? false;

  // Observation hook: called at the start of every run (fresh post-reset
  // state — energy refilled/pinned, zone settled by skipFreeZones) with the
  // upcoming run number and the live first-completions map. Used by
  // profile-vanilla.mjs for skill/estimator sampling; never serialized.
  const onRunBoundary = options.onRunBoundary ?? null;
  if (onRunBoundary) onRunBoundary({ run, completions });

  while (
    (runToBudget || completions.size < universe.size) &&
    run <= maxRuns
  ) {
    // Capture the pre-tick task array: on a zone advance the tick replaces
    // GAMESTATE.tasks, and the completed Travel task only exists in the old
    // array (same Task objects, mutated in place).
    const before = game.GAMESTATE.tasks;
    sim.updateGamestate();
    ticks++;
    ticksThisRun++;
    scan(before);
    if (game.GAMESTATE.tasks !== before) scan(game.GAMESTATE.tasks);
    if (runPolicy) runPolicy();
    trackPurchases();
    // Nobody drains the render-event queue headlessly, and saveGame
    // serializes the whole gamestate (queue included) on every instant
    // completion — clearing per tick keeps that O(1).
    game.GAMESTATE.pending_render_events.length = 0;

    if (!game.GAMESTATE.is_in_energy_reset) {
      const sig = progressSig();
      if (sig === lastSig) {
        idleTicks++;
        if (idleTicks >= maxIdleTicks) {
          game.GAMESTATE.is_in_energy_reset = true;
          endOfContentRuns++;
        }
      } else {
        idleTicks = 0;
        lastSig = sig;
      }
    }

    if (game.GAMESTATE.is_in_energy_reset) {
      const zoneAtEnd = game.GAMESTATE.current_zone;
      const prestiged = sim.maybeAutoPrestige();
      if (!prestiged) sim.doEnergyReset();
      applyEnergyPin();
      runEnds.push({
        run,
        endZone: zoneAtEnd,
        highestZone: game.GAMESTATE.highest_zone,
        prestiged,
        ticks: ticksThisRun,
      });
      if (run % checkpointEvery === 0) sparkCheckpoint(run);
      if (run % logEvery === 0) {
        log(
          `[driver] run ${run}: ${completions.size}/${universe.size} tasks completed, ` +
            `zone ${zoneAtEnd}, prestiges ${game.GAMESTATE.prestige_count}, ${ticks} ticks total`
        );
      }
      run++;
      ticksThisRun = 0;
      idleTicks = 0;
      lastSig = "";
      recordBoundaryCompletions();
      if (onRunBoundary && run <= maxRuns) onRunBoundary({ run, completions });
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

  const lastRunCompleted = run - 1;
  if (
    sparkCheckpoints.length === 0 ||
    sparkCheckpoints[sparkCheckpoints.length - 1].run !== lastRunCompleted
  ) {
    sparkCheckpoint(lastRunCompleted);
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
      excludeTaskIds: [...excludeTaskIds],
      skipBlocked,
      autoFillOrder,
      purchasePolicy,
      runToBudget,
      checkpointEvery,
      gameDataPatch,
      mods,
    },
    timing: {
      wallMs,
      ticks,
      runsExecuted: runEnds.length,
      ticksPerSec: wallMs > 0 ? Math.round((ticks / wallMs) * 1000) : null,
    },
    stalled,
    endOfContentRuns,
    allCompleted: completions.size === universe.size,
    taskCount: universe.size,
    completedCount: completions.size,
    finalState: {
      prestiges: game.GAMESTATE.prestige_count,
      highestZone: Math.max(
        game.GAMESTATE.highest_zone,
        game.GAMESTATE.highest_prestige_zone ?? 0
      ),
      divineSpark: game.GAMESTATE.divine_spark,
      repeatableLevels: env.prestige
        ? Object.fromEntries(
            env.prestige.PRESTIGE_REPEATABLES.map((r) => [
              r.name,
              sim.getPrestigeRepeatableLevel(r.type),
            ]).filter(([, lvl]) => lvl > 0)
          )
        : undefined,
    },
    purchases,
    sparkCheckpoints,
    completions: completed,
    unreached,
    runEnds,
  };
}
