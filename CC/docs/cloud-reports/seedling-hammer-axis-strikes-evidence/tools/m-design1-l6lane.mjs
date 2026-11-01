const M = (process.env.AXIS_ROOT ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { createLevelRun } = await import(M + 'levelRun.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { drive } = await import(M + 'botDriverV2.js');
const { ROLES } = await import(M + 'levelWorld.js');
const SB = await import(M + 'solverBot.js');
const ls = atlasLevelSource();
const l6 = () => createLevelRun({ levelSource: ls, boot: { level: 6, x: 80, y: 48 }, noclip: false, noHazards: [], noDamage: false,
    grants: [], persistence: [], despawn: [], equips: [], pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: null, seam: { items: { hasSword: true } }, roles: ROLES });
for (const on of [false, true]) {
    const run = l6(); const strike = on ? SB.strikePolicyFor(run, { axisAlong: true }) : null; const perTick = []; const pos = [];
    const adv = run.advance.bind(run); run.advance = (k) => { if (run.ticksCompleted >= 40) throw Object.assign(new Error('cap'), { cap: true }); const o = adv(k); pos.push([run.state.x, run.state.y, run.state.vx, run.state.vy]); return o; };
    try { drive(run, { x: 160, y: 56 }, perTick, { until: 'arrival', tolerance: 0, maxTicks: 300, what: 'x', avoidVolumes: false, strike, axisAligned: true }); } catch (e) { if (!e.cap) throw e; }
    console.log(on, perTick.map((h) => [...h].sort().join('+')).join(' '));
    { const bad = pos.findIndex((p) => Math.abs(p[0] * 20 - Math.round(p[0] * 20)) > 1e-9); console.log(' firstOffGrid', bad, pos[bad]); }
    console.log(' grid', pos.every((p) => Math.abs(p[0] * 20 - Math.round(p[0] * 20)) < 1e-9), 'y', [...new Set(pos.map((p) => p[1]))], 'vy', [...new Set(pos.map((p) => p[3]))]);
    console.log(' press', JSON.stringify(run.chaserPressHits.filter((h) => h.landed).map((h) => [h.t, h.id, h.hits])), 'hits', JSON.stringify(run.playerHits.map((h) => h.t)), strike?.trace.filter((t) => t.decision !== 'none').map((t) => `${t.tick}:${t.decision}:${t.direction ?? ''}`));
    const pv = SB.previewWalk(l6(), [{ x: 160, y: 56 }], 0, { strike: on ? SB.strikePolicyFor(l6(), { axisAlong: true }) : null, axisAligned: true });
    console.log(' preview', pv.samples.slice(0, 19).map((x) => [...(x.held ?? [])].sort().join('+')).join(' '));
}
