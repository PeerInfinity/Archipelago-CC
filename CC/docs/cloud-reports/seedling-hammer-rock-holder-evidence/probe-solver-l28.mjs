// Solver witness (node): the re-measure-2 Arm A′ refusal reproduced — L28 from (136,296), the rope's {28,0} and the
// fallrock's {28,1} cleared, reach-exit the L30 door at (304,16). Prints the refusal or the plan's length/hits.
//   node CC/docs/cloud-reports/seedling-hammer-rock-holder-evidence/probe-solver-l28.mjs [cleared=0,1]
import { atlasLevelSource } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { createRunForStaging } from '../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { arrivalStaging } from '../../../../frontend/modules/seedlingDemo/fidelityArrival.js';
import { solveSegment, SolverRefusal } from '../../../../frontend/modules/seedlingDemo/solverBot.js';
const arg = process.argv.find((a) => a.startsWith('cleared='));
const cleared = arg ? arg.slice(8).split(',').filter(Boolean).map(Number) : [0, 1];
const boot = { level: 28, x: 128, y: 288 }; // → run.state (136,296), Arm A′'s "(136,296)"
const run = createRunForStaging(arrivalStaging(boot, { items: ['hasSword'], cleared }), atlasLevelSource());
try {
    const out = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 304, y: 16 } }], name: 'rock-holder-l28', boot });
    console.log(JSON.stringify({ cleared, solved: true, ticks: out.perTick.length, hits: run.damage.hits,
        level: run.level, x: run.state.x, y: run.state.y }));
} catch (e) {
    if (!(e instanceof SolverRefusal)) throw e;
    console.log(JSON.stringify({ cleared, solved: false, obstacle: e.obstacle, message: e.message }));
}
