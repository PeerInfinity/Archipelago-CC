// BOSSFORK D2: the revisit-57 tape (BOSSKILLS D1) in the model, ON/OFF: the build's teleporters, then every tick vs the game.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const R = '/home/user/Archipelago-CC/';
const M = R + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, createTapeStepper, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const E = R + 'CC/docs/cloud-reports/seedling-fidelity-bosskills-evidence/d1/';
const tape = JSON.parse(readFileSync(process.argv[2] ?? E + 'revisit-57.json', 'utf8'));
const game = JSON.parse(gunzipSync(readFileSync(process.argv[3] ?? E + 'revisit-57.probe.json.gz')).toString()).samples;
const SRC = atlasLevelSource();
for (const on of [false, true]) {
    withContactFidelity({ tentacleBeastFight: on }, () => {
        const run = createRunForStaging(stagingFromTape(parseTape(JSON.stringify({ ...tape, inputs: [], tick_count: 0 }))), SRC);
        const tp = run.world.teleporters.map((t) => `${t.x},${t.y}->L${t.to}${t.runtime ? `(${t.runtime})` : ''}`);
        const obs = new Map();
        const st = createTapeStepper(parseTape(JSON.stringify(tape)), { levelSource: SRC });
        let r = st.next();
        while (!r.done) { const o = r.value.observation; obs.set(o.t, o); r = st.next(); }
        const bad = [];
        for (const g of game) { const o = obs.get(g.t); if (!o || o.x !== g.x || o.y !== g.y || o.level !== g.level) bad.push(`t${g.t} game ${g.level}(${g.x},${g.y}) model ${o ? `${o.level}(${o.x},${o.y})` : '-'}`); }
        console.log(on ? 'ON ' : 'OFF', 'build teleporters', JSON.stringify(tp), '| ticks vs game:', game.length, 'mismatch', bad.length, bad.slice(0, 3).join('; '));
    });
}
