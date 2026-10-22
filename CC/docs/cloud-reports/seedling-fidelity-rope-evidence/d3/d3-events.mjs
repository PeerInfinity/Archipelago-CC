// D3: rules-rope-events' rope EVENTS through the JS mapping, OFF vs ON, in the merged throwaway tree.
const T = process.env.TREE ?? '/home/user/rope-wt';
const fs = await import('node:fs');
const { atlasEventGoal, runtimeEventsOf } = await import(T + '/frontend/modules/flashPanel/seedlingPlaybackController.js');
const { solverGoalFor } = await import(T + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const PT = JSON.parse(fs.readFileSync(T + '/frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json', 'utf8'));
const SC = PT.preset_sidecars['1'];
const { events } = runtimeEventsOf(PT);
const ropes = events.filter((e) => e.obstacle?.class === 'rope');
for (const e of ropes) {
  const side = SC[e.side]?.playable_payload;
  console.log(JSON.stringify({ location: e.location, eventId: e.eventId, level: e.level, tag: e.tag, obstacle: e.obstacle, side: e.side, sideLevel: side?.level, action: e.action }));
  console.log('  side payload keys', Object.keys(side ?? {}).join(','));
  const goal = atlasEventGoal(e, side?.level ?? null);
  console.log('  goal', JSON.stringify(goal));
  const mapped = solverGoalFor(goal, { run: { level: goal.level }, resolved: null });
  console.log('  mapped', JSON.stringify(mapped).slice(0, 400));
}
