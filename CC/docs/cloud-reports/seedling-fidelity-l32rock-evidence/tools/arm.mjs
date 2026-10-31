const M = process.cwd() + '/frontend/modules/seedlingDemo/';
const { loadTape } = await import(M + 'fixtures/index.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { liveClears } = await import(M + 'jsRuntimeCore.js');
const tape = loadTape(process.argv[2] ?? 'apb-l32-fresh-no-fire');
let run = null; const first = new Map();
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next(); let n=0;
while (!r.done) { const o = r.value.observation; for (const c of liveClears(run)) { const k=`${c.level}:${c.tag}`; if (!first.has(k)) first.set(k, o.t);} r = st.next(); }
console.log('clears', [...first]);
console.log('bob ledger', JSON.stringify(run.ledger('bobBossEvents').filter(x=>x.what.startsWith('rock'))));
console.log('earned', JSON.stringify(run.ledger('earnedClears')), 'banked', JSON.stringify(run.ledger('bankedClears')));
