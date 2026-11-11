// scratch: cached plan (.plan.json from mktape) -> staged tape json. Measure only.
import { readFileSync, writeFileSync } from 'node:fs';
const [inp, out, name] = process.argv.slice(2);
const ROOT = '/home/user/Archipelago-CC';
const B = await import(ROOT + '/frontend/modules/seedlingDemo/botDriverV1.js');
const { parseTape } = await import(ROOT + '/frontend/modules/seedlingDemo/tapeFormat.js');
const p = JSON.parse(readFileSync(inp, 'utf8'));
console.log('plan keys', p.keys, 'equipsAt', p.equipsAt, 'persistence', JSON.stringify(p.persistence)?.slice(0, 300));
const built = B.buildStagedTape({ staging: { ...p.staging, equips: p.staging.equips ?? [] }, perTick: p.perTick.map((k) => new Set(k)), name });
const t = { ...built, noDamage: false, inventory_slots: p.staging.inventory_slots, description: 'scratch (BOBIFRAME D0)' };
try { parseTape(JSON.stringify(t)); console.log('parses with inventory_slots'); } catch (e) { console.log('parse err', String(e.message).slice(0, 400)); }
writeFileSync(out, JSON.stringify(t, null, 1) + '\n'); console.log('wrote', out, Object.keys(t).join(','));
