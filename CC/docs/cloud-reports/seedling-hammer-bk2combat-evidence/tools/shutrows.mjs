// scratch (BK2COMBAT): the latch boot (AT=hx,hy header, TREE=1 pocket shut) solved under the env; print the refusal's
// own records/rows for the kill/press decisions (arm, target, stance, landings, hits) — decides nothing.
const ROOT = process.env.ROOT ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const { l40LatchBoot, l40LatchSolve } = await import(M + 'fidelityL40Latch.js');
let boot = await l40LatchBoot();
if (process.env.AT) { const [x, y] = process.env.AT.split(',').map(Number); boot = { ...boot, boot: { ...boot.boot, x, y } }; }
if (process.env.TREE === '1') boot = { ...boot, persistence: boot.persistence.filter((p) => !(p.level === 40 && p.tag === 0)) };
const { out, refusal } = await l40LatchSolve(boot, {});
const o = out ?? refusal;
console.log(out ? `SOLVED ${out.perTick.length}` : `REFUSED ${String(refusal.message).slice(0, 300)}`);
console.log('keys', Object.keys(o ?? {}).join(','));
for (const r of o.records ?? []) if (r.strategy !== 'walk') console.log('REC', JSON.stringify(r).slice(0, 900));
const rows = o.rows ?? o.trace?.rows ?? [];
for (const r of rows) if (r.strategy && /kill|time|bait|walk/.test(r.strategy.verb) && r.obstacle?.id) console.log('ROW', r.tick, r.strategy.verb, r.obstacle.id, JSON.stringify(r.strategy).slice(0, 300), JSON.stringify(r.rejected ?? []).slice(0, 600));
