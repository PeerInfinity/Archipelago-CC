import { writeFileSync } from 'node:fs';
import { bobsoldier2Plan } from '/home/user/Archipelago-CC/scripts/procgen/plan-seedling-bobsoldier2.mjs';
import { buildStagedTape } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/botDriverV1.js';
const off = await bobsoldier2Plan(false);
const name = 'bobsoldier2-l30-dash-stance';
const built = buildStagedTape({ staging: off.staging, perTick: off.driven, name });
const description = 'BS2FIX EVIDENCE ONLY (not committed as a fixture): survey step 50 at the DEFAULTS (strikeIframeLapse ON) with both switches OFF: the keys driven before the refusal: ' + off.refusal.message.slice(0, 160);
writeFileSync(process.argv[2], JSON.stringify({ ...built, description }, null, 4) + '\n');
console.log(off.driven.length, off.refusal.message.slice(0, 200));
