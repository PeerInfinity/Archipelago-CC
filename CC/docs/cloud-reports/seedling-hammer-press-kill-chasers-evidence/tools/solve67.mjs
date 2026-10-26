// scratch: solve L40 Boss Key 2 from the survey's step-67 boot view, under SEEDLING_CONTACT_FIDELITY overrides (env).
import { readFileSync, writeFileSync } from 'node:fs';
const M = process.env.SD_ROOT ?? '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { solveSegment } = await import(M + 'solverBot.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const bootPath = args.boot ?? '/home/user/Archipelago-CC/.cache/seedling-survey/through-end/views/step-67-boot.json';
const tape = parseTape(readFileSync(bootPath, 'utf8'));
const levelSource = atlasLevelSource();
const staging = solveStaging(stagingFromTape(tape));
const over = Object.fromEntries((args.on ?? '').split(',').filter(Boolean).map((k) => [k, true]));
const goal = args.goal ? JSON.parse(args.goal) : { kind: 'collect-placement', placement: { x: 656, y: 528 } };
const t0 = Date.now();
const res = withContactFidelity(over, () => {
    const run = createRunForStaging(staging, levelSource);
    try {
        const out = solveSegment({ run, goals: [goal], name: 'l40bk2', boot: staging.boot, dashMode: 'all',
            forkRun: () => createRunForStaging(staging, levelSource) });
        return { ok: true, ticks: out.perTick.length, records: out.records ?? out.history ?? null, out };
    } catch (e) { return { ok: false, msg: e.message, obstacle: e.obstacle ?? null, bound: e.bound ?? null, rows: e.rows ?? [], perTick: e.perTick ?? [] }; }
});
console.log(`ms ${Date.now() - t0}`);
if (res.ok) {
    console.log(`SOLVED ${res.ticks}`);
    const recs = res.out.records ?? res.out.trace ?? [];
    console.log(Object.keys(res.out));
    if (args.out) writeFileSync(args.out, JSON.stringify({ perTick: res.out.perTick.map((s) => [...s]), equips: res.out.equips, records: res.out.records }, null, 1));
} else {
    console.log('REFUSED', res.msg);
    console.log('obstacle', JSON.stringify(res.obstacle), 'bound', JSON.stringify(res.bound));
    console.log('perTick', res.perTick.length, 'rows', res.rows.length);
    for (const r of res.rows) console.log('ROW', JSON.stringify(r).slice(0, 300));
    if (args.out) writeFileSync(args.out, JSON.stringify({ refused: res.msg, rows: res.rows, perTick: res.perTick.map((s) => [...s]) }, null, 1));
}
