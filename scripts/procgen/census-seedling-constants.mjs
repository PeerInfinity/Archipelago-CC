#!/usr/bin/env node
/**
 * census-seedling-constants — every numeric literal in Seedling's JS simulation, with its reviewed class (engine-prep A1).
 *
 * The simulation is the static relative import closure of
 * `frontend/modules/seedlingDemo/levelRun.js`. Every `NumericLiteral` there is
 * one row of `scripts/procgen/seedling-constants-census.csv` (GENERATED,
 * committed), classed by joining it to the REVIEWED table
 * `scripts/procgen/seedling-constants-fields.csv` (`physics`, `rule`,
 * `cosmetic`, `structural`; a row no reviewed target reaches is
 * `unclassified`). The logic is `seedlingConstantsCensus.js`; the doc is
 * `docs/json/developer/procgen/seedling-constants.md`, whose tables between
 * the CENSUS markers this file renders.
 *
 * ⛔ READ-ONLY over the simulation. It edits no simulation file, no solver file,
 * no tape. `--write` touches exactly the census CSV and the doc's marked region.
 *
 * `--check` is the gate's logic (`seedlingConstantsCensus.test.js` runs the
 * same function): RED on a NEW physics/rule/unclassified literal, on a
 * committed physics/rule row whose statement is gone ("must be RETIRED"), on a
 * committed row whose reviewed columns disagree with the table, and on a stale
 * doc region, on a reviewed target that reaches no row or ties another. A new or vanished cosmetic/structural literal is GREEN, and is
 * reported.
 *
 * Run:
 *   node scripts/procgen/census-seedling-constants.mjs            # the summary table
 *   node scripts/procgen/census-seedling-constants.mjs --write    # regenerate the census CSV and the doc region
 *   node scripts/procgen/census-seedling-constants.mjs --check    # exit 1 on drift
 *   node scripts/procgen/census-seedling-constants.mjs --profile-rows  # regenerate the fields table's profile rows
 *
 * `--profile-rows` (engine prep A2) rewrites ONLY the fields table's rows for
 * `seedlingProfile.js`: one exact-key row per `PROFILE` literal, its class,
 * kind, as3 and note taken from `PROFILE_FIELDS`. Run it after adding or
 * changing a profile key, then `--write`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import {
    CENSUS_CSV, CLASSES, DOC_MD, FIELDS_CSV, KINDS, PROFILE_FILE, buildCensus, censusCsv, diffCensus, parseCsv,
    profileDisagreements, profileFieldsRows, redLine, renderDocRegion, spliceDocRegion, spliceProfileFields,
} from './seedlingConstantsCensus.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The whole verdict at `root`, as data: the fresh census, the diff against the
 * committed one, and whether the doc region is current.
 */
export function checkCensus(root = REPO) {
    const census = buildCensus(root);
    const committedPath = join(root, CENSUS_CSV);
    const committed = existsSync(committedPath) ? parseCsv(readFileSync(committedPath, 'utf8')) : [];
    const diff = diffCensus(committed, census.rows, { compareAs3: census.as3 !== null });
    const docPath = join(root, DOC_MD);
    const doc = existsSync(docPath) ? readFileSync(docPath, 'utf8') : '';
    // ⛓ The region renders the COMMITTED census, not the fresh one. A new
    // cosmetic/structural literal is green drift by design; rendering the
    // fresh rows would turn every such literal red through the doc's counts.
    // So the doc is stale exactly when the committed record moved without a
    // re-render (or a top-level fact it lists — a duplicated name, a derived
    // constant — moved in the source).
    const region = renderDocRegion({ files: census.files, rows: committed });
    const docStale = spliceDocRegion(doc, region) !== doc;
    return { census, committed, diff, docStale, region };
}

function summary(census) {
    const { rows } = census;
    const pos = ['scalar', 'table', 'inline'];
    const pad = (s, n) => String(s).padEnd(n);
    const lines = [`census-seedling-constants — ${census.files.length} files, ${rows.length} literals`
        + `${census.as3 ? `, ${census.as3.length} AS3 declarations read` : ', AS3 source ABSENT (no anchors)'}`, ''];
    lines.push(`${pad('class', 14)}${pos.map((p) => pad(p, 9)).join('')}total`);
    for (const c of CLASSES) {
        const n = pos.map((p) => rows.filter((r) => r.class === c && r.position === p).length);
        lines.push(`${pad(c, 14)}${n.map((x) => pad(x, 9)).join('')}${n.reduce((a, b) => a + b, 0)}`);
    }
    lines.push('');
    for (const c of ['physics', 'rule']) {
        lines.push(`${pad(c, 9)}${KINDS.map((k) => `${k} ${rows.filter((r) => r.class === c && r.kind === k).length}`).join('  ')}`);
    }
    lines.push('', `REVIEW: rows ${rows.filter((r) => r.note.startsWith('REVIEW:')).length}`
        + `   anchored ${rows.filter((r) => r.as3).length}`
        + `   ambiguous joins ${census.ambiguous.length}   unused targets ${census.unusedTargets.length}`);
    return lines.join('\n');
}

/** `PROFILE_FIELDS` of the registry at `root`. */
export async function loadProfileFields(root = REPO) {
    const { PROFILE_FIELDS } = await import(pathToFileURL(join(root, PROFILE_FILE)).href);
    return PROFILE_FIELDS;
}

async function main() {
    const argv = process.argv.slice(2);
    if (argv.includes('--profile-rows')) {
        const fields = await loadProfileFields(REPO);
        const fresh = profileFieldsRows(buildCensus(REPO), fields);
        const path = join(REPO, FIELDS_CSV);
        writeFileSync(path, spliceProfileFields(readFileSync(path, 'utf8'), fresh));
        console.log(`wrote ${fresh.length} profile row(s) into ${FIELDS_CSV} — now run --write`);
        return;
    }
    if (argv.includes('--write')) {
        const census = buildCensus(REPO);
        writeFileSync(join(REPO, CENSUS_CSV), censusCsv(census.rows));
        const docPath = join(REPO, DOC_MD);
        if (existsSync(docPath)) {
            const doc = readFileSync(docPath, 'utf8');
            writeFileSync(docPath, spliceDocRegion(doc, renderDocRegion(census)));
        }
        console.log(summary(census));
        console.log(`\nwrote ${CENSUS_CSV} (${census.rows.length} rows)${existsSync(docPath) ? ` and the region of ${DOC_MD}` : ''}`);
        return;
    }
    if (argv.includes('--check')) {
        const { census, diff, docStale } = checkCensus(REPO);
        const lines = diff.red.map(redLine);
        if (docStale) lines.push(`RED  ${DOC_MD}: the CENSUS region is stale — --write`);
        for (const a of census.ambiguous) lines.push(`RED  ${a.key}: equally specific targets ${a.targets.join(' / ')}`);
        for (const t of census.unusedTargets) lines.push(`RED  ${FIELDS_CSV}: target ${t} reaches no row — delete it`);
        for (const d of profileDisagreements(census, await loadProfileFields(REPO))) {
            lines.push(`RED  ${d} — --profile-rows, then --write`);
        }
        const byWhy = (w) => diff.green.filter((g) => g.why === w).length;
        console.log(`census-seedling-constants --check — ${census.rows.length} literals; `
            + `green drift: ${byWhy('new')} new + ${byWhy('vanished')} vanished cosmetic/structural, ${byWhy('moved')} moved`
            + `${census.as3 === null ? '; AS3 source absent: the as3 column is NOT compared' : ''}`);
        for (const l of lines) console.log(l);
        if (lines.length) {
            console.log(`\nFAIL — ${lines.length} red item(s)`);
            process.exitCode = 1;
        } else console.log('PASS');
        return;
    }
    console.log(summary(buildCensus(REPO)));
}

argvHelp(import.meta.url);
if (isEntryPoint(import.meta.url)) await main();
