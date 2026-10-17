/**
 * fullTierKey — **ONE KEY FOR "EVERYTHING A TIER'S VERDICT IS A FUNCTION OF"**
 * (ci-skip-rules RULE 3, ⚖ user 2026-10-17).
 *
 * `seedling-full-tier.yml` replays a tier and compares the game with the
 * committed streams. `ci-skip-review` §3 R3 measured 27 of 53 green full-tier
 * runs (3,604 job-min in 7 days) where no input of the tier had moved since an
 * earlier green run. So the plan job asks for this key, and a green run that
 * already measured the SAME key is QUOTED instead of re-driven.
 *
 * ⛓ WHAT THE KEY COVERS, AND WHY IT IS THE DIFFERENTIAL'S OWN NOTION:
 *
 *   · the differential's `FINGERPRINT` — its own `--resume` key: the checker's
 *     source, the Windows driver, every `.js` under `seedlingDemo/` and its
 *     `fixtures/`, the atlas, the wasm page's BYTES, the page name, the
 *     channel. A stored PASS is reused only under it, so a tier is too;
 *   · every tape's `tapeFingerprint` in the tier (its bytes + its expectation);
 *   · the tier name;
 *   · and what the fingerprint does NOT read: the differential's import
 *     closure outside `seedlingDemo/` (the headless channel, the shard
 *     partition, `flashPanel/` helpers — DERIVED by walking the imports, never
 *     listed), the workflow file and `package-lock.json` (the browser build).
 *
 * ⛔ IT IS DELIBERATELY WIDER than `check-seedling-full-tier-owed`'s four
 * populations, which the review proposed: that gate prices the BOX row and
 * leaves the model out, while the differential's own resume key says *"the
 * model, all of it, because which module a check depends on is not answerable
 * statically and a wrong answer here is a false green"*. A key that is too
 * wide costs a re-drive; one that is too narrow quotes a run about another tree.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { maskComments } from './maskComments.js';

/** The artifact a GREEN tier uploads, and the plan job looks up by name. */
export const KEY_ARTIFACT_PREFIX = 'seedling-full-tier-key-';
export const keyArtifactName = (key) => `${KEY_ARTIFACT_PREFIX}${key}`;

/** The files outside the import graph that the tier's verdict still reads. */
export const KEY_EXTRA_FILES = Object.freeze([
    '.github/workflows/seedling-full-tier.yml',
    'package-lock.json',
]);

const STATIC_RE = /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)|^\s*import\s*['"](\.[^'"]+)['"]/gm;
/** ⛓ The differential's own dynamic form: `import(join(REPO|HERE, '<path>'))`. */
const JOIN_RE = /import\(\s*join\(\s*(REPO|HERE)\s*,\s*'([^']+)'\s*\)\s*\)/g;

/**
 * Every repo file reachable from `entry` through RELATIVE imports, the
 * `join(REPO|HERE, '…')` dynamic form included. Comments are masked first, so
 * an import written in a docblock is not followed. Bare specifiers (packages)
 * are `package-lock.json`'s business.
 *
 * @returns {string[]} repo-relative paths, sorted
 */
export function importClosure(entry, { repo }) {
    const seen = new Set();
    const walk = (file) => {
        if (seen.has(file)) return;
        seen.add(file);
        const src = maskComments(readFileSync(file, 'utf8'));
        const next = [];
        for (const m of src.matchAll(STATIC_RE)) next.push(resolve(dirname(file), m[1] ?? m[2] ?? m[3]));
        for (const m of src.matchAll(JOIN_RE)) {
            next.push(resolve(m[1] === 'REPO' ? repo : dirname(file), m[2]));
        }
        for (const p of next) {
            if (!existsSync(p)) throw new Error(`${relative(repo, file)} imports ${relative(repo, p)}, which is not on disk`);
            walk(p);
        }
    };
    walk(resolve(entry));
    return [...seen].map((f) => relative(repo, f)).sort();
}

/**
 * The key. Pure over its inputs (the caller reads the files), so its edges can
 * be asked without a tree.
 *
 * @param {{tier: string, fingerprint: string, tapes: {name: string, fp: string}[],
 *          files: {path: string, bytes: Buffer|string}[]}} o
 */
export function tierKey({ tier, fingerprint, tapes, files }) {
    const h = createHash('sha256');
    h.update(`tier:${tier}\0fingerprint:${fingerprint}\0`);
    for (const t of [...tapes].sort((a, b) => a.name.localeCompare(b.name))) {
        h.update(`tape:${t.name}@${t.fp}\0`);
    }
    for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
        h.update(`file:${f.path}\0`);
        h.update(f.bytes);
        h.update('\0');
    }
    return h.digest('hex').slice(0, 16);
}

/** The key at this tree: the closure from `entry` plus `KEY_EXTRA_FILES`. */
export function tierKeyAt({ repo, entry, tier, fingerprint, tapes }) {
    const paths = [...new Set([...importClosure(entry, { repo }), ...KEY_EXTRA_FILES])];
    const files = paths.map((path) => ({ path, bytes: readFileSync(resolve(repo, path)) }));
    return { key: tierKey({ tier, fingerprint, tapes, files }), files: paths.length };
}
