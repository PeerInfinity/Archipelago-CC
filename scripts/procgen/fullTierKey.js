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
 *     listed), the workflow file and `package-lock.json` (the browser build);
 *   · ⛓ AND `check-seedling-full-tier-owed`'s populations that the above
 *     misses: the wasm GITLINK (i) and the dead-frame accounting files (iv),
 *     derived the way that gate derives them. A harvest QUOTES the reused run
 *     into the bank's roster row, and that gate then judges the row against
 *     the reused run's SHA — so a key that matched while one of its
 *     populations moved would leave the gate red with no drive allowed;
 *   · ⛓⛓ and, for the RE-STAMP (⚖ user 2026-10-17, *"Yes, if possible."*),
 *     the two things that gate reads which the above still missed: EVERY
 *     tape NAME, not just the tier's (a deleted tape is charged to every
 *     category, its own or not), and that gate's OWN source (the populations
 *     it asks about). With both in, a key match at a head means no
 *     population the owed gate reads moved since the reused run, so
 *     `record-standing-value --reused-run=` may stamp the part AT THE HEAD
 *     (`reuseVerdict` below is that decision).
 *
 * ⛔ IT IS DELIBERATELY WIDER than `check-seedling-full-tier-owed`'s four
 * populations, which the review proposed: that gate prices the BOX row and
 * leaves the model out, while the differential's own resume key says *"the
 * model, all of it, because which module a check depends on is not answerable
 * statically and a wrong answer here is a false green"*. A key that is too
 * wide costs a re-drive; one that is too narrow quotes a run about another tree.
 */

import { execFileSync } from 'node:child_process';
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
    /** ⛓ The asker: a population added there must move the key (the re-stamp). */
    'scripts/procgen/check-seedling-full-tier-owed.mjs',
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
 *          roster: string[], files: {path: string, bytes: Buffer|string}[]}} o
 *   `roster` is EVERY tape name in the tree, the tier's or not.
 */
export function tierKey({ tier, fingerprint, tapes, roster, files }) {
    const h = createHash('sha256');
    h.update(`tier:${tier}\0fingerprint:${fingerprint}\0`);
    h.update(`roster:${[...roster].sort().join(',')}\0`);
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

const git = (repo, ...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();

/** ⛓ The owed gate's token, spelt in two halves so this file is not itself in (iv). */
const DEAD_FRAME_TOKEN = ['BOOT_PRESWAP', 'FRAMES'].join('_');
export const WASM_SUBMODULE = 'frontend/modules/flashPanel/wasm';

/**
 * (iv) — the dead-frame accounting population, by `check-seedling-full-tier-
 * owed`'s own rule: code files naming the token, minus tests, the bank and
 * that gate. `fullTierKey.test.js` compares this with the list the gate prints.
 */
export function deadFrameFiles(repo) {
    return git(repo, 'grep', '-l', '--', DEAD_FRAME_TOKEN).split('\n').filter(Boolean)
        .filter((f) => /\.(?:js|mjs|py|json)$/.test(f))
        .filter((f) => !f.endsWith('.test.js') && f !== 'scripts/procgen/standing-values.json'
            && f !== 'scripts/procgen/check-seedling-full-tier-owed.mjs')
        .sort();
}

/** The key at this tree: the closure from `entry`, (iv), `KEY_EXTRA_FILES`, the gitlink. */
export function tierKeyAt({ repo, entry, tier, fingerprint, tapes, roster }) {
    const paths = [...new Set([...importClosure(entry, { repo }), ...deadFrameFiles(repo),
        ...KEY_EXTRA_FILES])];
    const files = paths.map((path) => ({ path, bytes: readFileSync(resolve(repo, path)) }));
    /** (i) — the gitlink the TREE records, not what is checked out under it. */
    files.push({ path: `gitlink:${WASM_SUBMODULE}`, bytes: git(repo, 'rev-parse', `HEAD:${WASM_SUBMODULE}`) });
    return { key: tierKey({ tier, fingerprint, tapes, roster, files }), files: files.length };
}

/**
 * ⛓⛓ THE RE-STAMP'S DECISION (⚖ user 2026-10-17) — may a part of the
 * checkpoint row be stamped AT `head` from `run`, which measured nothing new
 * there? Pure: the caller fetches the run and its artifacts and computes the
 * keys at the head, one per tier that holds `category` (the category's own
 * tier and `full`).
 *
 * ⛔ Every "no" is a refusal BY NAME, and none of them falls back to stamping
 * the run's own SHA: that is the plain `--quote` path, and a caller who wants
 * it can say so.
 *
 * @param {{run: {id: number, path?: string, conclusion?: string, head_sha?: string},
 *          artifacts: {name: string, expired?: boolean}[],
 *          keysAtHead: Record<string, string|null>}} o
 * @returns {{ok: true, tier: string, key: string} | {ok: false, problem: string}}
 */
export function reuseVerdict({ run, artifacts, keysAtHead }) {
    if (run.path && !run.path.endsWith('seedling-full-tier.yml')) {
        return { ok: false, problem: `run ${run.id} is ${run.path}, not a full-tier run` };
    }
    if (run.conclusion !== 'success') {
        return { ok: false, problem: `run ${run.id} concluded ${run.conclusion ?? 'nothing'} — `
            + 'only a GREEN tier is quotable' };
    }
    const keys = artifacts.filter((a) => !a.expired && a.name.startsWith(KEY_ARTIFACT_PREFIX))
        .map((a) => a.name.slice(KEY_ARTIFACT_PREFIX.length));
    if (!keys.length) {
        return { ok: false, problem: `run ${run.id} carries no unexpired ${KEY_ARTIFACT_PREFIX}* `
            + 'artifact. ⛓ A run that said REUSED measured nothing — pass the run it NAMED' };
    }
    const hit = Object.entries(keysAtHead).find(([, k]) => k && keys.includes(k));
    if (!hit) {
        return { ok: false, problem: `the inputs MOVED since run ${run.id}: it measured key `
            + `${keys.join('/')}, and this head's keys are ${Object.entries(keysAtHead)
                .map(([t, k]) => `${t}=${k ?? '(none)'}`).join(', ')} — drive the tier` };
    }
    return { ok: true, tier: hit[0], key: hit[1] };
}
