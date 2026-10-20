#!/usr/bin/env node
/**
 * Measure-only (the divergence sweep, planner `seedling-js-planning-2`) — THE LIVE WASM DIVERGENCE SWEEP: every
 * leg of `--legs=<jsonl>` (`seedling-divergence-legs.mjs`) served by the PRODUCTION wasm playback engine on the
 * live `seedling_playthrough` page (default build p4f, headless logic-only, under the box lock), one jsonl row per
 * leg. It changes nothing tracked. The in-page half is `seedlingDivergenceLab.js` (imported by URL).
 *
 * Per leg: (inventory mode) the items the AP route holds at the leg's sphere are granted through the AP path
 * (`stateManagerProxy.addItemToInventory`, in collection order — the game appends slots in acquisition order),
 * each waited into the game; a host jump to the leg's resolved arrival (`seedlingRoomPlay.jumpSettled`: a jump
 * the region binding re-places is re-jumped INSIDE the room); then `engine.walkTo(goal)` — forced re-arrival →
 * freeze → worker solve → one tape → watch → (W3) recovery / exact-repeat failure — until done / crossed /
 * failed / the leg budget. The row carries the engine's history, every plan's verdict, the shipped tapes, and
 * for each play that left its plan the model and game rows around the tick and the first differing field.
 *
 *   --mode=bare|inv      bare: no grants (exits first, the location legs last); inv: legs in sphere order, grants
 *   --from=N --limit=N   a window of the (mode-ordered) list — yield the box in chunks
 *   --page-legs=N        a fresh page every N legs (default 60; the row records the page's leg index). ⛔ 1 = one
 *                        clean game per leg, the start ASSERTED empty (CI's default: the game's items are session-wide)
 *   --ids=a,b            only these leg ids (this list's positions)
 *   --keys=k1|k2         only these leg KEYS (`seedling-divergence-legs.legKey`: (region, arrival door, goal) — stable
 *                        across SHAs, where an id shifts)
 *
 * A leg the list marks `stagedEvents` (an arrival whose every door needs a `game_state` event: unstaged, the jump
 * lands inside the unbroken obstacle; or a GOAL rule needing one the AP route holds there, `goalEvents`) has each flag written into the GAME's persistence table before its jump, by the
 * game's own setter (`Game.setPersistence(tag, false, level)`, a bridge `method_call`, the channel key delivery
 * uses), and read back from `botStatus.persistence_cleared` (a flag that never lands = `end: 'stage-failed'`, by
 * name). The jump's `new Game` then builds the room from that table, and the engine declares it as the live table.
 * ⚖ A TEST-HARNESS STAGING CHOICE ONLY — a player using that arrival broke the obstacle earlier in the run; the
 * runtime's "flags flow game → AP only" is unchanged and production never stages a flag the game did not set.
 * A staged flag outlives its leg, so every staging leg gets its OWN fresh page (`orderLegs`), whatever --page-legs.
 *   --no-stage-events    the MUTANT / control: stage nothing (the legs land inside their obstacles)
 *   --stage-flags=<key>=><level>:<tag>[,<level>:<tag>…][|<key>=>…]  ⚖ MEASUREMENT ONLY (a WITNESS of a model row
 *                        whose state no route reaches at that arrival, e.g. F1's L5 open-lock DETOUR): those legs
 *                        (by KEY, '|'-separated like --keys) ALSO stage the named removed flags, through the SAME
 *                        channel (the game's setter, the read-back, `stage-failed`, a page of its own). Their rows
 *                        carry `stagedFlags` (the requested set), so a staged row is never read as the natural leg.
 *                        An unknown key or a malformed flag fails the run (the CI plan) by name. ⛔ Production never
 *                        stages: this is the harness's instrument, as the event staging is.
 *   SWEEP_STAGE_MUTANT=skip-write  TEST-ONLY (env; INERT when unset): the staging is requested but never written —
 *                        the read-back must end the leg `stage-failed` by name. ⛔ Never in a real sweep.
 * A leg the list marks `skip` (a gate that maps to no flag, or a goal that IS its gating event) is emitted as
 * `end: 'skipped'` with its reason, and never run.
 *   --cpu-throttle=<x>   ⚖ MEASUREMENT ONLY (§5.89): emulate a slow runner — CDP CPU throttling at x (≥ 1) on each page
 *                        after its boot; every row is stamped `cpuThrottle`. The game runs its own frames, only slower:
 *                        its clock is never touched. ⛔ Never in a real sweep.
 *   --shard=i/n          only shard i of n (`partitionLegs`: price-balanced, longest first — CI's matrix)
 *   --shard-plan=n [--json]  print the partition (no browser, no box) — the CI plan job
 *   --page=<build>       drive another staged build (also SEEDLING_PAGE), e.g. seedling_bot_ap_p4f
 *   --out=<jsonl>        append rows here (default stdout only)
 *   --producer=walker    §3: the same engine built with the walker INSTRUMENT (`producer: 'walker'`): the J2 WALKER's tape, shipped to the game
 *   --dump=<json>        write the page's delivered set + name map (the node bare pass stages from it)
 *   --contact-fidelity=<keys>|all|none  ⛓ CONTACT HOOK: set the model's contact switches through the flashPanel
 *                        settings (`seedlingContact<Key>`, the ON keys; every other OFF) before the panel boots. The
 *                        panel's instance is read back and printed as a `CONTACT:` line (a mismatch fails the boot);
 *                        each plan the worker solved under an off-default set carries its `contactFidelity` stamp.
 *   --leg-budget-ms=<ms> ⛓ THE LEG BUDGET (S5-1): the harness's wall clock per leg's serve (default 90000 — today's). Off
 *                        the default, each row is stamped `legBudgetMs` (the merge refuses a mixed-budget merge by name),
 *                        a `timeout` row carries `cut` (the bound that ended it, the engine's phase, the solver's own
 *                        backstop), and the `leg` hang bound and the shard timeout grow with it. ⛔ The solver's work-unit
 *                        budgets and its 300 s backstop are not this: a budget above the backstop lets that NAME surface.
 *   --memory-probe-ms=<ms> [--memory-out=<jsonl>]  ⛓ MEMORY PROBE (slice `seedling-js-wasm-oom`, default OFF — no sample, no
 *                        wrapped call, no row field): every <ms> (≥ 250) across each leg, from just before its jump to its
 *                        end, sample the GAME's o1heap arena (allocated / peak / oom, read out of linear memory, no call
 *                        into the game), the runtime's frame counter, the game's clock + level (one `botStatus`), the
 *                        engine's phase, the bridge calls (an opt-in counter in the lab) and the parent page's JS heap (CDP).
 *                        Each sample prints a `MEMPROBE leg <id>` line; the row gets `memory` (`summarizeMemory`: the
 *                        whole leg and its `solving` span) and `memoryProbeMs`; `--memory-out` gets the whole curve,
 *                        one line per leg. The sampler is `seedlingMemoryProbe.js` (bounded: it halves past 1200).
 *                        `--memory-probe-ms=<ms>,hit-sample-ms=<n>` = the SPLIT ARM: the lab's 25 ms `botStatus` hit
 *                        sampler runs every <n> ms instead (rows stamped `hitSampleMs`; `roomHits` is coarser there).
 *                        More arms (`seedlingMemoryProbe.parseMemoryProbe`, each stamped on the row): `hold-l0=<s>` (the
 *                        boot room frozen by `botHold` before the grants), `quiet-l0=<s>` (then frozen again with the panel's
 *                        item-only `queueItems` pushes dropped), `run-arrival=<s>` / `hold-arrival=<s>` (the
 *                        arrival room run unheld, then frozen, before the serve), `live-objects` (the runtime's per-frame
 *                        live AVM2 counts, kept by a one-token rewrite of the served glue JS; the wasm is untouched).
 *   --capture-requests=<jsonl>  ⛓ REQUEST CAPTURE (default OFF): append every solve request each leg made, in order, AS THE
 *                        WORKER RECEIVED IT (`seedlingSolveRequestCodec.captureRequest`: no `levelSource`; Map/Set tagged), with
 *                        its pass rows and work units — one line per leg `{id, key, requests}`. The rows are unchanged
 *                        (the requests never go on a row). Replay one in node: `replay-seedling-solve-request.mjs`.
 *   --axe-dodge=on|off   ⛓ AXE_DODGE HOOK: set fidelity's `AXE_DODGE_ASK_PER_PREVIEW` through the flashPanel setting
 *                        `seedlingAxeDodgeAskPerPreview` before the panel boots (absent = `default`, today's run). The
 *                        panel's value and the model's own default are printed as an `AXE_DODGE:` line (a mismatch
 *                        fails the boot); each plan the worker solved off-default carries its `axeDodgeAskPerPreview` stamp.
 *   --upgrade-window-work=<units>  ⛓ THE UPGRADE WINDOW (slice `seedling-js-dash-window`; DS named it): set the flashPanel
 *                        setting `seedlingSolverUpgradeWindowWork` before the panel boots (absent = the engine's own 85 —
 *                        today's run; 0 = the whole budget). Read back as an `UPGRADE-WINDOW:` line (a mismatch fails the
 *                        boot), so every solve request the engine makes carries it as its `upgradeWindowWork`. Every row
 *                        and the plan are stamped `upgradeWindowWork`; the merge refuses a mixed-window merge by name.
 *   --dash-only-window=on|off  ⛓ DASH-ONLY WINDOW: set the solver's `DASH_ONLY_WINDOW` through the flashPanel setting
 *                        `seedlingDashOnlyWindow` (absent = `default`, today's run), read back as a `DASH_ONLY_WINDOW:` line;
 *                        each plan the worker solved off-default carries its `dashOnlyWindow` stamp, every row and the plan
 *                        `dashOnlyWindow` ('on' / 'off'), and the merge refuses a mixed merge by name.
 *   --dash-shape=<spec>  ⛓ DASH-SHAPE STAMP: set solverBot's three SEEDLING DB dash switches through the flashPanel
 *                        settings `seedlingDash{LegPrecheck,NoSwingPrefix,KeepPartial}` (absent = `default`, today's run).
 *                        The spec is a comma list of `<key>:on|off` (keys legPrecheck, noSwingPrefix, keepPartial; a bare
 *                        key = on), or `all`. Read back as a `DASH_SHAPE:` line (a mismatch fails the boot); each request
 *                        the engine makes off-default carries the `dashShape` stamp, each plan the shape its worker READ
 *                        (`dashShapeRead`), every row and the plan `dashShape` (the canonical spec), and the merge refuses
 *                        a mixed merge by name.
 *
 * ⛓ THE HANG BOUND (H1: sweep-4 shard 9, CI run 38110831520, sat ~5 h after its 18th page and named nothing). Every
 * harness step between legs — a page's teardown, the browser's close, the launch, the new page, a boot attempt and a
 * leg — runs under a wall-clock bound (`HANG_BOUNDS_MS`, each derived from measured CI times). A bound that expires
 * prints `HANG: page <n> <step> exceeded <s> s … lost=<ids|none>`, SIGKILLs the browser's process group (Playwright's
 * `browser.close()` can hang itself), emits every leg of that page with no row as `end: 'harness-hang'` (its step;
 * `started` when the leg had begun), and relaunches for the next page. Each leg prints `LEG <id> start` first, so a
 * hang anywhere names its leg and page; each page prints a `RECYCLE:` line of its step times (the next derivation).
 *   SWEEP_INJECT_HANG=<page>:<step>[,…]  TEST-ONLY fault injection (env; INERT when unset): that page's step never
 *                        resolves (steps: pageClose browserClose launch newPage boot leg). ⛔ Never in a real sweep.
 *   SWEEP_HANG_BOUND=off TEST-ONLY: the MUTANT — no bound (an injected hang then sits until the job's timeout)
 *
 * Location legs: a location opened once stays open for the session, so a page takes at most ONE arrival per
 * location; the k-th arrivals of every location share the k-th location page.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build.
 *
 * Run: node scripts/procgen/probe-seedling-divergence-sweep.mjs --legs=<jsonl> [--mode=bare|inv] [--shard=i/n|--shard-plan=n [--json]] [--page=<build>] [--producer=solver|walker] [--host=…] [--from=N] [--limit=N] [--page-legs=N] [--ids=…|--keys=…] [--no-stage-events] [--stage-flags=…] [--contact-fidelity=<keys>|all|none] [--axe-dodge=on|off] [--upgrade-window-work=<units>] [--dash-only-window=on|off] [--dash-shape=<spec>] [--leg-budget-ms=<ms>] [--capture-requests=<jsonl>] [--memory-probe-ms=<ms> [--memory-out=<jsonl>]] [--out=…] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLASH_PANEL, clickPanelTab, createRoomPlay, slotBlockOf, withSlotBlock } from './seedlingRoomPlay.js';
import { legSelectors, pickLegs } from './seedling-divergence-legs.mjs';
import { callDelta, createMemorySampler, formatMemorySample, memoryArmStamp, parseMemoryProbe, readGameMemoryInPage, summarizeMemory,
    withLiveObjects } from './seedlingMemoryProbe.js';

argvHelp(import.meta.url);

/**
 * The mode's leg order, cut into PAGES (each a fresh page). Exported for a reader of the rows. A leg that STAGES
 * event flags (`stagedEvents`) is a page of its own, after the rest: its flags outlive it in the game.
 */
export function orderLegs(legs, mode, pageLegs) {
    const staging = legs.filter((l) => l.stagedEvents?.length);
    const rest = legs.filter((l) => !l.stagedEvents?.length);
    const sIdx0 = (l) => (l.sphere?.index ?? Infinity);
    const own = (mode === 'inv' ? [...staging].sort((a, b) => sIdx0(a) - sIdx0(b) || a.id - b.id) : staging).map((l) => [l]);
    return [...orderUnstaged(rest, mode, pageLegs), ...own];
}

function orderUnstaged(legs, mode, pageLegs) {
    const exits = legs.filter((l) => l.goal.kind === 'exit');
    const locs = legs.filter((l) => l.goal.kind === 'location');
    const sIdx = (l) => (l.sphere?.index ?? Infinity);
    const bySphere = (a, b) => sIdx(a) - sIdx(b) || a.id - b.id;
    const pages = [];
    const ex = mode === 'inv' ? [...exits].sort(bySphere) : exits;
    for (let i = 0; i < ex.length; i += pageLegs) pages.push(ex.slice(i, i + pageLegs));
    // location rounds: the k-th arrival of each location
    const rounds = [];
    const seen = new Map();
    for (const l of (mode === 'inv' ? [...locs].sort(bySphere) : locs)) {
        const k = seen.get(l.goal.name) ?? 0;
        seen.set(l.goal.name, k + 1);
        (rounds[k] ??= []).push(l);
    }
    // ⛔ a round is cut by `pageLegs` too: CI run 37387769158 put each round on ONE page whatever --page-legs said,
    // and the clean-start assertion failed 50 location legs BY NAME (an earlier location's pickup, held)
    for (const r of rounds) for (let i = 0; i < r.length; i += pageLegs) pages.push(r.slice(i, i + pageLegs));
    return pages;
}

/**
 * A leg's EXPECTED price in seconds (the shard balance, not a measurement): a page boot is shared, so a leg pays
 * its jump + solve + play. Measured on the box (chunk 0, load ~18): refusals 5–8 s, crossings 4–29 s, a location
 * 17 s; play time grows with the room. So: 10 s, +10 s for a location (a check ceremony), + the room's tile area /
 * 60 (the walk). Exported for the plan job and its reader.
 */
export function legPrice(leg, areaOf) {
    return 10 + (leg.goal.kind === 'location' ? 10 : 0) + Math.round((areaOf(leg.level) ?? 300) / 60);
}

/** Longest-processing-time-first into exactly `n` shards (deterministic: price desc, then id). */
export function partitionLegs(legs, n, areaOf) {
    const shards = Array.from({ length: n }, (_, i) => ({ shard: i + 1, price: 0, ids: [] }));
    const priced = legs.map((l) => ({ id: l.id, p: legPrice(l, areaOf) })).sort((a, b) => b.p - a.p || a.id - b.id);
    for (const { id, p } of priced) {
        const s = shards.reduce((m, x) => (x.price < m.price ? x : m), shards[0]);
        s.ids.push(id);
        s.price += p;
    }
    for (const s of shards) s.ids.sort((a, b) => a - b);
    return shards;
}

/** The map's room areas, in tiles. */
export function roomAreas(repo) {
    const map = JSON.parse(readFileSync(join(repo, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
    // ⛓ the map's `width`/`height` are in TILES already (L5: 7 × 8)
    const areas = new Map((map.levels ?? []).map((l) => [l.level, (l.width ?? 20) * (l.height ?? 15)]));
    return (level) => areas.get(level);
}

/**
 * ⛓ THE HANG BOUNDS, ms — each MEASURED (⚖ a margin is measured, never assumed), from the timestamped job logs of the
 * 40 solver-shard jobs of CI runs 38110831520, 38128698078, 38128782757, 38129317003, 38129323711 (2026-10-11):
 *   · a whole RECYCLE (page.close + browser.close + launch + newPage, read as the gap between a page's last line and
 *     the next page's `booted in` line minus its boot seconds) ≤ 0.95 s over 943 recycles (+ 0.5 s for the boot's
 *     rounding: ≤ 1.5 s). Each of the four steps is bounded at 30 s: ≥ 20× that whole recycle.
 *   · a BOOT attempt (`booted in`) ≤ 34 s over 975 boots → 340 s (×10).
 *   · a LEG (the boot line or the previous ROW to its ROW: grants, jump, serve) ≤ 119.3 s over 975 legs → 1200 s (×10).
 * A bound that fires names its step and costs the page's legs a re-dispatch; one that never fires cost the sweep
 * 5 h. ⛓ The `RECYCLE:` line now measures the four recycle steps one by one: re-derive from it, not from this gap.
 */
export const HANG_BOUNDS_MS = Object.freeze({
    pageClose: 30000, browserClose: 30000, launch: 30000, newPage: 30000, boot: 340000, leg: 1200000,
});

/**
 * ⛓ THE LEG BUDGET (S5-1) — the harness's wall clock for one leg's serve (`serveLeg`'s loop: walkTo → done / crossed /
 * failed / refused, else `timeout`). ⛔ The harness's clock only: the solver's work-unit budgets and its own 300 s
 * backstop (`SOLVE_BACKSTOP_MS`, a NAMED failure per solve) are untouched. Off-default (`--leg-budget-ms`), every row is
 * STAMPED `legBudgetMs` (the merge refuses a mixed-budget merge by name) and a `timeout` row names its bound (`cut`);
 * at the default every row is byte-identical to today's.
 */
export const LEG_BUDGET_MS_DEFAULT = 90000;

/** `--leg-budget-ms` → ms (empty = the default). Not a whole number of ms ≥ 1000 → throws by name. */
export function parseLegBudgetMs(spec) {
    const s = String(spec ?? '').trim();
    if (!s) return LEG_BUDGET_MS_DEFAULT;
    if (!/^\d+$/.test(s) || Number(s) < 1000) throw new Error(`--leg-budget-ms: ${JSON.stringify(s)} is not a whole number of ms ≥ 1000`);
    return Number(s);
}

/** A row stamped with its leg budget: the row itself at the default (byte-identical), `legBudgetMs` appended off it. */
export function stampBudget(row, legBudgetMs) {
    return legBudgetMs === LEG_BUDGET_MS_DEFAULT ? row : { ...row, legBudgetMs };
}

/**
 * ⛓ THE SOLVER KNOBS (slice `seedling-js-dash-window`; `--dash-shape`, slice `seedling-js-dash-shape-stamp`) —
 * `--upgrade-window-work`, `--dash-only-window` and `--dash-shape`, the solver
 * settings a sweep may move. Empty = absent (today's run: nothing is set, nothing is stamped). Unlike the leg budget
 * these reach the SOLVE: the panel setting is written before the boot, so the engine's every request carries it.
 */
export const SOLVER_KNOB_KEYS = Object.freeze(['upgradeWindowWork', 'dashOnlyWindow', 'dashShape']);

/** `--upgrade-window-work` → units (empty = null, the engine's own). Not a whole number ≥ 0 → throws by name. */
export function parseUpgradeWindowWorkArg(spec) {
    const s = String(spec ?? '').trim();
    if (!s) return null;
    if (!/^\d+$/.test(s)) throw new Error(`--upgrade-window-work: ${JSON.stringify(s)} is not a whole number of work units ≥ 0 (0 = the whole budget)`);
    return Number(s);
}

/** `--dash-only-window` → 'on' / 'off' (empty = null, the switch's own default). Anything else throws by name. */
export function parseDashOnlyWindowArg(spec) {
    const s = String(spec ?? '').trim();
    if (!s) return null;
    if (s !== 'on' && s !== 'off') throw new Error(`--dash-only-window is "${s}"; the values are on, off`);
    return s;
}

/**
 * `--dash-shape` → the canonical spec (`dashShapeHook.formatDashShape`, keys in their one order; empty = null, the
 * switches' own defaults). A bad spec throws by name. Async: the hook is loaded on demand (it imports the solver).
 */
export async function parseDashShapeArg(spec) {
    const s = String(spec ?? '').trim();
    if (!s) return null;
    const { parseDashShape, formatDashShape } = await import('../../frontend/modules/seedlingDemo/dashShapeHook.js');
    return formatDashShape(parseDashShape(s, '--dash-shape')) || null;
}

/** A row (or the plan) stamped with the knobs that were set: the row itself when none was (byte-identical). */
export function stampSolverKnobs(row, knobs = {}) {
    const set = Object.fromEntries(SOLVER_KNOB_KEYS.filter((k) => knobs[k] !== null && knobs[k] !== undefined).map((k) => [k, knobs[k]]));
    return Object.keys(set).length ? { ...row, ...set } : row;
}

/**
 * The `leg` hang bound under a leg budget: the measured bound plus whatever the budget adds over the default, so a
 * long budget keeps the bound's measured margin (≥ 1080 s over the serve) and the HANG never fires inside the serve.
 */
export function legHangBoundMs(legBudgetMs) {
    return HANG_BOUNDS_MS.leg + Math.max(0, legBudgetMs - LEG_BUDGET_MS_DEFAULT);
}

/** ⛓ GitHub's ceiling on a hosted job's `timeout-minutes`. */
export const JOB_TIMEOUT_CEILING_MIN = 360;

/**
 * The shard job's `timeout-minutes`. At the default: today's estimate (the priciest shard ×4 + 20 min), unchanged.
 * Off-default the WORST case is added as a floor — every leg of the biggest shard spends its whole budget, plus 60 s
 * of grants/jump/teardown per leg (the measured leg was ≤ 119.3 s at a 90 s budget) and 60 s per page boot (≤ 34 s
 * measured) — so a long budget is never cut by the job instead of by its own clock. Over GitHub's 360-min ceiling it
 * THROWS by name (fewer legs per shard, or more shards).
 */
export function shardTimeoutMinutes({ maxPrice, shards = [], legBudgetMs = LEG_BUDGET_MS_DEFAULT }) {
    const base = Math.ceil((maxPrice * 4) / 60) + 20;
    if (legBudgetMs === LEG_BUDGET_MS_DEFAULT) return base;
    const worstS = Math.max(0, ...shards.map((x) => x.ids.length * (legBudgetMs / 1000 + 60) + (x.pages ?? x.ids.length) * 60));
    const m = Math.max(base, Math.ceil(worstS / 60) + 20);
    if (m > JOB_TIMEOUT_CEILING_MIN) {
        throw new Error(`--leg-budget-ms=${legBudgetMs}: the worst shard needs ${m} min, over the job's ${JOB_TIMEOUT_CEILING_MIN}-min `
            + 'ceiling — more shards or fewer legs');
    }
    return m;
}

/** A harness step that outlived its bound (`bounded`). */
export class SweepHang extends Error {
    constructor(step, ms) {
        super(`${step} exceeded ${ms / 1000} s`);
        this.step = step;
        this.ms = ms;
    }
}

/**
 * `work()` raced against `ms` (a `SweepHang(step)` when it loses). The abandoned promise's late rejection is
 * swallowed: the caller kills the browser under it. `enabled: false` is the MUTANT (SWEEP_HANG_BOUND=off): no bound.
 */
export async function bounded(step, ms, work, { enabled = true } = {}) {
    const p = Promise.resolve().then(work);
    if (!enabled) return p;
    p.catch(() => {});
    let t = null;
    const timer = new Promise((_, reject) => { t = setTimeout(() => reject(new SweepHang(step, ms)), ms); });
    try { return await Promise.race([p, timer]); } finally { clearTimeout(t); }
}

/** `SWEEP_INJECT_HANG` → [{ page, step }] (empty when unset — INERT). An unknown step or a bad page throws, by name. */
export function parseInjectHang(spec) {
    return String(spec ?? '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
        const [pg, step, ...rest] = x.split(':');
        if (rest.length || !/^[1-9]\d*$/.test(pg ?? '') || !Object.hasOwn(HANG_BOUNDS_MS, step ?? '')) {
            throw new Error(`SWEEP_INJECT_HANG: ${JSON.stringify(x)} is not <page>:<step> (steps: ${Object.keys(HANG_BOUNDS_MS).join(' ')})`);
        }
        return { page: Number(pg), step };
    });
}

/** The row of a leg its page's hang cost: the leg's identity, `end: 'harness-hang'`, the step and whether it began. */
export function hangRow(leg, { mode, producer, page, pageLeg, step, ms, started }) {
    return { id: leg.id, key: leg.key ?? null, mode, producer, page, pageLeg, level: leg.level, goal: leg.goal.name,
        kind: leg.goal.kind, sphere: leg.sphere?.label ?? null, ...stamp(leg), end: 'harness-hang', hang: { step, boundS: ms / 1000, started },
        error: `the page hung in ${step} (bound ${ms / 1000} s)${started ? ' after this leg started' : ' before this leg started'}` };
}

/**
 * `--stage-flags` → Map(leg key → [{eventId, level, tag}]). The spec is `<key>=><level>:<tag>[,…]`, legs
 * '|'-separated (a key holds `->`, never `=>`). Empty = no staging. A malformed entry throws by name.
 */
export function parseStageFlags(spec) {
    const out = new Map();
    for (const part of String(spec ?? '').split('|').map((x) => x.trim()).filter(Boolean)) {
        const at = part.lastIndexOf('=>');
        const key = at > 0 ? part.slice(0, at).trim() : '';
        const flags = at > 0 ? part.slice(at + 2).split(',').map((x) => x.trim()).filter(Boolean) : [];
        if (!key || !flags.length || flags.some((f) => !/^\d+:\d+$/.test(f))) {
            throw new Error(`--stage-flags: ${JSON.stringify(part)} is not <leg key>=><level>:<tag>[,<level>:<tag>…]`);
        }
        if (out.has(key)) throw new Error(`--stage-flags: the leg ${JSON.stringify(key)} is named twice`);
        out.set(key, flags.map((f) => {
            const [level, tag] = f.split(':').map(Number);
            return { eventId: `flag:L${level}:${tag}`, level, tag };
        }));
    }
    return out;
}

/**
 * The legs with `--stage-flags` applied: each named leg's `stagedEvents` gains the flags (deduplicated; `otherLevel`
 * as the leg list writes it) and it is STAMPED `stagedFlags` (the requested set — its rows carry it). The input is
 * untouched. A key no leg has throws by name (a stale key must not stage nothing silently).
 */
export function withStageFlags(legs, plan) {
    if (!plan?.size) return legs;
    const known = new Set(legs.map((l) => l.key));
    const missing = [...plan.keys()].filter((k) => !known.has(k));
    if (missing.length) throw new Error(`--stage-flags: no leg has the key(s) ${JSON.stringify(missing)}`);
    return legs.map((l) => {
        const flags = plan.get(l.key);
        if (!flags) return l;
        const have = l.stagedEvents ?? [];
        const add = flags.filter((f) => !have.some((h) => h.level === f.level && h.tag === f.tag))
            .map((f) => ({ ...f, otherLevel: f.level !== l.level }));
        return { ...l, stagedEvents: [...have, ...add], stagedFlags: flags };
    });
}

/** A `--stage-flags` leg's row stamp (`{}` for a natural leg): every row of it, whatever its end, says so. */
export function stamp(leg) {
    return leg.stagedFlags ? { stagedFlags: leg.stagedFlags } : {};
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
    const PLAN = arg('shard-plan', '');
    if (PLAN) {
        // the plan job: no browser, no box — the partition and the leg count, for the matrix and the merge
        const legs0 = withStageFlags(readFileSync(arg('legs', ''), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)),
            parseStageFlags(arg('stage-flags', '')));
        const shards = partitionLegs(legs0, Number(PLAN), roomAreas(REPO));
        // ⛓ a page boot is paid once per `--page-legs` legs (CI measured 18–21 s; priced 30 s)
        const perPage = Number(arg('page-legs', '60'));
        const legBudgetMs = parseLegBudgetMs(arg('leg-budget-ms', ''));
        // ⛓ THE SOLVER KNOBS — on the plan too, so the merge holds every row to the plan's
        const knobs = { upgradeWindowWork: parseUpgradeWindowWorkArg(arg('upgrade-window-work', '')),
            dashOnlyWindow: parseDashOnlyWindowArg(arg('dash-only-window', '')),
            dashShape: await parseDashShapeArg(arg('dash-shape', '')) };
        const staging = new Set(legs0.filter((l) => l.stagedEvents?.length).map((l) => l.id));
        const pagesOf = new Map();
        for (const x of shards) {
            const own = x.ids.filter((id) => staging.has(id)).length;
            pagesOf.set(x.shard, Math.ceil((x.ids.length - own) / perPage) + own);
            x.price += pagesOf.get(x.shard) * 30;
        }
        const maxPrice = Math.max(...shards.map((x) => x.price));
        // ⛓ the shard timeout: the priciest shard's estimate ×4 (a 2-CPU runner vs the estimate's box) + the page boots
        // and the setup (20 min); off-default, floored by the leg budget's worst case (`shardTimeoutMinutes`)
        const timeoutMinutes = shardTimeoutMinutes({ maxPrice, legBudgetMs,
            shards: shards.map((x) => ({ ids: x.ids, pages: pagesOf.get(x.shard) })) });
        if (process.argv.includes('--json')) {
            console.log(JSON.stringify(stampSolverKnobs({ legs: legs0.length, matrix: shards.map((x) => x.shard),
                timeoutMinutes, shards, ...(legBudgetMs === LEG_BUDGET_MS_DEFAULT ? {} : { legBudgetMs }) }, knobs)));
        } else {
            if (legBudgetMs !== LEG_BUDGET_MS_DEFAULT) console.log(`LEG-BUDGET: ${legBudgetMs} ms per leg (--leg-budget-ms); shard timeout ${timeoutMinutes} min`);
            for (const k of SOLVER_KNOB_KEYS) if (knobs[k] !== null) console.log(`SOLVER-KNOB: ${k} ${knobs[k]}`);
            console.log(`SHARD PLAN: ${legs0.length} legs into ${shards.length} shards (price = legPrice, seconds)`);
            for (const x of shards) console.log(`  shard ${x.shard}: ${x.ids.length} legs, ~${Math.round(x.price / 60)} min`);
        }
        process.exit(0);
    }
    // ⛓ TEST-ONLY (see the head): parsed before the box, so a bad spec fails first
    const INJECT = parseInjectHang(process.env.SWEEP_INJECT_HANG);
    const BOUND_ON = process.env.SWEEP_HANG_BOUND !== 'off';
    // ⛓ THE LEG BUDGET — parsed before the box, so a bad value fails first
    const LEG_BUDGET = parseLegBudgetMs(arg('leg-budget-ms', ''));
    const BOUNDS = { ...HANG_BOUNDS_MS, leg: legHangBoundMs(LEG_BUDGET) };
    takeBoxLockOrExit({ name: 'probe-seedling-divergence-sweep.mjs', kind: 'browser' });
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const MODE = arg('mode', 'bare');
    const OUT = arg('out', '');
    // ⛓ REQUEST CAPTURE — empty = off (today's run: no request is serialized)
    const CAPTURE = arg('capture-requests', '');
    // ⛓ MEMORY PROBE — 0 = off (today's run: nothing sampled, nothing wrapped, no row field); parsed before a browser
    const MEM = parseMemoryProbe(arg('memory-probe-ms', ''));
    const { ms: MEM_PROBE, hitSampleMs: HIT_SAMPLE } = MEM;
    const MEM_OUT = arg('memory-out', '');
    const FROM = Number(arg('from', '0'));
    const LIMIT = Number(arg('limit', '100000'));
    const PAGE_LEGS = Number(arg('page-legs', '60'));
    const DUMP = arg('dump', '');
    const PRODUCER = arg('producer', 'solver');
    const STAGE_EVENTS = !process.argv.includes('--no-stage-events');
    // ⛓ parsed before the box, so a bad spec fails first. TEST-ONLY mutant: requested, never written
    const STAGE_FLAGS = parseStageFlags(arg('stage-flags', ''));
    const STAGE_MUTANT = process.env.SWEEP_STAGE_MUTANT ?? '';
    // ⛓ FREEZE LATCH (§5.89) — MEASUREMENT ONLY: a slow runner, emulated (CDP CPU throttling after the boot); rows stamped
    const CPU_THROTTLE = Number(arg('cpu-throttle', '0')) || 0;
    if (CPU_THROTTLE && !(CPU_THROTTLE >= 1)) throw new Error(`--cpu-throttle=${CPU_THROTTLE}: the rate is a slowdown factor >= 1`);
    if (STAGE_MUTANT && STAGE_MUTANT !== 'skip-write') throw new Error(`SWEEP_STAGE_MUTANT: ${JSON.stringify(STAGE_MUTANT)} is not skip-write`);
    const SHARD = arg('shard', '');
    // ⛓ CONTACT HOOK — the set, parsed here so a bad key fails before a browser starts
    const CONTACT_ARG = arg('contact-fidelity', '');
    const { parseContactFidelity, formatContactFidelity } = await import('../../frontend/modules/seedlingDemo/contactFidelity.js');
    const CONTACT = CONTACT_ARG ? parseContactFidelity(CONTACT_ARG, '--contact-fidelity') : null;
    const { CONTACT_SETTING_KEYS } = await import('../../frontend/modules/flashPanel/seedlingContactSettings.js');
    // ⛓ AXE_DODGE HOOK — `on` / `off`, checked here so a bad value fails before a browser starts
    const AXE_DODGE = arg('axe-dodge', '') || null;
    if (AXE_DODGE !== null && AXE_DODGE !== 'on' && AXE_DODGE !== 'off') throw new Error(`--axe-dodge is "${AXE_DODGE}"; the values are on, off`);
    const { AXE_DODGE_SETTING_KEY } = await import('../../frontend/modules/flashPanel/seedlingAxeDodgeSettings.js');
    // ⛓ THE SOLVER KNOBS — checked here so a bad value fails before a browser starts
    const KNOBS = { upgradeWindowWork: parseUpgradeWindowWorkArg(arg('upgrade-window-work', '')),
        dashOnlyWindow: parseDashOnlyWindowArg(arg('dash-only-window', '')),
        dashShape: await parseDashShapeArg(arg('dash-shape', '')) };
    const { DASH_ONLY_WINDOW_SETTING_KEY } = await import('../../frontend/modules/flashPanel/seedlingDashOnlyWindowSettings.js');
    // ⛓ DASH-SHAPE STAMP — the spec's keys as the three panel settings (`on` / `off`; a key the spec omits stays untouched)
    const { DASH_SHAPE_SETTING_KEYS, dashShapeSpec } = await import('../../frontend/modules/flashPanel/seedlingDashShapeSettings.js');
    const { parseDashShape } = await import('../../frontend/modules/seedlingDemo/dashShapeHook.js');
    const DASH_SHAPE_WRITES = Object.entries(parseDashShape(KNOBS.dashShape ?? '', '--dash-shape'))
        .map(([k, on]) => [DASH_SHAPE_SETTING_KEYS[k], on ? 'on' : 'off']);
    const UPGRADE_WINDOW_SETTING_KEY = 'moduleSettings.flashPanel.seedlingSolverUpgradeWindowWork';
    const GAME = 'seedling_playthrough';
    const RULES = `frontend/presets/${GAME}/AP_1/AP_1_rules.json`;
    const PRESET = JSON.parse(readFileSync(join(REPO, RULES), 'utf8'));
    // ⛓ --page=<build> (e.g. seedling_bot_ap_p4f) drives another staged build: the rules the page fetches name it
    const BUILD = arg('page', '') || process.env.SEEDLING_PAGE || '';
    const WASM_PAGE = BUILD ? `${BUILD}/game.html` : (slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '');
    if (!WASM_PAGE || !existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }
    const all = withStageFlags(readFileSync(arg('legs', ''), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)), STAGE_FLAGS);
    let pick = pickLegs(all, legSelectors(arg));
    if (SHARD) {
        const [i, n] = SHARD.split('/').map(Number);
        const mine = new Set(partitionLegs(pick, n, roomAreas(REPO))[i - 1].ids);
        pick = pick.filter((l) => mine.has(l.id));
        console.log(`SHARD ${SHARD}: ${pick.length} legs`);
    }
    const pages = orderLegs(pick, MODE, PAGE_LEGS);
    // the window, over the flattened order (pages kept)
    let n = 0;
    const windowed = pages.map((p) => p.filter(() => { const keep = n >= FROM && n < FROM + LIMIT; n += 1; return keep; })).filter((p) => p.length);
    if (STAGE_FLAGS.size) console.log(`STAGE-FLAGS: ${[...STAGE_FLAGS].map(([k, f]) => `${k} => ${f.map((x) => x.eventId).join(',')}`).join(' | ')} (measurement only)`);
    if (STAGE_MUTANT) console.log(`TEST-ONLY: SWEEP_STAGE_MUTANT=${STAGE_MUTANT} (the staging is requested, never written)`);
    if (INJECT.length || !BOUND_ON) console.log(`TEST-ONLY: SWEEP_INJECT_HANG=${JSON.stringify(INJECT)} SWEEP_HANG_BOUND=${BOUND_ON ? 'on' : 'off'}`);
    if (LEG_BUDGET !== LEG_BUDGET_MS_DEFAULT) {
        const { SOLVE_BACKSTOP_MS } = await import('../../frontend/modules/seedlingDemo/jsRuntimeSolver.js');
        console.log(`LEG-BUDGET: ${LEG_BUDGET} ms per leg (--leg-budget-ms; default ${LEG_BUDGET_MS_DEFAULT}); the leg hang bound `
            + `${BOUNDS.leg / 1000} s; the solver's own backstop ${SOLVE_BACKSTOP_MS / 1000} s per solve (a named failure)`
            + `${LEG_BUDGET > SOLVE_BACKSTOP_MS ? '' : ' — NOT reachable by one solve inside this budget'}`);
    }
    console.log(`INFO: mode ${MODE}: ${windowed.reduce((a, p) => a + p.length, 0)} legs in ${windowed.length} page(s) (of ${all.length} legs)`);
    // ⛔ a FRESH BROWSER per page: a second page in the same browser never reached 'ready' (measured, the trial)
    let browser = null;
    let reported = new Set();
    const emit = (row) => {
        reported.add(row.id);
        // ⛓ THE LEG BUDGET'S STAMP — every row, whatever its end (byte-identical at the default)
        // ⛓ FREEZE LATCH (§5.89) — a throttled (measurement-only) run says so on every row
        if (CPU_THROTTLE) row = { ...row, cpuThrottle: CPU_THROTTLE };
        // ⛓ MEMORY PROBE — a probed (measurement-only) run says so on every row
        if (MEM_PROBE) row = { ...row, memoryProbeMs: MEM_PROBE, ...memoryArmStamp(MEM) };
        const line = JSON.stringify(stampSolverKnobs(stampBudget(row, LEG_BUDGET), KNOBS));
        console.log(`ROW ${line.length > 600 ? `${line.slice(0, 600)}…` : line}`);
        if (OUT) appendFileSync(OUT, `${line}\n`);
    };
    let pageNo = 0;
    let times = {};
    let current = null;
    /** One harness step of this page, under its bound (an injected hang: the step never resolves). */
    const step = async (name, work) => {
        const t0 = Date.now();
        const injected = INJECT.some((x) => x.page === pageNo && x.step === name);
        const v = await bounded(name, BOUNDS[name], injected ? () => new Promise(() => {}) : work, { enabled: BOUND_ON });
        times[name] = (times[name] ?? 0) + (Date.now() - t0);
        return v;
    };
    for (const legs of windowed) {
        pageNo += 1;
        reported = new Set();
        times = {};
        current = null;
        let launching = null;
        try {
            // eslint-disable-next-line no-await-in-loop
            browser = await step('launch', () => (launching = chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS })));
            // eslint-disable-next-line no-await-in-loop
            await runPage(legs, pageNo);
            // eslint-disable-next-line no-await-in-loop
            await step('browserClose', () => browser.close());
            console.log(`RECYCLE: page ${pageNo}: ${['launch', 'newPage', 'pageClose', 'browserClose'].map((k) => `${k} ${times[k] ?? '-'} ms`).join(', ')}`);
        } catch (e) {
            if (!(e instanceof SweepHang)) throw e;
            const lost = legs.filter((l) => !reported.has(l.id));
            console.log(`HANG: page ${pageNo} ${e.step} exceeded ${e.ms / 1000} s${current ? ` (leg ${current.leg.id})` : ''} — the browser SIGKILLed; lost=${lost.map((l) => l.id).join(',') || 'none'}`);
            killBrowser(browser);
            // a launch that resolves after its bound: that browser is killed too
            launching?.then(killBrowser, () => {});
            for (const leg of lost) {
                emit(hangRow(leg, { mode: MODE, producer: PRODUCER, page: pageNo, pageLeg: legs.indexOf(leg), step: e.step, ms: e.ms,
                    started: current?.leg === leg }));
            }
        }
        browser = null;
    }
    console.log('INFO: sweep done');
    process.exit(0);

    /** SIGKILL the browser's process GROUP (Playwright launches it detached), then the process itself. */
    function killBrowser(b) {
        const pid = b?.process?.()?.pid;
        if (!pid) return;
        try { process.kill(-pid, 'SIGKILL'); } catch { /* no group */ }
        try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ }
    }

    async function runPage(legs, pageNo) {
        const page = await step('newPage', () => browser.newPage({ viewport: { width: 1400, height: 900 } }));
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const rp = createRoomPlay({ page, wasmPage: WASM_PAGE, logs, name: `div-${MODE}-${pageNo}` });
        // ⛓ only a build OTHER than the preset's is routed. ⛔ And a response that is not the rules JSON passes
        // through untouched: the glob also matches a fetch the server answers with an HTML 404, and `r.json()` on it
        // threw out of the handler and killed every shard of CI run 37376313790 in 0.5 s.
        if (BUILD && WASM_PAGE !== slotBlockOf(PRESET, 'flash_panel')?.wasm) {
            await page.route(`**/presets/${GAME}/AP_1/AP_1_rules.json`, async (route) => {
                const r = await route.fetch();
                let doc = null;
                try { doc = r.ok() ? JSON.parse(await r.text()) : null; } catch { doc = null; }
                if (!doc) { await route.fulfill({ response: r }); return; }
                await route.fulfill({ response: r, json: withSlotBlock(doc, 'flash_panel', { wasm: WASM_PAGE }) });
            });
        }
        // ⛓ MEMORY PROBE `live-objects` arm — the served glue JS keeps `swf_perf_report`'s live counts (measurement only)
        if (MEM.liveObjects) {
            await page.route(`**/flashPanel/wasm/${WASM_PAGE.split('/')[0]}/*.js`, async (route) => {
                const r = await route.fetch();
                if (/swf_bridge_avm2\.js$/.test(route.request().url())) { await route.fulfill({ response: r }); return; }
                const js = withLiveObjects(await r.text());
                console.log(`MEMPROBE: live-objects ${js ? 'kept' : 'NOT kept (the token moved)'} in ${route.request().url().split('/').pop()}`);
                if (js) await route.fulfill({ response: r, body: js }); else await route.fulfill({ response: r });
            });
        }
        const tb = Date.now();
        let booted = false;
        let bootErr = null;
        for (let attempt = 1; attempt <= 2 && !booted; attempt++) try { await step('boot', async () => {
            if (attempt > 1) await page.goto('about:blank');
            await page.goto(`${HOST}/frontend/?rules=./presets/${GAME}/AP_1/AP_1_rules.json`, { waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            if (CONTACT) {
                await page.evaluate(async (writes) => {
                    const { default: settingsManager } = await import('./app/core/settingsManager.js');
                    for (const [key, value] of writes) await settingsManager.updateSetting(key, value);
                }, Object.entries(CONTACT_SETTING_KEYS).map(([k, key]) => [key, CONTACT[k]]));
            }
            if (AXE_DODGE) {
                await page.evaluate(async ([key, value]) => {
                    const { default: settingsManager } = await import('./app/core/settingsManager.js');
                    await settingsManager.updateSetting(key, value);
                }, [AXE_DODGE_SETTING_KEY, AXE_DODGE]);
            }
            // ⛓ THE SOLVER KNOBS — the panel settings, written before the panel boots (absent = untouched)
            const knobWrites = [...(KNOBS.upgradeWindowWork !== null ? [[UPGRADE_WINDOW_SETTING_KEY, KNOBS.upgradeWindowWork]] : []),
                ...(KNOBS.dashOnlyWindow !== null ? [[DASH_ONLY_WINDOW_SETTING_KEY, KNOBS.dashOnlyWindow]] : []),
                ...DASH_SHAPE_WRITES];
            if (knobWrites.length) {
                await page.evaluate(async (writes) => {
                    const { default: settingsManager } = await import('./app/core/settingsManager.js');
                    for (const [key, value] of writes) await settingsManager.updateSetting(key, value);
                }, knobWrites);
            }
            await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            await rp.waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)), 180000);
            await rp.waitFor('start button enabled', () => rp.gameFrame().evaluate(() => {
                const b = document.getElementById('btn-start');
                return !!b && !b.disabled;
            }), 180000);
            await rp.gameFrame().click('#btn-start', { timeout: 120000 });
            await assertLogicOnlyChannel(rp.gameFrame());
            await rp.waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
                document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);
            await rp.waitFor('the AP load finished (the delivered set + the name map)', () => page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                const s = p?.seedlingPlaybackSurface?.();
                return !!(p?._apLoadResult && s?.atlas && s?.wasm?.deliveredSet);
            }), 120000);
            await page.waitForTimeout(1500);
            // ⛓ CONTACT HOOK — the set the panel's (shared) module instance holds, read back
            const contactNow = await page.evaluate(async () => {
                const { CONTACT_FIDELITY } = await import('./modules/seedlingDemo/contactFidelity.js');
                return { ...CONTACT_FIDELITY };
            });
            console.log(`CONTACT: page ${pageNo}: ${formatContactFidelity(contactNow)}${CONTACT ? ' (--contact-fidelity)' : ''}`);
            if (CONTACT && formatContactFidelity(contactNow) !== formatContactFidelity(CONTACT)) {
                throw new Error(`--contact-fidelity asked ${formatContactFidelity(CONTACT)}; the page holds ${formatContactFidelity(contactNow)}`);
            }
            // ⛓ AXE_DODGE HOOK — the value the panel hands its wasm engine (applied to the engine's model at each solve),
            // and the model's own default, read back
            const axeNow = await page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                const { AXE_DODGE_ASK_PER_PREVIEW_DEFAULT } = await import('./modules/seedlingDemo/axeDodgeAskHook.js');
                return { setting: p?.seedlingPlaybackSurface?.()?.wasm?.axeDodgeAskPerPreview ?? null,
                    modelDefault: AXE_DODGE_ASK_PER_PREVIEW_DEFAULT };
            });
            console.log(`AXE_DODGE: page ${pageNo}: setting ${axeNow.setting} (model default ${axeNow.modelDefault ? 'on' : 'off'})`
                + `${AXE_DODGE ? ' (--axe-dodge)' : ''}`);
            if ((AXE_DODGE ?? 'default') !== axeNow.setting) {
                throw new Error(`--axe-dodge asked ${AXE_DODGE ?? 'default'}; the panel holds ${axeNow.setting}`);
            }
            // ⛓ THE SOLVER KNOBS — the values the panel hands its wasm engine (read at each solve), read back
            const knobNow = await page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                const s = p?.seedlingPlaybackSurface?.();
                return { window: s?.solverUpgradeWindowWork ?? null, dashOnly: s?.wasm?.dashOnlyWindow ?? null,
                    dashShape: s?.wasm?.dashShape ?? null };
            });
            console.log(`UPGRADE-WINDOW: page ${pageNo}: setting ${knobNow.window ?? 'unset (the engine\'s own)'}`
                + `${KNOBS.upgradeWindowWork !== null ? ' (--upgrade-window-work)' : ''}`);
            if (KNOBS.upgradeWindowWork !== null && knobNow.window !== KNOBS.upgradeWindowWork) {
                throw new Error(`--upgrade-window-work asked ${KNOBS.upgradeWindowWork}; the panel holds ${knobNow.window}`);
            }
            console.log(`DASH_ONLY_WINDOW: page ${pageNo}: setting ${knobNow.dashOnly}${KNOBS.dashOnlyWindow ? ' (--dash-only-window)' : ''}`);
            if ((KNOBS.dashOnlyWindow ?? 'default') !== knobNow.dashOnly) {
                throw new Error(`--dash-only-window asked ${KNOBS.dashOnlyWindow ?? 'default'}; the panel holds ${knobNow.dashOnly}`);
            }
            // ⛓ DASH-SHAPE STAMP — the three dash settings the panel hands its wasm engine, read back as one spec
            const shapeNow = knobNow.dashShape ? dashShapeSpec(knobNow.dashShape) : null;
            console.log(`DASH_SHAPE: page ${pageNo}: setting ${shapeNow === null ? 'unread' : shapeNow || 'default'}`
                + `${KNOBS.dashShape ? ' (--dash-shape)' : ''}`);
            if ((KNOBS.dashShape ?? '') !== (shapeNow ?? '') || shapeNow === null) {
                throw new Error(`--dash-shape asked ${KNOBS.dashShape ?? 'default'}; the panel holds ${shapeNow ?? 'nothing (unread)'}`);
            }
            await page.evaluate(async () => {
                const { createLab } = await import('/scripts/procgen/seedlingDivergenceLab.js');
                window.__div = await createLab();
            });
            booted = true;
        }); } catch (e) {
            if (e instanceof SweepHang) throw e;
            bootErr = e;
            console.log(`FAIL: page ${pageNo} boot (attempt ${attempt}): ${e.message.split('\n')[0]}`);
            console.log(logs.filter((l) => !/initialState|testLogic|Test discovery/.test(l)).slice(-8).join('\n'));
        }
        if (!booted) {
            for (const leg of legs) emit({ id: leg.id, mode: MODE, page: pageNo, ...stamp(leg), end: 'page-boot-failed', error: String(bootErr?.message).slice(0, 300) });
            await step('pageClose', () => page.close());
            return;
        }
        const peek = await step('boot', async () => {
        if (DUMP && pageNo === 1) {
            // the rooms the game PLAYS (the vanilla arm's delivered set) + the name → cell map, for the node bare pass
            const d = await page.evaluate(() => {
                const s = window.__div.surface();
                // ⛓ EVENT GOALS — and the events, each with its `side` region's level (the arrival `atlasEventGoal` reads)
                const regions = s.atlas.regions instanceof Map ? s.atlas.regions : new Map(Object.entries(s.atlas.regions ?? {}));
                const events = (s.atlas.events ?? []).map((e) => ({ ...e, sideLevel: regions.get(e.side)?.level ?? null }));
                return JSON.stringify({ deliveredSet: s.wasm.deliveredSet, entries: s.atlas.entries, refused: s.atlas.refused, events });
            });
            writeFileSync(DUMP, d);
            console.log(`INFO: dumped the delivered set + the name map → ${DUMP}`);
        }
        return page.evaluate(() => JSON.parse(JSON.stringify(window.__div.peek())));
        });
        console.log(`INFO: page ${pageNo} booted in ${Math.round((Date.now() - tb) / 1000)} s; botStatus fields: ${Object.keys(peek.status ?? {}).join(',')}`);
        if (CPU_THROTTLE) {
            await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
            console.log(`CPU-THROTTLE: page ${pageNo}: ${CPU_THROTTLE}x from here (measurement only; every row stamped cpuThrottle)`);
        }
        // ⛓ MEMORY PROBE — the call counter (once per page) and the parent's JS heap channel; off = neither exists
        const memCdp = MEM_PROBE ? await page.context().newCDPSession(page) : null;
        if (MEM_PROBE) {
            await memCdp.send('Performance.enable');
            const counted = await page.evaluate(() => window.__div.installCallCounter());
            console.log(`MEMPROBE: page ${pageNo}: every ${MEM_PROBE} ms (measurement only; rows stamped memoryProbeMs); call counter ${counted ? 'on' : 'NOT installed'}`
                + `${HIT_SAMPLE ? `; SPLIT ARM: the lab's hit sampler every ${HIT_SAMPLE} ms (not 25; rows stamped hitSampleMs)` : ''}`);
        }
        const granted = [];
        let swaps = 0;
        for (const [i, leg] of legs.entries()) {
            const row = { id: leg.id, key: leg.key ?? null, mode: MODE, producer: PRODUCER, page: pageNo, pageLeg: i, level: leg.level,
                arrive: [leg.arrive.x, leg.arrive.y], goal: leg.goal.name, kind: leg.goal.kind, sphere: leg.sphere?.label ?? null, ...stamp(leg) };
            // ⛔ an arrival needing a game_state event the jump would not stage: named, never run
            if (leg.skip) {
                emit({ ...row, end: 'skipped', skip: leg.skip, events: leg.arrive.events ?? [] });
                continue;
            }
            console.log(`LEG ${leg.id} start (page ${pageNo}, pageLeg ${i})`);
            current = { leg };
            // ⛓ L74 SILENT STALL — the page's uncaught errors DURING this leg go on its row (CI sweep 38185510484: three
            // pageerrors, a throw that killed the engine's timer chain, and a row that said only `timeout`).
            const logMark = logs.length;
            // ⛓ MEMORY PROBE — sampled from before the grants/jump (the room build) to the leg's end
            let arm = null;
            const mem = createMemorySampler({ intervalMs: MEM_PROBE, read: async () => ({ ...(await memoryRead(page, memCdp, rp)), ...(arm ? { arm } : {}) }),
                onSample: (x) => console.log(formatMemorySample(leg.id, x)) });
            const calls0 = MEM_PROBE ? await page.evaluate(() => window.__div.callCounts()).catch(() => null) : null;
            mem.start();
            /** ⛓ MEMORY PROBE — stop the leg's sampler; its summary on the row, its curve in --memory-out (off: nothing). */
            const finishMemory = async () => {
                if (!MEM_PROBE) return;
                const { samples, stats } = await mem.stop();
                const calls1 = await page.evaluate(() => window.__div.callCounts()).catch(() => null);
                row.memory = { ...summarizeMemory(samples), sampler: stats, callsBy: callDelta(calls0, calls1) };
                if (MEM_OUT) appendFileSync(MEM_OUT, `${JSON.stringify({ id: leg.id, key: leg.key ?? null, intervalMs: MEM_PROBE, samples })}\n`);
            };
            // eslint-disable-next-line no-await-in-loop
            try { await step('leg', async () => {
                // ⛔ THE CLEAN START (planner-3's trace, 2026-10-05): the game's `Inventory.items` is STATIC and
                // append-only for the session — an item an earlier leg PICKED UP stays in the game for every later leg
                // on the page (legs 174/184 held the sword with a granted set of []). So the game's held items are read
                // BEFORE the grants; on a fresh page (`--page-legs=1`, CI's default) they must be empty, else the leg
                // fails BY NAME (`dirty-start`) and runs nothing.
                // eslint-disable-next-line no-await-in-loop
                const before = await page.evaluate(() => window.__div.heldItems());
                row.before = before;
                if (PAGE_LEGS === 1 && (before.slots.length || before.has.length)) {
                    row.end = 'dirty-start';
                    row.error = `the game already holds ${JSON.stringify(before)} before this leg's grants — not a clean start`;
                    throw Object.assign(new Error(row.error), { byName: true });
                }
                // ⛓ MEMORY PROBE arm `hold-l0` — the boot room frozen, sampled, released (measurement only)
                if (MEM.holdL0Sec) { arm = 'hold-l0'; await holdFor(MEM.holdL0Sec); arm = null; }
                if (MEM.quietL0Sec) {
                    arm = 'quiet-l0';
                    await page.evaluate(() => window.__div.setDropItems(true));
                    try { await holdFor(MEM.quietL0Sec); } finally { await page.evaluate(() => window.__div.setDropItems(false)); }
                    arm = null;
                }
                if (MODE === 'inv') {
                    const want = leg.sphere?.inventory ?? null;
                    const need = want ? multisetMinus(want, granted) : [];
                    for (const item of need) {
                        // eslint-disable-next-line no-await-in-loop
                        await page.evaluate(async (name) => {
                            const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
                            await proxy.addItemToInventory(name);
                        }, item);
                        granted.push(item);
                        // eslint-disable-next-line no-await-in-loop
                        await page.waitForTimeout(400);
                    }
                    row.granted = need;
                    row.holding = granted.length;
                    // what the game holds after the grants (the slot ORDER is the game's own: acquisition order)
                    // eslint-disable-next-line no-await-in-loop
                    row.after = await page.evaluate(() => window.__div.heldItems());
                }
                // ⚖ TEST-HARNESS STAGING ONLY: the arrival's gating flags, written by the game's own setter (see the head)
                if (leg.stagedEvents?.length) {
                    row.stagedEvents = leg.stagedEvents;
                    if (!STAGE_EVENTS) row.stagingDropped = true;
                    else {
                        // eslint-disable-next-line no-await-in-loop
                        row.staged = await stageEvents(leg.stagedEvents);
                        if (row.staged.missing.length) {
                            row.end = 'stage-failed';
                            row.error = `the game's persistence table never held ${JSON.stringify(row.staged.missing)} after Game.setPersistence`;
                            throw Object.assign(new Error(row.error), { byName: true });
                        }
                    }
                }
                // eslint-disable-next-line no-await-in-loop
                const landed = await rp.jumpSettled(leg.level, leg.arrive.x, leg.arrive.y);
                if (leg.stagedEvents?.length) {
                    // eslint-disable-next-line no-await-in-loop
                    row.stagedAfterJump = heldFlags(leg.stagedEvents, (await page.evaluate(() => window.__div.status()))?.persistence_cleared);
                }
                swaps += landed.jumps;
                row.landed = landed;
                // the Rng split at the arrival: the botStatus ECHO vs the live LATCH (the arrival staging reads the echo)
                // eslint-disable-next-line no-await-in-loop
                row.rngSplitAtArrival = await page.evaluate(() => window.__div.rngSplit());
                // ⛓ MEMORY PROBE arms `run-arrival` / `hold-arrival` — the arrival room run unheld, then frozen (measurement only)
                if (MEM.runArrivalSec) { arm = 'run-arrival'; await page.waitForTimeout(MEM.runArrivalSec * 1000); arm = null; }
                if (MEM.holdArrivalSec) { arm = 'hold-arrival'; await holdFor(MEM.holdArrivalSec); arm = null; }
                // eslint-disable-next-line no-await-in-loop
                const r = await page.evaluate((a) => window.__div.serveLeg(a).then((x) => JSON.parse(JSON.stringify(x))),
                    { leg, budgetMs: LEG_BUDGET, producer: PRODUCER, nameCut: LEG_BUDGET !== LEG_BUDGET_MS_DEFAULT,
                        ...(CAPTURE ? { captureRequests: true } : {}), ...(HIT_SAMPLE ? { hitSampleMs: HIT_SAMPLE } : {}) });
                // ⛓ REQUEST CAPTURE — off the row, into their own file
                const { requests, ...served } = r;
                if (CAPTURE) appendFileSync(CAPTURE, `${JSON.stringify({ id: leg.id, key: leg.key ?? null, requests: requests ?? [] })}\n`);
                Object.assign(row, served);
                swaps += (r.history ?? []).length;
            }); } catch (e) {
                if (e instanceof SweepHang) throw e;
                if (e.byName) { await finishMemory(); emit(row); current = null; continue; }
                row.end = 'probe-error';
                row.error = e.message.split('\n')[0].slice(0, 400);
                row.consoleTail = logs.slice(-12);
            }
            // eslint-disable-next-line no-await-in-loop
            await finishMemory();
            const pageErrors = logs.slice(logMark).filter((l) => l.startsWith('[pageerror]'));
            if (pageErrors.length) row.pageErrors = pageErrors.slice(0, 5).map((l) => l.slice(0, 400));
            const exits = logs.filter((l) => /heap_alloc|ExitStatus|out of memory/.test(l));
            if (exits.length) row.gameMemory = exits.slice(-3);
            row.swapsOnPage = swaps;
            emit(row);
            current = null;
            if (row.gameMemory) { console.log('INFO: the game ran out of memory — a fresh page for the rest'); break; }
        }
        console.log(`INFO: page ${pageNo}: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s), ~${swaps} swaps`);
        await step('pageClose', () => page.close());

        /** ⛓ MEMORY PROBE arms — freeze the game with its own `botHold("on")` for `sec` s, then release it. */
        async function holdFor(sec) {
            const on = await page.evaluate(() => window.__div.surface().wasm.getGame().botHold('on'));
            await page.waitForTimeout(sec * 1000);
            const off = await page.evaluate(() => window.__div.surface().wasm.getGame().botHold('off'));
            console.log(`MEMPROBE: held ${sec} s (botHold on → ${on}, off → ${off})`);
        }

        /** ⛓ MEMORY PROBE — one sample: the game frame's heap (no call into the game), the lab's read, the parent JS heap. */
        async function memoryRead(pg, cdp, roomPlay) {
            const [game, lab, metrics] = await Promise.all([
                roomPlay.gameFrame().evaluate(readGameMemoryInPage).catch((e) => ({ found: false, error: String(e?.message ?? e).slice(0, 80) })),
                pg.evaluate(() => window.__div.memoryRead()).catch((e) => ({ labError: String(e?.message ?? e).slice(0, 80) })),
                cdp.send('Performance.getMetrics').catch(() => null)]);
            const jsHeap = metrics?.metrics?.find((m) => m.name === 'JSHeapUsedSize')?.value ?? null;
            return { game, ...lab, jsHeap };
        }

        /** Write each flag through the game's own `Game.setPersistence(tag, false, level)`; poll the table for them. */
        async function stageEvents(flags) {
            if (STAGE_MUTANT !== 'skip-write') await rp.gameFrame().evaluate((fs) => {
                window.__swfBridge.queueItems(fs.map((f) => ({ invocation: 'method_call', path: [{ class: 'Game' }],
                    method: 'setPersistence', args: [f.tag, false, f.level] })));
            }, flags.map(({ level, tag }) => ({ level, tag })));
            let got = null;
            for (const t0 = Date.now(); Date.now() - t0 < 10000;) {
                // eslint-disable-next-line no-await-in-loop
                got = heldFlags(flags, (await page.evaluate(() => window.__div.status()))?.persistence_cleared);
                if (!got.missing.length) break;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(100);
            }
            return got;
        }
    }
}

/** Which of `flags` (`{level, tag}`) the game's `persistence_cleared` holds. */
export function heldFlags(flags, cleared) {
    const has = (f) => (cleared ?? []).some((c) => Number(c.level) === f.level && Number(c.tag) === f.tag);
    return { held: flags.filter(has).map((f) => f.eventId), missing: flags.filter((f) => !has(f)).map((f) => f.eventId) };
}

function multisetMinus(want, have) {
    const left = new Map();
    for (const h of have) left.set(h, (left.get(h) ?? 0) + 1);
    const out = [];
    for (const w of want) {
        const k = left.get(w) ?? 0;
        if (k > 0) left.set(w, k - 1); else out.push(w);
    }
    return out;
}
