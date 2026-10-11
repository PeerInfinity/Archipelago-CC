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

/**
 * ⛓⛓ RULES l38-button-event — **A CROSS-ROOM BUTTON PRESS AS AN AP EVENT.** A `ButtonRoom` whose `room >= 0`
 * writes `Game.setPersistence(t, persist, room)` (`ButtonRoom.as:93`): its TSET, as a tag, in ANOTHER level, with
 * `persist = !flip` — `flip` = a CLEAR. L38's `buttonroom@32,48 {t 8, flip 1, room 39}` clears `{39,8}`, and
 * L39's plug `wandlock@144,592 {tset -1, tag 8}` is then left out of the build (`Lock.check()`). The overlay priced
 * that plug FREE ("the button half is choreography", `seedlingPlaythroughOverlay.lockRuling`), which never asked
 * whether the button was PRESSED — RULES (A)'s `CanReachRegion` shape one level over. Witnessed on the wasm by
 * `probe-seedling-cross-room-button.mjs` (the press writes `{39,8}` to `persistence_cleared`; the plug is built
 * gone with it and standing without it).
 *
 * The rows are every cross-room button of the map (`crossRoomButtonsOf`), never a list. Per (button, target):
 *   - a CLEAR of a target the caller says it prices FREE on the button's account → ONE event: `obstacle` = the
 *     TARGET `{level, tag, class, x, y}` (the flag the game writes, so the collector keys off it), `side` = the
 *     presser's AP region (in the PRESSER's level — the one schema delta: `obstacle.level` may differ from
 *     `side`'s), `across` = [] (pressing is not crossing: no hop credits it; a route meets it goal-first),
 *     `action {verb: 'press', item: null, presser: {level, class, x, y}}`, `access_rule` = standing on the
 *     button within `side` (`ctx.reach`); and the caller's `gates(target)` departures get `Has(<event>)`;
 *   - a clear that ADDS the target's solid (a FallRock's `arm`), a target solid in neither state, or one the rules
 *     already price without the button → `skipped`, by name;
 *   - a SET (`flip` 0) of a target the clear would open → REFUSED by name (it would need `Not(event)`).
 * An event already minted with the same `event_id` is reused (refused by name if its name or side differs).
 *
 * @param {object[]} rows `crossRoomButtonsOf(map)`
 * @param {object} ctx
 * @param {(target:object) => {effect:'opens'|'closes'|null, why:string}} ctx.effect what a clear does to its solid
 * @param {(target:object) => {free:boolean, why:string}} ctx.pricedByButton does the transcription price it free
 *   only because of the button
 * @param {(presser:object) => {region_id, sub_region?, side}} ctx.place the presser's AP region
 * @param {(presser:object) => object|null} ctx.reach standing on the presser within `side` (null = True_)
 * @param {(target:object, eventName:string) => {region_id:string, exit_id:string}[]} ctx.gates the crossings
 *   through the target, as departures (throws by name when it cannot say)
 * @param {object[]} [ctx.existing] events already minted
 * @returns {{events:object[], exitGates:object[], skipped:string[], reused:string[]}}
 */
export function deriveButtonEvents(rows, ctx) {
    const existing = new Map((ctx.existing ?? []).map((e) => [e.fields?.event_id, e]));
    const events = new Map();
    const exitGates = [];
    const skipped = [];
    const refused = [];
    const reused = new Set();
    for (const { presser: p, write, targets } of rows) {
        const who = `L${p.level} buttonroom@${p.x},${p.y} -> {${write.level},${write.tag}}`;
        if (targets.length === 0) { skipped.push(`${who}: no entity of L${write.level} carries tag ${write.tag}`); continue; }
        for (const t of targets) {
            const what = `${who} ${t.type}@${t.x},${t.y}`;
            const { effect, why } = ctx.effect(t);
            if (write.value) {
                if (effect === 'opens') refused.push(`${what}: the press SETS the flag that opens it (${why}) — the gate would need NOT(event)`);
                else skipped.push(`${what}: the press sets the flag (flip 0)`);
                continue;
            }
            if (effect === 'closes') { skipped.push(`${what}: a clear ADDS this solid (${why}) — no event can say NOT(event)`); continue; }
            if (effect !== 'opens') { skipped.push(`${what}: solid in neither state (${why})`); continue; }
            const priced = ctx.pricedByButton(t);
            if (!priced.free) { skipped.push(`${what}: the rules do not price it free on the button's account (${priced.why})`); continue; }
            const id = obstacleEventId({ level: t.level, tag: t.tag });
            const name = obstacleEventName({ level: t.level, tag: t.tag, cls: t.type, x: t.x, y: t.y });
            if (events.has(id)) { refused.push(`${what}: ${id} is already this slice's event for another button`); continue; }
            const place = ctx.place(p);
            const prior = existing.get(id);
            if (prior) {
                if (prior.name !== name || prior.fields.side !== place.side) {
                    refused.push(`${what}: ${id} is already the event "${prior.name}" @ ${prior.fields.side}; `
                        + `the button would make "${name}" @ ${place.side}`);
                    continue;
                }
                reused.add(id);
            } else {
                events.set(id, {
                    region_id: place.region_id,
                    ...(place.sub_region === undefined ? {} : { sub_region: place.sub_region }),
                    name,
                    access_rule: ctx.reach(p) ?? null,
                    fields: {
                        event_id: id,
                        event_kind: OBSTACLE_EVENT_KIND,
                        obstacle: { level: t.level, tag: t.tag, class: t.type, x: t.x, y: t.y },
                        action: { verb: 'press', item: null, presser: { level: p.level, class: 'buttonroom', x: p.x, y: p.y } },
                        side: place.side,
                        across: [],
                    },
                });
            }
            for (const dep of ctx.gates(t, name)) exitGates.push({ ...dep, rule: { rule: 'Has', args: { item_name: name } } });
        }
    }
    if (refused.length > 0) {
        throw new Error(`button events: ${refused.length} cross-room write(s) refused —\n  ${refused.join('\n  ')}`);
    }
    const byId = (a, b) => a.fields.event_id.localeCompare(b.fields.event_id, 'en', { numeric: true });
    exitGates.sort((a, b) => a.region_id.localeCompare(b.region_id, 'en', { numeric: true })
        || a.exit_id.localeCompare(b.exit_id, 'en', { numeric: true }));
    return { events: [...events.values()].sort(byId), exitGates, skipped, reused: [...reused].sort() };
}

/**
 * Every cross-room `ButtonRoom` of a map extract (`room >= 0`) and what its write reaches: `{presser: {level, x, y,
 * t, tag, flip, room}, write: {level, tag, value}, targets: [{level, type, x, y, tset, tag}]}`. `value` is the
 * persistence the press writes (`!flip`, `ButtonRoom.as:80-93`): false = CLEARED, the only value
 * `persistence_cleared` shows. The targets are the entities of the written level carrying that tag.
 */
export function crossRoomButtonsOf(map) {
    const levelOf = (n) => map.levels.find((l) => l.level === n);
    return map.levels.flatMap((l) => (l.entities ?? []).filter((e) => e.type === 'buttonroom'
        && Number.isInteger(Number(e.attrs?.room)) && Number(e.attrs.room) >= 0).map((e) => {
        const room = Number(e.attrs.room);
        const t = Number(e.attrs.tset);
        const flip = Number(e.attrs.flip) === 1;
        return {
            presser: { level: l.level, x: e.x, y: e.y, t, tag: Number(e.attrs.tag), flip, room },
            write: { level: room, tag: t, value: !flip },
            targets: (levelOf(room)?.entities ?? []).filter((x) => Number(x.attrs?.tag) === t).map((x) => ({
                level: room, type: x.type, x: x.x, y: x.y, tset: Number(x.attrs?.tset), tag: t,
            })),
        };
    }));
}

/**
 * What a CLEARED tag does to a target's solidity, read off the model's per-class answer
 * (`seedlingDemo/levelWorld.PERSISTENCE_RESPONSE`, passed in as `response`): `'opens'` for `despawn` (and
 * `lock-despawn` with `tSet < 0`, `Lock.as:42`), `'closes'` for `arm` (a FallRock built FALLEN), else null.
 */
export function persistenceEffect(target, response) {
    if (response === 'despawn') return { effect: 'opens', why: 'despawn' };
    if (response === 'lock-despawn') {
        return target.tset < 0 ? { effect: 'opens', why: 'lock-despawn, tSet < 0' }
            : { effect: null, why: `lock-despawn, but tSet ${target.tset} >= 0: check() ignores the tag` };
    }
    if (response === 'arm') return { effect: 'closes', why: 'arm: built FALLEN, Solid' };
    return { effect: null, why: response ? `response '${response}'` : 'no declared persistence response' };
}
