/**
 * Playback bot — remote control for the maze panel's playthrough
 * visualizer. Mounted in the presets panel's procgen-data section.
 *
 * The bot's controls publish `playback:command` events on the
 * eventBus; the maze panel subscribes and forwards them to its
 * visualizer. Cross-region playback is then driven by the
 * visualizer's exit-cross → user:regionMove → maze:loadRegion
 * chain, just as keyboard play would. The bot itself owns no
 * playback state — it's a remote, not a duplicate engine.
 *
 * Also displays a static "sphere log loaded: N entries" summary
 * so the user can confirm the loader picked up the log they
 * expected (separate file vs embedded fallback both reach this
 * widget identically).
 *
 * Plan reference:
 * NewDocs/plans/procedural-generation/debugging-tools.md (Phase 5)
 */

import { PlaybackControlBar } from '../shared/playbackControlBar.js';

const DEFAULT_RATE_HZ = 4;
const PLAYBACK_COMMAND_EVENT = 'playback:command';
const PUBLISHER_MODULE = 'presets';

/**
 * Build a Map<locationName, regionName> from stateManager's static
 * region data. Used by the bot to answer "which region does the next
 * sphere-log location live in?" without parsing names.
 *
 * `staticData.regions` is a Map<regionName, regionData> populated from
 * rules.json's per-player regions block; each regionData has a
 * `locations: [{ name, ... }]` array. Locations without a name are
 * skipped (defensive — shouldn't happen for a well-formed rules.json).
 *
 * Pure function — exported for testing.
 */
export function buildLocationIndex(staticData) {
    const index = new Map();
    const regions = staticData?.regions;
    if (!regions || typeof regions.entries !== 'function') return index;
    for (const [regionName, regionData] of regions.entries()) {
        const locations = regionData?.locations;
        if (!Array.isArray(locations)) continue;
        for (const loc of locations) {
            if (!loc?.name) continue;
            index.set(loc.name, regionName);
        }
    }
    return index;
}

/**
 * Flatten a sphere log into an ordered queue of locations the bot
 * should visit, in the order the AP fill assigned them.
 *
 * Consumes the parsed shape that `sphereState.getSphereData()`
 * returns (already filtered to state_update entries, already
 * scoped to the current player, already sorted by sphere index):
 *   [{ sphereIndex, fractionalIndex, locations: [name, ...], ... }]
 *
 * Locations whose region can't be resolved via the index are dropped
 * with no fanfare; the caller is expected to log if it cares (the
 * bot does, in its play loop).
 *
 * Pure function — exported for testing.
 *
 * Returns: [{ locationName, regionName, sphereIndex, fractionalIndex }, ...]
 *   sphereIndex / fractionalIndex are preserved verbatim so the bot's
 *   status line can show "Sphere 0.3 → ..." instead of just a queue
 *   index.
 */
export function buildSphereQueue(sphereData, locationIndex) {
    const queue = [];
    if (!Array.isArray(sphereData)) return queue;
    if (!locationIndex || typeof locationIndex.get !== 'function') return queue;
    for (const entry of sphereData) {
        const locations = entry?.locations;
        if (!Array.isArray(locations)) continue;
        for (const locationName of locations) {
            const regionName = locationIndex.get(locationName);
            if (!regionName) continue;
            queue.push({
                locationName,
                regionName,
                sphereIndex: entry.sphereIndex ?? null,
                fractionalIndex: entry.fractionalIndex ?? null,
            });
        }
    }
    return queue;
}

export class PlaybackBotUI {
    constructor({ getSphereData, eventBus = null } = {}) {
        this._getSphereData = getSphereData;
        this._eventBus = eventBus;
        this._rate = DEFAULT_RATE_HZ;
        this._element = null;
        this._statusEl = null;
        this._controlBar = null;
        this._mount();
    }

    getElement() {
        return this._element;
    }

    destroy() {
        if (this._controlBar) this._controlBar.destroy();
        if (this._element?.parentNode) {
            this._element.parentNode.removeChild(this._element);
        }
        this._element = null;
    }

    // --- public controls ---
    // Each forwards as a `playback:command` event. The maze panel's
    // visualizer subscribes and drives the actual playback.

    play(rateHz = this._rate) {
        this._rate = rateHz;
        this._publish('play', { rateHz });
    }

    stop() {
        this._publish('stop');
    }

    step() {
        this._publish('step');
    }

    instant() {
        this._publish('instant');
    }

    reset() {
        this._publish('reset');
    }

    setRate(rateHz) {
        this._rate = rateHz;
        this._publish('setRate', { rateHz });
    }

    // --- internal ---

    _publish(command, extra = {}) {
        if (!this._eventBus?.publish) {
            // No event bus — log a hint and stay quiet on the wire.
            console.warn(`[playbackBot] eventBus unavailable; cannot publish ${command}`);
            return;
        }
        this._eventBus.publish(PLAYBACK_COMMAND_EVENT, {
            command,
            ...extra,
            source: 'playbackBot',
        }, PUBLISHER_MODULE);
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
            initialRate: this._rate,
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

        const statusEl = document.createElement('div');
        statusEl.className = 'playback-bot-status';
        root.appendChild(statusEl);
        this._statusEl = statusEl;

        const hint = document.createElement('div');
        hint.className = 'playback-bot-hint';
        hint.textContent = 'Drives the maze panel — open it in another column to watch the bot walk.';
        root.appendChild(hint);

        this._element = root;
        this._render();
    }

    _render() {
        if (!this._element) return;
        const data = this._getSphereData?.() ?? [];
        const total = Array.isArray(data) ? data.length : 0;
        if (this._statusEl) {
            this._statusEl.textContent = total > 0
                ? `Sphere log loaded: ${total} entries.`
                : 'No sphere log loaded.';
        }
    }
}
