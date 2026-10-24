import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const S = process.argv[2], T = 'frontend/modules/seedlingDemo/fixtures/tapes';
for await (const d of readdirSync(join(S, 'out'))) for (const f of readdirSync(join(S, 'out', d))) {
  const a = (await import('node:child_process')).execSync(`git show 4667f7e353:${T}/${f}`, { encoding: 'utf8', maxBuffer: 1 << 26 }), b = readFileSync(join(S, 'out', d, f), 'utf8');
  if (a === b) { console.log(`${d}\t${f}\tSAME`); continue; }
  const A = JSON.parse(a), B = JSON.parse(b);
  const n = (x) => x.tick_count;
  const keysA = Object.keys(A), diffk = keysA.filter((k) => JSON.stringify(A[k]) !== JSON.stringify(B[k]));
  console.log(`${d}\t${f}\tMOVED\t${n(A)} -> ${n(B)}\tfields: ${diffk.join(',')}`);
}
