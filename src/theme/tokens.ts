import { Platform } from 'react-native';
import { ThemeMode } from '../types/note';

export const FONTS = {
  serif: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'Georgia',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
} as const;

export interface ThemePalette {
  bg: string;
  text: string;
  card: string;
  cardHover: string;
  accent: string;
  accentLight: string;
  muted: string;
  border: string;
  searchBg: string;
  fabBg: string;
  fabText: string;
  toolbarBg: string;
  toolbarBorder: string;
  tagBg: string;
  tagText: string;
  pinnedBg: string;
  pinnedText: string;
  modalBg: string;
  inputBg: string;
  danger: string;
  // Derived tonal elevation & semantic surface helpers
  surfaceElevated: string;
  cardBorder: string;
  pinnedAccent: string;
  dangerSoft: string;
  successSoft: string;
  successText: string;
  ripple: string;
  overlay: string;
  toastSuccessBg: string;
  toastSuccessText: string;
  toastErrorBg: string;
  toastErrorText: string;
  toastInfoBg: string;
  toastInfoText: string;
}

// 1. Swiss White (Default Light) — Pure Gallery White, Carbon Ink & Swiss Vermilion
export const LIGHT_THEME: ThemePalette = {
  bg: '#FFFFFF',
  text: '#111111',
  card: '#FAFAFA',
  cardHover: '#F2F2F2',
  accent: '#D9381E',
  accentLight: '#FDECE9',
  muted: '#666666',
  border: 'rgba(17, 17, 17, 0.11)',
  searchBg: '#F4F4F4',
  fabBg: '#111111',
  fabText: '#FFFFFF',
  toolbarBg: '#FFFFFF',
  toolbarBorder: '#D4D4D4',
  tagBg: '#F2F2F2',
  tagText: '#111111',
  pinnedBg: '#FDECE9',
  pinnedText: '#B92B15',
  modalBg: '#FFFFFF',
  inputBg: '#F4F4F4',
  danger: '#C81E1E',
  surfaceElevated: '#FFFFFF',
  cardBorder: '#E2E2E2',
  pinnedAccent: '#D9381E',
  dangerSoft: 'rgba(200, 30, 30, 0.09)',
  successSoft: 'rgba(21, 128, 61, 0.1)',
  successText: '#166534',
  ripple: 'rgba(17, 17, 17, 0.07)',
  overlay: 'rgba(17, 17, 17, 0.45)',
  toastSuccessBg: '#14532D',
  toastSuccessText: '#FFFFFF',
  toastErrorBg: '#B91C1C',
  toastErrorText: '#FFFFFF',
  toastInfoBg: '#111111',
  toastInfoText: '#FFFFFF',
};

// 2. Warm Paper — Soft Archival Print Stock & Swiss Vermilion
export const PAPER_THEME: ThemePalette = {
  ...LIGHT_THEME,
  bg: '#F7F5F0',
  card: '#FFFFFF',
  cardHover: '#EFECE4',
  muted: '#625F59',
  border: 'rgba(17, 17, 17, 0.13)',
  searchBg: '#EFECE4',
  fabText: '#F7F5F0',
  toolbarBorder: '#CBC6BC',
  tagBg: '#EFECE4',
  modalBg: '#F7F5F0',
  inputBg: '#EFECE4',
  cardBorder: '#D8D3C8',
  toastSuccessText: '#F7F5F0',
  toastErrorText: '#F7F5F0',
  toastInfoText: '#F7F5F0',
};

// 3. Zurich Cobalt — Crisp White with International Blue Accent
export const COBALT_THEME: ThemePalette = {
  ...LIGHT_THEME,
  bg: '#FFFFFF',
  text: '#0F172A',
  card: '#F8FAFC',
  cardHover: '#EFF4FB',
  accent: '#1D4ED8',
  accentLight: '#DBEAFE',
  muted: '#5B677A',
  border: 'rgba(15, 23, 42, 0.11)',
  searchBg: '#F1F5F9',
  fabBg: '#0F172A',
  toolbarBorder: '#CBD5E1',
  tagBg: '#EFF6FF',
  tagText: '#1E3A8A',
  pinnedBg: '#DBEAFE',
  pinnedText: '#1D4ED8',
  inputBg: '#F1F5F9',
  cardBorder: '#DCE3EE',
  pinnedAccent: '#1D4ED8',
  ripple: 'rgba(29, 78, 216, 0.08)',
  toastInfoBg: '#0F172A',
};

// 4. Carbon Dark — Deep Broadsheet Black & Luminous Vermilion
export const DARK_THEME: ThemePalette = {
  bg: '#0E0E0D',
  text: '#F5F5F4',
  card: '#171716',
  cardHover: '#222220',
  accent: '#FF5636',
  accentLight: 'rgba(255, 86, 54, 0.16)',
  muted: '#9C9B97',
  border: 'rgba(255, 255, 255, 0.11)',
  searchBg: '#171716',
  fabBg: '#F5F5F4',
  fabText: '#0E0E0D',
  toolbarBg: '#171716',
  toolbarBorder: 'rgba(255, 255, 255, 0.18)',
  tagBg: '#232321',
  tagText: '#E7E7E4',
  pinnedBg: 'rgba(255, 86, 54, 0.18)',
  pinnedText: '#FF7D63',
  modalBg: '#131312',
  inputBg: '#1F1F1D',
  danger: '#F87171',
  surfaceElevated: '#1E1E1C',
  cardBorder: 'rgba(255, 255, 255, 0.15)',
  pinnedAccent: '#FF5636',
  dangerSoft: 'rgba(248, 113, 113, 0.16)',
  successSoft: 'rgba(74, 222, 128, 0.16)',
  successText: '#4ADE80',
  ripple: 'rgba(255, 255, 255, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.72)',
  toastSuccessBg: '#166534',
  toastSuccessText: '#FFFFFF',
  toastErrorBg: '#DC2626',
  toastErrorText: '#FFFFFF',
  toastInfoBg: '#F5F5F4',
  toastInfoText: '#0E0E0D',
};

// 5. Midnight Ink — Deep Navy Slate & Electric Ice Blue
export const MIDNIGHT_THEME: ThemePalette = {
  ...DARK_THEME,
  bg: '#0B1120',
  text: '#F1F5F9',
  card: '#121B2E',
  cardHover: '#1B2740',
  accent: '#60A5FA',
  accentLight: 'rgba(96, 165, 250, 0.16)',
  muted: '#94A3B8',
  border: 'rgba(241, 245, 249, 0.11)',
  searchBg: '#121B2E',
  fabBg: '#F1F5F9',
  fabText: '#0B1120',
  toolbarBg: '#121B2E',
  toolbarBorder: 'rgba(241, 245, 249, 0.18)',
  tagBg: '#1B2840',
  tagText: '#BFDBFE',
  pinnedBg: 'rgba(96, 165, 250, 0.18)',
  pinnedText: '#93C5FD',
  modalBg: '#0F172A',
  inputBg: '#182338',
  surfaceElevated: '#162036',
  cardBorder: 'rgba(148, 163, 184, 0.2)',
  pinnedAccent: '#60A5FA',
  toastInfoBg: '#F1F5F9',
  toastInfoText: '#0B1120',
};

export interface ThemeOption {
  id: ThemeMode;
  label: string;
  isDark: boolean;
  previewBg: string;
  previewCard: string;
  previewAccent: string;
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    id: 'light',
    label: 'Swiss White',
    isDark: false,
    previewBg: '#FFFFFF',
    previewCard: '#F4F4F4',
    previewAccent: '#D9381E',
  },
  {
    id: 'paper',
    label: 'Warm Paper',
    isDark: false,
    previewBg: '#F7F5F0',
    previewCard: '#FFFFFF',
    previewAccent: '#D9381E',
  },
  {
    id: 'cobalt',
    label: 'Zurich Blue',
    isDark: false,
    previewBg: '#FFFFFF',
    previewCard: '#EFF6FF',
    previewAccent: '#1D4ED8',
  },
  {
    id: 'dark',
    label: 'Carbon Dark',
    isDark: true,
    previewBg: '#0E0E0D',
    previewCard: '#171716',
    previewAccent: '#FF5636',
  },
  {
    id: 'midnight',
    label: 'Midnight Ink',
    isDark: true,
    previewBg: '#0B1120',
    previewCard: '#121B2E',
    previewAccent: '#60A5FA',
  },
] as const;

export const VALID_THEME_MODES: readonly ThemeMode[] = THEME_OPTIONS.map(
  (t) => t.id
);

export function isDarkTheme(mode: ThemeMode): boolean {
  return mode === 'dark' || mode === 'midnight';
}

// Sharp Swiss architectural geometry (replaces soft Material 3 bubbles)
export const RADII = {
  card: 4,
  fab: 4,
  modal: 6,
  search: 4,
  pill: 3,
} as const;

const THEME_MAP: Record<ThemeMode, ThemePalette> = {
  light: LIGHT_THEME,
  paper: PAPER_THEME,
  cobalt: COBALT_THEME,
  dark: DARK_THEME,
  midnight: MIDNIGHT_THEME,
};

export function getThemePalette(mode: ThemeMode): ThemePalette {
  return THEME_MAP[mode] ?? LIGHT_THEME;
}
