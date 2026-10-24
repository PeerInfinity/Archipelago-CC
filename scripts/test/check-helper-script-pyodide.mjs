#!/usr/bin/env node
/**
 * The helper-script converter, run in a REAL Pyodide from Node — the page's
 * Python path without a browser: the files the two manifests list (the
 * exporter subset + world_generator), written into Pyodide's filesystem, and
 * `convertInPyodide` — the same function `helperScriptWorker.js` calls.
 *
 * Checks:
 *   1. a hand-written script → helpers → Python → helpers is unchanged;
 *   2. the alttp_worldgen preset's `helpers` → Python → helpers is unchanged
 *      (36/36 on 2026-10-20), with the preset as `rules` (option definitions);
 *   3. nothing from Archipelago (or astunparse) was imported.
 *
 * Needs the `pyodide` npm package at the pinned version, which is NOT a
 * dependency of this repo (it is ~10 MB and only this check uses it):
 *
 *   npm i --no-save pyodide@0.28.3
 *   node scripts/test/check-helper-script-pyodide.mjs
 *
 * Exit 0 = all checks pass; 1 = a check failed; 2 = no usable pyodide.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PACKAGE_ROOT, PYODIDE_VERSION } from '../../frontend/modules/pyodideRuntime/pyodideRuntime.js';
import { convertInPyodide } from '../../frontend/modules/helperScript/helperScriptCore.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFESTS = [
    'frontend/modules/helperScript/helperScriptFiles.json',
    'frontend/modules/apworldBuild/worldGeneratorFiles.json',
];
const SCRIPT = `
def has_light(state, player):
    return state.has("Lantern", player) or state.has("Torch", player)

def can_enter_cave(state, player, keys=2):
    return has_light(state, player) and state.has("Cave Key", player, keys)
`;

async function loadPinnedPyodide() {
    let mod;
    try {
        mod = await import('pyodide');
    } catch {
        console.error(`no 'pyodide' package — run: npm i --no-save pyodide@${PYODIDE_VERSION}`);
        process.exit(2);
    }
    const py = await mod.loadPyodide();
    if (py.version !== PYODIDE_VERSION) {
        console.error(`pyodide ${py.version} installed, ${PYODIDE_VERSION} pinned — run: npm i --no-save pyodide@${PYODIDE_VERSION}`);
        process.exit(2);
    }
    return py;
}

function writePackages(py) {
    for (const manifest of MANIFESTS) {
        const { package: pkg, files } = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, manifest), 'utf8'));
        for (const rel of files) {
            const target = `${PACKAGE_ROOT}/${pkg}/${rel}`;
            py.FS.mkdirTree(target.slice(0, target.lastIndexOf('/')));
            py.FS.writeFile(target, fs.readFileSync(path.join(REPO_ROOT, pkg, rel)));
        }
    }
    py.runPython(`import sys\nsys.path.insert(0, ${JSON.stringify(PACKAGE_ROOT)})`);
}

function alttpWorldgenRules() {
    const dir = path.join(REPO_ROOT, 'frontend/presets/alttp_worldgen');
    const seed = fs.readdirSync(dir).find(d => d.startsWith('AP_'));
    return JSON.parse(fs.readFileSync(path.join(dir, seed, `${seed}_rules.json`), 'utf8'));
}

/** Deep equality the way Python's == sees two JSON values (key order ignored). */
function sameJson(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && sameJson(a[k], b[k]));
}

function roundTrip(py, helpers, rules) {
    const t0 = performance.now();
    const code = convertInPyodide(py, 'toPython', { helpers, rules });
    const t1 = performance.now();
    const back = convertInPyodide(py, 'toHelpers', { source: code.code });
    const t2 = performance.now();
    const differ = Object.keys(helpers).filter(k => !sameJson(back.helpers[k], helpers[k]));
    return { code, back, differ, toPythonMs: Math.round(t1 - t0), toHelpersMs: Math.round(t2 - t1) };
}

const failures = [];
const py = await loadPinnedPyodide();
writePackages(py);

const fromScript = convertInPyodide(py, 'toHelpers', { source: SCRIPT });
if (fromScript.errors.length) failures.push(`script → helpers errors: ${fromScript.errors.join('; ')}`);
const script = roundTrip(py, fromScript.helpers, null);
console.log(`hand-written script: ${Object.keys(fromScript.helpers).length} helpers, `
    + `${script.differ.length} differ after the round trip`);
if (script.differ.length || script.back.errors.length) failures.push(`script round trip: differ ${script.differ}, errors ${script.back.errors}`);

const rules = alttpWorldgenRules();
const preset = roundTrip(py, rules.helpers['1'], rules);
const total = Object.keys(rules.helpers['1']).length;
console.log(`alttp_worldgen: ${total - preset.differ.length}/${total} identical after JSON → Python → JSON `
    + `(toPython ${preset.toPythonMs} ms, toHelpers ${preset.toHelpersMs} ms)`);
if (preset.differ.length || preset.back.errors.length || preset.code.errors.length) {
    failures.push(`alttp_worldgen round trip: differ ${preset.differ.join(', ')}; errors ${[...preset.code.errors, ...preset.back.errors].join('; ')}`);
}

const leaked = py.runPython(`
import sys
sorted(m for m in sys.modules
       if m.split('.')[0] in ('BaseClasses', 'worlds', 'Utils', 'Options', 'astunparse') or m == 'exporter.exporter')
`).toJs();
console.log(`modules from outside the served files: ${leaked.length ? leaked.join(', ') : 'none'}`);
if (leaked.length) failures.push(`imported: ${leaked.join(', ')}`);

console.log(`Python ${py.runPython('import sys; sys.version.split()[0]')} (Pyodide ${py.version})`);
if (failures.length) {
    for (const f of failures) console.error(`FAIL ${f}`);
    process.exit(1);
}
console.log('OK');
