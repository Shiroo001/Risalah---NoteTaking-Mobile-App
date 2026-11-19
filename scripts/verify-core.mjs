import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildBackupFilename,
  parseAndReindexBackup,
  serializeBackupPayload,
} from '../src/utils/backup.ts';
import {
  hexToHsv,
  HIGHLIGHT_COLOR_PRESETS,
  hsvToHex,
  normalizeHex,
  TEXT_COLOR_PRESETS,
} from '../src/utils/color.ts';
import {
  buildResizableImageHtml,
  convertNoteContentToHtml,
  countEmbeddedImages,
  countWords,
  extractFirstImageSrc,
  isRichHtml,
} from '../src/utils/htmlBridge.ts';
import { formatNumber, parseMathLines } from '../src/utils/mathEngine.js';
import {
  buildPhpEndpointUrl,
  mergeNotesByFreshness,
  normalizeSyncBaseUrl,
} from '../src/utils/phpSync.ts';
import {
  computeDragDropOffset,
  computeDragTargetIndex,
  findCardIndexAtY,
  reorderVisibleNotes,
} from '../src/utils/reorder.ts';
import {
  renderCroppedSketchPng,
  uint8ArrayToBase64,
} from '../src/utils/sketchPng.ts';
import {
  filterAndSortNotes,
  formatDateId,
  formatNotePreview,
  isNoteEmpty,
  normalizeLinkUrl,
  normalizeTag,
  sortNotes,
  stripHtml,
} from '../src/utils/text.ts';

let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  PASS: ${name}`);
}

console.log('Running Risalah core verification...');

test('mathEngine: variables, expressions, currency/units, and div-by-zero edge cases', () => {
  const results = parseMathLines('kopi = 18000\nroti = 12000\nkopi * 2 + roti');
  assert.equal(results.length, 3);
  assert.equal(results[2].result, 48000);
  assert.equal(formatNumber(results[2].result), '48,000');

  assert.equal(parseMathLines('10 / 0')[0].result, '∞');
  assert.equal(parseMathLines('-10 / 0')[0].result, '-∞');
  assert.equal(parseMathLines('0 / 0')[0].result, 'Undefined');

  const mixed = parseMathLines('$25000 × 3\n€100 ÷ 4\n5 kg * 12000\n2 hours + 30 mins');
  assert.deepEqual(mixed.map((m) => m.result), [75000, 25, 60000, 32]);
  assert.equal(formatNumber(1 / 3), '0.3333');
});

test('Sorting rule: isPinned desc -> sortOrder asc -> updatedAt desc', () => {
  const sample = [
    { id: 1, title: 'Old', content: '', tags: [], isPinned: false, isArchived: false, isDeleted: false, sortOrder: 0, createdAt: 1, updatedAt: 100 },
    { id: 2, title: 'New', content: '', tags: [], isPinned: false, isArchived: false, isDeleted: false, sortOrder: 0, createdAt: 1, updatedAt: 200 },
    { id: 3, title: 'Pin 2', content: '', tags: [], isPinned: true, isArchived: false, isDeleted: false, sortOrder: 2, createdAt: 1, updatedAt: 300 },
    { id: 4, title: 'Pin 1', content: '', tags: [], isPinned: true, isArchived: false, isDeleted: false, sortOrder: 1, createdAt: 1, updatedAt: 50 },
  ];
  assert.deepEqual(sortNotes(sample).map((n) => n.id), [4, 3, 2, 1]);
});

test('Search filters by title, content, and #tag, respecting archive & soft-delete', () => {
  const sample = [
    { id: 1, title: 'Belanja Bulanan', content: '<div>kopi</div>', tags: ['keuangan'], isPinned: false, isArchived: false, isDeleted: false, sortOrder: 0, createdAt: 1, updatedAt: 100 },
    { id: 2, title: 'Ide Proyek', content: '<b>Risalah</b> mobile', tags: ['kerja-keras'], isPinned: false, isArchived: false, isDeleted: false, sortOrder: 0, createdAt: 1, updatedAt: 200 },
    { id: 3, title: 'Arsip', content: 'kopi lama', tags: ['keuangan'], isPinned: false, isArchived: true, isDeleted: false, sortOrder: 0, createdAt: 1, updatedAt: 300 },
    { id: 4, title: 'Trash', content: 'kopi hapus', tags: ['keuangan'], isPinned: false, isArchived: false, isDeleted: true, sortOrder: 0, createdAt: 1, updatedAt: 400 },
  ];
  assert.deepEqual(filterAndSortNotes(sample, 'kopi', 'active').map((n) => n.id), [1]);
  assert.deepEqual(filterAndSortNotes(sample, '#kerja', 'active').map((n) => n.id), [2]);
  assert.deepEqual(filterAndSortNotes(sample, 'keuangan', 'archive').map((n) => n.id), [3]);
});

test('text helpers: normalizeTag, normalizeLinkUrl, stripHtml, formatNotePreview, isNoteEmpty, formatDateId', () => {
  assert.equal(normalizeTag('  #kerja  penting  '), 'kerja-penting');
  assert.equal(normalizeLinkUrl('youtube.com'), 'https://youtube.com');
  assert.equal(normalizeLinkUrl('https://risalah.app'), 'https://risalah.app');
  assert.equal(stripHtml('<p>Halo <b>Dunia</b>&nbsp;123</p>'), 'Halo Dunia 123');
  assert.equal(
    formatNotePreview('<ul class="risalah-checklist"><li data-checked="true">Done</li><li data-checked="false">Todo</li></ul>'),
    '☑ Done ☐ Todo'
  );
  assert.equal(isNoteEmpty({ title: '  ', content: '<div><br></div>', tags: [] }), true);
  assert.equal(isNoteEmpty({ title: '', content: '<img src="x" />', tags: [] }), false);
  assert.equal(formatDateId(new Date(2026, 10, 19, 17, 5).getTime()), '19 Nov 2026, 17:05');
});

test('Backup export filename, JSON serialization, and conflict-free ID reindexing', () => {
  assert.equal(buildBackupFilename(new Date(2026, 10, 19)), 'risalah_backup_2026-11-19.json');
  const existing = [
    { id: 1001, title: 'Existing', content: '<div>abc</div>', tags: ['work'], isPinned: true, isArchived: false, isDeleted: false, sortOrder: 0, createdAt: 1000, updatedAt: 1000 },
  ];
  const reimported = parseAndReindexBackup(serializeBackupPayload(existing), existing, 5000);
  assert.equal(reimported.length, 1);
  assert.notEqual(reimported[0].id, existing[0].id);
  assert.throws(() => parseAndReindexBackup('{bad json', existing));
});

test('Drag-to-reorder updates sortOrder within same pin group and rejects pinned <-> unpinned swaps', () => {
  const notes = [
    { id: 1, title: 'Pin A', content: '', tags: [], isPinned: true, isArchived: false, isDeleted: false, sortOrder: 0, createdAt: 1, updatedAt: 400 },
    { id: 2, title: 'Pin B', content: '', tags: [], isPinned: true, isArchived: false, isDeleted: false, sortOrder: 1, createdAt: 1, updatedAt: 300 },
    { id: 3, title: 'Norm A', content: '', tags: [], isPinned: false, isArchived: false, isDeleted: false, sortOrder: 0, createdAt: 1, updatedAt: 200 },
    { id: 4, title: 'Norm B', content: '', tags: [], isPinned: false, isArchived: false, isDeleted: false, sortOrder: 1, createdAt: 1, updatedAt: 100 },
  ];
  const rejected = reorderVisibleNotes(notes, notes, 1, 2);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.reason, 'cross-pin-boundary');

  const valid = reorderVisibleNotes(notes, notes, 2, 3);
  assert.equal(valid.ok, true);
  if (valid.ok) assert.deepEqual(sortNotes(valid.notes).map((n) => n.id), [1, 2, 4, 3]);

  // Symmetric 50% crossing thresholds for dragging UP and DOWN
  const heights = [100, 100, 100];
  assert.equal(computeDragTargetIndex(heights, 0, 0), 0);
  assert.equal(computeDragTargetIndex(heights, 0, 49), 0);
  assert.equal(computeDragTargetIndex(heights, 0, 50), 1);
  assert.equal(computeDragTargetIndex(heights, 0, 150), 2);
  assert.equal(computeDragTargetIndex(heights, 1, -49), 1);
  assert.equal(computeDragTargetIndex(heights, 1, -50), 0);
  assert.equal(computeDragTargetIndex(heights, 2, -150), 0);
  assert.equal(computeDragDropOffset([100, 120, 80], 0, 2), 200);
  assert.equal(computeDragDropOffset([100, 120, 80], 2, 0), -220);

  // Sibling drag-rail Y hit-testing
  const cellLayouts = [
    { y: 6, height: 110 },
    { y: 116, height: 120 },
    { y: 236, height: 100 },
  ];
  assert.equal(findCardIndexAtY(cellLayouts, 3, 50), 0);
  assert.equal(findCardIndexAtY(cellLayouts, 3, 180), 1);
  assert.equal(findCardIndexAtY(cellLayouts, 3, 300), 2);
  assert.equal(findCardIndexAtY(cellLayouts, 3, 400), -1);
});

test('Color presets (14 text + 14 highlight) and HSV <-> HEX conversion', () => {
  assert.equal(TEXT_COLOR_PRESETS.length, 14);
  assert.equal(HIGHLIGHT_COLOR_PRESETS.length, 14);
  assert.equal(normalizeHex('abc'), '#AABBCC');
  for (const hex of ['#000000', '#FFFFFF', '#EF4444', '#3B82F6', '#10B981', '#445E91']) {
    const hsv = hexToHsv(hex);
    assert.equal(hsvToHex(hsv.h, hsv.s, hsv.v), hex);
  }
});

test('Draw Sketch auto-crop PNG binary + dataUri + eraser blank detection', () => {
  assert.equal(uint8ArrayToBase64(new Uint8Array([72, 101, 108, 108, 111])), 'SGVsbG8=');
  const png = renderCroppedSketchPng(
    [{ color: '#EF4444', width: 6, isEraser: false, points: [{ x: 100, y: 200 }, { x: 180, y: 240 }] }],
    { padding: 12, maxDimension: 500 }
  );
  assert.ok(png !== null);
  assert.deepEqual(Array.from(png.bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.dataUri.startsWith('data:image/png;base64,'));
  assert.ok(png.width > 80 && png.width < 220);

  const erased = renderCroppedSketchPng([
    { color: '#000000', width: 4, isEraser: false, points: [{ x: 50, y: 50 }] },
    { color: '#FFFFFF', width: 40, isEraser: true, points: [{ x: 50, y: 50 }] },
  ]);
  assert.equal(erased, null);
});

test('WYSIWYG HTML migration, inline image helpers, and word counter', () => {
  const legacy = '**bold** *italic* ~~strike~~ <u>u</u>\n- [ ] kwie\n1. a\n  1. b\n    1. c';
  assert.equal(isRichHtml(legacy), false);
  const html = convertNoteContentToHtml(legacy);
  assert.ok(html.includes('<b>bold</b>') && html.includes('<i>italic</i>'));
  assert.ok(html.includes('class="risalah-checklist"'));
  assert.ok(html.includes('<ol><li>a</li><ol><li>b</li><ol><li>c</li></ol></ol></ol>'));

  const imgHtml = buildResizableImageHtml('data:image/png;base64,AAAA', 'sketch', 220);
  assert.equal(countEmbeddedImages(imgHtml), 1);
  assert.equal(extractFirstImageSrc(imgHtml), 'data:image/png;base64,AAAA');
  assert.equal(isRichHtml(imgHtml), true);
  assert.equal(convertNoteContentToHtml(imgHtml), imgHtml);
  assert.equal(countWords('<div>Halo <b>Risalah</b> mobile</div>'), 3);

  // Syntax-check embedded WebView editor script & verify initialHtml hydration + touch delegation
  const webViewSrc = readFileSync(new URL('../src/components/RichTextWebView.tsx', import.meta.url), 'utf8');
  const scriptMatch = webViewSrc.match(/<script>\r?\n([\s\S]*?)\r?\n<\/script>/);
  assert.ok(scriptMatch, 'Expected embedded <script> in RichTextWebView.tsx');
  const sampleInitial = JSON.stringify(`${imgHtml}<div></script></div>`)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  const runnableScript = scriptMatch[1]
    .replace('${safeTheme}', '{"bg":"#fff"}')
    .replace('${safeInitialHtml}', sampleInitial)
    .replace(/\\\\u200B/g, '\\u200B');
  // Throws SyntaxError if any JS syntax mistake exists in the embedded template string
  new Function(runnableScript);
  assert.ok(runnableScript.includes("editor.addEventListener('touchend'"), 'Delegated touchend handler missing');
  assert.ok(runnableScript.includes('window.__risalahApi.setHtml('), 'Synchronous initialHtml hydration missing');
  assert.ok(runnableScript.includes('splitStyleAncestors('), 'Nested highlight flattener missing');
  assert.ok(webViewSrc.includes('display: flow-root;'), 'List BFC float-clearance CSS missing');
});

test('LAN PHP Backend Sync URL builder and freshness merge', () => {
  assert.equal(normalizeSyncBaseUrl('192.168.1.5/Risalah/api'), 'http://192.168.1.5/Risalah/api/');
  assert.equal(
    buildPhpEndpointUrl('http://192.168.1.5/Risalah/api', 'get_notes.php'),
    'http://192.168.1.5/Risalah/api/get_notes.php'
  );
  const merged = mergeNotesByFreshness(
    [
      { id: 1, title: 'Old', content: '', tags: [], isPinned: false, isArchived: false, isDeleted: false, sortOrder: 0, createdAt: 1, updatedAt: 100 },
      { id: 2, title: 'Local', content: 'hi', tags: [], isPinned: false, isArchived: false, isDeleted: false, sortOrder: 0, createdAt: 1, updatedAt: 200 },
    ],
    [
      { id: 1, title: 'Newer', content: 'u', tags: [], isPinned: false, isArchived: false, isDeleted: false, sortOrder: 0, createdAt: 1, updatedAt: 300 },
    ]
  );
  assert.equal(merged.merged.length, 2);
  assert.equal(merged.pulledCount, 1);
  assert.equal(merged.toPush.length, 1);
});

console.log(`\nAll ${passed} core checks passed.`);
