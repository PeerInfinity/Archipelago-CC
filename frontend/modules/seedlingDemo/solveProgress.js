/**
 * seedlingDemo/solveProgress — ⛓⛓⛓ SEEDLING HAMMER-PHASE D1: **THE SOLVER'S PROGRESS EMITTER**.
 *
 * ⚖ The user (2026-10-11), on the progress display: *"Both, plus extras"* — a TREE of the solver's goals and rungs
 * (attempts, successes, rejection tallies on each node), a TILE map of the search (a count per tile and the earliest
 * tick it was reached), and a work-budget meter, all over ONE channel, live while a solve runs. This module is the
 * solver's half: the counts and the snapshot. The worker → page transport and the panel are the JS arc's
 * (`jsRuntimeSolveWorker.js`, `flashPanel/`). The schema is `docs/json/developer/procgen/seedling-solve-progress.md`.
 *
 * ── THE CONTRACT ───────────────────────────────────────────────────────
 *
 *  - INSTALLED LIKE THE DEADLINE. `withSolveProgress(onProgress, fn)` runs `fn` with the hook active; nested installs
 *    restore the outer. `solverBot.solveSegment` also takes `onProgress` and installs it itself.
 *  - CALLED AT DETERMINISTIC POINTS ONLY: the deadline sites (`solverBot.DEADLINE_SITES`, coarse and fine, whether or
 *    not a deadline is installed) and the count points below. Never on a timer: this module reads no clock.
 *  - ⛓ HAMMER-PHASE HB — THE HEARTBEAT (`progressHeartbeat`): emit-only count points inside the solver's long loops,
 *    so a caller that posts on its own clock (the worker's tap) gets a chance to post where the solver is otherwise
 *    silent. Every `HEARTBEAT_EVERY[at]`-th pass of a loop calls the hook with site `heartbeat`. ⛔ It is not a
 *    deadline site: it asks no `shouldStop`, counts in no `budget.asks` and no `budget.work`, and the solver reads
 *    nothing it writes. Its own count is `snapshot.heartbeat`.
 *  - `onProgress(site, peek)` — `site` names the point that called (a deadline site, or one of `PROGRESS_POINTS`), and
 *    `peek()` materialises the snapshot only when the caller decides to post one. Throttling is the caller's.
 *  - OBSERVATION ONLY. Every count is read from a value the solver had already computed; nothing here is read back
 *    by the solver, and a hook that throws is ignored (a listener's bug is not the solve's). With and without a hook,
 *    every plan, trace and verdict is byte-identical (pinned by `solveProgress.test.js`).
 *  - ⛔ WITH NO HOOK INSTALLED, every count point in `solverBot` is ONE null check (`activeProgress !== null`): the
 *    functions below are reached only through it.
 *  - A SNAPSHOT IS A COPY: plain JSON (structured-clone safe), built fresh by every `peek()`.
 *  - ⛓ HAMMER-PHASE RK — `v: 2`: each rejection is also tallied by its KIND (`progressKind`, `REFUSAL_KINDS`) beside
 *    its reason key, and the segment keeps its last rejection's `why` VERBATIM (`lastWhy`). Both read the payload the
 *    reason key already reads, after the solver computed it; v1's fields are the same bytes.
 *  - ⛓ HAMMER-PHASE RK2 — v2 ADDITIONS (still `v: 2`): the kind `precondition` (a STATE GATE: the run or the world is
 *    not in the state the action needs, whatever the search does), `lastWhy.name` (the thrown error's class, or null),
 *    and rules naming more of the solver's own refusal families (the schema doc's §5, "v2 additions (RK2)").
 *  - ⛓ HAMMER-PHASE TC2 — v2 ADDITION (still `v: 2`): `frame`, THE ACTIVE FRAME'S DETAIL — the target, the stance cell
 *    and the danger blocking the corridor, for the innermost open frame that has them, overwritten as the path moves
 *    (never a list). Each value is one the solver had already computed (a climb's `hit`, a rung row's `target` /
 *    `stance`, a verb's obstacle and stance, the press arm's strike); `progressFrame` only copies it.
 */

/**
 * The snapshot's schema version (`v`). ⛓ RK: 2 — `tree.rejectionKinds` and `lastWhy` (the schema doc's §5). ⛓ RK2's
 * additions (`precondition`, `lastWhy.name`) and ⛓ TC2's (`frame`) are additive within 2: no consumer gates on `v`.
 */
export const SOLVE_PROGRESS_VERSION = 2;

/** The tile map's cell size in px — the A* tile (`TILE_SIZE`). */
export const PROGRESS_TILE = 16;

/**
 * The count points that are not deadline sites — the `site` a hook call names. `done` is the last call of a top-level
 * segment, after its outcome is known.
 */
export const PROGRESS_POINTS = Object.freeze(['segment', 'goal', 'walk', 'verb', 'climb', 'rung', 'arm', 'search',
    'preview', 'heartbeat', 'done']);

/**
 * ⛓ HAMMER-PHASE HB — the heartbeat's loops, and every how many passes of each one calls the hook. A COUNT, never the
 * clock: the hook (the tap) reads the clock and decides whether to post. Sized on L40's kill rung (`r5-l40-part5` →
 * the totem part at (160,640), where 86 % of the solve sat in hook gaps over 100 ms):
 *  - `preview-sample` — one previewed tick (`previewWalk`'s `combatBefore`, which its transit, stall and dwell loops
 *    each call once a sample). A sample is ~45 µs on the 4-core cloud box (L40: 15,970 samples, ~0.7 s of preview),
 *    so 512 are ~23 ms here and ~80 ms on the box the investigation measured (3.5× slower): ~10 Hz there.
 *  - `kill-stance` — one stance candidate planned (`deriveKillByChaser`'s `scoreAll`, after its `planWaypointsOrNull`):
 *    every one, since one candidate's plan is ~130 ms here and ~450 ms there (20 candidates on L40).
 *  - `plan-pull` — one `controllerPathClear` ask of `botDriverV2.planWaypoints`' string-pull (the L40 gaps' ~73 %:
 *    881 asks over the solve at ~3.3 ms each): every 8th, ~26 ms here and ~90 ms on the investigation's box. Added at
 *    HB's harvest with js-6's and fidelity's OK (planWaypoints is shared; the page's walker calls it unhooked).
 */
export const HEARTBEAT_EVERY = Object.freeze({ 'preview-sample': 512, 'kill-stance': 1, 'plan-pull': 8 });

/** The install the solve in progress reports to — `null` is "none", and every count point checks exactly this. */
export let activeProgress = null;

/**
 * Run `fn` with `onProgress` installed. Nested installs restore the outer one.
 *
 * @param {(site: string, peek: () => ?object) => void} onProgress
 * @param {Function} fn
 * @param {object} [o]
 * @param {?string} [o.pass]  the anytime pass this solve is (`segment.pass` in the snapshot), when the caller knows it
 */
export function withSolveProgress(onProgress, fn, { pass = null } = {}) {
    const outer = activeProgress;
    activeProgress = installOf(onProgress, pass, 'withSolveProgress');
    try {
        return fn();
    } finally {
        activeProgress = outer;
    }
}

/**
 * Install `onProgress` until the returned function is called — for a caller whose solves are not one synchronous
 * call (a whole process: `scripts/procgen/seedling-solve-progress-hook.mjs` preloads a silent hook this way, so a
 * producer's `--check` runs under one). The uninstall restores what was installed before, and only if this install
 * is still the active one.
 *
 * @returns {() => void}
 */
export function installSolveProgress(onProgress, { pass = null } = {}) {
    const outer = activeProgress;
    const p = installOf(onProgress, pass, 'installSolveProgress');
    activeProgress = p;
    return () => {
        if (activeProgress === p) activeProgress = outer;
    };
}

function installOf(onProgress, pass, who) {
    if (typeof onProgress !== 'function') {
        throw new Error(`${who}: onProgress must be a function (site, peek) => void, got ${typeof onProgress}`);
    }
    const p = { hook: onProgress, pass, segments: 0, depth: 0, seg: null, peek: null, calls: 0,
        beats: Object.fromEntries(Object.keys(HEARTBEAT_EVERY).map((at) => [at, 0])), beat: { at: null, count: 0 } };
    p.peek = () => (p.seg === null ? null : snapshotOf(p));
    return p;
}

// ── the tree ───────────────────────────────────────────────────────────

const nodeOf = (key, role, label) => ({ key, role, label, attempts: 0, successes: 0, rejections: new Map(),
    kinds: new Map(), kids: new Map() });

/** The child of `parent` keyed `key` (a ROLE key: one node however many times the role is derived there). */
function childOf(parent, key, role, label) {
    let n = parent.kids.get(key);
    if (n === undefined) {
        n = nodeOf(`${parent.key}/${key}`, role, label);
        parent.kids.set(key, n);
    }
    return n;
}

/** One rejection on `node`: its reason key and its kind, tallied together (so Σ kinds = Σ reasons on every node). */
const reject = (node, reason, kind) => {
    node.rejections.set(reason, (node.rejections.get(reason) ?? 0) + 1);
    node.kinds.set(kind, (node.kinds.get(kind) ?? 0) + 1);
};

/**
 * ⛓ HAMMER-PHASE RK — the sentence a rejection carries, VERBATIM: an error's `message`, a refused row's or a search's
 * `why`, else a search's `bound`. Nothing is cut, masked or capped (`progressReason` does that, for the key).
 *
 * @param {*} x  an error, a refused row (`{rung, why}`), a search result, or a `why` string
 * @returns {?string}
 */
export function progressWhy(x) {
    if (x === null || x === undefined) return null;
    if (typeof x !== 'object') return String(x);
    if (typeof x.message === 'string') return x.message;
    if (typeof x.why === 'string') return x.why;
    if (typeof x.bound === 'string') return x.bound;
    return typeof x.name === 'string' ? x.name : null;
}

/**
 * ⛓ HAMMER-PHASE RK — THE REFUSAL KINDS: a CLOSED list, each named with a word the solver already uses for it (the
 * schema doc's §2, "Rejection kinds", names the source of each). `other` is the residue: a rejection no rule below
 * recognises. ⛔ `solveProgress.test.js` holds `other` at 0 on the committed solves.
 */
export const REFUSAL_KINDS = Object.freeze(['deadline', 'pending', 'danger', 'bound', 'exhausted', 'does-not-apply',
    'precondition', 'already-true', 'unmodelled', 'diverged', 'error', 'other']);

/**
 * A search's `bound` → its kind: every bound the solver writes (`spaceTimeReach`'s `negative`, `deriveApproach`'s and
 * `deriveFight`'s `done`, `pressEscapeOnce`'s results; `solveProgress.test.js` reads them out of the source). A bound
 * not listed falls through to the sentence (`why`).
 */
export const BOUND_KINDS = Object.freeze({ deadline: 'deadline', expansions: 'bound', horizon: 'bound',
    exhausted: 'exhausted', start: 'danger', window: 'danger', death: 'danger', approach: 'danger', train: 'danger',
    body: 'does-not-apply', dying: 'does-not-apply', line: 'does-not-apply', 'no-landing': 'does-not-apply',
    unmodelled: 'unmodelled' });

/**
 * A `clear-tag` refusal's `obstacle.reason` (`solverBot`'s `refuseCT`) → its kind: the reason is the solver's own
 * field, so it decides before the sentence (which, for `unresolved`, wraps the inner refusal's words).
 * ⛓ RK2: `prerequisite` (a stance reachable only once another obstacle is discharged) and `cannot-act` (the run's bag)
 * are STATE GATES — `precondition`. `unresolved` is the resolver's GENERIC outcome ("could not bind this obstacle
 * against live state"), so its field alone says `exhausted`, and only its words can say more: an `unresolved` whose
 * verbatim why carries a state gate's own words (`PRECONDITION_WORDS`: the seal door's "the door cannot open in this
 * state:", wrapped from the approach resolver) is `precondition`; every other `unresolved` stays `exhausted`.
 */
export const CLEAR_TAG_KINDS = Object.freeze({ 'unresolved': 'exhausted', 'no-verb': 'unmodelled',
    'not-written': 'diverged', 'wrong-level': 'does-not-apply', 'cross-room-presser': 'does-not-apply',
    'prerequisite': 'precondition', 'cannot-act': 'precondition' });

/**
 * ⛓ RK2 — a STATE GATE's own words: the action is the right one for its target, but the run or the world is not in
 * the state it needs (a seal door's predicates, the WAND the Witch reads, a key or a weapon the bag lacks, an opener
 * not yet discharged, a crusher still charging, a box inside a solid), so no search from here can change the answer.
 * ⚖ fidelity-9: the seal door is read by its STABLE lead-in, the approach resolver's "the door cannot open in this
 * state:" — never by its predicate clauses, which may grow (a Watcher clause is a candidate).
 * ⛔ Contrast `does-not-apply`: there the QUESTION is the wrong one for the target (a KILL question, a static body
 * with no line to bend, a pit or a placement that is not there, a presser of another room, the wrong level).
 */
const PRECONDITION_WORDS = new RegExp([
    'the door cannot open in this state:', 'only for a player holding\\b', 'this run (?:holds no(?:ne)?|does not hold)\\b',
    'with this run\'s bag', 'cannot be (?:pushed|burned|opened|broken|struck) by this run', 'the inventory has no \\w+ slot',
    'has no weapon', 'holds no sword', 'holds NOTHING', 'is a SUB-ORDER\\b', 'reachable only once', 'needs \\S+ discharged',
    'plans from parks', 'until that solid is gone', 'does not act from inside a solid',
].join('|'));

/**
 * The sentence's rules, in order: each matches words the solver writes for that kind. Read on the VERBATIM `why`, never
 * on the cut key — a refusal raised after a deadline trip carries `deadlineClause` (`⏱ DEADLINE: …`) at its END,
 * past every separator the key cuts at.
 */
const WHY_KINDS = Object.freeze([
    ['deadline', /⏱ DEADLINE|anytime deadline|caller's deadline|at the deadline/],
    ['already-true', /\balready true\b|\bis ALREADY\b/],
    ['danger', /\bprobes? (?:DANGEROUS|dangerous)\b|\bwas HIT\b|\bHIT at dwell\b|danger map forbids|UNBILLED DAMAGE|fires a spit before/],
    ['exhausted', /\b(?:no|NO) (?:[A-Za-z]+ )?(?:stance|stall|side|state|kill|strike|forced hit|corridor|path|cell)s?\b|\bno (?:walkable|admissible)\b|\bNO LIVE BODY\b|found nothing|\bnone of\b|plans no corridor|left no corridor|every input from here is hit|\bEXHAUSTED\b|removed every body it could|would be the first one again/],
    ['bound', /\bUPPER BOUND\b|maxPerSegment|\bbound\b|\bbounded at\b|strategies for one goal|\bcleared \S+ obstacle\(s\) and\b/i],
    ['precondition', PRECONDITION_WORDS],
    ['does-not-apply', /\bquestion\b|STATIC census body|`speed 0`|is not a live body|is not a body\b|is dying|\bholds no\b|\bhas no \w+ tile\b|is not a presser|does not hold\b|resolves to NOTHING/],
    ['unmodelled', /unmodelled|UNMODELLED|not modelled|does not model|unpriced|does not price|[Nn]o strategy row|NOT REGISTERED|not registered|NOT registered|executor is registered|executor does not run|this run does not step|no choreography|nothing computed the consequence/],
    ['diverged', /diverge|and the RUN rests|does not ARRIVE|does not land|never (?:played|came to rest|comes to rest|armed|touched|ended|opened)\b|still standing|still shut|is not open by|disagree|crossed (?:to|from) level|crossed a door|\bleft level\b|press still down|is not (?:dead|dying)\b|still counted|is not in reach|\b(?:came|comes) to rest at\b|\bthe walk (?:rests|settled) at\b|does not settle\b|still frozen after|still open after|\bticks? (?:of the [a-z ]+ and no|without the)\b|is not complete\b|added nothing|as route step \S+ requires|before the thrust|ticks after the thrust|left the player (?:facing|at)\b|did not fire\b/],
]);

/** How many times `progressKind` was entered in this process — the gate's "unhooked, it never runs" counter. */
let kindEntries = 0;
export const kindEntered = () => kindEntries;

/**
 * ⛓ HAMMER-PHASE RK — a rejection's KIND (one of `REFUSAL_KINDS`), from the payload `progressReason` reads, in order:
 *  1. the solver's fields — a search's `bound` `deadline`; a `PendingDeclaration`, a refusal's `pending`, or
 *     `levelRun`'s `undeclaredKillLock` (`pending`);
 *  2. the deadline's words anywhere in the verbatim sentence (a refusal after a trip says it may be the deadline's);
 *  3. an error's `code` (`HAMMER_SAFETY` → `danger`, `STRIKE_BOUND_EXHAUSTED` → `bound`), a search's other `bound`
 *     (`BOUND_KINDS`), a refusal's `obstacle` (`danger`, `unmodelled-*`, a `clear-tag`'s `reason`: `CLEAR_TAG_KINDS`,
 *     where an `unresolved` carrying a state gate's words is `precondition`);
 *  4. the verbatim sentence (`WHY_KINDS`);
 *  5. any other thrown error (not a refusal) is `error`; the rest is `other`.
 * ⛔ PURE: it reads its argument only (no clock, no `shouldStop`), and only an install reaches it.
 *
 * @param {*} x  an error, a refused row (`{rung, why}`), a search result, or a `why` string
 * @returns {string}
 */
export function progressKind(x) {
    kindEntries += 1;
    if (x === null || x === undefined) return 'other';
    const o = typeof x === 'object' ? x : null;
    if (o !== null) {
        if (o.bound === 'deadline') return 'deadline';
        if (o.name === 'PendingDeclaration' || (o.pending !== null && o.pending !== undefined) || o.undeclaredKillLock) {
            return 'pending';
        }
    }
    const why = progressWhy(x) ?? '';
    if (WHY_KINDS[0][1].test(why)) return 'deadline';
    if (o !== null) {
        if (o.code === 'HAMMER_SAFETY') return 'danger';
        if (o.code === 'STRIKE_BOUND_EXHAUSTED') return 'bound';
        if (typeof o.bound === 'string' && Object.hasOwn(BOUND_KINDS, o.bound)) return BOUND_KINDS[o.bound];
        const ob = o.obstacle?.kind;
        if (ob === 'danger') return 'danger';
        if (typeof ob === 'string' && /^(?:unmodelled|unbilled)/.test(ob)) return 'unmodelled';
        if (ob === 'clear-tag' && Object.hasOwn(CLEAR_TAG_KINDS, o.obstacle.reason)) {
            // ⛓ RK2: `unresolved` is generic — a state gate's own words inside it make it `precondition`
            if (o.obstacle.reason === 'unresolved' && PRECONDITION_WORDS.test(why)) return 'precondition';
            return CLEAR_TAG_KINDS[o.obstacle.reason];
        }
    }
    for (let i = 1; i < WHY_KINDS.length; i += 1) if (WHY_KINDS[i][1].test(why)) return WHY_KINDS[i][0];
    if (x instanceof Error && o.name !== 'SolverRefusal') return 'error';
    return 'other';
}

/**
 * ⛓ HAMMER-PHASE RK — the segment's LAST rejection: its `why` verbatim, its kind, the node it landed on, and (⛓ RK2)
 * the thrown error's class name (`progressErrorName`; null for a row or a search). ONE
 * object per segment, overwritten (never a list). An error unwinding through several frames is one rejection: it
 * keeps the deepest node it landed on (the frame it was thrown under), not the outermost one it passed — but its
 * words are re-read at each frame, because they can grow on the way out (`withSolveDeadline` appends its
 * `deadlineClause` to a refusal raised after a trip, inside a segment that installed its own `shouldStop`).
 */
function noteLast(seg, x, kind, key) {
    const same = typeof x === 'object' && x !== null && seg.lastSource === x;
    seg.lastSource = typeof x === 'object' ? x : null;
    seg.lastWhy = { why: progressWhy(x), kind, key: same ? seg.lastWhy.key : key, name: progressErrorName(x) };
}

/**
 * ⛓ HAMMER-PHASE RK2 — `lastWhy.name`: a THROWN rejection's class, as the error names itself (`SolverRefusal`,
 * `PendingDeclaration`, `SolverBotError`, `Error`, `TypeError`, …), so a thrown non-refusal whose words matched a rule
 * keeps its class beside its kind. `null` for a rung row or a search leaf: they are not errors. Read off the error
 * object (its `name`), never off its message.
 *
 * @param {*} x  an error, a refused row (`{rung, why}`), a search result, or a `why` string
 * @returns {?string}
 */
export function progressErrorName(x) {
    if (!(x instanceof Error)) return null;
    return typeof x.name === 'string' && x.name ? x.name : (x.constructor?.name ?? 'Error');
}

/**
 * The tally key of a rejection, from the words the solver already wrote — nothing is invented:
 *  - an error's `code` (`SolverBotError`: `HAMMER_SAFETY`, `STRIKE_BOUND_EXHAUSTED`), or a search's `bound`;
 *  - else a named code the sentence leads with or parenthesises (`STANCE_REENTRY —`, `(LIGHT_REENTRY)`);
 *  - else the sentence that decides: the walk's own label (`solverBot(<tape>) … : `) dropped, cut at the first
 *    ` — `, `: `, `; `, ` (`, `. ` or newline, every number written `#` (so one reason at two positions is one key),
 *    at most 96 characters.
 *
 * @param {*} x  an error, a refusal's `why` string, or a search result
 * @returns {string}
 */
export function progressReason(x) {
    if (x === null || x === undefined) return 'unknown';
    if (typeof x === 'object') {
        if (typeof x.code === 'string' && x.code) return x.code;
        if (typeof x.bound === 'string' && x.bound && typeof x.message !== 'string') return x.bound;
    }
    const text = String(typeof x === 'object' ? (x.message ?? x.why ?? x.name ?? '') : x);
    const named = /(?:^|: |\()([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)(?:\)| —)/.exec(text);
    if (named) return named[1];
    let s = text.replace(/^solverBot\([^)]*\)[^:\n]*: /, '');
    const cut = s.search(/ — |: |; | \(|\. |\n/);
    if (cut > 0) s = s.slice(0, cut);
    s = s.replace(/-?\d+(?:\.\d+)?/g, '#').trim();
    return (s.length > 96 ? `${s.slice(0, 95)}…` : s) || (typeof x === 'object' ? (x.name ?? 'Error') : 'unknown');
}

/** Call the hook. ⛔ A hook that throws is ignored: the solve must not depend on its listener. */
function emit(p, site) {
    p.calls += 1;
    try {
        p.hook(site, p.peek);
    } catch { /* a listener's bug is not the solve's */ }
}

/** The frame on top of the stack: its node, and (a climb's) the rung/arm it is on. */
const top = (seg) => seg.stack[seg.stack.length - 1];
const parentOf = (seg) => { const f = top(seg); return f.cursor ?? f.node; };

/**
 * Enter a role node under the current cursor. Returns the frame `progressLeave` closes — `null` when no segment is
 * open (a rung or executor driven outside `solveSegment` under an install), which every function below accepts.
 */
export function progressEnter(key, role, label) {
    const p = activeProgress;
    const seg = p.seg;
    if (seg === null || seg.stack.length === 0) return null;
    const node = childOf(parentOf(seg), key, role, label);
    node.attempts += 1;
    const frame = { node, cursor: null, rung: null, lastRefused: null, detail: null };
    seg.stack.push(frame);
    emit(p, role);
    return frame;
}

/**
 * Close `frame` — and every frame still open above it: an exception unwound past them (they rejected for the same
 * reason), or they were left open to be closed with it (a goal, closed by the segment). `err` null: each node (and a
 * climb's cursor) succeeded.
 */
export function progressLeave(frame, err = null) {
    const seg = activeProgress?.seg ?? null;
    if (frame === null || seg === null) return;
    const at = seg.stack.lastIndexOf(frame);
    if (at < 0) return;
    const reason = err === null ? null : progressReason(err);
    const kind = err === null ? null : progressKind(err);
    if (err !== null) noteLast(seg, err, kind, seg.stack[seg.stack.length - 1].node.key);
    while (seg.stack.length > at) {
        const f = seg.stack.pop();
        if (reason === null) {
            f.node.successes += 1;
            if (f.cursor !== null) {
                f.cursor.successes += 1;
                if (f.rung !== null && f.rung !== f.cursor) f.rung.successes += 1;
            }
        } else {
            reject(f.node, reason, kind);
            if (f.cursor !== null) {
                // ⛓ an EXHAUSTED climb names its last rung's own reason (`considered`'s last row), and its own kind
                const last = err?.considered?.[err.considered.length - 1];
                const mine = last && f.rung !== null && f.rung.role === 'rung' && f.rung.label === last.option;
                const own = mine ? progressReason(last.why) : reason;
                const ownKind = mine ? progressKind(last.why) : kind;
                reject(f.cursor, own, ownKind);
                if (f.rung !== null && f.rung !== f.cursor) reject(f.rung, own, ownKind);
            }
        }
    }
}

/** `fn()` inside a role node: success when it returns, a rejection (its reason) when it throws. */
export function progressRun(key, role, label, fn) {
    const frame = progressEnter(key, role, label);
    let out;
    try {
        out = fn();
    } catch (e) {
        progressLeave(frame, e);
        throw e;
    }
    progressLeave(frame, null);
    return out;
}

/** The nearest open climb frame (the rung markers' owner), or null. */
function climbFrame(seg) {
    if (seg === null) return null;
    for (let i = seg.stack.length - 1; i >= 0; i -= 1) if (seg.stack[i].node.role === 'climb') return seg.stack[i];
    return null;
}

/** A rung of the climb in progress begins its derivation: one attempt, and the cursor moves onto it. */
export function progressRung(rung) {
    const p = activeProgress;
    const f = climbFrame(p.seg);
    if (f === null) return;
    const node = childOf(f.node, `rung:${rung}`, 'rung', rung);
    node.attempts += 1;
    f.rung = node;
    f.cursor = node;
    clearRungDetail(f);
    emit(p, 'rung');
}

/**
 * A rung wrote its trace row (`climbLadder`'s `rowFor(rung, refused, extra)`): `refused` — the cheaper rung's refusal
 * the row carries — is tallied once (by identity) on that rung, with its own `why`; an `extra.arm` moves the cursor
 * onto that arm (one attempt).
 */
export function progressRow(rung, refused, extra) {
    const p = activeProgress;
    const f = climbFrame(p.seg);
    if (f === null) return;
    if (refused && refused !== f.lastRefused) {
        f.lastRefused = refused;
        const node = childOf(f.node, `rung:${refused.rung}`, 'rung', refused.rung);
        const kind = progressKind(refused);
        reject(node, progressReason(refused.why), kind);
        noteLast(p.seg, refused, kind, node.key);
    }
    if (f.rung === null || f.rung.label !== rung) {
        f.rung = childOf(f.node, `rung:${rung}`, 'rung', rung);
        f.rung.attempts += 1;
        clearRungDetail(f);
    }
    // ⛓ TC2 — the row's own `target` / `stance` (the rung wrote them on its trace row) are the climb's frame detail
    if (extra && (typeof extra.target === 'string' || extra.stance)) {
        noteDetail(f, { ...(typeof extra.target === 'string' ? { target: extra.target } : {}),
            ...(extra.stance ? { stance: extra.stance } : {}) });
    }
    if (extra && typeof extra.arm === 'string') {
        f.cursor = childOf(f.rung, `arm:${extra.arm}`, 'arm', extra.arm);
        f.cursor.attempts += 1;
    } else {
        f.cursor = f.rung;
    }
}

/** A finished search (a leaf): one attempt, a success or its rejection, and its expansions as work. */
export function progressSearch(phase, r) {
    const p = activeProgress;
    if (p.seg === null || p.seg.stack.length === 0) return;
    const node = childOf(parentOf(p.seg), `search:${phase}`, 'search', phase);
    node.attempts += 1;
    if (r.ok) node.successes += 1;
    else {
        const kind = progressKind(r);
        reject(node, progressReason(r.bound ?? r), kind);
        noteLast(p.seg, r, kind, node.key);
    }
    if (Number.isFinite(r.expansions)) work(p.seg, 'expansions', r.expansions);
    emit(p, 'search');
}

/** The next goal of the segment's list begins (the previous one, still open, has succeeded). */
export function progressGoal(index, goal) {
    const p = activeProgress;
    const seg = p.seg;
    if (seg === null) return;
    if (seg.goal !== null) progressLeave(seg.goal, null);
    const g = goal ?? {};
    const at = g.exit ?? g.placement ?? g.at ?? (g.pit ? { x: g.pit.tx, y: g.pit.ty } : null) ?? g.tag ?? null;
    const where = at === null ? '' : (typeof at === 'object' ? ` (${at.x},${at.y})` : ` ${at}`);
    seg.goal = progressEnter(`goal#${index}`, 'goal', `${g.kind ?? 'goal'}${where}`);
}

// ── the budget ─────────────────────────────────────────────────────────

const work = (seg, unit, n) => { seg.work[unit] = (seg.work[unit] ?? 0) + n; };

/** A deadline site's ask point was reached (coarse or fine; with or without a deadline installed). */
export function progressSite(site) {
    const p = activeProgress;
    const seg = p.seg;
    if (seg === null) return;
    seg.asks[site] = (seg.asks[site] ?? 0) + 1;
    emit(p, site);
}

/** The caller's `shouldStop` was called — the JS arc's work unit (`jsRuntimeSolver.createWorkClock`). */
export function progressAsked() {
    const seg = activeProgress.seg;
    if (seg !== null) work(seg, 'shouldStop', 1);
}

/** One driven tick (`solveSegment`'s `advance`), and the level the run now stands on. */
export function progressTick(level) {
    const seg = activeProgress.seg;
    if (seg === null) return;
    seg.work.ticks += 1;
    seg.level = level;
}

// ── the heartbeat ──────────────────────────────────────────────────────

/** How many times `progressHeartbeat` was entered in this process — the gate's "unhooked, it never runs" counter. */
let heartbeatEntries = 0;
export const heartbeatEntered = () => heartbeatEntries;

/**
 * One pass of the long loop `at` (a key of `HEARTBEAT_EVERY`): every `HEARTBEAT_EVERY[at]`-th pass calls the hook
 * with site `heartbeat`. ⛔ EMIT-ONLY — no ask (`progressSite`), no `shouldStop`, no work unit; `snapshot.heartbeat`
 * names the loop and counts the beats. Outside a segment it counts nothing (the other count points' rule).
 */
export function progressHeartbeat(at) {
    heartbeatEntries += 1;
    const p = activeProgress;
    if (p.seg === null) return;
    const n = p.beats[at] + 1;
    p.beats[at] = n;
    if (n % HEARTBEAT_EVERY[at] !== 0) return;
    p.beat.at = at;
    p.beat.count += 1;
    emit(p, 'heartbeat');
}

// ── the tiles ──────────────────────────────────────────────────────────

function tilesOf(seg, run) {
    const level = run.level;
    let t = seg.tiles.get(level);
    if (t === undefined) {
        t = { level, cols: run.world?.width ?? null, rows: run.world?.height ?? null, cells: new Map() };
        seg.tiles.set(level, t);
    }
    seg.tileLevel = level;
    return t;
}

function reach(t, x, y, tick) {
    const col = Math.floor(x / PROGRESS_TILE);
    const row = Math.floor(y / PROGRESS_TILE);
    const k = row * 4096 + col;
    const c = t.cells.get(k);
    if (c === undefined) t.cells.set(k, [col, row, 1, tick]);
    else {
        c[2] += 1;
        if (tick < c[3]) c[3] = tick;
    }
}

/** A walk preview (`previewWalk`): every sample is a previewed player state at its own absolute tick. */
export function progressPreview(run, samples) {
    const p = activeProgress;
    const seg = p.seg;
    if (seg === null) return;
    work(seg, 'previews', 1);
    work(seg, 'previewStates', samples.length);
    const t = tilesOf(seg, run);
    for (const s of samples) reach(t, s.x, s.y, s.tick);
    emit(p, 'preview');
}

/**
 * The `onNode` a space-time search reports its kept states to (`spaceTimeReach`), or null with no hook. Index `i` is
 * the player at the top of tick `n + i` (the press kill's convention, `n = run.ticksCompleted`).
 */
export function progressStatesFor(run, n) {
    const seg = activeProgress?.seg ?? null;
    if (seg === null) return null;
    const t = tilesOf(seg, run);
    return (state, i) => {
        seg.work.searchStates += 1;
        reach(t, state.x, state.y, n + i);
    };
}

// ── the segment ────────────────────────────────────────────────────────

/**
 * Run one `solveSegment` under the active install. A top-level segment starts a fresh tree, tiles and budget; a
 * nested one (a solve inside a solve) is a `segment` node under the current cursor. `readers` (set by the segment
 * once its counters exist) are the counts it already keeps (`waypointsPlanned`, `replans`, `dashesPressed`).
 */
export function progressSegment(name, run, fn) {
    const p = activeProgress;
    if (p.depth > 0) {
        p.depth += 1;
        try {
            return progressRun('segment', 'segment', String(name), fn);
        } finally {
            p.depth -= 1;
        }
    }
    const root = nodeOf('segment', 'segment', String(name));
    root.attempts = 1;
    const seg = {
        name: String(name), index: p.segments, level: run?.level ?? null, outcome: 'running',
        root, stack: [{ node: root, cursor: null, rung: null, lastRefused: null, detail: null }], goal: null,
        tiles: new Map(), tileLevel: null,
        asks: {}, work: { shouldStop: 0, ticks: 0, previews: 0, previewStates: 0, searchStates: 0, expansions: 0 },
        readers: null, lastWhy: null, lastSource: null,
    };
    p.segments += 1;
    p.seg = seg;
    p.depth = 1;
    emit(p, 'segment');
    try {
        const out = fn();
        progressLeave(seg.stack[0], null);
        seg.outcome = 'solved';
        return out;
    } catch (e) {
        progressLeave(seg.stack[0], e);
        seg.outcome = e?.name === 'SolverRefusal' ? 'refused' : 'threw';
        throw e;
    } finally {
        p.depth = 0;
        emit(p, 'done');
    }
}

/** The segment's own counters, read at `peek()` (functions of no arguments). */
export function progressReaders(readers) {
    const seg = activeProgress.seg;
    if (seg !== null && seg.readers === null) seg.readers = readers;
}

// ── the active frame (⛓ TC2) ─────────────────────────────────────────────

/** How many times `progressFrame` was entered in this process — the gate's "unhooked, it never runs" counter. */
let frameEntries = 0;
export const frameEntered = () => frameEntries;

/** A position in px → its tile on the tile map (`[col, row]`, `PROGRESS_TILE`), or null. */
function tileOf(at) {
    if (at === null || at === undefined || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return null;
    return [Math.floor(at.x / PROGRESS_TILE), Math.floor(at.y / PROGRESS_TILE)];
}

/**
 * ⛓ TC2 — the danger's KIND, read off the probe's first source (the one the trace's `obstacle.id` names), by its
 * own fields: `phase` — a chain's / beam's rect or an axe's blade AT THIS TICK (`dangerMap.hazardDanger` sets
 * `phase` / `axe`); `forecast` — a body stepped or carried to the sample's tick (an arrow, a chaser, a spinner, a
 * spit, a bomb's blast); `volume` — a static volume (a hazard's census volume, a static enemy, a crusher, a lethal
 * tile or pit, an armed lane). ⛔ Pure: no probe is asked.
 */
const FORECAST_SOURCES = new Set(['arrow', 'chaser', 'spinner', 'spit', 'bomb']);
export function dangerKindOf(source) {
    if (source === null || source === undefined) return null;
    if (source.phase !== undefined || source.axe !== undefined) return 'phase';
    return FORECAST_SOURCES.has(source.kind) ? 'forecast' : 'volume';
}

/**
 * ⛓ TC2 — the bounded summary of a probe's hit (`probeCorridor` / `probeSamples`: `{x, y, tick, sources}`): its
 * first source's id, the absolute tick and tile it was met at, and its kind. Null for no hit.
 */
function dangerOf(hit) {
    if (hit === null || hit === undefined || typeof hit !== 'object') return null;
    const s = hit.sources?.[0] ?? null;
    return { source: s?.id ?? null, tick: Number.isFinite(hit.tick) ? hit.tick : null, kind: dangerKindOf(s),
        at: tileOf(hit) };
}

/** Merge `d` (`target` / `stance` / `danger`, each already summarised) into frame `f`'s detail. */
function noteDetail(f, d) {
    const was = f.detail ?? { target: null, stance: null, danger: null };
    f.detail = {
        target: Object.hasOwn(d, 'target') ? (typeof d.target === 'string' ? d.target : null) : was.target,
        stance: Object.hasOwn(d, 'stance') ? tileOf(d.stance) : was.stance,
        danger: Object.hasOwn(d, 'danger') ? d.danger : was.danger,
    };
}

/** A climb's cursor moved to another rung: the previous rung's target and stance are not this one's. */
function clearRungDetail(f) {
    if (f.detail !== null) f.detail = { target: null, stance: null, danger: f.detail.danger };
}

/**
 * ⛓ TC2 — the open frame on top of the stack has this DETAIL, already computed by the solver: `target` (a body or
 * obstacle id), `stance` (a position in px; kept as its tile), `danger` (a probe's hit; kept as `dangerOf`'s bounded
 * summary). Only the keys present are written. ⛔ EMIT-ONLY: no hook call, no ask, no work unit; reached only behind
 * `activeProgress !== null`. Outside a segment it records nothing.
 *
 * @param {{target?: ?string, stance?: ?{x: number, y: number}, danger?: ?object}} d
 */
export function progressFrame(d) {
    frameEntries += 1;
    const seg = activeProgress.seg;
    if (seg === null || seg.stack.length === 0) return;
    noteDetail(top(seg), Object.hasOwn(d, 'danger') ? { ...d, danger: dangerOf(d.danger) } : d);
}

/**
 * The snapshot's `frame`: the INNERMOST open frame that carries detail — its active node (a climb's cursor: the rung
 * or arm on), and that detail — or null. ONE object, recomputed at each peek, never a list.
 */
function frameOf(seg) {
    for (let i = seg.stack.length - 1; i >= 0; i -= 1) {
        const f = seg.stack[i];
        if (f.detail === null) continue;
        const d = f.detail;
        return { key: (f.cursor ?? f.node).key, target: d.target,
            stance: d.stance === null ? null : [d.stance[0], d.stance[1]],
            danger: d.danger === null ? null : { ...d.danger, at: d.danger.at === null ? null : [...d.danger.at] } };
    }
    return null;
}

// ── the snapshot ───────────────────────────────────────────────────────

function nodeJson(n, active) {
    const rejections = {};
    for (const [k, v] of n.rejections) rejections[k] = v;
    const rejectionKinds = {};
    for (const [k, v] of n.kinds) rejectionKinds[k] = v;
    return {
        key: n.key, role: n.role, label: n.label, attempts: n.attempts, successes: n.successes, rejections,
        rejectionKinds, active: active.has(n), children: [...n.kids.values()].map((c) => nodeJson(c, active)),
    };
}

function snapshotOf(p) {
    const seg = p.seg;
    const active = new Set();
    for (const f of seg.stack) {
        active.add(f.node);
        if (f.rung !== null) active.add(f.rung);
        if (f.cursor !== null) active.add(f.cursor);
    }
    const t = seg.tileLevel === null ? null : seg.tiles.get(seg.tileLevel);
    const cells = t === null ? [] : [...t.cells.values()].map((c) => [c[0], c[1], c[2], c[3]])
        .sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
    const counted = {};
    if (seg.readers !== null) for (const [k, f] of Object.entries(seg.readers)) counted[k] = f();
    return {
        v: SOLVE_PROGRESS_VERSION,
        seq: p.calls,
        segment: { name: seg.name, index: seg.index, level: seg.level, ...(p.pass !== null ? { pass: p.pass } : {}),
            outcome: seg.outcome },
        tree: nodeJson(seg.root, active),
        tiles: t === null ? null : { level: t.level, tile: PROGRESS_TILE, cols: t.cols, rows: t.rows, cells },
        budget: { asks: { ...seg.asks }, work: { ...seg.work, ...counted } },
        lastWhy: seg.lastWhy === null ? null : { ...seg.lastWhy },
        frame: frameOf(seg),
        ...(p.beat.count > 0 ? { heartbeat: { at: p.beat.at, count: p.beat.count } } : {}),
    };
}
