// Model witness, the IN-RUN fall: fidelityRope's L28 row (the L25 arrival (96,16), the Sword, nothing cleared, clear-tag
// {28,0} — the rope cut in play), then 300 idle ticks so the rock's freeze/fall/camera span runs out. Prints the rock's
// fall ledger, the button and the grass lock. (The game: the rock lands on the button's cell as a Solid —
// FallRock.as:76-83 — and Button.update collides "Solid", Button.as:31.)
//   node CC/docs/cloud-reports/seedling-hammer-rock-holder-evidence/probe-model-l28-live-fall.mjs
import { atlasLevelSource } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { createRunForStaging } from '../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { arrivalStaging } from '../../../../frontend/modules/seedlingDemo/fidelityArrival.js';
import { solveSegment } from '../../../../frontend/modules/seedlingDemo/solverBot.js';
const boot = { level: 28, x: 96, y: 16 };
const run = createRunForStaging(arrivalStaging(boot, { items: ['hasSword'], cleared: [] }), atlasLevelSource());
const out = solveSegment({ run, goals: [{ kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 },
    obstacle: 'rope@160,64' }], name: 'rock-holder-live-fall', boot });
console.log(JSON.stringify({ planTicks: out.perTick.length, ropePulls: run.ledger('ropePulls') }));
for (let i = 0; i < 300; i += 1) run.advance(new Set());
console.log(JSON.stringify({ t: run.ticksCompleted, level: run.level, rockFalls: run.rockFalls,
    activators: run.activatorsNow, open: run.openActivators }));
