/**
 * Where a `scripts/test/generate-*-preset.mjs` writer puts its rules.json.
 *
 * ⛓ WHY THIS EXISTS: a preset writer that can only write into
 * `frontend/presets/` cannot be MEASURED without performing the re-record it
 * is being measured for. Regenerating a committed preset in place destroys the
 * before-side of the diff, so "did this code change move the fixture's bytes?"
 * becomes unanswerable — which is exactly the question the byte-inertness
 * claims in these writers' own headers assert an answer to. `--out-dir` gives
 * the writer a scratch destination so the diff can be taken first and the
 * re-record decided afterwards.
 *
 * The layout under the base is unchanged, so a scratch tree is a drop-in for
 * `frontend/presets/`:  <base>/<gameId>/<seedId>/<seedId>_rules.json
 *
 * Accepts both `--out-dir=DIR` and `--out-dir DIR`; a relative DIR resolves
 * against the process's cwd, not against the repo root, because it names a
 * place the CALLER picked.
 */

import path from 'node:path';

/** One line for a writer's own `--help`/usage text. */
export const OUT_DIR_USAGE =
    '  --out-dir DIR   write under DIR/<game_id>/<seed_id>/ instead of '
    + 'frontend/presets/ (for measuring a regeneration without performing it)';

/**
 * @param {Object}   args
 * @param {string}   args.repoRoot — absolute path to the repository root
 * @param {string}   args.gameId   — the preset's game id (directory name)
 * @param {string}   args.seedId   — the AP seed id (inner directory name)
 * @param {string[]} [args.argv=process.argv.slice(2)]
 * @returns {{ outDir: string, base: string, isDefault: boolean }}
 */
export function resolvePresetOutDir({ repoRoot, gameId, seedId, argv = process.argv.slice(2) }) {
    const defaultBase = path.join(repoRoot, 'frontend/presets');
    let base = null;

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--out-dir') {
            base = argv[i + 1];
            if (base === undefined || base.startsWith('--')) {
                throw new Error('--out-dir needs a directory argument');
            }
            i++;
        } else if (a.startsWith('--out-dir=')) {
            base = a.slice('--out-dir='.length);
            if (!base) throw new Error('--out-dir needs a directory argument');
        }
    }

    const resolved = base === null ? defaultBase : path.resolve(base);
    return {
        outDir: path.join(resolved, gameId, seedId),
        base: resolved,
        isDefault: base === null,
    };
}
