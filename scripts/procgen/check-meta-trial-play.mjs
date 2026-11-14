#!/usr/bin/env node
/**
 * Content sets R3: THE THEME WORLD, PLAYED. `check-concept-trial-play.mjs`, run on
 * the committed `meta_trial` preset (`make-seedling-spiral-room-preset.mjs
 * --state=meta-trial`, from `META_TRIAL_STATE`: the concept trial with
 * `content: ['meta']`), under its own CI key, `gate: meta-trial-play`.
 *
 * Every phase is that gate's, and every expectation is read off the named
 * preset, never typed: here the guardian's blocked and passed-with prose are
 * the theme's Gate lines, and the sword's check prose is the theme's check line.
 * The maze, its water gate and its item colours are the control's byte for byte
 * (the theme presents no water and gives the items no look), so the same
 * literal assertions hold.
 *
 * ⛓ A FILE, NOT A `@standing-variant`: a declared arm runs in `local` only
 * (`gates.mjs` `armsIn`), and CI runs one arm per gate file.
 *
 * Prereqs: as `check-concept-trial-play.mjs` (a dev server at the repo root,
 * the `textAdventureEngine` submodule).
 *
 * Run: node scripts/procgen/check-meta-trial-play.mjs [--host=http://localhost:8000]
 */
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { main } from './check-concept-trial-play.mjs';

argvHelp(import.meta.url);

/**
 * ⛔ NOTHING RUNS ON IMPORT. The take is HERE, under this file's name (the
 * taker lint reads every machine driver for its own preamble); it exports its
 * token, so the take inside `main()` passes through as the holder's own.
 */
if (isEntryPoint(import.meta.url)) {
    takeBoxLockOrExit({ name: 'check-meta-trial-play.mjs', kind: 'browser' });
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    await main({ game: 'meta_trial', host: arg('host', 'http://localhost:8000') });
}
