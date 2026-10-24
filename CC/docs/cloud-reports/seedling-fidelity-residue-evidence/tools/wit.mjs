const D = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { TIMEDPASS_EXIT_WITNESSES, timedPassTape } = await import(D+'fidelityTimedPass.js');
const { drillKillModelSamples } = await import(D+'fidelityDrillKill.js');
for (const w of TIMEDPASS_EXIT_WITNESSES) {
  const t0=Date.now();
  const { tape, solved } = await timedPassTape(w);
  const recs = (solved.out.records??[]).map(r=>[r.goal, r.drillPass?.verb, r.drillPass?.ticks, r.drillPass?.certified]);
  const m = await drillKillModelSamples(tape, w.switches);
  const last = m.samples.filter(Boolean).at(-1);
  console.log(w.name, solved.out.perTick.length, 't', JSON.stringify(recs), 'model err', m.error, 'end', JSON.stringify({l:last.level,h:last.hits}), 'hits any', m.samples.filter(Boolean).some(s=>s.hits>0), Date.now()-t0,'ms', 'tape ticks', tape.tick_count);
}
