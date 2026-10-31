const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { l40LatchBoot, l40LatchSolve } = await import(M + 'fidelityL40Latch.js');
const SB = await import(M + 'solverBot.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const arms = { off: { pair: 0, icest: false }, cp3: { pair: 3, icest: false }, cp3icest: { pair: 3, icest: true } };
const only = process.argv[2]?.split(',') ?? Object.keys(arms);
const boot = await l40LatchBoot();
for (const name of only) for (const key of [false, true]) {
  const a = arms[name];
  const was = SB.CHOOSER_PAIR.size;
  if (a.pair) SB.CHOOSER_PAIR.size = a.pair;
  SB.resetIceTurretStaticKillCounts(); SB.resetChooserPairCounts();
  const t0 = Date.now();
  const r = await withContactFidelity({ turretSnapPricing: key }, () => SB.withChooserPair(a.pair > 0, () => SB.withIceTurretStaticKill(a.icest, () => l40LatchSolve(boot))));
  SB.CHOOSER_PAIR.size = was;
  const pt = r.out ? r.out.perTick : (r.refusal?.perTick ?? []);
  console.log(JSON.stringify({ arm: name, key, verdict: r.out ? 'SOLVED' : 'REFUSED', ticks: pt.length, ms: Date.now() - t0,
    handed: SB.ICETURRET_STATIC_KILL_COUNTS.handed, kills: SB.ICETURRET_STATIC_KILL_COUNTS.kills.map((k) => ({ ...k, why: k.why?.slice(0, 160) })),
    msg: r.refusal?.message?.split('\n')[0].slice(0, 500) ?? null }));
}
