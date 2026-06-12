/**
 * build-dj-loader-swf.mjs — produce the loader-injected wide Doodle Jump
 * SWF as a FILE, for consumers that need a URL instead of in-memory
 * bytes: the real-DJ renderer's native-Flash tier (NPAPI plugins stream
 * the movie by URL) and the SWFRecomp recompile input
 * (flasharchive/Doodle_Jump_loader/test.swf).
 *
 * Uses the same swfPatch.js the page uses in-browser, on the same
 * inputs: your original Doodle Jump SWF (NOT committed — place it at
 * frontend/modules/bounceDemo/djReal/Doodle_Jump.swf) + the committed
 * loader_bytecode.bin. Output is gitignored (djReal/*.swf).
 *
 * Usage: node scripts/procgen/build-dj-loader-swf.mjs
 *   [--original path] [--out path] [--stage-width 600]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLoaderSwf } from '../../frontend/modules/bounceDemo/djReal/swfPatch.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DJREAL = join(HERE, '..', '..', 'frontend', 'modules', 'bounceDemo', 'djReal');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : dflt;
};
const originalPath = opt('--original', join(DJREAL, 'Doodle_Jump.swf'));
const outPath = opt('--out', join(DJREAL, 'dj_loader.swf'));
const stageWidth = Number(opt('--stage-width', 600));

if (!existsSync(originalPath)) {
    console.error(`original Doodle Jump SWF not found at ${originalPath}\n`
        + '(supply your own copy — it is never committed; see djReal/README.md)');
    process.exit(2);
}
const original = new Uint8Array(readFileSync(originalPath));
const bytecode = new Uint8Array(readFileSync(join(DJREAL, 'loader_bytecode.bin')));
const out = await buildLoaderSwf(original, bytecode, { stageWidth });
writeFileSync(outPath, out);
console.log(`wrote ${outPath} (${out.length} bytes, stage ${stageWidth}px, `
    + `bytecode ${bytecode.length} bytes)`);
