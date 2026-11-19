import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

interface WebViewInstance {
  injectJavaScript: (script: string) => void;
}

interface TypedWebViewProps {
  ref?: React.Ref<WebViewInstance>;
  originWhitelist?: string[];
  source: { html: string };
  onMessage?: (event: WebViewMessageEvent) => void;
  style?: StyleProp<ViewStyle>;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  keyboardDisplayRequiresUserAction?: boolean;
  hideKeyboardAccessoryView?: boolean;
  scrollEnabled?: boolean;
  nestedScrollEnabled?: boolean;
  showsVerticalScrollIndicator?: boolean;
  bounces?: boolean;
  overScrollMode?: 'auto' | 'always' | 'never';
}

const NativeWebView = WebView as unknown as React.ComponentType<TypedWebViewProps>;
import type { ThemePalette } from '../theme/tokens';
import type {
  NoteFontFamily,
  NoteFontSize,
  NoteTextAlign,
} from '../types/note';

export interface ActiveFormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  align: NoteTextAlign;
  listType: 'checklist' | 'bullet' | 'ordered' | null;
  listDepth: number;
  hasSelection: boolean;
}

export interface RichTextEditorHandle {
  execInline: (cmd: 'bold' | 'italic' | 'underline' | 'strikeThrough') => void;
  setTextColor: (hex: string) => void;
  setHighlightColor: (hex: string) => void;
  setAlignment: (align: NoteTextAlign) => void;
  setFontFamily: (family: NoteFontFamily) => void;
  setFontSize: (size: NoteFontSize) => void;
  insertLink: (label: string, url: string) => void;
  insertImage: (dataUri: string, kind: 'image' | 'sketch') => void;
  insertText: (text: string, onNewLine?: boolean) => void;
  toggleChecklist: () => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  indent: () => void;
  outdent: () => void;
  setHtml: (html: string) => void;
  focusEditor: () => void;
}

interface RichTextWebViewProps {
  initialHtml: string;
  theme: ThemePalette;
  placeholder?: string;
  onChangeHtml: (html: string, plainText: string) => void;
  onFormatChange: (state: ActiveFormatState) => void;
  onOpenLink: (url: string) => void;
  onImageDeleted?: () => void;
}

function buildEditorHtmlDocument(
  theme: ThemePalette,
  placeholder: string,
  initialHtml: string
): string {
  const safePlaceholder = JSON.stringify(placeholder);
  const safeInitialHtml = JSON.stringify(initialHtml || '')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const safeTheme = JSON.stringify({
    bg: theme.bg,
    text: theme.text,
    muted: theme.muted,
    accent: theme.accent,
    accentLight: theme.accentLight,
    border: theme.border,
    card: theme.card,
    toolbarBg: theme.toolbarBg,
    toolbarBorder: theme.toolbarBorder,
    danger: theme.danger,
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  :root {
    --bg: ${theme.bg};
    --text: ${theme.text};
    --muted: ${theme.muted};
    --accent: ${theme.accent};
    --accentLight: ${theme.accentLight};
    --border: ${theme.border};
    --card: ${theme.card};
    --toolbarBg: ${theme.toolbarBg};
    --toolbarBorder: ${theme.toolbarBorder};
    --danger: ${theme.danger};
  }
  * {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 16.5px;
    line-height: 1.65;
    min-height: 100%;
    width: 100%;
    overflow-x: hidden;
  }
  #editor {
    min-height: 280px;
    padding: 4px 20px 120px 20px;
    outline: none;
    word-wrap: break-word;
    overflow-wrap: break-word;
    color: var(--text);
    caret-color: var(--accent);
  }
  #editor::after {
    content: "";
    display: table;
    clear: both;
  }
  #editor:empty::before {
    content: attr(data-placeholder);
    color: var(--muted);
    opacity: 0.72;
    pointer-events: none;
  }
  #editor span[style*="background"] {
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    border-radius: 2px;
  }
  #editor a {
    color: var(--accent);
    background: var(--accentLight);
    padding: 0 4px;
    border-radius: 2px;
    border-bottom: 1.5px solid var(--accent);
    text-decoration: none;
    font-weight: 600;
  }

  /* Keep lists & indented blocks out of floated images so markers & checkboxes NEVER overlap */
  #editor ol,
  #editor ul,
  #editor blockquote {
    overflow: hidden;
    display: flow-root;
    min-width: 120px;
  }
  #editor ol ol,
  #editor ul ul,
  #editor ol ul,
  #editor ul ol,
  #editor blockquote blockquote {
    min-width: 0;
  }

  /* 5-level nested Ordered Lists: 1. -> a. -> i. -> 1. -> a. (inside marker can never overlap floats!) */
  #editor ol {
    margin: 4px 0;
    padding-left: 4px;
    list-style-type: decimal;
    list-style-position: inside;
  }
  #editor ol ol { padding-left: 20px; list-style-type: lower-alpha; }
  #editor ol ol ol { list-style-type: lower-roman; }
  #editor ol ol ol ol { list-style-type: decimal; }
  #editor ol ol ol ol ol { list-style-type: lower-alpha; }

  /* 5-level nested Unordered Lists: disc -> circle -> square */
  #editor ul:not(.risalah-checklist) {
    margin: 4px 0;
    padding-left: 4px;
    list-style-type: disc;
    list-style-position: inside;
  }
  #editor ul:not(.risalah-checklist) ul { padding-left: 20px; list-style-type: circle; }
  #editor ul:not(.risalah-checklist) ul ul { list-style-type: square; }
  #editor ul:not(.risalah-checklist) ul ul ul { list-style-type: disc; }
  #editor ul:not(.risalah-checklist) ul ul ul ul { list-style-type: circle; }

  /* Interactive Checklists (each item is its own BFC so checkbox never hides behind floats!) */
  #editor ul.risalah-checklist {
    list-style: none;
    margin: 6px 0;
    padding-left: 0;
  }
  #editor ul.risalah-checklist li {
    display: flow-root;
    overflow: hidden;
    position: relative;
    padding-left: 30px;
    margin: 4px 0;
    min-height: 24px;
  }
  #editor ul.risalah-checklist li::before {
    content: "";
    position: absolute;
    left: 2px;
    top: 4px;
    width: 19px;
    height: 19px;
    border-radius: 2px;
    border: 1.5px solid var(--muted);
    background: transparent;
    box-sizing: border-box;
    cursor: pointer;
    transition: background-color 0.14s ease, border-color 0.14s ease, transform 0.12s ease;
  }
  #editor ul.risalah-checklist li[data-checked="true"] {
    text-decoration: line-through;
    color: var(--muted);
    opacity: 0.62;
  }
  #editor ul.risalah-checklist li[data-checked="true"]::before {
    background: var(--accent);
    border-color: var(--accent);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23ffffff' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round' d='M3.2 8.4l3.1 3.1 6.5-6.6'/%3E%3C/svg%3E");
    background-size: 13px 13px;
    background-position: center;
    background-repeat: no-repeat;
  }

  /* Interactive Resizable & Movable Images / Sketches (supports side-by-side rows!) */
  .risalah-img-block {
    user-select: none;
    -webkit-user-select: none;
    position: relative;
    vertical-align: top;
    z-index: 5;
  }
  .risalah-img-block[data-align="center"] {
    display: flex;
    float: none;
    clear: both;
    width: 100%;
    justify-content: center;
    margin: 12px 0;
  }
  .risalah-img-block[data-align="left"] {
    display: inline-block;
    float: left;
    width: auto;
    max-width: 100%;
    margin: 6px 10px 10px 0;
  }
  .risalah-img-block[data-align="right"] {
    display: inline-block;
    float: right;
    width: auto;
    max-width: 100%;
    margin: 6px 0 10px 10px;
  }

  .risalah-img-frame {
    position: relative;
    max-width: 100%;
    min-width: 72px;
    border-radius: 4px;
    border: 1.5px solid var(--border);
    background: #FFFFFF;
    transition: border-color 0.12s ease;
    touch-action: manipulation;
  }
  .risalah-img-block[data-type="image"] .risalah-img-frame {
    background: var(--card);
  }
  .risalah-img-block.selected {
    z-index: 40;
  }
  .risalah-img-block.selected .risalah-img-frame {
    border-color: var(--accent);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
  }
  .risalah-img-frame img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 2px;
    pointer-events: none;
  }

  .risalah-img-controls {
    display: none;
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--toolbarBg);
    border: 1px solid var(--toolbarBorder);
    border-radius: 4px;
    padding: 3px 5px;
    gap: 2px;
    align-items: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 50;
    white-space: nowrap;
    max-width: calc(100vw - 44px);
    overflow-x: auto;
  }
  .risalah-img-block[data-align="left"] .risalah-img-controls {
    left: 0;
    transform: none;
  }
  .risalah-img-block[data-align="right"] .risalah-img-controls {
    left: auto;
    right: 0;
    transform: none;
  }
  .risalah-img-block.selected .risalah-img-controls {
    display: flex;
  }
  .risalah-img-btn {
    border: none;
    background: transparent;
    color: var(--text);
    font-family: Menlo, Consolas, monospace;
    font-size: 12px;
    font-weight: 700;
    min-width: 26px;
    height: 26px;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
  }
  .risalah-img-btn:active {
    background: var(--accentLight);
  }
  .risalah-img-btn.danger {
    color: var(--danger);
  }

  .risalah-drag-pill {
    display: none;
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: rgba(17, 17, 17, 0.84);
    color: #F7F5F0;
    font-family: Menlo, Consolas, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    padding: 4px 8px;
    border-radius: 3px;
    touch-action: none;
    z-index: 25;
  }
  .risalah-img-block.selected .risalah-drag-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .risalah-resize-handle {
    display: none;
    position: absolute;
    width: 24px;
    height: 24px;
    border-radius: 3px;
    background: var(--accent);
    border: 2.5px solid #FFFFFF;
    box-shadow: 0 2px 6px rgba(0,0,0,0.28);
    touch-action: none;
    z-index: 26;
  }
  .risalah-resize-handle.se {
    right: -10px;
    bottom: -10px;
  }
  .risalah-resize-handle.sw {
    left: -10px;
    bottom: -10px;
  }
  .risalah-img-block.selected .risalah-resize-handle {
    display: block;
  }
  .risalah-drop-indicator {
    height: 3px;
    border-radius: 999px;
    background: var(--accent);
    margin: 4px 0;
  }
</style>
</head>
<body>
<div id="editor" contenteditable="true" spellcheck="true" data-placeholder=${safePlaceholder}></div>
<script>
(function() {
  var editor = document.getElementById('editor');
  var savedRange = null;
  var selectedImgBlock = null;
  var suppressNextInput = false;
  var changeTimer = null;

  function post(payload) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  function applyTheme(t) {
    var root = document.documentElement.style;
    Object.keys(t).forEach(function(k) {
      root.setProperty('--' + k, t[k]);
    });
  }

  function saveSelection() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRange = range.cloneRange();
    }
  }

  function hasLiveSelectionInEditor() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    var r = sel.getRangeAt(0);
    return editor.contains(r.commonAncestorContainer);
  }

  function restoreSelection() {
    // CRITICAL: If the live selection is ALREADY inside #editor, do NOT call
    // removeAllRanges()/addRange() — Chromium wipes pending collapsed execCommand
    // states (bold/italic/underline/strike) whenever Selection ranges are replaced!
    if (hasLiveSelectionInEditor()) {
      if (document.activeElement !== editor) {
        editor.focus();
      }
      return;
    }

    if (!savedRange) {
      editor.focus();
      var r = document.createRange();
      r.selectNodeContents(editor);
      r.collapse(false);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      savedRange = r.cloneRange();
      return;
    }
    try {
      editor.focus();
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    } catch (e) {
      editor.focus();
    }
  }

  function getClosestTag(node, tagNames) {
    var cur = node && node.nodeType === 3 ? node.parentElement : node;
    while (cur && cur !== editor) {
      if (tagNames.indexOf(cur.tagName) !== -1) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function getListMeta() {
    var sel = window.getSelection();
    var node = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startContainer : null;
    if (!node || !editor.contains(node)) {
      return { listType: null, listDepth: 0 };
    }
    var cur = node.nodeType === 3 ? node.parentElement : node;
    var depth = 0;
    var listType = null;
    while (cur && cur !== editor) {
      if (cur.tagName === 'UL') {
        depth += 1;
        if (!listType) {
          listType = cur.classList.contains('risalah-checklist') ? 'checklist' : 'bullet';
        }
      } else if (cur.tagName === 'OL') {
        depth += 1;
        if (!listType) listType = 'ordered';
      }
      cur = cur.parentElement;
    }
    return { listType: listType, listDepth: Math.min(5, depth) };
  }

  function emitFormatState() {
    var bold = false, italic = false, underline = false, strike = false;
    var align = 'left';
    try {
      bold = document.queryCommandState('bold');
      italic = document.queryCommandState('italic');
      underline = document.queryCommandState('underline');
      strike = document.queryCommandState('strikeThrough');
      if (document.queryCommandState('justifyCenter')) align = 'center';
      else if (document.queryCommandState('justifyRight')) align = 'right';
    } catch (e) {}
    var lm = getListMeta();
    var sel = window.getSelection();
    var hasSelection = Boolean(sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed);
    post({
      type: 'format',
      state: {
        bold: bold,
        italic: italic,
        underline: underline,
        strike: strike,
        align: align,
        listType: lm.listType,
        listDepth: lm.listDepth,
        hasSelection: hasSelection
      }
    });
  }

  function getCleanHtml() {
    var clone = editor.cloneNode(true);
    var controls = clone.querySelectorAll('.risalah-img-controls, .risalah-resize-handle, .risalah-drag-pill, .risalah-drop-indicator');
    for (var i = 0; i < controls.length; i++) {
      controls[i].remove();
    }
    var blocks = clone.querySelectorAll('.risalah-img-block');
    for (var j = 0; j < blocks.length; j++) {
      blocks[j].classList.remove('selected');
      blocks[j].removeAttribute('data-hydrated');
      blocks[j].style.opacity = '';
    }
    return clone.innerHTML;
  }

  function emitChange(immediate) {
    if (suppressNextInput) return;
    if (changeTimer) clearTimeout(changeTimer);
    var send = function() {
      var html = getCleanHtml();
      var plain = editor.innerText || '';
      post({ type: 'change', html: html, plainText: plain });
    };
    if (immediate) {
      send();
    } else {
      changeTimer = setTimeout(send, 60);
    }
  }

  function deselectImages() {
    if (selectedImgBlock) {
      selectedImgBlock.classList.remove('selected');
      selectedImgBlock = null;
    }
  }

  function selectImageBlock(block) {
    if (selectedImgBlock && selectedImgBlock !== block) {
      selectedImgBlock.classList.remove('selected');
    }
    selectedImgBlock = block;
    block.classList.add('selected');
  }

  function getTopLevelChildren() {
    var arr = [];
    for (var i = 0; i < editor.children.length; i++) {
      var el = editor.children[i];
      if (!el.classList.contains('risalah-drop-indicator')) {
        arr.push(el);
      }
    }
    return arr;
  }

  function isEmptySpacer(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.classList.contains('risalah-img-block')) return false;
    if (el.querySelector('img, ul, ol')) return false;
    var txt = (el.textContent || '').replace(/\\u200B/g, '').trim();
    return txt.length === 0;
  }

  function isFloatedImage(el) {
    if (!el || el.nodeType !== 1 || !el.classList.contains('risalah-img-block')) return false;
    var a = el.getAttribute('data-align');
    return a === 'left' || a === 'right';
  }

  // Collapse any contiguous run of empty <br> spacers between two floated images so left+right share 1 row!
  function collapseSpacersAroundFloatedImages() {
    var children = getTopLevelChildren();
    var i = 0;
    while (i < children.length) {
      if (!isEmptySpacer(children[i])) {
        i += 1;
        continue;
      }
      var start = i;
      while (i < children.length && isEmptySpacer(children[i])) {
        i += 1;
      }
      var prev = start > 0 ? children[start - 1] : null;
      var next = i < children.length ? children[i] : null;
      if (isFloatedImage(prev) && isFloatedImage(next)) {
        for (var k = start; k < i; k++) {
          children[k].remove();
        }
      }
    }
  }

  function ensureTrailingEditableLine() {
    var last = editor.lastElementChild;
    if (last && last.classList.contains('risalah-img-block')) {
      var spacer = document.createElement('div');
      spacer.style.clear = 'both';
      spacer.innerHTML = '<br>';
      editor.appendChild(spacer);
    }
  }

  function setBlockWidth(block, w) {
    var frame = block && block.querySelector('.risalah-img-frame');
    if (!frame) return;
    var maxW = Math.max(120, editor.clientWidth - 44);
    var clamped = Math.max(72, Math.min(maxW, Math.round(w)));
    frame.style.width = clamped + 'px';
    block.setAttribute('data-width', String(clamped));
  }

  function hydrateImageBlock(block) {
    if (!block) return;
    block.removeAttribute('data-hydrated');
    block.setAttribute('contenteditable', 'false');
    var align = block.getAttribute('data-align');
    if (align !== 'left' && align !== 'right' && align !== 'center') {
      block.setAttribute('data-align', 'center');
    }

    var frame = block.querySelector('.risalah-img-frame');
    if (!frame) {
      var img = block.querySelector('img');
      if (!img) return;
      frame = document.createElement('div');
      frame.className = 'risalah-img-frame';
      var savedW = Number(block.getAttribute('data-width')) || 220;
      frame.style.width = savedW + 'px';
      frame.appendChild(img);
      block.appendChild(frame);
    } else if (!frame.style.width) {
      var wAttr = Number(block.getAttribute('data-width')) || 220;
      frame.style.width = wAttr + 'px';
    }

    if (!frame.querySelector('.risalah-img-controls')) {
      var controls = document.createElement('div');
      controls.className = 'risalah-img-controls';
      controls.innerHTML =
        '<button class="risalah-img-btn" data-act="up" type="button">↑</button>' +
        '<button class="risalah-img-btn" data-act="down" type="button">↓</button>' +
        '<button class="risalah-img-btn" data-act="left" type="button">L</button>' +
        '<button class="risalah-img-btn" data-act="center" type="button">C</button>' +
        '<button class="risalah-img-btn" data-act="right" type="button">R</button>' +
        '<button class="risalah-img-btn" data-act="smaller" type="button">−</button>' +
        '<button class="risalah-img-btn" data-act="larger" type="button">+</button>' +
        '<button class="risalah-img-btn danger" data-act="delete" type="button">×</button>';
      frame.appendChild(controls);
    }
    if (!frame.querySelector('.risalah-drag-pill')) {
      var dragPill = document.createElement('div');
      dragPill.className = 'risalah-drag-pill';
      dragPill.textContent = '⋮⋮ Move';
      frame.appendChild(dragPill);
    }
    if (!frame.querySelector('.risalah-resize-handle.se')) {
      var handleSE = document.createElement('div');
      handleSE.className = 'risalah-resize-handle se';
      frame.appendChild(handleSE);
    }
    if (!frame.querySelector('.risalah-resize-handle.sw')) {
      var handleSW = document.createElement('div');
      handleSW.className = 'risalah-resize-handle sw';
      frame.appendChild(handleSW);
    }
  }

  function ensureImagesOutsideLists() {
    var trapped = editor.querySelectorAll('ul .risalah-img-block, ol .risalah-img-block');
    for (var i = 0; i < trapped.length; i++) {
      var block = trapped[i];
      var outerList = null;
      var cur = block.parentElement;
      while (cur && cur !== editor) {
        if (cur.tagName === 'UL' || cur.tagName === 'OL') outerList = cur;
        cur = cur.parentElement;
      }
      if (!outerList || !outerList.parentNode) continue;

      var branch = block;
      while (branch.parentElement && branch.parentElement !== outerList) {
        branch = branch.parentElement;
      }

      var afterList = null;
      var next = branch.nextSibling;
      while (next) {
        var following = next.nextSibling;
        if (!afterList) {
          afterList = document.createElement(outerList.tagName);
          if (outerList.className) afterList.className = outerList.className;
        }
        afterList.appendChild(next);
        next = following;
      }

      var parent = outerList.parentNode;
      parent.insertBefore(block, outerList.nextSibling);
      if (afterList && afterList.childNodes.length > 0) {
        parent.insertBefore(afterList, block.nextSibling);
      }
      if (
        branch !== block &&
        branch.parentNode === outerList &&
        !(branch.textContent || '').replace(/\\u200B/g, '').trim() &&
        !branch.querySelector('img')
      ) {
        branch.remove();
      }
      if (outerList.children.length === 0) {
        outerList.remove();
      }
    }
  }

  function hydrateAllImages() {
    // Self-heal any bare <img> that lost its wrapper block/frame during contenteditable edits
    var imgs = editor.querySelectorAll('img');
    for (var k = 0; k < imgs.length; k++) {
      var img = imgs[k];
      if (!img.closest('.risalah-img-block')) {
        var blk = document.createElement('div');
        blk.className = 'risalah-img-block';
        blk.setAttribute('contenteditable', 'false');
        blk.setAttribute('data-align', 'center');
        blk.setAttribute('data-width', '220');
        blk.setAttribute('data-type', 'image');
        var fr = document.createElement('div');
        fr.className = 'risalah-img-frame';
        fr.style.width = '220px';
        img.setAttribute('draggable', 'false');
        var parent = img.parentNode;
        if (parent) {
          parent.insertBefore(blk, img);
          fr.appendChild(img);
          blk.appendChild(fr);
        }
      }
    }
    ensureImagesOutsideLists();
    var blocks = editor.querySelectorAll('.risalah-img-block');
    for (var i = 0; i < blocks.length; i++) {
      hydrateImageBlock(blocks[i]);
    }
  }

  function resolveTouchTarget(e) {
    var t = e.target;
    if (t && t.nodeType === 3) t = t.parentElement;
    if (t && t.closest && (
      t.closest('.risalah-resize-handle') ||
      t.closest('.risalah-drag-pill') ||
      t.closest('.risalah-img-btn') ||
      t.closest('.risalah-img-frame')
    )) {
      return t;
    }
    var pt = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (pt && document.elementFromPoint) {
      var hit = document.elementFromPoint(pt.clientX, pt.clientY);
      if (hit && hit.nodeType === 3) hit = hit.parentElement;
      if (hit) return hit;
    }
    return t;
  }

  function findImageBlockAt(target, x, y) {
    if (target && target.closest) {
      var directFrame = target.closest('.risalah-img-frame');
      var direct = directFrame && directFrame.closest('.risalah-img-block');
      if (direct && editor.contains(direct)) return direct;
    }
    if (typeof x === 'number' && typeof y === 'number') {
      var hitBox = function(blk) {
        if (!blk) return false;
        var box = blk.querySelector('.risalah-img-frame') || blk;
        var r = box.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      };
      if (selectedImgBlock && editor.contains(selectedImgBlock) && hitBox(selectedImgBlock)) {
        return selectedImgBlock;
      }
      var blocks = editor.querySelectorAll('.risalah-img-block');
      for (var i = 0; i < blocks.length; i++) {
        if (hitBox(blocks[i])) return blocks[i];
      }
    }
    return null;
  }

  function handleImageAction(block, act) {
    if (!block || !act) return;
    var frame = block.querySelector('.risalah-img-frame');
    var curW = (frame && frame.getBoundingClientRect().width) || Number(block.getAttribute('data-width')) || 220;
    var parent = block.parentNode;

    if (act === 'left' || act === 'center' || act === 'right') {
      block.setAttribute('data-align', act);
      ensureImagesOutsideLists();
      if (act === 'left' || act === 'right') {
        collapseSpacersAroundFloatedImages();
        ensureTrailingEditableLine();
      }
      emitChange(true);
    } else if (act === 'smaller') {
      setBlockWidth(block, curW - 32);
      collapseSpacersAroundFloatedImages();
      emitChange(true);
    } else if (act === 'larger') {
      setBlockWidth(block, curW + 32);
      emitChange(true);
    } else if (act === 'up') {
      var prev = block.previousElementSibling;
      if (prev && parent) {
        parent.insertBefore(block, prev);
        collapseSpacersAroundFloatedImages();
        block.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        emitChange(true);
      }
    } else if (act === 'down') {
      var next = block.nextElementSibling;
      if (next && parent) {
        if (next.nextElementSibling) {
          parent.insertBefore(block, next.nextElementSibling);
        } else {
          parent.appendChild(block);
        }
        collapseSpacersAroundFloatedImages();
        ensureTrailingEditableLine();
        block.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        emitChange(true);
      }
    } else if (act === 'delete') {
      deselectImages();
      block.remove();
      emitChange(true);
      post({ type: 'imageDeleted' });
    }
  }

  // Delegated touch + click controller for all image blocks (prevents Android contenteditable from swallowing taps!)
  var imgGesture = null;
  var lastImageTouchAt = 0;

  function finishImageDrag(g) {
    if (!g || g.kind !== 'drag') return;
    g.block.style.opacity = '';
    if (g.dropIndicator && g.dropIndicator.parentNode) {
      g.dropIndicator.parentNode.insertBefore(g.block, g.dropIndicator);
      g.dropIndicator.remove();
    }
    g.dropIndicator = null;
    collapseSpacersAroundFloatedImages();
    ensureTrailingEditableLine();
    emitChange(true);
  }

  editor.addEventListener('touchstart', function(e) {
    var target = resolveTouchTarget(e);

    // 2-finger pinch-to-resize on any image block
    if (e.touches.length === 2) {
      var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      var pinchBlock = findImageBlockAt(target, midX, midY);
      if (pinchBlock) {
        e.preventDefault();
        e.stopPropagation();
        hydrateImageBlock(pinchBlock);
        selectImageBlock(pinchBlock);
        var pFrame = pinchBlock.querySelector('.risalah-img-frame');
        var pdx = e.touches[0].clientX - e.touches[1].clientX;
        var pdy = e.touches[0].clientY - e.touches[1].clientY;
        imgGesture = {
          kind: 'pinch',
          block: pinchBlock,
          startDist: Math.sqrt(pdx * pdx + pdy * pdy) || 1,
          startW: pFrame ? pFrame.getBoundingClientRect().width : 220
        };
      }
      return;
    }

    if (e.touches.length !== 1) return;
    var t0 = e.touches[0];

    var handle = target && target.closest ? target.closest('.risalah-resize-handle') : null;
    if (handle) {
      var rBlock = handle.closest('.risalah-img-block');
      var rFrame = rBlock && rBlock.querySelector('.risalah-img-frame');
      if (rBlock && rFrame) {
        e.preventDefault();
        e.stopPropagation();
        selectImageBlock(rBlock);
        imgGesture = {
          kind: 'resize',
          block: rBlock,
          dir: handle.classList.contains('se') ? 'se' : 'sw',
          startX: t0.clientX,
          startW: rFrame.getBoundingClientRect().width
        };
      }
      return;
    }

    var pill = target && target.closest ? target.closest('.risalah-drag-pill') : null;
    if (pill) {
      var dBlock = pill.closest('.risalah-img-block');
      if (dBlock) {
        e.preventDefault();
        e.stopPropagation();
        selectImageBlock(dBlock);
        dBlock.style.opacity = '0.55';
        var indicator = document.createElement('div');
        indicator.className = 'risalah-drop-indicator';
        imgGesture = {
          kind: 'drag',
          block: dBlock,
          startX: t0.clientX,
          dropIndicator: indicator
        };
      }
      return;
    }

    var btn = target && target.closest ? target.closest('.risalah-img-btn') : null;
    if (btn) {
      var bBlock = btn.closest('.risalah-img-block');
      if (bBlock) {
        e.stopPropagation();
        imgGesture = {
          kind: 'btn',
          block: bBlock,
          act: btn.getAttribute('data-act'),
          startX: t0.clientX,
          startY: t0.clientY,
          moved: false
        };
      }
      return;
    }

    if (target && target.closest && target.closest('.risalah-img-controls')) {
      imgGesture = null;
      return;
    }

    var tapBlock = findImageBlockAt(target, t0.clientX, t0.clientY);
    if (tapBlock) {
      imgGesture = {
        kind: 'tap',
        block: tapBlock,
        startX: t0.clientX,
        startY: t0.clientY,
        moved: false
      };
      return;
    }

    imgGesture = null;
  }, { passive: false });

  editor.addEventListener('touchmove', function(e) {
    if (!imgGesture) return;

    if (imgGesture.kind === 'resize') {
      e.preventDefault();
      e.stopPropagation();
      var dx = e.touches[0].clientX - imgGesture.startX;
      var align = imgGesture.block.getAttribute('data-align') || 'center';
      var mult = align === 'center' ? 2 : 1;
      var delta = imgGesture.dir === 'se' ? dx * mult : -dx * mult;
      setBlockWidth(imgGesture.block, imgGesture.startW + delta);
      return;
    }

    if (imgGesture.kind === 'drag') {
      e.preventDefault();
      e.stopPropagation();
      var touch = e.touches[0];
      var relX = touch.clientX / Math.max(1, window.innerWidth);
      if (Math.abs(touch.clientX - imgGesture.startX) > 35) {
        if (relX < 0.34) imgGesture.block.setAttribute('data-align', 'left');
        else if (relX > 0.66) imgGesture.block.setAttribute('data-align', 'right');
        else imgGesture.block.setAttribute('data-align', 'center');
      }

      var children = getTopLevelChildren();
      var dropTarget = null;
      var dropBefore = true;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child === imgGesture.block) continue;
        var rect = child.getBoundingClientRect();
        var mid = rect.top + rect.height / 2;
        if (touch.clientY < mid) {
          dropTarget = child;
          dropBefore = true;
          break;
        }
        dropTarget = child;
        dropBefore = false;
      }

      if (imgGesture.dropIndicator && dropTarget) {
        if (dropBefore) {
          editor.insertBefore(imgGesture.dropIndicator, dropTarget);
        } else if (dropTarget.nextElementSibling) {
          editor.insertBefore(imgGesture.dropIndicator, dropTarget.nextElementSibling);
        } else {
          editor.appendChild(imgGesture.dropIndicator);
        }
      }
      return;
    }

    if (imgGesture.kind === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      e.stopPropagation();
      var pdx = e.touches[0].clientX - e.touches[1].clientX;
      var pdy = e.touches[0].clientY - e.touches[1].clientY;
      var curDist = Math.sqrt(pdx * pdx + pdy * pdy);
      setBlockWidth(imgGesture.block, imgGesture.startW * (curDist / imgGesture.startDist));
      return;
    }

    if (imgGesture.kind === 'tap' || imgGesture.kind === 'btn') {
      if (e.touches.length !== 1) {
        imgGesture.moved = true;
        return;
      }
      var mt = e.touches[0];
      if (Math.abs(mt.clientX - imgGesture.startX) > 12 || Math.abs(mt.clientY - imgGesture.startY) > 12) {
        imgGesture.moved = true;
      }
    }
  }, { passive: false });

  editor.addEventListener('touchend', function(e) {
    if (!imgGesture) return;
    var g = imgGesture;
    imgGesture = null;

    if (g.kind === 'resize') {
      e.stopPropagation();
      collapseSpacersAroundFloatedImages();
      emitChange(true);
    } else if (g.kind === 'drag') {
      finishImageDrag(g);
    } else if (g.kind === 'pinch') {
      collapseSpacersAroundFloatedImages();
      emitChange(true);
    } else if (g.kind === 'btn') {
      if (!g.moved) {
        e.preventDefault();
        e.stopPropagation();
        lastImageTouchAt = Date.now();
        handleImageAction(g.block, g.act);
      }
    } else if (g.kind === 'tap') {
      if (!g.moved) {
        e.preventDefault();
        e.stopPropagation();
        lastImageTouchAt = Date.now();
        hydrateImageBlock(g.block);
        if (document.activeElement === editor) {
          editor.blur();
        }
        if (selectedImgBlock === g.block) {
          deselectImages();
        } else {
          selectImageBlock(g.block);
        }
      }
    }
  }, { passive: false });

  editor.addEventListener('touchcancel', function() {
    if (imgGesture && imgGesture.kind === 'drag') {
      finishImageDrag(imgGesture);
    }
    imgGesture = null;
  });

  // Click handling for image fallback, checkboxes, links & deselecting images
  editor.addEventListener('click', function(e) {
    var target = e.target && e.target.nodeType === 3 ? e.target.parentElement : e.target;
    var hitBtn = target && target.closest ? target.closest('.risalah-img-btn') : null;
    var hitBlock = findImageBlockAt(target, e.clientX, e.clientY);

    if (hitBtn || hitBlock) {
      if (Date.now() - lastImageTouchAt < 500) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (hitBtn) {
        var bBlk = hitBtn.closest('.risalah-img-block');
        e.preventDefault();
        e.stopPropagation();
        if (bBlk) handleImageAction(bBlk, hitBtn.getAttribute('data-act'));
        return;
      }
      if (target && target.closest && target.closest('.risalah-img-controls, .risalah-resize-handle, .risalah-drag-pill')) {
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      hydrateImageBlock(hitBlock);
      if (selectedImgBlock === hitBlock) {
        deselectImages();
      } else {
        selectImageBlock(hitBlock);
      }
      return;
    }

    var link = target && target.closest ? target.closest('a') : null;
    if (link && link.href && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      post({ type: 'openLink', url: link.href });
      return;
    }

    // Deselect images when tapping text
    deselectImages();

    // Checklist checkbox click (left 32px zone of <li>)
    var li = target && target.closest ? target.closest('ul.risalah-checklist > li') : null;
    if (li) {
      var rect = li.getBoundingClientRect();
      if (e.clientX <= rect.left + 32) {
        e.preventDefault();
        var checked = li.getAttribute('data-checked') === 'true';
        li.setAttribute('data-checked', checked ? 'false' : 'true');
        emitChange(true);
        return;
      }
    }

    // Tapping link in edit mode also opens if tapped directly
    if (link && link.href) {
      var sel = window.getSelection();
      if (sel && sel.isCollapsed) {
        post({ type: 'openLink', url: link.href });
      }
    }
  });

  // Checklist Enter behavior: Enter on empty checklist exits checklist; Enter on non-empty creates unchecked item
  editor.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var li = getClosestTag(sel.getRangeAt(0).startContainer, ['LI']);
    if (!li) return;
    var ul = li.parentElement;
    if (!ul || !ul.classList.contains('risalah-checklist')) return;

    var text = (li.textContent || '').replace(/\\u200B/g, '').trim();
    if (text.length === 0) {
      e.preventDefault();
      var p = document.createElement('div');
      p.innerHTML = '<br>';
      if (ul.children.length <= 1) {
        ul.parentNode.replaceChild(p, ul);
      } else {
        ul.parentNode.insertBefore(p, ul.nextSibling);
        li.remove();
      }
      var r = document.createRange();
      r.setStart(p, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      saveSelection();
      emitFormatState();
      emitChange(true);
      return;
    }

    // After default Enter split, ensure newly created checklist item starts unchecked
    setTimeout(function() {
      var curSel = window.getSelection();
      if (curSel && curSel.rangeCount > 0) {
        var newLi = getClosestTag(curSel.getRangeAt(0).startContainer, ['LI']);
        if (newLi && newLi.parentElement && newLi.parentElement.classList.contains('risalah-checklist')) {
          newLi.setAttribute('data-checked', 'false');
        }
      }
      emitChange(true);
    }, 0);
  });

  editor.addEventListener('input', function() {
    saveSelection();
    emitFormatState();
    emitChange(false);
  });

  document.addEventListener('selectionchange', function() {
    saveSelection();
    emitFormatState();
  });

  function unwrapEmptySpan(el) {
    if (!el || el.tagName !== 'SPAN' || !el.parentNode) return;
    if (!el.getAttribute('style') || el.getAttribute('style').trim() === '') {
      while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
      el.remove();
    }
  }

  function hasStyledSpanAncestor(el, propName) {
    var cur = el && el.parentElement;
    while (cur && cur !== editor) {
      if (cur.tagName === 'SPAN' && cur.style && cur.style[propName]) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  function splitStyleAncestors(node, propName) {
    var inlineTags = ['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'FONT'];
    var cur = node;
    while (cur && cur.parentElement && cur.parentElement !== editor && hasStyledSpanAncestor(cur, propName)) {
      var parent = cur.parentElement;
      if (inlineTags.indexOf(parent.tagName) === -1) break;

      var before = parent.cloneNode(false);
      var after = parent.cloneNode(false);
      while (parent.firstChild && parent.firstChild !== cur) {
        before.appendChild(parent.firstChild);
      }
      while (cur.nextSibling) {
        after.appendChild(cur.nextSibling);
      }

      var gp = parent.parentNode;
      if (before.childNodes.length > 0) gp.insertBefore(before, parent);

      if (parent.tagName === 'SPAN' && parent.style && parent.style[propName]) {
        // Carry over unrelated inline styles (e.g. text color / font size) without duplicating propName
        var kept = parent.cloneNode(false);
        kept.style[propName] = '';
        if (kept.getAttribute('style') && kept.getAttribute('style').trim()) {
          if (cur.tagName === 'SPAN') {
            for (var k = 0; k < kept.style.length; k++) {
              var cssProp = kept.style[k];
              if (cssProp && !cur.style.getPropertyValue(cssProp)) {
                cur.style.setProperty(cssProp, kept.style.getPropertyValue(cssProp));
              }
            }
          } else {
            kept.appendChild(cur);
            cur = kept;
          }
        }
        gp.insertBefore(cur, parent);
      } else {
        var mid = parent.cloneNode(false);
        mid.appendChild(cur);
        gp.insertBefore(mid, parent);
        cur = mid;
      }

      if (after.childNodes.length > 0) gp.insertBefore(after, parent);
      parent.remove();
    }
    return cur;
  }

  function stripDescendantStyle(root, propName) {
    var nodes = root.querySelectorAll('[style]');
    for (var i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].style && nodes[i].style[propName]) {
        nodes[i].style[propName] = '';
      }
      unwrapEmptySpan(nodes[i]);
    }
  }

  function wrapSelectionWithStyle(propName, propValue) {
    restoreSelection();
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    var isClearing = !propValue || propValue === 'transparent';

    if (range.collapsed) {
      var span = document.createElement('span');
      if (!isClearing) span.style[propName] = propValue;
      span.innerHTML = '&#8203;';
      range.insertNode(span);
      splitStyleAncestors(span, propName);
      var targetTextNode = span.firstChild;
      if (isClearing && (!span.getAttribute('style') || !span.getAttribute('style').trim())) {
        unwrapEmptySpan(span);
      }
      var nextRange = document.createRange();
      nextRange.setStart(targetTextNode, 1);
      nextRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(nextRange);
      savedRange = nextRange.cloneRange();
      return;
    }

    // Use execCommand('fontName') sentinel trick, then flatten nested/ancestor style spans so highlights never double!
    var sentinel = '__risalah_style_marker__';
    document.execCommand('fontName', false, sentinel);
    var fonts = editor.querySelectorAll('font[face="' + sentinel + '"]');
    var styledNodes = [];
    for (var i = 0; i < fonts.length; i++) {
      var f = fonts[i];
      var s = document.createElement('span');
      if (!isClearing) s.style[propName] = propValue;
      while (f.firstChild) s.appendChild(f.firstChild);
      f.parentNode.replaceChild(s, f);
      stripDescendantStyle(s, propName);
      var lifted = splitStyleAncestors(s, propName);
      if (isClearing) {
        var firstKid = s.firstChild;
        var lastKid = s.lastChild;
        unwrapEmptySpan(s);
        if (firstKid) styledNodes.push(firstKid);
        if (lastKid && lastKid !== firstKid) styledNodes.push(lastKid);
      } else {
        styledNodes.push(lifted || s);
      }
    }
    if (styledNodes.length > 0) {
      try {
        var nr = document.createRange();
        nr.setStartBefore(styledNodes[0]);
        nr.setEndAfter(styledNodes[styledNodes.length - 1]);
        sel.removeAllRanges();
        sel.addRange(nr);
      } catch (e) {}
    }
    saveSelection();
  }

  function toggleChecklist() {
    restoreSelection();
    var sel = window.getSelection();
    var node = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startContainer : null;
    var existingLi = getClosestTag(node, ['LI']);
    if (existingLi && existingLi.parentElement && existingLi.parentElement.classList.contains('risalah-checklist')) {
      var ul = existingLi.parentElement;
      var div = document.createElement('div');
      div.innerHTML = existingLi.innerHTML || '<br>';
      if (ul.children.length <= 1) {
        ul.parentNode.replaceChild(div, ul);
      } else {
        ul.parentNode.insertBefore(div, ul.nextSibling);
        existingLi.remove();
      }
      var r = document.createRange();
      r.selectNodeContents(div);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
      saveSelection();
      emitFormatState();
      emitChange(true);
      return;
    }

    document.execCommand('insertUnorderedList', false);
    var curSel = window.getSelection();
    var curNode = curSel && curSel.rangeCount > 0 ? curSel.getRangeAt(0).startContainer : null;
    var listUl = getClosestTag(curNode, ['UL']);
    if (listUl) {
      listUl.classList.add('risalah-checklist');
      var lis = listUl.querySelectorAll('li');
      for (var i = 0; i < lis.length; i++) {
        if (!lis[i].hasAttribute('data-checked')) {
          lis[i].setAttribute('data-checked', 'false');
        }
      }
    }
    ensureImagesOutsideLists();
    saveSelection();
    emitFormatState();
    emitChange(true);
  }

  window.__risalahApi = {
    setTheme: function(t) {
      applyTheme(t);
    },
    setHtml: function(html) {
      suppressNextInput = true;
      selectedImgBlock = null;
      editor.innerHTML = html || '';
      hydrateAllImages();
      collapseSpacersAroundFloatedImages();
      ensureTrailingEditableLine();
      suppressNextInput = false;
      emitFormatState();
    },
    focusEditor: function() {
      restoreSelection();
    },
    execInline: function(cmd) {
      restoreSelection();
      try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
      document.execCommand(cmd, false);
      saveSelection();
      emitFormatState();
      // Only emit full HTML change immediately if non-collapsed selection actually mutated DOM
      var sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
        emitChange(true);
      }
    },
    setTextColor: function(hex) {
      wrapSelectionWithStyle('color', hex || '');
      emitFormatState();
      emitChange(true);
    },
    setHighlightColor: function(hex) {
      wrapSelectionWithStyle('backgroundColor', hex || 'transparent');
      emitFormatState();
      emitChange(true);
    },
    setAlignment: function(align) {
      restoreSelection();
      var cmd = align === 'center' ? 'justifyCenter' : align === 'right' ? 'justifyRight' : 'justifyLeft';
      document.execCommand(cmd, false);
      saveSelection();
      emitFormatState();
      emitChange(true);
    },
    setFontFamily: function(family) {
      var stack =
        family === 'serif'
          ? 'Georgia, "Times New Roman", serif'
          : family === 'mono'
          ? 'Menlo, Consolas, monospace'
          : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      wrapSelectionWithStyle('fontFamily', stack);
      emitFormatState();
      emitChange(true);
    },
    setFontSize: function(size) {
      var px = size === 'S' ? '14px' : size === 'L' ? '19px' : size === 'XL' ? '23px' : '16px';
      wrapSelectionWithStyle('fontSize', px);
      emitFormatState();
      emitChange(true);
    },
    insertLink: function(label, url) {
      restoreSelection();
      var safeLabel = (label || url).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var safeUrl = url.replace(/"/g, '&quot;');
      document.execCommand('insertHTML', false, '<a href="' + safeUrl + '">' + safeLabel + '</a>&nbsp;');
      saveSelection();
      emitFormatState();
      emitChange(true);
    },
    insertImage: function(htmlSnippet) {
      restoreSelection();
      deselectImages();
      var temp = document.createElement('div');
      temp.innerHTML = htmlSnippet;
      var nodes = Array.prototype.slice.call(temp.childNodes);
      var imgBlock = null;

      // Insert image cleanly as a top-level block so moving up/down & dragging works anywhere
      var sel = window.getSelection();
      var anchor = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startContainer : null;
      var topNode = anchor && anchor.nodeType === 3 ? anchor.parentElement : anchor;
      while (topNode && topNode.parentElement !== editor) {
        topNode = topNode.parentElement;
      }

      if (topNode && topNode.parentElement === editor) {
        var ref = topNode.nextSibling;
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i].classList && nodes[i].classList.contains('risalah-img-block')) imgBlock = nodes[i];
          editor.insertBefore(nodes[i], ref);
        }
      } else {
        for (var j = 0; j < nodes.length; j++) {
          if (nodes[j].classList && nodes[j].classList.contains('risalah-img-block')) imgBlock = nodes[j];
          editor.appendChild(nodes[j]);
        }
      }

      hydrateAllImages();
      collapseSpacersAroundFloatedImages();
      ensureTrailingEditableLine();
      if (imgBlock) {
        selectImageBlock(imgBlock);
        imgBlock.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      emitChange(true);
    },
    insertText: function(text, onNewLine) {
      restoreSelection();
      var escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (onNewLine) {
        document.execCommand('insertHTML', false, '<div>' + escaped + '</div><div><br></div>');
      } else {
        document.execCommand('insertText', false, text);
      }
      saveSelection();
      emitChange(true);
    },
    toggleChecklist: toggleChecklist,
    toggleBulletList: function() {
      restoreSelection();
      var curSel = window.getSelection();
      var curNode = curSel && curSel.rangeCount > 0 ? curSel.getRangeAt(0).startContainer : null;
      var ul = getClosestTag(curNode, ['UL']);
      if (ul && ul.classList.contains('risalah-checklist')) {
        ul.classList.remove('risalah-checklist');
        var lis = ul.querySelectorAll('li');
        for (var i = 0; i < lis.length; i++) lis[i].removeAttribute('data-checked');
      } else {
        document.execCommand('insertUnorderedList', false);
      }
      ensureImagesOutsideLists();
      saveSelection();
      emitFormatState();
      emitChange(true);
    },
    toggleOrderedList: function() {
      restoreSelection();
      document.execCommand('insertOrderedList', false);
      ensureImagesOutsideLists();
      saveSelection();
      emitFormatState();
      emitChange(true);
    },
    indent: function() {
      restoreSelection();
      var meta = getListMeta();
      if (meta.listType && meta.listDepth >= 5) return;
      document.execCommand('indent', false);
      ensureImagesOutsideLists();
      saveSelection();
      emitFormatState();
      emitChange(true);
    },
    outdent: function() {
      restoreSelection();
      document.execCommand('outdent', false);
      ensureImagesOutsideLists();
      saveSelection();
      emitFormatState();
      emitChange(true);
    }
  };

  try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
  applyTheme(${safeTheme});
  window.__risalahApi.setHtml(${safeInitialHtml});
  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}

export const RichTextWebView = forwardRef<
  RichTextEditorHandle,
  RichTextWebViewProps
>(
  (
    {
      initialHtml,
      theme,
      placeholder = 'Start writing...',
      onChangeHtml,
      onFormatChange,
      onOpenLink,
      onImageDeleted,
    },
    ref
  ) => {
    const webViewRef = useRef<WebViewInstance>(null);
    const readyRef = useRef(false);
    const pendingHtmlRef = useRef<string | null>(null);

    // Embed initialHtml synchronously and keep source object stable across re-renders
    const webViewSource = useMemo(
      () => ({ html: buildEditorHtmlDocument(theme, placeholder, initialHtml) }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    );

    const runApi = (call: string) => {
      if (!webViewRef.current) return;
      webViewRef.current.injectJavaScript(
        `window.__risalahApi && window.__risalahApi.${call}; true;`
      );
    };

    useEffect(() => {
      if (!readyRef.current) return;
      runApi(
        `setTheme(${JSON.stringify({
          bg: theme.bg,
          text: theme.text,
          muted: theme.muted,
          accent: theme.accent,
          accentLight: theme.accentLight,
          border: theme.border,
          card: theme.card,
          toolbarBg: theme.toolbarBg,
          toolbarBorder: theme.toolbarBorder,
          danger: theme.danger,
        })})`
      );
    }, [theme]);

    useImperativeHandle(ref, () => ({
      execInline: (cmd) => runApi(`execInline(${JSON.stringify(cmd)})`),
      setTextColor: (hex) => runApi(`setTextColor(${JSON.stringify(hex)})`),
      setHighlightColor: (hex) =>
        runApi(`setHighlightColor(${JSON.stringify(hex)})`),
      setAlignment: (align) =>
        runApi(`setAlignment(${JSON.stringify(align)})`),
      setFontFamily: (family) =>
        runApi(`setFontFamily(${JSON.stringify(family)})`),
      setFontSize: (size) => runApi(`setFontSize(${JSON.stringify(size)})`),
      insertLink: (label, url) =>
        runApi(`insertLink(${JSON.stringify(label)}, ${JSON.stringify(url)})`),
      insertImage: (dataUri, kind) => {
        const snippet =
          `<div class="risalah-img-block" contenteditable="false" data-align="center" data-width="220" data-type="${kind}">` +
          `<div class="risalah-img-frame" style="width:220px;">` +
          `<img src="${dataUri.replace(/"/g, '&quot;')}" draggable="false" />` +
          `</div></div><div><br></div>`;
        runApi(`insertImage(${JSON.stringify(snippet)})`);
      },
      insertText: (text, onNewLine = false) =>
        runApi(
          `insertText(${JSON.stringify(text)}, ${JSON.stringify(onNewLine)})`
        ),
      toggleChecklist: () => runApi('toggleChecklist()'),
      toggleBulletList: () => runApi('toggleBulletList()'),
      toggleOrderedList: () => runApi('toggleOrderedList()'),
      indent: () => runApi('indent()'),
      outdent: () => runApi('outdent()'),
      setHtml: (html) => {
        if (!readyRef.current) {
          pendingHtmlRef.current = html;
          return;
        }
        runApi(`setHtml(${JSON.stringify(html)})`);
      },
      focusEditor: () => runApi('focusEditor()'),
    }));

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'ready') {
          readyRef.current = true;
          if (pendingHtmlRef.current !== null) {
            runApi(`setHtml(${JSON.stringify(pendingHtmlRef.current)})`);
            pendingHtmlRef.current = null;
          }
        } else if (msg.type === 'change') {
          onChangeHtml(msg.html ?? '', msg.plainText ?? '');
        } else if (msg.type === 'format' && msg.state) {
          onFormatChange(msg.state);
        } else if (msg.type === 'openLink' && typeof msg.url === 'string') {
          onOpenLink(msg.url);
        } else if (msg.type === 'imageDeleted') {
          onImageDeleted?.();
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <NativeWebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={webViewSource}
          onMessage={handleMessage}
          style={[styles.webview, { backgroundColor: theme.bg }]}
          javaScriptEnabled
          domStorageEnabled
          keyboardDisplayRequiresUserAction={false}
          hideKeyboardAccessoryView
          scrollEnabled
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        />
      </View>
    );
  }
);

RichTextWebView.displayName = 'RichTextWebView';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  webview: {
    flex: 1,
  },
});
