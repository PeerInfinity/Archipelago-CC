/**
 * The Playback Bot module's wiring for a connected ID-less check (sdc-connected-events).
 *
 * Connected, a check of a location with no server ID (an event) is applied locally and judged by the STATE
 * MANAGER, not the client's gate. The bot awaits a connected check that is missing from its flushed snapshot, so
 * the state manager's refusal must reach the bot like the client's (`onLocationCheckRefused`), or the bot waits
 * forever. 'already_checked' is not a refusal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./playbackBotPanel.js', () => ({ PlaybackBotPanel: class { static setModuleApis() {} } }));

import { initialize, setActivePanel } from './index.js';

let subs;
let teardown;
let bot;

beforeEach(async () => {
    subs = new Map();
    const eventBus = {
        subscribe: (name, fn) => { subs.set(name, fn); },
        unsubscribe: (name) => { subs.delete(name); },
    };
    teardown = await initialize('playbackBot', 0, { getEventBus: () => eventBus, getDispatcher: () => ({}) });
    bot = { onLocationCheckRefused: vi.fn() };
    setActivePanel({ getBot: () => bot });
});

describe('playbackBot: the state manager refusing a connected local check', () => {
    it('not_accessible and location_not_found reach the bot as a refusal', () => {
        subs.get('stateManager:locationCheckRejected')({ locationName: 'L16 flag 0', reason: 'not_accessible' });
        subs.get('stateManager:locationCheckRejected')({ locationName: 'Gone', reason: 'location_not_found' });
        expect(bot.onLocationCheckRefused.mock.calls.map(([d]) => d.locationName)).toEqual(['L16 flag 0', 'Gone']);
    });

    it('already_checked is not a refusal', () => {
        subs.get('stateManager:locationCheckRejected')({ locationName: 'L16 flag 0', reason: 'already_checked' });
        expect(bot.onLocationCheckRefused).not.toHaveBeenCalled();
    });

    it('the client gate refusal still reaches the bot, and teardown drops both subscriptions', () => {
        subs.get('client:locationCheckRefused')({ locationName: 'Loc A', reason: 'not_accessible' });
        expect(bot.onLocationCheckRefused).toHaveBeenCalledTimes(1);
        expect(typeof teardown).toBe('function');
        teardown();
        expect(subs.has('stateManager:locationCheckRejected')).toBe(false);
        expect(subs.has('client:locationCheckRefused')).toBe(false);
    });
});
