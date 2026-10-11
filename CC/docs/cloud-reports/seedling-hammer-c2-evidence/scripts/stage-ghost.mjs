// C2 W0: r9-solve-18's / r8-solve-18's committed staging with seam.items.hasGhostSword = true, solved by twoPassSolve
import { join } from 'node:path';
const MODULE = join(process.cwd(), 'frontend', 'modules', 'seedlingDemo');
const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const argv = process.argv.slice(2);
const val = (f, d) => (argv.find((a) => a.startsWith(`--${f}=`))?.split('=')[1] ?? d);
const NAME = val('tape', 'r9-solve-18');
const GHOST = val('ghost', '1') === '1';
const SHIFT = Number(val('shift', '0'));
const STAGING = stagingFromTape(loadTape(NAME));
const items = { ...STAGING.seam.items, hasGhostSword: GHOST };
const seam = { ...STAGING.seam, items, time: STAGING.seam.time + SHIFT };
const TELEPORTER = { x: 176, y: 112 };
const makeRun = (persistence) => createRunForStaging({ ...STAGING, seam, persistence, equips: [] }, atlasLevelSource());
const t0 = Date.now();
let out;
try {
  const res = await twoPassSolve({ makeRun, goals: [{ kind: 'reach-exit', exit: TELEPORTER }], name: NAME,
    boot: STAGING.boot, persistence: STAGING.persistence.filter((c) => c.at === undefined),
    gameTick: async () => { throw new Error('no game oracle here'); } });
  const replay = makeRun(res.persistence);
  for (const h of res.out.perTick) replay.advance(h);
  const press = (res.out.records ?? []).filter((x) => x.arm === 'press');
  out = { verdict: 'SOLVED', ticks: res.out.perTick.length, hits: replay.playerHits.length,
    transitions: replay.transitions.map((x) => x.to_level), spinnerPressHits: replay.spinnerPressHits.filter((h) => h.landed),
    kills: replay.spinnerKills, presses: replay.presses.length,
    weapons: [...new Set(replay.presses.map((p) => p.weapon))], cycles: press.flatMap((p) => p.cycles ?? []).length };
} catch (e) {
  out = { verdict: 'REFUSED', code: e?.code ?? e?.name, msg: String(e?.message ?? e), obstacle: e?.trace?.obstacle ?? e?.obstacle ?? null,
    traceKeys: e?.trace ? Object.keys(e.trace) : null };
}
out.tape = NAME; out.ghost = GHOST; out.seconds = (Date.now() - t0) / 1000;
console.log(JSON.stringify(out, null, 1));
