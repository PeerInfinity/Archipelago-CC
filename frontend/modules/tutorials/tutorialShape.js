/**
 * tutorialShape.js — what a tutorial IS, as data, and the one validator for it.
 *
 * A tutorial is read by three things: the Tutorial panel (renders it, performs
 * its steps), the in-app test row (performs every step and asserts each one's
 * `done`), and `scripts/tutorials/generate-tutorial-docs.mjs` (writes the user
 * guide `.md` from it). So the content is the only copy of the text.
 *
 * ── THE SHAPE ────────────────────────────────────────────────────────────
 *
 *   { id, title, track, status, firstFailingStep?, covers?, doc, intro,
 *     sections: [{ id, title, blocks: [...] }], outro }
 *
 *   summary   one plain sentence: what the tutorial teaches (the list's card,
 *             the docs' list)
 *   track     which heading of the list it sits under: a key of TRACKS
 *   status    'ready', or 'in-progress' (⚖ the user, 2026-10-10: every
 *             tutorial is written now, finished feature or not; the panel lists
 *             in-progress ones in a collapsed section)
 *   firstFailingStep  in-progress only: the id of the first step that does
 *             not work yet (it fails, or it is an outside step the test cannot
 *             stand in for), or null when every step works. THE RATCHET: the
 *             tutorial's walk row fails when an EARLIER step fails, and also
 *             when this step starts working, so the record cannot go stale
 *             (tutorialWalk.js `ratchetVerdict`)
 *   covers    optional componentTypes the tutorial shows without naming them
 *             in an action (the coverage check, content/coverage.js)
 *   doc       repo path of the generated guide (`docs/json/user/….md`), or
 *             null. Only a READY tutorial's guide is written
 *   intro     prose before the first section (an array of prose strings)
 *   outro     { title, blocks } — the closing section; prose only, no steps
 *
 *   A block is ONE of:
 *     { prose: '…' }            a paragraph (or a `- ` bullet list)
 *     { step: { … } }           one numbered step
 *   and either kind may carry `docOnly: true` (the guide prints it, the panel
 *   does not) or `panelOnly: true` (the reverse). Consecutive steps print as
 *   one numbered list in the guide.
 *
 *   A step:
 *     id        stable slug, unique within the tutorial
 *     text      the instruction (markdown-lite: `code`, **bold**, *italic*,
 *               [text](url), <url>)
 *     actions   what "Do it" performs, in order — DECLARATIVE (below), so the
 *               panel can move its cursor to each target and outline it
 *     run       optional `async (ctx) => {}` escape hatch, run after `actions`;
 *               a step that only has `run` gets no cursor and no outline
 *     done      optional `(ctx) => boolean` (may be async): is the step done?
 *               The panel polls it to auto-advance; the test asserts it
 *     doneTimeoutMs  optional: how long the test waits for `done` (default
 *               DEFAULT_DONE_TIMEOUT_MS)
 *     failed    optional `(ctx) => string | falsy` (may be async): a state the
 *               app shows that means `done` will never hold (e.g. the Maze
 *               Room's "no path … under current inventory"). The panel stops
 *               and shows the text; the walk fails AT ONCE with it instead of
 *               waiting out `doneTimeoutMs`
 *     outside   optional `true`: the step happens OUTSIDE the app (a terminal
 *               command such as starting a local MultiServer). It has no
 *               `actions`/`run`; Do it is off; Play waits for its `done` (or
 *               stops, when it has none)
 *     command   optional (outside steps): the command to copy, shown in a box
 *     standIn   optional (outside steps) `async (ctx) => {}`: what the TEST
 *               does in its place (e.g. load the pre-generated preset instead of
 *               running Generate.py). Never run by the panel
 *
 *   An action is ONE of:
 *     { activate: TARGET_PANEL }               bring the panel forward
 *     { click: TARGET_CONTROL }                activate its panel, then click
 *     { key: { panel, selector?, key } }       focus, then press a key
 *     { select: { panel, selector, value } }   choose a <select>'s option by
 *                                              its value (⚖ the user,
 *                                              2026-10-10: a dropdown gets the
 *                                              cursor and outline too)
 *     { fill: { panel, selector, value } }     type `value` into an input
 *                                              (its value set, then input +
 *                                              change, as typing ends)
 *
 *     TARGET_PANEL   = { panel: '<componentType>', title?: '<tab title>' }
 *     TARGET_CONTROL = { panel, title?, selector: '<CSS, scoped to the panel>',
 *                        text?: '<exact textContent, to pick one of several>',
 *                        optional?: true, frame?: '<CSS of an iframe in the panel>' }
 *
 *   `frame` (click only): the selector is looked up in that same-origin
 *   iframe's document instead — a button the panel's game page draws (the
 *   Seedling wasm page's ▶ Start).
 *
 *   `optional` (click only): when the control is not there, the action is
 *   skipped instead of failing — "unfold the section if it is folded", where
 *   the selector names the FOLDED state.
 *
 *   `title` is only for a componentType that has more than one tab (the two
 *   `procgenLabPanel`s). ⛔ No selector names Golden Layout markup: tabs and
 *   the overflow dropdown are the executor's business.
 *
 * ⛔ THE CONTENT MODULES IMPORT NOTHING FROM THE APP. The guide generator
 * imports them in node, so a step reaches the app only through the `ctx` the
 * panel or the test hands it.
 */

export const DEFAULT_DONE_TIMEOUT_MS = 15000;
export const STATUSES = Object.freeze(['ready', 'in-progress']);
/**
 * The list's headings, in order. `collapsed`: the panel shows the track in a
 * collapsed section of its own (⚖ the user, 2026-10-10: developer tutorials,
 * like the in-progress ones). Procgen is the project's core use (⚖ 2026-10-10).
 */
export const TRACKS = Object.freeze({
    start: Object.freeze({ title: 'Getting started' }),
    procgen: Object.freeze({ title: 'Procgen' }),
    seedling: Object.freeze({ title: 'Seedling' }),
    loops: Object.freeze({ title: 'Loop mode' }),
    games: Object.freeze({ title: 'MetaMath, DepGraph and APCalc' }),
    tracker: Object.freeze({ title: 'Tracking a game' }),
    other: Object.freeze({ title: 'Other' }),
    developer: Object.freeze({ title: 'For developers', collapsed: true }),
});
export const ACTION_KINDS = Object.freeze(['activate', 'click', 'key', 'select', 'fill']);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(where, why) {
    throw new Error(`tutorial ${where}: ${why}`);
}

function checkPanelTarget(t, where) {
    if (!t || typeof t !== 'object') fail(where, 'a target must be an object');
    if (typeof t.panel !== 'string' || !t.panel) fail(where, 'a target needs `panel` (a componentType)');
    if (t.title !== undefined && (typeof t.title !== 'string' || !t.title)) fail(where, '`title` must be a non-empty string');
}

function checkAction(a, where) {
    const kinds = ACTION_KINDS.filter((k) => a && Object.prototype.hasOwnProperty.call(a, k));
    if (kinds.length !== 1) fail(where, `an action has exactly one of ${ACTION_KINDS.join(', ')}`);
    const [kind] = kinds;
    const t = a[kind];
    checkPanelTarget(t, where);
    if (kind === 'click' && (typeof t.selector !== 'string' || !t.selector)) fail(where, 'a click needs `selector`');
    if (kind === 'key' && (typeof t.key !== 'string' || !t.key)) fail(where, 'a key action needs `key`');
    if ((kind === 'select' || kind === 'fill') && (typeof t.selector !== 'string' || !t.selector)) fail(where, `a ${kind} needs \`selector\``);
    if ((kind === 'select' || kind === 'fill') && typeof t.value !== 'string') fail(where, `a ${kind} needs \`value\` (a string)`);
    if (t.optional !== undefined && !(t.optional === true && kind === 'click')) fail(where, '`optional` is true, on a click only');
    if (t.text !== undefined && typeof t.text !== 'string') fail(where, '`text` must be a string');
    if (t.frame !== undefined && !(kind === 'click' && typeof t.frame === 'string' && t.frame)) fail(where, '`frame` is a selector, on a click only');
}

function checkBlock(b, where, stepIds, { stepsAllowed }) {
    if (!b || typeof b !== 'object') fail(where, 'a block must be an object');
    const isProse = typeof b.prose === 'string';
    const isStep = b.step && typeof b.step === 'object';
    if (isProse === Boolean(isStep)) fail(where, 'a block is exactly one of { prose } or { step }');
    if (b.docOnly && b.panelOnly) fail(where, 'a block cannot be both docOnly and panelOnly');
    if (isProse) return;
    if (!stepsAllowed) fail(where, 'the outro holds prose only');
    const s = b.step;
    if (typeof s.id !== 'string' || !SLUG.test(s.id)) fail(where, `step id ${JSON.stringify(s.id)} is not a slug`);
    if (stepIds.has(s.id)) fail(where, `duplicate step id ${s.id}`);
    stepIds.add(s.id);
    if (typeof s.text !== 'string' || !s.text.trim()) fail(`${where} (${s.id})`, 'a step needs `text`');
    if (s.actions !== undefined && !Array.isArray(s.actions)) fail(`${where} (${s.id})`, '`actions` must be an array');
    (s.actions ?? []).forEach((a, i) => checkAction(a, `${where} (${s.id}) action ${i}`));
    if (s.outside !== undefined && s.outside !== true) fail(`${where} (${s.id})`, '`outside` is true or absent');
    if (s.outside && (s.actions?.length || s.run)) fail(`${where} (${s.id})`, 'an outside step has no `actions` or `run`');
    if (!s.outside && (s.command !== undefined || s.standIn !== undefined)) {
        fail(`${where} (${s.id})`, '`command` and `standIn` belong to outside steps');
    }
    if (s.command !== undefined && (typeof s.command !== 'string' || !s.command.trim())) {
        fail(`${where} (${s.id})`, '`command` must be a non-empty string');
    }
    for (const fn of ['run', 'done', 'failed', 'standIn']) {
        if (s[fn] !== undefined && typeof s[fn] !== 'function') fail(`${where} (${s.id})`, `\`${fn}\` must be a function`);
    }
    if (s.doneTimeoutMs !== undefined && !(Number.isFinite(s.doneTimeoutMs) && s.doneTimeoutMs > 0)) {
        fail(`${where} (${s.id})`, '`doneTimeoutMs` must be a positive number');
    }
}

/** Throws, naming the place, on any departure from the shape above; returns the tutorial. */
export function validateTutorial(t) {
    if (!t || typeof t !== 'object') fail('?', 'not an object');
    if (typeof t.id !== 'string' || !SLUG.test(t.id)) fail('?', `id ${JSON.stringify(t.id)} is not a slug`);
    const where = t.id;
    if (typeof t.title !== 'string' || !t.title) fail(where, 'needs a title');
    if (typeof t.summary !== 'string' || !t.summary.trim() || t.summary.includes('\n')) fail(where, 'needs a one-line `summary`');
    if (t.doc !== null && !(typeof t.doc === 'string' && /^docs\/json\/.+\.md$/.test(t.doc))) {
        fail(where, '`doc` is null or a docs/json/….md path');
    }
    if (!Array.isArray(t.intro)) fail(where, '`intro` is an array of prose blocks');
    t.intro.forEach((b, i) => checkBlock(b, `${where} intro ${i}`, new Set(), { stepsAllowed: false }));
    if (!Array.isArray(t.sections) || t.sections.length === 0) fail(where, 'needs at least one section');
    const stepIds = new Set();
    const sectionIds = new Set();
    t.sections.forEach((sec, i) => {
        const w = `${where} section ${i}`;
        if (typeof sec.id !== 'string' || !SLUG.test(sec.id)) fail(w, `section id ${JSON.stringify(sec.id)} is not a slug`);
        if (sectionIds.has(sec.id)) fail(w, `duplicate section id ${sec.id}`);
        sectionIds.add(sec.id);
        if (typeof sec.title !== 'string' || !sec.title) fail(w, 'a section needs a title');
        if (!Array.isArray(sec.blocks)) fail(w, '`blocks` must be an array');
        sec.blocks.forEach((b, j) => checkBlock(b, `${w} block ${j}`, stepIds, { stepsAllowed: true }));
    });
    if (stepIds.size === 0) fail(where, 'has no steps');
    if (!Object.prototype.hasOwnProperty.call(TRACKS, t.track)) fail(where, `track ${JSON.stringify(t.track)} is not one of ${Object.keys(TRACKS).join(', ')}`);
    if (!STATUSES.includes(t.status)) fail(where, `status is one of ${STATUSES.join(', ')}`);
    if (t.status === 'ready' && t.firstFailingStep !== undefined) fail(where, 'a ready tutorial has no firstFailingStep');
    if (t.status === 'in-progress') {
        if (t.firstFailingStep === undefined) fail(where, 'an in-progress tutorial records firstFailingStep (a step id, or null)');
        if (t.firstFailingStep !== null && !panelSteps(t).some(({ step }) => step.id === t.firstFailingStep)) {
            fail(where, `firstFailingStep ${JSON.stringify(t.firstFailingStep)} is not a step the panel walks`);
        }
    }
    if (t.covers !== undefined && !(Array.isArray(t.covers) && t.covers.every((c) => typeof c === 'string' && c))) {
        fail(where, '`covers` is an array of componentTypes');
    }
    if (t.outro !== null) {
        if (!t.outro || typeof t.outro.title !== 'string' || !Array.isArray(t.outro.blocks)) {
            fail(where, '`outro` is null or { title, blocks }');
        }
        t.outro.blocks.forEach((b, i) => checkBlock(b, `${where} outro ${i}`, new Set(), { stepsAllowed: false }));
    }
    return t;
}

/** Every step the PANEL walks, in order: `{ step, section, sectionIndex, index }` (docOnly steps are not walked). */
export function panelSteps(t) {
    const out = [];
    t.sections.forEach((section, sectionIndex) => {
        for (const b of section.blocks) {
            if (b.step && !b.docOnly) out.push({ step: b.step, section, sectionIndex, index: out.length });
        }
    });
    return out;
}

/** The blocks a reader sees on one surface: `'doc'` drops panelOnly ones, `'panel'` drops docOnly ones. */
export function blocksFor(blocks, surface) {
    return blocks.filter((b) => (surface === 'doc' ? !b.panelOnly : !b.docOnly));
}

/** Every componentType a tutorial reaches: the panels its actions name, plus `covers`. */
export function panelsCovered(t) {
    const out = new Set(t.covers ?? []);
    for (const { step } of panelSteps(t)) {
        for (const a of step.actions ?? []) out.add(actionTarget(a).target.panel);
    }
    return out;
}

/** Every target an action names, for the test's "every selector resolves" check and the cursor. */
export function actionTarget(action) {
    const kind = ACTION_KINDS.find((k) => Object.prototype.hasOwnProperty.call(action, k));
    return { kind, target: action[kind] };
}
