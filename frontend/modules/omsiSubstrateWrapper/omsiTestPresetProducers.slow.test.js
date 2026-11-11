/**
 * The four omsi_*_test preset producers, each run COLD in its own node process
 * into a temporary --out-dir: every one must exit 0 and reproduce the
 * committed seed-1 rules.json byte for byte.
 *
 * Why (slice omsi-test-presets-order, 2026-11-11): since a6139f91a8 (spiral item
 * layer) the engine placed the goal on a maze cell and turned the omsi region's
 * own victory into 'Region Library Filler', so these producers exited 1 on every
 * run and regenerated presets that disagreed with the committed ones. Nothing
 * ran them, so the break went unseen for a month. They opt out with
 * `goalItem: null`; drop that and this test fails.
 *
 * Slow tier (vitest.slow.config.js, serial): each producer is a fresh node
 * process importing the procgen pipeline. One producer per test, never parallel.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, afterAll } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SEED_ID = 'AP_14089154938208861744';
const PRODUCERS = ['randomized', 'region-split', 'scaled', 'substrate'];

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'omsi-test-presets-'));
afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

describe('omsi_*_test preset producers — exit 0 cold, bytes equal the committed presets', () => {
    for (const name of PRODUCERS) {
        it(`generate-omsi-${name}-test-preset.mjs`, () => {
            const outDir = path.join(tmpRoot, name);
            const script = path.join(repoRoot, `scripts/test/generate-omsi-${name}-test-preset.mjs`);
            const res = spawnSync(process.execPath, [script, '--out-dir', outDir], {
                cwd: repoRoot, encoding: 'utf8', timeout: 240_000,
            });
            const tail = `${res.stdout ?? ''}${res.stderr ?? ''}`.split('\n').slice(-8).join('\n');
            expect(res.status, `exit ${res.status}; output tail:\n${tail}`).toBe(0);

            const written = fs.readdirSync(outDir).filter((d) => d.startsWith('omsi_'));
            expect(written.length, `${name} wrote no omsi_* preset`).toBeGreaterThan(0);
            for (const gameId of written) {
                const rel = path.join(gameId, SEED_ID, `${SEED_ID}_rules.json`);
                const fresh = fs.readFileSync(path.join(outDir, rel), 'utf8');
                const committed = fs.readFileSync(path.join(repoRoot, 'frontend/presets', rel), 'utf8');
                expect(fresh === committed, `${rel} differs from the committed preset`).toBe(true);
            }
        }, 300_000);
    }
});
