import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NoteCard } from '../components/NoteCard';
import { FONTS, isDarkTheme, RADII, ThemePalette } from '../theme/tokens';
import type { Note, ThemeMode } from '../types/note';
import {
  CellLayout,
  computeDragDropOffset,
  computeDragTargetIndex,
  findCardIndexAtY,
} from '../utils/reorder';
import { filterAndSortNotes } from '../utils/text';

const LOGO_ASSET = require('../../assets/logo.png');

interface HomeScreenProps {
  notes: Note[];
  viewMode: 'active' | 'archive';
  searchQuery: string;
  theme: ThemePalette;
  themeMode: ThemeMode;
  onChangeSearch: (query: string) => void;
  onBackFromArchive: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onPressNote: (note: Note) => void;
  onLongPressNote: (note: Note) => void;
  onReorderNotes: (
    visibleNotes: Note[],
    fromIndex: number,
    toIndex: number
  ) => void;
  onCreateNote: () => void;
}

const DEFAULT_ROW_HEIGHT = 122;

export const HomeScreen: React.FC<HomeScreenProps> = ({
  notes,
  viewMode,
  searchQuery,
  theme,
  themeMode,
  onChangeSearch,
  onBackFromArchive,
  onToggleTheme,
  onOpenSettings,
  onPressNote,
  onLongPressNote,
  onReorderNotes,
  onCreateNote,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const viewNotes = useMemo(
    () => filterAndSortNotes(notes, '', viewMode),
    [notes, viewMode]
  );

  // Collect unique tags in current view sorted by frequency for Quick Tag Filter Strip
  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of viewNotes) {
      for (const t of n.tags) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [viewNotes]);

  const effectiveTag =
    selectedTag && availableTags.includes(selectedTag) ? selectedTag : null;

  const visibleNotes = useMemo(() => {
    const searched = filterAndSortNotes(notes, searchQuery, viewMode);
    if (!effectiveTag) return searched;
    return searched.filter((n) =>
      n.tags.some((t) => t.toLowerCase() === effectiveTag.toLowerCase())
    );
  }, [effectiveTag, notes, searchQuery, viewMode]);

  const pinnedCount = useMemo(
    () => visibleNotes.filter((n) => n.isPinned).length,
    [visibleNotes]
  );
  const hasBothPinGroups =
    pinnedCount > 0 && pinnedCount < visibleNotes.length;

  // Zero-re-render 60fps drag-to-reorder state (siblings animate imperatively on native driver!)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragTranslateY = useRef(new Animated.Value(0)).current;
  const shiftAnimsRef = useRef<Map<number, Animated.Value>>(new Map());
  const siblingTargetsRef = useRef<Map<number, number>>(new Map());
  const cellLayoutsRef = useRef<(CellLayout | undefined)[]>([]);
  const scrollOffsetRef = useRef(0);
  const draggingIndexRef = useRef<number | null>(null);
  const pendingDragIndexRef = useRef<number>(-1);
  const hoverIndexRef = useRef<number | null>(null);
  const isDroppingRef = useRef(false);
  const visibleNotesRef = useRef<Note[]>(visibleNotes);
  visibleNotesRef.current = visibleNotes;

  const isFiltering =
    searchQuery.trim().length > 0 || effectiveTag !== null;
  const canDrag = !isFiltering && visibleNotes.length > 1;
  const canDragRef = useRef(canDrag);
  canDragRef.current = canDrag;

  useEffect(() => {
    cellLayoutsRef.current.length = visibleNotes.length;
  }, [visibleNotes.length]);

  useEffect(() => {
    if (draggingIndex === null) {
      siblingTargetsRef.current.clear();
      shiftAnimsRef.current.forEach((anim) => {
        anim.stopAnimation();
        anim.setValue(0);
      });
      dragTranslateY.stopAnimation();
      dragTranslateY.setValue(0);
    }
  }, [dragTranslateY, draggingIndex]);

  const getShiftAnim = useCallback((noteId: number) => {
    let anim = shiftAnimsRef.current.get(noteId);
    if (!anim) {
      anim = new Animated.Value(0);
      shiftAnimsRef.current.set(noteId, anim);
    }
    return anim;
  }, []);

  const resetAllSiblingShifts = useCallback((immediate: boolean) => {
    siblingTargetsRef.current.clear();
    shiftAnimsRef.current.forEach((anim) => {
      anim.stopAnimation();
      if (immediate) {
        anim.setValue(0);
      } else {
        Animated.timing(anim, {
          toValue: 0,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });
  }, []);

  const getRowHeights = useCallback(
    (len: number) =>
      Array.from(
        { length: len },
        (_, i) => cellLayoutsRef.current[i]?.height ?? DEFAULT_ROW_HEIGHT
      ),
    []
  );

  const animateSiblingsToHover = useCallback(
    (list: Note[], heights: number[], fromIdx: number, toIdx: number) => {
      const draggedNote = list[fromIdx];
      const hoverNote = list[toIdx];
      const isSameGroup =
        Boolean(draggedNote && hoverNote && draggedNote.isPinned === hoverNote.isPinned);
      const draggedH = heights[fromIdx] ?? DEFAULT_ROW_HEIGHT;

      for (let i = 0; i < list.length; i += 1) {
        if (i === fromIdx) continue;
        let desired = 0;
        if (isSameGroup) {
          if (fromIdx < toIdx && i > fromIdx && i <= toIdx) {
            desired = -draggedH;
          } else if (fromIdx > toIdx && i >= toIdx && i < fromIdx) {
            desired = draggedH;
          }
        }
        const id = list[i].id;
        if (siblingTargetsRef.current.get(id) !== desired) {
          siblingTargetsRef.current.set(id, desired);
          Animated.spring(getShiftAnim(id), {
            toValue: desired,
            tension: 280,
            friction: 26,
            useNativeDriver: true,
          }).start();
        }
      }
    },
    [getShiftAnim]
  );

  const handleDragStart = useCallback(
    (index: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      resetAllSiblingShifts(true);
      dragTranslateY.stopAnimation();
      dragTranslateY.setValue(0);
      draggingIndexRef.current = index;
      hoverIndexRef.current = index;
      setDraggingIndex(index);
    },
    [dragTranslateY, resetAllSiblingShifts]
  );

  const handleDragMove = useCallback(
    (dy: number) => {
      const fromIdx = draggingIndexRef.current;
      if (fromIdx === null) return;

      const list = visibleNotesRef.current;
      const heights = getRowHeights(list.length);
      const source = list[fromIdx];

      // Soft rubber-band damping past the edges of the dragged note's pin group
      let minGroupIdx = fromIdx;
      let maxGroupIdx = fromIdx;
      if (source) {
        while (minGroupIdx > 0 && list[minGroupIdx - 1].isPinned === source.isPinned) {
          minGroupIdx -= 1;
        }
        while (
          maxGroupIdx < list.length - 1 &&
          list[maxGroupIdx + 1].isPinned === source.isPinned
        ) {
          maxGroupIdx += 1;
        }
      }
      const minDy = computeDragDropOffset(heights, fromIdx, minGroupIdx);
      const maxDy = computeDragDropOffset(heights, fromIdx, maxGroupIdx);
      let visualDy = dy;
      if (dy < minDy) {
        visualDy = minDy + (dy - minDy) * 0.24;
      } else if (dy > maxDy) {
        visualDy = maxDy + (dy - maxDy) * 0.24;
      }
      dragTranslateY.setValue(visualDy);

      const nextTarget = computeDragTargetIndex(heights, fromIdx, dy);
      if (nextTarget !== hoverIndexRef.current) {
        hoverIndexRef.current = nextTarget;
        const target = list[nextTarget];
        if (source && target && source.isPinned === target.isPinned) {
          Haptics.selectionAsync().catch(() => {});
        }
        animateSiblingsToHover(list, heights, fromIdx, nextTarget);
      }
    },
    [animateSiblingsToHover, dragTranslateY, getRowHeights]
  );

  const handleDragEnd = useCallback(
    (dy: number) => {
      const fromIdx = draggingIndexRef.current;
      if (fromIdx === null) return;
      draggingIndexRef.current = null;
      hoverIndexRef.current = null;

      const list = visibleNotesRef.current;
      const heights = getRowHeights(list.length);
      const toIdx = computeDragTargetIndex(heights, fromIdx, dy);
      const source = list[fromIdx];
      const target = list[toIdx];
      const isValidMove =
        toIdx !== fromIdx &&
        source !== undefined &&
        target !== undefined &&
        source.isPinned === target.isPinned;

      if (isValidMove) {
        isDroppingRef.current = true;
        const destOffset = computeDragDropOffset(heights, fromIdx, toIdx);
        Animated.timing(dragTranslateY, {
          toValue: destOffset,
          duration: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          // Commit new order & clear draggingIndex atomically in the same React batch (zero 1-frame flash!)
          onReorderNotes(list, fromIdx, toIdx);
          setDraggingIndex(null);
          isDroppingRef.current = false;
        });
        return;
      }

      // Cross-pin attempt shows warning toast
      if (toIdx !== fromIdx) {
        onReorderNotes(list, fromIdx, toIdx);
      }

      if (Math.abs(dy) < 2) {
        resetAllSiblingShifts(true);
        dragTranslateY.setValue(0);
        setDraggingIndex(null);
        return;
      }

      isDroppingRef.current = true;
      resetAllSiblingShifts(false);
      Animated.timing(dragTranslateY, {
        toValue: 0,
        duration: 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setDraggingIndex(null);
        isDroppingRef.current = false;
      });
    },
    [dragTranslateY, getRowHeights, onReorderNotes, resetAllSiblingShifts]
  );

  const dragCallbacksRef = useRef({
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  });
  dragCallbacksRef.current = {
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };

  // Sibling gesture rail sits ABOVE FlatList so Android ScrollView can NEVER steal touch #1!
  const railPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        if (!canDragRef.current || isDroppingRef.current) return false;
        const contentY = evt.nativeEvent.locationY + scrollOffsetRef.current;
        const idx = findCardIndexAtY(
          cellLayoutsRef.current,
          visibleNotesRef.current.length,
          contentY,
          DEFAULT_ROW_HEIGHT
        );
        if (idx === -1) return false;
        pendingDragIndexRef.current = idx;
        return true;
      },
      onMoveShouldSetPanResponder: () => draggingIndexRef.current !== null,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        if (pendingDragIndexRef.current >= 0) {
          dragCallbacksRef.current.handleDragStart(pendingDragIndexRef.current);
          pendingDragIndexRef.current = -1;
        }
      },
      onPanResponderMove: (_evt, gestureState) => {
        dragCallbacksRef.current.handleDragMove(gestureState.dy);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        dragCallbacksRef.current.handleDragEnd(gestureState.dy);
      },
      onPanResponderTerminate: (_evt, gestureState) => {
        dragCallbacksRef.current.handleDragEnd(gestureState.dy);
      },
    })
  ).current;

  const keyExtractor = useCallback((item: Note) => String(item.id), []);

  const renderCell = useCallback(
    ({
      index,
      children,
      style,
      onLayout,
      ...rest
    }: {
      item: Note;
      index: number;
      children: React.ReactNode;
      style?: unknown;
      onLayout?: (e: LayoutChangeEvent) => void;
    }) => {
      const elevated = index === draggingIndex;
      return (
        <View
          {...rest}
          onLayout={(e) => {
            onLayout?.(e);
            if (draggingIndexRef.current === null && !isDroppingRef.current) {
              const { y, height } = e.nativeEvent.layout;
              cellLayoutsRef.current[index] = { y, height };
            }
          }}
          style={[
            style as object,
            elevated ? styles.elevatedCell : styles.normalCell,
          ]}
        >
          {children}
        </View>
      );
    },
    [draggingIndex]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Note; index: number }) => {
      let sectionLabel: string | undefined;
      if (hasBothPinGroups) {
        if (index === 0) sectionLabel = '01 / PINNED';
        else if (index === pinnedCount) sectionLabel = '02 / NOTES';
      }

      return (
        <NoteCard
          note={item}
          index={index}
          sectionLabel={sectionLabel}
          theme={theme}
          showDragHandle={canDrag}
          isDragging={draggingIndex === index}
          isAnyDragging={draggingIndex !== null}
          dragTranslateY={dragTranslateY}
          shiftAnim={getShiftAnim(item.id)}
          onPress={onPressNote}
          onLongPress={onLongPressNote}
        />
      );
    },
    [
      canDrag,
      dragTranslateY,
      draggingIndex,
      getShiftAnim,
      hasBothPinGroups,
      onLongPressNote,
      onPressNote,
      pinnedCount,
      theme,
    ]
  );

  const isArchive = viewMode === 'archive';

  const subtitleText = isArchive
    ? `${String(viewNotes.length).padStart(2, '0')} ARCHIVED ${
        viewNotes.length === 1 ? 'ENTRY' : 'ENTRIES'
      }`
    : viewNotes.length === 0
    ? 'SWISS EDITORIAL FOLIO'
    : `${String(viewNotes.length).padStart(2, '0')} ${
        viewNotes.length === 1 ? 'ENTRY' : 'ENTRIES'
      }${pinnedCount > 0 ? ` · ${String(pinnedCount).padStart(2, '0')} PINNED` : ''}`;

  const emptyTitle = isFiltering
    ? 'No matching notes'
    : isArchive
    ? 'Archive is empty'
    : 'Start your first Risalah';

  const emptySubtitle = isFiltering
    ? 'Try another keyword or clear the active tag filter.'
    : isArchive
    ? 'Long press any note card to move it here, or tap + to create an archived note.'
    : 'Capture ideas, rich notes, checklists, and sketches in one place.';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.bg, paddingTop: insets.top },
      ]}
    >
      {/* Swiss Editorial Masthead Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.cardBorder },
        ]}
      >
        <View style={styles.headerLeft}>
          {isArchive ? (
            <Pressable
              onPress={onBackFromArchive}
              style={({ pressed }) => [
                styles.backCircle,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Back to active notes"
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={19} color={theme.text} />
            </Pressable>
          ) : (
            <View
              style={[
                styles.brandMarkWrap,
                { borderColor: theme.cardBorder },
              ]}
            >
              <Image source={LOGO_ASSET} style={styles.brandMark} />
            </View>
          )}

          <View>
            <View style={styles.eyebrowRow}>
              <View
                style={[styles.eyebrowDot, { backgroundColor: theme.accent }]}
              />
              <Text style={[styles.eyebrowText, { color: theme.muted }]}>
                {subtitleText}
              </Text>
            </View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              {isArchive ? 'Archive' : 'Risalah'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={onToggleTheme}
            style={({ pressed }) => [
              styles.headerActionBtn,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Toggle color theme"
            hitSlop={6}
          >
            <Ionicons
              name={isDarkTheme(themeMode) ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={theme.text}
            />
          </Pressable>

          <Pressable
            onPress={onOpenSettings}
            style={({ pressed }) => [
              styles.avatarBtn,
              {
                backgroundColor: theme.fabBg,
                borderColor: theme.fabBg,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open settings and archive"
            hitSlop={6}
          >
            <Text style={[styles.avatarLabel, { color: theme.fabText }]}>R</Text>
          </Pressable>
        </View>
      </View>

      {/* Architectural Ruled Search Bar */}
      <View style={styles.searchWrapper}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Ionicons name="search" size={18} color={theme.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={onChangeSearch}
            placeholder={
              isArchive
                ? 'Search archive or #tags...'
                : 'Search notes or #tags...'
            }
            placeholderTextColor={theme.muted}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => onChangeSearch('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={theme.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Fixed-Height Quick Tag Filter Strip */}
      {availableTags.length > 0 && (
        <View style={styles.tagStripShell}>
          <ScrollView
            horizontal
            style={styles.tagStripScroll}
            contentContainerStyle={styles.tagStripContent}
            showsHorizontalScrollIndicator={false}
          >
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setSelectedTag(null);
              }}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    effectiveTag === null ? theme.fabBg : theme.card,
                  borderColor:
                    effectiveTag === null ? theme.fabBg : theme.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: effectiveTag === null ? theme.fabText : theme.text,
                  },
                ]}
              >
                ALL
              </Text>
            </Pressable>

            {availableTags.map((tag) => {
              const active = effectiveTag === tag;
              return (
                <Pressable
                  key={tag}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedTag((prev) => (prev === tag ? null : tag));
                  }}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.accent : theme.card,
                      borderColor: active ? theme.accent : theme.cardBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: active ? '#FFFFFF' : theme.text },
                    ]}
                  >
                    #{tag.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Notes List + Sibling Drag Rail (outside ScrollView so touch #1 drags immediately!) */}
      <View style={styles.listWrap}>
        <FlatList
          data={visibleNotes}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          CellRendererComponent={renderCell}
          extraData={{ draggingIndex, hasBothPinGroups, pinnedCount }}
          scrollEnabled={draggingIndex === null}
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.listContent,
            visibleNotes.length === 0 && styles.emptyListContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 104 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyOuterRing,
                { backgroundColor: theme.accentLight },
              ]}
            >
              {isFiltering ? (
                <Ionicons name="search-outline" size={34} color={theme.accent} />
              ) : isArchive ? (
                <Ionicons
                  name="archive-outline"
                  size={34}
                  color={theme.accent}
                />
              ) : (
                <Image source={LOGO_ASSET} style={styles.emptyLogo} />
              )}
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {emptyTitle}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.muted }]}>
              {emptySubtitle}
            </Text>
            {isFiltering ? (
              <Pressable
                onPress={() => {
                  onChangeSearch('');
                  setSelectedTag(null);
                }}
                style={({ pressed }) => [
                  styles.emptyCta,
                  {
                    backgroundColor: theme.accentLight,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text style={[styles.emptyCtaText, { color: theme.accent }]}>
                  Clear Filters
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onCreateNote}
                style={({ pressed }) => [
                  styles.emptyCta,
                  {
                    backgroundColor: theme.fabBg,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name="add" size={18} color={theme.fabText} />
                <Text style={[styles.emptyCtaText, { color: theme.fabText }]}>
                  {isArchive ? 'New Archived Note' : 'Create Note'}
                </Text>
              </Pressable>
            )}
          </View>
        }
        />
        {canDrag && (
          <View
            collapsable={false}
            style={styles.dragRail}
            {...railPanResponder.panHandlers}
          />
        )}
      </View>

      {/* Swiss Architectural Square FAB with Vermilion Cap */}
      <Pressable
        onPress={onCreateNote}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: theme.fabBg,
            borderTopColor: theme.accent,
            bottom: Math.max(insets.bottom, 16) + 16,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          isArchive ? 'Create archived note' : 'Create new note'
        }
      >
        <Ionicons name="add" size={28} color={theme.fabText} />
      </Pressable>
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
  brandMarkWrap: {
    width: 40,
    height: 40,
    borderRadius: RADII.card,
    overflow: 'hidden',
    borderWidth: 1,
  },
  brandMark: {
    width: '100%',
    height: '100%',
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: RADII.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  eyebrowText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 31,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: RADII.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: RADII.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontFamily: FONTS.serif,
    fontSize: 17,
    fontWeight: '700',
  },
  searchWrapper: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: RADII.search,
    borderWidth: 1,
    paddingHorizontal: 13,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  tagStripShell: {
    height: 38,
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 4,
  },
  tagStripScroll: {
    flexGrow: 0,
    height: 38,
  },
  tagStripContent: {
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 7,
    height: 38,
  },
  filterChip: {
    paddingHorizontal: 11,
    height: 30,
    borderRadius: RADII.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
  },
  listWrap: {
    flex: 1,
    position: 'relative',
  },
  dragRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 18,
    width: 48,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  elevatedCell: {
    zIndex: 100,
    elevation: 12,
  },
  normalCell: {
    zIndex: 1,
    elevation: 0,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 44,
  },
  emptyOuterRing: {
    width: 78,
    height: 78,
    borderRadius: RADII.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    overflow: 'hidden',
  },
  emptyLogo: {
    width: 64,
    height: 64,
    borderRadius: RADII.pill,
  },
  emptyTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 22,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    height: 44,
    borderRadius: RADII.card,
  },
  emptyCtaText: {
    fontFamily: FONTS.mono,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  fab: {
    position: 'absolute',
    right: 18,
    width: 56,
    height: 56,
    borderRadius: RADII.fab,
    borderTopWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
});
