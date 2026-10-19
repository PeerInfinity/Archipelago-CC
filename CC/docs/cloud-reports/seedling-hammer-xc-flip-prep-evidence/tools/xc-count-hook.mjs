// SCRATCH (seedling-hammer-cross-pass-cache): `node --import <this> <script>` — at exit, append the process's
// ESCAPE_CROSS_PASS_CACHE_COUNTS (and the first mismatches) as one JSON line to $XC_COUNTS_OUT, tagged $XC_TAG.
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
const R = process.env.REPO ?? '/home/user/Archipelago-CC';
const sb = await import(join(R, 'frontend/modules/seedlingDemo/solverBot.js'));
process.on('exit', (code) => {
    if (!process.env.XC_COUNTS_OUT) return;
    appendFileSync(process.env.XC_COUNTS_OUT, JSON.stringify({ tag: process.env.XC_TAG ?? null, code,
        enabled: sb.ESCAPE_CROSS_PASS_CACHE.enabled, verify: sb.ESCAPE_CROSS_PASS_CACHE.verify,
        counts: sb.ESCAPE_CROSS_PASS_CACHE_COUNTS, mismatches: sb.ESCAPE_CROSS_PASS_CACHE_MISMATCHES }) + '\n');
});
