#!/usr/bin/env node
/**
 * build-inventory — MEASURE ONLY (slice rules-model-coverage-inventory, 2026-10-05).
 *
 * The entity-class inventory: every OEL tag the game's own factory
 * (`Game.loadLevelXML`) constructs, plus every AS3 entity class under
 * `vendor/seedling/src` (placed or runtime-spawned), joined to:
 *   - placements/rooms in the committed atlas (`seedling-map.json`);
 *   - the model's per-class tables (ENTITY_CLASSES, KILL_ARM_POLICY,
 *     MODELLED_ENEMY_CLASSES, OUT_OF_BAND_WRITER_CLASSES, damage sites, NPC talk,
 *     ADDED_TIME_REMOVAL, CLEAR_EXCLUDED) and the persistence probe (M1);
 *   - the model text: non-test files under seedlingDemo/ naming the class, and the
 *     refusal lines (`fail(`/`throw`/`refus`/`UNMODELLED`/`not model`) naming it;
 *   - the rules side (`seedlingSemantics.ENTITY_SEMANTICS`, the playthrough overlay);
 *   - route impact (the survey's step rooms, the seed-1 sphere-order rooms).
 * A tag is matched to its class by the FACTORY line, never by name.
 *
 *   node scripts/procgen/model-coverage/build-inventory.mjs --survey=<survey.json> \
 *        --persistence=<probe-persistence.json> --rooms=<probe-rooms.json> --i1=<i1.json> --out=<coverage-classes.json>
 */
import { dirname, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const MOD = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const FP = join(REPO, 'frontend', 'modules', 'flashPanel');
const SRC = join(REPO, 'vendor', 'seedling', 'src');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=');
const readJson = (p) => (p && existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

const { ENTITY_CLASSES } = await import(join(MOD, 'levelWorld.js'));
const LW = await import(join(MOD, 'levelWorld.js'));
const { KILL_ARM_POLICY } = await import(join(MOD, 'enemyDamage.js'));
const { MODELLED_ENEMY_CLASSES } = await import(join(MOD, 'spinner.js'));
const { contactPricing } = await import(join(MOD, 'combat.js'));
const { NEVER_ENTER_LEVELS } = await import(join(FP, 'seedlingPlaythroughOverlay.js'));

/**
 * The classes no `.oel` places (or whose tag no room uses): spawned at runtime
 * by another entity, or a base class. They have no tag to key a model table
 * by, so each is graded BY HAND from the model site that owns it, with the
 * citation. `gameplay: false` = no state any route reads (cosmetic/UI).
 */
const RUNTIME_GRADES = {
    Player: ['transcribed', 'playerPhysicsV2.js + levelRun.js (the whole model is the player)'],
    Arrow: ['partial', 'arrowTrap.js steps it; Arrow x Enemy refused by name (tapeFormat.js:649 "§16.4 refuses it by name"; levelRun.js:9525)'],
    BobBoss: ['transcribed', 'bobBoss.js + bobBossFight.js (L32, stepped; r5-bobboss-* tapes); KILL_ARM_POLICY generic arm refused, the fight owns it'],
    BobBossNPC: ['transcribed', 'bobBossFight.js "the dialogue\'s open-and-page rule"; coincidence refusal levelRun.js:12298'],
    Fire: ['transcribed', 'bobBoss.js "the Fire" (BobBoss.death spawn); the placed `fire` tag is in no room'],
    Bomb: ['absent', 'combat.js:421 prices it only as BombPusher threat prose; BombPusher is a `mover` (unstepped), so no Bomb body is ever spawned'],
    BossTotemShot: ['transcribed', 'bossTotemFight.js:398 "Projectiles/BossTotemShot.as, transcribed"'],
    CliffSide: ['transcribed', 'levelWorld.js / levelRun.js cliffside tiles (r5-feather)'],
    Coin: ['n/a', 'no flag and no counter (r7Acceptance.js:1424); gameplay: false'],
    DarkSword: ['partial', 'Witch.doneTalking spawn; out-of-band {11,29} landing refused at build (levelWorld.js OUT_OF_BAND docblock; levelRun.js:5395)'],
    Explosion: ['transcribed', 'levelRun.js:2317 applyExplosion (Bomb/LavaBall/BossTotemShot/Enemy death sources)'],
    Grass: ['partial', 'cut state = Main.grassCut, the `grass_cut` seam field SEAM_BOOT_SPEC marks modelled:false; no route reads it'],
    Help: ['transcribed', 'dialogue.js / sealCeremony.js help frames (r8-solve-10 help-frame oracle)'],
    IceTurretBlast: ['transcribed', 'iceTurretBlast.js'],
    LavaBall: ['refused', 'presses.js:908 `LavaBall: { policy: "refused", why: "R5 — Dungeon 7" }`'],
    Light: ['partial', 'lighting entity; gameplay only as DarkTrap\'s killer (entityBlocks.js:145) — not stepped'],
    Message: ['n/a', 'UI; gameplay: false'],
    RockFall: ['transcribed', 'finalBossFight.js + finalBossRng.js (the Owl\'s rocks)'],
    RopeStart: ['transcribed', 'activators.js:435 + presses.js:1044 "RopeStart ⛓ MODELLED"'],
    SealController: ['transcribed', 'sealCeremony.js; coincidence refusal levelRun.js:15836'],
    SealPiece: ['transcribed', 'sealCeremony.js / chest.js; refusal of a second concurrent piece levelRun.js:6233'],
    SlashHit: ['transcribed', 'combatVerbs.js'],
    Tile: ['transcribed', 'levelWorld.js tile layer'],
    TurretSpit: ['transcribed', 'turret.js:2 "Turret + TurretSpit, TRANSCRIBED"'],
    WandShot: ['transcribed', 'wandShot.js'],
    Droplet: ['n/a', 'rain particle; gameplay: false'],
    DustParticle: ['n/a', 'particle; gameplay: false'],
    PlayerLight: ['n/a', 'the player\'s light halo; gameplay: false'],
    LightBossShot: ['absent', 'named only in a fallRock.js list; LightBoss (L69) is never entered (NEVER_ENTER_LEVELS)'],
    LightBoss: ['refused', 'enemyDamage.js:422 KILL_ARM_POLICY refused "boss damage — R6"; spawned by LightBossController (L69, never entered)'],
    LightBossTotem: ['absent', 'no model mention; spawned by LightBossController.as:56 (L69, never entered)'],
    Tentacle: ['refused', 'enemyDamage.js:420 KILL_ARM_POLICY refused "D8; off this rung"; spawned by TentacleBeast (L57, never entered)'],
    RayShot: ['n/a', 'the death ray: Player.hasDeathRay is never set true anywhere in src; levelRun.js:14857 "deathRaying — FALSE BY CONSTRUCTION"'],
    NPC: ['transcribed', 'base class; dialogue.js PLACED_NPC_TALK'],
    Activators: ['transcribed', 'base class; activators.js'],
    Mobile: ['transcribed', 'base class; playerPhysicsV2 / chasers'],
    Pickup: ['transcribed', 'base class; levelWorld pickups'],
    APItem: ['transcribed', 'levelWorld.js apitem (M1 AP pickup; f2-apitem oracle) — placed only by a generated/AP set, no vanilla room'],
    Enemy: ['partial', 'base class; KILL_ARM_POLICY.Enemy refused (generic arm)'],
    Cactus: ['n/a', 'no .oel places it and nothing spawns it'],
    Squishle: ['n/a', 'no .oel places it and nothing spawns it'],
    Stick: ['n/a', 'no .oel places it and nothing spawns it'],
};
const { DAMAGE_SITES, HARMFUL_CLASSES, DISPLACING_CLASSES } = await import(join(MOD, 'seedlingDamageSites.js'));
const { PLACED_NPC_TALK, TALK_OWNED_ELSEWHERE } = await import(join(MOD, 'dialogue.js'));
const { ENTITY_SEMANTICS, LEVEL_PROPERTY_TAGS } = await import(join(FP, 'seedlingSemantics.js'));
const OV = await import(join(FP, 'seedlingPlaythroughOverlay.js'));

// ── 1. the factory: tag -> AS3 class, by the line that constructs it ─────────
const gameLines = readFileSync(join(SRC, 'Game.as'), 'latin1').split('\n');
const NON_ENTITY = new Set(['Point', 'Rectangle', 'Spritemap', 'Image', 'Array', 'Vector', 'XML', 'Sfx', 'Text', 'Graphiclist', 'Pixelmask', 'Hitbox', 'Tilemap', 'Grid', 'BitmapData', 'Backdrop']);
const factory = {};
for (let i = 0; i < gameLines.length; i++) {
    const m = gameLines[i].match(/xml\.objects\[0\]\.(\w+)\)/);
    if (!m) continue;
    const tag = m[1];
    if (factory[tag]) continue;
    let cls = null; let line = null;
    for (let j = i; j < Math.min(i + 25, gameLines.length); j++) {
        if (j > i && /for each \(o in xml|if \(xml/.test(gameLines[j])) break;
        for (const n of gameLines[j].matchAll(/new ([A-Z]\w*)\(/g)) if (!NON_ENTITY.has(n[1])) { cls = n[1]; line = j + 1; break; }
        if (cls) break;
    }
    factory[tag] = { as3: cls, line: line ?? i + 1, levelProperty: cls === null };
}

// ── 2. the AS3 entity classes ────────────────────────────────────────────────
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const asFiles = walk(SRC).filter((p) => p.endsWith('.as') && !relative(SRC, p).startsWith('net'));
const classes = {};
const texts = {};
for (const p of asFiles) {
    const txt = readFileSync(p, 'latin1');
    const m = txt.match(/public\s+(?:dynamic\s+)?class\s+(\w+)(?:\s+extends\s+([\w.]+))?/);
    if (!m) continue;
    texts[m[1]] = txt;
    classes[m[1]] = { as3: m[1], file: relative(SRC, p), extends: m[2]?.split('.').pop() ?? null,
        updates: /override\s+public\s+function\s+update\s*\(/.test(txt) };
}
const ancestry = (c) => { const out = []; let x = classes[c]?.extends; while (x) { out.push(x); x = classes[x]?.extends; } return out; };
for (const c of Object.values(classes)) {
    c.ancestry = ancestry(c.as3);
    c.isEntity = c.ancestry.some((a) => ['Entity', 'Mobile'].includes(a)) || c.extends === 'Entity';
    c.isEnemy = c.ancestry.includes('Enemy') || c.as3 === 'Enemy';
    // inherited update: any ancestor in the game src that overrides update()
    c.writesOwnTag = /setPersistence\(tag\b/.test(texts[c.as3] ?? '');
    c.active = c.updates || c.ancestry.some((a) => classes[a]?.updates && !['Mobile'].includes(a));
}
// runtime spawn sites: `new X(` anywhere in the src outside the factory lines
const factoryLines = new Set(Object.values(factory).map((f) => `Game.as:${f.line}`));
for (const p of asFiles) {
    const lines = readFileSync(p, 'latin1').split('\n');
    lines.forEach((l, i) => {
        for (const n of l.matchAll(/new ([A-Z]\w*)\(/g)) {
            const c = classes[n[1]];
            if (!c) continue;
            const site = `${relative(SRC, p)}:${i + 1}`;
            if (factoryLines.has(site)) continue;
            if (relative(SRC, p) === 'Game.as' && l.includes('xml.objects')) continue;
            (c.spawnSites ||= []).push(site);
        }
    });
}

// ── 3. the atlas: placements and rooms per tag ───────────────────────────────
const atlas = readJson(join(FP, 'atlases', 'seedling-map.json'));
const tags = {};
for (const L of atlas.levels) for (const e of L.entities ?? []) {
    const t = (tags[e.type] ||= { tag: e.type, placements: 0, rooms: new Set() });
    t.placements++; t.rooms.add(L.level);
}

// ButtonRoom.as:93 `Game.setPersistence(t, persist, room)` — the one placed cross-room writer (Moonrock's is
// a fixed {0, moonrock_target}): a buttonroom with room >= 0 writes {room, tset}.
const crossRoomWrites = new Map();
for (const L of atlas.levels) for (const e of L.entities ?? []) {
    if (e.type !== 'buttonroom' || !(Number(e.attrs?.room) >= 0)) continue;
    crossRoomWrites.set(`${Number(e.attrs.room)},${Number(e.attrs.tset)}`, `buttonroom@L${L.level}`);
}

// ── 4. the model text ────────────────────────────────────────────────────────
const modelFiles = readdirSync(MOD).filter((f) => f.endsWith('.js') && !f.includes('.test.'));
const modelText = Object.fromEntries(modelFiles.map((f) => [f, readFileSync(join(MOD, f), 'utf8')]));
const REFUSAL = /fail\(|throw |refus|UNMODELLED|not model|NOT MODEL|unmodelled/;
function modelMentions(as3) {
    const re = new RegExp(`\\b${as3}\\b`);
    const files = []; const refusals = [];
    for (const [f, txt] of Object.entries(modelText)) {
        if (!re.test(txt)) continue;
        files.push(f);
        txt.split('\n').forEach((l, i) => { if (re.test(l) && REFUSAL.test(l)) refusals.push(`${f}:${i + 1}`); });
    }
    const lc = as3.toLowerCase();
    const dedicated = modelFiles.filter((f) => { const b = basename(f, '.js').toLowerCase(); return b === lc || ['fight', 'blast', 'rng'].some((s) => b === lc + s); });
    return { files, refusalLines: refusals, dedicated };
}

// ── 5. probes + route ────────────────────────────────────────────────────────
const persistence = readJson(arg('persistence'));
const rooms = readJson(arg('rooms'));
const survey = readJson(arg('survey'));
const i1 = readJson(arg('i1'));
const sphere = readJson(join(FP, 'atlases', 'seedling-sphere-order.json'));
const sphereRooms = new Set(sphere.order.map((o) => o.level));
const surveySteps = (survey?.steps ?? survey?.rows ?? []);
const stepLevel = (s) => s.level ?? s.room ?? s.lv;
const surveyRooms = new Set(surveySteps.map(stepLevel).filter((x) => x !== undefined));
const surveyRefusedRooms = new Set(surveySteps.filter((s) => /REFUS|DECLIN|STALL|TIMEOUT|SEALED/i.test(JSON.stringify(s.verdict ?? s.status ?? s.result ?? ''))).map(stepLevel));
const m1ByType = {};
for (const r of persistence?.m1?.refused ?? []) for (const t of r.types) (m1ByType[t] ||= []).push(`${r.level},${r.tag}`);
const roomRefusals = {};
for (const r of rooms?.rooms ?? []) for (const x of r.runs) if (!x.ok) (roomRefusals[r.level] ||= []).push(x.msg);

// ── 6. join ──────────────────────────────────────────────────────────────────
const allTags = new Set([...Object.keys(factory), ...Object.keys(tags), ...Object.keys(ENTITY_CLASSES)]);
const rowsByClass = {};
const tagRows = [];
for (const tag of [...allTags].sort()) {
    const f = factory[tag];
    const as3 = f?.as3 ?? null;
    const ec = ENTITY_CLASSES[tag];
    const t = tags[tag];
    const roomList = t ? [...t.rooms].sort((a, b) => a - b) : [];
    const sem = ENTITY_SEMANTICS[tag];
    const ov = OV.PLAYTHROUGH_ENTITY_OVERLAY?.[tag];
    tagRows.push({
        tag, as3, factoryLine: f ? `Game.as:${f.line}` : null, levelProperty: f?.levelProperty ?? false,
        placements: t?.placements ?? 0, rooms: roomList,
        modelFootprint: ec ? { as3: ec.as3, collider: ec.collider, type: ec.type ?? null, src: ec.src, why: ec.why ?? null, hazard: ec.hazard ?? null, pickup: ec.pickup ?? null } : null,
        as3Agrees: ec ? (as3 === null || ec.as3 === as3 || ec.as3?.includes(as3)) : null,
        rules: {
            semantics: LEVEL_PROPERTY_TAGS.includes(tag) ? 'level-property' : (sem ? sem.kind : null),
            semanticsReason: sem?.reason ?? null,
            overlay: ov ? (ov.kind ?? 'row') : null,
            pixelMask: OV.PIXEL_MASK_TAGS.includes(tag),
        },
        m1Refused: m1ByType[tag] ?? [],
        route: {
            surveyRooms: roomList.filter((r) => surveyRooms.has(r)),
            surveyRefusedRooms: roomList.filter((r) => surveyRefusedRooms.has(r)),
            sphereRooms: roomList.filter((r) => sphereRooms.has(r)),
        },
    });
    if (as3) (rowsByClass[as3] ||= []).push(tag);
}

const classRows = [];
for (const c of Object.values(classes).sort((a, b) => a.as3.localeCompare(b.as3))) {
    if (!c.isEntity) continue;
    const tagsOf = rowsByClass[c.as3] ?? [];
    const placed = tagsOf.reduce((n, t) => n + (tags[t]?.placements ?? 0), 0);
    const roomSet = new Set(tagsOf.flatMap((t) => [...(tags[t]?.rooms ?? [])]));
    const mm = modelMentions(c.as3);
    const kill = KILL_ARM_POLICY[c.as3]?.policy ?? null;
    const stepped = MODELLED_ENEMY_CLASSES[c.as3] ? { module: MODELLED_ENEMY_CLASSES[c.as3].module, wedgeVisible: MODELLED_ENEMY_CLASSES[c.as3].wedgeVisible } : null;
    const footprint = tagsOf.some((t) => ENTITY_CLASSES[t]);
    const m1 = tagsOf.flatMap((t) => m1ByType[t] ?? []);
    const roomsArr = [...roomSet].sort((a, b) => a - b);
    // ── the grade (rule stated in the report) ──
    const axes = [];
    if (tagsOf.length && !footprint) axes.push('no ENTITY_CLASSES row');
    const contact = tagsOf.filter((t) => tags[t]).map((t) => ({ tag: t, ...contactPricing(t) })).filter((x) => x.kind !== 'unknown');
    for (const x of contact) {
        if (x.kind === 'mover') axes.push(`contact/motion refused: combat.contactPricing('${x.tag}') = mover`);
        if (x.kind === 'stepped' && !x.pricedBy) axes.push(`contact unpriced: combat.contactPricing('${x.tag}') = stepped, pricedBy null`);
    }
    if (kill === 'refused') axes.push('kill arm refused (KILL_ARM_POLICY)');
    if (tagsOf.some((t) => (m1ByType[t] ?? []).length && LW.REFUSED_CLEAR_RESPONSES && /BUILDS IT FALLEN/.test((persistence?.m1?.refused ?? []).find((r) => r.types.includes(t))?.why ?? ''))) axes.push('persistence response refused (REFUSED_CLEAR_RESPONSES.arm)');
    // A tagged entity whose slot the model has no response for. It is a GAP only
    // when something in that room can WRITE the slot (the class itself, or a
    // co-tagged entity whose class writes its tag); otherwise the cleared state
    // is unreachable in the game and the refusal costs nothing.
    for (const r of (persistence?.m1?.refused ?? []).filter((r) => tagsOf.some((t) => r.types.includes(t)) && /no declared persistence response/.test(r.why))) {
        const writers = r.types.filter((t) => classes[factory[t]?.as3]?.writesOwnTag);
        const cross = crossRoomWrites.get(`${r.level},${r.tag}`);
        if (cross) writers.push(cross);
        axes.push(writers.length
            ? `no declared persistence response for {${r.level},${r.tag}} — WRITABLE by ${writers.join('/')}`
            : `no declared persistence response for {${r.level},${r.tag}} — nothing writes it (unreachable state)`);
    }
    const placedTags = tagsOf.filter((t) => tags[t]);
    let status; let grade = null;
    if (!placedTags.length) {
        grade = RUNTIME_GRADES[c.as3] ?? ['UNGRADED', 'no hand grade — add one'];
        status = grade[0];
    } else if (!footprint) status = 'absent';
    else if (axes.some((a) => !/unreachable state/.test(a))) status = 'partial';
    else status = 'transcribed';
    const neverEntered = roomSet.size > 0 && [...roomSet].every((r) => NEVER_ENTER_LEVELS.includes(r));
    classRows.push({
        as3: c.as3, file: c.file, extends: c.extends, enemy: c.isEnemy, active: c.active,
        tags: tagsOf, placements: placed, rooms: roomsArr,
        runtimeSpawnSites: c.spawnSites ?? [],
        origin: tagsOf.length ? (c.spawnSites?.length ? 'placed+spawned' : 'placed') : (c.spawnSites?.length ? 'spawned' : 'base/unused'),
        model: {
            status, grade: grade ? grade[1] : null, gaps: axes, footprint, stepped, contact: contact.map((x) => `${x.tag}:${x.kind}${x.kind === 'stepped' ? `(${x.pricedBy ?? 'unpriced'})` : ''}`), killArm: kill, neverEntered,
            damageSites: DAMAGE_SITES[c.as3]?.length ?? 0, harmful: HARMFUL_CLASSES.includes(c.as3), displacing: DISPLACING_CLASSES.includes(c.as3),
            npcTalk: tagsOf.some((t) => PLACED_NPC_TALK[t] || TALK_OWNED_ELSEWHERE[t]) || null,
            writesOwnTag: c.writesOwnTag,
            outOfBandWriter: Object.values(LW.OUT_OF_BAND_WRITER_CLASSES).includes(c.as3),
            m1Refused: m1,
            files: mm.files.length, dedicated: mm.dedicated, refusalLineCount: mm.refusalLines.length, refusalLines: mm.refusalLines.slice(0, 12),
        },
        rules: tagsOf.map((t) => ({ tag: t, ...tagRows.find((r) => r.tag === t).rules })),
        route: {
            // steps whose OWN refusal text names a placement of this class (`<tag>@x,y`) — causation, not co-location
            namedByRefusal: surveySteps.filter((st) => st.verdict !== 'SOLVED' && tagsOf.some((t) => new RegExp(`(^|[^a-z0-9])${t}@`).test(String(st.refusal ?? ''))))
                .map((st) => `s${st.step}:L${st.level}`),
            surveyRooms: roomsArr.filter((r) => surveyRooms.has(r)),
            surveyRefusedRooms: roomsArr.filter((r) => surveyRefusedRooms.has(r)),
            sphereRooms: roomsArr.filter((r) => sphereRooms.has(r)),
        },
        i1Rows: (i1?.rows ?? []).filter((r) => new RegExp(`\\b${c.as3}\\b`).test(JSON.stringify([r.behaviour, r.model, r.text, r.roomsWhy, r.key]))).map((r) => `${r.id}:${r.status}`),
    });
}
const out = {
    generated: new Date().toISOString(),
    factoryTags: Object.keys(factory).length,
    atlasTags: Object.keys(tags).length,
    tagsNotInFactory: Object.keys(tags).filter((t) => !factory[t]),
    factoryTagsNotInAtlas: Object.keys(factory).filter((t) => !tags[t]),
    modelTagsNotInFactory: Object.keys(ENTITY_CLASSES).filter((t) => !factory[t]),
    surveyRooms: [...surveyRooms].sort((a, b) => a - b),
    surveyRefusedRooms: [...surveyRefusedRooms].sort((a, b) => a - b),
    sphereRooms: [...sphereRooms].sort((a, b) => a - b),
    tags: tagRows,
    classes: classRows,
};
writeFileSync(arg('out'), JSON.stringify(out, null, 1));
const n = (s) => classRows.filter((r) => r.model.status === s).length;
console.log(`factory tags ${out.factoryTags}, atlas tags ${out.atlasTags}, entity classes ${classRows.length}: transcribed ${n('transcribed')} partial ${n('partial')} absent ${n('absent')}`);
console.log('tags not in factory:', out.tagsNotInFactory, '| factory not in atlas:', out.factoryTagsNotInAtlas.length, '| model tags not in factory:', out.modelTagsNotInFactory);
