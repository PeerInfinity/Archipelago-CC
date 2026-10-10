/**
 * tutorialMarkdown.js — a tutorial (tutorialShape.js) written out as a user
 * guide `.md`. Pure: no DOM, no node imports, so the generator script and the
 * unit pin call the same function.
 *
 * Layout: `# title`, the intro paragraphs, one `## section` per section (its
 * prose as paragraphs, each run of consecutive steps as one numbered list),
 * then the outro section, then the GENERATED marker. ⛓ The marker goes LAST:
 * the Quick Launch docs index takes a guide's first non-heading paragraph as
 * its summary (`docSummary`), so a leading comment would become the summary.
 */
import { blocksFor } from './tutorialShape.js';

/** The marker's text, naming the source and the command; the pin checks for it. */
export function generatedMarker(sourcePath) {
    return `<!-- GENERATED from ${sourcePath} by scripts/tutorials/generate-tutorial-docs.mjs — `
        + 'edit the tutorial, then run the generator; a hand edit here fails the pin. -->';
}

function renderBlocks(blocks) {
    const out = [];
    let n = 0;
    let inList = false;
    for (const b of blocksFor(blocks, 'doc')) {
        if (b.step) {
            if (!inList) n = 0;
            n += 1;
            out.push({ list: !inList ? 'start' : 'continue', text: `${n}. ${b.step.text}` });
            inList = true;
        } else {
            out.push({ list: null, text: b.prose });
            inList = false;
        }
    }
    // Paragraphs are blank-line separated; the items of one numbered list are not.
    let md = '';
    out.forEach((o, i) => {
        if (i > 0) md += o.list === 'continue' ? '\n' : '\n\n';
        md += o.text;
    });
    return md;
}

/** The whole guide, ending in one newline. */
export function tutorialMarkdown(t, sourcePath) {
    const parts = [`# ${t.title}`];
    const intro = renderBlocks(t.intro);
    if (intro) parts.push(intro);
    for (const s of t.sections) parts.push(`## ${s.title}`, renderBlocks(s.blocks));
    if (t.outro) parts.push(`## ${t.outro.title}`, renderBlocks(t.outro.blocks));
    parts.push(generatedMarker(sourcePath));
    return `${parts.filter(Boolean).join('\n\n')}\n`;
}
