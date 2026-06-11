/**
 * Canvas renderer for the Bounce Demo game page. Pure draw: reads the
 * session (level, state, abilities, collected) and paints one frame.
 * Suppression decisions come from the SAME suppression module the
 * solver uses — a locked platform/spring/jetpack renders as a
 * translucent ghost, exactly the set the physics ignores.
 */

import { platformXAt } from '../physics.js';
import {
    isPlatformActive,
    activeSprings,
    activeJetpacks,
} from '../suppression.js';

const PLATFORM_COLORS = { green: '#5cb85c', blue: '#5b9bd5', brown: '#a0784f' };
const ARROWS = { up: '↑', down: '↓', left: '←', right: '→' };
const ABILITY_HUD = [
    ['left', '←'], ['right', '→'], ['springs', 'S'],
    ['jetpacks', 'J'], ['blue', 'B'], ['brown', 'Br'],
];

export function renderFrame(ctx, session, ui = {}) {
    const { level, state, abilities, collected } = session;
    // Rule-gated goals (host-evaluated booleans; absent id = open).
    const gateStates = session.gateStates ?? { portals: {}, pickups: {} };
    const isLocked = (kind, id) => gateStates[kind]?.[id] === false;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const scale = W / level.size.width;
    const viewH = H / scale;
    const camY = Math.max(0, Math.min(level.size.height - viewH, state.y - viewH * 0.6));
    const sx = (x) => x * scale;
    const sy = (y) => (y - camY) * scale;

    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, W, H);

    // platforms (ghosted when suppressed) — width from the session's
    // resolved physics constants (profile-stamped worlds may differ).
    // Moving blues draw at their CURRENT swept x (platformXAt, dj
    // behaviors); broken browns are gone (debris not modeled).
    const C = session.constants;
    const brokenSet = new Set(state.broken ?? []);
    const pw = C.PLATFORM_WIDTH * scale;
    for (const p of level.platforms) {
        if (brokenSet.has(p.id)) continue;
        ctx.globalAlpha = isPlatformActive(p, abilities) ? 1 : 0.22;
        ctx.fillStyle = PLATFORM_COLORS[p.type] ?? '#888';
        ctx.fillRect(sx(platformXAt(p, state.t ?? 0, C)) - pw / 2, sy(p.y), pw, 7);
    }
    ctx.globalAlpha = 1;

    // springs and jetpacks (ghosted when locked or host-suppressed,
    // gone with a broken host)
    const springsOn = new Set(activeSprings(level, abilities).map((s) => s.id));
    for (const s of level.springs ?? []) {
        if (brokenSet.has(s.on)) continue;
        ctx.globalAlpha = springsOn.has(s.id) ? 1 : 0.22;
        ctx.fillStyle = '#e6c84a';
        ctx.fillRect(sx(s.x) - 6, sy(s.y) - 6, 12, 6);
    }
    const jetsOn = new Set(activeJetpacks(level, abilities).map((j) => j.id));
    for (const j of level.jetpacks ?? []) {
        if (brokenSet.has(j.on)) continue;
        ctx.globalAlpha = jetsOn.has(j.id) ? 1 : 0.22;
        ctx.fillStyle = '#e08840';
        ctx.fillRect(sx(j.x) - 5, sy(j.y) - 12, 10, 12);
    }
    ctx.globalAlpha = 1;

    // Goal markers ride their HOST platform: a goal hosted on a moving
    // blue draws at the host's current swept x (collection/teleport
    // are landing-triggered on the host, so the marker must track it),
    // and a goal whose host doesn't exist doesn't either — ghosted
    // with a suppressed host (same visual language as the platform),
    // gone with a broken one (until the respawn restores it).
    const hostById = new Map(level.platforms.map((p) => [p.id, p]));
    const goalX = (g) => {
        const host = hostById.get(g.on);
        return host?.sweep ? platformXAt(host, state.t ?? 0, C) : g.x;
    };
    const hostAlpha = (g) => {
        const host = hostById.get(g.on);
        if (!host) return 1;
        if (brokenSet.has(host.id)) return 0;
        return isPlatformActive(host, abilities) ? 1 : 0.22;
    };

    // pickups: squares (outline once collected; padlocked while a
    // rule gate holds them closed — the metroidvania tease)
    for (const pk of level.pickups ?? []) {
        const alpha = hostAlpha(pk);
        if (alpha === 0) continue;
        ctx.globalAlpha = alpha;
        const x = sx(goalX(pk));
        const y = sy(pk.y);
        if (collected.has(pk.id)) {
            ctx.strokeStyle = '#666';
            ctx.strokeRect(x - 9, y - 9, 18, 18);
        } else if (isLocked('pickups', pk.id)) {
            ctx.fillStyle = '#7a7a7a';
            ctx.fillRect(x - 9, y - 9, 18, 18);
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('🔒', x, y + 4);
        } else {
            ctx.fillStyle = '#d8d8d8';
            ctx.fillRect(x - 9, y - 9, 18, 18);
            ctx.fillStyle = '#222';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('?', x, y + 4);
        }
    }
    ctx.globalAlpha = 1;

    // portals: circles with direction arrows (gray padlock while a
    // rule gate holds them closed)
    for (const pt of level.portals ?? []) {
        const alpha = hostAlpha(pt);
        if (alpha === 0) continue;
        ctx.globalAlpha = alpha;
        const x = sx(goalX(pt));
        const y = sy(pt.y);
        const locked = isLocked('portals', pt.id);
        ctx.strokeStyle = locked ? '#777' : '#b08ae0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        if (locked) {
            ctx.fillText('🔒', x, y + 5);
        } else {
            ctx.fillStyle = '#b08ae0';
            ctx.fillText(ARROWS[pt.direction] ?? '?', x, y + 5);
        }
    }
    ctx.globalAlpha = 1;

    // player
    const px = sx(state.x);
    const py = sy(state.y);
    ctx.fillStyle = '#8fd14f';
    ctx.beginPath();
    ctx.roundRect(px - 10, py - 20, 20, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(px - 5, py - 14, 3, 3);
    ctx.fillRect(px + 2, py - 14, 3, 3);

    // HUD: abilities + message
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    let hx = 8;
    for (const [ability, glyph] of ABILITY_HUD) {
        ctx.fillStyle = abilities[ability] ? '#8fd14f' : '#444';
        ctx.fillText(glyph, hx, 18);
        hx += ctx.measureText(glyph).width + 10;
    }
    if (ui.message) {
        ctx.fillStyle = '#e6c84a';
        ctx.textAlign = 'center';
        ctx.fillText(ui.message, W / 2, 40);
    }
}
