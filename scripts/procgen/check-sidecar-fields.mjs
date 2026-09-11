#!/usr/bin/env node
/**
 * check-sidecar-fields — **EVERY COMMITTED `preset_sidecars` ENTRY HOLDS ITS
 * SUBSTRATE'S OWN PAYLOAD DECLARATION** (PRESET SIDECARS slice D0; plan §7.4,
 * ⚖ Q1 C: *"field descriptors with an optional per-field JSON-Schema
 * fragment, plus a corpus gate"*).
 *
 * ── ⛓ WHY THIS GATE IS THE OTHER HALF OF THE DECLARATION ────────────
 *
 * `rules.schema.json` calls `playable_payload` OPAQUE, and the substrate's
 * SERIALIZER is the payload's authority. Each substrate now DECLARES what its
 * serializer writes (`sidecarFields` on its registry entry; vocabulary in
 * `frontend/modules/procgenCore/sidecarFields.js`). A declaration nobody holds
 * to the data drifts the day a serializer grows a key — so this gate reads the
 * whole committed corpus and asks, of every entry:
 *
 *   · its substrate is REGISTERED, and its declaration is well formed (an
 *     envelope field redeclared is refused by name, per substrate);
 *   · every top-level payload key is DECLARED — ⛔ THE PIN: a key the
 *     serializer writes and the declaration does not name is a FAIL;
 *   · every `required` field is present;
 *   · every value holds its descriptor's type, enum and schema fragment.
 *
 * ⛓ The predicate is `sidecarPayloadErrors` — the SAME function a validity
 * report asks of an edit (the `check-canonical-placements` shape: one
 * predicate, two askers, so the gate and the editor cannot disagree).
 *
 * ── ⛓⛓ THE SECOND LAYER — THE HUB'S VALIDITY REPORT (PRESET SIDECARS V0) ──
 *
 * The gate GREW rather than gaining a sibling (two gates with one opener are
 * one gate; the roster arm is unchanged). Per populated SLOT it now also asks
 * `sidecarIssues(doc, slot)` (`frontend/modules/apworldEditor/sidecarIssues.js`)
 * — the one function the APWorld hub's validation bar and per-region block
 * read — and reports what it says in three bins:
 *
 *   · ERRORS    — FAIL the gate (a payload the play-time host cannot read, an
 *                 exit or location name the document lacks, a duplicate or
 *                 out-of-grid cell, an unresolved sibling reference, a payload
 *                 carrying another substrate's keys, …);
 *   · WARNINGS  — PRINTED, never failing: maybe-intended state by the report's
 *                 own definition (a document endpoint a producer dropped by
 *                 name — the maze atlas projection's `exit_tile_collision` is
 *                 in the committed corpus and the report is right about it);
 *   · NOT CHECKED — `UNCHECKED_SIDECAR_KINDS`, one line per substrate and
 *                 cause: a substrate that declares no carrier is said aloud,
 *                 never counted as passing a check it did not get.
 *
 * ⚠ The report's shape layer re-asks `sidecarPayloadErrors`, so a payload the
 * first layer FAILs also shows there (as the hub shows it): both askers, one
 * predicate.
 *
 * ── ⛓ THE POPULATION IS `git ls-files`, AND IT IS PRINTED ──────────
 *
 * Every TRACKED `_rules.json` under `frontend/presets/` — the multiworld
 * `AP_<id>_P<n>_rules.json` spellings included — because that is what CI's
 * checkout holds. ⛔ A working tree may carry untracked fixture presets; they
 * are out of scope unless `--fixtures` asks for them too. No count is typed
 * here: the headline derives it.
 *
 * ── ⛓ HOW THE REGISTRY IS POPULATED ─────────────────────────────────
 *
 * The substrate libraries self-register as an import side effect; this gate
 * imports the ones `reference/registry.mjs` declares (`REGISTRY_LIBRARIES`,
 * the doc's own "Entry sources" list), INSIDE `main()` — ⛔ nothing runs on
 * import (`check-procgen-help.mjs` reds an instrument whose import does work).
 * The libraries' own boot chatter is swallowed while they load; a library that
 * FAILS to load is reported by name, and every entry of a substrate it would
 * have registered then fails as unregistered.
 *
 * ⛓ `--tree=<path>` reads another checkout's presets (its `git ls-files`), with
 * THIS checkout's registry and report — which is how a planted issue in a
 * scratch copy of one preset is fed to the gate.
 *
 * Run:
 *   node scripts/procgen/check-sidecar-fields.mjs
 *   node scripts/procgen/check-sidecar-fields.mjs --json
 *   node scripts/procgen/check-sidecar-fields.mjs --fixtures
 *   node scripts/procgen/check-sidecar-fields.mjs --tree=<path>
 *
 * Pure node: no dev server, no browser, no `--host`. Exit 1 on any FAIL.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n) => {
    const hit = argv.find((a) => a.startsWith(`--${n}=`));
    return hit ? hit.slice(n.length + 3) : null;
};
const JSON_OUT = argv.includes('--json');
/** ⛓ Also read the UNTRACKED presets on disk (a working tree's fixture dirs). */
const FIXTURES = argv.includes('--fixtures');
/**
 * ⛔ THE TREE FLAG IS `tree` — the other spelling is RESERVED in this directory
 * (it means a Pages-shaped URL to the gate roster, which reads the flag off
 * this file's source). See `check-canonical-placements.mjs` for the
 * measurement; named here, not spelled.
 */
const TREE = arg('tree') ?? join(HERE, '..', '..');

/** ⛓ How many FAIL lines print before the rest are summarised (`--json` has all). */
export const MAX_FAIL_LINES = 40;

/** Gate-level causes, beside `SIDECAR_FIELD_ERRORS`' payload ones. */
export const GATE_CAUSES = Object.freeze({
    UNREADABLE: 'UNREADABLE',
    NOT_AN_ENTRY: 'NOT_AN_ENTRY',
    UNREGISTERED: 'UNREGISTERED',
    BAD_DECLARATION: 'BAD_DECLARATION',
});

/** ⛓ The documents: tracked (and, with `--fixtures`, untracked) `_rules.json` presets. */
function documents() {
    const ls = (...extra) => execFileSync('git',
        ['-C', TREE, 'ls-files', ...extra, '--', 'frontend/presets'], { encoding: 'utf8' })
        .split('\n').filter((f) => f.endsWith('_rules.json'));
    const tracked = ls();
    const untracked = FIXTURES ? ls('--others', '--exclude-standard') : [];
    return [...new Set([...tracked, ...untracked])].sort();
}

/**
 * Import the substrate libraries for their registration side effect, with the
 * console swallowed (see the docblock). Returns the registry and any library
 * that refused to load.
 */
async function loadRegistry() {
    const { REGISTRY_LIBRARIES } = await import('./reference/registry.mjs');
    const repo = join(HERE, '..', '..');
    const { substrateRegistry } = await import(
        pathToFileURL(join(repo, 'frontend/modules/shared/procgen/substrateRegistry.js')).href);
    const failed = [];
    const saved = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
    const quiet = () => {};
    Object.assign(console, { log: quiet, info: quiet, warn: quiet, error: quiet, debug: quiet });
    try {
        for (const rel of REGISTRY_LIBRARIES) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await import(pathToFileURL(join(repo, rel)).href);
            } catch (e) {
                failed.push({ file: rel, error: String(e?.message ?? e).split('\n')[0] });
            }
        }
    } finally {
        Object.assign(console, saved);
    }
    const core = await import(
        pathToFileURL(join(repo, 'frontend/modules/procgenCore/sidecarFields.js')).href);
    const report = await import(
        pathToFileURL(join(repo, 'frontend/modules/apworldEditor/sidecarIssues.js')).href);
    return { substrateRegistry, failed, core, report };
}

async function main() {
    const t0 = Date.now();
    const { substrateRegistry, failed, core, report } = await loadRegistry();
    const { sidecarFieldsOf, sidecarPayloadErrors } = core;
    const { sidecarIssues, describeSidecarIssue, UNCHECKED_SIDECAR_KINDS } = report;

    /** Per substrate id: `{fields}` or `{error}` — asked once, reused per entry. */
    const declarations = new Map();
    const declarationOf = (id) => {
        if (declarations.has(id)) return declarations.get(id);
        const entry = substrateRegistry.get(id);
        let out;
        if (!entry) out = { error: { code: GATE_CAUSES.UNREGISTERED, message: `substrate '${id}' is not registered` } };
        else {
            try {
                out = { fields: sidecarFieldsOf(entry) };
            } catch (e) {
                out = { error: { code: GATE_CAUSES.BAD_DECLARATION, message: e.message } };
            }
        }
        declarations.set(id, out);
        return out;
    };

    const files = documents();
    const fails = [];
    /** ⛓ The second layer's three bins (see the docblock). */
    const issueErrors = [];
    const issueWarnings = [];
    const notChecked = [];
    const bySubstrate = new Map();
    let withSidecars = 0;
    let entries = 0;

    for (const file of files) {
        let doc;
        try {
            doc = JSON.parse(readFileSync(join(TREE, file), 'utf8'));
        } catch (err) {
            fails.push({ file, slot: null, region: null, field: null, code: GATE_CAUSES.UNREADABLE, message: err.message });
            continue;
        }
        const block = doc?.preset_sidecars;
        if (!block || typeof block !== 'object' || Object.keys(block).length === 0) continue;
        withSidecars += 1;
        for (const [slot, regions] of Object.entries(block)) {
            for (const [region, entry] of Object.entries(regions ?? {})) {
                entries += 1;
                const at = { file, slot, region };
                if (!entry || typeof entry.substrate !== 'string') {
                    fails.push({ ...at, field: null, code: GATE_CAUSES.NOT_AN_ENTRY, message: 'the entry has no substrate' });
                    continue;
                }
                bySubstrate.set(entry.substrate, (bySubstrate.get(entry.substrate) ?? 0) + 1);
                const decl = declarationOf(entry.substrate);
                if (decl.error) {
                    fails.push({ ...at, substrate: entry.substrate, field: null, ...decl.error });
                    continue;
                }
                for (const e of sidecarPayloadErrors(decl.fields, entry.playable_payload)) {
                    fails.push({ ...at, substrate: entry.substrate, ...e });
                }
            }
            // ⛓⛓ THE SECOND LAYER — the hub's report, per slot.
            for (const i of sidecarIssues(doc, slot)) {
                const row = { file, slot, ...i, line: describeSidecarIssue(i) };
                if (UNCHECKED_SIDECAR_KINDS.includes(i.kind)) notChecked.push(row);
                else if (i.severity === 'error') issueErrors.push(row);
                else issueWarnings.push(row);
            }
        }
    }
    const ms = Date.now() - t0;
    const substrates = [...bySubstrate.keys()].sort();

    if (JSON_OUT) {
        console.log(JSON.stringify({
            documents: files.length, withSidecars, entries, substrates: Object.fromEntries(
                substrates.map((s) => [s, bySubstrate.get(s)])),
            librariesFailed: failed, fails,
            issues: { errors: issueErrors, warnings: issueWarnings, notChecked }, ms,
        }, null, 2));
    } else {
        console.log('check-sidecar-fields — every preset_sidecars entry against its substrate\'s '
            + `sidecarFields${FIXTURES ? ' (tracked + untracked presets)' : ' (tracked presets)'}`);
        console.log(`  documents read   ${files.length} (${withSidecars} with sidecars)`);
        console.log(`  entries          ${entries} — ${substrates.map((s) => `${s} ${bySubstrate.get(s)}`).join(' · ')}`);
        for (const f of failed) console.log(`  LIBRARY NOT LOADED  ${f.file} — ${f.error}`);
        for (const f of fails.slice(0, MAX_FAIL_LINES)) {
            console.log(`  FAIL  ${f.file}  slot ${f.slot ?? '-'}  region ${JSON.stringify(f.region)}  `
                + `field ${f.field ?? '-'}  ${f.code} — ${f.message}`);
        }
        if (fails.length > MAX_FAIL_LINES) {
            console.log(`  … ${fails.length - MAX_FAIL_LINES} more FAIL line(s); --json lists all. By cause:`);
            const groups = new Map();
            for (const f of fails) {
                const key = `${f.substrate ?? '-'} · ${f.field ?? '-'} · ${f.code}`;
                groups.set(key, (groups.get(key) ?? 0) + 1);
            }
            for (const [k, n] of [...groups].sort()) console.log(`    ${n}×  ${k}`);
        }
        // ⛓ The second layer: errors FAIL, warnings print, not-checked are said aloud.
        const shown = [...issueErrors.map((r) => ['ISSUE', r]), ...issueWarnings.map((r) => ['WARN ', r])];
        for (const [tag, r] of shown.slice(0, MAX_FAIL_LINES)) {
            console.log(`  ${tag}  ${r.file}  slot ${r.slot}  ${r.kind} — ${r.line}`);
        }
        if (shown.length > MAX_FAIL_LINES) {
            console.log(`  … ${shown.length - MAX_FAIL_LINES} more issue line(s); --json lists all.`);
        }
        for (const r of notChecked) console.log(`  NOT CHECKED  ${r.file}  slot ${r.slot}  ${r.line}`);
        const tally = `${issueErrors.length} issue(s), ${issueWarnings.length} warning(s), `
            + `${notChecked.length} not-checked notice(s)`;
        const bad = fails.length + failed.length + issueErrors.length;
        console.log(bad === 0
            ? `  ALL PASS — ${entries} entries over ${substrates.length} substrates · ${tally} (${ms} ms)`
            : `  ${fails.length} FAIL(S) over ${entries} entries · ${tally}${failed.length ? `, ${failed.length} library load failure(s)` : ''} (${ms} ms)`);
    }
    process.exit(fails.length + failed.length + issueErrors.length > 0 ? 1 : 0);
}

if (isEntryPoint(import.meta.url)) main();
