// JtA differential parity harness: fork (mods at shipped defaults = all
// toggles OFF) vs the upstream fork-point commit, driven in lockstep through
// the COMMON exported sim surface, compared field-by-field EVERY tick.
//
// Both engines are loaded headlessly in this one process (separate module
// graphs from separate build dirs, shared DOM stubs — see
// frontend/modules/jtaBalance/headlessGameEnv.js, the jta-stats prior art).
// The sims contain no Math.random / Date.now, so the bar is EXACT equality.
//
// Isolation: each scenario runs in a FRESH child process (this file re-invoked
// with --scenario). Both sims keep mutable module-level state (e.g. upstream's
// task_progress_mult, the fork's threshold bookkeeping) that nothing resets,
// and upstream has no way to rebuild GAMESTATE from outside — process-fresh is
// the only state reset that is provably symmetric.
//
// Fork side comes from the submodule's COMMITTED HEAD (`git archive`), never
// its working tree — another agent may be editing/rebuilding it concurrently.
//
// Usage:
//   node CC/scripts/jta-parity/run-parity.mjs               # all scenarios
//   node CC/scripts/jta-parity/run-parity.mjs --scenario automation
//   node CC/scripts/jta-parity/run-parity.mjs --list
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const submoduleDir = path.join(
  repoRoot,
  "frontend/modules/journey-to-ascension"
);
const upstreamBuildDir = path.join(here, "upstream", "build");
const forkExtractDir = path.join(here, "fork-head");
const resultsDir = path.join(here, "results");

// ---------------------------------------------------------------------------
// MARK: Scenario table
// ---------------------------------------------------------------------------
// Each scenario declares its drive policy (applied per-engine, deterministic,
// no cross-engine reads), its run-end boundary decision, its budgets, and the
// minimum activity that makes its PASS non-vacuous.
const SCENARIOS = {
  idle: {
    description:
      "fresh game, no input at all — engines tick with no active task",
    maxTicks: 2000,
    minTicks: 2000,
    minResets: 0,
    forceEndOnIdle: false,
    policy: null,
    boundary: () => "reset",
    stopWhen: null,
  },
  scripted: {
    description:
      "scripted early-game click-through (first enabled non-Travel task, " +
      "then Travel) across several energy resets",
    maxTicks: 120000,
    minTicks: 2500,
    minResets: 20,
    forceEndOnIdle: true,
    policy: clickPolicy,
    boundary: () => "reset",
    stopWhen: (ctx) => ctx.resets >= 25,
  },
  automation: {
    description:
      "long self-play: scripted clicks until the Amulet perk is earned, then " +
      "the game's own (pre-fork) automation queue plays itself; auto-use " +
      "items on; prestiges whenever the Prestige task makes it available",
    maxTicks: 600000,
    minTicks: 20000,
    minResets: 40,
    forceEndOnIdle: true,
    setup: (E) => {
      E.game.GAMESTATE.automation_skip_blocked = true; // panel setting, not a mod
    },
    policy: automationPolicy,
    boundary: (E) =>
      E.game.GAMESTATE.prestige_available ? "prestige" : "reset",
    // Divinity purchases: neither side's auto-buy exists/is-on (fork
    // auto_buy_cheapest is a mod, default off; upstream has none), so the
    // driver buys greedily-cheapest for BOTH engines at each run boundary.
    // Exercises prestige-upgrade effects (Energetic Memory, Mastery of Time's
    // skipFreeZones, See Beyond the Veil's hidden tasks, ...).
    postBoundary: buyCheapestLoop,
    stopWhen: (ctx) => ctx.resets + ctx.prestiges >= 200,
  },
  "forced-prestige": {
    description:
      "SYNTHETIC: scripted clicks, then doPrestige() forced at the 3rd run " +
      "boundary regardless of prestige_available (the sim does not gate it; " +
      "exercises the full prestige reset path deterministically)",
    maxTicks: 120000,
    minTicks: 500,
    minResets: 6,
    forceEndOnIdle: true,
    policy: clickPolicy,
    boundary: (E, ctx) => {
      const n = ctx.resets + ctx.prestiges;
      // Prestige at the 3rd and 6th boundaries (the 2nd one exercises
      // prestiging while divine_spark is already non-zero).
      if ((n === 2 && ctx.prestiges === 0) || (n === 5 && ctx.prestiges === 1))
        return "prestige";
      return "reset";
    },
    // Once prestiged, symmetrically open the first prestige layer (in real
    // play that happens on completing the zone-14 "Touch the Divine" task,
    // far beyond an unmodded non-instant budget) and greedy-buy Divinity
    // upgrades with the honestly-earned spark, so addPrestigeUnlock /
    // repeatable purchase effects are exercised on both engines.
    postBoundary: (E, ctx) => {
      if (ctx.prestiges === 0) return;
      const G = E.game.GAMESTATE;
      const layer0 = E.prestige.PrestigeLayer.TouchTheDivine;
      if (!G.prestige_layers_unlocked.includes(layer0)) {
        G.prestige_layers_unlocked.push(layer0);
      }
      buyCheapestLoop(E);
    },
    stopWhen: (ctx) => ctx.resets + ctx.prestiges >= 8,
  },
};

// MARK: Drive policies (common surface only: clickTask / toggleAutomation /
// setAutomationMode / plain GAMESTATE fields that exist in both builds)

// First enabled non-Travel task in array order, else the enabled Travel task.
// `enabled` is maintained by the sim in both builds and already encodes
// finished / boss-too-strong / missing-item / Travel-behind-Mandatory gating.
function clickPolicy(E) {
  const G = E.game.GAMESTATE;
  if (G.is_in_energy_reset || G.active_task) return;
  const Travel = E.zones.TaskType.Travel;
  let travel = null;
  for (const t of G.tasks) {
    if (!t.enabled) continue;
    if (t.task_definition.type === Travel) {
      travel = travel ?? t;
      continue;
    }
    E.sim.clickTask(t);
    return;
  }
  if (travel) E.sim.clickTask(travel);
}

// Until the Amulet is held: scripted clicks. Once held: enroll every task
// definition in the automation priority lists (guarded — toggleAutomation
// toggles) and keep AutomationMode.All engaged (doAnyReset switches it Off at
// every run boundary in both builds). Auto-use items each run.
function automationPolicy(E, ctx) {
  const G = E.game.GAMESTATE;
  if (G.is_in_energy_reset) return;
  if (!G.auto_use_items) G.auto_use_items = true;
  const amulet = E.perks.PerkType.Amulet;
  if (!E.sim.hasPerk(amulet)) {
    clickPolicy(E);
    return;
  }
  if (E.label === "fork" && ctx && ctx.amuletTick == null) {
    ctx.amuletTick = ctx.ticks;
  }
  for (const zone of E.zones.ZONES) {
    for (const def of zone.tasks) {
      const prios = G.automation_prios.get(def.zone_id);
      if (!prios || !prios.includes(def.id)) E.sim.toggleAutomation(def);
    }
  }
  if (G.automation_mode !== E.sim.AutomationMode.All) {
    E.sim.setAutomationEndZone(99);
    E.sim.setAutomationMode(E.sim.AutomationMode.All);
    if (E.label === "fork" && ctx && ctx.automationEngagedTick == null) {
      ctx.automationEngagedTick = ctx.ticks;
    }
  }
}

// Greedy cheapest-first Divinity buyer (unlock wins cost ties — unlocks are
// one-time and strictly better value). Uses only sim APIs exported by BOTH
// builds; layer-gated like the games' own UIs.
function buyCheapestLoop(E) {
  const G = E.game.GAMESTATE;
  const layerOpen = (l) => G.prestige_layers_unlocked.includes(l);
  for (;;) {
    let best = null;
    for (const u of E.prestige.PRESTIGE_UNLOCKABLES) {
      if (!layerOpen(u.layer) || E.sim.hasPrestigeUnlock(u.type)) continue;
      if (!best || u.cost < best.cost)
        best = { cost: u.cost, kind: "unlock", type: u.type };
    }
    for (const r of E.prestige.PRESTIGE_REPEATABLES) {
      if (!layerOpen(r.layer)) continue;
      const c = E.sim.calcPrestigeRepeatableCost(r.type);
      if (!best || c < best.cost)
        best = { cost: c, kind: "repeatable", type: r.type };
    }
    if (!best || best.cost > G.divine_spark) return;
    if (best.kind === "unlock") E.sim.addPrestigeUnlock(best.type);
    else E.sim.increasePrestigeRepeatableLevel(best.type);
  }
}

// ---------------------------------------------------------------------------
// MARK: State projection (the comparison contract)
// ---------------------------------------------------------------------------
// Explicit list of gameplay-observable Gamestate fields, all present in BOTH
// builds. Fork-only bookkeeping fields are intentionally NOT projected — they
// are enumerated and reported separately (reportForkOnlyFields), and if one
// ever influences a projected field with mods off, the per-tick equality
// check is what catches it.
const taskProj = (t) => ({
  id: t.task_definition.id,
  progress: t.progress,
  reps: t.reps,
  enabled: t.enabled,
  hasted: t.hasted,
  xp_boosted: t.xp_boosted,
  lightning: t.lightning,
});
const mapEntries = (m) =>
  [...m.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]);

function project(G) {
  return {
    // progression
    current_zone: G.current_zone,
    highest_zone: G.highest_zone,
    highest_zone_fully_completed: G.highest_zone_fully_completed,
    highest_zone_ever: G.highest_zone_ever,
    highest_zone_fully_completed_ever: G.highest_zone_fully_completed_ever,
    is_in_energy_reset: G.is_in_energy_reset,
    is_at_end_of_content: G.is_at_end_of_content,
    is_in_zone_skip: G.is_in_zone_skip,
    // energy / resets
    current_energy: G.current_energy,
    max_energy: G.max_energy,
    energy_reset_count: G.energy_reset_count,
    // tasks
    active_task: G.active_task ? taskProj(G.active_task) : null,
    tasks: G.tasks.map(taskProj),
    unlocked_tasks: [...G.unlocked_tasks],
    // skills
    skills: G.skills.map((s) => ({
      type: s.type,
      level: s.level,
      progress: s.progress,
      speed_modifier: s.speed_modifier,
    })),
    unlocked_skills: [...G.unlocked_skills],
    skills_at_start_of_reset: [...G.skills_at_start_of_reset],
    power_at_start_of_reset: G.power_at_start_of_reset,
    attunement_at_start_of_reset: G.attunement_at_start_of_reset,
    // perks / items
    perks: mapEntries(G.perks),
    items: mapEntries(G.items),
    used_items: mapEntries(G.used_items),
    items_found_this_energy_reset: [...G.items_found_this_energy_reset],
    undo_item: [...G.undo_item],
    queued_scrolls_of_haste: G.queued_scrolls_of_haste,
    queued_magic_rings: G.queued_magic_rings,
    queued_lightning: G.queued_lightning,
    // power / attunement
    power: G.power,
    has_unlocked_power: G.has_unlocked_power,
    attunement: G.attunement,
    // prestige
    prestige_available: G.prestige_available,
    prestige_count: G.prestige_count,
    highest_prestige_zone: G.highest_prestige_zone,
    unlocked_new_prestige_this_prestige: G.unlocked_new_prestige_this_prestige,
    divine_spark: G.divine_spark,
    prestige_unlocks: [...G.prestige_unlocks].sort((a, b) => a - b),
    prestige_repeatables: mapEntries(G.prestige_repeatables),
    prestige_layers_unlocked: [...G.prestige_layers_unlocked],
    // energy reset summary (common subset of EnergyResetInfo)
    energy_reset_info: {
      skill_gains: G.energy_reset_info.skill_gains.map((g) => [...g]),
      power_at_start: G.energy_reset_info.power_at_start,
      power_at_end: G.energy_reset_info.power_at_end,
      attunement_at_start: G.energy_reset_info.attunement_at_start,
      attunement_at_end: G.energy_reset_info.attunement_at_end,
      energetic_memory_gain: G.energy_reset_info.energetic_memory_gain,
    },
    // player toggles / automation (all pre-fork)
    repeat_tasks: G.repeat_tasks,
    auto_use_items: G.auto_use_items,
    manual_tooltips: G.manual_tooltips,
    automation_mode: G.automation_mode,
    automation_end: G.automation_end,
    automation_skip_blocked: G.automation_skip_blocked,
    automation_prios: mapEntries(G.automation_prios),
    // hints
    hint_prep_runs_done: G.hint_prep_runs_done,
    hint_non_prep_runs_done: G.hint_non_prep_runs_done,
    hint_has_gotten_prep_run_hint: G.hint_has_gotten_prep_run_hint,
    hint_has_gotten_boss_hint: G.hint_has_gotten_boss_hint,
  };
}

// MARK: Exact deep diff (===, with NaN==NaN so a shared NaN isn't a diff)
function deepDiff(a, b, pathStr, out, limit = 25) {
  if (out.length >= limit) return;
  if (a === b) return;
  if (typeof a === "number" && typeof b === "number" && isNaN(a) && isNaN(b))
    return;
  const aObj = a !== null && typeof a === "object";
  const bObj = b !== null && typeof b === "object";
  if (!aObj || !bObj) {
    out.push({ path: pathStr, fork: a, upstream: b });
    return;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    deepDiff(a[k], b[k], `${pathStr}.${k}`, out, limit);
    if (out.length >= limit) return;
  }
}

// ---------------------------------------------------------------------------
// MARK: Engine bootstrap
// ---------------------------------------------------------------------------
function extractForkBuild() {
  const sha = execSync("git rev-parse HEAD", {
    cwd: submoduleDir,
    encoding: "utf8",
  }).trim();
  const marker = path.join(forkExtractDir, ".sha");
  if (
    !fs.existsSync(path.join(forkExtractDir, "build", "simulation.js")) ||
    !fs.existsSync(marker) ||
    fs.readFileSync(marker, "utf8").trim() !== sha
  ) {
    fs.rmSync(forkExtractDir, { recursive: true, force: true });
    fs.mkdirSync(forkExtractDir, { recursive: true });
    execSync(`git archive ${sha} build | tar -x -C ${JSON.stringify(forkExtractDir)}`, {
      cwd: submoduleDir,
      shell: "/bin/bash",
    });
    fs.writeFileSync(marker, sha + "\n");
  }
  return sha;
}

async function loadEngine(label, buildDir) {
  // Stubs + load-bearing import order (game.js FIRST) live in the shared
  // headless env from the jta-stats prior art.
  const { loadJtaEnv } = await import(
    pathToFileURL(
      path.join(repoRoot, "frontend/modules/jtaBalance/headlessGameEnv.js")
    ).href
  );
  const env = await loadJtaEnv(
    (name) => pathToFileURL(path.join(buildDir, name)).href
  );
  const events = await import(
    pathToFileURL(path.join(buildDir, "events.js")).href
  );
  const eventName = (t) => events.EventType[t] ?? `#${t}`;
  return {
    label,
    ...env,
    events,
    // One sim tick; returns the render events it queued (translated to enum
    // NAMES per-build, so a fork-inserted enum member can never mask a
    // renumbering) and clears the queue (nothing drains it headlessly).
    tick() {
      this.sim.updateGamestate();
      const G = this.game.GAMESTATE;
      const evs = G.pending_render_events.map((e) => ({
        type: eventName(e.type),
        context: { ...e.context },
      }));
      G.pending_render_events.length = 0;
      return evs;
    },
  };
}

// MARK: Static data parity (task/zone/skill/prestige definitions)
function compareStaticData(fork, up) {
  const defProj = (d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    cost_multiplier: d.cost_multiplier,
    skills: [...d.skills],
    xp_mult: d.xp_mult,
    item: d.item,
    use_item: d.use_item,
    perk: d.perk,
    prestige_layer: d.prestige_layer,
    max_reps: d.max_reps,
    hidden_by_default: d.hidden_by_default,
    unlocks_task: d.unlocks_task,
    zone_id: d.zone_id,
  });
  const zonesProj = (z) =>
    z.ZONES.map((zone) => ({
      name: zone.name,
      tasks: zone.tasks.map(defProj),
    }));
  const prestigeProj = (p) => ({
    unlockables: p.PRESTIGE_UNLOCKABLES.map((u) => ({
      type: u.type,
      name: u.name,
      cost: u.cost,
      layer: u.layer,
    })),
    repeatables: p.PRESTIGE_REPEATABLES.map((r) => ({
      type: r.type,
      name: r.name,
      initial_cost: r.initial_cost,
      scaling_exponent: r.scaling_exponent,
      layer: r.layer,
    })),
  });
  const diffs = [];
  deepDiff(zonesProj(fork.zones), zonesProj(up.zones), "zones", diffs);
  deepDiff(
    prestigeProj(fork.prestige),
    prestigeProj(up.prestige),
    "prestige",
    diffs
  );
  deepDiff(fork.skills.SKILLS, up.skills.SKILLS, "skills.SKILLS", diffs);
  deepDiff(
    fork.perks.PerkType.Count,
    up.perks.PerkType.Count,
    "perks.PerkType.Count",
    diffs
  );
  deepDiff(
    fork.items.ItemType.Count,
    up.items.ItemType.Count,
    "items.ItemType.Count",
    diffs
  );
  // Fork-only fields on task definitions (e.g. the substrate `free` flag):
  // report, don't fail — parity requires their DEFAULTS to be inert, which
  // the per-tick comparison then proves.
  const forkOnlyDefFields = Object.keys(
    fork.zones.ZONES[0].tasks[0]
  ).filter((k) => !(k in up.zones.ZONES[0].tasks[0]));
  return { diffs, forkOnlyDefFields };
}

function reportForkOnlyFields(fork, up) {
  const fG = fork.game.GAMESTATE;
  const uG = up.game.GAMESTATE;
  const jsonSafe = (v) =>
    v instanceof Map
      ? { Map: [...v.entries()] }
      : typeof v === "object" && v !== null
        ? JSON.parse(
            JSON.stringify(v, (k, x) =>
              x instanceof Map ? { Map: [...x.entries()] } : x
            )
          )
        : v;
  return {
    forkOnly: Object.keys(fG)
      .filter((k) => !(k in uG))
      .map((k) => [k, jsonSafe(fG[k])]),
    upstreamOnly: Object.keys(uG).filter((k) => !(k in fG)),
    save_version: { fork: fG.save_version, upstream: uG.save_version },
  };
}

// ---------------------------------------------------------------------------
// MARK: Lockstep runner
// ---------------------------------------------------------------------------
function runScenario(name, fork, up, opts = {}) {
  const sc = SCENARIOS[name];
  const maxTicks = opts.maxTicks ?? sc.maxTicks;
  const engines = [fork, up];

  for (const E of engines) E.game.GAMESTATE.initialize();
  sc.setup?.(fork);
  sc.setup?.(up);

  const ctx = { ticks: 0, resets: 0, prestiges: 0 };
  const boundaries = []; // {tick, action, zone, energy_reset_count}
  let firstDivergence = null;
  let reconvergedAtTick = null;
  let divergentTicks = 0;
  const MAX_DIVERGENT_TICKS = 300;

  const compareNow = (phase) => {
    const pF = project(fork.game.GAMESTATE);
    const pU = project(up.game.GAMESTATE);
    const diffs = [];
    deepDiff(pF, pU, "", diffs);
    if (diffs.length === 0) {
      if (firstDivergence && reconvergedAtTick === null) {
        reconvergedAtTick = ctx.ticks;
      }
      return true;
    }
    if (!firstDivergence) {
      firstDivergence = {
        phase,
        tick: ctx.ticks,
        resets: ctx.resets,
        prestiges: ctx.prestiges,
        diffs: diffs.map((d) => ({
          path: d.path,
          fork: d.fork,
          upstream: d.upstream,
        })),
      };
      console.error(
        `\n[${name}] DIVERGENCE at tick ${ctx.ticks} (${phase}), ` +
          `resets=${ctx.resets} prestiges=${ctx.prestiges}:`
      );
      for (const d of diffs.slice(0, 10)) {
        console.error(
          `    ${d.path}: fork=${JSON.stringify(d.fork)} upstream=${JSON.stringify(d.upstream)}`
        );
      }
    }
    return false;
  };

  // Setup must already agree (catches init-order differences).
  compareNow("post-setup");

  // Idle forcing (both builds park forever when automation runs dry and no
  // task is active — no energy drain, no run end; the real game waits for a
  // click). Decided from the FORK's signature, applied to both; any asymmetry
  // shows up as a projection diff first.
  let idleTicks = 0;
  let lastSig = "";
  const sig = (G) =>
    `${G.current_zone}|${G.current_energy}|${G.tasks.reduce((a, t) => a + t.reps, 0)}|${G.active_task ? 1 : 0}`;

  while (ctx.ticks < maxTicks) {
    const evF = fork.tick();
    const evU = up.tick();
    ctx.ticks++;

    // Comparator canary (--selftest-perturb N): nudge ONE engine and demand
    // the harness catches it — guards against ever passing vacuously.
    if (opts.perturbAtTick === ctx.ticks) {
      fork.game.GAMESTATE.current_energy += 1e-9;
      console.log(
        `[${name}] SELFTEST: perturbed fork current_energy at tick ${ctx.ticks}`
      );
    }

    let equal = compareNow("post-tick");
    if (equal) {
      const evDiffs = [];
      deepDiff(evF, evU, "renderEvents", evDiffs);
      if (evDiffs.length) {
        equal = false;
        if (!firstDivergence) {
          firstDivergence = {
            phase: "render-events",
            tick: ctx.ticks,
            resets: ctx.resets,
            prestiges: ctx.prestiges,
            diffs: evDiffs,
          };
          console.error(
            `\n[${name}] RENDER-EVENT divergence at tick ${ctx.ticks}: ` +
              JSON.stringify(evDiffs.slice(0, 5))
          );
        }
      }
    }
    if (firstDivergence) {
      divergentTicks++;
      if (reconvergedAtTick !== null || divergentTicks > MAX_DIVERGENT_TICKS)
        break;
    }

    const G = fork.game.GAMESTATE;
    if (!G.is_in_energy_reset && sc.forceEndOnIdle) {
      const s = sig(G);
      if (s === lastSig) {
        if (++idleTicks >= 50) {
          for (const E of engines) E.game.GAMESTATE.is_in_energy_reset = true;
          idleTicks = 0;
          lastSig = "";
        }
      } else {
        idleTicks = 0;
        lastSig = s;
      }
    }

    if (fork.game.GAMESTATE.is_in_energy_reset) {
      const action = sc.boundary?.(fork, ctx) ?? "reset";
      if (action === "stop") break;
      boundaries.push({
        tick: ctx.ticks,
        action,
        endZone: fork.game.GAMESTATE.current_zone,
        highestZone: fork.game.GAMESTATE.highest_zone,
        divineSparkGain:
          action === "prestige" ? fork.sim.calcDivineSparkGain() : null,
      });
      for (const E of engines) {
        if (action === "prestige") E.sim.doPrestige();
        else E.sim.doEnergyReset();
      }
      if (action === "prestige") ctx.prestiges++;
      else ctx.resets++;
      if (sc.postBoundary) {
        sc.postBoundary(fork, ctx);
        sc.postBoundary(up, ctx);
      }
      idleTicks = 0;
      lastSig = "";
      compareNow("post-boundary");
      if (firstDivergence && reconvergedAtTick === null) break;
    } else if (sc.policy) {
      sc.policy(fork, ctx);
      sc.policy(up, ctx);
      compareNow("post-policy");
      if (firstDivergence && reconvergedAtTick === null && divergentTicks > MAX_DIVERGENT_TICKS)
        break;
    }

    if (sc.stopWhen?.(ctx)) break;
    if (ctx.ticks % 50000 === 0) {
      console.log(
        `[${name}] tick ${ctx.ticks}: zone ${fork.game.GAMESTATE.current_zone}, ` +
          `resets ${ctx.resets}, prestiges ${ctx.prestiges}, ` +
          `highest zone ${fork.game.GAMESTATE.highest_zone}`
      );
    }
  }

  const fG = fork.game.GAMESTATE;
  const vacuous =
    ctx.ticks < (opts.maxTicks ? 0 : sc.minTicks) ||
    ctx.resets + ctx.prestiges < (opts.maxTicks ? 0 : sc.minResets);
  return {
    scenario: name,
    description: sc.description,
    ticks: ctx.ticks,
    resets: ctx.resets,
    prestiges: ctx.prestiges,
    amuletTick: ctx.amuletTick ?? null,
    automationEngagedTick: ctx.automationEngagedTick ?? null,
    boundaries,
    finalState: {
      current_zone: fG.current_zone,
      highest_zone: fG.highest_zone,
      highest_zone_ever: fG.highest_zone_ever,
      energy_reset_count: fG.energy_reset_count,
      prestige_count: fG.prestige_count,
      divine_spark: fG.divine_spark,
      perksHeld: [...fG.perks.entries()].filter(([, v]) => v).length,
      skillLevels: fG.skills.map((s) => s.level),
    },
    minTicks: sc.minTicks,
    minResets: sc.minResets,
    vacuous,
    firstDivergence,
    reconvergedAtTick,
    pass: !firstDivergence && !vacuous,
  };
}

// ---------------------------------------------------------------------------
// MARK: Entry points
// ---------------------------------------------------------------------------
async function childMain(scenarioName, maxTicksOverride, perturbAtTick) {
  // No wall-clock game loop, ever: both builds call setTickRate()/setInterval
  // during play (zone advance, prestige unlocks). The run loop below is fully
  // synchronous, so timers could only fire between scenarios — neuter them
  // anyway so an interval can never tick an engine outside the lockstep.
  globalThis.setInterval = () => 1;
  globalThis.clearInterval = () => {};

  // Known, documented noise: upstream's initialize() runs resetTasks() before
  // initializeSkills(), so every getSkill() during the first resetTasks logs
  // "Couldn't find skill" (~32 lines per init; the fork reordered init to fix
  // exactly this — observable state still matches, which the post-setup
  // comparison proves). Count instead of printing.
  let skillSpam = 0;
  for (const ch of ["log", "error", "warn"]) {
    const orig = console[ch].bind(console);
    console[ch] = (...a) => {
      if (typeof a[0] === "string" && a[0].includes("Couldn't find skill")) {
        skillSpam++;
        return;
      }
      orig(...a);
    };
  }

  const forkSha = extractForkBuild();
  const fork = await loadEngine("fork", path.join(forkExtractDir, "build"));
  const up = await loadEngine("upstream", upstreamBuildDir);

  const staticCmp = compareStaticData(fork, up);
  const modsSnapshot =
    typeof fork.sim.getMods === "function" ? fork.sim.getMods() : null;

  const result = runScenario(scenarioName, fork, up, {
    maxTicks: maxTicksOverride,
    perturbAtTick,
  });
  // End-of-scenario snapshot: shows whether any fork-only bookkeeping field
  // accumulated anything during unmodded play (report, not a failure).
  const fieldReport = reportForkOnlyFields(fork, up);
  result.forkCommit = forkSha;
  result.staticData = {
    equal: staticCmp.diffs.length === 0,
    diffs: staticCmp.diffs,
    forkOnlyTaskDefFields: staticCmp.forkOnlyDefFields,
  };
  result.gamestateFields = fieldReport;
  result.forkModDefaults = modsSnapshot;
  result.suppressedUpstreamSkillSpam = skillSpam;

  fs.mkdirSync(resultsDir, { recursive: true });
  const outPath = path.join(resultsDir, `${scenarioName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(
    `[${scenarioName}] ${result.pass ? "PASS" : result.firstDivergence ? "DIVERGED" : "VACUOUS"}: ` +
      `${result.ticks} ticks, ${result.resets} resets, ${result.prestiges} prestiges, ` +
      `final zone ${result.finalState.current_zone} (highest ever ${result.finalState.highest_zone_ever})`
  );
  // setTickRate may have "started" our stub interval; exit explicitly like
  // run-node.mjs does so nothing keeps the process alive.
  process.exit(result.pass ? 0 : 1);
}

function parentMain(only) {
  const names = only ?? Object.keys(SCENARIOS);
  const summary = [];
  for (const name of names) {
    console.log(`\n=== scenario: ${name} ===`);
    const r = spawnSync(
      process.execPath,
      [fileURLToPath(import.meta.url), "--scenario", name],
      { stdio: "inherit" }
    );
    let detail = null;
    const f = path.join(resultsDir, `${name}.json`);
    if (fs.existsSync(f)) detail = JSON.parse(fs.readFileSync(f, "utf8"));
    summary.push({
      scenario: name,
      exitCode: r.status,
      pass: detail?.pass ?? false,
      ticks: detail?.ticks,
      resets: detail?.resets,
      prestiges: detail?.prestiges,
      vacuous: detail?.vacuous,
      firstDivergence: detail?.firstDivergence
        ? {
            tick: detail.firstDivergence.tick,
            phase: detail.firstDivergence.phase,
            firstDiffs: detail.firstDivergence.diffs.slice(0, 5),
          }
        : null,
    });
  }
  const allPass = summary.every((s) => s.pass);
  const report = {
    verdict: allPass ? "PASS" : "FAIL",
    generatedAt: new Date().toISOString(),
    forkCommit: (() => {
      try {
        return execSync("git rev-parse HEAD", {
          cwd: submoduleDir,
          encoding: "utf8",
        }).trim();
      } catch {
        return null;
      }
    })(),
    upstreamCommit: (() => {
      try {
        return execSync("git rev-parse HEAD", {
          cwd: path.join(here, "upstream"),
          encoding: "utf8",
        }).trim();
      } catch {
        return null;
      }
    })(),
    scenarios: summary,
  };
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(
    path.join(resultsDir, "parity-report.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(`\n================= PARITY ${report.verdict} =================`);
  for (const s of summary) {
    console.log(
      `  ${s.pass ? "PASS" : "FAIL"} ${s.scenario}: ticks=${s.ticks} resets=${s.resets} ` +
        `prestiges=${s.prestiges}${s.vacuous ? " [VACUOUS: below minimum activity]" : ""}` +
        (s.firstDivergence
          ? ` [first divergence @ tick ${s.firstDivergence.tick} (${s.firstDivergence.phase})]`
          : "")
    );
  }
  console.log(`  report: ${path.join(resultsDir, "parity-report.json")}`);
  process.exit(allPass ? 0 : 1);
}

const args = process.argv.slice(2);
if (args.includes("--list")) {
  for (const [k, v] of Object.entries(SCENARIOS))
    console.log(`${k}: ${v.description}`);
  process.exit(0);
}
const scIdx = args.indexOf("--scenario");
const mtIdx = args.indexOf("--max-ticks");
const ptIdx = args.indexOf("--selftest-perturb");
const maxTicksOverride = mtIdx >= 0 ? Number(args[mtIdx + 1]) : undefined;
const perturbAtTick = ptIdx >= 0 ? Number(args[ptIdx + 1]) : undefined;
if (scIdx >= 0) {
  // Single scenario runs in THIS process (it is already fresh).
  await childMain(args[scIdx + 1], maxTicksOverride, perturbAtTick);
} else {
  parentMain(null);
}
