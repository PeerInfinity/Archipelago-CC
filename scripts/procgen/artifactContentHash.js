/**
 * artifactContentHash — **THE GAME SIDE OF A CHECKPOINT FINGERPRINT, BY
 * CONTENT** (slice seedling-headless-H3).
 *
 * `check-seedling-bot-differential.mjs` files every tape's verdict under a
 * fingerprint, and a `--resume` reuses a stored PASS only when it matches.
 * The game side of that fingerprint used to be each artifact file's
 * `size:mtimeMs`. ⛔ An mtime is a property of the HOST, not of the game:
 * `actions/checkout` stamps every file with the checkout time, so the sharded
 * CI tier's shard jobs — same SHA, same bytes — would each bank a different
 * fingerprint, and the merge job's `--resume` would reuse none of them.
 *
 * ⇒ the bytes. Same bytes are the same game on any host; any rebuild still
 * invalidates. `artifactContentHash.test.js` drives both directions (a touch
 * moves nothing; one flipped byte moves the hash).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Feed `files` (names under `dir`) into `hash` by name AND content. An absent
 * file contributes nothing — the caller's own existence check decides whether
 * an absent artifact is a SKIP.
 */
export function updateWithArtifactFiles(hash, dir, files) {
    for (const f of files) {
        const p = join(dir, f);
        if (!existsSync(p)) continue;
        hash.update(`${f}:`);
        hash.update(readFileSync(p));
    }
    return hash;
}

/**
 * ⛓ F1 (2026-09-13) — **A MODULE DIRECTORY, BY NAME AND CONTENT.** Every
 * `.js` directly in `dir`, sorted, each fed as `<prefix><name>` then its bytes
 * — the differential's model half. The top-level `seedlingDemo/` pass uses no
 * prefix, so its bytes into the hash are what they were; `fixtures/` (tier and
 * roster definitions, the expectation loader) was outside the fingerprint
 * until F1 and joins it under the `fixtures/` prefix, so a same-named file in
 * the two directories can never alias.
 */
export function updateWithModuleDir(hash, dir, { prefix = '' } = {}) {
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.js')).sort()) {
        hash.update(`${prefix}${f}`);
        hash.update(readFileSync(join(dir, f)));
    }
    return hash;
}
