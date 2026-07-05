// Plain-Node bootstrap for the JtA stats driver: stubs just enough DOM for
// the build modules to import (game.js constructs a Rendering at module
// top-level, whose constructor does getElementById + addEventListener), then
// runs driver.mjs against the modules loaded straight from disk. No browser.
//
// Usage: node CC/scripts/jta-stats/run-node.mjs [--config FILE] [--out FILE] [--max-runs N]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const buildDir = path.join(
  repoRoot,
  "frontend/modules/journey-to-ascension/build"
);

// --- Minimal DOM stubs -----------------------------------------------------
class FakeElement {
  constructor() {
    this.style = {};
    this.dataset = {};
    this.children = [];
    this.classList = {
      add() {},
      remove() {},
      toggle() {},
      contains: () => false,
    };
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.checked = false;
  }
  addEventListener() {}
  removeEventListener() {}
  appendChild(c) {
    return c;
  }
  removeChild(c) {
    return c;
  }
  insertBefore(c) {
    return c;
  }
  remove() {}
  querySelector() {
    return new FakeElement();
  }
  querySelectorAll() {
    return [];
  }
  setAttribute() {}
  getAttribute() {
    return null;
  }
  removeAttribute() {}
  closest() {
    return null;
  }
  focus() {}
  blur() {}
  click() {}
  getBoundingClientRect() {
    return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
  getElementsByClassName() {
    return [];
  }
  getElementsByTagName() {
    return [];
  }
}

const documentStub = {
  addEventListener() {},
  removeEventListener() {},
  getElementById: () => new FakeElement(),
  querySelector: () => new FakeElement(),
  querySelectorAll: () => [],
  createElement: () => new FakeElement(),
  createTextNode: (t) => ({ textContent: t }),
  body: new FakeElement(),
  documentElement: new FakeElement(),
};

const windowStub = {
  location: { search: "", href: "http://localhost/" },
  addEventListener() {},
  removeEventListener() {},
};

globalThis.window = windowStub;
globalThis.document = documentStub;
globalThis.HTMLElement = FakeElement;
globalThis.localStorage = {
  getItem: () => null,
  setItem() {},
  removeItem() {},
  clear() {},
};
globalThis.alert = () => {};
globalThis.confirm = () => true;

// --- Load the build and run the driver -------------------------------------
// game.js first: it is the browser page's entry module, so importing it
// first replicates the browser's evaluation order for the circular
// game <-> simulation <-> rendering imports.
const game = await import(pathToFileURL(path.join(buildDir, "game.js")));
const sim = await import(pathToFileURL(path.join(buildDir, "simulation.js")));
const zones = await import(pathToFileURL(path.join(buildDir, "zones.js")));
const prestige = await import(
  pathToFileURL(path.join(buildDir, "prestige_upgrades.js"))
);
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
const outPath =
  getArg("--out") ??
  path.join(here, "results", `${config.name ?? "baseline"}-node.json`);

const t0 = Date.now();
const result = driver.runFirstCompletionStats(
  { sim, game, zones, prestige, win: windowStub },
  options
);
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
