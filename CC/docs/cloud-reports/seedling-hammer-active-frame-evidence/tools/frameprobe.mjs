// TC2: one solve with a hook that peeks at EVERY call; prints each distinct `frame` in stream order (with the site and
// the count of snapshots it held for), and a tally of snapshots by frame presence.
// REPO=<tree> node frameprobe.mjs --tape=r5-l40-part5 --goal=collect:160,640 [--residue=21]
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { goalsFrom } = await import(join(REPO, 'scripts/procgen/probe-seedling-solve-progress.mjs'));
const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { withSolveProgress } = await import(join(MODULE, 'solveProgress.js'));
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
let last = null; let held = 0; let lastSite = null; const tally = { snapshots: 0, withFrame: 0, nullFrame: 0, noKey: 0 };
const out = [];
const flush = () => { if (last !== null) out.push({ ...JSON.parse(last), site: lastSite, snapshots: held }); };
const hook = (site, peek) => {
    const s = peek(); if (s === null) return;
    tally.snapshots += 1;
    if (!('frame' in s)) { tally.noKey += 1; return; }
    if (s.frame === null) tally.nullFrame += 1; else tally.withFrame += 1;
    const k = JSON.stringify({ seg: s.segment.index, frame: s.frame });
    if (k === last) { held += 1; return; }
    flush(); last = k; held = 1; lastSite = site;
};
let ok = true;
try {
    await withSolveProgress(hook, () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
        goals, name: tape.name ?? tapeName, boot: staging.boot, persistence: staging.persistence,
        gameTick: () => { throw new Error('no game oracle'); } }));
} catch (e) { ok = false; console.error(e.message.slice(0, 200)); }
flush();
for (const r of out) console.log(JSON.stringify(r));
console.log(JSON.stringify({ ok, tally }));
