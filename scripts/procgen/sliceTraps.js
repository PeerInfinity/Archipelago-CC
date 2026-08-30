/**
 * sliceTraps — **ONE FILE PER TRAP, NAMING A FAMILY; THE FILESYSTEM IS THE
 * COLLISION GUARD** (R9 slice P4b, ⚖ ruling 54 (8) *"one file per trap (no
 * counter to collide)"*; ⚖ 63 (e)).
 *
 * ── ⛓ THE MEASUREMENT THAT DECIDED THIS ─────────────────────────────
 *
 * ⚖ The user, 2026-08-28, on being shown the ladder: *"How did the trap list
 * grow to 907 entries so quickly? Are there duplicates? Is it practical to
 * refer to a list that long?"* Measured for that question: **758 KB, 9,627
 * lines, ~805 numbered entries, 653 → 907 in about three weeks**, NO duplicate
 * numbers at that head (the collisions that did happen were at ALLOCATION and
 * were caught by hand), and the content duplicated BY FAMILY — thirteen
 * families in `reference_pitfall_families.md`, of which only eight entries
 * named one.
 *
 * ⇒ (a) the ladder is FROZEN where P4a left it; (b) every trap from the next
 * number lives in its own file; (c) every new trap NAMES A FAMILY.
 *
 * ── ⛔⛔ WHY THE 907 ARE NOT MIGRATED, AND THAT IS THE ANSWER ────────
 *
 * Every citation in this repository is BY NUMBER — `trap NNN`, 367 times in
 * `scripts/procgen`, 50 in `docs/json`, 33 in `CC/docs` at `86f7974d7`, with a
 * maximum cited number of 916. A two-place lookup keeps all of them resolving
 * at zero cost: below the freeze the ladder answers, above it a file does.
 * Splitting 758 KB into ~805 files would move every one of those bytes to buy
 * nothing a `--trap=NNN` lookup does not already give.
 *
 * ── ⛓ THE ALLOCATION RULE, AND WHY IT CANNOT COLLIDE ────────────────
 *
 * `max(LADDER_FROZEN_AT, max file number) + 1`, then `existsSync` REFUSES.
 * ⛔ The old rule was *"read the ladder's tail and add one"*, and two sessions
 * that read the same tail allocated the same number — twice, in this campaign.
 * A number that is a FILENAME cannot be allocated twice, because the second
 * `writeFileSync` has a file in its way and this module looks first.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    FAMILIES_FILE, LADDER_FILE, LADDER_FROZEN_AT, TRAPS_DIR, memoryDir,
} from './sliceRecords.js';

/**
 * ⛓⛓⛓ **THE NUMBERS A TEXT CITES — AND THE PLURAL FORM IS THE ONE THAT GOT
 * AWAY.** The first cut was `\btrap (\d{3,})\b`, which reads `trap 924` and
 * MISSES `traps 922, 923, 925, 926` — four of the five citations in the very
 * commit that introduced it, because the plural takes a comma list. A range
 * (`traps 903–907`) is every number in it, since that is what the citation
 * means.
 *
 * ⛔ The bound is stated: a number is 3+ digits, so `trap 12` is not a
 * citation and neither is a year. Every trap ever allocated is ≥ 100.
 */
export const TRAP_CITE_RE = /\btraps?\s+(\d{3,}(?:\s*(?:,|and|&|[–-])\s*\d{3,})*)/gi;

export function trapsCitedIn(text) {
    const out = new Set();
    for (const m of String(text).matchAll(TRAP_CITE_RE)) {
        const list = m[1];
        /* ⛓ a RANGE is every number in it; a comma list is its members. */
        for (const part of list.split(/\s*(?:,|and|&)\s*/)) {
            const range = /^(\d{3,})\s*[–-]\s*(\d{3,})$/.exec(part.trim());
            if (range) {
                const [a, b] = [Number(range[1]), Number(range[2])];
                if (b >= a && b - a < 1000) for (let i = a; i <= b; i += 1) out.add(i);
                else { out.add(a); out.add(b); }
            } else if (/^\d{3,}$/.test(part.trim())) out.add(Number(part.trim()));
        }
    }
    return [...out].sort((a, b) => a - b);
}

/** ⛓ `922-a-short-slug.md` — the number leads so `sort` is numeric order. */
export const TRAP_FILE_RE = /^(\d{3,})-([a-z0-9-]+)\.md$/;

/** ⛓ A slug is what a title reduces to: lower case, words joined by hyphens. */
export function slugify(title, { words = 8 } = {}) {
    return title.toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
        .slice(0, words).join('-') || 'trap';
}

/**
 * ⛓⛓ THE THIRTEEN FAMILIES, READ OUT OF THE FAMILIES FILE — never a list
 * here. A family added to that file is usable the moment it is written, and a
 * family name this module typed would be a fourteenth answer to "which
 * families are there".
 */
export function familiesIn(text) {
    return [...text.matchAll(/^- ([^(:\n]+?)\s*(?:\(|:)/gm)].map((m) => m[1].trim());
}

export function families({ memory = memoryDir() } = {}) {
    const p = join(memory, FAMILIES_FILE);
    return existsSync(p) ? familiesIn(readFileSync(p, 'utf8')) : [];
}

/**
 * ⛓⛓⛓ DECLARE A NEW FAMILY — **APPENDED IN THE FILE'S OWN CONVENTION, which
 * is the half the first cut got wrong.**
 *
 * ⛔ MEASURED: `familiesIn` reads a name up to the first `(` or `:`, and the
 * first cut appended `- <name> — <definition>`. The name then parsed as a
 * hundred-character sentence and the census reported, as undeclared, the
 * family it had JUST WRITTEN — a producer that wrote into a file it also
 * parses, in a spelling it could not read back. ⇒ the declaration is SPLIT
 * and re-emitted as `- <name>: <definition>`, and `familiesIn` of the result
 * must contain the name, which is the round trip this function owes.
 *
 * @param {string} decl `<name> — <definition>` or `<name>: <definition>`
 * @returns {{name: string, line: string}}
 */
export function declareFamily(decl, { memory = memoryDir() } = {}) {
    const [rawName, ...rest] = String(decl).trim().split(/\s*(?:[—:-]\s+)/);
    const name = rawName.trim();
    if (!name) throw new Error('sliceTraps: a family declaration needs a name');
    const body = rest.join(' ').trim() || String(decl).trim();
    const line = `- ${name}: ${body}`;
    const p = join(memory, FAMILIES_FILE);
    const before = readFileSync(p, 'utf8');
    if (familiesIn(before).includes(name)) return { name, line, already: true };
    writeFileSync(`${p}.p4b-backup`, before);
    const after = `${before.replace(/\n*$/, '')}\n${line}\n`;
    /** ⛔ THE ROUND TRIP, ASSERTED BEFORE THE FILE IS LEFT IN THAT STATE. */
    if (!familiesIn(after).includes(name)) {
        throw new Error(`sliceTraps: the declaration ${JSON.stringify(line)} does not read back as `
            + `the family ${JSON.stringify(name)} — a line this file writes and cannot parse`);
    }
    writeFileSync(p, after);
    return { name, line, already: false };
}

/**
 * Every trap file on disk, newest number last. ⛔ A file whose name does not
 * carry a number is REPORTED, not skipped: a trap nobody can cite is a trap
 * that is not in the index, which is the whole failure this shape prevents.
 */
export function trapFiles({ memory = memoryDir() } = {}) {
    const dir = join(memory, TRAPS_DIR);
    if (!existsSync(dir)) return { files: [], unnumbered: [] };
    const all = readdirSync(dir).filter((f) => f.endsWith('.md'));
    const files = [];
    const unnumbered = [];
    for (const f of all) {
        const m = TRAP_FILE_RE.exec(f);
        if (m) files.push({ file: f, number: Number(m[1]), slug: m[2], path: join(dir, f) });
        else unnumbered.push(f);
    }
    files.sort((a, b) => a.number - b.number);
    return { files, unnumbered };
}

/** The frontmatter of one trap file, as a flat object. */
export function frontmatterIn(text) {
    const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
    if (!m) return null;
    const out = {};
    for (const line of m[1].split('\n')) {
        const kv = /^([a-z][a-zA-Z0-9_]*):\s*(.*)$/.exec(line);
        if (kv) out[kv[1]] = kv[2].trim();
    }
    return out;
}

/**
 * ⛓⛓⛓ THE CENSUS — what the two places hold, and the ONE number that separates
 * them. This is what `MEMORY.md`'s trap bullet is derived from, so *"tail N +
 * recent ranges"* stops being a sentence somebody re-types every slice.
 */
export function trapCensus({ memory = memoryDir() } = {}) {
    const { files, unnumbered } = trapFiles({ memory });
    const bySlice = new Map();
    const findings = [];
    for (const f of files) {
        const fm = frontmatterIn(readFileSync(f.path, 'utf8')) ?? {};
        if (Number(fm.number) !== f.number) {
            findings.push(`${TRAPS_DIR}/${f.file}: frontmatter \`number: ${fm.number}\` `
                + `disagrees with the FILENAME's ${f.number} — the filename is the allocation`);
        }
        if (!fm.family) findings.push(`${TRAPS_DIR}/${f.file}: no \`family:\` — ⚖ 63 (e) requires one`);
        const slice = fm.slice ?? '(unattributed)';
        if (!bySlice.has(slice)) bySlice.set(slice, []);
        bySlice.get(slice).push(f.number);
    }
    for (const f of unnumbered) {
        findings.push(`${TRAPS_DIR}/${f}: the filename carries no number — a trap nobody can cite`);
    }
    const known = new Set(families({ memory }));
    for (const f of files) {
        const fm = frontmatterIn(readFileSync(f.path, 'utf8')) ?? {};
        if (fm.family && !known.has(fm.family)) {
            findings.push(`${TRAPS_DIR}/${f.file}: family ${JSON.stringify(fm.family)} is not one `
                + `of the ${known.size} in ${FAMILIES_FILE} — declare it with \`--family=new:<definition>\``);
        }
    }
    const recent = [...bySlice.entries()].map(([slice, ns]) => ({
        slice,
        range: ns.length === 1 ? String(ns[0]) : `${Math.min(...ns)}–${Math.max(...ns)}`,
        n: ns.length,
        max: Math.max(...ns),
    })).sort((a, b) => b.max - a.max);
    return {
        frozenAt: LADDER_FROZEN_AT,
        files: files.length,
        numbers: files.map((f) => f.number),
        next: nextNumber({ memory }),
        recent,
        findings,
    };
}

/**
 * ⛔⛔ THE NEXT NUMBER IS `max(THE FREEZE, THE FILES) + 1` — never "the
 * ladder's tail plus one". The ladder is frozen, so its tail is a CONSTANT;
 * the files are the live half; and taking the max of the two means a first
 * allocation into an empty directory still lands above every ladder entry.
 */
export function nextNumber({ memory = memoryDir() } = {}) {
    const { files } = trapFiles({ memory });
    return Math.max(LADDER_FROZEN_AT, ...files.map((f) => f.number), 0) + 1;
}

/** The rendered body of a trap file — the ladder's own shape, kept. */
export function trapMarkdown({ number, title, slice, family, body, lesson }) {
    const head = `---\nnumber: ${number}\nslice: ${slice}\nfamily: ${family}\n---\n\n`;
    const t = title.replace(/\s+$/, '').replace(/\.$/, '');
    return `${head}**${number}. ${t}.** ${slice}.\n${body.trim()}\n${lesson ? `⇒ ${lesson.trim()}\n` : ''}`;
}

/**
 * Allocate and write one trap. ⛔ `existsSync` REFUSES BY NAME — two sessions
 * racing land on the same number only if they both read `nextNumber` before
 * either wrote, and the second write then finds a file in its way.
 */
export function allocateTrap({
    title, slice, family, body = '', lesson = '', memory = memoryDir(), number = null,
} = {}) {
    if (!title) throw new Error('sliceTraps: a trap needs a --title=');
    if (!slice) throw new Error('sliceTraps: a trap needs a --slice=');
    if (!family) throw new Error('sliceTraps: a trap needs a --family= (⚖ 63 (e))');
    const dir = join(memory, TRAPS_DIR);
    mkdirSync(dir, { recursive: true });
    const n = number ?? nextNumber({ memory });
    if (n <= LADDER_FROZEN_AT) {
        throw new Error(`sliceTraps: ${n} is at or below the frozen ladder (${LADDER_FROZEN_AT}) — `
            + 'that number is already the ladder\'s and this directory starts above it');
    }
    const file = `${n}-${slugify(title)}.md`;
    const path = join(dir, file);
    if (existsSync(path)) {
        throw new Error(`sliceTraps: ${TRAPS_DIR}/${file} already exists — the FILESYSTEM is the `
            + 'collision guard and it just refused. Re-read `nextNumber` and try again.');
    }
    const clash = trapFiles({ memory }).files.find((f) => f.number === n);
    if (clash) {
        throw new Error(`sliceTraps: ${n} is already allocated as ${TRAPS_DIR}/${clash.file}`);
    }
    writeFileSync(path, trapMarkdown({ number: n, title, slice, family, body, lesson }));
    return { number: n, file, path };
}

/**
 * ⛓⛓ RESOLVE A CITATION FROM EITHER PLACE — this is what makes "no migration"
 * a decision rather than a debt. Below the freeze the ladder answers; above
 * it, a file.
 */
export function readTrap(n, { memory = memoryDir() } = {}) {
    const num = Number(n);
    if (num > LADDER_FROZEN_AT) {
        const hit = trapFiles({ memory }).files.find((f) => f.number === num);
        if (!hit) return { number: num, where: `${TRAPS_DIR}/`, found: false, text: null };
        return {
            number: num, where: `${TRAPS_DIR}/${hit.file}`, found: true,
            text: readFileSync(hit.path, 'utf8'),
        };
    }
    const ladder = join(memory, LADDER_FILE);
    if (!existsSync(ladder)) return { number: num, where: LADDER_FILE, found: false, text: null };
    const lines = readFileSync(ladder, 'utf8').split('\n');
    /**
     * ⛓ THE LADDER IS NOT UNIFORM AND THAT IS WHY THIS READS TWO SHAPES: the
     * old entries are `## N — TITLE` headings and the new ones are
     * `**N. TITLE.** slice.` lines. A reader that knew only one would return
     * "not found" for half the ladder.
     */
    const at = lines.findIndex((l) => new RegExp(`^(?:## ${num} [—-]|\\*\\*${num}\\. )`).test(l));
    if (at < 0) return { number: num, where: LADDER_FILE, found: false, text: null };
    let end = lines.length;
    for (let i = at + 1; i < lines.length; i += 1) {
        if (/^(?:## \d+ [—-]|\*\*\d+\. )/.test(lines[i])) { end = i; break; }
    }
    return {
        number: num, where: `${LADDER_FILE}:${at + 1}`, found: true,
        text: lines.slice(at, end).join('\n').trim(),
    };
}

/**
 * ⛓ THE ONE LINE THE FROZEN LADDER GAINS. ⛔ Appended once, and this module
 * REFUSES to append anything else to that file ever again — the freeze is the
 * point, and a tool that could still write entries there would be a second
 * allocator.
 */
export const FREEZE_NOTICE = (n = LADDER_FROZEN_AT) =>
    `\n**⛔ THE LADDER IS FROZEN AT ${n}.** Traps from **${n + 1}** live ONE PER FILE in `
    + `\`${TRAPS_DIR}/<NNN>-<slug>.md\`, each with a \`family:\` (⚖ 63 (e), R9 slice P4b). `
    + 'Nothing is appended here again; every `trap NNN` citation still resolves — '
    + `\`node scripts/procgen/record-slice.mjs --trap=NNN\` reads whichever place holds it.\n`;
