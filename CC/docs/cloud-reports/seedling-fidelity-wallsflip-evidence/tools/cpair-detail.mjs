// CHOOSER_PAIR over arrival clocks on leg 853 (walls at its default, ON): which set the chooser admits, the kills, the refusal.
// usage: cpair-scan.mjs <from> <to> [size=3] [arm=on|off|both]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import('/home/user/Archipelago-CC/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { ANYTIME_PASSES, solveAnytime } = await import(M + 'jsRuntimeSolver.js');
const { CHOOSER_PAIR, CHOOSER_PAIR_COUNTS, resetChooserPairCounts, withChooserPair } = await import(M + 'solverBot.js');
const { withL40Flip } = await import(M + 'l40FlipSet.js');
const { CONTACT_FIDELITY } = await import(M + 'contactFidelity.js');
const row = JSON.parse(gunzipSync(readFileSync(M + 'fixtures/hammer-cpair/leg853-l40-request.json.gz')).toString('utf8'));
const [from, to, size = '3', arm = 'on'] = process.argv.slice(2);
CHOOSER_PAIR.size = Number(size);
const solve = (seam, on) => {
  const captured = row.requests[0].request;
  const req = restoreRequest({ ...captured, staging: { ...captured.staging, seam: { ...captured.staging.seam, time: seam } } });
  const { passes = ANYTIME_PASSES, source, ...tape } = req;
  resetChooserPairCounts();
  const a = withChooserPair(on, () => solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes: passes.slice(0, 1) }));
  const msg = a.ok ? null : String(a.message);
  const head = msg ? msg.split('\n')[0] : null;
  return { ok: a.ok, work: a.work, ticks: a.ok ? a.plan.solution.length : null, counts: JSON.parse(JSON.stringify(CHOOSER_PAIR_COUNTS)),
    chain: head ? head.replace(/: the combat ladder.*$/, '').slice(-150) : null,
    danger: head ? (head.match(/— (chaser:[^ ]+|[a-z]+:[^ ]+) \(/) ?? [])[1] ?? null : null,
    died: msg ? (msg.match(/the player died at t\d+ \([^)]*\)/) ?? [])[0] ?? null : null,
    silent: msg ? msg.includes("NO LIVE BODY's removal admits a corridor") : null,
    bait: msg ? (msg.match(/the danger on this corridor is \[[^\]]*\]/) ?? [])[0] ?? null : null,
    hasChaserSoldier: msg ? msg.includes('chaser:bobsoldier@880,832') : null, msg };
};
console.log('walls', CONTACT_FIDELITY.chaserSpinnerWalls, 'size', CHOOSER_PAIR.size);
withL40Flip(false, () => { for (let s = Number(from); s <= Number(to); s += 1) for (const on of arm === 'both' ? [false, true] : [arm === 'on']) {
  const r = solve(s, on); const { msg, ...rest } = r;
  console.log(JSON.stringify({ seam: s, on, ...rest })); console.log("MSG", String(msg).slice(0, 2600));
} });
