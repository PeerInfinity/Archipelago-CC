// The headless procgen writer's `--stop-on-pool-empty` flag (APWORLD SUBSTRATE
// CHANGE PM1, §44). The writer is a CLI whose `main()` runs on import, so each
// row drives it as a child process into a temp dir and reads the rules.json back.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const WRITER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generate-procgen-rules.js');

// sha256 of `generate-procgen-rules.js --seed 1 --out <f>` as written by the
// PRE-FLAG writer: the file at 34f32cf324 (its own sha256 c80b84c2…7ff966),
// run in PM1's scratchpad before any edit (§44.0). The default run must not
// move by one byte when the flag is off. ⚠ This hashes the ENGINE's output too:
// a maze-engine change that moves the default seed-1 document reds this row —
// re-record it then, with that change named. (C1's fixpoint `cb4f583cb7` was
// measured NOT to move it.)
// Re-recorded at rules F1 (2026-10-03): `assume_bidirectional_exits` moved from
// the top level into `exporter["1"]`. Measured: moving it back in the new output
// (top level after `starting_items`, `exporter: {}`) hashes to the old value
// baf3285f…dfcd7d4 exactly, so the move is the whole delta.
const PRE_FLAG_DEFAULT_SEED_1_SHA256 =
    '4fa87bb17043c6b75478d789507c5a84e8a5d2dd533286e42b7faf2832a49b9f';

let tmp;
beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-procgen-rules-')); });
afterAll(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

function runWriter(name, args) {
    const out = path.join(tmp, `${name}.json`);
    const res = spawnSync(process.execPath, [WRITER, ...args, '--out', out], { encoding: 'utf-8' });
    expect(res.status, res.stderr).toBe(0);
    const text = fs.readFileSync(out, 'utf-8');
    return { text, doc: JSON.parse(text) };
}

const stopReason = (doc) => doc.procgen_metadata['1'].stop_reason;
const regionCount = (doc) => Object.keys(doc.regions['1']).length;

describe('generate-procgen-rules --stop-on-pool-empty', () => {
    it('left off, the default run is byte-identical to the pre-flag writer', () => {
        const { text } = runWriter('default', ['--seed', '1']);
        expect(createHash('sha256').update(text).digest('hex')).toBe(PRE_FLAG_DEFAULT_SEED_1_SHA256);
    });

    it('reaches the engine: growth ends at the empty pool instead of the empty frontier', () => {
        const off = runWriter('off', ['--seed', '1']).doc;
        // The flag takes no value — first on the line, so a value-taking parse would eat `--seed`.
        const on = runWriter('on', ['--stop-on-pool-empty', '--seed', '1']).doc;
        // The premise the row stands on: off, this seed grows past the empty pool.
        expect(stopReason(off)).toBe('frontier_empty');
        expect(stopReason(on)).toBe('pool_empty');
        expect(regionCount(on)).toBeLessThan(regionCount(off));
    });
});
