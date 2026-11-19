import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { ContextMenuModal } from './src/components/ContextMenuModal';
import { PinModal } from './src/components/PinModal';
import { SettingsModal } from './src/components/SettingsModal';
import { SyncModal } from './src/components/SyncModal';
import { Toast } from './src/components/Toast';
import { EditorScreen } from './src/screens/EditorScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { TrashScreen } from './src/screens/TrashScreen';
import {
  clearAllAppData,
  DEFAULT_SETTINGS,
  loadNotes,
  loadSettings,
  saveArchivePin,
  saveNotes,
  saveSettings,
} from './src/storage/storage';
import { getThemePalette, isDarkTheme } from './src/theme/tokens';
import type {
  Note,
  PinModalMode,
  Settings,
  ThemeMode,
  ToastState,
  ToastVariant,
  ViewMode,
} from './src/types/note';
import {
  exportNotesToJsonFile,
  importNotesFromJsonFile,
} from './src/utils/backupIO';
import { syncAllWithPhpBackend } from './src/utils/phpSync';
import { reorderVisibleNotes } from './src/utils/reorder';
import { stripHtml } from './src/utils/text';

interface ActiveEditorSession {
  note: Note;
  isNew: boolean;
}

const TOAST_DURATION_MS = 2800;

function RisalahApp() {
  const insets = useSafeAreaInsets();
  const [hydrated, setHydrated] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [editorSession, setEditorSession] =
    useState<ActiveEditorSession | null>(null);
  const [contextNote, setContextNote] = useState<Note | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<PinModalMode | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = useMemo(
    () => getThemePalette(settings.theme),
    [settings.theme]
  );

  // Hydrate offline storage & SecureStore PIN on startup
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [storedNotes, storedSettings] = await Promise.all([
        loadNotes(),
        loadSettings(),
      ]);
      if (!mounted) return;
      setNotes(storedNotes);
      setSettings(storedSettings);
      setHydrated(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      setToast({ id: Date.now(), message, variant });
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
      }, TOAST_DURATION_MS);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const updateNotes = useCallback((updater: (prev: Note[]) => Note[]) => {
    setNotes((prev) => {
      const next = updater(prev);
      saveNotes(next);
      return next;
    });
  }, []);

  const handleSelectTheme = useCallback((nextTheme: ThemeMode) => {
    Haptics.selectionAsync().catch(() => {});
    setSettings((prev) => {
      if (prev.theme === nextTheme) return prev;
      const next: Settings = { ...prev, theme: nextTheme };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleToggleTheme = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setSettings((prev) => {
      const next: Settings = {
        ...prev,
        theme: isDarkTheme(prev.theme) ? 'light' : 'dark',
      };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleCreateNote = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const now = Date.now();
    const draftNote: Note = {
      id: now,
      title: '',
      content: '',
      tags: [],
      isPinned: false,
      isArchived: viewMode === 'archive',
      isDeleted: false,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    setEditorSession({ note: draftNote, isNew: true });
  }, [viewMode]);

  const handleOpenNote = useCallback((note: Note) => {
    setEditorSession({ note, isNew: false });
  }, []);

  const handlePersistNote = useCallback(
    (updated: Note) => {
      updateNotes((prev) => {
        const idx = prev.findIndex((n) => n.id === updated.id);
        if (idx === -1) {
          return [updated, ...prev];
        }
        const clone = [...prev];
        clone[idx] = updated;
        return clone;
      });
    },
    [updateNotes]
  );

  const handleDiscardNewNote = useCallback(
    (noteId: number) => {
      updateNotes((prev) => prev.filter((n) => n.id !== noteId));
    },
    [updateNotes]
  );

  const handleLongPressNote = useCallback((note: Note) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setContextNote(note);
  }, []);

  const handleTogglePin = useCallback(
    (target: Note) => {
      const nextPinned = !target.isPinned;
      updateNotes((prev) =>
        prev.map((n) =>
          n.id === target.id
            ? { ...n, isPinned: nextPinned, updatedAt: Date.now() }
            : n
        )
      );
      setContextNote(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      showToast(nextPinned ? 'Note pinned' : 'Note unpinned', 'info');
    },
    [showToast, updateNotes]
  );

  const handleToggleArchive = useCallback(
    (target: Note) => {
      const nextArchived = !target.isArchived;
      updateNotes((prev) =>
        prev.map((n) =>
          n.id === target.id
            ? {
                ...n,
                isArchived: nextArchived,
                isPinned: nextArchived ? false : n.isPinned,
                updatedAt: Date.now(),
              }
            : n
        )
      );
      setContextNote(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      showToast(
        nextArchived ? 'Archived' : 'Restored from archive',
        'success'
      );
    },
    [showToast, updateNotes]
  );

  const handleShareNote = useCallback(
    async (target: Note) => {
      setContextNote(null);
      const titleLine = target.title.trim();
      const tagLine =
        target.tags.length > 0
          ? target.tags.map((t) => `#${t}`).join(' ')
          : '';
      const bodyText = stripHtml(target.content);
      const message = [titleLine, tagLine, bodyText]
        .filter((part) => part.length > 0)
        .join('\n\n');

      try {
        await Share.share({
          title: titleLine || 'Risalah Note',
          message: message || 'Untitled',
        });
      } catch {
        showToast('Unable to share note', 'error');
      }
    },
    [showToast]
  );

  const handleDeleteNote = useCallback(
    (target: Note) => {
      updateNotes((prev) =>
        prev.map((n) =>
          n.id === target.id
            ? { ...n, isDeleted: true, isPinned: false, updatedAt: Date.now() }
            : n
        )
      );
      setContextNote(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {}
      );
      showToast('Moved to trash', 'info');
    },
    [showToast, updateNotes]
  );

  // Fase 2: Trash actions
  const handleRestoreFromTrash = useCallback(
    (target: Note) => {
      updateNotes((prev) =>
        prev.map((n) =>
          n.id === target.id
            ? { ...n, isDeleted: false, updatedAt: Date.now() }
            : n
        )
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      showToast('Note restored', 'success');
    },
    [showToast, updateNotes]
  );

  const handleDeletePermanent = useCallback(
    (target: Note) => {
      updateNotes((prev) => prev.filter((n) => n.id !== target.id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {}
      );
      showToast('Deleted permanently', 'info');
    },
    [showToast, updateNotes]
  );

  const handleEmptyTrash = useCallback(() => {
    updateNotes((prev) => prev.filter((n) => !n.isDeleted));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {}
    );
    showToast('Trash emptied', 'success');
  }, [showToast, updateNotes]);

  // Fase 2: Archive PIN Security
  const handleRequestArchive = useCallback(() => {
    if (settings.archivePin) {
      setPinModalMode('verify-archive');
    } else {
      setViewMode('archive');
      setSearchQuery('');
    }
  }, [settings.archivePin]);

  const handleSetPin = useCallback(
    async (newPin: string) => {
      try {
        const wasSet = Boolean(settings.archivePin);
        await saveArchivePin(newPin);
        setSettings((prev) => ({ ...prev, archivePin: newPin }));
        setPinModalMode(null);
        showToast(wasSet ? 'Archive PIN updated' : 'PIN set', 'success');
      } catch {
        showToast('Failed to save PIN securely', 'error');
      }
    },
    [settings.archivePin, showToast]
  );

  const handleRemovePin = useCallback(async () => {
    try {
      await saveArchivePin('');
      setSettings((prev) => ({ ...prev, archivePin: '' }));
      setPinModalMode(null);
      showToast('Archive PIN removed', 'info');
    } catch {
      showToast('Failed to remove PIN', 'error');
    }
  }, [showToast]);

  // Fase 2: Backup & Restore JSON
  const handleExportBackup = useCallback(async () => {
    try {
      const { count } = await exportNotesToJsonFile(notes);
      showToast(`Exported ${count} notes`, 'success');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to export backup';
      showToast(msg, 'error');
    }
  }, [notes, showToast]);

  const handleImportBackup = useCallback(async () => {
    try {
      const { canceled, importedNotes } = await importNotesFromJsonFile(notes);
      if (canceled) return;
      if (importedNotes.length === 0) {
        showToast('Backup file has no notes to import', 'info');
        return;
      }
      updateNotes((prev) => [...importedNotes, ...prev]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
      showToast(
        `Imported ${importedNotes.length} note${
          importedNotes.length === 1 ? '' : 's'
        }`,
        'success'
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Invalid backup JSON file';
      showToast(msg, 'error');
    }
  }, [notes, showToast, updateNotes]);

  // Fase 3: Optional LAN PHP Backend Sync
  const handleSaveSyncUrl = useCallback((url: string) => {
    setSettings((prev) => {
      const next: Settings = { ...prev, syncBaseUrl: url };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleSyncNow = useCallback(
    async (baseUrl: string) => {
      const summary = await syncAllWithPhpBackend(baseUrl, notes, settings);
      setNotes(summary.mergedNotes);
      saveNotes(summary.mergedNotes);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
      showToast(
        `Synced: ${summary.pulledCount} pulled, ${summary.pushedCount} pushed`,
        'success'
      );
    },
    [notes, settings, showToast]
  );

  // Fase 2: Reset App Data
  const handleResetAppData = useCallback(async () => {
    try {
      await clearAllAppData();
      setNotes([]);
      setSettings(DEFAULT_SETTINGS);
      setViewMode('active');
      setSearchQuery('');
      setEditorSession(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {}
      );
      showToast('All local data reset', 'info');
    } catch {
      showToast('Failed to reset app data', 'error');
    }
  }, [showToast]);

  // Fase 2: Drag-to-Reorder with strict pinned/unpinned guard
  const handleReorderNotes = useCallback(
    (visibleNotes: Note[], fromIndex: number, toIndex: number) => {
      const outcome = reorderVisibleNotes(
        notes,
        visibleNotes,
        fromIndex,
        toIndex
      );
      if (!outcome.ok) {
        if (outcome.reason === 'cross-pin-boundary') {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
          ).catch(() => {});
          showToast(
            'Pinned and unpinned notes cannot be swapped',
            'error'
          );
        }
        return;
      }

      setNotes(outcome.notes);
      saveNotes(outcome.notes);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      showToast('Notes reordered', 'success');
    },
    [notes, showToast]
  );

  // Android hardware BackHandler priority for Modals, Trash & Archive mode
  useEffect(() => {
    if (editorSession) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pinModalMode) {
        setPinModalMode(null);
        return true;
      }
      if (syncModalVisible) {
        setSyncModalVisible(false);
        return true;
      }
      if (contextNote) {
        setContextNote(null);
        return true;
      }
      if (settingsVisible) {
        setSettingsVisible(false);
        return true;
      }
      if (viewMode === 'archive' || viewMode === 'trash') {
        setViewMode('active');
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [
    contextNote,
    editorSession,
    pinModalMode,
    settingsVisible,
    syncModalVisible,
    viewMode,
  ]);

  const activeCount = useMemo(
    () => notes.filter((n) => !n.isDeleted && !n.isArchived).length,
    [notes]
  );

  const archivedCount = useMemo(
    () => notes.filter((n) => !n.isDeleted && n.isArchived).length,
    [notes]
  );

  const deletedCount = useMemo(
    () => notes.filter((n) => n.isDeleted).length,
    [notes]
  );

  const darkStatus = isDarkTheme(settings.theme);

  if (!hydrated) {
    return (
      <View style={[styles.splashFallback, { backgroundColor: theme.bg }]}>
        <StatusBar style={darkStatus ? 'light' : 'dark'} />
        <ActivityIndicator size="small" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={darkStatus ? 'light' : 'dark'} />

      {editorSession ? (
        <EditorScreen
          key={editorSession.note.id}
          initialNote={editorSession.note}
          isNew={editorSession.isNew}
          theme={theme}
          onPersistNote={handlePersistNote}
          onDiscardNewNote={handleDiscardNewNote}
          onClose={() => setEditorSession(null)}
          onShowToast={showToast}
        />
      ) : viewMode === 'trash' ? (
        <TrashScreen
          notes={notes}
          theme={theme}
          onBack={() => setViewMode('active')}
          onRestore={handleRestoreFromTrash}
          onDeletePermanent={handleDeletePermanent}
          onEmptyTrash={handleEmptyTrash}
        />
      ) : (
        <HomeScreen
          notes={notes}
          viewMode={viewMode}
          searchQuery={searchQuery}
          theme={theme}
          themeMode={settings.theme}
          onChangeSearch={setSearchQuery}
          onBackFromArchive={() => setViewMode('active')}
          onToggleTheme={handleToggleTheme}
          onOpenSettings={() => setSettingsVisible(true)}
          onPressNote={handleOpenNote}
          onLongPressNote={handleLongPressNote}
          onReorderNotes={handleReorderNotes}
          onCreateNote={handleCreateNote}
        />
      )}

      <ContextMenuModal
        note={contextNote}
        theme={theme}
        onClose={() => setContextNote(null)}
        onTogglePin={handleTogglePin}
        onToggleArchive={handleToggleArchive}
        onShare={handleShareNote}
        onDelete={handleDeleteNote}
      />

      <SettingsModal
        visible={settingsVisible}
        theme={theme}
        themeMode={settings.theme}
        viewMode={viewMode}
        hasArchivePin={Boolean(settings.archivePin)}
        syncBaseUrl={settings.syncBaseUrl}
        activeCount={activeCount}
        archivedCount={archivedCount}
        deletedCount={deletedCount}
        onClose={() => setSettingsVisible(false)}
        onRequestArchive={handleRequestArchive}
        onOpenActiveNotes={() => {
          setViewMode('active');
          setSearchQuery('');
        }}
        onOpenTrash={() => {
          setViewMode('trash');
          setSearchQuery('');
        }}
        onSelectTheme={handleSelectTheme}
        onSetupPin={() => setPinModalMode('setup')}
        onChangePin={() => setPinModalMode('change')}
        onRemovePin={() => setPinModalMode('remove')}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onOpenSync={() => setSyncModalVisible(true)}
        onResetAppData={handleResetAppData}
      />

      <SyncModal
        visible={syncModalVisible}
        syncBaseUrl={settings.syncBaseUrl}
        theme={theme}
        onClose={() => setSyncModalVisible(false)}
        onSaveBaseUrl={handleSaveSyncUrl}
        onSyncNow={handleSyncNow}
      />

      <PinModal
        visible={pinModalMode !== null}
        mode={pinModalMode ?? 'verify-archive'}
        currentPin={settings.archivePin}
        theme={theme}
        onClose={() => setPinModalMode(null)}
        onVerifiedArchive={() => {
          setPinModalMode(null);
          setViewMode('archive');
          setSearchQuery('');
        }}
        onSetPin={handleSetPin}
        onRemovePin={handleRemovePin}
      />

      <Toast
        toast={toast}
        theme={theme}
        bottomOffset={
          editorSession
            ? Math.max(insets.bottom, 16) + 116
            : Math.max(insets.bottom, 16) + 84
        }
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <RisalahApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splashFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
