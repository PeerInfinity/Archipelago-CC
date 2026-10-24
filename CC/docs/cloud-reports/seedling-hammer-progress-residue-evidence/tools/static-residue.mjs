// Measure only (RK2): the static `other` residue, from static-classify.mjs's output, with RK's WRAPPER exclusion made
// a rule (RK applied it by reading): a site whose sentence is a variable or `${what}: ${why}` is a wrapper — its
// runtime kind is its inner sentence's. Reproduces RK's 75 on RK's d1/static-classified.jsonl.
// node static-residue.mjs <static-classified.jsonl> → the summary line, then the residue rows (line, form, head)
import { readFileSync } from 'node:fs';
const rows = readFileSync(process.argv.slice(2).find((a) => !a.startsWith('--')), 'utf8').trim().split('\n').filter((l) => l.startsWith('{"line'))
    .map((l) => JSON.parse(l));
// RK's rule (`--rk`): the sentence is `${what}: ${why}`, a bare variable, or a `why =` of a non-literal.
// RK2's rule adds (static-sites2's fuller heads make them visible): a row whose `why:` is a variable; a sentence built
// by a call (`refusal({…})`); a sentence that ENDS on an INNER why or message (`… — ${why}`,
// `… — ${e.message}`), or joins its rows' whys (`${r.why}`).join) — its runtime kind is decided by the inner words, which a static head lacks.
const rk = process.argv.includes('--rk');
const wrapper = (r) => /^`\$\{[\w.]+\}: \$\{[\w.]+\}`/.test(r.head) || /^[a-z][\w.]*\s*[,)]/.test(r.head)
    || (r.form === 'why=' && !/^['"`]/.test(r.head))
    || (!rk && (/why: [A-Za-z]\w*\s*$/.test(r.head) || /^[a-z]\w*\(/.test(r.head) || /^[a-z][\w.]*$/.test(r.head)
        || /\$\{(?:[\w.]*[wW]hy|[\w.]*\.message)\}`\s*(?:,|$)/.test(r.head) || /\$\{r\.why\}`\)\.join/.test(r.head)
        || /^`\$\{[\w.]*[wW]hy\} /.test(r.head) || /\$\{String\([\w.]+\.message\)[^}]*\}`\s*(?:,|$)/.test(r.head)));
const by = {};
let wrappers = 0;
const residue = [];
for (const r of rows) {
    by[r.kind] = (by[r.kind] ?? 0) + 1;
    if (r.kind !== 'other') continue;
    if (wrapper(r)) wrappers += 1;
    else residue.push(r);
}
console.log(JSON.stringify({ sites: rows.length, byKind: by, otherWrappers: wrappers, residue: residue.length }));
for (const r of residue) console.log(`${r.line}\t${r.form}\t${r.head}`);
