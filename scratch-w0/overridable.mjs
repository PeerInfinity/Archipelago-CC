// SCRATCH (W0): elements an override (Route A) could take exactly: region rooted, ONE arrival, no in-world walk-in from another member of a SHARED world.
import { readFileSync } from 'node:fs';
const E = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const M = JSON.parse(readFileSync('frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', 'utf8'));
const R = M.regions['1']; const S = M.preset_sidecars['1'];
const carrier = (n) => S[n].playable_payload ?? Object.values(S).find((s) => s.playable_payload && s.shared_world === S[n].shared_world)?.playable_payload;
const sharedOf = (n) => carrier(n)?.shared_world ? carrier(n).shared_world.regions : null;
const exits = E.parts.flatMap((p) => p.exits); const rec = E.parts.flatMap((p) => p.rec.filter((r) => !r.closure));
const tag = (l) => l.match(/\((landing [\d,]+|from [^)]+)\)$/)?.[1] ?? 'entrance';
const reg = (l) => l.match(/^(level_\d+(?:__r\d+c\d+)?)/)[1];
const arrivals = new Map();
for (const x of [...exits, ...rec]) { const r = reg(x.label); if (!arrivals.has(r)) arrivals.set(r, new Set()); arrivals.get(r).add(tag(x.label)); }
const walkIn = (n) => { const m = sharedOf(n); if (!m) return false; return m.some((o) => o !== n && R[o].exits.some((e) => e.connected_region === n)); };
const why = {}; const t = (k) => { why[k] = (why[k] ?? 0) + 1; };
const echo = new Set(JSON.parse(readFileSync('scratch-w0/out-full/echo-keys.json', 'utf8')));
let ok = 0, okEl = 0, allEl = 0, okEcho = 0, okClean = 0, cleanRegions = 0;
for (const [n, a] of arrivals) {
  const els = R[n].exits.filter((e) => exits.some((x) => x.region === n && x.exit === e.name)).length + (R[n].locations ?? []).length;
  allEl += els;
  const k = [...a].some((s) => s.startsWith('from')) ? 'internal-only (priced from roots)' : a.size > 1 ? 'several arrivals' : walkIn(n) ? 'walk-in from another member' : 'OVERRIDABLE';
  t(k); if (k === 'OVERRIDABLE') { ok++; okEl += els;
    const keys = [...R[n].exits.filter((e) => exits.some((x) => x.region === n && x.exit === e.name)).map((e) => `${n}|${e.name}`), ...(R[n].locations ?? []).map((l) => `${n}|@${l.name}`)];
    const e = keys.filter((x) => echo.has(x)).length; okEcho += e; okClean += keys.length - e; if (keys.length > e) cleanRegions++; }
}
console.log(JSON.stringify({ regionsWithRows: arrivals.size, byClass: why, overridableRegions: ok, overridableElements: okEl, overridableEchoed: okEcho, overridableEchoFree: okClean, regionsWithAnEchoFreeOverride: cleanRegions, elementsInRowedRegions: allEl }));
