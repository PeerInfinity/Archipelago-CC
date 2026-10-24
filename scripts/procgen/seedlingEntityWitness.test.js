/**
 * The committed entity-record witness (behaviour-parameters P1, D4) against
 * today's registered records. ⛔ This NEVER re-measures (the profile
 * witness's ⚖ Q3, restated): what it guards is that the record still
 * describes the records — a number leaf added without a witness row is RED,
 * and the fix is to run the witness, not to edit the JSON.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { entitiesMd5 } from '../../frontend/modules/seedlingDemo/entityRecords.js';
import { MAGNITUDES, VERDICTS, checkWitness, verdictOf } from './witness-seedling-profile.mjs';
import {
    ENTITY_CHECK_OPTS, ENTITY_WITNESS_COMMAND, ENTITY_WITNESS_JSON, entityNumberFields,
} from './witness-seedling-entities.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const W = JSON.parse(readFileSync(join(REPO, ENTITY_WITNESS_JSON), 'utf8'));
const FIELDS = await entityNumberFields();
const KEYS = FIELDS.map((f) => f.key);

describe('seedling-entity-witnesses.json — the witness record names today\'s record number leaves', () => {
    it('names EXACTLY the registered records\' number leaves — a new leaf without a row is RED: run the witness', () => {
        expect(checkWitness(W, KEYS, FIELDS, ENTITY_CHECK_OPTS), ENTITY_WITNESS_COMMAND).toEqual([]);
        expect(Object.keys(W.keys).sort()).toEqual([...KEYS].sort());
    });

    it('was measured against today\'s records (the md5 it names is today\'s)', () => {
        expect(W.entitiesMd5).toBe(entitiesMd5());
        expect(W.tier).toBe('fast');
    });

    it('every verdict is one of the two, and follows from its counts; the control moved nothing', () => {
        for (const [k, row] of Object.entries(W.keys)) {
            expect(VERDICTS, k).toContain(row.verdict);
            expect(row.verdict, k).toBe(verdictOf(row));
            for (const m of MAGNITUDES) expect(row[m].moved + row[m].threw + row[m].same, `${k}.${m}`).toBe(W.tapes.length);
        }
        expect(W.control).toMatchObject({ moved: 0, runs: 2 });
    });

    it('`--check` agrees', () => {
        const r = spawnSync(process.execPath, [join(REPO, 'scripts/procgen/witness-seedling-entities.mjs'), '--check'],
            { cwd: REPO, encoding: 'utf8' });
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain(`PASS — ${ENTITY_WITNESS_JSON} names all ${KEYS.length} number leaves`);
    });

    it('mutants, in memory: a deleted row and an unwitnessed leaf are both RED by name', () => {
        const { 'spinner.moveSpeed': gone, ...rest } = W.keys;
        expect(gone).toBeDefined();
        expect(checkWitness({ ...W, keys: rest }, KEYS, FIELDS, ENTITY_CHECK_OPTS))
            .toContain(`spinner.moveSpeed has no witness row — run the witness (${ENTITY_WITNESS_COMMAND})`);
        expect(checkWitness(W, [...KEYS, 'spinner.newLeaf'], FIELDS, ENTITY_CHECK_OPTS))
            .toContain(`spinner.newLeaf has no witness row — run the witness (${ENTITY_WITNESS_COMMAND})`);
        expect(checkWitness(W, KEYS.filter((k) => k !== 'spinner.moveSpeed'), FIELDS, ENTITY_CHECK_OPTS))
            .toContain('witness row "spinner.moveSpeed" names no record number leaf — run the witness');
    });
});
