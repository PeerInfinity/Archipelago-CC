#!/usr/bin/env node
/**
 * probe-seedling-ctor-args — THE CONSTRUCTOR ARGUMENT-TABLE AUDIT.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 11, step 2.
 * Brief: `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §24.
 *
 * ── WHY A TABLE AND NOT ANOTHER INSTANCE ──────────────────────────────
 *
 * The literal `-1` has now entered this arc's ledger THREE separate ways,
 * and every time it was found by tripping over one instance:
 *
 *   R2   `Lock(_x, _y, _t, _tag:int = -1)` — a CONSTRUCTOR DEFAULT. Four
 *        of L39's eight activators take it, and the model read the
 *        absent `tag` attribute instead (§20.4).
 *   R4   `ShieldLock` passes a hardcoded `-2` into the group slot, so a
 *        shield lock is in no group any map data can name.
 *   R5   `BossLock.as:31` passes a hardcoded `-1` into the group slot —
 *        and `FORCED_TSET`'s own docblock claimed it had "checked every
 *        `super(` call" (§23.8). It had; the literal is one argument
 *        right of where `_t` appears at the CALL site, because
 *        `Game.as:2199` passes `o.@keyType` there and the class forwards
 *        it as a GRAPHIC index.
 *
 * Three instances of one family, each paid for separately. This probe
 * pays once: it resolves, for EVERY class the census instantiates, what
 * actually reaches the two slots the model reads — `Activators.tSet` (the
 * group) and the class's own `tag` field — and diffs that against what
 * `tSetOf` / `tagOf` believe.
 *
 * ── HOW IT RESOLVES ───────────────────────────────────────────────────
 *
 * Three strata, and the middle one is the whole point:
 *
 *   1. `Game.as`'s construction table — the ogmo tag, the class, and the
 *      ARGUMENT EXPRESSIONS, in slot order. This is the only place that
 *      knows `bosslock`'s third argument is `o.@keyType`.
 *   2. each class's ctor signature and its `super(...)` call, chained up
 *      to `Activators`, substituting bound arguments at every hop. This
 *      is where a literal parked in a slot stops being invisible: it does
 *      not matter what the CALL site passes if the class overwrites it.
 *   3. the ctor BODY's `tag = ...` assignment, which is where a forced
 *      tag lives (`MoonrockPile`) and where a defaulted one lands.
 *
 * ⚠ IT IS A TEXTUAL RESOLVER, NOT AN INTERPRETER, and it says so: an
 * argument it cannot reduce to an attribute or a literal is reported as
 * an `expr` with its text, and an `expr` in a slot the model reads is a
 * NAMED FAILURE rather than a shrug. The failure mode this exists to
 * prevent is silence, so anything unclassified throws.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-ctor-args.mjs
 *   node scripts/procgen/probe-seedling-ctor-args.mjs --all   # full table
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const SRC = join(process.env.HOME, 'CC', 'seedling', 'src');

const ALL = process.argv.includes('--all');

const { ENTITY_CLASSES, FORCED_TSET, FORCED_TAG } = await import(join(MODULE, 'levelWorld.js'));

if (!existsSync(SRC)) {
    console.log(`SKIP: no AS3 source at ${SRC} — this probe reads the fork, which is `
        + 'out of repo (MIT, ~/CC/seedling).');
    process.exit(0);
}

// ── the class index: every .as file, by class name ────────────────────
const files = new Map();
(function walk(dir) {
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (e.endsWith('.as')) files.set(e.slice(0, -3), p);
    }
}(SRC));

/**
 * Split an argument list on commas at PAREN/BRACKET DEPTH ZERO.
 *
 * ⚠ Naive `split(',')` breaks on exactly the arguments that matter:
 * `Boolean(int(o.@flip))` and `String(o.@tag) == "" ? -1 : o.@tag` both
 * carry commas' worth of nesting, and the teleporter's ternary is the one
 * argument in the whole table that computes a TAG.
 */
function splitArgs(text) {
    const out = [];
    let depth = 0;
    let cur = '';
    let quote = null;
    for (const ch of text) {
        if (quote) {
            cur += ch;
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        if (ch === '(' || ch === '[') depth += 1;
        if (ch === ')' || ch === ']') depth -= 1;
        if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
        cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

/** Read from an open paren to its match, returning the inside. */
function balanced(text, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < text.length; i += 1) {
        if (text[i] === '(') depth += 1;
        else if (text[i] === ')') {
            depth -= 1;
            if (depth === 0) return { inner: text.slice(openIndex + 1, i), end: i };
        }
    }
    return null;
}

// ── stratum 1: Game.as's construction table ───────────────────────────
//
// ⚠ THE TABLE IS THE AUTHORITY ON SLOT ORDER AND THE CLASS IS NOT. That
// is the entire `BossLock` finding: reading `BossLock.as` alone tells you
// slot 3 is `_t` and reading `Game.as` alone tells you slot 3 is
// `keyType`. Only the two together say `_t` IS the key type.
const gameSrc = readFileSync(join(SRC, 'Game.as'), 'utf8');
const CALL_SITES = new Map();
{
    const re = /for each\s*\(\s*(?:var\s+)?o(?::\w+)?\s+in\s+xml\.objects\[0\]\.(\w+)\s*\)/g;
    let m;
    while ((m = re.exec(gameSrc))) {
        const ogmo = m[1];
        // The body may be a one-liner or a brace block; either way the
        // first `new X(` after the header is this tag's construction.
        const rest = gameSrc.slice(m.index, m.index + 900);
        const nextHeader = rest.indexOf('xml.objects[0].', m[0].length);
        const body = nextHeader > 0 ? rest.slice(0, nextHeader) : rest;
        // ⚠ THE ONE INSIDE `add(...)`, not the first one in the block. The
        // `rope` loop builds a `Point` from its node list before it builds
        // the `RopeStart` — so "first `new` after the header" reports the
        // rope's class as `Point`, which is a resolver artefact wearing a
        // finding's clothes. The entity is the one that gets ADDED.
        const nm = /add\s*\(\s*new\s+([A-Z]\w*)\s*\(/.exec(body)
            ?? /new\s+([A-Z]\w*)\s*\(/.exec(body);
        if (!nm) { CALL_SITES.set(ogmo, { ogmo, cls: null, args: [], why: 'no constructor' }); continue; }
        const open = body.indexOf('(', nm.index + nm[0].length - 1);
        const bal = balanced(body, open);
        CALL_SITES.set(ogmo, { ogmo, cls: nm[1], args: splitArgs(bal ? bal.inner : '') });
    }
}

// ── stratum 2: each class's ctor signature, super chain and body ──────
const CTORS = new Map();
function ctorOf(cls) {
    if (CTORS.has(cls)) return CTORS.get(cls);
    const path = files.get(cls);
    if (!path) { CTORS.set(cls, null); return null; }
    const text = readFileSync(path, 'utf8');
    const ext = /public\s+class\s+\w+\s+extends\s+(\w+)/.exec(text);
    const sig = new RegExp(`public\\s+function\\s+${cls}\\s*\\(`).exec(text);
    if (!sig) {
        const rec = { cls, path, parent: ext?.[1] ?? null, params: [], superArgs: null, body: '' };
        CTORS.set(cls, rec);
        return rec;
    }
    const open = text.indexOf('(', sig.index);
    const bal = balanced(text, open);
    const params = splitArgs(bal.inner).map((p) => {
        const [lhs, def] = p.split('=').map((s) => s.trim());
        const [name, type] = lhs.split(':').map((s) => s.trim());
        return { name, type: type ?? null, def: def ?? null };
    });
    // The ctor body: from the brace after the signature to its match.
    const braceStart = text.indexOf('{', bal.end);
    let depth = 0;
    let bodyEnd = braceStart;
    for (let i = braceStart; i < text.length; i += 1) {
        if (text[i] === '{') depth += 1;
        else if (text[i] === '}') { depth -= 1; if (depth === 0) { bodyEnd = i; break; } }
    }
    const body = text.slice(braceStart, bodyEnd);
    let superArgs = null;
    const sm = /super\s*\(/.exec(body);
    if (sm) {
        const sb = balanced(body, body.indexOf('(', sm.index));
        superArgs = splitArgs(sb.inner);
    }
    const rec = { cls, path, parent: ext?.[1] ?? null, params, superArgs, body };
    CTORS.set(cls, rec);
    return rec;
}

/** A resolved slot value: an atlas attribute, a literal, or an expression. */
const attr = (name) => ({ kind: 'attr', name });
const lit = (value) => ({ kind: 'lit', value });
const expr = (text) => ({ kind: 'expr', text });
const render = (v) => (v == null ? '—'
    : v.kind === 'attr' ? `@${v.name}`
        : v.kind === 'lit' ? String(v.value) : `⟨${v.text}⟩`);

/**
 * Reduce one argument expression under a binding of parameter name →
 * resolved value.
 *
 * ⚠ ONLY EXACT FORMS REDUCE. `_t` reduces to whatever `_t` is bound to;
 * `Game.bossLocks[_t]` does NOT, and reporting it as an `expr` carrying
 * its own text is the finding rather than a gap — that expression is a
 * GRAPHIC, and the whole `BossLock` defect is that it sits in the slot a
 * reader would expect the group in.
 */
function reduce(text, bind) {
    const t = text.trim();
    if (Object.prototype.hasOwnProperty.call(bind, t)) return bind[t];
    const am = /^o\.@(\w+)$/.exec(t);
    if (am) return attr(am[1]);
    if (/^-?\d+$/.test(t)) return lit(Number(t));
    if (t === 'true') return lit(true);
    if (t === 'false') return lit(false);
    if (t === 'null') return lit(null);
    // `Boolean(int(o.@flip))` and friends: a coercion around one attribute
    // is still that attribute for the purpose of "where does it come from".
    const coerce = /^(?:Boolean|int|String|Number|uint)\s*\(\s*(.*)\s*\)$/.exec(t);
    if (coerce) {
        const inner = reduce(coerce[1], bind);
        if (inner.kind === 'attr') return { ...inner, coerced: t.split('(')[0] };
        if (inner.kind === 'lit') return inner;
    }
    // ⛓ THE ABSENT-ATTRIBUTE IDIOM, WRITTEN OUT LONGHAND. `Game.as:2221`'s
    // teleporter passes `String(o.@tag) == "" ? -1 : o.@tag` — which is
    // exactly what `tagOf` means by "an absent `tag` attribute is -1",
    // spelled by the one call site that could not rely on `int("") == 0`
    // being the wrong answer. Reducing it to the attribute is not a
    // convenience: leaving it opaque would report the model's agreement
    // with the game as a disagreement.
    const absentIdiom = /^String\s*\(\s*o\.@(\w+)\s*\)\s*==\s*""\s*\?\s*(-?\d+)\s*:\s*o\.@\1$/
        .exec(t);
    if (absentIdiom) return { ...attr(absentIdiom[1]), absentDefault: Number(absentIdiom[2]) };
    return expr(t);
}

/**
 * Walk a class's ctor chain to `Activators`, carrying the bound arguments,
 * and report what reaches the GROUP slot and what reaches the `tag` field.
 *
 * The group slot is `Activators(_x, _y, _g:Graphic, _t:int)` — argument
 * FOUR, and `_g` sitting in front of it is exactly why an audit that
 * eyeballed `super(` calls for a `_t`-shaped third argument saw nothing.
 */
function resolveGroupAndTag(cls, callArgs) {
    const chain = [];
    let current = cls;
    let args = callArgs.map((a) => reduce(a, {}));
    let group = null;
    let tag = null;
    let guard = 0;
    while (current && guard++ < 12) {
        const rec = ctorOf(current);
        if (!rec) { chain.push({ cls: current, missing: true }); break; }
        const bind = {};
        rec.params.forEach((p, i) => {
            bind[p.name] = args[i] !== undefined ? args[i]
                : (p.def != null ? reduce(p.def, {}) : expr(`«no arg, no default: ${p.name}»`));
        });
        chain.push({ cls: current, params: rec.params, bind, path: rec.path });

        // The `tag` field: the FIRST class in the chain that assigns one
        // owns it. `Lock` writes `tag = _tag`; `MoonrockPile` writes
        // `tag = 0` and throws away the argument it was handed.
        if (tag === null) {
            const tm = /(?:^|[^.\w])tag\s*=\s*([^;]+);/.exec(rec.body);
            if (tm) tag = reduce(tm[1], bind);
        }
        if (current === 'Activators') {
            // `Activators(_x, _y, _g, _t)` — slot 4 is the group.
            group = bind._t ?? null;
            break;
        }
        if (!rec.superArgs) break;
        args = rec.superArgs.map((a) => reduce(a, bind));
        current = rec.parent;
    }
    return { chain, group, tag };
}

// ── stratum 3: what the model believes ────────────────────────────────
//
// Mirrors `tSetOf` / `tagOf` SYMBOLICALLY rather than calling them: the
// question is not "what number comes out for this instance" but "which
// atlas attribute does the model think feeds this slot", and only a
// symbolic answer can be compared against a constructor.
const modelGroup = (ogmo) => (FORCED_TSET[ogmo] !== undefined
    ? lit(FORCED_TSET[ogmo]) : attr('tset'));
const modelTag = (ogmo) => (FORCED_TAG[ogmo] !== undefined
    ? lit(FORCED_TAG[ogmo]) : attr('tag'));

const same = (a, b) => {
    if (!a || !b) return a === b;
    if (a.kind !== b.kind) return false;
    if (a.kind === 'attr') return a.name === b.name;
    if (a.kind === 'lit') return a.value === b.value;
    return a.text === b.text;
};

// ── the sweep ─────────────────────────────────────────────────────────
console.log('## the construction table');
console.log(`   ${CALL_SITES.size} ogmo tag(s) constructed in Game.as`);
console.log(`   ${files.size} AS3 class file(s) indexed\n`);

const rows = [];
const findings = [];
const finding = (ok, name, detail) => { findings.push({ ok, name, detail }); };

/**
 * ⛔ EVERY CENSUS CLASS, NOT EVERY CLASS. The bound is the model's own
 * table: an `ENTITY_CLASSES` entry with a non-null `as3` is something a
 * route can meet, and that is the family being retired. Classes the game
 * has and the census does not are named at the end as the sweep's own
 * boundary — [[feedback_bounded_sweep_must_name_what_it_bounded]].
 */
const censusTypes = Object.entries(ENTITY_CLASSES)
    .filter(([, spec]) => spec.as3)
    .map(([ogmo, spec]) => ({ ogmo, spec }));

for (const { ogmo, spec } of censusTypes) {
    const site = CALL_SITES.get(ogmo);
    if (!site) {
        rows.push({ ogmo, cls: spec.as3, unclassified: 'no construction site in Game.as' });
        continue;
    }
    if (site.cls !== spec.as3) {
        rows.push({ ogmo, cls: site.cls, mismatchClass: spec.as3 });
        continue;
    }
    const { chain, group, tag } = resolveGroupAndTag(site.cls, site.args);
    rows.push({
        ogmo,
        cls: site.cls,
        args: site.args,
        slots: chain[0]?.params?.map((p, i) => ({
            param: p.name, type: p.type, def: p.def,
            value: chain[0].bind[p.name], passed: site.args[i] ?? null,
        })) ?? [],
        chain: chain.map((c) => c.cls),
        group,
        tag,
        reachesActivators: chain[chain.length - 1]?.cls === 'Activators',
    });
}

// ── ⛔ FAILURE 1: a census class the construction table does not build ──
const unclassified = rows.filter((r) => r.unclassified || r.mismatchClass);
finding(unclassified.length === 0,
    '⛓ every census class is built by a construction site this probe resolved',
    unclassified.length === 0
        ? `${rows.length} type(s), each traced from \`Game.as\` through its ctor chain`
        : unclassified.map((r) => `${r.ogmo}: ${r.unclassified
            ?? `Game.as builds a ${r.cls}, ENTITY_CLASSES says ${r.mismatchClass}`}`).join('; '));

// ── ⛔⛔ FAILURE 2: the group slot ──────────────────────────────────────
//
// The `BossLock` shape, generalised. For every type that reaches
// `Activators`, what the constructor puts in the group slot must be what
// `tSetOf` reads out of it.
const groupRows = rows.filter((r) => r.reachesActivators);
const groupBad = [];
for (const r of groupRows) {
    const want = modelGroup(r.ogmo);
    if (!same(r.group, want)) groupBad.push({ r, want });
}
finding(groupBad.length === 0,
    '⛓⛓ THE GROUP SLOT — what the ctor chain puts in `Activators._t` is what `tSetOf` reads',
    groupBad.length === 0
        ? `${groupRows.length} activator type(s) checked through the FOURTH argument of `
            + '`Activators(_x, _y, _g:Graphic, _t:int)` — the slot a `_t`-shaped grep '
            + 'over `super(` calls looks straight past, because `_g` is in front of it'
        : groupBad.map(({ r, want }) => `${r.ogmo}: the ctor gives ${render(r.group)}, `
            + `\`tSetOf\` reads ${render(want)}`).join('; '));

// ── ⛔ FAILURE 3: the tag slot ─────────────────────────────────────────
const tagRows = rows.filter((r) => r.tag != null);
const tagBad = [];
for (const r of tagRows) {
    const want = modelTag(r.ogmo);
    // A ctor DEFAULT of -1 and the model's "absent attribute means -1" are
    // the same answer by two routes, which is what §20.4 found the hard
    // way. They agree, and the agreement is worth asserting rather than
    // assuming: `attr('tag')` with a -1 default IS `tagOf`.
    if (r.tag.kind === 'attr' && want.kind === 'attr' && r.tag.name === want.name) continue;
    if (!same(r.tag, want)) tagBad.push({ r, want });
}
finding(tagBad.length === 0,
    '⛓ THE TAG SLOT — what the ctor body assigns to `tag` is what `tagOf` reads',
    tagBad.length === 0
        ? `${tagRows.length} type(s) with a \`tag\` field, each traced to the ctor body `
            + 'assignment that writes it (a forced literal beats the argument, which is '
            + 'the `MoonrockPile` shape)'
        : tagBad.map(({ r, want }) => `${r.ogmo}: the ctor assigns ${render(r.tag)}, `
            + `\`tagOf\` reads ${render(want)}`).join('; '));

// ── ⛔ FAILURE 4: an unreduced expression in a slot the model reads ────
const opaque = rows.filter((r) => (r.group?.kind === 'expr') || (r.tag?.kind === 'expr'));
finding(opaque.length === 0,
    '⛓ no census type feeds an UNREDUCED expression into a slot the model reads',
    opaque.length === 0
        ? 'every group and tag resolves to an atlas attribute or a literal — an `expr` '
            + 'here would mean the model is reading a number the constructor computes'
        : opaque.map((r) => `${r.ogmo}: group=${render(r.group)} tag=${render(r.tag)}`).join('; '));

// ── ⛓ THE LITERALS, ENUMERATED ────────────────────────────────────────
//
// The point of the whole exercise: every hardcoded value the constructor
// chain parks in a slot the map data appears to control, in one list.
console.log('## the literals parked in a model-read slot');
const literals = rows.filter((r) => r.group?.kind === 'lit' || r.tag?.kind === 'lit');
for (const r of literals) {
    const parts = [];
    if (r.group?.kind === 'lit') parts.push(`group = ${r.group.value}`);
    if (r.tag?.kind === 'lit') parts.push(`tag = ${r.tag.value}`);
    const declared = (r.group?.kind === 'lit' && FORCED_TSET[r.ogmo] !== undefined)
        || (r.tag?.kind === 'lit' && FORCED_TAG[r.ogmo] !== undefined);
    console.log(`   ${declared ? '✓' : '⛔'} ${r.ogmo.padEnd(18)} ${r.cls.padEnd(18)} `
        + `${parts.join(', ')}${declared ? '' : '   ⛔ NOT DECLARED IN THE MODEL'}`);
}
if (literals.length === 0) console.log('   (none)');

// ── ⛓ THE ARGUMENT TABLE ──────────────────────────────────────────────
console.log('\n## the argument table'
    + (ALL ? '' : ' (activators only — pass --all for every census type)'));
for (const r of rows) {
    if (r.unclassified || r.mismatchClass) continue;
    if (!ALL && !r.reachesActivators) continue;
    console.log(`   ${r.ogmo} -> new ${r.cls}(${r.args.join(', ')})`);
    console.log(`      chain: ${r.chain.join(' -> ')}`);
    for (const s of r.slots) {
        console.log(`      ${String(s.param).padEnd(10)} ${String(s.type ?? '').padEnd(10)} `
            + `${s.passed === null ? `(default ${s.def})` : s.passed}`.padEnd(34)
            + ` => ${render(s.value)}`);
    }
    if (r.reachesActivators) {
        console.log(`      GROUP => ${render(r.group)}   TAG => ${render(r.tag)}`);
    }
}

// ── ⚠ WHAT THIS SWEEP DID NOT COVER, named ────────────────────────────
const censusNames = new Set(censusTypes.map((c) => c.ogmo));
const outside = [...CALL_SITES.keys()].filter((n) => !censusNames.has(n));
console.log(`\n## the boundary`);
console.log(`   ${outside.length} ogmo tag(s) the game constructs and the census does NOT`);
console.log(`   carry an ENTITY_CLASSES entry for: ${outside.join(' ')}`);
console.log('   ⚠ Not a gap — a census type is what a route can meet, and the census');
console.log('   test already forces every tag in a committed extract to be classified.');
console.log('   Named so the bound is a statement rather than an omission.');

console.log('\n## the claims');
let bad = 0;
for (const f of findings) {
    console.log(`   ${f.ok ? '✓' : '✗'} ${f.name}`);
    if (f.detail) console.log(`      ${f.detail}`);
    if (!f.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${findings.length} claims FAILED`);
console.log(`\n   ${findings.length}/${findings.length} claims hold.`);
