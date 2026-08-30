// Playwright bootstrap for the JtA stats driver: loads the real game page
// (fresh save via localStorage.clear()), pauses the wall-clock loop, and runs
// driver.mjs inside the page against the live module instances.
//
// Usage: node CC/scripts/jta-stats/run-playwright.mjs [--config FILE] [--out FILE] [--max-runs N]
// Requires the dev server on :8000 (serves the repo root).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const baseUrl = getArg("--base-url") ?? "http://localhost:8000";
const pageUrl = `${baseUrl}/frontend/modules/journey-to-ascension/index.html`;
const configPath = getArg("--config");
const config = configPath
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : {};
const options = { ...(config.options ?? config) };
if (getArg("--max-runs")) options.maxRuns = Number(getArg("--max-runs"));
const outPath =
  getArg("--out") ??
  path.join(here, "results", `${config.name ?? "baseline"}-playwright.json`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  page.on("console", (m) => console.log(`[page] ${m.text()}`));
  page.on("pageerror", (e) => console.error(`[pageerror] ${e.message}`));

  await page.goto(pageUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(
    () =>
      typeof window.stepTick === "function" &&
      typeof window.pauseGameLoop === "function"
  );

  const t0 = Date.now();
  const result = await page.evaluate(async (options) => {
    window.pauseGameLoop();
    const base = "/frontend/modules/journey-to-ascension/build";
    const sim = await import(`${base}/simulation.js`);
    const game = await import(`${base}/game.js`);
    const zones = await import(`${base}/zones.js`);
    const prestige = await import(`${base}/prestige_upgrades.js`);
    const driver = await import("/CC/scripts/jta-stats/driver.mjs");
    return driver.runFirstCompletionStats(
      { sim, game, zones, prestige, win: window },
      options
    );
  }, options);
  const totalMs = Date.now() - t0;

  result.meta = {
    env: "playwright",
    configName: config.name ?? "baseline",
    pageUrl,
    totalMsIncludingBridge: totalMs,
    generatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(
    `[playwright] ${result.completedCount}/${result.taskCount} tasks, ` +
      `${result.timing.runsExecuted} runs, ${result.timing.ticks} ticks, ` +
      `${Math.round(result.timing.wallMs)}ms in-page (${totalMs}ms with bridge)`
  );
  console.log(`[playwright] wrote ${outPath}`);
} finally {
  await browser.close();
}
