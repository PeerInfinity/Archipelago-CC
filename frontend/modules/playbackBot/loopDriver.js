/**
 * Loop driver — the Playback Bot's planner for LOOP MODE (loop-mode-bot S2). Pure: no DOM, no eventBus, no
 * registry. The glue that reads the live game and writes the Loops queue lives with the bot.
 *
 * ⚖ The user's rulings (2026-10-11): the bot plays Loop mode by AUTHORING THE LOOPS QUEUE, one target per loop,
 * like the cost planner (`shared/procgen/loopCostPlanner.js`). Real discovery is RANDOM (each explore reveals one
 * random undiscovered location or exit of its region), so the bot explores until its target is found. It never
 * gives up. What a loop does when its target is not affordable yet is a SETTING (`MANA_STRATEGIES`).
 *
 * One call plans one loop:
 *   1. The target is the next unchecked location of the sphere log (the caller picks it).
 *   2. Route from the loop's start region to the target's region over ACCESSIBLE exits, preferring DISCOVERED ones.
 *      The queue can only move through a discovered exit, so the walk stops at the FRONTIER: the region whose next
 *      exit is not yet discovered (or the target's region, when the target itself is not yet discovered).
 *   3. All discovered → a CHECK loop (moves + the check). Otherwise an EXPLORE loop (moves + a repeating explore at
 *      the frontier; it ends when the mana does).
 *   4. The mana strategy decides what a loop that cannot afford its task does instead.
 *
 * Nothing here is game-specific: the topology comes in as callbacks over any rules.json.
 */

export const MANA_STRATEGIES = Object.freeze({
    // Go as far along the walk as the mana allows and spend the rest exploring there (XP + discovery).
    EXPLORE_FURTHEST: 'explore-furthest',
    // Go straight for the task; when the moves alone are unaffordable, explore the start region to farm XP.
    EXPLORE_TARGET: 'explore-target',
    // Queue the whole task even if it cannot finish this loop: the mana spent still earns region XP.
    KEEP_ATTEMPTING: 'keep-attempting',
    // Any available explore or check, chosen at random, a different one from the last loop's when possible.
    RANDOM: 'random',
});
export const DEFAULT_MANA_STRATEGY = MANA_STRATEGIES.EXPLORE_FURTHEST;
export const MANA_STRATEGY_LABELS = Object.freeze({
    [MANA_STRATEGIES.EXPLORE_FURTHEST]: 'Explore as far as mana allows',
    [MANA_STRATEGIES.EXPLORE_TARGET]: 'Explore the target region only',
    [MANA_STRATEGIES.KEEP_ATTEMPTING]: 'Keep attempting the task',
    [MANA_STRATEGIES.RANDOM]: 'Random task each loop',
});

/**
 * @typedef {{name: string, to: string}} LoopExit    an exit the player can use NOW (its access rule holds)
 * @typedef {{from: string, to: string, exit: string}} LoopHop
 * @typedef {Object} LoopView
 * @property {string} startRegion                  where every loop starts
 * @property {{locationName: string, regionName: string}|null} target
 * @property {(region: string) => LoopExit[]} exitsOf
 * @property {(region: string, exit: string) => boolean} isExitDiscovered
 * @property {(location: string) => boolean} isLocationDiscovered
 * @property {(entry: Object) => number} costOf    the live, XP-discounted cost of one queue entry
 * @property {number} maxMana                      a loop's pool
 * @property {(region: string) => boolean} [hasHidden]  something left to discover there (default: assume yes)
 * @property {(region: string) => boolean} [canCheck]   the region's queue takes a locationCheck (default: yes)
 * @property {string} [strategy]                   one of MANA_STRATEGIES
 * @property {() => Array<{kind: 'explore'|'check', region: string, location?: string}>} [availableTasks]  RANDOM only
 * @property {string|null} [lastTaskKey]           RANDOM only: the previous loop's task, avoided when possible
 * @property {() => number} [random]               RANDOM only (default Math.random)
 */

/** Breadth-first route over `exitsOf`, keeping only exits `keep` accepts. Null when unreachable. */
export function findRoute(from, to, exitsOf, keep = () => true) {
    if (from === to) return [];
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
        const region = queue.shift();
        for (const exit of exitsOf(region) ?? []) {
            if (!exit?.to || prev.has(exit.to) || !keep(region, exit)) continue;
            prev.set(exit.to, { from: region, to: exit.to, exit: exit.name });
            if (exit.to === to) {
                const hops = [];
                for (let hop = prev.get(to); hop; hop = prev.get(hop.from)) hops.unshift(hop);
                return hops;
            }
            queue.push(exit.to);
        }
    }
    return null;
}

/** Queue entries (gameState path shape) for moves along `hops`, then the loop's last action. */
export function buildLoopPath(hops, last = null) {
    const path = [];
    const instances = new Map();
    for (const hop of hops) {
        const n = (instances.get(hop.to) ?? 0) + 1;
        instances.set(hop.to, n);
        path.push({ type: 'regionMove', sourceRegion: hop.from, destinationRegion: hop.to, exitUsed: hop.exit, instanceNumber: n });
    }
    if (last) {
        const instanceNumber = instances.get(last.region) ?? 1;
        if (last.kind === 'explore') {
            path.push({ type: 'customAction', actionName: 'explore', params: {}, sourceRegion: last.region, instanceNumber });
        } else if (last.kind === 'check') {
            path.push({ type: 'locationCheck', locationName: last.location, sourceRegion: last.region, instanceNumber });
        } else if (last.kind === 'pass' && last.exit) {
            const n = (instances.get(last.exit.to) ?? 0) + 1;
            instances.set(last.exit.to, n);
            path.push({ type: 'regionMove', sourceRegion: last.region, destinationRegion: last.exit.to, exitUsed: last.exit.name, instanceNumber: n });
        }
    }
    return path;
}

/** The cost of a whole path, entry by entry. */
export function pathCost(path, costOf) {
    return path.reduce((sum, entry) => sum + (Number(costOf(entry)) || 0), 0);
}

/**
 * The task the target needs next: a CHECK when the route and the location are discovered, else an EXPLORE at the
 * frontier. `hops` are the discovered moves that lead to the task's region.
 * @returns {{kind: 'check'|'explore', region: string, location?: string, hops: LoopHop[]}|{kind: 'unreachable'}}
 */
export function nextTask(view) {
    const { startRegion, target, exitsOf, isExitDiscovered, isLocationDiscovered } = view;
    const discovered = (region, exit) => isExitDiscovered(region, exit.name);
    const known = findRoute(startRegion, target.regionName, exitsOf, discovered);
    if (known) {
        return isLocationDiscovered(target.locationName)
            ? checkOrPass(view, target, known)
            : { kind: 'explore', region: target.regionName, hops: known };
    }
    const full = findRoute(startRegion, target.regionName, exitsOf);
    if (!full) return { kind: 'unreachable' };
    const firstHidden = full.findIndex((hop) => !isExitDiscovered(hop.from, hop.exit));
    if (firstHidden < 0) return { kind: 'unreachable' };    // cannot happen: the discovered search would have found it
    // The full route's discovered prefix ends where its first hidden exit starts: explore THAT region.
    const prefix = full.slice(0, firstHidden);
    const frontier = full[firstHidden].from;
    // A shorter walk to the frontier over discovered exits may exist; the prefix is one.
    return { kind: 'explore', region: frontier, hops: findRoute(startRegion, frontier, exitsOf, discovered) ?? prefix };
}

/** A cost for a status line: XP discounts make them fractional. */
function fmt(cost) {
    return String(Math.round(cost * 10) / 10);
}

/**
 * ⚖ The user (2026-10-11): a substrate whose queue takes moves only (JtA, omsi) uses its own automation — the
 * check is never assembled into the queue. So a target there is a PASS: move into the region and out through
 * one of its exits; the walk (its Bot block) takes the checks on the way. A region with no exit cannot be passed.
 */
function checkOrPass(view, target, hops) {
    if (view.canCheck?.(target.regionName) !== false) {
        return { kind: 'check', region: target.regionName, location: target.locationName, hops };
    }
    const exit = (view.exitsOf(target.regionName) ?? []).find((e) => e?.to && e.to !== target.regionName) ?? null;
    if (!exit) return { kind: 'unreachable', reason: `${target.regionName} takes no check and has no exit to pass through` };
    return { kind: 'pass', region: target.regionName, location: target.locationName, exit, hops };
}

function describeTask(task) {
    if (task.kind === 'pass') return `pass through ${task.region} via "${task.exit.name}" (its automation takes "${task.location}")`;
    return task.kind === 'check' ? `check "${task.location}"` : `explore ${task.region}`;
}

function taskKey(task) {
    if (task.kind === 'pass') return `pass:${task.location}`;
    return task.kind === 'check' ? `check:${task.location}` : `explore:${task.region}`;
}

/** The longest prefix of `hops` whose moves plus an explore at its end fit `maxMana` (at least the empty one). */
function furthestAffordable(view, hops) {
    let best = { hops: [], region: view.startRegion };
    for (let i = 1; i <= hops.length; i += 1) {
        const prefix = hops.slice(0, i);
        const region = prefix[i - 1].to;
        if (pathCost(buildLoopPath(prefix, { kind: 'explore', region }), view.costOf) > view.maxMana) break;
        best = { hops: prefix, region };
    }
    return best;
}

/**
 * Plan one loop.
 * @param {LoopView} view
 * @returns {{kind: 'done'}|{kind: 'unreachable', reason: string}|
 *   {kind: 'check'|'explore', region: string, location?: string, path: Object[], cost: number,
 *    affordable: boolean, task: Object, key: string, reason: string}}
 */
export function planNextLoop(view) {
    const strategy = view.strategy ?? DEFAULT_MANA_STRATEGY;
    if (strategy === MANA_STRATEGIES.RANDOM) return planRandomLoop(view);
    if (!view.target) return { kind: 'done' };
    const task = nextTask(view);
    if (task.kind === 'unreachable') {
        return { kind: 'unreachable', reason: task.reason ?? `no route from ${view.startRegion} to ${view.target.regionName}` };
    }
    return planTaskLoop(view, task, strategy);
}

function planTaskLoop(view, task, strategy) {
    const path = buildLoopPath(task.hops, task);
    const cost = pathCost(path, view.costOf);
    const affordable = cost <= view.maxMana;
    const what = describeTask(task);
    const plan = (kind, region, hops, reason, extra = {}) => {
        const last = kind === 'check' ? { kind, region, location: task.location }
            : kind === 'pass' ? { kind, region, exit: task.exit } : { kind: 'explore', region };
        const p = buildLoopPath(hops, last);
        const c = pathCost(p, view.costOf);
        return { kind, region, ...extra, path: p, cost: c, affordable: c <= view.maxMana, task, key: taskKey(task), reason };
    };
    // ⛓ An explore that has nothing left to find can cost NOTHING (maze: no fog left → no walk → no charge), and a
    // repeating one then never ends the loop. So an XP-farming explore goes only where something is still hidden;
    // otherwise the loop attempts the task itself, whose walking spends the mana (measured on a maze world,
    // 2026-10-12: 1255 free explores in one loop).
    const canFarm = (region) => view.hasHidden?.(region) !== false;
    const attempt = (why) => plan(task.kind, task.region, task.hops, `${what} (costs ${fmt(cost)}, ${view.maxMana} mana: ${why})`,
        task.kind !== 'explore' ? { location: task.location } : {});
    if (affordable || strategy === MANA_STRATEGIES.KEEP_ATTEMPTING) {
        return plan(task.kind, task.region, task.hops,
            affordable ? what : `${what} (costs ${fmt(cost)}, ${view.maxMana} mana: attempting anyway)`,
            task.kind !== 'explore' ? { location: task.location } : {});
    }
    if (strategy === MANA_STRATEGIES.EXPLORE_TARGET) {
        // Straight for the task's region; only when even the walk is out of reach, farm XP at the start.
        const walk = buildLoopPath(task.hops, { kind: 'explore', region: task.region });
        if (pathCost(walk, view.costOf) <= view.maxMana && canFarm(task.region)) {
            return plan('explore', task.region, task.hops, `${what} costs ${fmt(cost)} > ${view.maxMana}: exploring ${task.region} for XP`);
        }
        if (canFarm(view.startRegion)) {
            return plan('explore', view.startRegion, [], `${what} is out of reach: exploring ${view.startRegion} for XP`);
        }
        return attempt(`nothing left to explore for XP, attempting anyway`);
    }
    // EXPLORE_FURTHEST.
    const far = furthestAffordable(view, task.hops);
    if (!canFarm(far.region)) return attempt(`nothing left to explore in ${far.region}, attempting anyway`);
    return plan('explore', far.region, far.hops, `${what} costs ${fmt(cost)} > ${view.maxMana}: exploring ${far.region} for XP`);
}

function planRandomLoop(view) {
    const tasks = (view.availableTasks?.() ?? []).filter(Boolean);
    if (!view.target && tasks.length === 0) return { kind: 'done' };
    if (tasks.length === 0) {
        return { kind: 'unreachable', reason: 'no explore or check is available from the start region' };
    }
    const fresh = tasks.filter((t) => taskKey(t) !== view.lastTaskKey);
    const pool = fresh.length ? fresh : tasks;
    const rnd = view.random ?? Math.random;
    const pick = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
    const hops = findRoute(view.startRegion, pick.region, view.exitsOf,
        (region, exit) => view.isExitDiscovered(region, exit.name));
    if (!hops) return { kind: 'unreachable', reason: `no discovered route to ${pick.region}` };
    const task = { ...pick, hops };
    const path = buildLoopPath(hops, task);
    const cost = pathCost(path, view.costOf);
    const what = task.kind === 'check' ? `check "${task.location}"` : `explore ${task.region}`;
    return {
        kind: task.kind, region: task.region, ...(task.kind !== 'explore' ? { location: task.location } : {}),
        path, cost, affordable: cost <= view.maxMana, task, key: taskKey(task), reason: `random: ${what}`,
    };
}

/**
 * The tasks RANDOM chooses from: every region reachable from the start over discovered, accessible exits offers an
 * explore while it hides something, and a check of each discovered, accessible, unchecked location.
 * @param {Object} args
 * @param {string} args.startRegion
 * @param {(region: string) => LoopExit[]} args.exitsOf
 * @param {(region: string, exit: string) => boolean} args.isExitDiscovered
 * @param {(region: string) => string[]} args.locationsOf
 * @param {(location: string) => boolean} args.isLocationDiscovered
 * @param {(location: string) => boolean} args.isLocationCheckable   accessible and not checked
 * @param {(region: string) => boolean} args.hasHidden               something left to discover
 */
export function availableTasks({ startRegion, exitsOf, isExitDiscovered, locationsOf, isLocationDiscovered,
    isLocationCheckable, hasHidden }) {
    const seen = new Set([startRegion]);
    const order = [startRegion];
    for (let i = 0; i < order.length; i += 1) {
        for (const exit of exitsOf(order[i]) ?? []) {
            if (!exit?.to || seen.has(exit.to) || !isExitDiscovered(order[i], exit.name)) continue;
            seen.add(exit.to);
            order.push(exit.to);
        }
    }
    const tasks = [];
    for (const region of order) {
        if (hasHidden(region)) tasks.push({ kind: 'explore', region });
        for (const location of locationsOf(region) ?? []) {
            if (isLocationDiscovered(location) && isLocationCheckable(location)) tasks.push({ kind: 'check', region, location });
        }
    }
    return tasks;
}
