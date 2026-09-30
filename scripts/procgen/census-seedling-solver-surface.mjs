#!/usr/bin/env node
/**
 * census-seedling-solver-surface — engine-prep C1's static census of the
 * Seedling solver's surface: everything the solver family reaches in the
 * simulation. The logic is `seedlingSolverSurface.js`; the contract table it
 * maintains is `seedling-solver-surface.json`; the gate is
 * `seedlingSolverSurface.test.js`; the account is
 * docs/json/developer/procgen/seedling-solver-surface.md.
 *
 * Run:
 *   node scripts/procgen/census-seedling-solver-surface.mjs           # print the tables
 *   node scripts/procgen/census-seedling-solver-surface.mjs --check   # exit 1 if the table is stale
 *   node scripts/procgen/census-seedling-solver-surface.mjs --write   # rewrite the table (keeps class/form/why)
 *   ... --json                                                        # the raw census as JSON
 *
 * ⛔ Named `census-*`, not `check-*`: a `check-*.mjs` enrols in the derived
 * gate roster and owes a standing row. Enrolling it is the coordinator's step.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    buildTable, census, compareToTable, CORE_FOUR, DOOR, groupReads, staticDrift, surfaceA,
} from './seedlingSolverSurface.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
export const TABLE = path.join(HERE, 'seedling-solver-surface.json');
export const DYNAMIC = path.join(HERE, 'seedling-solver-surface-dynamic.json');

const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
const base = (f) => path.posix.basename(f);
const lineCount = (f) => { const s = read(f); return s.split('\n').length - (s.endsWith('\n') ? 1 : 0); };

function printTables(c) {
    console.log(`simulation: closure of levelRun.js — ${c.simulation.length} files, `
        + `${c.simulation.reduce((a, f) => a + lineCount(f), 0)} lines`);
    console.log(`family (${c.family.length}): ${c.family.map(base).join(' ')}`);
    const viaDoor = c.imports.filter((i) => i.door).length;
    console.log(`import door ${base(DOOR)}: ${c.door.exports.size} exports; ${viaDoor} of ${c.imports.length} `
        + `family import specifiers go through it; ${c.door.bypass.length} bypass, ${c.door.unused.length} unused`);
    const kinds = {};
    for (const m of c.runObject.members) kinds[m.kind] = (kinds[m.kind] ?? 0) + 1;
    console.log(`run object: ${c.runObject.members.length} properties ${JSON.stringify(kinds)} `
        + `at levelRun.js:${c.runObject.startLine}-${c.runObject.endLine}`);
    for (const [label, files] of [['the four', CORE_FOUR], ['the family', c.family]]) {
        const a = surfaceA(c, files);
        const sites = [...a.values()].reduce((s, g) => s + g.sites, 0);
        const ims = c.imports.filter((i) => files.includes(i.file));
        const syms = new Set(ims.map((i) => `${i.module}#${i.name}`));
        console.log(`\n## ${label}: Surface A (run.x on the identifier \`run\`) ${a.size} distinct / ${sites} sites; `
            + `Surface B ${syms.size} imported symbols from ${new Set(ims.map((i) => i.module)).size} modules`);
    }
    console.log('\n## every tracked read, by surface (direct spelling + const aliases + followed parameters)');
    const all = groupReads(c.reads);
    for (const s of ['run', 'world', 'state']) {
        const gs = [...all.values()].filter((g) => g.base === s).sort((x, y) => y.sites - x.sites);
        console.log(`\n### ${s}: ${gs.length} members / ${gs.reduce((a, g) => a + g.sites, 0)} sites`);
        for (const g of gs) {
            console.log(`  ${String(g.sites).padStart(4)}  ${g.name.padEnd(28)} `
                + `${[...g.files].map(([f, n]) => `${base(f)}:${n}`).join(' ')}  [${[...g.vias].join(',')}]`);
        }
    }
    console.log(`\n### import: ${c.imports.length} named imports`);
    for (const i of [...c.imports].sort((x, y) => (x.module + x.name).localeCompare(y.module + y.name))) {
        console.log(`  ${String(i.sites).padStart(4)}  ${base(i.module).padEnd(24)} ${i.name.padEnd(36)} ${base(i.file)}:${i.line}`);
    }
    console.log('\n## aliases and parameters followed');
    for (const t of c.tracked) {
        console.log(`  ${t.how.padEnd(11)} ${t.base.padEnd(5)} ${t.name.padEnd(8)} ${base(t.file)}:${t.line}`
            + `${t.callee ? ` ← ${t.callee}() at ${base(t.from)}` : ''}`);
    }
    console.log(`\n## what the census CANNOT see (${c.blind.length})`);
    for (const b of c.blind) console.log(`  ${b.kind.padEnd(18)} ${base(b.file)}:${b.line}  ${b.detail}`);
}

function main() {
    const argv = process.argv.slice(2);
    const c = census(read);
    if (argv.includes('--json')) {
        console.log(JSON.stringify({ ...c, runMembers: undefined, worldMembers: undefined, stateMembers: undefined },
            (k, v) => (k === 'ancestors' ? undefined : v), 2));
        return;
    }
    const previous = readJson(TABLE);
    if (argv.includes('--write')) {
        const table = buildTable(c, { previous, dynamic: readJson(DYNAMIC) });
        fs.writeFileSync(TABLE, `${JSON.stringify(table, null, 2)}\n`);
        const un = table.rows.filter((r) => r.class === 'UNCLASSIFIED').length;
        console.log(`wrote ${path.relative(REPO, TABLE)}: ${table.rows.length} rows`
            + `${un ? ` — ${un} UNCLASSIFIED: read each and fill class/form/why` : ''}`);
        return;
    }
    if (argv.includes('--check')) {
        if (!previous) { console.log(`RED: no table at ${path.relative(REPO, TABLE)}`); process.exit(1); }
        const cmp = compareToTable(c, previous);
        const drift = staticDrift(c, previous);
        const un = previous.rows.filter((r) => r.class === 'UNCLASSIFIED' || !r.form || !r.why);
        for (const u of cmp.unlisted) console.log(`RED unlisted: ${u.at} reaches ${u.key} — ${u.why}`);
        for (const r of cmp.retired) console.log(`RED retired: ${r.key}${r.file ? ` (${r.file})` : ''} — ${r.why}`);
        for (const d of drift) console.log(`RED drift: ${d.key} table ${JSON.stringify(d.table)} fresh ${JSON.stringify(d.fresh)}`);
        for (const r of un) console.log(`RED unclassified: ${r.surface}:${r.name}`);
        if (cmp.family) console.log(`RED family: closure ${cmp.family.closure.join(' ')} ≠ table ${cmp.family.table.join(' ')}`);
        for (const d of cmp.door) console.log(`RED door: ${d.at} ${d.why}`);
        const red = cmp.unlisted.length + cmp.retired.length + drift.length + un.length + (cmp.family ? 1 : 0)
            + cmp.door.length;
        console.log(red ? `RED: ${red} finding(s) — run --write, then classify` : `GREEN: ${previous.rows.length} rows match a fresh census`);
        process.exit(red ? 1 : 0);
    }
    printTables(c);
}

main();
