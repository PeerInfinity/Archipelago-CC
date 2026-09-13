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
import { existsSync, readFileSync } from 'node:fs';
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
