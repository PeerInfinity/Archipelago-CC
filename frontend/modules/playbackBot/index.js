/**
 * Playback Bot — sphere-log-driven walker that drives the maze panel
 * through a recorded playthrough. Was originally a widget hosted by
 * the Presets panel; Phase 1 of the playback-bot refactor moves it
 * into its own module + panel so its dispatcher receivers can live
 * here (instead of in `presets/index.js`) and so the upcoming click-
 * intercept seam is properly module-scoped.
 *
 * The module:
 *   - registers the `playbackBotPanel` component class
 *   - registers `playback:command` as an eventBus publisher
 *   - subscribes to user/system:locationCheck and user:regionMove on
 *     the dispatcher, propagating each forward and forwarding to the
 *     active panel's bot
 *   - tracks the currently-mounted panel via setActivePanel/
 *     getActivePanel so dispatcher receivers can reach the bot
 *     without a circular import
 *
 * Plan reference:
 * NewDocs/plans/procedural-generation/playback-bot-refactor.md (Phase 1)
 */

import { PlaybackBotPanel } from './playbackBotPanel.js';

export const moduleInfo = {
    name: 'playbackBot',
    title: 'Playback Bot',
    componentType: 'playbackBotPanel',
    icon: '🤖',
    column: 3,
    description: 'Sphere-log playback bot — drives the maze panel '
               + 'visualizer through a recorded playthrough.',
    requires: [],
};

// Active-panel singleton. Set by the panel constructor on mount,
// cleared on destroy. Dispatcher receivers reach the bot through
// `getActivePanel()?.getBot()`. Mirrors the pattern used elsewhere
// (mazeRoom.setPanelInstance, procgenPipeline.setPanelInstance) so
// each module's receivers don't need to know about each other.
let _activePanel = null;
export function setActivePanel(panel) { _activePanel = panel; }
export function getActivePanel() { return _activePanel; }

let _moduleEventBus = null;
let _moduleDispatcher = null;

export function getModuleEventBus() { return _moduleEventBus; }

export function register(registrationApi) {
    // CSS link — same idiom mazeRoom and procgenPipeline use to load
    // their own stylesheet on register without a build step.
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/playbackBot/playbackBot.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent('playbackBotPanel', PlaybackBotPanel);

    // The bot publishes `playback:command` events that the maze
    // panel's visualizer subscribes to (single-trigger remote-control
    // wiring from Phase 5 of the debugging-tools plan).
    registrationApi.registerEventBusPublisher('playback:command');

    // Dispatcher receivers — formerly in presets/index.js. Each one
    // propagates first (so stateManager + downstream handlers see the
    // event before the bot's onLocationCheck / onRegionMove logic runs;
    // the bot's PathFinder.findPathWithExits depends on stateManager's
    // post-event snapshot to evaluate exit access rules correctly).
    //
    // Phase 0 of the refactor split user:locationCheck into user: +
    // system: so the Phase 2 intercept can swallow user clicks
    // without looping on the bot's own pickup events. Both flavors
    // run through the same handler here; propagation forwards the
    // same event name received.
    for (const evName of ['user:locationCheck', 'system:locationCheck']) {
        const capturedEv = evName; // closure capture
        registrationApi.registerDispatcherReceiver(
            'playbackBot',
            capturedEv,
            (data) => {
                try {
                    _moduleDispatcher?.publishToNextModule?.(
                        'playbackBot', capturedEv, data, { direction: 'up' });
                } catch (e) {
                    log('warn', `playbackBot: ${capturedEv} propagation threw`, e);
                }
                try {
                    getActivePanel()?.getBot()?.onLocationCheck?.(data);
                } catch (e) {
                    log('warn', 'playbackBot: bot.onLocationCheck threw', e);
                }
            },
            { direction: 'up', condition: 'unconditional', timing: 'immediate' },
        );
    }

    registrationApi.registerDispatcherReceiver(
        'playbackBot',
        'user:regionMove',
        (data) => {
            try {
                _moduleDispatcher?.publishToNextModule?.(
                    'playbackBot', 'user:regionMove', data, { direction: 'up' });
            } catch (e) {
                log('warn', 'playbackBot: regionMove propagation threw', e);
            }
            try {
                getActivePanel()?.getBot()?.onRegionMove?.(data);
            } catch (e) {
                log('warn', 'playbackBot: bot.onRegionMove threw', e);
            }
        },
        { direction: 'up', condition: 'unconditional', timing: 'immediate' },
    );
}

export async function initialize(moduleId, priorityIndex, initializationApi) {
    _moduleEventBus = initializationApi.getEventBus();
    _moduleDispatcher = initializationApi.getDispatcher();

    PlaybackBotPanel.setModuleApis({
        eventBus: _moduleEventBus,
        dispatcher: _moduleDispatcher,
    });

    return () => {
        _moduleEventBus = null;
        _moduleDispatcher = null;
    };
}

function log(level, message, ...rest) {
    if (typeof window !== 'undefined' && window.logger) {
        window.logger[level]('playbackBot', message, ...rest);
    } else {
        const fn = console[level === 'info' ? 'log' : level] || console.log;
        fn(`[playbackBot] ${message}`, ...rest);
    }
}
