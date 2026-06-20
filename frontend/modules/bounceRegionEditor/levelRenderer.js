/**
 * Whole-level renderer for the bounce region editor. Unlike the game's
 * render.js (which is session-shaped — it follows the player with a camera and
 * ghosts suppressed entities), this paints the ENTIRE level top-to-bottom with
 * every entity at full opacity, so the author sees the whole geometry at once.
 * It reuses the game's coordinate conventions: positions are CENTERS, y
 * increases DOWNWARD, the entrance is implicitly bottom-center, and platform
 * width comes from the resolved physics constants. A selected entity is
 * outlined so the editor's click-to-select reads clearly.
 */

const PLATFORM_COLORS = { green: '#5cb85c', blue: '#5b9bd5', brown: '#a0784f' };
const ARROWS = { up: '↑', down: '↓', left: '←', right: '→' };

// One marker draw per entity kind, centred on (x, y) in screen space.
function drawSpring(ctx, x, y) {
    ctx.fillStyle = '#e6c84a';
    ctx.fillRect(x - 6, y - 6, 12, 6);
}
function drawJetpack(ctx, x, y) {
    ctx.fillStyle = '#e08840';
    ctx.fillRect(x - 5, y - 12, 10, 12);
}
function drawPickup(ctx, x, y) {
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.fillStyle = '#222';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('?', x, y + 4);
}
function drawPortal(ctx, x, y, direction) {
    ctx.strokeStyle = '#b08ae0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#b08ae0';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ARROWS[direction] ?? '?', x, y + 5);
}
function drawTeleport(ctx, x, y) {
    ctx.strokeStyle = '#4ec9d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#4ec9d8';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⟲', x, y + 5);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} level - the level data model (level.js)
 * @param {object} opts
 * @param {object} opts.constants - resolved physics constants (PLATFORM_WIDTH)
 * @param {string} [opts.selectedId] - id of the selected platform/entity (outlined)
 * @param {number} [opts.scale] - px per level unit (default: fit canvas width)
 */
export function renderLevel(ctx, level, opts = {}) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const scale = opts.scale ?? (W / level.size.width);
    const sx = (x) => x * scale;
    const sy = (y) => y * scale;
    const C = opts.constants ?? { PLATFORM_WIDTH: 60 };
    const pw = C.PLATFORM_WIDTH * scale;
    const selected = opts.selectedId ?? null;

    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, W, H);

    // Faint grid every 60 level-units so positions read at a glance.
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= level.size.width; gx += 60) {
        ctx.beginPath(); ctx.moveTo(sx(gx) + 0.5, 0); ctx.lineTo(sx(gx) + 0.5, H); ctx.stroke();
    }
    for (let gy = 0; gy <= level.size.height; gy += 60) {
        ctx.beginPath(); ctx.moveTo(0, sy(gy) + 0.5); ctx.lineTo(W, sy(gy) + 0.5); ctx.stroke();
    }

    const hostById = new Map((level.platforms ?? []).map((p) => [p.id, p]));
    const goalX = (g) => (hostById.get(g.on)?.x ?? g.x);
    const goalY = (g) => (hostById.get(g.on)?.y ?? g.y);

    // Platforms first, then the entities riding them.
    for (const p of level.platforms ?? []) {
        ctx.fillStyle = PLATFORM_COLORS[p.type] ?? '#888';
        ctx.fillRect(sx(p.x) - pw / 2, sy(p.y) - 3.5, pw, 7);
        if (p.id === selected) {
            ctx.strokeStyle = '#ffd24a';
            ctx.lineWidth = 2;
            ctx.strokeRect(sx(p.x) - pw / 2 - 2, sy(p.y) - 7, pw + 4, 14);
        }
    }
    for (const s of level.springs ?? []) drawSpring(ctx, sx(goalX(s)), sy(goalY(s)) - 8);
    for (const j of level.jetpacks ?? []) drawJetpack(ctx, sx(goalX(j)), sy(goalY(j)) - 8);
    for (const pk of level.pickups ?? []) drawPickup(ctx, sx(goalX(pk)), sy(goalY(pk)) - 14);
    for (const pt of level.portals ?? []) drawPortal(ctx, sx(goalX(pt)), sy(goalY(pt)) - 16, pt.direction);
    for (const tp of level.teleports ?? []) drawTeleport(ctx, sx(goalX(tp)), sy(goalY(tp)) - 16);

    // Entrance marker: bottom-center (the implicit spawn).
    const ex = sx(level.size.width / 2);
    const ey = sy(level.size.height) - 10;
    ctx.fillStyle = '#8fd14f';
    ctx.beginPath();
    ctx.roundRect(ex - 8, ey - 14, 16, 16, 5);
    ctx.fill();
    ctx.fillStyle = '#8fd14f';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('entrance', ex, ey + 12);
}

export { PLATFORM_COLORS };
