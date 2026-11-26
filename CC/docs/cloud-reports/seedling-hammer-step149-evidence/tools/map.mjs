// MEASUREMENT-ONLY: ASCII map of a captured request's room (8px cells), plus its entities in a window.
import { readFileSync } from 'node:fs';
const ROOT = '/home/user/Archipelago-CC';
const [file, id, i, x0s, y0s, x1s, y1s] = process.argv.slice(2);
const row = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { createRunForStaging } = await import(`${ROOT}/frontend/modules/seedlingDemo/tapeRunner.js`);
const req = restoreRequest(row.requests[Number(i)].request);
const levelSource = levelSourceFromAtlas(req.source.records);
const run = createRunForStaging(req.staging, levelSource);
const [X0, Y0, X1, Y1] = [x0s, y0s, x1s, y1s].map(Number);
const w = run.world;
let out = '     ' + Array.from({ length: (X1 - X0) / 8 }, (_, k) => ((X0 + k * 8) / 8 % 10)).join('') + '\n';
for (let y = Y0; y < Y1; y += 8) {
  let line = String(y).padStart(4) + ' ';
  for (let x = X0; x < X1; x += 8) line += w.collidesSolid({ x: x + 1, y: y + 1, w: 6, h: 6, right: x + 7, bottom: y + 7 }) ? '#' : '.';
  out += line + '\n';
}
console.log(out);
const kinds = Object.keys(w).filter((k) => Array.isArray(w[k]) && w[k].length && typeof w[k][0] === 'object');
for (const k of kinds) {
  const near = w[k].filter((e) => { const ex = e.x ?? e.rect?.x, ey = e.y ?? e.rect?.y; return ex >= X0 - 16 && ex < X1 + 16 && ey >= Y0 - 16 && ey < Y1 + 16; });
  if (near.length) console.log(k, near.slice(0, 12).map((e) => `${e.id ?? e.kind ?? ''}@${e.x ?? e.rect?.x},${e.y ?? e.rect?.y}`).join(' '));
}
console.log('spinnerBodies', JSON.stringify(run.entities('spinnerBodies')?.slice(0, 8)));
