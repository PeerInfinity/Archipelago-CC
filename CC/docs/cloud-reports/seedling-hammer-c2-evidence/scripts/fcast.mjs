// the two spinner forecasts vs the run, on the D1 witness (every press of the walk)
import { join } from 'node:path';
const MODULE = join(process.cwd(), 'frontend', 'modules', 'seedlingDemo');
const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { expandInputs } = await import(join(MODULE, 'tapeFormat.js')).catch(() => ({}));
const tape = loadTape(process.argv[2] ?? 'hammer-c2-l18-ghostspinner');
const S = stagingFromTape(tape);
const mk = () => createRunForStaging({ ...S, equips: [] }, atlasLevelSource());
// the walk's keys: replay once through the stepper
const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
const keys = []; { const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { keys[t] = h; } }); let r = st.next(); while (!r.done) r = st.next(); }
const held = keys.filter(Boolean);
const run = mk(); const pts = []; const bodies = [];
for (let t = 0; t < held.length; t += 1) { pts[t] = { x: run.state.x, y: run.state.y }; run.advance(held[t]);
  bodies[t] = (run.entities('spinnerBodies') ?? []).map((b) => ({ id: b.id, rect: b.rect, hits: b.hits, hitsTimer: b.hitsTimer, destroy: b.destroy })); }
const realLand = run.spinnerPressHits.filter((h) => h.landed).map((h) => `t${h.t} ${h.id} hits ${h.hits}`);
const out = { held: held.length, realLandings: realLand, presses: [] };
for (const p of run.slashPresses) {
  const r2 = mk(); for (let t = 0; t < p.t; t += 1) r2.advance(held[t]);
  const n = 40;
  const f = r2.spinnerForecastWithPress(n, { pressAt: p.t, direction: p.direction ?? 0, positions: (t) => pts[t] ?? pts.at(-1) });
  let firstDiff = null;
  for (let i = 0; i < f.bodies.length && p.t + i < bodies.length; i += 1) {
    const real = JSON.stringify(bodies[p.t + i].map((b) => [b.id, b.hits, b.hitsTimer, b.destroy, b.rect.x, b.rect.y]));
    const fc = JSON.stringify(f.bodies[i].map((b, k) => [b.id, b.hits, b.hitsTimer, b.destroy, f.rows[i][k].x, f.rows[i][k].y]));
    if (real !== fc) { firstDiff = { tick: p.t + i, real, fc }; break; }
  }
  out.presses.push({ t: p.t, outcome: p.outcome, fOutcome: f.outcome, landing: f.landing, why: f.why, tests: f.tests.length, firstDiff });
}
// the fight cursor, the whole walk, presses at the walk's own press ticks
{
  const r3 = mk(); const c = r3.spinnerFightForecast(); const pressAt = new Set(run.slashPresses.map((p) => p.t));
  let firstDiff = null;
  for (let t = 0; t < held.length; t += 1) {
    c.advance(pts[t], held[t].has('primary') ? { direction: run.slashPresses.find((p) => p.t === t)?.direction ?? 0 } : null);
    const i = t; const real = JSON.stringify(bodies[t].map((b) => [b.id, b.hits, b.hitsTimer, b.destroy, b.rect.x, b.rect.y]));
    const fc = JSON.stringify(c.bodies[i].map((b, k) => [b.id, b.hits, b.hitsTimer, b.destroy, c.rows[i][k].x, c.rows[i][k].y]));
    if (real !== fc && !firstDiff) firstDiff = { tick: t, real, fc };
  }
  out.fight = { landedTests: c.tests.filter((x) => x.landed).map((x) => `t${x.t} ${x.id} hits ${x.hits}`), tests: c.tests.length, firstDiff };
}
console.log(JSON.stringify(out, null, 1));
