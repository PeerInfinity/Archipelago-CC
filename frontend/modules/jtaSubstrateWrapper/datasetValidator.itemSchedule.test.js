// Validator rules for the per-rep award schedule (cross-game P2 slice 2;
// Fork 1.13 `item_schedule`). Mirrors the fork loader's checks so a document
// the outer validator accepts cannot be refused by the engine.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateJtaDataset, stampDatasetIdentity } from './datasetValidator.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
    fs.readFileSync(path.join(here, 'datasets', 'vanilla.json'), 'utf8'));

// Task 14 ("Beg for Food") awards item 0 with max_reps >= 3 — the standing
// schedule specimen (census §1a).
const withSchedule = (mutate) => {
    const doc = JSON.parse(JSON.stringify(fixture));
    const t = doc.zones[0].tasks.find((x) => x.id === 14);
    expect(t.item).toBe(0);
    mutate(t, doc);
    stampDatasetIdentity(doc);
    return doc;
};

const errorsOf = (doc) => {
    const res = validateJtaDataset(doc);
    return res.ok ? [] : res.errors;
};

describe('datasetValidator item_schedule rules (P2 slice 2)', () => {
    it('accepts a well-formed schedule (locals + foreign, count defaulted and explicit)', () => {
        const doc = withSchedule((t) => {
            const sched = Array(t.max_reps).fill(0);
            sched[0] = 13;
            sched[1] = { substrate: 'omsi', type: 'gold' };
            sched[2] = { substrate: 'omsi', type: 'reputation', count: 3 };
            t.item_schedule = sched;
        });
        expect(errorsOf(doc)).toEqual([]);
    });

    it('vanilla fixture (no schedules) still validates', () => {
        expect(errorsOf(fixture)).toEqual([]);
    });

    it('rejects wrong length', () => {
        const doc = withSchedule((t) => { t.item_schedule = [0]; });
        expect(errorsOf(doc).join('\n')).toMatch(/exactly max_reps/);
    });

    it('rejects behavior-slotted (artifact) local entries', () => {
        const doc = withSchedule((t) => {
            t.item_schedule = Array(t.max_reps).fill(7); // Scroll of Haste
        });
        expect(errorsOf(doc).join('\n')).toMatch(/behavior-slotted/);
    });

    it('rejects a schedule on an itemless task', () => {
        const doc = withSchedule((t, d) => {
            const itemless = d.zones[0].tasks.find((x) => x.item == null);
            itemless.item_schedule = Array(itemless.max_reps).fill(0);
        });
        expect(errorsOf(doc).join('\n')).toMatch(/requires a non-null item/);
    });

    it('rejects malformed foreign entries (empty substrate, empty type, bad count)', () => {
        const cases = [
            [{ substrate: '', type: 'gold' }, /substrate must be a non-empty string/],
            [{ substrate: 'omsi', type: '' }, /type must be a non-empty string/],
            [{ substrate: 'omsi', type: 'gold', count: 0 }, /count must be a positive integer/],
        ];
        for (const [entry, pattern] of cases) {
            const doc = withSchedule((t) => {
                t.item_schedule = Array(t.max_reps).fill(entry);
            });
            expect(errorsOf(doc).join('\n')).toMatch(pattern);
        }
    });

    it('rejects null and array entries', () => {
        for (const entry of [null, [0]]) {
            const doc = withSchedule((t) => {
                t.item_schedule = Array(t.max_reps).fill(entry);
            });
            expect(errorsOf(doc).join('\n')).toMatch(/item index or a foreign-award object/);
        }
    });

    it('rejects out-of-range local entries', () => {
        const doc = withSchedule((t) => {
            t.item_schedule = Array(t.max_reps).fill(9999);
        });
        expect(errorsOf(doc).join('\n')).toMatch(/live item index/);
    });
});
