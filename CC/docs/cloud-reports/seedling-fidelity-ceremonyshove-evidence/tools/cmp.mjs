// CEREMONYSHOVE D1/D2 (scratch, measure-only): a recorded GAME frame log (`game-frames-*.json.gz`: the tape + every
// botMobiles/botStatus poll, as probe-seedling-chaser-mobiles takes them) against the model, tick by tick: the player
// position, the player's hits_timer, the BobSoldier's position/velocity/hits/hits_timer. EITHER=1 compares each tick
// against the closer of its FIRST and LAST game sample: the Bot's tick stands still through dead frames, so the first
// poll at the tick after a ceremony starts is pre-lump and the last poll at the release tick is post-release.
//   EITHER=1 SEEDLING_STRIKE_IFRAME_LAPSE=1 SEEDLING_CEREMONY_SHOVE=1 node cmp.mjs <game-frames.json.gz> [maxRows]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const M = `${process.env.REPO ?? process.cwd()}/frontend/modules/seedlingDemo/`;
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const raw = readFileSync(process.argv[2]);
const G = JSON.parse((process.argv[2].endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8'));
const max = +(process.argv[3] ?? 12);
const game = new Map(); const gameLast = new Map();
for (const f of G.frames) { const t = f.mobiles.tick ?? f.status.tick; if (!Number.isInteger(t)) continue; const first = !game.has(t);
  const rows = f.mobiles.mobiles ?? []; const p = rows.find(r => /Player$/.test(r.cls)); if (!p) continue;
  const b = rows.find(r => /BobSoldier$/.test(r.cls));
  (first ? game : gameLast).set(t, { px: p.x, py: p.y, pvx: p.vx, pvy: p.vy, pht: f.status.hits_timer, b: b ? { x: b.x, y: b.y, vx: b.vx, vy: b.vy, ht: b.enemy.hits_timer, h: b.enemy.hits, a: b.alpha } : null }); }
let run = null; const model = new Map(); let err = null;
const st = createTapeStepper(parseTape(JSON.stringify(G.tape)), { levelSource: atlasLevelSource(), onTick: (a, b, c, rn) => { run = rn; } });
try { let r = st.next(); while (!r.done) { const o = r.value.observation; const c = (run?.entities('chasers') ?? []).find(c => !c.removed);
  model.set(o.t, { px: o.x, py: o.y, pht: run?.damage?.hitsTimer, b: c ? { x: c.x, y: c.y, vx: c.vx, vy: c.vy, ht: c.hitsTimer, h: c.hits } : null }); r = st.next(); } } catch (e) { err = e.message.slice(0, 200); }
let n = 0, worst = 0, cmp = 0;
const d = (a, b) => Math.abs((a ?? 0) - (b ?? 0));
const delta = (m, g) => { const pd = Math.max(d(m.px, g.px), d(m.py, g.py));
  const bd = (m.b && g.b) ? Math.max(d(m.b.x, g.b.x), d(m.b.y, g.b.y), d(m.b.vx, g.b.vx), d(m.b.vy, g.b.vy), d(m.b.ht, g.b.ht), d(m.b.h, g.b.h)) : ((!!m.b) !== (!!g.b) ? 999 : 0);
  return Math.max(pd, bd, d(m.pht, g.pht)); };
const T = G.tape.tick_count;
for (const [t, m] of [...model].sort((a, b) => a[0] - b[0])) { if (t >= T) continue; let g = game.get(t); if (!g) continue; cmp++;
  const gl = gameLast.get(t); if (process.env.EITHER && gl && delta(m, gl) < delta(m, g)) g = gl;
  const pd = Math.max(d(m.px, g.px), d(m.py, g.py));
  const bd = (m.b && g.b) ? Math.max(d(m.b.x, g.b.x), d(m.b.y, g.b.y), d(m.b.vx, g.b.vx), d(m.b.vy, g.b.vy), d(m.b.ht, g.b.ht), d(m.b.h, g.b.h)) : ((!!m.b) !== (!!g.b) ? 999 : 0);
  const hd = d(m.pht, g.pht);
  const w = Math.max(pd, bd, hd); worst = Math.max(worst, w);
  if (w > 1e-9 && n++ < max) console.log(`t${t} Δplayer ${pd.toFixed(3)} Δbody ${bd.toFixed(3)} Δpht ${hd} | model p(${m.px.toFixed(2)},${m.py.toFixed(2)}) ht${m.pht} b${JSON.stringify(m.b && Object.fromEntries(Object.entries(m.b).map(([k,v])=>[k,+(+v).toFixed(2)])))} | game p(${g.px.toFixed(2)},${g.py.toFixed(2)}) ht${g.pht} b${JSON.stringify(g.b && Object.fromEntries(Object.entries(g.b).map(([k,v])=>[k,+(+v).toFixed(2)])))}`); }
console.log(`compared ${cmp} ticks, mismatching ${n}, worst ${worst}${err ? ' MODEL THREW: ' + err : ''}`);
