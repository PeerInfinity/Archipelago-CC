// scratch: replay saved latch keys (latch-va.mjs KEYS_OUT) on a fresh run of the latch boot: hits, deaths, the turret, keyType 2.
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const fs = await import('node:fs');
const { l40LatchBoot } = await import(M + 'fidelityL40Latch.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { buildTape } = await import(M + 'botDriverV1.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const saved = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const boot = await l40LatchBoot();
const folded = buildTape(saved.perTick.map((k) => new Set(k)), boot.boot, 'va', { noclip: false, noDamage: false, noHazards: [], grants: [] });
const tape = parseTape(JSON.stringify({ ...boot, name: 'va', tick_count: saved.perTick.length, inputs: folded.inputs, equips: [...(boot.equips ?? []), ...(saved.equips ?? [])] }));
let run = null; let dead = null; let open = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let last = null;
for (let r = st.next(); !r.done; r = st.next()) {
  last = r.value.observation;
  const t = run.entities('turrets').get('iceturret@472,400');
  if (t.dead && dead === null) dead = { t: last.t, tile: [Math.floor(t.x / 16), Math.floor(t.y / 16)] };
  if (open === null && run.entities('openActivators').has('wandlock@448,432')) open = last.t;
}
console.log(JSON.stringify({ ticks: saved.perTick.length, hits: run.playerHits.map((h) => ({ t: h.t, source: h.source, id: h.id })), deaths: run.playerDeaths.length, turretDead: dead, lockOpen: open, collected: run.ledger?.('collected')?.slice?.(-2) ?? null, keys: run.progress?.('keys') ?? null, lastObs: Object.keys(last ?? {}) }));
