// Every ordinary rock with a flame stance (the RAW map) x every enemy body in its room: the guard's three terms.
import { PLAYTHROUGH_MAP, playthroughGridFor, playthroughRockFireSides } from '../../../../../scripts/procgen/make-seedling-playthrough-rules.mjs';
import * as HP from '../../../../../scripts/procgen/seedlingHolderParking.js';
import { combatCensusOf } from '../../../../../frontend/modules/seedlingDemo/levelWorld.js';
import { rockCorridor, chaserGuardVerdict } from '../../../../../scripts/procgen/seedlingFireChaserGuard.js';
const sides = playthroughRockFireSides();
for (const [key, r0] of sides) {
  // a guarded rock is evaluated on its folded entry (rock + sides; its stances are gone); a holder-folded one is skipped
  if (r0.stances.length === 0 && !r0.guarded) { console.log(key, 'no stances (', r0.narrowed ? 'holder-narrowed' : 'none', r0.guarded ? 'guarded' : '', ')'); continue; }
  const level = PLAYTHROUGH_MAP.levels.find((l) => l.level === r0.level);
  const grid = playthroughGridFor(level);
  const tileTypes = HP.tileTypesOf(level, grid.width);
  const corridor = rockCorridor(r0, grid);
  for (const b of combatCensusOf(level).enemies) {
    const v = chaserGuardVerdict(b, r0, { grid, tileTypes, corridor });
    console.log(key, 'corridor', corridor.size, '|', v.body, `speed ${v.speed} vs ${v.walkSpeed}`, `runRange ${v.runRange} ${v.aggroKind}`, `region ${v.regionCells}`, `dist ${v.distance.toFixed(1)}`, `lethalBorder ${v.lethalBorder.length}`, `a=${v.terms.a} b=${v.terms.b} c=${v.terms.c}`, v.blocks ? 'BLOCKS' : '');
  }
}
