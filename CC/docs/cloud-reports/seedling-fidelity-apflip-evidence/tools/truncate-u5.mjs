#!/usr/bin/env node
// APFLIP D3/D6 — `swim-u5-bobboss-encounter` has no producer (it was the survey's step-30 solve). Under R4 (p4g) the
// Fire's collect grants nothing, so its t840 equip finds one slot and the burn cannot happen: the tape is cut at the
// collect (inputs before t840 kept byte for byte), its equip dropped, and 30 idle ticks appended. Run once, committed.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const P = join(REPO, 'frontend/modules/seedlingDemo/fixtures/tapes/swim-u5-bobboss-encounter.json');
const t = JSON.parse(readFileSync(P, 'utf8'));
const CUT = 840; const IDLE = 30;
if (t.tick_count === CUT + IDLE) { console.log('already cut'); process.exit(0); }
t.inputs = t.inputs.filter((i) => i.from < CUT).map((i) => ({ ...i, to: Math.min(i.to, CUT) }));
t.equips = [];
t.tick_count = CUT + IDLE;
t.description += ' ⛓ fidelity APFLIP (R4, the p4g wasm @ccdf189776): the Fire\'s collect REPORTS {32,4} and grants '
    + 'nothing (the host does), so the t840 equip and the burn are gone: the tape is cut at t840 (every input before '
    + `it unchanged) and ends ${IDLE} idle ticks later in the arena.`;
writeFileSync(P, `${JSON.stringify(t, null, 4)}\n`);
console.log('cut', P);
