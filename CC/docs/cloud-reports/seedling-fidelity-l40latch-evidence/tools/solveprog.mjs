// scratch: solve L40 Boss Key 2 from a boot under switch overrides, printing the active progress path every N s.
import { readFileSync, writeFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { solveSegment } = await import(M + 'solverBot.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { withSolveProgress } = await import(M + 'solveProgress.js');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const tape = parseTape(readFileSync(args.boot, 'utf8'));
const levelSource = atlasLevelSource();
const staging = solveStaging(stagingFromTape(tape));
const over = Object.fromEntries((args.on ?? '').split(',').filter(Boolean).map((k) => [k, true]));
for (const k of (args.off ?? '').split(',').filter(Boolean)) over[k] = false;
const goal = args.goal ? JSON.parse(args.goal) : { kind: 'collect-placement', placement: { x: 656, y: 528 } };
const every = Number(args.every ?? 20) * 1000;
const t0 = Date.now();
let last = 0;
const activePath = (n, out = []) => { if (!n) return out; if (n.active) out.push(`${n.role}:${n.label ?? n.key}`.slice(0, 90)); for (const k of n.children ?? []) activePath(k, out); return out; };
const hook = (site, peek) => {
    if (Date.now() - last < every) return;
    last = Date.now();
    const s = peek();
    if (!s) return;
    console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${site} | ${activePath(s.tree).join(' > ')}`);
};
const res = withContactFidelity(over, () => withSolveProgress(hook, () => {
    const run = createRunForStaging(staging, levelSource);
    try {
        const out = solveSegment({ run, goals: [goal], name: 'l40latch', boot: staging.boot, dashMode: 'all',
            forkRun: () => createRunForStaging(staging, levelSource) });
        return { ok: true, out };
    } catch (e) { return { ok: false, msg: e.message, obstacle: e.obstacle ?? null, perTick: e.perTick ?? [], equips: e.equips ?? [] }; }
}));
console.log(`ms ${Date.now() - t0}`);
if (res.ok) {
    console.log(`SOLVED ${res.out.perTick.length}`);
    for (const r of res.out.records ?? []) console.log('REC', JSON.stringify(r).slice(0, 300));
    if (args.out) writeFileSync(args.out, JSON.stringify({ perTick: res.out.perTick.map((s) => [...s]), equips: res.out.equips, records: res.out.records }, null, 1));
} else {
    console.log('REFUSED', res.msg.slice(0, 4000));
    console.log('obstacle', JSON.stringify(res.obstacle), 'perTick', res.perTick.length);
    if (args.out) writeFileSync(args.out, JSON.stringify({ refused: res.msg, perTick: res.perTick.map((s) => [...s]), equips: res.equips }, null, 1));
}
