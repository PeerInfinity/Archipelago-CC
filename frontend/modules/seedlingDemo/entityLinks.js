/**
 * seedlingDemo/entityLinks — **WHAT AN ENTITY IS WIRED TO, AS DATA** (Seedling editor E2).
 *
 * The pure half of the editor's link tools: read the links out of a room record, build the ops that change
 * them, and say which links the game cannot use. No DOM. Every edit is one of the room vocabulary's existing
 * ops (`attrs` for a group, `nodes` for a rope's end): this module adds no op and changes no semantics.
 *
 * ── THE LINK KINDS, MEASURED OVER `Shrum.oep`, THE 116 VANILLA ROOMS AND THE AS3 ──────────────────────────
 *
 *   · **The GROUP** (`tset`). `Game.as` passes `o.@tset` to the `Activators` classes, and a publisher reaches
 *     every other `Activators` whose `t` equals its own (`Button.activateAll`, `ButtonRoom.set activate`,
 *     `RopeStart.set activate`). There is no pointer: a link is two entities sharing a number. A missing attribute
 *     is `int("") = 0`, so it is group 0, not "no group".
 *   · **The negative groups are sentinels, not wires**: `-1` on a lock means "opens when the room is clear of
 *     enemies" (`Lock.as:111`), on a crusher "always armed" (`Crusher.as:46`).
 *   · **The forced groups** (`levelWorld.FORCED_TSET`): `shieldlock`/`shieldlocknorm`/`bosslock` take their group
 *     from the constructor, and no `tset` attribute reaches them.
 *   · **The CROSS-ROOM button**: a `buttonroom` whose `room` is not -1 does not publish a group at all. Its `tset`
 *     is a persistence flag of THAT level (`Game.setPersistence(t, persist, room)`). One room's editor can name it
 *     and cannot see the far end.
 *   · **The IMPLICIT publishers** (`IMPLICIT_PUBLISHERS`): a `wand` pickup and a dying `finalboss` publish group 0
 *     with no attribute saying so.
 *   · **The ROPE's end** (`<node>`): `rope` is the only declaration with `nodes` (Ogmo limit 1). `Game.as:2423-2427`
 *     keeps the LAST node and passes only its `x`; the node's `y` is read and dropped. There are no moving
 *     platforms and no multi-node paths in this game.
 */
import { FORCED_TSET, ROLES, TILE_SIZE } from './levelWorld.js';
import { PRESSERS, groupResponders } from './activators.js';
import { tileAtOel } from './procgenLevel.js';
import { group } from '../procgenCore/editCore.js';

/** The one type `Shrum.oep` declares `<nodes>` on. */
export const ROPE_TYPE = 'rope';

/** The types that PUBLISH a group: the two `PRESSERS` and `RopeStart`. */
export const PUBLISHER_TYPES = Object.freeze(new Set([...Object.keys(PRESSERS), ROPE_TYPE]));

/**
 * ⛓ The publishers no attribute names, and the one group each reaches.
 * `Pickups/Wand.as:61-67` (its private `tset` is 0) and `Enemies/FinalBoss.as:218`.
 */
export const IMPLICIT_PUBLISHERS = Object.freeze({
    wand: Object.freeze({ group: 0, how: 'when it is picked up' }),
    finalboss: Object.freeze({ group: 0, how: 'when it dies' }),
});

/** ⛓ What a refused or warned link is called, so a test and a page name the same thing. */
export const LINK_ISSUES = Object.freeze({
    ROPE_NO_NODE: 'rope-no-node',
    ROPE_MANY_NODES: 'rope-many-nodes',
    ROPE_NODE_LEFT: 'rope-node-left',
    ROPE_NODE_ROW: 'rope-node-row',
    GROUP_NO_PUBLISHER: 'group-no-publisher',
    GROUP_NO_RESPONDER: 'group-no-responder',
    PUBLISHER_SENTINEL: 'publisher-sentinel-group',
    TSET_UNREAD: 'tset-unread',
    TSET_NOT_INT: 'tset-not-an-integer',
});

const nameOf = (e) => `<${e.type}> at (${e.x},${e.y})`;

/** AS3's `int(String)`: an empty or unparseable attribute reads as 0. */
const as3Int = (raw) => {
    if (raw === undefined || raw === null) return 0;
    const n = Number(String(raw).trim() === '' ? 0 : raw);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const declaresTset = (schema, type) => (schema?.entities?.[type]?.values ?? []).some((v) => v.name === 'tset');
const declaresNodes = (schema, type) => (schema
    ? Boolean(schema.entities?.[type]?.nodes)
    // ⛓ A caller with no schema (the generated-room save) can still ask the one question that refuses a save.
    : type === ROPE_TYPE);

/** ⛓ Can this type take part in a group? Asked of the schema, which holds every `tset` declaration. */
export const isLinkable = (schema, type) => declaresTset(schema, type);
/** ⛓ Does this type carry a path? */
export const isPathed = (schema, type) => declaresNodes(schema, type);

/** The in-cell ordinal the ops' `which` addresses, and how many bodies share the cell. */
function cellPlaceOf(record, index) {
    const e = record.entities[index];
    const { tx, ty } = tileAtOel(e.x, e.y);
    let ordinal = -1;
    let count = 0;
    record.entities.forEach((o, i) => {
        const at = tileAtOel(o.x, o.y);
        if (at.tx !== tx || at.ty !== ty) return;
        if (i === index) ordinal = count;
        count += 1;
    });
    return { tx, ty, ordinal, count };
}

/** ⛔ `which` is written only for a body that is not the cell's last, the bare op's own target. */
const whichOf = ({ ordinal, count }) => (ordinal === count - 1 ? {} : { which: ordinal });

/**
 * ⛓⛓ THE ENTITIES THAT TAKE PART IN A GROUP. `role` is `publisher`, `responder` or `cross-room` (a `buttonroom`
 * writing another level's flag, whose `tset` is not a group of this room). `index` is the entity's place in
 * `record.entities`, which `attrs`/`nodes` ops do not move.
 */
export function groupMembers(record, { schema }) {
    const out = [];
    (record?.entities ?? []).forEach((e, index) => {
        if (!declaresTset(schema, e.type)) return;
        const crossRoom = e.type === 'buttonroom' && as3Int(e.attrs?.room) !== -1;
        const role = crossRoom ? 'cross-room' : PUBLISHER_TYPES.has(e.type) ? 'publisher' : 'responder';
        out.push(Object.freeze({
            index, type: e.type, x: e.x, y: e.y, t: as3Int(e.attrs?.tset), role,
            ...(crossRoom ? { room: as3Int(e.attrs?.room) } : {}),
        }));
    });
    return out;
}

const implicitPublishers = (record) => (record?.entities ?? []).flatMap((e, index) => {
    const row = IMPLICIT_PUBLISHERS[e.type];
    return row ? [Object.freeze({ index, type: e.type, x: e.x, y: e.y, t: row.group, how: row.how })] : [];
});

/**
 * ⛓⛓⛓ EVERY LINK IN THE ROOM: `{kind:'group', group, from, to, implicit?}` (publisher → responder, the
 * direction the game publishes), `{kind:'rope', rope, end}`, and `{kind:'cross-room', from, room, flag}`.
 * A sentinel group wires nothing and produces no link.
 */
export function linksOf(record, { schema }) {
    const members = groupMembers(record, { schema });
    const responders = members.filter((m) => m.role === 'responder');
    const links = [];
    for (const from of members) {
        if (from.role === 'cross-room') {
            links.push(Object.freeze({ kind: 'cross-room', from, room: from.room, flag: from.t }));
        } else if (from.role === 'publisher' && from.t >= 0) {
            for (const to of responders) {
                if (to.t === from.t) links.push(Object.freeze({ kind: 'group', group: from.t, from, to }));
            }
        }
    }
    for (const from of implicitPublishers(record)) {
        for (const to of responders) {
            if (to.t === from.t) links.push(Object.freeze({ kind: 'group', group: from.t, from, to, implicit: true }));
        }
    }
    (record?.entities ?? []).forEach((e, index) => {
        if (!declaresNodes(schema, e.type) || !e.nodes?.length) return;
        const last = e.nodes[e.nodes.length - 1];
        links.push(Object.freeze({
            kind: 'rope', rope: Object.freeze({ index, type: e.type, x: e.x, y: e.y }), end: Object.freeze({ x: last.x, y: last.y }),
        }));
    });
    return links;
}

/** ⛓ The entity indices wired to `index`, in BOTH directions (a publisher's responders, a responder's publishers). */
export function partnersOf(record, index, { schema }) {
    const out = new Set();
    for (const l of linksOf(record, { schema })) {
        if (l.kind !== 'group') continue;
        if (l.from.index === index) out.add(l.to.index);
        if (l.to.index === index) out.add(l.from.index);
    }
    return [...out].sort((a, b) => a - b);
}

const centre = (e) => ({ x: (e.x + TILE_SIZE / 2) / TILE_SIZE, y: (e.y + TILE_SIZE / 2) / TILE_SIZE });

/**
 * ⛓⛓ THE OVERLAY, as `editorView` shapes in cell space (a page's `shapes()` hands them over, so shared code draws
 * nothing Seedling-specific). A link touching `selected` is highlighted and labelled; the partners get a box.
 */
export function linkShapes(record, { schema, selected = null } = {}) {
    const out = [];
    const on = (i) => selected !== null && i === selected;
    for (const l of linksOf(record, { schema })) {
        if (l.kind === 'cross-room') continue;
        if (l.kind === 'rope') {
            const hot = on(l.rope.index);
            out.push({
                kind: 'polyline', points: [centre(l.rope), centre(l.end)], highlight: hot,
                ...(hot ? { label: `rope end x=${l.end.x}` } : {}),
            });
            continue;
        }
        const hot = on(l.from.index) || on(l.to.index);
        out.push({
            kind: 'polyline', points: [centre(l.from), centre(l.to)], arrow: true, highlight: hot,
            ...(hot ? { label: `group ${l.group}${l.implicit ? ' (implicit)' : ''}` } : {}),
        });
    }
    if (selected !== null && record?.entities?.[selected]) {
        const box = (e) => ({
            kind: 'rect', x: Math.floor(e.x / TILE_SIZE), y: Math.floor(e.y / TILE_SIZE), w: 1, h: 1, highlight: true,
        });
        out.push(box(record.entities[selected]));
        for (const p of partnersOf(record, selected, { schema })) out.push(box(record.entities[p]));
    }
    return out;
}

/** A human line about what a picked entity is wired to. */
export function describeLinks(record, index, { schema }) {
    const e = record.entities[index];
    const m = groupMembers(record, { schema }).find((g) => g.index === index);
    const parts = partnersOf(record, index, { schema }).map((p) => nameOf(record.entities[p]));
    const wired = parts.length ? `wired to ${parts.join(', ')}` : 'wired to nothing in this room';
    if (m?.role === 'cross-room') {
        return `${nameOf(e)} writes persistence flag ${m.t} of level ${m.room}: the far end is in another room.`;
    }
    if (m && m.t < 0) return `${nameOf(e)} is in sentinel group ${m.t}, which is not a wire (${wired}).`;
    return `${nameOf(e)}${m ? ` is in group ${m.t},` : ''} ${wired}.`;
}

/**
 * ⛓ WHY a body cannot take part in a group, or `null` when it can. A sentence for the status line.
 */
export function unlinkableReason(record, index, { schema }) {
    const e = record.entities[index];
    if (FORCED_TSET[e.type] !== undefined) {
        return `${nameOf(e)} cannot be wired: its constructor fixes its group at ${FORCED_TSET[e.type]}, so no `
            + '`tset` reaches it.';
    }
    if (!declaresTset(schema, e.type)) {
        return `${nameOf(e)} cannot be wired: \`Shrum.oep\` declares no \`tset\` on it and the game reads no group `
            + 'from it.';
    }
    return null;
}

/** The lowest group no member of this room uses (group 0 stays taken when an implicit publisher reaches it). */
export function freshGroup(record, { schema }) {
    const used = new Set(groupMembers(record, { schema }).filter((m) => m.role !== 'cross-room').map((m) => m.t));
    for (const p of implicitPublishers(record)) used.add(p.t);
    let t = 0;
    while (used.has(t)) t += 1;
    return t;
}

/** The `attrs` op that puts one entity in group `t`, keeping its other attributes. */
function bindOp(record, index, t) {
    const e = record.entities[index];
    const place = cellPlaceOf(record, index);
    return {
        op: 'attrs', tx: place.tx, ty: place.ty, attrs: { ...(e.attrs ?? {}), tset: String(t) }, ...whichOf(place),
    };
}

const crossRoomRefusal = (e, m) => `${nameOf(e)} writes flag ${m.t} of level ${m.room}: its \`tset\` is not a group `
    + 'of this room, so it cannot be wired here. Edit it with ATTRS.';

/**
 * ⛓⛓⛓ REWIRE. The picked entity joins its partner's group (`{fresh: true}`: the two of them move to a new group
 * of their own, and picking the same entity twice detaches it alone). Returns an op, or `{refused}` naming why.
 */
export function bindOps(record, pick, partner, { schema, fresh = false }) {
    const members = groupMembers(record, { schema });
    const memberOf = (i) => members.find((m) => m.index === i);
    for (const i of [pick, partner]) {
        const why = unlinkableReason(record, i, { schema });
        if (why) return { refused: why };
        if (memberOf(i).role === 'cross-room') return { refused: crossRoomRefusal(record.entities[i], memberOf(i)) };
    }
    if (fresh) {
        const t = freshGroup(record, { schema });
        if (pick === partner) return bindOp(record, pick, t);
        return group(`link: new group ${t}`, [bindOp(record, pick, t), bindOp(record, partner, t)]);
    }
    const a = memberOf(pick);
    const b = memberOf(partner);
    if (b.t < 0) {
        return {
            refused: `${nameOf(record.entities[partner])} is in sentinel group ${b.t}, which means "${b.t === -1
                ? 'answers to the room, not a wire' : 'no group'}" to the game. Shift-click to give the two a new group.`,
        };
    }
    if (a.t === b.t) return { refused: `${nameOf(record.entities[pick])} is already in group ${b.t}.` };
    return bindOp(record, pick, b.t);
}

/**
 * ⛓⛓⛓ THE ROPE'S END, at a clicked column. The row of the click is ignored and the node stays on the rope's own
 * row, because the game reads only the node's `x`.
 */
export function ropeEndOp(record, index, tx, { schema }) {
    const e = record.entities[index];
    if (!declaresNodes(schema, e.type)) {
        return { refused: `${nameOf(e)} has no path: \`Shrum.oep\` declares \`<nodes>\` only on a rope.` };
    }
    const x = tx * TILE_SIZE;
    if (x < e.x) {
        return {
            refused: `a rope runs to the RIGHT of its pulley: x=${x} is left of ${nameOf(e)}, and the game would size `
                + 'its collider negative (`RopeStart.as`: `setHitbox(_xend - _x + 16, …)`), leaving nothing to pull.',
        };
    }
    const place = cellPlaceOf(record, index);
    return { op: 'nodes', tx: place.tx, ty: place.ty, nodes: [{ x, y: e.y }], ...whichOf(place) };
}

/**
 * ⛓⛓⛓ WHAT IS WRONG WITH THE ROOM'S LINKS: `[{code, severity, message}]`.
 *
 * ⛔ **`refuse` IS ONLY WHAT THE GAME CANNOT LOAD**, because a save refused is a room nobody can test. A rope with
 * no `<node>` dies in the level loader (`Game.as:2423-2427`: `pt` stays null and `pt.x` throws). Everything else
 * loads and plays, and some shipped rooms hold groups with no publisher of their own, so those are warnings.
 */
export function linkIssues(record, { schema }) {
    const out = [];
    const add = (code, severity, message) => out.push(Object.freeze({ code, severity, message }));
    const members = groupMembers(record, { schema });
    for (const e of record?.entities ?? []) {
        if (declaresNodes(schema, e.type)) {
            if (!e.nodes?.length) {
                add(LINK_ISSUES.ROPE_NO_NODE, 'refuse', `${nameOf(e)} has no <node>: the game's level loader dies on it `
                    + '(`Game.as:2427` reads `pt.x` of a point it never set). Give it an end with NODE.');
            } else {
                const last = e.nodes[e.nodes.length - 1];
                if (e.nodes.length > 1) {
                    add(LINK_ISSUES.ROPE_MANY_NODES, 'warn', `${nameOf(e)} has ${e.nodes.length} nodes: the game keeps `
                        + 'only the last.');
                }
                if (last.x < e.x) {
                    add(LINK_ISSUES.ROPE_NODE_LEFT, 'warn', `${nameOf(e)} ends left of its pulley (x=${last.x}): its `
                        + 'collider is negative, so nothing can pull it.');
                }
                if (last.y !== e.y) {
                    add(LINK_ISSUES.ROPE_NODE_ROW, 'warn', `${nameOf(e)}'s node is on y=${last.y}: the game reads only `
                        + 'its x, so the rope stays on its own row.');
                }
            }
        }
        const raw = e.attrs?.tset;
        if (raw !== undefined && !declaresTset(schema, e.type)) {
            add(LINK_ISSUES.TSET_UNREAD, 'warn', `${nameOf(e)} carries tset=${raw} and the game never reads it there.`);
        } else if (raw !== undefined && String(raw).trim() !== '' && !Number.isInteger(Number(raw))) {
            add(LINK_ISSUES.TSET_NOT_INT, 'warn', `${nameOf(e)} has tset=${JSON.stringify(raw)}, which the game reads as 0.`);
        }
    }
    const implicit = new Set(implicitPublishers(record).map((p) => p.t));
    const byGroup = new Map();
    for (const m of members) {
        if (m.role === 'cross-room') continue;
        if (m.role === 'publisher' && m.t < 0) {
            add(LINK_ISSUES.PUBLISHER_SENTINEL, 'warn', `<${m.type}> at (${m.x},${m.y}) publishes sentinel group ${m.t}, `
                + 'which also reaches every entity using that value for its own meaning.');
        }
        if (m.t < 0) continue;
        if (!byGroup.has(m.t)) byGroup.set(m.t, { publishers: [], responders: [] });
        byGroup.get(m.t)[m.role === 'publisher' ? 'publishers' : 'responders'].push(m);
    }
    for (const [t, g] of [...byGroup.entries()].sort((a, b) => a[0] - b[0])) {
        const names = (list) => list.map((m) => `<${m.type}> at (${m.x},${m.y})`).join(', ');
        if (g.responders.length && !g.publishers.length && !implicit.has(t)) {
            add(LINK_ISSUES.GROUP_NO_PUBLISHER, 'warn', `group ${t} has no publisher in this room: ${names(g.responders)} `
                + 'will never be activated from here.');
        }
        if (g.publishers.length && !g.responders.length) {
            add(LINK_ISSUES.GROUP_NO_RESPONDER, 'warn', `group ${t} has no responder in this room: ${names(g.publishers)} `
                + 'will do nothing.');
        }
    }
    return out;
}

/** ⛓ The sentence a save refuses with, or `null`. */
export function saveRefusal(record, { schema }) {
    const bad = linkIssues(record, { schema }).filter((i) => i.severity === 'refuse');
    return bad.length ? `⛔ not saved: ${bad.map((i) => i.message).join(' ')}` : null;
}

/**
 * ⛓⛓ WHICH WIRES SOLVE CANNOT SEE, by name, so a green SOLVE does not imply a check of them. A responder counts as
 * modelled when the model's own `groupResponders` lists it for its group, so this asks the model and keeps no
 * list of its own. `buildWorld` is injected: which model is being asked is the host's fact.
 */
export function solverNotes(record, { schema, buildWorld }) {
    if (!buildWorld) return [];
    let world;
    try {
        world = buildWorld(record, { roles: ROLES });
    } catch (e) {
        return [`SOLVE's model cannot build this room, so nothing about its links is checked: ${e.message}`];
    }
    const out = [];
    const seen = new Set();
    for (const l of linksOf(record, { schema })) {
        if (l.kind === 'cross-room') {
            out.push(`SOLVE does not see <buttonroom> at (${l.from.x},${l.from.y}) writing flag ${l.flag} of level `
                + `${l.room}: it solves one room.`);
        } else if (l.kind === 'group' && l.implicit) {
            out.push(`<${l.from.type}> at (${l.from.x},${l.from.y}) publishes group ${l.group} with no attribute: this `
                + `editor cannot say whether SOLVE follows that to <${l.to.type}> at (${l.to.x},${l.to.y}).`);
        } else if (l.kind === 'group' && !seen.has(l.to.index)) {
            const known = groupResponders(world, l.group).some((r) => r.id === `${l.to.type}@${l.to.x},${l.to.y}`);
            if (!known) {
                seen.add(l.to.index);
                out.push(`SOLVE does not model <${l.to.type}> at (${l.to.x},${l.to.y}) answering group ${l.group}: `
                    + 'the game does, so a certified route says nothing about this wire.');
            }
        }
    }
    return out;
}
