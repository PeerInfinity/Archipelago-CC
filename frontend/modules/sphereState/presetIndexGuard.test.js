import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { indexLacksFile } from './index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = JSON.parse(readFileSync(join(HERE, '../../presets/preset_files.json'), 'utf8'));

describe('the sphere-log fetch guard — the preset index says which folders ship one (hygiene, 2026-09-29)', () => {
    const idx = { g: { folders: { AP_1: { files: ['AP_1_rules.json'] }, AP_2: { files: ['AP_2_rules.json', 'AP_2_sphere_log.jsonl'] } } } };
    it('a listed folder WITHOUT the file → lacks it (skip the fetch)', () => {
        expect(indexLacksFile(idx, { gameDir: 'g', presetDir: 'AP_1', fileName: 'AP_1_sphere_log.jsonl' })).toBe(true);
    });
    it('a listed folder WITH the file → fetch', () => {
        expect(indexLacksFile(idx, { gameDir: 'g', presetDir: 'AP_2', fileName: 'AP_2_sphere_log.jsonl' })).toBe(false);
    });
    it('no index, an unlisted game or folder → cannot say → fetch', () => {
        expect(indexLacksFile(null, { gameDir: 'g', presetDir: 'AP_1', fileName: 'x' })).toBe(false);
        expect(indexLacksFile(idx, { gameDir: 'other', presetDir: 'AP_1', fileName: 'x' })).toBe(false);
        expect(indexLacksFile(idx, { gameDir: 'g', presetDir: 'AP_9', fileName: 'x' })).toBe(false);
    });
    it('⛓ the REAL index: jta_substrate_test (a CI 404) lacks its sphere log; adventure lists its own', () => {
        expect(indexLacksFile(INDEX, { gameDir: 'jta_substrate_test', presetDir: 'AP_14089154938208861744',
            fileName: 'AP_14089154938208861744_sphere_log.jsonl' })).toBe(true);
        expect(indexLacksFile(INDEX, { gameDir: 'adventure', presetDir: 'AP_14089154938208861744',
            fileName: 'AP_14089154938208861744_sphere_log.jsonl' })).toBe(false);
    });
});
