// SCRATCH (seedling-hammer-sf D1): a staged tape from g1-solve's --tape output ({staging, perTick}).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const { buildStagedTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/botDriverV1.js'));
const { parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { staging, perTick } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const built = buildStagedTape({ staging, perTick: perTick.map((k) => new Set(k)), name: process.argv[4] });
const json = `${JSON.stringify(built, null, 4)}\n`;
parseTape(JSON.parse(json));
writeFileSync(process.argv[3], json);
console.log('wrote', process.argv[3], perTick.length);
