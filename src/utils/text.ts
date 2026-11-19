import type { Note, ViewMode } from '../types/note';

const ID_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

/**
 * Strips HTML tags for clean preview rendering (compat with web-imported notes).
 */
export function stripHtml(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(div|p|li|h[1-6]|tr)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\u200B/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Produces a clean 2-line card preview for both WYSIWYG HTML (checklists/lists)
 * and legacy plain-text/Markdown notes.
 */
export function formatNotePreview(content: string): string {
  if (!content) return '';
  const withCheckSymbols = content
    .replace(/<li[^>]*data-checked=["']true["'][^>]*>/gi, '☑ ')
    .replace(/<li[^>]*data-checked=["']false["'][^>]*>/gi, '☐ ');
  const plain = stripHtml(withCheckSymbols);
  return plain
    .replace(/(^|\s)[-*]\s+\[[xX]\]\s*/g, '$1☑ ')
    .replace(/(^|\s)[-*]\s+\[\s\]\s*/g, '$1☐ ')
    .trim();
}

/**
 * Normalizes a URL, prepending `https://` if no scheme is given.
 */
export function normalizeLinkUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) || trimmed.startsWith('mailto:')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Formats timestamp in Indonesian local format: "DD MMM YYYY, HH:mm".
 */
export function formatDateId(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = ID_MONTHS[date.getMonth()] ?? 'Jan';
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

/**
 * Normalizes a raw tag string: strips leading '#', trims, replaces internal whitespace with '-'.
 */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Checks whether a note has any meaningful user content (text, tags, or images).
 */
export function isNoteEmpty(
  note: Pick<Note, 'title' | 'content' | 'tags' | 'attachments'>
): boolean {
  const hasInlineImage = /<img\b/i.test(note.content);
  return (
    note.title.trim().length === 0 &&
    stripHtml(note.content).length === 0 &&
    !hasInlineImage &&
    note.tags.length === 0 &&
    (!note.attachments || note.attachments.length === 0)
  );
}

/**
 * Sorting rule: isPinned desc -> sortOrder asc -> updatedAt desc.
 */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return b.updatedAt - a.updatedAt;
  });
}

/**
 * Filters notes by viewMode, excludes soft-deleted notes, applies case-insensitive
 * search across title, content, and #tags, and sorts results.
 */
export function filterAndSortNotes(
  notes: Note[],
  query: string,
  viewMode: Exclude<ViewMode, 'trash'>
): Note[] {
  const wantArchived = viewMode === 'archive';
  const normalizedQuery = query.trim().toLowerCase();
  const tagQuery = normalizedQuery.startsWith('#')
    ? normalizedQuery.slice(1)
    : normalizedQuery;

  const filtered = notes.filter((note) => {
    if (note.isDeleted || note.isArchived !== wantArchived) return false;
    if (!normalizedQuery) return true;

    return (
      note.title.toLowerCase().includes(normalizedQuery) ||
      stripHtml(note.content).toLowerCase().includes(normalizedQuery) ||
      note.tags.some((tag) => {
        const lower = tag.toLowerCase();
        return lower.includes(tagQuery) || `#${lower}`.includes(normalizedQuery);
      })
    );
  });

  return sortNotes(filtered);
}
