/**
 * The committed profile witness (engine prep A3, D4) against today's
 * `PROFILE`. ⛔ This NEVER re-measures: the witness is a one-off measurement
 * recorded as data (⚖ Q3). What it guards is that the record still describes
 * the profile — a key added without a witness row is RED, and the fix is to
 * run the witness, not to edit the JSON.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PROFILE, PROFILE_FIELDS } from '../../frontend/modules/seedlingDemo/seedlingProfile.js';
import { MAGNITUDES, VERDICTS, WITNESS_JSON, checkWitness, verdictOf } from './witness-seedling-profile.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const JSON_TEXT = readFileSync(join(REPO, WITNESS_JSON), 'utf8');
const W = JSON.parse(JSON_TEXT);
const KEYS = Object.keys(PROFILE);

describe('seedling-profile-witnesses.json — the witness record names today\'s profile', () => {
    it('names EXACTLY PROFILE\'s keys — a new key without a witness row is RED: run the witness', () => {
        const problems = checkWitness(W, KEYS, PROFILE_FIELDS);
        expect(problems, 'node scripts/procgen/witness-seedling-profile.mjs --write').toEqual([]);
        expect(Object.keys(W.keys).sort()).toEqual([...KEYS].sort());
    });

    it('every verdict is one of the two, and follows from its counts', () => {
        for (const [k, row] of Object.entries(W.keys)) {
            expect(VERDICTS, k).toContain(row.verdict);
            expect(row.verdict, k).toBe(verdictOf(row));
            for (const m of MAGNITUDES) expect(row[m].moved + row[m].threw + row[m].same, `${k}.${m}`).toBe(W.tapes.length);
        }
    });

    it('the control moved nothing', () => {
        expect(W.control.moved).toBe(0);
        expect(W.control.runs).toBe(2);
    });

    it('`--check` agrees', () => {
        const r = spawnSync(process.execPath, [join(REPO, 'scripts/procgen/witness-seedling-profile.mjs'), '--check'],
            { cwd: REPO, encoding: 'utf8' });
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain(`PASS — ${WITNESS_JSON} names all ${KEYS.length} keys`);
    });

    it('mutants, in memory: a deleted row and an unwitnessed key are both RED by name', () => {
        const { walkSpeed, ...rest } = W.keys;
        expect(checkWitness({ ...W, keys: rest }, KEYS, PROFILE_FIELDS))
            .toContain('PROFILE.walkSpeed has no witness row — run the witness (node scripts/procgen/witness-seedling-profile.mjs --write)');
        expect(checkWitness(W, [...KEYS, 'newKey'], PROFILE_FIELDS))
            .toContain('PROFILE.newKey has no witness row — run the witness (node scripts/procgen/witness-seedling-profile.mjs --write)');
        expect(checkWitness({ ...W, control: { ...W.control, moved: 1 } }, KEYS, PROFILE_FIELDS))
            .toContain('the control moved 1 tape(s); it must move none');
        const flipped = { ...W.keys, walkSpeed: { ...walkSpeed, verdict: 'corpus-blind' } };
        expect(checkWitness({ ...W, keys: flipped }, KEYS, PROFILE_FIELDS))
            .toContain('walkSpeed: verdict "corpus-blind" does not follow from its counts');
    });
});
