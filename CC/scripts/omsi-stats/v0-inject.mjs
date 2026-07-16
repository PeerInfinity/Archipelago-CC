// v0-inject.mjs — Targeted-v2 Phase V0, Approach B (injection isolation).
//
// From the K=4 fixated state (Start Journey unlocked but never executed), boost
// ONE persistent dim at a time, regenerate the Start Journey push candidates
// (heuristic buildPushes + targeted regressAction h-ladder), engine-confirm
// each, and report whether execCountOf(r,"Start Journey") flips > 0. The dim(s)
// that flip it = the BINDING persistent dim(s). Assumption-free: it enumerates
// EVERY town-0 limited pool + every skill + base-mana/talent controls, NOT just
// the goodLQuests the prior session assumed.
//
// Usage: node CC/scripts/omsi-stats/v0-inject.mjs [state.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../../../frontend/modules/omsi-loops");
const stateFile = process.argv[2] ?? path.join(here, "results/k4-fixated-state.json");

const { makeContext } = await import(pathToFileURL(path.join(srcDir, "test/harness.mjs")).href);
const ctx = makeContext(12345, ["planner-metadata.js", "planner.js"]);
ctx.sandbox.__rngGet = ctx.getRng;
ctx.sandbox.__rngSet = ctx.setRng;
ctx.ev("IdlePlanner.setRngHooks({ get: __rngGet, set: __rngSet })");
const IP = ctx.ev("IdlePlanner");

const resume = JSON.parse(fs.readFileSync(stateFile, "utf8"));
const weights = { ...IP.DEFAULT_WEIGHTS };

// Resume boot (mirror diagnose-round.mjs / runStandalone §10a.8).
const sess = ctx.ev("new IdlePlanner.Session()");
const P = IP.newPlanningState({ weights, screenK: 8, screenMode: "predictor", probeEvery: 1, seedFromPredictor: false, multiTown: true });
ctx.sandbox.__resumeBlob = resume;
ctx.ev("IdlePlanner._internals.plRestoreSave(__resumeBlob.save)");
ctx.setRng(resume.rng ?? null);
IP.restorePlanningState(P, resume.planning ?? {});
ctx.ev("if (actions.next.length) restart()");
P.pre = P.pre ?? sess.read();

// Persist the CLEAN fixated save so every injection starts from the same state.
const cleanSave = ctx.ev("IdlePlanner._internals.plSaveClone()");
const cleanRng = ctx.getRng();
const restoreClean = () => {
    ctx.sandbox.__clean = cleanSave;
    ctx.ev("IdlePlanner._internals.plRestoreSave(__clean)");
    ctx.setRng(cleanRng);
    ctx.ev("if (actions.next.length) restart()");
};

// Best Start-Journey outcome over ALL push candidates (heuristic + targeted)
// given the CURRENT live sim state. Returns {sj, towns, mana, supplies, hHi}.
function pushOutcome() {
    const pre = sess.read();
    const snap = sess.save();
    // heuristic push candidates (buildPushes, via generateCandidates)
    const gen = IP.generateCandidates(pre, P.know, P.thresholds, sess, P.lastCommitted,
        { multiTown: true, capacityHint: P.prevTimeNeeded });
    sess.restore(snap);
    // targeted push h-ladder (regressAction reads repCapacity from live good pools)
    const X = pre.actions.find(a => a.name === "Start Journey");
    let targeted = [];
    if (X) { targeted = IP.regressAction(pre, P.know, sess, X, { multiTown: true, capacityHint: P.prevTimeNeeded }); sess.restore(snap); }
    const cands = [...gen.filter(c => c.label.startsWith("push")), ...targeted];
    let best = { sj: 0, towns: "-", mana: 0, supplies: false, hHi: -1, label: null };
    for (const c of cands) {
        const conf = IP.confirmCandidate(sess, snap, c.q, P.know, true);
        sess.restore(snap);
        if (conf.degenerate) continue;
        const sj = IP._internals.execCountOf
            ? IP._internals.execCountOf(conf.r, "Start Journey")
            : (conf.r.lastExec ?? []).filter(e => e.name === "Start Journey").reduce((s, e) => s + (e.loops - e.loopsLeft), 0);
        const m = c.label.match(/h(\d+)/);
        const h = m ? Number(m[1]) : -1;
        if (sj > best.sj || (sj === best.sj && h > best.hHi)) {
            best = { sj, towns: conf.post.townsUnlocked.join(","), mana: conf.r.lastTimeNeeded,
                     supplies: (conf.r.lastResources ?? {}).supplies ?? false, hHi: h, label: c.label };
        }
    }
    return best;
}

// --- baseline (no injection) ---
restoreClean();
const base = pushOutcome();
const preState = sess.read();
console.log(`fixated state: loop ${P.loop ?? resume.planning?.loop}  townsUnlocked=[${preState.townsUnlocked.join(",")}]`);
console.log(`BASELINE push: SJ=${base.sj} towns=[${base.towns}] mana=${base.mana} supplies=${base.supplies} (${base.label} hHi=${base.hHi})\n`);

// --- enumerate injections ---
const town0 = preState.towns[0];
const limitedVars = Object.keys(town0.limited);
const skillNames = Object.keys(preState.skills).filter(s => (preState.skills[s].level ?? 0) > 0 || s === "Magic" || s === "Practical" || s === "Thievery");

const injections = [];
// each town-0 limited pool: max out good/total (raises repCapacity if rep-yielding)
for (const v of limitedVars) {
    const cur = town0.limited[v];
    injections.push({
        name: `pool:${v} good=200/total=200 (was good=${cur.good}/total=${cur.total})`,
        dim: `pool:${v}`,
        apply: () => ctx.ev(`towns[0].total${v}=200; towns[0].good${v}=200; towns[0].goodTemp${v}=200; towns[0].checked${v}=0; adjustAll();`),
    });
}
// each nonzero skill (+ a few economic ones): +100 levels
for (const s of skillNames) {
    const cur = preState.skills[s].level ?? 0;
    injections.push({
        name: `skill:${s} +100 (was ${cur})`,
        dim: `skill:${s}`,
        apply: () => ctx.ev(`skills[${JSON.stringify(s)}].levelExp.level = ${cur + 100}; adjustAll();`),
    });
}
// controls: raw base-mana budget, talent
injections.push({ name: `control: baseMana x3`, dim: "baseMana", apply: () => ctx.ev(`timeNeededInitial *= 3; adjustAll();`) });
injections.push({ name: `control: talentTotal +1e6`, dim: "talent", apply: () => ctx.ev(`totalTalent += 1e6; adjustAll();`) });

console.log(`testing ${injections.length} single-dim injections (${limitedVars.length} pools, ${skillNames.length} skills, 2 controls):\n`);
const flips = [];
for (const inj of injections) {
    restoreClean();
    inj.apply();
    const out = pushOutcome();
    const flip = out.sj > 0 && base.sj === 0;
    if (flip) flips.push({ ...inj, out });
    const mark = flip ? "  <== FLIPS" : (out.mana > base.mana + 500 ? "  (+budget)" : "");
    console.log(`  ${inj.name.padEnd(52)} SJ=${out.sj} towns=[${out.towns}] mana=${out.mana} supp=${out.supplies ? 1 : 0} h=${out.hHi}${mark}`);
}

console.log(`\n===== RESULT =====`);
if (flips.length === 0) {
    console.log(`NO single-dim injection makes the push achievable. Either the wall needs`);
    console.log(`MULTIPLE dims together, or a bigger boost — escalate (test combinations / larger boosts).`);
} else {
    console.log(`BINDING dim(s) — single-dim boosts that flip Start Journey to exec>0:`);
    for (const f of flips) console.log(`  ${f.dim}: SJ=${f.out.sj} towns=[${f.out.towns}] mana=${f.out.mana} (${f.out.label})`);
}
