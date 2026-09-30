#!/usr/bin/env node
/**
 * measure-seedling-solver-surface — the DYNAMIC half of engine-prep C1: what
 * the solver family actually reaches in the simulation while its committed
 * routes are re-solved.
 *
 * Every committed-route producer that has a `--check` (the seven
 * `solve-seedling-*.mjs` rows of `standing-values.json`, and the R2–R4
 * `regenerate-r*-tapes.mjs` driver rows) is run TWICE as a child process:
 * once plain, once under `seedlingSolverSurfaceProbe/register.mjs`, which
 * redirects `levelRun.js` to a wrapper whose `createLevelRun` result is a
 * recording Proxy (and `run.world` / `run.state` / `run.worldFor()` one
 * level down). No simulation or solver file is edited.
 *
 * ⛔ A probe that changes its subject measures nothing: each route's exit
 * code, stdout and stderr under the probe must equal the plain run's BYTE
 * FOR BYTE once the producer's own printed wall times are masked — and `--check` itself asserts the solve still emits the
 * committed tapes — or this script refuses and writes nothing.
 *
 * Run:
 *   node scripts/procgen/measure-seedling-solver-surface.mjs            # print
 *   node scripts/procgen/measure-seedling-solver-surface.mjs --write    # + seedling-solver-surface-dynamic.json
 *   node scripts/procgen/measure-seedling-solver-surface.mjs --only=solve-seedling-r8-tail
 *
 * Wall time: a few minutes (the probe costs ~5× per route). Not a gate.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'seedling-solver-surface-dynamic.json');
const REGISTER = './scripts/procgen/seedlingSolverSurfaceProbe/register.mjs';

export const ROUTES = [
    'scripts/procgen/solve-seedling-r8-battery.mjs',
    'scripts/procgen/solve-seedling-r8-d2.mjs',
    'scripts/procgen/solve-seedling-r8-d2-chain.mjs',
    'scripts/procgen/solve-seedling-r8-l18.mjs',
    'scripts/procgen/solve-seedling-r8-tail.mjs',
    'scripts/procgen/solve-seedling-r9-l3.mjs',
    'scripts/procgen/solve-seedling-r9-campaign.mjs',
    'frontend/modules/seedlingDemo/fixtures/regenerate-r2-tapes.mjs',
    'frontend/modules/seedlingDemo/fixtures/regenerate-r3-tapes.mjs',
    'frontend/modules/seedlingDemo/fixtures/regenerate-r4-tapes.mjs',
];

const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
/**
 * The ONE normalisation: the `regenerate-r*-tapes.mjs` producers print their
 * own wall time per tape (`…, 12.3s`), and the probe is slower by design. The
 * tapes themselves are what `--check` asserts; everything else must match
 * byte for byte.
 */
export const WALL_TIME = /\b\d+\.\ds\b/g;
const norm = (b) => Buffer.from(b.toString('utf8').replace(WALL_TIME, '<wall>s'));

function runOnce(script, probeOut) {
    const t0 = Date.now();
    const args = probeOut ? ['--import', REGISTER, script, '--check'] : [script, '--check'];
    const r = spawnSync(process.execPath, args, {
        cwd: REPO, encoding: 'buffer', maxBuffer: 256 << 20,
        env: { ...process.env, ...(probeOut ? { SURFACE_PROBE_OUT: probeOut } : {}) },
    });
    return { exit: r.status, signal: r.signal, stdout: r.stdout, stderr: r.stderr, ms: Date.now() - t0 };
}

function main() {
    const argv = process.argv.slice(2);
    const write = argv.includes('--write');
    const only = argv.find((a) => a.startsWith('--only='))?.slice(7).split(',') ?? null;
    const routes = only ? ROUTES.filter((r) => only.some((o) => r.includes(o))) : ROUTES;
    if (only && write) {
        console.error('refused: --write needs the whole route list (drop --only=)');
        process.exit(2);
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-probe-'));
    const agg = new Map(); // surface\tname → {n, files:{}, sites:Set}
    const routeRows = [];
    let refused = false;
    for (const script of routes) {
        const plain = runOnce(script, null);
        const probeOut = path.join(tmp, `${path.basename(script)}.json`);
        const probed = runOnce(script, probeOut);
        const same = plain.exit === probed.exit && norm(plain.stdout).equals(norm(probed.stdout))
            && norm(plain.stderr).equals(norm(probed.stderr));
        const rawSame = plain.stdout.equals(probed.stdout) && plain.stderr.equals(probed.stderr);
        const row = {
            command: `node ${script} --check`,
            exit: plain.exit,
            stdoutMd5: md5(norm(plain.stdout)),
            stderrMd5: md5(norm(plain.stderr)),
            probedExit: probed.exit,
            probedStdoutMd5: md5(norm(probed.stdout)),
            probedStderrMd5: md5(norm(probed.stderr)),
            identical: same,
            byteIdentical: rawSame,
            msPlain: plain.ms,
            msProbed: probed.ms,
        };
        let rec = { runs: 0, rows: [] };
        try { rec = JSON.parse(fs.readFileSync(probeOut, 'utf8')); } catch { row.noRecord = true; }
        row.runs = rec.runs;
        routeRows.push(row);
        console.log(`${same ? (rawSame ? 'SAME' : 'SAME(wall-time normalised)') : 'DIFF'} exit=${plain.exit}/${probed.exit} `
            + `${plain.ms}ms→${probed.ms}ms runs=${rec.runs} ${script}`);
        if (!same || plain.exit !== 0 || row.noRecord) {
            refused = true;
            if (!same) {
                const dump = path.join(os.tmpdir(), `surface-probe-diff-${path.basename(script)}`);
                fs.writeFileSync(`${dump}.plain.out`, plain.stdout);
                fs.writeFileSync(`${dump}.probed.out`, probed.stdout);
                console.log(`  stdout of both runs: ${dump}.{plain,probed}.out`);
            }
        }
        for (const r of rec.rows) {
            const k = `${r.surface}\t${r.name}`;
            if (!agg.has(k)) agg.set(k, { surface: r.surface, name: r.name, n: 0, files: {}, sites: new Set(), routes: new Set() });
            const a = agg.get(k);
            a.n += r.n;
            const file = r.site.replace(/:\d+$/, '');
            a.files[file] = (a.files[file] ?? 0) + r.n;
            a.sites.add(r.site);
            a.routes.add(path.basename(script));
        }
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    const members = [...agg.values()]
        .map((a) => ({
            surface: a.surface, name: a.name, reads: a.n,
            files: Object.fromEntries(Object.entries(a.files).sort(([x], [y]) => x.localeCompare(y))),
            sites: [...a.sites].sort(),
            routes: [...a.routes].sort(),
        }))
        .sort((x, y) => (x.surface + x.name).localeCompare(y.surface + y.name));
    const bySurface = {};
    for (const m of members) bySurface[m.surface] = (bySurface[m.surface] ?? 0) + 1;
    console.log(`\nmembers reached: ${JSON.stringify(bySurface)} over ${routes.length} route(s)`);
    if (refused) {
        console.log('REFUSED: a route differed under the probe, failed plain, or left no record — nothing written');
        process.exit(1);
    }
    if (write) {
        fs.writeFileSync(OUT, `${JSON.stringify({
            note: 'GENERATED by scripts/procgen/measure-seedling-solver-surface.mjs --write — do not edit by hand. '
                + 'Every string property read on a createLevelRun result (and on the world/state it hands out) '
                + 'while each route ran its --check, by the caller file the stack names. `identical` is the proof '
                + 'that the probe did not change its subject.',
            routes: routeRows,
            members,
        }, null, 2)}\n`);
        console.log(`wrote ${path.relative(REPO, OUT)}`);
    }
}

main();
