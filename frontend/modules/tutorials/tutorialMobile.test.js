/**
 * The executor on the MOBILE layout (no Golden Layout instance): a step that
 * opens a panel, or presses a control in one, finds the panel through
 * mobileLayoutManager (tutorialLayout.js `mobileItems`). Before it, every
 * panel lookup was null there, and the Seedling bot tutorial stuck at the
 * Flash panel's ▶ Start on the phone layout (slice seedling-tutorial-bot-refresh).
 *
 * Node environment: the document and the mobile panels are stubs.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mobileLayoutManager from '../../app/core/mobileLayoutManager.js';
import { findControl, findItem, isPanelShowing, performAction } from './tutorialExecutor.js';

const fakeControl = { isConnected: true, disabled: false, getBoundingClientRect: () => ({ width: 10, height: 10 }), clicks: 0 };
fakeControl.click = () => { fakeControl.clicks += 1; };
const panelElement = (selectors) => ({ querySelectorAll: (sel) => (selectors.includes(sel) ? [fakeControl] : []) });

const GLOBALS = ['document', 'requestAnimationFrame', 'HTMLCanvasElement'];
let saved;

beforeEach(() => {
    saved = { globals: Object.fromEntries(GLOBALS.map((k) => [k, globalThis[k]])), panels: mobileLayoutManager.panels, active: mobileLayoutManager.activePanel, show: mobileLayoutManager.showPanel };
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.HTMLCanvasElement = class {};
    globalThis.document = { querySelector: (sel) => (sel === '.mobile-layout-container' ? {} : null) };
    mobileLayoutManager.panels = new Map([
        ['tutorialPanel', { title: 'Tutorial', element: panelElement([]) }],
        ['flashPanel', { title: 'Flash Panel', element: panelElement(['#btn-go']) }],
    ]);
    mobileLayoutManager.activePanel = 'tutorialPanel';
    mobileLayoutManager.showPanel = (type) => { mobileLayoutManager.activePanel = type; };
    fakeControl.clicks = 0;
});

afterEach(() => {
    for (const [k, v] of Object.entries(saved.globals)) {
        if (v === undefined) delete globalThis[k];
        else globalThis[k] = v;
    }
    mobileLayoutManager.panels = saved.panels;
    mobileLayoutManager.activePanel = saved.active;
    mobileLayoutManager.showPanel = saved.show;
});

describe('the tutorial executor on the mobile layout', () => {
    it('finds a mobile panel and knows whether it is the one showing', () => {
        expect(findItem({ panel: 'flashPanel' })?.container.element).toBe(mobileLayoutManager.panels.get('flashPanel').element);
        expect(isPanelShowing({ panel: 'tutorialPanel' })).toBe(true);
        expect(isPanelShowing({ panel: 'flashPanel' })).toBe(false);
        expect(findItem({ panel: 'noSuchPanel' })).toBeNull();
    });

    it('an activate action shows the panel (mobileLayoutManager.showPanel)', async () => {
        await performAction({ activate: { panel: 'flashPanel' } }, { controlTimeoutMs: 200 });
        expect(mobileLayoutManager.activePanel).toBe('flashPanel');
        expect(isPanelShowing({ panel: 'flashPanel' })).toBe(true);
    });

    it('a click action finds the control inside the mobile panel and presses it', async () => {
        expect(findControl({ panel: 'flashPanel', selector: '#btn-go' })).toBe(fakeControl);
        await performAction({ click: { panel: 'flashPanel', selector: '#btn-go' } }, { controlTimeoutMs: 200 });
        expect(mobileLayoutManager.activePanel).toBe('flashPanel');
        expect(fakeControl.clicks).toBe(1);
    });
});
