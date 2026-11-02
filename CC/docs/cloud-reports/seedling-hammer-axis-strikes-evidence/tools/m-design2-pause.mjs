// design (2) scratch: at rest on the lane, an aim key perpendicular to the walk (up), then the press (primary alone),
// then let it settle; then the best return (the opposite key) — how far off the lane, for how long, and back exactly?
const M = (process.env.AXIS_ROOT ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { createLevelRun } = await import(M + 'levelRun.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { ROLES } = await import(M + 'levelWorld.js');
const ls = atlasLevelSource();
const mk = () => createLevelRun({ levelSource: ls, boot: { level: 6, x: 80, y: 48 }, noclip: false, noHazards: [], noDamage: true,
    grants: [], persistence: [], despawn: [], equips: [], pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: null, seam: { items: { hasSword: true } }, roles: ROLES });
const S = (a) => new Set(a);
for (const [name, seq] of [
    ['aim up, press, settle', [['up'], ['primary'], [], [], [], [], [], []]],
    ['aim up, press, then down until back', [['up'], ['primary'], ['down'], ['down'], [], [], [], [], [], []]],
    ['aim up, press, down x1', [['up'], ['primary'], ['down'], [], [], [], [], []]],
]) {
    const run = mk();
    const y0 = run.state.y; const rows = [];
    for (const k of seq) { run.advance(S(k)); rows.push(`${k.join('+') || '-'}:${(run.state.y - y0).toFixed(4)}/${run.state.vy.toFixed(3)}`); }
    console.log(name, '| y0', y0, '|', rows.join(' '), '| back exactly:', run.state.y === y0);
}
