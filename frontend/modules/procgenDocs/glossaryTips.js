/**
 * procgenDocs/glossaryTips.js — **THE GLOSSARY, ON THE LAB PAGES, AS TOOLTIPS
 * AND NOTHING ELSE.** (PROCGEN DOCS slice P2, D4(b).)
 *
 * ⚖ The user, 2026-08-18, asked for a glossary *"linked from the document and
 * the demo pages"*. On the two LAB pages that link is a header anchor and a
 * `title=` on the section summaries and legend rows — ⛔ **and nothing else.**
 * A lab page gains a link and tooltips; no readout of theirs moves, no control
 * changes, no legend row's TEXT changes (three acceptance rows assert that
 * text, and `#layers` is enumerated by three more).
 *
 * ── ⛓⛓ THE SLUG IS DECLARED IN HTML, THE TEXT IS COMPUTED ──────────────
 *
 * A section says `data-term="ledger"` in the markup and `applyGlossaryTips()`
 * fills in the sentence at mount. ⛔ The alternative — typing the sentence
 * into a `title=` attribute — would be a SECOND spelling of a definition, and
 * the whole point of P2 is that there is one.
 *
 * ⛔ A tooltip is NOT a readout. Nothing gates on one, and a `data-term`
 * naming a slug the glossary does not define is skipped silently here — the
 * unit row is where an unknown slug reds, because that is where a person can
 * be told which one.
 *
 * ⛔ No node imports: this runs on a page.
 */

import { oneLinerFor } from './glossary.js';

/**
 * ⛓ The overlay LEGEND groups are keyed by the drawing code's own ids
 * (`site:chamber`, `element:flagLock`, `area:locks`, `area:3`) — those ids are
 * not glossary slugs and must not become them: `watchGenOverlay.js` owns them
 * and renaming one there would be a picture change, not a vocabulary change.
 * This map is the seam between the two, and an id with no entry simply gets no
 * tooltip.
 */
const LEGEND_TERMS = Object.freeze(new Map([
    ['site:main', 'site'],
    ['site:bend', 'site'],
    ['site:branch', 'site'],
    ['site:tip', 'site'],
    ['site:chamber', 'chamber'],
    ['site:corridor', 'corridor'],
    ['element:reserved', 'pre-carve-element'],
    ['element:site', 'element'],
    ['element:tunnel', 'mouth'],
    ['element:block', 'guard'],
    ['element:button', 'guard'],
    ['element:door', 'door-law'],
    ['element:clearer', 'clearer'],
    ['element:wall', 'kill-gate'],
    ['element:carved', 'block-pocket'],
    ['element:flag', 'flag'],
    ['element:flagLock', 'lock'],
    ['element:demand', 'demand'],
    ['area:locks', 'lock'],
    ['area:flags', 'flag'],
]));

/** A legend group id → a glossary slug, or `null`. ⛓ `area:<n>` is one AREA
 *  however many there are, so it is matched by prefix rather than listed. */
export function legendTermFor(id) {
    const key = String(id ?? '');
    if (LEGEND_TERMS.has(key)) return LEGEND_TERMS.get(key);
    if (key.startsWith('area:')) return 'area';
    if (key.startsWith('note:')) return 'graded-refusal';
    return null;
}

/** The sentence for a legend group id, or `''`. ⛔ `''` means NO tooltip; a
 *  `title=""` is a missing tooltip and a throw is a broken page. */
export const legendTipFor = (id) => {
    const slug = legendTermFor(id);
    return slug ? oneLinerFor(slug) : '';
};

/**
 * Fill in `title=` on every `[data-term]` under `root`. Returns how many were
 * filled, which is what a page can log — ⛔ it is deliberately NOT published as
 * a readout: a tooltip count is not a fact about the level.
 *
 * @param {ParentNode} [root]
 */
export function applyGlossaryTips(root) {
    const host = root ?? (typeof document === 'undefined' ? null : document);
    if (!host) return 0;
    let filled = 0;
    for (const el of host.querySelectorAll('[data-term]')) {
        const tip = oneLinerFor(el.dataset.term);
        if (!tip) continue;
        el.setAttribute('title', tip);
        filled += 1;
    }
    return filled;
}

export { oneLinerFor };
