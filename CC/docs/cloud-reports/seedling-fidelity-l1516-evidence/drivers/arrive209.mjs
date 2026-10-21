import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const jl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const leg = jl(arg('legs')).find((l) => l.id === Number(arg('id')));
const row = jl(arg('rows')).find((r) => r.key === leg.key);
const dump = JSON.parse(readFileSync(arg('dump'), 'utf8'));
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { mountedRecordsOf } = await M('seedlingDemo/wasmWalkTape.js');
const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { createRunForStaging } = await M('seedlingDemo/tapeRunner.js');
const RECS = mountedRecordsOf(dump.deliveredSet);
const SRC = levelSourceFromAtlas(RECS);
const rt = createJsRuntime();
rt.setVanilla(RECS);
rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
rt.tick();
let staging = { ...rt.session.staging, inventory_slots: row?.slots ?? [],
    seam: { ...(rt.session.staging.seam ?? {}), items: { ...(rt.session.staging.seam?.items ?? {}), ...(row?.items ?? {}) } } };
const shift = Number(arg('shift', 0));
staging = { ...staging, seam: { ...staging.seam, time: row.seamTime + shift } };
console.log('arrive', JSON.stringify(leg.arrive), 'seamTime', row.seamTime + shift, 'boot', JSON.stringify(staging.boot ?? null));
const run = createRunForStaging(staging, SRC, { scratchPersistence: true });
const N = Number(arg('n', 30));
for (let i = 0; i < N; i += 1) {
  run.advance(new Set());
  const s = run.state;
  const arrows = (run.arrowsInFlight ?? []).map((a) => `${a.x.toFixed?.(1) ?? a.x},${a.y.toFixed?.(1) ?? a.y}`).join(' ');
  console.log(JSON.stringify(run.damage).slice(0,160), run.ticksCompleted, s.x.toFixed(2), s.y.toFixed(2), 'hits', JSON.stringify((run.ledger('playerHits') ?? []).map((h) => [h.t, h.source, h.id])), 'arrows', arrows);
}
