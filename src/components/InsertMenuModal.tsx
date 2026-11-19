import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADII, ThemePalette } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';

interface InsertMenuModalProps {
  visible: boolean;
  theme: ThemePalette;
  onClose: () => void;
  onPickGallery: () => void;
  onTakePhoto: () => void;
  onOpenSketch: () => void;
  onVoiceDictationHint: () => void;
}

export const InsertMenuModal: React.FC<InsertMenuModalProps> = ({
  visible,
  theme,
  onClose,
  onPickGallery,
  onTakePhoto,
  onOpenSketch,
  onVoiceDictationHint,
}) => {
  const items: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    subtitle: string;
    action: () => void;
  }[] = [
    {
      icon: 'images-outline',
      label: 'Choose Photo from Gallery',
      subtitle: 'Pick an image from your device',
      action: onPickGallery,
    },
    {
      icon: 'camera-outline',
      label: 'Take Photo',
      subtitle: 'Capture directly with camera',
      action: onTakePhoto,
    },
    {
      icon: 'brush-outline',
      label: 'Draw Sketch',
      subtitle: 'Fullscreen canvas with auto-crop PNG',
      action: onOpenSketch,
    },
    {
      icon: 'mic-outline',
      label: 'Voice Input (Dictation)',
      subtitle: 'Uses system keyboard mic in Expo Go',
      action: onVoiceDictationHint,
    },
  ];

  return (
    <BottomSheet visible={visible} theme={theme} onClose={onClose}>
      <Text style={[styles.title, { color: theme.text }]}>Insert Media</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        {items.map((item, idx) => (
          <React.Fragment key={item.label}>
            {idx > 0 && (
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
            )}
            <Pressable
              onPress={() => {
                onClose();
                item.action();
              }}
              android_ripple={{ color: theme.ripple }}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: theme.cardHover },
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.accentLight }]}>
                <Ionicons name={item.icon} size={20} color={theme.accent} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>
                  {item.label}
                </Text>
                <Text style={[styles.rowSub, { color: theme.muted }]}>
                  {item.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={theme.muted} />
            </Pressable>
          </React.Fragment>
        ))}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', marginBottom: 14, paddingHorizontal: 4 },
  card: { borderRadius: RADII.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  divider: { height: 1, marginHorizontal: 14 },
});
