// D1 (measure only): one solve, unhooked; print every trace row that names a rung / strategy with the values the
// solver already wrote on it (target, stance, the danger obstacle), plus the records' targets.
// node d1probe.mjs --tape=r5-l40-part5 --goal=collect:160,640 [--residue=21]
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { goalsFrom } = await import(join(REPO, 'scripts/procgen/probe-seedling-solve-progress.mjs'));
const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { SPINNER } = await import(join(MODULE, 'spinner.js'));
const tapeName = arg('tape');
const goals = goalsFrom(arg('goal'));
const residue = arg('residue', null);
const tape = loadTape(tapeName);
const base = stagingFromTape(tape);
let seam = base.seam;
if (residue !== null) {
    const P = SPINNER.hammerPeriod;
    const was = ((base.seam.time % P) + P) % P;
    seam = { ...base.seam, time: base.seam.time + ((((Number(residue) - was) % P) + P) % P) - P };
}
const SOURCE = atlasLevelSource();
const staging = { ...base, seam, noclip: false, noDamage: false, equips: [],
    persistence: base.persistence.filter((c) => c.at === undefined) };
const value = await twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
    goals, name: tape.name ?? tapeName, boot: staging.boot, persistence: staging.persistence,
    gameTick: () => { throw new Error('no game oracle'); } });
const T = value.out.trace;
for (const row of T.rows) {
    const s = row.strategy ?? null;
    if (!s) continue;
    const pick = Object.fromEntries(Object.entries(s).filter(([k]) => ['verb', 'rung', 'climb', 'arm', 'target', 'stance', 'presser'].includes(k)));
    console.log(JSON.stringify({ tick: row.tick, strategy: pick, obstacle: row.obstacle ?? null,
        goal: row.goal?.kind, rejected: (row.rejected ?? []).map((r) => r.option) }));
}
for (const r of value.out.records ?? []) console.log(JSON.stringify({ record: { goal: r.goal, strategy: r.strategy, target: r.target } }));
