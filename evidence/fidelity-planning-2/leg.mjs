// one solve, no budget: node leg.mjs '<json {level, arrive, exitTile:[tx,ty] | goal, kit:"bare"|"sword"|"full", dashMode, economies}>'
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const R = new URL('../../frontend/modules/', import.meta.url).pathname;
const { createJsRuntime } = await import(R + 'seedlingDemo/jsRuntimeCore.js');
const { replayTape, liveOf } = await import(R + 'seedlingDemo/jsRuntimeSolver.js');
const { solveSegment } = await import(R + 'seedlingDemo/solverBot.js');
const { indexLevels, levelSourceFromAtlas } = await import(R + 'seedlingDemo/atlasSource.js');
const MAP = JSON.parse(readFileSync(R + 'flashPanel/atlases/seedling-map.json', 'utf8'));
const SRC = levelSourceFromAtlas(indexLevels(MAP));
const FULL = ['hasSword', 'hasShield', 'hasFire', 'hasWand', 'canSwim', 'hasSpear', 'hasFeather', 'hasTorch', 'hasDarkSuit'];
const a = JSON.parse(process.argv[2]);
const rt = createJsRuntime(); rt.setVanilla(MAP);
const kit = a.kit === 'full' ? FULL : a.kit === 'sword' ? ['hasSword'] : (a.kit === 'bare' || !a.kit) ? [] : a.kit;
if (kit.length) rt.queueItems(kit.map((p) => ({ class: 'Main', property: p, value: true })));
rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [a.level, a.arrive.x, a.arrive.y] }]); rt.tick();
const s = rt.session; if (a.debug) console.error(JSON.stringify({primary: rt.run.primary, scratch: rt.run.scratchPersistence, boot: s.staging.boot, stagingKeys: Object.keys(s.staging), main: s.staging.main ?? s.staging.items}));
const shadow = replayTape({ staging: s.staging, perTick: s.perTick, levelSource: SRC, scratchPersistence: rt.run.scratchPersistence === true });
let goal = a.goal;
if (!goal && a.exitTile) {
  const [tx, ty] = a.exitTile;
  const tp = shadow.world.teleporters.find((t) => Math.floor(t.x / 16) === tx && Math.floor(t.y / 16) === ty)
    ?? shadow.world.teleporters.find((t) => Math.abs(t.x - tx * 16) <= 16 && Math.abs(t.y - ty * 16) <= 16);
  if (!tp) { console.log(JSON.stringify({ ...a, err: 'no tp', tps: shadow.world.teleporters.map((t) => [t.x, t.y]) })); process.exit(0); }
  goal = { kind: 'reach-exit', exit: { x: tp.x, y: tp.y } };
}
let ticks = 0; const t0 = performance.now();
const run = new Proxy(shadow, { get(t, p) { const v = Reflect.get(t, p); if (p === 'advance') return (...x) => { ticks++; return v.apply(t, x); }; return typeof v === 'function' ? v.bind(t) : v; } });
let res;
try {
  const opts = { run, goals: [goal], name: 'l16-budget', boot: s.staging.boot, prefix: s.perTick };
  if (a.dashMode) opts.dashMode = a.dashMode;
  if (a.economies !== undefined) opts.economies = a.economies;
  const out = solveSegment(opts);
  const sol = out.perTick.length - s.perTick.length;
  const rows = out.trace?.rows ?? [];
  const verbs = rows.map((r) => r.strategy?.verb).filter(Boolean);
  const dash = rows.filter((r) => r.strategy?.swordDash?.planned).length;
  const dashSaved = rows.reduce((n, r) => n + (r.strategy?.swordDash?.planned ? (r.strategy.swordDash.saved ?? 0) : 0), 0);
  res = { ok: true, hash: createHash('md5').update(out.perTick.map((h) => [...h].sort().join('+')).join('|')).digest('hex').slice(0, 10), keys: sol, verbs: [...new Set(verbs)].sort(), verbSeq: verbs.slice(0, 40), endLevel: shadow.level, deaths: shadow.playerDeaths.length, dashRows: dash, dashSaved, rungs: [...new Set(rows.map((r) => r.strategy?.rung).filter(Boolean))], rows: rows.length };
} catch (e) { res = { ok: false, err: `${e.name}: ${String(e.message).replace(/\s+/g, ' ').slice(0, 3000)}` }; }
console.log(JSON.stringify({ ...a, goal, ms: Math.round(performance.now() - t0), advances: ticks, ...res }));
