/**
 * The tutorial data, its validator, the guide renderer, and the pin on every
 * generated guide (a hand edit to a guide, or a tutorial edit that skipped
 * `node scripts/tutorials/generate-tutorial-docs.mjs`, reds here).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, renderGuides } from '../../../scripts/tutorials/generate-tutorial-docs.mjs';
import { TUTORIALS } from './content/index.js';
import { generatedMarker, tutorialMarkdown } from './tutorialMarkdown.js';
import { blocksFor, panelSteps, validateTutorial } from './tutorialShape.js';

const tiny = (over = {}) => ({
    id: 'tiny',
    title: 'Tiny',
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

    it('every generated guide equals what the generator writes today (byte for byte)', () => {
        for (const { doc, text } of renderGuides()) {
            expect(readFileSync(join(REPO, doc), 'utf8'), doc).toBe(text);
        }
    });

    it('every step the panel walks can be checked or performed (actions, run, or done)', () => {
        for (const { tutorial } of TUTORIALS) {
            const bare = panelSteps(tutorial).filter(({ step }) => !step.actions?.length && !step.run && !step.done);
            expect(bare.map((s) => s.step.id), tutorial.id).toEqual([]);
        }
    });
});
