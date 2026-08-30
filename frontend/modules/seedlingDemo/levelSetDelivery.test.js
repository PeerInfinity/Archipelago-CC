// The SENDER's half of the delivery conformance fixture
// (CC/docs/plans/seedling-external-level-sets.md, Phase 3 seam 3).
//
// ⛓ WHY A SHARED FIXTURE EXISTS AT ALL. `levelSetValidator.js` is JavaScript
// and cannot run inside the wasm, so the receiver — `LevelSet.acceptChunk` in
// ~/CC/seedling/src/LevelSet.as — has to assemble deliveries itself. That is
// two implementations of one rule set, which is the failure mode this arc keeps
// catching. The cure is not to pretend one of them away: the sender assembles a
// batch it already holds and the receiver assembles a STREAM, one
// ExternalInterface call at a time, and neither can do the other's job. So both
// are pinned to the SAME cases, and the verdict compared is the one that
// matters — DOES A SET GET MOUNTED.
//
// This file is the sender's half. The receiver's half is
// scripts/procgen/probe-seedling-level-set-transport.mjs, which drives the same
// fixture through the built artifact; neither half proves parity alone.
//
// ⚠ Reasons are deliberately NOT compared. Each side words its own; a wording
// difference is harmless where a verdict difference is not.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { assembleLevelSetChunks, LEVEL_SET_SCHEMA_VERSION } from './levelSetValidator.js';

const CONFORMANCE = JSON.parse(readFileSync(
    fileURLToPath(new URL(
        './fixtures/seedling-level-set-delivery-conformance.json', import.meta.url,
    )), 'utf8',
));

describe('the delivery conformance fixture itself', () => {
    it('is the version this build speaks', () => {
        expect(CONFORMANCE.schema_version).toBe(LEVEL_SET_SCHEMA_VERSION);
    });

    // ⛓ A fixture of only-refusals would pass against an assembler that refuses
    // everything, and a fixture of only-acceptances against one that accepts
    // everything. Both arms have to be populated for either to mean anything.
    it('carries both verdicts, with the refusals in the majority', () => {
        const mount = CONFORMANCE.cases.filter((c) => c.mounts);
        const refuse = CONFORMANCE.cases.filter((c) => !c.mounts);
        expect(mount.length).toBeGreaterThanOrEqual(3);
        expect(refuse.length).toBeGreaterThan(mount.length);
    });

    it('says of every case what would happen without the rule it exercises', () => {
        for (const c of CONFORMANCE.cases) {
            expect(c.would_mount_without_the_rule.length, c.name).toBeGreaterThan(20);
        }
    });

    // The receiver-only cases are the declared divergence. Left unmarked they
    // would read as parity failures; left unexplained they would be a licence to
    // add any receiver rule at all.
    it('marks and explains every receiver-only refusal', () => {
        for (const c of CONFORMANCE.cases.filter((x) => x.receiver_only)) {
            expect(c.mounts, `${c.name} is receiver_only, so it must NOT mount`)
                .toBe(false);
            expect(c.note, c.name).toBeTruthy();
        }
    });
});

describe('assembleLevelSetChunks against the shared cases', () => {
    for (const c of CONFORMANCE.cases) {
        const receiverOnly = c.receiver_only === true;
        const expected = receiverOnly ? true : c.mounts;
        it(`${c.mounts ? 'mounts' : 'refuses'}: ${c.name}`, () => {
            const result = assembleLevelSetChunks(c.chunks);
            expect(result.ok, JSON.stringify(result.errors)).toBe(expected);
            if (!result.ok) {
                expect(result.errors.length).toBeGreaterThan(0);
                expect(result.set).toBeNull();
            } else {
                // Ids are dense and ascending — the property that makes
                // chunk_index bookkeeping rather than identity.
                result.set.rooms.forEach((room, i) => expect(room.id).toBe(i));
            }
        });
    }

    it('the receiver-only case is one the SENDER accepts, which is the point', () => {
        const embedCase = CONFORMANCE.cases.find((c) => c.receiver_only);
        expect(embedCase).toBeTruthy();
        const result = assembleLevelSetChunks(embedCase.chunks);
        expect(result.ok).toBe(true);
        expect(result.set.rooms.some((r) => r.source.embed)).toBe(true);
    });
});
