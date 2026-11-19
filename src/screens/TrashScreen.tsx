import React, { useCallback, useMemo } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS, RADII, ThemePalette } from '../theme/tokens';
import type { Note } from '../types/note';
import { formatDateId, formatNotePreview } from '../utils/text';

interface TrashScreenProps {
  notes: Note[];
  theme: ThemePalette;
  onBack: () => void;
  onRestore: (note: Note) => void;
  onDeletePermanent: (note: Note) => void;
  onEmptyTrash: () => void;
}

export const TrashScreen: React.FC<TrashScreenProps> = ({
  notes,
  theme,
  onBack,
  onRestore,
  onDeletePermanent,
  onEmptyTrash,
}) => {
  const insets = useSafeAreaInsets();

  const deletedNotes = useMemo(
    () =>
      notes
        .filter((n) => n.isDeleted)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [notes]
  );

  const confirmDeleteOne = useCallback(
    (note: Note) => {
      Alert.alert(
        'Delete Permanently?',
        `"${note.title.trim() || 'Untitled'}" cannot be recovered after deletion.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => onDeletePermanent(note),
          },
        ]
      );
    },
    [onDeletePermanent]
  );

  const confirmEmptyTrash = useCallback(() => {
    Alert.alert(
      'Empty Trash?',
      `Permanently delete all ${deletedNotes.length} note${
        deletedNotes.length === 1 ? '' : 's'
      } in Trash? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty Trash',
          style: 'destructive',
          onPress: onEmptyTrash,
        },
      ]
    );
  }, [deletedNotes.length, onEmptyTrash]);

  const keyExtractor = useCallback((item: Note) => String(item.id), []);

  const renderItem = useCallback(
    ({ item }: { item: Note }) => {
      const displayTitle = item.title.trim() || 'Untitled';
      const preview = formatNotePreview(item.content);

      return (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text
              style={[
                styles.cardTitle,
                { color: item.title.trim() ? theme.text : theme.muted },
              ]}
              numberOfLines={1}
            >
              {displayTitle}
            </Text>
            <View
              style={[styles.dateBadge, { backgroundColor: theme.searchBg }]}
            >
              <Text style={[styles.dateText, { color: theme.muted }]}>
                {formatDateId(item.updatedAt)}
              </Text>
            </View>
          </View>

          {preview.length > 0 && (
            <Text
              style={[styles.preview, { color: theme.muted }]}
              numberOfLines={2}
            >
              {preview}
            </Text>
          )}

          {item.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {item.tags.slice(0, 4).map((tag) => (
                <View
                  key={tag}
                  style={[styles.tagChip, { backgroundColor: theme.tagBg }]}
                >
                  <Text style={[styles.tagText, { color: theme.tagText }]}>
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => onRestore(item)}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: theme.accentLight,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Restore ${displayTitle}`}
            >
              <Ionicons
                name="refresh-outline"
                size={16}
                color={theme.accent}
              />
              <Text style={[styles.actionLabel, { color: theme.accent }]}>
                Restore
              </Text>
            </Pressable>

            <Pressable
              onPress={() => confirmDeleteOne(item)}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.deleteBtn,
                {
                  borderColor: theme.danger,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${displayTitle} permanently`}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={theme.danger}
              />
              <Text style={[styles.actionLabel, { color: theme.danger }]}>
                Delete Forever
              </Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [confirmDeleteOne, onRestore, theme]
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.bg, paddingTop: insets.top },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={19} color={theme.text} />
          </Pressable>
          <View>
            <Text style={[styles.headerSubtitle, { color: theme.muted }]}>
              {String(deletedNotes.length).padStart(2, '0')}{' '}
              {deletedNotes.length === 1 ? 'DELETED ENTRY' : 'DELETED ENTRIES'}
            </Text>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Trash
            </Text>
          </View>
        </View>

        {deletedNotes.length > 0 && (
          <Pressable
            onPress={confirmEmptyTrash}
            style={({ pressed }) => [
              styles.emptyBtn,
              {
                backgroundColor: theme.dangerSoft,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Empty trash"
          >
            <Ionicons name="trash-bin-outline" size={15} color={theme.danger} />
            <Text style={[styles.emptyBtnText, { color: theme.danger }]}>
              Empty
            </Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={deletedNotes}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          deletedNotes.length === 0 && styles.emptyListContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View
              style={[styles.emptyIconWrap, { backgroundColor: theme.card }]}
            >
              <Ionicons name="trash-outline" size={32} color={theme.muted} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              Trash is empty
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.muted }]}>
              Deleted notes appear here so you can restore or remove them
              permanently.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: RADII.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  headerSubtitle: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: RADII.card,
  },
  emptyBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: RADII.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    fontFamily: FONTS.serif,
    fontSize: 16.5,
    fontWeight: '700',
    flex: 1,
  },
  dateBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADII.pill,
  },
  dateText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: '600',
  },
  preview: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADII.pill,
  },
  tagText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: RADII.card,
  },
  deleteBtn: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  actionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: RADII.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
