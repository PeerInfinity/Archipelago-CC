#!/usr/bin/env node
/**
 * census-seedling-committed-rooms — WHAT IS STANDING IN EVERY COMMITTED ROOM.
 *
 * Procgen PoC slice 4c (kickoff §14.1). A REPORT-ONLY instrument: it asserts
 * nothing and gates nothing. It answers the question every kill-arm, enemy-
 * template or danger-map slice has to answer before it can predict a gate —
 * *which committed rooms hold the family I am about to teach the model, and
 * does any of them also hold the thing that family's death would move?*
 *
 * ── ⛓ THE POPULATION IS DERIVED, NEVER TYPED ──────────────────────────
 *
 * The row list is every `*.json` in `fixtures/tapes/`, read off the
 * directory. A hand-typed roster is trap 89 / trap 199's shape: it ages
 * silently as tapes are added, and the ONE room a new tape introduces is
 * exactly the room a prediction built on the old list would miss. Slice 4c's
 * own recon nearly paid this — the charge asked for "battery rooms + r8-d2
 * rooms" and the sharpest case in the repo (L5: three bobs AND a kill-lock)
 * is in NEITHER of those two sets.
 *
 * ── ⚠ THE BOUNDS, NAMED ───────────────────────────────────────────────
 *
 *  · It reports what a room CONTAINS AT ITS BOOT, from the tape's own staging
 *    (`solveStaging(stagingFromTape(...))`, the same construction the battery
 *    solves from). It says nothing about what a WALK does to the room.
 *  · A tape whose run cannot be built is REPORTED as such, never skipped —
 *    "the room holds no bobs" and "nobody could look" print the same thing
 *    otherwise (the `IceTurret` arm's own law, `enemyDamage.js:456ff`).
 *  · `killLocks` counts `tset == -1` activator rows (`combat.KILL_LOCK_TSET`),
 *    which is what `checkEnemies()` opens on `totalEnemies() == 0` — i.e. the
 *    consequence every `KILL_ARM_POLICY` refusal is written about.
 *  · `spinnerBodies` is reported because it is `derivePressKill`'s FIRST gate
 *    (`solverBot.js:2432`), strictly upstream of the policy table: a room with
 *    zero of them cannot reach a `KILL_ARM_POLICY` check at all.
 *
 * Run:
 *   node scripts/procgen/census-seedling-committed-rooms.mjs
 *   node scripts/procgen/census-seedling-committed-rooms.mjs --tag=bob,sandtrap
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const TAPES = join(REPO, 'frontend', 'modules', 'seedlingDemo', 'fixtures', 'tapes');

const only = (process.argv.find((a) => a.startsWith('--tag=')) ?? '').slice(6);
const WANTED = only ? new Set(only.split(',').filter(Boolean)) : null;

const { parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { atlasLevelSource } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/levelSource.js'));
const { createRunForStaging, solveStaging, stagingFromTape } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/tapeRunner.js'));
const { KILL_LOCK_TSET } = await import(join(REPO, 'frontend/modules/seedlingDemo/combat.js'));

const levelSource = atlasLevelSource();
const names = readdirSync(TAPES).filter((f) => f.endsWith('.json')).sort();

console.log(`## census over ${names.length} committed tape(s) in fixtures/tapes/ `
    + '(the population is the DIRECTORY, not a typed list)');
if (WANTED) console.log(`## filtered to rooms holding [${[...WANTED].join(', ')}]`);

const rows = [];
const unreadable = [];
for (const file of names) {
    const name = file.replace(/\.json$/, '');
    let run;
    let level = null;
    try {
        const tape = parseTape(JSON.parse(readFileSync(join(TAPES, file), 'utf8')));
        level = tape.boot?.level ?? null;
        run = createRunForStaging(solveStaging(stagingFromTape(tape)), levelSource);
    } catch (e) {
        // ⛔ REPORTED, NOT SKIPPED — see the bounds above.
        unreadable.push({ name, level, why: e.message.split('\n')[0].slice(0, 100) });
        continue;
    }
    const byTag = {};
    for (const e of run.world.combat?.enemies ?? []) byTag[e.tag] = (byTag[e.tag] ?? 0) + 1;
    rows.push({
        name,
        level,
        byTag,
        killLocks: (run.world.activators ?? []).filter((a) => a.t === KILL_LOCK_TSET).length,
        spinnerBodies: (run.spinnerBodies ?? []).length,
    });
}

const shown = WANTED
    ? rows.filter((r) => Object.keys(r.byTag).some((t) => WANTED.has(t)))
    : rows;

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${pad('tape', 26)} ${pad('lvl', 4)} ${pad('enemies', 34)} `
    + `${pad('killLocks', 10)} spinnerBodies`);
for (const r of shown) {
    const enemies = Object.entries(r.byTag).map(([t, n]) => `${t}:${n}`).join(' ') || '—';
    console.log(`${pad(r.name, 26)} ${pad(r.level ?? '?', 4)} ${pad(enemies, 34)} `
        + `${pad(r.killLocks, 10)} ${r.spinnerBodies}`);
}
if (shown.length === 0) console.log('  (none)');

if (unreadable.length > 0) {
    console.log(`\n## ${unreadable.length} tape(s) whose run could NOT be built — `
        + 'reported rather than skipped');
    for (const u of unreadable) console.log(`  ${pad(u.name, 26)} ${pad(u.level ?? '?', 4)} ${u.why}`);
}

// ── the two joins a kill-arm slice actually needs ─────────────────────
const withLock = shown.filter((r) => r.killLocks > 0);
console.log(`\n## of the ${shown.length} room(s) listed, ${withLock.length} also hold a `
    + `\`tset == -1\` lock — the consequence every KILL_ARM_POLICY refusal is written `
    + `about: [${withLock.map((r) => `${r.name}(L${r.level})`).join(', ') || 'none'}]`);
const reachable = rows.filter((r) => r.spinnerBodies > 0);
console.log(`## ${reachable.length} committed room(s) have a non-empty \`run.spinnerBodies\`, `
    + `which is \`derivePressKill\`'s FIRST gate: `
    + `[${reachable.map((r) => `${r.name}(L${r.level})`).join(', ') || 'none'}]`);
console.log('## ⚠ a room outside that second list cannot reach a `KILL_ARM_POLICY` check '
    + 'at all (solverBot.js:2432 returns above the policy read at :2451).');
