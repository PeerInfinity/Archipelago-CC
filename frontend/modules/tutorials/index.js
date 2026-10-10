/**
 * tutorials — the Tutorial panel: a list of tutorials, each a sequence of
 * steps the panel shows one at a time and can perform for you (with an
 * animated cursor and an outline on what to press). The tutorials are data
 * (content/); the user guides they replace are generated from the same data
 * (scripts/tutorials/generate-tutorial-docs.mjs).
 */
import { COMPONENT_TYPE, DEFAULTS, MODULE_ID, PROGRESS_KEY, TutorialUI } from './tutorialUI.js';

export const moduleInfo = {
    name: MODULE_ID,
    title: 'Tutorial',
    componentType: COMPONENT_TYPE,
    icon: '🎓',
    column: 1,
    category: 'Data and Configuration Panels',
    description: 'Step-by-step tutorials: each step shown in turn, and performed for you on request (Do it, or Play for all of them).',
    docs: 'docs/json/user/modules/tutorials.md',
    requires: [],
};

export function register(registrationApi) {
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/tutorials/tutorials.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent(moduleInfo.componentType, TutorialUI);

    registrationApi.registerSettingsSchema({
        autoAdvance: {
            type: 'boolean',
            default: DEFAULTS.autoAdvance,
            label: 'Auto-advance',
            description: 'Move to the next step on its own once the current one is done — whether you did it '
                + 'or the panel did. Play always advances.',
        },
        autoAdvanceDelayMs: {
            type: 'number',
            default: DEFAULTS.autoAdvanceDelayMs,
            label: 'Auto-advance delay (ms)',
            description: 'How long a finished step stays on screen before the next one, when auto-advancing or playing.',
        },
        animateCursor: {
            type: 'boolean',
            default: DEFAULTS.animateCursor,
            label: 'Animate the cursor',
            description: 'When the panel performs a step, show a pointer moving to each thing it presses first. '
                + 'Desktop layout only.',
        },
        cursorMoveMs: {
            type: 'number',
            default: DEFAULTS.cursorMoveMs,
            label: 'Cursor move time (ms)',
            description: 'How long the animated pointer takes to reach each target.',
        },
        showOutline: {
            type: 'boolean',
            default: DEFAULTS.showOutline,
            label: 'Outline the next control',
            description: "Draw an outline around the next thing to press for the current step (a tab, the tab "
                + "list's ▾ button, or a control). Desktop layout only.",
        },
        [PROGRESS_KEY]: {
            type: 'object',
            default: null,
            label: 'Progress',
            description: 'The tutorial in progress and its step ({ id, index }), so the list can offer Resume; '
                + 'null when none is. Written by the panel.',
        },
    });

    registrationApi.registerEventBusSubscriberIntent('settings:changed');
    registrationApi.registerEventBusSubscriberIntent('stateManager:rulesLoaded');
    // ctx.loadPreset loads a world the way the Presets panel does; the bus drops
    // a publish from a module that did not declare it.
    registrationApi.registerEventBusPublisher('files:jsonLoaded');
    registrationApi.registerEventBusPublisher('ui:activatePanel');
}
