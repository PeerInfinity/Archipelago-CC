// map census rows to legs by pid order (legs run sequentially, one process each); ids from IDS order
const fs = require('fs'); const jl = (p) => fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const [outP, cenP] = process.argv.slice(2);
const out = jl(outP); const cen = jl(cenP);
const pids = []; for (const r of cen) if (!pids.includes(r.pid)) pids.push(r.pid);
// a leg with no successful segment has no census row: assign by matching segment counts is impossible, so print per pid with ticks
for (const pid of pids) {
  const rows = cen.filter((r) => r.pid === pid);
  console.log(pid, rows.map((r) => `${r.name}:${r.ticks}t unbilled[${(r.unbilled ?? []).map((h) => `t${h.t} ${h.id}${h.died ? '†' : ''}`).join(',')}] billed${r.billed} gate${r.gate}`).join(' || '));
}
