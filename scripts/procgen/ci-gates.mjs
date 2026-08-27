#!/usr/bin/env node
/**
 * ci-gates — **THE HEADLESS GATES, RUN IN CI, ONE PARSEABLE LINE EACH**
 * (R9 slice P3b (g), ⚖ ruling 54 (6); ⚖ 52 generalised).
 *
 * ── ⛔⛔ THE MEASUREMENT THAT SHAPED THIS ─────────────────────────────
 *
 * ⚖ 54 (6) reads *"more standing rows quoted from CI by SHA (every headless
 * gate; only Windows/GPU rows stay local)"*. Measured against `gateRoster`,
 * **the headless population is FOUR of thirty-one** — 23 browser, 4 windows,
 * 4 headless — and CI can run none of the other twenty-seven. So the economy
 * the ruling was reaching for is not available at this tree, and saying so is
 * the honest discharge rather than pretending otherwise.
 *
 * ⛓ WHAT IS AVAILABLE, AND IT IS NEW: **those four gates have never run in CI
 * at all.** `unittests_frontend.yml` runs `vitest` and the slow battery and
 * nothing else; a `check-*.mjs` that went red stayed red until somebody spent
 * the box. This step runs them on every push and prints a line a later reader
 * can quote by SHA.
 *
 * ── THE LINE, AND WHY IT IS SHAPED LIKE THIS ─────────────────────────
 *
 *   ## CI-GATE | <key> | <value> | exit=<n> | <the gate's own total line>
 *
 * Pipe-delimited because a standing KEY contains spaces and a colon, and a
 * whitespace-delimited format would need quoting rules nobody would get right
 * on the second reader. `ci-summary.mjs --gate=<key> <sha>` is that reader.
 *
 * ── ⛔ WHAT CI CANNOT ANSWER IS NAMED, NEVER SILENTLY GREEN ───────────
 *
 * `check-seedling-producer-boundaries.mjs` reads a MACHINE-GLOBAL latch cache
 * under `/mnt/c/playwright` that exists on exactly one box. Its VALUE here
 * would be `0 VERIFIED / 18 REFUSED` — measured, by pointing both cache
 * directories at paths that do not exist — which is §44.9 item 2's *"a row
 * that gates nothing"*. So it runs in `--structure` mode under the key
 * `structure: …`, which is a DIFFERENT KEY from its value row and can never
 * be quoted as one, and the value row stays the box's.
 *
 * ⛔ THIS STEP IS A STANDING-VALUE READER, NOT A MERGE GATE. It is wired with
 * `continue-on-error: true`, deliberately: `check-seedling-full-tier-owed` is
 * RED whenever a full tier is owed, which is a SCHEDULING fact and must not
 * block every push. The red is not hidden — it is in this step's own printed
 * line, and `ci-summary.mjs` reads the LINE, never the job conclusion (12g′'s
 * lesson: `continue-on-error` hides a red at the JOB level).
 *
 * Run:  node scripts/procgen/ci-gates.mjs [--json]
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { REPO, gateRoster } from './gateRoster.js';
import { gateStandingRows, headlineOf } from './standingValues.js';

const run = promisify(execFile);
const JSON_OUT = process.argv.includes('--json');

/** ⛓ The marker every consumer greps for — ONE spelling, exported. */
export const CI_GATE_MARK = '## CI-GATE |';

const roster = gateRoster({ repo: REPO });
const headless = roster.filter((g) => !g.browser && !g.windows);
const elsewhere = roster.filter((g) => g.browser || g.windows);

console.log('# ci-gates — the HEADLESS procgen gates, on this pushed head\n');
console.log(`## ${headless.length} of ${roster.length} gate(s) can run here. `
    + `${elsewhere.length} need a browser or a Windows GPU and are SKIPPED BY NAME below — `
    + 'never counted, never implied green.');

const rows = [];
for (const gate of headless) {
    /**
     * ⛓⛓ A GATE WHOSE VALUE CI CANNOT ANSWER DECLARES ITS OWN FACE
     * (`@ci-face`, read by `gateRoster`), and the declared prefix REPLACES
     * `gate:` — so its CI row is a DIFFERENT KEY and its value row is simply
     * not produced here, which is what makes a structure number unquotable as
     * a value.
     *
     * ⛔ THE FIRST CUT DETECTED THIS INSTEAD OF READING IT, and got trap 566
     * for the second time in one slice: `check-seedling-rerecord-rehearsal`
     * holds a `/mnt/c/playwright` path ONLY IN ORDER TO MEASURE THAT IT NEVER
     * TOUCHES IT, and a mention-detector filed its perfectly CI-answerable
     * 28/0 under a structure key. Whether a value survives a fresh checkout is
     * a fact only the gate knows.
     */
    const base = gateStandingRows(gate, [])[0].key;
    const argv = gate.ciFace ? gate.ciFace.argv : [];
    const key = gate.ciFace ? base.replace(/^gate:/, `${gate.ciFace.prefix}:`) : base;
    let out = '';
    let exit = 0;
    const t0 = Date.now();
    try {
        const r = await run('node', [gate.path, ...argv], { cwd: REPO, maxBuffer: 1 << 26 });
        out = `${r.stdout}${r.stderr}`;
    } catch (e) {
        exit = typeof e.code === 'number' ? e.code : 1;
        out = `${e.stdout ?? ''}${e.stderr ?? ''}` || String(e.message ?? e);
    }
    const { value, total } = headlineOf('gate', out);
    rows.push({ key, file: gate.file, argv, value, exit, total, ms: Date.now() - t0,
        face: gate.ciFace?.prefix ?? null });
    console.log(`${CI_GATE_MARK} ${key} | ${value} | exit=${exit} | ${total ?? '(no total)'}`);
    /**
     * ⛔⛔ **A RED LINE WITH NO EVIDENCE IS A RED NOBODY CAN ACT ON.** The
     * first CI run of this step printed `gate: seedling-full-tier-owed | 0/1`
     * and nothing else, and the reason — a depth-1 clone with no baseline
     * commit — was nowhere in the log. `gates.mjs` has echoed a failing gate's
     * own `FAIL:` lines since it existed; this owes the same.
     */
    if (exit !== 0 || value.includes('/0/')) {
        for (const line of out.split('\n')
            .filter((l) => l.startsWith('FAIL:') || l.startsWith('SKIP:')).slice(0, 8)) {
            console.log(`      ${line}`);
        }
    }
}

console.log('');
for (const g of elsewhere) {
    console.log(`## CI-SKIPPED | ${g.file} | ${g.windows ? 'needs a Windows GPU'
        : 'needs a browser'} — not run here, and NOT green`);
}

/**
 * ⛔ THE STEP'S OWN EXIT IS 0 BY DESIGN. Its job is to PRINT; the reds live in
 * the lines above and are read by `ci-summary.mjs --gate=` at a SHA. An exit
 * code here would either block every push on an owed measurement or, wrapped
 * in `continue-on-error`, be the exact thing 12g′ found hiding a red.
 */
if (JSON_OUT) console.log(JSON.stringify({ rows }, null, 2));
console.log(`\n${rows.length} headless gate(s) reported; `
    + `${rows.filter((r) => r.exit !== 0).length} non-zero; `
    + `${elsewhere.length} skipped by name.`);
process.exit(0);
