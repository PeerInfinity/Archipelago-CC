import { register } from 'node:module';
register(new URL('./opp-loader.mjs', import.meta.url).href);
const D = (process.env.OPP_ROOT ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { facingToward } = await import(D + 'solverBot.js');
const { strikeCandidates } = await import(D + 'strikePolicy.js');
const LIVE_DECIDE = /(driveStepHeld|guardedChaserDwell|execBreak|runDwell|runShove|runWait|execKillByPressOnce)/;
const S = globalThis.__oppStats = { byExec: new Map(), misses: [], runs: 0 };
globalThis.__oppInstrument = (run) => {
    S.runs += 1;
    let consulted = -1;
    const ent = run.entities.bind(run);
    run.entities = (k) => {
        if (k === 'strikeBodies' && LIVE_DECIDE.test(new Error().stack.split('\n').slice(2, 4).join(' '))) consulted = run.ticksCompleted;
        return ent(k);
    };
    const advance = run.advance.bind(run);
    run.advance = (k) => {
        const t = run.ticksCompleted;
        const inv = run.progress('inventory');
        const bodies = (inv?.hasSword || inv?.hasGhostSword) ? (ent('strikeBodies') ?? []) : [];
        if (bodies.length) {
            const { chosen } = strikeCandidates(run.state, bodies, { facingToward, owed: new Map(), tick: t });
            if (chosen.length) {
                const lines = new Error().stack.split('\n').slice(2);
                const fr = lines.find((l) => /solverBot\.js|botDriverV2\.js|lightsVerb|bombPusher/.test(l)
                    && !/advanceNamingRefusals|nameRefusalByCode|at (Object\.|Proxy\.)?advance /.test(l));
                const m = fr?.match(/at (?:Object\.)?([\w$.<>]+)? ?\(?.*\/(\w+\.js):(\d+)/);
                const f = m ? `${m[1] ?? '(anon)'}@${m[2]}` : '(no executor: a replay/driver)';
                const row = S.byExec.get(f) ?? { ticks: 0, consulted: 0, bodies: new Set() };
                row.ticks += 1;
                if (consulted === t) row.consulted += 1;
                else S.misses.push({ t, exec: f, level: run.level, bodies: chosen.map((c) => c.id), held: [...k].join('+') });
                chosen.forEach((c) => row.bodies.add(`L${run.level}:${c.id}`));
                S.byExec.set(f, row);
            }
        }
        return advance(k);
    };
    return run;
};
globalThis.__oppReport = (misses = false) => {
    console.log(`# runs instrumented: ${S.runs}`);
    console.log('# executor frame | in-reach ticks | consulted | missed | bodies');
    for (const [f, r] of S.byExec) console.log(`${f} | ${r.ticks} | ${r.consulted} | ${r.ticks - r.consulted} | ${[...r.bodies].slice(0, 12).join(',')}`);
    if (misses) for (const m of S.misses) console.log(`miss t${m.t} L${m.level} ${m.exec} [${m.bodies}] held=${m.held}`);
};
if (process.env.OPP_EXIT_OUT) {
    const { appendFileSync } = await import('node:fs');
    process.on('exit', () => {
        const rows = [...S.byExec].map(([f, r]) => ({ exec: f, ticks: r.ticks, consulted: r.consulted, bodies: [...r.bodies] }));
        appendFileSync(process.env.OPP_EXIT_OUT, JSON.stringify({ pid: process.pid, argv: process.argv.slice(2).join(' ').slice(0, 200), runs: S.runs, rows,
            misses: S.misses.slice(0, 400) }) + '\n');
    });
}
