// v0-dump.mjs — dump the fixated state's persistent economy dims: every town-0
// pool's good/checked/total (is it exhausted?), pool-growth skills, and the
// repPer of each pool (which pools feed Haggle's reputation cap).
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
const P = IP.newPlanningState({ weights: { ...IP.DEFAULT_WEIGHTS }, multiTown: true });
ctx.sandbox.__b = resume;
ctx.ev("IdlePlanner._internals.plRestoreSave(__b.save)");
ctx.setRng(resume.rng ?? null);
IP.restorePlanningState(P, resume.planning ?? {});
ctx.ev("if (actions.next.length) restart()");

const st = sess.read(); const t = st.towns[0];
console.log("town-0 limited pools (good / checked / total  — exhausted = checked>=total):");
for (const v in t.limited) {
    const L = t.limited[v];
    console.log(`  ${v.padEnd(10)} good=${L.good}  checked=${L.checked}  total=${L.total}  ${L.checked >= L.total ? "EXHAUSTED" : `(${L.total - L.checked} unchecked)`}`);
}
console.log("\nskills that grow pools / matter:");
for (const s of ["Spatiomancy", "Survey", "Practical", "Thievery", "Combat", "Magic", "Charisma", "Alchemy"]) {
    if (st.skills[s]) console.log(`  ${s.padEnd(12)} level=${st.skills[s].level}`);
}
console.log(`\nMet progress level=${t.progress.Met?.level}  (Wander=${t.progress.Wander?.level})`);

// repPer per pool from the knowledge table (which pools feed Haggle repCapacity)
console.log("\nknowledge profiles (repPerExec / goldPerExec / ticksPerExec) for economy actions:");
for (const name of ["Long Quest", "Short Quest", "Meet People", "Smash Pots", "Pick Locks", "Haggle", "Buy Supplies", "Start Journey", "Buy Mana Z1"]) {
    const p = P.know.get(name);
    if (p) console.log(`  ${name.padEnd(14)} rep/exec=${(p.repPerExec ?? 0).toFixed(3)} gold/exec=${(p.goldPerExec ?? 0).toFixed(2)} ticks/exec=${(p.ticksPerExec ?? 0).toFixed(0)} manaCost=${(p.manaCost ?? 0).toFixed(0)}`);
    else console.log(`  ${name.padEnd(14)} (not in knowledge table)`);
}
// Start Journey mana cost + supplies requirement
const sj = st.actions.find(a => a.name === "Start Journey");
console.log(`\nStart Journey: cost=${sj?.cost} goldCost=${sj?.goldCost} gate=${JSON.stringify(sj?.gate)}`);
