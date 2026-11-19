function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) return null;
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
}

export interface SketchPoint {
  x: number;
  y: number;
}

export interface SketchStroke {
  color: string;
  width: number;
  isEraser: boolean;
  points: SketchPoint[];
}

export interface CroppedPngResult {
  bytes: Uint8Array;
  dataUri: string;
  width: number;
  height: number;
}

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const c = i + 2 < len ? bytes[i + 2] : 0;
    const triplet = (a << 16) | (b << 8) | c;
    out += BASE64_CHARS[(triplet >>> 18) & 63];
    out += BASE64_CHARS[(triplet >>> 12) & 63];
    out += i + 1 < len ? BASE64_CHARS[(triplet >>> 6) & 63] : '=';
    out += i + 2 < len ? BASE64_CHARS[triplet & 63] : '=';
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (let i = 0; i < data.length; i += 1) {
    a = (a + data[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function writeUint32BE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function makePngChunk(type: string, payload: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + payload.length);
  writeUint32BE(chunk, 0, payload.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(payload, 8);
  const crc = crc32(chunk.subarray(4, 8 + payload.length));
  writeUint32BE(chunk, 8 + payload.length, crc);
  return chunk;
}

/**
 * Encodes an RGBA pixel buffer (length = width * height * 4) into a valid PNG binary
 * using uncompressed zlib DEFLATE stored blocks (zero native dependencies).
 */
export function encodeRgbaToPng(
  rgba: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const rowBytes = width * 4;
  const rawScanlines = new Uint8Array((rowBytes + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const destRow = y * (rowBytes + 1);
    rawScanlines[destRow] = 0; // Filter type 0 (None)
    rawScanlines.set(
      rgba.subarray(y * rowBytes, (y + 1) * rowBytes),
      destRow + 1
    );
  }

  // Wrap scanlines in valid zlib container (header + stored DEFLATE blocks + Adler32)
  const MAX_BLOCK = 65535;
  const blockCount = Math.max(1, Math.ceil(rawScanlines.length / MAX_BLOCK));
  const zlibBuf = new Uint8Array(2 + rawScanlines.length + blockCount * 5 + 4);

  let zPos = 0;
  zlibBuf[zPos++] = 0x78; // CMF: DEFLATE, 32K window
  zlibBuf[zPos++] = 0x01; // FLG: no dict, check bits valid (0x7801 % 31 === 0)

  let offset = 0;
  while (offset < rawScanlines.length) {
    const len = Math.min(MAX_BLOCK, rawScanlines.length - offset);
    const isFinal = offset + len >= rawScanlines.length ? 1 : 0;
    zlibBuf[zPos++] = isFinal; // BFINAL + BTYPE=00 (stored)
    zlibBuf[zPos++] = len & 0xff;
    zlibBuf[zPos++] = (len >>> 8) & 0xff;
    const nlen = ~len & 0xffff;
    zlibBuf[zPos++] = nlen & 0xff;
    zlibBuf[zPos++] = (nlen >>> 8) & 0xff;
    zlibBuf.set(rawScanlines.subarray(offset, offset + len), zPos);
    zPos += len;
    offset += len;
  }

  writeUint32BE(zlibBuf, zPos, adler32(rawScanlines));
  zPos += 4;

  // IHDR
  const ihdr = new Uint8Array(13);
  writeUint32BE(ihdr, 0, width);
  writeUint32BE(ihdr, 4, height);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makePngChunk('IHDR', ihdr);
  const idatChunk = makePngChunk('IDAT', zlibBuf.subarray(0, zPos));
  const iendChunk = makePngChunk('IEND', new Uint8Array(0));

  const out = new Uint8Array(
    sig.length + ihdrChunk.length + idatChunk.length + iendChunk.length
  );
  let pos = 0;
  out.set(sig, pos);
  pos += sig.length;
  out.set(ihdrChunk, pos);
  pos += ihdrChunk.length;
  out.set(idatChunk, pos);
  pos += idatChunk.length;
  out.set(iendChunk, pos);

  return out;
}

function paintDisc(
  buf: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number
): void {
  const minX = Math.max(0, Math.floor(cx - radius - 1));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius + 1));
  const minY = Math.max(0, Math.floor(cy - radius - 1));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius + 1));
  const outer = radius + 0.65;
  const inner = Math.max(0, radius - 0.65);

  for (let y = minY; y <= maxY; y += 1) {
    const dy = y - cy;
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > outer) continue;

      const alpha =
        dist <= inner ? 1 : Math.max(0, Math.min(1, (outer - dist) / (outer - inner)));
      const idx = (y * width + x) * 4;
      if (alpha >= 0.99) {
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = 255;
      } else {
        const inv = 1 - alpha;
        buf[idx] = Math.round(r * alpha + buf[idx] * inv);
        buf[idx + 1] = Math.round(g * alpha + buf[idx + 1] * inv);
        buf[idx + 2] = Math.round(b * alpha + buf[idx + 2] * inv);
        buf[idx + 3] = 255;
      }
    }
  }
}

function paintSegment(
  buf: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  r: number,
  g: number,
  b: number
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = Math.max(0.75, radius * 0.45);
  const steps = Math.max(1, Math.ceil(dist / step));

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    paintDisc(buf, width, height, x0 + dx * t, y0 + dy * t, radius, r, g, b);
  }
}

/**
 * Rasterizes pen & eraser strokes, auto-crops tightly around visible ink bounds
 * (with clean padding), and encodes a real PNG binary ready to write to disk.
 * Returns null if the canvas is blank (or completely erased).
 */
export function renderCroppedSketchPng(
  strokes: SketchStroke[],
  options?: { padding?: number; maxDimension?: number }
): CroppedPngResult | null {
  const padding = options?.padding ?? 18;
  const maxDimension = options?.maxDimension ?? 720;

  const nonEmpty = strokes.filter((s) => s.points.length > 0);
  if (nonEmpty.length === 0) return null;

  // Step 1: Initial coarse bounds of all strokes
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of nonEmpty) {
    const halfW = Math.max(1, stroke.width / 2) + 2;
    for (const pt of stroke.points) {
      if (pt.x - halfW < minX) minX = pt.x - halfW;
      if (pt.y - halfW < minY) minY = pt.y - halfW;
      if (pt.x + halfW > maxX) maxX = pt.x + halfW;
      if (pt.y + halfW > maxY) maxY = pt.y + halfW;
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;

  const rawW = Math.max(1, maxX - minX);
  const rawH = Math.max(1, maxY - minY);
  const scale = Math.min(1.5, maxDimension / Math.max(rawW, rawH));

  const workW = Math.max(1, Math.ceil(rawW * scale) + 4);
  const workH = Math.max(1, Math.ceil(rawH * scale) + 4);

  // Fill white canvas (#FFFFFF)
  const rgba = new Uint8Array(workW * workH * 4);
  rgba.fill(255);

  // Step 2: Rasterize strokes in draw order (eraser paints crisp white)
  for (const stroke of nonEmpty) {
    const rgb = stroke.isEraser
      ? { r: 255, g: 255, b: 255 }
      : parseHexRgb(stroke.color) ?? { r: 0, g: 0, b: 0 };
    const radius = Math.max(1, (stroke.width * scale) / 2);

    const pts = stroke.points;
    if (pts.length === 1) {
      const px = (pts[0].x - minX) * scale + 2;
      const py = (pts[0].y - minY) * scale + 2;
      paintDisc(rgba, workW, workH, px, py, radius, rgb.r, rgb.g, rgb.b);
    } else {
      for (let i = 1; i < pts.length; i += 1) {
        const x0 = (pts[i - 1].x - minX) * scale + 2;
        const y0 = (pts[i - 1].y - minY) * scale + 2;
        const x1 = (pts[i].x - minX) * scale + 2;
        const y1 = (pts[i].y - minY) * scale + 2;
        paintSegment(rgba, workW, workH, x0, y0, x1, y1, radius, rgb.r, rgb.g, rgb.b);
      }
    }
  }

  // Step 3: Pixel-accurate tight auto-crop to remaining non-white ink pixels
  let cropMinX = workW;
  let cropMinY = workH;
  let cropMaxX = -1;
  let cropMaxY = -1;

  for (let y = 0; y < workH; y += 1) {
    for (let x = 0; x < workW; x += 1) {
      const idx = (y * workW + x) * 4;
      if (rgba[idx] < 252 || rgba[idx + 1] < 252 || rgba[idx + 2] < 252) {
        if (x < cropMinX) cropMinX = x;
        if (x > cropMaxX) cropMaxX = x;
        if (y < cropMinY) cropMinY = y;
        if (y > cropMaxY) cropMaxY = y;
      }
    }
  }

  // Entire drawing was erased
  if (cropMaxX < cropMinX || cropMaxY < cropMinY) {
    return null;
  }

  const inkW = cropMaxX - cropMinX + 1;
  const inkH = cropMaxY - cropMinY + 1;
  const finalW = inkW + padding * 2;
  const finalH = inkH + padding * 2;

  const cropped = new Uint8Array(finalW * finalH * 4);
  cropped.fill(255);

  for (let y = 0; y < inkH; y += 1) {
    const srcStart = ((cropMinY + y) * workW + cropMinX) * 4;
    const srcEnd = srcStart + inkW * 4;
    const dstStart = ((y + padding) * finalW + padding) * 4;
    cropped.set(rgba.subarray(srcStart, srcEnd), dstStart);
  }

  const bytes = encodeRgbaToPng(cropped, finalW, finalH);
  return {
    bytes,
    dataUri: `data:image/png;base64,${uint8ArrayToBase64(bytes)}`,
    width: finalW,
    height: finalH,
  };
}
