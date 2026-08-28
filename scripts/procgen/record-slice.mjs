#!/usr/bin/env node
/**
 * record-slice — **ONE RECORD SURFACE: THE KICKOFF AS-BUILT §N, AND FOUR FACT
 * LINES DERIVED FROM IT AND FROM GIT** (R9 slice P4b, ⚖ ruling 54 (8); user,
 * 2026-08-28: *"I would like to implement one recording surface if possible"*).
 *
 * ⛓ THE PARSING, THE DERIVATION AND THE FOUR RENDERINGS LIVE IN
 * `sliceRecords.js`. This file is the CLI: it reads a kickoff section, prints
 * what a fold should say on the other four surfaces, and — under `--write` —
 * places the three it can place.
 *
 * ⛔⛔ **THE KICKOFF PATH IS AN ARGUMENT AND NEVER A CONSTANT.** `NewDocs/` is
 * gitignored by design and is not in a linked worktree at all; a repository
 * file that named it would be a repository file about something the repository
 * cannot see.
 *
 * ⛔ **THIS TOOL NEVER EDITS THE RECORD.** It reads §N, derives, and reports
 * disagreements as FINDINGS (`generate-procgen-reference`'s rule, same reason).
 * ⛔ **AND IT WRITES NO TIMESTAMP.**
 *
 * ── ⛓ WHAT IT PLACES, AND WHAT IT ONLY PRINTS ────────────────────────
 *
 *   memory close line   APPENDED to `project_seedling_bot_r9.md` (that file is
 *                       append-only and shared with live sessions).
 *   MEMORY.md bullets   REPLACED between `<!-- r9-status -->` /
 *                       `<!-- r9-traps -->` markers, whose count is asserted
 *                       BEFORE the write.
 *   queue header        INSERTED above a hand-written body, ONLY if absent.
 *   tracked heading     PRINTED ONLY. Its title is a re-voicing for an outside
 *                       reader (see `sliceRecords.js`) — a machine cannot
 *                       author it, and `--write` placing a heading over an
 *                       empty body would make the gate green on nothing.
 *
 * Run:
 *   node scripts/procgen/record-slice.mjs --kickoff=<path> --section=52
 *   node scripts/procgen/record-slice.mjs --kickoff=<path> --section=50 --head=1c47fff54
 *   node scripts/procgen/record-slice.mjs --kickoff=<path> --section=50 --calibrate
 *   node scripts/procgen/record-slice.mjs --kickoff=<path> --section=52 --session=<name> --write
 *   node scripts/procgen/record-slice.mjs --kickoff=<path> --section=52 --json
 *   node scripts/procgen/record-slice.mjs --kickoff=<path> --section=52 --memory=<dir>
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { argvHelp } from './argvHelp.js';
import {
    INDEX_FILE, QUEUE_DOC, R9_FILE, REPO, TRACKED_DOC,
    deriveFromGit, factLines, memoryDir, parseSection,
} from './sliceRecords.js';

argvHelp(import.meta.url);

const argv = process.argv.slice(2);
const arg = (n, fallback = null) => {
    const hit = argv.find((a) => a.startsWith(`--${n}=`));
    return hit === undefined ? fallback : hit.slice(n.length + 3);
};
const flag = (n) => argv.includes(`--${n}`);

/* ══════════════════════════════════════════════════════════════════════
 * THE MARKED REGIONS IN `MEMORY.md`
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ A REGION IS REPLACED BETWEEN MARKERS WHOSE COUNT IS ASSERTED FIRST.
 *
 * ⛔ The memory directory is OUTSIDE the repository and SHARED with live
 * sessions. An edit here that matched the wrong anchor would silently eat
 * another session's line, so: the open and close markers must each occur
 * EXACTLY ONCE (memory `feedback_splice_anchor_must_be_unique`), and a `cp`
 * backup is written before the first replacement.
 */
export function replaceRegion(text, name, body) {
    const open = `<!-- ${name} -->`;
    const close = `<!-- /${name} -->`;
    const opens = text.split(open).length - 1;
    const closes = text.split(close).length - 1;
    if (opens !== 1 || closes !== 1) {
        throw new Error(`record-slice: ${INDEX_FILE} holds ${opens} \`${open}\` and ${closes} `
            + `\`${close}\` — a marked region is replaced only when each marker occurs EXACTLY `
            + 'ONCE (the memory directory is shared with live sessions)');
    }
    const a = text.indexOf(open) + open.length;
    const b = text.indexOf(close);
    if (b < a) throw new Error(`record-slice: ${INDEX_FILE}'s \`${close}\` precedes its \`${open}\``);
    return `${text.slice(0, a)}\n${body}\n${text.slice(b)}`;
}

/* ══════════════════════════════════════════════════════════════════════
 * CALIBRATION — THE HAND-WRITTEN LINES ARE THE CORRECTNESS WITNESS
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛔⛔⛔ **A `--write` RUN TWICE IS BYTE-IDENTICAL AND THAT PROVES NOTHING.**
 * A producer reading its own output is a fixed point on every field (traps
 * 769 / 863). The witness that this tool derives the RIGHT facts is the
 * comparison against lines a human wrote from the same fold — so
 * `--calibrate` re-reads the four surfaces AS THEY STAND and compares the
 * fields it can extract from them, one by one.
 *
 * ⛓ Field by field, never string by string: the hand-written lines are prose
 * and will never equal a template. What must agree is the FACTS in them.
 */
const CAL = [
    {
        surface: 'memory close line',
        file: (M) => join(M, R9_FILE),
        find: (lines, slice) => lines.find((l) => new RegExp(`^#{0,3}\\s*⇒ SLICE ${slice} CLOSED`).test(l)),
    },
    {
        surface: 'queue header',
        file: () => join(REPO, QUEUE_DOC),
        find: (lines, slice) => lines.find((l) => l.startsWith('**⇒ ')
            && new RegExp(`\\b${slice}\\b`).test(l) && /\b(CLOSED|SHIPPED)\b/.test(l)),
    },
    {
        surface: 'tracked heading',
        file: () => join(REPO, TRACKED_DOC),
        find: (lines, slice) => lines.find((l) => l.startsWith(`### R9 slice ${slice}:`)),
    },
    {
        surface: 'MEMORY.md bullet',
        file: (M) => join(M, INDEX_FILE),
        find: (lines, slice) => lines.find((l) => new RegExp(`\\b${slice}\\b`).test(l)
            && l.includes(R9_FILE)),
    },
];

/** ⛓ The facts a hand-written line can be read for, and how. */
const FIELD_RE = {
    date: /\b(\d{4}-\d{2}-\d{2})\b/,
    section: /(?:as-built(?: kickoff)?|kickoff)\s*(?:§|\*\*§)(\d+)/i,
    head: /`main`\s*=?\s*@?\*{0,2}`([0-9a-f]{7,40})`/,
    traps: /traps?\s*\*{0,2}(\d{3})(?:\s*[–-]\s*(\d{3}))?/i,
};

function calibrate(parsed, lines, memory) {
    const rows = [];
    for (const c of CAL) {
        const path = c.file(memory);
        if (!existsSync(path)) { rows.push({ surface: c.surface, status: 'ABSENT FILE', path }); continue; }
        const hand = c.find(readFileSync(path, 'utf8').split('\n'), parsed.slice);
        if (!hand) { rows.push({ surface: c.surface, status: 'NO HAND-WRITTEN LINE', path }); continue; }
        const fields = [];
        for (const [name, re] of Object.entries(FIELD_RE)) {
            const m = re.exec(hand);
            if (!m) continue;
            const handValue = name === 'traps' ? `${m[1]}${m[2] ? `–${m[2]}` : ''}` : m[1];
            const ours = String(lines.fields[name]?.value ?? '');
            const agree = ours === handValue
                || (name === 'head' && ours.startsWith(handValue))
                || (name === 'head' && handValue.startsWith(ours));
            fields.push({ field: name, hand: handValue, derived: ours, agree });
        }
        rows.push({ surface: c.surface, status: 'READ', path, hand, fields });
    }
    return rows;
}

/* ══════════════════════════════════════════════════════════════════════
 * MAIN
 * ══════════════════════════════════════════════════════════════════════ */

export function main() {
    const kickoff = arg('kickoff');
    const section = arg('section');
    if (!kickoff || !section) {
        console.log('record-slice: --kickoff=<path> and --section=<N> are required '
            + '(the kickoff path is an ARGUMENT — this repository never names `NewDocs/`)');
        process.exit(1);
    }
    if (!existsSync(kickoff)) {
        console.log(`record-slice: no such kickoff — ${kickoff}`);
        process.exit(1);
    }
    const parsed = parseSection(readFileSync(kickoff, 'utf8'), Number(section));
    const derived = deriveFromGit(parsed, { repo: REPO, head: arg('head') });
    const lines = factLines(parsed, derived, { session: arg('session') });
    const findings = [...parsed.findings, ...derived.findings];
    const M = arg('memory', memoryDir({ repo: REPO }));

    if (flag('json')) {
        console.log(JSON.stringify({
            kickoff, section: parsed.section, slice: parsed.slice, parsed, derived, lines, findings,
        }, null, 2));
        process.exit(findings.length ? 1 : 0);
    }

    console.log(`# record-slice — §${parsed.section}, SLICE ${parsed.slice}`
        + `${parsed.qualifier ? ` (${parsed.qualifier})` : ''}, ${parsed.author}, ${parsed.date}`);
    console.log(`# ${parsed.subsections} subsection(s) · branch \`${parsed.branch ?? '(none stated)'}\``
        + ` · ${derived.commitCount} landed commit(s) · head \`${derived.headShort ?? '?'}\`\n`);

    console.log('── the memory close line ─────────────────────────────');
    console.log(lines.memoryClose);
    console.log('\n── the MEMORY.md R9 bullet ───────────────────────────');
    console.log(lines.memoryIndexBullet);
    console.log('\n── the queue header line ─────────────────────────────');
    console.log(lines.queueHeader);
    console.log('\n── the tracked-doc heading (PRINTED ONLY — its title is a re-voicing) ─');
    console.log(lines.trackedHeading);

    if (parsed.quotes.length) {
        console.log('\n── the user\'s own words, carried VERBATIM ────────────');
        for (const q of parsed.quotes.slice(0, 6)) console.log(`  *"${q}"*`);
    }

    if (flag('calibrate')) {
        console.log('\n══ CALIBRATION — the HAND-WRITTEN lines are the witness ══');
        let bad = 0;
        for (const r of calibrate(parsed, lines, M)) {
            if (r.status !== 'READ') { console.log(`\n${r.surface}: ⛔ ${r.status} (${r.path})`); bad += 1; continue; }
            console.log(`\n${r.surface}:`);
            for (const f of r.fields) {
                console.log(`  ${f.agree ? '✔' : '⛔'} ${f.field.padEnd(9)} hand ${JSON.stringify(f.hand)}`
                    + `  derived ${JSON.stringify(f.derived)}`);
                if (!f.agree) bad += 1;
            }
            if (!r.fields.length) console.log('  (no comparable field in that line)');
        }
        console.log(`\n${bad} disagreement(s) — each is either a hand-typing error or a field `
            + 'this tool failed to derive.');
    }

    if (flag('write')) {
        console.log('\n══ --write ═════════════════════════════════════════════');
        const writes = [];
        /* ⛓ the memory close line — APPENDED, never spliced. */
        const r9 = join(M, R9_FILE);
        const r9Text = readFileSync(r9, 'utf8');
        if (r9Text.includes(`⇒ SLICE ${parsed.slice} CLOSED`)) {
            console.log(`SKIP  ${R9_FILE} already carries a \`⇒ SLICE ${parsed.slice} CLOSED\` line`);
        } else {
            writeFileSync(`${r9}.p4b-backup`, r9Text);
            writeFileSync(r9, `${r9Text.replace(/\n*$/, '')}\n\n${lines.memoryClose}\n`);
            writes.push(R9_FILE);
            console.log(`ok    ${R9_FILE} += the close line (backup \`${R9_FILE}.p4b-backup\`)`);
        }
        /* ⛓ MEMORY.md — the marked region, count asserted by `replaceRegion`. */
        const idx = join(M, INDEX_FILE);
        const idxText = readFileSync(idx, 'utf8');
        writeFileSync(`${idx}.p4b-backup`, idxText);
        const next = replaceRegion(idxText, 'r9-status', lines.memoryIndexBullet);
        writeFileSync(idx, next);
        writes.push(INDEX_FILE);
        console.log(`ok    ${INDEX_FILE} <r9-status> replaced `
            + `(${idxText.length} B → ${next.length} B, backup \`${INDEX_FILE}.p4b-backup\`)`);
        /* ⛓ the queue header — inserted ONLY if absent; the body stays a human's. */
        if (derived.queue.line) {
            console.log(`SKIP  ${QUEUE_DOC} already has a block at :${derived.queue.line}`);
        } else {
            const q = join(REPO, QUEUE_DOC);
            const qText = readFileSync(q, 'utf8');
            writeFileSync(q, `${qText.replace(/\n*$/, '')}\n\n${lines.queueHeader}\n`);
            writes.push(QUEUE_DOC);
            console.log(`ok    ${QUEUE_DOC} += the header line — ⛔ the BODY is yours to write`);
        }
        console.log(`\n⛔ NOT WRITTEN: the tracked-doc heading. Its title is a re-voicing for an `
            + 'outside reader; place it yourself, with its body, and re-run the ⚖ 22 regen in the '
            + 'SAME commit.');
        console.log(`${writes.length} file(s) written.`);
    }

    if (findings.length) {
        console.log(`\n══ ${findings.length} FINDING(S) ═══════════════════════════════════`);
        for (const f of findings) console.log(`  ⛔ ${f}`);
    } else {
        console.log('\nNo findings — §N and git agree on every derivable field.');
    }
    process.exit(0);
}

/**
 * ⛓ THE ENTRY-POINT GUARD (R9 P4a, `check-procgen-help.mjs`'s IMPORT door):
 * a bare `import` of this file must do NOTHING, so the unit rows can reach
 * `replaceRegion` and `calibrate` without running a CLI.
 */
if (import.meta.url === `file://${process.argv[1]}`) main();
