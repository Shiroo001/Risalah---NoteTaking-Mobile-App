import type { Note } from '../types/note';

export type ReorderOutcome =
  | { ok: true; notes: Note[] }
  | { ok: false; reason: 'cross-pin-boundary' | 'noop' };

/**
 * Reorders notes in the current visible list and recalculates sequential `sortOrder`
 * within the affected group (pinned or unpinned).
 *
 * Strict Rule (PRD Section 5.8):
 * - Pinned notes may ONLY swap/reorder with other pinned notes.
 * - Unpinned notes may ONLY swap/reorder with other unpinned notes.
 * - Cross-boundary swaps are rejected with `reason: 'cross-pin-boundary'`.
 */
export function reorderVisibleNotes(
  allNotes: Note[],
  visibleNotes: Note[],
  fromIndex: number,
  toIndex: number
): ReorderOutcome {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= visibleNotes.length ||
    toIndex >= visibleNotes.length ||
    fromIndex === toIndex
  ) {
    return { ok: false, reason: 'noop' };
  }

  const source = visibleNotes[fromIndex];
  const target = visibleNotes[toIndex];

  if (source.isPinned !== target.isPinned) {
    return { ok: false, reason: 'cross-pin-boundary' };
  }

  // Reorder the entire visible list, then assign sequential sortOrder to the affected pin-group
  const nextVisible = [...visibleNotes];
  const [moved] = nextVisible.splice(fromIndex, 1);
  nextVisible.splice(toIndex, 0, moved);

  const groupOrderMap = new Map<number, number>();
  let orderCounter = 0;
  for (const item of nextVisible) {
    if (item.isPinned === source.isPinned) {
      groupOrderMap.set(item.id, orderCounter);
      orderCounter += 1;
    }
  }

  const updatedNotes = allNotes.map((note) => {
    const newOrder = groupOrderMap.get(note.id);
    if (newOrder === undefined) return note;
    return {
      ...note,
      sortOrder: newOrder,
    };
  });

  return { ok: true, notes: updatedNotes };
}

/**
 * Symmetric 50%-crossing target slot calculation for drag-to-reorder.
 * Ensures dragging UP and dragging DOWN trigger at identical half-card thresholds.
 */
export function computeDragTargetIndex(
  heights: number[],
  fromIndex: number,
  dy: number
): number {
  const len = heights.length;
  if (len <= 1 || fromIndex < 0 || fromIndex >= len) return fromIndex;

  const tops: number[] = [];
  let acc = 0;
  for (let i = 0; i < len; i += 1) {
    tops.push(acc);
    acc += heights[i];
  }

  const draggedCenter = tops[fromIndex] + heights[fromIndex] / 2 + dy;
  let target = fromIndex;

  if (dy > 0) {
    while (target < len - 1 && draggedCenter >= tops[target + 1]) {
      target += 1;
    }
  } else if (dy < 0) {
    while (
      target > 0 &&
      draggedCenter <= tops[target - 1] + heights[target - 1]
    ) {
      target -= 1;
    }
  }

  return target;
}

/**
 * Exact Y offset to glide a dragged card from `fromIndex` into `toIndex` before committing state.
 */
export function computeDragDropOffset(
  heights: number[],
  fromIndex: number,
  toIndex: number
): number {
  if (fromIndex === toIndex) return 0;
  let delta = 0;
  if (toIndex > fromIndex) {
    for (let i = fromIndex + 1; i <= toIndex; i += 1) {
      delta += heights[i] ?? 0;
    }
    return delta;
  }
  for (let i = toIndex; i < fromIndex; i += 1) {
    delta -= heights[i] ?? 0;
  }
  return delta;
}

export interface CellLayout {
  y: number;
  height: number;
}

/**
 * Resolves which visible card index lies under `contentY` inside the scrollable list.
 */
export function findCardIndexAtY(
  layouts: (CellLayout | undefined)[],
  count: number,
  contentY: number,
  fallbackHeight = 122
): number {
  if (count <= 0 || contentY < 0) return -1;
  let cursorY = 6;
  for (let i = 0; i < count; i += 1) {
    const layout = layouts[i];
    const top = layout ? layout.y : cursorY;
    const height = layout ? layout.height : fallbackHeight;
    if (contentY >= top && contentY <= top + height) {
      return i;
    }
    cursorY = top + height;
  }
  return -1;
}
