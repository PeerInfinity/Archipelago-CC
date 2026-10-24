#!/usr/bin/env node
/**
 * check-procgen-maze-recipe — **DOES THE procgen_maze RECIPE STILL PRODUCE THE
 * COMMITTED procgen_maze PRESETS, BYTE FOR BYTE?**
 *
 * The recipe is the `procgen_maze` section of `generate_all_templates.sh`
 * (APWORLD SUBSTRATE CHANGE PM1, §44). This check renders that script in its
 * own `--script` mode — the same rendering the Generate Presets workflow commits
 * as `generated_commands.sh` — takes the section's writer commands exactly as
 * rendered, points each one's `--out` into a temp dir, runs it, and compares the
 * bytes with the committed file its `register-preset.py` line would replace
 * (`frontend/presets/<game-id>/AP_<seed-id>/AP_<seed-id>_rules.json`). Nothing
 * in this file names a seed, a grid or an item: the commands come from the
 * script, the expectation from the committed files.
 *
 * A difference is reported by SHAPE — the top-level keys that differ, the
 * regions added/removed/changed, the location count on each side — so a red
 * says what moved, not only that something did. Exit 1 on any difference.
 *
 * Nothing in the tree is written (the temp dir is removed on exit).
 *
 * ⛓ ENROLLED (C2, 2026-09-28). PM1 wrote this beside the writer in
 * `scripts/utils/` on purpose: AP_3 was red BY DESIGN until its re-record on
 * C1's fixpoint placer, and a `check-*.mjs` in `scripts/procgen/` is a gate by
 * its filename alone (`gateRoster.isGateFile`). C2 re-recorded AP_3 from this
 * recipe (156/101, predicted then asserted), all three presets passed, and the
 * file moved here — so it now runs wherever the roster runs: the headless CI
 * step (`ci-gates.mjs`, job `headless-gates`), `gates.mjs`, the standing bank
 * and the generated instruments index. Its verdict lines are `gateTotal`'s.
 * A red here means a release would re-record a preset: the engine or the
 * recipe moved, so either the change is unintended or the preset is due its
 * re-record from this recipe (the two lines of the section, as rendered).
 *
 * ⛓ ITS INPUT KEY IS DECLARED, because derivation sees none of it: the writer
 * is spawned through a constant (`WRITER`), the recipe is a `.sh` rendered at
 * run time, and the committed files are a path built from its lines. Measured
 * at enrolment: the derived key covered 2 code files and 0 data/spawn — an
 * engine change would have been QUOTED green (rowInputKey's "stale green").
 * The writer imports its modules through `path.join` too, so its two in-tree
 * ones are named as spawn seeds and their closures (the grid-growth engine,
 * the maze placer: 155 members, and the `shared` gitlink) ride in behind
 * them. Mutant: a byte appended to `mazeRoomEngine.js` moves the key.
 *
 * @key-inputs spawn: scripts/utils/generate-procgen-rules.js frontend/modules/procgenPipeline/procgenPipelineEngine.js frontend/modules/mazeRoom/mazeRoomLibrary.js
 * @key-inputs data: scripts/utils/generate_all_templates.sh frontend/presets/procgen_maze/**
 *
 * Usage:
 *   node scripts/procgen/check-procgen-maze-recipe.mjs              # every preset in the section
 *   node scripts/procgen/check-procgen-maze-recipe.mjs --seeds 1,2  # only these seed ids
 *   node scripts/procgen/check-procgen-maze-recipe.mjs --keep       # keep the temp dir and print it
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { checkLine, totalLine } from './gateTotal.js';

argvHelp(import.meta.url);

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATES_SH = 'scripts/utils/generate_all_templates.sh';
const SECTION = 'Generating procgen_maze presets';
const WRITER = 'scripts/utils/generate-procgen-rules.js';
const REGISTER = 'scripts/utils/register-preset.py';

const KNOWN_FLAGS = new Set(['--seeds', '--keep']);
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const arg = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
};

function parseCli() {
    const unknown = argv.filter((a, i) => a.startsWith('-') && !KNOWN_FLAGS.has(a) && argv[i - 1] !== '--seeds');
    if (unknown.length) throw new Error(`Unknown argument: ${unknown[0]}`);
    const opts = { seeds: null, keep: flag('keep') };
    if (flag('seeds')) {
        const v = arg('seeds');
        if (!v) throw new Error('--seeds requires a value, e.g. --seeds 1,2');
        opts.seeds = new Set(v.split(',').map((x) => x.trim()).filter(Boolean));
    }
    return opts;
}

/** Split one rendered command line the way `_fmt` quoted it (double quotes around args with spaces). */
function tokens(line) {
    return [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);
}

const flagValue = (argv, flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
};

/** The section's (writer argv, committed path) pairs, from the script's own rendering. */
function recipe(tmp) {
    const rendered = path.join(tmp, 'generated_commands.sh');
    execFileSync('bash', [TEMPLATES_SH, '--script', rendered], {
        cwd: REPO, stdio: ['ignore', 'ignore', 'inherit'],
        env: { ...process.env, GENERATE_MAZE_PRESETS: 'true' },
    });
    const lines = fs.readFileSync(rendered, 'utf-8').split('\n');
    const start = lines.indexOf(`# ===== ${SECTION} =====`);
    if (start < 0) throw new Error(`${TEMPLATES_SH} rendered no '${SECTION}' section`);
    const end = lines.findIndex((l, i) => i > start && l.startsWith('# ===== '));
    const body = lines.slice(start + 1, end < 0 ? undefined : end).filter((l) => l.trim());

    const writes = new Map();   // staged path → writer argv
    const entries = [];
    for (const line of body) {
        const t = tokens(line);
        if (t[0] === 'node' && t[1] === WRITER) {
            writes.set(flagValue(t, '--out'), t.slice(2));
        } else if (t[0] === 'python' && t[1] === REGISTER) {
            const staged = t[2];
            const gameId = flagValue(t, '--game-id');
            const seedId = flagValue(t, '--seed-id');
            if (!writes.has(staged)) throw new Error(`register line with no writer for ${staged}`);
            entries.push({
                seedId,
                argv: writes.get(staged),
                committed: `frontend/presets/${gameId}/AP_${seedId}/AP_${seedId}_rules.json`,
            });
        } else {
            throw new Error(`unexpected line in the '${SECTION}' section: ${line}`);
        }
    }
    if (entries.length === 0) throw new Error(`the '${SECTION}' section registers nothing`);
    return entries;
}

const locationCount = (doc) => Object.values(doc.regions ?? {})
    .flatMap((byName) => Object.values(byName))
    .reduce((n, r) => n + (r.locations?.length ?? 0), 0);

/** What moved, by shape: top-level keys, then regions per player. */
function shapeOf(committed, produced) {
    const out = [];
    const keys = new Set([...Object.keys(committed), ...Object.keys(produced)]);
    const differing = [...keys].filter((k) => JSON.stringify(committed[k]) !== JSON.stringify(produced[k]));
    out.push(`top-level keys that differ: ${differing.join(', ') || '(none — whitespace/order only)'}`);
    for (const player of Object.keys({ ...committed.regions, ...produced.regions })) {
        const a = committed.regions?.[player] ?? {};
        const b = produced.regions?.[player] ?? {};
        const added = Object.keys(b).filter((r) => !(r in a));
        const removed = Object.keys(a).filter((r) => !(r in b));
        const changed = Object.keys(a).filter((r) => r in b && JSON.stringify(a[r]) !== JSON.stringify(b[r]));
        if (added.length || removed.length || changed.length) {
            out.push(`player ${player} regions: +[${added.join(', ')}] -[${removed.join(', ')}] changed [${changed.join(', ')}]`);
        }
    }
    out.push(`locations: committed ${locationCount(committed)}, produced ${locationCount(produced)}`);
    return out;
}

function numstat(a, b) {
    const r = spawnSync('git', ['diff', '--no-index', '--numstat', a, b], { encoding: 'utf-8' });
    const [add, del] = (r.stdout.trim().split('\n')[0] || '').split('\t');
    return `${add ?? '?'} insertions, ${del ?? '?'} deletions`;
}

function main() {
    const opts = parseCli();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'procgen-maze-recipe-'));
    let failures = 0;
    try {
        const entries = recipe(tmp).filter((e) => !opts.seeds || opts.seeds.has(e.seedId));
        if (opts.seeds) {
            const missing = [...opts.seeds].filter((s) => !entries.some((e) => e.seedId === s));
            if (missing.length) throw new Error(`--seeds names ids the section does not register: ${missing.join(', ')}`);
        }
        for (const e of entries) {
            const out = path.join(tmp, `AP_${e.seedId}_rules.json`);
            const argv = [...e.argv];
            argv[argv.indexOf('--out') + 1] = out;
            const run = spawnSync(process.execPath, [WRITER, ...argv], { cwd: REPO, encoding: 'utf-8' });
            if (run.status !== 0) {
                failures++;
                console.log(checkLine(false, `${e.committed}: the writer exited ${run.status}\n${run.stderr}`));
                continue;
            }
            const committedPath = path.join(REPO, e.committed);
            const want = fs.readFileSync(committedPath);
            const got = fs.readFileSync(out);
            if (want.equals(got)) {
                console.log(checkLine(true, `${e.committed} reproduces byte-for-byte`));
                continue;
            }
            failures++;
            console.log(checkLine(false, `${e.committed} differs from the recipe's output (${numstat(committedPath, out)})`));
            for (const l of shapeOf(JSON.parse(want), JSON.parse(got))) console.log(`      ${l}`);
        }
    } finally {
        if (opts.keep) console.log(`kept: ${tmp}`);
        else fs.rmSync(tmp, { recursive: true, force: true });
    }
    console.log(totalLine(failures));
    if (failures) {
        console.log('A differing preset means the recipe (or the engine under it) no longer makes the committed file:'
            + ' either the change is unintended, or the preset is due a re-record from this recipe.');
    }
    process.exit(failures ? 1 : 0);
}

if (isEntryPoint(import.meta.url)) {
    try {
        main();
    } catch (err) {
        console.log(checkLine(false, `fatal: ${err.message}`));
        console.log(totalLine(1));
        process.exit(1);
    }
}
