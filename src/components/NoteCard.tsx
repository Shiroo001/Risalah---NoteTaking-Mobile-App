import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FONTS, RADII, ThemePalette } from '../theme/tokens';
import type { Note } from '../types/note';
import {
  countEmbeddedImages,
  extractFirstImageSrc,
} from '../utils/htmlBridge';
import { formatDateId, formatNotePreview } from '../utils/text';

interface NoteCardProps {
  note: Note;
  index: number;
  sectionLabel?: string;
  theme: ThemePalette;
  showDragHandle: boolean;
  isDragging: boolean;
  isAnyDragging: boolean;
  dragTranslateY: Animated.Value;
  shiftAnim: Animated.Value;
  onPress: (note: Note) => void;
  onLongPress: (note: Note) => void;
}

export const NoteCard: React.FC<NoteCardProps> = React.memo(
  ({
    note,
    index,
    sectionLabel,
    theme,
    showDragHandle,
    isDragging,
    isAnyDragging,
    dragTranslateY,
    shiftAnim,
    onPress,
    onLongPress,
  }) => {
    const preview = useMemo(
      () => formatNotePreview(note.content),
      [note.content]
    );
    const formattedDate = useMemo(
      () => formatDateId(note.updatedAt),
      [note.updatedAt]
    );
    const displayTitle = note.title.trim() || 'Untitled';

    const mediaCount = useMemo(
      () =>
        countEmbeddedImages(note.content) + (note.attachments?.length ?? 0),
      [note.attachments, note.content]
    );

    const thumbnailUri = useMemo(
      () =>
        extractFirstImageSrc(note.content) ??
        note.attachments?.[0]?.uri ??
        null,
      [note.attachments, note.content]
    );

    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      Animated.timing(scaleAnim, {
        toValue: isDragging ? 1.02 : 1,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, [isDragging, scaleAnim]);

    const borderColor = isDragging ? theme.accent : theme.cardBorder;

    return (
      <Animated.View
        style={[
          styles.outerWrap,
          {
            transform: [
              {
                translateY: isDragging
                  ? dragTranslateY
                  : isAnyDragging
                  ? shiftAnim
                  : 0,
              },
              { scale: scaleAnim },
            ],
            zIndex: isDragging ? 100 : 1,
            elevation: isDragging ? 14 : 0,
          },
        ]}
      >
        {sectionLabel && (
          <View
            style={[
              styles.sectionHeaderRow,
              isAnyDragging && { opacity: 0.32 },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: theme.muted }]}>
              {sectionLabel}
            </Text>
            <View
              style={[
                styles.sectionRule,
                { backgroundColor: theme.cardBorder },
              ]}
            />
          </View>
        )}

        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: isDragging ? theme.cardHover : theme.card,
              borderColor,
              borderWidth: isDragging ? 1.5 : 1,
            },
            isDragging && styles.draggingShadow,
          ]}
        >
          {/* Warm left indicator bar for pinned notes */}
          {note.isPinned && (
            <View
              style={[
                styles.pinnedStripe,
                { backgroundColor: theme.pinnedAccent },
              ]}
            />
          )}

          <Pressable
            onPress={() => onPress(note)}
            onLongPress={() => onLongPress(note)}
            delayLongPress={300}
            android_ripple={{ color: theme.ripple }}
            style={({ pressed }) => [
              styles.cardBody,
              note.isPinned && styles.cardBodyPinned,
              pressed && !isDragging && { backgroundColor: theme.cardHover },
            ]}
            accessibilityRole="button"
            accessibilityLabel={displayTitle}
          >
            <View style={styles.mainContentRow}>
              <View style={styles.textCol}>
                <View style={styles.topRow}>
                  <Text
                    style={[
                      styles.folioIndex,
                      { color: note.isPinned ? theme.accent : theme.muted },
                    ]}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <Text
                    style={[
                      styles.title,
                      {
                        color: note.title.trim() ? theme.text : theme.muted,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {displayTitle}
                  </Text>

                  {note.isPinned && (
                    <View
                      style={[
                        styles.pinnedBadge,
                        { backgroundColor: theme.pinnedBg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pinnedText,
                          { color: theme.pinnedText },
                        ]}
                      >
                        PIN
                      </Text>
                    </View>
                  )}
                </View>

                {preview.length > 0 && (
                  <Text
                    style={[styles.preview, { color: theme.muted }]}
                    numberOfLines={2}
                  >
                    {preview}
                  </Text>
                )}
              </View>

              {/* Inline Rounded Image / Sketch Thumbnail */}
              {thumbnailUri && (
                <View
                  style={[
                    styles.thumbWrap,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: thumbnailUri }}
                    style={styles.thumbImg}
                    resizeMode="cover"
                  />
                  {mediaCount > 1 && (
                    <View style={styles.thumbCount}>
                      <Text style={styles.thumbCountText}>+{mediaCount - 1}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <Text style={[styles.dateText, { color: theme.muted }]}>
                {formattedDate.toUpperCase()}
              </Text>

              {note.tags.length > 0 && (
                <View style={styles.tagsRow}>
                  {note.tags.slice(0, 3).map((tag) => (
                    <View
                      key={tag}
                      style={[
                        styles.tagChip,
                        {
                          backgroundColor: theme.tagBg,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.tagText, { color: theme.tagText }]}
                        numberOfLines={1}
                      >
                        #{tag}
                      </Text>
                    </View>
                  ))}
                  {note.tags.length > 3 && (
                    <View
                      style={[
                        styles.tagChip,
                        {
                          backgroundColor: theme.tagBg,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={[styles.tagText, { color: theme.tagText }]}>
                        +{note.tags.length - 3}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </Pressable>

          {/* Visual 6-dot Drag Handle (touch captured by sibling drag rail above FlatList) */}
          {showDragHandle && (
            <View
              style={styles.dragHandleArea}
              accessible
              accessibilityLabel={`Drag to reorder ${displayTitle}`}
            >
              <View style={styles.dotGrid}>
                {[0, 1, 2].map((row) => (
                  <View key={row} style={styles.dotRow}>
                    <View
                      style={[
                        styles.gripDot,
                        {
                          backgroundColor: isDragging
                            ? theme.accent
                            : theme.muted,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.gripDot,
                        {
                          backgroundColor: isDragging
                            ? theme.accent
                            : theme.muted,
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    );
  }
);

NoteCard.displayName = 'NoteCard';

const styles = StyleSheet.create({
  outerWrap: {
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
    paddingTop: 6,
    paddingBottom: 10,
  },
  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  sectionRule: {
    flex: 1,
    height: 1,
  },
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: RADII.card,
    overflow: 'hidden',
  },
  draggingShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  pinnedStripe: {
    width: 3,
  },
  cardBody: {
    flex: 1,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 14,
  },
  cardBodyPinned: {
    paddingLeft: 13,
  },
  mainContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  textCol: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
  },
  folioIndex: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
  },
  pinnedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  pinnedText: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  preview: {
    fontSize: 13.5,
    lineHeight: 19.5,
    marginTop: 5,
  },
  thumbWrap: {
    width: 58,
    height: 58,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbCount: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    backgroundColor: 'rgba(17, 17, 17, 0.82)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  thumbCountText: {
    fontFamily: FONTS.mono,
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
    paddingTop: 9,
    borderTopWidth: 1,
  },
  dateText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    flexShrink: 1,
  },
  tagChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADII.pill,
    borderWidth: 1,
    maxWidth: 130,
  },
  tagText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: '600',
  },
  dragHandleArea: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotGrid: {
    gap: 4.5,
    opacity: 0.42,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 4.5,
  },
  gripDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1,
  },
});
