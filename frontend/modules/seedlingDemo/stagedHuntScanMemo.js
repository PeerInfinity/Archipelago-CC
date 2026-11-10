/**
 * seedlingDemo/stagedHuntScanMemo — ⛓⛓ SEEDLING HAMMER-PHASE STAGED-HUNT-CHEAP (`STAGED_HUNT_SCAN_MEMO`, OFF; asked only
 * under `CHASER_STAGED_HUNT`): the staged hunt's per-still-tick ask, made cheap without changing its answer.
 *
 * ⚖ The user queued this on 2026-11-05 (L40-CENSUS's step 2, wall A3). `solverBot.stagedChaserHunt` asks
 * `deriveKillByChaser` again after EVERY still tick at a staging cell. MEASURED (W0, leg 394/1 at 2342e256+, CSH):
 * one such ask is 177 work units, and **160 of them are the leash scan's per-cell reachability asks**: 80 cells in the
 * player's box plus 80 in the target's box (`KILL_STANCE_TARGET_RESCAN`), each a lookup against two floods
 * (`plansReach`: from the player, into the aim). The 8 candidates the forecast scores, and the guard approach's 8, are
 * the other 17. Nothing those floods read moves while the player stands still: they read the world, the plan options
 * (`solverPlanOpts`: the live geometry bag, keys, inventory, contacts, lattice, the pit latch), the teleporter grant,
 * the player's state and the aim. The body moves (under 1 px a tick on 394), and that only changes which cells are
 * inside its leash, which is arithmetic the scan still does every tick.
 *
 * ⇒ ON, one memo per `stagedChaserHunt` call holds the floods, the aim's own `corridorPlans` answer and each cell's
 * reachability answer, under a KEY of everything those read. An ask whose key is the memo's reuses them; an ask on a
 * cell it has answered before spends no work unit there (no flood was built and no planner ran). Any other ask (a
 * different key, a different world object) rebuilds the memo from scratch. So every ask answers exactly what it
 * answered OFF: the same in-leash cells, in the same order, the same candidates, the same forecast previews. The only
 * thing that changes is how many work units it spends.
 *
 * ⛔ THE KEY: the run's `world` by IDENTITY (a world is built by `worldFor` and replaced, never edited in place; a tile
 * write wraps a new object, `levelRun.stateDigestParts`' note), plus `canonicalDigestText` of `{state, planOpts,
 * allowTeleporter, aim}`. A function inside those values prints as `fn` and could hide a difference, so a key whose
 * text holds a bare `fn` token is NO key: that ask is not memoised. Two keys that differ cost a missed reuse, never a
 * false one.
 *
 * OFF: `stagedChaserHunt` passes no memo, so `deriveKillByChaser` builds its floods and asks every cell as it always
 * did: byte-identical. `SEEDLING_STAGED_HUNT_SCAN_MEMO=1` / `withStagedHuntScanMemo(enabled, fn)`.
 */
import { canonicalDigestText } from './solverView.js';

// ⚖ ON in the L40 flip (hammer L40-FLIP-BUILD, for the planner's harvest): `SEEDLING_STAGED_HUNT_SCAN_MEMO=0` opts out.
export const STAGED_HUNT_SCAN_MEMO = { enabled: globalThis.process?.env?.SEEDLING_STAGED_HUNT_SCAN_MEMO !== '0' };
export const STAGED_HUNT_SCAN_MEMO_DEFAULT = true;

/**
 * Run `fn` (sync or async) with `STAGED_HUNT_SCAN_MEMO` set to `enabled`, restored after (also on a throw) —
 * `solverBot.withSwitch`'s shape.
 */
export function withStagedHuntScanMemo(enabled, fn) {
    const was = STAGED_HUNT_SCAN_MEMO.enabled;
    STAGED_HUNT_SCAN_MEMO.enabled = enabled === true;
    try {
        const out = fn();
        if (out && typeof out.then === 'function') return out.finally(() => { STAGED_HUNT_SCAN_MEMO.enabled = was; });
        STAGED_HUNT_SCAN_MEMO.enabled = was;
        return out;
    } catch (e) {
        STAGED_HUNT_SCAN_MEMO.enabled = was;
        throw e;
    }
}

/**
 * The switch's instrument, written only with it ON and read by nothing that decides: per memoised ask, whether the
 * memo was reused (`hits`) or rebuilt (`builds`), asks refused a key (`unkeyed`), and the cell asks it answered from
 * the memo (`cellsReused`) against those it computed (`cellsAsked`).
 */
export const STAGED_HUNT_SCAN_MEMO_COUNTS = { builds: 0, hits: 0, unkeyed: 0, cellsReused: 0, cellsAsked: 0 };
export function resetStagedHuntScanMemoCounts() {
    Object.assign(STAGED_HUNT_SCAN_MEMO_COUNTS, { builds: 0, hits: 0, unkeyed: 0, cellsReused: 0, cellsAsked: 0 });
}

/** A fresh memo: one per `stagedChaserHunt` call, or `null` with the switch OFF. */
export function newStagedHuntScanMemo() {
    return STAGED_HUNT_SCAN_MEMO.enabled ? { key: null, world: null, entry: null } : null;
}

/** Does canonical text carry a function (a bare `fn` token, not the string `"fn"`)? */
const BARE_FN = /(^|[[{,:])fn(?=[,\]}:]|$)/;

/**
 * The memo's entry for this ask: `{reach, aimIsPlannable, cells}`, reused when the key and the world are the memo's,
 * else built by `build()` (which returns `{reach, aimIsPlannable}`) and stored. `null` memo, or a value that cannot
 * be keyed: `build()`'s answer with `cells: null` (nothing reused, nothing stored).
 */
export function stagedScanEntry(memo, { world, state, planOpts, allowTeleporter, aim }, build) {
    if (memo === null) return { ...build(), cells: null };
    const key = canonicalDigestText({ state, planOpts, allowTeleporter, aim });
    if (BARE_FN.test(key)) {
        STAGED_HUNT_SCAN_MEMO_COUNTS.unkeyed += 1;
        return { ...build(), cells: null };
    }
    if (memo.entry !== null && memo.key === key && memo.world === world) {
        STAGED_HUNT_SCAN_MEMO_COUNTS.hits += 1;
        return memo.entry;
    }
    STAGED_HUNT_SCAN_MEMO_COUNTS.builds += 1;
    memo.key = key;
    memo.world = world;
    memo.entry = { ...build(), cells: new Map() };
    return memo.entry;
}
