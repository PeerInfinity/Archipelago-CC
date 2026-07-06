// Vanilla JtA data profiler — Phase 0 of the zone-randomization plan
// (CC/docs/plans/jta-zone-randomization-plan.md).
//
// Collects, from the committed build's vanilla data:
//   1. STATIC structural profile — tasks/zones/skills/perks as data (the
//      target shape for synthetic generation).
//   2. DYNAMIC pacing profile — a full tuned-defaults playthrough per
//      variant (standalone energy growth vs pinMaxEnergy=100 substrate
//      emulation): first-completion runs, reset gaps between consecutive
//      first-completions, perk/unlock milestone spacing, skill trajectories.
//   3. ESTIMATOR CALIBRATION — estimateResetsToComplete sampled at run
//      boundaries vs the actual resets until first completion (the
//      systematic dedicated-grind-vs-real-automation correction factor the
//      balancing pass needs).
//
// Each variant runs in a fresh child process (the experiments.mjs pattern —
// module-level sim state never crosses runs); the parent analyzes and writes
//   results/vanilla-profile.json      (aggregated profile, committed)
//   results/vanilla-profile-raw-<variant>.json  (full samples, committed)
//   results/VANILLA-PROFILE.md        (human-readable summary)
//
// Usage: node CC/scripts/jta-stats/profile-vanilla.mjs
//          [--max-runs N=2000] [--zone-limit N=30] [--sample-every N=5]
//          [--variant standalone|pinned100]   (internal child mode)

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(here, "results");

const args = process.argv.slice(2);
const getArg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const MAX_RUNS = Number(getArg("--max-runs", 2000));
const ZONE_LIMIT = Number(getArg("--zone-limit", 30));
const SAMPLE_EVERY = Number(getArg("--sample-every", 5));
const ESTIMATOR_CAP = 200;

const VARIANTS = {
  standalone: { pinMaxEnergy: null },
  pinned100: { pinMaxEnergy: 100 },
};

const rawPath = (variant) =>
  path.join(resultsDir, `vanilla-profile-raw-${variant}.json`);

// MARK: static profile ------------------------------------------------------

function buildStaticProfile(env) {
  const { zones, perks, items, skills } = env;
  const typeName = (t) => zones.TaskType[t];
  const perkName = (p) =>
    p != null && p !== perks.PerkType.Count
      ? (perks.PERKS.find((d) => d.enum === p)?.name ?? `perk#${p}`)
      : null;
  const itemName = (it) =>
    it != null && it !== items.ItemType.Count
      ? (items.ITEMS.find((d) => d.enum === it)?.name ?? `item#${it}`)
      : null;
  const skillName = (s) => skills.SKILL_DEFINITIONS[s]?.name ?? `skill#${s}`;

  const tasks = [];
  const zoneSummaries = [];
  const skillFirstZone = new Map();
  const skillTaskCounts = new Map();
  const skillsPerTaskHist = {};
  const unlockChains = [];
  const dist = (values) => {
    if (values.length === 0) return null;
    const v = [...values].sort((a, b) => a - b);
    return {
      min: v[0],
      median: v[Math.floor(v.length / 2)],
      max: v[v.length - 1],
    };
  };

  zones.ZONES.slice(0, ZONE_LIMIT).forEach((zone, zi) => {
    const types = {};
    const costMults = [];
    const xpMults = [];
    const maxRepsAll = [];
    let perkTasks = 0;
    let itemTasks = 0;
    let hiddenTasks = 0;
    for (const def of zone.tasks) {
      const skillNames = def.skills.map(skillName);
      tasks.push({
        id: def.id,
        zone: zi,
        name: def.name,
        type: typeName(def.type),
        costMult: def.cost_multiplier,
        xpMult: def.xp_mult,
        maxReps: def.max_reps,
        skills: skillNames,
        perk: perkName(def.perk),
        item: itemName(def.item),
        useItem: itemName(def.use_item),
        unlocksTask: def.unlocks_task >= 0 ? def.unlocks_task : null,
        hidden: def.hidden_by_default,
        free: def.free,
      });
      types[typeName(def.type)] = (types[typeName(def.type)] ?? 0) + 1;
      costMults.push(def.cost_multiplier);
      xpMults.push(def.xp_mult);
      maxRepsAll.push(def.max_reps);
      if (perkName(def.perk)) perkTasks++;
      if (itemName(def.item)) itemTasks++;
      if (def.hidden_by_default) hiddenTasks++;
      for (const s of def.skills) {
        if (!skillFirstZone.has(s)) skillFirstZone.set(s, zi);
        skillTaskCounts.set(s, (skillTaskCounts.get(s) ?? 0) + 1);
      }
      const n = def.skills.length;
      skillsPerTaskHist[n] = (skillsPerTaskHist[n] ?? 0) + 1;
      if (def.unlocks_task >= 0) {
        unlockChains.push({ from: def.id, fromZone: zi, to: def.unlocks_task });
      }
    }
    zoneSummaries.push({
      zone: zi,
      name: zone.name,
      taskCount: zone.tasks.length,
      types,
      perkTasks,
      itemTasks,
      hiddenTasks,
      costMult: dist(costMults),
      xpMult: dist(xpMults),
      maxReps: dist(maxRepsAll),
    });
  });

  // Resolve unlock-chain targets' zones from the flat table.
  const zoneById = new Map(tasks.map((t) => [t.id, t.zone]));
  for (const c of unlockChains) c.toZone = zoneById.get(c.to) ?? null;

  return {
    zoneCount: Math.min(ZONE_LIMIT, zones.ZONES.length),
    taskCount: tasks.length,
    perkTaskCount: tasks.filter((t) => t.perk).length,
    hiddenTaskCount: tasks.filter((t) => t.hidden).length,
    skillsPerTaskHist,
    skills: skills.SKILL_DEFINITIONS.map((d, i) => ({
      index: i,
      name: d.name,
      xpNeededMult: d.xp_needed_mult ?? 1,
      firstZone: skillFirstZone.get(i) ?? null,
      taskCount: skillTaskCounts.get(i) ?? 0,
    })).filter((s) => s.name !== "REMOVED"),
    zones: zoneSummaries,
    unlockChains,
    tasks,
  };
}

// MARK: child mode — run one variant -----------------------------------------

async function runChildVariant(variantName) {
  const { loadJtaEnv } = await import(
    pathToFileURL(path.join(here, "node-env.mjs"))
  );
  const env = await loadJtaEnv();
  const driver = await import(pathToFileURL(path.join(here, "driver.mjs")));
  const { game, sim, zones } = env;

  const universeDefs = new Map();
  zones.ZONES.slice(0, ZONE_LIMIT).forEach((z) =>
    z.tasks.forEach((d) => universeDefs.set(d.id, d))
  );

  const boundaries = [];
  const estimatorSamples = []; // [taskId, run, estimate]
  const onRunBoundary = ({ run, completions }) => {
    const G = game.GAMESTATE;
    const highestZone = Math.max(G.highest_zone, G.highest_prestige_zone ?? 0);
    boundaries.push({
      run,
      maxEnergy: G.max_energy,
      currentZone: G.current_zone,
      highestZone,
      prestiges: G.prestige_count,
      spark: G.divine_spark,
      skills: Array.from(G.skills, (s) => s?.level ?? 0),
    });
    if (run !== 1 && run % SAMPLE_EVERY !== 0) return;
    // Estimator semantics: dedicated grind on this task with decision-time
    // energy as every simulated run's budget. Sample only tasks the player
    // could plausibly work on soon (up to one zone past the frontier);
    // hidden tasks only once unlocked (the estimator can't see gating).
    for (const def of universeDefs.values()) {
      if (completions.has(def.id)) continue;
      if (def.zone_id > highestZone + 1) continue;
      if (def.hidden_by_default && !G.unlocked_tasks.includes(def.id)) continue;
      const est = sim.estimateResetsToComplete(
        new zones.Task(def),
        ESTIMATOR_CAP
      );
      estimatorSamples.push([def.id, run, est]);
    }
  };

  const result = driver.runFirstCompletionStats(env, {
    zoneLimit: ZONE_LIMIT,
    maxRuns: MAX_RUNS,
    pinMaxEnergy: VARIANTS[variantName].pinMaxEnergy,
    logEvery: 100,
    onRunBoundary,
  });

  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(
    rawPath(variantName),
    JSON.stringify({ variant: variantName, result, boundaries, estimatorSamples })
  );
  console.log(
    `[profile:${variantName}] ${result.completedCount}/${result.taskCount} tasks in ` +
      `${result.timing.runsExecuted} runs, ${estimatorSamples.length} estimator samples`
  );
  process.exit(0);
}

// MARK: analysis --------------------------------------------------------------

function quantiles(values) {
  if (values.length === 0) return null;
  const r = (x) => Math.round(x * 100) / 100;
  const v = [...values].sort((a, b) => a - b);
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return {
    n: v.length,
    mean: r(v.reduce((a, b) => a + b, 0) / v.length),
    p50: r(q(0.5)),
    p90: r(q(0.9)),
    max: r(v[v.length - 1]),
  };
}

function analyzeVariant(raw, staticProfile) {
  const { result, boundaries, estimatorSamples } = raw;
  const taskById = new Map(staticProfile.tasks.map((t) => [t.id, t]));
  const completionById = new Map(result.completions.map((c) => [c.id, c]));

  // --- Pacing: reset gaps between consecutive first-completions -------------
  const ordered = [...result.completions].sort(
    (a, b) => a.run - b.run || a.zone - b.zone || a.id - b.id
  );
  let prevRun = null;
  const gaps = [];
  for (const c of ordered) {
    const st = taskById.get(c.id);
    gaps.push({
      id: c.id,
      run: c.run,
      zone: c.zone,
      gap: prevRun == null ? c.run - 1 : c.run - prevRun,
      isPerk: !!st?.perk,
      isUnlockEvent: !!st?.perk || st?.unlocksTask != null,
      viaZoneSkip: !!c.viaZoneSkip,
    });
    prevRun = c.run;
  }
  const gapHistogram = {};
  for (const g of gaps) gapHistogram[g.gap] = (gapHistogram[g.gap] ?? 0) + 1;

  // Milestone pacing: gaps between consecutive PERK-task completions (the
  // closest vanilla analog of the plan's resetsPerStep), and between
  // consecutive unlock events (perk grants + task-unlocker completions).
  const milestoneGaps = (filter) => {
    let prev = null;
    const out = [];
    for (const c of ordered) {
      const st = taskById.get(c.id);
      if (!filter(st)) continue;
      out.push(prev == null ? c.run - 1 : c.run - prev);
      prev = c.run;
    }
    return out;
  };
  const perkGaps = milestoneGaps((st) => !!st?.perk);
  const unlockEventGaps = milestoneGaps(
    (st) => !!st?.perk || st?.unlocksTask != null
  );

  // --- Per-zone completion timeline -----------------------------------------
  const perZone = [];
  for (const z of staticProfile.zones) {
    const cs = ordered.filter((c) => c.zone === z.zone);
    const runs = cs.map((c) => c.run);
    perZone.push({
      zone: z.zone,
      name: z.name,
      taskCount: z.taskCount,
      completed: cs.length,
      firstRun: runs.length ? Math.min(...runs) : null,
      lastRun: runs.length ? Math.max(...runs) : null,
    });
  }

  // --- Perk acquisition timeline ---------------------------------------------
  const perkTimeline = ordered
    .filter((c) => taskById.get(c.id)?.perk)
    .map((c) => ({
      perk: taskById.get(c.id).perk,
      task: taskById.get(c.id).name,
      zone: c.zone,
      run: c.run,
    }));

  // --- Estimator calibration ---------------------------------------------------
  // Each sample: estimate e at run t for a task first completed at run c
  // → actual remaining resets = c - t. Bucket by estimate.
  const buckets = [
    { key: "0", lo: 0, hi: 0 },
    { key: "1", lo: 1, hi: 1 },
    { key: "2", lo: 2, hi: 2 },
    { key: "3-5", lo: 3, hi: 5 },
    { key: "6-10", lo: 6, hi: 10 },
    { key: "11-20", lo: 11, hi: 20 },
    { key: "21-50", lo: 21, hi: 50 },
    { key: "51-200", lo: 51, hi: ESTIMATOR_CAP },
    { key: `>cap(${ESTIMATOR_CAP})`, lo: ESTIMATOR_CAP + 1, hi: Infinity },
  ];
  const calib = buckets.map((b) => ({ ...b, actuals: [], ratios: [] }));
  let uncompletedSamples = 0;
  for (const [id, t, est] of estimatorSamples) {
    const c = completionById.get(id);
    if (!c) {
      uncompletedSamples++;
      continue;
    }
    const actual = c.run - t;
    if (actual < 0) continue; // completed the same run it was sampled, mid-run
    const b = calib.find((bk) => est >= bk.lo && est <= bk.hi);
    if (!b) continue;
    b.actuals.push(actual);
    if (est >= 1 && est <= ESTIMATOR_CAP) b.ratios.push(actual / est);
  }
  const calibration = calib.map((b) => ({
    estimate: b.key,
    actualResets: quantiles(b.actuals),
    actualOverEstimate: b.ratios.length ? quantiles(b.ratios) : null,
  }));

  // --- Skill trajectories --------------------------------------------------------
  const skillNames = staticProfile.skills.map((s) => s.name);
  const skillIdx = staticProfile.skills.map((s) => s.index);
  const milestoneLevels = [5, 10, 25, 50, 100, 200];
  const skillMilestones = staticProfile.skills.map((s) => ({
    skill: s.name,
    runAtLevel: {},
  }));
  for (const b of boundaries) {
    skillIdx.forEach((idx, i) => {
      const lvl = b.skills[idx] ?? 0;
      for (const m of milestoneLevels) {
        if (lvl >= m && skillMilestones[i].runAtLevel[m] === undefined) {
          skillMilestones[i].runAtLevel[m] = b.run;
        }
      }
    });
  }
  const trajectorySample = boundaries
    .filter((b, i) => b.run % 25 === 0 || i === boundaries.length - 1)
    .map((b) => ({
      run: b.run,
      maxEnergy: b.maxEnergy,
      highestZone: b.highestZone,
      prestiges: b.prestiges,
      skills: Object.fromEntries(
        skillIdx.map((idx, i) => [skillNames[i], b.skills[idx] ?? 0])
      ),
    }));

  const prestigeRuns = result.runEnds.filter((r) => r.prestiged).map((r) => r.run);

  return {
    options: result.options,
    stalled: result.stalled,
    completed: result.completedCount,
    taskCount: result.taskCount,
    allCompleted: result.allCompleted,
    runsExecuted: result.timing.runsExecuted,
    lastCompletionRun: ordered.length ? ordered[ordered.length - 1].run : null,
    unreached: result.unreached.map((t) => ({
      id: t.id,
      zone: t.zone,
      name: t.name,
    })),
    prestigeRuns,
    pacing: {
      allGaps: quantiles(gaps.map((g) => g.gap)),
      gapHistogram,
      perkGaps: quantiles(perkGaps),
      perkGapValues: perkGaps,
      unlockEventGaps: quantiles(unlockEventGaps),
      viaZoneSkipCount: gaps.filter((g) => g.viaZoneSkip).length,
    },
    perZone,
    perkTimeline,
    calibration: {
      sampleCount: estimatorSamples.length,
      uncompletedSamples,
      buckets: calibration,
    },
    skillMilestones,
    trajectorySample,
  };
}

// MARK: report ------------------------------------------------------------------

function fmtQ(q) {
  if (!q) return "—";
  return `n=${q.n} mean=${q.mean} p50=${q.p50} p90=${q.p90} max=${q.max}`;
}

function buildReport(profile) {
  const s = profile.static;
  const lines = [];
  lines.push(`# Vanilla JtA Profile (Phase 0)`);
  lines.push(``);
  lines.push(
    `Generated ${profile.generatedAt} by \`profile-vanilla.mjs\` ` +
      `(maxRuns ${profile.options.maxRuns}, zoneLimit ${profile.options.zoneLimit}, ` +
      `sampleEvery ${profile.options.sampleEvery}, estimatorCap ${ESTIMATOR_CAP}). ` +
      `Target profile + calibration inputs for the zone-randomization plan ` +
      `(\`CC/docs/plans/jta-zone-randomization-plan.md\`).`
  );
  lines.push(``);
  lines.push(`## Structural profile (static)`);
  lines.push(``);
  lines.push(
    `- ${s.zoneCount} zones, ${s.taskCount} tasks, ${s.perkTaskCount} perk tasks, ` +
      `${s.hiddenTaskCount} hidden tasks, ${s.unlockChains.length} unlock chains.`
  );
  lines.push(
    `- Skills per task histogram: ${JSON.stringify(s.skillsPerTaskHist)}`
  );
  lines.push(``);
  lines.push(`| Skill | first zone | tasks using it | xpNeededMult |`);
  lines.push(`|---|---|---|---|`);
  for (const sk of s.skills) {
    lines.push(
      `| ${sk.name} | ${sk.firstZone ?? "—"} | ${sk.taskCount} | ${sk.xpNeededMult} |`
    );
  }
  lines.push(``);
  lines.push(
    `| Zone | tasks | perk | hidden | costMult (min/med/max) | maxReps (med) |`
  );
  lines.push(`|---|---|---|---|---|---|`);
  for (const z of s.zones) {
    lines.push(
      `| ${z.zone} ${z.name} | ${z.taskCount} | ${z.perkTasks} | ${z.hiddenTasks} | ` +
        `${z.costMult.min}/${z.costMult.median}/${z.costMult.max} | ${z.maxReps.median} |`
    );
  }

  for (const [name, v] of Object.entries(profile.variants)) {
    lines.push(``);
    lines.push(`## Variant: ${name}`);
    lines.push(``);
    lines.push(
      `- ${v.completed}/${v.taskCount} tasks completed in ${v.runsExecuted} runs` +
        (v.allCompleted
          ? ` (all done by run ${v.lastCompletionRun})`
          : ` — ${v.unreached.length} unreached${v.stalled ? ", STALLED" : ""}`) +
        `; prestiges at runs [${v.prestigeRuns.join(", ")}]`
    );
    lines.push(
      `- Reset gaps between consecutive first-completions: ${fmtQ(v.pacing.allGaps)}`
    );
    lines.push(`- Perk-milestone gaps: ${fmtQ(v.pacing.perkGaps)}`);
    lines.push(`  - values: [${v.pacing.perkGapValues.join(", ")}]`);
    lines.push(
      `- Unlock-event gaps (perk or task-unlocker): ${fmtQ(v.pacing.unlockEventGaps)}`
    );
    lines.push(
      `- ${v.pacing.viaZoneSkipCount} completions arrived via Mastery-of-Time zone skip.`
    );
    if (v.unreached.length > 0 && v.unreached.length <= 30) {
      lines.push(
        `- Unreached: ${v.unreached.map((t) => `${t.name} (z${t.zone})`).join("; ")}`
      );
    }
    lines.push(``);
    lines.push(`### Estimator calibration (estimate → actual resets to completion)`);
    lines.push(``);
    lines.push(`| estimate | actual resets | actual/estimate |`);
    lines.push(`|---|---|---|`);
    for (const b of v.calibration.buckets) {
      if (!b.actualResets) continue;
      lines.push(
        `| ${b.estimate} | ${fmtQ(b.actualResets)} | ${fmtQ(b.actualOverEstimate)} |`
      );
    }
    lines.push(
      `- ${v.calibration.sampleCount} samples, ${v.calibration.uncompletedSamples} on never-completed tasks.`
    );
    lines.push(``);
    lines.push(`### Skill milestones (run at which level reached)`);
    lines.push(``);
    lines.push(`| Skill | L5 | L10 | L25 | L50 | L100 | L200 |`);
    lines.push(`|---|---|---|---|---|---|---|`);
    for (const m of v.skillMilestones) {
      const r = m.runAtLevel;
      lines.push(
        `| ${m.skill} | ${r[5] ?? "—"} | ${r[10] ?? "—"} | ${r[25] ?? "—"} | ` +
          `${r[50] ?? "—"} | ${r[100] ?? "—"} | ${r[200] ?? "—"} |`
      );
    }
    lines.push(``);
    lines.push(`### Zone completion timeline`);
    lines.push(``);
    lines.push(`| Zone | completed | first run | last run |`);
    lines.push(`|---|---|---|---|`);
    for (const z of v.perZone) {
      lines.push(
        `| ${z.zone} ${z.name} | ${z.completed}/${z.taskCount} | ${z.firstRun ?? "—"} | ${z.lastRun ?? "—"} |`
      );
    }
  }
  lines.push(``);
  return lines.join("\n");
}

// MARK: main --------------------------------------------------------------------

const childVariant = getArg("--variant");
if (childVariant) {
  if (!VARIANTS[childVariant]) throw new Error(`unknown variant ${childVariant}`);
  await runChildVariant(childVariant);
} else {
  // Parent: static profile + one child process per variant, then analyze.
  const { loadJtaEnv } = await import(
    pathToFileURL(path.join(here, "node-env.mjs"))
  );
  const env = await loadJtaEnv();
  const staticProfile = buildStaticProfile(env);
  console.log(
    `[profile] static: ${staticProfile.taskCount} tasks / ${staticProfile.zoneCount} zones / ` +
      `${staticProfile.perkTaskCount} perk tasks`
  );

  const variants = {};
  for (const name of Object.keys(VARIANTS)) {
    console.log(`[profile] running variant ${name} (fresh process)...`);
    execFileSync(
      process.execPath,
      [
        fileURLToPath(import.meta.url),
        "--variant",
        name,
        "--max-runs",
        String(MAX_RUNS),
        "--zone-limit",
        String(ZONE_LIMIT),
        "--sample-every",
        String(SAMPLE_EVERY),
      ],
      { stdio: "inherit" }
    );
    const raw = JSON.parse(fs.readFileSync(rawPath(name), "utf8"));
    variants[name] = analyzeVariant(raw, staticProfile);
  }

  const profile = {
    generatedAt: new Date().toISOString(),
    options: { maxRuns: MAX_RUNS, zoneLimit: ZONE_LIMIT, sampleEvery: SAMPLE_EVERY },
    static: staticProfile,
    variants,
  };
  fs.mkdirSync(resultsDir, { recursive: true });
  const outJson = path.join(resultsDir, "vanilla-profile.json");
  fs.writeFileSync(outJson, JSON.stringify(profile, null, 2));
  const outMd = path.join(resultsDir, "VANILLA-PROFILE.md");
  fs.writeFileSync(outMd, buildReport(profile));
  console.log(`[profile] wrote ${outJson}`);
  console.log(`[profile] wrote ${outMd}`);
  process.exit(0);
}
