/**
 * seedlingSource — **WHERE THE SEEDLING FORK'S CHECKOUT IS: AN ARGUMENT OR
 * `SEEDLING_SRC`, AND A REFUSAL BY NAME WHEN IT IS NEITHER** (slice
 * seedling-headless-E1, 2026-09-15).
 *
 * The Seedling AS3 source is a separate repository (the `PeerInfinity/Seedling`
 * fork, MIT), so every instrument that reads it has to be TOLD where a clone
 * is. Before this, five instruments defaulted to one machine's layout (a clone
 * under the home directory's `CC/`): on any other machine that default named a
 * directory that is not there, and the failure read as "no source" rather than
 * "nobody said where the source is". Now the order is:
 *
 *   the tool's own flag (`--source <dir>` / `--seedling <dir>`) → `SEEDLING_SRC`
 *   → REFUSE, exit 2, naming the tool, the flag and the variable.
 *
 * ⛔ NO LAYOUT FALLBACK. A guessed path that happens to exist on the machine
 * that wrote it is the defect, not a convenience.
 */
import { resolve } from 'node:path';

/** The environment variable every seedling-reading instrument honours. */
export const SEEDLING_SRC_ENV = 'SEEDLING_SRC';

/** The repository a checkout is a clone of — provenance names this, never a path. */
export const SEEDLING_REPO = 'PeerInfinity/Seedling';

/**
 * The checkout a caller named, or null: `given` (the tool's flag value) wins,
 * then `env[SEEDLING_SRC]`. An empty string is "not named".
 */
export function seedlingSource(given, env = process.env) {
    const named = given || env[SEEDLING_SRC_ENV];
    return named ? resolve(named) : null;
}

/** The refusal's text, spelled once so the tools and the rows read the same words. */
export function seedlingSourceRefusal(tool, flag = '--source') {
    return `${tool}: no seedling checkout named — pass ${flag} <checkout> or set `
        + `${SEEDLING_SRC_ENV} (a clone of the ${SEEDLING_REPO} fork)`;
}

/** `seedlingSource`, or the refusal on stderr and exit 2. */
export function seedlingSourceOrExit(given, { tool, flag = '--source' }) {
    const source = seedlingSource(given);
    if (source) return source;
    console.error(seedlingSourceRefusal(tool, flag));
    process.exit(2);
}
