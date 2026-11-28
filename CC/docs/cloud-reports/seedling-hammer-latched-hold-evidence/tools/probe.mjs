// usage: LH_PROBE=1 node probe.mjs <jsonl> <id> <i>
const R = '/home/user/Archipelago-CC/';
const sb = await import(R + 'frontend/modules/seedlingDemo/solverBot.js');
let n = 0;
globalThis.__lhProbe = (run, resolved, ctx) => {
  n += 1;
  const t = (run.world.pressers ?? []).find((p) => resolved.target && p.x === resolved.target.x && p.y === resolved.target.y);
  console.log('PROBE', n, JSON.stringify({ what: String(ctx.what).slice(-120), tick: run.ticksCompleted, at: [run.state.x, run.state.y, run.state.vx, run.state.vy],
    target: resolved.target, stance: resolved.stance, latched: resolved.latched, holdLatched: resolved.hold?.latched, ticks: resolved.hold?.ticks,
    until: resolved.hold?.until?.why, presser: t ? { tag: t.tag, t: t.t, room: t.room, rect: t.rect } : null,
    latchedGroups: [...(run.entities('latchedGroups') ?? [])], open: [...(run.entities('openActivators') ?? [])],
    untilNow: resolved.hold?.until?.test?.(run), lobbers: (run.entities('bombPushers') ?? []).map((b) => ({ id: b.id, x: b.x, y: b.y, shotTime: b.shotTime })),
    aim: ctx.aim ?? null, fork: typeof ctx.fork }));
};
process.argv.splice(2, 0); await import('./solvecap.mjs');
