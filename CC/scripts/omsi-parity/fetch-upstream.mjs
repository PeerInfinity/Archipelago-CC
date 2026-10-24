// Upstream drift check for the omsi-parity harness.
//
// Unlike jta-parity's fetch-upstream, there is nothing to clone or build:
// Idle Loops is plain JS with no build step, and the fork-point commit
// (fe4a349) is content-addressed in the fork submodule's own object store,
// so run-parity.mjs extracts both sides locally via `git archive`.
//
// This script does the two integrity checks that DO need doing:
//   1. fork point == merge-base(substrate HEAD, dmchurch) in the submodule
//      (proves "every difference the harness finds is fork-introduced");
//   2. live upstream drift: has dmchurch/omsi-loops moved past the fork
//      point? (network; informational — the harness always compares against
//      the FORK POINT regardless, same policy as jta-parity).
//
// Usage: node CC/scripts/omsi-parity/fetch-upstream.mjs

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FORK_POINT } from "./run-parity.mjs";

const UPSTREAM_URL = "https://github.com/dmchurch/omsi-loops.git";
const UPSTREAM_BRANCH = "dmchurch";   // upstream's default branch (NOT main)

const here = path.dirname(fileURLToPath(import.meta.url));
const submoduleDir = path.resolve(here, "../../../frontend/modules/omsi-loops");
const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();

const head = run("git", ["-C", submoduleDir, "rev-parse", "HEAD"]);
const mergeBase = run("git", ["-C", submoduleDir, "merge-base", "HEAD", UPSTREAM_BRANCH]);
console.log(`[fetch-upstream] fork HEAD:                  ${head}`);
console.log(`[fetch-upstream] merge-base(HEAD, dmchurch): ${mergeBase}`);
if (mergeBase !== FORK_POINT) {
    console.error(`[fetch-upstream] MISMATCH: harness FORK_POINT is ${FORK_POINT} — update run-parity.mjs`);
    process.exit(1);
}
console.log(`[fetch-upstream] fork point verified: ${FORK_POINT}`);

try {
    const remote = run("git", ["ls-remote", UPSTREAM_URL, `refs/heads/${UPSTREAM_BRANCH}`]).split("\t")[0];
    if (remote === FORK_POINT) {
        console.log(`[fetch-upstream] upstream drift: NONE — live ${UPSTREAM_BRANCH} == fork point`);
    } else {
        console.log(`[fetch-upstream] upstream drift: live ${UPSTREAM_BRANCH} = ${remote} != fork point`);
        console.log(`[fetch-upstream] (harness still compares against the fork point; update README if this persists)`);
    }
} catch (e) {
    console.log(`[fetch-upstream] live-drift check skipped (network): ${e.message.split("\n")[0]}`);
}
