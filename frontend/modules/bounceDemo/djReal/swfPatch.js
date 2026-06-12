// swfPatch.js — build the loader-injected wide Doodle Jump SWF in the
// browser from the USER-SUPPLIED original SWF (the original is never
// committed to this repo; see index.html's acquisition flow).
//
// PROVISIONAL implementation: this is a faithful JS port of the subset of
// SWFRecomp-CC's tools/divergence/inject_tracer.py that Doodle Jump needs
// (CWS inflate -> header RECT width patch -> version bump -> splice the
// loader bytecode before the first ShowFrame -> fix file length). The
// canonical home for SWF patching is the SWFRecomp-CC repo (per the
// dj-loader handoff addendum, which asks for a browser injector module
// owned alongside Loader.as); replace this file with their module when it
// ships. Verified byte-identical to
//   inject_tracer.py <original> --bytecode loader_bytecode.bin --stage-width 600
// by scripts/procgen/verify-dj-swf-patch.mjs.
//
// NOT ported (Doodle Jump never needs them): ZWS/LZMA decompression and
// the SWF5 -> SWF6 CLIPACTIONS UI16->UI32 widening (DJ is CWS, SWF >= 6
// — buildLoaderSwf throws on both, loudly, rather than mis-patching).

/** Inflate a CWS body (zlib stream) via DecompressionStream. */
async function inflate(bytes) {
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
}

/** Decompress to FWS (CWS supported; FWS passthrough). */
async function decompressSwf(bytes) {
    const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
    if (sig === 'FWS') return Uint8Array.from(bytes);
    if (sig === 'CWS') {
        const body = await inflate(bytes.subarray(8));
        const out = new Uint8Array(8 + body.length);
        out.set([0x46, 0x57, 0x53]); // 'FWS'
        out.set(bytes.subarray(3, 8), 3);
        out.set(body, 8);
        return out;
    }
    if (sig === 'ZWS') {
        throw new Error('LZMA-compressed SWF (ZWS) not supported — '
            + 'convert to CWS/FWS first');
    }
    throw new Error(`not a SWF (signature ${JSON.stringify(sig)})`);
}

function rectByteLength(data, pos) {
    const nbits = (data[pos] >> 3) & 0x1f;
    return Math.ceil((5 + nbits * 4) / 8);
}

/**
 * Re-pack the header FrameSize RECT with xmax = widthPx (the wrap point
 * is Stage.width-relative in DJ's hero, so this header-only patch is the
 * whole 600-wide story). Signed bitfields share one nbits; growing xmax
 * can grow the RECT a byte, so the (header-only) buffer is rebuilt.
 * Returns a new FWS Uint8Array.
 */
function patchStageWidth(fws, widthPx) {
    const newXmax = widthPx * 20; // px -> twips
    const nbits = (fws[8] >> 3) & 0x1f;

    const readSb = (bitpos, n) => {
        let v = 0;
        for (let i = 0; i < n; i++) {
            const p = bitpos + i;
            v = (v << 1) | ((fws[8 + (p >> 3)] >> (7 - (p % 8))) & 1);
        }
        return v & (1 << (n - 1)) ? v - (1 << n) : v;
    };
    const xmin = readSb(5, nbits);
    const ymin = readSb(5 + 2 * nbits, nbits);
    const ymax = readSb(5 + 3 * nbits, nbits);
    const oldLen = rectByteLength(fws, 8);

    const vals = [xmin, newXmax, ymin, ymax];
    // Signed field width: magnitude bits of the widest value + sign bit
    // (matches Python's int.bit_length() + 1 for non-negative values).
    const newNbits = Math.max(...vals.map(
        (v) => (v < 0 ? 32 - Math.clz32(~v) : 32 - Math.clz32(v)))) + 1;
    const bits = [];
    for (let i = 0; i < 5; i++) bits.push((newNbits >> (4 - i)) & 1);
    for (const v of vals) {
        const u = v & ((1 << newNbits) - 1);
        for (let i = 0; i < newNbits; i++) bits.push((u >> (newNbits - 1 - i)) & 1);
    }
    while (bits.length % 8) bits.push(0);
    const rect = new Uint8Array(bits.length / 8);
    bits.forEach((bit, i) => { if (bit) rect[i >> 3] |= 1 << (7 - (i % 8)); });

    const out = new Uint8Array(fws.length - oldLen + rect.length);
    out.set(fws.subarray(0, 8));
    out.set(rect, 8);
    out.set(fws.subarray(8 + oldLen), 8 + rect.length);
    return out;
}

/** Byte offset of the first ShowFrame (or End) tag header. */
function findFirstShowFrame(data) {
    let pos = 8 + rectByteLength(data, 8);
    pos += 4; // frame rate(2) + frame count(2)
    while (pos + 2 <= data.length) {
        const tagStart = pos;
        const codeAndLength = data[pos] | (data[pos + 1] << 8);
        pos += 2;
        const tagType = (codeAndLength >> 6) & 0x3ff;
        let length = codeAndLength & 0x3f;
        if (length === 0x3f) {
            if (pos + 4 > data.length) return -1;
            length = data[pos] | (data[pos + 1] << 8)
                | (data[pos + 2] << 16) | (data[pos + 3] << 24);
            pos += 4;
        }
        pos += length;
        if (tagType === 1 || tagType === 0) return tagStart; // ShowFrame / End
    }
    return -1;
}

/**
 * Original DJ SWF bytes + loader bytecode -> loader-injected wide FWS.
 *
 * @param {Uint8Array} swfBytes      the user's original Doodle Jump SWF
 * @param {Uint8Array} bytecodeBytes loader_bytecode.bin (committed)
 * @param {object} [opts]
 * @param {number} [opts.stageWidth=600] header RECT width in px (0 = keep)
 * @param {number} [opts.minVersion=8]   minimum SWF version in the output
 * @returns {Promise<Uint8Array>} injected FWS
 */
export async function buildLoaderSwf(swfBytes, bytecodeBytes, {
    stageWidth = 600,
    minVersion = 8,
} = {}) {
    let fws = await decompressSwf(swfBytes);
    if (fws[3] < 6) {
        throw new Error(`SWF version ${fws[3]} < 6 needs the CLIPACTIONS `
            + 'widening pass (not ported) — is this really Doodle Jump?');
    }
    if (stageWidth) fws = patchStageWidth(fws, stageWidth);

    const insertPos = findFirstShowFrame(fws);
    if (insertPos < 0) throw new Error('no ShowFrame tag found');
    if (fws[3] < minVersion) fws[3] = minVersion;

    const out = new Uint8Array(fws.length + bytecodeBytes.length);
    out.set(fws.subarray(0, insertPos));
    out.set(bytecodeBytes, insertPos);
    out.set(fws.subarray(insertPos), insertPos + bytecodeBytes.length);
    // File length (bytes 4-7, little-endian u32).
    new DataView(out.buffer).setUint32(4, out.length, true);
    return out;
}
