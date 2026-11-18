/**
 * regen-seedling — **THE SEEDLING PLAYTHROUGH PRODUCER CHAIN, IN ORDER, AS ONE COMMAND** (slice seedling-regen-chain;
 * ⚖ Robert 2026-11-17 "Regen-chain command (Recommended)").
 *
 * The playthrough's committed artifacts are made by ten steps that each read what the step before wrote. The order was
 * written down only in commit messages (`d416af4243`, the L99 kill-lock re-record) and its report; `STEPS` below is that
 * order as DATA, and this file runs it. It ORCHESTRATES: every step is the producer's own command, unchanged; nothing
 * here knows a rule, a level or a sphere.
 *
 *   rules → partition → world → template → host-settings → seed1 → maze → er → sphere-order → census
 *
 * Usage:
 *   node scripts/procgen/regen-seedling.mjs [--check]          # default: each step's own check, in order; exit 0 only if all OK
 *   node scripts/procgen/regen-seedling.mjs --write            # run the producers into the tree, then git status + md5s
 *   node scripts/procgen/regen-seedling.mjs --list             # the steps, their commands, inputs and outputs
 *   node scripts/procgen/regen-seedling.mjs --from=<step>      # that step and every later one (with --check or --write)
 *   node scripts/procgen/regen-seedling.mjs --only=<step>[,<step>]   # just those steps, in chain order
 *
 * One line per step: `OK` / `STALE: <what>` / `REFUSED: <quoted reason>` / `SKIPPED: <why>` (`--check`), or
 * `WROTE` / `FAILED: <what>` / `REFUSED: …` (`--write`). Each step's full output goes to `.cache/regen-seedling/`.
 *
 * ⛓ WHAT A CHECK IS, PER STEP. A producer with a `--check` of its own is asked for it. A step with none says so in its
 * `check` note and is checked by REGENERATING INTO A SCRATCH DIR and byte-comparing: `template` (the yaml templates into a
 * temp dir), `seed1` (Generate.py has no output-dir switch — `exporter.py` writes `frontend/presets/` — so the committed
 * files are moved aside, regenerated in place, compared, and the committed bytes put back, whatever the outcome).
 * `host-settings` has no product to regenerate: it reads `host.yaml` against `update_host_settings.py`'s own preset table.
 *
 * ⛔ THE DERIVED-RULE TABLE IS NOT A STEP. `seedling-playthrough-derived-rules.json` is CI's (its recipe is the
 * `seedling-probe.yml` dispatch, `seedlingDerivedRuleTable.js` `REGEN_RECIPE`); the chain only READS it, through `rules`.
 * When it is stale, `rules --check` refuses `STALE derived-rule table: …` and the chain prints that as `REFUSED`, by name.
 *
 * ⛔ `--write` leaves only what the recipe writes. `Generate.py` drops `preset_files.json`'s final newline (restored) and
 * writes `output/AP_<seed>*` (removed: only the files that were not there before). A row the exporter rewrote for any
 * OTHER game, or a `seed` field that is not 1, fails the step and puts the committed index back.
 *
 * Python steps run under `.venv/bin/python` when it exists, else `python3`; the chain prints which.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, rmdirSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** The world package this chain regenerates: its recipe row names the source rules, the game and the canonical seed. */
export const PACKAGE = 'seedling_playthrough';
export const RECIPES_FILE = 'scripts/data/worldgen-package-recipes.json';
const LOG_DIR = '.cache/regen-seedling';
const ATLASES = 'frontend/modules/flashPanel/atlases';
const PRESET_INDEX = 'frontend/presets/preset_files.json';

/** The recipe row for `PACKAGE` (`{source, game_name, canonical_seed}`), and the preset key its source lives under. */
export function readRecipe(repo = REPO) {
    const row = JSON.parse(readFileSync(join(repo, RECIPES_FILE), 'utf8')).packages[PACKAGE];
    if (!row) throw new Error(`${RECIPES_FILE} has no "${PACKAGE}" row`);
    const m = /^frontend\/presets\/([^/]+)\//.exec(row.source);
    if (!m) throw new Error(`${RECIPES_FILE} ${PACKAGE}.source is not under frontend/presets/: ${row.source}`);
    return { ...row, presetKey: m[1] };
}

const py = (code) => code.replace(/\s*\n\s*/g, ' ').trim();

/**
 * THE CHAIN, as data. `write` / `check` are argv arrays (`node` / `python` resolved at run time), or a `scratch` check
 * named by the runner. `inputs` / `outputs` are repo paths (an output ending in `/` is a directory); `committed: false`
 * marks a gitignored product. Nothing here runs anything.
 *
 * @param {{recipe: {source: string, game_name: string, canonical_seed?: number, presetKey: string}, seedId: string}} ctx
 */
export function buildSteps({ recipe, seedId }) {
    const template = `Players/Templates/${recipe.game_name}.yaml`;
    const seedDir = `frontend/presets/${recipe.presetKey}/${seedId}`;
    const seedFiles = ['.archipelago', '_Spoiler.txt', '_rules.json', '_sphere_log.jsonl'].map((s) => `${seedDir}/${seedId}${s}`);
    const node = (script, ...args) => ['node', `scripts/procgen/${script}`, ...args];
    return [
        {
            id: 'rules', title: 'the playthrough atlas + AP_1 rules',
            write: node('make-seedling-playthrough-rules.mjs'),
            check: node('make-seedling-playthrough-rules.mjs', '--check'),
            inputs: [`${ATLASES}/seedling-map.json`, `${ATLASES}/seedling-playthrough-derived-rules.json`, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'],
            outputs: [`${ATLASES}/seedling-playthrough.json`, recipe.source],
            note: 'reads the derived-rule table (CI\'s, not a step); --check refuses a stale one. A new atlas id also needs atlas_files.json (hand-kept).',
        },
        {
            id: 'partition', title: 'the sub-region partition',
            write: node('make-seedling-subregion-partition.mjs'),
            check: node('make-seedling-subregion-partition.mjs', '--check'),
            inputs: [`${ATLASES}/seedling-playthrough.json`],
            outputs: [`${ATLASES}/seedling-subregion-partition.json`],
        },
        {
            id: 'world', title: `worlds/${PACKAGE} by its recipe`,
            write: ['python', '-c', py(`
                import sys, subprocess; sys.path.insert(0, 'scripts');
                from lib.worldgen_recipe import load_recipes, world_generator_command;
                r = load_recipes('.')['${PACKAGE}'];
                sys.exit(subprocess.run(world_generator_command(r['source'], 'worlds/${PACKAGE}', r['game_name'],
                    r.get('canonical_seed'), r.get('victory_location', False))).returncode)`)],
            check: ['python', 'scripts/test/check-worldgen-package-freshness.py', PACKAGE],
            inputs: [RECIPES_FILE, recipe.source],
            outputs: [`worlds/${PACKAGE}/`],
        },
        {
            id: 'template', title: `the "${recipe.game_name}" template (gitignored)`,
            write: ['python', '-c', "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"],
            check: 'scratch-template',
            inputs: [`worlds/${PACKAGE}/`],
            outputs: [template], committed: false,
            note: 'no check of its own: the templates are regenerated into a temp dir and this one byte-compared',
        },
        {
            id: 'host-settings', title: 'host.yaml = minimal-spoilers (gitignored)',
            write: ['python', 'scripts/setup/update_host_settings.py', 'minimal-spoilers'],
            check: ['python', '-c', py(`
                import importlib.util, sys, yaml;
                s = importlib.util.spec_from_file_location('uhs', 'scripts/setup/update_host_settings.py');
                m = importlib.util.module_from_spec(s); s.loader.exec_module(m);
                d = yaml.safe_load(open('host.yaml'));
                bad = [f"{k}={(d.get('general_options' if k in m.GENERAL_OPTIONS_BOOLEAN_SETTINGS else 'json_tools') or {}).get(k)!r} (want {v!r})"
                    for k, v in m.PRESETS['minimal-spoilers'].items()
                    if (d.get('general_options' if k in m.GENERAL_OPTIONS_BOOLEAN_SETTINGS else 'json_tools') or {}).get(k) != v];
                print('ERROR: host.yaml is not minimal-spoilers: ' + ', '.join(bad) if bad else 'OK: host.yaml is minimal-spoilers');
                sys.exit(1 if bad else 0)`)],
            inputs: ['scripts/setup/update_host_settings.py'],
            outputs: ['host.yaml'], committed: false,
            note: 'no product to regenerate: reads host.yaml against update_host_settings.py\'s own PRESETS[\'minimal-spoilers\']',
        },
        {
            id: 'seed1', title: `Generate.py seed 1 → ${seedDir} + its ${PRESET_INDEX} row`,
            write: ['python', 'Generate.py', '--weights_file_path', `Templates/${recipe.game_name}.yaml`, '--multi', '1', '--seed', '1'],
            check: 'scratch-seed1',
            inputs: [template, 'host.yaml', `worlds/${PACKAGE}/`],
            outputs: [...seedFiles, PRESET_INDEX],
            presetKey: recipe.presetKey,
            note: 'no check of its own: the committed files are moved aside, regenerated in place, compared, and put back',
        },
        {
            id: 'maze', title: 'the seedling_playthrough_maze preset',
            write: node('make-seedling-playthrough-maze.mjs'),
            check: node('make-seedling-playthrough-maze.mjs', '--check'),
            inputs: [`${ATLASES}/seedling-playthrough.json`, `${ATLASES}/seedling-subregion-partition.json`],
            outputs: ['frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'],
        },
        {
            id: 'er', title: 'the seedling_er preset',
            write: node('make-seedling-er-preset.mjs'),
            check: node('make-seedling-er-preset.mjs', '--check'),
            inputs: [`${ATLASES}/seedling-playthrough.json`, `${ATLASES}/seedling-playthrough-derived-rules.json`],
            outputs: ['frontend/presets/seedling_er/AP_1/AP_1_rules.json'],
        },
        {
            id: 'sphere-order', title: 'the campaign\'s sphere order (from the seed-1 sphere log)',
            write: node('make-seedling-sphere-order.mjs'),
            check: node('make-seedling-sphere-order.mjs', '--check'),
            inputs: [seedFiles[3]],
            outputs: [`${ATLASES}/seedling-sphere-order.json`],
        },
        {
            id: 'census', title: 'census-seedling-campaign --check-frontier (check only)',
            write: null,
            check: node('census-seedling-campaign.mjs', '--check-frontier', '--no-write'),
            inputs: [recipe.source, `${ATLASES}/seedling-sphere-order.json`],
            outputs: [],
            note: 'a check, not a producer: --write runs the same check (--write-frontier needs the surveys, which a re-record does not make)',
        },
    ];
}

const KNOWN_FLAGS = ['--check', '--write', '--list'];

/**
 * The argv → `{mode, from, only}` (`mode`: 'check' | 'write' | 'list'). Throws a usage error by name.
 * @param {string[]} argv the arguments after the script
 * @param {string[]} stepIds the chain's ids, in order
 */
export function parseArgs(argv, stepIds) {
    const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a) && !a.startsWith('--from=') && !a.startsWith('--only='));
    if (unknown.length) throw new Error(`unknown argument(s): ${unknown.join(' ')}`);
    const check = argv.includes('--check');
    const write = argv.includes('--write');
    const list = argv.includes('--list');
    if ([check, write, list].filter(Boolean).length > 1) throw new Error('--check, --write and --list are exclusive');
    const fromArg = argv.find((a) => a.startsWith('--from='))?.slice('--from='.length);
    const onlyArg = argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);
    if (fromArg !== undefined && onlyArg !== undefined) throw new Error('--from= and --only= are exclusive');
    const known = (id) => {
        if (!stepIds.includes(id)) throw new Error(`no step "${id}" (the steps: ${stepIds.join(', ')})`);
        return id;
    };
    const from = fromArg === undefined ? null : known(fromArg);
    const only = onlyArg === undefined ? null : onlyArg.split(',').filter(Boolean).map(known);
    if (only && !only.length) throw new Error('--only= names no step');
    return { mode: write ? 'write' : list ? 'list' : 'check', from, only };
}

/** The steps a parsed argv selects, in chain order. */
export function selectSteps(steps, { from, only }) {
    if (only) return steps.filter((s) => only.includes(s.id));
    if (from) return steps.slice(steps.findIndex((s) => s.id === from));
    return steps;
}

/** The first line of a refusal the chain names (the derived-rule table's staleness), cut before its long recipe. */
const REFUSALS = [/STALE derived-rule table: .*?(?= — regenerate:|$)/];

/**
 * One step's verdict from its exit code and output. A named refusal wins; then the step's own failure lines
 * (`ERROR:` / `FAIL:` / `FAIL `); anything else non-zero is a refusal quoting the last line.
 */
export function classify(code, out, mode = 'check') {
    for (const re of REFUSALS) {
        const m = re.exec(out);
        // --write: the producer WROTE and warned (it refuses only on --check); name it, keep going, fail the exit.
        if (m && mode === 'write' && code === 0) return { verdict: 'WROTE', why: `⚠ WARN ${m[0]}`, warn: true };
        if (m) return { verdict: 'REFUSED', why: m[0] };
    }
    const skips = out.split('\n').filter((l) => /^SKIP\b/.test(l)).length;
    if (code === 0) {
        return { verdict: mode === 'write' ? 'WROTE' : 'OK', why: skips ? `${skips} SKIP row(s) in its output` : '' };
    }
    const fails = out.split('\n').filter((l) => /^(ERROR|FAIL)\b:?/.test(l.trim())).map((l) => l.trim());
    if (fails.length) {
        return { verdict: mode === 'write' ? 'FAILED' : 'STALE', why: fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} more)` : '') };
    }
    const last = out.trim().split('\n').pop() ?? '';
    return { verdict: 'REFUSED', why: `exit ${code}: ${last.trim()}` };
}

/** The line a step prints. */
export function formatLine(step, { verdict, why }, ms) {
    const secs = ms === null || ms === undefined ? '' : ` [${(ms / 1000).toFixed(1)}s]`;
    return `${step.id.padEnd(14)} ${verdict}${why ? `: ${why}` : ''}${secs}`;
}

// ── running ─────────────────────────────────────────────────────────────

function pythonBin(repo) {
    const venv = join(repo, '.venv/bin/python');
    return existsSync(venv) ? venv : 'python3';
}

function run(argv, python) {
    const [cmd, ...args] = argv;
    const bin = cmd === 'python' ? python : cmd === 'node' ? process.execPath : cmd;
    const t = Date.now();
    const r = spawnSync(bin, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}`;
    return { code: r.status ?? 1, out, ms: Date.now() - t };
}

const md5 = (buf) => createHash('md5').update(buf).digest('hex');

/** `template` without a check of its own: the templates into a temp dir, this one byte-compared. */
function scratchTemplate(step, python) {
    const dir = mkdtempSync(join(tmpdir(), 'regen-seedling-tpl-'));
    try {
        const r = run(['python', '-c', `from Options import generate_yaml_templates; generate_yaml_templates(${JSON.stringify(dir)})`], python);
        if (r.code) return { ...r, result: classify(r.code, r.out) };
        const rel = step.outputs[0];
        const fresh = join(dir, rel.split('/').pop());
        if (!existsSync(fresh)) return { ...r, result: { verdict: 'REFUSED', why: `generate_yaml_templates wrote no ${rel.split('/').pop()}` } };
        if (!existsSync(join(REPO, rel))) return { ...r, result: { verdict: 'STALE', why: `${rel} is missing` } };
        const same = readFileSync(fresh).equals(readFileSync(join(REPO, rel)));
        return { ...r, result: same ? { verdict: 'OK', why: `${rel} matches a fresh build` } : { verdict: 'STALE', why: `${rel} differs from a fresh build` } };
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

const readMaybe = (p) => (existsSync(p) ? readFileSync(p) : null);

/**
 * `seed1`, for both modes. Generate.py writes into the tree (`exporter.py`: `frontend/presets/`, and `output/`), so:
 * the committed bytes are snapshotted, the four seed files deleted (a run that writes nothing cannot pass by leaving
 * them), Generate.py run, and its products judged. `--check` then restores the snapshot whatever happened; `--write`
 * keeps the products, restores the index's final newline, and restores the snapshot on any failure.
 */
function seed1(step, python, mode) {
    const files = step.outputs.filter((f) => f !== PRESET_INDEX).map((f) => join(REPO, f));
    const index = join(REPO, PRESET_INDEX);
    const outDir = join(REPO, 'output');
    const outBefore = existsSync(outDir) ? new Set(readdirSync(outDir)) : null;
    const snap = new Map([...files, index].map((f) => [f, readMaybe(f)]));
    const restore = () => {
        for (const [f, buf] of snap) {
            if (buf === null) rmSync(f, { force: true });
            else { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, buf); }
        }
    };
    let keep = false;
    let r = { code: 1, out: '', ms: 0 };
    try {
        for (const f of files) rmSync(f, { force: true });
        r = run(step.write, python);
        if (r.code) return { ...r, result: classify(r.code, r.out, mode) };
        const missing = files.filter((f) => !existsSync(f));
        if (missing.length) return { ...r, result: { verdict: 'REFUSED', why: `Generate.py wrote no ${missing.map((f) => f.slice(REPO.length + 1)).join(', ')}` } };
        // ⛔ the index: only this game's row may move, and its seed is 1 (a row kept from before is not evidence).
        const before = snap.get(index) ? JSON.parse(snap.get(index).toString('utf8')) : {};
        const afterText = readFileSync(index, 'utf8');
        const after = JSON.parse(afterText);
        const key = step.presetKey;
        const others = [...new Set([...Object.keys(before), ...Object.keys(after)])]
            .filter((k) => k !== key && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
        if (others.length) return { ...r, result: { verdict: mode === 'write' ? 'FAILED' : 'STALE', why: `the exporter rewrote ${PRESET_INDEX} rows it does not own: ${others.join(', ')}` } };
        const seedId = files[0].split('/').slice(-2)[0];
        const row = after[key]?.folders?.[seedId];
        if (!row) return { ...r, result: { verdict: 'REFUSED', why: `${PRESET_INDEX} has no ${key}/${seedId} row after Generate.py` } };
        if (row.seed !== 1) return { ...r, result: { verdict: mode === 'write' ? 'FAILED' : 'STALE', why: `${PRESET_INDEX} ${key}/${seedId}.seed is ${JSON.stringify(row.seed)}, not 1` } };
        if (!afterText.endsWith('\n')) writeFileSync(index, `${afterText}\n`);
        const differ = [...snap.keys()].filter((f) => {
            const was = snap.get(f);
            return was === null || !was.equals(readFileSync(f));
        }).map((f) => f.slice(REPO.length + 1));
        if (mode === 'write') {
            keep = true;
            return { ...r, result: { verdict: 'WROTE', why: differ.length ? `changed: ${differ.join(', ')}` : 'byte-identical to before' } };
        }
        return { ...r, result: differ.length ? { verdict: 'STALE', why: `differs from a fresh build: ${differ.join(', ')}` } : { verdict: 'OK', why: `${files.length} files + the ${key} row match a fresh build` } };
    } finally {
        if (!keep) restore();
        // Generate.py's own output copies: remove only what this run created.
        if (existsSync(outDir)) {
            for (const name of readdirSync(outDir)) if (!outBefore?.has(name)) rmSync(join(outDir, name), { recursive: true, force: true });
            if (outBefore === null && readdirSync(outDir).length === 0) rmdirSync(outDir);
        }
    }
}

function runStep(step, mode, python) {
    if (step.id === 'seed1') return seed1(step, python, mode);
    if (mode === 'write') {
        if (!step.write) {
            const r = run(step.check, python);
            const c = classify(r.code, r.out, 'check');
            return { ...r, result: c.verdict === 'OK' ? { verdict: 'CHECKED', why: `no producer; its check is OK${c.why ? ` (${c.why})` : ''}` } : c };
        }
        const r = run(step.write, python);
        return { ...r, result: classify(r.code, r.out, 'write') };
    }
    if (step.check === 'scratch-template') return scratchTemplate(step, python);
    const r = run(step.check, python);
    return { ...r, result: classify(r.code, r.out, 'check') };
}

function show(argv) {
    return argv.map((a) => (/[\s'"()]/.test(a) ? `'${a.replace(/'/g, "'\\''")}'` : a)).join(' ');
}

function listSteps(steps) {
    for (const [i, s] of steps.entries()) {
        console.log(`${i + 1}. ${s.id} — ${s.title}`);
        console.log(`   write:   ${s.write ? show(s.write) : '(none: a check only)'}`);
        console.log(`   check:   ${typeof s.check === 'string' ? `(${s.check}) ${s.note}` : show(s.check)}`);
        if (s.inputs.length) console.log(`   inputs:  ${s.inputs.join(', ')}`);
        if (s.outputs.length) console.log(`   outputs: ${s.outputs.join(', ')}${s.committed === false ? ' (gitignored)' : ''}`);
        if (s.note && typeof s.check !== 'string') console.log(`   note:    ${s.note}`);
    }
}

function git(args) {
    return spawnSync('git', args, { cwd: REPO, encoding: 'utf8' }).stdout ?? '';
}

/** md5 of every committed file the steps that ran name as outputs (a directory: its tracked files). */
function touchedArtifacts(steps) {
    const rows = [];
    for (const s of steps) {
        if (s.committed === false) continue;
        for (const o of s.outputs) {
            const files = o.endsWith('/') ? git(['ls-files', o]).split('\n').filter(Boolean) : [o];
            for (const f of files) {
                const buf = readMaybe(join(REPO, f));
                const changed = git(['status', '--short', '--', f]).trim() !== '';
                rows.push(`  ${buf ? md5(buf) : '(missing)'.padEnd(32)}  ${changed ? 'M' : ' '} ${f}`);
            }
        }
    }
    return rows;
}

async function main() {
    const recipe = readRecipe();
    const python = pythonBin(REPO);
    const sid = spawnSync(python, ['-c', "import sys; sys.path.insert(0, 'scripts/lib'); from seed_utils import get_seed_id; print(get_seed_id(1))"],
        { cwd: REPO, encoding: 'utf8' });
    if (sid.status !== 0) {
        console.error(`REFUSED: could not compute the seed-1 id with ${python}: ${(sid.stderr || sid.stdout).trim()}`);
        process.exit(2);
    }
    const steps = buildSteps({ recipe, seedId: sid.stdout.trim() });
    let opts;
    try {
        opts = parseArgs(process.argv.slice(2), steps.map((s) => s.id));
    } catch (err) {
        console.error(`regen-seedling: ${err.message}. See --help.`);
        process.exit(2);
    }
    if (opts.mode === 'list') { listSteps(steps); return; }

    const chosen = selectSteps(steps, opts);
    mkdirSync(join(REPO, LOG_DIR), { recursive: true });
    console.log(`regen-seedling --${opts.mode}: ${chosen.length} step(s); python = ${python}; logs in ${LOG_DIR}/`);
    const t0 = Date.now();
    let bad = 0;
    for (const step of chosen) {
        const r = runStep(step, opts.mode, python);
        writeFileSync(join(REPO, LOG_DIR, `${step.id}.${opts.mode}.log`), r.out);
        console.log(formatLine(step, r.result, r.ms));
        if (r.result.warn) bad += 1;
        else if (!['OK', 'WROTE', 'CHECKED'].includes(r.result.verdict)) {
            bad += 1;
            if (opts.mode === 'write') {
                // A later producer would read a broken input: stop, and say what was not run.
                const rest = chosen.slice(chosen.indexOf(step) + 1);
                for (const s of rest) console.log(formatLine(s, { verdict: 'SKIPPED', why: `${step.id} did not write` }, null));
                break;
            }
        }
    }
    console.log(`total ${((Date.now() - t0) / 1000).toFixed(1)}s — ${bad ? `${bad} step(s) not OK` : 'every step OK'}`);
    if (opts.mode === 'write') {
        const status = git(['status', '--short']).trimEnd();
        console.log(`\ngit status --short:${status ? `\n${status}` : ' (empty)'}`);
        console.log('\nmd5 of the committed artifacts these steps write (M = differs from HEAD):');
        for (const row of touchedArtifacts(chosen)) console.log(row);
    }
    process.exit(bad ? 1 : 0);
}

if (isEntryPoint(import.meta.url)) await main();
