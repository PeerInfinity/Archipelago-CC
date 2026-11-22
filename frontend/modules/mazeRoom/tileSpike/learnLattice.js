/**
 * THE LEARNING LATTICE WALK (session tile-l12-one-world, built from the measure-only tile-l12-level-world; ⚖ Robert 2026-11-04
 * "A: Build after R-A3 (Recommended)"). The derives use it only ABOVE `RANK_WALK_MAX_POINTS` (the HYBRID,
 * `deriveLevelWorldLogic.js`: L12 as one level world, 131,072 points: 672 s → 5.2 s native); the rank walk stays below, where
 * it is faster. Per target, the minimal points of a MONOTONE
 * predicate `taken(reach, t, point)` are learned by membership queries (`query(point)` = a reach search, memoised by the
 * caller and shared by every target), instead of enumerating the lattice by rank.
 *
 *   1. Pick the first UNDECIDED point in rank order (`latticePoints`).
 *   2. Query it. Taken → SHRINK (each item in axis order, one level at a time, while still taken) to a MINIMAL point;
 *      not taken → GROW (one level at a time, while still not taken) to a MAXIMAL negative.
 *   3. A minimal point decides its whole UP-set taken; a maximal negative its whole DOWN-set not taken.
 *   4. Stop when every point is decided (the dual check: the up-sets of Min and the down-sets of Max cover the lattice).
 * Cost ≤ (|Min| + |Max|) · (n·levels + 1) queries per target, against up to 2^n for the rank walk.
 *
 * ⛓ SOUNDNESS PREMISE — MONOTONICITY, the premise the rank walk's superset skip, the top-skip and the latch sandwich already
 * rest on: P ≤ Q and taken(P) ⇒ taken(Q). The learner uses its DOWNWARD half at every negative, not just at the top.
 * - An event target's OWN event (`exclude(t)`) is non-monotone by definition (`reachedTarget`: never taken holding it): every
 *   point holding it is decided NOT taken up front, and shrink/grow never touch it — the target is learned on the axis
 *   without its event, exactly the points the rank walk could ever push.
 * - ⚠ The learner CANNOT detect a violation itself. Its up/down-mark conflict check (kept) never fires in practice: MEASURED over
 *   all 236 non-monotone predicates on 3 items, 0 refused, 236 answered (wrongly or not). So the premise is guarded STATICALLY:
 * - The static census (`assertMonotoneWorld`) refuses a rule node outside {True_, False_, Has, And, Or} and a trap armed by an
 *   item on the axis, before any search.
 * Output: per target, its minimal points sorted into `latticePoints` order with the reach that took each — the rank walk's
 * `minimal` order, so `minimal` and the witnesses are byte-identical when the premise holds.
 */
import { latticePoints, inventoryOf } from './deriveTileLogic.js';
import { ruleToClearSet } from './tileStep.js';
import { isObstacleCleared } from '../../shared/procgen/library.js';

/**
 * ⛔ The learner's MEMORY bound, in lattice points (also the derives' and the maze compile's refusal, `LEVEL_WORLD_MAX_POINTS`).
 * Per point it holds `D` (n bytes: the digits), `order` + `rankPos` (8 bytes), and per target `status` + `known` (2 bytes):
 * at 2^22 points and n = 22, ≈ 134 MB shared + 8 MB per target. Refused above it, by name.
 */
export const LEARN_MAX_POINTS = 1 << 22;

/**
 * `calls`: how many times `learnMinimal` ran (the hybrid's switch pin reads it). TEST-ONLY `mutant` (each pinned RED):
 * 'no-grow' (a negative decides only itself: answers survive, the query-count pin goes red), 'stop-early' (stop after a
 * target's first minimal point), 'no-exclude' (an own event is learned across like any item). Every caller leaves it null.
 */
export const LEARN_WALK = { mutant: null, calls: 0 };

const MONOTONE_KINDS = new Set(['True_', 'False_', 'Has', 'And', 'Or']);

/**
 * ⛓ The static half of the premise, refused BY NAME: every rule tree anywhere in the world uses only monotone node kinds, and no
 * trap is armed or disarmed by an item on the axis (a `while_active` trap on an axis token: holding it ARMS a lane).
 */
export function assertMonotoneWorld(world, items) {
    const axis = new Set(items);
    const seen = new Set();
    const walk = (x, path) => {
        if (x === null || typeof x !== 'object' || seen.has(x)) return;
        seen.add(x);
        if (x instanceof Map) { for (const [k, v] of x) walk(v, `${path}.${k}`); return; }
        if (x instanceof Set) return;
        if (Array.isArray(x)) { x.forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
        if (typeof x.rule === 'string' && ('args' in x || 'children' in x || x.rule === 'True_' || x.rule === 'False_')) {
            if (!MONOTONE_KINDS.has(x.rule)) {
                throw new Error(`learning walk: rule node '${x.rule}' at ${path} is not known monotone (True_/False_/Has/And/Or) — refused`);
            }
        }
        for (const [k, v] of Object.entries(x)) walk(v, `${path}.${k}`);
    };
    walk(world, 'world');
    for (const [id, t] of Object.entries(world.trapLib ?? {})) {
        if (t?.active && axis.has(t.active)) {
            throw new Error(`learning walk: trap ${id} is ${t.fires ?? 'armed'} on axis item '${t.active}' — reach may shrink with the inventory; refused`);
        }
    }
}

/**
 * ⛓⛓ PULLS ON THE AXIS (rules-engine-nit-b, ⚖ Robert 2026-11-21 "Engine nit (B) fix"): the census half the static census above
 * does not cover. A pull (`mazeRoomEngine.checkPulls`) whose GATE clears on an axis item breaks monotonicity: holding the gate,
 * a step into its disc from outside is REELED onto the trap (`pullAfterMove`), so a cell reached without the gate can be lost
 * with it (`deriveLevelWorldLogic.pullDiscNit.test.js`). Not refused: ROUTED, by name, through `probes` below.
 *
 * THE SEMANTICS (read off the game, `vendor/seedling/src`): Seedling's pull gate is the Dark Suit, a passive global flag
 * (`Player.as:246-253` → `Main.hasDarkSuit`, the save file), set on pickup (`Pickups/DarkSuit.as:44`) and read by the tongue
 * (`Enemies/LavaTrap.as:64`); nothing in play clears it (the resets at `Player.as:1814-1919` sit in `extraInputs`, called only
 * `if (Preloader.sponsorVersion)`, a `const false` at `Preloader.as:15`; `Bot.as:777` is the bot's injection seam). So the
 * player cannot shed it, and an AP rule — UPWARD-CLOSED, a set granted is granted with every superset — may grant S only when
 * EVERY lattice point T ⊇ S reaches. That predicate (`good`) is monotone by construction, so every walk (the rank walk's
 * superset skip, the latch sandwich, the learner's marks) stays sound on it. The full-point prune is unchanged: good(top) =
 * taken(top).
 *
 * THE PROOF that a few probes decide `good`: split the lattice by the PULL CLASS of a point (which axis-gated pulls its
 * inventory arms). Inside one class every pull acts identically, so — under the static census above (monotone rule kinds, no
 * axis-armed trap) — a step sequence legal at T is legal, with the same result, at every T' ⊇ T of the same class: reach is
 * monotone WITHIN a class. Hence ∀T ⊇ S taken(T) ⇔ taken at the MINIMAL points of each class above S. The class depends only
 * on the gates' items (the SUB-AXIS), so those minimal points are S with its sub-axis digits raised: `probes(S)` lists them,
 * S itself first. With no axis-gated pull there is one class and `pullUpSet` returns null: every walk is byte-identical.
 * `exclude`: an event target's own event is never raised (the target is judged on the axis without it, as everywhere).
 *
 * ⛔ REFUSED BY NAME: a gate that clears on an item OFF the axis (a token the world holds: the class would move with the
 * world's state, not the inventory).
 */
export function pullUpSet(world, axis) {
    const pulls = world.pulls ?? [];
    if (pulls.length === 0) return null;
    const index = new Map(axis.map((a, i) => [a.item, i]));
    const gated = [];
    for (const p of pulls) {
        const entry = world.obstacleLib?.[p.gate];
        const sets = (entry?.clear_set_type ?? 'combo_list') === 'rule' ? ruleToClearSet(entry.clear_rule, p.gate) : (entry?.clear_set ?? []);
        const items = new Set();
        for (const combo of sets) for (const pair of combo) items.add(Array.isArray(pair) ? pair[0] : pair);
        const off = [...items].filter((i) => !index.has(i));
        if (off.length) {
            throw new Error(`pull census: the pull at (${p.x},${p.y}) clears its gate ${p.gate} on ${off.join(', ')}, off the item axis — `
                + 'its class would move with the world\'s state; refused');
        }
        if (items.size) gated.push({ x: p.x, y: p.y, gate: p.gate, items: [...items].sort() });
    }
    if (gated.length === 0) return null;
    const sub = [...new Set(gated.flatMap((g) => g.items))].map((i) => index.get(i)).sort((a, b) => a - b);
    const pointOf = (d) => axis.flatMap(({ item, levels }, i) => (d[i] === 0 ? [] : Array(levels[d[i] - 1]).fill(item)));
    const classOf = (d) => {
        const inv = inventoryOf(pointOf(d));
        return gated.map((g) => (isObstacleCleared(g.gate, inv, world.obstacleLib) ? '1' : '0')).join('');
    };
    const memo = new Map();
    const probes = (point, exclude = null) => {
        const d = axis.map(() => 0);
        const counts = new Map();
        for (const it of point) counts.set(it, (counts.get(it) ?? 0) + 1);
        for (const [it, c] of counts) { const i = index.get(it); if (i !== undefined) d[i] = axis[i].levels.indexOf(c) + 1; }
        const key = `${d.join(',')}|${exclude ?? ''}`;
        if (memo.has(key)) return memo.get(key);
        // every raise of the sub-axis digits (an excluded item stays where it is), grouped by class, minimal per class
        const raises = [];
        const rec = (j, cur) => {
            if (j === sub.length) { raises.push(cur.slice()); return; }
            const i = sub[j];
            const top = axis[i].item === exclude ? d[i] : axis[i].levels.length;
            for (let v = d[i]; v <= top; v++) { cur[i] = v; rec(j + 1, cur); }
            cur[i] = d[i];
        };
        rec(0, d.slice());
        const byClass = new Map();
        for (const r of raises) {
            const c = classOf(r);
            if (!byClass.has(c)) byClass.set(c, []);
            byClass.get(c).push(r);
        }
        const leq = (a, b) => sub.every((i) => a[i] <= b[i]);
        const out = [point];
        for (const rs of byClass.values()) {
            for (const r of rs) {
                if (r.every((v, i) => v === d[i])) continue; // the point itself, already first
                if (rs.some((q) => q !== r && leq(q, r) && !leq(r, q))) continue; // not minimal in its class
                out.push(pointOf(r));
            }
        }
        memo.set(key, out);
        return out;
    };
    return { pulls: gated, probes };
}

/**
 * Learn every target's minimal points. `targets` = the live ones; `taken(reach, t, point)`; `exclude(t)` = the item a target is
 * never taken holding (its own event), or null. Returns `Map(target → [{point, reach}])` in `latticePoints` order, and the
 * number of `query` calls made (`queries`; the caller's memo decides how many are real searches).
 */
export function learnMinimal(axis, targets, { query, taken, exclude = () => null }) {
    const n = axis.length;
    const radix = axis.map((a) => a.levels.length + 1);
    const N = radix.reduce((p, r) => p * r, 1);
    if (N > LEARN_MAX_POINTS) throw new Error(`learning walk: ${N} lattice points exceed ${LEARN_MAX_POINTS} — refused`);
    const stride = [];
    for (let i = 0, s = 1; i < n; i++) { stride.push(s); s *= radix[i]; }
    const digitsOf = (idx) => axis.map((_, i) => Math.floor(idx / stride[i]) % radix[i]);
    const idxOf = (d) => d.reduce((s, v, i) => s + v * stride[i], 0);
    const pointOf = (d) => axis.flatMap(({ item, levels }, i) => (d[i] === 0 ? [] : Array(levels[d[i] - 1]).fill(item)));
    const itemIndex = new Map(axis.map((a, i) => [a.item, i]));
    // The rank order, from the rank walk's own generator, so ties break exactly as it does.
    const order = new Int32Array(N);
    const rankPos = new Int32Array(N);
    {
        let k = 0;
        const levelIdx = axis.map(({ levels }) => new Map(levels.map((v, j) => [v, j + 1])));
        for (const p of latticePoints(axis)) {
            const d = new Array(n).fill(0);
            const counts = new Map();
            for (const it of p) counts.set(it, (counts.get(it) ?? 0) + 1);
            for (const [it, c] of counts) { const i = itemIndex.get(it); d[i] = levelIdx[i].get(c); }
            const idx = idxOf(d);
            order[k] = idx; rankPos[idx] = k; k += 1;
        }
        if (k !== N) throw new Error(`learning walk: latticePoints gave ${k} points, the radix ${N}`);
    }
    // All digits, flat, for the up/down marks.
    const D = new Uint8Array(N * n);
    for (let idx = 0; idx < N; idx++) { const d = digitsOf(idx); for (let i = 0; i < n; i++) D[idx * n + i] = d[i]; }
    const geq = (idx, m) => { for (let i = 0; i < n; i++) if (D[idx * n + i] < m[i]) return false; return true; };
    const leq = (idx, m) => { for (let i = 0; i < n; i++) if (D[idx * n + i] > m[i]) return false; return true; };

    LEARN_WALK.calls += 1;
    let queries = 0;
    const out = new Map();
    for (const t of targets) {
        const ex = LEARN_WALK.mutant === 'no-exclude' ? null : exclude(t);
        const e = ex !== null && itemIndex.has(ex) ? itemIndex.get(ex) : -1;
        // ⛓ THE TWO-ARRAY FIX, "DECIDED-BY-MARK vs KNOWN-BY-QUERY" (pinned by the gadget rows): `status` holds what a MARK decided
        // (an up-set of Min, a down-set of Max, the own event) — the cursor skips ONLY these; `known` holds a point's own query
        // answer. A positive known only by its own query may still be MINIMAL (shrink has not run from it), so it must not be
        // skipped: the one-array first cut did, and lost true minimal points (5 gadget rows red).
        const status = new Int8Array(N); // 0 undecided, 1 taken, -1 not taken
        const known = new Int8Array(N);
        if (e >= 0) for (let idx = 0; idx < N; idx++) if (D[idx * n + e] > 0) status[idx] = -1; // by definition, not by monotonicity
        const minimal = [];
        const ask = (d) => {
            const idx = idxOf(d);
            if (status[idx] !== 0) return status[idx] > 0;
            if (known[idx] !== 0) return known[idx] > 0;
            const point = pointOf(d);
            queries += 1;
            const v = Boolean(taken(query(point), t, point));
            known[idx] = v ? 1 : -1;
            return v;
        };
        const markUp = (m) => {
            for (let idx = 0; idx < N; idx++) {
                if ((e >= 0 && D[idx * n + e] > 0) || !geq(idx, m)) continue;
                if (status[idx] < 0 || known[idx] < 0) {
                    throw new Error(`learning walk: NOT MONOTONE at target ${t.id ?? t.to ?? '?'} — [${pointOf(digitsOf(idx))}] covers minimal [${pointOf(m)}] but is not taken; refused`);
                }
                status[idx] = 1;
            }
        };
        const markDown = (m) => {
            for (let idx = 0; idx < N; idx++) {
                if (!leq(idx, m)) continue;
                if (status[idx] > 0 || known[idx] > 0) {
                    throw new Error(`learning walk: NOT MONOTONE at target ${t.id ?? t.to ?? '?'} — [${pointOf(digitsOf(idx))}] is taken under maximal negative [${pointOf(m)}]; refused`);
                }
                status[idx] = -1;
            }
        };
        for (let cur = 0; cur < N; cur++) {
            const idx = order[cur];
            if (status[idx] !== 0) continue;
            const d = digitsOf(idx);
            if (ask(d)) {
                for (let i = 0; i < n; i++) {
                    if (i === e) continue;
                    while (d[i] > 0) { d[i] -= 1; if (!ask(d)) { d[i] += 1; break; } }
                }
                markUp(d);
                minimal.push(idxOf(d));
                if (LEARN_WALK.mutant === 'stop-early') break;
            } else if (LEARN_WALK.mutant !== 'no-grow') {
                for (let i = 0; i < n; i++) {
                    if (i === e) continue;
                    while (d[i] < radix[i] - 1) { d[i] += 1; if (ask(d)) { d[i] -= 1; break; } }
                }
                markDown(d);
            }
        }
        minimal.sort((a, b) => rankPos[a] - rankPos[b]);
        out.set(t, minimal.map((idx) => { const point = pointOf(digitsOf(idx)); return { point, reach: query(point) }; }));
    }
    return { learned: out, queries };
}
