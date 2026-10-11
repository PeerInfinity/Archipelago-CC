// C2 D4: the ON solve of r9-solve-18's staging + the ghost sword, written as a v-tape (evidence)
import { join } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';
const MODULE = join(process.cwd(), 'frontend', 'modules', 'seedlingDemo');
const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const NAME = process.argv[2]; const OUT = process.argv[3];
const base = parseTape(readFileSync(join(MODULE, 'fixtures', 'witness-bases', 'r9-solve-18.hammer-a.json'), 'utf8'));
const S = stagingFromTape(base);
const seam = { ...S.seam, items: { ...S.seam.items, hasGhostSword: true } };
const makeRun = (persistence) => createRunForStaging({ ...S, seam, persistence, equips: [] }, atlasLevelSource());
const r = await twoPassSolve({ makeRun, goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], name: NAME, boot: S.boot,
  persistence: S.persistence.filter((c) => c.at === undefined), gameTick: async () => { throw new Error('no oracle'); } });
const tape = buildTape(r.out.perTick, S.boot, NAME, { noclip: false, noDamage: false, noHazards: [], grants: [] });
const raw = { ...base, name: NAME, persistence: r.persistence, seam, tick_count: r.out.perTick.length, inputs: tape.inputs,
  description: 'C2 evidence: r9-solve-18 frozen staging + hasGhostSword, solved with GHOST_SPINNER_PRESS ON (twoPassSolve)' };
delete raw.tick0; delete raw.note;
writeFileSync(OUT, `${JSON.stringify({ ...parseTape(raw), description: raw.description, note: '' }, null, 4)}\n`);
console.log('ticks', r.out.perTick.length, 'persistence', JSON.stringify(r.persistence.filter((c) => c.at !== undefined)));
