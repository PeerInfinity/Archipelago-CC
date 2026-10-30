// scratch (LWEIGH): replay a saved perTick on the latch boot (fresh run) and print the turret/corpse/button/hits story.
const ROOT = process.env.ROOT ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const fs = await import('node:fs');
const { l40LatchBoot } = await import(M + 'fidelityL40Latch.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { buildTape } = await import(M + 'botDriverV1.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const saved = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let boot = await l40LatchBoot();
if (process.env.AT) { const [x, y] = process.env.AT.split(',').map(Number); boot = { ...boot, boot: { ...boot.boot, x, y } }; }
const folded = buildTape(saved.perTick.map((k) => new Set(k)), boot.boot, 'lw', { noclip: false, noDamage: false, noHazards: [], grants: [] });
const tape = parseTape(JSON.stringify({ ...boot, name: 'lw', tick_count: saved.perTick.length, inputs: folded.inputs, equips: [...(boot.equips ?? []), ...(saved.equips ?? [])] }));
let run = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let last = '';
let r = st.next();
while (!r.done) {
  const o = r.value.observation;
  if (run) {
    const t = run.entities('turrets')?.get('iceturret@472,400');
    const open = [...run.entities('openActivators')].filter((a) => /448,432|480,560|512,480|800,400/.test(a)).sort().join(',');
    const s = `turret ${t ? `${t.dead ? "DEAD" : "live"}${t.removed ? "/removed" : ""} tile(${Math.floor(t.x/16)},${Math.floor(t.y/16)})` : "-"} open[${open}] hits ${run.playerHits.length}`;
    if (s !== last) { console.log(`t${o.t} L${run.level} (${o.x.toFixed(1)},${o.y.toFixed(1)}) ${s}`); last = s; }
  }
  r = st.next();
}
console.log('HITS', JSON.stringify(run.playerHits.map((h) => ({ t: h.t, source: h.source, id: h.id, died: h.died }))));
