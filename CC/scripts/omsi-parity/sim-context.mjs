// sim-context.mjs — headless Idle Loops sim boot for the parity harness.
//
// Boot recipe proven by NewDocs/plans/omsiloops/experiments/sim-boot.mjs
// (probe-harness → play-harness → planner-harness lineage): Node vm context,
// the exact 11-file importScripts list from predictor-worker.js, ~40 lines of
// stubs, story-function shims (they live in views/main.view.js, outside the
// sim files), seeded mulberry32 Math.random with an exposed consumption
// counter.
//
// Unlike the experiments' sim-boot, the snapshot here is EXACT (no float
// rounding): both engines run in one process from (initially) identical
// code, so the parity bar is byte equality, and a rounded snapshot would
// hide a sub-1e-6 perturbation (see --selftest-perturb).

import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";

// The exact importScripts list from predictor-worker.js (11 files).
export const SIM_FILES = ["data.js", "localization.js", "helpers.js", "actionList.js",
    "driver.js", "stats.js", "actions.js", "town.js", "prestige.js", "saving.js", "predictor.js"];

const noopProxy = () => new Proxy({}, { get: (t, p) => (p in t ? t[p] : () => {}) });

export function makeContext(root, seed = 12345) {
    const sandbox = {
        console: { log() {}, warn() {}, error() {}, debug() {}, info() {} },
        $: Object.assign(() => ({ length: 0, find: () => ({ text: () => "" }), each() {} }), { get() {}, param() {} }),
        setTimeout, clearTimeout, setInterval, clearInterval, performance,
        structuredClone: (o) => JSON.parse(JSON.stringify(o ?? null)),
        View: class { constructor() { return noopProxy(); } },
        ActionLog: class { constructor() { return noopProxy(); } },
        GoogleCloud: class { constructor() { return noopProxy(); } },
        HTMLInputElement: class {}, HTMLTextAreaElement: class {}, HTMLSelectElement: class {},
        HTMLElement: class {}, Element: class {}, Node: class {},
        Event: class { constructor(type) { this.type = type; } },
        // getElementById -> null is load-bearing: Town.finishRegular probes
        // searchToggler inputs with throwIfMissing=false on every limited-action
        // completion; a truthy stub would change search-toggle semantics.
        document: {
            title: "", getElementById: () => null, dispatchEvent: () => true,
            documentElement: { style: { setProperty() {}, getPropertyValue: () => "" }, classList: { toggle() {}, add() {}, remove() {} } },
        },
        requestAnimationFrame: () => 0,
        shiftDown: false, controlDown: false, altDown: false,
        localStorage: new (class {
            #m = new Map();
            getItem(k) { return this.#m.has(k) ? this.#m.get(k) : null; }
            setItem(k, v) { this.#m.set(k, String(v)); }
            removeItem(k) { this.#m.delete(k); }
        })(),
    };
    sandbox.self = sandbox; sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const f of SIM_FILES) {
        new vm.Script(fs.readFileSync(path.join(root, f), "utf8"), { filename: `${root}/${f}` })
            .runInContext(sandbox);
    }

    new vm.Script(`
        // Story functions live in views/main.view.js (not in the 11 sim files) but
        // action story()/finish() hooks call them; the data lives in saving.js.
        function setStoryFlag(name) { storyFlags[name] = true; }
        var unlockStory = setStoryFlag;
        function increaseStoryVarTo(name, value) { if (storyVars[name] < value) storyVars[name] = value; }
        function unlockGlobalStory(num) { if (num > storyMax) storyMax = num; }

        // Replace the whole "next" queue with [[name, loops], ...] entries.
        function __setQueue(entries) {
            actions.clearActions();
            for (const [name, loops] of entries) actions.addAction(name, loops);
        }
        // The queue as the engine actually ordered it (travel tail-pinning may
        // relocate entries relative to what __setQueue appended).
        function __getQueue() {
            return JSON.stringify(actions.next.map(a => [a.name, a.loops]));
        }

        // Compact town-0-and-unlocked state readout for the scripted policy
        // (applied per-engine — the policy must see only ITS OWN engine).
        function __policyState() {
            const actionsOut = [];
            for (const ti of townsUnlocked) {
                for (const a of towns[ti].totalActionList) {
                    let visible = false, unlocked = false;
                    try { visible = !!a.visible(); } catch (e) {}
                    try { unlocked = !!a.unlocked(); } catch (e) {}
                    const lim = a.type === "limited" ? {
                        good: towns[ti]["good" + a.varName] ?? 0,
                        checked: towns[ti]["checked" + a.varName] ?? 0,
                        total: towns[ti]["total" + a.varName] ?? 0,
                    } : null;
                    actionsOut.push({ name: a.name, townNum: a.townNum, type: a.type,
                        travelNum: getTravelNum(a.name), visible, unlocked, lim });
                }
            }
            return JSON.stringify({ loops: totals.loops, timeNeeded, actions: actionsOut });
        }

        // One driver iteration (the real executeGameTicks core, as proven
        // byte-equivalent to singleTick by the experiments). cap > 0 bounds the
        // mana spent this step so the lockstep comparison granularity is fixed.
        function __stepLoop(cap) {
            const startLoops = totals.loops;
            let manaAvailable = timeNeeded - timer;
            if (shouldRestart) manaAvailable = Math.min(manaAvailable, 1);
            if (cap > 0) manaAvailable = Math.min(manaAvailable, cap);
            const manaSpent = Mana.ceil(actions.tick(manaAvailable), timer / 1e15);
            timer += manaSpent;
            timeCounter += manaSpent / baseManaPerSecond;
            effectiveTime += manaSpent / baseManaPerSecond;
            refreshDungeons(manaSpent);
            let ended = false, endTimeNeeded = null;
            if (shouldRestart || timer >= timeNeeded) {
                ended = true;
                endTimeNeeded = timeNeeded;   // per-loop budget BEFORE restart resets it
                loopEnd(); prepareRestart();
            } else if (manaSpent === 0) {
                throw new Error("step driver stalled: 0 mana spent, no restart");
            }
            return JSON.stringify({ spent: manaSpent, ended, endTimeNeeded,
                loopBumped: totals.loops !== startLoops });
        }

        // EXACT full-state snapshot (no rounding — see file header).
        function __snapshotExact() {
            const townDump = towns.map(t => {
                const o = {};
                for (const v of t.allVarNames) {
                    for (const p of ["exp", "checked", "good", "goodTemp", "total"]) {
                        const k = p + v;
                        if (typeof t[k] === "number") o[k] = t[k];
                    }
                }
                o.suppliesCost = t.suppliesCost;
                o.hiddenVars = [...t.hiddenVars].sort();
                return o;
            });
            return JSON.stringify({
                timer, timeNeeded, curTown, effectiveTime, timeCounter,
                totals, resources, townsUnlocked, completedActions,
                totalTalent, goldInvested, stonesUsed,
                townDump,
                skillExp: Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, v.exp ?? 0])),
                statExp: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, [v.exp ?? 0, v.talentLevelExp?.exp ?? 0]])),
                buffAmts: Object.fromEntries(Object.entries(buffs).map(([k, v]) => [k, v.amt ?? 0])),
                current: actions.current.map(a => [a.name, a.loops, a.loopsLeft, a.manaUsed, a.ticks ?? null]),
                next: actions.next.map(a => [a.name, a.loops, !!a.disabled]),
                dungeons: dungeons.map(d => d.map(f => [f.ssChance, f.completed])),
                trials: trials.map(t => t.map(f => f.completed)),
                storyFlagsOn: Object.keys(storyFlags).filter(k => storyFlags[k]),
                storyVarsSet: Object.fromEntries(Object.entries(storyVars).filter(([, v]) => v >= 0)),
                storyMax,
            });
        }
    `, { filename: "parity-shims.js" }).runInContext(sandbox);

    const ev = (e) => vm.runInContext(e, sandbox);

    // Deterministic RNG: mulberry32, with an exposed consumption counter so the
    // snapshot can assert RNG-consumption parity too.
    const rng = { s: seed >>> 0, n: 0 };
    ev("Math").random = () => {
        rng.n++;
        rng.s = (rng.s + 0x6D2B79F5) >>> 0;
        let t = rng.s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    ev("loadDefaults()");
    ev("stonesUsed = {1:0, 3:0, 5:0, 6:0}");   // set in load(), not loadDefaults(); HaulZ* throw without it
    ev("if (!townsUnlocked.length) townsUnlocked = [0]");   // load() defaults this; loadDefaults() leaves []

    return {
        sandbox, ev,
        rngState: () => ({ s: rng.s, n: rng.n }),
        setQueue: (q) => sandbox.__setQueue(q),
        getQueue: () => sandbox.__getQueue(),
        policyState: () => JSON.parse(sandbox.__policyState()),
        step: (cap) => JSON.parse(sandbox.__stepLoop(cap)),
        restart: () => ev("restart()"),
        snapshot: () => sandbox.__snapshotExact() + `|rng:${rng.s}:${rng.n}`,
    };
}
