/**
 * The substrate status strip's MODEL: what the strip above a substrate's game iframe shows, computed
 * from host state alone (the region payload, the stateManager's static data and snapshot, the client's
 * connection). Pure: no DOM, no eventBus. The view and its wiring are `statusStrip.js`; a substrate's
 * own facts (which items its level uses) come from the `describeLevel` hook the substrate hands the
 * panel factory (Cloudberry: `cloudberryDemo/cloudberryStatus.js`).
 *
 * Sections:
 *   - level items   — the items the level uses, each HELD or LOCKED (the substrate says which items);
 *   - activity      — a short rolling log: "You found X", "Sent X to <player>", "Received X from <player>";
 *   - checks        — this region's locations: k of n collected, each one's state;
 *   - exits         — each exit: open, or locked with the items it still needs;
 *   - bot           — what the Playback Bot walks to, and the game's bot notes (ladders, restarts).
 *
 * Checks and exits are judged by the region's OWN logic (each location's and exit's `access_rule`
 * from static data) against the live inventory, so the strip never disagrees with the tracker. A rule
 * the inventory alone cannot decide shows as `unknown`, never as open.
 *
 * Names: a player's name comes only from what the client knows (the connected room's slot info, the
 * rules file's `player_names`). Without one the strip says "player <slot>", never a made-up name.
 */

import { evaluateRuleWithInventory } from '../shared/procgen/library.js';

/** Held count of an item in a snapshot inventory ({name: count} or a Map). */
export function heldCount(inventory, name) {
    if (!inventory) return 0;
    const n = inventory instanceof Map ? inventory.get(name) : inventory[name];
    return Number(n) > 0 ? Number(n) : 0;
}

function asInventoryMap(inventory) {
    if (inventory instanceof Map) return inventory;
    return new Map(inventory && typeof inventory === 'object' ? Object.entries(inventory) : []);
}

/**
 * The items a rule still needs, for the strip's "needs …" text.
 * Returns { missing: [names], anyOf: bool } — `anyOf` when ONE of `missing` would do (Or / HasAny).
 * Only the plain item vocabulary is read (Has, HasAll, HasAny, And, Or, True); anything else
 * returns null (the caller shows "locked" with no list rather than a wrong one).
 */
export function missingItems(rule, inventory) {
    if (!rule || typeof rule !== 'object') return { missing: [], anyOf: false };
    const held = (n) => heldCount(inventory, n) > 0;
    const args = rule.args ?? {};
    switch (rule.rule) {
        case 'True':
            return { missing: [], anyOf: false };
        case 'Has': {
            const need = Number(args.count ?? 1);
            return { missing: heldCount(inventory, args.item_name) >= need ? [] : [args.item_name], anyOf: false };
        }
        case 'HasAll':
            return { missing: (args.item_names ?? []).filter((n) => !held(n)), anyOf: false };
        case 'HasAny': {
            const names = args.item_names ?? [];
            return { missing: names.some(held) ? [] : [...names], anyOf: true };
        }
        case 'And': {
            const out = [];
            for (const child of rule.children ?? []) {
                const m = missingItems(child, inventory);
                if (m === null) return null;
                if (m.anyOf && m.missing.length > 1) return null; // an Or inside an And: not a flat list
                for (const n of m.missing) if (!out.includes(n)) out.push(n);
            }
            return { missing: out, anyOf: false };
        }
        case 'Or': {
            const kids = (rule.children ?? []).map((c) => missingItems(c, inventory));
            if (kids.some((m) => m === null)) return null;
            if (kids.some((m) => m.missing.length === 0)) return { missing: [], anyOf: false };
            if (kids.every((m) => m.missing.length === 1)) {
                return { missing: [...new Set(kids.map((m) => m.missing[0]))], anyOf: true };
            }
            return null;
        }
        default:
            return null;
    }
}

/** 'open' | 'locked' | 'unknown' for a rule over an inventory (an absent rule is open). */
export function ruleState(rule, inventory, playerId = '1') {
    if (rule === undefined || rule === null) return 'open';
    const v = evaluateRuleWithInventory(rule, asInventoryMap(inventory), String(playerId ?? '1'));
    if (v === true) return 'open';
    if (v === false) return 'locked';
    return 'unknown';
}

/** A location or exit name without its `<region>__` prefix (the strip's short label). */
export function shortName(name, regionId) {
    if (typeof name !== 'string') return '';
    const prefix = regionId ? `${regionId}__` : null;
    return prefix && name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

function asSet(checked) {
    if (checked instanceof Set) return checked;
    if (Array.isArray(checked)) return new Set(checked);
    if (checked && typeof checked === 'object') return new Set(Object.keys(checked).filter((k) => checked[k]));
    return new Set();
}

const mapGet = (m, k) => (m instanceof Map ? m.get(k) : m?.[k]);

/**
 * Level items: `items` = [{ name: AP item name, kind?: string, note?: string }] (from the substrate's
 * describeLevel) → [{ name, kind, note, held }].
 */
export function levelItemRows(items, inventory) {
    return (items ?? []).map((it) => ({
        name: it.name,
        kind: it.kind ?? 'item',
        ...(it.note ? { note: it.note } : {}),
        held: heldCount(inventory, it.name) > 0,
    }));
}

/**
 * This region's checks. `apLocations` = the payload's {gameName: AP location name} (or a list of AP
 * names); `locations` = static data's locations (Map or object, each with `access_rule`).
 * → { collected, total, rows: [{ location, label, state: 'checked'|'open'|'locked'|'unknown', missing? }] }
 */
export function checkRows({ apLocations, regionId, checked, locations, inventory, playerId = '1' }) {
    const names = Array.isArray(apLocations) ? apLocations : Object.values(apLocations ?? {});
    const done = asSet(checked);
    const rows = names.filter((n) => typeof n === 'string' && n).map((location) => {
        const label = shortName(location, regionId);
        if (done.has(location)) return { location, label, state: 'checked' };
        const rule = mapGet(locations, location)?.access_rule;
        const state = ruleState(rule, inventory, playerId);
        const row = { location, label, state };
        if (state === 'locked') {
            const m = missingItems(rule, inventory);
            if (m) { row.missing = m.missing; row.anyOf = m.anyOf; }
        }
        return row;
    });
    return { collected: rows.filter((r) => r.state === 'checked').length, total: rows.length, rows };
}

/**
 * The static-data exit that is the payload exit `e` of region `regionId`: by name (bare or
 * region-prefixed), else the region's one exit to `e.targetRegion`.
 */
export function findStaticExit(staticExits, regionId, e) {
    if (!staticExits) return null;
    const values = staticExits instanceof Map ? [...staticExits.values()] : Object.values(staticExits);
    const parentOf = (x) => x?.parentRegion ?? x?.parent_region ?? x?.region ?? null;
    const mine = values.filter((x) => parentOf(x) === regionId);
    const names = [e?.exitName, e?.exit_id, e?.exitId].filter((n) => typeof n === 'string' && n);
    for (const n of names) {
        const hit = mine.find((x) => x?.name === n || x?.name === `${regionId}__${n}`);
        if (hit) return hit;
    }
    const target = e?.targetRegion;
    if (typeof target === 'string' && target) {
        const to = mine.filter((x) => (x?.connectedRegion ?? x?.connected_region) === target);
        if (to.length === 1) return to[0];
    }
    return null;
}

/**
 * This region's exits. `exits` = the payload's exits (Map or list of {exitName, exit_id, side,
 * targetRegion, label}). → [{ name, side, label, target, state, missing?, anyOf? }]
 * An exit without a static match is 'unknown' (its rule is not known here).
 */
export function exitRows({ exits, regionId, staticExits, inventory, playerId = '1' }) {
    const list = exits instanceof Map ? [...exits.values()] : (Array.isArray(exits) ? exits : []);
    return list.filter(Boolean).map((e) => {
        const target = typeof e.targetRegion === 'string' ? e.targetRegion : null;
        const row = {
            name: e.exitName ?? e.exit_id ?? null,
            side: e.side ?? null,
            label: typeof e.label === 'string' && e.label ? e.label : (target ? `to ${target}` : (e.exitName ?? '?')),
            target,
        };
        const st = findStaticExit(staticExits, regionId, e);
        if (!st) return { ...row, state: 'unknown' };
        row.state = ruleState(st.access_rule, inventory, playerId);
        if (row.state === 'locked') {
            const m = missingItems(st.access_rule, inventory);
            if (m) { row.missing = m.missing; row.anyOf = m.anyOf; }
        }
        return row;
    });
}

/** "needs Clouds and Moving Blocks" / "needs Clouds or Jetpack" / "locked". */
export function needsText(row) {
    if (!row?.missing?.length) return row?.state === 'unknown' ? 'not known here' : 'locked';
    const ms = row.missing;
    const joiner = row.anyOf ? ' or ' : ' and ';
    return `needs ${ms.length <= 2 ? ms.join(joiner) : `${ms.slice(0, -1).join(', ')}${joiner}${ms[ms.length - 1]}`}`;
}

/**
 * The rolling activity log.
 *
 * `who` = { ownSlot: () => slot|null, playerName: (slot) => name|null,
 *           locationItem: (locationName) => { item, player, playerName? } | null, connected: () => bool }
 *
 * - noteSnapshot({checked, inventory}): a location newly in `checked` is a FIND — "You found X" when
 *   its item is the own slot's, "Sent X to <player>" otherwise. While not connected, an inventory
 *   increase that no find of the same snapshot explains is "Received X" (no sender is claimed: offline,
 *   the source may be a starting item, a test grant or the spoiler sync). The first snapshot after
 *   `rebaseline()` only records the baseline. `where(location)` names a location in the text (the view
 *   passes its short name).
 * - noteReceived(items, {index}): the server's received items ({itemName, senderSlot, senderName});
 *   an item the own slot sent itself is skipped (its find is logged already); index 0 (a full resync)
 *   logs one "Synced N items" line instead of one per item.
 */
export function createActivityLog({ limit = 8, who = {}, where = (location) => location } = {}) {
    let entries = [];
    let seq = 0;
    let baseChecked = null;
    let baseInv = null;
    const ownSlot = () => (who.ownSlot?.() ?? null);
    const nameOf = (slot) => {
        const n = slot === null || slot === undefined ? null : who.playerName?.(slot);
        return typeof n === 'string' && n ? n : (slot === null || slot === undefined ? 'another player' : `player ${slot}`);
    };
    const push = (e) => {
        entries = [{ ...e, seq: ++seq }, ...entries].slice(0, limit);
        return entries[0];
    };
    return {
        rebaseline() { baseChecked = null; baseInv = null; },
        clear() { entries = []; baseChecked = null; baseInv = null; },
        get entries() { return entries.slice(); },
        noteSnapshot({ checked, inventory } = {}) {
            const now = asSet(checked);
            const inv = inventory instanceof Map ? Object.fromEntries(inventory) : { ...(inventory ?? {}) };
            if (baseChecked === null) { baseChecked = now; baseInv = inv; return []; }
            const added = [];
            const credit = new Map();   // items the own finds of this snapshot explain
            for (const location of now) {
                if (baseChecked.has(location)) continue;
                const info = who.locationItem?.(location) ?? null;
                const item = info?.item ?? null;
                const mine = info && (info.player === null || info.player === undefined
                    || String(info.player) === String(ownSlot()));
                if (!info || !item) {
                    added.push(push({ kind: 'found', location, item: null, text: `Checked ${where(location)}` }));
                } else if (mine) {
                    credit.set(item, (credit.get(item) ?? 0) + 1);
                    added.push(push({ kind: 'found', location, item, text: `You found ${item} (${where(location)})` }));
                } else {
                    const to = typeof info.playerName === 'string' && info.playerName ? info.playerName : nameOf(info.player);
                    added.push(push({ kind: 'sent', location, item, player: info.player, to, text: `Sent ${item} to ${to} (${where(location)})` }));
                }
            }
            if (!who.connected?.()) {
                for (const [item, count] of Object.entries(inv)) {
                    let gain = (Number(count) || 0) - (Number(baseInv?.[item]) || 0);
                    gain -= credit.get(item) ?? 0;
                    for (; gain > 0; gain--) added.push(push({ kind: 'received', item, from: null, text: `Received ${item}` }));
                }
            }
            baseChecked = now;
            baseInv = inv;
            return added;
        },
        noteReceived(items, { index = null } = {}) {
            const list = Array.isArray(items) ? items : [];
            if (index === 0) {
                return list.length ? [push({ kind: 'sync', count: list.length, text: `Synced ${list.length} item${list.length === 1 ? '' : 's'} from the server` })] : [];
            }
            const added = [];
            for (const it of list) {
                if (!it?.itemName) continue;
                if (it.senderSlot !== null && it.senderSlot !== undefined && String(it.senderSlot) === String(ownSlot())) continue;
                const from = typeof it.senderName === 'string' && it.senderName ? it.senderName : nameOf(it.senderSlot);
                added.push(push({ kind: 'received', item: it.itemName, from, text: `Received ${it.itemName} from ${from}` }));
            }
            return added;
        },
    };
}

/**
 * The bot section's state. The HOST side sees the walk commands (`noteCommand`: the playback proxy's
 * {method, args}); a game page that reports its bot (`substrate:botStatus`) adds notes and results
 * (`noteEvent`). An event kind the strip does not know is shown by its `text`.
 * `describeTarget(target)` turns a walkTo target into a label (the view passes the region's names).
 */
export function createBotStatus({ describeTarget = (t) => t?.name ?? '?' } = {}) {
    let state = { active: false, target: null, label: null, note: null, result: null };
    const set = (patch) => { state = { ...state, ...patch }; return state; };
    return {
        get state() { return { ...state }; },
        reset() { return set({ active: false, target: null, label: null, note: null, result: null }); },
        noteCommand(method, args = []) {
            if (method === 'walkTo') {
                const target = args?.[0] ?? null;
                if (!target) return set({ active: false, target: null, label: null, note: null, result: null });
                return set({ active: true, target, label: describeTarget(target), note: null, result: null });
            }
            if (method === 'stop' || method === 'reset') {
                return set({ active: false, note: null, result: state.target ? 'stopped' : null });
            }
            return state;
        },
        /** A page that reports no results (an older page): a walk to a location ends when the location is checked. */
        noteChecked(checked) {
            const t = state.target;
            if (!state.active || t?.kind !== 'location' || !asSet(checked).has(t.name)) return state;
            return set({ active: false, result: 'reached' });
        },
        noteEvent(ev) {
            if (!ev || typeof ev !== 'object') return state;
            if (ev.kind === 'botNote') return set({ note: botNoteText(ev) });
            if (ev.kind === 'bot') {
                const result = typeof ev.result === 'string' ? ev.result : null;
                return set({
                    result,
                    note: ev.exhausted ? (typeof ev.text === 'string' ? ev.text : `gave up: ${ev.reason ?? 'retries exhausted'}`) : state.note,
                    active: result === null ? state.active : false,
                });
            }
            return typeof ev.text === 'string' ? set({ note: ev.text }) : state;
        },
    };
}

/**
 * A bot note's display text. Pieces are 0-based in the event, and piece k > 0 begins at checkpoint k
 * (piece 0 begins at the level's start), so the number the player reads is the piece index. An unknown
 * note kind shows its own `text`.
 */
export function checkpointName(piece) {
    return piece === 0 ? 'the start' : `checkpoint ${piece}`;
}

export function botNoteText(ev) {
    const ok = (k) => Number.isInteger(k) && k >= 0;
    switch (ev?.note) {
        case 'ladder':
            if (ok(ev.toPiece)) return `ladder: skipped to ${checkpointName(ev.toPiece)}`;
            break;
        case 'restart':
            if (ok(ev.piece)) {
                const tries = Number.isInteger(ev.attempt) && Number.isInteger(ev.maxAttempts) ? ` (try ${ev.attempt}/${ev.maxAttempts})` : '';
                return `${ev.reason ? ev.reason : 'died'}: restarting from ${checkpointName(ev.piece)}${tries}`;
            }
            break;
        default:
            break;
    }
    return typeof ev?.text === 'string' && ev.text ? ev.text : (ev?.note ? String(ev.note) : null);
}
