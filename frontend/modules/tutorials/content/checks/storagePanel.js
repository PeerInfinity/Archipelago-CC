/**
 * Feature check: the Storage panel lists the saved mode's key under the module
 * that declares it. Starting any tutorial or check saves the panel's progress
 * with the settings, so that key exists by the time the panel is refreshed.
 */
const STORAGE = { panel: 'storagePanel' };
const MODE_PREFIX = 'archipelagoToolSuite_modeData_';
const modeSaved = () => {
    try {
        const ls = globalThis.localStorage;
        for (let i = 0; i < (ls?.length ?? 0); i += 1) if (ls.key(i).startsWith(MODE_PREFIX)) return true;
    } catch { /* no storage: not saved */ }
    return false;
};

export const CHECK_STORAGE_PANEL_MODE_KEY = Object.freeze({
    id: 'storage-panel-mode-key',
    title: 'Storage panel: the saved mode is declared',
    summary: 'The Storage panel lists the saved mode\'s key under the JSON panel, which declares it, not under Unknown.',
    status: 'ready',
    doc: null,
    intro: [],
    sections: [
        {
            id: 'storage',
            title: 'The saved mode in the Storage panel',
            blocks: [
                {
                    step: {
                        id: 'open-storage',
                        text: 'Open the **Storage** tab. Starting this check saved its progress with your settings, so the browser holds a saved mode.',
                        actions: [{ activate: STORAGE }],
                        // The settings save is debounced: wait for it, so Refresh below reads it.
                        done: (ctx) => ctx.exists({ ...STORAGE, selector: 'button.sp-refresh' }) && modeSaved(),
                    },
                },
                {
                    step: {
                        id: 'refresh',
                        text: `Press **Refresh**: the saved mode's key (\`${MODE_PREFIX}<mode>\`) is listed under the JSON panel.`,
                        actions: [{ click: { ...STORAGE, selector: 'button.sp-refresh' } }],
                        done: (ctx) => ctx.exists({ ...STORAGE, selector: `[data-owner="json"] tr.sp-row[data-key^="${MODE_PREFIX}"]` }),
                    },
                },
            ],
        },
    ],
    outro: null,
});
