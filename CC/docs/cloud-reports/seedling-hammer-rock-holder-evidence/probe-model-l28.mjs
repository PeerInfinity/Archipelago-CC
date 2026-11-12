// Model witness (node, levelRun): L28 booted at (136,296) — the walk's arrival in re-measure-2 Arm A′ — with the
// rope's tag 0 and the fallrock's tag 1 cleared (both, as a walk that cut the rope writes them on the same frame) vs
// neither. Prints the open activators at boot and after a few idle ticks.
//   node CC/docs/cloud-reports/seedling-hammer-rock-holder-evidence/probe-model-l28.mjs
import { atlasLevelSource } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { createRunForStaging } from '../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { arrivalStaging } from '../../../../frontend/modules/seedlingDemo/fidelityArrival.js';
const SRC = atlasLevelSource();
for (const cleared of [[], [0, 1]]) {
    const run = createRunForStaging(arrivalStaging({ level: 28, x: 128, y: 288 }, { items: ['hasSword'], cleared }), SRC);
    const show = (when) => {
        const open = run.openActivators;
        console.log(JSON.stringify({ cleared, when, t: run.ticksCompleted, x: run.state.x, y: run.state.y,
            open: open ? [...open].sort() : open, rock: run.worldFor(28).fallRocks, activators: run.activatorsNow }));
    };
    show('boot');
    for (let i = 0; i < 120; i++) run.advance(new Set());
    show('after 120 idle ticks (the game opens the lock at t102)');
}
