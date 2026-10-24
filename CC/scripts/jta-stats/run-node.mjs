// Plain-Node bootstrap for the JtA stats driver. DOM stubs + build loading
// live in node-env.mjs (shared with profile-vanilla.mjs); this script wires
// a config file to driver.mjs and writes the result JSON.
//
// Usage: node CC/scripts/jta-stats/run-node.mjs [--config FILE] [--out FILE]
//        [--max-runs N] [--dataset FILE.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadJtaEnv } from "./node-env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

const env = await loadJtaEnv();
const driver = await import(pathToFileURL(path.join(here, "driver.mjs")));

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const configPath = getArg("--config");
const config = configPath
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : {};
const options = { ...(config.options ?? config) };
if (getArg("--max-runs")) options.maxRuns = Number(getArg("--max-runs"));
// Synthetic game data document (Phase 5c): loaded from disk here, passed to
// the driver as options.dataset (config files may also inline it).
if (getArg("--dataset")) {
  options.dataset = JSON.parse(fs.readFileSync(getArg("--dataset"), "utf8"));
}
const outPath =
  getArg("--out") ??
  path.join(here, "results", `${config.name ?? "baseline"}-node.json`);

const t0 = Date.now();
const result = driver.runFirstCompletionStats(env, options);
const totalMs = Date.now() - t0;

result.meta = {
  env: "node",
  configName: config.name ?? "baseline",
  totalMsIncludingBridge: totalMs,
  generatedAt: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(
  `[node] ${result.completedCount}/${result.taskCount} tasks, ` +
    `${result.timing.runsExecuted} runs, ${result.timing.ticks} ticks, ` +
    `${Math.round(result.timing.wallMs)}ms driver (${totalMs}ms total)`
);
console.log(`[node] wrote ${outPath}`);
// The sim calls game.js setTickRate() during play, which starts the interval
// game loop even headlessly; exit explicitly so the timer doesn't keep the
// process alive ticking a dead game.
process.exit(0);
