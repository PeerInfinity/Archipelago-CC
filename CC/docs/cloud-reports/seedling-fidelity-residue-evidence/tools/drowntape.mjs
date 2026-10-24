import { readFileSync, writeFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { solveSegment } = await import(M + 'solverBot.js');
const { buildStagedTape } = await import(M + 'botDriverV1.js');
const SRC = atlasLevelSource();
const [file, seedS, outPath] = process.argv.slice(2);
let tape = JSON.parse(readFileSync(file, 'utf8')); if (tape.tape) tape = tape.tape;
const seed = Number(seedS);
const staging = stagingFromTape(parseTape(JSON.stringify({ ...tape, rng: { ...tape.rng, seed }, inputs: [], tick_count: 0 })));
withContactFidelity({ tentacleHitlessFirst: false, whirlpoolDrown: true }, () => {
  const run = createRunForStaging(staging, SRC);
  const out = solveSegment({ run, goals: [{ kind: 'clear-tag', tag: { level: 57, tag: 0 }, at: { x: 80, y: 48 }, obstacle: 'tentaclebeast@80,48' }], name: 'drown', boot: staging.boot, forkRun: () => createRunForStaging(staging, SRC) });
  const perTick = [...out.perTick];
  const v = run.entities('tentacleBeastFight');
  console.log('fight', perTick.length, 'whirlpools', JSON.stringify(v.whirlpools), 'player', run.state.x, run.state.y, 'hits', run.ledger('playerHits').length);
  // the live whirlpool with the most life left
  const live = v.whirlpools.filter(w => w.timer - 1 >= 30).sort((a,b)=>b.timer-a.timer);
  const w = live[0]; if (!w) { console.log('no whirlpool'); return; }
  const d0 = run.ledger('playerDeaths').length; let deathAt = null;
  for (let i = 0; i < 600; i++) {
    const s = run.state; const k = new Set();
    if (deathAt === null) {
      if (w.x - s.x > 1) k.add('right'); else if (s.x - w.x > 1) k.add('left');
      if (w.y - s.y > 1) k.add('down'); else if (s.y - w.y > 1) k.add('up');
    }
    perTick.push(k); run.advance(k);
    if (deathAt === null && run.ledger('playerDeaths').length > d0) deathAt = perTick.length;
    if (deathAt !== null && perTick.length >= deathAt + 40) break;
  }
  const d = run.ledger('playerDeaths').at(-1);
  console.log('death', JSON.stringify(d), 'deathAt', deathAt, 'total', perTick.length, 'drownRows', JSON.stringify((run.tentacleBeastFight ?? {}).x));
  const t = buildStagedTape({ staging: { ...staging, equips: [...(staging.equips ?? []), ...(out.equips ?? [])] }, perTick, name: `whirlpool-drown-s${seed}` });
  writeFileSync(outPath, JSON.stringify({ ...t, description: `seedling-fidelity-residue D-B: the L57 fight (seed ${seed}, hitless OFF), then a walk into ${w.id} until it drowns the player` }));
});
