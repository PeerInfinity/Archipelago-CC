/**
 * Getting started: the workbench (catalogue "Your workbench"), as two
 * tutorials — finding and arranging panels, and saving a setup. ⚖ The user,
 * 2026-10-10: a step that answers a native browser dialog (confirm / alert /
 * prompt) is written as a user does it, and the walk records it (the test
 * cannot answer the dialog); a layout is saved as part of the mode's
 * settings, by design. In progress: each walk row measures `firstFailingStep`.
 * Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports nothing from the app (the guide generator imports it in node).
 */

const QL = { panel: 'quickLaunchPanel' };
const TUTORIAL = { panel: 'tutorialPanel' };
const MODULES = { panel: 'modulesPanel' };
const SETTINGS = { panel: 'settingsPanel' };
const OPTIONS = { panel: 'optionsPanel' };
const JSON_PANEL = { panel: 'jsonPanel' };
const STORAGE = { panel: 'storagePanel' };

const qlFilter = { ...QL, selector: 'input.ql-filter' };
const qlRoot = { ...QL, selector: '.quick-launch-panel' };
const layoutButton = { ...TUTORIAL, selector: 'button.tut-layout' };
const moduleSearch = { ...MODULES, selector: '#module-search' };

export const START_WORKBENCH = Object.freeze({
    id: 'start-workbench',
    title: 'Your workbench',
    summary: 'Find any panel with Quick Launch, arrange the tabs, follow a tutorial beside your work, and switch modules on and off.',
    track: 'start',
    status: 'in-progress',
    firstFailingStep: 'external-module',
    doc: null,
    intro: [
        { prose: 'The app is a workbench of panels — tabs in columns, which you can rearrange. Most of them you will never need at once; this tutorial is how to find the one you want, and how to put things back.' },
    ],
    sections: [
        {
            id: 'quick-launch',
            title: 'Quick Launch',
            blocks: [
                {
                    step: {
                        id: 'open-quick-launch',
                        text: 'Open the **Quick Launch** tab: every panel, grouped, with a dot that says whether it is open, and the guides under *Help*.',
                        actions: [{ activate: QL }],
                        done: (ctx) => ctx.isPanelShowing(QL),
                    },
                },
                {
                    step: {
                        id: 'filter',
                        text: 'Type **Settings** in its filter box: only the matching rows are left.',
                        actions: [{ fill: { ...qlFilter, value: 'Settings' } }],
                        done: (ctx) => ctx.exists({ ...QL, selector: 'button.ql-panel[data-component-type="settingsPanel"]' }),
                    },
                },
                {
                    step: {
                        id: 'open-settings',
                        text: 'Click **Settings**. The default layout has no Settings tab, so Quick Launch adds one, in the column its module asks for.',
                        actions: [{ click: { ...QL, selector: 'button.ql-panel[data-component-type="settingsPanel"]' } }],
                        done: (ctx) => ctx.exists({ ...SETTINGS, selector: 'textarea.settings-textarea' }),
                    },
                },
                {
                    step: {
                        id: 'clear-filter',
                        text: 'Back in **Quick Launch**, clear the filter box.',
                        actions: [{ fill: { ...qlFilter, value: '' } }],
                        done: (ctx) => ctx.query(qlFilter)?.value === '',
                    },
                },
                {
                    step: {
                        id: 'cards',
                        text: 'Press **Cards** for a card per panel, with its description; press it again for the tree.',
                        actions: [{ click: { ...QL, selector: 'button.ql-view' } }, { click: { ...QL, selector: 'button.ql-view' } }],
                        done: (ctx) => ctx.query(qlRoot)?.classList.contains('ql-cards') === false,
                    },
                },
                { prose: '**Edit** lets you file panels and links into groups of your own.' },
            ],
        },
        {
            id: 'tabs',
            title: 'Arranging the tabs',
            blocks: [
                { prose: [
                    '- **Drag a tab** to another column, or to the edge of one to split it.',
                    '- **Drag the border** between two columns to resize them.',
                    '- **Close a tab** with its ×; Quick Launch opens it again.',
                    '- The arrangement is saved as part of the mode\'s settings — the *Saving your setup* tutorial shows how — and the **JSON** tab\'s **Reset Default Mode** puts the default layout back.',
                ].join('\n') },
            ],
        },
        {
            id: 'tutorial-panel',
            title: 'The Tutorial panel',
            blocks: [
                {
                    step: {
                        id: 'merge',
                        text: 'A tutorial splits its column, so it stays in view while you work in the tab above it. Press **Merge ⇧** to put the Tutorial tab back among the others.',
                        actions: [{ click: { ...layoutButton, text: 'Merge ⇧' } }],
                        done: (ctx) => ctx.text(layoutButton) === 'Split ⇩',
                    },
                },
                {
                    step: {
                        id: 'split',
                        text: 'Press **Split ⇩** to split it out again.',
                        actions: [{ click: { ...layoutButton, text: 'Split ⇩' } }],
                        done: (ctx) => ctx.text(layoutButton) === 'Merge ⇧',
                    },
                },
                { prose: '**Do it** performs the current step for you, and **▶ Play** performs the rest, one after another. Tutorials whose feature is not finished are listed under *In progress*, and say which step does not work yet.' },
            ],
        },
        {
            id: 'modules',
            title: 'Modules',
            blocks: [
                {
                    step: {
                        id: 'open-modules',
                        text: 'Every panel belongs to a **module**. In **Quick Launch**, press **Modules ⇄** to open the **Modules** tab.',
                        actions: [{ click: { ...QL, selector: 'button.ql-modules' } }],
                        done: (ctx) => ctx.isPanelShowing(MODULES),
                    },
                },
                {
                    step: {
                        id: 'search-modules',
                        text: 'Type **editor** in its search box. Ticking a module switches it on (and opens its panel); unticking switches it off. Core modules cannot be switched off.',
                        actions: [{ fill: { ...moduleSearch, value: 'editor' } }],
                        done: (ctx) => ctx.exists({ ...MODULES, selector: '.module-entry[data-module-id="editor"]' }),
                    },
                },
                {
                    step: {
                        id: 'clear-module-search',
                        text: 'Clear the search box.',
                        actions: [{ fill: { ...moduleSearch, value: '' } }],
                        done: (ctx) => ctx.query(moduleSearch)?.value === '',
                    },
                },
                {
                    step: {
                        id: 'external-module',
                        text: 'A module can also come from outside the app: **Add External Module…** asks for the address of its `index.js` and loads it (so does opening the page with `?loadModule=<address>`). It is listed with *(External)*.',
                        actions: [{ click: { ...MODULES, selector: '.modules-panel-buttons > button', text: 'Add External Module...' } }],
                        done: (ctx) => ctx.exists({ ...MODULES, selector: '.module-entry[data-module-id^="external_"]' }),
                    },
                },
            ],
        },
    ],
    outro: {
        title: 'Next',
        blocks: [
            { prose: '*Saving your setup* keeps a layout and settings you like; the *Guided Tour* shows what the app is for.' },
        ],
    },
});

// ── Saving your setup ────────────────────────────────────────────────────

const MODE = 'tutorial';
const MODE_KEY = `archipelagoToolSuite_modeData_${MODE}`;
const LAST_MODE_KEY = 'archipelagoToolSuite_lastActiveMode';
const storageRow = (key) => ({ ...STORAGE, selector: `tr.sp-row[data-key="${key}"]` });
const colorblind = (value) => ({ ...OPTIONS, selector: `#options-colorblindRegions-${value}` });
const savedAt = () => {
    try { return Date.parse(JSON.parse(globalThis.localStorage?.getItem(MODE_KEY) ?? 'null')?.savedTimestamp); } catch { return NaN; }
};

export const START_SAVING_YOUR_SETUP = Object.freeze({
    id: 'start-saving-your-setup',
    title: 'Saving your setup',
    summary: 'Change the options and settings, save the layout and settings as a mode of your own, and clear what the app keeps in your browser.',
    track: 'start',
    status: 'in-progress',
    firstFailingStep: 'clear-mode',
    doc: null,
    intro: [
        { prose: 'The app keeps your options, your settings and your layout together as a **mode**. This tutorial changes an option and puts it back, saves everything as a mode of its own, and then removes that mode again.' },
    ],
    sections: [
        {
            id: 'options',
            title: 'Options and settings',
            blocks: [
                {
                    step: {
                        id: 'open-options',
                        text: 'Open the **Options** tab and click the **Options** card: the common choices, such as the layout (desktop or mobile), colour-blind marks and the server you connect to.',
                        actions: [{ click: { ...OPTIONS, selector: '.options-nav-card .options-nav-title', text: 'Options' } }],
                        done: (ctx) => ctx.exists(colorblind('yes')),
                    },
                },
                {
                    step: {
                        id: 'colorblind-on',
                        text: 'Under *Colorblind mode*, set **Regions** to *Yes*: reachable and unreachable regions get a symbol as well as a colour.',
                        actions: [{ click: colorblind('yes') }],
                        done: (ctx) => ctx.query(colorblind('yes'))?.checked === true,
                    },
                },
                {
                    step: {
                        id: 'all-settings',
                        text: 'Press **←** to go back, and click **All Settings**: every setting of every module, with a filter box.',
                        actions: [
                            { click: { ...OPTIONS, selector: 'button.options-back-btn' } },
                            { click: { ...OPTIONS, selector: '.options-nav-card .options-nav-title', text: 'All Settings' } },
                        ],
                        done: (ctx) => ctx.exists({ ...OPTIONS, selector: 'input.options-filter-input' }),
                    },
                },
                {
                    step: {
                        id: 'settings-json',
                        text: 'The same settings as one JSON document are in the **Settings** tab: edit it and press **Apply** (or Ctrl+Enter). **Do it** opens it.',
                        actions: [{ activate: SETTINGS }],
                        done: (ctx) => (ctx.query({ ...SETTINGS, selector: 'textarea.settings-textarea' })?.value ?? '').includes('"colorblindMode"'),
                    },
                },
                {
                    step: {
                        id: 'colorblind-off',
                        text: 'Back in **Options**, set colorblind **Regions** to *No* again (press **←**, then the **Options** card). **Reset to Defaults** on the first page puts every setting back at once.',
                        actions: [
                            { click: { ...OPTIONS, selector: 'button.options-back-btn', optional: true } },
                            { click: { ...OPTIONS, selector: '.options-nav-card .options-nav-title', text: 'Options' } },
                            { click: colorblind('no') },
                        ],
                        done: (ctx) => ctx.query(colorblind('no'))?.checked === true,
                    },
                },
            ],
        },
        {
            id: 'save',
            title: 'Save a mode',
            blocks: [
                {
                    step: {
                        id: 'open-json',
                        text: `Open the **JSON** tab and type **${MODE}** as the **Mode name**. The boxes below choose what is saved: the layout, the settings, the modules (and, unticked by default, the rules).`,
                        actions: [{ fill: { ...JSON_PANEL, selector: '#json-mode-name', value: MODE } }],
                        done: (ctx) => ctx.query({ ...JSON_PANEL, selector: '#json-mode-name' })?.value === MODE,
                    },
                },
                {
                    step: {
                        id: 'tick-layout',
                        text: 'Make sure **Layout Config** is ticked — the arrangement of your tabs is part of the mode.',
                        actions: [{ click: { ...JSON_PANEL, selector: '#json-chk-layout:not(:checked)', optional: true } }],
                        done: (ctx) => ctx.query({ ...JSON_PANEL, selector: '#json-chk-layout' })?.checked === true,
                    },
                },
                {
                    step: {
                        id: 'save-mode',
                        text: `Press **Save to LocalStorage**, and OK the message. The mode is saved in your browser, and it is now the one a plain address opens; \`?mode=${MODE}\` opens it at any time. **Save to File** keeps it as a file instead.`,
                        actions: [{ click: { ...JSON_PANEL, selector: '#json-btn-save-localstorage' } }],
                        done: (ctx) => ctx.sinceStep(savedAt()),
                    },
                },
            ],
        },
        {
            id: 'storage',
            title: 'What the app keeps in your browser',
            blocks: [
                {
                    step: {
                        id: 'open-storage',
                        text: `Open the **Storage** tab and press **Refresh**: every key the app keeps in your browser, by the module that owns it. \`${MODE_KEY}\` is the mode you saved.`,
                        actions: [{ click: { ...STORAGE, selector: 'button.sp-refresh' } }],
                        done: (ctx) => ctx.exists(storageRow(MODE_KEY)),
                    },
                },
                {
                    step: {
                        id: 'clear-mode',
                        text: 'Press its **Clear** and confirm: the saved mode is gone.',
                        actions: [{ click: { ...STORAGE, selector: `tr.sp-row[data-key="${MODE_KEY}"] button.sp-row-clear` } }],
                        done: (ctx) => !ctx.exists(storageRow(MODE_KEY)),
                    },
                },
                {
                    step: {
                        id: 'clear-last-mode',
                        text: `Clear \`${LAST_MODE_KEY}\` the same way, so a plain address opens the default mode again.`,
                        actions: [{ click: { ...STORAGE, selector: `tr.sp-row[data-key="${LAST_MODE_KEY}"] button.sp-row-clear` } }],
                        done: (ctx) => !ctx.exists(storageRow(LAST_MODE_KEY)),
                    },
                },
            ],
        },
    ],
    outro: null,
});
