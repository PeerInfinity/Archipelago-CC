#!/usr/bin/env node
/**
 * probe-seedling-r1-suit-census — ⛓⛓ R1-swim D1: J0(a)'s twelve dark-suit
 * levels, re-driven on the MODEL.
 *
 * `archipelago-cc-5d`'s J0(a) census booted every level at its arrival with a
 * full kit and found `playerHit`'s dark-suit refusal on twelve of them (L6@938,
 * L8@974, L14@119, L16@6, L17@42, L18@104, L25@506, L26@802, L36@780, L91@278,
 * L93@798, L98@107). Its file is not in the repo, so this re-derives the shape:
 *
 *   - the ARRIVAL is the first entity, in level order, that carries `to` +
 *     `playerx`/`playery` naming the level (a teleporter or a stair);
 *   - the KIT is every item flag LESS the ghost sword, whose press is refused
 *     by name at R5 and would end every level at its first press;
 *   - 600 idle ticks, then 400 seeded random-key ticks (a direction or none,
 *     the primary on 15%; `mulberry32(1000 + level)`);
 *   - a pit or drown death reboots at the arrival (`jsRuntimeCore`'s rule);
 *     any other throw is the level's refusal, reported by its first line.
 *
 * ⚠ AN UPPER BOUND ON EXPOSURE, LIKE J0(a)'s, AND NOT ITS TICKS: a different
 * kit and a different key stream meet different contacts, so a level the
 * census refused may not take a contact here at all.
 *
 * Run:
 *   node scripts/procgen/probe-seedling-r1-suit-census.mjs [--levels=6,8,…] [--json]
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const M = join(HERE, '..', '..', 'frontend', 'modules', 'seedlingDemo');
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const JSON_OUT = process.argv.includes('--json');

const { createManualSession } = await import(join(M, 'watchManual.js'));
const { bootStaging } = await import(join(M, 'procgenOracle.js'));
const { atlasLevelSource } = await import(join(M, 'levelSource.js'));
const { ITEM_PROPERTIES } = await import(join(M, 'tapeFormat.js'));
const { isDeathRefusal, JS_RUNTIME_PINS } = await import(join(M, 'jsRuntimeCore.js'));

const levelSource = atlasLevelSource();
const LEVELS = (arg('levels') ?? '6,8,14,16,17,18,25,26,36,91,93,98').split(',').map(Number);
const IDLE = 600;
const RANDOM = 400;
const KIT = Object.fromEntries(Object.values(ITEM_PROPERTIES)
    .map((s) => [s.property, s.kind === 'add' ? s.base : s.property !== 'hasGhostSword']));

const arrivals = new Map();
for (let l = 0; l < 200; l++) {
    let r;
    try { r = levelSource(l); } catch { continue; }
    for (const e of r?.entities ?? []) {
        if (e.attrs?.to === undefined || e.attrs?.playerx === undefined) continue;
        const to = Number(e.attrs.to);
        if (!arrivals.has(to)) {
            arrivals.set(to, { x: Number(e.attrs.playerx), y: Number(e.attrs.playery), from: `${l}:${e.type}` });
        }
    }
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const DIRS = [[], ['up'], ['down'], ['left'], ['right'],
    ['up', 'left'], ['up', 'right'], ['down', 'left'], ['down', 'right']];

const rows = [];
for (const level of LEVELS) {
    const at = arrivals.get(level);
    if (!at) {
        rows.push({ level, refusal: 'no arrival entity names this level' });
        continue;
    }
    const boot = { level, x: at.x, y: at.y };
    const session = () => createManualSession({
        levelSource,
        staging: bootStaging({ boot, items: { ...KIT }, pins: [...JS_RUNTIME_PINS] }),
        name: 'r1-suit-census',
        scratchPersistence: true,
    });
    let s = session();
    const rnd = mulberry32(1000 + level);
    let deaths = 0;
    let refusal = null;
    let retaliations = 0;
    let t = 0;
    for (; t < IDLE + RANDOM; t++) {
        let held = new Set();
        if (t >= IDLE) {
            held = new Set(DIRS[Math.floor(rnd() * DIRS.length)]);
            if (rnd() < 0.15) held.add('primary');
        }
        const before = s.run.playerHits.length;
        try {
            s.step(held);
        } catch (e) {
            if (isDeathRefusal(e)) {
                deaths++;
                s = session();
                continue;
            }
            refusal = { t: t + 1, text: e.message.split('\n')[0] };
            break;
        }
        retaliations += s.run.playerHits.slice(before).filter((h) => h.retaliation).length;
    }
    rows.push({ level, boot, from: at.from, ticks: refusal ? refusal.t : t, deaths, retaliations, refusal });
}

if (JSON_OUT) {
    console.log(JSON.stringify(rows, null, 1));
} else {
    for (const r of rows) {
        console.log(`L${r.level} from ${r.from ?? '-'}: ${r.refusal ? `REFUSED t${r.refusal.t ?? '-'}` : `ran ${r.ticks}`}`
            + ` · ${r.retaliations ?? 0} retaliation(s) · ${r.deaths ?? 0} death(s)`
            + `${r.refusal ? ` — ${(r.refusal.text ?? r.refusal).slice(0, 160)}` : ''}`);
    }
    const refused = rows.filter((r) => r.refusal).length;
    console.log(`\n${rows.length - refused}/${rows.length} ran ${IDLE + RANDOM} ticks; ${refused} refused`);
}
