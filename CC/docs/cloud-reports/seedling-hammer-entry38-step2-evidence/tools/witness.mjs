// node witness.mjs — r8-solve-11 staging at L63 (144,104), spear+wand held; sword selected; solve reach-exit (0,96) with PGF off/on. Measurement only.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { parseTape } = await import(R + 'tapeFormat.js');
const { solveStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const { liveOf, replayTape, solveFromTape } = await import(R + 'jsRuntimeSolver.js');
const F = await import(R + 'pressGlideFollow.js');
const W = await import(R + 'walkBladeArm.js');
const G = await import(R + 'spearPressGateWait.js');
const { withContactFidelity } = await import(R + 'contactFidelity.js');
const levelSource = atlasLevelSource();
const fixture = () => {
  const tape = parseTape(JSON.parse(readFileSync(R + 'fixtures/tapes/r8-solve-11.json', 'utf8')));
  const staging = solveStaging(stagingFromTape(tape));
  staging.boot = { level: 63, x: Number(process.env.BX ?? 144), y: Number(process.env.BY ?? 104) };
  staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
  staging.seam = { ...staging.seam, items: { ...(staging.seam?.items ?? {}), hasSpear: true, hasWand: true } };
  return staging;
};
const perTick = [new Set()];
const equips = new Map([[0, Number(process.env.SLOT ?? 0)]]);
for (const on of [false, true]) {
  const r = withContactFidelity({ wandShotTrapBodies: true, wandShotEnemyBodies: true }, () => G.withSpearPressGateWait(true, () => W.withWalkBladeArm(process.env.WBA !== '0', () => F.withPressGlideFollow(on, () => {
    const staging = fixture();
    const run = replayTape({ staging, perTick, levelSource, equips, scratchPersistence: true });
    F.resetPressGlideFollowCounts();
    try {
      const out = solveFromTape({ staging, perTick, live: liveOf(run), levelSource, scratchPersistence: true, equips, solverGoal: { kind: 'reach-exit', exit: { x: 0, y: 96 } } });
      const ok = out?.ok ?? true;
      const replay = replayTape({ staging, perTick: [...perTick, ...out.solution], levelSource, equips: new Map([...equips, ...[...(out.equipsAt ?? [])].map(([t, s]) => [t + 1, s])]), scratchPersistence: true });
      return { ok, ticks: out.solution?.length, hits: (replay.ledger('playerHits') ?? []).map((h) => `${h.source}:${h.id}@${h.t}`), live: liveOf(replay).row, counts: structuredClone(F.PRESS_GLIDE_FOLLOW_COUNTS) };
    } catch (e) { return { error: String(e.message).slice(0, 400), counts: structuredClone(F.PRESS_GLIDE_FOLLOW_COUNTS) }; }
  }))));
  console.log(on ? 'ON ' : 'OFF', JSON.stringify(r));
}
