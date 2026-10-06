/**
 * ⛓ BREAK BEFORE FIRST USE, FOR POSITION-AWARE ROUTE PLANNERS — the `restartRoute.js` family.
 *
 * ⚖ The user (2026-10-05): persisted obstacles are *"break before first use"*. The rules carry one GAME-STATE
 * event per saved obstacle flag (`event_kind: 'game_state'`, `flashPanel/seedlingObstacleEvents.js`): an event
 * location in the region on the obstacle's OPEN side (`side`), its far side(s) in `across`, and every door whose
 * landing is inside the obstacle gated `And(…, Has(<event>))`. The state manager never auto-collects these
 * (`stateManager/core/eventKinds.js`); the runtime collects one when the GAME's flag turns set
 * (`flashPanel/seedlingEventCollector.js`). So the planner's snapshot holds an event only once the game broke it,
 * and a route through a gated landing needs the planner to know how the event gets met:
 *
 *   CROSSING CREDIT  a hop between the event's `side` and one of its `across` regions through an exit priced
 *                    exactly the event's own rule passes THROUGH the obstacle — in the game that crossing breaks
 *                    it. The hop credits the event for the rest of the route (the survey's `eventsBrokenOnPath`
 *                    rule). Not eager: the walk was going there anyway.
 *   GOAL FIRST       an unmet event the route NEEDS is a goal visited first (like fetching a key): a BREAK step
 *                    in the event's region with its rule held. Never eager: the search takes the fewest breaks
 *                    (then the fewest hops), so a break is in a route only because no route without it exists.
 *
 * The answer has `PathFinder.findPathWithExits`'s shape. A crossing that credits carries `credits: [<event>]`;
 * a BREAK step is `{region: <side>, exitUsed: null, event: {name, eventId, obstacle, action}}` — never an exit.
 *
 * FAIL-CLOSED. Only `event_kind: 'game_state'` is read here; a route that needs no event it does not already hold
 * is not this module's (the caller's graph walk answers it, so the two cannot disagree).
 */

/** The one kind this planner reads (`seedlingObstacleEvents.OBSTACLE_EVENT_KIND`, restated: procgenCore imports no panel). */
export const GAME_STATE_EVENT_KIND = 'game_state';

/** A route's cost: a BREAK outweighs any number of hops (the fewest breaks first, then the shortest walk). */
const BREAK_COST = 1_000_000;

/**
 * The slot's game-state events: `{name, item, region, rule, eventId, level, tag, obstacle, action, side, across}`
 * per event location whose `event_kind` is `'game_state'`. `region` is where the location sits (= `side`).
 */
export function gameStateEventsOf(rules, playerId = '1') {
    const out = [];
    for (const [region, reg] of Object.entries(rules?.regions?.[String(playerId)] ?? {})) {
        for (const loc of reg?.locations ?? []) {
            if (loc?.event_kind !== GAME_STATE_EVENT_KIND) continue;
            out.push({
                name: loc.name,
                item: loc.item?.name ?? loc.name,
                region,
                rule: loc.access_rule ?? null,
                eventId: loc.event_id ?? null,
                level: loc.obstacle?.level ?? null,
                tag: loc.obstacle?.tag ?? null,
                obstacle: loc.obstacle ?? null,
                action: loc.action ?? null,
                side: loc.side ?? region,
                across: [...(loc.across ?? [])],
            });
        }
    }
    return out;
}

/** Does the hop `a → b` through `exit` pass through `event`'s obstacle at the event's own cost? */
export function hopCredits(event, a, b, exit) {
    const crosses = (a === event.side && event.across.includes(b)) || (b === event.side && event.across.includes(a));
    return crosses && JSON.stringify(exit?.access_rule ?? null) === JSON.stringify(event.rule ?? null);
}

/**
 * Plan from `from` to `to`, meeting the game-state events the route needs.
 *
 * @param {object} args
 * @param {string} args.from
 * @param {string} args.to
 * @param {object} args.regions  the slot's regions (`rules.regions[p]`): `{name: {exits: [{name, connected_region, access_rule}]}}`
 * @param {Array} args.events  `gameStateEventsOf(rules, p)`
 * @param {(rule: object|null, credited: Set<string>) => boolean} args.ruleHolds  the caller's verdict on a rule
 *   with the credited event ITEMS added to what the player holds
 * @param {Set<string>|string[]} [args.held]  event items already held — never credited or broken again. ⚠ The
 *   caller's `ruleHolds` must count them held: the collected ones are in its snapshot; the ones its own earlier hops
 *   CREDITED (the game breaks the obstacle on the walk, the collector has not seen the flag yet) it adds itself
 * @param {boolean} [args.credit=true]  crossing credit (off = goal-first alone; a test knob)
 * @param {boolean} [args.breaks=true]  goal-first BREAK steps (off = crossing credit alone)
 * @returns {{steps: Array<object>, length: number, breaks: Array<object>, credits: Array<object>}|null}
 *   null when no route exists, or when the route found uses NO event (the caller's graph walk owns that answer)
 */
export function planEventRoute({ from, to, regions, events, ruleHolds, held = [], credit = true, breaks = true }) {
    if (!from || !to || from === to || !regions?.[from]) return null;
    const heldSet = new Set(held);
    const pending = (events ?? []).filter((e) => !heldSet.has(e.item));
    if (pending.length === 0) return null;
    const bit = new Map(pending.map((e, i) => [e.item, 1n << BigInt(i)]));
    const creditedOf = (mask) => new Set(pending.filter((e) => (mask & bit.get(e.item)) !== 0n).map((e) => e.item));
    const holdsMemo = new Map();
    const holds = (rule, mask) => {
        if (!rule) return true;
        const key = `${mask}`;
        let m = holdsMemo.get(rule);
        if (!m) holdsMemo.set(rule, (m = new Map()));
        if (!m.has(key)) m.set(key, ruleHolds(rule, creditedOf(mask)) === true);
        return m.get(key);
    };

    // Dijkstra over (region, credited mask); cost = breaks × BREAK_COST + hops. The graph is small (one slot's regions).
    const start = { region: from, mask: 0n };
    const keyOf = (s) => `${s.region}\u0000${s.mask}`;
    const best = new Map([[keyOf(start), 0]]);
    const prev = new Map();
    const open = [{ ...start, cost: 0 }];
    let goal = null;
    while (open.length) {
        let i = 0;
        for (let j = 1; j < open.length; j += 1) if (open[j].cost < open[i].cost) i = j;
        const cur = open.splice(i, 1)[0];
        const ck = keyOf(cur);
        if (cur.cost !== best.get(ck)) continue;
        if (cur.region === to) { goal = cur; break; }
        const relax = (next, cost, how) => {
            const nk = keyOf(next);
            if (best.has(nk) && best.get(nk) <= cost) return;
            best.set(nk, cost);
            prev.set(nk, { from: ck, how });
            open.push({ ...next, cost });
        };
        for (const exit of regions[cur.region]?.exits ?? []) {
            const v = exit.connected_region;
            if (!regions[v] || !holds(exit.access_rule ?? null, cur.mask)) continue;
            let mask = cur.mask;
            const credits = [];
            if (credit) {
                for (const e of pending) {
                    const b = bit.get(e.item);
                    if ((mask & b) === 0n && hopCredits(e, cur.region, v, exit)) { mask |= b; credits.push(e); }
                }
            }
            relax({ region: v, mask }, cur.cost + 1, { exit: exit.name, region: v, credits });
        }
        if (breaks) {
            for (const e of pending) {
                const b = bit.get(e.item);
                if ((cur.mask & b) !== 0n || e.region !== cur.region || !holds(e.rule, cur.mask)) continue;
                relax({ region: cur.region, mask: cur.mask | b }, cur.cost + BREAK_COST, { event: e, region: cur.region });
            }
        }
    }
    if (!goal) return null;
    const moves = [];
    for (let k = keyOf(goal); prev.has(k); k = prev.get(k).from) moves.push(prev.get(k).how);
    moves.reverse();
    const usedBreaks = moves.filter((m) => m.event).map((m) => m.event);
    const usedCredits = moves.flatMap((m) => m.credits ?? []);
    // A route that met no event is the plain graph walk's answer, never this module's (fail-closed) — unless it
    // crosses an exit gated on an event the caller holds only by its own credit (its graph walk cannot see that).
    const usesHeld = moves.some((m) => m.exit && namesAny(exitRule(regions, prevRegion(moves, m, from), m.exit), heldSet));
    if (usedBreaks.length === 0 && usedCredits.length === 0 && !usesHeld) return null;
    const steps = [{ region: from, exitUsed: null }];
    for (const m of moves) {
        if (m.event) {
            steps.push({ region: m.region, exitUsed: null, event: eventRef(m.event) });
        } else {
            steps.push({ region: m.region, exitUsed: m.exit, ...(m.credits.length ? { credits: m.credits.map(eventRef) } : {}) });
        }
    }
    return { steps, length: steps.length - 1, breaks: usedBreaks.map(eventRef), credits: usedCredits.map(eventRef) };
}

/** The region a move left (the previous move's region, or `from`). */
function prevRegion(moves, m, from) {
    const i = moves.indexOf(m);
    return i > 0 ? moves[i - 1].region : from;
}

function exitRule(regions, region, exitName) {
    return (regions[region]?.exits ?? []).find((x) => x.name === exitName)?.access_rule ?? null;
}

/** Does `rule` name any of `items` (a `Has`-family argument anywhere in it)? */
function namesAny(rule, items) {
    if (!rule || items.size === 0) return false;
    const text = JSON.stringify(rule);
    return [...items].some((name) => text.includes(JSON.stringify(name)));
}

/**
 * The events a single hop CREDITS: `from → step.region` through `step.exitUsed`, for each pending event whose
 * obstacle that hop passes through at its own cost (`hopCredits`). The caller remembers them (the game breaks the
 * obstacle on that walk) until the collector sees the flag.
 */
export function creditsOfHop({ regions, events, from, step, held = [] }) {
    if (!step?.exitUsed) return [];
    const exit = (regions?.[from]?.exits ?? []).find((x) => x.name === step.exitUsed);
    if (!exit) return [];
    const heldSet = new Set(held);
    return (events ?? []).filter((e) => !heldSet.has(e.item) && hopCredits(e, from, step.region, exit)).map(eventRef);
}

/**
 * `planRoute`'s `eventPath` for one slot: `(a, b) → planEventRoute(…)`, the events and regions read off `rules`.
 * `ruleHolds(rule, extra)` is the caller's verdict with `extra` (a Set of event items) added to what the player
 * holds; `held()` answers the event items held NOW (collected + credited by the caller's own hops). No game-state
 * event in the slot → null (no event path: the walks stay the graph's).
 */
export function eventPathFinder({ rules, playerId = '1', ruleHolds, held = () => [] }) {
    const events = gameStateEventsOf(rules, playerId);
    const regions = rules?.regions?.[String(playerId)] ?? null;
    if (events.length === 0 || !regions || typeof ruleHolds !== 'function') return null;
    return (from, to) => planEventRoute({ from, to, regions, events, ruleHolds, held: held() });
}

/** A route step's reference to an event (plain data). */
function eventRef(e) {
    return { name: e.name, item: e.item, eventId: e.eventId, obstacle: e.obstacle, action: e.action, side: e.side };
}

/** Is this route step a goal-first BREAK (walk to the event's obstacle and break it), never an exit crossing? */
export function isBreakStep(step) {
    return !!step?.event && !step.exitUsed;
}
