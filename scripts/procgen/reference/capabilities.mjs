/**
 * reference/capabilities — **TABLE 7: WHAT EACH SUBSTRATE CAN DO, IN A
 * PERSON'S WORDS** (substrate chart S1).
 *
 * ⛓ The developer matrix (`registry.mjs`) is one row per FIELD; this is one row
 * per STATEMENT of `frontend/modules/procgenCore/substrateCapabilities.js`, the
 * vocabulary module the live Substrate Registry panel imports too. The columns
 * are the same entries, in the same registration order, loaded the same way
 * (`registry.mjs`'s `loadRegistry`). Nothing here decides an answer: every cell
 * is `capabilityRows(entries)`, and every word a reader sees below the page's
 * hand intro comes from that module or from an entry.
 *
 * ⛔ No substrate id is named in this file (asserted by the vocabulary's vitest,
 * which scans this source too).
 */

import { loadRegistry } from './registry.mjs';
import {
    CAPABILITY_GROUPS, CELL_KINDS, CELL_MARKS, capabilityRows, cardOf, uncoveredFields,
} from '../../../frontend/modules/procgenCore/substrateCapabilities.js';

/** ⛓ The user page this table lives in, and its region. */
export const CAPABILITIES_DOC = 'docs/json/features/procgen-substrates.md';
export const CAPABILITIES_TABLE = 'substrate-capability-chart';

/** ⛓ A `no` cell's text longer than this moves under the table as a note. */
export const INLINE_NOTE_LIMIT = 60;

/**
 * @param {{rows: {name: string}[]}} registry the built developer matrix — its
 *   rows ARE the field universe, so "fields no statement reads" is measured
 *   against the table a developer reads, not a second derivation of it
 */
export async function buildCapabilities(registry) {
    const { entries } = await loadRegistry();
    const rows = capabilityRows(entries);
    const names = registry.rows.map((r) => r.name);
    const uncovered = uncoveredFields(names, rows);
    const fieldsRead = [...new Set(rows.flatMap((r) => r.fields))].sort();
    return {
        columns: entries.map((e) => ({ id: e.id, label: e.label ?? e.id })),
        groups: CAPABILITY_GROUPS.map((g) => ({
            id: g.id, label: g.label, rows: rows.filter((r) => r.group === g.id).map((r) => r.id),
        })),
        rows,
        cards: entries.map((e) => cardOf(e, rows)),
        fieldsRead,
        uncovered,
        counts: {
            fields: names.length,
            statements: rows.length,
            substrates: entries.length,
            fieldsRead: fieldsRead.length,
            fieldsUnread: uncovered.length,
        },
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * THE MARKDOWN REGION
 * ══════════════════════════════════════════════════════════════════════ */

const mdCell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** ⛓ One cell's markdown, and the note it pushes when its text is long. */
function cellMarkdown(c, label, notes) {
    const mark = CELL_MARKS[c.kind];
    if (c.kind === CELL_KINDS.NA) return mark;
    if (!c.text) return mark;
    if (c.kind === CELL_KINDS.NO && c.text.length > INLINE_NOTE_LIMIT) {
        notes.push(`${label}: ${c.text}`);
        return `${mark} (note ${notes.length})`;
    }
    return `${mark} ${mdCell(c.text)}`;
}

export function capabilitiesMarkdown(v) {
    const labelOf = new Map(v.columns.map((c) => [c.id, c.label]));
    const out = [
        `**${v.counts.statements} statements · ${v.counts.substrates} substrates · `
        + `${v.counts.fieldsRead} registry fields read (${v.counts.fields - v.counts.fieldsUnread} of the `
        + `developer matrix's ${v.counts.fields}, counting the parents of the fields read) · `
        + `${v.counts.fieldsUnread} not yet read.**`,
        '',
    ];
    const head = `| | What you can do | ${v.columns.map((c) => mdCell(c.label)).join(' | ')} |`;
    const rule = `|---|---|${v.columns.map(() => '---').join('|')}|`;
    for (const g of v.groups) {
        const notes = [];
        out.push(`## ${g.label}`, '', head, rule);
        for (const id of g.rows) {
            const r = v.rows.find((x) => x.id === id);
            const cells = r.cells.map((c) => cellMarkdown(c, labelOf.get(c.id), notes));
            out.push(`| ${r.id} | ${mdCell(r.statement)} | ${cells.join(' | ')} |`);
        }
        out.push('');
        if (notes.length) {
            notes.forEach((n, i) => out.push(`${i + 1}. ${mdCell(n)}`));
            out.push('');
        }
    }
    out.push('## Fields behind each row', '',
        'Each row is answered from these fields of the substrate\'s registry entry — the '
        + 'names in the developer matrix.', '');
    for (const r of v.rows) out.push(`- **${r.id}** — ${r.fields.map((f) => `\`${f}\``).join(', ')}`);
    out.push('', '## Each substrate on its own', '',
        'What each one lets you do — its ✓ and degree cells from the tables above, in the same order.', '');
    const groupLabel = new Map(v.groups.map((g) => [g.id, g.label]));
    for (const card of v.cards) {
        out.push(`### ${card.label}`, '');
        for (const l of card.lines) {
            out.push(`- *${groupLabel.get(l.group)}* — ${l.statement}${l.text ? `: ${l.text}` : ''}`);
        }
        out.push('');
    }
    out.push('## Fields no statement reads yet', '',
        `${v.uncovered.length} fields of the developer matrix are not behind any row above — `
        + 'plumbing a person does not choose a substrate by, or a capability not yet put into '
        + 'words:', '', v.uncovered.map((n) => `\`${n}\``).join(', '));
    return out.join('\n').replace(/\n+$/, '');
}
