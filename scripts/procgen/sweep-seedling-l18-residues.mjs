#!/usr/bin/env node
/**
 * sweep-seedling-l18-residues — ⛓ SEEDLING HAMMER-PHASE A W0: L18's press kill across the hammer's 45 phases.
 *
 * `r9-solve-18`'s committed staging with `seam.time` alone moved to each residue of `Game.time mod 45` (the phase
 * `spinner.hammerLine` swings at), solved by `twoPassSolve` exactly as `fidelityF1c.test.js`'s `solveAt` (and
 * `solve-seedling-r9-campaign`) calls it. One line per residue: the verdict, the solve's length, the wall time, a
 * digest of the keys, the escapes and phase stalls it took, and the refusal's head. Every solve is REPLAYED on a fresh
 * run: one that takes a hit or does not cross reads `SOLVE-BUT-HIT`. Pure node; no browser, no box lock, writes
 * nothing.
 *
 * The shift that puts the staging at residue r is `((r − time mod 45) mod 45) − 45`, derived from the committed
 * tape's own clock (the F1c rows' `shiftTo`).
 *
 * Run:
 *   node scripts/procgen/sweep-seedling-l18-residues.mjs                      # all 45 residues
 *   node scripts/procgen/sweep-seedling-l18-residues.mjs --residues=4,15,18-22
 *   node scripts/procgen/sweep-seedling-l18-residues.mjs --escape             # `HAMMER_ESCAPE` ON (D2's switch)
 *   node scripts/procgen/sweep-seedling-l18-residues.mjs --no-escape          # `HAMMER_ESCAPE` OFF (ON is the default
 *                                                                             #   since hammer-phase A2)
 *   node scripts/procgen/sweep-seedling-l18-residues.mjs --twice              # each row solved twice, compared
 *   node scripts/procgen/sweep-seedling-l18-residues.mjs --full               # the whole refusal text
 *   node scripts/procgen/sweep-seedling-l18-residues.mjs --json=<path>        # also write the rows as JSON
 */

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** `--residues=4,15,18-22` → [4, 15, 18, 19, 20, 21, 22]; absent → every residue of the period. */
function parseResidues(arg, period) {
    if (!arg) return Array.from({ length: period }, (_, i) => i);
    const out = [];
    for (const part of arg.split(',').map((s) => s.trim()).filter(Boolean)) {
        const m = /^(\d+)(?:-(\d+))?$/.exec(part);
        if (!m) throw new Error(`--residues: cannot read "${part}"`);
        const lo = Number(m[1]);
        const hi = m[2] === undefined ? lo : Number(m[2]);
        for (let r = lo; r <= hi; r += 1) {
            if (r >= period) throw new Error(`--residues: ${r} is not a residue mod ${period}`);
            out.push(r);
        }
    }
    return out;
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const argv = process.argv.slice(2);
    const valueOf = (flag) => {
        const a = argv.find((x) => x.startsWith(`${flag}=`));
        return a ? a.slice(flag.length + 1) : null;
    };
    const ESCAPE = argv.includes('--escape');
    const NO_ESCAPE = argv.includes('--no-escape');
    if (ESCAPE && NO_ESCAPE) throw new Error('--escape and --no-escape: pick one');
    const TWICE = argv.includes('--twice');
    const FULL = argv.includes('--full');
    const JSON_OUT = valueOf('--json');

    const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { SPINNER } = await import(join(MODULE, 'spinner.js'));
    const { HAMMER_ESCAPE } = await import(join(MODULE, 'solverBot.js'));
    if (ESCAPE) HAMMER_ESCAPE.enabled = true;
    // ⛓ hammer-phase A2: the switch is ON by default; `--no-escape` measures the base (35/45) without an edit.
    if (NO_ESCAPE) HAMMER_ESCAPE.enabled = false;

    const NAME = 'r9-solve-18';
    const TELEPORTER = { x: 176, y: 112 };
    const STAGING = stagingFromTape(loadTape(NAME));
    const PERIOD = SPINNER.hammerPeriod;
    const RESIDUE = ((STAGING.seam.time % PERIOD) + PERIOD) % PERIOD;
    const shiftTo = (r) => ((((r - RESIDUE) % PERIOD) + PERIOD) % PERIOD) - PERIOD;
    const residues = parseResidues(valueOf('--residues'), PERIOD);

    /** `fidelityF1c.test.js`'s `solveAt`, verbatim in effect. */
    async function solveAt(shift) {
        const seam = { ...STAGING.seam, time: STAGING.seam.time + shift };
        const makeRun = (persistence) => createRunForStaging(
            { ...STAGING, seam, persistence, equips: [] }, atlasLevelSource());
        return twoPassSolve({
            makeRun,
            goals: [{ kind: 'reach-exit', exit: TELEPORTER }],
            name: NAME,
            boot: STAGING.boot,
            persistence: STAGING.persistence.filter((c) => c.at === undefined),
            gameTick: async () => { throw new Error('no game oracle here'); },
        });
    }

    async function row(r) {
        const t0 = process.hrtime.bigint();
        let out;
        try {
            const res = await solveAt(shiftTo(r));
            const keys = res.out.perTick.map((h) => [...h].sort().join('+')).join(',');
            const press = (res.out.records ?? []).filter((x) => x.arm === 'press');
            // ⛓ the walk replayed on a fresh run: a solve that takes a hit or does not cross is not a solve
            const seam = { ...STAGING.seam, time: STAGING.seam.time + shiftTo(r) };
            const replay = createRunForStaging({ ...STAGING, seam, persistence: res.persistence, equips: [] },
                atlasLevelSource());
            for (const held of res.out.perTick) replay.advance(held);
            const crossed = replay.transitions.map((x) => x.to_level).join() === String(STAGING.boot.level + 1);
            out = {
                residue: r, verdict: replay.playerHits.length === 0 && crossed ? 'SOLVE' : 'SOLVE-BUT-HIT',
                hits: replay.playerHits.length, crossed, length: res.out.perTick.length,
                digest: createHash('md5').update(keys).digest('hex').slice(0, 12),
                stalls: press.flatMap((p) => p.phaseStalls ?? []).length,
                escapes: press.flatMap((p) => p.escapes ?? []).length,
            };
        } catch (e) {
            const msg = String(e?.message ?? e);
            out = { residue: r, verdict: e?.code ? `REFUSE ${e.code}` : 'ERROR', length: null, digest: null,
                head: FULL ? msg : msg.split('\n')[0].slice(0, 200) };
        }
        out.seconds = Number(process.hrtime.bigint() - t0) / 1e9;
        return out;
    }

    console.log(`# ${NAME} at seam.time ${STAGING.seam.time} (committed residue ${RESIDUE}); `
        + `HAMMER_ESCAPE ${HAMMER_ESCAPE.enabled ? 'ON' : 'OFF'}; ${residues.length} residue(s)`);
    const rows = [];
    let unstable = 0;
    for (const r of residues) {
        const a = await row(r);
        if (TWICE) {
            const b = await row(r);
            a.twice = (a.verdict === b.verdict && a.digest === b.digest && a.head === b.head) ? 'same' : 'DIFFERS';
            if (a.twice !== 'same') unstable += 1;
        }
        rows.push(a);
        const len = a.length === null ? 'R' : String(a.length);
        const extra = a.length !== null
            ? `digest ${a.digest} stalls ${a.stalls} escapes ${a.escapes} hits ${a.hits}` : `— ${a.head}`;
        console.log(`r${String(r).padStart(2)}  ${a.verdict.padEnd(22)} ${len.padStart(4)}  `
            + `${a.seconds.toFixed(1).padStart(6)}s  ${TWICE ? `${a.twice}  ` : ''}${extra}`);
    }
    const solved = rows.filter((x) => x.verdict === 'SOLVE');
    console.log(`\n# ${solved.length}/${rows.length} solve; lengths by residue: `
        + rows.map((x) => (x.length === null ? 'R' : x.length)).join(' '));
    if (JSON_OUT) writeFileSync(JSON_OUT, `${JSON.stringify({ escape: ESCAPE, rows }, null, 2)}\n`);
    if (unstable > 0) {
        console.error(`⛔ ${unstable} row(s) answered differently on the second solve`);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
