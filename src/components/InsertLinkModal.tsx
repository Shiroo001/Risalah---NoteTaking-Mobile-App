import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADII, ThemePalette } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';

interface InsertLinkModalProps {
  visible: boolean;
  initialLabel?: string;
  theme: ThemePalette;
  onClose: () => void;
  onInsert: (label: string, url: string) => void;
}

export const InsertLinkModal: React.FC<InsertLinkModalProps> = ({
  visible,
  initialLabel = '',
  theme,
  onClose,
  onInsert,
}) => {
  const [label, setLabel] = useState(initialLabel);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLabel(initialLabel);
    setUrl('');
  }, [initialLabel, visible]);

  const canSubmit = url.trim().length > 0;
  const handleSubmit = () => {
    if (!canSubmit) return;
    onInsert(label.trim(), url.trim());
    onClose();
  };

  return (
    <BottomSheet visible={visible} theme={theme} onClose={onClose} avoidKeyboard>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Ionicons name="link-outline" size={20} color={theme.accent} />
          <Text style={[styles.title, { color: theme.text }]}>Insert Link URL</Text>
        </View>
        <Pressable
          onPress={onClose}
          style={[styles.closeBtn, { backgroundColor: theme.searchBg }]}
        >
          <Ionicons name="close" size={18} color={theme.text} />
        </Pressable>
      </View>

      <Text style={[styles.fieldLabel, { color: theme.muted }]}>
        Display Text (optional)
      </Text>
      <TextInput
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Risalah Docs"
        placeholderTextColor={theme.muted}
        style={[
          styles.input,
          {
            backgroundColor: theme.inputBg,
            color: theme.text,
            borderColor: theme.toolbarBorder,
          },
        ]}
      />

      <Text style={[styles.fieldLabel, { color: theme.muted }]}>URL</Text>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="https://example.com"
        placeholderTextColor={theme.muted}
        style={[
          styles.input,
          {
            backgroundColor: theme.inputBg,
            color: theme.text,
            borderColor: theme.toolbarBorder,
          },
        ]}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.submitBtn,
          {
            backgroundColor: theme.accent,
            opacity: !canSubmit ? 0.4 : pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={[styles.submitText, { color: theme.bg }]}>Insert Link</Text>
      </Pressable>
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
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 6 },
  input: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 8,
  },
  submitBtn: {
    height: 46,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitText: { fontSize: 15, fontWeight: '700' },
});
