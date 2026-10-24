/**
 * Other: embedding pages and windows (catalogue "Embedding" — the Iframe
 * Manager / Panel and the Window Manager / Panel). A page loaded into an
 * iframe or a popup window connects back to the app over the same event bus
 * the panels use. In progress: its walk row measures `firstFailingStep`.
 * Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports nothing from the app (the guide generator imports it in node).
 */

const IFRAMES = { panel: 'iframeManagerPanel' };
const IFRAME = { panel: 'iframePanel' };
const WINDOWS = { panel: 'windowManagerPanel' };
const WINDOW = { panel: 'windowPanel' };
const IFRAME_BASE = './modules/iframe-base/index.html';
const WINDOW_BASE = './modules/window-base/index.html';

export const OTHER_EMBEDDING = Object.freeze({
    id: 'other-embedding',
    title: 'Embedding pages and windows',
    summary: 'Load a page into an Iframe panel, or open it in a window of its own, and watch it connect to the app.',
    track: 'other',
    status: 'in-progress',
    firstFailingStep: null,
    doc: null,
    intro: [
        { prose: 'A game or tool can run in a page of its own and still talk to the app — its inventory, its checks, its region moves — through the same events the panels use. The **Iframe Manager** loads such a page into an **Iframe Panel**; the **Window Manager** opens it in a separate browser window. The *Base* pages do nothing but connect, so they show the plumbing alone.' },
    ],
    sections: [
        {
            id: 'iframe',
            title: 'In an iframe',
            blocks: [
                {
                    step: {
                        id: 'pick-iframe-page',
                        text: 'Open the **Iframe Manager** tab and choose **Iframe Base** among the known pages. (Any address works in the box above it; one that is not a known page asks you first.)',
                        actions: [{ select: { ...IFRAMES, selector: '.known-pages-select', value: IFRAME_BASE } }],
                        done: (ctx) => ctx.query({ ...IFRAMES, selector: '.url-input' })?.value === IFRAME_BASE,
                    },
                },
                {
                    step: {
                        id: 'load-iframe',
                        text: 'Press **Load Iframe**, then open the **Iframe Panel** tab: the page loads, and its status turns to *Connected*. The manager lists it, with its heartbeat.',
                        actions: [{ click: { ...IFRAMES, selector: '.load-button' } }, { activate: IFRAME }],
                        done: (ctx) => ctx.text({ ...IFRAME, selector: '.iframe-status' }).startsWith('Connected') && ctx.text({ ...IFRAME, selector: '.iframe-status' }).includes('iframe-base'),
                        doneTimeoutMs: 30000,
                    },
                },
                {
                    step: {
                        id: 'unload-iframe',
                        text: 'Back in the **Iframe Manager**, press **Unload All**.',
                        actions: [{ click: { ...IFRAMES, selector: '.unload-button' } }],
                        done: (ctx) => !ctx.exists({ ...IFRAME, selector: '.iframe-content iframe' }),
                    },
                },
            ],
        },
        {
            id: 'window',
            title: 'In a window',
            blocks: [
                {
                    step: {
                        id: 'pick-window-page',
                        text: 'Open the **Window Manager** tab and choose **Window Base** among the known pages.',
                        actions: [{ select: { ...WINDOWS, selector: '.known-pages-select', value: WINDOW_BASE } }],
                        done: (ctx) => ctx.query({ ...WINDOWS, selector: '.url-input' })?.value === WINDOW_BASE,
                    },
                },
                {
                    step: {
                        id: 'open-window',
                        text: 'Press **Open Window**. The page opens in a window of its own (allow pop-ups for this site if the browser blocks it); the **Window Panel** tab shows it *Connected*, with its heartbeats.',
                        actions: [{ click: { ...WINDOWS, selector: '.open-button' } }, { activate: WINDOW }],
                        done: (ctx) => ctx.text({ ...WINDOW, selector: '.connection-status-value' }) === 'Connected',
                        doneTimeoutMs: 30000,
                    },
                },
                {
                    step: {
                        id: 'close-window',
                        text: 'Back in the **Window Manager**, press **Close All**.',
                        actions: [{ click: { ...WINDOWS, selector: '.close-all-button' } }],
                        done: (ctx) => ctx.text({ ...WINDOW, selector: '.connection-status-value' }) !== 'Connected',
                    },
                },
            ],
        },
    ],
    outro: null,
});
