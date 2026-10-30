// scratch (L40C, copied from LWEIGH tools/latch.mjs): the latch chain (l40LatchSolve) under env switches; AT=x,y re-boots it (480,456 = ICEST pocket).
const ROOT = process.env.ROOT ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const { l40LatchBoot, l40LatchSolve } = await import(M + 'fidelityL40Latch.js');
const SB = await import(M + 'solverBot.js');
let boot = await l40LatchBoot();
if (process.env.AT) { const [x, y] = process.env.AT.split(',').map(Number); boot = { ...boot, boot: { ...boot.boot, x, y } }; }
const over = process.env.OVER ? JSON.parse(process.env.OVER) : {};
const t0 = Date.now();
const { out, refusal } = await l40LatchSolve(boot, over);
console.log('ms', Date.now() - t0);
if (out) {
  console.log('SOLVED', out.perTick.length);
  for (const r of out.records ?? []) if (r.strategy !== 'walk') console.log('REC', JSON.stringify(r).slice(0, 500));
  if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify({ perTick: out.perTick.map((k) => [...k]), equips: out.equips ?? [] }));
} else {
  console.log('REFUSED', String(refusal.message).slice(0, +(process.env.MSGLEN ?? 2500)));
  console.log('obstacle', JSON.stringify(refusal.obstacle ?? null), 'perTick', (refusal.perTick ?? []).length);
  if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify({ perTick: (refusal.perTick ?? []).map((k) => [...k]), equips: refusal.equips ?? [] }));
}
console.log('ICEST', JSON.stringify(SB.ICETURRET_STATIC_KILL_COUNTS ?? null));
console.log('LWF', JSON.stringify(SB.LATCH_WEIGH_FIRST_COUNTS ?? null));
