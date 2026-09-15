/**
 * seedlingSource — **WHERE THE SEEDLING FORK'S CHECKOUT IS: AN ARGUMENT,
 * `SEEDLING_SRC`, OR THIS MACHINE'S `.seedling-src` POINTER FILE, AND A REFUSAL
 * BY NAME WHEN IT IS NONE OF THEM** (slice seedling-headless-E1, 2026-09-15;
 * the pointer file slice seedling-headless-F1).
 *
 * The Seedling AS3 source is a separate repository (the `PeerInfinity/Seedling`
 * fork, MIT), so every instrument that reads it has to be TOLD where a clone
 * is. Before E1, five instruments defaulted to one machine's layout (a clone
 * under the home directory's `CC/`): on any other machine that default named a
 * directory that is not there, and the failure read as "no source" rather than
 * "nobody said where the source is". Now the order is:
 *
 *   the tool's own flag (`--source <dir>` / `--seedling <dir>`) → `SEEDLING_SRC`
 *   → `<repo>/.seedling-src` → REFUSE, exit 2, naming the tool and all three.
 *
 * ⛓ THE POINTER FILE is one line, the checkout's path (`~` expands to the home
 * directory; a relative path is relative to the repository root; a trailing
 * newline is fine). It is GITIGNORED and per tree — a worktree has none until
 * one is written there. It exists because an export in a shell profile does
 * not reach every shell that runs these tools (a launched session's tool
 * shells load no profile), while a file beside the code does. Create it with:
 *
 *   echo <path-to-your-seedling-checkout> > .seedling-src
 *
 * CI has no such file, so CI keeps refusing or skipping by name.
 * `SEEDLING_SRC_POINTER` names a different pointer file; the rows and
 * `check-procgen-help` point it at a path that does not exist, so what they
 * measure does not depend on the machine's file.
 *
 * ⛔ NO LAYOUT FALLBACK. A guessed path that happens to exist on the machine
 * that wrote it is the defect, not a convenience; the pointer file is a path
 * somebody WROTE for this machine.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The environment variable every seedling-reading instrument honours. */
export const SEEDLING_SRC_ENV = 'SEEDLING_SRC';

/** The per-machine pointer file's name, at the repository root (gitignored). */
export const SEEDLING_POINTER_FILE = '.seedling-src';

/** Names a pointer file other than `<repo>/.seedling-src` (rows and gates isolate with it). */
export const SEEDLING_POINTER_ENV = 'SEEDLING_SRC_POINTER';

/** The repository a checkout is a clone of — provenance names this, never a path. */
export const SEEDLING_REPO = 'PeerInfinity/Seedling';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The pointer file this environment reads. */
export function seedlingPointerPath(env = process.env) {
    return env[SEEDLING_POINTER_ENV] || join(REPO, SEEDLING_POINTER_FILE);
}

/** The checkout a pointer file names, or null when the file is absent or empty. */
export function readSeedlingPointer(file) {
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { return null; }
    const line = text.split('\n')[0].trim();
    if (!line) return null;
    const expanded = line === '~' || line.startsWith('~/') ? join(homedir(), line.slice(1)) : line;
    return resolve(REPO, expanded);
}

/**
 * The checkout a caller named, or null: `given` (the tool's flag value) wins,
 * then `env[SEEDLING_SRC]`, then the pointer file. An empty string is "not named".
 */
export function seedlingSource(given, env = process.env) {
    const named = given || env[SEEDLING_SRC_ENV];
    return named ? resolve(named) : readSeedlingPointer(seedlingPointerPath(env));
}

/** The refusal's text, spelled once so the tools and the rows read the same words. */
export function seedlingSourceRefusal(tool, flag = '--source') {
    return `${tool}: no seedling checkout named — pass ${flag} <checkout>, set `
        + `${SEEDLING_SRC_ENV}, or write the checkout's path into ${SEEDLING_POINTER_FILE} `
        + `at the repository root (a clone of the ${SEEDLING_REPO} fork)`;
}

/** `seedlingSource`, or the refusal on stderr and exit 2. */
export function seedlingSourceOrExit(given, { tool, flag = '--source' }) {
    const source = seedlingSource(given);
    if (source) return source;
    console.error(seedlingSourceRefusal(tool, flag));
    process.exit(2);
}
