/**
 * flashPanel/seedlingObstacleEvents — **A SAVED OBSTACLE STATE AS AN AP EVENT**
 * (RULES `rules-obstacle-events`).
 *
 * ⚖ The user (2026-10-05): *"The broken state of some obstacles is saved in the
 * save data. We might need to set up Archipelago logic to track which things
 * were broken."* The guarantee is **break before first use**: a door whose game
 * landing is INSIDE such an obstacle is usable only once the obstacle's flag is
 * cleared, so the edge needs the flag, and the planner treats an unmet flag as a
 * goal visited first (like fetching a key). Not eager breaking. The backstop is
 * the Menu's Restart (`exporter[p].return_to_menu`) plus the solver's named
 * refusal (`obstacle.kind 'arrival-inside-solid'`).
 *
 * ⛓ THE INPUT IS THE FIDELITY ARRIVAL CENSUS (`seedlingDemo/fidelityArrival.js`
 * `arrivalSolidCensus`): one row per (game landing, persistence-decided solid),
 * each MEASURED on the model with the flag held and with it cleared. Which rows
 * become events is read off those measurements, never off a class list:
 *   - held: inside AND stuck, cleared: outside (or free once every flag of a
 *     stacked landing is cleared) → the flag gates the landing edge;
 *   - held: inside but NOT stuck → nothing to gate (`skipped`, named);
 *   - a clear that ADDS the solid (`flagHolds.inside` false, a FallRock) or one
 *     that leaves the box inside → REFUSED by name: AP has no `Not(event)`, and
 *     a rule this module cannot state is never guessed.
 *
 * THE SCHEMA (reviewed with the JS arc; the readers key on `event_id`):
 *   one EVENT LOCATION per flag `{level, tag}`, in the AP region on the
 *   obstacle's OPEN side, holding a locked event item of the same name:
 *     name        `L<level> flag <tag>: <class>@<x>,<y> cleared`
 *     event_id    `flag:L<level>:<tag>`
 *     event_kind  `'game_state'` — the state manager NEVER auto-collects it
 *                 (`stateManager/core/eventKinds.js`): the game's own flag does
 *     obstacle    `{level, tag, class, x, y}` (the solid entity)
 *     action      `{verb, item}` — the census's `FLAG_ACTIONS` row: what clears
 *                 the flag, and the game inventory flag it needs (or null)
 *     side        the AP region the event sits in
 *     across      the AP regions on the obstacle's FAR side (the other sub-regions its footprint
 *                 touches; empty when it touches only `side`). A walk that crosses between `side`
 *                 and one of them at the event's cost passes THROUGH the obstacle — which, in the
 *                 game, breaks it (the survey credits the event there; added for the leg walk)
 *     access_rule the obstacle's own crossing cost, as the transcription prices
 *                 it (True_ when it prices none)
 *   EDGES: every departure whose landing is inside the obstacle gets
 *   `And(<its rule>, Has(<event item>))`; a landing inside STACKED solids needs
 *   every one of their events.
 *
 * Pure: the caller (the playthrough generator) supplies the atlas-side answers
 * through `ctx`, so the rows can be driven from a fixture in the unit tests.
 */

/** The kind every obstacle event carries: state the GAME keeps, which logic must never assume. */
export const OBSTACLE_EVENT_KIND = 'game_state';

/** `flag:L<level>:<tag>` — the stable id the runtime collector keys on. */
export const obstacleEventId = ({ level, tag }) => `flag:L${level}:${tag}`;

/** `{level, tag}` back out of an event id, or null when it is not one. */
export function parseObstacleEventId(id) {
    const m = /^flag:L(\d+):(\d+)$/.exec(String(id ?? ''));
    return m ? { level: Number(m[1]), tag: Number(m[2]) } : null;
}

/** The event's display name (also its event item's name). */
export const obstacleEventName = ({ level, tag, cls, x, y }) => `L${level} flag ${tag}: ${cls}@${x},${y} cleared`;

/** `breakablerock@80,112` → `{cls, x, y}`. */
export function parseSolidId(id) {
    const m = /^([a-z0-9_]+)@(-?\d+),(-?\d+)$/i.exec(String(id ?? ''));
    if (!m) throw new Error(`obstacle events: solid id "${id}" is not <class>@<x>,<y>`);
    return { cls: m[1], x: Number(m[2]), y: Number(m[3]) };
}

const landingKey = (L) => `L${L.from} ${L.door} -> L${L.level} (${L.x},${L.y})`;

/**
 * One census row's verdict: `'gate'`, `'skip'` (the box can walk out), or a
 * refusal reason.
 */
export function rowVerdict(row) {
    if (!row.flag) return { refuse: `${row.solid}: no persistence flag decides it — the map would have to be wrong` };
    if (!row.flagHolds?.inside) {
        return { refuse: `${row.solid} flag {${row.flag.level},${row.flag.tag}}: a clear ADDS this solid (${row.response}) — `
            + 'the edge would need NOT(event), which an AP rule cannot say' };
    }
    if (!row.flagHolds.stuck) return { skip: `${row.solid}: the landing is inside it but the box walks out` };
    if (!row.flagCleared) return { refuse: `${row.solid}: the census did not measure the cleared state` };
    if (row.flagCleared.inside) {
        return { refuse: `${row.solid} flag {${row.flag.level},${row.flag.tag}}: clearing the flag leaves the box inside — `
            + 'the flag is not what decides this arrival' };
    }
    if (row.flagCleared.stuck && !(row.allCleared && !row.allCleared.stuck && !row.allCleared.inside)) {
        return { refuse: `${row.solid}: the box is still stuck with every measured flag cleared — another solid decides it` };
    }
    return { gate: true };
}

/**
 * Census rows → the compiler's `events` + `exitGates`.
 *
 * @param {object[]} rows `arrivalSolidCensus` rows
 * @param {object} ctx
 * @param {(landing:object) => {region_id:string, exit_id:string}} ctx.departure the atlas endpoint the
 *   landing's door departs from
 * @param {(row:object, solid:{cls,x,y}) => {region_id:string, sub_region?:string, side:string, across?:string[]}} ctx.place
 *   where the event sits (the obstacle's open side); throws by name when it cannot say
 * @param {(row:object, solid:{cls,x,y}) => object|null} ctx.rule the obstacle's own crossing cost as a
 *   rules.json rule, null when the transcription prices none
 * @returns {{events:object[], exitGates:object[], skipped:string[], refused:string[]}}
 */
export function deriveObstacleEvents(rows, ctx) {
    const byFlag = new Map();
    const byLanding = new Map();
    const skipped = [];
    const refused = [];
    for (const row of rows) {
        const v = rowVerdict(row);
        if (v.skip) { skipped.push(`${landingKey(row.landing)}: ${v.skip}`); continue; }
        if (v.refuse) { refused.push(`${landingKey(row.landing)}: ${v.refuse}`); continue; }
        const id = obstacleEventId(row.flag);
        const solid = parseSolidId(row.solid);
        if (!byFlag.has(id)) {
            byFlag.set(id, { row, solid });
        } else if (byFlag.get(id).row.solid !== row.solid) {
            refused.push(`${landingKey(row.landing)}: flag ${id} decides two solids (${byFlag.get(id).row.solid}, ${row.solid})`);
            continue;
        }
        const lk = landingKey(row.landing);
        if (!byLanding.has(lk)) byLanding.set(lk, { landing: row.landing, ids: [] });
        if (!byLanding.get(lk).ids.includes(id)) byLanding.get(lk).ids.push(id);
    }
    if (refused.length > 0) {
        throw new Error(`obstacle events: ${refused.length} census row(s) refused —\n  ${refused.join('\n  ')}`);
    }

    const events = [];
    const nameOf = new Map();
    for (const [id, { row, solid }] of [...byFlag].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))) {
        const name = obstacleEventName({ ...row.flag, ...solid });
        const place = ctx.place(row, solid);
        nameOf.set(id, name);
        events.push({
            region_id: place.region_id,
            ...(place.sub_region === undefined ? {} : { sub_region: place.sub_region }),
            name,
            access_rule: ctx.rule(row, solid) ?? null,
            fields: {
                event_id: id,
                event_kind: OBSTACLE_EVENT_KIND,
                obstacle: { level: row.flag.level, tag: row.flag.tag, class: solid.cls, x: solid.x, y: solid.y },
                action: { verb: row.action ?? null, item: row.item ?? null },
                side: place.side,
                across: place.across ?? [],
            },
        });
    }

    const exitGates = [];
    for (const { landing, ids } of [...byLanding.values()]) {
        const dep = ctx.departure(landing);
        const has = ids.map((id) => ({ rule: 'Has', args: { item_name: nameOf.get(id) } }));
        exitGates.push({ ...dep, rule: has.length === 1 ? has[0] : { rule: 'And', children: has } });
    }
    exitGates.sort((a, b) => a.region_id.localeCompare(b.region_id, 'en', { numeric: true })
        || a.exit_id.localeCompare(b.exit_id, 'en', { numeric: true }));
    return { events, exitGates, skipped, refused };
}

/** Every item name a rules.json rule mentions (`Has`, `HasAny`/`HasAll`, nested). */
export function ruleItemNames(rule) {
    if (!rule || typeof rule !== 'object') return [];
    return [
        ...(typeof rule.args?.item_name === 'string' ? [rule.args.item_name] : []),
        ...(Array.isArray(rule.args?.item_names) ? rule.args.item_names : []),
        ...(rule.children ?? []).flatMap(ruleItemNames),
    ];
}

/**
 * ⛓⛓ RULES lock-events — **A LATCHING ONE-SIDED LOCK AS AN AP EVENT.** A BossLock opens only from the row
 * under it (`BossLock.as:58-63`) and, once open, its tag keeps it open (`setPersistence(tag, false)`; `check()`
 * removes it on every later build). From the north the game BUILDS it closed unless that flag was cleared
 * (fidelity STANCE; witnessed on the wasm by `probe-seedling-bosslock-latch.mjs`). RULES (A) priced the far
 * side's return as `And(CanReachRegion(<south>), <key>)`, which never asks whether the lock was OPENED; this
 * prices it as the lock's event, which the game's own flag sets.
 *
 * The input is the analyzer's `latch_projection` (`regionAtlasAnalyzer.analyzeRegion` with `latchEvent`): the
 * internal exit rows whose rule changed when each latched cell is priced as `Has(<its event>)`. So the set is
 * derived, never typed: a lock no return row crosses (it separates nothing, or both sides open) mints no event.
 *
 * Same schema as the obstacle events (`event_id: flag:L<level>:<tag>`, `event_kind: 'game_state'`, `obstacle`,
 * `action`, `side`, `across`); `access_rule` = what OPENING it costs from its open side, as the analyzer priced
 * the step into the cell (its key, and whatever material lies between); `side` = the one component that opens it.
 * An event the obstacle census already minted (same `event_id`) is REUSED, never duplicated; one whose name or
 * side disagrees is refused by name.
 *
 * @param {object[]} projection `{region_id, from, to, base_rule, access_rule}` per changed internal exit
 * @param {object} ctx
 * @param {(itemName:string, regionId:string) => object|undefined} ctx.lockOf the lock behind an event item name
 *   minted for that region's latches: `{level, tag, cls, x, y}`
 * @param {(lock:object, regionId:string) => {region_id, sub_region?, side, across}} ctx.place its open side
 * @param {(lock:object, regionId:string) => object} ctx.rule what opening it costs (a rules.json rule)
 * @param {(cls:string) => {verb:string|null, item:string|null}} ctx.action
 * @param {object[]} [ctx.existing] events already minted (the obstacle events)
 * @returns {{events:object[], internalExitRules:object[], reused:string[]}}
 */
export function deriveLockEvents(projection, ctx) {
    const existing = new Map((ctx.existing ?? []).map((e) => [e.fields?.event_id, e]));
    const events = new Map();
    const reused = new Set();
    const internalExitRules = [];
    for (const row of projection) {
        const names = [...new Set(ruleItemNames(row.access_rule).filter((n) => ctx.lockOf(n, row.region_id)))];
        if (names.length === 0) {
            throw new Error(`lock events: ${row.region_id} ${row.from} -> ${row.to} changed with no lock event in its rule`);
        }
        for (const name of names) {
            const lock = ctx.lockOf(name, row.region_id);
            const id = obstacleEventId(lock);
            if (events.has(id) || reused.has(id)) continue;
            const place = ctx.place(lock, row.region_id);
            const prior = existing.get(id);
            if (prior) {
                if (prior.name !== name || prior.fields.side !== place.side) {
                    throw new Error(`lock events: ${id} is already the obstacle event "${prior.name}" @ ${prior.fields.side}; `
                        + `the lock would be "${name}" @ ${place.side}`);
                }
                reused.add(id);
                continue;
            }
            const { verb = null, item = null } = ctx.action(lock.cls) ?? {};
            events.set(id, {
                region_id: place.region_id,
                ...(place.sub_region === undefined ? {} : { sub_region: place.sub_region }),
                name,
                access_rule: ctx.rule(lock, row.region_id) ?? null,
                fields: {
                    event_id: id,
                    event_kind: OBSTACLE_EVENT_KIND,
                    obstacle: { level: lock.level, tag: lock.tag, class: lock.cls, x: lock.x, y: lock.y },
                    action: { verb, item },
                    side: place.side,
                    across: place.across ?? [],
                },
            });
        }
        internalExitRules.push({ region_id: row.region_id, from: row.from, to: row.to, expect: row.base_rule, rule: row.access_rule });
    }
    const byId = (a, b) => a.fields.event_id.localeCompare(b.fields.event_id, 'en', { numeric: true });
    return { events: [...events.values()].sort(byId), internalExitRules, reused: [...reused].sort() };
}
