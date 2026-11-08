/**
 * seedlingDemo/fidelityBindings — **THE EVENT-LAYER BINDINGS, ASKED OF THE GAME** (slice rules-sharedbinding-witnesses).
 *
 * ⚖ rules-4's ruling for R-A3, (c): *"later and per row: re-admit only with a GAME witness for the binding (ShieldLock
 * W-probe → L71 f2; the L63 pole probes → L63 f6/f1; the rest need a witness named)"* — ⚖ the user (2026-11-04): *"(c)
 * after R-A3 lands"*.
 *
 * The derived-rule table (`derivedRuleRows.derivedRuleTable`) holds out every element whose derived rule names an
 * event-layer event (`sharedBinding`): the maze lays that obstacle from the rules producer's OWN event layer (which
 * entity, which event, which side), so a wrong entity ↔ event binding would agree on both sides and no certifier could
 * see it. Only the game can. Each witness here is one event's binding put to the game: a `clear-tag` goal on the
 * event's own flag, its `obstacle` (and `presser`) the event's own, solved by the solver from a boot beside the entity
 * and played by `probe-seedling-cleartag.mjs --set=bindings` with every clear-tag arm (`fidelityClearTag.clearTagArms`:
 * the solve, and the two cuts around the model's write tick T) — and ONE more check per arm: the event-layer flags in
 * the game's `persistence_cleared` are EXACTLY the bound one after the write (nothing before it). A write of a flag the
 * layer gives ANOTHER event would be the wrong-binding defect; a write the layer binds to nothing (a ButtonRoom's own
 * tag) is recorded, not a defect.
 *
 *   · `L71-2-from-L80`  — `shieldlock@288,256` {71,2}: the CLEARTAG witness itself (the shield `touch`, ShieldLock's
 *                         W probe, `ShieldLock.as:32`), re-asked here under the exact-flag check;
 *   · `L63-6-north`     — `lightpole@48,272` {63,6}: one Spear thrust E from the pole's north side [2,16] (the arrival
 *                         [2,18] below darktrap@32,272 is out of reach: `probe-seedling-l63-darktrap.mjs`'s
 *                         `left-arrival-thrust-e`). The verb needs `inRoomPoleThrust` (the PLAN's switch);
 *   · `L63-1-from-L62`  — `buttonroom@176,40` in L61 {room 63, tset 1}: the cross-room press (`ButtonRoom.as:93`) that
 *                         lights `lightpole@64,88` in L63, from L62's landing (160,16). It also writes its own {61,1},
 *                         which no event of the layer reads.
 *
 * The ledger `scripts/procgen/seedling-binding-witnesses.json` names, per event, the witness and the recorded game
 * result; `plan-seedling-binding-witness.mjs --check` re-derives every entry from its committed tape and the recording.
 */

import { CLEARTAG_WITNESSES } from './fidelityClearTag.js';

const L71 = CLEARTAG_WITNESSES.find((w) => w.key === 'L71-2-from-L80');

export const BINDING_WITNESSES = Object.freeze([
    Object.freeze({ ...L71, event: 'L71 flag 2: shieldlock@288,256 cleared' }),
    Object.freeze({ key: 'L63-6-north', boot: { level: 63, x: 32, y: 256 }, items: ['hasSword', 'hasSpear'],
        fidelity: Object.freeze({ inRoomPoleThrust: true }),
        goal: Object.freeze({ kind: 'clear-tag', tag: { level: 63, tag: 6 }, at: { x: 48, y: 272 },
            obstacle: 'lightpole@48,272' }),
        verb: 'pole', onRoute: 'L65 r0c2 -> L63 r10c2 (the arrival below darktrap@32,272)',
        event: 'L63 flag 6: lightpole@48,272 cleared' }),
    Object.freeze({ key: 'L63-1-from-L62', boot: { level: 61, x: 160, y: 16 }, items: [],
        goal: Object.freeze({ kind: 'clear-tag', tag: { level: 63, tag: 1 }, at: { x: 64, y: 88 },
            obstacle: 'lightpole@64,88', presser: { level: 61, class: 'buttonroom', x: 176, y: 40 } }),
        verb: 'cross-room-press', onRoute: 'L63 flag 1 @L61 r0c10 (L62 -> L61 lands at (160,16))',
        event: 'L63 flag 1: lightpole@64,88 cleared' }),
]);

/** `flag:L<level>:<tag>` → the event the compiled rules document (player '1') places for it. */
export function eventLayerFlags(rules) {
    const out = new Map();
    for (const r of Object.values(rules.regions['1'])) {
        for (const l of r.locations ?? []) {
            const m = /^flag:L(\d+):(\d+)$/.exec(l.event_id ?? '');
            if (l.event && m) out.set(`${Number(m[1])}:${Number(m[2])}`, { name: l.item?.name ?? l.name, location: l });
        }
    }
    return out;
}

/**
 * The game's (or the model's) cleared flags, split by the event layer: `bound` = the event names the layer gives
 * the written flags (sorted), `unbound` = writes the layer binds to no event (`level:tag`).
 */
export function splitWrites(cleared, layer) {
    const bound = [];
    const unbound = [];
    for (const c of cleared ?? []) {
        const k = `${c.level}:${c.tag}`;
        if (layer.has(k)) bound.push(layer.get(k).name); else unbound.push(k);
    }
    return { bound: [...new Set(bound)].sort(), unbound: [...new Set(unbound)].sort() };
}

/**
 * Why the witness `w` does not put the layer's own binding to the game, or [] — the event exists, its `event_id` is
 * the goal's flag, its `obstacle` is the goal's obstacle, and a `presser` (cross-room) is the event's presser.
 */
export function bindingMismatches(w, rules) {
    const layer = eventLayerFlags(rules);
    const k = `${w.goal.tag.level}:${w.goal.tag.tag}`;
    const ev = layer.get(k);
    if (!ev) return [`${w.key}: the event layer places no event for {${k}}`];
    const out = [];
    if (ev.name !== w.event) out.push(`${w.key}: {${k}} is the layer's "${ev.name}", the witness names "${w.event}"`);
    const o = ev.location.obstacle ?? {};
    if (`${o.class}@${o.x},${o.y}` !== w.goal.obstacle) out.push(`${w.key}: the layer's obstacle ${o.class}@${o.x},${o.y} ≠ the goal's ${w.goal.obstacle}`);
    const p = ev.location.action?.presser ?? null;
    const q = w.goal.presser ?? null;
    if (JSON.stringify(p && { level: p.level, class: p.class, x: p.x, y: p.y }) !== JSON.stringify(q && { level: q.level, class: q.class, x: q.x, y: q.y })) {
        out.push(`${w.key}: the layer's presser ${JSON.stringify(p)} ≠ the goal's ${JSON.stringify(q)}`);
    }
    return out;
}
