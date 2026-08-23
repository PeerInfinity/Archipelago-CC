/**
 * reference/campaignChain — **THE CAMPAIGN CHAIN TABLE, GENERATED.**
 * ⚖ Ruling 38 item (1) (user, 2026-08-23), R9 slice 12d.
 *
 * ── ⛔ WHY THIS IS THE FOURTH MARKDOWN REGION ──────────────────────────
 *
 * `seedling-bot.md` carried the chain as a hand-drawn two-column block under
 * *"Slice 6"*, with a paragraph above it saying **"THE TABLE BELOW IS KEPT
 * CURRENT, NOT FROZEN AT SLICE 6 — every slice that grows the chain grows it
 * here"**. That sentence is the cost: a table a human keeps is a table that is
 * wrong the day somebody forgets, and slice 12b″ had to grow it by hand along
 * with five other copies of the same fact.
 *
 * Everything in it is already on disk:
 *
 *   the DECLARATION   `frontend/modules/seedlingDemo/campaignChain.js` — the
 *                     order, each room's `level`/`to`, what it collects, and
 *                     which segments were PROMOTED rather than re-authored
 *   the TAPES         each segment's own `tick_count`, and their sum
 *   the FRONTIER      `fixtures/campaign-frontier.json` — the route step in
 *                     front of the chain and the survey's refusal family,
 *                     which is what makes the STOP line a measurement
 *
 * ⚠ THE TICK COUNTS COME FROM THE TAPES, NOT FROM THE DECLARATION, and that is
 * deliberate: a re-record moves them and nothing else, so a table that read
 * them from a declaration would be a second place to fix (trap 556's family).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO } from './lib.mjs';

/** The document this region lives in. */
export const CAMPAIGN_DOC = 'docs/json/developer/procgen/seedling-bot.md';

const MODULE = join(REPO, 'frontend/modules/seedlingDemo');
const TAPES = join(MODULE, 'fixtures/tapes');
const FRONTIER = join(MODULE, 'fixtures/campaign-frontier.json');

/**
 * The chain, as the generator sees it: the declaration joined to the tapes and
 * to the committed route survey.
 *
 * ⛔ A SEGMENT WITH NO TAPE IS REPORTED, NOT DROPPED. A declaration that names
 * a room nobody has recorded yet is exactly the state `--grow` passes through,
 * and a table that silently omitted the row would hide it.
 */
export async function buildCampaignChain() {
    const { CAMPAIGN_SEGMENTS, CAMPAIGN_CHAIN_ID } = await import(
        join(MODULE, 'campaignChain.js'));
    const frontier = JSON.parse(readFileSync(FRONTIER, 'utf8'));
    const rows = CAMPAIGN_SEGMENTS.map((s, i) => {
        let ticks = null;
        try {
            ticks = JSON.parse(readFileSync(join(TAPES, `${s.name}.json`), 'utf8'))
                .tick_count ?? null;
        } catch { ticks = null; }
        return {
            n: i + 1,
            name: s.name,
            level: s.level,
            to: s.to,
            ticks,
            promoted: Boolean(s.promoted),
            collects: [...(s.collects ?? [])],
        };
    });
    const missing = rows.filter((r) => r.ticks === null).map((r) => r.name);
    return {
        id: CAMPAIGN_CHAIN_ID,
        rows,
        segments: rows.length,
        promoted: rows.filter((r) => r.promoted).length,
        ticks: rows.reduce((n, r) => n + (r.ticks ?? 0), 0),
        arrivesAt: rows[rows.length - 1]?.to ?? null,
        nextStep: frontier.nextStep ?? null,
        refusal: frontier.refusal ?? null,
        findings: missing.length
            ? [`${missing.join(', ')}: declared in the chain and NOT on disk`]
            : [],
    };
}

/** The markdown region body. */
export function campaignChainMarkdown(v) {
    const earns = (r) => (r.collects.length
        ? r.collects.map((c) => `\`${c}@L${r.level}\``).join(', ')
        : '—');
    const lines = [
        `\`${v.id}\` — **${v.segments} segments**, custody, from `
        + '`new Game(0,80,128)` with an empty save to the '
        + `**L${v.arrivesAt}** arrival, **${v.ticks} ticks**. Segments 1–`
        + `${v.promoted} are PROMOTED (their boots already ARE their predecessors' `
        + 'latches, so this chain gives them a RELATION rather than a rewrite); every '
        + 'later one boots its predecessor\'s MEASURED latch.',
        '',
        '| # | tape | rooms | ticks | earns |',
        '|---|---|---|---|---|',
        ...v.rows.map((r) => `| ${r.n}${r.promoted ? ' ⛓' : ''} | \`${r.name}\` | `
            + `L${r.level} → L${r.to} | ${r.ticks ?? '**not on disk**'} | ${earns(r)} |`),
        '',
    ];
    if (v.nextStep && v.refusal) {
        lines.push(`**STOP — route step ${v.nextStep.step}, L${v.nextStep.level}.** `
            + `The chain ends at the last step the survey SOLVES; the first one it `
            + `refuses is the next work order: *${v.refusal.family}*.`);
    } else {
        lines.push('**No frontier is committed**, so what is in front of the chain is '
            + 'unstated — run `census-seedling-campaign.mjs --write-frontier`.');
    }
    if (v.findings.length) {
        lines.push('', `⛔ **FINDINGS:** ${v.findings.join('; ')}.`);
    }
    return lines.join('\n');
}
