function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Checks whether stored note content is already structured rich HTML
 * (as opposed to plain text or Phase 1/2 lightweight Markdown).
 */
export function isRichHtml(content: string): boolean {
  if (!content) return false;
  return /<(?:div|p|ul|ol|li|span|b|strong|i|em|s|strike|font|a|img|br)\b/i.test(
    content
  );
}

/**
 * Converts legacy inline Markdown tokens (`**bold**`, `*italic*`, `~~strike~~`,
 * `<u>underline</u>`, `[label](url)`) to semantic HTML.
 */
function convertInlineMarkdownToHtml(raw: string): string {
  const placeholders: string[] = [];
  const withPlaceholders = raw.replace(/<u>([\s\S]*?)<\/u>/gi, (_m, inner) => {
    const idx = placeholders.length;
    placeholders.push(`<u>${escapeHtml(inner)}</u>`);
    return `\u0000U${idx}\u0000`;
  });

  let html = escapeHtml(withPlaceholders);

  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    '<a href="$2">$1</a>'
  );
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  html = html.replace(/\*([^*]+)\*/g, '<i>$1</i>');

  html = html.replace(
    /\u0000U(\d+)\u0000/g,
    (_m, idx) => placeholders[Number(idx)] ?? ''
  );
  return html;
}

const CHECK_RE = /^(\s*)[-*]\s+\[([ xX])\](?:\s(.*)|$)$/;
const BULLET_RE = /^(\s*)[-*•○■]\s+(.*)$/;
const ORDERED_RE = /^(\s*)(?:\d+|[a-z]+|[ivxlcdm]+)\.\s+(.*)$/;

function spacesToLevel(spaces: string): number {
  const len = spaces.replace(/\t/g, '  ').length;
  return Math.max(0, Math.min(4, Math.floor(len / 2)));
}

/**
 * Converts plain-text / Fase 1-2 Markdown notes into clean WYSIWYG HTML,
 * while passing existing rich HTML notes through verbatim.
 */
export function convertNoteContentToHtml(content: string): string {
  if (!content || !content.trim()) return '';
  if (isRichHtml(content)) return content;

  const rawLines = content.replace(/\r\n?/g, '\n').split('\n');
  const parsed = rawLines.map((line) => {
    const cm = line.match(CHECK_RE);
    if (cm) {
      return {
        kind: 'checklist' as const,
        level: spacesToLevel(cm[1]),
        checked: cm[2].toLowerCase() === 'x',
        text: cm[3] ?? '',
      };
    }
    const bm = line.match(BULLET_RE);
    if (bm) {
      return {
        kind: 'bullet' as const,
        level: spacesToLevel(bm[1]),
        checked: false,
        text: bm[2] ?? '',
      };
    }
    const om = line.match(ORDERED_RE);
    if (om) {
      return {
        kind: 'ordered' as const,
        level: spacesToLevel(om[1]),
        checked: false,
        text: om[2] ?? '',
      };
    }
    return { kind: 'text' as const, level: 0, checked: false, text: line };
  });

  const out: string[] = [];
  let i = 0;

  while (i < parsed.length) {
    const line = parsed[i];

    if (line.kind === 'checklist') {
      const items: string[] = [];
      while (i < parsed.length && parsed[i].kind === 'checklist') {
        const cur = parsed[i];
        const inner = convertInlineMarkdownToHtml(cur.text) || '<br>';
        items.push(
          `<li data-checked="${cur.checked ? 'true' : 'false'}">${inner}</li>`
        );
        i += 1;
      }
      out.push(`<ul class="risalah-checklist">${items.join('')}</ul>`);
      continue;
    }

    if (line.kind === 'bullet' || line.kind === 'ordered') {
      const listKind = line.kind;
      const tag = listKind === 'ordered' ? 'ol' : 'ul';
      let currentLevel = 0;
      let html = `<${tag}>`;

      while (i < parsed.length && parsed[i].kind === listKind) {
        const cur = parsed[i];
        while (currentLevel < cur.level) {
          html += `<${tag}>`;
          currentLevel += 1;
        }
        while (currentLevel > cur.level) {
          html += `</${tag}>`;
          currentLevel -= 1;
        }
        const inner = convertInlineMarkdownToHtml(cur.text) || '<br>';
        html += `<li>${inner}</li>`;
        i += 1;
      }

      while (currentLevel > 0) {
        html += `</${tag}>`;
        currentLevel -= 1;
      }
      html += `</${tag}>`;
      out.push(html);
      continue;
    }

    const inner = convertInlineMarkdownToHtml(line.text);
    out.push(`<div>${inner || '<br>'}</div>`);
    i += 1;
  }

  return out.join('');
}

/**
 * Counts inline <img> elements embedded inside rich HTML note content.
 */
export function countEmbeddedImages(content: string): number {
  if (!content) return 0;
  const matches = content.match(/<img\b[^>]*>/gi);
  return matches ? matches.length : 0;
}

/**
 * Extracts the first embedded <img src="..."> URI for card thumbnails.
 */
export function extractFirstImageSrc(content: string): string | null {
  if (!content) return null;
  const match = content.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

/**
 * Counts words in plain or HTML note content.
 */
export function countWords(content: string): number {
  if (!content) return 0;
  const plain = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u200B/g, '')
    .trim();
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

/**
 * Builds a clean inline resizable image HTML snippet for insertion into the editor.
 */
export function buildResizableImageHtml(
  dataUri: string,
  kind: 'image' | 'sketch',
  initialWidth = 240
): string {
  const safeUri = dataUri.replace(/"/g, '&quot;');
  const safeType = kind === 'sketch' ? 'sketch' : 'image';
  const w = Math.max(80, Math.min(340, Math.round(initialWidth)));
  return (
    `<div class="risalah-img-block" contenteditable="false" data-align="center" data-width="${w}" data-type="${safeType}">` +
    `<div class="risalah-img-frame" style="width:${w}px;">` +
    `<img src="${safeUri}" draggable="false" />` +
    `</div></div><div><br></div>`
  );
}
