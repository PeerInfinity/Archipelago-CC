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
 *   { id, title, doc, intro, sections: [{ id, title, blocks: [...] }], outro }
 *
 *   doc       repo path of the generated guide (`docs/json/user/….md`), or null
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
 *
 *   An action is ONE of:
 *     { activate: TARGET_PANEL }               bring the panel forward
 *     { click: TARGET_CONTROL }                activate its panel, then click
 *     { key: { panel, selector?, key } }       focus, then press a key
 *
 *     TARGET_PANEL   = { panel: '<componentType>', title?: '<tab title>' }
 *     TARGET_CONTROL = { panel, title?, selector: '<CSS, scoped to the panel>',
 *                        text?: '<exact textContent, to pick one of several>' }
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
export const ACTION_KINDS = Object.freeze(['activate', 'click', 'key']);
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
    if (t.text !== undefined && typeof t.text !== 'string') fail(where, '`text` must be a string');
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
    for (const fn of ['run', 'done']) {
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

/** Every target an action names, for the test's "every selector resolves" check and the cursor. */
export function actionTarget(action) {
    const kind = ACTION_KINDS.find((k) => Object.prototype.hasOwnProperty.call(action, k));
    return { kind, target: action[kind] };
}
