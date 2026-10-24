/**
 * seedlingSource — **WHERE THE SEEDLING FORK'S SOURCE IS: AN ARGUMENT, OR THE
 * `vendor/seedling` SUBMODULE WHEN IT IS INITIALISED, AND A REFUSAL BY NAME
 * WHEN IT IS NEITHER** (slice seedling-headless-E1, 2026-09-15; the submodule
 * slice seedling-headless-V1).
 *
 * The Seedling AS3 source is a separate repository (the `PeerInfinity/Seedling`
 * fork, public domain under the Unlicense). Since V1 it is a SUBMODULE of this
 * repository at `vendor/seedling`, pinned at the commit the bot build was
 * compiled from (`flashPanel/wasm/builds.json`, held there by
 * `check-seedling-source-pin.mjs`). The order is:
 *
 *   the tool's own flag (`--source <dir>` / `--seedling <dir>`)
 *   → `<repo>/vendor/seedling`, when initialised → REFUSE, exit 2, by name.
 *
 * ⛓ "INITIALISED" means the directory holds a `.git` entry (a submodule
 * checkout's gitfile). A clone made without `--recurse-submodules` leaves the
 * directory EMPTY, and the refusal names the one command that fills it:
 *
 *   git submodule update --init vendor/seedling
 *
 * CI checks out `submodules: recursive`, so CI reads the same source as a box.
 *
 * ⛔ NO LAYOUT FALLBACK. The submodule is not a guess about where somebody's
 * clone happens to live: it is a tracked gitlink, the same commit on every
 * machine. A path outside the repository is only ever reached by NAMING it
 * with the tool's flag.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The submodule's path, as `.gitmodules` declares it. */
export const SEEDLING_SUBMODULE = 'vendor/seedling';

/** The repository the submodule is a clone of — provenance names this, never a path. */
export const SEEDLING_REPO = 'PeerInfinity/Seedling';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** `<repo>/vendor/seedling` when it is initialised, else null. */
export function seedlingSubmodule(repo = REPO) {
    const dir = resolve(repo, SEEDLING_SUBMODULE);
    return existsSync(join(dir, '.git')) ? dir : null;
}

/**
 * The checkout a caller named, or null: `given` (the tool's flag value) wins,
 * then the initialised submodule. An empty string is "not named".
 */
export function seedlingSource(given, { repo = REPO } = {}) {
    return given ? resolve(given) : seedlingSubmodule(repo);
}

/** The refusal's text, spelled once so the tools and the rows read the same words. */
export function seedlingSourceRefusal(tool) {
    return `${tool}: the Seedling submodule is not initialised — `
        + `git submodule update --init ${SEEDLING_SUBMODULE}`;
}

/** `seedlingSource`, or the refusal on stderr and exit 2. */
export function seedlingSourceOrExit(given, { tool }) {
    const source = seedlingSource(given);
    if (source) return source;
    console.error(seedlingSourceRefusal(tool));
    process.exit(2);
}
