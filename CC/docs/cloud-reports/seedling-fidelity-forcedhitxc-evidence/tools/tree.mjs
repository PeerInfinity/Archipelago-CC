import { readFileSync } from 'node:fs';
const D = '../../../../../frontend/modules/seedlingDemo/';
const { CONTACT_FIDELITY } = await import(D + 'contactFidelity.js');
const { FORCED_HIT_ALPHABET } = await import(D + 'forcedHit.js');
const { atlasLevelSource } = await import(D + 'levelSource.js');
const { parseTape } = await import(D + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(D + 'tapeRunner.js');
const W622 = JSON.parse(readFileSync(D + 'fixtures/chaser-witness/leash-l73-622-up-lavarunner.json', 'utf8'));
const WX = JSON.parse(readFileSync(D + 'fixtures/secondary-use-witness/secuse-l73-622-xc.json', 'utf8'));
const ls = atlasLevelSource();
const fork = () => createRunForStaging(stagingFromTape(parseTape(JSON.stringify(W622.tape))), ls);
CONTACT_FIDELITY.secondaryUse = true;
const L = (a) => a.join('+') || '·';
const hits = (r) => (r.ledger('playerHits') ?? []).length;
// depth-1 hitless
const d1 = [];
for (const a of FORCED_HIT_ALPHABET) { const f = fork(); f.advance(new Set(a)); f.advance(new Set()); if (!hits(f)) d1.push(a); }
console.log('hitless after [a, ·]:', d1.map(L));
// for each hitless first tick, hold each alphabet member until crossing/hit, up to 16 ticks
for (const a of d1) {
  const res = [];
  for (const b of FORCED_HIT_ALPHABET) {
    const f = fork(); let out = 'horizon'; let n = 0;
    try {
      let o = f.advance(new Set(a)); n = 1;
      for (; n < 16; n++) { o = f.advance(new Set(b)); if (hits(f)) { out = 'hit@' + (n+1); break; } if (o.transition) { out = 'X' + o.transition.to_level + '@' + (n+1); break; } }
    } catch (e) { out = 'refused'; }
    if (out.startsWith('X')) res.push(L(b) + ':' + out);
  }
  console.log(L(a), '→ crossings by holding:', res.join(' '));
}
// trajectory check: [up+P+S, up, up, up] vs WX.arms.XC samples
console.log('XC tape inputs', JSON.stringify(WX.arms.XC.inputs));
const f = fork(); const rows = [[0, f.level, f.state.x, f.state.y, 0]];
for (let t = 0; t < 4; t++) { const keys = t === 0 ? ['up','primary','secondary'] : ['up']; const o = f.advance(new Set(keys)); rows.push([t+1, f.level, f.state.x, f.state.y, hits(f)]); if (o.transition) break; }
console.log('model', JSON.stringify(rows));
console.log('game ', JSON.stringify(WX.arms.XC.samples.slice(0,5).map(s=>[s.t,s.level,s.x,s.y,s.hits])));
