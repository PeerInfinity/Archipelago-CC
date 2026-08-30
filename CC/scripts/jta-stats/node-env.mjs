// Plain-Node entry to the headless JtA engine environment.
//
// The stubs and the load-bearing import order live in
// frontend/modules/jtaBalance/headlessGameEnv.js, shared with the Pass-B
// balance Web Worker so there is exactly one copy. This file only supplies
// Node's URL resolution for the committed build directory.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadJtaEnv as loadJtaEnvWith } from "../../../frontend/modules/jtaBalance/headlessGameEnv.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const buildDir = path.join(
  repoRoot,
  "frontend/modules/journey-to-ascension/build"
);

// Loads the build and returns the driver `env` plus extra data modules.
export async function loadJtaEnv() {
  return loadJtaEnvWith((name) =>
    pathToFileURL(path.join(buildDir, name)).href
  );
}
