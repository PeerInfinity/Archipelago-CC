/**
 * TRAIN TIER — the Seedling map extractor's `--check`: the committed root artifact
 * frontend/modules/flashPanel/atlases/seedling-map.json against a fresh extract of the vendor/seedling submodule.
 *
 * ⚖ Robert 2026-11-17 ("Extractor check", home "Train tier + nightly"): train branches, main pushes, `train_only` /
 * `train` dispatches and the nightly (test-substrates-nightly.yml's `seedling-checks` job), never an ordinary slice
 * push. The other extractors' `--check`s are rows in seedlingSource.test.js; this is the root step's.
 *
 * ⛔ No skip when the submodule is missing: the train jobs and the nightly check it out (`submodules: recursive`),
 * so a missing checkout there is a red, not a silent pass.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULT_OUT, DEFAULT_SOURCE } from './extract-seedling-map.mjs';

const TOOL = join(dirname(fileURLToPath(import.meta.url)), 'extract-seedling-map.mjs');
const run = (...args) => spawnSync(process.execPath, [TOOL, '--check', ...args], { encoding: 'utf8', timeout: 120000 });

describe('extract-seedling-map.mjs --check (the root artifact against vendor/seedling at its pin)', () => {
    it('vendor/seedling is checked out', () => {
        expect(existsSync(join(DEFAULT_SOURCE, 'src/Game.as')), `${DEFAULT_SOURCE} is not checked out (git submodule update --init vendor/seedling)`)
            .toBe(true);
    });

    it('the committed seedling-map.json is byte-current (no --source: the default is the submodule)', () => {
        const r = run();
        expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
        expect(r.stdout).toMatch(/^OK: .* matches a fresh extract \(\d+ levels, \d+ bytes\)/);
    }, 120000);

    // The negative control, kept as a row: one field of a scratch copy corrupted → exit 1, naming the level and field.
    const scratch = mkdtempSync(join(tmpdir(), 'seedling-map-check-'));
    afterAll(() => rmSync(scratch, { recursive: true, force: true }));
    it('a scratch copy with one field changed goes red, naming the first differing level and field', () => {
        const doc = JSON.parse(readFileSync(DEFAULT_OUT, 'utf8'));
        const lvl = doc.levels.find((l) => l.entities.length > 0);
        lvl.entities[0].x += 1;
        const copy = join(scratch, 'seedling-map.json');
        writeFileSync(copy, `${JSON.stringify(doc, null, 2)}\n`);
        const r = run('--out', copy);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain(`first difference: levels[${doc.levels.indexOf(lvl)}] (${lvl.class} ${lvl.path}).entities[0].x: committed ${lvl.entities[0].x}, extracted ${lvl.entities[0].x - 1}`);
    }, 120000);
});
