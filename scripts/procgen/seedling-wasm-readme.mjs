#!/usr/bin/env node
/**
 * seedling-wasm-readme — **WRITE (AND GATE) THE seedling-wasm README'S BUILD
 * TABLE FROM `builds.json`** (SEEDLING ORIGINAL WASM slice W2, ⚖ user
 * 2026-09-07: the build table *"GENERATED from `builds.json` with a check
 * gate"*, and *"I want to fix the false and stale things in the readme"*).
 *
 * ⛓ THE WRITER AND THE CHECKER ARE ONE IMPLEMENTATION, and the checker is not
 * this file's — it is `seedlingWasmReadme.js`'s `checkReadme`, which
 * `check-seedling-wasm-pins.mjs` ALSO imports as a row. So the table is gated
 * by CI's existing seedling-wasm step 1 rather than by a new job, and a mutant
 * that broke the rendering could not leave one of the two green.
 *
 * ⛔ THIS FILE IS THE COMMAND AND NOTHING ELSE. Everything it knows is in the
 * library beside it; the gate must never import THIS file, because `argvHelp`
 * runs at module scope and ESM imports are hoisted — a gate importing an
 * instrument answers `--help` with the wrong file's help.
 *
 * ⛔ IT WRITES INTO ANOTHER REPOSITORY. The README is
 * `frontend/modules/flashPanel/wasm/README.md`, a file of the seedling-wasm
 * SUBMODULE: `--write` leaves the change staged for a commit THERE, and the
 * outer repo sees only "modified content".
 *
 * Run:
 *   node scripts/procgen/seedling-wasm-readme.mjs --check    # gate: exit 1 on a stale block
 *   node scripts/procgen/seedling-wasm-readme.mjs --write    # rewrite the block in place
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { relative, resolve } from 'node:path';

import { argvHelp } from './argvHelp.js';
import {
    README_TABLE, SUBMODULE_DIR, checkReadme, manifestFieldProblems, readSubmodule, renderReadme,
} from './seedlingWasmReadme.js';

argvHelp(import.meta.url);

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const REPO_REL = (p) => relative(process.cwd(), p) || p;

/**
 * ⛔ MODULE SCOPE DOES NOTHING — not a read, not an exit. `check-procgen-help
 * .mjs` asks two doors of every instrument here, and the IMPORT door is the
 * one a `main()` guard exists for: 37 test files import from this directory,
 * so anything at module scope runs inside vitest, in CI.
 */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

function main() {
    /**
     * ⛔ THE SHAPE OF THE THREE FIELDS IS CHECKED FIRST, IN BOTH MODES. A
     * `--write` that rendered `(no `source`)` into the published README would
     * be a generator committing the very defect it exists to retire, so the
     * CLI refuses here and the pins gate carries the same finding as a row.
     */
    const { manifest } = readSubmodule(SUBMODULE_DIR);
    const fieldProblems = manifestFieldProblems(manifest);
    if (fieldProblems.length) {
        console.log(`${fieldProblems.length} MANIFEST PROBLEM(S) — the table is not written:`);
        for (const p of fieldProblems) console.log(`  FAIL: ${p}`);
        process.exit(1);
    }

    if (flag('check')) {
        const r = checkReadme(SUBMODULE_DIR);
        for (const p of r.problems) console.log(`FAIL: ${p}`);
        for (const d of r.diff) console.log(d);
        console.log(r.ok
            ? `OK: the seedling-wasm README's \`${README_TABLE}\` region is what builds.json says`
            : '\n1 GENERATED REGION DIFFERS — run this with --write');
        process.exit(r.ok ? 0 : 1);
    }

    if (!flag('write')) {
        console.log('seedling-wasm-readme: pass --check (gate) or --write (rewrite the region). '
            + 'Neither was given, so nothing was read and nothing was written.');
        process.exit(1);
    }

    const { text, changed, readmePath } = renderReadme(SUBMODULE_DIR);
    if (!changed) {
        console.log(`OK: ${REPO_REL(readmePath)} § ${README_TABLE} was already current `
            + '— not written');
        process.exit(0);
    }
    writeFileSync(readmePath, text);
    console.log(`wrote ${REPO_REL(readmePath)} § ${README_TABLE} `
        + `— ${manifest.builds.length} build(s)`);
}
