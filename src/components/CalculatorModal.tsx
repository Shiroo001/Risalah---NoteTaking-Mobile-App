import React, { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { RADII, ThemePalette } from '../theme/tokens';
import { formatNumber, parseMathLines } from '../utils/mathEngine';
import { BottomSheet } from './BottomSheet';

interface CalculatorModalProps {
  visible: boolean;
  theme: ThemePalette;
  onClose: () => void;
  onInsertResult: (value: string) => void;
  onCopied?: (value: string) => void;
}

const MONO_FONT = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

type CalcButtonKind = 'digit' | 'operator' | 'action' | 'equals';

interface CalcButtonDef {
  label: string;
  value: string;
  kind: CalcButtonKind;
}

// Exact 4-column grid per PRD Section 5.5
const KEYPAD_ROWS: CalcButtonDef[][] = [
  [
    { label: 'C', value: 'C', kind: 'action' },
    { label: '(', value: '(', kind: 'action' },
    { label: ')', value: ')', kind: 'action' },
    { label: '÷', value: '÷', kind: 'operator' },
  ],
  [
    { label: '7', value: '7', kind: 'digit' },
    { label: '8', value: '8', kind: 'digit' },
    { label: '9', value: '9', kind: 'digit' },
    { label: '×', value: '×', kind: 'operator' },
  ],
  [
    { label: '4', value: '4', kind: 'digit' },
    { label: '5', value: '5', kind: 'digit' },
    { label: '6', value: '6', kind: 'digit' },
    { label: '-', value: '-', kind: 'operator' },
  ],
  [
    { label: '1', value: '1', kind: 'digit' },
    { label: '2', value: '2', kind: 'digit' },
    { label: '3', value: '3', kind: 'digit' },
    { label: '+', value: '+', kind: 'operator' },
  ],
  [
    { label: '0', value: '0', kind: 'digit' },
    { label: '.', value: '.', kind: 'digit' },
    { label: '⌫', value: 'DEL', kind: 'action' },
    { label: '=', value: '=', kind: 'equals' },
  ],
];

const OPERATORS = new Set(['+', '-', '×', '÷']);

function evaluateCalcExpression(expr: string): {
  raw: number | string | null;
  formatted: string | null;
} {
  const trimmed = expr.trim();
  if (!trimmed) return { raw: null, formatted: null };

  // Evaluate via mathEngine.js directly
  const parsed = parseMathLines(trimmed);
  if (parsed.length > 0) {
    const val = parsed[parsed.length - 1].result;
    return { raw: val, formatted: formatNumber(val) };
  }

  // Handle pure numeric value (e.g. right after pressing '=' or entering digits)
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
      return { raw: num, formatted: formatNumber(num) };
    }
  }

  return { raw: null, formatted: null };
}

export const CalculatorModal: React.FC<CalculatorModalProps> = ({
  visible,
  theme,
  onClose,
  onInsertResult,
  onCopied,
}) => {
  const [expression, setExpression] = useState('');

  const { raw: liveRaw, formatted: liveFormatted } = useMemo(
    () => evaluateCalcExpression(expression),
    [expression]
  );

  const handleKeyPress = useCallback((key: string) => {
    Haptics.selectionAsync().catch(() => {});

    if (key === 'C') {
      setExpression('');
      return;
    }

    if (key === 'DEL') {
      setExpression((prev) => prev.slice(0, -1));
      return;
    }

    if (key === '=') {
      setExpression((prev) => {
        const evaluated = evaluateCalcExpression(prev);
        if (evaluated.raw === null) return prev;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return typeof evaluated.raw === 'number'
          ? String(evaluated.raw)
          : evaluated.raw;
      });
      return;
    }

    setExpression((prev) => {
      // Clear sentinel values before starting a new number
      const base =
        prev === '∞' || prev === '-∞' || prev === 'Undefined' ? '' : prev;

      // Replace trailing binary operator if another binary operator is pressed (except unary '-')
      const lastChar = base.slice(-1);
      if (
        OPERATORS.has(key) &&
        key !== '-' &&
        base.length > 0 &&
        OPERATORS.has(lastChar)
      ) {
        return `${base.slice(0, -1)}${key}`;
      }

      // Prevent duplicate decimal point within the same numeric token
      if (key === '.') {
        const currentToken = base.split(/[+\-×÷()]/).pop() ?? '';
        if (currentToken.includes('.')) return base;
        if (currentToken.length === 0) return `${base}0.`;
      }

      return `${base}${key}`;
    });
  }, []);

  const handleInsert = useCallback(() => {
    if (!liveFormatted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onInsertResult(liveFormatted);
    setExpression('');
    onClose();
  }, [liveFormatted, onClose, onInsertResult]);

  const handleCopy = useCallback(async () => {
    if (!liveFormatted) return;
    try {
      await Clipboard.setStringAsync(liveFormatted);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onCopied?.(liveFormatted);
    } catch {
      // Ignore clipboard failure
    }
  }, [liveFormatted, onCopied]);

  return (
    <BottomSheet
      visible={visible}
      theme={theme}
      onClose={onClose}
      animationType="slide"
    >
      <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              <Ionicons
                name="calculator-outline"
                size={20}
                color={theme.accent}
              />
              <Text style={[styles.title, { color: theme.text }]}>
                Calculator
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.searchBg }]}
              accessibilityRole="button"
              accessibilityLabel="Close calculator"
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          {/* Display */}
          <View
            style={[
              styles.displayBox,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.border,
              },
            ]}
          >
            <ScrollView
              horizontal
              style={styles.exprScroll}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exprScrollContent}
            >
              <Text
                style={[
                  styles.exprText,
                  {
                    color: expression ? theme.text : theme.muted,
                    fontFamily: MONO_FONT,
                  },
                ]}
              >
                {expression || '0'}
              </Text>
            </ScrollView>

            <View style={styles.previewRow}>
              <Text
                style={[
                  styles.previewText,
                  {
                    color: liveFormatted ? theme.accent : theme.muted,
                    fontFamily: MONO_FONT,
                  },
                ]}
                numberOfLines={1}
              >
                {liveFormatted ? `= ${liveFormatted}` : '= 0'}
              </Text>
            </View>
          </View>

          {/* 4-Column Keypad */}
          <View style={styles.keypad}>
            {KEYPAD_ROWS.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.keypadRow}>
                {row.map((btn) => {
                  const isEquals = btn.kind === 'equals';
                  const isOp = btn.kind === 'operator';
                  const isAction = btn.kind === 'action';

                  const bg = isEquals
                    ? theme.fabBg
                    : isOp
                    ? theme.accentLight
                    : isAction
                    ? theme.searchBg
                    : theme.card;

                  const fg = isEquals
                    ? theme.fabText
                    : isOp
                    ? theme.accent
                    : btn.value === 'C'
                    ? theme.danger
                    : theme.text;

                  return (
                    <Pressable
                      key={btn.label}
                      onPress={() => handleKeyPress(btn.value)}
                      style={({ pressed }) => [
                        styles.keyBtn,
                        {
                          backgroundColor: bg,
                          opacity: pressed ? 0.72 : 1,
                          transform: [{ scale: pressed ? 0.96 : 1 }],
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={btn.label}
                    >
                      <Text style={[styles.keyLabel, { color: fg }]}>
                        {btn.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Insert / Copy Actions */}
          <View style={styles.footerActions}>
            <Pressable
              onPress={handleCopy}
              disabled={!liveFormatted}
              style={({ pressed }) => [
                styles.copyActionBtn,
                {
                  backgroundColor: theme.searchBg,
                  opacity: !liveFormatted ? 0.4 : pressed ? 0.75 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Copy result"
            >
              <Ionicons name="copy-outline" size={18} color={theme.text} />
              <Text style={[styles.copyActionText, { color: theme.text }]}>
                Copy
              </Text>
            </Pressable>

            <Pressable
              onPress={handleInsert}
              disabled={!liveFormatted}
              style={({ pressed }) => [
                styles.insertActionBtn,
                {
                  backgroundColor: theme.accent,
                  opacity: !liveFormatted ? 0.4 : pressed ? 0.82 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Insert result to note"
            >
              <Ionicons
                name="add-circle-outline"
                size={19}
                color={theme.bg}
              />
              <Text style={[styles.insertActionText, { color: theme.bg }]}>
                Insert Result{liveFormatted ? ` (${liveFormatted})` : ''}
              </Text>
            </Pressable>
          </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayBox: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  exprScroll: {
    flexGrow: 0,
    maxHeight: 36,
  },
  exprScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  exprText: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'right',
  },
  previewRow: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  previewText: {
    fontSize: 20,
    fontWeight: '800',
  },
  keypad: {
    gap: 9,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 9,
  },
  keyBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLabel: {
    fontSize: 20,
    fontWeight: '700',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  copyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 46,
    borderRadius: RADII.pill,
  },
  copyActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  insertActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: RADII.pill,
  },
  insertActionText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
});
