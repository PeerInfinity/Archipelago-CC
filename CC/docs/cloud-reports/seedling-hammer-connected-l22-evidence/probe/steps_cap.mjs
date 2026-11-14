// hammer-connected-l22: the full-bot steps (sdc-connected-events' steps_full.mjs), with every solve request the JS
// runtime's worker service receives captured. Unlike hammer-connected-l6's hook, the tagging is REALM-AGNOSTIC
// (Object.prototype.toString, not instanceof), so source.records — a Map built in the runtime iframe — survives.
// CAP_FILTER = name regex to keep in full.
import full from './steps_full.mjs';
const KEEP = process.env.CAP_FILTER || 'js-runtime-L22-';
const install = { name: 'a1_capture_install', wait: 200, eval: `
const tagOf = (v) => Object.prototype.toString.call(v);
const cap = (request) => { const { levelSource, ...tape } = request ?? {};
  return JSON.parse(JSON.stringify(tape, function tag(k, v) {
    if (tagOf(v) === '[object Map]') return { __map: [...v] };
    if (tagOf(v) === '[object Set]') return { __set: [...v] };
    if (typeof v === 'number' && !Number.isFinite(v)) return { __num: String(v) };
    if (v === undefined && Array.isArray(this)) return { __undef: true };
    return v; })); };
const svc = rt.playback?.solveService ?? rt.solveService;
if (!svc) return { error: 'no solveService on the runtime' };
win.__cap = { all: [], keep: [], rt, cap };
const orig = svc.start.bind(svc);
svc.start = (req, opts) => {
  const h = orig(req, opts);
  const row = { n: win.__cap.all.length, name: req.name, goal: req.solverGoal, at: performance.now(), level: rt.run?.level, x: rt.run?.state?.x, y: rt.run?.state?.y };
  win.__cap.all.push(row);
  if (new RegExp(${JSON.stringify(KEEP)}).test(String(req.name))) win.__cap.keep.push({ ...row, request: cap(req), opts: cap(opts ?? {}), handle: h });
  return h;
};
return { installed: true, kind: svc.kind ?? null };` };
const collect = { name: 'h_capture_collect', wait: 200, eval: `
const c = win.__cap;
const sameRt = win.__seedlingJsRuntime === c.rt;
const inv = await (async () => { try { const s = sm.stateManagerProxySingleton.getLatestStateSnapshot(); return s?.inventory ?? null; } catch (e) { return String(e); } })();
return { sameRt, inventoryAtEnd: inv, all: c.all, keep: c.keep.map(({ handle, ...k }) => ({ ...k, result: handle?.result ? c.cap({ ok: handle.result.ok, kind: handle.result.kind, message: handle.result.message ?? handle.result.declined ?? null, work: handle.result.work ?? null }) : null, passes: handle?.passes ?? null })) };` };
const out = [];
for (const s of full) { if (s.name === 'g_full') out.push(install); out.push(s); if (s.name === 'g_full') out.push(collect); }
export default out.filter((s) => s.name !== 'f_goal');
