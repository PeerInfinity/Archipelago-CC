// repair-jsonl.mjs <in> <out> — the pair arm ran before sweep-arm.sh used printf: dash's `echo` turned each JSON `\n`
// escape in a refusal message into a real newline. Rejoin a line that does not open a record onto the one before it with
// the `\n` escape restored. Every repaired line must parse.
import { readFileSync, writeFileSync } from 'node:fs';
const out = [];
for (const l of readFileSync(process.argv[2], 'utf8').split('\n')) {
    if (!l) continue;
    if (l.startsWith('{"fx"') || l.startsWith('{"id"') || !out.length) out.push(l); else out[out.length - 1] += `\\n${l}`;
}
for (const l of out) JSON.parse(l);
writeFileSync(process.argv[3], `${out.join('\n')}\n`);
console.log(`${out.length} records`);
