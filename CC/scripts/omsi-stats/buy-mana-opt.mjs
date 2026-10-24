// omsi-stats L0 — BUY MANA / zone-1 ECONOMY OPTIMISER (user-defined scope
// 2026-07-13). HARNESS PROTOTYPE, NO fork changes.
//
// This is NOT a general-purpose queue rearranger. It optimises the zone-1
// (town 0) mana<->gold economy — mana generators (Smash Pots), gold
// generators (Pick Locks), the Buy Mana converter, and any downstream
// gold-costing purchases — via these capabilities (user rulings):
//   * REORDER so gold accumulates into large batches before each conversion;
//   * REMOVE Buy Mana actions that are unnecessary (thin/redundant conversions);
//   * SPLIT a harvest entry and INSERT an intermediate conversion when the loop
//     budget would otherwise starve the harvest;
//   * MERGE entries that are split unnecessarily (tidy the output);
//   * RESERVE gold for later gold-costing actions (a purchase that can't afford
//     its gold is a throughput failure, so the tool keeps its gold and converts
//     only the excess — in practice: converter after the purchase).
//
// Buy Mana Z1 mechanics: finish() = addMana(gold*rate); resetResource(gold) —
// converts ALL gold at once at a LINEAR rate (~50), extends the current loop
// budget, costs 100 mana/exec. Batching doesn't raise yield, it saves the
// 100-mana overhead; a conversion is worth its overhead only above ~2 gold.
//
// Objective (mana units), minimised lexicographically:
//   (1) unmet reps of VALUED actions (mana gen, gold gen, gold-costing
//       purchases) — throughput. Keeps a mid-harvest conversion when removing
//       it starves the harvest; keeps a purchase funded (reserves its gold).
//   (2) unconvertedGold*rate + buyManaExecs*100 — realises all worthwhile gold,
//       uses the FEWEST conversions, drops thin (<=2 gold) ones.
//
// This phase decides feasibility (STOP + report if local moves can't reach the
// economical optimum).  Usage: node CC/scripts/omsi-stats/buy-mana-opt.mjs [--verbose]

import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const submoduleDir = path.join(repoRoot, "frontend/modules/omsi-loops");
const verbose = process.argv.includes("--verbose");

const BUY_MANA = "Buy Mana Z1";
const BUY_MANA_COST = 100; // Buy Mana Z1 manaCost() — constant per-exec overhead

// economy classification. L1 derives these from the planner knowledge table:
// converter = manaPerGold>0, goldGen = goldPer>0, manaGen = manaPer>ticks,
// purchase = goldCost>0 & consumes gold.
function classify(meta, name) {
    if (meta.converter.has(name)) return "converter";
    if (meta.goldGen.has(name)) return "goldGen";
    if (meta.manaGen.has(name)) return "manaGen";
    if (meta.purchase.has(name)) return "purchase";
    return "other";
}
const isValued = (k) => k === "manaGen" || k === "goldGen" || k === "purchase";

// readout from one engine-rollout record `r`.
function readout(r, meta) {
    const exec = r.lastExec ?? [];
    let failed = 0, convExecs = 0;
    for (const e of exec) {
        const kind = classify(meta, e.name);
        if (isValued(kind)) failed += Math.max(0, e.loopsLeft);
        else if (kind === "converter") convExecs += e.loops - e.loopsLeft;
    }
    const unconvGold = Math.max(0, r.lastResources?.gold ?? 0);
    const econ = unconvGold * meta.rate + convExecs * BUY_MANA_COST;
    return { failed, convExecs, unconvGold, econ, ticks: r.ticks };
}
function key(w) { return [w.failed, w.econ]; }
function lexCmp(a, b) {
    const ka = key(a), kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return 0;
}

// merge consecutive identical entries (tidy "unnecessarily split" harvests).
// Rollout-neutral — pure normalisation of the output.
function coalesce(q) {
    const out = [];
    for (const [n, l] of q) {
        const last = out[out.length - 1];
        if (last && last[0] === n) last[1] += l; else out.push([n, l]);
    }
    return out;
}

// ---- move generators ------------------------------------------------------
function moveOne(q, from, to) {
    const c = q.map((e) => e.slice());
    const [e] = c.splice(from, 1);
    c.splice(to > from ? to - 1 : to, 0, e);
    return c;
}
function* neighbours(q, meta) {
    const n = q.length;
    // reorder: move-one insertion
    for (let i = 0; i < n; i++)
        for (let j = 0; j <= n; j++) {
            if (j === i || j === i + 1) continue;
            yield { desc: `move ${i}->${j}`, q: moveOne(q, i, j) };
        }
    // reorder: adjacent swap
    for (let i = 0; i + 1 < n; i++) {
        const c = q.map((e) => e.slice()); [c[i], c[i + 1]] = [c[i + 1], c[i]];
        yield { desc: `swap ${i},${i + 1}`, q: c };
    }
    // remove one converter rep (drop entry at 0)
    for (let i = 0; i < n; i++) {
        if (classify(meta, q[i][0]) !== "converter") continue;
        const c = q.map((e) => e.slice());
        if (c[i][1] > 1) c[i][1] -= 1; else c.splice(i, 1);
        yield { desc: `drop 1 Buy Mana @${i}`, q: c };
    }
    // insert a converter at a boundary (add a conversion between entries)
    for (let j = 0; j <= n; j++) {
        const c = q.map((e) => e.slice());
        c.splice(j, 0, [BUY_MANA, 1]);
        yield { desc: `insert Buy Mana @${j}`, q: c };
    }
    // SPLIT a harvest entry and INSERT a conversion at the split point
    for (let i = 0; i < n; i++) {
        if (classify(meta, q[i][0]) !== "goldGen" && classify(meta, q[i][0]) !== "manaGen") continue;
        const [name, loops] = q[i];
        for (let k = 1; k < loops; k++) {
            const c = q.map((e) => e.slice());
            c.splice(i, 1, [name, k], [BUY_MANA, 1], [name, loops - k]);
            yield { desc: `split ${name} ${k}|${loops - k} + Buy Mana`, q: c };
        }
    }
}

// best-improvement hill climb with the engine rollout as oracle. Deterministic
// (lexicographically-min neighbour; ties broken by generation order). Output is
// coalesced (merge normalisation).
function optimise(rollout, q0, meta, opts = {}) {
    const trace = [];
    let cur = coalesce(q0.map((e) => e.slice()));
    let curW = readout(rollout(cur), meta);
    let moves = 0, evals = 1;
    for (;;) {
        let best = null, bestW = curW, bestMove = null;
        for (const nb of neighbours(cur, meta)) {
            evals++;
            const w = readout(rollout(nb.q), meta);
            if (lexCmp(w, bestW) < 0) { best = nb.q; bestW = w; bestMove = nb.desc; }
        }
        if (!best) break;
        cur = coalesce(best); curW = readout(rollout(cur), meta);
        trace.push({ move: bestMove, to: key(curW) });
        moves++;
        if (opts.maxMoves && moves >= opts.maxMoves) break;
    }
    return { queue: cur, waste: curW, moves, evals, trace };
}

// ===========================================================================
// FIXTURES
// ===========================================================================
const nBuyMana = (q) => q.filter(([n]) => n === BUY_MANA).reduce((s, [, l]) => s + l, 0);
const fmt = (q) => q.map(([n, l]) => `${n}x${l}`).join(" | ");
const wfmt = (w) => `failed=${w.failed} buyMana=${w.convExecs} gold=${w.unconvGold} econ=${w.econ}`;

async function main() {
    let forkCommit;
    try { forkCommit = execFileSync("git", ["-C", submoduleDir, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); }
    catch { forkCommit = "?"; }
    console.log(`fork: ${forkCommit}+worktree(proto)\n`);

    const { makeContext } = await import(pathToFileURL(path.join(submoduleDir, "test/harness.mjs")).href);
    const ctx = makeContext(12345, ["planner-metadata.js", "planner.js"]);
    ctx.sandbox.__rngGet = ctx.getRng; ctx.sandbox.__rngSet = ctx.setRng;
    ctx.ev("IdlePlanner.setRngHooks({ get: __rngGet, set: __rngSet })");

    const setState = (pots, locks) => ctx.ev(`
        actions.clearActions(); actions.addAction("Wander", 1); restart();
        towns[0].expWander = getExpOfLevel(30);
        towns[0].totalPots = ${pots}; towns[0].checkedPots = ${pots};
        towns[0].goodPots = ${pots}; towns[0].goodTempPots = ${pots};
        towns[0].totalLocks = ${locks}; towns[0].checkedLocks = ${locks};
        towns[0].goodLocks = ${locks}; towns[0].goodTempLocks = ${locks};
        adjustAll(); restart();
    `);
    const rate = ctx.ev(`getActionPrototype("Buy Mana Z1").goldCost()`);
    console.log(`conversion rate = ${rate} mana/gold, overhead = ${BUY_MANA_COST}/exec (keep a conversion only above ${BUY_MANA_COST / rate} gold)\n`);

    const sess = ctx.ev("new IdlePlanner.Session()");
    const meta = {
        manaGen: new Set(["Smash Pots"]), goldGen: new Set(["Pick Locks"]),
        converter: new Set([BUY_MANA]), purchase: new Set(["Buy Glasses"]), rate,
    };
    const mkRollout = () => { const snap = sess.save(); return (q) => { sess.restore(snap); sess.setQueue(q); sess.restart(); return sess.runLoop(); }; };

    // ample-budget scenarios (100 Smash) — one conversion suffices
    setState(100, 5); ctx.ev("restart()");
    const rollout = mkRollout();
    // tight-budget scenario (22 Smash) — mid-harvest conversion load-bearing
    setState(22, 6); ctx.ev("restart()");
    const rolloutTight = mkRollout();

    const cases = [
        { r: rollout, name: "REMOVE — 3 Buy Manas, 2 redundant", expBuyMana: 1, q: [
            [BUY_MANA, 1], ["Smash Pots", 100], ["Pick Locks", 5], [BUY_MANA, 1], [BUY_MANA, 1] ] },
        { r: rollout, name: "REORDER — converter before income", expBuyMana: 1, q: [
            [BUY_MANA, 1], ["Smash Pots", 100], ["Pick Locks", 5] ] },
        { r: rollout, name: "MERGE — unnecessarily split harvest", expBuyMana: 1, q: [
            ["Smash Pots", 100], ["Pick Locks", 2], ["Pick Locks", 3], [BUY_MANA, 1] ] },
        { r: rollout, name: "RESERVE GOLD — purchase after converter", expBuyMana: 1, expPurchase: true, q: [
            ["Smash Pots", 100], ["Pick Locks", 5], [BUY_MANA, 1], ["Buy Glasses", 1] ] },
        { r: rolloutTight, name: "SPLIT+INSERT — one harvest block starves", expBuyMana: 2, q: [
            ["Smash Pots", 22], ["Pick Locks", 6], [BUY_MANA, 1] ] },
        { r: rolloutTight, name: "SPLIT+INSERT+REMOVE — keep load-bearing, drop redundant", expBuyMana: 2, q: [
            ["Smash Pots", 22], ["Pick Locks", 3], [BUY_MANA, 1], [BUY_MANA, 1], ["Pick Locks", 3], [BUY_MANA, 1] ] },
    ];

    let allPass = true;
    for (const c of cases) {
        const startW = readout(c.r(c.q), meta);
        const res = optimise(c.r, c.q, meta, { maxMoves: 30 });
        // purchase success check (for RESERVE GOLD): Buy Glasses must run
        const buyGlassesOk = c.expPurchase
            ? (res.r ?? c.r)(res.queue).lastExec.some((e) => e.name === "Buy Glasses" && e.loops - e.loopsLeft > 0)
            : true;
        const pass = res.waste.failed === 0 && res.waste.unconvGold === 0
            && res.waste.convExecs === c.expBuyMana && buyGlassesOk
            && lexCmp(res.waste, startW) <= 0;
        allPass &&= pass;
        console.log(`[${pass ? "PASS" : "FAIL"}] ${c.name}`);
        console.log(`   start:  ${fmt(c.q)}   (${nBuyMana(c.q)} Buy Mana queued)`);
        console.log(`           ${wfmt(startW)}`);
        console.log(`   result: ${fmt(res.queue)}   (${nBuyMana(res.queue)} Buy Mana queued)`);
        console.log(`           ${wfmt(res.waste)}   (${res.moves} moves, ${res.evals} rollouts)`);
        if (verbose) for (const t of res.trace) console.log(`             · ${t.move} -> [${t.to}]`);
        console.log(`   expect ${c.expBuyMana} Buy Mana exec${c.expPurchase ? " + Buy Glasses runs" : ""}; got ${res.waste.convExecs}${c.expPurchase ? ` / glasses ${buyGlassesOk}` : ""}\n`);
    }

    console.log(`=== L0 FEASIBILITY: ${allPass ? "PASS — economy optimiser reaches the optimum via local moves" : "FAIL"} ===`);
    process.exit(allPass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
