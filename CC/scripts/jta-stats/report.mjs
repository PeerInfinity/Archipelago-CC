// Render one or more jta-stats result JSONs as a markdown report.
//
// Usage:
//   node CC/scripts/jta-stats/report.mjs results/baseline-node.json > results/baseline.md
//   node CC/scripts/jta-stats/report.mjs results/*.json > results/comparison.md
//
// One file  -> per-task first-completion table.
// Many files -> summary comparison + per-task run numbers side by side
//               (first file is the baseline column).
import fs from "node:fs";
import path from "node:path";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node report.mjs result.json [more.json ...]");
  process.exit(1);
}

const results = files.map((f) => ({
  name: path.basename(f).replace(/\.json$/, ""),
  data: JSON.parse(fs.readFileSync(f, "utf8")),
}));

// Metrics over the measured zone window. Unreached tasks count as
// maxRuns+1 in the mean so configs that fail to reach tasks rank worse.
function summarize(r) {
  const { completions, unreached, options, timing, finalState } = r.data;
  const penalty = options.maxRuns + 1;
  const runs = completions
    .map((c) => c.run)
    .concat(unreached.map(() => penalty));
  const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
  const sorted = [...runs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const lastRun = completions.reduce((m, c) => Math.max(m, c.run), 0);
  const purchaseRun = (name) => {
    const p = (r.data.purchases ?? []).find((p) => p.name === name);
    return p ? p.run : "—";
  };
  return {
    completed: `${r.data.completedCount}/${r.data.taskCount}`,
    meanRun: mean.toFixed(1),
    medianRun: median,
    lastFirstCompletion: r.data.allCompleted ? lastRun : `>${options.maxRuns}`,
    prestiges: finalState.prestiges,
    highestZone: finalState.highestZone + 1,
    motRun: purchaseRun("Mastery of Time"),
    sbtvRun: purchaseRun("See Beyond the Veil"),
    ticks: timing.ticks,
    wallMs: Math.round(timing.wallMs),
  };
}

const anyPurchases = () => results.some((r) => (r.data.purchases ?? []).length);

const lines = [];

if (results.length > 1) {
  lines.push(`# JtA automation stats — comparison`);
  lines.push("");
  lines.push(
    `Baseline: **${results[0].name}**. "Run" = cumulative run (energy reset or prestige) at which a task first hit reps == max_reps. Zone window: zones 1-${results[0].data.options.zoneLimit}, budget ${results[0].data.options.maxRuns} runs.`
  );
  lines.push("");
  const buyCols = anyPurchases();
  lines.push(
    `| config | completed | mean run | median run | last first-completion | prestiges | highest zone |${buyCols ? " MoT@ | SBtV@ |" : ""} ticks | wall ms |`
  );
  lines.push(`|---|---|---|---|---|---|---|${buyCols ? "---|---|" : ""}---|---|`);
  for (const r of results) {
    const s = summarize(r);
    lines.push(
      `| ${r.name} | ${s.completed} | ${s.meanRun} | ${s.medianRun} | ${s.lastFirstCompletion} | ${s.prestiges} | ${s.highestZone} |${buyCols ? ` ${s.motRun} | ${s.sbtvRun} |` : ""} ${s.ticks} | ${s.wallMs} |`
    );
  }
  lines.push("");
}

// Per-task table: baseline order (zone, id), one run column per result.
const base = results[0].data;
lines.push(
  results.length > 1
    ? `## Per-task first completion (run number)`
    : `# JtA automation stats — ${results[0].name}`
);
lines.push("");
if (results.length === 1) {
  const s = summarize(results[0]);
  lines.push(
    `${s.completed} tasks first-completed within ${base.options.maxRuns} runs; mean run ${s.meanRun}, median ${s.medianRun}; ended with ${s.prestiges} prestiges, highest zone ${s.highestZone}.`
  );
  lines.push("");
}
const header = ["zone", "task", "reps"].concat(
  results.map((r) => (results.length > 1 ? r.name : "first run (prestiges)"))
);
lines.push(`| ${header.join(" | ")} |`);
lines.push(`|${header.map(() => "---").join("|")}|`);

const universe = [...base.completions, ...base.unreached].sort(
  (a, b) => a.zone - b.zone || a.id - b.id
);
for (const t of universe) {
  const cells = results.map((r) => {
    const c = r.data.completions.find((c) => c.id === t.id);
    if (!c) return "—";
    return results.length > 1 ? `${c.run}` : `${c.run} (${c.prestiges})`;
  });
  lines.push(
    `| ${t.zone + 1} ${t.zoneName} | ${t.name} | ${t.maxReps} | ${cells.join(" | ")} |`
  );
}
lines.push("");
console.log(lines.join("\n"));
