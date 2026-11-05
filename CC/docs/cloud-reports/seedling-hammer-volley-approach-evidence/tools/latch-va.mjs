// scratch (VOLLEY-APPROACH): the latch chain (L40LATCH boot) under CPAIR size 3 + LATCH_WEIGH_FIRST, TURRET_APPROACH OFF,
// turretSnapPricing OFF (hammerLatchWeigh.train's CPAIR-3 row); VOLLEY_APPROACH from the env. Prints the verdict.
const M = (process.argv[2] ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { CONTACT_FIDELITY_KEYS, withContactFidelity } = await import(M + 'contactFidelity.js');
const { l40LatchBoot, l40LatchSolve } = await import(M + 'fidelityL40Latch.js');
const SB = await import(M + 'solverBot.js');
const SNAP_OFF = CONTACT_FIDELITY_KEYS.includes('turretSnapPricing') ? { turretSnapPricing: false } : {};
const extra = process.env.LATCH_KEYS ? Object.fromEntries(process.env.LATCH_KEYS.split(',').map((k) => [k, true])) : {};
const boot = await l40LatchBoot();
SB.CHOOSER_PAIR.size = 3;
const t0 = performance.now();
const r = await withContactFidelity({ ...SNAP_OFF, ...extra }, () => SB.withChooserPair(true, () => SB.withLatchWeighFirst(true,
  () => SB.withTurretApproach(false, () => l40LatchSolve(boot)))));
const out = r.out ? { ok: true, ticks: r.out.perTick.length, hits: r.out.hits ?? null, records: r.out.records.map((x) => x.strategy) }
  : { ok: false, msg: r.refusal.message.slice(0, 900), ticks: r.refusal.perTick?.length ?? null, obstacle: r.refusal.obstacle ?? null };
console.log(JSON.stringify({ va: SB.VOLLEY_APPROACH.enabled, ms: Math.round(performance.now() - t0), ...out, retries: SB.VOLLEY_APPROACH_COUNTS.retries, design: globalThis.__VA_DESIGN_OUT ?? null }));
if (process.env.KEYS_OUT && r.out) (await import('node:fs')).writeFileSync(process.env.KEYS_OUT, JSON.stringify({ perTick: r.out.perTick.map((k) => [...k]), equips: r.out.equips ?? [] }));
