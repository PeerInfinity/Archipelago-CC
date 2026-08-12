#!/usr/bin/env node
/**
 * sweep-seedling-killlock — THE SPINNER + KILL-LOCK SWEEP, as an instrument
 * that outlives its slice.
 *
 * Seedling PROCGEN PoC arc, slice 4b (kickoff §4.4b). ⚖ Orchestrator ruling
 * condition 4, 2026-08-12, and the reason is a measured one: slice 4's own
 * 32-cell sweep (§12.3) lived in a scratchpad and was gone by the time 4b
 * needed to compare against it. The rebuild reproduced the DECISIVE case
 * verbatim — *"spinner@48,16's removal at tick 517 … the durable clear at
 * tick 618"* — but its totals differ from §12.3's published "26 of the 32
 * threw", and that gap cannot be closed against a script that does not
 * exist. **An instrument whose numbers are quoted must be committed.**
 *
 * ── WHAT IT MEASURES ──────────────────────────────────────────────────
 *
 * One room shape, one swept variable. A Stone wall across the whole interior
 * with ONE gap, a kill lock (`tset:'-1'`) standing in that gap, and the goal
 * strictly beyond it — §11.7's geometry, the only one where a candidate is
 * unambiguously the room's door. The swept variable is the SPINNER's cell:
 * every interior cell on the START side.
 *
 * Every cell is CLASSIFIED and no class is folded into another:
 *
 *   SOLVED                  the oracle certified the collect
 *   REFUSED / BUDGET_*      an oracle verdict — a fact about the CANDIDATE
 *   THREW:undeclared-clear  the kill-lock clear nobody declared (slice 4's
 *                           driven case; ⛔ decided by the STRUCTURED field
 *                           `err.undeclaredKillLock`, never by matching the
 *                           sentence — trap 143 from the other side)
 *   THREW:transit           the hammer-disc transit refusal, a SolverBotError
 *   THREW:<name>            anything else, printed whole
 *
 * ⛔ THE THROW CLASSES ARE THE POINT, not the totals. `procgenOracle`
 * classifies only `SolverRefusal` and `BotDriverV2Error`, so everything in
 * the THREW rows reaches `levelGenerator` as `GenerationAborted` and kills
 * the RUN rather than the candidate (§12.3's own residue 2). A family whose
 * failure mode is an ABORT cannot be in a palette, and this sweep is how that
 * is measured rather than assumed.
 *
 * ── BOUNDS, NAMED ─────────────────────────────────────────────────────
 *
 * One goal cell, one wall row, one gap column, one lock tag, one budget
 * (`DEFAULT_BUDGET`), one boot (post-sword). Every one is a flag below and
 * every one is printed in the header, because a sweep that does not say what
 * it bounded reads as a sweep over everything.
 *
 * ⚠ THE CLOCK IS REAL HERE, unlike the module test's. A `BUDGET_EXHAUSTED`
 * row is therefore partly about this machine — which is what §8.3's post-hoc
 * wall clock means — and it is a distinct class for exactly that reason.
 *
 * Usage:
 *   node scripts/procgen/sweep-seedling-killlock.mjs
 *   node scripts/procgen/sweep-seedling-killlock.mjs --no-scratch   (the parent)
 *   node scripts/procgen/sweep-seedling-killlock.mjs --lock-tag=0   (the tag
 *                       collision: a clear is a FLAG, so tag 0 takes the goal)
 */

import {
    bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain,
} from '../../frontend/modules/seedlingDemo/procgenLevel.js';
import {
    DEFAULT_BUDGET, bootStaging, collectGoal, solve,
} from '../../frontend/modules/seedlingDemo/procgenOracle.js';
import { POST_SWORD_ITEMS } from '../../frontend/modules/seedlingDemo/procgenPalette.js';
import { SEEDLING_DEFAULTS } from '../../frontend/modules/seedlingDemo/procgenSeedling.js';

const flag = (name, fallback) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? fallback : hit.slice(name.length + 3);
};

const BOUNDS = Object.freeze({
    wallTy: Number(flag('wall-ty', 5)),
    gapTx: Number(flag('gap-tx', 5)),
    lockTag: String(flag('lock-tag', '1')),
    goal: Object.freeze({ tx: Number(flag('goal-tx', 7)), ty: Number(flag('goal-ty', 8)) }),
    scratch: !process.argv.includes('--no-scratch'),
});

const START = SEEDLING_DEFAULTS.start;
const INTERIOR = Object.freeze({ from: 1, to: SEEDLING_DEFAULTS.width - 2 });

function roomWithSpinnerAt(tx, ty) {
    let record = emptyLevel({ level: SEEDLING_DEFAULTS.level });
    const wall = [];
    for (let x = INTERIOR.from; x <= INTERIOR.to; x += 1) {
        if (x !== BOUNDS.gapTx) wall.push({ tx: x, ty: BOUNDS.wallTy, terrain: 'wall' });
    }
    record = withTerrain(record, wall);
    return withEntities(record, [
        {
            type: SEEDLING_DEFAULTS.goalClass,
            ...oelAtTile(BOUNDS.goal.tx, BOUNDS.goal.ty),
            attrs: { tag: SEEDLING_DEFAULTS.goalTag },
        },
        {
            type: 'lock',
            ...oelAtTile(BOUNDS.gapTx, BOUNDS.wallTy),
            attrs: { tset: '-1', tag: BOUNDS.lockTag },
        },
        { type: 'spinner', ...oelAtTile(tx, ty), attrs: { tag: '-1' } },
    ]);
}

function attemptAt(tx, ty) {
    const record = roomWithSpinnerAt(tx, ty);
    const staging = bootStaging({
        boot: bootAtTile(record, START.tx, START.ty),
        items: POST_SWORD_ITEMS,
        pins: ['dead_frames'],
    });
    const goal = collectGoal(BOUNDS.goal.tx * 16, BOUNDS.goal.ty * 16);
    try {
        const out = solve(record, staging, [goal], DEFAULT_BUDGET, {
            name: `killlock-sweep-${tx}-${ty}`,
            scratchPersistence: BOUNDS.scratch,
        });
        const strategies = new Set((out.records ?? []).map((r) => r.strategy).filter(Boolean));
        return {
            cls: out.verdict,
            ticks: out.ticks ?? null,
            strategies: [...strategies],
            scratchClears: out.scratchClears ?? [],
            reason: out.reasonText ?? null,
        };
    } catch (e) {
        let cls = `THREW:${e.name}`;
        if (e.undeclaredKillLock) cls = 'THREW:undeclared-clear';
        else if (e.name === 'SolverBotError' && /hammer disc/.test(e.message)) cls = 'THREW:transit';
        return { cls, ticks: null, strategies: [], scratchClears: [], reason: e.message };
    }
}

const rows = [];
for (let ty = INTERIOR.from; ty < BOUNDS.wallTy; ty += 1) {
    for (let tx = INTERIOR.from; tx <= INTERIOR.to; tx += 1) {
        rows.push({ tx, ty, ...attemptAt(tx, ty) });
    }
}

console.log('# spinner + kill-lock sweep');
console.log(`# BOUNDS  wall ty=${BOUNDS.wallTy} · gap tx=${BOUNDS.gapTx} · lock tag=`
    + `${BOUNDS.lockTag} (goal tag ${SEEDLING_DEFAULTS.goalTag}) · goal `
    + `(${BOUNDS.goal.tx},${BOUNDS.goal.ty}) · start (${START.tx},${START.ty}) · boot `
    + `post-sword · budget ${JSON.stringify(DEFAULT_BUDGET)} · scratchPersistence=`
    + `${BOUNDS.scratch}`);
console.log(`# SWEPT   the spinner's cell — ${rows.length} interior cell(s) on the start side`);
console.log('');
for (const r of rows) {
    console.log(`(${r.tx},${r.ty})  ${r.cls}`
        + (r.ticks === null ? '' : `  ${r.ticks}t`)
        + (r.strategies.length ? `  records=[${r.strategies.join(',')}]` : '')
        + (r.scratchClears.length ? `  scratch=${JSON.stringify(r.scratchClears)}` : ''));
}

const byClass = new Map();
for (const r of rows) byClass.set(r.cls, (byClass.get(r.cls) ?? 0) + 1);
console.log('');
console.log('## counts by class');
for (const [cls, n] of [...byClass.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(2)}  ${cls}`);
}

// ⛔ One VERBATIM reason per class — the refusal text is the evidence channel
// (⚖ kickoff §3.1), and a summary that printed only counts would have thrown
// away the only content a reader can act on.
console.log('');
console.log('## one verbatim reason per class');
const seen = new Set();
for (const r of rows) {
    if (seen.has(r.cls) || !r.reason) continue;
    seen.add(r.cls);
    console.log(`--- ${r.cls} @ (${r.tx},${r.ty})`);
    console.log(r.reason);
}
