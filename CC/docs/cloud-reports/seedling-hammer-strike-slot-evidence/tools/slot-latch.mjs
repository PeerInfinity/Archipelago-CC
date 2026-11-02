// MEASUREMENT ONLY: L40's latch chain (`fidelityL40Latch.l40LatchSolve`, the committed `latch-boot`) under two arms,
// with `node --import ./slot-register.mjs`: `lweigh` = CORPSEBUMP2's arm minus its own key (CPAIR size 3 +
// LATCH_WEIGH_FIRST ON, TURRET_APPROACH OFF, turretSnapPricing OFF, orbitFreeAim + strategyBoundDistinct ON);
// `ta` = hammer-2's solved arm (CPAIR size 3 + LATCH_WEIGH_FIRST + TURRET_APPROACH, contact keys at their defaults).
// Prints one JSON line: the verdict, ticks, the refusal head, the equips and a plan sha. Switches by env.
// Usage: node --import ./slot-register.mjs slot-latch.mjs --arm=lweigh|ta [--root=<tree>]
import { createHash } from 'node:crypto';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? process.env.SLOT_ROOT ?? '/home/user/Archipelago-CC';
const D = ROOT + '/frontend/modules/seedlingDemo/';
const SB = await import(D + 'solverBot.js');
const L = await import(D + 'fidelityL40Latch.js');
const boot = await L.l40LatchBoot();
const arm = args.arm ?? 'lweigh';
const over = arm === 'lweigh' ? { turretSnapPricing: false, orbitFreeAim: true, strategyBoundDistinct: true } : {};
const was = SB.CHOOSER_PAIR.size;
SB.CHOOSER_PAIR.size = 3;
const t0 = Date.now();
const r = await SB.withChooserPair(true, () => SB.withLatchWeighFirst(true, () => SB.withTurretApproach(arm === 'ta',
    () => L.l40LatchSolve(boot, over))));
SB.CHOOSER_PAIR.size = was;
const res = r.out ?? r.refusal;
const keys = (res?.perTick ?? []).map((k) => [...k].sort().join('+'));
console.log(JSON.stringify({ arm, ok: Boolean(r.out), ms: Date.now() - t0, ticks: keys.length,
    plan: createHash('sha1').update(JSON.stringify(keys)).digest('hex').slice(0, 12),
    refusal: r.refusal ? String(r.refusal.message).slice(0, 400) : null,
    obstacle: r.refusal?.obstacle ?? null, equips: res?.equips ?? null,
    census: globalThis.__slotStats ? { policies: __slotStats.policies, presses: __slotStats.presses,
        byWeapon: __slotStats.byWeapon, nonBlade: __slotStats.rows.length } : null }));
