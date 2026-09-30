#!/usr/bin/env node
/**
 * seedlingProfileLoader — install a Seedling physics profile override from a file, for a node process (engine-prep A3).
 *
 * `seedlingProfile.js` reads `globalThis.__SEEDLING_PROFILE__` ONCE, when it
 * evaluates, and the 28 modules that read the profile copy their constants
 * out at THEIR evaluation (⚖ Q2: process-wide at load). The module itself
 * stays browser-safe — no `fs`, no `process` — so the FILE is read here, in
 * the script, and handed over as JSON text (the loader then finds duplicate
 * keys in the text, which `JSON.parse` would silently drop).
 *
 * ⛔ CALL `installProfileFromEnv()` BEFORE THE FIRST IMPORT OF THE MODEL, and
 * import the model DYNAMICALLY after it: a static `import` is hoisted above
 * any call. The installer imports `seedlingProfile.js` itself, so a refusal
 * surfaces here with the FILE named; and if the profile module had already
 * evaluated without the override (an install that came too late) it throws
 * rather than let the run carry the defaults under the override's name.
 *
 * The path comes from `--profile=<path>` or, failing that, the
 * `SEEDLING_PROFILE` environment variable. Neither: nothing is installed and
 * the process runs the compiled-in default.
 *
 * Run as a command it validates a profile file and prints RWK's
 * announcements (the provenance, one `set <key>=<value>` per set, the
 * defaulted count; `--list-defaulted` adds the defaulted keys):
 *
 * Run:
 *   node scripts/procgen/seedlingProfileLoader.mjs --profile=my-profile.json
 *   SEEDLING_PROFILE=my-profile.json node scripts/procgen/seedlingProfileLoader.mjs --list-defaulted
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROFILE_MODULE = join(REPO, 'frontend/modules/seedlingDemo/seedlingProfile.js');
/** The same name `profileOverrides.js` exports as `PROFILE_GLOBAL`; importing it here would be harmless, but is not needed. */
const PROFILE_GLOBAL = '__SEEDLING_PROFILE__';

/** The profile path `argv`/`env` name, or null. `--profile=` wins over the environment. */
export function profilePathFrom({ argv = process.argv, env = process.env } = {}) {
    const flag = argv.find((a) => a.startsWith('--profile='));
    if (flag) return flag.slice('--profile='.length) || null;
    return env.SEEDLING_PROFILE || null;
}

/**
 * Install the override named by `--profile=` / `SEEDLING_PROFILE`, then load
 * the profile module to validate it.
 *
 * @returns {Promise<{path: (string|null), profile: object}>} `profile` is the
 *   loaded `seedlingProfile.js` module namespace.
 * @throws {Error} naming the file, when the file cannot be read or the
 *   override is refused, or when the profile module had already evaluated.
 */
export async function installProfileFromEnv({ argv = process.argv, env = process.env } = {}) {
    const path = profilePathFrom({ argv, env });
    if (path === null) return { path: null, profile: await import(pathToFileURL(PROFILE_MODULE).href) };
    let text;
    try {
        text = readFileSync(path, 'utf8');
    } catch (e) {
        throw new Error(`${path}: cannot read the profile override (${e.code ?? e.message})`);
    }
    globalThis[PROFILE_GLOBAL] = text;
    let profile;
    try {
        profile = await import(pathToFileURL(PROFILE_MODULE).href);
    } catch (e) {
        throw new Error(`${path}: ${e.message}`);
    }
    if (profile.PROFILE_SOURCE === 'compiled-in default') {
        throw new Error(`${path}: installed TOO LATE — seedlingProfile.js had already evaluated without it; `
            + 'call installProfileFromEnv() before the first import of the model');
    }
    return { path, profile };
}

async function main() {
    let installed;
    try {
        installed = await installProfileFromEnv();
    } catch (e) {
        console.error(`REFUSED: ${e.message}`);
        process.exit(1);
    }
    const { path, profile } = installed;
    console.log(`file: ${path ?? '(none — SEEDLING_PROFILE unset and no --profile=)'}`);
    for (const line of profile.profileAnnouncements()) console.log(line);
    if (process.argv.includes('--list-defaulted')) {
        console.log(`defaulted keys: ${profile.profileDefaultedKeys().join(', ') || '(none)'}`);
    }
}

argvHelp(import.meta.url);
if (isEntryPoint(import.meta.url)) await main();
