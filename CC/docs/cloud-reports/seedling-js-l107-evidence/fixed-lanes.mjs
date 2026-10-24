// seedling-js-l107-investigate Q3: which FIXED corridor y passes at which arrival clocks (one bob period, step 3)?
// And with a free stall 0..89 under the corridor (the PHASE arm's lever), does the tile-centre row ever pass?
// Usage: node fixed-lanes.mjs lanes | node fixed-lanes.mjs stalls <y> <seam,seam,..>
const R = new URL('../../../../', import.meta.url).pathname;
const { laneWalk } = await import(R + 'scripts/procgen/probe-seedling-l107-lane.mjs');
const [mode, ...rest] = process.argv.slice(2);
if (mode === 'lanes') {
  for (let y = 114; y <= 138; y += 2) {
    const ok = [];
    for (let seam = 5564; seam < 5654; seam += 3) if ((await laneWalk(seam, { fixed: y })).ok) ok.push(seam);
    console.log(JSON.stringify({ fixedY: y, okClocks: ok.length, of: 30, ok: ok.join(',') }));
  }
} else {
  const y = Number(rest[0]);
  for (const seam of rest[1].split(',').map(Number)) {
    const ok = [];
    for (let stall = 0; stall < 90; stall += 1) if ((await laneWalk(seam, { fixed: y, stall })).ok) ok.push(stall);
    console.log(JSON.stringify({ fixedY: y, seam, okStalls: ok.length, of: 90, ok: ok.join(',') }));
  }
}
