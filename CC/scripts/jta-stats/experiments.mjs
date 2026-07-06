// Experiment sweep: run the stats driver across a set of automation-setting
// variants (each in a fresh Node process so module-local sim state can't
// leak between configs), then emit a comparison report.
//
// Usage: node CC/scripts/jta-stats/experiments.mjs [--only name1,name2]
//        [--max-runs N] [--legacy] [--report FILE.md]
//
// Each experiment writes results/<name>-node.json + its config to
// configs/<name>.json so runs stay comparable and re-runnable:
//   node CC/scripts/jta-stats/run-node.mjs --config CC/scripts/jta-stats/configs/<name>.json
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const configsDir = path.join(here, "configs");
const resultsDir = path.join(here, "results");

// LEGACY (spark-on era, Rounds 1-4 + defaults tuning, 2026-07-05): these all
// ran while award_spark_on_discovery was still part of baselineMods(). The
// baseline flipped to spark-off on 2026-07-06 (the game's own default is
// false, and Round 5 showed discovery spark distorts everything past ~z15),
// so re-running these entries injects award_spark_on_discovery: true to
// reproduce the historical numbers. Skipped by default; include with
// --legacy or name them via --only.
//
// threshold_all_skipped = 0 (Idle) is deliberately absent: with no task
// there is no energy drain, so an all-skipped run idles forever — it stalls
// the harness and does nothing useful in real play either.
const LEGACY_EXPERIMENTS = [
  { name: "baseline", modOverrides: {} },

  // Auto-prestige stall count (baseline: 20)
  { name: "stall-5", modOverrides: { auto_prestige_stall_resets: 5 } },
  { name: "stall-10", modOverrides: { auto_prestige_stall_resets: 10 } },
  { name: "stall-40", modOverrides: { auto_prestige_stall_resets: 40 } },

  // When-All-Skipped (baseline: 2 = Best Task)
  { name: "all-skipped-end-run", modOverrides: { threshold_all_skipped: 1 } },

  // Item automation helpers (baseline: both on)
  { name: "no-ring", modOverrides: { auto_ring: false } },
  { name: "no-dreamcatcher", modOverrides: { auto_dreamcatcher: false } },
  {
    name: "no-ring-no-dc",
    modOverrides: { auto_ring: false, auto_dreamcatcher: false },
  },

  // Thresholds (baseline: master on, tuned defaults)
  { name: "thresholds-off", modOverrides: { threshold_master: false } },
  {
    name: "rst-2",
    modOverrides: {
      threshold_perk_affordable_resets: 2,
      threshold_perk_unaffordable_resets: 2,
      threshold_progression_resets: 2,
      threshold_unlocker_resets: 2,
    },
  },
  {
    name: "rst-5",
    modOverrides: {
      threshold_perk_affordable_resets: 5,
      threshold_perk_unaffordable_resets: 5,
      threshold_progression_resets: 5,
      threshold_unlocker_resets: 5,
    },
  },
  { name: "prestige-rst-5", modOverrides: { threshold_prestige_resets: 5 } },
  { name: "item-rep-5", modOverrides: { threshold_item_pct: 5 } },
  { name: "item-rep-20", modOverrides: { threshold_item_pct: 20 } },

  // Auto-use cycle cadence (baseline: 1 off-reset per on-reset)
  { name: "cycle-off-0", modOverrides: { auto_use_cycle_off_resets: 0 } },
  { name: "cycle-off-2", modOverrides: { auto_use_cycle_off_resets: 2 } },

  // Auto-Fill group order (baseline: item, combat, perk, prestige,
  // unlocker, plain, mandatory, travel)
  {
    name: "fill-prestige-first",
    autoFillOrder: [
      "prestige", "item", "combat", "perk",
      "unlocker", "plain", "mandatory", "travel",
    ],
  },
  {
    name: "fill-perk-first",
    autoFillOrder: [
      "perk", "item", "combat", "prestige",
      "unlocker", "plain", "mandatory", "travel",
    ],
  },

  // Combinations of the first sweep's winners (item-rep-5, fill-perk-first,
  // stall-40, rst-5), plus a more aggressive item threshold alone.
  { name: "item-rep-2", modOverrides: { threshold_item_pct: 2 } },
  {
    name: "combo-item5-perkfirst",
    modOverrides: { threshold_item_pct: 5 },
    autoFillOrder: [
      "perk", "item", "combat", "prestige",
      "unlocker", "plain", "mandatory", "travel",
    ],
  },
  {
    name: "combo-item5-perkfirst-stall40",
    modOverrides: { threshold_item_pct: 5, auto_prestige_stall_resets: 40 },
    autoFillOrder: [
      "perk", "item", "combat", "prestige",
      "unlocker", "plain", "mandatory", "travel",
    ],
  },
  {
    name: "combo-item5-perkfirst-rst5",
    modOverrides: {
      threshold_item_pct: 5,
      threshold_perk_affordable_resets: 5,
      threshold_perk_unaffordable_resets: 5,
      threshold_progression_resets: 5,
      threshold_unlocker_resets: 5,
    },
    autoFillOrder: [
      "perk", "item", "combat", "prestige",
      "unlocker", "plain", "mandatory", "travel",
    ],
  },
  // --- Divinity purchase-policy round (buy-*) ---------------------------
  // 1000-run budget: buy strategy mostly shows in the tail (Mastery of
  // Time 40k / See Beyond the Veil 100k and the three SBtV-gated tasks).
  // Baseline profile otherwise; control = the sim's auto_buy_cheapest.
  {
    name: "buy-cheapest",
    options: { maxRuns: 1000, purchasePolicy: { kind: "cheapest" } },
  },
  {
    name: "buy-unlocks-first",
    options: { maxRuns: 1000, purchasePolicy: { kind: "unlocksFirst" } },
  },
  {
    name: "buy-reserve-05",
    options: { maxRuns: 1000, purchasePolicy: { kind: "reserve", f: 0.5 } },
  },
  {
    name: "buy-reserve-10",
    options: { maxRuns: 1000, purchasePolicy: { kind: "reserve", f: 1.0 } },
  },
  {
    name: "buy-spend-cap-05",
    options: { maxRuns: 1000, purchasePolicy: { kind: "spendCap", g: 0.5 } },
  },
  {
    name: "buy-spend-cap-10",
    options: { maxRuns: 1000, purchasePolicy: { kind: "spendCap", g: 1.0 } },
  },
  {
    name: "buy-level-cap-10",
    options: { maxRuns: 1000, purchasePolicy: { kind: "levelCap", cap: 10 } },
  },
  {
    // Authored ordering v1. Permanent Automation is deliberately LATE: the
    // profile runs force_automation, which grants the Amulet anyway.
    name: "buy-tiers-v1",
    options: {
      maxRuns: 1000,
      purchasePolicy: {
        kind: "tiers",
        list: [
          { unlock: "Divine Inspiration" },
          { repeatable: "Divine Knowledge", count: 4 },
          { repeatable: "Gotta Go Fast", count: 3 },
          { unlock: "Look in the Mirror" },
          { unlock: "Transcendant Memory" },
          { repeatable: "Transcendant Aptitude", count: 3 },
          { unlock: "Fully Attuned" },
          { repeatable: "Divine Appetite", count: 2 },
          { unlock: "Mastery of Time" },
          { unlock: "See Beyond the Veil" },
          { unlock: "Perky" },
          { unlock: "Permanent Automation" },
          { unlock: "Compulsive Notetaking" },
          { unlock: "Crafting Breakthrough" },
        ],
      },
    },
  },

  // The REAL in-game mod (Fork 1.5 Unlock Savings) — should reproduce the
  // driver-side spendCap g=1.0 policy (buy-spend-cap-10).
  // NOTE: recorded result predates the Fork 1.5 defaults tuning (item 5%,
  // rst 5, stall 40) — re-running now lands on the new defaults instead.
  {
    name: "mod-unlock-savings",
    modOverrides: { auto_buy_budget_enabled: true },
    options: { maxRuns: 1000 },
  },

  // Fork 1.5 shipped defaults (post defaults-tuning; toggles enabled by the
  // profile as usual, numerics all stock). Old results files are kept as
  // the pre-tuning record — these two document the new out-of-box numbers.
  { name: "tuned-defaults", modOverrides: {} },
  {
    name: "tuned-defaults-unlock-savings",
    modOverrides: { auto_buy_budget_enabled: true },
    options: { maxRuns: 1000 },
  },

  // --- Spark-income round (income-*) ------------------------------------
  // Question: do the completion-metric winners (stall-40, spendCap — both
  // low-prestige) sacrifice long-run spark income? runToBudget plays all
  // 1000 runs regardless of task completion; sparkCheckpoints every 50 runs
  // record earned = held + exactly-reconstructed spending.
  {
    name: "income-baseline",
    options: { maxRuns: 1000, runToBudget: true, checkpointEvery: 50 },
  },
  {
    name: "income-stall-5",
    modOverrides: { auto_prestige_stall_resets: 5 },
    options: { maxRuns: 1000, runToBudget: true, checkpointEvery: 50 },
  },
  {
    name: "income-stall-40",
    modOverrides: { auto_prestige_stall_resets: 40 },
    options: { maxRuns: 1000, runToBudget: true, checkpointEvery: 50 },
  },
  {
    name: "income-spend-cap-10",
    options: {
      maxRuns: 1000,
      runToBudget: true,
      checkpointEvery: 50,
      purchasePolicy: { kind: "spendCap", g: 1.0 },
    },
  },
  {
    name: "income-combo",
    modOverrides: {
      threshold_item_pct: 5,
      threshold_perk_affordable_resets: 5,
      threshold_perk_unaffordable_resets: 5,
      threshold_progression_resets: 5,
      threshold_unlocker_resets: 5,
      auto_prestige_stall_resets: 40,
    },
    autoFillOrder: [
      "perk", "item", "combat", "prestige",
      "unlocker", "plain", "mandatory", "travel",
    ],
    options: { maxRuns: 1000, runToBudget: true, checkpointEvery: 50 },
  },
  {
    name: "income-combo-spend-cap",
    modOverrides: {
      threshold_item_pct: 5,
      threshold_perk_affordable_resets: 5,
      threshold_perk_unaffordable_resets: 5,
      threshold_progression_resets: 5,
      threshold_unlocker_resets: 5,
      auto_prestige_stall_resets: 40,
    },
    autoFillOrder: [
      "perk", "item", "combat", "prestige",
      "unlocker", "plain", "mandatory", "travel",
    ],
    options: {
      maxRuns: 1000,
      runToBudget: true,
      checkpointEvery: 50,
      purchasePolicy: { kind: "spendCap", g: 1.0 },
    },
  },

  {
    // Best run-scheduling profile (combo-all-winners) + best buy policy
    // (spendCap g=1.0) together.
    name: "combo-plus-spend-cap",
    modOverrides: {
      threshold_item_pct: 5,
      threshold_perk_affordable_resets: 5,
      threshold_perk_unaffordable_resets: 5,
      threshold_progression_resets: 5,
      threshold_unlocker_resets: 5,
      auto_prestige_stall_resets: 40,
    },
    autoFillOrder: [
      "perk", "item", "combat", "prestige",
      "unlocker", "plain", "mandatory", "travel",
    ],
    options: { maxRuns: 1000, purchasePolicy: { kind: "spendCap", g: 1.0 } },
  },

  {
    name: "combo-all-winners",
    modOverrides: {
      threshold_item_pct: 5,
      threshold_perk_affordable_resets: 5,
      threshold_perk_unaffordable_resets: 5,
      threshold_progression_resets: 5,
      threshold_unlocker_resets: 5,
      auto_prestige_stall_resets: 40,
    },
    autoFillOrder: [
      "perk", "item", "combat", "prestige",
      "unlocker", "plain", "mandatory", "travel",
    ],
  },
];

// --- Spark-off re-evaluation (2026-07-06) ---------------------------------
// Primary universe: FULL GAME (zoneLimit 30, all 269 tasks — the four
// SBtV-gated tasks stay IN; prestige spark buys SeeBeyondTheVeil eventually
// and their timing is real tail signal). Budget 5000 runs; the headline
// metrics are the checkpoint counts + z1-15 sub-mean in report.mjs (the
// plain mean is tail-dominated under spark-off).
// Secondary universe: zones 1-15, 500 runs, EXCLUDING the four SBtV-gated
// tasks (ids 17/28/88/158) — without discovery spark or a prestige-scale
// horizon they are unobtainable, so "all-134" becomes "all-130".
const FULL = { zoneLimit: 30, maxRuns: 5000 };
const SBTV_GATED_IDS = [17, 28, 88, 158];
const Z15 = {
  zoneLimit: 15,
  maxRuns: 500,
  excludeTaskIds: SBTV_GATED_IDS,
};
const PERK_FIRST = [
  "perk", "item", "combat", "prestige",
  "unlocker", "plain", "mandatory", "travel",
];

const EXPERIMENTS = [
  // Full-game round A — baseline + spark-on continuity control.
  { name: "spark-off-full-baseline", options: { ...FULL } },
  {
    name: "spark-off-full-spark-on",
    modOverrides: { award_spark_on_discovery: true },
    options: { ...FULL },
  },

  // Full-game round B — auto-prestige. Under spark-off, prestige is the ONLY
  // spark source, so the stall-40 tuning (won under spark-on) is the most
  // exposed default. Also test the other OR'd trigger types as candidate
  // defaults: wealth (prospective gain >= pct of owned; zero-owned fires
  // ASAP) and ratio (spark/reset < pct of its peak since last prestige).
  {
    name: "spark-off-full-stall-5",
    modOverrides: { auto_prestige_stall_resets: 5 },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-stall-10",
    modOverrides: { auto_prestige_stall_resets: 10 },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-stall-20",
    modOverrides: { auto_prestige_stall_resets: 20 },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-stall-80",
    modOverrides: { auto_prestige_stall_resets: 80 },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-wealth-10",
    modOverrides: {
      auto_prestige_stall_enabled: false,
      auto_prestige_wealth_enabled: true,
      auto_prestige_wealth_pct: 10,
    },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-wealth-25",
    modOverrides: {
      auto_prestige_stall_enabled: false,
      auto_prestige_wealth_enabled: true,
      auto_prestige_wealth_pct: 25,
    },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-wealth-50",
    modOverrides: {
      auto_prestige_stall_enabled: false,
      auto_prestige_wealth_enabled: true,
      auto_prestige_wealth_pct: 50,
    },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-ratio-50",
    modOverrides: {
      auto_prestige_stall_enabled: false,
      auto_prestige_ratio_enabled: true,
      auto_prestige_ratio_pct: 50,
    },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-stall40-wealth10",
    modOverrides: {
      auto_prestige_wealth_enabled: true,
      auto_prestige_wealth_pct: 10,
    },
    options: { ...FULL },
  },

  // Full-game round C — Divinity purchase policy + Unlock Savings. spendCap's
  // spark-on win rode a smooth discovery-spark income stream; spark-off
  // income arrives in prestige lumps. Control = baseline auto_buy_cheapest.
  {
    name: "spark-off-full-buy-spendcap-10",
    options: { ...FULL, purchasePolicy: { kind: "spendCap", g: 1.0 } },
  },
  {
    name: "spark-off-full-buy-spendcap-05",
    options: { ...FULL, purchasePolicy: { kind: "spendCap", g: 0.5 } },
  },
  {
    name: "spark-off-full-buy-levelcap-10",
    options: { ...FULL, purchasePolicy: { kind: "levelCap", cap: 10 } },
  },
  {
    name: "spark-off-full-unlock-savings",
    modOverrides: { auto_buy_budget_enabled: true },
    options: { ...FULL },
  },

  // Full-game round D — threshold + auto-fill spot-checks of the Fork 1.5
  // tuned numerics (item /rep 5%, rst 5 — now the game defaults).
  {
    name: "spark-off-full-item-2",
    modOverrides: { threshold_item_pct: 2 },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-item-10",
    modOverrides: { threshold_item_pct: 10 },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-rst-3",
    modOverrides: {
      threshold_perk_affordable_resets: 3,
      threshold_perk_unaffordable_resets: 3,
      threshold_progression_resets: 3,
      threshold_unlocker_resets: 3,
    },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-rst-8",
    modOverrides: {
      threshold_perk_affordable_resets: 8,
      threshold_perk_unaffordable_resets: 8,
      threshold_progression_resets: 8,
      threshold_unlocker_resets: 8,
    },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-fill-perk-first",
    autoFillOrder: PERK_FIRST,
    options: { ...FULL },
  },

  // Full-game round E — winners combined. Round B: stall optimum drops to
  // 10-20 under spark-off (40 too passive, 5 spam; wealth trigger
  // degenerates to prestige-every-run while auto-buy keeps held spark near
  // zero, so stall stays the right trigger TYPE). Round C: Unlock Savings
  // (= spendCap g=1.0) cuts completion 29%. The spark-on variant checks the
  // candidate default doesn't regress spark-on players.
  {
    name: "spark-off-full-stall10-savings",
    modOverrides: {
      auto_prestige_stall_resets: 10,
      auto_buy_budget_enabled: true,
    },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-stall15-savings",
    modOverrides: {
      auto_prestige_stall_resets: 15,
      auto_buy_budget_enabled: true,
    },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-stall20-savings",
    modOverrides: {
      auto_prestige_stall_resets: 20,
      auto_buy_budget_enabled: true,
    },
    options: { ...FULL },
  },
  {
    name: "spark-off-full-stall15-savings-spark-on",
    modOverrides: {
      auto_prestige_stall_resets: 15,
      auto_buy_budget_enabled: true,
      award_spark_on_discovery: true,
    },
    options: { ...FULL },
  },

  // Zones 1-15 secondary round (130-task universe) — continuity with the
  // historical z15 rounds and the zone-randomization arc's anchor. Winners
  // from the full-game rounds get added here once known.
  { name: "spark-off-z15-baseline", options: { ...Z15 } },
  {
    name: "spark-off-z15-spark-on",
    modOverrides: { award_spark_on_discovery: true },
    options: { ...Z15 },
  },
  {
    name: "spark-off-z15-stall-10",
    modOverrides: { auto_prestige_stall_resets: 10 },
    options: { ...Z15 },
  },
  {
    name: "spark-off-z15-stall-15",
    modOverrides: { auto_prestige_stall_resets: 15 },
    options: { ...Z15 },
  },
  {
    name: "spark-off-z15-stall-20",
    modOverrides: { auto_prestige_stall_resets: 20 },
    options: { ...Z15 },
  },
  {
    name: "spark-off-z15-savings",
    modOverrides: { auto_buy_budget_enabled: true },
    options: { ...Z15 },
  },
  {
    name: "spark-off-z15-stall15-savings",
    modOverrides: {
      auto_prestige_stall_resets: 15,
      auto_buy_budget_enabled: true,
    },
    options: { ...Z15 },
  },
];

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = getArg("--only")?.split(",");
const maxRuns = getArg("--max-runs");
const includeLegacy = args.includes("--legacy");
const reportName = getArg("--report") ?? "comparison.md";

fs.mkdirSync(configsDir, { recursive: true });
fs.mkdirSync(resultsDir, { recursive: true });

const allExperiments = [
  ...EXPERIMENTS,
  ...LEGACY_EXPERIMENTS.map((e) => ({ ...e, legacy: true })),
];

const outFiles = [];
for (const exp of allExperiments) {
  if (only && !only.includes(exp.name)) continue;
  if (!only && exp.legacy && !includeLegacy) continue;
  const config = {
    name: exp.name,
    options: {
      modOverrides: {
        // Legacy entries predate the spark-off baseline flip; injecting the
        // old spark-on state keeps their configs semantics-stable.
        ...(exp.legacy ? { award_spark_on_discovery: true } : {}),
        ...(exp.modOverrides ?? {}),
      },
      ...(exp.autoFillOrder ? { autoFillOrder: exp.autoFillOrder } : {}),
      ...(exp.options ?? {}),
    },
  };
  const configPath = path.join(configsDir, `${exp.name}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  const outPath = path.join(resultsDir, `${exp.name}-node.json`);
  const cliArgs = [
    path.join(here, "run-node.mjs"),
    "--config", configPath,
    "--out", outPath,
  ];
  if (maxRuns) cliArgs.push("--max-runs", maxRuns);
  console.log(`=== ${exp.name} ===`);
  execFileSync("node", cliArgs, { stdio: "inherit" });
  outFiles.push(outPath);
}

if (outFiles.length > 1) {
  const report = execFileSync("node", [
    path.join(here, "report.mjs"),
    ...outFiles,
  ]);
  const reportPath = path.join(resultsDir, reportName);
  fs.writeFileSync(reportPath, report);
  console.log(`wrote ${reportPath}`);
}
