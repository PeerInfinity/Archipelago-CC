// Missed-opportunity census: solve a staging in node, and on every live tick ask whether a strikeable body is in
// sword reach (the policy's own `strikeCandidates`, owed empty), which executor frame is driving, and whether a live
// strike policy was consulted on that tick (a `strikeBodies` read from a live decide site).
import { readFileSync } from 'node:fs';
const D = (process.env.OPP_ROOT ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(D + 'levelSource.js');
const { parseTape } = await import(D + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(D + 'tapeRunner.js');
const { solveSegment, facingToward } = await import(D + 'solverBot.js');
const { strikeCandidates } = await import(D + 'strikePolicy.js');

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const boot = args.boot ?? D + 'fixtures/l40bk2-witness/step67-boot.json';
const goal = JSON.parse(args.goal ?? '{"kind":"collect-placement","placement":{"x":880,"y":816}}');
const cap = Number(args.cap ?? 4000);
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(boot, 'utf8'))));
const run = createRunForStaging(staging, atlasLevelSource());
const LIVE_DECIDE = /(driveStepHeld|guardedChaserDwell|execBreak|runDwell|runShove|runWait|execKillByPressOnce|opportun)/;
let consulted = -1;
const ent = run.entities.bind(run);
run.entities = (k) => {
    if (k === 'strikeBodies') {
        const st = new Error().stack.split('\n').slice(2, 4).join(' ');
        if (LIVE_DECIDE.test(st)) consulted = run.ticksCompleted;
    }
    return ent(k);
};
const frameOf = () => {
    const lines = new Error().stack.split('\n').slice(3);
    const fr = lines.find((l) => /solverBot\.js|botDriverV2\.js|lightsVerb|bombPusher/.test(l) && !/advanceNamingRefusals|nameRefusalByCode|at (Object\.|Proxy\.)?advance /.test(l)) ?? "?";
    const m = fr.match(/at (?:Object\.)?([\w$.<>]+)? ?\(?.*\/(\w+\.js):(\d+)/);
    return m ? `${m[1] ?? '(anon)'}@${m[2]}:${m[3]}` : fr.trim();
};
const misses = [];
const pressTicks = [];
const chaserHits = [];
const byExec = new Map();
const advance = run.advance.bind(run);
run.advance = (k) => {
    if (run.ticksCompleted >= cap) throw Object.assign(new Error('cap'), { sentinel: true });
    const t = run.ticksCompleted;
    if (t >= 640 && t <= 700 && t % 3 === 0) (globalThis.__drivePos ??= []).push([t, run.state.x, run.state.y]);
    const inv = run.progress('inventory');
    const sword = inv?.hasSword || inv?.hasGhostSword;
    const bodies = ent('strikeBodies') ?? [];
    if (sword && bodies.length) {
        const { chosen } = strikeCandidates(run.state, bodies, { facingToward, owed: new Map(), tick: t });
        if (chosen.length) {
            const f = frameOf();
            const row = byExec.get(f) ?? { ticks: 0, consulted: 0, bodies: new Set(), first: t, last: t };
            row.ticks += 1; row.last = t;
            if (consulted === t) row.consulted += 1; else misses.push({ t, exec: f, bodies: chosen.map((c) => c.id), held: [...k].join('+') });
            chosen.forEach((c) => row.bodies.add(c.id));
            byExec.set(f, row);
        }
    }
    const before = new Map((ent('chasers') ?? []).map((c) => [c.id, c.hits]));
    if (k.has?.('primary')) pressTicks.push(t);
    const out = advance(k);
    for (const c of ent('chasers') ?? []) {
        if (before.has(c.id) && c.hits !== before.get(c.id)) chaserHits.push(`${run.ticksCompleted - 1}:${c.id}:${c.hits}`);
    }
    return out;
};
let error = null;
const t0 = Date.now();
try {
    solveSegment({ run, goals: [goal], name: 'opp', boot: staging.boot, dashMode: 'all' });
} catch (e) { error = e; }
console.log(`# verdict: ${error ? (error.sentinel ? `CAP t${cap}` : `${error.name}: ${String(error.message).slice(0, 300)}`) : 'SOLVED'} at t${run.ticksCompleted} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`# hits: ${run.playerHits.map((h) => `${h.t}:${h.source}:${h.id}`).join(' ') || 'none'}`);
console.log('# executor frame | in-reach ticks | consulted | missed | bodies | first..last');
for (const [f, r] of byExec) console.log(`${f} | ${r.ticks} | ${r.consulted} | ${r.ticks - r.consulted} | ${[...r.bodies].join(',')} | ${r.first}..${r.last}`);
if (args.misses) for (const m of misses) console.log(`miss t${m.t} ${m.exec} [${m.bodies}] held=${m.held}`);
console.log(`# presses (primary held) at: ${pressTicks.join(' ')}`);
console.log(`# chaser hits landed (t:id:hits): ${chaserHits.join(' ') || 'none'}`);
try {
    const pk = await import(D + 'pressKillCost.js');
    if (pk.OPPORTUNISTIC_STRIKE_COUNTS) console.log(`# OPP counts: ${JSON.stringify(pk.OPPORTUNISTIC_STRIKE_COUNTS)}`);
} catch {}
const ch = run.entities('chasers') ?? [];
console.log(`# level ${run.level} chasers at end: ${ch.map((c) => `${c.id} hits=${c.hits}${c.dying ? ' dying' : ''}${c.removed ? ' removed' : ''} @(${c.x.toFixed(1)},${c.y.toFixed(1)})`).join(' · ')}`);
const sp = run.entities('spinnerBodies') ?? [];
console.log(`# spinners at end: ${sp.map((b) => b.id).join(',') || 'none'}`);
const dl = run.ledger('chaserDeaths') ?? run.ledger('enemyDeaths') ?? null;
if (dl) console.log(`# chaser deaths ledger: ${JSON.stringify(dl).slice(0, 400)}`);
const presses = []; // from perTick not available; count primary from hook
