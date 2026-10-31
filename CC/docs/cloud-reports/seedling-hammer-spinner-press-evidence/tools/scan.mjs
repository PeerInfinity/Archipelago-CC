import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { replayTape } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const SB = await import(R + 'frontend/modules/seedlingDemo/solverBot.js');
const PG = await import(R + 'frontend/modules/seedlingDemo/pressKillGuards.js');
const row = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const req = restoreRequest(row.request);
const { passes, source, ...tape } = req;
const ls = levelSourceFromAtlas(source.records);
const seen = {};
for (let n = 0; n <= 40; n += 8) for (let px = 790; px <= 850; px += 3) for (let py = 836; py <= 872; py += 3) {
  const staging = { ...tape.staging, boot: { ...tape.staging.boot, x: px - 8, y: py - 8 }, seam: { ...tape.staging.seam, time: 5950 } };
  let run;
  try { run = replayTape({ staging, perTick: [], levelSource: ls, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null }); for (let i = 0; i < n; i++) run.advance(new Set()); } catch { continue; }
  const b = (run.entities('spinnerBodies') ?? []).find((x) => x.id === 'spinner@816,848'); if (!b) continue;
  const dx = b.rect.x + 3.5 - run.state.x, dy = b.rect.y + 3.5 - run.state.y;
  const key = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  let r; try { r = PG.withPressEscapeShieldClaim(true, () => SB.pressEscape(run, { state: run.state, at: run.ticksCompleted, keys: [new Set([key])], pressAt: run.ticksCompleted + 1, id: 'spinner@816,848', caller: 'aim' })); } catch (e) { continue; }
  const cls = r.ok ? 'certified' : r.claim ? `claimed:${r.bound}` : /envelope/.test(r.why) ? 'envelope' : /does not land/.test(r.why) ? 'nolanding' : `noclaim:${(r.why.match(/PRESS_ESCAPE_SHIELD_CLAIM: ([a-z ]{0,30})/) ?? [])[1]}`;
  (seen[cls] ??= []).push(`${px},${py},${n},${key}`);
}
for (const [k, v] of Object.entries(seen)) console.log(k, v.length, v.slice(0, 6).join(' '));
