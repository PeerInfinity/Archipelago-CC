// Fetch + build the UPSTREAM comparison target for the JtA parity harness.
//
// Clones meneth/journey-to-ascension into ./upstream/ (gitignored), checks
// out the FORK-POINT commit (not upstream HEAD — every difference the harness
// finds must be fork-introduced), and compiles it with the clone's OWN
// TypeScript (npm ci + ./node_modules/.bin/tsc, never an ambient tsc).
// Upstream does not commit build/, so compiling is mandatory.
//
// Also reports whether live upstream HEAD has moved past the fork point.
// As of 2026-07-10 it has NOT: origin/main == a0057b1 == the fork point.
//
// Usage: node CC/scripts/jta-parity/fetch-upstream.mjs [--force]
//   --force  re-clone / re-build even if upstream/build already looks good.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FORK_POINT = "a0057b1a0b3435dd9864f8611920546098b0af7e";
const UPSTREAM_URL = "https://github.com/meneth/journey-to-ascension.git";

const here = path.dirname(fileURLToPath(import.meta.url));
const upstreamDir = path.join(here, "upstream");
// The fork submodule — used only as a git object-store fallback when the
// network clone fails (its `upstream` remote has the fork-point commit).
const submoduleDir = path.resolve(
  here,
  "../../../frontend/modules/journey-to-ascension"
);

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();
const runIn = (dir, cmd, args) => run(cmd, args, { cwd: dir });

function log(msg) {
  console.log(`[fetch-upstream] ${msg}`);
}

function haveGoodClone() {
  try {
    return (
      runIn(upstreamDir, "git", ["rev-parse", "HEAD"]) === FORK_POINT &&
      fs.existsSync(path.join(upstreamDir, "simulation.ts"))
    );
  } catch {
    return false;
  }
}

function cloneUpstream() {
  fs.rmSync(upstreamDir, { recursive: true, force: true });
  try {
    log(`cloning ${UPSTREAM_URL} ...`);
    run("git", ["clone", UPSTREAM_URL, upstreamDir]);
  } catch (e) {
    log(`network clone failed (${e.message.split("\n")[0]})`);
    log(`falling back to the submodule's local upstream objects`);
    // The submodule has an `upstream` remote already fetched; a local clone
    // of the submodule brings its objects along, then we can detach at the
    // fork point. Live-HEAD drift can NOT be verified on this path.
    run("git", ["clone", "--no-checkout", submoduleDir, upstreamDir]);
  }
}

function report(msg) {
  console.log(msg);
}

const force = process.argv.includes("--force");

if (force || !haveGoodClone()) {
  cloneUpstream();
  runIn(upstreamDir, "git", ["checkout", "--detach", FORK_POINT]);
} else {
  log("existing clone already at the fork point");
}

// --- Drift report: has live upstream moved past the fork point? -----------
try {
  const remote = run("git", ["ls-remote", UPSTREAM_URL, "refs/heads/main"]);
  const liveMain = remote.split(/\s+/)[0];
  if (liveMain === FORK_POINT) {
    report(
      `[drift] upstream main is EXACTLY the fork point (${FORK_POINT.slice(0, 7)}); no upstream drift.`
    );
  } else {
    report(
      `[drift] NOTE: upstream main is now ${liveMain.slice(0, 7)}, past the fork point ` +
        `${FORK_POINT.slice(0, 7)}. The harness still compares against the FORK POINT ` +
        `(so every difference is fork-introduced); update the README drift note.`
    );
  }
} catch {
  report("[drift] could not reach live upstream to check for drift (offline?)");
}

// --- Build: npm ci + the clone's own tsc -----------------------------------
const buildMarker = path.join(upstreamDir, "build", "simulation.js");
if (force || !fs.existsSync(buildMarker)) {
  log("npm ci (upstream's own devDependencies, incl. its typescript) ...");
  try {
    runIn(upstreamDir, "npm", ["ci", "--no-audit", "--no-fund"]);
  } catch {
    log("npm ci failed; trying npm install");
    runIn(upstreamDir, "npm", ["install", "--no-audit", "--no-fund"]);
  }
  const localTsc = path.join(upstreamDir, "node_modules", ".bin", "tsc");
  if (!fs.existsSync(localTsc)) {
    throw new Error(
      "upstream clone has no local tsc after npm ci — refusing to use an ambient tsc"
    );
  }
  log("compiling with the clone's ./node_modules/.bin/tsc ...");
  runIn(upstreamDir, localTsc, []); // tsconfig.json: outDir ./build
} else {
  log("upstream build/ already present (use --force to rebuild)");
}

for (const f of ["game.js", "simulation.js", "zones.js", "events.js"]) {
  if (!fs.existsSync(path.join(upstreamDir, "build", f))) {
    throw new Error(`upstream build incomplete: build/${f} missing`);
  }
}
log(`upstream ready at ${upstreamDir} (commit ${FORK_POINT.slice(0, 7)})`);
