/**
 * The substrate status strip: a slim bar above a substrate's game iframe saying what Archipelago is
 * doing in this region. It shows the level's items (held or locked), recent finds, sends and receipts,
 * this region's checks, its exits and the Playback Bot. The model is `statusStripModel.js` (pure, unit-tested);
 * this file is the view and its wiring to host events. Nothing here talks to the game page: everything
 * is host state (the region payload, the stateManager's static data and snapshot, the client), plus
 * the bot reports a page may send (`substrate:botStatus`, relayed by the flash bridge).
 *
 * Generic: the panel factory (`flashSubstratePanel.js`) mounts it when a substrate passes
 * `statusStrip: { loadRegionEvent, playbackControlEvent?, describeLevel? }`. `describeLevel(world)` is
 * the substrate's own part: → { items: [{name, kind?, note?, color?}], notes?: [text] } or null.
 *
 * It never takes focus from the game: its one control (expand/collapse) prevents the pointer's
 * focus change, and it is not in the tab order.
 */

import eventBus from '../../app/core/eventBus.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import {
    levelItemRows, checkRows, exitRows, needsText, shortName,
    createActivityLog, createBotStatus,
} from './statusStripModel.js';

const EXPANDED_KEY = 'flashsub.statusStrip.expanded';
/** The eventBus event the flash bridge relays a game page's bot reports on ({region, event}). */
export const BOT_STATUS_EVENT = 'substrate:botStatus';

const clientFn = (name) => centralRegistry?.getPublicFunction?.('client', name) ?? null;

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
}

function readExpanded() {
    try { return globalThis.localStorage?.getItem(EXPANDED_KEY) === '1'; } catch { return false; }
}
function writeExpanded(v) {
    try { globalThis.localStorage?.setItem(EXPANDED_KEY, v ? '1' : '0'); } catch { /* per-viewer convenience only */ }
}

/** Host lookups the model's activity log needs (connected room first, the rules file offline). */
export function hostWho() {
    const connected = () => clientFn('getConnectionInfo')?.()?.isHandshakeComplete === true;
    const staticData = () => stateManager?.getStaticData?.() ?? null;
    return {
        connected,
        ownSlot: () => (connected() ? clientFn('getConnectionInfo')?.()?.slot ?? null : staticData()?.playerId ?? null),
        playerName: (slot) => (connected() ? null : staticData()?.player_names?.[String(slot)] ?? null),
        locationItem: (location) => {
            if (connected()) {
                const hit = (clientFn('getScoutedLocations')?.() ?? []).find((e) => e?.locationName === location);
                return hit ? { item: hit.itemName ?? null, player: hit.player ?? null, playerName: hit.playerName ?? null } : null;
            }
            const locs = staticData()?.locations;
            const loc = locs instanceof Map ? locs.get(location) : locs?.[location];
            return loc?.item ? { item: loc.item.name ?? null, player: loc.item.player ?? null } : null;
        },
    };
}

export class SubstrateStatusStrip {
    /**
     * @param {object} cfg
     * @param {string} cfg.moduleName           eventBus subscriber id
     * @param {string} cfg.loadRegionEvent      the substrate's loadRegion event (the payload it plays)
     * @param {string} [cfg.playbackControlEvent]  the substrate's playback-proxy event (the bot's walks)
     * @param {function} [cfg.describeLevel]   world → { items, notes } | null
     * @param {object} [cfg.who]               activity-log lookups (default hostWho())
     * @param {object} [cfg.bus]               an eventBus (default the app's)
     * @param {object} [cfg.state]             { getStaticData, getLatestStateSnapshot } (default the stateManager proxy)
     */
    constructor({ moduleName, loadRegionEvent, playbackControlEvent = null, describeLevel = null, who = null, bus = eventBus, state = stateManager }) {
        this.moduleName = `${moduleName}:statusStrip`;
        this.describeLevel = describeLevel;
        this.bus = bus;
        this.state = state;
        this.region = null;          // { id, world }
        this.expanded = readExpanded();
        this.log = createActivityLog({ limit: 8, who: who ?? hostWho(), where: (l) => shortName(l, l.split('__')[0]) });
        this.bot = createBotStatus({ describeTarget: (t) => this._describeTarget(t) });
        this._unsubs = [];
        this._build();
        this._subscribe(loadRegionEvent, playbackControlEvent);
        // Seed the log's baseline from whatever snapshot is there now (a panel opened mid-game).
        this._onSnapshot(this.state?.getLatestStateSnapshot?.() ?? null);
        this.render();
    }

    get element() { return this.root; }

    _build() {
        this.root = el('div', 'flashsub-strip');
        this.root.setAttribute('data-testid', 'substrate-status-strip');
        this.root.hidden = true;
        // A read-only handle for the in-app rows and probes (`.model()`); nothing in the app reads it.
        this.root.__statusStrip = this;
        this.summary = el('div', 'flashsub-strip-summary');
        this.itemsEl = el('span', 'flashsub-strip-items');
        this.itemsEl.dataset.section = 'items';
        this.checksEl = el('span', 'flashsub-strip-pill');
        this.checksEl.dataset.section = 'checks';
        this.exitsEl = el('span', 'flashsub-strip-exits');
        this.exitsEl.dataset.section = 'exits';
        this.toggle = el('button', 'flashsub-strip-toggle');
        this.toggle.type = 'button';
        this.toggle.tabIndex = -1;
        // Keep the game's keyboard focus: a pointer press on the toggle would move focus out of the iframe.
        this.toggle.addEventListener('pointerdown', (e) => e.preventDefault());
        this.toggle.addEventListener('mousedown', (e) => e.preventDefault());
        this.toggle.addEventListener('click', () => {
            this.expanded = !this.expanded;
            writeExpanded(this.expanded);
            this.render();
        });
        this.summary.append(this.itemsEl, this.checksEl, this.exitsEl, this.toggle);
        this.line = el('div', 'flashsub-strip-line');
        this.activityEl = el('span', 'flashsub-strip-activity');
        this.activityEl.dataset.section = 'activity';
        this.botEl = el('span', 'flashsub-strip-bot');
        this.botEl.dataset.section = 'bot';
        this.line.append(this.activityEl, this.botEl);
        this.details = el('div', 'flashsub-strip-details');
        this.root.append(this.summary, this.line, this.details);
    }

    _on(event, handler) {
        if (!event || !this.bus?.subscribe) return;
        this.bus.subscribe(event, handler, this.moduleName);
        this._unsubs.push(() => this.bus.unsubscribe?.(event, handler, this.moduleName));
    }

    _subscribe(loadRegionEvent, playbackControlEvent) {
        this._on(loadRegionEvent, (p) => {
            if (!p?.region_id) return;
            if (this.region?.id !== p.region_id) this.bot.reset();
            this.region = { id: p.region_id, world: p.world ?? {} };
            this.render();
        });
        this._on('stateManager:snapshotUpdated', (d) => { this._onSnapshot(d?.snapshot ?? null); this.render(); });
        // A new world: its checks and inventory are not news.
        // Its snapshot is the baseline (the next snapshot may already be a grant or a find).
        this._on('stateManager:rulesLoaded', (d) => {
            this.log.clear();
            this._onSnapshot(d?.snapshot ?? this.state?.getLatestStateSnapshot?.() ?? null);
            this.region = null;
            this.bot.reset();
            this.render();
        });
        // A (re)connect resyncs the room's checks and items: the next snapshot is a baseline, not finds.
        this._on('game:connected', () => this.log.rebaseline());
        this._on('game:itemsReceived', (d) => {
            if (!Array.isArray(d?.items)) return;     // an older client: no item detail
            this.log.noteReceived(d.items, { index: d.index ?? null });
            this.render();
        });
        this._on(playbackControlEvent, (d) => {
            if (!d?.method) return;
            this.bot.noteCommand(d.method, Array.isArray(d.args) ? d.args : []);
            this.render();
        });
        this._on(BOT_STATUS_EVENT, (d) => {
            if (!this.region || d?.region !== this.region.id) return;
            this.bot.noteEvent(d.event);
            this.render();
        });
    }

    _onSnapshot(snapshot) {
        if (!snapshot) return;
        this.log.noteSnapshot({ checked: snapshot.checkedLocations, inventory: snapshot.inventory });
        this.bot.noteChecked(snapshot.checkedLocations);
    }

    _describeTarget(t) {
        if (!t) return '?';
        const id = this.region?.id ?? null;
        if (t.kind === 'location') return shortName(t.name, id);
        if (t.kind === 'exit') {
            const exits = this.region?.world?.exits;
            const list = exits instanceof Map ? [...exits.values()] : (Array.isArray(exits) ? exits : []);
            const bare = shortName(t.name, id);
            const e = list.find((x) => x?.exitName === bare || x?.exit_id === bare || x?.exitName === t.name);
            return e?.label ?? (e?.targetRegion ? `to ${e.targetRegion}` : bare);
        }
        return t.name ?? t.kind ?? '?';
    }

    /** The strip's current model (also what the in-app rows read). */
    model() {
        const snap = this.state?.getLatestStateSnapshot?.() ?? null;
        const sd = this.state?.getStaticData?.() ?? null;
        const inventory = snap?.inventory ?? {};
        const playerId = sd?.playerId ?? '1';
        const world = this.region?.world ?? {};
        let level = null;
        try { level = this.describeLevel ? this.describeLevel(world) : null; } catch (err) {
            console.warn(`[${this.moduleName}] describeLevel threw:`, err);
        }
        return {
            region: this.region?.id ?? null,
            items: levelItemRows(level?.items ?? [], inventory).map((r, i) => ({ ...r, color: level.items[i].color ?? null })),
            notes: level?.notes ?? [],
            checks: checkRows({ apLocations: world.ap_locations, regionId: this.region?.id, checked: snap?.checkedLocations, locations: sd?.locations, inventory, playerId }),
            exits: exitRows({ exits: world.exits, regionId: this.region?.id, staticExits: sd?.exits, inventory, playerId }),
            activity: this.log.entries,
            bot: this.bot.state,
        };
    }

    render() {
        if (!this.root) return;
        if (!this.region) { this.root.hidden = true; return; }
        this.root.hidden = false;
        const m = this.model();
        this.root.dataset.region = m.region;

        // Items: one chip each.
        this.itemsEl.replaceChildren(...m.items.map((it) => {
            const c = el('span', `flashsub-strip-item ${it.held ? 'is-held' : 'is-locked'}`);
            c.dataset.item = it.name;
            c.dataset.state = it.held ? 'held' : 'locked';
            if (it.color) c.style.setProperty('--item-color', it.color);
            c.title = `${it.name}: ${it.held ? 'held' : 'locked'}${it.note ? ` (${it.note})` : ''}`;
            c.append(el('span', 'flashsub-strip-mark', it.held ? '✓' : '🔒'), document.createTextNode(it.name));
            return c;
        }));
        if (!m.items.length) this.itemsEl.append(el('span', 'flashsub-strip-dim', 'no items'));

        // Checks: k/n.
        this.checksEl.textContent = `Checks ${m.checks.collected}/${m.checks.total}`;
        this.checksEl.dataset.collected = String(m.checks.collected);
        this.checksEl.dataset.total = String(m.checks.total);
        this.checksEl.classList.toggle('is-done', m.checks.total > 0 && m.checks.collected === m.checks.total);

        // Exits: side + state.
        this.exitsEl.replaceChildren(...m.exits.map((x) => {
            const c = el('span', `flashsub-strip-exit is-${x.state}`);
            c.dataset.exit = x.name ?? '';
            c.dataset.state = x.state;
            c.title = `${x.label}: ${x.state === 'open' ? 'open' : needsText(x)}`;
            c.append(el('span', 'flashsub-strip-mark', x.state === 'open' ? '→' : '🔒'), document.createTextNode(sideLabel(x)));
            return c;
        }));

        this.toggle.textContent = this.expanded ? '▴' : '▾';
        this.toggle.setAttribute('aria-expanded', String(this.expanded));
        this.toggle.title = this.expanded ? 'Hide details' : 'Show details';

        // Line: the latest activity, the bot.
        const latest = m.activity[0];
        this.activityEl.textContent = latest ? latest.text : '';
        this.activityEl.dataset.kind = latest?.kind ?? '';
        if (latest && this._lastSeq !== latest.seq) {
            this._lastSeq = latest.seq;
            this.activityEl.classList.remove('is-new');
            void this.activityEl.offsetWidth;     // restart the highlight
            this.activityEl.classList.add('is-new');
        }
        const botText = botLine(m.bot);
        this.botEl.textContent = botText ?? '';
        this.botEl.hidden = !botText;
        this.line.hidden = !latest && !botText;

        // Details.
        this.details.hidden = !this.expanded;
        if (this.expanded) this.details.replaceChildren(...this._detailSections(m));
    }

    _detailSections(m) {
        const sec = (title, rows) => {
            const s = el('div', 'flashsub-strip-sec');
            s.append(el('div', 'flashsub-strip-h', title));
            const ul = el('ul');
            for (const r of rows) ul.append(r);
            s.append(ul);
            return s;
        };
        const li = (text, cls = '') => el('li', cls, text);
        const out = [];
        out.push(sec(`This level (${m.region})`, [
            ...m.items.map((it) => li(`${it.held ? '✓' : '🔒'} ${it.name}: ${it.held ? 'held' : 'locked'}${it.note ? ` (${it.note})` : ''}`, it.held ? 'is-held' : 'is-locked')),
            ...m.notes.map((n) => li(n, 'flashsub-strip-dim')),
        ]));
        out.push(sec(`Checks ${m.checks.collected}/${m.checks.total}`, m.checks.rows.map((r) => li(
            `${r.state === 'checked' ? '✓' : (r.state === 'open' ? '○' : '🔒')} ${r.label}: ${
                r.state === 'checked' ? 'collected' : (r.state === 'open' ? 'reachable' : needsText(r))}`, `is-${r.state}`))));
        out.push(sec('Exits', m.exits.map((x) => li(`${x.state === 'open' ? '→' : '🔒'} ${sideLabel(x)} (${x.label}): ${x.state === 'open' ? 'open' : needsText(x)}`, `is-${x.state}`))));
        out.push(sec('Recent', m.activity.length ? m.activity.map((a) => li(a.text, `is-${a.kind}`)) : [li('nothing yet', 'flashsub-strip-dim')]));
        const b = botLine(m.bot);
        if (b) out.push(sec('Bot', [li(b)]));
        return out;
    }

    destroy() {
        for (const u of this._unsubs) { try { u(); } catch { /* already gone */ } }
        this._unsubs = [];
        this.root?.remove();
        this.root = null;
    }
}

const SIDE_NAMES = { N: 'North', E: 'East', S: 'South', W: 'West', north: 'North', east: 'East', south: 'South', west: 'West' };
function sideLabel(x) {
    return SIDE_NAMES[x.side] ?? x.label ?? x.name ?? '?';
}

/** The bot line: "Bot → loc_0 · ladder: skipped to checkpoint 1", or null when the bot is idle. */
export function botLine(bot) {
    if (!bot) return null;
    if (!bot.active && !bot.result && !bot.note) return null;
    const parts = [];
    if (bot.label) parts.push(`Bot → ${bot.label}`);
    else parts.push('Bot');
    if (bot.note) parts.push(bot.note);
    if (bot.result && !bot.active) parts.push(bot.result);
    return parts.join(' · ');
}
