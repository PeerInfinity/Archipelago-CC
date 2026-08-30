// v0-grind.mjs — Phase V0, Approach C (forced directed grind + get N).
//
// From the K=4 fixated state, FORCE N consecutive setup loops of a directed
// grind toward a candidate PERSISTENT dim (via the planner's own regressTarget /
// regressAction — an economy-prefixed committable queue, NOT a naive [act x N]),
// committing each loop's END state so the persistent dim accumulates across
// loops. After each setup loop, re-confirm the Start Journey push and record the
// trajectory. Reports the loop N at which the push first becomes achievable
// (execCountOf(r,"Start Journey") > 0) and which dims moved. Proves (or refutes)
// the v2 premise: a DIRECTED persistent grind escapes the fixation attractor.
//
// Usage: node v0-grind.mjs <grindSpec> [maxLoops] [state.json]
//   grindSpec: "progress:Met" | "skill:Practical" | "action:Long Quest" | "action:Meet People"
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../../../frontend/modules/omsi-loops");
const grindSpec = process.argv[2] ?? "progress:Met";
const maxLoops = Number(process.argv[3] ?? 60);
const stateFile = process.argv[4] ?? path.join(here, "results/k4-fixated-state.json");

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

// best Start-Journey push outcome given current live state (heuristic + targeted)
function pushOutcome() {
    const pre = sess.read();
    const snap = sess.save();
    const gen = IP.generateCandidates(pre, know, P.thresholds, sess, P.lastCommitted, { multiTown: true, capacityHint: capHint });
    sess.restore(snap);
    const X = pre.actions.find(a => a.name === "Start Journey");
    let targeted = [];
    if (X) { targeted = IP.regressAction(pre, know, sess, X, { multiTown: true, capacityHint: capHint }); sess.restore(snap); }
    let best = { sj: 0, towns: "-", mana: 0, hHi: -1 };
    for (const c of [...gen.filter(c => c.label.startsWith("push")), ...targeted]) {
        const conf = IP.confirmCandidate(sess, snap, c.q, know, true);
        sess.restore(snap);
        if (conf.degenerate) continue;
        const sj = (conf.r.lastExec ?? []).filter(e => e.name === "Start Journey").reduce((s, e) => s + (e.loops - e.loopsLeft), 0);
        const m = c.label.match(/h(\d+)/); const h = m ? Number(m[1]) : -1;
        if (sj > best.sj || (sj === best.sj && conf.r.lastTimeNeeded > best.mana)) best = { sj, towns: conf.post.townsUnlocked.join(","), mana: conf.r.lastTimeNeeded, hHi: h };
    }
    return best;
}

// build the grind queue for one setup loop from the current state
function buildGrind(pre) {
    if (grindSpec.startsWith("action:")) {
        const name = grindSpec.slice(7);
        // economy-prefixed grind toward making NAME run many times: regressTarget
        // with a synthetic progress/skill won't target an arbitrary limited action,
        // so use regressAction to get the economy scaffold then fill NAME.
        const X = pre.actions.find(a => a.name === name);
        if (!X) return null;
        const cands = IP.regressAction(pre, know, sess, X, { multiTown: true, capacityHint: capHint });
        if (!cands.length) return null;
        // fill: replace terminal x1 with a big count (pool/allowed capped inside engine)
        const c = cands[0];
        const fill = Math.max(1, Math.floor(0.6 * capHint / Math.max(1, know.get(name)?.ticksPerExec ?? X.cost ?? 300)));
        return { label: `grind:${name}`, q: [...c.q.slice(0, -1), [name, fill]] };
    }
    const [type, name] = grindSpec.split(":");
    const goal = { kind: "b", target: { type, name, town: 0 } };
    const cands = IP.regressTarget(pre, know, sess, goal, { multiTown: true, capacityHint: capHint, fillShare: 0.6 });
    return cands.length ? cands[0] : null;
}

function dims() {
    const st = sess.read(); const t = st.towns[0];
    return {
        Sec: t.progress.Secrets?.level ?? 0, Met: t.progress.Met?.level ?? 0,
        goodLQ: t.limited.LQuests?.good ?? 0, totLQ: t.limited.LQuests?.total ?? 0, chkLQ: t.limited.LQuests?.checked ?? 0,
        goodSQ: t.limited.SQuests?.good ?? 0, totSQ: t.limited.SQuests?.total ?? 0,
    };
}

console.log(`grind: ${grindSpec}   maxLoops: ${maxLoops}\n`);
const d0 = dims(); const p0 = pushOutcome();
console.log(`L0 (start)  Sec=${d0.Sec} Met=${d0.Met} LQ=${d0.goodLQ}/${d0.totLQ}(chk${d0.chkLQ}) SQ=${d0.goodSQ}/${d0.totSQ} | PUSH sj=${p0.sj} mana=${p0.mana} h=${p0.hHi}`);

let escapedAt = -1;
for (let i = 1; i <= maxLoops; i++) {
    const pre = sess.read();
    const g = buildGrind(pre);
    if (!g) { console.log(`L${i}: no grind queue could be built (grindSpec unreachable) — STOP`); break; }
    const snap = sess.save();
    const conf = IP.confirmCandidate(sess, snap, g.q, know, true);
    if (conf.degenerate) { console.log(`L${i}: grind loop degenerate — STOP`); sess.restore(snap); break; }
    // COMMIT the grind loop's end state (persist the dim)
    sess.restore(conf.postSnap);
    capHint = conf.capacity ?? capHint;
    const gExec = (conf.r.lastExec ?? []).filter(e => e.name === g.q[g.q.length - 1][0]).reduce((s, e) => s + (e.loops - e.loopsLeft), 0);
    const d = dims(); const pu = pushOutcome();
    console.log(`L${i}  Sec=${d.Sec} Met=${d.Met} LQ=${d.goodLQ}/${d.totLQ}(chk${d.chkLQ}) SQ=${d.goodSQ}/${d.totSQ} | grind ${g.q[g.q.length-1][0]}x${gExec} cap=${Math.round(capHint)} | PUSH sj=${pu.sj} mana=${pu.mana} h=${pu.hHi}`);
    if (pu.sj > 0) { escapedAt = i; console.log(`\n>>> PUSH ACHIEVABLE at setup loop N=${i} (Start Journey exec=${pu.sj}, towns=[${pu.towns}])`); break; }
}
if (escapedAt < 0) console.log(`\n>>> NOT achievable within ${maxLoops} setup loops of "${grindSpec}"`);
