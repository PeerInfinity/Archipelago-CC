// seedling-js-l107-investigate Q2 (model side): the lane walk (or `--fixed=<y>`'s control) at every clock of a range,
// one JSON line per clock. The walk itself is `laneWalk` in scripts/procgen/probe-seedling-l107-lane.mjs.
// Usage: node lane-walk.mjs <seamFrom> <seamTo> [--fixed=<y>]
const R = new URL('../../../../', import.meta.url).pathname;
const { laneWalk } = await import(R + 'scripts/procgen/probe-seedling-l107-lane.mjs');
const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith('--')).map(Number);
const fixed = Number(process.argv.find((x) => x.startsWith('--fixed='))?.slice(8) ?? NaN);
for (let seam = a; seam <= b; seam += 1) {
  const { perTick, staging, ...w } = await laneWalk(seam, { fixed });
  console.log(JSON.stringify(w));
}
