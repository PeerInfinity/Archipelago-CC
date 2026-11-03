// scratch (CORPSEBUMP2): the latch chain under env switches + OVER (contact-fidelity overrides); prints the answer,
// then replays the plan/refused prefix on a fresh run of the latch boot: hits, and the turret per tick (dead, tile).
const ROOT = process.env.ROOT ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const { l40LatchBoot, l40LatchSolve } = await import(M + 'fidelityL40Latch.js');
const SB = await import(M + 'solverBot.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const TURRET = 'iceturret@472,400';
const boot = await l40LatchBoot();
const over = process.env.OVER ? JSON.parse(process.env.OVER) : {};
const t0 = Date.now();
const { out, refusal } = await l40LatchSolve(boot, over);
console.log('ms', Date.now() - t0);
let perTick, equips;
const __eq = () => console.log('EQUIPS', JSON.stringify(equips));
if (out) {
  console.log('SOLVED', out.perTick.length);
  for (const r of out.records ?? []) if (r.strategy !== 'walk') console.log('REC', JSON.stringify(r).slice(0, 400));
  perTick = out.perTick; equips = out.equips;
} else {
  console.log('REFUSED', refusal.constructor.name, String(refusal.message).slice(0, +(process.env.MSGLEN ?? 1500)));
  console.log('obstacle', JSON.stringify(refusal.obstacle ?? null), 'perTick', (refusal.perTick ?? []).length);
  perTick = refusal.perTick ?? []; equips = refusal.equips;
}
__eq(); console.log('PERTICK-MD5', (await import('node:crypto')).createHash('md5').update(JSON.stringify(perTick.map((k) => [...k]))).digest('hex'), JSON.stringify(equips ?? []).length);
// replay
const { parseTape } = await import(M + 'tapeFormat.js');
const { buildTape } = await import(M + 'botDriverV1.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const CUT = +(process.env.CUT ?? perTick.length);
perTick = perTick.slice(0, CUT);
const folded = buildTape(perTick.map((k) => new Set(k)), boot.boot, 'cb2', { noclip: false, noDamage: false, noHazards: [], grants: [] });
const tapeObj = ({ ...boot, name: 'cb2', tick_count: perTick.length, inputs: folded.inputs,
  equips: [...(boot.equips ?? []), ...(equips ?? [])].filter((e) => (e.t ?? e.tick ?? 0) < CUT) });
if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify(tapeObj));
const tape = parseTape(JSON.stringify(tapeObj));
withContactFidelity(over, () => {
  let run = null; let last = null; const tl = [];
  const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
  try {
    for (let r = st.next(); !r.done; r = st.next()) {
      const t = run.entities('turrets')?.get(TURRET);
      if (!t || run.level !== 40) continue;
      const k = `${t.dead ? 'D' : 'L'} ${Math.floor(t.x / 16)},${Math.floor(t.y / 16)} open ${run.entities('openActivators').has('wandlock@448,432')}`;
      if (k !== last) { tl.push(`t${r.value.observation.t} ${k} (${t.x},${t.y}) p(${r.value.observation.x},${r.value.observation.y}) open448 ${run.entities("openActivators").has("wandlock@448,432")}`); last = k; }
    }
  } catch (e) { console.log('REPLAY-ERR', e.message.slice(0, 300)); }
  console.log('HITS', JSON.stringify(run.playerHits.map((h) => ({ t: h.t, source: h.source, id: h.id }))));
  if (process.env.TL) for (const l of tl) console.log('TL', l);
});
console.log('LWF', JSON.stringify(SB.LATCH_WEIGH_FIRST_COUNTS ?? null));
