/**
 * Playback bot — sphere log replay UI mounted in the presets panel's
 * procgen-data section. Walks a loaded sphere log fractional-by-
 * fractional with the same controls as the maze visualizer
 * (instant/step/play/stop/reset, speed slider).
 *
 * v1 scope: pure viewer. The bot advances a cursor through sphere
 * entries and displays what each entry yielded (sphere_locations,
 * new accessible regions/locations, new inventory) without
 * publishing dispatcher events. The seed-1 debugging value is in
 * surfacing the recorded path interactively, NOT in driving other
 * panels — that comes in v1.1 once cross-region playback is
 * properly substrate-dispatched.
 *
 * Plan reference:
 * NewDocs/plans/procedural-generation/debugging-tools.md (Phase 5)
 */

import { PlaybackControlBar } from '../shared/playbackControlBar.js';
import { PlaybackClock } from '../shared/playbackClock.js';

const DEFAULT_RATE_HZ = 4;

export class PlaybackBotUI {
    constructor({ getSphereData, eventBus = null } = {}) {
        this._getSphereData = getSphereData;
        this._eventBus = eventBus;
        this._cursor = -1;
        this._log = [];
        this._completed = false;
        this._stuck = false;
        this._clock = new PlaybackClock({ onTick: () => this._tick() });
        this._element = null;
        this._cursorEl = null;
        this._logEl = null;
        this._controlBar = null;
        this._mount();
    }

    getElement() {
        return this._element;
    }

    destroy() {
        this._clock.stop();
        if (this._controlBar) this._controlBar.destroy();
        if (this._element?.parentNode) {
            this._element.parentNode.removeChild(this._element);
        }
        this._element = null;
    }

    // --- public controls ---

    instant() {
        if (this._completed) return;
        const SAFETY = 5000;
        let i = 0;
        while (!this._completed && i++ < SAFETY) {
            this._advance();
        }
        this._render();
    }

    step() {
        this._advance();
        this._render();
    }

    play(rateHz = DEFAULT_RATE_HZ) {
        if (this._completed) return;
        this._clock.start(rateHz);
        this._render();
    }

    stop() {
        this._clock.stop();
        this._render();
    }

    setRate(rateHz) {
        this._clock.setRate(rateHz);
    }

    reset() {
        this._clock.stop();
        this._cursor = -1;
        this._log = [];
        this._completed = false;
        this._stuck = false;
        this._render();
    }

    // --- internal ---

    _tick() {
        this._advance();
        this._render();
    }

    _advance() {
        if (this._completed) {
            this._clock.stop();
            return;
        }
        const data = this._getSphereData();
        if (!Array.isArray(data) || data.length === 0) {
            this._completed = true;
            this._clock.stop();
            this._log.push({
                type: 'error',
                description: 'No sphere log loaded.',
            });
            return;
        }
        this._cursor += 1;
        if (this._cursor >= data.length) {
            this._completed = true;
            this._clock.stop();
            this._log.push({
                type: 'done',
                description: `End of sphere log (${data.length} entries).`,
            });
            // Cap the cursor at length so the display reads "N / N (complete)".
            this._cursor = data.length;
            return;
        }
        const entry = data[this._cursor];
        this._log.push({
            type: 'step',
            sphereIndex: formatSphereIndex(entry),
            locations: Array.isArray(entry.locations) ? entry.locations : [],
            inventory: entry.inventory ?? entry.new_inventory_details?.base_items ?? null,
            accessibleRegions: entry.accessibleRegions ?? entry.new_accessible_regions ?? [],
            accessibleLocations: entry.accessibleLocations ?? entry.new_accessible_locations ?? [],
        });
    }

    _mount() {
        if (typeof document === 'undefined') return;
        const root = document.createElement('div');
        root.className = 'playback-bot';

        const heading = document.createElement('div');
        heading.className = 'playback-bot-heading';
        heading.textContent = 'Sphere log replay';
        root.appendChild(heading);

        this._controlBar = new PlaybackControlBar({
            label: 'Bot',
            actions: {
                instant: () => this.instant(),
                step:    () => this.step(),
                play:    (rateHz) => this.play(rateHz),
                stop:    () => this.stop(),
                reset:   () => this.reset(),
                setRate: (rateHz) => this.setRate(rateHz),
            },
        });
        const barEl = this._controlBar.getElement();
        if (barEl) root.appendChild(barEl);

        const cursorEl = document.createElement('div');
        cursorEl.className = 'playback-bot-cursor';
        root.appendChild(cursorEl);
        this._cursorEl = cursorEl;

        const logEl = document.createElement('div');
        logEl.className = 'playback-bot-log';
        root.appendChild(logEl);
        this._logEl = logEl;

        this._element = root;
        this._render();
    }

    _render() {
        if (!this._element) return;
        const data = this._getSphereData?.() ?? [];
        const total = data.length;
        const idx = this._cursor;

        if (this._controlBar) {
            this._controlBar.setRunning(this._clock.isRunning());
        }

        if (this._cursorEl) {
            if (idx < 0) {
                this._cursorEl.textContent = total > 0
                    ? `Cursor: idle (0 / ${total} entries)`
                    : 'No sphere log loaded — load a preset that has one (or whose rules.json embeds one).';
            } else if (this._completed) {
                this._cursorEl.textContent = `Cursor: ${total} / ${total}  (complete)`;
            } else {
                const entry = data[idx];
                const sphere = formatSphereIndex(entry);
                const locs = (entry?.locations ?? []).join(', ') || '(none)';
                this._cursorEl.textContent = `Cursor: ${idx + 1} / ${total}  ·  sphere ${sphere}  ·  ${locs}`;
            }
        }

        if (this._logEl) {
            // Explicit child removal — innerHTML='' isn't reliably
            // observable in headless test fakes.
            while (this._logEl.children?.length > 0) {
                this._logEl.removeChild(this._logEl.children[0]);
            }
            const TAIL = 30;
            const tail = this._log.slice(-TAIL);
            for (const entry of tail) {
                const row = document.createElement('div');
                row.className = `playback-bot-log-entry playback-bot-log-${entry.type}`;
                row.textContent = formatLogEntry(entry);
                this._logEl.appendChild(row);
            }
            if (this._log.length > TAIL) {
                const more = document.createElement('div');
                more.className = 'playback-bot-log-more';
                more.textContent = `(${this._log.length - TAIL} earlier entries hidden)`;
                this._logEl.insertBefore(more, this._logEl.children?.[0]);
            }
        }
    }
}

function formatSphereIndex(entry) {
    if (!entry) return '?';
    if (entry.sphereIndex != null && entry.fractionalIndex != null) {
        return entry.fractionalIndex > 0
            ? `${entry.sphereIndex}.${entry.fractionalIndex}`
            : String(entry.sphereIndex);
    }
    return String(entry.sphere_index ?? entry.sphereIndex ?? '?');
}

function formatLogEntry(entry) {
    if (!entry) return '';
    if (entry.type === 'step') {
        const parts = [`sphere ${entry.sphereIndex}`];
        if (entry.locations.length > 0) {
            parts.push(`locations: [${entry.locations.join(', ')}]`);
        }
        const newRegions = entry.accessibleRegions ?? [];
        if (newRegions.length > 0) {
            parts.push(`+regions: [${newRegions.join(', ')}]`);
        }
        const newLocs = entry.accessibleLocations ?? [];
        if (newLocs.length > 0) {
            parts.push(`+locations: [${newLocs.join(', ')}]`);
        }
        return parts.join('  ·  ');
    }
    if (entry.type === 'done') return entry.description;
    if (entry.type === 'error') return `! ${entry.description}`;
    return entry.description ?? entry.type;
}
