// scratch: replay every committed tape; list each spinner shield-bump row the run stepped (plain shoves and dark hits)
const R = process.argv[2] ?? '/tmp/claude-0/sbwt/';
const D = R + 'frontend/modules/seedlingDemo/';
const { runTape } = await import(D + 'tapeRunner.js');
const { atlasLevelSource } = await import(D + 'levelSource.js');
const fx = await import(D + 'fixtures/index.js');
const src = atlasLevelSource();
for (const name of fx.fixtureNames()) {
    let run = null;
    try {
        runTape(fx.loadTape(name), { levelSource: src, onTick: (t, s, h, r) => { run = r; } });
    } catch (e) { continue; }
    const rows = (run?.shieldBumps ?? []).filter((b) => b.family === 'spinner');
    if (rows.length) console.log(name, JSON.stringify(rows.slice(0, 6)));
}
console.log('DONE');
