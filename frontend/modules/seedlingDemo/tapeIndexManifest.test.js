/**
 * tapeIndexManifest — the tape roster the PAGE reads, pinned to the
 * DIRECTORY it claims to describe.
 *
 * `fixtures/tapes/index.json` exists because GitHub Pages emits no
 * directory listing, so `watch.html`'s picker could not enumerate the 153
 * committed tapes on the published site (see
 * `scripts/procgen/generate-tape-index.mjs` for the whole argument).
 *
 * ⛔ THE GENERATOR'S OWN `--check` CANNOT GATE THIS. `--check` regenerates
 * and compares — a *fixed point*, which tests self-consistency and never
 * correctness (trap 250/397): a generator that stopped seeing half the
 * directory would regenerate its own half-answer and report OK forever.
 * So this suite asks the other question, against the filesystem and the
 * tapes rather than against the generator:
 *
 *   1. the manifest's file set is EXACTLY `readdirSync(tapes/)` minus the
 *      manifest itself — neither a tape missing from it nor a row naming a
 *      tape that is gone;
 *   2. every row's fields equal the tape on disk, field by field, INCLUDING
 *      whether `noHazards` is present at all (11 of the 153 tapes have no
 *      such key, and absent is not `[]`).
 *
 * ⚠ (1) is also what stops the manifest from becoming a fixture. It lives
 * IN the directory `fixtureNames()` enumerates, so `fixtures/index.js`
 * excludes it by the shared constant `TAPE_INDEX_FILE` — and if that
 * exclusion ever went away, `fixtureNames()` would report a fixture named
 * `index` and the set comparison below would name it.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { TAPES_DIR, TAPE_INDEX_FILE, fixtureNames } from './fixtures/index.js';

const manifest = JSON.parse(readFileSync(join(TAPES_DIR, TAPE_INDEX_FILE), 'utf8'));

describe('the tape manifest the picker reads', () => {
    it('names exactly the tapes in the directory — nothing missing, nothing invented', () => {
        const onDisk = readdirSync(TAPES_DIR)
            .filter((f) => f.endsWith('.json') && f !== TAPE_INDEX_FILE)
            .sort();
        expect(manifest.tapes.map((r) => r.file)).toEqual(onDisk);
    });

    it('does not make itself a fixture', () => {
        expect(fixtureNames()).not.toContain(TAPE_INDEX_FILE.replace(/\.json$/, ''));
        expect(fixtureNames().length).toBe(manifest.tapes.length);
    });

    it('points at the directory it actually indexes', () => {
        expect(manifest.dir).toBe('frontend/modules/seedlingDemo/fixtures/tapes');
    });

    it.each(manifest.tapes.map((r) => [r.file, r]))(
        '%s — every field equals the tape on disk',
        (file, row) => {
            const tape = JSON.parse(readFileSync(join(TAPES_DIR, file), 'utf8'));
            expect(row.tickCount).toBe(tape.tick_count ?? null);
            expect(row.bootLevel).toBe(tape.boot?.level ?? null);
            expect(row.tapeVersion).toBe(tape.tape_version ?? null);
            // Presence, not just value: `'noHazards' in row` and
            // `'noHazards' in tape` have to agree.
            expect('noHazards' in row).toBe(tape.noHazards !== undefined);
            if (tape.noHazards !== undefined) expect(row.noHazards).toEqual(tape.noHazards);
        },
    );
});
