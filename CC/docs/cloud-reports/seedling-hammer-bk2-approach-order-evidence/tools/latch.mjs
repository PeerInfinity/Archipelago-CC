// scratch: the latch boot (fixtures/l40latch-witness/latch-boot.json) at --at=x,y (state coords; "latch" = the latch itself), --cp3=1 for
// CPAIR's size-3 arm, at the process's switches; counts work units (the solve's shouldStop sites are not reachable through l40LatchSolve,
// so the tries are the measure here), the approach's tries/anchors (scratch hooks) and TURRET_APPROACH_COUNTS; 30(c) on a fresh run.
import { appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const ROOT = '/home/user/Archipelago-CC';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const L = await import(ROOT + '/frontend/modules/seedlingDemo/fidelityL40Latch.js');
const SB = await import(ROOT + '/frontend/modules/seedlingDemo/solverBot.js');
if (args.order && args.order !== 'OFF') globalThis.__TA_ORDER = args.order;
globalThis.__TA_TRIES = []; globalThis.__TA_ANCHORS = [];
const base = await L.l40LatchBoot();
let boot = base;
if (args.at && args.at !== 'latch') { const [x, y] = args.at.split(',').map(Number); boot = { ...base, boot: { ...base.boot, x: x - 8, y: y - 8 } }; }
const run = () => L.l40LatchSolve(boot);
const t0 = Date.now();
let r;
if (args.cp3 === '1') { const was = SB.CHOOSER_PAIR.size; SB.CHOOSER_PAIR.size = 3; r = await SB.withChooserPair(true, run); SB.CHOOSER_PAIR.size = was; }
else r = await run();
let gm = null;
if (r.out) {
  const { parseTape } = await import(ROOT + '/frontend/modules/seedlingDemo/tapeFormat.js');
  const { buildTape } = await import(ROOT + '/frontend/modules/seedlingDemo/botDriverV1.js');
  const { createTapeStepper } = await import(ROOT + '/frontend/modules/seedlingDemo/tapeRunner.js');
  const { atlasLevelSource } = await import(ROOT + '/frontend/modules/seedlingDemo/levelSource.js');
  const perTick = r.out.perTick.map((k) => [...k]);
  const folded = buildTape(perTick.map((k) => new Set(k)), boot.boot, 'x', { noclip: false, noDamage: false, noHazards: [], grants: [] });
  const tape = parseTape(JSON.stringify({ ...boot, name: 'x', tick_count: perTick.length, inputs: folded.inputs, equips: [...(boot.equips ?? []), ...(r.out.equips ?? [])] }));
  let rn = null;
  const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, x) => { rn = x; } });
  for (let q = st.next(); !q.done; q = st.next());
  gm = { hits: rn.playerHits.length, deaths: rn.playerDeaths.length, collected: rn.ledger('collected').map((c) => [c.t, c.keyType ?? c.tag ?? null]) };
}
const msg = r.out ? null : r.refusal.message;
const out = { id: `latch@${args.at ?? 'latch'}`, i: args.cp3 === '1' ? 'cp3' : 'cp2', arm: args.order ?? 'OFF', ok: !!r.out, gm, ticks: r.out?.perTick.length ?? null, ms: Date.now() - t0,
  digest: createHash('md5').update(r.out ? JSON.stringify(r.out.perTick.map((k) => [...k])) : msg).digest('hex').slice(0, 12),
  head: msg ? msg.slice(0, 600) : null, order: args.order ?? null,
  approaches: SB.TURRET_APPROACH_COUNTS.approaches, anchors: globalThis.__TA_ANCHORS,
  tries: globalThis.__TA_TRIES.map((t) => [t.side, t.via ? t.via.x + ',' + t.via.y : 'corr', t.w, t.k]) };
if (args.out) appendFileSync(args.out, JSON.stringify(out) + '\n');
console.log(JSON.stringify({ ...out, tries: out.tries.length, anchors: out.anchors.length }));
