// verify-dj-swf-patch.mjs — assert the in-browser SWF patcher
// (frontend/modules/bounceDemo/djReal/swf_inject.mjs, vendored verbatim
// from SWFRecomp-CC tools/divergence/) produces output
// byte-identical to SWFRecomp-CC's reference tool:
//   inject_tracer.py <original DJ swf> --bytecode loader_bytecode.bin --stage-width 600
//
// Needs the original Doodle Jump SWF + the SWFRecomp-CC checkout (paths
// overridable via env). Skips with exit 0 + a notice when either is
// missing, so it can run in CI checkouts that lack the sibling repo.
//
// Usage: node scripts/procgen/verify-dj-swf-patch.mjs

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectSwf } from '../../frontend/modules/bounceDemo/djReal/swf_inject.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SWFRECOMP = process.env.SWFRECOMP_CC ?? join(process.env.HOME, 'CC', 'SWFRecomp-CC');
const ORIGINAL = process.env.DJ_ORIGINAL_SWF
    ?? join(SWFRECOMP, 'SWFRecomp', 'tests', 'flasharchive', 'Doodle_Jump', 'test.swf');
const INJECTOR = join(SWFRECOMP, 'tools', 'divergence', 'inject_tracer.py');
const BYTECODE = join(REPO, 'frontend', 'modules', 'bounceDemo', 'djReal', 'loader_bytecode.bin');

if (!existsSync(ORIGINAL) || !existsSync(INJECTOR)) {
    console.log(`SKIP: original DJ SWF (${ORIGINAL}) or inject_tracer.py `
        + `(${INJECTOR}) not available`);
    process.exit(0);
}

const original = new Uint8Array(readFileSync(ORIGINAL));
const bytecode = new Uint8Array(readFileSync(BYTECODE));

// Reference output from the Python tool.
const refPath = join(tmpdir(), `dj_loader_ref_${process.pid}.swf`);
execFileSync('python3', [INJECTOR, ORIGINAL, refPath,
    '--bytecode', BYTECODE, '--stage-width', '600'], { stdio: 'inherit' });
const ref = new Uint8Array(readFileSync(refPath));

const ours = await injectSwf(original, bytecode, { stageWidth: 600 });

if (ours.length !== ref.length) {
    console.error(`FAIL: length mismatch ours=${ours.length} ref=${ref.length}`);
    process.exit(1);
}
for (let i = 0; i < ref.length; i++) {
    if (ours[i] !== ref[i]) {
        console.error(`FAIL: first byte difference at offset ${i} `
            + `(ours=0x${ours[i].toString(16)} ref=0x${ref[i].toString(16)})`);
        process.exit(1);
    }
}
console.log(`PASS: swf_inject.mjs output byte-identical to inject_tracer.py `
    + `--stage-width 600 (${ref.length} bytes)`);
