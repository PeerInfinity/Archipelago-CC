import { readFileSync } from 'node:fs';
const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
// split into passes where t drops
let pass = 0; let lastT = -1; for (const r of rows) { if (r.t < lastT) pass += 1; r.pass = pass; lastT = r.t; }
const derivs = new Map(); // pass:t -> rows
for (const r of rows) { const k = `${r.pass}:${r.t}`; if (!derivs.has(k)) derivs.set(k, []); derivs.get(k).push(r); }
const keys = [...derivs.keys()];
let tot = 0, states = 0; const c = { sameCellPrev: [0, 0], sameCellStartPrev: [0, 0], sameMotionGivenStart: [0, 0], sameFullGivenStart: [0, 0], sameVerdictGivenStart: [0, 0],
  anyEarlierSameCellStart: [0, 0], anyEarlierSameFull: [0, 0], sameCellAnyStartMotionEqual: [0, 0], suffix: [0, 0], trunc: [0, 0], unsafe: [0, 0], strikes: [0, 0] };
const add = (k, r) => { c[k][0] += 1; c[k][1] += r.n; };
const seen = new Map(); // pass|cell|start -> list rows
const verdict = (r) => `${r.trunc}|${r.unsafeAt === null ? 'safe' : 'unsafe'}|${r.n}`;
let gaps = new Map();
for (let j = 0; j < keys.length; j += 1) {
  const cur = derivs.get(keys[j]); const [p, t] = keys[j].split(':').map(Number);
  const prevK = j > 0 ? keys[j - 1] : null; const prev = prevK && prevK.startsWith(`${p}:`) ? derivs.get(prevK) : [];
  if (prev.length) { const dt = t - Number(prevK.split(':')[1]); gaps.set(dt, (gaps.get(dt) ?? 0) + 1); }
  const pm = new Map(prev.map((r) => [r.cell, r]));
  for (const r of cur) {
    tot += 1; states += r.n;
    if (r.trunc) add('trunc', r); if (r.unsafeAt !== null) add('unsafe', r); if (r.strikes) add('strikes', r);
    const q = pm.get(r.cell);
    if (q) { add('sameCellPrev', r);
      if (q.start === r.start) { add('sameCellStartPrev', r); if (q.motion === r.motion) add('sameMotionGivenStart', r); if (q.full === r.full) add('sameFullGivenStart', r); if (verdict(q) === verdict(r)) add('sameVerdictGivenStart', r); }
      else if (q.motion === r.motion) add('sameCellAnyStartMotionEqual', r);
    }
    const sk = `${p}|${r.cell}|${r.start}`; const L = seen.get(sk);
    if (L) { add('anyEarlierSameCellStart', r); if (L.some((x) => x.full === r.full)) add('anyEarlierSameFull', r); }
    if (!L) seen.set(sk, [r]); else L.push(r);
  }
}
console.log({ walks: tot, states, derivations: keys.length });
for (const [k, [n, s]] of Object.entries(c)) console.log(k.padEnd(28), String(n).padStart(6), (100 * n / tot).toFixed(1).padStart(6) + '% walks', String(s).padStart(9), (100 * s / states).toFixed(1).padStart(6) + '% states');
console.log('gap between consecutive derivations (ticks):', JSON.stringify([...gaps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)));
const perDeriv = keys.map((k) => derivs.get(k).length); perDeriv.sort((a, b) => a - b);
console.log('walks per derivation: median', perDeriv[perDeriv.length >> 1], 'max', perDeriv[perDeriv.length - 1]);
