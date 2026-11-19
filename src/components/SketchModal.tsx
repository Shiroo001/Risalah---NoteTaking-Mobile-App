import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { RADII, ThemePalette } from '../theme/tokens';
import {
  renderCroppedSketchPng,
  SketchPoint,
  SketchStroke,
} from '../utils/sketchPng';

interface SketchModalProps {
  visible: boolean;
  theme: ThemePalette;
  onClose: () => void;
  onSaveSketch: (result: {
    dataUri: string;
    width: number;
    height: number;
  }) => void;
  onError: (msg: string) => void;
}

// Exact 4 PRD colors (Section 5.10)
const SKETCH_COLORS = ['#000000', '#EF4444', '#3B82F6', '#10B981'] as const;

const PEN_WIDTHS = [
  { label: 'S', value: 3 },
  { label: 'M', value: 6 },
  { label: 'L', value: 11 },
] as const;

function pointsToSvgPath(points: SketchPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const { x, y } = points[0];
    return `M ${x.toFixed(1)} ${y.toFixed(1)} L ${(x + 0.1).toFixed(1)} ${(y + 0.1).toFixed(1)}`;
  }
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
  }
  return d;
}

export const SketchModal: React.FC<SketchModalProps> = ({
  visible,
  theme,
  onClose,
  onSaveSketch,
  onError,
}) => {
  const insets = useSafeAreaInsets();
  const [strokes, setStrokes] = useState<SketchStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<SketchStroke | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>(SKETCH_COLORS[0]);
  const [isEraser, setIsEraser] = useState(false);
  const [penWidth, setPenWidth] = useState<number>(PEN_WIDTHS[1].value);
  const [saving, setSaving] = useState(false);

  const toolRef = useRef({ color: selectedColor, isEraser, width: penWidth });
  toolRef.current = { color: selectedColor, isEraser, width: penWidth };

  const activeStrokeRef = useRef<SketchStroke | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStrokes([]);
    setActiveStroke(null);
    activeStrokeRef.current = null;
    setIsEraser(false);
    setSelectedColor(SKETCH_COLORS[0]);
    setSaving(false);
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const { color, isEraser: erasing, width } = toolRef.current;
        const stroke: SketchStroke = {
          color: erasing ? '#FFFFFF' : color,
          width: erasing ? Math.max(18, width * 3) : width,
          isEraser: erasing,
          points: [{ x: locationX, y: locationY }],
        };
        activeStrokeRef.current = stroke;
        setActiveStroke(stroke);
      },
      onPanResponderMove: (evt) => {
        const current = activeStrokeRef.current;
        if (!current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const last = current.points[current.points.length - 1];
        if (last) {
          const dx = locationX - last.x;
          const dy = locationY - last.y;
          if (dx * dx + dy * dy < 4) return;
        }
        const updated: SketchStroke = {
          ...current,
          points: [...current.points, { x: locationX, y: locationY }],
        };
        activeStrokeRef.current = updated;
        setActiveStroke(updated);
      },
      onPanResponderRelease: () => {
        const finished = activeStrokeRef.current;
        activeStrokeRef.current = null;
        setActiveStroke(null);
        if (finished && finished.points.length > 0) {
          setStrokes((prev) => [...prev, finished]);
        }
      },
      onPanResponderTerminate: () => {
        const finished = activeStrokeRef.current;
        activeStrokeRef.current = null;
        setActiveStroke(null);
        if (finished && finished.points.length > 0) {
          setStrokes((prev) => [...prev, finished]);
        }
      },
    })
  ).current;

  const handleUndo = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setStrokes([]);
  }, []);

  const handleSave = useCallback(async () => {
    if (strokes.length === 0 || saving) return;
    setSaving(true);

    try {
      const rendered = renderCroppedSketchPng(strokes, {
        padding: 20,
        maxDimension: 720,
      });

      if (!rendered) {
        onError('Canvas is blank. Draw something first.');
        setSaving(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
      onSaveSketch({
        dataUri: rendered.dataUri,
        width: rendered.width,
        height: rendered.height,
      });
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save sketch PNG';
      onError(msg);
      setSaving(false);
    }
  }, [onClose, onError, onSaveSketch, saving, strokes]);

  const allStrokes = activeStroke ? [...strokes, activeStroke] : strokes;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          { backgroundColor: theme.bg, paddingTop: insets.top },
        ]}
      >
        {/* Top Bar */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable
            onPress={onClose}
            style={[styles.headerBtn, { backgroundColor: theme.searchBg }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel sketch"
          >
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>

          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Draw Sketch
          </Text>

          <Pressable
            onPress={handleSave}
            disabled={strokes.length === 0 || saving}
            style={({ pressed }) => [
              styles.saveBtn,
              {
                backgroundColor: theme.accent,
                opacity: strokes.length === 0 || saving ? 0.45 : pressed ? 0.8 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save auto-cropped sketch"
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.bg} />
            ) : (
              <Text style={[styles.saveBtnText, { color: theme.bg }]}>
                Save PNG
              </Text>
            )}
          </Pressable>
        </View>

        {/* Fullscreen White Drawing Canvas */}
        <View style={styles.canvasWrap} {...panResponder.panHandlers}>
          <Svg style={styles.svgCanvas}>
            {allStrokes.map((stroke, idx) => (
              <Path
                key={idx}
                d={pointsToSvgPath(stroke.points)}
                stroke={stroke.isEraser ? '#FFFFFF' : stroke.color}
                strokeWidth={stroke.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </Svg>

          {allStrokes.length === 0 && (
            <View pointerEvents="none" style={styles.hintOverlay}>
              <Ionicons name="brush-outline" size={28} color="#9CA3AF" />
              <Text style={styles.hintText}>
                Draw with your finger • Auto-crops on save
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Drawing Controls */}
        <View
          style={[
            styles.controlsBar,
            {
              backgroundColor: theme.modalBg,
              borderTopColor: theme.border,
              paddingBottom: Math.max(insets.bottom, 14),
            },
          ]}
        >
          {/* 4 PRD Colors + Pen / Eraser */}
          <View style={styles.controlsRow}>
            <View style={styles.colorsGroup}>
              {SKETCH_COLORS.map((hex) => {
                const active = !isEraser && selectedColor === hex;
                return (
                  <Pressable
                    key={hex}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setIsEraser(false);
                      setSelectedColor(hex);
                    }}
                    style={[
                      styles.colorDot,
                      {
                        backgroundColor: hex,
                        borderColor: active ? theme.accent : 'rgba(128,128,128,0.35)',
                        borderWidth: active ? 3 : 1.5,
                        transform: [{ scale: active ? 1.12 : 1 }],
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ink color ${hex}`}
                  />
                );
              })}
            </View>

            <View style={styles.toolsGroup}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setIsEraser(false);
                }}
                style={[
                  styles.toolChip,
                  {
                    backgroundColor: !isEraser
                      ? theme.accentLight
                      : theme.card,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Pen tool"
              >
                <Ionicons
                  name="pencil"
                  size={17}
                  color={!isEraser ? theme.accent : theme.text}
                />
                <Text
                  style={[
                    styles.toolChipText,
                    { color: !isEraser ? theme.accent : theme.text },
                  ]}
                >
                  Pen
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setIsEraser(true);
                }}
                style={[
                  styles.toolChip,
                  {
                    backgroundColor: isEraser
                      ? theme.accentLight
                      : theme.card,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Eraser tool"
              >
                <Ionicons
                  name="bandage-outline"
                  size={17}
                  color={isEraser ? theme.accent : theme.text}
                />
                <Text
                  style={[
                    styles.toolChipText,
                    { color: isEraser ? theme.accent : theme.text },
                  ]}
                >
                  Eraser
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Stroke Width + Undo + Clear */}
          <View style={styles.controlsRow}>
            <View style={styles.sizesGroup}>
              {PEN_WIDTHS.map((w) => {
                const active = penWidth === w.value;
                return (
                  <Pressable
                    key={w.label}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setPenWidth(w.value);
                    }}
                    style={[
                      styles.sizeBtn,
                      {
                        backgroundColor: active
                          ? theme.accentLight
                          : theme.card,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sizeText,
                        { color: active ? theme.accent : theme.text },
                      ]}
                    >
                      {w.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.toolsGroup}>
              <Pressable
                onPress={handleUndo}
                disabled={strokes.length === 0}
                style={[
                  styles.actionIconBtn,
                  {
                    backgroundColor: theme.card,
                    opacity: strokes.length === 0 ? 0.35 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Undo stroke"
              >
                <Ionicons
                  name="arrow-undo-outline"
                  size={18}
                  color={theme.text}
                />
              </Pressable>

              <Pressable
                onPress={handleClear}
                disabled={strokes.length === 0}
                style={[
                  styles.actionIconBtn,
                  {
                    backgroundColor: theme.card,
                    opacity: strokes.length === 0 ? 0.35 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Clear canvas"
              >
                <Ionicons name="trash-outline" size={18} color={theme.danger} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  saveBtn: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
  },
  saveBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  canvasWrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  svgCanvas: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  hintOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hintText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  controlsBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  colorsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  toolsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: RADII.pill,
  },
  toolChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sizesGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  sizeBtn: {
    width: 38,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionIconBtn: {
    width: 38,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
