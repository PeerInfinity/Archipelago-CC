// The prefixes of a staging's own solved plan that END INSIDE A SWING (slashing up), solved OFF and ON.
const R = (process.env.TREE ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
import { readFileSync } from 'node:fs';
const { solveFromTape, liveOf, replayTape } = await import(R + 'jsRuntimeSolver.js');
const { solveStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const { parseTape } = await import(R + 'tapeFormat.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { withContactFidelity, CONTACT_FIDELITY_KEYS } = await import(R + 'contactFidelity.js');
const src = atlasLevelSource();
const GOAL = { kind: 'encounter', at: { x: 64, y: 128 }, drop: { item: 'Fire' }, then: null };
const [name] = process.argv.slice(2);
const t = JSON.parse(readFileSync(R + `fixtures/tapes/${name}.json`, 'utf8'));
const staging = solveStaging(stagingFromTape(parseTape({ ...t, tick_count: 0, inputs: [] })));
const solve = (perTick) => solveFromTape({ staging, perTick, live: liveOf(replayTape({ staging, perTick, levelSource: src, scratchPersistence: true })), levelSource: src, solverGoal: GOAL, scratchPersistence: true, dashMode: 'none' });
const hasKey = CONTACT_FIDELITY_KEYS.includes('encounterSwingInFlight');
const arm = (on, fn) => (hasKey ? withContactFidelity({ encounterSwingInFlight: on }, fn) : fn());
const base = solve([]);
const plan = base.solution;
const run = replayTape({ staging, perTick: [], levelSource: src, scratchPersistence: true });
const ks = [];
for (let k = 0; k < plan.length; k++) { if (k > 0 && run.progress('slashInfo').state.slashing && run.entities('bobBoss').get('boss')) ks.push(k); run.advance(plan[k]); }
console.log(name, 'base', plan.length, 'in-swing prefixes', ks.length, JSON.stringify(ks));
const verdict = (fn) => { try { return `SOLVED ${fn().solution.length}`; } catch (e) { return `REFUSED ${String(e.message).replace(/^.*?: /, '').slice(0, 200)}`; } };
for (const k of ks) {
  const off = arm(false, () => verdict(() => solve(plan.slice(0, k))));
  const on = hasKey ? arm(true, () => verdict(() => solve(plan.slice(0, k)))) : '-';
  console.log(`${name} k=${k} OFF ${off} | ON ${on}`);
}
