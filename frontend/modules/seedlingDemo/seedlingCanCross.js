/**
 * seedlingDemo/seedlingCanCross — ⛓⛓⛓ SEEDLING FIDELITY CANCROSS: **THE SOLVER
 * AS AN ORACLE FOR DERIVED ITEM REQUIREMENTS.**
 *
 * ⚖ The user, 2026-10-04 (on L14): *"… we shouldn't hardcode it. We should
 * derive the requirements from what the solver can do."* The rules arc's
 * playthrough generator asks, per crossing and item set, *"can the bot cross
 * A → B starting with inventory I?"* and emits the minimal sets. This module is
 * that question as ONE pure, deterministic, budgeted call over today's solver:
 *
 *     canCross({ level, exit | goal, inventory, arrival?, budget?, dashMode? })
 *       → { verdict, ms, why, cause, witness?, solver, arrival, budget, … }
 *
 * ── THE FOUR VERDICTS (the contract agreed with the rules arc) ─────────────
 *
 *   `can`           `solveSegment` returned, the run crossed to the exit's level
 *                   with no death; `witness` is the plan as a committed-format
 *                   tape body (`buildStagedTape`), replayed through the model.
 *   `cannot`        a `SolverRefusal` that is a TRUE refusal: the ladder
 *                   exhausted, no corridor, an item gate. Only this class says no.
 *   `undecided`     the budget tripped (SF2's `shouldStop`, `e.deadline`), a
 *                   search BOUND ended it (`MAX_ROUTE_EXPANSIONS`/`_ORDERS`, the
 *                   DETOUR rung's preview/leg bounds, `STRIKE_BOUND_EXHAUSTED`),
 *                   a pending declaration, or the solver failed (`SolverBotError`).
 *                   ⛔ A TIMEOUT IS NEVER `cannot`.
 *   `model-refused` the MODEL refused the state (an unmodelled weapon arm, an
 *                   undeclared clock under a spinner …): neither can nor cannot.
 *
 * `cause` says which arm and on what BASIS: `field` (the error's own fields —
 * `e.deadline`, `e.code`, the class) or `prose` (⚠ two bounds exist only in a
 * message today: the block-route search's `hit \`MAX_ROUTE_…\`` and the DETOUR
 * rung's `… candidate(s) left unasked`; both are matched on the solver's own
 * fixed words and named as a gap rather than hidden).
 *
 * `dashMode` defaults to the solver's `all` (`CAN_CROSS_DASH_MODE`): it was `none`
 * after the game refuted L16's `all` plan (CANCROSS D3), and returned to `all` when
 * DASHFLIP turned the game's dash window on (every `all` plan measured there is a
 * game-recorded walk).
 *
 * ── DETERMINISTIC BY DEFAULT ───────────────────────────────────────────────
 *
 * The default budget is a COUNTER of `shouldStop` consults across every
 * `DEADLINE_SITES` site, so a call gives the same verdict on any machine. A
 * counter ignores the site, so once it trips every site is refused from that
 * instant (SF2's latch). `budget: { ms }` is the interactive wall clock and the
 * result says `deterministic: false`. `budget: null` passes no hook at all —
 * the solve is the committed one byte for byte.
 *
 * ── THE ARRIVAL, WITHOUT A LIVE CAPTURE ────────────────────────────────────
 *
 * `arrival` is one of:
 *   `{ from: <level> }`    the door the game itself lands you by: the link in
 *                          level `from` whose `to` is this level, at its own
 *                          `(playerx, playery)` (`Teleporter.check`'s write);
 *   `{ x, y }`             a spawn, stated;
 *   `{ staging }`          a whole staging block (a captured live arrival,
 *                          `wasmArrival.stagingFromWasmArrival`), used as given
 *                          except that a stated `inventory` replaces its items.
 * A built arrival takes every field the model READS (`SEAM_BOOT_SPEC`'s
 * `modelled` rows plus `persistence`, `save`, `rng`) as an explicit input, and
 * every one left at its default is listed in `arrival.assumed`, so a derived
 * rule records what it assumed. ⛔ Never a silent divergence: `time` left
 * undeclared makes the model's clock answer null and a spinner's hammer then
 * refuses BY NAME (`model-refused`), rather than billing a guessed phase.
 *
 * ── THE STAMP ──────────────────────────────────────────────────────────────
 *
 * `solver` is an md5 over the static import closure of `solverBot.js` and
 * `tapeRunner.js` (every module the solve and the model read) plus the atlas
 * and this file. A derived rule that records it reads as STALE after any of
 * those changes, rather than drifting silently.
 *
 * ⚠ NODE-ONLY (it hashes source files and reads the committed atlas), like
 * `levelSource.js`. Read-only over `solveSegment`, `createRunForStaging`,
 * `stagingFromWasmArrival`: no signature or behaviour of theirs changes.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildStagedTape } from './botDriverV1.js';
import { ATLAS_PATH, atlasLevelSource } from './levelSource.js';
import {
    DEFAULT_DASH_MODE, PendingDeclaration, SolverBotError, SolverRefusal,
    STRIKE_BOUND_EXHAUSTED, assertDashMode, solveSegment,
} from './solverBot.js';
import { ITEM_PROPERTIES, PIN_NAMES, parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape } from './tapeRunner.js';
import { arrivalSolverGoal } from './wasmArrival.js';

/** A request this oracle cannot ask — by name, never rounded to a verdict. */
export class CanCrossError extends Error {
    constructor(message) { super(message); this.name = 'CanCrossError'; }
}
const bad = (why) => { throw new CanCrossError(`canCross: ${why}`); };

export const VERDICTS = Object.freeze(['can', 'cannot', 'undecided', 'model-refused']);

/**
 * The default deterministic budget, in `shouldStop` consults.
 *
 * ⚠ CALIBRATED, not derived. Measured over 116 calls (every captured arrival in
 * both captures × both dash modes, and every door of L15/L16/L71 from every
 * neighbour with nine items × both modes): the largest count is **1,807** (L71
 * from L75 toward `teleporter@16,304`, nine items, `all`, a `cannot` after
 * 16 s); swordless L14's DETOUR solve is 492. This is ~2.8× the largest, so no
 * measured `can` or `cannot` reads as `undecided` by default. A caller deriving
 * at scale may pass a smaller one.
 */
export const DEFAULT_CONSULT_BUDGET = 5000;

/**
 * ⛓ THE ORACLE'S DEFAULT DASH MODE IS THE SOLVER'S (`solverBot.DEFAULT_DASH_MODE`,
 * `all`) — again, since SEEDLING FIDELITY DASHFLIP.
 *
 * WHY IT WAS `none` (CANCROSS D3): L16 → L17 with the Sword, `all` planned 111 t
 * (`5b1f924b52`) and the game REFUTED it — hit at t104 — while the `none` plan
 * (206 t, `0c36d853aa`, `cancross-l16-sword-none`) reproduced. The DASH slice
 * found the cause in the model (a dash buys four hit tests in the game, the model
 * ran five) and DASHFLIP turned the game's window on.
 *
 * WHY IT IS `all` NOW, MEASURED at the flip: L16 → L17 `all` plans 117 t
 * (`12575cff30`), key for key the game-recorded `dash-l16-sword-all`; and every
 * other sword door in CANCROSS's fresh-vs-live table (L3 → 2, L2 → 0, L0 → 13,
 * L13 → 14, L14 → 15, L15 → 16) plans, under `all`, the committed campaign
 * window's own inputs (`r9-solve-3`, `-2`, `-0`, `-13`, `-14`, `-15`), each
 * recorded on the game. The `none` plans are game-witnessed only at L16. A
 * `can` is a claim about the game, so the oracle asks the family with the
 * game's agreement; `dashMode: 'none'` stays one argument away.
 */
export const CAN_CROSS_DASH_MODE = DEFAULT_DASH_MODE;

/** Inventory names → the `seam.items` property each sets (`tapeFormat.ITEM_PROPERTIES`). */
export const INVENTORY_NAMES = Object.freeze(Object.keys(ITEM_PROPERTIES)
    .filter((n) => ITEM_PROPERTIES[n].kind === 'boolean'));

/** The link types a door arrival is read from (`seedlingReturnSpawns.RETURN_LINK_TYPES`). */
const LINK_TYPES = Object.freeze(['teleporter', 'stairsup', 'stairsdown']);

const linksOf = (record) => (record?.entities ?? []).filter((e) => LINK_TYPES.includes(e.type));

/** The `seam.items` block for an inventory list, every flag stated. */
function itemsFor(inventory) {
    const items = Object.fromEntries(INVENTORY_NAMES.map((n) => [ITEM_PROPERTIES[n].property, false]));
    for (const name of inventory) {
        if (!INVENTORY_NAMES.includes(name)) {
            bad(`unknown inventory item \`${name}\` — the names are ${INVENTORY_NAMES.join(', ')} `
                + '(`tapeFormat.ITEM_PROPERTIES`; `health` is `hitsMax`, its own input)');
        }
        items[ITEM_PROPERTIES[name].property] = true;
    }
    return items;
}

/**
 * The spawn the game puts the player at on entering `level` through the door
 * from `from`: that link's own `(playerx, playery)`. Refused by name when level
 * `from` has no link to `level`, or more than one landing in different places.
 */
export function doorArrival(levelSource, level, from) {
    const links = linksOf(levelSource(from)).filter((e) => Number(e.attrs?.to) === level);
    const spots = [...new Map(links.map((e) => [`${e.attrs.playerx},${e.attrs.playery}`, e])).values()];
    if (spots.length === 0) {
        bad(`level ${from} has no door to level ${level} (its links go to `
            + `${linksOf(levelSource(from)).map((e) => e.attrs?.to).join(', ') || 'nowhere'}) — `
            + 'state the spawn as `arrival: {x, y}`');
    }
    if (spots.length > 1) {
        bad(`level ${from} has ${spots.length} doors to level ${level} landing in different places `
            + `(${spots.map((e) => `(${e.attrs.playerx},${e.attrs.playery})`).join(', ')}) — `
            + 'state the spawn as `arrival: {x, y}`');
    }
    const door = spots[0];
    return { x: Number(door.attrs.playerx), y: Number(door.attrs.playery),
        via: { level: from, type: door.type, x: door.x, y: door.y } };
}

/**
 * A live-LIKE staging block built WITHOUT a capture. Every field the model reads
 * is an input; the ones left at their default are returned in `assumed`.
 *
 * @returns {{staging: object, assumed: string[], spawn: object}}
 */
export function buildArrivalStaging({
    level, arrival, inventory = [], primary, hitsMax, time, persistence, save, rng, cutscene,
    beam, rockSet, levelSource,
}) {
    if (!Number.isInteger(level)) bad('`level` must be an integer level number');
    const assumed = [];
    const def = (v, d, name) => {
        if (v !== undefined) return v;
        assumed.push(name);
        return d;
    };
    let spawn;
    if (arrival && Number.isInteger(arrival.from)) spawn = doorArrival(levelSource, level, arrival.from);
    else if (arrival && Number.isFinite(arrival.x) && Number.isFinite(arrival.y)) {
        spawn = { x: arrival.x, y: arrival.y, via: null };
    } else {
        bad('a built arrival needs `arrival: {from: <level>}` (the door the game lands you by) '
            + 'or `arrival: {x, y}` — there is no default spawn');
    }
    const staging = {
        boot: { level, x: spawn.x, y: spawn.y },
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        // ⚠ "nothing cleared" is the first-visit state; a revisit must say what it cleared.
        persistence: def(persistence, [], 'persistence (nothing cleared)'),
        despawn: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: def(save, { totem_parts: [], keys: [], seal_parts: [] }, 'save (no keys, totem or seal parts)'),
        // `{seed: 0, split: false}` is what a pre-v7 tape means; only the Owl (L112)
        // reads the stream, and it refuses an unsplit one by name.
        rng: def(rng, { seed: 0, split: false }, 'rng (seed 0, unsplit: only the Owl, L112, reads it)'),
        seam: {
            items: itemsFor(inventory),
            beam: def(beam, false, 'beam (false)'),
            rock_set: def(rockSet, false, 'rockSet (false)'),
            hits_max: def(hitsMax, 3, 'hitsMax (3)'),
            // ⛔ An ABSENT `time` is undeclared (`parseSeam` skips it; 0 is refused):
            // the model's clock answers null and a spinner's hammer refuses by name.
            ...(def(time, undefined, 'time (undeclared: a spinner\'s hammer refuses by name)') === undefined
                ? {} : { time }),
            primary: def(primary, 0, 'primary (slot 0)'),
            secondary: 0,
            cutscene: def(cutscene, [false, false, false, false], 'cutscene (none)'),
            menu_state: 0,
        },
    };
    return { staging, assumed, spawn };
}

/** A captured staging with a stated inventory: the items replaced, nothing else. */
function stagingWithInventory(staging, inventory, primary) {
    const copy = JSON.parse(JSON.stringify(staging));
    if (inventory !== undefined) copy.seam = { ...copy.seam, items: itemsFor(inventory) };
    if (primary !== undefined) copy.seam = { ...copy.seam, primary };
    return copy;
}

// ── the stamp ───────────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = resolve(HERE, '..');
const IMPORT_RE = /(?:^|[\s;])(?:import|export)\s[^'"`]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

/** The static (and literal dynamic) relative import closure of `roots`. */
export function importClosure(roots) {
    const seen = new Set();
    const queue = roots.map((r) => resolve(r));
    while (queue.length > 0) {
        const file = queue.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        const text = readFileSync(file, 'utf8');
        for (const m of text.matchAll(IMPORT_RE)) {
            const spec = m[1] ?? m[2];
            if (!/\.(m?js|json)$/.test(spec)) continue;
            const target = resolve(dirname(file), spec);
            if (!seen.has(target) && target.startsWith(MODULES)) queue.push(target);
        }
    }
    return [...seen].sort();
}

let stampCache = null;
/**
 * The solver's identity: an md5 over (path, md5) of every file the solve reads.
 * @returns {{id: string, files: number, roots: string[]}}
 */
export function solverStamp() {
    if (stampCache) return stampCache;
    const roots = ['solverBot.js', 'tapeRunner.js', 'seedlingCanCross.js'].map((f) => join(HERE, f));
    const files = [...importClosure(roots), resolve(ATLAS_PATH)];
    const h = createHash('md5');
    for (const f of files) {
        h.update(`${relative(MODULES, f)}\0${createHash('md5').update(readFileSync(f)).digest('hex')}\n`);
    }
    stampCache = { id: h.digest('hex'), files: files.length,
        roots: roots.map((r) => relative(MODULES, r)) };
    return stampCache;
}

// ── classification ──────────────────────────────────────────────────────────

/** The DETOUR rung's bound arm, in its own fixed words (`deriveChaserDetour`'s `why`). */
const DETOUR_BOUND_RE = /preview\(s\) of the (\d+) bound spent and (\d+) leg\(s\) of the (\d+) planned, (\d+) candidate\(s\) left unasked/;
/** The block-route search's bound arm (`hit \`<bound>\``), deadline excluded — that one has a field. */
const ROUTE_BOUND_RE = /block-route search for \S+ .*?hit `(MAX_ROUTE_EXPANSIONS|MAX_ROUTE_ORDERS)`/s;
/** JS's own error classes are DEFECTS, never a verdict. */
const DEFECTS = [TypeError, ReferenceError, RangeError, SyntaxError, EvalError, URIError];

/**
 * An error → `{verdict, cause}`. Fields first; prose only where no field exists.
 * Returns null for a defect (the caller rethrows).
 */
export function classifyError(e) {
    const message = String(e?.message ?? e);
    if (DEFECTS.some((C) => e instanceof C)) return null;
    if (e instanceof SolverRefusal) {
        if (e.deadline) {
            return { verdict: 'undecided', cause: { kind: 'budget', basis: 'field', deadline: e.deadline } };
        }
        if (e instanceof PendingDeclaration) {
            return { verdict: 'undecided', cause: { kind: 'pending-declaration', basis: 'field',
                pending: e.pending ?? null } };
        }
        const route = message.match(ROUTE_BOUND_RE);
        if (route) return { verdict: 'undecided', cause: { kind: 'bound', basis: 'prose', bound: route[1] } };
        // ⚠ `considered` pairs each rung with the rung BELOW's reason (the
        // escalation shape), so the DETOUR rung's own words are the LAST `detour`
        // row; every `detour` row is read rather than trusting the label.
        const detour = (e.considered ?? []).filter((c) => c.option === 'detour')
            .map((c) => String(c.why ?? '').match(DETOUR_BOUND_RE)).find(Boolean);
        if (detour) {
            return { verdict: 'undecided', cause: { kind: 'bound', basis: 'prose', bound: 'DETOUR_RUNG',
                maxPreviews: Number(detour[1]), planned: Number(detour[2]), maxPlanned: Number(detour[3]),
                unasked: Number(detour[4]) } };
        }
        return { verdict: 'cannot', cause: { kind: 'refusal', basis: 'field', name: e.name,
            obstacle: e.obstacle ?? null } };
    }
    if (e instanceof SolverBotError) {
        if (e.code === STRIKE_BOUND_EXHAUSTED) {
            return { verdict: 'undecided', cause: { kind: 'bound', basis: 'field', bound: e.code,
                boundTicks: e.boundTicks } };
        }
        return { verdict: 'undecided', cause: { kind: 'solver-error', basis: 'field', code: e.code ?? null } };
    }
    if (e instanceof CanCrossError) return null;
    // Anything else the model threw is the model refusing the state, by name.
    return { verdict: 'model-refused', cause: { kind: 'model', basis: 'field', name: e?.name ?? 'Error' } };
}

// ── the oracle ──────────────────────────────────────────────────────────────

/**
 * Resolve `exit` (a destination level, or a door `{x, y}` in this level) to an
 * AP-shaped exit goal `arrivalSolverGoal` maps on the arrival's own run.
 */
function exitGoal(levelSource, level, exit) {
    const links = linksOf(levelSource(level));
    let doors;
    if (Number.isInteger(exit)) doors = links.filter((e) => Number(e.attrs?.to) === exit);
    else if (exit && Number.isFinite(exit.x) && Number.isFinite(exit.y)) {
        doors = links.filter((e) => e.x === exit.x && e.y === exit.y);
    } else bad('`exit` is a destination level number or a door `{x, y}`; or pass `goal`');
    if (doors.length !== 1) {
        bad(`level ${level} has ${doors.length} door(s) matching exit ${JSON.stringify(exit)} `
            + `(its links: ${links.map((e) => `${e.type}@${e.x},${e.y}→${e.attrs?.to}`).join(', ')}) — `
            + 'name the door as `{x, y}`');
    }
    const d = doors[0];
    return { ap: { kind: 'exit', level, tiles: [[Math.floor(d.x / 16), Math.floor(d.y / 16)]] },
        to: Number(d.attrs.to), door: { type: d.type, x: d.x, y: d.y } };
}

let atlasSource = null;
const defaultLevelSource = () => (atlasSource ??= atlasLevelSource());

/** A key-set list's md5 (the plan hash the fidelity reports print). */
export const planHash = (perTick) => createHash('md5')
    .update(perTick.map((h) => [...h].sort().join('+')).join('|')).digest('hex');

/**
 * Can the bot cross from the arrival to the exit with this inventory?
 *
 * @param {object} o
 * @param {number} o.level
 * @param {number|{x:number,y:number}} [o.exit]  destination level, or a door in `level`
 * @param {object} [o.goal]       a solver goal instead (`assertGoal`'s shape); `to` then optional
 * @param {number} [o.to]         with `goal`: the level a `can` must end in
 * @param {string[]} [o.inventory] item names (`INVENTORY_NAMES`); with `arrival.staging`, replaces its items
 * @param {object} [o.arrival]    `{from}` | `{x, y}` | `{staging}` (see the docblock)
 * @param {object|null} [o.budget] `{consults}` (default `DEFAULT_CONSULT_BUDGET`) | `{ms}` | `null` (no hook)
 * @param {string} [o.dashMode]  default `CAN_CROSS_DASH_MODE` (the solver's 'all', measured — see there)
 * @param {boolean} [o.witness]   build + replay the witness tape on `can` (default true)
 */
export function canCross(o) {
    const {
        level, exit, goal: givenGoal = null, to: givenTo = null, inventory, arrival = null,
        budget = { consults: DEFAULT_CONSULT_BUDGET }, dashMode = CAN_CROSS_DASH_MODE,
        primary, hitsMax, time, persistence, save, rng, cutscene, beam, rockSet,
        levelSource = defaultLevelSource(), name = 'can-cross', witness: wantWitness = true,
        scratchPersistence = true,
    } = o ?? {};
    assertDashMode(dashMode, 'canCross');
    if (!Number.isInteger(level)) bad('`level` must be an integer level number');

    // ── the arrival ──
    let staging;
    let assumed = [];
    let spawn;
    let source;
    if (arrival?.staging) {
        if (arrival.staging.boot?.level !== level) {
            bad(`the staging boots level ${arrival.staging.boot?.level}, the request names level ${level}`);
        }
        staging = stagingWithInventory(arrival.staging, inventory, primary);
        spawn = { x: staging.boot.x, y: staging.boot.y, via: null };
        source = 'staging';
    } else {
        ({ staging, assumed, spawn } = buildArrivalStaging({ level, arrival, inventory: inventory ?? [],
            primary, hitsMax, time, persistence, save, rng, cutscene, beam, rockSet, levelSource }));
        source = Number.isInteger(arrival?.from) ? 'door' : 'spawn';
    }
    staging.despawn = [];

    // ── the goal ──
    let goal;
    let to = givenTo;
    let door = null;
    let stepOff = null;
    if (givenGoal) goal = givenGoal;
    else {
        const ex = exitGoal(levelSource, level, exit);
        to = ex.to;
        door = ex.door;
        const mapped = arrivalSolverGoal(ex.ap, { staging, levelSource, record: levelSource(level) });
        if (mapped.walker) bad(mapped.walker);
        goal = mapped.goal;
        stepOff = mapped.stepOff ?? null;
    }
    const items = Object.entries(staging.seam?.items ?? {}).filter(([, v]) => v).map(([k]) => k);
    const result = {
        request: { level, exit: exit ?? null, to, goal, dashMode, inventory: inventory ?? null },
        arrival: { source, spawn, assumed, items, primary: staging.seam?.primary ?? 0 },
        solver: { ...solverStamp(), dashMode },
    };

    // ── the budget ──
    let consults = 0;
    let shouldStop = null;
    let deterministic = true;
    if (budget !== null) {
        if (Number.isFinite(budget.ms)) {
            deterministic = false;
            const at = performance.now() + budget.ms;
            shouldStop = () => { consults += 1; return performance.now() >= at; };
        } else {
            const limit = budget.consults ?? DEFAULT_CONSULT_BUDGET;
            if (!Number.isInteger(limit) || limit < 0) bad('`budget.consults` must be a non-negative integer');
            shouldStop = () => { consults += 1; return consults > limit; };
        }
    }
    const budgetOut = () => ({ ...(budget === null ? { kind: 'none' }
        : Number.isFinite(budget.ms) ? { kind: 'ms', ms: budget.ms }
            : { kind: 'consults', limit: budget.consults ?? DEFAULT_CONSULT_BUDGET }),
    consults, deterministic });

    if (stepOff) {
        return { ...result, verdict: 'undecided', ms: 0, budget: budgetOut(),
            why: `the arrival stands latched on the exit's own teleporter; the crossing is a step-off `
                + 'composite (`wasmWalkTape.stepOffSolveFromStaging`), which this oracle does not drive',
            cause: { kind: 'unsupported', basis: 'field', stepOff } };
    }

    const run = createRunForStaging(staging, levelSource, { scratchPersistence });
    const t0 = performance.now();
    let out;
    try {
        out = solveSegment({ run, goals: [{ ...goal }], name, boot: staging.boot, prefix: [], dashMode,
            ...(shouldStop ? { shouldStop } : {}) });
    } catch (e) {
        const ms = Math.round(performance.now() - t0);
        const c = classifyError(e);
        if (c === null) throw e;
        return { ...result, ...c, ms, budget: budgetOut(), why: String(e.message),
            ...(e.perTick ? { refusedTicks: e.perTick.length } : {}) };
    }
    const ms = Math.round(performance.now() - t0);
    const landed = run.transitions.at(-1)?.to_level ?? null;
    const facts = { ticks: out.perTick.length, hash: planHash(out.perTick).slice(0, 10),
        landed, deaths: run.playerDeaths.length, hits: run.playerHits.length,
        rungs: [...new Set((out.trace?.rows ?? []).map((r) => r.strategy?.rung).filter(Boolean))],
        ...(out.deadline ? { deadline: out.deadline } : {}) };
    if (facts.deaths > 0 || (to !== null && landed !== to)) {
        return { ...result, verdict: 'undecided', ms, budget: budgetOut(), plan: facts,
            why: `the solve returned but the run ${facts.deaths > 0 ? `died ${facts.deaths} time(s)` : ''}`
                + `${facts.deaths > 0 && landed !== to ? ' and ' : ''}`
                + `${to !== null && landed !== to ? `ended in level ${landed}, not ${to}` : ''} — `
                + 'a plan that does not cross is not a witness',
            cause: { kind: 'goal-not-observed', basis: 'field' } };
    }
    const res = { ...result, verdict: 'can', ms, budget: budgetOut(), plan: facts,
        why: `solved: ${facts.ticks} ticks${facts.rungs.length ? ` (rungs ${facts.rungs.join(', ')})` : ''}`
            + `${to !== null ? `, onto level ${landed}` : ''}, ${facts.hits} hit(s)`
            + `${out.deadline ? ` — the budget tripped at \`${out.deadline.first}\` and the plan is the one `
                + 'the remaining search found' : ''}`,
        cause: { kind: 'solved', basis: 'field' } };
    if (wantWitness) {
        // ⚠ The solver stamp is NOT in the words: a committed witness would then move on
        // every solver edit. The stamp rides on the result; the tape says what was asked.
        const about = `⛓ SEEDLING FIDELITY CANCROSS — a \`canCross\` witness: level ${level} → `
            + `${to ?? JSON.stringify(goal)}, inventory [${(inventory ?? items).join(', ') || '∅'}], arrival `
            + `${source === 'door' ? `the door from level ${arrival.from}` : source} at (${spawn.x},${spawn.y})`
            + `${assumed.length ? ` (assumed: ${assumed.map((a) => a.split(' ')[0]).join(', ')})` : ''}, `
            + `dashMode ${dashMode}: ${facts.ticks} ticks, ${facts.hits} hit(s). Written by `
            + 'scripts/procgen/can-cross-seedling.mjs --witness.';
        res.witness = witnessOf(staging, out.perTick, name, levelSource, to, scratchPersistence, about);
    }
    return res;
}

/**
 * The plan as a committed-format tape body, parsed and replayed through the
 * model: a certifier plays `tape` on the game (`check-seedling-bot-differential`).
 */
function witnessOf(staging, perTick, name, levelSource, to, scratchPersistence, about) {
    const tape = { ...buildStagedTape({ staging, perTick, name }), description: about };
    const parsed = parseTape(JSON.parse(JSON.stringify(tape)));
    const replay = runTape(parsed, { levelSource, scratchPersistence });
    const landed = replay.transitions.at(-1)?.to_level ?? null;
    return { tape, replayed: { observations: replay.ticks.length, landed,
        agrees: replay.ticks.length === perTick.length + 1 && (to === null || landed === to) } };
}

/**
 * D2's DERIVATION, as a call: every subset of `pool` asked with `canCross`, and
 * the minimal sets that `can`. NOT a rule — the rules arc emits rules; this is
 * the question it asks, so its caveats are visible in one place:
 *
 *  - a minimal set with an `undecided` or `model-refused` subset BELOW it is not
 *    proved minimal (`unprovedBelow`), never silently promoted;
 *  - ⛔ the solver's verdict is NOT monotone in the inventory (measured: L16 →
 *    `stairsup@352,80` from L15 is `can` with the Sword and `cannot` with the
 *    Sword and the Conch — swimming widens the planner's corridor onto a
 *    sandtrap and the ladder exhausts), so `cannot` supersets are reported
 *    (`nonMonotone`), not inferred away.
 *
 * @returns {{rows: Array<{set: string[], verdict: string, why: string}>,
 *            minimal: string[][], unprovedBelow: object, nonMonotone: string[][], solver: string}}
 */
export function deriveMinimalSets({ pool, ...request }) {
    const subsets = [[]];
    for (const it of pool) for (const sub of [...subsets]) subsets.push([...sub, it]);
    subsets.sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
    const rows = subsets.map((set) => {
        const r = canCross({ ...request, inventory: set, witness: false });
        return { set, verdict: r.verdict, why: r.verdict === 'can' ? r.why : `${r.cause.kind}: ${r.why.slice(0, 200)}`,
            consults: r.budget.consults, solver: r.solver.id };
    });
    const sub = (a, b) => a.length < b.length && a.every((x) => b.includes(x));
    const can = rows.filter((r) => r.verdict === 'can').map((r) => r.set);
    const minimal = can.filter((s) => !can.some((t) => sub(t, s)));
    const open = rows.filter((r) => r.verdict === 'undecided' || r.verdict === 'model-refused').map((r) => r.set);
    const unprovedBelow = Object.fromEntries(minimal.map((s) => [s.join('+') || '∅', open.filter((t) => sub(t, s))])
        .filter(([, v]) => v.length > 0));
    const nonMonotone = rows.filter((r) => r.verdict === 'cannot' && can.some((t) => sub(t, r.set))).map((r) => r.set);
    return { rows, minimal, unprovedBelow, nonMonotone, solver: rows[0].solver };
}
