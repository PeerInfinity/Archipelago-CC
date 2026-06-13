#!/usr/bin/env node
/**
 * Settings audit (Option B) — reconcile the three real sources of frontend
 * settings and surface the gaps between them:
 *
 *   1. SCHEMA   — centralRegistry.settingsSchemas (dumped from the running
 *                 app; this is what the options panel renders controls from).
 *   2. SETTINGS — frontend/settings/settings.json (the de-facto persisted
 *                 defaults / reset-to-defaults baseline).
 *   3. CODE     — getSetting('<key>', <default>) call sites across the
 *                 frontend (what the app actually reads, + its fallback).
 *
 * Why all three: settingsManager does NOT consult the schema for defaults
 * (it's a UI descriptor only), and the schema can only express
 * moduleSettings.<module>.<prop> keys — top-level settings (generalSettings.*,
 * colorblindMode, logging, …) live only in settings.json + code. So a one-way
 * schema dump would be incomplete and misleading; this reconciles all three.
 *
 * Usage:
 *   node scripts/audit-settings.mjs                  # print report
 *   node scripts/audit-settings.mjs --write-defaults # also write the
 *                                                    # schema-derived defaults
 *   AUDIT_URL=http://localhost:8000/frontend/index.html node scripts/audit-settings.mjs
 *
 * Requires the dev server running (default http://localhost:8000) + Playwright.
 */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRONTEND = join(ROOT, 'frontend');
const SETTINGS_JSON = join(FRONTEND, 'settings', 'settings.json');
const URL = process.env.AUDIT_URL || 'http://localhost:8000/frontend/index.html';
const WRITE_DEFAULTS = process.argv.includes('--write-defaults');
const DEFAULTS_OUT = join(ROOT, 'scripts', 'output', 'settings-audit', 'defaultSettings.generated.json');

// ── 1. Dump centralRegistry.settingsSchemas from the running app ──────────
async function dumpSchemas() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ locale: 'en-US' });
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const raw = await page.evaluate(() => {
      const m = window.centralRegistry && window.centralRegistry.settingsSchemas;
      if (!m || typeof m.entries !== 'function') return null;
      const out = {};
      for (const [k, v] of m.entries()) out[k] = v;
      return out;
    });
    if (!raw) throw new Error('window.centralRegistry.settingsSchemas not available');
    return raw;
  } finally {
    await browser.close();
  }
}

// ── 2. Normalize heterogeneous schema snippets → {keys, malformed} ────────
// Observed shapes in the registry:
//   - string === moduleId         → MALFORMED: module called
//                                    registerSettingsSchema(moduleId, schema)
//                                    but the API takes one arg, so the real
//                                    schema was dropped and only the id landed.
//   - { type:'object', properties } → standard.
//   - { <moduleId>: {type, properties} } → double-wrapped under the module name.
//   - { prop: {type,...}, ... }     → flat properties object (no type/properties).
function normalizeSchemas(raw) {
  const keys = new Map(); // 'moduleSettings.<mod>.<prop>' -> { default }
  const malformed = [];   // { moduleId, reason }

  for (const [moduleId, snippet] of Object.entries(raw)) {
    if (typeof snippet === 'string') {
      malformed.push({
        moduleId,
        reason: `registered the string "${snippet}" instead of a schema `
          + '(called registerSettingsSchema(moduleId, schema); the API takes '
          + 'one arg, so the schema was dropped)',
      });
      continue;
    }
    if (!snippet || typeof snippet !== 'object') {
      malformed.push({ moduleId, reason: `non-object schema (${typeof snippet})` });
      continue;
    }

    // Unwrap double-wrapped { <moduleId>: {...} }.
    let node = snippet;
    let note = '';
    if (!node.properties && !node.type && node[moduleId] && typeof node[moduleId] === 'object') {
      node = node[moduleId];
      note = 'double-wrapped under module name';
    }

    let props = null;
    if (node.properties && typeof node.properties === 'object') {
      props = node.properties;
    } else if (!node.type) {
      // Flat properties object: keys whose values look like property specs.
      const entries = Object.entries(node).filter(
        ([, v]) => v && typeof v === 'object' && ('type' in v || 'default' in v));
      if (entries.length) props = Object.fromEntries(entries);
    }

    if (!props || Object.keys(props).length === 0) {
      malformed.push({ moduleId, reason: `no usable properties${note ? ` (${note})` : ''}` });
      continue;
    }
    if (note) malformed.push({ moduleId, reason: note + ' (parsed anyway)' });

    for (const [prop, spec] of Object.entries(props)) {
      keys.set(`moduleSettings.${moduleId}.${prop}`,
        { default: spec && typeof spec === 'object' ? spec.default : undefined });
    }
  }
  return { keys, malformed };
}

// ── 3. Read + flatten settings.json to leaf dotted keys ───────────────────
function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    if (k === '//' || k.startsWith('//')) continue; // comment keys
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
}

// ── 4. Scan getSetting('<key>', <default>) call sites ─────────────────────
function listJsFiles(dir, acc) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'build' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) listJsFiles(full, acc);
    else if (name.endsWith('.js') && !name.endsWith('.test.js')) acc.push(full);
  }
  return acc;
}

// Top-level settings.json namespaces — a getSetting key starting with one of
// these is already a full dotted key. Anything else is a BARE module-scoped key
// (read via DisplaySettingsManager, which prefixes moduleSettings.<module>.),
// so resolve it to moduleSettings.<inferred-module>.<key> using the file path.
const TOP_LEVEL = new Set(['moduleSettings', 'generalSettings', 'logging',
  'colorblindMode', 'activeLayout', 'customLayoutConfig', 'playerId', 'playerName']);

function resolveKey(rawKey, relFile) {
  if (TOP_LEVEL.has(rawKey.split('.')[0])) return rawKey;
  const m = relFile.match(/^modules\/([^/]+)\//);
  return m ? `moduleSettings.${m[1]}.${rawKey}` : rawKey; // unresolved bare key kept as-is
}

function scanGetSetting() {
  const files = listJsFiles(join(FRONTEND, 'modules'), []);
  listJsFiles(join(FRONTEND, 'app'), files);
  // getSetting('key' | "key" | `key`  [, default])
  const re = /getSetting\(\s*(['"`])([^'"`]+)\1\s*(?:,\s*([^)]*))?\)/g;
  const found = new Map(); // resolvedKey -> { raw, default, hasDefault, bare, files:Set }
  for (const file of files) {
    const rel = file.slice(FRONTEND.length + 1);
    const src = readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(src)) !== null) {
      const raw = m[2];
      const key = resolveKey(raw, rel);
      const defRaw = (m[3] || '').trim();
      const entry = found.get(key)
        || { raw, default: undefined, hasDefault: false, bare: key !== raw, files: new Set() };
      entry.files.add(rel);
      if (defRaw) { entry.hasDefault = true; entry.default = defRaw; }
      found.set(key, entry);
    }
  }
  return found;
}

// ── 5. Reconcile + report ─────────────────────────────────────────────────
function section(title) { console.log(`\n${'─'.repeat(70)}\n${title}\n${'─'.repeat(70)}`); }

// Best-effort parse of a getSetting() 2nd-arg default's RAW source text into a
// JS value, so it can be compared to the schema default. Returns {ok:false}
// for non-literal expressions/variables (which can't be compared statically).
function parseLiteralDefault(text) {
  const t = (text || '').trim();
  if (t === 'true') return { ok: true, value: true };
  if (t === 'false') return { ok: true, value: false };
  if (t === 'null') return { ok: true, value: null };
  if (/^-?\d+(\.\d+)?$/.test(t)) return { ok: true, value: Number(t) };
  const q = t.match(/^(['"`])([\s\S]*)\1$/);
  if (q) return { ok: true, value: q[2] };
  if (t === '[]') return { ok: true, value: [] };
  if (t === '{}') return { ok: true, value: {} };
  return { ok: false };
}

(async () => {
  console.log('Settings audit — schema (live) vs settings.json vs getSetting() call sites');
  console.log(`URL: ${URL}`);

  let raw;
  try {
    raw = await dumpSchemas();
  } catch (e) {
    console.error(`\nERROR dumping schemas: ${e.message}`);
    console.error('Is the dev server running? (python -m http.server 8000)');
    process.exit(1);
  }

  const { keys: schemaKeys, malformed } = normalizeSchemas(raw);
  const settingsObj = JSON.parse(readFileSync(SETTINGS_JSON, 'utf8'));
  const jsonKeys = flatten(settingsObj, '', new Map());
  const codeKeys = scanGetSetting();

  const inJson = (k) => jsonKeys.has(k);
  const inSchema = (k) => schemaKeys.has(k);
  // A settings.json key is "covered" by a getSetting if some read key equals it
  // OR is a prefix of it (objects read whole, e.g. getSetting('logging')).
  const readByCode = (k) => {
    if (codeKeys.has(k)) return true;
    for (const ck of codeKeys.keys()) if (k === ck || k.startsWith(ck + '.') || ck.startsWith(k + '.')) return true;
    return false;
  };

  section('A. Malformed / unusable schema registrations');
  if (!malformed.length) console.log('  (none)');
  for (const m of malformed) console.log(`  ⚠ ${m.moduleId}: ${m.reason}`);

  // The schema is the source of truth for moduleSettings.* defaults
  // (settingsManager.getSetting resolves them; settings.json should no longer
  // carry them — schema-as-default-source Phase 2). So the gates here are:
  //   B = no DRIFT between schema and any moduleSettings default still in
  //       settings.json (catches latent drift before/while stripping, and
  //       re-introduced drift afterward).
  //   C = no moduleSettings default leaves left in settings.json at all
  //       (they belong in the schema).
  section('B. moduleSettings DRIFT (schema default ≠ settings.json value)');
  const bDrift = [...schemaKeys.keys()]
    .filter((k) => inJson(k))
    .filter((k) => JSON.stringify(schemaKeys.get(k).default) !== JSON.stringify(jsonKeys.get(k)))
    .sort();
  if (!bDrift.length) console.log('  (none)');
  for (const k of bDrift) {
    console.log(`  ${k}   schema: ${JSON.stringify(schemaKeys.get(k).default)}   settings.json: ${JSON.stringify(jsonKeys.get(k))}`);
  }

  section('C. moduleSettings default leaves still in settings.json (should be empty after Phase 2)');
  const cLeft = [...jsonKeys.keys()]
    .filter((k) => k.startsWith('moduleSettings.') && k.split('.').length >= 3)
    .sort();
  if (!cLeft.length) console.log('  (none)');
  for (const k of [...new Set(cLeft)]) {
    const p = k.split('.');
    const base = `moduleSettings.${p[1]}.${p[2]}`;
    console.log(`  ${k}${inSchema(base) ? '' : '   (no schema entry!)'}`);
  }

  // Keys built from template literals (e.g. `...${key}`) can't be resolved
  // statically — report them separately rather than as bogus "invisible" keys.
  const dynamicKeys = [...codeKeys.keys()].filter((k) => k.includes('${')).sort();

  section('D. getSetting() keys absent from BOTH schema and settings.json (invisible; call-site default only)');
  const dMiss = [...codeKeys.keys()]
    .filter((k) => !k.includes('${') && !inSchema(k) && !inJson(k))
    // ignore keys that are prefixes/children of a json key (whole-object reads)
    .filter((k) => ![...jsonKeys.keys()].some((jk) => jk === k || jk.startsWith(k + '.') || k.startsWith(jk + '.')))
    .sort();
  if (!dMiss.length) console.log('  (none)');
  for (const k of dMiss) {
    const e = codeKeys.get(k);
    console.log(`  ${k}   (default in code: ${e.hasDefault ? e.default : 'NONE'}; ${[...e.files][0]}${e.files.size > 1 ? ` +${e.files.size - 1}` : ''})`);
  }
  if (dynamicKeys.length) {
    console.log(`\n  Dynamic keys (template literals, not statically resolvable — audit manually):`);
    for (const k of dynamicKeys) console.log(`    ${k}   (${[...codeKeys.get(k).files][0]})`);
  }

  // The logging.* subtree is consumed by the logger init directly, not via
  // getSetting — exclude it from the orphan scan (it would flood the report).
  section('E. settings.json keys NOT read by any getSetting() (orphan candidates — best-effort)');
  console.log('  (excludes the logging.* subtree — consumed by the logger, not getSetting.');
  console.log('   NOTE: the scan only sees STRING-LITERAL keys; calls like');
  console.log('   getSetting(RENDERER_SETTING_KEY, …) use a variable and are missed, so');
  console.log('   some entries here are read via a const key — verify before deleting.)\n');
  const eMiss = [...jsonKeys.keys()]
    .filter((k) => k.split('.')[0] !== 'logging')
    .filter((k) => !readByCode(k))
    .sort();
  if (!eMiss.length) console.log('  (none)');
  for (const k of eMiss) console.log(`  ${k} = ${JSON.stringify(jsonKeys.get(k))}`);

  // The schema is the source of truth for defaults; a call-site default that
  // DISAGREES with the schema is dead + misleading (the schema default wins
  // for absent keys). Surface it without removing the fallback (it still
  // guards the no-schema / stubbed-settingsManager path). Literal defaults
  // only — variable/expression defaults are skipped.
  section('F. Call-site default ≠ schema default (dead/misleading; schema wins)');
  const fDrift = [];
  for (const [k, e] of codeKeys) {
    if (!e.hasDefault || !inSchema(k)) continue;
    const lit = parseLiteralDefault(e.default);
    if (!lit.ok) continue;
    const schemaDef = schemaKeys.get(k).default;
    if (JSON.stringify(lit.value) !== JSON.stringify(schemaDef)) {
      fDrift.push({ k, code: e.default.trim(), schema: schemaDef, file: [...e.files][0] });
    }
  }
  if (!fDrift.length) console.log('  (none)');
  for (const f of fDrift) {
    console.log(`  ${f.k}   call-site: ${f.code}   schema: ${JSON.stringify(f.schema)}   (${f.file})`);
  }

  section('Summary');
  console.log(`  schema keys (well-formed): ${schemaKeys.size}`);
  console.log(`  settings.json leaf keys:   ${jsonKeys.size}`);
  console.log(`  getSetting() keys in code: ${codeKeys.size}`);
  console.log(`  malformed schema modules:  ${malformed.filter((m) => !m.reason.includes('parsed anyway')).length}`);
  console.log(`  B (moduleSettings drift):  ${bDrift.length}`);
  console.log(`  C (moduleSettings in json):${[...new Set(cLeft)].length}`);
  console.log(`  D (invisible):             ${dMiss.length}`);
  console.log(`  E (orphan candidates):     ${eMiss.length}`);
  console.log(`  F (call-site ≠ schema):    ${fDrift.length}`);

  if (WRITE_DEFAULTS) {
    const defaults = {};
    for (const [k, v] of schemaKeys.entries()) {
      const [, mod, prop] = k.split('.');
      (defaults.moduleSettings ??= {})[mod] ??= {};
      defaults.moduleSettings[mod][prop] = v.default;
    }
    mkdirSync(dirname(DEFAULTS_OUT), { recursive: true });
    writeFileSync(DEFAULTS_OUT, JSON.stringify(defaults, null, 2) + '\n');
    console.log(`\nWrote schema-derived moduleSettings defaults → ${DEFAULTS_OUT.slice(ROOT.length + 1)}`);
  }
})();
