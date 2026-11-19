import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RADII, ThemePalette } from '../theme/tokens';
import type {
  NoteFontFamily,
  NoteFontSize,
  NoteTextAlign,
} from '../types/note';
import {
  HIGHLIGHT_COLOR_PRESETS,
  TEXT_COLOR_PRESETS,
} from '../utils/color';
import { BottomSheet } from './BottomSheet';
import type { ActiveFormatState } from './RichTextWebView';

interface FormattingModalProps {
  visible: boolean;
  activeFormat: ActiveFormatState;
  lastTextColor: string;
  lastHighlightColor: string;
  theme: ThemePalette;
  onClose: () => void;
  onInlineCommand: (cmd: 'bold' | 'italic' | 'underline' | 'strikeThrough') => void;
  onOpenInsertLink: () => void;
  onSelectAlign: (align: NoteTextAlign) => void;
  onSelectFont: (font: NoteFontFamily) => void;
  onSelectSize: (size: NoteFontSize) => void;
  onSelectTextColor: (hex: string) => void;
  onSelectHighlightColor: (hex: string) => void;
  onOpenCustomColor: (target: 'text' | 'highlight') => void;
}

const FONT_OPTIONS: { id: NoteFontFamily; label: string }[] = [
  { id: 'sans', label: 'Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Mono' },
];

const SIZE_OPTIONS: NoteFontSize[] = ['S', 'M', 'L', 'XL'];

const ALIGN_OPTIONS: { id: NoteTextAlign; label: string }[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
];

export const FormattingModal: React.FC<FormattingModalProps> = ({
  visible,
  activeFormat,
  lastTextColor,
  lastHighlightColor,
  theme,
  onClose,
  onInlineCommand,
  onOpenInsertLink,
  onSelectAlign,
  onSelectFont,
  onSelectSize,
  onSelectTextColor,
  onSelectHighlightColor,
  onOpenCustomColor,
}) => {
  const pick = (fn: () => void) => {
    Haptics.selectionAsync().catch(() => {});
    fn();
  };

  return (
    <BottomSheet
      visible={visible}
      theme={theme}
      onClose={onClose}
      animationType="slide"
      sheetStyle={styles.sheetMax}
    >
      <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>
                Formatting & Colors
              </Text>
              <Text style={[styles.hint, { color: theme.muted }]}>
                {activeFormat.hasSelection
                  ? 'Applies only to selected text'
                  : 'Applies to text you type next (or select words first)'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.searchBg }]}
              accessibilityRole="button"
              accessibilityLabel="Close formatting"
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollBody}
          >
            {/* Inline Rich-Text Formatting */}
            <Text style={[styles.label, { color: theme.muted }]}>
              TEXT STYLE & LINK
            </Text>
            <View style={styles.inlineRow}>
              <InlineChip
                label="B"
                active={activeFormat.bold}
                textStyle={{ fontWeight: '900' }}
                theme={theme}
                onPress={() => pick(() => onInlineCommand('bold'))}
              />
              <InlineChip
                label="I"
                active={activeFormat.italic}
                textStyle={{ fontStyle: 'italic', fontWeight: '700' }}
                theme={theme}
                onPress={() => pick(() => onInlineCommand('italic'))}
              />
              <InlineChip
                label="U"
                active={activeFormat.underline}
                textStyle={{
                  textDecorationLine: 'underline',
                  fontWeight: '700',
                }}
                theme={theme}
                onPress={() => pick(() => onInlineCommand('underline'))}
              />
              <InlineChip
                label="S"
                active={activeFormat.strike}
                textStyle={{
                  textDecorationLine: 'line-through',
                  fontWeight: '700',
                }}
                theme={theme}
                onPress={() => pick(() => onInlineCommand('strikeThrough'))}
              />
              <Pressable
                onPress={() =>
                  pick(() => {
                    onClose();
                    onOpenInsertLink();
                  })
                }
                style={({ pressed }) => [
                  styles.inlineBtn,
                  {
                    backgroundColor: theme.card,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Insert Link URL"
              >
                <Ionicons name="link-outline" size={18} color={theme.accent} />
              </Pressable>
            </View>

            {/* Font Family & Alignment */}
            <View style={styles.twoColRow}>
              <View style={styles.col}>
                <Text style={[styles.label, { color: theme.muted }]}>FONT</Text>
                <View style={styles.segGroup}>
                  {FONT_OPTIONS.map((f) => (
                    <Pressable
                      key={f.id}
                      onPress={() =>
                        pick(() => {
                          onSelectFont(f.id);
                          onClose();
                        })
                      }
                      style={({ pressed }) => [
                        styles.segBtn,
                        {
                          backgroundColor: pressed
                            ? theme.accentLight
                            : theme.card,
                        },
                      ]}
                    >
                      <Text style={[styles.segLabel, { color: theme.text }]}>
                        {f.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.col}>
                <Text style={[styles.label, { color: theme.muted }]}>
                  ALIGNMENT
                </Text>
                <View style={styles.segGroup}>
                  {ALIGN_OPTIONS.map((a) => {
                    const active = activeFormat.align === a.id;
                    return (
                      <Pressable
                        key={a.id}
                        onPress={() =>
                          pick(() => {
                            onSelectAlign(a.id);
                          })
                        }
                        style={[
                          styles.segBtn,
                          {
                            backgroundColor: active
                              ? theme.accentLight
                              : theme.card,
                          },
                        ]}
                        accessibilityLabel={`Align ${a.label}`}
                      >
                        <Text
                          style={[
                            styles.segLabel,
                            { color: active ? theme.accent : theme.text },
                          ]}
                        >
                          {a.label[0]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Text Size */}
            <Text style={[styles.label, { color: theme.muted }]}>
              TEXT SIZE
            </Text>
            <View style={styles.segGroup}>
              {SIZE_OPTIONS.map((sz) => (
                <Pressable
                  key={sz}
                  onPress={() =>
                    pick(() => {
                      onSelectSize(sz);
                      onClose();
                    })
                  }
                  style={({ pressed }) => [
                    styles.segBtn,
                    {
                      backgroundColor: pressed ? theme.accentLight : theme.card,
                    },
                  ]}
                >
                  <Text style={[styles.segLabel, { color: theme.text }]}>
                    {sz}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 14 Text Color Presets + Custom HSV */}
            <View style={styles.colorHeader}>
              <Text style={[styles.label, { color: theme.muted }]}>
                TEXT COLOR (14 PRESETS)
              </Text>
              <Pressable
                onPress={() => pick(() => onOpenCustomColor('text'))}
                style={[
                  styles.customChip,
                  { backgroundColor: theme.accentLight },
                ]}
              >
                <Ionicons
                  name="color-palette-outline"
                  size={13}
                  color={theme.accent}
                />
                <Text style={[styles.customChipText, { color: theme.accent }]}>
                  Custom HSV
                </Text>
              </Pressable>
            </View>
            <View style={styles.swatchGrid}>
              <Pressable
                onPress={() =>
                  pick(() => {
                    onSelectTextColor('');
                    onClose();
                  })
                }
                style={[
                  styles.swatch,
                  {
                    backgroundColor: theme.card,
                    borderColor:
                      lastTextColor === '' ? theme.accent : theme.toolbarBorder,
                    borderWidth: lastTextColor === '' ? 2.5 : 1,
                  },
                ]}
                accessibilityLabel="Default text color"
              >
                <Ionicons name="ban-outline" size={14} color={theme.muted} />
              </Pressable>

              {TEXT_COLOR_PRESETS.map((hex) => {
                const selected = lastTextColor.toUpperCase() === hex;
                return (
                  <Pressable
                    key={hex}
                    onPress={() =>
                      pick(() => {
                        onSelectTextColor(hex);
                        onClose();
                      })
                    }
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: hex,
                        borderColor: selected
                          ? theme.accent
                          : 'rgba(128,128,128,0.28)',
                        borderWidth: selected ? 2.5 : 1,
                      },
                    ]}
                    accessibilityLabel={`Text color ${hex}`}
                  />
                );
              })}
            </View>

            {/* 14 Highlight Color Presets + Custom HSV */}
            <View style={styles.colorHeader}>
              <Text style={[styles.label, { color: theme.muted }]}>
                HIGHLIGHT COLOR (14 PRESETS)
              </Text>
              <Pressable
                onPress={() => pick(() => onOpenCustomColor('highlight'))}
                style={[
                  styles.customChip,
                  { backgroundColor: theme.accentLight },
                ]}
              >
                <Ionicons
                  name="color-palette-outline"
                  size={13}
                  color={theme.accent}
                />
                <Text style={[styles.customChipText, { color: theme.accent }]}>
                  Custom HSV
                </Text>
              </Pressable>
            </View>
            <View style={styles.swatchGrid}>
              <Pressable
                onPress={() =>
                  pick(() => {
                    onSelectHighlightColor('');
                    onClose();
                  })
                }
                style={[
                  styles.swatch,
                  {
                    backgroundColor: theme.card,
                    borderColor:
                      lastHighlightColor === ''
                        ? theme.accent
                        : theme.toolbarBorder,
                    borderWidth: lastHighlightColor === '' ? 2.5 : 1,
                  },
                ]}
                accessibilityLabel="No highlight color"
              >
                <Ionicons name="ban-outline" size={14} color={theme.muted} />
              </Pressable>

              {HIGHLIGHT_COLOR_PRESETS.map((hex) => {
                const selected = lastHighlightColor.toUpperCase() === hex;
                return (
                  <Pressable
                    key={hex}
                    onPress={() =>
                      pick(() => {
                        onSelectHighlightColor(hex);
                        onClose();
                      })
                    }
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: hex,
                        borderColor: selected
                          ? theme.accent
                          : 'rgba(128,128,128,0.25)',
                        borderWidth: selected ? 2.5 : 1,
                      },
                    ]}
                    accessibilityLabel={`Highlight color ${hex}`}
                  />
                );
              })}
            </View>
          </ScrollView>
    </BottomSheet>
  );
};

interface InlineChipProps {
  label: string;
  active?: boolean;
  textStyle?: object;
  theme: ThemePalette;
  onPress: () => void;
}

const InlineChip: React.FC<InlineChipProps> = ({
  label,
  active,
  textStyle,
  theme,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.inlineBtn,
      {
        backgroundColor: active ? theme.accentLight : theme.card,
        opacity: pressed ? 0.72 : 1,
      },
    ]}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Text
      style={[
        styles.inlineText,
        { color: active ? theme.accent : theme.text },
        textStyle,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  sheetMax: {
    maxHeight: '84%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flexGrow: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginTop: 12,
    marginBottom: 7,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineBtn: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineText: {
    fontSize: 16,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  segGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  segBtn: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  colorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  customChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.pill,
  },
  customChipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 4,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
