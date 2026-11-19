import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { Note, NoteAttachment, Settings, ThemeMode } from '../types/note';

const VALID_THEMES: readonly ThemeMode[] = [
  'light',
  'paper',
  'cobalt',
  'dark',
  'midnight',
];

const NOTES_STORAGE_KEY = '@risalah/notes_v1';
const SETTINGS_STORAGE_KEY = '@risalah/settings_v1';
const ARCHIVE_PIN_SECURE_KEY = 'risalah_archive_pin_v1';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  archivePin: '',
  syncBaseUrl: '',
};

function sanitizeAttachments(raw: unknown): NoteAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list: NoteAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.uri !== 'string' || !r.uri) continue;
    list.push({
      id: typeof r.id === 'string' ? r.id : String(Date.now() + list.length),
      type: r.type === 'sketch' ? 'sketch' : 'image',
      uri: r.uri,
      createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
      width: typeof r.width === 'number' ? r.width : undefined,
      height: typeof r.height === 'number' ? r.height : undefined,
    });
  }
  return list.length > 0 ? list : undefined;
}

export async function loadNotes(): Promise<Note[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      id: typeof item.id === 'number' ? item.id : Date.now(),
      title: typeof item.title === 'string' ? item.title : '',
      content: typeof item.content === 'string' ? item.content : '',
      tags: Array.isArray(item.tags)
        ? item.tags.filter((t: unknown): t is string => typeof t === 'string')
        : [],
      isPinned: Boolean(item.isPinned),
      isArchived: Boolean(item.isArchived),
      isDeleted: Boolean(item.isDeleted),
      sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
      createdAt:
        typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      updatedAt:
        typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
      attachments: sanitizeAttachments(item.attachments),
    }));
  } catch (error) {
    console.warn('Failed to load notes from AsyncStorage:', error);
    return [];
  }
}

export async function saveNotes(notes: Note[]): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.warn('Failed to save notes to AsyncStorage:', error);
  }
}

export async function loadArchivePin(): Promise<string> {
  try {
    const pin = await SecureStore.getItemAsync(ARCHIVE_PIN_SECURE_KEY);
    return typeof pin === 'string' && /^\d{4}$/.test(pin) ? pin : '';
  } catch (error) {
    console.warn('Failed to read Archive PIN from SecureStore:', error);
    return '';
  }
}

export async function saveArchivePin(pin: string): Promise<void> {
  try {
    if (!pin) {
      await SecureStore.deleteItemAsync(ARCHIVE_PIN_SECURE_KEY);
    } else {
      await SecureStore.setItemAsync(ARCHIVE_PIN_SECURE_KEY, pin);
    }
  } catch (error) {
    console.warn('Failed to save Archive PIN to SecureStore:', error);
    throw error;
  }
}

export async function loadSettings(): Promise<Settings> {
  try {
    const [raw, securePin] = await Promise.all([
      AsyncStorage.getItem(SETTINGS_STORAGE_KEY),
      loadArchivePin(),
    ]);
    const parsed = raw ? JSON.parse(raw) : null;
    const theme: ThemeMode = VALID_THEMES.includes(parsed?.theme)
      ? parsed.theme
      : 'light';
    return {
      theme,
      archivePin: securePin,
      syncBaseUrl:
        typeof parsed?.syncBaseUrl === 'string' ? parsed.syncBaseUrl : '',
    };
  } catch (error) {
    console.warn('Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        theme: settings.theme,
        syncBaseUrl: settings.syncBaseUrl,
      })
    );
  } catch (error) {
    console.warn('Failed to save settings to AsyncStorage:', error);
  }
}

export async function clearAllAppData(): Promise<void> {
  await Promise.all([
    AsyncStorage.multiRemove([NOTES_STORAGE_KEY, SETTINGS_STORAGE_KEY]),
    SecureStore.deleteItemAsync(ARCHIVE_PIN_SECURE_KEY).catch(() => {}),
  ]);
}
