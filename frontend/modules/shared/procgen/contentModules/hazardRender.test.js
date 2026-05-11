import { describe, it, expect } from 'vitest';
import {
    drawHazards,
    drawHazardPath,
    drawHazardFacing,
    trianglePoints,
} from './hazardRender.js';
import {
    HAZARD_SHAPE_LINEAR,
    HAZARD_SHAPE_LOOP,
} from './hazardPathGen.js';

// ---------------------------------------------------------------
// Mock canvas context — records every call + property assignment.
// Far cheaper than running through happy-dom / jsdom.
// ---------------------------------------------------------------

function mockCtx() {
    const calls = [];
    const record = (name) => (...args) => calls.push({ name, args });
    return {
        calls,
        save: record('save'),
        restore: record('restore'),
        beginPath: record('beginPath'),
        moveTo: record('moveTo'),
        lineTo: record('lineTo'),
        stroke: record('stroke'),
        fill: record('fill'),
        closePath: record('closePath'),
        set strokeStyle(v) { calls.push({ name: 'strokeStyle', args: [v] }); },
        set fillStyle(v) { calls.push({ name: 'fillStyle', args: [v] }); },
        set lineWidth(v) { calls.push({ name: 'lineWidth', args: [v] }); },
        set lineCap(v) { calls.push({ name: 'lineCap', args: [v] }); },
        set lineJoin(v) { calls.push({ name: 'lineJoin', args: [v] }); },
    };
}

function linear(tiles, phase = 0) {
    return {
        shape: HAZARD_SHAPE_LINEAR,
        length: tiles.length,
        tiles,
        cycleLength: 2 * (tiles.length - 1),
        phase,
    };
}

function loopShape(tiles, phase = 0) {
    return {
        shape: HAZARD_SHAPE_LOOP,
        length: tiles.length,
        tiles,
        cycleLength: tiles.length,
        phase,
    };
}

function namesOf(ctx) {
    return ctx.calls.map((c) => c.name);
}

function callsBy(ctx, name) {
    return ctx.calls.filter((c) => c.name === name).map((c) => c.args);
}

// ---------------------------------------------------------------
// drawHazards — top-level dispatch
// ---------------------------------------------------------------

describe('drawHazards', () => {
    it('no-ops on null / empty / non-array hazards', () => {
        const ctx = mockCtx();
        drawHazards(ctx, null, 20);
        drawHazards(ctx, undefined, 20);
        drawHazards(ctx, [], 20);
        drawHazards(ctx, 'nope', 20);
        expect(ctx.calls).toEqual([]);
    });

    it('no-ops on missing ctx', () => {
        // Just confirm no throw.
        expect(() => drawHazards(null, [linear([{ x: 0, y: 0 }, { x: 1, y: 0 }])], 20))
            .not.toThrow();
    });

    it('no-ops on bad tile pixel size', () => {
        const ctx = mockCtx();
        drawHazards(ctx, [linear([{ x: 0, y: 0 }, { x: 1, y: 0 }])], 0);
        drawHazards(ctx, [linear([{ x: 0, y: 0 }, { x: 1, y: 0 }])], -10);
        drawHazards(ctx, [linear([{ x: 0, y: 0 }, { x: 1, y: 0 }])], NaN);
        expect(ctx.calls).toEqual([]);
    });

    it('draws each hazard\'s path + triangle once', () => {
        const ctx = mockCtx();
        const a = linear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0);
        const b = linear([{ x: 3, y: 3 }, { x: 4, y: 3 }], 0);
        drawHazards(ctx, [a, b], 20);
        // Two paths → two strokes + two fills (triangles).
        expect(callsBy(ctx, 'stroke')).toHaveLength(2);
        expect(callsBy(ctx, 'fill')).toHaveLength(2);
    });
});

// ---------------------------------------------------------------
// drawHazardPath — linear vs loop
// ---------------------------------------------------------------

describe('drawHazardPath', () => {
    it('draws a linear path as moveTo + lineTo per tile, no close', () => {
        const ctx = mockCtx();
        const h = linear([
            { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
        ]);
        drawHazardPath(ctx, h, 20);
        // tilePx=20 → centers are (10,10), (30,10), (50,10).
        expect(callsBy(ctx, 'moveTo')).toEqual([[10, 10]]);
        expect(callsBy(ctx, 'lineTo')).toEqual([[30, 10], [50, 10]]);
        expect(callsBy(ctx, 'stroke')).toHaveLength(1);
    });

    it('closes a loop with a final lineTo back to the first tile', () => {
        const ctx = mockCtx();
        const h = loopShape([
            { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 },
        ]);
        drawHazardPath(ctx, h, 20);
        // centers: (30,30), (50,30), (50,50), (30,50). Then back to (30,30).
        expect(callsBy(ctx, 'moveTo')).toEqual([[30, 30]]);
        expect(callsBy(ctx, 'lineTo')).toEqual([
            [50, 30], [50, 50], [30, 50], [30, 30],
        ]);
    });

    it('skips degenerate hazards (fewer than 2 tiles)', () => {
        const ctx = mockCtx();
        drawHazardPath(ctx, { shape: 'linear', tiles: [], cycleLength: 0, phase: 0 }, 20);
        drawHazardPath(ctx, { shape: 'linear', tiles: [{ x: 0, y: 0 }], cycleLength: 0, phase: 0 }, 20);
        expect(ctx.calls).toEqual([]);
    });

    it('respects custom pathColor + pathWidth via opts', () => {
        const ctx = mockCtx();
        drawHazardPath(
            ctx,
            linear([{ x: 0, y: 0 }, { x: 1, y: 0 }]),
            20,
            { pathColor: '#00ff00', pathWidth: 7 },
        );
        const strokes = callsBy(ctx, 'strokeStyle');
        const widths = callsBy(ctx, 'lineWidth');
        expect(strokes).toContainEqual(['#00ff00']);
        expect(widths).toContainEqual([7]);
    });

    it('save / restore wrap the draw so context state doesn\'t leak', () => {
        const ctx = mockCtx();
        drawHazardPath(ctx, linear([{ x: 0, y: 0 }, { x: 1, y: 0 }]), 20);
        const names = namesOf(ctx);
        expect(names[0]).toBe('save');
        expect(names[names.length - 1]).toBe('restore');
    });
});

// ---------------------------------------------------------------
// drawHazardFacing — direction
// ---------------------------------------------------------------

describe('drawHazardFacing', () => {
    it('draws a filled triangle at the current tile', () => {
        const ctx = mockCtx();
        const h = linear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0); // at (0,0), facing E
        drawHazardFacing(ctx, h, 20);
        // tilePx=20 → center (10,10). Triangle: tip+2 base vertices.
        // We expect one moveTo, two lineTos, closePath, fill.
        expect(callsBy(ctx, 'moveTo')).toHaveLength(1);
        expect(callsBy(ctx, 'lineTo')).toHaveLength(2);
        expect(callsBy(ctx, 'closePath')).toHaveLength(1);
        expect(callsBy(ctx, 'fill')).toHaveLength(1);
    });

    it('triangle tip lies in the facing direction relative to center', () => {
        // Hazard at (0,0) facing E → tip is east of center.
        const ctxE = mockCtx();
        drawHazardFacing(ctxE, linear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0), 20);
        // moveTo is the tip; expect x > 10 (center x), y === 10 (same row).
        const tipE = callsBy(ctxE, 'moveTo')[0];
        expect(tipE[0]).toBeGreaterThan(10);
        expect(tipE[1]).toBe(10);

        // Hazard facing N
        const ctxN = mockCtx();
        drawHazardFacing(ctxN, linear([{ x: 0, y: 1 }, { x: 0, y: 0 }], 0), 20);
        // Center is (10,30), tip is above (y < 30, x === 10)
        const tipN = callsBy(ctxN, 'moveTo')[0];
        expect(tipN[0]).toBe(10);
        expect(tipN[1]).toBeLessThan(30);
    });

    it('respects custom triangleColor', () => {
        const ctx = mockCtx();
        drawHazardFacing(
            ctx,
            linear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0),
            20,
            { triangleColor: '#abcdef' },
        );
        const fills = callsBy(ctx, 'fillStyle');
        expect(fills).toContainEqual(['#abcdef']);
    });

    it('save / restore wrap the draw', () => {
        const ctx = mockCtx();
        drawHazardFacing(ctx, linear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0), 20);
        const names = namesOf(ctx);
        expect(names[0]).toBe('save');
        expect(names[names.length - 1]).toBe('restore');
    });
});

// ---------------------------------------------------------------
// trianglePoints — geometry
// ---------------------------------------------------------------

describe('trianglePoints', () => {
    const center = { x: 50, y: 50 };
    const size = 20;
    // half = 10, baseExtent = 8, baseDepth = 5

    it('N: tip above center, base symmetric below', () => {
        const p = trianglePoints(center, size, 'N');
        expect(p.tip).toEqual({ x: 50, y: 40 });
        expect(p.b1).toEqual({ x: 42, y: 55 });
        expect(p.b2).toEqual({ x: 58, y: 55 });
    });

    it('S: tip below center, base above', () => {
        const p = trianglePoints(center, size, 'S');
        expect(p.tip).toEqual({ x: 50, y: 60 });
        expect(p.b1).toEqual({ x: 58, y: 45 });
        expect(p.b2).toEqual({ x: 42, y: 45 });
    });

    it('E: tip right of center, base left', () => {
        const p = trianglePoints(center, size, 'E');
        expect(p.tip).toEqual({ x: 60, y: 50 });
        expect(p.b1).toEqual({ x: 45, y: 42 });
        expect(p.b2).toEqual({ x: 45, y: 58 });
    });

    it('W: tip left of center, base right', () => {
        const p = trianglePoints(center, size, 'W');
        expect(p.tip).toEqual({ x: 40, y: 50 });
        expect(p.b1).toEqual({ x: 55, y: 58 });
        expect(p.b2).toEqual({ x: 55, y: 42 });
    });

    it('throws on unknown direction', () => {
        expect(() => trianglePoints(center, size, 'NE')).toThrow(/unknown direction/);
    });
});
