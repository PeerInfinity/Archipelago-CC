// MEASUREMENT-ONLY: levels holding a BombPusher (and spinners) in the committed atlas; legs per such level.
import { readFileSync } from 'node:fs';
const ROOT = '/home/user/Archipelago-CC';
const { atlasLevelSource } = await import(`${ROOT}/frontend/modules/seedlingDemo/levelSource.js`);
const src = atlasLevelSource();
const legs = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const levels = [...new Set(legs.map((l) => l.level))].sort((a, b) => a - b);
const out = [];
for (const lv of levels) {
  let rec; try { rec = src(lv); } catch { continue; }
  const s = JSON.stringify(rec ?? '').toLowerCase();
  const bp = (s.match(/bombpusher/g) ?? []).length, sp = (s.match(/"spinner"|spinner@|<spinner/g) ?? []).length;
  if (bp) out.push({ level: lv, bombpusherMentions: bp, spinnerMentions: sp, legs: legs.filter((l) => l.level === lv).length });
}
console.log(JSON.stringify(out));
console.log('legs in lobber levels:', out.reduce((a, r) => a + r.legs, 0), 'of', legs.length);
