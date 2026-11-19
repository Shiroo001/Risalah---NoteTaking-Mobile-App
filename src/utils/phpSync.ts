import type { Note, Settings } from '../types/note';

export type PhpEndpoint =
  | 'get_notes.php'
  | 'save_note.php'
  | 'delete_note.php'
  | 'settings.php';

export interface SyncSummary {
  mergedNotes: Note[];
  pulledCount: number;
  pushedCount: number;
  deletedCount: number;
  remoteTheme?: Settings['theme'];
}

const REQUEST_TIMEOUT_MS = 8000;

/**
 * Normalizes a LAN PHP API base URL (e.g. `http://192.168.1.10/Risalah/api/`).
 * Ensures http/https scheme and trailing slash.
 */
export function normalizeSyncBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  return withScheme.endsWith('/') ? withScheme : `${withScheme}/`;
}

export function buildPhpEndpointUrl(
  baseUrl: string,
  endpoint: PhpEndpoint
): string {
  const norm = normalizeSyncBaseUrl(baseUrl);
  if (!norm) throw new Error('Sync server URL is empty');
  return `${norm}${endpoint}`;
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
  return false;
}

function parseNum(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
    const parsedDate = Date.parse(v);
    if (Number.isFinite(parsedDate)) return parsedDate;
  }
  return fallback;
}

function parseTagsField(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().replace(/^#+/, ''))
      .filter(Boolean);
  }
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parseTagsField(parsed);
    } catch {
      return v
        .split(',')
        .map((t) => t.trim().replace(/^#+/, ''))
        .filter(Boolean);
    }
  }
  return [];
}

function normalizeRemoteNote(rec: Record<string, unknown>): Note {
  const now = Date.now();
  const createdAt = parseNum(rec.createdAt ?? rec.created_at, now);
  return {
    id: parseNum(rec.id, now),
    title: typeof rec.title === 'string' ? rec.title : '',
    content: typeof rec.content === 'string' ? rec.content : '',
    tags: parseTagsField(rec.tags),
    isPinned: parseBool(rec.isPinned ?? rec.is_pinned),
    isArchived: parseBool(rec.isArchived ?? rec.is_archived),
    isDeleted: parseBool(rec.isDeleted ?? rec.is_deleted),
    sortOrder: Number(rec.sortOrder ?? rec.sort_order) || 0,
    createdAt,
    updatedAt: parseNum(rec.updatedAt ?? rec.updated_at, createdAt),
  };
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Server responded with HTTP ${res.status}`);
    }
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Connection timed out (check LAN Wi-Fi & server URL)');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRemoteNotes(baseUrl: string): Promise<Note[]> {
  const url = buildPhpEndpointUrl(baseUrl, 'get_notes.php');
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const payload = await res.json();
  const rawList: unknown[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.notes)
    ? payload.notes
    : Array.isArray(payload?.data)
    ? payload.data
    : [];

  return rawList
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map(normalizeRemoteNote);
}

export async function pushRemoteNote(baseUrl: string, note: Note): Promise<void> {
  const url = buildPhpEndpointUrl(baseUrl, 'save_note.php');
  await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      ...note,
      is_pinned: note.isPinned ? 1 : 0,
      is_archived: note.isArchived ? 1 : 0,
      is_deleted: note.isDeleted ? 1 : 0,
      sort_order: note.sortOrder,
      created_at: note.createdAt,
      updated_at: note.updatedAt,
    }),
  });
}

export async function deleteRemoteNote(
  baseUrl: string,
  noteId: number,
  permanent = false
): Promise<void> {
  const url = buildPhpEndpointUrl(baseUrl, 'delete_note.php');
  await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ id: noteId, permanent }),
  });
}

export async function syncRemoteSettings(
  baseUrl: string,
  settings: Pick<Settings, 'theme'>
): Promise<{ theme?: Settings['theme'] }> {
  const url = buildPhpEndpointUrl(baseUrl, 'settings.php');
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ theme: settings.theme }),
  });
  try {
    const json = await res.json();
    const valid = ['light', 'paper', 'cobalt', 'dark', 'midnight'];
    const theme = valid.includes(json?.theme)
      ? (json.theme as Settings['theme'])
      : undefined;
    return { theme };
  } catch {
    return {};
  }
}

/**
 * Merges local and remote notes by ID, keeping the newest `updatedAt` record
 * while preserving local-only mobile fields (`style`, `attachments`).
 */
export function mergeNotesByFreshness(
  localNotes: Note[],
  remoteNotes: Note[]
): {
  merged: Note[];
  pulledCount: number;
  toPush: Note[];
  toDelete: Note[];
} {
  const localMap = new Map<number, Note>(localNotes.map((n) => [n.id, n]));
  const remoteMap = new Map<number, Note>(remoteNotes.map((n) => [n.id, n]));
  const mergedMap = new Map<number, Note>();

  let pulledCount = 0;
  const toPush: Note[] = [];
  const toDelete: Note[] = [];

  for (const [id, remote] of remoteMap.entries()) {
    const local = localMap.get(id);
    if (!local) {
      mergedMap.set(id, remote);
      pulledCount += 1;
    } else if (remote.updatedAt > local.updatedAt) {
      mergedMap.set(id, {
        ...remote,
        attachments: local.attachments,
      });
      pulledCount += 1;
    } else {
      mergedMap.set(id, local);
      if (local.updatedAt > remote.updatedAt) {
        if (local.isDeleted) {
          toDelete.push(local);
        } else {
          toPush.push(local);
        }
      }
    }
  }

  for (const [id, local] of localMap.entries()) {
    if (!remoteMap.has(id)) {
      mergedMap.set(id, local);
      if (local.isDeleted) {
        toDelete.push(local);
      } else {
        toPush.push(local);
      }
    }
  }

  return {
    merged: Array.from(mergedMap.values()),
    pulledCount,
    toPush,
    toDelete,
  };
}

export async function syncAllWithPhpBackend(
  baseUrl: string,
  localNotes: Note[],
  settings: Settings
): Promise<SyncSummary> {
  const remoteNotes = await fetchRemoteNotes(baseUrl);
  const { merged, pulledCount, toPush, toDelete } = mergeNotesByFreshness(
    localNotes,
    remoteNotes
  );

  for (const note of toPush) {
    await pushRemoteNote(baseUrl, note);
  }
  for (const note of toDelete) {
    await deleteRemoteNote(baseUrl, note.id, false);
  }

  const remoteSettings = await syncRemoteSettings(baseUrl, {
    theme: settings.theme,
  });

  return {
    mergedNotes: merged,
    pulledCount,
    pushedCount: toPush.length,
    deletedCount: toDelete.length,
    remoteTheme: remoteSettings.theme,
  };
}
