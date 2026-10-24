// SCRATCH (SFF): hammerPressKillGuards HO2 under the floor ON (default), guard OFF and ON.
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { solveSegment, STRIKE_ETA_FLOOR } = await import(M + 'solverBot.js');
const { withPressKillRebootGuard } = await import(M + 'pressKillGuards.js');
const stagingOf = () => solveStaging(stagingFromTape(parseTape(readFileSync(M + 'fixtures/hammer-lb-hx/boot-414.json', 'utf8'))));
const capped = (on, cap) => {
    const staging = stagingOf();
    const run = createRunForStaging(staging, atlasLevelSource());
    const advance = run.advance.bind(run);
    run.advance = (k) => { if (run.ticksCompleted >= cap) throw Object.assign(new Error('sentinel'), { sentinel: true }); return advance(k); };
    try {
        withPressKillRebootGuard(on, () => solveSegment({ run, goals: [{ kind: 'collect-placement', placement: { x: 880, y: 816 } }], name: 'lb-ho2', boot: staging.boot, dashMode: 'all' }));
    } catch (e) { return { sentinel: !!e.sentinel, name: e.name, t: run.ticksCompleted, deaths: run.ledger('playerDeaths').map((d) => [d.t, d.id ?? d.by]), obstacle: e.obstacle, perTick: e.perTick?.length, msg: String(e.message).slice(0, 400) }; }
    return { solved: true, t: run.ticksCompleted, deaths: run.ledger('playerDeaths').map((d) => d.t) };
};
console.log('floor', STRIKE_ETA_FLOOR.enabled, 'cap', process.argv[2]);
console.log('guard OFF', JSON.stringify(capped(false, +process.argv[2])));
console.log('guard ON ', JSON.stringify(capped(true, +process.argv[2])));
