// MEASUREMENT ONLY: AXIS's row-2 scene (L6's bob@112,48 dead ahead on the y = 56 lane), driven ON with the switch, under
// whatever $L12_DESIGN the design loader applies. Prints the strike trace, the landed press hits and the player hits.
const ROOT = process.env.AXIS_ROOT;
const D = ROOT + '/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(D + 'levelSource.js');
const { createLevelRun } = await import(D + 'levelRun.js');
const { ROLES } = await import(D + 'levelWorld.js');
const { drive } = await import(D + 'botDriverV2.js');
const { axisStrikeFor } = await import(D + 'solverBot.js');
const { withAxisStrike } = await import(D + 'pressKillCost.js');
const run = createLevelRun({ levelSource: atlasLevelSource(), boot: { level: 6, x: 80, y: 48 }, noclip: false, noHazards: [],
    noDamage: false, grants: [], persistence: [], despawn: [], equips: [], pins: ['dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] }, rng: null, seam: { items: { hasSword: true } }, roles: ROLES });
const strike = withAxisStrike(true, () => axisStrikeFor(run));
const adv = run.advance.bind(run);
run.advance = (k) => { if (run.ticksCompleted >= 40) throw Object.assign(new Error('cap'), { cap: true }); return adv(k); };
try { withAxisStrike(true, () => drive(run, { x: 160, y: 56 }, [], { until: 'arrival', tolerance: 0, maxTicks: 400, what: 'lane',
    avoidVolumes: false, strike, axisAligned: true })); } catch (e) { if (!e.cap) throw e; }
console.log(JSON.stringify({ design: process.env.L12_DESIGN ?? 'built',
    strikes: strike.trace.filter((t) => t.decision !== 'none').map((t) => [t.tick, t.decision]),
    landed: run.chaserPressHits.filter((h) => h.landed).map((h) => [h.t, h.id, h.hits]),
    playerHits: run.playerHits.map((h) => [h.t, h.id]) }));
