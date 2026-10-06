/**
 * seedlingDemo/fidelityClearTag — **THE `clear-tag` GOAL'S WITNESS ARMS**
 * (Seedling fidelity CLEARTAG).
 *
 * ⚖ The user (2026-10-05): *"break before first use"*. A saved obstacle whose
 * flag gates a landing is broken ON PURPOSE, from its open side, by the
 * solver's `clear-tag` goal (`solverBot.execClearTag`): the verb is the
 * catalogue's (`break`, `touch`, `burn` …), the finish is the run's
 * `earnedClears` ledger holding `{level, tag}`.
 *
 * One arm per VERB PATH the playthrough's events need and the solver drives,
 * each booted at a GAME landing on the obstacle's open side (a door's
 * `playerx/playery`, `fidelityArrival.gameLandings`) with the event's item:
 *   · `L0-1-from-L2`   — `breakablerock@288,176` {0,1}, the AP route's L0 event
 *                        (L12's door lands inside it), broken by the Sword — by
 *                        the walk to the stance's own strike (`cleared-in-passing`);
 *   · `L0-4-from-L13`  — `breakablerock@80,112` {0,4} (L1's door lands inside it),
 *                        the `break` executor itself;
 *   · `L71-2-from-L80` — `shieldlock@288,256` {71,2}, the AP route's L71 event
 *                        (L76's door lands inside it), a shield `touch`;
 *   · `L24-0-from-L23` — `burnabletree@32,128` {24,0} (L12's door lands inside
 *                        it), a Fire `burn`.
 * The tape is the solve's own key sets (`buildStagedTape`), so the game plays
 * exactly what the solver chose. Each arm also has two CUTS around the model's
 * write tick T (`modelWriteTick`, the family's own): `T` ticks (the write's
 * update not yet run) and `T + 1` — so the game says on which tick its
 * `persistence_cleared` first holds the flag. The game is played DECLARED
 * `hold`, so exactly `tick_count` updates run.
 *
 * Shared by the game probe (`probe-seedling-cleartag.mjs`) and the node rows
 * (`fidelityClearTag.test.js`), so the tape the game played and the tape the
 * rows replay are one tape.
 */

import { parseTape } from './tapeFormat.js';
import { buildStagedTape } from './botDriverV1.js';
import { createRunForStaging, runTape } from './tapeRunner.js';
import { solveSegment } from './solverBot.js';
import { atlasLevelSource } from './levelSource.js';
import { arrivalStaging } from './fidelityArrival.js';

export const CLEARTAG_WITNESSES = Object.freeze([
    Object.freeze({ key: 'L0-1-from-L2', boot: { level: 0, x: 256, y: 256 }, items: ['hasSword'],
        goal: Object.freeze({ kind: 'clear-tag', tag: { level: 0, tag: 1 }, at: { x: 288, y: 176 },
            obstacle: 'breakablerock@288,176' }), verb: 'break', onRoute: 'route step 33 (L12 -> L0 lands inside it)' }),
    Object.freeze({ key: 'L0-4-from-L13', boot: { level: 0, x: 48, y: 192 }, items: ['hasSword'],
        goal: Object.freeze({ kind: 'clear-tag', tag: { level: 0, tag: 4 }, at: { x: 80, y: 112 },
            obstacle: 'breakablerock@80,112' }), verb: 'break', onRoute: null }),
    Object.freeze({ key: 'L71-2-from-L80', boot: { level: 71, x: 224, y: 288 }, items: ['hasShield', 'hasDarkShield'],
        goal: Object.freeze({ kind: 'clear-tag', tag: { level: 71, tag: 2 }, at: { x: 288, y: 256 },
            obstacle: 'shieldlock@288,256' }), verb: 'touch', onRoute: 'route step 171 (L76 -> L71 lands inside it)' }),
    Object.freeze({ key: 'L24-0-from-L23', boot: { level: 24, x: 96, y: 80 }, items: ['hasSword', 'hasFire'],
        goal: Object.freeze({ kind: 'clear-tag', tag: { level: 24, tag: 0 }, at: { x: 32, y: 128 },
            obstacle: 'burnabletree@32,128' }), verb: 'burn', onRoute: null }),
]);

/** The solve and its tape for one witness (a fresh JS-runtime boot at the landing). */
export function clearTagSolve(w, levelSource = atlasLevelSource()) {
    const staging = arrivalStaging(w.boot, { items: w.items });
    const run = createRunForStaging(staging, levelSource);
    const name = `cleartag-${w.key}`;
    const out = solveSegment({ run, goals: [{ ...w.goal }], name, boot: { ...w.boot } });
    const record = out.records.find((r) => r.goal === 'clear-tag');
    // The solve's slot selections ride on the tape (`burn` selects the Fire's slot and the old one again).
    const tapeOf = (n, suffix = '') => parseTape(buildStagedTape({
        staging: { ...staging, equips: out.equips.filter((e) => e.t < n) },
        // Past the solve's end: idle ticks (nothing held), so a cut can ask about a later write.
        perTick: [...out.perTick.slice(0, n), ...Array.from({ length: Math.max(0, n - out.perTick.length) }, () => new Set())],
        name: `${name}${suffix}`,
    }));
    return { w, staging, out, record, tape: tapeOf(out.perTick.length), tapeOf };
}

/**
 * The MODEL's write tick T for `flag` in a `runTape` result — the family's own
 * (the game's `persistence_cleared` holds it after `T + 1` ticks): a rock's
 * `rocksBroken[].goneAt` (`endAnim`), a tree's `treeBurns[].goneAt`
 * (`removed()`), else the `earnedClears` row's `t` (a lock snap's close, a key
 * open's fade end). `null` while nothing has written it.
 */
export function modelWriteTick(m, flag) {
    const row = m.earnedClears.find((c) => c.level === flag.level && c.tag === flag.tag) ?? null;
    if (!row) return null;
    const rock = (m.rocksBroken ?? []).find((r) => r.level === flag.level && r.tag === flag.tag);
    if (rock) return Number.isInteger(rock.goneAt) ? rock.goneAt : null;
    const tree = (m.treeBurns ?? []).find((b) => b.flag?.level === flag.level && b.flag?.tag === flag.tag);
    if (tree) return Number.isInteger(tree.goneAt) ? tree.goneAt : null;
    return Number.isInteger(row.t) ? row.t : null;
}

/** Has the MODEL's replay of `tape` written `flag` (its write tick T run: `tick_count > T`)? */
export function modelWrote(tape, flag, levelSource = atlasLevelSource()) {
    const T = modelWriteTick(runTape(tape, { levelSource }), flag);
    return Number.isInteger(T) && tape.tick_count > T;
}

/**
 * Every game arm: the whole solve, and the two cuts around the model's write
 * tick T in the solve's replay (`modelWriteTick`): ended after `T` ticks (the
 * write's update not yet run) and after `T + 1`.
 */
export function clearTagArms(levelSource = atlasLevelSource()) {
    const out = [];
    for (const w of CLEARTAG_WITNESSES) {
        const s = clearTagSolve(w, levelSource);
        const n = modelWriteTick(runTape(s.tape, { levelSource }), w.goal.tag) + 1;
        out.push({ arm: `${w.key}-solve`, w, tape: s.tape, flagExpected: true, solve: s, n });
        out.push({ arm: `${w.key}-cut-${n - 1}`, w, tape: s.tapeOf(n - 1, `-cut-${n - 1}`), flagExpected: false, solve: s, n });
        out.push({ arm: `${w.key}-cut-${n}`, w, tape: s.tapeOf(n, `-cut-${n}`), flagExpected: true, solve: s, n });
    }
    return out;
}
