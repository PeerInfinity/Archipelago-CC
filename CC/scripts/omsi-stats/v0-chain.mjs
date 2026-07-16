// v0-chain.mjs — Phase V0, Approach C (the full prerequisite CHAIN + N).
//
// The escape needs a 2-step persistent chain, not one dim:
//   (1) grow Secrets (Investigate) -> totalLQuests = Secrets/2 grows -> unchecked
//       LQuests appear;
//   (2) grind Long Quest -> CHECK them -> goodLQuests grows -> reputation
//       capacity (goodLQuests x repPer) -> Haggle hMax -> cheaper supplies ->
//       the Start Journey push fits.
// This driver runs phase 1 (Investigate) until totalLQuests plateaus at a target,
// then phase 2 (Long Quest checking), committing each loop and re-confirming the
// push. Reports total N (setup loops) at which the push first becomes achievable.
//
// Usage: node v0-chain.mjs [secretsTarget] [maxLoops]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../../../frontend/modules/omsi-loops");
const secretsTarget = Number(process.argv[2] ?? 60);   // Secrets level to reach in phase 1
const maxLoops = Number(process.argv[3] ?? 80);
const stateFile = path.join(here, "results/k4-fixated-state.json");

const { makeContext } = await import(pathToFileURL(path.join(srcDir, "test/harness.mjs")).href);
const ctx = makeContext(12345, ["planner-metadata.js", "planner.js"]);
ctx.sandbox.__rngGet = ctx.getRng; ctx.sandbox.__rngSet = ctx.setRng;
ctx.ev("IdlePlanner.setRngHooks({ get: __rngGet, set: __rngSet })");
const IP = ctx.ev("IdlePlanner");
const resume = JSON.parse(fs.readFileSync(stateFile, "utf8"));
const sess = ctx.ev("new IdlePlanner.Session()");
const P = IP.newPlanningState({ weights: { ...IP.DEFAULT_WEIGHTS }, screenK: 8, screenMode: "predictor", probeEvery: 1, multiTown: true });
ctx.sandbox.__resumeBlob = resume;
ctx.ev("IdlePlanner._internals.plRestoreSave(__resumeBlob.save)");
ctx.setRng(resume.rng ?? null);
IP.restorePlanningState(P, resume.planning ?? {});
ctx.ev("if (actions.next.length) restart()");
const know = P.know;
let capHint = P.prevTimeNeeded ?? 20000;

function pushOutcome() {
    const pre = sess.read(); const snap = sess.save();
    const gen = IP.generateCandidates(pre, know, P.thresholds, sess, P.lastCommitted, { multiTown: true, capacityHint: capHint });
    sess.restore(snap);
    const X = pre.actions.find(a => a.name === "Start Journey");
    let targeted = [];
    if (X) { targeted = IP.regressAction(pre, know, sess, X, { multiTown: true, capacityHint: capHint }); sess.restore(snap); }
    let best = { sj: 0, towns: "-", mana: 0, hHi: -1 };
    for (const c of [...gen.filter(c => c.label.startsWith("push")), ...targeted]) {
        const conf = IP.confirmCandidate(sess, snap, c.q, know, true); sess.restore(snap);
        if (conf.degenerate) continue;
        const sj = (conf.r.lastExec ?? []).filter(e => e.name === "Start Journey").reduce((s, e) => s + (e.loops - e.loopsLeft), 0);
        const m = c.label.match(/h(\d+)/); const h = m ? Number(m[1]) : -1;
        if (sj > best.sj || (sj === best.sj && conf.r.lastTimeNeeded > best.mana)) best = { sj, towns: conf.post.townsUnlocked.join(","), mana: conf.r.lastTimeNeeded, hHi: h };
    }
    return best;
}
function dims() { const st = sess.read(), t = st.towns[0];
    return { Sec: t.progress.Secrets?.level ?? 0, gLQ: t.limited.LQuests?.good ?? 0, tLQ: t.limited.LQuests?.total ?? 0, cLQ: t.limited.LQuests?.checked ?? 0 }; }

// build an economy-prefixed grind for a named grinder (progress action or limited action)
function grindQueue(pre, name) {
    const X = pre.actions.find(a => a.name === name);
    if (!X) return null;
    const cands = IP.regressAction(pre, know, sess, X, { multiTown: true, capacityHint: capHint });
    if (!cands.length) return null;
    const fill = Math.max(1, Math.floor(0.7 * capHint / Math.max(1, know.get(name)?.ticksPerExec ?? X.cost ?? 300)));
    return [...cands[0].q.slice(0, -1), [name, fill]];
}

const d0 = dims(), p0 = pushOutcome();
console.log(`secretsTarget=${secretsTarget}\nL0  Sec=${d0.Sec} LQ good=${d0.gLQ}/tot=${d0.tLQ}(chk${d0.cLQ}) | PUSH sj=${p0.sj} mana=${p0.mana} h=${p0.hHi}\n`);

let escapedAt = -1, phase = 1;
for (let i = 1; i <= maxLoops; i++) {
    const pre = sess.read();
    const d = dims();
    // phase switch: once Secrets >= target, switch to Long Quest checking
    if (phase === 1 && d.Sec >= secretsTarget) { phase = 2; console.log(`  -- phase 2 (Long Quest checking) at L${i}, Secrets=${d.Sec} totalLQ=${d.tLQ} --`); }
    const name = phase === 1 ? "Investigate" : "Long Quest";
    const q = grindQueue(pre, name);
    if (!q) { console.log(`L${i}: cannot build ${name} grind — STOP`); break; }
    const snap = sess.save();
    const conf = IP.confirmCandidate(sess, snap, q, know, true);
    if (conf.degenerate) { console.log(`L${i}: ${name} loop degenerate — STOP`); sess.restore(snap); break; }
    sess.restore(conf.postSnap); capHint = conf.capacity ?? capHint;
    const gExec = (conf.r.lastExec ?? []).filter(e => e.name === name).reduce((s, e) => s + (e.loops - e.loopsLeft), 0);
    const dd = dims(), pu = pushOutcome();
    console.log(`L${i}[p${phase}] Sec=${dd.Sec} LQ good=${dd.gLQ}/tot=${dd.tLQ}(chk${dd.cLQ}) | ${name}x${gExec} cap=${Math.round(capHint)} | PUSH sj=${pu.sj} mana=${pu.mana} h=${pu.hHi}`);
    if (pu.sj > 0) { escapedAt = i; console.log(`\n>>> PUSH ACHIEVABLE at total setup loop N=${i} (Start Journey exec=${pu.sj}, towns=[${pu.towns}])`); break; }
}
if (escapedAt < 0) console.log(`\n>>> NOT achievable within ${maxLoops} setup loops`);
