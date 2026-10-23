const D = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { readFileSync } = await import('node:fs');
const { parseTape } = await import(D + 'tapeFormat.js');
const { atlasLevelSource } = await import(D + 'levelSource.js');
const { withContactFidelity } = await import(D + 'contactFidelity.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(D + 'tapeRunner.js');
const { twoPassSolve } = await import(D + 'twoPassSolve.js');
const [name, dt, sw] = [process.argv[2], Number(process.argv[3]), JSON.parse(process.argv[4] ?? '{}')];
const w = JSON.parse(readFileSync(D + `fixtures/lights-witness/${name}.json`, 'utf8'));
const st0 = solveStaging(stagingFromTape(parseTape(JSON.stringify(w.tape))));
const staging = { ...st0, seam: { ...st0.seam, time: st0.seam.time + dt } };
const levelSource = atlasLevelSource();
const GOALS = [
    { kind: 'clear-tag', tag: { level: 69, tag: 0 }, at: { x: 72, y: 72 }, obstacle: 'lightbosscontroller@72,72' },
    { kind: 'reach-exit', exit: { x: 72, y: 72 } },
];
let out;
try {
    const solved = await withContactFidelity({ lightsBossFight: true, ...sw }, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: GOALS, name: 'lights-solve', boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    }));
    const rec = solved.out.records.find((r) => r.goal === 'clear-tag');
    out = { ticks: solved.out.perTick.length, fight: rec?.ticks, refusal: solved.out.refusal?.reason ?? solved.refusal?.reason ?? null };
} catch (e) { out = { error: e.message.slice(0, 200) }; }
console.log(JSON.stringify({ name, dt, sw, order: process.env.SL_BACKLAST === '1' ? 'backLast' : 'backFirst', ...out }));
