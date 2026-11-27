const L = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/hammerStep189Legs.js');
const SB = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js');
const { replayTape } = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { tape, levelSource } = L.staged(L.REQ_38_6);
const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips ?? null, scratchPersistence: tape.scratchPersistence === true });
for (const b of run.entities('strikeBodies')) { const t0=Date.now(); const c = SB.pinnedSpearStances(run, b, new Set()); const l = SB.chaserLineStances(run, b, new Set()); console.log(b.id, Date.now()-t0, JSON.stringify(c), 'line', l.length, 'overlap', c.filter(x=>l.some(y=>y.x===x.x&&y.y===x.y)).length); }
