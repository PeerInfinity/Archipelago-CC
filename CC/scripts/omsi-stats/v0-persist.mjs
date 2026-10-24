// v0-persist.mjs — Phase V0 helper: which persistent dims does a candidate
// grind queue actually ACCUMULATE across a loop? (v2's premise is a dim built
// over MULTIPLE loops — so a grind only works if its target dim survives
// restart().) From the fixated state, run ONE loop of each candidate grind and
// print the delta in every persistent dim (pools / skills / talent / mana).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../../../frontend/modules/omsi-loops");
const stateFile = process.argv[2] ?? path.join(here, "results/k4-fixated-state.json");

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
const cleanSave = ctx.ev("IdlePlanner._internals.plSaveClone()");
const restoreClean = () => { ctx.sandbox.__c = cleanSave; ctx.ev("IdlePlanner._internals.plRestoreSave(__c)"); };

// flatten a read-state into a {dim: value} map of persistent dims
function flat(st) {
    const o = {};
    for (const s in st.skills) o[`skill:${s}`] = st.skills[s].level;
    const t = st.towns[0];
    for (const v in t.progress) o[`prog:${v}`] = t.progress[v].level;
    for (const v in t.limited) { o[`good:${v}`] = t.limited[v].good; o[`total:${v}`] = t.limited[v].total; o[`checked:${v}`] = t.limited[v].checked; }
    o["talent"] = st.talentTotal;
    return o;
}

restoreClean();
const before = flat(sess.read());

const grinds = [
    ["Meet People", [["Meet People", 200]]],
    ["Long Quest", [["Long Quest", 200]]],
    ["Short Quest", [["Short Quest", 200]]],
    ["Smash Pots", [["Smash Pots", 500]]],
    ["Pick Locks", [["Pick Locks", 200]]],
    ["Wander", [["Wander", 200]]],
];

for (const [label, q] of grinds) {
    restoreClean();
    sess.setQueue(q);
    sess.restart();
    let lr; try { lr = sess.runLoop(); } catch (e) { console.log(`${label}: runLoop threw ${e.message}`); continue; }
    const after = flat(sess.read());
    const deltas = Object.keys(after).filter(k => Math.abs((after[k] ?? 0) - (before[k] ?? 0)) > 1e-9)
        .map(k => `${k} ${before[k]}->${after[k]}`);
    const exec = (lr.lastExec ?? []).map(e => `${e.name}:${e.loops - e.loopsLeft}`).join(" ");
    console.log(`\n=== ${label} (ticks=${lr.ticks}, degenerate=${lr.degenerate ?? false}) ===`);
    console.log(`  exec: ${exec}`);
    console.log(`  persistent deltas: ${deltas.length ? deltas.join(" | ") : "(none — nothing persisted)"}`);
}
