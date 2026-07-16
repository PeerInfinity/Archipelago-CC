// v0-diff.mjs — Phase V0, Approach A (assumption-free state difference).
// Diff EVERY persistent dim between the K=1 escaping state (saved one loop
// before the L535 escape) and the K=4 fixated state. Dims materially different
// = candidates for what the escape "has" that the fixation "lacks". If the
// escaping state does NOT have more persistent economy capacity, the hole is
// about scorer TIMING, not persistence (v2-premise check).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../../../frontend/modules/omsi-loops");
const { makeContext } = await import(pathToFileURL(path.join(srcDir, "test/harness.mjs")).href);
const ctx = makeContext(12345, ["planner-metadata.js", "planner.js"]);
ctx.sandbox.__rngGet = ctx.getRng; ctx.sandbox.__rngSet = ctx.setRng;
ctx.ev("IdlePlanner.setRngHooks({ get: __rngGet, set: __rngSet })");
const IP = ctx.ev("IdlePlanner");
const sess = ctx.ev("new IdlePlanner.Session()");

function readState(file) {
    const b = JSON.parse(fs.readFileSync(path.join(here, file), "utf8"));
    ctx.sandbox.__b = b;
    ctx.ev("IdlePlanner._internals.plRestoreSave(__b.save)");
    ctx.setRng(b.rng ?? null);
    ctx.ev("if (actions.next.length) restart()");
    return { st: sess.read(), loop: b.planning?.loop };
}
function flat(st) {
    const o = {};
    for (const s in st.skills) o[`skill:${s}`] = st.skills[s].level;
    st.towns.forEach((t, ti) => {
        for (const v in t.progress) if (t.progress[v].level) o[`t${ti}.prog:${v}`] = t.progress[v].level;
        for (const v in t.limited) { const L = t.limited[v]; if (L.good || L.total) { o[`t${ti}.good:${v}`] = L.good; o[`t${ti}.chk:${v}`] = L.checked; o[`t${ti}.tot:${v}`] = L.total; } }
    });
    o["talent"] = Math.round(st.talentTotal);
    o["baseMana"] = st.baseMana;
    o["townsUnlocked"] = st.townsUnlocked.join("|");
    o["goldInvested"] = st.goldInvested;
    o["effectiveTime"] = Math.round(st.effectiveTime ?? 0);
    for (const b in st.buffs) if (st.buffs[b]) o[`buff:${b}`] = st.buffs[b];
    return o;
}

const A = readState("results/k1-preescape-state.json");  // escaping (K=1, L534)
const B = readState("results/k4-fixated-state.json");     // fixated (K=4, L800)
const fa = flat(A.st), fb = flat(B.st);
console.log(`ESCAPING (K=1) loop=${A.loop}  vs  FIXATED (K=4) loop=${B.loop}\n`);
const keys = [...new Set([...Object.keys(fa), ...Object.keys(fb)])].sort();
console.log("dim".padEnd(22), "ESCAPING".padStart(14), "FIXATED".padStart(14), "  note");
for (const k of keys) {
    const va = fa[k], vb = fb[k];
    if (va === vb) continue;
    let note = "";
    if (typeof va === "number" && typeof vb === "number") {
        if (va > vb) note = "<< escaping HIGHER";
        else note = "fixated higher";
    }
    console.log(k.padEnd(22), String(va ?? "-").padStart(14), String(vb ?? "-").padStart(14), "  " + note);
}
