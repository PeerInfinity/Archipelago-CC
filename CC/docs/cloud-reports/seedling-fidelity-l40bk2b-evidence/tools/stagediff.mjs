import { readFileSync } from 'node:fs';
const B = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(B + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { parseTape } = await import(B + 'frontend/modules/seedlingDemo/tapeFormat.js');
const { stagingFromTape } = await import(B + 'frontend/modules/seedlingDemo/tapeRunner.js');
const [file, id, i, tapeFile] = process.argv.slice(2);
const r = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((x) => String(x.id) === id);
const req = restoreRequest(r.requests.find((x) => String(x.i) === i).request);
const t = parseTape(readFileSync(tapeFile, 'utf8'));
const a = req.staging; const b = { ...stagingFromTape(t), inventory_slots: t.inventory_slots };
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = JSON.stringify(a[k]); const y = JSON.stringify(b[k]); if (x !== y) console.log(k, '\n req ', x?.slice(0, 300), '\n tape', y?.slice(0, 300)); }
