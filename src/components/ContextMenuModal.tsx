import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADII, ThemePalette } from '../theme/tokens';
import type { Note } from '../types/note';
import { formatDateId } from '../utils/text';
import { BottomSheet } from './BottomSheet';

interface ContextMenuModalProps {
  note: Note | null;
  theme: ThemePalette;
  onClose: () => void;
  onTogglePin: (note: Note) => void;
  onToggleArchive: (note: Note) => void;
  onShare: (note: Note) => void;
  onDelete: (note: Note) => void;
}

export const ContextMenuModal: React.FC<ContextMenuModalProps> = ({
  note,
  theme,
  onClose,
  onTogglePin,
  onToggleArchive,
  onShare,
  onDelete,
}) => (
  <BottomSheet visible={note !== null} theme={theme} onClose={onClose}>
    {note && (
      <>
        <View
          style={[
            styles.previewHeader,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.sheetTitle, { color: theme.text }]} numberOfLines={1}>
            {note.title.trim() || 'Untitled'}
          </Text>
          <Text style={[styles.sheetDate, { color: theme.muted }]}>
            Updated {formatDateId(note.updatedAt)}
          </Text>
        </View>

        <View
          style={[
            styles.actionsCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <ActionRow
            icon={note.isPinned ? 'pin-outline' : 'pin'}
            label={note.isPinned ? 'Unpin note' : 'Pin to top'}
            theme={theme}
            onPress={() => onTogglePin(note)}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <ActionRow
            icon={note.isArchived ? 'arrow-undo-outline' : 'archive-outline'}
            label={note.isArchived ? 'Restore from archive' : 'Move to archive'}
            theme={theme}
            onPress={() => onToggleArchive(note)}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <ActionRow
            icon="share-outline"
            label="Share note"
            theme={theme}
            onPress={() => onShare(note)}
          />
        </View>

        <View
          style={[
            styles.actionsCard,
            styles.dangerCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <ActionRow
            icon="trash-outline"
            label="Move to trash"
            danger
            theme={theme}
            onPress={() => onDelete(note)}
          />
        </View>
      </>
    )}
  </BottomSheet>
);

const ActionRow: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  theme: ThemePalette;
  onPress: () => void;
}> = ({ icon, label, danger, theme, onPress }) => (
  <Pressable
    onPress={onPress}
    android_ripple={{ color: theme.ripple }}
    style={({ pressed }) => [
      styles.actionRow,
      pressed && { backgroundColor: theme.cardHover },
    ]}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <View
      style={[
        styles.iconWrap,
        { backgroundColor: danger ? theme.dangerSoft : theme.accentLight },
      ]}
    >
      <Ionicons
        name={icon}
        size={19}
        color={danger ? theme.danger : theme.accent}
      />
    </View>
    <Text style={[styles.actionLabel, { color: danger ? theme.danger : theme.text }]}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  previewHeader: {
    borderRadius: RADII.card,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
  },
  sheetTitle: { fontFamily: FONTS.serif, fontSize: 17, fontWeight: '700' },
  sheetDate: { fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 0.4, marginTop: 3 },
  actionsCard: { borderRadius: RADII.card, borderWidth: 1, overflow: 'hidden' },
  dangerCard: { marginTop: 10 },
  divider: { height: 1, marginHorizontal: 14 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 15, fontWeight: '600' },
});
