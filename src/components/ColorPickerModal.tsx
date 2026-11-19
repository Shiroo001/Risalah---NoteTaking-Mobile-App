import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { RADII, ThemePalette } from '../theme/tokens';
import {
  clamp,
  hexToHsv,
  hsvToHex,
  normalizeHex,
} from '../utils/color';
import { BottomSheet } from './BottomSheet';

interface ColorPickerModalProps {
  visible: boolean;
  title: string;
  initialColor: string;
  mode: 'text' | 'highlight';
  theme: ThemePalette;
  onClose: () => void;
  onApply: (hexColor: string) => void;
}

const SV_HEIGHT = 176;
const HUE_HEIGHT = 28;

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  visible,
  title,
  initialColor,
  mode,
  theme,
  onClose,
  onApply,
}) => {
  const initialHsv = useMemo(
    () => hexToHsv(initialColor || (mode === 'highlight' ? '#FEF08A' : '#445E91')),
    [initialColor, mode]
  );

  const [hue, setHue] = useState(initialHsv.h);
  const [sat, setSat] = useState(initialHsv.s);
  const [val, setVal] = useState(initialHsv.v);
  const [hexInput, setHexInput] = useState(
    hsvToHex(initialHsv.h, initialHsv.s, initialHsv.v)
  );
  const [boxWidth, setBoxWidth] = useState(280);

  const boxWidthRef = useRef(280);
  boxWidthRef.current = boxWidth;

  const hsvRef = useRef({ h: hue, s: sat, v: val });
  hsvRef.current = { h: hue, s: sat, v: val };

  useEffect(() => {
    if (!visible) return;
    const parsed = hexToHsv(
      initialColor || (mode === 'highlight' ? '#FEF08A' : '#445E91')
    );
    setHue(parsed.h);
    setSat(parsed.s);
    setVal(parsed.v);
    setHexInput(hsvToHex(parsed.h, parsed.s, parsed.v));
  }, [initialColor, mode, visible]);

  const currentHex = useMemo(() => hsvToHex(hue, sat, val), [hue, sat, val]);
  const pureHueHex = useMemo(() => hsvToHex(hue, 1, 1), [hue]);

  const updateSvFromTouch = useCallback((x: number, y: number) => {
    const w = Math.max(1, boxWidthRef.current);
    const nextS = clamp(x / w, 0, 1);
    const nextV = clamp(1 - y / SV_HEIGHT, 0, 1);
    setSat(nextS);
    setVal(nextV);
    setHexInput(hsvToHex(hsvRef.current.h, nextS, nextV));
  }, []);

  const updateHueFromTouch = useCallback((x: number) => {
    const w = Math.max(1, boxWidthRef.current);
    const nextH = clamp((x / w) * 360, 0, 359.9);
    setHue(nextH);
    setHexInput(hsvToHex(nextH, hsvRef.current.s, hsvRef.current.v));
  }, []);

  const svPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateSvFromTouch(
          evt.nativeEvent.locationX,
          evt.nativeEvent.locationY
        );
      },
      onPanResponderMove: (evt) => {
        updateSvFromTouch(
          evt.nativeEvent.locationX,
          evt.nativeEvent.locationY
        );
      },
    })
  ).current;

  const huePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateHueFromTouch(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        updateHueFromTouch(evt.nativeEvent.locationX);
      },
    })
  ).current;

  const handleHexChange = useCallback((raw: string) => {
    const cleaned = raw.startsWith('#') ? raw : `#${raw}`;
    setHexInput(cleaned.toUpperCase().slice(0, 7));
    const norm = normalizeHex(cleaned);
    if (norm) {
      const parsed = hexToHsv(norm);
      setHue(parsed.h);
      setSat(parsed.s);
      setVal(parsed.v);
    }
  }, []);

  const handleApply = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onApply(currentHex);
    onClose();
  }, [currentHex, onApply, onClose]);

  const svKnobLeft = clamp(sat * boxWidth - 11, -11, boxWidth - 11);
  const svKnobTop = clamp((1 - val) * SV_HEIGHT - 11, -11, SV_HEIGHT - 11);
  const hueKnobLeft = clamp((hue / 360) * boxWidth - 12, -4, boxWidth - 20);

  return (
    <BottomSheet visible={visible} theme={theme} onClose={onClose} avoidKeyboard>
      <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.searchBg }]}
              accessibilityRole="button"
              accessibilityLabel="Close color picker"
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          {/* 2D Saturation / Brightness Gradient Square */}
          <View
            style={styles.svContainer}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0) setBoxWidth(w);
            }}
            {...svPanResponder.panHandlers}
          >
            <Svg width="100%" height={SV_HEIGHT} style={styles.svgRounded}>
              <Defs>
                <LinearGradient id="satGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#FFFFFF" />
                  <Stop offset="100%" stopColor={pureHueHex} />
                </LinearGradient>
                <LinearGradient id="valGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
                  <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="100%"
                height={SV_HEIGHT}
                rx={14}
                fill="url(#satGrad)"
              />
              <Rect
                x="0"
                y="0"
                width="100%"
                height={SV_HEIGHT}
                rx={14}
                fill="url(#valGrad)"
              />
            </Svg>

            <View
              pointerEvents="none"
              style={[
                styles.svThumb,
                {
                  left: svKnobLeft,
                  top: svKnobTop,
                  backgroundColor: currentHex,
                },
              ]}
            />
          </View>

          {/* Hue Rainbow Slider */}
          <View
            style={styles.hueContainer}
            {...huePanResponder.panHandlers}
          >
            <Svg width="100%" height={HUE_HEIGHT}>
              <Defs>
                <LinearGradient id="hueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#FF0000" />
                  <Stop offset="16.6%" stopColor="#FFFF00" />
                  <Stop offset="33.3%" stopColor="#00FF00" />
                  <Stop offset="50%" stopColor="#00FFFF" />
                  <Stop offset="66.6%" stopColor="#0000FF" />
                  <Stop offset="83.3%" stopColor="#FF00FF" />
                  <Stop offset="100%" stopColor="#FF0000" />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="4"
                width="100%"
                height={HUE_HEIGHT - 8}
                rx={10}
                fill="url(#hueGrad)"
              />
            </Svg>

            <View
              pointerEvents="none"
              style={[
                styles.hueThumb,
                {
                  left: hueKnobLeft,
                  backgroundColor: pureHueHex,
                },
              ]}
            />
          </View>

          {/* Preview Swatch & HEX Input */}
          <View style={styles.hexRow}>
            <View
              style={[
                styles.previewBox,
                {
                  backgroundColor:
                    mode === 'highlight' ? currentHex : theme.card,
                  borderColor: theme.toolbarBorder,
                },
              ]}
            >
              <View
                style={[styles.previewSwatch, { backgroundColor: currentHex }]}
              />
              <Text
                style={[
                  styles.previewSample,
                  {
                    color: mode === 'text' ? currentHex : theme.text,
                  },
                ]}
              >
                Aa
              </Text>
            </View>

            <View
              style={[
                styles.hexInputBox,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.toolbarBorder,
                },
              ]}
            >
              <Text style={[styles.hexLabel, { color: theme.muted }]}>HEX</Text>
              <TextInput
                value={hexInput}
                onChangeText={handleHexChange}
                placeholder="#445E91"
                placeholderTextColor={theme.muted}
                style={[styles.hexInput, { color: theme.text }]}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
              />
            </View>
          </View>

          <Pressable
            onPress={handleApply}
            style={({ pressed }) => [
              styles.applyBtn,
              {
                backgroundColor: theme.accent,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Apply custom color"
          >
            <Text style={[styles.applyBtnText, { color: theme.bg }]}>
              Apply {currentHex}
            </Text>
          </Pressable>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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
  svContainer: {
    height: SV_HEIGHT,
    width: '100%',
    position: 'relative',
    marginBottom: 16,
  },
  svgRounded: {
    borderRadius: 14,
  },
  svThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  hueContainer: {
    height: HUE_HEIGHT,
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  hueThumb: {
    position: 'absolute',
    top: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  previewSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.25)',
  },
  previewSample: {
    fontSize: 16,
    fontWeight: '800',
  },
  hexInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  hexLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  hexInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  applyBtn: {
    height: 46,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
