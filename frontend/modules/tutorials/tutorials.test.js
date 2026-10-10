/**
 * The tutorial data, its validator, the guide renderer, and the pin on every
 * generated guide (a hand edit to a guide, or a tutorial edit that skipped
 * `node scripts/tutorials/generate-tutorial-docs.mjs`, reds here).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, renderAll, renderGuides } from '../../../scripts/tutorials/generate-tutorial-docs.mjs';
import { FEATURES, NOT_COVERED_YET, NO_TUTORIAL } from './content/coverage.js';
import { TUTORIALS } from './content/index.js';
import { generatedMarker, tutorialMarkdown } from './tutorialMarkdown.js';
import { blocksFor, panelSteps, panelsCovered, validateTutorial } from './tutorialShape.js';
import { ratchetVerdict, walkTutorial } from './tutorialWalk.js';

const tiny = (over = {}) => ({
    id: 'tiny',
    title: 'Tiny',
    summary: 'A tiny tutorial.',
    track: 'start',
    status: 'ready',
    doc: null,
    intro: [{ prose: 'Hello.' }],
    sections: [{
        id: 's1',
        title: 'One',
        blocks: [
            { prose: 'Before.' },
            { step: { id: 'a', text: 'Do **a**.', actions: [{ activate: { panel: 'xPanel' } }] } },
            { step: { id: 'b', text: 'Do b.', actions: [{ click: { panel: 'xPanel', selector: '.go' } }], done: () => true } },
            { docOnly: true, prose: 'Only in the guide.' },
            { panelOnly: true, step: { id: 'c', text: 'Only in the panel.' } },
        ],
    }],
    outro: { title: 'Next', blocks: [{ prose: '- one\n- two' }] },
    ...over,
});

describe('validateTutorial', () => {
    it('accepts the shape', () => {
        expect(() => validateTutorial(tiny())).not.toThrow();
    });

    it.each([
        ['a non-slug id', { id: 'Not A Slug' }],
        ['no sections', { sections: [] }],
        ['a doc outside docs/json', { doc: 'README.md' }],
        ['a step in the outro', { outro: { title: 'x', blocks: [{ step: { id: 'z', text: 'z' } }] } }],
        ['an unknown track', { track: 'nowhere' }],
        ['an unknown status', { status: 'done' }],
        ['no summary', { summary: '' }],
        ['a ready tutorial with a firstFailingStep', { firstFailingStep: 'a' }],
        ['an in-progress tutorial with no record', { status: 'in-progress' }],
        ['a record naming no step', { status: 'in-progress', firstFailingStep: 'zz' }],
    ])('refuses %s', (_, over) => {
        expect(() => validateTutorial(tiny(over))).toThrow(/tutorial/);
    });

    it('refuses a duplicate step id, an action with two kinds, and a click with no selector', () => {
        const dup = tiny();
        dup.sections[0].blocks.push({ step: { id: 'a', text: 'again' } });
        expect(() => validateTutorial(dup)).toThrow(/duplicate step id a/);
        const two = tiny();
        two.sections[0].blocks[1].step.actions = [{ activate: { panel: 'x' }, click: { panel: 'x', selector: '.y' } }];
        expect(() => validateTutorial(two)).toThrow(/exactly one of/);
        const bare = tiny();
        bare.sections[0].blocks[2].step.actions = [{ click: { panel: 'x' } }];
        expect(() => validateTutorial(bare)).toThrow(/a click needs `selector`/);
    });

    it('refuses a block that is both docOnly and panelOnly', () => {
        const t = tiny();
        t.sections[0].blocks[0] = { prose: 'x', docOnly: true, panelOnly: true };
        expect(() => validateTutorial(t)).toThrow(/both docOnly and panelOnly/);
    });
});

describe('outside steps', () => {
    const outside = (step) => {
        const t = tiny();
        t.sections[0].blocks.push({ step: { id: 'o', text: 'Run a server.', outside: true, ...step } });
        return t;
    };

    it('accept a command, a done check and a stand-in', () => {
        expect(() => validateTutorial(outside({ command: 'python MultiServer.py', done: () => true, standIn: async () => {} }))).not.toThrow();
    });

    it('refuse actions, and a command or stand-in on an in-app step', () => {
        expect(() => validateTutorial(outside({ actions: [{ activate: { panel: 'x' } }] }))).toThrow(/no `actions` or `run`/);
        const t = tiny();
        t.sections[0].blocks[1].step.command = 'ls';
        expect(() => validateTutorial(t)).toThrow(/belong to outside steps/);
    });

    it('print the command as a fenced block inside the list item', () => {
        const md = tutorialMarkdown(outside({ command: 'python MultiServer.py\n--port 38281' }), 'src.js');
        expect(md).toContain('1. Run a server.\n\n   ```\n   python MultiServer.py\n   --port 38281\n   ```');
    });
});

describe('the ratchet (tutorialWalk.js)', () => {
    // a, b, c walk; b is the record in the in-progress variant.
    const draft = (record) => tiny({ status: 'in-progress', firstFailingStep: record });
    const walk = (t, failAt, extra = {}) => walkTutorial(t, {
        perform: async ({ step }) => { if (step.id === failAt) throw new Error('boom'); },
        standIn: async () => {},
        waitDone: async () => true,
        ...extra,
    });

    it('a ready tutorial must complete', async () => {
        expect(ratchetVerdict(tiny(), await walk(tiny(), null)).ok).toBe(true);
        const v = ratchetVerdict(tiny(), await walk(tiny(), 'b'));
        expect(v).toEqual({ ok: false, message: expect.stringMatching(/fails at step 2 of 3 \(b\): boom/) });
    });

    it('an in-progress tutorial passes when it ends exactly at the record', async () => {
        expect(ratchetVerdict(draft('b'), await walk(draft('b'), 'b')).ok).toBe(true);
        expect(ratchetVerdict(draft(null), await walk(draft(null), null)).ok).toBe(true);
    });

    it('an earlier failure is a REGRESSION', async () => {
        const v = ratchetVerdict(draft('b'), await walk(draft('b'), 'a'));
        expect(v.ok).toBe(false);
        expect(v.message).toMatch(/^REGRESSION: it fails at step 1/);
        expect(ratchetVerdict(draft(null), await walk(draft(null), 'c')).message).toMatch(/REGRESSION.*every step worked/);
    });

    it('a recorded step that works now makes the record STALE, naming the new one', async () => {
        const later = ratchetVerdict(draft('b'), await walk(draft('b'), 'c'));
        expect(later).toEqual({ ok: false, message: expect.stringMatching(/STALE.*Set firstFailingStep to 'c'/) });
        expect(ratchetVerdict(draft('b'), await walk(draft('b'), null)).message).toMatch(/Set firstFailingStep to null \(or mark it ready\)/);
    });

    it('an outside step with no stand-in ends the walk as a STOP; a done check that never holds is a failure', async () => {
        const t = tiny({ status: 'in-progress', firstFailingStep: 'o' });
        t.sections[0].blocks.push({ step: { id: 'o', text: 'Run a server.', outside: true } });
        const stop = await walk(t, null);
        expect(stop).toMatchObject({ end: 'stopped', stepId: 'o' });
        expect(ratchetVerdict(t, stop)).toEqual({ ok: true, message: expect.stringMatching(/stops at step 4 of 4/) });
        const never = await walk(tiny(), null, { waitDone: async ({ step }) => step.id !== 'b' });
        expect(never).toMatchObject({ end: 'failed', stepId: 'b', why: 'its done check never held' });
    });

    it('runs an outside step\'s stand-in instead of performing it', async () => {
        const t = tiny();
        const ran = [];
        t.sections[0].blocks.push({ step: { id: 'o', text: 'Run a server.', outside: true, standIn: async () => {} } });
        const out = await walk(t, null, { standIn: async ({ step }) => ran.push(step.id) });
        expect(out.end).toBe('complete');
        expect(ran).toEqual(['o']);
    });
});

describe('surfaces', () => {
    it('the panel walks every step that is not docOnly, in order', () => {
        expect(panelSteps(tiny()).map((s) => s.step.id)).toEqual(['a', 'b', 'c']);
    });

    it('blocksFor drops the other surface\'s blocks', () => {
        const blocks = tiny().sections[0].blocks;
        expect(blocksFor(blocks, 'doc').map((b) => b.prose ?? b.step.id)).toEqual(['Before.', 'a', 'b', 'Only in the guide.']);
        expect(blocksFor(blocks, 'panel').map((b) => b.prose ?? b.step.id)).toEqual(['Before.', 'a', 'b', 'c']);
    });
});

describe('tutorialMarkdown', () => {
    it('writes headings, paragraphs, one numbered list per run of steps, and the marker LAST', () => {
        expect(tutorialMarkdown(tiny(), 'src.js')).toBe([
            '# Tiny', '', 'Hello.', '', '## One', '', 'Before.', '', '1. Do **a**.', '2. Do b.', '',
            'Only in the guide.', '', '## Next', '', '- one', '- two', '', generatedMarker('src.js'), '',
        ].join('\n'));
    });
});

describe('the tutorials', () => {
    it('every tutorial has the shape, and ids are unique', () => {
        for (const { tutorial } of TUTORIALS) expect(() => validateTutorial(tutorial)).not.toThrow();
        const ids = TUTORIALS.map((e) => e.tutorial.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('each entry\'s `source` is the file that exports its tutorial', async () => {
        for (const { source, tutorial } of TUTORIALS) {
            const mod = await import(join(REPO, source));
            expect(Object.values(mod)).toContain(tutorial);
        }
    });

    it('every generated doc equals what the generator writes today (byte for byte)', () => {
        for (const { doc, text } of renderAll()) {
            expect(readFileSync(join(REPO, doc), 'utf8'), doc).toBe(text);
        }
    });

    it('only READY tutorials get a guide written', () => {
        const ready = TUTORIALS.filter((e) => e.tutorial.doc && e.tutorial.status === 'ready').map((e) => e.tutorial.doc);
        expect(renderGuides().map((g) => g.doc)).toEqual(ready);
    });

    it('every tutorial has a walk row in the substrates roster (its id is tutorial-walk-<id>)', () => {
        const config = JSON.parse(readFileSync(join(REPO, 'frontend/test-configs/playwright_tests_config-substrates.json'), 'utf8'));
        const rows = new Set((config.testOrder ?? config.tests ?? []).map((r) => (typeof r === 'string' ? r : r.id)));
        for (const { tutorial } of TUTORIALS) expect(rows.has(`tutorial-walk-${tutorial.id}`), tutorial.id).toBe(true);
    });

    it('every step the panel walks can be checked or performed (actions, run, done, or an outside step)', () => {
        for (const { tutorial } of TUTORIALS) {
            const bare = panelSteps(tutorial).filter(({ step }) => !step.actions?.length && !step.run && !step.done && !step.outside);
            expect(bare.map((s) => s.step.id), tutorial.id).toEqual([]);
        }
    });
});

describe('?tutorial= (tutorialUrl.js)', () => {
    it('reads the id and a 1-based step', async () => {
        const { parseTutorialRequest } = await import('./tutorialUrl.js');
        expect(parseTutorialRequest('?game=procgen_maze&seed=1&tutorial=guided-tour')).toEqual({ id: 'guided-tour', index: 0 });
        expect(parseTutorialRequest('?tutorial=guided-tour&tutorialStep=4')).toEqual({ id: 'guided-tour', index: 3 });
        expect(parseTutorialRequest('?tutorial=guided-tour&tutorialStep=0')).toEqual({ id: 'guided-tour', index: 0 });
        expect(parseTutorialRequest('?tutorial=guided-tour&tutorialStep=x')).toEqual({ id: 'guided-tour', index: 0 });
        expect(parseTutorialRequest('?game=alttp')).toBeNull();
        expect(parseTutorialRequest('?tutorial=')).toBeNull();
    });

    it('tutorialLink keeps the base query', async () => {
        const { tutorialLink } = await import('./tutorialUrl.js');
        expect(tutorialLink('https://x/', 'a')).toBe('https://x/?tutorial=a');
        expect(tutorialLink('https://x/?game=g&seed=1', 'a')).toBe('https://x/?game=g&seed=1&tutorial=a');
    });

    it('every link a tutorial\'s prose gives to ?tutorial= names a tutorial that exists', () => {
        const ids = new Set(TUTORIALS.map((e) => e.tutorial.id));
        for (const { tutorial } of TUTORIALS) {
            const text = JSON.stringify([tutorial.intro, tutorial.sections.map((s) => s.blocks.map((b) => b.prose ?? b.step.text)), tutorial.outro]);
            for (const m of text.matchAll(/[?&]tutorial=([a-z0-9-]+)/g)) expect(ids.has(m[1]), m[0]).toBe(true);
        }
    });
});

// ── coverage (content/coverage.js; ⚖ the user, 2026-10-10) ───────────────

/**
 * Every panel componentType any module config registers, read off the
 * modules' source: `registerPanelComponent(<type>, …)` where <type> is a
 * string, `moduleInfo.componentType`, or a constant defined in the module's
 * own directory. A call this cannot resolve fails the census (naming it), so
 * the list cannot silently miss a panel.
 */
function registeredPanels() {
    const configs = join(REPO, 'frontend/module-configs');
    const paths = new Set();
    for (const f of readdirSync(configs).filter((n) => n.endsWith('.json'))) {
        const defs = JSON.parse(readFileSync(join(configs, f), 'utf8')).moduleDefinitions ?? {};
        for (const d of Object.values(defs)) if (d.path) paths.add(join(REPO, 'frontend', d.path));
    }
    const types = new Map();
    const unresolved = [];
    for (const file of paths) {
        const src = readFileSync(file, 'utf8');
        const dir = dirname(file);
        const sources = () => readdirSync(dir).filter((n) => n.endsWith('.js') && !n.includes('.test.'))
            .map((n) => readFileSync(join(dir, n), 'utf8'));
        for (const [, arg] of src.matchAll(/registerPanelComponent\(\s*([^,\s]+)\s*,/g)) {
            const constant = (name) => {
                const def = new RegExp(`${name}\\s*=\\s*['"]([^'"]+)['"]`);
                return sources().map((s) => def.exec(s)?.[1]).find(Boolean);
            };
            let ref = arg;
            if (ref === 'moduleInfo.componentType') ref = /componentType:\s*([^,\s]+)\s*,/.exec(src)?.[1] ?? ref;
            let type = /^['"]([^'"]+)['"]$/.exec(ref)?.[1];
            if (!type && /^[A-Z_][A-Z0-9_]*$/.test(ref)) type = constant(ref);
            if (type) types.set(type, file.slice(REPO.length + 1));
            else unresolved.push(`${file.slice(REPO.length + 1)}: ${arg}`);
        }
    }
    return { types, unresolved };
}

describe('coverage: every panel is in a tutorial, planned, or deliberately left out', () => {
    const { types, unresolved } = registeredPanels();
    const covered = new Set(TUTORIALS.flatMap((e) => [...panelsCovered(e.tutorial)]));

    it('the census resolves every registered panel', () => {
        expect(unresolved).toEqual([]);
        expect(types.size).toBeGreaterThan(40);
    });

    it('each panel is exactly one of covered, NOT_COVERED_YET, NO_TUTORIAL', () => {
        const problems = [];
        for (const type of types.keys()) {
            const n = [covered.has(type), type in NOT_COVERED_YET, type in NO_TUTORIAL].filter(Boolean).length;
            if (n === 0) problems.push(`${type}: in no tutorial and on neither list`);
            if (n > 1) problems.push(`${type}: covered by a tutorial AND listed (a covered panel leaves NOT_COVERED_YET)`);
        }
        expect(problems).toEqual([]);
    });

    it('the lists and the tutorials name only real panels', () => {
        const ghosts = [...Object.keys(NOT_COVERED_YET), ...Object.keys(NO_TUTORIAL), ...covered].filter((t) => !types.has(t));
        expect(ghosts).toEqual([]);
    });

    it('each non-panel feature names a tutorial that exists, or the planned one', () => {
        const ids = new Set(TUTORIALS.map((e) => e.tutorial.id));
        for (const f of FEATURES) {
            if (f.tutorial === null) expect(typeof f.planned === 'string' && f.planned.length > 0, f.id).toBe(true);
            else expect(ids.has(f.tutorial), f.id).toBe(true);
        }
    });
});
