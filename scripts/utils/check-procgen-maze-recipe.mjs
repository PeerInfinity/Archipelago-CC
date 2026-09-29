#!/usr/bin/env node
/**
 * Does the procgen_maze recipe still produce the committed procgen_maze presets?
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
 * Usage:
 *   node scripts/utils/check-procgen-maze-recipe.mjs              # every preset in the section
 *   node scripts/utils/check-procgen-maze-recipe.mjs --seeds 1,2  # only these seed ids
 *   node scripts/utils/check-procgen-maze-recipe.mjs --keep       # keep the temp dir and print it
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATES_SH = 'scripts/utils/generate_all_templates.sh';
const SECTION = 'Generating procgen_maze presets';
const WRITER = 'scripts/utils/generate-procgen-rules.js';
const REGISTER = 'scripts/utils/register-preset.py';

function parseCli(argv) {
    const opts = { seeds: null, keep: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '-h' || a === '--help') {
            const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf-8');
            console.log(src.slice(src.indexOf('/**') + 3, src.indexOf(' */'))
                .split('\n').map((l) => l.replace(/^ \* ?/, '')).join('\n').trim());
            process.exit(0);
        } else if (a === '--keep') {
            opts.keep = true;
        } else if (a === '--seeds') {
            const v = argv[++i];
            if (!v) throw new Error('--seeds requires a value, e.g. --seeds 1,2');
            opts.seeds = new Set(v.split(',').map((s) => s.trim()).filter(Boolean));
        } else {
            throw new Error(`Unknown argument: ${a}`);
        }
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
    const opts = parseCli(process.argv.slice(2));
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
                console.log(`FAIL: ${e.committed}: the writer exited ${run.status}\n${run.stderr}`);
                continue;
            }
            const committedPath = path.join(REPO, e.committed);
            const want = fs.readFileSync(committedPath);
            const got = fs.readFileSync(out);
            if (want.equals(got)) {
                console.log(`PASS: ${e.committed} reproduces byte-for-byte`);
                continue;
            }
            failures++;
            console.log(`FAIL: ${e.committed} differs from the recipe's output (${numstat(committedPath, out)})`);
            for (const l of shapeOf(JSON.parse(want), JSON.parse(got))) console.log(`      ${l}`);
        }
    } finally {
        if (opts.keep) console.log(`kept: ${tmp}`);
        else fs.rmSync(tmp, { recursive: true, force: true });
    }
    console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
    if (failures) {
        console.log('A differing preset means the recipe (or the engine under it) no longer makes the committed file:'
            + ' either the change is unintended, or the preset is due a re-record from this recipe.');
    }
    process.exit(failures ? 1 : 0);
}

try {
    main();
} catch (err) {
    console.log(`FAIL: fatal: ${err.message}`);
    console.log('1 CHECK(S) FAILED');
    process.exit(1);
}
