import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { upsertLibraryIndexEntry } from './regionLibraryIndex.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INDEX = path.join(repoRoot, 'frontend/region-libraries/region_library_files.json');

const row = (file, extra = {}) => ({ file, library_id: `${file}-id`, ...extra });
const files = (index) => index.libraries.map((l) => l.file);

describe('upsertLibraryIndexEntry — the pack makers\' index writes are order-free', () => {
    it('replaces an existing row IN PLACE (the filter+push mutant moves it to the end)', () => {
        const index = { libraries: [row('a'), row('b'), row('c')] };
        upsertLibraryIndexEntry(index, row('b', { entry_count: 9 }));
        expect(files(index)).toEqual(['a', 'b', 'c']);
        expect(index.libraries[1].entry_count).toBe(9);
    });

    it('appends a row that is absent, and creates the list when missing', () => {
        expect(files(upsertLibraryIndexEntry({ libraries: [row('a')] }, row('z')))).toEqual(['a', 'z']);
        expect(files(upsertLibraryIndexEntry({}, row('z')))).toEqual(['z']);
    });

    it('drops a stale later duplicate of the same file', () => {
        const index = { libraries: [row('a'), row('b'), row('a', { stale: true })] };
        upsertLibraryIndexEntry(index, row('a', { fresh: true }));
        expect(files(index)).toEqual(['a', 'b']);
        expect(index.libraries[0].fresh).toBe(true);
    });

    it('re-registering every committed row, in ANY order, reproduces the committed bytes', () => {
        const text = fs.readFileSync(INDEX, 'utf8');
        const committed = JSON.parse(text);
        const rows = committed.libraries;
        // Each pack maker re-registers its own row; whichever runs last must
        // not move anything. Try every rotation of the writer order.
        for (let k = 0; k < rows.length; k++) {
            const index = JSON.parse(text);
            for (const r of [...rows.slice(k), ...rows.slice(0, k)]) upsertLibraryIndexEntry(index, { ...r });
            expect(`${JSON.stringify(index, null, 2)}\n`).toBe(text);
        }
    });

    it('refuses a row with no file key', () => {
        expect(() => upsertLibraryIndexEntry({ libraries: [] }, {})).toThrow(/entry\.file/);
    });
});
