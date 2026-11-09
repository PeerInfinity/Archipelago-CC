const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { ARRIVAL_SOLID_LANDINGS, arrivalArms } = await import(M + 'fidelityArrival.js');
const { runTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const SRC = atlasLevelSource();
const arms = arrivalArms();
for (const l of ARRIVAL_SOLID_LANDINGS.filter((x) => x.press !== false)) {
  const a = arms.find((x) => x.arm === `${l.key}-HELD-press-sword`);
  for (const on of [false, true]) {
    const m = withContactFidelity({ rockGoneFencepost: on }, () => runTape(a.tape, { levelSource: SRC }));
    const t = m.ticks; const first = t.findIndex((r) => r.x !== t[0].x || r.y !== t[0].y);
    console.log(l.key, on ? 'ON ' : 'OFF', 'first move obs', first, 'goneAt', m.rocksBroken[0]?.goneAt);
  }
}
