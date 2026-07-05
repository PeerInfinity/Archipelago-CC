// Experiment sweep: run the stats driver across a set of automation-setting
// variants (each in a fresh Node process so module-local sim state can't
// leak between configs), then emit a comparison report.
//
// Usage: node CC/scripts/jta-stats/experiments.mjs [--only name1,name2] [--max-runs N]
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

// threshold_all_skipped = 0 (Idle) is deliberately absent: with no task
// there is no energy drain, so an all-skipped run idles forever — it stalls
// the harness and does nothing useful in real play either.
const EXPERIMENTS = [
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

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = getArg("--only")?.split(",");
const maxRuns = getArg("--max-runs");

fs.mkdirSync(configsDir, { recursive: true });
fs.mkdirSync(resultsDir, { recursive: true });

const outFiles = [];
for (const exp of EXPERIMENTS) {
  if (only && !only.includes(exp.name)) continue;
  const config = {
    name: exp.name,
    options: {
      modOverrides: exp.modOverrides ?? {},
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
  const reportPath = path.join(resultsDir, "comparison.md");
  fs.writeFileSync(reportPath, report);
  console.log(`wrote ${reportPath}`);
}
