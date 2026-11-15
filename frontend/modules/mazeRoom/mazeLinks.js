/**
 * ⛓⛓ MAZE LINK WIRES (maze lab step 3, ⚖ Robert 2026-11-11 "Maze link overlay", SHOW-1): which cells of a maze room
 * are WIRED to which, read from the room's own token fields, and the overlay shapes that draw them.
 *
 * A maze button names a TOKEN; whatever responds to that token is wired to it. The fields, and ONLY these (⛔ design-5
 * is reshaping rock ids and `struck_from`, so nothing else of an obstacle entry is read):
 *
 *  · PRESSERS — a placed button (`world.buttons` → `buttonLib[id].holds`; kind `latch` when the entry carries `latch`,
 *    else the entry's own `kind`), and a placed obstacle whose library entry `activates` a token (a rope, a light
 *    pole: kind = the entry's `kind`).
 *  · RESPONDERS — a placed obstacle whose `clear_set` holds a ONE-item set naming a token, or whose `clear_rule` is
 *    exactly `Has(token)` (kind = the entry's `kind`, else `door`); an arrow trap (`trapLib[id].active`, kind `trap`);
 *    a pulser (`pulsers[].token`, kind `pulser`).
 *
 * A token is a group only when a presser, a trap or a pulser names it: a one-item `clear_set` naming anything else is
 * a KEY door (`door_red` ← `key_red`, a colour class, a RULE and not a wire) and is never drawn. Block ↔ button
 * (any block presses any button) is a rule too, and so is not here.
 *
 * ⛔ Pure: no DOM, no engine call, no write. The room record is the editor session's world (Maps for `buttons` and
 * `obstacles`, lists for `traps`/`pulsers`), the same object `deserializeMazeWorld` returns.
 */

/** A placed cell's `{x, y}` from the engine's `"x,y"` key. */
const unKey = (key) => {
    const [x, y] = String(key).split(',').map(Number);
    return { x, y };
};

const rowMajor = (a, b) => (a.y - b.y) || (a.x - b.x) || String(a.kind).localeCompare(String(b.kind));

/** The token a `clear_rule` names when it is exactly `Has(token)`, else null. */
function hasRuleToken(rule) {
    if (!rule || typeof rule !== 'object' || rule.rule !== 'Has') return null;
    const name = rule.args?.item_name;
    return typeof name === 'string' ? name : null;
}

/**
 * ⛓⛓ THE LINK GROUPS of a maze room: `[{token, pressers, responders, dangling, missing}]`, one per token, sorted by
 * token. `pressers`/`responders` are `[{x, y, kind, id}]` in row-major order. `missing` is `'responder'` when the
 * token's pressers drive nothing in this room, `'presser'` when its responders have nothing here pressing them, else
 * null; `dangling` is `missing !== null`.
 */
export function linkGroups(world) {
    if (!world || typeof world !== 'object') return [];
    const buttonLib = world.buttonLib ?? {};
    const obstacleLib = world.obstacleLib ?? {};
    const trapLib = world.trapLib ?? {};
    const pressers = [];
    const responders = [];
    for (const [key, id] of world.buttons ?? []) {
        const entry = buttonLib[id];
        if (typeof entry?.holds !== 'string') continue;
        pressers.push({ ...unKey(key), kind: entry.latch ? 'latch' : (entry.kind ?? 'button'), id, token: entry.holds });
    }
    for (const [key, id] of world.obstacles ?? []) {
        const entry = obstacleLib[id];
        if (typeof entry?.activates === 'string') {
            pressers.push({ ...unKey(key), kind: entry.kind ?? 'activator', id, token: entry.activates });
        }
    }
    for (const t of world.traps ?? []) {
        const token = trapLib[t.id]?.active;
        if (typeof token === 'string') responders.push({ x: t.x, y: t.y, kind: 'trap', id: t.id, token });
    }
    for (const p of world.pulsers ?? []) {
        if (typeof p?.token === 'string') responders.push({ x: p.x, y: p.y, kind: 'pulser', id: null, token: p.token });
    }
    const tokens = new Set([...pressers, ...responders].map((m) => m.token));
    for (const [key, id] of world.obstacles ?? []) {
        const entry = obstacleLib[id];
        if (!entry) continue;
        const named = new Set();
        for (const set of entry.clear_set ?? []) {
            if (Array.isArray(set) && set.length === 1 && tokens.has(set[0])) named.add(set[0]);
        }
        const ruled = hasRuleToken(entry.clear_rule);
        if (ruled !== null && tokens.has(ruled)) named.add(ruled);
        for (const token of named) responders.push({ ...unKey(key), kind: entry.kind ?? 'door', id, token });
    }
    const groups = new Map();
    const at = (token) => {
        if (!groups.has(token)) groups.set(token, { token, pressers: [], responders: [] });
        return groups.get(token);
    };
    for (const { token, ...m } of pressers) at(token).pressers.push(m);
    for (const { token, ...m } of responders) at(token).responders.push(m);
    return [...groups.values()]
        .sort((a, b) => a.token.localeCompare(b.token))
        .map((g) => {
            g.pressers.sort(rowMajor);
            g.responders.sort(rowMajor);
            const missing = g.responders.length === 0 ? 'responder' : (g.pressers.length === 0 ? 'presser' : null);
            return { ...g, dangling: missing !== null, missing };
        });
}

/** A cell's centre in CELL space (what `editorView` shapes are drawn in). */
const centre = (c) => ({ x: c.x + 0.5, y: c.y + 0.5 });

/** The sentence a dangling mark carries. */
export function danglingLabel(group) {
    return group.missing === 'responder'
        ? `${group.token}: drives nothing in this room`
        : `${group.token}: nothing in this room presses it`;
}

/**
 * ⛓⛓ THE OVERLAY, as `editorView` shapes (cell space). E2's convention (`seedlingDemo/entityLinks.linkShapes`): the
 * full bipartite STAR, one arrowed polyline per presser × responder of a group, no hub. A self-edge (a rope or pole
 * cell is its own presser AND responder) is skipped. A DANGLING member gets a highlighted X across its cell, labelled
 * with its token alone (adjacent buttons would overprint a sentence; `describeLinkGroups` says what is missing) — the
 * mark E2 does not draw (it warns instead).
 */
export function linkShapes(groups) {
    const out = [];
    for (const g of groups) {
        for (const p of g.pressers) {
            for (const r of g.responders) {
                if (p.x === r.x && p.y === r.y) continue;
                out.push({ kind: 'polyline', points: [centre(p), centre(r)], arrow: true });
            }
        }
        if (!g.dangling) continue;
        const marked = g.missing === 'responder' ? g.pressers : g.responders;
        marked.forEach((m, i) => {
            out.push({
                kind: 'polyline', points: [{ x: m.x + 0.15, y: m.y + 0.15 }, { x: m.x + 0.85, y: m.y + 0.85 }],
                highlight: true, ...(i === 0 ? { label: g.token } : {}),
            });
            out.push({ kind: 'polyline', points: [{ x: m.x + 0.85, y: m.y + 0.15 }, { x: m.x + 0.15, y: m.y + 0.85 }], highlight: true });
        });
    }
    return out;
}

/** A one-line account of the groups for a status/note line: counts, and the dangling tokens by name. */
export function describeLinkGroups(groups) {
    if (groups.length === 0) return 'no wired buttons in this room (keys open doors by colour and any block presses any button: rules, not wires)';
    const members = groups.reduce((n, g) => n + g.pressers.length + g.responders.length, 0);
    const dangling = groups.filter((g) => g.dangling);
    return `${groups.length} wire group(s), ${members} member(s)`
        + (dangling.length ? ` — dangling: ${dangling.map(danglingLabel).join('; ')}` : ' — none dangling');
}
