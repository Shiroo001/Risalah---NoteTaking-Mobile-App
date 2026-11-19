export interface HSVColor {
  h: number; // 0..360
  s: number; // 0..1
  v: number; // 0..1
}

export interface RGBColor {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
}

// 14 preset text colors (PRD Section 5.9)
export const TEXT_COLOR_PRESETS: string[] = [
  '#1B1B1F',
  '#445E91',
  '#6750A4',
  '#DC2626',
  '#EA580C',
  '#D97706',
  '#16A34A',
  '#0D9488',
  '#2563EB',
  '#4F46E5',
  '#9333EA',
  '#DB2777',
  '#64748B',
  '#E3E2E6',
];

// 14 preset highlight colors (PRD Section 5.9)
export const HIGHLIGHT_COLOR_PRESETS: string[] = [
  '#FEF08A',
  '#FDE68A',
  '#FED7AA',
  '#FECACA',
  '#FBCFE8',
  '#E9D5FF',
  '#DDD6FE',
  '#BFDBFE',
  '#BAE6FD',
  '#A7F3D0',
  '#BBF7D0',
  '#D9F99D',
  '#E2E8F0',
  '#3F4759',
];

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function normalizeHex(hex: string): string | null {
  const cleaned = hex.trim().replace(/^#/, '');
  if (/^[0-9A-Fa-f]{3}$/.test(cleaned)) {
    const expanded = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
    return `#${expanded.toUpperCase()}`;
  }
  if (/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  return null;
}

export function hsvToRgb(h: number, s: number, v: number): RGBColor {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const val = clamp(v, 0, 1);

  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (hue < 60) {
    rp = c;
    gp = x;
  } else if (hue < 120) {
    rp = x;
    gp = c;
  } else if (hue < 180) {
    gp = c;
    bp = x;
  } else if (hue < 240) {
    gp = x;
    bp = c;
  } else if (hue < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

export function rgbToHex({ r, g, b }: RGBColor): string {
  const toHex = (n: number) =>
    clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hsvToHex(h: number, s: number, v: number): string {
  return rgbToHex(hsvToRgb(h, s, v));
}

export function hexToRgb(hex: string): RGBColor | null {
  const norm = normalizeHex(hex);
  if (!norm) return null;
  const raw = norm.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

export function hexToHsv(hex: string): HSVColor {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 220, s: 0.53, v: 0.57 };

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / d) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / d + 2);
    } else {
      h = 60 * ((r - g) / d + 4);
    }
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : d / max;
  const v = max;

  return { h, s, v };
}
