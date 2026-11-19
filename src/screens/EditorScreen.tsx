import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEvent,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalculatorModal } from '../components/CalculatorModal';
import { ColorPickerModal } from '../components/ColorPickerModal';
import { FormattingModal } from '../components/FormattingModal';
import { InsertLinkModal } from '../components/InsertLinkModal';
import { InsertMenuModal } from '../components/InsertMenuModal';
import {
  ActiveFormatState,
  RichTextEditorHandle,
  RichTextWebView,
} from '../components/RichTextWebView';
import { SketchModal } from '../components/SketchModal';
import { FONTS, RADII, ThemePalette } from '../theme/tokens';
import type { Note, ToastVariant } from '../types/note';
import {
  buildResizableImageHtml,
  convertNoteContentToHtml,
  countWords,
} from '../utils/htmlBridge';
import {
  formatDateId,
  isNoteEmpty,
  normalizeLinkUrl,
  normalizeTag,
} from '../utils/text';

interface EditorSnapshot {
  title: string;
  content: string;
  tags: string[];
}

interface EditorScreenProps {
  initialNote: Note;
  isNew: boolean;
  theme: ThemePalette;
  onPersistNote: (note: Note) => void;
  onDiscardNewNote: (noteId: number) => void;
  onClose: () => void;
  onShowToast: (message: string, variant?: ToastVariant) => void;
}

const AUTO_SAVE_DEBOUNCE_MS = 1000;
const HISTORY_COALESCE_MS = 450;
const MAX_HISTORY_ENTRIES = 80;

const INITIAL_FORMAT_STATE: ActiveFormatState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  align: 'left',
  listType: null,
  listDepth: 0,
  hasSelection: false,
};

export const EditorScreen: React.FC<EditorScreenProps> = ({
  initialNote,
  isNew,
  theme,
  onPersistNote,
  onDiscardNewNote,
  onClose,
  onShowToast,
}) => {
  const insets = useSafeAreaInsets();
  const richEditorRef = useRef<RichTextEditorHandle>(null);

  const initialHtml = useMemo(
    () => convertNoteContentToHtml(initialNote.content),
    [initialNote.content]
  );

  const [title, setTitle] = useState(initialNote.title);
  const [content, setContent] = useState(initialHtml);
  const [tags, setTags] = useState<string[]>(initialNote.tags);
  const [tagInput, setTagInput] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle'
  );

  // Live cursor format state reported by WebView
  const [activeFormat, setActiveFormat] =
    useState<ActiveFormatState>(INITIAL_FORMAT_STATE);
  const [lastTextColor, setLastTextColor] = useState('');
  const [lastHighlightColor, setLastHighlightColor] = useState('');

  // Modals
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [formattingOpen, setFormattingOpen] = useState(false);
  const [colorPickerTarget, setColorPickerTarget] = useState<
    'text' | 'highlight' | null
  >(null);
  const [insertLinkOpen, setInsertLinkOpen] = useState(false);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);

  // Undo / Redo history stack
  const historyRef = useRef<EditorSnapshot[]>([
    {
      title: initialNote.title,
      content: initialHtml,
      tags: initialNote.tags,
    },
  ]);
  const historyIndexRef = useRef(0);
  const lastHistoryPushAtRef = useRef(0);
  const [historyMeta, setHistoryMeta] = useState({
    canUndo: false,
    canRedo: false,
  });

  // Always-fresh draft ref for auto-save & hardware back flush
  const draftRef = useRef<EditorSnapshot>({
    title: initialNote.title,
    content: initialHtml,
    tags: initialNote.tags,
  });
  const dirtyRef = useRef(false);
  const hasPersistedRef = useRef(!isNew);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const migratedAttachmentsRef = useRef(false);

  const syncHistoryMeta = useCallback(() => {
    setHistoryMeta({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    });
  }, []);

  const pushHistory = useCallback(
    (snapshot: EditorSnapshot, forceNewEntry = false) => {
      const now = Date.now();
      const idx = historyIndexRef.current;
      const stack = historyRef.current.slice(0, idx + 1);

      const shouldCoalesce =
        !forceNewEntry &&
        stack.length > 1 &&
        now - lastHistoryPushAtRef.current < HISTORY_COALESCE_MS;

      if (shouldCoalesce) {
        stack[stack.length - 1] = snapshot;
      } else {
        stack.push(snapshot);
        if (stack.length > MAX_HISTORY_ENTRIES) {
          stack.shift();
        }
      }

      historyRef.current = stack;
      historyIndexRef.current = stack.length - 1;
      lastHistoryPushAtRef.current = now;
      syncHistoryMeta();
    },
    [syncHistoryMeta]
  );

  const buildCurrentNote = useCallback(
    (snap: EditorSnapshot): Note => ({
      ...initialNote,
      title: snap.title,
      content: snap.content,
      tags: snap.tags,
      attachments: undefined,
      updatedAt: Date.now(),
    }),
    [initialNote]
  );

  const flushSave = useCallback(
    (isClosing: boolean) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const snap = draftRef.current;
      const empty = isNoteEmpty(snap);

      if (isNew && empty) {
        if (hasPersistedRef.current) {
          onDiscardNewNote(initialNote.id);
          hasPersistedRef.current = false;
        }
        dirtyRef.current = false;
        return;
      }

      if (!dirtyRef.current && hasPersistedRef.current) {
        return;
      }

      if (!empty || hasPersistedRef.current) {
        onPersistNote(buildCurrentNote(snap));
        hasPersistedRef.current = true;
        dirtyRef.current = false;
        if (!isClosing) {
          setSaveState('saved');
        }
      }
    },
    [buildCurrentNote, initialNote.id, isNew, onDiscardNewNote, onPersistNote]
  );

  const scheduleAutoSave = useCallback(() => {
    dirtyRef.current = true;
    setSaveState('saving');
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      flushSave(false);
    }, AUTO_SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  const applyDraftChange = useCallback(
    (next: EditorSnapshot, forceHistoryEntry = false) => {
      draftRef.current = next;
      setTitle(next.title);
      setContent(next.content);
      setTags(next.tags);
      pushHistory(next, forceHistoryEntry);
      scheduleAutoSave();
    },
    [pushHistory, scheduleAutoSave]
  );

  // Migrate any legacy attachment images into resizable inline HTML images once on open
  useEffect(() => {
    if (
      migratedAttachmentsRef.current ||
      !initialNote.attachments ||
      initialNote.attachments.length === 0
    ) {
      return;
    }
    migratedAttachmentsRef.current = true;

    (async () => {
      const snippets: string[] = [];
      for (const att of initialNote.attachments ?? []) {
        try {
          const f = new File(att.uri);
          const b64 = await f.base64();
          const mime = att.type === 'sketch' ? 'image/png' : 'image/jpeg';
          snippets.push(
            buildResizableImageHtml(`data:${mime};base64,${b64}`, att.type, 240)
          );
        } catch {
          // Skip missing local file gracefully
        }
      }
      if (snippets.length > 0) {
        const mergedHtml = `${draftRef.current.content}${snippets.join('')}`;
        richEditorRef.current?.setHtml(mergedHtml);
        applyDraftChange({ ...draftRef.current, content: mergedHtml }, true);
      }
    })();
  }, [applyDraftChange, initialNote.attachments]);

  const handleTitleChange = useCallback(
    (value: string) => {
      applyDraftChange({ ...draftRef.current, title: value });
    },
    [applyDraftChange]
  );

  const handleWebViewHtmlChange = useCallback(
    (nextHtml: string) => {
      if (nextHtml === draftRef.current.content) return;
      applyDraftChange({ ...draftRef.current, content: nextHtml });
    },
    [applyDraftChange]
  );

  // Tags
  const addTag = useCallback(
    (rawValue: string) => {
      const normalized = normalizeTag(rawValue);
      setTagInput('');
      if (!normalized) return;

      const exists = draftRef.current.tags.some(
        (t) => t.toLowerCase() === normalized.toLowerCase()
      );
      if (exists) return;

      applyDraftChange(
        {
          ...draftRef.current,
          tags: [...draftRef.current.tags, normalized],
        },
        true
      );
    },
    [applyDraftChange]
  );

  const removeTag = useCallback(
    (tagToRemove: string) => {
      applyDraftChange(
        {
          ...draftRef.current,
          tags: draftRef.current.tags.filter((t) => t !== tagToRemove),
        },
        true
      );
    },
    [applyDraftChange]
  );

  const handleTagInputChange = useCallback(
    (text: string) => {
      if (text.endsWith(' ') || text.endsWith('\n')) {
        addTag(text);
        return;
      }
      setTagInput(text);
    },
    [addTag]
  );

  const handleTagSubmit = useCallback(() => {
    if (tagInput.trim().length > 0) {
      addTag(tagInput);
    }
  }, [addTag, tagInput]);

  const handleTagKeyPress = useCallback(
    (e: TextInputKeyPressEvent) => {
      if (
        e.nativeEvent.key === 'Backspace' &&
        tagInput.length === 0 &&
        draftRef.current.tags.length > 0
      ) {
        const nextTags = draftRef.current.tags.slice(0, -1);
        applyDraftChange({ ...draftRef.current, tags: nextTags }, true);
      }
    },
    [applyDraftChange, tagInput.length]
  );

  // Undo / Redo synced back into WebView
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snap = historyRef.current[historyIndexRef.current];
    draftRef.current = snap;
    setTitle(snap.title);
    setContent(snap.content);
    setTags(snap.tags);
    richEditorRef.current?.setHtml(snap.content);
    syncHistoryMeta();
    scheduleAutoSave();
    Haptics.selectionAsync().catch(() => {});
  }, [scheduleAutoSave, syncHistoryMeta]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snap = historyRef.current[historyIndexRef.current];
    draftRef.current = snap;
    setTitle(snap.title);
    setContent(snap.content);
    setTags(snap.tags);
    richEditorRef.current?.setHtml(snap.content);
    syncHistoryMeta();
    scheduleAutoSave();
    Haptics.selectionAsync().catch(() => {});
  }, [scheduleAutoSave, syncHistoryMeta]);

  const handleBack = useCallback(() => {
    flushSave(true);
    onClose();
  }, [flushSave, onClose]);

  // Android hardware back priority inside Editor
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (colorPickerTarget) {
        setColorPickerTarget(null);
        return true;
      }
      if (insertLinkOpen) {
        setInsertLinkOpen(false);
        return true;
      }
      if (formattingOpen) {
        setFormattingOpen(false);
        return true;
      }
      if (sketchOpen) {
        setSketchOpen(false);
        return true;
      }
      if (insertMenuOpen) {
        setInsertMenuOpen(false);
        return true;
      }
      if (calculatorOpen) {
        setCalculatorOpen(false);
        return true;
      }
      handleBack();
      return true;
    });
    return () => {
      sub.remove();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    calculatorOpen,
    colorPickerTarget,
    formattingOpen,
    handleBack,
    insertLinkOpen,
    insertMenuOpen,
    sketchOpen,
  ]);

  // Media Picking -> Inline Resizable & Movable Image inside WebView
  const pickMedia = useCallback(
    async (source: 'gallery' | 'camera') => {
      try {
        const perm =
          source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          onShowToast(
            `${source === 'camera' ? 'Camera' : 'Gallery'} permission is required`,
            'error'
          );
          return;
        }
        const opts: ImagePicker.ImagePickerOptions = {
          mediaTypes: ['images'],
          quality: 0.65,
          base64: true,
        };
        const res =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync(opts)
            : await ImagePicker.launchImageLibraryAsync(opts);
        if (res.canceled || !res.assets?.[0]) return;

        const asset = res.assets[0];
        const mime = asset.mimeType || 'image/jpeg';
        const b64 = asset.base64 ?? (await new File(asset.uri).base64());
        richEditorRef.current?.insertImage(`data:${mime};base64,${b64}`, 'image');
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
        onShowToast('Image inserted — tap to resize or move', 'success');
      } catch {
        onShowToast(
          source === 'camera' ? 'Unable to open camera' : 'Unable to pick image',
          'error'
        );
      }
    },
    [onShowToast]
  );

  const handleSaveSketch = useCallback(
    (result: { dataUri: string; width: number; height: number }) => {
      richEditorRef.current?.insertImage(result.dataUri, 'sketch');
      onShowToast('Sketch inserted — tap to resize or move', 'success');
    },
    [onShowToast]
  );

  const handleVoiceDictationHint = useCallback(() => {
    richEditorRef.current?.focusEditor();
    onShowToast(
      'Tap the mic button on your keyboard for voice dictation',
      'info'
    );
  }, [onShowToast]);

  const handleInsertFromCalculatorModal = useCallback(
    (value: string) => {
      richEditorRef.current?.insertText(value, false);
      onShowToast(`Inserted ${value}`, 'success');
    },
    [onShowToast]
  );

  const handleOpenLink = useCallback(
    (url: string) => {
      Linking.openURL(url).catch(() =>
        onShowToast('Unable to open link', 'error')
      );
    },
    [onShowToast]
  );

  const canOutdent = activeFormat.listType !== null && activeFormat.listDepth > 0;
  const canIndent =
    activeFormat.listType !== null &&
    activeFormat.listType !== 'checklist' &&
    activeFormat.listDepth < 5;

  const wordCount = useMemo(() => countWords(content), [content]);
  const editedDateLabel = useMemo(
    () => formatDateId(initialNote.updatedAt),
    [initialNote.updatedAt]
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.bg, paddingTop: insets.top },
      ]}
    >
      {/* Swiss Editorial Ruled Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.cardBorder },
        ]}
      >
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backBtn,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Save and go back"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          {initialNote.isArchived && (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: theme.accentLight },
              ]}
            >
              <Ionicons
                name="archive-outline"
                size={12}
                color={theme.accent}
              />
              <Text style={[styles.statusBadgeText, { color: theme.accent }]}>
                Archive
              </Text>
            </View>
          )}
          {saveState !== 'idle' && (
            <View
              style={[
                styles.savePill,
                {
                  backgroundColor:
                    saveState === 'saved'
                      ? theme.successSoft
                      : theme.card,
                },
              ]}
            >
              <View
                style={[
                  styles.saveDot,
                  {
                    backgroundColor:
                      saveState === 'saved'
                        ? theme.successText
                        : theme.pinnedAccent,
                  },
                ]}
              />
              <Text
                style={[
                  styles.saveIndicator,
                  {
                    color:
                      saveState === 'saved'
                        ? theme.successText
                        : theme.muted,
                  },
                ]}
              >
                {saveState === 'saving' ? 'Saving' : 'Saved'}
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.headerRightCluster,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setCalculatorOpen(true);
            }}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && { backgroundColor: theme.accentLight },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open calculator"
            hitSlop={6}
          >
            <Ionicons
              name="calculator-outline"
              size={19}
              color={theme.accent}
            />
          </Pressable>

          <Pressable
            onPress={handleUndo}
            disabled={!historyMeta.canUndo}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed &&
                historyMeta.canUndo && { backgroundColor: theme.searchBg },
              !historyMeta.canUndo && styles.iconBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Undo"
            hitSlop={6}
          >
            <Ionicons name="arrow-undo-outline" size={19} color={theme.text} />
          </Pressable>

          <Pressable
            onPress={handleRedo}
            disabled={!historyMeta.canRedo}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed &&
                historyMeta.canRedo && { backgroundColor: theme.searchBg },
              !historyMeta.canRedo && styles.iconBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Redo"
            hitSlop={6}
          >
            <Ionicons name="arrow-redo-outline" size={19} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Editorial Title + Metadata + Tags */}
        <View style={styles.metaHeader}>
          <TextInput
            value={title}
            onChangeText={handleTitleChange}
            placeholder="Untitled note"
            placeholderTextColor={theme.muted}
            style={[styles.titleInput, { color: theme.text }]}
            returnKeyType="next"
            onSubmitEditing={() => richEditorRef.current?.focusEditor()}
          />

          <Text style={[styles.metaSubtitle, { color: theme.muted }]}>
            {editedDateLabel.toUpperCase()}  /  {wordCount}{' '}
            {wordCount === 1 ? 'WORD' : 'WORDS'}
          </Text>

          <View style={styles.tagsContainer}>
            {tags.map((tag) => (
              <View
                key={tag}
                style={[styles.tagChip, { backgroundColor: theme.tagBg }]}
              >
                <Text style={[styles.tagChipText, { color: theme.tagText }]}>
                  #{tag}
                </Text>
                <Pressable
                  onPress={() => removeTag(tag)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove tag ${tag}`}
                >
                  <Ionicons
                    name="close"
                    size={13}
                    color={theme.tagText}
                    style={styles.tagRemoveIcon}
                  />
                </Pressable>
              </View>
            ))}

            <TextInput
              value={tagInput}
              onChangeText={handleTagInputChange}
              onSubmitEditing={handleTagSubmit}
              onKeyPress={handleTagKeyPress}
              placeholder={tags.length === 0 ? '# Add tag...' : '+ tag'}
              placeholderTextColor={theme.muted}
              style={[styles.tagInput, { color: theme.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit={false}
              returnKeyType="done"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />
        </View>

        {/* True WYSIWYG Rich-Text, Checklist, Nested List & Resizable Image Editor */}
        <RichTextWebView
          ref={richEditorRef}
          initialHtml={initialHtml}
          theme={theme}
          onChangeHtml={handleWebViewHtmlChange}
          onFormatChange={setActiveFormat}
          onOpenLink={handleOpenLink}
          onImageDeleted={() => onShowToast('Image removed', 'info')}
        />

        {/* Compact Fixed-Height Bottom Dock */}
        <View
          style={[
            styles.bottomDock,
            { paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          {/* Fixed-height Horizontal WYSIWYG Toolbar */}
          <View
            style={[
              styles.toolbarShell,
              {
                backgroundColor: theme.toolbarBg,
                borderColor: theme.toolbarBorder,
              },
            ]}
          >
            <ScrollView
              horizontal
              style={styles.toolbarScroll}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.listToolbar}
              keyboardShouldPersistTaps="always"
            >
              <ToolbarBtn
                icon="add-circle-outline"
                label="Insert media or sketch"
                theme={theme}
                accentIcon
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setInsertMenuOpen(true);
                }}
              />
              <ToolbarBtn
                textLabel="Aa"
                label="Colors, font, size and alignment"
                active={formattingOpen}
                theme={theme}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setFormattingOpen(true);
                }}
              />

              <View
                style={[
                  styles.toolbarDivider,
                  { backgroundColor: theme.toolbarBorder },
                ]}
              />

              {/* One-tap WYSIWYG Inline Formatting */}
              <ToolbarBtn
                textLabel="B"
                label="Bold"
                active={activeFormat.bold}
                textStyle={{ fontWeight: '900' }}
                theme={theme}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  richEditorRef.current?.execInline('bold');
                }}
              />
              <ToolbarBtn
                textLabel="I"
                label="Italic"
                active={activeFormat.italic}
                textStyle={{ fontStyle: 'italic' }}
                theme={theme}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  richEditorRef.current?.execInline('italic');
                }}
              />
              <ToolbarBtn
                textLabel="U"
                label="Underline"
                active={activeFormat.underline}
                textStyle={{ textDecorationLine: 'underline' }}
                theme={theme}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  richEditorRef.current?.execInline('underline');
                }}
              />
              <ToolbarBtn
                textLabel="S"
                label="Strikethrough"
                active={activeFormat.strike}
                textStyle={{ textDecorationLine: 'line-through' }}
                theme={theme}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  richEditorRef.current?.execInline('strikeThrough');
                }}
              />
              <ToolbarBtn
                icon="link-outline"
                label="Insert link"
                theme={theme}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setInsertLinkOpen(true);
                }}
              />

              <View
                style={[
                  styles.toolbarDivider,
                  { backgroundColor: theme.toolbarBorder },
                ]}
              />

              {/* Lists & 5-Level Indentation */}
              <ToolbarBtn
                icon="checkbox-outline"
                label="Checklist"
                active={activeFormat.listType === 'checklist'}
                theme={theme}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  richEditorRef.current?.toggleChecklist();
                }}
              />
              <ToolbarBtn
                icon="list-outline"
                label="Bullet list"
                active={activeFormat.listType === 'bullet'}
                theme={theme}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  richEditorRef.current?.toggleBulletList();
                }}
              />
              <ToolbarBtn
                textLabel="1."
                label="Numbered list"
                active={activeFormat.listType === 'ordered'}
                theme={theme}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  richEditorRef.current?.toggleOrderedList();
                }}
              />
              <ToolbarBtn
                icon="return-up-back-outline"
                label="Outdent"
                disabled={!canOutdent}
                theme={theme}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  richEditorRef.current?.outdent();
                }}
              />
              <ToolbarBtn
                icon="return-down-forward-outline"
                label="Indent"
                disabled={!canIndent}
                theme={theme}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  richEditorRef.current?.indent();
                }}
              />

              {activeFormat.listType &&
                activeFormat.listType !== 'checklist' &&
                activeFormat.listDepth > 0 && (
                  <View
                    style={[
                      styles.levelBadge,
                      { backgroundColor: theme.accentLight },
                    ]}
                  >
                    <Text
                      style={[styles.levelBadgeText, { color: theme.accent }]}
                    >
                      L{activeFormat.listDepth}/5
                    </Text>
                  </View>
                )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Modals */}
      <CalculatorModal
        visible={calculatorOpen}
        theme={theme}
        onClose={() => setCalculatorOpen(false)}
        onInsertResult={handleInsertFromCalculatorModal}
        onCopied={(val) => onShowToast(`Copied ${val}`, 'info')}
      />

      <FormattingModal
        visible={formattingOpen}
        activeFormat={activeFormat}
        lastTextColor={lastTextColor}
        lastHighlightColor={lastHighlightColor}
        theme={theme}
        onClose={() => setFormattingOpen(false)}
        onInlineCommand={(cmd) => {
          richEditorRef.current?.execInline(cmd);
        }}
        onOpenInsertLink={() => setInsertLinkOpen(true)}
        onSelectAlign={(align) => {
          richEditorRef.current?.setAlignment(align);
        }}
        onSelectFont={(font) => {
          setTimeout(() => richEditorRef.current?.setFontFamily(font), 120);
        }}
        onSelectSize={(size) => {
          setTimeout(() => richEditorRef.current?.setFontSize(size), 120);
        }}
        onSelectTextColor={(hex) => {
          setLastTextColor(hex);
          setTimeout(() => richEditorRef.current?.setTextColor(hex), 120);
        }}
        onSelectHighlightColor={(hex) => {
          setLastHighlightColor(hex);
          setTimeout(() => richEditorRef.current?.setHighlightColor(hex), 120);
        }}
        onOpenCustomColor={(target) => {
          setFormattingOpen(false);
          setColorPickerTarget(target);
        }}
      />

      <ColorPickerModal
        visible={colorPickerTarget !== null}
        title={
          colorPickerTarget === 'highlight'
            ? 'Custom Highlight Color'
            : 'Custom Text Color'
        }
        mode={colorPickerTarget ?? 'text'}
        initialColor={
          colorPickerTarget === 'highlight'
            ? lastHighlightColor || '#FEF08A'
            : lastTextColor || '#445E91'
        }
        theme={theme}
        onClose={() => setColorPickerTarget(null)}
        onApply={(hex) => {
          const target = colorPickerTarget;
          if (target === 'highlight') {
            setLastHighlightColor(hex);
            setTimeout(() => richEditorRef.current?.setHighlightColor(hex), 120);
          } else {
            setLastTextColor(hex);
            setTimeout(() => richEditorRef.current?.setTextColor(hex), 120);
          }
        }}
      />

      <InsertLinkModal
        visible={insertLinkOpen}
        theme={theme}
        onClose={() => setInsertLinkOpen(false)}
        onInsert={(label, rawUrl) => {
          const url = normalizeLinkUrl(rawUrl);
          if (!url) return;
          setTimeout(() => {
            richEditorRef.current?.insertLink(label || url, url);
            onShowToast('Link inserted', 'success');
          }, 120);
        }}
      />

      <InsertMenuModal
        visible={insertMenuOpen}
        theme={theme}
        onClose={() => setInsertMenuOpen(false)}
        onPickGallery={() => pickMedia('gallery')}
        onTakePhoto={() => pickMedia('camera')}
        onOpenSketch={() => setSketchOpen(true)}
        onVoiceDictationHint={handleVoiceDictationHint}
      />

      <SketchModal
        visible={sketchOpen}
        theme={theme}
        onClose={() => setSketchOpen(false)}
        onSaveSketch={handleSaveSketch}
        onError={(msg) => onShowToast(msg, 'error')}
      />
    </View>
  );
};

interface ToolbarBtnProps {
  icon?: keyof typeof Ionicons.glyphMap;
  textLabel?: string;
  textStyle?: object;
  label: string;
  active?: boolean;
  disabled?: boolean;
  accentIcon?: boolean;
  theme: ThemePalette;
  onPress: () => void;
}

const ToolbarBtn: React.FC<ToolbarBtnProps> = ({
  icon,
  textLabel,
  textStyle,
  label,
  active,
  disabled,
  accentIcon,
  theme,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.toolbarBtn,
      active && { backgroundColor: theme.accentLight },
      pressed && !disabled && { opacity: 0.7 },
      disabled && { opacity: 0.3 },
    ]}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    {icon ? (
      <Ionicons
        name={icon}
        size={19}
        color={active || accentIcon ? theme.accent : theme.text}
      />
    ) : (
      <Text
        style={[
          styles.toolbarTextLabel,
          { color: active || accentIcon ? theme.accent : theme.text },
          textStyle,
        ]}
      >
        {textLabel}
      </Text>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADII.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  statusBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  savePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  saveDot: {
    width: 5,
    height: 5,
    borderRadius: 1,
  },
  saveIndicator: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  headerRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADII.card,
    borderWidth: 1,
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 2,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: {
    opacity: 0.28,
  },
  metaHeader: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  titleInput: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    paddingVertical: 2,
  },
  metaSubtitle: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.7,
    marginTop: 4,
    marginBottom: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 12,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  tagChipText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '600',
  },
  tagRemoveIcon: {
    marginLeft: 4,
  },
  tagInput: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    minWidth: 96,
    paddingVertical: 3,
    paddingHorizontal: 4,
    flexGrow: 1,
  },
  divider: {
    height: 1,
    marginBottom: 8,
  },
  bottomDock: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingTop: 8,
    alignItems: 'center',
    gap: 8,
  },
  toolbarShell: {
    flexGrow: 0,
    flexShrink: 0,
    height: 48,
    borderRadius: RADII.card,
    borderWidth: 1,
    maxWidth: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  toolbarScroll: {
    flexGrow: 0,
    height: 46,
  },
  listToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    height: 46,
  },
  toolbarBtn: {
    width: 36,
    height: 34,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarTextLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  toolbarDivider: {
    width: 1,
    height: 18,
    marginHorizontal: 4,
  },
  levelBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    marginLeft: 2,
  },
  levelBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '700',
  },
});
