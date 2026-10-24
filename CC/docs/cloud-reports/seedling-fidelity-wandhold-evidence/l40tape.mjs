// scratch: the ON solver's plan for an L40 boot, written as a damage-ON tape
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const MODULE = join(REPO, 'frontend/modules/seedlingDemo');
const { l40buttonStaging, L40BUTTON_GOAL } = await import(join(REPO, 'scripts/procgen/plan-seedling-l40button-witness.mjs'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { createRunForStaging, runTape } = await import(join(MODULE, 'tapeRunner.js'));
const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const [bx, by] = process.argv[2].split(',').map(Number);
const name = process.argv[3];
const staging = await l40buttonStaging({ level: 40, x: bx, y: by });
const levelSource = atlasLevelSource();
const solved = await twoPassSolve({
  makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
  goals: [L40BUTTON_GOAL], name, boot: staging.boot, dashMode: 'all',
  persistence: staging.persistence, log: () => {},
});
const built = buildStagedTape({
  staging: { ...staging, persistence: solved.persistence, equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
  perTick: solved.out.perTick, name,
});
const tape = { ...built, description: `scratch WANDHOLD ${name}` };
writeFileSync(process.argv[4], JSON.stringify(tape));
const out = runTape(parseTape(tape), { levelSource });
const last = out.ticks.at(-1);
console.log(name, 'ticks', solved.out.perTick.length, 'verbs', JSON.stringify(solved.out.records.map((r) => r.strategy)), 'model end', last.level, last.x, last.y, 'noDamage', tape.noDamage ?? null);
for (const r of solved.out.records) console.log('  ', r.strategy, JSON.stringify(r.paced ?? null)?.slice(0,200), r.target ? JSON.stringify(r.target) : '');
