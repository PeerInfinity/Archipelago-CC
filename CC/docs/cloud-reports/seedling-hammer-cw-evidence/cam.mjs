import { readFileSync } from 'node:fs';
const R = (process.env.REPO ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { createRunForStaging } = await import(R + 'tapeRunner.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { staging, perTick } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const run = createRunForStaging(staging, atlasLevelSource());
const [a, b] = process.argv[3].split('-').map(Number);
for (let t = 0; t < b; t += 1) { run.advance(new Set(perTick[t])); if (t + 1 >= a) {
  const c = (run.entities('chasers') ?? []).find((x) => x.id === 'bob@736,752');
  console.log(run.ticksCompleted, JSON.stringify(run.cameraNow), 'bob', c && [c.x.toFixed(3), c.y.toFixed(3)], 'player', run.state.x.toFixed(2), run.state.y.toFixed(2)); } }
