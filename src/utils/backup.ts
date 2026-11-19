import type { Note } from '../types/note';

export interface RisalahBackupPayload {
  app: string;
  version: string;
  exportedAt: string;
  notes: Note[];
}

/**
 * Formats backup filename according to PRD: `risalah_backup_YYYY-MM-DD.json`.
 */
export function buildBackupFilename(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `risalah_backup_${yyyy}-${mm}-${dd}.json`;
}

/**
 * Serializes notes to a valid JSON backup file string.
 */
export function serializeBackupPayload(
  notes: Note[],
  now: Date = new Date()
): string {
  const payload: RisalahBackupPayload = {
    app: 'Risalah',
    version: '1.0.0',
    exportedAt: now.toISOString(),
    notes,
  };
  return JSON.stringify(payload, null, 2);
}

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return value === '1' || value.toLowerCase() === 'true';
  }
  return false;
}

function parseTimestamp(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const asNum = Number(value);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;
    const asDate = Date.parse(value);
    if (Number.isFinite(asDate)) return asDate;
  }
  return fallback;
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().replace(/^#+/, ''))
      .filter((t) => t.length > 0);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const maybeArray = JSON.parse(value);
      if (Array.isArray(maybeArray)) {
        return parseTags(maybeArray);
      }
    } catch {
      return value
        .split(',')
        .map((t) => t.trim().replace(/^#+/, ''))
        .filter((t) => t.length > 0);
    }
  }
  return [];
}

/**
 * Parses a JSON backup string (supports both `{ notes: [...] }` and raw `[...]`,
 * as well as camelCase mobile & snake_case web schemas) and assigns guaranteed-unique
 * new IDs so imported notes never collide with existing notes.
 */
export function parseAndReindexBackup(
  rawJson: string,
  existingNotes: Note[],
  nowMs: number = Date.now()
): Note[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Invalid JSON file format');
  }

  let rawArray: unknown[];
  if (Array.isArray(parsed)) {
    rawArray = parsed;
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as Record<string, unknown>).notes)
  ) {
    rawArray = (parsed as Record<string, unknown>).notes as unknown[];
  } else {
    throw new Error('Backup file does not contain a valid notes list');
  }

  const maxExistingId = existingNotes.reduce(
    (max, n) => (n.id > max ? n.id : max),
    0
  );
  let nextId = Math.max(nowMs, maxExistingId) + 1;

  const imported: Note[] = [];
  for (const item of rawArray) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;

    const title = typeof rec.title === 'string' ? rec.title : '';
    const content = typeof rec.content === 'string' ? rec.content : '';
    const tags = parseTags(rec.tags);
    const isPinned = parseBool(rec.isPinned ?? rec.is_pinned);
    const isArchived = parseBool(rec.isArchived ?? rec.is_archived);
    const isDeleted = parseBool(rec.isDeleted ?? rec.is_deleted);
    const rawSort = rec.sortOrder ?? rec.sort_order;
    const sortOrder =
      typeof rawSort === 'number' && Number.isFinite(rawSort)
        ? rawSort
        : Number(rawSort) || 0;
    const createdAt = parseTimestamp(rec.createdAt ?? rec.created_at, nowMs);
    const updatedAt = parseTimestamp(rec.updatedAt ?? rec.updated_at, createdAt);

    imported.push({
      id: nextId,
      title,
      content,
      tags,
      isPinned,
      isArchived,
      isDeleted,
      sortOrder,
      createdAt,
      updatedAt,
    });
    nextId += 1;
  }

  return imported;
}
