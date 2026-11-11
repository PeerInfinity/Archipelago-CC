#!/usr/bin/env node
/**
 * regenerate-procgen-topdown-presets — the committed `frontend/presets/procgen_topdown/AP_N`
 * presets are byte-equal to a fresh compile of their recipe, or this is red.
 *
 * ── WHY IT EXISTS (slice procgen-topdown-regen, 2026-11-11) ──────────
 *
 * The procgen_topdown presets are compiled from OTHER presets (adventure, apcalc,
 * alttp). Each one copies its source's `world["1"].slot_data`. The APCalc presets
 * were re-exported at 31644f2ecf (2026-11-05), and procgen_topdown AP_4–6, last
 * compiled at 779d2c5801 (10-23), went stale. No gate regenerated procgen_topdown,
 * so nobody noticed. This is that gate: it is enrolled in
 * `scripts/procgen/ci-producer-checks.mjs` by its file name, so it runs in the
 * gating `Producer --checks` CI job.
 *
 * ⛓ It COUPLES procgen_topdown to its source presets on purpose. A red here after
 * re-exporting adventure/apcalc/alttp means: re-run this with `--write` (or the
 * recipe itself) and commit the moved presets with the source change.
 *
 * ── THE RECIPE IS READ, NOT TYPED ────────────────────────────────────
 *
 * The roster and the arguments come from the `# ===== Generating procgen_topdown
 * presets =====` block of `scripts/utils/generated_commands.sh`: every
 * `node scripts/utils/generate-topdown-preset.js … --out frontend/downloads/AP_N_rules.json`
 * line in it. The `register-preset.py … --move` line after each one only moves
 * that file to `frontend/presets/procgen_topdown/AP_N/AP_N_rules.json` and leaves
 * `preset_files.json` alone when the folder is already registered, so this compiles
 * with `--out` pointed at a temp dir and compares against the committed file.
 *
 *   --check (the default)  compile every recipe line into a temp dir and compare
 *                          bytes; `DIFFERS AP_N: …` per stale preset, exit 1.
 *   --write                compile straight into the committed preset paths.
 *   --only=4,5,6           restrict to these seed ids.
 *
 * Run: node scripts/utils/regenerate-procgen-topdown-presets.mjs --check
 *      node scripts/utils/regenerate-procgen-topdown-presets.mjs --write
 *      node scripts/utils/regenerate-procgen-topdown-presets.mjs --check --only=4,5,6
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const RECIPE = 'scripts/utils/generated_commands.sh';
const BLOCK_HEADING = '# ===== Generating procgen_topdown presets =====';
const PRESET_DIR = 'frontend/presets/procgen_topdown';

/**
 * The `generate-topdown-preset.js` lines of the procgen_topdown block, each as
 * `{ id, args }` with `args` the argv after `node`, and `id` the N of its
 * `--out …/AP_N_rules.json`. Throws when the block is missing or empty, so a
 * renamed heading is a red, never a silent zero-row pass.
 */
export function recipeRows(text) {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => l.trim() === BLOCK_HEADING);
    if (start < 0) throw new Error(`no "${BLOCK_HEADING}" block in ${RECIPE}`);
    const rows = [];
    for (const line of lines.slice(start + 1)) {
        if (line.startsWith('# =====')) break;
        const args = line.trim().split(/\s+/);
        if (args[0] !== 'node' || !args[1]?.endsWith('generate-topdown-preset.js')) continue;
        const o = args.indexOf('--out');
        const m = o > 0 ? /(?:^|\/)AP_(\d+)_rules\.json$/.exec(args[o + 1] ?? '') : null;
        if (!m) throw new Error(`recipe line has no --out …/AP_N_rules.json: ${line}`);
        rows.push({ id: m[1], args: args.slice(1), outIndex: o });
    }
    if (rows.length === 0) throw new Error(`the procgen_topdown block of ${RECIPE} has no generator lines`);
    return rows;
}

const presetPath = (id) => join(PRESET_DIR, `AP_${id}`, `AP_${id}_rules.json`);

function main() {
    const argv = process.argv.slice(2);
    if (argv.includes('--help')) {
        console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
        return 0;
    }
    const write = argv.includes('--write');
    const onlyArg = argv.find((a) => a.startsWith('--only='));
    const only = onlyArg ? new Set(onlyArg.slice(7).split(',').filter(Boolean)) : null;

    let rows = recipeRows(readFileSync(join(REPO, RECIPE), 'utf8'));
    if (only) rows = rows.filter((r) => only.has(r.id));
    const tmp = write ? null : mkdtempSync(join(tmpdir(), 'procgen-topdown-check-'));
    let red = 0;
    try {
        for (const r of rows) {
            const dest = write ? join(REPO, presetPath(r.id)) : join(tmp, `AP_${r.id}_rules.json`);
            const args = [...r.args];
            args[r.outIndex] = dest;
            const run = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8' });
            if (run.status !== 0) {
                console.log(`FAIL AP_${r.id}: generate-topdown-preset.js exited ${run.status}`);
                console.log((run.stdout + run.stderr).split('\n').slice(-15).join('\n'));
                red++;
                continue;
            }
            if (write) {
                console.log(`WROTE AP_${r.id}: ${presetPath(r.id)}`);
                continue;
            }
            const committed = join(REPO, presetPath(r.id));
            const same = existsSync(committed)
                && readFileSync(committed).equals(readFileSync(dest));
            if (same) {
                console.log(`OK AP_${r.id}: byte-equal to a fresh compile`);
            } else {
                console.log(`DIFFERS AP_${r.id}: procgen_topdown AP_${r.id} is stale against its `
                    + `source preset; re-run the topdown recipe (generated_commands.sh § procgen_topdown), `
                    + `e.g. node scripts/utils/regenerate-procgen-topdown-presets.mjs --write --only=${r.id}`);
                red++;
            }
        }
    } finally {
        if (tmp) rmSync(tmp, { recursive: true, force: true });
    }
    console.log(`procgen_topdown presets: ${rows.length} ${write ? 'written' : 'checked'}, ${red} red`);
    return red > 0 ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main();
