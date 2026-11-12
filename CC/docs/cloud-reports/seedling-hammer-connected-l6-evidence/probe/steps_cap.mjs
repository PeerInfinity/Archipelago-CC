// hammer-connected-l6: the full-bot steps, with every solve request the JS runtime's worker service receives captured
// (seedlingSolveRequestCodec.captureRequest — the divergence sweep's own codec). CAP_FILTER = name regex to keep in full.
import full from './steps_full.mjs';
import offline from './steps_offline.mjs';
const KEEP = process.env.CAP_FILTER || 'js-runtime-L6-';
const install = { name: 'a1_capture_install', wait: 200, eval: `
const { captureRequest } = await import('/scripts/procgen/seedlingSolveRequestCodec.js');
const svc = rt.playback?.solveService ?? rt.solveService;
if (!svc) return { error: 'no solveService on the runtime' };
win.__cap = { all: [], keep: [], rt };
const orig = svc.start.bind(svc);
svc.start = (req, opts) => {
  const h = orig(req, opts);
  const row = { n: win.__cap.all.length, name: req.name, goal: req.solverGoal, at: performance.now(), level: rt.run?.level, x: rt.run?.state?.x, y: rt.run?.state?.y };
  win.__cap.all.push(row);
  if (new RegExp(${JSON.stringify(KEEP)}).test(String(req.name))) win.__cap.keep.push({ ...row, request: captureRequest(req), opts: captureRequest(opts ?? {}), handle: h });
  return h;
};
return { installed: true, kind: svc.kind ?? null };` };
const collect = { name: 'h_capture_collect', wait: 200, eval: `
const c = win.__cap;
const sameRt = win.__seedlingJsRuntime === c.rt;
const { captureRequest } = await import('/scripts/procgen/seedlingSolveRequestCodec.js');
return { sameRt, all: c.all, keep: c.keep.map(({ handle, ...k }) => ({ ...k, result: handle?.result ? captureRequest({ ok: handle.result.ok, kind: handle.result.kind, message: handle.result.message ?? handle.result.declined ?? null, work: handle.result.work ?? null }) : null, passes: handle?.passes ?? null })) };` };
const base = process.env.OFFLINE ? offline : full;
const out = [];
for (const s of base) { if (s.name === 'g_full') out.push(install); out.push(s); if (s.name === 'g_full') out.push(collect); }
export default out.filter((s) => s.name !== 'f_goal');
